import React, { useState, useEffect } from "react";
import { Mic, MicOff } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import useVoiceWakeWord from "./useVoiceWakeWord";
import speak from "./speak";

// Short two-tone chime confirming the microphone actually started listening.
function playListeningChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[660, 0], [990, 0.14]].forEach(([freq, at]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.15, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + 0.12);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.13);
    });
    setTimeout(() => ctx.close(), 500);
  } catch { /* audio not available */ }
}

export default function VoiceControl({ onCommand, voiceGender }) {
  const { lang } = useI18n();
  const [enabled, setEnabled] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const { supported, listening, awake, directReady, denied } = useVoiceWakeWord({ enabled, lang, onCommand });
  const ar = lang === "ar";

  const toggle = async () => {
    if (enabled) { setEnabled(false); return; }
    setMicDenied(false);
    // Explicitly request the microphone first — this shows the browser's permission
    // prompt and surfaces a clear message instead of silently shutting off.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setEnabled(true);
    } catch {
      setMicDenied(true);
    }
  };

  // Audible acknowledgment when the wake word is heard alone.
  useEffect(() => {
    if (awake) speak(ar ? "نعم، تفضل" : "Yes, go ahead", lang, voiceGender);
  }, [awake, ar, lang, voiceGender]);

  // If the browser denied the microphone, flip the button back off so its state is honest.
  useEffect(() => {
    if (denied) setEnabled(false);
  }, [denied]);

  // Audible confirmation the moment listening actually starts.
  useEffect(() => {
    if (enabled && listening) playListeningChime();
  }, [enabled, listening]);

  if (!supported) return null;

  const status = (denied || micDenied)
    ? (ar ? "المتصفح رفض الميكروفون — افتح التطبيق في نافذة مستقلة واسمح بالميكروفون" : "Microphone blocked — open the app in its own tab and allow the microphone")
    : (awake || directReady)
      ? (ar ? "نيرو يستمع… قل طلبك مباشرة" : "Niro is listening… say your command")
      : listening
        ? (ar ? "قل «نيرو» ثم اطلب ما تريد" : 'Say "Niro" then ask anything')
        : null;

  return (
    <div className="absolute end-2 top-1/2 z-10 -translate-y-1/2">
      {status && (
        <span className={`absolute bottom-full end-0 mb-2 w-52 rounded-[10px] border border-[var(--nv-line)] bg-[var(--nv-card)] px-2.5 py-2 text-xs font-body leading-relaxed shadow-sm ${awake || directReady ? "text-[var(--nv-ok-ink)] font-semibold" : (denied || micDenied) ? "text-[var(--nv-bad-ink)]" : "text-[var(--nv-muted)]"}`}>
          {status}
        </span>
      )}
      <button
        type="button"
        onClick={toggle}
        aria-label={enabled ? (ar ? "إيقاف الاستماع" : "Stop listening") : (ar ? "بدء الاستماع" : "Start listening")}
        title={enabled ? (ar ? "إيقاف الاستماع" : "Stop listening") : (ar ? "بدء الاستماع" : "Start listening")}
        className={`relative flex h-8 w-8 items-center justify-center rounded-[10px] border transition-colors ${
          enabled
            ? "bg-[var(--nv-ok-fill)] text-[var(--nv-btn-ink)] border-[var(--nv-ok-fill)]"
            : "bg-[var(--nv-soft)] text-[var(--nv-ink)] border-[var(--nv-line)] hover:bg-[var(--nv-card)] hover:border-[var(--nv-ink)]"
        }`}
      >
        {enabled ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        {listening && (
          <span className={`absolute -top-0.5 -end-0.5 h-2.5 w-2.5 rounded-full ${awake || directReady ? "bg-green-500 animate-ping" : "bg-green-500 animate-pulse"}`} />
        )}
      </button>
    </div>
  );
}