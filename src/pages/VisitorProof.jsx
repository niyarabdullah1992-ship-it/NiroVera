import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/PowerCareAuth";
import { useI18n } from "@/lib/i18n";
import {
  closeLocalVisitorProof,
  listLocalVisitorProofs,
  raiseLocalVisitorProof,
  attachLocalVisitorProof,
} from "@/lib/localVisitorProofFallback";
import { getCompanyData } from "@/lib/store";
import { toast } from "@/components/ui/use-toast";
import {
  MUTED,
  field,
  ui,
} from "@/lib/platformStyles";
import useStationScope, { matchesStationScope } from "@/hooks/useStationScope";
import PlatformStampShell from "@/components/shared/PlatformStampShell";
import { pageKicker } from "@/lib/moduleMeta";
import ComposerModalShell from "@/components/shared/ComposerModalShell";
import { Archive, Search, Users } from "lucide-react";
import RecordSmartArchive from "@/components/shared/RecordSmartArchive";
import VisitorProofFields from "@/components/proof/VisitorProofFields";
import VisitorProofCard from "@/components/proof/VisitorProofCard";
import ProofSurfaceNote from "@/components/proof/ProofSurfaceNote";
import ProofRecordsTable from "@/components/proof/ProofRecordsTable";
import { EMPTY_PERSON, EMPTY_VEHICLE } from "@/lib/workProofCrew";
import { proofVehicleText } from "@/components/proof/WorkProofRaiseFields";
import { readProofFile, readProofFiles } from "@/lib/proofAttachments";
import {
  checkCloseVisitorProofGate,
  deriveVisitorProofStage,
  todayVisitDateKey,
  visitDateKey,
  visitPeriodLabel,
  visitorPeopleLabel,
  visitorProofFields,
} from "@/lib/visitorProof";
import { isSameProofBranch } from "@/lib/workProofDerivations";

const STAGE_LABEL = {
  on_site: { ar: "في الفرع", en: "On site" },
  left: { ar: "غادر", en: "Left" },
};

function visitorDueTone(proof, stage) {
  const to = visitDateKey(proof?.visitTo || proof?.visitFrom);
  if (!to || stage === "left") return "ok";
  const today = todayVisitDateKey();
  if (to < today) return "late";
  if (to === today) return "today";
  return "ok";
}

export default function VisitorProof() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { company, data, currentUser } = useAuth();
  const headerScope = useStationScope();
  const stations = data?.stations || [];
  const scopedStationId = headerScope !== "all" ? String(headerScope || "") : "";
  const blankVisitForm = () => ({
    visitReason: "",
    stationId: scopedStationId,
    stationIds: scopedStationId ? [scopedStationId] : [],
    hostId: "",
    hostName: "",
    people: [{ ...EMPTY_PERSON }],
    vehicles: [{ ...EMPTY_VEHICLE }],
    visitFrom: todayVisitDateKey(),
    visitTo: todayVisitDateKey(),
    files: [],
  });

  const [proofs, setProofs] = useState([]);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [raising, setRaising] = useState(false);
  const [busy, setBusy] = useState(false);
  const [openProofId, setOpenProofId] = useState(null);
  const [form, setForm] = useState(blankVisitForm);

  const isManager = !!(currentUser && (
    ["owner", "director", "ops_manager", "station_manager", "pgm", "admin"].includes(currentUser.role)
    || data?.ownerId === currentUser?.id
  ));

  const load = () => {
    if (!company?.id) return;
    const board = listLocalVisitorProofs(getCompanyData(company.id) || data);
    setProofs(board.proofs || []);
  };

  useEffect(() => { load(); }, [company?.id]);
  useEffect(() => {
    if (!scopedStationId) return;
    setForm((f) => ({ ...f, stationId: scopedStationId, stationIds: [scopedStationId] }));
  }, [scopedStationId]);

  const resetForm = () => setForm(blankVisitForm());

  const stationName = (id) => stations.find((item) => String(item.id) === String(id))?.name || "";

  const raise = async (event) => {
    event.preventDefault();
    if (!company?.id) return;
    const parsed = visitorProofFields(form);
    if (!parsed.ok) {
      toast({ description: ar ? parsed.errorAr : parsed.errorEn, variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const attachments = await readProofFiles(form.files);
      const result = raiseLocalVisitorProof(company.id, { ...parsed.fields, attachments }, currentUser);
      if (result?.ok) {
        const count = Array.isArray(result.proofs) ? result.proofs.length : 1;
        toast({
          description: ar
            ? (count > 1 ? `سُجّل إثبات الزائر على ${count} فروع.` : "سُجّل إثبات الزائر.")
            : (count > 1 ? `Visitor proof recorded on ${count} stations.` : "Visitor proof recorded."),
        });
        resetForm();
        setRaising(false);
        load();
      } else {
        toast({ description: ar ? (result?.reason || result?.error) : (result?.reasonEn || result?.reason || result?.error), variant: "destructive" });
      }
    } finally {
      setBusy(false);
    }
  };

  const sameBranchOf = (proof) => isSameProofBranch(currentUser?.stationId, proof.stationId)
    || (currentUser?.managedStations || []).map(String).includes(String(proof.stationId))
    || (headerScope !== "all" && String(headerScope) === String(proof.stationId));

  const closeVisit = (proof) => {
    const gate = checkCloseVisitorProofGate({
      proof,
      actorUserId: currentUser?.id,
      sameBranch: sameBranchOf(proof),
      isManager,
    });
    if (!gate.ok) {
      toast({ description: ar ? gate.errorAr : gate.errorEn, variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const result = closeLocalVisitorProof(company.id, proof, currentUser, {
        sameBranch: sameBranchOf(proof),
        isManager,
      });
      if (result?.error) {
        toast({ description: ar ? (result.reason || result.error) : (result.reasonEn || result.reason || result.error), variant: "destructive" });
      } else {
        setOpenProofId(null);
        load();
      }
    } finally {
      setBusy(false);
    }
  };

  const attachVisitDoc = async (proof, file, replaceId = null) => {
    if (!proof || !file) return;
    setBusy(true);
    try {
      const entry = await readProofFile(file);
      const result = attachLocalVisitorProof(company.id, proof, entry, { replaceId });
      if (result?.error) {
        toast({ description: ar ? (result.reason || result.error) : (result.reasonEn || result.reason || result.error), variant: "destructive" });
      } else {
        load();
      }
    } finally {
      setBusy(false);
    }
  };

  const scopedProofs = proofs.filter((p) => matchesStationScope(p.stationId, headerScope, stations));
  const liveProofs = scopedProofs.filter((p) => deriveVisitorProofStage(p) !== "left");
  const archiveProofs = scopedProofs.filter((p) => deriveVisitorProofStage(p) === "left");
  const matchesQuery = (p) => {
    const hay = [
      p.ref, p.title, p.visitReason, p.hostName, p.personName, p.visitFrom, p.visitTo,
      visitPeriodLabel(p, ar), visitorPeopleLabel(p, ar), proofVehicleText(p), stationName(p.stationId),
    ].join(" ").toLowerCase();
    return hay.includes(query.trim().toLowerCase());
  };
  const visible = liveProofs.filter(matchesQuery);
  const archiveItems = archiveProofs.filter(matchesQuery).map((p) => {
    const n = (Array.isArray(p.people) ? p.people : []).filter((person) => person?.name).length;
    return {
      id: p.id || p.ref,
      title: p.title || p.ref || "—",
      text: [
        p.raiserName ? (ar ? `أنشأها ${p.raiserName}` : `Created by ${p.raiserName}`) : "",
        n > 1 ? (ar ? "عدة زوار" : "Several visitors") : (ar ? "زائر" : "Visitor"),
        visitPeriodLabel(p, ar),
        p.visitReason,
        visitorPeopleLabel(p, ar),
        proofVehicleText(p),
        stationName(p.stationId),
      ].filter(Boolean).join(" · "),
      date: p.leftAt || p.createdAt || p.arrivedAt,
      badge: ar ? STAGE_LABEL.left.ar : STAGE_LABEL.left.en,
    };
  });
  const tabKeys = [
    ["all", liveProofs.length, ar ? "في الفرع" : "On site", Users],
    ["left", archiveProofs.length, ar ? "الأرشيف" : "Archive", Archive],
  ];

  const tableRows = visible.map((p) => {
    const stage = deriveVisitorProofStage(p);
    const people = Array.isArray(p.people) ? p.people.filter((person) => person?.name) : [];
    const first = people[0];
    const vehicles = proofVehicleText(p);
    return {
      id: p.id || p.ref,
      proof: p,
      title: p.title || first?.name || p.personName || (ar ? "إثبات زائر" : "Visitor proof"),
      ref: p.ref,
      meta: [
        ar ? "ضيف" : "Guest",
        p.visitReason,
        p.hostName ? (ar ? `مضيف · ${p.hostName}` : `Host · ${p.hostName}`) : "",
        vehicles,
      ].filter(Boolean),
      station: stationName(p.stationId),
      owner: people.length > 1
        ? (ar ? `زوار · ${people.length}` : `Visitors · ${people.length}`)
        : (first?.name || p.personName || "—"),
      scopeKind: people.length > 1 ? "group" : "person",
      scopeLabel: people.length > 1 ? (ar ? "عدة زوار" : "Several visitors") : (ar ? "زائر" : "Visitor"),
      creator: p.raiserName || (String(p.raiserId || "") === String(currentUser?.id || "") ? (currentUser?.name || "") : ""),
      due: visitPeriodLabel(p, ar) || "—",
      dueTone: visitorDueTone(p, stage),
      statusKind: stage === "left" ? "ok" : (visitorDueTone(p, stage) === "late" ? "bad" : "warn"),
      statusLabel: ar ? STAGE_LABEL[stage]?.ar : STAGE_LABEL[stage]?.en,
      progress: {
        done: people.length || 1,
        target: Math.max(people.length || 1, 1),
        extra: vehicles ? (ar ? "سيارات" : "Vehicles") : (ar ? "زوار" : "Visitors"),
      },
      dotColor: stage === "left" ? "#1E9E63" : (visitorDueTone(p, stage) === "late" ? "#DC2626" : "#F59E0B"),
    };
  });

  const openProof = proofs.find((p) => String(p.id || p.ref) === String(openProofId)) || null;
  const canCloseOpen = openProof
    ? checkCloseVisitorProofGate({
      proof: openProof,
      actorUserId: currentUser?.id,
      sameBranch: sameBranchOf(openProof),
      isManager,
    }).ok
    : false;

  return (
    <PlatformStampShell
      ar={ar}
      maxWidth={1280}
      kicker={pageKicker("/app/visitor-proof", lang)}
      title={ar ? "إثبات زائر" : "Visitor proof"}
      hint={ar
        ? "ضيف على الفرع — موظف الشركة الذي ينفّذ في فرع آخر يبقى على المهمة، والجهة الخارجية في إثبات العمل."
        : "A guest at the station — a company employee executing at another branch stays on the task; an outside company belongs on Work proof."}
      sections={tabKeys.map(([value, count, label, icon]) => ({ value, label, icon, count }))}
      tool={filter === "left" ? "left" : "all"}
      onTool={setFilter}
      meta={(
        <button
          type="button"
          onClick={() => {
            if (raising) {
              setRaising(false);
              return;
            }
            resetForm();
            setRaising(true);
          }}
          style={raising ? ui.btnCreateQuiet : ui.btnCreate}
        >
          {raising ? (ar ? "إخفاء النموذج" : "Hide form") : (ar ? "إثبات زائر جديد" : "New visitor proof")}
        </button>
      )}
    >
      <ProofSurfaceNote ar={ar} current="visitor-proof" />
      {raising && (
        <ComposerModalShell
          ar={ar}
          zIndex={110}
          dataNv="task"
          title={ar ? "إثبات زائر جديد" : "New visitor proof"}
          hint={ar
            ? "حدد الفترة والفروع — تُحفظ بطاقة في كل فرع مختار — ثم الزوّار والسيارات."
            : "Set the dates and stations — a card is saved on each chosen station — then visitors and vehicles."}
          onClose={() => setRaising(false)}
          onSubmit={raise}
          submitLabel={ar ? "حفظ الإثبات" : "Save proof"}
          busy={busy}
        >
          <VisitorProofFields
            form={form}
            setForm={setForm}
            stations={stations}
            headerScope={headerScope}
            ar={ar}
            employees={data?.employees || []}
          />
        </ComposerModalShell>
      )}

      {filter !== "left" && (query || scopedProofs.length > 0) ? (
        <div style={{ position: "relative" }}>
          <Search
            style={{
              position: "absolute",
              top: "50%",
              insetInlineStart: 12,
              transform: "translateY(-50%)",
              width: 14,
              height: 14,
              color: MUTED,
              pointerEvents: "none",
            }}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={ar ? "بحث في إثباتات الزائر…" : "Search visitor proofs…"}
            className="nv-search-field"
            style={{ ...field, padding: 0, paddingInlineStart: 36, paddingInlineEnd: 12 }}
          />
        </div>
      ) : null}

      {filter === "left" ? (
        <RecordSmartArchive
          items={archiveItems}
          lang={lang === "ar" ? "ar" : "en"}
          dir={ar ? "rtl" : "ltr"}
          emptyLabel={ar ? "لا إثباتات مغادرة في هذا النطاق." : "No departed visitor proofs in this scope."}
        />
      ) : (
        <ProofRecordsTable
          ar={ar}
          rows={tableRows}
          heads={ar ? ["الإثبات", "الفرع", "الزائر", "الحالة", "الزوار"] : ["PROOF", "STATION", "VISITOR", "STATUS", "VISITORS"]}
          emptyLabel={ar ? "لا إثباتات زائر بعد." : "No visitor proofs yet."}
          onOpen={(row) => setOpenProofId(row.id)}
          renderActions={(row) => {
            const p = row.proof;
            const canClose = checkCloseVisitorProofGate({
              proof: p,
              actorUserId: currentUser?.id,
              sameBranch: sameBranchOf(p),
              isManager,
            }).ok;
            return (
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setOpenProofId(row.id)} style={ui.btnMiniSoft}>
                  {ar ? "بطاقة" : "Card"}
                </button>
                {canClose ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => closeVisit(p)}
                    style={ui.btnMiniBrand}
                  >
                    {ar ? "مغادرة" : "Left"}
                  </button>
                ) : null}
              </div>
            );
          }}
        />
      )}

      {openProof ? (
        <VisitorProofCard
          proof={openProof}
          ar={ar}
          stationName={stationName(openProof.stationId)}
          busy={busy}
          canClose={canCloseOpen}
          canAttach={canCloseOpen}
          onClose={() => setOpenProofId(null)}
          onLeave={() => { closeVisit(openProof); setOpenProofId(null); }}
          onAddAttachment={(file) => attachVisitDoc(openProof, file)}
          onReplaceAttachment={(id, file) => attachVisitDoc(openProof, file, id)}
        />
      ) : null}
    </PlatformStampShell>
  );
}
