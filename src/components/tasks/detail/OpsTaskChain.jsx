import React from "react";
import OpsTaskSection from "@/components/tasks/detail/OpsTaskSection";
import EscalationLadder from "@/components/shared/EscalationLadder";

/**
 * سلسلة الاعتماد والتصعيد — the order's own ladder, read from its branch: who reviews now, who is
 * next if the window burns or the doer escalates after three rejects. Same reading as صوت الموظف.
 */
export default function OpsTaskChain({ ar = true, chain = [], level = 0, settled = false, autoEscalated = false, rejectCount = 0, overview = false, branchName = "", windowInfo = null }) {
  const steps = Array.isArray(chain) ? chain : [];
  const now = Math.min(Math.max(0, Number(level) || 0), Math.max(0, steps.length - 1));
  return (
    <OpsTaskSection
      title={overview
        ? (ar ? `سلسلة المراجعة والتصعيد${branchName ? ` — ${branchName}` : ""}` : `Review and escalation chain${branchName ? ` — ${branchName}` : ""}`)
        : (ar ? "سلسلة المراجعة والتصعيد" : "Review and escalation chain")}
      hint={overview
        ? (ar ? "من يعتمد أوامرك، ومن تصعد إليه إذا احترقت حصة اليوم أو رُفضت ثلاث مرات. هي نفسها سلسلة صوت الموظف — بنفس الأشخاص." : "Who approves your orders and who they climb to if a day's quota burns or after three rejects. The same chain as Employee voice — the same people.")
        : ar
        ? "يعتمد الإنجاز المستوى الحالي. إذا احترقت حصة اليوم دون تقدّم يصعد الأمر تلقائياً للمستوى التالي، وبعد ثلاثة رفض يحق للمنفّذ التصعيد بنفسه."
        : "The current level approves. If the day's quota burns without progress the order climbs on its own; after three rejects the doer may escalate."}
      aside={level > 0 && !settled ? (
        <span data-escalated-pill="1" style={{ display: "inline-flex", alignItems: "center", height: 22, padding: "0 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: "var(--nv-warn-ink)", background: "var(--nv-warn-soft)", border: "1px solid var(--nv-warn-line)", whiteSpace: "nowrap" }}>
          {ar ? `صُعّدت · م${level + 1}${autoEscalated ? " · تلقائي" : ""}` : `Escalated · L${level + 1}${autoEscalated ? " · auto" : ""}`}
        </span>
      ) : null}
    >
      {steps.length === 0 ? (
        <span style={{ fontSize: 12, color: "var(--nv-muted)" }}>{ar ? "لا سلسلة لهذا الفرع بعد — تُضبط من «الموارد البشرية › الهيكل»." : "No chain for this branch yet — set it in the org structure."}</span>
      ) : (
        <div data-task-chain="1">
          <EscalationLadder
            ar={ar}
            dataKey="task"
            window={overview ? null : windowInfo}
            steps={steps.map((step, i) => {
              let state;
              if (overview) state = step.vacant ? "vacant" : i === 0 ? "next" : "later";
              else if (i < now) state = step.vacant ? "vacant" : "passed";
              else if (i === now) state = settled ? "ruled" : "now";
              else if (step.vacant) state = "vacant";
              else state = i === now + 1 && !settled ? "next" : "later";
              const note = overview
                ? (i === 0 ? (ar ? "يعتمد أوامرك أولاً" : "Approves your orders first") : (step.vacant ? undefined : (ar ? "عند التصعيد" : "On escalation")))
                : state === "next"
                  ? (ar ? "يصله إن احترقت حصة اليوم" : "Gets it if today's quota burns")
                  : state === "ruled" ? (ar ? "اعتمده" : "Approved it") : undefined;
              return {
                name: step.vacant ? (ar ? "مقعد شاغر" : "Vacant seat") : (step.name || "—"),
                role: [step.title || step.job || "", step.acting ? (ar ? "بالوكالة" : "acting") : ""].filter(Boolean).join(" · "),
                state,
                note,
              };
            })}
          />
        </div>
      )}
      {rejectCount > 0 && !settled ? (
        <span style={{ fontSize: 11.5, color: "var(--nv-warn-ink)" }}>
          {ar ? `رُفض ${rejectCount} ${rejectCount === 1 ? "مرة" : "مرات"} — ${rejectCount >= 3 ? "يحق للمنفّذ التصعيد الآن." : `بقي ${3 - rejectCount} قبل حق التصعيد.`}` : `Rejected ${rejectCount}× — ${rejectCount >= 3 ? "the doer may escalate now." : `${3 - rejectCount} more before the right to escalate.`}`}
        </span>
      ) : null}
    </OpsTaskSection>
  );
}
