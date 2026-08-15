-- Run once in the Supabase SQL Editor before changing existing questions.
-- New responses store this snapshot automatically in the application API.
update public.responses as response
set answers = response.answers || jsonb_build_object(
  '__questionSnapshots',
  coalesce(
    (
      select jsonb_object_agg(
        question.id::text,
        jsonb_build_object(
          'prompt', question.prompt,
          'type', question.type,
          'options', question.options
        )
      )
      from public.questions as question
      where response.answers ? question.id::text
         or response.answers ? (question.id::text || ':followup')
    ),
    '{}'::jsonb
  )
)
where jsonb_typeof(response.answers) = 'object'
  and not (response.answers ? '__questionSnapshots');

select
  count(*) filter (where answers ? '__questionSnapshots') as snapshotted,
  count(*) as total
from public.responses;