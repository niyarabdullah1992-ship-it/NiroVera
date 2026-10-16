import React, { useEffect, useId, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EXPIRY_WARN_DAYS } from "@/lib/complianceDerivations";
import { buildMyFileCard, fileSealCode } from "@/lib/myFileCard";
import { buildServiceStory } from "@/lib/serviceStory";
import { buildFileReadiness } from "@/lib/fileReadiness";
import RightHint from "@/components/shared/RightHint";
import { toast } from "@/components/ui/use-toast";

/*
 * «ملفي — سيرة عملي الموثّقة». Three things, in this order:
 *   بطاقتي المهنية — the person on one document-like card, sealed with a code derived from its facts;
 *   قصة خدمتي     — what happened on the file, by year, each line with who did it and what proves it;
 *   جاهزية ملفي   — what is missing or ending, and whose move it is.
 * Leave, balances and injuries stay in طلباتي; pay stays in قسيمتي. Nothing here repeats them.
 */

const SEAL_INK = "#C8A45A";
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

function ProofSeal({ code, ar, size = 148 }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const top = ar ? "ختم الإثبات" : "PROOF SEAL";
  const bottom = ar ? "ملف موثّق من سجلاته" : "PROVEN BY ITS RECORDS";
  const [a, b] = code ? [code.slice(0, 9), code.slice(10)] : ["····-····", "····"];
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" role="img" aria-label={ar ? `ختم الإثبات — رمز الملف ${code || ""}` : `Proof seal — file code ${code || ""}`} style={{ display: "block", transform: "rotate(-7deg)" }}>
      <defs>
        {/* Two arcs read upright: the title over the top, the line under the bottom (a full RTL ring path drops Arabic in Chromium). */}
        <path id={`top${uid}`} d="M24,80 a56,56 0 0,1 112,0" />
        <path id={`bot${uid}`} d="M16,80 a64,64 0 0,0 128,0" />
        <filter id={`ink${uid}`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" />
        </filter>
      </defs>
      <g fill="none" stroke={SEAL_INK} filter={`url(#ink${uid})`} opacity="0.95">
        <circle cx="80" cy="80" r="75" strokeWidth="2.4" />
        <circle cx="80" cy="80" r="70" strokeWidth="0.9" />
        <circle cx="80" cy="80" r="45" strokeWidth="0.9" />
      </g>
      <g fill={SEAL_INK} filter={`url(#ink${uid})`}>
        <text fontSize="12" fontWeight="700" textAnchor="middle" style={{ fontFamily: "var(--font-heading)" }}>
          <textPath href={`#top${uid}`} startOffset="50%">{top}</textPath>
        </text>
        <text fontSize="9.5" fontWeight="700" textAnchor="middle" style={{ fontFamily: "var(--font-heading)" }}>
          <textPath href={`#bot${uid}`} startOffset="50%">{bottom}</textPath>
        </text>
        <text x="15" y="83" textAnchor="middle" fontSize="8">✦</text>
        <text x="145" y="83" textAnchor="middle" fontSize="8">✦</text>
        <text x="80" y="66" textAnchor="middle" fontSize="9.5" fontWeight="600" style={{ fontFamily: "var(--font-heading)" }}>{ar ? "رمز الملف" : "FILE CODE"}</text>
        <text x="80" y="84" textAnchor="middle" fontSize="12.5" fontWeight="700" direction="ltr" style={mono}>{a}</text>
        <text x="80" y="100" textAnchor="middle" fontSize="12.5" fontWeight="700" direction="ltr" style={mono}>{b}</text>
      </g>
    </svg>
  );
}

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
  const [code, setCode] = useState("");
  useEffect(() => {
    let live = true;
    fileSealCode(card.sealText).then((c) => { if (live) setCode(c); });
    return () => { live = false; };
  }, [card.sealText]);

  const verify = async () => {
    try { await navigator.clipboard?.writeText(code); } catch { /* the code stays visible on the seal */ }
    if (self) {
      toast({ description: ar ? `نُسخ رمز الملف ${code}. أرفقه بطلب شهادة الخدمة — تصدر مختومة وتُتحقق من صفحة التحقق (المادة 64).` : `File code ${code} copied. Attach it to the service-certificate request — it is issued sealed and verifiable (Art. 64).` });
      navigate("/app/requests?kind=doc&doc=exp");
    } else {
      toast({ description: ar ? `نُسخ رمز الملف ${code}. يطابق بيانات الملف الآن؛ أي تعديل على بيان أساسي يغيّره.` : `File code ${code} copied. It matches the file now; editing a key fact changes it.` });
    }
  };

  return (
    <>
    <style>{".nv-myfile-printonly{display:none}"}</style>
    <section className="nv-myfile-card" aria-label={ar ? (self ? "بطاقتي المهنية" : "بطاقته المهنية") : "Professional card"} style={{ position: "relative", background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 14, padding: "22px clamp(16px,4vw,28px) 20px", boxShadow: "var(--nv-paper)" }}>
      <span aria-hidden style={{ position: "absolute", inset: 6, border: "1px solid var(--nv-line)", borderRadius: 10, pointerEvents: "none" }} />
      <div style={{ position: "relative", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", paddingBottom: 14, marginBottom: 16, borderBottom: "1px solid var(--nv-line)" }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ar ? 0 : 1.2, color: "var(--nv-ink2)" }}>{ar ? (self ? "بطاقتي المهنية" : "بطاقته المهنية") : (self ? "My professional card" : "Professional card")}</span>
        {companyName ? <span style={{ fontSize: 11.5, color: "var(--nv-ink3)" }}>· {companyName}</span> : null}
        <button type="button" className="nv-myfile-noprint" onClick={printCard} style={{ marginInlineStart: "auto", fontFamily: "inherit", fontSize: 12, fontWeight: 600, height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid var(--nv-line)", background: "transparent", color: "var(--nv-ink)", cursor: "pointer" }}>
          {ar ? "اطبع البطاقة" : "Print card"}
        </button>
      </div>

      <div style={{ position: "relative", display: "flex", flexWrap: "wrap", gap: "20px 28px", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 280px", minWidth: 0 }}>
          <div className="nv-myfile-printonly" style={{ alignItems: "center", gap: 14, marginBottom: 16 }}>
            <span aria-hidden style={{ width: 56, height: 56, flex: "none", borderRadius: "50%", border: "1px solid var(--nv-line)", background: "var(--nv-soft)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-heading)", fontSize: 19, fontWeight: 700, color: "var(--nv-ink)" }}>
              {card.initials}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-heading)", fontSize: 20, fontWeight: 700, color: "var(--nv-ink)", lineHeight: 1.35, overflowWrap: "anywhere" }}>{card.name}</div>
              <div style={{ fontSize: 13, color: "var(--nv-ink2)", lineHeight: 1.6, overflowWrap: "anywhere" }}>{card.job} <span style={{ color: "var(--nv-ink3)" }}>·</span> {card.branch}</div>
            </div>
          </div>
          <dl style={{ margin: 0 }}>
            {card.rows.map((row) => (
              <div key={row.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,9em) minmax(0,1fr)", gap: 12, alignItems: "baseline", padding: "8px 0", borderTop: "1px dotted var(--nv-line)" }}>
                <dt style={{ fontSize: 12, color: "var(--nv-ink3)" }}>{row.k}</dt>
                <dd style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--nv-ink)", display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", minWidth: 0, overflowWrap: "anywhere" }}>
                  <span dir={row.mono ? "ltr" : undefined} style={row.mono ? { ...mono, fontSize: 12.5 } : undefined}>{row.v}</span>
                  {row.gap ? <Chip tone="warn">{ar ? "ناقص" : "Missing"}</Chip> : null}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div style={{ flex: "0 1 190px", margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center", paddingTop: 4 }}>
          <ProofSeal code={code} ar={ar} />
          <button type="button" className="nv-myfile-noprint" onClick={verify} disabled={!code} style={{ ...greenLink, opacity: code ? 1 : 0.5 }}>
            {ar ? (self ? "تحقق — اطلب شهادة خدمة مختومة ‹" : "تحقق — انسخ رمز الملف") : (self ? "Verify — request a sealed certificate ›" : "Verify — copy the file code")}
          </button>
          <span style={{ fontSize: 11, color: "var(--nv-ink3)", lineHeight: 1.65, maxWidth: 190 }}>
            {ar ? "الرمز مشتق من بيانات البطاقة ولا يُخزَّن — يتغيّر إن تغيّر أي بيان فيها." : "Derived from the card's facts, never stored — it changes when any of them does."}
          </span>
        </div>
      </div>
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
                <span aria-hidden style={{ color: "var(--nv-ok-ink)", fontWeight: 700 }}>✓</span>
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

function LinkedRecords({ view, ar, self, onOpenTab }) {
  const live = (view.penalties || []).filter((row) => row.tone === "warn").length;
  const soon = (view.docs || []).some((row) => row.days != null && row.days <= EXPIRY_WARN_DAYS);
  const links = [
    { label: ar ? "التدرّج والجزاءات" : "Progression and sanctions", what: live ? (ar ? `${live === 1 ? "جزاء ساري" : `${live} جزاءات سارية`}` : `${live} live`) : (ar ? "لا جزاء ساري" : "None live"), tab: "growth" },
    { label: ar ? (self ? "طلباتي" : "الطلبات") : "Requests", what: view.hasPendingLeave ? view.pendingPointer : (ar ? "الإجازات والأرصدة والإصابات تُتابَع هناك" : "Leave, balances and injuries live there"), href: view.pendingHref || "/app/requests" },
    { label: ar ? (self ? "قسيمتي" : "المسير") : "Payslip", what: ar ? "الأجر وبنوده يُقرأ هناك لا هنا" : "Pay is read there, not here", href: self ? "/app/payroll?view=self&tab=payslip" : "/app/payroll" },
    { label: ar ? "التوقيعات" : "Signatures", what: ar ? "المستندات المختومة وصفحة التحقق" : "Sealed documents and verification", href: "/app/signing" },
    { label: ar ? "السلامة" : "Safety", what: soon ? (ar ? "شهادة تنتهي قريباً" : "A certificate ends soon") : (ar ? "الشهادات والتدريب الإلزامي" : "Certificates and mandatory training"), href: "/app/safety" },
  ];
  const row = { display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "4px 12px", padding: "11px 20px", textDecoration: "none", color: "inherit", fontFamily: "inherit", textAlign: "start", width: "100%", border: "none", background: "transparent", cursor: "pointer", boxSizing: "border-box" };
  return (
    <section style={paper}>
      <SectionHead title={ar ? "السجلات المرتبطة" : "Linked records"} note={ar ? "تفتح سجلها ولا تُنسخ هنا." : "They open their own record."} />
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {links.map((l) => {
          const inner = (
            <>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--nv-ink)", minWidth: "7em" }}>{l.label}</span>
              <span style={{ flex: "1 1 180px", minWidth: 0, fontSize: 12, color: "var(--nv-ink3)", lineHeight: 1.7 }}>{l.what}</span>
              <span style={greenLink}>{ar ? "افتح ‹" : "Open ›"}</span>
            </>
          );
          return (
            <li key={l.label} style={{ borderTop: "1px solid var(--nv-line)" }}>
              {l.href ? <Link to={l.href} style={row}>{inner}</Link> : <button type="button" onClick={() => onOpenTab?.(l.tab)} style={row}>{inner}</button>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

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
}) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
  const card = useMemo(() => buildMyFileCard({ employee, roleLabel, stationName, ar, today }), [employee, roleLabel, stationName, ar, today]);
  const story = useMemo(() => buildServiceStory({ employee, cases, assets, regulation, roleLabel, selfView: isSelf, ar, today }), [employee, cases, assets, regulation, roleLabel, isSelf, ar, today]);
  const readiness = useMemo(() => buildFileReadiness({ employee, regulation, roleLabel, view: isSelf ? "employee" : "manager", ar, today }), [employee, regulation, roleLabel, isSelf, ar, today]);

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
      <LinkedRecords view={view} ar={ar} self={isSelf} onOpenTab={onOpenTab} />
    </div>
  );
}
