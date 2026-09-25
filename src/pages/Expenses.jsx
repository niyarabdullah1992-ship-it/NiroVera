import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/PowerCareAuth";
import { useI18n } from "@/lib/i18n";
import { expensesCall } from "@/lib/expensesApi";
import { namedServiceReason } from "@/lib/serviceErrors";
import ExpenseForm from "@/components/expenses/ExpenseForm";
import ExpenseStats from "@/components/expenses/ExpenseStats";
import ExpenseList from "@/components/expenses/ExpenseList";
import ExpenseBudgetBoard from "@/components/expenses/ExpenseBudgetBoard";
import ExpensePolicyBoard from "@/components/expenses/ExpensePolicyBoard";
import { toast } from "@/components/ui/use-toast";
import useStationScope, { matchesStationScope } from "@/hooks/useStationScope";
import SuiteWorkspaceFrame from "@/components/shared/SuiteWorkspaceFrame";
import { pageKicker } from "@/lib/moduleMeta";
import { INK, MUTED, SURFACE, cardShell, ui } from "@/lib/platformStyles";
import FinanceViewSwitch from "@/components/shared/FinanceViewSwitch";
import { MANAGE, SELF, SELF_VIEW_NOTE, canManageSurface, resolveFinanceView } from "@/lib/financeRights";
import { useRailSide } from "@/lib/railSide";

// The vessel and the review queue are decisions; raising a claim, watching its path
// and reading the derived policy are not. That is where the surface divides.
const MANAGE_LAYERS = ["budget", "form", "claims", "policy"];
const SELF_LAYERS = ["claims", "form", "policy"];

const empty = { claims: [], stations: [], canManagerReview: false, canFinanceReview: false, canCfoReview: false, canPickStations: false };

export default function Expenses() {
  const { session, currentUser, data } = useAuth();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const scope = useStationScope();
  const [state, setState] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const canManage = canManageSurface("expenses", currentUser, data);
  const railSide = useRailSide();
  const view = resolveFinanceView("expenses", currentUser, data, searchParams.get("view"), railSide);
  const layers = view === MANAGE ? MANAGE_LAYERS : SELF_LAYERS;
  const homeTab = layers[0];
  const requested = searchParams.get("tab");
  const tab = layers.includes(requested) ? requested : homeTab;
  const setTab = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value === homeTab) next.delete("tab");
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
  // A manager reading their own claims is an employee for the length of that view:
  // the decision buttons go with the lens, and the gate refuses them either way.
  const reviewing = view === MANAGE;
  const canonicalStations = (data?.stations || []).map((station) => ({ ...station, stationId: station.id }));
  const stationVersion = canonicalStations.map((station) => station.stationId).sort().join("|");
  const load = async () => {
    setLoading(true);
    try {
      const next = await expensesCall(session, "list");
      const allowedIds = new Set((next.stations || []).map((station) => station.stationId));
      setState({ ...next, stations: canonicalStations.filter((station) => allowedIds.has(station.stationId)) });
    } catch (error) {
      toast({
        title: ar ? "تعذّر فتح المصروفات" : "Expenses could not be opened",
        description: namedServiceReason(error, ar, {
          ar: "لم تستجب خدمة المصروفات لهذا الحساب — لا تُعرض المطالبات ولا يُقبل اعتماد أو صرف.",
          en: "The expenses service did not respond for this account — no claims are shown and no approval or payment is accepted.",
        }),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [session?.companyId, stationVersion]);
  const run = async (action, payload) => {
    try {
      await expensesCall(session, action, payload);
      await load();
      toast({ description: ar ? "تم حفظ العملية." : "Expense updated." });
      return true;
    } catch (error) {
      // A refusal can leave its own record on the claim — a vessel block is one — so the
      // board is re-read here too, otherwise the trail waits for the next page load.
      await load();
      toast({
        description: namedServiceReason(error, ar, {
          ar: "لم تُقبل العملية — البوابة سمّت السبب أعلاه إن وُجد.",
          en: "The action was refused — the gate names the reason when one exists.",
        }),
        variant: "destructive",
      });
      return false;
    }
  };
  const headerStationId = scope && scope !== "all" ? String(scope) : "";
  const submit = async (payload) => run("submit", {
    ...payload,
    stationId: payload.stationId || headerStationId || currentUser?.stationId,
  });

  const scopedClaims = (state.claims || [])
    .filter((c) => matchesStationScope(c.stationId, scope, data?.stations))
    // «ما يخصني» means mine, not "mine plus whatever my rights happen to disclose".
    .filter((c) => view === MANAGE || String(c.requesterId || "") === String(currentUser?.id || ""));
  const openCount = scopedClaims.filter((c) => /^(submitted|manager_approved|cfo_pending)$/.test(c.status || "")).length;

  return (
    <SuiteWorkspaceFrame
      ar={ar}
      kicker={pageKicker("/app/expenses", lang)}
      title={ar ? "المصروفات" : "Expenses"}
      hint={ar ? (
        <>
          الوعاء التشغيلي منفصل عن{" "}
          <Link to="/app/payroll" style={{ fontWeight: 600, color: INK }}>مسير الرواتب</Link>
          {" "}الذي يغذيه الحضور، وعن{" "}
          <Link to="/app/inventory" style={{ fontWeight: 600, color: INK }}>المخزون</Link>
          {" "}و{" "}
          <Link to="/app/assets" style={{ fontWeight: 600, color: INK }}>الأصول</Link>
          . مطالبة مصروف لا تُصرف من المسير ولا تُخلط بشراء مخزون أو أصل.
        </>
      ) : (
        <>
          The operating vessel is separate from{" "}
          <Link to="/app/payroll" style={{ fontWeight: 600, color: INK }}>Payroll</Link>
          {" "}fed by attendance, and from{" "}
          <Link to="/app/inventory" style={{ fontWeight: 600, color: INK }}>Inventory</Link>
          {" "}and{" "}
          <Link to="/app/assets" style={{ fontWeight: 600, color: INK }}>Assets</Link>
          . An expense claim is never paid from payroll and is not mixed with a stock purchase or an asset buy.
        </>
      )}
      viewNote={view === SELF && tab === "claims"
        ? (ar ? SELF_VIEW_NOTE.expenses.ar : SELF_VIEW_NOTE.expenses.en)
        : {
          budget: ar ? "هذا السطح للوعاء التشغيلي وحده. وعاء المخزون في المخزون، ووعاء الأصول في الأصول." : "This surface is the operating vessel only. Stock lives on Inventory, assets on Assets.",
          form: ar ? "بلا إيصال لا يُرسل. شراء صنف يُخزَّن يُسجَّل في المخزون لا هنا." : "No receipt, no send. A stocked item is recorded on Inventory, not here.",
          claims: ar ? "كل مطالبة بحالتها ومسارها. الإيصال بوابة الاعتماد." : "Every claim with its status and path. The receipt gates approval.",
          policy: ar ? "الخطوات تُشتقّ من المبلغ لا تُختار." : "Steps are derived from the amount, not chosen.",
        }[tab]}
      tabs={[
        ...(view === MANAGE ? [{ value: "budget", label: ar ? "الوعاء التشغيلي" : "Operating vessel" }] : []),
        {
          value: "claims",
          label: view === MANAGE ? (ar ? "المطالبات" : "Claims") : (ar ? "مطالباتي" : "My claims"),
          count: openCount,
        },
        { value: "form", label: ar ? "مطالبة جديدة" : "New claim" },
        { value: "policy", label: ar ? "سياسة الاعتماد" : "Policy" },
      ]}
      tool={tab}
      onTool={setTab}
      meta={(
        <>
          <FinanceViewSwitch ar={ar} view={view} canManage={canManage} showSwitch={!railSide} onChange={setView} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: ar ? "flex-end" : "flex-start" }}>
            <span style={{ fontSize: 10, color: MUTED }}>
              {view === MANAGE ? (ar ? "بانتظار الاعتماد" : "Awaiting approval") : (ar ? "مطالباتي المفتوحة" : "My open claims")}
            </span>
            <span style={{ fontSize: 15, fontWeight: 700, color: openCount ? "#8A6516" : "#137A49" }}>{openCount}</span>
          </div>
          {tab !== "form" ? (
            <button type="button" onClick={() => setTab("form")} style={ui.btnPrimary}>
              {ar ? "مطالبة جديدة" : "New claim"}
            </button>
          ) : null}
        </>
      )}
    >

      {tab === "budget" && view === MANAGE && <ExpenseBudgetBoard lang={lang} stationScope={scope} />}

      {tab === "form" && (
        <ExpenseForm stations={state.stations} canPickStations={state.canPickStations} headerStationId={headerStationId} onSubmit={async (payload) => {
          const ok = await submit(payload);
          if (ok) setTab("claims");
          return ok;
        }} ar={ar} />
      )}

      {tab === "claims" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <ExpenseStats claims={scopedClaims} ar={ar} />
          {loading
            ? <div style={{ ...cardShell, height: 160, background: SURFACE }} />
            : (
              <ExpenseList
                claims={scopedClaims}
                stations={state.stations}
                canManagerReview={reviewing && state.canManagerReview}
                canFinanceReview={reviewing && state.canFinanceReview}
                canCfoReview={reviewing && state.canCfoReview}
                onManagerReview={(claimId, decision, reason) => run("managerReview", { claimId, decision, reason })}
                onFinanceReview={(claimId, decision, reason) => run("financeReview", { claimId, decision, reason })}
                onCfoReview={(claimId, decision, reason) => run("cfoReview", { claimId, decision, reason })}
                ar={ar}
              />
            )}
        </div>
      )}

      {tab === "policy" && <ExpensePolicyBoard ar={ar} />}
    </SuiteWorkspaceFrame>
  );
}
