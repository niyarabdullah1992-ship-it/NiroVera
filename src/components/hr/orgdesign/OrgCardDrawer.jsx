import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { focusStateLabel } from "@/lib/orgFocus";
import { deriveMyPlace, todayKey } from "@/lib/orgDesign";
import { fetchOrgPlace } from "@/lib/orgDesignApi";
import { DrawerHead, Note, OrgDrawer, btnGhost, fmtDay, initialsOf } from "./orgDesignUi";
import { chip } from "@/components/schedules/scheduleChrome";

const num = (n) => String(n ?? 0);

/** Read-only card details for viewers outside HR: names, titles, units, seat codes only. */
export default function OrgCardDrawer({ ar, card, manager, data, user, companyId, onClose }) {
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

  if (!card) return null;
  const rows = [
    [ar ? "المسمى" : "Title", card.title || "—"],
    [ar ? "الوحدة" : "Unit", card.unit || "—"],
    [ar ? "رمز المنصب" : "Seat code", card.seatCode ? <span className="nv-od-code" dir="ltr">{card.seatCode}</span> : "—"],
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
    <OrgDrawer label={card.name || card.title} onClose={onClose} width={420}>
      <DrawerHead
        ar={ar}
        onClose={onClose}
        lead={<span className="nv-od-initials" data-vacant={card.vacant ? "1" : "0"} aria-hidden style={{ width: 36, height: 36, fontSize: 12 }}>{card.vacant ? "＋" : initialsOf(card.name)}</span>}
        title={card.vacant ? (ar ? "منصب شاغر" : "Open seat") : card.name}
        sub={card.title}
      />
      {focusStateLabel(card.state, ar) ? (
        <div style={{ padding: "12px 18px 0" }}>
          <span style={chip("mute", card.vacant ? { borderStyle: "dashed" } : {})}>{focusStateLabel(card.state, ar)}</span>
        </div>
      ) : null}
      <div style={{ padding: "6px 0" }}>
        {rows.map(([label, value]) => (
          <div key={label} className="nv-od-kv"><span>{label}</span><span>{value}</span></div>
        ))}
      </div>
      <div style={{ padding: "12px 18px 18px", borderTop: "1px solid var(--nv-line2, var(--nv-line))", display: "flex", flexDirection: "column", gap: 10 }}>
        <Note>
          {mine
            ? (ar ? "للاطلاع. ملفك وعقدك في «ملفي»، والتغيير في الهيكل يتم عبر الموارد البشرية." : "Read-only. Your file lives in My file; structural changes go through HR.")
            : (ar ? "للاطلاع: الاسم والمسمى والوحدة فقط. الملفات لدى الموارد البشرية." : "Read-only: name, title and unit only. Files stay with HR.")}
        </Note>
        {mine && user?.id ? (
          <Link to={`/app/employees/${encodeURIComponent(String(user.id))}`} style={{ ...btnGhost(), alignSelf: "flex-start", textDecoration: "none" }}>{ar ? "ملفي" : "My file"}</Link>
        ) : null}
      </div>
    </OrgDrawer>
  );
}
