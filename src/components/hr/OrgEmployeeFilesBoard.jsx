import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import StationTransferPanel from "@/components/employees/StationTransferPanel";
import { toast } from "@/components/ui/use-toast";
import { collectEmployeeValidityDocs } from "@/lib/complianceDerivations";
import { employeeFileStatus } from "@/lib/employeeFileBoard";
import { readEmployeeNo } from "@/lib/employeeNumber";
import { profileCompletionStats } from "@/lib/employeeProfileFields";
import { addHRMessage } from "@/lib/store";
import { isCompanyRootStation, isHrUnit } from "@/lib/stationTree";

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
      ? <mark key={index} style={{ background: "#FBF3E1", color: "#8A5A12", borderRadius: 3, padding: "0 2px" }}>{part.t}</mark>
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
        background: on ? "#0B3D27" : "var(--nv-card, #fff)",
        color: on ? "#fff" : "transparent",
        border: on ? "1px solid #0B3D27" : "1.5px solid #C5CEC9",
      }}
    >
      {on ? "✓" : ""}
    </button>
  );
}

const STATUS = {
  ok: { ar: "على رأس العمل", en: "On the job", color: "#2F6B43", bg: "#E6F2EA" },
  warn: { ar: "تنبيه", en: "Alert", color: "#9B2335", bg: "#FBEBED" },
  act: { ar: "مكلَّف", en: "Acting", color: "#8A5A12", bg: "#FBF3E1" },
  vac: { ar: "شاغرة", en: "Vacant", color: "#8A5A12", bg: "#FBF3E1" },
};

const FILTERS = [
  ["", "الكل", "All"],
  ["miss", "ملف ناقص", "Incomplete"],
  ["act", "مكلَّفون", "Acting"],
  ["warn", "تنبيه", "Alert"],
  ["vac", "الشواغر", "Vacant"],
];

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
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("name");
  const [selected, setSelected] = useState(() => new Set());
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

  const tiles = useMemo(() => {
    const occupied = catalog.filter((row) => !row.vacant);
    const counts = new Map();
    occupied.forEach((row) => {
      if (!row.stationId) return;
      counts.set(row.stationId, (counts.get(row.stationId) || 0) + 1);
    });
    const seen = new Set();
    catalog.forEach((row) => { if (row.stationId) seen.add(row.stationId); });
    const rows = [...seen].map((id) => {
      const station = stationById.get(id);
      return {
        id,
        name: station?.name || DASH,
        count: counts.get(id) || 0,
        rank: isCompanyRootStation(station) ? 0 : isHrUnit(station) ? 1 : 2,
      };
    });
    rows.sort((a, b) => a.rank - b.rank || String(a.name).localeCompare(String(b.name), "ar"));
    return [{ id: "", name: ar ? "كل الفروع" : "All branches", count: occupied.length }, ...rows];
  }, [catalog, stationById, ar]);

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("ar");
    const shown = catalog.filter((row) => {
      if (row.vacant && status !== "vac") return false;
      if (branchId && row.stationId !== branchId) return false;
      if (status === "miss") return !row.vacant && !row.done;
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
  }, [catalog, query, branchId, status, sort]);

  const selectable = rows.filter((row) => !row.vacant);
  const allOn = selectable.length > 0 && selectable.every((row) => selected.has(row.key));
  const branchName = tiles.find((tile) => tile.id === branchId)?.name || (ar ? "كل الفروع" : "All branches");
  const countLabel = query.trim()
    ? (ar ? `${rows.length} نتيجة لـ «${query.trim()}» في ${branchName}` : `${rows.length} for “${query.trim()}” in ${branchName}`)
    : (ar ? `${rows.length} نتيجة` : `${rows.length} results`);
  const transferEmployee = catalog.find((row) => row.key === transferId)?.employee || null;

  const askCompletion = (row) => {
    if (!row?.employee || row.done || !companyId) return;
    const gaps = row.missing.map((field) => (ar ? field.ar : field.en)).filter(Boolean);
    const text = ar
      ? `طلب استكمال الملف: ${gaps.join("، ") || DASH}`
      : `Complete the file: ${gaps.join(", ") || DASH}`;
    addHRMessage(companyId, row.employee.id, {
      from: "hr",
      targetId: row.employee.id,
      targetName: row.employee.name,
      text,
      senderName: actor?.name || (ar ? "الموارد البشرية" : "HR"),
      channel: "company",
    });
    toast({ description: ar ? `أُرسل طلب الاستكمال إلى ${row.name}.` : `Completion request sent to ${row.name}.` });
  };

  const askSelected = () => {
    const targets = selectable.filter((row) => selected.has(row.key) && !row.done);
    if (!targets.length) {
      toast({ description: ar ? "لا نواقص في الملفات المحددة." : "The selected files have nothing missing." });
      return;
    }
    targets.forEach(askCompletion);
  };

  const toggle = (key) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const seg = (on) => ({
    display: "inline-flex",
    alignItems: "center",
    height: 30,
    padding: "0 12px",
    borderRadius: 8,
    border: 0,
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 12,
    whiteSpace: "nowrap",
    fontWeight: on ? 700 : 500,
    background: on ? "var(--nv-card, #fff)" : "transparent",
    color: on ? "var(--nv-files-on, #0B3D27)" : "var(--nv-ink2, #3A4048)",
    boxShadow: on ? "0 1px 3px rgba(12,20,16,.12)" : "none",
  });

  const ghostBtn = {
    display: "inline-flex",
    alignItems: "center",
    height: 30,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid var(--nv-line, #D5DCD8)",
    background: "var(--nv-card, #fff)",
    color: "var(--nv-ink, #111418)",
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  };

  return (
    <div data-org-files="1" style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 12, background: "var(--nv-org-canvas, var(--nv-page, #F7F9F8))", display: "flex", flexDirection: "column", gap: 12 }}>
      <section style={{ flex: "none", background: "var(--nv-card, #fff)", border: "1px solid var(--nv-line, #E4E9E6)", borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        <input
          className="nv-org-files-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={ar ? SEARCH_AR : "Search every branch by name, job, employee number, or branch"}
          aria-label={ar ? SEARCH_AR : "Search employee files"}
          style={{ width: "100%", border: 0, outline: "none", background: "transparent", fontSize: 12.5, color: "var(--nv-ink, #111418)", fontFamily: "inherit", padding: "2px 0", textAlign: "start" }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 10, borderTop: "1px solid var(--nv-line2, #EEF1EF)" }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--nv-ink2, #3A4048)" }}>{ar ? "الفرع" : "Branch"}</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
            {tiles.map((tile) => {
              const on = branchId === tile.id;
              return (
                <button
                  key={tile.id || "all"}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setBranchId(tile.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    height: 40,
                    padding: "0 12px",
                    borderRadius: 10,
                    cursor: "pointer",
                    boxSizing: "border-box",
                    minWidth: 0,
                    fontFamily: "inherit",
                    fontWeight: on ? 700 : 500,
                    background: on ? "#0B3D27" : "var(--nv-card, #fff)",
                    color: on ? "#fff" : "var(--nv-ink, #111418)",
                    border: `1px solid ${on ? "#0B3D27" : "var(--nv-line, #E4E9E6)"}`,
                  }}
                >
                  <span style={{ fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tile.name}</span>
                  <span style={{ flex: "none", minWidth: 24, height: 22, padding: "0 7px", borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", font: "600 11px 'IBM Plex Mono', monospace", background: on ? "rgba(255,255,255,.18)" : "#E6F2EA", color: on ? "#fff" : "#2F6B43" }}>{tile.count}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px 16px", flexWrap: "wrap", alignItems: "flex-end", paddingTop: 10, borderTop: "1px solid var(--nv-line2, #EEF1EF)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--nv-ink2, #3A4048)" }}>{ar ? "الحالة" : "Status"}</span>
            <div style={{ display: "inline-flex", gap: 2, padding: 3, borderRadius: 10, background: "var(--nv-soft, #F2F5F3)", border: "1px solid var(--nv-line, #E4E9E6)", flexWrap: "wrap" }}>
              {FILTERS.map(([id, labelAr, labelEn]) => (
                <button key={id || "all"} type="button" aria-pressed={status === id} onClick={() => setStatus(id)} style={seg(status === id)}>
                  {ar ? labelAr : labelEn}
                </button>
              ))}
            </div>
          </div>
          <span style={{ flex: 1 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--nv-ink2, #3A4048)" }}>{ar ? "الترتيب" : "Sort"}</span>
            <div style={{ display: "inline-flex", gap: 2, padding: 3, borderRadius: 10, background: "var(--nv-soft, #F2F5F3)", border: "1px solid var(--nv-line, #E4E9E6)", flexWrap: "wrap" }}>
              {SORTS.map(([id, labelAr, labelEn]) => (
                <button key={id} type="button" aria-pressed={sort === id} onClick={() => setSort(id)} style={seg(sort === id)}>
                  {ar ? labelAr : labelEn}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section style={{ flex: "none", background: "var(--nv-card, #fff)", border: "1px solid var(--nv-line, #E4E9E6)", borderRadius: 14, overflow: "hidden" }}>
        <header style={{ padding: "10px 16px", borderBottom: "1px solid var(--nv-line2, #EEF1EF)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <CheckBox
            on={allOn}
            label={ar ? "تحديد الكل" : "Select all"}
            onClick={() => setSelected(allOn ? new Set() : new Set(selectable.map((row) => row.key)))}
          />
          <strong style={{ fontSize: 14, color: "var(--nv-ink, #111418)" }}>{ar ? "ملفات الموظفين" : "Employee files"}</strong>
          <span style={{ fontSize: 11.5, color: "var(--nv-ink3, #555C66)" }}>{countLabel}</span>
          <span style={{ flex: 1 }} />
          {canWrite ? (
            <button
              type="button"
              onClick={() => onHire?.({})}
              style={{ display: "inline-flex", alignItems: "center", height: 34, padding: "0 14px", borderRadius: 9, background: "#0B3D27", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", border: 0, fontFamily: "inherit", whiteSpace: "nowrap" }}
            >
              {ar ? "+ ملف موظف جديد" : "+ New employee file"}
            </button>
          ) : null}
        </header>
        {selected.size ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "8px 16px", background: "var(--nv-hover, #F6FAF7)", borderBottom: "1px solid var(--nv-line2, #EEF1EF)" }}>
            <strong style={{ fontSize: 12.5, color: "#0B3D27" }}>{ar ? `${selected.size} محدد` : `${selected.size} selected`}</strong>
            <button type="button" onClick={askSelected} style={{ ...ghostBtn, border: "1px solid #EDC5CB", background: "#FBEBED", color: "#9B2335", fontWeight: 600 }}>
              {ar ? "طلب استكمال للمحدَّد" : "Request completion"}
            </button>
            <button type="button" onClick={() => setSelected(new Set())} style={{ ...ghostBtn, border: 0, background: "transparent", color: "var(--nv-ink3, #555C66)" }}>
              {ar ? "إلغاء التحديد" : "Clear"}
            </button>
          </div>
        ) : null}
        {rows.length ? rows.map((row) => {
          const st = STATUS[row.tone] || STATUS.ok;
          const bar = row.pct == null ? "transparent" : row.pct === 100 ? "#3C7D50" : row.pct >= 80 ? "#C8A45A" : "#9B2335";
          const gaps = row.missing.map((field) => (ar ? field.ar : field.en)).filter(Boolean).join(" · ");
          return (
            <div key={row.key} data-org-file-row="1" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.35fr) minmax(0,1.05fr) max-content max-content minmax(96px,120px)", gap: "8px 12px", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid var(--nv-files-hair, #F2F5F3)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                {row.vacant ? <span style={{ width: 18, flex: "none" }} /> : (
                  <CheckBox on={selected.has(row.key)} label={row.name} onClick={() => toggle(row.key)} />
                )}
                <span style={{ width: 34, height: 34, borderRadius: "50%", flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, ...(row.vacant ? { border: "1.5px dashed #D9C08A", color: "#B7791F", background: "transparent" } : { background: "#E6F2EA", color: "#0B3D27" }) }}>
                  {row.vacant ? "＋" : initialsOf(row.name)}
                </span>
                <span style={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1.4 }}>
                  <strong title={row.name} style={{ fontSize: 13, color: "var(--nv-ink, #111418)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    <Marked parts={highlight(row.name, query)} />
                  </strong>
                  <span style={{ fontSize: 11, color: "var(--nv-ink3, #555C66)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    <Marked parts={highlight(row.title, query)} />
                    {" · "}
                    <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", unicodeBidi: "isolate" }}>{row.no}</span>
                  </span>
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1.4 }}>
                <span title={row.branch} style={{ fontSize: 12.5, fontWeight: 600, color: "var(--nv-ink, #111418)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  <Marked parts={highlight(row.branch, query)} />
                </span>
                <span style={{ fontSize: 10.5, color: "var(--nv-ink3, #555C66)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={row.line}>{row.line}</span>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "nowrap" }}>
                {canWrite && !row.vacant ? (
                  <button type="button" onClick={() => onManage?.(row.employee)} style={{ ...ghostBtn, background: "#0B3D27", color: "#fff", borderColor: "#0B3D27", fontWeight: 700 }}>
                    {ar ? "إدارة الملف" : "Manage file"}
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
                  style={ghostBtn}
                >
                  {ar ? "فتح الملف" : "Open file"}
                </button>
                {canWrite && !row.vacant ? (
                  <button type="button" onClick={() => setTransferId(row.key)} style={{ ...ghostBtn, padding: "0 10px" }}>
                    {ar ? "نقل" : "Transfer"}
                  </button>
                ) : null}
                {canWrite && !row.vacant && !row.done ? (
                  <button type="button" title={gaps || DASH} onClick={() => askCompletion(row)} style={{ ...ghostBtn, padding: "0 10px", border: "1px solid #EDC5CB", background: "#FBEBED", color: "#9B2335", fontWeight: 600 }}>
                    {ar ? "طلب استكمال" : "Request completion"}
                  </button>
                ) : null}
              </div>
              <span style={{ justifySelf: "start", fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap", color: st.color, background: st.bg }}>{ar ? st.ar : st.en}</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 10.5, color: "var(--nv-ink3, #555C66)" }}>
                  <span>{ar ? "اكتمال الملف" : "File completeness"}</span>
                  <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{row.pct == null ? DASH : `${row.pct}%`}</span>
                </div>
                <div style={{ height: 5, borderRadius: 999, background: "var(--nv-files-hair, #EEF1EF)", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 999, width: `${row.pct || 0}%`, background: bar }} />
                </div>
              </div>
            </div>
          );
        }) : (
          <div style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--nv-ink3, #555C66)" }}>
            {ar ? "لا موظف مطابق في هذا الفلتر." : "No one matches this filter."}
          </div>
        )}
      </section>

      {transferEmployee ? (
        <div
          role="presentation"
          onClick={() => setTransferId("")}
          style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(12,20,16,.28)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div role="dialog" aria-label={ar ? "نقل" : "Transfer"} onClick={(event) => event.stopPropagation()} style={{ width: "min(560px, 100%)", maxHeight: "90vh", overflow: "auto" }}>
            <StationTransferPanel
              employee={transferEmployee}
              stations={data?.stations || []}
              companyId={companyId}
              actor={actor}
              ar={ar}
              onDone={() => setTransferId("")}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
