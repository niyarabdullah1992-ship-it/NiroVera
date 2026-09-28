import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { updateCompany } from "@/lib/store";
import { toast } from "@/components/ui/use-toast";
import { decorateDisciplineCase, deriveDisciplineBoard, isDisciplineSettled, isErasedFromEmployeeRecord } from "@/lib/disciplineBoard";
import {
  checkAdvanceDisciplineGate,
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
import SuiteWorkspaceFrame from "@/components/shared/SuiteWorkspaceFrame";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import { generateDisciplineDeduction, liftDisciplineDeduction } from "@/lib/deductionGenerators";
import useStationScope, { matchesStationScope } from "@/hooks/useStationScope";
import { ROLE_RANK, canSeeAllStations, hrScopeStations, visibleStations } from "@/lib/permissions";
import { laborCalendarOf } from "@/lib/ummAlQuraCalendar";
import { useRailSide, useSetRailSide } from "@/lib/railSide";

const MANAGE_TAB_ORDER = ["mine", "schedule", "calc", "manage", "raise", "law", "archive"];
const EMPLOYEE_TAB_ORDER = ["mine", "schedule", "law", "archive"];
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
  { ruleId: "discipline.decision.days", ar: "إن لم يُبتّ في اعتراضي خلال 15 يوماً فلي حق الاعتراض أمام المحاكم العمالية.", en: "If my objection is not decided within 15 days, I may challenge it before the labour courts." },
  { ruleId: "discipline.record.eraseDays", ar: "يُمحى الجزاء من سجلّي الظاهر بعد سنة من توقيعه، ويبقى في أرشيف الشركة.", en: "A sanction drops off my visible record one year after signing, and stays in the company archive." },
];

export default function Discipline() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { data, company, currentUser } = useAuth();
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
      return matchesStationScope(item.stationId || person?.stationId || person?.station_id, stationScope);
    });
  const mine = cases.filter((item) => item.employeeId === currentUser?.id);
  const liveCases = visibleCases.filter((item) => !isDisciplineSettled(item));
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const adminVoice = canManage && railSide !== "employee";
  const setTab = (next) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    setSearchParams(params, { replace: true });
    if (adminVoice && next !== "mine") setRailSide("manage");
  };
  const [employeeId, setEmployeeId] = useState("");
  const [penaltyKind, setPenaltyKind] = useState("fine");
  const [penaltyDays, setPenaltyDays] = useState(1);
  const [discoveredAt, setDiscoveredAt] = useState(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date()));
  const [dismissGround, setDismissGround] = useState("");
  const [offSite, setOffSite] = useState(false);
  const [workConnected, setWorkConnected] = useState("");
  const [note, setNote] = useState("");
  const [appealDraft, setAppealDraft] = useState("");
  const [caseSel, setCaseSel] = useState("");
  const laborCalendar = laborCalendarOf(data);
  const scopedStation = stations.find((row) => String(row.id) === String(stationScope));
  const scopeLabel = scopedStation?.name || "";

  useEffect(() => {
    if (raiseTargets.some((person) => String(person.id) === String(employeeId))) return;
    setEmployeeId(raiseTargets[0]?.id || "");
  }, [employeeId, raiseTargets]);

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

  const saveCases = (next, extra) => {
    if (!company?.id) return;
    updateCompany(company.id, (row) => {
      row.disciplinaryCases = next;
      if (extra) Object.assign(row, extra);
    });
  };

  const patch = (item, fields) => {
    const now = new Date().toISOString();
    saveCases(cases.map((row) => (row.id === item.id ? { ...row, ...fields, updatedAt: now } : row)));
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
    saveCases([
      {
        id: uid(),
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
        dismissGround: penaltyKind === "dismiss" ? dismissGround.trim() : "",
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
    ]);
    setNote("");
    setDismissGround("");
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
      });
      return;
    }
    if (actionId === "sign") {
      const signGate = checkSignDisciplineGate(item, { today: board.today, cases });
      if (!signGate.ok) {
        toast({ description: ar ? signGate.reason : signGate.reasonEn, variant: "destructive" });
        return;
      }
      const signed = { status: "notify", decidedAt: now, signedAt: now, signedBy: who, notifiedAt: item.notifiedAt || now, hearingEndedAt: item.hearingEndedAt || now };
      const person = employees.find((row) => String(row.id) === String(item.employeeId));
      const post = planDisciplineFinePost({ ...item, ...signed }, person, currentUser, board.today);
      const nextLedger = post ? [...ledger, post] : ledger;
      saveCases(cases.map((row) => (row.id === item.id ? { ...row, ...signed, updatedAt: now, fineAmount: post?.amount || row.fineAmount } : row)), { disciplineFineLedger: nextLedger });
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
      patch(item, { status: "closed", rulingAt: now, rulingBy: who, rulingLabel: ar ? "أُغلق" : "Closed", rulingNote: ar ? "استقرّ الملف." : "The file settled." });
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
      patch(item, { status: "ruling", rulingOutcome: "keep", rulingAt: now, rulingBy: who, rulingLabel: ar ? "ثُبِّت الجزاء" : "Sanction upheld", rulingNote: ar ? "نُظر في الاعتراض وصدر القرار. ثُبِّت الجزاء كما وُقّع." : "The objection was heard. The sanction stands as signed." });
      return;
    }
    if (actionId === "lower") {
      const voidEntry = planDisciplineFineVoid(item, currentUser, board.today);
      saveCases(cases.map((row) => (row.id === item.id ? {
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
      } : row)), { disciplineFineLedger: [...ledger, voidEntry] });
      if (company?.id) liftDisciplineDeduction(company.id, item.employeeId, item, currentUser);
      return;
    }
    if (actionId === "void") {
      const voidEntry = planDisciplineFineVoid(item, currentUser, board.today);
      saveCases(cases.map((row) => (row.id === item.id ? {
        ...row,
        status: "closed",
        rulingOutcome: "void",
        rulingAt: now,
        rulingBy: who,
        rulingLabel: ar ? "أُلغي الجزاء" : "Sanction voided",
        rulingNote: ar ? "أُلغي الجزاء ورُفع من الملف." : "The sanction was voided and lifted from the file.",
        updatedAt: now,
      } : row)), { disciplineFineLedger: [...ledger, voidEntry] });
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
    patch(item, { signedPaper: { name: file.name, hash, url, at: new Date().toISOString() } });
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
    patch(item, { status: "appeal", appealNote: text, appealedAt: now, appealFile });
    setAppealDraft("");
  };

  const withdrawObject = (item) => {
    patch(item, { status: "notify", appealNote: "", appealedAt: "", appealFile: null });
  };

  return (
    <SuiteWorkspaceFrame
      ar={ar}
      kicker={pageKicker("/app/discipline", lang)}
      title={ar ? "الجزاءات" : "Sanctions"}
      hint={ar
        ? "وجهان لملف واحد: ما يراه الموظف — جزاؤه وحقّه في الاعتراض · ما يديره المسؤول — الرفع والمراحل والقرار. الجزاء إجراء موقَّع لا ملاحظة."
        : "Two faces of one file: what the employee sees — the sanction and the right to object — and what management runs — raising, the stages, and the decision. A sanction is a signed act, not a note."}
      tabs={tabs}
      tool={activeFace}
      onTool={setTab}
    >
      <div data-discipline-face={activeFace} style={{ display: "flex", flexDirection: "column", gap: 16, color: "var(--nv-ink)", fontSize: 13 }}>

        {activeFace === "schedule" ? (
          <DisciplineScheduleBoard ar={ar} today={board.today} />
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
            onDismissGround={setDismissGround}
            onSubmit={openCase}
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
            <div className="nv-disc-stats" data-discipline-admin="" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
              {board.stats.map((stat) => {
                const quiet = stat.val === "0" || stat.val === "—" || String(stat.val).startsWith("0 ");
                return (
                  <div key={stat.lbl} style={{ position: "relative", overflow: "hidden", background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 8, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span aria-hidden style={{ position: "absolute", insetInlineStart: 0, top: 0, bottom: 0, width: 3, background: stat.accent }} />
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--nv-ink3)" }}>{stat.lbl}</span>
                    <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <strong dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 22, fontWeight: 700, lineHeight: 1.15, color: quiet ? "var(--nv-ink)" : stat.accent, unicodeBidi: "isolate" }}>{stat.val}</strong>
                      {stat.unit ? <span style={{ fontSize: 12, fontWeight: 700, color: quiet ? "var(--nv-ink2)" : stat.accent }}>{stat.unit}</span> : null}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--nv-ink3)", lineHeight: 1.6 }}>{stat.note || "—"}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 8, padding: "10px 14px", fontSize: 12.5, color: "var(--nv-ink2)", lineHeight: 1.8 }}>
              <span aria-hidden style={{ width: 9, height: 9, borderRadius: "50%", background: "#C8A45A", flex: "none" }} />
              <span>
                {ar
                  ? "لرفع جزاء جديد افتح تبويب «ارفع جزاءً» — يمرّ بالبوابات النظامية ثم يظهر ملفه هنا."
                  : "To raise a sanction, open «Raise a sanction» — the statutory gates run first, then the file appears here."}
              </span>
            </div>

            {files.length === 0 ? (
              <section data-discipline-empty="" style={PACK_CARD}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--nv-line)" }}>
                  <strong style={{ fontSize: 13 }}>{ar ? "ملف الجزاء" : "Sanction file"} <span style={{ fontWeight: 500, color: "var(--nv-ink2)" }}>(0)</span></strong>
                </div>
                <div style={{ ...packHead("minmax(0,1fr)"), paddingInline: 12 }}>
                  <span>{ar ? "ملف الجزاء" : "Sanction file"}</span>
                </div>
                <div style={{ padding: "12px 14px", fontSize: 13, color: "var(--nv-ink)" }}>{ar ? "لا ملفات جزاء في نطاقك" : "No sanction files in your scope."}</div>
              </section>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--nv-ink2)", marginInlineEnd: 4 }}>{ar ? "ملفات الجزاء" : "Sanction files"}</span>
                  {files.map((card) => {
                    const on = String((files.find((row) => String(row.item.id) === String(caseSel)) || files[0]).item.id) === String(card.item.id);
                    return (
                      <button
                        key={card.item.id}
                        type="button"
                        onClick={() => setCaseSel(String(card.item.id))}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          height: 34,
                          padding: "0 12px",
                          borderRadius: 8,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          fontSize: 12.5,
                          whiteSpace: "nowrap",
                          fontWeight: on ? 700 : 500,
                          background: on ? "#0B3D27" : "var(--nv-card)",
                          color: on ? "var(--nv-btn-ink)" : "var(--nv-ink2)",
                          border: on ? "1px solid #0B3D27" : "1px solid var(--nv-line)",
                        }}
                      >
                        {card.employee?.name || "—"}
                        <span style={{
                          fontFamily: "'IBM Plex Mono',monospace",
                          fontSize: 10.5,
                          fontWeight: 600,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: on ? "rgba(255,255,255,.16)" : "var(--nv-soft)",
                          color: on ? "var(--nv-btn-ink)" : "var(--nv-ink2)",
                        }}
                        >
                          {ar ? card.face.shortAr : card.face.shortEn}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <DisciplineCaseCard
                  card={files.find((row) => String(row.item.id) === String(caseSel)) || files[0]}
                  ar={ar}
                  onAction={onAction}
                  onUploadSigned={onUploadSigned}
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
          <DisciplineLawBoard cases={adminVoice ? visibleCases : mine} employees={employees} ar={ar} today={board.today} />
        ) : null}

        {activeFace === "mine" ? (
          <div data-discipline-mine="" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <section style={PACK_CARD}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--nv-line)" }}>
                <strong style={{ fontSize: 13 }}>
                  {ar ? `ما يراه ${currentUser?.name || "—"} في ملفه` : `What ${currentUser?.name || "—"} sees on the file`}
                  {" "}
                  <span style={{ fontWeight: 500, color: "var(--nv-ink2)" }}>({mineLiveCards.length})</span>
                </strong>
              </div>
              <div style={packHead("minmax(0,1fr) 120px")}>
                <span style={{ paddingInlineStart: 12 }}>{ar ? `ما يراه ${currentUser?.name || "—"} في ملفه` : `What ${currentUser?.name || "—"} sees`}</span>
                <span style={{ paddingInlineStart: 10, borderInlineStart: "1px solid var(--nv-line)" }}>{ar ? "الحالة" : "Status"}</span>
              </div>
              {mineLiveCards.length === 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 120px", padding: "12px 14px", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "var(--nv-ink)" }}>{ar ? "لا جزاء مفتوح على ملفك" : "No open sanction on your file"}</span>
                  <span style={{ fontSize: 13, color: "var(--nv-muted)", justifySelf: "start" }}>—</span>
                </div>
              ) : mineLiveCards.map((card) => (
                <div key={card.item.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 120px", gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--nv-line2)", alignItems: "center" }}>
                  <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                    <strong style={{ fontSize: 13, color: "var(--nv-ink)" }}>{card.mineTitle || "—"}</strong>
                    <span style={{ fontSize: 11.5, color: "var(--nv-ink2)", lineHeight: 1.6 }}>{card.mineLine || "—"}</span>
                  </span>
                  <span style={statusPill(card.face?.id === "objected" ? "bad" : card.face?.id === "signed" ? "ok" : "warn")}>{card.mineState || "—"}</span>
                </div>
              ))}
            </section>

            {mineLiveCards.map((card) => (
              <DisciplineMineCard
                key={`act-${card.item.id}`}
                card={card}
                ar={ar}
                draft={appealDraft}
                onDraft={setAppealDraft}
                onObject={fileObject}
                onWithdraw={withdrawObject}
              />
            ))}

            <section style={PACK_CARD}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--nv-line)" }}>
                <strong style={{ fontSize: 13 }}>{ar ? "حقوقي في هذا المسار" : "My rights on this path"} <span style={{ fontWeight: 500, color: "var(--nv-ink2)" }}>({RIGHTS.length})</span></strong>
              </div>
              <div className="nv-disc-gates" style={packHead("104px minmax(0,1fr)")}>
                <span style={{ paddingInlineStart: 12 }}>{ar ? "المرجع" : "Reference"}</span>
                <span style={{ paddingInlineStart: 10, borderInlineStart: "1px solid var(--nv-line)" }}>{ar ? "حقوقي في هذا المسار" : "My rights on this path"}</span>
              </div>
              {RIGHTS.map((row) => (
                <div key={row.ruleId} className="nv-disc-gates" style={{ display: "grid", gridTemplateColumns: "104px minmax(0,1fr)", gap: 12, padding: "10px 14px", borderBottom: "1px solid var(--nv-line2)", alignItems: "center" }}>
                  <LaborArticleCite ruleId={row.ruleId} ar={ar} />
                  <span style={{ fontSize: 12.5, color: "var(--nv-ink)", lineHeight: 1.7, minWidth: 0 }}>{ar ? row.ar : row.en}</span>
                </div>
              ))}
            </section>

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
    </SuiteWorkspaceFrame>
  );
}
