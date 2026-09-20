import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { identityFrame } from "@/components/shared/IdentityCard";
import Logo from "@/components/Logo";
import {
  BORDER,
  CARD,
  MUTED,
  NAVY,
  NAVY_FILL,
  OK,
  SURFACE,
  WARN,
  ui,
} from "@/lib/platformStyles";
import {
  CONTRACT_TYPE_OPTIONS,
  idNumberFieldLabel,
  optionLabel,
  profileFieldValue,
} from "@/lib/employeeProfileFields";
import { employeeJobGrade, jobGradeLabel } from "@/lib/jobGrades";
import { activeActingAssignments, occupantTitle, seatForEmployee } from "@/lib/orgHire";
import { explainWorkplaceManager } from "@/lib/peopleTree";
import { listedPacks } from "@/lib/permissionPackTemplate";
import { companyLists, templateLabel } from "@/lib/permissionTemplates";

function initialsOf(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

/** Prefer a product employee number; fall back to internal id only when nothing else exists. */
function employeeNumberOf(employee) {
  const tagged = String(employee?.employeeId || employee?.profile?.employeeId || "").trim();
  if (tagged) return tagged;
  return String(employee?.id || "").trim();
}

function listLabelOf(employee, data, ar) {
  if (!employee) return "";
  const seat = seatForEmployee(data, employee.id);
  const position = (data?.smartPositions || []).find((item) => String(item.employeeId) === String(employee.id));
  const packId = seat?.listId || position?.templateId;
  const pack = packId
    ? (listedPacks(data).find((item) => item.id === packId)
      || companyLists(data).find((item) => item.id === packId))
    : null;
  if (pack) return templateLabel(pack, ar);
  return String(seat?.list || "").trim();
}

function managerNameOf(employee, data) {
  if (!employee || !data) return "";
  const seat = seatForEmployee(data, employee.id);
  const managerId = seat?.reportsToEmployeeId
    || employee.profile?.directManagerId
    || employee.managerId
    || "";
  if (!managerId) return String(seat?.reportsToName || "").trim();
  const hit = (data.employees || []).find((item) => String(item.id) === String(managerId));
  return String(hit?.name || seat?.reportsToName || "").trim();
}

function formatIsoDate(iso, ar) {
  const key = String(iso || "").trim().slice(0, 10);
  if (!key) return "";
  const date = new Date(`${key}T00:00:00`);
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleDateString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatHireDate(employee, ar) {
  return formatIsoDate(
    employee?.profile?.hireDate || employee?.hireDate || employee?.startDate || "",
    ar,
  );
}

function employmentStatusOf(employee, ar) {
  if (!employee) return { label: "", style: OK };
  const hireIso = String(
    employee.profile?.hireDate || employee.hireDate || employee.startDate || "",
  ).trim().slice(0, 10);
  const hireDate = hireIso ? new Date(`${hireIso}T00:00:00`) : null;
  const preStart = hireDate && !Number.isNaN(hireDate.getTime()) && hireDate > new Date();
  if (preStart) {
    return { label: ar ? "قيد المباشرة" : "Pending start", style: WARN };
  }

  const raw = String(employee.profile?.employmentStatus || "").trim().toLowerCase();
  if (raw === "suspended") {
    return { label: ar ? "موقوف" : "Suspended", style: WARN };
  }
  if (raw === "terminated") {
    return { label: ar ? "منتهي الخدمة" : "Terminated", style: WARN };
  }
  if (raw === "draft" || raw === "not_hired") {
    return { label: ar ? "بلا تعيين مكتمل" : "Hire incomplete", style: WARN };
  }
  if (employee.active === false) {
    return { label: ar ? "غير نشط" : "Inactive", style: WARN };
  }
  if (raw === "active" || !raw) {
    return { label: ar ? "نشط" : "Active", style: OK };
  }
  return { label: raw, style: WARN };
}

function actingLabelOf(employee, data, ar) {
  const live = activeActingAssignments(employee);
  if (!live.length) return "";
  return live.map((item) => {
    const branch = (data?.stations || []).find(
      (station) => String(station.id) === String(item.stationId),
    )?.name || "";
    const until = String(item.until || "").slice(0, 10);
    const untilNice = until ? formatIsoDate(until, ar) : "";
    const bits = [
      item.title || (ar ? "وكالة" : "Acting"),
      branch,
      untilNice ? (ar ? `حتى ${untilNice}` : `until ${untilNice}`) : "",
    ].filter(Boolean);
    return bits.join(" · ");
  }).join(ar ? "؛ " : "; ");
}

function stationRoleOf(employee, station, ar) {
  if (!employee || !station) return "";
  if (String(station.managerId || "") === String(employee.id)) {
    return ar ? "مدير الفرع" : "Branch manager";
  }
  return "";
}

function FactCell({ label, value, dir, tip, ar }) {
  const text = value || "—";
  const tipText = tip || (typeof text === "string" && text !== "—" ? text : undefined);
  const ltrValue = dir === "ltr" && text !== "—";
  return (
    <div style={{ minWidth: 0, padding: "6px 8px", textAlign: "start" }}>
      <div
        style={{
          fontSize: ar ? 10 : 9,
          fontWeight: 600,
          letterSpacing: ar ? "normal" : "0.05em",
          color: MUTED,
          marginBottom: 2,
          lineHeight: ar ? 1.45 : 1.2,
          textAlign: "start",
        }}
      >
        {label}
      </div>
      <div
        title={tipText}
        dir={ltrValue ? "ltr" : undefined}
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: NAVY,
          lineHeight: ar ? 1.45 : 1.25,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          textAlign: "start",
          unicodeBidi: ltrValue ? "isolate" : undefined,
        }}
      >
        {text}
      </div>
    </div>
  );
}

function SectionRail({ title, ar }) {
  return (
    <div
      style={{
        gridColumn: "1 / -1",
        padding: "5px 8px 3px",
        fontSize: ar ? 10 : 9,
        fontWeight: 600,
        letterSpacing: ar ? "normal" : "0.07em",
        lineHeight: ar ? 1.45 : 1.2,
        color: MUTED,
        background: SURFACE,
        borderBottom: `1px solid ${BORDER}`,
        textAlign: "start",
      }}
    >
      {title}
    </div>
  );
}

function CellShell({ children, end, bottom, full }) {
  return (
    <div
      style={{
        gridColumn: full ? "1 / -1" : undefined,
        borderInlineEnd: end ? `1px solid ${BORDER}` : undefined,
        borderBottom: bottom ? `1px solid ${BORDER}` : undefined,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Org avatar click → premium institutional employee ID card (بطاقة موظف).
 * Fixed-size glance card: denser facts, no inner vertical scroll.
 */
export default function OrgEmployeePreview({
  open,
  employee = null,
  data = null,
  companyName = "",
  ar = true,
  vacantHint = "",
  onClose,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const brand = String(companyName || data?.settings?.companyName || "").trim()
    || (ar ? "المنشأة" : "Company");
  const logoUrl = String(data?.reportBranding?.logoUrl || data?.settings?.logoUrl || "").trim();
  const avatarUrl = String(employee?.profile?.avatarUrl || employee?.avatarUrl || "");
  const profile = employee?.profile || {};
  const title = employee ? occupantTitle(employee, data, ar) : "";
  const station = employee
    ? (data?.stations || []).find((item) => String(item.id) === String(employee.stationId))
    : null;
  const grade = employee ? employeeJobGrade(employee, data) : null;
  const gradeText = jobGradeLabel(grade);
  const email = String(employee?.email || profile.email || "").trim();
  const phone = String(employee?.phone || profile.phone || "").trim();
  const empNo = employee ? employeeNumberOf(employee) : "";
  const listLabel = employee ? listLabelOf(employee, data, ar) : "";
  const managerName = employee ? managerNameOf(employee, data) : "";
  const hireDate = employee ? formatHireDate(employee, ar) : "";
  const nationality = String(profile.nationality || "").trim();
  const nationalId = String(profile.nationalId || "").trim();
  const idType = profileFieldValue(profile, "idType", employee);
  const idLabel = idNumberFieldLabel(idType, ar);
  const birthDate = formatIsoDate(profileFieldValue(profile, "birthDate", employee), ar);
  const contractRaw = profileFieldValue(profile, "contractType", employee);
  const contractType = optionLabel(CONTRACT_TYPE_OPTIONS, contractRaw, ar) || String(contractRaw || "").trim();
  const department = String(profile.department || profile.unit || "").trim();
  const place = employee ? explainWorkplaceManager(data, employee.id, { ar }) : null;
  const stationRole = place?.many
    ? (ar ? `مدير · ${place.coversLabel}` : `Manager · ${place.coversLabel}`)
    : (employee ? stationRoleOf(employee, station, ar) : "");
  const acting = employee ? actingLabelOf(employee, data, ar) : "";
  const status = employmentStatusOf(employee, ar);
  const empty = !employee;

  return createPortal(
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 95,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(20,40,75,.44)",
        overflow: "hidden",
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={empty
          ? (ar ? "مقعد بلا موظف" : "Vacant seat")
          : (ar ? `بطاقة ${employee.name || "الموظف"}` : `Card for ${employee.name || "employee"}`)}
        dir={ar ? "rtl" : "ltr"}
        style={{
          ...identityFrame,
          width: 420,
          maxWidth: "100%",
          maxHeight: "min(90vh, 640px)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 28px 72px rgba(20,40,75,.28)",
          position: "relative",
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* Institutional navy header */}
        <div
          style={{
            background: NAVY_FILL,
            color: "#fff",
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            paddingInlineEnd: 40,
            flexShrink: 0,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              flexShrink: 0,
              overflow: "hidden",
              background: "#fff",
              border: "1px solid rgba(255,255,255,.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            ) : (
              <Logo size={20} wordmark={false} />
            )}
          </span>
          <div style={{ minWidth: 0, flex: 1, textAlign: "start" }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                lineHeight: ar ? 1.4 : 1.25,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {brand}
            </div>
            <div
              style={{
                fontSize: ar ? 10 : 9,
                marginTop: 2,
                color: "rgba(255,255,255,.68)",
                letterSpacing: ar ? "normal" : "0.04em",
                lineHeight: ar ? 1.4 : 1.2,
              }}
            >
              {ar ? "إدارة الموارد البشرية · بطاقة موظف" : "Human Resources · Employee ID"}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label={ar ? "إغلاق" : "Close"}
          style={{
            position: "absolute",
            top: 8,
            insetInlineEnd: 8,
            zIndex: 2,
            width: 26,
            height: 26,
            padding: 0,
            borderRadius: 7,
            border: "1px solid rgba(255,255,255,.22)",
            background: "rgba(255,255,255,.1)",
            color: "rgba(255,255,255,.88)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X style={{ width: 13, height: 13 }} />
        </button>

        {empty ? (
          <div style={{ padding: "20px 18px 16px", textAlign: "center", background: CARD }}>
            <div
              style={{
                margin: "0 auto",
                width: 64,
                height: 76,
                borderRadius: 12,
                border: `1.5px dashed ${BORDER}`,
                background: SURFACE,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: MUTED,
                fontSize: 18,
                fontWeight: 600,
              }}
            >
              —
            </div>
            <h2 style={{ margin: "12px 0 0", fontSize: ar ? 16 : 15, fontWeight: 600, color: NAVY, lineHeight: ar ? 1.4 : 1.25 }}>
              {ar ? "بلا موظف" : "Vacant"}
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: MUTED, lineHeight: ar ? 1.65 : 1.5, maxWidth: 260, marginInline: "auto", textAlign: "center" }}>
              {vacantHint || (ar ? "لا يوجد موظف على هذا المقعد." : "No employee on this seat.")}
            </p>
            <div style={{ marginTop: 14 }}>
              <button type="button" onClick={onClose} style={{ ...ui.btnGhost, padding: "6px 14px" }}>
                {ar ? "إغلاق" : "Close"}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Compact identity strip: photo + name side-by-side */}
            <div
              style={{
                padding: "12px 14px 10px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: CARD,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  width: 64,
                  height: 76,
                  borderRadius: 11,
                  background: NAVY_FILL,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  fontWeight: 600,
                  overflow: "hidden",
                  flexShrink: 0,
                  boxShadow: "0 6px 16px rgba(20,40,75,.12)",
                  border: `1px solid ${BORDER}`,
                }}
              >
                {avatarUrl
                  ? <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : initialsOf(employee.name)}
              </span>

              <div style={{ minWidth: 0, flex: 1, textAlign: "start" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexWrap: "nowrap",
                    minWidth: 0,
                  }}
                >
                  <h2
                    title={employee.name || undefined}
                    style={{
                      margin: 0,
                      fontSize: ar ? 16 : 15,
                      fontWeight: 700,
                      color: NAVY,
                      lineHeight: ar ? 1.4 : 1.25,
                      fontFamily: "var(--font-heading, 'Inter Tight', 'IBM Plex Sans Arabic', sans-serif)",
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      textAlign: "start",
                    }}
                  >
                    {employee.name || "—"}
                  </h2>
                  <span style={{ ...status.style, flexShrink: 0, fontSize: 10, padding: "2px 6px" }}>
                    {status.label}
                  </span>
                </div>
                <p
                  title={title || undefined}
                  style={{
                    margin: "3px 0 0",
                    fontSize: 12,
                    color: MUTED,
                    lineHeight: ar ? 1.45 : 1.3,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textAlign: "start",
                  }}
                >
                  {title || (ar ? "بلا منصب" : "No title")}
                </p>
                {empNo ? (
                  <p
                    title={empNo}
                    style={{
                      margin: "4px 0 0",
                      fontSize: 10,
                      fontWeight: 500,
                      color: MUTED,
                      lineHeight: ar ? 1.45 : 1.25,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      textAlign: "start",
                    }}
                  >
                    {ar ? "رقم الموظف · " : "Emp. no. · "}
                    <span
                      dir="ltr"
                      style={{
                        fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
                        letterSpacing: "0.02em",
                        unicodeBidi: "isolate",
                      }}
                    >
                      {empNo}
                    </span>
                  </p>
                ) : null}
              </div>
            </div>

            {/* One denser fact card — all groups, no nested scroll */}
            <div style={{ padding: "0 12px 8px", background: CARD, flex: "1 1 auto", minHeight: 0 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  border: `1px solid ${BORDER}`,
                  borderRadius: 10,
                  background: CARD,
                  overflow: "hidden",
                }}
              >
                <SectionRail ar={ar} title={ar ? "الهوية" : "Identity"} />
                <CellShell end bottom>
                  <FactCell ar={ar} label={ar ? "الجنسية" : "Nationality"} value={nationality} />
                </CellShell>
                <CellShell bottom>
                  <FactCell ar={ar} label={idLabel} value={nationalId} dir="ltr" tip={nationalId} />
                </CellShell>
                <CellShell end bottom>
                  <FactCell ar={ar} label={ar ? "تاريخ الميلاد" : "Birth date"} value={birthDate} dir={ar ? undefined : "ltr"} />
                </CellShell>
                <CellShell bottom>
                  <FactCell ar={ar} label={ar ? "نوع العقد" : "Contract type"} value={contractType} />
                </CellShell>

                <SectionRail ar={ar} title={ar ? "مكان العمل" : "Workplace"} />
                <CellShell end bottom>
                  <FactCell ar={ar} label={ar ? "الفرع" : "Branch"} value={station?.name || ""} />
                </CellShell>
                <CellShell bottom>
                  <FactCell ar={ar} label={ar ? "الإدارة" : "Department"} value={department} />
                </CellShell>
                <CellShell end bottom>
                  <FactCell ar={ar} label={ar ? "الدرجة" : "Grade"} value={gradeText} />
                </CellShell>
                <CellShell bottom>
                  <FactCell
                    ar={ar}
                    label={ar ? "دور الفرع" : "Station role"}
                    value={stationRole}
                    tip={place?.line || stationRole}
                  />
                </CellShell>
                <CellShell end bottom>
                  <FactCell ar={ar} label={ar ? "القائمة" : "Access list"} value={listLabel} />
                </CellShell>
                <CellShell bottom>
                  <FactCell ar={ar} label={ar ? "المدير المباشر" : "Manager"} value={managerName} />
                </CellShell>
                <CellShell end={Boolean(acting || place?.many)} bottom={!acting && !place?.many} full={!acting && !place?.many}>
                  <FactCell ar={ar} label={ar ? "تاريخ التعيين" : "Hire date"} value={hireDate} dir={ar ? undefined : "ltr"} />
                </CellShell>
                {place?.many ? (
                  <CellShell end={Boolean(acting)} bottom={!acting}>
                    <FactCell
                      ar={ar}
                      label={ar ? "يحضر من" : "Attends from"}
                      value={place.homeName}
                      tip={place.line}
                    />
                  </CellShell>
                ) : null}
                {acting ? (
                  <CellShell bottom>
                    <FactCell ar={ar} label={ar ? "الوكالة" : "Acting"} value={acting} tip={acting} />
                  </CellShell>
                ) : null}

                <SectionRail ar={ar} title={ar ? "التواصل" : "Contact"} />
                <CellShell end>
                  <FactCell ar={ar} label={ar ? "الجوال" : "Phone"} value={phone} dir="ltr" tip={phone} />
                </CellShell>
                <CellShell>
                  <FactCell ar={ar} label={ar ? "البريد" : "Email"} value={email} dir="ltr" tip={email} />
                </CellShell>
              </div>
            </div>

            <footer
              style={{
                padding: "8px 12px 12px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: CARD,
                flexShrink: 0,
              }}
            >
              {employee?.id ? (
                <Link
                  to={`/app/employees/${encodeURIComponent(employee.id)}`}
                  onClick={onClose}
                  style={{
                    ...ui.btnPrimary,
                    flex: 1,
                    textAlign: "center",
                    textDecoration: "none",
                    padding: "8px 12px",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  {ar ? "فتح الملف الكامل" : "Open full file"}
                </Link>
              ) : (
                <span style={{ flex: 1 }} />
              )}
              <button
                type="button"
                onClick={onClose}
                style={{
                  ...ui.btnGhost,
                  padding: "8px 12px",
                  fontSize: 13,
                }}
              >
                {ar ? "إغلاق" : "Close"}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
