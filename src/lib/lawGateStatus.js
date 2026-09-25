/** Law-gate alert status — pill meaning tags for Labour Law / ministerial boards.
 *  Soft fill + 1px border + chip radius 999. Not a thick document top edge.
 */

import { stateChip } from "./designSystem.js";

/** @typedef {"blocked"|"waiting"|"alert"|"settled"|"void"|"coming"|"progress"} LawGateStatus */

export const LAW_GATE_STATUS = {
  blocked: {
    id: "blocked",
    ds: "blocked",
    ar: "مُنع",
    en: "Blocked",
  },
  waiting: {
    id: "waiting",
    ds: "waiting",
    ar: "ينتظر",
    en: "Waiting",
  },
  alert: {
    id: "alert",
    ds: "waiting",
    ar: "تنبيه",
    en: "Alert",
  },
  settled: {
    id: "settled",
    ds: "settled",
    ar: "استقرّ",
    en: "Settled",
  },
  void: {
    id: "void",
    ds: "void",
    ar: "بلا أثر",
    en: "No effect",
  },
  coming: {
    id: "coming",
    ds: "waiting",
    ar: "قادمة",
    en: "Upcoming",
  },
  progress: {
    id: "progress",
    ds: "void",
    ar: "تقدّم",
    en: "Progress",
  },
};

export function lawGateStatusMeta(status) {
  return LAW_GATE_STATUS[status] || LAW_GATE_STATUS.void;
}

/** Build pill label: status word ± person / figure. */
export function lawGatePillLabel(status, { ar = true, who = "", detail = "" } = {}) {
  const meta = lawGateStatusMeta(status);
  const base = ar ? meta.ar : meta.en;
  const bits = [base];
  const whoBit = String(who || "").trim();
  const detailBit = String(detail || "").trim();
  if (whoBit) bits.push(whoBit);
  if (detailBit) bits.push(detailBit);
  if (status === "progress" && detailBit) return detailBit;
  if (bits.length === 1) return base;
  return bits.join(ar ? " · " : " · ");
}

export function lawGatePillStyle(status, extra = {}) {
  const meta = lawGateStatusMeta(status);
  return stateChip(meta.ds, {
    fontSize: 10,
    fontWeight: 700,
    padding: "2px 9px",
    lineHeight: 1.4,
    maxWidth: "100%",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    ...extra,
  });
}

/** Map a week-publish check into a law-gate status. */
export function statusFromWeekCheck(check) {
  if (!check) return "void";
  if (check.ok) return "settled";
  if (check.block) return "blocked";
  return "waiting";
}

/** First personal name list from a check note, best-effort. */
export function whoFromCheckNames(names, max = 2) {
  const list = Array.isArray(names) ? names.filter(Boolean) : [];
  if (!list.length) return "";
  if (list.length <= max) return list.join("، ");
  return `${list.slice(0, max).join("، ")} +${list.length - max}`;
}
