/**
 * Organization terminology — company wording only.
 */

export const ORG_TYPES = Object.freeze({ COMPANY: "company", GOV: "gov" });

export function getOrgType(_dataOrSettings) {
  return ORG_TYPES.COMPANY;
}

export function isGovOrg(dataOrSettings) {
  return getOrgType(dataOrSettings) === ORG_TYPES.GOV;
}

/**
 * @param {"company"|"gov"} orgType
 * @param {string} [lang]
 */
export function buildOrgTerms(orgType, lang = "ar") {
  const gov = orgType === ORG_TYPES.GOV;
  const ar = lang === "ar";

  if (ar) {
    return {
      orgType: gov ? ORG_TYPES.GOV : ORG_TYPES.COMPANY,
      isGov: gov,
      station: gov ? "دائرة" : "فرع",
      stations: gov ? "الدوائر" : "الفروع",
      theStation: gov ? "الدائرة" : "الفرع",
      aStation: gov ? "دائرة" : "فرع",
      stationManager: gov ? "مدير الدائرة" : "مدير الفرع",
      allStations: gov ? "جميع الدوائر" : "جميع الفروع",
      addStation: gov ? "إضافة دائرة" : "إضافة فرع",
      selectStation: gov ? "اختر الدائرة" : "اختر الفرع",
      stationTeam: gov ? "فريق الدائرة" : "فريق الفرع",
      branch: gov ? "المقر" : "الفرع",
      branches: gov ? "المقار" : "الفروع",
      theBranch: gov ? "المقر" : "الفرع",
      hq: gov ? "المقر" : "المقر",
      hqTeam: gov ? "فريق المقر" : "فريق المقر",
      ceo: gov ? "معالي الوزير" : "الرئيس التنفيذي",
      orgKind: gov ? "جهة حكومية" : "شركة",
      orgKindShort: gov ? "حكومي" : "شركة",
      // Hierarchy levels (gov ladder from handoff; company keeps operational names)
      levelAgency: gov ? "وكالة" : "قطاع",
      levelGeneralDept: gov ? "إدارة عامة" : "إدارة عامة",
      levelDept: gov ? "إدارة" : "إدارة",
      levelSection: gov ? "قسم" : "قسم",
      hierarchyLevels: gov
        ? ["وكالة", "إدارة عامة", "إدارة", "قسم"]
        : ["قطاع", "إدارة عامة", "إدارة", "قسم"],
    };
  }

  return {
    orgType: gov ? ORG_TYPES.GOV : ORG_TYPES.COMPANY,
    isGov: gov,
    station: gov ? "Department" : "Branch",
    stations: gov ? "Departments" : "Branches",
    theStation: gov ? "the department" : "the branch",
    aStation: gov ? "a department" : "a branch",
    stationManager: gov ? "Department manager" : "Branch manager",
    allStations: gov ? "All departments" : "All branches",
    addStation: gov ? "Add department" : "Add branch",
    selectStation: gov ? "Select department" : "Select branch",
    stationTeam: gov ? "Department team" : "Branch team",
    branch: gov ? "Headquarters" : "Branch",
    branches: gov ? "Sites" : "Branches",
    theBranch: gov ? "headquarters" : "the branch",
    hq: "HQ",
    hqTeam: "HQ team",
    ceo: gov ? "His Excellency the Minister" : "Chief Executive Officer",
    orgKind: gov ? "Government entity" : "Company",
    orgKindShort: gov ? "Government" : "Company",
    levelAgency: gov ? "Agency" : "Division",
    levelGeneralDept: "General department",
    levelDept: "Department",
    levelSection: "Section",
    hierarchyLevels: gov
      ? ["Agency", "General department", "Department", "Section"]
      : ["Division", "General department", "Department", "Section"],
  };
}

/** Convenience: terms from company data blob. */
export function orgTermsFromData(data, lang = "ar") {
  return buildOrgTerms(getOrgType(data), lang);
}

/**
 * Override common i18n keys so existing `t("stations")` style calls can stay,
 * when pages pass the result through `orgAwareT`.
 */
const I18N_TERM_KEYS = {
  stations: "stations",
  station: "theStation",
  addStation: "addStation",
  stationName: "station",
  selectStation: "selectStation",
  stationTeam: "stationTeam",
  stationManager: "stationManager",
  allStationsChat: "stations",
  activeStations: "stations",
  hq: "hq",
  hqTeam: "hqTeam",
};

export function orgAwareT(t, terms, key, ...args) {
  const termKey = I18N_TERM_KEYS[key];
  if (termKey && terms[termKey] != null) return terms[termKey];
  return typeof t === "function" ? t(key, ...args) : key;
}
