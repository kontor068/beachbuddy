# Milos Photo API Setup

Calm Beach Greece keeps beach photos static at runtime. The app does not call
Unsplash, Pexels, Pixabay, or Wikimedia Enterprise in the browser. API keys and
account credentials are used only by the local Node discovery script.

## Free API Keys

Create free developer keys from the official providers:

- Unsplash: https://unsplash.com/developers
  API docs: https://unsplash.com/documentation
- Pexels: https://www.pexels.com/api/
  API docs: https://www.pexels.com/api/documentation/
- Pixabay: https://pixabay.com/api/docs/
- Wikimedia Enterprise: https://enterprise.wikimedia.com/docs/
  Pricing/free tier: https://enterprise.wikimedia.com/pricing/

Do not use paid APIs, Google Images, travel blogs, TripAdvisor, Booking,
Instagram, Facebook, Pinterest, or the GNTO / Visit Greece Image Bank.

Pixabay-specific rule: the API docs allow returned image URLs for temporary
search-result display, but not permanent hotlinking in an app. The discovery
script downloads any selected Pixabay image into
`public/images/beaches/pixabay/milos/` before it can be written as a displayable
static photo entry.

## Local Environment

Put keys in `.env.local` or your shell environment:

```bash
UNSPLASH_ACCESS_KEY=
PEXELS_API_KEY=
PIXABAY_API_KEY=
WIKIMEDIA_ENTERPRISE_ACCESS_TOKEN=
WIKIMEDIA_ENTERPRISE_USERNAME=
WIKIMEDIA_ENTERPRISE_PASSWORD=
WIKIMEDIA_ENTERPRISE_QUERY_LIMIT=3
```

Rules:

- Never use `VITE_UNSPLASH_ACCESS_KEY`, `VITE_PEXELS_API_KEY`, or
  `VITE_PIXABAY_API_KEY`.
- Never commit real keys.
- Do not put stock API keys in client-side code.
- It is fine to configure only one provider. Missing providers are skipped.
- Prefer `WIKIMEDIA_ENTERPRISE_ACCESS_TOKEN` when you already have a temporary
  token. If you use username/password, keep them only in `.env.local`.

For Pexels only, this is enough:

```bash
PEXELS_API_KEY=your_free_key_here
```

The Pexels connector follows the official API docs: it sends the key only in the
server-side `Authorization` header, uses `https://api.pexels.com/v1/search`,
requests landscape/large photos, caches API responses locally for 24 hours, and
records Pexels rate-limit headers in `reports/milos-photo-api-run.json` when
Pexels is called.

For Wikimedia Enterprise only, use one of these:

```bash
WIKIMEDIA_ENTERPRISE_ACCESS_TOKEN=temporary_access_token
```

or:

```bash
WIKIMEDIA_ENTERPRISE_USERNAME=your_enterprise_username
WIKIMEDIA_ENTERPRISE_PASSWORD=your_enterprise_password
WIKIMEDIA_ENTERPRISE_QUERY_LIMIT=3
```

Wikimedia Enterprise free accounts have monthly limits. The discovery script
keeps the default lookup budget low. It uses Enterprise Structured Contents only
as an article-image hint source, then enriches any `upload.wikimedia.org` image
through the public Wikimedia Commons API before it can become a displayable
photo entry. Enterprise article image metadata alone is not enough for verified
photo display.

For Pixabay only, this is enough:

```bash
PIXABAY_API_KEY=your_free_key_here
```

## Run The Discovery Pass

```bash
npm run photos:milos
```

Outputs:

- `public/data/beaches/photos/south-aegean-milos.json`
- `src/data/beachImages.milos.json`
- `reports/milos-photo-review.csv`
- `reports/milos-photo-api-run.json`
- `reports/milos-photo-manual-review.csv`

The script preserves existing verified images unless `--refresh-verified` is
passed. Candidates and missing beaches are searched again.

When `PIXABAY_API_KEY` is configured, the script searches Pixabay from Node,
caches API responses under `.cache/beach-images/pixabay/`, and stores selected
assets locally under `public/images/beaches/pixabay/milos/`. The frontend never
calls Pixabay directly.

When `PEXELS_API_KEY` is configured, the script searches Pexels from Node only.
The frontend never calls Pexels directly. Pexels candidates include the Pexels
photo page, photographer name, Pexels license URL, and attribution text so detail
pages can link back when a Pexels image is approved as verified.

When Wikimedia Enterprise is configured, the script logs in from Node only,
queries structured content article lookups for a small number of beach title
variants, and keeps the frontend static. Missing credentials skip Enterprise
without failing the run.

Useful options:

```bash
npm run photos:milos -- --refresh-cache
npm run photos:milos -- --limit=5
```

## Review CSV

Open `reports/milos-photo-review.csv`.

Columns to check:

- `previousStatus`
- `newStatus`
- `confidence`
- `source`
- `license`
- `author`
- `sourcePageUrl`
- `imageUrl`
- `thumbnailUrl`
- `matchReason`
- `needsHumanReview`

Only `newStatus=verified` can show automatically in the app. `candidate` and
`missing` remain hidden and show placeholders.

## Manual Overrides

Use `public/data/beaches/photos/manual-overrides.json` only when you have a
fully reviewed image with:

- exact beach match
- source page URL
- image URL and thumbnail URL
- author
- compatible license or written permission
- attribution text
- permission notes for own-photo/manual-permission sources

Use `public/data/beaches/photos/manual-overrides.example.json` as the template.
Run `npm run photos:milos` again after adding an override.

## Runtime Safety

The runtime app reads static JSON only. It must continue to show only entries
where `imageStatus === "verified"`. Cards should use `thumbnailUrl`; detail
pages may use the reviewed image URL and show attribution when required.
