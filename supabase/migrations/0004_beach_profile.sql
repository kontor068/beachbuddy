-- 0004 — the saved beach profile ("what I like in a beach").
--
-- WHY A SECOND COLUMN AND NOT A KEY INSIDE `preferences`. That blob is the
-- live filter chips, written on every toggle by usePreferencesSync. The profile
-- is a different thing with a different lifetime: chosen once, changed rarely,
-- and it must survive someone clearing their chips. Folding it into the same
-- object would make every chip toggle a rewrite of the profile too, and one
-- bad merge would erase a choice the person made weeks ago.
--
-- Same row, same owner, so the existing RLS policies on user_preferences
-- already cover it — a user reads and writes only their own row.

alter table public.user_preferences
  add column if not exists beach_profile jsonb not null default '{}'::jsonb;
