import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import { Loader2 } from "lucide-react";
import {
  ownerField,
  ownerGateBanner,
  ownerOkBanner,
  ownerPaper,
  ownerPrimaryBtn,
  OwnerSectionHead,
  ownerStack,
} from "@/components/owner/ownerUi";

export default function NewsBroadcast() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState(null);

  const handleSend = async (event) => {
    event.preventDefault();
    setStatus("sending");
    try {
      const res = await base44.functions.invoke("subscriberEmails", {
        action: "broadcast", subject, message,
      });
      if (res.data?.ok) {
        setStatus({ sent: res.data.sent, total: res.data.total });
        setSubject("");
        setMessage("");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <div style={{ ...ownerPaper("mute"), padding: 16, ...ownerStack }}>
      <OwnerSectionHead
        title={ar ? "إرسال أخبار الموقع للمشتركين" : "Email site news to subscribers"}
      />
      <p style={{ margin: 0, fontSize: 12, color: "var(--nv-muted)", lineHeight: 1.7 }}>
        {ar
          ? "تُرسل الرسالة إلى البريد الإلكتروني المسجل لكل شركة مشتركة."
          : "The message is sent to the registered email of every subscribed company."}
      </p>
      <form onSubmit={handleSend} style={ownerStack}>
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder={ar ? "عنوان الرسالة" : "Subject"}
          required
          style={ownerField()}
        />
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={ar ? "نص الخبر..." : "News content..."}
          required
          rows={4}
          style={{ ...ownerField(), resize: "vertical", minHeight: 96 }}
        />
        <button type="submit" disabled={status === "sending"} style={{ ...ownerPrimaryBtn(), opacity: status === "sending" ? 0.55 : 1 }}>
          {status === "sending" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {ar ? "إرسال للجميع" : "Send to all subscribers"}
        </button>
      </form>
      {status && typeof status === "object" ? ownerOkBanner(
        ar ? `تم الإرسال إلى ${status.sent} من ${status.total} مشترك.` : `Sent to ${status.sent} of ${status.total} subscribers.`,
      ) : null}
      {status === "error" ? ownerGateBanner({ ok: false, reason: "تعذر إرسال الرسالة — حاول مجددًا.", reasonEn: "Could not send the message — try again." }, ar) : null}
    </div>
  );
}
