import React, { useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { updateCompany } from "@/lib/store";
import { deriveMedicalRegister, deriveTrainingRegister, trainingPlanGaps } from "@/lib/employerDuties";

const shell = { background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" };
const row = { padding: "9px 16px", borderBottom: "1px solid var(--nv-line2)", fontSize: 12.5, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" };
const input = { fontFamily: "inherit", fontSize: 12.5, height: 34, padding: "0 10px", border: "1px solid var(--nv-line)", borderRadius: 8, background: "var(--nv-page)", color: "var(--nv-ink)", minWidth: 0 };
const btn = { fontFamily: "inherit", fontSize: 12, fontWeight: 700, height: 34, padding: "0 12px", borderRadius: 8, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: "var(--nv-ink)", cursor: "pointer" };
const muted = { fontSize: 11.5, color: "var(--nv-ink2)", lineHeight: 1.7 };

/**
 * The training register and plan (Law Arts. 42–44 · Regs Arts. 5(5), 15(4), 16) and the periodic
 * medical-exam register (Law Art. 143 · Regs Art. 5(6)) — derived from the workers' files.
 */
export default function TrainingMedicalPanel({ data, companyId, ar = true, canEdit = false }) {
  const [plan, setPlan] = useState({ course: "", role: "", hours: "" });
  const employees = data?.employees || [];
  const reg = deriveTrainingRegister({ employees });
  const gaps = trainingPlanGaps({ plan: data?.trainingPlan || [], employees });
  const med = deriveMedicalRegister({ employees });
  const addPlan = () => {
    if (String(plan.course).trim().length < 3) {
      toast({ description: ar ? "اكتب اسم البرنامج في الخطة." : "Name the program.", variant: "destructive" });
      return;
    }
    updateCompany(companyId, (d) => {
      d.trainingPlan = [...(Array.isArray(d.trainingPlan) ? d.trainingPlan : []), { id: `tpl_${Date.now().toString(36)}`, course: plan.course.trim(), role: plan.role.trim(), hours: Number(plan.hours) || 0, year: new Date().getFullYear() }];
    });
    setPlan({ course: "", role: "", hours: "" });
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: 14 }}>
      <article style={shell} data-training-register="">
        <div style={{ ...row, flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
          <strong style={{ fontSize: 13.5 }}>{ar ? `سجل التدريب ${reg.year}` : `Training register ${reg.year}`}</strong>
          <span style={muted}>{ar ? `${reg.trained} من ${reg.headcount} تدرّبوا · السعوديون ${Math.round(reg.saudiShare * 100)}% · ${reg.hours} ساعة (اللائحة م5/5)` : `${reg.trained} of ${reg.headcount} trained · ${reg.hours} hours`}</span>
        </div>
        {reg.programs.map((p) => (
          <div key={`${p.course}-${p.kind}`} style={row}><span style={{ fontWeight: 700 }}>{p.course}</span><span style={muted}>{`${p.count} · ${p.days} ${ar ? "يوماً" : "days"} · ${p.provider}`}</span></div>
        ))}
        {reg.undocumented.length ? <div style={{ ...row, color: "var(--nv-bad-ink)" }}>{ar ? `لم يُوثَّق ${reg.undocumented.length} تدريب خلال 30 يوماً في منصة الوزارة (اللائحة م16/أولاً/4).` : `${reg.undocumented.length} trainings not documented within 30 days.`}</div> : null}
        <div style={{ ...row, flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
          <strong style={{ fontSize: 12.5 }}>{ar ? "خطة التدريب لكل مهنة (اللائحة م15/4)" : "Training plan per job (Regs Art. 15(4))"}</strong>
        </div>
        {gaps.length ? gaps.map((g) => (
          <div key={g.id} style={row}>
            <span style={{ fontWeight: 700 }}>{g.course}</span>
            <span style={muted}>{`${g.role || (ar ? "الكل" : "All")} · ${g.done}/${g.target}`}</span>
            {g.missing.length ? <span style={{ ...muted, color: "var(--nv-warn-ink)" }}>{ar ? `لم يحضر: ${g.missing.slice(0, 5).join("، ")}` : `Not yet: ${g.missing.slice(0, 5).join(", ")}`}</span> : null}
          </div>
        )) : <div style={row}><span style={muted}>{ar ? "لا خطة تدريب لهذا العام." : "No training plan this year."}</span></div>}
        {canEdit ? (
          <div style={row}>
            <input value={plan.course} onChange={(e) => setPlan({ ...plan, course: e.target.value })} placeholder={ar ? "البرنامج" : "Program"} style={{ ...input, flex: 1 }} />
            <input value={plan.role} onChange={(e) => setPlan({ ...plan, role: e.target.value })} placeholder={ar ? "المهنة — فارغ للكل" : "Job — empty for all"} style={{ ...input, flex: 1 }} />
            <input type="number" min="0" value={plan.hours} onChange={(e) => setPlan({ ...plan, hours: e.target.value })} placeholder={ar ? "ساعات" : "Hours"} style={{ ...input, width: 80 }} />
            <button type="button" style={btn} onClick={addPlan}>{ar ? "أضف للخطة" : "Add"}</button>
          </div>
        ) : null}
      </article>
      <article style={shell} data-medical-register="">
        <div style={{ ...row, flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
          <strong style={{ fontSize: 13.5 }}>{ar ? "سجل الفحص الطبي الدوري" : "Periodic medical-exam register"}</strong>
          <span style={muted}>{ar ? `${med.exposed} معرّضون لخطر مهني · ${med.overdue} متأخر · ${med.soon} خلال 30 يوماً (المادة 143 · اللائحة م5/6)` : `${med.exposed} exposed · ${med.overdue} overdue · ${med.soon} due soon`}</span>
        </div>
        {med.rows.map(({ employee, status }) => (
          <div key={employee.id} style={row}>
            <span style={{ fontWeight: 700 }}>{employee.name}</span>
            <span style={{ ...muted, color: status.over ? "var(--nv-bad-ink)" : status.soon ? "var(--nv-warn-ink)" : "var(--nv-ink2)" }}>
              {status.last ? (ar ? `آخر فحص ${status.last.at}: ${status.last.result}` : `Last ${status.last.at}`) : (ar ? "لم يُفحص" : "Never examined")} · {ar ? `القادم ${status.due}` : `next ${status.due}`}
            </span>
          </div>
        ))}
        {!med.rows.length ? <div style={row}><span style={muted}>{ar ? "لا عامل مسجّل كمعرّض لخطر مهني — يُسجَّل من ملف العامل." : "No worker recorded as exposed."}</span></div> : null}
      </article>
    </div>
  );
}
