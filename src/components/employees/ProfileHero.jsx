import React, { useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { base44 } from "@/api/base44Client";
import { updateEmployeeProfile } from "@/lib/store";
import { Loader2 } from "lucide-react";
import { employeeFileStatus } from "@/lib/employeeFileBoard";
import { employeeFileVoice } from "@/lib/employeeFileView";
import { readEmployeeNo } from "@/lib/employeeNumber";

const STATUS = {
  ok: { bg: "#E6F2EA", fg: "#2F6B43" },
  bad: { bg: "#FBEBED", fg: "#9B2335" },
  warn: { bg: "#FBF3E1", fg: "#8A5A12" },
};

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
        color: "#2F6B43",
        background: "#E6F2EA",
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

/** Identity row on the file — same monogram as the daily-ops cards. */
export default function ProfileHero({ employee, companyId, canEdit, roleLabel, grade, stationName, currentUser }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [uploading, setUploading] = useState(false);
  const avatarInput = useRef(null);
  const profile = employee.profile || {};
  const voice = employeeFileVoice({ employee, currentUser, ar });
  const status = employeeFileStatus(employee, ar);
  const paint = STATUS[status.kind] || STATUS.warn;
  const employeeNo = readEmployeeNo(employee);
  const dept = profile.department || grade?.label || grade?.name || "";
  const meta = [roleLabel, dept, stationName].filter(Boolean);

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

  return (
    <div dir={ar ? "rtl" : "ltr"} style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: "1 1 240px" }}>
      <button
        type="button"
        onClick={() => canEdit && avatarInput.current?.click()}
        disabled={!canEdit || uploading}
        title={canEdit ? (ar ? "تحديث الصورة" : "Update photo") : undefined}
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          background: "#0B3D27",
          color: "#FBF3E1",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "inherit",
          flexShrink: 0,
          border: "none",
          boxShadow: "inset 0 0 0 1px rgba(200,164,90,.35)",
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
            display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
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

      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 16, fontWeight: 700, color: "#111418", lineHeight: 1.35 }}>{employee.name || "—"}</span>
          {voice.own ? <FileSelfBadge ar={ar} kind="file" /> : null}
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            color: paint.fg,
            background: paint.bg,
            borderRadius: 999,
            padding: "2px 8px",
          }}
          >
            {status.label}
          </span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {employeeNo ? (
            <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#555C66", unicodeBidi: "isolate" }}>{employeeNo}</span>
          ) : null}
          {meta.map((part) => (
            <span key={part} style={{ fontSize: 11, fontWeight: 600, color: "#3A4048", background: "#F4F7F5", borderRadius: 999, padding: "2px 8px" }}>{part}</span>
          ))}
        </span>
      </div>
    </div>
  );
}
