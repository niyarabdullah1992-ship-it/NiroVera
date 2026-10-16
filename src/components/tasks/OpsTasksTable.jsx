import React, { useState } from "react";
import { Building2, Laptop, Star, Sun, Users } from "lucide-react";
import { checkTaskHeatBanGate, dayDiffFromToday, deriveDailyTaskPace, isOpsVisitorTask, taskPaceInput, taskDelegationMeta, taskTransferMeta, workKindLabel, taskModeLabel } from "@/lib/opsDerivations";
import { pointsWord, taskContributions, taskDueChip, taskLastEntry, taskLastSevenDays, taskPointsLine, taskRhythm } from "@/lib/opsCardFacts";
import OpsAssignmentRefChip from "@/components/tasks/OpsAssignmentRefChip";
import OpsDispatchChip from "@/components/tasks/OpsDispatchChip";
import { INK, emptyState } from "@/lib/platformStyles";
import { taskQualityFor } from "@/lib/taskQuality";

/** Work-order cards — same chrome as work proof and visitor proof. */

const WEIGHT_LABEL = {
  1: { ar: "روتيني", en: "Routine" },
  2: { ar: "إدخال/متابعة", en: "Data & follow-up" },
  3: { ar: "تشغيلي", en: "Operational" },
  4: { ar: "فني/صيانة", en: "Technical / maintenance" },
  5: { ar: "حرج/عميل", en: "Critical / client" },
};

function taskStateId(task) {
  const s = task?.status;
  if (s === "completed") return "settled";
  if (s === "blocked" || s === "stopped") return "blocked";
  if (s === "awaiting_approval" || s === "pending_review" || s === "active" || s === "in_progress") return "waiting";
  return "void";
}

function statusVisual(task, ar) {
  const s = task.status;
  if (s === "completed") return { tone: "ok", label: ar ? "مكتملة" : "Completed" };
  if (s === "blocked" || s === "stopped") return { tone: "bad", label: ar ? "متوقفة" : "Blocked" };
  if (s === "awaiting_approval") return { tone: "warn", label: ar ? "بانتظار الاعتماد" : "Awaiting approval" };
  if (s === "pending_review") return { tone: "warn", label: ar ? "قيد المراجعة" : "In review" };
  if (s === "active" || s === "in_progress") return { tone: "warn", label: ar ? "قيد التنفيذ" : "In progress" };
  if (s === "pending" || s === "not_started") return { tone: "neutral", label: ar ? "لم تبدأ" : "Not started" };
  return { tone: "neutral", label: ar ? String(s || "—") : String(s || "—") };
}

function dueVisual(task, ar) {
  if (!task.dueAt || task.status === "completed") {
    return {
      tone: undefined,
      text: task.status === "completed" ? (ar ? "مكتملة" : "Completed") : (task.dueAt ? String(task.dueAt).slice(0, 10) : "—"),
    };
  }
  const d = dayDiffFromToday(task.dueAt);
  if (Number.isNaN(d)) return { tone: undefined, text: String(task.dueAt).slice(0, 10) };
  if (d < 0) {
    const n = Math.abs(d);
    return {
      tone: "bad",
      text: ar ? `متأخرة ${n === 1 ? "يوم" : n === 2 ? "يومان" : `${n} أيام`}` : `${n}d overdue`,
    };
  }
  if (d === 0) return { tone: "warn", text: ar ? "اليوم" : "Today" };
  if (d === 1) return { tone: undefined, text: ar ? "غدًا" : "Tomorrow" };
  return { tone: undefined, text: ar ? (d === 2 ? "يومان" : `${d} أيام`) : `${d} days` };
}

function cardTone(task, due) {
  if (task.status === "completed") return "ok";
  if (due?.tone === "bad" || task.status === "blocked" || task.status === "stopped") return "bad";
  if (task.status === "awaiting_approval" || task.status === "pending_review" || task.status === "active" || task.status === "in_progress") {
    return "warn";
  }
  return "neutral";
}

const MONO = { fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums", direction: "ltr", unicodeBidi: "isolate" };

const PAINT = {
  ok: { dot: "var(--nv-ok-fill)", pill: "var(--nv-ok-soft)", line: "var(--nv-ok-line)", ink: "var(--nv-ok-ink)", bar: "#0F5535" },
  warn: { dot: "#C8A45A", pill: "var(--nv-warn-soft)", line: "var(--nv-warn-line)", ink: "var(--nv-warn-ink)", bar: "#C8A45A" },
  bad: { dot: "var(--nv-bad-fill)", pill: "var(--nv-bad-soft)", line: "var(--nv-bad-line)", ink: "var(--nv-bad-ink)", bar: "var(--nv-bad-fill)" },
  mute: { dot: "#0F5535", pill: "var(--nv-soft)", line: "var(--nv-line)", ink: "var(--nv-ink2)", bar: "#0F5535" },
  neutral: { dot: "#0F5535", pill: "var(--nv-soft)", line: "var(--nv-line)", ink: "var(--nv-ink2)", bar: "#0F5535" },
};

const MODE_ICON = { onsite: Building2, field: Sun, remote: Laptop };

function Chip({ tone = "mute", children, title, data }) {
  const p = PAINT[tone] || PAINT.mute;
  return (
    <span title={title} data-chip={data} style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 22, padding: "0 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: p.pill, color: p.ink, border: `1px solid ${p.line}`, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

const DOT = {
  done: { bg: "#0F5535", border: "#0F5535" },
  partial: { bg: "#C8A45A", border: "#C8A45A" },
  missed: { bg: "transparent", border: "var(--nv-bad-fill)" },
  today: { bg: "transparent", border: "#C8A45A" },
  off: { bg: "var(--nv-line2, #EEF1EF)", border: "var(--nv-line2, #EEF1EF)" },
};
const DOT_LABEL = {
  done: { ar: "أُنجز المطلوب", en: "Met" },
  partial: { ar: "جزء من المطلوب", en: "Partly" },
  missed: { ar: "لم يُسجَّل", en: "Missed" },
  today: { ar: "اليوم — لم يُسجَّل بعد", en: "Today — not yet" },
  off: { ar: "ليس يوم عمل لهذا الأمر", en: "Not a work day" },
};

function SevenDays({ days, ar }) {
  return (
    <span data-seven-days="1" aria-label={ar ? "آخر سبعة أيام" : "Last seven days"} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      {days.map((d) => (
        <span
          key={d.day}
          data-day-state={d.state}
          title={`${d.day.slice(8)}/${d.day.slice(5, 7)} · ${ar ? DOT_LABEL[d.state].ar : DOT_LABEL[d.state].en}${d.logged ? ` · ${d.logged}` : ""}`}
          style={{ width: 10, height: 10, borderRadius: 999, background: DOT[d.state].bg, border: `1.5px solid ${DOT[d.state].border}`, boxSizing: "border-box" }}
        />
      ))}
    </span>
  );
}

function rhythmText(r, ar) {
  if (!r.active) return null;
  if (r.gap === 0) return { tone: "ok", text: ar ? "على الإيقاع" : "On pace" };
  const n = Math.abs(r.gap);
  if (r.gap > 0) return { tone: "ok", text: ar ? `متقدّم بـ${n}` : `${n} ahead` };
  return { tone: n >= Math.max(2, Math.round(r.target * 0.1)) ? "bad" : "warn", text: ar ? `متأخر عن الإيقاع بـ${n}` : `${n} behind pace` };
}

function clockOf(iso) {
  const d = new Date(String(iso || ""));
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const same = (a, b) => a.toDateString() === b.toDateString();
  return { hm, when: same(d, today) ? "today" : same(d, y) ? "yesterday" : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}` };
}

/** The approved task's quality on the one five-level scale — the viewer's own level when he is an assignee. */
function QualityLine({ task, viewerId, ar }) {
  if (task.status !== "completed" && !task.approvedAt) return null;
  const q = taskQualityFor(task, viewerId) || taskQualityFor(task, null);
  if (!q) {
    return <span data-quality-line="none" style={{ fontSize: 11.5, color: "var(--nv-muted)" }}>{ar ? "الجودة: بلا مستوى (اعتُمدت قبل المستويات)" : "Quality: no level (approved before levels)"}</span>;
  }
  const objected = (task.qualityObjections || []).some((o) => String(o.employeeId) === String(viewerId) && !o.decision);
  return (
    <span data-quality-line={q.level} style={{ fontSize: 11.5, color: "var(--nv-ink2)", lineHeight: 1.6 }}>
      {ar ? "الجودة: " : "Quality: "}
      <strong style={{ color: "var(--nv-ink)" }}>{`${q.level} — ${ar ? q.label.ar : q.label.en}`}</strong>
      {q.reason ? <span style={{ color: "var(--nv-muted)" }}>{` · ${q.reason}`}</span> : null}
      {objected ? <span style={{ color: "var(--nv-warn-ink)" }}>{ar ? " · اعتراضك بانتظار البتّ" : " · your objection is pending"}</span> : null}
    </span>
  );
}

function TaskRow({ task, ar, stationName, ownerName, ownerInitials, onOpen, renderActions, justCreated, compact = false, viewerId = null }) {
  const [hover, setHover] = useState(false);
  const weight = Number(task.effortWeight) || 3;
  const weightLabel = ar ? WEIGHT_LABEL[weight]?.ar : WEIGHT_LABEL[weight]?.en;
  const status = statusVisual(task, ar);
  const due = dueVisual(task, ar);
  const tone = cardTone(task, due);
  const paint = PAINT[justCreated ? "ok" : tone] || PAINT.neutral;
  const doneN = Number(task.completedCount) || 0;
  const targetN = Math.max(1, Number(task.targetCount) || 1);
  const pct = Math.min(100, Math.round((doneN / targetN) * 100));
  const pace = deriveDailyTaskPace(taskPaceInput(task));
  const owner = ownerName(task);
  const station = stationName(task.stationId);
  const hasTransfer = !!taskTransferMeta(task);
  const hasDelegation = !!taskDelegationMeta(task);
  const escalated = (Number(task.escalationLevel) || 0) > 0 && task.status !== "completed";
  const dueChip = taskDueChip(task, ar);
  const rhythm = taskRhythm(task);
  const rhythmLine = rhythmText(rhythm, ar);
  const seven = task.status === "completed" ? [] : taskLastSevenDays(task);
  const showSeven = seven.some((d) => d.state !== "off");
  const last = taskLastEntry(task);
  const team = Array.isArray(task.memberIds) && task.memberIds.filter(Boolean).length > 1;
  const shares = team ? taskContributions(task) : [];
  const pts = taskPointsLine(task);
  const ModeIcon = MODE_ICON[task.mode] || null;
  const heat = task.status !== "completed" ? checkTaskHeatBanGate(task, { now: new Date() }) : { ok: true };
  const actions = typeof renderActions === "function" ? renderActions(task) : null;
  const todayAsk = pace.active && pace.todayExpected > 0 && task.status !== "completed" && task.status !== "awaiting_approval" ? pace.todayExpected : 0;

  const frame = {
    role: "button",
    tabIndex: 0,
    "data-nv-task-state": taskStateId(task),
    "data-task-card": task.ref || task.id,
    "data-density": compact ? "compact" : "full",
    onClick: () => onOpen?.(task),
    onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen?.(task); } },
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
  };
  const box = {
    textAlign: "start",
    background: justCreated ? "var(--nv-g1)" : "var(--nv-card)",
    border: `1px solid ${hover ? "#0B3D27" : "var(--nv-line)"}`,
    borderRadius: 12,
    boxShadow: hover ? "0 10px 24px var(--nv-shadow)" : "var(--nv-paper)",
    cursor: "pointer",
    minWidth: 0,
  };
  const markEl = (
    <span aria-hidden style={{ width: compact ? 30 : 38, height: compact ? 30 : 38, borderRadius: 9, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--nv-ok-soft)", color: "var(--nv-ok-ink)", fontSize: compact ? 11.5 : 13, fontWeight: 700 }}>
      {ownerInitials(owner)}
    </span>
  );
  const bar = (h = 6) => (
    <span aria-hidden data-pace-bar="1" style={{ position: "relative", display: "block", height: h, borderRadius: 999, background: "var(--nv-line2, #EEF1EF)", overflow: "visible" }}>
      <span style={{ position: "absolute", insetInlineStart: 0, top: 0, bottom: 0, width: `${pct}%`, borderRadius: 999, background: rhythmLine?.tone === "bad" ? PAINT.bad.bar : paint.bar }} />
      {rhythm.active && rhythm.markPct > 0 && rhythm.markPct < 100 ? (
        <span data-pace-mark={rhythm.expected} title={ar ? `المفروض حتى اليوم ${rhythm.expected}` : `Expected by today ${rhythm.expected}`} style={{ position: "absolute", insetInlineStart: `calc(${rhythm.markPct}% - 1px)`, top: -3, bottom: -3, width: 2, borderRadius: 2, background: "var(--nv-ink)" }} />
      ) : null}
    </span>
  );

  if (compact) {
    return (
      <article {...frame} style={{ ...box, display: "grid", gridTemplateColumns: "auto minmax(0, 1.6fr) minmax(0, 1fr) auto", alignItems: "center", gap: 12, padding: "9px 14px" }} className="nv-task-compact">
        {markEl}
        <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
            <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: paint.dot, flexShrink: 0 }} />
            <strong style={{ fontSize: 13.5, color: "var(--nv-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{task.title}</strong>
          </span>
          <span style={{ fontSize: 11.5, color: "var(--nv-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{owner} · {station}</span>
        </span>
        <span style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
            <span style={{ ...MONO, fontWeight: 700, color: "var(--nv-ink)" }}>{doneN}/{targetN}</span>
            {dueChip ? <span style={{ fontWeight: 700, color: (PAINT[dueChip.tone] || PAINT.mute).ink }}>{dueChip.text}</span> : null}
          </span>
          {bar(5)}
        </span>
        <span onClick={(e) => e.stopPropagation()}>{actions}</span>
      </article>
    );
  }

  return (
    <article {...frame} style={{ ...box, display: "flex", flexDirection: "column", gap: 12, padding: "14px 16px 12px" }}>
      <header style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
        {markEl}
        <span style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span aria-hidden data-state-dot="1" style={{ width: 8, height: 8, borderRadius: 999, background: paint.dot, flexShrink: 0 }} />
            <h3 style={{ margin: 0, fontFamily: "var(--font-heading)", fontSize: 16, fontWeight: 700, lineHeight: 1.35, color: "var(--nv-ink)" }}>{task.title || "—"}</h3>
            {justCreated ? <Chip tone="ok">{ar ? "أُنشئت الآن" : "Just created"}</Chip> : null}
          </span>
          <span data-owner-line="1" style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.6 }}>
            {owner}<span style={{ color: "var(--nv-muted)" }}>{` · ${station}`}</span>
          </span>
        </span>
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
          <Chip tone={tone === "neutral" ? "mute" : tone}>{status.label}</Chip>
          {dueChip ? <Chip tone={dueChip.tone} data="due">{dueChip.text}</Chip> : null}
        </span>
      </header>

      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {task.ref ? <span style={{ ...MONO, fontSize: 11, color: "var(--nv-muted)", marginInlineEnd: 2 }}>{task.ref}</span> : null}
        {ModeIcon ? (
          <Chip tone="mute" data="mode"><ModeIcon size={12} strokeWidth={2} aria-hidden />{taskModeLabel(task.mode, ar ? "ar" : "en")}</Chip>
        ) : null}
        <Chip tone="mute">{workKindLabel(task.workKind, ar ? "ar" : "en")}</Chip>
        <Chip tone="mute">{`×${weight} ${weightLabel || ""}`.trim()}</Chip>
        {escalated ? <Chip tone="bad">{ar ? `صُعّد · م${Number(task.escalationLevel) + 1}` : `Escalated · L${Number(task.escalationLevel) + 1}`}</Chip> : null}
        {!heat.ok ? (
          <Chip tone="bad" data="heat" title={ar ? heat.reason : heat.reasonEn}>
            <Sun size={12} strokeWidth={2} aria-hidden />
            {ar ? `حظر الشمس الآن — سجّل بعد ${heat.window?.endLabel || ""}` : `Sun ban now — log after ${heat.window?.endLabel || ""}`}
          </Chip>
        ) : null}
        {hasTransfer ? <OpsAssignmentRefChip task={task} ar={ar} kind="transfer" compact /> : null}
        {hasDelegation ? <OpsAssignmentRefChip task={task} ar={ar} kind="delegation" compact /> : null}
        {isOpsVisitorTask(task) ? <OpsDispatchChip homeName={stationName(task.homeStationId)} ar={ar} /> : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ ...MONO, fontSize: 14, fontWeight: 700, color: "var(--nv-ink)" }}>{doneN}/{targetN}</span>
          <span style={{ ...MONO, fontSize: 12, color: "var(--nv-muted)" }}>{pct}%</span>
          {rhythmLine ? <span data-rhythm={rhythmLine.tone} style={{ fontSize: 12, fontWeight: 700, color: (PAINT[rhythmLine.tone] || PAINT.mute).ink }}>{rhythmLine.text}</span> : null}
          {todayAsk ? <span style={{ fontSize: 12, color: "var(--nv-ink2)" }}>{ar ? `مطلوب اليوم ${todayAsk}` : `${todayAsk} due today`}</span> : null}
          {showSeven ? <span style={{ marginInlineStart: "auto" }}><SevenDays days={seven} ar={ar} /></span> : null}
        </div>
        {bar(6)}
      </div>

      {team ? (
        <div data-team-shares="1" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 11.5, color: "var(--nv-ink2)" }}>
          <Users size={14} color="var(--nv-muted)" strokeWidth={1.75} aria-hidden />
          <span style={{ fontWeight: 700 }}>{ar ? `الفريق ${task.memberIds.filter(Boolean).length}` : `Team ${task.memberIds.filter(Boolean).length}`}</span>
          {shares.length
            ? shares.slice(0, 4).map((x) => (
              <span key={x.name} style={{ background: "var(--nv-soft)", border: "1px solid var(--nv-line2, #EEF1EF)", borderRadius: 999, padding: "1px 8px" }}>
                {x.name} <span style={MONO}>{x.amount}</span>
              </span>
            ))
            : <span style={{ color: "var(--nv-muted)" }}>{ar ? "لم يسجّل أحد منهم بعد" : "Nobody has logged yet"}</span>}
        </div>
      ) : null}

      {last ? (
        <div data-last-entry="1" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: "var(--nv-soft)", border: "1px solid var(--nv-line2, #EEF1EF)" }}>
          {last.image ? <img src={last.image} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} /> : null}
          <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
            <span style={{ fontSize: 11.5, color: "var(--nv-ink2)" }}>
              {(() => {
                const c = clockOf(last.at);
                const when = c ? (c.when === "today" ? (ar ? "اليوم" : "today") : c.when === "yesterday" ? (ar ? "أمس" : "yesterday") : c.when) : "";
                return ar
                  ? <>آخر إدخال {when} <span style={MONO}>{c?.hm || ""}</span>{last.by ? ` — ${last.by}` : ""}{last.amount ? ` · +${last.amount}` : ""}</>
                  : <>Last entry {when} <span style={MONO}>{c?.hm || ""}</span>{last.by ? ` — ${last.by}` : ""}{last.amount ? ` · +${last.amount}` : ""}</>;
              })()}
            </span>
            {last.note ? <span style={{ fontSize: 11, color: "var(--nv-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{last.note}</span> : null}
          </span>
        </div>
      ) : null}

      <QualityLine task={task} viewerId={viewerId} ar={ar} />

      <footer style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", paddingTop: 10, borderTop: "1px solid var(--nv-line2, #EEF2F7)" }}>
        <span data-points="1" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: pts.granted ? "var(--nv-ok-ink)" : "#8A5A12" }}>
          <Star size={13} strokeWidth={2} aria-hidden />
          {pts.granted
            ? (ar ? `حصل على ${pointsWord(pts.points)}` : `${pointsWord(pts.points, false)} earned`)
            : (ar ? `${pointsWord(pts.points)} عند الاعتماد` : `${pointsWord(pts.points, false)} on approval`)}
        </span>
        <span onClick={(e) => e.stopPropagation()} style={{ marginInlineStart: "auto" }}>{actions}</span>
      </footer>
    </article>
  );
}

export function OpsTaskCards({
  tasks = [],
  lang = "ar",
  stationName,
  ownerName,
  ownerInitials,
  onOpen,
  renderActions,
  createdIds,
  compact = false,
  viewerId = null,
}) {
  const ar = lang === "ar";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 6 : 10 }}>
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          ar={ar}
          stationName={stationName}
          ownerName={ownerName}
          ownerInitials={ownerInitials}
          onOpen={onOpen}
          renderActions={renderActions}
          viewerId={viewerId}
          justCreated={createdIds?.includes(task.id)}
          compact={compact}
        />
      ))}
    </div>
  );
}

export default function OpsTasksTable({
  tasks = [],
  lang = "ar",
  loading = false,
  stationName,
  ownerName,
  ownerInitials,
  onOpen,
  serviceDown = false,
  renderActions,
  createdIds,
  compact = false,
  viewerId = null,
}) {
  const ar = lang === "ar";

  if (loading) {
    return (
      <div style={{ ...emptyState, lineHeight: 1.9 }}>
        {ar ? "جاري التحميل…" : "Loading…"}
      </div>
    );
  }

  if (!tasks.length) {
    return (
      <div style={{ ...emptyState, lineHeight: 1.9 }}>
        <div style={{ fontWeight: 600, color: INK }}>
          {serviceDown
            ? (ar ? "القائمة غير محمَّلة" : "List not loaded")
            : (ar ? "لا مهام مطابقة" : "No matching tasks")}
        </div>
        {serviceDown
          ? (ar
            ? "لم تستجب خدمة العمليات — لا يمكن تأكيد وجود مهام أو عدمها في هذا النطاق."
            : "The operations service did not respond — whether tasks exist in this scope cannot be confirmed.")
          : (ar
            ? "لا مهام تطابق هذه التصفية في النطاق الحالي."
            : "No tasks match this filter in the current scope.")}
      </div>
    );
  }

  return (
    <OpsTaskCards
      tasks={tasks}
      lang={lang}
      stationName={stationName}
      ownerName={ownerName}
      ownerInitials={ownerInitials}
      onOpen={onOpen}
      renderActions={renderActions}
      createdIds={createdIds}
      compact={compact}
      viewerId={viewerId}
    />
  );
}
