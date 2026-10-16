import React, { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { buildOrgFocusTree, deriveFocusNeighborhood } from "@/lib/orgFocus";
import { treeCounts, countLine } from "@/lib/orgTreeLayout";
import { todayKey } from "@/lib/orgDesign";
import { initialsOf } from "./orgDesignUi";
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
    <div className="nv-ot-entry">
      <div className="nv-ot-entry__text">
        <h3>{ar ? "المخطط الكامل" : "Full org chart"}</h3>
        <p>
          {ar
            ? "صفحة كاملة للهيكل: تفتح على بطاقتك، فوقك سلسلة الإدارة حتى رأس الهيكل، وبجانب كل مستوى زملاؤه، وتحتك فريقك. انقر أي بطاقة لتنتقل إليها، وابحث عن أي شخص."
            : "The whole structure on one page: opens on your card, the chain above you, each level's peers beside it, your team below. Click any card to move to it, or search for anyone."}
        </p>
        <Link to={to} state={{ from }} className="nv-od-btn nv-od-btn--primary nv-ot-entry__go">
          {ar ? "افتح المخطط" : "Open the chart"}
        </Link>
      </div>
      {shown.length ? (
        <ol className="nv-ot-entry__chain" aria-label={ar ? "سلسلتي في الهيكل" : "My chain"}>
          {shown.map((card, index) => (card ? (
            <li key={card.key} data-me={card.isMe ? "1" : "0"}>
              <Link to={card.isMe ? to : `${to}${to.includes("?") ? "&" : "?"}focus=${encodeURIComponent(card.key)}`} state={{ from }}>
                <span className="nv-ot-entry__av" aria-hidden>{card.vacant ? "—" : initialsOf(card.name)}</span>
                <span className="nv-ot-entry__who">
                  <b>{card.vacant ? (ar ? "شاغر" : "Vacant") : card.name}</b>
                  <span>{card.title}</span>
                </span>
                {countLine(counts.get(card.key), ar) ? <span className="nv-ot-entry__n" dir="ltr">{countLine(counts.get(card.key), ar)}</span> : null}
              </Link>
            </li>
          ) : (
            <li key={`fold-${index}`} className="nv-ot-entry__fold" aria-hidden>⋮</li>
          )))}
        </ol>
      ) : null}
    </div>
  );
}
