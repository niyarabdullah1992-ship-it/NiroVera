/**
 * Calm cards — status as a word, not a stripe.
 * Cards carry no coloured top/side edge. When a card's tone means
 * "needs attention" (warn) or "action needed" (bad), a small text chip sits
 * beside its label. ok / neutral / mute tones show no colour at all.
 */

const WARN_TONES = new Set(["warn", "watch", "waiting", "late", "alert", "pending", "open", "due", "verify", "gold", "amber"]);
const BAD_TONES = new Set(["bad", "urgent", "blocked", "danger", "absent", "exposed", "critical", "over", "overdue", "error", "invalid", "red"]);

/** "warn" | "bad" | null — null means the card stays colourless. */
export function flagKind(tone) {
  const key = String(tone || "").trim();
  if (WARN_TONES.has(key)) return "warn";
  if (BAD_TONES.has(key)) return "bad";
  return null;
}

export const FLAG_DEFAULT_TEXT = {
  warn: { ar: "يحتاج متابعة", en: "Needs attention" },
  bad: { ar: "يحتاج إجراء", en: "Action needed" },
};

/** The chip word: the caller's specific flag when it knows one, else the default. */
export function flagText(tone, ar = true, flag = "") {
  const kind = flagKind(tone);
  if (!kind) return "";
  if (flag) return String(flag);
  return ar ? FLAG_DEFAULT_TEXT[kind].ar : FLAG_DEFAULT_TEXT[kind].en;
}

/** Pill style on the existing --nv-{warn,bad}-{soft,ink,line} tokens (dark mode flips them). */
export function flagStyle(tone, extra = {}) {
  const kind = flagKind(tone);
  if (!kind) return null;
  return {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    flex: "none",
    fontSize: 10.5,
    fontWeight: 700,
    lineHeight: 1.5,
    padding: "2px 8px",
    borderRadius: 999,
    background: `var(--nv-${kind}-soft)`,
    color: `var(--nv-${kind}-ink)`,
    border: `1px solid var(--nv-${kind}-line)`,
    whiteSpace: "nowrap",
    ...extra,
  };
}

/* ── KPI / number-card law ────────────────────────────────────────────────
 * 1. The big number is always ink (same mono font) — never red/gold/green.
 * 2. A chip appears only for a real problem and must say something the label doesn't.
 * 3. Queues / pending decisions are actions, not problems: no chip, a green action link.
 * 4. Score tiles: ink number + thin meter; chip only below a clear floor, with specific text.
 * 6. Platform green is the only action colour; red/gold live only inside small chips.
 */

/** Ink for every KPI big number (dark mode flips the token). */
export const KPI_INK = "var(--nv-ink)";
/** Platform green for action text (links) — readable in both themes. */
export const KPI_ACTION_INK = "var(--nv-ok-ink)";
/** Platform green for meter fill / primary actions. */
export const KPI_ACTION_FILL = "var(--nv-btn-fill)";
/** Readiness index floor — below it the tile earns a chip. */
export const READINESS_FLOOR = 60;

const norm = (s) => String(s ?? "").replace(/[\s‏‎«»"'.:·،,]+/g, " ").trim().toLowerCase();

/** True when a chip would just repeat its card label (or the label contains it). */
export function chipRepeatsLabel(chip, label) {
  const c = norm(chip);
  const l = norm(label);
  if (!c || !l) return false;
  if (c === l || l.includes(c)) return true;
  // Word level, ignoring the Arabic article: «حسم نافذ» repeats «إجمالي الحسم النافذ».
  const bare = (w) => (w.length > 3 && w.startsWith("ال") ? w.slice(2) : w);
  const labelWords = new Set(l.split(" ").map(bare));
  return c.split(" ").map(bare).every((w) => labelWords.has(w));
}

/**
 * The chip word for a KPI tile, or "" when the tile should carry no chip:
 * no warn/bad tone, or the chip would repeat the label.
 */
export function kpiFlagText({ tone, flag = "", label = "", ar = true } = {}) {
  const text = flagText(tone, ar, flag);
  if (!text) return "";
  if (chipRepeatsLabel(text, label)) return "";
  return text;
}

/** Score tile: tone + specific chip text, or no chip at/above the floor. */
export function scoreFlag(value, { floor = READINESS_FLOOR, ar = true } = {}) {
  const v = Number(value);
  if (!Number.isFinite(v) || v >= floor) return { tone: null, flag: "" };
  return { tone: "warn", flag: ar ? `أقل من ${floor}` : `Below ${floor}` };
}

/** Thin meter (4px, rounded) — track hairline, fill platform green. */
export function meterStyles(value, max = 100) {
  const m = Number(max) > 0 ? Number(max) : 100;
  const pct = Math.max(0, Math.min(100, Math.round(((Number(value) || 0) / m) * 100)));
  return {
    pct,
    track: { display: "block", width: "100%", height: 4, borderRadius: 999, background: "var(--nv-line2)", overflow: "hidden", marginTop: 4 },
    fill: { display: "block", height: "100%", width: `${pct}%`, borderRadius: 999, background: KPI_ACTION_FILL },
  };
}

/** Small green action line at the bottom of a queue tile. */
export function kpiActionText(ar = true, arText = "", enText = "") {
  return ar ? `${arText || "افتح القرار"} ›` : `${enText || "Open the decision"} ›`;
}

export const kpiActionStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  width: "fit-content",
  marginTop: 2,
  fontSize: 11.5,
  fontWeight: 700,
  color: KPI_ACTION_INK,
  textDecoration: "none",
  whiteSpace: "nowrap",
};
