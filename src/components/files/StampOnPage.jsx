import { INK } from "@/lib/platformStyles";
import React from "react";
import { X } from "lucide-react";

export default function StampOnPage({ src, name, color, selected, onRemove, onResizeStart }) {
  return (
    <>
      <div style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        borderRadius: 6,
        background: "#fff",
        border: src ? "none" : `1px solid ${color}`,
        boxShadow: "0 1px 6px rgba(20,40,75,.14)",
        pointerEvents: "none",
      }}>
        {src ? (
          <img src={src} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
        ) : (
          <div style={{ height: "100%", display: "flex", alignItems: "stretch", gap: 6, padding: "5px 8px" }}>
            <span style={{ width: 3, background: "#1E9E63", borderRadius: 2, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontSize: 8, letterSpacing: "0.1em", color: "#1E9E63", fontWeight: 600 }}>NIROVERA</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
            </div>
            <span style={{ width: 22, height: 22, alignSelf: "center", border: "1px solid #1E9E63", borderRadius: 3, flexShrink: 0 }} />
          </div>
        )}
      </div>
      {selected ? (
        <>
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => { event.stopPropagation(); onRemove(); }}
            style={{ position: "absolute", top: -8, insetInlineEnd: -8, width: 18, height: 18, borderRadius: 20, border: "2px solid #fff", background: "#DC2626", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 2 }}
          >
            <X style={{ width: 10, height: 10 }} />
          </button>
          <span
            data-resize="true"
            onPointerDown={onResizeStart}
            style={{ position: "absolute", bottom: -7, insetInlineEnd: -7, width: 12, height: 12, borderRadius: 2, border: "2px solid #fff", background: "#1E9E63", cursor: "se-resize", zIndex: 2, boxShadow: "0 1px 3px rgba(20,40,75,.2)" }}
          />
        </>
      ) : null}
    </>
  );
}
