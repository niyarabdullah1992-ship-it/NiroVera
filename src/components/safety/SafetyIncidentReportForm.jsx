import React, { useState } from "react";
import {
  SAFETY_LIKELIHOOD,
  SAFETY_REPORT_CATEGORIES,
  SAFETY_REPORT_CONTROLS,
  SAFETY_REPORT_KINDS,
  SAFETY_SEVERITY,
  safetyReportCode,
  safetyReportLevel,
} from "@/lib/safetyReportCard";
import { citeRule } from "@/lib/laborRules";
import AttachDropzone from "@/components/shared/AttachDropzone";
import SubTypeOption, { SubTypeGrid } from "@/components/requests/SubTypeOption";
import { DisciplineNewFrame } from "@/components/discipline/DisciplineRows";
import { Checklist, FieldLabel, LawLine, StepHead, inputStyle, textareaStyle } from "@/components/discipline/DisciplineFormKit";
import NvIcon from "@/components/shared/NvIcon";

const MONO = "var(--font-mono, 'IBM Plex Mono', monospace)";
export const SAFETY_PHOTO_MAX_BYTES = 25 * 1024 * 1024;
// The letter on each «بلاغ جديد» tile — the first letter of the kind, as in طلباتي.
const KIND_LETTERS = ["ح", "ت", "و", "إ", "م"];

function toneStyle(tone) {
  if (tone === "crit") return { color: "#fff", background: "#9B2335" };
  if (tone === "bad") return { color: "var(--nv-bad-ink)", background: "var(--nv-bad-soft)" };
  if (tone === "warn") return { color: "var(--nv-warn-ink)", background: "var(--nv-warn-soft)" };
  if (tone === "ok") return { color: "var(--nv-ok-ink)", background: "var(--nv-ok-soft)" };
  return { color: "var(--nv-ink3)", background: "var(--nv-soft)" };
}

function CheckLine({ checked, onChange, children, dataKey }) {
  return (
    <label data-safety-toggle={dataKey} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.7, color: "var(--nv-ink)", cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} style={{ marginTop: 5 }} />
      <span>{children}</span>
    </label>
  );
}

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
  injuredSelf: true,
  injuredName: "",
  photoName: "",
  photoSize: 0,
  anonymous: false,
  stopped: false,
};

/**
 * «بلاغ جديد» — the raise frame of السلامة, in the طلباتي frame: the kind tiles with their letter, the
 * category as sub-choices, labels above inputs, the photo dropzone (25 MB), the matrix and the control,
 * the checklist, the readiness line and one full-width «أرسل البلاغ». The card rules (score, level,
 * SLA, stop-work) are buildSafetyReportCard's; this frame only gathers them.
 */
export default function SafetyIncidentReportForm({ station, ar, reporter, onSubmit }) {
  const [form, setForm] = useState(EMPTY);
  const [code, setCode] = useState(() => safetyReportCode());
  const [photoError, setPhotoError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const L = (a, e) => (ar ? a : e);
  const patch = (next) => setForm((prev) => ({ ...prev, ...next }));

  const positive = form.kind === 4;
  const score = positive ? 0 : (Number(form.likelihood) || 0) * (Number(form.severity) || 0);
  const level = safetyReportLevel(score, positive);
  const critical = score >= 15 && !positive;
  const firstAid = citeRule("safety.firstAid.cite");
  const injuryReport = citeRule("safety.injuryReport.cite");

  const checks = [
    { ok: Boolean(station?.id), text: L("الفرع محدّد", "Branch is set"), reason: L("لا فرع مرتبط بحسابك — لا يُحفظ البلاغ.", "No branch is linked to your account — the report cannot be saved.") },
    { ok: Boolean(form.where.trim()), text: L("الموقع محدّد", "Location is set"), reason: L("حدّد الموقع.", "Set the location.") },
    { ok: form.what.trim().length >= 8, text: L("الوصف واضح (8 أحرف على الأقل)", "Description is clear (8+ characters)"), reason: L("اكتب ما رأيته في 8 أحرف على الأقل.", "Describe what you saw in at least 8 characters.") },
    positive
      ? { ok: true, text: L("لا تقييم للملاحظة الإيجابية", "No score for a positive note") }
      : { ok: score > 0, text: L("قُيّم الخطر في المصفوفة", "Risk is scored on the matrix"), reason: L("اختر خانة الاحتمال × الشدة.", "Pick the likelihood × severity cell.") },
    positive
      ? { ok: true, text: L("لا ضابط مطلوب", "No control required") }
      : { ok: form.controlIndex >= 0, text: L("اقترحت ضابطاً من هرم الضوابط", "A control is proposed"), reason: L("اقترح ضابطاً من هرم الضوابط.", "Propose a control from the hierarchy.") },
    critical
      ? { ok: form.stopped, text: L("أكّدت إيقاف العمل في الموقع", "Work stop is confirmed"), reason: L("خطر حرج — أكّد إيقاف العمل قبل الإرسال.", "Critical risk — confirm the work stop before sending.") }
      : null,
    { ok: !photoError, text: L("الصورة ضمن 25 ميجابايت", "Photo within 25 MB"), reason: photoError },
  ].filter(Boolean);
  const blocking = checks.find((row) => !row.ok);
  const ready = !blocking;

  const pickPhoto = (file) => {
    if (!file) { patch({ photoName: "", photoSize: 0 }); setPhotoError(""); return; }
    // The file is read by its name and size only — never by Blob.bytes.
    if (Number(file.size) > SAFETY_PHOTO_MAX_BYTES) {
      setPhotoError(L("الصورة أكبر من 25 ميجابايت.", "The photo is larger than 25 MB."));
      patch({ photoName: "", photoSize: 0 });
      return;
    }
    setPhotoError("");
    patch({ photoName: String(file.name || ""), photoSize: Number(file.size) || 0 });
  };

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
    }
    setSubmitting(false);
  };

  const tiles = SAFETY_REPORT_KINDS.map((kind, index) => ({ id: String(index), letter: KIND_LETTERS[index], title: L(kind.ar, kind.en), hint: L(kind.subAr, kind.subEn) }));

  return (
    <DisciplineNewFrame
      dataKey="safety"
      title={L("بلاغ جديد", "New report")}
      note={L("البلاغ حقّ وواجب ولا يُتخذ سبباً لجزاء — ولك إيقاف العمل عند خطر وشيك.", "Reporting is a right and a duty, never grounds for a penalty — you may stop the work when danger is imminent.")}
      tiles={tiles}
      value={String(form.kind)}
      onPick={(id) => {
        const index = Number(id);
        patch({ kind: index, ...(index === 4 ? { likelihood: 0, severity: 0, controlIndex: -1, stopped: false } : {}) });
      }}
    >
      <div data-safety-raise="" style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", alignItems: "center", fontSize: 12, color: "var(--nv-muted)" }}>
        <span>{form.anonymous ? L("بلاغ بلا اسم — يُتابَع بالرقم", "Anonymous — followed by its number") : (reporter || "—")}</span>
        <span>· {station?.name || "—"}</span>
        <span dir="ltr" style={{ fontFamily: MONO, color: "var(--nv-ink)", marginInlineStart: "auto", unicodeBidi: "isolate" }}>{code}</span>
      </div>

      <StepHead first label={L("الفئة", "Category")} />
      <SubTypeGrid label={L("الفئة", "Category")}>
        {SAFETY_REPORT_CATEGORIES.map((cat, index) => (
          <SubTypeOption key={cat.ar} dataKey={`safety-cat-${index}`} on={form.category === index} title={L(cat.ar, cat.en)} onClick={() => patch({ category: index })} />
        ))}
      </SubTypeGrid>

      <StepHead label={L("الموقع والوصف", "Place and description")} />
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <FieldLabel>{L("الموقع", "Place")}</FieldLabel>
        <input data-safety-where="" value={form.where} onChange={(event) => patch({ where: event.target.value })} placeholder={L("مثال: المستودع — البوابة الشرقية", "Example: warehouse — east gate")} style={inputStyle} />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <FieldLabel>{L("ما الذي رأيته؟", "What did you see?")}</FieldLabel>
        <textarea data-safety-what="" rows={3} value={form.what} onChange={(event) => patch({ what: event.target.value })} placeholder={L("مثال: زيت على الأرضية قرب المدخل", "Example: oil on the floor by the entrance")} style={textareaStyle} />
      </label>
      <AttachDropzone
        ar={ar}
        accept="image/jpeg,image/png,image/webp,image/heic,image/*"
        file={form.photoName ? { name: form.photoName, size: form.photoSize } : null}
        error={photoError}
        label={L("أرفق صورة", "Attach a photo")}
        typesLabel={L("صورة · حتى 25 ميجابايت", "Image · up to 25 MB")}
        onPick={pickPhoto}
        onClear={() => pickPhoto(null)}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <CheckLine dataKey="injured" checked={form.injured} onChange={(on) => patch({ injured: on })}>{L("أُصيب أحد", "Someone was hurt")}</CheckLine>
        <CheckLine dataKey="anonymous" checked={form.anonymous} onChange={(on) => patch({ anonymous: on })}>
          {L("أرسله بلا اسم — لا يظهر اسمك لأحد، ويصلك إشعار القرار برقم البلاغ", "Send it without a name — nobody sees your name; decisions reach you by the report's number")}
        </CheckLine>
      </div>

      {form.injured ? (
        <>
          <SubTypeGrid label={L("من المصاب؟", "Who was hurt?")}>
            <SubTypeOption dataKey="injured-self" on={form.injuredSelf} title={L("المصاب أنا", "I was hurt")} onClick={() => patch({ injuredSelf: true, injuredName: "" })} />
            <SubTypeOption dataKey="injured-colleague" on={!form.injuredSelf} title={L("المصاب زميل", "A colleague was hurt")} onClick={() => patch({ injuredSelf: false })} />
          </SubTypeGrid>
          {!form.injuredSelf ? (
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <FieldLabel note={L("يراه المُبلِّغ والإدارة فقط", "Seen by the reporter and management only")}>{L("اسم المصاب", "Name of the injured")}</FieldLabel>
              <input value={form.injuredName} onChange={(event) => patch({ injuredName: event.target.value })} style={inputStyle} />
            </label>
          ) : null}
          <LawLine cite={[firstAid?.labelAr && L(firstAid.labelAr, firstAid.labelEn), injuryReport?.labelAr && L(injuryReport.labelAr, injuryReport.labelEn)].filter(Boolean).join(" · ") || "—"}>
            {[firstAid && L(firstAid.hintAr, firstAid.hintEn), injuryReport && L(injuryReport.hintAr, injuryReport.hintEn)].filter(Boolean).join(" ")}
          </LawLine>
        </>
      ) : null}

      {!positive ? (
        <>
          <StepHead label={L("تقييم الخطر — الاحتمال × الشدة", "Risk score — likelihood × severity")} />
          <div data-safety-matrix="" style={{ display: "grid", gridTemplateColumns: "64px repeat(5, minmax(0, 1fr))", gap: 4, alignItems: "center" }}>
            <span />
            {SAFETY_SEVERITY.map((item) => (
              <span key={item.ar} style={{ fontSize: 10, color: "var(--nv-muted)", textAlign: "center", lineHeight: 1.3 }}>{L(item.ar, item.en)}</span>
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
                      data-cell={`${likelihood}x${severity}`}
                      aria-pressed={on}
                      onClick={() => patch({ likelihood, severity })}
                      style={{ height: 30, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 5, cursor: "pointer", border: "none", font: `600 11px ${MONO}`, color: value >= 15 ? "#fff" : "#111418", background: bg, outline: on ? "2.5px solid var(--nv-ink)" : "none", outlineOffset: 1, opacity: on ? 1 : 0.82 }}
                    >
                      {value}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
          {level ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "var(--nv-soft)", border: "1px solid var(--nv-line2, #EEF1EF)", borderRadius: 8, padding: "10px 12px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 26, padding: "0 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, ...toneStyle(level.tone) }}>
                {L(level.ar, level.en)}
                <span dir="ltr" style={{ fontFamily: MONO, unicodeBidi: "isolate" }}>{score} / 25</span>
              </span>
              <span style={{ fontSize: 12.5, color: "var(--nv-ink)", flex: 1, minWidth: 160 }}>{L(level.actAr, level.actEn)}</span>
              <span dir="ltr" style={{ font: `600 11.5px ${MONO}`, color: "var(--nv-muted)" }}>SLA {L(level.slaAr, level.slaEn)}</span>
            </div>
          ) : null}
          {critical ? (
            <CheckLine dataKey="stopped" checked={form.stopped} onChange={(on) => patch({ stopped: on })}>
              {L("أوقفت العمل في الموقع وأبعدت الأشخاص", "I stopped the work on site and moved people away")}
            </CheckLine>
          ) : null}

          <StepHead label={L("الضابط المقترح — هرم الضوابط", "Proposed control — hierarchy of controls")} />
          <SubTypeGrid label={L("الضابط المقترح", "Proposed control")}>
            {SAFETY_REPORT_CONTROLS.map((ctrl, index) => (
              <SubTypeOption
                key={ctrl.id}
                dataKey={`safety-ctrl-${ctrl.id}`}
                on={form.controlIndex === index}
                title={L(ctrl.ar, ctrl.en)}
                sub={L(ctrl.subAr, ctrl.subEn)}
                badge={<span dir="ltr" style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--nv-muted)" }}>{index + 1}</span>}
                onClick={() => patch({ controlIndex: index })}
              />
            ))}
          </SubTypeGrid>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <FieldLabel note={L("اختياري", "Optional")}>{L("ماذا فعلت فوراً؟", "What did you do at once?")}</FieldLabel>
            <input value={form.action} onChange={(event) => patch({ action: event.target.value })} placeholder={L("مثال: وضعت شريط تحذير وأبلغت المشرف", "Example: I put out warning tape and told the supervisor")} style={inputStyle} />
          </label>
        </>
      ) : null}

      <Checklist items={checks} dataKey="safety" />
      <span data-safety-gate={ready ? "ok" : "todo"} style={{ fontSize: 11.5, fontWeight: 600, color: ready ? "#2F6B43" : "var(--nv-warn-ink, #8A5A12)", lineHeight: 1.7 }}>
        {ready ? <><NvIcon name="check" size={12} strokeWidth={2} /> {L("جاهز للإرسال", "Ready to send")}</> : blocking.reason}
      </span>
      <button
        type="button"
        data-safety-send=""
        disabled={!ready || submitting}
        onClick={submit}
        style={{ fontFamily: "inherit", fontSize: 13, fontWeight: 700, height: 42, width: "100%", border: "none", borderRadius: 8, background: ready && !submitting ? "#0B3D27" : "var(--nv-line)", color: ready && !submitting ? "#fff" : "var(--nv-muted)", cursor: ready && !submitting ? "pointer" : "default" }}
      >
        {submitting ? L("جارٍ الإرسال...", "Sending...") : L("أرسل البلاغ", "Send the report")}
      </button>
    </DisciplineNewFrame>
  );
}
