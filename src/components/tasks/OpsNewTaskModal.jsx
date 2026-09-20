import React, { useEffect, useRef, useState } from "react";
import { X, Play, Pause, ChevronLeft, ChevronRight } from "lucide-react";
import { BRAND, BRAND_SOFT, BRAND_DEEP, MUTED, NAVY, dot, field, CARD, SURFACE, INK } from "@/lib/platformStyles";
import HeatBanNotice from "@/components/shared/HeatBanNotice";
import {
  CERT_FOR,
  CERT_LABELS,
  deriveDailyTaskPace,
  WEEKDAY_OPTIONS,
  calendarDaysInclusive,
  PACE_DATES_MAX,
  clipIsoDatesToWindow,
  formPaceMode,
  formPaceInput,
  checkTaskPaceFromForm,
  isoDayKey,
  syncPaceSelection,
  TASK_MODES,
  taskModeConsequence,
  deriveTaskHeatBanNotice,
} from "@/lib/opsDerivations";
import { formatDate } from "@/lib/dateFormat";
import DailyPaceStrip from "@/components/tasks/DailyPaceStrip";
import {
  stationPrimaryId,
} from "@/lib/stationTree";
import VoiceRecorder from "@/components/tasks/VoiceRecorder";
import PlatformDateField from "@/components/shared/PlatformDateField";
import OpsStationMultiSelect from "@/components/tasks/OpsStationMultiSelect";
import MemberMultiSelect from "@/components/tasks/MemberMultiSelect";

const FIELD = { ...field, height: 40 };
const SELECT = { ...FIELD, padding: "0 10px" };

const LABEL_SPAN = {
  fontSize: "12px",
  fontWeight: 600,
  color: MUTED,
};

const PRIORITIES = [
  { id: "high", ar: "عالية", en: "High", color: "#DC2626" },
  { id: "medium", ar: "متوسطة", en: "Medium", color: "#F59E0B" },
  { id: "low", ar: "منخفضة", en: "Low", color: MUTED },
];

const PLAN_HORIZONS = [
  { id: "w", ar: "أسبوعية", en: "Weekly" },
  { id: "m", ar: "شهرية", en: "Monthly" },
  { id: "q", ar: "ربعية", en: "Quarterly" },
  { id: "h", ar: "نصف سنوية", en: "Half-year" },
  { id: "y", ar: "سنوية", en: "Annual" },
];

function dueFromPlanHorizon(startAt, horizon) {
  const from = String(startAt || "").slice(0, 10) || isoDayKey(new Date());
  const dt = new Date(`${from}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return from;
  if (horizon === "w") dt.setDate(dt.getDate() + 7);
  else if (horizon === "m") dt.setMonth(dt.getMonth() + 1);
  else if (horizon === "q") dt.setMonth(dt.getMonth() + 3);
  else if (horizon === "h") dt.setMonth(dt.getMonth() + 6);
  else dt.setFullYear(dt.getFullYear() + 1);
  dt.setDate(dt.getDate() - 1);
  return isoDayKey(dt);
}

const WEIGHTS = [
  { w: 1, ar: "روتيني", en: "Routine" },
  { w: 2, ar: "إدخال/متابعة", en: "Data & follow-up" },
  { w: 3, ar: "تشغيلي", en: "Operational" },
  { w: 4, ar: "فني/صيانة", en: "Technical / maintenance" },
  { w: 5, ar: "حرج/عميل", en: "Critical / client" },
];

function initialsOf(name) {
  return String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase() || "?";
}

function assignBtnStyle(active) {
  return {
    flex: 1,
    minWidth: 0,
    height: "36px",
    padding: "0 6px",
    borderRadius: "9px",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "12px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    ...(active
      ? { border: `1px solid ${BRAND}`, background: BRAND_SOFT, color: BRAND_DEEP, fontWeight: 600 }
      : { border: "1px solid var(--nv-line, #E2E8F0)", background: CARD, color: MUTED }),
  };
}

function chipBtnStyle(active) {
  return {
    flex: "0 0 auto",
    minWidth: 36,
    height: 32,
    padding: "0 8px",
    borderRadius: 9,
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 12,
    fontWeight: active ? 650 : 500,
    whiteSpace: "nowrap",
    lineHeight: 1,
    ...(active
      ? { border: `1px solid ${BRAND}`, background: BRAND_SOFT, color: BRAND_DEEP }
      : { border: "1px solid var(--nv-line, #E2E8F0)", background: CARD, color: NAVY }),
  };
}

function padDay(n) {
  return String(n).padStart(2, "0");
}

function monthKey(y, m, d) {
  return `${y}-${padDay(m + 1)}-${padDay(d)}`;
}

function monthCells(year, month) {
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function PaceRangeCalendar({ ar, startAt, dueAt, picked, onToggle }) {
  const from = String(startAt || "").slice(0, 10);
  const to = String(dueAt || "").slice(0, 10);
  const seed = from || isoDayKey(new Date());
  const [cursor, setCursor] = useState(() => {
    const p = /^(\d{4})-(\d{2})/.exec(seed);
    return p ? new Date(Number(p[1]), Number(p[2]) - 1, 1) : new Date();
  });
  useEffect(() => {
    if (!from) return;
    const p = /^(\d{4})-(\d{2})/.exec(from);
    if (p) setCursor(new Date(Number(p[1]), Number(p[2]) - 1, 1));
  }, [from]);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = monthCells(year, month);
  const selected = new Set((Array.isArray(picked) ? picked : []).map(String));
  const weekdays = ar
    ? ["اث", "ثل", "أر", "خم", "جم", "سب", "أح"]
    : ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  const monthLabel = formatDate(new Date(year, month, 1), ar ? "ar" : "en", { month: "long", year: "numeric" });
  const navBtn = {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: "1px solid var(--nv-line, #E2E8F0)",
    background: CARD,
    color: NAVY,
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
  };

  return (
    <div
      style={{
        border: "1px solid var(--nv-line, #E2E8F0)",
        background: CARD,
        borderRadius: 12,
        padding: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <button
          type="button"
          aria-label={ar ? "الشهر السابق" : "Previous month"}
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          style={navBtn}
        >
          {ar ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
        <div style={{ fontSize: 12, fontWeight: 650, color: NAVY }}>{monthLabel}</div>
        <button
          type="button"
          aria-label={ar ? "الشهر التالي" : "Next month"}
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          style={navBtn}
        >
          {ar ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {weekdays.map((w) => (
          <div key={w} style={{ textAlign: "center", fontSize: 10, fontWeight: 650, color: MUTED, padding: "4px 0" }}>
            {w}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />;
          const key = monthKey(year, month, day);
          const inRange = (!from || key >= from) && (!to || key <= to);
          const on = selected.has(key);
          return (
            <button
              key={key}
              type="button"
              disabled={!inRange}
              onClick={() => inRange && onToggle(key)}
              style={{
                height: 32,
                borderRadius: 8,
                border: on ? "none" : "1px solid transparent",
                background: on ? "var(--nv-navy, #14284B)" : "transparent",
                color: !inRange ? "#CBD5E1" : on ? "#fff" : NAVY,
                fontSize: 12,
                fontWeight: on ? 700 : 500,
                cursor: inRange ? "pointer" : "default",
                fontFamily: "inherit",
              }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function priorityBtnStyle(active, color) {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "7px",
    flex: 1,
    height: "36px",
    borderRadius: "9px",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "12px",
    ...(active
      ? { border: `1px solid ${color}`, background: `${color}14`, color, fontWeight: 600 }
      : { border: "1px solid var(--nv-line, #E2E8F0)", background: CARD, color: MUTED }),
  };
}

function weightBtnStyle(active) {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "2px",
    flex: 1,
    minWidth: 0,
    padding: "7px 4px",
    borderRadius: "9px",
    cursor: "pointer",
    fontFamily: "inherit",
    ...(active
      ? { border: `1px solid ${BRAND}`, background: BRAND_SOFT, color: BRAND_DEEP }
      : { border: "1px solid var(--nv-line, #E2E8F0)", background: CARD, color: MUTED }),
  };
}

function modeBtnStyle(active) {
  return {
    flex: 1,
    height: "36px",
    borderRadius: "9px",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "12px",
    ...(active
      ? { border: `1px solid ${BRAND}`, background: BRAND_SOFT, color: BRAND_DEEP, fontWeight: 600 }
      : { border: "1px solid var(--nv-line, #E2E8F0)", background: CARD, color: MUTED }),
  };
}

function teamChipStyle(on) {
  return on
    ? {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "7px 11px 7px 8px",
        borderRadius: "20px",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: "12px",
        border: `1px solid ${BRAND}`,
        background: BRAND_SOFT,
        color: BRAND_DEEP,
        fontWeight: 600,
      }
    : {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "7px 11px 7px 8px",
        borderRadius: "20px",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: "12px",
        border: "1px solid var(--nv-line, #E2E8F0)",
        background: CARD,
        color: MUTED,
      };
}

function avatarStyle(on) {
  return {
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    fontSize: "9px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontFamily: "'IBM Plex Sans',sans-serif",
    ...(on ? { background: BRAND, color: "#fff" } : { background: SURFACE, color: MUTED }),
  };
}

function SectionCard({ title, hint, children }) {
  return (
    <section
      style={{
        borderRadius: 16,
        border: "1px solid var(--nv-line, #E2E8F0)",
        background: "var(--nv-inset, var(--nv-soft, #F7F8FA))",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {(title || hint) && (
        <div>
          {title ? (
            <div style={{ fontSize: 12, fontWeight: 650, color: MUTED, letterSpacing: "0.01em" }}>{title}</div>
          ) : null}
          {hint ? (
            <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.6, marginTop: 4 }}>{hint}</div>
          ) : null}
        </div>
      )}
      {children}
    </section>
  );
}

function isAudioAttachment(fl) {
  return Boolean(
    fl?.type?.startsWith?.("audio/")
    || /\.(webm|m4a|ogg|mp3|wav|aac)$/i.test(String(fl?.name || "")),
  );
}

function formatClipTime(sec) {
  const n = Number.isFinite(sec) ? Math.max(0, Math.floor(sec)) : 0;
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}

/** Compact voice row inside a shared platform field box. */
function VoiceNoteBubble({ src, index, ar, onRemove, isLast }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const progress = duration > 0 ? Math.min(1, current / duration) : 0;
  const bars = [5, 9, 6, 12, 7, 11, 5, 13, 8, 6, 12, 7, 10, 8, 13, 5, 9, 7, 11, 8, 6, 10, 7, 12];

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return undefined;
    const onMeta = () => setDuration(el.duration || 0);
    const onTime = () => setCurrent(el.currentTime || 0);
    const onEnd = () => {
      setPlaying(false);
      setCurrent(0);
    };
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("durationchange", onMeta);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnd);
    return () => {
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("durationchange", onMeta);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnd);
    };
  }, [src]);

  const toggle = async () => {
    const el = audioRef.current;
    if (!el || !src) return;
    if (playing) {
      el.pause();
      setPlaying(false);
      return;
    }
    try {
      await el.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  const seek = (e) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * duration;
    setCurrent(el.currentTime);
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        minHeight: 40,
        padding: "6px 2px",
        borderBottom: isLast ? "none" : "1px solid var(--nv-line, #E2E8F0)",
        boxSizing: "border-box",
      }}
    >
      <audio ref={audioRef} src={src || undefined} preload="metadata" style={{ display: "none" }} />
      <button
        type="button"
        onClick={toggle}
        disabled={!src}
        aria-label={playing ? (ar ? "إيقاف" : "Pause") : (ar ? "تشغيل" : "Play")}
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          border: "none",
          background: playing ? BRAND : "var(--nv-navy, #14284B)",
          color: "#fff",
          display: "grid",
          placeItems: "center",
          cursor: src ? "pointer" : "default",
          flexShrink: 0,
          opacity: src ? 1 : 0.45,
        }}
      >
        {playing ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" style={{ marginInlineStart: 1 }} />}
      </button>

      <span style={{ fontSize: 12, fontWeight: 600, color: NAVY, flexShrink: 0, minWidth: 44 }}>
        {ar ? `صوت ${index}` : `Voice ${index}`}
      </span>

      <button
        type="button"
        onClick={seek}
        aria-label={ar ? "تقدم المقطع" : "Seek"}
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 1.5,
          height: 14,
          flex: 1,
          minWidth: 0,
          padding: 0,
          border: "none",
          background: "transparent",
          cursor: "pointer",
        }}
      >
        {bars.map((h, i) => {
          const active = progress > 0 && i / bars.length <= progress;
          return (
            <span
              key={i}
              style={{
                flex: 1,
                height: h,
                borderRadius: 1,
                background: active
                  ? BRAND
                  : "color-mix(in oklab, var(--nv-navy, #14284B) 16%, transparent)",
                minWidth: 2,
              }}
            />
          );
        })}
      </button>

      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: MUTED,
          fontVariantNumeric: "tabular-nums",
          flexShrink: 0,
          minWidth: 34,
          textAlign: "end",
        }}
      >
        {formatClipTime(playing || current > 0 ? current : duration)}
      </span>

      <button
        type="button"
        aria-label={ar ? "حذف التسجيل" : "Remove voice note"}
        onClick={onRemove}
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          border: "none",
          background: "transparent",
          color: MUTED,
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          flexShrink: 0,
          padding: 0,
        }}
      >
        <X size={13} strokeWidth={2} />
      </button>
    </div>
  );
}

const FIELD_BOX = {
  width: "100%",
  flex: 1,
  display: "flex",
  flexDirection: "column",
  border: "1px solid var(--nv-line, #E2E8F0)",
  borderRadius: 9,
  background: CARD,
  overflow: "hidden",
  boxSizing: "border-box",
  minHeight: 120,
};

const FIELD_TOOLBAR = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  minHeight: 40,
  padding: "6px 10px",
  borderBottom: "1px solid var(--nv-line, #E2E8F0)",
  background: SURFACE,
  boxSizing: "border-box",
  flexShrink: 0,
};

const FIELD_BODY = {
  padding: "4px 10px",
  minHeight: 56,
  flex: 1,
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-start",
};

const FIELD_EMPTY = {
  fontSize: 12,
  color: MUTED,
  padding: "8px 2px",
  lineHeight: 1.5,
};

const FIELD_COL = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
  flex: "1 1 240px",
  minWidth: 0,
};

export default function OpsNewTaskModal({
  ar,
  dir,
  form,
  setForm,
  stations,
  stationTree: _stationTree,
  employees,
  busy,
  onClose,
  onSubmit,
}) {
  const [files, setFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [showSend, setShowSend] = useState(false);

  useEffect(() => {
    const created = [];
    const next = files.map((fl) => {
      if (!isAudioAttachment(fl)) return "";
      if (fl?.url) return fl.url;
      if (typeof URL !== "undefined" && fl instanceof Blob) {
        const url = URL.createObjectURL(fl);
        created.push(url);
        return url;
      }
      return "";
    });
    setPreviewUrls(next);
    return () => {
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  const reqCert = CERT_FOR[form.workKind] || null;
  const reqCertLabel = reqCert ? (CERT_LABELS[reqCert]?.[ar ? "ar" : "en"] || reqCert) : null;

  const selectedStationIds = Array.isArray(form.stationIds) && form.stationIds.length
    ? form.stationIds.map(String)
    : (form.stationId ? [String(form.stationId)] : []);
  const allowMultiStation = stations.length > 1;

  const homeIdOf = (emp) => String(emp?.stationId || emp?.station_id || emp?.homeStationId || "");

  const isLinkedTo = (emp, sid) => {
    const want = String(sid);
    if (homeIdOf(emp) === want) return true;
    const managed = Array.isArray(emp?.managedStations)
      ? emp.managedStations
      : String(emp?.managedStations || "").split(/[،,]/);
    return managed.map(String).map((id) => id.trim()).filter(Boolean).includes(want);
  };

  const teamMembers = employees
    .filter((e) => selectedStationIds.length && selectedStationIds.some((sid) => isLinkedTo(e, sid)))
    .map((e) => ({
      id: String(e.employeeId || e.id),
      name: e.name || "",
    }));

  const selectedTeam = (form.memberIds || []).map(String).filter((id) => teamMembers.some((m) => m.id === id));
  const dispatchStationId = String(form.dispatchStationId || "").trim();
  const assignMode = form.assignMode === "all" ? "all" : "some";
  const stationOptions = stations.map((s) => ({
    ...s,
    id: stationPrimaryId(s),
    name: s.name,
  }));
  const otherStations = stationOptions.filter((s) => !selectedStationIds.includes(String(s.id)));
  const hasAssignees = assignMode === "all"
    ? teamMembers.length > 0
    : selectedTeam.length > 0;
  const sendOpen = showSend || !!dispatchStationId;
  const sendWho = assignMode === "all"
    ? (ar ? `فريق الفرع (${teamMembers.length})` : `Station team (${teamMembers.length})`)
    : selectedTeam.length === 1
      ? (teamMembers.find((m) => m.id === selectedTeam[0])?.name || "")
      : (ar ? `${selectedTeam.length} موظفون` : `${selectedTeam.length} people`);

  const scheduleForm = {
    ...form,
    recurrenceKind: "daily",
  };
  const paceGate = checkTaskPaceFromForm(scheduleForm);
  const paceMode = formPaceMode(form);
  const specificOn = paceMode === "specific" || paceMode === "weekdays" || paceMode === "dates";
  const heatNotice = deriveTaskHeatBanNotice(
    { mode: form.mode },
    { startAt: form.startAt, dueAt: form.dueAt },
  );

  /** A disabled button that will not say why reads as a broken button. Name the first gap. */
  const submitBlock = (() => {
    if (!String(form.title || "").trim()) return ar ? "اكتب عنوان المهمة." : "Write the task title.";
    if (!selectedStationIds.length) return ar ? "اختر فرعًا واحدًا على الأقل." : "Pick at least one station.";
    if (!form.mode) return ar ? "حدّد مكان التنفيذ." : "Choose where the work happens.";
    if (!paceGate.ok) return (ar ? paceGate.reason : paceGate.reasonEn) || paceGate.reason || "";
    if (!(Math.round(Number(form.targetCount)) >= 1)) return ar ? "حدّد العدد المستهدف (1 فأكثر)." : "Set the target count (1 or more).";
    if (assignMode === "some" && !selectedTeam.length) return ar ? "اختر عضوًا واحدًا من الفريق على الأقل." : "Pick at least one team member.";
    if (assignMode === "all" && !teamMembers.length) return ar ? "لا طاقم في هذا الفرع." : "No crew at this station.";
    return "";
  })();

  const canSubmit = !submitBlock;

  const submitEnabled = canSubmit && !busy;
  const submitStyle = submitEnabled
    ? {
        flex: 1,
        height: "44px",
        borderRadius: "12px",
        background: BRAND,
        color: "#fff",
        border: "none",
        fontSize: "14px",
        fontWeight: 650,
        cursor: "pointer",
        fontFamily: "inherit",
      }
    : {
        flex: 1,
        height: "44px",
        borderRadius: "12px",
        background: "var(--nv-soft, #E2E8F0)",
        color: MUTED,
        border: "none",
        fontSize: "14px",
        fontWeight: 650,
        cursor: "not-allowed",
        fontFamily: "inherit",
      };

  const stationCrew = teamMembers.length;

  const setStations = (ids) => {
    const next = [...new Set((ids || []).map(String).filter(Boolean))];
    setShowSend(false);
    setForm((f) => ({
      ...f,
      stationIds: next,
      stationId: next[0] || "",
      memberIds: (f.assignMode === "all" ? f.memberIds : []),
      dispatchStationId: "",
    }));
  };

  const setWorkTypeText = (value) => {
    setForm((f) => ({
      ...f,
      workTypeText: value,
      workKind: f.workKind || "gn",
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!submitEnabled) return;
    onSubmit(e, files);
  };

  const assignModes = [
    { id: "some", label: ar ? "عدد من الفريق" : "Several of the team" },
    { id: "all", label: ar ? "كامل الفريق" : "Whole team" },
  ];

  return (
    <>
    <div
      dir={dir}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "color-mix(in oklab, var(--nv-navy, #14284B) 42%, transparent)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
      role="presentation"
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 640,
          maxHeight: "calc(100vh - 32px)",
          background: CARD,
          borderRadius: 22,
          border: "1px solid var(--nv-glass-line, var(--nv-line, #E2E8F0))",
          boxShadow: "var(--nv-glass-shadow, 0 24px 60px rgba(20,40,75,.22))",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            flexShrink: 0,
            padding: "20px 24px 16px",
            borderBottom: "1px solid var(--nv-line, #E2E8F0)",
            background: "var(--nv-card, #fff)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 650, letterSpacing: "-0.02em", color: INK || NAVY, lineHeight: 1.3 }}>
                {ar ? "مهمة جديدة" : "New task"}
              </div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 4, lineHeight: 1.6 }}>
                {ar
                  ? "تُسند فورًا لفريق الفرع المختار، وتصل إشعارًا للمسؤول."
                  : "Assigned immediately to the selected station team, and sent to the owner."}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={ar ? "إغلاق" : "Close"}
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "1px solid var(--nv-line, #E2E8F0)",
                background: CARD,
                color: MUTED,
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={LABEL_SPAN}>{ar ? "عنوان المهمة" : "Task title"}</span>
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder={ar ? "مثال: استبدال فلتر الهواء — المرحلة الثالثة" : "e.g. Air filter replacement — phase 3"}
              style={{ ...FIELD, height: 44, fontSize: 15 }}
            />
          </label>

          <SectionCard title={ar ? "الإسناد" : "Assignment"}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={LABEL_SPAN}>
                {allowMultiStation
                  ? (ar ? "الفروع" : "Stations")
                  : (ar ? "الفرع" : "Station")}
              </span>

              {allowMultiStation ? (
                <OpsStationMultiSelect
                  stations={stationOptions}
                  value={selectedStationIds}
                  onChange={setStations}
                  ar={ar}
                />
              ) : (
                <select
                  value={form.stationId}
                  onChange={(e) => setStations(e.target.value ? [e.target.value] : [])}
                  style={SELECT}
                >
                  <option value="">{ar ? "اختر الفرع" : "Select station"}</option>
                  {stations.map((s) => {
                    const sid = stationPrimaryId(s);
                    return (
                      <option key={sid} value={sid}>{s.name}</option>
                    );
                  })}
                </select>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={LABEL_SPAN}>{ar ? "لمن تُسند؟" : "Assign to"}</span>
              <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
                {ar
                  ? "اختر فرع الفريق ثم الأعضاء. التنفيذ في نفس الفرع إلا إذا اخترت تنفيذ في فرع آخر."
                  : "Pick the team’s station then its people. Work stays here unless you choose to execute at another station."}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {assignModes.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setForm((f) => ({
                      ...f,
                      assignMode: m.id,
                      memberIds: m.id === "all"
                        ? teamMembers.map((t) => t.id)
                        : (m.id === "some" ? f.memberIds : []),
                    }))}
                    style={assignBtnStyle(assignMode === m.id)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {assignMode === "some" && (
                selectedStationIds.length ? (
                  <MemberMultiSelect
                    members={teamMembers}
                    selected={selectedTeam}
                    onChange={(ids) => setForm((f) => ({ ...f, memberIds: ids }))}
                    lang={ar ? "ar" : "en"}
                  />
                ) : (
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                    {ar ? "حدّد الفروع أولًا" : "Pick stations first"}
                  </div>
                )
              )}

              {assignMode === "all" && (
                <div
                  style={{
                    marginTop: 2,
                    padding: "12px 14px",
                    borderRadius: 11,
                    background: SURFACE,
                    border: "1px solid var(--nv-line, #E2E8F0)",
                    fontSize: 12,
                    color: MUTED,
                    lineHeight: 1.65,
                  }}
                >
                  {selectedStationIds.length
                    ? (ar
                      ? `تُسند إلى فريق الفرع كاملًا (${stationCrew || teamMembers.length || "—"} موظفًا) كمهمة واحدة يراها الجميع.`
                      : `Assigned to the whole station team (${stationCrew || teamMembers.length || "—"} people) as one shared work order.`)
                    : (ar ? "اختر الفرع أولًا لتحديد الفريق." : "Pick a station first to resolve the team.")}
                </div>
              )}

              {hasAssignees && otherStations.length ? (
                sendOpen ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <span style={LABEL_SPAN}>{ar ? "تنفيذ في فرع آخر" : "Execute at another station"}</span>
                    <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
                      {ar
                        ? `خيار نادر. ${sendWho} ينفّذ العمل في فرع آخر — فرعهم الأم لا يتغيّر.`
                        : `Rare. ${sendWho} execute the work at another station — their home station stays.`}
                    </div>
                    <select
                      value={dispatchStationId}
                      onChange={(e) => setForm((f) => ({ ...f, dispatchStationId: e.target.value }))}
                      style={SELECT}
                    >
                      <option value="">{ar ? "اختر فرع التنفيذ" : "Pick executing station"}</option>
                      {otherStations.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSend(false);
                        setForm((f) => ({ ...f, dispatchStationId: "" }));
                      }}
                      style={{
                        alignSelf: "flex-start",
                        margin: 0,
                        padding: 0,
                        border: "none",
                        background: "none",
                        color: MUTED,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {ar ? "تنفيذ في هذا الفرع" : "Execute at this station"}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSend(true)}
                    style={{
                      alignSelf: "flex-start",
                      margin: 0,
                      padding: 0,
                      border: "none",
                      background: "none",
                      color: MUTED,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {ar ? "تنفيذ في فرع آخر" : "Execute at another station"}
                  </button>
                )
              ) : null}

              <div style={{ fontSize: 10, color: MUTED, lineHeight: 1.6, textWrap: "pretty" }}>
                {reqCert
                  ? (ar
                    ? `يُفضَّل أن يكون للمسؤول شهادة ${reqCertLabel} سارية — يمكن الإسناد حتى إن انتهت، ويُحدَّث التجديد من قسم السلامة.`
                    : `A current ${reqCertLabel} certification is preferred — assignment is still allowed if it has lapsed; renew it from Safety.`)
                  : (ar ? "هذا النوع من العمل لا يشترط شهادة كفاءة." : "This work type requires no competency certification.")}
              </div>
            </div>
          </SectionCard>

          <SectionCard title={ar ? "طبيعة العمل" : "Work profile"}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <label style={{ flex: "1 1 180px", display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={LABEL_SPAN}>{ar ? "نوع العمل" : "Work type"}</span>
                <input
                  type="text"
                  value={form.workTypeText || ""}
                  onChange={(e) => setWorkTypeText(e.target.value)}
                  placeholder={ar ? "اكتب نوع العمل" : "Type the work type"}
                  maxLength={80}
                  style={FIELD}
                />
              </label>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <span style={LABEL_SPAN}>{ar ? "الأولوية" : "Priority"}</span>
              <div style={{ display: "flex", gap: 8 }}>
                {PRIORITIES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, priority: p.id }))}
                    style={priorityBtnStyle(form.priority === p.id, p.color)}
                  >
                    <span style={dot(p.color)} />
                    <span>{ar ? p.ar : p.en}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <span style={LABEL_SPAN}>{ar ? "وزن الجهد" : "Effort weight"}</span>
              <div style={{ display: "flex", gap: 6 }}>
                {WEIGHTS.map((w) => (
                  <button
                    key={w.w}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, effortWeight: w.w }))}
                    style={weightBtnStyle(Number(form.effortWeight) === w.w)}
                  >
                    <span dir="ltr" style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 14, fontWeight: 600 }}>
                      ×{w.w}
                    </span>
                    <span style={{ fontSize: 9, opacity: 0.85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                      {ar ? w.ar : w.en}
                    </span>
                  </button>
                ))}
              </div>
              <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
                {ar
                  ? "يُقترح من مسمى المسؤول، ويُثبَّت قبل بدء العمل — النقاط = الأولوية × الوزن"
                  : "Suggested from the owner's job title and fixed before work starts — points = priority × weight"}
              </span>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 280px", display: "flex", flexDirection: "column", gap: 7 }}>
                <span style={LABEL_SPAN}>
                  {ar ? "مكان التنفيذ — مطلوب" : "Where the work happens — required"}
                </span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {TASK_MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, mode: m.id }))}
                      style={modeBtnStyle(form.mode === m.id)}
                    >
                      {ar ? m.ar : m.en}
                    </button>
                  ))}
                </div>
                <span style={{ fontSize: 11, color: form.mode ? NAVY : MUTED, lineHeight: 1.6 }}>
                  {form.mode
                    ? taskModeConsequence(form.mode, { ar, onDate: form.startAt })
                    : (ar
                      ? "المكان يحدّد ما تطلبه المنصة عند تسجيل الإنجاز: بصمة الحضور، وسريان حظر العمل تحت أشعة الشمس."
                      : "The place decides what the platform requires when a completion is logged: the attendance stamp, and whether the sun ban applies.")}
                </span>
                {/* Creating a task is never refused, so the level here follows the task's
                    own span: a red alert when it touches the season, plain reference when
                    it does not. The heavier red of a refusal belongs to the log gate. */}
                <HeatBanNotice notice={heatNotice} ar={ar} />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title={ar ? "الجدول والعدد" : "Schedule & count"}
            hint={ar
              ? "مهمة واحدة بين تاريخين. أيام التوزيع تحدّد على أي أيام يُقسَّم العدد."
              : "One task between two dates. Spread days choose which days the count is split across."}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 12,
                alignItems: "end",
              }}
            >
              <label style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                <span style={{ ...LABEL_SPAN, whiteSpace: "nowrap" }}>{ar ? "العدد المستهدف" : "Target count"}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  placeholder={ar ? "اكتب العدد" : "Type the count"}
                  value={form.targetCount === "" || form.targetCount == null ? "" : String(form.targetCount)}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d]/g, "");
                    setForm((f) => ({ ...f, targetCount: raw }));
                  }}
                  style={FIELD}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                <span style={{ ...LABEL_SPAN, whiteSpace: "nowrap" }}>{ar ? "تاريخ البدء" : "Start date"}</span>
                <PlatformDateField
                  ar={ar}
                  value={form.startAt || ""}
                  onChange={(next) => setForm((f) => {
                    const startAt = next;
                    const dueAt = f.dueAt;
                    return {
                      ...f,
                      startAt,
                      paceDates: clipIsoDatesToWindow(f.paceDates, next, dueAt),
                      ...syncPaceSelection({ ...f, startAt }, startAt, dueAt),
                    };
                  })}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                <span style={{ ...LABEL_SPAN, whiteSpace: "nowrap" }}>{ar ? "تاريخ الاستحقاق" : "Due date"}</span>
                <PlatformDateField
                  ar={ar}
                  value={form.dueAt || ""}
                  onChange={(next) => setForm((f) => {
                    const startAt = f.startAt;
                    const dueAt = next;
                    return {
                      ...f,
                      dueAt,
                      paceDates: clipIsoDatesToWindow(f.paceDates, startAt, next),
                      ...syncPaceSelection({ ...f, dueAt }, startAt, dueAt),
                    };
                  })}
                />
              </label>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={LABEL_SPAN}>{ar ? "أفق الخطة" : "Plan horizon"}</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {PLAN_HORIZONS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setForm((f) => {
                      const startAt = f.startAt || isoDayKey(new Date());
                      const dueAt = f.dueAt || dueFromPlanHorizon(startAt, m.id);
                      return {
                        ...f,
                        planHorizon: m.id,
                        planPinned: true,
                        startAt,
                        dueAt,
                        ...syncPaceSelection({ ...f, startAt, dueAt }, startAt, dueAt),
                      };
                    })}
                    style={assignBtnStyle(form.planPinned && form.planHorizon === m.id)}
                  >
                    {ar ? m.ar : m.en}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={LABEL_SPAN}>{ar ? "أيام التوزيع" : "Spread days"}</span>
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  { id: "all", ar: "كل الأيام", en: "All days" },
                  { id: "specific", ar: "أيام محددة", en: "Specific days" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setForm((f) => ({
                      ...f,
                      paceMode: m.id === "all" ? "all" : (specificOn ? f.paceMode : "specific"),
                      ...(m.id === "all" ? { paceWeekdays: [], paceDates: [] } : {}),
                    }))}
                    style={assignBtnStyle(m.id === "all" ? paceMode === "all" : specificOn)}
                  >
                    {ar ? m.ar : m.en}
                  </button>
                ))}
              </div>
              {specificOn ? (
                <div style={{ display: "flex", gap: 6 }}>
                  {[
                    { id: "weekdays", ar: "يوم ثابت", en: "Fixed day" },
                    { id: "dates", ar: "مرن", en: "Flexible" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setForm((f) => ({ ...f, paceMode: m.id }));
                      }}
                      style={assignBtnStyle(paceMode === m.id)}
                    >
                      {ar ? m.ar : m.en}
                    </button>
                  ))}
                </div>
              ) : null}
              {specificOn ? (
                <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.65 }}>
                  {paceMode === "weekdays"
                    ? (ar ? "يوم الأسبوع نفسه يتكرر من البداية حتى الاستحقاق — مناسب للسنة." : "The same weekday repeats from start to due — fits a year.")
                    : paceMode === "dates"
                      ? (ar ? "اختر التواريخ من التقويم داخل الفترة المحددة فقط." : "Pick dates on the calendar inside the defined window only.")
                      : (ar ? "هل التوزيع يوم ثابت في الفترة، أم مرن تختار أيامه من التقويم؟" : "Is the spread a fixed weekday in the window, or flexible dates from the calendar?")}
                </div>
              ) : null}
            </div>

            <DailyPaceStrip
              ar={ar}
              pace={deriveDailyTaskPace(formPaceInput(scheduleForm))}
              emptyHint={ar
                ? (paceMode === "dates"
                  ? "اكتب العدد والتاريخين واختر الأيام من التقويم لتظهر حصة اليوم."
                  : paceMode === "weekdays"
                    ? "اكتب العدد والتاريخين واختر يوم الأسبوع الثابت لتظهر حصة اليوم."
                    : "اكتب العدد وحدّد تاريخ البدء وتاريخ الاستحقاق لتظهر حصة اليوم.")
                : (paceMode === "dates"
                  ? "Enter the count and dates, then pick days on the calendar."
                  : paceMode === "weekdays"
                    ? "Enter the count and dates, then pick the fixed weekday."
                    : "Enter the count and both dates to see today's quota.")}
            />

            {paceMode === "weekdays" ? (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {WEEKDAY_OPTIONS.map((w) => {
                  const on = (form.paceWeekdays || []).includes(w.id);
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setForm((f) => {
                        const cur = Array.isArray(f.paceWeekdays) ? f.paceWeekdays : [];
                        const next = cur.includes(w.id) ? cur.filter((d) => d !== w.id) : [...cur, w.id];
                        return { ...f, paceWeekdays: next, paceDates: [] };
                      })}
                      style={chipBtnStyle(on)}
                    >
                      {ar ? w.ar : w.en}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {paceMode === "dates" ? (
              (() => {
                if (!form.startAt || !form.dueAt) {
                  return (
                    <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.65 }}>
                      {ar ? "حدّد تاريخ البدء وتاريخ الاستحقاق أولًا، ثم اختر من التقويم." : "Pick the start and due dates first, then choose on the calendar."}
                    </div>
                  );
                }
                const spanDays = calendarDaysInclusive(form.startAt, form.dueAt);
                const picked = clipIsoDatesToWindow(form.paceDates, form.startAt, form.dueAt);
                const toggleDay = (day) => setForm((f) => {
                  const cur = clipIsoDatesToWindow(f.paceDates, f.startAt, f.dueAt);
                  const has = cur.includes(day);
                  const next = has
                    ? cur.filter((d) => d !== day)
                    : [...cur, day].sort().slice(0, PACE_DATES_MAX);
                  return { ...f, paceDates: next, paceWeekdays: [] };
                });
                if (spanDays < 1) {
                  return (
                    <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.65 }}>
                      {ar ? "تاريخ البدء بعد الاستحقاق." : "Start date is after the due date."}
                    </div>
                  );
                }
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontSize: 11, color: MUTED }}>
                      {ar
                        ? (picked.length ? `${picked.length} يوم مختار داخل الفترة.` : "انقر الأيام داخل الفترة على التقويم.")
                        : (picked.length ? `${picked.length} day${picked.length === 1 ? "" : "s"} picked in the window.` : "Tap days inside the window on the calendar.")}
                    </div>
                    <PaceRangeCalendar
                      ar={ar}
                      startAt={form.startAt}
                      dueAt={form.dueAt}
                      picked={picked}
                      onToggle={toggleDay}
                    />
                  </div>
                );
              })()
            ) : null}
          </SectionCard>

          <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <span style={LABEL_SPAN}>{ar ? "خطوات التنفيذ" : "Execution steps"}</span>
            <textarea
              rows={3}
              value={form.steps}
              onChange={(e) => setForm((f) => ({ ...f, steps: e.target.value }))}
              placeholder={ar ? "خطوة في كل سطر — تظهر مرقّمة في بطاقة المهمة" : "One step per line — they appear numbered on the task card"}
              style={{
                border: "1px solid var(--nv-line, #E2E8F0)",
                borderRadius: 9,
                background: SURFACE,
                padding: "9px 12px",
                fontFamily: "inherit",
                fontSize: 13,
                color: NAVY,
                outline: "none",
                resize: "vertical",
              }}
            />
          </label>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "stretch",
              gap: 12,
              width: "100%",
            }}
          >
            {/* Voice field */}
            <div style={FIELD_COL}>
              <span style={LABEL_SPAN}>{ar ? "المقاطع الصوتية" : "Voice notes"}</span>
              <div style={FIELD_BOX}>
                <div style={FIELD_TOOLBAR}>
                  <VoiceRecorder
                    disabled={busy}
                    onRecorded={(voice) => setFiles((prev) => [...prev, voice])}
                  />
                </div>
                <div style={FIELD_BODY}>
                  {(() => {
                    const voiceItems = files
                      .map((fl, i) => ({ fl, i }))
                      .filter(({ fl }) => isAudioAttachment(fl));
                    if (!voiceItems.length) {
                      return (
                        <div style={FIELD_EMPTY}>
                          {ar
                            ? "لا توجد مقاطع بعد — سجّل من الميكروفون لتظهر هنا."
                            : "No clips yet — record from the mic to list them here."}
                        </div>
                      );
                    }
                    return voiceItems.map(({ fl, i }, idx) => {
                      const audioIndex = idx + 1;
                      return (
                        <VoiceNoteBubble
                          key={`voice-${fl.name || "clip"}-${i}`}
                          src={previewUrls[i] || ""}
                          index={audioIndex}
                          ar={ar}
                          isLast={idx === voiceItems.length - 1}
                          onRemove={() => setFiles((prev) => prev.filter((_, x) => x !== i))}
                        />
                      );
                    });
                  })()}
                </div>
              </div>
            </div>

            {/* Attachments field — same width column */}
            <div style={FIELD_COL}>
              <span style={LABEL_SPAN}>{ar ? "المرفقات" : "Attachments"}</span>
              <div style={FIELD_BOX}>
                <div style={FIELD_TOOLBAR}>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      height: 28,
                      padding: "0 11px",
                      borderRadius: 8,
                      border: "1px dashed #CBD5E1",
                      background: CARD,
                      fontSize: 12,
                      color: MUTED,
                      cursor: "pointer",
                      boxSizing: "border-box",
                    }}
                  >
                    <span>{ar ? "أرفق ملفًا / صوتًا" : "Attach file / audio"}</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.webm,.m4a,.ogg,.mp3,.wav"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const picked = Array.from(e.target.files || []);
                        e.target.value = "";
                        if (picked.length) setFiles((prev) => [...prev, ...picked]);
                      }}
                    />
                  </label>
                </div>
                <div style={FIELD_BODY}>
                  {(() => {
                    const fileItems = files
                      .map((fl, i) => ({ fl, i }))
                      .filter(({ fl }) => !isAudioAttachment(fl));
                    if (!fileItems.length) {
                      return (
                        <div style={FIELD_EMPTY}>
                          {ar
                            ? "لا مرفقات بعد — أرفق ملفًا ليظهر هنا."
                            : "No files yet — attach a file to list it here."}
                        </div>
                      );
                    }
                    return (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "6px 0" }}>
                        {fileItems.map(({ fl, i }) => (
                          <div
                            key={`file-${fl.name || "file"}-${i}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              maxWidth: "100%",
                              height: 30,
                              padding: "0 8px 0 10px",
                              borderRadius: 8,
                              border: "1px solid var(--nv-line, #E2E8F0)",
                              background: SURFACE,
                              fontSize: 12,
                              color: NAVY,
                            }}
                          >
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {fl?.name || (ar ? "مرفق" : "File")}
                            </span>
                            <button
                              type="button"
                              aria-label={ar ? "حذف المرفق" : "Remove attachment"}
                              onClick={() => setFiles((prev) => prev.filter((_, x) => x !== i))}
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: 5,
                                border: "none",
                                background: "transparent",
                                color: MUTED,
                                cursor: "pointer",
                                fontFamily: "inherit",
                                lineHeight: 1,
                                padding: 0,
                              }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            flexShrink: 0,
            padding: "16px 24px 20px",
            borderTop: "1px solid var(--nv-line, #E2E8F0)",
            display: "flex",
            gap: 10,
            background: CARD,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 44,
              padding: "0 18px",
              borderRadius: 12,
              background: CARD,
              border: "1px solid var(--nv-line, #E2E8F0)",
              color: MUTED,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {ar ? "إلغاء" : "Cancel"}
          </button>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
            <button type="submit" disabled={!submitEnabled} style={submitStyle}>
              {ar ? "أنشئ المهمة" : "Create task"}
            </button>
            {submitBlock ? (
              <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.6, textAlign: "center" }}>
                {submitBlock}
              </span>
            ) : null}
          </div>
        </div>
      </form>
    </div>

    </>
  );
}
