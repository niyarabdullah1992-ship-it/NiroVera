import React from "react";
import { Link } from "react-router-dom";
import { BORDER, CARD, INK, MUTED } from "@/lib/platformStyles";

const linkStyle = {
  fontFamily: "inherit",
  fontSize: 11,
  fontWeight: 600,
  padding: "6px 10px",
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  background: CARD,
  color: INK,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

export default function VoiceRelatedLinks({ links = [], ar }) {
  if (!links.length) return null;
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ fontSize: 10, color: MUTED }}>{ar ? "أقسام ذات علاقة" : "Related sections"}</span>
      {links.map((row) => (
        <Link key={`${row.to}-${row.label}`} to={row.to} title={row.tip} style={linkStyle}>
          {row.label}
        </Link>
      ))}
    </div>
  );
}
