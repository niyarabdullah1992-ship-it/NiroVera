import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/PowerCareAuth";
import { ChromeBox } from "@/components/shared/IdentityCard";
import { BORDER, CARD, INK, MUTED, NAVY } from "@/lib/platformStyles";
import { notificationKindChoices } from "@/lib/notificationKind";
import { NOTIFICATION_PREFS_EVENT, readNotificationKinds, writeNotificationKind } from "@/lib/notificationPrefs";

export default function NotificationPrefsCard({ lang = "ar" }) {
  const ar = lang === "ar";
  const { company, currentUser } = useAuth();
  const [prefs, setPrefs] = useState(() => readNotificationKinds(company?.id, currentUser?.id));
  const choices = notificationKindChoices();

  useEffect(() => {
    setPrefs(readNotificationKinds(company?.id, currentUser?.id));
  }, [company?.id, currentUser?.id]);

  useEffect(() => {
    const refresh = () => setPrefs(readNotificationKinds(company?.id, currentUser?.id));
    window.addEventListener(NOTIFICATION_PREFS_EVENT, refresh);
    return () => window.removeEventListener(NOTIFICATION_PREFS_EVENT, refresh);
  }, [company?.id, currentUser?.id]);

  const toggle = (id, on) => {
    setPrefs(writeNotificationKind(company?.id, currentUser?.id, id, on));
  };

  return (
    <ChromeBox>
      <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>
        {ar ? "الإشعارات" : "Notifications"}
      </div>
      <p style={{ margin: "6px 0 0", fontSize: 12, color: MUTED, lineHeight: 1.7, maxWidth: 640 }}>
        {ar
          ? "اختر ما يصل إلى جرسك. إيقاف نوع يخفيه عنك ولا يمحوه من سجل الشركة."
          : "Choose what reaches your bell. Turning a kind off hides it from you and does not erase the company record."}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
        {choices.map((kind) => {
          const on = prefs[kind.id] !== false;
          return (
            <button
              key={kind.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(kind.id, !on)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 32,
                padding: "0 12px",
                borderRadius: 8,
                border: on ? "none" : `1px solid ${BORDER}`,
                background: on ? "var(--nv-btn-fill)" : CARD,
                color: on ? "#fff" : INK,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {ar ? kind.ar : kind.en}
            </button>
          );
        })}
      </div>
    </ChromeBox>
  );
}
