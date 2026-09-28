import React, { useMemo, useState } from "react";
import { updateCompany } from "@/lib/store";
import { hoursPolicyOf, checkWorkPostingGate } from "@/lib/laborHoursPolicy.js";
import { checkNurseryThreshold } from "@/lib/laborProtectionGates.js";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import PlatformDateField from "@/components/shared/PlatformDateField";
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
    nurseryChildrenCount: live.nurseryChildrenCount || "",
    workPosting: {
      hoursTable: live.workPosting?.hoursTable || "",
      restPeriods: live.workPosting?.restPeriods || "",
      weeklyRest: live.workPosting?.weeklyRest || "",
      shiftTimes: live.workPosting?.shiftTimes || "",
      posted: live.workPosting?.posted === true,
      postedAt: live.workPosting?.postedAt || "",
    },
  }));

  const postingGate = useMemo(() => checkWorkPostingGate({ company: { hoursPolicy: { workPosting: draft.workPosting } } }), [draft.workPosting]);
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
        nurseryChildrenCount: Number(draft.nurseryChildrenCount) || 0,
        workPosting: {
          ...draft.workPosting,
          posted: draft.workPosting.posted === true,
          postedAt: draft.workPosting.postedAt || "",
        },
      };
    });
    onSaved?.();
  };

  return (
    <section className="nv-paper" style={{ background: CARD, border: `1px solid ${BORDER}`, display: "flex", flexDirection: "column" }} dir={ar ? "rtl" : "ltr"}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{ar ? "ساعات العمل والإعلان — نظام العمل" : "Hours of work and posting — Labour Law"}</span>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: MUTED, lineHeight: 1.75 }}>
          {ar
            ? "الافتراضي المادة 98. أعلام 99 و103 و105 مغلقة حتى تُفعَّل هنا. لا قائمة وزارية للأعمال الخطرة."
            : "The default is Article 98. Flags 99, 103 and 105 stay off until switched on here. No ministerial list of hazardous jobs."}
        </p>
      </div>
      <div style={row}>
        <LaborArticleCite ruleId="hours.art99.extendedDayHours" ar={ar} showText />
        <Flag
          label={ar ? "تسع ساعات عادية — المادة 99" : "Nine ordinary hours — Art. 99"}
          note={ar ? "يرفع السقف اليومي المستخدم في نشر الأسبوع. الأسبوع يبقى 48 إلا للحدث." : "Raises the daily cap used at week publish. The week stays 48 except for a juvenile."}
          on={draft.extendedNine}
          disabled={!canEdit}
          onToggle={(on) => setDraft((prev) => ({ ...prev, extendedNine: on }))}
        />
        <Flag
          label={ar ? "أعمال خطرة أو ضارة — سبع ساعات" : "Hazardous or harmful work — seven hours"}
          note={ar ? "علم المنشأة. ليست قائمة الوزير المخزّنة." : "An establishment flag. Not a stored ministerial list."}
          on={draft.hazardousHours}
          disabled={!canEdit}
          onToggle={(on) => setDraft((prev) => ({ ...prev, hazardousHours: on }))}
        />
      </div>
      <div style={row}>
        <LaborArticleCite ruleId="hours.art100.averageWeeks" ar={ar} showText />
        <Flag
          label={ar ? "نظام الورديات — متوسط ثلاثة أسابيع" : "Rotating shifts — three-week average"}
          note={ar ? "عند التشغيل يُفحص متوسط ثلاثة أسابيع مع فحص الأسبوع." : "When on, the three-week average is checked with the week."}
          on={draft.rotatingShifts}
          disabled={!canEdit}
          onToggle={(on) => setDraft((prev) => ({ ...prev, rotatingShifts: on }))}
        />
      </div>
      <div style={row}>
        <LaborArticleCite ruleId="hours.art103.cite" ar={ar} showText />
        <Flag
          label={ar ? "استمرار العمل دون توقف — المادة 103" : "Uninterrupted work — Art. 103"}
          note={ar ? "مغلق افتراضياً. لا يُفعَّل لخفجي." : "Off by default. Do not turn on for Khafji."}
          on={draft.continuousWork103}
          disabled={!canEdit}
          onToggle={(on) => setDraft((prev) => ({ ...prev, continuousWork103: on }))}
        />
      </div>
      <div style={row}>
        <LaborArticleCite ruleId="hours.art105.bankMaxWeeks" ar={ar} showText />
        <Flag
          label={ar ? "تجميع الراحة الأسبوعية في مكان ناءٍ" : "Bank weekly rest at a remote site"}
          note={ar ? "مغلق افتراضياً. يحتاج موافقة العامل والوزارة." : "Off by default. Needs the worker's and the Ministry's consent."}
          on={draft.remoteRestBank105}
          disabled={!canEdit}
          onToggle={(on) => setDraft((prev) => ({ ...prev, remoteRestBank105: on }))}
        />
        {draft.remoteRestBank105 ? (
          <>
            <Flag
              label={ar ? "موافقة العامل كتابة مسجّلة" : "Worker's written consent on file"}
              on={draft.art105WorkerConsent}
              disabled={!canEdit}
              onToggle={(on) => setDraft((prev) => ({ ...prev, art105WorkerConsent: on }))}
            />
            <Flag
              label={ar ? "موافقة الوزارة مسجّلة" : "Ministry approval on file"}
              on={draft.art105MinistryConsent}
              disabled={!canEdit}
              onToggle={(on) => setDraft((prev) => ({ ...prev, art105MinistryConsent: on }))}
            />
            <label style={{ fontSize: 11, color: MUTED }}>
              {ar ? "أسابيع مجمّعة" : "Banked weeks"}
              <input
                dir="ltr"
                value={draft.art105BankedWeeks}
                disabled={!canEdit}
                onChange={(e) => setDraft((prev) => ({ ...prev, art105BankedWeeks: e.target.value }))}
                style={{ ...field, marginTop: 6 }}
              />
            </label>
          </>
        ) : null}
      </div>
      <div style={row}>
        <LaborArticleCite ruleId="hours.posting.cite" ar={ar} showText />
        {!postingGate.ok ? <PolicyDeviationAlert gate={postingGate} ruleId="hours.posting.cite" ar={ar} /> : null}
        <label style={{ fontSize: 11, color: MUTED }}>
          {ar ? "جدول مواعيد العمل" : "Work-hours table"}
          <input value={draft.workPosting.hoursTable} disabled={!canEdit} onChange={(e) => setDraft((prev) => ({ ...prev, workPosting: { ...prev.workPosting, hoursTable: e.target.value } }))} style={{ ...field, marginTop: 6 }} />
        </label>
        <label style={{ fontSize: 11, color: MUTED }}>
          {ar ? "فترات الراحة" : "Rest periods"}
          <input value={draft.workPosting.restPeriods} disabled={!canEdit} onChange={(e) => setDraft((prev) => ({ ...prev, workPosting: { ...prev.workPosting, restPeriods: e.target.value } }))} style={{ ...field, marginTop: 6 }} />
        </label>
        <label style={{ fontSize: 11, color: MUTED }}>
          {ar ? "يوم الراحة الأسبوعية" : "Weekly rest day"}
          <input value={draft.workPosting.weeklyRest} disabled={!canEdit} onChange={(e) => setDraft((prev) => ({ ...prev, workPosting: { ...prev.workPosting, weeklyRest: e.target.value } }))} style={{ ...field, marginTop: 6 }} />
        </label>
        <label style={{ fontSize: 11, color: MUTED }}>
          {ar ? "مواعيد النوبة" : "Shift times"}
          <input value={draft.workPosting.shiftTimes} disabled={!canEdit} onChange={(e) => setDraft((prev) => ({ ...prev, workPosting: { ...prev.workPosting, shiftTimes: e.target.value } }))} style={{ ...field, marginTop: 6 }} />
        </label>
        <Flag
          label={ar ? "معلَن في موقع العمل" : "Posted at the workplace"}
          note={ar ? "غياب الإعلان تنبيه للإدارة، لا سكوت." : "A missing posting is a management warning, not a silent pass."}
          on={draft.workPosting.posted}
          disabled={!canEdit}
          onToggle={(on) => setDraft((prev) => ({ ...prev, workPosting: { ...prev.workPosting, posted: on } }))}
        />
        <label style={{ fontSize: 11, color: MUTED }}>
          {ar ? "تاريخ الإعلان" : "Posting date"}
          <div style={{ marginTop: 6 }}>
            <PlatformDateField ar={ar} value={draft.workPosting.postedAt} disabled={!canEdit} onChange={(postedAt) => setDraft((prev) => ({ ...prev, workPosting: { ...prev.workPosting, postedAt } }))} />
          </div>
        </label>
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
      </div>
      {canEdit ? (
        <div style={{ padding: "15px 20px" }}>
          <button
            type="button"
            onClick={save}
            style={{ fontFamily: "inherit", fontSize: 13, fontWeight: 600, padding: "11px 18px", border: "none", background: "var(--nv-btn-fill)", color: "#fff", cursor: "pointer" }}
          >
            {ar ? "احفظ إعداد الساعات والإعلان" : "Save hours and posting"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
