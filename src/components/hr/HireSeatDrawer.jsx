import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { setEmployeePassword, setStationManager } from "@/lib/store";
import {
  annualLeaveFromHireDate,
  CONTRACT_TYPES,
  formatSalaryRange,
  hireContractId,
  hireFromSeat,
  HIRE_SESSION_SUGGEST_AT,
  inviteUrl,
  isBranchManagerTitle,
  seatReadout,
  stationHasManager,
  todayKey,
  vacantSeats,
} from "@/lib/orgHire";
import { downloadHireTemplate } from "@/lib/hireTemplate";
import { gradesForList, jobGradeLabel } from "@/lib/jobGrades";
import { companyLists, listPositions, templateLabel } from "@/lib/permissionTemplates";
import {
  PROFILE_GROUPS,
  isProfileFieldVisible,
  profileFieldLabel,
  profileFieldOptions,
} from "@/lib/employeeProfileFields";
import { checkSaudiIdentityGate, checkContractTermGate, nationalityIsSaudi } from "@/lib/complianceDerivations";
import { checkProbationGate } from "@/lib/contractLawDerivations";
import { BORDER, CARD, INK, MUTED, NAVY, NAVY_FILL, SURFACE, field, labelMuted, ui } from "@/lib/platformStyles";
import { isManagerUnit, workplaceStations } from "@/lib/stationTree";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import PlatformDateField from "@/components/shared/PlatformDateField";

const SKIP_PROFILE_KEYS = new Set(["position", "department"]);

const emptyPerson = () => ({
  name: "",
  email: "",
  password: "",
  nationalId: "",
  phone: "",
  hireDate: todayKey(),
  contractType: "indefinite",
  contractEndDate: "",
});

const emptyProfile = () => {
  const next = {};
  PROFILE_GROUPS.forEach((group) => {
    group.fields.forEach((item) => {
      next[item.key] = item.key === "hireDate" ? todayKey() : item.key === "contractType" ? "indefinite" : "";
    });
  });
  return next;
};

function Field({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelMuted}>{label}</span>
      {children}
    </label>
  );
}

function ReadRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, lineHeight: 1.5 }}>
      <span style={{ color: MUTED }}>{label}</span>
      <span style={{ color: NAVY, fontWeight: 600, textAlign: "end" }}>{value || "—"}</span>
    </div>
  );
}

const ADMIN_HIRE = {
  ar: "المدير ليس مكان توظيف. حوّله إلى فرع ثم وظّف عليه.",
  en: "A manager is not a hire workplace. Convert it to a branch, then hire there.",
};

export default function HireSeatDrawer({
  open,
  data,
  companyId,
  ar,
  stationId = "",
  seatId = "",
  listId = "",
  listName = "",
  onClose,
  onNeedAccess,
}) {
  const [step, setStep] = useState(1);
  const [person, setPerson] = useState(emptyPerson);
  const [profile, setProfile] = useState(emptyProfile);
  const [chosenSeatId, setChosenSeatId] = useState(seatId || "");
  const [creating, setCreating] = useState(false);
  const [newSeat, setNewSeat] = useState({ title: "", listId: "", gradeId: "", stationId: stationId || "" });
  const [added, setAdded] = useState(0);
  const [busy, setBusy] = useState(false);
  const [extraStationIds, setExtraStationIds] = useState([]);
  const [makeManager, setMakeManager] = useState(false);

  const packs = useMemo(() => companyLists(data), [data]);
  const hasLists = packs.length > 0;
  const resolvedListId = useMemo(() => {
    if (listId) return listId;
    if (!listName) return "";
    const pack = packs.find((item) => item.id === listName || item.ar === listName || item.en === listName || templateLabel(item, true) === listName);
    return pack?.id || "";
  }, [listId, listName, packs]);
  const vacancies = useMemo(
    () => vacantSeats(data, stationId || undefined, resolvedListId || listName || undefined),
    [data, stationId, resolvedListId, listName],
  );
  const allVacancies = useMemo(() => vacantSeats(data), [data]);
  const pool = stationId || resolvedListId || listName ? vacancies : allVacancies;
  const listKey = newSeat.listId || resolvedListId;
  const listGrades = useMemo(() => gradesForList(data, listKey), [data, listKey]);
  const listPack = packs.find((pack) => pack.id === listKey);
  const stations = workplaceStations(data?.stations || []);
  const lockedSeat = Boolean(seatId);
  const activeSeat = (data?.orgSeats || []).find((item) => item.id === chosenSeatId) || null;
  const readout = seatReadout(activeSeat, data, ar);
  const leaveDays = annualLeaveFromHireDate(person.hireDate || profile.hireDate);
  const homeId = stationId || newSeat.stationId || activeSeat?.stationId || "";
  const homeStation = (data?.stations || []).find((item) => item.id === homeId);
  const hasManager = stationHasManager(homeStation);
  const catalogTitles = listPositions(listPack).filter((item) => !hasManager || !isBranchManagerTitle(item.title));
  const openSeats = pool.filter((seat) => !hasManager || !isBranchManagerTitle(seat.title));
  const adminHome = Boolean(homeId && isManagerUnit(homeStation));
  const stationName = homeStation?.name || "";
  const extraStations = stations.filter((item) => item.id !== homeId);

  useEffect(() => {
    if (!open) return;
    const packsNow = companyLists(data);
    const matching = vacantSeats(data, stationId || undefined, listId || listName || undefined);
    const defaultList = listId
      || packsNow.find((item) => item.ar === listName || item.en === listName || templateLabel(item, true) === listName)?.id
      || (packsNow.length === 1 ? packsNow[0].id : "");
    const defaultGrades = gradesForList(data, defaultList);
    setStep(1);
    setPerson(emptyPerson());
    setProfile(emptyProfile());
    setChosenSeatId(seatId || "");
    setCreating(!seatId && matching.length === 0);
    setNewSeat({
      title: "",
      listId: defaultList,
      gradeId: defaultGrades.length === 1 ? defaultGrades[0].id : "",
      stationId: stationId || "",
    });
    setExtraStationIds([]);
    setMakeManager(false);
  }, [open, seatId, stationId, listId, listName]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || chosenSeatId || creating || lockedSeat) return;
    if (openSeats.length === 1) setChosenSeatId(openSeats[0].id);
  }, [open, openSeats, chosenSeatId, creating, lockedSeat]);

  useEffect(() => {
    if (!homeId) return;
    setExtraStationIds((current) => (current.includes(homeId) ? current.filter((id) => id !== homeId) : current));
  }, [homeId]);

  useEffect(() => {
    if (!hasManager) return;
    setMakeManager(false);
    if (isBranchManagerTitle(newSeat.title)) {
      setNewSeat((current) => (isBranchManagerTitle(current.title) ? { ...current, title: "" } : current));
    }
  }, [hasManager]);

  if (!open) return null;

  const setField = (key, value) => setPerson((current) => ({ ...current, [key]: value }));
  const setProfileField = (key, value) => setProfile((current) => ({ ...current, [key]: value }));

  const placementReady = () => {
    if (adminHome) return false;
    if (lockedSeat && chosenSeatId) return !(hasManager && isBranchManagerTitle(activeSeat?.title));
    if (!creating && chosenSeatId) return !(hasManager && isBranchManagerTitle(activeSeat?.title));
    if (!creating) return false;
    const seatHomeId = stationId || newSeat.stationId;
    if (!seatHomeId || !newSeat.title.trim()) return false;
    if (!newSeat.listId && !resolvedListId) return false;
    if (listGrades.length && !newSeat.gradeId) return false;
    if (creating && hasManager && isBranchManagerTitle(newSeat.title)) return false;
    return true;
  };

  const save = async (mode) => {
    if (!hasLists) {
      toast({
        description: ar
          ? "أنشئ صلاحية أولاً حتى يوزّع الموارد البشرية المناصب."
          : "Create an access pack first so HR can distribute titles.",
        variant: "destructive",
      });
      onNeedAccess?.();
      return;
    }
    const draft = mode === "draft";
    const email = String(person.email || "").trim();
    const password = String(person.password || "");
    const name = String(person.name || "").trim();
    const nationalId = String(profile.nationalId || person.nationalId || "").replace(/\D/g, "").slice(0, 10);
    const phone = String(profile.phone || person.phone || "").trim();
    const hireDate = String(profile.hireDate || person.hireDate || todayKey()).slice(0, 10);
    const contractType = hireContractId(profile.contractType || person.contractType);
    const contractEndDate = String(profile.contractEndDate || person.contractEndDate || "").slice(0, 10);

    if (!name) {
      toast({ description: ar ? "الاسم مطلوب." : "Name is required.", variant: "destructive" });
      setStep(2);
      return;
    }
    const identity = checkSaudiIdentityGate({ ...profile, nationalId, nationality: profile.nationality });
    if (!identity.ok) {
      toast({ description: ar ? identity.reason : identity.reasonEn, variant: "destructive" });
      setStep(2);
      return;
    }
    const termGate = checkContractTermGate({
      contractType: contractType === "fixed" ? "fixed" : "indefinite",
      contractEndDate: contractType === "fixed" ? contractEndDate : "",
      hireDate,
      nationality: profile.nationality,
      nationalId,
    });
    if (!termGate.ok) {
      toast({ description: ar ? termGate.reason : termGate.reasonEn, variant: "destructive" });
      setStep(2);
      return;
    }
    const probationGate = checkProbationGate({
      probation: contractType === "trial",
      probationDays: profile.probationDays,
      hireDate,
    });
    if (!probationGate.ok) {
      toast({ description: ar ? probationGate.reason : probationGate.reasonEn, variant: "destructive" });
      setStep(2);
      return;
    }
    if (password && password.length < 6) {
      toast({ description: ar ? "كلمة المرور 6 أحرف على الأقل." : "Password must be at least 6 characters.", variant: "destructive" });
      setStep(3);
      return;
    }
    if (password && !email) {
      toast({ description: ar ? "البريد مطلوب مع كلمة المرور حتى يدخل الموظف." : "Email is required with a password so the employee can sign in.", variant: "destructive" });
      setStep(3);
      return;
    }
    if (!placementReady()) {
      toast({ description: ar ? "أكمل الفرع والقائمة والمنصب والدرجة." : "Finish the branch, list, title, and grade.", variant: "destructive" });
      setStep(1);
      return;
    }
    if (!chosenSeatId && !creating) {
      toast({ description: ar ? "اختر منصبًا شاغرًا أو أنشئ واحدًا." : "Pick a vacant seat or create one.", variant: "destructive" });
      setStep(1);
      return;
    }
    const seatHomeId = stationId || newSeat.stationId;
    if (creating && isManagerUnit((data?.stations || []).find((item) => item.id === seatHomeId))) {
      toast({ description: ar ? ADMIN_HIRE.ar : ADMIN_HIRE.en, variant: "destructive" });
      return;
    }
    setBusy(true);
    let result;
    try {
      result = hireFromSeat(companyId, {
        name,
        email,
        nationalId,
        phone,
        hireDate,
        contractType,
        contractEndDate: contractType === "fixed" ? contractEndDate : "",
        draft,
        seatId: creating ? "" : chosenSeatId,
        ar,
        reportsToId: "",
        managedStationIds: extraStationIds,
        profile: {
          ...profile,
          nationalId,
          phone,
          hireDate,
          contractType,
          contractEndDate: contractType === "fixed" ? contractEndDate : "",
          workPattern: profile.workPattern || "ordinary",
          probation: contractType === "trial",
          probationDays: profile.probationDays,
        },
        newSeat: creating
          ? {
              title: newSeat.title.trim(),
              stationId: seatHomeId,
              listId: newSeat.listId || resolvedListId,
              list: listName,
              gradeId: newSeat.gradeId,
            }
          : null,
      });
    } catch (error) {
      setBusy(false);
      toast({ description: error?.message || (ar ? "تعذّر الحفظ." : "Could not save."), variant: "destructive" });
      return;
    }
    if (!result?.ok) {
      setBusy(false);
      const map = {
        NAME: ar ? "الاسم مطلوب." : "Name is required.",
        SEAT: ar ? "اختر منصبًا." : "Pick a seat.",
        SEAT_TAKEN: ar ? "هذا المنصب لم يعد شاغرًا." : "That seat is no longer vacant.",
        SEAT_FIELDS: ar ? "أكمل الفرع والقائمة واسم المنصب." : "Finish the branch, list, and job title.",
        NO_GRADES: ar ? "لا درجات على هذه القائمة — اختر قائمة أخرى أو أضف درجة من قوائم الفروع." : "This list has no grades — pick another list or add a grade on branch lists.",
        GRADE_LIST: ar ? "اختر درجة من سلّم هذه القائمة." : "Pick a grade from this list’s ladder.",
        ADMIN_NO_HIRE: ar ? ADMIN_HIRE.ar : ADMIN_HIRE.en,
        MANAGER_TAKEN: ar ? "هذا الفرع له مدير. لا يُضاف مدير فرع ثانٍ." : "This branch already has a manager. A second branch manager cannot be added.",
        LIMIT: ar ? "بلغت حد الفروع في الخطة." : "The plan’s branch limit was reached.",
        CONTRACT_END: ar ? "العقد محدد المدة يحتاج تاريخ نهاية (المادة 55)." : "A fixed-term contract needs an end date (Article 55).",
        CONTRACT_EXPIRED: ar ? "لا يُعيَّن بعقد محدد المدة منتهٍ." : "A hire cannot use an expired fixed-term contract.",
        CONTRACT_NONSAUDI_FIXED: ar ? "عقد غير السعودي مكتوب ومحدد المدة (المادة 37)." : "A non-Saudi contract must be written and fixed-term (Article 37).",
        PROBATION_TERM_REQUIRED: ar ? "فترة التجربة تُذكر بعدد الأيام (المادة 53)." : "Probation must be stated in days (Article 53).",
        PROBATION_OVER_MAX: ar ? "فترة التجربة لا تتجاوز 180 يوماً (المادة 53)." : "Probation may not exceed 180 days (Article 53).",
        PROBATION_REPEAT: ar ? "لا تجوز التجربة مرة ثانية لدى هذه المنشأة إلا في مهنة أخرى أو بعد انقطاع ستة أشهر (المادة 54)." : "Probation may not be repeated here except in another occupation or after a six-month break (Article 54).",
      };
      toast({ description: map[result?.error] || (ar ? `تعذّر الحفظ (${result?.error || "unknown"}).` : `Could not save (${result?.error || "unknown"}).`), variant: "destructive" });
      return;
    }
    if (makeManager && !hasManager && seatHomeId && result.employeeId) {
      setStationManager(companyId, seatHomeId, result.employeeId);
    }
    if (email && password && result.employeeId) {
      const saved = await setEmployeePassword(companyId, result.employeeId, email, password);
      if (!saved) {
        toast({ description: ar ? "عُيّن الموظف، لكن كلمة المرور لم تُحفظ. عيّنها من ملفه." : "Employee hired, but the password was not saved. Set it from their file.", variant: "destructive" });
      }
    }
    setBusy(false);
    const notes = [];
    if (result.warnings?.includes("SALARY_RANGE")) notes.push(ar ? "الراتب خارج النطاق — حُفظ مع توثيق." : "Salary outside range — saved with a note.");
    if (result.warnings?.includes("DOCS")) notes.push(ar ? "الوثائق الناقصة أُدرجت في تقويم الامتثال." : "Missing documents were queued on the compliance calendar.");
    if (makeManager) notes.push(ar ? "عُيّن مديرًا لهذا الفرع." : "Appointed manager of this branch.");
    if (email && password) notes.push(ar ? "كلمة المرور جاهزة للدخول." : "Password is ready for sign-in.");
    if (result.draft) {
      const url = inviteUrl(result.employeeId, result.inviteToken);
      if (url && navigator.clipboard?.writeText) navigator.clipboard.writeText(url).catch(() => {});
      notes.push(ar ? "مسوّدة: أكمل الموظف الملف من رابط الدعوة." : "Draft: the employee completes the file from the invite link.");
    }
    toast({
      description: [
        result.draft
          ? (ar ? `مسوّدة «${name}»` : `Draft “${name}”`)
          : (ar ? `عُيّن ${name}` : `${name} hired`),
        ...notes,
      ].join(" · "),
    });
    const nextCount = added + 1;
    setAdded(nextCount);
    if (mode === "another") {
      const keepListId = creating ? newSeat.listId : (activeSeat?.listId || "");
      const keepGradeId = creating ? newSeat.gradeId : (activeSeat?.gradeId || "");
      setPerson({ ...emptyPerson(), hireDate });
      setProfile({ ...emptyProfile(), hireDate, contractType: profile.contractType });
      setChosenSeatId("");
      setCreating(true);
      setNewSeat({
        title: "",
        listId: keepListId,
        gradeId: keepGradeId,
        stationId: seatHomeId,
      });
      setExtraStationIds([]);
      setMakeManager(false);
      setStep(1);
      return;
    }
    onClose?.();
  };

  const goNext = () => {
    if (step === 1) {
      if (!placementReady()) {
        toast({ description: ar ? "أكمل الفرع والقائمة والمنصب والدرجة." : "Finish the branch, list, title, and grade.", variant: "destructive" });
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!String(person.name || "").trim()) {
        toast({ description: ar ? "الاسم مطلوب." : "Name is required.", variant: "destructive" });
        return;
      }
      const identity = checkSaudiIdentityGate(profile);
      if (!identity.ok) {
        toast({ description: ar ? identity.reason : identity.reasonEn, variant: "destructive" });
        return;
      }
      const hireType = hireContractId(profile.contractType || person.contractType);
      const termGate = checkContractTermGate({
        contractType: hireType === "fixed" ? "fixed" : "indefinite",
        contractEndDate: hireType === "fixed" ? String(profile.contractEndDate || person.contractEndDate || "") : "",
        hireDate: String(profile.hireDate || person.hireDate || todayKey()).slice(0, 10),
        nationality: profile.nationality || person.nationality,
        nationalId: profile.nationalId || person.nationalId,
      });
      if (!termGate.ok) {
        toast({ description: ar ? termGate.reason : termGate.reasonEn, variant: "destructive" });
        return;
      }
      setStep(3);
      return;
    }
    save("done");
  };

  const toggleExtra = (id) => {
    setExtraStationIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const chevron = ar ? <ChevronLeft style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />;
  const stepLabel = (n) => {
    if (n === 1) return ar ? "1 — المكان" : "1 — Place";
    if (n === 2) return ar ? "2 — الملف" : "2 — File";
    return ar ? "3 — الدخول" : "3 — Sign-in";
  };

  const renderProfileField = (item) => {
    if (SKIP_PROFILE_KEYS.has(item.key)) return null;
    if (item.key === "nationalId") {
      return (
        <Field key={item.key} label={profileFieldLabel(item, profile.idType, ar)}>
          <input
            value={profile.nationalId}
            onChange={(e) => setProfileField("nationalId", e.target.value.replace(/\D/g, "").slice(0, 10))}
            inputMode="numeric"
            dir="ltr"
            placeholder="1XXXXXXXXX"
            style={field}
          />
        </Field>
      );
    }
    if (item.key === "contractType") {
      const hireType = hireContractId(profile.contractType || person.contractType);
      const nonSaudi = nationalityIsSaudi(profile.nationality) === false;
      const typeChoices = nonSaudi
        ? CONTRACT_TYPES.filter((row) => row.id === "fixed" || row.id === "trial")
        : CONTRACT_TYPES;
      const typeRuleId = nonSaudi
        ? "contract.nonSaudi.fixed.cite"
        : hireType === "fixed"
          ? "contract.fixed.cite"
          : hireType === "trial"
            ? null
            : "contract.indefinite.cite";
      return (
        <div key={item.key} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Field label={ar ? item.ar : item.en}>
            <select
              value={nonSaudi && hireType === "indefinite" ? "fixed" : hireType}
              onChange={(e) => {
                const next = e.target.value;
                setProfile((current) => ({
                  ...current,
                  contractType: next,
                  contractEndDate: next === "indefinite" ? "" : (current.contractEndDate || ""),
                }));
                setPerson((current) => ({
                  ...current,
                  contractType: next,
                  contractEndDate: next === "indefinite" ? "" : (current.contractEndDate || ""),
                }));
              }}
              style={{ ...field, appearance: "auto" }}
            >
              {typeChoices.map((row) => (
                <option key={row.id} value={row.id}>{ar ? row.ar : row.en}</option>
              ))}
            </select>
          </Field>
          {hireType !== "indefinite" || nonSaudi ? (
            <Field label={ar ? "تاريخ نهاية العقد" : "Contract end date"}>
              <PlatformDateField
                ar={ar}
                value={profile.contractEndDate || person.contractEndDate || ""}
                min={profile.hireDate || person.hireDate || undefined}
                onChange={(next) => {
                  setProfileField("contractEndDate", next);
                  setPerson((current) => ({ ...current, contractEndDate: next }));
                }}
              />
            </Field>
          ) : null}
          {nonSaudi ? (
            <p style={{ margin: 0, fontSize: 11, color: MUTED, lineHeight: 1.65 }}>
              {ar
                ? "إن تُرك تاريخ النهاية فارغاً تُعد المدة سنة من تاريخ المباشرة وتتجدد لمثلها."
                : "If the end date is left blank the term is deemed one year from the start date and renews for a like period."}
            </p>
          ) : null}
          {hireType === "trial" ? (
            <>
            <Field label={ar ? "أيام التجربة (حد 180)" : "Probation days (max 180)"}>
              <input
                type="number"
                min={1}
                max={180}
                value={profile.probationDays || ""}
                onChange={(e) => setProfileField("probationDays", e.target.value)}
                style={field}
              />
            </Field>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: MUTED, lineHeight: 1.65 }}>
              <input
                type="checkbox"
                checked={Boolean(profile.probationPriorAtEmployer)}
                onChange={(e) => setProfileField("probationPriorAtEmployer", e.target.checked)}
              />
              <span>{ar ? "سبق أن خضع للتجربة لدى هذه المنشأة" : "Previously on probation with this employer"}</span>
            </label>
            {profile.probationPriorAtEmployer ? (
              <>
                <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: MUTED, lineHeight: 1.65 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(profile.probationOtherProfession)}
                    onChange={(e) => setProfileField("probationOtherProfession", e.target.checked)}
                  />
                  <span>{ar ? "التجربة الجديدة في مهنة أو عمل آخر" : "The new probation is in another occupation or job"}</span>
                </label>
                <Field label={ar ? "أشهر الانقطاع عن المنشأة" : "Months away from this employer"}>
                  <input
                    type="number"
                    min={0}
                    value={profile.probationRehireGapMonths || ""}
                    onChange={(e) => setProfileField("probationRehireGapMonths", e.target.value)}
                    style={field}
                  />
                </Field>
              </>
            ) : null}
            <LaborArticleCite ruleId="contract.probation.once.cite" ar={ar} showText />
            <LaborArticleCite ruleId="contract.probation.excludeOfficialHolidays.cite" ar={ar} showText />
            </>
          ) : null}
          {typeRuleId ? <LaborArticleCite ruleId={typeRuleId} ar={ar} showText /> : (
            <p style={{ margin: 0, fontSize: 11, color: MUTED, lineHeight: 1.65 }}>
              {ar
                ? "فترة التجربة طبقة على العقد وليست نوعاً ثالثاً. غير السعودي يبقى محدد المدة (المادة 37)."
                : "Probation is an overlay, not a third contract type. A non-Saudi file stays fixed-term (Article 37)."}
            </p>
          )}
          {typeRuleId === "contract.fixed.cite" ? <LaborArticleCite ruleId="contract.fixed.continuation.cite" ar={ar} showText /> : null}
        </div>
      );
    }
    const options = profileFieldOptions(item);
    if (options) {
      return (
        <Field key={item.key} label={profileFieldLabel(item, profile.idType, ar)}>
          <select
            value={profile[item.key] || ""}
            onChange={(e) => setProfileField(item.key, e.target.value)}
            style={{ ...field, appearance: "auto" }}
          >
            <option value="">{ar ? "اختر" : "Choose"}</option>
            {options.map((row) => (
              <option key={row.value} value={row.value}>{ar ? row.ar : row.en}</option>
            ))}
          </select>
        </Field>
      );
    }
    if (item.area) {
      return (
        <Field key={item.key} label={profileFieldLabel(item, profile.idType, ar)}>
          <textarea value={profile[item.key] || ""} onChange={(e) => setProfileField(item.key, e.target.value)} style={{ ...field, height: 72, padding: "8px 10px" }} />
        </Field>
      );
    }
    return (
      <Field key={item.key} label={profileFieldLabel(item, profile.idType, ar)}>
        {item.type === "date" ? (
          <PlatformDateField
            ar={ar}
            value={profile[item.key] || ""}
            onChange={(next) => setProfileField(item.key, next)}
          />
        ) : (
          <input
            type="text"
            dir={item.dir || undefined}
            value={profile[item.key] || ""}
            onChange={(e) => setProfileField(item.key, e.target.value)}
            style={field}
          />
        )}
      </Field>
    );
  };

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        display: "flex",
        justifyContent: ar ? "flex-start" : "flex-end",
        background: "rgba(20,40,75,.38)",
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <aside
        dir={ar ? "rtl" : "ltr"}
        style={{
          width: 460,
          maxWidth: "100vw",
          height: "100%",
          background: CARD,
          borderInlineStart: `1px solid ${BORDER}`,
          boxShadow: "-18px 0 40px rgba(20,40,75,.12)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div aria-hidden style={{ height: 3, background: NAVY_FILL, flexShrink: 0 }} />
        <header style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "14px 16px 12px", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 10, letterSpacing: "0.14em", fontWeight: 600, color: MUTED }}>
              {ar ? "إغلاق السلسلة" : "Close the chain"}
            </p>
            <h2 style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 600, color: INK }}>
              {stationName ? (ar ? `أضف موظفًا على «${stationName}»` : `Add employee on “${stationName}”`) : (ar ? "أضف موظفًا" : "Add employee")}
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: MUTED, lineHeight: 1.55 }}>
              {ar ? "فرع + حزمة صلاحية. ثم يُملأ الملف. الناس يُشتقّون بعد الحفظ." : "Workplace + access pack. Then the file is filled. People are derived after save."}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label={ar ? "إغلاق" : "Close"} style={{ ...ui.btnGhost, padding: 8 }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </header>

        <div style={{ display: "flex", gap: 6, padding: "10px 16px", borderBottom: `1px solid ${BORDER}`, background: SURFACE }}>
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setStep(n)}
              style={{
                flex: 1,
                height: 32,
                borderRadius: 9,
                border: `1px solid ${step === n ? BORDER : "transparent"}`,
                background: step === n ? CARD : "transparent",
                color: step === n ? INK : MUTED,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {stepLabel(n)}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {adminHome ? (
            <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.7 }}>
              {ar
                ? `«${stationName}» مدير وليس مكان توظيف. حوّله إلى فرع من الشجرة، ثم وظّف عليه.`
                : `“${stationName}” is a manager, not a hire workplace. Convert it to a branch on the tree, then hire there.`}
            </p>
          ) : !hasLists ? (
            <div style={{ padding: "12px 14px", borderRadius: 12, border: `1px solid ${BORDER}`, background: SURFACE, display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ margin: 0, fontSize: 13, color: NAVY, lineHeight: 1.7, fontWeight: 600 }}>
                {ar
                  ? "يجب إنشاء صلاحية أولاً حتى يوزّع موظف الموارد البشرية المناصب بسهولة."
                  : "Create an access pack first so HR can distribute titles."}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.65 }}>
                {ar
                  ? "القائمة تحمل المسمّيات والصلاحيات. بلا قائمة يبقى الفرع مكاناً فارغاً في الشجرة وقالب الإكسل."
                  : "The pack carries titles and access. Without it the branch stays an empty place on the tree and in the Excel template."}
              </p>
              <button
                type="button"
                onClick={() => { onClose?.(); onNeedAccess?.(); }}
                style={ui.btnPrimary}
              >
                {ar ? "إنشاء صلاحية" : "Create access"}
              </button>
            </div>
          ) : (
            <>
              {step === 1 && (
                <>
                  <div style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${BORDER}`, background: SURFACE }}>
                    <p style={{ margin: 0, fontSize: 12, color: NAVY, lineHeight: 1.65, fontWeight: 600 }}>
                      {ar
                        ? "قالب فارغ: عمود الفرع قائمة من فروع المنصة، تختار أين يوضع كل موظف. أو نزّل الملفات الحالية لمعرفة الناقص ثم طبّق على ملف الموظف."
                        : "Blank template: the branch column lists platform branches — pick where each person sits. Or download current files to see gaps, then apply to the employee file."}
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                      <button type="button" onClick={() => downloadHireTemplate(data, ar, { mode: "blank", focusStationId: stationId })} style={{ ...ui.btnGhost, height: 32 }}>
                        {ar ? "قالب فارغ" : "Blank template"}
                      </button>
                      <button type="button" onClick={() => downloadHireTemplate(data, ar, { mode: "files", focusStationId: stationId })} style={{ ...ui.btnGhost, height: 32 }}>
                        {ar ? "الملفات والنواقص" : "Files and gaps"}
                      </button>
                    </div>
                  </div>
                  {added >= HIRE_SESSION_SUGGEST_AT && (
                    <p style={{ margin: 0, fontSize: 11, color: MUTED, lineHeight: 1.55 }}>
                      {ar ? "القالب أسرع من الإضافة واحدًا تلو الآخر." : "The template is faster than adding one by one."}
                    </p>
                  )}
                  {lockedSeat && readout ? (
                    <p style={{ margin: 0, fontSize: 12, color: MUTED }}>{ar ? "المنصب مأخوذ من «عيّن»." : "Seat taken from Assign."}</p>
                  ) : creating ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {!stationId && (
                        <Field label={ar ? "الفرع" : "Branch"}>
                          <select
                            value={newSeat.stationId}
                            onChange={(e) => setNewSeat((current) => ({ ...current, stationId: e.target.value }))}
                            style={{ ...field, appearance: "auto" }}
                          >
                            <option value="">{ar ? "اختر فرعًا" : "Pick a branch"}</option>
                            {stations.map((station) => (
                              <option key={station.id} value={station.id}>{station.name}</option>
                            ))}
                          </select>
                        </Field>
                      )}
                      <Field label={ar ? "القائمة — الصلاحيات تتبعها" : "List — permissions follow it"}>
                        <select
                          value={newSeat.listId}
                          onChange={(e) => setNewSeat((current) => ({ ...current, listId: e.target.value, gradeId: "", title: "" }))}
                          style={{ ...field, appearance: "auto" }}
                        >
                          <option value="">{ar ? "اختر قائمة" : "Pick a list"}</option>
                          {packs.map((pack) => (
                            <option key={pack.id} value={pack.id}>{templateLabel(pack, ar)}</option>
                          ))}
                        </select>
                      </Field>
                      {listKey && !listGrades.length ? (
                        <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
                          {ar
                            ? "لا درجات على هذه القائمة. صاحب الشركة يضعها من قوائم الفروع."
                            : "This list has no grades. The company owner adds them on branch lists."}
                        </p>
                      ) : listKey ? (
                        <Field label={ar ? "الدرجة — نطاق الأجر" : "Grade — pay range"}>
                          <select
                            value={newSeat.gradeId}
                            onChange={(e) => setNewSeat((current) => ({ ...current, gradeId: e.target.value }))}
                            style={{ ...field, appearance: "auto" }}
                          >
                            <option value="">{ar ? "اختر درجة من هذه القائمة" : "Pick a grade from this list"}</option>
                            {listGrades.map((grade) => (
                              <option key={grade.id} value={grade.id}>{grade.title || jobGradeLabel(grade)}</option>
                            ))}
                          </select>
                        </Field>
                      ) : null}
                      {(listGrades.length > 0 || newSeat.gradeId || !listKey) && (
                        <Field label={ar ? "المنصب من القائمة" : "Title from the list"}>
                          {catalogTitles.length ? (
                            <select
                              value={newSeat.title}
                              onChange={(e) => setNewSeat((current) => ({ ...current, title: e.target.value }))}
                              style={{ ...field, appearance: "auto" }}
                            >
                              <option value="">{ar ? "اختر منصبًا من القائمة" : "Pick a title from the list"}</option>
                              {catalogTitles.map((item) => (
                                <option key={item.id} value={item.title}>{item.title}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              value={newSeat.title}
                              onChange={(e) => setNewSeat((current) => ({ ...current, title: e.target.value }))}
                              placeholder={ar ? "أضف المناصب في قائمة المنشأة أولًا، أو اكتب مسمّى" : "Add titles on the company list first, or type one"}
                              style={field}
                            />
                          )}
                        </Field>
                      )}
                    </div>
                  ) : (
                    <>
                      {openSeats.length > 0 ? (
                        <Field label={ar ? "المنصب الشاغر" : "Vacant seat"}>
                          <select
                            value={chosenSeatId}
                            onChange={(e) => setChosenSeatId(e.target.value)}
                            style={{ ...field, appearance: "auto" }}
                          >
                            <option value="">{ar ? "اختر منصبًا" : "Pick a seat"}</option>
                            {openSeats.map((seat) => (
                              <option key={seat.id} value={seat.id}>
                                {seat.title}
                                {stationId ? "" : ` · ${stations.find((item) => item.id === seat.stationId)?.name || ""}`}
                              </option>
                            ))}
                          </select>
                        </Field>
                      ) : (
                        <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.55 }}>
                          {ar ? "لا منصب شاغر في هذه الوحدة." : "No vacant seat in this unit."}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => { setCreating(true); setChosenSeatId(""); }}
                        style={{ ...ui.btnSecondary, display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "start" }}
                      >
                        <Plus style={{ width: 14, height: 14 }} />
                        {ar ? "أنشئ منصبًا في هذه الوحدة" : "Create a seat in this unit"}
                      </button>
                    </>
                  )}

                  {readout && !creating && (
                    <div style={{ padding: 12, borderRadius: 12, border: `1px solid ${BORDER}`, background: SURFACE, display: "flex", flexDirection: "column", gap: 8 }}>
                      <ReadRow label={ar ? "الفرع" : "Branch"} value={readout.branch} />
                      <ReadRow label={ar ? "القائمة" : "List"} value={readout.list} />
                      <ReadRow label={ar ? "الدرجة" : "Grade"} value={readout.grade} />
                      <ReadRow label={ar ? "نطاق الراتب" : "Salary range"} value={formatSalaryRange(readout.salaryMin, readout.salaryMax, ar)} />
                      <ReadRow label={ar ? "رصيد الإجازة" : "Leave balance"} value={ar ? `${leaveDays} يومًا من تاريخ التعيين` : `${leaveDays} days from hire date`} />
                    </div>
                  )}

                  {hasManager ? (
                    <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
                      {ar
                        ? "هذا الفرع له مدير. خيار مدير الفرع لا يظهر حتى يُزال المدير من الشجرة."
                        : "This branch already has a manager. The branch-manager option stays hidden until that manager is cleared on the tree."}
                    </p>
                  ) : (
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: INK, cursor: "pointer" }}>
                      <input type="checkbox" checked={makeManager} onChange={(e) => setMakeManager(e.target.checked)} />
                      {ar ? "اجعله مدير هذا الفرع" : "Make them manager of this branch"}
                    </label>
                  )}

                  {homeId && extraStations.length > 0 && (
                    <div>
                      <span style={labelMuted}>{ar ? "فروع إضافية (اختياري)" : "Extra branches (optional)"}</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                        {extraStations.map((station) => (
                          <label key={station.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: INK, cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={extraStationIds.includes(station.id)}
                              onChange={() => toggleExtra(station.id)}
                            />
                            {station.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {step === 2 && (
                <>
                  <Field label={ar ? "الاسم" : "Name"}>
                    <input value={person.name} onChange={(e) => setField("name", e.target.value)} autoFocus style={field} />
                  </Field>
                  <Field label={ar ? "الجوال" : "Mobile"}>
                    <input value={person.phone} onChange={(e) => { setField("phone", e.target.value); setProfileField("phone", e.target.value); }} inputMode="tel" dir="ltr" style={field} />
                  </Field>
                  {PROFILE_GROUPS.map((group) => {
                    const visible = group.fields.filter((item) => {
                      if (SKIP_PROFILE_KEYS.has(item.key)) return false;
                      if (item.forIqama) return isProfileFieldVisible(item, { profile, form: profile, editing: true });
                      return true;
                    });
                    if (!visible.length) return null;
                    const identityGate = group.id === "identity" ? checkSaudiIdentityGate(profile) : null;
                    return (
                      <fieldset
                        key={group.id}
                        style={{ margin: 0, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: 10 }}
                      >
                        <legend style={{ fontSize: 12, fontWeight: 600, padding: "0 6px" }}>{ar ? group.ar : group.en}</legend>
                        {identityGate?.error === "SAUDI_IDENTITY_MISMATCH" ? (
                          <p style={{ margin: 0, fontSize: 11, color: "#B91C1C", lineHeight: 1.55 }}>
                            {ar ? identityGate.reason : identityGate.reasonEn}
                          </p>
                        ) : null}
                        {visible.map((item) => renderProfileField(item))}
                      </fieldset>
                    );
                  })}
                </>
              )}

              {step === 3 && (
                <>
                  <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.65 }}>
                    {ar ? "اختياري. إن وُضع بريد وكلمة مرور يُنشأ دخول الموظف بعد الحفظ." : "Optional. Email and password create sign-in after save."}
                  </p>
                  <Field label={ar ? "البريد" : "Email"}>
                    <input value={person.email} onChange={(e) => setField("email", e.target.value)} dir="ltr" type="email" style={field} />
                  </Field>
                  <Field label={ar ? "كلمة المرور" : "Password"}>
                    <input value={person.password} onChange={(e) => setField("password", e.target.value)} type="password" style={field} />
                  </Field>
                </>
              )}
            </>
          )}
        </div>

        <footer style={{ padding: 12, borderTop: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 8, background: CARD }}>
          {adminHome ? (
            <button type="button" onClick={onClose} style={{ ...ui.btnPrimary, width: "100%" }}>
              {ar ? "حسنًا" : "OK"}
            </button>
          ) : !hasLists ? (
            <button
              type="button"
              onClick={() => { onClose?.(); onNeedAccess?.(); }}
              style={{ ...ui.btnPrimary, width: "100%" }}
            >
              {ar ? "إنشاء صلاحية" : "Create access"}
            </button>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: 11, color: MUTED, lineHeight: 1.5 }}>
                {ar
                  ? "التحذيرات لا تمنع الحفظ. الوثائق الناقصة تذهب للامتثال."
                  : "Warnings do not block save. Missing documents go to compliance."}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {step > 1 ? (
                  <button type="button" onClick={() => setStep(step - 1)} style={{ ...ui.btnGhost, flex: "0 0 auto" }}>
                    {ar ? "رجوع" : "Back"}
                  </button>
                ) : null}
                <button type="button" disabled={busy} onClick={() => save("draft")} style={{ ...ui.btnGhost, flex: "1 1 100px" }}>
                  {ar ? "مسوّدة" : "Draft"}
                </button>
                {step < 3 ? (
                  <button type="button" onClick={goNext} style={{ ...ui.btnPrimary, flex: "1 1 140px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    {step === 1 ? (ar ? "الملف" : "File") : (ar ? "الدخول" : "Sign-in")} {chevron}
                  </button>
                ) : (
                  <>
                    <button type="button" disabled={busy} onClick={() => save("another")} style={{ ...ui.btnSecondary, flex: "1 1 140px" }}>
                      {ar ? "حفظ وأضف آخر" : "Save & add another"}
                    </button>
                    <button type="button" disabled={busy} onClick={() => save("done")} style={{ ...ui.btnPrimary, flex: "1 1 100px" }}>
                      {ar ? "حفظ" : "Save"}
                    </button>
                  </>
                )}
              </div>
              {step === 2 ? (
                <button type="button" disabled={busy} onClick={() => save("done")} style={{ ...ui.btnGhost, alignSelf: "start" }}>
                  {ar ? "حفظ دون دخول" : "Save without sign-in"}
                </button>
              ) : null}
              <Link to="/app/hr" onClick={onClose} style={{ fontSize: 11, color: MUTED, textDecoration: "none" }}>
                {ar ? "تقويم الامتثال في الموارد البشرية" : "Compliance calendar in HR"}
              </Link>
            </>
          )}
        </footer>
      </aside>
    </div>,
    document.body,
  );
}
