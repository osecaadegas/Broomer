-- This migration intentionally targets only obsolete Broomer objects.
-- Review the connected project before applying: the audited project is shared.

drop function if exists public.mark_message_read(uuid);
drop function if exists public.revoke_device(uuid);
drop function if exists public.create_conversation_key_version(uuid);
drop function if exists public.create_direct_conversation(uuid);
drop function if exists private.can_create_envelope(uuid, uuid);
drop function if exists private.shares_conversation(uuid);
drop function if exists private.is_conversation_member(uuid);
drop function if exists private.enforce_direct_conversation_member_limit();

drop table if exists public.messages cascade;
drop table if exists public.conversation_key_envelopes cascade;
drop table if exists public.conversation_key_versions cascade;
drop table if exists public.user_devices cascade;
drop table if exists public.conversation_members cascade;
drop table if exists public.conversations cascade;
drop table if exists public.profiles cascade;
drop table if exists public.chat_messages cascade;
drop table if exists public.chat_conversations cascade;
drop table if exists public.responses cascade;
drop table if exists public.questions cascade;

notify pgrst, 'reload schema';