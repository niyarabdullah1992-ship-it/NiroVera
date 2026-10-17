import React from "react";

/**
 * The request-type tile of «طلب جديد» (طلباتي): a letter mark, the title and a muted hint. The picked
 * tile is the one dark fill (see .nv-req-kind-card in index.css). Shared by طلباتي and الجزاءات.
 */
export default function KindFrameCard({ on, letter, title, hint, onClick, dataKey }) {
  return (
    <button type="button" className="nv-req-kind-card" onClick={onClick} aria-pressed={!!on} data-kind-tile={dataKey || undefined}>
      <span className="nv-req-kind-mark">{letter}</span>
      <span className="nv-req-kind-copy">
        <span className="nv-req-kind-title">{title}</span>
        <span className="nv-req-kind-hint">{hint}</span>
      </span>
    </button>
  );
}
