import React, { useEffect, useRef, useState } from "react";

/*
 * The Proof Cycle, shown instead of described: one work order travels the six links, and the window
 * shows what each link looks like inside the platform — the punch inside the geofence, the task with
 * its evidence, the written review, the escalation clock, the signature and the client proof.
 * The stepper under it is the control: it advances on its own until the visitor takes over
 * (hover, focus or a click), and stays still for anyone who asked for reduced motion.
 */

const G = "#0B3D27";
const FILL = "#3C7D50";
const GOLD = "#C8A45A";
const LINE = "#E4E9E6";
const INK = "#111418";
const MID = "#555C66";
const HEAD = "var(--font-heading, 'Readex Pro','IBM Plex Sans Arabic',sans-serif)";
const MONO = { fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)", fontVariantNumeric: "tabular-nums" };
const STEP_MS = 4600;

function Chip({ tone = "ok", children }) {
  const tones = {
    ok: ["#E7F4EC", "#1F7A4D"],
    bad: ["#FBEDEA", "#A3352A"],
    warn: ["#FBF3DF", "#7A5B1C"],
    mute: ["#EEF1EF", MID],
  };
  const [bg, fg] = tones[tone] || tones.mute;
  return <span style={{ display: "inline-flex", alignItems: "center", height: 22, padding: "0 9px", borderRadius: 999, background: bg, color: fg, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>{children}</span>;
}

function Row({ start, end, first = false }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 0", borderTop: first ? "none" : `1px solid ${LINE}`, fontSize: 13, color: INK }}>
      <span style={{ minWidth: 0 }}>{start}</span>
      <span style={{ flexShrink: 0 }}>{end}</span>
    </div>
  );
}

function Num({ children }) {
  return <bdi dir="ltr" style={MONO}>{children}</bdi>;
}

/** What each link looks like inside the platform. */
function Panel({ step, T }) {
  if (step === 0) {
    return (
      <>
        <div style={{ position: "relative", height: 118, borderRadius: 10, overflow: "hidden", background: "#EAF0EC" }}>
          <svg width="100%" height="118" viewBox="0 0 420 118" preserveAspectRatio="xMidYMid slice" aria-hidden>
            <g stroke="#D3DED7" strokeWidth="9"><line x1="0" y1="34" x2="420" y2="34" /><line x1="0" y1="92" x2="420" y2="92" /><line x1="110" y1="0" x2="110" y2="118" /><line x1="300" y1="0" x2="300" y2="118" /></g>
            <circle cx="292" cy="60" r="46" fill="rgba(60,125,80,.16)" stroke={FILL} strokeWidth="2" strokeDasharray="6 5" />
            <circle cx="300" cy="66" r="8" fill={FILL} stroke="#fff" strokeWidth="3" />
            <line x1="62" y1="96" x2="250" y2="70" stroke="#A3352A" strokeWidth="1.5" strokeDasharray="4 4" />
            <circle cx="62" cy="96" r="7" fill="#A3352A" />
          </svg>
        </div>
        <Row first start={<><Num>07:48</Num> {T("محاولة بصمة من خارج النطاق", "Punch attempt outside the fence")}</>} end={<Chip tone="bad">{T("مرفوضة", "Refused")}</Chip>} />
        <Row start={<><Num>07:53</Num> {T("بصمة دخول من الموقع", "Punch in, on site")}</>} end={<Chip>{T("داخل النطاق", "Inside the fence")}</Chip>} />
      </>
    );
  }
  if (step === 1) {
    return (
      <>
        <Row first start={<strong style={{ fontFamily: HEAD }}>{T("صيانة لوحة التوزيع الرئيسية", "Main distribution board service")}</strong>} end={<Chip tone="mute">{T("أمر عمل", "Work order")}{"\u00A0"}<Num>1042</Num></Chip>} />
        <Row
          start={T("وزن الجهد", "Effort weight")}
          end={<span style={{ display: "inline-flex", gap: 4 }}>{[0, 1, 2, 3, 4].map((i) => <span key={i} aria-hidden style={{ width: 22, height: 8, borderRadius: 4, background: i < 3 ? FILL : LINE }} />)}</span>}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "9px 0", borderTop: `1px solid ${LINE}` }}>
          {[T("صورة قبل", "Before photo"), T("صورة بعد", "After photo")].map((label) => (
            <div key={label} style={{ height: 58, borderRadius: 8, background: "repeating-linear-gradient(45deg,#EEF4F0 0 8px,#E3ECE6 8px 16px)", display: "flex", alignItems: "flex-end", padding: 6, fontSize: 11, fontWeight: 700, color: G }}>{label}</div>
          ))}
        </div>
        <Row start={T("إقرار الموظف بالإنجاز", "Employee attestation")} end={<Chip>{T("أقرّ", "Attested")}</Chip>} />
      </>
    );
  }
  if (step === 2) {
    return (
      <>
        <Row first start={T("المراجِع", "Reviewer")} end={<strong>{T("مشرف الموقع", "Site supervisor")}</strong>} />
        <Row start={T("القرار", "Decision")} end={<Chip>{T("اعتُمدت", "Approved")}</Chip>} />
        <div style={{ padding: "9px 0 4px", borderTop: `1px solid ${LINE}` }}>
          <div style={{ fontSize: 11.5, color: MID, marginBottom: 5 }}>{T("السبب المكتوب — شرط لإغلاق المراجعة", "Written reason — required to close the review")}</div>
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: "9px 11px", fontSize: 13, lineHeight: 1.75, color: INK, background: "#FAFBFA" }}>
            {T("مطابق لأمر العمل، والصور من داخل النطاق وفي وقت الدوام.", "Matches the work order; the photos are from inside the fence and within the shift.")}
          </div>
        </div>
        <Row start={T("سجل التدقيق", "Audit trail")} end={<Num>3 {T("أحداث", "events")}</Num>} />
      </>
    );
  }
  if (step === 3) {
    return (
      <>
        <Row first start={T("مهلة المراجعة", "Review window")} end={<Num>24 {T("ساعة", "h")}</Num>} />
        <div style={{ padding: "10px 0", borderTop: `1px solid ${LINE}` }}>
          <div style={{ height: 10, borderRadius: 6, background: LINE, overflow: "hidden" }}>
            <div style={{ width: "13%", height: "100%", background: FILL, borderRadius: 6 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11.5, color: MID }}>
            <span>{T("روجعت بعد", "Reviewed after")} <Num>3</Num> {T("ساعات", "hours")}</span>
            <span>{T("لم يُحتج إلى تصعيد", "No escalation needed")}</span>
          </div>
        </div>
        <Row start={T("لو انقضت المهلة بلا قرار", "Had the window run out")} end={<Chip tone="warn">{T("تصعد تلقائياً", "Auto-escalates")}</Chip>} />
        <Row start={T("إلى", "To")} end={<strong>{T("مدير الفرع", "Branch manager")}</strong>} />
      </>
    );
  }
  if (step === 4) {
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "4px 0 10px" }}>
          <svg width="150" height="54" viewBox="0 0 150 54" aria-hidden style={{ flexShrink: 0 }}>
            <path d="M8 38 C 22 8, 34 50, 48 26 S 70 12, 80 34 S 104 44, 116 20 S 136 30, 142 22" fill="none" stroke={G} strokeWidth="2.2" strokeLinecap="round" />
            <line x1="6" y1="48" x2="144" y2="48" stroke={LINE} strokeWidth="1.5" />
          </svg>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12.5, color: MID }}>
            <strong style={{ color: INK, fontSize: 13.5 }}>{T("مشرف الموقع", "Site supervisor")}</strong>
            <span>{T("وقّع داخل المنصة", "Signed in the platform")} · <Num>10:21</Num></span>
          </div>
        </div>
        <Row start={T("ترتيب الموقّعين", "Signing order")} end={<Num>2 / 2</Num>} />
        <Row start={T("بصمة الملف", "File fingerprint")} end={<span dir="ltr" style={{ ...MONO, fontSize: 12, color: "#7A5B1C" }}>sha256 · a41f…9c07</span>} />
        <Row start={T("إيصال الإرسال", "Dispatch receipt")} end={<Chip>{T("صدر", "Issued")}</Chip>} />
      </>
    );
  }
  return (
    <>
      <div style={{ border: `1px solid ${LINE}`, borderRadius: 10, padding: "10px 12px", background: "#FAFBFA", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 12.5, color: MID }}>{T("رابط تحقق عام", "Public verify link")}</span>
        <span dir="ltr" style={{ ...MONO, fontSize: 12.5, color: G, fontWeight: 700 }}>/proof/1042</span>
      </div>
      <Row first start={T("المهمة والتاريخ والموقع", "Task, date and site")} end={<Chip>{T("ظاهرة للعميل", "Shown to the client")}</Chip>} />
      <Row start={T("الأجر وهوية الموظف", "Pay and identity")} end={<Chip tone="mute">{T("محجوبة", "Withheld")}</Chip>} />
      <Row start={T("البصمة مطابقة للسجل", "Fingerprint matches the record")} end={<Chip>{T("موثّق", "Verified")}</Chip>} />
    </>
  );
}

export default function ProofWindow({ chain, ar, children }) {
  const T = (a, e) => (ar ? a : e);
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(true);
  const hover = useRef(false);

  useEffect(() => {
    if (!auto) return undefined;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    const id = setInterval(() => {
      if (!hover.current) setStep((s) => (s + 1) % chain.length);
    }, STEP_MS);
    return () => clearInterval(id);
  }, [auto, chain.length]);

  const [nameAr, nameEn, noteAr, noteEn] = chain[step];

  return (
    <div
      data-nv="proof"
      onMouseEnter={() => { hover.current = true; }}
      onMouseLeave={() => { hover.current = false; }}
      style={{ display: "flex", flexDirection: "column", gap: 18 }}
    >
      <div data-nv="proof-top">
        <div data-nv="proof-copy" style={{ minWidth: 0 }}>{children}</div>
        {/* The window: the inside's header card, then the link's own panel. */}
        <div
          role="group"
          aria-label={T("نافذة من داخل المنصة", "A window from inside the platform")}
          style={{ background: "#fff", color: INK, borderRadius: 12, boxShadow: "0 18px 44px rgba(3,24,15,.35)", overflow: "hidden", minWidth: 0 }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${LINE}`, background: "#FAFBFA" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{ height: 22, padding: "0 9px", borderRadius: 6, background: G, color: "#fff", fontSize: 11.5, fontWeight: 700, display: "inline-flex", alignItems: "center" }}>{T("الإدارة", "Management")}</span>
              <strong style={{ fontFamily: HEAD, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{T("سجل العمل", "Work record")} <Num>1042</Num></strong>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color: FILL, whiteSpace: "nowrap" }}>
              <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: FILL }} />
              {T("متوافق مع النظام", "Aligned with the law")}
            </span>
          </div>
          <div style={{ padding: "12px 14px 6px", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
            <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ ...MONO, fontSize: 12, color: "#7A5B1C", fontWeight: 700 }}>{step + 1} / {chain.length}</span>
              <strong style={{ fontFamily: HEAD, fontSize: 16 }}>{T(nameAr, nameEn)}</strong>
            </span>
            <span style={{ fontSize: 12, color: MID, textAlign: "end" }}>{T(noteAr, noteEn)}</span>
          </div>
          <div key={step} data-nv="proof-panel" style={{ padding: "4px 14px 12px", minHeight: 236 }}>
            <Panel step={step} T={T} />
          </div>
        </div>
      </div>

      {/* The stepper is the control. */}
      <ol data-nv="stepper" aria-label={T("دورة الإثبات", "The Proof Cycle")} style={{ listStyle: "none", margin: 0, padding: 0, position: "relative" }}>
        <span data-nv="stepper-rule" aria-hidden style={{ position: "absolute", top: 15, insetInline: "8.33%", height: 2, background: "rgba(200,164,90,.4)", borderRadius: 2 }} />
        {chain.map(([sAr, sEn, nAr, nEn], i) => {
          const on = i === step;
          const done = i < step;
          return (
            <li key={sAr} style={{ position: "relative", display: "flex" }}>
              <button
                type="button"
                aria-current={on ? "step" : undefined}
                onClick={() => { setStep(i); setAuto(false); }}
                onFocus={() => { hover.current = true; }}
                onBlur={() => { hover.current = false; }}
                data-nv="step"
                style={{ flex: 1, fontFamily: "inherit", background: "transparent", border: "none", cursor: "pointer", color: "inherit", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 6, padding: "0 6px" }}
              >
                <span style={{ ...MONO, width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: on ? GOLD : done ? "#fff" : "#0F4A30", color: on ? "#3A2A08" : done ? G : "#CFE0D6", border: on || done ? "none" : "1.5px solid rgba(200,164,90,.7)", fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", position: "relative", boxShadow: "0 0 0 4px rgba(11,61,39,.92)", transition: "background .25s ease, color .25s ease" }}>{done ? "✓" : i + 1}</span>
                <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <strong style={{ fontFamily: HEAD, fontSize: 14.5, fontWeight: 700, color: on ? "#fff" : "#DCEAE1" }}>{T(sAr, sEn)}</strong>
                  <span data-nv="step-note" style={{ fontSize: 11.5, lineHeight: 1.7, color: "#A9CDB8", maxWidth: 170 }}>{T(nAr, nEn)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
