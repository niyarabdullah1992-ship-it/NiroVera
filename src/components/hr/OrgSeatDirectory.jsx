import React, { useMemo, useState } from "react";
import { isCompanyRootStation, isHrUnit } from "@/lib/stationTree";
import { chip, chipButton, mono } from "@/components/schedules/scheduleChrome";
import { gradeBadge } from "@/components/hr/orgUi";

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

  /** Status chip — colour only for a compliance alert; vacant / acting are facts (mute). Active shows nothing. */
  const statusLabel = (node) => {
    const tone = toneOf(node);
    if (tone === "vac") return { t: ar ? "شاغرة" : "Vacant", style: chip("mute", { borderStyle: "dashed" }) };
    if (tone === "act") return { t: ar ? "مكلَّف" : "Acting", style: chip("mute") };
    if (tone === "warn") return { t: ar ? "تنبيه نظامي" : "Compliance alert", style: chip("bad") };
    return null;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", minWidth: 0, textAlign: "start" }}>
      <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--nv-line2, var(--nv-line))", display: "flex", flexDirection: "column", gap: 10 }}>
        <div role="group" aria-label={ar ? "الفرع" : "Branch"} style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--nv-muted)", marginInlineEnd: 4 }}>{ar ? "الفرع" : "Branch"}</span>
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
        <div role="group" aria-label={ar ? "الحالة" : "Status"} style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--nv-muted)", marginInlineEnd: 4 }}>{ar ? "الحالة" : "Status"}</span>
          {STATUSES.map(([id, labelAr, labelEn]) => {
            const on = status === id;
            return (
              <button key={id || "all"} type="button" aria-pressed={on} onClick={() => setStatus(id)} style={chipButton(on)}>
                {ar ? labelAr : labelEn}
              </button>
            );
          })}
          <span style={{ fontSize: 11, color: "var(--nv-muted)", marginInlineStart: "auto" }}>{ar ? "اضغط السطر لعرض الملف الموجز" : "Open a row for the summary"}</span>
        </div>
      </div>
      {groups.map((group) => (
        <section key={group.id || "none"} style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "9px 18px", background: "var(--nv-soft)", borderBottom: "1px solid var(--nv-line2, var(--nv-line))", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={gradeBadge({ minWidth: 34 })}>{group.code}</span>
            <strong style={{ fontSize: 12.5, color: "var(--nv-ink)" }}>{group.name}</strong>
            <span style={{ fontSize: 11.5, color: "var(--nv-muted)" }}><span dir="ltr" style={mono}>{group.count}</span>{group.manager ? ` · ${group.manager}` : ""}</span>
          </div>
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
                className="nv-org-dir-row"
                onClick={() => onOpen?.(node)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "6px 12px",
                  padding: "10px 18px",
                  cursor: "pointer",
                  boxSizing: "border-box",
                  textAlign: "start",
                  fontFamily: "inherit",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid var(--nv-line2, var(--nv-line))",
                  color: "inherit",
                  width: "100%",
                }}
              >
                <span style={{ width: 32, height: 32, borderRadius: "50%", flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 600, ...(vacant ? { border: "1.5px dashed var(--nv-mute-fill, var(--nv-line))", color: "var(--nv-muted)", background: "transparent" } : { border: "1px solid var(--nv-line)", background: "var(--nv-soft)", color: "var(--nv-ink2)" }) }}>
                  {vacant ? "＋" : initialsOf(node.name)}
                </span>
                <span style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: "1 1 180px", lineHeight: 1.45 }}>
                  <strong style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: vacant ? "var(--nv-muted)" : "var(--nv-ink)" }}>{vacant ? (node.title || "—") : (node.name || "—")}</strong>
                  <span style={{ fontSize: 11.5, color: "var(--nv-ink2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{vacant ? (ar ? "بانتظار التوظيف" : "Waiting to be filled") : (node.title || "—")}</span>
                </span>
                <span style={{ fontSize: 11.5, color: "var(--nv-muted)", flex: "1 1 140px", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{boss}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  {st ? <span style={st.style}>{st.t}</span> : null}
                  {node.grade ? <span style={gradeBadge()}>{node.grade}</span> : null}
                  <span dir="ltr" style={{ ...mono, fontSize: 11, color: "var(--nv-muted)" }}>{node.empLine || "—"}</span>
                </span>
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}
