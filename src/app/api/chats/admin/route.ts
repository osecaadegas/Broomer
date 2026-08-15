import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/server";

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

const MAX_GIF_DATA_LENGTH = 1_400_000;

interface ConversationRow {
  id: number;
  created_at: string;
  last_message_at: string;
  chat_messages: ChatMessageRow[];
}

function serializeConversation(row: ConversationRow) {
  return {
    id: row.id,
    createdAt: row.created_at,
    lastMessageAt: row.last_message_at,
    messages: [...row.chat_messages]
      .sort((left, right) => {
        const byDate = left.created_at.localeCompare(right.created_at);
        return byDate || left.id - right.id;
      })
      .map((message) => ({
        id: message.id,
        sender: message.sender,
        body: message.body,
        gifData: message.gif_data,
        disappearing: message.disappearing,
        seenAt: message.seen_at,
        expiresAt: message.expires_at,
        createdAt: message.created_at,
      })),
  };
}

async function loadConversations(
  supabase: NonNullable<Awaited<ReturnType<typeof getAdminSupabase>>>["supabase"],
) {
  const { data, error } = await supabase
    .from("chat_conversations")
    .select(
      "id, created_at, last_message_at, chat_messages(id, sender, body, gif_data, disappearing, seen_at, expires_at, created_at)",
    )
    .order("last_message_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) return { error: error.message } as const;
  return {
    conversations: (data as ConversationRow[]).map(serializeConversation),
  } as const;
}

function isValidGifData(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= MAX_GIF_DATA_LENGTH &&
    /^data:image\/gif;base64,[A-Za-z0-9+/=]+$/.test(value)
  );
}

export async function GET(request: Request) {
  const admin = await getAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawConversationId = new URL(request.url).searchParams.get("conversationId");
  if (rawConversationId !== null) {
    const conversationId = Number(rawConversationId);
    if (!Number.isSafeInteger(conversationId)) {
      return NextResponse.json({ error: "Invalid conversation" }, { status: 400 });
    }
    const seenAt = new Date();
    const expiresAt = new Date(seenAt.getTime() + 10 * 60 * 1000);
    const { error: seenError } = await admin.supabase
      .from("chat_messages")
      .update({ seen_at: seenAt.toISOString(), expires_at: expiresAt.toISOString() })
      .eq("conversation_id", conversationId)
      .eq("sender", "visitor")
      .eq("disappearing", true)
      .is("seen_at", null);
    if (seenError) {
      return NextResponse.json({ error: seenError.message }, { status: 500 });
    }
  }

  const result = await loadConversations(admin.supabase);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const admin = await getAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = (body ?? {}) as {
    conversationId?: unknown;
    body?: unknown;
    gifData?: unknown;
    disappearing?: unknown;
  };
  if (!Number.isSafeInteger(payload.conversationId)) {
    return NextResponse.json({ error: "Invalid conversation" }, { status: 400 });
  }
  const messageBody = typeof payload.body === "string" ? payload.body.trim() : "";
  const gifData = payload.gifData ?? null;
  if (messageBody.length > 2000 || (messageBody === "" && gifData === null)) {
    return NextResponse.json(
      { error: "Add a message or GIF" },
      { status: 400 },
    );
  }
  if (gifData !== null && !isValidGifData(gifData)) {
    return NextResponse.json(
      { error: "GIF must be a valid GIF file no larger than 1 MB" },
      { status: 400 },
    );
  }
  if (
    payload.disappearing !== undefined &&
    typeof payload.disappearing !== "boolean"
  ) {
    return NextResponse.json({ error: "Invalid disappearing mode" }, { status: 400 });
  }

  const conversationId = payload.conversationId as number;
  const createdAt = new Date().toISOString();
  const { error: insertError } = await admin.supabase
    .from("chat_messages")
    .insert({
      conversation_id: conversationId,
      sender: "admin",
      body: messageBody || null,
      gif_data: gifData,
      disappearing: payload.disappearing === true,
      created_at: createdAt,
    });
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const { error: updateError } = await admin.supabase
    .from("chat_conversations")
    .update({ last_message_at: createdAt })
    .eq("id", conversationId);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const result = await loadConversations(admin.supabase);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json(result, { status: 201 });
}