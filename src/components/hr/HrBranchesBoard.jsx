import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import StatusFilterPills from "@/components/shared/StatusFilterPills";
import { chip, mono, slab } from "@/components/schedules/scheduleChrome";
import { OrgAddBranchDrawer, OrgBranchDrawer } from "@/components/hr/OrgBranchDrawer";
import { ui } from "@/lib/platformStyles";
import { deriveStationReadiness } from "@/lib/stationReadiness";
import { HR_BRANCH_FILTERS, hrBranchMatches, hrBranchRows } from "@/lib/hrSection";
import { foldOrgLookup } from "@/lib/orgLookup";


const FILTER_LABELS = {
  all: { ar: "الكل", en: "All" },
  attention: { ar: "بحاجة لانتباه", en: "Needs attention" },
  no_manager: { ar: "بلا مدير", en: "No manager" },
  no_city: { ar: "بلا مدينة", en: "No city" },
};

// one table instead of a city-by-city stack: every branch is one row, sortable by any column
const COLS = [
  { id: "name", ar: "الفرع", en: "Branch", get: (r) => r.name },
  { id: "city", ar: "المدينة", en: "City", get: (r) => r.city },
  { id: "manager", ar: "المدير", en: "Manager", get: (r) => r.managerName },
  { id: "people", ar: "الموظفون", en: "People", num: true, get: (r) => r.headcount },
  { id: "seats", ar: "المناصب", en: "Seats", num: true, get: (r) => r.seats },
  { id: "vacant", ar: "شاغرة", en: "Vacant", num: true, get: (r) => r.vacant },
  { id: "status", ar: "الحالة", en: "Status", num: true, get: (r) => (r.noManager ? 2 : (r.readiness?.level && r.readiness.level !== "ready" ? 1 : 0)) },
];

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
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState({ key: "name", dir: 1 });
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
  const rows = view.rows
    .filter((row) => hrBranchMatches(row, filter) && matchesQuery(row))
    .slice()
    .sort((x, y) => {
      const col = COLS.find((c) => c.id === sort.key) || COLS[0];
      const a = col.get(x); const b = col.get(y);
      if (col.num) return (Number(a || 0) - Number(b || 0)) * sort.dir;
      if (!a && b) return 1;
      if (a && !b) return -1;
      return String(a || "").localeCompare(String(b || ""), "ar") * sort.dir;
    });
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

      <section style={{ ...slab, overflow: "hidden" }}>
      {rows.length ? (
        <div style={{ overflowX: "auto" }}>
          <table data-hr-branch-table="1" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 640 }}>
            <thead>
              <tr style={{ background: "var(--nv-soft, #F6F8FA)" }}>
                {COLS.map((c) => (
                  <th key={c.id} scope="col" aria-sort={sort.key === c.id ? (sort.dir > 0 ? "ascending" : "descending") : "none"}
                    style={{ padding: 0, textAlign: c.num ? "center" : "start", fontWeight: 700, color: "var(--nv-ink2, var(--nv-muted))", whiteSpace: "nowrap" }}>
                    <button type="button" onClick={() => setSort((cur) => ({ key: c.id, dir: cur.key === c.id ? -cur.dir : 1 }))}
                      style={{ fontFamily: "inherit", fontSize: 11.5, fontWeight: 700, color: "inherit", background: "none", border: "none", cursor: "pointer", padding: "10px 14px", width: "100%", textAlign: "inherit" }}>
                      {ar ? c.ar : c.en}{sort.key === c.id ? (sort.dir > 0 ? " ▲" : " ▼") : ""}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const open = () => (canWrite ? setFocusId(row.id) : navigate("/app/org/chart?view=branches&lane=manage", { state: { from: "/app/hr?tab=branches" } }));
                const status = row.noManager
                  ? <span style={chip("warn")}>{ar ? "بلا مدير" : "No manager"}</span>
                  : (row.readiness?.top && row.readiness.level !== "ready"
                    ? <span style={chip(row.readiness.level === "blocked" ? "bad" : "warn")}>{ar ? "تنبيه" : "Alert"}</span>
                    : <span style={{ color: "var(--nv-muted)" }}>—</span>);
                const td = { padding: "10px 14px", borderTop: "1px solid var(--nv-line2, #EEF2F7)", whiteSpace: "nowrap" };
                return (
                  <tr key={row.id} data-hr-branch={row.id} className="nv-hr-row" tabIndex={0} onClick={open}
                    onKeyDown={(e) => { if (e.key === "Enter") open(); }} style={{ cursor: "pointer" }}
                    title={row.readiness?.top && row.readiness.level !== "ready" ? (ar ? row.readiness.top.ar : row.readiness.top.en) : undefined}>
                    <td style={{ ...td, fontWeight: 700, color: "var(--nv-ink)" }}>{row.name}</td>
                    <td style={{ ...td, color: row.city ? "var(--nv-ink)" : "var(--nv-muted)" }}>{row.city || (ar ? "بلا مدينة" : "No city")}</td>
                    <td style={{ ...td, color: row.managerName ? "var(--nv-ink)" : "var(--nv-muted)" }}>{row.managerName || "—"}</td>
                    <td style={{ ...td, textAlign: "center" }}><Num>{row.headcount || 0}</Num></td>
                    <td style={{ ...td, textAlign: "center" }}><Num>{row.seats || 0}</Num></td>
                    <td style={{ ...td, textAlign: "center" }}>{row.vacant ? <Num>{row.vacant}</Num> : <span style={{ color: "var(--nv-muted)" }}>—</span>}</td>
                    <td style={{ ...td, textAlign: "center" }}>{status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
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
