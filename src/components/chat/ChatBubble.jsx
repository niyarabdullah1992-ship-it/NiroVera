import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ChevronDown, Copy, Trash2 } from "lucide-react";
import { CommentAttachments } from "@/components/tasks/CommentFiles";
import { isAudioAttachment } from "@/hooks/useVoiceRecording";
import { BORDER, CARD, DANGER, MUTED, NAVY, NAVY_FILL } from "@/lib/platformStyles";

const DELETE_WINDOW_MS = 3 * 60 * 1000;
const INTERACTIVE = "a, button, audio, input, textarea";

function letterOf(name) {
  const raw = String(name || "").trim();
  return raw.charAt(0) || "?";
}

/** Task-thread bubble — long-press / right-click / chevron, then copy or delete. */
export default function ChatBubble({ msg, isMine, lang, onDelete, allowDeleteAnytime = false, alignStart = false }) {
  const ar = lang === "ar";
  const profileId = String(msg.user_id || msg.authorId || msg.employeeId || "").trim();
  const displayName = String(msg.user_name || "").trim() || (isMine ? (ar ? "أنت" : "You") : "");
  const avatarUrl = String(msg.avatarUrl || "").trim();
  const initials = letterOf(displayName);
  const time = new Date(msg.created_at).toLocaleTimeString(lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  const [now, setNow] = useState(Date.now());
  const [picked, setPicked] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [hover, setHover] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const rootRef = useRef(null);
  const hold = useRef({ timer: 0, x: 0, y: 0, armed: false });
  const ignoreClick = useRef(false);
  const deletable = isMine && onDelete && (
    allowDeleteAnytime || now - new Date(msg.created_at).getTime() <= DELETE_WINDOW_MS
  );

  useEffect(() => {
    if (!deletable) return undefined;
    const interval = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(interval);
  }, [deletable]);

  const clearHold = () => {
    if (hold.current.timer) {
      window.clearTimeout(hold.current.timer);
      hold.current.timer = 0;
    }
    hold.current.armed = false;
  };

  const openMenu = () => {
    ignoreClick.current = true;
    setPicked(true);
    setConfirming(false);
    try {
      navigator.vibrate?.(12);
    } catch {
      /* ignore */
    }
  };

  const closeMenu = () => {
    setPicked(false);
    setConfirming(false);
  };

  useLayoutEffect(() => {
    if (!picked || !rootRef.current) {
      setMenuStyle(null);
      return undefined;
    }
    const place = () => {
      const rect = rootRef.current.getBoundingClientRect();
      const openUp = window.innerHeight - rect.bottom < 180;
      setMenuStyle({
        position: "fixed",
        top: openUp ? undefined : rect.bottom + 6,
        bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
        ...(ar
          ? { right: Math.max(12, window.innerWidth - rect.right + 8) }
          : { left: Math.max(12, rect.left + 8) }),
        zIndex: 80,
        minWidth: 168,
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        boxShadow: "0 10px 28px rgba(15, 23, 42, 0.12)",
        overflow: "hidden",
      });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [picked, confirming, ar]);

  const copyText = async () => {
    if (!msg.text) return;
    try {
      await navigator.clipboard.writeText(msg.text);
    } catch {
      /* ignore */
    }
    closeMenu();
  };

  const menuItem = (label, onClick, danger, Icon) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        width: "100%",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        border: "none",
        background: "transparent",
        color: danger ? DANGER : NAVY,
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
        fontFamily: "inherit",
        textAlign: "start",
      }}
    >
      <Icon size={15} strokeWidth={2} />
      {label}
    </button>
  );

  const avatarFace = avatarUrl
    ? <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    : initials;
  const avatarStyle = {
    width: 28,
    height: 28,
    borderRadius: 999,
    overflow: "hidden",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: isMine ? NAVY_FILL : CARD,
    color: isMine ? "#6EE7B7" : NAVY,
    border: `1px solid ${BORDER}`,
    fontSize: 11,
    fontWeight: 700,
    textDecoration: "none",
    fontFamily: "'IBM Plex Sans',sans-serif",
  };
  const avatar = profileId ? (
    <Link
      to={`/app/employees/${encodeURIComponent(profileId)}`}
      title={ar ? "فتح ملف الموظف" : "Open employee file"}
      onClick={(event) => event.stopPropagation()}
      style={avatarStyle}
    >
      {avatarFace}
    </Link>
  ) : (
    <span style={avatarStyle}>{avatarFace}</span>
  );

  const mineRadius = ar ? "14px 14px 4px 14px" : "14px 14px 14px 4px";
  const otherRadius = ar ? "14px 14px 14px 4px" : "14px 14px 4px 14px";

  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      style={{
        display: "flex",
        justifyContent: alignStart || isMine ? "flex-start" : "flex-end",
        width: "100%",
      }}
    >
      <div
        ref={rootRef}
        dir={ar ? "rtl" : "ltr"}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") setHover(true);
        }}
        onPointerLeave={() => setHover(false)}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          if (event.target.closest(INTERACTIVE)) return;
          hold.current.x = event.clientX;
          hold.current.y = event.clientY;
          hold.current.armed = true;
          hold.current.timer = window.setTimeout(openMenu, 450);
        }}
        onPointerMove={(event) => {
          if (!hold.current.armed) return;
          const dx = event.clientX - hold.current.x;
          const dy = event.clientY - hold.current.y;
          if ((dx * dx) + (dy * dy) > 64) clearHold();
        }}
        onPointerUp={clearHold}
        onPointerCancel={clearHold}
        onContextMenu={(event) => {
          if (event.target.closest(INTERACTIVE)) return;
          event.preventDefault();
          openMenu();
        }}
        onClick={(event) => {
          if (!ignoreClick.current) return;
          ignoreClick.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
        style={{
          position: "relative",
          maxWidth: "74%",
          background: isMine ? NAVY_FILL : CARD,
          color: isMine ? "#fff" : NAVY,
          border: isMine ? "none" : `1px solid ${BORDER}`,
          borderRadius: isMine ? mineRadius : otherRadius,
          padding: "11px 14px",
          boxShadow: isMine ? "0 1px 0 rgba(20,40,75,.12)" : "0 1px 0 #E2E8F0",
          textAlign: "start",
        }}
      >
        <div data-nv-bubble-head style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          {avatar}
          <div style={{ fontSize: 11, fontWeight: 600, color: isMine ? "#6EE7B7" : NAVY, flex: 1, minWidth: 0 }}>
            {displayName}
          </div>
          <button
            type="button"
            aria-label={ar ? "خيارات الرسالة" : "Message options"}
            onClick={(event) => {
              event.stopPropagation();
              if (picked) closeMenu();
              else openMenu();
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 20,
              height: 20,
              border: "none",
              borderRadius: 999,
              background: hover || picked ? (isMine ? "rgba(255,255,255,.12)" : CARD) : "transparent",
              color: isMine ? "#A8B4C8" : MUTED,
              cursor: "pointer",
              opacity: hover || picked || deletable ? 1 : 0,
            }}
          >
            <ChevronDown size={14} />
          </button>
        </div>
        {msg.text ? (
          <div style={{ fontSize: 13, lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {msg.text}
          </div>
        ) : null}
        <CommentAttachments files={(Array.isArray(msg.files) ? msg.files : []).filter((file) => !isAudioAttachment(file))} />
        {(Array.isArray(msg.files) ? msg.files : []).filter(isAudioAttachment).length ? (
          <div style={{ fontSize: 12, color: isMine ? "#A8B4C8" : MUTED, marginTop: 6 }}>
            {ar ? "مقطع صوتي" : "Voice note"}
          </div>
        ) : null}
        <div style={{ fontSize: 10, color: isMine ? "#A8B4C8" : MUTED, marginTop: 6 }}>{time}</div>
      </div>

      {picked && typeof document !== "undefined"
        ? createPortal(
          <>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 70 }}
              onClick={closeMenu}
              onContextMenu={(event) => {
                event.preventDefault();
                closeMenu();
              }}
            />
            {menuStyle ? (
              <div style={menuStyle} onClick={(event) => event.stopPropagation()}>
                {confirming ? (
                  <div style={{ padding: "12px 14px", display: "grid", gap: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>
                      {ar ? "حذف هذه الرسالة؟" : "Delete this message?"}
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button type="button" onClick={() => setConfirming(false)} style={quietBtn}>
                        {ar ? "إلغاء" : "Cancel"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDelete?.(msg);
                          closeMenu();
                        }}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 9,
                          border: "none",
                          background: DANGER,
                          color: "#fff",
                          fontSize: 12,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        {ar ? "حذف" : "Delete"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {msg.text ? menuItem(ar ? "نسخ" : "Copy", copyText, false, Copy) : null}
                    {deletable ? menuItem(ar ? "حذف" : "Delete", () => setConfirming(true), true, Trash2) : null}
                    {!msg.text && !deletable ? (
                      <div style={{ padding: "10px 14px", fontSize: 12, color: MUTED }}>
                        {ar ? "لا خيارات لهذه الرسالة." : "No actions for this message."}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
          </>,
          document.body,
        )
        : null}
    </div>
  );
}

const quietBtn = {
  padding: "6px 12px",
  borderRadius: 9,
  border: `1px solid ${BORDER}`,
  background: CARD,
  color: MUTED,
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "inherit",
};
