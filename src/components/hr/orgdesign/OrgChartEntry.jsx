import React, { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { buildOrgFocusTree, deriveFocusNeighborhood } from "@/lib/orgFocus";
import { treeCounts, countLine } from "@/lib/orgTreeLayout";
import { todayKey } from "@/lib/orgDesign";
import { Slab, btnPrimary, initialsOf } from "./orgDesignUi";
import "./orgTree.css";

/**
 * The «المخطط» entry on /app/org: a quiet preview of my chain (top → me) and one action that opens
 * the full-screen chart (/app/org/chart). Long chains fold in the middle. Same data rules as the
 * chart: scope "mine" reads the pruned tree.
 */
export default function OrgChartEntry({ ar, data, user, scope = "mine" }) {
  const location = useLocation();
  const day = todayKey();
  const tree = useMemo(() => buildOrgFocusTree(data, { viewerId: user?.id || "", scope, ar, day }), [data, user?.id, scope, ar, day]);
  const counts = useMemo(() => treeCounts(tree), [tree]);
  const hood = tree.viewerKey ? deriveFocusNeighborhood(tree, tree.viewerKey) : null;
  const chain = hood ? [...hood.chain, hood.focus] : [];
  const shown = chain.length > 5 ? [chain[0], null, ...chain.slice(-3)] : chain;
  const from = `${location.pathname}${location.search}`;
  const to = scope === "mine" ? "/app/org/chart?scope=mine" : "/app/org/chart";

  return (
    <Slab
      label={ar ? "المخطط الكامل" : "Full org chart"}
      title={ar ? "المخطط الكامل" : "Full org chart"}
      note={ar
        ? "صفحة كاملة للهيكل: الشركة كلها بفروعها وموظفيها، تفتح على بطاقتك وسلسلة إدارتك. اضغط الرقم «مباشر / الكل» أسفل أي بطاقة لفتح فريقها، وبدّل إلى «الفروع» لترى الشجرة بالفروع، وابحث عن أي شخص."
        : "The whole structure on one page: opens on your card with your chain open. Press the «direct / total» count on any card to open its team — open branches stay open — or search for anyone."}
      trailing={(
        <Link to={to} state={{ from }} className="nv-ot-entry__go" style={{ ...btnPrimary(), textDecoration: "none" }}>
          {ar ? "افتح المخطط" : "Open the chart"}
        </Link>
      )}
    >
      {shown.length ? (
        <div className="nv-ot-entry">
          <span className="nv-ot-entry__label">{ar ? "سلسلتي من رأس الهيكل" : "My chain from the top"}</span>
          <ol className="nv-ot-entry__chain" aria-label={ar ? "سلسلتي في الهيكل" : "My chain"}>
            {shown.map((card, index) => (card ? (
              <li key={card.key} data-me={card.isMe ? "1" : "0"}>
                <Link to={card.isMe ? to : `${to}${to.includes("?") ? "&" : "?"}focus=${encodeURIComponent(card.key)}`} state={{ from }}>
                  <span className="nv-ot-entry__av" aria-hidden>{card.vacant ? "—" : initialsOf(card.name)}</span>
                  <span className="nv-ot-entry__who">
                    <b>{card.vacant ? (ar ? "شاغر" : "Vacant") : card.name}</b>
                    <span>{card.title}</span>
                  </span>
                  {card.isMe ? <span className="nv-ot-entry__me">{ar ? "أنت" : "You"}</span> : null}
                  {countLine(counts.get(card.key), ar) ? <span className="nv-ot-entry__n" dir="ltr" title={ar ? "مباشرون / الفريق كله" : "Direct / whole team"}>{countLine(counts.get(card.key), ar)}</span> : null}
                </Link>
              </li>
            ) : (
              <li key={`fold-${index}`} className="nv-ot-entry__fold" aria-hidden>⋮</li>
            )))}
          </ol>
        </div>
      ) : null}
    </Slab>
  );
}
