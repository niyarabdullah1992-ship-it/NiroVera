/**
 * Workforce / org chrome — Design System v2.
 * Composition from workforce.dc HTML; tokens stay --nv-* (not cream/terracotta).
 * Document 14 · controls 10 · chips 999 · status on top 3px edge.
 * Tree card is 272px wide and grows in height: name, job title, meta, footer.
 */

import React from "react";
import { DS_CONTROL_RADIUS, DS_EDGE_PX, DS_PILL_RADIUS, DS_RADIUS, DS_SHADOW } from "@/lib/designSystem";

export const ORG_MONO = { fontFamily: "'IBM Plex Mono', monospace" };

/** HTML workforce tree column / card width. */
export const ORG_NODE_W = 250;
export const ORG_NODE_H = 76;
export const ORG_NODE_H_ACTING = 96;
export const ORG_NODE_SHADOW = "0 1px 2px var(--nv-shadow2), 0 8px 20px var(--nv-shadow)";
export const ORG_TREE_LINE = "#B9C7BF";

/** HTML GC — one color per ladder step, repeating after the seventh. */
export const ORG_GRADE_COLORS = ["#4B5567", "#5B6B85", "#2F7D57", "#137A49", "#9A6F12", "#8A6516", "#14213D"];

export function orgGradeColor(index) {
  const step = Number(index);
  if (!Number.isFinite(step) || step < 0) return ORG_GRADE_COLORS[0];
  return ORG_GRADE_COLORS[step % ORG_GRADE_COLORS.length];
}

const TONE_DOT = {
  ok: "var(--nv-ok-fill)",
  acting: "var(--nv-ok-ink)",
  warn: "var(--nv-warn-fill)",
  block: "var(--nv-bad-ink)",
  vacant: "var(--nv-warn-fill)",
};

/**
 * One org-tree node.
 * 1 name + أنت · 2 job title · 3 branch / number / grade · 4 avatar, count, ≡
 */
export function OrgWorkforceNodeCard({
  name,
  title,
  kindTag,
  kind = "person",
  empLine = "",
  grade = "",
  gradeTip = "",
  gradeIndex = -1,
  unit = "",
  unitTip = "",
  unitNavy = false,
  byGrade = false,
  count = "",
  countOpen = false,
  onCountClick,
  onNameClick,
  onDetails,
  onClick,
  onDoubleClick,
  selected = false,
  isMe = false,
  acting = false,
  actingText = "",
  tone = "ok",
  vacant = false,
  avatarUrl = "",
  initials = "?",
  meLabel = "أنت",
  detailsTitle = "ملف الموظف",
  countTitle = "مباشرون / إجمالي — انقر للتفرّع",
  coordinate = "",
  kindLock = false,
  style,
}) {
  const isBranch = kind === "branch" || kind === "company";
  const resolvedTone = acting ? "acting" : (vacant ? "vacant" : tone);
  const dot = TONE_DOT[resolvedTone] || TONE_DOT.ok;
  const dashed = vacant && !acting;
  const gradeColor = orgGradeColor(gradeIndex);
  const branchLabel = unit || (kind === "person" ? "" : (kindTag || ""));
  const chip = {
    display: "inline-flex",
    alignItems: "center",
    height: 20,
    maxWidth: "100%",
    padding: "0 8px",
    borderRadius: DS_CONTROL_RADIUS,
    fontSize: 10.5,
    fontWeight: 600,
    lineHeight: 1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    flex: "none",
    boxSizing: "border-box",
  };

  const bandBg = isBranch
    ? "linear-gradient(135deg,#0B3D27,#0F5535)"
    : dashed
      ? "#FBF3E1"
      : acting
        ? "#FBF3E1"
        : resolvedTone === "block"
          ? "#FBEBED"
          : "#EEF4F0";
  const bandColor = isBranch
    ? "#E9D9AE"
    : dashed || acting
      ? "#8A5A12"
      : resolvedTone === "block"
        ? "#9B2335"
        : "#0B3D27";
  const bandLabel = dashed
    ? "شاغرة"
    : acting
      ? (actingText || "تكليف ساري")
      : (branchLabel || (isBranch ? "وحدة" : "مشغول"));
  const tagText = isMe ? (meLabel || "أنت هنا") : (dashed ? "شاغرة" : (empLine || ""));

  return (
    <div
      data-org-hit="true"
      data-node="1"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      style={{
        userSelect: "none",
        position: "relative",
        width: "100%",
        minWidth: 0,
        maxWidth: 300,
        boxSizing: "border-box",
        background: dashed ? "#FFFCF5" : "#fff",
        border: `1px ${dashed ? "dashed #D9C08A" : `solid ${selected ? "#0B3D27" : "#DCE3DF"}`}`,
        borderRadius: 6,
        overflow: "hidden",
        boxShadow: isMe
          ? "0 0 0 3px #C8A45A, 0 1px 2px rgba(12,20,16,.05), 0 8px 20px rgba(12,20,16,.07)"
          : selected
            ? "0 0 0 2px #0B3D27, 0 1px 2px rgba(12,20,16,.05), 0 8px 20px rgba(12,20,16,.07)"
            : "0 1px 2px rgba(12,20,16,.05), 0 8px 20px rgba(12,20,16,.07)",
        cursor: "pointer",
        textAlign: "start",
        ...style,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, padding: "6px 12px", background: byGrade && grade ? gradeColor : bandBg }}>
        <span title={gradeTip || unitTip || undefined} style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: byGrade && grade ? "#fff" : bandColor }}>
          {bandLabel}
        </span>
        {grade && !isBranch ? (
          <span style={{ ...chip, background: "#fff", color: "#555C66", border: "1px solid #DCE3DF", height: 18 }}>{grade}</span>
        ) : null}
      </div>
      <div style={{ display: "flex", gap: 11, alignItems: "center", padding: "12px 12px 6px" }}>
        <button
          type="button"
          data-org-hit="true"
          title={detailsTitle}
          onClick={(event) => {
            event.stopPropagation();
            onDetails?.(event);
          }}
          style={{
            position: "relative",
            width: 42,
            height: 42,
            borderRadius: isBranch ? 6 : "50%",
            flex: "none",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            padding: 0,
            overflow: "visible",
            fontFamily: isBranch ? "'IBM Plex Mono', monospace" : "inherit",
            ...(dashed
              ? { border: "1.5px dashed #D9C08A", color: "#B7791F", background: "#fff" }
              : isBranch
                ? { border: "none", background: "#0B3D27", color: "#fff" }
                : { border: "none", background: "#E6F0EA", color: "#0B3D27" }),
          }}
        >
          {avatarUrl
            ? <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} />
            : (vacant ? "＋" : initials)}
          {!isBranch && !dashed ? (
            <span aria-hidden style={{ position: "absolute", bottom: -1, insetInlineEnd: -1, width: 11, height: 11, borderRadius: "50%", border: "2px solid #fff", background: dot }} />
          ) : null}
        </button>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1, gap: 2 }}>
          <strong
            onClick={(event) => {
              if (!onNameClick) return;
              event.stopPropagation();
              onNameClick(event);
            }}
            style={{
              cursor: onNameClick ? "pointer" : "inherit",
              color: dashed ? "#8A5A12" : "#111418",
              fontSize: 13.5,
              lineHeight: 1.35,
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {dashed ? (title || name || "—") : (name || "—")}
          </strong>
          <span style={{ fontSize: 11.5, color: "#555C66", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {dashed ? "بانتظار التوظيف" : (title || "—")}
          </span>
          {kindLock && kindTag ? (
            <span title="وحدة ثابتة" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, color: "#0B3D27" }}>
              {kindTag}
              <span aria-hidden style={{ fontSize: 11, lineHeight: 1 }}>🔒</span>
            </span>
          ) : null}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, padding: "6px 12px 10px" }}>
        <span
          dir={isMe ? undefined : "ltr"}
          style={{
            ...ORG_MONO,
            direction: isMe ? undefined : "ltr",
            unicodeBidi: "isolate",
            fontSize: 10.5,
            fontWeight: isMe ? 700 : 500,
            color: isMe || dashed ? "#8A5A12" : "#555C66",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {tagText}
        </span>
        {count ? (
          <button
            type="button"
            data-org-hit="true"
            title={countTitle}
            onClick={(event) => {
              event.stopPropagation();
              onCountClick?.(event);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              height: 22,
              padding: "0 8px",
              borderRadius: 999,
              font: "600 11px 'IBM Plex Mono', monospace",
              direction: "ltr",
              cursor: onCountClick ? "pointer" : "default",
              whiteSpace: "nowrap",
              fontFamily: "inherit",
              ...(countOpen
                ? { background: "#0B3D27", color: "#fff", border: "1px solid #0B3D27" }
                : { background: "#EEF4F0", color: "#0B3D27", border: "1px solid #CFE0D6" }),
            }}
          >
            {count} {countOpen ? "▴" : "▾"}
          </button>
        ) : null}
      </div>
      {coordinate ? (
        <div style={{ margin: "0 12px 10px", paddingTop: 6, borderTop: "1px dashed #EAD6A8", fontSize: 10.5, lineHeight: 1.6, color: "#8A5A12" }}>
          {coordinate}
        </div>
      ) : null}
    </div>
  );
}

/** Column wrapper matching HTML colStyle (272px + side margin). */
export function OrgWorkforceCol({ children, style }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: ORG_NODE_W,
        margin: "0 7px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export const orgStack = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

export function orgPaper(state = "mute") {
  const fill = state === "ok" ? "var(--nv-ok-fill)"
    : state === "warn" ? "var(--nv-warn-fill)"
      : state === "bad" ? "var(--nv-bad-fill)"
        : "var(--nv-line)";
  return {
    background: "var(--nv-card)",
    border: "1px solid var(--nv-line)",
    borderTop: `${DS_EDGE_PX}px solid ${fill}`,
    borderRadius: DS_RADIUS,
    boxShadow: DS_SHADOW,
    boxSizing: "border-box",
  };
}

/** HTML workforce paper — no status edge; quiet document card. */
export function orgPaperFlat() {
  return {
    background: "var(--nv-card)",
    border: "1px solid var(--nv-line)",
    borderRadius: DS_RADIUS,
    boxShadow: DS_SHADOW,
    boxSizing: "border-box",
  };
}

export function orgInset() {
  return {
    background: "var(--nv-inset, var(--nv-soft))",
    border: "1px solid var(--nv-line)",
    borderRadius: DS_CONTROL_RADIUS,
    padding: "10px 12px",
    boxSizing: "border-box",
  };
}

/** Hero nav chips stay quiet (HTML escNavStyle). Full-tree uses ok green. */
export function orgChip(on = false) {
  return {
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 28,
    padding: "0 11px",
    borderRadius: DS_PILL_RADIUS,
    border: `1px solid ${on ? "var(--nv-navy)" : "var(--nv-line)"}`,
    background: on ? "var(--nv-navy)" : "var(--nv-card)",
    color: on ? "var(--nv-btn-ink, #fff)" : "var(--nv-ink2)",
    fontSize: 11.5,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

export function orgNavChip() {
  return {
    ...orgChip(false),
    background: "var(--nv-card)",
    color: "var(--nv-ink2)",
    border: "1px solid var(--nv-line)",
  };
}

export function orgChipOk(on = false) {
  return {
    ...orgChip(on),
    border: `1px solid ${on ? "var(--nv-ok-ink)" : "var(--nv-line)"}`,
    background: on ? "var(--nv-ok-ink)" : "var(--nv-card)",
    color: on ? "#fff" : "var(--nv-ink2)",
  };
}

/** Filter chips under the event log — quieter than nav pills. */
export function orgKindChip(on = false) {
  return {
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    height: 24,
    padding: "0 9px",
    borderRadius: DS_PILL_RADIUS,
    fontSize: 10.5,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    border: `1px solid ${on ? "var(--nv-box, #C3CBD8)" : "#ECEEF2"}`,
    background: on ? "var(--nv-soft)" : "transparent",
    color: on ? "var(--nv-ink)" : "var(--nv-muted)",
  };
}

export function orgPrimaryBtn() {
  return {
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 28,
    padding: "0 11px",
    borderRadius: 9,
    border: "1px solid var(--nv-navy)",
    background: "var(--nv-navy)",
    color: "#fff",
    fontSize: 11.5,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

export function orgGhostBtn() {
  return {
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 28,
    padding: "0 11px",
    borderRadius: 9,
    border: "1px solid var(--nv-line)",
    background: "var(--nv-card)",
    color: "var(--nv-ink)",
    fontSize: 11.5,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

export function OrgStatInline({ label, value, tone }) {
  const color = tone === "warn" ? "var(--nv-warn-ink)"
    : tone === "ok" ? "var(--nv-ok-ink)"
      : "var(--nv-ink)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <div style={{ fontSize: 10, color: "var(--nv-muted)" }}>{label}</div>
      <span dir="ltr" style={{ ...ORG_MONO, fontSize: 18, fontWeight: 500, color, unicodeBidi: "isolate" }}>
        {value}
      </span>
    </div>
  );
}

export function OrgLegendDot({ color, label, bar = false }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--nv-muted)" }}>
      <span
        aria-hidden
        style={bar
          ? { width: 20, height: 8, borderRadius: 4, background: color, flex: "none" }
          : { width: 8, height: 8, borderRadius: "50%", background: color, flex: "none" }}
      />
      {label}
    </span>
  );
}

export function OrgCollapsibleArticle({
  title,
  meta,
  extra,
  open,
  onToggle,
  children,
  articleStyle,
}) {
  return (
    <article style={{ ...orgPaperFlat(), padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10, ...articleStyle }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          onClick={onToggle}
          style={{
            all: "unset",
            display: "flex",
            alignItems: "center",
            gap: 7,
            cursor: "pointer",
            fontFamily: "inherit",
            color: "var(--nv-ink)",
          }}
        >
          <span aria-hidden style={{ fontSize: 12, color: "var(--nv-muted)", transform: open ? "none" : "rotate(-90deg)", transition: "transform .15s ease" }}>▾</span>
          <strong style={{ fontSize: 13, fontWeight: 700 }}>{title}</strong>
        </button>
        <span style={{ flex: 1 }} />
        {extra}
        {meta != null ? (
          <button
            type="button"
            onClick={onToggle}
            style={{ all: "unset", cursor: "pointer", fontSize: 11, color: "var(--nv-muted)", fontFamily: "inherit" }}
          >
            {meta}
          </button>
        ) : null}
      </div>
      {open ? children : null}
    </article>
  );
}
