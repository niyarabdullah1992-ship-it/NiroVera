import React, { useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { base44 } from "@/api/base44Client";
import { updateEmployeeProfile } from "@/lib/store";
import { Loader2 } from "lucide-react";
import { MUTED, NAVY, BORDER } from "@/lib/platformStyles";
import { employeeFileStatus } from "@/lib/employeeFileBoard";
import { employeeFileVoice } from "@/lib/employeeFileView";

/** Small «أنت» / «ملفي» chip — one restrained green accent. */
export function FileSelfBadge({ ar, kind = "you" }) {
  const label = kind === "file" ? (ar ? "ملفي" : "My file") : (ar ? "أنت" : "You");
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        color: "#137A49",
        background: "#F2FAF6",
        border: "1px solid #BFE6D2",
        padding: "1px 7px",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

/** Platform isEmpFile hero — L2623–2646 (inline styles AS-IS). */
export default function ProfileHero({ employee, companyId, canEdit, roleLabel, grade, stationName, currentUser }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [uploading, setUploading] = useState(false);
  const avatarInput = useRef(null);
  const profile = employee.profile || {};
  const voice = employeeFileVoice({ employee, currentUser, ar });

  const status = employeeFileStatus(employee, ar);

  const initials = (employee.name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const dept = profile.department || grade?.label || grade?.name || "";
  const meta = [roleLabel, dept, stationName].filter(Boolean).join(" · ");

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
    <div dir={ar ? "rtl" : "ltr"} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={() => canEdit && avatarInput.current?.click()}
        disabled={!canEdit || uploading}
        title={canEdit ? (ar ? "تحديث الصورة" : "Update photo") : undefined}
        style={{
          width: 46,
          height: 46,
          borderRadius: "50%",
          background: "#F5F6F8",
          color: NAVY,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          fontWeight: 700,
          fontFamily: "inherit",
          flexShrink: 0,
          border: `1px solid ${BORDER}`,
          padding: 0,
          cursor: canEdit ? "pointer" : "default",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {profile.avatarUrl
          ? <img src={profile.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : initials}
        {uploading && (
          <span style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
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

      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, letterSpacing: ".08em", color: MUTED }}>{voice.title}</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: NAVY }}>{employee.name}</span>
          {voice.own ? <FileSelfBadge ar={ar} kind="file" /> : null}
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: status.kind === "ok" ? "#137A49" : status.kind === "bad" ? "#8A1C2B" : "#8A6516",
            background: status.kind === "ok" ? "#F2FAF6" : status.kind === "bad" ? "#FBF1F2" : "#FDF6E8",
            border: `1px solid ${status.kind === "ok" ? "#BFE6D2" : status.kind === "bad" ? "#E9C4C9" : "#ECD9A8"}`,
            padding: "2px 9px",
          }}
          >
            {status.label}
          </span>
        </span>
        <span style={{ fontSize: 12, color: MUTED }}>{meta || "—"}</span>
      </div>
    </div>
  );
}
