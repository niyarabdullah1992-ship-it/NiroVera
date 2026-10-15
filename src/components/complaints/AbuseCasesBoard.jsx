import React, { useMemo, useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { laborCalendarOf } from "@/lib/ummAlQuraCalendar";
import {
  ABUSE_GOV_PATH_AR,
  ABUSE_GOV_PATH_EN,
  ABUSE_KINDS,
  ABUSE_OUTCOMES,
  ABUSE_STEPS,
  abuseCaseClocks,
  abuseRetaliationFlags,
  abuseStepIndex,
} from "@/lib/abuseComplaint";
import { closeAbuseCase, decideAbuseCase, formAbuseCommittee, recordAbuseHearing, recordAbuseSeparation } from "@/lib/abuseStore";
import { BORDER, MUTED, NAVY, cardShell, field } from "@/lib/platformStyles";

const card = { ...cardShell, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 };
const btn = (solid) => ({ fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, height: 34, padding: "0 12px", borderRadius: 8, border: solid ? "none" : `1px solid ${BORDER}`, background: solid ? "#0B3D27" : "var(--nv-card)", color: solid ? "#fff" : "var(--nv-ink)", cursor: "pointer", whiteSpace: "nowrap" });
const small = { fontSize: 11.5, color: MUTED, lineHeight: 1.7 };

function Result(res, ar, ok) {
  if (!res?.ok) toast({ description: ar ? res?.reason : res?.reasonEn, variant: "destructive" });
  else if (ok) toast({ description: ok });
  return res?.ok;
}

/** One confidential case with its next step (model regulation Arts. 55–56). */
function CaseRow({ row, ar, companyId, employees, disciplinaryCases, today, calendar, by }) {
  const [members, setMembers] = useState([]);
  const [decisionRef, setDecisionRef] = useState("");
  const [hearing, setHearing] = useState({ who: "", role: "complainant", statement: "", signedByParty: false, signedByCommittee: false });
  const [measure, setMeasure] = useState("");
  const [outcome, setOutcome] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [criminal, setCriminal] = useState(false);
  const [referredAt, setReferredAt] = useState("");
  const kind = ABUSE_KINDS.find((k) => k.id === row.kind);
  const clocks = abuseCaseClocks(row, { today, calendar });
  const flags = abuseRetaliationFlags(row, disciplinaryCases);
  const step = abuseStepIndex(row);
  const pickable = employees.filter((e) => String(e.id) !== String(row.accusedId) && String(e.id) !== String(row.reporterId));

  return (
    <article data-abuse-case={row.id} style={card}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <strong style={{ fontSize: 13.5, color: NAVY }}>{ar ? "شكوى إيذاء — سرّية" : "Abuse complaint — confidential"}</strong>
        <span style={{ fontSize: 11, color: MUTED }}>{ar ? kind?.ar : kind?.en}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, fontWeight: 700 }}>{ar ? ABUSE_STEPS[step].ar : ABUSE_STEPS[step].en}</span>
      </div>
      <span style={{ fontSize: 12.5, lineHeight: 1.7 }}>
        {ar ? `${row.reporterRole === "witness" ? "بلاغ من شاهد" : "من المتضرر"}: ${row.reporterName || "—"} · المشكو في حقه: ${row.accusedName || "—"} · الواقعة ${row.incidentAt}` : `${row.reporterRole} ${row.reporterName} · accused ${row.accusedName} · ${row.incidentAt}`}
      </span>
      <span style={{ fontSize: 12.5, lineHeight: 1.7, color: "var(--nv-ink2)" }}>{row.description}</span>
      {clocks.map((c) => (
        <span key={c.id} data-abuse-clock={c.id} style={{ fontSize: 12, fontWeight: 700, color: c.over ? "var(--nv-bad-ink)" : c.soon ? "var(--nv-warn-ink)" : "var(--nv-ok-ink)" }}>
          {c.over
            ? (ar ? `انقضت مهلة التحقيق (${c.due}) — خمسة أيام عمل من تلقي الشكوى (النموذج م55/2).` : `Inquiry window passed (${c.due}) — model Art. 55(2).`)
            : (ar ? `مهلة التحقيق: يبقى ${c.left} يوم عمل — حتى ${c.due} (النموذج م55/2).` : `Inquiry: ${c.left} working day(s) left — until ${c.due}.`)}
        </span>
      ))}
      {flags.map((f) => <span key={f.caseId} data-abuse-retaliation="" style={{ fontSize: 12, color: "var(--nv-warn-ink)" }}>{ar ? f.reason : f.reasonEn}</span>)}

      {row.status === "filed" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={small}>{ar ? "شكّل لجنة التحقيق بقرار من المسؤول المختص — لا يكون أحد الطرفين عضواً فيها (م55/2)." : "Form the committee by decision of the competent official (Art. 55(2))."}</span>
          <select multiple value={members} onChange={(e) => setMembers([...e.target.selectedOptions].map((o) => o.value))} style={{ ...field, height: 90 }}>
            {pickable.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <div style={{ display: "flex", gap: 6 }}>
            <input value={decisionRef} onChange={(e) => setDecisionRef(e.target.value)} placeholder={ar ? "رقم قرار التشكيل" : "Decision no."} style={field} />
            <button type="button" style={btn(true)} onClick={() => Result(formAbuseCommittee(companyId, row.id, { members: members.map((id) => ({ id, name: employees.find((e) => String(e.id) === String(id))?.name || "" })), decisionRef, by }), ar)}>{ar ? "شكّل اللجنة" : "Form"}</button>
          </div>
        </div>
      ) : null}

      {row.committee && !["decided", "closed"].includes(row.status) ? (
        <>
          <span style={small}>{ar ? `اللجنة: ${row.committee.members.map((m) => m.name).join("، ")} · القرار ${row.committee.decisionRef}` : `Committee: ${row.committee.members.map((m) => m.name).join(", ")}`}</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={small}>{ar ? "محضر سماع — يوقعه صاحب الأقوال وأعضاء اللجنة في نهاية كل صفحة (م56/1). ولّلجنة استدعاء من ترى (م56/2)." : "Hearing minutes signed by the speaker and the committee (Art. 56(1))."}</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,160px),1fr))", gap: 6 }}>
              <input value={hearing.who} onChange={(e) => setHearing({ ...hearing, who: e.target.value })} placeholder={ar ? "من سُمعت أقواله" : "Who was heard"} style={field} />
              <select value={hearing.role} onChange={(e) => setHearing({ ...hearing, role: e.target.value })} style={field}>
                <option value="complainant">{ar ? "الشاكي" : "Complainant"}</option>
                <option value="accused">{ar ? "المشكو في حقه" : "Accused"}</option>
                <option value="witness">{ar ? "شاهد" : "Witness"}</option>
              </select>
            </div>
            <textarea value={hearing.statement} onChange={(e) => setHearing({ ...hearing, statement: e.target.value })} placeholder={ar ? "الأقوال كما دُوّنت في المحضر" : "The statement"} style={{ ...field, minHeight: 60 }} />
            <label style={small}><input type="checkbox" checked={hearing.signedByParty} onChange={(e) => setHearing({ ...hearing, signedByParty: e.target.checked })} /> {ar ? "وقّع صاحب الأقوال" : "Signed by the speaker"}</label>
            <label style={small}><input type="checkbox" checked={hearing.signedByCommittee} onChange={(e) => setHearing({ ...hearing, signedByCommittee: e.target.checked })} /> {ar ? "وقّع أعضاء اللجنة كل صفحة" : "Signed by the committee"}</label>
            <button type="button" style={btn(false)} onClick={() => { if (Result(recordAbuseHearing(companyId, row.id, hearing, by), ar)) setHearing({ who: "", role: "witness", statement: "", signedByParty: false, signedByCommittee: false }); }}>{ar ? "أثبت المحضر" : "Record the minutes"}</button>
            {(row.hearings || []).length ? <span style={small}>{ar ? `محاضر: ${(row.hearings || []).map((h) => h.who).join("، ")}` : `Minutes: ${(row.hearings || []).length}`}</span> : null}
          </div>
          {!row.separation ? (
            <div style={{ display: "flex", gap: 6 }}>
              <input value={measure} onChange={(e) => setMeasure(e.target.value)} placeholder={ar ? "التفريق بين الطرفين أثناء التحقيق (م56/3) — اختياري" : "Separate the parties (Art. 56(3)) — optional"} style={field} />
              <button type="button" style={btn(false)} onClick={() => Result(recordAbuseSeparation(companyId, row.id, { measure, by }), ar)}>{ar ? "سجّل" : "Record"}</button>
            </div>
          ) : <span style={small}>{ar ? `التفريق: ${row.separation.measure}` : `Separation: ${row.separation.measure}`}</span>}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <select value={outcome} onChange={(e) => setOutcome(e.target.value)} style={field}>
              <option value="">{ar ? "— توصية اللجنة بالأغلبية —" : "— Committee recommendation —"}</option>
              {ABUSE_OUTCOMES.map((o) => <option key={o.id} value={o.id}>{ar ? o.ar : o.en}</option>)}
            </select>
            {outcome === "proven" || outcome === "malicious" ? (
              <input value={recommendation} onChange={(e) => setRecommendation(e.target.value)} placeholder={outcome === "malicious" ? (ar ? "مثال: «تقديم بلاغ أو شكوى كيدية» — سلوك 14، المرة الأولى: ثلاثة أيام" : "e.g. malicious complaint — conduct 14") : (ar ? "الجزاء الموصى به وبند اللائحة" : "Recommended penalty and clause")} style={field} />
            ) : null}
            <label style={small}><input type="checkbox" checked={criminal} onChange={(e) => setCriminal(e.target.checked)} /> {ar ? "الاعتداء يشكل جريمة جنائية — رُفع للمدير العام لإبلاغ الجهات الحكومية (م56/5)" : "Criminal — referred to the general manager (Art. 56(5))"}</label>
            {criminal ? <input type="date" value={referredAt} onChange={(e) => setReferredAt(e.target.value)} style={field} /> : null}
            <button type="button" style={btn(true)} onClick={() => Result(decideAbuseCase(companyId, row.id, { outcome, recommendation, criminal, referredAt, by }), ar, ar ? "رُفعت التوصية. افتح ملف الجزاء من «الجزاءات» بالبند الموصى به." : "Recommendation filed.")}>{ar ? "ارفع التوصية" : "File the recommendation"}</button>
          </div>
        </>
      ) : null}

      {row.status === "decided" ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={small}>{ar ? `التوصية: ${ABUSE_OUTCOMES.find((o) => o.id === row.outcome?.id)?.ar || ""}${row.outcome?.recommendation ? ` — ${row.outcome.recommendation}` : ""}` : row.outcome?.id}</span>
          <span style={{ flex: 1 }} />
          <button type="button" style={btn(false)} onClick={() => Result(closeAbuseCase(companyId, row.id, by), ar)}>{ar ? "أغلق الملف" : "Close"}</button>
        </div>
      ) : null}
      <span style={small}>{ar ? "لا يمنع الجزاء التأديبي لجوء المعتدى عليه للجهات الحكومية المختصة (م56/7)، ولا يضار العامل من شكواه." : "A disciplinary penalty does not bar going to the authorities (Art. 56(7))."}</span>
    </article>
  );
}

/** Senior HR's view of the confidential workplace-abuse cases (model regulation Arts. 54–56). */
export default function AbuseCasesBoard({ data, companyId, ar = true, by = "" }) {
  const cases = useMemo(() => (Array.isArray(data?.abuseCases) ? data.abuseCases : []), [data?.abuseCases]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
  const calendar = laborCalendarOf(data);
  const open = cases.filter((r) => r.status !== "closed");
  return (
    <section data-abuse-board="" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ ...card, gap: 4 }}>
        <strong style={{ fontSize: 14 }}>{ar ? `قضايا الإيذاء في مكان العمل — ${open.length} مفتوحة` : `Workplace abuse cases — ${open.length} open`}</strong>
        <span style={small}>
          {ar
            ? "النموذج الموحد للائحة تنظيم العمل م54–56: لجنة بقرار من المسؤول المختص تحقق بسرية خلال خمسة أيام عمل من تلقي الشكوى، وتسمع الأطراف والشهود في محاضر موقعة، ولها التوصية بالتفريق بين الطرفين، وترفع ما يشكل جريمة للمدير العام لإبلاغ الجهات الحكومية."
            : "Model regulation Arts. 54–56: a committee investigates confidentially within five working days, hears all parties in signed minutes, may separate them, and refers crimes to the authorities."}
        </span>
        <span style={small}>{ar ? ABUSE_GOV_PATH_AR : ABUSE_GOV_PATH_EN}</span>
      </div>
      {cases.length ? cases.map((row) => (
        <CaseRow key={row.id} row={row} ar={ar} companyId={companyId} employees={data?.employees || []} disciplinaryCases={data?.disciplinaryCases || []} today={today} calendar={calendar} by={by} />
      )) : <span style={{ ...small, textAlign: "center", padding: 12 }}>{ar ? "لا قضايا." : "No cases."}</span>}
    </section>
  );
}
