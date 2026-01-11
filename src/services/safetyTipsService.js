import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Access the API key from environment variables
const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour
const API_TIMEOUT = 15000; // 15 seconds timeout
let lastSuccessfulModel = null; // Cache the last working model

// List of free models to cycle through for redundancy
const FREE_MODELS = [
    'google/gemini-2.0-flash-exp:free',
    'mistralai/mistral-7b-instruct:free',
    'nousresearch/hermes-3-llama-3.1-405b:free',
    'meta-llama/llama-3.2-3b-instruct:free',
    'qwen/qwen-2-7b-instruct:free'
];

// Fallback to low-cost paid models if free ones are rate-limited
const PAID_MODELS = [
    'google/gemini-flash-1.5', // Very cheap, reliable
    'openai/gpt-3.5-turbo',    // Affordable, fast
];

const ALL_MODELS = [...FREE_MODELS, ...PAID_MODELS];

// Helper to check cache
const getCachedData = async (key) => {
    try {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
            const { timestamp, data } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_EXPIRY) {
                return data; // Return fresh cache
            }
        }
    } catch (e) { console.log('Cache read error', e); }
    return null;
};

// Helper to set cache
const setCachedData = async (key, data) => {
    try {
        await AsyncStorage.setItem(key, JSON.stringify({
            timestamp: Date.now(),
            data
        }));
    } catch (e) { console.log('Cache write error', e); }
};

// Helper to add timeout to fetch requests
const fetchWithTimeout = (url, options, timeout = API_TIMEOUT) => {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), timeout)
        )
    ]);
};

export const getSafetyTips = async (latitude, longitude) => {
    // 1. Check Cache (Round to ~100m precision to ensure distinct tips for neighborhoods)
    const latKey = Number(latitude).toFixed(3);
    const lonKey = Number(longitude).toFixed(3);
    const cacheKey = `safety_tips_loc_${latKey}_${lonKey}`;

    const cached = await getCachedData(cacheKey);
    if (cached) {
        console.log('Using cached location tips');
        return cached;
    }

    // 2. Reverse Geocode
    let address = "current location";
    try {
        const reverseGeocoded = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (reverseGeocoded.length > 0) {
            const loc = reverseGeocoded[0];
            const parts = [loc.district, loc.city, loc.subregion, loc.region].filter(Boolean);
            address = parts.length > 0 ? parts.join(", ") : "this area";
        }
    } catch (e) {
        console.log("Geocoding failed", e);
    }

    // 3. Call AI
    const prompt = `I am currently in ${address}. Provide 5 specific safety tips for this location. 
    Focus on potential crime, safe travel times, and any known scams.`;

    const tips = await callOpenRouter(prompt);

    // Only cache if valid (not mock/error text)
    if (Array.isArray(tips) || (typeof tips === 'string' && !tips.includes("Unable to generate"))) {
        setCachedData(cacheKey, tips);
    }
    return tips;
};

export const getGeneralTips = async (category) => {
    const cacheKey = `safety_tips_cat_${category}`;
    const cached = await getCachedData(cacheKey);
    if (cached) {
        return cached;
    }

    const prompts = {
        night: "Give me 5 essential safety tips for traveling alone at night in a city.",
        transport: "Give me 5 safety tips for using public transport (buses, trains, taxis/cabs).",
        solo: "Give me 5 comprehensive safety tips for solo travelers.",
        emergency: "What are the 5 most important steps to take immediately during a street harassment incident or emergency situation?",
        women: "Give me 5 crucial safety tips specifically for women traveling alone in cities.",
        cyber: "Give me 5 essential cybersecurity tips for protecting personal data on mobile devices and public Wi-Fi."
    };

    const tips = await callOpenRouter(prompts[category] || "General safety tips");

    // Cache valid responses
    if (Array.isArray(tips) || (typeof tips === 'string' && !tips.includes("Unable to generate"))) {
        setCachedData(cacheKey, tips);
    }
    return tips;
}

async function callOpenRouter(prompt) {
    if (!OPENROUTER_API_KEY) {
        return getMockResponse();
    }

    // Prioritize last successful model
    let modelsToTry = [...ALL_MODELS];
    if (lastSuccessfulModel && modelsToTry.includes(lastSuccessfulModel)) {
        modelsToTry = [lastSuccessfulModel, ...modelsToTry.filter(m => m !== lastSuccessfulModel)];
        console.log(`🚀 Trying last successful model first: ${lastSuccessfulModel}`);
    }

    // Try multiple models in sequence (free first, then paid if needed)
    for (const model of modelsToTry) {
        try {
            console.log(`Requesting tips using model: ${model}`);
            const response = await fetchWithTimeout(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'HTTP-Referer': 'https://safesafar.app',
                    'X-Title': 'SafeSafar',
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: 'You are a Safety Assistant. Return the response strictly as a JSON Array of objects, where each object has a "title" and "description" key. Format: [{"title": "Tip Title", "description": "Details..."}]. Do not include markdown code blocks or introduction text.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.5, // Lower for faster, more focused responses
                    max_tokens: 800,  // Limit response length for speed
                })
            });

            const data = await response.json();

            if (data.error) {
                console.warn(`❌ Model ${model} error:`, data.error.message || data.error);
                if (data.error.metadata) {
                    console.log('Error metadata:', data.error.metadata);
                }
                continue;
            }



            if (data.choices && data.choices.length > 0) {
                let content = data.choices[0].message.content;
                console.log(`Response from ${model}:`, content.substring(0, 200));

                // Attempt to parse JSON with multiple strategies
                try {
                    // Strategy 1: Strip markdown code blocks
                    let cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

                    // Strategy 2: Try to find JSON array in the text
                    const jsonMatch = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
                    if (jsonMatch) {
                        cleaned = jsonMatch[0];
                    }

                    const parsed = JSON.parse(cleaned);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        const modelType = model.includes(':free') ? '🆓 FREE' : '💰 PAID';
                        console.log(`✅ Successfully parsed JSON from ${model} (${modelType})`);
                        lastSuccessfulModel = model; // Cache for next time
                        return parsed;
                    }
                } catch (e) {
                    console.log(`JSON parse failed for ${model}:`, e.message);
                    // Try next model
                }
            }
        } catch (error) {
            if (error.message === 'Request timeout') {
                console.warn(`⏱️ ${model} timed out after ${API_TIMEOUT / 1000}s`);
            } else {
                console.warn(`Failed with ${model}:`, error.message);
            }
        }
    }

    // Fallback logic
    console.error("All AI models failed or returned invalid JSON.");
    return getMockResponse(); // Return structured mock response
}

function getMockResponse() {
    return [
        { title: "Stay Aware", description: "Always keep your head up and observe your surroundings. Avoid distractions like phone use." },
        { title: "Share Location", description: "Use the 'Share Location' feature to keep trusted contacts updated on your whereabouts." },
        { title: "Trust Instincts", description: "If something feels wrong, leave the area immediately and seek a public space." },
        { title: "Secure Valuables", description: "Keep your phone and wallet safe in front pockets or a secure bag." },
        { title: "Know Emergency Numbers", description: "Dial 100 or 112 in India. Keep these numbers accessible." }
    ];
}
