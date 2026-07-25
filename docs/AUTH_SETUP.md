# User Login & Photos — setup & build plan (Supabase, free-tier, Google login)

Stack: **Supabase Auth + Postgres + Storage**, **Google** social login, for
**favorites + saved preferences + reviews + user-uploaded beach photos**.
Constraint: **everything free**. Static-first is preserved — Supabase is reached
client-side from the browser; no server of ours to run.

Data model + Row Level Security: `supabase/migrations/0001_auth_and_user_data.sql`.

---

## Cost — everything free except Apple (which we park)

| Component | Cost | Notes |
|---|---|---|
| Supabase (Auth + Postgres + Storage) | **Free** | 50k MAU, 500MB DB, 1GB storage. ⚠️ pauses after 7 days idle — see keep-alive. |
| Google OAuth | **Free** | Always free. |
| Netlify | **Free** | Already hosting. |
| Client-side image processing | **Free** | Runs in the browser (Canvas). |
| ~~Apple Sign-In~~ | ❌ $99/yr | **Parked** — add only if/when we ship the iOS App Store (you pay Apple anyway then). |

**Login method: Google only** — the simplest AND the most free: zero password/email
infrastructure. (Email/magic-link would need an SMTP provider; skip until needed —
Resend has a free 3k/mo tier if we ever add it.)

---

## Phase 0 — Prerequisites YOU do (accounts/credentials I can't create)

1. **Supabase project** — region **EU (Frankfurt)** (you're an EU operator; keep PII in
   the EU). Give me the **Project URL** + **anon public key** (browser-safe). The
   **service_role key** is SECRET — server/CLI/dashboard only, never shipped.
2. **Google OAuth** — Google Cloud Console → OAuth client; add Supabase's callback
   (`https://<project>.supabase.co/auth/v1/callback`); paste id/secret into Supabase →
   Auth → Providers → Google.
3. In Supabase: create a **private Storage bucket** named `beach-photos`.

Everything below is code/config I write.

## Phase 1 — Database (I do)
- Run the migration → tables `profiles`, `favorites`, `user_preferences`, `reviews`,
  `beach_photos`, all with RLS (a user only ever touches their own rows; reviews/photos
  public only when `approved`; per-user photo quota trigger).
- Apply the Storage bucket RLS (upload only into your own uid folder) — SQL is noted at
  the bottom of the migration.

## Phase 2 — Auth seam + client (I do)
- Add `@supabase/supabase-js`.
- `services/supabaseClient.ts` — init from env vars.
- `services/authService.ts` — the **seam**: `signInWithGoogle()`, `signOut()`,
  `onAuthChange()`, `getSession()`. Everything imports THIS, never supabase directly →
  provider stays swappable.
- `hooks/useAuth.ts` — current user/session state.
- Env vars (Netlify + `.env.local`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## Phase 3 — Data hooks (I do)
- `useFavorites()` — toggle/list saved beaches.
- `usePreferences()` — load/save the filter blob; merges with the existing local
  preference state so logged-out users are unchanged.
- `useReviews(regionId, beachId)` — read approved + submit own.

## Phase 4 — Photo upload pipeline (I do) — the heavy one
The rule: **never store the raw phone photo.** Process it in the browser first.

1. **Client-side processing** (free, non-negotiable — solves perf + cost + privacy at once):
   on select → **resize ≤1600px + encode WebP (q≈70) + STRIP EXIF/GPS** via Canvas. An
   8MB photo becomes ~150KB before it ever leaves the device. The schema enforces this
   with a `bytes ≤ 600KB` guard.
2. **Upload** direct to Supabase Storage into the user's own folder (`{uid}/...`), insert
   a `beach_photos` row (`status='pending'`).
3. **Serve** approved photos via the existing `<picture>`/AVIF path where possible, or
   signed URLs; label them **"Community photos"** — visually separate from the curated
   set so UGC never reads as your verified data (reliability mandate).
4. **Quota** — 30 photos/user (schema trigger), size/type validation client + server.
- **Storage seam** `services/photoStorage.ts` — so we can swap **Supabase Storage (1GB
  free)** → **Cloudflare R2 (10GB free, zero egress)** cheaply if volume grows.

## Phase 5 — Moderation (design + I do)
⚠️ **Reviews AND photos are UGC** — the opposite of your curated trust, and photos can be
inappropriate/stolen. Guards in the schema: **pending by default, only approved is public,
no self-approve.** You approve them (Supabase dashboard to start → a small admin screen
later). At low volume, manual moderation is the free path; no paid NSFW service needed yet.

## Phase 6 — Legal / GDPR (you + I)
- **Privacy Policy** — you now process PII (email, name, IP, uploaded images). Extend the
  existing legal system: what/why/retention + sub-processors (Supabase, Google).
- **Right to erasure** — "delete my account" → deleting `auth.users` cascades all rows;
  also purge their Storage folder.
- **Photo license + DMCA** — Terms clause: user grants display license + warrants they own
  the photo; a takedown path. EXIF-strip already covers the GPS-privacy angle.
- **Consent** — extend the existing consent manager with the auth/PII basis.

## Phase 7 — Keep-alive (I do) — free-tier pause fix
⚠️ Supabase free **pauses the project after 7 days idle** — a real risk for a seasonal
beach app in winter. **Free fix:** a weekly scheduled **GitHub Action** (cron) that runs a
trivial `SELECT 1` against the project, keeping it warm. Zero cost, ~5 lines of YAML. (If
it ever pauses anyway, it auto-restores on the next request — just a cold-start delay.)

## Phase 8 — SEO / prerender guard (I do)
Auth is **client-only**. The 8091 prerendered pages stay public & crawlable; no content
sits behind login. Verify the prerender build has no user context.

---

## The landmines (call them early)
1. **UGC moderation is forever** (reviews + photos) — budget the ongoing approve/spam work,
   or launch favorites+preferences first, photos/reviews once moderation exists.
2. **Storage is the one thing that can break "free" at scale** — held down by three free
   guards: client compression (~150KB), per-user quota (30), and the moderation gate (few
   approved). Past 1GB → Cloudflare R2 (10GB, zero egress) behind the storage seam.
3. **GDPR** — EU operator + PII + user images → privacy/deletion/DMCA work is not optional.
4. **Supabase pause** — mitigated by the keep-alive Action (Phase 7).

## Recommended launch order
1. **Favorites + preferences** (Google login) — small, safe, fits static-first.
2. **User photos** — with client-side processing + moderation + "Community photos" label.
3. **Reviews** — once the moderation flow is proven.
4. **Apple + iOS** — whenever you tackle the App Store.
