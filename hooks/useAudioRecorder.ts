"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface UseAudioRecorderOptions {
  chunkIntervalMs: number;
  onChunk: (blob: Blob, mimeType: string) => void;
}

interface UseAudioRecorderReturn {
  isRecording: boolean;
  audioLevel: number;
  permissionError: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  flushChunk: () => void;
}

function getSupportedMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
  ];
  return candidates.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) ?? "";
}

export function useAudioRecorder({
  chunkIntervalMs,
  onChunk,
}: UseAudioRecorderOptions): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeTypeRef = useRef<string>("");
  // Tracks whether we intentionally stopped (user click) vs chunk flush
  const isActiveRef = useRef(false);
  // Queued chunks for the current recording segment
  const chunksRef = useRef<BlobPart[]>([]);

  const stopAudioLevel = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    setAudioLevel(0);
  }, []);

  const startAudioLevel = useCallback((stream: MediaStream) => {
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    audioContextRef.current = ctx;
    analyserRef.current = analyser;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      setAudioLevel(avg / 255);
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const flushChunk = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    // Stopping triggers ondataavailable + onstop. onstop will restart if still active.
    recorder.stop();
  }, []);

  const startRecording = useCallback(async () => {
    setPermissionError(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      });
    } catch (err) {
      const msg = err instanceof DOMException
        ? err.name === "NotAllowedError"
          ? "Microphone permission denied. Please allow mic access and try again."
          : `Microphone error: ${err.message}`
        : "Could not access microphone.";
      setPermissionError(msg);
      return;
    }

    streamRef.current = stream;
    isActiveRef.current = true;

    const mimeType = getSupportedMimeType();
    mimeTypeRef.current = mimeType;

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current || "audio/webm" });
      chunksRef.current = [];

      if (blob.size > 0) {
        onChunk(blob, mimeTypeRef.current || "audio/webm");
      }

      // Restart if still active (this was a flush, not a user stop)
      if (isActiveRef.current) {
        recorder.start();
      }
    };

    recorder.start();
    startAudioLevel(stream);
    setIsRecording(true);

    // Auto-flush every chunkIntervalMs
    intervalRef.current = setInterval(() => {
      if (isActiveRef.current && recorder.state === "recording") {
        recorder.stop();
      }
    }, chunkIntervalMs);
  }, [chunkIntervalMs, onChunk, startAudioLevel]);

  const stopRecording = useCallback(() => {
    isActiveRef.current = false;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }

    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioContextRef.current?.close();
    audioContextRef.current = null;

    stopAudioLevel();
    setIsRecording(false);
  }, [stopAudioLevel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (mediaRecorderRef.current?.state !== "inactive") {
        mediaRecorderRef.current?.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioContextRef.current?.close();
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return { isRecording, audioLevel, permissionError, startRecording, stopRecording, flushChunk };
}
