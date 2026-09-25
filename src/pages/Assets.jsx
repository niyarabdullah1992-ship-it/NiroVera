import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { visibleStations } from "@/lib/permissions";
import useStationScope from "@/hooks/useStationScope";
import { assetsCall, assetStatusLabel } from "@/lib/assetsApi";
import { assetRights, checkAssetWriteGate } from "@/lib/assetRights";
import SuiteWorkspaceFrame from "@/components/shared/SuiteWorkspaceFrame";
import { pageKicker } from "@/lib/moduleMeta";
import AssetStats from "@/components/assets/AssetStats";
import AssetFilters from "@/components/assets/AssetFilters";
import AssetTable from "@/components/assets/AssetTable";
import AssetDetail from "@/components/assets/AssetDetail";
import AssetForm from "@/components/assets/AssetForm";
import HandoverDialog from "@/components/assets/HandoverDialog";
import MarkLostDialog from "@/components/assets/MarkLostDialog";
import ResolveLostDialog from "@/components/assets/ResolveLostDialog";
import ComparisonExportButtons from "@/components/reports/ComparisonExportButtons";
import AssetTransferBoard from "@/components/assets/AssetTransferBoard";
import { listAssetTransfers } from "@/lib/assetTransfers";
import { toast } from "@/components/ui/use-toast";
import { ACCENT, MUTED, SURFACE, cardShell, ui } from "@/lib/platformStyles";
import KpiStrip from "@/components/shared/KpiStrip";
import FinanceViewSwitch from "@/components/shared/FinanceViewSwitch";
import { MANAGE, SELF, SELF_VIEW_NOTE, canManageSurface, resolveFinanceView } from "@/lib/financeRights";
import { useRailSide } from "@/lib/railSide";

// The register and the vessel are the branch's book; transfers are a decision.
// What is left for the holder is the custody in their own hands and the move they
// may ask for — which is exactly what the employee view carries.
const MANAGE_LAYERS = ["reg", "budget", "xfer"];
const SELF_LAYERS = ["mine", "xfer"];

export default function Assets() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { data, currentUser, session } = useAuth();
  const stationScope = useStationScope();
  const [assets, setAssets] = useState([]);
  const [custody, setCustody] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ category: "all", stationId: "", status: "all" });
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [handing, setHanding] = useState(false);
  const [reportingLost, setReportingLost] = useState(false);
  const [resolvingLost, setResolvingLost] = useState(false);
  const [seeAll, setSeeAll] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const canManage = canManageSurface("assets", currentUser, data);
  const railSide = useRailSide();
  const view = resolveFinanceView("assets", currentUser, data, searchParams.get("view"), railSide);
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

  const reload = async () => {
    const res = await assetsCall(session, "list");
    setAssets(res?.assets || []);
    setCustody(res?.custody || []);
    setMaintenance(res?.maintenance || []);
  };

  useEffect(() => {
    if (!session?.companyId) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await reload();
      } catch (error) {
        if (!cancelled) {
          toast({
            description: error?.response?.data?.error || error.message || (ar ? "تعذّر تحميل الأصول والعهد" : "Could not load assets & custody"),
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [session?.companyId]);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("asset");
    if (!code || !assets.length) return;
    const match = assets.find((a) => a.qrCode === code || a.assetCode === code);
    if (match) setSelected(match.id);
  }, [assets]);

  const rights = useMemo(() => assetRights(currentUser, data), [currentUser, data]);
  const stations = data && currentUser ? visibleStations(currentUser, data) : [];
  const activeStationId = stationScope && stationScope !== "all" ? String(stationScope) : "";

  useEffect(() => {
    setFilters((prev) => (prev.stationId === activeStationId ? prev : { ...prev, stationId: activeStationId }));
  }, [activeStationId]);

  const stationIds = useMemo(() => new Set(stations.map((s) => s.id)), [stations]);
  const stationName = (id) => data?.stations?.find((s) => s.id === id)?.name || "—";
  const employees = (data?.employees || []).filter((e) => !e.stationId || stationIds.has(e.stationId));

  const ownStation = useMemo(
    () => assets.filter((a) => {
      if (a.stationId && !stationIds.has(a.stationId)) return false;
      if (!activeStationId) return true;
      return String(a.stationId || "") === String(activeStationId);
    }),
    [assets, stationIds, activeStationId],
  );
  const scoped = seeAll ? assets : ownStation;
  const categories = [...new Set(scoped.map((a) => a.category).filter(Boolean))];
  const visible = scoped.filter((a) =>
    (filters.category === "all" || a.category === filters.category)
    && (filters.status === "all" || a.status === filters.status));
  const selectedAsset = selected ? assets.find((a) => a.id === selected) : null;
  const myAssets = useMemo(
    () => assets.filter((a) => String(a.holderId || "") === String(currentUser?.id || "")),
    [assets, currentUser?.id],
  );
  // In the personal view only the two things a holder legitimately does stay on the
  // card. Both still pass the real gate — the lens narrows what is offered, it does
  // not grant anything, and it does not take the holder's own duties away.
  const can = (action) => {
    if (view === SELF && !["handover", "maintenance"].includes(action)) return false;
    return checkAssetWriteGate(rights, selectedAsset, action).ok;
  };

  const run = async (fn) => {
    try {
      await fn();
      await reload();
      return true;
    } catch (error) {
      const body = error?.response?.data || {};
      const named = ar ? body.reason : (body.reasonEn || body.reason);
      toast({ description: named || body.error || error.message, variant: "destructive" });
      return false;
    }
  };

  const saveAsset = async (asset) => run(() => assetsCall(session, "saveAsset", { asset, assetId: editing?.id || null }));
  const handover = async (payload) => run(() => assetsCall(session, "handover", payload));
  const addMaintenance = async (record) => run(() => assetsCall(session, "logMaintenance", { assetId: selected, maintenance: record }));
  const markLost = async (reason) => run(() => assetsCall(session, "setStatus", { assetId: selected, status: "lost", reason }));
  // The opening reason is read from the stored case by the handler, not sent back up
  // from this screen — a stale or empty copy here must not be able to erase it.
  const resolveLost = async ({ decision, reason }) => run(() => assetsCall(session, "resolveLost", {
    assetId: selected,
    decision,
    reason,
  }));
  const deleteAsset = async () => {
    const ok = await run(() => assetsCall(session, "deleteAsset", { assetId: selected }));
    if (ok) setSelected(null);
  };

  const allXfers = listAssetTransfers(data);
  const pendingXfers = view === MANAGE
    ? allXfers.filter((row) => row.status === "pending").length
    : allXfers.filter((row) => row.status === "pending" && String(row.reqById || "") === String(currentUser?.id || "")).length;
  const bookAssets = assets.filter((a) => {
    if (a.status === "retired") return false;
    const origin = String(a.originStationId || a.stationId || "");
    if (!activeStationId || seeAll) return true;
    return origin === String(activeStationId);
  });
  const bookValue = bookAssets.reduce((sum, a) => sum + (Number(a.value) || 0), 0);
  const exportHeaders = ar
    ? ["الأصل", "الرقم", "الفئة", "الحائز", "الوحدة", "المنشأ", "الحالة", "الفحص القادم", "القيمة"]
    : ["Asset", "Code", "Category", "Holder", "Unit", "Origin", "Status", "Next inspection", "Value"];
  const exportRows = visible.map((a) => [
    a.name,
    a.assetCode,
    a.category || "—",
    a.holderName || "—",
    stationName(a.stationId),
    a.originStationId ? stationName(a.originStationId) : (ar ? "شراء مباشر" : "Direct buy"),
    assetStatusLabel(a.status, lang),
    a.nextInspectionDate || "—",
    a.value || 0,
  ]);

  return (
    <SuiteWorkspaceFrame
      ar={ar}
      kicker={pageKicker("/app/assets", lang)}
      title={ar ? "الأصول والعهد" : "Assets & custody"}
      hint={ar ? (
        <>
          استرجاع العهد شرط{" "}
          <Link to="/app/hr" style={{ color: "inherit", fontWeight: 650 }}>إنهاء الخدمة في الموارد البشرية</Link>
          {" "}— لا تُغلق الخدمة وعهدة مفتوحة. التوقيع هنا إقرار استلام داخلي، ليس ختم Secure Sign.
        </>
      ) : (
        <>
          Return gates{" "}
          <Link to="/app/hr" style={{ color: "inherit", fontWeight: 650 }}>HR offboarding</Link>
          {" "}— service cannot close with open custody. A signature here is an internal receipt, not a Secure Sign seal.
        </>
      )}
      viewNote={{
        mine: ar ? SELF_VIEW_NOTE.assets.ar : SELF_VIEW_NOTE.assets.en,
        reg: ar
          ? "كل أصل لفرع. الحالات: متاح · في العهدة · قيد الفحص · تحت الصيانة · مفقود · مستبعد."
          : "Each asset belongs to a station. States: available · custody · inspection · maintenance · lost · retired.",
        budget: ar
          ? "الأصل الجديد يُخصم من وعاء فرعه الشاري. المنقول يبقى على ميزانية شاريه."
          : "A new asset draws on the buying station's vessel. A transfer stays on the buyer's budget.",
        xfer: view === SELF
          ? (ar
            ? "ترفع الطلب ولا تبتّ فيه. القرار لمدير الفرع المالك أو الإدارة."
            : "You raise the request; you do not settle it. The decision is the owning station manager's or management's.")
          : (ar
            ? "الفرع الطالب يطلب · مدير الفرع المالك يوافق · التسليم يُثبّت النقل. الأصل يحمل منشأه."
            : "The requesting station asks · the owning manager approves · handover locks the move. The asset keeps its origin."),
      }[tab]}
      tabs={view === MANAGE ? [
        { value: "reg", label: ar ? "السجل" : "Register" },
        { value: "budget", label: ar ? "وعاء الأصول" : "Asset vessel" },
        { value: "xfer", label: ar ? "نقل بين الفروع" : "Transfers", count: pendingXfers },
      ] : [
        { value: "mine", label: ar ? "عهدتي" : "My custody", count: myAssets.length },
        { value: "xfer", label: ar ? "طلبات النقل" : "Transfer requests", count: pendingXfers },
      ]}
      tool={tab}
      onTool={setTab}
      meta={(
        <>
          <FinanceViewSwitch ar={ar} view={view} canManage={canManage} showSwitch={!railSide} onChange={setView} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: ar ? "flex-end" : "flex-start" }}>
            <span style={{ fontSize: 10, color: MUTED }}>
              {view === MANAGE ? (ar ? "عهد نشطة" : "Active custody") : (ar ? "أصول بحوزتي" : "Assets I hold")}
            </span>
            <span style={{ fontSize: 15, fontWeight: 700 }}>
              {view === MANAGE ? scoped.filter((a) => a.status === "in_custody").length : myAssets.length}
            </span>
          </div>
          {rights.canCreate && view === MANAGE ? (
            <button
              type="button"
              onClick={() => { setEditing(null); setCreating(true); }}
              style={{ ...ui.btnPrimary, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={14} />
              {ar ? "أصل جديد" : "New asset"}
            </button>
          ) : null}
        </>
      )}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {tab === "mine" && (
        <>
          <KpiStrip stats={[
            { label: ar ? "أصول بحوزتي" : "Assets I hold", value: myAssets.length },
            {
              label: ar ? "تحتاج فحصًا" : "Inspection due",
              value: myAssets.filter((a) => a.nextInspectionDate && a.nextInspectionDate <= new Date().toISOString().slice(0, 10)).length,
              tone: "warn",
            },
            { label: ar ? "قيد الصيانة" : "Under maintenance", value: myAssets.filter((a) => a.status === "maintenance").length },
          ]} />
          <div style={cardShell}>
            {loading ? (
              <div style={{ display: "grid", placeItems: "center", minHeight: 140 }}>
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: MUTED }} />
              </div>
            ) : myAssets.length ? (
              <AssetTable
                assets={myAssets}
                lang={lang}
                stationName={stationName}
                activeStationId={activeStationId}
                onOpen={(a) => setSelected(a.id)}
              />
            ) : (
              <p style={{ margin: "24px 8px", textAlign: "center", fontSize: 13, color: MUTED, lineHeight: 1.8 }}>
                {ar
                  ? "لا عهدة باسمك الآن. ما يُسلَّم إليك يظهر هنا، ولا تُغلق خدمتك وعهدة مفتوحة."
                  : "Nothing is in your custody right now. Whatever is handed to you appears here, and your service cannot close with open custody."}
              </p>
            )}
          </div>
        </>
      )}

      {tab === "reg" && view === MANAGE && (
        <>
        <AssetStats assets={scoped} lang={lang} physicalValue={scoped.filter((a) => a.status !== "retired").reduce((sum, a) => sum + (Number(a.value) || 0), 0)} originValue={bookValue} />
        <div style={cardShell}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end", justifyContent: "space-between", marginBottom: 14 }}>
            <AssetFilters
              lang={lang}
              stations={stations}
              categories={categories}
              filters={{ ...filters, stationId: activeStationId || filters.stationId }}
              setFilters={setFilters}
              allowAllStations={false}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setSeeAll((v) => !v)} style={ui.btnSecondary}>
                {seeAll ? (ar ? "أصول فرعي فقط" : "My station only") : (ar ? "أصول كل الفروع" : "All stations (read)")}
              </button>
              <ComparisonExportButtons
                title={ar ? "سجل الأصول والعهد" : "Assets & custody register"}
                headers={exportHeaders}
                rows={exportRows}
                compact
              />
            </div>
          </div>

          {loading ? (
            <div style={{ display: "grid", placeItems: "center", minHeight: 140 }}>
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: MUTED }} />
            </div>
          ) : (
            <AssetTable
              assets={visible}
              lang={lang}
              stationName={stationName}
              activeStationId={activeStationId}
              onOpen={(a) => setSelected(a.id)}
            />
          )}
        </div>
        </>
      )}

      {tab === "budget" && view === MANAGE && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <KpiStrip stats={[
            { label: ar ? "وعاء المنشأ" : "Origin vessel", value: bookValue.toLocaleString("en-US"), suffix: "SAR" },
            { label: ar ? "قيمة في الموقع" : "On-site value", value: scoped.filter((a) => a.status !== "retired").reduce((sum, a) => sum + (Number(a.value) || 0), 0).toLocaleString("en-US"), suffix: "SAR" },
            { label: ar ? "أصول في الموقع" : "On site", value: scoped.length },
            { label: ar ? "عهد نشطة" : "Active custody", value: scoped.filter((a) => a.status === "in_custody").length, tone: "ok" },
          ]} />
          <div style={cardShell}>
            {(data?.stations || []).filter((s) => !activeStationId || seeAll || String(s.id) === String(activeStationId)).map((station) => {
              const rows = assets.filter((a) => String(a.originStationId || a.stationId) === String(station.id) && a.status !== "retired");
              const value = rows.reduce((sum, a) => sum + (Number(a.value) || 0), 0);
              const pct = bookValue ? Math.round(value / bookValue * 100) : 0;
              return (
                <div key={station.id} style={{ display: "grid", gridTemplateColumns: "minmax(90px,140px) minmax(0,1fr) 72px", gap: 12, alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: MUTED }}>{station.name}</span>
                  <span style={{ height: 8, background: SURFACE, display: "block", overflow: "hidden" }}>
                    <span style={{ display: "block", height: "100%", width: `${Math.max(1, pct)}%`, background: ACCENT }} />
                  </span>
                  <span dir="ltr" style={{ fontSize: 12, color: MUTED }}>{value.toLocaleString("en-US")}</span>
                </div>
              );
            })}
            <p style={{ margin: "8px 0 0", fontSize: 11, color: MUTED, lineHeight: 1.7 }}>
              {ar
                ? "وعاء المنشأ = ما اشتراه هذا الفرع ولو نُقل. قيمة الموقع = ما هو هنا الآن ولو اشتراه فرع آخر. لا يُخلط الرقمان."
                : "Origin vessel = what this station bought, even after a move. On-site value = what sits here now, even if another station bought it. The two figures are not the same."}
            </p>
          </div>
        </div>
      )}

      {tab === "xfer" && (
        <AssetTransferBoard
          companyId={session?.companyId}
          assets={assets}
          stations={data?.stations || []}
          data={data}
          currentUser={currentUser}
          activeStationId={activeStationId}
          ar={ar}
          mineOnly={view === SELF}
          onApplied={async (transfer) => {
            if (transfer?.status === "done") {
              const moved = assets.find((a) => a.id === transfer.assetId);
              if (moved) {
                await run(() => assetsCall(session, "saveAsset", {
                  asset: {
                    ...moved,
                    stationId: transfer.toStationId,
                    originStationId: moved.originStationId || transfer.fromStationId,
                  },
                  assetId: moved.id,
                }));
              }
            }
          }}
        />
      )}
      </div>

      {selectedAsset && (
        <AssetDetail
          asset={selectedAsset}
          custody={custody.filter((c) => c.assetId === selectedAsset.id).sort((a, b) => new Date(b.handedAt) - new Date(a.handedAt))}
          maintenance={maintenance.filter((m) => m.assetId === selectedAsset.id).sort((a, b) => new Date(b.date) - new Date(a.date))}
          lang={lang}
          stationName={stationName}
          onClose={() => setSelected(null)}
          onHandover={can("handover") ? () => setHanding(true) : undefined}
          onEdit={can("save") ? () => { setEditing(selectedAsset); setCreating(true); } : undefined}
          onAddMaintenance={can("maintenance") ? addMaintenance : undefined}
          onMarkLost={can("status") ? () => setReportingLost(true) : undefined}
          onResolveLost={can("resolve") ? () => setResolvingLost(true) : undefined}
          onDelete={can("delete") ? deleteAsset : undefined}
        />
      )}

      {reportingLost && selectedAsset && (
        <MarkLostDialog lang={lang} onClose={() => setReportingLost(false)} onConfirm={markLost} />
      )}

      {resolvingLost && selectedAsset && (
        <ResolveLostDialog lang={lang} onClose={() => setResolvingLost(false)} onConfirm={resolveLost} />
      )}

      {handing && selectedAsset && (
        <HandoverDialog
          asset={selectedAsset}
          employees={employees}
          stations={stations}
          lang={lang}
          onClose={() => setHanding(false)}
          onSubmit={handover}
        />
      )}

      {creating && (
        <AssetForm
          asset={editing}
          stations={stations}
          employees={employees}
          lang={lang}
          onClose={() => { setCreating(false); setEditing(null); }}
          defaultStationId={activeStationId}
          onSave={saveAsset}
        />
      )}
    </SuiteWorkspaceFrame>
  );
}
