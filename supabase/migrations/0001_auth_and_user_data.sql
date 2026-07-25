-- ─────────────────────────────────────────────────────────────────────────────
-- CalmBeach — user accounts & user-owned data (Supabase / Postgres)
--
-- Run in the Supabase SQL editor (or `supabase db push`). Creates the data model
-- for: saved favorites, saved preferences, and user reviews — plus Row Level
-- Security so a user can ONLY ever read/write their own rows. RLS is the security
-- boundary here: without it, the anon/public API key can read every table. Every
-- table below has RLS ENABLED and explicit policies; deny-by-default is the point.
--
-- Beaches are identified by (region_id TEXT, beach_id INT) — ids are unique only
-- WITHIN a region in the app dataset, so every reference is the composite pair.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) PROFILE — app-side mirror of the auth user (never store secrets here).
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  created_at    timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles: read own"   on public.profiles for select using  (auth.uid() = id);
create policy "profiles: update own" on public.profiles for update using  (auth.uid() = id);
-- Insert happens via the trigger below (SECURITY DEFINER), not by clients.

-- Auto-create a profile row when a new auth user signs up (Google/Apple/email).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'));
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();


-- 2) FAVORITES — saved beaches, one row per (user, beach).
create table public.favorites (
  user_id     uuid not null references auth.users(id) on delete cascade,
  region_id   text not null,
  beach_id    integer not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, region_id, beach_id)
);
alter table public.favorites enable row level security;
-- One policy per verb so the intent is auditable; all scoped to the owner.
create policy "favorites: read own"   on public.favorites for select using      (auth.uid() = user_id);
create policy "favorites: insert own" on public.favorites for insert with check (auth.uid() = user_id);
create policy "favorites: delete own" on public.favorites for delete using      (auth.uid() = user_id);


-- 3) PREFERENCES — the user's saved filters/settings blob, one row per user.
create table public.user_preferences (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
alter table public.user_preferences enable row level security;
create policy "prefs: read own"   on public.user_preferences for select using      (auth.uid() = user_id);
create policy "prefs: upsert own" on public.user_preferences for insert with check (auth.uid() = user_id);
create policy "prefs: update own" on public.user_preferences for update using      (auth.uid() = user_id);


-- 4) REVIEWS — user-generated content. RELIABILITY GUARD: reviews are separate
-- from the curated dataset and start life as 'pending'. Only 'approved' reviews
-- are ever publicly readable, so unmoderated UGC never contaminates the trusted
-- verdicts/amenities. A client CANNOT self-approve (see the WITH CHECK on insert
-- + the missing public update policy — status only moves via a moderation path
-- run with the service role, not the anon key).
create type public.review_status as enum ('pending', 'approved', 'rejected');

create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  region_id   text not null,
  beach_id    integer not null,
  rating      smallint not null check (rating between 1 and 5),
  body        text check (char_length(body) <= 2000),
  status      public.review_status not null default 'pending',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, region_id, beach_id)   -- one review per user per beach
);
create index idx_reviews_beach on public.reviews (region_id, beach_id) where status = 'approved';
alter table public.reviews enable row level security;

-- Anyone (incl. logged-out visitors) may read APPROVED reviews.
create policy "reviews: public read approved" on public.reviews
  for select using (status = 'approved');
-- A user may always read their own, whatever the status.
create policy "reviews: read own" on public.reviews
  for select using (auth.uid() = user_id);
-- A user may submit their own review, but can NOT set status (forced to pending).
create policy "reviews: insert own pending" on public.reviews
  for insert with check (auth.uid() = user_id and status = 'pending');
-- A user may edit the text/rating of their own review; edits reset it to pending
-- for re-moderation (enforce that in the app-layer update, or a BEFORE trigger).
create policy "reviews: update own" on public.reviews
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "reviews: delete own" on public.reviews
  for delete using (auth.uid() = user_id);

-- NOTE: moderation (pending → approved/rejected) is done with the SERVICE ROLE key
-- from a trusted context (Supabase dashboard, an admin screen, or an edge function)
-- — never exposed to the browser. The service role bypasses RLS by design.


-- 5) BEACH PHOTOS — user-uploaded images. The FILE lives in Supabase Storage
-- (bucket 'beach-photos'); this table is the metadata + moderation record. Same
-- reliability guard as reviews: pending by default, only 'approved' is public, no
-- self-approve. Uploads are processed CLIENT-SIDE before they arrive (resize ≤1600px
-- + WebP + EXIF/GPS stripped) so we never store 8MB phone originals and never leak
-- the uploader's location — see docs/AUTH_SETUP.md.
create table public.beach_photos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  region_id    text not null,
  beach_id     integer not null,
  storage_path text not null,                       -- path within the 'beach-photos' bucket
  width        integer,
  height       integer,
  bytes        integer check (bytes is null or bytes <= 600000),  -- guard: processed, not raw
  caption      text check (char_length(caption) <= 280),
  status       public.review_status not null default 'pending',
  created_at   timestamptz not null default now(),
  unique (user_id, storage_path)
);
create index idx_beach_photos_beach on public.beach_photos (region_id, beach_id) where status = 'approved';
-- Per-user upload cap (anti-abuse / cost control): reject a new PENDING row once the
-- user already has N not-yet-rejected photos. Enforced by a trigger since RLS can't count.
create or replace function public.enforce_photo_quota()
returns trigger language plpgsql security definer set search_path = '' as $$
declare pending_count integer;
begin
  select count(*) into pending_count from public.beach_photos
    where user_id = new.user_id and status <> 'rejected';
  if pending_count >= 30 then
    raise exception 'photo upload quota reached';
  end if;
  return new;
end;
$$;
create trigger beach_photos_quota before insert on public.beach_photos
  for each row execute function public.enforce_photo_quota();

alter table public.beach_photos enable row level security;
create policy "photos: public read approved" on public.beach_photos
  for select using (status = 'approved');
create policy "photos: read own" on public.beach_photos
  for select using (auth.uid() = user_id);
create policy "photos: insert own pending" on public.beach_photos
  for insert with check (auth.uid() = user_id and status = 'pending');
create policy "photos: delete own" on public.beach_photos
  for delete using (auth.uid() = user_id);

-- STORAGE bucket RLS (run after creating a PRIVATE bucket named 'beach-photos'):
-- users may upload only into their own folder (path prefix = their uid), and read
-- happens through signed URLs the app mints for approved photos.
--   create policy "upload to own folder" on storage.objects for insert to authenticated
--     with check (bucket_id = 'beach-photos' and (storage.foldername(name))[1] = auth.uid()::text);
--   create policy "read own uploads" on storage.objects for select to authenticated
--     using (bucket_id = 'beach-photos' and (storage.foldername(name))[1] = auth.uid()::text);
--   create policy "delete own uploads" on storage.objects for delete to authenticated
--     using (bucket_id = 'beach-photos' and (storage.foldername(name))[1] = auth.uid()::text);
