/**
 * Every allowance a payslip can carry, what it is paid for, where the rule comes from, and how
 * the wage rules treat it — and what the work site itself obliges the employer to provide.
 *
 * Sources (the uploaded texts):
 *   نظام العمل — المادة 2 (الأجر الأساسي والأجر الفعلي وعناصره)، 61/5–6 (السكن والنقل أو بدلهما)،
 *   84 (المكافأة على الأجر الأخير)، 86 (العمولات)، 107 (الإضافي)، 109 (أجر الإجازة)،
 *   144 (العناية الصحية مع الضمان الصحي التعاوني)، 146 (الأماكن البعيدة عن العمران: ترتيبات طبية
 *   وعلاج الأسرة وحوانيت ومدارس ومساجد)، 147 (المساكن والمخيمات والوجبات في الأماكن البعيدة والمناجم
 *   والمحاجر ومراكز التنقيب)، 148 (النقل حين لا تصل المواصلات المنتظمة).
 *   القرار الوزاري 18632 لعام 1441هـ — العمل الليلي (أجر ليلي أو بدل نقل، والإسعاف والنقل الإسعافي ليلاً).
 *   دليل صاحب العمل — التأمينات الاجتماعية: عناصر الأجر الخاضع = الأساسي + بدل السكن + العمولات،
 *   بحد أدنى 1,500 (400 لفرع الأخطار وحده) وأعلى 45,000.
 *
 * The law leaves «الأماكن البعيدة عن العمران» to the Regulation (م 146). The hour-to-hospital
 * threshold below is the establishment's own working criterion for switching those duties on —
 * it is labelled as such everywhere it shows.
 */

export const HOSPITAL_FAR_MINUTES = 60;

const YES = { ar: "يدخل", en: "Counts" };
const NO = { ar: "لا يدخل", en: "Excluded" };

/**
 * group: fixed (monthly by contract) · site (from where the work is) · night · variable (changes monthly)
 * gosi: part of the GOSI contributory wage per the employer guide.
 * eos / leave: Art. 84 and 109 use the actual wage (Art. 2), so a cash allowance counts in both.
 */
export const ALLOWANCE_KINDS = [
  {
    id: "housing", field: "housingAllowance", group: "fixed",
    ar: "بدل السكن", en: "Housing allowance",
    forAr: "سكن لائق أو بدله النقدي مع الأجر", forEn: "Decent housing, or cash in its place, paid with the wage",
    cite: "61/5", citeAr: "م 61/5", citeEn: "Art. 61/5", gosi: true,
  },
  {
    id: "transport", field: "transportAllowance", group: "fixed",
    ar: "بدل النقل", en: "Transport allowance",
    forAr: "وسيلة من السكن إلى العمل أو بدلها النقدي", forEn: "A ride from home to work, or cash in its place",
    cite: "61/6", citeAr: "م 61/6 · 148", citeEn: "Art. 61/6 · 148", gosi: false,
  },
  {
    id: "hazard", field: "hazardAllowance", group: "fixed",
    ar: "بدل طبيعة عمل أو خطر", en: "Nature-of-work or hazard allowance",
    forAr: "لقاء جهد يبذله أو مخاطر يتعرض لها", forEn: "For effort spent or risk faced at work",
    cite: "2", citeAr: "م 2 (البدلات)", citeEn: "Art. 2 (allowances)", gosi: false,
  },
  {
    id: "living", field: "livingAllowance", group: "fixed",
    ar: "بدل غلاء معيشة أو عائلي", en: "Cost-of-living or family allowance",
    forAr: "لمستوى المعيشة أو أعباء العائلة", forEn: "For living costs or family burden",
    cite: "2", citeAr: "م 2 (الزيادات)", citeEn: "Art. 2 (increases)", gosi: false,
  },
  {
    id: "remote", field: "remoteAreaAllowance", group: "site",
    ar: "بدل منطقة نائية", en: "Remote-area allowance",
    forAr: "العمل في مكان بعيد عن العمران — مشقة الموقع", forEn: "Working far from towns — the hardship of the site",
    cite: "146", citeAr: "م 2 · 146", citeEn: "Art. 2 · 146", gosi: false,
  },
  {
    id: "medical", field: "medicalDistanceAllowance", group: "site",
    ar: "بدل بُعد الخدمات الطبية", en: "Distance-from-care allowance",
    forAr: "أقرب مستشفى أبعد من معيار المنشأة — بدل عن الترتيبات الطبية", forEn: "The nearest hospital is past the establishment's threshold — in place of on-site medical arrangements",
    cite: "146/3", citeAr: "م 144 · 146/3", citeEn: "Art. 144 · 146/3", gosi: false,
  },
  {
    id: "meals", field: "mealAllowance", group: "site",
    ar: "بدل إعاشة", en: "Meals allowance",
    forAr: "الوجبات في الأماكن البعيدة والمناجم والمحاجر ومراكز التنقيب", forEn: "Meals at remote sites, mines, quarries and drilling camps",
    cite: "147", citeAr: "م 147", citeEn: "Art. 147", gosi: false,
  },
  {
    id: "night", field: "", group: "night",
    ar: "أجر ليلي أو بدل نقل ليلي", en: "Night pay or night transport",
    forAr: "العمل بين 23:00 و06:00 — من قرار الجدول", forEn: "Work between 23:00 and 06:00 — from the roster decision",
    cite: "18632", citeAr: "القرار 18632", citeEn: "Decision 18632", gosi: false,
  },
  {
    id: "commission", field: "commissionAmount", group: "variable",
    ar: "العمولة", en: "Commission",
    forAr: "نسبة من المبيعات أو الأرباح أو التحصيل", forEn: "A share of sales, profit or collection",
    cite: "2", citeAr: "م 2 · 86", citeEn: "Art. 2 · 86", gosi: true,
    eosAr: "يدخل ما لم يُستثنَ كتابةً", eosEn: "Counts unless excluded in writing",
  },
  {
    id: "other", field: "otherAllowances", group: "fixed",
    ar: "بدلات أخرى", en: "Other allowances",
    forAr: "بدل بالعقد لا يندرج تحت بند مسمّى", forEn: "A contract allowance with no named line",
    cite: "2", citeAr: "م 2", citeEn: "Art. 2", gosi: false,
  },
];

export const KIND_BY_ID = Object.fromEntries(ALLOWANCE_KINDS.map((k) => [k.id, k]));

/** The amount of each kind on a wage split (employeeWageSplit) — 0 when not on the file. */
export function kindAmount(wage = {}, id) {
  const n = (v) => Math.max(0, Number(v) || 0);
  switch (id) {
    case "housing": return n(wage.housing);
    case "transport": return n(wage.transport);
    case "hazard": return n(wage.hazard);
    case "living": return n(wage.living);
    case "remote": return n(wage.remote);
    case "medical": return n(wage.medical);
    case "meals": return n(wage.meals);
    case "night": return n(wage.night);
    case "commission": return n(wage.commission);
    case "other": return wage.split ? n(wage.otherPlain ?? wage.other) : 0;
    default: return 0;
  }
}

/**
 * The ledger: every allowance the person is paid, each with its basis and its treatment in
 * the actual wage, GOSI, end of service, leave pay and the overtime hour. A file with a lump
 * «البدلات» (no split) shows it as one line that GOSI cannot tell apart.
 */
export function allowanceLedger(wage = {}, ar = true) {
  const rows = [];
  for (const kind of ALLOWANCE_KINDS) {
    const amount = kindAmount(wage, kind.id);
    if (!(amount > 0)) continue;
    rows.push({
      id: kind.id,
      group: kind.group,
      name: ar ? kind.ar : kind.en,
      why: ar ? kind.forAr : kind.forEn,
      cite: ar ? kind.citeAr : kind.citeEn,
      amount,
      nightKind: kind.id === "night" ? (wage.nightKind || "") : undefined,
      actual: ar ? YES.ar : YES.en,
      gosi: kind.gosi,
      gosiText: kind.gosi ? (ar ? "خاضع" : "Contributory") : (ar ? "غير خاضع" : "Not contributory"),
      eos: kind.eosAr ? (ar ? kind.eosAr : kind.eosEn) : (ar ? YES.ar : YES.en),
      leave: ar ? YES.ar : YES.en,
      ot: ar ? "في أجر الساعة" : "In the hourly wage",
    });
  }
  if (!wage.split) {
    const lump = Math.max(0, (Number(wage.allowances) || 0) - (Number(wage.night) || 0) - (Number(wage.extras) || 0));
    if (lump > 0) {
      rows.unshift({
        id: "lump", group: "fixed",
        name: ar ? "البدلات (مجموع غير مفصّل)" : "Allowances (one lump)",
        why: ar ? "افصل السكن عن النقل في الملف ليُحسب الخاضع للتأمينات بدقة" : "Split housing from transport on the file so GOSI is exact",
        cite: ar ? "م 2" : "Art. 2", amount: lump,
        actual: ar ? YES.ar : YES.en, gosi: true,
        gosiText: ar ? "يُحسب كله — لا يُميَّز السكن" : "Counted whole — housing can't be told apart",
        eos: ar ? YES.ar : YES.en, leave: ar ? YES.ar : YES.en, ot: ar ? "في أجر الساعة" : "In the hourly wage",
      });
    }
  }
  const base = Math.max(0, Number(wage.base) || 0);
  const cash = base + rows.reduce((s, r) => s + r.amount, 0);
  const contributoryRaw = base + rows.filter((r) => r.gosi).reduce((s, r) => s + r.amount, 0);
  return {
    base,
    rows,
    cash,
    contributoryRaw,
    // Art. 107: the hourly actual wage + 50% of the basic hourly wage — estimated on 30 × 8 hours.
    otHour: Math.round((cash / 240 + (base / 240) * 0.5) * 100) / 100,
  };
}

function yesish(v) {
  if (v === true || v === 1) return true;
  return /^(yes|true|1|نعم)$/i.test(String(v ?? "").trim());
}

/**
 * The work site: how far the nearest hospital is, whether the place is remote from towns,
 * whether ordinary transport reaches it — and what that obliges (Arts. 144, 146, 147, 148;
 * Decision 18632 for night workers). Each duty says whether the file shows it met, and how.
 */
export function siteConditions({ profile = {}, station = {}, wage = {}, nightWorker = false, threshold = HOSPITAL_FAR_MINUTES } = {}) {
  const minutesRaw = profile.hospitalMinutes ?? station.hospitalMinutes;
  const minutes = minutesRaw === "" || minutesRaw == null ? null : Math.max(0, Number(minutesRaw) || 0);
  const remote = yesish(profile.remoteSite ?? station.remoteSite);
  const far = minutes != null && minutes > threshold;
  const noRegularTransport = profile.transportMode === "none" || yesish(station.noRegularTransport);
  const amount = (id) => kindAmount(wage, id);
  const duties = [];
  if (far || remote) {
    duties.push({
      id: "medical",
      cite: "146/3",
      ar: "ترتيبات طبية مناسبة وعلاج الأسرة علاجاً شاملاً",
      en: "Suitable medical arrangements and full treatment for the family",
      met: amount("medical") > 0 || yesish(profile.medicalOnSite ?? station.medicalOnSite),
      howAr: amount("medical") > 0 ? "بدل بُعد الخدمات الطبية" : yesish(profile.medicalOnSite ?? station.medicalOnSite) ? "عيادة أو مسعف في الموقع" : "",
      howEn: amount("medical") > 0 ? "Distance-from-care allowance" : yesish(profile.medicalOnSite ?? station.medicalOnSite) ? "Clinic or medic on site" : "",
    });
  }
  if (remote) {
    duties.push({
      id: "housing147",
      cite: "147",
      ar: "مساكن أو مخيمات للعمال",
      en: "Housing or camps for the workers",
      met: profile.housingMode === "provided" || amount("housing") > 0,
      howAr: profile.housingMode === "provided" ? "سكن مؤمَّن" : amount("housing") > 0 ? "بدل سكن" : "",
      howEn: profile.housingMode === "provided" ? "Housing provided" : amount("housing") > 0 ? "Housing allowance" : "",
    });
    duties.push({
      id: "meals",
      cite: "147",
      ar: "الوجبات الغذائية",
      en: "Meals",
      met: amount("meals") > 0 || yesish(profile.mealsProvided ?? station.mealsProvided),
      howAr: amount("meals") > 0 ? "بدل إعاشة" : yesish(profile.mealsProvided ?? station.mealsProvided) ? "وجبات مؤمَّنة" : "",
      howEn: amount("meals") > 0 ? "Meals allowance" : yesish(profile.mealsProvided ?? station.mealsProvided) ? "Meals provided" : "",
    });
  }
  if (remote || noRegularTransport) {
    duties.push({
      id: "transport148",
      cite: "148",
      ar: "النقل اليومي ذهاباً وإياباً حين لا تصل المواصلات المنتظمة",
      en: "Daily transport both ways where regular transport does not reach",
      met: profile.transportMode === "provided" || amount("transport") > 0,
      howAr: profile.transportMode === "provided" ? "نقل مؤمَّن" : amount("transport") > 0 ? "بدل نقل" : "",
      howEn: profile.transportMode === "provided" ? "Transport provided" : amount("transport") > 0 ? "Transport allowance" : "",
    });
  }
  if (nightWorker && (far || remote)) {
    duties.push({
      id: "nightTransfer",
      cite: "18632",
      ar: "نقل إسعافي ليلي عند الطوارئ",
      en: "Emergency transfer at night",
      met: yesish(station.nightEmergencyTransferReady ?? profile.nightEmergencyTransferReady),
      howAr: yesish(station.nightEmergencyTransferReady ?? profile.nightEmergencyTransferReady) ? "مثبت على الفرع" : "",
      howEn: yesish(station.nightEmergencyTransferReady ?? profile.nightEmergencyTransferReady) ? "Recorded on the branch" : "",
    });
  }
  return {
    minutes,
    threshold,
    far,
    remote,
    known: minutes != null || remote,
    duties,
    open: duties.filter((d) => !d.met).length,
  };
}
