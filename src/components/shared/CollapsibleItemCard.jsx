import React, { useCallback, useId, useMemo, useState } from "react";
import { EMPTY_EXPANDED, isItemExpanded, toggleExpanded } from "@/lib/collapsibleItems";

/**
 * One list item as its own card, folded to a calm summary row:
 *   dot · title · person · date (mono) · ⚖ hint · status chip · chevron
 * A click on the row (or Enter/Space on its toggle) unfolds the body — facts, timeline,
 * attachments, the decision cell. The body stays mounted so drafts and focus keep their state;
 * folded, it is hidden from the tab order and screen readers.
 *
 * Used by every list under a StatusFilterPills header — طلباتي, صوت الموظف, الجزاءات, المهام…
 */
export default function CollapsibleItemCard({
  open = false,
  onToggle,
  dot,
  title,
  person,
  date,
  hint = null,
  status = null,
  focus = false,
  className = "",
  style,
  children,
  ar = true,
  ...rest
}) {
  const bodyId = useId();
  const flip = useCallback(() => onToggle?.(!open), [onToggle, open]);
  // The whole row toggles, except clicks on its own controls (the ⚖ hint's action, a link).
  const onRowClick = (event) => {
    const hit = event.target.closest?.("button, a, input, select, textarea, label, [role='button']");
    if (hit) return; // the toggle button flips itself; other controls keep their own job
    flip();
  };
  return (
    <article
      {...rest}
      className={`nv-cic${open ? " is-open" : ""}${focus ? " is-focus" : ""}${className ? ` ${className}` : ""}`}
      style={style}
    >
      <div className="nv-cic-row" onClick={onRowClick}>
        <button type="button" className="nv-cic-toggle" aria-expanded={open} aria-controls={bodyId} onClick={flip}>
          {dot ? <span className="nv-cic-dot" style={{ background: dot }} aria-hidden /> : null}
          <span className="nv-cic-title">{title}</span>
          {person ? <span className="nv-cic-person">{person}</span> : null}
          {date ? <span className="nv-cic-date">{date}</span> : null}
        </button>
        {hint ? <span className="nv-cic-hint">{hint}</span> : null}
        {status ? <span className="nv-cic-status">{status}</span> : null}
        <span className="nv-cic-chev" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </div>
      <div className="nv-cic-body" id={bodyId} role="region" aria-label={typeof title === "string" ? title : (ar ? "التفاصيل" : "Details")}>
        <div className="nv-cic-inner">
          <div className="nv-cic-content">{children}</div>
        </div>
      </div>
    </article>
  );
}

/**
 * The open/closed set for one list. Pass the ids visible now and the deep-linked id; the list
 * of one opens by itself, the deep-linked item opens by itself, the person's clicks override both.
 */
export function useCollapsibleItems(visibleIds = [], focusId = "") {
  const [state, setState] = useState(EMPTY_EXPANDED);
  const idsKey = visibleIds.map(String).join("|");
  const ctx = useMemo(() => ({ visibleIds: idsKey ? idsKey.split("|") : [], focusId: focusId ? String(focusId) : "" }), [idsKey, focusId]);
  const isOpen = useCallback((id) => isItemExpanded(state, id, ctx), [state, ctx]);
  const toggle = useCallback((id) => setState((s) => toggleExpanded(s, id, isItemExpanded(s, id, ctx))), [ctx]);
  return { isOpen, toggle };
}
