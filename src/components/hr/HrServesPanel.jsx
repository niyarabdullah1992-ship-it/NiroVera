import React, { useMemo, useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { assignBranchHrManager, clearBranchHrManager } from "@/lib/orgHire";
import {
  HR_SPAN_MAX,
  fieldBranchesForHr,
  hrManagerForStation,
  isHrDirector,
  isRegionalHr,
  servedStationIds,
} from "@/lib/hrTree";

const MONO = "'IBM Plex Mono', monospace";

function fold(value) {
  return String(value || "")
    .toLocaleLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .trim();
}

function spanReason(error, ar) {
  if (error === "HR_SPAN") {
    return ar
      ? `المدير الإقليمي يخدم ${HR_SPAN_MAX} فروع كحد أقصى.`
      : `A regional HR manager serves at most ${HR_SPAN_MAX} branches.`;
  }
  return ar ? "تعذّر تحديث الفروع التي يخدمها." : "Could not update the branches served.";
}

/**
 * Branches this regional HR manager serves.
 * One branch has one HR manager. Moving it is written to the audit log.
 * The three-branch cap stays: it is the named HR span gate.
 */
function BranchPicker({ employee, data, companyId, ar, canWrite }) {
  const [query, setQuery] = useState("");
  const served = useMemo(
    () => new Set(servedStationIds(data, employee.id).map(String)),
    [data, employee.id],
  );
  const branches = useMemo(() => fieldBranchesForHr(data), [data]);
  const filtered = useMemo(() => {
    const needle = fold(query);
    const rows = branches.filter((station) => {
      if (!needle) return true;
      const blob = fold([station.name, station.city, station.code, station.shortCode].filter(Boolean).join(" "));
      return blob.includes(needle);
    });
    rows.sort((a, b) => {
      const aa = served.has(String(a.id)) ? 0 : 1;
      const bb = served.has(String(b.id)) ? 0 : 1;
      if (aa !== bb) return aa - bb;
      return String(a.name || "").localeCompare(String(b.name || ""), ar ? "ar" : "en");
    });
    return rows;
  }, [branches, query, served, ar]);

  const assign = (station, quiet = false) => {
    if (!canWrite || !companyId) return false;
    const previous = hrManagerForStation(data, station.id);
    const result = assignBranchHrManager(companyId, station.id, employee.id);
    if (!result.ok) {
      toast({ description: spanReason(result.error, ar) });
      return false;
    }
    if (!quiet) {
      const moved = previous?.id && String(previous.id) !== String(employee.id);
      const branch = station.name || "—";
      const who = employee.name || "—";
      toast({
        description: moved
          ? (ar ? `أُسند ${branch} إلى ${who} (نُقل من ${previous.name || "—"})` : `${branch} moved to ${who} from ${previous.name || "—"}`)
          : (ar ? `أُسند ${branch} إلى ${who}` : `${branch} assigned to ${who}`),
      });
    }
    return true;
  };

  const clear = (station, quiet = false) => {
    if (!canWrite || !companyId) return false;
    const result = clearBranchHrManager(companyId, station.id);
    if (!result.ok) {
      toast({ description: spanReason(result.error, ar) });
      return false;
    }
    if (!quiet) {
      toast({
        description: ar
          ? `أُزيل ${station.name || "—"} من نطاق ${employee.name || "—"}`
          : `${station.name || "—"} removed from ${employee.name || "—"}`,
      });
    }
    return true;
  };

  const toggle = (station) => {
    if (served.has(String(station.id))) clear(station);
    else assign(station);
  };

  const selectVisible = () => {
    const targets = filtered.filter((station) => !served.has(String(station.id)));
    if (!targets.length) return;
    if (targets.length > 5 && !window.confirm(ar
      ? `هل أنت متأكد؟ سيُسنَد ${targets.length} فرعاً إلى ${employee.name || "—"}.`
      : `Assign ${targets.length} branches to ${employee.name || "—"}?`)) return;
    let done = 0;
    for (const station of targets) {
      if (!assign(station, true)) break;
      done += 1;
    }
    if (done) {
      toast({
        description: ar ? `أُسند ${done} من الفروع الظاهرة إلى ${employee.name || "—"}.` : `${done} shown branches assigned.`,
      });
    }
  };

  const clearAll = () => {
    const targets = branches.filter((station) => served.has(String(station.id)));
    if (!targets.length) return;
    if (targets.length > 5 && !window.confirm(ar
      ? `هل أنت متأكد؟ ستُزال ${targets.length} فروع من نطاق ${employee.name || "—"}.`
      : `Remove ${targets.length} branches from ${employee.name || "—"}?`)) return;
    let done = 0;
    targets.forEach((station) => {
      if (clear(station, true)) done += 1;
    });
    if (done) {
      toast({
        description: ar ? `أُزيلت الفروع من نطاق ${employee.name || "—"}.` : `Branches removed from ${employee.name || "—"}.`,
      });
    }
  };

  const onListKey = (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const rows = [...event.currentTarget.querySelectorAll("[data-hr-branch]")];
    if (!rows.length) return;
    const at = rows.indexOf(document.activeElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    const next = rows[(at < 0 ? 0 : at + step + rows.length) % rows.length];
    event.preventDefault();
    next?.focus();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".14em", color: "var(--nv-ink3)" }}>
          {ar ? "الفروع التي يخدمها" : "Branches served"}
        </span>
        <span dir="ltr" style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: "var(--nv-ink2)", unicodeBidi: "isolate" }}>
          {served.size} {ar ? "من" : "of"} {HR_SPAN_MAX}
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, minHeight: 28 }}>
        {served.size ? branches.filter((station) => served.has(String(station.id))).map((station) => (
          <span
            key={station.id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              height: 26,
              padding: "0 6px 0 10px",
              borderRadius: 999,
              background: "var(--nv-ok-soft)",
              border: "1px solid #BFE0CC",
              color: "var(--nv-ok-ink)",
              fontSize: 11.5,
              fontWeight: 600,
            }}
          >
            {station.name || "—"}
            {canWrite ? (
              <button
                type="button"
                aria-label={ar ? `إزالة ${station.name || ""}` : `Remove ${station.name || ""}`}
                onClick={() => clear(station)}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  border: 0,
                  background: "transparent",
                  color: "var(--nv-ok-ink)",
                  fontSize: 11,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                ✕
              </button>
            ) : null}
          </span>
        )) : (
          <span style={{ fontSize: 11.5, color: "var(--nv-ink3)" }}>
            {ar ? "لم يُسند له أي فرع بعد." : "No branch is assigned yet."}
          </span>
        )}
      </div>

      <div style={{ border: "1px solid var(--nv-line)", borderRadius: 10, background: "var(--nv-card)", overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", padding: 8, background: "var(--nv-soft)", borderBottom: "1px solid var(--nv-line3)" }}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={ar ? "⌕ ابحث باسم الفرع" : "⌕ Search by branch"}
            aria-label={ar ? "بحث في الفروع" : "Search branches"}
            style={{
              flex: 1,
              height: 32,
              borderRadius: 8,
              border: "1px solid var(--nv-line)",
              padding: "0 10px",
              fontSize: 12,
              outline: "none",
              fontFamily: "inherit",
              color: "var(--nv-ink)",
              background: "var(--nv-card)",
              minWidth: 0,
            }}
          />
          {canWrite ? (
            <>
              <button type="button" onClick={selectVisible} style={textBtn("var(--nv-ok-ink)")}>
                {ar ? "تحديد الظاهر" : "Select shown"}
              </button>
              <button type="button" onClick={clearAll} style={textBtn("var(--nv-bad-ink)")}>
                {ar ? "إلغاء الكل" : "Clear all"}
              </button>
            </>
          ) : null}
        </div>
        <div role="group" aria-label={ar ? "الفروع" : "Branches"} onKeyDown={onListKey} style={{ maxHeight: 220, overflow: "auto" }}>
          {filtered.length ? filtered.map((station) => {
            const on = served.has(String(station.id));
            const holder = hrManagerForStation(data, station.id);
            const other = holder && String(holder.id) !== String(employee.id);
            const note = on
              ? (ar ? "ضمن نطاقه" : "In range")
              : other
                ? (ar ? `يخدمه: ${holder.name || "—"}` : `Served by ${holder.name || "—"}`)
                : (ar ? "بلا مدير م.ب." : "No HR manager");
            const noteColor = on ? "var(--nv-ok-ink)" : other ? "var(--nv-warn-ink)" : "var(--nv-bad-ink)";
            return (
              <div
                key={station.id}
                data-hr-branch="true"
                role="checkbox"
                aria-checked={on}
                tabIndex={0}
                onClick={() => canWrite && toggle(station)}
                onKeyDown={(event) => {
                  if (!canWrite) return;
                  if (event.key === " " || event.key === "Enter") {
                    event.preventDefault();
                    toggle(station);
                  }
                }}
                style={{
                  display: "grid",
                  gridTemplateColumns: "18px minmax(0,1fr) auto",
                  gap: 10,
                  alignItems: "center",
                  padding: "8px 12px",
                  borderBottom: "1px solid var(--nv-line3)",
                  cursor: canWrite ? "pointer" : "default",
                  background: "transparent",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    boxSizing: "border-box",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: on ? "var(--nv-ok-fill)" : "var(--nv-card)",
                    border: on ? "1px solid var(--nv-ok-fill)" : "1px solid #C5CEC9",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {on ? "✓" : ""}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {station.name || "—"}
                </span>
                <span style={{ fontSize: 10.5, color: noteColor, whiteSpace: "nowrap" }}>{note}</span>
              </div>
            );
          }) : (
            <div style={{ padding: 14, textAlign: "center", fontSize: 11.5, color: "var(--nv-ink3)" }}>
              {ar ? "لا فرع بهذا الاسم." : "No branch by that name."}
            </div>
          )}
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 10.5, color: "var(--nv-ink3)", lineHeight: 1.7 }}>
        {ar
          ? "الفرع يخدمه مدير موارد بشرية واحد؛ إسناده هنا ينقله من مديره الحالي ويُسجَّل في سجل الأحداث."
          : "One HR manager serves a branch. Assigning it here moves it and writes an audit row."}
      </p>
    </div>
  );
}

function textBtn(color) {
  return {
    border: 0,
    background: "transparent",
    color,
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
    padding: 0,
  };
}

export default function HrServesPanel({ employee, data, companyId, ar = true, canWrite = false }) {
  if (!employee?.id || !canWrite) return null;
  const director = isHrDirector(employee, data);
  const regional = isRegionalHr(employee, data);
  if (!director && !regional) return null;

  if (director) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", border: "1px solid var(--nv-line)", borderRadius: 12, fontSize: 11.5, lineHeight: 1.7 }}>
        <strong>{ar ? "خط ثابت إلى الرئيس التنفيذي" : "Solid line to the CEO"}</strong>
        <span style={{ color: "var(--nv-ink3)" }}>
          {ar
            ? "التعيين والنقل والتكليف والسجل. مسؤول الالتزام ومسؤول الرواتب والعقود تحت هذا المنصب، لا تحت مدير إقليمي."
            : "Hiring, transfer, assignment, and the record. Compliance and payroll sit here, not under a regional manager."}
        </span>
      </div>
    );
  }

  return (
    <BranchPicker employee={employee} data={data} companyId={companyId} ar={ar} canWrite={canWrite} />
  );
}
