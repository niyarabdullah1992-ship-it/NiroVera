import React, { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import useStationSwitcher from "@/hooks/useStationSwitcher";
import { READINESS_COLOR, readinessLabel } from "@/lib/stationReadiness";
import { CARD, INK, MUTED, SURFACE } from "@/lib/platformStyles";
import { stationParentId } from "@/lib/stationTree";

/** Arabic search must ignore diacritics and alef/ya/ta-marbuta spelling. */
function fold(value) {
  return String(value || "")
    .toLocaleLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .trim();
}

function tokensOf(query) {
  return fold(query).split(/[\s,،/+\-]+/).filter(Boolean);
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

function scoreAgainst(tokens, fields) {
  if (!tokens.length) return 1;
  let total = 0;
  for (const token of tokens) {
    let hit = 0;
    for (const field of fields) {
      const text = field.text;
      if (!text) continue;
      if (text === token) hit = Math.max(hit, field.exact);
      else if (text.startsWith(token)) hit = Math.max(hit, field.start);
      else if (text.includes(token)) hit = Math.max(hit, field.has);
    }
    if (!hit) return 0;
    total += hit;
  }
  return total;
}

const overlay = {
  position: "fixed",
  inset: 0,
  zIndex: 90,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  padding: "10vh 16px 16px",
  background: "rgba(20,40,75,.38)",
};

const card = {
  width: "100%",
  maxWidth: "400px",
  background: CARD,
  border: "1px solid #E2E8F0",
  borderRadius: "12px",
  boxShadow: "0 16px 40px rgba(20,40,75,.2)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  maxHeight: "min(480px, 70vh)",
};

const groupLabel = {
  padding: "10px 16px 4px",
  fontSize: "9px",
  letterSpacing: "0.12em",
  color: MUTED,
  fontWeight: 600,
};

const kbd = {
  display: "inline-block",
  padding: "1px 5px",
  borderRadius: "5px",
  border: "1px solid #E2E8F0",
  background: SURFACE,
  fontSize: "10px",
  color: MUTED,
  fontFamily: "'IBM Plex Mono',monospace",
};

/**
 * Station quick-switch palette — changes the header scope in place.
 * It never navigates: the section stays mounted and re-derives on the new
 * station, so tabs, filters and scroll survive the switch.
 */
export default function StationQuickSwitch({ open, onClose }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { data } = useAuth();
  const { stations, scope, readiness, recents, apply, allowsAll } = useStationSwitcher();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
    }
  }, [open]);

  const tree = data?.stations || stations;
  const byId = useMemo(
    () => new Map(tree.map((station) => [String(station.id), station])),
    [tree],
  );
  const peopleById = useMemo(
    () => new Map((data?.employees || []).map((person) => [String(person.id), person])),
    [data?.employees],
  );

  const rows = useMemo(() => {
    const tokens = tokensOf(query);
    const searching = tokens.length > 0;
    const allLabel = ar ? "كل الفروع" : "All stations";

    const stationRow = (station, group, extra = {}) => {
      const ancestors = ancestorChain(station, byId);
      const parent = ancestors[0];
      const manager = peopleById.get(String(station.managerId || ""));
      const path = ancestors.map((item) => item.name).filter(Boolean).reverse().join(" · ");
      return {
        id: String(station.id),
        group,
        name: station.name,
        code: station.code || station.shortCode || "",
        path,
        parentName: parent?.name || "",
        managerName: manager?.name || "",
        readiness: readiness.get(String(station.id)) || null,
        ...extra,
      };
    };

    const fieldsFor = (station) => {
      const ancestors = ancestorChain(station, byId);
      const manager = peopleById.get(String(station.managerId || ""));
      return [
        { text: fold(station.name), exact: 100, start: 82, has: 64 },
        { text: fold(station.code || station.shortCode), exact: 90, start: 74, has: 58 },
        { text: fold([station.location, station.city, station.region].filter(Boolean).join(" ")), exact: 70, start: 52, has: 44 },
        { text: fold(ancestors.map((item) => item.name).join(" ")), exact: 56, start: 48, has: 42 },
        { text: fold(manager?.name), exact: 40, start: 34, has: 28 },
      ];
    };

    const allRow = {
      id: "all",
      group: "scope",
      name: allLabel,
      code: "",
      path: "",
      parentName: "",
      managerName: "",
      readiness: null,
      score: searching ? scoreAgainst(tokens, [{ text: fold(allLabel), exact: 90, start: 70, has: 50 }]) : 1,
    };

    if (!searching) {
      const recentRows = recents.map((station) => stationRow(station, "recent"));
      const recentIds = new Set(recentRows.map((row) => row.id));
      const stationRows = stations
        .filter((station) => !recentIds.has(String(station.id)))
        .map((station) => stationRow(station, "station"));
      return allowsAll ? [allRow, ...recentRows, ...stationRows] : [...recentRows, ...stationRows];
    }

    const hits = stations
      .map((station) => {
        const score = scoreAgainst(tokens, fieldsFor(station));
        if (!score) return null;
        const ancestors = ancestorChain(station, byId);
        const parentHit = ancestors.some((item) => tokens.some((token) => fold(item.name).includes(token)));
        const nameHit = tokens.some((token) => fold(station.name).includes(token));
        const why = !nameHit && parentHit
          ? (ar ? `تحت ${ancestors.map((item) => item.name).reverse().join(" · ")}` : `Under ${ancestors.map((item) => item.name).reverse().join(" · ")}`)
          : "";
        return stationRow(station, "result", { score, why });
      })
      .filter(Boolean)
      .sort((a, b) => (b.score - a.score) || String(a.name).localeCompare(String(b.name), ar ? "ar" : "en"));

    return allowsAll && allRow.score ? [allRow, ...hits] : hits;
  }, [query, stations, recents, readiness, ar, byId, peopleById, tree, allowsAll]);

  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, rows.length - 1)));
  }, [rows.length]);

  if (!open) return null;

  const choose = (row) => {
    apply(row.id);
    onClose();
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((c) => (rows.length ? (c + 1) % rows.length : 0));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((c) => (rows.length ? (c - 1 + rows.length) % rows.length : 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const row = rows[cursor];
      if (row) choose(row);
    }
  };

  let lastGroup = null;

  return (
    <div
      style={overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div style={card} dir={ar ? "rtl" : "ltr"} role="dialog" aria-modal="true">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0 12px", borderBottom: "1px solid #E2E8F0" }}>
          <span style={{ color: MUTED, fontSize: "12px" }}>⌕</span>
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={ar ? "ابحث بالاسم أو الرمز أو الفرع الأب أو الموقع" : "Search by name, code, parent branch, or location"}
            aria-label={ar ? "تبديل الفرع" : "Switch station"}
            style={{
              flex: 1,
              height: "40px",
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: "13px",
              color: INK,
              fontFamily: "inherit",
            }}
          />
          <span style={kbd}>Esc</span>
        </div>

        <div style={{ overflowY: "auto", padding: "6px" }}>
          {rows.length === 0 && (
            <div style={{ padding: "28px 16px", textAlign: "center", fontSize: "12px", color: MUTED }}>
              {ar ? "لا فرع يطابق هذا البحث ضمن صلاحيتك." : "No station in your permission scope matches this search."}
            </div>
          )}
          {rows.map((row, index) => {
            const active = index === cursor;
            const selected = String(scope) === row.id;
            const header = row.group !== lastGroup && row.group !== "scope"
              ? (row.group === "recent"
                ? (ar ? "الأحدث" : "Recent")
                : row.group === "result"
                  ? (ar ? "النتائج" : "Results")
                  : (ar ? "الفروع" : "Stations"))
              : null;
            lastGroup = row.group;
            const level = row.readiness?.level;
            const blocker = row.readiness?.blockers?.[0];
            const subtitle = row.id === "all"
              ? (ar ? `النطاق الكامل · ${stations.length} فروع` : `Full scope · ${stations.length} stations`)
              : row.why
                || (row.path ? row.path : "")
                || (blocker ? (ar ? blocker.ar : blocker.en) : (ar ? "لا بوابة مفتوحة على هذا الفرع" : "No open gate on this station"));
            return (
              <React.Fragment key={`${row.group}-${row.id}`}>
                {header && <div style={groupLabel}>{header}</div>}
                <button
                  type="button"
                  ref={active ? (el) => el?.scrollIntoView({ block: "nearest" }) : null}
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => choose(row)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "9px",
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "start",
                    background: active ? SURFACE : "transparent",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: level ? READINESS_COLOR[level] : "#CBD5E1",
                    }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                      <span style={{ fontSize: "13px", fontWeight: selected ? 600 : 500, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {row.name}
                      </span>
                      {row.code && (
                        <span dir="ltr" style={{ fontSize: "10px", color: MUTED, fontFamily: "'IBM Plex Mono',monospace" }}>
                          {row.code}
                        </span>
                      )}
                      {selected && (
                        <span style={{ fontSize: "10px", color: "#1E9E63", fontWeight: 600 }}>
                          {ar ? "النطاق الحالي" : "current scope"}
                        </span>
                      )}
                    </span>
                    <span style={{ display: "block", marginTop: "3px", fontSize: "11px", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {subtitle}
                    </span>
                  </span>
                  {row.readiness && (
                    <span style={{ textAlign: "end", flexShrink: 0 }}>
                      <span dir="ltr" style={{ display: "block", fontSize: "13px", fontWeight: 600, color: READINESS_COLOR[level], fontFamily: "'IBM Plex Sans',sans-serif" }}>
                        {row.readiness.score}%
                      </span>
                      <span style={{ display: "block", fontSize: "10px", color: MUTED }}>
                        {readinessLabel(level, ar)}
                      </span>
                    </span>
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
