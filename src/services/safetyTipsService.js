import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Access the API key from environment variables
const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour

// List of free models to cycle through for redundancy
const FREE_MODELS = [
    'google/gemini-2.0-flash-exp:free',
    'meta-llama/llama-3-8b-instruct:free',
    'mistralai/mistral-7b-instruct:free',
    'huggingfaceh4/zephyr-7b-beta:free',
    'microsoft/phi-3-mini-128k-instruct:free'
];

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

    // Try multiple models in sequence
    for (const model of FREE_MODELS) {
        try {
            console.log(`Requesting tips using model: ${model}`);
            const response = await fetch(API_URL, {
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
                    temperature: 0.7,
                })
            });

            const data = await response.json();

            if (data.error) {
                console.warn(`Model ${model} error:`, data.error.message);
                continue;
            }

            if (data.choices && data.choices.length > 0) {
                let content = data.choices[0].message.content;
                // Attempt to parse JSON
                try {
                    // Strip code blocks if present
                    content = content.replace(/```json/g, '').replace(/```/g, '').trim();
                    const parsed = JSON.parse(content);
                    if (Array.isArray(parsed)) return parsed;
                } catch (e) {
                    // Failed to parse JSON, fallback to text format if needed
                    // But we really want JSON.
                    console.log("JSON parse failed, trying next model or returning text");
                }
            }
        } catch (error) {
            console.warn(`Failed with ${model}:`, error.message);
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
