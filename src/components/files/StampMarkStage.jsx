import React, { useCallback, useEffect, useRef, useState } from "react";
import { CARD, MUTED, NAVY } from "@/lib/platformStyles";
import {
  clampMarkScale,
  clampNameScale,
  markBox,
  nameBox,
  nameFill,
  renderStampDataUrl,
  stampDesign,
  stampNameFamily,
} from "@/lib/stampStudio";
import { verificationUrlFor } from "@/lib/verificationBadge";
import { signGhostBtn, signMono } from "@/components/files/signingUi";

function LayerFrame({ label, active, box, stage, onMove, onScale, zIndex, children }) {
  return (
    <div
      role="slider"
      aria-label={label}
      style={{
        position: "absolute",
        left: stage.x + box.x * stage.scale,
        top: stage.y + box.y * stage.scale,
        width: box.w * stage.scale,
        height: box.h * stage.scale,
        border: active ? `1px dashed ${NAVY}` : "1px dashed transparent",
        borderRadius: 6,
        boxSizing: "border-box",
        zIndex,
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onPointerDown={onMove}
        style={{
          pointerEvents: "auto",
          cursor: active ? "grabbing" : "grab",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
      </div>
      <button
        type="button"
        aria-label={label}
        onPointerDown={onScale}
        style={{
          pointerEvents: "auto",
          position: "absolute",
          right: -6,
          bottom: -6,
          width: 12,
          height: 12,
          padding: 0,
          borderRadius: 3,
          border: `1.5px solid ${NAVY}`,
          background: CARD,
          cursor: "nwse-resize",
        }}
      />
    </div>
  );
}

export default function StampMarkStage({
  src,
  config,
  onPatch,
  ar,
  rendering = false,
  maxHeight = 380,
  verificationId = "",
}) {
  const frameRef = useRef(null);
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [layer, setLayer] = useState(config.markUrl ? "mark" : "name");
  const [owned, setOwned] = useState("");
  const [tintedMark, setTintedMark] = useState("");
  const dragRef = useRef(null);

  const design = stampDesign(config.design);
  const mark = markBox({ ...config, logoUrl: config.logoUrl }, design.w, design.h);
  const name = nameBox(config, design.w, design.h);
  const hasMark = Boolean(config.markUrl);
  const hasName = Boolean(String(config.name || "").trim());
  const custom = (
    config.markX != null || config.markY != null || (config.markScale != null && config.markScale !== 1)
    || config.nameX != null || config.nameY != null || (config.nameScale != null && config.nameScale !== 1)
  );

  useEffect(() => {
    if (src) return undefined;
    let alive = true;
    renderStampDataUrl(config, {
      hideMark: Boolean(config.markUrl),
      hideName: true,
      verificationId,
      verificationUrl: verificationId ? verificationUrlFor(verificationId) : undefined,
    }).then((url) => { if (alive) setOwned(url); }).catch(() => {});
    return () => { alive = false; };
  }, [src, verificationId, config.design, config.accent, config.ink, config.paper, config.role, config.company, config.logoUrl, config.markUrl]);

  const image = src || owned;

  useEffect(() => {
    if (!config.markUrl) {
      setTintedMark("");
      return undefined;
    }
    if (!config.markColor) {
      setTintedMark(config.markUrl);
      return undefined;
    }
    let alive = true;
    const img = new Image();
    if (!config.markUrl.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, img.width);
      canvas.height = Math.max(1, img.height);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      ctx.globalCompositeOperation = "source-in";
      ctx.fillStyle = config.markColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (alive) setTintedMark(canvas.toDataURL("image/png"));
    };
    img.onerror = () => { if (alive) setTintedMark(config.markUrl); };
    img.src = config.markUrl;
    return () => { alive = false; };
  }, [config.markUrl, config.markColor]);

  useEffect(() => {
    if (!config.markUrl) return undefined;
    let alive = true;
    const img = new Image();
    if (!config.markUrl.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!alive || !img.width || !img.height) return;
      const aspect = img.width / img.height;
      if (Math.abs((config.markAspect || 0) - aspect) < 0.03) return;
      onPatch({ markAspect: aspect });
    };
    img.src = config.markUrl;
    return () => { alive = false; };
  }, [config.markUrl, config.markAspect, onPatch]);

  useEffect(() => {
    const node = frameRef.current;
    if (!node || typeof ResizeObserver === "undefined") return undefined;
    const sync = () => {
      const next = node.getBoundingClientRect();
      setFrame({ w: next.width, h: next.height });
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    return () => observer.disconnect();
  }, [image, config.design]);

  const stage = frame.w && frame.h
    ? { x: 0, y: 0, w: frame.w, h: frame.h, scale: frame.w / design.w }
    : null;

  const pointerToStamp = (event) => {
    const node = frameRef.current;
    if (!node || !stage) return null;
    const rect = node.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - stage.x) / stage.w,
      y: (event.clientY - rect.top - stage.y) / stage.h,
    };
  };

  const moveMark = useCallback((markX, markY) => {
    const next = markBox({ ...config, markX, markY }, design.w, design.h);
    onPatch({ markX: next.markX, markY: next.markY });
  }, [config, design.h, design.w, onPatch]);

  const moveName = useCallback((nameX, nameY) => {
    const next = nameBox({ ...config, nameX, nameY }, design.w, design.h);
    onPatch({ nameX: next.nameX, nameY: next.nameY });
  }, [config, design.h, design.w, onPatch]);

  const beginMove = (kind) => (event) => {
    if (event.button) return;
    event.preventDefault();
    event.stopPropagation();
    const point = pointerToStamp(event);
    if (!point) return;
    setLayer(kind);
    const box = kind === "mark" ? mark : name;
    dragRef.current = {
      kind: "move",
      layer: kind,
      dx: point.x - (kind === "mark" ? box.markX : box.nameX),
      dy: point.y - (kind === "mark" ? box.markY : box.nameY),
    };
    dragRef.current.pointerId = event.pointerId;
    frameRef.current?.setPointerCapture?.(event.pointerId);
  };

  const beginScale = (kind) => (event) => {
    if (event.button) return;
    event.preventDefault();
    event.stopPropagation();
    setLayer(kind);
    dragRef.current = {
      kind: "scale",
      layer: kind,
      start: kind === "mark" ? (config.markScale || 1) : (config.nameScale || 1),
      x: event.clientX,
      y: event.clientY,
    };
    dragRef.current.pointerId = event.pointerId;
    frameRef.current?.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === "move") {
      const point = pointerToStamp(event);
      if (!point) return;
      if (drag.layer === "mark") moveMark(point.x - drag.dx, point.y - drag.dy);
      else moveName(point.x - drag.dx, point.y - drag.dy);
      return;
    }
    const delta = ((event.clientX - drag.x) - (event.clientY - drag.y)) / 160;
    if (drag.layer === "mark") onPatch({ markScale: clampMarkScale(drag.start + delta) });
    else onPatch({ nameScale: clampNameScale(drag.start + delta) });
  };

  const endDrag = () => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.pointerId != null) frameRef.current?.releasePointerCapture?.(drag.pointerId);
    dragRef.current = null;
  };

  const onKeyDown = (event) => {
    const step = event.shiftKey ? 0.04 : 0.012;
    const current = layer === "name" ? name : mark;
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    if (layer === "name" && hasName) {
      if (event.key === "ArrowLeft") moveName(current.nameX - step, current.nameY);
      if (event.key === "ArrowRight") moveName(current.nameX + step, current.nameY);
      if (event.key === "ArrowUp") moveName(current.nameX, current.nameY - step);
      if (event.key === "ArrowDown") moveName(current.nameX, current.nameY + step);
      return;
    }
    if (!hasMark) return;
    if (event.key === "ArrowLeft") moveMark(current.markX - step, current.markY);
    if (event.key === "ArrowRight") moveMark(current.markX + step, current.markY);
    if (event.key === "ArrowUp") moveMark(current.markX, current.markY - step);
    if (event.key === "ArrowDown") moveMark(current.markX, current.markY + step);
  };

  return (
    <div style={{ display: "grid", gap: 10, width: "100%" }}>
      <div
        tabIndex={hasMark || hasName ? 0 : -1}
        onKeyDown={onKeyDown}
        style={{
          minHeight: Math.min(280, maxHeight),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          outline: "none",
        }}
      >
        <div
          ref={frameRef}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{
            position: "relative",
            display: "inline-block",
            maxWidth: "100%",
            touchAction: hasMark || hasName ? "none" : "auto",
            userSelect: "none",
          }}
        >
          {image ? (
            <img
              src={image}
              alt={ar ? "معاينة الختم" : "Seal preview"}
              draggable={false}
              onLoad={() => {
                const node = frameRef.current;
                if (!node) return;
                const next = node.getBoundingClientRect();
                setFrame({ w: next.width, h: next.height });
              }}
              style={{
                maxWidth: "100%",
                maxHeight,
                height: "auto",
                display: "block",
                filter: "drop-shadow(0 12px 26px rgba(20,40,75,.14))",
                opacity: rendering ? 0.55 : 1,
                transition: "opacity .15s ease",
                pointerEvents: "none",
              }}
            />
          ) : null}

          {hasName && stage ? (
            <LayerFrame
              label={ar ? "موضع الاسم" : "Name position"}
              active={layer === "name"}
              box={name}
              stage={stage}
              zIndex={2}
              onMove={beginMove("name")}
              onScale={beginScale("name")}
            >
              <span
                style={{
                  fontFamily: stampNameFamily(config),
                  fontSize: Math.max(11, name.fontSize * stage.scale),
                  fontWeight: 600,
                  color: nameFill(config),
                  lineHeight: 1,
                  pointerEvents: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {config.name}
              </span>
            </LayerFrame>
          ) : null}

          {hasMark && stage ? (
            <LayerFrame
              label={ar ? "موضع توقيع خط اليد" : "Handwriting position"}
              active={layer === "mark"}
              box={mark}
              stage={stage}
              zIndex={4}
              onMove={beginMove("mark")}
              onScale={beginScale("mark")}
            >
              <img
                src={tintedMark || config.markUrl}
                alt=""
                draggable={false}
                style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }}
              />
            </LayerFrame>
          ) : null}
        </div>
      </div>

      {hasMark || hasName ? (
        <div style={{ display: "grid", gap: 8, padding: "0 4px 8px" }}>
          {hasMark ? (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: MUTED }}>
              {ar ? "حجم خط اليد" : "Hand size"}
              <input
                type="range"
                min="35"
                max="220"
                value={Math.round((config.markScale || 1) * 100)}
                onChange={(event) => { setLayer("mark"); onPatch({ markScale: clampMarkScale(Number(event.target.value) / 100) }); }}
                style={{ flex: 1, accentColor: "var(--nv-navy, #14284B)" }}
              />
              <span dir="ltr" style={{ ...signMono, fontSize: 10, minWidth: 36 }}>{Math.round((config.markScale || 1) * 100)}%</span>
            </label>
          ) : null}
          {hasName ? (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: MUTED }}>
              {ar ? "حجم الاسم" : "Name size"}
              <input
                type="range"
                min="45"
                max="240"
                value={Math.round((config.nameScale || 1) * 100)}
                onChange={(event) => { setLayer("name"); onPatch({ nameScale: clampNameScale(Number(event.target.value) / 100) }); }}
                style={{ flex: 1, accentColor: "var(--nv-navy, #14284B)" }}
              />
              <span dir="ltr" style={{ ...signMono, fontSize: 10, minWidth: 36 }}>{Math.round((config.nameScale || 1) * 100)}%</span>
            </label>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => onPatch({ markX: null, markY: null, markScale: 1, nameX: null, nameY: null, nameScale: 1 })}
              disabled={!custom}
              style={{ ...signGhostBtn, fontSize: 12, padding: "6px 10px", opacity: custom ? 1 : 0.45 }}
            >
              {ar ? "الموضع الافتراضي" : "Default place"}
            </button>
            <span style={{ fontSize: 11, color: MUTED, flex: "1 1 180px" }}>
              {ar
                ? "أمسك خط اليد نفسه — ليس الإطار — وضعه فوق الاسم أو حيث تريد."
                : "Grab the handwriting itself — not the frame — and place it above the name or anywhere."}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
