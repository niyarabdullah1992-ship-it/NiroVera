import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { visibleStations } from "@/lib/permissions";
import { assetsCall, assetStatusLabel } from "@/lib/assetsApi";
import PlatformStampShell from "@/components/shared/PlatformStampShell";
import { erpKicker } from "@/lib/erpModuleMeta";
import { ChromeBox } from "@/components/shared/IdentityCard";
import AssetStats from "@/components/assets/AssetStats";
import AssetFilters from "@/components/assets/AssetFilters";
import AssetTable from "@/components/assets/AssetTable";
import AssetDetail from "@/components/assets/AssetDetail";
import AssetForm from "@/components/assets/AssetForm";
import HandoverDialog from "@/components/assets/HandoverDialog";
import MarkLostDialog from "@/components/assets/MarkLostDialog";
import ResolveLostDialog from "@/components/assets/ResolveLostDialog";
import ComparisonExportButtons from "@/components/reports/ComparisonExportButtons";
import { toast } from "@/components/ui/use-toast";
import { MUTED, ui } from "@/lib/platformStyles";

export default function Assets() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { data, currentUser, session } = useAuth();
  const [assets, setAssets] = useState([]);
  const [custody, setCustody] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ category: "all", stationId: "all", status: "all" });
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [handing, setHanding] = useState(false);
  const [reportingLost, setReportingLost] = useState(false);
  const [resolvingLost, setResolvingLost] = useState(false);

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

  const stations = data && currentUser ? visibleStations(currentUser, data) : [];
  const stationIds = useMemo(() => new Set(stations.map((s) => s.id)), [stations]);
  const stationName = (id) => data?.stations?.find((s) => s.id === id)?.name || "—";
  const employees = (data?.employees || []).filter((e) => !e.stationId || stationIds.has(e.stationId));

  const scoped = useMemo(
    () => assets.filter((a) => !a.stationId || stationIds.has(a.stationId)),
    [assets, stationIds],
  );
  const categories = [...new Set(scoped.map((a) => a.category).filter(Boolean))];
  const visible = scoped.filter((a) =>
    (filters.category === "all" || a.category === filters.category)
    && (filters.stationId === "all" || a.stationId === filters.stationId)
    && (filters.status === "all" || a.status === filters.status));
  const selectedAsset = selected ? assets.find((a) => a.id === selected) : null;

  const run = async (fn) => {
    try {
      await fn();
      await reload();
      return true;
    } catch (error) {
      toast({ description: error?.response?.data?.error || error.message, variant: "destructive" });
      return false;
    }
  };

  const saveAsset = async (asset) => run(() => assetsCall(session, "saveAsset", { asset, assetId: editing?.id || null }));
  const handover = async (payload) => run(() => assetsCall(session, "handover", payload));
  const addMaintenance = async (record) => run(() => assetsCall(session, "logMaintenance", { assetId: selected, maintenance: record }));
  const markLost = async (reason) => run(() => assetsCall(session, "setStatus", { assetId: selected, status: "lost", reason }));
  const resolveLost = async ({ decision, reason }) => run(() => assetsCall(session, "resolveLost", {
    assetId: selected,
    decision,
    reason,
    lostCase: selectedAsset?.lostCase || {},
  }));

  const exportHeaders = ar
    ? ["الأصل", "الرقم", "الفئة", "الحائز", "الوحدة", "الحالة", "الفحص القادم", "القيمة"]
    : ["Asset", "Code", "Category", "Holder", "Unit", "Status", "Next inspection", "Value"];
  const exportRows = visible.map((a) => [
    a.name,
    a.assetCode,
    a.category || "—",
    a.holderName || "—",
    stationName(a.stationId),
    assetStatusLabel(a.status, lang),
    a.nextInspectionDate || "—",
    a.value || 0,
  ]);

  return (
    <PlatformStampShell
      ar={ar}
      kicker={erpKicker("/app/assets", lang)}
      title={ar ? "الأصول / العهد" : "Assets / Custody"}
      hint={ar
        ? "سجل أصل موسوم · حائز واحد · تسليم بتوقيع الطرفين · الاسترجاع شرط إنهاء الخدمة."
        : "Tagged asset register · one holder · dual-sign handover · return gates offboarding."}
      meta={(
        <button
          type="button"
          onClick={() => { setEditing(null); setCreating(true); }}
          style={{ ...ui.btnPrimary, display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Plus size={14} />
          {ar ? "أصل جديد" : "New asset"}
        </button>
      )}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <ChromeBox style={{ padding: 14 }}>
          <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.7 }}>
            {ar ? (
              <>
                استرجاع العهد شرط{" "}
                <Link to="/app/hr" style={{ color: "inherit", fontWeight: 650 }}>إنهاء الخدمة في الموارد البشرية</Link>
                {" "}— لا تُغلق الخدمة وعهدة مفتوحة.
              </>
            ) : (
              <>
                Return gates{" "}
                <Link to="/app/hr" style={{ color: "inherit", fontWeight: 650 }}>HR offboarding</Link>
                {" "}— service cannot close with open custody.
              </>
            )}
          </p>
        </ChromeBox>
        <AssetStats assets={scoped} lang={lang} />

        <ChromeBox>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end", justifyContent: "space-between", marginBottom: 14 }}>
            <AssetFilters
              lang={lang}
              stations={stations}
              categories={categories}
              filters={filters}
              setFilters={setFilters}
            />
            <ComparisonExportButtons
              title={ar ? "سجل الأصول والعهد" : "Assets & custody register"}
              headers={exportHeaders}
              rows={exportRows}
              compact
            />
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
              onOpen={(a) => setSelected(a.id)}
            />
          )}
        </ChromeBox>
      </div>

      {selectedAsset && (
        <AssetDetail
          asset={selectedAsset}
          custody={custody.filter((c) => c.assetId === selectedAsset.id).sort((a, b) => new Date(b.handedAt) - new Date(a.handedAt))}
          maintenance={maintenance.filter((m) => m.assetId === selectedAsset.id).sort((a, b) => new Date(b.date) - new Date(a.date))}
          lang={lang}
          stationName={stationName}
          onClose={() => setSelected(null)}
          onHandover={() => setHanding(true)}
          onEdit={() => { setEditing(selectedAsset); setCreating(true); }}
          onAddMaintenance={addMaintenance}
          onMarkLost={() => setReportingLost(true)}
          onResolveLost={() => setResolvingLost(true)}
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
          onSave={saveAsset}
        />
      )}
    </PlatformStampShell>
  );
}
