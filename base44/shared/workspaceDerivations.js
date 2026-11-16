/** Workspace tenant registry — public lookup derivations (SINGLE SOURCE).
 *
 *  This is the one home for the logic. It is plain .js (JSDoc types) so every
 *  runtime can import it unchanged: the client (Vite) and the Node test harness
 *  via src/lib/workspaceDerivations.js, and the server (Deno) via the sibling
 *  workspaceDerivations.ts which only re-exports this file. No twin, no drift.
 *
 *  Public channel only: never exposes owner email, passwords, or employee PII.
 */

export const WORKSPACE_SEARCH_MIN = 2;
export const WORKSPACE_SEARCH_MAX = 12;

const ARABIC_MAP = {
  ا: "a", أ: "a", إ: "a", آ: "a", ب: "b", ت: "t", ث: "th", ج: "j", ح: "h", خ: "kh",
  د: "d", ذ: "dh", ر: "r", ز: "z", س: "s", ش: "sh", ص: "s", ض: "d", ط: "t", ظ: "z",
  ع: "a", غ: "gh", ف: "f", ق: "q", ك: "k", ل: "l", م: "m", ن: "n", ه: "h", و: "w",
  ي: "y", ى: "y", ة: "h", ء: "",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

const STOP_WORDS = new Set(["شركه", "مصنع", "مؤسسه", "موسسه", "اداره", "شركة", "co", "company", "ltd"]);

/** @typedef {{ companyId?: string|null, name?: string|null, plan?: string|null, orgType?: string|null, subscriptionStart?: string|null, created_date?: string|null }} WorkspaceAccountLike */

/** Strip diacritics / unify hamza & taa-marbuta for approximate Arabic search. */
export function normalizeArabicQuery(value) {
  return String(value || "")
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase()
    .trim();
}

export function checkWorkspaceSearchGate(query) {
  const q = String(query || "").trim();
  if (!q) {
    return {
      ok: false,
      error: "EMPTY_QUERY",
      reason: "اكتب اسم الشركة أو رقم السجل التجاري.",
      reasonEn: "Type a company name or commercial registration number.",
    };
  }
  if (q.length < WORKSPACE_SEARCH_MIN) {
    return {
      ok: false,
      error: "QUERY_TOO_SHORT",
      reason: "أدخل حرفين على الأقل للبحث.",
      reasonEn: "Enter at least two characters to search.",
    };
  }
  return { ok: true, query: q, normalized: normalizeArabicQuery(q) };
}

export function slugifyCompanyName(name, companyId = "") {
  const id = String(companyId || "").trim();
  if (/^[a-z0-9][a-z0-9_-]{1,48}$/i.test(id)) return id.toLowerCase().replace(/_/g, "-");

  const norm = normalizeArabicQuery(name);
  const words = norm.split(/\s+/).filter((w) => w && !STOP_WORDS.has(w));
  const source = words.length ? words : norm.split(/\s+/).filter(Boolean);
  const slug = source
    .map((w) =>
      w
        .split("")
        .map((ch) => (ARABIC_MAP[ch] !== undefined ? ARABIC_MAP[ch] : /[a-z0-9]/.test(ch) ? ch : ""))
        .join(""),
    )
    .filter(Boolean)
    .join("-")
    .slice(0, 28);
  return slug || "tenant";
}

/** @param {WorkspaceAccountLike|null|undefined} account */
export function isWorkspaceTrial(account) {
  const plan = String(account?.plan || "").trim();
  if (!plan || /^free$/i.test(plan)) return true;
  if (/trial/i.test(plan)) return true;
  return false;
}

export function accountMatchesWorkspaceQuery(account, query, commercialRegistration = "") {
  const gate = checkWorkspaceSearchGate(query);
  if (!gate.ok || !gate.normalized || !gate.query) return false;
  const nq = gate.normalized;
  const name = normalizeArabicQuery(account?.name);
  const slug = normalizeArabicQuery(slugifyCompanyName(account?.name, account?.companyId));
  const cid = normalizeArabicQuery(account?.companyId);
  const cr = String(commercialRegistration || "").replace(/\D/g, "");
  const digits = gate.query.replace(/\D/g, "");
  if (name.includes(nq) || slug.includes(nq) || cid.includes(nq)) return true;
  if (digits.length >= 4 && cr && cr.includes(digits)) return true;
  return false;
}

export function derivePublicWorkspaceCard(account, extras = {}) {
  const companyId = String(account?.companyId || "").trim();
  const name = String(account?.name || "").trim() || companyId;
  const slug = slugifyCompanyName(name, companyId);
  const plan = String(account?.plan || "Starter").trim() || "Starter";
  const orgType = account?.orgType === "gov" ? "gov" : "company";
  const trial = isWorkspaceTrial(account);
  const sites = Number.isFinite(Number(extras.sites)) ? Number(extras.sites) : 0;
  const staff = Number.isFinite(Number(extras.staff)) ? Number(extras.staff) : 0;
  const since = extras.since
    || (account?.subscriptionStart ? String(account.subscriptionStart).slice(0, 4) : "")
    || (account?.created_date ? String(account.created_date).slice(0, 4) : "")
    || "—";
  const cr = String(extras.commercialRegistration || "").replace(/\D/g, "") || "";

  return {
    companyId,
    slug,
    name,
    orgType,
    plan,
    trial,
    sites,
    staff,
    since,
    commercialRegistration: cr || null,
    urlPath: `/workspace/${encodeURIComponent(slug)}`,
    staffLoginPath: `/login/${orgType === "gov" ? "gov" : "company"}?company=${encodeURIComponent(companyId)}`,
    careersPath: `/careers?company=${encodeURIComponent(companyId)}`,
  };
}
