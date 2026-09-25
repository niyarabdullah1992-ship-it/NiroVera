/**
 * Each job title owns its grade rows. Titles do not share a ladder
 * unless that title itself has those grades.
 */

export function jobTitleKey(name) {
  return String(name || "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function gradeOwnsTitle(grade, name) {
  const key = jobTitleKey(name);
  if (!key || !grade) return false;
  if (String(grade.titleKey || "") === key) return true;
  return jobTitleKey(grade.jobTitle) === key;
}

export function orderedGrades(data) {
  return [...(data?.jobGrades || [])].sort((a, b) => (Number(a?.order) || 0) - (Number(b?.order) || 0));
}

export function gradesForTitle(data, name) {
  const key = jobTitleKey(name);
  if (!key) return [];
  return orderedGrades(data).filter((grade) => gradeOwnsTitle(grade, name));
}

function latinDigits(value) {
  return String(value || "")
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

/** Numeric step used to compare grades across different titles. */
export function gradeRank(grade) {
  if (!grade) return null;
  const match = latinDigits(grade.gradeNumber).match(/\d+/);
  if (match) return Number(match[0]);
  const order = Number(grade.order);
  return Number.isFinite(order) ? order : null;
}

function sharedLadderGrade(grade) {
  return Boolean(grade) && !String(grade.titleKey || "").trim() && !String(grade.jobTitle || "").trim();
}

/** Product grade order. Lower number is the lower grade: م1 then م7. */
export const PRODUCT_LADDER = [
  { rank: 1, gradeNumber: "م1", title: "تنفيذي – تشغيل", titleEn: "Executive — operations", minSalary: 4000, maxSalary: 6500, annualLeaveDays: 21 },
  { rank: 2, gradeNumber: "م2", title: "تنفيذي – تخصّصي", titleEn: "Executive — specialist", minSalary: 6000, maxSalary: 9500, annualLeaveDays: 21 },
  { rank: 3, gradeNumber: "م3", title: "إشرافي – مشرف", titleEn: "Supervisory — supervisor", minSalary: 8500, maxSalary: 13000, annualLeaveDays: 21 },
  { rank: 4, gradeNumber: "م4", title: "إشرافي – رئيس قسم", titleEn: "Supervisory — section head", minSalary: 11000, maxSalary: 17000, annualLeaveDays: 25 },
  { rank: 5, gradeNumber: "م5", title: "إداري – مدير فرع", titleEn: "Administrative — branch manager", minSalary: 15000, maxSalary: 24000, annualLeaveDays: 30 },
  { rank: 6, gradeNumber: "م6", title: "إداري – مدير إدارة", titleEn: "Administrative — department manager", minSalary: 21000, maxSalary: 34000, annualLeaveDays: 30 },
  { rank: 7, gradeNumber: "م7", title: "قيادي", titleEn: "Leadership", minSalary: 32000, maxSalary: 60000, annualLeaveDays: 30 },
];

function isOpGradeCode(value) {
  return /^OP\d+$/i.test(String(value || "").trim());
}

function isProductMeemCode(value, rank) {
  const raw = String(value || "").trim();
  return raw === `م${rank}` || raw === `${rank}م`;
}

/**
 * One ladder row per grade number already stored.
 * Pay and leave are read from the stored head — the table does not invent them.
 */
export function ladderBands(data) {
  const groups = new Map();
  orderedGrades(data).forEach((grade) => {
    const rank = gradeRank(grade);
    const key = rank != null ? `n:${rank}` : `id:${grade.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(grade);
  });
  return [...groups.values()].map((grades) => {
    const shared = grades.find((grade) => grade?.ladderBand && sharedLadderGrade(grade))
      || grades.find((grade) => sharedLadderGrade(grade))
      || null;
    const head = shared || grades[0];
    const rank = gradeRank(head);
    return {
      key: rank != null ? `n:${rank}` : `id:${head.id}`,
      rank,
      head,
      grades,
      shared,
      gradeNumber: String(head.gradeNumber || ""),
      level: String(head.title || ""),
      ranks: grades.filter((grade) => String(grade.jobTitle || "").trim()).map((grade) => ({
        id: grade.id,
        label: [grade.jobTitle, grade.title].filter(Boolean).join(" · "),
      })),
    };
  }).sort((a, b) => {
    const left = a.rank == null ? Number.POSITIVE_INFINITY : a.rank;
    const right = b.rank == null ? Number.POSITIVE_INFINITY : b.rank;
    if (left !== right) return left - right;
    return String(a.gradeNumber).localeCompare(String(b.gradeNumber), "en", { numeric: true });
  });
}

/** Same title after diacritics, tatweel, and bidi marks are ignored. */
export function catalogMatchKey(name) {
  return jobTitleKey(name).replace(/[\u0640\u064B-\u0652\u0670\u200c-\u200f\ufeff]/g, "");
}

/** مدير … sits above field titles (فني / مشغل / مراقب / منسق) in the catalog. */
export function isCatalogManagerTitle(name) {
  const key = catalogMatchKey(name);
  if (key.startsWith("مدير")) return true;
  return /\b(manager|director)\b/i.test(String(name || ""));
}

/** Grade codes low to high: م1 then م2 then م3. Missing numbers stay last. */
export function gradesAscending(grades) {
  return [...(grades || [])].sort((a, b) => {
    const rankA = gradeRank(a);
    const rankB = gradeRank(b);
    const left = Number.isFinite(rankA) ? rankA : Number.POSITIVE_INFINITY;
    const right = Number.isFinite(rankB) ? rankB : Number.POSITIVE_INFINITY;
    if (left !== right) return left - right;
    const code = String(a?.gradeNumber || "").localeCompare(String(b?.gradeNumber || ""), "en", { numeric: true });
    if (code) return code;
    return (Number(a?.order) || 0) - (Number(b?.order) || 0);
  });
}

export function gradesForCatalogTitle(data, name) {
  const key = catalogMatchKey(name);
  if (!key) return [];
  return gradesAscending(orderedGrades(data).filter((grade) => (
    catalogMatchKey(grade?.titleKey) === key || catalogMatchKey(grade?.jobTitle) === key
  )));
}

function catalogTitleCeiling(data, name) {
  const ranks = gradesForCatalogTitle(data, name).map((grade) => gradeRank(grade)).filter((rank) => rank != null);
  return ranks.length ? Math.max(...ranks) : -1;
}

function arabicWord(word) {
  return String(word || "").replace(/^ال/, "");
}

/** Word by word, ignoring «الـ», so the name order matches an Arabic list. */
function compareArabicTitle(a, b) {
  const left = String(a || "").trim().split(/\s+/).map(arabicWord);
  const right = String(b || "").trim().split(/\s+/).map(arabicWord);
  const count = Math.max(left.length, right.length);
  for (let index = 0; index < count; index += 1) {
    const diff = (left[index] || "").localeCompare(right[index] || "", "ar");
    if (diff) return diff;
  }
  return 0;
}

/**
 * One orderly catalog: manager seats first, then every other title.
 * Inside each group, the title's own highest grade number leads, then Arabic name.
 */
export function sortCatalogTitles(rows, data) {
  return [...(rows || [])].sort((a, b) => {
    const groupA = isCatalogManagerTitle(a?.label) ? 0 : 1;
    const groupB = isCatalogManagerTitle(b?.label) ? 0 : 1;
    if (groupA !== groupB) return groupA - groupB;
    const rankA = catalogTitleCeiling(data, a?.label);
    const rankB = catalogTitleCeiling(data, b?.label);
    if (rankA !== rankB) return rankB - rankA;
    return compareArabicTitle(a?.label, b?.label);
  });
}

/** One chip per title. Later copies keep their remove target without a second label. */
export function dedupeCatalogTitles(rows) {
  const out = [];
  (rows || []).forEach((row) => {
    const name = String(row?.label || "").trim();
    const key = catalogMatchKey(name);
    if (!key) return;
    const removal = row?.pack && row?.positionId ? { pack: row.pack, positionId: row.positionId } : null;
    const existing = out.find((item) => item.key === key);
    if (existing) {
      if (removal) {
        existing.removals.push(removal);
        if (!existing.pack) {
          existing.pack = row.pack;
          existing.positionId = row.positionId;
        }
      }
      if (!existing.listId && row?.listId) existing.listId = String(row.listId);
      return;
    }
    out.push({
      key,
      label: name,
      listId: String(row?.listId || ""),
      pack: row?.pack || null,
      positionId: row?.positionId || "",
      removals: removal ? [removal] : [],
    });
  });
  return out;
}

export function orderJobTitleCatalog(rows, data) {
  return sortCatalogTitles(dedupeCatalogTitles(rows), data);
}

function isSharedGrade(grade) {
  if (!grade || grade.ladderBand) return false;
  if (String(grade.id || "").startsWith("grade_ladder_")) return false;
  return !String(grade.titleKey || "").trim() && !String(grade.jobTitle || "").trim();
}

/**
 * When the stored ladder is empty or still OP codes, write the seven product bands.
 * Career-path ranks stay. People and seats are not invented.
 * Returns true when the company data changed.
 */
export function ensureProductLadder(data) {
  if (!data) return false;
  if (!Array.isArray(data.jobGrades)) data.jobGrades = [];
  const grades = data.jobGrades;
  const stored = grades.filter((grade) => {
    if (!grade?.ladderBand || !sharedLadderGrade(grade)) return false;
    const rank = gradeRank(grade);
    return PRODUCT_LADDER.some((row) => row.rank === rank && isProductMeemCode(grade.gradeNumber, rank));
  });
  if (stored.length >= PRODUCT_LADDER.length) return false;
  const hasOp = grades.some((grade) => isOpGradeCode(grade.gradeNumber));
  if (grades.length && !hasOp) return false;

  let changed = false;
  grades.forEach((grade) => {
    const match = String(grade.gradeNumber || "").trim().match(/^OP(\d+)$/i);
    if (!match) return;
    const rank = Number(match[1]);
    if (rank < 1 || rank > 7) return;
    const next = `م${rank}`;
    if (grade.gradeNumber === next) return;
    grade.gradeNumber = next;
    changed = true;
  });

  PRODUCT_LADDER.forEach((row) => {
    const shared = grades.find((grade) => (
      sharedLadderGrade(grade)
      && gradeRank(grade) === row.rank
      && (grade.ladderBand || isProductMeemCode(grade.gradeNumber, row.rank) || !String(grade.gradeNumber || "").trim())
    ));
    if (shared) {
      if (shared.gradeNumber !== row.gradeNumber) { shared.gradeNumber = row.gradeNumber; changed = true; }
      if (shared.title !== row.title) { shared.title = row.title; changed = true; }
      if (shared.titleEn !== row.titleEn) { shared.titleEn = row.titleEn; changed = true; }
      if (shared.minSalary !== row.minSalary) { shared.minSalary = row.minSalary; changed = true; }
      if (shared.maxSalary !== row.maxSalary) { shared.maxSalary = row.maxSalary; changed = true; }
      if (shared.annualLeaveDays !== row.annualLeaveDays) { shared.annualLeaveDays = row.annualLeaveDays; changed = true; }
      if (!shared.ladderBand) { shared.ladderBand = true; changed = true; }
      if (!String(shared.listId || "").trim()) { shared.listId = "ladder"; changed = true; }
      return;
    }
    const preferred = `grade_ladder_m${row.rank}`;
    const id = grades.some((grade) => grade.id === preferred) ? `grade_ladder_m${row.rank}_band` : preferred;
    grades.push({
      id,
      listId: "ladder",
      ladderBand: true,
      gradeNumber: row.gradeNumber,
      title: row.title,
      titleEn: row.titleEn,
      order: row.rank,
      minSalary: row.minSalary,
      maxSalary: row.maxSalary,
      annualLeaveDays: row.annualLeaveDays,
      jobTitle: "",
      titleKey: "",
      requiredCerts: [],
    });
    changed = true;
  });
  return changed;
}

function retargetGrade(data, fromId, titleLabel, toId) {
  const key = jobTitleKey(titleLabel);
  const holders = new Set();
  (data.orgSeats || []).forEach((seat) => {
    if (String(seat.gradeId || "") !== String(fromId)) return;
    if (jobTitleKey(seat.title) !== key) return;
    seat.gradeId = toId;
    if (seat.employeeId) holders.add(String(seat.employeeId));
  });
  (data.employees || []).forEach((employee) => {
    if (String(employee?.profile?.gradeId || "") !== String(fromId)) return;
    const position = employee.profile?.position || employee.jobTitle || employee.position;
    if (!holders.has(String(employee.id)) && jobTitleKey(position) !== key) return;
    employee.profile = { ...(employee.profile || {}), gradeId: toId };
  });
}

/**
 * Copy a shared grade onto each title that uses it.
 * The first title keeps the original id so seated people stay put.
 * Salary fields are copied as stored — amounts are not invented.
 * Returns true when the company data changed.
 */
export function attachSharedGradesToTitles(data) {
  if (!data || !Array.isArray(data.jobGrades) || !data.jobGrades.length) return false;
  const shared = data.jobGrades.filter(isSharedGrade);
  if (!shared.length) return false;

  const titles = [];
  const addTitle = (label, listId) => {
    const name = String(label || "").trim();
    const key = jobTitleKey(name);
    if (!key) return;
    const existing = titles.find((row) => row.key === key);
    if (existing) {
      if (!existing.listId && listId) existing.listId = String(listId);
      return;
    }
    titles.push({ key, label: name, listId: String(listId || "") });
  };
  (data.permissionTemplates || []).forEach((pack) => {
    (Array.isArray(pack?.positions) ? pack.positions : []).forEach((row) => {
      addTitle(row?.title, pack.id);
    });
  });
  (data.orgSeats || []).forEach((seat) => addTitle(seat?.title, seat?.listId));
  (data.employees || []).forEach((employee) => {
    const seated = (data.orgSeats || []).some((seat) => String(seat.employeeId || "") === String(employee.id) && seat.title);
    if (seated) return;
    addTitle(employee?.profile?.position || employee?.jobTitle || employee?.position, "");
  });

  /** titleKey -> { label, ids: string[] } in first-seen order. */
  const assignments = new Map();
  const assign = (label, gradeId) => {
    const key = jobTitleKey(label);
    const grade = data.jobGrades.find((item) => String(item.id) === String(gradeId));
    if (!key || !isSharedGrade(grade)) return;
    if (!assignments.has(key)) assignments.set(key, { label: String(label).trim(), ids: [] });
    const row = assignments.get(key);
    if (!row.ids.includes(String(gradeId))) row.ids.push(String(gradeId));
  };

  (data.orgSeats || []).forEach((seat) => assign(seat?.title, seat?.gradeId));
  (data.employees || []).forEach((employee) => {
    const seated = (data.orgSeats || []).find((seat) => String(seat.employeeId || "") === String(employee.id) && seat.gradeId);
    if (seated) return;
    assign(employee?.profile?.position || employee?.jobTitle || employee?.position, employee?.profile?.gradeId);
  });

  titles.forEach((row) => {
    if (assignments.has(row.key)) return;
    if (data.jobGrades.some((grade) => gradeOwnsTitle(grade, row.label))) return;
    const listGrades = shared
      .filter((grade) => String(grade.listId || "") === row.listId)
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
    if (!listGrades.length) return;
    const shown = String(listGrades[0].gradeNumber || "").trim();
    const tagged = listGrades.find((grade) => String(grade.gradeNumber || "").trim() === shown) || listGrades[0];
    assign(row.label, tagged.id);
  });

  if (!assignments.size) return false;

  const byGrade = new Map();
  assignments.forEach((row) => {
    row.ids.forEach((id) => {
      if (!byGrade.has(id)) byGrade.set(id, []);
      byGrade.get(id).push(row.label);
    });
  });

  let changed = false;
  let seq = 0;
  byGrade.forEach((labels, gradeId) => {
    const source = data.jobGrades.find((item) => String(item.id) === String(gradeId));
    if (!isSharedGrade(source)) return;
    labels.forEach((label, index) => {
      if (index === 0) {
        source.jobTitle = label;
        source.titleKey = jobTitleKey(label);
        changed = true;
        return;
      }
      seq += 1;
      const id = `grade_${String(source.id).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 18)}_${seq}`;
      data.jobGrades.push({
        ...source,
        id,
        jobTitle: label,
        titleKey: jobTitleKey(label),
        minSalary: source.minSalary ?? null,
        maxSalary: source.maxSalary ?? null,
        annualLeaveDays: source.annualLeaveDays ?? null,
      });
      retargetGrade(data, source.id, label, id);
      changed = true;
    });
  });
  return changed;
}
