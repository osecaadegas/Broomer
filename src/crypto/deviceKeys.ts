import { decodeBase64, encodeBase64, getSodium } from "@/crypto/sodium";
import type { Base64String, DeviceKeyPair } from "@/crypto/types";

export async function generateDeviceKeys(): Promise<DeviceKeyPair> {
  const sodium = await getSodium();
  const keyPair = sodium.crypto_box_keypair();
  return {
    publicKey: encodeBase64(sodium, keyPair.publicKey),
    privateKey: keyPair.privateKey,
  };
}

export async function validateDevicePublicKey(
  publicKey: Base64String,
): Promise<void> {
  const sodium = await getSodium();
  const bytes = decodeBase64(sodium, publicKey);
  if (bytes.byteLength !== sodium.crypto_box_PUBLICKEYBYTES) {
    throw new Error("Invalid device public key");
  }
  const scalar = sodium.randombytes_buf(sodium.crypto_scalarmult_SCALARBYTES);
  try {
    sodium.crypto_scalarmult(scalar, bytes);
  } catch {
    throw new Error("Invalid device public key");
  } finally {
    sodium.memzero(scalar);
  }
}

export async function destroyDeviceKeys(keys: DeviceKeyPair): Promise<void> {
  const sodium = await getSodium();
  sodium.memzero(keys.privateKey);
}