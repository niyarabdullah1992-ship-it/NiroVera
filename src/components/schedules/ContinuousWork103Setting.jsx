import React, { useState } from "react";
import { updateCompany } from "@/lib/store";
import { hoursPolicyOf } from "@/lib/laborHoursPolicy";
import { citeRule } from "@/lib/laborRules";
import { mono } from "@/components/schedules/scheduleChrome";
import { DS_CONTROL_RADIUS } from "@/lib/designSystem";
import { SW } from "@/lib/shiftWeek";

/**
 * «عمل متواصل (المادة 103)» — the establishment's own switch, beside the shift types it changes.
 * Continuous work without a break needs the Minister's decision, so turning it on asks for that
 * decision's reference; the switch, the reference and who set it live on hoursPolicy (hoursPolicyOf).
 */
export default function ContinuousWork103Setting({ ar = true, data, companyId, canEdit = false, onDate, refresh }) {
  const policy = hoursPolicyOf(data);
  const on = policy.continuousWork103 === true;
  const bag = { ...(data?.hoursPolicy || {}), ...(data?.attendanceSettings?.hoursPolicy || {}) };
  const savedRef = String(bag.continuous103Ref || "");
  const [ref, setRef] = useState(savedRef);
  const [error, setError] = useState("");
  const art = citeRule("hours.art103.cite", onDate)?.labelAr || "";
  const artEn = citeRule("hours.art103.cite", onDate)?.labelEn || "";

  const save = (next) => {
    if (!companyId) return;
    const decision = ref.trim();
    if (next && !decision) {
      setError(ar ? "اكتب رقم قرار الوزير وتاريخه قبل التفعيل." : "Enter the Minister's decision number and date first.");
      return;
    }
    setError("");
    updateCompany(companyId, (d) => {
      d.hoursPolicy = {
        ...(d.hoursPolicy || {}),
        continuousWork103: next,
        continuous103Ref: next ? decision : (d.hoursPolicy?.continuous103Ref || ""),
        continuous103At: new Date().toISOString(),
      };
      if (d.attendanceSettings?.hoursPolicy && "continuousWork103" in d.attendanceSettings.hoursPolicy) {
        d.attendanceSettings.hoursPolicy = { ...d.attendanceSettings.hoursPolicy, continuousWork103: next };
      }
    });
    refresh?.();
  };

  if (!canEdit && !on) return null;

  return (
    <div data-continuous-103={on ? "on" : "off"} style={{ padding: "11px 18px", borderBottom: `1px solid ${SW.hair}`, display: "flex", flexDirection: "column", gap: 7 }}>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: SW.ink, cursor: canEdit ? "pointer" : "default", lineHeight: 1.7 }}>
        <input
          type="checkbox"
          checked={on}
          disabled={!canEdit}
          onChange={(e) => save(e.target.checked)}
          style={{ marginTop: 3 }}
        />
        <span>
          <strong style={{ fontWeight: 600 }}>{ar ? `لدي قرار الوزير للعمل المتواصل${art ? ` (${art})` : ""}` : `We hold the Minister's decision for continuous work${artEn ? ` (${artEn})` : ""}`}</strong>
          <span style={{ display: "block", fontSize: 11, color: SW.mid }}>
            {on
              ? (ar ? "مفعّل — كل الورديات بلا توقف للراحة، ولا تُطلب بصمة راحة." : "On — every shift runs without a rest stop; no break punch is asked.")
              : (ar ? "بلا هذا القرار تبقى الراحة واجبة في كل وردية (المادة 101)." : "Without this decision every shift keeps its rest (Art. 101).")}
          </span>
        </span>
      </label>
      {canEdit ? (
        <label style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: SW.muted }}>{ar ? "رقم القرار وتاريخه" : "Decision no. & date"}</span>
          <input
            value={ref}
            onChange={(e) => { setRef(e.target.value); setError(""); }}
            onBlur={() => { if (on && ref.trim() && ref.trim() !== savedRef) save(true); }}
            placeholder={ar ? "مثال: 12345 · 1447/03/10هـ" : "e.g. 12345 · 1447/03/10 AH"}
            style={{ ...mono, fontSize: 11, padding: "5px 7px", border: `1px solid ${error ? "var(--nv-bad-line)" : SW.line}`, borderRadius: DS_CONTROL_RADIUS, background: SW.card, color: SW.ink, outline: "none", minWidth: 0 }}
          />
        </label>
      ) : savedRef ? (
        <span style={{ fontSize: 11, color: SW.mid }}>{ar ? "القرار: " : "Decision: "}<span dir="ltr" style={mono}>{savedRef}</span></span>
      ) : null}
      {error ? <span role="alert" style={{ fontSize: 11, color: "var(--nv-bad-ink)" }}>{error}</span> : null}
    </div>
  );
}
