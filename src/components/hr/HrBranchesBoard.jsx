import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import StatusFilterPills from "@/components/shared/StatusFilterPills";
import { chip, mono, slab } from "@/components/schedules/scheduleChrome";
import { OrgAddBranchDrawer, OrgBranchDrawer } from "@/components/hr/OrgBranchDrawer";
import { ui } from "@/lib/platformStyles";
import { deriveStationReadiness, readinessLabel } from "@/lib/stationReadiness";
import { HR_BRANCH_FILTERS, hrBranchMatches, hrBranchRows } from "@/lib/hrSection";
import { foldOrgLookup } from "@/lib/orgLookup";

const openBtn = { ...ui.btnRow, padding: "0 14px", height: 30, display: "inline-flex", alignItems: "center", textDecoration: "none", fontWeight: 600, flexShrink: 0 };

const FILTER_LABELS = {
  all: { ar: "الكل", en: "All" },
  attention: { ar: "بحاجة لانتباه", en: "Needs attention" },
  no_manager: { ar: "بلا مدير", en: "No manager" },
  no_city: { ar: "بلا مدينة", en: "No city" },
};

function Num({ children }) {
  return <b dir="ltr" style={{ ...mono, fontWeight: 600, color: "var(--nv-ink)", unicodeBidi: "isolate" }}>{children}</b>;
}

/**
 * «الفروع والمحطات» — what «المحطات التي أديرها» opened, as one list: branches grouped country →
 * city (country only when the company spans countries; «بلا مدينة» last), each with its manager,
 * people and vacant seats in ink, and a chip only when the branch is held (no manager, readiness
 * blocked). Org writers add and open branches here (the same drawers as the tree); a station lead
 * sees only the stations they run and opens them on the chart.
 */
export default function HrBranchesBoard({
  ar = true,
  data,
  company,
  access,
  onHire,
  branchId = "",
  onBranchConsumed,
  initialQuery = "",
}) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState(initialQuery);
  const [focusId, setFocusId] = useState("");
  const [adding, setAdding] = useState(false);
  const [parentId, setParentId] = useState("");
  const canWrite = Boolean(access?.orgWrite);
  const companyName = data?.settings?.companyName || company?.name || (ar ? "المنشأة" : "Company");

  useEffect(() => { setQuery(initialQuery || ""); }, [initialQuery]);
  useEffect(() => {
    if (!branchId) return;
    if (canWrite) setFocusId(String(branchId));
    onBranchConsumed?.();
  }, [branchId, canWrite, onBranchConsumed]);

  const view = useMemo(
    () => hrBranchRows(data, { scopeIds: access?.scopeIds ?? null, ar, readinessOf: (s) => deriveStationReadiness(data, s) }),
    [data, access?.scopeIds, ar],
  );
  const needle = foldOrgLookup(query);
  const matchesQuery = (row) => !needle || foldOrgLookup(`${row.name} ${row.city} ${row.region} ${row.managerName}`).includes(needle);
  const pills = HR_BRANCH_FILTERS.map((id) => ({
    id,
    label: ar ? FILTER_LABELS[id].ar : FILTER_LABELS[id].en,
    n: view.rows.filter((row) => hrBranchMatches(row, id)).length,
  }));
  const groups = view.groups
    .map((g) => ({ ...g, rows: g.rows.filter((row) => hrBranchMatches(row, filter) && matchesQuery(row)) }))
    .filter((g) => g.rows.length);
  const station = focusId ? (data?.stations || []).find((s) => String(s.id) === String(focusId)) : null;

  return (
    <div data-hr-branches="1" className="nv-list-stack">
      <StatusFilterPills
        card
        title={access?.stationLead ? (ar ? "المحطات التي أديرها" : "Stations I manage") : (ar ? "الفروع والمحطات" : "Branches and stations")}
        items={pills}
        value={filter}
        onChange={setFilter}
        dataKey="hr-branches"
        hideZero
        note={access?.stationLead
          ? (ar ? "نطاقك فقط — للاطلاع" : "Your scope only — read only")
          : null}
        trailing={canWrite ? (
          <button type="button" onClick={() => { setParentId(""); setAdding(true); }} style={{ ...ui.btnCreate, height: 30 }}>
            {ar ? "＋ إضافة فرع" : "+ Add branch"}
          </button>
        ) : null}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={ar ? "ابحث باسم الفرع أو المدينة أو المدير" : "Search branch, city or manager"}
          aria-label={ar ? "بحث في الفروع" : "Search branches"}
          className="nv-od-input"
          style={{ width: "100%", maxWidth: 360, marginTop: 10 }}
        />
      </StatusFilterPills>

      <section style={{ ...slab, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {groups.length ? groups.map((g) => (
        <div key={g.key} data-hr-city={g.noCity ? "none" : g.city} style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "9px 18px", background: "var(--nv-soft, #F6F8FA)", borderBottom: "1px solid var(--nv-line2, #EEF2F7)", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <b style={{ fontSize: 12.5, color: g.noCity ? "var(--nv-muted)" : "var(--nv-ink)" }}>{g.city}</b>
            {g.region || g.country ? <span style={{ fontSize: 11.5, color: "var(--nv-muted)" }}>{[g.region, g.country].filter(Boolean).join(" · ")}</span> : null}
            <span style={{ fontSize: 11.5, color: "var(--nv-muted)", marginInlineStart: "auto" }}>
              {ar ? "فروع " : "branches "}<Num>{g.rows.length}</Num>
            </span>
          </div>
          {g.rows.map((row) => {
            const held = row.readiness && row.readiness.level === "blocked";
            return (
              <div key={row.id} data-hr-branch={row.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", borderBottom: "1px solid var(--nv-line2, #EEF2F7)", flexWrap: "wrap", minWidth: 0 }}>
                <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: "1 1 220px", minWidth: 0 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <b style={{ fontSize: 13, color: "var(--nv-ink)" }}>{row.name}</b>
                    {row.noManager ? <span style={chip("warn")}>{ar ? "بلا مدير" : "No manager"}</span> : null}
                    {held ? <span style={chip("bad")}>{readinessLabel("blocked", ar)}</span> : null}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--nv-muted)", lineHeight: 1.7 }}>
                    {row.managerName ? <>{ar ? "المدير: " : "Manager: "}{row.managerName} · </> : null}
                    {ar ? "موظفون " : "people "}<Num>{row.headcount}</Num>
                    {row.seats ? <> · {ar ? "مناصب " : "seats "}<Num>{row.seats}</Num>{row.vacant ? <> · {ar ? "شاغرة " : "vacant "}<Num>{row.vacant}</Num></> : null}</> : null}
                    {row.readiness?.top && row.readiness.level !== "ready" ? <> · {ar ? row.readiness.top.ar : row.readiness.top.en}</> : null}
                  </span>
                </span>
                {canWrite ? (
                  <button type="button" onClick={() => setFocusId(row.id)} style={{ ...openBtn, border: "none" }}>{ar ? "افتح" : "Open"}</button>
                ) : (
                  <Link to="/app/org/chart?view=branches" state={{ from: "/app/hr?tab=branches" }} style={openBtn}>{ar ? "افتح" : "Open"}</Link>
                )}
              </div>
            );
          })}
        </div>
      )) : (
        <p style={{ margin: 0, padding: "16px 18px", fontSize: 12.5, color: "var(--nv-muted)" }}>
          {view.rows.length
            ? (ar ? "لا فرع يطابق هذا الفلتر." : "No branch matches this filter.")
            : (access?.stationLead
              ? (ar ? "لا محطات مسندة إليك بعد — تُسند من الهيكل." : "No stations assigned to you yet — assigned from the structure.")
              : (ar ? "لا فروع بعد — أضف أول فرع." : "No branches yet — add the first one."))}
        </p>
      )}
      </section>

      {canWrite && station ? (
        <OrgBranchDrawer
          open
          station={station}
          data={data}
          companyId={company?.id || ""}
          companyName={companyName}
          ar={ar}
          canWrite={canWrite}
          onHire={onHire}
          onAddChild={(pid) => { setParentId(pid); setAdding(true); }}
          onClose={() => setFocusId("")}
          onDeleted={() => setFocusId("")}
        />
      ) : null}
      {canWrite ? (
        <OrgAddBranchDrawer
          open={adding}
          initialParentId={parentId}
          data={data}
          company={company}
          companyId={company?.id || ""}
          companyName={companyName}
          ar={ar}
          onClose={() => { setAdding(false); setParentId(""); }}
          onCreated={(id) => { setAdding(false); setParentId(""); if (id) setFocusId(id); }}
        />
      ) : null}
    </div>
  );
}
