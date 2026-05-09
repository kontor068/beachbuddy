import { Beach, LanguageCode, TravelStyle } from '../types';

export interface BeachDetailsAIResponse {
    whyToday: string;
    localsTip: string;
    whatToPack: string[];
}

interface DailyInfo {
    date: Date;
    weather: string;
    wind: string;
    shelteredBeaches: string[];
    isToday?: boolean;
}

const OLLAMA_API = 'http://localhost:11434/api';
const MODEL = 'C:/Users/Miltos/.lmstudio/hub/models/gemma-4-26B-A4B-it-Q4_K_M.gguf'; // Updated to use the correct model path

const getLanguageName = (langCode: LanguageCode): string => {
    const langMap: Record<LanguageCode, string> = {
        en: 'English', gr: 'Greek', fr: 'French', de: 'German', it: 'Italian',
    };
    return langMap[langCode] || 'English';
}

export const generateItinerary = async (
    islandName: string,
    dailyData: DailyInfo[],
    allBeaches: Beach[],
    language: LanguageCode,
    travelStyle: TravelStyle,
    targetDuration: number,
    t: any,
    isWinter: boolean = false
): Promise<string> => {
    const languageName = getLanguageName(language);
    
    const prompt = `Create a ${targetDuration}-day holiday itinerary for ${islandName} in ${languageName}.
    
    Context:
    - User Travel Style: ${t.travelStyles[travelStyle]}
    - Season: ${isWinter ? 'Winter (Winter swimming, hiking, villages)' : 'Summer (Beaches, sun, swimming)'}
    - Weather Forecast (Available for first ${dailyData.length} days): ${JSON.stringify(dailyData)}
    
    Requirements:
    1. Structure the response clearly with "### Day X: Title" headers.
    2. For each day, suggest specific beaches from the area/region (prioritize sheltered ones if windy).
    3. Include evening activities (dinner, sunset spots).
    4. If the itinerary length (${targetDuration} days) exceeds the forecast data, propose general best-of activities for the remaining days.
    5. Use **bold** for key location names.
    `;

    try {
        const response = await fetch(`${OLLAMA_API}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODEL,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 2000,
                stream: false
            })
        });

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    } catch (error) {
        console.error('Ollama itinerary generation failed:', error);
        return '';
    }
};

export const initializeChat = (islandName: string, beaches: Beach[], language: LanguageCode, t: any) => {
    // Simple chat state holder for Ollama
    return {
        islandName,
        beaches,
        language,
        history: [] as Array<{ role: string; content: string }>
    };
};

export const sendMessageStream = async (chat: any, message: string) => {
    const systemPrompt = `Local guide for ${chat.islandName}. Language: ${getLanguageName(chat.language)}. Be helpful and friendly.`;
    
    // Add to history
    chat.history.push({ role: 'user', content: message });

    try {
        const response = await fetch(`${OLLAMA_API}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...chat.history
                ],
                temperature: 0.7,
                stream: true
            })
        });

        // Handle streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        async function* streamGenerator() {
            while (reader) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const json = JSON.parse(line.slice(6));
                            const content = json.choices?.[0]?.delta?.content || '';
                            if (content) {
                                fullResponse += content;
                                yield { text: () => fullResponse };
                            }
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }
            }
        }

        return streamGenerator();
    } catch (error) {
        console.error('Ollama chat stream failed:', error);
        // Return empty generator on error
        return (async function* () {})();
    }
};

export const generateBeachDetails = async (beach: Beach, windInfo: string, language: LanguageCode, t: any): Promise<BeachDetailsAIResponse | null> => {
    const languageName = getLanguageName(language);
    
    const prompt = `
        You are a local expert guide for beaches in Greece.
        Provide a detailed card for the beach "${beach.name[language]}" (or "${beach.name['en']}").
        
        Current Conditions: ${windInfo}
        
        Task: Provide 3 specific sections in JSON format:
        1. "whyToday": Why is it a good choice TODAY based on the specific wind/weather? (Keep it concise, 1-2 sentences).
        2. "localsTip": A hidden gem or insider tip about this specific beach (e.g., jump from the rock on the left, visit the cave, best time to go).
        3. "whatToPack": A list of 3-4 essential items specifically for this beach (e.g., snorkeling gear, water shoes if rocky, umbrella if no shade).
        
        IMPORTANT: The output MUST be in ${languageName} language.
        
        Respond ONLY with valid JSON in this format:
        {
            "whyToday": "string",
            "localsTip": "string",
            "whatToPack": ["item1", "item2", "item3"]
        }
    `;

    try {
        const response = await fetch(`${OLLAMA_API}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODEL,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 500,
                stream: false
            })
        });

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '{}';
        
        // Extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return null;
    } catch (error) {
        console.error('Ollama beach details generation failed:', error);
        return null;
    }
};
