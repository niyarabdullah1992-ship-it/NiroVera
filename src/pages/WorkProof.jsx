import React, { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/PowerCareAuth";
import { useI18n } from "@/lib/i18n";
import { checkEditWorkProofGate, deriveProofCounts, deriveProofStage, isSameProofBranch, proofEditDeadline } from "@/lib/workProofDerivations";
import {
  approveLocalWorkProof,
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
  cardShell,
  emptyState,
  BAD,
  OK,
  WARN,
  pill,
  ui,
  field,
} from "@/lib/platformStyles";
import useStationScope, { matchesStationScope } from "@/hooks/useStationScope";
import PlatformStampShell from "@/components/shared/PlatformStampShell";
import { Archive, Clock, LayoutList, Search, ShieldCheck } from "lucide-react";
import RecordSmartArchive from "@/components/shared/RecordSmartArchive";
import PlatformDateField from "@/components/shared/PlatformDateField";
import WorkProofRaiseFields, {
  EMPTY_VEHICLE,
  dateTimeDateKey,
  formatProofDateTime,
  proofEntityPlaceLabel,
  proofPersonLabel,
  proofVehicleText,
  spliceDateIntoDateTime,
  workDurationLabel,
  workProofEntityFields,
} from "@/components/proof/WorkProofRaiseFields";
import { peopleFromProof, vehiclesFromProof, workProofCrewFields } from "@/lib/workProofCrew";

async function workproof(payload) {
  const res = await base44.functions.invoke("workproof", payload);
  return res?.data ?? res;
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

const STAGE_PILL = {
  await: WARN,
  ready: pill("#EFF6FF", "#1D4ED8", "#BFDBFE"),
  sealed: OK,
  accepted: OK,
  rejected: BAD,
};

export default function WorkProof() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { company, data, currentUser } = useAuth();
  const headerScope = useStationScope();
  const stations = data?.stations || [];
  const defaultStation = headerScope !== "all" ? headerScope : (stations[0]?.id || "");

  const [proofs, setProofs] = useState([]);
  const [filter, setFilter] = useState("all");
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
    personName: currentUser?.name || "",
    personId: "",
    personTitle: currentUser?.position || "",
    personPhone: currentUser?.phone || "",
    people: peopleFromProof(null, currentUser),
    startedAt: localDateTimeValue(),
    endedAt: "",
    vehicle: { ...EMPTY_VEHICLE },
    vehicles: vehiclesFromProof(null),
    client: "",
    stationId: defaultStation,
    geoVerdict: "in",
    beforeFile: null,
    afterFile: null,
  });
  const [geoReason, setGeoReason] = useState("");
  const [ending, setEnding] = useState(null);
  const [editingProof, setEditingProof] = useState(null);

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
      if (Array.isArray(remote?.proofs)) applyBoard(remote);
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
    const entity = workProofEntityFields(form, stations);
    if (!entity.ok) {
      toast({ description: ar ? entity.errorAr : entity.errorEn, variant: "destructive" });
      return;
    }
    const crew = workProofCrewFields(form);
    if (!crew.ok) {
      toast({ description: ar ? crew.errorAr : crew.errorEn, variant: "destructive" });
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
      geoVerdict: form.geoVerdict,
      beforeStamp: stampNow(Number.isNaN(startDate.getTime()) ? new Date() : startDate),
      beforeUrl: await readImage(form.beforeFile),
    };
    try {
      let remote = null;
      try {
        remote = await workproof({ action: "raise", companyId: company.id, ...payload });
      } catch {
        remote = null;
      }
      const result = remote?.ok
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
      const result = remote?.ok || remote?.proof
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
      personName: currentUser?.name || f.personName,
      personId: "",
      personTitle: currentUser?.position || "",
      personPhone: currentUser?.phone || f.personPhone,
      people: peopleFromProof(null, currentUser),
      startedAt: localDateTimeValue(),
      endedAt: "",
      vehicle: { ...EMPTY_VEHICLE },
      vehicles: vehiclesFromProof(null),
      client: "",
      stationId: defaultStation,
      geoVerdict: "in",
      beforeFile: null,
      afterFile: null,
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
    setEditingProof(proof);
    setForm((f) => ({
      ...f,
      title: proof.title || "",
      workReason: proof.workReason || "",
      entityScope: proof.entityScope === "internal" || proof.entityKind === "branch" ? "internal" : "external",
      entityStationId: proof.entityStationId || "",
      entityKind: proof.entityKind || "company",
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
      geoVerdict: proof.geoVerdict === "out" ? "out" : "in",
      beforeFile: null,
      afterFile: null,
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
    const entity = workProofEntityFields(form, stations);
    if (!entity.ok) {
      toast({ description: ar ? entity.errorAr : entity.errorEn, variant: "destructive" });
      return;
    }
    const crew = workProofCrewFields(form);
    if (!crew.ok) {
      toast({ description: ar ? crew.errorAr : crew.errorEn, variant: "destructive" });
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
      const result = remote?.ok
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
      const result = remote?.ok
        ? remote
        : endLocalWorkProof(company.id, proof, currentUser, payload);
      if (result?.error) {
        toast({ description: ar ? (result.reason || result.error) : (result.reasonEn || result.reason || result.error), variant: "destructive" });
      } else {
        toast({ description: ar ? "أُنهي العمل." : "Work ended." });
        setEnding(null);
        load();
      }
    } finally {
      setBusy(false);
    }
  };

  const scopedProofs = proofs.filter((p) => matchesStationScope(p.stationId, headerScope, data?.stations));
  const scopedCounts = useMemo(() => deriveProofCounts(scopedProofs), [scopedProofs]);
  const stationName = (id) => stations.find((s) => String(s.id) === String(id))?.name || id || "—";
  const archiveProofs = scopedProofs.filter((p) => {
    const stage = p.stage || deriveProofStage(p);
    return stage === "sealed" || stage === "accepted" || stage === "rejected";
  });
  const matchesQuery = (p) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const hay = [
      p.title, p.workReason, p.ref, p.sealId,
      proofPersonLabel(p), proofEntityPlaceLabel(p, stationName, ar),
      proofVehicleText(p), p.client,
    ].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  };
  const visible = scopedProofs.filter((p) => {
    if (filter === "archive") return false;
    const stage = p.stage || deriveProofStage(p);
    if (filter !== "all" && stage !== filter) return false;
    return matchesQuery(p);
  });
  const archiveItems = archiveProofs.filter(matchesQuery).map((p) => ({
    id: p.id || p.ref,
    title: p.title || p.ref || "—",
    text: [proofEntityPlaceLabel(p, stationName, ar), proofPersonLabel(p), proofVehicleText(p)].filter(Boolean).join(" · "),
    date: p.endedAt || p.createdAt || p.startedAt,
    badge: ar ? (STAGE_LABEL[p.stage || deriveProofStage(p)]?.ar) : (STAGE_LABEL[p.stage || deriveProofStage(p)]?.en),
  }));
  const tabKeys = [
    ["all", scopedProofs.length, ar ? "الكل" : "All", LayoutList],
    ["await", scopedCounts.await, ar ? "بانتظار" : "Awaiting", Clock],
    ["sealed", scopedCounts.sealed, ar ? "مكتمل" : "Completed", ShieldCheck],
    ["archive", archiveProofs.length, ar ? "الأرشيف" : "Archive", Archive],
  ];

  return (
    <PlatformStampShell
      ar={ar}
      title={ar ? "إثبات العمل الميداني" : "Field work proof"}
      hint={ar
        ? "ابدأ العمل بصورة قبل. عدّل خلال يوم إن لزم. عند الانتهاء اضغط إنهاء وارفع صورة البعد."
        : "Start with a before photo. Edit within a day if needed. End with the after photo."}
      sections={tabKeys.map(([value, count, label, icon]) => ({ value, label, icon, count }))}
      tool={filter === "archive" ? "archive" : (filter === "all" || filter === "await" || filter === "sealed" ? filter : "all")}
      onTool={setFilter}
      meta={(
        <div style={{ display: "flex", width: "100%", alignItems: "center" }}>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            onClick={() => {
              if (raising || editingProof) {
                cancelForm();
                return;
              }
              setEditingProof(null);
              resetForm();
              setRaising(true);
            }}
            style={raising || editingProof ? ui.btnCreateQuiet : ui.btnCreate}
          >
            {raising || editingProof
              ? (ar ? "إخفاء النموذج" : "Hide form")
              : (ar ? "بدء عمل جديد" : "Start new work")}
          </button>
        </div>
      )}
    >

      {(raising || editingProof) && (
      <form
        id="wp-raise-form"
        onSubmit={editingProof ? saveEdit : raise}
        style={{ ...cardShell, padding: "16px 18px 14px" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>
              {editingProof ? (ar ? "تعديل الإثبات" : "Edit proof") : (ar ? "بدء العمل" : "Start work")}
            </div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>
              {editingProof
                ? (remainingEditLabel(editingProof, ar) || (ar ? "مهلة يوم واحد من الرفع." : "One day from the original raise."))
                : (ar ? "البيانات وصورة قبل الآن — الإنهاء وصورة البعد لاحقًا. التعديل متاح ليوم واحد." : "Details and before photo now — end later. Editable for one day.")}
            </div>
          </div>
          <button
            type="button"
            onClick={cancelForm}
            style={{ ...ui.btnSecondary, height: 34 }}
          >
            {ar ? "إلغاء" : "Cancel"}
          </button>
        </div>
        <WorkProofRaiseFields
          form={form}
          setForm={setForm}
          stations={stations}
          headerScope={headerScope}
          ar={ar}
          hidePhotos={!!editingProof}
        />

        <button type="submit" disabled={busy} style={{ ...ui.btnPrimary, marginTop: 14, display: "inline-flex", alignItems: "center", gap: 8, opacity: busy ? 0.55 : 1 }}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {editingProof ? (ar ? "حفظ التعديل" : "Save edit") : (ar ? "ابدأ العمل" : "Start work")}
        </button>
      </form>
      )}

      <div style={{ position: "relative" }}>
        <Search
          style={{
            position: "absolute",
            top: "50%",
            transform: "translateY(-50%)",
            [ar ? "right" : "left"]: 12,
            width: 14,
            height: 14,
            color: MUTED,
            pointerEvents: "none",
          }}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={ar ? "بحث في الإثباتات…" : "Search proofs…"}
          style={{ ...field, [ar ? "paddingRight" : "paddingLeft"]: 32 }}
        />
      </div>

      {filter === "archive" ? (
        <RecordSmartArchive
          items={archiveItems}
          lang={lang === "ar" ? "ar" : "en"}
          dir={ar ? "rtl" : "ltr"}
          emptyLabel={ar ? "لا إثباتات مؤرشفة في هذا النطاق." : "No archived proofs in this scope."}
        />
      ) : visible.length === 0 ? (
        <div style={emptyState}>
          {ar ? "لا إثباتات بعد — اضغط «بدء عمل جديد» للبدء." : "No proofs yet — tap “Start new work” to begin."}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {visible.map((p) => {
            const stage = p.stage || deriveProofStage(p);
            const isRaiser = !!(currentUser?.id && p.raiserId && String(currentUser.id) === String(p.raiserId));
            const sameBranch = sameBranchOf(p);
            const canEnd = stage === "await" && (isRaiser || sameBranch || isManager);
            const canEdit = checkEditWorkProofGate({
              proof: p,
              actorUserId: currentUser?.id,
              sameBranch,
              isManager,
            }).ok;
            const canFinishReady = stage === "ready" && (isRaiser || sameBranch || isManager);
            const openEnd = ending?.id === (p.id || p.ref);
            return (
              <div key={p.id || p.ref} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden" }}>
                <div style={{ display: "flex", height: 120, borderBottom: `1px solid ${BORDER}` }}>
                  {[
                    [p.beforeUrl, photoStamp(p.beforeStamp, p.startedAt, ar), ar ? "قبل" : "BEFORE"],
                    [p.afterUrl, photoStamp(p.afterStamp, p.endedAt, ar), ar ? "بعد" : "AFTER"],
                  ].map(([url, stamp, tag], idx) => (
                    <div
                      key={tag}
                      style={{
                        flex: 1,
                        position: "relative",
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
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{p.title}</div>
                      {p.workReason ? (
                        <div style={{ fontSize: 11, color: NAVY, marginTop: 4 }}>
                          {ar ? "السبب:" : "Reason:"} {p.workReason}
                        </div>
                      ) : null}
                      <div dir="ltr" style={{ fontSize: 12, fontWeight: 600, color: NAVY, marginTop: 6 }}>
                        {workDurationLabel(p.startedAt, p.endedAt, ar) || formatProofDateTime(p.createdAt, ar) || "—"}
                      </div>
                      <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                        {[
                          proofEntityPlaceLabel(p, stationName, ar),
                          proofPersonLabel(p),
                          proofVehicleText(p),
                          stationName(p.stationId),
                        ].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <span style={STAGE_PILL[stage] || pill("#F7F8FA", MUTED, "#E2E8F0")}>
                      {ar ? STAGE_LABEL[stage]?.ar : STAGE_LABEL[stage]?.en}
                    </span>
                  </div>
                  <div style={{ marginTop: 10, fontSize: 11, color: MUTED }}>
                    {p.geoVerdict === "out" ? (ar ? "خارج النطاق" : "Outside geofence") : (ar ? "داخل النطاق" : "Inside geofence")}
                    {p.endedBy ? ` · ${ar ? "أنهاه" : "ended by"} ${p.endedBy}` : ""}
                    {canEdit ? ` · ${remainingEditLabel(p, ar)}` : ""}
                    {p.sealId ? ` · ${p.sealId}` : ""}
                  </div>
                  {stage === "ready" && (
                    <div style={{ marginTop: 8, fontSize: 11, color: MUTED }}>
                      {ar ? "اضغط إنهاء لإغلاق هذا الإثبات." : "Tap End to close this proof."}
                    </div>
                  )}
                  {openEnd && (
                    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
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
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    {canEdit && !openEnd && (
                      <button type="button" onClick={() => startEdit(p)} style={ui.btnSecondary}>
                        {ar ? "تعديل" : "Edit"}
                      </button>
                    )}
                    {canEnd && !openEnd && (
                      <button
                        type="button"
                        onClick={() => setEnding({ id: p.id || p.ref, endedAt: localDateTimeValue(), afterFile: null })}
                        style={ui.btnPrimary}
                      >
                        {ar ? "إنهاء" : "End"}
                      </button>
                    )}
                    {openEnd && (
                      <>
                        <button type="button" disabled={busy} onClick={() => endWork(p)} style={ui.btnPrimary}>
                          {ar ? "تأكيد الإنهاء" : "Confirm end"}
                        </button>
                        <button type="button" onClick={() => setEnding(null)} style={ui.btnSecondary}>
                          {ar ? "إلغاء" : "Cancel"}
                        </button>
                      </>
                    )}
                    {canFinishReady && !openEnd && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runAction(
                          () => workproof({ action: "approve", companyId: company.id, id: p.id, geoClearReason: geoReason || "إنهاء العمل" }),
                          approveLocalWorkProof,
                          p,
                          geoReason || "إنهاء العمل",
                        )}
                        style={ui.btnPrimary}
                      >
                        {ar ? "إنهاء" : "End"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PlatformStampShell>
  );
}
