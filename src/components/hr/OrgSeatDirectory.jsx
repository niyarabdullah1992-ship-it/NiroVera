import React, { useMemo, useState } from "react";
import { isCompanyRootStation, isHrUnit } from "@/lib/stationTree";

function initialsOf(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part.slice(0, 1)).join("") || "—";
}

function codeOf(station) {
  const code = String(station?.code || "").trim();
  if (code && !/preview/i.test(code)) return code;
  if (isCompanyRootStation(station)) return "HQ";
  if (isHrUnit(station)) return "HR";
  return "—";
}

const STATUSES = [
  ["", "الكل", "All"],
  ["vac", "الشواغر", "Vacant"],
  ["act", "المكلَّفون", "Acting"],
  ["warn", "تنبيه", "Alert"],
];

/**
 * Package directory: branch tiles, status segments, cards grouped by branch.
 * Uses live seats only. The HR unit is a group header, not a second tree card.
 */
export default function OrgSeatDirectory({ nodes = [], stations = [], ar = true, onOpen }) {
  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState("");

  const byId = useMemo(() => new Map(nodes.map((node) => [String(node.id), node])), [nodes]);
  const stationById = useMemo(() => new Map((stations || []).map((station) => [String(station.id), station])), [stations]);

  const toneOf = (node) => {
    if (node.vacant) return "vac";
    if (node.acting) return "act";
    if (node.tone === "warn" || node.tone === "block") return "warn";
    return "ok";
  };

  const tiles = useMemo(() => {
    const counts = new Map();
    nodes.forEach((node) => {
      const id = String(node.stationId || "");
      counts.set(id, (counts.get(id) || 0) + 1);
    });
    const rows = [...counts.entries()].map(([id, count]) => {
      const station = stationById.get(id);
      const name = station?.name || (ar ? "—" : "—");
      return { id, name, count };
    }).filter((row) => row.id);
    rows.sort((a, b) => String(a.name).localeCompare(String(b.name), "ar"));
    return [{ id: "", name: ar ? "كل الفروع" : "All branches", count: nodes.length }, ...rows];
  }, [nodes, stationById, ar]);

  const groups = useMemo(() => {
    const shown = nodes.filter((node) => {
      if (branchId && String(node.stationId || "") !== branchId) return false;
      const tone = toneOf(node);
      if (status && tone !== status) return false;
      return true;
    });
    const map = new Map();
    shown.forEach((node) => {
      const id = String(node.stationId || "");
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(node);
    });
    return [...map.entries()].map(([id, items]) => {
      const station = stationById.get(id);
      const managerId = String(station?.managerId || "");
      const manager = byId.get(managerId);
      return {
        id,
        code: codeOf(station),
        name: station?.name || (ar ? "—" : "—"),
        count: items.length,
        manager: manager?.name ? (ar ? `المسؤول: ${manager.name}` : `Lead: ${manager.name}`) : "",
        items,
      };
    });
  }, [nodes, branchId, status, stationById, byId, ar]);

  const statusLabel = (node) => {
    const tone = toneOf(node);
    if (tone === "vac") return { t: ar ? "شاغرة" : "Vacant", color: "#8A5A12", bg: "#FBF3E1" };
    if (tone === "act") return { t: ar ? "مكلَّف" : "Acting", color: "#8A5A12", bg: "#FBF3E1" };
    if (tone === "warn") return { t: ar ? "تنبيه" : "Alert", color: "#9B2335", bg: "#FBEBED" };
    return { t: ar ? "على رأس العمل" : "Active", color: "#2F6B43", bg: "#E6F2EA" };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%", minWidth: 0, textAlign: "start" }}>
      <div style={{ background: "var(--nv-card, #fff)", border: "1px solid var(--nv-line, #E4E9E6)", borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--nv-ink2, #3A4048)" }}>{ar ? "الفرع" : "Branch"}</span>
          <span style={{ fontSize: 11, color: "var(--nv-ink3, #555C66)" }}>{ar ? "اضغط البطاقة لعرض الملف الموجز" : "Open a card for the summary"}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
          {tiles.map((tile) => {
            const on = branchId === tile.id;
            return (
              <button
                key={tile.id || "all"}
                type="button"
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
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", paddingTop: 10, borderTop: "1px solid var(--nv-line, #EEF1EF)" }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--nv-ink2, #3A4048)" }}>{ar ? "الحالة" : "Status"}</span>
          <div style={{ display: "inline-flex", gap: 2, padding: 3, borderRadius: 10, background: "var(--nv-soft, #F2F5F3)", border: "1px solid var(--nv-line, #E4E9E6)", flexWrap: "wrap" }}>
            {STATUSES.map(([id, labelAr, labelEn]) => {
              const on = status === id;
              return (
                <button
                  key={id || "all"}
                  type="button"
                  onClick={() => setStatus(id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    height: 30,
                    padding: "0 12px",
                    borderRadius: 8,
                    border: 0,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 12,
                    fontWeight: on ? 700 : 500,
                    background: on ? "var(--nv-card, #fff)" : "transparent",
                    color: on ? "#0B3D27" : "var(--nv-ink2, #3A4048)",
                    boxShadow: on ? "0 1px 3px rgba(12,20,16,.12)" : "none",
                  }}
                >
                  {ar ? labelAr : labelEn}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {groups.map((group) => (
        <section key={group.id || "none"} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ font: "700 11px 'IBM Plex Mono', monospace", color: "#fff", background: "#0B3D27", borderRadius: 6, padding: "2px 8px" }}>{group.code}</span>
            <strong style={{ fontSize: 14, color: "var(--nv-ink, #111418)" }}>{group.name}</strong>
            <span style={{ fontSize: 11.5, color: "var(--nv-ink3, #555C66)" }}>{group.count}{group.manager ? ` · ${group.manager}` : ""}</span>
            <span style={{ flex: 1, height: 1, background: "var(--nv-line, #E4E9E6)" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
            {group.items.map((node) => {
              const vacant = Boolean(node.vacant);
              const st = statusLabel(node);
              const parent = byId.get(String(node.reportsTo || ""));
              const boss = parent
                ? (ar ? `يتبع: ${parent.vacant ? parent.title : parent.name}` : `Reports to: ${parent.name || parent.title}`)
                : (ar ? "أعلى الهيكل" : "Top of the chart");
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => onOpen?.(node)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    padding: 12,
                    borderRadius: 12,
                    cursor: "pointer",
                    boxSizing: "border-box",
                    textAlign: "start",
                    fontFamily: "inherit",
                    background: vacant ? "#FBF3E1" : "var(--nv-card, #fff)",
                    border: vacant ? "1px dashed #D9C08A" : "1px solid var(--nv-line, #E4E9E6)",
                    color: "inherit",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span style={{ width: 40, height: 40, borderRadius: "50%", flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, ...(vacant ? { border: "1.5px dashed #D9C08A", color: "#B7791F", background: "#fff" } : { background: "#E6F2EA", color: "#0B3D27" }) }}>
                      {vacant ? "＋" : initialsOf(node.name)}
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1, lineHeight: 1.4 }}>
                      <strong style={{ fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: vacant ? "#8A5A12" : "var(--nv-ink, #111418)" }}>{vacant ? (node.title || "—") : (node.name || "—")}</strong>
                      <span style={{ fontSize: 11.5, color: "var(--nv-ink3, #555C66)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{vacant ? (ar ? "بانتظار التوظيف" : "Waiting to be filled") : (node.title || "—")}</span>
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: "1px 8px", whiteSpace: "nowrap", color: st.color, background: st.bg }}>{st.t}</span>
                    {node.grade ? <span style={{ font: "600 10.5px 'IBM Plex Mono', monospace", border: "1px solid var(--nv-line, #E4E9E6)", borderRadius: 999, padding: "0 7px", color: "var(--nv-ink2, #3A4048)" }}>{node.grade}</span> : null}
                    <span style={{ flex: 1 }} />
                    <span dir="ltr" style={{ font: "600 11px 'IBM Plex Mono', monospace", color: "var(--nv-ink3, #555C66)" }}>{node.empLine || "—"}</span>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--nv-ink3, #555C66)", borderTop: "1px solid var(--nv-line2, #F2F5F3)", paddingTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{boss}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
