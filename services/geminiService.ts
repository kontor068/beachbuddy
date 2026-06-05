import { GoogleGenAI, Chat } from '@google/genai';
import { Beach, LanguageCode, TravelStyle } from '../types';

const DEFAULT_LOCAL_LLM_URL = 'http://localhost:1234/v1/chat/completions';
const DEFAULT_LOCAL_LLM_MODEL = 'local-model';
const DEFAULT_LOCAL_MAX_TOKENS = 2048;
const DEFAULT_LOCAL_TIMEOUT_MS = 90_000;
const GEMINI_MODEL = 'gemini-2.0-flash';

let cachedDetectedLocalModel: string | null = null;

export const aiOptions = [
  { value: 'google', label: 'Google Gemini (Cloud)' },
  { value: 'ollama', label: 'Local GPU (LM Studio/Ollama)' },
];

const getLocalLlmUrl = (): string => {
  const fromVite = (import.meta as any)?.env?.VITE_LOCAL_LLM_URL;
  return typeof fromVite === 'string' && fromVite.trim() ? fromVite : DEFAULT_LOCAL_LLM_URL;
};

const getConfiguredLocalLlmModel = (): string => {
  const fromVite = (import.meta as any)?.env?.VITE_LOCAL_LLM_MODEL;
  return typeof fromVite === 'string' && fromVite.trim() ? fromVite : '';
};

const getLocalMaxTokens = (): number => {
  const fromVite = Number((import.meta as any)?.env?.VITE_LOCAL_LLM_MAX_TOKENS);
  return Number.isFinite(fromVite) && fromVite > 0 ? Math.floor(fromVite) : DEFAULT_LOCAL_MAX_TOKENS;
};

const getLocalTimeoutMs = (): number => {
  const fromVite = Number((import.meta as any)?.env?.VITE_LOCAL_LLM_TIMEOUT_MS);
  return Number.isFinite(fromVite) && fromVite >= 10_000 ? Math.floor(fromVite) : DEFAULT_LOCAL_TIMEOUT_MS;
};

const getGeminiApiKey = (): string => {
  // ΠΡΟΣΟΧΗ: Για παραγωγή (App Store/Google Play), προτείνεται η χρήση backend proxy
  // αντί για απευθείας χρήση του API Key στο frontend.
  const fromVite = (import.meta as any)?.env?.VITE_GEMINI_API_KEY;
  if (typeof fromVite === 'string') return fromVite;

  const fromProcess =
    typeof process !== 'undefined'
      ? ((process as any).env?.VITE_GEMINI_API_KEY || (process as any).env?.NEXT_PUBLIC_GEMINI_API_KEY)
      : undefined;

  if (typeof fromProcess === 'string') return fromProcess;
  return '';
};

const extractText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const text = (item as any).text ?? (item as any).content ?? (item as any).value;
          return typeof text === 'string' ? text : '';
        }
        return '';
      })
      .join('')
      .trim();
  }

  if (value && typeof value === 'object') {
    const text = (value as any).text ?? (value as any).content ?? (value as any).value;
    if (typeof text === 'string') return text.trim();
  }

  return '';
};

const parseCompletionText = (data: any): string => {
  const fromMessage = extractText(data?.choices?.[0]?.message?.content);
  if (fromMessage) return fromMessage;

  const fromText = extractText(data?.choices?.[0]?.text);
  if (fromText) return fromText;

  const fromOutputText = extractText(data?.output_text);
  if (fromOutputText) return fromOutputText;

  return '';
};

const getModelsEndpoint = (chatCompletionsUrl: string): string => {
  try {
    const parsed = new URL(chatCompletionsUrl);
    parsed.pathname = '/v1/models';
    parsed.search = '';
    return parsed.toString();
  } catch {
    return 'http://localhost:1234/v1/models';
  }
};

const detectLocalModel = async (chatCompletionsUrl: string): Promise<string | null> => {
  if (cachedDetectedLocalModel) return cachedDetectedLocalModel;

  try {
    const modelsUrl = getModelsEndpoint(chatCompletionsUrl);
    const response = await fetch(modelsUrl, { method: 'GET' });
    if (!response.ok) return null;

    const data = await response.json();
    const firstId = data?.data?.[0]?.id;
    if (typeof firstId === 'string' && firstId.trim()) {
      cachedDetectedLocalModel = firstId.trim();
      return cachedDetectedLocalModel;
    }
  } catch {
    // Best-effort detection, ignore failure.
  }

  return null;
};

const getLocalModel = async (chatCompletionsUrl: string): Promise<string> => {
  const configured = getConfiguredLocalLlmModel();
  if (configured) return configured;

  const detected = await detectLocalModel(chatCompletionsUrl);
  if (detected) return detected;

  return DEFAULT_LOCAL_LLM_MODEL;
};

const createLocalPayload = (model: string, message: string, disableReasoning: boolean): any => {
  const payload: any = {
    model,
    messages: [
      {
        role: 'system',
        content:
          'You are Beach Finder Greece. Reply in Greek, concise, and helpful for beach recommendations. Always provide a direct final answer.',
      },
      { role: 'user', content: message },
    ],
    temperature: 0.7,
    max_tokens: getLocalMaxTokens(),
    stream: false,
  };

  if (disableReasoning) {
    // Qwen reasoning models in LM Studio may emit only reasoning_content unless this is set.
    payload.reasoning_effort = 'none';
  }

  return payload;
};

const isReasoningEffortError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('reasoning_effort') || (message.includes('unknown') && message.includes('field'));
};

const postLocalCompletion = async (url: string, payload: any): Promise<any> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), getLocalTimeoutMs());

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const apiMessage = data?.error?.message || `HTTP ${response.status}`;
      throw new Error(`Local LLM error: ${apiMessage}`);
    }

    return data;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Local LLM request timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

const sendLocalMessage = async (message: string): Promise<string> => {
  const url = getLocalLlmUrl();
  const model = await getLocalModel(url);

  let data: any;
  try {
    data = await postLocalCompletion(url, createLocalPayload(model, message, true));
  } catch (error) {
    if (!isReasoningEffortError(error)) {
      throw error;
    }
    // Fallback for servers that do not support `reasoning_effort`.
    data = await postLocalCompletion(url, createLocalPayload(model, message, false));
  }

  const text = parseCompletionText(data);
  if (text) return text;

  const reasoningText = extractText(data?.choices?.[0]?.message?.reasoning_content);
  const finishReason = data?.choices?.[0]?.finish_reason;
  if (reasoningText) {
    throw new Error(`Local LLM returned only reasoning output (finish_reason: ${finishReason || 'unknown'}).`);
  }

  throw new Error('Local LLM returned an empty response.');
};

export const sendMessage = async (
  chat: Chat | null,
  message: string,
  modelType: string = 'google'
): Promise<string> => {
  // Έλεγχος συνδεσιμότητας (προαιρετικό αλλά προτεινόμενο για mobile)
  if (typeof navigator !== 'undefined' && !navigator.onLine && modelType === 'google') {
    return 'Δεν υπάρχει σύνδεση στο διαδίκτυο. Παρακαλώ ελέγξτε το δίκτυό σας.';
  }

  if (modelType === 'ollama') {
    try {
      return await sendLocalMessage(message);
    } catch (error) {
      console.error('Local LLM connection error:', error);
      return 'Η σύνδεση με το τοπικό AI απέτυχε. Έλεγξε ότι το LM Studio τρέχει και ότι το μοντέλο είναι φορτωμένο.';
    }
  }

  if (!chat) return 'Σφάλμα AI.';

  const result = await chat.sendMessage({ message });
  return result.text || 'Σφάλμα AI.';
};

// Backward-compatible alias.
export const sendMessageStream = sendMessage;

export const initializeChat = (
  islandName: string,
  _beaches: Beach[],
  _language: LanguageCode,
  _t: any
): Chat => {
  const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
  return ai.chats.create({
    model: GEMINI_MODEL,
    config: {
      systemInstruction: `Local guide for ${islandName}.`,
    },
  });
};

export const generateItinerary = async (
  islandName: string,
  _dailyData: any[],
  _beaches: Beach[],
  _language: LanguageCode,
  _travelStyle: TravelStyle,
  _targetDuration: number,
  _t: any,
  _isWinter: boolean
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
  const prompt = `Φτιάξε πλάνο διακοπών για ${islandName}.`;

  const result = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
  });

  return result.text || 'Σφάλμα AI.';
};
