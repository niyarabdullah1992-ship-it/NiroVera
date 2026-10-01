/** Former workers whose files stay on the company — not on the live org tree. */

const EXIT_LABELS = {
  resignation: { ar: "استقالة", en: "Resignation" },
  article_80: { ar: "فصل — المادة 80", en: "Dismissal — Art. 80" },
  article_81: { ar: "ترك العمل — المادة 81", en: "Leaving work — Art. 81" },
  article_74: { ar: "إنهاء — المادة 74", en: "End — Art. 74" },
  article_77: { ar: "إنهاء — المادة 77", en: "End — Art. 77" },
  mutual: { ar: "اتفاق الطرفين", en: "Mutual agreement" },
  contract_end: { ar: "انتهاء العقد", en: "Contract end" },
  retirement: { ar: "تقاعد", en: "Retirement" },
  termination: { ar: "إنهاء خدمة", en: "Termination" },
};

export function isFormerEmployee(employee) {
  if (!employee?.id || employee.role === "system") return false;
  if (employee.active === false) return true;
  return String(employee?.profile?.employmentStatus || "").trim().toLowerCase() === "terminated";
}

export function formerExitReasonLabel(employee, ar = true) {
  const profile = employee?.profile || {};
  const reason = String(
    profile.contractExit?.reason
    || profile.offboarding?.exitReason
    || profile.offboarding?.contractExit?.reason
    || "termination",
  ).trim();
  const hit = EXIT_LABELS[reason];
  if (hit) return ar ? hit.ar : hit.en;
  return ar ? "إنهاء خدمة" : "Employment ended";
}

export function formerEndedAt(employee) {
  const profile = employee?.profile || {};
  return String(
    profile.employmentEndedAt
    || profile.offboarding?.completedAt
    || profile.contractExit?.effectiveDate
    || profile.offboarding?.lastWorkDate
    || "",
  ).slice(0, 10);
}

function niceDate(iso, ar) {
  const s = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return iso || "—";
  try {
    return new Date(`${s}T00:00:00`).toLocaleDateString(
      ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB",
      { year: "numeric", month: "short", day: "numeric" },
    );
  } catch {
    return s;
  }
}

export function presentFormerEmployee(employee, data, ar = true) {
  const profile = employee?.profile || {};
  const stationId = profile.lastWorkplaceId || employee.stationId || "";
  const stationName = profile.lastWorkplaceName
    || (data?.stations || []).find((row) => String(row.id) === String(stationId))?.name
    || "";
  const endedAt = formerEndedAt(employee);
  return {
    id: employee.id,
    name: employee.name || "—",
    position: profile.qiwaTitle || employee.position || profile.position || "—",
    stationId: stationId || null,
    stationName: stationName || (ar ? "—" : "—"),
    reason: formerExitReasonLabel(employee, ar),
    endedAt,
    endedLabel: endedAt ? niceDate(endedAt, ar) : (ar ? "—" : "—"),
    href: `/app/employees/${encodeURIComponent(employee.id)}`,
  };
}

/** Sorted archive of retained files — newest exit first. */
export function listFormerEmployees(data, { ar = true, query = "" } = {}) {
  const q = String(query || "").trim().toLowerCase();
  return (data?.employees || [])
    .filter(isFormerEmployee)
    .map((employee) => presentFormerEmployee(employee, data, ar))
    .filter((row) => {
      if (!q) return true;
      return [row.name, row.position, row.stationName, row.reason]
        .join(" ")
        .toLowerCase()
        .includes(q);
    })
    .sort((left, right) => String(right.endedAt || "").localeCompare(String(left.endedAt || ""))
      || String(left.name).localeCompare(String(right.name), "ar"));
}

export function formerEmployeeCount(data) {
  return (data?.employees || []).filter(isFormerEmployee).length;
}
