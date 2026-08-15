"use client";

import Image from "next/image";
import type { KeyboardEvent, ReactNode, SyntheticEvent } from "react";
import { useEffect, useRef, useState } from "react";

const EMOJIS = ["😂", "❤️", "🥹", "😭", "😈", "🤭", "🔥", "👀", "💀", "✨"];

function submitOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key !== "Enter" || event.shiftKey) return;
  event.preventDefault();
  event.currentTarget.form?.requestSubmit();
}

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

interface Conversation {
  id: number;
  createdAt: string;
  lastMessageAt: string;
  messages: ChatMessage[];
}

interface InboxResponse {
  conversations?: Conversation[];
  error?: string;
}

export function YappingInbox() {
  const endRef = useRef<HTMLDivElement>(null);
  const gifInputRef = useRef<HTMLInputElement>(null);
  const selectedIdRef = useRef<number | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [gifData, setGifData] = useState<string | null>(null);
  const [gifName, setGifName] = useState("");
  const [disappearing, setDisappearing] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    let cancelled = false;

    async function loadInbox() {
      try {
        const activeConversationId = selectedIdRef.current;
        const query = activeConversationId
          ? `?conversationId=${activeConversationId}`
          : "";
        const response = await fetch(`/api/chats/admin${query}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as InboxResponse;
        if (!response.ok) throw new Error(data.error || "Could not load chats");
        if (cancelled) return;

        const nextConversations = data.conversations ?? [];
        setConversations(nextConversations);
        setSelectedId((current) => {
          if (current && nextConversations.some((item) => item.id === current)) {
            return current;
          }
          return nextConversations[0]?.id ?? null;
        });
        setError(null);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Could not load chats",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadInbox();
    const interval = window.setInterval(() => void loadInbox(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const selected = conversations.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected?.messages]);

  async function sendReply(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!selected || (!body && !gifData) || sending) return;

    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/chats/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selected.id,
          body,
          gifData,
          disappearing,
        }),
      });
      const data = (await response.json()) as InboxResponse;
      if (!response.ok) throw new Error(data.error || "Could not send reply");
      setConversations(data.conversations ?? []);
      setDraft("");
      setGifData(null);
      setGifName("");
      setEmojiOpen(false);
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : "Could not send reply",
      );
    } finally {
      setSending(false);
    }
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

  let conversationList: ReactNode;
  if (loading) {
    conversationList = <p className="p-4 text-sm text-slate-500">Loading chats...</p>;
  } else if (conversations.length === 0) {
    conversationList = <p className="p-4 text-sm text-slate-500">No yapping yet.</p>;
  } else {
    conversationList = conversations.map((conversation) => {
      const lastMessage = conversation.messages.at(-1);
      const active = conversation.id === selectedId;
      return (
        <button
          key={conversation.id}
          type="button"
          onClick={() => setSelectedId(conversation.id)}
          className={`block w-full border-b border-slate-200 px-4 py-3 text-left transition ${
            active ? "bg-emerald-50" : "hover:bg-white"
          }`}
        >
          <span className="flex items-center justify-between gap-2">
            <strong className="text-sm text-slate-900">
              Yapper #{conversation.id}
            </strong>
            <time className="shrink-0 text-[0.65rem] text-slate-500">
              {new Intl.DateTimeFormat(undefined, {
                month: "short",
                day: "numeric",
              }).format(new Date(conversation.lastMessageAt))}
            </time>
          </span>
          <span className="mt-1 block truncate text-xs text-slate-500">
            {lastMessage?.body ?? (lastMessage?.gifData ? "GIF" : "Empty conversation")}
          </span>
        </button>
      );
    });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="grid min-h-[65vh] grid-rows-[auto_1fr] md:grid-cols-[17rem_1fr] md:grid-rows-1">
        <aside className="max-h-52 overflow-y-auto border-b border-slate-200 bg-slate-50 md:max-h-none md:border-b-0 md:border-r">
          {conversationList}
        </aside>

        <section className="flex min-h-0 flex-col bg-[#efeae2]">
          {selected ? (
            <>
              <header className="shrink-0 border-b border-black/5 bg-[#176b5b] px-4 py-3 text-white">
                <h2 className="font-semibold">Yapper #{selected.id}</h2>
                <p className="text-xs text-white/70">private conversation</p>
              </header>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
                {selected.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm sm:max-w-[70%] ${
                      message.sender === "admin"
                        ? "ml-auto rounded-tr-sm bg-[#d9fdd3]"
                        : "rounded-tl-sm bg-white"
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
                      <p className="whitespace-pre-wrap break-words leading-relaxed text-slate-900">
                        {message.body}
                      </p>
                    )}
                    {message.disappearing && (
                      <p className="mt-1 text-[0.65rem] text-slate-500">
                        ◷ {message.seenAt ? "Deletes 10 min after seen" : "Timer starts when seen"}
                      </p>
                    )}
                    <time className="mt-1 block text-right text-[0.65rem] text-slate-500">
                      {new Intl.DateTimeFormat(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(message.createdAt))}
                    </time>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <form
                onSubmit={sendReply}
                className="relative flex shrink-0 flex-col gap-2 border-t border-black/5 bg-[#f5f3ef] p-3"
              >
                {gifData && (
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
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
                  <div className="absolute bottom-16 left-3 z-10 grid grid-cols-5 gap-1 rounded-lg border border-black/10 bg-white p-2 shadow-lg">
                    {EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setDraft((current) => `${current}${emoji}`)}
                        className="grid h-9 w-9 place-items-center rounded-md text-xl hover:bg-slate-100"
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
                    onKeyDown={submitOnEnter}
                    placeholder="Reply"
                    aria-label="Reply"
                    className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-base text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
                  />
                  <button
                    type="submit"
                    disabled={(draft.trim() === "" && !gifData) || sending}
                    className="h-11 shrink-0 rounded-full bg-[#1d8f78] px-5 text-sm font-semibold text-white transition hover:bg-[#177461] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Send
                  </button>
                </div>
                {disappearing && (
                  <p className="px-2 text-[0.65rem] text-slate-500">
                    This message deletes 10 minutes after it is seen.
                  </p>
                )}
              </form>
            </>
          ) : (
            <div className="grid flex-1 place-items-center p-6 text-sm text-slate-500">
              Select a conversation.
            </div>
          )}
        </section>
      </div>
      {error && (
        <p role="alert" className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}