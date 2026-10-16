import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import {
  buildOrgFocusTree,
  deriveFocusNeighborhood,
  focusMove,
  resolveFocusKey,
  searchFocusTree,
  unseatedPlace,
} from "@/lib/orgFocus";
import {
  TREE_GEOMETRY,
  clampZoom,
  countLine,
  deriveTreeView,
  gridWidth,
  readTreeOptions,
  stepZoom,
  treeCounts,
} from "@/lib/orgTreeLayout";
import { buildWorkforceSeatChart } from "@/lib/workforceSeatChart";
import { todayKey } from "@/lib/orgDesign";
import OrgEmployeePreview from "@/components/hr/OrgEmployeePreview";
import OrgCardDrawer from "./OrgCardDrawer";
import { initialsOf } from "./orgDesignUi";
import "./orgTree.css";

const OPTIONS_KEY = "nv-org-tree-options";
const ZOOM_KEY = "nv-org-tree-zoom";
const EASE = "cubic-bezier(.2,.8,.2,1)";

function readStore(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function writeStore(key, value) {
  try { window.localStorage.setItem(key, value); } catch { /* private window: settings stay for this visit */ }
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
const Icon = {
  back: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 6l6 6-6 6" /></svg>
  ),
  search: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>
  ),
  minus: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M5 12h14" /></svg>),
  plus: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M5 12h14M12 5v14" /></svg>),
  download: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
  ),
  gear: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  ),
  card: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="9" cy="11" r="2" /><path d="M6 16c.6-1.4 1.7-2 3-2s2.4.6 3 2M14.5 10h3.5M14.5 13.5h3.5" />
    </svg>
  ),
  person: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden><circle cx="12" cy="8.5" r="3.5" /><path d="M5 19.5c1.3-3.2 3.9-4.8 7-4.8s5.7 1.6 7 4.8" /></svg>
  ),
  chevL: (<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M15 5L8 12l7 7z" /></svg>),
  chevR: (<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M9 5l7 7-7 7z" /></svg>),
};

/* ── one card ─────────────────────────────────────────────────── */
function TreeCard({ card, ar, options, isFocus, highlighted, onFocus, onDetails, cardRef }) {
  const name = card.vacant ? (ar ? "شاغر" : "Vacant") : (card.name || "—");
  const counts = options.counts ? countLine(card, ar) : "";
  const matrix = options.counts && card.matrix ? `${ar ? Number(card.matrix).toLocaleString("ar-SA") : card.matrix} ${ar ? "مصفوفة" : "Matrix"}` : "";
  const label = [
    name,
    card.title,
    options.unit ? card.unit : "",
    counts ? (ar ? `${card.direct} مباشر من ${card.total}` : `${card.direct} direct of ${card.total}`) : "",
    card.isMe ? (ar ? "أنت" : "you") : "",
  ].filter(Boolean).join("، ");
  return (
    <article
      className="nv-ot-card"
      data-k={card.key}
      data-focus={isFocus ? "1" : "0"}
      data-vacant={card.vacant ? "1" : "0"}
      data-me={card.isMe ? "1" : "0"}
    >
      <button
        ref={cardRef}
        type="button"
        className="nv-ot-card__hit"
        data-key={card.key}
        aria-current={isFocus ? "true" : undefined}
        aria-label={label}
        onClick={() => (isFocus ? onDetails(card) : onFocus(card.key))}
      >
        <span className="nv-ot-avatar" aria-hidden>
          {card.avatarUrl ? <img src={card.avatarUrl} alt="" loading="lazy" /> : card.vacant ? Icon.person : initialsOf(card.name)}
        </span>
        <span className="nv-ot-card__text">
          <span className="nv-ot-card__name">
            {highlighted ? <mark>{name}</mark> : name}
            {card.isMe ? <span className="nv-ot-me">{ar ? "أنت" : "You"}</span> : null}
          </span>
          {card.title ? <span className="nv-ot-card__title">{card.title}</span> : null}
          {options.unit && card.unit ? <span className="nv-ot-card__meta">{card.unit}</span> : null}
          {options.seatCode && card.seatCode ? <span className="nv-ot-code" dir="ltr">{card.seatCode}</span> : null}
          {counts || matrix ? (
            <span className="nv-ot-card__counts">
              {counts ? <span dir="ltr">{counts}</span> : null}
              {counts && matrix ? <span aria-hidden> · </span> : null}
              {matrix ? <span>{matrix}</span> : null}
            </span>
          ) : null}
        </span>
      </button>
      <button
        type="button"
        className="nv-ot-card__open"
        onClick={() => onDetails(card)}
        aria-label={ar ? `بطاقة ${name}` : `${name} card`}
        title={ar ? "بطاقة" : "Card"}
      >
        {Icon.card}
      </button>
    </article>
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
        className="nv-ot-search__input"
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

/**
 * The whole org tree with one focus — full screen, SAP-style structure in NiroVera's identity.
 *
 * The chain from the top of the structure to the focused card runs down one column; beside each
 * chain card sit its siblings (the others under the same manager) as a grid; under the focus sit
 * its direct reports. Any card becomes the focus (?focus=<seatId>, back/forward walk the history);
 * cards glide to their new places (FLIP), new ones fade in; prefers-reduced-motion turns it off.
 * Keys on the chart: ↑ manager · ↓ first report · ←/→ sibling · +/− zoom.
 *
 * scope "all" (HR/owner) reads the whole tree and opens the seat card with its actions;
 * scope "mine" receives a pruned tree — chain, peers, own subtree — and a read-only card.
 */
export default function OrgTreeChart({ ar, data, user, companyId, scope = "mine", canWrite = false, onHire, onBack, backLabel = "" }) {
  const day = todayKey();
  const tree = useMemo(
    () => buildOrgFocusTree(data, { viewerId: user?.id || "", scope, ar, day }),
    [data, user?.id, scope, ar, day],
  );
  const counts = useMemo(() => treeCounts(tree), [tree]);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const focusKey = resolveFocusKey(tree, searchParams.get("focus") || "");

  const narrow = useMedia("(max-width: 760px)");
  const twoCols = useMedia("(min-width: 520px)");
  const reduceMotion = useMedia("(prefers-reduced-motion: reduce)");

  const [options, setOptions] = useState(() => readTreeOptions(readStore(OPTIONS_KEY)));
  const [zoom, setZoomState] = useState(() => clampZoom(readStore(ZOOM_KEY) || 1));
  const setZoom = useCallback((next) => {
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
  const [openLevels, setOpenLevels] = useState(() => new Set());
  const [details, setDetails] = useState(null);
  const [highlight, setHighlight] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [edges, setEdges] = useState({ left: false, right: false });

  const scrollerRef = useRef(null);
  const stageRef = useRef(null);
  const sizerRef = useRef(null);
  const settingsBtn = useRef(null);
  const downloadBtn = useRef(null);
  const positions = useRef(new Map());
  const lastFocus = useRef("");
  const moveDomFocus = useRef(false);

  const compact = options.density === "compact";
  const cardW = compact ? TREE_GEOMETRY.compactCardW : TREE_GEOMETRY.cardW;
  const { gap, colGap } = TREE_GEOMETRY;
  const chainW = cardW + 16;
  const maxCols = narrow ? (twoCols ? 2 : 1) : TREE_GEOMETRY.maxCols;

  const view = useMemo(
    () => (focusKey ? deriveTreeView(tree, focusKey, { counts, siblingLimit: narrow ? 0 : 8, openLevels, maxCols }) : null),
    [tree, focusKey, counts, narrow, openLevels, maxCols],
  );

  // a new focus folds the sibling grids opened for the previous one
  useEffect(() => { setOpenLevels(new Set()); }, [focusKey]);

  const setFocus = useCallback((key, { fromSearch = false } = {}) => {
    if (!key) return;
    moveDomFocus.current = true;
    setHighlight(fromSearch ? key : "");
    if (key === focusKey) return;
    const params = new URLSearchParams(searchParams);
    if (key === tree.viewerKey) params.delete("focus");
    else params.set("focus", key);
    setSearchParams(params, { state: location.state }); // push: back/forward walk the focus history
  }, [focusKey, searchParams, setSearchParams, tree.viewerKey, location.state]);

  /* stage width at 100% — the chain column sits at the inline end; grids reach toward the start */
  const stageW = useMemo(() => {
    if (!view || narrow) return 0;
    let w = chainW;
    view.levels.forEach((level) => {
      const n = level.siblings.length + (level.hidden ? 1 : 0);
      if (n) w = Math.max(w, chainW + colGap + gridWidth(Math.min(maxCols, n), { cardW, gap }));
    });
    if (view.reports.length) w = Math.max(w, gridWidth(view.reportCols, { cardW, gap }));
    return w;
  }, [view, narrow, chainW, colGap, maxCols, cardW, gap]);

  /* keep the sizer as big as the scaled stage so scrolling reaches every edge */
  useLayoutEffect(() => {
    const stage = stageRef.current;
    const sizer = sizerRef.current;
    if (!stage || !sizer) return undefined;
    const fit = () => {
      sizer.style.width = narrow ? "100%" : `${Math.ceil(stage.offsetWidth * zoom)}px`;
      sizer.style.height = `${Math.ceil(stage.offsetHeight * zoom)}px`;
    };
    fit();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(fit);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [zoom, narrow, stageW]);

  /* FLIP: measure where every card is now, glide it from where it was, fade in the new ones */
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage || !view) return;
    const base = stage.getBoundingClientRect();
    const z = zoom || 1;
    const next = new Map();
    const moves = [];
    stage.querySelectorAll("[data-k]").forEach((el) => {
      const r = el.getBoundingClientRect();
      const p = { x: (r.left - base.left) / z, y: (r.top - base.top) / z };
      next.set(el.dataset.k, p);
      moves.push([el, p]);
    });
    const focusChanged = lastFocus.current !== focusKey;
    const first = !lastFocus.current;
    const animate = !reduceMotion && !first && positions.current.size > 0;
    const prev = positions.current;
    positions.current = next;
    lastFocus.current = focusKey;

    // bring the focus into view before anything starts moving (scroll targets the final place)
    const focusEl = stage.querySelector(`[data-k="${CSS.escape(focusKey)}"]`);
    if (focusChanged && focusEl) {
      focusEl.scrollIntoView({ block: narrow ? "start" : "center", inline: "center", behavior: first || reduceMotion ? "auto" : "smooth" });
    }
    if (moveDomFocus.current) {
      moveDomFocus.current = false;
      focusEl?.querySelector(".nv-ot-card__hit")?.focus({ preventScroll: true });
    }
    if (!animate) return;
    let fresh = 0;
    moves.forEach(([el, p]) => {
      if (typeof el.animate !== "function") return;
      const old = prev.get(el.dataset.k);
      if (old) {
        const dx = old.x - p.x;
        const dy = old.y - p.y;
        if (Math.abs(dx) + Math.abs(dy) < 1) return;
        el.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
          { duration: 320, easing: EASE },
        );
      } else if (focusChanged || prev.size) {
        el.animate(
          [{ opacity: 0, transform: "translateY(10px) scale(.98)" }, { opacity: 1, transform: "none" }],
          { duration: 280, easing: EASE, delay: Math.min(fresh * 14, 160), fill: "backwards" },
        );
        fresh += 1;
      }
    });
  }, [view, zoom, options, narrow, focusKey, reduceMotion]);

  /* announce the focus for screen readers */
  useEffect(() => {
    if (!view) return;
    const f = view.focus;
    const who = f.vacant ? (ar ? "منصب شاغر" : "Open seat") : f.name;
    setAnnounce(ar
      ? `التركيز على ${who}${f.title ? `، ${f.title}` : ""}. ${f.direct} تحت إدارته مباشرة من ${f.total}.`
      : `Focused on ${who}${f.title ? `, ${f.title}` : ""}. ${f.direct} direct of ${f.total}.`);
  }, [focusKey]);

  /* side arrows: show only when there is more to the left / right */
  const measureEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 2) { setEdges((e) => (e.left || e.right ? { left: false, right: false } : e)); return; }
    const rtl = getComputedStyle(el).direction === "rtl";
    // modern browsers: rtl scrollLeft runs 0 → −max
    const fromLeft = rtl ? max + el.scrollLeft : el.scrollLeft;
    const next = { left: fromLeft > 2, right: fromLeft < max - 2 };
    setEdges((e) => (e.left === next.left && e.right === next.right ? e : next));
  }, []);
  useEffect(() => {
    measureEdges();
    const el = scrollerRef.current;
    if (!el) return undefined;
    el.addEventListener("scroll", measureEdges, { passive: true });
    window.addEventListener("resize", measureEdges);
    const id = window.setTimeout(measureEdges, 400);
    return () => {
      el.removeEventListener("scroll", measureEdges);
      window.removeEventListener("resize", measureEdges);
      window.clearTimeout(id);
    };
  }, [measureEdges, view, zoom]);
  const pan = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.6, behavior: reduceMotion ? "auto" : "smooth" });
  };

  /* ctrl/⌘ + wheel (and trackpad pinch) zooms; a plain wheel scrolls */
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    const onWheel = (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom((z) => z * (1 - Math.max(-0.2, Math.min(0.2, event.deltaY * 0.004))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setZoom]);

  /* drag the empty canvas to pan (mouse); touch scrolls natively */
  const drag = useRef(null);
  const onPointerDown = (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    if (event.target.closest("button, a, input, [role='dialog'], .nv-ot-card")) return;
    const el = scrollerRef.current;
    drag.current = { x: event.clientX, y: event.clientY, left: el.scrollLeft, top: el.scrollTop, id: event.pointerId };
    el.setPointerCapture?.(event.pointerId);
    el.dataset.drag = "1";
  };
  const onPointerMove = (event) => {
    const d = drag.current;
    if (!d) return;
    const el = scrollerRef.current;
    el.scrollLeft = d.left - (event.clientX - d.x);
    el.scrollTop = d.top - (event.clientY - d.y);
  };
  const endDrag = () => {
    const el = scrollerRef.current;
    if (drag.current && el) {
      el.releasePointerCapture?.(drag.current.id);
      delete el.dataset.drag;
    }
    drag.current = null;
  };

  const onKeyDown = (event) => {
    if (details || settingsOpen || downloadOpen) return;
    const tag = String(event.target?.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "+" || event.key === "=") { event.preventDefault(); setZoom((z) => stepZoom(z, 1)); return; }
    if (event.key === "-" || event.key === "_") { event.preventDefault(); setZoom((z) => stepZoom(z, -1)); return; }
    if (event.key === "0") { event.preventDefault(); setZoom(1); return; }
    const map = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: ar ? "next" : "prev",
      ArrowRight: ar ? "prev" : "next",
    };
    const dir = map[event.key];
    if (!dir || !focusKey) return;
    event.preventDefault();
    const next = focusMove(tree, focusKey, dir);
    if (next) setFocus(next);
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
          doc.querySelectorAll(".nv-ot-stage *").forEach((node) => { node.style.letterSpacing = "0"; });
        },
      });
      const link = document.createElement("a");
      const who = view?.focus?.name || "org";
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

  const zoomPct = `${ar ? Math.round(zoom * 100).toLocaleString("ar-SA") : Math.round(zoom * 100)}${ar ? "٪" : "%"}`;
  const back = onBack ? (
    <button type="button" className="nv-ot-back" onClick={onBack}>
      <span className="nv-ot-back__icon" aria-hidden>{Icon.back}</span>
      <span>{backLabel || (ar ? "رجوع" : "Back")}</span>
    </button>
  ) : null;

  const topBar = (
    <header className="nv-ot-bar">
      {back}
      <TreeSearch ar={ar} tree={tree} onPick={(key) => setFocus(key, { fromSearch: true })} />
      {tree.viewerKey && focusKey !== tree.viewerKey ? (
        <button type="button" className="nv-ot-tool nv-ot-tool--text" onClick={() => setFocus(tree.viewerKey)}>
          {ar ? "عودة إليّ" : "Back to me"}
        </button>
      ) : null}
      <span className="nv-ot-bar__fill" />
      <div className="nv-ot-tools" role="toolbar" aria-label={ar ? "أدوات المخطط" : "Chart tools"}>
        <button type="button" className="nv-ot-tool" onClick={() => setZoom((z) => stepZoom(z, -1))} aria-label={ar ? "تصغير" : "Zoom out"} title={ar ? "تصغير" : "Zoom out"}>{Icon.minus}</button>
        <button type="button" className="nv-ot-tool nv-ot-tool--pct" onClick={() => setZoom(1)} aria-label={ar ? `التكبير ${zoomPct} — اضغط للعودة إلى ١٠٠٪` : `Zoom ${zoomPct} — reset to 100%`} title={ar ? "١٠٠٪" : "100%"}>{zoomPct}</button>
        <button type="button" className="nv-ot-tool" onClick={() => setZoom((z) => stepZoom(z, 1))} aria-label={ar ? "تكبير" : "Zoom in"} title={ar ? "تكبير" : "Zoom in"}>{Icon.plus}</button>
        <span className="nv-ot-tools__sep" aria-hidden />
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
  if (!view) {
    const place = user?.id ? unseatedPlace(data, user.id) : null;
    return (
      <div className="nv-ot">
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

  const cardProps = (card) => ({
    card,
    ar,
    options,
    isFocus: card.key === focusKey,
    highlighted: highlight === card.key,
    onFocus: setFocus,
    onDetails: setDetails,
  });
  const toggleLevel = (key) => setOpenLevels((cur) => {
    const next = new Set(cur);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  const lastIndex = view.levels.length - 1;
  const printScale = stageW ? Math.min(1, 1040 / stageW) : 1;

  return (
    <div className="nv-ot" data-density={options.density} data-narrow={narrow ? "1" : "0"}>
      {topBar}
      <div
        ref={scrollerRef}
        className="nv-ot-scroller"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        aria-label={ar ? "مخطط الهيكل كاملاً" : "Full org chart"}
        role="region"
      >
        <div ref={sizerRef} className="nv-ot-sizer">
          <div
            ref={stageRef}
            className="nv-ot-stage"
            style={{
              "--card-w": `${cardW}px`,
              "--chain-w": `${chainW}px`,
              "--col-gap": `${colGap}px`,
              "--gap": `${gap}px`,
              "--print-scale": printScale,
              width: narrow ? `${100 / zoom}%` : `${stageW}px`,
              transform: zoom === 1 ? undefined : `scale(${zoom})`,
            }}
          >
            {view.levels.map((level, index) => {
              const sibN = level.siblings.length + (level.hidden ? 1 : 0);
              const showGrid = !narrow && sibN > 0;
              const cols = Math.min(maxCols, Math.max(1, sibN));
              const gw = gridWidth(cols, { cardW, gap });
              const isLast = index === lastIndex;
              const open = openLevels.has(level.key);
              const total = level.siblings.length + level.hidden;
              const sibLabel = ar
                ? `${open ? "إخفاء" : "عرض"} ${Number(total).toLocaleString("ar-SA")} في المستوى نفسه`
                : `${open ? "Hide" : "Show"} ${total} at this level`;
              return (
                <section
                  key={level.key}
                  className="nv-ot-row"
                  data-root={index === 0 ? "1" : "0"}
                  aria-label={level.card.vacant ? (ar ? "منصب شاغر" : "Open seat") : level.card.name}
                >
                  {showGrid && index > 0 ? (
                    <>
                      <span className="nv-ot-bus" aria-hidden style={{ width: `${chainW / 2 + colGap + gw / 2}px` }} />
                      <span className="nv-ot-tick" aria-hidden style={{ insetInlineEnd: `${chainW + colGap + gw / 2}px` }} />
                    </>
                  ) : null}
                  {showGrid ? (
                    <div className="nv-ot-grid nv-ot-grid--sibs" style={{ "--cols": cols }}>
                      {level.siblings.map((card) => <TreeCard key={card.key} {...cardProps(card)} />)}
                      {level.hidden || open ? (
                        <button type="button" className="nv-ot-more" onClick={() => toggleLevel(level.key)} aria-expanded={open}>
                          {open
                            ? (ar ? "طيّ" : "Fold")
                            : (ar ? `+ ${Number(level.hidden).toLocaleString("ar-SA")} آخرون` : `+ ${level.hidden} more`)}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="nv-ot-chain">
                    {index > 0 ? <span className="nv-ot-stem nv-ot-stem--top" aria-hidden /> : null}
                    <TreeCard {...cardProps(level.card)} />
                    {narrow && total > 0 ? (
                      <>
                        <span className="nv-ot-stem nv-ot-stem--short" aria-hidden />
                        <button type="button" className="nv-ot-peers" onClick={() => toggleLevel(level.key)} aria-expanded={open}>{sibLabel}</button>
                        {open ? (
                          <div className="nv-ot-grid nv-ot-grid--panel" style={{ "--cols": maxCols }}>
                            {level.siblings.map((card) => <TreeCard key={card.key} {...cardProps(card)} />)}
                          </div>
                        ) : null}
                      </>
                    ) : null}
                    {!isLast || view.reports.length ? <span className="nv-ot-stem nv-ot-stem--fill" aria-hidden /> : null}
                  </div>
                </section>
              );
            })}
            {view.reports.length ? (
              <section className="nv-ot-row nv-ot-row--reports" aria-label={ar ? "تحت إدارته مباشرة" : "Direct reports"}>
                <span className="nv-ot-stem nv-ot-stem--reports" aria-hidden />
                <div className="nv-ot-grid nv-ot-grid--reports" style={{ "--cols": view.reportCols }}>
                  {view.reports.map((card) => <TreeCard key={card.key} {...cardProps(card)} />)}
                </div>
              </section>
            ) : (
              <p className="nv-ot-none">
                {view.focus.vacant
                  ? (ar ? "منصب شاغر — لا أحد تحته بعد." : "Open seat — nobody under it yet.")
                  : (ar ? "لا أحد تحت إدارته مباشرة." : "No direct reports.")}
              </p>
            )}
          </div>
        </div>
      </div>

      {edges.left ? (
        <button type="button" className="nv-ot-arrow" data-side="left" onClick={() => pan(-1)} aria-label={ar ? "تحريك المخطط يساراً" : "Pan left"}>{Icon.chevL}</button>
      ) : null}
      {edges.right ? (
        <button type="button" className="nv-ot-arrow" data-side="right" onClick={() => pan(1)} aria-label={ar ? "تحريك المخطط يميناً" : "Pan right"}>{Icon.chevR}</button>
      ) : null}

      <p className="nv-ot-keys" aria-hidden>
        {ar ? "↑ المدير · ↓ أول من تحته · ← → المستوى نفسه · + − تكبير · اسحب للتحريك" : "↑ manager · ↓ first report · ← → same level · + − zoom · drag to pan"}
      </p>
      <p className="nv-of-sr" aria-live="polite">{announce}</p>

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
          onClose={() => setDetails(null)}
        />
      ) : null}
    </div>
  );
}
