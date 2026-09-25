import React, { useRef, useState } from "react";
import { Download, FileUp, Loader2, Check, X, AlertTriangle } from "lucide-react";
import { downloadPayrollTemplate } from "@/lib/payrollTemplate";
import { extractSalaryRows, matchRowsToEmployees, applySalaryImport } from "@/lib/salaryImport";
import { ACCENT, MUTED, NAVY, DANGER, ui, SURFACE } from "@/lib/platformStyles";

const matchRow = {
  display: "grid",
  gridTemplateColumns: "minmax(140px,1.4fr) minmax(120px,1fr) 88px",
  gap: "12px",
  padding: "12px 18px",
  borderBottom: "1px solid #F1F5F9",
  alignItems: "center",
};

export default function PayrollTemplateCard({ company, data, employees, month, ar }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [matches, setMatches] = useState(null);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setMatches(null);
    setApplied(false);
    try {
      const rows = await extractSalaryRows(file);
      if (!rows.length) {
        setError(ar ? "لم يتم العثور على صفوف رواتب في الملف — استخدم قالب هذا الشهر." : "No salary rows found in the file — use this month's template.");
      } else {
        setMatches(matchRowsToEmployees(rows, employees || []));
      }
    } catch {
      setError(ar ? "تعذّرت قراءة الملف، حاول مجددًا." : "Couldn't read the file, please try again.");
    }
    setBusy(false);
  };

  const apply = () => {
    applySalaryImport(company.id, month, matches);
    setApplied(true);
    setTimeout(() => setMatches(null), 2000);
  };

  const matchedCount = (matches || []).filter((m) => m.employee).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => downloadPayrollTemplate(data, month, ar, employees)}
              style={{ ...ui.btnPrimary, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Download style={{ width: 14, height: 14 }} strokeWidth={1.75} />
              {ar ? "تنزيل القالب" : "Download template"}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.csv"
              style={{ display: "none" }}
              onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }}
            />
            <button
              type="button"
              className="nv-attach nv-attach--inline"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              {busy
                ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
                : <FileUp style={{ width: 14, height: 14 }} strokeWidth={1.75} />}
              {busy ? (ar ? "جارٍ القراءة…" : "Reading…") : (ar ? "رفع الملف" : "Upload file")}
            </button>
      </div>
        {error && (
          <p style={{ margin: 0, fontSize: 12, color: DANGER, display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} /> {error}
          </p>
        )}

      {matches && (
        <div>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 520 }}>
              <div style={{ ...matchRow, background: SURFACE, borderBottom: "1px solid #E2E8F0", fontSize: 10, letterSpacing: "0.06em", color: MUTED, fontWeight: 600, padding: "11px 18px" }}>
                <div>{ar ? "الموظف" : "Employee"}</div>
                <div>{ar ? "المطابقة" : "Match"}</div>
                <div>{ar ? "المبلغ" : "Amount"}</div>
              </div>
              <div style={{ maxHeight: 260, overflowY: "auto" }}>
                {matches.map(({ row, employee }, idx) => (
                  <div key={idx} style={{ ...matchRow, borderBottom: idx < matches.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.name || row.email}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: employee ? NAVY : DANGER }}>
                      {employee
                        ? <Check style={{ width: 14, height: 14, color: ACCENT, flexShrink: 0 }} strokeWidth={2} />
                        : <X style={{ width: 14, height: 14, color: DANGER, flexShrink: 0 }} strokeWidth={2} />}
                      {employee
                        ? employee.name
                        : (ar ? "بدون مطابقة" : "No match")}
                    </div>
                    <div dir="ltr" style={{ fontSize: 12, fontWeight: 600, color: NAVY, fontFamily: "'IBM Plex Sans',sans-serif", textAlign: "end" }}>
                      {(Number(row.base_salary) || 0).toLocaleString("en-US")}
                      {Number(row.allowances) > 0 ? ` +${Number(row.allowances).toLocaleString("en-US")}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "12px 0" }}>
            <button
              type="button"
              onClick={apply}
              disabled={matchedCount === 0 || applied}
              style={{
                ...ui.btnPrimary,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                opacity: matchedCount === 0 || applied ? 0.45 : 1,
                cursor: matchedCount === 0 || applied ? "not-allowed" : "pointer",
              }}
            >
              <Check style={{ width: 14, height: 14 }} strokeWidth={1.75} />
              {applied
                ? (ar ? "طُبّق على المسير" : "Applied to the run")
                : (ar ? `تطبيق على ${matchedCount} موظف` : `Apply to ${matchedCount} employees`)}
            </button>
            <button type="button" onClick={() => setMatches(null)} style={ui.btnGhost}>
              {ar ? "إلغاء" : "Cancel"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
