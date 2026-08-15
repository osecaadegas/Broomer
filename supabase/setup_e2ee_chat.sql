-- Authenticated one-to-one E2EE chat. Run in the Broomer Supabase SQL Editor.
-- This schema intentionally coexists with legacy chat_* tables until cutover.
-- Never add plaintext message or private-key columns to these tables.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create or replace function private.enforce_direct_conversation_member_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.conversation_id::text, 0));

  if (
    select count(*)
    from public.conversation_members as member
    where member.conversation_id = new.conversation_id
  ) >= 2 then
    raise exception 'Direct conversations cannot have more than two members'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_direct_conversation_member_limit
  on public.conversation_members;
create trigger enforce_direct_conversation_member_limit
before insert on public.conversation_members
for each row execute function private.enforce_direct_conversation_member_limit();

create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  device_name text not null check (char_length(device_name) between 1 and 120),
  public_key text not null unique check (
    char_length(public_key) between 40 and 128
    and public_key ~ '^[A-Za-z0-9+/=]+$'
  ),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (revoked_at is null or revoked_at >= created_at)
);

create table if not exists public.conversation_key_versions (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  version smallint not null check (version > 0),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (conversation_id, version)
);

create table if not exists public.conversation_key_envelopes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  device_id uuid not null references public.user_devices (id) on delete cascade,
  encrypted_key text not null check (
    char_length(encrypted_key) between 1 and 4096
    and encrypted_key ~ '^[A-Za-z0-9+/=]+$'
  ),
  encryption_version smallint not null default 1 check (encryption_version > 0),
  created_at timestamptz not null default now(),
  foreign key (conversation_id, encryption_version)
    references public.conversation_key_versions (conversation_id, version)
    on delete cascade,
  unique (conversation_id, device_id, encryption_version)
);

create table if not exists public.messages (
  id uuid primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete restrict,
  ciphertext text not null check (
    char_length(ciphertext) between 1 and 262144
    and ciphertext ~ '^[A-Za-z0-9+/=]+$'
  ),
  nonce text not null check (
    char_length(nonce) between 32 and 64
    and nonce ~ '^[A-Za-z0-9+/=]+$'
  ),
  encryption_version smallint not null default 1 check (encryption_version > 0),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  expires_at timestamptz,
  foreign key (conversation_id, encryption_version)
    references public.conversation_key_versions (conversation_id, version)
    on delete restrict,
  check (
    (read_at is null and expires_at is null)
    or (
      read_at is not null
      and expires_at = read_at + interval '10 minutes'
    )
  )
);

create index if not exists conversations_created_by_idx
  on public.conversations (created_by, created_at desc);
create index if not exists conversation_members_user_conversation_idx
  on public.conversation_members (user_id, conversation_id);
create index if not exists user_devices_user_active_idx
  on public.user_devices (user_id, created_at desc)
  where revoked_at is null;
create index if not exists conversation_key_envelopes_device_idx
  on public.conversation_key_envelopes (device_id, conversation_id);
create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at, id);
create index if not exists messages_expiry_idx
  on public.messages (expires_at)
  where expires_at is not null;

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.user_devices enable row level security;
alter table public.conversation_key_versions enable row level security;
alter table public.conversation_key_envelopes enable row level security;
alter table public.messages enable row level security;

create or replace function private.is_conversation_member(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.conversation_members as member
      where member.conversation_id = target_conversation_id
        and member.user_id = (select auth.uid())
    );
$$;

create or replace function private.shares_conversation(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.conversation_members as caller_membership
      join public.conversation_members as target_membership
        on target_membership.conversation_id = caller_membership.conversation_id
      where caller_membership.user_id = (select auth.uid())
        and target_membership.user_id = target_user_id
    );
$$;

create or replace function private.can_create_envelope(
  target_conversation_id uuid,
  target_device_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.conversation_members as caller_membership
      join public.user_devices as device
        on device.id = target_device_id
       and device.revoked_at is null
      join public.conversation_members as device_membership
        on device_membership.conversation_id = caller_membership.conversation_id
       and device_membership.user_id = device.user_id
      where caller_membership.conversation_id = target_conversation_id
        and caller_membership.user_id = (select auth.uid())
    );
$$;

revoke all on function private.is_conversation_member(uuid) from public;
revoke all on function private.shares_conversation(uuid) from public;
revoke all on function private.can_create_envelope(uuid, uuid) from public;
grant execute on function private.is_conversation_member(uuid) to authenticated;
grant execute on function private.shares_conversation(uuid) to authenticated;
grant execute on function private.can_create_envelope(uuid, uuid) to authenticated;

create or replace function public.create_direct_conversation(peer_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid := (select auth.uid());
  new_conversation_id uuid;
begin
  if caller_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if peer_user_id is null or peer_user_id = caller_user_id then
    raise exception 'Invalid peer' using errcode = '22023';
  end if;

  if not exists (select 1 from auth.users where id = peer_user_id) then
    raise exception 'Invalid peer' using errcode = '22023';
  end if;

  insert into public.conversations (created_by)
  values (caller_user_id)
  returning id into new_conversation_id;

  insert into public.conversation_members (conversation_id, user_id)
  values
    (new_conversation_id, caller_user_id),
    (new_conversation_id, peer_user_id);

  insert into public.conversation_key_versions (
    conversation_id,
    version,
    created_by
  ) values (
    new_conversation_id,
    1,
    caller_user_id
  );

  return new_conversation_id;
end;
$$;

create or replace function public.create_conversation_key_version(
  target_conversation_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid := (select auth.uid());
  next_version integer;
begin
  if caller_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.conversation_members as membership
    where membership.conversation_id = target_conversation_id
      and membership.user_id = caller_user_id
  ) then
    raise exception 'Conversation membership required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_conversation_id::text, 1));

  select coalesce(max(key_version.version), 0) + 1
  into next_version
  from public.conversation_key_versions as key_version
  where key_version.conversation_id = target_conversation_id;

  insert into public.conversation_key_versions (
    conversation_id,
    version,
    created_by
  ) values (
    target_conversation_id,
    next_version,
    caller_user_id
  );

  return next_version;
end;
$$;

create or replace function public.revoke_device(target_device_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid := (select auth.uid());
  revoked_timestamp timestamptz := statement_timestamp();
  affected_rows integer;
begin
  if caller_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.user_devices
  set revoked_at = revoked_timestamp
  where id = target_device_id
    and user_id = caller_user_id
    and revoked_at is null;

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Invalid or already revoked device' using errcode = '22023';
  end if;

  return revoked_timestamp;
end;
$$;

create or replace function public.mark_message_read(message_id uuid)
returns table (read_at timestamptz, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid := (select auth.uid());
  read_timestamp timestamptz := statement_timestamp();
begin
  if caller_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform 1
  from public.messages as message
  where message.id = message_id
    and message.sender_id <> caller_user_id
    and (message.expires_at is null or message.expires_at > statement_timestamp())
    and exists (
      select 1
      from public.conversation_members as membership
      where membership.conversation_id = message.conversation_id
        and membership.user_id = caller_user_id
    )
  for update;

  if not found then
    raise exception 'Message is unavailable or cannot be marked read'
      using errcode = '42501';
  end if;

  update public.messages as message
  set
    read_at = read_timestamp,
    expires_at = read_timestamp + interval '10 minutes'
  where message.id = message_id
    and message.read_at is null;

  return query
  select message.read_at, message.expires_at
  from public.messages as message
  where message.id = message_id;
end;
$$;

revoke all on function public.create_direct_conversation(uuid) from public;
revoke all on function public.create_conversation_key_version(uuid) from public;
revoke all on function public.revoke_device(uuid) from public;
revoke all on function public.mark_message_read(uuid) from public;
revoke all on function private.enforce_direct_conversation_member_limit() from public;
grant execute on function public.create_direct_conversation(uuid) to authenticated;
grant execute on function public.create_conversation_key_version(uuid) to authenticated;
grant execute on function public.revoke_device(uuid) to authenticated;
grant execute on function public.mark_message_read(uuid) to authenticated;

drop policy if exists "Users can read their profile or peers" on public.profiles;
create policy "Users can read their profile or peers"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select private.shares_conversation(id))
  );

drop policy if exists "Users can create their profile" on public.profiles;
create policy "Users can create their profile"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "Members can read conversations" on public.conversations;
create policy "Members can read conversations"
  on public.conversations for select to authenticated
  using ((select private.is_conversation_member(id)));

drop policy if exists "Users can create conversations" on public.conversations;
create policy "Users can create conversations"
  on public.conversations for insert to authenticated
  with check (created_by = (select auth.uid()));

drop policy if exists "Members can read memberships" on public.conversation_members;
create policy "Members can read memberships"
  on public.conversation_members for select to authenticated
  using ((select private.is_conversation_member(conversation_id)));

drop policy if exists "Users can read authorized device keys" on public.user_devices;
create policy "Users can read authorized device keys"
  on public.user_devices for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      revoked_at is null
      and (select private.shares_conversation(user_id))
    )
  );

drop policy if exists "Users can register their devices" on public.user_devices;
create policy "Users can register their devices"
  on public.user_devices for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and revoked_at is null
  );

drop policy if exists "Members can read key versions" on public.conversation_key_versions;
create policy "Members can read key versions"
  on public.conversation_key_versions for select to authenticated
  using ((select private.is_conversation_member(conversation_id)));

drop policy if exists "Devices can read their envelopes" on public.conversation_key_envelopes;
create policy "Devices can read their envelopes"
  on public.conversation_key_envelopes for select to authenticated
  using (
    (select private.is_conversation_member(conversation_id))
    and exists (
      select 1
      from public.user_devices as device
      where device.id = conversation_key_envelopes.device_id
        and device.user_id = (select auth.uid())
        and device.revoked_at is null
    )
  );

drop policy if exists "Members can create device envelopes" on public.conversation_key_envelopes;
create policy "Members can create device envelopes"
  on public.conversation_key_envelopes for insert to authenticated
  with check (
    (select private.can_create_envelope(conversation_id, device_id))
  );

drop policy if exists "Members can read unexpired ciphertext" on public.messages;
create policy "Members can read unexpired ciphertext"
  on public.messages for select to authenticated
  using (
    (select private.is_conversation_member(conversation_id))
    and (expires_at is null or expires_at > statement_timestamp())
  );

drop policy if exists "Members can send ciphertext" on public.messages;
create policy "Members can send ciphertext"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (select private.is_conversation_member(conversation_id))
    and read_at is null
    and expires_at is null
  );

revoke all on public.profiles from anon, authenticated;
revoke all on public.conversations from anon, authenticated;
revoke all on public.conversation_members from anon, authenticated;
revoke all on public.user_devices from anon, authenticated;
revoke all on public.conversation_key_versions from anon, authenticated;
revoke all on public.conversation_key_envelopes from anon, authenticated;
revoke all on public.messages from anon, authenticated;

grant select, insert, update (display_name, updated_at) on public.profiles to authenticated;
grant select, insert on public.conversations to authenticated;
grant select on public.conversation_members to authenticated;
grant select, insert on public.user_devices to authenticated;
grant select on public.conversation_key_versions to authenticated;
grant select, insert on public.conversation_key_envelopes to authenticated;
grant select, insert on public.messages to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end
$$;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'delete-expired-e2ee-messages';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end
$$;

select cron.schedule(
  'delete-expired-e2ee-messages',
  '* * * * *',
  $$delete from public.messages where expires_at is not null and expires_at <= now()$$
);

notify pgrst, 'reload schema';