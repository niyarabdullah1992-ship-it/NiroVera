import React, { useState } from "react";
import { Building2, Check, X } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import {
  deriveBranchEscalationChain,
  escalationStationsForEmployee,
} from "@/lib/orgDerivations";
import { setEmployeeEscalationCoverage } from "@/lib/orgTree";
import { isCompanyRootStation } from "@/lib/stationTree";
import { ACCENT, CARD, MUTED, NAVY, SURFACE } from "@/lib/platformStyles";

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "·";
  return `${parts[0][0] || ""}${parts[1]?.[0] || ""}`;
}

export default function EscalationCoverageDialog({
  employeeId,
  stationId,
  level,
  data,
  companyId,
  ar,
  onClose,
}) {
  const employee = (data?.employees || []).find((item) => String(item.id) === String(employeeId));
  const stations = (data?.stations || [])
    .filter((station) => station && String(station.unitKind || "branch") !== "manager")
    .map((s) => ({
      id: String(s.id || s.stationId || ""),
      name: s.name || "",
      isHq: isCompanyRootStation(s),
    }))
    .filter((s) => s.id);
  const homeId = String(stationId || stations[0]?.id || "");
  const currentIds = escalationStationsForEmployee(employeeId, data);
  const rank = Number(level) > 0
    ? Number(level)
    : (homeId ? deriveBranchEscalationChain(homeId, data).length + (currentIds.includes(homeId) ? 0 : 1) : 1);

  const [selected, setSelected] = useState(
    currentIds.length ? currentIds : (homeId ? [homeId] : []),
  );

  const toggle = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]));
  };

  const save = () => {
    setEmployeeEscalationCoverage(companyId, employeeId, selected, rank);
    const n = selected.length;
    toast({
      description: ar
        ? (n === 0
          ? "أُزيل من التصعيد."
          : n === 1
            ? `تصعيد ${rank} يمسك فرعًا واحدًا.`
            : n === stations.length
              ? `تصعيد ${rank} يمسك كل الفروع.`
              : `تصعيد ${rank} يمسك ${n} فروع.`)
        : (n === 0
          ? "Removed from escalation."
          : `Escalation ${rank} now holds ${n} branch${n === 1 ? "" : "es"}.`),
    });
    onClose();
  };

  return (
    <div
      onClick={onClose}
      dir={ar ? "rtl" : "ltr"}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "color-mix(in oklab, var(--nv-navy) 42%, transparent)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 360,
          borderRadius: 24,
          border: "1px solid var(--nv-line)",
          background: CARD,
          boxShadow: "0 24px 56px rgba(20,40,75,.16)",
          padding: "18px 18px 16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              width: 42,
              height: 42,
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "color-mix(in oklab, var(--nv-ink) 8%, #fff)",
              color: NAVY,
              fontSize: 13,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {initials(employee?.name)}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: NAVY, letterSpacing: "-0.02em" }}>
                {employee?.name || (ar ? "تصعيد" : "Escalation")}
              </h3>
              <span
                style={{
                  height: 22,
                  padding: "0 8px",
                  borderRadius: 999,
                  background: ACCENT,
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                {ar ? `تصعيد ${rank}` : `Escalation ${rank}`}
              </span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: MUTED }}>
              {ar ? "أي فروع يمسك؟" : "Which branches does this rank hold?"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={ar ? "إغلاق" : "Close"}
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              border: "1px solid var(--nv-line)",
              background: CARD,
              color: MUTED,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
          {stations.map((station) => {
            const on = selected.includes(station.id);
            return (
              <button
                key={station.id}
                type="button"
                onClick={() => toggle(station.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 999,
                  border: on
                    ? "1px solid var(--nv-accent-border)"
                    : "1px solid var(--nv-line)",
                  background: on ? "var(--nv-accent-soft)" : "var(--nv-soft)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "start",
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: on ? CARD : SURFACE,
                    color: on ? ACCENT : MUTED,
                    border: "1px solid var(--nv-line)",
                    flexShrink: 0,
                  }}
                >
                  <Building2 style={{ width: 13, height: 13 }} strokeWidth={1.8} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: NAVY }}>
                    {station.name || station.id}
                  </span>
                  {station.isHq && (
                    <span style={{ display: "block", marginTop: 1, fontSize: 10, color: MUTED }}>
                      {ar ? "المقر الرئيسي" : "Headquarters"}
                    </span>
                  )}
                  {station.id === homeId && !station.isHq && (
                    <span style={{ display: "block", marginTop: 1, fontSize: 10, color: MUTED }}>
                      {ar ? "الفرع الحالي" : "Current branch"}
                    </span>
                  )}
                </span>
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: on ? ACCENT : CARD,
                    border: on ? "none" : "1px solid var(--nv-line)",
                    color: "#fff",
                    flexShrink: 0,
                  }}
                >
                  {on ? <Check style={{ width: 12, height: 12 }} strokeWidth={2.4} /> : null}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={save}
          style={{
            width: "100%",
            height: 42,
            marginTop: 16,
            border: "none",
            borderRadius: 999,
            background: selected.length ? ACCENT : CARD,
            color: selected.length ? "#fff" : "var(--nv-bad-ink)",
            borderWidth: selected.length ? 0 : 1,
            borderStyle: "solid",
            borderColor: "var(--nv-line)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {ar
            ? (selected.length ? `حفظ · ${selected.length} ${selected.length === 1 ? "فرع" : "فروع"}` : "إزالة من التصعيد")
            : (selected.length ? `Save · ${selected.length}` : "Remove")}
        </button>
      </div>
    </div>
  );
}
