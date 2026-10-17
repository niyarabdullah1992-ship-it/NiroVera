import React, { useState } from "react";
import { Car, ShieldCheck, UserRound } from "lucide-react";
import {
  todayVisitDateKey,
  visitBoundLabels,
  visitBounds,
  visitDurationDays,
  visitorIdTypeLabel,
} from "@/lib/visitorProof";
import { proofVehicleText } from "@/components/proof/WorkProofRaiseFields";

const MONO = { fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums", direction: "ltr", unicodeBidi: "isolate" };

function markOf(name) {
  return String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("") || "·";
}

/** Only the last four digits of an ID ever show on a list. */
export function maskVisitorId(id) {
  const s = String(id || "").replace(/\s+/g, "");
  if (!s) return "";
  return s.length <= 4 ? s : `•••• ${s.slice(-4)}`;
}

function dayIndex(from, today) {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

/** Where the visit stands today: on its way, its last day, or past the date it was cleared for. */
export function visitPassState(proof, today = todayVisitDateKey()) {
  if (proof?.leftAt || proof?.status === "left") return { key: "left", tone: "ok" };
  const { from, to } = visitBounds(proof);
  if (to && to < today) return { key: "overstay", tone: "bad" };
  if (to && to === today) return { key: "last", tone: "warn" };
  if (from && from > today) return { key: "upcoming", tone: "mute" };
  return { key: "on_site", tone: "ok" };
}

const STATE_LABEL = {
  on_site: { ar: "في الفرع", en: "On site" },
  last: { ar: "آخر يوم", en: "Last day" },
  overstay: { ar: "تجاوز موعده", en: "Past the date" },
  upcoming: { ar: "زيارة قادمة", en: "Upcoming" },
  left: { ar: "غادر", en: "Left" },
};

const PILL = {
  ok: { bg: "rgba(255,255,255,.14)", ink: "#fff", dot: "#7FD1A3" },
  warn: { bg: "#FBF3E1", ink: "#8A5A12", dot: "#C8A45A" },
  bad: { bg: "#FDECEC", ink: "#9B1C1C", dot: "#DC2626" },
  mute: { bg: "rgba(255,255,255,.14)", ink: "#C5DBCD", dot: "#A9CDB8" },
};

/** A guest on the branch shown as the pass the guard would check: who, cleared until when, who hosts. */
export default function VisitorPassCard({ row, ar, onOpen, actions, stationName = "" }) {
  const [hover, setHover] = useState(false);
  const p = row.proof || {};
  const people = (Array.isArray(p.people) ? p.people : []).filter((person) => person?.name);
  const lead = people[0] || { name: p.personName || row.owner };
  const others = people.slice(1);
  const insideCount = people.filter((person) => !person.outAt).length;
  const briefedCount = people.filter((person) => person.briefed).length;
  const today = todayVisitDateKey();
  const { from, to } = visitBounds(p);
  const span = visitDurationDays(p) || 1;
  const nth = Math.min(span, Math.max(0, dayIndex(from, today)));
  const pct = Math.round((Math.max(0, nth) / span) * 100);
  const state = visitPassState(p, today);
  const pill = PILL[state.tone] || PILL.ok;
  const bounds = visitBoundLabels(p, ar);
  const vehicles = proofVehicleText(p);
  const arrived = /T(\d{2}:\d{2})/.exec(String(p.arrivedAt || ""))?.[1] || "";
  const idLine = [lead.nationality, visitorIdTypeLabel(lead.idType, ar)].filter(Boolean).join(" · ");
  const host = p.hostName || p.raiserName || "";

  return (
    <article
      role="button"
      tabIndex={0}
      data-vp-card={p.ref || row.id}
      data-vp-state={state.key}
      className="nv-vp-pass"
      onClick={() => onOpen?.(row)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen?.(row); } }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(220px, 280px) minmax(0, 1fr)",
        borderRadius: 12,
        overflow: "hidden",
        background: "var(--nv-card)",
        border: `1px solid ${hover ? "#0B3D27" : "var(--nv-line)"}`,
        boxShadow: hover ? "0 10px 24px var(--nv-shadow)" : "var(--nv-paper)",
        cursor: "pointer",
        textAlign: "start",
      }}
    >
      {/* The pass itself — dark slab, the name the guard reads, the ID kept to four digits. */}
      <div
        className="nv-vp-stub"
        style={{
          position: "relative",
          background: "linear-gradient(160deg, #0B3D27 0%, #0F5535 100%)",
          color: "#fff",
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          borderInlineEnd: "2px dashed rgba(255,255,255,.22)",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#A9CDB8", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span aria-hidden style={{ width: 12, height: 2, background: "#C8A45A", borderRadius: 8 }} />
            {ar ? "تصريح زائر" : "Visitor pass"}
          </span>
          <span style={{ marginInlineStart: "auto", display: "inline-flex", alignItems: "center", gap: 6, height: 22, padding: "0 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: pill.bg, color: pill.ink }}>
            <span aria-hidden className={state.key === "on_site" ? "nv-live-dot" : undefined} style={{ width: 7, height: 7, borderRadius: 999, background: pill.dot }} />
            {ar ? STATE_LABEL[state.key].ar : STATE_LABEL[state.key].en}
          </span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <span aria-hidden style={{ width: 46, height: 46, borderRadius: 12, flexShrink: 0, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.22)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700 }}>
            {markOf(lead.name)}
          </span>
          <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <strong style={{ fontFamily: "var(--font-heading)", fontSize: 17, fontWeight: 700, lineHeight: 1.35 }}>{lead.name || "—"}</strong>
            {idLine ? <span style={{ fontSize: 11.5, color: "#C5DBCD" }}>{idLine}</span> : null}
          </span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 10, marginTop: "auto", flexWrap: "wrap" }}>
          {lead.id ? <span data-vp-id="1" style={{ ...MONO, fontSize: 12, color: "#fff", letterSpacing: ".04em" }}>{maskVisitorId(lead.id)}</span> : null}
          <span style={{ ...MONO, fontSize: 11, color: "#A9CDB8", marginInlineStart: "auto" }}>{row.ref}</span>
        </span>
      </div>

      {/* The visit — why, where, how long, and who came along. */}
      <div style={{ padding: "14px 18px 12px", display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <strong style={{ fontSize: 15, fontWeight: 700, color: "var(--nv-ink)" }}>{p.visitReason || row.title}</strong>
          {p.title && p.title !== p.visitReason ? <span style={{ fontSize: 12, color: "var(--nv-muted)" }}>{p.title}</span> : null}
        </div>

        <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
          {[
            { k: ar ? "الفرع" : "Branch", v: stationName || row.station || "—" },
            { k: ar ? "المضيف" : "Host", v: host || (ar ? "بدون مضيف" : "No host") },
            { k: ar ? "وصل" : "Arrived", v: arrived ? <span style={MONO}>{arrived}</span> : "—" },
          ].map((f) => (
            <div key={f.k} style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <dt style={{ fontSize: 11, color: "var(--nv-muted)" }}>{f.k}</dt>
              <dd style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--nv-ink)" }}>{f.v}</dd>
            </div>
          ))}
        </dl>

        <div data-vp-span="1" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "var(--nv-ink2)" }}>
            <span style={MONO}>{bounds.from}</span>
            <span aria-hidden style={{ color: "var(--nv-muted)" }}>{ar ? "←" : "→"}</span>
            <span style={MONO}>{bounds.to}</span>
            <span style={{ marginInlineStart: "auto", fontWeight: 700, color: state.tone === "bad" ? "var(--nv-bad-ink)" : "var(--nv-ink)" }}>
              {state.key === "overstay"
                ? (ar ? "انتهى التصريح — سجّل المغادرة أو مدّد" : "Pass ended — record leaving or extend")
                : state.key === "upcoming"
                  ? (ar ? "لم تبدأ بعد" : "Not started")
                  : (ar ? `اليوم ${nth} من ${span}` : `Day ${nth} of ${span}`)}
            </span>
          </div>
          <span aria-hidden style={{ height: 6, borderRadius: 999, background: "var(--nv-line2, #EEF1EF)", overflow: "hidden" }}>
            <span style={{ display: "block", height: "100%", width: `${state.key === "overstay" ? 100 : pct}%`, borderRadius: 999, background: state.tone === "bad" ? "var(--nv-bad-fill)" : state.tone === "warn" ? "#C8A45A" : "#0F5535" }} />
          </span>
        </div>

        <footer style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", paddingTop: 10, borderTop: "1px solid var(--nv-line2, #EEF2F7)" }}>
          {others.length ? (
            <span data-vp-group="1" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--nv-ink2)", fontWeight: 600 }}>
              <UserRound size={14} color="var(--nv-muted)" strokeWidth={1.75} aria-hidden />
              {ar ? `${insideCount} في الفرع من ${people.length}` : `${insideCount} of ${people.length} on site`}
            </span>
          ) : null}
          {briefedCount ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "var(--nv-ok-ink)", background: "var(--nv-ok-soft)", border: "1px solid var(--nv-ok-line)", borderRadius: 999, padding: "1px 8px" }}>
              <ShieldCheck size={12} strokeWidth={2} aria-hidden />
              {briefedCount === people.length ? (ar ? "تلقّوا تعريف السلامة" : "Safety briefed") : (ar ? `السلامة ${briefedCount}/${people.length}` : `Safety ${briefedCount}/${people.length}`)}
            </span>
          ) : null}
          {vehicles ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--nv-ink2)", fontWeight: 600, minWidth: 0 }}>
              <Car size={14} color="var(--nv-muted)" strokeWidth={1.75} aria-hidden />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>{vehicles}</span>
            </span>
          ) : null}
          <span onClick={(e) => e.stopPropagation()} style={{ marginInlineStart: "auto" }}>{actions}</span>
        </footer>
      </div>
    </article>
  );
}
