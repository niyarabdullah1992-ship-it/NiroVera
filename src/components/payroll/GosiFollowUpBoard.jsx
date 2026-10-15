import React, { useMemo, useState } from "react";
import { chip, SectionHead, slab } from "@/components/schedules/scheduleChrome";
import { gosiTasks, GOSI_TASK_LABEL } from "@/lib/gosiFollowUp";
import { contributoryWage, employeeWageSplit } from "@/lib/employeeFileView";
import { payrollSaudiFlag } from "@/lib/payrollWageSync";
import { gosiHazardCoverage } from "@/lib/workInjury";
import { recordGosiAction, setInjuryGosiStatus } from "@/lib/store";

const iso = (x) => `⁦${x}⁩`;

function daysAr(n) {
  const a = Math.abs(n);
  if (a === 1) return "يوم واحد";
  if (a === 2) return "يومين";
  return a >= 3 && a <= 10 ? `${a} أيام` : `${a} يوماً`;
}

function money(n) {
  return Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/**
 * «متابعة التأمينات» — the platform is not connected to GOSI, so it does the next best thing: it reads
 * from the file what must be done in «تأميناتي أعمال», counts each deadline, and keeps the proof
 * (date + GOSI reference) once HR records it.
 */
export default function GosiFollowUpBoard({ data, companyId, ar = true, by = "", onChanged }) {
  const today = new Date().toISOString().slice(0, 10);
  const [drafts, setDrafts] = useState({});
  const [showDone, setShowDone] = useState(false);
  const employees = data?.employees || [];
  const tasks = useMemo(() => gosiTasks({
    employees,
    company: data || {},
    today,
    injuryCovered: gosiHazardCoverage(data) !== false,
    contributory: (emp) => contributoryWage(employeeWageSplit(emp?.profile || {}, emp), payrollSaudiFlag(emp) !== false),
  }), [employees, data, today]);
  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const overdue = open.filter((t) => t.overdue).length;
  const list = showDone ? tasks : open;
  const draft = (id) => drafts[id] || { at: today, ref: "" };
  const setDraft = (id, patch) => setDrafts((prev) => ({ ...prev, [id]: { ...draft(id), ...patch } }));

  const detail = (t) => {
    if (t.kind === "register") return ar ? `التحق ${iso(t.from)} — يُسجَّل قبل نهاية شهر الالتحاق` : `Joined ${t.from} — register by the end of that month`;
    if (t.kind === "exclude") return ar
      ? `آخر يوم ${iso(t.from)} · سبب الاستبعاد: ${t.reason ? t.reason.ar : "لا يقابله سبب في الدليل — اختره في تأميناتي أعمال"}`
      : `Last day ${t.from} · reason: ${t.reason ? t.reason.en : "no matching line — pick it in GOSI"}`;
    if (t.kind === "injury") return ar ? `إصابة ${iso(t.from)} — الإبلاغ خلال عشرة أيام` : `Injury ${t.from} — report within ten days`;
    if (t.kind === "wage") return ar ? `الأجر الخاضع تغيّر من ${money(t.previous)} إلى ${money(t.wage)} — يُبلَّغ فوراً` : `Contributory wage changed ${money(t.previous)} → ${money(t.wage)} — report at once`;
    if (t.kind === "payment") return ar ? `اشتراكات شهر ${iso(t.month)} — تُسدَّد خلال 15 يوماً بعده` : `Contributions for ${t.month} — paid within 15 days after it`;
    return "";
  };
  const dueChip = (t) => {
    if (t.done) return <span style={chip("ok")}>{ar ? `نُفِّذ ${iso(t.doneAt || "")}` : `Done ${t.doneAt || ""}`}</span>;
    if (t.overdue) return <span style={chip("bad")}>{ar ? `فات موعده بـ${daysAr(t.left)}` : `${Math.abs(t.left)} days late`}</span>;
    if (t.left === 0) return <span style={chip("warn")}>{ar ? "اليوم" : "Today"}</span>;
    return <span style={chip(t.soon ? "warn" : "mute")}>{ar ? `باقي ${daysAr(t.left)} · ${iso(t.due)}` : `${t.left} days · ${t.due}`}</span>;
  };
  const record = (t) => {
    const d = draft(t.id);
    const emp = employees.find((e) => e.id === t.employeeId);
    const wage = emp ? contributoryWage(employeeWageSplit(emp.profile || {}, emp), payrollSaudiFlag(emp) !== false) : null;
    recordGosiAction(companyId, { kind: t.kind, employeeId: t.employeeId, injuryDate: t.from, month: t.month, at: d.at, ref: d.ref, by, wage });
    onChanged?.();
  };
  const input = { fontFamily: "inherit", fontSize: 12, height: 34, padding: "0 10px", border: "1px solid var(--nv-line)", borderRadius: 8, background: "var(--nv-card)", color: "var(--nv-ink)", boxSizing: "border-box" };

  return (
    <section data-gosi-followup="1" style={{ ...slab, display: "flex", flexDirection: "column" }}>
      <SectionHead
        title={ar ? "متابعة التأمينات — تُنفَّذ في «تأميناتي أعمال»" : "GOSI follow-up — done in GOSI Business"}
        note={ar
          ? "المنصة غير مربوطة بالتأمينات: تعرف من الملف ما يلزم ومتى، وتحفظ تاريخ التنفيذ ورقمه المرجعي إثباتاً."
          : "The platform is not connected to GOSI: it knows from the file what is due and when, and keeps the date and reference as proof."}
        trailing={(
          <>
            <span style={chip(overdue ? "bad" : "mute")}>{ar ? `${open.length} مطلوب` : `${open.length} due`}{overdue ? (ar ? ` · ${overdue} متأخر` : ` · ${overdue} late`) : ""}</span>
            <button type="button" onClick={() => setShowDone((v) => !v)} style={{ ...chip("mute"), cursor: "pointer", fontFamily: "inherit" }}>
              {showDone ? (ar ? "إخفاء المنفَّذ" : "Hide done") : (ar ? `المنفَّذ (${done.length})` : `Done (${done.length})`)}
            </button>
          </>
        )}
      />
      {list.length === 0 ? (
        <span style={{ padding: "14px 18px", fontSize: 12.5, color: "var(--nv-muted)" }}>{ar ? "لا إجراء مطلوب في التأمينات الآن." : "Nothing is due at GOSI now."}</span>
      ) : list.map((t) => (
        <div key={t.id} data-gosi-task={t.kind} style={{ padding: "11px 18px", borderBottom: "1px solid var(--nv-line2, #EEF2F7)", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={chip(t.kind === "injury" || t.kind === "exclude" ? "warn" : "mute", { fontWeight: 700 })}>{ar ? GOSI_TASK_LABEL[t.kind].ar : GOSI_TASK_LABEL[t.kind].en}</span>
            <strong style={{ fontSize: 13, color: "var(--nv-ink)" }}>{t.kind === "payment" ? (ar ? "المنشأة" : "Establishment") : t.name}</strong>
            <span style={{ marginInlineStart: "auto" }}>{dueChip(t)}</span>
          </div>
          <span style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.7 }}>{detail(t)}</span>
          {t.done ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 11.5, color: "var(--nv-muted)" }}>
              {t.ref ? <span>{ar ? "المرجع:" : "Reference:"} <span dir="ltr">{t.ref}</span></span> : null}
              {t.kind === "injury" ? (
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {ar ? "قرار التأمينات" : "GOSI decision"}
                  <select
                    data-gosi-injury-status="1"
                    value={t.gosiStatus || "pending"}
                    onChange={(e) => { setInjuryGosiStatus(companyId, t.employeeId, t.from, e.target.value, { by }); onChanged?.(); }}
                    style={{ ...input, height: 30 }}
                  >
                    <option value="pending">{ar ? "بانتظار القرار" : "Pending"}</option>
                    <option value="approved">{ar ? "معتمدة" : "Approved"}</option>
                    <option value="rejected">{ar ? "مرفوضة — تتحول إلى مرضية (المادة 117)" : "Rejected — becomes sick leave (Art. 117)"}</option>
                  </select>
                </label>
              ) : null}
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <input type="date" dir="ltr" value={draft(t.id).at} onChange={(e) => setDraft(t.id, { at: e.target.value })} style={input} aria-label={ar ? "تاريخ التنفيذ" : "Done on"} />
              <input value={draft(t.id).ref} onChange={(e) => setDraft(t.id, { ref: e.target.value })} placeholder={ar ? "رقم الطلب أو الإيصال في التأمينات" : "GOSI request or receipt number"} style={{ ...input, flex: "1 1 200px" }} />
              <button type="button" data-gosi-record="1" onClick={() => record(t)} style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 700, height: 34, padding: "0 14px", borderRadius: 8, border: "1px solid #0B3D27", background: "#0B3D27", color: "#fff", cursor: "pointer" }}>
                {ar ? "سجّلته في تأميناتي أعمال" : "Recorded in GOSI"}
              </button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
