create table if not exists public.app_settings (
  id boolean primary key default true check (id),
  plane_password varchar(3) not null default '123'
    check (plane_password ~ '^[0-9]{3}$'),
  uno_password varchar(3) not null default '456'
    check (uno_password ~ '^[0-9]{3}$'),
  quote_of_day text not null default 'The sky is not the limit. Your mind is.',
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id)
values (true)
on conflict (id) do nothing;

alter table public.app_settings
  add column if not exists uno_password varchar(3) not null default '456';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'app_settings_uno_password_check'
      and conrelid = 'public.app_settings'::regclass
  ) then
    alter table public.app_settings
      add constraint app_settings_uno_password_check
      check (uno_password ~ '^[0-9]{3}$');
  end if;
end
$$;

alter table public.app_settings enable row level security;

grant select, update on public.app_settings to authenticated;

drop policy if exists "Admins can read app settings" on public.app_settings;
create policy "Admins can read app settings"
  on public.app_settings for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can update app settings" on public.app_settings;
create policy "Admins can update app settings"
  on public.app_settings for update to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create or replace function public.verify_plane_gate(candidate text)
returns table (quote text)
language sql
security definer
set search_path = ''
as $$
  select settings.quote_of_day
  from public.app_settings as settings
  where settings.id = true
    and candidate ~ '^[0-9]{3}$'
    and settings.plane_password = candidate;
$$;

revoke execute on function public.verify_plane_gate(text) from public;
grant execute on function public.verify_plane_gate(text) to anon, authenticated;

create or replace function public.verify_uno_gate(candidate text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_settings as settings
    where settings.id = true
      and candidate ~ '^[0-9]{3}$'
      and settings.uno_password = candidate
  );
$$;

revoke execute on function public.verify_uno_gate(text) from public;
grant execute on function public.verify_uno_gate(text) to anon, authenticated;

create or replace function public.replace_uno_questions(candidate text, draft jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.verify_uno_gate(candidate) then
    return false;
  end if;

  if draft is null
    or jsonb_typeof(draft) <> 'array'
    or jsonb_array_length(draft) < 1
    or jsonb_array_length(draft) > 30 then
    raise exception 'Provide between 1 and 30 questions';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(draft) as item
    where jsonb_typeof(item) <> 'object'
      or length(btrim(coalesce(item ->> 'prompt', ''))) not between 1 and 500
      or coalesce(item ->> 'type', '') not in
        ('short', 'long', 'single', 'multiple', 'rating', 'number', 'datetime')
      or coalesce(jsonb_typeof(item -> 'options'), '') <> 'array'
      or jsonb_array_length(item -> 'options') > 12
      or coalesce(item ->> 'required', '') not in ('true', 'false')
      or (
        item ->> 'type' in ('single', 'multiple')
        and jsonb_array_length(item -> 'options') < 2
      )
      or exists (
        select 1
        from jsonb_array_elements(item -> 'options') as option
        where jsonb_typeof(option) <> 'string'
          or length(btrim(option #>> '{}')) not between 1 and 120
      )
  ) then
    raise exception 'Invalid question data';
  end if;

  lock table public.questions in exclusive mode;
  delete from public.questions;

  insert into public.questions (prompt, type, options, required, position)
  select
    btrim(item ->> 'prompt'),
    item ->> 'type',
    item -> 'options',
    (item ->> 'required')::boolean,
    ordinal::integer
  from jsonb_array_elements(draft) with ordinality as question(item, ordinal);

  return true;
end;
$$;

revoke execute on function public.replace_uno_questions(text, jsonb) from public;
grant execute on function public.replace_uno_questions(text, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';