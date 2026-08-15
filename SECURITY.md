# Security Policy

## Supported security boundary

Broomer is a two-account private workspace. Access is allowed only when a
verified Supabase Auth user has `app_metadata.broomer_authorized = true`.
Authorization is checked on the server. The public page exposes only a sign-in
link.

The current release deliberately provides no messaging, questionnaire, file
upload, camera, Realtime, or temporary-record feature. The former chat stored
plaintext and the unused E2EE prototype did not implement safe rotation,
recovery, replay rejection, or multi-tab coordination. Those paths were removed
rather than represented as secure.

## What this protects

- Private workspace HTML is withheld from unauthenticated requests.
- Application-controlled browser persistence contains no private content or
  application cryptographic keys.
- Application routes do not accept private content.
- Restrictive CSP, permissions, referrer, framing, MIME, transport, and cache
  headers reduce browser attack surface.
- Manual and inactivity locks clear rendered workspace state by signing out and
  replacing the document with the login route.

## What this does not protect

Broomer cannot reliably protect against malware, compromised browsers,
malicious extensions, keyloggers, screen recording, screenshots, physical
observation, administrator-controlled computers, employer-managed endpoints,
OS-level monitoring, or provider-level metadata. Network observers may see that
Vercel and Supabase were contacted. JavaScript cannot guarantee physical RAM
zeroization.

Deleting active application data does not prove physical erasure from database
WAL, backups, point-in-time recovery, provider logs, replicas, browser storage
internals, or infrastructure snapshots. Retention for those systems is governed
by the configured Vercel and Supabase plans.

## Deployment requirements

1. Use a dedicated Supabase project. The project connected during this audit is
   shared: it has unrelated schemas, 106 Auth users, and no authorized Broomer
   users.
2. Create exactly two Auth users and set
   `app_metadata.broomer_authorized = true` using a trusted server/dashboard
   operation. Do not use user-editable metadata.
3. Disable new-user signup, anonymous sign-in, phone auth, social providers, and
   unused email flows in Supabase Auth. Configure Auth rate limits and MFA as
   appropriate for both accounts.
4. Keep `NEXT_PUBLIC_SUPABASE_URL` and the publishable key public. Never expose
   secret/service-role keys, database passwords, JWT signing secrets, private
   certificates, or content-encryption keys as `NEXT_PUBLIC_*` variables.
5. Review and apply the scoped retirement migration only after confirming the
   target is the Broomer project. It is intentionally not applied by this audit.

## Reporting

Report security issues privately to the repository owner. Do not include
credentials, private content, or complete tokens in issue trackers or logs.