-- Run once in the Broomer project's Supabase SQL Editor.
-- Files remain private. The application uploads and signs URLs server-side
-- with SUPABASE_SECRET_KEY, so no anon/authenticated object policies are needed.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'mood-selfies',
  'mood-selfies',
  false,
  500000,
  array['image/jpeg']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'mood-selfies';