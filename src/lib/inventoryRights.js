/**
 * Who may buy, issue, request and review on the inventory surface.
 * Built on the shared money model in lib/financeRights.js. Every refusal here
 * carries a named Arabic reason — the surface used to throw English strings that
 * an Arabic operator could not act on.
 */
import { SENIOR_ROLES, STATION_ROLES, STOCK_ROLES } from "@/lib/financeRights";

const SENIOR_LIST = [...SENIOR_ROLES, "pgm"];
const STATION_OP_ROLES = ["station_manager", ...STOCK_ROLES];

/**
 * `auth` is the normalised actor the fallback already builds
 * ({ userId, role, owner, stationId, managedStations }).
 */
export function inventoryRights(auth) {
  const senior = auth.owner || SENIOR_LIST.includes(auth.role);
  const stationOp = STATION_OP_ROLES.includes(auth.role);
  const employee = auth.role === "employee";
  return {
    senior,
    stationOp,
    employee,
    canPurchase: senior || stationOp,
    canCreateItem: senior || stationOp,
    canIssueToWork: senior || stationOp,
    canIssueFromAnyStation: senior,
    canRequest: senior || stationOp || employee,
    canReviewRequests: senior || stationOp,
    canReviewAllRequests: senior,
    canDelete: senior || STATION_ROLES.includes(auth.role),
    canReverse: senior,
    canViewNetwork: senior || stationOp,
  };
}

/** Stations a reviewer actually covers: home station plus explicit extra coverage. */
export function inventoryReach(auth) {
  return new Set([auth.stationId, ...(auth.managedStations || [])].map((id) => String(id || "").trim()).filter(Boolean));
}

/**
 * Stock leaves the *supplying* station, so the decision belongs to that station —
 * not to whoever asked for it. Without this a manager could raise a request against
 * another branch and approve it himself, moving stock with no second pair of eyes.
 */
export function checkStockReviewGate(auth, rights, request) {
  if (!rights.canReviewRequests) return { ok: false, ...INVENTORY_DENY.REVIEW };
  // Same shape as checkAssetTransferReviewGate: senior management is the terminal
  // authority, everyone else needs the supplying station and a second pair of eyes.
  if (rights.canReviewAllRequests) return { ok: true };
  const source = String(request?.sourceStationId || "");
  if (source && !inventoryReach(auth).has(source)) return { ok: false, ...INVENTORY_DENY.REVIEW_OUT_OF_REACH };
  if (request && String(request.requesterId || "") === String(auth.userId)) {
    return { ok: false, ...INVENTORY_DENY.REVIEW_SELF };
  }
  return { ok: true };
}

export const INVENTORY_DENY = {
  PURCHASE: {
    error: "STOCK_PURCHASE_DENIED",
    reason: "تسجيل شراء المخزون لمدير الفرع أو أمين المخزن.",
    reasonEn: "Recording a stock purchase is for the station manager or the stock keeper.",
  },
  ISSUE: {
    error: "STOCK_ISSUE_DENIED",
    reason: "الصرف للعمل لمدير الفرع أو أمين المخزن — الطلب متاح لك.",
    reasonEn: "Issuing to work is for the station manager or the stock keeper — requesting is open to you.",
  },
  REVIEW: {
    error: "STOCK_REVIEW_DENIED",
    reason: "مراجعة طلبات المخزون لمدير الفرع المالك أو الإدارة.",
    reasonEn: "Reviewing stock requests is for the owning station manager or management.",
  },
  DELETE: {
    error: "STOCK_DELETE_DENIED",
    reason: "حذف صنف من المخزون لمدير الفرع أو الإدارة.",
    reasonEn: "Archiving an item is for the station manager or management.",
  },
  DELETE_OUT_OF_REACH: {
    error: "STOCK_DELETE_OUT_OF_REACH",
    reason: "لهذا الصنف رصيد في فرع خارج نطاقك — حذفه للإدارة أو لمدير ذلك الفرع.",
    reasonEn: "This item still holds stock at a station outside your scope — archiving it belongs to management or that station's manager.",
  },
  REVERSE: {
    error: "STOCK_REVERSE_DENIED",
    reason: "عكس حركة مخزون للإدارة العليا فقط.",
    reasonEn: "Reversing a stock movement is for senior management only.",
  },
  REVIEW_SELF: {
    error: "STOCK_SELF_REVIEW_DENIED",
    reason: "لا يعتمد الطلب من رفعه.",
    reasonEn: "The requester cannot approve their own request.",
  },
  REVIEW_OUT_OF_REACH: {
    error: "STOCK_REVIEW_OUT_OF_REACH",
    reason: "مراجعة الطلب لفرع المصدر — هذا الطلب خارج نطاقك.",
    reasonEn: "The supplying station reviews this request — it sits outside your scope.",
  },
  REQUEST: {
    error: "STOCK_REQUEST_DENIED",
    reason: "طلب مادة من فرع آخر لموظفي الفروع — لا يملك حسابك هذه الصلاحية.",
    reasonEn: "Requesting material from another station is for station staff — your account does not hold that right.",
  },
};

/**
 * Why a reversal was refused, by the code `movementReversalBlock` returns plus the
 * two runtime checks the gate makes on its own. These used to be English strings
 * thrown from the handler, which an Arabic operator could not act on — and now the
 * ledger has a button, so they reach the screen.
 */
export const REVERSAL_DENY = {
  MOVEMENT_NOT_FOUND: {
    error: "MOVEMENT_NOT_FOUND",
    reason: "الحركة غير موجودة في الدفتر.",
    reasonEn: "The movement is not on the ledger.",
  },
  MOVEMENT_REVERSAL_ROW: {
    error: "MOVEMENT_NOT_REVERSIBLE",
    reason: "هذه حركة عكسية — الحركة العكسية لا تُعكس.",
    reasonEn: "This is already a reversal row — a reversal is not reversed.",
  },
  MOVEMENT_ALREADY_REVERSED: {
    error: "MOVEMENT_ALREADY_REVERSED",
    reason: "هذه الحركة عُكست مرة — لا تُعكس مرتين.",
    reasonEn: "This movement was reversed once — it is not reversed twice.",
  },
  MOVEMENT_NOT_REVERSIBLE: {
    error: "MOVEMENT_NOT_REVERSIBLE",
    reason: "نوع هذه الحركة لا يُعكس.",
    reasonEn: "This movement type cannot be reversed.",
  },
  REVERSAL_REASON_REQUIRED: {
    error: "REVERSAL_REASON_REQUIRED",
    reason: "اكتب سبب العكس — يُقيَّد على الحركة المعاكسة.",
    reasonEn: "Write the reversal reason — it is recorded on the compensating movement.",
  },
  MOVEMENT_ITEM_NOT_FOUND: {
    error: "MOVEMENT_ITEM_NOT_FOUND",
    reason: "صنف هذه الحركة غير موجود في السجل.",
    reasonEn: "The item on this movement is not in the register.",
  },
  INSUFFICIENT_REVERSAL_STOCK: {
    error: "INSUFFICIENT_REVERSAL_STOCK",
    reason: "لا يمكن العكس — هذه الكمية صُرفت أو نُقلت بعد الحركة. اعكس الأحدث أولًا.",
    reasonEn: "Cannot reverse — this quantity was issued or moved after the movement. Reverse the newer rows first.",
  },
};

export function reversalDeny(code) {
  return REVERSAL_DENY[String(code || "")] || REVERSAL_DENY.MOVEMENT_NOT_REVERSIBLE;
}
