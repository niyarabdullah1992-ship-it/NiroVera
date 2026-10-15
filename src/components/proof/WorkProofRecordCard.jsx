import React, { useState } from "react";
import { Camera, Check, Users } from "lucide-react";

const MONO = { fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums", direction: "ltr", unicodeBidi: "isolate" };

const TONE = {
  ok: { edge: "var(--nv-ok-fill)", pill: "var(--nv-ok-soft)", line: "var(--nv-ok-line)", ink: "var(--nv-ok-ink)" },
  warn: { edge: "#C8A45A", pill: "var(--nv-warn-soft)", line: "var(--nv-warn-line)", ink: "var(--nv-warn-ink)" },
  bad: { edge: "var(--nv-bad-fill)", pill: "var(--nv-bad-soft)", line: "var(--nv-bad-line)", ink: "var(--nv-bad-ink)" },
  info: { edge: "#0F5535", pill: "var(--nv-ok-soft)", line: "var(--nv-ok-line)", ink: "var(--nv-ok-ink)" },
};

function markOf(name) {
  return String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("") || "·";
}

function isImage(url) {
  const s = String(url || "");
  return /^data:image\//.test(s) || /^blob:/.test(s) || /\.(png|jpe?g|webp|gif|heic)(\?|$)/i.test(s) || /^https?:\/\//.test(s);
}

function clockOf(stamp, iso) {
  const s = String(stamp || "").trim();
  if (/^\d{1,2}:\d{2}/.test(s)) return s.slice(0, 5);
  const m = /T(\d{2}:\d{2})/.exec(String(iso || ""));
  return m ? m[1] : "";
}

/** Live «منذ» for work still running — hours and minutes since it started. */
export function workElapsedLabel(startedAt, ar, now = new Date()) {
  const t = Date.parse(String(startedAt || ""));
  if (!Number.isFinite(t)) return "";
  const mins = Math.max(0, Math.round((now.getTime() - t) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (ar) {
    if (!h) return `منذ ${m} دقيقة`;
    return m ? `منذ ${h} س ${m} د` : `منذ ${h} ساعة`;
  }
  return h ? `${h}h ${m}m ago` : `${m}m ago`;
}

/** One photo of the pair: the picture itself when there is one, else a dashed slot that says what is due. */
export function PhotoFrame({ ar, label, url, time, captured, pending }) {
  const showImg = captured && isImage(url);
  return (
    <figure
      data-proof-photo={label}
      data-captured={captured ? "1" : "0"}
      style={{
        margin: 0,
        position: "relative",
        flex: "1 1 0",
        minWidth: 0,
        aspectRatio: "4 / 3",
        maxHeight: 190,
        borderRadius: 12,
        overflow: "hidden",
        border: captured ? "1px solid var(--nv-ok-line, #CFE3D6)" : "1.5px dashed var(--nv-line)",
        background: captured
          ? (showImg ? "#0B3D27" : "linear-gradient(160deg, #E6EFE9 0%, #D6E7DC 100%)")
          : "repeating-linear-gradient(135deg, var(--nv-soft) 0 10px, transparent 10px 20px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {showImg ? (
        <img src={url} alt={label} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: 10, textAlign: "center" }}>
          <span aria-hidden style={{ width: 34, height: 34, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", background: captured ? "#0B3D27" : "var(--nv-card)", color: captured ? "#fff" : "var(--nv-muted)", border: captured ? "none" : "1px solid var(--nv-line)" }}>
            {captured ? <Check size={16} strokeWidth={2.5} /> : <Camera size={16} strokeWidth={1.75} />}
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: captured ? "#0B3D27" : "var(--nv-muted)", lineHeight: 1.5 }}>
            {captured ? (ar ? "التُقطت" : "Captured") : pending}
          </span>
        </span>
      )}
      <figcaption
        style={{
          position: "absolute",
          insetInlineStart: 8,
          top: 8,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 22,
          padding: "0 8px",
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 700,
          background: showImg ? "rgba(11,61,39,.82)" : captured ? "#0B3D27" : "var(--nv-card)",
          color: showImg || captured ? "#fff" : "var(--nv-ink2)",
          border: showImg || captured ? "none" : "1px solid var(--nv-line)",
        }}
      >
        {label}
        {time ? <span style={{ ...MONO, fontWeight: 500, opacity: 0.85 }}>{time}</span> : null}
      </figcaption>
    </figure>
  );
}

/** بدأ ← قبل ← بعد ← خُتم: where this proof is on its way to the outside party. */
export function StageRail({ ar, steps, dark = false }) {
  const current = steps.findIndex((s) => !s.done);
  return (
    <ol data-proof-rail="1" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`, gap: 0 }}>
      {steps.map((step, i) => {
        const on = step.done;
        const now = i === current;
        return (
          <li key={step.key} data-step={step.key} data-done={on ? "1" : "0"} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 0 }}>
            {i > 0 ? (
              <span aria-hidden style={{ position: "absolute", top: 8, insetInlineEnd: "50%", width: "100%", height: 2, background: on ? (dark ? "#7FD1A3" : "#0B3D27") : (dark ? "rgba(255,255,255,.2)" : "var(--nv-line)") }} />
            ) : null}
            <span
              aria-hidden
              style={{
                position: "relative",
                zIndex: 1,
                width: 18,
                height: 18,
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: on ? (dark ? "#7FD1A3" : "#0B3D27") : (dark ? "transparent" : "var(--nv-card)"),
                border: on ? "none" : now ? "2px solid #C8A45A" : (dark ? "2px solid rgba(255,255,255,.3)" : "2px solid var(--nv-line)"),
                boxShadow: now ? "0 0 0 4px rgba(200,164,90,.18)" : "none",
                color: dark ? "#0B3D27" : "#fff",
              }}
            >
              {on ? <Check size={11} strokeWidth={3} /> : null}
            </span>
            <span style={{ fontSize: 11, fontWeight: on || now ? 700 : 500, color: dark ? (on ? "#fff" : now ? "#F3E3BC" : "#A9CDB8") : (on ? "var(--nv-ink)" : now ? "#8A5A12" : "var(--nv-muted)"), textAlign: "center", lineHeight: 1.4 }}>
              {ar ? step.ar : step.en}
            </span>
            {step.time ? <span style={{ ...MONO, fontSize: 10.5, color: dark ? "#A9CDB8" : "var(--nv-muted)" }}>{step.time}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

/** بدأ ← قبل ← بعد ← خُتم for a proof record. */
export function workProofSteps(p, row = {}) {
  const beforeCaptured = !!(row.before || p.beforeUrl || p.beforeStamp);
  const afterCaptured = !!(row.after || p.afterUrl || p.afterStamp);
  const sealed = ["sealed", "accepted"].includes(p.stage || "") || !!(p.sealId || p.approvedAt || p.acceptedAt);
  return [
    { key: "start", ar: "بدأ العمل", en: "Started", done: !!(p.startedAt || p.createdAt), time: clockOf("", p.startedAt || p.createdAt) },
    { key: "before", ar: "صورة قبل", en: "Before", done: beforeCaptured, time: clockOf(p.beforeStamp) },
    { key: "after", ar: "صورة بعد", en: "After", done: afterCaptured, time: clockOf(p.afterStamp, p.endedAt) },
    { key: "seal", ar: "خُتم للجهة", en: "Sealed", done: sealed, time: "" },
  ];
}

/** An outside party at the branch: who, where, the before/after pair, and how far the proof has come. */
export default function WorkProofRecordCard({ row, ar, onOpen, actions }) {
  const [hover, setHover] = useState(false);
  const p = row.proof || {};
  const workers = Array.isArray(row.workers) ? row.workers.filter(Boolean) : [];
  const crewOut = (Array.isArray(row.proof?.people) ? row.proof.people : []).filter((p) => p?.name && p.outAt).length;
  const individual = row.scopeKind === "person";
  const paint = TONE[row.statusKind] || TONE.info;
  const beforeCaptured = !!(row.before || p.beforeStamp);
  const afterCaptured = !!(row.after || p.afterStamp);
  const sealed = ["sealed", "accepted"].includes(p.stage || "") || !!(p.sealId || p.approvedAt || p.acceptedAt);
  const startClock = clockOf("", p.startedAt || p.createdAt);
  const running = !afterCaptured && !sealed && p.status !== "rejected";
  const meta = (Array.isArray(row.meta) ? row.meta : []).filter(Boolean);
  const steps = [
    { key: "start", ar: "بدأ العمل", en: "Started", done: !!(p.startedAt || p.createdAt), time: startClock },
    { key: "before", ar: "صورة قبل", en: "Before", done: beforeCaptured, time: clockOf(p.beforeStamp) },
    { key: "after", ar: "صورة بعد", en: "After", done: afterCaptured, time: clockOf(p.afterStamp, p.endedAt) },
    { key: "seal", ar: "خُتم للجهة", en: "Sealed", done: sealed, time: "" },
  ];

  return (
    <article
      role="button"
      tabIndex={0}
      data-wp-card={p.ref || row.id}
      onClick={() => onOpen?.(row)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen?.(row); } }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: "16px 18px 14px",
        borderRadius: 12,
        background: "var(--nv-card)",
        border: `1px solid ${hover ? "#0B3D27" : "var(--nv-line)"}`,
        boxShadow: hover ? "0 10px 24px var(--nv-shadow)" : "var(--nv-paper)",
        cursor: "pointer",
        textAlign: "start",
        overflow: "hidden",
      }}
    >
      <header style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
        <span aria-hidden style={{ width: 38, height: 38, borderRadius: 9, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: individual ? "var(--nv-warn-soft)" : "var(--nv-ok-soft)", color: individual ? "var(--nv-warn-ink)" : "var(--nv-ok-ink)", fontSize: 13, fontWeight: 700 }}>
          {markOf(row.owner)}
        </span>
        <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span aria-hidden data-state-dot="1" style={{ width: 8, height: 8, borderRadius: 999, background: paint.edge, flexShrink: 0 }} />
            <strong style={{ fontFamily: "var(--font-heading)", fontSize: 16, fontWeight: 700, color: "var(--nv-ink)", lineHeight: 1.4 }}>{row.title}</strong>
          </span>
          <span style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.6 }}>
            {row.owner}
            {row.station ? <span style={{ color: "var(--nv-muted)" }}>{ar ? ` في ${row.station}` : ` at ${row.station}`}</span> : null}
          </span>
        </span>
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 24, padding: "0 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: paint.pill, border: `1px solid ${paint.line}`, color: paint.ink }}>
            {running ? <span aria-hidden className="nv-live-dot" style={{ width: 7, height: 7, borderRadius: 999, background: "#C8A45A" }} /> : null}
            {row.statusLabel}
          </span>
          {running && p.startedAt ? (
            <span data-wp-elapsed="1" style={{ fontSize: 11, color: "var(--nv-muted)", fontWeight: 600 }}>{workElapsedLabel(p.startedAt, ar)}</span>
          ) : null}
        </span>
      </header>

      <div className="nv-wp-body" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.25fr) minmax(0, 1fr)", gap: 16, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 10, minWidth: 0 }}>
          <PhotoFrame ar={ar} label={ar ? "قبل" : "Before"} url={p.beforeUrl} time={clockOf(p.beforeStamp)} captured={beforeCaptured} pending={ar ? "بانتظار الصورة" : "Photo due"} />
          <PhotoFrame ar={ar} label={ar ? "بعد" : "After"} url={p.afterUrl} time={clockOf(p.afterStamp, p.endedAt)} captured={afterCaptured} pending={ar ? "تُلتقط عند الإنهاء" : "Taken at the end"} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <StageRail ar={ar} steps={steps} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <span style={{ fontSize: 11, color: "var(--nv-muted)", ...MONO }}>{row.ref}</span>
            {meta.map((m) => (
              <span key={m} style={{ fontSize: 11, fontWeight: 600, color: /خارج النطاق|Outside range/.test(m) ? "var(--nv-bad-ink)" : "var(--nv-ink2)", background: /خارج النطاق|Outside range/.test(m) ? "var(--nv-bad-soft)" : "var(--nv-soft)", borderRadius: 999, padding: "2px 9px" }}>{m}</span>
            ))}
          </div>
        </div>
      </div>

      {row.ownerChip ? (
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-bad-ink)", background: "var(--nv-bad-soft)", borderRadius: 10, padding: "7px 12px" }}>{row.ownerChip}</span>
      ) : null}

      <footer style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", paddingTop: 12, borderTop: "1px solid var(--nv-line2, #EEF2F7)" }}>
        {workers.length ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <Users size={14} color="var(--nv-muted)" strokeWidth={1.75} aria-hidden />
            <span style={{ display: "inline-flex" }}>
              {workers.slice(0, 4).map((name, i) => (
                <span key={name} title={name} style={{ width: 24, height: 24, borderRadius: 999, marginInlineStart: i ? -6 : 0, border: "2px solid var(--nv-card)", background: "#E6EFE9", color: "#0B3D27", fontSize: 10, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  {markOf(name)}
                </span>
              ))}
            </span>
            <span data-wp-crew="1" style={{ fontSize: 11.5, color: "var(--nv-ink2)", fontWeight: 600 }}>
              {crewOut ? (ar ? `${workers.length - crewOut} في الموقع من ${workers.length}` : `${workers.length - crewOut} of ${workers.length} on site`) : (ar ? `${workers.length} من عمال الجهة` : `${workers.length} crew`)}
            </span>
          </span>
        ) : null}
        {row.creator ? (
          <span style={{ fontSize: 11.5, color: "var(--nv-muted)" }}>{ar ? `رفعه ${row.creator}` : `Raised by ${row.creator}`}</span>
        ) : null}
        <span onClick={(e) => e.stopPropagation()} style={{ marginInlineStart: "auto" }}>{actions}</span>
      </footer>
    </article>
  );
}
