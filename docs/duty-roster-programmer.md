# جدول الدوام والحضور — دليل مبرمج مفصّل

NiroVera / PowerCare. عزل `companyId`. الواجهة عربية RTL أولًا. الأرقام على الشاشة **مشتقة**، ليست مصدرًا يُكتب يدويًا.

دورة الإثبات — الحلقة 1: **شخص + مكان + وقت**. الجدول يرسم الساعة. البصمة تلتقط. التقويم يثبت. المسير والمهام والتوقيع يأتون بعدها.

---

## 1. الأسطح والمسارات

| مسار | صفحة | عمل |
|---|---|---|
| `/app/shifts` | `Attendance.jsx` (`focusShifts`) | شبكة الأسبوع + نشر |
| `/app/attendance` | نفس الملف | بصمتي / كشفي / طابور المدير / سياسة المواقع |
| `/app/calendar` | نفس الملف (`focusCalendar`) | التقويم التشغيلي |
| `/app/requests` | `Requests.jsx` | إجازة، تغيير وردية، موافقة ليل |

التبويب في الشريط: موظف = **بصمتي**. إدارة = **الحضور والدوام**.  
`DutyLaneBar` + `?lane=mine|manage`. لا تخلط طابور قرارات الفريق مع سطح بصمة الموظف.

مجموعة التطبيق: `src/lib/suiteApps.js` (`id: "shifts"`، `group: "duty"`).  
التوجيه: `src/App.jsx` → `<Route path="/app/shifts" />`.

---

## 2. خريطة الملفات

```
src/pages/Attendance.jsx
src/components/schedules/
  ShiftsPlatformBoard.jsx     # فرع واحد + lane
  ShiftWeekBoard.jsx          # الشبكة، النشر، الليل، التاريخ
  RotaPublishPanel.jsx        # فحوص شهرية قديمة (workforce checkPublish)
  PublishedWeekMinistryStrip.jsx
src/components/attendance/
  CheckInOutCard.jsx
  AttendanceMineWeek.jsx
  AttendanceMonthCalendar.jsx
  AttendanceSettingsBoard.jsx
src/lib/shiftWeek.js          # حالة النشر، بوابات الأسبوع، تصنيف الورديات، نطاق الفرع
src/lib/shiftDerivations.js   # نوافذ قياسية، checkPublishGates الشهري
src/lib/decision18632.js      # ليل: نافذة، عامل ليلي، موافقة
src/lib/attendance.js         # واجهة رفيعة + إعادة تصدير الاشتقاق
src/lib/attendanceDerivations.js
src/lib/attendanceCalendar.js
src/lib/operationalCalendar.js
src/lib/laborHoursPolicy.js   # سقف يوم/أسبوع، م99 تسع ساعات، رمضان
src/lib/facts/attendance.js   # ATTENDANCE_FACTS
src/lib/store.js              # setEmployeeDayShift, publishWeek, copyScheduleMonth
```

الحقيقة المخزّنة: `company.schedules[]` (`blobCategory: schedules`, `writer: attendance-policy`).  
البصمة: `personalAttendance` (قديم: `attendanceLedger`).  
الإضافي للمسير: مشتق `stored: false`.

---

## 3. نموذج الجدول

جدول **واحد لكل فرع**:

```js
{
  stationId,
  shiftTypes: [{ id, label, start: "HH:MM", end: "HH:MM", restMinutes }],
  assignments: {
    "YYYY-MM-DD": { [shiftTypeId]: [employeeId, ...] },
    // معاينة قديمة: مفتاح 0–6 = يوم الأسبوع. dayAssignmentMap يفضّل المؤرخ ثم يسقط للأسبوعي
  },
  publishedWeeks: { [weekKey]: { at, by, validity, validUntil } },
  weekDirty: { [weekKey]: true },
  nightCompensation: boolean,
  validity: "week" | "until",
  validUntil: "YYYY-MM-DD"
}
```

`weekKey` من `weekKeyFromDate`.  
شخص واحد في نوع واحد في اليوم: `assignEmployeeDayOnSchedule` يمسح المعرّف من كل الأنواع ثم يضيفه أو يترك راحة (`shiftTypeId == null`).

نوافذ قياسية — `STANDARD_SHIFT_WINDOWS`:

| key | start–end | restMinutes |
|---|---|---|
| morning | 07:00–15:00 | 30 |
| evening | 15:00–23:00 | 30 |
| night | 23:00–07:00 | 30 |
| twelve | 07:00–19:00 | 120 |

إضافة نوع: `nextDistinctShift` يأخذ أول نافذة غير مستخدمة. لا تعتمد على `id === "morning"` وحدها؛ المعاينة تبحث أيضًا `start === "07:00"`.

---

## 4. أي فرع يُعرض؟

`rosterTableStation` في `shiftWeek.js`:

- `lane === "mine"`: فرع العمل فقط (`profile.workStationId` ثم `employee.stationId`). الهيدر «كل الفروع» **لا** يستبدل الجدول.
- `lane === "manage"`: فرع الهيدر إن كان واحدًا، وإلا فرع العمل، وإلا `fallback`.
- «كل الفروع» في الإدارة لا يدمج الشبكات. يظهر تنبيه: اختر فرعًا من الهيدر.

بدون فرع عمل على الملف: شبكة الموظف فارغة بسبب مسمّى.

صلاحية الرسم: `canManageRotaPolicy` = مالك أو `director` / `ops_manager` / `station_manager` أو `canCreateTasks`.  
`ShiftWeekBoard` يأخذ `canEdit={!mine && canManageRotaPolicy}`.

---

## 5. تصنيف الوردية (ليس عدد الساعات)

```
isMorningShift     تسمية صباحي/morning أو بداية 05:00–11:59، وليست ليلية
isEveningShift     تسمية مسائي/evening أو بداية 12:00–22:59، وليست ليلية
performsNightWork  nightMinutesInWindow(start,end) > 0   // أي دقيقة 23:00–06:00
isNightWorker      دقائق الليل ≥ 3 ساعات                 // عامل ليلي 18632
```

قواعد الليل في `laborRules.js`: `hours.night.startHour=23`, `endHour=6`, `workerHours=3`, `restHours=12`, `rotateWeeks=13`.

**م99 تسع ساعات** (`hoursPolicyOf` → `extendedNine`) سقف يومي عادي للأجر والاشتقاق، **لا** يدمج صباحيًا ومسائيًا.  
`07:00–15:00` صباحي 8س. `07:00–16:00` صباحي 9س. `15:00–23:00` مسائي حتى لو الطول تساوى.

التأخير: `lateMinutesFromScheduledStart(now, shift.start)` من بداية **ذلك** الموظف. لا `DEFAULT_SHIFT_START` كمصدر حي (الموجود ثابت احتياطي فقط). الواجهة: لا حد سماح؛ الدقائق تُسجَّل كما هي.

---

## 6. حالة النشر — ساعة البصمة الحقيقية

`weekPublishState(schedule, weekStart)`:

| kind | شرط | أثر |
|---|---|---|
| `published` | لقطة في `publishedWeeks` و`weekDirty` غائب | التقويم والشبكة يقرآن |
| `edited` | لقطة أو ماضٍ + `weekDirty` | يحتاج «انشر التعديل»؛ لا أثر رجعي صامت |
| `implicit` | نهاية الأسبوع قبل اليوم، بلا لقطة نظيفة | أسبوع ماضٍ يُعامل منشورًا |
| `draft` | غير ذلك | البصمة الشرعية للوردية مغلقة |

`isWeekDayPublished` = `published|implicit` أو (تعيين موجود و`kind !== draft`).  
أي تعديل نافذة/تعيين يضع `weekDirty[weekKey]=true`.

`publishWeek(companyId, stationId, weekStartKey, { by })`:

1. `checkWeekPublishGates`
2. إن `blocked` → `{ error: "PUBLISH_BLOCKED", blockers }` **بدون كتابة**
3. وإلا: `clearRosterLeaveGhostAssignments` ثم لقطة `publishedWeeks` ومسح dirty

نسخ الشهر `copyScheduleMonth` ينسخ التعيينات المؤرخة فقط. لا ينشر أسابيع ولا يصفّر عدّاد 18632.

---

## 7. سلسلتا البوابات

### أ) عند الخلية — `checkShiftChangeApplyGate`

ثم `setEmployeeDayShift` → `resolveNightRestAssignTarget` (قد يقفز ليوم/وردية قانونية بدل إسناد ليلي غير قانوني).

أخطاء شائعة يجب إبقاؤها **مسمّاة** (`error` + `reason`):

| error | المعنى |
|---|---|
| `ON_LEAVE` | إجازة طلباتي معتمدة — لا إسناد |
| `OFFICIAL_HOLIDAY` | م112: وطني / تأسيس / عيد |
| `NIGHT_REST_REQUIRED` | راحة 12س بعد عمل ليلي |
| `NIGHT_CONSENT_REQUIRED` | >13 أسبوع عامل ليلي بلا موافقة خطية — أسند صباحي/مسائي |
| `NIGHT_HOURS_REDUCED` | تقليص ساعات مسجّل |
| `RAMADAN_DAY_CAP` | نظام 8س/5 أيام ينزل إلى 6؛ 12 بقاء تبقى 12 |
| حدث م162–164 | تحت 15، ليل، سقف ساعات |

الحمل واللياقة الطبية لليل تُفحص هنا أيضًا.

دورة الخلية للإدارة: `cycleShiftId` — راحة → أنواع الجدول بالترتيب. `ordinaryOnly` يستثني الليل.

### ب) عند النشر — `checkWeekPublishGates`

أمثلة موانع (`block: true`):

- أسبوع > 48س فعلية (أثقل أسبوع × أثقل موظف، لا متوسط شهر)
- يوم > 10س (استثناء م106) أو بقاء > 12س (م101)
- بلا راحة ≥30د كل 5س متصلة (م101/102)
- بلا يوم راحة في الأسبوع (م104)
- رمضان مسلم 6/36 — ملف فارغ = مسلم
- صِدام إجازة مع وردية (طلباتي يُذكر؛ عطلة م112 مسار منفصل)
- ليل بلا راحة 12س؛ تدوير 18632 بلا موافقة؛ بدل/تقليص للعامل الليلي إن لم يكن عرضيًا
- حدث: عمر / ليل / ساعات
- حظر شمس 3337 للميدان المكشوف (15 يونيو–15 سبتمبر، 12:00–15:00) على الأيام الحية

نقص تغطية الخلية **ليس** غياب موظف ولا يُسدّ بتمديد وردية.  
إجازة معتمدة لا تُحسب في ساعات الأسبوع.

`RotaPublishPanel` يستدعي `workforce` `checkPublish` / `publish` على **شهر** — طبقة أقدم بجانب نشر الأسبوع الحي. لا تفترض أنها بديل `publishWeek`.

---

## 8. البصمة تقرأ الجدول

```
getTodaysShift(data, employee)
  stationIds = [stationId, ...extraCoverageStationIds]
  dateKey = toRiyadhDateKey()
  أول وردية في assignments[dateKey][shiftId] تضم الموظف
```

`selfPunchScheduleGate(shift)` → `NOT_SCHEDULED` إن لا `start`.  
الموقع: `isLocationRequired` + geofence الفرع.

حالات مشتقة (`getAttendanceStatus` / تقويم):

- بصمة → `present` أو `late`
- إجازة نظامية → `on_leave`
- يوم فيه تعيينات لآخرين وهو غير مسند → `not_scheduled` / `off_day`
- وردية متوقعة بلا بصمة بعد انقضاء اليوم → `absent`

**انتباه للمبرمج:**  
`hasPublishedScheduleOn` في `attendanceCalendar.js` تعني اليوم «فيه أي إسناد»، **ليست** قراءة `publishedWeeks`.  
ساعة الشبكة والنصوص («بلا جدول») تستخدم `isWeekDayPublished`. إن ربطت منتجًا جديدًا بالبصمة، قرّر أي الدالتين تقصد؛ لا تخلطهما صامتًا.

بصمة بلا وردية منشورة: ليست `late` وليست `absent` شرعيًا — علامة «بلا جدول» لطابور المدير.

---

## 9. الليل 18632 على هذا السطح

لا تُعاد لوحة البوابات كاملة داخل ملف الموظف. هنا + `طلباتي`.

- `openDueNightRotateCycles` عند تحميل الحضور يفتح طلب موافقة عند الاستحقاق.
- بعد 3 أشهر عامل ليلي: المدير لا يرفض عن الموظف. يسند صباحي/مسائي؛ الليل يبقى **نوعًا** على الجدول.
- أسبوع صباحي واحد لا يصفّر العدّ. التدوير لساعات عادية ≥ شهر (~4 أسابيع).
- موافقة خطية على الملف حتى السحب (`nightConsentAt` / `nightConsentWithdrawnAt`). لا تجديد شهري واجب.
- XOR عامل ليلي: بدل مناسب أو تقليص ساعات (مع استثناء العرضي).
- أعلام المنشأة: إسعاف / نقل / طعام — `NIGHT_FACILITY_FLAGS`.
- الحمل: حظر 24 أسبوعًا قبل الوضع على العمل الليلي.

---

## 10. ماذا يُغذَّى من الجدول؟

| هدف | كيف |
|---|---|
| بصمتي / كشفي | بداية/نهاية منشورة، تأخير، خروج مبكر |
| `/app/calendar` | `operationalCalendar` + إجازة معتمدة كطبقة |
| طلباتي | إجازة تقفل الخلية؛ `shift_change`؛ `night_consent` |
| قسيمتي | ساعات عادية من الوردية+الحضور المعتمد؛ إضافي م107 مشتق |
| أداء | طول الفترة = مجموع ورديات منشورة (`perfRange` يتخطى يومًا بلا `hasPublishedScheduleOn`). الحضور **لا** يدخل الدرجة |
| مهام | البوابة: هل هو في الموقع الآن (`isActiveAttendance`) فوق حلقة الحضور |
| ملف الموظف | فرع العمل، لياقة ليلية؛ يشير إلى الجدول ولا يعيد شبكة الأسبوع |

سياسة المواقع وإعلان م17: `AttendanceSettingsBoard` / `checkWorkPostingGate` — تنبيه إعلان مواعيد العمل، مستقل عن زر نشر الأسبوع.

---

## 11. قواعد عند كتابة كود

1. الساعة = `shift.start/end` لذلك الشخص في ذلك الفرع وذلك اليوم المنشور. لا ساعة شركة.
2. لا تدمج الورديات لأن `hours` تساوت.
3. كل مانع يُسمّى. لا إسناد ليلي صامت غير قانوني (`resolveNightRestAssignTarget`).
4. لا غياب على إجازة معتمدة ولا على نقص تغطية.
5. جدول واحد `stationId`. لا merge assignments عبر الفروع.
6. أرقام الشاشة من السجلات. الإضافي `ATTENDANCE_FACTS.attendance.overtimeHours` غير مخزّن كمصدر.
7. فحوص 18632/48س أساسها الجدول وطلباتي، لا تكرار لوحات في الملف.
8. رمضان: `laborCalendar` + دين الملف؛ الفراغ = مسلم.
9. التواريخ التشغيلية: `toRiyadhDateKey()` لا منطقة المتصفح إن وُجد فرق.

---

## 12. اختبارات يدوية سريعة

1. `07:00–15:00` → صباحي؛ التأخير بعد 07:00.  
2. نفس الموظف `15:00–23:00` → التأخير بعد 15:00.  
3. أسبوع `draft` → واجهة «بلا جدول» / `NOT_SCHEDULED` حسب السطح.  
4. >48س → `publishWeek` يفشل `PUBLISH_BLOCKED`.  
5. إجازة معتمدة → `ON_LEAVE` على الخلية.  
6. ليلية ثم صباحية في اليوم التالي بلا 12س → قفزة أو رفض مسمّى.  
7. نسخ الشهر → الأسابيع تبقى غير منشورة إن لم تُنشر؛ عدّاد الليل لا يُصفَّر.  
8. موظف بلا `stationId` على `lane=mine` → لا شبكة.

---

## 13. دوال ابدأ منها

| دالة | ملف |
|---|---|
| `employeeShiftOnDay` | `shiftWeek.js` |
| `weekPublishState` / `isWeekDayPublished` | `shiftWeek.js` |
| `checkShiftChangeApplyGate` | `shiftWeek.js` |
| `checkWeekPublishGates` | `shiftWeek.js` |
| `setEmployeeDayShift` / `publishWeek` | `store.js` |
| `getTodaysShift` / `lateMinutesFromScheduledStart` | `attendanceDerivations.js` |
| `performsNightWork` / `isNightWorker` | `decision18632.js` |
| `ordinaryDayCap` | `laborHoursPolicy.js` |
| `readSchedules` | `facts/attendance.js` |
