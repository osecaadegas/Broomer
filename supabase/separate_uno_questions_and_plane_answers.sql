create table if not exists public.uno_questions (
  id serial primary key,
  prompt text not null check (length(btrim(prompt)) between 1 and 500),
  type varchar(24) not null check (
    type in ('short', 'long', 'single', 'multiple', 'rating', 'number', 'datetime')
  ),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  required boolean not null default false,
  position integer not null,
  answer jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists uno_questions_position_id_idx
  on public.uno_questions (position, id);

alter table public.uno_questions enable row level security;

grant select, update on public.uno_questions to authenticated;
grant usage, select on sequence public.uno_questions_id_seq to authenticated;

drop policy if exists "Admins can read UNO questions" on public.uno_questions;
create policy "Admins can read UNO questions"
  on public.uno_questions for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can update UNO answers" on public.uno_questions;
create policy "Admins can update UNO answers"
  on public.uno_questions for update to authenticated
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
  select
    settings.quote_of_day,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', question.id,
            'question', question.prompt,
            'type', question.type,
            'options', question.options,
            'answer', question.answer
          )
          order by question.position, question.id
        )
        from public.uno_questions as question
        where question.answer is not null
          and question.answer <> 'null'::jsonb
          and not (
            jsonb_typeof(question.answer) = 'string'
            and btrim(question.answer #>> '{}') = ''
          )
          and not (
            jsonb_typeof(question.answer) = 'array'
            and jsonb_array_length(question.answer) = 0
          )
      ),
      '[]'::jsonb
    )
  from public.app_settings as settings
  where settings.id = true
    and candidate ~ '^[0-9]{3}$'
    and settings.plane_password = candidate;
$$;

revoke execute on function public.get_plane_reveal(text) from public;
grant execute on function public.get_plane_reveal(text) to anon, authenticated;

notify pgrst, 'reload schema';
