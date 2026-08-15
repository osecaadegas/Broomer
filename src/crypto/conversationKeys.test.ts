import { describe, expect, it } from "vitest";
import { generateDeviceKeys } from "@/crypto/deviceKeys";
import {
  generateConversationKey,
  destroyConversationKey,
  unwrapConversationKey,
  wrapConversationKey,
} from "@/crypto/conversationKeys";

describe("conversation keys", () => {
  it("seals a conversation key for its intended device", async () => {
    const device = await generateDeviceKeys();
    const conversationKey = await generateConversationKey();
    const envelope = await wrapConversationKey(
      conversationKey,
      device.publicKey,
    );

    await expect(unwrapConversationKey(envelope, device)).resolves.toEqual(
      conversationKey,
    );
  });

  it("rejects an envelope opened by another device", async () => {
    const intendedDevice = await generateDeviceKeys();
    const otherDevice = await generateDeviceKeys();
    const conversationKey = await generateConversationKey();
    const envelope = await wrapConversationKey(
      conversationKey,
      intendedDevice.publicKey,
    );

    await expect(
      unwrapConversationKey(envelope, otherDevice),
    ).rejects.toThrow("Unable to open conversation key envelope");
  });

  it("wipes a conversation key in place", async () => {
    const key = await generateConversationKey();
    await destroyConversationKey(key);
    expect(key.every((byte) => byte === 0)).toBe(true);
  });
});