import React, { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { base44 } from "@/api/base44Client";
import { mediaErrorText, openStandalone } from "@/lib/mediaAccess";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { Mic, Square, Loader2 } from "lucide-react";

export default function VoiceRecorder({ files, setFiles, disabled, onRecorded, compact = false, circle = false, label }) {
  const { t } = useI18n();
  const rec = useVoiceRecording();
  const [uploading, setUploading] = useState(false);

  const start = async () => {
    try {
      await rec.start();
    } catch (err) {
      const ar = document.documentElement.dir === "rtl";
      alert(mediaErrorText(err.code, ar));
      if (err.code === "embedded") openStandalone();
    }
  };

  const stop = async () => {
    setUploading(true);
    try {
      const file = await rec.stop();
      if (!file) throw new Error("Empty recording");
      try {
        const up = await base44.integrations.Core.UploadFile({ file });
        const voice = { url: up.file_url, name: file.name, type: file.type };
        if (onRecorded) await onRecorded(voice);
        else setFiles((current) => [...(current || []), voice]);
      } catch {
        // Keep the clip locally so create/submit flows can still attach it.
        if (onRecorded) await onRecorded(file);
        else setFiles((current) => [...(current || []), file]);
      }
    } catch {
      alert(t("attachmentFailed"));
    } finally {
      setUploading(false);
    }
  };

  const duration = rec.durationLabel;
  const idleLabel = label || t("recordVoice");
  const ariaLabel = uploading ? t("uploading") : rec.recording ? t("stopRecording") : idleLabel;

  if (circle) {
    return (
      <button
        type="button"
        onClick={rec.recording ? stop : start}
        disabled={disabled || uploading}
        aria-label={idleLabel}
        title={idleLabel}
        data-recording={rec.recording ? "true" : "false"}
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          border: "none",
          background: rec.recording ? "var(--nv-bad-fill, #B42318)" : "var(--nv-navy, #14284B)",
          color: "#fff",
          display: "grid",
          placeItems: "center",
          padding: 0,
          margin: 0,
          cursor: disabled || uploading ? "default" : "pointer",
          flexShrink: 0,
          boxSizing: "border-box",
          lineHeight: 0,
          opacity: disabled || uploading ? 0.55 : 1,
        }}
      >
        {uploading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : rec.recording ? <Square size={12} fill="currentColor" aria-hidden="true" /> : <Mic size={14} aria-hidden="true" />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={rec.recording ? stop : start}
      disabled={disabled || uploading}
      className={`inline-flex items-center justify-center gap-1.5 ${compact ? "h-10 w-10 rounded-full px-0" : "px-2.5 py-1.5 rounded-md"} text-xs font-body border transition-colors disabled:opacity-50 ${rec.recording ? "border-red-400 bg-red-50 text-red-700" : "border-border hover:bg-muted"}`}
      aria-label={ariaLabel}
    >
      {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : rec.recording ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
      {compact ? null : (uploading ? t("uploading") : rec.recording ? `${t("stopRecording")} · ${duration}` : t("recordVoice"))}
    </button>
  );
}
