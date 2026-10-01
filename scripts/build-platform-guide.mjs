/**
 * Full Arabic RTL platform guide — section-by-section with ministry law + product flexibility.
 * Usage: node scripts/build-platform-guide.mjs
 * Then Chrome --print-to-pdf on the HTML path printed to stdout.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PLATFORM_FACTS, DOMAIN_MODULES } from "../src/lib/facts/catalog.js";
import {
  LABOR_RULES,
  HRSD_CATALOGUE_URL,
  HRSD_IMPLEMENTING_REGS_URL,
  BOE_LABOUR_LAW_URL,
} from "../src/lib/laborRules.js";

const desktop = path.join(process.env.USERPROFILE || process.env.HOME || ".", "Desktop");
const htmlPath = path.join(desktop, "NiroVera-platform-full-guide.html");
const pdfPath = path.join(desktop, "NiroVera-platform-full-guide.pdf");

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const chip = (t, cls = "g") => `<span class="chip ${cls}">${esc(t)}</span>`;

function factsTable(domainKey, title) {
  const facts = DOMAIN_MODULES[domainKey] || [];
  if (!facts.length) return "";
  const rows = facts
    .map(
      (f) =>
        `<tr><td dir="ltr">${esc(f.id)}</td><td>${esc(f.surfaceAr || "—")}</td><td dir="ltr">${esc(f.home || f.path || "")}</td><td dir="ltr">${esc(f.writer || "")}</td><td>${f.stored === false ? "مشتق" : "مخزّن"}</td><td>${esc(f.noteAr || "")}</td></tr>`,
    )
    .join("");
  return `<h3>${esc(title)} — جدول الحقائق في الكود</h3><table><thead><tr><th>المعرّف</th><th>السطح</th><th>المنزل</th><th>الكاتب</th><th>النوع</th><th>ملاحظة</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function laborByPrefix(prefixes, title) {
  const rows = LABOR_RULES.filter((r) => prefixes.some((p) => String(r.id).startsWith(p)));
  if (!rows.length) return "";
  const body = rows
    .map((r) => {
      let art;
      if (r.article) art = chip(`مادة ${r.article}`, "g");
      else if (r.source === "ministerial") art = chip("قرار/لائحة", "");
      else if (r.source === "wps") art = chip("WPS", "");
      else art = chip("منتج", "r");
      return `<tr><td dir="ltr">${esc(r.id)}</td><td>${art}</td><td>${esc(r.value)} ${esc(r.unit || "")}</td><td>${esc(r.hintAr || "")}</td></tr>`;
    })
    .join("");
  return `<h3>${esc(title)}</h3><table><thead><tr><th>المفتاح</th><th>السند</th><th>القيمة</th><th>النص التشغيلي</th></tr></thead><tbody>${body}</tbody></table>`;
}

const flex = (items) =>
  `<div class="box"><strong>مرونة المنصة</strong><ul>${items.map((x) => `<li>${x}</li>`).join("")}</ul></div>`;

const sections = [
  {
    title: "0) كيف تُقرأ هذه الوثيقة",
    html: `
<p>دليل تشغيل كامل للمنصة نيروفيرا/باور كير بنفس أسلوب التفصيل: مسار · منزل بيانات · من يرفع/يقرر · سند وزاري · <strong>مرونة المنصة</strong> · علاقة بالأقسام الأخرى.</p>
<ul>
<li>دورة الإثبات: حضور → مهمة → مراجعة → تصعيد → توقيع/ختم → إثبات عميل.</li>
<li>عزل الشركات بـ companyId. الفراغ «—». الأرقام مشتقة.</li>
<li>يفصل: مادة نظام · قرار وزاري · لائحة · قاعدة منتج داخلية.</li>
<li>لوحة المالك /owner خارج الشريط وللمالك فقط.</li>
</ul>
<p class="note">${PLATFORM_FACTS.length} حقيقة مفهرسة · ${LABOR_RULES.length} قاعدة laborRules · تاريخ التوليد ${new Date().toISOString().slice(0, 10)}</p>`,
  },
  {
    title: "1) القشرة — موقع عام، جناح، ملفي / إدارة، نطاق الفرع",
    html: `
<table><thead><tr><th>المسار</th><th>المعنى</th></tr></thead><tbody>
<tr><td dir="ltr">/</td><td>موقع عام: دورة الإثبات، أقسام، تسعير، امتثال، دخول حقيقي (لا حسابات تجريبية).</td></tr>
<tr><td dir="ltr">/app</td><td>منصة الشركة.</td></tr>
<tr><td dir="ltr">/owner</td><td>لوحة المالك — شركات وخطط. ليست على شريط الجناح.</td></tr>
<tr><td dir="ltr">/verify</td><td>تحقق عام من مستند موقّع.</td></tr>
</tbody></table>
<p>كل قسم تقريباً له <strong>ملفي/موظف</strong> و<strong>إدارة</strong>. من مساحة الموظف: الرواتب→قسيمتي، مصروفات→مطالباتي، أصول→عهدتي، مخزون→رصيد/طلب. نطاق الشريط: فرع واحد؛ الموقع التابع يُطوى تحت الفرع.</p>
${flex([
  "التبديل بين ملفي وإدارة لا يخلط شارات الانتظار الإدارية على سطح الموظف.",
  "deep-links القديمة (إجازة الحضور، أرشيف الطلبات) تُحوَّل للمسار القانوني دون كسر الإشارة المرجعية.",
])}`,
  },
  {
    title: "2) الشركة وامتثال المنشأة",
    html: `
<p>هوية المنشأة، المدير، رقم منشأة التأمينات، إعدادات الامتثال الوزاري.</p>
<ul>
<li>رقم المنشأة على الشركة (امتثال الوزارة) — ليس رقم المشترك على الموظف.</li>
<li>الخطة من لوحة المالك.</li>
</ul>
${factsTable("company", "الشركة")}
${flex(["تصحيح ترحيلي إن كُتب رقم المنشأة خطأ على ملف الموظف — يُرفع للشركة ويُفرَّغ من المشترك."])}`,
  },
  {
    title: "3) ملف الموظف — عقد، أجر، تأمينات",
    html: `
<p>التبويبات: ملخص · هوية · عقد وأجر · إجازات · التزام ومنصات · جزاءات · وثائق · سجل.</p>
<table><thead><tr><th>الحقل</th><th>المعنى</th><th>ملاحظة دقيقة</th></tr></thead><tbody>
<tr><td>الأساسي + بدل سكن/نقل/أخرى</td><td>عقد</td><td>على بطاقة الأجر؛ يغذّي المسير</td></tr>
<tr><td>تاريخ التسجيل في التأمينات</td><td>تصنيف قديم/جديد</td><td>ليس تاريخ التعيين · يظهر على العقد والأجر</td></tr>
<tr><td>رقم المشترك</td><td>هوية التأمينات للشخص</td><td>≠ رقم المنشأة</td></tr>
<tr><td>الجنسية / الهوية</td><td>بوابة الحسم</td><td>سعودي مؤكد فقط يُحسم؛ المجهول = 0</td></tr>
</tbody></table>
<p><strong>تأمينات:</strong> قديم (قبل 2024-07-03 أو تاريخ فارغ+سعودي) 9.75٪. جديد من ذلك التاريخ جدول تدريجي (سبتمبر 2026 غالباً 10.75٪). الأجر الخاضع = أساسي+بدلات بسقف 45,000 — بلا إضافي.</p>
${factsTable("people", "الناس")}
${laborByPrefix(["payroll.", "contract."], "أجر وعقد من laborRules")}
${flex([
  "لا تُخترع نسبة 25٪ سكن إن لم يُكتب البدل.",
  "تاريخ تسجيل فارغ لا يُعامل كمشترك جديد.",
  "النسبة نظامية من الجدول — لا تُدخلها الشركة يدوياً ولا لوحة المالك.",
])}`,
  },
  {
    title: "4) المنظمة — محطات، مقاعد، نطاق",
    html: `
<p>/app/org · /app/hr. شجرة، محطات GPS للحضور، مقاعد، صلاحيات smartPositions.</p>
${factsTable("org", "المنظمة")}
${flex([
  "نطاق الشريط فلتر واجهة فقط — ليس صفاً في قاعدة البيانات.",
  "الدرجات والمقاعد تحت المدير؛ لا رواتب عيّنة عند التعيين.",
])}`,
  },
  {
    title: "5) الحضور والدوام والتقويم",
    html: `
<p>الخطوة 1 من دورة الإثبات.</p>
<table><thead><tr><th>السطح</th><th>المسار</th><th>المنزل</th></tr></thead><tbody>
<tr><td>بصمتي / كشفي / قرار المدير</td><td dir="ltr">/app/attendance</td><td>personalAttendance</td></tr>
<tr><td>الورديات</td><td dir="ltr">/app/shifts</td><td>schedules</td></tr>
<tr><td>التقويم</td><td dir="ltr">/app/calendar</td><td>عرض مشتق</td></tr>
</tbody></table>
<p>بوابات النشر: م98–106 · قرار 18632 ليل · قرار 3337 حرارة · م17 إعلان الجدول. الإضافي المعتمد → قسيمتي (م107). سماح تأخر 10 دقائق وتسوية 45 يوماً = منتج داخلي.</p>
${factsTable("attendance", "الحضور")}
${laborByPrefix(["hours."], "ساعات وليل وحرارة وإضافي")}
${flex([
  "بصمة ممكنة بلا وردية منشورة؛ سلسلة الثقة تُظهر «غير مجدوَل».",
  "الليل والحرارة عند نشر الدوام لا عند لحظة البصمة وحدها.",
  "الإجازات حُوّلت إلى طلباتي — الحضور يشير للرد هناك.",
])}`,
  },
  {
    title: "6) الرواتب — قسيمتي وخصوماتي ومسير",
    html: `
<p>موظف: قسيمتي + خصوماتي مباشرة. إدارة: مسير · تأمينات · WPS · نهاية خدمة.</p>
<p>الصافي = أساسي + بدلات + مكافأة + إضافي − خصومات بسند − تأمينات. م90 · م92 · م93 (التأمينات خارج توسيع السقف) · WPS 30 يوماً.</p>
${factsTable("payroll", "الرواتب")}
${laborByPrefix(["payroll."], "أجور وحماية")}
${flex([
  "بنود القسيمة تظهر عند وجود قيم مشتقة؛ لا تُنسخ أرقام عيّنة التصميم.",
  "اعتراض الخصم يجمّد البند؛ التأمينات غير قابلة للاعتراض.",
  "المسير يقرأ الحضور ولا يُحرَّر منه اليوم.",
])}`,
  },
  {
    title: "7) طلباتي — الهيكل العام",
    html: `
<p>المسار <span dir="ltr">/app/requests</span> · إدارة <span dir="ltr">/app/requests/manage</span>. التخزين على <span dir="ltr">employees[].leaveRequests</span> و <span dir="ltr">otherRequests</span>.</p>
<table><thead><tr><th></th><th>ملفي</th><th>إدارة</th></tr></thead><tbody>
<tr><td>يرفع</td><td>إجازة، دراسة، لياقة ليلية، رفع رصيد، بصمة، وثيقة، سلفة، عهدة…</td><td>تكليف إضافي · إضافة رصيد · طلب آخر فقط</td></tr>
<tr><td>يقرر</td><td>—</td><td>اعتمد / ارفض بسبب مكتوب</td></tr>
<tr><td>نطاق</td><td>نفسه</td><td>فريق الصندوق + فرع الشريط</td></tr>
</tbody></table>
<p>معلّق أكثر من 48 ساعة = متأخر/تصعيد. الأرشيف فلتر داخل الصفحة.</p>
${factsTable("requests", "الطلبات")}
${flex([
  "إدارة لا تدّعي نفس أنواع ملفي.",
  "اللياقة الليلية يرفعها الموظف فقط.",
  "الأثر في الملف والدوام والتقويم والحضور والمسير حسب النوع.",
])}`,
  },
  {
    title: "7أ) طلباتي — أنواع الإجازات",
    html: `
<table><thead><tr><th>النوع</th><th>السند</th><th>تفاصيل</th></tr></thead><tbody>
<tr><td>سنوية</td><td>م109</td><td>21 ثم 30 بعد 5 سنوات</td></tr>
<tr><td>رصيد تقديري</td><td>منتج</td><td>فوق النظام · سقف تقديري سنوي</td></tr>
<tr><td>مرضية</td><td>م117</td><td>30 كامل · 60 ب¾ · 30 بلا أجر · مرفق</td></tr>
<tr><td>امتحان</td><td>م115</td><td>انظر الفصل 7ب بالكامل</td></tr>
<tr><td>زواج / وفاة / أبوة</td><td>م113</td><td>حسب الجنس والواقعة</td></tr>
<tr><td>أمومة / تمديد / مرافقة</td><td>م151</td><td>إناث</td></tr>
<tr><td>عدّة</td><td>م160</td><td>مسلمة/غير مسلمة</td></tr>
<tr><td>حج</td><td>م114</td><td>10–15 · مسلمان · بعد سنتين</td></tr>
<tr><td>وطني/تأسيس/عيد</td><td>م112+لائحة24</td><td>الوطني والتأسيس مقفلان بلا طلب</td></tr>
<tr><td>بلا راتب</td><td>م116</td><td>وقف العقد بعد 20 يوماً ما لم يُتفق</td></tr>
<tr><td>اضطرارية</td><td>منتج</td><td>ليست مادة مستقلة</td></tr>
</tbody></table>
${laborByPrefix(["leave."], "قواعد الإجازات كاملة")}`,
  },
  {
    title: "7ب) طلباتي — إجازة الامتحان والموافقة الدراسية (تفصيل كامل)",
    html: `
<p>السند ${chip("مادة 115", "g")}. المنصة لا تعطي المنشأة رفض إجازة امتحان استوفت النص؛ ما يتغيّر هو <strong>مسار الأجر</strong> فقط.</p>
<h3>مساران للأجر — مرونة جوهرية</h3>
<table><thead><tr><th>المسار</th><th>الشرط</th><th>الأجر</th></tr></thead><tbody>
<tr><td><strong>مدفوع</strong></td><td>موافقة دراسية معتمدة على الملف</td><td>أيام الامتحان الفعلية بأجر (سنة غير معادة)</td></tr>
<tr><td><strong>سنوية أو بلا أجر</strong></td><td>لا موافقة أو رُفضت</td><td>من الرصيد السنوي أو بدون أجر</td></tr>
</tbody></table>
<p>رفض الموافقة الدراسية لا يوقف الدراسة ولا يمنع طلب إجازة الامتحان. بعد اعتماد الموافقة الدراسية: ${chip("الشركة لا ترجع عنها", "r")}.</p>
<h3>نوع الجلوس</h3>
<ul>
<li><strong>امتحان أول</strong> — مع موافقة: بأجر · بدونها: سنوية/بلا أجر.</li>
<li><strong>امتحان معاد</strong> — بغير أجر دائماً.</li>
</ul>
<h3>مهلة 15 يوماً ومرونة الجدول المتأخر</h3>
<p>الأصل: الطلب قبل الإجازة بـ 15 يوماً. إن تأخر جدول المواعيد:</p>
<ol>
<li>إرفاق ورقة المواعيد</li>
<li>تسجيل <strong>تاريخ صدور الورقة</strong></li>
<li>التقديم في يوم الورقة أو اليوم التالي</li>
</ol>
<p>ما لا يوجد في النموذج: موافقة جهة تعليمية، ولا رفض مؤسسة — فقط ورقة المواعيد وتاريخها.</p>
<h3>ورقتان على نفس البطاقة</h3>
<table><thead><tr><th>الورقة</th><th>متى</th><th>الغرض</th></tr></thead><tbody>
<tr><td>جدول/مواعيد</td><td>عند الرفع أو مع الإشعار المتأخر</td><td>مستند مؤيّد — بلا توقيع رقمي إلزامي</td></tr>
<tr><td>إثبات الأداء</td><td>بعد بدء أيام الامتحان على نفس الطلب</td><td>استقرار الإجازة؛ بدونه لا تستقر</td></tr>
</tbody></table>
<p>البطاقة تبقى حيّة في ملفي وإدارة حتى ورقة الأداء.</p>
<h3>قرار الإدارة</h3>
<ul>
<li>لا يُرفض طلب امتحان استوفى المادة 115 (بوابة تمنع الرفض).</li>
<li>موافقة الانتساب تغيّر مسار الأجر فقط.</li>
<li>القرار في طلباتي — لا في طابور الحضور.</li>
</ul>
<div class="flow">[اختياري] موافقة دراسية → اعتماد → مسار مدفوع لا يُسحب
    ↓
إجازة امتحان: أول/معاد · أيام فعلية · مرفق مواعيد
    ↓
إن تأخر الجدول: تاريخ صدور الورقة + تقديم يومها/غدها
    ↓
اعتماد (لا رفض للمستوفي) · مسار أجر حسب الموافقة
    ↓
بعد بدء الأيام: إثبات أداء على البطاقة → استقرار</div>
${flex([
  "مرونة المسار المدفوع عبر موافقة دراسية منفصلة من ملفي.",
  "مرونة المهلة عند تأخر ورقة المواعيد.",
  "مرونة إثبات الأداء لاحقاً على نفس البطاقة.",
  "حفظ حق أيام الامتحان حتى بلا موافقة دراسة — يتغيّر الأجر فقط.",
])}`,
  },
  {
    title: "7ج) طلباتي — موافقة ليلية ولياقة وتكليف وسلفة",
    html: `
<table><thead><tr><th>النوع</th><th>السند</th><th>التفصيل</th></tr></thead><tbody>
<tr><td>موافقة عمل ليلي</td><td>قرار 18632</td><td>موافقة خطية + حق التراجع من طلباتي. «أوافق» بعد الملف الموقّع والإقرار.</td></tr>
<tr><td>لياقة ليلية</td><td>18632</td><td>يرفعها الموظف فقط. غير لائق يمنع نشر إسناد ليلي.</td></tr>
<tr><td>تكليف إضافي</td><td>م107 / م106</td><td>من إدارة فقط كفعل منشأة.</td></tr>
<tr><td>ساعات إضافية (طلب موظف)</td><td>م107</td><td>قرار → ساعات/مسير أو إجازة تعويضية بموافقة.</td></tr>
<tr><td>سلفة</td><td>م92 · م93</td><td>≤10٪ للاسترداد؛ ضمن نصف الأجر للخصومات بسند.</td></tr>
<tr><td>بصمة يدوية / تصحيح انصراف</td><td>تشغيلي</td><td>يظهر في طابور الحضور؛ الرد في طلباتي.</td></tr>
<tr><td>عهدة / وثائق / استئذان</td><td>—</td><td>ربط بأصول أو أرشيف.</td></tr>
<tr><td>رفع رصيد / إضافة رصيد</td><td>منتج+م109</td><td>الأول من ملفي؛ الثاني من إدارة (سنوي أو تقديري).</td></tr>
</tbody></table>
${flex(["الموافقات الخطية تبقى حزمة طلباتي — لا تُفتح كسطح توقيع فارغ بلا سياق."])}`,
  },
  {
    title: "8) المهام والإثبات والتصعيد وإثبات العميل",
    html: `
<p>خطوات دورة الإثبات 2–4 و6. الحي: tasks · workProofs. كيان WorkProof السحابي متقاعد.</p>
<ul>
<li>مهمة: جهد، بوابة ميدان، دليل، إقرار.</li>
<li>مراجعة: اعتماد/رفض بسبب مكتوب ومسار تدقيق.</li>
<li>تصعيد تلقائي عند نفاد حصة الوقت بلا تقدّم.</li>
<li>إثبات عميل: حقول مسموح بها + بصمة — بلا أسماء موظفين ولا رواتب.</li>
</ul>
${factsTable("proof", "الإثبات")}
${flex(["الحضور يثبت الوجود؛ الإثبات يثبت العمل — لا يستبدل أحدهما الآخر."])}`,
  },
  {
    title: "9) التوقيع الآمن والتحقق",
    html: `
<p>الخطوة 5. /app/signing · /verify. signatureRequests · SignedDocument · files.</p>
${factsTable("signing", "التوقيع")}
${flex(["يُستخدم لليل 18632 والعقود والموافقات؛ التحقق العام لا يكشف رواتب."])}`,
  },
  {
    title: "10) المصروفات والعهدة والمخزون",
    html: `
<ul>
<li>مصروفات: مطالباتي / ميزانية (المتبقي مشتق).</li>
<li>أصول: عهدتي، نقل، holderId.</li>
<li>مخزون: كمية فقط في locationBalances — InventoryUnit متقاعد.</li>
</ul>
${factsTable("money", "المال التشغيلي")}
${flex(["من مساحة الموظف تُفتح الأسطح الذاتية مباشرة بلا شارة انتظار الإدارة."])}`,
  },
  {
    title: "11) الانضباط والتحكيم",
    html: `
<p>disciplinaryCases. الخصم على المسير من الحكم. مواد 66–72. اعتراض يخصم يجمّد البند (م72). التأمينات غير قابلة للاعتراض.</p>
${factsTable("discipline", "الانضباط")}
${laborByPrefix(["discipline.", "eos."], "جزاء ونهاية خدمة")}`,
  },
  {
    title: "12) الصوت والشكاوى",
    html: `
<p>بلاغ مجهول + إيصال خاص. شكاوى عامة. سلاسل تصعيد وSLA فرع. لا اسم مرسل على البلاغ المجهول.</p>
${factsTable("voice", "الصوت")}`,
  },
  {
    title: "13) الأداء",
    html: `
<p>أدائي / إدارة الأداء: نقاط، HCM، أهداف.</p>
${factsTable("performance", "الأداء")}`,
  },
  {
    title: "14) السلامة وHSE",
    html: `
<p>سجلات محطة، أرصدة، ربط 3337 مع الدوام الميداني.</p>
${factsTable("safety", "السلامة")}
${laborByPrefix(["hours.heat"], "حرارة")}`,
  },
  {
    title: "15) التنبيهات",
    html: `
<p>notifications بـ userId. كثير من التنبيهات تشير «الرد في طلباتي».</p>
${factsTable("notifications", "التنبيهات")}`,
  },
  {
    title: "16) لوحة المالك والمساعد",
    html: `
<p>/owner: شركات، خطط، مدفوعات. لا جدول نسب تأمينات قابل للتحرير. المساعد ضمن الصلاحيات.</p>
${factsTable("owner", "المالك")}`,
  },
  {
    title: "17) خريطة تدفق المنصة",
    html: `
<div class="flow">/ → دخول → /app
منظمة → stationId
دوام schedules → وردية
حضور + otDecisions → مسير → قسيمتي
أجر الملف + GOSI → بنود القسيمة
طلباتي → ملف · تقويم · دوام · حضور · مسير
مهام → مراجعة → تصعيد → إثبات → توقيع → إثبات عميل
انضباط → خصم بسند (م93)
صوت → تصعيد SLA
سلامة ↔ 3337 على الدوام
مصروف/عهدة/مخزون مستقل عن البصمة</div>`,
  },
  {
    title: "18) مرجع السطح × السند",
    html: `
<table><thead><tr><th>السطح</th><th>السند الأساسي</th></tr></thead><tbody>
<tr><td>وردية عادية</td><td>98–104 · 17</td></tr>
<tr><td>ليل</td><td>قرار 18632</td></tr>
<tr><td>ميدان صيفاً</td><td>3337 · 122 · 243</td></tr>
<tr><td>إضافي</td><td>107 · لائحة 22/22 مكرر · 106</td></tr>
<tr><td>قسيمة</td><td>90 · 92 · 93 · WPS · تأمينات</td></tr>
<tr><td>إجازات</td><td>109–118 · 112+لائحة24 · 151 · 160</td></tr>
<tr><td>امتحان</td><td>115 (مساران + مهلة مرنة + ورقتان)</td></tr>
<tr><td>جزاء</td><td>66–72</td></tr>
<tr><td>نهاية خدمة</td><td>84 · 85 · 80 · 81</td></tr>
</tbody></table>`,
  },
  {
    title: "19) مصادر الوزارة",
    html: `
<ul>
<li>نظام العمل: <span dir="ltr">${esc(BOE_LABOUR_LAW_URL || "")}</span></li>
<li>كتالوج الوزارة: <span dir="ltr">${esc(HRSD_CATALOGUE_URL || "")}</span></li>
<li>اللائحة التنفيذية: <span dir="ltr">${esc(HRSD_IMPLEMENTING_REGS_URL || "")}</span></li>
</ul>
<p class="note">ليست استشارة قانونية خارج النصوص المخزّنة في المنصة.</p>`,
  },
  {
    title: "20) ملحق — كل قواعد laborRules",
    html: laborByPrefix(
      Array.from(new Set(LABOR_RULES.map((r) => `${String(r.id).split(".")[0]}.`))),
      "الملحق الكامل",
    ),
  },
];

const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<title>دليل المنصة الكامل — نيروفيرا</title>
<style>
@page { size: A4; margin: 13mm 11mm; }
body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; color: #14231C; line-height: 1.6; font-size: 11.2px; margin: 0; }
h1 { font-size: 20px; color: #0B3D27; margin: 0 0 6px; }
h2 { font-size: 13.5px; margin: 16px 0 8px; padding: 7px 10px; background: #0B3D27; color: #fff; border-radius: 6px; page-break-before: always; page-break-after: avoid; }
h2.first { page-break-before: auto; }
h3 { font-size: 12px; margin: 11px 0 5px; color: #2F6B43; border-bottom: 1px solid #C8D5CC; padding-bottom: 3px; page-break-after: avoid; }
p { margin: 0 0 7px; }
.meta { color: #5A6B62; font-size: 10.5px; margin-bottom: 12px; }
.chip { display: inline-block; background: #FBF3E1; color: #8A5A12; border: 1px solid #E5D4A8; border-radius: 4px; padding: 0 6px; font-size: 10px; margin-left: 3px; }
.chip.g { background: #E8F3EC; color: #2F6B43; border-color: #B7D4C0; }
.chip.r { background: #F8E8EA; color: #9B2335; border-color: #E5B8BF; }
table { width: 100%; border-collapse: collapse; margin: 6px 0 11px; font-size: 10.2px; }
th, td { border: 1px solid #C8D5CC; padding: 5px 6px; vertical-align: top; text-align: right; }
th { background: #F4F7F5; color: #0B3D27; }
ul, ol { margin: 4px 0 8px; padding-right: 16px; }
li { margin-bottom: 3px; }
.box { border: 1px solid #C8D5CC; border-radius: 8px; padding: 8px 10px; margin: 6px 0 10px; background: #FAFCFA; page-break-inside: avoid; }
.flow { font-family: Consolas, monospace; white-space: pre-wrap; background: #101814; color: #E7F0EA; border-radius: 8px; padding: 10px; font-size: 10px; direction: ltr; text-align: left; }
.note { font-size: 10.5px; color: #5A6B62; }
footer { margin-top: 16px; padding-top: 8px; border-top: 1px solid #C8D5CC; font-size: 10px; color: #5A6B62; }
</style>
</head>
<body>
<h1>دليل المنصة الكامل — نيروفيرا / باور كير</h1>
<p class="meta">تفصيل قسماً قسماً مع المرونة والسند الوزاري · ${PLATFORM_FACTS.length} حقيقة · ${LABOR_RULES.length} قاعدة</p>
<div class="box"><strong>الفهرس</strong><ol>${sections.map((s) => `<li>${esc(s.title)}</li>`).join("")}</ol></div>
${sections.map((s, i) => `<h2 class="${i === 0 ? "first" : ""}">${esc(s.title)}</h2>${s.html}`).join("\n")}
<footer>مولَّد من مستودع NiroVera. ليست استشارة قانونية خارج النصوص المخزّنة. الفراغ «—» · الأرقام مشتقة · عزل الشركات · المالك خارج الشريط.</footer>
</body>
</html>`;

fs.writeFileSync(htmlPath, html, "utf8");
console.log(JSON.stringify({ htmlPath, pdfPath, htmlBytes: fs.statSync(htmlPath).size, sections: sections.length, facts: PLATFORM_FACTS.length, rules: LABOR_RULES.length }));
