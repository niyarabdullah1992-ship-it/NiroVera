/**
 * Named writer lanes for platform facts.
 * Empty role lists mean statute / derivation — no UI may edit the fact.
 */

export const WRITER_ROLES = Object.freeze({
  "owner-or-hr": Object.freeze(["owner", "hr", "admin"]),
  "hr-file": Object.freeze(["owner", "hr", "admin"]),
  "hr-wage": Object.freeze(["owner", "hr", "admin"]),
  "org-admin": Object.freeze(["owner", "hr", "admin", "director"]),
  "attendance-punch": Object.freeze(["employee", "owner", "hr", "admin", "director", "station_manager"]),
  "attendance-policy": Object.freeze(["owner", "hr", "admin"]),
  "payroll-derivation": Object.freeze([]),
  "payroll-run": Object.freeze(["owner", "hr", "admin"]),
  "expense-raise": Object.freeze(["employee", "owner", "hr", "admin", "director", "station_manager"]),
  "expense-approve": Object.freeze(["owner", "hr", "admin", "director", "station_manager"]),
  "asset-custody": Object.freeze(["owner", "hr", "admin", "director", "station_manager"]),
  "inventory-ops": Object.freeze(["owner", "hr", "admin", "director", "station_manager"]),
  "request-raise": Object.freeze(["employee", "owner", "hr", "admin"]),
  "request-decide": Object.freeze(["owner", "hr", "admin", "director", "station_manager"]),
  "discipline-raise": Object.freeze(["owner", "hr", "admin", "director", "station_manager"]),
  "voice-raise": Object.freeze(["employee", "owner", "hr", "admin", "director", "station_manager"]),
  "voice-handle": Object.freeze(["owner", "hr", "admin", "director", "station_manager"]),
  "perf-score": Object.freeze(["owner", "hr", "admin", "director", "station_manager"]),
  "safety-log": Object.freeze(["owner", "hr", "admin", "director", "station_manager", "hse"]),
  "ops-task": Object.freeze(["owner", "hr", "admin", "director", "station_manager"]),
  "ops-review": Object.freeze(["owner", "hr", "admin", "director", "station_manager"]),
  "signing-create": Object.freeze(["owner", "hr", "admin", "director"]),
  "signing-sign": Object.freeze(["employee", "owner", "hr", "admin", "director", "station_manager"]),
  "notify-system": Object.freeze([]),
  "owner-board": Object.freeze(["owner"]),
  "derived-only": Object.freeze([]),
  statute: Object.freeze([]),
  "do-not-write": Object.freeze([]),
});

export function rolesForWriter(writer) {
  return WRITER_ROLES[writer] || [];
}
