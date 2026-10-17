import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  SW,
  employeeWeekHours,
  employeeWorkStationId,
  findStationById,
  stationDisplayName,
  weekStartDate,
} from "@/lib/shiftWeek";
import { useAuth } from "@/lib/PowerCareAuth";
import { isViewerOwnFile } from "@/lib/employeeFileView";
import { nightMedicalReportOf } from "@/lib/decision18632";
import { canEditEmployeeFile, EMPLOYEE_FILE_HR_ONLY_LINE } from "@/lib/permissions";
import { patchEmployeeFile, updateEmployeeProfile } from "@/lib/store";
import { ART108_CATEGORIES, art108CategoryOf, hoursBasisOf, isJuvenile } from "@/lib/laborHoursPolicy.js";
import { fileOffDows, weeklyRestDayCountOf } from "@/lib/leaveEidOverlap.js";
import { JUVENILE_DOCS, JUVENILE_REGISTER_FIELDS, juvenileDocGaps } from "@/lib/ministryExtras";

const paper = {
  background: "var(--nv-card)",
  border: "1px solid var(--nv-line)",
  borderRadius: 14,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  boxShadow: "var(--nv-paper)",
  padding: "16px 18px",
  gap: 10,
};

/**
 * File surface: no week-gate board (الجدول owns hours / night / heat publish checks).
 * Only file-held night fitness notice + pointer to the schedule.
 */
export default function HoursOnFile({ employee, data, lang = "ar", embedded = false }) {
  const ar = lang === "ar";
  const { currentUser, data: authData, company, refresh } = useAuth();
  const isSelf = isViewerOwnFile(employee, currentUser);
  // Duty kept on the file is a file fact: HR (and the account administrator) set it; others read.
  const canManage = canEditEmployeeFile(currentUser, employee, authData || data);
  const stationId = employeeWorkStationId(employee);
  const stationName = stationDisplayName(findStationById(data?.stations || [], stationId));
  const schedule = useMemo(
    () => (data?.schedules || []).find((row) => String(row.stationId) === String(stationId)) || { shiftTypes: [], assignments: {} },
    [data?.schedules, stationId],
  );
  const weekStart = useMemo(() => weekStartDate(new Date()), []);
  const hours = employee?.id ? employeeWeekHours(schedule, employee.id, weekStart, employee) : 0;
  void nightMedicalReportOf;
  // Nothing left to hold for this viewer — no empty card.
  if (embedded && !canManage && !isJuvenile(employee, new Date().toISOString().slice(0, 10))) return null;
  const shiftsHref = isSelf ? "/app/shifts?lane=mine" : "/app/shifts?lane=manage";

  return (
    <section dir={ar ? "rtl" : "ltr"} className="nv-paper" style={paper}>
      {embedded ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--nv-ink)" }}>
            {ar ? "ما يُحفظ على الملف" : "Held on the file"}
          </span>
          <span style={{ fontSize: 12, color: SW.muted, lineHeight: 1.75 }}>
            {ar
              ? "ما لا يظهر في الجدول ويُراعى عند الإسناد."
              : "What the roster does not show but assignment must weigh."}
          </span>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--nv-ink)" }}>
              {ar ? "الساعات من الجدول" : "Hours from the schedule"}
            </span>
            <span style={{ fontSize: 12, color: SW.muted, lineHeight: 1.75 }}>
              {ar
                ? "فحوصات الأسبوع والليل والحرارة أساسها الجدول والدوام — لا تُكرَّر هنا. الملف يحتفظ بما يُسجَّل عليه فقط."
                : "Week, night, and heat checks live on Schedule & attendance — not repeated here. The file keeps only what is written on it."}
            </span>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.6 }}>
              {stationName
                ? (ar ? `${stationName} · ${hours} ساعة هذا الأسبوع` : `${stationName} · ${hours} h this week`)
                : (ar ? "لا فرع عمل على هذا الملف بعد." : "No work branch on this file yet.")}
            </span>
            <Link
              to={shiftsHref}
              style={{
                marginInlineStart: "auto",
                fontSize: 12,
                fontWeight: 700,
                color: "var(--nv-accent, #1E9E63)",
                textDecoration: "none",
              }}
            >
              {ar ? "افتح الجدول ←" : "Open schedule →"}
            </Link>
          </div>
        </>
      )}

      {/* Weekly rest lives here only — HR decides it per worker; the roster and leave read it. */}
      {canManage ? (() => {
        // HR chooses only how many: the statutory day alone, or the statutory day plus the company day.
        // Which weekdays they fall on comes from the roster (its rest cells), else the establishment policy.
        const fileCount = Number(employee?.profile?.weeklyRestDayCount);
        const count = fileCount === 1 || fileCount === 2 ? fileCount : weeklyRestDayCountOf(company, employee);
        const save = (next) => {
          if (!company?.id || !employee?.id || (next === fileCount && !fileOffDows(employee).length)) return;
          patchEmployeeFile(company.id, employee.id, {
            actor: currentUser,
            profile: { weeklyOffDows: [], weeklyRestDayCount: next },
            log: {
              text: ar
                ? `راحة الأسبوع: ${next === 1 ? "يوم نظامي فقط" : "يوم نظامي مع يوم الشركة"}`
                : `Weekly rest: ${next === 1 ? "statutory day only" : "statutory day plus company day"}`,
              by: currentUser?.name || currentUser?.email || "",
              at: new Date().toISOString().slice(0, 16).replace("T", " "),
              dot: "#3C7D50",
            },
          });
          refresh?.();
        };
        const opt = (on) => ({ fontFamily: "inherit", textAlign: "start", display: "flex", flexDirection: "column", gap: 3, padding: "10px 12px", borderRadius: 10, cursor: "pointer", border: `1px solid ${on ? "#0B3D27" : "var(--nv-line)"}`, background: on ? "#E6EFE9" : "var(--nv-card)", color: "var(--nv-ink)", boxShadow: on ? "inset 0 0 0 1px #0B3D27" : "none" });
        const options = [
          { n: 1, title: ar ? "يوم نظامي فقط" : "Statutory day only", sub: ar ? "دوام ستة أيام في الأسبوع" : "Six-day week" },
          { n: 2, title: ar ? "يوم نظامي مع يوم الشركة" : "Statutory day plus company day", sub: ar ? "دوام خمسة أيام في الأسبوع" : "Five-day week" },
        ];
        return (
          <div data-file-rest="1" data-rest-count={count} style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 12, borderBottom: "1px solid var(--nv-line2)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--nv-ink)" }}>{ar ? "راحة الأسبوع" : "Weekly rest"}</span>
              <span style={{ fontSize: 11.5, color: SW.muted }}>{ar ? "يقررها الموارد البشرية لهذا الموظف" : "Set by HR for this worker"}</span>
            </div>
            <div role="radiogroup" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 8 }}>
              {options.map((o) => (
                <button key={o.n} type="button" role="radio" aria-checked={count === o.n} data-rest-mode={o.n} onClick={() => save(o.n)} style={opt(count === o.n)}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: count === o.n ? "#0B3D27" : "var(--nv-ink)" }}>{o.title}</span>
                  <span style={{ fontSize: 11.5, color: SW.muted }}>{o.sub}</span>
                </button>
              ))}
            </div>
            <p data-file-rest-explain="1" style={{ margin: 0, fontSize: 11.5, color: "var(--nv-ink2)", lineHeight: 1.85 }}>
              {ar
                ? <>{count === 1 ? "له يوم راحة نظامي واحد في الأسبوع (المادة 104) بأجر كامل." : "له يوم الراحة النظامي (المادة 104) ويوم تمنحه الشركة، وكلاهما بأجر كامل."} {count === 1 ? "وتحديد اليوم" : "وتحديد اليومين"} يأتي من الجدول تلقائياً. وفي كل أسبوع من إجازته السنوية {count === 1 ? "لا يُخصم يوم الراحة" : "لا يُخصم يوما الراحة"} من رصيده.{fileCount === 1 || fileCount === 2 ? "" : " (المعروض الآن من سياسة المنشأة إلى أن تختار.)"}</>
                : <>{count === 1 ? "One statutory rest day a week (Art. 104), fully paid." : "The statutory rest day plus a company day, both fully paid."} The weekdays come from the roster. Rest days are never taken from the annual-leave balance.</>}
            </p>
          </div>
        );
      })() : null}
      {/* Family responsibilities are raised in طلباتي (18632 e) and written here on approval — see the ministry panel. */}

      {canManage ? (() => {
        const cat = art108CategoryOf(employee);
        const basis = hoursBasisOf(data, employee);
        const fieldStyle = { fontFamily: "inherit", fontSize: 12, padding: "8px 10px", border: "1px solid var(--nv-line)", borderRadius: 10, background: "var(--nv-card)", color: "var(--nv-ink)" };
        return (
          <div data-hours-category="1" style={{ borderTop: "1px solid var(--nv-line2)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-ink)" }}>
              {ar ? "معيار الساعات وفئة المادة 108" : "Hours basis and Article 108 category"}
            </span>
            <label style={{ fontSize: 11.5, color: "var(--nv-ink2)", display: "flex", flexDirection: "column", gap: 4 }}>
              {ar ? "معيار الساعات (المادة 98) — يحدد كيف يُسمّى الإضافي وسقف رمضان" : "Hours basis (Art. 98) — drives overtime naming and the Ramadan cap"}
              <select
                data-hours-basis="1"
                disabled={!canManage}
                value={String(employee?.profile?.hoursBasis || "")}
                onChange={(e) => { updateEmployeeProfile(company.id, employee.id, { hoursBasis: e.target.value }); refresh?.(); }}
                style={fieldStyle}
              >
                <option value="">{ar ? `كما في الفرع أو المنشأة${basis.basis && basis.source !== "employee" ? ` (${basis.basis === "weekly" ? "أسبوعي 48" : "يومي 8"})` : " (غير مسجّل)"}` : "As the site / company"}</option>
                <option value="daily">{ar ? "يومي — 8 ساعات (6 في رمضان)" : "Daily — 8 h (6 in Ramadan)"}</option>
                <option value="weekly">{ar ? "أسبوعي — 48 ساعة (36 في رمضان)" : "Weekly — 48 h (36 in Ramadan)"}</option>
              </select>
            </label>
            <label style={{ fontSize: 11.5, color: "var(--nv-ink2)", display: "flex", flexDirection: "column", gap: 4 }}>
              {ar ? "فئة المادة 108 (اللائحة م23) — بلا فئة تُطبَّق المادتان 98 و101" : "Article 108 category (Regs Art. 23) — none applies Arts. 98 and 101"}
              <select
                data-hours-category-select="1"
                disabled={!canManage}
                value={cat.category}
                onChange={(e) => { updateEmployeeProfile(company.id, employee.id, { hoursCategory108: e.target.value, hoursExempt108: !!e.target.value }); refresh?.(); }}
                style={fieldStyle}
              >
                <option value="">{ar ? "لا فئة — الساعات العادية" : "No category — ordinary hours"}</option>
                {ART108_CATEGORIES.map((row) => <option key={row.id} value={row.id}>{ar ? row.ar : row.en}</option>)}
              </select>
            </label>
            {cat.legacy ? (
              <span data-art108-legacy="1" style={{ fontSize: 11.5, color: "var(--nv-warn-ink)", lineHeight: 1.7 }}>
                {ar
                  ? "على الملف «مستثنى من المادة 108» بلا فئة — اختر الفئة لتُطبَّق حدود اللائحة م23. حتى ذلك تُطبَّق الحدود العادية."
                  : "The file says “Art. 108 exempt” with no category — choose one to apply Regs Art. 23 limits. Ordinary limits apply until then."}
              </span>
            ) : null}
          </div>
        );
      })() : (
        <span data-file-hr-only="1" style={{ fontSize: 11.5, color: SW.muted }}>{ar ? EMPLOYEE_FILE_HR_ONLY_LINE.ar : EMPLOYEE_FILE_HR_ONLY_LINE.en}</span>
      )}

      {isJuvenile(employee, new Date().toISOString().slice(0, 10)) ? (
        <div data-juvenile-docs="1" style={{ borderTop: "1px solid var(--nv-line2)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-ink)" }}>
            {ar ? "ملف الحدث — المادتان 165 و166" : "Juvenile file — Arts. 165 and 166"}
          </span>
          <span style={{ fontSize: 11.5, color: SW.muted, lineHeight: 1.75 }}>
            {(() => {
              const gaps = juvenileDocGaps(employee);
              return gaps.length
                ? (ar ? `ناقص: ${gaps.map((gap) => gap.ar).join("، ")}.` : `Missing: ${gaps.map((gap) => gap.en).join(", ")}.`)
                : (ar ? "الوثائق محفوظة وأُبلغ مكتب العمل." : "Documents on file and the labour office notified.");
            })()}
          </span>
          {canManage ? <>
          {JUVENILE_DOCS.map((doc) => (
            <label key={doc.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--nv-ink2)", cursor: canManage ? "pointer" : "default" }}>
              <input
                type="checkbox"
                checked={employee?.profile?.[doc.key] === true}
                disabled={!canManage}
                onChange={(e) => {
                  if (!company?.id || !employee?.id) return;
                  updateEmployeeProfile(company.id, employee.id, { [doc.key]: e.target.checked });
                  refresh?.();
                }}
              />
              {ar ? doc.ar : doc.en}
            </label>
          ))}
          <label style={{ fontSize: 11.5, color: "var(--nv-ink2)", display: "flex", flexDirection: "column", gap: 4 }}>
            {ar ? "تاريخ إبلاغ مكتب العمل (خلال الأسبوع الأول من التشغيل)" : "Labour office notified on (within the first week)"}
            <input
              type="date"
              dir="ltr"
              disabled={!canManage}
              value={String(employee?.profile?.juvenileOfficeNotifiedAt || "").slice(0, 10)}
              onChange={(e) => {
                if (!company?.id || !employee?.id) return;
                updateEmployeeProfile(company.id, employee.id, { juvenileOfficeNotifiedAt: e.target.value });
                refresh?.();
              }}
              style={{ fontFamily: "inherit", fontSize: 12, padding: "8px 10px", border: "1px solid var(--nv-line)", borderRadius: 10, background: "var(--nv-card)", color: "var(--nv-ink)" }}
            />
          </label>
          {JUVENILE_REGISTER_FIELDS.map((field) => (
            <label key={field.key} data-juvenile-register={field.key} style={{ fontSize: 11.5, color: "var(--nv-ink2)", display: "flex", flexDirection: "column", gap: 4 }}>
              {ar ? `${field.ar} — سجل الأحداث (المادة 166)` : `${field.en} — juvenile register (Art. 166)`}
              <input
                disabled={!canManage}
                defaultValue={String(employee?.profile?.[field.key] || "")}
                onBlur={(e) => {
                  if (!company?.id || !employee?.id) return;
                  updateEmployeeProfile(company.id, employee.id, { [field.key]: e.target.value.trim() });
                  refresh?.();
                }}
                style={{ fontFamily: "inherit", fontSize: 12, padding: "8px 10px", border: "1px solid var(--nv-line)", borderRadius: 10, background: "var(--nv-card)", color: "var(--nv-ink)" }}
              />
            </label>
          ))}
          </> : null}
        </div>
      ) : null}

    </section>
  );
}
