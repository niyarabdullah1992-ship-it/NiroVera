import { MANAGE_SECTIONS } from "@/lib/manageSections";
import { addCategory, addLevel, gradeCategories, moveLevel, peopleOnLevel, removeCategory, removeLevel, renameCategory, renameLevel } from "@/lib/gradeCategories";
import EscalationRoutesBoard from "@/components/hr/EscalationRoutesBoard";
import React, { useEffect, useMemo, useState } from "react";
import {
  OrgCollapsibleArticle,
  ORG_MONO,
  gradeBadge,
  orgKindChip,
} from "@/components/hr/orgUi";
import { Slab, btnGhost, btnPrimary, btnQuiet, filterChip } from "@/components/hr/orgdesign/orgDesignUi";
import { chip, chipButton } from "@/components/schedules/scheduleChrome";
import OrgLookupField from "@/components/hr/OrgLookupField";
import { personLookupOption } from "@/lib/orgLookup";
import AssignEscalationDialog from "@/components/hr/AssignEscalationDialog";
import { deriveBranchEscalationChain } from "@/lib/orgDerivations";
import { setBranchEscalationChain } from "@/lib/orgTree";
import { isHrUnit, workplaceStations } from "@/lib/stationTree";
import { saveSmartPosition } from "@/lib/smartPositions";
import { formatOrgStructureEvent, orgStructureEvents } from "@/lib/orgStructureLog";
import { updateCompany } from "@/lib/store";
import { readBranchEscalationSla } from "@/lib/facts";
import {
  addHigherLadderGrade,
  ladderBands,
  jobTitleKey,
  orderJobTitleCatalog,
  patchJobGrade,
  removeListGrade,
} from "@/lib/jobGrades";
import { companyLists, listPositions } from "@/lib/permissionTemplates";
import NvIcon from "@/components/shared/NvIcon";

/** HTML permList — seven gates, each bound to a live department id. */
const PERM_ROWS = MANAGE_SECTIONS;

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

const CHANGE_TYPES = new Set(["change", "kind", "parent", "manager", "grade", "renamed", "located", "site", "seat", "decision"]);

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
  if (value === "manage") return ar ? "يدير" : "Manages";
  return ar ? "لا يدير" : "No";
}

/** manage = navy (on) · view = outline · no access = mute, dashed — a setting, not an alarm. */
function accessStyle(value) {
  if (value === "manage") return chipButton(true, { minWidth: 76, justifyContent: "center" });
  if (value === "hidden") return chip("mute", { minWidth: 76, justifyContent: "center", borderStyle: "dashed", fontFamily: "inherit", cursor: "pointer" });
  return chipButton(false, { minWidth: 76, justifyContent: "center" });
}

function kindTone(type) {
  if (type === "hire" || type === "acting") return "ok";
  if (type === "created") return "navy";
  if (type === "change" || type === "kind" || type === "parent" || type === "move") return "warn";
  if (type === "end" || type === "deleted") return "bad";
  return "mute";
}

/** An event's kind is a fact, not a status — one quiet mute chip for every kind. */
function kindStyle() {
  return chip("mute", { height: 20, fontSize: 10.5, padding: "0 7px" });
}

function dotColor(tone) {
  return tone === "bad" ? "var(--nv-ink3)" : "var(--nv-mute-fill)";
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
  borderRadius: 8,
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
  ...ORG_MONO,
  direction: "ltr",
  unicodeBidi: "isolate",
  textAlign: "center",
};

const ladderCols = "64px minmax(140px,1.2fr) minmax(250px,1.4fr) 150px 100px";

const ladderNum = {
  ...gradeNumInput,
  width: 92,
  height: 28,
  borderRadius: 8,
  padding: "0 6px",
  flex: "none",
  background: "var(--nv-card)",
  fontSize: 12,
};

const ladderUnit = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 22,
  padding: "0 6px",
  borderRadius: 8,
  border: "1px solid var(--nv-line)",
  background: "var(--nv-soft)",
  fontSize: 11,
  color: "var(--nv-muted)",
  flex: "none",
};

const ladderLevel = {
  ...gradeInput,
  height: 28,
  width: "auto",
  maxWidth: "100%",
  borderRadius: 8,
  background: "var(--nv-card)",
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
        <div style={{ minWidth: 640, display: "grid", gridTemplateColumns: ladderCols, gap: 10, padding: "9px 10px", background: "var(--nv-soft)", borderBottom: "1px solid var(--nv-line2, var(--nv-line))", fontSize: 11, color: "var(--nv-muted)", fontWeight: 600 }}>
          <span>{ar ? "الدرجة" : "Grade"}</span>
          <span>{ar ? "المسمى" : "Name"}</span>
          <span>{ar ? "الراتب (من – إلى)" : "Pay (from – to)"}</span>
          <span>{ar ? "الإجازة السنوية" : "Annual leave"}</span>
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
                style={{ ...ladderNum, borderColor: warn ? "var(--nv-bad-ink)" : undefined }}
              />
              <span style={ladderUnit}>{ar ? "رس" : "SAR"}</span>
            </span>
          );
          return (
            <div key={band.key} style={{ minWidth: 640, display: "grid", gridTemplateColumns: ladderCols, gap: 10, padding: "8px 10px", borderBottom: "1px solid var(--nv-line2, var(--nv-line))", alignItems: "center", fontSize: 12 }}>
              <span style={gradeBadge({ height: 22, minWidth: 34, fontSize: 11, justifySelf: "start" })}>
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
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {moneyBox("minSalary", head.minSalary, false)}
                <span style={{ color: "var(--nv-muted)" }}>–</span>
                {moneyBox("maxSalary", head.maxSalary, badPay)}
              </span>
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
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: seats ? "var(--nv-ink)" : "var(--nv-muted)" }}>{jobCountLabel(seats, ar)}</span>
                {canDrop ? (
                  <button type="button" title={ar ? "حذف الدرجة" : "Delete grade"} aria-label={ar ? "حذف الدرجة" : "Delete grade"} onClick={() => removeListGrade(companyId, head.id)} style={btnQuiet({ color: "var(--nv-bad-ink)" })}>{ar ? "حذف" : "Delete"}</button>
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
          style={{ ...btnGhost(), alignSelf: "flex-start" }}
        >
          {ar ? "＋ درجة" : "+ Grade"}
        </button>
      ) : null}
    </div>
  );
}

function GradeLadderArticle({ ar, data, companyId, canWrite, open, onToggle }) {
  const cats = gradeCategories(data);
  const [newCat, setNewCat] = useState("");
  const [confirmCat, setConfirmCat] = useState("");
  const total = cats.reduce((n, c) => n + c.levels.length, 0);
  const cell = { padding: "10px 12px", borderBottom: "1px solid var(--nv-line2, var(--nv-line))", verticalAlign: "top" };
  const box = { fontFamily: "inherit", fontSize: 12.5, height: 30, border: "1px solid var(--nv-line)", borderRadius: 8, padding: "0 8px", background: "var(--nv-card)", color: "var(--nv-ink)", minWidth: 0 };
  return (
    <OrgCollapsibleArticle
      title={ar ? "سلّم الدرجات الوظيفية" : "Job grade ladder"}
      meta={ar ? `${cats.length} فئات · ${total} مستوى` : `${cats.length} categories · ${total} levels`}
      open={open}
      onToggle={onToggle}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ overflowX: "auto" }}>
          <table data-grade-categories="1" style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
            <thead>
              <tr style={{ background: "var(--nv-soft)", fontSize: 11.5, color: "var(--nv-muted)" }}>
                <th style={{ ...cell, textAlign: "start", width: 190 }}>{ar ? "الفئة" : "Category"}</th>
                <th style={{ ...cell, textAlign: "start" }}>{ar ? "المستويات — من الأدنى إلى الأعلى" : "Levels — lowest to highest"}</th>
                <th style={{ ...cell, textAlign: "center", width: 80 }}>{ar ? "الموظفون" : "People"}</th>
              </tr>
            </thead>
            <tbody>
              {cats.map((cat) => {
                const people = cat.levels.reduce((n, l) => n + peopleOnLevel(data, cat.id, l.id), 0);
                return (
                  <tr key={cat.id} data-grade-category={cat.id}>
                    <td style={cell}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <input
                          defaultValue={cat.name}
                          key={`${cat.id}:${cat.name}`}
                          disabled={!canWrite}
                          onBlur={(e) => { if (e.target.value.trim() !== cat.name) renameCategory(companyId, data, cat.id, e.target.value); }}
                          style={{ ...box, fontWeight: 700, width: "100%" }}
                        />
                        {canWrite ? (confirmCat === cat.id ? (
                          <span style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11 }}>
                            <span style={{ color: "var(--nv-bad-ink)" }}>{ar ? "حذف الفئة؟" : "Delete?"}</span>
                            <button type="button" onClick={() => { removeCategory(companyId, data, cat.id); setConfirmCat(""); }} style={btnQuiet({ color: "var(--nv-bad-ink)" })}>{ar ? "نعم" : "Yes"}</button>
                            <button type="button" onClick={() => setConfirmCat("")} style={btnQuiet()}>{ar ? "لا" : "No"}</button>
                          </span>
                        ) : (
                          <button type="button" disabled={people > 0} title={people ? (ar ? "عليها موظفون — انقلهم أولاً" : "People are on it") : ""} onClick={() => setConfirmCat(cat.id)} style={{ ...btnQuiet({ color: people ? "var(--nv-line)" : "var(--nv-bad-ink)" }), alignSelf: "flex-start", fontSize: 11 }}>{ar ? "حذف الفئة" : "Delete category"}</button>
                        )) : null}
                      </div>
                    </td>
                    <td style={cell}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        {cat.levels.map((lvl, i) => {
                          const n = peopleOnLevel(data, cat.id, lvl.id);
                          return (
                            <span key={lvl.id} data-grade-level={lvl.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid var(--nv-line)", borderRadius: 9, padding: "3px 4px 3px 6px", background: "var(--nv-card)" }}>
                              <span dir="ltr" style={{ ...ORG_MONO, fontSize: 10.5, fontWeight: 700, color: "var(--nv-btn-ink, #fff)", background: "var(--nv-navy)", borderRadius: 6, minWidth: 20, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                              <input
                                defaultValue={lvl.name}
                                key={`${lvl.id}:${lvl.name}`}
                                disabled={!canWrite}
                                onBlur={(e) => { if (e.target.value.trim() !== lvl.name) renameLevel(companyId, data, cat.id, lvl.id, e.target.value); }}
                                style={{ ...box, height: 24, border: "none", width: Math.max(70, lvl.name.length * 9) }}
                              />
                              {n ? <span style={{ fontSize: 10.5, color: "var(--nv-muted)" }}>({n})</span> : null}
                              {canWrite ? (
                                <>
                                  <button type="button" title={ar ? "أدنى" : "Lower"} disabled={i === 0} onClick={() => moveLevel(companyId, data, cat.id, lvl.id, -1)} style={{ border: 0, background: "none", cursor: i ? "pointer" : "default", color: i ? "var(--nv-ink2)" : "var(--nv-line)", fontSize: 11, padding: "0 2px" }}>›</button>
                                  <button type="button" title={ar ? "أعلى" : "Higher"} disabled={i === cat.levels.length - 1} onClick={() => moveLevel(companyId, data, cat.id, lvl.id, 1)} style={{ border: 0, background: "none", cursor: i < cat.levels.length - 1 ? "pointer" : "default", color: i < cat.levels.length - 1 ? "var(--nv-ink2)" : "var(--nv-line)", fontSize: 11, padding: "0 2px" }}>‹</button>
                                  <button type="button" title={n ? (ar ? "عليه موظفون" : "People are on it") : (ar ? "حذف" : "Delete")} disabled={n > 0 || cat.levels.length <= 1} onClick={() => removeLevel(companyId, data, cat.id, lvl.id)} style={{ border: 0, background: "none", cursor: n || cat.levels.length <= 1 ? "default" : "pointer", color: n || cat.levels.length <= 1 ? "var(--nv-line)" : "var(--nv-bad-ink)", padding: "0 2px", display: "inline-flex" }}><NvIcon name="cross" size={11} /></button>
                                </>
                              ) : null}
                            </span>
                          );
                        })}
                        {canWrite ? (
                          <button type="button" onClick={() => addLevel(companyId, data, cat.id, ar ? "مستوى جديد" : "New level")} style={btnGhost({ height: 28, padding: "0 10px" })}>{ar ? "＋ مستوى" : "+ Level"}</button>
                        ) : null}
                      </div>
                    </td>
                    <td style={{ ...cell, textAlign: "center", fontWeight: 700, fontSize: 13 }}><span dir="ltr" style={ORG_MONO}>{people}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {canWrite ? (
          <div style={{ display: "flex", gap: 6 }}>
            <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder={ar ? "فئة جديدة — مثال: المحاسبون" : "New category — e.g. Accountants"} style={{ ...box, height: 32, flex: 1 }} />
            <button type="button" disabled={!newCat.trim()} onClick={() => { addCategory(companyId, data, newCat); setNewCat(""); }} style={btnPrimary()}>{ar ? "إضافة فئة" : "Add category"}</button>
          </div>
        ) : null}
        <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.8 }}>
          {ar
            ? "كل فئة لها مستوياتها من الأدنى إلى الأعلى. يوضع الموظف على مستواه من ملفه، والترقية نقلُه إلى المستوى التالي — وكل ذلك يُكتب في سجل الأحداث باسم من قام به."
            : "Each category has its levels from the lowest up. Place a person on a level from their file; a promotion moves them up — all logged under who did it."}
        </span>
      </div>
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
  permSeed = "",
}) {
  const stations = useMemo(
    () => workplaceStations(data?.stations || []).filter((station) => !isHrUnit(station)),
    [data?.stations],
  );
  const people = useMemo(() => activePeople(data), [data]);
  const stationName = (stationIdValue) => {
    const station = (data?.stations || []).find((item) => String(item.id) === String(stationIdValue));
    return station?.name || "";
  };
  const personOptions = useMemo(
    () => people.map((employee) => personLookupOption(employee, stationName(employee.stationId), ar)),
    [people, data?.stations, ar],
  );
  const branchOptions = useMemo(
    () => stations.map((station) => ({
      id: String(station.id),
      primary: station.name || "—",
      search: station.name || "",
    })),
    [stations],
  );
  const [stationId, setStationId] = useState("");
  const [permEmployeeId, setPermEmployeeId] = useState("");
  useEffect(() => {
    if (!permSeed) return;
    setPermEmployeeId(String(permSeed));
    setTimeout(() => permRef?.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 120);
  }, [permSeed]);
  const [logView, setLogView] = useState("live");
  const [logKind, setLogKind] = useState("all");
  const [assignForStation, setAssignForStation] = useState("");

  const selectedStation = stationId || String(stations[0]?.id || "");
  const chain = useMemo(
    () => (selectedStation ? deriveBranchEscalationChain(selectedStation, data) : []),
    [selectedStation, data],
  );
  const slaList = readBranchEscalationSla(data)[selectedStation] || [];

  const [permView, setPermView] = useState("person");
  const permEmployee = people.find((employee) => String(employee.id) === String(permEmployeeId))
    || people.find((employee) => String(employee.id) !== String(data?.ownerId || "")) || people[0] || null;
  const position = (data?.smartPositions || []).find((item) => String(item.employeeId) === String(permEmployee?.id || ""));
  const permissions = position?.permissions || {};
  const permIsOwner = Boolean(permEmployee && (String(permEmployee.id) === String(data?.ownerId || "") || permEmployee.role === "owner" || permEmployee.isOwner));
  const manageCount = permIsOwner ? PERM_ROWS.length : PERM_ROWS.filter((row) => accessOf(permissions, row.id) === "manage").length;

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
    if (!companyId || !permEmployee || !canWrite || permIsOwner) return;
    if (row.ownerOnly && !ownerMode) return;
    const current = accessOf(permissions, row.id);
    const next = current === "manage" ? "hidden" : "manage";
    const title = position?.title || permEmployee.profile?.position || permEmployee.jobTitle || row.ar;
    saveSmartPosition(companyId, permEmployee.id, title, { ...permissions, [row.id]: next }, Boolean(position?.titleManual));
  };

  const kindLabel = (id) => {
    const row = KIND_CHIPS.find((chip) => chip[0] === id);
    if (row) return ar ? row[1] : row[2];
    return id;
  };

  return (
    <Slab
      label={ar ? "إدارة الهيكل" : "Structure administration"}
      title={ar ? "إدارة الهيكل" : "Structure administration"}
      note={ar
        ? "مصفوفة الصلاحيات وسلسلة التصعيد وسلّم الدرجات وسجل الأحداث — وكل تغيير يُكتب في السجل."
        : "Grade ladder, escalation chain, admin permissions and the event log — all on the seat, not the person; every change is logged."}
    >
      <div ref={permRef}>
        <OrgCollapsibleArticle
          title={ar ? "مصفوفة الصلاحيات — الأقسام الإدارية" : "Permission matrix — management sections"}
          meta={(
            <span>
              <span dir="ltr" style={ORG_MONO}>{PERM_ROWS.length}</span>
              {ar ? " أقسام · اختر موظفاً وحدّد ما يديره" : " sections · who manages each"}
            </span>
          )}
          open={openPerm}
          onToggle={onTogglePerm}
        >
          <p style={{ margin: 0, fontSize: 11.5, color: "var(--nv-ink2)", lineHeight: 1.75 }}>
            {ar
              ? "اختر موظفاً وحدّد ما يديره. القسم يظهر للموظف في جانب «الإدارة» فوراً. المالك يدير كل الأقسام، وصوت الموظف والمال يمنحهما المالك فقط."
              : "Each management section and who manages it. Add any employee to any section, or remove them. The owner manages all; voice and pay are granted by the owner only."}
          </p>
          {permView === "person" ? (
            <div data-perm-person="1" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <OrgLookupField
                ar={ar}
                label={ar ? "الموظف" : "Employee"}
                value={permEmployee ? String(permEmployee.id) : ""}
                onChange={setPermEmployeeId}
                options={personOptions}
                placeholder={ar ? "ابحث بالاسم أو الوظيفة أو الرقم أو الفرع" : "Search name, title, number, or branch"}
              />
              {permEmployee ? (
                <div style={{ display: "flex", gap: 11, alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--nv-line2, var(--nv-line))" }}>
                  <span style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--nv-soft)", border: "1px solid var(--nv-line)", color: "var(--nv-ink2)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, flex: "none" }}>
                    {initials(permEmployee.name)}
                  </span>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <strong style={{ fontSize: 12.5, color: "var(--nv-ink)" }}>{permEmployee.name}</strong>
                    <span style={{ fontSize: 11, color: "var(--nv-ink2)" }}>{permEmployee.profile?.position || permEmployee.jobTitle || "—"}{permIsOwner ? (ar ? " · المالك — يدير كل الأقسام" : " · Owner — manages all") : ""}</span>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--nv-muted)", whiteSpace: "nowrap" }}>
                    {ar ? "يدير " : "Manages "}<span dir="ltr" style={{ ...ORG_MONO, color: "var(--nv-ink)", fontWeight: 600 }}>{manageCount} / {PERM_ROWS.length}</span>
                  </span>
                </div>
              ) : null}
              {PERM_ROWS.map((row) => {
                const locked = !canWrite || !permEmployee || permIsOwner || Boolean(row.ownerOnly && !ownerMode);
                const on = permIsOwner || accessOf(permissions, row.id) === "manage";
                return (
                  <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--nv-line2, var(--nv-line))" }}>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <strong style={{ fontSize: 12.5, color: "var(--nv-ink)" }}>{ar ? row.ar : row.en}</strong>
                      <span style={{ fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.6 }}>{ar ? row.hintAr : row.hintEn}{row.ownerOnly ? (ar ? " · يمنحه المالك فقط" : " · owner grants only") : ""}</span>
                    </div>
                    <button type="button" role="switch" aria-checked={on} disabled={locked} onClick={() => cyclePerm(row)}
                      style={{ ...accessStyle(on ? "manage" : "hidden"), cursor: locked ? "default" : "pointer", flex: "none", opacity: locked && !on ? 0.6 : 1 }}>
                      {on ? (ar ? "يدير" : "Manages") : (ar ? "لا يدير" : "No")}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}
          {false ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {PERM_ROWS.map((row) => {
              const locked = !canWrite || Boolean(row.ownerOnly && !ownerMode);
              const holders = (data?.smartPositions || [])
                .filter((sp) => sp?.permissions?.[row.id] === "manage")
                .map((sp) => people.find((p) => String(p.id) === String(sp.employeeId)))
                .filter(Boolean)
                .filter((p) => String(p.id) !== String(data?.ownerId || ""));
              const owner = people.find((p) => String(p.id) === String(data?.ownerId || ""));
              const setGrant = (employeeId, value) => {
                if (locked || !employeeId) return;
                const sp = (data?.smartPositions || []).find((item) => String(item.employeeId) === String(employeeId));
                const emp = people.find((p) => String(p.id) === String(employeeId));
                const title = sp?.title || emp?.profile?.position || emp?.jobTitle || row.ar;
                saveSmartPosition(companyId, employeeId, title, { ...(sp?.permissions || {}), [row.id]: value }, Boolean(sp?.titleManual));
              };
              const free = personOptions.filter((o) => !holders.some((h) => String(h.id) === String(o.id)) && String(o.id) !== String(data?.ownerId || ""));
              return (
                <div key={row.id} data-perm-row={row.id} style={{ display: "grid", gridTemplateColumns: "minmax(140px, 200px) minmax(0, 1fr)", gap: 12, alignItems: "start", padding: "12px 0", borderBottom: "1px solid var(--nv-line2, var(--nv-line))" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <strong style={{ fontSize: 12.5, color: "var(--nv-ink)" }}>{ar ? row.ar : row.en}</strong>
                    <span style={{ fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.6 }}>{ar ? row.hintAr : row.hintEn}</span>
                    {row.ownerOnly ? <span style={{ fontSize: 10.5, color: "var(--nv-muted)" }}>{ar ? "يمنحه المالك فقط" : "Owner grants only"}</span> : null}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {owner ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, background: "var(--nv-soft)", border: "1px solid var(--nv-line)", color: "var(--nv-ink2)" }}>
                          {owner.name} · {ar ? "المالك" : "Owner"}
                        </span>
                      ) : null}
                      {holders.map((h) => (
                        <span key={h.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 6px 0 10px", paddingInline: "10px 6px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, background: "var(--nv-accent-soft, #E3F2E9)", border: "1px solid var(--nv-accent-border, #B7DCC6)", color: "var(--nv-accent-deep, #0F5132)" }}>
                          {h.name}
                          {!locked ? (
                            <button type="button" onClick={() => setGrant(h.id, "hidden")} aria-label={ar ? `أزل ${h.name}` : `Remove ${h.name}`}
                              style={{ width: 20, height: 20, borderRadius: "50%", border: "none", background: "transparent", color: "inherit", cursor: "pointer", fontSize: 13, lineHeight: 1 }}>×</button>
                          ) : null}
                        </span>
                      ))}
                    </div>
                    {!locked ? (
                      <div style={{ maxWidth: 360 }}>
                        <OrgLookupField
                          ar={ar}
                          value=""
                          onChange={(employeeId) => setGrant(employeeId, "manage")}
                          options={free}
                          placeholder={ar ? "＋ أضف موظفاً يدير هذا القسم" : "+ Add someone who manages this section"}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          ) : null}
        </OrgCollapsibleArticle>
      </div>

      <div ref={escRef}>
        <OrgCollapsibleArticle
          title={ar ? "سلسلة التصعيد" : "Escalation chain"}
          open={openEsc}
          onToggle={onToggleEsc}
          meta={<span>{ar ? "المهام · الشكوى الجهرية · صوت الموظف" : "Tasks · named complaint · employee voice"}</span>}
        >
          <EscalationRoutesBoard ar={ar} data={data} companyId={companyId} canWrite={canWrite} personOptions={personOptions} people={people} />
        </OrgCollapsibleArticle>
      </div>

      <div ref={gradesRef}>
        <GradeLadderArticle
          ar={ar}
          data={data}
          companyId={companyId}
          canWrite={canWrite}
          open={openGrades}
          onToggle={onToggleGrades}
        />
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
            <button type="button" onClick={() => setLogView("live")} style={filterChip(logView === "live")}>
              {ar ? "هذا الموسم" : "This season"}
              {" "}
              <span dir="ltr" style={ORG_MONO}>{liveEvents.length}</span>
            </button>
            <button type="button" onClick={() => setLogView("arch")} style={filterChip(logView === "arch")}>
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
                    <span style={kindStyle(tone)}>
                      {kindLabel(CHANGE_TYPES.has(String(event.type)) ? "change" : (event.type || "change"))}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--nv-ink)" }}>{formatOrgStructureEvent(event, ar)}</span>
                  </div>
                  <span style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                    <span dir="ltr" style={{ ...ORG_MONO, fontSize: 10, color: "var(--nv-muted)" }}>
                      {String(event.at || "").replace("T", " ").slice(0, 16)}
                    </span>
                    <span style={{ fontSize: 10.5, color: event.actorName ? "var(--nv-ink2)" : "var(--nv-muted)" }}>
                      {ar ? "بواسطة: " : "By: "}{event.actorName || (ar ? "غير مسجّل" : "not recorded")}
                    </span>
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
    </Slab>
  );
}
