import React, { useEffect, useMemo, useState } from "react";
import { hrEmployeeFlags } from "@/lib/hrOverview";
import { isSaudiForNitaqat } from "@/lib/complianceDerivations";
import { useNavigate } from "react-router-dom";
import StationTransferPanel from "@/components/employees/StationTransferPanel";
import { toast } from "@/components/ui/use-toast";
import { collectEmployeeValidityDocs } from "@/lib/complianceDerivations";
import { employeeFileStatus } from "@/lib/employeeFileBoard";
import { readEmployeeNo } from "@/lib/employeeNumber";
import { profileCompletionStats } from "@/lib/employeeProfileFields";
import { addNotification } from "@/lib/store";
import { hrManagerForStation } from "@/lib/hrTree";
import { isCompanyRootStation, isHrUnit, isManagerUnit, stationParentId, stationSubtreeIds } from "@/lib/stationTree";
import { kpiActionStyle, meterStyles } from "@/lib/statusFlag";
import { chip, chipButton, mono } from "@/components/schedules/scheduleChrome";
import { btnGhost, btnPrimary, btnQuiet } from "@/components/hr/orgdesign/orgDesignUi";
import NvIcon from "@/components/shared/NvIcon";

const DASH = "—";
const SEARCH_AR = "يبحث في كل الفروع بالاسم أو الوظيفة أو الرقم الوظيفي أو اسم الفرع";

function initialsOf(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length || parts[0] === DASH) return DASH;
  return parts.slice(0, 2).map((part) => part.slice(0, 1)).join("") || DASH;
}

function hireIso(employee) {
  return String(employee?.profile?.hireDate || employee?.hireDate || employee?.startDate || "").slice(0, 10);
}

function isActing(employee) {
  const today = new Date().toISOString().slice(0, 10);
  return (employee?.actingAssignments || []).some((item) => {
    if (item?.endedAt) return false;
    const until = String(item.until || "").slice(0, 10);
    return !until || until >= today;
  });
}

function fileTone(employee, node) {
  if (!employee || node?.vacant) return "vac";
  if (node?.acting || isActing(employee)) return "act";
  if (node?.tone === "warn" || node?.tone === "block") return "warn";
  if (collectEmployeeValidityDocs(employee).length) return "warn";
  const status = employeeFileStatus(employee, true);
  if (status.kind === "warn" || status.kind === "bad") return "warn";
  return "ok";
}

function chainLine(node, byId, ar) {
  if (!node?.reportsTo) return DASH;
  const titles = [];
  let cursor = byId.get(String(node.reportsTo));
  const boss = !cursor
    ? DASH
    : cursor.vacant
      ? (ar ? "شاغرة" : "Vacant")
      : (cursor.name || DASH);
  let guard = 0;
  while (cursor && guard < 8) {
    const title = String(cursor.title || "").replace(/\s+—\s+.*$/, "").trim();
    if (title) titles.unshift(title);
    cursor = byId.get(String(cursor.reportsTo || ""));
    guard += 1;
  }
  const path = titles.slice(-2).join("، ");
  if (!path && boss === DASH) return DASH;
  return `${path || DASH} · ${ar ? "يتبع" : "reports to"} ${boss}`;
}

function highlight(text, query) {
  const value = String(text || "");
  const q = String(query || "").trim();
  if (!value) return [{ t: DASH, mark: false }];
  if (!q) return [{ t: value, mark: false }];
  const hay = value.toLocaleLowerCase("ar");
  const needle = q.toLocaleLowerCase("ar");
  const index = hay.indexOf(needle);
  if (index < 0) return [{ t: value, mark: false }];
  return [
    { t: value.slice(0, index), mark: false },
    { t: value.slice(index, index + q.length), mark: true },
    { t: value.slice(index + q.length), mark: false },
  ].filter((part) => part.t);
}

function Marked({ parts }) {
  return parts.map((part, index) => (
    part.mark
      ? <mark key={index} style={{ background: "var(--nv-warn-soft)", color: "var(--nv-ink)", borderRadius: 4, padding: "0 2px" }}>{part.t}</mark>
      : <span key={index}>{part.t}</span>
  ));
}

function CheckBox({ on, onClick, label }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      style={{
        width: 18,
        height: 18,
        borderRadius: 5,
        flex: "none",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        padding: 0,
        fontFamily: "inherit",
        background: on ? "var(--nv-navy)" : "var(--nv-card)",
        color: on ? "var(--nv-btn-ink, #fff)" : "transparent",
        border: on ? "1px solid var(--nv-navy)" : "1.5px solid var(--nv-mute-fill, var(--nv-line))",
      }}
    >
      {on ? <NvIcon name="check" size={12} strokeWidth={2.25} /> : ""}
    </button>
  );
}

/** Status chip — colour only for an alert (expiring documents / compliance); acting and vacant are facts. */
const STATUS = {
  ok: null,
  warn: { ar: "تنبيه", en: "Alert", tone: "warn" },
  act: { ar: "مكلَّف", en: "Acting", tone: "mute" },
  vac: { ar: "شاغرة", en: "Vacant", tone: "mute", dashed: true },
};

const FILTERS = [
  ["", "الكل", "All"],
  ["done", "ملف مكتمل", "Complete"],
  ["miss", "ملف ناقص", "Incomplete"],
  ["act", "مكلَّفون", "Acting"],
  ["warn", "تنبيه", "Alert"],
  ["vac", "الشواغر", "Vacant"],
];

// what needs a decision on a file — the same rules as «التنبيهات» rows that open this list (?filter=)
const FLAGS = [
  ["", "كل الملفات", "All files"],
  ["incomplete", "ملف ناقص على الموارد البشرية", "File gaps"],
  ["expiring", "وثيقة تنتهي", "Document expiring"],
  ["contract", "عقد يحتاج قراراً", "Contract due"],
  ["probation", "تجربة تنتهي", "Probation ending"],
  ["gosi", "بلا تأمينات", "No GOSI"],
  ["saudi", "سعودي", "Saudi"],
  ["expat", "وافد", "Expat"],
];
const FLAG_IDS = FLAGS.map((f) => f[0]).filter(Boolean);

const SORTS = [
  ["name", "الاسم", "Name"],
  ["hire", "الأقدم تعييناً", "Earliest hire"],
  ["pct", "الأقل اكتمالاً", "Least complete"],
];

/**
 * ملفات الموظفين — search, live branch chips, status, sort, and file rows.
 * Vacant seats stay out of «الكل» and appear only under الشواغر.
 */
export default function OrgEmployeeFilesBoard({
  data,
  nodes = [],
  ar = true,
  canWrite = false,
  companyId = "",
  actor = null,
  onHire,
  onManage,
  initialFlag = "",
  scopeIds = null,
}) {
  const navigate = useNavigate();
  const [flag, setFlag] = useState(FLAG_IDS.includes(initialFlag) ? initialFlag : "");
  useEffect(() => { if (FLAG_IDS.includes(initialFlag)) setFlag(initialFlag); }, [initialFlag]);
  const [query, setQuery] = useState("");
  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("name");
  const [transferId, setTransferId] = useState("");

  const byId = useMemo(() => new Map(nodes.map((node) => [String(node.id), node])), [nodes]);
  const stationById = useMemo(
    () => new Map((data?.stations || []).map((station) => [String(station.id), station])),
    [data?.stations],
  );

  const catalog = useMemo(() => {
    const nodeByEmployee = new Map();
    nodes.forEach((node) => {
      if (node.employeeId) nodeByEmployee.set(String(node.employeeId), node);
    });
    const people = (data?.employees || []).map((employee) => {
      const node = nodeByEmployee.get(String(employee.id)) || null;
      const stationId = String(employee.stationId || node?.stationId || "");
      const station = stationById.get(stationId);
      const completion = profileCompletionStats(employee);
      const tone = fileTone(employee, node);
      const title = String(node?.title || employee.profile?.position || employee.position || employee.jobTitle || employee.profile?.jobTitle || "").trim();
      const managerId = String(employee.profile?.directManagerId || "").trim();
      const follow = node?.reportsTo
        ? node
        : (managerId && nodeByEmployee.get(managerId)
          ? { reportsTo: nodeByEmployee.get(managerId).id }
          : null);
      return {
        key: String(employee.id),
        employee,
        vacant: false,
        tone,
        stationId,
        branch: station?.name || DASH,
        name: String(employee.name || "").trim() || DASH,
        title: title || DASH,
        no: readEmployeeNo(employee) || DASH,
        hire: hireIso(employee),
        pct: completion.pct,
        missing: completion.missing,
        done: completion.done,
        line: chainLine(follow, byId, ar),
      };
    });
    const seats = nodes.filter((node) => node.vacant).map((node) => {
      const station = stationById.get(String(node.stationId || ""));
      return {
        key: String(node.id),
        employee: null,
        node,
        vacant: true,
        tone: "vac",
        stationId: String(node.stationId || ""),
        branch: station?.name || DASH,
        name: String(node.title || "").trim() || DASH,
        title: ar ? "بانتظار التوظيف" : "Waiting to be filled",
        no: DASH,
        hire: "",
        pct: null,
        missing: [],
        done: true,
        line: chainLine(node, byId, ar),
      };
    });
    return [...people, ...seats];
  }, [data?.employees, nodes, stationById, byId, ar]);

  // branches in the structure's own order: the company, then each unit depth-first (regions before
  // branches, then by name), indented under its parent — a region counts everything beneath it
  const tiles = useMemo(() => {
    const occupied = catalog.filter((row) => !row.vacant);
    const own = new Map();
    occupied.forEach((row) => { if (row.stationId) own.set(row.stationId, (own.get(row.stationId) || 0) + 1); });
    const seen = new Set();
    catalog.forEach((row) => { if (row.stationId) seen.add(row.stationId); });
    const stations = (data?.stations || []).filter((st) => !st.closedAt || seen.has(String(st.id)));
    const kids = new Map();
    stations.forEach((st) => {
      const parent = stationParentId(st) || "";
      kids.set(parent, [...(kids.get(parent) || []), st]);
    });
    const ids = new Set(stations.map((st) => String(st.id)));
    const order = (list) => list.slice().sort((x, y) => {
      const rx = isCompanyRootStation(x) ? 0 : isHrUnit(x) ? 1 : isManagerUnit(x) ? 2 : 3;
      const ry = isCompanyRootStation(y) ? 0 : isHrUnit(y) ? 1 : isManagerUnit(y) ? 2 : 3;
      return rx - ry || String(x.name || "").localeCompare(String(y.name || ""), "ar");
    });
    const out = [];
    const walk = (st, depth) => {
      const id = String(st.id);
      const children = order(kids.get(id) || []);
      const start = out.length;
      out.push(null);
      const root = isCompanyRootStation(st);
      let sub = own.get(id) || 0;
      // the company's own units sit beside it at the top level, not under it
      children.forEach((child) => { sub += walk(child, root ? 0 : depth + 1); });
      if (sub > 0 || seen.has(id)) {
        out[start] = { id, name: st.name || DASH, depth, count: root ? (own.get(id) || 0) : sub, subtree: !root };
      }
      return sub;
    };
    const roots = order(stations.filter((st) => { const pid = stationParentId(st); return !pid || !ids.has(pid); }));
    roots.forEach((st) => walk(st, 0));
    const list = out.filter(Boolean);
    return [{ id: "", name: ar ? "كل الفروع" : "All branches", count: occupied.length, depth: 0 }, ...list];
  }, [catalog, data?.stations, ar]);
  const branchScope = useMemo(() => {
    if (!branchId) return null;
    const tile = tiles.find((t) => t.id === branchId);
    return new Set(tile?.subtree ? stationSubtreeIds(data?.stations || [], branchId).map(String) : [branchId]);
  }, [branchId, tiles, data?.stations]);

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("ar");
    const shown = catalog.filter((row) => {
      if (row.vacant && status !== "vac") return false;
      if (branchScope && !branchScope.has(String(row.stationId || ""))) return false;
      if (scopeIds && !scopeIds.includes(String(row.stationId || ""))) return false;
      if (flag) {
        if (row.vacant || !row.employee) return false;
        if (flag === "saudi" || flag === "expat") {
          if (isSaudiForNitaqat(row.employee) !== (flag === "saudi")) return false;
        } else {
          let f = {};
          try { f = hrEmployeeFlags(row.employee, { ar }) || {}; } catch { f = {}; }
          if (!f[flag]) return false;
        }
      }
      if (status === "miss") return !row.vacant && !row.done;
      if (status === "done") return !row.vacant && row.done;
      if (status && row.tone !== status) return false;
      if (!q) return true;
      const hay = [row.name, row.title, row.no, row.branch].join(" ").toLocaleLowerCase("ar");
      return hay.includes(q);
    });
    shown.sort((a, b) => {
      if (sort === "hire") {
        if (!a.hire && !b.hire) return 0;
        if (!a.hire) return 1;
        if (!b.hire) return -1;
        return a.hire.localeCompare(b.hire);
      }
      if (sort === "pct") {
        const ap = a.pct == null ? 101 : a.pct;
        const bp = b.pct == null ? 101 : b.pct;
        return ap - bp || String(a.name).localeCompare(String(b.name), "ar");
      }
      return String(a.name).localeCompare(String(b.name), "ar");
    });
    return shown;
  }, [catalog, query, branchScope, status, sort, flag, ar, scopeIds]);

  const incomplete = rows.filter((row) => !row.vacant && !row.done && row.employee);
  // Completing files is the branch HR officer's job: group the incomplete files by who holds HR for each branch.
  const hrFor = (row) => hrManagerForStation(data, row.stationId);
  const hrGroups = useMemo(() => {
    const map = new Map();
    incomplete.forEach((row) => {
      const hr = hrFor(row);
      const key = hr ? String(hr.id) : "";
      if (!map.has(key)) map.set(key, { hr, rows: [], branches: new Set() });
      const g = map.get(key);
      g.rows.push(row);
      if (row.branch && row.branch !== DASH) g.branches.add(row.branch);
    });
    return [...map.values()].sort((a, b) => (a.hr ? 0 : 1) - (b.hr ? 0 : 1) || b.rows.length - a.rows.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomplete.map((r) => r.key).join("|"), data]);
  const branchName = tiles.find((tile) => tile.id === branchId)?.name || (ar ? "كل الفروع" : "All branches");
  const countLabel = query.trim()
    ? (ar ? `${rows.length} نتيجة لـ «${query.trim()}» في ${branchName}` : `${rows.length} for “${query.trim()}” in ${branchName}`)
    : (ar ? `${rows.length} نتيجة` : `${rows.length} results`);
  const transferEmployee = catalog.find((row) => row.key === transferId)?.employee || null;



  // One request to the branch HR officer, naming each file and what it lacks.
  const sendToHr = (group) => {
    if (!group?.hr || !companyId) return;
    // A notification to the HR officer alone (not a message on her own employee file), linking to the list.
    const who = actor?.name || (ar ? "الموارد البشرية" : "HR");
    const where = [...group.branches].join("، ") || (ar ? "فرعك" : "your branch");
    const names = group.rows.slice(0, 3).map((row) => row.name).join("، ");
    addNotification(companyId, group.hr.id, ar
      ? `${who}: نرجو استكمال ${group.rows.length} ${group.rows.length === 1 ? "ملف" : group.rows.length <= 10 ? "ملفات" : "ملفاً"} في ${where} — منها ${names}${group.rows.length > 3 ? " وغيرهم" : ""}. افتح القائمة لترى ما ينقص كل ملف.`
      : `${who}: please complete ${group.rows.length} files in ${where}.`, { lane: "manage", to: "/app/hr?tab=people&filter=incomplete", key: `files-complete-${group.hr.id}-${new Date().toISOString().slice(0, 16)}` });
    toast({ description: ar ? `أُرسل إلى ${group.hr.name} طلب استكمال ${group.rows.length} ${group.rows.length <= 10 ? "ملفات" : "ملفاً"}.` : `Sent to ${group.hr.name}: ${group.rows.length} files.` });
  };
  const sendRowToHr = (row) => {
    const hr = hrFor(row);
    if (!hr) { toast({ description: ar ? "لا مسؤول موارد بشرية لهذا الفرع — يُكمَل الملف من «إدارة الملف»." : "No HR officer for this branch — complete it from Manage file." }); return; }
    sendToHr({ hr, rows: [row], branches: new Set([row.branch].filter((b) => b && b !== DASH)) });
  };

  const seg = (on) => chipButton(on, { height: 28 });
  const label = { fontSize: 11.5, fontWeight: 600, color: "var(--nv-muted)", marginInlineEnd: 4 };
  const hair = "1px solid var(--nv-line2, var(--nv-line))";

  return (
    <div data-org-files="1" style={{ flex: 1, minHeight: 0, overflow: "auto", background: "var(--nv-card)", display: "flex", flexDirection: "column" }}>
      <section style={{ flex: "none", padding: "12px 18px", borderBottom: hair, display: "flex", flexDirection: "column", gap: 10 }}>
        <input
          className="nv-od-input nv-org-files-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={ar ? SEARCH_AR : "Search every branch by name, job, employee number, or branch"}
          aria-label={ar ? SEARCH_AR : "Search employee files"}
          style={{ width: "100%", maxWidth: 520 }}
        />
        <div style={{ display: "flex", gap: "8px 18px", flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={label}>{ar ? "المتابعة" : "Follow-up"}</span>
          <select className="nv-od-select" value={flag} onChange={(e) => setFlag(e.target.value)} data-files-flag="1" style={{ minWidth: 220, height: 36 }}>
            {FLAGS.map(([id, a, e]) => <option key={id || "all"} value={id}>{ar ? a : e}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={label}>{ar ? "الفرع" : "Branch"}</span>
          <select
            className="nv-od-select"
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
            aria-label={ar ? "الفرع" : "Branch"}
            data-files-branch="1"
            style={{ minWidth: 260, maxWidth: 420, height: 36 }}
          >
            {tiles.map((tile) => (
              <option key={tile.id || "all"} value={tile.id}>
                {`${"\u00A0\u00A0\u00A0".repeat(tile.depth || 0)}${tile.depth ? "↳ " : ""}${tile.name} (${tile.count})`}
              </option>
            ))}
          </select>
        </label>
        </div>
        <div style={{ display: "flex", gap: "8px 18px", flexWrap: "wrap", alignItems: "center" }}>
          <div role="group" aria-label={ar ? "الحالة" : "Status"} style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={label}>{ar ? "الحالة" : "Status"}</span>
            {FILTERS.map(([id, labelAr, labelEn]) => (
              <button key={id || "all"} type="button" aria-pressed={status === id} onClick={() => setStatus(id)} style={seg(status === id)}>
                {ar ? labelAr : labelEn}
              </button>
            ))}
          </div>
          <div role="group" aria-label={ar ? "الترتيب" : "Sort"} style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginInlineStart: "auto" }}>
            <span style={label}>{ar ? "الترتيب" : "Sort"}</span>
            {SORTS.map(([id, labelAr, labelEn]) => (
              <button key={id} type="button" aria-pressed={sort === id} onClick={() => setSort(id)} style={seg(sort === id)}>
                {ar ? labelAr : labelEn}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section style={{ flex: "none" }}>
        <header style={{ padding: "10px 18px", borderBottom: hair, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <strong style={{ fontSize: 13, color: "var(--nv-ink)" }}>{ar ? "ملفات الموظفين" : "Employee files"}</strong>
          <span style={{ fontSize: 11.5, color: "var(--nv-muted)" }}>{countLabel}</span>
          <span style={{ flex: 1 }} />
          {canWrite ? (
            <button type="button" onClick={() => onHire?.({})} style={btnPrimary()}>
              {ar ? "+ ملف موظف جديد" : "+ New employee file"}
            </button>
          ) : null}
        </header>
        {/* Who has not completed the file — named, with what is missing; one press asks them all. */}
        {incomplete.length ? (
          <div data-files-incomplete="1" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 18px", background: "var(--nv-warn-soft, #FBF3E2)", borderBottom: hair }}>
            <strong style={{ fontSize: 12.5, color: "var(--nv-warn-ink, #7A5A12)" }}>
              {ar ? `${incomplete.length} ${incomplete.length === 1 ? "ملف لم يكتمل" : incomplete.length <= 10 ? "ملفات لم تكتمل" : "ملفاً لم يكتمل"}` : `${incomplete.length} incomplete`}
            </strong>
            <span style={{ fontSize: 11.5, color: "var(--nv-ink2)", flex: "1 1 220px", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={incomplete.map((row) => row.name).join("، ")}>
              {incomplete.slice(0, 4).map((row) => row.name).join("، ")}{incomplete.length > 4 ? (ar ? ` و${incomplete.length - 4} غيرهم` : ` and ${incomplete.length - 4} more`) : ""}
            </span>
            {flag !== "incomplete" ? (
              <button type="button" onClick={() => setFlag("incomplete")} style={btnQuiet()}>
                {ar ? "اعرضهم فقط" : "Show only them"}
              </button>
            ) : (
              <button type="button" onClick={() => setFlag("")} style={btnQuiet()}>
                {ar ? "اعرض الجميع" : "Show everyone"}
              </button>
            )}
            {canWrite || scopeIds ? (
              <div data-files-hr-groups="1" style={{ flexBasis: "100%", display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                {hrGroups.map((g) => (
                  <div key={g.hr ? g.hr.id : "none"} data-hr-group={g.hr ? g.hr.id : "none"} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "6px 10px", borderRadius: 8, background: "var(--nv-card, #fff)", border: hair }}>
                    <span style={{ flex: "1 1 260px", minWidth: 0, fontSize: 12.5, color: "var(--nv-ink)", lineHeight: 1.6 }}>
                      {g.hr
                        ? (ar ? <><b>{g.hr.name}</b> — موارد {[...g.branches].join("، ") || "الفرع"}: <b dir="ltr" style={mono}>{g.rows.length}</b> {g.rows.length <= 10 ? "ملفات ناقصة" : "ملفاً ناقصاً"}</> : <><b>{g.hr.name}</b> — {g.rows.length} incomplete</>)
                        : (ar ? <><b>بلا مسؤول موارد للفرع</b> ({[...g.branches].join("، ") || "—"}): <b dir="ltr" style={mono}>{g.rows.length}</b> — يكملها فريق الموارد في المقر بزر «أكمل الملف»، أو عيّن مسؤول موارد للفرع</> : <><b>No branch HR officer</b>: {g.rows.length}</>)}
                    </span>
                    {g.hr && String(g.hr.id) === String(actor?.id || "") ? (
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--nv-ink)" }}>{ar ? "هذه ملفاتك — أكملها من «أكمل الملف»" : "These are yours to complete"}</span>
                    ) : g.hr ? (
                      <button type="button" onClick={() => sendToHr(g)} style={btnGhost({ height: 28 })}>
                        {ar ? `أرسل إلى ${String(g.hr.name).split(" ")[0]}` : `Send to ${g.hr.name}`}
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {rows.length ? rows.map((row) => {
          const st = STATUS[row.tone] || null;
          const meter = meterStyles(row.pct || 0);
          const gaps = row.missing.map((field) => (ar ? field.ar : field.en)).filter(Boolean).join(" · ");
          return (
            <div key={row.key} data-org-file-row="1" style={{ display: "flex", flexWrap: "wrap", gap: "8px 14px", alignItems: "center", padding: "10px 18px", borderBottom: hair }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: "1 1 240px" }}>
                <span style={{ width: 32, height: 32, borderRadius: "50%", flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 600, ...(row.vacant ? { border: "1.5px dashed var(--nv-mute-fill, var(--nv-line))", color: "var(--nv-muted)", background: "transparent" } : { border: "1px solid var(--nv-line)", background: "var(--nv-soft)", color: "var(--nv-ink2)" }) }}>
                  {row.vacant ? "＋" : initialsOf(row.name)}
                </span>
                <span style={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1.45 }}>
                  <strong title={row.name} style={{ fontSize: 13, color: "var(--nv-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    <Marked parts={highlight(row.name, query)} />
                  </strong>
                  <span style={{ fontSize: 11.5, color: "var(--nv-ink2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    <Marked parts={highlight(row.title, query)} />
                    {" · "}
                    <span dir="ltr" style={{ ...mono, unicodeBidi: "isolate", color: "var(--nv-muted)" }}>{row.no}</span>
                  </span>
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1.45, flex: "1 1 180px" }}>
                <span title={row.branch} style={{ fontSize: 12.5, fontWeight: 600, color: "var(--nv-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  <Marked parts={highlight(row.branch, query)} />
                </span>
                <span style={{ fontSize: 11, color: "var(--nv-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={row.line}>{row.line}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 96, width: 120 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 10.5, color: "var(--nv-muted)" }}>
                  <span>{ar ? "اكتمال الملف" : "Completeness"}</span>
                  <span dir="ltr" style={{ ...mono, color: "var(--nv-ink)" }}>{row.pct == null ? DASH : `${row.pct}%`}</span>
                </div>
                {row.pct == null ? null : <span style={meter.track}><span style={meter.fill} /></span>}
              </div>
              {!row.vacant && !row.done && gaps ? (
                <div data-file-gaps="1" style={{ flexBasis: "100%", order: 9, fontSize: 11.5, color: "var(--nv-warn-ink, #7A5A12)", lineHeight: 1.6, paddingInlineStart: 42 }}>
                  {ar ? "ينقصه: " : "Missing: "}{gaps}
                </div>
              ) : null}
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginInlineStart: "auto" }}>
                {st ? <span style={chip(st.tone, st.dashed ? { borderStyle: "dashed" } : {})}>{ar ? st.ar : st.en}</span> : null}
                {canWrite && !row.vacant ? (
                  <button type="button" onClick={() => setTransferId(row.key)} style={btnQuiet()}>
                    {ar ? "نقل" : "Transfer"}
                  </button>
                ) : null}
                {(canWrite || (scopeIds && !row.done)) && !row.vacant ? (
                  <button type="button" onClick={() => (canWrite ? onManage?.(row.employee) : navigate(`/app/employees/${encodeURIComponent(row.employee.id)}?tab=identity&complete=1`))} style={btnGhost({ height: 28, padding: "0 11px" })}>
                    {row.done ? (ar ? "إدارة الملف" : "Manage file") : (ar ? "أكمل الملف" : "Complete file")}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    if (row.vacant) {
                      onHire?.({ stationId: row.stationId, seatId: row.node?.seatId || "" });
                      return;
                    }
                    navigate(`/app/employees/${encodeURIComponent(row.employee.id)}`);
                  }}
                  style={{ ...kpiActionStyle, marginTop: 0, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}
                >
                  {row.vacant ? (ar ? "وظّف عليه ‹" : "Hire ›") : (ar ? "افتح الملف ‹" : "Open file ›")}
                </button>
              </div>
            </div>
          );
        }) : (
          <div style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--nv-muted)" }}>
            {ar ? "لا موظف مطابق في هذا الفلتر." : "No one matches this filter."}
          </div>
        )}
      </section>

      {transferEmployee ? (
        <div
          role="presentation"
          onClick={() => setTransferId("")}
          style={{ position: "fixed", inset: 0, zIndex: 80, background: "color-mix(in oklab, var(--nv-navy) 26%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div role="dialog" aria-label={ar ? "نقل" : "Transfer"} onClick={(event) => event.stopPropagation()} style={{ width: "min(560px, 100%)", maxHeight: "90vh", overflow: "auto" }}>
            <StationTransferPanel
              employee={transferEmployee}
              stations={data?.stations || []}
              companyId={companyId}
              actor={actor}
              ar={ar}
              startOpen
              onDone={() => setTransferId("")}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
