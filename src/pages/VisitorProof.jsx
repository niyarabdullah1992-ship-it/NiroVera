import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/PowerCareAuth";
import { useI18n } from "@/lib/i18n";
import {
  closeLocalVisitorProof,
  listLocalVisitorProofs,
  raiseLocalVisitorProof,
  attachLocalVisitorProof,
  addLocalVisitorPerson,
  markLocalVisitorPersonOut,
  extendLocalVisitorProof,
} from "@/lib/localVisitorProofFallback";
import { getCompanyData } from "@/lib/store";
import { toast } from "@/components/ui/use-toast";
import { ui } from "@/lib/platformStyles";
import useStationScope, { matchesStationScope } from "@/hooks/useStationScope";
import OpsFrame from "@/components/tasks/OpsFrame";
import OpsSideSlab from "@/components/tasks/OpsSideSlab";
import StatusFilterPills from "@/components/shared/StatusFilterPills";
import OpsMoreMenu from "@/components/tasks/OpsMoreMenu";
import { DetailHero, HeroFigure, HeroPill } from "@/components/tasks/detail/DetailKit";
import { cleanedPeople } from "@/lib/workProofCrew";
import { DutyTile, DutyNumber } from "@/components/schedules/DutyTiles";
import { formatUiNumber as formatNum } from "@/lib/dateFormat";
import { useRailSide } from "@/lib/railSide";
import { visitPassState } from "@/components/proof/VisitorPassCard";
import ComposerModalShell from "@/components/shared/ComposerModalShell";
import RecordSmartArchive from "@/components/shared/RecordSmartArchive";
import VisitorProofFields from "@/components/proof/VisitorProofFields";
import VisitorProofCard from "@/components/proof/VisitorProofCard";
import { OpsStripSearch } from "@/components/tasks/OpsToolbarStrip";
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
  const [focusStation, setFocusStation] = useState("");
  const [sideGuest, setSideGuest] = useState("");
  const [form, setForm] = useState(blankVisitForm);

  const railSide = useRailSide();
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

  const runPeople = (fn, okText) => {
    setBusy(true);
    try {
      const result = fn();
      if (result?.error) {
        toast({ description: ar ? (result.reason || result.error) : (result.reasonEn || result.reason || result.error), variant: "destructive" });
        return { ok: false };
      }
      if (okText) toast({ description: okText });
      load();
      return { ok: true };
    } finally {
      setBusy(false);
    }
  };
  const addVisitor = (proof, person) => runPeople(
    () => addLocalVisitorPerson(company.id, proof, person, currentUser),
    ar ? `سُجّل دخول ${person.name}.` : `${person.name} checked in.`,
  );
  const visitorOut = (proof, index) => runPeople(
    () => markLocalVisitorPersonOut(company.id, proof, index, currentUser),
    ar ? "سُجّل خروجه." : "Checked out.",
  );
  const extendVisit = (proof, input) => runPeople(
    () => extendLocalVisitorProof(company.id, proof, input, currentUser, todayVisitDateKey()),
    ar ? "مُدّد التصريح." : "Pass extended.",
  );

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
  const visitFace = filter === "left" ? "left" : filter === "today" || filter === "late" ? filter : "all";
  const visible = liveProofs.filter((p) => visitFace === "all" || visitorDueTone(p, deriveVisitorProofStage(p)) === visitFace).filter(matchesQuery);
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
      person: p.raiserName || "",
      branch: p.stationId ? stationName(p.stationId) : "",
      badge: ar ? STAGE_LABEL.left.ar : STAGE_LABEL.left.en,
    };
  });
  // «تصاريح الزوار» filter as in طلباتي: all on site, then what ends today, then what overran, الأرشيف last.
  const filterChips = [
    { id: "all", label: ar ? "الكل" : "All", n: liveProofs.length },
    { id: "today", label: ar ? "تنتهي اليوم" : "Ends today", n: liveProofs.filter((p) => visitorDueTone(p, deriveVisitorProofStage(p)) === "today").length },
    { id: "late", label: ar ? "تجاوزت موعدها" : "Overran", n: liveProofs.filter((p) => visitorDueTone(p, deriveVisitorProofStage(p)) === "late").length },
    { id: "left", label: ar ? "الأرشيف" : "Archive", n: archiveProofs.length },
  ];

  const tableRows = visible.filter((p) => !focusStation || String(p.stationId) === String(focusStation)).map((p) => {
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

  const employeeFace = railSide === "employee" || !isManager;
  const passStates = liveProofs.map((p) => visitPassState(p));
  const guestsNow = liveProofs.reduce((n, p, i) => {
    if (passStates[i].key === "upcoming") return n;
    const named = (Array.isArray(p.people) ? p.people : []).filter((person) => person?.name);
    return n + (named.length ? named.filter((person) => !person.outAt).length : 1);
  }, 0);
  const lastDay = passStates.filter((st) => st.key === "last").length;
  const overstay = passStates.filter((st) => st.key === "overstay").length;
  const vpTiles = [
    <DutyTile
      key="now"
      dataKey="vp-now"
      tone={guestsNow ? "ok" : "mute"}
      label={ar ? "في الفرع الآن" : "On site now"}
      note={ar ? `${formatNum(liveProofs.length)} تصريح مفتوح` : `${liveProofs.length} open passes`}
    >
      <DutyNumber value={formatNum(guestsNow)} unit={ar ? "زائر" : "guests"} />
    </DutyTile>,
    <DutyTile
      key="last"
      dataKey="vp-last"
      ar={ar}
      flag={ar ? "يغادر اليوم" : "Leaves today"}
      tone={lastDay ? "warn" : "mute"}
      label={ar ? "ينتهي تصريحه اليوم" : "Pass ends today"}
      note={ar ? "سجّل المغادرة عند الخروج" : "Record leaving on the way out"}
    >
      <DutyNumber value={formatNum(lastDay)} unit={ar ? "تصريح" : "passes"} />
    </DutyTile>,
    <DutyTile
      key="over"
      dataKey="vp-overstay"
      ar={ar}
      flag={ar ? "مغادرة غير مسجّلة" : "No exit recorded"}
      tone={overstay ? "bad" : "mute"}
      label={ar ? "تجاوز موعده" : "Past the date"}
      note={ar ? "انتهى التصريح ولم تُسجَّل مغادرة" : "Pass ended with no leaving recorded"}
    >
      <DutyNumber value={formatNum(overstay)} unit={ar ? "تصريح" : "passes"} />
    </DutyTile>,
  ];
  // ضيوف الفرع الآن: each guest still inside, by branch — the list a guard reads at the gate.
  const dmy = (key) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(key || ""));
    return m ? `${m[3]}/${m[2]}` : "";
  };
  const vpSide = (() => {
    const byStation = new Map();
    liveProofs.forEach((p, pi) => {
      const st = passStates[pi];
      if (st.key === "upcoming") return;
      const sid = String(p.stationId || "");
      if (!byStation.has(sid)) byStation.set(sid, []);
      const named = cleanedPeople(p.people, p.stationId);
      const list = named.length ? named : [{ name: p.personName || p.title }];
      list.forEach((person, index) => {
        if (person.outAt) return;
        byStation.get(sid).push({ p, person, index, st, legacy: !named.length });
      });
    });
    const groups = [...byStation.entries()].map(([sid, list]) => ({
      id: sid,
      name: stationName(sid) || (ar ? "بلا فرع" : "No branch"),
      alert: ar
        ? `${list.length === 1 ? "زائر واحد" : `${list.length} زوار`}${list.some((g) => g.st.key === "overstay") ? " · فيهم من تجاوز موعده" : ""}`
        : `${list.length} guests`,
      rows: list.map(({ p, person, index, st, legacy }) => {
        const id = `${p.id || p.ref}:${index}`;
        const canClose = checkCloseVisitorProofGate({ proof: p, actorUserId: currentUser?.id, sameBranch: sameBranchOf(p), isManager }).ok;
        return {
          id,
          title: person.name,
          count: person.badge || "",
          tone: st.key === "overstay" ? "bad" : st.key === "last" ? "gold" : "soft",
          line: st.key === "overstay"
            ? (ar ? `انتهى تصريحه ${dmy(p.visitTo)} ولم يخرج` : `Pass ended ${dmy(p.visitTo)}, still inside`)
            : [p.visitReason, p.hostName ? (ar ? `مضيفه ${p.hostName}` : `host ${p.hostName}`) : "", ar ? `حتى ${dmy(p.visitTo || p.visitFrom)}` : `until ${dmy(p.visitTo || p.visitFrom)}`].filter(Boolean).join(" · "),
          action: [
            { key: "open", label: ar ? "افتح التصريح" : "Open the pass", onClick: () => setOpenProofId(p.id || p.ref) },
            canClose && !legacy ? { key: "out", label: ar ? "سجّل خروجه" : "Check out", onClick: () => { visitorOut(p, index); setSideGuest(""); } } : null,
            canClose && legacy ? { key: "out", label: ar ? "سجّل المغادرة" : "Record leaving", onClick: () => closeVisit(p) } : null,
          ],
        };
      }),
    }));
    return (
      <OpsSideSlab
        ar={ar}
        dataKey="vp-side"
        title={ar ? "ضيوف الفرع الآن" : "Guests inside now"}
        standing={focusStation ? (ar ? `معروض: ${stationName(focusStation)}` : `Showing: ${stationName(focusStation)}`) : (ar ? "كل الفروع" : "All branches")}
        note={ar ? "كل ضيف ما زال داخل الفرع، برقم بطاقته إن سُلّمت. اختر اسماً لتسجيل خروجه." : "Each guest still inside, with their badge number. Pick a name to check them out."}
        summary={guestsNow ? (ar ? `${guestsNow} في الفروع الآن` : `${guestsNow} inside now`) : null}
        groups={groups}
        emptyText={ar ? "لا ضيف داخل فروعك الآن." : "No guest is inside your branches now."}
        focusId={focusStation}
        onFocus={setFocusStation}
        selectedId={sideGuest}
        onSelect={setSideGuest}
      />
    );
  })();
  const vpHowTo = ar
    ? [
      "«إثبات زائر جديد» عند الوصول: سبب الزيارة، المضيف، الفترة، ثم الزوار والسيارات.",
      "البطاقة تعرض آخر أربعة أرقام من الهوية فقط — الرقم الكامل داخل البطاقة المفتوحة.",
      "«مغادرة» تغلق التصريح وتنقله إلى الأرشيف بوقت الخروج.",
      "موظف الشركة من فرع آخر يبقى على مهمته، والمقاول الخارجي في «إثبات العمل».",
    ]
    : [
      "“New visitor proof” on arrival: reason, host, dates, then the visitors and vehicles.",
      "The list shows only the last four ID digits — the full number is inside the open card.",
      "“Left” closes the pass and moves it to the archive with the time out.",
      "A company employee from another branch stays on their task; outside contractors go on Work proof.",
    ];

  return (
    <OpsFrame
      ar={ar}
      lane={employeeFace ? "mine" : "manage"}
      title={ar ? "إثبات زائر — ضيوف الفرع" : "Visitor proof — branch guests"}
      hint={ar
        ? "من دخل الفرع اليوم، ومن يستضيفه، وحتى متى صُرّح له — وتُسجَّل مغادرته عند خروجه."
        : "Who came into the branch, who hosts them, and until when they are cleared — their leaving is recorded on the way out."}
      tiles={vpTiles}
      side={vpSide}
      howTo={vpHowTo}
    >
      {raising && (
        <ComposerModalShell
          ar={ar}
          zIndex={110}
          dataNv="task"
          title={ar ? "تسجيل زائر" : "Register a visitor"}
          hint={ar
            ? "ضيف على الفرع — ليس موظفاً من فرع آخر وليس جهة خارجية. حدّد الفترة والفروع ثم الزوّار والسيارات."
            : "A guest at the station. Set the dates and stations, then the visitors and vehicles."}
          onClose={() => setRaising(false)}
          onSubmit={raise}
          submitLabel={ar ? "أصدر التصريح" : "Issue the pass"}
          busy={busy}
          tinted
          wide
        >
          {(() => {
            const guests = (Array.isArray(form.people) ? form.people : []).filter((x) => String(x?.name || "").trim());
            const cars = (Array.isArray(form.vehicles) ? form.vehicles : []).filter((v) => v && (v.plateNumbers || v.plate || v.maker || v.model));
            const ids = Array.isArray(form.stationIds) && form.stationIds.length ? form.stationIds : (form.stationId ? [form.stationId] : []);
            const d = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || "")); return m ? `${m[3]}/${m[2]}` : "—"; };
            const missing = !ids.length
              ? (ar ? "فرع الزيارة" : "the branch")
              : !String(form.visitReason || "").trim()
                ? (ar ? "سبب الزيارة" : "the visit reason")
                : !guests.length
                  ? (ar ? "اسم زائر واحد على الأقل" : "at least one visitor")
                  : !String(guests[0]?.nationality || "").trim() ? (ar ? "جنسية الزائر" : "the visitor's nationality") : "";
            return (
              <DetailHero
                kind={ar ? "تصريح زائر جديد — معاينة" : "New visitor pass — preview"}
                pills={guests.filter((g) => g.briefed).length ? <HeroPill tone="ok">{ar ? "تلقّى تعريف السلامة" : "Safety briefed"}</HeroPill> : null}
                figure={(
                  <HeroFigure
                    mono={false}
                    placeholder={!guests[0]?.name}
                    value={guests[0]?.name || (ar ? "اسم الزائر" : "Visitor name")}
                    unit={guests.length > 1 ? (ar ? `ومعه ${guests.length - 1}` : `+${guests.length - 1}`) : ""}
                    line={missing ? (ar ? `بقي: ${missing}` : `Left: ${missing}`) : String(form.visitReason || "").trim()}
                    lineTone={missing ? "warn" : "ok"}
                  />
                )}
                facts={[
                  { label: ar ? "الفرع" : "Branch", value: ids.length > 1 ? (ar ? `${ids.length} فروع` : `${ids.length} branches`) : (stationName(ids[0]) || "—") },
                  { label: ar ? "المضيف" : "Host", value: form.hostName || (ar ? "بدون مضيف" : "No host") },
                  { label: ar ? "من" : "From", value: d(form.visitFrom), mono: true },
                  { label: ar ? "حتى" : "Until", value: d(form.visitTo), mono: true },
                  cars.length ? { label: ar ? "السيارات" : "Vehicles", value: cars.length, mono: true } : null,
                ]}
              />
            );
          })()}
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

      <div data-ops-list-head="1">
        <StatusFilterPills
          card
          dataKey="visitor-passes"
          title={ar ? "تصاريح الزوار" : "Visitor passes"}
          note={focusStation ? (ar ? `معروض: ${stationName(focusStation)}` : `Showing: ${stationName(focusStation)}`) : null}
          value={visitFace}
          onChange={setFilter}
          items={filterChips}
          trailing={(
            <span style={{ display: "inline-flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {focusStation ? (
                <button type="button" data-clear-focus="1" onClick={() => setFocusStation("")} style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 600, border: "none", background: "transparent", color: "var(--nv-ok-ink, #0F5535)", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>
                  {ar ? "اعرض الكل" : "Show all"}
                </button>
              ) : null}
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
            </span>
          )}
        />
        {filter !== "left" ? (
          <OpsStripSearch
            value={query}
            onChange={setQuery}
            placeholder={ar ? "بحث في إثباتات الزائر…" : "Search visitor proofs…"}
          />
        ) : null}
      </div>

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
          variant="visitor"
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
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {canClose ? (
                  <button
                    type="button"
                    data-primary="leave"
                    disabled={busy}
                    onClick={() => closeVisit(p)}
                    style={{ ...ui.btnMiniBrand, height: 32, padding: "0 14px" }}
                  >
                    {ar ? "سجّل مغادرة الجميع" : "Everyone left"}
                  </button>
                ) : null}
                <OpsMoreMenu
                  ar={ar}
                  items={[
                    { key: "card", label: ar ? "افتح التصريح" : "Open the pass", hint: ar ? "إضافة زائر، خروج فرد، تمديد" : "Add, check out, extend", onClick: () => setOpenProofId(row.id) },
                  ]}
                />
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
          onAddPerson={(person) => addVisitor(openProof, person)}
          onPersonOut={(index) => visitorOut(openProof, index)}
          onExtend={(input) => extendVisit(openProof, input)}
        />
      ) : null}
    </OpsFrame>
  );
}
