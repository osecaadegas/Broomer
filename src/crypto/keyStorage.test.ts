import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { generateDeviceKeys } from "@/crypto/deviceKeys";
import {
  createIndexedDbKeyStorage,
  withStoredDeviceKeys,
} from "@/crypto/keyStorage";

describe("IndexedDB key storage", () => {
  it("persists, clones, lists, and removes private device keys", async () => {
    const storage = createIndexedDbKeyStorage(`crypto-test-${crypto.randomUUID()}`);
    const keyPair = await generateDeviceKeys();
    const stored = {
      deviceId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...keyPair,
    };

    await storage.save(stored);
    keyPair.privateKey.fill(0);

    const loaded = await storage.load(stored.deviceId);
    expect(loaded).not.toBeNull();
    expect(loaded?.publicKey).toBe(stored.publicKey);
    expect(loaded?.privateKey.some((byte) => byte !== 0)).toBe(true);
    expect(await storage.list()).toHaveLength(1);

    await storage.remove(stored.deviceId);
    await expect(storage.load(stored.deviceId)).resolves.toBeNull();
  });

  it("wipes keys loaded for a scoped operation", async () => {
    const storage = createIndexedDbKeyStorage(`crypto-test-${crypto.randomUUID()}`);
    const stored = {
      deviceId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...(await generateDeviceKeys()),
    };
    await storage.save(stored);
    const usedPrivateKeys: Uint8Array[] = [];

    await withStoredDeviceKeys(storage, stored.deviceId, async (keys) => {
      usedPrivateKeys.push(keys.privateKey);
      expect(keys.privateKey.some((byte) => byte !== 0)).toBe(true);
    });

    expect(usedPrivateKeys).toHaveLength(1);
    expect(usedPrivateKeys[0].every((byte) => byte === 0)).toBe(true);
  });
});