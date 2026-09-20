export function quickPathsFor(role) {
  if (role === "employee") return ["/app/attendance", "/app/tasks", "/app/work-proof", "/app/signing"];
  if (["director", "ops_manager", "pgm"].includes(role)) return ["/app", "/app/hr", "/app/tasks", "/app/signing"];
  if (role === "station_manager") return ["/app/tasks", "/app/attendance", "/app", "/app/signing"];
  if (role === "inventory_keeper") return ["/app/inventory", "/app/tasks", "/app/attendance", "/app/signing"];
  if (role === "financial_officer") return ["/app/expenses", "/app/tasks", "/app/attendance", "/app/signing"];
  return ["/app/attendance", "/app/tasks", "/app/signing", "/app/safety"];
}

export function mobilePathsFor(role) {
  if (role === "employee") return ["/app/attendance", "/app/tasks", "/app/work-proof", "/app"];
  if (["director", "ops_manager", "pgm"].includes(role)) return ["/app", "/app/hr", "/app/tasks", "/app/signing"];
  if (role === "station_manager") return ["/app", "/app/attendance", "/app/tasks", "/app/signing"];
  if (role === "inventory_keeper") return ["/app/inventory", "/app/attendance", "/app/tasks", "/app"];
  if (role === "financial_officer") return ["/app/expenses", "/app/attendance", "/app/tasks", "/app"];
  return ["/app/attendance", "/app/safety", "/app/tasks", "/app"];
}