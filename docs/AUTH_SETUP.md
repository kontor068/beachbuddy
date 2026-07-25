# User Login — setup & build plan (Supabase + Google/Apple)

Stack decision: **Supabase Auth + Postgres**, social login (**Google + Apple**), for
**favorites + saved preferences + reviews**. Static-first is preserved — Supabase is
reached client-side from the browser; no server of our own to run.

The data model + Row Level Security already live in
`supabase/migrations/0001_auth_and_user_data.sql`. This doc is the ordered plan and the
split of **what you must do** (accounts/credentials I can't create) vs **what I build**.

---

## Phase 0 — Prerequisites YOU must do (accounts & credentials)

These need your identity/billing, so they're on you; everything after is code I write.

1. **Supabase project** — create at supabase.com, **region = EU (Frankfurt)** (you're an
   EU operator; keep PII in the EU). Note the **Project URL** and **anon public key**
   (safe for the browser) and the **service_role key** (SECRET — server/CLI only, never
   ship it).
2. **Google OAuth** — Google Cloud Console → OAuth consent screen + OAuth 2.0 Client ID.
   Add Supabase's callback (`https://<project>.supabase.co/auth/v1/callback`) as an
   authorized redirect URI. Paste client id/secret into Supabase → Auth → Providers →
   Google.
3. **Apple Sign-In** — the heavy one (⚠️ needs a paid **Apple Developer account, $99/yr**):
   create a Service ID, enable Sign in with Apple, register the Supabase callback,
   generate a private key (.p8). Paste into Supabase → Auth → Providers → Apple.
   *Apple is mandatory only if you also ship social login on the iOS App Store; for web
   you can launch with Google alone and add Apple later.*
4. Decide the **account-deletion path** (GDPR, below) — a button that calls a delete flow.

## Phase 1 — Database (I do)
- Run `supabase/migrations/0001_auth_and_user_data.sql` in your project.
- ✅ Tables: `profiles`, `favorites`, `user_preferences`, `reviews` — all with RLS so a
  user only ever touches their own rows; reviews are public only when `approved`.

## Phase 2 — Auth seam + client (I do)
- Add `@supabase/supabase-js`.
- `services/supabaseClient.ts` — init from env vars (URL + anon key).
- `services/authService.ts` — the **seam**: `signInWithGoogle()`, `signInWithApple()`,
  `signOut()`, `onAuthChange()`, `getSession()`. Everything else imports THIS, never
  supabase directly → provider stays swappable.
- `hooks/useAuth.ts` — React state for the current user/session.
- **Env vars** (Netlify + `.env.local`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## Phase 3 — Data hooks (I do)
- `useFavorites()` — toggle/list saved beaches (writes `favorites`).
- `usePreferences()` — load/save the filter blob (writes `user_preferences`); merge with
  the existing local preference state so logged-out users still work unchanged.
- `useReviews(regionId, beachId)` — read approved + submit own (writes `reviews`).

## Phase 4 — UI (I do)
- Login/sign-up modal ("Continue with Google / Apple"), account menu, signed-in states.
- Heart/save control on cards + detail; a "My beaches" view.
- Review form + list on the beach detail page.

## Phase 5 — Moderation & reliability (design, then I do)
⚠️ **Reviews vs your reliability mandate.** UGC can carry wrong/spam info — the opposite of
your curated trust. Guardrails baked into the schema: reviews start **pending**, only
**approved** ones are public, clients can't self-approve. You still need to **approve them**
(Supabase dashboard to start; an admin screen later). Also: show reviews **visually
separate** from the curated verdict/amenities so a user opinion never reads as your
verified data.

## Phase 6 — Legal / GDPR (you + I)
- **Privacy Policy update** — you now process PII (email, name, IP). Extend the existing
  legal system: what you store, why, retention, and the sub-processors (Supabase, Google,
  Apple).
- **Right to erasure** — a "delete my account" action; deleting the `auth.users` row
  cascades all their data (the FKs are `on delete cascade`).
- **Consent** — you already have a consent manager; add the auth/PII basis.

## Phase 7 — SEO / prerender guard (I do)
- Auth is **client-only**. The 8091 prerendered pages stay public & crawlable; nothing
  gates content behind login. Verify the prerender build ignores auth (no user context at
  build time).

---

## The three landmines (call them early)
1. **Apple Sign-In** = paid Apple Developer account + fiddly Service ID/key setup. Launch
   with Google first if you want to move fast.
2. **Reviews = moderation forever.** Budget for the ongoing approve/spam work, or launch
   favorites+preferences first and add reviews once the moderation flow exists.
3. **GDPR** — you're an EU operator adding PII; the privacy/deletion work is not optional.

## Suggested launch order
**Favorites + preferences (Google login) first** — small, safe, fits static-first, real
user value. **Reviews second**, once moderation + the review-vs-curated separation are in
place. Apple + iOS whenever you tackle the store.
