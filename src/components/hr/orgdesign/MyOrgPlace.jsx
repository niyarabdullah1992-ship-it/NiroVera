import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { deriveMyPlace, deriveSubtree, todayKey } from "@/lib/orgDesign";
import { fetchOrgPlace } from "@/lib/orgDesignApi";
import { Face, SectionHead, fmtDay, levelLabel } from "./orgDesignUi";

/**
 * «مكاني في الهيكل» — read-only. My seat, my unit, my manager (and who covers them), my dotted
 * lines, my peers and my team. Names and titles only: the file itself lives in ملفي.
 * A manager also sees his own subtree, nothing beyond it.
 */
export default function MyOrgPlace({ ar, data, user, companyId, scope = "self" }) {
  const day = todayKey();
  const local = useMemo(() => (user?.id ? deriveMyPlace(data, user.id, day) : null), [data, user?.id, day]);
  const localTree = useMemo(() => (scope === "subtree" && user?.id ? deriveSubtree(data, user.id, day) : null), [data, user?.id, scope, day]);
  const [server, setServer] = useState(null);

  useEffect(() => {
    let live = true;
    // Seats are senior-only on the server; the server derives this person's place for them.
    fetchOrgPlace(companyId, "myPlace").then((res) => { if (live && res?.place) setServer(res.place); });
    return () => { live = false; };
  }, [companyId]);

  const place = local && (local.manager || !server) ? local : (server ? { ...local, ...server } : local);
  if (!place) {
    return (
      <div className="nv-od-paper">
        <p className="nv-od-note">{ar ? "لم يُربط ملفك بمنصب في الهيكل بعد — تواصل مع الموارد البشرية." : "Your file is not linked to a seat yet — contact HR."}</p>
      </div>
    );
  }
  const path = place.path || [];
  // One list of my people: the direct team, or — when it has layers under it — the subtree.
  const deep = Boolean(localTree && (localTree.children || []).some((c) => (c.children || []).length));

  return (
    <section className="nv-od" aria-label={ar ? "مكاني في الهيكل" : "My place in the structure"}>
      <SectionHead
        title={ar ? "مكاني في الهيكل" : "My place in the structure"}
        hint={ar
          ? "للاطلاع: موقعك ومديرك وفريقك. ملفك وعقدك في «ملفي»، والتغيير في الهيكل يتم عبر الموارد البشرية."
          : "Read-only: your place, your manager and your team. Your file lives in My file; structural changes go through HR."}
      >
        <Link to={`/app/employees/${encodeURIComponent(String(user?.id || ""))}`} className="nv-od-btn">{ar ? "ملفي" : "My file"}</Link>
      </SectionHead>

      <div className="nv-od-place">
        <div className="nv-od-paper" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Face ar={ar} name={place.me?.name} sub={[place.me?.title, place.me?.seatCode].filter(Boolean).join(" · ")} />
          {path.length ? (
            <nav className="nv-od-crumbs" aria-label={ar ? "مسار الوحدة" : "Unit path"}>
              {path.map((p, i) => (
                <React.Fragment key={p.stationId}>
                  {i ? <span aria-hidden>›</span> : null}
                  {i === path.length - 1 ? <b>{p.name}</b> : <span>{p.name}</span>}
                </React.Fragment>
              ))}
            </nav>
          ) : null}
          <div>
            <div className="nv-od-kv"><span>{ar ? "الوحدة" : "Unit"}</span><span>{place.unit ? `${place.unit.name} · ${levelLabel(place.unit.level, ar)}` : (path[path.length - 1]?.name || "—")}</span></div>
            {place.layer ? <div className="nv-od-kv"><span>{ar ? "الطبقة من رأس الهيكل" : "Layer from the top"}</span><span className="nv-od-num">{place.layer}</span></div> : null}
            {place.deputy ? <div className="nv-od-kv"><span>{ar ? "نائبي" : "My deputy"}</span><span>{place.deputy.name} · {place.deputy.title}</span></div> : null}
            {(place.deputyOf || []).map((d) => <div key={d.seatId} className="nv-od-kv"><span>{ar ? "أنوب عن" : "Deputy for"}</span><span>{d.name || d.title} · {d.title}</span></div>)}
            {(place.acting || []).map((a) => <div key={`${a.stationId}-${a.until}`} className="nv-od-kv"><span>{ar ? "تكليفي" : "My acting role"}</span><span>{a.title || "—"} · {a.stationName} · {ar ? "حتى" : "until"} {fmtDay(a.until, ar)}</span></div>)}
          </div>
        </div>

        <div className="nv-od-paper" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p className="nv-od-sub">{ar ? "مديري المباشر" : "My manager"}</p>
          {place.manager ? <Face ar={ar} name={place.manager.name} sub={place.manager.title} /> : <p className="nv-od-note">{ar ? "أنت على رأس الهيكل." : "You are at the top of the structure."}</p>}
          {place.actingCover ? <p className="nv-od-note">{ar ? `يغطيه بالتكليف ${place.actingCover.name} حتى ${fmtDay(place.actingCover.until, ar)}.` : `${place.actingCover.name} covers until ${fmtDay(place.actingCover.until, ar)}.`}</p> : null}
          {(place.dotted || []).length ? (
            <>
              <p className="nv-od-sub">{ar ? "تبعية فنية (خط منقّط)" : "Dotted line"}</p>
              {place.dotted.map((d) => <Face key={d.seatId} ar={ar} name={d.name || d.title} vacant={!d.name} sub={d.title} />)}
            </>
          ) : null}
        </div>
      </div>

      {(place.peers || []).length ? (
        <div className="nv-od-paper" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p className="nv-od-sub">{ar ? "زملائي عند المدير نفسه" : "Peers under the same manager"} <span className="nv-od-num nv-od-muted">{place.peers.length}</span></p>
          <div className="nv-od-form">{place.peers.map((p) => <Face key={p.employeeId} ar={ar} name={p.name} sub={p.title} />)}</div>
        </div>
      ) : null}

      {(place.team || []).length || place.openSeats ? (
        <div className="nv-od-paper" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p className="nv-od-sub">{deep ? (ar ? "فريقي ومن تحته" : "My team and below") : (ar ? "فريقي المباشر" : "My direct team")} <span className="nv-od-num nv-od-muted">{(place.team || []).length}</span></p>
          {deep ? <SubtreeList ar={ar} nodes={localTree.children} /> : <div className="nv-od-form">{(place.team || []).map((p) => <Face key={p.employeeId} ar={ar} name={p.name} sub={p.title} />)}</div>}
          {place.openSeats ? <p className="nv-od-note">{ar ? `${place.openSeats} منصب شاغر يتبعك — التعيين لدى الموارد البشرية.` : `${place.openSeats} open seat(s) report to you — hiring is with HR.`}</p> : null}
          {(place.dottedFrom || []).length ? <p className="nv-od-note">{ar ? `يتبعك فنياً: ${place.dottedFrom.map((p) => p.name).join("، ")}` : `Dotted to you: ${place.dottedFrom.map((p) => p.name).join(", ")}`}</p> : null}
        </div>
      ) : null}

    </section>
  );
}

function SubtreeList({ ar, nodes }) {
  return (
    <ul className="nv-od-tree">
      {nodes.map((n) => (
        <li key={n.employeeId}>
          <div className="nv-od-unit">
            <Face ar={ar} name={n.name} sub={[n.title, n.unit].filter(Boolean).join(" · ")} />
            {n.open.length ? <span className="nv-od-muted" style={{ fontSize: 11.5 }}>{ar ? `${n.open.length} شاغر` : `${n.open.length} open`}</span> : null}
          </div>
          {n.children.length ? <SubtreeList ar={ar} nodes={n.children} /> : null}
        </li>
      ))}
    </ul>
  );
}
