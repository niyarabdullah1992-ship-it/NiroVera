import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Check } from "lucide-react";
import { assignEmployeeToShift, unassignEmployeeFromShift } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { BRAND_BORDER, BRAND_DEEP, BRAND_SOFT, MUTED, NAVY, CARD, SURFACE } from "@/lib/platformStyles";

function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase() || "?";
}

function visibleName(name = "", compact = false) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (compact) return parts[0] || name;
  if (parts.length <= 2) return parts.join(" ");
  return `${parts[0]} ${parts[1]}`;
}

/** Compact equal-height day cell — faces overlap; click opens assign. */
export default function ScheduleCell({
  companyId,
  stationId,
  day,
  shiftTypeId,
  employeeIds,
  employees,
  canManage,
  isRestDay = false,
  rowHeight = 44,
}) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const [open, setOpen] = useState(false);
  const assigned = employees.filter((e) => employeeIds.includes(e.id));
  const shown = assigned.slice(0, 2);
  const extra = assigned.length - shown.length;

  const close = (e) => {
    e?.stopPropagation();
    e?.preventDefault();
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const toggle = (empId) => {
    if (employeeIds.includes(empId)) unassignEmployeeFromShift(companyId, stationId, day, shiftTypeId, empId);
    else assignEmployeeToShift(companyId, stationId, day, shiftTypeId, empId);
  };

  return (
    <div
      role={canManage ? "button" : undefined}
      tabIndex={canManage ? 0 : undefined}
      onClick={(e) => {
        if (!canManage || open) return;
        e.stopPropagation();
        setOpen(true);
      }}
      onKeyDown={(e) => {
        if (canManage && !open && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          setOpen(true);
        }
      }}
      className="nv-shift-cell"
      title={assigned.map((e) => e.name).join(" · ") || (ar ? "إسناد" : t("add"))}
      style={{
        width: "100%",
        height: "100%",
        minHeight: rowHeight,
        padding: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        background: isRestDay ? "var(--nv-soft)" : "transparent",
        boxSizing: "border-box",
        cursor: canManage ? "pointer" : "default",
        overflow: "hidden",
      }}
    >
      {shown.length === 0 ? (
        canManage ? (
          <span className="nv-shift-plus" aria-hidden>+</span>
        ) : null
      ) : (
        <span className="nv-shift-who">
          {shown.map((emp) => (
            <span key={emp.id} className="nv-shift-who-name" title={emp.name}>
              {visibleName(emp.name, shown.length > 1)}
            </span>
          ))}
          {extra > 0 && <span className="nv-shift-who-more">+{extra}</span>}
        </span>
      )}

      {open &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 80,
              background: "rgba(20,40,75,.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
            }}
            onMouseDown={close}
          >
            <div
              role="dialog"
              aria-modal="true"
              style={{
                width: "100%",
                maxWidth: "320px",
                maxHeight: "70vh",
                overflowY: "auto",
                background: CARD,
                border: "1px solid var(--nv-line)",
                borderRadius: "14px",
                boxShadow: "0 14px 32px rgba(20,40,75,.14)",
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--nv-line)", fontSize: "12px", fontWeight: 600, color: NAVY }}>
                {ar ? "إسناد موظف" : t("add")}
              </div>
              {employees.map((emp) => {
                const isAssigned = employeeIds.includes(emp.id);
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => toggle(emp.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                      width: "100%",
                      padding: "11px 16px",
                      border: "none",
                      borderBottom: "1px solid var(--nv-line)",
                      background: isAssigned ? BRAND_SOFT : CARD,
                      color: isAssigned ? BRAND_DEEP : NAVY,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontSize: "13px",
                      textAlign: "start",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                      <span
                        style={{
                          width: "26px",
                          height: "26px",
                          borderRadius: "50%",
                          background: BRAND_SOFT,
                          color: BRAND_DEEP,
                          border: `1px solid ${BRAND_BORDER}`,
                          fontSize: "9px",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          fontFamily: "'IBM Plex Sans',sans-serif",
                        }}
                      >
                        {initials(emp.name)}
                      </span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{emp.name}</span>
                    </span>
                    {isAssigned ? <Check style={{ width: 14, height: 14, flexShrink: 0 }} /> : null}
                  </button>
                );
              })}
              {employees.length === 0 && (
                <p style={{ margin: 0, padding: "16px", fontSize: "13px", color: MUTED }}>{t("noTasks")}</p>
              )}
              <button
                type="button"
                onClick={close}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  width: "100%",
                  padding: "12px",
                  border: "none",
                  borderTop: "1px solid var(--nv-line)",
                  background: SURFACE,
                  color: MUTED,
                  fontSize: "12px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <X style={{ width: 12, height: 12 }} />
                {ar ? "إغلاق" : "Close"}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
