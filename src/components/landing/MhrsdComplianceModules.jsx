import React from "react";
import { Link } from "react-router-dom";
import {
  ACCENT,
  BORDER,
  BRAND_BORDER,
  BRAND_SOFT,
  CARD,
  INK,
  MUTED,
  NAVY_FILL,
  ON_NAVY,
  ON_NAVY_MUTED,
  SURFACE,
} from "@/lib/publicChrome";

/**
 * Public MHRSD-aligned obligations — honest readiness chips.
 * Live Qiwa / GOSI / Mudad / Nafath remain deferred until official credentials.
 */

const READY = "ready";
const PENDING = "pending";

const MODULES = [
  {
    id: "leave",
    arTitle: "طلبات الإجازة",
    enTitle: "Leave Requests",
    arText:
      "الاستحقاق من نظام العمل لا تقدير المدير — يُعرض مصدر الرصيد قبل كل اعتماد، مع حساب نهاية الخدمة.",
    enText:
      "Entitlement is a Labour Law rule, not manager discretion — the balance source is shown before approval, with end-of-service calculation.",
    status: READY,
    href: "/app/leave",
  },
  {
    id: "hr",
    arTitle: "الموارد البشرية",
    enTitle: "Human Resources",
    arText:
      "عقد العمل، ساعات العمل، والإضافي وفق المواد النظامية — بوابات بأسماء أسباب قبل الاعتماد.",
    enText:
      "Employment contracts, working hours and overtime per statutory articles — named gates before approval.",
    status: READY,
      href: "/app/hr",
  },
  {
    id: "safety",
    arTitle: "السلامة HSE",
    enTitle: "Safety HSE",
    arText:
      "بلاغات السلامة، التصعيد الزمني، وكفاءة منسقي السلامة من سجل الموظفين.",
    enText:
      "Safety reports, timed escalation, and safety-coordinator competency from the employee register.",
    status: READY,
    href: "/app/safety",
  },
  {
    id: "complaints",
    arTitle: "صوت الموظف",
    enTitle: "Employee Voice",
    arText:
      "اقتراحات وشكاوى وبلاغات مجهولة مع تصعيد زمني — تمهيد لمسار التسوية وليس بديلاً عن اللجان الرسمية.",
    enText:
      "Suggestions, complaints, and anonymous reports with timed escalation — a path toward settlement, not a substitute for official committees.",
    status: READY,
    href: "/app/complaints",
  },
  {
    id: "payroll",
    arTitle: "الرواتب",
    enTitle: "Payroll",
    arText:
      "صفوف حماية الأجور: هوية وطنية · آيبان · صافٍ — قبل أي إيداع. الإرسال الحي لمدى قيد الربط.",
    enText:
      "Wage-protection rows: national ID · IBAN · net — before deposit. Live Mudad send pending credentials.",
    status: PENDING,
    href: "/app/payroll",
  },
  {
    id: "settings",
    arTitle: "إعدادات الشركة",
    enTitle: "Company Settings",
    arText:
      "رقم المنشأة، نسبة التوطين المشتقة، وملف التأمينات الشهري — معاينة حتى الاعتمادات الرسمية.",
    enText:
      "Establishment number, derived Saudization rate, and the monthly GOSI file — preview until official credentials.",
    status: PENDING,
    href: "/app/settings",
  },
];

function StatusChip({ status, ar }) {
  const ready = status === READY;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        height: "26px",
        padding: "0 10px",
        borderRadius: "20px",
        fontSize: "11px",
        fontWeight: 600,
        background: ready ? BRAND_SOFT : SURFACE,
        border: `1px solid ${ready ? BRAND_BORDER : BORDER}`,
        color: ready ? "var(--nv-accent-deep)" : MUTED,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: ready ? ACCENT : MUTED,
          flexShrink: 0,
        }}
      />
      {ready
        ? ar
          ? "جاهز في المنصة"
          : "Ready in product"
        : ar
          ? "قيد الربط الحي"
          : "Live link pending"}
    </span>
  );
}

/**
 * Landing section: Ministry of HR obligations mapped to NiroVera modules.
 */
export default function MhrsdComplianceModules({ ar, loggedIn = false }) {
  return (
    <section
      id="mhrsd"
      data-nv="pad"
      style={{
        padding: "80px 48px",
        background: CARD,
        borderTop: `1px solid ${BORDER}`,
      }}
    >
      <div style={{ maxWidth: "1240px", margin: "0 auto" }}>
        <div style={{ fontSize: "12px", letterSpacing: "0.12em", color: ACCENT, fontWeight: 600 }}>
          {ar ? "وزارة الموارد البشرية والتنمية الاجتماعية" : "MHRSD ALIGNMENT"}
        </div>
        <h2
          data-nv="h2"
          style={{
            margin: "16px 0 0",
            fontSize: "40px",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            maxWidth: "820px",
            textWrap: "pretty",
          }}
        >
          {ar
            ? "امتثال صاحب العمل — داخل التشغيل لا خارجه"
            : "Employer compliance — inside operations, not beside them"}
        </h2>
        <p
          style={{
            margin: "16px 0 0",
            fontSize: "18px",
            color: MUTED,
            maxWidth: "760px",
            lineHeight: 1.65,
            textWrap: "pretty",
          }}
        >
          {ar
            ? "كل بطاقة هنا قسم من القائمة الجانبية — نفس الاسم ونفس الصفحة. الالتزام الحكومي يظهر في الشرح؛ الشارة تقول إن البوابة داخل المنصة أو أن الربط الحي ما زال معلّقًا."
            : "Each card is a sidebar section — same name, same page. The government obligation sits in the copy; the chip says whether the gate is in-product or the live link is still pending."}
        </p>

        <div
          data-nv="mod-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "14px",
            marginTop: "44px",
          }}
        >
          {MODULES.map((m) => (
            <article
              key={m.id}
              id={`mhrsd-${m.id}`}
              style={{
                border: `1px solid ${BORDER}`,
                borderRadius: "16px",
                padding: "20px 20px 18px",
                background: SURFACE,
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: INK, lineHeight: 1.45 }}>
                  {ar ? m.arTitle : m.enTitle}
                </h3>
                <StatusChip status={m.status} ar={ar} />
              </div>
              <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.7, color: MUTED, flex: 1, textWrap: "pretty" }}>
                {ar ? m.arText : m.enText}
              </p>
              {loggedIn ? (
                <Link
                  to={m.href}
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: ACCENT,
                    textDecoration: "none",
                    marginTop: "4px",
                  }}
                >
                  {ar ? "فتح في المنصة ←" : "Open in platform →"}
                </Link>
              ) : null}
            </article>
          ))}
        </div>

        <div
          style={{
            marginTop: "36px",
            padding: "22px 24px",
            borderRadius: "16px",
            border: `1px solid ${NAVY_FILL}`,
            background: NAVY_FILL,
            color: ON_NAVY,
            display: "flex",
            flexWrap: "wrap",
            gap: "18px",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ maxWidth: "640px" }}>
            <div style={{ fontSize: "15px", fontWeight: 600 }}>
              {ar ? "مركز امتثال الموارد البشرية" : "HR compliance centre"}
            </div>
            <p style={{ margin: "8px 0 0", fontSize: "14px", lineHeight: 1.7, color: ON_NAVY_MUTED }}>
              {ar
                ? "نطاقات · GOSI · وثائق منتهية — في إعدادات الشركة. قوى ومدى والتأمينات: جاهزة للاشتقاق، والربط الحي عند الاعتمادات الرسمية."
                : "Nitaqat · GOSI · expiring documents — in company settings. Qiwa, Mudad and GOSI: derivation-ready; live rails when official credentials exist."}
            </p>
          </div>
          {loggedIn ? (
            <Link
              to="/app/settings"
              style={{
                height: "44px",
                padding: "0 22px",
                borderRadius: "9px",
                background: ACCENT,
                color: ON_NAVY,
                fontSize: "14px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                textDecoration: "none",
                flexShrink: 0,
              }}
            >
              {ar ? "فتح مركز الامتثال" : "Open compliance centre"}
            </Link>
          ) : (
            <a
              href="#contact"
              style={{
                height: "44px",
                padding: "0 22px",
                borderRadius: "9px",
                background: ACCENT,
                color: ON_NAVY,
                fontSize: "14px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                textDecoration: "none",
                flexShrink: 0,
              }}
            >
              {ar ? "اطلب تجريب موقع" : "Request a site pilot"}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
