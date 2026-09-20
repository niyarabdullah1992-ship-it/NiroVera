import React, { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/PowerCareAuth";
import { useI18n } from "@/lib/i18n";
import { addShiftType, mergeDuplicateShiftTypes, updateShiftType, removeShiftType } from "@/lib/store";
import ScheduleCell from "./ScheduleCell";
import ScheduleStatsBar from "./ScheduleStatsBar";
import RotaPublishPanel from "./RotaPublishPanel";
import { MUTED, NAVY, SURFACE, ui, CARD } from "@/lib/platformStyles";
import { uiDateLocale } from "@/lib/dateFormat";
import { duplicateShiftGroups, nextDistinctShift, checkConsecutiveWorkGate } from "@/lib/shiftDerivations";
import { ruleValue } from "@/lib/laborRules";
import { toast } from "@/components/ui/use-toast";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import PolicyDeviationAlert from "@/components/shared/PolicyDeviationAlert";

const DAY_SHORT = {
  ar: ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

export function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getMonthDates(year, month) {
  const days = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: days }, (_, i) => new Date(year, month, i + 1));
}

const monthBtn = {
  width: 32,
  height: 32,
  borderRadius: 9,
  border: "1px solid #E2E8F0",
  background: CARD,
  color: NAVY,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 14,
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const LABEL_COL = 340;
const DAY_W = 104;
const ROW_H = 78;

function normalizeTime(raw) {
  const match = String(raw || "").trim().match(/^(\d{1,2}):?(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = String(Math.floor(i / 2)).padStart(2, "0");
  const minute = i % 2 ? "30" : "00";
  return `${hour}:${minute}`;
});

function timeChoices(current) {
  const value = normalizeTime(current) || current;
  return value && !TIME_OPTIONS.includes(value) ? [value, ...TIME_OPTIONS] : TIME_OPTIONS;
}

/**
 * Name and hours live in the sticky first column of the month matrix.
 * Times are plain text (HH:MM) so Windows time chrome cannot stretch rows.
 */
export default function StationScheduleEditor({ companyId, stationId, canManage }) {
  const { data } = useAuth();
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const schedule = (data.schedules || []).find((s) => s.stationId === stationId);
  const shiftTypes = schedule?.shiftTypes || [];
  const assignments = schedule?.assignments || {};
  const defaultStationId = data.stations?.[0]?.id || null;
  const stationEmployees = (data.employees || []).filter((e) => (e.stationId || defaultStationId) === stationId);
  const monthDates = getMonthDates(cursor.year, cursor.month);
  const daysIn = monthDates.length;
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString(uiDateLocale(lang), { month: "long", year: "numeric" });
  const tableWidth = LABEL_COL + daysIn * DAY_W;

  const changeMonth = (delta) => {
    setCursor(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  useEffect(() => {
    if (!canManage || !companyId || !stationId) return;
    const removed = mergeDuplicateShiftTypes(companyId, stationId);
    if (removed > 0) {
      toast({
        description: ar
          ? "دُمجت الورديات المكررة في نافذة واحدة لكل وقت، ونُقل الإسناد إليها."
          : "Duplicate shifts were merged into one window each, and assignments moved with them.",
      });
    }
  }, [companyId, stationId, canManage]);

  const handleAddShiftType = () => {
    const draft = nextDistinctShift(shiftTypes, ar);
    if (!draft) {
      toast({
        description: ar
          ? "النوافذ القياسية (صباحي · مسائي · ليلي · 12 بقاء) موجودة. غيّر وقت وردية بدل تكرارها."
          : "Standard windows (morning, evening, night, 12h stay) already exist. Change a time instead of duplicating it.",
      });
      return;
    }
    addShiftType(companyId, stationId, { ...draft, restMinutes: draft.restMinutes ?? ruleValue("hours.rest.duringShiftMinutes") });
  };

  const clones = duplicateShiftGroups(shiftTypes);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }} dir={ar ? "rtl" : "ltr"}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginTop: 12,
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid #E2E8F0",
          background: SURFACE,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button type="button" onClick={() => changeMonth(-1)} style={monthBtn} aria-label="prev">
            {ar ? "›" : "‹"}
          </button>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              minWidth: 130,
              textAlign: "center",
              color: NAVY,
              textTransform: "capitalize",
            }}
          >
            {monthLabel}
          </div>
          <button type="button" onClick={() => changeMonth(1)} style={monthBtn} aria-label="next">
            {ar ? "‹" : "›"}
          </button>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={handleAddShiftType}
            style={{
              ...ui.btnPrimary,
              height: 34,
              padding: "0 12px",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Plus style={{ width: 14, height: 14 }} strokeWidth={1.75} />
            {ar ? "نوع وردية" : t("addShift")}
          </button>
        )}
      </div>

      {clones.length > 0 && (
        <div style={{ padding: "10px 12px", fontSize: 12, color: "#B45309", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12 }}>
          {ar
            ? `وردية مكررة بنفس الوقت: ${clones.map((g) => g.map((s) => s.label).join(" · ")).join(" — ")}.`
            : `Duplicate windows: ${clones.map((g) => g.map((s) => s.label).join(" · ")).join(" — ")}.`}
        </div>
      )}

      <div style={{ overflowX: "auto", border: "1px solid #E2E8F0", borderRadius: 14, boxShadow: "0 1px 0 #E2E8F0" }}>
        <table className="nv-shift-matrix nv-shift-matrix--inline" style={{ width: tableWidth, minWidth: tableWidth }}>
          <thead>
            <tr>
              <th className="nv-shift-sticky">
                <span className="nv-shift-col-title">{ar ? "الوردية" : t("shift")}</span>
              </th>
              {monthDates.map((d) => {
                const rest = d.getDay() === 5;
                return (
                  <th
                    key={dateKey(d)}
                    className={rest ? "nv-shift-dayhead is-rest" : "nv-shift-dayhead"}
                    style={{ width: DAY_W, minWidth: DAY_W, maxWidth: DAY_W }}
                  >
                    <span className="nv-shift-dayhead-num">{d.getDate()}</span>
                    <span className="nv-shift-dayhead-name">{(ar ? DAY_SHORT.ar : DAY_SHORT.en)[d.getDay()]}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shiftTypes.map((st) => (
              <tr key={st.id}>
                <th className="nv-shift-sticky" scope="row">
                  {canManage ? (
                    <div className="nv-shift-meta">
                      <input
                        className="nv-shift-field nv-shift-field--name"
                        value={st.label}
                        onChange={(e) => updateShiftType(companyId, stationId, st.id, { ...st, label: e.target.value })}
                        aria-label={ar ? "اسم الوردية" : "Shift name"}
                      />
                      <div className="nv-shift-window" dir="ltr">
                        <select
                          className="nv-shift-field nv-shift-field--time"
                          value={st.start}
                          dir="ltr"
                          aria-label={ar ? "من" : "From"}
                          onChange={(e) => updateShiftType(companyId, stationId, st.id, { ...st, start: e.target.value })}
                        >
                          {timeChoices(st.start).map((hm) => (
                            <option key={`s-${hm}`} value={hm}>{hm}</option>
                          ))}
                        </select>
                        <span className="nv-shift-window-sep">–</span>
                        <select
                          className="nv-shift-field nv-shift-field--time"
                          value={st.end}
                          dir="ltr"
                          aria-label={ar ? "إلى" : "To"}
                          onChange={(e) => updateShiftType(companyId, stationId, st.id, { ...st, end: e.target.value })}
                        >
                          {timeChoices(st.end).map((hm) => (
                            <option key={`e-${hm}`} value={hm}>{hm}</option>
                          ))}
                        </select>
                      </div>
                      {(() => {
                        const gate = checkConsecutiveWorkGate({ start: st.start, end: st.end, restMinutes: st.restMinutes });
                        return (
                          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, width: "100%" }}>
                            <LaborArticleCite ruleId="hours.rest.maxConsecutiveHours" ar={ar} />
                            <select
                              className="nv-shift-field"
                              value={st.restMinutes == null ? ruleValue("hours.rest.duringShiftMinutes") : st.restMinutes}
                              aria-label={ar ? "راحة داخل الوردية" : "In-shift rest"}
                              onChange={(e) => updateShiftType(companyId, stationId, st.id, { ...st, restMinutes: Number(e.target.value) })}
                              style={{ height: 26, fontSize: 11, padding: "0 6px", maxWidth: 92 }}
                            >
                              <option value={30}>{ar ? "راحة 30 د" : "30m rest"}</option>
                              <option value={45}>{ar ? "راحة 45 د" : "45m rest"}</option>
                              <option value={60}>{ar ? "راحة 60 د" : "60m rest"}</option>
                              <option value={0}>{ar ? "بلا راحة" : "No rest"}</option>
                            </select>
                            <select
                              className="nv-shift-field"
                              value={st.outdoor === true ? "outdoor" : st.outdoor === false ? "indoor" : ""}
                              aria-label={ar ? "مكان العمل: داخلي أو ميدان مكشوف" : "Work place: indoor or open-air"}
                              onChange={(e) => {
                                const next = e.target.value === "outdoor" ? true : e.target.value === "indoor" ? false : null;
                                updateShiftType(companyId, stationId, st.id, { ...st, outdoor: next });
                              }}
                              style={{ height: 26, fontSize: 11, padding: "0 6px", maxWidth: 168 }}
                            >
                              <option value="">{ar ? "مكان؟" : "Place?"}</option>
                              <option value="indoor">{ar ? "داخلي" : "Indoor"}</option>
                              <option value="outdoor">{ar ? "ميدان مكشوف" : "Open-air"}</option>
                            </select>
                            {!gate.ok ? (
                              <PolicyDeviationAlert gate={gate} ruleId="hours.rest.maxConsecutiveHours" ar={ar} />
                            ) : null}
                          </div>
                        );
                      })()}
                      <button
                        type="button"
                        onClick={() => removeShiftType(companyId, stationId, st.id)}
                        aria-label={ar ? "حذف الوردية" : "Remove shift"}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 7,
                          border: "1px solid #E2E8F0",
                          background: CARD,
                          color: MUTED,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 0,
                          flexShrink: 0,
                          marginInlineStart: "auto",
                        }}
                      >
                        <Trash2 style={{ width: 12, height: 12 }} />
                      </button>
                    </div>
                  ) : (
                    <div className="nv-shift-meta">
                      <span className="nv-shift-field nv-shift-field--name" style={{ display: "inline-block", lineHeight: "28px" }}>{st.label}</span>
                      <span className="nv-shift-window" dir="ltr">
                        <span className="nv-shift-field nv-shift-field--time" style={{ display: "inline-block" }}>{st.start}</span>
                        <span className="nv-shift-window-sep">–</span>
                        <span className="nv-shift-field nv-shift-field--time" style={{ display: "inline-block" }}>{st.end}</span>
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: MUTED }}>
                        <LaborArticleCite ruleId="hours.rest.maxConsecutiveHours" ar={ar} />
                        {st.restMinutes === 0
                          ? (ar ? "بلا راحة" : "No rest")
                          : (ar ? `راحة ${st.restMinutes ?? 30} د` : `${st.restMinutes ?? 30}m rest`)}
                      </span>
                    </div>
                  )}
                </th>
                {monthDates.map((d) => {
                  const key = dateKey(d);
                  return (
                    <td key={`${st.id}-${key}`} className="nv-shift-day" style={{ background: d.getDay() === 5 ? "#FAFBFC" : CARD }}>
                      <ScheduleCell
                        companyId={companyId}
                        stationId={stationId}
                        day={key}
                        shiftTypeId={st.id}
                        employeeIds={assignments?.[key]?.[st.id] || []}
                        employees={stationEmployees}
                        canManage={canManage}
                        isRestDay={d.getDay() === 5}
                        rowHeight={ROW_H}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {shiftTypes.length === 0 && (
          <div style={{ padding: 28, textAlign: "center", fontSize: 13, color: MUTED }}>{t("noShifts")}</div>
        )}
      </div>

      <div
        style={{
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid #E2E8F0",
          background: CARD,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>
          {ar ? "ملخص الجدول" : "Schedule summary"}
        </div>
        <ScheduleStatsBar employees={stationEmployees} shiftTypes={shiftTypes} assignments={assignments} monthDates={monthDates} />
      </div>

      <RotaPublishPanel
        stationId={stationId}
        year={cursor.year}
        monthIndex={cursor.month}
        shiftTypes={shiftTypes}
        assignments={assignments}
        canManage={canManage}
      />
    </div>
  );
}
