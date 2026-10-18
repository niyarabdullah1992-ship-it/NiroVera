import React from "react";
import NvIcon from "@/components/shared/NvIcon";

/**
 * A second-level choice under a request type (leave type, duty request, night-work right, document
 * kind, balance pool…). It must read as subordinate to the parent tile: a white row with a hairline,
 * radius 8, ink title, muted sub-line and the ministry badge. Selected = soft green border, a green
 * check and a light tint — never the parent's dark fill.
 */
export function SubTypeGrid({ children, label, wide = false }) {
  return (
    <div className={`nv-req-sub-grid${wide ? " is-wide" : ""}`} role="radiogroup" aria-label={label}>
      {children}
    </div>
  );
}

export default function SubTypeOption({ on = false, title, sub, badge, onClick, muted = false, dataKey }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={!!on}
      className={`nv-req-sub-opt${muted ? " is-muted" : ""}`}
      data-sub={dataKey || undefined}
      onClick={onClick}
    >
      <span className="nv-req-sub-check" aria-hidden="true">{on ? <NvIcon name="check" size={10} strokeWidth={2.5} inline={false} /> : ""}</span>
      <span className="nv-req-sub-copy">
        <span className="nv-req-sub-title">
          <span>{title}</span>
          {badge || null}
        </span>
        {sub ? <span className="nv-req-sub-line">{sub}</span> : null}
      </span>
    </button>
  );
}
