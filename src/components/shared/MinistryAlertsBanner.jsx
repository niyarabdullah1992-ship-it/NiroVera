import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { canSeeMinistryAlerts, deriveMinistryAlerts } from "@/lib/ministryAlertDerivations";
import { BORDER, CARD, MUTED, NAVY } from "@/lib/platformStyles";

function skin(level) {
  if (level === "critical") return { fg: "#B91C1C", bd: "#FECACA", bg: "#FEF2F2" };
  if (level === "info") return { fg: "#1D4ED8", bd: "#BFDBFE", bg: "#EFF6FF" };
  return { fg: "#B45309", bd: "#FDE68A", bg: "#FFFBEB" };
}

function levelLabel(level, ar) {
  if (level === "critical") return ar ? "عاجل" : "Urgent";
  if (level === "info") return ar ? "تنبيه" : "Notice";
  return ar ? "تنبيه" : "Alert";
}

/** Subtle statutory strip under the section pills — derived counts only. */
export default function MinistryAlertsBanner({ lang = "ar", data, currentUser }) {
  const ar = lang === "ar";
  const [open, setOpen] = useState(false);
  const pack = useMemo(() => deriveMinistryAlerts(data || {}), [data]);
  if (!canSeeMinistryAlerts(currentUser, data)) return null;
  if (!pack.alerts.length) return null;

  const lead = pack.alerts[0];
  const extra = pack.alerts.length - 1;
  const tone = skin(lead.level);

  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      style={{
        margin: "0 22px 8px",
        border: `1px solid ${tone.bd}`,
        background: tone.bg,
        borderRadius: 12,
        padding: "7px 12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: tone.fg, letterSpacing: "0.04em" }}>
          {levelLabel(lead.level, ar)}
        </span>
        <span style={{ flex: 1, minWidth: 160, fontSize: 12, color: NAVY, lineHeight: 1.55 }}>
          {ar ? lead.textAr : lead.textEn}
        </span>
        <Link
          to={lead.to}
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: NAVY,
            textDecoration: "none",
            padding: "4px 10px",
            borderRadius: 8,
            border: `1px solid ${BORDER}`,
            background: CARD,
          }}
        >
          {ar ? lead.actionAr : lead.actionEn}
        </Link>
        {extra > 0 ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            style={{
              border: "none",
              background: "transparent",
              color: MUTED,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {open
              ? (ar ? "إخفاء" : "Hide")
              : (ar ? `+${extra} تنبيه` : `+${extra} more`)}
          </button>
        ) : null}
      </div>
      {open ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {pack.alerts.slice(1).map((row) => {
            const s = skin(row.level);
            return (
              <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: s.fg }}>{levelLabel(row.level, ar)}</span>
                <span style={{ flex: 1, fontSize: 12, color: NAVY }}>{ar ? row.textAr : row.textEn}</span>
                <Link to={row.to} style={{ fontSize: 11, fontWeight: 600, color: NAVY, textDecoration: "none" }}>
                  {ar ? row.actionAr : row.actionEn}
                </Link>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
