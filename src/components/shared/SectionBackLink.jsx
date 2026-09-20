import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";

const STYLE = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "none",
  border: "none",
  padding: 0,
  color: "#64748B",
  fontSize: 13,
  lineHeight: 1.2,
  cursor: "pointer",
  fontFamily: "inherit",
  textDecoration: "none",
  flex: "none",
};

/**
 * Quiet parent-section back — arrow toward start, parent name, no navy pill.
 */
export default function SectionBackLink({ ar, label, onClick, to }) {
  if (!label || (!onClick && !to)) return null;
  const Icon = ar ? ArrowRight : ArrowLeft;
  const inner = (
    <>
      <Icon style={{ width: 14, height: 14 }} strokeWidth={1.8} />
      {label}
    </>
  );
  if (to) {
    return (
      <Link to={to} onClick={onClick} style={STYLE}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} style={STYLE}>
      {inner}
    </button>
  );
}
