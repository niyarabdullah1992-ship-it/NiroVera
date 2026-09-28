/**
 * Company login mail for display and invites.
 * Stored on the company settings record. Never writes the signed-in user's
 * auth email, owner password, or session.
 */

import { getCompanyData, getCompanyMeta, logAudit, updateCompany } from "./store";
import { normalizeEmailDomain } from "./settingsDerivations";

const BACKUP_PREFIX = "powercare_platform_login:";

const DOMAIN_RE = /^@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;
const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

const EMPTY = "—";

export function canManagePlatformLoginMail(user, data) {
  if (!user) return false;
  if (user.isOwner || user.role === "owner" || user.role === "admin") return true;
  if (data?.ownerId && String(user.id) === String(data.ownerId)) return true;
  const role = String(user.role || "");
  if (["director", "ops_manager", "pgm", "station_manager", "hr_manager"].includes(role)) return true;
  return !!user.hrLevelId;
}

export function parseLoginIdentity(raw) {
  const value = String(raw ?? "").trim();
  if (!value) {
    return { ok: false, error: "empty" };
  }
  if (/\s/.test(value)) {
    return { ok: false, error: "invalid" };
  }
  if (value.startsWith("@")) {
    if (!DOMAIN_RE.test(value)) return { ok: false, error: "invalid" };
    return {
      ok: true,
      row: {
        value: value.toLowerCase(),
        kind: "domain",
        via: "Google · Microsoft",
      },
    };
  }
  if (!EMAIL_RE.test(value)) return { ok: false, error: "invalid" };
  return {
    ok: true,
    row: {
      value: value.toLowerCase(),
      kind: "email",
      via: "Google · Microsoft · Apple",
    },
  };
}

function backupKey(companyId) {
  return `${BACKUP_PREFIX}${companyId}`;
}

function readBackup(companyId) {
  if (!companyId || typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(backupKey(companyId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? normalizeRows(parsed) : null;
  } catch {
    return null;
  }
}

function writeBackup(companyId, rows) {
  if (!companyId || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(backupKey(companyId), JSON.stringify(rows));
  } catch {
    /* private mode */
  }
}

export function normalizeRows(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const rows = [];
  for (const item of raw) {
    const parsed = parseLoginIdentity(item?.value ?? item);
    if (!parsed.ok || seen.has(parsed.row.value)) continue;
    seen.add(parsed.row.value);
    rows.push(parsed.row);
  }
  return rows;
}

export function lockedSignupDomain(company) {
  const domain = normalizeEmailDomain(company?.allowedEmailDomain || "");
  if (!domain || !DOMAIN_RE.test(domain)) return null;
  return {
    value: domain.toLowerCase(),
    kind: "domain",
    via: "Google · Microsoft",
    locked: true,
  };
}

function storedRows(companyId, data) {
  const fromSettings = data?.settings?.platformLoginIdentities;
  if (Array.isArray(fromSettings)) return normalizeRows(fromSettings);
  const backup = readBackup(companyId);
  return backup || [];
}

export function platformLoginRows(companyId, data, company) {
  const locked = lockedSignupDomain(company);
  const extra = storedRows(companyId, data).filter((row) => !locked || row.value !== locked.value);
  return locked ? [locked, ...extra] : extra;
}

export function platformLoginCountLabel(rows) {
  const n = Array.isArray(rows) ? rows.length : 0;
  if (!n) return EMPTY;
  return `${n} مُعرَّف`;
}

function persistRows(companyId, rows) {
  const next = normalizeRows(rows);
  writeBackup(companyId, next);
  updateCompany(companyId, (data) => {
    data.settings = {
      ...(data.settings || {}),
      platformLoginIdentities: next,
    };
  });
  return next;
}

export function addPlatformLoginIdentity(companyId, draft, data, company) {
  const parsed = parseLoginIdentity(draft);
  if (!parsed.ok) return { ok: false, error: parsed.error, rows: platformLoginRows(companyId, data, company) };
  const locked = lockedSignupDomain(company);
  const existing = storedRows(companyId, data);
  const taken = existing.some((row) => row.value === parsed.row.value)
    || (locked && locked.value === parsed.row.value);
  if (taken) return { ok: false, error: "duplicate", rows: platformLoginRows(companyId, data, company) };
  const next = persistRows(companyId, [...existing, parsed.row]);
  logAudit(companyId, "platform_login_mail_added", `إضافة بريد دخول: ${parsed.row.value}`);
  const fresh = getCompanyData(companyId) || data;
  return { ok: true, rows: platformLoginRows(companyId, fresh, company || getCompanyMeta(companyId)), stored: next };
}

export function removePlatformLoginIdentity(companyId, value, data, company) {
  const target = String(value || "").trim().toLowerCase();
  const locked = lockedSignupDomain(company);
  if (!target || (locked && locked.value === target)) {
    return { ok: false, error: "locked", rows: platformLoginRows(companyId, data, company) };
  }
  const existing = storedRows(companyId, data);
  if (!existing.some((row) => row.value === target)) {
    return { ok: false, error: "missing", rows: platformLoginRows(companyId, data, company) };
  }
  const next = persistRows(companyId, existing.filter((row) => row.value !== target));
  logAudit(companyId, "platform_login_mail_removed", `حذف بريد دخول: ${target}`);
  const fresh = getCompanyData(companyId) || data;
  return { ok: true, rows: platformLoginRows(companyId, fresh, company || getCompanyMeta(companyId)), stored: next };
}

export const PLATFORM_LOGIN_EMPTY = EMPTY;
