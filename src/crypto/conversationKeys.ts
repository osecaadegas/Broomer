import { decodeBase64, encodeBase64, getSodium } from "@/crypto/sodium";
import type {
  Base64String,
  ConversationKey,
  DeviceKeyPair,
} from "@/crypto/types";

export async function generateConversationKey(): Promise<ConversationKey> {
  const sodium = await getSodium();
  return sodium.randombytes_buf(
    sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES,
  ) as ConversationKey;
}

export async function wrapConversationKey(
  conversationKey: ConversationKey,
  recipientPublicKey: Base64String,
): Promise<Base64String> {
  const sodium = await getSodium();
  const publicKey = decodeBase64(sodium, recipientPublicKey);
  if (
    conversationKey.byteLength !==
    sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES
  ) {
    throw new Error("Invalid conversation key");
  }
  try {
    if (publicKey.byteLength !== sodium.crypto_box_PUBLICKEYBYTES) {
      throw new Error("Invalid recipient public key");
    }
    return encodeBase64(
      sodium,
      sodium.crypto_box_seal(conversationKey, publicKey),
    );
  } catch {
    throw new Error("Unable to wrap conversation key");
  }
}

export async function unwrapConversationKey(
  encryptedKey: Base64String,
  deviceKeys: DeviceKeyPair,
): Promise<ConversationKey> {
  const sodium = await getSodium();
  const envelope = decodeBase64(sodium, encryptedKey);
  const publicKey = decodeBase64(sodium, deviceKeys.publicKey);
  try {
    const conversationKey = sodium.crypto_box_seal_open(
      envelope,
      publicKey,
      deviceKeys.privateKey,
    );
    if (
      conversationKey.byteLength !==
      sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES
    ) {
      throw new Error("Invalid conversation key envelope");
    }
    return conversationKey as ConversationKey;
  } catch {
    throw new Error("Unable to open conversation key envelope");
  }
}

export async function destroyConversationKey(
  conversationKey: ConversationKey,
): Promise<void> {
  const sodium = await getSodium();
  sodium.memzero(conversationKey);
}