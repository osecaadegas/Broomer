-- Run once in the Broomer project's Supabase SQL Editor.
-- Visitor access stays behind the server API; only admins receive table grants.
create table if not exists public.chat_conversations (
  id bigint generated always as identity primary key,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  conversation_id bigint not null references public.chat_conversations (id) on delete cascade,
  sender text not null check (sender in ('visitor', 'admin')),
  body text,
  gif_data text,
  gif_url text,
  disappearing boolean not null default false,
  seen_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.chat_messages add column if not exists gif_data text;
alter table public.chat_messages add column if not exists gif_url text;
alter table public.chat_messages add column if not exists disappearing boolean not null default false;
alter table public.chat_messages add column if not exists seen_at timestamptz;
alter table public.chat_messages add column if not exists expires_at timestamptz;
alter table public.chat_messages alter column body drop not null;
alter table public.chat_messages drop constraint if exists chat_messages_body_check;
alter table public.chat_messages drop constraint if exists chat_messages_content_check;
alter table public.chat_messages add constraint chat_messages_content_check check (
  (body is not null and char_length(body) between 1 and 2000)
  or (
    gif_data is not null
    and char_length(gif_data) <= 1400000
    and gif_data ~ '^data:image/gif;base64,[A-Za-z0-9+/=]+$'
  )
  or (
    gif_url is not null
    and gif_url ~ '^https://media[0-9]*\.giphy\.com/'
  )
);
alter table public.chat_messages drop constraint if exists chat_messages_expiry_check;
alter table public.chat_messages add constraint chat_messages_expiry_check check (
  (not disappearing and seen_at is null and expires_at is null)
  or disappearing
);

create index if not exists chat_conversations_last_message_idx
  on public.chat_conversations (last_message_at desc, id desc);
create index if not exists chat_messages_conversation_created_idx
  on public.chat_messages (conversation_id, created_at, id);
create index if not exists chat_messages_expiry_idx
  on public.chat_messages (expires_at)
  where expires_at is not null;

alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;

revoke all on public.chat_conversations from anon;
revoke all on public.chat_messages from anon;
grant select, insert on public.chat_conversations to anon;
grant update (last_message_at) on public.chat_conversations to anon;
grant select, insert on public.chat_messages to anon;
grant update (seen_at, expires_at) on public.chat_messages to anon;
grant usage, select on sequence public.chat_conversations_id_seq to anon;
grant usage, select on sequence public.chat_messages_id_seq to anon;
grant select, update, delete on public.chat_conversations to authenticated;
grant select, insert, delete on public.chat_messages to authenticated;
grant update (seen_at, expires_at) on public.chat_messages to authenticated;
grant usage, select on sequence public.chat_conversations_id_seq to authenticated;
grant usage, select on sequence public.chat_messages_id_seq to authenticated;
grant select, insert, update, delete on public.chat_conversations to service_role;
grant select, insert, update, delete on public.chat_messages to service_role;
grant usage, select on sequence public.chat_conversations_id_seq to service_role;
grant usage, select on sequence public.chat_messages_id_seq to service_role;

drop policy if exists "Visitors can create their conversation" on public.chat_conversations;
create policy "Visitors can create their conversation"
  on public.chat_conversations for insert to anon
  with check (
    token_hash = (
      select current_setting('request.headers', true)::jsonb
        ->> 'x-chat-token-hash'
    )
  );

drop policy if exists "Visitors can read their conversation" on public.chat_conversations;
create policy "Visitors can read their conversation"
  on public.chat_conversations for select to anon
  using (
    token_hash = (
      select current_setting('request.headers', true)::jsonb
        ->> 'x-chat-token-hash'
    )
  );

drop policy if exists "Visitors can update their conversation" on public.chat_conversations;
create policy "Visitors can update their conversation"
  on public.chat_conversations for update to anon
  using (
    token_hash = (
      select current_setting('request.headers', true)::jsonb
        ->> 'x-chat-token-hash'
    )
  )
  with check (
    token_hash = (
      select current_setting('request.headers', true)::jsonb
        ->> 'x-chat-token-hash'
    )
  );

drop policy if exists "Visitors can read their messages" on public.chat_messages;
create policy "Visitors can read their messages"
  on public.chat_messages for select to anon
  using (
    exists (
      select 1
      from public.chat_conversations
      where chat_conversations.id = chat_messages.conversation_id
        and chat_conversations.token_hash = (
          select current_setting('request.headers', true)::jsonb
            ->> 'x-chat-token-hash'
        )
    )
  );

drop policy if exists "Visitors can send their messages" on public.chat_messages;
create policy "Visitors can send their messages"
  on public.chat_messages for insert to anon
  with check (
    sender = 'visitor'
    and exists (
      select 1
      from public.chat_conversations
      where chat_conversations.id = chat_messages.conversation_id
        and chat_conversations.token_hash = (
          select current_setting('request.headers', true)::jsonb
            ->> 'x-chat-token-hash'
        )
    )
  );

drop policy if exists "Visitors can mark admin messages seen" on public.chat_messages;
create policy "Visitors can mark admin messages seen"
  on public.chat_messages for update to anon
  using (
    sender = 'admin'
    and disappearing
    and seen_at is null
    and exists (
      select 1
      from public.chat_conversations
      where chat_conversations.id = chat_messages.conversation_id
        and chat_conversations.token_hash = (
          select current_setting('request.headers', true)::jsonb
            ->> 'x-chat-token-hash'
        )
    )
  )
  with check (
    sender = 'admin'
    and disappearing
    and seen_at is not null
    and expires_at between seen_at + interval '10 minutes' - interval '5 seconds'
      and seen_at + interval '10 minutes' + interval '5 seconds'
  );

drop policy if exists "Admins can read chat conversations" on public.chat_conversations;
create policy "Admins can read chat conversations"
  on public.chat_conversations for select to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can update chat conversations" on public.chat_conversations;
create policy "Admins can update chat conversations"
  on public.chat_conversations for update to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can delete chat conversations" on public.chat_conversations;
create policy "Admins can delete chat conversations"
  on public.chat_conversations for delete to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can read chat messages" on public.chat_messages;
create policy "Admins can read chat messages"
  on public.chat_messages for select to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can send chat messages" on public.chat_messages;
create policy "Admins can send chat messages"
  on public.chat_messages for insert to authenticated
  with check (
    sender = 'admin'
    and ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists "Admins can mark visitor messages seen" on public.chat_messages;
create policy "Admins can mark visitor messages seen"
  on public.chat_messages for update to authenticated
  using (
    sender = 'visitor'
    and disappearing
    and seen_at is null
    and ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
  )
  with check (
    sender = 'visitor'
    and disappearing
    and seen_at is not null
    and expires_at between seen_at + interval '10 minutes' - interval '5 seconds'
      and seen_at + interval '10 minutes' + interval '5 seconds'
    and ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists "Admins can delete chat messages" on public.chat_messages;
create policy "Admins can delete chat messages"
  on public.chat_messages for delete to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create extension if not exists pg_cron with schema pg_catalog;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'delete-expired-broomer-chat-messages';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end
$$;

select cron.schedule(
  'delete-expired-broomer-chat-messages',
  '* * * * *',
  $$delete from public.chat_messages where expires_at <= now()$$
);

notify pgrst, 'reload schema';