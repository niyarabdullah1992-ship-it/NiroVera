import React, { useMemo, useState } from "react";
import {
  OrgCollapsibleArticle,
  ORG_MONO,
  orgGradeColor,
  orgKindChip,
  orgNavChip,
} from "@/components/hr/orgUi";
import AssignEscalationDialog from "@/components/hr/AssignEscalationDialog";
import { deriveBranchEscalationChain } from "@/lib/orgDerivations";
import { setBranchEscalationChain } from "@/lib/orgTree";
import { isHrUnit, workplaceStations } from "@/lib/stationTree";
import { SMART_DEPARTMENTS, saveSmartPosition } from "@/lib/smartPositions";
import { formatOrgStructureEvent, orgStructureEvents } from "@/lib/orgStructureLog";
import { updateCompany } from "@/lib/store";
import {
  addHigherLadderGrade,
  catalogMatchKey,
  createTitleGrade,
  gradeRank,
  gradesForTitle,
  ladderBands,
  jobTitleKey,
  moveTitleGrade,
  orderJobTitleCatalog,
  patchJobGrade,
  removeListGrade,
  setTitleGradeRank,
} from "@/lib/jobGrades";
import { addListPosition, companyLists, listPositions, removeListPosition } from "@/lib/permissionTemplates";

/** HTML permList — seven gates, each bound to a live department id. */
const PERM_ROWS = [
  { id: "hr", ar: "الهيكل التنظيمي", en: "Org structure", hintAr: "إنشاء الفروع والمناصب والتعيين والتكليف", hintEn: "Branches, seats, hire, and acting" },
  { id: "employees", ar: "ملف الموظف", en: "Employee file", hintAr: "عرض البيانات والوثائق وتعديل المعلومات الشخصية", hintEn: "File, documents, and personal data" },
  { id: "attendance", ar: "الحضور", en: "Attendance", hintAr: "تعديل البصمات ومعالجة الغياب — جدول الدوام في نفس القسم", hintEn: "Stamps and absence — the roster lives in attendance" },
  { id: "tasks", ar: "المهام والعمليات", en: "Operations", hintAr: "تنفيذ ومراجعة وتصعيد المهام — طلباتي تتبع دورة الإثبات", hintEn: "Task execution and review — requests follow the proof cycle" },
  { id: "complaints", ar: "صوت الموظف", en: "Employee voice", hintAr: "استلام الشكاوى والردّ عليها", hintEn: "Receive and answer complaints" },
  { id: "signing", ar: "التوقيع", en: "Signing", hintAr: "ختم واعتماد المستندات", hintEn: "Stamp and approve documents" },
  { id: "work_proof", ar: "إثبات العمل", en: "Work proof", hintAr: "أدلة ميدانية وإثبات للعميل", hintEn: "Field evidence and client proof" },
];

const KIND_CHIPS = [
  ["all", "الكل", "All"],
  ["hire", "تعيين", "Hire"],
  ["acting", "تكليف", "Acting"],
  ["change", "تغيير", "Change"],
  ["move", "نقل", "Move"],
  ["deleted", "حذف", "Delete"],
  ["created", "إنشاء", "Create"],
  ["end", "إنهاء", "End"],
];

const CHANGE_TYPES = new Set(["change", "kind", "parent", "manager"]);

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "؟";
  return parts.slice(0, 2).map((part) => part.slice(0, 1)).join("");
}

function activePeople(data) {
  return (data?.employees || []).filter((employee) => (
    employee?.active !== false
    && employee.role !== "system"
    && employee.profile?.employmentStatus !== "terminated"
  ));
}

function accessOf(permissions, id) {
  const value = permissions?.[id];
  return value === "manage" || value === "view" ? value : "hidden";
}

function accessLabel(value, ar) {
  if (value === "manage") return ar ? "إدارة" : "Manage";
  if (value === "view") return ar ? "عرض" : "View";
  return ar ? "بلا وصول" : "No access";
}

function accessStyle(value) {
  if (value === "manage") {
    return { background: "var(--nv-ok-ink)", color: "#fff", border: "1px solid var(--nv-ok-ink)" };
  }
  if (value === "hidden") {
    return { background: "var(--nv-inset, #F5F6F8)", color: "var(--nv-bad-ink)", border: "1px solid var(--nv-bad-line, #E9C4C9)" };
  }
  return { background: "var(--nv-card)", color: "var(--nv-ink2)", border: "1px solid var(--nv-line)" };
}

function kindTone(type) {
  if (type === "hire" || type === "acting") return "ok";
  if (type === "created") return "navy";
  if (type === "change" || type === "kind" || type === "parent" || type === "move") return "warn";
  if (type === "end" || type === "deleted") return "bad";
  return "mute";
}

function kindStyle(tone) {
  if (tone === "ok") return { color: "#fff", background: "var(--nv-ok-ink)", border: "1px solid var(--nv-ok-ink)" };
  if (tone === "navy") return { color: "#fff", background: "var(--nv-navy)", border: "1px solid var(--nv-navy)" };
  if (tone === "warn") return { color: "#5C4300", background: "#F6E2A8", border: "1px solid var(--nv-warn-fill)" };
  if (tone === "bad") return { color: "#fff", background: "var(--nv-bad-ink)", border: "1px solid var(--nv-bad-ink)" };
  return { color: "var(--nv-ink)", background: "#DDE4F0", border: "1px solid #7C8BA3" };
}

function dotColor(tone) {
  if (tone === "ok") return "var(--nv-ok-ink)";
  if (tone === "navy") return "var(--nv-navy)";
  if (tone === "warn") return "var(--nv-warn-fill)";
  if (tone === "bad") return "var(--nv-bad-ink)";
  return "#C7CCD6";
}

function seasonStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function eventDay(event) {
  return String(event?.at || "").slice(0, 10);
}

function matchesKind(event, kind) {
  if (kind === "all") return true;
  const type = String(event?.type || "");
  if (kind === "change") return CHANGE_TYPES.has(type);
  if (kind === "deleted") return type === "deleted" || type === "delete";
  return type === kind;
}

const stepBtn = {
  width: 24,
  height: 24,
  borderRadius: 7,
  border: "1px solid var(--nv-line)",
  background: "var(--nv-card)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  fontWeight: 700,
  fontFamily: "inherit",
  color: "var(--nv-ink)",
  padding: 0,
};

const gradeInput = {
  height: 30,
  padding: "0 8px",
  borderRadius: 8,
  border: "1px solid var(--nv-line)",
  fontSize: 12,
  color: "var(--nv-ink)",
  background: "var(--nv-card)",
  outline: "none",
  boxSizing: "border-box",
  width: "100%",
  minWidth: 0,
  fontFamily: "inherit",
};

const gradeNumInput = {
  ...gradeInput,
  fontFamily: "'IBM Plex Mono', monospace",
  direction: "ltr",
  unicodeBidi: "isolate",
  textAlign: "center",
};

const ladderCols = "72px minmax(140px,1.1fr) 146px 146px 124px minmax(0,1.3fr) 96px";

const ladderNum = {
  ...gradeNumInput,
  width: 92,
  height: 26,
  borderRadius: 4,
  padding: "0 6px",
  flex: "none",
  background: "#fff",
  fontSize: 12,
  fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
};

const ladderUnit = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 22,
  padding: "0 6px",
  borderRadius: 4,
  border: "1px solid var(--nv-line, #E6E9EF)",
  background: "#fff",
  fontSize: 11,
  color: "var(--nv-ink2)",
  flex: "none",
};

const ladderLevel = {
  ...gradeInput,
  height: 28,
  width: "auto",
  maxWidth: "100%",
  borderRadius: 8,
  background: "#fff",
  padding: "0 10px",
  justifySelf: "start",
};

function GradeCode({ code }) {
  return <span dir="ltr" style={{ unicodeBidi: "isolate" }}>{code || "—"}</span>;
}

function catalogTitles(data) {
  const rows = [];
  companyLists(data).forEach((pack) => {
    listPositions(pack).forEach((position) => {
      rows.push({
        label: position.title,
        listId: pack.id,
        pack,
        positionId: position.id || position.title,
      });
    });
  });
  (data?.orgSeats || []).forEach((seat) => {
    rows.push({ label: seat.title, listId: seat.listId, pack: null, positionId: "" });
  });
  return orderJobTitleCatalog(rows, data);
}

function seatsOnGrade(data, grade, label) {
  const key = jobTitleKey(label);
  return (data?.orgSeats || []).filter((seat) => (
    String(seat.gradeId || "") === String(grade?.id || "")
    && jobTitleKey(seat.title) === key
  )).length;
}

function moneyOrBlank(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? String(n) : "";
}

function rankSummary(count, ar) {
  if (!ar) return count === 1 ? "1 rank" : `${count} ranks`;
  if (count === 1) return "مرتبة واحدة";
  if (count === 2) return "مرتبتان";
  return `${count} مراتب`;
}

function jobCountLabel(count, ar) {
  if (!ar) return count === 1 ? "1 seat" : `${count} seats`;
  if (!count) return "لا وظائف";
  if (count === 1) return "وظيفة واحدة";
  if (count === 2) return "وظيفتان";
  return `${count} وظائف`;
}

function seatsOnBand(data, band) {
  const ids = new Set((band?.grades || []).map((grade) => String(grade.id)));
  return (data?.orgSeats || []).filter((seat) => ids.has(String(seat.gradeId || ""))).length;
}

function GradeLadderTable({ ar, data, companyId, canWrite }) {
  const bands = useMemo(() => ladderBands(data), [data]);
  const saveDigits = (head, key, raw, { leave = false } = {}) => {
    const digits = String(raw || "").replace(/[^0-9]/g, "");
    patchJobGrade(companyId, head.id, { [key]: digits ? (leave ? Math.max(21, Number(digits)) : Number(digits)) : null });
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ overflow: "auto" }}>
        <div style={{ minWidth: 860, display: "grid", gridTemplateColumns: ladderCols, gap: 10, padding: "9px 10px", background: "var(--nv-inset, #F5F6F8)", border: "1px solid var(--nv-soft, #EEF1F5)", borderRadius: 6, fontSize: 11, color: "var(--nv-ink2)", fontWeight: 700 }}>
          <span>{ar ? "الدرجة" : "Grade"}</span>
          <span>{ar ? "المستوى الوظيفي" : "Level"}</span>
          <span>{ar ? "الحدّ الأدنى للراتب" : "Pay from"}</span>
          <span>{ar ? "الحدّ الأعلى للراتب" : "Pay to"}</span>
          <span>{ar ? "الإجازة السنوية" : "Annual leave"}</span>
          <span>{ar ? "المراتب على هذه الدرجة" : "Ranks on this grade"}</span>
          <span>{ar ? "الوظائف" : "Seats"}</span>
        </div>
        {bands.length ? bands.map((band) => {
          const seats = seatsOnBand(data, band);
          const head = band.head;
          const levelText = ar ? band.level : (head.titleEn || band.level);
          const badPay = Number(head.maxSalary) > 0 && Number(head.minSalary) > 0 && Number(head.maxSalary) < Number(head.minSalary);
          const shownRanks = band.ranks.slice(0, 1);
          const more = band.ranks.length - shownRanks.length;
          const productRank = band.rank >= 1 && band.rank <= 7 && /^م[1-7]$/.test(String(band.gradeNumber || ""));
          const canDrop = Boolean(canWrite && band.shared && !band.ranks.length && !seats && !productRank);
          const moneyBox = (key, value, warn) => (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, justifySelf: "start" }}>
              <input
                defaultValue={moneyOrBlank(value)}
                key={`${head.id}:${key}:${value ?? ""}`}
                disabled={!canWrite}
                placeholder="—"
                onBlur={(event) => saveDigits(head, key, event.target.value)}
                style={{ ...ladderNum, borderColor: warn ? "#8A1C2B" : undefined }}
              />
              <span style={ladderUnit}>{ar ? "رس" : "SAR"}</span>
            </span>
          );
          return (
            <div key={band.key} style={{ minWidth: 860, display: "grid", gridTemplateColumns: ladderCols, gap: 10, padding: "8px 10px", borderBottom: "1px solid #F1F4F8", alignItems: "center", fontSize: 12 }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 22, minWidth: 34, padding: "0 6px", borderRadius: 6, font: "700 11px 'Readex Pro', sans-serif", color: "#fff", background: orgGradeColor(Math.max(0, (band.rank || 1) - 1)), justifySelf: "start" }}>
                <GradeCode code={band.gradeNumber} />
              </span>
              <input
                defaultValue={levelText}
                key={`${head.id}:level:${levelText}`}
                disabled={!canWrite}
                placeholder={ar ? "المستوى الوظيفي" : "Level name"}
                onBlur={(event) => {
                  const next = event.target.value.trim();
                  if (next !== String(levelText || "")) patchJobGrade(companyId, head.id, ar ? { title: next } : { titleEn: next });
                }}
                style={ladderLevel}
              />
              {moneyBox("minSalary", head.minSalary, false)}
              {moneyBox("maxSalary", head.maxSalary, badPay)}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, justifySelf: "start" }}>
                <input
                  defaultValue={head.annualLeaveDays ? String(head.annualLeaveDays) : ""}
                  key={`${head.id}:leave:${head.annualLeaveDays ?? ""}`}
                  disabled={!canWrite}
                  placeholder="—"
                  onBlur={(event) => saveDigits(head, "annualLeaveDays", event.target.value, { leave: true })}
                  style={ladderNum}
                />
                <span style={ladderUnit}>{ar ? "يوماً" : "days"}</span>
              </span>
              <div style={{ display: "flex", gap: 4, flexWrap: "nowrap", overflow: "hidden", minWidth: 0, alignItems: "center" }} title={band.ranks.map((rank) => rank.label).join(" · ")}>
                {shownRanks.map((rank) => (
                  <span key={rank.id} style={{ display: "inline-flex", alignItems: "center", height: 22, maxWidth: "100%", padding: "0 7px", borderRadius: 4, background: "var(--nv-inset, #F5F6F8)", border: "1px solid var(--nv-line)", fontSize: 10.5, color: "var(--nv-ink2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {rank.label}
                  </span>
                ))}
                {!band.ranks.length ? <span style={{ fontSize: 10.5, color: "#C5CEC9" }}>—</span> : null}
                {more > 0 ? <span style={{ fontSize: 10.5, color: "var(--nv-muted)", whiteSpace: "nowrap" }}>{`+${more}`}</span> : null}
              </div>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: seats ? "var(--nv-ok-ink, #137A49)" : "var(--nv-muted)", textDecoration: seats ? "underline" : "none" }}>{jobCountLabel(seats, ar)}</span>
                {canDrop ? (
                  <button type="button" title={ar ? "حذف الدرجة" : "Delete grade"} onClick={() => removeListGrade(companyId, head.id)} style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid #E9C4C9", background: "#FBF1F2", color: "#8A1C2B", cursor: "pointer", fontFamily: "inherit" }}>✕</button>
                ) : null}
              </span>
            </div>
          );
        }) : (
          <div style={{ padding: "12px 10px", fontSize: 12, color: "var(--nv-muted)" }}>
            {ar ? "لا درجات على السلّم بعد. الأرقام تُؤخذ مما هو محفوظ." : "No grades on the ladder yet. Figures come from what is stored."}
          </div>
        )}
      </div>
      {canWrite ? (
        <button
          type="button"
          onClick={() => addHigherLadderGrade(companyId)}
          style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", height: 32, padding: "0 12px", borderRadius: 9, border: "1px solid var(--nv-navy, #14213D)", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: "var(--nv-ink)" }}
        >
          {ar ? "+ درجة أعلى" : "+ Higher grade"}
        </button>
      ) : null}
    </div>
  );
}

function GradeLadderArticle({ ar, data, companyId, canWrite, open, onToggle }) {
  const lists = useMemo(() => companyLists(data), [data]);
  const titles = useMemo(() => catalogTitles(data), [data]);
  const [openKey, setOpenKey] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const [rankDraft, setRankDraft] = useState({});
  const [pendingDelete, setPendingDelete] = useState(null);

  const saveNumber = (grade, key, raw, { leave = false } = {}) => {
    if (!canWrite) return;
    const digits = String(raw ?? "").replace(/[^0-9]/g, "");
    if (!digits) {
      patchJobGrade(companyId, grade.id, { [key]: null });
      return;
    }
    const value = leave ? Math.max(21, Number(digits)) : Number(digits);
    patchJobGrade(companyId, grade.id, { [key]: value });
  };

  const addRank = (item) => {
    if (!canWrite) return;
    const owned = gradesForTitle(data, item.label);
    let title = ar ? "مرتبة جديدة" : "New rank";
    let n = 2;
    while (owned.some((grade) => grade.title === title)) {
      title = ar ? `مرتبة جديدة ${n}` : `New rank ${n}`;
      n += 1;
    }
    createTitleGrade(companyId, {
      jobTitle: item.label,
      listId: item.listId,
      listName: item.pack?.ar || lists.find((pack) => pack.id === item.listId)?.ar || "",
      title,
    });
  };

  return (
    <OrgCollapsibleArticle
      title={ar ? "سلّم الدرجات الوظيفية" : "Job grade ladder"}
      extra={<span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{ar ? "الدرجة تُعطى للوظيفة، ومن يشغلها يأخذها" : "The grade is given to the job, and whoever holds it takes it"}</span>}
      open={open}
      onToggle={onToggle}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <GradeLadderTable ar={ar} data={data} companyId={companyId} canWrite={canWrite} />
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", paddingTop: 10, borderTop: "1px solid var(--nv-soft, #EEF1F5)" }}>
          <strong style={{ fontSize: 13 }}>{ar ? "المسارات الوظيفية" : "Career tracks"}</strong>
          <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>
            <span dir="ltr" style={ORG_MONO}>{titles.length}</span>
            {ar ? " مساراً · لكل منصب مراتب، وكل مرتبة مربوطة بدرجة من السلّم" : " tracks · each title owns its ranks, and each rank is tied to a ladder grade"}
          </span>
        </div>
        <div style={{ border: "1px solid var(--nv-soft)", borderRadius: 6, overflow: "hidden" }}>
          {titles.length ? titles.map((item) => {
            const grades = gradesForTitle(data, item.label);
            const expanded = openKey === item.key;
            const slipped = grades.some((grade, index) => index > 0 && (gradeRank(grade) ?? 0) < (gradeRank(grades[index - 1]) ?? 0));
            return (
              <div key={item.key} style={{ borderBottom: "1px solid #F1F4F8" }}>
                <button
                  type="button"
                  onClick={() => setOpenKey(expanded ? "" : item.key)}
                  style={{
                    width: "100%",
                    display: "grid",
                    gridTemplateColumns: "14px minmax(120px,1fr) auto auto",
                    gap: 10,
                    alignItems: "center",
                    padding: "10px 12px",
                    border: 0,
                    background: expanded ? "#F8F9FB" : "#fff",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "start",
                    color: "var(--nv-ink)",
                  }}
                >
                  <span style={{ fontSize: 10, color: "var(--nv-muted)", transform: expanded ? "none" : "rotate(-90deg)" }}>▾</span>
                  <strong style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</strong>
                  <span style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                    {grades.map((grade) => (
                      <span key={grade.id} title={grade.title || ""} dir="ltr" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 18, minWidth: 24, padding: "0 4px", borderRadius: 4, font: "700 10px 'Readex Pro', sans-serif", color: "#fff", background: orgGradeColor(Math.max(0, (gradeRank(grade) || 1) - 1)) }}>
                        <GradeCode code={grade.gradeNumber} />
                      </span>
                    ))}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--nv-muted)", whiteSpace: "nowrap" }}>{rankSummary(grades.length, ar)}</span>
                </button>
                {expanded ? (
                  <div style={{ padding: "8px 12px 12px", background: "#FAFBFC", display: "flex", flexDirection: "column", gap: 8 }}>
                    {grades.map((grade, index) => {
                      const rank = gradeRank(grade);
                      const draft = rankDraft[grade.id];
                      const seats = seatsOnGrade(data, grade, item.label);
                      const badPay = Number(grade.maxSalary) > 0 && Number(grade.minSalary) > 0 && Number(grade.maxSalary) < Number(grade.minSalary);
                      const fieldLabel = (text) => (
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--nv-muted)" }}>{text}</span>
                      );
                      return (
                        <div key={grade.id} style={{ background: "#fff", border: "1px solid var(--nv-line, #E6E9EF)", borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "28px minmax(0,1fr) auto auto", gap: 8, alignItems: "center" }}>
                            <span dir="ltr" style={{ ...ORG_MONO, fontSize: 11, color: "#9AA8BF", textAlign: "center" }}>{index + 1}</span>
                            <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                              {fieldLabel(ar ? "المرتبة" : "Rank")}
                              <input
                                defaultValue={grade.title || ""}
                                key={`${grade.id}:name:${grade.title || ""}`}
                                disabled={!canWrite}
                                onBlur={(event) => {
                                  const next = event.target.value.trim();
                                  if (next && next !== grade.title) patchJobGrade(companyId, grade.id, { title: next });
                                }}
                                style={{ ...gradeInput, height: 30, fontWeight: 600 }}
                              />
                            </label>
                            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              {fieldLabel(ar ? "الدرجة" : "Grade")}
                              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ display: "flex", alignItems: "center", border: "1px solid var(--nv-line)", borderRadius: 5, background: "#fff", overflow: "hidden", height: 30 }}>
                                  <span style={{ padding: "0 7px", font: "700 11px 'Readex Pro', sans-serif", color: "var(--nv-muted)", borderInlineEnd: "1px solid #EEF1F5", height: "100%", display: "inline-flex", alignItems: "center" }}>م</span>
                                  <input
                                    inputMode="numeric"
                                    value={draft != null ? draft : (rank ? String(rank) : "")}
                                    disabled={!canWrite}
                                    onChange={(event) => setRankDraft((current) => ({ ...current, [grade.id]: event.target.value.replace(/[^0-9]/g, "") }))}
                                    onBlur={(event) => {
                                      const raw = String(event.target.value || "").replace(/[^0-9]/g, "");
                                      if (raw) setTitleGradeRank(companyId, grade.id, raw);
                                      setRankDraft((current) => {
                                        const next = { ...current };
                                        delete next[grade.id];
                                        return next;
                                      });
                                    }}
                                    style={{ width: 38, height: "100%", border: 0, outline: "none", textAlign: "center", font: "600 13px 'IBM Plex Mono', monospace", color: "var(--nv-ink)", background: "transparent" }}
                                  />
                                </span>
                                <span title={grade.gradeNumber || ""} dir="ltr" style={{ fontSize: 10.5, color: "#fff", padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap", background: orgGradeColor(Math.max(0, (rank || 1) - 1)) }}>
                                  <GradeCode code={grade.gradeNumber} />
                                </span>
                              </span>
                            </label>
                            <div style={{ display: "flex", gap: 4, alignSelf: "end", paddingBottom: 2 }}>
                              <button type="button" title={ar ? "أعلى" : "Up"} disabled={!canWrite || index === 0} onClick={() => moveTitleGrade(companyId, grade.id, -1)} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--nv-line)", background: "#fff", cursor: index ? "pointer" : "default", color: index ? "var(--nv-ink2)" : "#DFE3EA", fontFamily: "inherit" }}>▲</button>
                              <button type="button" title={ar ? "حذف المرتبة" : "Delete rank"} disabled={!canWrite || grades.length <= 1 || seats > 0} onClick={() => setPendingDelete({ id: grade.id, name: grade.title || grade.gradeNumber, title: item.label })} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #E9C4C9", background: "#FBF1F2", color: grades.length > 1 && !seats ? "#8A1C2B" : "#DFE3EA", cursor: grades.length > 1 && !seats ? "pointer" : "default", fontFamily: "inherit" }}>✕</button>
                            </div>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))", gap: 8 }}>
                            <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                              {fieldLabel(ar ? "الخبرة" : "Experience")}
                              <input
                                defaultValue={grade.experience || ""}
                                key={`${grade.id}:exp:${grade.experience || ""}`}
                                disabled={!canWrite}
                                placeholder={ar ? "0–2 سنة" : "0–2 years"}
                                onBlur={(event) => patchJobGrade(companyId, grade.id, { experience: event.target.value.trim() })}
                                style={{ ...gradeInput, height: 30 }}
                              />
                            </label>
                            <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                              {fieldLabel(ar ? "الشرط" : "Condition")}
                              <input
                                defaultValue={grade.requirement || ""}
                                key={`${grade.id}:req:${grade.requirement || ""}`}
                                disabled={!canWrite}
                                placeholder={ar ? "بلا شرط" : "No condition"}
                                onBlur={(event) => patchJobGrade(companyId, grade.id, { requirement: event.target.value.trim() })}
                                style={{ ...gradeInput, height: 30 }}
                              />
                            </label>
                            <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                              {fieldLabel(ar ? "الراتب من" : "Pay from")}
                              <input defaultValue={moneyOrBlank(grade.minSalary)} key={`${grade.id}:min:${grade.minSalary ?? ""}`} disabled={!canWrite} onBlur={(event) => saveNumber(grade, "minSalary", event.target.value)} style={gradeNumInput} />
                            </label>
                            <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                              {fieldLabel(ar ? "الراتب إلى" : "Pay to")}
                              <input defaultValue={moneyOrBlank(grade.maxSalary)} key={`${grade.id}:max:${grade.maxSalary ?? ""}`} disabled={!canWrite} onBlur={(event) => saveNumber(grade, "maxSalary", event.target.value)} style={{ ...gradeNumInput, borderColor: badPay ? "#8A1C2B" : undefined }} />
                            </label>
                            <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                              {fieldLabel(ar ? "الإجازة" : "Leave")}
                              <input defaultValue={grade.annualLeaveDays ? String(grade.annualLeaveDays) : ""} key={`${grade.id}:leave:${grade.annualLeaveDays ?? ""}`} disabled={!canWrite} onBlur={(event) => saveNumber(grade, "annualLeaveDays", event.target.value, { leave: true })} style={gradeNumInput} />
                            </label>
                          </div>
                          <span style={{ fontSize: 11, color: seats ? "var(--nv-ok-ink)" : "#9AA8BF" }}>{seats ? (ar ? `${seats} وظائف على هذه المرتبة` : `${seats} seats on this rank`) : (ar ? "لا وظائف على هذه المرتبة" : "No seats on this rank")}</span>
                        </div>
                      );
                    })}
                    {!grades.length ? (
                      <span style={{ fontSize: 12, color: "var(--nv-muted)" }}>{ar ? "لا مراتب بعد. أضف مرتبة على سلّم هذا المنصب وحده." : "No ranks yet. Add one on this title’s own ladder."}</span>
                    ) : null}
                    {slipped ? <span style={{ fontSize: 11, color: "#8A1C2B" }}>{ar ? "تنبيه: مرتبة بدرجة أقل من المرتبة التي قبلها." : "A rank sits below the grade before it."}</span> : null}
                    {canWrite ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 4 }}>
                        <button type="button" onClick={() => addRank(item)} style={{ height: 28, padding: "0 11px", borderRadius: 5, border: "1px dashed #9AA8BF", background: "#fff", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{ar ? "＋ مرتبة" : "+ Rank"}</button>
                        {item.pack ? (
                          <button type="button" onClick={() => setPendingDelete({ track: item, name: item.label })} style={{ border: 0, background: "transparent", fontSize: 11, color: "#8A1C2B", cursor: "pointer", fontFamily: "inherit" }}>{ar ? "حذف المسار" : "Delete track"}</button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          }) : (
            <span style={{ display: "block", padding: 12, fontSize: 12, color: "var(--nv-muted)" }}>{ar ? "أضف مساراً، ثم ابنِ مراتبه." : "Add a track, then build its ranks."}</span>
          )}
        </div>
        {canWrite && lists[0] ? (
          <div style={{ display: "flex", gap: 6 }}>
            <input value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} placeholder={ar ? "مسار جديد — مثال: فني تبريد" : "New track — e.g. cooling technician"} style={{ ...gradeInput, height: 34, flex: 1, borderRadius: 6 }} />
            <button
              type="button"
              onClick={() => {
                const name = titleDraft.trim();
                const result = addListPosition(companyId, lists[0], name);
                if (!result?.ok || !name) return;
                createTitleGrade(companyId, {
                  jobTitle: name,
                  listId: lists[0].id,
                  listName: lists[0].ar || lists[0].en || "",
                  title: ar ? "مبتدئ" : "Junior",
                });
                setOpenKey(catalogMatchKey(name));
                setTitleDraft("");
              }}
              style={{ height: 34, padding: "0 14px", borderRadius: 6, border: 0, background: "var(--nv-ok-ink)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
            >
              {ar ? "إضافة مسار" : "Add track"}
            </button>
          </div>
        ) : null}
        <span style={{ fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.8 }}>
          {ar
            ? "المرتبة التالية لا تكون بدرجة أقل من سابقتها. الترقية داخل المسار نقل مرتبة، والانتقال لمسار آخر تغيير منصب. كل مسمّى يحتفظ بدرجاته. الإجازة بالأيام (21 حدّ أدنى، و30 بعد خمس سنوات — المادة 109). التكليف مسموح بدرجة واحدة فوق درجة المكلَّف كحدّ أقصى. درجة المنصب الجديد يجب أن تكون أقل من درجة المدير."
            : "The next rank should not sit below the one before it. Promotion stays inside the track; another track is a different title. Each title keeps its own grades. Leave is in days (21 minimum, 30 after five years). Acting may rise one grade at most. A new seat’s grade must be below the manager’s grade."}
        </span>
      </div>
      {pendingDelete ? (
        <div style={{ background: "#FBF1F2", border: "1px solid #E9C4C9", borderRadius: 10, padding: "10px 12px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#8A1C2B", flex: 1 }}>
            {pendingDelete.track
              ? (ar ? `حذف مسار «${pendingDelete.name}» من الدليل؟ الوظائف القائمة تبقى.` : `Remove the “${pendingDelete.name}” track from the catalog? Seats already created stay.`)
              : (ar ? `حذف المرتبة «${pendingDelete.name}» من مسار ${pendingDelete.title}؟` : `Delete rank “${pendingDelete.name}” from ${pendingDelete.title}?`)}
          </span>
          <button
            type="button"
            onClick={() => {
              if (pendingDelete.track) {
                const rows = pendingDelete.track.removals?.length
                  ? pendingDelete.track.removals
                  : [{ pack: pendingDelete.track.pack, positionId: pendingDelete.track.positionId }];
                rows.forEach((row) => removeListPosition(companyId, row.pack, row.positionId));
              } else {
                removeListGrade(companyId, pendingDelete.id);
              }
              setPendingDelete(null);
            }}
            style={{ height: 32, padding: "0 12px", borderRadius: 9, border: 0, background: "#8A1C2B", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
          >
            {ar ? "نعم، احذف" : "Yes, delete"}
          </button>
          <button type="button" onClick={() => setPendingDelete(null)} style={{ height: 32, padding: "0 12px", borderRadius: 9, border: "1px solid var(--nv-line)", background: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
            {ar ? "إلغاء" : "Cancel"}
          </button>
        </div>
      ) : null}
    </OrgCollapsibleArticle>
  );
}

/**
 * HTML bottom grid — grade ladder, escalation, seat permissions, event log.
 * Figures come from live grades, the branch chain, and smart-position grants.
 */
export default function OrgWorkforceAdminPanels({
  ar,
  data,
  companyId,
  canWrite,
  ownerMode = false,
  openEsc,
  openPerm,
  openLog,
  openGrades = false,
  onToggleGrades,
  onToggleEsc,
  onTogglePerm,
  onToggleLog,
  escRef,
  permRef,
  logRef,
  gradesRef,
}) {
  const stations = useMemo(
    () => workplaceStations(data?.stations || []).filter((station) => !isHrUnit(station)),
    [data?.stations],
  );
  const people = useMemo(() => activePeople(data), [data]);
  const [stationId, setStationId] = useState("");
  const [permEmployeeId, setPermEmployeeId] = useState("");
  const [logView, setLogView] = useState("live");
  const [logKind, setLogKind] = useState("all");
  const [assignForStation, setAssignForStation] = useState("");

  const selectedStation = stationId || String(stations[0]?.id || "");
  const chain = useMemo(
    () => (selectedStation ? deriveBranchEscalationChain(selectedStation, data) : []),
    [selectedStation, data],
  );
  const slaList = data?.branchEscalationSla?.[selectedStation] || [];

  const permEmployee = people.find((employee) => String(employee.id) === String(permEmployeeId)) || people[0] || null;
  const position = (data?.smartPositions || []).find((item) => String(item.employeeId) === String(permEmployee?.id || ""));
  const permissions = position?.permissions || {};
  const manageCount = PERM_ROWS.filter((row) => accessOf(permissions, row.id) === "manage").length;

  const events = useMemo(() => orgStructureEvents(data), [data]);
  const start = seasonStart();
  const liveEvents = events.filter((event) => eventDay(event) >= start);
  const archEvents = events.filter((event) => eventDay(event) && eventDay(event) < start);
  const shownEvents = (logView === "arch" ? archEvents : liveEvents).filter((event) => matchesKind(event, logKind)).slice(0, 24);

  const setLevel = (index, employeeId) => {
    if (!companyId || !selectedStation || !canWrite) return;
    const next = chain.map((step) => String(step.employeeId));
    if (employeeId) {
      if (index < next.length) next[index] = employeeId;
      else next.push(employeeId);
    } else if (index < next.length) {
      next.splice(index, 1);
    }
    setBranchEscalationChain(companyId, selectedStation, next);
  };

  const addLevel = () => {
    if (!canWrite || chain.length >= 6) return;
    const used = new Set(chain.map((step) => String(step.employeeId)));
    const nextPerson = people.find((employee) => !used.has(String(employee.id)));
    if (!nextPerson) return;
    setLevel(chain.length, nextPerson.id);
  };

  const dropLevel = () => {
    if (!canWrite || chain.length < 2) return;
    setBranchEscalationChain(
      companyId,
      selectedStation,
      chain.slice(0, -1).map((step) => String(step.employeeId)),
    );
  };

  const setSla = (index, hours) => {
    if (!companyId || !selectedStation || !canWrite) return;
    const value = Math.max(1, Number(hours) || 1);
    updateCompany(companyId, (draft) => {
      const key = String(selectedStation);
      const prev = Array.isArray(draft.branchEscalationSla?.[key]) ? draft.branchEscalationSla[key].slice() : [];
      prev[index] = value;
      draft.branchEscalationSla = { ...(draft.branchEscalationSla || {}), [key]: prev };
    });
  };

  const cyclePerm = (row) => {
    if (!companyId || !permEmployee || !canWrite) return;
    const department = SMART_DEPARTMENTS.find((item) => item.id === row.id);
    if (department?.ownerOnly && !ownerMode) return;
    const current = accessOf(permissions, row.id);
    const next = current === "view" ? "manage" : current === "manage" ? "hidden" : "view";
    const title = position?.title || permEmployee.profile?.position || permEmployee.jobTitle || row.ar;
    saveSmartPosition(companyId, permEmployee.id, title, { ...permissions, [row.id]: next }, Boolean(position?.titleManual));
  };

  const kindLabel = (id) => {
    const row = KIND_CHIPS.find((chip) => chip[0] === id);
    if (row) return ar ? row[1] : row[2];
    return id;
  };

  return (
    <div className="nv-org-admin-grid">
      <div ref={gradesRef} style={{ gridColumn: "1 / -1" }}>
        <GradeLadderArticle
          ar={ar}
          data={data}
          companyId={companyId}
          canWrite={canWrite}
          open={openGrades}
          onToggle={onToggleGrades}
        />
      </div>
      <div ref={escRef}>
        <OrgCollapsibleArticle
          title={ar ? "سلسلة التصعيد — الشكاوى" : "Escalation chain — voice"}
          open={openEsc}
          onToggle={onToggleEsc}
          extra={openEsc ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{ar ? "عدد المستويات" : "Levels"}</span>
              <button type="button" onClick={dropLevel} style={stepBtn} aria-label={ar ? "مستوى أقل" : "Fewer levels"}>−</button>
              <span dir="ltr" style={{ ...ORG_MONO, fontSize: 13 }}>{chain.length}</span>
              <button type="button" onClick={addLevel} style={stepBtn} aria-label={ar ? "مستوى أكثر" : "More levels"}>＋</button>
            </span>
          ) : null}
          meta={!openEsc ? (
            <span>
              <span dir="ltr" style={ORG_MONO}>{chain.length}</span>
              {ar ? " مستويات · انقر للعرض" : " levels · click to open"}
            </span>
          ) : null}
        >
          <p style={{ margin: 0, fontSize: 11.5, color: "var(--nv-ink2)", lineHeight: 1.75 }}>
            {ar
              ? "التصعيد يُعيَّن على الوظيفة لا الشخص: إن كان على الوظيفة مكلَّف، وصلت إليه الشكوى تلقائياً في مدته. كل مستوى له مهلة قبل الانتقال إلى ما فوقه."
              : "Escalation sits on the seat, not the person. Each level has a window before the case climbs."}
          </p>
          {stations.length > 1 ? (
            <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: "var(--nv-muted)" }}>
              {ar ? "الفرع" : "Branch"}
              <select
                value={selectedStation}
                onChange={(event) => setStationId(event.target.value)}
                style={{ height: 34, padding: "0 10px", borderRadius: 10, border: "1px solid var(--nv-line)", fontSize: 12, color: "var(--nv-ink)", background: "var(--nv-card)", fontFamily: "inherit" }}
              >
                {stations.map((station) => (
                  <option key={station.id} value={station.id}>{station.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {chain.map((step, index) => {
              const employee = people.find((item) => String(item.id) === String(step.employeeId));
              const name = step.name || employee?.name || "—";
              const title = employee?.profile?.position || employee?.jobTitle || (ar ? "شاغل المستوى" : "Level holder");
              const empNo = employee?.employeeNo || employee?.profile?.employeeNo || "";
              const sla = slaList[index] || "";
              return (
                <div
                  key={`${step.employeeId}-${index}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto minmax(0,1fr) 82px",
                    gap: 10,
                    alignItems: "center",
                    background: "var(--nv-card)",
                    border: "1px solid #E7E9EF",
                    borderRadius: 14,
                    padding: "12px 14px",
                    boxShadow: "0 1px 2px var(--nv-shadow2), 0 8px 20px var(--nv-shadow)",
                  }}
                >
                  <div style={{ position: "relative", flex: "none" }}>
                    <span style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--nv-soft)", color: "var(--nv-ink)", display: "inline-flex", alignItems: "center", justifyContent: "center", font: "600 12px 'Readex Pro', sans-serif" }}>
                      {initials(name)}
                    </span>
                    <span style={{ position: "absolute", bottom: -4, insetInlineStart: -4, width: 20, height: 20, borderRadius: "50%", border: "2px solid #fff", background: index === chain.length - 1 ? "var(--nv-navy)" : "var(--nv-soft)", color: index === chain.length - 1 ? "#fff" : "var(--nv-ink)", display: "inline-flex", alignItems: "center", justifyContent: "center", font: "600 10px 'IBM Plex Mono', monospace" }}>
                      {index + 1}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <strong style={{ fontSize: 12.5, color: "var(--nv-ink)", lineHeight: 1.3 }}>{name}</strong>
                    <span style={{ fontSize: 10.5, color: "var(--nv-ink2)", lineHeight: 1.3 }}>{title}</span>
                    {empNo ? (
                      <span dir="ltr" style={{ ...ORG_MONO, fontSize: 9.5, color: "var(--nv-muted)", textAlign: "end" }}>{empNo}</span>
                    ) : null}
                    <select
                      value={String(step.employeeId)}
                      disabled={!canWrite}
                      onChange={(event) => setLevel(index, event.target.value)}
                      style={{ marginTop: 4, height: 28, padding: "0 8px", borderRadius: 8, border: "1px solid var(--nv-line)", fontSize: 11, color: "var(--nv-ink2)", background: "var(--nv-inset, #F7F8FA)", maxWidth: "100%", fontFamily: "inherit" }}
                    >
                      {people.map((employeeOption) => (
                        <option key={employeeOption.id} value={employeeOption.id}>
                          {(employeeOption.profile?.position || employeeOption.jobTitle || (ar ? "موظف" : "Employee"))}
                          {" — "}
                          {employeeOption.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 9.5, color: "var(--nv-muted)" }}>
                    {ar ? "المهلة (ساعة)" : "Window (h)"}
                    <input
                      type="number"
                      min={1}
                      value={sla}
                      placeholder="24"
                      disabled={!canWrite}
                      onChange={(event) => setSla(index, event.target.value)}
                      style={{ height: 30, padding: "0 8px", borderRadius: 9, border: "1px solid var(--nv-line)", font: "500 12px 'IBM Plex Mono', monospace", direction: "ltr", color: "var(--nv-ink)", outline: "none" }}
                    />
                  </label>
                </div>
              );
            })}
          </div>
          <span style={{ fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.7 }}>
            {ar
              ? "المستوى الأخير يُفترض أن يكون خارج الفرع (العمليات أو الموارد البشرية) حتى لا تُقفل الشكوى داخل من هي عليه."
              : "The last level should sit outside the branch so the case is not closed by the person it is about."}
          </span>
          {canWrite ? (
            <button type="button" onClick={() => setAssignForStation(selectedStation)} style={{ ...orgNavChip(), alignSelf: "flex-start" }}>
              {ar ? "مسؤول واحد لعدة فروع" : "One handler · many branches"}
            </button>
          ) : null}
        </OrgCollapsibleArticle>
      </div>

      <div ref={permRef}>
        <OrgCollapsibleArticle
          title={ar ? "صلاحيات الإدارة" : "Admin permissions"}
          meta={(
            <span>
              <span dir="ltr" style={ORG_MONO}>{PERM_ROWS.length}</span>
              {ar ? " أقسام · على الوظيفة لا الشخص" : " modules · on the seat, not the person"}
            </span>
          )}
          open={openPerm}
          onToggle={onTogglePerm}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: "var(--nv-muted)" }}>
            {ar ? "الوظيفة" : "Seat"}
            <select
              value={permEmployee ? String(permEmployee.id) : ""}
              onChange={(event) => setPermEmployeeId(event.target.value)}
              style={{ height: 34, padding: "0 10px", borderRadius: 10, border: "1px solid var(--nv-line)", fontSize: 12, color: "var(--nv-ink)", background: "var(--nv-card)", fontFamily: "inherit" }}
            >
              {people.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {(employee.profile?.position || employee.jobTitle || (ar ? "موظف" : "Employee"))}
                  {" — "}
                  {employee.name}
                </option>
              ))}
            </select>
          </label>
          {permEmployee ? (
            <div style={{ display: "flex", gap: 11, alignItems: "center", background: "var(--nv-card)", border: "1px solid #E7E9EF", borderRadius: 14, padding: "12px 14px", boxShadow: "0 1px 2px var(--nv-shadow2), 0 8px 20px var(--nv-shadow)" }}>
              <span style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--nv-soft)", color: "var(--nv-ink)", display: "inline-flex", alignItems: "center", justifyContent: "center", font: "600 12px 'Readex Pro', sans-serif", flex: "none" }}>
                {initials(permEmployee.name)}
              </span>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <strong style={{ fontSize: 12.5, color: "var(--nv-ink)" }}>{permEmployee.name}</strong>
                <span style={{ fontSize: 10.5, color: "var(--nv-ink2)" }}>{permEmployee.profile?.position || permEmployee.jobTitle || "—"}</span>
                <span dir="ltr" style={{ ...ORG_MONO, fontSize: 9.5, color: "var(--nv-muted)", textAlign: "end" }}>
                  {permEmployee.employeeNo || permEmployee.profile?.employeeNo || ""}
                </span>
              </div>
              <span style={{ fontSize: 10.5, color: "var(--nv-ok-ink)", fontWeight: 700, whiteSpace: "nowrap" }}>
                {manageCount} / {PERM_ROWS.length} {ar ? "إدارة" : "manage"}
              </span>
            </div>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {PERM_ROWS.map((row) => {
              const department = SMART_DEPARTMENTS.find((item) => item.id === row.id);
              const locked = Boolean(department?.ownerOnly && !ownerMode);
              const value = accessOf(permissions, row.id);
              return (
                <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", border: "1px solid var(--nv-line)", borderRadius: 10 }}>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <strong style={{ fontSize: 12 }}>{ar ? row.ar : row.en}</strong>
                    <span style={{ fontSize: 10, color: "var(--nv-muted)" }}>{ar ? row.hintAr : row.hintEn}</span>
                  </div>
                  <button
                    type="button"
                    disabled={!canWrite || !permEmployee || locked}
                    onClick={() => cyclePerm(row)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 76,
                      height: 28,
                      padding: "0 12px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: canWrite && !locked ? "pointer" : "default",
                      fontFamily: "inherit",
                      flex: "none",
                      ...accessStyle(value),
                    }}
                  >
                    {accessLabel(value, ar)}
                  </button>
                </div>
              );
            })}
          </div>
          <span style={{ fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.7 }}>
            {ar
              ? "انقر الزرّ ليتنقّل بين عرض ← إدارة ← بلا وصول. الصلاحية تنتقل إلى المكلَّف مدة تكليفه، وكل تغيير يُسجَّل في سجل الأحداث."
              : "Click to cycle view → manage → no access. The grant follows the acting holder, and the change is logged."}
          </span>
        </OrgCollapsibleArticle>
      </div>

      <div ref={logRef}>
        <OrgCollapsibleArticle
          title={ar ? "سجل الأحداث" : "Event log"}
          meta={(
            <span>
              <span dir="ltr" style={ORG_MONO}>{events.length}</span>
              {ar ? " تغييراً · الأحدث أولاً" : " changes · newest first"}
            </span>
          )}
          open={openLog}
          onToggle={onToggleLog}
        >
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" onClick={() => setLogView("live")} style={logView === "live" ? { ...orgNavChip(), background: "var(--nv-navy)", color: "#fff", border: "1px solid var(--nv-navy)" } : orgNavChip()}>
              {ar ? "هذا الموسم" : "This season"}
              {" "}
              <span dir="ltr" style={ORG_MONO}>{liveEvents.length}</span>
            </button>
            <button type="button" onClick={() => setLogView("arch")} style={logView === "arch" ? { ...orgNavChip(), background: "var(--nv-navy)", color: "#fff", border: "1px solid var(--nv-navy)" } : orgNavChip()}>
              {ar ? "الأرشيف" : "Archive"}
              {" "}
              <span dir="ltr" style={ORG_MONO}>{archEvents.length}</span>
            </button>
            <span style={{ flex: 1 }} />
            {KIND_CHIPS.map(([id]) => (
              <button key={id} type="button" onClick={() => setLogKind(id)} style={orgKindChip(logKind === id)}>
                {kindLabel(id)}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", borderInlineStart: "2px solid var(--nv-line)", marginInlineStart: 6, paddingInlineStart: 12, maxHeight: 340, overflow: "auto" }}>
            {shownEvents.length ? shownEvents.map((event) => {
              const tone = kindTone(event.type);
              return (
                <div key={event.id} style={{ position: "relative", padding: "3px 0 9px" }}>
                  <span aria-hidden style={{ position: "absolute", insetInlineStart: -19, top: 9, width: 10, height: 10, borderRadius: "50%", background: dotColor(tone) }} />
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                    <span style={{ display: "inline-block", padding: "1px 8px", borderRadius: 6, fontSize: 9.5, fontWeight: 700, ...kindStyle(tone) }}>
                      {kindLabel(CHANGE_TYPES.has(String(event.type)) ? "change" : (event.type || "change"))}
                    </span>
                    <span style={{ fontSize: 11.5 }}>{formatOrgStructureEvent(event, ar)}</span>
                  </div>
                  <span dir="ltr" style={{ ...ORG_MONO, fontSize: 10, color: "var(--nv-muted)" }}>
                    {String(event.at || "").replace("T", " ").slice(0, 16)}
                  </span>
                </div>
              );
            }) : (
              <span style={{ fontSize: 11.5, color: "var(--nv-muted)", padding: "6px 0" }}>
                {ar ? "لا أحداث في هذا النطاق." : "No events in this range."}
              </span>
            )}
          </div>
          <span style={{ fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.7 }}>
            {logView === "arch"
              ? (ar ? "الأرشيف: أحداث ما قبل هذا الشهر — محفوظة للتدقيق ولا تُحذف ولا تُعدّل." : "Archive: events before this month — kept for audit, not edited.")
              : (ar ? "كل إجراء في الهيكل — إنشاء، تعيين، تكليف، نقل، تغيير، إنهاء، حذف — يُكتب هنا باسم من قام به، ويُؤرشَف بانتهاء الموسم." : "Every structure action is written here in the actor’s name, then archived when the season ends.")}
          </span>
        </OrgCollapsibleArticle>
      </div>

      {assignForStation && companyId ? (
        <AssignEscalationDialog
          stationId={assignForStation}
          data={data}
          companyId={companyId}
          ar={ar}
          onClose={() => setAssignForStation("")}
        />
      ) : null}
    </div>
  );
}
