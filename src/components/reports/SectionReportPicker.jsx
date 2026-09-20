import React, { useEffect, useState } from "react";
import { FileDown, X } from "lucide-react";
import { useAuth } from "@/lib/PowerCareAuth";
import useStationScope from "@/hooks/useStationScope";
import { buildLibraryReport, visibleSectionReports } from "@/lib/reportLibraryExport";
import { collectSectionReportData, safeReportFilename } from "@/lib/collectSectionReport";
import { exportExcelColored } from "@/lib/exportExcelColored";
import { printReport } from "@/lib/printReport";
import { brandReportColor, PDF_THEME } from "@/lib/pdfTheme";
import { toast } from "@/components/ui/use-toast";
import Logo from "@/components/Logo";
import {
  ACCENT, BORDER, CARD, MUTED, NAVY, SURFACE,
  dialogCard, dialogOverlay, field, labelMuted, ui,
} from "@/lib/platformStyles";
import PlatformDateField from "@/components/shared/PlatformDateField";

function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthStart(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const FORMAT_BTN = (active) => ({
  flex: 1,
  height: 38,
  borderRadius: 9,
  border: `1px solid ${active ? ACCENT : BORDER}`,
  background: active ? "var(--nv-accent-soft, #E8F6EE)" : CARD,
  color: active ? ACCENT : NAVY,
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
});

export default function SectionReportPicker({ lang = "ar" }) {
  const ar = lang === "ar";
  const { company, currentUser, data, session } = useAuth();
  const stationScope = useStationScope();
  const options = visibleSectionReports(currentUser, data, company);
  const [open, setOpen] = useState(false);
  const [pickedId, setPickedId] = useState(() => options[0]?.id || "attendance");
  const [format, setFormat] = useState("xlsx");
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(isoToday);
  const [busy, setBusy] = useState(false);
  const picked = options.find((item) => item.id === pickedId) || options[0];

  useEffect(() => {
    if (options.length && !options.some((item) => item.id === pickedId)) {
      setPickedId(options[0].id);
    }
  }, [options.map((item) => item.id).join("|"), pickedId]);

  useEffect(() => {
    if (picked?.format === "pdf") setFormat("pdf");
    else if (picked?.format) setFormat("xlsx");
  }, [picked?.id]);

  if (!options.length) return null;

  const stationLabel = stationScope !== "all"
    ? (data?.stations?.find((s) => s.id === stationScope)?.name || stationScope)
    : (ar ? "كل الفروع" : "All stations");

  const applyRange = (from, to) => {
    setDateFrom(from);
    setDateTo(to);
  };

  const download = async () => {
    if (!picked || !company?.id) return;
    if (dateFrom && dateTo && dateFrom > dateTo) {
      toast({
        title: ar ? "تاريخ البداية بعد تاريخ النهاية." : "Start date is after the end date.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const employees = (data?.employees || []).filter((e) => {
        if (!e?.id) return false;
        if (!stationScope || stationScope === "all") return true;
        return (e.stationId || e.station_id) === stationScope;
      });
      const live = await collectSectionReportData({
        companyId: company.id,
        session,
        data: {
          ...data,
          attendanceSettings: data?.attendanceSettings || company?.attendanceSettings || {},
        },
        employees,
        dateFrom,
        dateTo,
      });
      const built = buildLibraryReport({
        reportId: picked.id,
        dateFrom,
        dateTo,
        data: {
          ...live,
          attendanceSettings: live.attendanceSettings || company?.attendanceSettings || {},
        },
        companyId: company.id,
        employees,
        stationScope,
        lang: ar ? "ar" : "en",
        auditLogs: [],
      });
      const branding = live?.reportBranding || data?.reportBranding || {};
      const color = brandReportColor(branding.color || PDF_THEME.navy);
      const companyName = company?.name || data?.name || "";
      const rangeLabel = dateFrom && dateTo ? `${dateFrom}_${dateTo}` : (dateFrom || dateTo || "report");
      if (!built) throw new Error(ar ? "تعذّر بناء التقرير." : "Could not build the report.");
      const rows = built.rows?.length
        ? built.rows
        : [[ar ? "لا بيانات في هذه الفترة — وسّعوا التاريخ أو غيّروا الفرع." : "No rows in this period — widen the dates or change station."]];
      const fileBase = safeReportFilename(`${picked.id}_${rangeLabel}`);
      const reportSections = built.sections?.length
        ? built.sections
        : [{ heading: built.title, headers: built.headers, rows }];
      if (format === "pdf") {
        const opened = printReport({
          title: built.title,
          companyName,
          periodLabel: built.periodLabel,
          dir: ar ? "rtl" : "ltr",
          stats: built.stats,
          logoUrl: branding.logoUrl || "",
          color,
          sections: reportSections,
        });
        toast({
          title: opened
            ? (ar ? `تم الإصدار: ${picked.labelAr}` : `Issued: ${picked.labelEn}`)
            : (ar ? "حُفظ ملف HTML — افتحوه ثم طباعة → حفظ PDF." : "Saved an HTML file — open it, then Print → Save as PDF."),
        });
      } else {
        exportExcelColored({
          filename: fileBase,
          title: built.title,
          headers: built.headers,
          rows,
          color,
          dir: ar ? "rtl" : "ltr",
          companyName,
          logoUrl: branding.logoUrl || "",
        });
        toast({ title: ar ? `تم تنزيل Excel: ${picked.labelAr}` : `Excel downloaded: ${picked.labelEn}` });
      }
      setOpen(false);
    } catch (e) {
      toast({ title: String(e?.message || e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          height: 34,
          padding: "0 12px",
          borderRadius: 10,
          border: `1px solid ${BORDER}`,
          background: CARD,
          color: NAVY,
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "inherit",
          whiteSpace: "nowrap",
        }}
      >
        <FileDown style={{ width: 14, height: 14, color: ACCENT }} strokeWidth={1.75} />
        {ar ? "نزّل تقريراً" : "Download a report"}
      </button>

      {open && (
        <div
          style={dialogOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) setOpen(false);
          }}
        >
          <div
            style={{ ...dialogCard, maxWidth: 480, padding: 0, overflow: "hidden" }}
            dir={ar ? "rtl" : "ltr"}
            role="dialog"
            aria-modal="true"
            aria-labelledby="nv-report-issue-title"
          >
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, background: SURFACE }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      border: `1px solid ${BORDER}`,
                      background: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Logo size={22} wordmark={false} />
                  </span>
                  <div>
                    <h2 id="nv-report-issue-title" style={{ margin: 0, fontSize: 16, fontWeight: 600, color: NAVY }}>
                      {ar ? "إصدار تقرير" : "Issue a report"}
                    </h2>
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: MUTED, lineHeight: 1.65 }}>
                      {ar
                        ? "ملف واحد · الصيغة والفترة من اختياركم · شعار الشركة في الرأس."
                        : "One file · you choose format and dates · company letterhead."}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !busy && setOpen(false)}
                  aria-label={ar ? "إغلاق" : "Close"}
                  style={{ ...ui.btnGhost, padding: 6 }}
                >
                  <X style={{ width: 16, height: 16 }} />
                </button>
              </div>
            </div>

            <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <label>
                <span style={labelMuted}>{ar ? "نوع التقرير" : "Report"}</span>
                <select
                  value={picked?.id || ""}
                  onChange={(e) => setPickedId(e.target.value)}
                  style={{ ...field, width: "100%" }}
                >
                  {options.map((item) => (
                    <option key={item.id} value={item.id}>
                      {ar ? item.labelAr : item.labelEn}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <span style={labelMuted}>{ar ? "الصيغة" : "Format"}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => setFormat("xlsx")} style={FORMAT_BTN(format === "xlsx")}>
                    Excel
                  </button>
                  <button type="button" onClick={() => setFormat("pdf")} style={FORMAT_BTN(format === "pdf")}>
                    PDF
                  </button>
                </div>
              </div>

              <div>
                <span style={labelMuted}>{ar ? "الفترة" : "Period"}</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label>
                    <span style={{ ...labelMuted, marginBottom: 4 }}>{ar ? "من" : "From"}</span>
                    <PlatformDateField ar={ar} value={dateFrom} onChange={setDateFrom} />
                  </label>
                  <label>
                    <span style={{ ...labelMuted, marginBottom: 4 }}>{ar ? "إلى" : "To"}</span>
                    <PlatformDateField ar={ar} value={dateTo} min={dateFrom} onChange={setDateTo} />
                  </label>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {[
                    { id: "month", label: ar ? "هذا الشهر" : "This month", from: monthStart(), to: isoToday() },
                    { id: "7", label: ar ? "آخر 7 أيام" : "Last 7 days", from: daysAgo(6), to: isoToday() },
                    { id: "today", label: ar ? "اليوم" : "Today", from: isoToday(), to: isoToday() },
                  ].map((chip) => {
                    const on = dateFrom === chip.from && dateTo === chip.to;
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => applyRange(chip.from, chip.to)}
                        style={{
                          height: 28,
                          padding: "0 10px",
                          borderRadius: 20,
                          border: `1px solid ${on ? ACCENT : BORDER}`,
                          background: on ? "var(--nv-accent-soft, #E8F6EE)" : CARD,
                          color: on ? ACCENT : MUTED,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <p style={{ margin: 0, fontSize: 11, color: MUTED }}>
                {ar ? `النطاق: ${stationLabel}` : `Scope: ${stationLabel}`}
              </p>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 20px", borderTop: `1px solid ${BORDER}` }}>
              <button type="button" onClick={() => setOpen(false)} disabled={busy} style={ui.btnSecondary}>
                {ar ? "إلغاء" : "Cancel"}
              </button>
              <button type="button" onClick={download} disabled={busy || !picked} style={{ ...ui.btnPrimary, opacity: busy ? 0.6 : 1 }}>
                {busy
                  ? "…"
                  : format === "pdf"
                    ? (ar ? "تنزيل PDF" : "Download PDF")
                    : (ar ? "تنزيل Excel" : "Download Excel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
