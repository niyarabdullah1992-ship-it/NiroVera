import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import DisciplineCaseCard, { DisciplineHero } from "@/components/discipline/DisciplineCaseCard";
import DisciplineMineCard, { DisciplineObjectionForm } from "@/components/discipline/DisciplineMineCard";
import GrievanceRaise from "@/components/discipline/GrievanceRaise";
import DamageObjectionRaise from "@/components/discipline/DamageObjectionRaise";
import DisciplineRightsDecision from "@/components/discipline/DisciplineRightsDecision";
import { AttentionChip, DisciplineNewFrame, DisciplineRow, DisciplineRowList } from "@/components/discipline/DisciplineRows";
import { StepHead } from "@/components/discipline/DisciplineFormKit";
import SubTypeOption, { SubTypeGrid } from "@/components/requests/SubTypeOption";
import SuiteWorkspaceFrame from "@/components/shared/SuiteWorkspaceFrame";
import StatusFilterPills from "@/components/shared/StatusFilterPills";
import { DAMAGE_OBJECTION_TYPE, GRIEVANCE_KINDS, GRIEVANCE_TYPE, damageObjectionDeadline, grievanceState } from "@/lib/rightsRequests";
import { myDamageLines } from "@/lib/myRights";
import RightHint from "@/components/shared/RightHint";
import { disciplineCaseHint } from "@/lib/rightHints.disc";
import { generateDisciplineDeduction, liftDisciplineDeduction } from "@/lib/deductionGenerators";
import useStationScope, { matchesStationScope } from "@/hooks/useStationScope";
import { canManageDiscipline, disciplineManageCases, scopeEqualOrWider } from "@/lib/disciplineManageScope";
import { requestMayDecideOnLane } from "@/lib/dutyScope";
import { isOfficialHoliday, laborCalendarOf } from "@/lib/ummAlQuraCalendar";
import { useRailSide, useSetRailSide } from "@/lib/railSide";
import { checkPublishRegulationGate, planRegulationAck, regulationDate, regulationNextStep, regulationOf, regulationRef, regulationStepFor } from "@/lib/workRegulation";
import { disciplineDeadlines } from "@/lib/disciplineDeadlines";
import { ruleValue } from "@/lib/laborRules";
import { saveDisciplineOnServer } from "@/lib/disciplineServer";
import { regulationVersionEntry } from "@/lib/syncLaw";
import { checkUniformSanctionGate, planUniformAck, uniformOf } from "@/lib/uniformPolicy";
import { sanctionRecordState } from "@/lib/penaltiesRecord";
import MinistrySectionPanel from "@/components/schedules/MinistrySectionPanel";
import TwoPaneWorkspace, { ListStack } from "@/components/shared/TwoPaneWorkspace";
import { useCollapsibleItems } from "@/components/shared/CollapsibleItemCard";

/*
 * «الجزاءات» — one page per lane, built like طلباتي and صوت الموظف:
 *   الموظف: «جزاءاتي» (pill-filtered lines that open in place) · «طلب جديد» (tiles → one form) · ministry panel.
 *   الإدارة: «قائمة الجزاءات» (pills · queue beside a decision card) · «إجراء جديد» (tiles → one form) · ministry panel.
 * Old ?tab= links still land: mine/manage pick the lane, raise/calc/schedule pick the tile, archive the pill,
 * law scrolls to the ministry panel; ?raise=grievance|damage_objection[&line=] opens that form.
 */

const MANAGE_TILES = new Set(["raise", "calc", "schedule", "fund"]);

function uid() {
  return `dsc_${Date.now().toString(36)}`;
}

const dayOf = (iso) => String(iso || "").slice(0, 10);
const pendingStatus = (row) => ["pending", "pending_manager"].includes(String(row?.status || "pending"));
const byNewest = (a, b) => String(b.date || b.createdAt || "").localeCompare(String(a.date || a.createdAt || ""));

function scrollTo(selector) {
  setTimeout(() => document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
}

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
  const canManage = canManageDiscipline(currentUser, data);
  const scopedEmployees = canManage
    ? employees.filter((person) => matchesStationScope(person.stationId || person.station_id, stationScope))
    : employees;
  const raiseTargets = scopedEmployees.filter((person) => !scopeEqualOrWider(person, currentUser, data));
  // Management never sees its own file, nor one it could not have raised — those live on the employee side
  // and with whoever sits above (the same rule as raising). Shared with the compliance index.
  const visibleCases = canManage
    ? disciplineManageCases(data, currentUser, { inScope: (sid) => matchesStationScope(sid, stationScope) })
    : cases.filter((item) => item.employeeId === currentUser?.id);
  const mine = cases.filter((item) => item.employeeId === currentUser?.id);
  const liveCases = visibleCases.filter((item) => !isDisciplineSettled(item));
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  // The side comes from the rail: الإدارة for a manager on the manage side, الموظف otherwise.
  const adminVoice = canManage && railSide !== "employee";
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
  const raiseAsked = searchParams.get("raise");
  // الموظف — the list pill, the line opened in place, and the «طلب جديد» tile with its sub-choice.
  const [mineFace, setMineFace] = useState(() => (requestedTab === "archive" ? "archive" : "all"));
  const [newKind, setNewKind] = useState(() => (raiseAsked === DAMAGE_OBJECTION_TYPE ? "damage" : requestedTab === "schedule" ? "schedule" : "grievance"));
  const [grievancePick, setGrievancePick] = useState("other");
  const [grievancePrefill, setGrievancePrefill] = useState(null);
  const [damagePick, setDamagePick] = useState("other");
  const [damagePrefill, setDamagePrefill] = useState(null);
  // الإدارة — the queue pill, the picked item, and the «إجراء جديد» tile.
  const [queueFace, setQueueFace] = useState(() => (requestedTab === "archive" ? "archive" : "all"));
  const [pickedId, setPickedId] = useState("");
  const [actionKind, setActionKind] = useState(() => (MANAGE_TILES.has(requestedTab) ? requestedTab : "raise"));
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

  const meRow = employees.find((row) => String(row.id) === String(currentUser?.id)) || currentUser;
  const myGrievances = (meRow?.otherRequests || []).filter((row) => row?.type === GRIEVANCE_TYPE).slice().sort(byNewest);
  const myObjections = (meRow?.otherRequests || []).filter((row) => row?.type === DAMAGE_OBJECTION_TYPE).slice().sort(byNewest);
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
    setDamagePick(line ? String(line.id) : "other");
    setNewKind("damage");
    scrollTo("[data-disc-new='mine']");
  };
  // ?raise=grievance — from صوت الموظف and «حقك» hints: the grievance tile, its form open (the worker's own act).
  useEffect(() => {
    if (raiseAsked !== "grievance") return;
    setNewKind("grievance");
    setGrievancePick("other");
    setGrievancePrefill(null);
    setRailSide("employee");
    scrollTo("[data-disc-new='mine']");
  }, [raiseAsked]);
  // ?raise=damage_objection[&line=…] — from «حقك» on payroll or the home rights list.
  const lineAsked = searchParams.get("line") || "";
  const damageAskHandled = useRef("");
  useEffect(() => {
    if (raiseAsked !== DAMAGE_OBJECTION_TYPE) return;
    const key = `${raiseAsked}:${lineAsked}`;
    if (damageAskHandled.current === key) return;
    setRailSide("employee");
    setNewKind("damage");
    const hit = lineAsked ? myDamageOpen.find(({ line }) => String(line.id) === lineAsked) : null;
    // The line may arrive with the payroll data; wait for it before settling on the general form.
    if (lineAsked && !hit && !data?.payrollRuns) return;
    damageAskHandled.current = key;
    if (hit) openDamage(hit);
    else scrollTo("[data-disc-new='mine']");
  }, [raiseAsked, lineAsked, myDamageOpen, data?.payrollRuns]);
  // ?tab=law — the ministry panel at the foot of either lane.
  useEffect(() => {
    if (requestedTab === "law") scrollTo("[data-ministry-section='discipline']");
  }, [requestedTab]);
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
    setGrievancePick(item ? String(item.id) : "other");
    setNewKind("grievance");
    scrollTo("[data-disc-new='mine']");
  };
  // Signed is archive-settled for the company, but stays live for the employee so he can object.
  // Model Arts. 69 · 61: nothing leaves the record; a signed penalty past the fold date (discipline.record.eraseDays,
  // never under the 180-day cooloff) is marked «سابقة» on its line.
  const mineAllLive = mineCards.filter((card) => card.face.id === "signed" || !isDisciplineSettled(card.item));
  const foldedOf = (card) => sanctionRecordState(card.item, { today: board.today }).foldedForWorker;
  const kindSpec = listedPenaltyKind(penaltyKind) || DISCIPLINE_PENALTY_KINDS[0];
  const cutDays = kindSpec.days.includes(0) && kindSpec.days.length === 1 ? 0 : Number(penaltyDays) || kindSpec.days[0] || 0;
  const ledger = data?.disciplineFineLedger || [];
  const meterOf = (card, id) => (card.meters || []).find((m) => m.id === id) || {};
  const deadlineOf = (card) => {
    const id = card.face?.id;
    const m = id === "signed" || id === "objected" ? meterOf(card, "appeal") : meterOf(card, "sign");
    if (!m.text || m.text === "—") return null;
    return { text: `${m.text} ${ar ? "يوماً" : "days"}`, label: m.label, over: m.over, art: m.article };
  };

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
    // Model Art. 53(1)(e): a uniform breach only after the rules were announced and this worker acknowledged them.
    const uniformGate = checkUniformSanctionGate({ uniform: uniformOf(data), employeeId, clauseId, clause: clauseStep?.clause });
    if (!uniformGate.ok) {
      toast({ description: ar ? uniformGate.reason : uniformGate.reasonEn, variant: "destructive" });
      return;
    }
    const stationId = resolveDisciplineWorkStationId(person);
    const now = new Date().toISOString();
    const newId = uid();
    const serverCheck = (rows) => {
      const row = rows.find((r) => r.id === newId);
      saveDisciplineOnServer(company?.id, "raise", row, { ...regulation, uniform: uniformOf(data) }).then((r) => {
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
    setQueueFace("all");
    setPickedId(`case:${newId}`);
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

  // ——— الموظف: «جزاءاتي» ———
  const grievanceStage = (row) => grievanceState(row, board.today, hintIsHoliday) || {};
  const grievanceSettled = (row) => ["accepted", "refused"].includes(grievanceStage(row).stage) || ["approved", "rejected"].includes(String(row.status || ""));
  const objectionSettled = (row) => ["approved", "rejected"].includes(String(row.status || ""));
  const sanctionBucket = (card) => (card.face.id === "signed" ? "force" : card.face.id === "notified" ? "reply" : card.face.id === "objected" ? "grieved" : "");
  const openGrievances = myGrievances.filter((row) => !grievanceSettled(row));
  const openObjections = myObjections.filter((row) => !objectionSettled(row));
  const settledRights = [...myGrievances.filter(grievanceSettled), ...myObjections.filter(objectionSettled)].sort(byNewest);
  const mineCount = {
    all: mineAllLive.length + openGrievances.length + openObjections.length + myDamageOpen.length,
    force: mineAllLive.filter((c) => sanctionBucket(c) === "force").length,
    reply: mineAllLive.filter((c) => sanctionBucket(c) === "reply").length + myDamageOpen.length,
    grieved: mineAllLive.filter((c) => sanctionBucket(c) === "grieved").length + openGrievances.length + openObjections.length,
    archive: (mineCards.length - mineAllLive.length) + settledRights.length,
  };
  const showMine = (bucket) => mineFace === "all" || mineFace === bucket;
  // «جزاءاتي» items fold to one row; the open set survives a pill change, a list of one opens by itself.
  const rightsKey = (row) => `${row.type === GRIEVANCE_TYPE ? "grievance" : "damage"}:${row.id}`;
  const mineVisibleKeys = mineFace === "archive" ? settledRights.map(rightsKey) : [
    ...mineAllLive.filter((card) => showMine(sanctionBucket(card))).map((card) => `case:${card.item.id}`),
    ...(showMine("reply") ? myDamageOpen.map((row) => `line:${row.line.id}`) : []),
    ...(showMine("grieved") ? openGrievances.map((row) => `grievance:${row.id}`) : []),
    ...(showMine("grieved") ? openObjections.map((row) => `damage:${row.id}`) : []),
  ];
  const mineFold = useCollapsibleItems(mineVisibleKeys, "");
  const grievanceStageText = (row) => {
    const st = grievanceStage(row);
    return st.stage === "accepted" ? (ar ? "قُبل" : "Accepted")
      : st.stage === "refused" ? (ar ? `رُفض — المحكمة العمالية حتى ${regulationDate(st.courtBy)}` : `Refused — labour court by ${st.courtBy}`)
        : st.stage === "overdue" ? (ar ? `لم يُبتّ فيه — المحكمة العمالية حتى ${regulationDate(st.courtBy)}` : `Undecided — labour court by ${st.courtBy}`)
          : (ar ? `بانتظار البتّ حتى ${regulationDate(st.replyBy)}` : `Awaiting a ruling by ${st.replyBy}`);
  };
  const objectionStageText = (row) => {
    const last = row.objectionLastDay || damageObjectionDeadline(row.notifiedOn);
    return row.status === "approved" ? (ar ? "قُبل — يُرد المبلغ في المسير" : "Accepted — refunded on payroll")
      : row.status === "rejected" ? (ar ? `لم يُقبل — المحكمة العمالية حتى ${regulationDate(last)}` : `Refused — labour court by ${last}`)
        : (ar ? "بانتظار رد الإدارة" : "Awaiting management");
  };
  const grievanceKindLabel = (row) => {
    const k = GRIEVANCE_KINDS.find((g) => g.key === row.grievanceKind);
    return k ? (ar ? k.ar : k.en) : (ar ? "تظلّم" : "Grievance");
  };

  const sanctionLine = (card) => {
    const key = `case:${card.item.id}`;
    const appeal = meterOf(card, "appeal");
    const chip = card.face.id === "notified"
      ? <AttentionChip tone="warn">{ar ? "أُبلغتَ — يُسمع دفاعك" : "Notified — your defence"}</AttentionChip>
      : card.canObject
        ? <AttentionChip tone={appeal.over ? "bad" : "warn"}>{ar ? "الاعتراض مفتوح" : "Objection open"}</AttentionChip>
        : null;
    return (
      <DisciplineRow
        key={key}
        id={key}
        ar={ar}
        badge={card.face.id === "objected" ? (ar ? "م 72" : "Art. 72") : (ar ? "م 66" : "Art. 66")}
        title={card.mineTitle}
        sub={[card.mineState, foldedOf(card) ? (ar ? "سابقة — لا يُشدَّد بها (م61)" : "Earlier — no longer aggravates (Art. 61)") : ""].filter(Boolean).join(" · ")}
        date={dayOf(card.item.signedAt || card.item.notifiedAt || card.item.createdAt)}
        chip={chip}
        open={mineFold.isOpen(key)}
        onOpen={() => mineFold.toggle(key)}
      >
        <DisciplineHero card={card} ar={ar} mine companyName={company?.name || ""} />
        <div data-disc-mine-hint="" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 12, color: "var(--nv-ink2)" }}>
          <RightHint
            ar={ar}
            onDate={board.today}
            hint={disciplineCaseHint(card.item, { view: "employee", ar, today: board.today, isHoliday: hintIsHoliday, employee: card.employee })}
            onAction={(action) => {
              if (action.kind === "object" || (action.kind === "rights" && action.rightsKind === GRIEVANCE_TYPE)) openGrievance(card);
            }}
          />
          {["signed", "closed"].includes(card.face.id) ? (
            <button
              type="button"
              data-disc-grieve={card.item.id}
              onClick={() => openGrievance(card)}
              style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 700, height: 32, padding: "0 14px", borderRadius: 8, border: "1px solid var(--nv-line)", background: "var(--nv-card)", color: "var(--nv-ink)", cursor: "pointer", marginInlineStart: "auto" }}
            >
              {card.canObject ? (ar ? "اعترض على هذا الجزاء" : "Object to this sanction") : (ar ? "تظلّم من هذا الجزاء" : "Grieve this sanction")}
            </button>
          ) : null}
        </div>
        <DisciplineMineCard card={card} ar={ar} onWithdraw={withdrawObject} />
      </DisciplineRow>
    );
  };

  const rightsLine = (row, kind) => {
    const key = `${kind}:${row.id}`;
    const grievance = kind === "grievance";
    const st = grievance ? grievanceStage(row) : null;
    const files = (row.files || []).filter((f) => f?.name);
    return (
      <DisciplineRow
        key={key}
        id={key}
        ar={ar}
        badge={grievance ? (ar ? "م 71" : "Art. 71") : (ar ? "م 91" : "Art. 91")}
        title={grievance ? `${grievanceKindLabel(row)} · ${String(row.reason || "").slice(0, 60)}` : `${ar ? "اعتراض على خصم إتلاف" : "Damage objection"} · ${Number(row.amount) || 0} ${ar ? "ر.س" : "SAR"}`}
        sub={grievance ? grievanceStageText(row) : objectionStageText(row)}
        date={dayOf(row.date || row.createdAt)}
        chip={grievance && st?.stage === "overdue" ? <AttentionChip tone="bad">{ar ? "فاتت مهلة البتّ" : "Ruling overdue"}</AttentionChip> : null}
        go={false}
        open={mineFold.isOpen(key)}
        onOpen={() => mineFold.toggle(key)}
      >
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--nv-ink)", lineHeight: 1.9, overflowWrap: "anywhere" }}>{row.reason || "—"}</p>
        <span style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.8 }}>
          {ar ? "أُبلغتَ في " : "Told on "}<span dir="ltr" style={{ fontFamily: "var(--font-mono, monospace)" }}>{dayOf(row.notifiedOn) || "—"}</span>
          {row.reviewNote ? (ar ? ` · ردّ الإدارة: ${row.reviewNote}` : ` · Management: ${row.reviewNote}`) : ""}
          {files.length ? (ar ? ` · المرفق: ${files.map((f) => f.name).join("، ")}` : ` · Attached: ${files.map((f) => f.name).join(", ")}`) : ""}
        </span>
      </DisciplineRow>
    );
  };

  const damageLine = (row) => {
    const key = `line:${row.line.id}`;
    const last = row.line.objectionLastDay || damageObjectionDeadline(row.line.damageNoticeOn);
    return (
      <DisciplineRow
        key={key}
        id={key}
        ar={ar}
        badge={ar ? "م 91" : "Art. 91"}
        title={`${ar ? "خصم إتلاف" : "Damage deduction"} · ${Number(row.line.amount) || 0} ${ar ? "ر.س" : "SAR"}${row.line.reason ? ` · ${String(row.line.reason).slice(0, 50)}` : ""}`}
        sub={ar ? `لك الاعتراض حتى ${regulationDate(last)}` : `You may object by ${last}`}
        date={dayOf(row.line.damageNoticeOn)}
        chip={<AttentionChip tone="warn">{ar ? "الاعتراض مفتوح" : "Objection open"}</AttentionChip>}
        openLabel={ar ? "اعترض" : "Object"}
        onOpen={() => openDamage(row)}
      />
    );
  };

  // «طلب جديد» — the sanctions one may grieve or object to, as sub-choices.
  const grievable = mineAllLive.filter((card) => ["signed", "closed"].includes(card.face.id));
  const pickedSanction = grievable.find((card) => String(card.item.id) === String(grievancePick)) || null;
  const mineTiles = [
    { id: "grievance", letter: ar ? "ت" : "G", title: ar ? "تظلّم من جزاء أو قرار" : "Grieve a sanction or decision", hint: ar ? "النموذج الموحد م71 · خلال 30 يوماً" : "Model Art. 71 · within 30 days" },
    { id: "damage", letter: ar ? "خ" : "D", title: ar ? "اعتراض على خصم الإتلاف" : "Object to a damage deduction", hint: ar ? "م91 · خلال 15 يوم عمل" : "Art. 91 · within 15 working days" },
    { id: "schedule", letter: ar ? "ل" : "L", title: ar ? "لائحة الجزاءات" : "The penalty list", hint: ar ? "اقرأها وأقرّ بها" : "Read and acknowledge it" },
  ];

  const scheduleBoard = (
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
      uniform={uniformOf(data)}
      onSaveUniform={(next) => {
        if (!company?.id) return;
        const at = new Date().toISOString();
        updateCompany(company.id, (row) => {
          row.workRegulation = { ...(row.workRegulation || {}), uniform: { ...next, version: at, savedAt: at, savedBy: currentUser?.name || "", announcedAt: "", announcedBy: "", acks: {} } };
        });
        toast({ description: ar ? "حُفظت اشتراطات الزي — أعلنها ليُقرّ بها العمال (النموذج الموحد م53)." : "Uniform rules saved — announce them for acknowledgement (model Art. 53)." });
      }}
      onAnnounceUniform={() => {
        if (!company?.id) return;
        updateCompany(company.id, (row) => {
          const u = row.workRegulation?.uniform;
          if (!u) return;
          row.workRegulation = { ...row.workRegulation, uniform: { ...u, announcedAt: board.today, announcedBy: currentUser?.name || "" } };
        });
        toast({ description: ar ? "أُعلنت اشتراطات الزي — بانتظار إقرار العمال." : "Uniform rules announced — awaiting acknowledgements." });
      }}
      onAckUniform={() => {
        const plan = planUniformAck(uniformOf(data), currentUser);
        if (!plan.ok || !company?.id) {
          toast({ description: ar ? plan.reason : plan.reasonEn, variant: "destructive" });
          return;
        }
        updateCompany(company.id, (row) => {
          const u = row.workRegulation?.uniform;
          if (!u) return;
          row.workRegulation = { ...row.workRegulation, uniform: { ...u, acks: { ...(u.acks || {}), [plan.employeeId]: plan.ack } } };
        });
      }}
      onSave={(next) => {
        if (!company?.id) return;
        updateCompany(company.id, (row) => {
          // A re-saved regulation is a new version: announce it again (Art. 13) and collect fresh acknowledgements.
          // The superseded version stays on record (the server keeps the same history).
          const prev = row.workRegulation;
          const versions = [...(Array.isArray(prev?.versions) ? prev.versions : []), ...(prev?.clauses?.length ? [regulationVersionEntry(prev)] : [])];
          // The uniform rules (model Art. 53) keep their own version and acknowledgements.
          row.workRegulation = { ...next, savedBy: currentUser?.name || "", savedAt: new Date().toISOString(), version: new Date().toISOString(), announcedAt: "", acks: {}, versions, ...(prev?.uniform ? { uniform: prev.uniform } : {}) };
        });
        toast({ description: ar ? "حُفظت لائحة تنظيم العمل المعتمدة — كل جزاء جديد يسمّي بنده منها." : "The approved regulation is saved — every new sanction names its clause." });
      }}
    />
  );

  // ——— الإدارة: «قائمة الجزاءات» ———
  // Arts. 69 & 72 — the windows about to close (≤ 7 days) or already closed: they head the queue.
  const clocks = adminVoice
    ? disciplineDeadlines({ cases: liveCases, today: board.today, calendar: laborCalendar }).filter((row) => row.kind !== "grievance" && (row.soon || row.over))
    : [];
  const clockOf = (caseId) => {
    const hits = clocks.filter((row) => String(row.caseId) === String(caseId));
    if (!hits.length) return null;
    return hits.some((row) => row.over) ? "over" : "soon";
  };
  // Grievances (model Art. 71) and Art. 91 objections from the people this manager may decide for.
  const rightsRows = useMemo(() => {
    if (!adminVoice) return [];
    const out = [];
    for (const person of scopedEmployees) {
      if (!requestMayDecideOnLane({ actor: currentUser, subject: person, lane: "manage", data })) continue;
      for (const row of person.otherRequests || []) {
        if (row?.type !== GRIEVANCE_TYPE && row?.type !== DAMAGE_OBJECTION_TYPE) continue;
        out.push({ ...row, family: "other", employee: person });
      }
    }
    return out.sort(byNewest);
  }, [adminVoice, scopedEmployees, currentUser, data]);
  const pendingRights = rightsRows.filter(pendingStatus);
  const decidedRights = rightsRows.filter((row) => !pendingStatus(row));
  const caseBucket = (card) => (card.face.id === "notified" ? "investigation" : ["defence", "objected"].includes(card.face.id) ? "decision" : "");
  const urgency = (card) => {
    const c = clockOf(card.item.id);
    return (c === "over" ? 0 : c === "soon" ? 1 : 2) * 10 + (card.actions?.length ? 0 : 5);
  };
  const queueEntries = [
    ...files.slice().sort((a, b) => urgency(a) - urgency(b)).map((card) => ({ key: `case:${card.item.id}`, kind: "case", bucket: caseBucket(card), card })),
    ...pendingRights.map((row) => ({ key: `${row.type === GRIEVANCE_TYPE ? "grievance" : "damage"}:${row.id}`, kind: row.type === GRIEVANCE_TYPE ? "grievance" : "damage", bucket: row.type === GRIEVANCE_TYPE ? "grievances" : "objections", row })),
  ];
  const queueShown = queueEntries.filter((e) => queueFace === "all" || e.bucket === queueFace);
  // The list is the decision surface: each entry folds; opening it shows its case or ruling in place.
  // A file just opened (pickedId) unfolds by itself.
  const queueFold = useCollapsibleItems(queueFace === "archive" ? decidedRights.map(rightsKey) : queueShown.map((e) => e.key), pickedId);
  const queueCount = (bucket) => queueEntries.filter((e) => e.bucket === bucket).length;
  const archivedCases = visibleCases.length - liveCases.length;
  const queueLine = (entry, { readOnly = false } = {}) => {
    if (entry.kind === "case") {
      const card = entry.card;
      const c = clockOf(card.item.id);
      const dl = deadlineOf(card);
      return (
        <DisciplineRow
          key={entry.key}
          id={entry.key}
          ar={ar}
          dataKey="disc-queue"
          badge={card.face.id === "objected" ? (ar ? "م 72" : "Art. 72") : (ar ? "م 66" : "Art. 66")}
          title={`${card.employee?.name || "—"} · ${ar ? card.face.shortAr : card.face.shortEn}`}
          sub={[card.item.note || card.item.reason, card.penalty, card.station?.name].filter(Boolean).join(" · ")}
          date={dayOf(card.item.notifiedAt || card.item.createdAt)}
          chip={c ? <AttentionChip tone={c === "over" ? "bad" : "warn"}>{`${dl?.label || (ar ? "مهلة" : "Window")} ${c === "over" ? (ar ? "— تجاوزت" : "— passed") : (ar ? "— تقترب" : "— closing")}`}</AttentionChip> : null}
          go={Boolean(card.actions?.length)}
          open={queueFold.isOpen(entry.key)}
          onOpen={() => queueFold.toggle(entry.key)}
        >
          <div data-disc-decision="" style={{ minWidth: 0 }}>
            <DisciplineCaseCard
              card={card}
              ar={ar}
              onAction={onAction}
              onUploadSigned={onUploadSigned}
              onDelivery={recordDelivery}
              today={board.today}
              companyName={company?.name || ""}
              isHoliday={hintIsHoliday}
            />
          </div>
        </DisciplineRow>
      );
    }
    const row = entry.row;
    const grievance = entry.kind === "grievance";
    const st = grievance ? grievanceStage(row) : null;
    return (
      <DisciplineRow
        key={entry.key}
        id={entry.key}
        ar={ar}
        dataKey="disc-queue"
        badge={grievance ? (ar ? "م 71" : "Art. 71") : (ar ? "م 91" : "Art. 91")}
        title={`${row.employee?.name || "—"} · ${grievance ? (ar ? "تظلّم" : "Grievance") : (ar ? "اعتراض على خصم إتلاف" : "Damage objection")}`}
        sub={grievance ? `${grievanceKindLabel(row)} · ${String(row.reason || "").slice(0, 60)}` : `${Number(row.amount) || 0} ${ar ? "ر.س" : "SAR"} · ${String(row.reason || "").slice(0, 60)}`}
        date={dayOf(row.date || row.createdAt)}
        chip={st?.stage === "overdue" ? <AttentionChip tone="bad">{ar ? "فاتت مهلة البتّ" : "Ruling overdue"}</AttentionChip> : null}
        open={queueFold.isOpen(entry.key)}
        onOpen={() => queueFold.toggle(entry.key)}
      >
        <div data-disc-decision="" style={{ minWidth: 0 }}>
          <DisciplineRightsDecision key={row.id} row={row} ar={ar} companyId={company?.id} actor={currentUser} today={board.today} isHoliday={hintIsHoliday} canDecide={readOnly ? false : adminVoice} refresh={refresh} />
        </div>
      </DisciplineRow>
    );
  };

  const manageTiles = [
    { id: "raise", letter: ar ? "ج" : "S", title: ar ? "ملف جزاء جديد" : "New sanction file", hint: ar ? "إبلاغ كتابي ثم سماع الدفاع — م71" : "Written notice, then a hearing — Art. 71" },
    { id: "calc", letter: ar ? "ح" : "C", title: ar ? "حاسبة الحسم" : "Cut calculator", hint: ar ? "سقف الحسم الشهري — م70" : "The monthly cap — Art. 70" },
    { id: "schedule", letter: ar ? "ل" : "L", title: ar ? "لائحة الجزاءات" : "The penalty list", hint: ar ? "البنود والإعلان والإقرار — م66–67" : "Clauses, announcing, acknowledging — Arts. 66–67" },
    { id: "fund", letter: ar ? "غ" : "F", title: ar ? "صندوق الغرامات" : "Fine fund", hint: ar ? "القيد والصرف — م73" : "Register and disposal — Art. 73" },
  ];

  return (
    <SuiteWorkspaceFrame
      ar={ar}
      kicker={pageKicker("/app/discipline", lang)}
      title={ar ? "الجزاءات" : "Sanctions"}
      hint={adminVoice
        ? (ar
          ? "ملفات الجزاء في نطاقك والتظلّمات واعتراضات الإتلاف — كلٌّ بخطوته التالية ومهلته النظامية. ملفك أنت في واجهة الموظف."
          : "Sanction files in your scope, grievances and damage objections — each with its next step and statutory window. Your own file is on the employee side.")
        : (ar
          ? "ما على ملفك من جزاءات ومهلة اعتراضك على كلٍّ منها، وتظلّمك واعتراضك على خصم الإتلاف."
          : "The sanctions on your file and your window on each, your grievances and damage-deduction objections.")}
    >
      <div data-discipline-face={adminVoice ? "manage" : "mine"} style={{ display: "flex", flexDirection: "column", gap: 16, color: "var(--nv-ink)", fontSize: 13 }}>

        {!adminVoice ? (
          <TwoPaneWorkspace
            dataKey="discipline-mine"
            raise={(
              <DisciplineNewFrame
                dataKey="mine"
                title={ar ? "طلب جديد" : "New request"}
                note={ar ? "التظلّم والاعتراض حقّك وحدك، كتابةً — ولا تُضار منه." : "Grieving and objecting are yours alone, in writing — without harm to you."}
                tiles={mineTiles}
                value={newKind}
                onPick={setNewKind}
              >
                {newKind === "grievance" ? (
                  <>
                    <StepHead first label={ar ? "من أي جزاء أو قرار؟" : "Which sanction or decision?"} note={ar ? "الجزاء الموقَّع ومهلته مفتوحة يُعترض عليه في ملفه (م72)" : "A signed sanction in its window is objected to in its file (Art. 72)"} />
                    <SubTypeGrid label={ar ? "من أي جزاء أو قرار؟" : "Which sanction or decision?"}>
                      {grievable.map((card) => (
                        <SubTypeOption
                          key={card.item.id}
                          dataKey={`sanction-${card.item.id}`}
                          on={String(grievancePick) === String(card.item.id)}
                          title={card.mineTitle}
                          sub={card.canObject ? (ar ? "الاعتراض مفتوح — م72" : "Objection open — Art. 72") : (ar ? "تظلّم — م71" : "Grievance — Art. 71")}
                          onClick={() => openGrievance(card)}
                        />
                      ))}
                      <SubTypeOption
                        dataKey="grievance-other"
                        on={!pickedSanction}
                        title={ar ? "قرار أو إجراء آخر" : "Another decision or action"}
                        sub={ar ? "تظلّم — النموذج الموحد م71" : "Grievance — model Art. 71"}
                        onClick={() => { setGrievancePick("other"); setGrievancePrefill(null); }}
                      />
                    </SubTypeGrid>
                    {pickedSanction?.canObject ? (
                      <DisciplineObjectionForm key={pickedSanction.item.id} card={pickedSanction} ar={ar} draft={appealDraft} onDraft={setAppealDraft} onObject={fileObject} />
                    ) : (
                      <GrievanceRaise
                        key={pickedSanction ? grievancePrefill?.at || pickedSanction.item.id : "general"}
                        employee={meRow}
                        companyId={company?.id}
                        ar={ar}
                        refresh={refresh}
                        prefill={pickedSanction ? grievancePrefill : null}
                        onSent={() => { setGrievancePick("other"); setGrievancePrefill(null); setMineFace("grieved"); }}
                      />
                    )}
                  </>
                ) : null}
                {newKind === "damage" ? (
                  <>
                    <StepHead first label={ar ? "أي خصم؟" : "Which deduction?"} note={ar ? "خصوم الإتلاف في مسيرك ومهلتها مفتوحة" : "Damage deductions on your payroll still open"} />
                    <SubTypeGrid label={ar ? "أي خصم؟" : "Which deduction?"}>
                      {myDamageOpen.map((row) => (
                        <SubTypeOption
                          key={row.line.id}
                          dataKey={`damage-${row.line.id}`}
                          on={String(damagePick) === String(row.line.id)}
                          title={`${Number(row.line.amount) || 0} ${ar ? "ر.س" : "SAR"}${row.line.reason ? ` · ${String(row.line.reason).slice(0, 50)}` : ""}`}
                          sub={ar ? `الاعتراض حتى ${regulationDate(row.line.objectionLastDay || damageObjectionDeadline(row.line.damageNoticeOn))}` : `Object by ${row.line.objectionLastDay || damageObjectionDeadline(row.line.damageNoticeOn)}`}
                          onClick={() => openDamage(row)}
                        />
                      ))}
                      <SubTypeOption
                        dataKey="damage-other"
                        on={damagePick === "other"}
                        title={ar ? "خصم آخر" : "Another deduction"}
                        sub={ar ? "تكتب تاريخ الإبلاغ والمبلغ" : "You enter the notice date and amount"}
                        onClick={() => { setDamagePick("other"); setDamagePrefill(null); }}
                      />
                    </SubTypeGrid>
                    <DamageObjectionRaise
                      key={damagePrefill?.at || "general"}
                      employee={meRow}
                      companyId={company?.id}
                      ar={ar}
                      refresh={refresh}
                      prefill={damagePick === "other" ? null : damagePrefill}
                      onSent={() => { setDamagePick("other"); setDamagePrefill(null); setMineFace("grieved"); }}
                    />
                  </>
                ) : null}
                {newKind === "schedule" ? scheduleBoard : null}
              </DisciplineNewFrame>
            )}
            list={(
              <ListStack data-discipline-mine="">
                <StatusFilterPills
                  card
                  dataKey="disc-mine"
                  title={ar ? "جزاءاتي" : "My sanctions"}
                  value={mineFace}
                  onChange={setMineFace}
                  items={[
                    { id: "all", label: ar ? "الكل" : "All", n: mineCount.all },
                    { id: "force", label: ar ? "سارية" : "In force", n: mineCount.force },
                    { id: "reply", label: ar ? "بانتظار ردّي" : "Awaiting me", n: mineCount.reply },
                    { id: "grieved", label: ar ? "متظلَّم منها" : "Grieved", n: mineCount.grieved },
                    { id: "archive", label: ar ? "الأرشيف" : "Archive", n: mineCount.archive },
                  ]}
                />
                {mineFace === "archive" ? (
                  <>
                    <DisciplineArchiveBoard cases={mine} employees={employees} stations={stations} ar={ar} today={board.today} scope="mine" selfOnly userId={currentUser?.id} />
                    {settledRights.length ? (
                      <DisciplineRowList dataKey="mine-rights-archive">
                        {settledRights.map((row) => rightsLine(row, row.type === GRIEVANCE_TYPE ? "grievance" : "damage"))}
                      </DisciplineRowList>
                    ) : null}
                  </>
                ) : (
                  <DisciplineRowList dataKey="mine" empty={ar ? "لا شيء هنا — لا جزاء ولا تظلّم في هذا الترشيح." : "Nothing here — no sanction or grievance in this filter."}>
                    {mineAllLive.filter((card) => showMine(sanctionBucket(card))).map(sanctionLine)}
                    {showMine("reply") ? myDamageOpen.map(damageLine) : null}
                    {showMine("grieved") ? openGrievances.map((row) => rightsLine(row, "grievance")) : null}
                    {showMine("grieved") ? openObjections.map((row) => rightsLine(row, "damage")) : null}
                  </DisciplineRowList>
                )}
              </ListStack>
            )}
          />
        ) : (
          <TwoPaneWorkspace
            dataKey="discipline-manage"
            raise={(
              <DisciplineNewFrame
                dataKey="manage"
                title={ar ? "إجراء جديد" : "New action"}
                note={ar ? "لا جزاء إلا من قائمة المادة 66 وبند اللائحة، وبعد إبلاغ كتابي وسماع دفاع (م71)." : "No penalty outside the Article 66 list and a regulation clause, and only after notice and a hearing (Art. 71)."}
                tiles={manageTiles}
                value={actionKind}
                onPick={setActionKind}
              >
                {actionKind === "raise" ? (
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
                {actionKind === "calc" ? (
                  <DisciplineCutCalculator ar={ar} employees={raiseTargets} stations={stations} cases={visibleCases} today={board.today} />
                ) : null}
                {actionKind === "schedule" ? scheduleBoard : null}
                {actionKind === "fund" ? (
                  <DisciplineFineFund ledger={ledger} ar={ar} today={board.today} onDispose={disposeFines} />
                ) : null}
              </DisciplineNewFrame>
            )}
            list={(
              <ListStack data-disc-manage-grid="1">
                <StatusFilterPills
                  card
                  dataKey="disc-manage"
                  title={ar ? "قائمة الجزاءات" : "Sanctions list"}
                  note={scopeLabel ? (ar ? `النطاق: ${scopeLabel}` : `Scope: ${scopeLabel}`) : (ar ? "ما تقترب مهلته أولاً" : "Closest window first")}
                  value={queueFace}
                  onChange={(next) => { setQueueFace(next); setPickedId(""); }}
                  items={[
                    { id: "all", label: ar ? "الكل" : "All", n: queueEntries.length },
                    { id: "investigation", label: ar ? "قيد التحقيق" : "Under investigation", n: queueCount("investigation") },
                    { id: "decision", label: ar ? "بانتظار القرار" : "Awaiting decision", n: queueCount("decision") },
                    { id: "grievances", label: ar ? "تظلّمات" : "Grievances", n: queueCount("grievances") },
                    { id: "objections", label: ar ? "اعتراضات الإتلاف" : "Damage objections", n: queueCount("objections") },
                    { id: "archive", label: ar ? "الأرشيف" : "Archive", n: archivedCases + decidedRights.length },
                  ]}
                />
                {queueFace === "archive" ? (
                  <>
                    <DisciplineArchiveBoard cases={visibleCases} employees={employees} stations={stations} ar={ar} today={board.today} scope="manage" selfOnly={false} userId={currentUser?.id} />
                    {decidedRights.length ? (
                      <DisciplineRowList dataKey="manage-rights-archive">
                        {decidedRights.map((row) => queueLine({ key: rightsKey(row), kind: row.type === GRIEVANCE_TYPE ? "grievance" : "damage", row }, { readOnly: true }))}
                      </DisciplineRowList>
                    ) : null}
                  </>
                ) : (
                  <DisciplineRowList dataKey="manage" empty={ar ? "لا شيء معلّق — لا ملف ولا تظلّم في هذا الترشيح." : "Nothing pending in this filter."}>
                    {queueShown.map((entry) => queueLine(entry))}
                  </DisciplineRowList>
                )}
              </ListStack>
            )}
          />
        )}

        <MinistrySectionPanel
          sectionKey="discipline"
          lane={adminVoice ? "manage" : "employee"}
          ar={ar}
          today={board.today}
          inputs={{ cases: adminVoice ? visibleCases : mine, employees, uniform: uniformOf(data) }}
        />
      </div>
    </SuiteWorkspaceFrame>
  );
}
