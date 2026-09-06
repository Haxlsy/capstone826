"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Circle, Square, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MAX_RECORDING_SECONDS } from "@/lib/media/limits";

// In-app camera recorder — replaces the native `<input capture="environment">`
// camera picker for video specifically, because that attribute is only a hint:
// most native camera apps still show their own flip-camera control regardless.
// This component never renders one, so it's the only reliable way to keep a
// technician on the back camera. It also enforces the recording length limit
// live (auto-stops at MAX_RECORDING_SECONDS) instead of discovering an
// oversized file only after the fact.

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "video/mp4;codecs=h264,aac",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return "";
}

function fmtClock(totalSeconds: number): string {
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

interface VideoRecorderModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export function VideoRecorderModal({ open, onClose, onCapture }: VideoRecorderModalProps) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef   = useRef<Blob[]>([]);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const [streamReady, setStreamReady] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [recording, setRecording]     = useState(false);
  const [seconds, setSeconds]         = useState(0);
  const [previewUrl, setPreviewUrl]   = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreamReady(false);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const resetRecordingState = useCallback(() => {
    setRecording(false);
    setSeconds(0);
    clearTimer();
    setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    setPreviewBlob(null);
    chunksRef.current = [];
  }, [clearTimer]);

  // Open the back camera the moment the modal opens; release it fully on close.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        setError("Your browser doesn't support in-app video recording. Please update your browser.");
        return;
      }
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { exact: "environment" } },
            audio: true,
          });
        } catch {
          // Devices with only one camera (e.g. a laptop) can't satisfy an
          // exact match — fall back to a non-strict hint rather than failing.
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: true,
          });
        }
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setStreamReady(true);
      } catch {
        if (!cancelled) setError("Camera access was denied or is unavailable. Please allow camera access and try again.");
      }
    }

    start();
    return () => {
      cancelled = true;
      stopStream();
      resetRecordingState();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function startRecording() {
    if (!streamRef.current) return;
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType || "video/webm" });
      setPreviewBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
    setSeconds(0);
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        const next = s + 1;
        if (next >= MAX_RECORDING_SECONDS) {
          stopRecording();
          return MAX_RECORDING_SECONDS;
        }
        return next;
      });
    }, 1000);
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
    clearTimer();
  }

  function retake() {
    setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    setPreviewBlob(null);
    setSeconds(0);
  }

  function useVideo() {
    if (!previewBlob) return;
    const ext  = previewBlob.type.includes("mp4") ? "mp4" : "webm";
    const file = new File([previewBlob], `video-${Date.now()}.${ext}`, { type: previewBlob.type || "video/webm" });
    onCapture(file);
    handleClose();
  }

  function handleClose() {
    stopStream();
    resetRecordingState();
    onClose();
  }

  if (!open) return null;

  const nearLimit = seconds >= MAX_RECORDING_SECONDS - 10;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={handleClose} aria-label="Close" className="p-2 -ml-2 text-white">
          <X size={22} />
        </button>
        {!previewUrl && !error && (
          <span className={`font-mono text-sm ${nearLimit ? "text-status-delayed" : "text-white"}`}>
            {fmtClock(seconds)} / {fmtClock(MAX_RECORDING_SECONDS)}
          </span>
        )}
        <span className="w-8" />
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {error ? (
          <p className="px-6 text-center text-sm text-white">{error}</p>
        ) : previewUrl ? (
          <video src={previewUrl} controls playsInline className="max-h-full max-w-full" />
        ) : (
          <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
        )}
      </div>

      <div className="flex items-center justify-center gap-6 p-6">
        {error ? (
          <Button variant="secondary" onClick={handleClose}>Close</Button>
        ) : previewUrl ? (
          <>
            <Button variant="ghost" onClick={retake} className="text-white hover:bg-white/10 hover:text-white">
              <RotateCcw size={16} className="mr-1.5" /> Retake
            </Button>
            <Button onClick={useVideo}>
              <Check size={16} className="mr-1.5" /> Use Video
            </Button>
          </>
        ) : (
          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={!streamReady}
            aria-label={recording ? "Stop recording" : "Start recording"}
            className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white disabled:opacity-40"
          >
            {recording
              ? <Square size={22} className="fill-white text-white" />
              : <Circle size={40} className="fill-status-delayed text-status-delayed" />}
          </button>
        )}
      </div>
    </div>
  );
}
