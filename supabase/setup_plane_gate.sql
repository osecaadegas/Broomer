create table if not exists public.app_settings (
  id boolean primary key default true check (id),
  plane_password varchar(3) not null default '123'
    check (plane_password ~ '^[0-9]{3}$'),
  quote_of_day text not null default 'The sky is not the limit. Your mind is.',
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id)
values (true)
on conflict (id) do nothing;

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

notify pgrst, 'reload schema';