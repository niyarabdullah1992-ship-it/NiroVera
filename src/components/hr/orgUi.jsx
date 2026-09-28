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
/** Package connector: 2px sage, not a hairline. */
export const ORG_TREE_LINE = "#B9C7BF";

/** HTML GC — one color per ladder step, repeating after the seventh. */
export const ORG_GRADE_COLORS = ["#555C66", "#3C7D50", "#2F6B43", "#0F5535", "#0B3D27", "#C8A45A", "#8A5A12"];

export function orgGradeColor(index) {
  const step = Number(index);
  if (!Number.isFinite(step) || step < 0) return ORG_GRADE_COLORS[0];
  return ORG_GRADE_COLORS[step % ORG_GRADE_COLORS.length];
}

const TONE_DOT = {
  ok: "#0B3D27",
  acting: "#C8A45A",
  warn: "#9B2335",
  block: "#9B2335",
  vacant: "#8A5A12",
};

/** Vacant seat meaning. Gold fill stays #FBF3E1 day and night. Dashed edge matches the package. */
const VACANT_BG = "#FBF3E1";
const VACANT_INK = "#8A5A12";
const VACANT_LINE = "#EAD6A8";
const VACANT_DASH = "#D9C08A";
const VACANT_MARK = "#B7791F";
const INITIALS_BG = "#E6F0EA";
const INITIALS_INK = "#0B3D27";

export function OrgLockMark({ size = 18, icon = 11, title = "وحدة ثابتة" }) {
  return (
    <span
      title={title}
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: size > 20 ? 7 : 5,
        background: "#0B3D27",
        border: "1px solid #0B3D27",
        color: "#fff",
        flex: "none",
      }}
    >
      <svg width={icon} height={icon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="7" width="10" height="7" rx="1.5" />
        <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
        <circle cx="8" cy="10.5" r=".6" fill="currentColor" />
      </svg>
    </span>
  );
}

function stripLock(value) {
  return String(value || "").replace(/🔒/g, "").replace(/\s+/g, " ").trim();
}

/** Drop the English Preview token. An Arabic branch name is kept whole. */
function facePlace(value) {
  const raw = String(value || "").trim();
  if (!raw || /\bpreview\b/i.test(raw)) return "";
  return raw;
}

/**
 * One org-tree seat.
 * Band · initials · name · title · NV/date · reserved gold coord line.
 * Occupied stays white (night #1C2922). Vacant stays gold.
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
  branchFace = "",
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
  servesText = "",
  hrLine = "",
  tone = "ok",
  vacant = false,
  avatarUrl = "",
  initials = "?",
  meLabel = "أنت هنا",
  detailsTitle = "ملف الموظف",
  countTitle = "مباشرون / إجمالي — افتح الأغصان",
  coordinate = "",
  kindLock = false,
  bandLabel = "",
  hireStamp = "",
  hireTip = "",
  vacantTag = "",
  dense = false,
  style,
}) {
  const resolvedTone = acting ? "acting" : (vacant ? "vacant" : tone);
  const dot = TONE_DOT[resolvedTone] || TONE_DOT.ok;
  const empty = vacant && !acting;
  const gradeColor = gradeIndex >= 0 ? orgGradeColor(gradeIndex) : "";
  const locked = Boolean(kindLock) || /🔒/.test(String(kindTag || ""));
  const face = stripLock(bandLabel)
    || (empty ? "شاغرة" : "")
    || (acting ? String(actingText || "").split("·")[0].trim() : "")
    || stripLock(kindTag)
    || facePlace(branchFace)
    || facePlace(unit)
    || "—";
  const strong = empty ? (title || name || "—") : (name || "—");
  const sub = empty ? "بانتظار التوظيف" : (title || "—");
  const tagText = isMe
    ? (meLabel || "أنت هنا")
    : empty
      ? (vacantTag || "شاغرة")
      : dense
        ? (empLine || "—")
        : [empLine || "—", hireStamp].filter(Boolean).join(" · ");
  const coord = String(coordinate || "").trim()
    || (hrLine ? `خط متقطع · ${hrLine} · تنسيق الجدول` : "")
    || (servesText ? `يخدم: ${servesText}` : "");
  const bandBg = empty || acting
    ? VACANT_BG
    : resolvedTone === "warn" || resolvedTone === "block"
      ? "var(--nv-bad-soft, #FBEBED)"
      : "var(--nv-org-band, #EEF4F0)";
  const bandInk = empty || acting
    ? VACANT_INK
    : resolvedTone === "warn" || resolvedTone === "block"
      ? "var(--nv-bad-ink, #9B2335)"
      : "var(--nv-org-band-ink, #0B3D27)";
  const showGrade = !dense && Boolean(grade) && !/\bOP\d/i.test(grade) && !/preview/i.test(grade);

  return (
    <div
      data-org-hit="true"
      data-node="1"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      style={{
        userSelect: "none",
        position: "relative",
        width: ORG_NODE_W,
        maxWidth: "100%",
        boxSizing: "border-box",
        background: empty ? VACANT_BG : "var(--nv-card, #fff)",
        border: empty
          ? `1px dashed ${VACANT_DASH}`
          : `1px solid ${selected ? "#0B3D27" : "var(--nv-org-card-line, #DCE3DF)"}`,
        ...( !empty && byGrade && gradeColor ? { borderTop: `3px solid ${gradeColor}` } : {}),
        borderRadius: 6,
        overflow: "hidden",
        boxShadow: isMe
          ? "0 0 0 3px #C8A45A, 0 1px 2px rgba(12,20,16,.05), 0 8px 20px rgba(12,20,16,.07)"
          : selected
            ? "0 0 0 2px #0B3D27, 0 1px 2px rgba(12,20,16,.05), 0 8px 20px rgba(12,20,16,.07)"
            : "0 1px 2px rgba(12,20,16,.05), 0 8px 20px rgba(12,20,16,.07)",
        cursor: "pointer",
        textAlign: "start",
        transition: "transform .15s, box-shadow .15s",
        ...style,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, padding: "6px 12px", minHeight: 30, boxSizing: "border-box", background: bandBg }}>
        <span title={unitTip || gradeTip || actingText || undefined} style={{ flex: "1 1 auto", minWidth: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: bandInk }}>
          {face}
        </span>
        {locked ? <OrgLockMark /> : null}
        {showGrade ? (
          <span title={gradeTip || undefined} style={{ font: "600 10px 'IBM Plex Mono', monospace", padding: "0 6px", borderRadius: 999, background: empty ? "#fff" : "var(--nv-card, #fff)", color: "var(--nv-ink3, #555C66)", border: "1px solid var(--nv-org-card-line, #DCE3DF)", whiteSpace: "nowrap", flex: "none" }}>{grade}</span>
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
            borderRadius: "50%",
            flex: "none",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            padding: 0,
            overflow: "visible",
            fontFamily: "inherit",
            ...(empty
              ? { border: `1.5px dashed ${VACANT_DASH}`, color: VACANT_MARK, background: "#fff" }
              : { border: "none", background: INITIALS_BG, color: INITIALS_INK }),
          }}
        >
          {avatarUrl && !empty
            ? <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} />
            : (empty ? "＋" : initials)}
          {!empty ? (
            <span aria-hidden style={{ position: "absolute", bottom: -1, insetInlineEnd: -1, width: 11, height: 11, borderRadius: "50%", border: "2px solid var(--nv-card, #fff)", background: dot }} />
          ) : null}
        </button>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1, gap: 2 }}>
          <strong
            title={strong}
            onClick={(event) => {
              if (!onNameClick) return;
              event.stopPropagation();
              onNameClick(event);
            }}
            style={{
              cursor: onNameClick ? "pointer" : "inherit",
              color: empty ? VACANT_INK : "var(--nv-ink, #111418)",
              fontSize: 13.5,
              lineHeight: 1.35,
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {strong}
          </strong>
          <span title={sub} style={{ fontSize: 11.5, color: "var(--nv-ink3, #555C66)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {sub}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, padding: "6px 12px 10px", minHeight: 38, boxSizing: "border-box" }}>
        <span
          dir={isMe ? undefined : "ltr"}
          title={hireTip || undefined}
          style={{
            ...ORG_MONO,
            minWidth: 0,
            direction: isMe ? undefined : "ltr",
            unicodeBidi: "isolate",
            fontSize: 10.5,
            fontWeight: isMe ? 700 : 500,
            color: empty || isMe ? VACANT_INK : "var(--nv-ink3, #555C66)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {tagText || "—"}
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
              flex: "none",
              ...(countOpen
                ? { background: "#0B3D27", color: "#fff", border: "1px solid #0B3D27" }
                : { background: "var(--nv-org-band, #EEF4F0)", color: "var(--nv-org-band-ink, #0B3D27)", border: "1px solid #CFE0D6" }),
            }}
          >
            {count} {countOpen ? "▴" : "▾"}
          </button>
        ) : null}
      </div>
      {dense ? null : (
        <div title={coord || undefined} style={{ margin: "0 12px 10px", paddingTop: 6, borderTop: "1px dashed #EAD6A8", fontSize: 10.5, lineHeight: 1.6, color: VACANT_INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minHeight: 18 }}>
          {coord || "\u00a0"}
        </div>
      )}
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
    border: `1px solid ${on ? "var(--nv-box, #C3CBD8)" : "var(--nv-line)"}`,
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
    borderRadius: 8,
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
    borderRadius: 8,
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
