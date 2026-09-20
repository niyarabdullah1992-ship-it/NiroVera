import React from "react";
import { countAr, teamLabel, textOf } from "@/lib/perfRange";
import { PERF_BODY, PERF_GREEN, PERF_INK, PERF_LINE, PERF_MUTED, PERF_NAVY, PERF_SOFT, PERF_SURFACE, PERF_WHITE, perfBtn } from "@/components/performance/PerformanceSectionFrame";

const mono = { fontFamily: "'IBM Plex Mono', monospace" };

function Chip({ label, on, onClick, x }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={x ? (on ? undefined : undefined) : undefined}
      style={{
        fontFamily: "inherit",
        fontSize: 11,
        fontWeight: 600,
        padding: "5px 10px",
        border: `1px solid ${on ? PERF_NAVY : PERF_LINE}`,
        background: on ? PERF_NAVY : (x ? PERF_WHITE : "#f5f6f8"),
        color: on ? "#fff" : PERF_BODY,
        cursor: "pointer",
        whiteSpace: "nowrap",
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        borderRadius: 999,
      }}
    >
      {label}
      {x ? <span style={{ fontSize: 12, lineHeight: 1, opacity: 0.75 }}>×</span> : null}
    </button>
  );
}

export default function PerfScopePicker({
  ar,
  view,
  pickerOpen,
  pickQ,
  openB,
  selB,
  selT,
  selP,
  onTogglePicker,
  onToggleBranch,
  onToggleTeam,
  onTogglePerson,
  onToggleOpen,
  onPickAll,
  onClear,
  onQuery,
  onReport,
}) {
  const anyPick = view.anyPick;
  const chips = anyPick
    ? [
      ...selB.map((id) => {
        const branch = view.branches.find((row) => row.id === id);
        return { key: `b-${id}`, label: branch?.name || id, run: () => onToggleBranch(id), on: true, x: true };
      }),
      ...selT.map((id) => ({ key: `t-${id}`, label: `${ar ? "فريق" : "Team"} ${teamLabel(id, ar)}`, run: () => onToggleTeam(id), on: true, x: true })),
      ...selP.map((id) => {
        const person = view.people.find((row) => row.id === id);
        return { key: `p-${id}`, label: person?.name || id, run: () => onTogglePerson(id), on: false, x: true };
      }),
    ]
    : [{ key: "all", label: ar ? `كل الفروع · ${countAr(view.people.length, "موظف واحد", "موظفان", "موظفين", "موظفاً")}` : `All branches · ${view.people.length}`, run: onTogglePicker, on: false, x: false }];

  const q = String(pickQ || "").trim();
  const hit = view.people.filter((person) => !q || `${person.name} ${person.job} ${person.branch}`.includes(q));
  const byBranch = new Map();
  hit.forEach((person) => {
    const list = byBranch.get(person.branchId) || [];
    list.push(person);
    byBranch.set(person.branchId, list);
  });

  return (
    <section style={{ background: PERF_WHITE, border: `1px solid ${PERF_LINE}`, borderTop: "none", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
      <div style={{ padding: "11px 20px", display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto auto", gap: 12, alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{ar ? "النطاق" : "Scope"}</span>
        <span style={{ display: "flex", gap: 5, flexWrap: "wrap", minWidth: 0 }}>
          {chips.map((chip) => (
            <Chip key={chip.key} label={chip.label} on={chip.on} x={chip.x} onClick={chip.run} />
          ))}
        </span>
        <button type="button" onClick={onTogglePicker} style={perfBtn(pickerOpen)}>
          {pickerOpen ? (ar ? "أغلق المنتقي" : "Close picker") : (anyPick ? (ar ? "عدّل النطاق" : "Edit scope") : (ar ? "اختر نطاقاً" : "Choose a scope"))}
        </button>
        <button type="button" onClick={onReport} title={ar ? "تقرير A4 بكل المقارنات — يُحفظ PDF" : "A4 report of every comparison — save as PDF"} style={perfBtn(false, true)}>
          {ar ? "نزّل تقرير المقارنات" : "Download comparison report"}
        </button>
      </div>

      {pickerOpen ? (
        <div style={{ borderTop: `1px solid ${PERF_SOFT}`, background: PERF_SURFACE, padding: "13px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "center" }}>
            <input
              value={pickQ}
              onChange={(event) => onQuery(event.target.value)}
              className="nv-perf-search"
              placeholder={ar ? "ابحث بالاسم أو الوظيفة أو الفرع — يفرد المطابق تلقائياً" : "Search name, job, or branch"}
              style={{ fontFamily: "inherit", fontSize: 12, padding: "9px 11px", border: `1px solid ${PERF_LINE}`, background: PERF_WHITE, color: PERF_INK, outline: "none", width: "100%", boxSizing: "border-box", borderRadius: 10 }}
            />
            <button type="button" onClick={onClear} style={perfBtn()}>
              {anyPick ? (ar ? "امسح الاختيار" : "Clear") : (ar ? "الجميع" : "Everyone")}
            </button>
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: PERF_MUTED }}>{ar ? "فِرق" : "Teams"}</span>
            {["supervision", "field", "customers"].map((id) => {
              const on = selT.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onToggleTeam(id)}
                  style={{
                    fontFamily: "inherit",
                    fontSize: 11,
                    fontWeight: on ? 700 : 400,
                    padding: "6px 11px",
                    border: `1px solid ${on ? PERF_NAVY : PERF_LINE}`,
                    background: on ? PERF_NAVY : PERF_WHITE,
                    color: on ? "#fff" : PERF_BODY,
                    cursor: "pointer",
                    borderRadius: 999,
                  }}
                >
                  {teamLabel(id, ar)}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", flexDirection: "column", border: `1px solid ${PERF_LINE}`, background: PERF_WHITE, maxHeight: 270, overflowY: "auto" }}>
            {view.branches.filter((branch) => byBranch.has(branch.id)).map((branch) => {
              const names = byBranch.get(branch.id) || [];
              const bOn = selB.includes(branch.id);
              const el = view.ranked.filter((row) => row.branchId === branch.id && row.ok);
              const score = el.length ? Math.round(el.reduce((sum, row) => sum + row.score, 0) / el.length) : 0;
              const picked = names.filter((person) => selP.includes(person.id)).length;
              const allIn = picked === names.length && names.length > 0;
              const open = q ? true : openB[branch.id] !== false;
              return (
                <div key={branch.id} style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ background: PERF_SURFACE, borderBottom: `1px solid ${PERF_SOFT}`, display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto auto", gap: 9, alignItems: "center", paddingInlineEnd: 9 }}>
                    <button type="button" onClick={() => onToggleBranch(branch.id)} title={ar ? "اختر الفرع كوحدة للمقارنة" : "Compare the branch as a unit"} style={{ fontFamily: "inherit", padding: "7px 11px 7px 0", marginInlineStart: 11, border: "none", background: "none", cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
                      <span style={{ width: 13, height: 13, border: `1px solid ${bOn ? PERF_NAVY : "#c7ccd6"}`, background: bOn ? PERF_NAVY : PERF_WHITE, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9 }}>{bOn ? "✓" : ""}</span>
                    </button>
                    <button type="button" onClick={() => { if (!q) onToggleOpen(branch.id); }} style={{ fontFamily: "inherit", textAlign: "start", padding: "7px 0", border: "none", background: "none", color: PERF_INK, cursor: "pointer", display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                      <span style={{ fontSize: 9, color: PERF_MUTED, width: 9, flex: "none" }}>{open ? "▾" : "▸"}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{branch.name}</span>
                      <span dir="ltr" style={{ ...mono, fontSize: 10, color: PERF_MUTED }}>{names.length}</span>
                      <span dir="ltr" style={{ ...mono, fontSize: 11, color: el.length ? textOf(score) : PERF_MUTED }}>{el.length ? score : "—"}</span>
                    </button>
                    <span style={{ fontSize: 10, fontWeight: 600, color: PERF_GREEN, whiteSpace: "nowrap" }}>{picked ? (ar ? `مختار ${picked}` : `${picked} picked`) : ""}</span>
                    <button type="button" onClick={() => onPickAll(names.map((person) => person.id), allIn)} style={{ fontFamily: "inherit", fontSize: 10, fontWeight: 600, padding: "4px 9px", border: `1px solid ${PERF_LINE}`, background: PERF_WHITE, color: PERF_BODY, cursor: "pointer", borderRadius: 10 }}>
                      {allIn ? (ar ? "أزل الكلّ" : "Clear all") : (ar ? "اختر الكلّ" : "Pick all")}
                    </button>
                  </div>
                  {open ? names.slice().sort((left, right) => left.name.localeCompare(right.name, "ar")).map((person) => {
                    const on = selP.includes(person.id);
                    const viaB = selB.includes(person.branchId);
                    const viaT = selT.includes(person.team);
                    return (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => onTogglePerson(person.id)}
                        style={{
                          fontFamily: "inherit",
                          textAlign: "start",
                          padding: "7px 11px",
                          border: "none",
                          borderBottom: "1px solid #f7f8fa",
                          background: on ? "#f2faf6" : PERF_WHITE,
                          color: PERF_INK,
                          cursor: "pointer",
                          display: "grid",
                          gridTemplateColumns: "14px minmax(0,1fr) auto",
                          gap: 9,
                          alignItems: "center",
                        }}
                      >
                        <span style={{ width: 13, height: 13, border: `1px solid ${on ? PERF_NAVY : "#c7ccd6"}`, background: on ? PERF_NAVY : PERF_WHITE, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9 }}>{on ? "✓" : ""}</span>
                        <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 11, fontWeight: on ? 700 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{person.name}</span>
                          <span style={{ fontSize: 10, color: PERF_MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{person.job} · {teamLabel(person.team, ar)}</span>
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: on || viaB || viaT ? PERF_GREEN : PERF_MUTED, whiteSpace: "nowrap" }}>
                          {on ? (ar ? "مختار" : "Picked") : viaB ? (ar ? "عبر الفرع" : "Via branch") : viaT ? (ar ? "عبر الفريق" : "Via team") : ""}
                        </span>
                      </button>
                    );
                  }) : null}
                </div>
              );
            })}
            {!hit.length ? (
              <span style={{ padding: "10px 11px", fontSize: 11, color: PERF_MUTED }}>{ar ? `لا اسم يطابق «${pickQ}».` : `No name matches “${pickQ}”.`}</span>
            ) : null}
          </div>
          <span style={{ fontSize: 11, color: PERF_BODY, lineHeight: 1.9 }}>
            {anyPick
              ? (ar
                ? `${countAr(view.pool.length, "موظف واحد", "موظفان", "موظفين", "موظفاً", "لا أحد")} في المقارنة. مربّع الفرع يأخذه وحدةً تُقارَن، و«اختر الكلّ» يأخذ أسماءه أفراداً.`
                : `${view.pool.length} in the comparison. The branch box takes it as a unit; Pick all takes the names as people.`)
              : (ar
                ? "لا اختيار = الجميع. اختر فروعاً أو فِرقاً أو أسماءً — ومقارنة المجموعات تظهر عند اختيار اثنتين أو أكثر."
                : "No pick = everyone. Choose branches, teams, or names — group comparison appears when two or more are picked.")}
          </span>
        </div>
      ) : null}
    </section>
  );
}
