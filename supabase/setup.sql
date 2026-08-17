create table if not exists public.questions (
  id serial primary key,
  prompt text not null,
  type varchar(24) not null default 'short',
  options jsonb not null default '[]'::jsonb,
  required boolean not null default false,
  position integer not null default 0,
  depends_on integer,
  condition_type varchar(10),
  condition_value varchar(255),
  follow_up_option varchar(255),
  follow_up_placeholder text,
  placeholder varchar(255),
  multiple_max integer,
  response_text text,
  response_trigger varchar(255),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.responses (
  id serial primary key,
  answers jsonb not null,
  created_at timestamptz not null default now()
);

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

create index if not exists questions_position_id_idx
  on public.questions (position, id);
create index if not exists responses_created_at_id_idx
  on public.responses (created_at desc, id desc);

alter table public.questions enable row level security;
alter table public.responses enable row level security;
alter table public.app_settings enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.questions to anon, authenticated;
grant insert, update, delete on public.questions to authenticated;
grant insert on public.responses to anon, authenticated;
grant select, delete on public.responses to authenticated;
grant select, update on public.app_settings to authenticated;
grant usage, select on sequence public.questions_id_seq to authenticated;
grant usage, select on sequence public.responses_id_seq to anon, authenticated;

drop policy if exists "Public can read questions" on public.questions;
create policy "Public can read questions"
  on public.questions for select to anon, authenticated using (true);

drop policy if exists "Admins can insert questions" on public.questions;
create policy "Admins can insert questions"
  on public.questions for insert to authenticated
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can update questions" on public.questions;
create policy "Admins can update questions"
  on public.questions for update to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can delete questions" on public.questions;
create policy "Admins can delete questions"
  on public.questions for delete to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Public can submit responses" on public.responses;
create policy "Public can submit responses"
  on public.responses for insert to anon, authenticated with check (true);

drop policy if exists "Admins can read responses" on public.responses;
create policy "Admins can read responses"
  on public.responses for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can delete responses" on public.responses;
create policy "Admins can delete responses"
  on public.responses for delete to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

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

create table if not exists public.uno_questions (
  id serial primary key,
  prompt text not null check (length(btrim(prompt)) between 1 and 500),
  type varchar(24) not null check (type in ('short', 'long', 'single', 'multiple', 'rating', 'number', 'datetime')),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  required boolean not null default false,
  position integer not null,
  answer jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists uno_questions_position_id_idx on public.uno_questions (position, id);
alter table public.uno_questions enable row level security;
grant select, update on public.uno_questions to authenticated;
grant usage, select on sequence public.uno_questions_id_seq to authenticated;

drop policy if exists "Admins can read UNO questions" on public.uno_questions;
create policy "Admins can read UNO questions" on public.uno_questions for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can update UNO answers" on public.uno_questions;
create policy "Admins can update UNO answers" on public.uno_questions for update to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

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

  lock table public.uno_questions in exclusive mode;
  delete from public.uno_questions;

  insert into public.uno_questions (prompt, type, options, required, position)
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

create or replace function public.get_plane_reveal(candidate text)
returns table (quote text, answers jsonb)
language sql
security definer
set search_path = ''
as $$
  select settings.quote_of_day,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', question.id, 'question', question.prompt, 'type', question.type,
        'options', question.options, 'answer', question.answer
      ) order by question.position, question.id)
      from public.uno_questions as question
      where question.answer is not null
        and question.answer <> 'null'::jsonb
        and not (jsonb_typeof(question.answer) = 'string' and btrim(question.answer #>> '{}') = '')
        and not (jsonb_typeof(question.answer) = 'array' and jsonb_array_length(question.answer) = 0)
    ), '[]'::jsonb)
  from public.app_settings as settings
  where settings.id = true
    and candidate ~ '^[0-9]{3}$'
    and settings.plane_password = candidate;
$$;

revoke execute on function public.get_plane_reveal(text) from public;
grant execute on function public.get_plane_reveal(text) to anon, authenticated;

notify pgrst, 'reload schema';

do $$
declare
  mood_id integer;
  coffee_date_id integer;
begin
  if not exists (select 1 from public.questions) then
    insert into public.questions
      (prompt, type, options, required, position)
    values
      ('🧹 Wusup Broomer good mood?', 'rating', '["1","2","3","4","5","6","7","8","9","10"]', true, 1)
    returning id into mood_id;

    insert into public.questions
      (prompt, type, options, required, position)
    values
      ('Do you like purple shade😈', 'single', '["Fuck yeah!","Hell nahh"]', true, 2),
      ('What is your idea of a dangerously good time⚡', 'long', '[]', false, 4),
      ('Be honest... did you cause any trouble today ? 😆', 'single', '["Yes","No"]', false, 5),
      ('This conversation would be way more interesting in person wouldnt it ?', 'runaway', '[]', false, 6),
      ('', 'image', '["/spongebob.png","/rat.png"]', false, 7),
      ('Anything you want to say but couldnt say it nowhere else on our vast means of comunication?', 'long', '[]', false, 8),
      ('You can only pick 2 out of the bunch', 'multiple', '["Burn","Monster (anyflavour not lemonade)","H3LL","Red Bull"]', false, 9),
      ('What question you would have asked me but didnt had the oportunity for ?🤔', 'long', '[]', false, 12);

    update public.questions
      set follow_up_option = 'Yes', follow_up_placeholder = 'come on shoot it out'
      where position = 5;
    update public.questions
      set placeholder = 'dont be shy :p'
      where position = 8;
    update public.questions
      set multiple_max = 2
      where position = 9;

    insert into public.questions
      (prompt, type, options, required, position, depends_on, condition_type, condition_value)
    values
      ('I know .... its my bad but i think its only fair if i also note your Bday somewhere im horrible with dates tho🤦🏿', 'datetime', '[]', false, 3, mood_id, 'gt', '8');

    insert into public.questions
      (prompt, type, options, required, position)
    values
      ('Allright now a year latter when will that coffe finally happen?', 'datetime', '[]', false, 10)
    returning id into coffee_date_id;

    insert into public.questions
      (prompt, type, options, required, position, depends_on, condition_type, condition_value, response_text, response_trigger)
    values
      ('Who pays for the coffe?', 'single', '["Me","You","Either way"]', false, 11, coffee_date_id, 'gte', '2000-01-01T00:00', 'right..... like i would ever let you pay for it', '*');
  end if;
end
$$;