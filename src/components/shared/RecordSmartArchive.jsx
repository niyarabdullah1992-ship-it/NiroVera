import React, { useState } from "react";
import { Archive, Search, ChevronDown, FolderOpen } from "lucide-react";
import { formatDateTime, formatDayMonthYear, groupArchiveByYearDay } from "@/lib/dateFormat";
import { peopleQueryMatches } from "@/lib/peopleTreeGraph";
import IdentityCard, { identityIconWrap } from "@/components/shared/IdentityCard";
import { BORDER, MUTED, NAVY, SURFACE, field, NEUTRAL, CARD } from "@/lib/platformStyles";

function dateFromDayKey(dk) {
  const [y, m, d] = String(dk || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function archiveItemSearchHay(it) {
  return [it?.title, it?.text, it?.badge, it?.search, it?.hay, it?.date].filter(Boolean).join(" ");
}

export default function RecordSmartArchive({
  items,
  lang,
  dir,
  emptyLabel,
  noMatchLabel,
  onOpen,
  query: queryProp,
  onQueryChange,
  skipFilter = false,
  searchPlaceholder,
  meta,
  kicker,
  title,
  subtitle,
  renderOpen,
}) {
  const ar = lang === "ar";
  const [innerQuery, setInnerQuery] = useState("");
  const query = queryProp !== undefined ? queryProp : innerQuery;
  const setQuery = (value) => {
    onQueryChange?.(value);
    if (queryProp === undefined) setInnerQuery(value);
  };
  const [open, setOpen] = useState({});
  const [openRowId, setOpenRowId] = useState("");

  const source = items || [];
  const filtered = skipFilter
    ? source
    : source.filter((it) => peopleQueryMatches(archiveItemSearchHay(it), query));

  const { years, yearList, newestDk } = groupArchiveByYearDay(filtered);
  const namedEmpty = !source.length
    ? (emptyLabel || (ar ? "لا توجد سجلات مؤرشفة" : "No archived records"))
    : (noMatchLabel
      || (query
        ? (ar ? `لا بند مؤرشف يطابق «${query}».` : `No archived item matches “${query}”.`)
        : (ar ? "لا بند مؤرشف يطابق التصفية." : "No archived item matches this filter.")));

  const openable = !!(onOpen || renderOpen);
  const toggleRow = (it) => {
    if (renderOpen) setOpenRowId((id) => (id === it.id ? "" : it.id));
    onOpen?.(it);
  };

  return (
    <IdentityCard
      icon={Archive}
      kicker={kicker || (ar ? "سجل زمني" : "Timeline")}
      title={title || (ar ? "الأرشيف" : "Archive")}
      subtitle={subtitle || (ar ? "مجمّعة يومًا بيوم حسب تاريخ الإغلاق." : "Grouped day by day by close date.")}
      meta={meta}
      dir={dir}
      bodySurface
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ position: "relative" }}>
          <Search
            style={{
              position: "absolute",
              top: "50%",
              insetInlineStart: 12,
              transform: "translateY(-50%)",
              width: 14,
              height: 14,
              color: MUTED,
              pointerEvents: "none",
            }}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder || (ar ? "بحث في الأرشيف…" : "Search archive…")}
            aria-label={ar ? "بحث الأرشيف" : "Archive search"}
            className="nv-search-field"
            style={{ ...field, padding: 0, paddingInlineStart: 36, paddingInlineEnd: 12 }}
          />
        </div>

        {yearList.length === 0 ? (
          <div style={{ padding: "28px 8px", textAlign: "center" }}>
            <Archive style={{ width: 28, height: 28, margin: "0 auto 8px", color: MUTED, opacity: 0.55 }} />
            <p style={{ margin: 0, fontSize: 13, color: MUTED }}>
              {namedEmpty}
            </p>
          </div>
        ) : (
          yearList.map((year) => (
            <div key={year} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: NAVY }}>{year}</h3>
                <span style={{ height: 1, flex: 1, background: BORDER }} />
                <span style={{ fontSize: 11, color: MUTED }}>
                  {Array.from(years.get(year).values()).reduce((a, arr) => a + arr.length, 0)}
                </span>
              </div>
              {Array.from(years.get(year).keys()).sort().reverse().map((dk) => {
                const recs = years.get(year).get(dk).slice().sort((a, b) => new Date(b.date) - new Date(a.date));
                const isOpen = open[dk] ?? (dk === newestDk);
                return (
                  <div
                    key={dk}
                    style={{
                      borderRadius: 16,
                      border: `1px solid ${BORDER}`,
                      background: CARD,
                      overflow: "hidden",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setOpen((o) => ({ ...o, [dk]: !o[dk] }))}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "12px 14px",
                        background: isOpen ? SURFACE : CARD,
                        border: 0,
                        cursor: "pointer",
                        textAlign: "start",
                        fontFamily: "inherit",
                      }}
                    >
                      <span style={identityIconWrap}>
                        <FolderOpen style={{ width: 16, height: 16 }} strokeWidth={1.75} />
                      </span>
                      <p dir={dir} style={{ margin: 0, fontSize: 13, fontWeight: 600, color: NAVY, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {formatDayMonthYear(dateFromDayKey(dk), lang)}
                      </p>
                      <span style={{ fontSize: 11, color: MUTED, flexShrink: 0 }}>{recs.length}</span>
                      <ChevronDown
                        style={{
                          width: 16,
                          height: 16,
                          color: MUTED,
                          flexShrink: 0,
                          transform: isOpen ? "rotate(180deg)" : "none",
                          transition: "transform .15s ease",
                        }}
                      />
                    </button>
                    {isOpen && (
                      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8, borderTop: `1px solid ${BORDER}`, background: SURFACE }}>
                        {recs.map((it) => {
                          const rowOpen = renderOpen && openRowId === it.id;
                          return (
                            <div
                              key={it.id}
                              role={openable ? "button" : undefined}
                              tabIndex={openable ? 0 : undefined}
                              onClick={openable ? () => toggleRow(it) : undefined}
                              onKeyDown={openable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleRow(it); } } : undefined}
                              style={{
                                padding: 12,
                                borderRadius: 12,
                                border: `1px solid ${BORDER}`,
                                background: CARD,
                                cursor: openable ? "pointer" : "default",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 11, color: MUTED }}>
                                <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: NAVY, fontWeight: 600 }}>{it.title}</span>
                                  {it.badge ? <span style={NEUTRAL}>{it.badge}</span> : null}
                                </span>
                                <span style={{ flexShrink: 0 }}>{formatDateTime(it.date, lang)}</span>
                              </div>
                              {it.text ? <p style={{ margin: "6px 0 0", fontSize: 13, color: NAVY, lineHeight: 1.55 }}>{it.text}</p> : null}
                              {rowOpen ? (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => e.stopPropagation()}
                                  style={{ marginTop: 10 }}
                                >
                                  {renderOpen(it)}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </IdentityCard>
  );
}
