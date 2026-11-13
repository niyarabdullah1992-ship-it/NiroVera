/** Client face of the workspace tenant-registry derivations.
 *
 *  SINGLE SOURCE — the shared core (constants, the search gate, slug/trial/match
 *  and the public card) lives once in base44/shared/workspaceDerivations.ts and
 *  is re-exported here, so the client and the server (companyDirectory, via the
 *  thin workspaceDerivations.ts) cannot drift — all three import the one file.
 *  This is the model for retiring a twin: shared logic in one plain .js, the
 *  client re-exporting it and adding only what has no server counterpart.
 *
 *  Only preview-mode seeding (local demo data when Base44 is offline) is added
 *  below — by design it has no server side.
 *
 *  Public channel only: never exposes owner email, passwords, or employee PII.
 */

import {
  WORKSPACE_SEARCH_MIN,
  WORKSPACE_SEARCH_MAX,
  normalizeArabicQuery,
  checkWorkspaceSearchGate,
  slugifyCompanyName,
  isWorkspaceTrial,
  accountMatchesWorkspaceQuery,
  derivePublicWorkspaceCard,
} from "../../base44/shared/workspaceDerivations.js";

export {
  WORKSPACE_SEARCH_MIN,
  WORKSPACE_SEARCH_MAX,
  normalizeArabicQuery,
  checkWorkspaceSearchGate,
  slugifyCompanyName,
  isWorkspaceTrial,
  accountMatchesWorkspaceQuery,
  derivePublicWorkspaceCard,
};

/** Local preview seeds when Base44 is offline — mirrors design SEED, not live data. */
export function workspacePreviewSeeds(lang = "ar") {
  const ar = lang === "ar";
  const T = (a, e) => (ar ? a : e);
  return [
    {
      companyId: "gulf-power",
      name: T("شركة الخليج للطاقة", "Gulf Power Co."),
      plan: T("الخطة المؤسسية", "Enterprise"),
      orgType: "company",
      subscriptionStart: "2024-01-01",
      created_date: "2024-01-01",
      _cr: "1010234567",
      _sites: 6,
      _staff: 142,
    },
    {
      companyId: "yanbu-petro",
      name: T("مصنع ينبع للبتروكيماويات", "Yanbu Petrochemical Plant"),
      plan: T("خطة النمو", "Growth"),
      orgType: "company",
      subscriptionStart: "2025-01-01",
      created_date: "2025-01-01",
      _cr: "4700118822",
      _sites: 3,
      _staff: 88,
    },
    {
      companyId: "rabigh-fm",
      name: T("إدارة مرافق رابغ", "Rabigh Facilities Management"),
      plan: "Starter",
      orgType: "company",
      subscriptionStart: "2026-01-01",
      created_date: "2026-01-01",
      _cr: "4602277431",
      _sites: 2,
      _staff: 41,
      _forceTrial: true,
    },
  ].map((row) => {
    const card = derivePublicWorkspaceCard(row, {
      commercialRegistration: row._cr,
      sites: row._sites,
      staff: row._staff,
      since: String(row.subscriptionStart).slice(0, 4),
    });
    if (row._forceTrial) card.trial = true;
    return card;
  });
}

export function filterWorkspacePreview(query, lang = "ar") {
  const gate = checkWorkspaceSearchGate(query);
  if (!gate.ok) return { ok: false, ...gate, results: [] };
  const seeds = workspacePreviewSeeds(lang);
  const results = seeds
    .filter((c) =>
      accountMatchesWorkspaceQuery(
        { name: c.name, companyId: c.companyId, plan: c.plan },
        gate.query,
        c.commercialRegistration || "",
      ))
    .slice(0, WORKSPACE_SEARCH_MAX);
  return { ok: true, query: gate.query, results, preview: true };
}
