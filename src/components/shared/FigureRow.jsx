import React from "react";
import { Link } from "react-router-dom";
import { KpiAction, KpiMeter, StatusFlag } from "@/components/shared/StatusFlag";

/**
 * «سطر لا بطاقة» — one inline row of figures, the طلباتي header pattern on white: a small muted
 * label above an ink number, an optional note line, thin vertical rules between figures. A chip
 * only for a real problem (StatusFlag), a queue as a small green action, a score as a thin meter
 * under its number. No boxes, no shadows.
 *
 * figures: [{ key, label, value, suffix?, hint?, tone?, flag?, to?, action?, actionText?, actionTextEn?, meter? }]
 */
export default function FigureRow({ figures = [], ar = true, className = "" }) {
  return (
    <div className={`nv-figrow ${className}`.trim()} dir={ar ? "rtl" : "ltr"}>
      {figures.map((f) => {
        const body = (
          <>
            <span className="nv-fig-label">
              {f.label}
              <StatusFlag tone={f.tone} flag={f.flag} label={f.label} ar={ar} />
            </span>
            <span className="nv-fig-num">
              <b>{f.value}</b>
              {f.suffix ? <small>{f.suffix}</small> : null}
            </span>
            {f.meter ? <KpiMeter value={Number(String(f.value).replace(/[^\d.]/g, "")) || 0} max={f.meter} label={f.label} /> : null}
            {f.action
              ? <KpiAction asText ar={ar} text={f.actionText} textEn={f.actionTextEn} style={{ fontSize: 11 }} />
              : (f.hint ? <span className="nv-fig-note">{f.hint}</span> : null)}
          </>
        );
        return f.to ? (
          <Link key={f.key} to={f.to} className="nv-fig" data-fig={f.key}>{body}</Link>
        ) : (
          <div key={f.key} className="nv-fig" data-fig={f.key}>{body}</div>
        );
      })}
    </div>
  );
}
