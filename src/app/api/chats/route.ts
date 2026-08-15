import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createChatSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface ChatMessageRow {
  id: number;
  sender: "visitor" | "admin";
  body: string | null;
  gif_data: string | null;
  disappearing: boolean;
  seen_at: string | null;
  expires_at: string | null;
  created_at: string;
}

interface MessagePayload {
  token?: unknown;
  body?: unknown;
  gifData?: unknown;
  disappearing?: unknown;
}

const MAX_GIF_DATA_LENGTH = 1_400_000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isValidToken(token: unknown): token is string {
  return typeof token === "string" && /^[0-9a-f]{64}$/.test(token);
}

function serializeMessages(rows: ChatMessageRow[]) {
  return rows.map((row) => ({
    id: row.id,
    sender: row.sender,
    body: row.body,
    gifData: row.gif_data,
    disappearing: row.disappearing,
    seenAt: row.seen_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));
}

function isValidGifData(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= MAX_GIF_DATA_LENGTH &&
    /^data:image\/gif;base64,[A-Za-z0-9+/=]+$/.test(value)
  );
}

function parseMessage(payload: MessagePayload) {
  const messageBody = typeof payload.body === "string" ? payload.body.trim() : "";
  const gifData = payload.gifData ?? null;
  if (messageBody.length > 2000 || (messageBody === "" && gifData === null)) {
    return { error: "Add a message or GIF" } as const;
  }
  if (gifData !== null && !isValidGifData(gifData)) {
    return { error: "GIF must be a valid GIF file no larger than 1 MB" } as const;
  }
  if (
    payload.disappearing !== undefined &&
    typeof payload.disappearing !== "boolean"
  ) {
    return { error: "Invalid disappearing mode" } as const;
  }
  return {
    messageBody,
    gifData,
    disappearing: payload.disappearing === true,
  } as const;
}

async function getConversationId(token: string) {
  const supabase = createChatSupabaseClient(hashToken(token));

  const { data, error } = await supabase
    .from("chat_conversations")
    .select("id")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (error) return { error: error.message } as const;
  if (!data) return { error: "Conversation not found" } as const;
  return { supabase, conversationId: data.id as number } as const;
}

async function resolveConversation(tokenValue: unknown) {
  if (tokenValue === null || tokenValue === undefined) {
    const token = randomBytes(32).toString("hex");
    const supabase = createChatSupabaseClient(hashToken(token));
    const { data, error } = await supabase
      .from("chat_conversations")
      .insert({ token_hash: hashToken(token) })
      .select("id")
      .single();
    if (error) return { error: error.message, status: 500 } as const;
    return {
      token,
      supabase,
      conversationId: data.id as number,
      createdConversation: true,
    } as const;
  }

  if (!isValidToken(tokenValue)) {
    return { error: "Invalid conversation token", status: 400 } as const;
  }
  const conversation = await getConversationId(tokenValue);
  if ("error" in conversation) {
    const status = conversation.error === "Conversation not found" ? 404 : 500;
    return { error: conversation.error, status } as const;
  }
  return {
    token: tokenValue,
    ...conversation,
    createdConversation: false,
  } as const;
}

async function loadMessages(
  supabase: ReturnType<typeof createChatSupabaseClient>,
  conversationId: number,
) {
  const { data, error } = await supabase
    .from("chat_messages")
    .select(
      "id, sender, body, gif_data, disappearing, seen_at, expires_at, created_at",
    )
    .eq("conversation_id", conversationId)
    .order("created_at")
    .order("id");
  if (error) return { error: error.message } as const;
  return { messages: serializeMessages(data as ChatMessageRow[]) } as const;
}

export async function GET(request: Request) {
  const token = request.headers.get("x-chat-token");
  if (!isValidToken(token)) {
    return NextResponse.json({ error: "Invalid conversation token" }, { status: 400 });
  }

  const conversation = await getConversationId(token);
  if ("error" in conversation) {
    const status = conversation.error === "Conversation not found" ? 404 : 500;
    return NextResponse.json({ error: conversation.error }, { status });
  }

  const seenAt = new Date();
  const expiresAt = new Date(seenAt.getTime() + 10 * 60 * 1000);
  const { error: seenError } = await conversation.supabase
    .from("chat_messages")
    .update({ seen_at: seenAt.toISOString(), expires_at: expiresAt.toISOString() })
    .eq("conversation_id", conversation.conversationId)
    .eq("sender", "admin")
    .eq("disappearing", true)
    .is("seen_at", null);
  if (seenError) {
    return NextResponse.json({ error: seenError.message }, { status: 500 });
  }

  const result = await loadMessages(
    conversation.supabase,
    conversation.conversationId,
  );
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = (body ?? {}) as MessagePayload;
  const message = parseMessage(payload);
  if ("error" in message) {
    return NextResponse.json({ error: message.error }, { status: 400 });
  }
  const conversation = await resolveConversation(payload.token);
  if ("error" in conversation) {
    return NextResponse.json(
      { error: conversation.error },
      { status: conversation.status },
    );
  }

  const createdAt = new Date().toISOString();
  const { error: messageError } = await conversation.supabase
    .from("chat_messages")
    .insert({
    conversation_id: conversation.conversationId,
    sender: "visitor",
    body: message.messageBody || null,
    gif_data: message.gifData,
    disappearing: message.disappearing,
    created_at: createdAt,
  });
  if (messageError) {
    if (conversation.createdConversation) {
      await conversation.supabase
        .from("chat_conversations")
        .delete()
        .eq("id", conversation.conversationId);
    }
    return NextResponse.json({ error: messageError.message }, { status: 500 });
  }

  await conversation.supabase
    .from("chat_conversations")
    .update({ last_message_at: createdAt })
    .eq("id", conversation.conversationId);

  const result = await loadMessages(
    conversation.supabase,
    conversation.conversationId,
  );
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(
    { token: conversation.token, ...result },
    { status: 201 },
  );
}