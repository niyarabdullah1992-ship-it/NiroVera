import React, { useMemo, useState } from "react";
import { updateCompany } from "@/lib/store";
import { hoursPolicyOf } from "@/lib/laborHoursPolicy.js";
import { checkNurseryThreshold } from "@/lib/laborProtectionGates.js";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import PolicyDeviationAlert from "@/components/shared/PolicyDeviationAlert";
import { BORDER, CARD, MUTED, NAVY, field } from "@/lib/platformStyles";

const row = { padding: "15px 20px", borderBottom: "1px solid var(--nv-line)", display: "flex", flexDirection: "column", gap: 8 };

function Flag({ label, note, on, disabled, onToggle }) {
  return (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 12, color: NAVY, cursor: disabled ? "default" : "pointer" }}>
      <input type="checkbox" checked={on} disabled={disabled} onChange={(e) => onToggle(e.target.checked)} style={{ marginTop: 3 }} />
      <span>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ display: "block", fontSize: 11, color: MUTED, lineHeight: 1.7, marginTop: 2 }}>{note}</span>
      </span>
    </label>
  );
}

/** Arts 17 / 99 / 100 / 103 / 105 — off by default; خفجي stays on 98. */
const WEEKDAYS = (ar) => (ar
  ? ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
  : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);

export default function HoursLawSettings({ company, employees = [], canEdit, ar = true, onSaved }) {
  const live = hoursPolicyOf(company);
  const [draft, setDraft] = useState(() => ({
    extendedNine: live.extendedNine,
    hazardousHours: live.hazardousHours,
    rotatingShifts: live.rotatingShifts,
    continuousWork103: live.continuousWork103,
    remoteRestBank105: live.remoteRestBank105,
    art105WorkerConsent: live.art105WorkerConsent,
    art105MinistryConsent: live.art105MinistryConsent,
    art105BankedWeeks: live.art105BankedWeeks || "",
    hoursBasis: live.hoursBasis || "",
    stationBasis: Object.fromEntries((company?.stations || []).map((st) => [String(st.id), st.hoursBasis || ""])),
    art100ApprovalNo: live.art100ApprovalNo || "",
    art100ApprovalDate: live.art100ApprovalDate || "",
    nurseryChildrenCount: live.nurseryChildrenCount || "",
    nurseryOnSite: live.nurseryOnSite === true,
    gosiInjuryWageMode: live.gosiInjuryWageMode === "stop" ? "stop" : "continue",
    gosiOccupationalHazards: live.gosiOccupationalHazards === true || live.gosiOccupationalHazards === "yes" ? "yes" : (live.gosiOccupationalHazards === false || live.gosiOccupationalHazards === "no" ? "no" : ""),
    workPosting: {
      hoursTable: live.workPosting?.hoursTable || "",
      restPeriods: live.workPosting?.restPeriods || "",
      weeklyRest: live.workPosting?.weeklyRest || "",
      weeklyRestDow: Number.isInteger(Number(live.workPosting?.weeklyRestDow)) ? Number(live.workPosting.weeklyRestDow) : 5,
      weeklyRestDayCount: Number(live.workPosting?.weeklyRestDayCount) === 1 ? 1 : 2,
      // Second rest day chosen by management (any weekday) — -1 = none (six-day week).
      secondRestDow: (() => {
        const listed = Array.isArray(live.workPosting?.weeklyOffDows) ? live.workPosting.weeklyOffDows.map(Number) : [];
        if (listed.length >= 2) return listed[1];
        if (listed.length === 1 || Number(live.workPosting?.weeklyRestDayCount) === 1) return -1;
        const first = Number.isInteger(Number(live.workPosting?.weeklyRestDow)) ? Number(live.workPosting.weeklyRestDow) : 5;
        return (first + 1) % 7;
      })(),
      fridaySwapNotifiedAt: live.workPosting?.fridaySwapNotifiedAt || "",
      religiousDutiesEnabled: live.workPosting?.religiousDutiesEnabled === true,
      shiftTimes: live.workPosting?.shiftTimes || "",
      posted: live.workPosting?.posted === true,
      postedAt: live.workPosting?.postedAt || "",
    },
  }));

  const nursery = useMemo(
    () => checkNurseryThreshold({ employees, childrenCount: draft.nurseryChildrenCount === "" ? undefined : Number(draft.nurseryChildrenCount), ar }),
    [employees, draft.nurseryChildrenCount, ar],
  );

  const save = () => {
    if (!canEdit || !company?.id) return;
    updateCompany(company.id, (d) => {
      d.hoursPolicy = {
        ...(d.hoursPolicy || {}),
        extendedNine: draft.extendedNine === true,
        hazardousHours: draft.hazardousHours === true,
        rotatingShifts: draft.rotatingShifts === true,
        continuousWork103: draft.continuousWork103 === true,
        remoteRestBank105: draft.remoteRestBank105 === true,
        art105WorkerConsent: draft.art105WorkerConsent === true,
        art105MinistryConsent: draft.art105MinistryConsent === true,
        art105BankedWeeks: Number(draft.art105BankedWeeks) || 0,
        hoursBasis: draft.hoursBasis === "daily" || draft.hoursBasis === "weekly" ? draft.hoursBasis : "",
        art100ApprovalNo: String(draft.art100ApprovalNo || "").trim(),
        art100ApprovalDate: String(draft.art100ApprovalDate || "").slice(0, 10),
        nurseryChildrenCount: Number(draft.nurseryChildrenCount) || 0,
        nurseryOnSite: draft.nurseryOnSite === true,
        gosiOccupationalHazards: draft.gosiOccupationalHazards || "",
        gosiInjuryWageMode: draft.gosiInjuryWageMode === "stop" ? "stop" : "continue",
        workPosting: (() => {
          const first = Number(draft.workPosting.weeklyRestDow);
          const second = Number(draft.workPosting.secondRestDow);
          const offDows = second >= 0 && second !== first ? [first, second] : [first];
          const { secondRestDow: _drop, ...rest } = draft.workPosting;
          return {
            ...rest,
            weeklyRestDow: first,
            weeklyOffDows: offDows,
            weeklyRestDayCount: offDows.length,
            fridaySwapNotifiedAt: offDows.includes(5) ? "" : String(draft.workPosting.fridaySwapNotifiedAt || ""),
            religiousDutiesEnabled: offDows.includes(5) ? false : draft.workPosting.religiousDutiesEnabled === true,
            posted: draft.workPosting.posted === true,
            postedAt: draft.workPosting.postedAt || "",
          };
        })(),
      };
    });
    // Art. 98 basis per site (the employee file may still differ).
    updateCompany(company.id, (d) => {
      for (const st of d.stations || []) {
        const basis = draft.stationBasis?.[String(st.id)];
        if (basis === "daily" || basis === "weekly") st.hoursBasis = basis;
        else delete st.hoursBasis;
      }
    });
    onSaved?.();
  };

  return (
    <section className="nv-paper" style={{ background: CARD, border: `1px solid ${BORDER}`, display: "flex", flexDirection: "column" }} dir={ar ? "rtl" : "ltr"}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{ar ? "ساعات العمل والراحة — نظام العمل" : "Hours of work and rest — Labour Law"}</span>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: MUTED, lineHeight: 1.75 }}>
          {ar
            ? "الساعات وفق المادة 98: ثماني ساعات يومياً و48 ساعة أسبوعياً، ويوم راحة أسبوعي بأجر كامل (المادة 104)."
            : "Hours follow Article 98: eight a day and 48 a week, with a paid weekly rest day (Article 104)."}
        </p>
      </div>
      <div style={row}>
        <span data-rest-on-file="1" style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.7 }}>
          {ar
            ? "راحة المنشأة الافتراضية — يوم أو يومان في الأسبوع. يتبعها كل موظف ما لم يحدد الموارد البشرية راحة مختلفة في ملفه (تبويب «الدوام وأنظمة الوزارة»). الإجازة السنوية لا تُخصم من أيام الراحة."
            : "The establishment's default rest — one or two days a week. Every worker follows it unless HR sets a different rest on the file. Annual leave is never taken from rest days."}
        </span>
        {(() => {
          // The file wins over this default — say how many files do.
          const own = (employees || []).filter((emp) => {
            const p = emp?.profile || {};
            return (Array.isArray(p.weeklyOffDows) && p.weeklyOffDows.length) || Number(p.weeklyRestDayCount) === 1 || Number(p.weeklyRestDayCount) === 2;
          }).length;
          return (
            <span data-rest-file-count={own} style={{ fontSize: 11.5, fontWeight: 600, color: own ? NAVY : MUTED }}>
              {ar
                ? (own ? `ملف الموظف يتقدّم على هذا الافتراضي — ${own === 1 ? "موظف واحد له" : own === 2 ? "موظفان لهما" : `${own} موظفين لهم`} راحة محددة في ملفه.` : "ملف الموظف يتقدّم على هذا الافتراضي — لا أحد له راحة خاصة الآن.")
                : (own ? `The file wins over this default — ${own} with their own rest on file.` : "The file wins over this default — nobody has their own rest now.")}
            </span>
          );
        })()}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
          <label style={{ fontSize: 11, color: MUTED }}>
            {ar ? "الافتراضي — يوم الراحة النظامي (المادة 104)" : "Default — statutory rest day (Art. 104)"}
            <select
              value={draft.workPosting.weeklyRestDow}
              disabled={!canEdit}
              onChange={(e) => {
                const first = Number(e.target.value);
                setDraft((prev) => ({ ...prev, workPosting: { ...prev.workPosting, weeklyRestDow: first, secondRestDow: Number(prev.workPosting.secondRestDow) === first ? -1 : prev.workPosting.secondRestDow } }));
              }}
              style={{ ...field, marginTop: 6 }}
            >
              {WEEKDAYS(ar).map((label, dow) => <option key={dow} value={dow}>{label}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 11, color: MUTED }}>
            {ar ? "الافتراضي — يوم الراحة الثاني (راحة الشركة)" : "Default — second rest day (company rest)"}
            <select
              value={draft.workPosting.secondRestDow}
              disabled={!canEdit}
              onChange={(e) => setDraft((prev) => ({ ...prev, workPosting: { ...prev.workPosting, secondRestDow: Number(e.target.value) } }))}
              style={{ ...field, marginTop: 6 }}
            >
              <option value={-1}>{ar ? "لا يوجد — دوام ستة أيام" : "None — six-day week"}</option>
              {WEEKDAYS(ar).map((label, dow) => (dow === Number(draft.workPosting.weeklyRestDow) ? null : <option key={dow} value={dow}>{label}</option>))}
            </select>
          </label>
        </div>
        {(Number(draft.workPosting.weeklyRestDow) !== 5 && Number(draft.workPosting.secondRestDow) !== 5) || (employees || []).some((person) => Array.isArray(person?.profile?.weeklyOffDows) && person.profile.weeklyOffDows.length && !person.profile.weeklyOffDows.map(Number).includes(5)) ? (
          <div data-friday-swap="1" style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 12px", border: "1px solid var(--nv-warn-line, #EBD3A2)", background: "var(--nv-warn-soft, #FBF3E1)", borderRadius: 8 }}>
            <span style={{ fontSize: 11.5, color: NAVY, lineHeight: 1.75 }}>
              {ar
                ? "الجمعة ليست يوم راحة لبعض الموظفين أو للمنشأة. المادة 104 (1): يجوز استبدالها بيوم آخر بعد إبلاغ مكتب العمل، وعلى صاحب العمل تمكين العمال من أداء واجباتهم الدينية."
                : "Friday is not a rest day. Art. 104(1): it may be replaced after notifying the labour office, and workers must be enabled to perform their religious duties."}
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, alignItems: "end" }}>
              <label style={{ fontSize: 11, color: MUTED }}>
                {ar ? "تاريخ إبلاغ مكتب العمل" : "Labour office notified on"}
                <input
                  type="date"
                  dir="ltr"
                  value={draft.workPosting.fridaySwapNotifiedAt}
                  disabled={!canEdit}
                  onChange={(e) => setDraft((prev) => ({ ...prev, workPosting: { ...prev.workPosting, fridaySwapNotifiedAt: e.target.value } }))}
                  style={{ ...field, marginTop: 6 }}
                />
              </label>
              <Flag
                label={ar ? "تمكين العمال من أداء واجباتهم الدينية" : "Workers enabled to perform their religious duties"}
                note={ar ? "مثل صلاة الجمعة — شرط في المادة 104." : "Such as Friday prayer — a condition of Art. 104."}
                on={draft.workPosting.religiousDutiesEnabled}
                disabled={!canEdit}
                onToggle={(on) => setDraft((prev) => ({ ...prev, workPosting: { ...prev.workPosting, religiousDutiesEnabled: on } }))}
              />
            </div>
          </div>
        ) : null}
      </div>
      <div style={row} data-hours-law="1">
        <span style={{ fontSize: 12.5, fontWeight: 700, color: NAVY }}>{ar ? "معيار الساعات والاستثناءات — المواد 98 و100 و103 و105" : "Hours basis and exceptions — Arts. 98, 100, 103, 105"}</span>
        <label style={{ fontSize: 11, color: MUTED }}>
          {ar ? "معيار الساعات المعتمد (المادة 98) — يسمّي الإضافي ويحدد سقف رمضان؛ للفرع أو للموظف أن يختلف" : "Hours basis on record (Art. 98) — names overtime and the Ramadan cap; a site or file may differ"}
          <select data-hours-basis-company="1" value={draft.hoursBasis} disabled={!canEdit} onChange={(e) => setDraft((prev) => ({ ...prev, hoursBasis: e.target.value }))} style={{ ...field, marginTop: 6 }}>
            <option value="">{ar ? "غير مسجّل — يُقرأ من شكل الوردية" : "Not recorded — read from the shift shape"}</option>
            <option value="daily">{ar ? "يومي — 8 ساعات (6 في رمضان للمسلمين)" : "Daily — 8 h (6 in Ramadan for Muslims)"}</option>
            <option value="weekly">{ar ? "أسبوعي — 48 ساعة (36 في رمضان للمسلمين)" : "Weekly — 48 h (36 in Ramadan for Muslims)"}</option>
          </select>
        </label>
        {(company?.stations || []).length ? (
          <div data-hours-basis-sites="1" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
            {(company?.stations || []).map((st) => (
              <label key={st.id} style={{ fontSize: 11, color: MUTED }}>
                {ar ? `الموقع: ${st.name || st.id}` : `Site: ${st.name || st.id}`}
                <select value={draft.stationBasis?.[String(st.id)] || ""} disabled={!canEdit} onChange={(e) => setDraft((prev) => ({ ...prev, stationBasis: { ...(prev.stationBasis || {}), [String(st.id)]: e.target.value } }))} style={{ ...field, marginTop: 6 }}>
                  <option value="">{ar ? "كالمنشأة" : "As the company"}</option>
                  <option value="daily">{ar ? "يومي — 8 ساعات" : "Daily — 8 h"}</option>
                  <option value="weekly">{ar ? "أسبوعي — 48 ساعة" : "Weekly — 48 h"}</option>
                </select>
              </label>
            ))}
          </div>
        ) : null}
        <Flag
          label={ar ? "العمل بالتناوب بمتوسط ثلاثة أسابيع (المادة 100)" : "Rotation averaged over three weeks (Art. 100)"}
          note={ar ? "بموافقة الوزارة فقط — سجّل رقم الموافقة وتاريخها، وإلا يبقى حد 48 لكل أسبوع." : "Ministry approval only — record its number and date, otherwise the 48 cap stays per week."}
          on={draft.rotatingShifts}
          disabled={!canEdit}
          onToggle={(on) => setDraft((prev) => ({ ...prev, rotatingShifts: on }))}
        />
        {draft.rotatingShifts ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <label style={{ fontSize: 11, color: MUTED }}>
              {ar ? "رقم موافقة الوزارة" : "Ministry approval number"}
              <input data-art100-no="1" dir="ltr" value={draft.art100ApprovalNo} disabled={!canEdit} onChange={(e) => setDraft((prev) => ({ ...prev, art100ApprovalNo: e.target.value }))} style={{ ...field, marginTop: 6 }} />
            </label>
            <label style={{ fontSize: 11, color: MUTED }}>
              {ar ? "تاريخ الموافقة" : "Approval date"}
              <input data-art100-date="1" type="date" dir="ltr" value={draft.art100ApprovalDate} disabled={!canEdit} onChange={(e) => setDraft((prev) => ({ ...prev, art100ApprovalDate: e.target.value }))} style={{ ...field, marginTop: 6 }} />
            </label>
          </div>
        ) : null}
        <Flag
          label={ar ? "عمل مستمر بقرار الوزير (المادة 103)" : "Continuous work by Minister's decision (Art. 103)"}
          note={ar ? "الصلاة والطعام والراحة تنظمها الإدارة أثناء العمل — يُرفع شرط التوقف بعد خمس ساعات في الجدول." : "Prayer, food and rest are organised during work — the five-hour stop is lifted on the roster."}
          on={draft.continuousWork103}
          disabled={!canEdit}
          onToggle={(on) => setDraft((prev) => ({ ...prev, continuousWork103: on }))}
        />
        <Flag
          label={ar ? "تجميع الراحة الأسبوعية في المواقع البعيدة (المادة 105)" : "Banked weekly rest at remote sites (Art. 105)"}
          note={ar ? "حتى ثمانية أسابيع، باتفاق العمال وموافقة الوزارة." : "Up to eight weeks, with the workers' agreement and the Ministry's approval."}
          on={draft.remoteRestBank105}
          disabled={!canEdit}
          onToggle={(on) => setDraft((prev) => ({ ...prev, remoteRestBank105: on }))}
        />
        {draft.remoteRestBank105 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingInlineStart: 22 }}>
            <Flag label={ar ? "اتفاق العمال مسجّل" : "Workers' agreement recorded"} note={ar ? "شرط في المادة 105." : "A condition of Art. 105."} on={draft.art105WorkerConsent} disabled={!canEdit} onToggle={(on) => setDraft((prev) => ({ ...prev, art105WorkerConsent: on }))} />
            <Flag label={ar ? "موافقة الوزارة مسجّلة" : "Ministry approval recorded"} note={ar ? "شرط في المادة 105." : "A condition of Art. 105."} on={draft.art105MinistryConsent} disabled={!canEdit} onToggle={(on) => setDraft((prev) => ({ ...prev, art105MinistryConsent: on }))} />
          </div>
        ) : null}
      </div>
      <div style={row} data-injury-coverage="1">
        <span style={{ fontSize: 12.5, fontWeight: 700, color: NAVY }}>{ar ? "إصابات العمل — المواد 132 إلى 139" : "Work injuries — Arts. 132 to 139"}</span>
        <span style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.75 }}>
          {ar
            ? "إن كانت المنشأة مسجّلة في فرع الأخطار المهنية بالتأمينات فالعلاج والتعويض اليومي من التأمينات (المادة 132). وإن لم تكن: يتحمل صاحب العمل العلاج (133)، وأجراً كاملاً 60 يوماً ثم 75٪ طوال العلاج (137)، وعند سنة علاج عجز كلي: إنهاء العقد وتعويض أجر ثلاث سنوات بحد أدنى 54,000 ريال (138)."
            : "If the establishment is in GOSI's occupational-hazards branch, treatment and the daily compensation come from GOSI (Art. 132). If not: the employer pays treatment (133), the full wage for 60 days then 75% throughout treatment (137), and at one year total disability: the contract ends with three years' wage, at least SAR 54,000 (138)."}
        </span>
        <label style={{ fontSize: 11, color: MUTED }}>
          {ar ? "المنشأة مسجّلة في فرع الأخطار المهنية" : "Covered by GOSI occupational hazards"}
          <select
            data-injury-coverage-select="1"
            value={draft.gosiOccupationalHazards}
            disabled={!canEdit}
            onChange={(e) => setDraft((prev) => ({ ...prev, gosiOccupationalHazards: e.target.value }))}
            style={{ ...field, marginTop: 6 }}
          >
            <option value="">{ar ? "لم يُحدَّد — يُعامل كمسجّل" : "Not set — treated as covered"}</option>
            <option value="yes">{ar ? "نعم — التأمينات تعوّض" : "Yes — GOSI compensates"}</option>
            <option value="no">{ar ? "لا — صاحب العمل يتحمل (المواد 133–138)" : "No — the employer carries it (Arts. 133–138)"}</option>
          </select>
        </label>
        {draft.gosiOccupationalHazards !== "no" ? (
          <label style={{ fontSize: 11, color: MUTED }}>
            {ar ? "مستلم التعويض اليومي — يُختار عند الإبلاغ عن الإصابة في تأميناتي أعمال، ولا يُجمع البدل مع الأجر" : "Wage on injury days — GOSI's daily allowance is never paid with the wage"}
            <select
              data-injury-wage-mode="1"
              value={draft.gosiInjuryWageMode}
              disabled={!canEdit}
              onChange={(e) => setDraft((prev) => ({ ...prev, gosiInjuryWageMode: e.target.value }))}
              style={{ ...field, marginTop: 6 }}
            >
              <option value="continue">{ar ? "صاحب العمل — يواصل دفع الأجر كاملاً وتعوّضه التأمينات" : "The establishment keeps paying the wage"}</option>
              <option value="stop">{ar ? "الموظف — يتوقف الأجر ويصرف له البدل اليومي من التأمينات" : "The wage stops — GOSI pays the daily allowance"}</option>
            </select>
          </label>
        ) : null}
      </div>
      <div style={row}>
        <LaborArticleCite ruleId="facility.nursery.womenMin" ar={ar} showText />
        {nursery.due ? <PolicyDeviationAlert gate={nursery} ruleId="facility.nursery.womenMin" ar={ar} /> : null}
        <label style={{ fontSize: 11, color: MUTED }}>
          {ar ? "عدد أطفال العاملات دون ست سنوات" : "Children of female workers under six"}
          <input
            dir="ltr"
            value={draft.nurseryChildrenCount}
            disabled={!canEdit}
            onChange={(e) => setDraft((prev) => ({ ...prev, nurseryChildrenCount: e.target.value }))}
            style={{ ...field, marginTop: 6 }}
          />
        </label>
        <label data-nursery-onsite="1" style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, lineHeight: 1.7, cursor: canEdit ? "pointer" : "default" }}>
          <input type="checkbox" checked={draft.nurseryOnSite} disabled={!canEdit} onChange={(e) => setDraft((prev) => ({ ...prev, nurseryOnSite: e.target.checked }))} style={{ marginTop: 4 }} />
          <span>{ar
            ? "تتوفر حضانة داخل المنشأة — تختار المرضع فترة أو فترات مجموعها ساعة؛ وبدونها فترة واحدة أول الدوام أو آخره (اللائحة م31/3)."
            : "There is an on-site nursery — a nursing worker may split her hour; without one it is a single period at the start or end (Regs Art. 31(3))."}</span>
        </label>
      </div>
      {canEdit ? (
        <div style={{ padding: "15px 20px" }}>
          <button
            type="button"
            onClick={save}
            style={{ fontFamily: "inherit", fontSize: 13, fontWeight: 600, padding: "11px 18px", border: "none", background: "var(--nv-btn-fill)", color: "#fff", cursor: "pointer" }}
          >
            {ar ? "احفظ إعداد الساعات والراحة" : "Save hours and rest"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
