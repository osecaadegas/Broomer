import { describe, expect, it } from "vitest";
import {
  destroyDeviceKeys,
  generateDeviceKeys,
  validateDevicePublicKey,
} from "@/crypto/deviceKeys";
import { decodeBase64, getSodium } from "@/crypto/sodium";

describe("device keys", () => {
  it("generates distinct valid Curve25519 keypairs", async () => {
    const sodium = await getSodium();
    const first = await generateDeviceKeys();
    const second = await generateDeviceKeys();

    await expect(validateDevicePublicKey(first.publicKey)).resolves.toBeUndefined();
    expect(first.publicKey).not.toBe(second.publicKey);
    expect(first.privateKey).not.toEqual(second.privateKey);
    expect(first.privateKey.byteLength).toBe(sodium.crypto_box_SECRETKEYBYTES);
    expect(decodeBase64(sodium, first.publicKey).byteLength).toBe(
      sodium.crypto_box_PUBLICKEYBYTES,
    );
  });

  it("wipes private-key bytes in place", async () => {
    const keys = await generateDeviceKeys();
    expect(keys.privateKey.some((byte) => byte !== 0)).toBe(true);

    await destroyDeviceKeys(keys);

    expect(keys.privateKey.every((byte) => byte === 0)).toBe(true);
  });

  it("rejects an invalid Curve25519 public point", async () => {
    const sodium = await getSodium();
    const invalidPoint = sodium.to_base64(
      new Uint8Array(sodium.crypto_box_PUBLICKEYBYTES),
      sodium.base64_variants.ORIGINAL,
    );

    await expect(
      validateDevicePublicKey(invalidPoint as never),
    ).rejects.toThrow("Invalid device public key");
  });
});