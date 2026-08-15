import { describe, expect, it } from "vitest";
import { generateConversationKey } from "@/crypto/conversationKeys";
import { decryptMessage, encryptMessage } from "@/crypto/messageCrypto";
import { decodeBase64, encodeBase64, getSodium } from "@/crypto/sodium";
import type {
  Base64String,
  ConversationKey,
  MessageAssociatedData,
} from "@/crypto/types";

const context: MessageAssociatedData = {
  conversationId: "10000000-0000-4000-8000-000000000001",
  senderId: "20000000-0000-4000-8000-000000000002",
  messageId: "30000000-0000-4000-8000-000000000003",
  encryptionVersion: 1,
};

describe("message crypto", () => {
  it("round-trips Unicode plaintext with unique nonces", async () => {
    const key = await generateConversationKey();
    const first = await encryptMessage("private hello 👀", key, context);
    const second = await encryptMessage("private hello 👀", key, context);

    expect(first.nonce).not.toBe(second.nonce);
    await expect(decryptMessage(first, key, context)).resolves.toBe(
      "private hello 👀",
    );
  });

  it("rejects modified ciphertext", async () => {
    const sodium = await getSodium();
    const key = await generateConversationKey();
    const encrypted = await encryptMessage("do not alter", key, context);
    const bytes = decodeBase64(sodium, encrypted.ciphertext);
    bytes[0] ^= 1;

    await expect(
      decryptMessage(
        {
          ...encrypted,
          ciphertext: encodeBase64(sodium, bytes),
        },
        key,
        context,
      ),
    ).rejects.toThrow("Unable to decrypt message");
  });

  it("rejects ciphertext replayed under different routing metadata", async () => {
    const key = await generateConversationKey();
    const encrypted = await encryptMessage("bound to context", key, context);

    await expect(
      decryptMessage(encrypted, key, {
        ...context,
        messageId: "40000000-0000-4000-8000-000000000004",
      }),
    ).rejects.toThrow("Unable to decrypt message");
  });

  it("rejects an invalid conversation key", async () => {
    await expect(
      encryptMessage(
        "secret",
        new Uint8Array(1) as ConversationKey,
        context,
      ),
    ).rejects.toThrow("Invalid conversation key");
  });

  it("rejects malformed base64 ciphertext", async () => {
    const key = await generateConversationKey();
    const encrypted = await encryptMessage("secret", key, context);
    await expect(
      decryptMessage(
        { ...encrypted, ciphertext: "not base64!" as Base64String },
        key,
        context,
      ),
    ).rejects.toThrow("Invalid base64 data");
  });

  it("rejects a modified nonce", async () => {
    const sodium = await getSodium();
    const key = await generateConversationKey();
    const encrypted = await encryptMessage("secret", key, context);
    const nonce = decodeBase64(sodium, encrypted.nonce);
    nonce[0] ^= 1;

    await expect(
      decryptMessage(
        { ...encrypted, nonce: encodeBase64(sodium, nonce) },
        key,
        context,
      ),
    ).rejects.toThrow("Unable to decrypt message");
  });

  it("rejects malformed routing identifiers", async () => {
    const key = await generateConversationKey();
    await expect(
      encryptMessage("secret", key, { ...context, messageId: "not-a-uuid" }),
    ).rejects.toThrow("Invalid message routing metadata");
  });
});