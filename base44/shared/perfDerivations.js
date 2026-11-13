/** Single source (client + server). Client re-exports via src/lib/perfDerivations.js */

export const PERF_WEIGHTS = { pts: 0.5, ontime: 0.25, hse: 0.15, cover: 0.1, att: 0 };
export const OLD_PERF_WEIGHTS = { pts: 0.6, ontime: 0.25, hse: 0.15, att: 0 };

export function blendHseTerm(closurePct, reportPct) {
  return Math.round(Math.max(0, Number(closurePct) || 0) * 0.7 + Math.max(0, Number(reportPct) || 0) * 0.3);
}

/** Empty personal ledger is credit, not failure. Station pile is not a duty. */
export function deriveFairHseRates(input = {}) {
  const assignedOpen = Math.max(0, Number(input.assignedOpen) || 0);
  const notes = Math.max(0, Number(input.personalNotes) || 0);
  const closed = Math.max(0, Number(input.hazardClosed) || 0);
  const totalRaw = input.hazardTotal;
  const total = totalRaw == null || totalRaw === ""
    ? (assignedOpen + closed)
    : Math.max(0, Number(totalRaw) || 0);
  const hasDuty = assignedOpen > 0 || notes > 0 || total > 0;
  const closurePct = hasDuty && total > 0
    ? Math.round((Math.min(closed, total) / total) * 100)
    : 100;
  const reportPts = Math.max(0, Number(input.reportPts) || 0);
  const maxReport = Math.max(0, Number(input.maxReportPts) || 0);
  let reportPct = 100;
  if (assignedOpen > 0 || notes > 0) {
    reportPct = reportPts <= 0 ? 0 : (maxReport > 0 ? Math.round((reportPts / maxReport) * 100) : 100);
  } else if (reportPts > 0 && maxReport > 0) {
    reportPct = Math.min(100, Math.round((reportPts / maxReport) * 100));
  }
  const safeClosure = Math.min(100, Math.max(0, closurePct));
  const safeReport = Math.min(100, Math.max(0, reportPct));
  return {
    closurePct: safeClosure,
    reportPct: safeReport,
    hsePct: blendHseTerm(safeClosure, safeReport),
    emptyLedger: !hasDuty && reportPts <= 0,
  };
}

function samePerson(value, employeeId, employeeName) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  if (employeeId && raw === employeeId) return true;
  return !!(employeeName && raw.toLocaleLowerCase() === employeeName);
}

export function countPersonalHseDuty(records, employeeId, employeeName) {
  const id = String(employeeId || "");
  const name = String(employeeName || "").trim().toLocaleLowerCase();
  let assignedOpen = 0;
  let assignedClosed = 0;
  let personalNotes = 0;
  for (const rec of Array.isArray(records) ? records : []) {
    for (const raw of rec.hazards || []) {
      const owned = [raw.ownerId, raw.assigneeId, raw.employeeId, raw.responsibleId, raw.owner, raw.ownerName, raw.assignee]
        .some((value) => samePerson(value, id, name));
      if (owned && !raw.closedAt) assignedOpen += 1;
      if (owned && raw.closedAt) assignedClosed += 1;
    }
    for (const raw of rec.hazardLog || []) {
      const owned = [raw.ownerId, raw.assigneeId, raw.employeeId, raw.responsibleId, raw.owner, raw.closedBy]
        .some((value) => samePerson(value, id, name));
      if (owned) assignedClosed += 1;
    }
    for (const raw of rec.incidentLog || []) {
      const onThem = [raw.employeeId, raw.involvedId, raw.againstId, raw.subjectId]
        .some((value) => samePerson(value, id, name));
      if (onThem && String(raw.status || "open") !== "closed") personalNotes += 1;
    }
  }
  return { assignedOpen, assignedClosed, personalNotes, assignedTotal: assignedOpen + assignedClosed };
}

export function scoreEmployee({ pts = 0, maxPts = 1, ontimePct = 0, closurePct = 0, reportPct = 0, coverPct = 0 }) {
  const safeMax = Math.max(1, Number(maxPts) || 1);
  const ptsPct = Math.round((Math.max(0, Number(pts) || 0) / safeMax) * 100);
  const ontime = Math.min(100, Math.max(0, Number(ontimePct) || 0));
  const closure = Math.min(100, Math.max(0, Number(closurePct) || 0));
  const report = Math.min(100, Math.max(0, Number(reportPct) || 0));
  const cover = Math.min(100, Math.max(0, Number(coverPct) || 0));
  const hse = blendHseTerm(closure, report);
  const W = PERF_WEIGHTS;
  const terms = [
    Math.round(ptsPct * W.pts),
    Math.round(ontime * W.ontime),
    Math.round(hse * W.hse),
    Math.round(cover * W.cover),
  ];
  const newScore = terms.reduce((a, b) => a + b, 0);
  const OW = OLD_PERF_WEIGHTS;
  const oldScore = Math.round(ptsPct * OW.pts) + Math.round(ontime * OW.ontime) + Math.round(closure * OW.hse);
  const protectedBy = oldScore > newScore;
  return {
    pts: Math.max(0, Number(pts) || 0),
    ptsPct,
    ontime,
    closure,
    reportPct: report,
    coverPct: cover,
    hse,
    terms,
    newScore,
    oldScore,
    score: Math.max(newScore, oldScore),
    protectedBy,
    weights: W,
  };
}

export function scoreBoard(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  const maxPts = Math.max(1, ...list.map((r) => Number(r.pts) || 0), 1);
  const maxReport = Math.max(0, ...list.map((r) => Number(r.reportPts) || 0), 0);
  const maxCover = Math.max(1, ...list.map((r) => Number(r.coverPts) || 0), 1);
  const scored = list.map((r) => {
    const hse = deriveFairHseRates({
      hazardClosed: Number(r.assignedClosed) || 0,
      hazardTotal: r.assignedTotal ?? r.hazardTotal,
      reportPts: Number(r.reportPts) || 0,
      maxReportPts: maxReport,
      assignedOpen: Number(r.assignedOpen) || 0,
      personalNotes: Number(r.personalNotes) || 0,
    });
    return {
      employeeId: r.employeeId,
      name: r.name || r.employeeId,
      stationId: r.stationId,
      ...scoreEmployee({
        pts: Number(r.pts) || 0,
        maxPts,
        ontimePct: Number(r.ontimePct) || 0,
        closurePct: hse.closurePct,
        reportPct: hse.reportPct,
        coverPct: Math.round(((Number(r.coverPts) || 0) / maxCover) * 100),
      }),
    };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map((row, i) => ({ ...row, rank: i + 1 }));
}

/** Average the scored individual board into one comparable row per station. */
export function aggregateStationBoard(scoredRows = [], stations = []) {
  const groups = new Map();
  for (const station of stations) {
    groups.set(station.id, {
      stationId: station.id,
      name: station.name || station.id,
      heads: 0,
      scoreSum: 0,
      ptsPctSum: 0,
      ontimeSum: 0,
      hseSum: 0,
      ptsSum: 0,
    });
  }
  for (const row of Array.isArray(scoredRows) ? scoredRows : []) {
    const id = row.stationId;
    if (!id) continue;
    if (!groups.has(id)) {
      groups.set(id, {
        stationId: id,
        name: row.stationName || id,
        heads: 0,
        scoreSum: 0,
        ptsPctSum: 0,
        ontimeSum: 0,
        hseSum: 0,
        ptsSum: 0,
      });
    }
    const group = groups.get(id);
    group.heads += 1;
    group.scoreSum += Number(row.score) || 0;
    group.ptsPctSum += Number(row.ptsPct) || 0;
    group.ontimeSum += Number(row.ontime) || 0;
    group.hseSum += Number(row.hse) || 0;
    group.ptsSum += Number(row.pts) || 0;
  }
  return [...groups.values()]
    .map((group) => {
      const n = group.heads || 0;
      return {
        stationId: group.stationId,
        name: group.name,
        heads: n,
        score: n ? Math.round(group.scoreSum / n) : 0,
        ptsPct: n ? Math.round(group.ptsPctSum / n) : 0,
        ontime: n ? Math.round(group.ontimeSum / n) : 0,
        hse: n ? Math.round(group.hseSum / n) : 0,
        pts: group.ptsSum,
      };
    })
    .sort((a, b) => b.score - a.score || b.heads - a.heads)
    .map((row, i) => ({ ...row, rank: i + 1 }));
}
