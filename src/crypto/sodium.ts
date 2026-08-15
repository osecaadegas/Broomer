import sodium from "libsodium-wrappers-sumo";
import type { Base64String } from "@/crypto/types";

const MAX_BASE64_INPUT_LENGTH = 350_000;
let readySodium: Promise<typeof sodium> | null = null;

export async function getSodium() {
  readySodium ??= sodium.ready
    .then(() => sodium)
    .catch(() => {
      readySodium = null;
      throw new Error("Cryptography initialization failed");
    });
  return readySodium;
}

export function encodeBase64(
  sodiumInstance: typeof sodium,
  bytes: Uint8Array,
): Base64String {
  return sodiumInstance.to_base64(
    bytes,
    sodiumInstance.base64_variants.ORIGINAL,
  ) as Base64String;
}

export function decodeBase64(
  sodiumInstance: typeof sodium,
  value: Base64String,
): Uint8Array {
  if (
    value.length === 0 ||
    value.length > MAX_BASE64_INPUT_LENGTH ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  ) {
    throw new Error("Invalid base64 data");
  }
  try {
    const decoded = sodiumInstance.from_base64(
      value,
      sodiumInstance.base64_variants.ORIGINAL,
    );
    if (decoded.byteLength === 0) throw new Error("Empty base64 data");
    return decoded;
  } catch {
    throw new Error("Invalid base64 data");
  }
}