"use client";

import type { ReactNode } from "react";
import { useDeferredValue, useEffect, useRef, useState } from "react";

const GIPHY_CUSTOMER_ID_KEY = "broomer-giphy-customer-id";

function registerGiphyAction(analyticsUrl: string | undefined) {
  if (!analyticsUrl) return;
  let customerId = window.localStorage.getItem(GIPHY_CUSTOMER_ID_KEY);
  if (!customerId) {
    customerId = crypto.randomUUID();
    window.localStorage.setItem(GIPHY_CUSTOMER_ID_KEY, customerId);
  }
  const url = new URL(analyticsUrl);
  url.searchParams.set("customer_id", customerId);
  url.searchParams.set("ts", Date.now().toString());
  void fetch(url, { mode: "no-cors" });
}

interface GiphyImage {
  url?: string;
  width?: string;
  height?: string;
}

interface GiphyItem {
  id: string;
  title: string;
  images?: {
    fixed_width?: GiphyImage;
    fixed_width_small?: GiphyImage;
  };
  analytics?: {
    onload?: { url?: string };
    onclick?: { url?: string };
  };
}

interface GiphyResponse {
  data?: GiphyItem[];
  meta?: { msg?: string };
}

interface Props {
  onSelect: (url: string, title: string) => void;
  onUpload: () => void;
  onClose: () => void;
}

export function GiphyPicker({ onSelect, onUpload, onClose }: Readonly<Props>) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const [items, setItems] = useState<GiphyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const viewedAnalyticsRef = useRef(new Set<string>());
  const apiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY;

  useEffect(() => {
    if (!apiKey) return;
    const controller = new AbortController();
    const timer = window.setTimeout(
      async () => {
        setLoading(true);
        setError(null);
        try {
          const endpoint = deferredQuery
            ? "https://api.giphy.com/v1/gifs/search"
            : "https://api.giphy.com/v1/gifs/trending";
          const url = new URL(endpoint);
          url.searchParams.set("api_key", apiKey);
          url.searchParams.set("limit", "18");
          url.searchParams.set("rating", "pg-13");
          url.searchParams.set("bundle", "messaging_non_clips");
          if (deferredQuery)
            url.searchParams.set("q", deferredQuery.slice(0, 50));

          const response = await fetch(url, { signal: controller.signal });
          const data = (await response.json()) as GiphyResponse;
          if (!response.ok)
            throw new Error(data.meta?.msg || "Could not load GIFs");
          setItems(data.data ?? []);
        } catch (loadError) {
          if (controller.signal.aborted) return;
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load GIFs",
          );
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      },
      deferredQuery ? 350 : 0,
    );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [apiKey, deferredQuery]);

  function chooseGif(item: GiphyItem) {
    const url = item.images?.fixed_width?.url;
    if (!url) return;
    registerGiphyAction(item.analytics?.onclick?.url);
    onSelect(url, item.title || "GIPHY GIF");
  }

  let pickerContent: ReactNode;
  if (!apiKey) {
    pickerContent = (
      <div className="grid h-full place-items-center px-5 text-center">
        <div>
          <p className="font-serif text-base italic text-[#e6c4d4]">
            GIPHY library needs its key
          </p>
          <p className="mt-1 text-xs leading-relaxed text-stone-500">
            Add NEXT_PUBLIC_GIPHY_API_KEY, then reopen this tray.
          </p>
          <button
            type="button"
            onClick={onUpload}
            className="mt-4 border border-[#8b5b79]/45 bg-[#281522] px-3 py-2 text-xs font-semibold text-[#e6c4d4] hover:border-[#c985a6]/70"
          >
            Upload a GIF instead
          </button>
        </div>
      </div>
    );
  } else if (loading) {
    pickerContent = (
      <p className="py-10 text-center text-xs text-stone-500">
        Summoning GIFs...
      </p>
    );
  } else if (error) {
    pickerContent = (
      <p role="alert" className="py-10 text-center text-xs text-red-300">
        {error}
      </p>
    );
  } else if (items.length === 0) {
    pickerContent = (
      <p className="py-10 text-center text-xs text-stone-500">No GIFs found.</p>
    );
  } else {
    pickerContent = (
      <div className="grid grid-cols-3 gap-1.5">
        {items.map((item) => {
          const preview =
            item.images?.fixed_width_small?.url ??
            item.images?.fixed_width?.url;
          if (!preview) return null;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => chooseGif(item)}
              title={item.title || "Choose GIF"}
              className="aspect-square overflow-hidden border border-transparent bg-black/30 transition hover:border-[#d8b566]/70 focus-visible:border-[#d8b566] focus-visible:outline-none"
            >
              {/* GIPHY returns animated media URLs that Next Image must not optimize. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt={item.title || "GIF preview"}
                onLoad={() => {
                  const analyticsUrl = item.analytics?.onload?.url;
                  if (
                    !analyticsUrl ||
                    viewedAnalyticsRef.current.has(analyticsUrl)
                  )
                    return;
                  viewedAnalyticsRef.current.add(analyticsUrl);
                  registerGiphyAction(analyticsUrl);
                }}
                className="h-full w-full object-cover"
              />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="absolute bottom-14 left-0 right-0 z-20 overflow-hidden rounded-md border border-[#8b5b79]/45 bg-[#110b16]/98 shadow-[0_1.5rem_4rem_rgba(0,0,0,0.8)] backdrop-blur-xl">
      <div className="flex items-center gap-2 border-b border-[#8b5b79]/25 p-2.5">
        <span aria-hidden className="text-[#d8b566]">
          ⌕
        </span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search GIPHY"
          aria-label="Search GIFs"
          className="min-w-0 flex-1 bg-transparent text-sm text-stone-100 outline-none placeholder:text-stone-600"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close GIF library"
          title="Close"
          className="grid h-8 w-8 place-items-center text-lg text-stone-500 hover:text-stone-100"
        >
          ×
        </button>
      </div>

      <div className="h-64 overflow-y-auto p-2">{pickerContent}</div>

      <div className="flex items-center justify-between border-t border-[#8b5b79]/25 px-3 py-2">
        <button
          type="button"
          onClick={onUpload}
          className="text-[0.65rem] font-medium text-stone-500 hover:text-[#e6c4d4]"
        >
          Upload GIF
        </button>
        <span className="text-[0.6rem] font-bold tracking-wide text-stone-500">
          POWERED BY GIPHY
        </span>
      </div>
    </div>
  );
}
