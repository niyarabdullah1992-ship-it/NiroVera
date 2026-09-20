import React, { useEffect, useMemo, useState } from "react";
import { Loader2, MessageSquare, Star } from "lucide-react";
import { base44 } from "@/api/base44Client";
import OwnerExportButtons from "@/components/owner/OwnerExportButtons";

export default function ProductFeedbackDashboard({ ar, companies = [] }) {
  const [rows, setRows] = useState(null);
  const [companyId, setCompanyId] = useState("all");
  const [rating, setRating] = useState("all");
  const [accounts, setAccounts] = useState([]);
  useEffect(() => { Promise.all([base44.entities.ProductFeedback.list("-created_date", 500), base44.entities.CompanyAccount.list("-created_date", 500)]).then(([feedback, companyAccounts]) => { setRows(feedback); setAccounts(companyAccounts); }); }, []);
  const names = useMemo(() => Object.fromEntries([...companies.map((company) => [company.id, company.name]), ...accounts.map((account) => [account.companyId, account.name])]), [companies, accounts]);
  if (!rows) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#1E9E63]" /></div>;
  const filtered = rows.filter((row) => (companyId === "all" || row.companyId === companyId) && (rating === "all" || Number(row.rating) === Number(rating)));
  const average = rows.length ? (rows.reduce((sum, row) => sum + row.rating, 0) / rows.length).toFixed(1) : "—";
  const reportHeaders = ar ? ["الشركة", "التقييم", "الدور", "الصفحة", "الملاحظة", "التاريخ"] : ["Company", "Rating", "Role", "Page", "Feedback", "Date"];
  const reportRows = filtered.map((row) => [names[row.companyId] || row.companyId, `${row.rating}/5`, row.role || "—", row.page || "—", row.message || "—", new Date(row.created_date).toLocaleString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB")]);
  return <div className="space-y-5">
    <OwnerExportButtons filename="powercare_feedback_report" title={ar ? "تقرير التقييمات والملاحظات" : "Feedback and comments report"} headers={reportHeaders} rows={reportRows} ar={ar} />
    <div className="grid gap-3 sm:grid-cols-3">{[[ar ? "إجمالي التقييمات" : "Total feedback", rows.length], [ar ? "متوسط التقييم" : "Average rating", average], [ar ? "النتائج المعروضة" : "Visible results", filtered.length]].map(([label, value]) => <div key={label} className="rounded-2xl bg-card p-5 shadow-sm"><p className="flex items-center gap-2 text-3xl font-bold">{value}{label.includes("متوسط") || label.includes("Average") ? <Star className="h-5 w-5 fill-[#1E9E63] text-[#1E9E63]" /> : null}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}</div>
    <div className="flex flex-col gap-2 rounded-2xl bg-card p-3 shadow-sm sm:flex-row"><select value={companyId} onChange={(event) => setCompanyId(event.target.value)} className="rounded-xl border border-border bg-card p-2 text-sm"><option value="all">{ar ? "كل الشركات" : "All companies"}</option>{accounts.map((company) => <option key={company.companyId} value={company.companyId}>{company.name}</option>)}</select><select value={rating} onChange={(event) => setRating(event.target.value)} className="rounded-xl border border-border bg-card p-2 text-sm"><option value="all">{ar ? "كل التقييمات" : "All ratings"}</option>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></div>
    <section className="rounded-2xl bg-card p-5 shadow-sm"><h2 className="flex items-center gap-2 font-heading text-xl font-semibold"><MessageSquare className="h-5 w-5 text-[#1E9E63]" />{ar ? "التقييمات والملاحظات" : "Feedback & comments"}</h2><div className="mt-5 space-y-3">{filtered.map((row) => <article key={row.id} className="rounded-xl border border-border bg-background p-4"><div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="font-bold text-[#1E9E63]">{"★".repeat(row.rating)} {row.rating}/5</span><span>{names[row.companyId] || row.companyId}</span><span>·</span><span>{row.role || "—"}</span><span>·</span><span>{row.page || "—"}</span><span className="ms-auto">{new Date(row.created_date).toLocaleString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB")}</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{row.message || "—"}</p></article>)}{!filtered.length && <p className="py-10 text-center text-sm text-muted-foreground">{ar ? "لا توجد نتائج." : "No matching feedback."}</p>}</div></section>
  </div>;
}