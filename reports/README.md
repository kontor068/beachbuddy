# SEO snapshot — beginner setup guide

`scripts/seo-snapshot.mjs` pulls data from **Google Search Console (GSC)**,
condenses it, and writes two files you can hand to an LLM:

- `reports/snapshots/YYYY-MM-DD.json` — the machine summary (upload this to the chat)
- `reports/snapshots/YYYY-MM-DD.md` — a short digest you can read yourself

It runs **only on your machine**. It is not part of the website build and never
ships to the site. It only fetches and aggregates — it draws no conclusions.

---

## One-time setup (about 10 minutes)

### 1. Install the dependency

```bash
npm install
```

This installs `googleapis` (already listed in `devDependencies`).

### 2. Create a Google service account and download its key

A "service account" is a robot Google account that the script logs in as.

1. Go to <https://console.cloud.google.com/> and pick (or create) any project.
2. Enable the API: search for **"Google Search Console API"** and click **Enable**.
   (Direct link: <https://console.cloud.google.com/apis/library/searchconsole.googleapis.com>)
3. Left menu → **APIs & Services → Credentials**.
4. **Create credentials → Service account**. Give it any name, click through, **Done**.
5. Click the new service account → **Keys** tab → **Add key → Create new key → JSON**.
6. A `.json` file downloads. This is your secret key.

### 3. Put the key where the script expects it

```bash
mkdir .secrets
# move the downloaded file to:  .secrets/gsc-key.json
```

`.secrets/` is git-ignored, so the key can never be committed. **Never** paste
this key into a chat, a commit, or anywhere public.

### 4. Give the service account access to your Search Console property

1. Open the key file `.secrets/gsc-key.json` and copy the `"client_email"` value
   (looks like `something@your-project.iam.gserviceaccount.com`).
2. Go to <https://search.google.com/search-console> → your property →
   **Settings → Users and permissions → Add user**.
3. Paste that email, permission **Full** (or **Restricted** — read is enough), **Add**.

### 5. Configure `.env`

Copy the example and fill in the two GSC values:

```bash
cp .env.example .env
```

Then edit `.env`:

```
GSC_SA_KEY_PATH=./.secrets/gsc-key.json
GSC_SITE_URL=sc-domain:calmbeach.gr
```

**Which `GSC_SITE_URL` do I use?** Open Search Console and look at how your
property is named in the top-left switcher:

- Shown as just **`calmbeach.gr`** (no `https://`) → it is a **Domain** property →
  use `GSC_SITE_URL=sc-domain:calmbeach.gr`
- Shown as **`https://calmbeach.gr/`** → it is a **URL-prefix** property →
  use `GSC_SITE_URL=https://calmbeach.gr/`

If you pick the wrong one, the script runs but every number comes back empty.

---

## Running it

```bash
npm run seo:snapshot
```

You will see log lines for what is downloading, how many rows, and how long it
took. When it finishes, look in `reports/snapshots/` for today's `.json` and `.md`.

Upload the `.json` to the chat for analysis. Read the `.md` yourself for a quick view.

---

## What it produces (at a glance)

- **totals** + a **seasonality-adjusted excess** (the one number that shows if a
  gain is really yours vs. "the same thing happened last year")
- **bySegment**: locale, page type, region, country, device — each with deltas
- **localeCountryMatch**: are the German/French pages actually seen by
  Germans/French? (the Wave 1 validation)
- **ctrCurve**, **strikingDistance**, **ctrGaps**, **zeroClick**,
  **cannibalization**, **risingDecaying**, **newQueries**
- **dailySeries**: 28 daily points to spot sudden drops
- **contentInventory**: how many beaches are "invisible" (never shown in GSC)

The JSON is kept under **180 KB**; if it would exceed that, the script tightens
its caps automatically and logs that it did.

---

## Troubleshooting

- **`Missing GSC_SITE_URL`** — you did not set it in `.env`. See step 5.
- **`Cannot read service-account key`** — the path in `GSC_SA_KEY_PATH` is wrong,
  or the file is not in `.secrets/`. See step 3.
- **`Missing dependency "googleapis"`** — run `npm install`.
- **Runs, but all numbers are empty / zero** — usually the wrong `GSC_SITE_URL`
  kind (domain vs URL-prefix, see step 5), or the service account was not added
  as a user on the property (step 4). Also new properties have little data.
- **`403` / permission errors** — the service-account email is not added to the
  property (step 4), or the Search Console API is not enabled (step 2).
- **`429` errors in the log** — rate limiting; the script already retries with
  backoff. If it still fails, just run it again in a minute.
- **Some section shows `{ "error": "..." }`** — that one fetch/analysis failed but
  the rest of the snapshot still completed. The reason is in that key and in the
  top-level `errors` object.

`reports/snapshots/` is safe to commit (aggregated, no secrets). `.secrets/` and
`.env` are git-ignored and must stay that way.
