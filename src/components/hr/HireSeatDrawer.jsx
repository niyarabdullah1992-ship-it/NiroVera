import ContractLeaveFields from "@/components/hr/ContractLeaveFields";
import { applyContractLeave } from "@/lib/contractLeave";
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Briefcase, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { appendEmployeeFileLog, setEmployeePassword, setStationManager } from "@/lib/store";
import {
  annualLeaveFromHireDate,
  CONTRACT_TYPES,
  formatSalaryRange,
  hireContractId,
  hireFromSeat,
  assignBranchHrManager,
  placeExistingEmployee,
  inviteUrl,
  isBranchManagerTitle,
  seatReadout,
  stationHasManager,
  todayKey,
  vacantSeats,
} from "@/lib/orgHire";
import { gradesForList, gradesForTitle, jobGradeLabel } from "@/lib/jobGrades";
import { BUILT_IN_TEMPLATES, companyLists, listPositions, templateLabel } from "@/lib/permissionTemplates";
import {
  PROFILE_GROUPS,
  isProfileFieldVisible,
  profileCompletionStats,
  profileFieldLabel,
  profileFieldOptions,
} from "@/lib/employeeProfileFields";
import { checkSaudiIdentityGate, checkContractTermGate, nationalityIsSaudi } from "@/lib/complianceDerivations";
import { checkProbationGate } from "@/lib/contractLawDerivations";
import { checkHiringAgeGate } from "@/lib/employerDuties";
import { BORDER, CARD, INK, MUTED, NAVY, SURFACE, field, labelMuted, ui } from "@/lib/platformStyles";
import { BRANCH_HR_TITLE } from "@/lib/hrTree";
import { isHrUnit, isManagerUnit, workplaceStations } from "@/lib/stationTree";
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

/** A numbered step block: «١ مكان العمل», «٢ المنصب», «٣ الصفة الإدارية». */
function Section({ n, title, hint, children }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span aria-hidden style={{ width: 24, height: 24, borderRadius: 999, background: "var(--nv-accent-soft, #EEF5F0)", border: "1px solid var(--nv-ok-line, #BFE6D2)", color: "var(--nv-ok-ink, #1F5A3D)", fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</span>
        <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          <strong style={{ fontSize: 13, color: INK }}>{title}</strong>
          {hint ? <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.5 }}>{hint}</span> : null}
        </span>
        <span aria-hidden style={{ flex: 1, height: 1, background: BORDER, marginInlineStart: 4 }} />
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelMuted}>{label}</span>
      {children}
    </label>
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
  hrBranchId = "",
  onClose,
  onNeedAccess: _onNeedAccess,
}) {
  const [step, setStep] = useState(1);
  const hrBranchName = hrBranchId ? ((data?.stations || []).find((item) => String(item.id) === String(hrBranchId))?.name || "") : "";
  const [person, setPerson] = useState(emptyPerson);
  const [profile, setProfile] = useState(emptyProfile);
  const [chosenSeatId, setChosenSeatId] = useState(seatId || "");
  const [creating, setCreating] = useState(false);
  const [newSeat, setNewSeat] = useState({ title: "", listId: "", gradeId: "", stationId: stationId || "" });
  const [added, setAdded] = useState(0);
  const [busy, setBusy] = useState(false);
  const [extraStationIds, setExtraStationIds] = useState([]);
  const [makeManager, setMakeManager] = useState(false);
  // «توظيف جديد» or «نقل موظف من المنشأة» into the chosen seat
  const [source, setSource] = useState("new");
  const [existingId, setExistingId] = useState("");
  const [leaveTerms, setLeaveTerms] = useState({ annual: 21, restCount: 1, restDows: [5] });

  const packs = useMemo(() => companyLists(data), [data]);
  // company lists first, then the ready templates — hiring never waits for a list to be built
  const accessOptions = useMemo(() => [...packs, ...BUILT_IN_TEMPLATES.filter((tpl) => !packs.some((p) => p.id === tpl.id))], [packs]);
  const [accessId, setAccessId] = useState("");
  const resolvedListId = useMemo(() => {
    if (listId) return listId;
    if (!listName) return "";
    const pack = packs.find((item) => item.id === listName || item.ar === listName || item.en === listName || templateLabel(item, true) === listName);
    return pack?.id || "";
  }, [listId, listName, packs]);
  const pickStationId = stationId || newSeat.stationId || "";
  const vacancies = useMemo(
    () => vacantSeats(data, pickStationId || undefined, resolvedListId || listName || undefined),
    [data, pickStationId, resolvedListId, listName],
  );
  const allVacancies = useMemo(() => vacantSeats(data), [data]);
  const pool = pickStationId || resolvedListId || listName ? vacancies : allVacancies;
  const listKey = newSeat.listId || resolvedListId;
  const listGrades = useMemo(() => gradesForList(data, listKey), [data, listKey]);
  const titleGrades = useMemo(
    () => (String(newSeat.title || "").trim() ? gradesForTitle(data, newSeat.title) : []),
    [data, newSeat.title],
  );
  const offerGrades = titleGrades.length ? titleGrades : listGrades;
  const listPack = packs.find((pack) => pack.id === listKey);
  const stations = workplaceStations(data?.stations || []);
  const lockedSeat = Boolean(seatId);
  const freeBranchPick = !stationId && !lockedSeat;
  const activeSeat = (data?.orgSeats || []).find((item) => item.id === chosenSeatId) || null;
  const readout = seatReadout(activeSeat, data, ar);
  const leaveDays = annualLeaveFromHireDate(person.hireDate || profile.hireDate);
  const homeId = stationId || newSeat.stationId || activeSeat?.stationId || "";
  const homeStation = (data?.stations || []).find((item) => item.id === homeId);
  const hasManager = stationHasManager(homeStation);
  const currentManager = hasManager ? (data?.employees || []).find((item) => String(item.id) === String(homeStation?.managerId || "")) || null : null;
  const movable = useMemo(() => (data?.employees || [])
    .filter((item) => item?.name && item.role !== "system" && item.active !== false && item.profile?.employmentStatus !== "terminated")
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "ar")), [data?.employees]);
  const transferring = source === "existing";
  const catalogTitles = listPositions(listPack).filter((item) => !hasManager || !isBranchManagerTitle(item.title));
  const openSeats = pool
    .filter((seat) => !hasManager || !isBranchManagerTitle(seat.title))
    .filter((seat) => !pickStationId || String(seat.stationId) === String(pickStationId));
  const adminHome = Boolean(homeId && isManagerUnit(homeStation));
  const stationName = homeStation?.name || "";
  const extraStations = stations.filter((item) => item.id !== homeId);
  const hrHome = isHrUnit(homeStation);
  const hrPackId = packs.find((pack) => /موارد\s*(?:ال)?بشر/.test(`${pack.ar || ""} ${pack.name || ""}`))?.id || "";
  const accessDefault = hrBranchId ? (hrPackId || "hr_officer") : activeSeat?.listId || newSeat.listId || resolvedListId || packs[0]?.id || (hrHome ? "hr_officer" : "field");
  const accessValue = accessId || accessDefault;
  const hirePreview = useMemo(() => {
    const title = creating
      ? String(newSeat.title || "").trim()
      : String(activeSeat?.title || "").trim();
    const packId = creating ? (newSeat.listId || resolvedListId) : (activeSeat?.listId || resolvedListId);
    const pack = packs.find((item) => item.id === packId);
    return {
      name: person.name,
      profile: {
        ...profile,
        position: title || profile.position || "",
        department: pack ? templateLabel(pack, true) : (profile.department || ""),
        nationalId: profile.nationalId || person.nationalId || "",
        phone: profile.phone || person.phone || "",
        hireDate: profile.hireDate || person.hireDate || todayKey(),
        contractType: profile.contractType || person.contractType || "indefinite",
      },
    };
  }, [creating, newSeat.title, newSeat.listId, activeSeat, resolvedListId, packs, person, profile]);
  const completion = profileCompletionStats(hirePreview);

  useEffect(() => {
    if (!open) return;
    const packsNow = companyLists(data);
    const matching = vacantSeats(data, stationId || undefined, listId || listName || undefined);
    const intoHr = Boolean(hrBranchId) || isHrUnit((data?.stations || []).find((item) => String(item.id) === String(stationId || "")));
    const defaultList = (intoHr && packsNow.find((pack) => /موارد\s*(?:ال)?بشر/.test(`${pack.ar || ""} ${pack.name || ""}`))?.id)
      || listId
      || packsNow.find((item) => item.ar === listName || item.en === listName || templateLabel(item, true) === listName)?.id
      || (packsNow.length === 1 ? packsNow[0].id : "");
    const defaultGrades = gradesForList(data, defaultList);
    setStep(1);
    setPerson(emptyPerson());
    setProfile(emptyProfile());
    setChosenSeatId(seatId || "");
    // From files board: branch-first create. From tree (stationId/seatId): keep seat/vacancy flow.
    setCreating(Boolean(hrBranchId) || (!seatId && (!stationId || matching.length === 0)));
    setNewSeat({
      title: hrBranchId ? BRANCH_HR_TITLE : "",
      listId: defaultList,
      gradeId: (hrBranchId && defaultGrades.find((grade) => /مدير/.test(`${grade.title || ""} ${jobGradeLabel(grade)}`))?.id)
        || (defaultGrades.length === 1 ? defaultGrades[0].id : ""),
      stationId: stationId || "",
    });
    setExtraStationIds([]);
    setMakeManager(false);
    setSource("new");
    setExistingId("");
  }, [open, seatId, stationId, listId, listName, hrBranchId]);

  // a branch HR manager takes the list's manager grade unless one was picked
  useEffect(() => {
    if (!open || !hrBranchId || newSeat.gradeId || !offerGrades.length) return;
    const pick = offerGrades.find((grade) => /مدير/.test(`${grade.title || ""} ${jobGradeLabel(grade)}`)) || (offerGrades.length === 1 ? offerGrades[0] : null);
    if (pick) setNewSeat((current) => (current.gradeId ? current : { ...current, gradeId: pick.id }));
  }, [open, hrBranchId, newSeat.gradeId, offerGrades]);

  useEffect(() => {
    if (!open || creating || lockedSeat || !chosenSeatId) return;
    const seat = (data?.orgSeats || []).find((item) => item.id === chosenSeatId);
    if (!seat) return;
    if (pickStationId && String(seat.stationId) !== String(pickStationId)) {
      setChosenSeatId("");
    }
  }, [open, creating, lockedSeat, chosenSeatId, pickStationId, data?.orgSeats]);

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
    if (listGrades.length && !newSeat.gradeId && !titleGrades.length) return false;
    if (titleGrades.length && !newSeat.gradeId) return false;
    if (creating && hasManager && isBranchManagerTitle(newSeat.title)) return false;
    return true;
  };

  const save = async (mode) => {
    const draft = mode === "draft";
    const requireComplete = mode === "complete" || mode === "complete-another";
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
    if (requireComplete && !completion.done) {
      const gaps = completion.missing.slice(0, 4).map((item) => (ar ? item.ar : item.en)).join(" · ");
      toast({
        description: ar
          ? `أكمل الملف أولًا (${completion.pct}٪). ينقص: ${gaps || "حقول إلزامية"}.`
          : `Finish the file first (${completion.pct}%). Missing: ${gaps || "required fields"}.`,
        variant: "destructive",
      });
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
    const ageGate = checkHiringAgeGate({ birthDate: profile.birthDate, hireDate });
    if (!ageGate.ok) {
      toast({ description: ar ? ageGate.reason : ageGate.reasonEn, variant: "destructive" });
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
        listId: accessValue,
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
        GRADE_TITLE: ar ? "اختر درجة من سلّم هذا المسمّى." : "Pick a grade from this title’s ladder.",
        ADMIN_NO_HIRE: ar ? ADMIN_HIRE.ar : ADMIN_HIRE.en,
        MANAGER_TAKEN: ar ? "هذا الفرع له مدير. لا يُضاف مدير فرع ثانٍ." : "This branch already has a manager. A second branch manager cannot be added.",
        EMPLOYEE_NO_TAKEN: ar ? "الرقم الوظيفي مستخدم في هذه الشركة." : "That job number is already used in this company.",
        LIMIT: ar ? "بلغت حد الفروع في الخطة." : "The plan’s branch limit was reached.",
        CONTRACT_END: ar ? "العقد محدد المدة يحتاج تاريخ نهاية (المادة 55)." : "A fixed-term contract needs an end date (Article 55).",
        CONTRACT_EXPIRED: ar ? "لا يُعيَّن بعقد محدد المدة منتهٍ." : "A hire cannot use an expired fixed-term contract.",
        CONTRACT_NONSAUDI_FIXED: ar ? "عقد غير السعودي مكتوب ومحدد المدة (المادة 37)." : "A non-Saudi contract must be written and fixed-term (Article 37).",
        PROBATION_TERM_REQUIRED: ar ? "فترة التجربة تُذكر بعدد الأيام (المادة 53)." : "Probation must be stated in days (Article 53).",
        PROBATION_OVER_MAX: ar ? "فترة التجربة لا تتجاوز 180 يوماً (المادة 53)." : "Probation may not exceed 180 days (Article 53).",
        PROBATION_REPEAT: ar ? "لا تجوز التجربة مرة ثانية لدى هذه المنشأة إلا في مهنة أخرى أو بعد انقطاع ستة أشهر (المادة 54)." : "Probation may not be repeated here except in another occupation or after a six-month break (Article 54).",
        PROBATION_SECOND_WRITTEN: ar ? "التجربة الثانية لدى المنشأة نفسها باتفاق مكتوب يُرفق بالملف (المادة 54)." : "A second probation needs a written agreement on file (Article 54).",
        PROBATION_SPLIT_GAP: ar ? "مدد التجربة المقسّمة متصلة لا فاصل بينها (اللائحة م19/1)." : "Split probation periods must be contiguous (Regs Art. 19(1)).",
        PROBATION_SPLIT_UNSTATED: ar ? "تقسيم التجربة يُنص عليه عند إبرام العقد (اللائحة م19/1)." : "A probation split is stated at signing (Regs Art. 19(1)).",
        HIRE_UNDER_MIN_AGE: ar ? "لا يجوز تشغيل من لم يتم خمس عشرة سنة (المادة 162)." : "No one under fifteen may be employed (Article 162).",
      };
      toast({ description: map[result?.error] || (ar ? `تعذّر الحفظ (${result?.error || "unknown"}).` : `Could not save (${result?.error || "unknown"}).`), variant: "destructive" });
      return;
    }
    if (result.employeeId) applyContractLeave(companyId, result.employeeId, leaveTerms);
    const hrBranch = hrBranchId ? (data?.stations || []).find((item) => String(item.id) === String(hrBranchId)) : null;
    if (hrBranch && result.employeeId) {
      const linked = assignBranchHrManager(companyId, hrBranch.id, result.employeeId);
      if (!linked.ok) toast({ description: ar ? "وُظّف، لكن لم يُربط بالفرع. اربطه من بطاقة وحدة الموارد البشرية." : "Hired, but not linked to the branch.", variant: "destructive" });
    }
    if (makeManager && seatHomeId && result.employeeId) {
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
    if (hrBranch) notes.push(ar ? `عُيّن مدير الموارد البشرية لـ${hrBranch.name}.` : `Set as HR manager for ${hrBranch.name}.`);
    if (email && password) notes.push(ar ? "كلمة المرور جاهزة للدخول." : "Password is ready for sign-in.");
    if (result.draft) {
      const url = inviteUrl(result.employeeId, result.inviteToken);
      if (url && navigator.clipboard?.writeText) navigator.clipboard.writeText(url).catch(() => {});
      notes.push(ar ? "مسوّدة: أكمل الموظف الملف من رابط الدعوة." : "Draft: the employee completes the file from the invite link.");
    } else if (requireComplete || completion.done) {
      notes.push(ar ? "ملف مكتمل." : "Complete file.");
    } else if (completion.missing.length) {
      notes.push(ar ? `اكتمال الملف ${completion.pct}٪ — يمكن إكماله لاحقًا.` : `File ${completion.pct}% complete — can finish later.`);
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
    if (mode === "another" || mode === "complete-another") {
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

  const transfer = () => {
    const mover = movable.find((item) => String(item.id) === String(existingId));
    if (!mover) {
      toast({ description: ar ? "اختر الموظف المنقول." : "Pick the employee to move.", variant: "destructive" });
      return;
    }
    if (!placementReady()) {
      toast({ description: ar ? "أكمل الفرع والقائمة والمنصب والدرجة." : "Finish the branch, list, title, and grade.", variant: "destructive" });
      return;
    }
    if (!chosenSeatId && !creating) {
      toast({ description: ar ? "اختر منصبًا شاغرًا أو أنشئ واحدًا." : "Pick a vacant seat or create one.", variant: "destructive" });
      return;
    }
    const seatHomeId = stationId || newSeat.stationId;
    setBusy(true);
    const result = placeExistingEmployee(companyId, mover.id, {
      name: mover.name,
      hireDate: mover.profile?.hireDate,
      seatId: creating ? "" : chosenSeatId,
      listId: accessValue,
      ar,
      reportsTo: "",
      reportsToId: "",
      managedStationIds: extraStationIds,
      newSeat: creating
        ? { title: newSeat.title.trim(), stationId: seatHomeId, listId: newSeat.listId || resolvedListId, list: listName, gradeId: newSeat.gradeId }
        : null,
    });
    if (!result?.ok) {
      setBusy(false);
      const map = {
        SEAT: ar ? "اختر منصبًا." : "Pick a seat.",
        SEAT_TAKEN: ar ? "هذا المنصب لم يعد شاغرًا." : "That seat is no longer vacant.",
        SEAT_FIELDS: ar ? "أكمل الفرع والقائمة واسم المنصب." : "Finish the branch, list, and job title.",
        MANAGER_TAKEN: ar ? "هذا الفرع له مدير. فعّل «تغييره» أو اختر منصباً آخر." : "This branch already has a manager.",
        ADMIN_NO_HIRE: ar ? ADMIN_HIRE.ar : ADMIN_HIRE.en,
      };
      toast({ description: map[result?.error] || (ar ? `تعذّر النقل (${result?.error || "unknown"}).` : `Could not move (${result?.error || "unknown"}).`), variant: "destructive" });
      return;
    }
    if (makeManager && seatHomeId) setStationManager(companyId, seatHomeId, mover.id);
    {
      const fromSeat = (data?.orgSeats || []).find((row) => String(row.employeeId || "") === String(mover.id));
      const fromTitle = fromSeat?.title || mover.profile?.position || "";
      const fromPlace = (data?.stations || []).find((row) => String(row.id) === String(mover.stationId || ""))?.name || "";
      const toTitle = creating ? newSeat.title.trim() : (activeSeat?.title || "");
      const toPlace = (data?.stations || []).find((row) => String(row.id) === String(seatHomeId))?.name || stationName;
      appendEmployeeFileLog(companyId, mover.id, {
        text: ar ? `نقل إلى ${toTitle || "منصب"} — ${toPlace}` : `Moved to ${toTitle || "a seat"} — ${toPlace}`,
        kind: ar ? "المنصب" : "Seat",
        changes: [
          { label: ar ? "المنصب" : "Seat", from: fromTitle, to: toTitle },
          { label: ar ? "مكان العمل" : "Workplace", from: fromPlace, to: toPlace },
          ...(makeManager ? [{ label: ar ? "الصفة الإدارية" : "Role", from: "", to: hrHome ? (ar ? "مدير الموارد البشرية" : "HR director") : (ar ? `مدير ${toPlace}` : `Manager of ${toPlace}`) }] : []),
        ],
      });
    }
    const hrBranch = hrBranchId ? (data?.stations || []).find((item) => String(item.id) === String(hrBranchId)) : null;
    if (hrBranch) assignBranchHrManager(companyId, hrBranch.id, mover.id);
    setBusy(false);
    const notes = [ar ? `نُقل ${mover.name} إلى المنصب` : `${mover.name} moved to the seat`];
    if (makeManager) notes.push(hrHome ? (ar ? "وعُيّن مدير الموارد البشرية" : "and appointed HR director") : (ar ? `وعُيّن مدير ${stationName}` : `and appointed manager of ${stationName}`));
    if (hrBranch) notes.push(ar ? `ومدير الموارد البشرية لـ${hrBranch.name}` : `and HR manager for ${hrBranch.name}`);
    toast({ description: notes.join(" ") + "." });
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
          <ContractLeaveFields value={leaveTerms} onChange={setLeaveTerms} />
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
      className="nv-v7-portal"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 480,
        display: "flex",
        justifyContent: "flex-start",
        background: "color-mix(in oklab, var(--nv-navy) 26%, transparent)",
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <aside
        dir={ar ? "rtl" : "ltr"}
        style={{
          width: "min(94vw, 420px)",
          maxWidth: "100vw",
          height: "100%",
          background: "var(--nv-card, #fff)",
          borderInlineEnd: "1px solid var(--nv-line)",
          boxShadow: "0 18px 44px var(--nv-shadow)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "16px 18px", borderBottom: `1px solid ${BORDER}`, background: "var(--nv-hover)" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 10, letterSpacing: "0.14em", fontWeight: 600, color: MUTED }}>
              {ar ? "تعيين · سجلّ الموظفين" : "Hiring · Employee register"}
            </p>
            <h2 style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 600, color: INK }}>
              {hrBranchName
                ? (ar ? `تعيين مدير موارد بشرية لـ«${hrBranchName}»` : `Hire the HR manager for “${hrBranchName}”`)
                : stationName ? (ar ? `تعيين على «${stationName}»` : `Add employee on “${stationName}”`) : (ar ? "تعيين موظف" : "Assign an employee")}
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: MUTED, lineHeight: 1.55 }}>
              {transferring
                ? (ar ? "اختر الموظف من المنشأة والمنصب الذي يُنقل إليه. ملفه وبياناته تبقى كما هي، ويُسجَّل الإجراء باسمك." : "Pick the employee and the seat they move to. Their file stays as it is; the action is logged in your name.")
                : freeBranchPick
                ? (ar ? "حدّد مكان العمل والمنصب، ثم أكمل الملف وبيانات الدخول. يُسجَّل الإجراء باسمك." : "Set the workplace and seat, then complete the file and sign-in. The action is logged in your name.")
                : (ar ? "المنصب محدّد من الهيكل. أكمل الملف وبيانات الدخول؛ يُسجَّل الإجراء باسمك." : "The seat comes from the structure. Complete the file and sign-in; the action is logged in your name.")}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label={ar ? "إغلاق" : "Close"} style={{ ...ui.btnGhost, padding: 8 }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </header>

        <div style={{ display: "flex", gap: 6, padding: "10px 16px", borderBottom: `1px solid ${BORDER}`, background: SURFACE }}>
          {(transferring ? [1] : [1, 2, 3]).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setStep(n)}
              style={{
                flex: 1,
                height: 32,
                borderRadius: 8,
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
          ) : (
            <>
              {step === 1 && (
                <>
                  <div role="tablist" data-hire-source="1" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: 4, borderRadius: 12, background: "var(--nv-hover)", border: `1px solid ${BORDER}` }}>
                    {[["new", ar ? "توظيف جديد" : "New hire"], ["existing", ar ? "نقل موظف من المنشأة" : "Move someone in"]].map(([id, label]) => (
                      <button key={id} type="button" role="tab" aria-selected={source === id} onClick={() => setSource(id)} style={{ height: 36, borderRadius: 9, border: `1px solid ${source === id ? BORDER : "transparent"}`, background: source === id ? CARD : "transparent", color: source === id ? INK : MUTED, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {transferring ? (
                    <Section n="•" title={ar ? "الموظف" : "Employee"} hint={ar ? "موظف حالي في المنشأة يُنقل إلى المنصب المختار أدناه، ويبقى ملفه كما هو." : "A current employee moves to the seat chosen below; their file stays as it is."}>
                      <select aria-label={ar ? "الموظف المنقول" : "Employee to move"} value={existingId} onChange={(e) => setExistingId(e.target.value)} style={{ ...field, appearance: "auto" }}>
                        <option value="">{ar ? "اختر موظفاً من المنشأة" : "Pick an employee"}</option>
                        {movable.map((item) => {
                          const seat = (data?.orgSeats || []).find((row) => String(row.employeeId || "") === String(item.id));
                          const where = (data?.stations || []).find((row) => String(row.id) === String(item.stationId || ""))?.name || "";
                          const title = seat?.title || item.profile?.position || "";
                          return <option key={item.id} value={item.id}>{[item.name, [title, where].filter(Boolean).join(" · ")].filter(Boolean).join(" — ")}</option>;
                        })}
                      </select>
                    </Section>
                  ) : null}
                  {lockedSeat && readout ? null : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {freeBranchPick ? (
                        <>
                          <Section n={ar ? "١" : "1"} title={ar ? "مكان العمل" : "Workplace"} hint={ar ? "الفرع أو الوحدة التي سيعمل فيها." : "The branch or unit they will work in."}>
                            <select
                              aria-label={ar ? "الفرع أو الوحدة" : "Branch or unit"}
                              value={newSeat.stationId || (stations.some((item) => item.id === activeSeat?.stationId) ? activeSeat.stationId : "")}
                              onChange={(e) => {
                                const next = e.target.value;
                                setNewSeat((current) => ({ ...current, stationId: next }));
                                setChosenSeatId("");
                              }}
                              style={{ ...field, appearance: "auto" }}
                            >
                              <option value="">{ar ? "جميع الفروع" : "All branches"}</option>
                              {stations.map((station) => (
                                <option key={station.id} value={station.id}>{station.name}</option>
                              ))}
                            </select>
                          </Section>
                          <Section n={ar ? "٢" : "2"} title={ar ? "المنصب" : "Seat"} hint={ar ? "منصب شاغر قائم في الهيكل، أو منصب جديد يُنشأ الآن." : "An existing vacant seat, or a new one created now."}>
                          <div style={{ display: "inline-flex", gap: 2, padding: 3, borderRadius: 10, background: SURFACE, border: `1px solid ${BORDER}`, alignSelf: "start", flexWrap: "wrap" }}>
                            <button
                              type="button"
                              aria-pressed={creating}
                              onClick={() => { setCreating(true); setChosenSeatId(""); }}
                              style={{
                                height: 30,
                                padding: "0 12px",
                                borderRadius: 8,
                                border: 0,
                                background: creating ? CARD : "transparent",
                                color: creating ? INK : MUTED,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                                fontFamily: "inherit",
                                boxShadow: creating ? `inset 0 0 0 1px ${BORDER}` : "none",
                              }}
                            >
                              {ar ? "منصب جديد" : "New seat"}
                            </button>
                            <button
                              type="button"
                              aria-pressed={!creating}
                              onClick={() => setCreating(false)}
                              style={{
                                height: 30,
                                padding: "0 12px",
                                borderRadius: 8,
                                border: 0,
                                background: !creating ? CARD : "transparent",
                                color: !creating ? INK : MUTED,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                                fontFamily: "inherit",
                                boxShadow: !creating ? `inset 0 0 0 1px ${BORDER}` : "none",
                              }}
                            >
                              {ar ? "منصب شاغر قائم" : "Existing vacant seat"}
                            </button>
                          </div>
                          </Section>
                        </>
                      ) : null}

                      {creating ? (
                        <>
                          <Field label={ar ? "القائمة — الصلاحيات تتبعها" : "List — permissions follow it"}>
                            <select
                              value={newSeat.listId}
                              onChange={(e) => setNewSeat((current) => ({ ...current, listId: e.target.value, gradeId: "", title: "" }))}
                              style={{ ...field, appearance: "auto" }}
                            >
                              <option value="">{ar ? "اختر قائمة" : "Pick a list"}</option>
                              {accessOptions.map((pack) => (
                                <option key={pack.id} value={pack.id}>{templateLabel(pack, ar)}</option>
                              ))}
                            </select>
                          </Field>
                          <Field label={ar ? "المنصب من القائمة" : "Title from the list"}>
                            {catalogTitles.length ? (
                              <select
                                value={newSeat.title}
                                onChange={(e) => setNewSeat((current) => ({ ...current, title: e.target.value, gradeId: "" }))}
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
                                onChange={(e) => setNewSeat((current) => ({ ...current, title: e.target.value, gradeId: "" }))}
                                placeholder={ar ? "أضف المناصب في قائمة المنشأة أولًا، أو اكتب مسمّى" : "Add titles on the company list first, or type one"}
                                style={field}
                              />
                            )}
                          </Field>
                          {listKey && String(newSeat.title || "").trim() && !titleGrades.length && !listGrades.length ? (
                            <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
                              {ar
                                ? "هذا المسمّى بلا درجات. أضفها من سلّم الدرجات الوظيفية."
                                : "This title has no grades. Add them on the job-grade ladder."}
                            </p>
                          ) : listKey && offerGrades.length ? (
                            <Field label={ar ? "درجة هذا المسمّى" : "This title’s grade"}>
                              <select
                                value={newSeat.gradeId}
                                onChange={(e) => setNewSeat((current) => ({ ...current, gradeId: e.target.value }))}
                                style={{ ...field, appearance: "auto" }}
                              >
                                <option value="">{ar ? "اختر درجة من سلّم المسمّى" : "Pick a grade from this title"}</option>
                                {offerGrades.map((grade) => (
                                  <option key={grade.id} value={grade.id}>{grade.gradeNumber ? `${grade.gradeNumber} · ` : ""}{grade.title || jobGradeLabel(grade)}</option>
                                ))}
                              </select>
                            </Field>
                          ) : null}
                          {!freeBranchPick ? (
                            <button
                              type="button"
                              onClick={() => setCreating(false)}
                              style={{ ...ui.btnGhost, alignSelf: "start", height: 32 }}
                            >
                              {ar ? "أو اختر منصبًا شاغرًا" : "Or pick a vacant seat"}
                            </button>
                          ) : null}
                        </>
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
                                    {pickStationId ? "" : ` · ${stations.find((item) => item.id === seat.stationId)?.name || ""}`}
                                  </option>
                                ))}
                              </select>
                            </Field>
                          ) : (
                            <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.55 }}>
                              {pickStationId
                                ? (ar ? "لا منصب شاغر في هذا الفرع — أنشئ منصبًا أو غيّر الفرع." : "No vacant seat on this branch — create one or change the branch.")
                                : (ar ? "اختر فرعًا أولًا لعرض المناصب الشاغرة." : "Pick a branch first to see vacant seats.")}
                            </p>
                          )}
                          {!freeBranchPick ? (
                            <button
                              type="button"
                              onClick={() => { setCreating(true); setChosenSeatId(""); }}
                              style={{ ...ui.btnSecondary, display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "start" }}
                            >
                              <Plus style={{ width: 14, height: 14 }} />
                              {ar ? "أنشئ منصبًا في هذه الوحدة" : "Create a seat in this unit"}
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                  )}

                  {readout && !creating && (
                    <div data-hire-seat-card="1" style={{ borderRadius: 14, border: `1px solid ${BORDER}`, background: CARD, overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "var(--nv-accent-soft, #EEF5F0)", borderBottom: `1px solid ${BORDER}` }}>
                        <span aria-hidden style={{ width: 42, height: 42, borderRadius: 12, background: "var(--nv-card)", border: "1px solid var(--nv-ok-line, #BFE6D2)", color: "var(--nv-ok-ink, #1F5A3D)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Briefcase style={{ width: 20, height: 20 }} strokeWidth={1.8} />
                        </span>
                        <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                          <span style={{ fontSize: 11, color: MUTED }}>{ar ? "المنصب الذي سيُعيَّن عليه" : "The seat being filled"}</span>
                          <strong style={{ fontSize: 15, color: INK, lineHeight: 1.4 }}>{readout.title || (ar ? "منصب شاغر" : "Vacant seat")}</strong>
                          <span style={{ fontSize: 12, color: NAVY, fontWeight: 600 }}>{readout.branch || "—"}</span>
                        </span>
                        <span style={{ marginInlineStart: "auto", alignSelf: "flex-start", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "var(--nv-warn-soft, #FFF6E5)", color: "var(--nv-warn-ink, #8A5A00)", border: "1px solid var(--nv-warn-line, #F1D9A6)", whiteSpace: "nowrap" }}>
                          {ar ? "شاغر" : "Vacant"}
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: BORDER }}>
                        {[
                          [ar ? "القائمة" : "List", readout.list],
                          [ar ? "الدرجة" : "Grade", readout.grade],
                          [ar ? "نطاق الراتب" : "Salary range", (readout.salaryMin || readout.salaryMax) ? formatSalaryRange(readout.salaryMin, readout.salaryMax, ar) : ""],
                          [ar ? "الإجازة السنوية" : "Annual leave", ar ? `يكتسب ${leaveDays} يوماً حتى نهاية السنة` : `${leaveDays} days earned by year end`],
                        ].map(([label, value]) => (
                          <div key={label} style={{ background: CARD, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                            <span style={{ fontSize: 11, color: MUTED }}>{label}</span>
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: value ? INK : MUTED }}>{value || (ar ? "يُحدَّد في الملف" : "Set in the file")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Section n={freeBranchPick ? (ar ? "٣" : "3") : (ar ? "٢" : "2")} title={ar ? "الصلاحية والصفة الإدارية" : "Access and role"} hint={ar ? "تُعطى الصلاحية هنا، وتُعدَّل لاحقاً من «الصلاحيات» أو الهيكل." : "Access is given here and changed later from Access or the structure."}>
                  <label data-hire-access="1" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: INK }}>{ar ? "الصلاحية" : "Access"}</span>
                    <select value={accessValue} onChange={(e) => setAccessId(e.target.value)} style={{ ...field, appearance: "auto" }}>
                      {packs.length ? (
                        <optgroup label={ar ? "قوائم المنشأة" : "Company lists"}>
                          {packs.map((pack) => <option key={pack.id} value={pack.id}>{templateLabel(pack, ar)}</option>)}
                        </optgroup>
                      ) : null}
                      <optgroup label={ar ? "قوالب جاهزة" : "Ready templates"}>
                        {BUILT_IN_TEMPLATES.filter((tpl) => !packs.some((p) => p.id === tpl.id)).map((tpl) => <option key={tpl.id} value={tpl.id}>{templateLabel(tpl, ar)}</option>)}
                      </optgroup>
                    </select>
                  </label>
                  {hrBranchId ? (
                    <p data-hire-hr-branch="1" style={{ margin: 0, fontSize: 12, color: INK, lineHeight: 1.7, padding: "10px 12px", borderRadius: 10, background: "var(--nv-accent-soft, #EEF5F0)", border: `1px solid ${BORDER}` }}>
                      {ar
                        ? `يُعيَّن مدير الموارد البشرية لـ«${hrBranchName}»، ويتبع مدير وحدة الموارد البشرية.`
                        : `Becomes the HR manager for “${hrBranchName}”, reporting to the HR unit director.`}
                    </p>
                  ) : hrHome && activeSeat && activeSeat.hrPost !== "director" ? null : hasManager ? (
                    <div data-hire-replace-manager="1" style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 14px", borderRadius: 12, border: `1px solid ${makeManager ? "var(--nv-warn-line, #E8C98A)" : BORDER}`, background: makeManager ? "var(--nv-warn-soft, #FFF8EA)" : CARD }}>
                      <span style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: INK, lineHeight: 1.7 }}>
                        <span aria-hidden style={{ color: "var(--nv-warn-ink, #8a5a00)", fontWeight: 800 }}>!</span>
                        <span>
                          {hrHome
                            ? (ar ? "يوجد حالياً مدير للموارد البشرية: " : "There is already an HR director: ")
                            : (ar ? `يوجد حالياً مدير لـ«${stationName}»: ` : `“${stationName}” already has a manager: `)}
                          <strong>{currentManager?.name || (ar ? "غير معروف" : "unknown")}</strong>
                          {ar ? ". هل تريد تغييره؟" : ". Replace them?"}
                        </span>
                      </span>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, color: INK }}>
                        <input type="checkbox" checked={makeManager} onChange={(e) => setMakeManager(e.target.checked)} />
                        {hrHome
                          ? (ar ? "نعم، اجعله مدير الموارد البشرية بدلاً منه" : "Yes, make them the HR director instead")
                          : (ar ? "نعم، اجعله مدير الفرع بدلاً منه" : "Yes, make them the branch manager instead")}
                      </label>
                      {makeManager ? (
                        <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
                          {hrHome
                            ? (ar ? `يبقى ${currentManager?.name || "المدير الحالي"} في الموارد البشرية بمسمّى «مدير موارد بشرية».` : "The current director stays in HR as an HR manager.")
                            : (ar ? `يبقى ${currentManager?.name || "المدير الحالي"} في منصبه موظفاً، ويُرفع عنه إدارة الفرع.` : "The current manager stays as staff; the branch moves to the new manager.")}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <label data-hire-make-manager="1" style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: 12, cursor: "pointer", border: `1px solid ${makeManager ? NAVY : BORDER}`, background: makeManager ? "var(--nv-accent-soft, #EEF5F0)" : CARD }}>
                      <input type="checkbox" checked={makeManager} onChange={(e) => setMakeManager(e.target.checked)} style={{ marginTop: 3 }} />
                      <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <strong style={{ fontSize: 12.5, color: INK }}>
                          {hrHome ? (ar ? "اجعله مدير الموارد البشرية" : "Make them the HR director") : (ar ? `اجعله مدير ${stationName || "هذا الفرع"}` : "Make them manager of this branch")}
                        </strong>
                        <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
                          {hrHome
                            ? (ar ? "يتبعه مدراء موارد الفروع وموظفو القسم." : "Branch HR managers and the HR staff report to them.")
                            : (ar ? "يتبعه موظفو الفرع، ويظهر اسمه في ملفاتهم." : "The branch staff report to them; the name shows on their files.")}
                        </span>
                      </span>
                    </label>
                  )}

                  {homeId && !hrHome && extraStations.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>{ar ? "يعمل أيضاً في (اختياري)" : "Also works at (optional)"}</span>
                        <span style={{ fontSize: 11, color: MUTED }}>{ar ? "فروع أخرى يُسمح له بالبصمة فيها." : "Other branches where they may punch."}</span>
                      </span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {extraStations.map((station) => {
                          const on = extraStationIds.includes(station.id);
                          return (
                            <button
                              key={station.id}
                              type="button"
                              aria-pressed={on}
                              onClick={() => toggleExtra(station.id)}
                              style={{ fontFamily: "inherit", height: 30, padding: "0 12px", borderRadius: 999, fontSize: 12, fontWeight: on ? 700 : 500, cursor: "pointer", border: `1px solid ${on ? NAVY : BORDER}`, background: on ? NAVY : CARD, color: on ? "#fff" : INK }}
                            >
                              {on ? "✓ " : ""}{station.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  </Section>
                </>
              )}

              {step === 2 && (
                <>
                  <div style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: `1px solid ${completion.done ? "var(--nv-ok-line, #BFE6D2)" : BORDER}`,
                    background: completion.done ? "var(--nv-ok-soft, #F2FAF6)" : SURFACE,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                      <strong style={{ fontSize: 12.5, color: INK }}>
                        {ar ? "اكتمال الملف" : "File completeness"}
                      </strong>
                      <span dir="ltr" style={{ fontSize: 12, fontWeight: 700, color: completion.done ? "var(--nv-ok-ink, #15803D)" : NAVY }}>
                        {completion.done ? (ar ? "مكتمل" : "Complete") : `${completion.pct}%`}
                      </span>
                    </div>
                    <div style={{ height: 5, borderRadius: 999, background: "var(--nv-line2, #EEF1EF)", overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: `${completion.pct}%`,
                        borderRadius: 999,
                        background: completion.done ? "var(--nv-btn-fill)" : completion.pct >= 50 ? "var(--nv-warn-fill)" : "var(--nv-bad-ink)",
                      }}
                      />
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: MUTED, lineHeight: 1.55 }}>
                      {completion.done
                        ? (ar ? "كل الحقول الإلزامية معبأة — جاهز لحفظ ملف مكتمل." : "All required fields are filled — ready to save a complete file.")
                        : (ar
                          ? `ينقص ${completion.missing.length}: ${completion.missing.slice(0, 4).map((item) => item.ar).join(" · ")}${completion.missing.length > 4 ? "…" : ""}`
                          : `Missing ${completion.missing.length}: ${completion.missing.slice(0, 4).map((item) => item.en).join(" · ")}${completion.missing.length > 4 ? "…" : ""}`)}
                    </p>
                  </div>
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
                        style={{ margin: 0, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: 10 }}
                      >
                        <legend style={{ fontSize: 12, fontWeight: 600, padding: "0 6px" }}>{ar ? group.ar : group.en}</legend>
                        {identityGate?.error === "SAUDI_IDENTITY_MISMATCH" ? (
                          <p style={{ margin: 0, fontSize: 11, color: "var(--nv-bad-ink)", lineHeight: 1.55 }}>
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
          ) : (
            <>
              {transferring ? (
                <button type="button" disabled={busy || !existingId} onClick={transfer} style={{ ...ui.btnPrimary, width: "100%", opacity: existingId ? 1 : 0.6 }}>
                  {ar ? "نقل إلى المنصب" : "Move to the seat"}
                </button>
              ) : (
              <>
              <p style={{ margin: 0, fontSize: 11, color: MUTED, lineHeight: 1.5 }}>
                {ar
                  ? "المسوّدة للنقص. «حفظ ملف مكتمل» يطلب الحقول الإلزامية. الوثائق الناقصة تذهب للامتثال."
                  : "Draft allows gaps. “Save complete file” requires required fields. Missing documents go to compliance."}
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
                    <button type="button" disabled={busy} onClick={() => save(completion.done ? "complete-another" : "another")} style={{ ...ui.btnSecondary, flex: "1 1 140px" }}>
                      {ar ? "حفظ وأضف آخر" : "Save & add another"}
                    </button>
                    <button type="button" disabled={busy} onClick={() => save(completion.done ? "complete" : "done")} style={{ ...ui.btnPrimary, flex: "1 1 120px" }}>
                      {completion.done ? (ar ? "حفظ ملف مكتمل" : "Save complete file") : (ar ? "حفظ الملف" : "Save file")}
                    </button>
                  </>
                )}
              </div>
              {step === 2 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button type="button" disabled={busy} onClick={() => save("complete")} style={{ ...ui.btnPrimary, flex: "1 1 160px" }}>
                    {ar ? "حفظ ملف مكتمل" : "Save complete file"}
                  </button>
                  <button type="button" disabled={busy} onClick={() => save("done")} style={{ ...ui.btnGhost, flex: "1 1 140px" }}>
                    {ar ? "حفظ دون دخول" : "Save without sign-in"}
                  </button>
                </div>
              ) : null}
              <Link to="/app/hr" onClick={onClose} style={{ fontSize: 11, color: MUTED, textDecoration: "none" }}>
                {ar ? "تقويم الامتثال في الموارد البشرية" : "Compliance calendar in HR"}
              </Link>
              </>
              )}
            </>
          )}
        </footer>
      </aside>
    </div>,
    document.body,
  );
}
