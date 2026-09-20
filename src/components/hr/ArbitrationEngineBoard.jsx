import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { ACCENT, BAD, MUTED, NAVY, NAVY_FILL, OK, WARN, CARD } from "@/lib/platformStyles";
import { ChromeBox } from "@/components/shared/IdentityCard";
import { printReport } from "@/lib/printReport";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import {
  ARBITRATION_DISCLAIMER_AR,
  ARBITRATION_DISCLAIMER_EN,
  arbitrationStatusLabel,
  collectCompanyArbitrationChecks,
  deriveCompliancePorts,
  deriveMhrsdSectorBoard,
  flattenDisputeRequests,
  laborRulesCatalog,
  reviewArbitrationCase,
} from "@/lib/arbitrationEngine";
import { listArbitrationOutcomes } from "@/lib/store";

const BAND = {
  high: { ar: "عالٍ", en: "High", style: OK },
  mid: { ar: "متوسط", en: "Mid", style: WARN },
  low: { ar: "منخفض", en: "Low", style: BAD },
  empty: { ar: "لا فحص بعد", en: "No check yet", style: { color: MUTED } },
};

export default function ArbitrationEngineBoard() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { company, data, currentUser } = useAuth();
  const manager = ["owner", "director", "ops_manager", "hr", "admin", "pgm"].includes(currentUser?.role)
    || currentUser?.owner || currentUser?.admin;

  const catalog = useMemo(() => laborRulesCatalog(), []);
  const disputes = useMemo(() => flattenDisputeRequests(data?.employees || []), [data?.employees]);
  const openDisputes = useMemo(
    () => disputes.filter((row) => ["pending", "pending_manager", "pending_employee"].includes(row.status)),
    [disputes],
  );
  const checks = useMemo(() => collectCompanyArbitrationChecks({
    employees: data?.employees || [],
    schedules: data?.schedules || [],
    company: data,
    payrollLines: (data?.payrollRuns || []).flatMap((run) => run.lines || run.items || []),
    laborCalendar: data?.laborCalendar,
    safety: data?.safety || [],
    disciplinaryCases: data?.disciplinaryCases || [],
  }), [data]);
  const board = useMemo(() => deriveMhrsdSectorBoard(checks), [checks]);
  const score = board.overall;
  const ports = useMemo(() => deriveCompliancePorts({
    qiwa: false,
    gosi: false,
    mudad: false,
    nafath: false,
  }), []);
  const outcomes = useMemo(
    () => (company?.id ? listArbitrationOutcomes(company.id, {
      audience: manager ? "manager" : "employee",
      employeeId: currentUser?.id || currentUser?.employeeId,
    }) : []),
    [company?.id, manager, currentUser, data?.arbitrationOutcomes],
  );
  const liveReviews = useMemo(
    () => openDisputes.slice(0, 8).map((row) => ({
      row,
      review: reviewArbitrationCase({
        kind: row.kind,
        request: row.request,
        employee: row.employee,
        company: data,
        laborCalendar: data?.laborCalendar,
      }),
    })),
    [openDisputes, data],
  );
  const band = BAND[score.band] || BAND.empty;

  const exportInspector = () => {
    printReport({
      title: ar ? "تقرير حكم المنصة" : "Platform judgment report",
      companyName: company?.name || "",
      periodLabel: new Date().toLocaleDateString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB"),
      dir: ar ? "rtl" : "ltr",
      color: ACCENT,
      stats: [
        { label: ar ? "درجة الامتثال" : "Compliance score", value: score.score == null ? "—" : `${score.score}%` },
        { label: ar ? "فحوصات" : "Checks", value: String(score.total) },
        { label: ar ? "موقوف" : "Blocked", value: String(score.blocked) },
        { label: ar ? "أحكام مختومة" : "Sealed verdicts", value: String(outcomes.length) },
      ],
      sections: [
        {
          heading: ar ? "القطاعات الخمس" : "The five sectors",
          headers: ar
            ? ["القطاع", "الدرجة", "فحوصات", "موقوف", "أعلى سبب"]
            : ["Sector", "Score", "Checks", "Blocked", "Top reason"],
          rows: board.sectors.map((row) => [
            ar ? row.ar : row.en,
            row.score == null ? "—" : `${row.score}%`,
            String(row.total),
            String(row.blocked),
            ar ? (row.topReason || "—") : (row.topReasonEn || row.topReason || "—"),
          ]),
        },
        {
          heading: ar ? "الفحوصات المشتقة" : "Derived checks",
          headers: ar
            ? ["الفحص", "الحالة", "المادة / القرار", "السبب"]
            : ["Check", "State", "Article / decision", "Reason"],
          rows: checks.slice(0, 80).map((row) => [
            row.kind,
            row.ok ? (ar ? "مطابق" : "Match") : (ar ? "موقوف" : "Blocked"),
            row.ruleId || "—",
            ar ? (row.reason || "—") : (row.reasonEn || row.reason || "—"),
          ]),
        },
        {
          heading: ar ? "الأحكام المختومة" : "Sealed verdicts",
          headers: ar
            ? ["الوقت", "النوع", "الحكم", "المادة", "النص"]
            : ["Time", "Kind", "Verdict", "Article", "Text"],
          rows: outcomes.slice(0, 40).map((row) => [
            String(row.observedAt || "").replace("T", " ").slice(0, 19),
            row.kind,
            arbitrationStatusLabel(row.status, ar),
            row.instrumentAr || row.article || row.ruleId || "—",
            ar ? row.reason : (row.reasonEn || row.reason),
          ]),
        },
      ],
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }} dir={ar ? "rtl" : "ltr"}>
      <ChromeBox>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>
              {ar ? "حكم المنصة" : "Platform judgment"}
            </div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 4, maxWidth: 720, lineHeight: 1.7 }}>
              {ar ? ARBITRATION_DISCLAIMER_AR : ARBITRATION_DISCLAIMER_EN}
            </div>
          </div>
          {manager ? (
            <button
              type="button"
              onClick={exportInspector}
              style={{
                height: 38,
                padding: "0 14px",
                borderRadius: 9,
                border: "1px solid #E2E8F0",
                background: CARD,
                color: NAVY,
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {ar ? "تقرير المفتش — PDF" : "Inspector report — PDF"}
            </button>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 26, flexWrap: "wrap", marginTop: 16, paddingTop: 14, borderTop: "1px solid #F1F5F9" }}>
          <div>
            <div dir="ltr" style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 28, fontWeight: 600, color: ACCENT, textAlign: "right" }}>
              {score.score == null ? "—" : `${score.score}%`}
            </div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>{ar ? "درجة الامتثال المشتقة" : "Derived compliance score"}</div>
            <span style={{ ...band.style, display: "inline-block", marginTop: 6, fontSize: 11, fontWeight: 600 }}>
              {ar ? band.ar : band.en}
            </span>
          </div>
          <div>
            <div dir="ltr" style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 20, fontWeight: 600, color: NAVY, textAlign: "right" }}>{catalog.length}</div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>{ar ? "لائحة معتمدة في الكتالوج" : "Adopted catalog rules"}</div>
          </div>
          <div>
            <div dir="ltr" style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 20, fontWeight: 600, color: NAVY, textAlign: "right" }}>{score.blocked}</div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>{ar ? "فحوصات موقوفة الآن" : "Checks blocked now"}</div>
          </div>
          <div>
            <div dir="ltr" style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 20, fontWeight: 600, color: NAVY, textAlign: "right" }}>{outcomes.length}</div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>{ar ? "أحكام مختومة" : "Sealed verdicts"}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 16, borderTop: "1px solid #F1F5F9" }}>
          {board.sectors.map((row) => {
            const empty = row.score == null;
            const tone = empty ? MUTED : (row.blocked ? "#B91C1C" : ACCENT);
            return (
              <div key={row.id} style={{ display: "flex", gap: 12, padding: "10px 0", borderTop: "1px solid #F1F5F9", flexWrap: "wrap", alignItems: "baseline" }}>
                <Link to={row.href} style={{ fontSize: 12, fontWeight: 600, color: NAVY, textDecoration: "none", minWidth: 96 }}>
                  {ar ? row.ar : row.en}
                </Link>
                <span dir="ltr" style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 18, fontWeight: 600, color: tone }}>
                  {empty ? "—" : `${row.score}%`}
                </span>
                <span style={{ fontSize: 11, color: MUTED }}>
                  {empty
                    ? (ar ? "لا فحص في السجل بعد" : "No check on the register yet")
                    : (ar
                      ? `${row.blocked ? `${row.blocked} موقوف` : "مطابق"} · ${row.total} فحص`
                      : `${row.blocked ? `${row.blocked} blocked` : "clear"} · ${row.total} checks`)}
                </span>
                {row.topReason ? (
                  <span style={{ fontSize: 11, color: "#B91C1C", lineHeight: 1.6, flex: "1 1 220px" }}>
                    {ar ? row.topReason : (row.topReasonEn || row.topReason)}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {ports.map((port) => (
            <span
              key={port.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 28,
                padding: "0 11px",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                background: port.live ? "#ECFDF3" : "#F8FAFC",
                border: `1px solid ${port.live ? "#BBF7D0" : "#E2E8F0"}`,
                color: port.live ? "#15803D" : MUTED,
              }}
            >
              {ar ? port.ar : port.en}
              {" · "}
              {port.live ? (ar ? "حي" : "live") : (ar ? "مشتق — منفذ جاهز" : "derived — port ready")}
            </span>
          ))}
        </div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 12, lineHeight: 1.7 }}>
          {ar
            ? "الكلي من مجموع الفحوصات الحية. كل قطاع من فحوصاته فقط — بلا رقم مخزون. المنافذ جاهزة؛ الإرسال الحكومي ينتظر الاعتمادات."
            : "The overall figure is from all live checks. Each sector uses only its own checks — no stored vanity number. Ports are ready; government send waits for credentials."}
        </div>
      </ChromeBox>

      <ChromeBox>
        <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>
          {ar ? "طلبات واعتراضات أمام الحكم" : "Requests and objections before the referee"}
        </div>
        {liveReviews.length === 0 ? (
          <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>
            {ar ? "لا طلب معلّق لفحصه الآن." : "No pending request to review now."}
          </div>
        ) : liveReviews.map(({ row, review }) => (
          <div key={`${row.family}-${row.id}`} style={{ padding: "10px 0", borderTop: "1px solid #F1F5F9" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: NAVY }}>
                {ar ? row.titleAr : row.titleEn} · {row.employeeName}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: review.ok ? "#15803D" : "#B91C1C" }}>
                {arbitrationStatusLabel(review.status, ar)}
              </span>
            </div>
            <div style={{ fontSize: 11, color: "#B91C1C", marginTop: 4, lineHeight: 1.7 }}>
              {ar ? review.reason : review.reasonEn}
            </div>
            {review.ruleId || review.article ? (
              <div style={{ marginTop: 6 }}>
                <LaborArticleCite ruleId={review.ruleId} article={review.article || undefined} ar={ar} />
              </div>
            ) : null}
          </div>
        ))}
        <Link to="/app/requests/manage" style={{ display: "inline-block", marginTop: 10, fontSize: 12, color: NAVY, textDecoration: "none" }}>
          {ar ? "افتح طلباتي الإدارة ←" : "Open management Requests →"}
        </Link>
      </ChromeBox>

      {outcomes.length > 0 ? (
        <ChromeBox>
          <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>
            {ar ? "سجل التحكيم المختوم" : "Sealed arbitration log"}
          </div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 4, lineHeight: 1.65 }}>
            {ar ? "لا يُعدَّل السطر بعد الختم. الفاعل هو النظام." : "A sealed row is not edited. The actor is the system."}
          </div>
          <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none" }}>
            {outcomes.slice(0, 12).map((row) => (
              <li key={row.id} style={{ padding: "8px 0", borderTop: "1px solid #F1F5F9", fontSize: 12, color: NAVY }}>
                <span style={{ fontWeight: 600 }}>{arbitrationStatusLabel(row.status, ar)}</span>
                {" · "}
                <span style={{ color: MUTED }}>{row.instrumentAr || row.ruleId || "—"}</span>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 3, lineHeight: 1.65 }}>
                  {ar ? row.reason : row.reasonEn}
                </div>
              </li>
            ))}
          </ul>
        </ChromeBox>
      ) : null}

      <div style={{ fontSize: 11, color: MUTED }}>
        <span style={{ color: NAVY_FILL, fontWeight: 600 }}>{ar ? "الموظف" : "Worker"}</span>
        {" — "}
        {ar ? "يرى حكم طلبه في طلباتي. لا يتجاوز وقفاً." : "Sees the verdict on their request. Cannot override a block."}
        {" · "}
        <span style={{ color: NAVY_FILL, fontWeight: 600 }}>{ar ? "الشركة" : "Company"}</span>
        {" — "}
        {ar ? "تقرر وتسدد وفق الحكم. المخالفة تُوقف فوراً." : "Decides and pays per the verdict. A breach is blocked at once."}
      </div>
    </div>
  );
}
