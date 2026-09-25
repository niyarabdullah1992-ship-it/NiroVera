import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/PowerCareAuth";
import { updateCompany } from "@/lib/store";
import { base44 } from "@/api/base44Client";
import { ChromeBox } from "@/components/shared/IdentityCard";
import AttachFileButton from "@/components/shared/AttachFileButton";
import { ACCENT, BORDER, MUTED, NAVY, SURFACE, field, ui } from "@/lib/platformStyles";
import { brandReportColor, PDF_THEME } from "@/lib/pdfTheme";
import { canEditPlatformTheme } from "@/lib/platformTheme";

export default function BrandingSettingsCard({ lang = "ar" }) {
  const ar = lang === "ar";
  const { company, data, currentUser, refresh } = useAuth();
  const canEdit = canEditPlatformTheme(currentUser, data);
  const existing = data?.reportBranding || {};
  const [logoUrl, setLogoUrl] = useState(existing.logoUrl || "");
  const [color, setColor] = useState(brandReportColor(existing.color || PDF_THEME.navy));
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLogoUrl(existing.logoUrl || "");
    setColor(brandReportColor(existing.color || PDF_THEME.navy));
  }, [existing.logoUrl, existing.color]);

  useEffect(() => {
    if (!company?.id) return;
    base44.functions.invoke("settings", { action: "getReportBranding", companyId: company.id })
      .then((res) => {
        const remote = res?.data?.reportBranding || res?.reportBranding;
        if (!remote) return;
        if (remote.logoUrl) setLogoUrl(remote.logoUrl);
        if (remote.color) setColor(brandReportColor(remote.color));
      })
      .catch(() => {});
  }, [company?.id]);

  const persist = async (next) => {
    if (!company?.id || !canEdit) return;
    setBusy(true);
    try {
      updateCompany(company.id, (d) => {
        d.reportBranding = next;
      }, { sync: "none" });
      try {
        await base44.functions.invoke("settings", {
          action: "setReportBranding",
          companyId: company.id,
          reportBranding: next,
        });
      } catch {
        /* local persist is enough in preview */
      }
      refresh?.();
      setHint(ar ? "حُفظ شعار الشركة لتقارير Excel وPDF." : "Company mark saved for Excel and PDF reports.");
    } finally {
      setBusy(false);
    }
  };

  const onFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || "");
      setLogoUrl(url);
      persist({ logoUrl: url, color });
    };
    reader.readAsDataURL(file);
  };

  return (
    <ChromeBox>
      <div style={{ fontSize: 11, letterSpacing: "0.1em", color: ACCENT, fontWeight: 600 }}>
        {ar ? "هوية التقارير" : "Report letterhead"}
      </div>
      <div style={{ marginTop: 6, fontSize: 13, fontWeight: 600, color: NAVY }}>
        {ar ? "شعار الشركة على الورقة" : "Company mark on the page"}
      </div>
      <p style={{ margin: "6px 0 0", fontSize: 12, color: MUTED, lineHeight: 1.7, maxWidth: 640 }}>
        {ar
          ? "يتصدّر شعار شركتك ملف Excel وPDF. NiroVera تبقى صغيرة في التذييل."
          : "Your company mark leads Excel and PDF files. NiroVera stays small in the footer."}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 16, alignItems: "center" }}>
        <div
          style={{
            width: 72,
            height: 72,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            background: SURFACE,
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
          }}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          ) : (
            <span style={{ fontSize: 10, color: MUTED }}>{ar ? "بلا شعار" : "No mark"}</span>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <AttachFileButton
            ar={ar}
            accept="image/*"
            disabled={!canEdit || busy}
            label={ar ? "أرفق الشعار" : "Attach the mark"}
            onPick={(file) => onFile({ target: { files: file ? [file] : [] } })}
          />
          <label style={{ ...ui, fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
            {ar ? "لون الأعمدة" : "Column color"}
            <input
              type="color"
              value={color}
              disabled={!canEdit}
              onChange={(e) => {
                const next = brandReportColor(e.target.value);
                setColor(next);
                persist({ logoUrl, color: next });
              }}
              style={{ ...field, width: 48, padding: 2, height: 32 }}
            />
          </label>
        </div>
      </div>
      {hint ? <p style={{ margin: "10px 0 0", fontSize: 11, color: MUTED }}>{hint}</p> : null}
    </ChromeBox>
  );
}
