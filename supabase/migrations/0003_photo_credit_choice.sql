-- ─────────────────────────────────────────────────────────────────────────────
-- CalmBeach — does the uploader want their name under the photo?
--
-- Run AFTER 0002_ugc_publication.sql.
--
-- WHY A COLUMN AND NOT A DEFAULT ASSUMPTION. An approved photo is published on a
-- page Google indexes, with a shortened form of the name Google gave us
-- («Γιώργος Π.»). Deciding that from silence is not consent, so the upload form
-- asks — and the answer has to survive the trip, which means it has to be
-- stored. Anywhere it is missing, attribution is what we promised, hence the
-- default.
--
-- NOT NULL DEFAULT TRUE is also what makes this migration safe to run on a table
-- that already holds rows: every photo uploaded before this column existed was
-- sent under a form whose only stated outcome was "your name goes under it".
--
-- NO NEW POLICY IS NEEDED. The existing "photos: insert own pending" policy
-- constrains user_id and status, not the column list, so a client may set this
-- on insert. It may not change it afterwards, because `beach_photos` has no
-- update policy at all — the same reason a user cannot approve their own photo.
-- Changing the choice therefore means deleting the photo and sending it again,
-- which is the honest behaviour: the published page is rebuilt from this table.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.beach_photos
  add column if not exists show_credit boolean not null default true;

comment on column public.beach_photos.show_credit is
  'Uploader asked for their (shortened) name under the published photo. False ⇒ the '
  'site credits it to "a visitor" instead. Read at build time by '
  'scripts/syncApprovedPhotos.mjs; never shown to other users while pending.';
