import { describe, expect, it } from "vitest";
import { redactSensitiveData } from "@/lib/redactSensitiveData";

describe("redactSensitiveData", () => {
  it("removes nested chat plaintext and cryptographic material", () => {
    expect(
      redactSensitiveData({
        event: "send_failed",
        message: "private words",
        nested: {
          privateKey: new Uint8Array([1, 2, 3]),
          ciphertext: "opaque-but-sensitive",
          safeCode: "DECRYPT_FAILED",
        },
      }),
    ).toEqual({
      event: "send_failed",
      message: "[REDACTED]",
      nested: {
        privateKey: "[REDACTED]",
        ciphertext: "[REDACTED]",
        safeCode: "DECRYPT_FAILED",
      },
    });
  });

  it("does not serialize error messages", () => {
    expect(redactSensitiveData(new Error("decryption included private text"))).toEqual({
      name: "Error",
      message: "[REDACTED]",
    });
  });

  it("redacts decrypted prefixes, cycles, and avoids invoking getters", () => {
    let getterCalled = false;
    const value: Record<string, unknown> = {
      decryptedPreview: "private",
    };
    value.self = value;
    Object.defineProperty(value, "dangerous", {
      enumerable: true,
      get() {
        getterCalled = true;
        return "private";
      },
    });

    expect(redactSensitiveData(value)).toEqual({
      decryptedPreview: "[REDACTED]",
      self: "[REDACTED:CIRCULAR]",
    });
    expect(getterCalled).toBe(false);
  });
});