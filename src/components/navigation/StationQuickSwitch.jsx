import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import useStationSwitcher from "@/hooks/useStationSwitcher";
import { useManagerScopeModel } from "@/components/navigation/ManagerScopeChips";
import { isCompanyRootStation, isManagerUnit, stationParentId } from "@/lib/stationTree";
import { buildBranchNotices } from "@/lib/managerScopeChips";
import { listLocalTodayAttendance } from "@/lib/localAttendanceFallback";

function fold(value) {
  return String(value || "")
    .toLocaleLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .trim();
}

function ancestorChain(station, byId) {
  const chain = [];
  let cursor = station;
  const seen = new Set();
  while (cursor) {
    const parentId = stationParentId(cursor);
    if (!parentId || seen.has(parentId)) break;
    seen.add(parentId);
    cursor = byId.get(parentId);
    if (cursor) chain.push(cursor);
  }
  return chain;
}

function regionOf(station, byId) {
  const chain = ancestorChain(station, byId);
  const region = chain.find((item) => isManagerUnit(item));
  if (region?.name) return region.name;
  const parent = chain[0];
  if (parent?.name && !isCompanyRootStation(parent) && !isManagerUnit(station)) return parent.name;
  return "";
}

function shortRegion(name) {
  return String(name || "").replace(/^المنطقة\s+/, "").trim() || name;
}

const chip = (on) => ({
  display: "inline-flex",
  alignItems: "center",
  height: 24,
  padding: "0 9px",
  borderRadius: 8,
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  border: on ? "none" : "1px solid #D5DCD8",
  background: on ? "#3C7D50" : "#fff",
  color: on ? "#fff" : "#3A4048",
});

/**
 * Header scope menu — one list for every section.
 * Counts are the open section's derived alerts. A branch with none stays quiet.
 */
export default function StationQuickSwitch({ open, onClose, anchorRef }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { data, currentUser, company } = useAuth();
  const { stations, scope, apply, allowsAll } = useStationSwitcher();
  const model = useManagerScopeModel();
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");
  const [box, setBox] = useState(null);
  const [cursor, setCursor] = useState(-1);

  useEffect(() => {
    if (!open) return undefined;
    setQuery("");
    setRegion("");
    return undefined;
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const node = anchorRef?.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const width = Math.min(380, window.innerWidth - 16);
      let left = rect.right - width;
      if (left < 8) left = 8;
      if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
      const top = rect.bottom + 6;
      setBox({
        top,
        left,
        width,
        maxHeight: Math.max(280, Math.min(Math.round(window.innerHeight * 0.72), window.innerHeight - top - 8)),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchorRef]);

  const tree = data?.stations || stations;
  const byId = useMemo(
    () => new Map(tree.map((station) => [String(station.id), station])),
    [tree],
  );

  const workplaces = useMemo(() => {
    const rows = stations.filter((station) => !isManagerUnit(station));
    return rows.length ? rows : stations;
  }, [stations]);

  const regions = useMemo(() => {
    const names = [];
    for (const station of workplaces) {
      const name = regionOf(station, byId);
      if (name && !names.includes(name)) names.push(name);
    }
    return names;
  }, [workplaces, byId]);

  const hits = useMemo(() => {
    const needle = fold(query);
    return workplaces.filter((station) => {
      const group = regionOf(station, byId);
      if (region && group !== region) return false;
      if (!needle) return true;
      const blob = fold([
        station.name,
        station.code,
        station.shortCode,
        station.city,
        station.location,
        group,
      ].filter(Boolean).join(" "));
      return blob.includes(needle);
    });
  }, [workplaces, byId, query, region]);

  const groups = useMemo(() => {
    const buckets = new Map();
    for (const station of hits) {
      const name = regionOf(station, byId) || (ar ? "الفروع" : "Stations");
      if (!buckets.has(name)) buckets.set(name, []);
      buckets.get(name).push(station);
    }
    return [...buckets.entries()].map(([name, items]) => ({ name, items }));
  }, [hits, byId, ar]);

  const attendanceRows = useMemo(
    () => listLocalTodayAttendance(company?.id, data),
    [company?.id, data],
  );
  const badges = useMemo(() => {
    const map = new Map();
    for (const item of buildBranchNotices({ user: currentUser, data, attendanceRows })) {
      const row = map.get(String(item.stationId)) || { urgent: 0, decision: 0 };
      if (item.band === "urgent") row.urgent += item.count;
      else if (item.band === "decision") row.decision += item.count;
      map.set(String(item.stationId), row);
    }
    return map;
  }, [currentUser, data, attendanceRows]);

  const showAll = (allowsAll || model.visible) && !query && !region;
  const rowIds = useMemo(() => {
    const ids = [];
    if (showAll) ids.push("all");
    for (const group of groups) {
      for (const station of group.items) ids.push(String(station.id));
    }
    return ids;
  }, [showAll, groups]);

  useEffect(() => {
    setCursor(-1);
  }, [query, region, open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (!rowIds.length) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setCursor((index) => {
          if (index < 0) return step > 0 ? 0 : rowIds.length - 1;
          return (index + step + rowIds.length) % rowIds.length;
        });
        return;
      }
      if (event.key === "Enter" && cursor >= 0) {
        event.preventDefault();
        const id = rowIds[cursor];
        if (id) {
          apply(id);
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, rowIds, cursor, apply]);

  useEffect(() => {
    if (!open) return undefined;
    const id = cursor >= 0 ? rowIds[cursor] : "";
    if (!id) return undefined;
    const node = document.querySelector(`[data-scope-row="${CSS.escape(id)}"]`);
    node?.scrollIntoView({ block: "nearest" });
    return undefined;
  }, [open, cursor, rowIds]);

  if (!open || !box || typeof document === "undefined") return null;

  const choose = (id) => {
    apply(id);
    onClose();
  };

  return createPortal(
    <>
      <div onMouseDown={onClose} style={{ position: "fixed", inset: 0, zIndex: 80 }} />
      <div
        dir={ar ? "rtl" : "ltr"}
        role="dialog"
        aria-label={ar ? "نطاق الفروع" : "Station scope"}
        style={{
          position: "fixed",
          top: box.top,
          left: box.left,
          zIndex: 81,
          width: box.width,
          background: "#fff",
          border: "1px solid #D5DCD8",
          borderTop: "3px solid #0B8A4F",
          borderRadius: 8,
          boxShadow: "0 18px 44px rgba(29,36,32,.2)",
          display: "flex",
          flexDirection: "column",
          maxHeight: box.maxHeight,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: 10, borderBottom: "1px solid #E4E9E6", display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={ar ? "⌕ ابحث باسم الفرع أو المدينة أو الرمز" : "⌕ Search by branch, city, or code"}
            aria-label={ar ? "بحث في الفروع" : "Search stations"}
            style={{
              height: 34,
              minHeight: 34,
              padding: "0 10px",
              borderRadius: 8,
              border: "1px solid #C5CEC9",
              fontSize: 12.5,
              outline: "none",
              color: "#111418",
              width: "100%",
              boxSizing: "border-box",
              fontFamily: "inherit",
              background: "#fff",
            }}
          />
          {regions.length > 0 ? (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setRegion("")} style={chip(region === "")}>
                {ar ? "كل المناطق" : "All regions"}
              </button>
              {regions.map((name) => (
                <button key={name} type="button" onClick={() => setRegion(name)} style={chip(region === name)}>
                  {shortRegion(name)}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div style={{ overflow: "auto", flex: 1, minHeight: 0 }}>
          {showAll ? (
            <button
              type="button"
              data-scope-row="all"
              onClick={() => choose("all")}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
                padding: "10px 12px",
                border: "none",
                borderBottom: "1px solid #E4E9E6",
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "start",
                background: scope === "all" ? "#E6F4EC" : rowIds[cursor] === "all" ? "#F7FBF8" : "#fff",
                boxShadow: scope === "all" ? "inset -3px 0 0 #0B8A4F" : "none",
              }}
            >
              <strong style={{ fontSize: 12.5, color: "#111418" }}>{ar ? "كل نطاقي" : "All my scope"}</strong>
              <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 600, color: "#555C66", unicodeBidi: "isolate" }}>
                {workplaces.length}
              </span>
            </button>
          ) : null}

          {groups.map((group) => (
            <div key={group.name}>
              <div style={{
                padding: "6px 12px",
                background: "#F2F5F3",
                borderBottom: "1px solid #E4E9E6",
                display: "flex",
                justifyContent: "space-between",
                fontSize: 10.5,
                fontWeight: 700,
                color: "#555C66",
                letterSpacing: "0.04em",
              }}
              >
                <span>{group.name}</span>
                <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", unicodeBidi: "isolate" }}>{group.items.length}</span>
              </div>
              {group.items.map((station) => {
                const id = String(station.id);
                const on = String(scope) === id;
                const badge = badges.get(id) || { urgent: 0, decision: 0 };
                const code = [station.code, station.shortCode]
                  .map((part) => String(part || "").trim())
                  .find((part) => part && fold(part) !== fold(station.name)) || "";
                const kind = station.demo === true ? (ar ? "مثال" : "Sample") : (ar ? "بيانات حيّة" : "Live");
                const hot = rowIds[cursor] === id;
                return (
                  <button
                    key={id}
                    type="button"
                    data-scope-row={id}
                    onClick={() => choose(id)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      padding: "8px 12px",
                      border: "none",
                      borderBottom: "1px solid #F2F5F3",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      textAlign: "start",
                      background: on ? "#E6F4EC" : hot ? "#F7FBF8" : "#fff",
                    }}
                  >
                    <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.35, minWidth: 0 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "#111418" }}>{station.name || "—"}</span>
                      <span style={{ fontSize: 10.5, color: "#555C66" }}>
                        {kind}
                        {code ? " · " : null}
                        {code ? (
                          <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", unicodeBidi: "isolate" }}>{code}</span>
                        ) : null}
                      </span>
                    </span>
                    <span style={{ display: "flex", gap: 4, alignItems: "center", flex: "none" }}>
                      {badge.urgent > 0 ? (
                        <span title={ar ? "عاجل" : "Urgent"} dir="ltr" style={pill("#9B2335", "#fff", "none")}>{badge.urgent}</span>
                      ) : null}
                      {badge.decision > 0 ? (
                        <span title={ar ? "ينتظر قرارك" : "Awaiting you"} dir="ltr" style={pill("#FBF3E1", "#8A5A12", "1px solid #EAD6A8")}>{badge.decision}</span>
                      ) : null}
                      {on ? <span style={{ fontWeight: 700, color: "#0B8A4F" }}>✓</span> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}

          {hits.length === 0 ? (
            <div style={{ padding: 18, textAlign: "center", fontSize: 12, color: "#555C66" }}>
              {ar ? "لا فرع مطابق." : "No matching branch."}
            </div>
          ) : null}
        </div>

        <div style={{ padding: "8px 12px", borderTop: "1px solid #E4E9E6", background: "#FAFBFA", fontSize: 11, color: "#555C66", lineHeight: 1.6 }}>
          {ar
            ? "الشارة الحمراء عاجلة، والذهبية تنتظر قرارك."
            : "Red is urgent. Gold is awaiting your decision."}
        </div>
      </div>
    </>,
    document.body,
  );
}

function pill(background, color, border) {
  return {
    minWidth: 18,
    height: 18,
    padding: "0 5px",
    borderRadius: 999,
    background,
    color,
    border,
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10.5,
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    unicodeBidi: "isolate",
  };
}
