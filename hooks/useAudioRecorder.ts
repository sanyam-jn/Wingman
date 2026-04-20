"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface UseAudioRecorderOptions {
  chunkIntervalMs: number;
  onChunk: (blob: Blob, mimeType: string) => void;
  enableVAD?: boolean;
  vadSilenceMs?: number;
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
  return (
    candidates.find(
      (t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)
    ) ?? ""
  );
}

export function useAudioRecorder({
  chunkIntervalMs,
  onChunk,
  enableVAD = true,
  vadSilenceMs = 1500,
}: UseAudioRecorderOptions): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const vadFrameRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeTypeRef = useRef<string>("");
  const isActiveRef = useRef(false);
  const chunksRef = useRef<BlobPart[]>([]);

  // VAD state
  const chunkStartTimeRef = useRef<number>(0);
  const silenceStartRef = useRef<number | null>(null);

  const stopAudioLevel = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    cancelAnimationFrame(vadFrameRef.current);
    setAudioLevel(0);
  }, []);

  const startVAD = useCallback(
    (analyser: AnalyserNode) => {
      if (!enableVAD) return;
      analyser.fftSize = 2048;
      const timeDomainData = new Float32Array(analyser.fftSize);

      const vadTick = () => {
        analyser.getFloatTimeDomainData(timeDomainData);

        // RMS
        let sum = 0;
        for (let i = 0; i < timeDomainData.length; i++) {
          sum += timeDomainData[i] * timeDomainData[i];
        }
        const rms = Math.sqrt(sum / timeDomainData.length);

        const isSilent = rms < 0.02;
        const now = Date.now();
        const chunkDuration = now - chunkStartTimeRef.current;

        if (isSilent) {
          if (silenceStartRef.current === null) {
            silenceStartRef.current = now;
          } else if (
            now - silenceStartRef.current > vadSilenceMs &&
            chunkDuration > 5000
          ) {
            // Flush on silence
            silenceStartRef.current = null;
            const recorder = mediaRecorderRef.current;
            if (isActiveRef.current && recorder?.state === "recording") {
              recorder.stop();
            }
          }
        } else {
          silenceStartRef.current = null;
        }

        vadFrameRef.current = requestAnimationFrame(vadTick);
      };

      vadFrameRef.current = requestAnimationFrame(vadTick);
    },
    [enableVAD, vadSilenceMs]
  );

  const startAudioLevel = useCallback(
    (stream: MediaStream) => {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioContextRef.current = ctx;
      analyserRef.current = analyser;

      // Visualization loop (frequency domain)
      const freqData = new Uint8Array(analyser.frequencyBinCount);
      const vizTick = () => {
        analyser.getByteFrequencyData(freqData);
        const avg = freqData.reduce((a, b) => a + b, 0) / freqData.length;
        setAudioLevel(avg / 255);
        animFrameRef.current = requestAnimationFrame(vizTick);
      };
      animFrameRef.current = requestAnimationFrame(vizTick);

      // VAD loop (time domain, separate rAF)
      startVAD(analyser);
    },
    [startVAD]
  );

  const flushChunk = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
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
      const msg =
        err instanceof DOMException
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
    chunksRef.current = [];

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: mimeTypeRef.current || "audio/webm",
      });
      chunksRef.current = [];

      if (blob.size > 0) {
        onChunk(blob, mimeTypeRef.current || "audio/webm");
      }

      if (isActiveRef.current) {
        // Reset VAD state for new chunk
        chunkStartTimeRef.current = Date.now();
        silenceStartRef.current = null;
        recorder.start();
      }
    };

    chunkStartTimeRef.current = Date.now();
    silenceStartRef.current = null;
    recorder.start();

    startAudioLevel(stream);
    setIsRecording(true);

    // Max-duration fallback interval
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
      cancelAnimationFrame(vadFrameRef.current);
    };
  }, []);

  return {
    isRecording,
    audioLevel,
    permissionError,
    startRecording,
    stopRecording,
    flushChunk,
  };
}
