import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { makeSignatureStamp, stampOnPdf } from "@/lib/multiSignStamp";
import { sha256HexOfBuffer } from "@/lib/fileHash";
import { clampStampScale } from "@/lib/signatureStampGeometry";
import { isMarkField } from "@/lib/signPdf";
import { invokeLocalMultiSign, shouldUseLocalMultiSign } from "@/lib/localMultiSignFallback";
import { createGateMessage } from "@/lib/multiSignDerivations";
import { DEFAULT_STAMP_CONFIG, normalizeStampConfig, stampConfigFromSigner } from "@/lib/stampStudio";
import { persistPersonalSeal } from "@/lib/personalSeal";
import { settleWrittenConsentFromSigning } from "@/lib/store";

const captureLocation = () => new Promise((resolve) => {
  if (!navigator.geolocation) return resolve({ available: false });
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => resolve({ available: true, lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy }),
    () => resolve({ available: false }),
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
  );
});

export default function usePublicSigning(explicitToken, options = {}) {
  const token = explicitToken || new URLSearchParams(window.location.search).get("token") || "";
  const [ar, setAr] = useState(true);
  const [info, setInfo] = useState(null);
  const [failure, setFailure] = useState(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [stage, setStage] = useState("");
  const [done, setDone] = useState(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("type");
  const [sigSize, setSigSize] = useState(100);
  const [chosenSpot, setChosenSpot] = useState(null);
  const [stampPreview, setStampPreview] = useState("");
  const [stampTheme, setStampTheme] = useState("heritage");
  const [stampConfig, setStampConfig] = useState(() => normalizeStampConfig(DEFAULT_STAMP_CONFIG));
  const [sealLocked, setSealLocked] = useState(() => Boolean(options.profile?.stampConfig || options.profile?.signatureUrl));
  const [textValues, setTextValues] = useState({});
  const [retractDays, setRetractDays] = useState(1);

  const load = async () => {
    setLoading(true); setFailure(null);
    if (!token) { setFailure({ type: "invalid" }); setLoading(false); return; }
    try {
      const local = () => invokeLocalMultiSign({ action: "getByToken", token });
      let info;
      if (shouldUseLocalMultiSign()) {
        info = local();
        if (info?.error) throw new Error(info.reason || info.error);
      } else {
        info = (await base44.functions.invoke("multiSign", { action: "getByToken", token })).data;
      }
      setInfo(info);
      setStampTheme(info?.signer?.stampTheme || options.profile?.stampConfig?.design || "heritage");
      const profileConfig = options.profile?.stampConfig;
      const savedUrl = options.profile?.signatureUrl || "";
      const hasSavedSeal = Boolean(profileConfig || savedUrl);
      setStampConfig(hasSavedSeal
        ? normalizeStampConfig({
          ...DEFAULT_STAMP_CONFIG,
          ...profileConfig,
          name: profileConfig?.name || options.profile?.signatureName || info?.signer?.name || "",
        })
        : stampConfigFromSigner(info?.signer));
      setStampPreview(hasSavedSeal ? savedUrl : "");
      setSealLocked(hasSavedSeal);
      if (info?.signer?.spot?.scale) setSigSize(clampStampScale(info.signer.spot.scale));
    } catch (err) {
      setFailure({ type: err?.response?.status === 404 ? "invalid" : "error", message: err?.response?.data?.error || err.message });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [token]);

  useEffect(() => {
    // A saved personal seal is the artwork the owner approved. Do not redraw it
    // with this document's verification id — that made the seal look new on every request.
    if (sealLocked) return undefined;
    const name = String(stampConfig.name || info?.signer?.name || "").trim();
    const verificationId = info?.verificationId || "";
    if (!info || !name) {
      setStampPreview("");
      return undefined;
    }
    let active = true;
    makeSignatureStamp(stampConfig.markUrl || "", name, verificationId, stampConfig.markUrl ? "drawn" : "typed", stampConfig)
      .then((url) => { if (active && url) setStampPreview(url); })
      .catch(() => { if (active) setStampPreview(""); });
    return () => { active = false; };
  }, [info, stampConfig, sealLocked]);

  const setTextValue = (fieldId, value) => setTextValues((current) => ({ ...current, [fieldId]: value }));
  const patchStampConfig = (patch) => {
    if (sealLocked) return;
    setStampConfig((current) => normalizeStampConfig({ ...current, ...patch }));
  };

  const sign = async (sigDataUrl, composedOrName = false, signatureStyle = "unique") => {
    const isHrApproved = composedOrName === true;
    const textFields = (info?.signer?.spots || []).filter((field) => field.type === "text");
    const empty = textFields.filter((field) => field.required !== false && !String(textValues[field.id] || "").trim());
    if (empty.length) {
      setError(empty.every(isMarkField)
        ? (ar ? "اختر صح أو خطأ في كل خانة قبل الإرسال." : "Pick a tick or a cross in every box before submitting.")
        : (ar ? "يرجى تعبئة جميع حقول النص قبل الإرسال." : "Complete every text field before submitting."));
      return;
    }
    setError(""); setSigning(true);
    try {
      const locationPromise = captureLocation();
      setStage(ar ? "جارٍ تجهيز أحدث نسخة…" : "Fetching the latest version…");
      const fresh = shouldUseLocalMultiSign()
        ? invokeLocalMultiSign({ action: "getByToken", token })
        : (await base44.functions.invoke("multiSign", { action: "getByToken", token })).data;
      if (fresh.expiresAt && new Date(fresh.expiresAt).getTime() <= Date.now()) throw new Error(ar ? "انتهت صلاحية طلب التوقيع." : "This signature request has expired.");
      if (fresh.signer.status === "signed") throw new Error(ar ? "وقّعت هذا المستند مسبقًا." : "You already signed this document.");
      setStage(ar ? "جارٍ ختم توقيعك على المستند…" : "Stamping your signature…");
      const typedName = typeof composedOrName === "string" && composedOrName.trim()
        ? composedOrName.trim()
        : (stampConfig.name || fresh.signer.name);
      const liveConfig = normalizeStampConfig({
        ...DEFAULT_STAMP_CONFIG,
        ...stampConfig,
        name: typedName,
        markUrl: isHrApproved
          ? (sigDataUrl || stampConfig.markUrl || "")
          : (stampConfig.markUrl || sigDataUrl || ""),
      });
      // The PDF imprint uses this document's verification id. The on-screen
      // preview stays the owner's saved seal until they change it in the studio.
      const stamp = await makeSignatureStamp(liveConfig.markUrl, liveConfig.name, fresh.verificationId, signatureStyle, liveConfig);
      const fields = fresh.signer.spots || (fresh.signer.spot ? [{ ...fresh.signer.spot, id: "signature", type: "signature" }] : []);
      const signatureField = fields.find((field) => field.type === "signature") || fresh.signer.spot;
      const stamped = await stampOnPdf(fresh.docUrl, stamp, fresh.signedCount, null, signatureField, (signatureField?.scale || 100) / 100, true, fields, textValues);
      setStage(ar ? "جارٍ حفظ الحقول والتوقيع…" : "Saving fields and signature…");
      const fileHash = await sha256HexOfBuffer(stamped.bytes);
      const location = await locationPromise;
      const payload = { action: "submitSignature", token, newDocUrl: stamped.url, fileHash, textValues, location, retractDays, lang: ar ? "ar" : "en" };
      const body = shouldUseLocalMultiSign()
        ? invokeLocalMultiSign(payload)
        : (await base44.functions.invoke("multiSign", payload)).data;
      if (body?.error) throw new Error(body.reason || body.error);
      if (!sealLocked && options.persist?.companyId && options.persist?.userId) {
        persistPersonalSeal({
          companyId: options.persist.companyId,
          userId: options.persist.userId,
          user: options.persist.user,
          config: liveConfig,
        }).catch(() => {});
      }
      if (options.persist?.companyId) {
        settleWrittenConsentFromSigning(options.persist.companyId, {
          requestId: String(token).split(".")[0],
          token,
          accept: true,
          docUrl: stamped.url,
        });
      }
      setDone({
        completed: body.completed,
        status: body.status,
        cooling: body.cooling,
        retractDays: body.retractDays ?? retractDays,
        retractUntil: body.retractUntil || null,
        canRetract: Boolean(body.retractUntil),
        docUrl: stamped.url,
        finalHash: body.finalHash || null,
      });
    } catch (err) {
      setError((ar ? "تعذّر التوقيع — " : "Couldn't sign — ") + (err?.response?.data?.error || err.message));
    } finally { setSigning(false); setStage(""); }
  };

  const reject = async (reason) => {
    const note = String(reason || "").trim();
    if (!note) {
      setError(createGateMessage("REASON_REQUIRED", ar) || (ar ? "سبب الرفض مطلوب ويُحفظ في سجل التدقيق." : "A refusal reason is required and is stored in the audit trail."));
      return;
    }
    setError(""); setSigning(true);
    try {
      const location = await captureLocation();
      const payload = { action: "reject", token, reason: note, location, lang: ar ? "ar" : "en" };
      const body = shouldUseLocalMultiSign()
        ? invokeLocalMultiSign(payload)
        : (await base44.functions.invoke("multiSign", payload)).data;
      if (body?.error) throw new Error(createGateMessage(body.error, ar) || body.reason || body.error);
      if (options.persist?.companyId) {
        settleWrittenConsentFromSigning(options.persist.companyId, {
          requestId: String(token).split(".")[0],
          token,
          accept: false,
          note,
        });
      }
      setDone({ rejected: true, reason: body.reason || note, status: body.status });
    } catch (err) { setError((ar ? "تعذّر الرفض — " : "Couldn't reject — ") + (err?.response?.data?.error || err.message)); }
    finally { setSigning(false); }
  };

  const retract = async (reason = "") => {
    setError("");
    setSigning(true);
    try {
      const payload = { action: "retractSignature", token, reason, lang: ar ? "ar" : "en" };
      const body = shouldUseLocalMultiSign()
        ? invokeLocalMultiSign(payload)
        : (await base44.functions.invoke("multiSign", payload)).data;
      if (body?.error) throw new Error(body.reason || body.error);
      setDone(null);
      await load();
    } catch (err) {
      setError((ar ? "تعذّر التراجع — " : "Couldn't retract — ") + (err?.response?.data?.error || err.message));
    } finally {
      setSigning(false);
    }
  };

  const applySavedSeal = (saved) => {
    if (!saved?.stampConfig) return;
    setStampConfig(normalizeStampConfig({
      ...saved.stampConfig,
      name: saved.stampConfig.name || saved.signatureName || "",
    }));
    if (saved.signatureUrl) setStampPreview(saved.signatureUrl);
    setSealLocked(true);
  };

  return { ar, setAr, info, failure, loading, signing, stage, done, error, mode, setMode, sigSize, setSigSize, chosenSpot, setChosenSpot, stampTheme, setStampTheme, stampConfig, setStampConfig, patchStampConfig, applySavedSeal, sealLocked, stampPreview, setStampPreview, textValues, setTextValue, retractDays, setRetractDays, sign, reject, retract, reload: load };
}