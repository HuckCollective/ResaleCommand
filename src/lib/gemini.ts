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

const SYSTEM_INSTRUCTION = "You are a master multi-category resale appraiser and inventory valuation expert. Strictly ground all item identifications and conditions in physical OCR, printed copyright dates, and visible features from provided images or verified user notes.";

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
    let requestPayload: any;

    // Check if the first argument is a GenerativeModel instance
    if (modelOrRequest && typeof modelOrRequest === 'object' && typeof modelOrRequest.generateContent === 'function') {
        if (maybeRequestOrRetries !== undefined && typeof maybeRequestOrRetries !== 'number') {
            requestPayload = maybeRequestOrRetries;
        } else {
            throw new Error("[Gemini] generateContentWithBackoff received a GenerativeModel without a prompt or request payload.");
        }
    } else {
        requestPayload = modelOrRequest;
        if (typeof maybeRequestOrRetries === 'number') {
            maxRetries = maybeRequestOrRetries;
        }
    }

    // Safety check: ensure requestPayload is never a GenerativeModel or undefined
    if (!requestPayload || (typeof requestPayload === 'object' && typeof requestPayload.generateContent === 'function')) {
        throw new Error("[Gemini] Invalid generateContent request payload: payload cannot be a GenerativeModel or empty.");
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

/**
 * Universal JSON response parser for LLM outputs.
 * Robustly strips markdown fences (```json ... ```), extracts the outermost JSON
 * object or array, handles common formatting quirks (trailing commas, newlines),
 * and parses typed data with optional fallback.
 */
export function parseAiJson<T = any>(rawText: string, fallback?: T): T {
    if (!rawText || typeof rawText !== 'string') {
        if (fallback !== undefined) return fallback;
        throw new Error('[Gemini Parser] Empty or non-string response text received.');
    }

    // 1. Strip markdown fences if present
    let cleaned = rawText
        .replace(/^```(?:json)?\s*/im, '')
        .replace(/\s*```$/im, '')
        .trim();

    // 2. Try direct JSON.parse first (fast path)
    try {
        return JSON.parse(cleaned) as T;
    } catch {
        // Fall through to boundary extraction
    }

    // 3. Find outer JSON boundaries ({ ... } or [ ... ])
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    
    let startIndex = -1;
    let endIndex = -1;

    // Determine if array or object comes first
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        startIndex = firstBrace;
        endIndex = cleaned.lastIndexOf('}');
    } else if (firstBracket !== -1) {
        startIndex = firstBracket;
        endIndex = cleaned.lastIndexOf(']');
    }

    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        const extracted = cleaned.substring(startIndex, endIndex + 1);
        try {
            return JSON.parse(extracted) as T;
        } catch (extractErr: any) {
            // Attempt minor sanitization: strip trailing commas before } or ]
            const sanitized = extracted
                .replace(/,\s*([}\]])/g, '$1')
                .replace(/[\u0000-\u0019]+/g, ' '); // remove control chars
            try {
                return JSON.parse(sanitized) as T;
            } catch {
                if (fallback !== undefined) return fallback;
                throw new Error(`[Gemini Parser] Failed to parse extracted JSON block: ${extractErr.message}`);
            }
        }
    }

    if (fallback !== undefined) return fallback;
    throw new Error('[Gemini Parser] Could not find valid JSON object or array in AI response.');
}

/**
 * Universal plain-text response cleaner for LLM outputs.
 * Strips conversational preambles, accidental code block wrappers,
 * and excess blank lines.
 */
export function parseAiPlainText(rawText: string): string {
    if (!rawText || typeof rawText !== 'string') return '';

    let text = rawText.trim();

    // Strip markdown code fences if model accidentally wrapped output in ```markdown or ```
    if (text.startsWith('```')) {
        text = text.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
    }

    // Strip common conversational preambles (e.g., "Here is your post:", "Sure! Here is the caption:")
    const preambleRegex = /^(?:here(?:'s| is) (?:a |the |your )?(?:draft|post|caption|text|announcement|copy)?(?::|-|\n)+|sure!?[^\n]*\n+|certainly!?[^\n]*\n+)/i;
    text = text.replace(preambleRegex, '').trim();

    // Normalize multiple consecutive blank lines to at most two
    text = text.replace(/\n{3,}/g, '\n\n');

    return text;
}

