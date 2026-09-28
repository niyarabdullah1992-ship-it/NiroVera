/** Fold Arabic and digits so a typed query can match a name, title, number, or branch. */
export function foldOrgLookup(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function personLookupOption(employee, stationName, ar = true) {
  const title = employee?.profile?.position || employee?.jobTitle || (ar ? "موظف" : "Employee");
  const name = employee?.name || "—";
  const number = employee?.employeeNo || employee?.profile?.employeeNo || "";
  const branch = stationName || "";
  return {
    id: String(employee?.id || ""),
    primary: `${title} — ${name}`,
    secondary: [number, branch].filter(Boolean).join(" · "),
    search: [title, name, number, branch].filter(Boolean).join(" "),
  };
}

/** Every word in the query must appear, in any order. An empty query matches all. */
export function orgLookupMatches(option, query) {
  const folded = foldOrgLookup(query);
  if (!folded) return true;
  const hay = foldOrgLookup(option?.search || `${option?.primary || ""} ${option?.secondary || ""}`);
  return folded.split(" ").filter(Boolean).every((token) => hay.includes(token));
}
