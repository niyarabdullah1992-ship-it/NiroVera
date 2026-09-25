import React from "react";
import { BORDER, NAVY, SURFACE } from "@/lib/platformStyles";
import { orgPanelShell } from "@/lib/orgWorkspaceStyles";

export function OrgPanel({ ar, fullscreen = false, embedded = false, children, style }) {
  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      className={`nv-org-panel${embedded ? " nv-org-panel--embedded" : ""}`}
      style={{
        ...orgPanelShell(fullscreen),
            ...(embedded && !fullscreen
          ? {
              borderRadius: 0,
              overflow: "hidden",
              padding: 0,
              boxSizing: "border-box",
              border: "1px solid #D5DCD8",
              background: "#fff",
              display: "flex",
              flexDirection: "column",
              height: 720,
            }
          : null),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Institutional toolbar — one title line, controls aligned on the opposite side. */
export function OrgToolbar({ title, subtitle, children }) {
  return (
    <div className="nv-org-toolbar">
      <div className="nv-org-toolbar__lead">
        {title ? <span className="nv-org-toolbar__title">{title}</span> : null}
        {subtitle ? <span className="nv-org-toolbar__sub">{subtitle}</span> : null}
      </div>
      {children ? <div className="nv-org-toolbar__actions">{children}</div> : null}
    </div>
  );
}

/** Selected node / employee strip below the toolbar. */
export function OrgInspector({ label, title, children, empty = false, dockRef }) {
  return (
    <div ref={dockRef} className={`nv-org-inspector${empty ? " nv-org-inspector--empty" : ""}`}>
      {label ? <span className="nv-org-inspector__label">{label}</span> : null}
      {title ? <span className="nv-org-inspector__title">{title}</span> : null}
      {children ? <div className="nv-org-inspector__fields">{children}</div> : null}
    </div>
  );
}

export function OrgInspectorField({ label, children }) {
  return (
    <label className="nv-org-field">
      <span className="nv-org-field__label">{label}</span>
      {children}
    </label>
  );
}

export function OrgTreeCanvas({ viewportRef, gestures, fullscreen, children, embedded = false }) {
  return (
    <div
      ref={viewportRef}
      {...gestures}
      className="nv-org-canvas"
      style={{
        position: "relative",
        flex: 1,
        minHeight: fullscreen ? 0 : (embedded ? 0 : 440),
        height: fullscreen ? "100%" : (embedded ? "auto" : "68vh"),
        maxHeight: fullscreen ? "none" : (embedded ? "none" : 720),
        overflow: "auto",
        cursor: "grab",
        backgroundColor: embedded ? "#F7F9F8" : undefined,
        backgroundImage: embedded ? "radial-gradient(#D7E0DB 1px, transparent 1px)" : undefined,
        backgroundSize: embedded ? "22px 22px" : undefined,
        border: embedded ? "1px solid #D5DCD8" : undefined,
        borderRadius: embedded ? 0 : undefined,
        width: "100%",
        boxSizing: "border-box",
        padding: embedded ? 12 : undefined,
        display: embedded ? "grid" : undefined,
        placeContent: embedded ? "safe center" : undefined,
      }}
    >
      {children}
    </div>
  );
}

export function OrgSearchDropdown({ hits, onPick, renderHit, ar }) {
  if (!hits?.length) return null;
  return (
    <div className="nv-org-search-menu" role="listbox">
      {hits.map((item) => (
        <button
          key={item.id || item.stationId || item.name}
          type="button"
          role="option"
          className="nv-org-search-item"
          onClick={() => onPick(item)}
        >
          {renderHit(item)}
        </button>
      ))}
    </div>
  );
}

export function OrgSearchBox({ value, onChange, placeholder, hits, onPick, renderHit, width = 168 }) {
  return (
    <div className="nv-org-search" style={{ width }}>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="nv-org-search__input"
      />
      <OrgSearchDropdown hits={hits} onPick={onPick} renderHit={renderHit} />
    </div>
  );
}

export function OrgNotice({ tone = "warn", children }) {
  const bg = tone === "warn" ? "#FFFBEB" : SURFACE;
  const border = tone === "warn" ? "color-mix(in oklab, #C9A227 35%, #E2E8F0)" : BORDER;
  return (
    <div className="nv-org-notice" style={{ background: bg, borderBottom: `1px solid ${border}`, color: NAVY }}>
      {children}
    </div>
  );
}

export function OrgFooterStrip({ children }) {
  if (!children) return null;
  return <div className="nv-org-footer">{children}</div>;
}

export function OrgAccessPanel({ children }) {
  return <div className="nv-org-access">{children}</div>;
}

export function OrgSectionTitle({ children, meta }) {
  return (
    <div className="nv-org-section-head">
      <span className="nv-org-section-head__title">{children}</span>
      {meta ? <span className="nv-org-section-head__meta">{meta}</span> : null}
    </div>
  );
}
