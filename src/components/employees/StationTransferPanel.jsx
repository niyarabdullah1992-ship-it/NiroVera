import React, { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { ACTION_REASONS } from "@/lib/hcmDerivations";
import { transferEmployeeBetweenStations } from "@/lib/employeeStationTransfer";
import { consentState, necessityDaysUsed, NECESSITY_CAP_DAYS } from "@/lib/consentEffects";
import { workplaceStations } from "@/lib/stationTree";
import { toast } from "@/components/ui/use-toast";
import PlatformDateField from "@/components/shared/PlatformDateField";
import { ACCENT, BORDER, MUTED, NAVY, field, ui, BRAND_BORDER, BRAND_SOFT, BRAND_DEEP, CARD, SURFACE } from "@/lib/platformStyles";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Dated branch transfer — station + org tree + notifications in one action. */
export default function StationTransferPanel({
  employee,
  stations = [],
  companyId,
  actor,
  ar = true,
  onDone,
  startOpen = false,
}) {
  const workplaces = workplaceStations(stations);
  const fromStation = workplaces.find((s) => String(s.id) === String(employee?.stationId))
    || stations.find((s) => String(s.id) === String(employee?.stationId));
  const destinations = workplaces.filter((s) => String(s.id) !== String(employee?.stationId));
  const reasons = ACTION_REASONS.transfer || [];
  const [toStationId, setToStationId] = useState(destinations[0]?.id || "");
  const [reasonCode, setReasonCode] = useState(reasons[0]?.id || "operational_need");
  const [effectiveDate, setEffectiveDate] = useState(todayKey());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [residence, setResidence] = useState("");
  const [necessityUntil, setNecessityUntil] = useState("");
  const siteConsent = consentState(employee, "site");
  const necessityUsed = necessityDaysUsed(employee, "site", String(effectiveDate || todayKey()).slice(0, 4));
  const [open, setOpen] = useState(!!startOpen);

  if (!employee || destinations.length === 0) {
    return (
      <div style={{
        borderRadius: "12px",
        border: `1px solid ${BORDER}`,
        background: SURFACE,
        padding: "12px 14px",
        fontSize: "12px",
        color: MUTED,
        lineHeight: 1.65,
      }}
      >
        {ar
          ? "لا فرع آخر للنقل إليه — أضف فرعًا من الهيكل أو الإعدادات أولًا."
          : "No other branch to transfer to — add a station from Org or Settings first."}
      </div>
    );
  }

  const submit = (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const result = transferEmployeeBetweenStations(companyId, {
        employeeId: employee.id,
        toStationId,
        reasonCode,
        effectiveDate,
        note,
        actor,
        residence,
        necessityUntil,
      });
      if (!result.ok) {
        toast({
          description: ar ? result.reason : result.reasonEn,
          variant: "destructive",
        });
        return;
      }
      toast({
        description: ar
          ? `نُقل ${employee.name} إلى ${result.record.toStationName} من ${result.record.effectiveDate}`
          : `${employee.name} transferred to ${result.record.toStationName} from ${result.record.effectiveDate}`,
        variant: "success",
      });
      setOpen(false);
      setNote("");
      setResidence("");
      setNecessityUntil("");
      onDone?.(result);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      borderRadius: "14px",
      border: `1px solid ${BORDER}`,
      background: CARD,
      padding: "16px 18px",
    }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 220px" }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY, display: "flex", alignItems: "center", gap: "8px" }}>
            <ArrowLeftRight style={{ width: 16, height: 16, color: ACCENT }} />
            {ar ? "نقل بين الفروع" : "Transfer between branches"}
          </div>
          <div style={{ fontSize: "11px", color: MUTED, marginTop: "4px", lineHeight: 1.6 }}>
            {ar
              ? "نقل مباشر بين الفروع من القائمة — بلا الشجرة. السجل السابق لا يُمحى."
              : "Direct branch-to-branch transfer from the list — without the tree. Prior history is kept."}
          </div>
        </div>
        {!startOpen ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            style={{ ...ui.btnPrimary, opacity: 1 }}
          >
            {open ? (ar ? "إخفاء" : "Hide") : (ar ? "نقل الموظف" : "Transfer employee")}
          </button>
        ) : null}
      </div>

      <div style={{
        marginTop: "12px",
        borderRadius: "10px",
        border: `1px solid ${BRAND_BORDER}`,
        background: BRAND_SOFT,
        padding: "10px 12px",
        fontSize: "12px",
        color: BRAND_DEEP,
        lineHeight: 1.65,
      }}
      >
        {ar ? "الفرع الحالي:" : "Current branch:"}{" "}
        <strong>{fromStation?.name || (ar ? "غير مسند" : "Unassigned")}</strong>
      </div>

      {open && (
        <form onSubmit={submit} style={{ display: "grid", gap: "10px", marginTop: "14px" }}>
          <label style={{ display: "grid", gap: "4px", fontSize: "11px", color: MUTED }}>
            {ar ? "الفرع الوجهة" : "Destination branch"}
            <select
              value={toStationId}
              onChange={(e) => setToStationId(e.target.value)}
              style={{ ...field }}
              required
            >
              {destinations.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: "4px", fontSize: "11px", color: MUTED }}>
            {ar ? "سبب النقل" : "Transfer reason"}
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              style={{ ...field }}
              required
            >
              {reasons.map((r) => (
                <option key={r.id} value={r.id}>{ar ? r.ar : r.en}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: "4px", fontSize: "11px", color: MUTED }}>
            {ar ? "تاريخ السريان" : "Effective date"}
            <PlatformDateField ar={ar} value={effectiveDate} onChange={setEffectiveDate} required />
          </label>
          <fieldset data-transfer-residence="1" style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 12px", margin: 0, display: "grid", gap: 8 }}>
            <legend style={{ fontSize: 11.5, color: NAVY, fontWeight: 700, padding: "0 4px" }}>
              {ar ? "هل يقتضي هذا النقل تغيير محل إقامته؟ (المادة 58)" : "Does this move change their residence? (Art. 58)"}
            </legend>
            {[
              ["same", ar ? "لا — يبقى في محل إقامته" : "No — same residence", ""],
              ["change", ar ? "نعم — بموافقته الكتابية الموقّعة" : "Yes — with their signed consent", siteConsent.state === "signed"
                ? (ar ? "موافقته موقّعة — تُستخدم لهذا النقل." : "Signed — used for this move.")
                : siteConsent.state === "refused"
                  ? (ar ? "رفض كتابياً — لا يُنقل بهذا الخيار." : "Refused in writing.")
                  : siteConsent.state === "open"
                    ? (ar ? "طلب الموافقة بانتظار رده." : "Awaiting their reply.")
                    : (ar ? "لا موافقة — أرسلها من الطلبات ← رفع طلب لموظف ← طلب موافقة خطية." : "No consent — send it from Requests.")],
              ["necessity", ar ? "ضرورة عارضة مؤقتة — دون موافقة" : "Temporary incidental necessity — no consent", ar
                ? `حتى ${NECESSITY_CAP_DAYS} يوماً في السنة (استُخدم ${necessityUsed})، وتكاليف الانتقال والإقامة على المنشأة.`
                : `Up to ${NECESSITY_CAP_DAYS} days a year (used ${necessityUsed}); travel and lodging on the employer.`],
            ].map(([value, label, hint]) => (
              <label key={value} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: NAVY, cursor: "pointer" }}>
                <input type="radio" name="transfer-residence" value={value} checked={residence === value} onChange={() => setResidence(value)} style={{ marginTop: 3 }} />
                <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontWeight: 600 }}>{label}</span>
                  {hint ? <span style={{ fontSize: 11, color: value === "change" && siteConsent.state === "refused" ? "var(--nv-bad-ink)" : MUTED, lineHeight: 1.6 }}>{hint}</span> : null}
                </span>
              </label>
            ))}
            {residence === "necessity" ? (
              <label style={{ display: "grid", gap: "4px", fontSize: "11px", color: MUTED }}>
                {ar ? "ينتهي التكليف المؤقت في" : "The temporary assignment ends on"}
                <PlatformDateField ar={ar} value={necessityUntil} onChange={setNecessityUntil} />
              </label>
            ) : null}
          </fieldset>
          <label style={{ display: "grid", gap: "4px", fontSize: "11px", color: MUTED }}>
            {ar ? "ملاحظة (اختياري)" : "Note (optional)"}
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={240}
              placeholder={ar ? "مثال: تغطية نقص عمالة في الشرقية" : "e.g. Cover staffing gap at East"}
              style={{ ...field }}
            />
          </label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <button type="button" onClick={() => setOpen(false)} style={ui.btnGhost}>
              {ar ? "إلغاء" : "Cancel"}
            </button>
            <button type="submit" disabled={busy || !residence} style={{ ...ui.btnPrimary, opacity: busy || !residence ? 0.5 : 1 }}>
              {ar ? "تأكيد النقل" : "Confirm transfer"}
            </button>
          </div>
        </form>
      )}

      {!!(employee.stationTransfers || []).length && (
        <div style={{ marginTop: "14px", borderTop: `1px solid ${BORDER}`, paddingTop: "12px" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "8px" }}>
            {ar ? "سجل النقل بين الفروع" : "Branch transfer register"}
          </div>
          {(employee.stationTransfers || []).slice(0, 8).map((x) => {
            const reason = reasons.find((r) => r.id === x.reasonCode);
            return (
              <div
                key={x.id}
                style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                  alignItems: "baseline",
                  padding: "8px 0",
                  borderTop: "1px solid var(--nv-line)",
                  fontSize: "11px",
                  color: MUTED,
                }}
              >
                <span dir="ltr" style={{ flex: "0 0 88px" }}>{x.effectiveDate}</span>
                <span style={{ flex: "1 1 160px", color: NAVY }}>
                  {(x.fromStationName || "—")} → {(x.toStationName || "—")}
                </span>
                <span>{reason ? (ar ? reason.ar : reason.en) : x.reasonCode}</span>
                {x.residence === "change" ? <span style={{ color: "var(--nv-ok-ink)" }}>{ar ? "بموافقته الموقّعة · م 58" : "Signed consent · Art. 58"}</span> : null}
                {x.residence === "necessity" ? <span style={{ color: "var(--nv-warn-ink)" }}>{ar ? `ضرورة مؤقتة حتى ${x.necessityUntil} · م 58/2` : `Temporary until ${x.necessityUntil} · Art. 58/2`}</span> : null}
                <span>{x.recordedByName || "—"}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
