import React, { useState } from "react";
import OpsTaskSection from "@/components/tasks/detail/OpsTaskSection";
import MemberMultiSelect from "@/components/tasks/MemberMultiSelect";
import { MUTED } from "@/lib/platformStyles";
import { deriveDailyTaskPace, taskPaceInput, taskRecurrenceLabel, isOpsVisitorTask, taskCreatorName, taskAssigneePeople, normalizeTaskMode, deriveTaskHeatBanNotice, TASK_MODES } from "@/lib/opsDerivations";
import OpsDispatchChip from "@/components/tasks/OpsDispatchChip";
import HeatBanNotice from "@/components/shared/HeatBanNotice";
import OpsMoreMenu from "@/components/tasks/OpsMoreMenu";
import { printSheet } from "@/lib/printSheet";
import { taskWorkOrderSheet } from "@/lib/printRecords";
import { DetailHero, Fact, FactGrid, HeroBar, HeroFigure, HeroPill, HeroSevenDays } from "@/components/tasks/detail/DetailKit";
import { pointsWord, taskDueChip, taskLastSevenDays, taskPointsLine, taskRhythm } from "@/lib/opsCardFacts";

const PRIORITIES = [
  { id: "high", ar: "عالية", en: "High", ink: "var(--nv-bad-ink)", soft: "var(--nv-bad-soft)", line: "var(--nv-bad-line)", dot: "var(--nv-bad-fill)" },
  { id: "medium", ar: "متوسطة", en: "Medium", ink: "var(--nv-warn-ink)", soft: "var(--nv-warn-soft)", line: "var(--nv-warn-line)", dot: "var(--nv-warn-fill)" },
  { id: "low", ar: "منخفضة", en: "Low", ink: "var(--nv-mute-ink, #4B5567)", soft: "var(--nv-mute-soft, #F5F6F8)", line: "var(--nv-line)", dot: "var(--nv-mute-fill, #C7CCD6)" },
];

const WEIGHTS = [
  { w: 1, ar: "روتيني", en: "Routine" },
  { w: 2, ar: "إدخال/متابعة", en: "Data & follow-up" },
  { w: 3, ar: "تشغيلي", en: "Operational" },
  { w: 4, ar: "فني/صيانة", en: "Technical / maintenance" },
  { w: 5, ar: "حرج/عميل", en: "Critical / client" },
];

/** Assignment, work profile, and schedule — same section language as the create card. */
export default function OpsTaskHeader({
  task, ar, busy, approved, awaiting, doneN, targetN,
  canReassign, canTransfer, canEndDelegation, canManage, canDelete,
  onOpenReassign, onOpenTransfer, onEndDelegation, onSetMode, onOpenDelete,
  canEditAssignees = false,
  stationMembers = [],
  onSetMembers,
  paceStrip = null,
  employees = [],
}) {
  const recLabel = taskRecurrenceLabel(task.recurrence, ar);
  const pct = Math.min(100, Math.round((doneN / targetN) * 100));
  const pri = String(task.priority || "medium");
  const weight = Number(task.effortWeight) || 1;
  const mode = normalizeTaskMode(task.mode);
  const canSwitchMode = canManage && !approved && !awaiting && !!onSetMode;
  const showDelete = canDelete && !approved && !awaiting;
  const workType = String(task.workTypeText || task.workType || "").trim();
  const assignees = taskAssigneePeople(task, employees);
  const [showPeople, setShowPeople] = useState(false);
  const peopleNames = assignees.map((person) => String(person.name || "").trim()).filter(Boolean).join(ar ? "، " : ", ");
  const branchName = String(task.stationName || "").trim();
  const ownerFace = String(task.ownerName || task.assigneeName || "").trim() || peopleNames || branchName || "—";
  const canEditPeople = canEditAssignees && !approved && !awaiting && typeof onSetMembers === "function";
  const selectedIds = assignees.map((p) => String(p.id));

  const rhythm = taskRhythm(task);
  const seven = approved ? [] : taskLastSevenDays(task);
  const dueChip = taskDueChip(task, ar);
  const pace = deriveDailyTaskPace(taskPaceInput(task));
  const pts = taskPointsLine(task);
  const statusPill = approved
    ? { tone: "ok", text: ar ? "مكتملة" : "Completed" }
    : awaiting
      ? { tone: "warn", text: ar ? "بانتظار الاعتماد" : "Awaiting approval" }
      : { tone: "warn", text: ar ? "قيد التنفيذ" : "In progress", live: true };
  const rhythmLine = !rhythm.active
    ? null
    : rhythm.gap === 0
      ? { tone: "ok", text: ar ? "على الإيقاع" : "On pace" }
      : rhythm.gap > 0
        ? { tone: "ok", text: ar ? `متقدّم بـ${rhythm.gap} عن الإيقاع` : `${rhythm.gap} ahead of pace` }
        : { tone: Math.abs(rhythm.gap) >= Math.max(2, Math.round(rhythm.target * 0.1)) ? "bad" : "warn", text: ar ? `متأخر عن الإيقاع بـ${Math.abs(rhythm.gap)} — المفروض ${rhythm.expected} حتى اليوم` : `${Math.abs(rhythm.gap)} behind — ${rhythm.expected} expected by today` };
  const printOrder = () => printSheet(taskWorkOrderSheet({
    task,
    ar,
    doneN,
    targetN,
    status: { label: statusPill.text, tone: statusPill.tone },
    owner: ownerFace,
    branch: branchName,
    doers: peopleNames,
    creator: task.createdByName || taskCreatorName(task),
    recurrence: recLabel,
    priority: ar ? (PRIORITIES.find((p) => p.id === pri) || PRIORITIES[1]).ar : (PRIORITIES.find((p) => p.id === pri) || PRIORITIES[1]).en,
    points: pointsWord(pts.points, ar),
  }));
  const menuItems = [
    { key: "print", label: ar ? "طباعة أمر العمل" : "Print the work order", hint: ar ? "ورقة A4 بالسجل والتوقيعات" : "A4 sheet with log and signatures", onClick: printOrder },
    canReassign || canTransfer || canEndDelegation ? { divider: true } : null,
    canReassign ? { key: "delegate", label: ar ? "توكيل منفّذ آخر" : "Delegate", hint: ar ? "داخل الفرع نفسه" : "Within the branch", onClick: () => onOpenReassign?.(), disabled: busy } : null,
    canTransfer ? { key: "transfer", label: ar ? "نقل إلى فرع آخر" : "Transfer to another branch", onClick: () => onOpenTransfer?.(), disabled: busy } : null,
    canEndDelegation ? { key: "end-delegation", label: ar ? "إنهاء التوكيل" : "End delegation", onClick: () => onEndDelegation?.(), disabled: busy } : null,
    showDelete ? { divider: true } : null,
    showDelete ? { key: "delete", label: ar ? "حذف الأمر" : "Delete the order", danger: true, onClick: () => onOpenDelete?.(), disabled: busy } : null,
  ];
  const dmy = (v) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ""));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
  };
  const remaining = Math.max(0, targetN - doneN);
  const PRI = PRIORITIES.find((p) => p.id === pri) || PRIORITIES[1];
  const W = WEIGHTS.find((w) => w.w === weight) || WEIGHTS[2];

  return (
    <>
      <DetailHero
        kind={ar ? "أمر عمل" : "Work order"}
        pills={(
          <>
            <HeroPill tone={statusPill.tone} live={statusPill.live} data="status">{statusPill.text}</HeroPill>
            {dueChip ? <HeroPill tone={dueChip.tone === "mute" ? "mute" : dueChip.tone} data="due">{dueChip.text}</HeroPill> : null}
          </>
        )}
        menu={menuItems.some((x) => x && !x.divider) ? <OpsMoreMenu ar={ar} items={menuItems} placement="down" dark /> : null}
        figure={(
          <HeroFigure
            value={`${doneN}/${targetN}`}
            unit={ar ? `منجز · ${pct}%` : `done · ${pct}%`}
            line={rhythmLine?.text || (approved ? (ar ? "اعتُمد الإنجاز" : "Completion approved") : awaiting ? (ar ? "اكتمل العدد — بانتظار اعتماد المشرف" : "Count reached — waiting for approval") : "")}
            lineTone={rhythmLine?.tone}
          />
        )}
        aside={seven.some((d) => d.state !== "off") ? <HeroSevenDays days={seven} ar={ar} /> : null}
        facts={[
          !approved && !awaiting && pace.active ? { label: ar ? "المطلوب اليوم" : "Due today", value: pace.todayExpected, mono: true, tone: "gold" } : null,
          !approved ? { label: ar ? "المتبقي" : "Left", value: remaining, mono: true } : null,
          !approved && !awaiting && pace.active ? { label: ar ? "الأيام المتبقية" : "Days left", value: pace.daysLeft, mono: true } : null,
          { label: ar ? "الاستحقاق" : "Due", value: dmy(task.dueAt), mono: true, tone: dueChip?.tone === "bad" ? "bad" : undefined },
          { label: pts.granted ? (ar ? "النقاط الممنوحة" : "Points earned") : (ar ? "النقاط عند الاعتماد" : "Points on approval"), value: pointsWord(pts.points, ar), tone: "gold" },
        ]}
      >
        <HeroBar pct={pct} markPct={rhythm.active ? rhythm.markPct : 0} markTitle={ar ? `المفروض حتى اليوم ${rhythm.expected}` : `Expected by today ${rhythm.expected}`} tone={rhythmLine?.tone === "bad" ? "bad" : approved ? "ok" : "gold"} />
      </DetailHero>

      <OpsTaskSection title={ar ? "الإسناد" : "Assignment"}>
        <FactGrid>
          <Fact label={ar ? "المسؤول" : "Owner"}>{ownerFace}</Fact>
          <Fact label={ar ? "الفرع" : "Branch"}>{branchName || task.stationId || "—"}</Fact>
          {task.createdByName || taskCreatorName(task) ? <Fact label={ar ? "أنشأها" : "Created by"}>{task.createdByName || taskCreatorName(task)}</Fact> : null}
          {isOpsVisitorTask(task) ? <Fact label={ar ? "الفرع الأم" : "Home branch"}><OpsDispatchChip homeName={task.homeStationName} ar={ar} /></Fact> : null}
        </FactGrid>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--nv-ink2)" }}>{ar ? `المنفّذون · ${assignees.length || 0}` : `Doers · ${assignees.length || 0}`}</span>
            {canEditPeople ? (
              <button type="button" data-edit-people="1" onClick={() => setShowPeople((v) => !v)} style={{ marginInlineStart: "auto", fontFamily: "inherit", fontSize: 12, fontWeight: 600, border: "none", background: "transparent", color: "#0F5535", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>
                {showPeople ? (ar ? "تم" : "Done") : (ar ? "عدّل المنفّذين" : "Edit doers")}
              </button>
            ) : null}
          </div>
          {canEditPeople && showPeople ? (
            <MemberMultiSelect
              members={stationMembers}
              selected={selectedIds}
              onChange={(ids) => { if (!busy) onSetMembers?.(ids); }}
              lang={ar ? "ar" : "en"}
              emptyLabel={ar ? "لا يوجد أعضاء في هذا الفرع." : "No members in this station."}
            />
          ) : (
            <div data-doers="1" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {assignees.length ? assignees.map((person) => (
                <span key={person.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 10px 4px 4px", borderRadius: 999, background: "var(--nv-soft)", border: "1px solid var(--nv-line2, #EEF1EF)", fontSize: 12.5, fontWeight: 600, color: "var(--nv-ink)" }}>
                  <span aria-hidden style={{ width: 24, height: 24, borderRadius: 999, background: "var(--nv-ok-soft)", color: "var(--nv-ok-ink)", fontSize: 10.5, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    {String(person.name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("")}
                  </span>
                  {person.name}
                </span>
              )) : <span style={{ fontSize: 12, color: MUTED }}>{branchName ? (ar ? `فريق ${branchName}` : `${branchName} team`) : "—"}</span>}
            </div>
          )}
        </div>
      </OpsTaskSection>

      <OpsTaskSection title={ar ? "طبيعة العمل" : "Work profile"}>
        <FactGrid min={140}>
          <Fact label={ar ? "الأولوية" : "Priority"}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: PRI.ink }}>
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: PRI.dot }} />
              {ar ? PRI.ar : PRI.en}
            </span>
          </Fact>
          <Fact label={ar ? "وزن الجهد" : "Effort"}><span><span dir="ltr">×{W.w}</span> {ar ? W.ar : W.en}</span></Fact>
          {workType ? <Fact label={ar ? "نوع العمل" : "Work type"}>{workType}</Fact> : null}
          <Fact label={ar ? "البدء" : "Start"} ltr>{dmy(task.startAt || task.createdAt)}</Fact>
        </FactGrid>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--nv-ink2)" }}>{ar ? "مكان التنفيذ" : "Where the work happens"}</span>
          <div role="radiogroup" data-mode-switch="1" style={{ display: "flex", gap: 4, padding: 4, borderRadius: 11, background: "var(--nv-soft)", border: "1px solid var(--nv-line2, #EEF1EF)" }}>
            {TASK_MODES.map((m) => {
              const on = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={!canSwitchMode || busy}
                  onClick={() => canSwitchMode && !on && onSetMode(m.id)}
                  style={{ flex: 1, height: 34, borderRadius: 8, border: "none", fontFamily: "inherit", fontSize: 12.5, fontWeight: on ? 700 : 500, background: on ? "#0B3D27" : "transparent", color: on ? "#fff" : "var(--nv-ink2)", cursor: canSwitchMode && !on ? "pointer" : "default", boxShadow: on ? "0 2px 6px rgba(6,61,38,.2)" : "none" }}
                >
                  {ar ? m.ar : m.en}
                </button>
              );
            })}
          </div>
          <HeatBanNotice notice={deriveTaskHeatBanNotice({ ...task, mode })} ar={ar} />
        </div>
        {recLabel ? (
          <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>{recLabel}</div>
        ) : null}
      </OpsTaskSection>


    </>
  );
}
