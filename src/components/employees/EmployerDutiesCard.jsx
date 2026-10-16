import React, { useState } from "react";
import { toast } from "@/components/ui/use-toast";
import {
  HELD_DOCUMENT_KINDS,
  TRAINING_KINDS,
  heldDocumentViolations,
  medicalExamStatus,
  trainingDocumentationDue,
} from "@/lib/employerDuties";
import {
  addMedicalExam,
  addTrainingRecord,
  markTrainingDocumented,
  recordHeldDocument,
  returnHeldDocument,
  setOccupationalExposure,
} from "@/lib/employerDutiesStore";
import RightHint from "@/components/shared/RightHint";
import { heldDocumentHint, medicalExamHint, serviceCertificateHint, trainingHint } from "@/lib/rightHints.disc";

const paper = { background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" };
const head = { padding: "14px 20px", borderBottom: "1px solid var(--nv-line3)", display: "flex", flexDirection: "column", gap: 3 };
const row = { padding: "10px 20px", borderBottom: "1px solid var(--nv-line2)", fontSize: 12.5, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" };
const input = { fontFamily: "inherit", fontSize: 12.5, height: 34, padding: "0 10px", border: "1px solid var(--nv-line)", borderRadius: 8, background: "var(--nv-page)", color: "var(--nv-ink)", minWidth: 0, boxSizing: "border-box" };
const btn = { fontFamily: "inherit", fontSize: 12, fontWeight: 700, height: 34, padding: "0 12px", borderRadius: 8, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: "var(--nv-ink)", cursor: "pointer" };
const muted = { fontSize: 11.5, color: "var(--nv-ink2)", lineHeight: 1.7 };
const today = () => new Date().toISOString().slice(0, 10);

function done(res, ar) {
  if (!res?.ok) toast({ description: ar ? res?.reason : res?.reasonEn, variant: "destructive" });
  return Boolean(res?.ok);
}

/** Training, periodic medical exams, and documents held — on the worker's file. */
export default function EmployerDutiesCard({ employee, companyId, ar = true, canManage = false, by = "" }) {
  const [t, setT] = useState({ course: "", kind: "practical", provider: "", from: "", to: "", hours: "", cost: "", bondDays: "" });
  const [hazard, setHazard] = useState(employee?.profile?.exposureHazard || "");
  const [exam, setExam] = useState({ at: today(), doctor: "", result: "", fit: true });
  const [held, setHeld] = useState({ kind: "passport", heldSince: today() });
  if (!employee) return null;
  const med = medicalExamStatus(employee);
  const violations = heldDocumentViolations(employee);
  const contractType = employee.profile?.contractType === "fixed" ? "fixed" : "indefinite";
  const hctx = { view: canManage ? "manager" : "employee", ar, today: today(), employee };
  const medHint = medicalExamHint(employee, hctx);

  return (
    <div data-employer-duties="" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,330px),1fr))", gap: 16 }}>
      <section style={paper} data-training-file="">
        <div style={head}>
          <strong style={{ fontSize: 15 }}>{ar ? "سجل التدريب" : "Training record"}</strong>
          <span style={muted}>{ar ? "البرنامج ونوعه ومدته وساعاته والجهة والتكلفة، ويُوثّق خلال 30 يوماً." : "Program, kind, dates, hours, provider and cost — documented within 30 days."}</span>
        </div>
        {(employee.trainings || []).length ? employee.trainings.map((r) => {
          const doc = trainingDocumentationDue(r);
          return (
            <div key={r.id} style={row}>
              <span style={{ fontWeight: 700 }}>{r.course}</span>
              <span style={muted}>{`${r.from} → ${r.to} · ${r.hours} ${ar ? "ساعة" : "h"} · ${r.provider} · ${Number(r.cost || 0).toLocaleString("en-US")} ${ar ? "ر.س" : "SAR"}`}{r.bond?.days ? (ar ? ` · التزام ${r.bond.days} يوماً بعده` : ` · bond ${r.bond.days}d`) : ""}</span>
              <span style={{ flex: 1 }} />
              {r.documentedAt ? <span style={{ ...muted, color: "var(--nv-ok-ink)" }}>{ar ? `وُثّق ${r.documentedAt}` : `Documented ${r.documentedAt}`}</span> : doc ? (
                <>
                  <span style={{ ...muted, color: doc.over ? "var(--nv-bad-ink)" : "var(--nv-warn-ink)" }}>{ar ? `يوثّق حتى ${doc.due}` : `Document by ${doc.due}`}</span>
                  {canManage ? <button type="button" style={btn} onClick={() => done(markTrainingDocumented(companyId, employee.id, r.id, today(), by), ar)}>{ar ? "وُثّق في المنصة" : "Documented"}</button> : null}
                </>
              ) : null}
              <RightHint ar={ar} hint={trainingHint(r, hctx)} />
            </div>
          );
        }) : <div style={row}><span style={muted}>{ar ? "لا شيء مسجّل." : "Nothing on file."}</span></div>}
        {canManage ? (
          <div style={{ ...row, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,130px),1fr))" }}>
            <input value={t.course} onChange={(e) => setT({ ...t, course: e.target.value })} placeholder={ar ? "البرنامج" : "Program"} style={input} />
            <select value={t.kind} onChange={(e) => setT({ ...t, kind: e.target.value })} style={input}>{TRAINING_KINDS.map((k) => <option key={k.id} value={k.id}>{ar ? k.ar : k.en}</option>)}</select>
            <input value={t.provider} onChange={(e) => setT({ ...t, provider: e.target.value })} placeholder={ar ? "الجهة المقدمة" : "Provider"} style={input} />
            <input type="date" value={t.from} onChange={(e) => setT({ ...t, from: e.target.value })} style={input} />
            <input type="date" value={t.to} onChange={(e) => setT({ ...t, to: e.target.value })} style={input} />
            <input type="number" min="0" value={t.hours} onChange={(e) => setT({ ...t, hours: e.target.value })} placeholder={ar ? "الساعات" : "Hours"} style={input} />
            <input type="number" min="0" value={t.cost} onChange={(e) => setT({ ...t, cost: e.target.value })} placeholder={ar ? "التكلفة" : "Cost"} style={input} />
            <input type="number" min="0" value={t.bondDays} onChange={(e) => setT({ ...t, bondDays: e.target.value })} placeholder={ar ? "التزام بعده (أيام) — اختياري" : "Bond days — optional"} style={input} />
            <button type="button" style={btn} onClick={() => {
              const record = { employeeId: employee.id, course: t.course.trim(), kind: t.kind, provider: t.provider.trim(), from: t.from, to: t.to, hours: Number(t.hours), cost: t.cost === "" ? "" : Number(t.cost), ...(Number(t.bondDays) > 0 ? { bond: { days: Number(t.bondDays), contractType, contractEndDate: employee.profile?.contractEndDate || "" } } : {}) };
              if (done(addTrainingRecord(companyId, record, by), ar)) setT({ course: "", kind: "practical", provider: "", from: "", to: "", hours: "", cost: "", bondDays: "" });
            }}>{ar ? "أضف" : "Add"}</button>
          </div>
        ) : null}
      </section>

      <section style={paper} data-medical-file="">
        <div style={head}>
          <strong style={{ fontSize: 15 }}>{ar ? "الفحص الطبي الدوري" : "Periodic medical exam"}</strong>
          <span style={muted}>{ar ? "المعرّض لخطر مرض مهني يُفحص فحصاً شاملاً مرة كل سنة على الأقل." : "Workers exposed to an occupational disease are examined at least yearly."}</span>
        </div>
        <div style={row}>
          {med.required ? (
            <span style={{ fontWeight: 700, color: med.over ? "var(--nv-bad-ink)" : med.soon ? "var(--nv-warn-ink)" : "var(--nv-ok-ink)" }}>
              {med.over ? (ar ? `الفحص متأخر منذ ${med.due}` : `Overdue since ${med.due}`) : (ar ? `الفحص القادم ${med.due}` : `Next exam ${med.due}`)}{med.unfit ? (ar ? " · آخر نتيجة: غير لائق" : " · last result: unfit") : ""}
            </span>
          ) : null}
          {med.required ? (
            <><span style={{ flex: 1 }} /><RightHint ar={ar} hint={medHint} /></>
          ) : <span style={muted}>{ar ? "غير مسجّل كمعرّض لخطر مهني." : "Not recorded as exposed."}</span>}
        </div>
        {(employee.medicalExams || []).map((x) => (
          <div key={x.id} style={row}><span style={{ fontWeight: 700 }}>{x.at}</span><span style={muted}>{`${x.doctor} · ${x.result}${x.fit === false ? (ar ? " · غير لائق" : " · unfit") : ""}`}</span></div>
        ))}
        {canManage ? (
          <>
            <div style={row}>
              <input value={hazard} onChange={(e) => setHazard(e.target.value)} placeholder={ar ? "الخطر المهني (مثال: ضوضاء، غبار السيليكا) — فارغ إن لم يوجد" : "Occupational hazard — empty if none"} style={{ ...input, flex: 1 }} />
              <button type="button" style={btn} onClick={() => done(setOccupationalExposure(companyId, employee.id, hazard, by), ar)}>{ar ? "احفظ" : "Save"}</button>
            </div>
            {med.required ? (
              <div style={{ ...row, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,130px),1fr))" }}>
                <input type="date" value={exam.at} onChange={(e) => setExam({ ...exam, at: e.target.value })} style={input} />
                <input value={exam.doctor} onChange={(e) => setExam({ ...exam, doctor: e.target.value })} placeholder={ar ? "الطبيب / الجهة" : "Doctor / provider"} style={input} />
                <input value={exam.result} onChange={(e) => setExam({ ...exam, result: e.target.value })} placeholder={ar ? "النتيجة" : "Result"} style={input} />
                <select value={exam.fit ? "fit" : "unfit"} onChange={(e) => setExam({ ...exam, fit: e.target.value === "fit" })} style={input}>
                  <option value="fit">{ar ? "لائق" : "Fit"}</option>
                  <option value="unfit">{ar ? "غير لائق" : "Unfit"}</option>
                </select>
                <button type="button" style={btn} onClick={() => { if (done(addMedicalExam(companyId, employee.id, exam, by), ar)) setExam({ at: today(), doctor: "", result: "", fit: true }); }}>{ar ? "أثبت الفحص" : "Record"}</button>
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      <section style={paper} data-held-docs="">
        <div style={head}>
          <strong style={{ fontSize: 15 }}>{ar ? "وثائق لدى المنشأة" : "Documents held by the employer"}</strong>
          <span style={muted}>{ar ? "لا تُحتجز وثائق العامل غير السعودي، ويُعاد كل ما أودعه عند انتهاء العقد." : "A non-Saudi worker's documents are not held; deposits return at contract end."}</span>
        </div>
        {employee.profile?.contractExit ? (
          <div style={row} data-service-cert="">
            <span style={{ fontWeight: 700 }}>{ar ? "شهادة الخدمة" : "Service certificate"}</span>
            <span style={muted}>{ar ? "دون مقابل عند انتهاء العلاقة" : "Free at the end of service"}</span>
            <span style={{ flex: 1 }} />
            <RightHint ar={ar} hint={serviceCertificateHint(employee, hctx)} />
          </div>
        ) : null}
        {violations.map((v) => <div key={`${v.kind}-${v.since}`} data-held-violation="" style={{ ...row, color: "var(--nv-bad-ink)", fontWeight: 600 }}>{ar ? v.reason : v.reasonEn}</div>)}
        {(employee.profile?.heldDocuments || []).map((d) => (
          <div key={d.id} style={row}>
            <span style={{ fontWeight: 700 }}>{ar ? HELD_DOCUMENT_KINDS.find((k) => k.id === d.kind)?.ar : HELD_DOCUMENT_KINDS.find((k) => k.id === d.kind)?.en}</span>
            <span style={muted}>{ar ? `منذ ${d.heldSince}` : `since ${d.heldSince}`}{d.returnedAt ? (ar ? ` · أُعيدت ${d.returnedAt}` : ` · returned ${d.returnedAt}`) : ""}</span>
            <span style={{ flex: 1 }} />
            {canManage && !d.returnedAt ? <button type="button" style={btn} onClick={() => done(returnHeldDocument(companyId, employee.id, d.id, today(), by), ar)}>{ar ? "أُعيدت للعامل" : "Returned"}</button> : null}
            <RightHint ar={ar} hint={heldDocumentHint(d, employee, hctx)} />
          </div>
        ))}
        {canManage ? (
          <div style={row}>
            <select value={held.kind} onChange={(e) => setHeld({ ...held, kind: e.target.value })} style={input}>{HELD_DOCUMENT_KINDS.map((k) => <option key={k.id} value={k.id}>{ar ? k.ar : k.en}</option>)}</select>
            <input type="date" value={held.heldSince} onChange={(e) => setHeld({ ...held, heldSince: e.target.value })} style={input} />
            <button type="button" style={btn} onClick={() => done(recordHeldDocument(companyId, employee.id, held, by), ar)}>{ar ? "سجّل وثيقة محتجزة" : "Record a held document"}</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
