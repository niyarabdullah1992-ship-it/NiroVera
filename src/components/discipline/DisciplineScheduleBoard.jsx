import React, { useState } from "react";
import PlatformDateField from "@/components/shared/PlatformDateField";
import { citeRule, ruleValue } from "@/lib/laborRules";
import { DISCIPLINE_PENALTY_KINDS } from "@/lib/disciplineDerivations";
import {
  MODEL_GROUPS,
  MODEL_REGULATION,
  checkPublishRegulationGate,
  checkRegulationDraft,
  regulationAckStatus,
  regulationStanding,
  newClauseId,
  parseRegulationStep,
  regulationDate,
  regulationStepLabel,
} from "@/lib/workRegulation";
import { SectionHead, slab } from "@/components/schedules/scheduleChrome";
import { UNIFORM_CRITERIA, checkSaveUniformGate, uniformAckOf, uniformAckStatus, uniformStanding } from "@/lib/uniformPolicy";

const DANGER = "#9B2335";
const GOLD = "#A57F2C";
const GREEN = "#0B3D27";

const OUTSIDE = [
  ["80", "الفصل دون مكافأة أو إشعار يقتصر على حالات المادة 80، ويُسمع دفاع العامل قبله.", "Dismissal without the award or notice is limited to Article 80 cases, and the worker's defence is heard first."],
  ["70", "الغرامات والإيقاف لا تتجاوز أجر خمسة أيام في الشهر.", "Fines and suspension do not exceed five days' wage in a month."],
  ["68", "مضيّ 180 يوماً على إبلاغ الجزاء السابق يُعيد البند إلى «المرة الأولى».", "180 days after notice of the previous sanction resets the clause to the first time."],
];

function stepTone(step) {
  if (!step?.ok) return "var(--nv-muted)";
  if (step.kind === "dismiss" || step.kind === "dismissal_with_award" || (step.kind === "fine" && step.days >= 2)) return DANGER;
  if (step.kind === "warning") return "var(--nv-ink)";
  return GOLD;
}

const input = {
  fontFamily: "inherit",
  fontSize: 13,
  height: 38,
  padding: "0 10px",
  border: "1px solid var(--nv-line)",
  borderRadius: 8,
  background: "var(--nv-page)",
  color: "var(--nv-ink)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  minWidth: 0,
};

const btn = (solid) => ({
  fontFamily: "inherit",
  fontSize: 12.5,
  fontWeight: 700,
  height: 36,
  padding: "0 14px",
  borderRadius: 9,
  border: solid ? "none" : "1px solid var(--nv-line)",
  background: solid ? GREEN : "var(--nv-card)",
  color: solid ? "#fff" : "var(--nv-ink)",
  cursor: "pointer",
  whiteSpace: "nowrap",
});

function draftFrom(regulation) {
  const own = regulation?.source === "own";
  return {
    approvalNo: own ? regulation.approvalNo || "" : "",
    approvedAt: own ? regulation.approvedAt || "" : "",
    clauses: (regulation?.clauses || MODEL_REGULATION.clauses).map((c) => ({
      id: c.id,
      ar: c.ar || "",
      en: c.en || "",
      ...(c.group ? { group: c.group, no: c.no } : {}),
      ...(c.plus ? { plus: c.plus } : {}),
      ...(c.art80 ? { art80: c.art80 } : {}),
      steps: [0, 1, 2, 3].map((i) => (c.steps || [])[i] || ""),
    })),
  };
}

/** The read view: clauses × the four times, each cell read into what it means. */
function RegulationTable({ regulation, ar }) {
  const heads = ar
    ? ["البند", "المخالفة", "أول مرة", "ثاني مرة", "ثالث مرة", "رابع مرة"]
    : ["#", "Offence", "First", "Second", "Third", "Fourth"];
  return (
    <div style={{ overflowX: "auto" }}>
      <div data-regulation-table="" style={{ minWidth: 760, display: "grid", gridTemplateColumns: "48px minmax(180px,1.6fr) repeat(4, 124px)" }}>
        {heads.map((label) => (
          <span key={label} style={{ padding: "8px 12px", fontSize: 11.5, fontWeight: 700, color: "var(--nv-ink2)", borderBottom: "1px solid var(--nv-line)", background: "var(--nv-hover)" }}>{label}</span>
        ))}
        {regulation.clauses.map((c, n) => {
          const steps = [0, 1, 2, 3].map((i) => (c.steps || [])[i] || "");
          const group = MODEL_GROUPS.find((g) => g.id === c.group);
          const firstOfGroup = group && regulation.clauses.findIndex((x) => x.group === c.group) === n;
          return (
            <React.Fragment key={c.id}>
              {firstOfGroup ? (
                <span data-regulation-group={group.id} style={{ gridColumn: "1 / -1", padding: "8px 12px", fontSize: 12.5, fontWeight: 700, color: "var(--nv-ink)", background: "var(--nv-hover)", borderBottom: "1px solid var(--nv-line)" }}>
                  {ar ? group.ar : group.en}
                </span>
              ) : null}
              <span dir="ltr" style={{ padding: "10px 12px", borderBottom: "1px solid var(--nv-line)", fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, color: "var(--nv-muted)" }}>{group ? c.no : n + 1}</span>
              <span style={{ padding: "10px 12px", borderBottom: "1px solid var(--nv-line)", fontSize: 13, fontWeight: 700, lineHeight: 1.5, display: "flex", flexDirection: "column", gap: 2 }}>
                <span>{ar ? c.ar || c.en : c.en || c.ar}</span>
                {c.plus ? <span style={{ fontSize: 11, fontWeight: 500, color: "var(--nv-muted)" }}>{c.plus}</span> : null}
              </span>
              {steps.map((text, i) => {
                const p = parseRegulationStep(text);
                return (
                  <span key={i} title={text ? regulationStepLabel(p, ar) : ""} style={{ padding: "10px 12px", borderBottom: "1px solid var(--nv-line)", fontSize: 12, fontWeight: 600, color: text ? stepTone(p) : "var(--nv-muted)", lineHeight: 1.45 }}>
                    {text || "—"}
                  </span>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Law Arts. 12–13 · model Art. 72: the approved regulation is announced in a visible
 * place, binds the workers from the day after, and each worker confirms reading it.
 */
function RegulationAnnouncement({ ar, today, regulation, canEdit, employees = [], meId = "", onAnnounce, onAck }) {
  const standing = regulationStanding(regulation, today);
  if (standing.id === "model") return null;
  const ack = regulationAckStatus(regulation, employees);
  const mine = meId ? (regulation.acks || {})[meId] : null;
  const mineValid = mine && (!ack.version || String(mine.version || "") === ack.version);
  const publish = checkPublishRegulationGate(regulation, { today, ar });
  const pill = (tone, text) => (
    <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "2px 10px", border: `1px solid var(--nv-${tone}-line)`, color: `var(--nv-${tone}-ink)` }}>{text}</span>
  );
  return (
    <section data-regulation-announce={standing.id} style={{ ...slab, display: "flex", flexDirection: "column", gap: 10, padding: "14px 18px" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14 }}>{ar ? "إعلان اللائحة وإقرار العمال بالاطلاع" : "Announcement and workers' acknowledgement"}</strong>
        {standing.id === "draft" ? pill("warn", ar ? "لم تُعلَن" : "Not announced") : null}
        {standing.id === "announced" ? pill("warn", ar ? `تسري من ${regulationDate(standing.effectiveFrom, true)}` : `In force from ${standing.effectiveFrom}`) : null}
        {standing.id === "inForce" ? pill("ok", ar ? `سارية منذ ${regulationDate(standing.effectiveFrom, true)}` : `In force since ${standing.effectiveFrom}`) : null}
        <span style={{ flex: 1 }} />
        {canEdit && standing.id === "draft" ? (
          <button type="button" data-regulation-announce-btn="" disabled={!publish.ok} title={publish.ok ? "" : (ar ? publish.reason : publish.reasonEn)} onClick={() => publish.ok && onAnnounce?.()} style={btn(true)}>
            {ar ? "أعلن اللائحة للعمال" : "Announce to the workers"}
          </button>
        ) : null}
        {!canEdit && standing.id !== "draft" && meId && !mineValid ? (
          <button type="button" data-regulation-ack-btn="" onClick={() => onAck?.()} style={btn(true)}>{ar ? "اطّلعت على اللائحة وأقرّ بالعلم بها" : "I have read the regulation"}</button>
        ) : null}
        {!canEdit && mineValid ? pill("ok", ar ? `أقررتَ بالاطلاع ${regulationDate(mine.at, true)}` : `Acknowledged ${String(mine.at).slice(0, 10)}`) : null}
      </div>
      <span style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.7 }}>
        {ar
          ? "تُعلَن اللائحة وكل تعديل عليها في مكان ظاهر أو بوسيلة تكفل علم العمال بها (المادة 13/3)، وتسري على العمال من اليوم التالي لإعلانها (النموذج الموحد م72)، ويُطلع العامل عليها عند التعاقد (النموذج الموحد م3/3)."
          : "The regulation and every amendment are announced visibly (Art. 13(3)); they bind the workers from the next day (model Art. 72)."}
      </span>
      {canEdit && standing.id !== "draft" ? (
        <div data-regulation-acks="" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>
            {ar ? `أقرّ بالاطلاع ${ack.acked.length} من ${ack.total}` : `${ack.acked.length} of ${ack.total} acknowledged`}
          </span>
          {ack.pending.length ? (
            <span style={{ fontSize: 12, color: "var(--nv-warn-ink)", lineHeight: 1.8 }}>
              {ar ? "لم يُقرّ بعد: " : "Not yet: "}{ack.pending.map((p) => p.employee.name || p.employee.id).join(" · ")}
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Model Art. 53(1): the staff uniform rules — written with the three criteria and their penalties,
 * announced separately, acknowledged by each worker. HR edits and announces; the worker acknowledges.
 * A uniform breach cannot be raised against a worker who has not acknowledged the version in force.
 */
function UniformPolicyCard({ ar, uniform, canEdit, employees = [], meId = "", onSave, onAnnounce, onAck }) {
  const standing = uniformStanding(uniform);
  const ack = uniformAckStatus(uniform, employees);
  const mine = meId ? uniformAckOf(uniform, meId) : null;
  const [draft, setDraft] = useState(null);
  const [err, setErr] = useState("");
  if (standing.id === "none" && !canEdit) return null;
  const pill = (tone, text) => (
    <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "2px 10px", border: `1px solid var(--nv-${tone}-line)`, color: `var(--nv-${tone}-ink)` }}>{text}</span>
  );
  const start = () => setDraft({ rules: uniform?.rules || "", sanctions: uniform?.sanctions || "", criteria: { ...(uniform?.criteria || {}) } });
  const save = () => {
    const gate = checkSaveUniformGate(draft);
    if (!gate.ok) { setErr(ar ? gate.reason : gate.reasonEn); return; }
    onSave?.({ rules: draft.rules.trim(), sanctions: draft.sanctions.trim(), criteria: draft.criteria });
    setDraft(null);
    setErr("");
  };
  return (
    <section data-uniform-policy={standing.id} style={{ ...slab, display: "flex", flexDirection: "column", gap: 10, padding: "14px 18px" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14 }}>{ar ? "اشتراطات زي العاملين — النموذج الموحد م53" : "Staff uniform rules — model Art. 53"}</strong>
        {standing.id === "none" ? pill("warn", ar ? "لم توضع" : "Not set") : null}
        {standing.id === "draft" ? pill("warn", ar ? "لم تُعلَن" : "Not announced") : null}
        {standing.id === "announced" ? pill("ok", ar ? `معلنة منذ ${standing.announcedAt}` : `Announced ${standing.announcedAt}`) : null}
        <span style={{ flex: 1 }} />
        {canEdit && !draft ? <button type="button" onClick={start} style={btn(false)}>{standing.id === "none" ? (ar ? "ضع الاشتراطات" : "Set the rules") : (ar ? "عدّل — إصدار جديد" : "Edit — new version")}</button> : null}
        {canEdit && standing.id === "draft" && !draft ? <button type="button" data-uniform-announce="" onClick={() => onAnnounce?.()} style={btn(true)}>{ar ? "أعلنها على حدة للعمال" : "Announce to the workers"}</button> : null}
        {!canEdit && standing.id === "announced" && meId && !mine ? <button type="button" data-uniform-ack="" onClick={() => onAck?.()} style={btn(true)}>{ar ? "اطّلعت على اشتراطات الزي وأقرّ بالعلم بها" : "I have read the uniform rules"}</button> : null}
        {!canEdit && mine ? pill("ok", ar ? `أقررتَ ${String(mine.at).slice(0, 10)}` : `Acknowledged ${String(mine.at).slice(0, 10)}`) : null}
      </div>
      {draft ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea rows={4} value={draft.rules} onChange={(e) => setDraft((d) => ({ ...d, rules: e.target.value }))} placeholder={ar ? "اشتراطات الزي للعاملين نساءً ورجالاً" : "Uniform rules for women and men"} style={{ ...input, height: "auto", padding: "8px 10px", resize: "vertical" }} />
          {UNIFORM_CRITERIA.map((c) => (
            <label key={c.key} style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" checked={draft.criteria[c.key] === true} onChange={(e) => setDraft((d) => ({ ...d, criteria: { ...d.criteria, [c.key]: e.target.checked } }))} />
              {`(${c.para}) ${ar ? c.ar : c.en}`}
            </label>
          ))}
          <input value={draft.sanctions} onChange={(e) => setDraft((d) => ({ ...d, sanctions: e.target.value }))} placeholder={ar ? "(د) العقوبات المترتبة على المخالفة — من بنود لائحة تنظيم العمل" : "(d) Penalties for breach — from the regulation's clauses"} style={input} />
          {err ? <span role="alert" style={{ fontSize: 12, color: "var(--nv-bad-ink)" }}>{err}</span> : null}
          <span style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={save} style={btn(true)}>{ar ? "حفظ — يحتاج إعلاناً وإقراراً جديدين" : "Save — needs a fresh announcement"}</button>
            <button type="button" onClick={() => { setDraft(null); setErr(""); }} style={btn(false)}>{ar ? "إلغاء" : "Cancel"}</button>
          </span>
        </div>
      ) : standing.id !== "none" ? (
        <>
          <span style={{ fontSize: 12.5, color: "var(--nv-ink)", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{uniform.rules}</span>
          <span style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.7 }}>{ar ? `العقوبات: ${uniform.sanctions}` : `Penalties: ${uniform.sanctions}`}</span>
        </>
      ) : null}
      <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.7 }}>
        {ar ? "تُعلَن على حدة في مكان ظاهر أو بوسيلة تكفل علم العاملين، ويُقرّون بالعلم بها (م53/1/هـ). لا يُرفع جزاء مخالفة زي على من لم يُقرّ بالإصدار الساري." : "Announced separately and acknowledged by each worker (53(1)(e)). No uniform penalty for a worker who has not acknowledged the version in force."}
      </span>
      {canEdit && standing.id === "announced" ? (
        <span data-uniform-acks="" style={{ fontSize: 12, color: ack.pending.length ? "var(--nv-warn-ink)" : "var(--nv-ok-ink)", lineHeight: 1.8 }}>
          {ar ? `أقرّ ${ack.acked.length} من ${ack.total}` : `${ack.acked.length} of ${ack.total} acknowledged`}
          {ack.pending.length ? (ar ? ` · لم يُقرّ: ${ack.pending.map((e) => e.name || e.id).join(" · ")}` : ` · not yet: ${ack.pending.map((e) => e.name || e.id).join(" · ")}`) : ""}
        </span>
      ) : null}
    </section>
  );
}

export default function DisciplineScheduleBoard({ ar, today, regulation = MODEL_REGULATION, canEdit = false, onSave, employees = [], meId = "", onAnnounce, onAck, uniform = null, onSaveUniform, onAnnounceUniform, onAckUniform }) {
  const art = citeRule("discipline.penalties.cite", today)?.article || "—";
  const cap = ruleValue("discipline.fine.maxDays", today);
  const own = regulation?.source === "own";
  const [draft, setDraft] = useState(null);
  const [tried, setTried] = useState(false);
  const errors = draft ? checkRegulationDraft(draft, ar) : [];

  const setClause = (i, patch) => setDraft((d) => ({ ...d, clauses: d.clauses.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  const setStep = (i, k, value) => setDraft((d) => ({
    ...d,
    clauses: d.clauses.map((c, j) => (j === i ? { ...c, steps: c.steps.map((x, m) => (m === k ? value : x)) } : c)),
  }));
  const save = () => {
    setTried(true);
    if (errors.length) return;
    onSave?.({
      approvalNo: draft.approvalNo.trim(),
      approvedAt: draft.approvedAt,
      clauses: draft.clauses.map((c) => ({
        id: c.id,
        ar: c.ar.trim(),
        en: c.en.trim(),
        ...(c.group ? { group: c.group, no: c.no } : {}),
        ...(c.plus ? { plus: c.plus } : {}),
        ...(c.art80 ? { art80: c.art80 } : {}),
        steps: c.steps.map((x) => String(x || "").trim()).filter(Boolean),
      })),
    });
    setDraft(null);
    setTried(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <RegulationAnnouncement ar={ar} today={today} regulation={regulation} canEdit={canEdit} employees={employees} meId={meId} onAnnounce={onAnnounce} onAck={onAck} />
      <UniformPolicyCard ar={ar} uniform={uniform} canEdit={canEdit} employees={employees} meId={meId} onSave={onSaveUniform} onAnnounce={onAnnounceUniform} onAck={onAckUniform} />
      <section data-discipline-schedule="" data-regulation-source={regulation?.source || "model"} style={{ ...slab, display: "flex", flexDirection: "column" }}>
        <SectionHead
          title={own ? (ar ? "لائحة تنظيم العمل المعتمدة" : "Approved work-organization regulation") : (ar ? "النموذج الاسترشادي — لم تُسجَّل لائحة المنشأة" : "Model schedule — the establishment's regulation is not recorded")}
          note={own
            ? (ar
              ? <>رقم الاعتماد <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace" }}>{regulation.approvalNo || "—"}</span> · بتاريخ {regulationDate(regulation.approvedAt, true) || "—"} · كل جزاء يُرفع يسمّي بنده منها، ويُطبَّق عليه درجة التكرار خلال 180 يوماً (المادتان 67 و68).</>
              : <>Approval {regulation.approvalNo || "—"} · {String(regulation.approvedAt || "").slice(0, 10) || "—"} · every sanction names its clause, stepped by repeats within 180 days (Arts. 67–68).</>)
            : (ar
              ? "المادة 67: لا يُوقَّع جزاء غير وارد في النظام أو في لائحة تنظيم العمل. هذه جداول المخالفات الثلاثة في النموذج الموحد للائحة تنظيم العمل (الملحق 1 باللائحة التنفيذية) — للمنشأة دون خمسين عاملاً اعتماده إلكترونياً كما هو (اللائحة م4). سجّل لائحتك المعتمدة ليصير كل جزاء مربوطاً ببندها."
              : "Article 67: no penalty outside the Law or the work-organization regulation. This table is a model — record your approved regulation so every sanction is tied to its clause.")}
          trailing={canEdit && !draft ? (
            <button type="button" data-regulation-edit="" onClick={() => { setDraft(draftFrom(regulation)); setTried(false); }} style={btn(!own)}>
              {own ? (ar ? "عدّل اللائحة" : "Edit the regulation") : (ar ? "سجّل لائحة المنشأة" : "Record the regulation")}
            </button>
          ) : null}
        />

        {draft ? (
          <div data-regulation-editor="" style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--nv-ink2)" }}>{ar ? "رقم اعتماد اللائحة" : "Approval number"}</span>
                <input data-regulation-no="" value={draft.approvalNo} onChange={(e) => setDraft((d) => ({ ...d, approvalNo: e.target.value }))} style={input} placeholder={ar ? "كما في خطاب الاعتماد" : "As on the approval letter"} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--nv-ink2)" }}>{ar ? "تاريخ الاعتماد" : "Approval date"}</span>
                <PlatformDateField ar={ar} value={draft.approvedAt} onChange={(v) => setDraft((d) => ({ ...d, approvedAt: v }))} style={{ height: 38, minHeight: 38, fontSize: 13, background: "var(--nv-page)", borderRadius: 8 }} />
              </label>
            </div>
            <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.7 }}>
              {ar
                ? "اكتب كل خانة كما في لائحتك: «إنذار كتابي»، أو نسبة من أجر اليوم مثل «10%»، أو أياماً حتى 5 مثل «يومان»، أو «إيقاف يومين بدون أجر»، أو «تأجيل الترقية أو الحرمان من العلاوة»، أو «فصل مع المكافأة»، أو «فصل بدون مكافأة (المادة 80)». تحت كل خانة يظهر كيف قُرئت."
                : "Write each cell as in your regulation: “Written warning”, a share of a day's wage like “10%”, days up to 5, or “Dismissal”. Each cell shows how it was read."}
            </span>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {draft.clauses.map((c, i) => (
                <li key={c.id} data-regulation-row={c.id} style={{ border: "1px solid var(--nv-line)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8, background: "var(--nv-card)" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, color: "var(--nv-muted)", width: 22 }}>{i + 1}</span>
                    <input value={ar ? c.ar : c.en} onChange={(e) => setClause(i, ar ? { ar: e.target.value } : { en: e.target.value })} placeholder={ar ? "المخالفة كما في اللائحة" : "The offence as in the regulation"} style={{ ...input, fontWeight: 700 }} />
                    <button type="button" aria-label={ar ? "احذف البند" : "Remove the clause"} onClick={() => setDraft((d) => ({ ...d, clauses: d.clauses.filter((_, j) => j !== i) }))} style={{ ...btn(false), width: 36, padding: 0, color: DANGER }}>×</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,130px),1fr))", gap: 8 }}>
                    {c.steps.map((x, k) => {
                      const p = parseRegulationStep(x);
                      return (
                        <label key={k} style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                          <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{ar ? ["أول مرة", "ثاني مرة", "ثالث مرة", "رابع مرة"][k] : ["First", "Second", "Third", "Fourth"][k]}</span>
                          <input value={x} onChange={(e) => setStep(i, k, e.target.value)} style={{ ...input, borderColor: x && !p.ok ? "var(--nv-bad-line)" : "var(--nv-line)" }} />
                          <span style={{ fontSize: 10.5, color: x ? (p.ok ? "var(--nv-ok-ink)" : "var(--nv-bad-ink)") : "var(--nv-muted)", lineHeight: 1.4 }}>
                            {x ? regulationStepLabel(p, ar) : (k === 0 ? (ar ? "مطلوبة" : "Required") : (ar ? "اختيارية" : "Optional"))}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ol>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button type="button" data-regulation-add="" onClick={() => setDraft((d) => ({ ...d, clauses: [...d.clauses, { id: newClauseId(), ar: "", en: "", steps: ["", "", "", ""] }] }))} style={btn(false)}>{ar ? "أضف بنداً" : "Add a clause"}</button>
              <span style={{ flex: 1 }} />
              <button type="button" onClick={() => { setDraft(null); setTried(false); }} style={btn(false)}>{ar ? "إلغاء" : "Cancel"}</button>
              <button type="button" data-regulation-save="" onClick={save} style={btn(true)}>{ar ? "احفظ اللائحة المعتمدة" : "Save the approved regulation"}</button>
            </div>
            {tried && errors.length ? (
              <ul data-regulation-errors="" style={{ margin: 0, padding: "10px 14px", listStyle: "none", border: "1px solid var(--nv-bad-line)", borderRadius: 8, color: "var(--nv-bad-ink)", fontSize: 12, lineHeight: 1.8 }}>
                {errors.map((e) => <li key={e}>{e}</li>)}
              </ul>
            ) : null}
          </div>
        ) : (
          <RegulationTable regulation={regulation} ar={ar} />
        )}
      </section>

      <section className="nv-paper" data-discipline-ladder-limit="" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--nv-line)", fontSize: 13, fontWeight: 700, background: "var(--nv-hover)" }}>
          {ar ? "حدود من النظام فوق كل لائحة" : "Limits from the Law above any regulation"}
        </div>
        {OUTSIDE.map((row) => (
          <div key={row[0]} style={{ padding: "8px 14px", borderBottom: "1px solid var(--nv-line)", display: "grid", gridTemplateColumns: "52px minmax(0,1fr)", gap: 10, alignItems: "center", background: "var(--nv-card)" }}>
            <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 15, fontWeight: 600 }}>{row[0]}</span>
            <span style={{ fontSize: 12, color: "var(--nv-ink)", lineHeight: 1.55 }}>{ar ? row[1] : row[2]}</span>
          </div>
        ))}
      </section>

      <section className="nv-paper" data-discipline-kinds="" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--nv-line)", display: "flex", flexDirection: "column", gap: 3, background: "var(--nv-hover)" }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{ar ? "جزاءات المادة 66 — القائمة المغلقة" : "Article 66 — the closed list"}</span>
          <span style={{ fontSize: 12, color: "var(--nv-muted)", lineHeight: 1.6 }}>
            {ar ? "ما يجوز توقيعه فقط. لا جزاء يُكتب نصّاً حرّاً خارج هذه القائمة." : "Only what may be imposed. A penalty is not free text outside this list."}
          </span>
        </div>
        {DISCIPLINE_PENALTY_KINDS.map((kind) => {
          const wage = kind.id === "fine" || kind.id === "suspend";
          const note = wage
            ? (ar ? `حتى ${cap || "—"} أيام` : `Up to ${cap || "—"} days`)
            : (kind.deferMonths ? (ar ? "حتى سنة" : "Up to one year") : "—");
          return (
            <div key={kind.id} style={{ padding: "8px 14px", borderBottom: "1px solid var(--nv-line)", display: "grid", gridTemplateColumns: "36px minmax(0,1fr) auto", gap: 10, alignItems: "center", background: "var(--nv-card)" }}>
              <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 15, fontWeight: 600 }}>{kind.limb || "—"}</span>
              <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.4 }}>{ar ? kind.ar : kind.en}</span>
                <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{note}</span>
              </span>
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--nv-ok-ink)", border: "1px solid var(--nv-ok-line)", borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap", background: "transparent" }}>
                {ar ? `المادة ${art}` : `Art. ${art}`}
              </span>
            </div>
          );
        })}
      </section>
    </div>
  );
}
