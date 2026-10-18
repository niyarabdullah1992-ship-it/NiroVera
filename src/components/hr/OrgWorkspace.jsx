import React from "react";
import { orgPanelShell } from "@/lib/orgWorkspaceStyles";
import { chip } from "@/components/schedules/scheduleChrome";

export function OrgPanel({ ar, fullscreen = false, embedded = false, children, style }) {
  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      className={`nv-org-panel${embedded ? " nv-org-panel--embedded" : ""}`}
      style={{
        ...orgPanelShell(fullscreen),
        ...(embedded && !fullscreen
          ? {
              padding: 0,
              boxSizing: "border-box",
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

export function OrgTreeCanvas({ viewportRef, gestures, fullscreen, children, embedded = false, center = true }) {
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
        border: "none",
        width: "100%",
        boxSizing: "border-box",
        padding: embedded ? (center ? 12 : 0) : undefined,
        display: embedded ? "grid" : undefined,
        placeContent: embedded && center ? "safe center" : undefined,
        alignContent: embedded && !center ? "start" : undefined,
        // the directory is a list, not a canvas — no dot grid, no grab hand
        ...(embedded && !center ? { backgroundImage: "none", backgroundColor: "var(--nv-card)", cursor: "auto" } : null),
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

/** A named hold on the tree (e.g. why «نشر» waits) — a warn chip line, not a coloured band. */
export function OrgNotice({ tone = "warn", children }) {
  return (
    <div className="nv-org-notice" style={{ borderBottom: "1px solid var(--nv-line2, var(--nv-line))", background: "var(--nv-card)" }}>
      <span style={chip(tone === "warn" ? "warn" : "mute", { height: "auto", minHeight: 24, whiteSpace: "normal", lineHeight: 1.6, padding: "3px 10px", fontSize: 12, fontWeight: 500 })}>{children}</span>
    </div>
  );
}

export function OrgFooterStrip({ children }) {
  if (!children) return null;
  return <div className="nv-org-footer">{children}</div>;
}
