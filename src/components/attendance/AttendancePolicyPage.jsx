import React, { useState } from "react";
import { useAuth } from "@/lib/PowerCareAuth";
import { checkWorkPostingGate } from "@/lib/laborHoursPolicy";
import { citeRule } from "@/lib/laborRules";
import { recordWorkPosting } from "@/lib/store";
import { toRiyadhDateKey } from "@/lib/riyadhDate";
import { DutyBoard } from "@/components/schedules/DutyTiles";
import AttendanceSettingsBoard from "@/components/attendance/AttendanceSettingsBoard";
import AttendanceLocationsPanel from "@/components/attendance/AttendanceLocationsPanel";
import { BORDER, CARD, MUTED, NAVY } from "@/lib/platformStyles";

/**
 * «السياسة والمواقع» (الإدارة) — the same skeleton as every duty page:
 * one full-width column (policy, the Art. 17 posting, then branch points). No tiles and no side column.
 */
export default function AttendancePolicyPage({ company, currentUser, t, lang = "ar", canEditSettings = false }) {
  return (
    <DutyBoard
      main={(
        <>
          <AttendanceSettingsBoard company={company} currentUser={currentUser} t={t} canEditSettings={canEditSettings} />
          <WorkPostingSection company={company} currentUser={currentUser} lang={lang} canEdit={canEditSettings} />
          <AttendanceLocationsPanel t={t} lang={lang} />
        </>
      )}
    />
  );
}

/** Art. 17 — «إعلان أوقات العمل»: the owner records that the table is posted at the workplace (date + who). */
function WorkPostingSection({ company, currentUser, lang, canEdit }) {
  const ar = lang === "ar";
  const { data } = useAuth();
  const gate = checkWorkPostingGate({ company: data });
  const cite = citeRule("hours.posting.cite");
  const [date, setDate] = useState(toRiyadhDateKey());
  const posting = gate.table || {};
  const save = (posted) => {
    if (!canEdit || !company?.id) return;
    recordWorkPosting(company.id, { posted, date, by: currentUser?.name || "" });
  };
  return (
    <section className="nv-att-card" data-work-posting={gate.ok ? "posted" : "missing"} style={{ background: CARD, border: `1px solid ${BORDER}`, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>
          {ar ? `إعلان أوقات العمل (${cite?.labelAr || "المادة 17"})` : `Posting of working hours (${cite?.labelEn || "Art. 17"})`}
        </span>
        <span style={{ fontSize: 11.5, color: "var(--nv-ink2)", lineHeight: 1.85 }}>
          {ar ? cite?.hintAr || "" : cite?.hintEn || ""}
        </span>
        {gate.ok ? (
          <span style={{ fontSize: 12, color: "var(--nv-ok-ink)", lineHeight: 1.8 }}>
            {ar ? "مُعلن منذ " : "Posted since "}<span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{gate.postedAt}</span>
            {posting.postedBy ? (ar ? ` — سجّله ${posting.postedBy}` : ` — recorded by ${posting.postedBy}`) : ""}
          </span>
        ) : (
          <span style={{ fontSize: 12, color: "var(--nv-warn-ink)", lineHeight: 1.8 }}>{ar ? "لم يُسجَّل الإعلان بعد." : "Not recorded yet."}</span>
        )}
        {canEdit ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
            {gate.ok ? (
              <button type="button" data-work-posting-clear="1" onClick={() => save(false)} style={btn(false)}>{ar ? "ألغِ التسجيل" : "Withdraw"}</button>
            ) : (
              <>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: MUTED }}>
                  {ar ? "تاريخ الإعلان" : "Posted on"}
                  <input type="date" data-work-posting-date="1" value={date} max={toRiyadhDateKey()} onChange={(ev) => setDate(ev.target.value)} dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, padding: "6px 8px", border: `1px solid ${BORDER}`, borderRadius: 8, background: CARD, color: "var(--nv-ink)" }} />
                </label>
                <button type="button" data-work-posting-save="1" onClick={() => save(true)} style={btn(true)}>{ar ? "سجّل أن الجدول مُعلن" : "Record it as posted"}</button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function btn(primary) {
  return {
    fontFamily: "inherit",
    fontSize: 12,
    fontWeight: 600,
    height: 32,
    padding: "0 14px",
    borderRadius: 8,
    border: `1px solid ${primary ? "var(--nv-ok-fill)" : BORDER}`,
    background: primary ? "var(--nv-ok-fill)" : CARD,
    color: primary ? "var(--nv-btn-ink)" : "var(--nv-ink)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}
