import React, { useEffect, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/PowerCareAuth";
import {
  ORG_ROLES,
  ORG_SECTIONS,
  SCOPE,
  checkSetPermGate,
  checkRemoveTitleGate,
  collectJobTitles,
  derivePermissionMatrix,
  effectiveTitleScope,
  nextScopeInCycle,
  titleSlug,
} from "@/lib/orgDerivations";
import { removeCompanyJobTitle } from "@/lib/orgTree";
import { toast } from "@/components/ui/use-toast";
import { MUTED, NAVY, NEUTRAL, OK, WARN, field, CARD, SURFACE } from "@/lib/platformStyles";
import { ChromeBox } from "@/components/shared/IdentityCard";
import PlatformDateField from "@/components/shared/PlatformDateField";
import { companyLists, templateLabel } from "@/lib/permissionTemplates";
import { delegationScopeFromSeat, todayKey } from "@/lib/orgHire";

/**
 * Platform settings L2162–2231 — permission matrix + temporary delegation.
 * Owned by `/app/settings` (not Org).
 */

async function orgApi(payload) {
  const res = await base44.functions.invoke("org", payload);
  return res?.data ?? res;
}

const SECTION_LABEL = {
  command: { ar: "لوحة القيادة", en: "Dashboard" },
  operations: { ar: "المهام والعمليات", en: "Operations" },
  attendance: { ar: "الحضور", en: "Attendance" },
  hse: { ar: "السلامة HSE", en: "Safety HSE" },
  complaints: { ar: "الشكاوى", en: "Complaints" },
  leave: { ar: "طلباتي", en: "My requests" },
  hr: { ar: "الموارد البشرية", en: "Human Resources" },
  payroll: { ar: "الرواتب", en: "Payroll" },
  settings: { ar: "إعدادات الشركة", en: "Company settings" },
};

const ROLE_LABEL = {
  ops_director: { ar: "مدير عمليات", en: "Ops Director" },
  station_manager: { ar: "مدير فرع", en: "Station Mgr" },
  supervisor: { ar: "مشرف", en: "Supervisor" },
  safety: { ar: "سلامة", en: "Safety" },
  employee: { ar: "موظف", en: "Employee" },
};

const SCOPE_LABEL = {
  [SCOPE.NONE]: { ar: "—", en: "—", fullAr: "لا صلاحية", fullEn: "No access" },
  [SCOPE.OWN]: { ar: "خاصته", en: "Own", fullAr: "سجلاته هو فقط", fullEn: "Own records only" },
  [SCOPE.STATION]: { ar: "فرعه", en: "Station", fullAr: "كل من في فرعه", fullEn: "Everyone at their station" },
  [SCOPE.REGION]: { ar: "منطقته", en: "Region", fullAr: "كل فروع منطقته", fullEn: "Every station in their region" },
  [SCOPE.COMPANY]: { ar: "كامل", en: "Company", fullAr: "الشركة كاملة", fullEn: "The whole company" },
  [SCOPE.DELEGATED]: { ar: "بتفويض", en: "Delegated", fullAr: "مشتقة من سجل التفويض", fullEn: "Derived from the delegation register" },
};

function scopeChipStyle(scope) {
  if (scope === SCOPE.COMPANY) return OK;
  if (scope === SCOPE.STATION) {
    return {
      display: "inline-flex",
      alignItems: "center",
      padding: "3px 9px",
      borderRadius: "20px",
      fontSize: "11px",
      fontWeight: 600,
      background: "#EFF6FF",
      color: "#1D4ED8",
      border: "1px solid #BFDBFE",
    };
  }
  if (scope === SCOPE.REGION) {
    return {
      display: "inline-flex",
      alignItems: "center",
      padding: "3px 9px",
      borderRadius: "20px",
      fontSize: "11px",
      fontWeight: 600,
      background: "#F5F3FF",
      color: "#6D28D9",
      border: "1px solid #DDD6FE",
    };
  }
  if (scope === SCOPE.DELEGATED) return WARN;
  if (scope === SCOPE.OWN) return NEUTRAL;
  return { fontSize: "11px", color: MUTED };
}

const fieldInput = { ...field };

export default function SettingsPermDelegation({ lang = "ar" }) {
  const ar = lang === "ar";
  const { company, data, currentUser } = useAuth();
  const [matrix, setMatrix] = useState([]);
  const [titleCols, setTitleCols] = useState([]);
  const [removedTitles, setRemovedTitles] = useState([]);
  const [delegations, setDelegations] = useState([]);
  const [permDirty, setPermDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dgForm, setDgForm] = useState({
    fromId: "",
    toId: "",
    perm: ar ? "اعتماد المهام" : "Task approval",
    start: "",
    end: "",
    reason: "",
    stationId: "",
    listId: "",
  });

  const isSenior = currentUser && (
    ["owner", "director", "ops_manager", "pgm", "admin"].includes(currentUser.role)
    || data?.ownerId === currentUser?.id
  );

  const employees = data?.employees || [];
  const empName = (id) => employees.find((e) => e.id === id)?.name || id || "—";
  const localTitles = collectJobTitles(data);

  const applyRemote = (remote) => {
    if (!remote) return;
    const blocked = (remote.removedTitles || []).map((item) => titleSlug(item)).filter(Boolean);
    setRemovedTitles(blocked);
    const live = collectJobTitles(data);
    const byId = new Map();
    for (const title of live) byId.set(title.id, { ...title });
    for (const item of remote.titles || []) {
      const label = typeof item === "string" ? item : item.label || item.id;
      const id = titleSlug(typeof item === "string" ? item : item.id || label);
      if (!id || (blocked.includes(id) && !byId.has(id))) continue;
      const prev = byId.get(id);
      byId.set(id, {
        id,
        label: label || prev?.label || id,
        count: Math.max(Number(item?.count) || 0, prev?.count || 0),
      });
    }
    const nextTitles = [...byId.values()].sort((a, b) => a.label.localeCompare(b.label, "ar"));
    setTitleCols(nextTitles);
    const rows = remote.matrix?.length
      ? remote.matrix
      : derivePermissionMatrix(remote.permOverrides || {}, nextTitles);
    const hasTitleCells = rows.some((row) => (row.cells || []).some((cell) => cell.titleKey || String(cell.roleId || "").startsWith("title:")));
    setMatrix(hasTitleCells ? rows : derivePermissionMatrix(remote.permOverrides || {}, nextTitles));
    setDelegations(remote.delegations || []);
    setPermDirty(!!remote.permDirty);
  };

  const load = async () => {
    if (!company?.id) return;
    try {
      const remote = await orgApi({ action: "list", companyId: company.id, titles: localTitles });
      applyRemote(remote);
    } catch {
      setTitleCols(localTitles);
      setMatrix(derivePermissionMatrix({}, localTitles));
      setDelegations([]);
    }
  };

  const titleKey = localTitles.map((t) => t.id).join("|");
  useEffect(() => { load(); }, [company?.id]);
  useEffect(() => {
    if (!localTitles.length && !titleCols.length) return;
    setTitleCols((prev) => {
      const blocked = new Set(removedTitles);
      const liveIds = new Set(localTitles.map((t) => t.id));
      const byId = new Map(prev.filter((t) => liveIds.has(t.id) || !blocked.has(t.id)).map((t) => [t.id, { ...t }]));
      let changed = prev.length !== byId.size;
      for (const title of localTitles) {
        const existing = byId.get(title.id);
        if (!existing) {
          byId.set(title.id, title);
          changed = true;
        } else if ((existing.count || 0) < title.count) {
          byId.set(title.id, { ...existing, count: title.count, label: existing.label || title.label });
          changed = true;
        }
      }
      for (const id of blocked) {
        if (!liveIds.has(id) && byId.delete(id)) changed = true;
      }
      return changed ? [...byId.values()].sort((a, b) => a.label.localeCompare(b.label, "ar")) : prev;
    });
  }, [titleKey, removedTitles.join("|")]);

  const run = async (payload, okMsg) => {
    if (!company?.id) return;
    setBusy(true);
    try {
      const remote = await orgApi({ ...payload, companyId: company.id, titles: localTitles });
      if (remote?.error) {
        toast({
          description: ar ? (remote.reason || remote.error) : (remote.reasonEn || remote.reason || remote.error),
          variant: "destructive",
        });
      } else {
        if (okMsg) toast({ description: okMsg });
        applyRemote(remote);
      }
    } catch (err) {
      toast({ description: String(err?.message || err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const cycleCell = (si, cell, ri) => {
    if (cell.derived) {
      toast({
        description: ar
          ? "«بتفويض» حالة مشتقة من سجل التفويض — لا تُضبط من المصفوفة."
          : "\"Delegated\" is derived — manage it in the temporary delegation register.",
        variant: "destructive",
      });
      return;
    }
    const next = nextScopeInCycle(cell.scope);
    const gate = checkSetPermGate(next);
    if (!gate.ok) {
      toast({ description: ar ? gate.reason : gate.reasonEn, variant: "destructive" });
      return;
    }
    run({
      action: "setPerm",
      sectionIdx: si,
      roleIdx: cell.titleKey ? undefined : ri,
      titleKey: cell.titleKey || undefined,
      scope: next,
    });
  };

  const removeTitle = (title) => {
    const gate = checkRemoveTitleGate(title.label || title.id);
    if (!gate.ok) {
      toast({ description: ar ? gate.reason : gate.reasonEn, variant: "destructive" });
      return;
    }
    const ok = window.confirm(
      ar
        ? `حذف مسمى «${title.label}» من المصفوفة ومن بطاقات الموظفين؟`
        : `Remove “${title.label}” from the matrix and from employee cards?`,
    );
    if (!ok) return;
    if (company?.id) removeCompanyJobTitle(company.id, title.label || title.id);
    setRemovedTitles((prev) => [...new Set([...prev, gate.id])]);
    setTitleCols((prev) => prev.filter((item) => item.id !== gate.id));
    run(
      {
        action: "removeTitle",
        titleKey: title.label || title.id,
        titles: localTitles.filter((item) => item.id !== gate.id),
      },
      ar ? `حُذف مسمى ${title.label}` : `Removed ${title.label}`,
    );
  };

  const columns = [
    ...ORG_ROLES.map((r) => ({ id: r, label: ar ? ROLE_LABEL[r].ar : ROLE_LABEL[r].en })),
    ...titleCols.map((t) => ({ id: `title:${t.id}`, label: t.label, count: t.count })),
  ];
  const colTemplate = `minmax(180px,1.4fr) repeat(${Math.max(columns.length, 5)},minmax(88px,1fr))`;

  const activeDg = delegations.filter((d) => !d.revoked && !d.expired).length;

  return (
    <>
      {/* L2162–2207 permission matrix */}
      <ChromeBox padded={false}>
        <div style={{ padding: "16px 20px 12px" }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>{ar ? "مصفوفة الصلاحيات" : "Permission matrix"}</div>
          <div style={{ fontSize: "11px", color: MUTED, marginTop: "4px" }}>
            {ar
              ? "الأساس مشتق من الدور والموقع في الهيكل. المسميات الحرة تظهر كأعمدة إضافية ويمكن حذف أي منها من رأس العمود — فيُزال من المصفوفة ومن بطاقات الموظفين."
              : "The baseline derives from role and position in the structure. Free job titles appear as extra columns; delete any of them from the column header to remove it from the matrix and from employee cards."}
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: `${Math.max(760, 220 + columns.length * 110)}px` }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: colTemplate,
                gap: "10px",
                padding: "10px 20px",
                background: SURFACE,
                borderTop: "1px solid #E2E8F0",
                borderBottom: "1px solid #E2E8F0",
                fontSize: "10px",
                letterSpacing: "0.04em",
                color: MUTED,
                fontWeight: 600,
              }}
            >
              <div>{ar ? "القسم" : "Section"}</div>
              {columns.map((col) => (
                <div key={col.id} style={{ display: "flex", alignItems: "flex-start", gap: 6, minWidth: 0 }}>
                  <div style={{ minWidth: 0 }}>
                    {col.label}
                    {col.count > 0 ? (
                      <span style={{ display: "block", fontWeight: 500, letterSpacing: 0, marginTop: 2 }}>
                        {ar ? `${col.count} موظف` : `${col.count} staff`}
                      </span>
                    ) : null}
                  </div>
                  {String(col.id).startsWith("title:") && isSenior ? (
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={ar ? `حذف ${col.label}` : `Remove ${col.label}`}
                      onClick={() => removeTitle(titleCols.find((t) => `title:${t.id}` === col.id) || { id: col.id.replace(/^title:/, ""), label: col.label })}
                      style={{
                        width: 18,
                        height: 18,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid #E2E8F0",
                        borderRadius: 6,
                        background: CARD,
                        color: MUTED,
                        cursor: busy ? "wait" : "pointer",
                        padding: 0,
                        flexShrink: 0,
                      }}
                    >
                      <X style={{ width: 10, height: 10 }} />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            {(matrix.length ? matrix : ORG_SECTIONS.map((sectionId) => ({ sectionId, cells: [] }))).filter((row) => row.sectionId !== "daily").map((row) => {
              const si = ORG_SECTIONS.indexOf(row.sectionId);
              return (
              <div
                key={row.sectionId}
                style={{
                  display: "grid",
                  gridTemplateColumns: colTemplate,
                  gap: "10px",
                  padding: "11px 20px",
                  borderBottom: "1px solid #F1F5F9",
                  alignItems: "center",
                }}
              >
                <div style={{ fontSize: "13px", color: NAVY }}>
                  {ar ? SECTION_LABEL[row.sectionId]?.ar : SECTION_LABEL[row.sectionId]?.en}
                </div>
                {(() => {
                  const cells = [...(row.cells || [])];
                  const have = new Set(cells.map((c) => c.roleId));
                  for (const title of titleCols) {
                    const id = `title:${title.id}`;
                    if (!have.has(id)) {
                      cells.push({ roleId: id, titleKey: title.label, ...effectiveTitleScope(si, title.id, {}) });
                    }
                  }
                  return cells.length ? cells : ORG_ROLES.map((roleId) => ({ roleId, scope: SCOPE.NONE, derived: false }));
                })().map((cell, ri) => {
                  const lab = SCOPE_LABEL[cell.scope] || SCOPE_LABEL[SCOPE.NONE];
                  return (
                    <button
                      key={cell.roleId}
                      type="button"
                      disabled={!isSenior || busy}
                      title={ar ? lab.fullAr : lab.fullEn}
                      onClick={() => cycleCell(si, cell, ri)}
                      style={{
                        cursor: cell.derived || !isSenior ? "not-allowed" : "pointer",
                        padding: "2px",
                        borderRadius: "8px",
                        background: "transparent",
                        border: "none",
                        fontFamily: "inherit",
                        textAlign: "start",
                        opacity: !isSenior || busy ? 0.7 : 1,
                      }}
                    >
                      <span style={scopeChipStyle(cell.scope)}>{ar ? lab.ar : lab.en}</span>
                    </button>
                  );
                })}
              </div>
            );
            })}
          </div>
        </div>
        <div style={{ padding: "14px 20px 16px", borderTop: "1px solid #F1F5F9" }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {[SCOPE.OWN, SCOPE.STATION, SCOPE.REGION, SCOPE.COMPANY].map((s) => {
              const lab = SCOPE_LABEL[s];
              return (
                <span key={s} style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                  <span style={scopeChipStyle(s)}>{ar ? lab.ar : lab.en}</span>
                  <span style={{ fontSize: "11px", color: MUTED }}>{ar ? lab.fullAr : lab.fullEn}</span>
                </span>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "7px", marginTop: "9px", paddingTop: "9px", borderTop: "1px dashed #E2E8F0" }}>
            <span style={scopeChipStyle(SCOPE.DELEGATED)}>{ar ? SCOPE_LABEL[SCOPE.DELEGATED].ar : SCOPE_LABEL[SCOPE.DELEGATED].en}</span>
            <span style={{ fontSize: "11px", color: MUTED }}>
              {ar ? "مشتقة من سجل التفويض أدناه — لا تُضبط بالضغط" : "Derived from the delegation register below — not set by clicking"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "12px", flexWrap: "wrap" }}>
            <span style={{ flex: "1 1 300px", fontSize: "11px", color: MUTED, lineHeight: 1.65 }}>
              {ar
                ? "اضغط أي خانة لترفع نطاقها أو تخفضه — خاصته ← فرعه ← منطقته ← كامل ← لا صلاحية. كل تغيير يُقيَّد باسمك ووقته."
                : "Click any cell to raise or lower its scope — own → station → region → company → none. Every change is recorded with your name and time."}
            </span>
            {permDirty && isSenior && (
              <button
                type="button"
                disabled={busy}
                onClick={() => run({ action: "resetPerms" }, ar ? "أُعيدت المصفوفة إلى المشتقّة من الهيكل." : "Matrix reset to structure-derived baseline.")}
                style={{
                  padding: "6px 13px",
                  borderRadius: "8px",
                  border: "1px solid #E2E8F0",
                  background: CARD,
                  color: MUTED,
                  fontSize: "11px",
                  cursor: busy ? "wait" : "pointer",
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  opacity: busy ? 0.6 : 1,
                }}
              >
                <RotateCcw style={{ width: 12, height: 12 }} />
                {ar ? "أعِد المصفوفة إلى المشتقّة من الهيكل" : "Reset to the structure-derived matrix"}
              </button>
            )}
          </div>
        </div>
      </ChromeBox>

      {/* L2209–2231 temporary delegation */}
      <ChromeBox>
        <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 260px" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>{ar ? "التفويض المؤقت" : "Temporary delegation"}</div>
            <div style={{ fontSize: "11px", color: MUTED, marginTop: "4px", lineHeight: 1.7, maxWidth: "820px" }}>
              {ar
                ? "الصلاحية المفوَّضة تنتهي بنفسها في تاريخها ولا تحتاج من يتذكّر سحبها — المفوِّض يبقى مسؤولًا."
                : "A delegated permission expires on its own date and needs nobody to remember withdrawing it — the delegator stays accountable."}
            </div>
          </div>
          <span style={{ fontSize: "11px", color: MUTED }}>
            {activeDg === 0
              ? (ar ? "لا تفويضات سارية" : "0 active")
              : (ar ? `${activeDg} تفويضات سارية` : `${activeDg} active`)}
          </span>
          {isSenior && (
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("nv-dg-form");
                el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
              }}
              style={{
                padding: "7px 14px",
                borderRadius: "9px",
                border: "1px solid #1E9E63",
                background: CARD,
                color: "#14683F",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
              }}
            >
              {ar ? "+ فوّض صلاحية مؤقتًا" : "+ Delegate temporarily"}
            </button>
          )}
        </div>

        {isSenior && (
          <form
            id="nv-dg-form"
            style={{
              marginTop: "14px",
              padding: "15px 16px",
              borderRadius: "12px",
              background: SURFACE,
              border: "1px solid #E2E8F0",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
              gap: "11px",
              alignItems: "end",
            }}
            onSubmit={(e) => {
              e.preventDefault();
              run({
                action: "createDelegation",
                ...dgForm,
                start: dgForm.start || todayKey(),
                stationId: dgForm.stationId || delegationScopeFromSeat(data, dgForm.fromId).stationId,
                listId: dgForm.listId || delegationScopeFromSeat(data, dgForm.fromId).listId,
              }, ar ? "فُوّضت صلاحية مؤقتة." : "Temporary delegation created.");
            }}
          >
            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: "11px", fontWeight: 600, color: MUTED, marginBottom: "5px" }}>{ar ? "من" : "From"}</span>
              <select
                required
                value={dgForm.fromId}
                onChange={(e) => {
                  const fromId = e.target.value;
                  const scope = delegationScopeFromSeat(data, fromId);
                  setDgForm((f) => ({
                    ...f,
                    fromId,
                    stationId: f.stationId || scope.stationId,
                    listId: f.listId || scope.listId,
                    start: f.start || todayKey(),
                  }));
                }}
                style={fieldInput}
              >
                <option value="">{ar ? "من" : "From"}</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </label>
            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: "11px", fontWeight: 600, color: MUTED, marginBottom: "5px" }}>{ar ? "إلى" : "To"}</span>
              <select required value={dgForm.toId} onChange={(e) => setDgForm((f) => ({ ...f, toId: e.target.value }))} style={fieldInput}>
                <option value="">{ar ? "إلى" : "To"}</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </label>
            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: "11px", fontWeight: 600, color: MUTED, marginBottom: "5px" }}>{ar ? "من تاريخ" : "From"}</span>
              <PlatformDateField ar={ar} value={dgForm.start} onChange={(next) => setDgForm((f) => ({ ...f, start: next }))} />
            </label>
            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: "11px", fontWeight: 600, color: MUTED, marginBottom: "5px" }}>{ar ? "حتى" : "Until"}</span>
              <PlatformDateField required ar={ar} value={dgForm.end} min={dgForm.start} onChange={(next) => setDgForm((f) => ({ ...f, end: next }))} />
            </label>
            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: "11px", fontWeight: 600, color: MUTED, marginBottom: "5px" }}>{ar ? "نطاق الفرع" : "Branch scope"}</span>
              <select value={dgForm.stationId} onChange={(e) => setDgForm((f) => ({ ...f, stationId: e.target.value }))} style={fieldInput}>
                <option value="">{ar ? "من مقعد المفوِّض" : "From delegator seat"}</option>
                {(data?.stations || []).map((station) => (
                  <option key={station.id} value={station.id}>{station.name}</option>
                ))}
              </select>
            </label>
            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: "11px", fontWeight: 600, color: MUTED, marginBottom: "5px" }}>{ar ? "نطاق القائمة" : "List scope"}</span>
              <select value={dgForm.listId} onChange={(e) => setDgForm((f) => ({ ...f, listId: e.target.value }))} style={fieldInput}>
                <option value="">{ar ? "من مقعد المفوِّض" : "From delegator seat"}</option>
                {companyLists(data).map((pack) => (
                  <option key={pack.id} value={pack.id}>{templateLabel(pack, ar)}</option>
                ))}
              </select>
            </label>
            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: "11px", fontWeight: 600, color: MUTED, marginBottom: "5px" }}>{ar ? "الصلاحية" : "Permission"}</span>
              <input value={dgForm.perm} onChange={(e) => setDgForm((f) => ({ ...f, perm: e.target.value }))} style={fieldInput} />
            </label>
            <button
              type="submit"
              disabled={busy}
              style={{
                height: "36px",
                padding: "0 16px",
                borderRadius: "9px",
                border: "none",
                background: "#1E9E63",
                color: "#fff",
                fontSize: "12px",
                fontWeight: 600,
                cursor: busy ? "wait" : "pointer",
                fontFamily: "inherit",
                opacity: busy ? 0.6 : 1,
              }}
            >
              {ar ? "فوّض" : "Delegate"}
            </button>
          </form>
        )}

        {delegations.filter((d) => !d.revoked).length === 0 && (
          <div style={{ padding: "22px 0 6px", textAlign: "center", fontSize: "13px", color: MUTED }}>
            {ar ? "لا تفويضات سارية." : "No active delegations."}
          </div>
        )}
        {delegations.filter((d) => !d.revoked).map((d) => (
          <div
            key={d.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "13px 0",
              borderTop: "1px solid #F1F5F9",
              flexWrap: "wrap",
              opacity: d.expired ? 0.7 : 1,
            }}
          >
            <span style={{ flex: "1 1 230px", minWidth: 0 }}>
              <span style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY }}>{d.perm}</span>
              <span style={{ display: "block", fontSize: "11px", color: MUTED, marginTop: "2px" }}>
                {empName(d.fromId)} ← {empName(d.toId)} · {d.reason || (ar ? "تغطية مؤقتة" : "Temporary cover")}
                {(() => {
                  const branch = (data?.stations || []).find((station) => station.id === d.stationId)?.name;
                  const pack = companyLists(data).find((item) => item.id === d.listId);
                  const scope = [branch, pack ? templateLabel(pack, ar) : ""].filter(Boolean).join(" · ");
                  return scope ? ` · ${scope}` : "";
                })()}
              </span>
            </span>
            <span style={{ fontSize: "11px", color: MUTED, whiteSpace: "nowrap" }}>{d.start ? `${d.start} → ${d.end}` : d.end}</span>
            <span style={d.expired
              ? {
                display: "inline-flex",
                alignItems: "center",
                padding: "3px 9px",
                borderRadius: "20px",
                fontSize: "11px",
                fontWeight: 600,
                background: "#F1F5F9",
                color: MUTED,
                border: "1px solid #E2E8F0",
              }
              : d.status === "scheduled"
                ? {
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "3px 9px",
                  borderRadius: "20px",
                  fontSize: "11px",
                  fontWeight: 600,
                  background: "hsl(219 45% 44% / .1)",
                  color: "hsl(219 45% 34%)",
                  border: "1px solid hsl(219 45% 44% / .25)",
                }
              : d.daysLeft <= 2 ? WARN : OK}
            >
              {d.expired
                ? (ar ? "انتهت — سُحبت تلقائيًا" : "Expired — withdrawn automatically")
                : d.status === "scheduled"
                  ? (ar ? `تبدأ ${d.start}` : `Starts ${d.start}`)
                : (ar ? `تبقّى ${d.daysLeft} يومًا` : `${d.daysLeft} days left`)}
            </span>
            {isSenior && (
              <button
                type="button"
                disabled={busy}
                onClick={() => run({ action: "revokeDelegation", id: d.id })}
                style={{
                  padding: "5px 11px",
                  borderRadius: "8px",
                  border: "1px solid #E2E8F0",
                  background: CARD,
                  color: MUTED,
                  fontSize: "11px",
                  cursor: busy ? "wait" : "pointer",
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                  opacity: busy ? 0.6 : 1,
                }}
              >
                {d.expired ? (ar ? "أزل من القائمة" : "Remove") : (ar ? "اسحب الآن" : "Revoke now")}
              </button>
            )}
          </div>
        ))}
      </ChromeBox>
    </>
  );
}
