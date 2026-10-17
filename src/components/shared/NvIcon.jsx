import React from "react";

/**
 * NvIcon — the platform's one line-icon family («رموز المنصة»).
 *
 * Master style is the rights mark (the «حقك / التزامك» scale, the same geometry as the lucide
 * `Scale` used in the rail and on «حقوقي»): 24 viewBox, 1.75 stroke, round caps and joins,
 * currentColor, drawn at 14–16px. Every other glyph is derived from it: the scale's base bar
 * (7→17) is the hourglass's top and bottom, its pans' rounded bowls are the hourglass bulbs and the
 * sand, and its 3px outer margin is every glyph's margin.
 *
 * Colour follows the surrounding text, or a `tone` that maps to the status tokens:
 * accent / ok → green, warn → amber, bad → danger, muted → neutral. Status colour is meaning only.
 *
 * Decorative by default (aria-hidden). Pass `label` (Arabic) when the icon carries meaning on its own.
 */

const TONES = {
  accent: "var(--nv-ok-ink)",
  ok: "var(--nv-ok-ink)",
  warn: "var(--nv-warn-ink)",
  bad: "var(--nv-bad-ink)",
  muted: "var(--nv-muted)",
};

/** Each glyph: an array of [tag, attrs]. `fill: true` marks a solid shape (sand, keyhole dot). */
const GLYPHS = {
  // Master — the rights scale (lucide Scale geometry, balanced).
  scale: [
    ["path", { d: "m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" }],
    ["path", { d: "m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" }],
    ["path", { d: "M7 21h10" }],
    ["path", { d: "M12 3v18" }],
    ["path", { d: "M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" }],
  ],
  // Pending — the scale's base bar as cap and foot, two bulbs, sand settling below.
  pending: [
    ["path", { d: "M7 3h10" }],
    ["path", { d: "M7 21h10" }],
    ["path", { d: "M8 3v3c0 2 1.5 3.5 4 6 2.5-2.5 4-4 4-6V3" }],
    ["path", { d: "M8 21v-3c0-2 1.5-3.5 4-6 2.5 2.5 4 4 4 6v3" }],
    ["path", { d: "M9.9 7.5h4.2c-.5.8-1.1 1.5-2.1 2.5-1-1-1.6-1.7-2.1-2.5Z", fill: true, opacity: 0.45 }],
    ["path", { d: "M9.4 19.8c.6-1.5 1.5-2.2 2.6-2.2s2 .7 2.6 2.2Z", fill: true }],
  ],
  check: [["path", { d: "M5 12.5 9.5 17 19 7" }]],
  cross: [["path", { d: "M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" }]],
  warning: [
    ["path", { d: "M10.3 4.3 2.7 17.6A2 2 0 0 0 4.4 20.5h15.2a2 2 0 0 0 1.7-2.9L13.7 4.3a2 2 0 0 0-3.4 0Z" }],
    ["path", { d: "M12 9.5v4" }],
    ["path", { d: "M12 17h.01" }],
  ],
  lock: [
    ["rect", { x: 5, y: 11, width: 14, height: 10, rx: 2 }],
    ["path", { d: "M8 11V7.5a4 4 0 0 1 8 0V11" }],
    ["path", { d: "M12 15v2" }],
  ],
  alarm: [
    ["circle", { cx: 12, cy: 13, r: 7.5 }],
    ["path", { d: "M12 9v4l2.5 1.5" }],
    ["path", { d: "M3 6 6 3.5M21 6l-3-2.5" }],
  ],
  clock: [
    ["circle", { cx: 12, cy: 12, r: 9 }],
    ["path", { d: "M12 7v5l3 2" }],
  ],
  search: [
    ["circle", { cx: 11, cy: 11, r: 7 }],
    ["path", { d: "m21 21-4.6-4.6" }],
  ],
  star: [["path", { d: "M12 3.5 14.6 8.8 20.5 9.7 16.25 13.8 17.25 19.6 12 16.85 6.75 19.6 7.75 13.8 3.5 9.7 9.4 8.8Z" }]],
  award: [
    ["circle", { cx: 12, cy: 9, r: 6 }],
    ["path", { d: "M8.5 13.9 7.5 21l4.5-2.5 4.5 2.5-1-7.1" }],
  ],
  location: [
    ["path", { d: "M12 21s-7-5.7-7-11.5a7 7 0 0 1 14 0C19 15.3 12 21 12 21Z" }],
    ["circle", { cx: 12, cy: 9.5, r: 2.5 }],
  ],
  phone: [["path", { d: "M5.5 3h3l1.5 4.5-2.1 1.3a11 11 0 0 0 5.3 5.3l1.3-2.1 4.5 1.5v3a2 2 0 0 1-2 2C10.4 18.5 5.5 13.6 3.5 5a2 2 0 0 1 2-2Z" }]],
  menu: [["path", { d: "M4 7h16M4 12h16M4 17h16" }]],
  home: [["path", { d: "M3.5 10.5 12 3.5l8.5 7V19a2 2 0 0 1-2 2H15v-6H9v6H5.5a2 2 0 0 1-2-2Z" }]],
  "checkbox-on": [
    ["rect", { x: 3.5, y: 3.5, width: 17, height: 17, rx: 3.5 }],
    ["path", { d: "m8 12.2 2.8 2.8L16 9.5" }],
  ],
  "checkbox-off": [["rect", { x: 3.5, y: 3.5, width: 17, height: 17, rx: 3.5 }]],
  // Prayer time — a crescent on the same 3px margin (timeline points, prayer-time hints).
  prayer: [["path", { d: "M19.5 14.6A8 8 0 1 1 9.4 4.5a6.4 6.4 0 0 0 10.1 10.1Z" }]],
  // Nursing hour (Art. 154) — a feeding bottle on the same margin: teat, collar, body with two marks.
  nursing: [
    ["path", { d: "M10.5 6 11 3.5h2l.5 2.5" }],
    ["path", { d: "M9 6h6" }],
    ["path", { d: "M9.5 6 8 9v9.5A2.5 2.5 0 0 0 10.5 21h3a2.5 2.5 0 0 0 2.5-2.5V9l-1.5-3" }],
    ["path", { d: "M8 13h3M8 16.5h3" }],
  ],
};

/** Arabic names, in sheet order (the rights scale first — it is the reference). */
export const NV_ICON_LABELS = {
  scale: "الحق / الالتزام",
  pending: "بانتظار",
  check: "تم",
  cross: "مرفوض",
  warning: "تنبيه",
  lock: "مقفل",
  alarm: "تذكير",
  clock: "الوقت",
  search: "بحث",
  star: "الأعلى",
  award: "تقدير",
  location: "الموقع",
  phone: "هاتف",
  menu: "القائمة",
  home: "الرئيسية",
  "checkbox-on": "محدد",
  "checkbox-off": "غير محدد",
  prayer: "وقت الصلاة",
  nursing: "ساعة الرضاعة",
};

export const NV_ICON_NAMES = Object.keys(NV_ICON_LABELS);

export default function NvIcon({ name, size = 14, strokeWidth = 1.75, tone, label, inline = true, className, style }) {
  const parts = GLYPHS[name];
  if (!parts) return null;
  const color = tone ? TONES[tone] : undefined;
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      data-nv-icon={name}
      className={className}
      style={{ flex: "none", display: inline ? "inline-block" : "block", verticalAlign: inline ? "-0.15em" : undefined, ...(color ? { color } : null), ...style }}
      {...a11y}
    >
      {label ? <title>{label}</title> : null}
      {parts.map(([Tag, { fill, opacity, ...attrs }], i) => (
        <Tag key={i} {...attrs} {...(fill ? { fill: "currentColor", stroke: "none" } : null)} {...(opacity != null ? { opacity } : null)} />
      ))}
    </svg>
  );
}

/**
 * Renders a data mark (step / verdict / gate marks built in lib as plain data): a glyph name
 * («check», «pending»…) becomes its icon; anything else (a number, «!», «—») stays text.
 */
export function NvMark({ mark, size = 12, strokeWidth = 2 }) {
  if (typeof mark === "string" && GLYPHS[mark]) return <NvIcon name={mark} size={size} strokeWidth={strokeWidth} inline={false} />;
  return mark ?? null;
}

/**
 * A search field's glyph, drawn inside the field at the inline start (placeholders cannot hold an
 * icon). The wrapped input keeps its own style; give it `paddingInlineStart: 30`.
 */
export function SearchWrap({ children, style, size = 14 }) {
  return (
    <span style={{ position: "relative", display: "flex", alignItems: "center", minWidth: 0, ...style }}>
      <NvIcon name="search" size={size} inline={false} style={{ position: "absolute", insetInlineStart: 10, color: "var(--nv-muted)", pointerEvents: "none" }} />
      {children}
    </span>
  );
}

/** A shortcut hint as a key cap (Cmd+K), not an icon. */
export function Kbd({ children, style }) {
  return (
    <kbd
      dir="ltr"
      style={{
        fontFamily: "var(--font-mono, ui-monospace, monospace)",
        fontSize: "0.92em",
        lineHeight: 1,
        padding: "2px 5px",
        borderRadius: 4,
        border: "1px solid var(--nv-line)",
        borderBottomWidth: 2,
        background: "var(--nv-card)",
        color: "inherit",
        ...style,
      }}
    >
      {children}
    </kbd>
  );
}
