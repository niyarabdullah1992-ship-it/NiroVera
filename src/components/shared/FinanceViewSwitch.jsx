import React from "react";
import { MUTED, ui } from "@/lib/platformStyles";
import { FINANCE_VIEW_COPY, MANAGE, SELF } from "@/lib/financeRights";

/**
 * Names the lens the money surface is rendering. An account that holds management
 * rights may step down to its own row; an account that does not gets the label with
 * no control beside it, because there is nothing it could switch to — the view is
 * derived from rights, never claimed by pressing something.
 */
export default function FinanceViewSwitch({ ar, view, canManage, onChange, showSwitch = true }) {
  const copy = FINANCE_VIEW_COPY[view] || FINANCE_VIEW_COPY.self;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 11, color: MUTED }}>{ar ? copy.ar : copy.en}</span>
      {canManage && showSwitch ? (
        <button
          type="button"
          onClick={() => onChange?.(view === MANAGE ? SELF : MANAGE)}
          style={{ ...ui.btnSecondary, height: 30 }}
        >
          {ar ? copy.switchAr : copy.switchEn}
        </button>
      ) : null}
    </div>
  );
}
