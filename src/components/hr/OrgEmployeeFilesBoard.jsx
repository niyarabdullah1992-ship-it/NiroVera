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
import { kpiActionStyle, meterStyles } from "@/lib/statusFlag";
import { chip, chipButton, mono } from "@/components/schedules/scheduleChrome";
import { btnGhost, btnPrimary, btnQuiet } from "@/components/hr/orgdesign/orgDesignUi";

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
      {on ? "✓" : ""}
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
        <div role="group" aria-label={ar ? "الفرع" : "Branch"} style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={label}>{ar ? "الفرع" : "Branch"}</span>
          {tiles.map((tile) => {
            const on = branchId === tile.id;
            return (
              <button key={tile.id || "all"} type="button" aria-pressed={on} onClick={() => setBranchId(tile.id)} style={chipButton(on, { maxWidth: 220 })}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{tile.name}</span>
                <span dir="ltr" style={{ ...mono, fontSize: 10.5, opacity: 0.8 }}>{tile.count}</span>
              </button>
            );
          })}
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
          <CheckBox
            on={allOn}
            label={ar ? "تحديد الكل" : "Select all"}
            onClick={() => setSelected(allOn ? new Set() : new Set(selectable.map((row) => row.key)))}
          />
          <strong style={{ fontSize: 13, color: "var(--nv-ink)" }}>{ar ? "ملفات الموظفين" : "Employee files"}</strong>
          <span style={{ fontSize: 11.5, color: "var(--nv-muted)" }}>{countLabel}</span>
          <span style={{ flex: 1 }} />
          {canWrite ? (
            <button type="button" onClick={() => onHire?.({})} style={btnPrimary()}>
              {ar ? "+ ملف موظف جديد" : "+ New employee file"}
            </button>
          ) : null}
        </header>
        {selected.size ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 18px", background: "var(--nv-soft)", borderBottom: hair }}>
            <strong style={{ fontSize: 12.5, color: "var(--nv-ink)" }}>{ar ? `${selected.size} محدد` : `${selected.size} selected`}</strong>
            <button type="button" onClick={askSelected} style={btnGhost({ height: 28 })}>
              {ar ? "طلب استكمال للمحدَّد" : "Request completion"}
            </button>
            <button type="button" onClick={() => setSelected(new Set())} style={btnQuiet()}>
              {ar ? "إلغاء التحديد" : "Clear"}
            </button>
          </div>
        ) : null}
        {rows.length ? rows.map((row) => {
          const st = STATUS[row.tone] || null;
          const meter = meterStyles(row.pct || 0);
          const gaps = row.missing.map((field) => (ar ? field.ar : field.en)).filter(Boolean).join(" · ");
          return (
            <div key={row.key} data-org-file-row="1" style={{ display: "flex", flexWrap: "wrap", gap: "8px 14px", alignItems: "center", padding: "10px 18px", borderBottom: hair }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: "1 1 240px" }}>
                {row.vacant ? <span style={{ width: 18, flex: "none" }} /> : (
                  <CheckBox on={selected.has(row.key)} label={row.name} onClick={() => toggle(row.key)} />
                )}
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
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginInlineStart: "auto" }}>
                {st ? <span style={chip(st.tone, st.dashed ? { borderStyle: "dashed" } : {})}>{ar ? st.ar : st.en}</span> : null}
                {canWrite && !row.vacant && !row.done ? (
                  <button type="button" title={gaps || DASH} onClick={() => askCompletion(row)} style={btnQuiet()}>
                    {ar ? "طلب استكمال" : "Request completion"}
                  </button>
                ) : null}
                {canWrite && !row.vacant ? (
                  <button type="button" onClick={() => setTransferId(row.key)} style={btnQuiet()}>
                    {ar ? "نقل" : "Transfer"}
                  </button>
                ) : null}
                {canWrite && !row.vacant ? (
                  <button type="button" onClick={() => onManage?.(row.employee)} style={btnGhost({ height: 28, padding: "0 11px" })}>
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
