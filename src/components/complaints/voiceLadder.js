import { splitLabel } from "@/components/shared/EscalationLadder";

/** A voice card as the shared ladder reads it — names, states, and the window of whoever holds it. */
export function voiceLadderSteps(card, ar = true) {
  return (card?.steps || []).map((step) => {
    const { name, role } = splitLabel(step.name);
    const state = step.ladder || "later";
    let note;
    if (state === "skipped") note = step.when;
    if (state === "next") note = ar ? "يصله إن مضت المهلة" : "Gets it if the window passes";
    if (state === "ruled") note = card.outcome === "return" ? (ar ? "أعاده بملاحظة" : "Returned it") : (ar ? "اعتمده" : "Adopted it");
    return { name, role, state, note };
  });
}

export function voiceLadderWindow(card, ar = true) {
  if (!card || card.settled || card.left == null) return null;
  const max = Number(card.ch?.hours) || 48;
  const used = Math.max(0, max - card.left);
  const pct = Math.round((used / max) * 100);
  const hours = Math.abs(Math.round(card.left));
  return {
    pct: card.overdue ? 100 : pct,
    tone: card.overdue ? "bad" : pct > 75 ? "bad" : "gold",
    label: card.overdue
      ? (ar ? `تجاوز المهلة بـ${hours} ساعة — يُرفع للتالي` : `${hours}h past the window — goes up next`)
      : (ar ? `بقي ${hours} ساعة من ${max}` : `${hours}h of ${max}h left`),
  };
}
