"use client";

import Image from "next/image";
import { useEffect } from "react";

interface Props {
  onAnimationDone: () => void;
}

export function KissFinale({ onAnimationDone }: Readonly<Props>) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[80] grid place-items-center overflow-hidden bg-[#08060d]/45"
    >
      <div className="animate-kiss-cloud absolute h-[min(86vw,34rem)] w-[min(86vw,34rem)] rounded-full" />
      <div className="animate-kiss-cloud-soft absolute h-[min(110vw,44rem)] w-[min(110vw,44rem)] rounded-full" />
      <div
        className="animate-kiss-zoom relative w-[min(72vw,28rem)]"
        onAnimationEnd={onAnimationDone}
      >
        <Image
          src="/kiss.png"
          alt=""
          width={1280}
          height={1280}
          priority
          sizes="(max-width: 640px) 72vw, 448px"
          className="h-auto w-full object-contain drop-shadow-[0_1.5rem_2.5rem_rgba(65,0,28,0.65)]"
        />
      </div>
    </div>
  );
}