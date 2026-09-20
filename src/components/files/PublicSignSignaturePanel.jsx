import React from "react";
import { Check, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { signGhostBtn, signKicker, signPrimaryBtn } from "@/components/files/signingUi";
import { BORDER, CARD, DANGER, MUTED, NAVY, NAVY_FILL, SURFACE, textarea } from "@/lib/platformStyles";
import PublicSignParties from "@/components/files/PublicSignParties";
import RecipientStampControls from "@/components/files/RecipientStampControls";
import StampMarkStage from "@/components/files/StampMarkStage";
import { createGateMessage, RETRACT_DAY_OPTIONS, retractDaysLabel } from "@/lib/multiSignDerivations";
import { formatUiNumber } from "@/lib/dateFormat";
import { isMarkField } from "@/lib/signPdf";
import { stampConfigFromSigner } from "@/lib/stampStudio";

function fieldLabel(field, ar) {
  if (isMarkField(field)) return ar ? "خانة صح / خطأ" : "Tick or cross";
  if (field.type === "text") return field.label || (ar ? "حقل نص" : "Text field");
  return ar ? "التوقيع" : "Signature";
}

export default function PublicSignSignaturePanel({
  ar, info, stampPreview, stampConfig, patchStampConfig, sealLocked, sign, reject, signing, stage, error, retractDays, setRetractDays, textValues = {}, onFieldFocus, onOpenStudio,
}) {
  const [showReject, setShowReject] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [intent, setIntent] = React.useState(false);
  const liveConfig = stampConfig || stampConfigFromSigner(info.signer);
  const patchConfig = patchStampConfig || (() => {});
  const fields = info.signer?.spots || (info.signer?.spot ? [info.signer.spot] : []);
  const filled = fields.filter((field) => field.type !== "signature" && String(textValues[field.id] || "").trim()).length;
  const needed = fields.filter((field) => field.type !== "signature").length;
  const signed = Boolean(stampPreview || info.signer?.signatureUrl);
  const consentReady = signed;
  React.useEffect(() => {
    if (!consentReady && intent) setIntent(false);
  }, [consentReady, intent]);
  const pct = fields.length ? Math.round(((filled + (stampPreview ? 1 : 0)) / fields.length) * 100) : 0;
  const confirmSign = (...args) => {
    if (!intent) return;
    sign(...args);
  };
  const confirmRefuse = () => {
    if (!reason.trim()) return;
    reject(reason);
  };
  const commitStamp = () => {
    confirmSign(liveConfig.markUrl || "", liveConfig.name || info.signer.name, liveConfig.markUrl ? "drawn" : "typed");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div style={{ padding: "14px 16px 12px", borderBottom: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={signKicker}>{ar ? "حقولك" : "Your fields"}</span>
        <span style={{ fontSize: 15, fontWeight: 650, color: NAVY }}>{ar ? "المطلوب منك" : "Asked of you"}</span>
        <PublicSignParties ar={ar} info={info} compact />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <div style={{ flex: 1, height: 4, background: SURFACE, borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "var(--nv-accent, #1E9E63)" }} />
          </div>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: MUTED }}>{formatUiNumber(`${filled + (stampPreview ? 1 : 0)}/${fields.length || 1}`, ar)}</span>
        </div>
      </div>

      <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 3 }}>
        {fields.map((field, index) => {
          const done = field.type === "signature" ? Boolean(stampPreview) : Boolean(String(textValues[field.id] || "").trim());
          return (
            <button
              key={field.id || index}
              type="button"
              onClick={() => onFieldFocus?.(field.page || 1)}
              style={{
                fontFamily: "inherit",
                textAlign: "start",
                padding: "9px 11px",
                borderRadius: 9,
                border: "1px solid transparent",
                background: SURFACE,
                cursor: "pointer",
                display: "grid",
                gridTemplateColumns: "20px minmax(0, 1fr) auto",
                gap: 10,
                alignItems: "center",
                color: NAVY,
              }}
            >
              <span style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                border: `1.5px solid ${done ? "var(--nv-accent, #1E9E63)" : BORDER}`,
                background: done ? "var(--nv-accent, #1E9E63)" : "#fff",
                color: done ? "#fff" : NAVY,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontFamily: "'IBM Plex Mono', monospace",
              }}
              >
                {done ? "✓" : index + 1}
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{fieldLabel(field, ar)}</span>
                <span style={{ fontSize: 11, color: MUTED }}>{info.signer?.name}</span>
              </span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: MUTED }}>{ar ? `ص ${formatUiNumber(field.page || 1, true)}` : `p${field.page || 1}`}</span>
            </button>
          );
        })}
      </div>

      {showReject ? (
        <div style={{ margin: 16, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden", background: SURFACE }}>
          <div aria-hidden style={{ height: 3, background: NAVY_FILL }} />
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 650, color: NAVY }}>{ar ? "رفض" : "Refuse"}</p>
              <p style={{ margin: "6px 0 0", fontSize: 12, lineHeight: 1.7, color: MUTED }}>
                {ar
                  ? "رفض صريح بسبب مكتوب. لا يوقف بقية الأطراف ويظهر في سجل التدقيق. رفض بانتهاء المدة يحدث تلقائياً إذا أُغلقت مهلة يوم إلى ثلاثة أيام دون توقيع."
                  : "An explicit refusal needs a written reason. It does not stop the others and stays in the audit trail. A 1–3 day window that closes unsigned becomes a deadline refusal."}
              </p>
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: NAVY }}>{ar ? "سبب الرفض — إلزامي" : "Refusal reason — required"}</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={ar ? "اكتب السبب — يُحفظ في سجل التدقيق كرفض صريح" : "Write the reason — stored in the audit trail as an explicit refusal"}
                style={{ ...textarea, minHeight: 96 }}
              />
            </label>
            {!reason.trim() ? (
              <p style={{ margin: 0, fontSize: 11, color: DANGER, lineHeight: 1.6 }}>
                {createGateMessage("REASON_REQUIRED", ar)}
              </p>
            ) : null}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button type="button" onClick={confirmRefuse} disabled={!reason.trim() || signing} style={{ ...signPrimaryBtn, background: DANGER, opacity: !reason.trim() || signing ? 0.45 : 1 }}>
                {ar ? "تأكيد الرفض" : "Confirm refusal"}
              </button>
              <button type="button" onClick={() => setShowReject(false)} style={{ ...signGhostBtn, marginInlineStart: "auto" }}>
                {ar ? "رجوع" : "Back"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div style={{ padding: "12px 16px", borderTop: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={signKicker}>{ar ? "ختمك" : "Your stamp"}</span>
              <button
                type="button"
                onClick={() => setShowReject(true)}
                style={{ ...signGhostBtn, padding: "6px 10px", fontSize: 12, color: DANGER, borderColor: "color-mix(in oklab, #DC2626 28%, #fff)" }}
              >
                <XCircle style={{ width: 14, height: 14 }} />
                {ar ? "رفض" : "Refuse"}
              </button>
            </div>
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.65, color: MUTED }}>
              {sealLocked
                ? (ar
                  ? `${info.signer.name} · ختمك المحفوظ. لا يتغيّر إلا إذا غيّرته أنت من الستوديو.`
                  : `${info.signer.name} · Your saved seal. It stays until you change it in the studio.`)
                : (ar
                  ? `${info.signer.name} · الشكل والاسم والختم واحد. اسحب خط اليد داخل المعاينة إلى أي موضع.`
                  : `${info.signer.name} · Shape, name and seal are one. Drag the handwriting anywhere on the preview.`)}
            </p>
            {onOpenStudio ? (
              <button type="button" onClick={onOpenStudio} style={{ ...signGhostBtn, width: "100%" }}>
                {sealLocked
                  ? (ar ? "تغيير الختم — أنت وحدك من يغيّره" : "Change seal — only you can")
                  : (ar ? "فتح ستوديو الختم — يُحفظ في ملفك" : "Open stamp studio — saved to your file")}
              </button>
            ) : null}
            {sealLocked ? (
              stampPreview ? (
                <img
                  src={stampPreview}
                  alt={ar ? "ختمك المحفوظ" : "Your saved seal"}
                  style={{ width: "100%", maxHeight: 160, objectFit: "contain", display: "block" }}
                />
              ) : null
            ) : (
              <>
                <RecipientStampControls ar={ar} config={liveConfig} onPatch={patchConfig} />
                <StampMarkStage
                  config={liveConfig}
                  onPatch={patchConfig}
                  ar={ar}
                  verificationId={info.verificationId}
                  maxHeight={220}
                />
              </>
            )}
            {info.verificationId ? (
              <p
                dir="ltr"
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: MUTED,
                  textAlign: "center",
                  letterSpacing: "0.06em",
                  fontWeight: 600,
                }}
              >
                {info.verificationId}
              </p>
            ) : null}
          </div>

          <div style={{ padding: "12px 16px", borderTop: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={signKicker}>{ar ? "مهلة التراجع — 0 إلى 3 أيام" : "Retract window — 0 to 3 days"}</span>
            <p style={{ margin: 0, fontSize: 11, lineHeight: 1.7, color: MUTED }}>
              {ar
                ? "بدون مهلة يُثبَّت التوقيع فوراً. يوم إلى ثلاثة تتيح سحب التوقيع قبل إغلاق النافذة. بدون مهلة لا يُرفض الباقون تلقائياً."
                : "With no window the signature locks at once. One to three days let you withdraw before the window closes. A 0 window never auto-refuses the others."}
            </p>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {RETRACT_DAY_OPTIONS.map((days) => {
                const active = retractDays === days;
                return (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setRetractDays(days)}
                    style={{
                      fontFamily: "inherit",
                      fontSize: 12,
                      flex: 1,
                      minWidth: 64,
                      padding: "8px 4px",
                      borderRadius: 8,
                      border: `1px solid ${active ? NAVY : BORDER}`,
                      background: active ? NAVY_FILL : CARD,
                      color: active ? "#fff" : NAVY,
                      fontWeight: active ? 600 : 400,
                      cursor: "pointer",
                    }}
                  >
                    {retractDaysLabel(days, ar)}
                  </button>
                );
              })}
            </div>
            <span style={{ fontWeight: 600, fontSize: 13, color: NAVY }}>{ar ? "الإقرار" : "Consent"}</span>
            <label style={{ display: "flex", gap: 9, alignItems: "flex-start", cursor: consentReady ? "pointer" : "default", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 10, opacity: consentReady ? 1 : 0.55 }}>
              <input type="checkbox" checked={intent && consentReady} disabled={!consentReady} onChange={(e) => consentReady && setIntent(e.target.checked)} style={{ marginTop: 2, accentColor: "#1E9E63" }} />
              <span style={{ fontSize: 11, lineHeight: 1.7, color: MUTED }}>
                {ar
                  ? (!signed
                    ? "ضع ختمك أولاً — الإقرار يُفتح بعد التوقيع."
                    : "أقرّ بأنني راجعت المستند، وأنّ ختمي يعبّر عن نيّتي في التوقيع.")
                  : (!signed
                    ? "Place your seal first — acknowledgement unlocks after you sign."
                    : "I confirm that I reviewed this document and that my seal expresses my intent to sign.")}
              </span>
            </label>
            {info.signer.signatureUrl ? (
              <button type="button" onClick={() => confirmSign(info.signer.signatureUrl, true)} disabled={signing || !intent || !consentReady} style={{ ...signPrimaryBtn, width: "100%", opacity: signing || !intent || !consentReady ? 0.4 : 1 }}>
                <ShieldCheck style={{ width: 16, height: 16 }} />
                {ar ? "استخدام توقيعي المعتمد من ملف الموارد" : "Use my HR-approved signature"}
              </button>
            ) : null}
            <button
              type="button"
              disabled={!stampPreview || signing || !intent || !consentReady}
              onClick={commitStamp}
              style={{ ...signPrimaryBtn, width: "100%", opacity: !stampPreview || signing || !intent || !consentReady ? 0.4 : 1 }}
            >
              <Check style={{ width: 16, height: 16 }} />
              {signing ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "حفظ التوقيع" : "Save signature")}
            </button>
            {info.docUrl ? <a href={info.docUrl} download style={{ fontSize: 11, color: NAVY }}>{ar ? "تنزيل المستند" : "Download document"}</a> : null}
          </div>
        </>
      )}

      {needed > filled && !showReject ? (
        <p style={{ margin: "0 16px 12px", fontSize: 11, color: MUTED }}>
          {ar ? `${needed - filled} حقول نص ما زالت مطلوبة قبل الإرسال.` : `${needed - filled} text field(s) still required before submit.`}
        </p>
      ) : null}
      {signing ? (
        <p style={{ margin: "0 16px 16px", display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: MUTED }}>
          <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />{stage}
        </p>
      ) : null}
      {error ? (
        <p style={{ margin: "0 16px 16px", background: "#FEF2F2", padding: "10px 12px", fontSize: 12, color: DANGER }}>{error}</p>
      ) : null}
    </div>
  );
}
