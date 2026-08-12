-- ─────────────────────────────────────────────────────────────────────────────
-- CalmBeach — the order of a beach's photos is a decision, not an accident (12/08/2026)
--
-- WHY. Until now the order was "most recently approved first", capped at six.
-- That is a reasonable default and a bad rule: the photo that happens to be
-- approved last becomes the beach's cover image, which is the single most
-- visible image on the card, in search results and on the detail page. With the
-- first real visitor photos arriving, the person who decides which one of three
-- represents a beach has to be a human looking at them, not the clock.
--
-- WHAT THIS ADDS, and nothing more:
--
--   beach_photos.sort_order        where this photo sits, low first.
--   beach_photo_settings.max_shown how many of them that beach shows.
--
-- Two columns, one idea: put them in order, then say how many make the cut.
-- A photo with NO sort_order is not "unordered", it is "not yet placed" — it
-- sorts after every placed photo, newest first, which is exactly the behaviour
-- that existed before this file. So a beach nobody has curated looks the same as
-- it always did, and a newly approved photo can never displace a curated cover
-- by arriving. That is the whole migration path: there isn't one.
--
-- WHO MAY WRITE IT. Nobody but the service role, and this is load-bearing rather
-- than incidental. public.beach_photos has SELECT, INSERT and DELETE policies but
-- deliberately NO update policy (0001), so a signed-in visitor cannot set
-- sort_order on their own photo and promote themselves to the top of a beach
-- page. beach_photo_settings below has RLS on and NOT ONE policy, which in
-- Postgres means: readable and writable by the service role only.
--
-- NO CAP ABOVE 12. The ceiling is the moderator's to choose per beach, but a
-- beach page that tries to load 40 visitor photos on a phone is a slow page for
-- every visitor of that beach, forever. Twelve is a bound on a mistake, not a
-- product opinion; six remains the default and matches today's behaviour.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.beach_photos
  add column if not exists sort_order integer;

comment on column public.beach_photos.sort_order is
  'Curated position, low first. NULL = not yet placed: sorts after every placed photo, newest first.';

create table if not exists public.beach_photo_settings (
  region_id  text    not null,
  beach_id   integer not null,
  max_shown  integer not null default 6 check (max_shown between 1 and 12),
  updated_at timestamptz not null default now(),
  primary key (region_id, beach_id)
);

-- RLS on, zero policies: the service role bypasses RLS, everyone else is denied.
-- A row here changes what every visitor of that beach sees, so it is not readable
-- by the public even though its effect is.
alter table public.beach_photo_settings enable row level security;

comment on table public.beach_photo_settings is
  'Per-beach photo display settings. Service role only. Absent row = the default of 6.';
