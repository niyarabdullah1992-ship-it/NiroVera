import React, { useMemo, useState } from "react";
import { Building2, Check, X } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { setEmployeeEscalationCoverage } from "@/lib/orgTree";
import { deriveBranchEscalationChain } from "@/lib/orgDerivations";
import {
  companyRootStation,
  isCompanyRootStation,
  workplaceStations,
} from "@/lib/stationTree";
import { ACCENT, CARD, MUTED, NAVY, SURFACE } from "@/lib/platformStyles";

function activeEmployees(data) {
  return (data?.employees || []).filter((employee) => (
    employee?.active !== false
    && employee.role !== "system"
    && employee.profile?.employmentStatus !== "terminated"
  ));
}

export default function AssignEscalationDialog({
  stationId,
  data,
  companyId,
  ar,
  onClose,
}) {
  const stations = useMemo(
    () => workplaceStations(data?.stations || []).map((station) => ({
      id: String(station.id || station.stationId || ""),
      name: station.name || "",
      isHq: isCompanyRootStation(station),
    })).filter((station) => station.id),
    [data?.stations],
  );
  const hq = companyRootStation(data?.stations || []);
  const hqId = hq ? String(hq.id) : "";

  const homeId = String(stationId || stations[0]?.id || "");
  const defaultLevel = homeId ? deriveBranchEscalationChain(homeId, data).length + 1 : 1;

  const employees = useMemo(() => activeEmployees(data), [data]);
  const employeesByStation = useMemo(() => {
    const groups = new Map();
    for (const employee of employees) {
      const sid = String(employee.stationId || hqId || "other");
      if (!groups.has(sid)) groups.set(sid, []);
      groups.get(sid).push(employee);
    }
    return groups;
  }, [employees, hqId]);

  const stationOrder = useMemo(() => {
    const ordered = [];
    if (hqId && employeesByStation.has(hqId)) ordered.push(hqId);
    stations.forEach((station) => {
      if (station.id !== hqId && employeesByStation.has(station.id)) ordered.push(station.id);
    });
    if (employeesByStation.has("other")) ordered.push("other");
    return ordered;
  }, [stations, employeesByStation, hqId]);

  const [employeeId, setEmployeeId] = useState("");
  const [level, setLevel] = useState(defaultLevel);
  const [selected, setSelected] = useState(homeId ? [homeId] : []);

  const toggle = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]));
  };

  const stationLabel = (sid) => {
    if (sid === "other") return ar ? "غير مرتبط بفرع" : "Unassigned";
    const station = stations.find((item) => item.id === sid);
    if (!station) return sid;
    return station.isHq ? (ar ? `${station.name || "المقر"} · المقر` : `${station.name || "HQ"} · HQ`) : station.name;
  };

  const save = () => {
    if (!employeeId) {
      toast({
        description: ar ? "اختر موظفًا من المقر أو أي فرع." : "Pick an employee from HQ or any branch.",
        variant: "destructive",
      });
      return;
    }
    if (!selected.length) {
      toast({
        description: ar ? "اختر فرعًا واحدًا على الأقل يمسكه هذا التصعيد." : "Select at least one branch.",
        variant: "destructive",
      });
      return;
    }
    setEmployeeEscalationCoverage(companyId, employeeId, selected, level);
    const employee = employees.find((item) => String(item.id) === String(employeeId));
    toast({
      description: ar
        ? `${employee?.name || "—"} · تصعيد ${level} · ${selected.length} ${selected.length === 1 ? "فرع" : "فروع"}`
        : `${employee?.name || "—"} · escalation ${level} · ${selected.length} branch(es)`,
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
        background: "rgba(20,40,75,.28)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 420,
          maxHeight: "min(90vh, 640px)",
          overflow: "auto",
          borderRadius: 24,
          border: "1px solid #E8EDF3",
          background: CARD,
          boxShadow: "0 24px 56px rgba(20,40,75,.16)",
          padding: "18px 18px 16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: NAVY, letterSpacing: "-0.02em" }}>
              {ar ? "عيّن مسؤول تصعيد" : "Assign escalation handler"}
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
              {ar
                ? "يمكنك اختيار موظف من المقر ليمسك تصعيد فروع ميدانية — أو مدير الفرع نفسه."
                : "Pick an HQ employee to handle field-station escalation — or the branch manager."}
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
              border: "1px solid #E8EDF3",
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

        <label style={{ display: "block", marginTop: 16 }}>
          <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: MUTED, marginBottom: 6 }}>
            {ar ? "الموظف" : "Employee"}
          </span>
          <select
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
            style={{
              width: "100%",
              height: 40,
              borderRadius: 10,
              border: "1px solid #E8EDF3",
              padding: "0 10px",
              fontSize: 13,
              fontFamily: "inherit",
              background: SURFACE,
              color: NAVY,
            }}
          >
            <option value="">{ar ? "اختر موظفًا…" : "Choose employee…"}</option>
            {stationOrder.map((sid) => (
              <optgroup key={sid} label={stationLabel(sid)}>
                {(employeesByStation.get(sid) || []).map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                    {employee.profile?.position ? ` · ${employee.profile.position}` : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label style={{ display: "block", marginTop: 12 }}>
          <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: MUTED, marginBottom: 6 }}>
            {ar ? "رقم التصعيد (غير محدد)" : "Escalation rank (unbounded)"}
          </span>
          <input
            type="number"
            min={1}
            step={1}
            value={level}
            onChange={(event) => setLevel(Math.max(1, Number(event.target.value) || 1))}
            style={{
              width: "100%",
              height: 40,
              borderRadius: 10,
              border: "1px solid #E8EDF3",
              padding: "0 10px",
              fontSize: 13,
              fontFamily: "inherit",
              background: SURFACE,
              color: NAVY,
            }}
          />
          <span style={{ display: "block", marginTop: 6, fontSize: 11, color: MUTED, lineHeight: 1.5 }}>
            {ar ? "1 أول مراجعة، ثم 2 و3 و4… بلا سقف." : "1 is first review, then 2, 3, 4… with no cap."}
          </span>
        </label>

        <div style={{ marginTop: 14 }}>
          <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: MUTED, marginBottom: 8 }}>
            {ar ? "أي فروع يمسك؟" : "Which branches?"}
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                      ? `1px solid color-mix(in oklab, ${ACCENT} 28%, #fff)`
                      : "1px solid #E8EDF3",
                    background: on ? "color-mix(in oklab, #1E9E63 8%, #fff)" : "#F7F8FA",
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
                      border: "1px solid #E8EDF3",
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
                      border: on ? "none" : "1px solid #E2E8F0",
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
            background: employeeId && selected.length ? ACCENT : CARD,
            color: employeeId && selected.length ? "#fff" : "#9F1239",
            borderWidth: employeeId && selected.length ? 0 : 1,
            borderStyle: "solid",
            borderColor: "#F1F5F9",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {ar ? "حفظ مسؤول التصعيد" : "Save escalation handler"}
        </button>
      </div>
    </div>
  );
}
