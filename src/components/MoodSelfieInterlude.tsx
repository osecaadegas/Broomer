"use client";

import { useEffect, useRef, useState } from "react";

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
  "bad days are a thing indeed but i will be here to make them easier as much as im able";

interface Props {
  onComplete: (selfie: string | null) => void;
}

export function MoodSelfieInterlude({ onComplete }: Readonly<Props>) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [phase, setPhase] = useState<"sentences" | "camera" | "captured" | "unavailable">(
    "sentences",
  );
  const [selfie, setSelfie] = useState<string | null>(null);

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
    if (phase !== "captured" && phase !== "unavailable") return;
    const timer = setTimeout(() => onComplete(selfie), 5200);
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

  return (
    <section className="fixed inset-0 z-[75] flex items-center justify-center overflow-y-auto bg-[#09070d]/95 px-4 py-6 text-center backdrop-blur-xl">
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
      ) : (
        <div className="flex w-full max-w-sm flex-col items-center">
          <div className="animate-selfie-reveal relative aspect-[3/4] max-h-[58dvh] w-[min(82vw,22rem)] overflow-hidden rounded-2xl border border-[#c46b91]/45 bg-[#160f19] shadow-[0_1.5rem_4rem_rgba(0,0,0,0.65),0_0_3rem_rgba(180,56,112,0.18)]">
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
                onPlaying={captureAfterDelay}
                className="h-full w-full scale-x-[-1] object-cover"
              />
            )}
          </div>
          <p className="animate-hope-message mt-5 max-w-md font-serif text-[clamp(1rem,4.2vw,1.25rem)] leading-relaxed text-[#efadc8]">
            {finalMessage}
          </p>
        </div>
      )}
    </section>
  );
}