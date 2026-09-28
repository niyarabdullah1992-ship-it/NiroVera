import React, { useRef, useState } from "react";
import { ArrowUpFromLine, Cog, Flame, FlaskConical, Package, Sun, Truck, Waves, Zap } from "lucide-react";
import {
  SAFETY_LIKELIHOOD,
  SAFETY_REPORT_CATEGORIES,
  SAFETY_REPORT_CONTROLS,
  SAFETY_REPORT_KINDS,
  SAFETY_REPORT_STEPS,
  SAFETY_SEVERITY,
  safetyReportCode,
  safetyReportLevel,
} from "@/lib/safetyReportCard";

const MONO = "var(--font-mono, 'IBM Plex Mono', monospace)";
const INPUT = {
  height: 42,
  padding: "0 12px",
  borderRadius: 8,
  border: "1px solid var(--nv-line)",
  background: "var(--nv-card)",
  color: "var(--nv-ink)",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
  width: "100%",
  fontFamily: "inherit",
};

function stepHead(n, label) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#0B3D27", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", font: `700 11px ${MONO}`, flex: "none" }}>{n}</span>
      <strong style={{ fontSize: 14, color: "var(--nv-ink)" }}>{label}</strong>
      <span style={{ flex: 1, height: 1, background: "var(--nv-line)" }} />
    </div>
  );
}

function toneStyle(tone) {
  if (tone === "crit") return { color: "#fff", background: "#9B2335" };
  if (tone === "bad") return { color: "var(--nv-bad-ink)", background: "var(--nv-bad-soft)" };
  if (tone === "warn") return { color: "var(--nv-warn-ink)", background: "var(--nv-warn-soft)" };
  if (tone === "ok") return { color: "var(--nv-ok-ink)", background: "var(--nv-ok-soft)" };
  return { color: "var(--nv-ink3)", background: "var(--nv-soft)" };
}

function toggleStyle(on) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    height: 36,
    padding: "0 12px",
    borderRadius: 8,
    fontSize: 12.5,
    cursor: "pointer",
    border: on ? "1px solid var(--nv-ok-line)" : "1px solid var(--nv-line)",
    background: on ? "var(--nv-ok-soft)" : "var(--nv-card)",
    color: on ? "var(--nv-ok-ink)" : "var(--nv-ink2)",
    fontWeight: on ? 600 : 500,
    fontFamily: "inherit",
  };
}

const CATEGORY_ICONS = [Waves, ArrowUpFromLine, Flame, Zap, Cog, FlaskConical, Sun, Package, Truck];

const EMPTY = {
  kind: 0,
  category: 0,
  likelihood: 0,
  severity: 0,
  where: "",
  what: "",
  action: "",
  controlIndex: -1,
  injured: false,
  photoName: "",
  anonymous: false,
  stopped: false,
};

export default function SafetyIncidentReportForm({ station, ar, reporter, reports = [], onSubmit }) {
  const [form, setForm] = useState(EMPTY);
  const [code, setCode] = useState(() => safetyReportCode());
  const [submitting, setSubmitting] = useState(false);
  const photoRef = useRef(null);
  const L = (a, e) => (ar ? a : e);
  const patch = (next) => setForm((prev) => ({ ...prev, ...next }));

  const positive = form.kind === 4;
  const score = positive ? 0 : (Number(form.likelihood) || 0) * (Number(form.severity) || 0);
  const level = safetyReportLevel(score, positive);
  const critical = score >= 15 && !positive;

  const checks = [
    [Boolean(station?.id), L("الفرع محدّد", "Branch is set")],
    [Boolean(form.where.trim()), L("الموقع محدّد", "Location is set")],
    [form.what.trim().length >= 8, L("الوصف واضح (8 أحرف على الأقل)", "Description is clear (at least 8 characters)")],
    [positive || score > 0, positive ? L("لا تقييم للملاحظة الإيجابية", "No score for a positive note") : L("قُيّم الخطر في المصفوفة", "Risk is scored on the matrix")],
    [positive || form.controlIndex >= 0, positive ? L("لا ضابط مطلوب", "No control required") : L("اقترحت ضابطاً من هرم الضوابط", "A control from the hierarchy is chosen")],
    [!critical || form.stopped, critical ? L("أكّدت إيقاف العمل في الموقع", "Work stop on site is confirmed") : L("لا يلزم إيقاف", "No stop required")],
  ];
  const ready = checks.every((row) => row[0]);

  const submit = async () => {
    if (!ready || submitting) return;
    setSubmitting(true);
    const saved = await onSubmit({
      ...form,
      what: form.what.trim(),
      where: form.where.trim(),
      action: form.action.trim(),
      code,
      likelihood: positive ? 0 : form.likelihood,
      severity: positive ? 0 : form.severity,
    });
    if (saved) {
      setForm((prev) => ({ ...EMPTY, category: prev.category }));
      setCode(safetyReportCode());
      if (photoRef.current) photoRef.current.value = "";
    }
    setSubmitting(false);
  };

  const reporterLine = form.anonymous
    ? L("بلاغ بلا اسم — يُتابَع بالرقم", "Anonymous — followed by its number")
    : (reporter || "—");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: 16, alignItems: "start" }}>
      <article style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 2px rgba(12,20,16,.04), 0 10px 28px rgba(12,20,16,.06)", minWidth: 0 }}>
        <header style={{ background: "linear-gradient(135deg, #0B3D27, #0F5535)", color: "#fff", padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span style={{ width: 44, height: 44, borderRadius: 10, background: "#C8A45A", color: "#0B3D27", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }} aria-hidden>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l9 16H3z" /><path d="M12 10v4" /><path d="M12 17h.01" /></svg>
          </span>
          <div style={{ flex: 1, minWidth: 180, display: "flex", flexDirection: "column", gap: 2 }}>
            <strong style={{ fontFamily: "var(--font-display)", fontSize: 17 }}>{L("بطاقة ملاحظة السلامة", "Safety observation card")}</strong>
            <span style={{ fontSize: 12, color: "#C5DBCD" }}>{reporterLine}</span>
            <span style={{ fontSize: 12, color: "#A9CDB8" }}>{station?.name || "—"}</span>
          </div>
          <span style={{ font: `600 12px ${MONO}`, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 6, padding: "3px 10px", direction: "ltr" }}>{code}</span>
        </header>

        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 18 }}>
          {stepHead("1", L("نوع الملاحظة", "Observation type"))}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
            {SAFETY_REPORT_KINDS.map((kind, index) => {
              const on = form.kind === index;
              const injury = index === 3;
              return (
                <button
                  key={kind.ar}
                  type="button"
                  onClick={() => patch({ kind: index, ...(index === 4 ? { likelihood: 0, severity: 0, controlIndex: -1, stopped: false } : {}) })}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    padding: "10px 12px",
                    borderRadius: 10,
                    cursor: "pointer",
                    textAlign: "start",
                    fontFamily: "inherit",
                    background: on ? (injury ? "#9B2335" : "#0B3D27") : "var(--nv-card)",
                    color: on ? "#fff" : "var(--nv-ink)",
                    border: `1px solid ${on ? (injury ? "#9B2335" : "#0B3D27") : "var(--nv-line)"}`,
                  }}
                >
                  <strong style={{ fontSize: 12.5 }}>{L(kind.ar, kind.en)}</strong>
                  <span style={{ fontSize: 11, color: on ? "#E5EFE9" : "var(--nv-ink3)" }}>{L(kind.subAr, kind.subEn)}</span>
                </button>
              );
            })}
          </div>

          {stepHead("2", L("الفئة والموقع", "Category and place"))}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
            {SAFETY_REPORT_CATEGORIES.map((cat, index) => {
              const on = form.category === index;
              const Icon = CATEGORY_ICONS[index];
              return (
                <button
                  key={cat.ar}
                  type="button"
                  onClick={() => patch({ category: index })}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    minHeight: 48,
                    padding: "8px 12px",
                    borderRadius: 10,
                    cursor: "pointer",
                    boxSizing: "border-box",
                    textAlign: "start",
                    fontFamily: "inherit",
                    fontWeight: on ? 700 : 500,
                    background: on ? "#0B3D27" : "var(--nv-card)",
                    color: on ? "#fff" : "var(--nv-ink)",
                    border: `1px solid ${on ? "#0B3D27" : "var(--nv-line)"}`,
                    boxShadow: on ? "0 6px 16px rgba(6,61,38,.16)" : "none",
                  }}
                >
                  {Icon ? <Icon style={{ width: 18, height: 18, flex: "none", color: on ? "#fff" : "#3C7D50" }} strokeWidth={1.75} /> : null}
                  <span style={{ fontSize: 12.5, lineHeight: 1.35 }}>{L(cat.ar, cat.en)}</span>
                </button>
              );
            })}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-ink2)" }}>{L("الموقع", "Place")}</span>
              <input value={form.where} onChange={(event) => patch({ where: event.target.value })} placeholder={L("مثال: المستودع — البوابة الشرقية", "Example: warehouse — east gate")} style={INPUT} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-ink2)" }}>{L("ما الذي رأيته؟", "What did you see?")}</span>
              <input value={form.what} onChange={(event) => patch({ what: event.target.value })} placeholder={L("مثال: زيت على الأرضية قرب المدخل", "Example: oil on the floor by the entrance")} style={INPUT} />
            </label>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button type="button" onClick={() => photoRef.current?.click()} style={toggleStyle(Boolean(form.photoName))}>
              {form.photoName ? L("✓ صورة مرفقة", "✓ Photo attached") : L("＋ أرفق صورة", "＋ Attach a photo")}
            </button>
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => patch({ photoName: event.target.files?.[0]?.name || "" })}
            />
            <button type="button" onClick={() => patch({ injured: !form.injured })} style={toggleStyle(form.injured)}>
              {form.injured ? L("✓ نعم، هناك إصابة", "✓ Yes, someone was hurt") : L("هل أُصيب أحد؟", "Was anyone hurt?")}
            </button>
            <button type="button" onClick={() => patch({ anonymous: !form.anonymous })} style={toggleStyle(form.anonymous)}>
              {form.anonymous ? L("✓ بلا اسم", "✓ Anonymous") : L("أرسله بلا اسم", "Send it without a name")}
            </button>
          </div>

          {form.injured ? (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "var(--nv-bad-soft)", border: "1px solid var(--nv-bad-line)", borderRadius: 10, padding: "10px 12px" }}>
              <strong style={{ color: "#9B2335", fontSize: 16, lineHeight: 1 }}>!</strong>
              <span style={{ fontSize: 12, color: "var(--nv-bad-ink)", lineHeight: 1.7 }}>
                {L(
                  "قدّم الإسعاف الأولي أولاً (المادة 125). الإصابة تُبلَّغ للجهة المختصة والتأمينات الاجتماعية في المهلة النظامية (المادة 133)، وتُصنَّف وتُسجَّل في سجل الإصابات.",
                  "Give first aid first (Art. 125). The injury is reported to the competent authority and social insurance within the statutory window (Art. 133), then classified in the injury log."
                )}
              </span>
            </div>
          ) : null}

          {!positive ? (
            <>
              {stepHead("3", L("تقييم الخطر — الاحتمال × الشدة", "Risk score — likelihood × severity"))}
              <div style={{ display: "grid", gridTemplateColumns: "78px repeat(5, minmax(0, 1fr))", gap: 4, alignItems: "center" }}>
                <span />
                {SAFETY_SEVERITY.map((item) => (
                  <span key={item.ar} style={{ fontSize: 10, color: "var(--nv-ink3)", textAlign: "center", lineHeight: 1.3 }}>{L(item.ar, item.en)}</span>
                ))}
                {[5, 4, 3, 2, 1].map((likelihood) => (
                  <React.Fragment key={likelihood}>
                    <span style={{ fontSize: 10.5, color: "var(--nv-ink2)", fontWeight: 600 }}>{L(SAFETY_LIKELIHOOD[likelihood - 1].ar, SAFETY_LIKELIHOOD[likelihood - 1].en)}</span>
                    {[1, 2, 3, 4, 5].map((severity) => {
                      const value = likelihood * severity;
                      const on = form.likelihood === likelihood && form.severity === severity;
                      const bg = value >= 15 ? "#C74B5E" : value >= 10 ? "#E7A0AA" : value >= 5 ? "#EFD08F" : "#A9D4B7";
                      return (
                        <button
                          key={severity}
                          type="button"
                          onClick={() => patch({ likelihood, severity })}
                          style={{
                            height: 30,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 5,
                            cursor: "pointer",
                            border: "none",
                            font: `600 11px ${MONO}`,
                            color: value >= 15 ? "#fff" : "#111418",
                            background: bg,
                            outline: on ? "2.5px solid var(--nv-ink)" : "none",
                            outlineOffset: 1,
                            opacity: on ? 1 : 0.82,
                            transform: on ? "scale(1.06)" : "none",
                          }}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>

              {level ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "var(--nv-soft)", border: "1px solid var(--nv-line)", borderRadius: 10, padding: "10px 12px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", height: 28, padding: "0 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, ...toneStyle(level.tone) }}>
                    <span style={{ fontFamily: "var(--font-body)" }}>{L(level.ar, level.en)}</span>
                    <span style={{ fontFamily: MONO, direction: "ltr", marginInlineStart: 6 }}>{score} / 25</span>
                  </span>
                  <span style={{ fontSize: 12.5, color: "var(--nv-ink)", flex: 1, minWidth: 160 }}>{L(level.actAr, level.actEn)}</span>
                  <span style={{ font: `600 11.5px ${MONO}`, color: "var(--nv-ink3)", direction: "ltr" }}>SLA {L(level.slaAr, level.slaEn)}</span>
                </div>
              ) : null}

              {critical ? (
                <button type="button" onClick={() => patch({ stopped: !form.stopped })} style={toggleStyle(form.stopped)}>
                  {form.stopped ? L("✓ أوقفت العمل وأبعدت الأشخاص", "✓ I stopped the work and moved people away") : L("أؤكّد إيقاف العمل في الموقع", "I confirm the work is stopped on site")}
                </button>
              ) : null}

              {stepHead("4", L("الضابط المقترح — هرم الضوابط", "Proposed control — hierarchy of controls"))}
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {SAFETY_REPORT_CONTROLS.map((ctrl, index) => {
                  const on = form.controlIndex === index;
                  const idle = ["var(--nv-ok-soft)", "var(--nv-g1)", "var(--nv-hover)", "var(--nv-soft)", "var(--nv-warn-soft)"][index];
                  return (
                    <button
                      key={ctrl.id}
                      type="button"
                      onClick={() => patch({ controlIndex: index })}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "26px minmax(0, 1fr)",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 12px",
                        borderRadius: 8,
                        cursor: "pointer",
                        marginInlineStart: index * 10,
                        border: "none",
                        textAlign: "start",
                        fontFamily: "inherit",
                        background: on ? "#0B3D27" : idle,
                        color: on ? "#fff" : "var(--nv-ink)",
                      }}
                    >
                      <span style={{ width: 26, height: 26, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", font: `700 11px ${MONO}`, background: on ? "#C8A45A" : "var(--nv-card)", color: on ? "#0B3D27" : "var(--nv-ok-ink)" }}>{index + 1}</span>
                      <span style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                        <strong style={{ fontSize: 12.5 }}>{L(ctrl.ar, ctrl.en)}</strong>
                        <span style={{ fontSize: 11, opacity: 0.8 }}>{L(ctrl.subAr, ctrl.subEn)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-ink2)" }}>{L("ماذا فعلت فوراً؟ (اختياري)", "What did you do at once? (optional)")}</span>
                <input value={form.action} onChange={(event) => patch({ action: event.target.value })} placeholder={L("مثال: وضعت شريط تحذير وأبلغت المشرف", "Example: I put out warning tape and told the supervisor")} style={INPUT} />
              </label>
            </>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 6, background: "var(--nv-soft)", border: "1px solid var(--nv-line)", borderRadius: 10, padding: "12px 14px" }}>
            {checks.map((row) => (
              <span key={row[1]} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: row[0] ? "var(--nv-ok-ink)" : "var(--nv-ink3)" }}>
                <span style={{ width: 18, height: 18, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 700, flex: "none", background: row[0] ? "var(--nv-ok-soft)" : "var(--nv-hover)" }}>{row[0] ? "✓" : "·"}</span>
                {row[1]}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={!ready || submitting}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 46,
              borderRadius: 10,
              border: "none",
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "inherit",
              background: !ready || submitting ? "var(--nv-line)" : (critical ? "#9B2335" : "#3C7D50"),
              color: !ready || submitting ? "var(--nv-ink3)" : "#fff",
              cursor: ready && !submitting ? "pointer" : "not-allowed",
            }}
          >
            {submitting
              ? L("جارٍ الإرسال...", "Sending...")
              : (ready
                ? (critical ? L("أرسل بلاغاً حرجاً الآن", "Send a critical report now") : L("أرسل البطاقة", "Send the card"))
                : L("أكمل البنود لإرسال البطاقة", "Complete the items to send the card"))}
          </button>
          <span style={{ fontSize: 11.5, color: "var(--nv-ink3)", textAlign: "center" }}>
            {L("البلاغ حقّ وواجب، ولا يُتخذ سبباً لجزاء. لك إيقاف العمل عند خطر وشيك، ويصل البلاغ مسؤول السلامة ومدير الفرع فوراً.", "A report is a right and a duty, and it is not grounds for a penalty. You may stop the work when danger is imminent, and the report reaches the safety officer and the branch manager at once.")}
          </span>
        </div>
      </article>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
        <section style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 2px rgba(12,20,16,.04)" }}>
          <header style={{ padding: "14px 16px", borderBottom: "1px solid var(--nv-line)" }}>
            <strong style={{ fontSize: 15, color: "var(--nv-ink)" }}>{L("بطاقاتي", "My cards")}</strong>
          </header>
          {reports.length ? reports.map((item) => {
            const card = item.card || {};
            const tone = toneStyle(card.levelTone || "");
            const step = Number(item.step ?? card.step ?? 0);
            const title = item.description || card.what || "—";
            const cat = ar ? (card.categoryAr || "—") : (card.categoryEn || card.categoryAr || "—");
            const lvl = ar ? (card.levelAr || "—") : (card.levelEn || card.levelAr || "—");
            const sla = ar ? (card.slaAr || "—") : (card.slaEn || card.slaAr || "—");
            return (
              <div key={item.id || card.code} style={{ padding: "12px 16px", borderBottom: "1px solid var(--nv-line2)", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0, gap: 2 }}>
                    <strong style={{ fontSize: 13, color: "var(--nv-ink)" }}>{title}</strong>
                    <span style={{ fontSize: 11, color: "var(--nv-ink3)" }}>
                      <span style={{ fontFamily: MONO, direction: "ltr", unicodeBidi: "isolate" }}>{card.code || "—"}</span>
                      {" · "}
                      {cat}
                    </span>
                  </div>
                  <span style={{ display: "inline-flex", alignItems: "center", height: 22, padding: "0 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, flex: "none", ...tone }}>{lvl}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
                  {SAFETY_REPORT_STEPS.map((label, index) => (
                    <div key={label.ar} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      {index < 3 ? <span style={{ position: "absolute", top: 4, insetInlineStart: "50%", width: "100%", height: 2, background: index < step ? "#3C7D50" : "var(--nv-line)" }} /> : null}
                      <span style={{ width: 10, height: 10, borderRadius: "50%", position: "relative", zIndex: 1, boxShadow: "0 0 0 3px var(--nv-card)", background: index <= step ? "#3C7D50" : "var(--nv-line)" }} />
                      <span style={{ fontSize: 10.5, color: index <= step ? "var(--nv-ink)" : "var(--nv-ink3)" }}>{L(label.ar, label.en)}</span>
                    </div>
                  ))}
                </div>
                <span style={{ fontSize: 11.5, color: "var(--nv-ink3)" }}>{sla}</span>
              </div>
            );
          }) : (
            <p style={{ margin: 0, padding: "18px 16px", textAlign: "center", fontSize: 14, color: "var(--nv-ink3)" }}>—</p>
          )}
        </section>

        <section style={{ background: "linear-gradient(160deg, #0B3D27, #0F5535)", color: "#fff", borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10, boxShadow: "0 6px 18px rgba(6,61,38,.16)" }}>
          <strong style={{ fontSize: 14 }}>{L("المرجعية", "References")}</strong>
          {[
            [L("نظام العمل", "Labor Law"), L("الباب الثامن · م 121–128", "Chapter 8 · Arts. 121–128")],
            [L("المادة 133", "Article 133"), L("إبلاغ إصابة العمل", "Reporting a work injury")],
            ["ISO 45001", L("بند 6.1.2 · تحديد المخاطر", "6.1.2 · Hazard identification")],
            ["ISO 45001", L("بند 8.1.2 · هرم الضوابط", "8.1.2 · Hierarchy of controls")],
            ["ISO 45001", L("بند 5.4 · مشاركة العاملين", "5.4 · Worker participation")],
            ["OSHA 1904", L("تصنيف الإصابة المسجّلة", "Recordable injury classification")],
          ].map((row) => (
            <div key={`${row[0]}-${row[1]}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,.1)" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#E4C27A", whiteSpace: "nowrap" }}>{row[0]}</span>
              <span style={{ fontSize: 11.5, color: "#C5DBCD", textAlign: "end" }}>{row[1]}</span>
            </div>
          ))}
          <span style={{ fontSize: 11, color: "#A9CDB8", lineHeight: 1.6 }}>
            {L("المراجع للاسترشاد؛ النص الرسمي للنظام والمواصفة هو المرجع.", "The references are a guide; the official text of the law and the standard is the source.")}
          </span>
        </section>
      </div>
    </div>
  );
}
