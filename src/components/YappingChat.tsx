"use client";

import Image from "next/image";
import type { KeyboardEvent, ReactNode, SyntheticEvent } from "react";
import { useEffect, useRef, useState } from "react";

const CHAT_TOKEN_KEY = "broomer-yapping-token";
const EMOJIS = ["😂", "❤️", "🥹", "😭", "😈", "🤭", "🔥", "👀", "💀", "✨"];

interface ChatMessage {
  id: number;
  sender: "visitor" | "admin";
  body: string | null;
  gifData: string | null;
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
  const [gifName, setGifName] = useState("");
  const [disappearing, setDisappearing] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
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
            loadError instanceof Error ? loadError.message : "Could not load chat",
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
    if ((!body && !gifData) || sending) return;

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
      setGifName("");
      setEmojiOpen(false);
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : "Could not send message",
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
      setGifName(file.name);
      setError(null);
    };
    reader.onerror = () => setError("Could not read that GIF");
    reader.readAsDataURL(file);
  }

  let messageHistory: ReactNode;
  if (loading) {
    messageHistory = (
      <p className="self-center rounded-md bg-white/90 px-3 py-1.5 text-xs text-[#66746d] shadow-sm">
        Loading conversation...
      </p>
    );
  } else if (messages.length === 0) {
    messageHistory = (
      <div className="mb-auto mt-[18vh] self-center text-center">
        <p className="text-xl font-semibold text-[#23463d]">You chose yapping.</p>
        <p className="mt-1 text-sm text-[#66746d]">Say it all. This chat is saved.</p>
      </div>
    );
  } else {
    messageHistory = messages.map((message) => (
      <div
        key={message.id}
        className={`max-w-[85%] rounded-lg px-3 py-2 shadow-sm sm:max-w-[70%] ${
          message.sender === "visitor"
            ? "self-end rounded-tr-sm bg-[#d9fdd3]"
            : "self-start rounded-tl-sm bg-white"
        }`}
      >
        {message.gifData && (
          <Image
            src={message.gifData}
            alt="Shared GIF"
            width={360}
            height={240}
            unoptimized
            className="mb-1 h-auto max-h-72 w-full rounded-md object-contain"
          />
        )}
        {message.body && (
          <p className="whitespace-pre-wrap break-words text-[0.94rem] leading-relaxed">
            {message.body}
          </p>
        )}
        {message.disappearing && (
          <p className="mt-1 text-[0.65rem] text-[#587068]">
            ◷ {message.seenAt ? "Deletes 10 min after seen" : "Timer starts when seen"}
          </p>
        )}
        <time
          dateTime={message.createdAt}
          className="mt-0.5 block text-right text-[0.65rem] text-[#6d7b74]"
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
    <section className="fixed inset-0 z-[80] flex min-h-svh flex-col bg-[#efeae2] text-[#17221d]">
      <header className="flex h-16 shrink-0 items-center gap-3 bg-[#176b5b] px-3 text-white shadow-sm sm:px-5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to entrance"
          title="Back"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-2xl transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <span aria-hidden>←</span>
        </button>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#d9fdd3] text-lg font-bold text-[#176b5b]">
          Y
        </div>
        <div className="min-w-0 text-left">
          <h1 className="truncate text-base font-semibold">Yapping</h1>
          <p className="truncate text-xs text-white/75">private conversation</p>
        </div>
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-6"
        style={{
          backgroundColor: "#efeae2",
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(23,107,91,0.08) 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
      >
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-end gap-2">
          {messageHistory}
          <div ref={endRef} />
        </div>
      </div>

      <footer className="shrink-0 border-t border-black/5 bg-[#f5f3ef] px-2 py-2 sm:px-4 sm:py-3">
        {error && (
          <p role="alert" className="mx-auto mb-2 max-w-3xl text-center text-xs text-red-700">
            {error}
          </p>
        )}
        <form
          onSubmit={sendMessage}
          className="relative mx-auto flex w-full max-w-3xl flex-col gap-2"
        >
          {gifData && (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-xs text-[#52625b] shadow-sm">
              <span className="truncate">GIF: {gifName}</span>
              <button
                type="button"
                onClick={() => {
                  setGifData(null);
                  setGifName("");
                }}
                aria-label="Remove GIF"
                title="Remove GIF"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full hover:bg-black/5"
              >
                ×
              </button>
            </div>
          )}
          {emojiOpen && (
            <div className="absolute bottom-14 left-0 z-10 grid grid-cols-5 gap-1 rounded-lg border border-black/10 bg-white p-2 shadow-lg">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setDraft((current) => `${current}${emoji}`)}
                  className="grid h-9 w-9 place-items-center rounded-md text-xl hover:bg-[#efeae2]"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <div className="flex min-h-11 items-center gap-0.5 rounded-2xl border border-black/10 bg-white pl-1">
              <button
                type="button"
                onClick={() => setEmojiOpen((current) => !current)}
                aria-label="Choose emoji"
                title="Emoji"
                className="grid h-9 w-9 place-items-center rounded-full text-lg hover:bg-black/5"
              >
                ☺
              </button>
              <button
                type="button"
                onClick={() => gifInputRef.current?.click()}
                aria-label="Attach GIF"
                title="Attach GIF"
                className="grid h-9 w-9 place-items-center rounded-full text-xs font-bold hover:bg-black/5"
              >
                GIF
              </button>
              <button
                type="button"
                onClick={() => setDisappearing((current) => !current)}
                aria-pressed={disappearing}
                aria-label="Toggle disappearing message"
                title="Delete 10 minutes after seen"
                className={`grid h-9 w-9 place-items-center rounded-full text-lg ${
                  disappearing ? "bg-[#d9fdd3] text-[#176b5b]" : "hover:bg-black/5"
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
              className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-base outline-none placeholder:text-[#87918c] focus:border-[#1d8f78] focus:ring-2 focus:ring-[#1d8f78]/15"
            />
            <button
              type="submit"
              disabled={(draft.trim() === "" && !gifData) || sending}
              aria-label="Send message"
              title="Send"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#1d8f78] text-lg text-white shadow-sm transition hover:bg-[#177461] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span aria-hidden>➤</span>
            </button>
          </div>
          {disappearing && (
            <p className="px-2 text-[0.65rem] text-[#66746d]">
              This message deletes 10 minutes after it is seen.
            </p>
          )}
        </form>
      </footer>
    </section>
  );
}