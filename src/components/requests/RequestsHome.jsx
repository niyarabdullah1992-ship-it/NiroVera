import React from "react";
import { Link } from "react-router-dom";
import { CalendarOff, FileText } from "lucide-react";
import { BORDER, CARD, INK, MUTED, SURFACE } from "@/lib/platformStyles";
import { formatUiNumber } from "@/lib/dateFormat";

function RequestCard({ to, icon: Icon, title, hint, count, countLabel, ar }) {
  return (
    <Link
      to={to}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 18,
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        textDecoration: "none",
        color: "inherit",
        minHeight: 168,
      }}
    >
      <span
        style={{
          width: 40,
          height: 40,
          borderRadius: 11,
          background: SURFACE,
          color: INK,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon style={{ width: 18, height: 18 }} />
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        <span style={{ fontSize: 16, fontWeight: 650, color: INK }}>{title}</span>
        <span style={{ fontSize: 13, color: MUTED, lineHeight: 1.7 }}>{hint}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 22, fontWeight: 600, color: INK, fontVariantNumeric: "tabular-nums" }}>
          {formatUiNumber(count, ar)}
        </span>
        <span style={{ fontSize: 12, color: MUTED }}>{countLabel}</span>
      </div>
    </Link>
  );
}

export default function RequestsHome({ ar, leavePending, otherPending }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.75, maxWidth: 720 }}>
        {ar
          ? "صندوق واحد: الإجازة تغلق يوم الحضور، والطلبات الأخرى للشهادات والاستئذان والإضافي والسلفة وتغيير الوردية وموافقة العمل الليلي."
          : "One inbox: leave closes the attendance day; other requests cover letters, permission, overtime, advances, shift changes, and night-work consent."}
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 14,
        }}
      >
        <RequestCard
          to="/app/requests/leave"
          icon={CalendarOff}
          ar={ar}
          title={ar ? "طلبات الإجازة" : "Leave requests"}
          hint={ar
            ? "استحقاق واعتماد — الرصيد يُخصم عند الاعتماد فقط."
            : "Entitlement and approval — balance is deducted only on approval."}
          count={leavePending}
          countLabel={ar ? "بانتظار القرار" : "awaiting a decision"}
        />
        <RequestCard
          to="/app/requests/other"
          icon={FileText}
          ar={ar}
          title={ar ? "طلبات أخرى" : "Other requests"}
          hint={ar
            ? "شهادة، استئذان، إضافي، سلفة، تغيير وردية، موافقة عمل ليلي، أو تسجيل حضور يدوي."
            : "Letters, permission, overtime, advance, shift change, night-work consent, or a manual punch."}
          count={otherPending}
          countLabel={ar ? "بانتظار القرار" : "awaiting a decision"}
        />
      </div>
    </div>
  );
}
