import React from "react";
import { activeNecessities, necessityId, necessityText, NECESSITY_CAP_DAYS } from "@/lib/consentEffects";
import { regulationDate } from "@/lib/workRegulation";
import { endNecessityAssignment } from "@/lib/employeeStationTransfer";
import { toast } from "@/components/ui/use-toast";

/**
 * Temporary assignments under incidental necessity (Arts. 58/2 and 60) on this file: how long is
 * left, what happens when it ends, and one action to end it now — the posting goes back to its
 * branch, or the previous title comes back. Overdue days are shown and count toward the 30.
 */
export default function NecessityCard({ employee, companyId, actor, canManage = false, ar = true, onDone }) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
  const items = activeNecessities(employee, today);
  if (!items.length) return null;

  const end = (item) => {
    const res = endNecessityAssignment(companyId, { employeeId: employee.id, entryId: necessityId(item.row), actor });
    if (!res.ok) {
      toast({ description: ar ? res.reason : res.reasonEn, variant: "destructive" });
      return;
    }
    toast({ description: item.row.kind === "site" ? (ar ? `أُعيد ${employee.name} إلى ${item.row.fromStationName || "فرعه"}.` : "Returned to the original branch.") : (ar ? `عاد مسمّى ${employee.name} «${item.row.fromTitle || ""}».` : "The previous title is restored.") });
    onDone?.();
  };

  return (
    <section data-necessity-card="1" style={{ background: "var(--nv-card)", border: `1px solid ${items.some((i) => i.over) ? "var(--nv-bad-line)" : "var(--nv-warn-line)"}`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: items.some((i) => i.over) ? "var(--nv-bad-soft)" : "var(--nv-warn-soft)", borderBottom: "1px solid var(--nv-line2, #EEF1EF)" }}>
        <span aria-hidden style={{ width: 14, height: 2, background: "#C8A45A", borderRadius: 4 }} />
        <strong style={{ fontSize: 13, color: "var(--nv-ink)" }}>{ar ? "تكليف مؤقت لضرورة عارضة" : "Temporary assignment (incidental necessity)"}</strong>
        <span style={{ fontSize: 11.5, color: "var(--nv-ink2)" }}>
          {ar ? `حتى ${NECESSITY_CAP_DAYS} يوماً في السنة دون موافقته — المسؤولون يُنبَّهون قبل 3 أيام وفي آخر يوم وعند التجاوز` : `Up to ${NECESSITY_CAP_DAYS} days a year without consent — managers are reminded 3 days ahead, on the day, and when overdue`}
        </span>
      </div>
      {items.map((item) => (
        <div key={necessityId(item.row)} data-necessity-row={item.row.kind} style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, alignItems: "center", borderBottom: "1px solid var(--nv-line2, #EEF1EF)" }}>
          <span style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <span style={{ fontSize: 12.5, color: item.over ? "var(--nv-bad-ink)" : "var(--nv-ink)", lineHeight: 1.7 }}>{necessityText(item, employee.name, ar)}</span>
            <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>
              {ar ? `من ${regulationDate(item.row.from)} · المستخدم هذه السنة ${item.used} من ${NECESSITY_CAP_DAYS}${item.row.by ? ` · سجّله ${item.row.by}` : ""}` : `From ${item.row.from} · used ${item.used} of ${NECESSITY_CAP_DAYS} this year`}
            </span>
          </span>
          {canManage ? (
            <button type="button" data-necessity-end="1" onClick={() => end(item)} style={{ fontFamily: "inherit", height: 36, padding: "0 14px", borderRadius: 10, border: "none", background: "#0B3D27", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
              {item.row.kind === "site" ? (ar ? "أعده الآن" : "Return now") : (ar ? "أعد المسمّى السابق" : "Restore the title")}
            </button>
          ) : null}
        </div>
      ))}
    </section>
  );
}
