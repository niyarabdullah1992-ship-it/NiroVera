import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/PowerCareAuth";
import { useI18n } from "@/lib/i18n";
import {
  checkEditWorkProofGate,
  checkProofHeatBanGate,
  checkProofPlaceGate,
  deriveProofCounts,
  deriveProofHeatBanFlag,
  deriveProofStage,
  isProofCrewMember,
  isSameProofBranch,
  isWorkProofArchived,
  proofEditDeadline,
  proofPlaceLabel,
  workProofArchiveDate,
} from "@/lib/workProofDerivations";
import {
  approveLocalWorkProof,
  attachLocalWorkProof,
  editLocalWorkProof,
  endLocalWorkProof,
  listLocalWorkProofs,
  raiseLocalWorkProof,
} from "@/lib/localWorkProofFallback";
import { getCompanyData } from "@/lib/store";
import { toast } from "@/components/ui/use-toast";
import {
  BORDER,
  CARD,
  MUTED,
  NAVY,
  SURFACE,
  ui,
  field,
} from "@/lib/platformStyles";
import useStationScope, { matchesStationScope } from "@/hooks/useStationScope";
import PlatformStampShell from "@/components/shared/PlatformStampShell";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import { pageKicker } from "@/lib/moduleMeta";
import ComposerModalShell from "@/components/shared/ComposerModalShell";
import SectionBackLink from "@/components/shared/SectionBackLink";
import OpsTaskSection from "@/components/tasks/detail/OpsTaskSection";
import RecordSmartArchive from "@/components/shared/RecordSmartArchive";
import PlatformDateField from "@/components/shared/PlatformDateField";
import ProofSurfaceNote from "@/components/proof/ProofSurfaceNote";
import OpsLaneTiles from "@/components/tasks/OpsLaneTiles";
import OpsToolbarStrip, { OpsControlBar, OpsStripSearch } from "@/components/tasks/OpsToolbarStrip";
import ProofRecordsTable from "@/components/proof/ProofRecordsTable";
import ProofAttachments from "@/components/proof/ProofAttachments";
import ProofAuditTimeline from "@/components/proof/ProofAuditTimeline";
import { makeProofAttachment, readProofFile, readProofFiles } from "@/lib/proofAttachments";
import WorkProofRaiseFields, {
  EMPTY_PERSON,
  EMPTY_VEHICLE,
  dateTimeDateKey,
  formatProofDateTime,
  proofEntityPlaceLabel,
  proofPersonLabel,
  proofRaiserLabel,
  proofVehicleText,
  proofWorkerIdentityLine,
  spliceDateIntoDateTime,
  workDurationLabel,
  workPeriodLabel,
  workProofEntityFields,
  workSpanLabel,
} from "@/components/proof/WorkProofRaiseFields";
import { peopleFromProof, vehiclesFromProof, workProofCrewFields, checkProofPunchStation } from "@/lib/workProofCrew";
import { visitorIdTypeLabel } from "@/lib/visitorProof";
import { checkFieldAttendanceGate } from "@/lib/attendanceGate";
import { getLocalTodayAttendance } from "@/lib/localAttendanceFallback";

async function workproof(payload) {
  const res = await base44.functions.invoke("workproof", payload);
  return res?.data ?? res;
}

/** Local preview stubs `{ ok: true, localPreview: true }` without saving — fall through to local store. */
function isLiveRemote(remote) {
  return !!(remote && !remote.localPreview && (remote.ok || remote.proof || Array.isArray(remote.proofs)));
}

function stampNow(date = new Date()) {
  return date.toLocaleString("en-GB", {
    timeZone: "Asia/Riyadh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function photoStamp(stamp, fallbackIso, ar) {
  if (stamp && /\d{1,2}[/.]/.test(stamp) && /\d{4}/.test(stamp)) return stamp;
  return formatProofDateTime(fallbackIso, ar) || stamp || "—";
}

function localDateTimeValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toLocalInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return localDateTimeValue(date);
}

function normalizeWorkProofFilter(value) {
  const raw = String(value || "").toLowerCase();
  if (raw === "sealed" || raw === "completed") return "archive";
  if (raw === "await" || raw === "archive") return raw;
  return "all";
}

function remainingEditLabel(proof, ar) {
  const until = proofEditDeadline(proof);
  if (!until) return "";
  const left = until - Date.now();
  if (left <= 0) return "";
  const hours = Math.floor(left / 36e5);
  const mins = Math.max(1, Math.floor((left % 36e5) / 6e4));
  if (hours >= 1) return ar ? `تعديل متاح · ${hours} س` : `Editable · ${hours}h`;
  return ar ? `تعديل متاح · ${mins} د` : `Editable · ${mins}m`;
}

/** The breach stamped at closing, or derived for records closed before it was stamped. */
function heatBanFlagOf(proof) {
  return proof?.heatBanFlag || deriveProofHeatBanFlag(proof);
}

function readImage(file) {
  return new Promise((resolve) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

const STAGE_LABEL = {
  await: { ar: "جارٍ العمل", en: "In progress" },
  ready: { ar: "يحتاج إنهاء", en: "Needs finish" },
  sealed: { ar: "مكتمل", en: "Completed" },
  accepted: { ar: "مستلَم", en: "Accepted" },
  rejected: { ar: "مرفوض", en: "Rejected" },
};

function stageKind(stage) {
  if (stage === "sealed" || stage === "accepted") return "ok";
  if (stage === "ready") return "info";
  if (stage === "rejected") return "bad";
  return "warn";
}

function stageDot(stage) {
  if (stage === "sealed" || stage === "accepted") return "#1E9E63";
  if (stage === "ready") return "#1D4ED8";
  if (stage === "rejected") return "#DC2626";
  return "#F59E0B";
}

const FIELD = { ...field, height: 40 };
const LABEL_SPAN = { fontSize: 12, fontWeight: 600, color: MUTED };

function ReadField({ label, children, ltr, multiline }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "1 1 auto", minWidth: 160 }}>
      <span style={LABEL_SPAN}>{label}</span>
      <div
        style={{
          ...FIELD,
          height: multiline ? "auto" : 40,
          minHeight: 40,
          display: "flex",
          alignItems: multiline ? "flex-start" : "center",
          overflow: "hidden",
          paddingBlock: multiline ? 8 : undefined,
        }}
      >
        <span
          dir={ltr ? "ltr" : undefined}
          style={{
            overflow: "hidden",
            textOverflow: multiline ? "clip" : "ellipsis",
            whiteSpace: multiline ? "normal" : "nowrap",
            minWidth: 0,
            flex: 1,
            lineHeight: multiline ? 1.45 : undefined,
          }}
        >
          {children || "—"}
        </span>
      </div>
    </div>
  );
}

export default function WorkProof() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { company, data, currentUser } = useAuth();
  const headerScope = useStationScope();
  const stations = data?.stations || [];
  const defaultStation = headerScope !== "all" ? headerScope : (stations[0]?.id || "");

  const [proofs, setProofs] = useState([]);
  const [filter, setFilter] = useState("all");
  const boardFilter = normalizeWorkProofFilter(filter);
  const [query, setQuery] = useState("");
  const [raising, setRaising] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    workReason: "",
    entityScope: "external",
    entityStationId: "",
    entityKind: "company",
    entityName: "",
    entityUnified: "",
    entityCr: "",
    entityQiwa: "",
    entitySite: "",
    entityProject: "",
    entityContact: "",
    entityPhone: "",
    entityEmail: "",
    personName: "",
    personId: "",
    personTitle: "",
    personPhone: "",
    people: [{ ...EMPTY_PERSON }],
    startedAt: localDateTimeValue(),
    endedAt: "",
    vehicle: { ...EMPTY_VEHICLE },
    vehicles: vehiclesFromProof(null),
    client: "",
    stationId: defaultStation,
    place: "",
    geoVerdict: "in",
    beforeFile: null,
    afterFile: null,
    files: [],
  });
  const [geoReason, setGeoReason] = useState("");
  const [ending, setEnding] = useState(null);
  const [editingProof, setEditingProof] = useState(null);
  const [openProofId, setOpenProofId] = useState(null);

  const isManager = !!(currentUser && (
    ["owner", "director", "ops_manager", "station_manager", "pgm", "admin"].includes(currentUser.role)
    || data?.ownerId === currentUser?.id
  ));

  const applyBoard = (board) => {
    setProofs(board.proofs || []);
  };

  const load = async () => {
    if (!company?.id) return;
    applyBoard(listLocalWorkProofs(getCompanyData(company.id) || data));
    try {
      const remote = await workproof({ action: "list", companyId: company.id });
      if (isLiveRemote(remote) && Array.isArray(remote.proofs)) applyBoard(remote);
    } catch {
      applyBoard(listLocalWorkProofs(getCompanyData(company.id) || data));
    }
  };

  useEffect(() => { load(); }, [company?.id]);
  useEffect(() => {
    if (headerScope !== "all") setForm((f) => ({ ...f, stationId: headerScope }));
  }, [headerScope]);

  const raise = async (event) => {
    event.preventDefault();
    if (!company?.id) return;
    if (!form.stationId) {
      toast({ description: ar ? "اختر فرعًا." : "Pick a branch.", variant: "destructive" });
      return;
    }
    if (!String(form.workReason || "").trim()) {
      toast({ description: ar ? "اكتب سبب العمل." : "Write the reason for the work.", variant: "destructive" });
      return;
    }
    const entity = workProofEntityFields(form);
    if (!entity.ok) {
      toast({ description: ar ? entity.errorAr : entity.errorEn, variant: "destructive" });
      return;
    }
    const crew = workProofCrewFields(form);
    if (!crew.ok) {
      toast({ description: ar ? crew.errorAr : crew.errorEn, variant: "destructive" });
      return;
    }
    const placeGate = checkProofPlaceGate(form.place);
    if (!placeGate.ok) {
      toast({ description: ar ? placeGate.reason : placeGate.reasonEn, variant: "destructive" });
      return;
    }
    // Opening the record under the sun is refused while it can still be avoided.
    const heatGate = checkProofHeatBanGate({ place: placeGate.place });
    if (!heatGate.ok) {
      toast({ description: ar ? heatGate.reason : heatGate.reasonEn, variant: "destructive" });
      return;
    }
    const attGate = attendanceGateFor(form.stationId, form.geoVerdict);
    if (!attGate.ok) {
      toast({ description: ar ? (attGate.reason || attGate.error) : (attGate.reasonEn || attGate.reason || attGate.error), variant: "destructive" });
      return;
    }
    if (!form.beforeFile) {
      toast({ description: ar ? "أرفق صورة القبل." : "Attach the before photo.", variant: "destructive" });
      return;
    }
    setBusy(true);
    const startDate = form.startedAt ? new Date(form.startedAt) : new Date();
    const payload = {
      title: form.title,
      workReason: form.workReason,
      ...entity.fields,
      ...crew.fields,
      startedAt: form.startedAt || new Date().toISOString(),
      client: form.entityContact || crew.fields.personName || entity.fields.entityName,
      stationId: form.stationId,
      place: placeGate.place,
      geoVerdict: form.geoVerdict,
      raiserName: currentUser?.name || "",
      beforeStamp: stampNow(Number.isNaN(startDate.getTime()) ? new Date() : startDate),
      beforeUrl: await readImage(form.beforeFile),
      attachments: await readProofFiles(form.files),
    };
    try {
      let remote = null;
      try {
        remote = await workproof({ action: "raise", companyId: company.id, ...payload });
      } catch {
        remote = null;
      }
      const result = isLiveRemote(remote)
        ? remote
        : raiseLocalWorkProof(company.id, payload, currentUser);
      if (result?.ok) {
        toast({ description: ar ? "بُدئ العمل — الإنهاء وصورة البعد لاحقًا." : "Work started — end it later with the after photo." });
        resetForm();
        setRaising(false);
        load();
      } else {
        toast({ description: result?.error || (ar ? "تعذّر الرفع." : "Could not raise."), variant: "destructive" });
      }
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (fnRemote, fnLocal, proof, extra) => {
    setBusy(true);
    try {
      let remote = null;
      try {
        remote = await fnRemote();
      } catch {
        remote = null;
      }
      const result = isLiveRemote(remote)
        ? remote
        : fnLocal(company.id, proof, currentUser, extra);
      if (result?.error) {
        toast({ description: ar ? (result.reason || result.error) : (result.reasonEn || result.reason || result.error), variant: "destructive" });
      } else {
        if (extra != null) setGeoReason("");
        load();
      }
    } finally {
      setBusy(false);
    }
  };

  const sameBranchOf = (proof) => isSameProofBranch(currentUser?.stationId, proof.stationId)
    || (currentUser?.managedStations || []).map(String).includes(String(proof.stationId))
    || (headerScope !== "all" && String(headerScope) === String(proof.stationId));

  const onCrewOf = (proof) => isProofCrewMember(proof, currentUser?.id);

  const actorAttendance = () => getLocalTodayAttendance(company?.id, currentUser?.id)
    || (data?.personalAttendance || []).find((row) => String(row.employeeId ?? row.employee_id) === String(currentUser?.id));

  const attendanceGateFor = (stationId, geoVerdict) => {
    if (currentUser && (["owner", "admin"].includes(currentUser.role) || data?.ownerId === currentUser.id)) {
      return { ok: true };
    }
    const attendance = actorAttendance();
    const field = checkFieldAttendanceGate(attendance, { gpsRequired: false });
    if (!field.ok) return field;
    if (String(geoVerdict || "in") === "out") return { ok: true };
    return checkProofPunchStation(attendance, stationId);
  };

  const resetForm = () => {
    setForm((f) => ({
      ...f,
      title: "",
      workReason: "",
      entityScope: "external",
      entityStationId: "",
      entityKind: "company",
      entityName: "",
      entityUnified: "",
      entityCr: "",
      entityQiwa: "",
      entitySite: "",
      entityProject: "",
      entityContact: "",
      entityPhone: "",
      entityEmail: "",
      personName: "",
      personId: "",
      personTitle: "",
      personPhone: "",
      people: [{ ...EMPTY_PERSON }],
      startedAt: localDateTimeValue(),
      endedAt: "",
      vehicle: { ...EMPTY_VEHICLE },
      vehicles: vehiclesFromProof(null),
      client: "",
      stationId: defaultStation,
      place: "",
      geoVerdict: "in",
      beforeFile: null,
      afterFile: null,
      files: [],
    }));
  };

  const startEdit = (proof) => {
    const gate = checkEditWorkProofGate({
      proof,
      actorUserId: currentUser?.id,
      sameBranch: sameBranchOf(proof),
      isManager,
    });
    if (!gate.ok) {
      toast({ description: ar ? (gate.reason || gate.error) : (gate.reasonEn || gate.reason || gate.error), variant: "destructive" });
      return;
    }
    setRaising(false);
    setEnding(null);
    setOpenProofId(null);
    setEditingProof(proof);
    setForm((f) => ({
      ...f,
      title: proof.title || "",
      workReason: proof.workReason || "",
      entityScope: "external",
      entityStationId: "",
      entityKind: proof.entityKind === "individual" ? "individual" : "company",
      entityName: proof.entityName || "",
      entityUnified: proof.entityUnified || "",
      entityCr: proof.entityCr || "",
      entityQiwa: proof.entityQiwa || "",
      entitySite: proof.entitySite || "",
      entityProject: proof.entityProject || "",
      entityContact: proof.entityContact || "",
      entityPhone: proof.entityPhone || "",
      entityEmail: proof.entityEmail || "",
      personName: proof.personName || "",
      personId: proof.personId || "",
      personTitle: proof.personTitle || "",
      personPhone: proof.personPhone || "",
      people: peopleFromProof(proof),
      startedAt: toLocalInput(proof.startedAt),
      vehicle: { ...EMPTY_VEHICLE, ...(proof.vehicle || {}) },
      vehicles: vehiclesFromProof(proof),
      client: proof.client || "",
      stationId: proof.stationId || defaultStation,
      place: proof.place || "",
      geoVerdict: proof.geoVerdict === "out" ? "out" : "in",
      beforeFile: null,
      afterFile: null,
      files: [],
    }));
  };

  const cancelForm = () => {
    setRaising(false);
    setEditingProof(null);
    resetForm();
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    if (!company?.id || !editingProof) return;
    if (!String(form.workReason || "").trim()) {
      toast({ description: ar ? "اكتب سبب العمل." : "Write the reason for the work.", variant: "destructive" });
      return;
    }
    const entity = workProofEntityFields(form);
    if (!entity.ok) {
      toast({ description: ar ? entity.errorAr : entity.errorEn, variant: "destructive" });
      return;
    }
    const crew = workProofCrewFields(form);
    if (!crew.ok) {
      toast({ description: ar ? crew.errorAr : crew.errorEn, variant: "destructive" });
      return;
    }
    // An edit may correct the place, never blank it — the ban reads it.
    const placeGate = checkProofPlaceGate(form.place ?? editingProof.place);
    if (!placeGate.ok) {
      toast({ description: ar ? placeGate.reason : placeGate.reasonEn, variant: "destructive" });
      return;
    }
    setBusy(true);
    const payload = {
      title: form.title,
      workReason: form.workReason,
      ...entity.fields,
      ...crew.fields,
      startedAt: form.startedAt,
      client: form.entityContact || crew.fields.personName || entity.fields.entityName,
      stationId: form.stationId,
      place: placeGate.place,
      geoVerdict: form.geoVerdict,
      sameBranch: sameBranchOf(editingProof),
      isManager,
    };
    try {
      let remote = null;
      try {
        remote = await workproof({ action: "edit", companyId: company.id, id: editingProof.id, ...payload });
      } catch {
        remote = null;
      }
      const result = isLiveRemote(remote)
        ? remote
        : editLocalWorkProof(company.id, editingProof, currentUser, payload);
      if (result?.error) {
        toast({ description: ar ? (result.reason || result.error) : (result.reasonEn || result.reason || result.error), variant: "destructive" });
      } else {
        toast({ description: ar ? "حُفظ التعديل — المهلة يوم واحد من الرفع." : "Edit saved — one day from the original raise." });
        setEditingProof(null);
        resetForm();
        load();
      }
    } finally {
      setBusy(false);
    }
  };

  const endWork = async (proof) => {
    if (!ending?.afterFile) {
      toast({ description: ar ? "ارفع صورة البعد لإنهاء العمل." : "Upload the after photo to end the work.", variant: "destructive" });
      return;
    }
    const attGate = attendanceGateFor(proof.stationId, proof.geoVerdict);
    if (!attGate.ok) {
      toast({ description: ar ? (attGate.reason || attGate.error) : (attGate.reasonEn || attGate.reason || attGate.error), variant: "destructive" });
      return;
    }
    setBusy(true);
    const payload = {
      endedAt: ending.endedAt || new Date().toISOString(),
      afterStamp: stampNow(ending.endedAt ? new Date(ending.endedAt) : new Date()),
      afterUrl: await readImage(ending.afterFile),
      sameBranch: sameBranchOf(proof),
      isManager,
    };
    try {
      let remote = null;
      try {
        remote = await workproof({ action: "end", companyId: company.id, id: proof.id, ...payload });
      } catch {
        remote = null;
      }
      const result = isLiveRemote(remote)
        ? remote
        : endLocalWorkProof(company.id, proof, currentUser, payload);
      if (result?.error) {
        toast({ description: ar ? (result.reason || result.error) : (result.reasonEn || result.reason || result.error), variant: "destructive" });
      } else {
        toast({ description: ar ? "أُنهي العمل." : "Work ended." });
        setEnding(null);
        setOpenProofId(null);
        load();
      }
    } finally {
      setBusy(false);
    }
  };

  const attachWorkDoc = async (proof, file, replaceId = null) => {
    if (!proof || !file) return;
    setBusy(true);
    try {
      let entry = await readProofFile(file);
      if (file instanceof File) {
        try {
          const up = await base44.integrations.Core.UploadFile({ file });
          if (up?.file_url) {
            entry = makeProofAttachment({
              id: entry?.id,
              url: up.file_url,
              name: file.name || entry?.name,
              type: file.type || entry?.type,
              localOnly: false,
              createdAt: entry?.createdAt,
            });
          }
        } catch {
          /* keep local data URL */
        }
      }
      let remote = null;
      try {
        remote = await workproof({
          action: "addAttachment",
          companyId: company.id,
          id: proof.id,
          replaceId,
          url: entry.url,
          name: entry.name,
          type: entry.type,
        });
      } catch {
        remote = null;
      }
      const result = isLiveRemote(remote)
        ? remote
        : attachLocalWorkProof(company.id, proof, entry, { replaceId, actor: currentUser });
      if (result?.error) {
        toast({ description: ar ? (result.reason || result.error) : (result.reasonEn || result.reason || result.error), variant: "destructive" });
      } else {
        load();
      }
    } finally {
      setBusy(false);
    }
  };

  const scopedProofs = proofs.filter((p) => matchesStationScope(p.stationId, headerScope, data?.stations));
  const scopedCounts = useMemo(() => deriveProofCounts(scopedProofs), [scopedProofs]);
  const liveProofs = scopedProofs.filter((p) => !isWorkProofArchived(p));
  const archiveProofs = scopedProofs.filter((p) => isWorkProofArchived(p));
  const stationName = (id) => stations.find((s) => String(s.id) === String(id))?.name || id || "—";
  const matchesQuery = (p) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const hay = [
      p.title, p.workReason, p.ref, p.sealId, p.raiserName,
      p.place ? proofPlaceLabel(p.place, ar ? "ar" : "en") : "",
      proofPersonLabel(p), proofEntityPlaceLabel(p, stationName, ar),
      proofVehicleText(p), p.client, p.entityName, p.entityUnified, p.entityCr,
      ...peopleFromProof(p).map((person) => proofWorkerIdentityLine(person)),
    ].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  };
  const visible = scopedProofs.filter((p) => {
    if (boardFilter === "archive") return false;
    const stage = p.stage || deriveProofStage(p);
    if (boardFilter === "all") return !isWorkProofArchived(p) && matchesQuery(p);
    if (boardFilter !== "all" && stage !== boardFilter) return false;
    return matchesQuery(p);
  });
  const archiveItems = archiveProofs.filter(matchesQuery).map((p) => ({
    id: p.id || p.ref,
    title: p.title || p.ref || "—",
    text: [
      p.ref,
      p.raiserName ? (ar ? `أنشأها ${p.raiserName}` : `Created by ${p.raiserName}`) : proofRaiserLabel(p, ar),
      p.entityKind === "individual" ? (ar ? "شخص" : "Person") : (ar ? "جهة خارجية" : "Outside company"),
      p.place ? proofPlaceLabel(p.place, ar ? "ar" : "en") : "",
      proofEntityPlaceLabel(p, stationName, ar),
      proofPersonLabel(p),
      proofVehicleText(p),
    ].filter(Boolean).join(" · "),
    date: workProofArchiveDate(p),
    badge: ar ? (STAGE_LABEL[p.stage || deriveProofStage(p)]?.ar) : (STAGE_LABEL[p.stage || deriveProofStage(p)]?.en),
  }));
  const filterChips = [
    { id: "all", label: ar ? `الكل · ${liveProofs.length}` : `All · ${liveProofs.length}` },
    { id: "await", label: ar ? `بانتظار · ${scopedCounts.await}` : `Awaiting · ${scopedCounts.await}` },
    { id: "archive", label: ar ? `الأرشيف · ${archiveProofs.length}` : `Archive · ${archiveProofs.length}` },
  ];

  const proofAccess = (p) => {
    const stage = p.stage || deriveProofStage(p);
    const isRaiser = !!(currentUser?.id && p.raiserId && String(currentUser.id) === String(p.raiserId));
    const sameBranch = sameBranchOf(p);
    const onCrew = onCrewOf(p);
    return {
      stage,
      canEnd: stage === "await" && (isRaiser || sameBranch || isManager || onCrew),
      canEdit: checkEditWorkProofGate({
        proof: p,
        actorUserId: currentUser?.id,
        sameBranch,
        isManager,
      }).ok,
      canFinishReady: stage === "ready" && (isRaiser || sameBranch || isManager || onCrew),
      canAttach: (stage === "await" || stage === "ready") && (isRaiser || sameBranch || isManager || onCrew),
      workers: peopleFromProof(p).filter((person) => person?.name),
    };
  };

  const tableRows = visible.map((p) => {
    const access = proofAccess(p);
    const photos = (p.beforeUrl ? 1 : 0) + (p.afterUrl ? 1 : 0);
    const workers = access.workers;
    const heatFlag = heatBanFlagOf(p);
    return {
      id: p.id || p.ref,
      proof: p,
      title: p.title,
      ref: p.ref,
      meta: [
        p.entityKind === "individual" ? (ar ? "مؤسسة فردية" : "Individual") : (ar ? "جهة خارجية" : "Outside company"),
        p.place ? proofPlaceLabel(p.place, ar ? "ar" : "en") : "",
        // «حضوري» would now clash with the place vocabulary — the geofence verdict says in/out only.
        p.geoVerdict === "out" ? (ar ? "خارج النطاق" : "Outside range") : (ar ? "داخل النطاق" : "Inside range"),
        proofVehicleText(p),
      ].filter(Boolean),
      station: stationName(p.stationId),
      owner: p.entityName || (ar ? "جهة خارجية" : "Outside company"),
      ownerChip: heatFlag
        ? (ar
          ? `مخالفة حظر الشمس · ${heatFlag.minutes} دقيقة`
          : `Sun-ban breach · ${heatFlag.minutes} min`)
        : undefined,
      scopeKind: p.entityKind === "individual" ? "person" : "company",
      scopeLabel: p.entityKind === "individual" ? (ar ? "شخص" : "Person") : (ar ? "جهة خارجية" : "Outside company"),
      creator: p.raiserName || (String(p.raiserId || "") === String(currentUser?.id || "") ? (currentUser?.name || "") : ""),
      due: workDurationLabel(p.startedAt, p.endedAt, ar) || formatProofDateTime(p.startedAt || p.createdAt, ar) || "—",
      dueTone: "ok",
      statusKind: stageKind(access.stage),
      statusLabel: ar ? STAGE_LABEL[access.stage]?.ar : STAGE_LABEL[access.stage]?.en,
      before: !!p.beforeUrl,
      after: !!p.afterUrl,
      workers: workers.map((person) => person.name).filter(Boolean),
      progress: {
        done: photos,
        target: 2,
        extra: workers.length
          ? (ar ? `عمال ${workers.length}` : `${workers.length} workers`)
          : (photos === 2 ? (ar ? "بعد" : "After") : photos === 1 ? (ar ? "قبل" : "Before") : ""),
      },
      dotColor: stageDot(access.stage),
    };
  });

  const openProof = proofs.find((p) => String(p.id || p.ref) === String(openProofId)) || null;
  const openAccess = openProof ? proofAccess(openProof) : null;
  const openVehicles = openProof ? vehiclesFromProof(openProof) : [];
  const openHeatFlag = openProof ? heatBanFlagOf(openProof) : null;
  const openEnd = !!(openProof && ending && String(ending.id) === String(openProof.id || openProof.ref));

  return (
    <PlatformStampShell
      ar={ar}
      maxWidth={1280}
      kicker={pageKicker("/app/work-proof", lang)}
      title={ar ? "إثبات العمل" : "Work proof"}
      hint={ar
        ? "جهة خارج الشركة وعمالها — ليس أمر عمل لموظف، وليس إثبات زائر على الفرع."
        : "An outside company and its workers — not a task for an employee, and not a guest at the station."}
    >
      <OpsLaneTiles ar={ar} current="work-proof" />
      <ProofSurfaceNote ar={ar} current="work-proof" />

      {(raising || editingProof) && (
      <ComposerModalShell
        ar={ar}
        title={editingProof ? (ar ? "تعديل الإثبات" : "Edit proof") : (ar ? "إثبات عمل جديد" : "New work proof")}
        hint={editingProof
          ? (remainingEditLabel(editingProof, ar) || (ar ? "مهلة يوم واحد من الرفع." : "One day from the original raise."))
          : (ar ? "لجهة خارج الشركة — يصل للمشرف للاعتماد، ثم يُختم ويُرسل للجهة برابط تحقق." : "For an outside party — the supervisor approves, then it is sealed and sent with a verify link.")}
        onClose={cancelForm}
        onSubmit={editingProof ? saveEdit : raise}
        submitLabel={editingProof ? (ar ? "حفظ التعديل" : "Save edit") : (ar ? "حفظ الإثبات" : "Save proof")}
        busy={busy}
      >
        <WorkProofRaiseFields
          form={form}
          setForm={setForm}
          stations={stations}
          headerScope={headerScope}
          ar={ar}
          hidePhotos={!!editingProof}
          raiserName={editingProof?.raiserName || currentUser?.name || ""}
        />
      </ComposerModalShell>
      )}

      <OpsControlBar>
        <OpsToolbarStrip
          ar={ar}
          dir={ar ? "rtl" : "ltr"}
          filter={boardFilter}
          onFilterChange={(value) => setFilter(normalizeWorkProofFilter(value))}
          chips={filterChips}
          showCreate={raising || !!editingProof}
          onToggleCreate={() => {
            if (raising || editingProof) {
              cancelForm();
              return;
            }
            setEditingProof(null);
            resetForm();
            setRaising(true);
          }}
          createLabel={ar ? "إثبات جديد" : "New proof"}
        />
        {boardFilter !== "archive" ? (
          <OpsStripSearch
            value={query}
            onChange={setQuery}
            placeholder={ar ? "بحث في الإثباتات…" : "Search proofs…"}
          />
        ) : null}
      </OpsControlBar>

      {boardFilter === "archive" ? (
        <RecordSmartArchive
          items={archiveItems}
          lang={lang === "ar" ? "ar" : "en"}
          dir={ar ? "rtl" : "ltr"}
          emptyLabel={ar ? "لا إثباتات مؤرشفة بعد — المكتملة تُنقل إلى هنا تلقائياً بعد الإنهاء." : "No archived proofs yet — completed proofs move here automatically after they are ended."}
          onOpen={(item) => setOpenProofId(item.id)}
        />
      ) : (
        <ProofRecordsTable
          ar={ar}
          variant="work"
          rows={tableRows}
          heads={ar ? ["الإثبات", "الفرع", "المسؤول", "الحالة", "الصور"] : ["PROOF", "STATION", "OWNER", "STATUS", "PHOTOS"]}
          emptyLabel={ar ? "لا إثباتات بعد." : "No proofs yet."}
          onOpen={(row) => setOpenProofId(row.id)}
          renderActions={(row) => {
            const p = row.proof;
            const access = proofAccess(p);
            return (
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setOpenProofId(row.id)} style={ui.btnMiniSoft}>
                  {ar ? "بطاقة" : "Card"}
                </button>
                {access.canEdit ? (
                  <button type="button" onClick={() => startEdit(p)} style={ui.btnMini}>
                    {ar ? "تعديل" : "Edit"}
                  </button>
                ) : null}
                {access.canEnd ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenProofId(row.id);
                      setEnding({ id: p.id || p.ref, endedAt: localDateTimeValue(), afterFile: null });
                    }}
                    style={ui.btnMiniBrand}
                  >
                    {ar ? "إنهاء" : "End"}
                  </button>
                ) : null}
                {access.canFinishReady ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runAction(
                      () => workproof({ action: "approve", companyId: company.id, id: p.id, geoClearReason: geoReason || "إنهاء العمل" }),
                      approveLocalWorkProof,
                      p,
                      geoReason || "إنهاء العمل",
                    )}
                    style={ui.btnMiniBrand}
                  >
                    {ar ? "إنهاء" : "End"}
                  </button>
                ) : null}
              </div>
            );
          }}
        />
      )}

      {openProof && openAccess ? (
        <ComposerModalShell
          ar={ar}
          asForm={false}
          title={openProof.title || (ar ? "بطاقة الإثبات" : "Proof card")}
          hint={[openProof.ref, stationName(openProof.stationId)].filter(Boolean).join(" · ")}
          onClose={() => { setOpenProofId(null); setEnding(null); }}
          back={<SectionBackLink ar={ar} label={ar ? "إثبات العمل" : "Work proof"} onClick={() => { setOpenProofId(null); setEnding(null); }} />}
          footer={(
            <div className="flex flex-wrap gap-2">
              {openAccess.canEdit && !openEnd ? (
                <button type="button" onClick={() => startEdit(openProof)} style={ui.btnMini}>
                  {ar ? "تعديل" : "Edit"}
                </button>
              ) : null}
              {openAccess.canEnd && !openEnd ? (
                <button
                  type="button"
                  onClick={() => setEnding({ id: openProof.id || openProof.ref, endedAt: localDateTimeValue(), afterFile: null })}
                  style={ui.btnMiniBrand}
                >
                  {ar ? "إنهاء" : "End"}
                </button>
              ) : null}
              {openEnd ? (
                <>
                  <button type="button" disabled={busy} onClick={() => endWork(openProof)} style={ui.btnMiniBrand}>
                    {ar ? "تأكيد الإنهاء" : "Confirm end"}
                  </button>
                  <button type="button" onClick={() => setEnding(null)} style={ui.btnMiniQuiet}>
                    {ar ? "إلغاء" : "Cancel"}
                  </button>
                </>
              ) : null}
              {openAccess.canFinishReady && !openEnd ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => runAction(
                    () => workproof({ action: "approve", companyId: company.id, id: openProof.id, geoClearReason: geoReason || "إنهاء العمل" }),
                    approveLocalWorkProof,
                    openProof,
                    geoReason || "إنهاء العمل",
                  )}
                  style={ui.btnMiniBrand}
                >
                  {ar ? "إنهاء" : "End"}
                </button>
              ) : null}
            </div>
          )}
        >
          {openHeatFlag ? (
            <OpsTaskSection
              title={ar ? "مخالفة حظر العمل تحت أشعة الشمس" : "Sun-ban breach"}
              tone="bad"
              aside={(
                <span dir="ltr" style={{ fontSize: 11, fontWeight: 650, color: "var(--nv-bad-ink)", fontFamily: "'IBM Plex Sans',sans-serif" }}>
                  {`${openHeatFlag.minutes} ${ar ? "د" : "min"}`}
                </span>
              )}
            >
              <span style={{ fontSize: 12, color: "var(--nv-bad-ink)", lineHeight: 1.8 }}>
                {ar ? openHeatFlag.textAr : openHeatFlag.textEn}
              </span>
              <LaborArticleCite cite={openHeatFlag.cite} ar={ar} showText showOfficial tone="block" />
            </OpsTaskSection>
          ) : null}

          <OpsTaskSection title={ar ? "الإسناد" : "Assignment"}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <ReadField label={ar ? "الفرع" : "Station"}>{stationName(openProof.stationId)}</ReadField>
              <ReadField label={ar ? "المسؤول" : "Owner"}>{openProof.entityName || (ar ? "جهة خارجية" : "Outside company")}</ReadField>
              <ReadField label={ar ? "أنشأها" : "Created by"}>{openProof.raiserName || "—"}</ReadField>
              {openProof.editedBy ? (
                <ReadField label={ar ? "آخر تعديل" : "Last edited by"}>{openProof.editedBy}</ReadField>
              ) : null}
              {openProof.endedBy ? (
                <ReadField label={ar ? "أغلقها" : "Closed by"}>{openProof.endedBy}</ReadField>
              ) : null}
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <ReadField label={ar ? "النطاق" : "Scope"}>
                {openProof.entityKind === "individual" ? (ar ? "مؤسسة فردية" : "Individual") : (ar ? "جهة خارجية" : "Outside company")}
              </ReadField>
              <ReadField label={ar ? "موقع التنفيذ" : "Work site"}>{openProof.entitySite || "—"}</ReadField>
            </div>
            {(openProof.entityUnified || openProof.entityCr || openProof.entityQiwa || openProof.entityProject || openProof.entityContact || openProof.entityPhone) ? (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {openProof.entityUnified ? <ReadField label={ar ? "الرقم الموحد" : "Unified no."} ltr>{openProof.entityUnified}</ReadField> : null}
                {openProof.entityCr ? <ReadField label={ar ? "السجل التجاري" : "CR"} ltr>{openProof.entityCr}</ReadField> : null}
                {openProof.entityQiwa ? <ReadField label={ar ? "قوى" : "Qiwa"} ltr>{openProof.entityQiwa}</ReadField> : null}
                {openProof.entityProject ? <ReadField label={ar ? "العقد / أمر العمل" : "Contract"}>{openProof.entityProject}</ReadField> : null}
                {openProof.entityContact ? <ReadField label={ar ? "التواصل" : "Contact"}>{openProof.entityContact}</ReadField> : null}
                {openProof.entityPhone ? <ReadField label={ar ? "جوال المسؤول" : "Contact phone"} ltr>{openProof.entityPhone}</ReadField> : null}
              </div>
            ) : null}
          </OpsTaskSection>

          <OpsTaskSection title={ar ? "العمل" : "Work"}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <ReadField label={ar ? "سبب العمل" : "Work reason"} multiline>{openProof.workReason}</ReadField>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <ReadField label={ar ? "الفترة" : "Period"} multiline>
                {workPeriodLabel(openProof.startedAt, openProof.endedAt, ar) || formatProofDateTime(openProof.startedAt || openProof.createdAt, ar) || "—"}
              </ReadField>
              {workSpanLabel(openProof.startedAt, openProof.endedAt, ar) ? (
                <ReadField label={ar ? "المدة" : "Duration"}>{workSpanLabel(openProof.startedAt, openProof.endedAt, ar)}</ReadField>
              ) : null}
              <ReadField label={ar ? "مكان التنفيذ" : "Where the work happened"}>
                {openProof.place ? proofPlaceLabel(openProof.place, ar ? "ar" : "en") : "—"}
              </ReadField>
              <ReadField label={ar ? "الموقع" : "Location"}>
                {openProof.geoVerdict === "out" ? (ar ? "خارج النطاق" : "Outside geofence") : (ar ? "داخل النطاق" : "Inside geofence")}
              </ReadField>
              {openAccess.canEdit && remainingEditLabel(openProof, ar) ? (
                <ReadField label={ar ? "التعديل" : "Edit"}>{remainingEditLabel(openProof, ar)}</ReadField>
              ) : null}
              {openProof.sealId ? (
                <ReadField label={ar ? "الختم" : "Seal"} ltr>{openProof.sealId}</ReadField>
              ) : null}
            </div>
            <div style={{ display: "flex", height: 140, flexShrink: 0, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
              {[
                [openProof.beforeUrl, photoStamp(openProof.beforeStamp, openProof.startedAt, ar), ar ? "قبل" : "BEFORE"],
                [openProof.afterUrl, photoStamp(openProof.afterStamp, openProof.endedAt, ar), ar ? "بعد" : "AFTER"],
              ].map(([url, stamp, tag], idx) => (
                <div
                  key={tag}
                  style={{
                    flex: 1,
                    background: url ? `center / cover no-repeat url(${url})` : SURFACE,
                    borderInlineEnd: idx === 0 ? `1px solid ${BORDER}` : "none",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    padding: 8,
                    gap: 4,
                  }}
                >
                  <span style={{ fontSize: 10, fontWeight: 600, color: NAVY, background: "rgba(255,255,255,.9)", padding: "2px 7px", borderRadius: 999 }}>{tag}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: NAVY, background: "rgba(255,255,255,.9)", padding: "2px 7px", borderRadius: 999 }}>{stamp || "—"}</span>
                </div>
              ))}
            </div>
          </OpsTaskSection>

          {openAccess.workers.length ? (
            <OpsTaskSection title={ar ? "عمال الجهة الخارجية" : "External workers"} count={openAccess.workers.length}>
              {openAccess.workers.map((person, index) => (
                <div
                  key={`${person.id || person.name}-${index}`}
                  style={{ padding: 12, borderRadius: 12, border: "1px solid var(--nv-line, #E2E8F0)", background: CARD }}
                >
                  <div style={{ fontSize: 12, fontWeight: 650, color: MUTED, marginBottom: 10 }}>
                    {ar ? `عامل ${index + 1}` : `Worker ${index + 1}`}
                  </div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <ReadField label={ar ? "الاسم" : "Name"}>{person.name}</ReadField>
                    <ReadField label={ar ? "الجنسية" : "Nationality"}>{person.nationality}</ReadField>
                    <ReadField label={ar ? "نوع الهوية" : "ID type"}>{visitorIdTypeLabel(person.idType, ar)}</ReadField>
                    <ReadField label={ar ? "رقم الهوية / الإقامة" : "ID / Iqama"} ltr>{person.id}</ReadField>
                    {person.phone ? <ReadField label={ar ? "الجوال" : "Phone"} ltr>{person.phone}</ReadField> : null}
                    <ReadField label={ar ? "المسمى" : "Title"}>{person.title}</ReadField>
                  </div>
                </div>
              ))}
            </OpsTaskSection>
          ) : null}

          {openVehicles.length ? (
            <OpsTaskSection title={ar ? "السيارات" : "Vehicles"} count={openVehicles.length}>
              {openVehicles.map((vehicle, index) => (
                <div
                  key={`${vehicle.plate || vehicle.plateNumbers || vehicle.maker || index}`}
                  style={{ padding: 12, borderRadius: 12, border: "1px solid var(--nv-line, #E2E8F0)", background: CARD }}
                >
                  <div style={{ fontSize: 12, fontWeight: 650, color: MUTED, marginBottom: 10 }}>
                    {ar ? `سيارة ${index + 1}` : `Vehicle ${index + 1}`}
                  </div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {vehicle.maker ? <ReadField label={ar ? "الشركة المصنعة" : "Maker"}>{vehicle.maker}</ReadField> : null}
                    {vehicle.model ? <ReadField label={ar ? "الموديل" : "Model"}>{vehicle.model}</ReadField> : null}
                    {vehicle.type ? <ReadField label={ar ? "نوع السيارة" : "Type"}>{vehicle.type}</ReadField> : null}
                    {vehicle.year ? <ReadField label={ar ? "سنة الصنع" : "Year"} ltr>{vehicle.year}</ReadField> : null}
                    {vehicle.plateLetters ? <ReadField label={ar ? "حروف اللوحة" : "Plate letters"}>{vehicle.plateLetters}</ReadField> : null}
                    {(vehicle.plateNumbers || vehicle.plate) ? (
                      <ReadField label={ar ? "أرقام اللوحة" : "Plate numbers"} ltr>{vehicle.plateNumbers || vehicle.plate}</ReadField>
                    ) : null}
                  </div>
                </div>
              ))}
            </OpsTaskSection>
          ) : null}

          <ProofAttachments
            attachments={openProof.attachments}
            ar={ar}
            busy={busy}
            canEdit={!!openAccess.canAttach}
            onAdd={(file) => attachWorkDoc(openProof, file)}
            onReplace={(id, file) => attachWorkDoc(openProof, file, id)}
          />
          <ProofAuditTimeline proof={openProof} ar={ar} />
          {openEnd ? (
            <OpsTaskSection title={ar ? "إنهاء العمل" : "End work"} tone="ok">
              <PlatformDateField
                ar={ar}
                value={dateTimeDateKey(ending.endedAt)}
                onChange={(next) => setEnding({ ...ending, endedAt: spliceDateIntoDateTime(ending.endedAt, next) })}
              />
              <label style={{ ...field, display: "flex", alignItems: "center", height: "auto", minHeight: 38, cursor: "pointer" }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEnding({ ...ending, afterFile: e.target.files?.[0] || null })}
                  style={{ display: "none" }}
                />
                {ending.afterFile?.name || (ar ? "صورة البعد" : "After photo")}
              </label>
            </OpsTaskSection>
          ) : null}
        </ComposerModalShell>
      ) : null}
    </PlatformStampShell>
  );
}
