/**
 * «مرجعية الوزارة» on السلامة — the rows SafetyMinistryPanel lists and the «الامتثال الوزاري» index
 * counts. Facts come from the stations in scope and their safety records (the same reads Safety.jsx
 * made inline): open reports and hazards, the first-aid cabinet check (Regs Art. 29), the site
 * distance (Regs Art. 30), and the 3337 season. Pure (node-testable).
 */
import { firstAidSummary } from "./firstAidCabinet.js";
import { deriveRemoteness } from "./siteRemoteness.js";
import { isHeatBanDate } from "./contractLawDerivations.js";

/** stations — in scope; recFor(stationId) → that station's safety record. */
export function safetyMinistryFacts({ stations = [], recFor = () => null, today } = {}) {
  const reportRows = stations.flatMap((station) => (recFor(station.id)?.incidentLog || []).map((item) => ({
    stationId: station.id,
    stationName: station.name || "—",
    item,
  })));
  const openReportRows = reportRows.filter((row) => row.item?.status !== "closed");
  const openHazards = stations.flatMap((station) => (recFor(station.id)?.hazards || []).filter((hazard) => !hazard?.closedAt));
  const trackedReports = openReportRows.filter((row) => !row.item.card?.positive);
  const controlGap = trackedReports.some((row) => !row.item.card?.controlId) || openHazards.some((hazard) => !hazard?.controlId);
  return {
    reportRows,
    openReportRows,
    openHazards,
    criticalOpen: openReportRows.some((row) => (row.item.card?.score || 0) >= 15 || row.item.card?.levelKey === "critical"),
    injuryOpen: openReportRows.some((row) => row.item.card?.injured || row.item.card?.kind === 3),
    control: !trackedReports.length && !openHazards.length ? "none" : controlGap ? "gap" : "ok",
    firstAid: firstAidSummary(stations, recFor, { today }),
    remoteCount: stations.filter((station) => deriveRemoteness(recFor(station.id)?.site || {}, station.remoteSite).remote).length,
    siteUnknown: stations.filter((station) => !deriveRemoteness(recFor(station.id)?.site || {}, station.remoteSite).known).length,
    stationCount: stations.length,
  };
}

const STATUS_OF_TONE = { bad: "violation", warn: "alert", ok: "settled", "": "void" };

/** Rows in the shared shape: { key, badge, title, status, pill, tone }. */
export function safetyMinistryRows(facts = {}, { ar = true, onDate } = {}) {
  const L = (a, e) => (ar ? a : e);
  const { criticalOpen, injuryOpen, control = "none", firstAid = null, remoteCount = 0, siteUnknown = 0, stationCount = 0 } = facts;
  const inSeason = isHeatBanDate(onDate ? new Date(`${onDate}T12:00:00`) : new Date());
  const aid = !firstAid || !stationCount
    ? ["—", ""]
    : firstAid.short
      ? [L(`${firstAid.short} فرع ناقص`, `${firstAid.short} branch(es) short`), "bad"]
      : firstAid.none
        ? [L(`${firstAid.none} فرع لم يُفحص`, `${firstAid.none} never checked`), "warn"]
        : firstAid.stale
          ? [L(`${firstAid.stale} فحص قديم`, `${firstAid.stale} stale`), "warn"]
          : [L("مستوفٍ", "Met"), "ok"];
  const list = [
    ["labour-121", "م 121·122", L("الحماية من الأخطار", "Protection from hazards"), criticalOpen ? L("مخالفة", "Breach") : L("مستوفٍ", "Met"), criticalOpen ? "bad" : "ok"],
    ["labour-142", "م 142 · اللائحة م29", L("خزانة الإسعافات: الأصناف والكميات، صلاحيتها، الهلال الأحمر، وإعلان مكانها واسم المسؤول عنها", "First-aid cabinet: items and quantities, fitness, red crescent, posted place and keeper"), aid[0], aid[1]],
    ["regs-30", "اللائحة م30", L("البعيد عن العمران: أكثر من 50 كم بطريق معبّد أو 25 كم بغير معبّد، أو تجمع بلا مرافق — تترتب عليه المادتان 146 و147", "Remote: over 50 km by paved road or 25 km unpaved, or a cluster without services — Arts. 146 and 147 follow"), siteUnknown ? L(`${siteUnknown} فرع بلا مسافة`, `${siteUnknown} without a distance`) : remoteCount ? L(`${remoteCount} فرع بعيد`, `${remoteCount} remote`) : (stationCount ? L("لا فرع بعيد", "None remote") : "—"), siteUnknown ? "warn" : remoteCount ? "warn" : (stationCount ? "ok" : "")],
    ["labour-141", "م 141 · اللائحة م28", L("مهلة إبلاغ الإصابة", "Injury reporting deadline"), injuryOpen ? L("مفتوح — يُبلَّغ فوراً", "Open — report at once") : "—", injuryOpen ? "bad" : ""],
    ["iso-45001", "ISO 45001 §8.1.2", L("ضابط لكل خطر", "A control for every hazard"), control === "none" ? "—" : control === "gap" ? L("ناقص", "Missing") : L("مستوفٍ", "Met"), control === "none" ? "" : control === "gap" ? "warn" : "ok"],
    ["3337", "قرار 3337", L("لا عمل مكشوف 12:00–15:00 من 15 يونيو إلى 15 سبتمبر", "No exposed work 12:00–15:00 from 15 June to 15 September"), inSeason ? L("الموسم قائم", "Season is open") : L("بلا أثر", "No effect"), inSeason ? "warn" : ""],
  ];
  return list.map(([key, badge, title, pill, tone]) => ({ key, badge, title, pill, tone, status: STATUS_OF_TONE[tone] || "void" }));
}
