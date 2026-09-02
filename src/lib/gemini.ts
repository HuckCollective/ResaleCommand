import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const getApiKey = () => {
    return (typeof import.meta !== 'undefined' && import.meta.env?.GEMINI_API_KEY) || 
           (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) || '';
};

export const RESALE_SAFETY_SETTINGS = [
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
];

const SYSTEM_INSTRUCTION = "You are a master appraiser and antique/vintage inventory specialist. CRITICAL DIRECTIVE: You must NEVER misidentify D&D 3.5e Premium Reprints (which feature a solitary embossed eye, lock, or globe on faux-leather) as '5e', 'Alternate Art', or 'Hydro74'. That specific artwork is explicitly 3.5e.";

export const getModel = (modelName = "gemini-2.5-flash") => {
    const key = getApiKey();
    if (!key) throw new Error("Gemini API key not configured (GEMINI_API_KEY)");
    const ai = new GoogleGenerativeAI(key);
    return ai.getGenerativeModel({ 
        model: modelName,
        safetySettings: RESALE_SAFETY_SETTINGS,
        systemInstruction: SYSTEM_INSTRUCTION
    });
};

export const genAI = getApiKey() ? new GoogleGenerativeAI(getApiKey()) : null;
export const model = getApiKey() ? getModel() : null;

// Helper to provide robust exponential backoff for generateContent calls with automatic fallback models
export const generateContentWithBackoff = async (
    modelOrRequest: any, 
    maybeRequestOrRetries?: any,
    maxRetries = 10, 
    baseDelayMs = 2500
) => {
    let requestPayload = modelOrRequest;
    if (Array.isArray(maybeRequestOrRetries) || (maybeRequestOrRetries && typeof maybeRequestOrRetries === 'object' && ('contents' in maybeRequestOrRetries || 'inlineData' in maybeRequestOrRetries))) {
        requestPayload = maybeRequestOrRetries;
    } else if (typeof maybeRequestOrRetries === 'number') {
        maxRetries = maybeRequestOrRetries;
    }

    const candidateModels = ["gemini-2.5-flash", "gemini-1.5-pro", "gemini-1.5-flash"];
    let modelIdx = 0;
    
    let retries = maxRetries;
    let delayMs = baseDelayMs;
    
    while (retries > 0) {
        const currentModelName = candidateModels[modelIdx] || "gemini-2.5-flash";
        const activeModel = getModel(currentModelName);
        
        try {
            const result = await activeModel.generateContent(requestPayload);
            // Verify candidate finishReason if blocked
            const candidate = result.response?.candidates?.[0];
            if (candidate?.finishReason === 'OTHER' || candidate?.finishReason === 'SAFETY') {
                console.warn(`[Gemini] Candidate finishReason is ${candidate.finishReason} on ${currentModelName}. Trying fallback model...`);
                if (modelIdx < candidateModels.length - 1) {
                    modelIdx++;
                    retries--;
                    continue;
                }
            }
            return result;
        } catch (err: any) {
            const msg = (err.message || "").toLowerCase();
            const status = err.status || 0;
            
            // Check if blocked by safety / OTHER / model-specific issue -> switch model immediately
            if (msg.includes('blocked') || msg.includes('other') || msg.includes('safety') || msg.includes('finishreason')) {
                console.warn(`[Gemini] Response blocked on ${currentModelName}: ${err.message}. Switching to fallback model...`);
                if (modelIdx < candidateModels.length - 1) {
                    modelIdx++;
                    retries--;
                    continue;
                }
            }

            // Catch 429, 503, 500, Resource Exhausted, and network fetch failures
            const isTransient = status === 429 || status === 503 || status === 500 || 
                                msg.includes('429') || msg.includes('503') || 
                                msg.includes('exhausted') || msg.includes('fetch failed') || msg.includes('overloaded');
                                
            if (isTransient && retries > 1) {
                const jitter = Math.floor(Math.random() * 1500);
                const waitTime = delayMs + jitter;
                
                console.warn(`[Gemini] ${status || 'Transient'} Error on ${currentModelName}. Retrying in ${(waitTime / 1000).toFixed(1)}s... (${retries - 1} left)`);
                await new Promise(res => setTimeout(res, waitTime));
                
                retries--;
                delayMs = Math.min(delayMs * 1.5, 30000);
            } else if (modelIdx < candidateModels.length - 1) {
                // If non-transient error, try next candidate model before giving up
                console.warn(`[Gemini] Error on ${currentModelName}: ${err.message}. Retrying with next model...`);
                modelIdx++;
                retries--;
            } else {
                throw err;
            }
        }
    }
    throw new Error("Failed to receive a valid response from the AI model after retries.");
};
