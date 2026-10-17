import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Building2, ChevronDown, Loader2 } from "lucide-react";
import OwnerExportButtons from "@/components/owner/OwnerExportButtons";

const metricLabels = (ar) => [
  ["employees", ar ? "الموظفون" : "Employees"], ["completedTasks", ar ? "مهام الشهر" : "Tasks this month"],
  ["attendanceRate", ar ? "الحضور" : "Attendance"], ["loginSessions", ar ? "جلسات 30 يوم" : "30-day logins"],
  ["signedDocuments", ar ? "مستندات موقعة" : "Signed docs"], ["feedbackCount", ar ? "التقييمات" : "Feedback"],
];

export default function PlatformReportDashboard({ ar }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { base44.functions.invoke("subscriptionOverview", { action: "platformReport" }).then((res) => setRows(res.data.companies || [])); }, []);
  if (!rows) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#1E9E63]" /></div>;
  const totals = rows.reduce((sum, row) => ({ employees: sum.employees + row.employees, signed: sum.signed + row.signedDocuments, logins: sum.logins + (row.loginSessions || 0) }), { employees: 0, signed: 0, logins: 0 });
  const reportHeaders = [ar ? "الشركة" : "Company", ar ? "الباقة" : "Plan", ...metricLabels(ar).map(([, label]) => label), ar ? "متوسط التقييم" : "Average rating"];
  const reportRows = rows.map((row) => [row.companyName, row.plan, ...metricLabels(ar).map(([key]) => key === "attendanceRate" ? `${row[key]}%` : row[key]), row.averageRating || "—"]);
  return <div className="space-y-5">
    <OwnerExportButtons filename="powercare_platform_report" title={ar ? "تقرير أداء المنصة" : "Platform performance report"} headers={reportHeaders} rows={reportRows} ar={ar} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[[ar ? "الشركات" : "Companies", rows.length], [ar ? "الموظفون" : "Employees", totals.employees], [ar ? "المستندات الموقعة" : "Signed documents", totals.signed], [ar ? "جلسات 30 يوم" : "30-day logins", totals.logins]].map(([label, value]) => <div key={label} className="rounded-2xl bg-card p-4 shadow-sm"><p className="text-3xl font-semibold text-foreground">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}</div>
    <div className="space-y-2">{rows.map((row) => <details key={row.companyId} className="group rounded-2xl border border-border bg-card shadow-sm"><summary className="flex cursor-pointer list-none items-center gap-3 p-4"><Building2 className="h-5 w-5 text-[#1E9E63]" /><span className="font-semibold">{row.companyName}</span><span className="ms-auto text-xs text-muted-foreground">{row.plan}</span><ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></summary><div className="grid grid-cols-2 gap-px border-t border-border bg-border md:grid-cols-4">{metricLabels(ar).map(([key, label]) => <div key={key} className="bg-card p-4"><p className="text-xl font-semibold">{key === "attendanceRate" ? `${row[key]}%` : row[key]}</p><p className="text-[11px] text-muted-foreground">{label}</p></div>)}<div className="bg-card p-4"><p className="text-xl font-semibold">{row.averageRating || "—"}</p><p className="text-[11px] text-muted-foreground">{ar ? "متوسط التقييم" : "Average rating"}</p></div></div></details>)}</div>
  </div>;
}