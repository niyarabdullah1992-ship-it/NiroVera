import React from "react";
import { Link } from "react-router-dom";

const linkStyle = {
  fontFamily: "inherit",
  fontSize: 11,
  fontWeight: 600,
  padding: "6px 10px",
  border: "1px solid var(--nv-line)",
  borderRadius: 10,
  background: "var(--nv-card)",
  color: "var(--nv-ink)",
  textDecoration: "none",
  whiteSpace: "nowrap",
};

export default function DisciplineRelatedLinks({ links = [], ar }) {
  if (!links.length) return null;
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ fontSize: 10, color: "var(--nv-muted)" }}>{ar ? "أقسام ذات علاقة" : "Related sections"}</span>
      {links.map((row) => (
        <Link key={`${row.to}-${row.label}`} to={row.to} title={row.tip} style={linkStyle}>
          {row.label}
        </Link>
      ))}
    </div>
  );
}
