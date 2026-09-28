import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ImageUp, Loader2, Trash2 } from "lucide-react";
import SectionBackLink from "@/components/shared/SectionBackLink";
import { base44 } from "@/api/base44Client";
import { updateEmployeeProfile } from "@/lib/store";
import { generateVerificationId, verificationUrlFor } from "@/lib/verificationBadge";
import {
  DEFAULT_STAMP_CONFIG,
  STAMP_ACCENTS,
  STAMP_DESIGNS,
  STAMP_INKS,
  STAMP_MARK_COLORS,
  STAMP_NAME_FONTS,
  STAMP_PAPERS,
  normalizeStampConfig,
  renderStampDataUrl,
  stampDesign,
} from "@/lib/stampStudio";
import SigningSlab from "./SigningSlab";
import StampHandMark from "./StampHandMark";
import StampMarkStage from "./StampMarkStage";
import { signGhostBtn, signMono as mono, signPrimaryBtn } from "./signingUi";
import { BORDER, CARD, INK, MUTED, SURFACE } from "@/lib/platformStyles";

const MAX_LOGO = 2 * 1024 * 1024;

const fieldStyle = {
  fontFamily: "inherit",
  fontSize: 13,
  padding: "8px 10px",
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  background: CARD,
  color: INK,
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
};

const labelStyle = { display: "flex", flexDirection: "column", gap: 5, fontSize: 11, color: MUTED };

function Swatches({ options, value, onPick, onFree, freeLabel }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {options.map((option) => {
        const on = String(value || "").toUpperCase() === option.hex.toUpperCase();
        return (
          <button
            key={option.hex}
            type="button"
            title={option.name}
            aria-label={option.name}
            onClick={() => onPick(option.hex)}
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: option.hex,
              border: `3px solid ${on ? "var(--nv-navy, #14284B)" : CARD}`,
              boxShadow: `0 0 0 1px ${BORDER}`,
              cursor: "pointer",
              padding: 0,
            }}
          />
        );
      })}
      <label
        title={freeLabel}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 30,
          padding: "0 10px",
          borderRadius: 999,
          border: `1px solid ${BORDER}`,
          background: CARD,
          cursor: "pointer",
          fontSize: 11,
          color: MUTED,
        }}
      >
        <span style={{ width: 14, height: 14, borderRadius: "50%", background: value || "var(--nv-navy)", boxShadow: `0 0 0 1px ${BORDER}` }} />
        <span dir="ltr" style={{ ...mono, fontSize: 10 }}>{(value || "#0B3D27").toUpperCase()}</span>
        <input
          type="color"
          value={value || "#0B3D27"}
          onChange={(event) => onFree(event.target.value)}
          style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
        />
      </label>
    </div>
  );
}

export default function StampStudio({ companyId, companyName, currentUser, ar, onClose, onSaved }) {
  const profile = currentUser?.profile || {};
  const logoInputRef = useRef(null);
  const [config, setConfig] = useState(() => normalizeStampConfig({
    ...DEFAULT_STAMP_CONFIG,
    ...(profile.stampConfig || {}),
    name: profile.stampConfig?.name || profile.signatureName || currentUser?.name || "",
    role: profile.stampConfig?.role || currentUser?.role || "",
    company: profile.stampConfig?.company || DEFAULT_STAMP_CONFIG.company,
  }));
  const [sealId] = useState(() => String(profile.signatureId || "").trim() || generateVerificationId());
  const [preview, setPreview] = useState("");
  const [rendering, setRendering] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const patch = useCallback((next) => {
    setConfig((current) => normalizeStampConfig({ ...current, ...next }));
    setSaved(false);
  }, []);

  // The preview is produced by the same renderer that writes the PDF artwork, so
  // there is no second source of truth to drift.
  useEffect(() => {
    let alive = true;
    setRendering(true);
    const timer = setTimeout(() => {
      renderStampDataUrl(config, {
        verificationId: sealId,
        verificationUrl: verificationUrlFor(sealId),
        hideMark: Boolean(config.markUrl),
        hideName: true,
      })
        .then((url) => { if (alive) { setPreview(url); setRendering(false); } })
        .catch(() => { if (alive) setRendering(false); });
    }, 110);
    return () => { alive = false; clearTimeout(timer); };
  }, [config.design, config.accent, config.ink, config.paper, config.role, config.company, config.logoUrl, config.markUrl, sealId]);

  const design = useMemo(() => stampDesign(config.design), [config.design]);

  const pickLogo = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    if (file.size > MAX_LOGO) {
      setError(ar ? "حجم الشعار الأقصى 2 ميجابايت." : "The logo limit is 2MB.");
      if (logoInputRef.current) logoInputRef.current.value = "";
      return;
    }
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    });
    if (!dataUrl) {
      setError(ar ? "تعذّرت قراءة الصورة." : "Couldn't read the image.");
      return;
    }
    patch({ logoUrl: dataUrl });
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      // The logo lives in the profile, so park it on storage rather than carrying
      // a base64 blob in local state forever. A failed upload keeps the data url.
      let logoUrl = config.logoUrl;
      if (logoUrl.startsWith("data:")) {
        try {
          const blob = await fetch(logoUrl).then((response) => response.blob());
          const upload = await base44.integrations.Core.UploadFile({ file: new File([blob], "stamp-logo.png", { type: blob.type || "image/png" }) });
          if (upload?.file_url) logoUrl = upload.file_url;
        } catch { /* keep the inline copy */ }
      }
      const finalConfig = normalizeStampConfig({ ...config, logoUrl });
      const dataUrl = await renderStampDataUrl(finalConfig, { verificationId: sealId, verificationUrl: verificationUrlFor(sealId) });
      const stampBlob = await fetch(dataUrl).then((response) => response.blob());
      let signatureUrl = dataUrl;
      try {
        const upload = await base44.integrations.Core.UploadFile({ file: new File([stampBlob], "stamp.png", { type: "image/png" }) });
        if (upload?.file_url) signatureUrl = upload.file_url;
      } catch { /* preview mode keeps the inline stamp */ }

      const savedProfile = {
        signatureUrl,
        signatureRawUrl: finalConfig.markUrl || "",
        signatureVariant: "studio",
        signatureId: sealId,
        signatureName: finalConfig.name || currentUser?.name || "",
        signatureUpdatedAt: new Date().toISOString(),
        stampConfig: finalConfig,
      };
      updateEmployeeProfile(companyId, currentUser.id, savedProfile);
      setConfig(finalConfig);
      setSaved(true);
      onSaved?.(savedProfile);
      onClose?.();
    } catch (err) {
      setError((ar ? "تعذّر حفظ الختم — " : "Couldn't save the seal — ") + (err?.message || ""));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      className="nv-signing-workspace nv-sign-frame"
      style={{
        display: "grid",
        gridTemplateRows: "56px minmax(0, 1fr)",
        minHeight: 520,
        height: "calc(100dvh - 132px)",
        background: "var(--nv-soft)",
        border: "1px solid var(--nv-line)",
        borderRadius: 14,
        boxShadow: "0 1px 2px var(--nv-shadow2), 0 10px 26px var(--nv-shadow)",
        overflow: "hidden",
        fontSize: 13,
        color: "var(--nv-ink)",
        width: "min(1320px, 100%)",
        margin: "0 auto",
      }}
    >
      <header style={{ background: CARD, borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 16, padding: "0 16px", minWidth: 0 }}>
        <SectionBackLink ar={ar} label={ar ? "التوقيع الرقمي" : "Digital signing"} onClick={onClose} />
        <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 600 }}>{ar ? "ستوديو الختم" : "Stamp studio"}</span>
          <span dir="ltr" style={{ ...mono, fontSize: 11, color: MUTED, textAlign: ar ? "right" : "left" }}>
            {`${design.w}×${design.h} · ${sealId}`}
          </span>
        </div>
        <div style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 12, flex: "none" }}>
          <span style={{ fontSize: 12, color: saved ? "var(--nv-ok-ink)" : MUTED, display: "inline-flex", alignItems: "center", gap: 5 }}>
            {saved ? <Check style={{ width: 13, height: 13 }} /> : null}
            {saved ? (ar ? "محفوظ كختمك" : "Saved as your seal") : (ar ? "تغييرات غير محفوظة" : "Unsaved changes")}
          </span>
          <button type="button" onClick={save} disabled={saving} style={{ ...signPrimaryBtn, opacity: saving ? 0.5 : 1 }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {ar ? "حفظ كختمي" : "Save as my seal"}
          </button>
        </div>
      </header>

      <div style={{ overflow: "auto", padding: 16 }}>
        <div
          className="nv-stamp-studio-grid"
          style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 380px)", gap: 16, alignItems: "start", maxWidth: 1180, margin: "0 auto" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            <SigningSlab title={ar ? "المعاينة" : "Preview"} meta={ar ? "اسحب الاسم وخط اليد — ما تراه هو ما يُطبع" : "Drag the name and handwriting — what you see is printed"} pad={0}>
              <div style={{
                minHeight: 320,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px 20px 8px",
                backgroundImage: `radial-gradient(${BORDER} 1px, transparent 1px)`,
                backgroundSize: "18px 18px",
                overflow: "hidden",
              }}>
                {preview ? (
                  <StampMarkStage
                    src={preview}
                    config={config}
                    onPatch={patch}
                    ar={ar}
                    rendering={rendering}
                  />
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin" style={{ color: MUTED }} />
                )}
              </div>
            </SigningSlab>

            <SigningSlab
              title={ar ? "شارة التوقيع" : "Signature mark"}
              meta={ar ? "رسم أو رفع — تُدمج في الختم" : "Draw or upload — joined into the seal"}
            >
              <StampHandMark
                ar={ar}
                name={config.name}
                markUrl={config.markUrl}
                onMark={(markUrl) => patch({ markUrl: markUrl || "" })}
              />
            </SigningSlab>

            <SigningSlab title={ar ? "الشكل" : "Shape"} meta={ar ? `${STAMP_DESIGNS.length} أشكال` : `${STAMP_DESIGNS.length} shapes`}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(108px, 1fr))", gap: 8 }}>
                {STAMP_DESIGNS.map((item) => {
                  const on = config.design === item.id;
                  const wide = item.w / item.h;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => patch({ design: item.id })}
                      style={{
                        fontFamily: "inherit",
                        fontSize: 12,
                        padding: "12px 8px 10px",
                        borderRadius: 10,
                        border: `1.5px solid ${on ? "var(--nv-navy)" : BORDER}`,
                        background: on ? SURFACE : CARD,
                        color: INK,
                        fontWeight: on ? 600 : 400,
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 9,
                      }}
                    >
                      <span style={{ width: 62, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{
                          width: wide >= 1 ? 56 : Math.max(20, 40 * wide),
                          height: wide >= 1 ? Math.max(16, 56 / wide) : 40,
                          maxHeight: 42,
                          background: on ? config.paper : CARD,
                          border: `1.5px solid ${on ? config.accent : "var(--nv-line)"}`,
                          borderRadius: item.id === "seal" ? "50%" : item.id === "line" ? 0 : 6,
                          clipPath: item.id === "hex" ? "polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)" : "none",
                          display: "block",
                          boxSizing: "border-box",
                        }} />
                      </span>
                      {ar ? item.ar : item.en}
                    </button>
                  );
                })}
              </div>
            </SigningSlab>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            <SigningSlab title={ar ? "الألوان" : "Colours"} meta={ar ? "حرّة بالكامل" : "Fully free"}>
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "grid", gap: 7 }}>
                  <span style={{ fontSize: 11, color: MUTED }}>{ar ? "لون التمييز — الإطار والرمز" : "Accent — frame and code"}</span>
                  <Swatches
                    options={STAMP_ACCENTS}
                    value={config.accent}
                    onPick={(hex) => patch({ accent: hex })}
                    onFree={(hex) => patch({ accent: hex })}
                    freeLabel={ar ? "لون مخصص" : "Custom colour"}
                  />
                </div>
                <div style={{ display: "grid", gap: 7 }}>
                  <span style={{ fontSize: 11, color: MUTED }}>{ar ? "لون النص والهيكل" : "Ink — text and structure"}</span>
                  <Swatches
                    options={STAMP_INKS}
                    value={config.ink}
                    onPick={(hex) => patch({ ink: hex })}
                    onFree={(hex) => patch({ ink: hex })}
                    freeLabel={ar ? "لون مخصص" : "Custom colour"}
                  />
                </div>
                <div style={{ display: "grid", gap: 7 }}>
                  <span style={{ fontSize: 11, color: MUTED }}>{ar ? "الخلفية" : "Paper"}</span>
                  <Swatches
                    options={STAMP_PAPERS}
                    value={config.paper}
                    onPick={(hex) => patch({ paper: hex })}
                    onFree={(hex) => patch({ paper: hex })}
                    freeLabel={ar ? "لون مخصص" : "Custom colour"}
                  />
                </div>
                <div style={{ display: "grid", gap: 7 }}>
                  <span style={{ fontSize: 11, color: MUTED }}>{ar ? "لون خط اليد" : "Handwriting colour"}</span>
                  <Swatches
                    options={STAMP_MARK_COLORS}
                    value={config.markColor || ""}
                    onPick={(hex) => patch({ markColor: hex })}
                    onFree={(hex) => patch({ markColor: hex })}
                    freeLabel={ar ? "لون مخصص" : "Custom colour"}
                  />
                  <button
                    type="button"
                    onClick={() => patch({ markColor: "" })}
                    style={{
                      ...signGhostBtn,
                      fontSize: 11,
                      padding: "5px 10px",
                      alignSelf: "start",
                      opacity: config.markColor ? 1 : 0.45,
                    }}
                  >
                    {ar ? "كما رُسم" : "As drawn"}
                  </button>
                </div>
              </div>
            </SigningSlab>

            <SigningSlab title={ar ? "الشعار" : "Logo"} meta="PNG / SVG ≤ 2MB">
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{
                    width: 54,
                    height: 54,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 10,
                    background: SURFACE,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    flex: "none",
                  }}>
                    {config.logoUrl
                      ? <img src={config.logoUrl} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                      : <span style={{ fontSize: 10, color: MUTED }}>{ar ? "بصمة" : "mark"}</span>}
                  </span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => logoInputRef.current?.click()} style={signGhostBtn}>
                      <ImageUp style={{ width: 14, height: 14 }} />
                      {config.logoUrl ? (ar ? "استبدال" : "Replace") : (ar ? "رفع شعار" : "Upload logo")}
                    </button>
                    {config.logoUrl ? (
                      <button type="button" onClick={() => patch({ logoUrl: "" })} style={{ ...signGhostBtn, color: "var(--nv-bad-ink)" }}>
                        <Trash2 style={{ width: 14, height: 14 }} />
                        {ar ? "حذف" : "Remove"}
                      </button>
                    ) : null}
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 11, lineHeight: 1.7, color: MUTED }}>
                  {ar
                    ? "الشعار اختياري بالكامل. إن لم ترفعه يبقى الختم بالاسم والتوقيع والتحقق فقط."
                    : "The logo is entirely optional. Without one the seal keeps the name, signature and verification only."}
                </p>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg"
                  onChange={pickLogo}
                  style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
                />
              </div>
            </SigningSlab>

            <SigningSlab title={ar ? "البيانات" : "Identity"}>
              <div style={{ display: "grid", gap: 10 }}>
                <label style={labelStyle}>
                  {ar ? "الاسم" : "Name"}
                  <input value={config.name} onChange={(event) => patch({ name: event.target.value })} style={fieldStyle} />
                </label>
                <div style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 11, color: MUTED }}>{ar ? "خط الاسم" : "Name font"}</span>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
                    {STAMP_NAME_FONTS.map((item) => {
                      const on = (config.nameFont || "amiri") === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => patch({ nameFont: item.id })}
                          style={{
                            fontFamily: item.family,
                            fontSize: 13,
                            padding: "8px 4px",
                            borderRadius: 10,
                            border: `1px solid ${on ? "var(--nv-navy)" : BORDER}`,
                            background: on ? SURFACE : CARD,
                            color: INK,
                            fontWeight: on ? 600 : 400,
                            cursor: "pointer",
                          }}
                        >
                          {ar ? item.ar : item.en}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <label style={labelStyle}>
                  {ar ? "الصفة" : "Capacity"}
                  <input value={config.role} onChange={(event) => patch({ role: event.target.value })} style={fieldStyle} />
                </label>
                <label style={labelStyle}>
                  {ar ? "اسم الشركة (لاتيني)" : "Company (latin)"}
                  <input
                    dir="ltr"
                    value={config.company}
                    onChange={(event) => patch({ company: event.target.value.toUpperCase() })}
                    style={{ ...fieldStyle, ...mono, textAlign: ar ? "right" : "left" }}
                  />
                </label>
                {companyName ? (
                  <p style={{ margin: 0, fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
                    {ar ? `الشركة المسجّلة: ${companyName}` : `Registered company: ${companyName}`}
                  </p>
                ) : null}
              </div>
            </SigningSlab>

            <SigningSlab title={ar ? "الجزء غير القابل للتعديل" : "The part you cannot author"}>
              <div style={{ ...mono, fontSize: 11, display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: "5px 12px", color: INK }}>
                <span style={{ color: MUTED }}>{ar ? "المرجع" : "REF"}</span>
                <span dir="ltr" style={{ color: config.accent, fontWeight: 500, textAlign: ar ? "right" : "left" }}>{sealId}</span>
                <span style={{ color: MUTED }}>{ar ? "الخوارزمية" : "ALG"}</span>
                <span>{ar ? "بصمة الملف" : "SHA-256"}</span>
                <span style={{ color: MUTED }}>{ar ? "رمز التحقق" : "QR"}</span>
                <span dir="ltr" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: ar ? "right" : "left" }}>/verify?id={sealId}</span>
              </div>
              <p style={{ margin: "10px 0 0", fontSize: 11, color: MUTED, lineHeight: 1.7 }}>
                {ar
                  ? "كل مستند يُختم برقم تحقق خاص به يُولَّد لحظة التوقيع؛ الرقم أعلاه هو رقم هويتك للمعاينة فقط."
                  : "Every document is sealed with its own verification id generated at signing time; the id above is your identity's preview code."}
              </p>
            </SigningSlab>

            {error ? <p style={{ margin: 0, fontSize: 12, color: "var(--nv-bad-ink)", lineHeight: 1.6 }}>{error}</p> : null}
            <p style={{ margin: 0, fontSize: 11, color: MUTED, lineHeight: 1.7, textAlign: "center" }}>
              {ar
                ? "ختم واحد لكل شخص. الحفظ يستبدل الختم السابق ويبقى المستندات الموقّعة سابقًا كما هي."
                : "One seal per person. Saving replaces the previous seal; documents already signed keep the artwork they were sealed with."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
