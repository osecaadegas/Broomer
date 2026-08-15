"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const sentences = [
  { text: "I need to confess you something....", duration: 6000 },
  {
    text: "Im sorry if i pick you on a less good mood today but...",
    duration: 7000,
  },
  {
    text: "I meet someone that makes me laugh like a idiot at the screen when i read theyre messages",
    duration: 10000,
  },
  { text: "Im truely afraid of ....", duration: 6000 },
  {
    text: "But i think you deserve to know at least its the most fair thing to do",
    duration: 8500,
  },
];

const finalMessage =
  "Now that you have meet her ,bad days are a thing indeed but i will be here to make them easier as much as im able";

interface Props {
  onComplete: (selfie: string | null, moodTalk: string | null) => void;
}

export function MoodSelfieInterlude({ onComplete }: Readonly<Props>) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [phase, setPhase] = useState<
    "sentences" | "camera" | "captured" | "talk" | "unavailable"
  >("sentences");
  const [selfie, setSelfie] = useState<string | null>(null);
  const [cameraAccepted, setCameraAccepted] = useState(false);
  const [moodTalk, setMoodTalk] = useState("");

  useEffect(() => {
    if (phase !== "sentences") return;
    const timer = setTimeout(() => {
      if (sentenceIndex < sentences.length - 1) {
        setSentenceIndex((current) => current + 1);
      } else {
        setPhase("camera");
      }
    }, sentences[sentenceIndex].duration);
    return () => clearTimeout(timer);
  }, [phase, sentenceIndex]);

  useEffect(() => {
    if (phase !== "camera") return;
    let cancelled = false;

    if (!navigator.mediaDevices?.getUserMedia) {
      const timer = setTimeout(() => setPhase("unavailable"), 0);
      return () => clearTimeout(timer);
    }

    void navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 960 } },
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {
            stream.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
            if (!cancelled) setPhase("unavailable");
          });
        }
      })
      .catch(() => {
        if (!cancelled) setPhase("unavailable");
      });

    return () => {
      cancelled = true;
    };
  }, [phase]);

  useEffect(() => {
    if (phase === "captured") {
      const timer = setTimeout(() => setPhase("talk"), 4000);
      return () => clearTimeout(timer);
    }
    if (phase !== "unavailable") return;
    const timer = setTimeout(() => onComplete(null, null), 1800);
    return () => clearTimeout(timer);
  }, [onComplete, phase, selfie]);

  useEffect(() => {
    return () => {
      if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function captureAfterDelay() {
    if (captureTimerRef.current) return;
    captureTimerRef.current = setTimeout(() => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setPhase("unavailable");
        return;
      }

      const width = Math.min(480, video.videoWidth);
      const height = Math.round(width * (video.videoHeight / video.videoWidth));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setPhase("unavailable");
        return;
      }

      context.translate(width, 0);
      context.scale(-1, 1);
      context.drawImage(video, 0, 0, width, height);
      const capturedSelfie = canvas.toDataURL("image/jpeg", 0.72);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      video.srcObject = null;
      setSelfie(capturedSelfie);
      setPhase("captured");
    }, 1000);
  }

  function handleCameraPlaying() {
    setCameraAccepted(true);
    captureAfterDelay();
  }

  return createPortal(
    <section className="fixed inset-0 z-[75] flex items-center justify-center overflow-hidden bg-[#09070d]/95 px-4 py-4 text-center backdrop-blur-xl sm:py-6">
      {phase === "sentences" ? (
        <p
          key={sentenceIndex}
          className="animate-mood-sentence max-w-xl font-serif text-[clamp(1.35rem,5.5vw,2.15rem)] italic leading-relaxed text-[#bba9b4]"
          style={{
            animationDuration: `${sentences[sentenceIndex].duration}ms`,
          }}
        >
          {sentences[sentenceIndex].text}
        </p>
      ) : phase === "talk" ? (
        <div className="animate-selfie-reveal flex w-full max-w-md flex-col items-center rounded-2xl border border-[#c46b91]/35 bg-[#160f19]/95 px-5 py-5 shadow-[0_1.5rem_4rem_rgba(0,0,0,0.65)] sm:px-8 sm:py-8">
          <h2 className="font-serif text-[clamp(1.5rem,6vw,2.1rem)] italic text-[#efadc8]">
            Want to talk about it?
          </h2>
          <textarea
            rows={3}
            value={moodTalk}
            onChange={(event) => setMoodTalk(event.target.value)}
            placeholder="You can tell me here..."
            className="mt-6 w-full resize-none rounded-xl border border-[#c46b91]/35 bg-black/25 px-4 py-3 text-base text-stone-100 outline-none placeholder:text-stone-600 focus:border-[#dd8aad]/70 focus:ring-2 focus:ring-[#a73d6b]/30"
          />
          <div className="mt-5 flex w-full gap-3">
            <button
              type="button"
              onClick={() => onComplete(selfie, "")}
              className="flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-medium text-stone-400 transition hover:border-white/20 hover:text-stone-200"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => onComplete(selfie, moodTalk.trim())}
              disabled={moodTalk.trim() === ""}
              className="flex-1 rounded-xl bg-gradient-to-r from-[#861d48] to-[#603a78] px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-45"
            >
              Next
            </button>
          </div>
        </div>
      ) : (
        <div className="flex h-full w-full max-w-sm flex-col items-center justify-center gap-4 sm:gap-5">
          <div className="animate-selfie-reveal relative aspect-[3/4] h-[min(50dvh,calc((100vw-2rem)*4/3))] w-auto max-w-full shrink-0 overflow-hidden rounded-2xl border border-[#c46b91]/45 bg-[#160f19] shadow-[0_1.5rem_4rem_rgba(0,0,0,0.65),0_0_3rem_rgba(180,56,112,0.18)]">
            {phase === "captured" && selfie ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selfie} alt="Captured front-camera selfie" className="h-full w-full object-cover" />
            ) : phase === "unavailable" ? (
              <div className="grid h-full place-items-center px-8 font-serif text-lg italic text-[#a895a1]">
                Keep this thought with you.
              </div>
            ) : (
              <video
                ref={videoRef}
                muted
                playsInline
                onPlaying={handleCameraPlaying}
                className="h-full w-full scale-x-[-1] object-cover"
              />
            )}
          </div>
          {cameraAccepted && phase !== "unavailable" && (
            <p className="animate-hope-message max-w-md shrink-0 px-2 font-serif text-[clamp(0.95rem,4vw,1.25rem)] leading-relaxed text-[#efadc8] drop-shadow-[0_0.4rem_1rem_rgba(0,0,0,0.9)]">
              {finalMessage}
            </p>
          )}
        </div>
      )}
    </section>,
    document.body,
  );
}