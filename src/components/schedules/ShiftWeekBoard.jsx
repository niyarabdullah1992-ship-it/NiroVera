import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/PowerCareAuth";
import {
  addShiftType,
  publishWeek,
  removeShiftType,
  setEmployeeDayShift,
  setScheduleNightCompensation,
  decideNightRemedy,
  withdrawNightRemedy,
  setNightFacilityFlag,
  setWeekValidity,
  submitOtherRequest,
  openDueNightRotateCycles,
  updateShiftType,
} from "@/lib/store";
import { nextDistinctShift, repairedShiftWindow, STANDARD_SHIFT_WINDOWS, shiftHoursLine, shiftWindowKey } from "@/lib/shiftDerivations";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import {
  buildHistory,
  checkShiftChangeApplyGate,
  checkWeekPublishGates,
  cycleShiftId,
  employeeNeedsNightRotateChoice,
  ordinaryShiftId,
  weekNightDateKeys,
  employeeShiftOnDay,
  employeeWeekHours,
  formatWeekLabel,
  LEAVE_STYLE,
  leaveOnDayView,
  REST_STYLE,
  shiftHours,
  shiftTypeStyle,
  SW,
  weekValidityNote,
  weekValidityOptions,
  weekDateKeys,
  weekDays,
  weekKeyFromDate,
  weekPublishState,
  weekRelativeLabel,
  weekRosterEmployees,
  rosterBranchPhrase,
  weekStartDate,
  weekdayLabel,
  weekPublishSubmitBlock,
  weekCellAlert,
  weekCellAlertTone,
  activeNightRemedy,
  nightAllowancePayLabel,
  nightCutHoursLabel,
  withdrawableNightRemedyEmployees,
} from "@/lib/shiftWeek";
import { checkSubmitOtherRequestGate } from "@/lib/otherRequestDerivations";
import { calendarDateKey } from "@/lib/attendanceCalendar";
import { toast } from "@/components/ui/use-toast";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import StatutoryItem from "@/components/labor/StatutoryItem";
import LaborCalendarCard from "@/components/hr/LaborCalendarCard";
import { NIGHT_FACILITY_FLAGS } from "@/lib/decision18632";
import { rosterNightRowMark, showStatutoryHeaderCite, statutoryGlowState } from "@/lib/statutoryItem";
import { isRamadanDay, ruleValue } from "@/lib/laborRules";
import { laborCalendarOf } from "@/lib/ummAlQuraCalendar";
import { isViewerOwnFile } from "@/lib/employeeFileView";
import FileHoursAlertsRail from "@/components/employees/FileHoursAlertsRail";
import ManagerDutyAlertsRail from "@/components/employees/ManagerDutyAlertsRail";
import NightMedicalFileField from "@/components/employees/NightMedicalFileField";
import { FileSelfBadge } from "@/components/employees/ProfileHero";
import PlatformDateField from "@/components/shared/PlatformDateField";

const HEADING = "var(--font-heading)";
const LINK = { color: SW.ink, fontWeight: 600, textDecoration: "none" };
const mono = { fontFamily: "'IBM Plex Mono', monospace" };
const slab = { background: SW.card, border: `1px solid ${SW.line}` };

const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function KickerLine({ kicker }) {
  const parts = String(kicker || "").split("·").map((part) => part.trim()).filter(Boolean);
  return (
    <span style={{ fontSize: 11, letterSpacing: ".14em", color: SW.muted, display: "flex", gap: 7, alignItems: "center" }}>
      {parts[0] ? <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{parts[0]}</span> : null}
      {parts[1] ? <span>·</span> : null}
      <span>{parts.slice(1).join(" · ") || (!parts[0] ? kicker : "")}</span>
    </span>
  );
}

function countAr(n, one, two, few, many) {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}

function chipBtn(on) {
  return {
    fontFamily: "inherit",
    fontSize: 11,
    padding: "6px 11px",
    border: `1px solid ${on ? SW.ink : SW.line}`,
    background: on ? SW.ink : SW.card,
    color: on ? "#fff" : SW.mid,
    fontWeight: on ? 600 : 400,
    cursor: "pointer",
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
  };
}

function fieldStyle() {
  return {
    ...mono,
    fontSize: 11,
    padding: "5px 8px",
    border: `1px solid ${SW.line}`,
    background: SW.card,
    color: SW.ink,
    outline: "none",
    borderRadius: 10,
  };
}

export default function ShiftWeekBoard({
  schedule,
  employees = [],
  stationId,
  stationName = "",
  companyId,
  currentUser,
  canEdit = false,
  mode = "manage",
  lang = "ar",
  kicker,
  pageTitle,
  gridTitle,
  gridLead,
}) {
  const ar = lang === "ar";
  const { refresh, data } = useAuth();
  const laborCalendar = laborCalendarOf(data);
  const station = (data?.stations || []).find((row) => String(row.id) === String(stationId));
  const [weekStart, setWeekStart] = useState(() => weekStartDate(new Date()));
  const [brush, setBrush] = useState(null);
  const [histFrom, setHistFrom] = useState(() => calendarDateKey(new Date(Date.now() - 18 * 86400000)));
  const [histTo, setHistTo] = useState(() => calendarDateKey(new Date()));
  const [histMode, setHistMode] = useState("emp");
  const [histQuery, setHistQuery] = useState("");
  const [reqOpen, setReqOpen] = useState(false);
  const [reqForm, setReqForm] = useState({ date: calendarDateKey(new Date()), shiftTypeId: "", reason: "" });

  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const weekKeys = useMemo(() => days.map((day) => day.key), [days]);
  const [draft, setDraft] = useState({});
  const roster = useMemo(() => {
    const rows = weekRosterEmployees(schedule, employees, stationId, weekKeys, { homeOnly: mode === "mine" });
    if (mode !== "mine" || !currentUser?.id) return rows;
    const self = rows.find((row) => row.id === currentUser.id);
    if (self) return [self, ...rows.filter((row) => row.id !== currentUser.id)];
    const fallback = employees.find((row) => row.id === currentUser.id) || currentUser;
    return fallback ? [fallback, ...rows] : rows;
  }, [schedule, employees, stationId, weekKeys, mode, currentUser]);
  const types = schedule?.shiftTypes || [];

  useEffect(() => {
    if (!canEdit || !companyId || !stationId) return;
    let changed = false;
    types.forEach((shift) => {
      const repaired = repairedShiftWindow(shift);
      if (repaired) {
        updateShiftType(companyId, stationId, shift.id, repaired);
        changed = true;
      }
    });
    const restoreKey = `nv.shift-windows.restored:${stationId}`;
    const alreadyRestored = typeof localStorage !== "undefined" && localStorage.getItem(restoreKey);
    if (!alreadyRestored) {
      STANDARD_SHIFT_WINDOWS.forEach((slot) => {
        const exists = types.some((shift) => (
          shiftWindowKey(shift.start, shift.end) === shiftWindowKey(slot.start, slot.end)
          || shift.label === slot.ar
          || shift.label === slot.en
        ));
        if (exists) return;
        addShiftType(companyId, stationId, {
          label: ar ? slot.ar : slot.en,
          start: slot.start,
          end: slot.end,
          restMinutes: slot.restMinutes ?? 30,
        });
        changed = true;
      });
      try { localStorage.setItem(restoreKey, "1"); } catch { /* ignore */ }
    }
    if (changed) refresh?.();
  }, [canEdit, companyId, stationId]);

  useEffect(() => {
    if (!companyId) return;
    const result = openDueNightRotateCycles(companyId);
    if (result.opened?.length) refresh?.();
  }, [companyId]);

  useEffect(() => {
    setDraft((prev) => {
      const keys = Object.keys(prev);
      if (!keys.length) return prev;
      const next = { ...prev };
      let dirty = false;
      for (const key of keys) {
        const split = key.indexOf(":");
        const empId = key.slice(0, split);
        const dateKey = key.slice(split + 1);
        const liveId = employeeShiftOnDay(schedule, empId, dateKey)?.id || null;
        if (liveId === (next[key] || null)) {
          delete next[key];
          dirty = true;
        }
      }
      return dirty ? next : prev;
    });
  }, [schedule]);

  const gates = useMemo(
    () => checkWeekPublishGates({
      schedule,
      employees,
      weekStart,
      stationId,
      station,
      settings: data?.settings,
      company: data,
      ar,
      laborCalendar,
    }),
    [schedule, employees, weekStart, stationId, station, data, ar, laborCalendar],
  );
  const pub = weekPublishState(schedule, weekStart);
  const history = useMemo(
    () => buildHistory({ schedule, employees, stationId, fromKey: histFrom, toKey: histTo, query: histQuery, mode: histMode, ar }),
    [schedule, employees, stationId, histFrom, histTo, histQuery, histMode, ar],
  );

  const published = pub.kind === "published" || pub.kind === "implicit";
  const blockers = gates.blockers.length;
  const publishLabel = published && pub.kind === "published"
    ? (ar ? "منشور — التقويم يقرأ منه" : "Published — calendar reads this")
    : blockers
      ? (ar
        ? `${countAr(blockers, "مانع واحد", "مانعان", "موانع", "مانعاً")} قبل النشر`
        : `${blockers} blockers before publish`)
      : pub.kind === "edited"
        ? (ar ? "انشر التعديل" : "Publish the edit")
        : pub.kind === "implicit"
          ? (ar ? "أسبوع ماضٍ — منشور تلقائياً" : "Past week — auto-published")
          : (ar ? "انشر الجدول" : "Publish the roster");
  const publishLocked = !!blockers || pub.kind === "implicit" || (published && pub.kind === "published");
  const publishSubmitBlock = blockers ? weekPublishSubmitBlock(gates, { ar }) : "";
  const thisWeek = weekRelativeLabel(weekStart, new Date(), ar);
  const thisWeekNow = thisWeek === (ar ? "الأسبوع الجاري" : "This week");
  const validityKind = schedule?.validity || "week";

  const countsNote = ar
    ? `${countAr(gates.assigned, "تعيين واحد", "تعيينان", "تعيينات", "تعييناً")} · ${countAr(gates.totalHours, "ساعة واحدة", "ساعتان", "ساعات", "ساعة")} · ${countAr(roster.length, "موظف واحد", "موظفان", "موظفين", "موظفاً")}`
    : `${gates.assigned} assignments · ${gates.totalHours} h · ${roster.length} people`;
  const gridNote = [gridLead, countsNote].filter(Boolean).join(" · ");
  const boardTitle = pageTitle || (ar ? "جدول الدوام" : "Duty roster");
  const nightGlow = statutoryGlowState({
    kind: "18632",
    employees: roster,
    schedule,
    weekStart,
    laborCalendar,
  });
  const assignmentsTitle = gridTitle || (stationName
    ? (ar ? `جدول ${rosterBranchPhrase(stationName, ar)}` : `${stationName} roster`)
    : (ar ? "التعيينات" : "Assignments"));

  const histScope = history.workDays
    ? (ar
      ? `${countAr(history.workDays, "يوم عمل منشور واحد", "يومَا عمل منشوران", "أيام عمل منشورة", "يوم عمل منشور")} بين التاريخين${history.skipped ? ` · ${countAr(history.skipped, "يوم واحد", "يومان", "أيام", "يوماً")} بلا جدول منشور، غير محتسب` : ""}`
      : `${history.workDays} published workdays in range${history.skipped ? ` · ${history.skipped} unpublished, not counted` : ""}`)
    : (history.skipped
      ? (ar
        ? `${countAr(history.skipped, "يوم عمل واحد", "يومَا عمل", "أيام عمل", "يوم عمل")} بلا جدول منشور — لا شيء يُحتسب`
        : `${history.skipped} unpublished workdays — nothing is counted`)
      : (ar ? "لا يوم عمل بين التاريخين" : "No workday in range"));

  const histNote = !history.workDays
    ? (history.skipped
      ? (ar ? "أيام المدى تقع في أسابيع لم تُنشر بعد — انشر الجدول لتدخل الحساب." : "The range sits in unpublished weeks — publish so they count.")
      : (ar ? "وسّع المدى — الجمعة والسبت خارج الجدول." : "Widen the range — Friday and Saturday sit outside the roster."))
    : (histQuery.trim()
      ? (ar ? `مصفّى على «${histQuery.trim()}» · ${history.rows.length} موظف` : `Filtered to “${histQuery.trim()}” · ${history.rows.length} people`)
      : (ar
        ? `الورديات الليلية في المدى: ${history.nightMarks}. الأرقام من النسخة المنشورة وقت كل أسبوع — تعديلات المسودة لا تدخل هنا حتى تُنشر.`
        : `Night marks in range: ${history.nightMarks}. Figures come from the published copy — draft edits stay out until you publish.`));

  const checksBadge = blockers
    ? (ar
      ? `${countAr(blockers, "مانع واحد", "مانعان", "موانع", "مانعاً")} · ${countAr(gates.warnings.length, "تنبيه واحد", "تنبيهان", "تنبيهات", "تنبيهاً")}`
      : `${blockers} blockers · ${gates.warnings.length} warnings`)
    : gates.warnings.length
      ? (ar
        ? `لا موانع · ${countAr(gates.warnings.length, "تنبيه واحد", "تنبيهان", "تنبيهات", "تنبيهاً")}`
        : `No blockers · ${gates.warnings.length} warnings`)
      : (ar ? "كل الفحوص مستوفاة" : "Every check passed");

  const moveWeek = (delta) => setWeekStart((cur) => weekStartDate(new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + delta * 7)));

  const shiftOn = (employee, day) => {
    const key = `${employee.id}:${day.key}`;
    if (Object.prototype.hasOwnProperty.call(draft, key)) {
      const id = draft[key];
      return id ? types.find((row) => row.id === id) || null : null;
    }
    return employeeShiftOnDay(schedule, employee.id, day.key);
  };

  const cycleCell = (employee, day) => {
    if (!canEdit || !companyId || !stationId) return;
    const current = shiftOn(employee, day);
    const nextId = cycleShiftId(types, current?.id || null, brush, {
      onDate: day.key,
      ordinaryOnly: employeeNeedsNightRotateChoice(employee, schedule, day.key),
    });
    const gate = checkShiftChangeApplyGate({ schedule, employee, dateKey: day.key, shiftTypeId: nextId });
    if (!gate.ok) {
      toast({ description: ar ? gate.reason : gate.reasonEn, variant: "destructive" });
      return;
    }
    const key = `${employee.id}:${day.key}`;
    setDraft((prev) => ({ ...prev, [key]: nextId }));
    const result = setEmployeeDayShift(companyId, stationId, day.key, employee.id, nextId);
    if (!result.ok) {
      setDraft((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
    }
  };

  const applyOrdinaryHours = (employee, kind, dateKey) => {
    if (!canEdit || !companyId || !stationId || !employee?.id) return { ok: false };
    const dates = dateKey
      ? [dateKey]
      : weekNightDateKeys(schedule, employee.id, weekStart);
    if (!dates.length) {
      toast({
        description: ar ? "لا يوم لتحويله إلى ساعات عادية." : "No day to convert to ordinary hours.",
        variant: "destructive",
      });
      return { ok: false };
    }
    for (const key of dates) {
      const nextId = ordinaryShiftId(types, kind, key);
      if (!nextId) {
        toast({
          description: ar ? "لا وردية صباحية أو مسائية على هذا الجدول." : "No morning or evening shift on this roster.",
          variant: "destructive",
        });
        return { ok: false };
      }
      const gate = checkShiftChangeApplyGate({ schedule, employee, dateKey: key, shiftTypeId: nextId });
      if (!gate.ok) {
        toast({ description: ar ? gate.reason : gate.reasonEn, variant: "destructive" });
        return gate;
      }
      const result = setEmployeeDayShift(companyId, stationId, key, employee.id, nextId);
      if (!result.ok) {
        toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
        return result;
      }
    }
    decideNightRemedy(companyId, employee.id, "rotate", {
      actorId: currentUser?.id,
      ordinaryKind: kind,
      applyRoster: false,
    });
    toast({
      description: kind === "evening"
        ? (ar ? "دُوِّر هذا الموظف إلى مسائي لتجاوز ثلاثة أشهر دون موافقة. وردية الليل بقيت على الجدول." : "This person was rotated to evening after three months without consent. The night shift stayed on the roster.")
        : (ar ? "دُوِّر هذا الموظف إلى صباحي لتجاوز ثلاثة أشهر دون موافقة. وردية الليل بقيت على الجدول." : "This person was rotated to morning after three months without consent. The night shift stayed on the roster."),
    });
    refresh?.();
    return { ok: true };
  };

  const applyNightRemedy = (employee, kind, extra = {}) => {
    if (!canEdit || !companyId || !employee?.id) return { ok: false };
    if (kind === "morning" || kind === "evening") {
      const result = decideNightRemedy(companyId, employee.id, "rotate", {
        actorId: currentUser?.id,
        ordinaryKind: kind,
      });
      if (!result.ok) {
        toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
        return result;
      }
      toast({
        description: kind === "evening"
          ? (ar ? "غُيّر العمل الليلي إلى مسائي." : "Night work was changed to evening.")
          : (ar ? "غُيّر العمل الليلي إلى صباحي." : "Night work was changed to morning."),
      });
      refresh?.();
      return result;
    }
    if (kind === "withdraw") {
      const result = withdrawNightRemedy(companyId, employee.id, { actorId: currentUser?.id });
      if (!result.ok) {
        toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
        return result;
      }
      toast({
        description: ar
          ? "سُحب القرار. اختَر من جديد: تقليص أو بدل أو تغيير العمل الليلي."
          : "The choice was withdrawn. Choose again: reduce hours, an allowance, or a change of night work.",
      });
      refresh?.();
      return result;
    }
    const result = decideNightRemedy(companyId, employee.id, kind, {
      actorId: currentUser?.id,
      cutHours: extra.cutHours,
      amount: extra.amount,
      allowanceKind: extra.allowanceKind,
    });
    if (!result.ok) {
      toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
      return result;
    }
    const cutLabel = nightCutHoursLabel(result.cutHours || extra.cutHours, ar);
    const payLabel = nightAllowancePayLabel(result.amount || extra.amount, result.allowanceKind || extra.allowanceKind, ar);
    toast({
      description: kind === "reduce"
        ? (ar ? `سُجّل تقليص ${cutLabel}. يمكن سحبه والبدء من جديد.` : `A cut of ${cutLabel} was recorded. You may withdraw and start over.`)
        : (ar ? `سُجّل ${payLabel}. يُصرف مع الراتب. يمكن سحبه والبدء من جديد.` : `${payLabel} recorded. It pays with salary. You may withdraw and start over.`),
    });
    refresh?.();
    return result;
  };

  const doPublish = () => {
    if (!canEdit || blockers || !companyId || !stationId) return;
    if (pub.kind === "implicit") return;
    const result = publishWeek(companyId, stationId, weekKeyFromDate(weekStart), {
      by: currentUser?.name,
    });
    if (!result.ok) {
      toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
      return;
    }
    toast({ description: ar ? "نُشر الجدول — التقويم التشغيلي يقرأ منه." : "Roster published — the operational calendar reads it." });
    refresh?.();
  };

  const submitShiftRequest = () => {
    if (!companyId || !currentUser?.id) return;
    const gate = checkSubmitOtherRequestGate({ type: "shift_change", reason: reqForm.reason, date: reqForm.date });
    if (!gate.ok) {
      toast({ description: ar ? gate.reason : gate.reasonEn, variant: "destructive" });
      return;
    }
    const applyGate = checkShiftChangeApplyGate({
      schedule,
      employee: employees.find((row) => row.id === currentUser.id) || currentUser,
      dateKey: reqForm.date,
      shiftTypeId: reqForm.shiftTypeId || null,
    });
    if (!applyGate.ok) {
      toast({ description: ar ? applyGate.reason : applyGate.reasonEn, variant: "destructive" });
      return;
    }
    submitOtherRequest(companyId, currentUser.id, {
      type: "shift_change",
      reason: reqForm.reason,
      date: reqForm.date,
      shiftTypeId: reqForm.shiftTypeId || undefined,
      stationId,
    });
    toast({ description: ar ? "سُجّل طلب تغيير الوردية — بانتظار الاعتماد." : "Shift-change request recorded — awaiting approval." });
    setReqOpen(false);
    refresh?.();
  };

  const askNightConsent = () => {
    if (!companyId) return;
    const result = openDueNightRotateCycles(companyId);
    toast({
      description: result.opened?.length
        ? (ar ? "فُتح طلب الموافقة للموظف — بانتظار قراره." : "Consent request opened — awaiting the worker's decision.")
        : (ar ? "الطلب مفتوح أو أُجيب هذا الشهر." : "A request is already open or answered this month."),
    });
    if (result.opened?.length) refresh?.();
  };

  const brushLabel = brush === ""
    ? (ar ? "راحة" : "Rest")
    : (types.find((row) => row.id === brush)?.label || "");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <section style={{ ...slab, padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
          <KickerLine kicker={kicker} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h1 className="nv-h" style={{ margin: 0, fontFamily: HEADING, fontSize: 24, fontWeight: 700, lineHeight: 1.35 }}>{boardTitle}</h1>
            <StatutoryItem decisionId="18632" ar={ar} entitlement glow={nightGlow} compact />
          </div>
          <span style={{ fontSize: 13, color: SW.mid, lineHeight: 1.8 }}>
            {ar ? (
              <>
                الوردية المنشورة هي مصدر الوقت: منها يُعرف من يجب أن يحضر، ومتى يُعدّ متأخراً.{" "}
                <Link to="/app/attendance" style={LINK}>الحضور</Link>
                {" يلتقط و"}
                <Link to="/app/calendar" style={LINK}>التقويم التشغيلي</Link>
                {" يثبت. الإجازات مصدرها "}
                <Link to="/app/requests" style={LINK}>طلباتي</Link>
                {" وملف الموظف."}
              </>
            ) : (
              <>
                The published shift is the clock: who must attend, and when lateness starts.{" "}
                <Link to="/app/attendance" style={LINK}>Attendance</Link>
                {" captures and "}
                <Link to="/app/calendar" style={LINK}>the operational calendar</Link>
                {" confirms. Leave comes from "}
                <Link to="/app/requests" style={LINK}>My Requests</Link>
                {" and the employee file."}
              </>
            )}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", border: `1px solid ${SW.line}` }}>
            <button type="button" onClick={() => moveWeek(-1)} style={{ fontFamily: "inherit", padding: "10px 14px", border: "none", background: SW.card, color: SW.mid, cursor: "pointer" }}>{ar ? "›" : "‹"}</button>
            <button type="button" onClick={() => setWeekStart(weekStartDate(new Date()))} title={ar ? "ارجع للأسبوع الجاري" : "Back to this week"} style={{ fontFamily: "inherit", padding: "7px 16px", border: "none", borderInline: `1px solid ${SW.line}`, background: SW.card, cursor: "pointer", color: SW.ink, display: "flex", flexDirection: "column", gap: 1, alignItems: "center", whiteSpace: "nowrap" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: thisWeekNow ? SW.ink : SW.mid }}>{thisWeek}</span>
              <span style={{ fontSize: 11, color: SW.muted }}>{formatWeekLabel(weekStart, ar)}</span>
            </button>
            <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 10px", borderInlineEnd: `1px solid ${SW.line}`, whiteSpace: "nowrap" }}>
              <span style={{ fontSize: 10, color: SW.muted }}>{ar ? "اقفز" : "Jump"}</span>
              <div style={{ width: 168 }}>
                <PlatformDateField
                  compact
                  ar={ar}
                  allowClear={false}
                  value={weekDateKeys(weekStart)[0]}
                  onChange={(next) => {
                    if (!next) return;
                    setWeekStart(weekStartDate(next));
                  }}
                />
              </div>
            </label>
            <button type="button" onClick={() => moveWeek(1)} style={{ fontFamily: "inherit", padding: "10px 14px", border: "none", background: SW.card, color: SW.mid, cursor: "pointer" }}>{ar ? "‹" : "›"}</button>
          </div>
          {canEdit && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", maxWidth: 280, minWidth: 0 }}>
              <button
                type="button"
                onClick={doPublish}
                disabled={publishLocked}
                style={{
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "10px 18px",
                  border: "none",
                  background: published && pub.kind === "published" ? SW.mid : blockers ? SW.gold : SW.green,
                  color: "#fff",
                  cursor: publishLocked ? "default" : "pointer",
                  whiteSpace: "nowrap",
                  flex: "0 0 auto",
                }}
              >
                {publishLabel}
              </button>
              {publishSubmitBlock ? (
                <span style={{ fontSize: 11, color: SW.abs, lineHeight: 1.6, textAlign: "end" }}>
                  {publishSubmitBlock}
                </span>
              ) : null}
            </div>
          )}
        </div>
      </section>

      <div className="nv-ops-cal-board">
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <section style={{ ...slab, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${SW.soft}`, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{assignmentsTitle}</span>
                <span style={{ fontSize: 12, color: SW.muted }}>{gridNote}</span>
              </div>
              {canEdit ? (
              <div style={{ marginInlineStart: "auto", display: "flex", gap: 5, flexWrap: "wrap" }}>
                <button type="button" onClick={() => setBrush(null)} style={chipBtn(brush === null)}>
                  <span style={{ width: 8, height: 8, background: "#c7ccd6" }} />
                  {ar ? "تبديل بالترتيب" : "Cycle in order"}
                </button>
                {types.map((shift, index) => {
                  const style = shiftTypeStyle(shift, index);
                  return (
                    <button key={shift.id} type="button" onClick={() => setBrush(shift.id)} style={chipBtn(brush === shift.id)}>
                      <span style={{ width: 8, height: 8, background: style.color }} />
                      {shift.label}
                    </button>
                  );
                })}
                <button type="button" onClick={() => setBrush("")} style={chipBtn(brush === "")}>
                  <span style={{ width: 8, height: 8, background: REST_STYLE.color }} />
                  {ar ? "راحة" : "Rest"}
                </button>
              </div>
              ) : null}
            </div>
            <div style={{ overflowX: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(96px,1.1fr) repeat(7,minmax(72px,1fr))", gap: 1, background: SW.soft, borderBottom: `1px solid ${SW.line}`, minWidth: 640 }}>
                <span style={{ background: SW.wash, padding: "9px 10px", fontSize: 11, color: SW.muted }}>{ar ? "الموظف" : "Employee"}</span>
                {days.map((day) => (
                  <span key={day.key} style={{ background: SW.wash, padding: "9px 4px", textAlign: "center", display: "flex", flexDirection: "column", gap: 1 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: day.weekend ? SW.muted : SW.mid }}>{weekdayLabel(day.wd, ar)}</span>
                    <span dir="ltr" style={{ ...mono, fontSize: 10, color: SW.muted }}>{day.day}</span>
                  </span>
                ))}
              </div>
              {roster.length === 0 && (
                <div style={{ padding: "18px 20px", background: SW.card, fontSize: 13, color: SW.mid, lineHeight: 1.8 }}>
                  {stationName
                    ? (ar ? `لا موظفون على جدول فرع ${stationName} هذا الأسبوع.` : `Nobody is on the ${stationName} roster this week.`)
                    : (ar ? "لا موظفون على هذا الجدول." : "Nobody is on this roster.")}
                </div>
              )}
              {roster.map((employee) => {
                const hours = employeeWeekHours(schedule, employee.id, weekStart, employee);
                const mineRow = isViewerOwnFile(employee, currentUser);
                const nightMark = rosterNightRowMark({ employee, schedule, weekStart, laborCalendar });
                return (
                  <div key={employee.id} style={{ display: "grid", gridTemplateColumns: "minmax(96px,1.1fr) repeat(7,minmax(72px,1fr))", gap: 1, background: SW.soft, borderBottom: `1px solid ${SW.row}`, minWidth: 640 }}>
                    <span style={{ background: mineRow ? SW.greenBg : SW.card, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 1, minWidth: 0, borderInlineStart: mineRow ? `3px solid ${SW.green}` : "3px solid transparent" }}>
                      <span
                        className="nv-roster-name"
                        data-glow={nightMark.nameGlow ? "due" : "off"}
                        style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                      >
                        {employee.name}{mineRow ? <>{" "}<FileSelfBadge ar={ar} /></> : null}
                      </span>
                      <span dir="ltr" style={{ ...mono, fontSize: 10, color: SW.muted }}>{hours} {ar ? "س" : "h"}</span>
                    </span>
                    {days.map((day) => {
                      const leave = leaveOnDayView(employee, day.key, ar);
                      const shift = leave ? null : shiftOn(employee, day);
                      const style = leave ? leave.style : (shift ? shiftTypeStyle(shift, types.findIndex((row) => row.id === shift.id)) : REST_STYLE);
                      const locked = !!leave;
                      const cellAlert = weekCellAlert(gates, employee.id, day.key);
                      const cellTone = weekCellAlertTone(cellAlert);
                      const cellReason = cellAlert?.hint
                        || (cellAlert
                          ? (gates.checks.find((row) => row.id === cellAlert.id)?.title || "")
                          : "");
                      const baseTitle = locked
                        ? `${employee.name} — ${day.key} — ${ar ? "إجازة" : "Leave"} ${leave.type}${leave.article ? ` · ${leave.article}` : ""} · ${ar ? "اعتُمدت في طلباتي · مقفلة" : "approved in My Requests · locked"}`
                        : `${employee.name} — ${day.key} — ${shift ? `${shift.label} ${shiftHoursLine(shift, lang)}` : (ar ? "راحة" : "Rest")}`;
                      return (
                        <button
                          key={`${employee.id}-${day.key}`}
                          type="button"
                          disabled={!canEdit || locked}
                          onClick={() => { if (!locked) cycleCell(employee, day); }}
                          title={cellReason ? `${baseTitle} · ${cellReason}` : baseTitle}
                          style={{
                            fontFamily: "inherit",
                            border: "none",
                            background: style.bg,
                            color: style.fg,
                            cursor: canEdit && !locked ? "pointer" : locked ? "not-allowed" : "default",
                            padding: "7px 2px",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 1,
                            minHeight: 44,
                            justifyContent: "center",
                            position: "relative",
                            boxShadow: cellTone ? `inset 0 0 0 1.5px ${cellTone.color}` : undefined,
                          }}
                        >
                          {cellTone ? (
                            <span
                              aria-hidden
                              style={{
                                position: "absolute",
                                top: 4,
                                insetInlineStart: 4,
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: cellTone.color,
                              }}
                            />
                          ) : null}
                          <span style={{ fontSize: 11, fontWeight: 600 }}>{leave ? leave.type : (shift ? shift.label : (ar ? "راحة" : "Rest"))}</span>
                          {leave?.articleId ? (
                            <StatutoryItem article={leave.articleId} ar={ar} entitlement compact surface="leave" />
                          ) : (
                            <span style={{ fontSize: 9, opacity: 0.85, lineHeight: 1.45, fontWeight: 500 }} dir={ar ? "rtl" : "ltr"}>
                              {shift ? shiftHoursLine(shift, lang) : ""}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <div style={{ padding: "12px 20px", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              {types.map((shift, index) => {
                const style = shiftTypeStyle(shift, index);
                return (
                  <span key={shift.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, color: SW.mid }}>
                    <span style={{ width: 11, height: 11, background: style.bg, border: `1px solid ${style.color}` }} />
                    {shift.label}
                  </span>
                );
              })}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, color: SW.mid }}>
                <span style={{ width: 11, height: 11, background: "#fff", border: `1px solid ${SW.line}` }} />
                {ar ? "راحة" : "Rest"}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, color: SW.mid }}>
                <span style={{ width: 11, height: 11, background: LEAVE_STYLE.bg, border: `1px solid ${LEAVE_STYLE.color}` }} />
                {ar ? "إجازة معتمدة" : "Approved leave"}
              </span>
              <Link
                to="/app/requests"
                style={{
                  fontFamily: "inherit",
                  fontSize: 11,
                  padding: "6px 11px",
                  border: `1px dashed ${LEAVE_STYLE.color}`,
                  background: LEAVE_STYLE.bg,
                  color: LEAVE_STYLE.fg,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {ar ? "الإجازات من طلباتي" : "Leave from My Requests"}
              </Link>
              <span style={{ marginInlineStart: "auto", fontSize: 11, color: SW.muted }}>
                {brush != null
                  ? (ar ? `اضغط أي خلية لتعيين «${brushLabel}»` : `Click a cell to assign “${brushLabel}”`)
                  : (ar ? "اضغط الخلية للتبديل بين الورديات بما فيها الليل. من تجاوز ثلاثة أشهر دون موافقة: صباحي أو مسائي من التنبيه. خلايا الإجازة مقفلة." : "Click a cell to cycle every shift, including night. After three months without consent, use morning or evening on the alert. Leave cells stay locked.")}
              </span>
            </div>
            <div style={{ padding: "0 20px 14px", display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setReqOpen((v) => !v)} style={chipBtn(reqOpen)}>
                {ar ? "اطلب تغيير وردية" : "Request a shift change"}
              </button>
              <Link to="/app/requests" style={{ fontSize: 11, color: SW.ink, fontWeight: 600, alignSelf: "center" }}>
                {ar ? "طلباتي" : "My requests"}
              </Link>
            </div>
            {reqOpen && (
              <div style={{ margin: "0 20px 16px", padding: 14, background: SW.wash, border: `1px solid ${SW.line}`, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 10, color: SW.muted }}>{ar ? "اليوم" : "Day"}</span>
                  <PlatformDateField ar={ar} value={reqForm.date} onChange={(next) => setReqForm((f) => ({ ...f, date: next }))} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 10, color: SW.muted }}>{ar ? "الوردية المطلوبة" : "Requested shift"}</span>
                  <select value={reqForm.shiftTypeId} onChange={(e) => setReqForm((f) => ({ ...f, shiftTypeId: e.target.value }))} style={{ fontFamily: "inherit", fontSize: 12, padding: 8, border: `1px solid ${SW.line}`, background: SW.card, color: SW.ink }}>
                    <option value="">{ar ? "راحة" : "Rest"}</option>
                    {types.map((shift) => <option key={shift.id} value={shift.id}>{shift.label} · {shiftHoursLine(shift, lang)}</option>)}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
                  <span style={{ fontSize: 10, color: SW.muted }}>{ar ? "السبب" : "Reason"}</span>
                  <input value={reqForm.reason} onChange={(e) => setReqForm((f) => ({ ...f, reason: e.target.value }))} placeholder={ar ? "لماذا هذا التغيير؟" : "Why this change?"} style={{ fontFamily: "inherit", fontSize: 12, padding: 8, border: `1px solid ${SW.line}`, background: SW.card, color: SW.ink }} />
                </label>
                <button type="button" onClick={submitShiftRequest} style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "8px 14px", border: "none", background: SW.green, color: "#fff", cursor: "pointer" }}>
                  {ar ? "أرسل للاعتماد" : "Submit for approval"}
                </button>
              </div>
            )}
          </section>

          <section style={{ ...slab, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${SW.soft}`, display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "من كان على الوردية؟" : "Who was on shift?"}</span>
                <span style={{ fontSize: 12, color: SW.muted, lineHeight: 1.7 }}>{histScope}</span>
              </div>
              <div style={{ marginInlineStart: "auto", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ width: 168 }}>
                  <PlatformDateField compact ar={ar} value={histFrom} onChange={setHistFrom} />
                </div>
                <span style={{ fontSize: 11, color: SW.muted }}>→</span>
                <div style={{ width: 168 }}>
                  <PlatformDateField compact ar={ar} value={histTo} min={histFrom} onChange={setHistTo} />
                </div>
                <button type="button" onClick={() => setHistMode("emp")} style={chipBtn(histMode === "emp")}>{ar ? "حسب الموظف" : "By person"}</button>
                <button type="button" onClick={() => setHistMode("day")} style={chipBtn(histMode === "day")}>{ar ? "حسب اليوم" : "By day"}</button>
                <input value={histQuery} onChange={(e) => setHistQuery(e.target.value)} placeholder={ar ? "ابحث بالاسم" : "Search a name"} style={{ fontFamily: "inherit", fontSize: 11, padding: "6px 9px", border: `1px solid ${SW.line}`, background: SW.card, color: SW.ink, outline: "none", width: 120 }} />
              </div>
            </div>
            {histMode === "emp" && history.workDays > 0 && history.rows.length > 0 ? (
              <div style={{ padding: "12px 20px 4px", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(92px,1.2fr) minmax(0,4fr) 50px", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: SW.muted }}>{ar ? "الموظف" : "Employee"}</span>
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${history.days.length},minmax(0,1fr))`, gap: 2 }}>
                    {history.days.map((day) => (
                      <span key={`h-head-${day.key}`} style={{ textAlign: "center", fontSize: 9, color: SW.muted, lineHeight: 1.3 }}>
                        {day.day} {(ar ? MONTHS_AR : MONTHS_EN)[day.month].slice(0, 3)}
                      </span>
                    ))}
                  </div>
                  <span style={{ fontSize: 11, color: SW.muted, textAlign: "left" }}>{ar ? "ساعات" : "Hours"}</span>
                </div>
                {history.rows.map((row) => (
                  <div key={row.employee.id} style={{ display: "grid", gridTemplateColumns: "minmax(92px,1.2fr) minmax(0,4fr) 50px", gap: 10, alignItems: "center" }}>
                    <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.name}</span>
                      <span style={{ fontSize: 10, color: SW.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.summary}</span>
                    </span>
                    <div style={{ display: "grid", gridTemplateColumns: `repeat(${history.days.length},minmax(0,1fr))`, gap: 2 }}>
                      {row.cells.map((cell, index) => (
                        <span
                          key={`${row.employee.id}-h-${index}`}
                          title={cell.tip}
                          style={{
                            height: 26,
                            background: cell.bg,
                            border: `1px solid ${cell.border}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 9,
                            fontWeight: 600,
                            color: cell.color,
                          }}
                        >
                          {cell.mark}
                        </span>
                      ))}
                    </div>
                    <span dir="ltr" style={{ ...mono, fontSize: 12, color: SW.ink, textAlign: "left" }}>{row.hours}</span>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", paddingTop: 6 }}>
                  {types.map((shift, index) => {
                    const style = shiftTypeStyle(shift, index);
                    return (
                      <span key={`hist-leg-${shift.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: SW.mid }}>
                        <span style={{ width: 11, height: 11, background: style.bg, border: `1px solid ${style.color}` }} />
                        {shift.label}
                      </span>
                    );
                  })}
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: SW.mid }}>
                    <span style={{ width: 11, height: 11, background: LEAVE_STYLE.bg, border: `1px solid ${LEAVE_STYLE.color}` }} />
                    {ar ? "إجازة" : "Leave"}
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: SW.mid }}>
                    <span style={{ width: 11, height: 11, background: SW.wash, border: `1px solid ${SW.soft}` }} />
                    {ar ? "راحة" : "Rest"}
                  </span>
                </div>
              </div>
            ) : null}
            {histMode === "day" && history.workDays > 0 ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {history.dayRows.map((day) => (
                  <div key={day.label} style={{ padding: "11px 20px", borderBottom: `1px solid ${SW.row}`, display: "grid", gridTemplateColumns: "minmax(84px,auto) minmax(0,1fr)", gap: 14, alignItems: "start" }}>
                    <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{day.label}</span>
                      <span style={{ fontSize: 10, color: SW.muted }}>{day.count} {ar ? "على وردية" : "on shift"}</span>
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                      {day.empty && <span style={{ fontSize: 11, color: SW.muted }}>{ar ? "لا أحد على وردية" : "Nobody on shift"}</span>}
                      {day.groups.map((group) => (
                        <div key={group.name} style={{ display: "grid", gridTemplateColumns: "78px minmax(0,1fr)", gap: 9, alignItems: "start" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: group.fg, background: group.bg, border: `1px solid ${group.color}`, padding: "2px 7px", textAlign: "center", whiteSpace: "nowrap" }}>{group.name}</span>
                          <span style={{ fontSize: 11, color: SW.ink, lineHeight: 1.8 }}>{group.names}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <div style={{ padding: "12px 20px" }}>
              <span style={{ fontSize: 11, color: SW.mid, lineHeight: 1.85 }}>{histNote}</span>
            </div>
          </section>

          <section style={{ ...slab, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${SW.soft}`, display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "فحص ما قبل النشر" : "Pre-publish checks"}</span>
                <span style={{ fontSize: 12, color: SW.muted, lineHeight: 1.7 }}>{ar ? "كل فحص من الجدول أعلاه — لا يُنشر جدول يخالف أيًّا من الموانع." : "Every check is derived from the grid — a blocking fail stops publish."}</span>
              </div>
              <span style={{
                marginInlineStart: "auto",
                fontSize: 11,
                fontWeight: 600,
                color: blockers ? SW.abs : gates.warnings.length ? SW.gold : SW.green,
                background: blockers ? SW.absBg : gates.warnings.length ? SW.goldBg : SW.greenBg,
                border: `1px solid ${blockers ? SW.absBd : gates.warnings.length ? SW.goldBd : SW.greenBd}`,
                padding: "6px 11px",
                whiteSpace: "nowrap",
              }}>
                {checksBadge}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,250px),1fr))" }}>
              {gates.checks.map((check) => (
                <div key={check.id} style={{ padding: "13px 18px", borderInlineStart: `1px solid ${SW.hair}`, borderBottom: `1px solid ${SW.hair}`, display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: 10, alignItems: "start" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: check.ok ? SW.greenDot : check.block ? SW.abs : SW.goldDot, marginTop: 6 }} />
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, minWidth: 0, width: "100%" }}>
                    {(() => {
                      const glow = check.ruleId ? statutoryGlowState({
                        kind: check.ruleId,
                        employees: roster,
                        schedule,
                        weekStart,
                        laborCalendar,
                        failing: !check.ok,
                      }) : "off";
                      const showEssay = !!(check.ruleId && showStatutoryHeaderCite(glow, { ok: check.ok, failing: !check.ok }));
                      return (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: check.ok ? SW.ink : check.block ? SW.abs : SW.gold, lineHeight: 1.5 }}>{check.title}</span>
                            {check.ruleId ? (
                              <LaborArticleCite
                                ruleId={check.ruleId}
                                ar={ar}
                                tone={check.block && !check.ok ? "block" : (!check.ok ? "warn" : undefined)}
                                glow={glow}
                              />
                            ) : null}
                          </div>
                          {showEssay ? (
                            <LaborArticleCite
                              ruleId={check.ruleId}
                              ar={ar}
                              showText
                              showChip={false}
                              tone={check.block && !check.ok ? "block" : (!check.ok ? "warn" : undefined)}
                              glow={glow}
                            />
                          ) : null}
                        </>
                      );
                    })()}
                    <span style={{ fontSize: 11, color: SW.mid, lineHeight: 1.8 }}>{check.note}</span>
                    {check.id === "night_medical" && !check.ok ? (
                      <NightMedicalFileField
                        ar={ar}
                        compact
                        unmet
                        requestsHref={mode === "mine" ? "/app/requests" : "/app/requests/manage"}
                      />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          {days.some((day) => isRamadanDay(day.key, laborCalendar)) ? (
            <LaborCalendarCard
              companyId={companyId}
              laborCalendar={laborCalendar}
              year={Number(String(days[0]?.key || "").slice(0, 4))}
              canEdit={canEdit}
              ar={ar}
              onSaved={() => refresh?.()}
            />
          ) : null}
          {mode === "mine" ? (
            <FileHoursAlertsRail
              employee={employees.find((row) => isViewerOwnFile(row, currentUser)) || currentUser}
              schedule={schedule}
              weekStart={weekStart}
              currentUser={currentUser}
              lang={lang}
              laborCalendar={laborCalendar}
              gates={gates}
              station={station}
              settings={data?.settings}
              company={data}
              canApplyOrdinary={canEdit}
              onApplyOrdinary={(employee, kind, dateKey) => applyOrdinaryHours(employee, kind, dateKey)}
            />
          ) : (
            <ManagerDutyAlertsRail
              weekStart={weekStart}
              lang={lang}
              gates={gates}
              employees={roster}
              canApplyOrdinary={canEdit}
              onApplyOrdinary={(employee, kind, dateKey) => applyOrdinaryHours(employee, kind, dateKey)}
              onNightRemedy={(employee, kind, extra) => applyNightRemedy(employee, kind, extra)}
            />
          )}

          {mode !== "mine" ? (
          <>
          <section style={{ ...slab, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${SW.soft}` }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "مصدر الوقت" : "Clock source"}</span>
            </div>
            {[
              [ar ? "مصدر الساعة" : "The clock", ar ? "الجدول المنشور — لا ساعة شركة افتراضية." : "The published roster — no company default hour."],
              [ar ? "شرط الوردية" : "Shift required", ar ? "إلزامي للفروع الثابتة، اختياري للمواقع الميدانية المتنقلة." : "Required at fixed stations; optional at mobile field sites."],
              [ar ? "التأخير" : "Lateness", ar ? "من أول دقيقة بعد بداية الوردية المنشورة. لا حدّ سماح." : "From the first minute after the published shift start. No grace."],
              [ar ? "الغياب" : "Absence", ar ? "وردية منشورة بلا تسجيل ولا إجازة معتمدة." : "A published shift with no punch and no approved leave."],
              [ar ? "العمل الليلي" : "Night work", ar ? "التنبيه عند الاستحقاق في الشريط وطلباتي — لا يُرسم على صف الجدول." : "Due alerts live on the rail and in My Requests — not on roster rows."],
            ].map(([label, value]) => (
              <div key={label} style={{ padding: "12px 18px", borderBottom: `1px solid ${SW.row}`, display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 11, color: SW.mid, lineHeight: 1.8 }}>{value}</span>
              </div>
            ))}
            <div style={{ padding: "12px 18px" }}>
              <span style={{ fontSize: 11, color: SW.gold, lineHeight: 1.85 }}>
                {ar ? "الحضور بلا وردية منشورة لا يُحسب تأخيراً ولا غياباً — يُسجَّل بعلامة «بلا جدول» ويذهب للمدير." : "A punch without a published shift is neither late nor absent — it is flagged as unscheduled and sent to the manager."}
              </span>
            </div>
          </section>

          <section style={{ ...slab, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${SW.soft}` }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "إعداد الليل" : "Night settings"}</span>
            </div>
            {canEdit ? (
              <div style={{ padding: "12px 18px", borderBottom: `1px solid ${SW.row}`, display: "flex", flexDirection: "column", gap: 7 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{ar ? "تعويض ليلي لهذا الجدول" : "Night compensation on this roster"}</span>
                <span style={{ fontSize: 11, color: SW.mid, lineHeight: 1.75 }}>{ar ? "للإدارة اختيار تقليص ساعة أو ساعتين أو ثلاث من وردية الموظف، أو بدل أجر أو نقل بمبلغ يُصرف مع الراتب، أو تغيير العمل الليلي. التقليص والبدل يُسحبان للبدء من جديد. زر الجدول أدناه يسجّل سياسة الفرع فقط. بعد ثلاثة أشهر يبقى التدوير أو موافقة الموظف الخطية." : "Management chooses a cut of one, two, or three hours from this person's shift, a pay or transport allowance that pays with salary, or a change of night work. A reduction or allowance can be withdrawn to start over. The roster button below only records the station policy. After three months, rotation or the worker's written consent still applies."}</span>
                <button
                  type="button"
                  onClick={() => {
                    setScheduleNightCompensation(companyId, stationId, !schedule?.nightCompensation);
                    refresh?.();
                  }}
                  style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "6px 10px", border: `1px solid ${SW.line}`, background: schedule?.nightCompensation ? SW.greenBg : SW.card, color: schedule?.nightCompensation ? SW.green : SW.ink, cursor: "pointer", textAlign: "start", alignSelf: "start" }}
                >
                  {schedule?.nightCompensation
                    ? (ar ? "تعويض ليلي مسجّل — اضغط للإلغاء" : "Night compensation on file — click to clear")
                    : (ar ? "سجّل تعويضاً ليلياً لهذا الجدول" : "Record night compensation on this roster")}
                </button>
                {withdrawableNightRemedyEmployees(roster).map((emp) => {
                  const remedy = activeNightRemedy(emp);
                  return (
                    <div key={emp.id} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: SW.ink }}>
                        {emp.name}
                        {" — "}
                        {remedy?.kind === "reduce"
                          ? (ar
                            ? `تقليص ${nightCutHoursLabel(remedy.cutHours, true) || "ساعات"} مسجّل`
                            : `${nightCutHoursLabel(remedy.cutHours, false) || "hours"} reduced on file`)
                          : (ar
                            ? `${nightAllowancePayLabel(remedy.amount, remedy.allowanceKind, true)} مسجّل`
                            : `${nightAllowancePayLabel(remedy.amount, remedy.allowanceKind, false)} on file`)}
                      </span>
                      <button
                        type="button"
                        onClick={() => applyNightRemedy(emp, "withdraw")}
                        style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "4px 8px", border: `1px solid ${SW.line}`, background: SW.card, color: SW.ink, cursor: "pointer" }}
                      >
                        {ar ? "سحب والبدء من جديد" : "Withdraw and start over"}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : schedule?.nightCompensation ? (
              <div style={{ padding: "12px 18px", borderBottom: `1px solid ${SW.row}` }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: SW.green }}>{ar ? "تعويض ليلي مسجّل على هذا الجدول." : "Night compensation is on file for this roster."}</span>
              </div>
            ) : null}
            {canEdit ? (
              <div style={{ padding: "12px 18px", display: "flex", flexDirection: "column", gap: 7 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{ar ? "التزامات المنشأة لليل" : "Night workplace duties"}</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {NIGHT_FACILITY_FLAGS.map((flag) => {
                    const on = !!(schedule?.[flag.key] || data?.nightFacilities?.[flag.key]);
                    return (
                      <button
                        key={flag.key}
                        type="button"
                        onClick={() => {
                          setNightFacilityFlag(companyId, { stationId, key: flag.key, on: !schedule?.[flag.key] });
                          refresh?.();
                        }}
                        style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "6px 10px", border: `1px solid ${SW.line}`, background: on ? SW.greenBg : SW.card, color: on ? SW.green : SW.ink, cursor: "pointer" }}
                      >
                        {on ? (ar ? `${flag.ar} — مسجّل` : `${flag.en} — on`) : (ar ? flag.ar : flag.en)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>

          <section style={{ ...slab, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${SW.soft}` }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "أنواع الورديات" : "Shift types"}</span>
            </div>
            {types.map((shift, index) => {
              const style = shiftTypeStyle(shift, index);
              return (
                <div key={shift.id} style={{ padding: "11px 18px", borderBottom: `1px solid ${SW.row}`, display: "flex", flexDirection: "column", gap: 7 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto auto", gap: 8, alignItems: "center" }}>
                    <span style={{ width: 9, height: 9, background: style.color, flex: "none" }} />
                    <input
                      value={shift.label}
                      disabled={!canEdit}
                      onChange={(e) => { updateShiftType(companyId, stationId, shift.id, { label: e.target.value }); refresh?.(); }}
                      style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: SW.ink, border: "1px solid transparent", background: "none", outline: "none", padding: "3px 4px", minWidth: 0, width: "100%" }}
                    />
                    <span style={{ display: "flex", gap: 5, alignItems: "center", whiteSpace: "nowrap" }}>
                      <span style={{ ...mono, fontSize: 11, color: SW.mid }}>{shiftHours(shift)} {ar ? "س" : "h"}</span>
                      {canEdit ? (
                        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: SW.mid }}>
                          <span>{ar ? "راحة" : "rest"}</span>
                          <input
                            type="number"
                            min={0}
                            step={15}
                            value={shift.restMinutes ?? 30}
                            aria-label={ar ? `راحة ${shift.label || "الوردية"} بالدقيقة` : `${shift.label || "Shift"} rest minutes`}
                            onChange={(e) => {
                              updateShiftType(companyId, stationId, shift.id, { restMinutes: Math.max(0, Number(e.target.value) || 0) });
                              refresh?.();
                            }}
                            style={{ ...mono, width: 52, fontSize: 11, padding: "2px 4px", border: `1px solid ${SW.line}`, background: SW.card, color: SW.ink, outline: "none" }}
                          />
                          <span>{ar ? "د" : "m"}</span>
                        </label>
                      ) : (
                        <span style={{ fontSize: 10, color: SW.mid, background: "#f5f6f8", border: "1px solid #e6e9ef", borderRadius: 9, padding: "1px 7px" }}>
                          {ar ? `راحة ${shift.restMinutes ?? 30} د` : `${shift.restMinutes ?? 30}m rest`}
                        </span>
                      )}
                    </span>
                    {canEdit && (
                      <ConfirmDeleteDialog
                        title={ar ? "حذف نوع الوردية؟" : "Delete this shift type?"}
                        description={ar
                          ? `سيُحذف «${shift.label || "الوردية"}» من ${shift.start || "—"} إلى ${shift.end || "—"}، وتُرفع تعييناتها من الجدول.`
                          : `“${shift.label || "Shift"}” from ${shift.start || "—"} to ${shift.end || "—"} will be removed, and its assignments cleared.`}
                        confirmLabel={ar ? "تأكيد الحذف" : "Confirm delete"}
                        trigger={(
                          <button type="button" title={ar ? "حذف النوع" : "Delete type"} aria-label={ar ? "حذف نوع الوردية" : "Delete shift type"} style={{ fontFamily: "inherit", fontSize: 12, border: `1px solid ${SW.line}`, background: SW.card, color: SW.abs, cursor: "pointer", width: 24, height: 24, padding: 0, flex: "none" }}>×</button>
                        )}
                        onConfirm={() => { removeShiftType(companyId, stationId, shift.id); refresh?.(); }}
                      />
                    )}
                  </div>
                  {canEdit && (
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 5 }}>
                      <label style={{ display: "grid", gridTemplateColumns: "26px minmax(0,1fr)", gap: 6, alignItems: "center", minWidth: 0 }}>
                        <span style={{ fontSize: 10, color: SW.muted }}>{ar ? "من" : "From"}</span>
                        <input type="time" value={shift.start || ""} onChange={(e) => {
                          if (!e.target.value) return;
                          updateShiftType(companyId, stationId, shift.id, { start: e.target.value });
                          refresh?.();
                        }} style={{ ...mono, fontSize: 11, padding: "5px 6px", border: `1px solid ${SW.line}`, background: SW.card, color: SW.ink, outline: "none", width: "100%", boxSizing: "border-box", minWidth: 0 }} />
                      </label>
                      <label style={{ display: "grid", gridTemplateColumns: "26px minmax(0,1fr)", gap: 6, alignItems: "center", minWidth: 0 }}>
                        <span style={{ fontSize: 10, color: SW.muted }}>{ar ? "إلى" : "To"}</span>
                        <input type="time" value={shift.end || ""} onChange={(e) => {
                          if (!e.target.value) return;
                          updateShiftType(companyId, stationId, shift.id, { end: e.target.value });
                          refresh?.();
                        }} style={{ ...mono, fontSize: 11, padding: "5px 6px", border: `1px solid ${SW.line}`, background: SW.card, color: SW.ink, outline: "none", width: "100%", boxSizing: "border-box", minWidth: 0 }} />
                      </label>
                      <label style={{ display: "grid", gridTemplateColumns: "26px minmax(0,1fr)", gap: 6, alignItems: "center", minWidth: 0 }}>
                        <span style={{ fontSize: 10, color: SW.muted }}>{ar ? "مكان" : "Place"}</span>
                        <select
                          value={shift.outdoor === true ? "outdoor" : shift.outdoor === false ? "indoor" : ""}
                          onChange={(e) => {
                            const next = e.target.value === "outdoor" ? true : e.target.value === "indoor" ? false : null;
                            updateShiftType(companyId, stationId, shift.id, { outdoor: next });
                            refresh?.();
                          }}
                          aria-label={ar ? "مكان العمل: داخلي أو ميدان مكشوف" : "Work place: indoor or open-air"}
                          style={{ fontFamily: "inherit", fontSize: 11, padding: "5px 6px", border: `1px solid ${SW.line}`, background: SW.card, color: SW.ink, outline: "none", width: "100%", boxSizing: "border-box", minWidth: 0 }}
                        >
                          <option value="">{ar ? "غير محدد — حظر الشمس يحتاج وسمًا" : "Unset — sun ban needs a mark"}</option>
                          <option value="indoor">{ar ? "داخلي — لا حظر شمس" : "Indoor — sun ban does not apply"}</option>
                          <option value="outdoor">{ar ? "ميدان مكشوف — قرار 3337" : "Open-air — decision 3337"}</option>
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
            {canEdit && (
              <div style={{ padding: "11px 18px", display: "flex", flexDirection: "column", gap: 9 }}>
                <button
                  type="button"
                  onClick={() => {
                    const next = nextDistinctShift(types, ar);
                    if (!next) return;
                    addShiftType(companyId, stationId, { ...next, restMinutes: next.restMinutes ?? ruleValue("hours.rest.duringShiftMinutes") });
                    refresh?.();
                  }}
                  style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "8px 12px", border: "1px dashed #c7ccd6", background: SW.card, color: SW.ink, cursor: "pointer" }}
                >
                  {ar ? "+ أضف نوع وردية" : "+ Add a shift type"}
                </button>
                <span style={{ fontSize: 11, color: SW.mid, lineHeight: 1.8 }}>{ar ? "تغيير الوقت يعيد حساب الساعات ويعيد الجدول إلى مسودة — الوردية المنشورة لا تتغيّر بأثر رجعي." : "Changing the time recalculates hours and returns the week to draft — a published shift never changes retroactively."}</span>
              </div>
            )}
            {canEdit && (
              <div style={{ padding: "14px 18px", borderTop: `1px solid ${SW.soft}`, display: "flex", flexDirection: "column", gap: 9 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{ar ? "سريان الجدول" : "Roster validity"}</span>
                {weekValidityOptions(ar).map((option) => {
                  const on = validityKind === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => { setWeekValidity(companyId, stationId, option.id, schedule?.validUntil); refresh?.(); }}
                      style={{
                        fontFamily: "inherit",
                        textAlign: "start",
                        fontSize: 12,
                        padding: "8px 10px",
                        border: `1px solid ${on ? SW.greenBd : SW.soft}`,
                        background: on ? SW.greenBg : SW.card,
                        color: SW.ink,
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                      }}
                    >
                      <span style={{ fontWeight: on ? 700 : 500 }}>{option.label}</span>
                      <span style={{ fontSize: 10, color: SW.muted, lineHeight: 1.6 }}>{option.note}</span>
                    </button>
                  );
                })}
                {validityKind === "until" && (
                  <label style={{ display: "grid", gridTemplateColumns: "36px minmax(0,1fr)", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 10, color: SW.muted }}>{ar ? "حتى" : "Until"}</span>
                    <PlatformDateField
                      compact
                      ar={ar}
                      value={schedule?.validUntil || ""}
                      onChange={(next) => { setWeekValidity(companyId, stationId, "until", next); refresh?.(); }}
                    />
                  </label>
                )}
                <span style={{ fontSize: 11, color: SW.mid, lineHeight: 1.8 }}>{weekValidityNote(schedule, weekStart, ar)}</span>
              </div>
            )}
          </section>

          <section style={{ ...slab, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${SW.soft}` }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "حصيلة الأسبوع" : "Week total"}</span>
            </div>
            {[
              [ar ? "ساعات مجدولة" : "Scheduled hours", String(gates.totalHours), ar ? "مجموع الأسبوع" : "Week sum", SW.ink],
              [ar ? "تعيينات" : "Assignments", String(gates.assigned), ar ? "خلية غير «راحة»" : "Non-rest cells", SW.ink],
              [ar ? "أيام بلا صباحي" : "Days without morning", String(gates.uncovered.length), gates.uncovered.length ? (ar ? "تمنع النشر" : "Blocks publish") : (ar ? "التغطية مكتملة" : "Coverage complete"), gates.uncovered.length ? SW.abs : SW.green],
              [ar ? "تجاوز السقف" : "Over the cap", String(gates.overCap.length), ar ? "أكثر من 48 ساعة" : "Over 48 hours", gates.overCap.length ? SW.abs : SW.green],
              [ar ? "أيام إجازة معتمدة" : "Approved leave days", String(gates.leaveDays || 0), gates.leaveDays ? (ar ? "من طلباتي · خارج حساب الساعات" : "From My Requests · outside hours") : (ar ? "لا إجازات هذا الأسبوع" : "No leave this week"), gates.leaveDays ? "#6b5730" : SW.green],
            ].map(([label, value, note, color]) => (
              <div key={label} style={{ padding: "12px 18px", borderBottom: `1px solid ${SW.row}`, display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, alignItems: "baseline" }}>
                <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
                  <span style={{ fontSize: 10, color: SW.muted, lineHeight: 1.7 }}>{note}</span>
                </span>
                <span dir="ltr" style={{ ...mono, fontSize: 17, color }}>{value}</span>
              </div>
            ))}
            <div style={{ padding: "12px 18px" }}>
              <span style={{ fontSize: 11, color: SW.mid, lineHeight: 1.85 }}>
                {blockers
                  ? (ar ? `النشر متوقّف: ${gates.blockers.map((row) => row.title).join("، ")}.` : `Publish is stopped: ${gates.blockers.map((row) => row.title).join(", ")}.`)
                  : published
                    ? (ar ? "الجدول منشور — التقويم التشغيلي يحسب التأخير والغياب منه." : "Published — the operational calendar measures lateness and absence from it.")
                    : (ar ? "لا موانع. انشر ليصبح هذا الجدول مصدر الوقت للأسبوع." : "No blockers. Publish to make this week the clock.")}
              </span>
            </div>
          </section>
          </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
