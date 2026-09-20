/** Four named clusters — Icon Rail 1b. Destinations stay; the frame groups them. */
export const RAIL_CLUSTERS = [
  { id: "today", keys: ["daily", "signing", "duty"], ar: "اليوم", en: "Today" },
  { id: "people", keys: ["requests", "workforce", "performance", "complaints", "discipline"], ar: "الناس", en: "People" },
  { id: "care", keys: ["compliance", "money"], ar: "الالتزام", en: "Care" },
  { id: "setup", keys: ["admin"], ar: "الإعداد", en: "Setup" },
];

export function railBadgeTone(kind) {
  if (kind === "warn") return { bg: "#C9962B", label: "warn" };
  return { bg: "#1D9A5B", label: "go" };
}

export function railBadgeKind(key) {
  if (key === "complaints") return "warn";
  if (key === "requests" || key === "daily") return "go";
  return "go";
}

/**
 * Wrap rail destinations into the four named clusters.
 * @param {{ key: string }[]} railGroups
 * @param {string} lang
 */
export function buildSuiteRailClusters(railGroups, lang = "ar") {
  const ar = lang !== "en";
  return RAIL_CLUSTERS.map((cluster) => {
    const items = cluster.keys
      .map((key) => railGroups.find((group) => group.key === key))
      .filter(Boolean);
    if (!items.length) return null;
    return { id: cluster.id, label: ar ? cluster.ar : cluster.en, items };
  }).filter(Boolean);
}
