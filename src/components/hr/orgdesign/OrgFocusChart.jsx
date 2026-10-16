import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  buildOrgFocusTree,
  deriveFocusNeighborhood,
  focusMove,
  focusStateLabel,
  resolveFocusKey,
  searchFocusTree,
  unseatedPlace,
} from "@/lib/orgFocus";
import { buildWorkforceSeatChart } from "@/lib/workforceSeatChart";
import { deriveMyPlace, todayKey } from "@/lib/orgDesign";
import { fetchOrgPlace } from "@/lib/orgDesignApi";
import OrgEmployeePreview from "@/components/hr/OrgEmployeePreview";
import { fmtDay, initialsOf } from "./orgDesignUi";
import "./orgFocus.css";

const num = (n) => String(n ?? 0);

/** Long chains fold in the middle: the top, «…», and the two nearest managers. */
function foldChain(chain, open) {
  if (open || chain.length <= 4) return { items: chain, folded: 0 };
  return { items: [chain[0], null, ...chain.slice(-2)], folded: chain.length - 3 };
}

function FocusCard({ card, size = "sm", ar, isFocus = false, onFocus, onOpen, onReports, cardRef }) {
  const chip = focusStateLabel(card.state, ar);
  const name = card.vacant ? (ar ? "منصب شاغر" : "Open seat") : (card.name || "—");
  const meta = [card.unit].filter(Boolean).join(" · ");
  return (
    <article
      className="nv-of-card"
      data-size={size}
      data-focus={isFocus ? "1" : "0"}
      data-vacant={card.vacant ? "1" : "0"}
      data-me={card.isMe ? "1" : "0"}
    >
      <button
        ref={cardRef}
        type="button"
        className="nv-of-card__hit"
        onClick={() => (isFocus ? onOpen?.(card) : onFocus?.(card.key))}
        aria-current={isFocus ? "true" : undefined}
        aria-label={[
          name,
          card.title,
          card.unit,
          chip,
          card.isMe ? (ar ? "أنت" : "you") : "",
          isFocus ? (ar ? "اضغط Enter للتفاصيل" : "press Enter for details") : "",
        ].filter(Boolean).join("، ")}
      >
        <span className="nv-of-avatar" aria-hidden>{card.vacant ? "＋" : initialsOf(card.name)}</span>
        <span className="nv-of-card__text">
          <span className="nv-of-card__name">
            {name}
            {card.isMe ? <span className="nv-of-me">{ar ? "أنت" : "You"}</span> : null}
          </span>
          {card.title ? <span className="nv-of-card__title">{card.title}</span> : null}
          {meta || card.seatCode ? (
            <span className="nv-of-card__meta">
              {meta ? <span>{meta}</span> : null}
              {card.seatCode ? <span className="nv-of-code" dir="ltr">{card.seatCode}</span> : null}
            </span>
          ) : null}
        </span>
      </button>
      {chip || card.reports ? (
        <span className="nv-of-card__foot">
          {chip ? <span className="nv-od-state" data-tone={card.vacant ? "vacant" : ""}>{chip}</span> : null}
          {card.reports ? (
            <button type="button" className="nv-of-count" onClick={() => onReports?.(card.key)}>
              <span className="nv-od-num">{num(card.reports)}</span> {ar ? "تحت إدارته" : "report here"}
            </button>
          ) : null}
        </span>
      ) : null}
    </article>
  );
}

function FocusSearch({ ar, tree, onPick }) {
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
    <div className="nv-of-search" role="search">
      <input
        className="nv-od-input nv-of-search__input"
        type="search"
        value={query}
        placeholder={ar ? "ابحث باسم أو مسمى أو رمز منصب أو وحدة" : "Search name, title, seat code or unit"}
        aria-label={ar ? "ابحث في الهيكل" : "Search the structure"}
        role="combobox"
        aria-expanded={hits.length > 0}
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
        <ul className="nv-of-search__menu" role="listbox" id={listId}>
          {hits.length ? hits.map((card, index) => (
            <li
              key={card.key}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => { event.preventDefault(); pick(card); }}
              onMouseEnter={() => setActive(index)}
            >
              <b>{card.vacant ? (ar ? "منصب شاغر" : "Open seat") : card.name}</b>
              <span>{[card.title, card.unit].filter(Boolean).join(" · ")}</span>
              {card.seatCode ? <span className="nv-of-code" dir="ltr">{card.seatCode}</span> : null}
            </li>
          )) : <li className="nv-of-search__none" role="option" aria-selected="false" aria-disabled="true">{ar ? "لا نتيجة ضمن ما يحق لك رؤيته." : "No match within what you may see."}</li>}
        </ul>
      ) : null}
    </div>
  );
}

/** Read-only card details for viewers outside HR: names, titles, units, seat codes only. */
function ReadOnlyDrawer({ ar, card, manager, data, user, companyId, onClose }) {
  const closeRef = useRef(null);
  const mine = Boolean(card?.isMe);
  const day = todayKey();
  const local = useMemo(() => (mine && user?.id ? deriveMyPlace(data, user.id, day) : null), [mine, data, user?.id, day]);
  const [server, setServer] = useState(null);
  useEffect(() => {
    if (!mine) return undefined;
    let live = true;
    // Seats are senior-only on the server; the server derives this person's own place.
    fetchOrgPlace(companyId, "myPlace").then((res) => { if (live && res?.place) setServer(res.place); });
    return () => { live = false; };
  }, [mine, companyId]);
  const place = mine ? (local && (local.manager || !server) ? local : (server ? { ...local, ...server } : local)) : null;

  useEffect(() => {
    const prev = document.activeElement;
    closeRef.current?.focus();
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [onClose]);

  if (!card) return null;
  const rows = [
    [ar ? "المسمى" : "Title", card.title || "—"],
    [ar ? "الوحدة" : "Unit", card.unit || "—"],
    [ar ? "رمز المنصب" : "Seat code", card.seatCode ? <span className="nv-of-code" dir="ltr">{card.seatCode}</span> : "—"],
    [ar ? "المدير المباشر" : "Manager", manager ? (manager.name || (ar ? "منصب شاغر" : "Open seat")) : (ar ? "رأس الهيكل" : "Top of the structure")],
    [ar ? "تحت إدارته" : "Reports", <span key="n" className="nv-od-num">{num(card.reports)}</span>],
  ];
  if (place) {
    if (place.layer) rows.push([ar ? "الطبقة من رأس الهيكل" : "Layer from the top", <span key="l" className="nv-od-num">{place.layer}</span>]);
    if (place.deputy) rows.push([ar ? "نائبي" : "My deputy", `${place.deputy.name || "—"} · ${place.deputy.title || ""}`]);
    (place.deputyOf || []).forEach((d) => rows.push([ar ? "أنوب عن" : "Deputy for", `${d.name || d.title} · ${d.title}`]));
    (place.acting || []).forEach((a) => rows.push([ar ? "تكليفي" : "My acting role", `${a.title || "—"} · ${a.stationName} · ${ar ? "حتى" : "until"} ${fmtDay(a.until, ar)}`]));
    (place.dotted || []).forEach((d) => rows.push([ar ? "تبعية فنية" : "Dotted line", d.name ? `${d.name} · ${d.title}` : d.title]));
    if (place.actingCover) rows.push([ar ? "يغطي مديري" : "Covering my manager", `${place.actingCover.name} · ${ar ? "حتى" : "until"} ${fmtDay(place.actingCover.until, ar)}`]);
  }
  return (
    <div className="nv-of-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="nv-of-drawer" role="dialog" aria-modal="true" aria-label={card.name || card.title}>
        <header className="nv-of-drawer__head">
          <span className="nv-of-avatar" data-vacant={card.vacant ? "1" : "0"} aria-hidden>{card.vacant ? "＋" : initialsOf(card.name)}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3>{card.vacant ? (ar ? "منصب شاغر" : "Open seat") : card.name}</h3>
            <p>{card.title}</p>
          </div>
          <button ref={closeRef} type="button" className="nv-od-btn nv-od-btn--quiet" onClick={onClose}>{ar ? "إغلاق" : "Close"}</button>
        </header>
        {focusStateLabel(card.state, ar) ? <span className="nv-od-state" data-tone={card.vacant ? "vacant" : ""} style={{ alignSelf: "flex-start" }}>{focusStateLabel(card.state, ar)}</span> : null}
        <div>
          {rows.map(([label, value]) => (
            <div key={label} className="nv-od-kv"><span>{label}</span><span>{value}</span></div>
          ))}
        </div>
        <p className="nv-od-note">
          {mine
            ? (ar ? "للاطلاع. ملفك وعقدك في «ملفي»، والتغيير في الهيكل يتم عبر الموارد البشرية." : "Read-only. Your file lives in My file; structural changes go through HR.")
            : (ar ? "للاطلاع: الاسم والمسمى والوحدة فقط. الملفات لدى الموارد البشرية." : "Read-only: name, title and unit only. Files stay with HR.")}
        </p>
        {mine && user?.id ? (
          <Link to={`/app/employees/${encodeURIComponent(String(user.id))}`} className="nv-od-btn" style={{ alignSelf: "flex-start" }}>{ar ? "ملفي" : "My file"}</Link>
        ) : null}
      </aside>
    </div>
  );
}

/**
 * «التركيز» — the org chart that opens on the viewer's own card. Above: the manager and the chain
 * to the top (a breadcrumb); below: the direct reports; beside: the peers, folded under «زملائي».
 * Any card becomes the focus (?focus=<seatId>, so back/forward works); «عودة إليّ» returns.
 * Keys: ↑ manager · ↓ first report · ←/→ peers · Enter details.
 *
 * scope "all" (HR/owner) reads the whole tree and opens the existing seat card with its actions;
 * scope "mine" receives a pruned tree — chain, peers, own subtree — and a read-only card.
 */
export default function OrgFocusChart({ ar, data, user, companyId, scope = "mine", canWrite = false, onHire, toolbar = null }) {
  const day = todayKey();
  const tree = useMemo(
    () => buildOrgFocusTree(data, { viewerId: user?.id || "", scope, ar, day }),
    [data, user?.id, scope, ar, day],
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const wanted = searchParams.get("focus") || "";
  const focusKey = resolveFocusKey(tree, wanted);
  const hood = useMemo(() => (focusKey ? deriveFocusNeighborhood(tree, focusKey) : null), [tree, focusKey]);
  const [peersOpen, setPeersOpen] = useState(false);
  const [chainOpen, setChainOpen] = useState(false);
  const [details, setDetails] = useState(null);
  const focusRef = useRef(null);
  const reportsRef = useRef(null);
  const moved = useRef(false);
  const toReports = useRef(false);
  const [announce, setAnnounce] = useState("");

  const setFocus = useCallback((key, { toTeam = false } = {}) => {
    if (!key) return;
    moved.current = true;
    toReports.current = toTeam;
    const params = new URLSearchParams(searchParams);
    if (key === tree.viewerKey) params.delete("focus");
    else params.set("focus", key);
    setSearchParams(params); // push: back/forward walk the focus history
  }, [searchParams, setSearchParams, tree.viewerKey]);

  useEffect(() => {
    setChainOpen(false);
    if (!hood) return;
    const who = hood.focus.vacant ? (ar ? "منصب شاغر" : "Open seat") : hood.focus.name;
    setAnnounce(ar
      ? `التركيز على ${who}${hood.focus.title ? `، ${hood.focus.title}` : ""}. ${hood.reports.length} تحت إدارته، ${hood.peers.length} في الفريق نفسه.`
      : `Focused on ${who}${hood.focus.title ? `, ${hood.focus.title}` : ""}. ${hood.reports.length} reports, ${hood.peers.length} peers.`);
    if (!moved.current) return;
    moved.current = false;
    const target = toReports.current ? reportsRef.current : focusRef.current;
    toReports.current = false;
    requestAnimationFrame(() => {
      focusRef.current?.focus({ preventScroll: true });
      target?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    });
  }, [focusKey]);

  const openDetails = useCallback((card) => setDetails(card), []);

  const onKeyDown = (event) => {
    if (details) return;
    const tag = String(event.target?.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const rtl = ar;
    const map = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: rtl ? "next" : "prev",
      ArrowRight: rtl ? "prev" : "next",
    };
    const dir = map[event.key];
    if (dir) {
      const next = focusMove(tree, focusKey, dir);
      event.preventDefault();
      if (next) {
        if (dir === "prev" || dir === "next") setPeersOpen(true);
        setFocus(next);
      }
    }
    // Enter: the focused card's own button opens its details (native button activation).
  };

  /* No seat for this viewer: say where they belong, calmly. */
  if (!hood) {
    const place = user?.id ? unseatedPlace(data, user.id) : null;
    return (
      <section className="nv-of" aria-label={ar ? "الهيكل" : "Structure"}>
        {toolbar}
        <div className="nv-od-paper nv-of-unseated">
          <p className="nv-od-sub">{place?.name || (ar ? "مكانك في الهيكل" : "Your place")}</p>
          <div>
            <div className="nv-od-kv"><span>{ar ? "الوحدة" : "Unit"}</span><span>{place?.unit || "—"}</span></div>
            <div className="nv-od-kv"><span>{ar ? "المدير" : "Manager"}</span><span>{place?.managerName || "—"}</span></div>
          </div>
          <p className="nv-od-note">
            {ar
              ? "لم يُربط ملفك بمنصب في الهيكل بعد، لذلك لا تظهر بطاقتك هنا. حين تربطه الموارد البشرية بمنصب ستفتح الصفحة على بطاقتك."
              : "Your file is not linked to a seat yet, so your card is not on the chart. Once HR links it, this page opens on your card."}
          </p>
        </div>
      </section>
    );
  }

  const { focus, chain, manager, reports, peers } = hood;
  const viewerHere = Boolean(tree.viewerKey) && focusKey === tree.viewerKey;
  const crumbs = foldChain(chain, chainOpen);
  const peerLabel = viewerHere ? (ar ? "زملائي" : "My peers") : (ar ? "في الفريق نفسه" : "Same team");
  const reportsLabel = viewerHere ? (ar ? "فريقي المباشر" : "My direct team") : (ar ? "تحت إدارته مباشرة" : "Direct reports");
  const hrDrawer = scope === "all";
  const chartNode = (() => {
    if (!hrDrawer || !details?.vacant) return null;
    const flat = buildWorkforceSeatChart(data, { ar }).flat;
    return flat.find((node) => (details.seatId && node.seatId === details.seatId) || node.id === details.id) || null;
  })();
  const employee = hrDrawer && details?.employeeId
    ? (data?.employees || []).find((row) => String(row.id) === String(details.employeeId)) || null
    : null;

  return (
    <section className="nv-of" aria-label={ar ? "مخطط الهيكل — التركيز" : "Org chart — focus"} onKeyDown={onKeyDown}>
      <div className="nv-of-bar">
        <FocusSearch ar={ar} tree={tree} onPick={(key) => setFocus(key)} />
        {tree.viewerKey ? (
          <button type="button" className="nv-od-btn" onClick={() => setFocus(tree.viewerKey)} aria-disabled={viewerHere ? "true" : undefined} data-quiet={viewerHere ? "1" : "0"}>
            {ar ? "عودة إليّ" : "Back to me"}
          </button>
        ) : null}
        {toolbar}
      </div>

      <nav className="nv-of-crumbs" aria-label={ar ? "سلسلة الإدارة" : "Management chain"}>
        {chain.length ? (
          <ol>
            {crumbs.items.map((card, index) => (
              <li key={card ? card.key : "fold"}>
                {card ? (
                  <button type="button" onClick={() => setFocus(card.key)} data-last={index === crumbs.items.length - 1 ? "1" : "0"}>
                    {card.vacant ? (ar ? "منصب شاغر" : "Open seat") : card.name}
                    <span className="nv-of-crumbs__title">{card.title}</span>
                  </button>
                ) : (
                  <button type="button" onClick={() => setChainOpen(true)} aria-label={ar ? `أظهر ${crumbs.folded} في السلسلة` : `Show ${crumbs.folded} more`}>…</button>
                )}
              </li>
            ))}
            <li aria-current="page"><b>{focus.vacant ? (ar ? "منصب شاغر" : "Open seat") : focus.name}</b></li>
          </ol>
        ) : (
          <p className="nv-od-note">{ar ? "رأس الهيكل — لا مدير فوق هذه البطاقة." : "Top of the structure — no manager above this card."}</p>
        )}
      </nav>

      <div className="nv-of-stage" key={focusKey}>
        {manager ? (
          <div className="nv-of-level nv-of-level--manager">
            <p className="nv-of-label">{ar ? "المدير المباشر" : "Manager"}</p>
            <FocusCard card={manager} size="md" ar={ar} onFocus={setFocus} onReports={(key) => setFocus(key, { toTeam: true })} />
            <span className="nv-of-stem" aria-hidden />
          </div>
        ) : null}

        <div className="nv-of-level nv-of-level--focus">
          <FocusCard
            card={focus}
            size="lg"
            isFocus
            ar={ar}
            cardRef={focusRef}
            onOpen={openDetails}
            onReports={() => reportsRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" })}
          />
          <div className="nv-of-focus-actions">
            <button type="button" className="nv-od-btn nv-od-btn--quiet" onClick={() => openDetails(focus)}>
              {hrDrawer ? (ar ? "بطاقة المنصب" : "Seat card") : (ar ? "التفاصيل" : "Details")}
            </button>
            {peers.length ? (
              <button type="button" className="nv-od-btn nv-od-btn--quiet" aria-expanded={peersOpen} onClick={() => setPeersOpen((v) => !v)}>
                {`${peerLabel} (${num(peers.length)})`}
              </button>
            ) : null}
          </div>
        </div>

        {peers.length && peersOpen ? (
          <div className="nv-of-level">
            <p className="nv-of-label">{peerLabel} <span className="nv-od-num">{num(peers.length)}</span></p>
            <div className="nv-of-grid">
              {peers.map((card) => <FocusCard key={card.key} card={card} ar={ar} onFocus={setFocus} onReports={(key) => setFocus(key, { toTeam: true })} />)}
            </div>
          </div>
        ) : null}

        <div className="nv-of-level" ref={reportsRef}>
          {reports.length ? (
            <>
              <span className="nv-of-stem" aria-hidden />
              <p className="nv-of-label">{reportsLabel} <span className="nv-od-num">{num(reports.length)}</span></p>
              <div className="nv-of-grid">
                {reports.map((card) => <FocusCard key={card.key} card={card} ar={ar} onFocus={setFocus} onReports={(key) => setFocus(key, { toTeam: true })} />)}
              </div>
            </>
          ) : (
            <p className="nv-od-note nv-of-none">{focus.vacant ? (ar ? "منصب شاغر — لا أحد تحته بعد." : "Open seat — nobody under it yet.") : (ar ? "لا أحد تحت إدارته مباشرة." : "No direct reports.")}</p>
          )}
        </div>
      </div>

      <p className="nv-of-keys" aria-hidden>
        {ar ? "↑ المدير · ↓ أول من تحته · ← → الزملاء · Enter التفاصيل" : "↑ manager · ↓ first report · ← → peers · Enter details"}
      </p>
      <p className="nv-of-sr" aria-live="polite">{announce}</p>

      {details && !hrDrawer ? (
        <ReadOnlyDrawer
          ar={ar}
          card={details}
          manager={details.key === focus.key ? manager : deriveFocusNeighborhood(tree, details.key)?.manager || null}
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
    </section>
  );
}
