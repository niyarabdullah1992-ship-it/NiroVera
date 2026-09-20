import { useCallback, useEffect, useRef, useState } from "react";
import { getMediaStream } from "@/lib/mediaAccess";

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

export function pickRecorderMime() {
  if (typeof MediaRecorder === "undefined") return "";
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

export function formatVoiceClock(totalSec) {
  const sec = Math.max(0, Math.floor(Number(totalSec) || 0));
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

export function isAudioAttachment(file) {
  if (!file) return false;
  const type = String(file.type || "");
  const name = String(file.name || "");
  return /^audio\//i.test(type) || /\.(webm|mp3|wav|m4a|ogg)$/i.test(name);
}

export function voiceFileFromChunks(chunks, mimeType) {
  const type = mimeType || chunks?.[0]?.type || "audio/webm";
  const blob = new Blob(chunks || [], { type });
  if (!blob.size) return null;
  const extension = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
  return new File([blob], `voice-${Date.now()}.${extension}`, { type });
}

/**
 * Shared microphone recorder for task VoiceRecorder and operational chat.
 * start() throws Error with .code from getMediaStream / MediaRecorder.
 * stop() resolves to a File; cancel() discards the clip.
 */
export function useVoiceRecording() {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const stopWaitRef = useRef(null);
  const activeRef = useRef(false);
  const startedAtRef = useRef(0);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const start = useCallback(async () => {
    if (activeRef.current || recorderRef.current) return;
    const stream = await getMediaStream({ audio: true });
    streamRef.current = stream;
    try {
      const mimeType = pickRecorderMime();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        releaseStream();
        clearTimer();
        activeRef.current = false;
        setRecording(false);
        const waiter = stopWaitRef.current;
        stopWaitRef.current = null;
        waiter?.reject(new Error("recorder_error"));
      };
      recorder.onstop = () => {
        releaseStream();
        const waiter = stopWaitRef.current;
        stopWaitRef.current = null;
        const file = voiceFileFromChunks(chunksRef.current, recorder.mimeType);
        chunksRef.current = [];
        recorderRef.current = null;
        if (waiter?.mode === "cancel") {
          waiter.resolve(null);
          return;
        }
        if (!file) {
          waiter?.reject(new Error("empty"));
          return;
        }
        waiter?.resolve(file);
      };
      recorder.start(250);
      recorderRef.current = recorder;
      activeRef.current = true;
      setElapsed(0);
      startedAtRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 200);
      setRecording(true);
    } catch (error) {
      releaseStream();
      const err = new Error(error?.message || "failed");
      err.code = "failed";
      throw err;
    }
  }, []);

  const finish = useCallback((mode) => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return Promise.resolve(null);
    clearTimer();
    activeRef.current = false;
    setRecording(false);
    return new Promise((resolve, reject) => {
      stopWaitRef.current = { resolve, reject, mode };
      try {
        recorder.stop();
      } catch (err) {
        stopWaitRef.current = null;
        reject(err);
      }
    });
  }, []);

  const stop = useCallback(() => finish("stop"), [finish]);
  const cancel = useCallback(() => finish("cancel"), [finish]);

  useEffect(() => () => {
    clearTimer();
    try { recorderRef.current?.stop(); } catch { /* ignore */ }
    releaseStream();
    activeRef.current = false;
  }, []);

  return {
    recording,
    elapsed,
    elapsedMs: () => (startedAtRef.current ? Date.now() - startedAtRef.current : 0),
    durationLabel: formatVoiceClock(elapsed),
    isActive: () => activeRef.current,
    start,
    stop,
    cancel,
  };
}
