import React, { useEffect, useState } from "react";
import { CheckCircle2, MessageSquare, Send, Star, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { getCompanyToken } from "@/lib/store";
import IdentityCard from "@/components/shared/IdentityCard";
import { BORDER, NAVY, textarea, ui } from "@/lib/platformStyles";

export default function ProductFeedbackPrompt({ companyId, role }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [visible, setVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const open = () => { setVisible(true); setSent(false); setError(""); };
    window.addEventListener("powercare:open-feedback", open);
    return () => window.removeEventListener("powercare:open-feedback", open);
  }, []);

  const submit = async () => {
    if (!rating || !message.trim() || saving) return;
    setSaving(true); setError("");
    try {
      await base44.functions.invoke("gmailNotify", { kind: "product_feedback", companyId, sessionToken: getCompanyToken(companyId), role, rating, message: message.trim(), page: window.location.pathname });
      setSent(true); setRating(0); setMessage("");
    } catch { setError(ar ? "تعذّر إرسال التقييم؛ حاول مرة أخرى." : "Couldn't send feedback; try again."); }
    finally { setSaving(false); }
  };

  if (!visible) return null;

  return (
    <aside
      style={{ position: "fixed", bottom: 24, insetInlineEnd: 16, zIndex: 50, width: "min(calc(100% - 2rem), 24rem)" }}
      dir={ar ? "rtl" : "ltr"}
    >
      <IdentityCard
        icon={MessageSquare}
        title={ar ? "قيّم تجربتك" : "Rate your experience"}
        subtitle={ar ? "يصل تقييمك مباشرة إلى مالك المنصة." : "Your feedback goes directly to the platform owner."}
        meta={(
          <button type="button" onClick={() => setVisible(false)} style={{ ...ui.btnGhost, padding: 6 }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        )}
        dir={ar ? "rtl" : "ltr"}
        bodySurface
      >
        {sent ? (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <CheckCircle2 style={{ width: 28, height: 28, margin: "0 auto", color: "var(--nv-ok-ink)" }} />
            <p style={{ margin: "10px 0 0", fontSize: 13, fontWeight: 600, color: NAVY }}>{ar ? "شكراً، تم إرسال اقتراحك" : "Thank you, your suggestion was sent"}</p>
            <button type="button" onClick={() => setVisible(false)} style={{ ...ui.btnSecondary, marginTop: 12 }}>{ar ? "إغلاق" : "Close"}</button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 12 }} dir="ltr">
              {[1, 2, 3, 4, 5].map((value) => (
                <button key={value} type="button" onClick={() => setRating(value)} aria-label={`${value}/5`} style={{ background: "none", border: 0, cursor: "pointer", padding: 4 }}>
                  <Star style={{ width: 22, height: 22, color: value <= rating ? "var(--nv-ok-ink)" : BORDER, fill: value <= rating ? "var(--nv-ok-ink)" : "none" }} />
                </button>
              ))}
            </div>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value.slice(0, 1000))}
              placeholder={ar ? "اكتب اقتراحك أو ملاحظتك…" : "Write your suggestion or feedback…"}
              rows={4}
              style={textarea}
            />
            {error ? <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--nv-bad-ink)" }}>{error}</p> : null}
            <button type="button" onClick={submit} disabled={!rating || !message.trim() || saving} style={{ ...ui.btnBlock, opacity: !rating || !message.trim() || saving ? 0.4 : 1 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Send style={{ width: 14, height: 14 }} />
                {saving ? (ar ? "جارٍ الإرسال…" : "Sending…") : (ar ? "إرسال للمالك" : "Send to owner")}
              </span>
            </button>
          </>
        )}
      </IdentityCard>
    </aside>
  );
}
