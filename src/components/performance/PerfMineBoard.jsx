import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PlatformDateField from "@/components/shared/PlatformDateField";
import { AR_GREGORIAN_MONTHS } from "@/lib/dateFormat";
import { taskBelongsTo, taskIsProven, provenTaskWeight } from "@/lib/hcmDerivations";
import { countPersonalHseDuty } from "@/lib/perfDerivations";
import {
  PERF_DRIVERS,
  isoDay,
  jobOf,
  monthsInRange,
  personFacts,
  personProofEntries,
  scoreOf,
} from "@/lib/perfRange";

const mono = { fontFamily: "'IBM Plex Mono', monospace" };
const DASH = "—";
const HEADER = "linear-gradient(135deg,#0B3D27 0%,#0F5535 100%)";
const ACTION = "#3C7D50";
const GOLD = "#C8A45A";
const DANGER = "#9B2335";
const INK = "var(--nv-ink)";
const BODY = "var(--nv-ink2)";
const MUTED = "var(--nv-muted)";
const LINE = "var(--nv-line)";
const CARD = "var(--nv-card)";
const SOFT = "var(--nv-soft)";
const OK_SOFT = "var(--nv-ok-soft)";
const OK_INK = "var(--nv-ok-ink)";

const DRIVER_COLOR = {
  done: ACTION,
  time: "#0B3D27",
  safe: GOLD,
  cover: "#8E9A93",
};

const TIPS = {
  done: {
    ar: "الإنجاز يُحسب من المهام المعتمدة فقط. أرسل المهمة للاعتماد فور اكتمالها.",
    en: "Done counts approved tasks only. Send the task for approval as soon as it is complete.",
  },
  time: {
    ar: "الموعد ينخفض إذا أُغلقت المهمة بعده. اطلب تمديداً قبل الموعد بدل التأخر.",
    en: "On-time falls when a task closes after its due date. Ask for an extension before the date.",
  },
  safe: {
    ar: "السلامة ترتفع بإغلاق البلاغات المفتوحة باسمك واستيفاء التفتيش.",
    en: "Safety rises when open reports in your name are closed and inspections are met.",
  },
  cover: {
    ar: "التغطية أضعف محرّك: أرفق صورة قبل وبعد في كل خطوة، لا في نهاية المهمة فقط.",
    en: "Coverage is the weakest driver: attach a before and after photo on every step, not only at the end.",
  },
};

const LAWS = [
  { cite: "المادة 80", ar: "الدرجة وحدها لا تكون سبباً لإنهاء العقد.", en: "A score alone is never grounds for dismissal." },
  { cite: "المادة 61", ar: "الأوزان نفسها لمن في الوظيفة نفسها.", en: "The same weights for the same job." },
  { cite: "قاعدة المنصة", ar: "لا نقطة بلا إثبات معتمد.", en: "No point without approved proof." },
];

const card = {
  background: CARD,
  border: `1px solid ${LINE}`,
  borderRadius: 14,
  boxShadow: "0 1px 2px rgba(12,20,16,.04)",
};

function shown(value) {
  return value == null || value === "" ? DASH : String(value);
}

function quietFacts(facts) {
  return !facts || (!facts.assigned && !facts.proof && facts.safe === 100 && facts.cover === 100);
}

function monthStart(iso, delta) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(1);
  date.setMonth(date.getMonth() + delta);
  return isoDay(date);
}

function minePresets(today, floor = "") {
  const year = Number(today.slice(0, 4));
  const q2End = `${year}-06-30`;
  const raw = [
    { id: "m", from: monthStart(today, 0), to: today, labelAr: "هذا الشهر", labelEn: "This month" },
    { id: "3", from: monthStart(today, -2), to: today, labelAr: "آخر 3 أشهر", labelEn: "Last 3 months" },
    { id: "6", from: monthStart(today, -5), to: today, labelAr: "آخر 6 أشهر", labelEn: "Last 6 months" },
    { id: "q2", from: `${year}-04-01`, to: q2End > today ? today : q2End, labelAr: "الربع الثاني", labelEn: "Second quarter" },
  ];
  return raw.map((row) => {
    let to = row.to > today ? today : row.to;
    let from = row.from;
    if (floor && to >= floor && from < floor) from = floor;
    if (from > to) from = to;
    return { ...row, from, to };
  });
}

function recordFloor(employee, data) {
  const hire = isoDay(employee?.hireDate || employee?.profile?.hireDate || employee?.joinedAt || "");
  const days = [];
  for (const task of data?.tasks || []) {
    if (!taskBelongsTo(task, employee?.id, employee?.stationId)) continue;
    const day = isoDay(task.approvedAt || task.completedAt || task.dueAt || task.createdAt);
    if (day) days.push(day);
  }
  for (const proof of data?.workProofs || []) {
    const who = String(proof.raiserId || proof.employeeId || proof.ownerId || "");
    if (who !== String(employee?.id || "")) continue;
    const day = isoDay(proof.approvedAt || proof.endedAt || proof.sealedAt || proof.createdAt);
    if (day) days.push(day);
  }
  days.sort();
  const dataStart = days[0] || "";
  if (hire && dataStart) return hire < dataStart ? hire : dataStart;
  return hire || dataStart || "";
}

function monthSlice(key, from, to) {
  const start = `${key}-01`;
  const endDay = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0).getDate();
  let end = `${key}-${String(endDay).padStart(2, "0")}`;
  let begin = start;
  if (from && begin < from) begin = from;
  if (to && end > to) end = to;
  if (begin > end) return null;
  return [begin, end];
}

function previousMonthKey(from) {
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7)) - 1;
  if (month < 1) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthScore(employee, key, from, to, data) {
  const bounds = monthSlice(key, from, to);
  if (!bounds || !employee?.id) return null;
  const facts = personFacts(employee, bounds[0], bounds[1], data);
  if (quietFacts(facts)) return null;
  return scoreOf(facts);
}

function shortDay(iso, ar) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return DASH;
  const day = Number(iso.slice(8, 10));
  const month = Number(iso.slice(5, 7));
  if (ar) return `${day} ${AR_GREGORIAN_MONTHS[month - 1]}`;
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${day} ${names[month - 1]}`;
}

function monthName(key, ar) {
  const month = Number(String(key || "").slice(5, 7));
  if (!month) return DASH;
  if (ar) return AR_GREGORIAN_MONTHS[month - 1];
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month - 1];
}

function bandOfMine(score, ar) {
  if (score == null) return DASH;
  if (score >= 85) return ar ? "متميّز" : "Outstanding";
  if (score >= 70) return ar ? "يفوق المتوقع" : "Above expected";
  if (score >= 55) return ar ? "ضمن المتوقع" : "As expected";
  return ar ? "يحتاج دعماً" : "Needs support";
}

function tasksInRange(employee, from, to, data) {
  return (data?.tasks || []).filter((task) => (
    taskBelongsTo(task, employee?.id, employee?.stationId)
    && isoDay(task.approvedAt || task.completedAt || task.dueAt || task.createdAt) >= from
    && isoDay(task.approvedAt || task.completedAt || task.dueAt || task.createdAt) <= to
  ));
}

function stepLines(task) {
  if (Array.isArray(task?.steps)) return task.steps.map((step) => String(step || "").trim()).filter(Boolean);
  return String(task?.steps || "").split(/\n/).map((step) => step.trim()).filter(Boolean);
}

function coverSource(tasks, ar) {
  let steps = 0;
  let covered = 0;
  for (const task of tasks) {
    const lines = stepLines(task);
    if (!lines.length) continue;
    steps += lines.length;
    const files = (Array.isArray(task.proofFiles) ? task.proofFiles.length : 0)
      + (Array.isArray(task.attachments) ? task.attachments.length : 0);
    const attested = String(task.attestation || "").trim().length > 0;
    if (taskIsProven(task) && (files > 0 || attested)) covered += lines.length;
  }
  if (!steps) return DASH;
  const pct = Math.round((covered / steps) * 100);
  return ar ? `${pct}% من الخطوات مغطاة بإثبات` : `${pct}% of steps covered by proof`;
}

function inspectionCount(employee, data) {
  const records = data?.safety || data?.safetyRecords || [];
  const name = String(employee?.name || "").trim();
  let met = 0;
  for (const rec of records) {
    if (String(rec.stationId || "") !== String(employee?.stationId || "")) continue;
    if (!rec.lastInspection) continue;
    const actor = String(rec.lastActionBy || rec.inspectorName || "").trim();
    const actorId = String(rec.inspectorId || rec.lastActionById || "");
    const mine = (actor && actor === name) || (actorId && actorId === String(employee?.id || ""));
    if (!mine) continue;
    const inspectionEnd = new Date(rec.lastInspection).setHours(23, 59, 59, 999);
    const needsAnother = rec.lastIncidentAt && inspectionEnd < new Date(rec.lastIncidentAt).getTime();
    if (!needsAnother) met += 1;
  }
  return met;
}

function safetySource(employee, data, ar) {
  const records = data?.safety || data?.safetyRecords || [];
  const duty = countPersonalHseDuty(records, employee?.id, employee?.name);
  const open = duty.assignedOpen + duty.personalNotes;
  const openLine = open
    ? (ar ? `${open} بلاغ مفتوح باسمك` : `${open} open report${open === 1 ? "" : "s"} in your name`)
    : (ar ? "لا بلاغ مفتوح باسمك" : "No open report in your name");
  const met = inspectionCount(employee, data);
  if (!met) return openLine;
  const insp = ar
    ? (met === 1 ? "جولة تفتيش مستوفاة" : met === 2 ? "جولتا تفتيش مستوفاة" : `${met} جولات تفتيش مستوفاة`)
    : `${met} inspection${met === 1 ? "" : "s"} met`;
  return `${openLine} · ${insp}`;
}

function driverSources(employee, from, to, data, facts, ar) {
  const tasks = tasksInRange(employee, from, to, data);
  const proven = tasks.filter(taskIsProven);
  const onTime = proven.filter((task) => {
    if (!task.dueAt || !task.approvedAt) return true;
    return String(task.approvedAt).slice(0, 10) <= String(task.dueAt).slice(0, 10);
  }).length;
  return {
    done: facts && facts.assigned
      ? (ar ? `${proven.length} من ${facts.assigned} وحدة مستهدفة في المهام المعتمدة` : `${proven.length} of ${facts.assigned} targeted units in approved tasks`)
      : DASH,
    time: proven.length
      ? (ar ? `${onTime} من ${proven.length} مهمة أُغلقت قبل موعدها` : `${onTime} of ${proven.length} tasks closed before the due date`)
      : DASH,
    safe: safetySource(employee, data, ar),
    cover: coverSource(tasks, ar),
  };
}

function KindGlyph({ kind }) {
  const stroke = OK_INK;
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  if (kind === "safety") {
    return (
      <svg {...common}>
        <path d="M12 3 5 6v6c0 4.2 2.8 7.4 7 9 4.2-1.6 7-4.8 7-9V6l-7-3z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    );
  }
  if (kind === "proof") {
    return (
      <svg {...common}>
        <path d="M7 3h7l5 5v13H7z" />
        <path d="M14 3v5h5M9 13h6M9 17h6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 12.5 10.5 15 16 9" />
    </svg>
  );
}

function proofRows(employee, from, to, data) {
  const base = personProofEntries(employee, from, to, data);
  return base.map((row) => {
    const taskId = String(row.id || "").startsWith("task_") ? String(row.id).slice(5) : "";
    const proofId = String(row.id || "").startsWith("proof_") ? String(row.id).slice(6) : "";
    const task = taskId ? (data?.tasks || []).find((item) => String(item.id) === taskId) : null;
    const proof = proofId ? (data?.workProofs || []).find((item) => String(item.id) === proofId) : null;
    const points = task ? provenTaskWeight(task) : (Number(proof?.points) || null);
    const code = String(task?.id || proof?.id || "").trim();
    return {
      ...row,
      kind: task ? "task" : "proof",
      code,
      points: points > 0 ? points : null,
    };
  });
}

function printMine({ ar, employee, job, place, period, score, band, drivers, months }) {
  const title = ar ? "أدائي" : "My performance";
  const rows = drivers.map((driver) => `<tr><td>${driver.name}</td><td>${driver.weight}%</td><td class="n">${driver.value}</td><td>${driver.source}</td></tr>`).join("");
  const cols = months.map((month) => `<td class="n">${month.name}<br><b>${month.score == null ? "—" : month.score}</b></td>`).join("");
  const html = `<!DOCTYPE html><html dir="${ar ? "rtl" : "ltr"}" lang="${ar ? "ar" : "en"}"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:"IBM Plex Sans Arabic",Tahoma,sans-serif;color:#111418;margin:24px}h1{color:#0B3D27;font-size:20px}table{width:100%;border-collapse:collapse;margin-top:12px}td,th{border-bottom:1px solid #E4E9E6;padding:6px 8px;text-align:start;font-size:12px}.n{font-family:"IBM Plex Mono",monospace;direction:ltr}</style></head><body>
<h1>${title}</h1>
<p>${employee?.name || "—"} · ${job || "—"} · ${place || "—"}</p>
<p>${period} · ${score == null ? "—" : score} · ${band}</p>
<table><thead><tr><th>${ar ? "المحرّك" : "Driver"}</th><th>${ar ? "الوزن" : "Weight"}</th><th>${ar ? "النسبة" : "Share"}</th><th>${ar ? "المصدر" : "Source"}</th></tr></thead><tbody>${rows}</tbody></table>
<table><tr>${cols}</tr></table>
<p>${ar ? "درجتك تراها أنت ومديرك المباشر فقط." : "Only you and your direct manager see this score."}</p>
</body></html>`;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  setTimeout(() => { try { win.print(); } catch { /* print blocked */ } }, 300);
}

/** The signed-in person's own derived score. No other people, no cycle tools. */
export default function PerfMineBoard({ lang, employee, data }) {
  const ar = lang === "ar";
  const today = isoDay();
  const floor = useMemo(() => recordFloor(employee, data), [employee, data]);
  const presets = useMemo(() => minePresets(today, floor), [today, floor]);
  const opening = presets.find((row) => row.id === "3") || presets[0];
  const [from, setFrom] = useState(opening.from);
  const [to, setTo] = useState(opening.to);
  const safeTo = to > today ? today : to;
  const safeFrom = from > safeTo ? safeTo : from;
  const valid = Boolean(employee?.id && safeFrom && safeTo && safeFrom <= safeTo);

  const facts = useMemo(
    () => (valid ? personFacts(employee, safeFrom, safeTo, data) : null),
    [valid, employee, safeFrom, safeTo, data],
  );
  const quiet = quietFacts(facts);
  const score = valid && facts && !quiet ? scoreOf(facts) : null;
  const sources = useMemo(
    () => (valid && !quiet ? driverSources(employee, safeFrom, safeTo, data, facts, ar) : null),
    [valid, quiet, employee, safeFrom, safeTo, data, facts, ar],
  );
  const proofs = useMemo(
    () => (valid && !quiet ? proofRows(employee, safeFrom, safeTo, data) : []),
    [valid, quiet, employee, safeFrom, safeTo, data],
  );
  const months = useMemo(() => {
    if (!valid) return [];
    const keys = monthsInRange(safeFrom, safeTo);
    const shownKeys = keys.length > 6 ? keys.slice(-6) : keys;
    return shownKeys.map((key) => ({
      key,
      name: monthName(key, ar),
      score: monthScore(employee, key, safeFrom, safeTo, data),
    }));
  }, [valid, safeFrom, safeTo, employee, data, ar]);
  const prevKey = valid ? previousMonthKey(safeFrom) : "";
  const prevScore = valid ? monthScore(employee, prevKey, `${prevKey}-01`, `${prevKey}-31`, data) : null;
  const delta = score == null || prevScore == null ? null : score - prevScore;
  const station = (data?.stations || []).find((row) => String(row.id) === String(employee?.stationId || ""));
  const job = jobOf(employee);
  const place = String(station?.name || employee?.stationName || "").trim();
  const monthCount = valid ? monthsInRange(safeFrom, safeTo).length : 0;
  const rangeNote = !valid
    ? (ar ? "تاريخ البداية بعد النهاية — صحّح المدى ليُحسب شيء." : "The start is after the end — correct the range so a score can be derived.")
    : (score == null
      ? (ar ? "لا بيانات في هذه الفترة" : "No data in this period")
      : (ar ? `${monthCount} ${monthCount === 1 ? "شهر" : "أشهر"} · متوسط الدرجات الشهرية` : `${monthCount} mo · average of monthly scores`));
  const tips = useMemo(() => {
    if (!facts || quiet || score == null) return [];
    const ranked = PERF_DRIVERS
      .map((driver) => ({ id: driver.id, value: facts[driver.id] }))
      .sort((left, right) => left.value - right.value);
    const weakest = ranked[0]?.id;
    return ranked.slice(0, 3).map((row) => {
      if (row.id === "cover" && row.id === weakest) return TIPS.cover[ar ? "ar" : "en"];
      return TIPS[row.id][ar ? "ar" : "en"];
    });
  }, [facts, quiet, score, ar]);

  const applyFrom = (next) => {
    if (!next) return;
    let value = next;
    if (floor && value < floor) value = floor;
    if (value > today) value = today;
    if (value > safeTo) setTo(value);
    setFrom(value);
  };
  const applyTo = (next) => {
    if (!next) return;
    let value = next;
    if (value > today) value = today;
    if (floor && value < floor) value = floor;
    if (value < safeFrom) setFrom(value);
    setTo(value);
  };

  const period = `${shortDay(safeFrom, ar)} – ${shortDay(safeTo, ar)}`;
  const deltaText = score == null
    ? DASH
    : (prevScore == null
      ? (ar ? "أول فترة مسجّلة" : "First recorded period")
      : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)} ${ar ? "عن" : "vs"} ${monthName(prevKey, ar)}`);

  const driverRows = PERF_DRIVERS.map((driver) => ({
    id: driver.id,
    name: ar ? driver.nameAr : driver.nameEn,
    weight: driver.w,
    value: score == null || !facts ? null : facts[driver.id],
    source: sources ? sources[driver.id] : DASH,
    color: DRIVER_COLOR[driver.id] || ACTION,
  }));

  return (
    <div data-perf-face="self" data-perf-mine="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <style>{`.dark [data-perf-mine] [data-driver="time"] { background: #2F6B43; }`}</style>
      <section data-perf-card style={{ ...card, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 260 }}>
          <strong style={{ fontSize: 13, color: INK }}>{ar ? "فترة العرض" : "Period"}</strong>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {presets.map((preset) => {
              const on = safeFrom === preset.from && safeTo === preset.to;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => { setFrom(preset.from); setTo(preset.to); }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    height: 32,
                    padding: "0 12px",
                    borderRadius: 999,
                    border: on ? "none" : `1px solid ${LINE}`,
                    background: on ? "#0B3D27" : CARD,
                    color: on ? "#fff" : BODY,
                    fontSize: 12,
                    fontWeight: on ? 700 : 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    whiteSpace: "nowrap",
                  }}
                >
                  {ar ? preset.labelAr : preset.labelEn}
                </button>
              );
            })}
          </div>
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: MUTED, fontWeight: 600 }}>
          {ar ? "من" : "From"}
          <PlatformDateField compact ar={ar} value={safeFrom} min={floor || undefined} max={safeTo} onChange={applyFrom} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: MUTED, fontWeight: 600 }}>
          {ar ? "إلى" : "To"}
          <PlatformDateField compact ar={ar} value={safeTo} min={safeFrom} max={today} onChange={applyTo} />
        </label>
        <span style={{ fontSize: 11.5, color: MUTED, alignSelf: "center" }}>{rangeNote}</span>
        <button
          type="button"
          onClick={() => printMine({
            ar,
            employee,
            job,
            place,
            period,
            score,
            band: bandOfMine(score, ar),
            drivers: driverRows,
            months,
          })}
          style={{
            height: 32,
            padding: "0 12px",
            borderRadius: 999,
            border: `1px solid ${LINE}`,
            background: CARD,
            color: INK,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
            marginInlineStart: "auto",
          }}
        >
          {ar ? "حفظ PDF" : "Save PDF"}
        </button>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,340px),1fr))", gap: 14, alignItems: "start" }}>
        <section data-perf-card style={{ ...card, overflow: "hidden", boxShadow: "0 1px 2px rgba(12,20,16,.04), 0 8px 24px rgba(12,20,16,.05)" }}>
          <header style={{ background: HEADER, color: "#fff", padding: "18px 20px", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <div style={{ width: 112, height: 112, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: `conic-gradient(${GOLD} ${score == null ? 0 : score * 3.6}deg, rgba(255,255,255,.14) 0)` }}>
              <div style={{ width: 96, height: 96, borderRadius: "50%", background: "#0B3D27", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <strong dir="ltr" style={{ ...mono, fontSize: 30, fontWeight: 700, lineHeight: 1, color: "#fff" }}>{score == null ? DASH : score}</strong>
                <span style={{ fontSize: 10.5, color: "#A9CDB8" }}>{ar ? "من 100" : "of 100"}</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 11, color: "#A9CDB8", fontWeight: 600 }}>{ar ? "درجتي" : "My score"} · {period}</span>
              <strong style={{ fontSize: 18 }}>{bandOfMine(score, ar)}</strong>
              <span style={{ fontSize: 12, fontWeight: 600, color: delta != null && delta < 0 ? "#F0A8B4" : GOLD }}>{deltaText}</span>
              <span style={{ fontSize: 11.5, color: "#C5DBCD" }}>
                {shown(job)}
                {" · "}
                {shown(place)}
                {" · "}
                {ar ? "الأوزان نفسها لكل الوظيفة" : "The same weights for the whole job"}
              </span>
            </div>
          </header>
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
            <strong style={{ fontSize: 13.5, color: INK }}>{ar ? "المحرّكات" : "Drivers"}</strong>
            {driverRows.map((driver) => (
              <div key={driver.id} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>
                    {driver.name}
                    <span style={{ fontSize: 11, color: MUTED, fontWeight: 500 }}>{` · ${ar ? "وزن" : "weight"} ${driver.weight}%`}</span>
                  </span>
                  <span dir="ltr" style={{ ...mono, fontSize: 12.5, fontWeight: 600, color: INK }}>{driver.value == null ? DASH : `${driver.value}%`}</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: SOFT, overflow: "hidden" }}>
                  <div data-driver={driver.id} style={{ height: "100%", width: `${driver.value == null ? 0 : Math.max(0, Math.min(100, driver.value))}%`, background: driver.color, borderRadius: 999 }} />
                </div>
                <span style={{ fontSize: 11, color: MUTED }}>{driver.source}</span>
              </div>
            ))}
          </div>
          <div style={{ borderTop: `1px solid ${LINE}`, padding: "14px 20px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <strong style={{ fontSize: 13.5, color: INK }}>{ar ? "آخر 6 أشهر" : "Last 6 months"}</strong>
              <span style={{ fontSize: 11, color: MUTED }}>{ar ? "الدرجة الشهرية" : "Monthly score"}</span>
            </div>
            {months.length ? (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${months.length},minmax(0,1fr))`, gap: 8, alignItems: "end", height: 96 }}>
                {months.map((month, index) => {
                  const height = month.score == null ? 8 : Math.max(8, Math.round((month.score / 100) * 64));
                  const current = index === months.length - 1;
                  return (
                    <div key={month.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                      <span dir="ltr" style={{ ...mono, fontSize: 10.5, fontWeight: 600, color: BODY }}>{month.score == null ? DASH : month.score}</span>
                      <div style={{ width: "100%", maxWidth: 44, height, borderRadius: "6px 6px 2px 2px", background: month.score == null ? "transparent" : (current ? ACTION : "#CFE3D6"), border: month.score == null ? `1px dashed ${LINE}` : "none" }} />
                      <span style={{ fontSize: 10.5, color: MUTED }}>{month.name}</span>
                    </div>
                  );
                })}
              </div>
            ) : <span style={{ color: MUTED, fontSize: 12 }}>{DASH}</span>}
          </div>
        </section>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <section data-perf-card style={{ ...card, overflow: "hidden" }}>
            <header style={{ padding: "14px 18px", borderBottom: `1px solid ${LINE}`, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <strong style={{ fontSize: 14, color: INK }}>{ar ? "الأدلة التي بُنيت عليها درجتي" : "Proof behind my score"}</strong>
              <span style={{ fontSize: 11, color: MUTED }}>{proofs.length ? (ar ? `${proofs.length} إثبات معتمد` : `${proofs.length} approved proofs`) : DASH}</span>
            </header>
            {proofs.length ? proofs.map((row) => (
              <Link key={row.id} to={row.href || "/app/tasks"} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderBottom: `1px solid ${SOFT}`, textDecoration: "none", color: "inherit" }}>
                <span style={{ padding: 7, borderRadius: 9, background: OK_SOFT, display: "inline-flex", flex: "none" }}>
                  <KindGlyph kind={row.kind} />
                </span>
                <span style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                  <strong style={{ fontSize: 12.5, color: INK }}>{row.title || DASH}</strong>
                  <span dir="ltr" style={{ ...mono, fontSize: 11, fontWeight: 500, color: MUTED, textAlign: "right" }}>{`${row.code || DASH} · ${row.at || DASH}`}</span>
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: OK_INK, background: OK_SOFT, borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap", fontFamily: "inherit" }}>
                  {row.points == null ? DASH : (ar ? `+${row.points} نقطة` : `+${row.points}`)}
                </span>
              </Link>
            )) : (
              <div style={{ padding: "16px 18px", color: MUTED, fontSize: 13 }}>{DASH}</div>
            )}
          </section>

          <section data-perf-card style={{ ...card, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            <strong style={{ fontSize: 14, color: INK }}>{ar ? "كيف أرفع درجتي" : "How I raise my score"}</strong>
            {tips.length ? tips.map((tip, index) => (
              <div key={tip} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span dir="ltr" style={{ ...mono, flex: "none", width: 22, height: 22, borderRadius: 7, background: OK_SOFT, color: OK_INK, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{index + 1}</span>
                <span style={{ fontSize: 12.5, color: BODY, lineHeight: 1.7 }}>{tip}</span>
              </div>
            )) : <span style={{ color: MUTED, fontSize: 13 }}>{DASH}</span>}
            <span style={{ fontSize: 11, color: MUTED, background: SOFT, border: `1px solid ${LINE}`, borderRadius: 9, padding: "8px 11px", lineHeight: 1.7 }}>
              {ar
                ? "درجتك تراها أنت ومديرك المباشر فقط. لا تُقارن باسمك مع زملائك، ولا تُستخدم وحدها سبباً لإنهاء العقد (المادة 80)."
                : "Only you and your direct manager see your score. Your name is not compared with colleagues, and the score alone is not grounds to end the contract (Article 80)."}
            </span>
          </section>
        </div>
      </div>

      <details data-perf-card style={{ ...card, borderTop: `3px solid ${GOLD}`, padding: "12px 16px" }}>
        <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700, color: INK }}>{ar ? "مرجع الوزارة" : "Ministry reference"}</summary>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          {LAWS.map((row) => (
            <div key={row.cite} style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: 10, alignItems: "start" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: BODY, background: SOFT, border: `1px solid ${LINE}`, borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap" }}>{row.cite}</span>
              <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.75 }}>{ar ? row.ar : row.en}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
