import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { updateCompany } from "@/lib/store";
import { toast } from "@/components/ui/use-toast";
import { countAr, decorateDisciplineCase, deriveDisciplineBoard, isDisciplineSettled, isErasedFromEmployeeRecord } from "@/lib/disciplineBoard";
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
import PlatformDateField from "@/components/shared/PlatformDateField";
import DisciplineFineFund from "@/components/discipline/DisciplineFineFund";
import { pageKicker } from "@/lib/moduleMeta";
import { sha256HexOfFile } from "@/lib/fileHash";
import { readConsentFile } from "@/lib/writtenConsent";
import DisciplineArchiveBoard from "@/components/discipline/DisciplineArchiveBoard";
import DisciplineCaseCard from "@/components/discipline/DisciplineCaseCard";
import DisciplineLawBoard from "@/components/discipline/DisciplineLawBoard";
import DisciplineMineCard from "@/components/discipline/DisciplineMineCard";
import PlatformStampShell from "@/components/shared/PlatformStampShell";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import { generateDisciplineDeduction, liftDisciplineDeduction } from "@/lib/deductionGenerators";
import useStationScope, { matchesStationScope } from "@/hooks/useStationScope";
import { laborCalendarOf } from "@/lib/ummAlQuraCalendar";
import { railLaneTabs, useRailSide } from "@/lib/railSide";

function uid() {
  return `dsc_${Date.now().toString(36)}`;
}

const field = {
  fontFamily: "inherit",
  fontSize: 12,
  padding: "9px 10px",
  border: "1px solid var(--nv-line)",
  borderRadius: 10,
  background: "var(--nv-card)",
  color: "var(--nv-ink)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

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
  const cases = data?.disciplinaryCases || [];
  const employees = data?.employees || [];
  const stations = data?.stations || [];
  const stationScope = useStationScope();
  const canManage = Boolean(currentUser && (data?.ownerId === currentUser.id || currentUser.hrLevelId || ["director", "ops_manager", "station_manager"].includes(currentUser.role)));
  const scopedEmployees = canManage
    ? employees.filter((person) => matchesStationScope(person.stationId || person.station_id, stationScope))
    : employees;
  const raiseTargets = scopedEmployees.filter((person) => String(person.id) !== String(currentUser?.id));
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
  const tab = ["mine", "manage", "law"].includes(requestedTab) ? requestedTab : "mine";
  const setTab = (next) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    setSearchParams(params, { replace: true });
  };
  const [mineFace, setMineFace] = useState("live");
  const [manageFace, setManageFace] = useState("live");
  const [newOpen, setNewOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState(employees[0]?.id || "");
  const [penaltyKind, setPenaltyKind] = useState("warning");
  const [penaltyDays, setPenaltyDays] = useState(1);
  const [discoveredAt, setDiscoveredAt] = useState(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date()));
  const [dismissGround, setDismissGround] = useState("");
  const [offSite, setOffSite] = useState(false);
  const [workConnected, setWorkConnected] = useState("");
  const [note, setNote] = useState("");
  const [appealDraft, setAppealDraft] = useState("");
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
  const mineSettledCount = mine.filter((item) => isDisciplineSettled(item)).length;
  const manageSettledCount = visibleCases.filter((item) => isDisciplineSettled(item)).length;
  const kindSpec = listedPenaltyKind(penaltyKind) || DISCIPLINE_PENALTY_KINDS[0];
  const cutDays = kindSpec.days.includes(0) && kindSpec.days.length === 1 ? 0 : Number(penaltyDays) || kindSpec.days[0] || 0;
  const ready = Boolean(note.trim() && employeeId);
  const ledger = data?.disciplineFineLedger || [];

  const tabs = railLaneTabs([
    { key: "mine", ar: "ملفي", en: "My file", count: myOpen },
    ...(canManage ? [{ key: "manage", ar: "إدارة", en: "Manage", count: board.openCount }] : []),
    { key: "law", ar: "أنظمة الوزارة", en: "Ministry rules" },
  ], railSide).map((item, index) => ({ ...item, num: String(index + 1).padStart(2, "0") }));

  let activeFace = ["mine", "manage", "law"].includes(tab) && (canManage || tab !== "manage") ? tab : "mine";
  if (railSide === "employee" && activeFace === "manage") activeFace = "mine";
  if (railSide === "manage" && canManage && activeFace === "mine") activeFace = "manage";
  const adminVoice = canManage && railSide !== "employee";

  const laneChip = (on) => ({
    fontFamily: "inherit",
    fontSize: 11,
    padding: "7px 12px",
    border: `1px solid ${on ? "var(--nv-navy)" : "var(--nv-line)"}`,
    borderRadius: 10,
    background: on ? "var(--nv-navy)" : "var(--nv-card)",
    color: on ? "var(--nv-btn-ink)" : "var(--nv-ink2)",
    fontWeight: on ? 700 : 400,
    cursor: "pointer",
    whiteSpace: "nowrap",
    display: "inline-flex",
    gap: 6,
    alignItems: "center",
  });

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
    if (!ready || !canManage) return;
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
    setNewOpen(false);
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
    <PlatformStampShell ar={ar} bare maxWidth={1320}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, color: "var(--nv-ink)", fontSize: 13 }}>
        <section className="nv-paper" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
            <span style={{ fontSize: 11, letterSpacing: ".14em", color: "var(--nv-muted)", display: "flex", gap: 7, alignItems: "center" }}>
              <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace" }}>{String(pageKicker("/app/discipline", "en")).slice(0, 2) || "04"}</span>
              <span>·</span>
              <span>{pageKicker("/app/discipline", lang).replace(/^\d+\s*·\s*/, "")}</span>
            </span>
            <span style={{ fontFamily: "'Noto Naskh Arabic',serif", fontSize: 24, fontWeight: 600 }}>{ar ? "الجزاءات" : "Sanctions"}</span>
            <span style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.85 }}>
              {ar
                ? <>وجهان لملف واحد: <b>ما يراه الموظف</b> — جزاؤه وحقّه في الاعتراض · <b>ما يديره المسؤول</b> — الرفع والمراحل والقرار. الجزاء إجراء موقَّع لا ملاحظة.</>
                : <>Two faces of one file: <b>what the employee sees</b> — the sanction and the right to object · <b>what management runs</b> — raise, stages, and the decision. A sanction is a signed act, not a note.</>}
            </span>
          </div>
          <span style={{ fontSize: 11, color: "var(--nv-ink2)", lineHeight: 1.7, maxWidth: 340 }}>
            {adminVoice
              ? (ar ? "إدارة — ترفع الجزاء وتحرّك مراحله وتوقّعه وتقرّر في الاعتراض، ضمن ما تسمح به مواد التأديب — انظر تبويب أنظمة الوزارة." : "Management — you raise, move stages, sign, and rule on an objection, within the discipline articles — see Ministry rules.")
              : (ar ? "موظف — ترى إبلاغك وتحقيقك وجزاءك، وتعترض على الموقَّع. الرفع والتوقيع والقرار ليست من صلاحيتك." : "Employee — you see your notice, hearing, and sanction, and object to what was signed. Raising, signing, and ruling are not yours.")}
          </span>
        </section>

        <div className="nv-paper" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", padding: "9px 14px", display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
          {tabs.map((item) => {
            const on = activeFace === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                aria-current={on ? "page" : undefined}
                style={{
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: on ? 700 : 400,
                  padding: "9px 16px",
                  border: `1px solid ${on ? "var(--nv-navy)" : "var(--nv-line)"}`,
                  background: on ? "var(--nv-navy)" : "var(--nv-card)",
                  color: on ? "var(--nv-btn-ink)" : "var(--nv-ink2)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  whiteSpace: "nowrap",
                  borderRadius: 10,
                }}
              >
                <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, opacity: 0.75 }}>{item.num}</span>
                {ar ? item.ar : item.en}
                {item.count ? (
                  <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, background: on ? "color-mix(in oklab, var(--nv-btn-ink) 28%, transparent)" : "var(--nv-mute-soft)", color: on ? "var(--nv-btn-ink)" : "var(--nv-ink2)", padding: "1px 7px", borderRadius: 999 }}>
                    {item.count}
                  </span>
                ) : null}
              </button>
            );
          })}
          <span style={{ marginInlineStart: "auto", display: "inline-flex", alignItems: "center", gap: 9, fontSize: 12, fontWeight: 600, color: board.pulseColor, background: board.pulseBg, border: `1px solid ${board.pulseBorder}`, borderRadius: 10, padding: "8px 13px", whiteSpace: "nowrap" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: board.pulseDot }} />
            {board.pulse}
          </span>
        </div>

        {canManage && activeFace === "manage" ? (
          <>
            <div className="nv-paper" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", padding: "9px 14px", display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
              {[
                ["live", ar ? "الكل" : "All", board.openCount],
                ["archive", ar ? "الأرشيف" : "Archive", manageSettledCount],
              ].map(([id, label, n]) => {
                const on = manageFace === id;
                return (
                  <button key={id} type="button" onClick={() => setManageFace(id)} style={laneChip(on)}>
                    {label}
                    <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, opacity: 0.8 }}>{n}</span>
                  </button>
                );
              })}
              <span style={{ marginInlineStart: "auto", fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.7 }}>
                {ar ? "الأرشيف بعد «الكل» — ما استقرّ في نطاق فرعك." : "Archive sits after All — settled files in your station scope."}
              </span>
            </div>

            {manageFace === "archive" ? (
              <DisciplineArchiveBoard
                cases={visibleCases}
                employees={employees}
                stations={stations}
                ar={ar}
                today={board.today}
                scope="manage"
                selfOnly={false}
                userId={currentUser?.id}
              />
            ) : (
            <>
            <div className="nv-disc-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
              {board.stats.map((stat) => (
                <div key={stat.lbl} className="nv-paper" style={{ background: "var(--nv-card)", border: `1px solid ${stat.border}`, borderTop: `3px solid ${stat.accent}`, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                  <span style={{ fontSize: 12, color: "var(--nv-ink2)" }}>{stat.lbl}</span>
                  <span style={{ display: "flex", alignItems: "baseline", gap: 5, flexWrap: "wrap" }}>
                    <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 30, fontWeight: 500, color: stat.accent, lineHeight: 1.05 }}>{stat.val}</span>
                    {stat.unit ? <span style={{ fontSize: 12, fontWeight: 600, color: stat.accent }}>{stat.unit}</span> : null}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.7 }}>{stat.note}</span>
                </div>
              ))}
            </div>

            <div className="nv-emp-summary" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.15fr) minmax(0,1fr)", gap: 16, alignItems: "stretch" }}>
              <section className="nv-paper" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--nv-line3)", display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "ما يديره المسؤول — مسار المادة 71" : "What management runs — Article 71 path"}</span>
                  <span style={{ fontSize: 12, color: "var(--nv-muted)", lineHeight: 1.75 }}>
                    {ar ? "لا يُوقَّع جزاء قبل إبلاغ كتابي وسماع دفاع. المرحلة تتقدّم بقرار موقَّع، لا بمضيّ الوقت." : "No penalty before written notice and a hearing. A stage moves by a signed decision, not by time passing."}
                  </span>
                </div>
                <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {board.stages.map((stage) => (
                    <div key={stage.id} style={{ display: "grid", gridTemplateColumns: "minmax(90px,auto) minmax(0,1fr) 26px", gap: 11, alignItems: "center" }}>
                      <span style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
                        <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "var(--nv-muted)" }}>{stage.num}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{stage.name}</span>
                      </span>
                      <span style={{ display: "block", height: 10, background: "var(--nv-soft)", overflow: "hidden", borderRadius: 999 }}>
                        <span style={{ display: "block", height: "100%", width: stage.pct, background: stage.color }} />
                      </span>
                      <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 15, fontWeight: 500, color: stage.color, textAlign: "end" }}>{stage.n}</span>
                    </div>
                  ))}
                  <span style={{ fontSize: 11, color: "var(--nv-ink2)", lineHeight: 1.9, borderTop: "1px solid var(--nv-line2)", paddingTop: 10 }}>{board.stageNote}</span>
                </div>
              </section>

              <section className="nv-paper" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--nv-line3)", fontSize: 15, fontWeight: 700 }}>
                  {ar ? "القيود التي تمنع التوقيع" : "Gates that block signing"}
                </div>
                {board.gates.map((gate) => (
                  <div key={gate.head} style={{ padding: "13px 20px", borderBottom: "1px solid var(--nv-line2)", display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", gap: 11, alignItems: "start" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "var(--nv-ink2)", background: "var(--nv-mute-soft)", border: "1px solid var(--nv-mute-line)", borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap", marginTop: 2 }}>{gate.tag}</span>
                    <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{gate.head}</span>
                      <span style={{ fontSize: 11, color: "var(--nv-ink2)", lineHeight: 1.85 }}>{gate.body}</span>
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: gate.color, background: gate.bg, border: `1px solid ${gate.border}`, borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap", marginTop: 2 }}>{gate.state}</span>
                  </div>
                ))}
                <div style={{ padding: "13px 20px", fontSize: 11, color: "var(--nv-ink2)", lineHeight: 1.9 }}>
                  {ar ? "كل مانع له سبب ظاهر عند محاولة التوقيع — لا يُمنع الإجراء صامتاً." : "Every block names its reason at the moment of signing."}
                </div>
              </section>
            </div>

            <section className="nv-paper" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--nv-line3)", display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "ملفات الجزاء" : "Sanction files"}</span>
                  <span style={{ fontSize: 12, color: "var(--nv-muted)", lineHeight: 1.75 }}>{board.recordScope}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setNewOpen((value) => !value)}
                  style={{ marginInlineStart: "auto", fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "10px 16px", border: "none", borderRadius: 10, background: "var(--nv-ok-fill)", color: "var(--nv-btn-ink)", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  {newOpen ? (ar ? "أغلق نموذج الرفع" : "Close the raise form") : (ar ? "ارفع جزاءً" : "Raise a sanction")}
                </button>
              </div>

              {newOpen ? (
                <div style={{ padding: "15px 20px", borderBottom: "1px solid var(--nv-line3)", background: "var(--nv-soft)", display: "flex", flexDirection: "column", gap: 11 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{ar ? "رفع جزاء — يفتح الملف في مرحلة «أُبلغ كتابةً» على محطة عمل الموظف لا نطاق الرأس" : "Raise a sanction — opens the file at “notified in writing” on the employee's work station, not the header scope"}</span>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,190px),1fr))", gap: 10 }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                      <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{ar ? "الموظف" : "Employee"}</span>
                      <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} style={field}>
                        {raiseTargets.map((person) => {
                          const station = stations.find((row) => row.id === (person.stationId || person.station_id));
                          return <option key={person.id} value={person.id}>{person.name}{station?.name ? ` — ${station.name}` : ""}</option>;
                        })}
                      </select>
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                      <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{ar ? "الجزاء من المادة 66" : "Penalty from Article 66"}</span>
                      <select
                        value={penaltyKind}
                        onChange={(event) => {
                          const next = event.target.value;
                          setPenaltyKind(next);
                          const spec = listedPenaltyKind(next);
                          setPenaltyDays(spec?.days.find((n) => n > 0) || spec?.days[0] || 0);
                        }}
                        style={field}
                      >
                        {DISCIPLINE_PENALTY_KINDS.map((row) => (
                          <option key={row.id} value={row.id}>{ar ? row.ar : row.en}</option>
                        ))}
                      </select>
                    </label>
                    {kindSpec.days.some((n) => n > 0) ? (
                      <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                        <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{ar ? "الأيام — سقف المادة 70 خمسة" : "Days — Article 70 cap is five"}</span>
                        <select value={String(cutDays)} onChange={(event) => setPenaltyDays(Number(event.target.value))} style={field}>
                          {kindSpec.days.filter((n) => n > 0).map((n) => (
                            <option key={n} value={n}>{listedPenaltyLabel(penaltyKind, n, ar)}</option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                      <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{ar ? "تاريخ كشف المخالفة — المادة 69" : "Date the offence was discovered — Article 69"}</span>
                      <PlatformDateField ar={ar} value={discoveredAt} onChange={setDiscoveredAt} />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, gridColumn: "1 / -1" }}>
                      <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{ar ? "المخالفة كما ستُبلَّغ كتابةً" : "Offence as it will be notified"}</span>
                      <input value={note} onChange={(event) => setNote(event.target.value)} placeholder={ar ? "الواقعة وتاريخها — بلا وصف لا يصحّ الإبلاغ" : "The incident and its date — notice needs a written description"} style={field} />
                    </label>
                    {penaltyKind === "dismiss" ? (
                      <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, gridColumn: "1 / -1" }}>
                        <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{ar ? "الحالة المقررة للفصل — المادة 66 مع المادة 80" : "Prescribed dismissal case — Articles 66 and 80"}</span>
                        <input value={dismissGround} onChange={(event) => setDismissGround(event.target.value)} placeholder={ar ? "اكتب الحالة المقررة كما في النظام — لا فصل بلا سند" : "Write the prescribed case as in the Law — no dismissal without a ground"} style={field} />
                      </label>
                    ) : null}
                    <label style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, gridColumn: "1 / -1", fontSize: 12 }}>
                      <input type="checkbox" checked={offSite} onChange={(event) => setOffSite(event.target.checked)} />
                      <span>{ar ? "ارتكبت خارج مكان العمل — المادة 70" : "Committed outside the workplace — Article 70"}</span>
                    </label>
                    {offSite ? (
                      <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, gridColumn: "1 / -1" }}>
                        <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{ar ? "صلة الواقعة بالعمل أو بصاحبه أو بالمدير المسؤول" : "How the act connects to the work, the employer, or the responsible manager"}</span>
                        <input value={workConnected} onChange={(event) => setWorkConnected(event.target.value)} placeholder={ar ? "بلا صلة لا يُفتح الملف" : "Without a work link the file does not open"} style={field} />
                      </label>
                    ) : null}
                    <div style={{ gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", gap: 8 }}>
                      <LaborArticleCite ruleId="discipline.penalties.cite" ar={ar} />
                      <LaborArticleCite ruleId="discipline.listedOnly.cite" ar={ar} />
                      <LaborArticleCite ruleId="discipline.charge.maxDays" ar={ar} />
                      <LaborArticleCite ruleId="discipline.fine.maxDays" ar={ar} />
                      <LaborArticleCite ruleId="discipline.workplace.cite" ar={ar} />
                      <LaborArticleCite ruleId="discipline.hearing.cite" ar={ar} />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={openCase}
                    style={{
                      fontFamily: "inherit",
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "10px 16px",
                      border: "none",
                      borderRadius: 10,
                      background: ready ? "var(--nv-navy)" : "var(--nv-line3)",
                      color: ready ? "var(--nv-btn-ink)" : "var(--nv-muted)",
                      cursor: ready ? "pointer" : "default",
                      alignSelf: "flex-start",
                    }}
                  >
                    {ready ? (ar ? "أبلغ الموظف كتابةً وافتح الملف" : "Notify the employee in writing and open the file") : (ar ? "اكتب المخالفة أولاً" : "Write the offence first")}
                  </button>
                </div>
              ) : null}

              {files.length === 0 ? (
                <div style={{ padding: "18px 20px", fontSize: 12, color: "var(--nv-muted)" }}>
                  {ar ? "لا ملفات جزاء بعد." : "No sanction files yet."}
                </div>
              ) : files.map((card) => (
                <DisciplineCaseCard key={card.item.id} card={card} ar={ar} onAction={onAction} onUploadSigned={onUploadSigned} />
              ))}
              <div style={{ padding: "13px 20px", fontSize: 11, color: "var(--nv-ink2)", lineHeight: 1.9 }}>{board.recordNote}</div>
            </section>

            <DisciplineFineFund ledger={ledger} ar={ar} today={board.today} onDispose={disposeFines} />
            </>
            )}
          </>
        ) : null}

        {activeFace === "law" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <DisciplineLawBoard cases={visibleCases} employees={employees} ar={ar} today={board.today} />
            {canManage ? <DisciplineFineFund ledger={ledger} ar={ar} today={board.today} onDispose={disposeFines} /> : null}
          </div>
        ) : null}

        {activeFace === "mine" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="nv-paper" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", padding: "9px 14px", display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
              {[
                ["live", ar ? "ما في ملفي" : "On my file", mineLiveCards.length],
                ["archive", ar ? "الأرشيف" : "Archive", mineSettledCount],
              ].map(([id, label, n]) => {
                const on = mineFace === id;
                return (
                  <button key={id} type="button" onClick={() => setMineFace(id)} style={laneChip(on)}>
                    {label}
                    <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, opacity: 0.8 }}>{n}</span>
                  </button>
                );
              })}
              {canManage ? (
                <span style={{ marginInlineStart: "auto", fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.7 }}>
                  {ar ? "أرشيف الإدارة بعد «الكل» في تبويب إدارة." : "Manage archive sits after All on the Manage tab."}
                </span>
              ) : null}
            </div>

            {mineFace === "archive" ? (
              <DisciplineArchiveBoard
                cases={mine}
                employees={employees}
                stations={stations}
                ar={ar}
                today={board.today}
                scope="mine"
                selfOnly
                userId={currentUser?.id}
              />
            ) : (
          <div className="nv-emp-summary" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1fr)", gap: 16, alignItems: "stretch" }}>
            <section className="nv-paper" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--nv-line3)", display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? `ما يراه ${currentUser?.name || ""} في ملفه` : `What ${currentUser?.name || "you"} see on the file`}</span>
                <span style={{ fontSize: 12, color: "var(--nv-muted)", lineHeight: 1.8 }}>
                  {mineLiveCards.length
                    ? (myOpen
                      ? (ar
                        ? countAr(myOpen, "جزاء واحد ساري لك أن تعترض عليه", "جزاءان ساريان لك أن تعترض عليهما", "جزاءات سارية لك أن تعترض عليها", "جزاءً سارياً")
                        : `${myOpen} sanction(s) in force that you may object to`)
                      : (ar ? "ترى إبلاغك وتحقيقك هنا. الاعتراض يبدأ بعد التوقيع." : "You see your notice and hearing here. Objection starts after signing."))
                    : (ar ? "لا جزاء مفتوح على ملفك — المستقرّ في الأرشيف." : "No open sanction on your file — settled ones sit in the archive.")}
                </span>
              </div>
              {mineLiveCards.length === 0 ? (
                <div style={{ padding: "18px 20px" }}>
                  <span style={{ fontSize: 12, color: "var(--nv-ok-ink)", fontWeight: 600 }}>{ar ? "لا جزاءات مفتوحة على ملفك." : "No open sanctions on your file."}</span>
                </div>
              ) : mineLiveCards.map((card) => (
                <DisciplineMineCard
                  key={card.item.id}
                  card={card}
                  ar={ar}
                  draft={appealDraft}
                  onDraft={setAppealDraft}
                  onObject={fileObject}
                  onWithdraw={withdrawObject}
                />
              ))}
            </section>

            <section className="nv-paper" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--nv-line3)", fontSize: 15, fontWeight: 700 }}>
                {ar ? "حقوقي في هذا المسار" : "My rights on this path"}
              </div>
              {RIGHTS.map((row) => (
                <div key={row.ruleId} style={{ padding: "12px 20px", borderBottom: "1px solid var(--nv-line2)", display: "flex", flexDirection: "column", gap: 6 }}>
                  <LaborArticleCite ruleId={row.ruleId} ar={ar} showText />
                  <span style={{ fontSize: 11, color: "var(--nv-ink2)", lineHeight: 1.9, minWidth: 0 }}>{ar ? row.ar : row.en}</span>
                </div>
              ))}
              <div style={{ padding: "13px 20px", fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.9 }}>
                {ar
                  ? <>الاعتراض ليس شكوى: الشكوى واقعة تريد أن تُنظر، والاعتراض حقّ مقيّد بملف جزاء وُقّع عليك. ارفع شكواك من <Link to="/app/complaints" style={{ color: "inherit" }}>صوت الموظف</Link>. جزاؤك الظاهر في <Link to={currentUser?.id ? `/app/employees/${currentUser.id}?tab=growth` : "/app/employees"} style={{ color: "inherit" }}>ملفك</Link>، والحسم النافذ في <Link to="/app/payroll" style={{ color: "inherit" }}>المسير</Link>.</>
                  : <>An objection is not a complaint. Raise a complaint from <Link to="/app/complaints" style={{ color: "inherit" }}>Employee voice</Link>. What is visible sits on <Link to={currentUser?.id ? `/app/employees/${currentUser.id}?tab=growth` : "/app/employees"} style={{ color: "inherit" }}>your file</Link>, and an effective cut on <Link to="/app/payroll" style={{ color: "inherit" }}>payroll</Link>.</>}
              </div>
            </section>
          </div>
            )}
          </div>
        ) : null}
      </div>
    </PlatformStampShell>
  );
}
