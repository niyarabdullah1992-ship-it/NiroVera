import React, { useMemo, useState } from "react";
import { submitOtherRequest } from "@/lib/store";
import { todayRiyadh } from "@/lib/requestWorkspace";
import {
  MISSION_TYPE,
  RELOCATION_ITEMS,
  RELOCATION_TYPE,
  checkMissionGate,
  checkRelocationClaimGate,
  residenceTransfers,
} from "@/lib/modelRequests";
import { missionModelNote, relocationModelNote } from "@/lib/implementingRegsNotes";
import { BORDER, CARD, CONTROL_RADIUS, MUTED, NAVY } from "@/lib/platformStyles";
import PlatformDateField from "@/components/shared/PlatformDateField";
import { toast } from "@/components/ui/use-toast";

const field = { fontFamily: "inherit", fontSize: 12.5, padding: "10px 12px", border: `1px solid ${BORDER}`, background: CARD, color: "var(--nv-ink)", outline: "none", width: "100%", boxSizing: "border-box", borderRadius: CONTROL_RADIUS };
const block = { padding: "14px 20px", borderBottom: "1px solid var(--nv-line2)", display: "flex", flexDirection: "column", gap: 10 };
const label = { fontSize: 11.5, color: MUTED, display: "flex", flexDirection: "column", gap: 4 };
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,170px),1fr))", gap: 8 };
const money = (n) => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

/**
 * Two requests the unified model regulation adds to طلباتي:
 *   relocation — the worker claims the expenses of a transfer that changed his residence (model Arts. 9/12);
 *   mission    — the manager issues a mission decision with its allowance (model Art. 24).
 * Both pass the gate in lib/modelRequests (and its server twin); approved sums reach the wage run as a
 * reimbursement in the month they are due.
 */
export default function ModelRequestRaise({ kind, employee, companyId, actor, ar = true, refresh, defaultDailyRate }) {
  const today = todayRiyadh();
  const transfers = useMemo(() => residenceTransfers(employee), [employee]);
  const [transferId, setTransferId] = useState(transfers[0]?.id || "");
  const [items, setItems] = useState({});
  const [reason, setReason] = useState("");
  const [m, setM] = useState({ destination: "", from: today, to: today, dailyRate: defaultDailyRate || "", transportProvided: true, transportCost: "", transportConsent: false, lodgingProvided: true, lodgingPerDay: "" });
  const [busy, setBusy] = useState(false);

  const isMission = kind === "mission";
  const gate = isMission
    ? checkMissionGate({ employee, actorId: actor?.id, ...m })
    : checkRelocationClaimGate({ employee, transferId, items });

  const send = () => {
    if (!gate.ok || busy || !employee?.id) return;
    setBusy(true);
    try {
      const res = submitOtherRequest(companyId, employee.id, isMission
        ? {
          type: MISSION_TYPE,
          reason: reason.trim() || (ar ? `انتداب إلى ${m.destination.trim()}` : `Mission to ${m.destination.trim()}`),
          date: m.from,
          details: m,
          status: "approved",
          recordedBy: actor?.name || "",
          requestedBy: actor?.name || "",
          requestedById: actor?.id,
        }
        : {
          type: RELOCATION_TYPE,
          reason: reason.trim() || (ar ? "نفقات نقل مع تغيير محل الإقامة" : "Relocation expenses"),
          date: today,
          details: { transferId, items },
          requestedById: employee.id,
        });
      if (!res?.ok) {
        toast({ description: ar ? res?.reason : res?.reasonEn, variant: "destructive" });
        return;
      }
      toast({ description: isMission
        ? (ar ? `صدر قرار الانتداب — ${money(gate.total)} ر.س تُصرف مع أجر شهر العودة.` : `Mission issued — ${money(gate.total)} SAR paid with the return month's wage.`)
        : (ar ? "أُرسلت المطالبة — تعتمدها الموارد البشرية وتُسترد مع الأجر." : "Claim sent — HR approves it and it is repaid with the wage.") });
      setItems({}); setReason("");
      refresh?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-model-raise={kind}>
      <div style={block}>
        <span style={{ fontSize: 12, fontWeight: 600, color: NAVY }}>
          {isMission ? (ar ? "قرار انتداب — النموذج الموحد م24" : "Mission decision — model Art. 24") : (ar ? "نفقات النقل مع تغيير السكن — النموذج الموحد م9 و12" : "Relocation expenses — model Arts. 9 and 12")}
        </span>
        <span style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.8 }}>{isMission ? missionModelNote(ar) : relocationModelNote(ar)}</span>
      </div>

      {isMission ? (
        <div style={block}>
          <div style={grid}>
            <label style={label}>{ar ? "جهة الانتداب ومكانه" : "Destination"}
              <input value={m.destination} onChange={(e) => setM((d) => ({ ...d, destination: e.target.value }))} style={field} />
            </label>
            <label style={label}>{ar ? "المغادرة" : "Departure"}
              <PlatformDateField ar={ar} value={m.from} onChange={(v) => setM((d) => ({ ...d, from: v }))} />
            </label>
            <label style={label}>{ar ? "العودة" : "Return"}
              <PlatformDateField ar={ar} value={m.to} min={m.from} onChange={(v) => setM((d) => ({ ...d, to: v }))} />
            </label>
            <label style={label}>{ar ? "البدل اليومي حسب الدرجة (ر.س)" : "Daily allowance by grade (SAR)"}
              <input type="number" min="0" dir="ltr" value={m.dailyRate} onChange={(e) => setM((d) => ({ ...d, dailyRate: e.target.value }))} style={field} />
            </label>
          </div>
          <div style={grid}>
            <label style={{ ...label, flexDirection: "row", alignItems: "center", gap: 6, color: "var(--nv-ink)" }}>
              <input type="checkbox" checked={m.transportProvided} onChange={(e) => setM((d) => ({ ...d, transportProvided: e.target.checked }))} />
              {ar ? "تؤمّن المنشأة وسيلة النقل" : "The company provides transport"}
            </label>
            <label style={{ ...label, flexDirection: "row", alignItems: "center", gap: 6, color: "var(--nv-ink)" }}>
              <input type="checkbox" checked={m.lodgingProvided} onChange={(e) => setM((d) => ({ ...d, lodgingProvided: e.target.checked }))} />
              {ar ? "تؤمّن المنشأة السكن والطعام" : "The company provides lodging and food"}
            </label>
          </div>
          {!m.transportProvided ? (
            <div style={grid}>
              <label style={label}>{ar ? "مقابل النقل (ر.س)" : "Transport cash (SAR)"}
                <input type="number" min="0" dir="ltr" value={m.transportCost} onChange={(e) => setM((d) => ({ ...d, transportCost: e.target.value }))} style={field} />
              </label>
              <label style={{ ...label, flexDirection: "row", alignItems: "center", gap: 6, color: "var(--nv-ink)" }}>
                <input type="checkbox" checked={m.transportConsent} onChange={(e) => setM((d) => ({ ...d, transportConsent: e.target.checked }))} />
                {ar ? "وافق العامل على المقابل النقدي" : "The worker agreed to cash"}
              </label>
            </div>
          ) : null}
          {!m.lodgingProvided ? (
            <label style={label}>{ar ? "مقابل السكن والطعام لليوم (ر.س)" : "Lodging and food per day (SAR)"}
              <input type="number" min="0" dir="ltr" value={m.lodgingPerDay} onChange={(e) => setM((d) => ({ ...d, lodgingPerDay: e.target.value }))} style={field} />
            </label>
          ) : null}
        </div>
      ) : (
        <div style={block}>
          {transfers.length ? (
            <label style={label}>{ar ? "النقل الذي تطالب بنفقاته" : "The transfer you claim for"}
              <select value={transferId} onChange={(e) => setTransferId(e.target.value)} style={field}>
                {transfers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {`${t.fromStationName || "—"} ← ${t.toStationName || "—"} · ${t.effectiveDate || ""}${t.residence === "necessity" ? (ar ? " · تكليف مؤقت للضرورة" : " · temporary necessity") : ""}`}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div style={grid}>
            {RELOCATION_ITEMS.filter((item) => !item.necessityOnly || transfers.find((t) => t.id === transferId)?.residence === "necessity").map((item) => (
              <label key={item.key} style={label}>{ar ? item.ar : item.en}
                <input type="number" min="0" dir="ltr" value={items[item.key] ?? ""} onChange={(e) => setItems((d) => ({ ...d, [item.key]: e.target.value }))} style={field} />
              </label>
            ))}
          </div>
        </div>
      )}

      <div style={block}>
        <label style={label}>{ar ? "ملاحظة (اختيارية)" : "Note (optional)"}
          <input value={reason} onChange={(e) => setReason(e.target.value)} style={field} />
        </label>
        <span role={gate.ok ? undefined : "alert"} data-model-gate={gate.ok ? "ok" : gate.error} style={{ fontSize: 12, lineHeight: 1.8, color: gate.ok ? "var(--nv-ok-ink)" : "var(--nv-warn-ink)" }}>
          {gate.ok
            ? (isMission
              ? (ar ? `${gate.days} يوماً · البدل ${money(gate.allowance)} · السكن والطعام ${money(gate.lodging)} · النقل ${money(gate.transport)} = ${money(gate.total)} ر.س مع أجر ${gate.to.slice(0, 7)}` : `${gate.days} days · ${money(gate.total)} SAR with the ${gate.to.slice(0, 7)} wage`)
              : (ar ? `المجموع ${money(gate.total)} ر.س — يُسترد مع الأجر بعد اعتماد الموارد البشرية، خارج حد الحسم.` : `Total ${money(gate.total)} SAR — repaid with the wage once HR approves.`))
            : (ar ? gate.reason : gate.reasonEn)}
        </span>
        <button type="button" disabled={!gate.ok || busy} onClick={send} style={{ ...field, width: "auto", alignSelf: "flex-start", background: gate.ok ? "var(--nv-navy, #1F2A44)" : "var(--nv-soft)", color: gate.ok ? "#fff" : MUTED, fontWeight: 700, cursor: gate.ok ? "pointer" : "not-allowed", border: "none" }}>
          {isMission ? (ar ? "أصدر قرار الانتداب" : "Issue the mission") : (ar ? "أرسل المطالبة" : "Send the claim")}
        </button>
      </div>
    </div>
  );
}
