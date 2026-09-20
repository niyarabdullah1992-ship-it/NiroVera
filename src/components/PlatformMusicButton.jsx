import React, { useEffect, useRef, useState } from "react";
import { GripVertical, Pause, Play } from "lucide-react";
import useDraggablePosition from "@/hooks/useDraggablePosition";
import { ACCENT, BORDER, CARD, INK, MUTED } from "@/lib/platformStyles";
import { useI18n } from "@/lib/i18n";

const VIDEO_ID = "5n5YG8ShXRQ";

const cell = {
  width: 36,
  height: 36,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "none",
  background: "transparent",
  color: "inherit",
  fontFamily: "inherit",
  padding: 0,
};

export default function PlatformMusicButton({ inPlatform = false }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const frameRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const { position, handlers } = useDraggablePosition();
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const toggleMusic = () => {
    if (!loaded) {
      setLoaded(true);
      setPlaying(true);
      return;
    }
    const nextPlaying = !playing;
    frameRef.current?.contentWindow?.postMessage(
      JSON.stringify({
        event: "command",
        func: nextPlaying ? "playVideo" : "pauseVideo",
        args: [],
      }),
      "*",
    );
    setPlaying(nextPlaying);
  };

  const playLabel = playing
    ? (ar ? "إيقاف الموسيقى" : "Pause music")
    : (ar ? "تشغيل الموسيقى" : "Play music");

  return (
    <>
      {loaded && (
        <iframe
          ref={frameRef}
          title="NiroVera focus music"
          src={`https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1&enablejsapi=1&playsinline=1&loop=1&playlist=${VIDEO_ID}`}
          allow="autoplay"
          className="pointer-events-none fixed h-px w-px opacity-0"
        />
      )}
      <div
        style={{
          position: "fixed",
          zIndex: 40,
          ...(position
            ? { left: position.x, top: position.y }
            : { insetInlineEnd: 24, bottom: inPlatform && mobile ? 88 : 24 }),
          display: "flex",
          alignItems: "stretch",
          borderRadius: 14,
          border: `1px solid ${BORDER}`,
          background: CARD,
          overflow: "hidden",
          boxShadow: "0 1px 2px var(--nv-shadow2), 0 10px 26px var(--nv-shadow)",
        }}
      >
        <button
          type="button"
          onClick={toggleMusic}
          aria-label={playLabel}
          title={playLabel}
          style={{
            ...cell,
            background: playing ? ACCENT : "transparent",
            color: playing ? "#fff" : INK,
          }}
        >
          {playing ? <Pause size={15} strokeWidth={1.8} /> : <Play size={15} strokeWidth={1.8} />}
        </button>
        <span aria-hidden style={{ width: 1, background: BORDER, alignSelf: "stretch" }} />
        <button
          type="button"
          {...handlers}
          aria-label={ar ? "اسحب لتحريك الزر" : "Drag to move"}
          title={ar ? "اسحب لتحريك الزر" : "Drag to move"}
          style={{
            ...cell,
            width: 28,
            color: MUTED,
            cursor: "grab",
            touchAction: "none",
          }}
        >
          <GripVertical size={14} strokeWidth={1.8} />
        </button>
      </div>
    </>
  );
}
