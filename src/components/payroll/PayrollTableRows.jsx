import React from "react";
import { AlertCircle, MapPin } from "lucide-react";
import PayrollRow from "@/components/payroll/PayrollRow";
import { ACCENT, MUTED, NAVY, BORDER, SURFACE } from "@/lib/platformStyles";

export default function PayrollTableRows({ items, stations, getStationId, employeeForItem, ar, onChange, onTogglePaid, onPayslip, onDeductions }) {
  const groups = stations.map((station) => ({
    id: station.id,
    name: station.name,
    items: items.filter((item) => getStationId(item) === station.id),
  })).filter((group) => group.items.length);
  const unassigned = items.filter((item) => !getStationId(item));
  if (unassigned.length) groups.push({ id: "__unassigned__", name: ar ? "غير مخصص" : "Unassigned", items: unassigned, unassigned: true });

  return groups.map((group) => (
    <React.Fragment key={group.id}>
      <tr style={{
        borderTop: `1px solid ${group.unassigned ? "var(--nv-line)" : BORDER}`,
        borderBottom: `1px solid ${group.unassigned ? "var(--nv-line)" : BORDER}`,
        background: group.unassigned ? "var(--nv-warn-soft)" : SURFACE,
      }}>
        <td colSpan={9} style={{ padding: "12px 16px", textAlign: "start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {group.unassigned
              ? <AlertCircle style={{ width: 16, height: 16, flexShrink: 0, color: "var(--nv-warn-ink)" }} />
              : <MapPin style={{ width: 16, height: 16, flexShrink: 0, color: ACCENT }} />}
            <div>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: NAVY }}>{group.name}</p>
              {group.unassigned && (
                <p style={{ margin: "2px 0 0", fontSize: "11px", fontWeight: 400, color: MUTED }}>
                  {ar ? "موظفون غير مرتبطين بفرع" : "Employees not linked to a station"}
                </p>
              )}
            </div>
          </div>
        </td>
      </tr>
      {group.items.map((item) => (
        <PayrollRow
          key={item.id}
          item={item}
          employee={employeeForItem(item)}
          ar={ar}
          onChange={(field, value) => onChange(item.id, field, value)}
          onTogglePaid={(paid) => onTogglePaid(item, paid)}
          onPayslip={() => onPayslip(item)}
          onDeductions={() => onDeductions(item)}
        />
      ))}
    </React.Fragment>
  ));
}
