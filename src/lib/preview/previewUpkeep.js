/**
 * The local preview workspace only — demo branches, demo people, seeded history. Nothing here runs
 * for a real company: store.getCompanyData calls it behind isLocalPreviewWorkspace. Keeping the
 * seeds in one place means a production bug is never a demo seed in disguise.
 *
 * Order is the order the seeds were written in; several later seeds read what earlier ones made.
 */
import {
  migratePreviewOpenRestWindow,
  migratePreviewRotaClock,
  migratePreviewWeekRota,
  migratePreviewOwnerMorningRota,
  migratePreviewCompanyHeadWorkplace,
  migratePreviewVoiceBranchManager,
  migratePreviewSigningNotices,
  migratePreviewEmployeeGenders,
  migratePreviewOwnerGosiIdentity,
  migratePreviewGosiEstablishment,
  migratePreviewFieldTasks,
  seedPreviewOwnerNightStreak,
  seedPreviewAttendanceHistory,
  seedPreviewProofCycle,
  seedPreviewWrittenConsent,
  seedPreviewDiscipline,
  seedPreviewVoice,
  seedPreviewPerformance,
  seedPreviewOrgDesign,
} from "../previewMigrations.js";
import { migratePreviewStationPins } from "../previewStationPins.js";
import { applyLapsedNightConsents } from "../nightRotateCycle.js";
import { openLongShiftRests } from "../data/companyInvariants.js";

/** Early previews seeded compass names (شمال/شرق) — labels only, rewritten once to free branch names. */
function renameCompassBranches(data) {
  if (!Array.isArray(data.stations)) return false;
  const renames = { "الفرع الشمالية": "فرع الخفجي", "الفرع الشرقية": "فرع رابغ" };
  let changed = false;
  data.stations = data.stations.map((st) => {
    const next = renames[st.name];
    if (!next) return st;
    changed = true;
    return { ...st, name: next };
  });
  if (!changed) return false;
  data.tasks = (data.tasks || []).map((t) => {
    let title = t.title || "";
    for (const [from, to] of Object.entries(renames)) {
      if (title.includes(from)) title = title.split(from).join(to);
    }
    return title === t.title ? t : { ...t, title };
  });
  return true;
}

export const PREVIEW_UPKEEP = Object.freeze([
  { id: "compass-branch-names", run: renameCompassBranches },
  { id: "rota-clock", run: migratePreviewRotaClock },
  { id: "week-rota", run: migratePreviewWeekRota },
  { id: "company-head-workplace", run: migratePreviewCompanyHeadWorkplace },
  { id: "voice-branch-manager", run: migratePreviewVoiceBranchManager },
  { id: "employee-genders", run: migratePreviewEmployeeGenders },
  { id: "owner-gosi-identity", run: migratePreviewOwnerGosiIdentity },
  { id: "gosi-establishment", run: migratePreviewGosiEstablishment },
  { id: "owner-morning-rota", run: migratePreviewOwnerMorningRota },
  { id: "owner-night-streak", run: seedPreviewOwnerNightStreak },
  { id: "attendance-history", run: seedPreviewAttendanceHistory },
  { id: "signing-notices", run: migratePreviewSigningNotices },
  { id: "station-pins", run: migratePreviewStationPins },
  { id: "proof-cycle", run: seedPreviewProofCycle },
  { id: "written-consent", run: seedPreviewWrittenConsent },
  { id: "lapsed-night-consents", run: applyLapsedNightConsents },
  { id: "discipline", run: seedPreviewDiscipline },
  { id: "voice", run: seedPreviewVoice },
  { id: "performance", run: seedPreviewPerformance },
  { id: "field-tasks", run: migratePreviewFieldTasks },
  { id: "org-design", run: seedPreviewOrgDesign },
  // preview shifts stretched above may now be long — open their one-hour rest in the same load
  { id: "long-shift-rests", run: openLongShiftRests },
  { id: "open-rest-window", run: migratePreviewOpenRestWindow },
]);

export function runPreviewUpkeep(data) {
  if (!data || typeof data !== "object") return false;
  let changed = false;
  for (const step of PREVIEW_UPKEEP) {
    if (step.run(data)) changed = true;
  }
  return changed;
}
