"use client";

import type { KeyboardEvent, ReactNode, SyntheticEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { GiphyPicker } from "@/components/GiphyPicker";

const CHAT_TOKEN_KEY = "broomer-yapping-token";
const EMOJIS = ["😂", "❤️", "🥹", "😭", "😈", "🤭", "🔥", "👀", "💀", "✨"];

interface ChatMessage {
  id: number;
  sender: "visitor" | "admin";
  body: string | null;
  gifData: string | null;
  gifUrl: string | null;
  disappearing: boolean;
  seenAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface ChatResponse {
  token?: string;
  messages?: ChatMessage[];
  error?: string;
}

interface Props {
  onBack: () => void;
}

export function YappingChat({ onBack }: Readonly<Props>) {
  const endRef = useRef<HTMLDivElement>(null);
  const gifInputRef = useRef<HTMLInputElement>(null);
  const tokenRef = useRef<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [gifData, setGifData] = useState<string | null>(null);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [gifName, setGifName] = useState("");
  const [disappearing, setDisappearing] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [gifLibraryOpen, setGifLibraryOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = window.localStorage.getItem(CHAT_TOKEN_KEY);
    tokenRef.current = storedToken;
    let cancelled = false;

    async function loadMessages() {
      const activeToken = tokenRef.current;
      if (!activeToken) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const response = await fetch("/api/chats", {
          headers: { "x-chat-token": activeToken },
          cache: "no-store",
        });
        const data = (await response.json()) as ChatResponse;
        if (!response.ok) throw new Error(data.error || "Could not load chat");
        if (!cancelled) {
          setMessages(data.messages ?? []);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load chat",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const initialTimer = window.setTimeout(() => void loadMessages(), 0);
    const interval = window.setInterval(() => void loadMessages(), 3000);
    return () => {
      cancelled = true;
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(event?: SyntheticEvent<HTMLFormElement>) {
    event?.preventDefault();
    const body = draft.trim();
    if ((!body && !gifData && !gifUrl) || sending) return;

    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: tokenRef.current,
          body,
          gifData,
          gifUrl,
          disappearing,
        }),
      });
      const data = (await response.json()) as ChatResponse;
      if (!response.ok) throw new Error(data.error || "Could not send message");

      if (data.token) {
        window.localStorage.setItem(CHAT_TOKEN_KEY, data.token);
        tokenRef.current = data.token;
      }
      setMessages(data.messages ?? []);
      setDraft("");
      setGifData(null);
      setGifUrl(null);
      setGifName("");
      setEmojiOpen(false);
      setGifLibraryOpen(false);
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Could not send message",
      );
    } finally {
      setSending(false);
    }
  }

  function handleDraftKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void sendMessage();
  }

  function handleGif(file: File | undefined) {
    if (!file) return;
    if (file.type !== "image/gif" || file.size > 1_000_000) {
      setError("Choose a GIF file no larger than 1 MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setGifData(reader.result);
      setGifUrl(null);
      setGifName(file.name);
      setError(null);
    };
    reader.onerror = () => setError("Could not read that GIF");
    reader.readAsDataURL(file);
  }

  let messageHistory: ReactNode;
  if (loading) {
    messageHistory = (
      <p className="self-center border border-[#8b5b79]/30 bg-[#160e19]/90 px-3 py-1.5 text-xs text-stone-500 shadow-sm">
        Loading conversation...
      </p>
    );
  } else if (messages.length === 0) {
    messageHistory = (
      <div className="mb-auto mt-[18vh] self-center text-center">
        <p className="font-serif text-xl italic text-[#e6c4d4]">
          You chose yapping.
        </p>
        <p className="mt-1 text-sm text-stone-500">
          Say it all. This chat is saved.
        </p>
      </div>
    );
  } else {
    messageHistory = messages.map((message) => (
      <div
        key={message.id}
        className={`max-w-[85%] rounded-lg px-3 py-2 shadow-sm sm:max-w-[70%] ${
          message.sender === "visitor"
            ? "self-end rounded-tr-sm border border-[#8d4267]/40 bg-[#341528] text-stone-100"
            : "self-start rounded-tl-sm border border-[#6e5577]/35 bg-[#1b1220] text-stone-200"
        }`}
      >
        {(message.gifData || message.gifUrl) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={message.gifData ?? message.gifUrl ?? ""}
            alt="Shared GIF"
            className="mb-1 h-auto max-h-72 w-full rounded-md object-contain"
          />
        )}
        {message.body && (
          <p className="whitespace-pre-wrap break-words text-[0.94rem] leading-relaxed">
            {message.body}
          </p>
        )}
        {message.disappearing && (
          <p className="mt-1 text-[0.65rem] text-[#b58a9f]">
            ◷{" "}
            {message.seenAt
              ? "Deletes 10 min after seen"
              : "Timer starts when seen"}
          </p>
        )}
        <time
          dateTime={message.createdAt}
          className="mt-0.5 block text-right text-[0.65rem] text-stone-500"
        >
          {new Intl.DateTimeFormat(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(message.createdAt))}
        </time>
      </div>
    ));
  }

  return (
    <section className="fixed inset-0 z-[80] flex min-h-svh flex-col bg-[#08060d] text-stone-100">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-[#8b5b79]/30 bg-[#120a14]/95 px-3 text-stone-100 shadow-[0_0.5rem_2rem_rgba(0,0,0,0.55)] backdrop-blur-xl sm:px-5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to entrance"
          title="Back"
          className="grid h-10 w-10 shrink-0 place-items-center text-2xl text-[#d8b566] transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d8b566]"
        >
          <span aria-hidden>←</span>
        </button>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#d8b566]/35 bg-[#2b1423] font-serif text-lg italic text-[#efadc8] shadow-[0_0_1.25rem_rgba(178,66,113,0.18)]">
          Y
        </div>
        <div className="min-w-0 text-left">
          <h1 className="truncate font-serif text-base italic text-[#efadc8]">Yapping</h1>
          <p className="truncate text-xs text-stone-500">private conversation</p>
        </div>
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-6"
        style={{
          backgroundColor: "#08060d",
          backgroundImage:
            "linear-gradient(rgba(8,6,13,0.78),rgba(8,6,13,0.9)), repeating-linear-gradient(45deg, rgba(174,104,139,0.04) 0 1px, transparent 1px 18px)",
        }}
      >
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-end gap-2">
          {messageHistory}
          <div ref={endRef} />
        </div>
      </div>

      <footer className="shrink-0 border-t border-[#8b5b79]/25 bg-[#100a13]/95 px-2 py-2 backdrop-blur-xl sm:px-4 sm:py-3">
        {error && (
          <p
            role="alert"
            className="mx-auto mb-2 max-w-3xl text-center text-xs text-red-300"
          >
            {error}
          </p>
        )}
        <form
          onSubmit={sendMessage}
          className="relative mx-auto flex w-full max-w-3xl flex-col gap-2"
        >
          {(gifData || gifUrl) && (
            <div className="flex items-center justify-between gap-3 border border-[#8b5b79]/30 bg-[#1b101c] px-3 py-2 text-xs text-stone-400 shadow-sm">
              <span className="truncate">GIF: {gifName}</span>
              <button
                type="button"
                onClick={() => {
                  setGifData(null);
                  setGifUrl(null);
                  setGifName("");
                }}
                aria-label="Remove GIF"
                title="Remove GIF"
                className="grid h-7 w-7 shrink-0 place-items-center hover:bg-white/5 hover:text-white"
              >
                ×
              </button>
            </div>
          )}
          {emojiOpen && (
            <div className="absolute bottom-14 left-0 z-10 grid grid-cols-5 gap-1 border border-[#8b5b79]/40 bg-[#160e19] p-2 shadow-[0_1rem_3rem_rgba(0,0,0,0.7)]">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setDraft((current) => `${current}${emoji}`)}
                  className="grid h-9 w-9 place-items-center text-xl hover:bg-white/5"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          {gifLibraryOpen && (
            <GiphyPicker
              onSelect={(url, title) => {
                setGifUrl(url);
                setGifData(null);
                setGifName(title);
                setGifLibraryOpen(false);
              }}
              onUpload={() => {
                setGifLibraryOpen(false);
                gifInputRef.current?.click();
              }}
              onClose={() => setGifLibraryOpen(false)}
            />
          )}
          <div className="flex items-end gap-2">
            <div className="flex min-h-11 items-center gap-0.5 rounded-sm border border-[#8b5b79]/35 bg-[#1a101c] pl-1">
              <button
                type="button"
                onClick={() => setEmojiOpen((current) => !current)}
                aria-label="Choose emoji"
                title="Emoji"
                className="grid h-9 w-9 place-items-center text-lg text-[#c9a2b5] hover:bg-white/5 hover:text-white"
              >
                ☺
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmojiOpen(false);
                  setGifLibraryOpen((current) => !current);
                }}
                aria-label="Open GIF library"
                title="GIF library"
                className="grid h-9 w-9 place-items-center text-xs font-bold text-[#d8b566] hover:bg-white/5"
              >
                GIF
              </button>
              <button
                type="button"
                onClick={() => setDisappearing((current) => !current)}
                aria-pressed={disappearing}
                aria-label="Toggle disappearing message"
                title="Delete 10 minutes after seen"
                className={`grid h-9 w-9 place-items-center text-lg ${
                  disappearing
                    ? "bg-[#4a1f38] text-[#efadc8]"
                    : "text-[#c9a2b5] hover:bg-white/5"
                }`}
              >
                ◷
              </button>
              <input
                ref={gifInputRef}
                type="file"
                accept="image/gif"
                className="hidden"
                onChange={(event) => {
                  handleGif(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </div>
            <textarea
              rows={1}
              maxLength={2000}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleDraftKeyDown}
              placeholder="Message"
              aria-label="Message"
              className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-sm border border-[#8b5b79]/35 bg-[#1a101c] px-4 py-2.5 text-base text-stone-100 outline-none placeholder:text-stone-600 focus:border-[#c985a6]/70 focus:ring-2 focus:ring-[#a73d6b]/20"
            />
            <button
              type="submit"
              disabled={(draft.trim() === "" && !gifData && !gifUrl) || sending}
              aria-label="Send message"
              title="Send"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#d8b566]/35 bg-[#6e163e] text-lg text-white shadow-[0_0_1rem_rgba(167,61,107,0.25)] transition hover:bg-[#861d48] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span aria-hidden>➤</span>
            </button>
          </div>
          {disappearing && (
            <p className="px-2 text-[0.65rem] text-[#b58a9f]">
              This message deletes 10 minutes after it is seen.
            </p>
          )}
        </form>
      </footer>
    </section>
  );
}
