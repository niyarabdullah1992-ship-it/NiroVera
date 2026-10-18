import React, { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { buildMyFileCard } from "@/lib/myFileCard";
import { buildServiceStory } from "@/lib/serviceStory";
import { buildFileReadiness } from "@/lib/fileReadiness";
import RightHint from "@/components/shared/RightHint";
import NvIcon from "@/components/shared/NvIcon";

/*
 * «ملفي — سيرة عملي الموثّقة». Three things, in this order:
 *   بطاقتي المهنية — the key file facts on one card, with print and the service-certificate request;
 *   قصة خدمتي     — what happened on the file, by year, each line with who did it and what proves it;
 *   جاهزية ملفي   — what is missing or ending, and whose move it is.
 * Leave, balances and injuries stay in طلباتي; pay stays in قسيمتي. Nothing here repeats them.
 */

const mono = { fontFamily: "'IBM Plex Mono', monospace" };
const paper = { background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 12, overflow: "hidden" };
const heading = { margin: 0, fontFamily: "var(--font-heading)", fontSize: 16, fontWeight: 700, color: "var(--nv-ink)" };
const sub = { margin: "3px 0 0", fontSize: 12, color: "var(--nv-ink3)", lineHeight: 1.7 };
const greenLink = { fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: "var(--nv-ok-ink)", background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "none", whiteSpace: "nowrap" };

const CHIP = {
  ok: { color: "var(--nv-ok-ink)", background: "var(--nv-ok-soft)" },
  warn: { color: "var(--nv-warn-ink)", background: "var(--nv-warn-soft)" },
  bad: { color: "var(--nv-bad-ink)", background: "var(--nv-bad-soft)" },
  mute: { color: "var(--nv-mute-ink)", background: "var(--nv-mute-soft)" },
};

function Chip({ tone = "mute", children, title }) {
  return (
    <span title={title} style={{ ...CHIP[tone], fontSize: 10.5, fontWeight: 700, lineHeight: 1, padding: "4px 7px", borderRadius: 999, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 }}>
      {children}
    </span>
  );
}

function SectionHead({ title, note, end }) {
  return (
    <header style={{ padding: "16px 20px 14px", borderBottom: "1px solid var(--nv-line)", display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <h3 style={heading}>{title}</h3>
        {note ? <p style={sub}>{note}</p> : null}
      </div>
      {end}
    </header>
  );
}

/* ─────────────────────────── the seal ─────────────────────────── */

const PRINT_CSS = `
@page { size: A5 landscape; margin: 10mm; }
@media print {
  body * { visibility: hidden !important; }
  .nv-myfile-card, .nv-myfile-card * { visibility: visible !important; }
  .nv-myfile-card {
    position: fixed !important; inset: 0 !important; margin: 0 !important; box-shadow: none !important;
    --nv-card: #fff; --nv-ink: #111418; --nv-ink2: #3A4048; --nv-ink3: #555C66; --nv-line: #DCE3DF;
    --nv-soft: #F5F7F6; --nv-warn-ink: #8A5A12; --nv-warn-soft: #FBF3E1;
    background: #fff !important; color: #111418 !important;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .nv-myfile-noprint { display: none !important; }
  .nv-myfile-printonly { display: flex !important; }
}`;

/** Print the card alone, A5 landscape — a scoped stylesheet lives only for this print. */
function printCard() {
  const style = document.createElement("style");
  style.setAttribute("data-myfile-print", "1");
  style.textContent = PRINT_CSS;
  document.head.appendChild(style);
  const drop = () => style.remove();
  window.addEventListener("afterprint", drop, { once: true });
  try {
    window.print();
  } finally {
    setTimeout(drop, 1500);
  }
}

/* ─────────────────────────── 1 · بطاقتي المهنية ─────────────────────────── */

function ProfessionalCard({ card, ar, self, companyName }) {
  const navigate = useNavigate();
  const title = ar ? (self ? "بطاقتي المهنية" : "بطاقته المهنية") : (self ? "My professional card" : "Professional card");
  const btn = { fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, height: 34, padding: "0 14px", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap" };
  return (
    <>
    <style>{".nv-myfile-printonly{display:none}"}</style>
    <section className="nv-myfile-card" aria-label={title} style={paper}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "14px 20px", borderBottom: "1px solid var(--nv-line)" }}>
        <div style={{ minWidth: 0, flex: "1 1 200px" }}>
          <h3 style={heading}>{title}</h3>
          {companyName ? <p style={sub}>{companyName}</p> : null}
        </div>
        <div className="nv-myfile-noprint" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={printCard} style={{ ...btn, border: "1px solid var(--nv-line)", background: "transparent", color: "var(--nv-ink)" }}>
            {ar ? "طباعة" : "Print"}
          </button>
          {self ? (
            <button type="button" onClick={() => navigate("/app/requests?kind=doc&doc=exp")} style={{ ...btn, border: "1px solid var(--nv-ok-ink)", background: "var(--nv-ok-ink)", color: "#fff" }}>
              {ar ? "طلب شهادة خدمة" : "Request service certificate"}
            </button>
          ) : null}
        </div>
      </div>
      <div className="nv-myfile-printonly" style={{ alignItems: "center", gap: 14, padding: "16px 20px 0" }}>
        <div>
          <div style={{ fontFamily: "var(--font-heading)", fontSize: 20, fontWeight: 700, color: "var(--nv-ink)" }}>{card.name}</div>
          <div style={{ fontSize: 13, color: "var(--nv-ink2)" }}>{card.job} · {card.branch}</div>
        </div>
      </div>
      <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,150px),1fr))" }}>
        {card.rows.map((row) => (
          <div key={row.id} style={{ padding: "14px 20px", borderBottom: "1px solid var(--nv-line2, var(--nv-line))", minWidth: 0 }}>
            <dt style={{ fontSize: 11.5, color: "var(--nv-ink3)", marginBottom: 4 }}>{row.k}</dt>
            <dd style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--nv-ink)", display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", overflowWrap: "anywhere" }}>
              <span dir={row.mono ? "ltr" : undefined} style={row.mono ? { ...mono, fontSize: 13 } : undefined}>{row.v}</span>
              {row.gap ? <Chip tone="warn">{ar ? "ناقص" : "Missing"}</Chip> : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
    </>
  );
}

/* ─────────────────────────── 2 · قصة خدمتي ─────────────────────────── */

const PROOF_TONE = { sealed: "warn", signed: "ok", ack: "ok", log: "mute" };

function ServiceStory({ story, ar, self }) {
  const title = ar ? (self ? "قصة خدمتي" : "قصة خدمته") : (self ? "My service story" : "Service story");
  return (
    <section style={paper}>
      <SectionHead
        title={title}
        note={story.count
          ? (ar ? "كل سطر من سجل في الملف: متى، ومن أجراه، وما يثبته — الأحدث أولاً." : "Each line comes from a record: when, who, and what proves it — newest first.")
          : null}
      />
      {story.count === 0 ? (
        <p style={{ margin: 0, padding: "16px 20px", fontSize: 12.5, color: "var(--nv-ink3)" }}>
          {ar ? "لا حدث مثبتاً في الملف بعد." : "Nothing proven on the file yet."}
        </p>
      ) : story.years.map((y) => (
        <details key={y.year} open={y.open} style={{ borderTop: "1px solid var(--nv-line)" }}>
          <summary style={{ cursor: "pointer", padding: "12px 20px" }}>
            <strong style={{ ...mono, fontSize: 15, color: "var(--nv-ink)", marginInlineEnd: 10, display: "inline-block" }}>{y.year}</strong>
            <span style={{ fontSize: 11.5, color: "var(--nv-ink3)" }}>
              {ar ? (y.events.length === 1 ? "حدث واحد" : y.events.length === 2 ? "حدثان" : `${y.events.length} ${y.events.length <= 10 ? "أحداث" : "حدثاً"}`) : `${y.events.length} event${y.events.length === 1 ? "" : "s"}`}
            </span>
          </summary>
          <ol style={{ listStyle: "none", margin: 0, padding: "0 20px 14px" }}>
            {y.events.map((e, i) => (
              <li key={e.id} style={{ display: "grid", gridTemplateColumns: "14px minmax(0,1fr)", gap: 12 }}>
                <span aria-hidden style={{ position: "relative", display: "block" }}>
                  <span style={{ position: "absolute", insetInlineStart: 6, top: 0, bottom: 0, width: 1, background: i === y.events.length - 1 ? "transparent" : "var(--nv-line)" }} />
                  <span style={{ position: "absolute", insetInlineStart: 2, top: 9, width: 9, height: 9, borderRadius: "50%", background: "var(--nv-card)", border: "1.5px solid var(--nv-ink3)" }} />
                </span>
                <div style={{ padding: "4px 0 14px", minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: "var(--nv-ink)", lineHeight: 1.75, overflowWrap: "anywhere" }}>{e.text}</div>
                  <div style={{ marginTop: 3, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 11.5, color: "var(--nv-ink3)" }}>
                    <span>{e.at}</span>
                    <span aria-hidden>·</span>
                    <span>{e.actor}</span>
                    <Chip tone={PROOF_TONE[e.proof.id]} title={e.proof.hash ? `SHA-256 ${e.proof.hash}…` : undefined}>
                      {e.proof.label}
                      {e.proof.hash ? <span dir="ltr" style={{ ...mono, fontWeight: 500 }}>{e.proof.hash}</span> : null}
                    </Chip>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </details>
      ))}
    </section>
  );
}

/* ─────────────────────────── 3 · جاهزية ملفي ─────────────────────────── */

const STATE_CHIP = {
  missing: { tone: "mute", ar: "ناقص", en: "Missing" },
  expiring: { tone: "warn", ar: "ينتهي قريباً", en: "Ending soon" },
  expired: { tone: "bad", ar: "منتهٍ", en: "Expired" },
};

function ReadinessAction({ action, onOpenTab }) {
  if (!action?.label) return null;
  if (action.to) return <Link to={action.to} style={greenLink}>{action.label} ‹</Link>;
  return <button type="button" onClick={() => onOpenTab?.(action.tab)} style={greenLink}>{action.label} ‹</button>;
}

function Readiness({ readiness, ar, self, onOpenTab }) {
  const { open, done, total, filled } = readiness;
  const pct = total ? Math.round((filled / total) * 100) : 100;
  const title = ar ? (self ? "جاهزية ملفي" : "جاهزية ملفه") : (self ? "My file readiness" : "File readiness");
  return (
    <section style={paper}>
      <SectionHead
        title={title}
        note={ar ? (self ? "ما ينقص الملف أو يقترب انتهاؤه، وعلى من الخطوة." : "What the file misses or is about to lose, and whose move it is.") : "What is missing or ending, and whose move it is."}
        end={(
          <div style={{ flex: "0 1 200px", minWidth: 150, display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12.5, color: "var(--nv-ink)", fontWeight: 600 }}>
              {ar ? `${filled} من ${total} مكتمل` : `${filled} of ${total} complete`}
            </span>
            <span role="meter" aria-valuemin={0} aria-valuemax={total} aria-valuenow={filled} aria-label={title} style={{ display: "block", height: 4, borderRadius: 999, background: "var(--nv-line)", overflow: "hidden" }}>
              <span style={{ display: "block", height: "100%", width: `${pct}%`, background: "var(--nv-ok-fill)", borderRadius: 999 }} />
            </span>
          </div>
        )}
      />
      {open.length === 0 ? (
        <p style={{ margin: 0, padding: "16px 20px", fontSize: 12.5, color: "var(--nv-ink3)" }}>
          {ar ? "الملف مكتمل — لا نقص ولا انتهاء قريب." : "The file is complete — nothing missing or ending soon."}
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {open.map((item) => {
            const chip = STATE_CHIP[item.state] || STATE_CHIP.missing;
            return (
              <li key={item.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 14px", padding: "12px 20px", borderTop: "1px solid var(--nv-line)" }}>
                <span aria-hidden style={{ width: 10, height: 10, flex: "none", borderRadius: "50%", border: "1.5px solid var(--nv-ink3)" }} />
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--nv-ink)" }}>{item.label}</span>
                    <Chip tone={chip.tone}>{ar ? chip.ar : chip.en}</Chip>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--nv-ink3)", lineHeight: 1.7, marginTop: 2 }}>{item.note}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginInlineStart: "auto" }}>
                  <span style={{ fontSize: 11.5, color: "var(--nv-ink2)", fontWeight: 600 }}>{item.ownerLabel}</span>
                  {item.hint ? <RightHint hint={item.hint} ar={ar} /> : null}
                  <ReadinessAction action={item.action} onOpenTab={onOpenTab} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {done.length ? (
        <details style={{ borderTop: "1px solid var(--nv-line)" }}>
          <summary style={{ cursor: "pointer", padding: "11px 20px", fontSize: 12, color: "var(--nv-ink3)" }}>
            {ar ? `المكتمل (${done.length})` : `Complete (${done.length})`}
          </summary>
          <ul style={{ listStyle: "none", margin: 0, padding: "0 20px 12px" }}>
            {done.map((item) => (
              <li key={item.id} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "5px 0", fontSize: 12.5 }}>
                <NvIcon name="check" tone="ok" size={13} strokeWidth={2} />
                <span style={{ color: "var(--nv-ink)" }}>{item.label}</span>
                <span style={{ color: "var(--nv-ink3)", fontSize: 11.5, minWidth: 0, overflowWrap: "anywhere" }}>{item.note}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

/* ─────────────────────────── 4 · compliance and linked records ─────────────────────────── */

/* ─────────────────────────── the tab ─────────────────────────── */

export default function EmployeeFileSummary({
  view,
  ar,
  onOpenTab,
  employee,
  isSelf = false,
  roleLabel = "",
  stationName = "",
  companyName = "",
  cases = [],
  assets = [],
  regulation = null,
  canEditFile = false,
}) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
  const card = useMemo(() => buildMyFileCard({ employee, roleLabel, stationName, ar, today }), [employee, roleLabel, stationName, ar, today]);
  const story = useMemo(() => buildServiceStory({ employee, cases, assets, regulation, roleLabel, selfView: isSelf, includeSanctions: !isSelf, ar, today }), [employee, cases, assets, regulation, roleLabel, isSelf, ar, today]);
  const readiness = useMemo(() => buildFileReadiness({ employee, regulation, roleLabel, view: isSelf ? "employee" : "manager", canEditFile, ar, today }), [employee, regulation, roleLabel, isSelf, canEditFile, ar, today]);

  return (
    <div data-myfile="" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ padding: "4px 2px 0" }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-heading)", fontSize: 19, fontWeight: 700, color: "var(--nv-ink)" }}>
          {ar ? (isSelf ? "ملفي — سيرة عملي الموثّقة" : "ملفه — سيرة عمله الموثّقة") : (isSelf ? "My file — a proven work record" : "File — a proven work record")}
        </h2>
        <p style={sub}>
          {ar
            ? "ما في هذه الصفحة مشتق من سجلات الملف، وكل سطر معه ما يثبته. الإجازات في طلباتي، والأجر في قسيمتي."
            : "Everything here is derived from the file's records, each line with its proof. Leave is in My requests, pay in My payslip."}
        </p>
      </div>
      <ProfessionalCard card={card} ar={ar} self={isSelf} companyName={companyName} />
      <ServiceStory story={story} ar={ar} self={isSelf} />
      <Readiness readiness={readiness} ar={ar} self={isSelf} onOpenTab={onOpenTab} />
      {/* The ministry compliance rows (contract, GOSI, insurance, documents) are the readiness items above — not repeated. */}
    </div>
  );
}
