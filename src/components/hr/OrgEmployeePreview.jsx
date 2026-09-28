import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import HrServesPanel from "@/components/hr/HrServesPanel";
import {
  CONTRACT_TYPE_OPTIONS,
  ID_TYPE_OPTIONS,
  isFixedContractType,
  optionLabel,
  profileFieldValue,
} from "@/lib/employeeProfileFields";
import { serviceLabel } from "@/lib/employeeFileView";
import { citeRule, formatRuleFigure, ruleValue } from "@/lib/laborRules";
import { isHoursExempt108, isJuvenile, ordinaryDayCap, ordinaryWeekCap } from "@/lib/laborHoursPolicy";
import { annualBalanceSplit } from "@/lib/leaveTypes";
import { leaveRequestsForEmployeeId } from "@/lib/leaveDerivations";
import {
  activeActingAssignments,
  createVacantSeatsUnderManager,
  cycleSeatAccess,
  endSeatTenure,
  findEmployeeByName,
  jobTitleCatalog,
  occupantTitle,
  placeExistingEmployee,
  SEAT_ACCESS_ROWS,
  seatAccessOf,
  seatDrawerReason,
  seatForEmployee,
  setActingAssignment,
  setActualWorkSite,
} from "@/lib/orgHire";
import { assignHolderGrade, employeeJobGrade, gradeRank, gradeSalaryRange, gradesForTitle, ladderBands, orderedJobGrades } from "@/lib/jobGrades";
import { orgGradeColor, OrgLockMark } from "@/components/hr/orgUi";
import { buildPeopleTree, explainWorkplaceManager, pathToPerson } from "@/lib/peopleTree";
import { isCompanyRootStation, isHrUnit, isManagerUnit, stationParentId, workplaceStations } from "@/lib/stationTree";
import { useAuth } from "@/lib/PowerCareAuth";
import {
  employeeFileLaborWeek,
  employeeShiftOnDay,
  employeeWeekHours,
  employeeWorkStationId,
  findStationById,
  stationDisplayName,
  weekDateKeys,
  weekStartDate,
} from "@/lib/shiftWeek";
import { laborCalendarOf } from "@/lib/ummAlQuraCalendar";

const MONO = {
  fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
  direction: "ltr",
  unicodeBidi: "isolate",
};

const FIELD_INPUT = {
  height: 34,
  padding: "0 10px",
  borderRadius: 8,
  border: "1px solid var(--nv-line)",
  fontSize: 12,
  color: "var(--nv-ink)",
  outline: "none",
  background: "var(--nv-card)",
  fontFamily: "inherit",
  width: "100%",
  boxSizing: "border-box",
};

const NOTE = {
  fontSize: 11,
  color: "var(--nv-ink2)",
  background: "var(--nv-hover)",
  border: "1px solid var(--nv-line)",
  padding: "9px 11px",
  borderRadius: 12,
  lineHeight: 1.8,
};

function gradeChipStyle(color = "var(--nv-ink2)") {
  return {
    display: "inline-flex",
    alignItems: "center",
    height: 20,
    padding: "0 7px",
    borderRadius: 5,
    font: "700 10.5px 'Readex Pro', sans-serif",
    color: "#fff",
    background: color,
    flex: "none",
  };
}

function dash(value) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function isoDate(value) {
  const key = String(value || "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : "";
}

function todayKey() {
  const day = new Date();
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

function plusDays(count) {
  const day = new Date();
  day.setDate(day.getDate() + count);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

function dayFigure(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

function hourFigure(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function jobNumberOf(employee) {
  const profile = employee?.profile || {};
  const tagged = [employee?.employeeNo, profile.employeeNo, profile.employeeNumber, employee?.employeeNumber]
    .map((item) => String(item || "").trim())
    .find(Boolean);
  if (tagged) return tagged;
  const alt = String(profile.employeeId || employee?.employeeId || "").trim();
  const internal = String(employee?.id || "").trim();
  if (alt && alt !== internal) return alt;
  return "";
}

function reportingStationId(data, employee) {
  const seat = seatForEmployee(data, employee?.id);
  return String(seat?.stationId || employee?.stationId || employee?.profile?.stationId || "").trim();
}

function stationByWalk(data, stationId) {
  return findStationById(data?.stations || [], stationId);
}

function affiliationName(data, employee) {
  const homeId = reportingStationId(data, employee);
  if (!homeId) return "";
  const byId = new Map((data?.stations || []).map((station) => [String(station.id), station]));
  let cursor = byId.get(String(homeId));
  const seen = new Set();
  while (cursor && !seen.has(String(cursor.id))) {
    seen.add(String(cursor.id));
    if (!isManagerUnit(cursor)) return stationDisplayName(cursor);
    const parentId = stationParentId(cursor);
    cursor = parentId ? byId.get(String(parentId)) : null;
  }
  return stationDisplayName(stationByWalk(data, homeId));
}

function titleChain(data, employee, ar) {
  const tree = buildPeopleTree(data);
  const path = pathToPerson(tree?.roots, employee?.id) || [];
  const titles = path.map((node) => String(node.job || "").trim()).filter(Boolean);
  if (titles.length) return titles.join(" ← ");
  return occupantTitle(employee, data, ar);
}

function managerLine(data, employee, ar) {
  const seat = seatForEmployee(data, employee.id);
  const managerId = String(seat?.reportsToEmployeeId || employee?.profile?.directManagerId || "").trim();
  if (managerId && managerId === String(employee.id)) return "";
  const named = String(seat?.reportsToName || "").trim();
  if (!managerId) return named;
  const hit = (data?.employees || []).find((item) => String(item.id) === managerId);
  if (!hit) return named;
  const title = occupantTitle(hit, data, ar);
  return [hit.name, title].filter(Boolean).join(" · ");
}

function scheduleFor(data, employee) {
  const stationId = employeeWorkStationId(employee);
  return (data?.schedules || []).find((row) => String(row.stationId) === String(stationId))
    || { shiftTypes: [], assignments: {} };
}

function personHasWeekDuty(schedule, employeeId, weekStart) {
  if (!employeeId) return false;
  return weekDateKeys(weekStart).some((key) => employeeShiftOnDay(schedule, employeeId, key));
}

function scheduleConstraints(employee, data, onDate, laborCalendar, ar) {
  const company = data;
  const exempt = isHoursExempt108(employee, company);
  const dayCap = exempt
    ? ruleValue("hours.shift.ordinaryHours", onDate)
    : ordinaryDayCap(employee, company, onDate, laborCalendar);
  const weekCap = exempt
    ? ruleValue("hours.week.ordinaryMaxHours", onDate)
    : ordinaryWeekCap(employee, company, onDate, laborCalendar);
  const cite = citeRule("hours.week.ordinaryMaxHours", onDate);
  const rows = [{
    src: ar ? (cite?.labelAr || "") : (cite?.labelEn || ""),
    text: ar
      ? `${formatRuleFigure(dayCap, "hours", true)} يومياً أو ${weekCap} أسبوعياً`
      : `${dayCap} hours a day or ${weekCap} a week`,
    effect: ar ? "يُفحص على الأسبوع المنشور" : "Checked on the published week",
  }];
  if (isJuvenile(employee, onDate)) {
    const juvenile = citeRule("hours.juvenile.ordinaryHours", onDate);
    const juvenileDay = ruleValue("hours.juvenile.ordinaryHours", onDate);
    rows.push({
      src: ar ? (juvenile?.labelAr || "") : (juvenile?.labelEn || ""),
      text: ar
        ? `${formatRuleFigure(juvenileDay, "hours", true)} يومياً للحدث`
        : `${juvenileDay} hours a day for a juvenile`,
      effect: ar ? "يُفحص على الأسبوع المنشور" : "Checked on the published week",
    });
  }
  return rows.filter((row) => row.src || row.text);
}

function statutoryClass(employee, data, onDate, ar) {
  if (isJuvenile(employee, onDate)) {
    const cite = citeRule("hours.juvenile.maxAgeYears", onDate);
    const label = ar ? cite?.labelAr : cite?.labelEn;
    return label ? `${label} · ${ar ? "فئة حدث" : "juvenile class"}` : "";
  }
  if (isHoursExempt108(employee, data)) {
    const cite = citeRule("hours.art108.cite", onDate);
    const label = ar ? cite?.labelAr : cite?.labelEn;
    return label ? `${label} · ${ar ? "فئة مستثناة" : "exempt class"}` : "";
  }
  return "";
}

function hirePhrase(iso, ar) {
  const match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";
  if (!ar) return `${match[1]}-${match[2]}-${match[3]}`;
  const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  return `${Number(match[3])} ${months[Number(match[2]) - 1] || ""} ${match[1]}`.trim();
}

function occupancyRows(data, employee, ar) {
  const today = isoDate(new Date().toISOString()) || new Date().toISOString().slice(0, 10);
  const seat = seatForEmployee(data, employee.id);
  const hire = isoDate(employee?.profile?.hireDate || employee?.hireDate || employee?.startDate);
  const filled = isoDate(seat?.filledAt);
  const rows = [];
  if (employee?.name) {
    const when = hirePhrase(hire || filled, ar);
    rows.push({
      name: employee.name,
      type: ar ? (when ? `دائم · عُيّن ${when}` : "دائم") : (when ? `Permanent · hired ${when}` : "Permanent"),
      acting: false,
      from: hire || filled,
      to: "",
      current: true,
    });
  }
  (data?.employees || []).forEach((person) => {
    (person?.actingAssignments || []).forEach((item) => {
      const onSeat = seat?.id && String(item.seatId || "") === String(seat.id);
      if (!onSeat) return;
      const until = isoDate(item.until);
      const ended = isoDate(item.endedAt);
      const current = !item.endedAt && (!until || until >= today);
      const from = isoDate(item.from || item.createdAt);
      const when = hirePhrase(from, ar);
      rows.push({
        name: person.name || "",
        type: ar ? (when ? `تكليف · عُيّن ${when}` : "تكليف") : (when ? `Acting · from ${when}` : "Acting"),
        acting: true,
        from,
        to: ended || until,
        current,
      });
    });
  });
  return rows
    .filter((row) => row.name)
    .sort((a, b) => {
      if (a.current !== b.current) return a.current ? -1 : 1;
      return String(b.from || "").localeCompare(String(a.from || ""));
    });
}

function hoursAndStatus(employee, data, onDate, laborCalendar, ar) {
  const schedule = scheduleFor(data, employee);
  const weekStart = weekStartDate(onDate);
  const hasDuty = personHasWeekDuty(schedule, employee.id, weekStart);
  const exempt = isHoursExempt108(employee, data);
  if (!hasDuty) return { hours: "", status: "" };
  const station = stationByWalk(data, employeeWorkStationId(employee));
  let pack = null;
  try {
    pack = employeeFileLaborWeek({
      employee,
      schedule,
      weekStart,
      ar,
      station,
      settings: data?.settings,
      company: data,
      laborCalendar,
      today: onDate,
    });
  } catch {
    pack = null;
  }
  const cap = ordinaryWeekCap(employee, data, onDate, laborCalendar);
  const worked = pack?.hours ?? employeeWeekHours(schedule, employee.id, weekStart, employee, laborCalendar);
  const workedText = hourFigure(worked);
  const capText = dayFigure(cap);
  const hours = !exempt && workedText && capText ? `${workedText} / ${capText}` : "";
  let status = "";
  if (pack?.blockers?.length) status = ar ? "مانع قائم" : "Blocker";
  else if (pack?.warnings?.length) status = ar ? "تنبيه" : "Notice";
  else if (pack && !exempt) status = ar ? "مستوفٍ" : "In order";
  return { hours, status };
}

function leaveFraction(employee, data, onDate) {
  const profile = employee?.profile || {};
  if (!isoDate(profile.hireDate || employee?.hireDate || employee?.startDate)) return "";
  const requests = leaveRequestsForEmployeeId(employee.id, { entity: employee, roster: data?.leaveRoster || [] });
  const split = annualBalanceSplit(profile, requests, onDate);
  if (split.currentTotal == null) return "";
  const left = dayFigure(split.currentLeft);
  const total = dayFigure(split.currentTotal);
  if (!left || !total) return "";
  return `${left} / ${total}`;
}

function contractLine(employee, ar) {
  const profile = employee?.profile || {};
  const raw = profileFieldValue(profile, "contractType", employee);
  const label = optionLabel(CONTRACT_TYPE_OPTIONS, raw, ar) || "";
  if (!label) return "";
  const end = isoDate(profile.contractEndDate || profile.contract?.endDate);
  if (isFixedContractType(raw) && end) return `${label} · ${ar ? "حتى" : "until"} ${end}`;
  return label;
}

function liveGrade(employee, data) {
  const seat = seatForEmployee(data, employee?.id);
  const gradeId = seat?.gradeId || employee?.profile?.gradeId;
  const listed = (data?.jobGrades || []).find((item) => gradeId && String(item.id) === String(gradeId));
  return listed || employeeJobGrade(employee, data) || null;
}

function gradeLeaveDays(grade) {
  const raw = grade?.annualLeaveDays ?? grade?.leaveDays ?? grade?.annualDays;
  const days = Number(raw);
  return Number.isFinite(days) && days > 0 ? days : null;
}

function branchCodeOf(data, employee) {
  const homeId = reportingStationId(data, employee);
  if (!homeId) return "";
  const byId = new Map((data?.stations || []).map((station) => [String(station.id), station]));
  let cursor = byId.get(String(homeId));
  const seen = new Set();
  while (cursor && !seen.has(String(cursor.id))) {
    seen.add(String(cursor.id));
    if (!isManagerUnit(cursor)) {
      const code = String(cursor.code || "").trim();
      return code;
    }
    const parentId = stationParentId(cursor);
    cursor = parentId ? byId.get(String(parentId)) : null;
  }
  return String(stationByWalk(data, homeId)?.code || "").trim();
}

function gradeView(employee, data, ar) {
  const seat = seatForEmployee(data, employee?.id);
  const grades = orderedJobGrades(data);
  const grade = liveGrade(employee, data);
  const index = grades.findIndex((item) => grade && String(item.id) === String(grade.id));
  if (!grade) return { chip: "", label: "", range: "", leave: "", index: -1, id: "" };
  const chip = String(grade.gradeNumber || "").trim();
  const label = String((ar ? grade.title : (grade.titleEn || grade.title)) || "").trim();
  const range = gradeSalaryRange(grade);
  const min = range.min ?? (Number(seat?.salaryMin) > 0 ? Number(seat.salaryMin) : null);
  const max = range.max ?? (Number(seat?.salaryMax) > 0 ? Number(seat.salaryMax) : null);
  const money = min != null && max != null
    ? `${Number(min).toLocaleString("en-US")}–${Number(max).toLocaleString("en-US")} SAR`
    : "";
  const leaveDays = gradeLeaveDays(grade);
  const leave = leaveDays == null
    ? ""
    : (ar ? `إجازة ${dayFigure(leaveDays)} يوماً` : `${dayFigure(leaveDays)} days leave`);
  return { chip, label, range: money, leave, index, id: grade.id };
}

function actualWorkplace(data, employee, affiliation, ar) {
  const acting = activeActingAssignments(employee).find((item) => {
    const home = employeeWorkStationId(employee);
    return item?.stationId && String(item.stationId) !== String(home || "");
  });
  const place = explainWorkplaceManager(data, employee.id, { ar });
  const homeName = stationDisplayName(stationByWalk(data, employeeWorkStationId(employee)));
  const actingName = acting ? stationDisplayName(stationByWalk(data, acting.stationId)) : "";
  const name = actingName || place?.homeName || homeName;
  const differs = Boolean(name && affiliation && name !== affiliation);
  return {
    name,
    differs,
  };
}

function derivePersonPanel(employee, data, ar) {
  const onDate = new Date();
  const laborCalendar = laborCalendarOf(data);
  const profile = employee?.profile || {};
  const title = occupantTitle(employee, data, ar);
  const acting = activeActingAssignments(employee)[0];
  const actingUntil = isoDate(acting?.until);
  const name = String(employee?.name || "").trim();
  const sub = acting
    ? `${name} · ${ar ? "مكلَّف حتى" : "Acting until"} ${actingUntil || "—"}`
    : name;
  const idType = profileFieldValue(profile, "idType", employee);
  const idLabel = optionLabel(ID_TYPE_OPTIONS, idType, ar) || (ar ? "الهوية" : "ID");
  const affiliation = affiliationName(data, employee);
  const site = actualWorkplace(data, employee, affiliation, ar);
  const grade = gradeView(employee, data, ar);
  const unitCode = branchCodeOf(data, employee);
  const hire = isoDate(profile.hireDate || employee?.hireDate || employee?.startDate);
  const weekCite = citeRule("hours.week.ordinaryMaxHours", onDate);
  const article = weekCite?.article ? ` · ${weekCite.article}` : "";
  const measured = hoursAndStatus(employee, data, onDate, laborCalendar, ar);
  const history = occupancyRows(data, employee, ar);
  const since = history.find((row) => row.current && !row.acting)?.from
    || history.find((row) => row.current)?.from
    || hire;
  return {
    title,
    sub,
    chain: titleChain(data, employee, ar),
    fields: [
      { label: ar ? "الشاغل الآن" : "Current holder", value: name, strong: true },
      {
        label: ar ? "الرقم الوظيفي" : "Employee no.",
        kind: "empNo",
        value: jobNumberOf(employee),
        unit: unitCode,
        chip: grade.chip,
        gradeIndex: grade.index,
      },
      { label: ar ? "المدير المباشر" : "Direct manager", value: managerLine(data, employee, ar) },
      {
        label: ar ? "الدرجة" : "Grade",
        kind: "grade",
        chip: grade.chip,
        gradeLabel: grade.label,
        range: grade.range,
        leave: grade.leave,
        gradeIndex: grade.index,
      },
      { label: ar ? "الفرع (بالتبعية)" : "Branch (reporting)", value: affiliation, strong: true },
      {
        label: ar ? "مكان العمل الفعلي" : "Actual workplace",
        value: site.name
          ? `${site.name}${site.differs ? (ar ? " · مختلف عن التبعية" : " · differs from reporting") : ""}`
          : "",
        warn: site.differs,
      },
      { label: ar ? "العقد" : "Contract", value: contractLine(employee, ar) },
      { label: ar ? "الجنسية" : "Nationality", value: String(profile.nationality || employee?.nationality || "").trim() },
      { label: idLabel, value: String(profile.nationalId || employee?.nationalId || "").trim(), mono: true },
      { label: ar ? "تاريخ التعيين" : "Hire date", value: hire, mono: true },
      { label: ar ? "مدة الخدمة" : "Length of service", value: hire ? serviceLabel(hire, ar) : "" },
      { label: ar ? `ساعات الأسبوع${article}` : `Week hours${article}`, value: measured.hours, mono: true },
      { label: ar ? "الإجازة السنوية" : "Annual leave", value: leaveFraction(employee, data, onDate), mono: true },
      { label: ar ? "حالة الالتزام" : "Compliance", value: measured.status },
      { label: ar ? "الفئة النظامية" : "Statutory class", value: statutoryClass(employee, data, onDate, ar) },
      { label: ar ? "منذ" : "Since", value: since, mono: true },
    ],
    rules: scheduleConstraints(employee, data, onDate, laborCalendar, ar),
    history,
  };
}

function FactValue({ field }) {
  if (field.kind === "empNo") {
  return (
      <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", minWidth: 0 }}>
        <strong style={{ ...MONO, fontSize: 13 }}>{dash(field.value)}</strong>
        {field.unit ? (
          <span style={{ ...MONO, fontSize: 10.5, color: "var(--nv-ink3)" }}>{`· ${field.unit} ·`}</span>
        ) : null}
        {field.chip ? <span style={gradeChipStyle(orgGradeColor(field.gradeIndex))}>{field.chip}</span> : null}
      </span>
    );
  }
  if (field.kind === "grade") {
    if (!field.chip && !field.gradeLabel && !field.range && !field.leave) {
      return <span style={{ color: "var(--nv-ink3)" }}>—</span>;
    }
    return (
      <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", minWidth: 0 }}>
        {field.chip ? <span style={gradeChipStyle(orgGradeColor(field.gradeIndex))}>{field.chip}</span> : null}
        {field.gradeLabel ? <span style={{ fontSize: 11, color: "var(--nv-ink3)" }}>{field.gradeLabel}</span> : null}
        {field.range ? <span style={{ ...MONO, fontSize: 11, color: "var(--nv-ink3)" }}>{field.range}</span> : null}
        {field.leave ? <span style={{ fontSize: 11, color: "var(--nv-ink3)" }}>{field.leave}</span> : null}
      </span>
    );
  }
  return (
    <span
      dir={field.mono && field.value ? "ltr" : undefined}
        style={{
        minWidth: 0,
        fontWeight: field.strong && field.value ? 700 : 400,
        color: field.warn ? "var(--nv-warn-ink)" : "var(--nv-ink)",
        ...(field.mono && field.value ? MONO : null),
      }}
    >
      {dash(field.value)}
    </span>
  );
}

function FactGrid({ fields }) {
  return (
    <div
        style={{
        display: "grid",
        gridTemplateColumns: "auto minmax(0,1fr)",
        gap: "9px 14px",
        alignItems: "center",
        padding: "12px 14px",
        border: "1px solid var(--nv-line, #E4E9E6)",
        background: "var(--nv-soft, #F5F7F6)",
        borderRadius: 10,
        fontSize: 12.5,
      }}
    >
      {fields.map((field) => (
        <div key={field.label} style={{ display: "contents" }}>
          <span style={{ color: "var(--nv-ink3)" }}>{field.label}</span>
          <FactValue field={field} />
        </div>
      ))}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <span style={{ fontSize: 10, letterSpacing: "0.14em", color: "var(--nv-ink3)", fontWeight: 600 }}>
      {children}
    </span>
  );
}

function tabButtonStyle(active) {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: 32,
    padding: 0,
    borderRadius: 8,
    boxSizing: "border-box",
    fontSize: 11.5,
          fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    ...(active
      ? { background: "var(--nv-navy)", color: "#fff", border: "1px solid var(--nv-navy)" }
      : { background: "var(--nv-card)", color: "var(--nv-ink2)", border: "1px solid var(--nv-line)" }),
  };
}

function actingError(code, ar) {
  if (code === "HOME") return ar ? "لا تكليف على فرع الموظف نفسه." : "Acting cannot be on the person's own branch.";
  if (code === "MISSING") return ar ? "المكلَّف غير موجود في السجل." : "That person is not on the roster.";
  return ar ? "تعذّر تسجيل التكليف." : "Could not record the acting assignment.";
}

function changeError(code, ar) {
  if (code === "SEAT_TAKEN") {
    return ar
      ? "المقعد مشغول. التعيين الحالي لا يستبدل شاغلاً قائماً."
      : "The seat is occupied. Placement does not replace the current holder.";
  }
  if (code === "MISSING") return ar ? "الشاغل الجديد غير موجود في السجل." : "That person is not on the roster.";
  if (code === "SEAT") return ar ? "لا مقعد حيّ لهذا الشاغل." : "This person has no live seat.";
  if (code === "ADMIN_NO_HIRE") return ar ? "المدير ليس مكان نقل." : "A manager unit is not a placement workplace.";
  if (code === "MANAGER_TAKEN") return ar ? "مدير الفرع معيّن مسبقاً." : "The branch already has a manager.";
  if (code === "EMPLOYEE_NO_TAKEN") return ar ? "الرقم الوظيفي مستخدم في هذه الشركة." : "That job number is already used in this company.";
  return ar ? "تعذّر تغيير الشاغل." : "Could not change the holder.";
}

function gradeOutOfOrder(employee, data) {
  const mine = liveGrade(employee, data);
  const mineRank = gradeRank(mine);
  if (mineRank == null) return false;
  const managerId = String(employee?.profile?.directManagerId || "");
  const manager = (data?.employees || []).find((item) => String(item.id) === managerId);
  const bossRank = gradeRank(manager ? liveGrade(manager, data) : null);
  if (bossRank != null && mineRank >= bossRank) return true;
  return (data?.employees || []).some((item) => {
    if (String(item.profile?.directManagerId || "") !== String(employee.id)) return false;
    const childRank = gradeRank(liveGrade(item, data));
    return childRank != null && childRank >= mineRank;
  });
}

function GradeSeatEditor({ employee, data, companyId, ar }) {
  const seat = seatForEmployee(data, employee?.id);
  const title = seat?.title || employee?.profile?.position || employee?.jobTitle || "";
  const grades = title ? gradesForTitle(data, title) : [];
  const current = liveGrade(employee, data);
  return (
    <>
      <SectionLabel>{ar ? "درجة الوظيفة" : "Seat grade"}</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", border: "1px solid var(--nv-line)", borderRadius: 12, fontSize: 11.5 }}>
        {grades.length ? (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {grades.map((grade, index) => {
              const on = current && String(current.id) === String(grade.id);
              return (
                <button
                  key={grade.id}
                  type="button"
                  onClick={() => assignHolderGrade(companyId, {
                    employeeId: employee.id,
                    seatId: seat?.id || "",
                    gradeId: grade.id,
                  })}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 28,
                    minWidth: 40,
                    padding: "0 8px",
                    borderRadius: 8,
                    font: "700 11.5px 'Readex Pro', sans-serif",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    ...(on
                      ? { color: "#fff", background: orgGradeColor(index), border: "1px solid transparent" }
                      : { color: "var(--nv-ink2)", background: "var(--nv-card)", border: "1px solid var(--nv-line)" }),
                  }}
                >
                  <span dir="ltr" style={{ unicodeBidi: "isolate" }}>{grade.gradeNumber || "—"}</span>
                </button>
              );
            })}
      </div>
        ) : (
          <span style={{ fontSize: 11, color: "var(--nv-ink3)" }}>
            {title
              ? (ar ? "هذا المسمّى بلا درجات على سلّمه." : "This title has no grades on its ladder.")
              : (ar ? "لا مسمّى على هذه الوظيفة بعد." : "This seat has no title yet.")}
          </span>
        )}
        {gradeOutOfOrder(employee, data) ? (
          <span style={{ fontSize: 11, color: "var(--nv-bad-ink)", background: "var(--nv-bad-soft)", border: "1px solid var(--nv-bad-line)", borderRadius: 8, padding: "7px 9px" }}>
            {ar
              ? "تنبيه: الدرجة تساوي أو تتجاوز درجة المدير المباشر، أو توجد وظيفة تابعة بدرجة مساوية أو أعلى."
              : "The grade matches or exceeds the manager, or a report holds an equal or higher grade."}
          </span>
        ) : null}
        <span style={{ fontSize: 10.5, color: "var(--nv-ink3)" }}>
          {ar
            ? "تغيير الدرجة يسري على شاغل الوظيفة ومن يشغلها لاحقاً، ويُسجَّل في سجل الأحداث."
            : "Changing the grade applies to the current holder and whoever fills the seat next."}
        </span>
    </div>
    </>
  );
}

function hrUnit(station) {
  return isHrUnit(station);
}

function managedBy(data, employeeId) {
  return (data?.stations || []).filter((station) => String(station.managerId || "") === String(employeeId || ""));
}

function accessPill(value) {
  if (value === "manage") return { background: "var(--nv-ok-ink)", color: "#fff", border: "1px solid var(--nv-ok-ink)" };
  if (value === "hidden") return { background: "var(--nv-soft)", color: "var(--nv-bad-ink)", border: "1px solid var(--nv-bad-line)" };
  return { background: "var(--nv-card)", color: "var(--nv-ink2)", border: "1px solid var(--nv-line)" };
}

function accessWord(value, ar) {
  if (value === "manage") return ar ? "إدارة" : "Manage";
  if (value === "hidden") return ar ? "بلا وصول" : "No access";
  return ar ? "عرض" : "View";
}

function titleChipStyle(on) {
  return {
    display: "inline-flex",
    alignItems: "center",
    height: 26,
    padding: "0 10px",
    borderRadius: 899,
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    border: on ? "1px solid var(--nv-navy)" : "1px solid var(--nv-line)",
    background: on ? "var(--nv-navy)" : "var(--nv-card)",
    color: on ? "#fff" : "var(--nv-ink2)",
  };
}

/** الملف tab, under occupancy — vacate, child seat, site, and seat access. */
function ManagerSeatActions({ employee, data, companyId, ar, ownerMode, onVacated, onOpenBranch }) {
  const seat = seatForEmployee(data, employee?.id);
  const catalog = jobTitleCatalog(data);
  const managerGradeId = String(seat?.gradeId || employee?.profile?.gradeId || "");
  const managerRank = gradeRank((data?.jobGrades || []).find((grade) => String(grade.id) === managerGradeId));
  const [title, setTitle] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [qty, setQty] = useState(1);
  const [err, setErr] = useState("");
  const access = seatAccessOf(data, employee);
  const titleGrades = gradesForTitle(data, title);
  const gradeKey = titleGrades.map((grade) => grade.id).join("|");

  useEffect(() => {
    setTitle("");
    setQty(1);
    setErr("");
    setGradeId("");
  }, [employee?.id]);

  useEffect(() => {
    const allowed = titleGrades.filter((grade) => {
      const rank = gradeRank(grade);
      return managerRank == null || rank == null || rank < managerRank;
    });
    const pick = allowed[0];
    setGradeId(String(pick?.id || ""));
  }, [employee?.id, title, managerRank, gradeKey]);

  const query = title.trim();
  const chips = catalog.filter((item) => !query || item.includes(query)).slice(0, 14);
  const fresh = Boolean(query) && !catalog.some((item) => item === query);
  const managed = managedBy(data, employee?.id);
  const branch = managed.find((station) => !isCompanyRootStation(station) && !hrUnit(station)) || null;
  const locked = managed.find((station) => hrUnit(station)) || managed.find((station) => isCompanyRootStation(station)) || null;
  const affiliation = affiliationName(data, employee);
  const workId = String(employee?.profile?.workStationId || "");
  const sites = workplaceStations(data?.stations || []);
  const bands = ladderBands(data);
  const chosen = titleGrades.find((grade) => String(grade.id) === String(gradeId)) || null;
  const codeMatch = String(chosen?.gradeNumber || bands[0]?.gradeNumber || "").match(/^(.*?)(\d+)\s*$/);
  const codePrefix = codeMatch ? (codeMatch[1] || "م") : "م";
  const addLabel = qty === 2
    ? (ar ? "إنشاء وظيفتين شاغرتين" : "Create two vacant seats")
    : qty > 10
      ? (ar ? `إنشاء ${qty} وظيفة شاغرة` : `Create ${qty} vacant seats`)
      : qty > 1
        ? (ar ? `إنشاء ${qty} وظائف شاغرة` : `Create ${qty} vacant seats`)
        : (ar ? "إنشاء المنصب" : "Create the seat");
  const showReason = (result) => {
    setErr((ar ? result?.reason : result?.reasonEn) || seatDrawerReason(result?.error, ar) || "");
  };

  const vacate = () => {
    if (!companyId) {
      setErr(ar ? "إخلاء المقعد لمن يدير الهيكل." : "Vacating is for someone who manages the org.");
      return;
    }
    const name = employee?.name || "—";
    const titleName = seat?.title || "—";
    const sure = window.confirm(ar
      ? `هل أنت متأكد؟ تُقفل فترة ${name} على ${titleName} اليوم وتصبح الوظيفة شاغرة.`
      : `End ${name} on ${titleName} today? The seat becomes vacant. Nobody is deleted.`);
    if (!sure) return;
    const result = endSeatTenure(companyId, employee.id);
    if (!result.ok) {
      showReason(result);
      return;
    }
    onVacated?.();
  };

  const createSeat = () => {
    if (!companyId) {
      setErr(ar ? "إنشاء المنصب لمن يدير الهيكل." : "Creating a seat is for someone who manages the org.");
      return;
    }
    const result = createVacantSeatsUnderManager(companyId, {
      managerId: employee.id,
      title,
      gradeId,
      qty,
    });
    if (!result.ok) {
      showReason(result);
      return;
    }
    setErr("");
    setTitle("");
    setQty(1);
  };

  const cycle = (row) => {
    if (!companyId) return;
    const result = cycleSeatAccess(companyId, employee.id, row.id, { owner: ownerMode });
    if (!result.ok) showReason(result);
    else setErr("");
  };

  const chooseSite = (value) => {
    if (!companyId) return;
    const result = setActualWorkSite(companyId, employee.id, value);
    if (!result.ok) showReason(result);
    else setErr("");
  };

  const gradeBlocked = (rank) => managerRank != null && rank != null && rank >= managerRank;

  const pickBand = (band) => {
    const match = titleGrades.find((grade) => gradeRank(grade) === band.rank);
    if (!title || !match || gradeBlocked(band.rank)) return;
    setErr("");
    setGradeId(match.id);
  };

  const typeRank = (raw) => {
    const digits = String(raw || "").replace(/[^0-9]/g, "");
    if (!digits) return;
    const rank = Number(digits);
    const match = titleGrades.find((grade) => gradeRank(grade) === rank);
    if (!title || !match || gradeBlocked(rank)) {
      setErr(gradeBlocked(rank)
        ? (ar ? `الدرجة م${rank} تساوي درجة المدير أو أعلى منها` : `Grade M${rank} is equal to or above the manager.`)
        : (ar ? `م${rank} خارج مراتب مسار «${title || "—"}»` : `M${rank} is outside the «${title || "—"}» path.`));
      return;
    }
    setErr("");
    setGradeId(match.id);
  };

  return (
    <>
      <button
        type="button"
        onClick={vacate}
      style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: 34,
          borderRadius: 10,
          border: "1px solid #EDC5CB",
          background: "transparent",
          color: "var(--nv-bad-ink)",
          fontSize: 12,
        fontWeight: 600,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        {ar ? "إنهاء شغل الوظيفة اليوم — تصبح شاغرة" : "End the seat today — it becomes vacant"}
      </button>
      <SectionLabel>{ar ? "منصب جديد تحت هذه الوظيفة" : "New seat under this job"}</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", border: "1px solid var(--nv-line)", borderRadius: 8, background: "var(--nv-card)", overflow: "hidden", fontSize: 11.5 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 12, borderBottom: "1px solid var(--nv-line3)" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, fontSize: 11, color: "var(--nv-ink2)", fontWeight: 700 }}>
            <span>{ar ? "1 · المسمّى الوظيفي" : "1 · Job title"}</span>
            <span style={{ fontWeight: 500, color: "#8E9A93" }}>{ar ? "من الدليل أو جديد" : "Catalog or new"}</span>
          </div>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={ar ? "⌕ ابحث في الدليل أو اكتب مسمّى جديداً" : "⌕ Search the catalog or type a new title"}
            style={FIELD_INPUT}
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(118px, 1fr))", gap: 4, maxHeight: 112, overflow: "auto", padding: 2 }}>
            {chips.length ? chips.map((item) => (
              <button key={item} type="button" onClick={() => setTitle(item)} style={{ ...titleChipStyle(title === item), justifyContent: "center" }}>
                {item}
              </button>
            )) : (
              <span style={{ fontSize: 11, color: "var(--nv-ink3)", gridColumn: "1 / -1" }}>{ar ? "الدليل فارغ. اكتب مسمّى لإضافته." : "The catalog is empty. Type a title to add it."}</span>
            )}
          </div>
          {fresh ? (
            <span style={{ fontSize: 10.5, color: "var(--nv-ok-ink)" }}>
              {ar ? "مسمّى جديد — يُضاف إلى دليل المسميات عند الإنشاء." : "New title — it joins the catalog when the seat is created."}
            </span>
          ) : null}
        </div>
        {title && titleGrades.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 12px 0" }}>
            <span style={{ fontSize: 11, color: "var(--nv-ink2)", fontWeight: 700 }}>{ar ? "المرتبة في المسار" : "Rank on the track"}</span>
            {titleGrades.map((grade) => {
              const on = String(grade.id) === String(gradeId);
              const rank = gradeRank(grade);
              const dim = gradeBlocked(rank);
              const meta = [grade.experience, grade.requirement, dim ? (ar ? "أعلى من درجة المدير" : "At or above the manager") : ""].filter(Boolean).join(" · ");
              return (
                <button
                  key={grade.id}
                  type="button"
                  disabled={dim}
                  onClick={() => { if (!dim) { setErr(""); setGradeId(grade.id); } }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 8px",
                    borderRadius: 5,
                    boxSizing: "border-box",
        textAlign: "start",
                    fontFamily: "inherit",
                    opacity: dim ? 0.45 : 1,
                    cursor: dim ? "not-allowed" : "pointer",
                    background: on && !dim ? "var(--nv-hover)" : "var(--nv-card)",
                    border: dim ? "1px dashed var(--nv-line)" : (on ? "1px solid var(--nv-navy)" : "1px solid var(--nv-line3)"),
                  }}
                >
                  <span dir="ltr" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 20, minWidth: 28, borderRadius: 4, font: "700 10px 'Readex Pro', sans-serif", color: "#fff", background: orgGradeColor(Math.max(0, (rank || 1) - 1)), unicodeBidi: "isolate" }}>{grade.gradeNumber || "—"}</span>
                  <strong style={{ fontSize: 12, flex: 1 }}>{grade.title || (ar ? "مرتبة" : "Rank")}</strong>
                  {meta ? <span style={{ fontSize: 10.5, color: "var(--nv-ink3)" }}>{meta}</span> : null}
                </button>
              );
            })}
    </div>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 12, borderBottom: "1px solid var(--nv-line3)" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, fontSize: 11, color: "var(--nv-ink2)", fontWeight: 700 }}>
            <span>{ar ? "2 · الدرجة" : "2 · Grade"}</span>
            <span style={{ fontWeight: 500, color: "#8E9A93" }}>{chosen?.title || (ar ? "من سلّم الدرجات" : "From the ladder")}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--nv-ink3)" }}>
            <span>{ar ? "رقم الدرجة" : "Grade no."}</span>
            <span style={{ display: "flex", alignItems: "center", border: "1px solid var(--nv-line)", borderRadius: 5, overflow: "hidden", height: 30, background: "var(--nv-card)" }}>
              <span style={{ padding: "0 7px", font: "700 11px 'Readex Pro', sans-serif", borderInlineEnd: "1px solid var(--nv-line3)", height: "100%", display: "inline-flex", alignItems: "center" }}>{codePrefix}</span>
              <input
                inputMode="numeric"
                value={chosen ? String(gradeRank(chosen) || "") : ""}
                onChange={(event) => typeRank(event.target.value)}
                style={{ width: 40, height: "100%", border: 0, outline: "none", textAlign: "center", font: "600 13px 'IBM Plex Mono', monospace", color: "var(--nv-ink)", background: "transparent" }}
              />
            </span>
            <span>{ar ? "أو اختر:" : "or pick:"}</span>
          </div>
          {bands.length ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
              {bands.map((band, index) => {
                const match = title ? titleGrades.find((grade) => gradeRank(grade) === band.rank) : null;
                const above = gradeBlocked(band.rank);
                const off = !title || !match || above;
                const on = Boolean(match) && String(match.id) === String(gradeId);
                const tip = above
                  ? (ar ? "مساوية لدرجة المدير أو أعلى" : "Equal to the manager or higher")
                  : (!match && title ? (ar ? "خارج نطاق هذا المنصب" : "Outside this title") : (band.level || band.gradeNumber));
                return (
                  <button
                    key={band.key}
                    type="button"
                    title={tip}
                    disabled={off}
                    onClick={() => pickBand(band)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: 30,
                      boxSizing: "border-box",
                      borderRadius: 4,
                      font: "700 11.5px 'Readex Pro', sans-serif",
                      fontFamily: "inherit",
                      ...(off
                        ? { cursor: "not-allowed", background: "var(--nv-soft)", color: "#C5CEC9", border: "1px dashed var(--nv-line)" }
                        : on
                          ? { cursor: "pointer", color: "#fff", background: orgGradeColor(index), border: "1px solid transparent" }
                          : { cursor: "pointer", color: "var(--nv-ink2)", background: "var(--nv-card)", border: "1px solid var(--nv-line)" }),
                    }}
                  >
                    <span dir="ltr" style={{ unicodeBidi: "isolate" }}>{band.gradeNumber || "—"}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <span style={{ fontSize: 11, color: "var(--nv-ink3)" }}>{ar ? "لا درجات على السلّم بعد. أضف درجة أعلى من سلّم الدرجات." : "No grades on the ladder yet. Add a higher grade on the ladder."}</span>
          )}
          {title && !titleGrades.length ? (
            <span style={{ fontSize: 11, color: "var(--nv-bad-ink)" }}>
              {ar ? "هذا المسمّى بلا درجات. أضفها من سلّم الدرجات." : "This title has no grades. Add them on the grade ladder."}
            </span>
          ) : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: 12, borderBottom: "1px solid var(--nv-line3)" }}>
          <span style={{ fontSize: 11, color: "var(--nv-ink2)", fontWeight: 700 }}>{ar ? "3 · عدد الوظائف" : "3 · Seat count"}</span>
          <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--nv-line)", borderRadius: 6, overflow: "hidden" }}>
            <button type="button" aria-label={ar ? "أقل" : "Fewer"} onClick={() => setQty((value) => Math.max(1, value - 1))} style={{ width: 32, height: 32, border: 0, background: "var(--nv-card)", cursor: "pointer", fontSize: 15, color: "var(--nv-ink)", fontFamily: "inherit" }}>−</button>
            <input
              type="number"
              min={1}
              max={20}
              value={qty}
              aria-label={ar ? "عدد الوظائف" : "Seat count"}
              onChange={(event) => setQty(Math.max(1, Math.min(20, Number(event.target.value) || 1)))}
              style={{ width: 44, height: 32, border: 0, borderInline: "1px solid var(--nv-line)", font: "600 13px 'IBM Plex Mono', monospace", textAlign: "center", color: "var(--nv-ink)", outline: "none", boxSizing: "border-box" }}
            />
            <button type="button" aria-label={ar ? "أكثر" : "More"} onClick={() => setQty((value) => Math.min(20, value + 1))} style={{ width: 32, height: 32, border: 0, background: "var(--nv-card)", cursor: "pointer", fontSize: 15, color: "var(--nv-ink)", fontFamily: "inherit" }}>+</button>
          </div>
        </div>
        <div style={{ padding: 12 }}>
          <button
            type="button"
            onClick={createSeat}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: 38,
              borderRadius: 6,
              background: "var(--nv-navy, #0B3D27)",
              color: "#fff",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              border: 0,
              fontFamily: "inherit",
            }}
          >
            {addLabel}
          </button>
        </div>
      </div>
      <FormError text={err} />
      {locked ? (
        <div style={{ border: "1px solid var(--nv-line, #D5DCD8)", background: "var(--nv-soft, #F2F5F3)", borderRadius: 10, padding: "12px 14px", fontSize: 12.5, lineHeight: 1.9, color: "var(--nv-ink, #1F242B)", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <OrgLockMark size={28} icon={15} />
          <span>
            {hrUnit(locked) ? (
              ar ? (
                <>
                  <strong>قسم الموارد البشرية (HR)</strong>
                  {" — وحدة ثابتة تتبع الرئيس التنفيذي: لا تُحذف ولا تُنقل ولا تتغيّر درجتها أو مسمّاها. يتغيّر الشاغل فقط (تغيير نهائي أو تكليف). في هذا القسم يُعيَّن "}
                  <strong>مدير موارد بشرية لكل فرع</strong>
                  {" أو مجموعة فروع، ويتبع مديرة الموارد البشرية."}
                </>
              ) : (
                <><strong>Human resources (HR)</strong>{" — a fixed unit under the CEO. Only the holder changes. A branch HR manager is appointed here and reports to the HR director."}</>
              )
            ) : (
              ar ? (
                <><strong>فرع المقر الرئيسي (HQ)</strong>{" — وحدة ثابتة في الهيكل: لا تُحذف ولا تُنقل ولا تتغيّر درجتها أو مسمّاها. يتغيّر الشاغل فقط (تغيير نهائي أو تكليف)."}</>
              ) : (
                <><strong>Headquarters (HQ)</strong>{" — a fixed unit. It is not deleted, moved, regraded, or renamed. Only the holder changes."}</>
              )
            )}
          </span>
        </div>
      ) : null}
      <GradeSeatEditor employee={employee} data={data} companyId={companyId} ar={ar} />
      {branch ? (
        <button
          type="button"
          onClick={() => onOpenBranch?.(branch.id)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: 34,
            borderRadius: 8,
            border: "1px solid var(--nv-line)",
            background: "var(--nv-card)",
            color: "var(--nv-ink)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {ar ? "إعدادات الفرع" : "Branch settings"}
        </button>
      ) : null}
      <>
          <SectionLabel>{ar ? "مكان العمل الفعلي" : "Actual workplace"}</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", border: "1px solid var(--nv-line)", borderRadius: 12, fontSize: 11.5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ color: "var(--nv-ink3)" }}>{ar ? "الفرع بالتبعية" : "Reporting branch"}</span>
              <strong>{affiliation || "—"}</strong>
            </div>
            <select
              value={workId}
              onChange={(event) => chooseSite(event.target.value)}
              style={{ height: 34, padding: "0 8px", borderRadius: 8, border: "1px solid var(--nv-line)", fontSize: 11.5, color: "var(--nv-ink)", background: "var(--nv-card)", fontFamily: "inherit" }}
            >
              <option value="">{ar ? `مطابق للتبعية — ${affiliation || "—"}` : `Same as reporting — ${affiliation || "—"}`}</option>
              {sites.map((station) => (
                <option key={station.id} value={station.id}>
                  {stationDisplayName(station)}
                  {station.code ? ` · ${station.code}` : ""}
                </option>
              ))}
            </select>
            <span style={{ fontSize: 10.5, color: "var(--nv-ink3)", lineHeight: 1.8 }}>
              {ar
                ? "يُضبط حين يعمل الموظف فعلياً في فرع غير فرع مديره (مثل أخصائي موارد بشرية في الرس يتبع المقر). مكان العمل يحدّد الحضور والجدول وموقع حظر الشمس، والتبعية تحدّد الاعتماد والتصعيد."
                : "Set when the person works at a branch other than their manager's (an HR specialist in Al-Rass can report to headquarters). The workplace drives attendance, the roster, and the heat-ban location. Reporting drives approval and escalation."}
            </span>
          </div>
      </>
      <SectionLabel>{ar ? "صلاحيات الإدارة — ما يديره صاحب هذه الوظيفة" : "Admin access — what this seat holder manages"}</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {SEAT_ACCESS_ROWS.map((row) => {
          const value = access[row.id] || "view";
          const lockedRow = Boolean(row.ownerOnly && !ownerMode);
  return (
            <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", border: "1px solid var(--nv-line)", borderRadius: 12 }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                <strong style={{ fontSize: 12 }}>{ar ? row.ar : row.en}</strong>
                <span style={{ fontSize: 10, color: "var(--nv-ink3)" }}>{ar ? row.hintAr : row.hintEn}</span>
              </div>
              <button
                type="button"
                disabled={lockedRow}
                onClick={() => cycle(row)}
      style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 76,
                  height: 28,
                  padding: "0 12px",
                  borderRadius: 899,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: lockedRow ? "default" : "pointer",
                  fontFamily: "inherit",
                  flex: "none",
                  ...accessPill(value),
                }}
              >
                {accessWord(value, ar)}
              </button>
            </div>
          );
        })}
      </div>
      <span style={{ fontSize: 10.5, color: "var(--nv-ink3)", lineHeight: 1.8 }}>
        {ar
          ? "«إدارة» تمنح الاعتماد والتعديل في القسم، و«عرض» تمنح القراءة فقط. الصلاحية على الوظيفة لا الشخص، فتنتقل إلى المكلَّف مدة تكليفه. طلباتي والحضور والجدول بوابة حضور واحدة، والجزاءات تُفتح مع الهيكل لأن لا منحة جزاءات مستقلة. كل تغيير يُسجَّل في سجل الأحداث."
          : "Manage grants approval and edits. View is read-only. The grant sits on the seat, follows an acting holder, and each change is logged."}
      </span>
    </>
  );
}

function FormError({ text }) {
  if (!text) return null;
  return (
    <div style={{ fontSize: 11, color: "var(--nv-bad-ink)", background: "var(--nv-bad-soft)", border: "1px solid var(--nv-bad-line)", padding: "8px 11px", borderRadius: 12 }}>
      {text}
    </div>
  );
}

/**
 * Person card on the workforce tree → side drawer.
 * الملف / تكليف / تغيير نهائي from workforce.dc.html.
 */
function VacantPositionDrawer({ node, data, ar, canWrite, companyId, onHire, onClose }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const station = (data?.stations || []).find((item) => String(item.id) === String(node?.stationId || ""));
  const locked = Boolean(node?.kindLock);
  const hrFixed = locked && (node?.hrPost === "director" || /HR|موارد/.test(String(node?.kindTag || "")));
  const grade = node?.grade || "—";
  const place = station?.name || "—";
  const rows = [
    [ar ? "الشاغل الآن" : "Holder", ar ? "شاغرة" : "Vacant"],
    [ar ? "الرقم الوظيفي" : "Employee no.", "—"],
    [ar ? "المسمّى" : "Title", node?.title || "—"],
    [ar ? "الدرجة" : "Grade", grade || "—"],
    [ar ? "الفرع" : "Branch", place],
    [ar ? "المدير المباشر" : "Manager", "—"],
  ];

  return createPortal(
    <div className="nv-v7-portal" dir={ar ? "rtl" : "ltr"} style={{ position: "fixed", inset: 0, zIndex: 480, display: "flex", justifyContent: "flex-end", alignItems: "stretch", padding: 12 }}>
      <div onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }} style={{ position: "absolute", inset: 0, background: "rgba(10,20,15,.28)" }} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={node?.title || (ar ? "وظيفة شاغرة" : "Vacant seat")}
        onMouseDown={(event) => event.stopPropagation()}
        style={{
          position: "relative",
          width: "min(94vw, 300px)",
          height: "100%",
          background: "var(--nv-card, #fff)",
          border: "1px solid var(--nv-line, #D5DCD8)",
          borderTop: "3px solid #0B3D27",
          borderRadius: 8,
          boxShadow: "0 18px 44px rgba(12,20,16,.18)",
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
        }}
      >
        <div style={{ padding: 14, borderBottom: "1px solid var(--nv-line, #E4E9E6)", display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ width: 44, height: 44, borderRadius: "50%", flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#B7791F", border: "1.5px dashed #D9C08A", background: "#fff" }}>＋</span>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            <strong style={{ fontSize: 14, color: "var(--nv-ink)" }}>{node?.title || "—"}</strong>
            <span style={{ fontSize: 11.5, color: "var(--nv-ink3)" }}>{ar ? "بانتظار التوظيف" : "Waiting to be filled"}</span>
          </div>
          <button type="button" onClick={onClose} aria-label={ar ? "إغلاق" : "Close"} style={{ width: 28, height: 28, border: "1px solid var(--nv-line, #D5DCD8)", borderRadius: 8, background: "var(--nv-card)", color: "var(--nv-ink)", cursor: "pointer", fontFamily: "inherit" }}>✕</button>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: "var(--nv-soft, #F5F7F6)", border: "1px solid var(--nv-line, #E4E9E6)", borderRadius: 10, padding: "12px 14px", display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: "9px 14px", fontSize: 12.5, alignItems: "center" }}>
            {rows.map(([label, value]) => (
              <React.Fragment key={label}>
                <span style={{ color: "var(--nv-ink3)" }}>{label}</span>
                <span style={{ color: "var(--nv-ink)", fontWeight: 600 }}>{value || "—"}</span>
              </React.Fragment>
            ))}
          </div>
          {hrFixed ? (
            <div style={{ border: "1px solid var(--nv-line, #D5DCD8)", background: "var(--nv-soft, #F2F5F3)", borderRadius: 10, padding: "12px 14px", fontSize: 12.5, lineHeight: 1.9, color: "var(--nv-ink)", display: "flex", gap: 10, alignItems: "flex-start" }}>
              <OrgLockMark size={28} icon={15} />
              <span>
                <strong>{ar ? "قسم الموارد البشرية (HR)" : "Human resources (HR)"}</strong>
                {ar
                  ? (
                    <>
                      {" — وحدة ثابتة تتبع الرئيس التنفيذي: لا تُحذف ولا تُنقل ولا تتغيّر درجتها أو مسمّاها. يتغيّر الشاغل فقط (تغيير نهائي أو تكليف). في هذا القسم يُعيَّن "}
                      <strong>مدير موارد بشرية لكل فرع</strong>
                      {" أو مجموعة فروع، ويتبع مديرة الموارد البشرية."}
                    </>
                  )
                  : " — a fixed unit under the CEO. Only the holder changes."}
              </span>
            </div>
          ) : null}
          <span style={{ fontSize: 11.5, color: "var(--nv-ink3)", lineHeight: 1.7 }}>{node?.coordinate || "\u00a0"}</span>
        </div>
        {canWrite && companyId ? (
          <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
            <button
              type="button"
              onClick={() => onHire?.({ stationId: node?.stationId || "", seatId: node?.seatId || "" })}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 34, borderRadius: 8, background: "#0B3D27", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid #0B3D27", fontFamily: "inherit" }}
            >
              {ar ? "توظيف على هذه الوظيفة" : "Hire into this seat"}
            </button>
          </div>
        ) : null}
      </aside>
    </div>,
    document.body,
  );
}

export default function OrgEmployeePreview({
  open,
  employee = null,
  data = null,
  ar = true,
  vacantHint = "",
  vacantNode = null,
  companyId = "",
  canWrite = false,
  onOpenBranch,
  onHire,
  onClose,
}) {
  const { currentUser } = useAuth();
  const ownerMode = Boolean(currentUser && (
    String(currentUser.id) === String(data?.ownerId || "")
    || currentUser.role === "owner"
    || currentUser.isOwner
  ));
  const [tab, setTab] = useState("profile");
  const [formErr, setFormErr] = useState("");
  const [act, setAct] = useState(() => ({ person: "", from: todayKey(), to: plusDays(30) }));
  const [chg, setChg] = useState(() => ({ person: "", from: todayKey() }));
  const live = useMemo(() => {
    if (!employee) return null;
    return (data?.employees || []).find((item) => String(item.id) === String(employee.id)) || employee;
  }, [employee, data]);

  useEffect(() => {
    if (!open) return;
    setTab("profile");
    setFormErr("");
    setAct({ person: "", from: todayKey(), to: plusDays(30) });
    setChg({ person: "", from: todayKey() });
  }, [open, live?.id]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const panel = useMemo(
    () => (open && live ? derivePersonPanel(live, data, ar) : null),
    [open, live, data, ar],
  );
  const roster = useMemo(
    () => (data?.employees || []).filter((item) => item && item.role !== "system" && String(item.name || "").trim()),
    [data],
  );

  if (!open || typeof document === "undefined") return null;
  if (!live && vacantNode) {
    return (
      <VacantPositionDrawer
        node={vacantNode}
        data={data}
        ar={ar}
        canWrite={canWrite}
        companyId={companyId}
        onHire={onHire}
        onClose={onClose}
      />
    );
  }

  const headerName = live?.name || (ar ? "شاغرة" : "Vacant");
  const vacantSub = vacantHint || (ar ? "الوظيفة بلا شاغل" : "This seat is empty");
  const pickTab = (next) => {
    setTab(next);
    setFormErr("");
  };

  const saveActing = () => {
    const person = act.person.trim();
    if (!canWrite || !companyId) {
      setFormErr(ar ? "تسجيل التكليف لمن يدير الهيكل." : "Acting is recorded by someone who manages the org.");
      return;
    }
    if (!person) {
      setFormErr(ar ? "اكتب اسم المكلَّف" : "Enter the acting person's name");
      return;
    }
    if (!act.from || !act.to || act.to < act.from) {
      setFormErr(ar ? "تاريخ النهاية يجب أن يكون بعد البداية" : "The end date must be after the start");
      return;
    }
    if (act.from > todayKey()) {
      setFormErr(ar
        ? "التكليف المسجّل يبدأ اليوم ويحفظ تاريخ النهاية. لا يُجدول من تاريخ لاحق."
        : "The live acting record starts today and stores the end date. A future start is not scheduled.");
      return;
    }
    const hit = findEmployeeByName(data, person);
    if (!hit?.id) {
      setFormErr(ar ? "المكلَّف يجب أن يكون موظفاً مسجّلاً بالاسم الكامل." : "The acting person must be a registered employee, full name.");
      return;
    }
    const seat = seatForEmployee(data, live.id);
    const stationId = String(seat?.stationId || live.stationId || "").trim();
    const result = setActingAssignment(companyId, hit.id, {
      stationId,
      until: act.to,
      seatId: seat?.id || "",
      title: seat?.title || occupantTitle(live, data, ar),
    });
    if (!result.ok) {
      setFormErr(actingError(result.error, ar));
      return;
    }
    setFormErr("");
    setAct({ person: "", from: todayKey(), to: plusDays(30) });
    setTab("profile");
  };

  const saveChange = () => {
    const person = chg.person.trim();
    if (!canWrite || !companyId) {
      setFormErr(ar ? "تغيير الشاغل لمن يدير الهيكل." : "Holder changes are recorded by someone who manages the org.");
      return;
    }
    if (!person) {
      setFormErr(ar ? "اكتب اسم الشاغل الجديد" : "Enter the new holder's name");
      return;
    }
    if (!chg.from) {
      setFormErr(ar ? "حدّد تاريخ البداية" : "Set the start date");
      return;
    }
    const hit = findEmployeeByName(data, person);
    if (!hit?.id) {
      setFormErr(ar ? "الشاغل الجديد يجب أن يكون موظفاً مسجّلاً بالاسم الكامل." : "The new holder must be a registered employee, full name.");
      return;
    }
    const seat = seatForEmployee(data, live.id);
    if (!seat?.id) {
      setFormErr(changeError("SEAT", ar));
      return;
    }
    if (seat.employeeId && String(seat.employeeId) !== String(hit.id)) {
      setFormErr(changeError("SEAT_TAKEN", ar));
      return;
    }
    if (String(seat.employeeId || "") === String(hit.id)) {
      setFormErr(ar ? "هذا الشاغل على المقعد بالفعل." : "This person already holds the seat.");
      return;
    }
    const result = placeExistingEmployee(companyId, hit.id, {
      seatId: seat.id,
      name: hit.name,
      hireDate: hit.profile?.hireDate || live.profile?.hireDate,
      reportsTo: seat.reportsToName,
      reportsToId: seat.reportsToEmployeeId,
    });
    if (!result.ok) {
      setFormErr(changeError(result.error, ar));
      return;
    }
    setFormErr("");
    setChg({ person: "", from: todayKey() });
    setTab("profile");
  };

  return createPortal(
    <div
      role="presentation"
      className="nv-v7-portal"
      dir={ar ? "rtl" : "ltr"}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 480,
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "stretch",
      }}
    >
      <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
        style={{ position: "absolute", inset: 0, background: "rgba(11,61,39,.32)" }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={live
          ? (ar ? `ملف ${live.name || "الموظف"}` : `File for ${live.name || "employee"}`)
          : (ar ? "مقعد بلا موظف" : "Vacant seat")}
        style={{
          position: "relative",
          width: "min(94vw, 300px)",
          margin: 12,
          height: "calc(100% - 24px)",
          background: "var(--nv-card, #fff)",
          border: "1px solid var(--nv-line, #D5DCD8)",
          borderTop: "3px solid #0B3D27",
          borderRadius: 8,
          boxShadow: "0 18px 44px rgba(12,20,16,.18)",
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          style={{
            padding: 14,
            borderBottom: "1px solid var(--nv-line, #E4E9E6)",
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
          <span style={{ width: 44, height: 44, borderRadius: "50%", flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, background: "#E6F0EA", color: "#0B3D27" }}>
            {String(headerName || "—").trim().split(/\s+/).slice(0, 2).map((part) => part.slice(0, 1)).join("") || "—"}
          </span>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            <strong style={{ fontSize: 14, color: "var(--nv-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {headerName}
            </strong>
          {live && panel?.sub && panel.sub !== live.name ? (
            <span style={{ fontSize: 11.5, color: "var(--nv-ink3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{panel.sub}</span>
          ) : null}
          {panel?.chain ? (
            <span style={{ fontSize: 11, color: "var(--nv-ink3)" }}>{panel.chain}</span>
          ) : (!live ? (
            <span style={{ fontSize: 11.5, color: "var(--nv-ink3)" }}>{vacantSub}</span>
          ) : null)}
          </div>
            <button
              type="button"
              onClick={onClose}
            aria-label={ar ? "إغلاق" : "Close"}
              style={{
              width: 28,
              height: 28,
              border: "1px solid var(--nv-line, #D5DCD8)",
              borderRadius: 8,
              background: "var(--nv-card)",
              color: "var(--nv-ink)",
                cursor: "pointer",
                fontFamily: "inherit",
              flex: "none",
              }}
            >
            ✕
            </button>
        </div>

        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          {panel ? (
            <>
              {canWrite ? (
                <div role="tablist" aria-label={ar ? "ملف الموظف" : "Employee file"} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  <button type="button" role="tab" aria-selected={tab === "profile"} onClick={() => pickTab("profile")} style={tabButtonStyle(tab === "profile")}>
                    {ar ? "الملف" : "File"}
                  </button>
                  <button type="button" role="tab" aria-selected={tab === "acting"} onClick={() => pickTab("acting")} style={tabButtonStyle(tab === "acting")}>
                    {ar ? "تكليف" : "Acting"}
                  </button>
                  <button type="button" role="tab" aria-selected={tab === "change"} onClick={() => pickTab("change")} style={tabButtonStyle(tab === "change")}>
                    {ar ? "تغيير نهائي" : "Permanent change"}
              </button>
            </div>
              ) : null}
              {tab === "profile" || !canWrite ? (
          <>
              <FactGrid fields={panel.fields} />
              <SectionLabel>{ar ? "قيود الوظيفة على الجدول" : "Schedule constraints"}</SectionLabel>
              {panel.rules.map((rule) => (
            <div
                  key={`${rule.src}-${rule.text}`}
              style={{
                display: "flex",
                    flexDirection: "column",
                    gap: 3,
                    padding: "10px 12px",
                    border: "1px solid var(--nv-line)",
                    borderRadius: 12,
                  }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span
                style={{
                        display: "inline-block",
                        padding: "1px 7px",
                        borderRadius: 7,
                        fontSize: 9.5,
                  fontWeight: 600,
                        background: "var(--nv-soft)",
                        color: "var(--nv-ink2)",
                        border: "1px solid var(--nv-line)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {rule.src}
              </span>
                    <span style={{ flex: 1, fontSize: 11.5 }}>{rule.text}</span>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--nv-ink2)" }}>{rule.effect}</span>
                </div>
              ))}
              <SectionLabel>{ar ? "سجل شغل الوظيفة" : "Seat occupancy"}</SectionLabel>
                <div
                  style={{
                    display: "flex",
                  flexDirection: "column",
                  gap: 0,
                  borderInlineStart: "2px solid var(--nv-line)",
                  marginInlineStart: 6,
                  paddingInlineStart: 12,
                }}
              >
                {panel.history.length ? panel.history.map((row) => {
                  const dot = row.current
                    ? (row.acting ? "#0B8A4F" : "#1D2420")
                    : "#C7CCD6";
                  const range = `${row.from || "—"} → ${row.to || (row.current ? (ar ? "الآن" : "now") : "—")}`;
                  return (
                    <div key={`${row.name}-${row.type}-${row.from}-${row.to}`} style={{ position: "relative", padding: "4px 0 10px" }}>
                      <span
                        aria-hidden
                    style={{
                          position: "absolute",
                          insetInlineStart: -19,
                          top: 10,
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: dot,
                        }}
                      />
                      <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                        <strong style={{ fontSize: 12 }}>{row.name}</strong>
                    <span
                      style={{
                            display: "inline-block",
                            padding: "0 6px",
                            borderRadius: 6,
                            fontSize: 9.5,
                            fontWeight: 700,
                            ...(row.acting
                              ? { color: "var(--nv-ok-ink)", background: "var(--nv-ok-soft)", border: "1px solid var(--nv-ok-line)" }
                              : { color: "var(--nv-ink2)", background: "var(--nv-soft)", border: "1px solid var(--nv-line)" }),
                          }}
                        >
                          {row.type}
                    </span>
              </div>
                      <span style={{ fontSize: 10.5, color: "var(--nv-ink3)", ...MONO }}>{range}</span>
            </div>
                  );
                }) : (
                  <span style={{ fontSize: 11.5, color: "var(--nv-ink3)", padding: "4px 0 10px" }}>—</span>
                )}
              </div>
              {canWrite ? (
                <>
                <ManagerSeatActions
                  employee={live}
                  data={data}
                  companyId={companyId}
                    ar={ar}
                  ownerMode={ownerMode}
                  onVacated={onClose}
                  onOpenBranch={onOpenBranch}
                />
                <HrServesPanel employee={live} data={data} companyId={companyId} ar={ar} canWrite={canWrite} />
                </>
              ) : (
                <HrServesPanel employee={live} data={data} companyId={companyId} ar={ar} canWrite={false} />
              )}
              </>
                ) : null}
              {tab === "acting" ? (
                <>
                  <div style={NOTE}>
                    {ar
                      ? "التكليف يمنح الصلاحيات كاملة بين تاريخين، ويظهر على البطاقة، وينتهي تلقائياً فيعود الشاغل الأصلي."
                      : "Acting grants the full authority between two dates, shows on the card, and ends automatically so the original holder returns."}
              </div>
                  <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: "var(--nv-ink3)" }}>
                    {ar ? "المكلَّف" : "Acting person"}
                    <input
                      value={act.person}
                      onChange={(event) => setAct((current) => ({ ...current, person: event.target.value }))}
                      placeholder={ar ? "اسم المكلَّف" : "Acting person's name"}
                      list="org-drawer-roster"
                      style={FIELD_INPUT}
                    />
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: "var(--nv-ink3)" }}>
                      {ar ? "من" : "From"}
                      <input type="date" value={act.from} onChange={(event) => setAct((current) => ({ ...current, from: event.target.value }))} style={{ ...FIELD_INPUT, direction: "ltr" }} />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: "var(--nv-ink3)" }}>
                      {ar ? "إلى" : "To"}
                      <input type="date" value={act.to} onChange={(event) => setAct((current) => ({ ...current, to: event.target.value }))} style={{ ...FIELD_INPUT, direction: "ltr" }} />
                    </label>
            </div>
                  <FormError text={formErr} />
                  <button
                    type="button"
                    onClick={saveActing}
              style={{
                      display: "inline-flex",
                alignItems: "center",
                      justifyContent: "center",
                      height: 36,
                      borderRadius: 8,
                      background: "var(--nv-ok-ink)",
                      color: "#fff",
                      fontSize: 12,
                    fontWeight: 600,
                      cursor: "pointer",
                      border: 0,
                      fontFamily: "inherit",
                    }}
                  >
                    {ar ? "تكليف بين التاريخين" : "Assign between the dates"}
                  </button>
                </>
              ) : null}
              {tab === "change" ? (
                <>
                  <div style={NOTE}>
                    {ar
                      ? "التغيير النهائي يقفل فترة الشاغل الحالي بتاريخ اليوم السابق ويفتح فترة الجديد من التاريخ المحدد. لا يُحذف أحد من السجل."
                      : "A permanent change closes the current holder's period on the day before and opens the new one from the chosen date. Nobody is deleted from the record."}
                  </div>
                  <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: "var(--nv-ink3)" }}>
                    {ar ? "الشاغل الجديد" : "New holder"}
                    <input
                      value={chg.person}
                      onChange={(event) => setChg((current) => ({ ...current, person: event.target.value }))}
                      placeholder={ar ? "اسم الشاغل الجديد" : "New holder's name"}
                      list="org-drawer-roster"
                      style={FIELD_INPUT}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: "var(--nv-ink3)" }}>
                    {ar ? "من تاريخ" : "From"}
                    <input type="date" value={chg.from} onChange={(event) => setChg((current) => ({ ...current, from: event.target.value }))} style={{ ...FIELD_INPUT, direction: "ltr" }} />
                  </label>
                  <FormError text={formErr} />
              <button
                type="button"
                    onClick={saveChange}
                style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: 36,
                      borderRadius: 8,
                      background: "var(--nv-navy)",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      border: 0,
                      fontFamily: "inherit",
                    }}
                  >
                    {ar ? "تغيير الشاغل نهائياً" : "Change the holder permanently"}
              </button>
                </>
              ) : null}
              <datalist id="org-drawer-roster">
                {roster.map((item) => <option key={item.id} value={item.name} />)}
              </datalist>
            </>
          ) : (
            <span style={{ fontSize: 12, color: "var(--nv-ink3)", lineHeight: 1.7 }}>
              {vacantHint || (ar ? "لا يوجد موظف على هذا المقعد." : "No employee on this seat.")}
            </span>
        )}
      </div>
      </aside>
    </div>,
    document.body,
  );
}
