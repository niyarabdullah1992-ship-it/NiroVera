import React from "react";

/**
 * The طلباتي distribution, shared by every section that raises and lists:
 *   inline-start (right in RTL) — the raise card («طلب جديد» / «إجراء جديد» / «صوت جديد»)
 *   inline-end (left in RTL)    — optional summary card(s), then the list header card, then item cards
 * Two equal columns from 1024px; below that one column, raise first. Without a raise slot the
 * list column takes the full width.
 */
export default function TwoPaneWorkspace({ raise = null, summary = null, list = null, dataKey, className = "", children = null }) {
  const single = !raise;
  return (
    <div className={`nv-twopane${single ? " is-single" : ""}${className ? ` ${className}` : ""}`} data-twopane={dataKey || ""}>
      {raise ? <div className="nv-twopane-raise">{raise}</div> : null}
      <div className="nv-twopane-list">
        {summary}
        {list}
        {children}
      </div>
    </div>
  );
}

/** A list column: the header card, then each item as its own card with a gap — never glued. */
export function ListStack({ children, className = "", ...rest }) {
  return (
    <div {...rest} className={`nv-list-stack${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}
