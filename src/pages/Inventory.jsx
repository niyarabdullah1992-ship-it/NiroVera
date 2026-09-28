import React, { useEffect, useMemo, useState } from "react";
import SuiteWorkspaceFrame from "@/components/shared/SuiteWorkspaceFrame";
import { useAuth } from "@/lib/PowerCareAuth";
import { useI18n } from "@/lib/i18n";
import { localInventoryCall } from "@/lib/localInventoryFallback";
import { isShortSku, movementReversalBlock, qtyAtStation } from "@/lib/inventoryDerivations";
import { reversalDeny } from "@/lib/inventoryRights";
import ReverseMovementDialog from "@/components/inventory/ReverseMovementDialog";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { toast } from "@/components/ui/use-toast";
import { namedServiceReason } from "@/lib/serviceErrors";
import { useSearchParams } from "react-router-dom";
import KpiStrip from "@/components/shared/KpiStrip";
import { pageKicker } from "@/lib/moduleMeta";
import useStationScope, { matchesStationScope } from "@/hooks/useStationScope";
import PlatformDateField from "@/components/shared/PlatformDateField";
import { MUTED, NAVY, cardShell, field, labelMuted, tableShell, ui, SURFACE } from "@/lib/platformStyles";
import FinanceViewSwitch from "@/components/shared/FinanceViewSwitch";
import { MANAGE, SELF, SELF_VIEW_NOTE, canManageSurface, resolveFinanceView } from "@/lib/financeRights";
import { useRailSide } from "@/lib/railSide";

// Buying, issuing and reviewing are decisions; asking for material and reading what
// was issued to you are not. Balances stay on both sides because the surface is built
// on every station seeing the others' stock in order to request from it.
const MANAGE_TABS = [
  ["items", "رصيد الفروع", "Station balances"],
  ["purchases", "شراء الفرع", "Station purchase"],
  ["requests", "طلب من فرع آخر", "Request from another station"],
  ["issue", "الصرف للعمل", "Issue to work"],
  ["movements", "دفتر الحركات", "Movement ledger"],
];
const SELF_TABS = [
  ["items", "رصيد الفروع", "Station balances"],
  ["requests", "طلب مادة", "Request material"],
  ["mine", "ما صُرف لي", "Issued to me"],
];

// A request status is a state in the chain, so it is read as one. The raw keys are
// storage identifiers and must never reach an Arabic-first screen.
const REQUEST_STATUS = {
  pending: ["بانتظار فرع المصدر", "Awaiting the supplying station"],
  issued: ["نُفّذ", "Done"],
  done: ["نُفّذ", "Done"],
  rejected: ["مرفوض", "Rejected"],
};

function requestStatusLabel(status, ar) {
  const pair = REQUEST_STATUS[String(status || "")];
  return pair ? (ar ? pair[0] : pair[1]) : (ar ? "غير معروف" : "Unknown");
}

// A movement type is read, never printed raw — the ledger is an Arabic-first surface
// and «reversal» used to leak through as a Latin word.
const MOVEMENT_TYPE = {
  purchase: ["شراء", "Buy"],
  شراء: ["شراء", "Buy"],
  transfer: ["نقل", "Transfer"],
  نقل: ["نقل", "Transfer"],
  issue: ["صرف", "Issue"],
  صرف: ["صرف", "Issue"],
  return: ["إرجاع", "Return"],
  receive: ["استلام", "Receive"],
  reversal: ["عكس", "Reversal"],
};

function movementTypeLabel(type, ar) {
  const pair = MOVEMENT_TYPE[String(type || "")];
  return pair ? (ar ? pair[0] : pair[1]) : (ar ? "غير معروف" : "Unknown");
}

function asList(value) {
  return Array.isArray(value) ? value.filter((row) => row && typeof row === "object") : [];
}

function stationIdOf(station) {
  return station?.stationId || station?.id || "";
}

/** Defaults are closed: if the board cannot be read, nothing is offered rather than
 *  everything. The gates refuse regardless, but the screen should not invite a click
 *  it knows will be thrown back. */
function emptyBoard(stations = [], employees = []) {
  return {
    items: [],
    movements: [],
    purchases: [],
    requests: [],
    stations,
    locations: stations,
    employees,
    canPurchase: false,
    canRequest: false,
    canIssueToWork: false,
    canReviewRequests: false,
    canReverse: false,
  };
}

function readBoard(session, stations) {
  try {
    const next = localInventoryCall(session, "list", { stations });
    return {
      ...emptyBoard(stations),
      ...next,
      items: asList(next.items),
      movements: asList(next.movements),
      purchases: asList(next.purchases),
      requests: asList(next.requests),
      stations: asList(next.stations || next.locations || stations),
      locations: asList(next.locations || next.stations || stations),
      employees: asList(next.employees),
    };
  } catch (error) {
    console.error("NiroVera inventory board:", error);
    return emptyBoard(stations);
  }
}

export default function Inventory() {
  const { session, currentUser, data } = useAuth();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const scope = useStationScope();
  const scopedToOne = scope !== "all";
  const [searchParams, setSearchParams] = useSearchParams();
  const canManage = canManageSurface("inventory", currentUser, data);
  const railSide = useRailSide();
  const view = resolveFinanceView("inventory", currentUser, data, searchParams.get("view"), railSide);
  const tabDefs = view === MANAGE ? MANAGE_TABS : SELF_TABS;
  const tabKeys = new Set(tabDefs.map(([key]) => key));
  const requested = searchParams.get("tab");
  const tab = tabKeys.has(requested) ? requested : "items";
  const setTab = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value === "items") next.delete("tab");
    else next.set("tab", value);
    setSearchParams(next, { replace: true });
  };
  const setView = (value) => {
    const next = new URLSearchParams(searchParams);
    next.delete("tab");
    if (value === SELF) next.set("view", SELF);
    else next.delete("view");
    setSearchParams(next, { replace: true });
  };
  const [itemView, setItemView] = useState("matrix");
  const [board, setBoard] = useState(() => emptyBoard());
  const [busy, setBusy] = useState(false);
  const [reversing, setReversing] = useState(null);

  const stations = asList(board.locations.length ? board.locations : data?.stations);
  const employees = asList(board.employees.length ? board.employees : data?.employees);
  const tree = data?.stations || [];
  const scopedStations = stations.filter((station) => matchesStationScope(stationIdOf(station), scope, tree));
  const lockedStationId = scopedToOne ? scope : "";

  const reload = () => {
    if (!session?.companyId) return;
    setBoard(readBoard(session, asList(data?.stations)));
  };

  useEffect(() => { reload(); }, [session?.companyId, (data?.stations || []).length]);

  const run = (action, payload, done) => {
    setBusy(true);
    try {
      localInventoryCall(session, action, payload);
      reload();
      toast({ description: (ar ? done?.ar : done?.en) || (ar ? "تم حفظ العملية." : "Saved.") });
      return true;
    } catch (error) {
      toast({
        description: namedServiceReason(error, ar, {
          ar: "لم تُقبل العملية — البوابة سمّت السبب.",
          en: "The action was refused — the gate names the reason.",
        }),
        variant: "destructive",
      });
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!currentUser) return null;

  const items = asList(board.items).filter((item) => {
    if (!scopedToOne) return true;
    const balances = item.locationBalances;
    if (Array.isArray(balances) && balances.length) {
      return balances.some((entry) => matchesStationScope(entry.locationId, scope, tree));
    }
    return matchesStationScope(item.currentLocationId, scope, tree);
  });
  const purchases = asList(board.purchases).filter((row) => matchesStationScope(row.toLocationId, scope, tree));
  const requests = asList(board.requests).filter((row) =>
    matchesStationScope(row.stationId, scope, tree) || matchesStationScope(row.sourceStationId, scope, tree),
  );
  const movements = asList(board.movements).filter((row) =>
    matchesStationScope(row.fromLocationId, scope, tree) || matchesStationScope(row.toLocationId, scope, tree),
  );
  const qtyOf = (item) => (scopedToOne ? qtyAtStation(item, scope) : (Number(item.quantity) || 0));
  // The matrix, the list and this counter must agree, so all three ask the shared
  // derivation the same question instead of each re-inventing the threshold test.
  const isLow = (item) => isShortSku({ onHand: qtyOf(item), reorder: Number(item.minimumStock || 0) });
  const low = items.filter(isLow).length;
  const pending = requests.filter((request) => request.status === "pending").length;
  const stationName = (id) => stations.find((station) => stationIdOf(station) === id)?.name || "—";
  const itemName = (id) => asList(board.items).find((item) => item.id === id)?.name || "—";
  const personName = (id) => employees.find((row) => row.id === id || row.employeeId === id)?.name || "—";
  // A transfer's justification is the reason written on the request, not its storage id.
  const requestReason = (id) => asList(board.requests).find((row) => row.id === id)?.notes || "";
  // A missing station on a movement means something different per direction, so the
  // ledger says which: stock enters from a supplier, leaves onto work, and a reversal
  // sends it back the way it came.
  const fromLabel = (row) => {
    if (row.fromLocationId) return stationName(row.fromLocationId);
    if (row.movementType === "reversal") return ar ? "رُجّع من العمل" : "Returned from work";
    return ar ? "مورّد خارجي" : "External supplier";
  };
  const toLabel = (row) => {
    if (row.toLocationId) return stationName(row.toLocationId);
    if (row.movementType === "reversal") return ar ? "رُدّ إلى المورّد" : "Returned to supplier";
    return ar ? "استُهلك في العمل" : "Consumed on work";
  };
  const scopedEmployees = employees.filter((row) => !scopedToOne || matchesStationScope(row.stationId, scope, tree));

  // «ما صُرف لي» is the ledger read through one person: what left a balance and
  // landed on them, with the work reference that justified it.
  const myIssues = movements.filter((row) =>
    row.movementType === "issue" && String(row.employeeId || "") === String(currentUser?.id || ""));
  const myRequests = requests.filter((row) => String(row.requesterId || "") === String(currentUser?.id || ""));
  const myPending = myRequests.filter((row) => row.status === "pending").length;

  // The reverse path is live in both layers; the ledger is where it belongs, because
  // a wrong movement is found by reading the ledger. What cannot be reversed says why
  // instead of showing a dead button.
  const reverseCell = (row) => {
    const block = movementReversalBlock(row);
    if (!block) {
      return (
        <button
          type="button"
          disabled={busy}
          onClick={() => setReversing(row)}
          style={{ ...ui.btnDanger, height: 28, padding: "0 10px" }}
        >
          {ar ? "عكس الحركة" : "Reverse"}
        </button>
      );
    }
    const note = block === "MOVEMENT_ALREADY_REVERSED"
      ? (ar ? `عُكست — ${row.reversalReason || "بلا سبب مكتوب"}` : `Reversed — ${row.reversalReason || "no reason written"}`)
      : block === "MOVEMENT_REVERSAL_ROW"
        ? (ar ? `عكس الحركة ${row.reversalMovementNumber || "—"}` : `Reversal of ${row.reversalMovementNumber || "—"}`)
        : (ar ? reversalDeny(block).reason : reversalDeny(block).reasonEn);
    return <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.6 }}>{note}</span>;
  };

  // Archiving is live in both layers and was reachable only by API call. It retires the
  // item without touching the ledger, so the affordance says exactly that.
  const archiveCell = (item) => (
    <ConfirmDeleteDialog
      title={ar ? "أرشفة الصنف" : "Archive item"}
      description={ar
        ? `يُرفع «${item.name}» من قوائم الشراء والطلب في كل الفروع. دفتر الحركات لا يُمس: كل شراء ونقل وصرف يبقى برقمه، ويعود الصنف بأول شراء جديد بنفس الكود.`
        : `«${item.name}» leaves the purchase and request lists at every station. The movement ledger is untouched: every purchase, transfer and issue keeps its number, and the item returns with the next purchase on the same code.`}
      confirmLabel={ar ? "أرشفة" : "Archive"}
      onConfirm={() => run("deleteItem", { itemId: item.id }, {
        ar: `أُرشف «${item.name}» — الحركات باقية في الدفتر.`,
        en: `«${item.name}» archived — its movements stay in the ledger.`,
      })}
      trigger={(
        <button type="button" disabled={busy} style={{ ...ui.btnSecondary, height: 28, padding: "0 10px" }}>
          {ar ? "أرشفة" : "Archive"}
        </button>
      )}
    />
  );

  const sections = tabDefs.map(([key, arLabel, enLabel]) => ({
    value: key,
    label: ar ? arLabel : enLabel,
    count: key === "requests" ? (view === MANAGE ? pending : myPending) : key === "items" ? low : key === "mine" ? myIssues.length : 0,
  }));

  const stockValue = items.reduce((sum, item) => {
    const qty = scopedToOne ? qtyAtStation(item, scope) : (Number(item.quantity) || 0);
    return sum + qty * (Number(item.unitPrice || item.price) || 0);
  }, 0);
  const stats = [
    { label: ar ? "أصناف في النطاق" : "Items in scope", value: items.length, hint: ar ? "كل فرع يملك رصيده" : "Each station owns its balance" },
    { label: ar ? "تحت الحدّ" : "Below minimum", value: low, danger: low > 0, hint: low ? (ar ? "اطلب من فرع يملك فائضًا أو اشترِ" : "Request from a station with surplus, or buy") : (ar ? "كل الأصناف فوق حدّها" : "Every item is above its minimum") },
    { label: ar ? "قيمة الرصيد" : "Stock value", value: stockValue.toLocaleString("en-US"), hint: ar ? "كمية × سعر آخر شراء — وعاء مستقل عن المصروفات" : "Qty × last buy price — a vessel apart from expenses" },
    view === MANAGE
      ? { label: ar ? "طلبات تنتظر فرعك" : "Requests waiting on you", value: pending, danger: pending > 0, hint: pending ? (ar ? "الموافقة لمدير الفرع المالك" : "Approval is the owning station manager's") : (ar ? "لا طلبات واردة" : "No inbound requests") }
      : { label: ar ? "طلباتي المفتوحة" : "My open requests", value: myPending, danger: myPending > 0, hint: myPending ? (ar ? "بانتظار قرار فرع المصدر" : "Awaiting the supplying station's decision") : (ar ? "لا طلب مفتوح باسمك" : "No open request in your name") },
  ];

  return (
    <SuiteWorkspaceFrame
      ar={ar}
      kicker={pageKicker("/app/inventory", lang)}
      title={ar ? "المخزون" : "Inventory"}
      hint={ar
        ? "كل فرع يشتري مخزونه من وعائه ويملك رصيده. كل فرع يرى رصيد الفروع الأخرى ويطلب منها. شراء المخزون لا يُرفع كمطالبة مصروفات."
        : "Each station buys and owns its stock. Other stations' balances are visible and requestable. A stock buy is not an expense claim."}
      viewNote={{
        items: ar ? "كل فرع يملك رصيده. القيمة = كمية × سعر آخر شراء — وعاء مستقل." : "Each station owns its balance. Value = qty × last buy — a separate vessel.",
        purchases: ar ? "الشراء من وعاء الفرع إلى رصيده. ليس مطالبة مصروف." : "A buy from the station vessel onto its balance. Not an expense claim.",
        requests: view === SELF
          ? (ar ? SELF_VIEW_NOTE.inventory.ar : SELF_VIEW_NOTE.inventory.en)
          : (ar ? "الطلب بين فرعين مختلفين. نفس الفرع أو رصيد غير كافٍ يُرفض بالاسم." : "A request is between two stations. Same station or short stock is named and refused."),
        issue: ar ? "صرف من رصيد الفرع إلى عمل بمرجع. ليس تسليم عهدة." : "Issue from the station balance to work with a reference. Not a custody handover.",
        movements: ar ? "دفتر واحد: شراء · نقل · صرف. الأرقام مشتقّة لا تُكتب." : "One ledger: buy · transfer · issue. Figures are derived, not typed.",
        mine: ar ? "ما خرج من رصيد الفرع باسمك، بمرجع العمل الذي برّره." : "What left the station balance in your name, with the work reference that justified it.",
      }[tab]}
      tabs={sections}
      tool={tab}
      onTool={setTab}
      meta={(
        <>
          <FinanceViewSwitch ar={ar} view={view} canManage={canManage} showSwitch={!railSide} onChange={setView} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: ar ? "flex-end" : "flex-start" }}>
            <span style={{ fontSize: 10, color: MUTED }}>{ar ? "تحت الحدّ" : "Below minimum"}</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: low ? "#8A6516" : "var(--nv-ok-ink)" }}>{low}</span>
          </div>
          <span style={{ width: 1, height: 30, background: "#EEF0F4" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: ar ? "flex-end" : "flex-start" }}>
            <span style={{ fontSize: 10, color: MUTED }}>
              {view === MANAGE ? (ar ? "طلبات تنتظر" : "Waiting on you") : (ar ? "طلباتي المفتوحة" : "My open requests")}
            </span>
            <span style={{ fontSize: 15, fontWeight: 700, color: (view === MANAGE ? pending : myPending) ? "#8A6516" : "var(--nv-ok-ink)" }}>
              {view === MANAGE ? pending : myPending}
            </span>
          </div>
        </>
      )}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <KpiStrip stats={stats.map((s) => ({
        label: s.label,
        value: s.value,
        tone: s.danger ? "danger" : null,
      }))} />
        {tab === "items" && (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setItemView((v) => v === "matrix" ? "list" : "matrix")} style={ui.btnSecondary}>
                {itemView === "matrix" ? (ar ? "عرض قائمة" : "List view") : (ar ? "عرض مصفوفة" : "Matrix view")}
              </button>
            </div>
            {itemView === "matrix" ? (
              <InventoryMatrix
                ar={ar}
                items={asList(board.items)}
                stations={stations}
                onOpen={(code) => { setTab("requests"); }}
              />
            ) : (
              <InventoryTable
                headers={[
                  ...(ar ? ["الصنف", "الكود", "الكمية", "الفرع", "الحدّ", "قيمة الرصيد", "الحالة"] : ["Item", "Code", "Qty", "Station", "Min", "Value", "Status"]),
                  ...(board.canDelete ? [ar ? "الأرشفة" : "Archive"] : []),
                ]}
                empty={ar ? "لا أصناف في هذا النطاق. أضف شراءً من تبويب شراء الفرع." : "No items in this scope. Add a purchase on Station purchase."}
                rows={items.map((item) => [
                  item.name,
                  item.itemCode,
                  qtyOf(item),
                  scopedToOne ? stationName(scope) : stationName(item.currentLocationId),
                  item.minimumStock || 0,
                  (qtyOf(item) * (Number(item.unitPrice || item.price) || 0)).toLocaleString("en-US"),
                  isLow(item) ? (ar ? "منخفض — اطلب" : "Low — request") : (ar ? "متوفّر" : "In stock"),
                  ...(board.canDelete ? [archiveCell(item)] : []),
                ])}
              />
            )}
          </>
        )}

        {tab === "purchases" && view === MANAGE && (
          <>
            {board.canPurchase ? (
              <PurchaseForm
                ar={ar}
                busy={busy}
                stations={scopedToOne ? scopedStations : stations}
                lockedStationId={lockedStationId}
                onSubmit={(payload) => run("createItem", payload)}
              />
            ) : (
              <p style={{ ...cardShell, margin: 0, padding: "16px 18px", fontSize: 13, color: MUTED, lineHeight: 1.8 }}>
                {ar ? "تسجيل شراء المخزون لمدير الفرع أو أمين المخزن." : "Recording a stock purchase is for the station manager or the stock keeper."}
              </p>
            )}
            <InventoryTable
              headers={ar ? ["الصنف", "المورد", "الكمية", "الفرع", "التكلفة"] : ["Item", "Supplier", "Qty", "Station", "Cost"]}
              empty={ar ? "لا مشتريات في هذا النطاق." : "No purchases in this scope."}
              rows={purchases.map((row) => [
                itemName(row.itemId),
                row.supplierName || "—",
                row.quantity,
                stationName(row.toLocationId),
                row.totalCost != null
                  ? `${Number(row.totalCost).toLocaleString("en-US")} ${ar ? "ر.س" : "SAR"}`
                  : "—",
              ])}
            />
          </>
        )}

        {tab === "requests" && (
          <>
            <RequestForm
              ar={ar}
              busy={busy}
              items={asList(board.items)}
              stations={stations}
              lockedStationId={lockedStationId}
              onSubmit={(payload) => run("request", payload)}
            />
            <InventoryTable
              headers={ar ? ["الصنف", "الكمية", "من فرع", "إلى فرع", "الطلب", "الحالة"] : ["Item", "Qty", "From", "To", "Reason", "Status"]}
              empty={view === MANAGE
                ? (ar ? "لا طلبات في هذا النطاق." : "No requests in this scope.")
                : (ar ? "لم ترفع طلب مادة بعد." : "You have not raised a material request yet.")}
              rows={(view === MANAGE ? requests : myRequests).map((row) => [
                itemName(row.itemId),
                row.quantity,
                stationName(row.sourceStationId),
                stationName(row.stationId),
                row.notes || "—",
                row.status === "pending" && view === MANAGE && board.canReviewRequests ? (
                  <span style={{ display: "flex", gap: 6 }}>
                    <button type="button" disabled={busy} onClick={() => run("reviewRequest", { requestId: row.id, decision: "approved" })} style={{ ...ui.btnPrimary, height: 28, padding: "0 10px" }}>
                      {ar ? "وافق ونفّذ" : "Approve & issue"}
                    </button>
                    <button type="button" disabled={busy} onClick={() => run("reviewRequest", { requestId: row.id, decision: "rejected" })} style={{ ...ui.btnDanger, height: 28, padding: "0 10px" }}>
                      {ar ? "ارفض" : "Reject"}
                    </button>
                  </span>
                ) : requestStatusLabel(row.status, ar),
              ])}
            />
          </>
        )}

        {tab === "issue" && view === MANAGE && (
          <>
            {board.canIssueToWork ? (
              <IssueForm
                ar={ar}
                busy={busy}
                items={asList(board.items)}
                stations={scopedToOne ? scopedStations : stations}
                employees={scopedEmployees.length ? scopedEmployees : employees}
                lockedStationId={lockedStationId}
                onSubmit={(payload) => run("issueToWork", payload)}
              />
            ) : (
              <p style={{ ...cardShell, margin: 0, padding: "16px 18px", fontSize: 13, color: MUTED, lineHeight: 1.8 }}>
                {ar ? "الصرف للعمل لمدير الفرع أو أمين المخزن — الطلب متاح لك." : "Issuing to work is for the station manager or the stock keeper — requesting is open to you."}
              </p>
            )}
            <InventoryTable
              headers={ar ? ["الصنف", "الكمية", "الفرع", "المستلم", "مرجع العمل"] : ["Item", "Qty", "Station", "Recipient", "Work ref"]}
              empty={ar ? "لا صرف مسجّل في هذا النطاق." : "No issues in this scope."}
              rows={movements.filter((row) => row.movementType === "issue").map((row) => [
                itemName(row.itemId),
                row.quantity,
                stationName(row.fromLocationId),
                personName(row.employeeId),
                row.workReference || "—",
              ])}
            />
          </>
        )}

        {tab === "mine" && (
          <InventoryTable
            headers={ar ? ["الصنف", "الكمية", "من فرع", "مرجع العمل", "التاريخ"] : ["Item", "Qty", "From", "Work ref", "Date"]}
            empty={ar ? "لا مواد صُرفت باسمك بعد." : "Nothing has been issued to you yet."}
            rows={myIssues.map((row) => [
              itemName(row.itemId),
              row.quantity,
              stationName(row.fromLocationId),
              row.workReference || "—",
              (row.workDate || row.created_date || "").slice(0, 10) || "—",
            ])}
          />
        )}

        {tab === "movements" && view === MANAGE && (
          <InventoryTable
            headers={[
              ...(ar ? ["الحركة", "النوع", "الصنف", "الكمية", "من", "إلى", "من أجراها", "المرجع"] : ["Movement", "Type", "Item", "Qty", "From", "To", "By", "Ref"]),
              ...(board.canReverse ? [ar ? "العكس" : "Reversal"] : []),
            ]}
            empty={ar ? "لا حركات في هذا النطاق." : "No movements in this scope."}
            rows={movements.map((row) => [
              row.movementNumber || row.id,
              movementTypeLabel(row.movementType, ar),
              itemName(row.itemId),
              row.quantity,
              fromLabel(row),
              toLabel(row),
              personName(row.performedBy || row.employeeId),
              row.workReference || requestReason(row.requestId) || row.reversalReason || row.ref || "—",
              ...(board.canReverse ? [reverseCell(row)] : []),
            ])}
          />
        )}
      </div>

      {reversing ? (
        <ReverseMovementDialog
          ar={ar}
          busy={busy}
          movement={{
            label: `${reversing.movementNumber || reversing.id} · ${movementTypeLabel(reversing.movementType, ar)}`,
            itemName: itemName(reversing.itemId),
            quantity: reversing.quantity,
            direction: `${fromLabel(reversing)} → ${toLabel(reversing)}`,
          }}
          onClose={() => setReversing(null)}
          onConfirm={(reversalReason) => {
            const number = reversing.movementNumber || reversing.id;
            const done = run("reverseMovement", { movementId: reversing.id, reversalReason }, {
              ar: `عُكست ${number} — بقيت في الدفتر وقُيّدت حركة معاكسة جديدة.`,
              en: `${number} reversed — it stays in the ledger and a new compensating movement was recorded.`,
            });
            if (done) setReversing(null);
          }}
        />
      ) : null}
    </SuiteWorkspaceFrame>
  );
}

function InventoryMatrix({ ar, items, stations, onOpen }) {
  const codes = [...new Set(items.map((item) => item.itemCode || item.id).filter(Boolean))];
  const qtyAt = (code, stationId) => {
    const row = items.find((item) => (item.itemCode || item.id) === code);
    if (!row) return null;
    const bal = (row.locationBalances || []).find((entry) => entry.locationId === stationId);
    if (bal) return Number(bal.quantity) || 0;
    if (String(row.currentLocationId) === String(stationId)) return Number(row.quantity) || 0;
    return null;
  };
  const nameOf = (code) => items.find((item) => (item.itemCode || item.id) === code)?.name || code;
  const minOf = (code, stationId) => {
    const row = items.find((item) => (item.itemCode || item.id) === code);
    return Number(row?.minimumStock || 0);
  };
  const headers = [ar ? "الصنف" : "Item", ...stations.map((station) => station.name?.replace(/^فرع /, "") || stationIdOf(station)), ar ? "الإجمالي" : "Total"];
  const rows = codes.map((code) => {
    let total = 0;
    const cells = [nameOf(code)];
    stations.forEach((station) => {
      const qty = qtyAt(code, stationIdOf(station));
      if (qty == null) {
        cells.push("—");
        return;
      }
      total += qty;
      const low = isShortSku({ onHand: qty, reorder: minOf(code, stationIdOf(station)) });
      cells.push(low ? `${qty} !` : String(qty));
    });
    cells.push(String(total));
    return { code, cells };
  });
  if (!codes.length) {
    return (
      <div style={{ ...tableShell, padding: "18px 16px", textAlign: "center", fontSize: 13, color: MUTED }}>
        {ar ? "لا أصناف لرسم المصفوفة." : "No items to plot on the matrix."}
      </div>
    );
  }
  return (
    <InventoryTable
      headers={headers}
      empty=""
      rows={rows.map((row) => row.cells)}
      onRowClick={onOpen ? (index) => onOpen(rows[index].code) : undefined}
    />
  );
}

function InventoryTable({ headers, rows, empty, onRowClick }) {
  const cols = `repeat(${headers.length}, minmax(88px, 1fr))`;
  if (!rows.length) {
    return (
      <div style={{ ...tableShell, padding: "18px 16px", textAlign: "center", fontSize: 13, color: MUTED }}>
        {empty}
      </div>
    );
  }
  return (
    <div style={{ ...tableShell, overflowX: "auto" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: cols,
          gap: 8,
          padding: "10px 16px",
          background: SURFACE,
          borderBottom: "1px solid var(--nv-line)",
          fontSize: 10,
          fontWeight: 600,
          color: MUTED,
        }}
      >
        {headers.map((h) => <span key={h}>{h}</span>)}
      </div>
      {rows.map((colsRow, index) => (
        <div
          key={index}
          style={{
            display: "grid",
            gridTemplateColumns: cols,
            gap: 8,
            minHeight: 44,
            alignItems: "center",
            padding: "0 16px",
            borderBottom: index === rows.length - 1 ? "none" : "1px solid var(--nv-line)",
            fontSize: 13,
            color: NAVY,
            cursor: onRowClick ? "pointer" : "default",
          }}
          onClick={onRowClick ? () => onRowClick(index) : undefined}
        >
          {colsRow.map((col, colIndex) => <span key={colIndex} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{col ?? "—"}</span>)}
        </div>
      ))}
    </div>
  );
}

function StationField({ ar, stations, value, onChange, lockedStationId, label }) {
  const name = stations.find((station) => stationIdOf(station) === (lockedStationId || value))?.name;
  if (lockedStationId) {
    return (
      <div>
        <label style={labelMuted}>{label || (ar ? "الفرع" : "Station")}</label>
        <div style={{ ...field, display: "flex", alignItems: "center", background: SURFACE, color: MUTED }}>
          {name || lockedStationId}
        </div>
      </div>
    );
  }
  return (
    <div>
      <label style={labelMuted}>{label || (ar ? "الفرع" : "Station")}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} required style={field}>
        <option value="">{ar ? "اختر الفرع" : "Choose station"}</option>
        {stations.map((station) => (
          <option key={stationIdOf(station)} value={stationIdOf(station)}>{station.name}</option>
        ))}
      </select>
    </div>
  );
}

const formGrid = {
  ...cardShell,
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  padding: 16,
};

function PurchaseForm({ ar, busy, stations, lockedStationId, onSubmit }) {
  const [locationId, setLocationId] = useState(lockedStationId || stationIdOf(stations[0]));
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const total = quantity !== "" && unitPrice !== "" ? (Number(quantity) * Number(unitPrice)).toFixed(2) : "";
  const effectiveLocation = lockedStationId || locationId;

  useEffect(() => {
    if (lockedStationId) setLocationId(lockedStationId);
    else if (!locationId && stations[0]) setLocationId(stationIdOf(stations[0]));
  }, [stations, locationId, lockedStationId]);

  const submit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const saved = onSubmit({
      name: String(form.get("name") || "").trim(),
      itemCode: String(form.get("itemCode") || "").trim(),
      supplierName: String(form.get("supplierName") || "").trim(),
      locationId: effectiveLocation,
      quantity: Number(form.get("quantity")),
      unitPrice: Number(form.get("unitPrice")),
      totalCost: Number(form.get("totalCost")),
      minimumStock: Number(form.get("minimumStock") || 0),
      purchaseDate: String(form.get("purchaseDate") || new Date().toISOString().slice(0, 10)),
    });
    if (saved) {
      event.currentTarget.reset();
      setQuantity("");
      setUnitPrice("");
    }
  };

  return (
    <form onSubmit={submit} className="nv-inv-form" style={formGrid}>
      <div style={{ gridColumn: "1 / -1", fontSize: 13, fontWeight: 600, color: NAVY }}>
        {ar ? "تسجيل شراء" : "Record purchase"}
      </div>
      <div>
        <label style={labelMuted}>{ar ? "اسم الصنف" : "Item name"}</label>
        <input name="name" required placeholder={ar ? "اسم الصنف" : "Item name"} style={field} />
      </div>
      <div>
        <label style={labelMuted}>{ar ? "كود الصنف" : "Item code"}</label>
        <input name="itemCode" required placeholder={ar ? "كود الصنف" : "Item code"} style={field} />
      </div>
      <StationField ar={ar} stations={stations} value={locationId} onChange={setLocationId} lockedStationId={lockedStationId} />
      <div>
        <label style={labelMuted}>{ar ? "الكمية" : "Quantity"}</label>
        <input name="quantity" type="number" min="1" required value={quantity} onChange={(event) => setQuantity(event.target.value)} style={field} />
      </div>
      <div>
        <label style={labelMuted}>{ar ? "الحد الأدنى" : "Minimum"}</label>
        <input name="minimumStock" type="number" min="0" defaultValue="0" style={field} />
      </div>
      <div>
        <label style={labelMuted}>{ar ? "سعر القطعة" : "Unit price"}</label>
        <input name="unitPrice" type="number" min="0" step="0.01" required value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} style={field} />
      </div>
      <div>
        <label style={labelMuted}>{ar ? "الإجمالي" : "Total"}</label>
        <input name="totalCost" readOnly value={total} style={{ ...field, background: SURFACE, fontWeight: 600 }} />
      </div>
      <div>
        <label style={labelMuted}>{ar ? "المورد" : "Supplier"}</label>
        <input name="supplierName" required placeholder={ar ? "اسم المورد" : "Supplier"} style={field} />
      </div>
      <div>
        <label style={labelMuted}>{ar ? "تاريخ الشراء" : "Purchase date"}</label>
        <PlatformDateField name="purchaseDate" required defaultValue={new Date().toISOString().slice(0, 10)} ar={ar} />
      </div>
      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
        <button type="submit" disabled={busy || !effectiveLocation} style={{ ...ui.btnPrimary, height: 36, opacity: busy || !effectiveLocation ? 0.45 : 1 }}>
          {busy ? (ar ? "جارٍ الحفظ..." : "Saving...") : (ar ? "حفظ الشراء" : "Save purchase")}
        </button>
      </div>
    </form>
  );
}

function RequestForm({ ar, busy, items, stations, lockedStationId, onSubmit }) {
  const destLocked = lockedStationId || "";
  const firstOther = () => stationIdOf(stations.find((station) => stationIdOf(station) !== destLocked) || stations[0]);
  const [sourceStationId, setSourceStationId] = useState(firstOther);
  const [stationId, setStationId] = useState(destLocked || stationIdOf(stations[1]) || "");
  const available = useMemo(
    () => items.filter((item) => qtyAtStation(item, sourceStationId) > 0),
    [items, sourceStationId],
  );

  useEffect(() => {
    if (destLocked) {
      setStationId(destLocked);
      setSourceStationId((prev) => (prev === destLocked ? firstOther() : prev));
    }
  }, [destLocked, stations.length]);

  const submit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit({
      itemId: String(form.get("itemId") || ""),
      sourceStationId,
      stationId,
      quantity: Number(form.get("quantity")),
      notes: String(form.get("notes") || "").trim(),
    });
  };

  return (
    <form onSubmit={submit} className="nv-inv-form" style={formGrid}>
      <StationField ar={ar} stations={stations.filter((station) => stationIdOf(station) !== destLocked)} value={sourceStationId} onChange={setSourceStationId} label={ar ? "من فرع" : "From station"} />
      <StationField ar={ar} stations={stations.filter((station) => destLocked || stationIdOf(station) !== sourceStationId)} value={stationId} onChange={setStationId} lockedStationId={destLocked} label={ar ? "إلى فرع" : "To station"} />
      <div>
        <label style={labelMuted}>{ar ? "الصنف" : "Item"}</label>
        <select name="itemId" required style={field} disabled={!available.length}>
          <option value="">{available.length ? (ar ? "الصنف" : "Item") : (ar ? "لا صنف في فرع المصدر" : "No stock at the source station")}</option>
          {available.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        {!available.length ? (
          <p style={{ margin: "6px 0 0", fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
            {ar ? "غيّر فرع المصدر — لا رصيد قابل للطلب هنا." : "Change the source station — nothing requestable here."}
          </p>
        ) : null}
      </div>
      <div>
        <label style={labelMuted}>{ar ? "الكمية" : "Quantity"}</label>
        <input name="quantity" type="number" min="1" required defaultValue="1" style={field} />
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <label style={labelMuted}>{ar ? "سبب الطلب" : "Reason"}</label>
        <input name="notes" required placeholder={ar ? "سبب الطلب" : "Reason"} style={field} />
      </div>
      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
        <button type="submit" disabled={busy} style={{ ...ui.btnPrimary, height: 36 }}>{ar ? "إرسال الطلب" : "Send request"}</button>
      </div>
    </form>
  );
}

function IssueForm({ ar, busy, items, stations, employees, lockedStationId, onSubmit }) {
  const [fromLocationId, setFromLocationId] = useState(lockedStationId || stationIdOf(stations[0]));
  const fromId = lockedStationId || fromLocationId;
  const available = items.filter((item) => qtyAtStation(item, fromId) > 0);

  useEffect(() => {
    if (lockedStationId) setFromLocationId(lockedStationId);
  }, [lockedStationId]);

  const submit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit({
      itemId: String(form.get("itemId") || ""),
      fromLocationId: fromId,
      employeeId: String(form.get("employeeId") || ""),
      quantity: Number(form.get("quantity")),
      workReference: String(form.get("workReference") || "").trim(),
      workDate: String(form.get("workDate") || new Date().toISOString().slice(0, 10)),
      notes: String(form.get("notes") || ""),
    });
  };

  return (
    <form onSubmit={submit} className="nv-inv-form" style={formGrid}>
      <StationField ar={ar} stations={stations} value={fromLocationId} onChange={setFromLocationId} lockedStationId={lockedStationId} />
      <div>
        <label style={labelMuted}>{ar ? "الصنف" : "Item"}</label>
        <select name="itemId" required style={field} disabled={!available.length}>
          <option value="">{available.length ? (ar ? "الصنف" : "Item") : (ar ? "لا رصيد في هذا الفرع" : "No stock at this station")}</option>
          {available.map((item) => <option key={item.id} value={item.id}>{item.name} · {qtyAtStation(item, fromId)}</option>)}
        </select>
        {!available.length ? (
          <p style={{ margin: "6px 0 0", fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
            {ar ? "اشترِ أولًا أو اطلب من فرع يملك فائضًا." : "Buy first, or request from a station with surplus."}
          </p>
        ) : null}
      </div>
      <div>
        <label style={labelMuted}>{ar ? "المستلم" : "Recipient"}</label>
        <select name="employeeId" required style={field}>
          <option value="">{ar ? "المستلم" : "Recipient"}</option>
          {employees.map((row) => <option key={row.id || row.employeeId} value={row.id || row.employeeId}>{row.name}</option>)}
        </select>
      </div>
      <div>
        <label style={labelMuted}>{ar ? "الكمية" : "Quantity"}</label>
        <input name="quantity" type="number" min="1" required defaultValue="1" style={field} />
      </div>
      <div>
        <label style={labelMuted}>{ar ? "مرجع العمل" : "Work reference"}</label>
        <input name="workReference" required placeholder={ar ? "مرجع العمل" : "Work reference"} style={field} />
      </div>
      <div>
        <label style={labelMuted}>{ar ? "تاريخ العمل" : "Work date"}</label>
        <PlatformDateField name="workDate" required defaultValue={new Date().toISOString().slice(0, 10)} ar={ar} />
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <label style={labelMuted}>{ar ? "ملاحظة" : "Notes"}</label>
        <input name="notes" placeholder={ar ? "ملاحظة" : "Notes"} style={field} />
      </div>
      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
        <button type="submit" disabled={busy} style={{ ...ui.btnPrimary, height: 36 }}>{ar ? "صرف" : "Issue"}</button>
      </div>
    </form>
  );
}
