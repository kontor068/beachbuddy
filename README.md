<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/14279e75-aff0-4018-87c6-73c9fd049f83

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `VITE_GEMINI_API_KEY` (or `GEMINI_API_KEY`) in `.env.local` to your Gemini API key
3. Optional: set `VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX` in production to enable GA4 with Google Consent Mode Advanced
4. Run the app:
   `npm run dev`

## Local GPU AI (LM Studio / Ollama)

The chatbot can also talk to a **local OpenAI-compatible** server (LM Studio, Ollama, etc.). If your server is configured to use your **NVIDIA GPU (CUDA)**, then the AI responses will be generated on your GPU (e.g. RTX 30xx).

Create `.env` (or add to `.env.local`) at the project root:

`VITE_LOCAL_LLM_URL=http://localhost:1234/v1/chat/completions`

`VITE_LOCAL_LLM_MODEL=gemma`

Then in the chatbot select **Local GPU (LM Studio/Ollama)**.

## Legal beach image discovery

Run the Milos image discovery pipeline:

```bash
node scripts/findMilosBeachImages.mjs
```

The script reads `public/greek_beaches.json`, extracts Milos beaches, searches Wikimedia Commons first, and writes:

- `src/data/beachImages.milos.json`
- `reports/milos-beach-image-review.csv`

Optional API keys unlock additional legal-source searches after Wikimedia Commons:

```bash
UNSPLASH_ACCESS_KEY=... PEXELS_API_KEY=... PIXABAY_API_KEY=... node scripts/findMilosBeachImages.mjs
```

Missing API keys are skipped. API responses are cached under `.cache/beach-images/`; use `--refresh-cache` to force fresh requests.

Only Public Domain, CC0, CC BY, and CC BY-SA Commons images are accepted. Non-commercial, no-derivatives, editorial-only, and unknown licenses are rejected. The app helper only returns `verified` images; `candidate` rows stay for human review and `missing` rows should render the local placeholder.
