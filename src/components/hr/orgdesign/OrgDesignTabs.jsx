import React, { useRef } from "react";
import "./orgDesign.css";

/** One tab set for the structure — arrow keys move (RTL aware), Home/End jump. */
export default function OrgDesignTabs({ ar = true, tabs = [], value, onChange, label }) {
  const refs = useRef([]);
  const index = Math.max(0, tabs.findIndex((t) => t.value === value));
  const move = (to) => {
    const next = (to + tabs.length) % tabs.length;
    onChange?.(tabs[next].value);
    refs.current[next]?.focus();
  };
  const onKeyDown = (e) => {
    const forward = ar ? "ArrowLeft" : "ArrowRight";
    const back = ar ? "ArrowRight" : "ArrowLeft";
    if (e.key === forward) { e.preventDefault(); move(index + 1); }
    else if (e.key === back) { e.preventDefault(); move(index - 1); }
    else if (e.key === "Home") { e.preventDefault(); move(0); }
    else if (e.key === "End") { e.preventDefault(); move(tabs.length - 1); }
  };
  return (
    <div className="nv-od-tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((tab, i) => (
        <button
          key={tab.value}
          ref={(el) => { refs.current[i] = el; }}
          type="button"
          role="tab"
          id={`nv-od-tab-${tab.value}`}
          aria-selected={tab.value === value}
          aria-controls={`nv-od-pane-${tab.value}`}
          tabIndex={tab.value === value ? 0 : -1}
          className="nv-od-tab"
          onClick={() => onChange?.(tab.value)}
        >
          {tab.label}
          {tab.count ? <span className="nv-od-count" dir="ltr">{tab.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
