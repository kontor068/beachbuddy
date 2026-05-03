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
3. Run the app:
   `npm run dev`

## Local GPU AI (LM Studio / Ollama)

The chatbot can also talk to a **local OpenAI-compatible** server (LM Studio, Ollama, etc.). If your server is configured to use your **NVIDIA GPU (CUDA)**, then the AI responses will be generated on your GPU (e.g. RTX 30xx).

Create `.env` (or add to `.env.local`) at the project root:

`VITE_LOCAL_LLM_URL=http://localhost:1234/v1/chat/completions`

`VITE_LOCAL_LLM_MODEL=gemma`

Then in the chatbot select **Local GPU (LM Studio/Ollama)**.
