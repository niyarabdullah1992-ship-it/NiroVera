import React from "react";
import { Link } from "react-router-dom";
import { ACCENT, MUTED, NAVY } from "@/lib/platformStyles";

const SURFACES = [
  { id: "tasks", to: "/app/tasks", ar: "المهام", en: "Tasks", noteAr: "أمر عمل لموظف الشركة", noteEn: "a work order for a company employee" },
  { id: "work-proof", to: "/app/work-proof", ar: "إثبات العمل", en: "Work proof", noteAr: "جهة خارج الشركة", noteEn: "an outside company" },
  { id: "visitor-proof", to: "/app/visitor-proof", ar: "إثبات زائر", en: "Visitor proof", noteAr: "ضيف على الفرع", noteEn: "a guest at the station" },
];

/** One sentence that keeps tasks, work proof, and visitor proof from collapsing into each other. */
export default function ProofSurfaceNote({ ar, current }) {
  return (
    <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.7 }}>
      {SURFACES.map((surface, index) => {
        const label = ar ? surface.ar : surface.en;
        const note = ar ? surface.noteAr : surface.noteEn;
        const active = surface.id === current;
        return (
          <span key={surface.id}>
            {index > 0 ? " · " : null}
            {active ? (
              <strong style={{ color: NAVY, fontWeight: 650 }}>{label}</strong>
            ) : (
              <Link to={surface.to} style={{ color: ACCENT, fontWeight: 600, textDecoration: "none" }}>{label}</Link>
            )}
            {" "}
            {note}
          </span>
        );
      })}
    </p>
  );
}
