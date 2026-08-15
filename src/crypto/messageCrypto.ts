import { decodeBase64, encodeBase64, getSodium } from "@/crypto/sodium";
import type {
  ConversationKey,
  EncryptedMessage,
  MessageAssociatedData,
} from "@/crypto/types";

function encodeAssociatedData(
  sodium: Awaited<ReturnType<typeof getSodium>>,
  context: MessageAssociatedData,
) {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const identifiers = [
    context.conversationId,
    context.senderId,
    context.messageId,
  ];
  if (identifiers.some((identifier) => !uuidPattern.test(identifier))) {
    throw new Error("Invalid message routing metadata");
  }

  const encoded = new Uint8Array(49);
  encoded[0] = context.encryptionVersion;
  identifiers.forEach((identifier, index) => {
    encoded.set(sodium.from_hex(identifier.replaceAll("-", "")), 1 + index * 16);
  });
  return encoded;
}

export async function encryptMessage(
  plaintext: string,
  conversationKey: ConversationKey,
  context: MessageAssociatedData,
): Promise<EncryptedMessage> {
  const sodium = await getSodium();
  if (
    conversationKey.byteLength !==
    sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES
  ) {
    throw new Error("Invalid conversation key");
  }

  const nonce = sodium.randombytes_buf(
    sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES,
  );
  const associatedData = encodeAssociatedData(sodium, context);
  const plaintextBytes = sodium.from_string(plaintext);
  try {
    const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      plaintextBytes,
      associatedData,
      null,
      nonce,
      conversationKey,
    );
    return {
      ciphertext: encodeBase64(sodium, ciphertext),
      nonce: encodeBase64(sodium, nonce),
      encryptionVersion: 1,
    };
  } finally {
    sodium.memzero(plaintextBytes);
    sodium.memzero(associatedData);
  }
}

export async function decryptMessage(
  encrypted: EncryptedMessage,
  conversationKey: ConversationKey,
  context: MessageAssociatedData,
): Promise<string> {
  if (encrypted.encryptionVersion !== context.encryptionVersion) {
    throw new Error("Encryption version mismatch");
  }

  const sodium = await getSodium();
  const nonce = decodeBase64(sodium, encrypted.nonce);
  const ciphertext = decodeBase64(sodium, encrypted.ciphertext);
  const associatedData = encodeAssociatedData(sodium, context);
  try {
    if (
      conversationKey.byteLength !==
      sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES
    ) {
      throw new Error("Invalid conversation key");
    }
    if (nonce.byteLength !== sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES) {
      throw new Error("Invalid message nonce");
    }
    const plaintext = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      ciphertext,
      associatedData,
      nonce,
      conversationKey,
    );
    try {
      return sodium.to_string(plaintext);
    } finally {
      sodium.memzero(plaintext);
    }
  } catch {
    throw new Error("Unable to decrypt message");
  } finally {
    sodium.memzero(associatedData);
  }
}