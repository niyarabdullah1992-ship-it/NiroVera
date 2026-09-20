import { updateEmployeeProfile } from "@/lib/store";
import { generateVerificationId, verificationUrlFor } from "@/lib/verificationBadge";
import { normalizeStampConfig, renderStampDataUrl } from "@/lib/stampStudio";

/** One personal seal lives on the employee profile and is reused everywhere. */
export function sealFromProfile(profile) {
  if (!profile || typeof profile !== "object") return null;
  if (!profile.stampConfig && !profile.signatureUrl) return null;
  return {
    signatureUrl: profile.signatureUrl || "",
    signatureRawUrl: profile.signatureRawUrl || "",
    signatureVariant: profile.signatureVariant || "studio",
    signatureId: profile.signatureId || "",
    stampConfig: profile.stampConfig || null,
    preview: profile.signatureUrl || "",
  };
}

export async function persistPersonalSeal({ companyId, userId, user, config, signatureUrl = "" }) {
  if (!companyId || !userId || !config) return null;
  const finalConfig = normalizeStampConfig(config);
  const sealId = String(user?.profile?.signatureId || "").trim() || generateVerificationId();
  const dataUrl = signatureUrl || await renderStampDataUrl(finalConfig, {
    verificationId: sealId,
    verificationUrl: verificationUrlFor(sealId),
  });
  const saved = {
    signatureUrl: dataUrl,
    signatureRawUrl: finalConfig.markUrl || "",
    signatureVariant: "studio",
    signatureId: sealId,
    signatureName: finalConfig.name || user?.name || "",
    signatureUpdatedAt: new Date().toISOString(),
    stampConfig: finalConfig,
  };
  updateEmployeeProfile(companyId, userId, saved);
  return saved;
}
