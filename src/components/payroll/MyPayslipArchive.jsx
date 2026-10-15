import React from "react";
import { Printer } from "lucide-react";
import RecordSmartArchive from "@/components/shared/RecordSmartArchive";
import { slipRows } from "@/components/payroll/PayrollSlipBoard";
import { lineComponents } from "@/lib/payrollDerivations";
import { moneySar } from "@/lib/employeeFileView";
import { printSheet } from "@/lib/printSheet";

/**
 * أرشيف قسيمتي — the person's own line from every month's run, newest first, in the shared archive:
 * each month with its status, gross, deductions and net; open it for every line with its source,
 * print it as a slip, export the year to a spreadsheet.
 */

const MONO = { fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums", direction: "ltr", unicodeBidi: "isolate" };

function monthName(month, ar) {
  return new Date(`${month}-01T12:00:00`).toLocaleDateString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { month: "long", year: "numeric" });
}

function statusOf(run, line, ar) {
  if (line.paid) return ar ? "مدفوع" : "Paid";
  if (run.status === "sent") return ar ? "أُرسل مدى" : "Mudad sent";
  if (run.status === "approved") return ar ? "معتمد" : "Approved";
  return ar ? "قيد التجهيز" : "In preparation";
}

/** One archive row per month the person has a line in. */
export function payslipArchiveItems(runs = [], employeeIds = [], ar = true) {
  const ids = new Set(employeeIds.filter(Boolean).map(String));
  return (runs || [])
    .filter((run) => /^\d{4}-\d{2}$/.test(String(run?.month || "")))
    .map((run) => ({ run, line: (run.items || []).find((item) => ids.has(String(item.employeeId))) }))
    .filter((x) => x.line)
    .sort((a, b) => String(b.run.month).localeCompare(String(a.run.month)))
    .map(({ run, line }) => {
      const parts = lineComponents(line);
      const gross = parts.base + parts.allowances + parts.bonus + (Number(parts.overtimePay) || 0);
      const withheld = (Number(parts.deductions) || 0) + (Number(parts.gosiEmployee) || 0) + (Number(parts.injuryCut) || 0) + (Number(parts.sickCut) || 0);
      const [y, m] = run.month.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      return {
        id: `${run.month}-${line.employeeId}`,
        month: run.month,
        title: ar ? `قسيمة ${monthName(run.month, ar)}` : `${monthName(run.month, ar)} payslip`,
        badge: statusOf(run, line, ar),
        date: line.paidAt || line.settledAt || `${run.month}-${String(lastDay).padStart(2, "0")}T12:00:00`,
        text: ar
          ? `الإجمالي ${moneySar(gross, ar)} · الخصومات ${moneySar(withheld, ar)} · الصافي ${moneySar(parts.net, ar)}`
          : `Gross ${moneySar(gross, ar)} · Withheld ${moneySar(withheld, ar)} · Net ${moneySar(parts.net, ar)}`,
        search: run.month,
        gross,
        withheld,
        net: parts.net,
        run,
        line,
        parts,
      };
    });
}

export default function MyPayslipArchive({ employee, employeeIds = [], runs = [], ar = true, lang = "ar", companyName = "" }) {
  const items = payslipArchiveItems(runs, [employee?.id, ...employeeIds], ar);
  const year = String(new Date().getFullYear());
  const yearNet = items.filter((it) => it.month.startsWith(year)).reduce((s, it) => s + it.net, 0);

  const sheetFor = (it) => {
    const rows = slipRows(it.line, employee, it.parts, ar, it.month);
    return {
      kicker: ar ? "قسيمتي · من المسير" : "My payslip · from the run",
      title: employee?.name || it.line.employeeName || "—",
      subtitle: monthName(it.month, ar),
      ref: `${it.month}-${employee?.profile?.employeeNumber || employee?.id || it.line.employeeId}`,
      company: companyName,
      status: { label: it.badge, tone: it.line.paid ? "ok" : "warn" },
      facts: [
        { label: ar ? "الإجمالي" : "Gross", value: moneySar(it.gross, ar), mono: true },
        { label: ar ? "الخصومات" : "Withheld", value: moneySar(it.withheld, ar), mono: true },
        { label: ar ? "الصافي" : "Net", value: moneySar(it.net, ar), mono: true },
      ],
      blocks: [{
        type: "table",
        heading: ar ? "البنود" : "Lines",
        cols: [ar ? "البند" : "Line", ar ? "المبلغ" : "Amount", ar ? "المصدر" : "Source"],
        monoCols: [1],
        nowrapCols: [1],
        rows: rows.map((r) => [r.label, r.info ? r.valueText : r.blocked ? "—" : `${r.minus ? "- " : ""}${moneySar(r.amount, ar)}`, r.source || ""]),
      }],
      note: ar ? "الأرقام من بند المسير لذلك الشهر — المعتمد منه ثابت لا يتغيّر بتعديل الملف لاحقاً. يُدفع الأجر عبر حماية الأجور (المادة 90)." : "Figures from that month's run line — once settled they do not change with later file edits. Paid through wage protection (Art. 90).",
    };
  };

  return (
    <RecordSmartArchive
      items={items}
      lang={lang}
      dir={ar ? "rtl" : "ltr"}
      kicker={ar ? "قسيمتي" : "My payslip"}
      title={ar ? "أرشيف قسيمتي" : "My payslip archive"}
      subtitle={ar ? "قسيمة كل شهر من المسير — افتح الشهر لبنوده ومصادرها، واطبعه، أو صدّر السنة." : "Every month's slip from the run — open a month for its lines and sources, print it, or export the year."}
      exportName={ar ? "أرشيف-قسيمتي" : "my-payslips"}
      searchPlaceholder={ar ? "ابحث بالشهر أو السنة…" : "Search by month or year…"}
      emptyLabel={ar ? "لا قسائم بعد — تظهر هنا قسيمة كل شهر يُجهَّز فيه المسير." : "No payslips yet — each month's slip appears here once its run is prepared."}
      meta={items.length ? (
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <strong style={{ ...MONO, fontSize: 15, color: "#F3E3BC" }}>{moneySar(yearNet, ar)}</strong>
          <span style={{ fontSize: 11 }}>{ar ? `صافي ${year}` : `${year} net`}</span>
        </span>
      ) : null}
      printRecord={(it) => sheetFor(it)}
      renderOpen={(it) => {
        const rows = slipRows(it.line, employee, it.parts, ar, it.month);
        return (
          <div data-payslip-month={it.month} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, border: "1px solid var(--nv-line)", borderRadius: 10, overflow: "hidden" }}>
              {rows.map((r) => (
                <li key={r.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, padding: "9px 12px", borderBottom: "1px solid var(--nv-line2, #EEF1EF)", alignItems: "center" }}>
                  <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <strong style={{ fontSize: 12.5, color: "var(--nv-ink)" }}>{r.label}</strong>
                    {r.source ? <span style={{ fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.6 }}>{r.source}</span> : null}
                  </span>
                  <span style={{ ...MONO, ...(r.info ? { fontFamily: "inherit", whiteSpace: "nowrap" } : null), fontSize: 12.5, fontWeight: 700, color: r.info ? "var(--nv-ok-ink, #2F6B43)" : r.minus ? "var(--nv-bad-ink)" : "var(--nv-ink)" }}>{r.info ? r.valueText : r.blocked ? "—" : `${r.minus ? "- " : ""}${moneySar(r.amount, ar)}`}</span>
                </li>
              ))}
              <li style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, padding: "10px 12px", background: "var(--nv-ok-soft)", alignItems: "center" }}>
                <strong style={{ fontSize: 13, color: "#0B3D27" }}>{ar ? "الصافي" : "Net"}</strong>
                <strong style={{ ...MONO, fontSize: 14, color: "#0B3D27" }}>{moneySar(it.net, ar)}</strong>
              </li>
            </ol>
            <button
              type="button"
              data-payslip-archive-print={it.month}
              onClick={() => printSheet({ ar, ...sheetFor(it) })}
              style={{ fontFamily: "inherit", alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 12px", borderRadius: 9, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: "#0B3D27", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              <Printer size={14} aria-hidden />
              {ar ? "طباعة قسيمة الشهر" : "Print this month's slip"}
            </button>
          </div>
        );
      }}
    />
  );
}
