import React from "react";
import { Link } from "react-router-dom";

/** On the worker's own file: sanctions are read in «الجزاءات» only — one quiet pointer, no figures. */
export const SELF_SANCTIONS_HREF = "/app/discipline?tab=mine";

export default function SanctionsElsewhereLink({ ar = true, style = null }) {
  return (
    <Link
      to={SELF_SANCTIONS_HREF}
      data-self-sanctions-link="1"
      style={{ alignSelf: "flex-start", fontSize: 12, fontWeight: 600, color: "var(--nv-ink3)", textDecoration: "none", ...(style || {}) }}
    >
      {ar ? "جزاءاتك في قسم الجزاءات ‹" : "Your sanctions are in Discipline ›"}
    </Link>
  );
}
