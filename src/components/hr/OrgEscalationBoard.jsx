import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpCircle, Plus } from "lucide-react";
import { useAuth } from "@/lib/PowerCareAuth";
import {
  deriveBranchEscalationChain,
  escalationStationsForEmployee,
  manualBranchEscalationIds,
  sharedEscalationLabel,
} from "@/lib/orgDerivations";
import { setBranchEscalationChain } from "@/lib/orgTree";
import EscalationCoverageDialog from "@/components/hr/EscalationCoverageDialog";
import AssignEscalationDialog from "@/components/hr/AssignEscalationDialog";
import {
  companyRootStation,
  isCompanyRootStation,
  workplaceStations,
} from "@/lib/stationTree";
import { OrgNotice, OrgPanel, OrgToolbar } from "@/components/hr/OrgWorkspace";
import { orgBtnGhost, orgBtnPrimary, orgSelect } from "@/lib/orgWorkspaceStyles";
import { BORDER, CARD, MUTED, NAVY } from "@/lib/platformStyles";
import { toast } from "@/components/ui/use-toast";

function activeEmployees(data) {
  return (data?.employees || []).filter((employee) => (
    employee?.active !== false
    && employee.role !== "system"
    && employee.profile?.employmentStatus !== "terminated"
  ));
}

function employeeGroups(data, ar) {
  const employees = activeEmployees(data);
  const hq = companyRootStation(data?.stations || []);
  const hqId = hq ? String(hq.id) : "";
  const stations = workplaceStations(data?.stations || []);
  const groups = [];
  if (hqId) {
    const hqStaff = employees.filter((employee) => String(employee.stationId) === hqId);
    if (hqStaff.length) {
      groups.push({
        id: hqId,
        label: `${hq?.name || (ar ? "المقر" : "HQ")} · ${ar ? "المقر" : "HQ"}`,
        employees: hqStaff,
      });
    }
  }
  for (const station of stations) {
    const sid = String(station.id);
    if (sid === hqId) continue;
    const branchStaff = employees.filter((employee) => String(employee.stationId) === sid);
    if (branchStaff.length) {
      groups.push({ id: sid, label: station.name || sid, employees: branchStaff });
    }
  }
  const other = employees.filter((employee) => {
    const sid = String(employee.stationId || "");
    return !sid || !groups.some((group) => group.employees.some((item) => item.id === employee.id));
  });
  if (other.length) {
    groups.push({ id: "other", label: ar ? "غير مرتبط بفرع" : "Unassigned", employees: other });
  }
  return groups;
}

function BranchEscalationRow({
  row,
  data,
  companyId,
  ar,
  canWrite,
  groups,
  onAdvanced,
}) {
  const ids = row.chain.map((step) => String(step.employeeId));
  const slotCount = canWrite ? ids.length + 1 : Math.max(ids.length, 1);
  const slots = Array.from({ length: slotCount }, (_, index) => ids[index] || "");

  const updateLevel = (index, employeeId) => {
    const next = [...ids];
    if (employeeId) {
      if (index < next.length) next[index] = employeeId;
      else next.push(employeeId);
    } else if (index < next.length) {
      next.splice(index, 1);
    }
    setBranchEscalationChain(companyId, row.stationId, next);
    if (employeeId) {
      const employee = (data?.employees || []).find((item) => String(item.id) === String(employeeId));
      toast({
        description: ar
          ? `${row.stationName} · تصعيد ${index + 1}: ${employee?.name || "—"}`
          : `${row.stationName} · level ${index + 1}: ${employee?.name || "—"}`,
      });
    }
  };

  return (
    <div
      style={{
        padding: "14px 16px",
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ArrowUpCircle style={{ width: 16, height: 16, color: NAVY, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{row.stationName}</span>
          {row.customized && (
            <span style={{ fontSize: 10, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 999, padding: "2px 8px" }}>
              {ar ? "مخصص" : "Custom"}
            </span>
          )}
          {isCompanyRootStation(row.station) && (
            <span style={{ fontSize: 10, color: MUTED }}>{ar ? "المقر" : "HQ"}</span>
          )}
        </div>
        {canWrite ? (
          <button
            type="button"
            style={orgBtnGhost}
            onClick={() => onAdvanced(row.stationId)}
          >
            {ar ? "تخصيص متقدم" : "Advanced"}
          </button>
        ) : null}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
          marginTop: 12,
        }}
      >
        {slots.map((value, index) => (
          <label key={`${row.stationId}-${index}`} style={{ display: "block", minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 10, fontWeight: 600, color: MUTED, marginBottom: 4 }}>
              {index >= ids.length
                ? (ar ? `مستوى جديد · تصعيد ${index + 1}` : `New level · ${index + 1}`)
                : (ar ? `تصعيد ${index + 1}` : `Level ${index + 1}`)}
            </span>
            <select
              value={value}
              disabled={!canWrite}
              onChange={(event) => updateLevel(index, event.target.value)}
              style={{ ...orgSelect, width: "100%", height: 36 }}
            >
              <option value="">{ar ? "— اختر موظفًا —" : "— Choose employee —"}</option>
              {groups.map((group) => (
                <optgroup key={group.id} label={group.label}>
                  {group.employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        ))}
      </div>

      {row.chain.length > 0 && (
        <p style={{ margin: "10px 0 0", fontSize: 11, color: MUTED, lineHeight: 1.65 }}>
          {ar ? "السلسلة الحالية: " : "Current chain: "}
          {row.chain.map((step, idx) => {
            const shared = sharedEscalationLabel(
              escalationStationsForEmployee(step.employeeId, data).length,
              ar,
              idx + 1,
            );
            const label = shared || (ar ? `تصعيد ${idx + 1}` : `Level ${idx + 1}`);
            return (
              <span key={`${step.employeeId}-${idx}`}>
                {idx > 0 ? (ar ? " ← " : " → ") : null}
                <strong style={{ color: NAVY }}>{step.name}</strong>
                {` (${label})`}
              </span>
            );
          })}
        </p>
      )}
    </div>
  );
}

export default function OrgEscalationBoard({ lang = "ar", canWrite = false }) {
  const ar = lang === "ar";
  const { data, company } = useAuth();
  const [escalationEdit, setEscalationEdit] = useState(null);
  const [assignForStation, setAssignForStation] = useState(null);

  const stations = useMemo(
    () => workplaceStations(data?.stations || []),
    [data?.stations],
  );

  const groups = useMemo(() => employeeGroups(data, ar), [data, ar]);

  const branchRows = useMemo(() => stations.map((station) => {
    const stationId = String(station.id || station.stationId || "");
    return {
      station,
      stationId,
      stationName: station.name || stationId,
      chain: deriveBranchEscalationChain(stationId, data),
      customized: manualBranchEscalationIds(stationId, data) !== null,
    };
  }), [stations, data]);

  const hqHandlers = useMemo(() => {
    const hqId = companyRootStation(data?.stations || [])?.id;
    if (!hqId) return [];
    const hqEmployees = new Set(
      (data?.employees || [])
        .filter((employee) => String(employee.stationId) === String(hqId))
        .map((employee) => String(employee.id)),
    );
    const handlers = [];
    for (const employee of data?.employees || []) {
      const eid = String(employee.id);
      if (!hqEmployees.has(eid)) continue;
      const covers = escalationStationsForEmployee(eid, data).filter((sid) => sid !== String(hqId));
      if (covers.length) handlers.push({ employee, covers });
    }
    return handlers;
  }, [data]);

  const stationName = (stationId) => (
    stations.find((station) => String(station.id) === String(stationId))?.name || stationId
  );

  return (
    <OrgPanel ar={ar}>
      <OrgToolbar>
        {canWrite ? (
          <button
            type="button"
            style={{ ...orgBtnPrimary(), display: "inline-flex", alignItems: "center" }}
            onClick={() => setAssignForStation(stations[0]?.id || "")}
          >
            <Plus style={{ width: 14, height: 14, marginInlineEnd: 6 }} />
            {ar ? "مسؤول واحد لعدة فروع" : "One handler · many branches"}
          </button>
        ) : null}
      </OrgToolbar>

      {!canWrite ? (
        <OrgNotice ar={ar}>
          {ar
            ? "العرض فقط — التعديل متاح للمالك ومدير العمليات والموارد البشرية."
            : "Read-only — editing is for owner, ops, and HR leads."}
        </OrgNotice>
      ) : null}

      {hqHandlers.length > 0 && (
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${BORDER}`, background: CARD }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: NAVY, marginBottom: 8 }}>
            {ar ? "موظفو المقر — مسؤولو تصعيد" : "HQ staff — escalation handlers"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {hqHandlers.map(({ employee, covers }) => (
              <div key={employee.id} style={{ fontSize: 12, color: MUTED, lineHeight: 1.65 }}>
                <strong style={{ color: NAVY }}>{employee.name}</strong>
                {" · "}
                {ar ? "يمسك: " : "covers: "}
                {covers.map((sid) => stationName(sid)).join(ar ? "، " : ", ")}
              </div>
            ))}
          </div>
        </div>
      )}

      {branchRows.length === 0 ? (
        <div style={{ padding: "28px 16px", textAlign: "center", fontSize: 13, color: MUTED }}>
          {ar ? "لا فروع بعد — أضف فروعًا من تبويب المكان أولًا." : "No branches yet — add branches in the Place tab first."}
        </div>
      ) : (
        branchRows.map((row) => (
          <BranchEscalationRow
            key={row.stationId}
            row={row}
            data={data}
            companyId={company?.id}
            ar={ar}
            canWrite={canWrite}
            groups={groups}
            onAdvanced={(stationId) => setAssignForStation(stationId)}
          />
        ))
      )}

      <div style={{ padding: "12px 16px", fontSize: 11, color: MUTED, lineHeight: 1.65 }}>
        {ar ? "صندوق المهام المصعّدة: " : "Escalated task inbox: "}
        <Link to="/app/escalation" style={{ color: NAVY, fontWeight: 600 }}>
          {ar ? "نظام التصعيد" : "Escalation system"}
        </Link>
      </div>

      {escalationEdit && company?.id ? (
        <EscalationCoverageDialog
          employeeId={escalationEdit.employeeId}
          stationId={escalationEdit.stationId}
          level={escalationEdit.level}
          data={data}
          companyId={company.id}
          ar={ar}
          onClose={() => setEscalationEdit(null)}
        />
      ) : null}

      {assignForStation && company?.id ? (
        <AssignEscalationDialog
          stationId={assignForStation}
          data={data}
          companyId={company.id}
          ar={ar}
          onClose={() => setAssignForStation(null)}
        />
      ) : null}
    </OrgPanel>
  );
}
