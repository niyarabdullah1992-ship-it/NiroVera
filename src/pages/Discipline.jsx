import React, { useEffect, useMemo, useRef, useState } from "react";
import DisciplineRightsPanel from "@/components/discipline/DisciplineRightsPanel";
import { Link, useSearchParams } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { updateCompany } from "@/lib/store";
import { toast } from "@/components/ui/use-toast";
import { decorateDisciplineCase, deriveDisciplineBoard, isDisciplineSettled, isErasedFromEmployeeRecord } from "@/lib/disciplineBoard";
import {
  checkAdvanceDisciplineGate,
  checkDisciplineDeliveryGate,
  checkRaiseDisciplineGate,
  checkSignDisciplineGate,
  DISCIPLINE_PENALTY_KINDS,
  listedPenaltyKind,
  listedPenaltyLabel,
  isSimpleOralOffence,
  planDisciplineFineDispose,
  planDisciplineFinePost,
  planDisciplineFineVoid,
  resolveDisciplineWorkStationId,
} from "@/lib/disciplineDerivations";
import DisciplineCutCalculator from "@/components/discipline/DisciplineCutCalculator";
import DisciplineFineFund from "@/components/discipline/DisciplineFineFund";
import DisciplineRaiseForm from "@/components/discipline/DisciplineRaiseForm";
import DisciplineScheduleBoard from "@/components/discipline/DisciplineScheduleBoard";
import { pageKicker } from "@/lib/moduleMeta";
import { sha256HexOfFile } from "@/lib/fileHash";
import { readConsentFile } from "@/lib/writtenConsent";
import DisciplineArchiveBoard from "@/components/discipline/DisciplineArchiveBoard";
import DisciplineCaseCard from "@/components/discipline/DisciplineCaseCard";
import DisciplineLawBoard from "@/components/discipline/DisciplineLawBoard";
import DisciplineMineCard from "@/components/discipline/DisciplineMineCard";
import GrievanceRaise from "@/components/discipline/GrievanceRaise";
import DamageObjectionRaise from "@/components/discipline/DamageObjectionRaise";
import { DAMAGE_OBJECTION_TYPE, GRIEVANCE_KINDS, GRIEVANCE_TYPE, damageObjectionDeadline, grievanceState } from "@/lib/rightsRequests";
import { myDamageLines } from "@/lib/myRights";
import OpsFrame, { HeroSwitch } from "@/components/tasks/OpsFrame";
import OpsSideSlab, { OpsListHead } from "@/components/tasks/OpsSideSlab";
import { DisciplineHero } from "@/components/discipline/DisciplineCaseCard";
import RightHint from "@/components/shared/RightHint";
import FigureRow from "@/components/shared/FigureRow";
import { KpiAction } from "@/components/shared/StatusFlag";
import { disciplineCaseHint } from "@/lib/rightHints.disc";
import { generateDisciplineDeduction, liftDisciplineDeduction } from "@/lib/deductionGenerators";
import useStationScope, { matchesStationScope } from "@/hooks/useStationScope";
import { ROLE_RANK, canSeeAllStations, hrScopeStations, visibleStations } from "@/lib/permissions";
import { isOfficialHoliday, laborCalendarOf } from "@/lib/ummAlQuraCalendar";
import { useRailSide, useSetRailSide } from "@/lib/railSide";
import { checkPublishRegulationGate, planRegulationAck, regulationDate, regulationNextStep, regulationOf, regulationRef, regulationStepFor } from "@/lib/workRegulation";
import { deadlineText, disciplineDeadlines } from "@/lib/disciplineDeadlines";
import { ruleValue } from "@/lib/laborRules";
import { saveDisciplineOnServer } from "@/lib/disciplineServer";
import { regulationVersionEntry } from "@/lib/syncLaw";

const MANAGE_TAB_ORDER = ["manage", "raise", "calc", "schedule", "law", "archive"];
const EMPLOYEE_TAB_ORDER = ["mine", "schedule", "law", "archive"];
const FACE_TITLE = {
  mine: { ar: "جزاءاتي وحقّي في الاعتراض", en: "My sanctions and my right to object" },
  schedule: { ar: "لائحة الجزاءات", en: "The penalty list" },
  calc: { ar: "حاسبة الحسم", en: "Cut calculator" },
  manage: { ar: "ملفات الجزاء المفتوحة", en: "Open sanction files" },
  raise: { ar: "ارفع جزاءً", en: "Raise a sanction" },
  law: { ar: "أنظمة الوزارة في الجزاءات", en: "Ministry rules on sanctions" },
  archive: { ar: "أرشيف الجزاءات", en: "Sanctions archive" },
};
const TAB_LABEL = {
  schedule: { ar: "لائحة الجزاءات", en: "Penalty list" },
  calc: { ar: "حاسبة الحسم", en: "Cut calculator" },
  manage: { ar: "إدارة", en: "Manage" },
  raise: { ar: "ارفع جزاءً", en: "Raise a sanction" },
  law: { ar: "أنظمة الوزارة", en: "Ministry rules" },
  archive: { ar: "الأرشيف", en: "Archive" },
  mine: { ar: "ملفي", en: "My file" },
};

function uid() {
  return `dsc_${Date.now().toString(36)}`;
}

function managedScope(person, data) {
  if (!person) return { all: false, ids: new Set() };
  if (canSeeAllStations(person) || String(person.id) === String(data?.ownerId || "")) return { all: true, ids: new Set() };
  if (person.hrLevelId) {
    const scope = hrScopeStations(person, data);
    if (scope === null) return { all: true, ids: new Set() };
    return { all: false, ids: new Set((scope || []).map(String)) };
  }
  if (["station_manager", "pgm", "ops_manager", "director"].includes(person.role)) {
    return { all: false, ids: new Set(visibleStations(person, data).map((row) => String(row.id))) };
  }
  return { all: false, ids: new Set() };
}

/** A sanction is not raised on yourself, or on someone whose scope is equal or wider. */
function scopeEqualOrWider(person, actor, data) {
  if (!person || !actor) return false;
  if (String(person.id) === String(actor.id)) return true;
  const theirs = managedScope(person, data);
  const mine = managedScope(actor, data);
  if (theirs.all) return true;
  if (mine.all) return false;
  if (!theirs.ids.size) return false;
  if (!mine.ids.size) return true;
  const personRank = ROLE_RANK[person.role] || 0;
  const actorRank = ROLE_RANK[actor.role] || 0;
  if (personRank >= actorRank && personRank >= ROLE_RANK.station_manager && theirs.ids.size >= mine.ids.size) return true;
  let covers = true;
  mine.ids.forEach((id) => {
    if (!theirs.ids.has(id)) covers = false;
  });
  return covers && theirs.ids.size >= mine.ids.size;
}

const PACK_CARD = {
  background: "var(--nv-card)",
  border: "1px solid var(--nv-line)",
  borderRadius: 8,
  overflow: "hidden",
};

function packHead(columns) {
  return {
    display: "grid",
    gridTemplateColumns: columns,
    alignItems: "center",
    minHeight: 36,
    background: "var(--nv-hover)",
    borderBottom: "1px solid var(--nv-line)",
    fontSize: 11.5,
    fontWeight: 700,
    color: "var(--nv-ink2)",
  };
}

function statusPill(kind) {
  const tone = kind === "bad"
    ? { color: "var(--nv-bad-ink)", border: "var(--nv-bad-line)" }
    : kind === "warn"
      ? { color: "var(--nv-warn-ink)", border: "var(--nv-warn-line)" }
      : { color: "var(--nv-ok-ink)", border: "var(--nv-ok-line)" };
  return {
    display: "inline-flex",
    alignItems: "center",
    height: 24,
    padding: "0 10px",
    borderRadius: 999,
    fontSize: 11.5,
    fontWeight: 700,
    color: tone.color,
    background: "transparent",
    border: `1px solid ${tone.border}`,
    justifySelf: "start",
    whiteSpace: "nowrap",
  };
}

const RIGHTS = [
  { ruleId: "discipline.penalties.cite", ar: "لا يُوقَّع عليّ إلا جزاء من قائمة المادة 66.", en: "Only a penalty on the Article 66 list may be signed on me." },
  { ruleId: "discipline.hearing.cite", ar: "لا يُوقَّع عليّ جزاء قبل أن أُبلَّغ كتابةً وتُسمع أقوالي. المخالفة البسيطة تُستجوَب شفاهة ويُثبت ذلك في المحضر.", en: "No sanction is signed on me before written notice and a hearing. A minor offence may be questioned orally if that is recorded in the minutes." },
  { ruleId: "discipline.charge.maxDays", ar: "لا أُتَّهم بمخالفة مضى على كشفها أكثر من 30 يوماً، ولا يُوقَّع الجزاء بعد انتهاء التحقيق بأكثر من 30 يوماً.", en: "I may not be accused more than 30 days after the offence was discovered, nor sanctioned more than 30 days after the investigation ended." },
  { ruleId: "discipline.fine.maxDays", ar: "لا غرامتان على فعل، ولا حسم غرامات أو إيقاف بلا أجر فوق خمسة أيام في الشهر.", en: "No two penalties for one act, and neither fines nor unpaid suspension may exceed five days in a month." },
  { ruleId: "discipline.workplace.cite", ar: "لا أُعاقَب على أمر خارج مكان العمل ما لم يكن متصلاً بالعمل أو بصاحبه أو بمديري.", en: "I am not sanctioned for an act outside the workplace unless it is connected with the work, the employer, or my manager." },
  { ruleId: "discipline.listedOnly.cite", ar: "لا يُوقَّع عليّ جزاء غير وارد في النظام أو في لائحة تنظيم العمل.", en: "No penalty may be imposed that is not in the Law or the work-organization regulations." },
  { ruleId: "discipline.repeat.cooloffDays", ar: "لا يُشدَّد الجزاء عند التكرار إذا مضى 180 يوماً على إبلاغ الجزاء السابق.", en: "A repeat penalty may not be increased if 180 days have passed since notice of the previous one." },
  { ruleId: "discipline.appeal.internalDays", ar: "أعترض بنفسي بعد التوقيع خلال 30 يوماً عدا أيام العطل الرسمية.", en: "I object myself within 30 days of signing, excluding official holidays." },
  { ruleId: "discipline.decision.days", ar: "إن رُفض تظلّمي أو لم يُبتّ فيه كتابةً خلال 15 يوماً فلي الاعتراض أمام المحاكم العمالية خلال 30 يوماً عدا العطل الرسمية.", en: "If my grievance is refused or not decided in writing within 15 days, I may object before the labour courts within 30 days, official holidays excluded." },
];

export default function Discipline() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { data, company, currentUser, refresh } = useAuth();
  const railSide = useRailSide();
  const setRailSide = useSetRailSide();
  const cases = data?.disciplinaryCases || [];
  const employees = data?.employees || [];
  const stations = data?.stations || [];
  const stationScope = useStationScope();
  const canManage = Boolean(currentUser && (data?.ownerId === currentUser.id || currentUser.hrLevelId || ["director", "ops_manager", "station_manager"].includes(currentUser.role)));
  const scopedEmployees = canManage
    ? employees.filter((person) => matchesStationScope(person.stationId || person.station_id, stationScope))
    : employees;
  const raiseTargets = scopedEmployees.filter((person) => !scopeEqualOrWider(person, currentUser, data));
  const visibleCases = (canManage ? cases : cases.filter((item) => item.employeeId === currentUser?.id))
    .filter((item) => {
      if (!canManage) return true;
      const person = employees.find((row) => String(row.id) === String(item.employeeId));
      // Management never sees its own file, nor one it could not have raised — those live on ملفي
      // and with whoever sits above (the same rule as raising).
      if (String(item.employeeId) === String(currentUser?.id)) return false;
      if (person && scopeEqualOrWider(person, currentUser, data)) return false;
      return matchesStationScope(item.stationId || person?.stationId || person?.station_id, stationScope);
    });
  const mine = cases.filter((item) => item.employeeId === currentUser?.id);
  const liveCases = visibleCases.filter((item) => !isDisciplineSettled(item));
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  // The side is in the address: lane=manage is الإدارة, anything else is الموظف — the shared tabs
  // (لائحة الجزاءات · أنظمة الوزارة · الأرشيف) keep the side they were opened from.
  const adminVoice = canManage && railSide !== "employee";
  const setTab = (next) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    if (adminVoice) params.set("lane", "manage");
    else params.delete("lane");
    setSearchParams(params, { replace: true });
    if (adminVoice) setRailSide("manage");
  };
  const [employeeId, setEmployeeId] = useState("");
  const [penaltyKind, setPenaltyKind] = useState("fine");
  const [penaltyDays, setPenaltyDays] = useState(1);
  const [discoveredAt, setDiscoveredAt] = useState(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date()));
  const [dismissGround, setDismissGround] = useState("");
  const [art80, setArt80] = useState({});
  const [offSite, setOffSite] = useState(false);
  const [workConnected, setWorkConnected] = useState("");
  const [note, setNote] = useState("");
  const [appealDraft, setAppealDraft] = useState("");
  // «تظلّم» (regs Art. 71) lives here: from a sanction line (prefilled) or for a decision/action.
  const [grievanceOpen, setGrievanceOpen] = useState(() => searchParams.get("raise") === "grievance");
  const [grievancePrefill, setGrievancePrefill] = useState(null);
  const raiseAsked = searchParams.get("raise");
  useEffect(() => {
    if (raiseAsked !== "grievance") return;
    setGrievanceOpen(true);
    // The grievance is the worker's own act — it opens on the employee side.
    setRailSide("employee");
  }, [raiseAsked]);
  // «اعتراض على خصم إتلاف» (Art. 91) lives here too: from a damage line (prefilled) or a general entry.
  const [damageOpen, setDamageOpen] = useState(() => searchParams.get("raise") === DAMAGE_OBJECTION_TYPE);
  const [damagePrefill, setDamagePrefill] = useState(null);
  const [caseSel, setCaseSel] = useState("");
  const [clauseId, setClauseId] = useState("");
  const regulation = useMemo(() => regulationOf(data), [data]);
  const laborCalendar = laborCalendarOf(data);
  const hintIsHoliday = (iso) => isOfficialHoliday(iso, laborCalendar);
  const scopedStation = stations.find((row) => String(row.id) === String(stationScope));
  const scopeLabel = scopedStation?.name || "";

  useEffect(() => {
    if (raiseTargets.some((person) => String(person.id) === String(employeeId))) return;
    setEmployeeId(raiseTargets[0]?.id || "");
  }, [employeeId, raiseTargets]);

  const clauseStep = useMemo(
    () => (clauseId && employeeId
      ? regulationStepFor({ regulation, clauseId, cases, employeeId, today: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date()), cooloffDays: Number(ruleValue("discipline.repeat.cooloffDays")) || 180, ar })
      : null),
    [regulation, clauseId, cases, employeeId, ar],
  );

  // Picking a clause (or another person) applies what the regulation says for this time (Arts. 67–68).
  useEffect(() => {
    if (!clauseStep?.step?.ok) return;
    setPenaltyKind(clauseStep.step.kind);
    setPenaltyDays(clauseStep.step.days);
  }, [clauseStep]);

  const board = useMemo(
    () => deriveDisciplineBoard({ cases: liveCases, employees, stations, ar, canDecide: canManage, scopeLabel }),
    [liveCases, employees, stations, ar, canManage, scopeLabel],
  );

  const files = useMemo(
    () => liveCases.map((item) => decorateDisciplineCase(item, {
      employees,
      stations,
      ar,
      currentUser,
      canManage,
      monthCuts: board.monthCuts,
      cap: board.cap,
      today: board.today,
      cases: liveCases,
    })),
    [liveCases, employees, stations, ar, currentUser, canManage, board],
  );

  const mineCards = useMemo(
    () => mine
      .filter((item) => !isErasedFromEmployeeRecord(item, board.today))
      .map((item) => decorateDisciplineCase(item, { employees, stations, ar, currentUser, today: board.today })),
    [mine, employees, stations, ar, currentUser, board.today],
  );

  const myOpen = mineCards.filter((card) => card.face.id === "signed").length;
  const meRow = employees.find((row) => String(row.id) === String(currentUser?.id)) || currentUser;
  const myGrievances = (meRow?.otherRequests || []).filter((row) => row?.type === GRIEVANCE_TYPE)
    .slice().sort((a, b) => String(b.date || b.createdAt || "").localeCompare(String(a.date || a.createdAt || "")));
  const myObjections = (meRow?.otherRequests || []).filter((row) => row?.type === DAMAGE_OBJECTION_TYPE)
    .slice().sort((a, b) => String(b.date || b.createdAt || "").localeCompare(String(a.date || a.createdAt || "")));
  // Damage lines on my payroll that I may still object to (window open, no objection on them yet).
  const myDamageOpen = useMemo(
    () => myDamageLines(data, meRow?.id, meRow?.otherRequests || [])
      .filter(({ line, objection }) => !objection && (line.objectionLastDay || damageObjectionDeadline(line.damageNoticeOn)) >= board.today),
    [data, meRow, board.today],
  );
  const openDamage = (row) => {
    const line = row?.line;
    setDamagePrefill(line ? {
      notifiedOn: String(line.damageNoticeOn || "").slice(0, 10),
      amount: Number(line.originalAmount ?? line.amount) || "",
      damageCaseId: line.damageCaseId || "",
      deductionLineId: line.id || "",
      lineRef: [line.reason, row.month].filter(Boolean).join(" · "),
      at: Date.now(),
    } : null);
    setDamageOpen(true);
    setTimeout(() => document.querySelector("[data-damage-objection-raise]")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  };
  // ?raise=damage_objection[&line=…] — from «⚖ حقك» on payroll or the home rights list.
  const lineAsked = searchParams.get("line") || "";
  const damageAskHandled = useRef("");
  useEffect(() => {
    if (raiseAsked !== DAMAGE_OBJECTION_TYPE) return;
    const key = `${raiseAsked}:${lineAsked}`;
    if (damageAskHandled.current === key) return;
    setRailSide("employee");
    const hit = lineAsked ? myDamageOpen.find(({ line }) => String(line.id) === lineAsked) : null;
    // The line may arrive with the payroll data; wait for it before settling on the general form.
    if (lineAsked && !hit && !data?.payrollRuns) { setDamageOpen(true); return; }
    damageAskHandled.current = key;
    if (hit) openDamage(hit);
    else setDamageOpen(true);
  }, [raiseAsked, lineAsked, myDamageOpen, data?.payrollRuns]);
  const openGrievance = (card) => {
    const item = card?.item;
    const told = String(item?.notifyDeliveredAt || item?.signedAt || item?.decidedAt || "").slice(0, 10);
    setGrievancePrefill(item ? {
      grievanceKind: "penalty",
      notifiedOn: told,
      reason: "",
      sanctionRef: card.mineTitle || "",
      at: Date.now(),
    } : null);
    setGrievanceOpen(true);
    setTimeout(() => document.querySelector("[data-grievance-raise]")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  };
  // Signed is archive-settled for the company, but stays on ملفي live so the employee can object.
  const mineLiveCards = mineCards.filter((card) => card.face.id === "signed" || !isDisciplineSettled(card.item));
  const kindSpec = listedPenaltyKind(penaltyKind) || DISCIPLINE_PENALTY_KINDS[0];
  const cutDays = kindSpec.days.includes(0) && kindSpec.days.length === 1 ? 0 : Number(penaltyDays) || kindSpec.days[0] || 0;
  const ledger = data?.disciplineFineLedger || [];
  const tabOrder = adminVoice ? MANAGE_TAB_ORDER : EMPLOYEE_TAB_ORDER;
  const activeFace = tabOrder.includes(requestedTab) ? requestedTab : (adminVoice ? "manage" : "mine");
  const tabs = tabOrder.map((key) => ({
    value: key,
    label: ar ? TAB_LABEL[key].ar : TAB_LABEL[key].en,
  }));
  const selectedCard = files.find((row) => String(row.item.id) === String(caseSel)) || files[0] || null;
  const meterOf = (card, id) => (card.meters || []).find((m) => m.id === id) || {};
  const deadlineOf = (card) => {
    const id = card.face?.id;
    const m = id === "signed" || id === "objected" ? meterOf(card, "appeal") : meterOf(card, "sign");
    if (!m.text || m.text === "—") return null;
    return { text: `${m.text} ${ar ? "يوماً" : "days"}`, label: m.label, over: m.over, art: m.article };
  };
  const NEXT = {
    notified: { ar: "سماع الدفاع", en: "Hear the defence" },
    defence: { ar: "التوقيع أو الحفظ", en: "Sign or close" },
    objected: { ar: "البتّ في الاعتراض", en: "Rule on the objection" },
    signed: { ar: "يسري — يُغلق بعد مهلة الاعتراض", en: "In force — closes after the objection window" },
  };
  const waiting = files.filter((card) => card.actions?.length);
  // Arts. 69 & 72 — the windows about to close (≤ 7 days) or already closed, most urgent first.
  const clocks = adminVoice
    ? disciplineDeadlines({ cases: liveCases, today: board.today, calendar: laborCalendar }).filter((row) => row.kind !== "grievance" && (row.soon || row.over))
    : [];
  const overCount = files.filter((card) => (card.meters || []).some((m) => m.over)).length;
  // The platform's three tiles: what waits on you first (wider), then open files, then the cut in force.
  // «سطر لا بطاقة»: what waits on you first, then open files, then the cut in force — one row, no boxes.
  const figOf = (stat, key) => (stat ? { key, label: stat.lbl, value: stat.val, suffix: stat.unit || "", hint: stat.note || "" } : null);
  const manageFigures = adminVoice ? [
    {
      key: "disc-due",
      label: ar ? "بانتظار قرارك" : "Waiting on you",
      value: String(waiting.length),
      suffix: ar ? "ملف" : "files",
      tone: overCount ? "bad" : undefined,
      flag: overCount ? (ar ? "تجاوز مهلة نظامية" : "Past a statutory window") : "",
      hint: overCount ? (ar ? `${overCount} تجاوز مهلة نظامية` : `${overCount} past a statutory window`) : (ar ? "كلها ضمن المهل النظامية" : "All within the statutory windows"),
    },
    // Open files and a cut in force are states, not problems — no chip (KPI law).
    figOf(board.stats[1], "disc-open"),
    figOf(board.stats[3], "disc-cut"),
  ].filter(Boolean) : [];
  const manageSide = adminVoice ? (
    <OpsSideSlab
      ar={ar}
      dataKey="disc-side"
      title={ar ? "بانتظار قرارك" : "Waiting on you"}
      standing={scopeLabel ? (ar ? `النطاق: ${scopeLabel}` : `Scope: ${scopeLabel}`) : (ar ? "كل فروعك" : "All your branches")}
      note={ar ? "كل ملف بخطوته التالية ومهلتها النظامية. اختر اسماً لفتح ملفه." : "Each file with its next step and statutory window. Pick a name to open the file."}
      groups={["notified", "defence", "objected", "signed"].map((fid) => ({
        id: fid,
        name: ar ? NEXT[fid].ar : NEXT[fid].en,
        rows: files.filter((card) => card.face?.id === fid).map((card) => {
          const dl = deadlineOf(card);
          return {
            id: String(card.item.id),
            title: card.employee?.name || "—",
            count: dl ? dl.text.split(" ")[0] : "",
            tone: dl?.over ? "bad" : "gold",
            line: [card.item.note || card.item.reason, dl ? dl.label : ""].filter(Boolean).join(" · "),
            action: { key: "open", label: ar ? "افتح الملف" : "Open the file", onClick: () => { setCaseSel(String(card.item.id)); document.querySelector("[data-discipline-case]")?.scrollIntoView({ behavior: "smooth", block: "start" }); } },
          };
        }),
      }))}
      emptyText={ar ? "لا ملف ينتظر قرارك." : "No file waits on you."}
      selectedId={String(selectedCard?.item.id || "")}
      onSelect={(id) => id && setCaseSel(id)}
    />
  ) : null;

  const saveCases = (next, extra) => {
    if (!company?.id) return;
    updateCompany(company.id, (row) => {
      row.disciplinaryCases = next;
      if (extra) Object.assign(row, extra);
    });
  };

  // Every stage of a sanction file reaches the server through disciplineSave, where the gates run again
  // (the background sync never carries disciplinaryCases). A refusal names its article.
  const serverSave = (stage, row) => {
    saveDisciplineOnServer(company?.id, stage, row, regulation).then((r) => {
      if (r.error) toast({ description: ar ? r.reason : r.reasonEn, variant: "destructive" });
    });
  };

  const patch = (item, fields, stage = "") => {
    const now = new Date().toISOString();
    saveCases(cases.map((row) => (row.id === item.id ? { ...row, ...fields, updatedAt: now } : row)));
    if (stage) serverSave(stage, { ...item, ...fields, updatedAt: now });
  };

  const openCase = () => {
    if (!canManage || !String(note || "").trim()) return;
    const person = employees.find((row) => String(row.id) === String(employeeId));
    const raiseGate = checkRaiseDisciplineGate({
      employee: person,
      actor: currentUser,
      note,
      today: board.today,
      discoveredAt,
      penaltyKind,
      cutDays,
      dismissGround,
      offSite,
      workConnected,
      cases,
    });
    if (!raiseGate.ok) {
      toast({ description: ar ? raiseGate.reason : raiseGate.reasonEn, variant: "destructive" });
      return;
    }
    const stationId = resolveDisciplineWorkStationId(person);
    const now = new Date().toISOString();
    const newId = uid();
    const serverCheck = (rows) => {
      const row = rows.find((r) => r.id === newId);
      saveDisciplineOnServer(company?.id, "raise", row, regulation).then((r) => {
        if (r.error) toast({ description: ar ? r.reason : r.reasonEn, variant: "destructive" });
      });
      return rows;
    };
    saveCases(serverCheck([
      {
        id: newId,
        employeeId,
        stationId,
        status: "notice",
        note: note.trim(),
        penaltyKind,
        penaltyId: kindSpec.days.length === 1 ? penaltyKind : `${penaltyKind}_${cutDays}`,
        penalty: listedPenaltyLabel(penaltyKind, cutDays, ar),
        penaltyAr: listedPenaltyLabel(penaltyKind, cutDays, true),
        penaltyEn: listedPenaltyLabel(penaltyKind, cutDays, false),
        cutDays,
        deferMonths: kindSpec.deferMonths || 0,
        dismissGround: penaltyKind === "dismiss" || penaltyKind === "dismissal_with_award" ? dismissGround.trim() : "",
        ...(penaltyKind === "dismiss" ? { art80: { ...art80, discoveredAt } } : {}),
        ...(clauseStep ? {
          regulationClauseId: clauseStep.clause.id,
          regulationSource: regulation.source,
          regulationRef: regulationRef(regulation, clauseStep.clause, true),
          regulationOffence: clauseStep.clause.ar || clauseStep.clause.en || "",
          regulationTime: clauseStep.time,
          regulationSays: clauseStep.label,
        } : {}),
        offSite,
        workConnected: offSite ? workConnected.trim() : "",
        createdAt: now,
        notifiedAt: now,
        discoveredAt: discoveredAt || now,
        evidence: [note.trim()],
        signedBy: null,
        messages: [{
          id: `dmsg_${Date.now().toString(36)}`,
          from: "hr",
          text: note.trim(),
          senderName: currentUser?.name,
          createdAt: now,
        }],
      },
      ...cases,
    ]));
    setNote("");
    setClauseId("");
    setDismissGround("");
    setArt80({});
    setOffSite(false);
    setWorkConnected("");
    setTab("manage");
  };

  const onAction = (item, actionId) => {
    const now = new Date().toISOString();
    const who = currentUser?.name || "";
    if (actionId === "hear") {
      const oral = isSimpleOralOffence(item);
      const hearingMinutes = oral
        ? (ar ? "استُجوب شفاهة وأُثبت دفاعه في المحضر (المادة 71)." : "Questioned orally; the defence is recorded in the minutes (Article 71).")
        : (ar ? "حُقّق دفاعه كتابةً وأُثبت في المحضر (المادة 71)." : "The defence was heard in writing and recorded in the minutes (Article 71).");
      const hearGate = checkAdvanceDisciplineGate(item, "hearing", { hearingMinutes, today: board.today });
      if (!hearGate.ok) {
        toast({ description: ar ? hearGate.reason : hearGate.reasonEn, variant: "destructive" });
        return;
      }
      patch(item, {
        status: "hearing",
        hearingEndedAt: now,
        hearingAt: now,
        notifiedAt: item.notifiedAt || now,
        hearingMode: hearGate.oral ? "oral" : "written",
        hearingMinutes: hearingMinutes || item.hearingMinutes,
      }, "hearing");
      return;
    }
    if (actionId === "sign") {
      const signGate = checkSignDisciplineGate(item, { today: board.today, cases, regulation });
      if (!signGate.ok) {
        toast({ description: ar ? signGate.reason : signGate.reasonEn, variant: "destructive" });
        return;
      }
      const next = item.regulationClauseId ? regulationNextStep(regulation, item.regulationClauseId, item.regulationTime || 1, true) : null;
      const signed = { status: "notify", decidedAt: now, signedAt: now, signedBy: who, notifiedAt: item.notifiedAt || now, hearingEndedAt: item.hearingEndedAt || now, ...(next ? { regulationNext: next.label } : {}) };
      const person = employees.find((row) => String(row.id) === String(item.employeeId));
      const post = planDisciplineFinePost({ ...item, ...signed }, person, currentUser, board.today);
      const nextLedger = post ? [...ledger, post] : ledger;
      saveCases(cases.map((row) => (row.id === item.id ? { ...row, ...signed, updatedAt: now, fineAmount: post?.amount || row.fineAmount } : row)), { disciplineFineLedger: nextLedger });
      // The fine posted at signing travels with it, so a later lower/void can reverse it (planDisciplineFineVoid).
      saveDisciplineOnServer(company?.id, "sign", { ...item, ...signed, fineAmount: post?.amount || item.fineAmount || 0 }, regulation).then((r) => {
        if (r.error) toast({ description: ar ? r.reason : r.reasonEn, variant: "destructive" });
      });
      if (company?.id && Number(item.cutDays || 0) > 0) {
        const cutResult = generateDisciplineDeduction(company.id, item.employeeId, { ...item, ...signed }, currentUser);
        if (cutResult === "NO_OPEN_ITEM") {
          toast({
            description: ar
              ? "وُقّع الجزاء، لكن لا بند مسير مفتوح لترحيل الحسم — افتح مسير الشهر أولاً."
              : "The sanction is signed, but no open payroll item can take the cut — open this month's run first.",
            variant: "destructive",
          });
        }
      }
      return;
    }
    if (actionId === "close") {
      patch(item, { status: "closed", rulingAt: now, rulingBy: who, rulingLabel: ar ? "أُغلق" : "Closed", rulingNote: ar ? "استقرّ الملف." : "The file settled." }, "close");
      return;
    }
    if (actionId === "keep" || actionId === "lower" || actionId === "void") {
      const rulingGate = checkAdvanceDisciplineGate(item, "ruling", { today: board.today });
      if (!rulingGate.ok) {
        toast({ description: ar ? rulingGate.reason : rulingGate.reasonEn, variant: "destructive" });
        return;
      }
    }
    if (actionId === "keep") {
      patch(item, { status: "ruling", rulingOutcome: "keep", rulingAt: now, rulingBy: who, rulingLabel: ar ? "ثُبِّت الجزاء" : "Sanction upheld", rulingNote: ar ? "نُظر في الاعتراض وصدر القرار. ثُبِّت الجزاء كما وُقّع." : "The objection was heard. The sanction stands as signed." }, "ruling");
      return;
    }
    if (actionId === "lower") {
      const voidEntry = planDisciplineFineVoid(item, currentUser, board.today);
      const lowered = (row) => ({
        ...row,
        status: "ruling",
        rulingOutcome: "lower",
        penaltyKind: "warning",
        penalty: listedPenaltyLabel("warning", 0, ar),
        cutDays: 0,
        fineAmount: 0,
        rulingAt: now,
        rulingBy: who,
        rulingLabel: ar ? "خُفِّض الجزاء" : "Sanction reduced",
        rulingNote: ar ? "خُفِّض إلى إنذار بلا غرامة." : "Reduced to a warning with no fine.",
        updatedAt: now,
      });
      saveCases(cases.map((row) => (row.id === item.id ? lowered(row) : row)), { disciplineFineLedger: [...ledger, voidEntry] });
      serverSave("ruling", lowered(item));
      if (company?.id) liftDisciplineDeduction(company.id, item.employeeId, item, currentUser);
      return;
    }
    if (actionId === "void") {
      const voidEntry = planDisciplineFineVoid(item, currentUser, board.today);
      const voided = (row) => ({
        ...row,
        status: "closed",
        rulingOutcome: "void",
        rulingAt: now,
        rulingBy: who,
        rulingLabel: ar ? "أُلغي الجزاء" : "Sanction voided",
        rulingNote: ar ? "أُلغي الجزاء ورُفع من الملف." : "The sanction was voided and lifted from the file.",
        updatedAt: now,
      });
      saveCases(cases.map((row) => (row.id === item.id ? voided(row) : row)), { disciplineFineLedger: [...ledger, voidEntry] });
      serverSave("ruling", voided(item));
      if (company?.id) liftDisciplineDeduction(company.id, item.employeeId, item, currentUser);
    }
  };

  const disposeFines = ({ authority, note: disposeNote }) => {
    const planned = planDisciplineFineDispose({ authority, note: disposeNote, ledger, actor: currentUser, today: board.today });
    if (!planned.ok) {
      toast({ description: ar ? planned.reason : planned.reasonEn, variant: "destructive" });
      return;
    }
    if (!company?.id) return;
    updateCompany(company.id, (row) => {
      row.disciplineFineLedger = [...(row.disciplineFineLedger || []), planned.entry];
    });
  };

  const onUploadSigned = async (item, file) => {
    if (!file) return;
    const hash = await sha256HexOfFile(file);
    const url = await readConsentFile(file);
    patch(item, { signedPaper: { name: file.name, hash, url, at: new Date().toISOString() } }, "paper");
  };

  const fileObject = async (item, file) => {
    const text = appealDraft.trim();
    if (!text) return;
    const appealGate = checkAdvanceDisciplineGate(item, "appeal", { appealNote: text, today: board.today, laborCalendar });
    if (!appealGate.ok) {
      toast({ description: ar ? appealGate.reason : appealGate.reasonEn, variant: "destructive" });
      return;
    }
    const now = new Date().toISOString();
    let appealFile = null;
    if (file) {
      const hash = await sha256HexOfFile(file);
      const url = await readConsentFile(file);
      appealFile = { name: file.name, hash, url };
    }
    patch(item, { status: "appeal", appealNote: text, appealedAt: now, appealFile }, "appeal");
    setAppealDraft("");
  };

  // Model regulation Art. 68 · Law Art. 72 — how and when the decision reached the worker.
  const recordDelivery = (item, { method, at, ref }) => {
    const person = employees.find((row) => String(row.id) === String(item.employeeId));
    const gate = checkDisciplineDeliveryGate({ method, at, ref, employee: person, signedAt: item.signedAt || item.decidedAt, today: board.today });
    if (!gate.ok) {
      toast({ description: ar ? gate.reason : gate.reasonEn, variant: "destructive" });
      return false;
    }
    patch(item, { notifyMethod: method, notifyDeliveredAt: String(at).slice(0, 10), notifyRef: String(ref || "").trim(), notifyRecordedBy: currentUser?.name || "" }, "delivery");
    return true;
  };

  const withdrawObject = (item) => {
    patch(item, { status: "notify", appealNote: "", appealedAt: "", appealFile: null }, "withdraw");
  };

  return (
    <OpsFrame
      ar={ar}
      lane={adminVoice ? "manage" : "mine"}
      section={ar ? "الجزاءات" : "Sanctions"}
      title={ar ? FACE_TITLE[activeFace]?.ar || "الجزاءات" : FACE_TITLE[activeFace]?.en || "Sanctions"}
      hint={adminVoice
        ? (ar
          ? "ملفات الجزاء في نطاقك: الإبلاغ، وسماع الدفاع، والتوقيع، والبتّ في التظلّم. لا يُوقَّع جزاء إلا من قائمة المادة 66 وبند لائحة تنظيم العمل، وبعد إبلاغ كتابي وسماع دفاع (المادة 71). ملفك أنت ليس هنا — هو في واجهة الموظف."
          : "Sanction files in your scope: notice, hearing, signing, and ruling on grievances. Your own file is not here — it is on the employee side.")
        : (ar
          ? "ما على ملفك من جزاءات، ومهلة تظلّمك من كلٍّ منها (المادة 72). التظلّم حقّك وحدك ويُرفع كتابةً."
          : "The sanctions on your file and your grievance window for each (Art. 72). The grievance is yours alone, in writing.")}
      meta={<HeroSwitch options={tabs} value={activeFace} onChange={setTab} label={ar ? "صفحات الجزاءات" : "Sanction pages"} />}
      tiles={null}
      side={adminVoice && activeFace === "manage" ? manageSide : null}
    >
      <div data-discipline-face={activeFace} style={{ display: "flex", flexDirection: "column", gap: 16, color: "var(--nv-ink)", fontSize: 13 }}>

        {activeFace === "schedule" ? (
          <DisciplineScheduleBoard
            ar={ar}
            today={board.today}
            regulation={regulation}
            canEdit={adminVoice}
            employees={employees}
            meId={currentUser?.id || ""}
            onAnnounce={() => {
              const gate = checkPublishRegulationGate(regulation, { today: board.today, ar });
              if (!gate.ok || !company?.id) {
                toast({ description: ar ? gate.reason : gate.reasonEn, variant: "destructive" });
                return;
              }
              updateCompany(company.id, (row) => {
                row.workRegulation = { ...(row.workRegulation || {}), announcedAt: board.today, announcedBy: currentUser?.name || "", acks: {} };
              });
              toast({ description: ar ? `أُعلنت اللائحة — تسري على العمال من ${regulationDate(gate.effectiveFrom, true)}.` : `Announced — binding from ${gate.effectiveFrom}.` });
            }}
            onAck={() => {
              const plan = planRegulationAck(regulation, currentUser);
              if (!plan.ok || !company?.id) {
                toast({ description: ar ? plan.reason : plan.reasonEn, variant: "destructive" });
                return;
              }
              updateCompany(company.id, (row) => {
                row.workRegulation = { ...(row.workRegulation || {}), acks: { ...((row.workRegulation || {}).acks || {}), [plan.employeeId]: plan.ack } };
              });
            }}
            onSave={(next) => {
              if (!company?.id) return;
              updateCompany(company.id, (row) => {
                // A re-saved regulation is a new version: announce it again (Art. 13) and collect fresh acknowledgements.
                // The superseded version stays on record (the server keeps the same history).
                const prev = row.workRegulation;
                const versions = [...(Array.isArray(prev?.versions) ? prev.versions : []), ...(prev?.clauses?.length ? [regulationVersionEntry(prev)] : [])];
                row.workRegulation = { ...next, savedBy: currentUser?.name || "", savedAt: new Date().toISOString(), version: new Date().toISOString(), announcedAt: "", acks: {}, versions };
              });
              toast({ description: ar ? "حُفظت لائحة تنظيم العمل المعتمدة — كل جزاء جديد يسمّي بنده منها." : "The approved regulation is saved — every new sanction names its clause." });
            }}
          />
        ) : null}

        {adminVoice && activeFace === "calc" ? (
          <DisciplineCutCalculator
            ar={ar}
            employees={raiseTargets}
            stations={stations}
            cases={visibleCases}
            today={board.today}
          />
        ) : null}

        {adminVoice && activeFace === "raise" ? (
          <DisciplineRaiseForm
            ar={ar}
            employees={raiseTargets}
            stations={stations}
            cases={cases}
            actor={currentUser}
            today={board.today}
            employeeId={employeeId}
            onEmployee={setEmployeeId}
            penaltyKind={penaltyKind}
            onPenaltyKind={(next) => {
              setPenaltyKind(next);
              const spec = listedPenaltyKind(next);
              setPenaltyDays(spec?.days.find((n) => n > 0) || spec?.days[0] || 0);
            }}
            cutDays={cutDays}
            onCutDays={setPenaltyDays}
            discoveredAt={discoveredAt}
            onDiscovered={setDiscoveredAt}
            note={note}
            onNote={setNote}
            offSite={offSite}
            onOffSite={setOffSite}
            workConnected={workConnected}
            onWorkConnected={setWorkConnected}
            dismissGround={dismissGround}
            art80={art80}
            onArt80={setArt80}
            onDismissGround={setDismissGround}
            onSubmit={openCase}
            regulation={regulation}
            clauseId={clauseId}
            clauseStep={clauseStep}
            onClause={(next) => {
              setClauseId(next || "");
              const clause = regulation.clauses.find((c) => c.id === next);
              // The clause names the offence; the date makes it this incident (one penalty per act — Art. 70).
              if (clause && !String(note || "").trim()) setNote(`${ar ? clause.ar || clause.en : clause.en || clause.ar} — ${ar ? "يوم" : "on"} ${regulationDate(discoveredAt, ar)}`);
            }}
          />
        ) : null}

        {activeFace === "archive" ? (
          <DisciplineArchiveBoard
            cases={adminVoice ? visibleCases : mine}
            employees={employees}
            stations={stations}
            ar={ar}
            today={board.today}
            scope={adminVoice ? "manage" : "mine"}
            selfOnly={!adminVoice}
            userId={currentUser?.id}
          />
        ) : null}

        {adminVoice && activeFace === "manage" ? (
          <>
            {manageFigures.length ? <FigureRow ar={ar} figures={manageFigures} /> : null}
            {waiting.length ? <KpiAction ar={ar} style={{ alignSelf: "flex-start", fontSize: 12 }} onClick={() => document.querySelector('[data-ops-side="disc-side"], [data-disc-rows]')?.scrollIntoView({ behavior: "smooth", block: "start" })} /> : null}
            <OpsListHead
              title={ar ? `ملفات الجزاء · ${files.length}` : `Sanction files · ${files.length}`}
              note={ar ? "كل ملف بمرحلته، والجزاء المقترح أو الموقَّع، ومهلته النظامية، وما استُهلك من سقف الشهر." : "Each file with its stage, the proposed or signed penalty, its statutory window, and the month's cap used."}
              trailing={(
                <button type="button" data-disc-raise="1" onClick={() => setTab("raise")} style={{ fontFamily: "inherit", height: 36, padding: "0 16px", borderRadius: 10, border: "none", background: "#0B3D27", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                  {ar ? "ارفع جزاءً" : "Raise a sanction"}
                </button>
              )}
            />
            {clocks.length ? (
              <section data-disc-clocks="" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-warn-line)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--nv-line2, #EEF1EF)", background: "var(--nv-warn-soft)" }}>
                  <span aria-hidden style={{ width: 14, height: 2, background: "#C8A45A", borderRadius: 4 }} />
                  <strong style={{ fontSize: 13, color: "var(--nv-ink)" }}>{ar ? "مهل نظامية تقترب" : "Statutory windows closing"}</strong>
                  <span style={{ fontSize: 11.5, color: "var(--nv-ink2)" }}>{ar ? "يُنبَّه المسؤولون قبل 7 أيام ثم يومين، والعامل عند فوات مهلة البتّ" : "Managers are reminded 7 and 2 days ahead; the worker when a ruling lapses"}</span>
                </div>
                {clocks.map((row) => {
                  const card = files.find((c) => String(c.item.id) === String(row.caseId));
                  return (
                    <div key={`${row.caseId}-${row.kind}`} data-disc-clock={row.kind} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--nv-line2, #EEF1EF)" }}>
                      <span style={{ fontSize: 12.5, color: row.over ? "var(--nv-bad-ink)" : "var(--nv-ink)", lineHeight: 1.7 }}>{deadlineText(row, card?.employee?.name, ar)}</span>
                      {card ? (
                        <button type="button" onClick={() => { setCaseSel(String(row.caseId)); document.querySelector("[data-discipline-case]")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} style={{ fontFamily: "inherit", height: 32, padding: "0 12px", borderRadius: 8, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: "var(--nv-ink)", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                          {ar ? "افتح الملف" : "Open the file"}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </section>
            ) : null}
            {files.length === 0 ? (
              <p data-discipline-empty="" style={{ margin: 0, fontSize: 12.5, color: "var(--nv-muted)" }}>
                {ar ? "لا شيء معلّق — لا ملفات جزاء مفتوحة في نطاقك." : "Nothing pending — no open sanction files in your scope."}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <ol data-disc-rows="1" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  {files.map((card) => {
                    const on = String(selectedCard?.item.id) === String(card.item.id);
                    const dl = deadlineOf(card);
                    const capM = meterOf(card, "cap");
                    const stageTone = card.face?.id === "objected" ? "bad" : card.face?.id === "signed" ? "ok" : "warn";
                    const tone = { ok: ["var(--nv-ok-ink)", "var(--nv-ok-soft)", "var(--nv-ok-line)"], warn: ["var(--nv-warn-ink)", "var(--nv-warn-soft)", "var(--nv-warn-line)"], bad: ["var(--nv-bad-ink)", "var(--nv-bad-soft)", "var(--nv-bad-line)"] }[stageTone];
                    const chipS = (c) => ({ display: "inline-flex", alignItems: "center", height: 22, padding: "0 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: c[0], background: c[1], border: `1px solid ${c[2]}`, whiteSpace: "nowrap" });
                    return (
                      <li key={card.item.id}>
                        <button
                          type="button"
                          data-disc-row={card.item.id}
                          aria-pressed={on}
                          onClick={() => setCaseSel(String(card.item.id))}
                          className="nv-disc-row"
                          style={{ fontFamily: "inherit", width: "100%", textAlign: "start", display: "grid", gridTemplateColumns: "40px minmax(0,1fr) auto", gap: 12, alignItems: "center", padding: "12px 14px", borderRadius: 12, cursor: "pointer", border: `1px solid ${on ? "#0B3D27" : "var(--nv-line)"}`, background: on ? "var(--nv-ok-soft)" : "var(--nv-card)", position: "relative" }}
                        >
                          <span aria-hidden style={{ position: "absolute", insetInlineStart: 0, top: 12, bottom: 12, width: 3, borderRadius: 3, background: stageTone === "bad" ? "var(--nv-bad-fill)" : stageTone === "ok" ? "#0F5535" : "#C8A45A" }} />
                          <span aria-hidden style={{ width: 40, height: 40, borderRadius: 999, background: "linear-gradient(135deg,#0B3D27,#0F5535)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>
                            {String(card.employee?.name || "—").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("")}
                          </span>
                          <span style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <strong style={{ fontSize: 13.5, color: "var(--nv-ink)" }}>{card.employee?.name || "—"}</strong>
                              <span style={chipS(tone)}>{ar ? card.face.shortAr : card.face.shortEn}</span>
                              {card.penalty ? <span style={chipS(["var(--nv-bad-ink)", "var(--nv-card)", "var(--nv-bad-line)"])}>{card.penalty}</span> : null}
                            </span>
                            <span style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {card.item.note || card.item.reason || "—"}{card.station?.name ? ` · ${card.station.name}` : ""}
                            </span>
                          </span>
                          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
                            {dl ? <span style={chipS(dl.over ? ["var(--nv-bad-ink)", "var(--nv-bad-soft)", "var(--nv-bad-line)"] : ["var(--nv-ink2)", "var(--nv-soft)", "var(--nv-line)"])} title={`${dl.label} — ${ar ? "المادة" : "Art."} ${dl.art}`}>{`${dl.label} ${dl.text}`}</span> : null}
                            {capM.text && capM.text !== "—" ? (
                              <span title={ar ? "سقف الحسم في الشهر — المادة 70" : "Monthly cap — Art. 70"} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: capM.over ? "var(--nv-bad-ink)" : "var(--nv-muted)" }}>
                                <span aria-hidden style={{ width: 54, height: 5, borderRadius: 999, background: "var(--nv-line2, #EEF1EF)", overflow: "hidden" }}>
                                  <span style={{ display: "block", height: "100%", width: `${capM.pct || 0}%`, background: capM.over ? "var(--nv-bad-fill)" : "#0F5535" }} />
                                </span>
                                <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace" }}>{capM.text}</span>
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
                <DisciplineCaseCard
                  card={selectedCard}
                  ar={ar}
                  onAction={onAction}
                  onUploadSigned={onUploadSigned}
                  onDelivery={recordDelivery}
                  today={board.today}
                  companyName={company?.name || ""}
                  isHoliday={hintIsHoliday}
                />
              </div>
            )}

            <section data-discipline-gates="" style={PACK_CARD}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--nv-line)" }}>
                <strong style={{ fontSize: 13 }}>{ar ? "القيود التي تمنع التوقيع" : "Gates that block signing"} <span style={{ fontWeight: 500, color: "var(--nv-ink2)" }}>({board.gates.length})</span></strong>
              </div>
              <div className="nv-disc-gates" style={{ ...packHead("104px minmax(0,1fr) 150px") }}>
                <span style={{ paddingInlineStart: 12 }}>{ar ? "المرجع" : "Reference"}</span>
                <span style={{ paddingInlineStart: 10, borderInlineStart: "1px solid var(--nv-line)" }}>{ar ? "القيود التي تمنع التوقيع" : "Gates that block signing"}</span>
                <span style={{ paddingInlineStart: 10, borderInlineStart: "1px solid var(--nv-line)" }}>{ar ? "الحالة" : "Status"}</span>
              </div>
              {board.gates.map((gate) => (
                <div key={gate.head} className="nv-disc-gates" style={{ display: "grid", gridTemplateColumns: "104px minmax(0,1fr) 150px", gap: 12, padding: "12px 14px", borderBottom: "1px solid var(--nv-line2)", alignItems: "center" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", height: 22, padding: "0 9px", borderRadius: 8, fontSize: 11, fontWeight: 700, color: "var(--nv-ink)", background: "var(--nv-hover)", border: "1px solid var(--nv-line)", whiteSpace: "nowrap", justifySelf: "start" }}>{gate.tag || "—"}</span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--nv-ink)" }}>{gate.head}</span>
                    <span style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.7 }}>{gate.body}</span>
                  </span>
                  <span style={statusPill(gate.kind)}>{gate.state || "—"}</span>
                </div>
              ))}
            </section>

            <DisciplineFineFund ledger={ledger} ar={ar} today={board.today} onDispose={disposeFines} />
          </>
        ) : null}

        {activeFace === "law" ? (
          <DisciplineLawBoard cases={adminVoice ? visibleCases : mine} employees={employees} ar={ar} today={board.today} own={!adminVoice} />
        ) : null}

        {activeFace === "mine" ? (
          <div data-discipline-mine="" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <OpsListHead
              title={ar ? `ما على ملفي · ${mineLiveCards.length}` : `On my file · ${mineLiveCards.length}`}
              note={ar ? "كل جزاء بمرحلته ومهلة اعتراضك عليه. الاعتراض حقّك وحدك، ويُرفع كتابةً." : "Each sanction with its stage and your objection window. Objecting is yours alone, in writing."}
            />
            {mineLiveCards.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--nv-muted)" }}>
                {ar ? "لا شيء معلّق — لا جزاء مفتوح على ملفك." : "Nothing pending — no open sanction on your file."}
              </p>
            ) : null}
            {mineLiveCards.map((card) => (
              <React.Fragment key={`mine-${card.item.id}`}>
              <DisciplineHero card={card} ar={ar} mine companyName={company?.name || ""} />
              <div data-disc-mine-hint="" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 12, color: "var(--nv-ink2)" }}>
                <span>{card.mineState}</span>
                <RightHint
                  ar={ar}
                  onDate={board.today}
                  hint={disciplineCaseHint(card.item, { view: "employee", ar, today: board.today, isHoliday: hintIsHoliday, employee: card.employee })}
                  onAction={(action) => {
                    if (action.kind === "object") document.querySelector("[data-discipline-objection]")?.scrollIntoView({ behavior: "smooth", block: "center" });
                    if (action.kind === "rights" && action.rightsKind === GRIEVANCE_TYPE) openGrievance(card);
                  }}
                />
                {/* A signed sanction: its own objection is the grievance (Art. 72) when open; otherwise model Art. 71. */}
                {["signed", "closed"].includes(card.face.id) ? (
                  <button
                    type="button"
                    data-disc-grieve={card.item.id}
                    onClick={() => (card.canObject
                      ? document.querySelector("[data-discipline-objection]")?.scrollIntoView({ behavior: "smooth", block: "center" })
                      : openGrievance(card))}
                    style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 700, height: 30, padding: "0 12px", borderRadius: 999, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: "var(--nv-ink)", cursor: "pointer", marginInlineStart: "auto" }}
                  >
                    {ar ? "تظلّم" : "Grieve"}
                  </button>
                ) : null}
              </div>
              <DisciplineMineCard
                key={`act-${card.item.id}`}
                card={card}
                ar={ar}
                draft={appealDraft}
                onDraft={setAppealDraft}
                onObject={fileObject}
                onWithdraw={withdrawObject}
              />
              </React.Fragment>
            ))}

            <section data-grievance-mine="" style={PACK_CARD}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--nv-line)", flexWrap: "wrap" }}>
                <strong style={{ fontSize: 13 }}>{ar ? "تظلّماتي" : "My grievances"} <span style={{ fontWeight: 500, color: "var(--nv-ink2)" }}>({myGrievances.length})</span></strong>
                <button
                  type="button"
                  data-grievance-general=""
                  onClick={() => { setGrievancePrefill(null); setGrievanceOpen((v) => !v || Boolean(grievancePrefill)); }}
                  style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 700, height: 30, padding: "0 12px", borderRadius: 999, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: "var(--nv-ink)", cursor: "pointer", marginInlineStart: "auto" }}
                >
                  {ar ? "تظلّم من قرار أو إجراء" : "Grieve a decision or action"}
                </button>
              </div>
              {myGrievances.length === 0 ? (
                <div style={{ padding: "9px 14px", fontSize: 12, color: "var(--nv-muted)" }}>{ar ? "لا تظلّم مرفوع." : "No grievance filed."}</div>
              ) : myGrievances.map((row) => {
                const st = grievanceState(row, board.today, hintIsHoliday) || {};
                const kindRow = GRIEVANCE_KINDS.find((k) => k.key === row.grievanceKind);
                const stage = st.stage === "accepted" ? (ar ? "قُبل" : "Accepted")
                  : st.stage === "refused" ? (ar ? `رُفض — المحكمة حتى ${regulationDate(st.courtBy)}` : `Refused — court by ${st.courtBy}`)
                    : st.stage === "overdue" ? (ar ? `لم يُبتّ فيه — المحكمة حتى ${regulationDate(st.courtBy)}` : `Undecided — court by ${st.courtBy}`)
                      : (ar ? `بانتظار البتّ حتى ${regulationDate(st.replyBy)}` : `Awaiting a ruling by ${st.replyBy}`);
                return (
                  <div key={row.id} data-grievance-row={row.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "9px 14px", borderBottom: "1px solid var(--nv-line2)", fontSize: 12.5 }}>
                    <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{ar ? kindRow?.ar : kindRow?.en} · {String(row.reason || "").slice(0, 60)}</span>
                    <span style={{ fontWeight: 700, color: st.stage === "accepted" ? "var(--nv-ok-ink)" : "var(--nv-ink2)" }}>{stage}</span>
                  </div>
                );
              })}
            </section>
            {grievanceOpen ? (
              <GrievanceRaise key={grievancePrefill?.at || "general"} employee={meRow} companyId={company?.id} ar={ar} refresh={refresh} prefill={grievancePrefill} onSent={() => { setGrievanceOpen(false); setGrievancePrefill(null); }} />
            ) : null}

            <section data-damage-objection-mine="" style={PACK_CARD}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--nv-line)", flexWrap: "wrap" }}>
                <strong style={{ fontSize: 13 }}>{ar ? "اعتراضاتي على خصم الإتلاف" : "My damage-deduction objections"} <span style={{ fontWeight: 500, color: "var(--nv-ink2)" }}>({myObjections.length})</span></strong>
                <button
                  type="button"
                  data-damage-objection-general=""
                  onClick={() => { setDamagePrefill(null); setDamageOpen((v) => !v || Boolean(damagePrefill)); }}
                  style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 700, height: 30, padding: "0 12px", borderRadius: 999, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: "var(--nv-ink)", cursor: "pointer", marginInlineStart: "auto" }}
                >
                  {ar ? "اعتراض على خصم إتلاف" : "Object to a damage deduction"}
                </button>
              </div>
              <div style={{ padding: "7px 14px", fontSize: 11.5, color: "var(--nv-ink2)", lineHeight: 1.7, borderBottom: "1px solid var(--nv-line2)" }}>
                {ar ? "م 91 · خلال 15 يوم عمل من إبلاغك بالخصم وتقديره، وإلا سقط الحق. إن قُبل رُدّ المبلغ في المسير." : "Art. 91 · within 15 working days of being told, or the right lapses. If accepted the amount is refunded on payroll."}
              </div>
              {myDamageOpen.map((row) => {
                const last = row.line.objectionLastDay || damageObjectionDeadline(row.line.damageNoticeOn);
                return (
                  <div key={`dl-${row.line.id}`} data-damage-line={row.line.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "9px 14px", borderBottom: "1px solid var(--nv-line2)", fontSize: 12.5 }}>
                    <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                      {ar ? `خصم إتلاف ${Number(row.line.amount) || 0} ر.س` : `Damage deduction SAR ${Number(row.line.amount) || 0}`}
                      {row.line.reason ? ` · ${String(row.line.reason).slice(0, 50)}` : ""}
                      <span style={{ color: "var(--nv-ink2)" }}>{ar ? ` · الاعتراض حتى ${regulationDate(last)}` : ` · object by ${last}`}</span>
                    </span>
                    <button
                      type="button"
                      data-damage-line-object={row.line.id}
                      onClick={() => openDamage(row)}
                      style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 700, height: 30, padding: "0 12px", borderRadius: 999, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: "var(--nv-ink)", cursor: "pointer" }}
                    >
                      {ar ? "اعترض" : "Object"}
                    </button>
                  </div>
                );
              })}
              {myObjections.length === 0 && myDamageOpen.length === 0 ? (
                <div style={{ padding: "9px 14px", fontSize: 12, color: "var(--nv-muted)" }}>{ar ? "لا خصم إتلاف مفتوح ولا اعتراض مرفوع." : "No open damage deduction and no objection filed."}</div>
              ) : myObjections.map((row) => {
                const last = row.objectionLastDay || damageObjectionDeadline(row.notifiedOn);
                const stage = row.status === "approved" ? (ar ? "قُبل — يُرد المبلغ" : "Accepted — refunded")
                  : row.status === "rejected" ? (ar ? `لم يُقبل — المحكمة العمالية حتى ${regulationDate(last)}` : `Refused — labour court by ${last}`)
                    : (ar ? "بانتظار رد الإدارة" : "Awaiting management");
                return (
                  <div key={row.id} data-damage-objection-row={row.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "9px 14px", borderBottom: "1px solid var(--nv-line2)", fontSize: 12.5 }}>
                    <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{ar ? `${Number(row.amount) || 0} ر.س` : `SAR ${Number(row.amount) || 0}`} · {String(row.reason || "").slice(0, 60)}</span>
                    <span style={{ fontWeight: 700, color: row.status === "approved" ? "var(--nv-ok-ink)" : "var(--nv-ink2)" }}>{stage}</span>
                  </div>
                );
              })}
            </section>
            {damageOpen ? (
              <DamageObjectionRaise key={damagePrefill?.at || "general"} employee={meRow} companyId={company?.id} ar={ar} refresh={refresh} prefill={damagePrefill} onSent={() => { setDamageOpen(false); setDamagePrefill(null); }} />
            ) : null}

            <DisciplineRightsPanel rights={RIGHTS} ar={ar} today={board.today} />

            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 8, padding: "11px 16px", fontSize: 12.5, color: "var(--nv-ink2)", lineHeight: 1.8 }}>
              <span>
                {ar
                  ? <>الاعتراض ليس شكوى: الشكوى واقعة تريد أن تُنظر، والاعتراض حقّ مقيّد بملف جزاء وُقّع عليك. ارفع شكواك من <Link to="/app/complaints" style={{ color: "inherit" }}>صوت الموظف</Link>. جزاؤك الظاهر في <Link to={currentUser?.id ? `/app/employees/${currentUser.id}?tab=growth` : "/app/employees"} style={{ color: "inherit" }}>ملفك</Link>، والحسم النافذ في <Link to="/app/payroll" style={{ color: "inherit" }}>المسير</Link>.</>
                  : <>An objection is not a complaint. Raise a complaint from <Link to="/app/complaints" style={{ color: "inherit" }}>Employee voice</Link>. What is visible sits on <Link to={currentUser?.id ? `/app/employees/${currentUser.id}?tab=growth` : "/app/employees"} style={{ color: "inherit" }}>your file</Link>, and an effective cut on <Link to="/app/payroll" style={{ color: "inherit" }}>payroll</Link>.</>}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </OpsFrame>
  );
}
