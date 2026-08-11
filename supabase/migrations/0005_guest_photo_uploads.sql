-- ─────────────────────────────────────────────────────────────────────────────
-- CalmBeach — photo uploads WITHOUT a Google account (11/08/2026)
--
-- WHY. Measured in GA4 over 04–10/08/2026 the photo funnel was 28 people who saw
-- the ask → 2 who clicked → 2 who opened the form → **0 who finished**, with
-- ZERO technical failures recorded. Nothing was broken; we were asking strangers
-- to hand over a Google account in order to give us a present. The client now
-- mints a Supabase ANONYMOUS session at send time (services/authService.ts,
-- signInAsGuest) instead of redirecting them to Google.
--
-- WHAT THIS FILE DOES NOT NEED TO DO, and that is the point of the design: every
-- existing protection is written in terms of auth.uid(), and an anonymous user
-- has one. So the row policies ("insert own pending"), the storage policies
-- (`(storage.foldername(name))[1] = auth.uid()::text`, granted `to
-- authenticated` — anonymous users ARE in that role), the moderation gate and
-- the ownership check in /api/ugc-notify all keep working untouched. Nothing
-- here loosens a policy.
--
-- WHAT IT DOES CHANGE is the one number that anonymity actually weakens: the
-- per-user upload cap. A real account is a person who paid a cost to exist, so
-- 30 pending photos is a reasonable ceiling. A guest identity costs a tap, and
-- anyone determined enough can mint a fresh one — so the cap for guests is set
-- low deliberately. It does not stop a determined abuser (nothing client-side
-- can); it stops the accidental flood and keeps any single burst small enough to
-- moderate by hand.
--
-- REQUIRED DASHBOARD STEP, this file cannot do it: Supabase → Authentication →
-- Sign In / Providers → **Anonymous sign-ins: ON**. Until that is flipped the
-- app falls back to asking for Google (PhotoUploadFailure 'sign-in-required'),
-- so shipping this migration early is safe.
--
-- ALSO WORTH DOING IN THE DASHBOARD (not required today): Authentication →
-- Rate Limits caps anonymous sign-ins per IP per hour (default 30), and
-- Auth → Settings → CAPTCHA protection covers the same endpoint if abuse ever
-- shows up. Both are levers to pull later, not preconditions.
-- ─────────────────────────────────────────────────────────────────────────────

-- Per-user upload cap, now aware of WHO is uploading.
-- SECURITY DEFINER (unchanged) is what lets the trigger read auth.users at all;
-- `search_path = ''` (unchanged) is why every name below is fully qualified.
create or replace function public.enforce_photo_quota()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  pending_count integer;
  guest         boolean;
  cap           integer;
begin
  select coalesce(u.is_anonymous, false) into guest
    from auth.users u where u.id = new.user_id;

  -- 3 for a guest, 30 for an account. A guest who fills their three has almost
  -- certainly sent everything they came to send; a photographer with an account
  -- doing a whole island has not.
  cap := case when guest then 3 else 30 end;

  select count(*) into pending_count from public.beach_photos
    where user_id = new.user_id and status <> 'rejected';

  if pending_count >= cap then
    raise exception 'photo upload quota reached';
  end if;
  return new;
end;
$$;

-- The trigger itself is unchanged (before insert, for each row) — replacing the
-- function is enough, and re-creating the trigger would drop and re-add it for
-- no reason. Left here as a comment so nobody goes looking for it:
--   create trigger beach_photos_quota before insert on public.beach_photos
--     for each row execute function public.enforce_photo_quota();
