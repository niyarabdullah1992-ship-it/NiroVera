import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { focusStateLabel } from "@/lib/orgFocus";
import { deriveMyPlace, todayKey } from "@/lib/orgDesign";
import { fetchOrgPlace } from "@/lib/orgDesignApi";
import { Note, OrgDrawer, btnGhost, fmtDay, initialsOf } from "./orgDesignUi";
import { chip } from "@/components/schedules/scheduleChrome";
import { setActingAssignment } from "@/lib/orgHire";

/** A branch head (not HR) can do one thing on the structure: name who covers his branch, between dates. */
function ManagerActing({ ar, data, user, companyId, card }) {
  const led = (data?.stations || []).filter((s) => !s.closedAt && String(s.managerId || "") === String(user?.id || ""));
  const station = led.find((s) => String(s.id) === String(card?.stationId)) || led[0] || null;
  const [person, setPerson] = useState("");
  const [until, setUntil] = useState("");
  const [msg, setMsg] = useState(null);
  if (!station) return null;
  const people = (data?.employees || []).filter((e) => e && e.role !== "system" && e.status !== "terminated"
    && String(e.id) !== String(user.id) && String(e.stationId || "") !== String(station.id) && String(e.name || "").trim());
  const save = () => {
    const res = setActingAssignment(companyId, person, { stationId: station.id, title: card?.title || "", from: todayKey(), until });
    setMsg(res.ok
      ? { ok: true, text: ar ? "سُجّل التكليف — ويظهر في سجل الأحداث باسمك." : "Acting recorded — it shows in the event log under your name." }
      : { ok: false, text: ar ? "حدّد الموظف وتاريخ النهاية." : "Pick the person and the end date." });
    if (res.ok) { setPerson(""); setUntil(""); }
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 12px", border: "1px solid var(--nv-line)", borderRadius: 10 }}>
      <strong style={{ fontSize: 12.5 }}>{ar ? `تكليف بإدارة «${station.name}»` : `Acting head of ${station.name}`}</strong>
      <label className="nv-od-field">{ar ? "المكلَّف" : "Acting person"}
        <select className="nv-od-select" value={person} onChange={(e) => setPerson(e.target.value)}>
          <option value="">{ar ? "— اختر —" : "— pick —"}</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label className="nv-od-field">{ar ? "حتى (ينتهي تلقائياً)" : "Until (ends by itself)"}
        <input className="nv-od-input" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
      </label>
      <button type="button" style={{ ...btnGhost(), alignSelf: "flex-start" }} disabled={!person || !until} onClick={save}>{ar ? "اسند التكليف" : "Assign acting"}</button>
      {msg ? <span style={{ fontSize: 11.5, color: msg.ok ? "var(--nv-ok-ink)" : "var(--nv-bad-ink)" }}>{msg.text}</span> : null}
    </div>
  );
}

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
    (place.acting || []).forEach((a) => rows.push([ar ? "تكليفي" : "My acting role", `${a.title || "—"} · ${a.stationName} · ${ar ? "حتى" : "until"} ${fmtDay(a.until, ar)}`]));
    if (place.actingCover) rows.push([ar ? "يغطي مديري" : "Covering my manager", `${place.actingCover.name} · ${ar ? "حتى" : "until"} ${fmtDay(place.actingCover.until, ar)}`]);
  }
  return (
    <OrgDrawer label={card.name || card.title} onClose={onClose} width={420}>
      <div className="nv-pp-hero">
        <div className="nv-pp-cover" aria-hidden />
        <button type="button" className="nv-pp-close" onClick={onClose} aria-label={ar ? "إغلاق" : "Close"}>✕</button>
        <span className="nv-pp-avatar" aria-hidden>{card.vacant ? "＋" : initialsOf(card.name)}</span>
        <div className="nv-pp-id">
          <strong className="nv-pp-name">{card.vacant ? (ar ? "منصب شاغر" : "Open seat") : card.name}</strong>
          {card.title ? <span className="nv-pp-sub">{card.title}</span> : null}
          {card.unit ? <span className="nv-pp-chain">{card.unit}</span> : null}
        </div>
      </div>
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
            ? (ar ? "ملفك وعقدك في «ملفي». التغيير في الهيكل للموارد البشرية — وإن كنت تدير فرعاً فلك التكليف بإدارته فقط." : "Read-only. Your file lives in My file; structural changes go through HR.")
            : (ar ? "للاطلاع: الاسم والمسمى والوحدة فقط. الملفات لدى الموارد البشرية." : "Read-only: name, title and unit only. Files stay with HR.")}
        </Note>
        {mine && user?.id ? <ManagerActing ar={ar} data={data} user={user} companyId={companyId} card={card} /> : null}
        {mine && user?.id ? (
          <Link to={`/app/employees/${encodeURIComponent(String(user.id))}`} style={{ ...btnGhost(), alignSelf: "flex-start", textDecoration: "none" }}>{ar ? "ملفي" : "My file"}</Link>
        ) : null}
      </div>
    </OrgDrawer>
  );
}
