const SENSITIVE_KEYS = /^(body|message|messageBody|messageText|plaintext|private.*|secret.*|conversationKey|encryptedKey|keyEnvelope|sealedEnvelope|ciphertext|nonce|gifData|attachment|decrypted.*)$/i;

export function redactSensitiveData(value: unknown): unknown {
  return redactValue(value, new WeakSet<object>());
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: "[REDACTED]" };
  }
  if (value instanceof Uint8Array) return "[REDACTED]";
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[REDACTED:CIRCULAR]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((entry) => redactValue(entry, seen));

  return Object.fromEntries(
    Object.entries(Object.getOwnPropertyDescriptors(value))
      .filter(([, descriptor]) => "value" in descriptor)
      .map(([key, descriptor]) => [
        key,
        SENSITIVE_KEYS.test(key)
          ? "[REDACTED]"
          : redactValue(descriptor.value, seen),
      ]),
  );
}