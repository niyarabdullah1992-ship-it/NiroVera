/**
 * Workforce / org chrome — the platform's chrome, not a second one.
 * Cards = slab geometry (--nv-card, 1px --nv-line, radius 12, DS_SHADOW); chips = scheduleChrome chip;
 * figures in IBM Plex Mono (Latin digits); one green accent for "me"/selection; tokens only (dark mode flips).
 * Tree card is 250px wide and grows in height: band, name, job title, meta, footer.
 */

import React from "react";
import { chip, chipButton, mono } from "@/components/schedules/scheduleChrome";
import { DS_RADIUS, DS_SHADOW } from "@/lib/designSystem";

export const ORG_MONO = mono;

/** HTML workforce tree column / card width. */
export const ORG_NODE_W = 250;
/** Tree connector — the platform's mute fill (flips at night). */
export const ORG_TREE_LINE = "var(--nv-mute-fill, var(--nv-line))";

/**
 * «لوّن حسب الدرجة» — one green ramp, light to the deep structure green, repeating after the
 * seventh step. Used as a small swatch only; grade codes themselves are mute mono chips.
 */
export const ORG_GRADE_COLORS = [
  "var(--nv-mute-fill)",
  "color-mix(in oklab, var(--nv-accent) 35%, var(--nv-card))",
  "color-mix(in oklab, var(--nv-accent) 55%, var(--nv-card))",
  "color-mix(in oklab, var(--nv-accent) 78%, var(--nv-card))",
  "var(--nv-accent)",
  "color-mix(in oklab, var(--nv-accent) 55%, var(--nv-navy))",
  "var(--nv-navy)",
];

export function orgGradeColor(index) {
  const step = Number(index);
  if (!Number.isFinite(step) || step < 0) return ORG_GRADE_COLORS[0];
  return ORG_GRADE_COLORS[step % ORG_GRADE_COLORS.length];
}

/** A grade code (م3 · G4 …) — a quiet mute chip with the code in mono. */
export function gradeBadge(extra = {}) {
  return chip("mute", { ...mono, fontSize: 10.5, height: 20, padding: "0 6px", direction: "ltr", unicodeBidi: "isolate", justifyContent: "center", minWidth: 28, ...extra });
}

const TONE_DOT = {
  ok: "var(--nv-ok-fill)",
  acting: "var(--nv-mute-fill)",
  warn: "var(--nv-bad-ink)",
  block: "var(--nv-bad-ink)",
  vacant: "var(--nv-mute-fill)",
};

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
        borderRadius: size > 20 ? 8 : 5,
        background: "var(--nv-soft)",
        border: "1px solid var(--nv-line)",
        color: "var(--nv-ink2)",
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
 * One org-tree seat — slab geometry.
 * Band (unit / kind) · initials · name · title · employee line · coordination line.
 * Vacant = dashed line, transparent fill, muted ink; "me" = the green accent ring; a compliance
 * alert tints only the band (bad soft) — never the whole card.
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
  const alert = resolvedTone === "warn" || resolvedTone === "block";
  const bandBg = alert ? "var(--nv-bad-soft)" : (empty ? "transparent" : "var(--nv-soft)");
  const bandInk = alert ? "var(--nv-bad-ink)" : "var(--nv-ink2)";
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
        background: empty ? "transparent" : "var(--nv-card)",
        border: empty
          ? "1px dashed var(--nv-mute-fill, var(--nv-line))"
          : `1px solid ${isMe ? "var(--nv-accent)" : selected ? "var(--nv-navy)" : "var(--nv-line)"}`,
        borderRadius: DS_RADIUS,
        overflow: "hidden",
        boxShadow: isMe
          ? `0 0 0 3px var(--nv-accent-soft), ${DS_SHADOW}`
          : selected
            ? `0 0 0 2px var(--nv-navy), ${DS_SHADOW}`
            : (empty ? "none" : DS_SHADOW),
        cursor: "pointer",
        textAlign: "start",
        transition: "transform .15s, box-shadow .15s",
        ...style,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, padding: "6px 12px", minHeight: 30, boxSizing: "border-box", background: bandBg, borderBottom: "1px solid var(--nv-line2, var(--nv-line))" }}>
        {!empty && byGrade && gradeColor ? <span aria-hidden data-grade-swatch="1" style={{ width: 8, height: 8, borderRadius: 2, flex: "none", background: gradeColor }} /> : null}
        <span title={unitTip || gradeTip || actingText || undefined} style={{ flex: "1 1 auto", minWidth: 0, fontSize: 10.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: bandInk }}>
          {face}
        </span>
        {locked ? <OrgLockMark /> : null}
        {showGrade ? (
          <span title={gradeTip || undefined} style={gradeBadge({ height: 18, fontSize: 10, flex: "none" })}>{grade}</span>
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
              ? { border: "1.5px dashed var(--nv-mute-fill, var(--nv-line))", color: "var(--nv-muted)", background: "transparent" }
              : { border: "1px solid var(--nv-line)", background: isMe ? "var(--nv-accent-soft)" : "var(--nv-soft)", color: "var(--nv-ink2)" }),
          }}
        >
          {avatarUrl && !empty
            ? <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} />
            : (empty ? "＋" : initials)}
          {!empty ? (
            <span aria-hidden style={{ position: "absolute", bottom: -1, insetInlineEnd: -1, width: 11, height: 11, borderRadius: "50%", border: "2px solid var(--nv-card)", background: dot }} />
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
              color: empty ? "var(--nv-muted)" : "var(--nv-ink)",
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
          <span title={sub} style={{ fontSize: 11.5, color: "var(--nv-ink2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {sub}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, padding: "6px 12px 10px", minHeight: 38, boxSizing: "border-box" }}>
        <span
          dir={isMe ? undefined : "ltr"}
          title={hireTip || undefined}
          style={{
            ...(isMe || empty ? {} : ORG_MONO),
            minWidth: 0,
            direction: isMe ? undefined : "ltr",
            unicodeBidi: "isolate",
            fontSize: 10.5,
            fontWeight: isMe ? 600 : 500,
            color: isMe ? "var(--nv-ok-ink)" : "var(--nv-muted)",
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
              borderRadius: 8,
              ...ORG_MONO,
              fontSize: 11,
              fontWeight: 600,
              direction: "ltr",
              cursor: onCountClick ? "pointer" : "default",
              whiteSpace: "nowrap",
              flex: "none",
              ...(countOpen
                ? { background: "var(--nv-navy)", color: "var(--nv-btn-ink, #fff)", border: "1px solid var(--nv-navy)" }
                : { background: "var(--nv-card)", color: "var(--nv-ink)", border: "1px solid var(--nv-line)" }),
            }}
          >
            {count} {countOpen ? "▴" : "▾"}
          </button>
        ) : null}
      </div>
      {dense ? null : (
        <div title={coord || undefined} style={{ margin: "0 12px 10px", paddingTop: 6, borderTop: "1px solid var(--nv-line2, var(--nv-line))", fontSize: 10.5, lineHeight: 1.6, color: "var(--nv-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minHeight: 18 }}>
          {coord || "\u00a0"}
        </div>
      )}
    </div>
  );
}

/** Column wrapper matching HTML colStyle (250px + side margin). */
export function OrgWorkforceCol({ children, style, nodeId }) {
  return (
    <div
      data-org-node={nodeId || undefined}
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
  gap: 16,
};

/** Quiet chip-shaped control (platform chipButton, off). */
export function orgNavChip() {
  return chipButton(false, { height: 28, padding: "0 11px", fontSize: 11.5 });
}

/** Filter chip (platform chipButton; on = navy). */
export function orgKindChip(on = false) {
  return chipButton(on, { fontSize: 11 });
}

/**
 * One fold row inside a slab — chevron · 13/700 title · muted note on the start side, a mono
 * meta on the end side; the body opens below with the slab's 18px gutter. Same rhythm as the
 * schedule's Collapsible, kept controlled so the summary links can open a fold from afar.
 */
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
    <article style={{ borderBottom: "1px solid var(--nv-line2, var(--nv-line))", minWidth: 0, ...articleStyle }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", flexWrap: "wrap", minWidth: 0 }}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={Boolean(open)}
          style={{ all: "unset", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontFamily: "inherit", color: "var(--nv-ink)", flex: "1 1 220px", minWidth: 0 }}
        >
          <span className="nv-org-fold-chevron" data-open={open ? "1" : "0"} aria-hidden style={{ fontSize: 11, color: "var(--nv-muted)", flex: "none" }}>▸</span>
          <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
            <strong style={{ fontSize: 13, fontWeight: 700 }}>{title}</strong>
            {meta != null ? <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.55 }}>{meta}</span> : null}
          </span>
        </button>
        {extra ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>{extra}</span> : null}
      </div>
      {open ? <div style={{ padding: "0 18px 16px", display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>{children}</div> : null}
    </article>
  );
}
