import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  buildOrgFocusTree,
  deriveFocusNeighborhood,
  focusMove,
  orderKeys,
  resolveFocusKey,
  searchFocusTree,
  unseatedPlace,
} from "@/lib/orgFocus";
import {
  TREE_GEOMETRY,
  cardHeight,
  chartCard,
  clampZoom,
  countLine,
  defaultExpanded,
  expandAllKeys,
  layoutOrgTree,
  pathTo,
  readExpanded,
  readTreeOptions,
  revealPath,
  stepZoom,
  toggleExpanded,
  treeCounts,
} from "@/lib/orgTreeLayout";
import { cardHealthIndex, orgAdminHref, orgCardActions } from "@/lib/orgChartActions";
import {
  branchPeopleKey,
  buildBranchTree,
  defaultBranchExpanded,
  expandAllBranches,
  isBranchKey,
  orgBranchActions,
} from "@/lib/orgBranches";
import { buildWorkforceSeatChart } from "@/lib/workforceSeatChart";
import { todayKey } from "@/lib/orgDesign";
import OrgEmployeePreview from "@/components/hr/OrgEmployeePreview";
import OrgCardDrawer from "./OrgCardDrawer";
import { initialsOf } from "./orgDesignUi";
import "./orgTree.css";

const OPTIONS_KEY = "nv-org-tree-options";
const VIEW_KEY = "nv-org-view";
const ZOOM_KEY = "nv-org-tree-zoom";
const CHILD_LIMIT = 24;
const EXPAND_LIMIT = 600;

function readStore(key, session = false) {
  try { return (session ? window.sessionStorage : window.localStorage).getItem(key); } catch { return null; }
}
function writeStore(key, value, session = false) {
  try { (session ? window.sessionStorage : window.localStorage).setItem(key, value); } catch { /* private window: kept for this visit only */ }
}

function useMedia(query) {
  const get = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false);
  const [on, setOn] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const onChange = () => setOn(mq.matches);
    mq.addEventListener?.("change", onChange);
    onChange();
    return () => mq.removeEventListener?.("change", onChange);
  }, [query]);
  return on;
}

/* ── icons (inline, currentColor) ─────────────────────────────── */
const svg = (children, size = 18, sw = 1.8) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>
);
const Icon = {
  back: svg(<path d="M9 6l6 6-6 6" />),
  search: svg(<><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></>, 16),
  minus: svg(<path d="M5 12h14" />),
  plus: svg(<path d="M5 12h14M12 5v14" />),
  fit: svg(<path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" />),
  full: svg(<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />),
  download: svg(<path d="M12 4v11M7 10l5 5 5-5M5 20h14" />),
  gear: svg(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>, 18, 1.7),
  card: svg(<><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="9" cy="11" r="2" /><path d="M6 16c.6-1.4 1.7-2 3-2s2.4.6 3 2M14.5 10h3.5M14.5 13.5h3.5" /></>, 18, 1.6),
  dots: (<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="6" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="18" cy="12" r="1.6" /></svg>),
  person: svg(<><circle cx="12" cy="8.5" r="3.5" /><path d="M5 19.5c1.3-3.2 3.9-4.8 7-4.8s5.7 1.6 7 4.8" /></>, 20, 1.7),
  chev: svg(<path d="M7 10l5 5 5-5" />, 14, 2),
  building: svg(<><path d="M4 20V6.5L12 3l8 3.5V20" /><path d="M9 20v-4h6v4M8.5 9h1M14.5 9h1M8.5 12.5h1M14.5 12.5h1M3 20h18" /></>, 20, 1.6),
  region: svg(<><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.4" /></>, 20, 1.6),
  group: svg(<><circle cx="9" cy="9" r="3" /><path d="M3.5 19c.9-2.8 3-4.3 5.5-4.3s4.6 1.5 5.5 4.3" /><circle cx="17" cy="8.5" r="2.3" /><path d="M16 13.2c2.2.1 3.8 1.5 4.5 3.8" /></>, 20, 1.6),
};

/* ── one card ─────────────────────────────────────────────────── */
function TreeCard({ card, place, ar, options, w, h, isFocus, highlighted, flag, hasMenu, menuOpen, onSelect, onToggle, onDetails, onMenu }) {
  const name = card.vacant ? (ar ? "شاغر" : "Vacant") : (card.name || "—");
  const kids = card.childKeys?.length || 0;
  const counts = countLine(card, ar);
  // figures in mono (Latin digits); words stay in the platform font
  const countText = counts
    ? <span dir="ltr" className="nv-ot-count__n">{counts}</span>
    : card.open
      ? <><span dir="ltr" className="nv-ot-count__n">{Number(card.open)}</span> {ar ? "شاغر" : "open"}</>
      : <span dir="ltr" className="nv-ot-count__n">{kids}</span>;
  const label = [
    name,
    card.title,
    options.unit ? card.unit : "",
    card.isMe ? (ar ? "أنت" : "you") : "",
    flag ? (ar ? flag.ar : flag.en) : "",
  ].filter(Boolean).join("، ");
  const toggleLabel = ar
    ? `${place.expanded ? "طيّ" : "افتح"} فريق ${name}${counts ? ` — ${card.direct} مباشر من ${card.total}` : ""}`
    : `${place.expanded ? "Fold" : "Open"} ${name}'s team${counts ? ` — ${card.direct} direct of ${card.total}` : ""}`;
  return (
    <article
      className="nv-ot-card"
      data-k={card.key}
      data-focus={isFocus ? "1" : "0"}
      data-vacant={card.vacant ? "1" : "0"}
      data-me={card.isMe ? "1" : "0"}
      data-open={place.expanded ? "1" : "0"}
      style={{ left: place.left, top: place.y, width: w, height: h }}
    >
      <button
        type="button"
        className="nv-ot-card__hit"
        data-key={card.key}
        aria-current={isFocus ? "true" : undefined}
        aria-label={label}
        onClick={() => (isFocus ? onDetails(card) : onSelect(card.key))}
      />
      <span className="nv-ot-avatar" aria-hidden>
        {card.avatarUrl ? <img src={card.avatarUrl} alt="" loading="lazy" /> : card.vacant ? Icon.person : initialsOf(card.name)}
      </span>
      <span className="nv-ot-card__text">
        <span className="nv-ot-card__name" aria-hidden>
          <span className="nv-ot-card__nm">{highlighted ? <mark>{name}</mark> : name}</span>
          {card.isMe ? <span className="nv-ot-me">{ar ? "أنت" : "You"}</span> : null}
        </span>
        {card.title ? <span className="nv-ot-card__title" aria-hidden>{card.title}</span> : null}
        {options.unit && card.unit ? <span className="nv-ot-card__meta" aria-hidden>{card.unit}</span> : null}
        {options.seatCode && card.seatCode ? <span className="nv-ot-code" dir="ltr" aria-hidden>{card.seatCode}</span> : null}
        <span className="nv-ot-card__foot">
          {kids ? (
            <button
              type="button"
              className="nv-ot-count"
              aria-expanded={place.expanded}
              aria-label={toggleLabel}
              title={ar ? "مباشر / الفريق كله — اضغط لفتح الفريق أو طيّه" : "Direct / whole team — click to open or fold"}
              onClick={() => onToggle(card.key)}
            >
              {options.counts ? countText : null}
              <span className="nv-ot-count__chev" aria-hidden>{Icon.chev}</span>
            </button>
          ) : null}
          {flag ? <span className="nv-ot-flag" data-tone={flag.kind === "ACTING_OVER_LIMIT" ? "bad" : "warn"} aria-hidden>{ar ? flag.ar : flag.en}</span> : null}
        </span>
      </span>
      <span className="nv-ot-card__acts">
        <button
          type="button"
          className="nv-ot-card__open"
          onClick={() => onDetails(card)}
          aria-label={ar ? `بطاقة ${name}` : `${name} card`}
          title={ar ? "البطاقة" : "Card"}
        >
          {Icon.card}
        </button>
        {hasMenu ? (
          <button
            type="button"
            className="nv-ot-card__open"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={ar ? `إجراءات ${name}` : `Actions for ${name}`}
            title={ar ? "إجراءات" : "Actions"}
            onClick={(event) => onMenu(card, event.currentTarget)}
          >
            {Icon.dots}
          </button>
        ) : null}
      </span>
    </article>
  );
}

/* ── one branch (or a branch's «أشخاص الفرع») in the «الفروع» view ── */
function BranchCard({ node, place, ar, w, h, isFocus, highlighted, hasMenu, menuOpen, onSelect, onToggle, onOpen, onMenu }) {
  const people = node.kind === "people";
  const kids = node.childKeys?.length || 0;
  const level = people ? "people" : node.level;
  const manager = people ? "" : (node.managerVacant
    ? (ar ? "المدير: شاغر" : "Manager: vacant")
    : node.managerName ? `${ar ? "المدير" : "Manager"}: ${node.managerName}` : "");
  const figures = people
    ? <span dir="ltr" className="nv-ot-count__n">{Number(node.peopleCount || kids)}</span>
    : node.counted
      ? <span dir="ltr" className="nv-ot-count__n">{`${Number(node.headcount)} / ${Number(node.seats)}`}</span>
      : <span dir="ltr" className="nv-ot-count__n">{kids}</span>;
  const label = [
    node.name,
    node.title,
    manager,
    node.counted ? (ar ? `${node.headcount} موظف، ${node.seats} منصب${node.vacantSeats ? `، ${node.vacantSeats} شاغر` : ""}` : `${node.headcount} people, ${node.seats} seats${node.vacantSeats ? `, ${node.vacantSeats} vacant` : ""}`) : "",
    node.isMe ? (ar ? "أنت هنا" : "you are here") : "",
    node.flag ? (ar ? node.flag.ar : node.flag.en) : "",
  ].filter(Boolean).join("، ");
  const toggleLabel = people
    ? (ar ? `${place.expanded ? "طيّ" : "افتح"} ${node.name}` : `${place.expanded ? "Fold" : "Open"} ${node.name}`)
    : (ar ? `${place.expanded ? "طيّ" : "افتح"} ${node.name} — فروعه وأشخاصه` : `${place.expanded ? "Fold" : "Open"} ${node.name} — its branches and people`);
  return (
    <article
      className="nv-ot-card nv-ot-branch"
      data-k={node.key}
      data-level={level}
      data-focus={isFocus ? "1" : "0"}
      data-me={node.isMe ? "1" : "0"}
      data-open={place.expanded ? "1" : "0"}
      style={{ left: place.left, top: place.y, width: w, height: h }}
    >
      <button type="button" className="nv-ot-card__hit" data-key={node.key} aria-current={isFocus ? "true" : undefined} aria-label={label} onClick={() => onSelect(node.key)} />
      <span className="nv-ot-avatar nv-ot-avatar--branch" aria-hidden>
        {people ? Icon.group : node.level === "region" ? Icon.region : Icon.building}
      </span>
      <span className="nv-ot-card__text">
        <span className="nv-ot-card__name" aria-hidden>
          <span className="nv-ot-card__nm">{highlighted ? <mark>{node.name}</mark> : node.name}</span>
          {node.isMe ? <span className="nv-ot-me">{ar ? "أنت هنا" : "You are here"}</span> : null}
        </span>
        {node.title ? <span className="nv-ot-card__title" aria-hidden>{node.title}</span> : null}
        {manager ? <span className="nv-ot-card__meta" data-vacant={node.managerVacant ? "1" : "0"} aria-hidden>{manager}</span> : null}
        <span className="nv-ot-card__foot">
          {kids ? (
            <button
              type="button"
              className="nv-ot-count"
              aria-expanded={place.expanded}
              aria-label={toggleLabel}
              title={people ? (ar ? "عدد الأشخاص — اضغط لفتحهم أو طيّهم" : "People — click to open or fold") : node.counted ? (ar ? "الموظفون / المناصب — اضغط لفتح الفروع والأشخاص" : "People / seats — click to open branches and people") : (ar ? "اضغط لفتح ما تحته" : "Click to open")}
              onClick={() => onToggle(node.key)}
            >
              {figures}
              <span className="nv-ot-count__chev" aria-hidden>{Icon.chev}</span>
            </button>
          ) : node.counted ? <span className="nv-ot-count nv-ot-count--still">{figures}</span> : null}
          {node.counted && node.vacantSeats && !node.flag ? (
            <span className="nv-ot-branch__vac" aria-hidden><span dir="ltr" className="nv-ot-count__n">{Number(node.vacantSeats)}</span> {ar ? "شاغر" : "vacant"}</span>
          ) : null}
          {node.flag ? <span className="nv-ot-flag" data-tone={node.flag.kind === "MANAGER_VACANT" ? "bad" : "warn"} aria-hidden>{ar ? node.flag.ar : node.flag.en}</span> : null}
        </span>
      </span>
      {hasMenu && !people ? (
        <span className="nv-ot-card__acts">
          <button type="button" className="nv-ot-card__open" onClick={() => onOpen(node)} aria-label={ar ? `الفرع ${node.name}` : `${node.name} branch`} title={ar ? "الفرع والوحدة" : "Branch / unit"}>
            {Icon.card}
          </button>
          <button
            type="button"
            className="nv-ot-card__open"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={ar ? `إجراءات ${node.name}` : `Actions for ${node.name}`}
            title={ar ? "إجراءات" : "Actions"}
            onClick={(event) => onMenu(node, event.currentTarget)}
          >
            {Icon.dots}
          </button>
        </span>
      ) : null}
    </article>
  );
}

/* ── «+n» / «طيّ» cards for long teams ── */
function FoldCard({ place, ar, w, h, onClick }) {
  return (
    <button
      type="button"
      className="nv-ot-more"
      data-k={place.key}
      style={{ left: place.left, top: place.y, width: w, height: h }}
      onClick={onClick}
    >
      {place.more ? (ar ? `+ ${Number(place.more)} آخرون` : `+ ${place.more} more`) : (ar ? "طيّ الفريق الطويل" : "Fold the long team")}
    </button>
  );
}

/* ── search (people, titles, seat codes, units — within what the viewer may see) ── */
function TreeSearch({ ar, tree, onPick }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const hits = useMemo(() => searchFocusTree(tree, query, 8), [tree, query]);
  const listId = useId();
  const pick = (card) => {
    if (!card) return;
    onPick(card.key);
    setQuery("");
    setActive(0);
  };
  return (
    <div className="nv-ot-search" role="search">
      <span className="nv-ot-search__icon" aria-hidden>{Icon.search}</span>
      <input
        className="nv-ot-search__input nv-search-field"
        type="search"
        value={query}
        placeholder={ar ? "ابحث عن شخص" : "Search for people"}
        aria-label={ar ? "ابحث عن شخص بالاسم أو المسمى أو رمز المنصب" : "Search people by name, title or seat code"}
        role="combobox"
        aria-expanded={Boolean(query.trim())}
        aria-controls={listId}
        aria-activedescendant={hits[active] ? `${listId}-${active}` : undefined}
        aria-autocomplete="list"
        onChange={(event) => { setQuery(event.target.value); setActive(0); }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") { event.preventDefault(); setActive((i) => Math.min(hits.length - 1, i + 1)); }
          else if (event.key === "ArrowUp") { event.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
          else if (event.key === "Enter") { event.preventDefault(); pick(hits[active]); }
          else if (event.key === "Escape") { setQuery(""); }
        }}
      />
      {query.trim() ? (
        <ul className="nv-ot-menu nv-ot-search__menu" role="listbox" id={listId}>
          {hits.length ? hits.map((card, index) => (
            <li
              key={card.key}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => { event.preventDefault(); pick(card); }}
              onMouseEnter={() => setActive(index)}
            >
              <b>{card.vacant ? (ar ? "شاغر" : "Vacant") : card.name}</b>
              <span>{[card.title, card.unit].filter(Boolean).join(" · ")}</span>
            </li>
          )) : <li className="nv-ot-menu__none" role="option" aria-selected="false" aria-disabled="true">{ar ? "لا نتيجة ضمن ما يحق لك رؤيته." : "No match within what you may see."}</li>}
        </ul>
      ) : null}
    </div>
  );
}

/** A small popover anchored under a toolbar button; Escape or a click outside closes it. */
function Popover({ open, onClose, label, children, anchorRef }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (ref.current?.contains(event.target) || anchorRef.current?.contains(event.target)) return;
      onClose();
    };
    const onKey = (event) => {
      if (event.key === "Escape") { onClose(); anchorRef.current?.focus(); }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => ref.current?.querySelector("button, input")?.focus());
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);
  if (!open) return null;
  return <div ref={ref} className="nv-ot-menu nv-ot-pop" role="dialog" aria-label={label}>{children}</div>;
}

/** The per-card action menu (HR): fixed to the viewport beside the card's «⋯». */
function CardMenu({ ar, card, anchor, actions, onPick, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const w = 272;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rtl = getComputedStyle(anchor).direction === "rtl";
    let left = rtl ? r.left : r.right - w;
    left = Math.max(8, Math.min(vw - w - 8, left));
    const below = r.bottom + 6;
    const height = ref.current?.offsetHeight || 320;
    const top = below + height > vh - 8 ? Math.max(8, r.top - height - 6) : below;
    setPos({ left, top, width: w });
  }, [anchor, actions.length]);
  useEffect(() => {
    const onDown = (event) => {
      if (ref.current?.contains(event.target) || anchor?.contains(event.target)) return;
      onClose();
    };
    const onKey = (event) => {
      if (event.key === "Escape") { event.stopPropagation(); onClose(); anchor?.focus(); return; }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const items = [...(ref.current?.querySelectorAll("[role='menuitem']:not([aria-disabled='true'])") || [])];
      const at = items.indexOf(document.activeElement);
      const next = event.key === "ArrowDown" ? (at + 1) % items.length : (at - 1 + items.length) % items.length;
      items[next]?.focus();
    };
    const onScroll = () => onClose();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onScroll);
    requestAnimationFrame(() => ref.current?.querySelector("[role='menuitem']:not([aria-disabled='true'])")?.focus());
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [anchor, onClose]);
  const groups = ["open", "seat", "decide", "look"];
  const who = card.vacant ? (ar ? "منصب شاغر" : "Open seat") : card.name;
  return createPortal(
    <div
      ref={ref}
      className="nv-ot-menu nv-ot-cardmenu"
      role="menu"
      aria-label={ar ? `إجراءات ${who}` : `Actions for ${who}`}
      dir={ar ? "rtl" : "ltr"}
      style={pos ? { left: pos.left, top: pos.top, width: pos.width } : { visibility: "hidden" }}
    >
      <p className="nv-ot-cardmenu__head"><b>{who}</b>{card.title ? <span>{card.title}</span> : null}</p>
      {groups.map((g) => {
        const rows = actions.filter((a) => a.group === g);
        if (!rows.length) return null;
        return (
          <div key={g} className="nv-ot-cardmenu__group" role="group">
            {rows.map((a) => (
              <button
                key={a.id}
                type="button"
                role="menuitem"
                className="nv-ot-pop__item"
                aria-disabled={a.blocked ? "true" : undefined}
                onClick={() => { if (!a.blocked) onPick(a.id); }}
              >
                <span className="nv-ot-cardmenu__label">
                  {ar ? a.ar : a.en}
                  {a.count ? <span className="nv-ot-cardmenu__n" dir="ltr">{a.count}</span> : null}
                </span>
                {a.blocked ? <span className="nv-ot-cardmenu__why">{ar ? a.blocked.ar : a.blocked.en}</span> : null}
              </button>
            ))}
          </div>
        );
      })}
    </div>,
    document.body,
  );
}

/**
 * The org chart — one tree for the full screen (/app/org/chart) and for «الفروع والدليل» on /app/org.
 *
 * SAP-style: compact cards (avatar, name, title, «مباشر / الكل»); pressing the count opens that
 * card's team under it in neat rows. Any number of cards stay open at once (a Set, kept per viewer
 * in sessionStorage); clicking a card selects it without folding anything. Search opens the path to
 * the person found. Keys: arrows move, Enter opens/folds, Esc folds or steps up, + − 0 zoom.
 *
 * scope "all" (HR/owner) reads the whole tree, opens the employee/seat drawer and the «⋯» menu of
 * admin actions (each routed to the screen that owns it, through its own gate); scope "mine"
 * receives a pruned tree — chain, peers, own subtree — and a read-only card.
 */
export default function OrgTreeChart({
  ar,
  data,
  user,
  companyId,
  scope = "mine",
  canWrite = false,
  onHire,
  onBack,
  backLabel = "",
  variant = "page",
  onAction,
  reveal = null,
}) {
  const embedded = variant === "embedded";
  const day = todayKey();
  const hrScope = scope === "all" && canWrite;
  const peopleTree = useMemo(
    () => buildOrgFocusTree(data, { viewerId: user?.id || "", scope, ar, day }),
    [data, user?.id, scope, ar, day],
  );
  // «الفروع»: HQ → region → branch from the stations (employees: their own chain only)
  const branchTree = useMemo(
    () => buildBranchTree(data, { viewerId: user?.id || "", scope, ar, day, health: hrScope }),
    [data, user?.id, scope, ar, day, hrScope],
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const urlFocus = embedded ? "" : (searchParams.get("focus") || "");

  /* «الأشخاص» | «الفروع» — kept for the session; ?view=branches on the full screen */
  const [view, setViewState] = useState(() => {
    const fromUrl = embedded ? "" : searchParams.get("view");
    if (fromUrl === "branches" || fromUrl === "people") return fromUrl;
    return readStore(VIEW_KEY, true) === "branches" ? "branches" : "people";
  });
  const branches = view === "branches";
  const tree = branches ? branchTree : peopleTree;
  const counts = useMemo(() => treeCounts(tree), [tree]);

  const narrow = useMedia("(max-width: 760px)");
  const reduceMotion = useMedia("(prefers-reduced-motion: reduce)");

  const [options, setOptions] = useState(() => readTreeOptions(readStore(OPTIONS_KEY)));
  const [zoom, setZoomState] = useState(() => clampZoom(readStore(ZOOM_KEY) || 1));
  const zoomAnchor = useRef(null);
  const setZoom = useCallback((next, anchor = null) => {
    zoomAnchor.current = anchor;
    setZoomState((cur) => {
      const z = clampZoom(typeof next === "function" ? next(cur) : next);
      writeStore(ZOOM_KEY, String(z));
      return z;
    });
  }, []);
  const setOption = (key, value) => {
    setOptions((cur) => {
      const next = { ...cur, [key]: value };
      writeStore(OPTIONS_KEY, JSON.stringify(next));
      return next;
    });
  };

  /* opened cards — a Set per viewer, kept for the session (back from a drawer or a pane keeps it) */
  const storeKey = `nv-org-expanded:${companyId || ""}:${user?.id || ""}:${scope}`;
  const storeKeyB = `${storeKey}:branches`;
  const [expandedP, setExpandedP] = useState(() => {
    const stored = readExpanded(readStore(storeKey, true), peopleTree);
    const base = stored || defaultExpanded(peopleTree, peopleTree.viewerKey || peopleTree.roots[0] || "");
    const want = resolveFocusKey(peopleTree, urlFocus);
    return urlFocus && want ? revealPath(base, peopleTree, want) : base;
  });
  // branches: first time this session → HQ and every region open, people folded, then fit
  const branchFresh = useRef(!readStore(storeKeyB, true));
  const [expandedB, setExpandedB] = useState(() => readExpanded(readStore(storeKeyB, true), branchTree) || defaultBranchExpanded(branchTree));
  useEffect(() => { writeStore(storeKey, JSON.stringify([...expandedP]), true); }, [storeKey, expandedP]);
  useEffect(() => { writeStore(storeKeyB, JSON.stringify([...expandedB]), true); }, [storeKeyB, expandedB]);
  const expanded = branches ? expandedB : expandedP;
  const setExpanded = branches ? setExpandedB : setExpandedP;
  const [showAll, setShowAll] = useState(() => new Set());
  const [selectedP, setSelectedP] = useState(() => resolveFocusKey(peopleTree, urlFocus));
  const [selectedB, setSelectedB] = useState(() => branchTree.viewerKey || branchTree.roots[0] || "");
  const selected = branches ? selectedB : selectedP;
  const setSelected = branches ? setSelectedB : setSelectedP;
  const pendingFit = useRef(null);
  if (pendingFit.current === null) {
    pendingFit.current = branches && branchFresh.current;
    if (pendingFit.current) branchFresh.current = false;
  }
  const [capNote, setCapNote] = useState(false);
  const [details, setDetails] = useState(null);
  const [menu, setMenu] = useState(null);
  const [highlight, setHighlight] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [announce, setAnnounce] = useState("");

  const scrollerRef = useRef(null);
  const stageRef = useRef(null);
  const sizerRef = useRef(null);
  const settingsBtn = useRef(null);
  const downloadBtn = useRef(null);
  const pendingScroll = useRef({ key: branches ? selectedB : resolveFocusKey(peopleTree, urlFocus), mode: "center", smooth: false });
  const moveDomFocus = useRef(false);

  const compact = options.density === "compact";
  const cardW = compact ? TREE_GEOMETRY.compactCardW : TREE_GEOMETRY.cardW;
  // a branch card carries one more line (its manager); the branches view keeps one card height
  const cardH = cardHeight(options, compact) + (branches ? (compact ? 16 : 20) : 0);
  const indent = narrow ? 28 : 40;
  /* columns per team row: as many as the canvas holds at 100% (2…6), one on a phone */
  const [canvasW, setCanvasW] = useState(() => (typeof window !== "undefined" ? window.innerWidth - (embedded ? 320 : 72) : 1200));
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    const measure = () => {
      const cs = getComputedStyle(el);
      setCanvasW(el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const maxCols = narrow ? 1 : Math.max(2, Math.min(6, Math.floor((canvasW - indent + TREE_GEOMETRY.gap) / (cardW + TREE_GEOMETRY.gap))));
  const rtl = Boolean(ar);

  const layout = useMemo(
    () => layoutOrgTree(tree, expanded, { cardW, cardH, gap: TREE_GEOMETRY.gap, rowGap: compact ? 26 : 32, indent, maxCols, childLimit: CHILD_LIMIT, showAll }),
    [tree, expanded, cardW, cardH, compact, indent, maxCols, showAll],
  );
  const W = layout.width;
  const H = layout.height;
  const physX = useCallback((x, w = 0) => (rtl ? W - x - w : x), [rtl, W]);

  const health = useMemo(
    () => (hrScope ? cardHealthIndex(tree, data, { day }) : new Map()),
    [hrScope, tree, data, day],
  );

  /* ── scrolling to a card by its layout place (cards glide, so the DOM may lag) ── */
  const scrollToKey = useCallback((key, mode = "center", smooth = true) => {
    const scroller = scrollerRef.current;
    const stage = stageRef.current;
    const place = layout.index.get(key);
    if (!scroller || !stage || !place) return false;
    const s = scroller.getBoundingClientRect();
    const st = stage.getBoundingClientRect();
    const z = zoom || 1;
    const cx = st.left + physX(place.x, cardW) * z;
    const cy = st.top + place.y * z;
    const w = cardW * z;
    const h = cardH * z;
    let dx = 0;
    let dy = 0;
    if (mode === "center") {
      dx = cx + w / 2 - (s.left + s.width / 2);
      dy = cy - (s.top + Math.min(120, s.height * 0.22));
    } else {
      const pad = 24;
      // "team": the card and the first rows of the team just opened under it
      const span = h + (mode === "team" ? Math.min(s.height * 0.45, 260) * z : 0);
      if (cx < s.left + pad) dx = cx - s.left - pad;
      else if (cx + w > s.right - pad) dx = cx + w - s.right + pad;
      if (cy < s.top + pad) dy = cy - s.top - pad;
      else if (cy + span > s.bottom - pad) dy = Math.min(cy - s.top - pad, cy + span - s.bottom + pad);
    }
    if (Math.abs(dx) + Math.abs(dy) < 1) return true;
    scroller.scrollBy({ left: dx, top: dy, behavior: smooth && !reduceMotion ? "smooth" : "auto" });
    return true;
  }, [layout, zoom, physX, cardW, cardH, reduceMotion]);

  const select = useCallback((key, { fromSearch = false, scroll = "nearest", domFocus = true } = {}) => {
    if (!key || !tree.nodes.has(key)) return;
    setSelected(key);
    setHighlight(fromSearch ? key : "");
    setExpanded((cur) => {
      const path = pathTo(tree, key).slice(0, -1);
      return path.every((k) => cur.has(k)) ? cur : revealPath(cur, tree, key);
    });
    pendingScroll.current = { key, mode: scroll, smooth: true };
    moveDomFocus.current = domFocus;
    if (!embedded && !branches) {
      const params = new URLSearchParams(searchParams);
      if (key === tree.viewerKey) params.delete("focus");
      else params.set("focus", key);
      setSearchParams(params, { replace: true, state: location.state });
    }
  }, [tree, branches, setSelected, setExpanded, embedded, searchParams, setSearchParams, location.state]);

  const toggle = useCallback((key) => {
    setExpanded((cur) => {
      const opening = !cur.has(key);
      if (opening) pendingScroll.current = { key, mode: "team", smooth: true };
      const next = toggleExpanded(cur, key);
      // a branch's count opens its sub-branches and its people together
      if (opening && isBranchKey(key)) {
        const people = branchPeopleKey(key.slice(2));
        if (tree.nodes.has(people)) next.add(people);
      }
      return next;
    });
  }, [setExpanded, tree]);

  const setView = useCallback((next) => {
    if (next === view) return;
    setViewState(next);
    writeStore(VIEW_KEY, next, true);
    setMenu(null);
    setHighlight("");
    setCapNote(false);
    const key = next === "branches" ? selectedB : selectedP;
    pendingScroll.current = key ? { key, mode: "center", smooth: false } : null;
    if (next === "branches" && branchFresh.current) { branchFresh.current = false; pendingFit.current = true; }
    if (!embedded) {
      const params = new URLSearchParams(searchParams);
      if (next === "branches") { params.set("view", "branches"); params.delete("focus"); } else params.delete("view");
      setSearchParams(params, { replace: true, state: location.state });
    }
  }, [view, selectedB, selectedP, embedded, searchParams, setSearchParams, location.state]);

  /* the people view, focused on one person (a branch's manager, a parent's reveal) */
  const focusPerson = useCallback((wanted, { open = false } = {}) => {
    const key = resolveFocusKey(peopleTree, wanted);
    if (!key) return;
    setViewState("people");
    writeStore(VIEW_KEY, "people", true);
    setExpandedP((cur) => {
      const next = revealPath(cur, peopleTree, key);
      if (open && peopleTree.nodes.get(key)?.childKeys.length) next.add(key);
      return next;
    });
    setSelectedP(key);
    setHighlight(key);
    pendingScroll.current = { key, mode: "center", smooth: true };
    if (!embedded) {
      const params = new URLSearchParams(searchParams);
      params.delete("view");
      if (key === peopleTree.viewerKey) params.delete("focus"); else params.set("focus", key);
      setSearchParams(params, { replace: true, state: location.state });
    }
  }, [peopleTree, embedded, searchParams, setSearchParams, location.state]);

  /* a parent asks to show a card (branch search, «وحدة الموارد البشرية») */
  useEffect(() => {
    if (reveal?.key) focusPerson(reveal.key);
  }, [reveal?.nonce]);

  const expandAll = () => {
    if (branches) {
      setExpanded(expandAllBranches(tree));
      setShowAll(new Set());
      setCapNote(false);
      pendingFit.current = true;
      return;
    }
    const res = expandAllKeys(tree, EXPAND_LIMIT);
    setExpanded(res.expanded);
    setShowAll(new Set());
    setCapNote(res.capped);
  };
  const collapseAll = () => {
    setExpanded(new Set());
    setShowAll(new Set());
    setCapNote(false);
    const top = tree.roots[0];
    if (top) { setSelected(top); pendingScroll.current = { key: top, mode: "center", smooth: true }; }
  };
  const backToMe = () => {
    const me = tree.viewerKey || tree.roots[0] || "";
    setExpanded(branches ? defaultBranchExpanded(tree) : defaultExpanded(tree, me));
    setShowAll(new Set());
    setCapNote(false);
    select(me, { scroll: "center" });
  };

  /* keep the sizer as big as the scaled stage so scrolling reaches every edge */
  useLayoutEffect(() => {
    const sizer = sizerRef.current;
    if (!sizer) return;
    sizer.style.width = `${Math.ceil(W * zoom)}px`;
    sizer.style.height = `${Math.ceil(H * zoom)}px`;
  }, [W, H, zoom]);

  /* zoom around a point (wheel / pinch) — the point under the pointer stays put */
  useLayoutEffect(() => {
    const a = zoomAnchor.current;
    zoomAnchor.current = null;
    const scroller = scrollerRef.current;
    const stage = stageRef.current;
    if (!a || !scroller || !stage) return;
    const st = stage.getBoundingClientRect();
    scroller.scrollBy({ left: st.left + a.sx * zoom - a.cx, top: st.top + a.sy * zoom - a.cy, behavior: "auto" });
  }, [zoom]);
  const anchorAt = (clientX, clientY) => {
    const stage = stageRef.current;
    if (!stage) return null;
    const st = stage.getBoundingClientRect();
    const z = zoom || 1;
    return { sx: (clientX - st.left) / z, sy: (clientY - st.top) / z, cx: clientX, cy: clientY };
  };
  const centerAnchor = () => {
    const s = scrollerRef.current?.getBoundingClientRect();
    return s ? anchorAt(s.left + s.width / 2, s.top + s.height / 2) : null;
  };
  const zoomBy = (dir) => setZoom((z) => stepZoom(z, dir), centerAnchor());

  /* after a layout change: scroll to the pending card, move DOM focus there */
  useLayoutEffect(() => {
    const p = pendingScroll.current;
    if (p?.key) {
      if (scrollToKey(p.key, p.mode, p.smooth)) pendingScroll.current = null;
    }
    if (moveDomFocus.current && selected) {
      moveDomFocus.current = false;
      const el = stageRef.current?.querySelector(`[data-k="${CSS.escape(selected)}"] .nv-ot-card__hit`);
      el?.focus({ preventScroll: true });
    }
  }, [layout, selected, scrollToKey]);

  /* announce the selection for screen readers */
  useEffect(() => {
    const f = selected ? chartCard(tree, counts, selected) : null;
    if (!f) return;
    const who = f.vacant ? (ar ? "منصب شاغر" : "Open seat") : f.name;
    if (f.kind === "branch" || f.kind === "people") {
      setAnnounce(`${f.name}${f.title ? `${ar ? "، " : ", "}${f.title}` : ""}.`);
      return;
    }
    setAnnounce(ar
      ? `${who}${f.title ? `، ${f.title}` : ""}. ${f.direct} تحت إدارته مباشرة من ${f.total}.`
      : `${who}${f.title ? `, ${f.title}` : ""}. ${f.direct} direct of ${f.total}.`);
  }, [selected, tree, counts, ar]);

  const fit = () => {
    const scroller = scrollerRef.current;
    if (!scroller || !W || !H) return;
    const cs = getComputedStyle(scroller);
    const availW = scroller.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const availH = scroller.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    setZoom(Math.min(1, availW / W, Math.max(availH, 200) / H));
    requestAnimationFrame(() => scroller.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  };
  // the branches view opens fitted: the whole company on one screen
  useLayoutEffect(() => {
    if (!pendingFit.current || !layout.cards.length) return;
    pendingFit.current = false;
    if (narrow) return; // a phone reads one column at 100%; shrinking it would not fit, only blur
    pendingScroll.current = null;
    fit();
  });

  /* wheel: a mouse wheel notch or a pinch (ctrl) zooms around the pointer; a trackpad scroll pans */
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    const onWheel = (event) => {
      const mouseNotch = event.deltaMode === 1 || (event.deltaX === 0 && Math.abs(event.deltaY) >= 50 && Number.isInteger(event.deltaY));
      if (!event.ctrlKey && !event.metaKey && !mouseNotch) return;
      if (event.shiftKey) return;
      event.preventDefault();
      const factor = event.ctrlKey || event.metaKey
        ? 1 - Math.max(-0.2, Math.min(0.2, event.deltaY * 0.01))
        : (event.deltaY > 0 ? 0.9 : 1.1);
      const stage = stageRef.current;
      if (!stage) return;
      const st = stage.getBoundingClientRect();
      setZoomState((z) => {
        const next = clampZoom(z * factor);
        zoomAnchor.current = { sx: (event.clientX - st.left) / z, sy: (event.clientY - st.top) / z, cx: event.clientX, cy: event.clientY };
        writeStore(ZOOM_KEY, String(next));
        return next;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  /* drag the canvas to pan (mouse); two fingers pinch to zoom (touch) */
  const drag = useRef(null);
  const touches = useRef(new Map());
  const pinch = useRef(null);
  const onPointerDown = (event) => {
    if (event.pointerType === "touch") {
      touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touches.current.size === 2) {
        const [a, b] = [...touches.current.values()];
        pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: zoom };
      }
      return;
    }
    if (event.button !== 0) return;
    if (event.target.closest("button, a, input, [role='dialog'], [role='menu'], .nv-ot-card, .nv-ot-mini")) return;
    const el = scrollerRef.current;
    drag.current = { x: event.clientX, y: event.clientY, left: el.scrollLeft, top: el.scrollTop, id: event.pointerId };
    el.setPointerCapture?.(event.pointerId);
    el.dataset.drag = "1";
  };
  const onPointerMove = (event) => {
    if (event.pointerType === "touch") {
      if (!touches.current.has(event.pointerId)) return;
      touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pinch.current && touches.current.size === 2) {
        const [a, b] = [...touches.current.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const mid = anchorAt((a.x + b.x) / 2, (a.y + b.y) / 2);
        setZoom(pinch.current.z * (d / pinch.current.d), mid);
      }
      return;
    }
    const d = drag.current;
    if (!d) return;
    const el = scrollerRef.current;
    el.scrollLeft = d.left - (event.clientX - d.x);
    el.scrollTop = d.top - (event.clientY - d.y);
  };
  const endDrag = (event) => {
    if (event?.pointerType === "touch") {
      touches.current.delete(event.pointerId);
      if (touches.current.size < 2) pinch.current = null;
      return;
    }
    const el = scrollerRef.current;
    if (drag.current && el) {
      el.releasePointerCapture?.(drag.current.id);
      delete el.dataset.drag;
    }
    drag.current = null;
  };

  const onKeyDown = (event) => {
    if (details || settingsOpen || downloadOpen || menu) return;
    const tag = String(event.target?.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "+" || event.key === "=") { event.preventDefault(); zoomBy(1); return; }
    if (event.key === "-" || event.key === "_") { event.preventDefault(); zoomBy(-1); return; }
    if (event.key === "0") { event.preventDefault(); setZoom(1, centerAnchor()); return; }
    const key = selected;
    if (!key || !tree.nodes.has(key)) return;
    const node = tree.nodes.get(key);
    if (event.key === "Enter" && event.target?.classList?.contains("nv-ot-card__hit")) {
      event.preventDefault();
      if (node.childKeys.length) toggle(key);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setHighlight("");
      if (expanded.has(key) && node.childKeys.length) toggle(key);
      else if (node.parentKey) select(node.parentKey);
      return;
    }
    const map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: ar ? "next" : "prev", ArrowRight: ar ? "prev" : "next" };
    const dir = map[event.key];
    if (!dir) return;
    event.preventDefault();
    if (dir === "down") {
      const first = orderKeys(tree, node.childKeys)[0];
      if (!first) return;
      if (!expanded.has(key)) setExpanded((cur) => toggleExpanded(cur, key));
      select(first);
      return;
    }
    const next = focusMove(tree, key, dir);
    if (next && layout.index.has(next)) select(next);
  };

  /* minimap: the whole chart in a corner, the visible part as a frame; click to go there */
  const [frame, setFrame] = useState(null);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setOverflows(W * zoom > el.clientWidth - 40 || H * zoom > el.clientHeight - 40);
  }, [W, H, zoom]);
  const showMini = !narrow && !embedded && overflows && layout.cards.length > 8;
  useEffect(() => {
    if (!showMini) return undefined;
    const el = scrollerRef.current;
    if (!el) return undefined;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const stage = stageRef.current;
        if (!stage) return;
        const s = el.getBoundingClientRect();
        const st = stage.getBoundingClientRect();
        const z = zoom || 1;
        setFrame({ x: (s.left - st.left) / z, y: (s.top - st.top) / z, w: s.width / z, h: s.height / z });
      });
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    const late = window.setTimeout(measure, 400);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      window.clearTimeout(late);
    };
  }, [showMini, zoom, W, H]);
  const miniGo = (event) => {
    const svgEl = event.currentTarget;
    const r = svgEl.getBoundingClientRect();
    const px = ((event.clientX - r.left) / r.width) * W;
    const py = ((event.clientY - r.top) / r.height) * H;
    const scroller = scrollerRef.current;
    const stage = stageRef.current;
    if (!scroller || !stage) return;
    const s = scroller.getBoundingClientRect();
    const st = stage.getBoundingClientRect();
    scroller.scrollBy({ left: st.left + px * zoom - (s.left + s.width / 2), top: st.top + py * zoom - (s.top + s.height / 2), behavior: reduceMotion ? "auto" : "smooth" });
  };

  /* download: print / PDF of the chart, or a PNG of the current view */
  const print = () => {
    setDownloadOpen(false);
    window.setTimeout(() => window.print(), 50);
  };
  const savePng = async () => {
    const stage = stageRef.current;
    if (!stage) return;
    setDownloadOpen(false);
    setBusy(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const bg = getComputedStyle(scrollerRef.current).backgroundColor || "#ffffff";
      const canvas = await html2canvas(stage, {
        scale: 2,
        backgroundColor: bg,
        logging: false,
        useCORS: true,
        onclone: (doc) => {
          const clone = doc.querySelector(".nv-ot-stage");
          if (clone) clone.style.transform = "none";
          // html2canvas splits joined Arabic letters when letter-spacing is set
          doc.querySelectorAll(".nv-ot-stage *").forEach((node) => { node.style.letterSpacing = "0"; node.style.transition = "none"; node.style.animation = "none"; });
        },
      });
      const link = document.createElement("a");
      const who = (selected && tree.nodes.get(selected)?.name) || "org";
      link.download = `${ar ? "الهيكل" : "org-chart"}-${who}.png`.replace(/\s+/g, "-");
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setBusy(false);
    }
  };

  /* drawers */
  const hrDrawer = scope === "all";
  const chartNode = useMemo(() => {
    if (!hrDrawer || !details?.vacant) return null;
    const flat = buildWorkforceSeatChart(data, { ar }).flat;
    return flat.find((node) => (details.seatId && node.seatId === details.seatId) || node.id === details.id) || null;
  }, [hrDrawer, details, data, ar]);
  const employee = hrDrawer && details?.employeeId
    ? (data?.employees || []).find((row) => String(row.id) === String(details.employeeId)) || null
    : null;

  /* the «⋯» menu */
  const closeMenu = useCallback(() => setMenu(null), []);
  const menuActions = !menu ? [] : menu.card.kind === "branch"
    ? orgBranchActions(menu.card, { data, canWrite: hrDrawer && canWrite })
    : orgCardActions(menu.card, { data, user, canWrite: hrDrawer && canWrite, health: health.get(menu.card.key) });
  const runAction = (id, target = null) => {
    const card = target || menu?.card;
    setMenu(null);
    if (!card) return;
    if (id === "file") { setDetails(card); return; }
    if (id === "people") { focusPerson(card.managerKey, { open: true }); return; }
    if (id === "hireManager") { onHire?.({ stationId: card.stationId || "", seatId: card.managerSeatId || "" }); return; }
    if (id === "hire") { onHire?.({ stationId: card.stationId || "", seatId: card.seatId || "" }); return; }
    if (onAction?.(id, card)) return;
    const href = orgAdminHref(id, card);
    if (href) navigate(href, { state: { from: `${location.pathname}${location.search}` } });
  };

  const openFull = () => {
    const params = new URLSearchParams();
    if (branches) params.set("view", "branches");
    else if (selected && selected !== tree.viewerKey) params.set("focus", selected);
    navigate(`/app/org/chart${params.toString() ? `?${params}` : ""}`, { state: { from: `${location.pathname}${location.search}` } });
  };

  const zoomPct = `${Math.round(zoom * 100)}%`;
  const back = onBack ? (
    <button type="button" className="nv-ot-back" onClick={onBack}>
      <span className="nv-ot-back__icon" aria-hidden>{Icon.back}</span>
      <span>{backLabel || (ar ? "رجوع" : "Back")}</span>
    </button>
  ) : null;

  const topBar = (
    <header className="nv-ot-bar">
      {embedded ? null : back}
      {embedded ? null : (
        <span className="nv-ot-title">
          <span className="nv-ot-title__kicker">{ar ? "القوى العاملة" : "Workforce"}</span>
          <b>{ar ? "المخطط التنظيمي" : "Org chart"}</b>
        </span>
      )}
      <div className="nv-ot-switch" role="radiogroup" aria-label={ar ? "طريقة العرض" : "View"}>
        {[["people", ar ? "الأشخاص" : "People"], ["branches", ar ? "الفروع" : "Branches"]].map(([value, label]) => (
          <button key={value} type="button" role="radio" aria-checked={view === value} onClick={() => setView(value)}>{label}</button>
        ))}
      </div>
      <TreeSearch ar={ar} tree={tree} onPick={(key) => select(key, { fromSearch: true, scroll: "center" })} />
      <div className="nv-ot-tools nv-ot-tools--text" role="group" aria-label={ar ? "الفروع" : "Branches"}>
        <button type="button" className="nv-ot-tool nv-ot-tool--label" onClick={expandAll}>{ar ? "توسيع الكل" : "Expand all"}</button>
        <button type="button" className="nv-ot-tool nv-ot-tool--label" onClick={collapseAll}>{ar ? "طيّ الكل" : "Collapse all"}</button>
        {tree.viewerKey ? (
          <button type="button" className="nv-ot-tool nv-ot-tool--label" onClick={backToMe}>{branches ? (ar ? "فرعي" : "My branch") : (ar ? "إعادة للتركيز عليّ" : "Back to me")}</button>
        ) : null}
      </div>
      <span className="nv-ot-bar__fill" />
      <div className="nv-ot-tools" role="toolbar" aria-label={ar ? "أدوات المخطط" : "Chart tools"}>
        <button type="button" className="nv-ot-tool" onClick={() => zoomBy(-1)} aria-label={ar ? "تصغير" : "Zoom out"} title={ar ? "تصغير" : "Zoom out"}>{Icon.minus}</button>
        <button type="button" className="nv-ot-tool nv-ot-tool--pct" onClick={() => setZoom(1, centerAnchor())} aria-label={ar ? `التكبير ${zoomPct} — اضغط للعودة إلى 100%` : `Zoom ${zoomPct} — reset to 100%`} title="100%">{zoomPct}</button>
        <button type="button" className="nv-ot-tool" onClick={() => zoomBy(1)} aria-label={ar ? "تكبير" : "Zoom in"} title={ar ? "تكبير" : "Zoom in"}>{Icon.plus}</button>
        <button type="button" className="nv-ot-tool" onClick={fit} aria-label={ar ? "ملاءمة المخطط للشاشة" : "Fit to screen"} title={ar ? "ملاءمة" : "Fit"}>{Icon.fit}</button>
        <span className="nv-ot-tools__sep" aria-hidden />
        {embedded ? (
          <button type="button" className="nv-ot-tool" onClick={openFull} aria-label={ar ? "شاشة كاملة" : "Full screen"} title={ar ? "شاشة كاملة" : "Full screen"}>{Icon.full}</button>
        ) : null}
        <div className="nv-ot-anchor">
          <button
            ref={downloadBtn}
            type="button"
            className="nv-ot-tool"
            aria-haspopup="dialog"
            aria-expanded={downloadOpen}
            aria-label={ar ? "تنزيل" : "Download"}
            title={ar ? "تنزيل" : "Download"}
            disabled={busy}
            onClick={() => { setDownloadOpen((v) => !v); setSettingsOpen(false); }}
          >
            {Icon.download}
          </button>
          <Popover open={downloadOpen} onClose={() => setDownloadOpen(false)} label={ar ? "تنزيل" : "Download"} anchorRef={downloadBtn}>
            <button type="button" className="nv-ot-pop__item" onClick={print}>{ar ? "طباعة أو حفظ PDF" : "Print or save as PDF"}</button>
            <button type="button" className="nv-ot-pop__item" onClick={savePng}>{ar ? "تنزيل صورة PNG للعرض الحالي" : "Download PNG of this view"}</button>
          </Popover>
        </div>
        <div className="nv-ot-anchor">
          <button
            ref={settingsBtn}
            type="button"
            className="nv-ot-tool"
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
            aria-label={ar ? "خيارات البطاقة" : "Card options"}
            title={ar ? "خيارات البطاقة" : "Card options"}
            onClick={() => { setSettingsOpen((v) => !v); setDownloadOpen(false); }}
          >
            {Icon.gear}
          </button>
          <Popover open={settingsOpen} onClose={() => setSettingsOpen(false)} label={ar ? "خيارات البطاقة" : "Card options"} anchorRef={settingsBtn}>
            <p className="nv-ot-pop__head">{ar ? "ما تعرضه البطاقة" : "Show on cards"}</p>
            {[
              ["counts", ar ? "الأعداد (مباشر / الكل)" : "Counts (direct / total)"],
              ["unit", ar ? "الوحدة" : "Unit"],
              ["seatCode", ar ? "رمز المنصب" : "Seat code"],
            ].map(([key, label]) => (
              <label key={key} className="nv-ot-pop__check">
                <input type="checkbox" checked={options[key]} onChange={(event) => setOption(key, event.target.checked)} />
                <span>{label}</span>
              </label>
            ))}
            <p className="nv-ot-pop__head">{ar ? "الكثافة" : "Density"}</p>
            <div className="nv-ot-seg" role="radiogroup" aria-label={ar ? "الكثافة" : "Density"}>
              {[["comfortable", ar ? "مريحة" : "Comfortable"], ["compact", ar ? "مدمجة" : "Compact"]].map(([value, label]) => (
                <button key={value} type="button" role="radio" aria-checked={options.density === value} onClick={() => setOption("density", value)}>{label}</button>
              ))}
            </div>
          </Popover>
        </div>
      </div>
    </header>
  );

  /* a viewer with no seat on the chart: say where they belong, calmly */
  if (!layout.cards.length && !branches) {
    const place = user?.id ? unseatedPlace(data, user.id) : null;
    return (
      <div className="nv-ot" data-variant={variant}>
        {topBar}
        <div className="nv-ot-empty">
          <h1>{place?.name || (ar ? "مكانك في الهيكل" : "Your place")}</h1>
          <p>{ar ? "الوحدة" : "Unit"}: <b>{place?.unit || "—"}</b> · {ar ? "المدير" : "Manager"}: <b>{place?.managerName || "—"}</b></p>
          <p className="nv-ot-empty__note">
            {ar
              ? "لم يُربط ملفك بمنصب في الهيكل بعد، لذلك لا تظهر بطاقتك هنا. حين تربطه الموارد البشرية بمنصب يفتح المخطط على بطاقتك."
              : "Your file is not linked to a seat yet, so your card is not on the chart. Once HR links it, the chart opens on your card."}
          </p>
        </div>
      </div>
    );
  }

  const crumbs = selected && tree.nodes.has(selected) ? pathTo(tree, selected) : [];
  const hasMenu = hrDrawer && canWrite;
  const printScale = W ? Math.min(1, 1040 / W) : 1;
  const miniScale = showMini ? Math.min(160 / W, 132 / H) : 0;

  return (
    <div className="nv-ot" data-variant={variant} data-density={options.density} data-narrow={narrow ? "1" : "0"} data-motion={reduceMotion ? "0" : "1"}>
      {topBar}
      {crumbs.length > 1 || capNote ? (
        <nav className="nv-ot-crumbs" aria-label={ar ? "مسار البطاقة المحددة" : "Path to the selected card"}>
          <ol>
            {crumbs.map((k, i) => {
              const n = tree.nodes.get(k);
              const last = i === crumbs.length - 1;
              return (
                <li key={k}>
                  <button type="button" aria-current={last ? "true" : undefined} onClick={() => select(k, { scroll: "center" })}>
                    {n.vacant ? (ar ? "شاغر" : "Vacant") : n.name}
                  </button>
                </li>
              );
            })}
          </ol>
          {capNote ? (
            <span className="nv-ot-crumbs__note">
              {ar ? `فُتح حتى ${EXPAND_LIMIT} بطاقة — افتح ما بعدها من الأرقام.` : `Opened up to ${EXPAND_LIMIT} cards — open the rest from the counts.`}
            </span>
          ) : null}
        </nav>
      ) : null}
      <div
        ref={scrollerRef}
        className="nv-ot-scroller"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        aria-label={ar ? "المخطط التنظيمي" : "Org chart"}
        role="region"
      >
        {branches && !layout.cards.length ? (
          <p className="nv-ot-none">
            {scope === "all"
              ? (ar ? "لا فروع بعد — أضف فرعاً من «الفروع والدليل»." : "No branches yet — add one from Branches & directory.")
              : (ar ? "لم يُربط ملفك بفرع بعد." : "Your file is not linked to a branch yet.")}
          </p>
        ) : null}
        <div ref={sizerRef} className="nv-ot-sizer">
          <div
            ref={stageRef}
            className="nv-ot-stage"
            role="tree"
            aria-label={ar ? "شجرة الهيكل" : "Structure tree"}
            style={{
              width: `${W}px`,
              height: `${H}px`,
              "--print-scale": printScale,
              transform: zoom === 1 ? undefined : `scale(${zoom})`,
            }}
          >
            {layout.lines.map((line) => (
              <span
                key={line.id}
                className="nv-ot-line"
                data-dir={line.h ? "v" : "h"}
                aria-hidden
                style={line.h
                  ? { left: physX(line.x) - 0.75, top: line.y, height: line.h }
                  : { left: physX(line.x, line.w), top: line.y - 0.75, width: line.w }}
              />
            ))}
            {layout.cards.map((place) => {
              const at = { ...place, left: physX(place.x, cardW) };
              if (place.more || place.less) {
                return (
                  <FoldCard
                    key={place.key}
                    place={at}
                    ar={ar}
                    w={cardW}
                    h={cardH}
                    onClick={() => setShowAll((cur) => toggleExpanded(cur, place.parentKey))}
                  />
                );
              }
              const node = tree.nodes.get(place.key);
              if (node.kind === "branch" || node.kind === "people") {
                return (
                  <BranchCard
                    key={place.key}
                    node={node}
                    place={at}
                    ar={ar}
                    w={cardW}
                    h={cardH}
                    isFocus={place.key === selected}
                    highlighted={highlight === place.key}
                    hasMenu={hasMenu}
                    menuOpen={menu?.card.key === place.key}
                    onSelect={(key) => select(key, { scroll: "nearest" })}
                    onToggle={toggle}
                    onOpen={(n) => runAction("branch", n)}
                    onMenu={(c, anchor) => setMenu((cur) => (cur?.card.key === c.key ? null : { card: c, anchor }))}
                  />
                );
              }
              const card = chartCard(tree, counts, place.key);
              return (
                <TreeCard
                  key={place.key}
                  card={card}
                  place={at}
                  ar={ar}
                  options={options}
                  w={cardW}
                  h={cardH}
                  isFocus={place.key === selected}
                  highlighted={highlight === place.key}
                  flag={health.get(place.key)?.flag || null}
                  hasMenu={hasMenu}
                  menuOpen={menu?.card.key === place.key}
                  onSelect={(key) => select(key, { scroll: "nearest" })}
                  onToggle={toggle}
                  onDetails={setDetails}
                  onMenu={(c, anchor) => setMenu((cur) => (cur?.card.key === c.key ? null : { card: c, anchor }))}
                />
              );
            })}
          </div>
        </div>
      </div>

      {showMini && frame ? (
        <div className="nv-ot-mini" aria-hidden>
          <svg width={Math.round(W * miniScale)} height={Math.round(H * miniScale)} viewBox={`0 0 ${W} ${H}`} onClick={miniGo}>
            {layout.cards.map((c) => (
              <rect key={c.key} x={physX(c.x, cardW)} y={c.y} width={cardW} height={cardH} rx="14" data-focus={c.key === selected ? "1" : "0"} />
            ))}
            <rect className="nv-ot-mini__frame" x={Math.max(0, frame.x)} y={Math.max(0, frame.y)} width={Math.min(W, frame.w)} height={Math.min(H, frame.h)} />
          </svg>
        </div>
      ) : null}

      {embedded || narrow ? null : (
        <p className="nv-ot-keys" aria-hidden>
          {ar ? "↑ ↓ ← → تنقّل · Enter يفتح الفريق · Esc يطوي · + − تكبير · اسحب للتحريك" : "Arrows move · Enter opens the team · Esc folds · + − zoom · drag to pan"}
        </p>
      )}
      <p className="nv-ot-sr" aria-live="polite">{announce}</p>

      {menu ? (
        <CardMenu ar={ar} card={menu.card} anchor={menu.anchor} actions={menuActions} onPick={runAction} onClose={closeMenu} />
      ) : null}

      {details && !hrDrawer ? (
        <OrgCardDrawer
          ar={ar}
          card={details}
          manager={deriveFocusNeighborhood(tree, details.key)?.manager || null}
          data={data}
          user={user}
          companyId={companyId}
          onClose={() => setDetails(null)}
        />
      ) : null}
      {hrDrawer ? (
        <OrgEmployeePreview
          open={Boolean(details && (employee || chartNode))}
          employee={employee}
          vacantNode={employee ? null : chartNode}
          data={data}
          companyId={companyId}
          canWrite={canWrite}
          companyName={data?.settings?.companyName || ""}
          ar={ar}
          onHire={onHire}
          onOpenBranch={onAction ? (stationId) => { setDetails(null); onAction("branch", { stationId }); } : undefined}
          onClose={() => setDetails(null)}
        />
      ) : null}
    </div>
  );
}
