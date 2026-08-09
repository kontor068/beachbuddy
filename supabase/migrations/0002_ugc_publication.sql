-- ─────────────────────────────────────────────────────────────────────────────
-- CalmBeach — publishing user content, and closing a self-approval hole in 0001.
--
-- Run AFTER 0001_auth_and_user_data.sql. Three jobs:
--
--   1. SECURITY FIX. 0001's "reviews: update own" policy checks only
--      `auth.uid() = user_id` — it never constrains `status`. A logged-in user
--      could therefore PATCH their own review to status='approved' and publish
--      themselves, which defeats the entire moderation gate. The policy is
--      replaced below so an update may only ever leave a review 'pending', and a
--      trigger enforces the same thing a second time for anything that reaches
--      the table by another route. (`beach_photos` was never exposed — it has no
--      update policy at all, so client updates are already denied.)
--
--   2. PUBLICATION. Approved photos need a URL that can be baked into static HTML
--      and crawled by Google. Signed URLs expire, so they cannot be. Uploads keep
--      landing in the PRIVATE bucket; on approval the file is copied into a second,
--      PUBLIC bucket and `public_path` records where. Nothing unapproved is ever
--      publicly reachable.
--
--   3. STORAGE POLICIES. 0001 left them as a comment. Commented SQL protects
--      nothing — they are real statements here.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1) Reviews: a client may never move a review out of 'pending' ────────────
drop policy if exists "reviews: update own" on public.reviews;
create policy "reviews: update own pending" on public.reviews
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id and status = 'pending');

-- Defence in depth: whatever the policy allows, a non-service-role write resets
-- the row to pending and clears the publication stamp. Editing an approved review
-- therefore sends it back through moderation instead of silently changing what is
-- already published on a crawled page.
create or replace function public.reviews_force_pending_on_edit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    new.status := 'pending';
    new.approved_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;


-- ── 2) Publication columns ───────────────────────────────────────────────────
alter table public.reviews
  add column if not exists approved_at timestamptz;

alter table public.beach_photos
  add column if not exists approved_at  timestamptz,
  -- Path within the PUBLIC bucket. Null until approved; set by the moderation
  -- function with the service role. This is what the build snapshot reads.
  add column if not exists public_path  text;

-- The trigger has to be created after `approved_at` exists.
drop trigger if exists reviews_force_pending on public.reviews;
create trigger reviews_force_pending before update on public.reviews
  for each row execute function public.reviews_force_pending_on_edit();

-- Moderation queues, read with the service role. Small tables, but these are the
-- only two queries the admin screen and the daily publish check ever run.
create index if not exists idx_beach_photos_pending on public.beach_photos (created_at) where status = 'pending';
create index if not exists idx_reviews_pending      on public.reviews      (created_at) where status = 'pending';

-- The build snapshot reads approved rows by beach. 0001 already indexes
-- (region_id, beach_id) where approved; add the ordering column so the snapshot
-- generator can take "newest N per beach" without a sort.
create index if not exists idx_beach_photos_approved_at on public.beach_photos (approved_at desc) where status = 'approved';
create index if not exists idx_reviews_approved_at      on public.reviews      (approved_at desc) where status = 'approved';


-- ── 3) Buckets + storage policies ────────────────────────────────────────────
-- Idempotent bucket creation (the dashboard does the same thing).
--   beach-photos         PRIVATE — every upload lands here, approved or not.
--   beach-photos-public  PUBLIC  — only approved copies, permanent cacheable URLs.
insert into storage.buckets (id, name, public)
  values ('beach-photos', 'beach-photos', false)
  on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
  values ('beach-photos-public', 'beach-photos-public', true)
  on conflict (id) do update set public = true;

-- A signed-in user may write and read ONLY inside a folder named after their own
-- uid, and may delete their own uploads (so "delete my photo" works client-side).
-- Nobody but the service role can read another user's pending uploads.
drop policy if exists "beach-photos: upload to own folder" on storage.objects;
create policy "beach-photos: upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'beach-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "beach-photos: read own uploads" on storage.objects;
create policy "beach-photos: read own uploads" on storage.objects
  for select to authenticated
  using (bucket_id = 'beach-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "beach-photos: delete own uploads" on storage.objects;
create policy "beach-photos: delete own uploads" on storage.objects
  for delete to authenticated
  using (bucket_id = 'beach-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- The PUBLIC bucket is written ONLY by the moderation function (service role,
-- which bypasses RLS). No client policy is created for it on purpose: a user must
-- not be able to place a file straight into the published set and skip approval.
-- Public *reads* need no policy — that is what `public = true` means.
