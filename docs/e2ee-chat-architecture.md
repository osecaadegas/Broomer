# E2EE Chat Architecture

## Scope

This design adds an authenticated, private, one-to-one chat alongside the legacy
anonymous chat. Both participants authenticate with Supabase Auth using
email/password. The legacy plaintext tables remain isolated during development
and must be destroyed after the encrypted path passes the security audit.

The application remains Next.js 16 with React and TypeScript. Migrating the
existing application to Vite would not improve the cryptographic boundary and
would unnecessarily replace working routing and Supabase SSR authentication.

## Security invariants

- Message plaintext never leaves a participant's browser.
- Conversation keys and device private keys never leave a participant's browser.
- Supabase stores only public device keys, encrypted key envelopes, ciphertext,
  nonces, timestamps, membership, and minimal delivery metadata.
- Server Components, route handlers, logs, analytics, and error reports never
  receive decrypted content or private key material.
- Raw private key bytes are never stored in localStorage or sessionStorage.
- RLS is the authorization boundary for Postgres Changes subscriptions.
- Expired messages are hidden by clients immediately and rejected by RLS even
  before the cleanup job physically deletes them.

## Cryptographic suite (MVP version 1)

The implementation will use `libsodium-wrappers-sumo`. Application code must
only call the abstractions under `src/crypto/`; UI and persistence code must not
call libsodium directly.

- Device key agreement: libsodium Curve25519 `crypto_box_keypair()`.
- Conversation key: 32 random bytes from `randombytes_buf()`.
- Key envelopes: `crypto_box_seal()` for each active authorized device.
- Envelope opening: `crypto_box_seal_open()` on the destination device.
- Message encryption: XChaCha20-Poly1305 IETF
  (`crypto_aead_xchacha20poly1305_ietf_encrypt`).
- Nonce: 24 random bytes per message; nonce reuse with a conversation key is
  forbidden.
- Encoding: libsodium ORIGINAL base64 for public keys, envelopes, ciphertext,
  and nonces.
- Associated data: canonical encoding of protocol version, conversation UUID,
  sender UUID, and message UUID. This binds ciphertext to its routing metadata.

XChaCha20-Poly1305 already authenticates ciphertext and associated data. A
separate HMAC must not be added. If cryptographic sender attribution beyond
membership is later required, add a separate audited Ed25519 signing-key
identity and version the protocol.

## Forward-secrecy limitation

This MVP uses a stable symmetric key per conversation version. It does **not**
provide the forward secrecy or post-compromise security of the Signal Double
Ratchet protocol. Compromise of a conversation key exposes messages encrypted
with that key version. The `src/crypto` and `src/chat` interfaces must keep key
wrapping and message encryption replaceable so a reviewed Signal-style protocol
can be introduced without rewriting the UI.

## Device keys

Each browser installation creates a device keypair. The public key is stored in
`user_devices`; the private key is handled by `src/crypto/keyStorage.ts`.

The initial key-storage adapter uses IndexedDB. IndexedDB is not protection
against script execution in the same origin, so strict CSP and XSS prevention
remain critical. The adapter must permit a later upgrade to an OS-backed or
passphrase-wrapped key store. Losing the only authorized device without an
encrypted recovery mechanism makes existing conversations unrecoverable; the
MVP will state this explicitly rather than introduce server key escrow.

Revoking a device prevents it from receiving or querying new envelopes. It
cannot make an envelope or key already obtained by that device unknowable.
Conversation keys must be rotated after device revocation for future secrecy.
Calling `revoke_device()` is therefore only the authorization step: every client
must treat affected conversations as blocked for sending until an active device
has generated a fresh conversation-key version, distributed new envelopes only
to active devices, and discarded the old key from active memory. This cannot
retroactively protect ciphertext or envelopes already cached by the revoked
device.

## Conversation establishment

1. Authenticated User A creates a direct conversation with authenticated User B
   through a database RPC; clients cannot directly add conversation members.
2. The RPC creates the conversation and exactly two membership rows.
3. User A generates the conversation key in the browser.
4. User A fetches active public device keys for both members.
5. User A seals one key envelope per active device and inserts the envelopes.
6. Each device retrieves only its own envelope and opens it locally.

Adding another user is not supported. Adding a new device requires an existing
authorized device to create an envelope for it. The server cannot create an
envelope because it never has the conversation key.

## Message lifecycle

1. The sender creates the message UUID locally.
2. The sender encrypts plaintext locally with the current conversation key,
   fresh nonce, and canonical associated data.
3. The sender inserts ciphertext and metadata into Supabase.
4. The recipient receives ciphertext through a conversation-filtered Postgres
   Changes subscription and decrypts locally.
5. After successful decryption and display, the recipient calls
   `mark_message_read(message_id)`.
6. The RPC atomically sets `read_at` once and computes `expires_at` as database
   time plus ten minutes.
7. Clients hide expired rows based on `expires_at`; pg_cron deletes them every
   minute.

The server never accepts a client-supplied read or expiry timestamp.

## Metadata and third parties

Supabase can observe participant IDs, conversation membership, message sender,
timestamps, ciphertext size, read state, and expiry. E2EE does not hide this
traffic metadata.

Remote GIPHY URLs reveal content choices to GIPHY and do not constitute
encrypted attachments. The authenticated E2EE chat will not send remote GIF
URLs as private attachments. Future attachment support must fetch or read the
file in-browser, encrypt bytes locally, and upload only ciphertext to a private
Storage bucket.

## Logging and telemetry

`redactSensitiveData()` will be the only supported path for chat-related
diagnostic logging. It must remove plaintext, decrypted attachments, private
keys, conversation keys, key envelopes, ciphertext, and nonces. Chat pages must
not use session replay or DOM-capturing analytics.

## Module boundaries

```text
src/crypto/
  types.ts
  deviceKeys.ts
  conversationKeys.ts
  messageCrypto.ts
  keyStorage.ts
src/chat/
  api.ts
  realtime.ts
  types.ts
src/components/chat/
src/hooks/
src/lib/supabase.ts
```

- `src/crypto`: bytes, keys, encryption, wrapping, and IndexedDB only.
- `src/chat`: ciphertext persistence and Realtime transport only.
- `src/components/chat`: plaintext UI state only; no direct Supabase calls.
- `src/hooks`: lifecycle composition and local countdowns.
- Server code: authentication and authorization only; never imports `src/crypto`.

## Cutover

The new schema uses `conversations`, `conversation_members`, `user_devices`,
`conversation_key_envelopes`, and `messages`, avoiding collisions with legacy
`chat_conversations` and `chat_messages`. After all adversarial tests pass:

1. Disable the legacy API routes and UI entry.
2. Delete legacy plaintext messages and conversations explicitly.
3. Remove legacy grants, policies, cron job, and code.
4. Verify backups and retention expectations before claiming historical
   plaintext has been destroyed.