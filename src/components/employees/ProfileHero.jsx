import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { base44 } from "@/api/base44Client";
import { updateEmployeeProfile } from "@/lib/store";
import { Loader2 } from "lucide-react";
import { employeeFileStatus } from "@/lib/employeeFileBoard";
import { employeeFileVoice } from "@/lib/employeeFileView";
import { readEmployeeNo } from "@/lib/employeeNumber";

/** Small «أنت» / «ملفي» chip — calm accent identity, never status red/ok. */
export function FileSelfBadge({ ar, kind = "you" }) {
  const label = kind === "file" ? (ar ? "ملفي" : "My file") : (ar ? "أنت" : "You");
  return (
    <span
      style={{
        display: "inline-block",
        width: "fit-content",
        flexShrink: 0,
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1.35,
        color: "var(--nv-ok-ink)",
        background: "var(--nv-ok-soft)",
        borderRadius: 999,
        padding: "2px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function markOf(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  return parts.slice(0, 2).map((part) => part[0]).join("");
}

function seatChip(label, name, vacantLabel) {
  const vacant = !String(name || "").trim();
  return `${label} · ${vacant ? vacantLabel : name}`;
}

/** Green identity card on the file — name, number, grade, and the org seats. */
export default function ProfileHero({
  employee,
  companyId,
  canEdit,
  roleLabel,
  stationName,
  currentUser,
  gradeLabel = "",
  managerName = "",
  hrName = "",
  serviceText = "",
  contractText = "",
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [uploading, setUploading] = useState(false);
  const avatarInput = useRef(null);
  const profile = employee.profile || {};
  const voice = employeeFileVoice({ employee, currentUser, ar });
  const status = employeeFileStatus(employee, ar);
  const employeeNo = readEmployeeNo(employee) || "—";
  const vacant = ar ? "شاغر" : "Vacant";
  const chips = [
    seatChip(ar ? "الفرع" : "Branch", stationName, "—"),
    seatChip(ar ? "المدير المباشر" : "Line manager", managerName, vacant),
    seatChip(ar ? "موارد الفرع" : "Branch HR", hrName, vacant),
  ];

  const upload = async (file) => {
    if (!file || !canEdit) return;
    setUploading(true);
    try {
      const up = await base44.integrations.Core.UploadFile({ file });
      updateEmployeeProfile(companyId, employee.id, { avatarUrl: up.file_url });
    } finally {
      setUploading(false);
    }
  };

  const metaLine = [serviceText || "—", contractText || "—"].filter(Boolean).join(" · ");

  return (
    <article
      dir={ar ? "rtl" : "ltr"}
      className="nv-file-hero"
      style={{
        background: "linear-gradient(135deg,#0B3D27,#0F5535)",
        color: "#F4F7F5",
        borderRadius: 14,
        padding: "20px 22px",
        display: "grid",
        gridTemplateColumns: "auto minmax(0,1fr)",
        gap: 18,
        alignItems: "center",
        boxShadow: "0 6px 18px rgba(6,61,38,.16)",
      }}
    >
      <button
        type="button"
        onClick={() => canEdit && avatarInput.current?.click()}
        disabled={!canEdit || uploading}
        title={canEdit ? (ar ? "تحديث الصورة" : "Update photo") : undefined}
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: "#C8A45A",
          color: "#0B3D27",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          fontWeight: 700,
          fontFamily: "inherit",
          flexShrink: 0,
          border: "none",
          padding: 0,
          cursor: canEdit ? "pointer" : "default",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {profile.avatarUrl
          ? <img src={profile.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : markOf(employee.name)}
        {uploading && (
          <span style={{
            position: "absolute", inset: 0, background: "rgba(11,61,39,.55)",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#F4F7F5",
          }}
          >
            <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
          </span>
        )}
      </button>
      <input
        ref={avatarInput}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => upload(e.target.files?.[0])}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <strong style={{ fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 700, lineHeight: 1.35 }}>{employee.name || "—"}</strong>
          {voice.own ? <FileSelfBadge ar={ar} kind="file" /> : null}
          <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 600, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 6, padding: "2px 9px", unicodeBidi: "isolate" }}>{employeeNo}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#E4C27A", whiteSpace: "nowrap" }}>{gradeLabel || "—"}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#0B3D27", background: "#C8A45A", borderRadius: 999, padding: "2px 8px" }}>{status.label}</span>
        </span>
        <span style={{ fontSize: 13, color: "#C5DBCD" }}>{[roleLabel, stationName].filter(Boolean).join(" · ") || "—"}</span>
        <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {chips.map((chip) => (
            <span key={chip} style={{ display: "inline-flex", alignItems: "center", height: 24, padding: "0 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "rgba(255,255,255,.14)", color: "#F4F7F5", border: "1px solid rgba(255,255,255,.22)" }}>{chip}</span>
          ))}
        </span>
        <span style={{ fontSize: 12, color: "#A9CDB8" }}>{metaLine}</span>
        {voice.own ? (
          <span style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
            <Link to="/app/requests" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 36, padding: "0 14px", borderRadius: 8, background: "#C8A45A", color: "#0B3D27", fontSize: 12.5, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>{ar ? "طلب جديد" : "New request"}</Link>
            <Link to="/app/payroll?view=self&tab=payslip" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 36, padding: "0 14px", borderRadius: 8, border: "1px solid rgba(244,247,245,.35)", color: "#F4F7F5", fontSize: 12.5, textDecoration: "none", whiteSpace: "nowrap" }}>{ar ? "قسيمتي" : "My payslip"}</Link>
            <Link to="/app/signing" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 36, padding: "0 14px", borderRadius: 8, border: "1px solid rgba(244,247,245,.35)", color: "#F4F7F5", fontSize: 12.5, textDecoration: "none", whiteSpace: "nowrap" }}>{ar ? "توقيعاتي" : "My signatures"}</Link>
          </span>
        ) : null}
      </div>
    </article>
  );
}
