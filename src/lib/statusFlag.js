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
