import React from "react";
import { toast } from "@/components/ui/use-toast";
import { assignBranchHrManager, clearBranchHrManager, listBranchHrManagers } from "@/lib/orgHire";
import { fieldBranchesForHr, HR_SPAN_MAX, isHrDirector, isRegionalHr, servedStationIds } from "@/lib/hrTree";

const BOX = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: "10px 12px",
  border: "1px solid #DFE3EA",
  borderRadius: 10,
  fontSize: 11.5,
  lineHeight: 1.7,
};

/**
 * Regional HR card: which branches this person serves.
 * The solid line is the tree parent. These checks are the dotted line.
 */
export default function HrServesPanel({ employee, data, companyId, ar = true, canWrite = false }) {
  if (!employee?.id) return null;
  const director = isHrDirector(employee, data);
  const regional = isRegionalHr(employee, data) || listBranchHrManagers(data).some((item) => String(item.id) === String(employee.id));
  if (!director && !regional) return null;

  if (director) {
    return (
      <div style={BOX}>
        <strong>{ar ? "خط ثابت إلى الرئيس التنفيذي" : "Solid line to the CEO"}</strong>
        <span style={{ color: "#6B7280" }}>
          {ar
            ? "التعيين والنقل والتكليف والسجل. مسؤول الالتزام ومسؤول الرواتب والعقود تحت هذا المنصب، لا تحت مدير إقليمي."
            : "Hiring, transfer, assignment, and the record. Compliance and payroll sit here, not under a regional manager."}
        </span>
      </div>
    );
  }

  const served = new Set(servedStationIds(data, employee.id));
  const branches = fieldBranchesForHr(data);
  const toggle = (stationId, on) => {
    if (!canWrite || !companyId) return;
    const result = on
      ? assignBranchHrManager(companyId, stationId, employee.id)
      : clearBranchHrManager(companyId, stationId);
    if (!result.ok) {
      const text = result.error === "HR_SPAN"
        ? (ar ? "ثلاثة فروع كحد أقصى لهذا المدير." : "Three branches is the limit for this manager.")
        : (ar ? "تعذّر تحديث الفروع التي يخدمها." : "Could not update the branches served.");
      toast({ description: text });
      return;
    }
    toast({
      description: on
        ? (ar ? "رُبط الفرع بخط متقطع للتنسيق والجدول." : "Branch linked with a dotted coordination line.")
        : (ar ? "أُزيل الفرع من نطاق هذا المدير." : "Branch removed from this manager."),
    });
  };

  return (
    <div style={BOX}>
      <strong>{ar ? `فروع يخدمها · ${served.size} من ${HR_SPAN_MAX}` : `Branches served · ${served.size} of ${HR_SPAN_MAX}`}</strong>
      <span style={{ color: "#6B7280" }}>
        {ar
          ? "الخط الثابت إلى مديرة الموارد البشرية: التعيين والنقل والتكليف والسجل. الخط المتقطع إلى مدير الفرع: التنسيق والجدول. مدير الفرع يعتمد الجدول."
          : "Solid line to the HR director for hiring and the record. Dotted line to the branch manager for the roster. The branch manager approves the roster."}
      </span>
      {branches.map((station) => {
        const on = served.has(String(station.id));
        const disabled = !canWrite || (!on && served.size >= HR_SPAN_MAX);
        return (
          <label key={station.id} style={{ display: "flex", alignItems: "center", gap: 8, color: disabled && !on ? "#9AA398" : "#111418" }}>
            <input
              type="checkbox"
              checked={on}
              disabled={disabled}
              onChange={(event) => toggle(station.id, event.target.checked)}
            />
            <span>{station.name || "—"}</span>
          </label>
        );
      })}
    </div>
  );
}
