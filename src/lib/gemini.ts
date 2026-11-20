import {
    GoogleGenAI,
    HarmCategory,
    HarmBlockThreshold,
    ThinkingLevel,
    type GenerateContentConfig,
} from "@google/genai";
import {
    deliverAiTelemetry,
    type AiSurface,
    type AiTelemetryContext,
} from "./aiTelemetry";

export type { AiSurface, AiTelemetryContext };

/**
 * Single Source of Truth for Live App Runtime AI (World 1 — Reseller Engine).
 *
 * STRICT BOUNDARY:
 * - World 1 (App Runtime AI on $40/mo Google Cloud credits) lives ONLY here (`src/lib/gemini.ts`).
 * - World 2 (Dev & Architecture AI Tooling on Google AI Ultra) lives ONLY in `src/lib/devAiRouting.ts`.
 *
 * Powered by Google's unified `@google/genai` SDK (`GoogleGenAI`) behind a 100% drop-in
 * backward-compatible adapter (`getModel`, `generateContentWithBackoff`, `result.response.text()`)
 * with `thinkingConfig: { thinkingBudget }` support and rolling `-latest` fallback tiers.
 */

const getApiKey = (): string => {
    return (
        (typeof import.meta !== "undefined" && import.meta.env?.GEMINI_API_KEY) ||
        (typeof process !== "undefined" && process.env?.GEMINI_API_KEY) ||
        ""
    );
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

const SYSTEM_INSTRUCTION =
    "You are a master multi-category resale appraiser and inventory valuation expert. Strictly ground all item identifications and conditions in physical OCR, printed copyright dates, and visible features from provided images or verified user notes. Strictly ignore and exclude any auction website watermarks, platform logos, or copyright banners (such as 'Property of Goodwill', 'Goodwill NYNJ', 'ShopGoodwill.com', 'eBay', or 'HiBid') as they are website chrome and never part of the merchandise or manufacturer.";

export const DEFAULT_GEMINI_MODEL =
    (typeof process !== "undefined" && process.env?.GEMINI_MODEL) ||
    (typeof import.meta !== "undefined" && import.meta.env?.GEMINI_MODEL) ||
    "gemini-flash-latest";

/** Per-attempt timeout (ms) before failing over cleanly to the next valid API model. */
export const PER_ATTEMPT_TIMEOUT_MS = 25_000;

/** Ordered World-1 API fallback roster (strictly evergreen `-latest` Google GenAI API model IDs). */
export const GEMINI_FALLBACK_MODELS = [
    DEFAULT_GEMINI_MODEL,
    "gemini-flash-latest",
    "gemini-flash-lite-latest",
    "gemini-pro-latest",
] as const;

export type GeminiThinkingMode = "level" | "budget" | "omit";

export function initialThinkingModeForModel(modelName: string): "level" | "budget" {
    return /gemini-2\.5/i.test(String(modelName || "")) ? "budget" : "level";
}

function normalizeThinkingLevelEnum(rawLevel: any): ThinkingLevel | undefined {
    if (!rawLevel) return undefined;
    const upper = String(rawLevel).trim().toUpperCase();
    // Deprecated MINIMAL is normalized to LOW so modern Gemini Flash aliases never 400
    if (upper === "MINIMAL" || upper === "LOW") return ThinkingLevel.LOW;
    if (upper === "MEDIUM") return ThinkingLevel.MEDIUM;
    if (upper === "HIGH") return ThinkingLevel.HIGH;
    return undefined;
}

export function resolveThinkingConfigForMode(
    requestPayload: any,
    genCfg: any = {},
    mode: GeminiThinkingMode = "level"
): GenerateContentConfig["thinkingConfig"] | undefined {
    if (mode === "omit") return undefined;

    const explicitThinkingCfg = requestPayload?.thinkingConfig || genCfg?.thinkingConfig;
    const rawLevel =
        requestPayload?.thinkingLevel ??
        genCfg?.thinkingLevel ??
        explicitThinkingCfg?.thinkingLevel;
    const rawBudget =
        typeof requestPayload?.thinkingBudget === "number"
            ? requestPayload.thinkingBudget
            : typeof genCfg?.thinkingBudget === "number"
              ? genCfg.thinkingBudget
              : typeof explicitThinkingCfg?.thinkingBudget === "number"
                ? explicitThinkingCfg.thinkingBudget
                : undefined;
    const includeThoughts =
        typeof explicitThinkingCfg?.includeThoughts === "boolean"
            ? explicitThinkingCfg.includeThoughts
            : undefined;
    const hasStructuredSchema = Boolean(genCfg?.responseSchema || genCfg?.responseJsonSchema);

    if (mode === "level") {
        // Never emit thinkingBudget in level mode (mutually exclusive in Gemini API)
        let targetLevel = normalizeThinkingLevelEnum(rawLevel);
        if (!targetLevel && rawBudget !== undefined) {
            targetLevel =
                rawBudget <= 512
                    ? ThinkingLevel.LOW
                    : rawBudget <= 2048
                      ? ThinkingLevel.MEDIUM
                      : ThinkingLevel.HIGH;
        }
        if (!targetLevel && hasStructuredSchema) {
            targetLevel = ThinkingLevel.LOW;
        }
        if (!targetLevel) return undefined;
        return includeThoughts !== undefined
            ? { thinkingLevel: targetLevel, includeThoughts }
            : { thinkingLevel: targetLevel };
    }

    // Legacy 'budget' mode (never emit thinkingLevel alongside thinkingBudget)
    let targetBudget = rawBudget;
    if (targetBudget === undefined && rawLevel !== undefined) {
        const lvl = normalizeThinkingLevelEnum(rawLevel);
        if (lvl === ThinkingLevel.LOW) targetBudget = 0;
        else if (lvl === ThinkingLevel.MEDIUM) targetBudget = 1024;
        else if (lvl === ThinkingLevel.HIGH) targetBudget = 4096;
    }
    if (targetBudget === undefined && hasStructuredSchema) {
        targetBudget = 0;
    }
    if (targetBudget === undefined) return undefined;
    return includeThoughts !== undefined
        ? { thinkingBudget: targetBudget, includeThoughts }
        : { thinkingBudget: targetBudget };
}

/** Optional thinking token budget presets for `@google/genai` `thinkingConfig`. */
export const THINKING_BUDGET_PRESETS = {
    FAST_EXTRACTION: 0,
    BALANCED_SCOUT: 512,
    DEEP_LOT_ANALYSIS: 2048,
} as const;

export function getGenAiClient(): GoogleGenAI {
    const key = getApiKey();
    if (!key) throw new Error("Gemini API key not configured (GEMINI_API_KEY)");
    return new GoogleGenAI({
        apiKey: key,
        apiVersion: "v1beta",
        httpOptions: { apiVersion: "v1beta" },
    });
}

function wrapGenAiResponse(res: any) {
    const extractText = (): string => {
        if (typeof res?.text === "string") return res.text;
        const parts = res?.candidates?.[0]?.content?.parts || [];
        return parts
            .filter((p: any) => !p?.thought && typeof p?.text === "string")
            .map((p: any) => p.text)
            .join("");
    };

    return {
        response: {
            text: extractText,
            candidates: res?.candidates || [],
            usageMetadata: res?.usageMetadata,
            promptFeedback: res?.promptFeedback,
            modelVersion: res?.modelVersion,
        },
        raw: res,
    };
}

export function normalizeGenerateRequest(
    requestPayload: any,
    thinkingModeOrOmit: GeminiThinkingMode | boolean = "level"
): { contents: any; config: GenerateContentConfig } {
    const mode: GeminiThinkingMode =
        thinkingModeOrOmit === true
            ? "omit"
            : thinkingModeOrOmit === false
              ? "level"
              : thinkingModeOrOmit;
    const baseConfig: GenerateContentConfig = {
        safetySettings: RESALE_SAFETY_SETTINGS,
        systemInstruction: SYSTEM_INSTRUCTION,
    };

    if (typeof requestPayload === "string") {
        return { contents: requestPayload, config: baseConfig };
    }

    if (Array.isArray(requestPayload)) {
        const parts = requestPayload.map((item) =>
            typeof item === "string" ? { text: item } : item
        );
        return {
            contents: [{ role: "user", parts }],
            config: baseConfig,
        };
    }

    if (requestPayload && typeof requestPayload === "object") {
        const genCfg = requestPayload.generationConfig || requestPayload.config || {};
        const callerAbortSignal: AbortSignal | undefined =
            requestPayload.abortSignal || genCfg.abortSignal;
        const mergedConfig: GenerateContentConfig = {
            ...baseConfig,
            ...(requestPayload.safetySettings ? { safetySettings: requestPayload.safetySettings } : {}),
            ...(requestPayload.systemInstruction ? { systemInstruction: requestPayload.systemInstruction } : {}),
            ...(genCfg.responseMimeType ? { responseMimeType: genCfg.responseMimeType } : {}),
            ...(genCfg.responseSchema ? { responseSchema: genCfg.responseSchema } : {}),
            ...(genCfg.responseJsonSchema ? { responseJsonSchema: genCfg.responseJsonSchema } : {}),
            ...(genCfg.temperature !== undefined ? { temperature: genCfg.temperature } : {}),
            ...(genCfg.topP !== undefined ? { topP: genCfg.topP } : {}),
            ...(genCfg.topK !== undefined ? { topK: genCfg.topK } : {}),
            ...(genCfg.maxOutputTokens !== undefined ? { maxOutputTokens: genCfg.maxOutputTokens } : {}),
            ...(genCfg.stopSequences ? { stopSequences: genCfg.stopSequences } : {}),
            ...(genCfg.candidateCount !== undefined ? { candidateCount: genCfg.candidateCount } : {}),
            ...(genCfg.seed !== undefined ? { seed: genCfg.seed } : {}),
            ...(requestPayload.tools || genCfg.tools ? { tools: requestPayload.tools || genCfg.tools } : {}),
            ...(callerAbortSignal ? { abortSignal: callerAbortSignal } : {}),
        };

        const resolvedThinkingCfg = resolveThinkingConfigForMode(requestPayload, genCfg, mode);
        if (resolvedThinkingCfg) {
            mergedConfig.thinkingConfig = resolvedThinkingCfg;
        }

        const contents =
            "contents" in requestPayload
                ? requestPayload.contents
                : [{ role: "user", parts: [requestPayload] }];

        return { contents, config: mergedConfig };
    }

    throw new Error("[Gemini] Unsupported generateContent payload shape.");
}

export const getModel = (modelName = DEFAULT_GEMINI_MODEL) => {
    const ai = getGenAiClient();
    const initialMode = initialThinkingModeForModel(modelName);
    return {
        model: modelName,
        generateContent: async (payload: any) => {
            const { contents, config } = normalizeGenerateRequest(payload, initialMode);
            const res = await ai.models.generateContent({
                model: modelName,
                contents,
                config,
            });
            return wrapGenAiResponse(res);
        },
    };
};

export const genAI = getApiKey()
    ? new GoogleGenAI({
          apiKey: getApiKey(),
          apiVersion: "v1beta",
          httpOptions: { apiVersion: "v1beta" },
      })
    : null;
export const model = getApiKey() ? getModel() : null;

// Helper to extract verdict from JSON output when not explicitly supplied in telemetryContext
function inferVerdictFromText(rawText: string): string | null {
    if (!rawText || typeof rawText !== "string") return null;
    const m = /"(?:buy_recommendation|verdict)"\s*:\s*"([^"]+)"/i.exec(rawText);
    return m && m[1] ? m[1].trim() : null;
}

// Helper to provide robust exponential backoff for generateContent calls with automatic fallback models
export const generateContentWithBackoff = async (
    modelOrRequest: any,
    maybeRequestOrRetries?: any,
    maxRetries = 10,
    baseDelayMs = 2500,
    telemetryContext?: AiTelemetryContext
) => {
    let requestPayload: any;

    // Check if the first argument is a model wrapper instance
    if (
        modelOrRequest &&
        typeof modelOrRequest === "object" &&
        typeof modelOrRequest.generateContent === "function"
    ) {
        if (maybeRequestOrRetries !== undefined && typeof maybeRequestOrRetries !== "number") {
            requestPayload = maybeRequestOrRetries;
        } else {
            throw new Error(
                "[Gemini] generateContentWithBackoff received a model handle without a prompt or request payload."
            );
        }
    } else {
        requestPayload = modelOrRequest;
        if (typeof maybeRequestOrRetries === "number") {
            maxRetries = maybeRequestOrRetries;
        } else if (
            maybeRequestOrRetries &&
            typeof maybeRequestOrRetries === "object" &&
            !Array.isArray(maybeRequestOrRetries) &&
            ("surface" in maybeRequestOrRetries || "verdict" in maybeRequestOrRetries)
        ) {
            telemetryContext = maybeRequestOrRetries as AiTelemetryContext;
        }
    }

    const effectiveTelemetry: AiTelemetryContext | undefined =
        telemetryContext ||
        (requestPayload && typeof requestPayload === "object"
            ? (requestPayload.telemetryContext as AiTelemetryContext | undefined)
            : undefined);

    if (
        !requestPayload ||
        (typeof requestPayload === "object" && typeof requestPayload.generateContent === "function")
    ) {
        throw new Error(
            "[Gemini] Invalid generateContent request payload: payload cannot be a model handle or empty."
        );
    }

    const effectiveAttemptTimeoutMs =
        requestPayload &&
        typeof requestPayload === "object" &&
        typeof requestPayload.attemptTimeoutMs === "number" &&
        requestPayload.attemptTimeoutMs > 0
            ? requestPayload.attemptTimeoutMs
            : PER_ATTEMPT_TIMEOUT_MS;

    const candidateModels = Array.from(new Set(GEMINI_FALLBACK_MODELS));
    let modelIdx = 0;
    let thinkingMode: GeminiThinkingMode = initialThinkingModeForModel(
        candidateModels[0] || DEFAULT_GEMINI_MODEL
    );

    let retries = maxRetries;
    let delayMs = baseDelayMs;
    const ai = getGenAiClient();
    const callStartedAt = Date.now();

    const recordFailureTelemetry = async (modelName: string, verdictLabel: string) => {
        if (!effectiveTelemetry?.surface) return;
        await deliverAiTelemetry({
            surface: effectiveTelemetry.surface,
            model: String(modelName || DEFAULT_GEMINI_MODEL),
            verdict: verdictLabel,
            promptTokens: 0,
            candTokens: 0,
            thoughtTokens: 0,
            totalTokens: 0,
            latencyMs: Math.max(0, Date.now() - callStartedAt),
            fallback: true,
            rulesVersion: effectiveTelemetry.rulesVersion ?? null,
            itemId: effectiveTelemetry.itemId ?? null,
        });
    };

    while (retries > 0) {
        const currentModelName = candidateModels[modelIdx] || DEFAULT_GEMINI_MODEL;
        let callerAbortSignal: AbortSignal | undefined;
        let callerSuppliedAbort = false;

        try {
            const { contents, config } = normalizeGenerateRequest(
                requestPayload,
                thinkingMode
            );
            callerAbortSignal = config.abortSignal;
            callerSuppliedAbort = Boolean(callerAbortSignal);
            if (!callerSuppliedAbort) {
                if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
                    config.abortSignal = AbortSignal.timeout(effectiveAttemptTimeoutMs);
                }
                config.httpOptions = {
                    ...(config.httpOptions || {}),
                    timeout: effectiveAttemptTimeoutMs,
                };
            }

            const rawRes = await ai.models.generateContent({
                model: currentModelName,
                contents,
                config,
            });
            const result = wrapGenAiResponse(rawRes);

            // Verify candidate finishReason if blocked or output-truncated
            const candidate = result.response?.candidates?.[0];
            if (
                candidate?.finishReason === "OTHER" ||
                candidate?.finishReason === "SAFETY" ||
                candidate?.finishReason === "RECITATION" ||
                candidate?.finishReason === "MAX_TOKENS"
            ) {
                console.warn(
                    `[Gemini] Candidate finishReason is ${candidate.finishReason} on ${currentModelName}.`
                );
                if (retries > 1 && modelIdx < candidateModels.length - 1) {
                    modelIdx++;
                    thinkingMode = initialThinkingModeForModel(
                        candidateModels[modelIdx] || DEFAULT_GEMINI_MODEL
                    );
                    retries--;
                    continue;
                }
            }

            const usage: any = result.response?.usageMetadata || (rawRes as any)?.usageMetadata || {};
            const latencyMs = Math.max(0, Date.now() - callStartedAt);
            const textPreview = (() => {
                try {
                    return result.response.text();
                } catch {
                    return "";
                }
            })();

            await deliverAiTelemetry({
                surface: effectiveTelemetry?.surface || "other",
                model: String(result.response?.modelVersion || currentModelName),
                verdict: effectiveTelemetry?.verdict || inferVerdictFromText(textPreview),
                promptTokens: Number(usage.promptTokenCount) || 0,
                candTokens: Number(usage.candidatesTokenCount) || 0,
                thoughtTokens: Number(usage.thoughtsTokenCount) || 0,
                totalTokens: Number(usage.totalTokenCount) || 0,
                latencyMs,
                fallback: modelIdx > 0 || thinkingMode === "omit",
                rulesVersion: effectiveTelemetry?.rulesVersion ?? null,
                itemId: effectiveTelemetry?.itemId ?? null,
            });

            return result;
        } catch (err: any) {
            // Respect explicit caller cancellation before any retry/failover logic
            if (callerSuppliedAbort && callerAbortSignal?.aborted) {
                throw err;
            }

            const msg = (err.message || "").toLowerCase();
            const status = err.status || 0;

            // Fatal billing depleted or unauthorized -> no candidate model will work, throw immediately
            if (
                status === 402 ||
                status === 401 ||
                msg.includes("prepayment credits") ||
                msg.includes("payment required")
            ) {
                throw err;
            }

            // Per-attempt timeout -> advance modelIdx immediately with zero backoff sleep
            const errName = String(err?.name || "");
            const isAttemptTimeout =
                !callerSuppliedAbort &&
                (errName === "TimeoutError" ||
                    errName === "AbortError" ||
                    errName === "RequestTimeoutError" ||
                    msg.includes("timed out") ||
                    msg.includes("timeout") ||
                    msg.includes("aborted"));

            if (isAttemptTimeout) {
                const timeoutSec = Math.round(effectiveAttemptTimeoutMs / 1000);
                console.warn(
                    `[Gemini] ${timeoutSec}s per-attempt timeout on ${currentModelName} (${errName || "TimeoutError"}). Advancing to next fallback model immediately...`
                );
                if (retries > 1 && modelIdx < candidateModels.length - 1) {
                    modelIdx++;
                    thinkingMode = initialThinkingModeForModel(
                        candidateModels[modelIdx] || DEFAULT_GEMINI_MODEL
                    );
                    retries--;
                    continue;
                }
                await recordFailureTelemetry(currentModelName, "TIMEOUT");
                throw new Error(
                    `AI appraisal timed out after ${timeoutSec} seconds per attempt. Please try again or reduce the number of photos.`
                );
            }

            // Bounded 3-mode thinking negotiation: 'level' -> 'budget' -> 'omit' (never drops thinking prematurely or loops)
            if (thinkingMode !== "omit" && (msg.includes("thinking") || msg.includes("thought"))) {
                const nextMode: GeminiThinkingMode = thinkingMode === "level" ? "budget" : "omit";
                console.warn(
                    `[Gemini] ${currentModelName} rejected thinkingConfig in '${thinkingMode}' mode; negotiating '${nextMode}' mode...`
                );
                thinkingMode = nextMode;
                continue;
            }

            // Check if model not found (404) or blocked by safety / OTHER / RECITATION -> switch model immediately
            if (
                status === 404 ||
                msg.includes("404") ||
                msg.includes("not found") ||
                msg.includes("blocked") ||
                msg.includes("other") ||
                msg.includes("safety") ||
                msg.includes("recitation") ||
                msg.includes("finishreason")
            ) {
                console.warn(
                    `[Gemini] Model issue on ${currentModelName}: ${err.message}. Switching to fallback model...`
                );
                if (retries > 1 && modelIdx < candidateModels.length - 1) {
                    modelIdx++;
                    thinkingMode = initialThinkingModeForModel(
                        candidateModels[modelIdx] || DEFAULT_GEMINI_MODEL
                    );
                    retries--;
                    continue;
                }
            }

            // Catch 429, 503, 500, Resource Exhausted, and network fetch failures
            const isTransient =
                status === 429 ||
                status === 503 ||
                status === 500 ||
                msg.includes("429") ||
                msg.includes("503") ||
                msg.includes("exhausted") ||
                msg.includes("fetch failed") ||
                msg.includes("overloaded");

            if (isTransient && retries > 1) {
                const jitter = Math.floor(Math.random() * 1500);
                const waitTime = delayMs + jitter;

                console.warn(
                    `[Gemini] ${status || "Transient"} Error on ${currentModelName}. Retrying in ${(waitTime / 1000).toFixed(1)}s... (${retries - 1} left)`
                );
                await new Promise((res) => setTimeout(res, waitTime));

                retries--;
                delayMs = Math.min(delayMs * 1.5, 30000);
            } else if (retries > 1 && modelIdx < candidateModels.length - 1) {
                console.warn(
                    `[Gemini] Error on ${currentModelName}: ${err.message}. Retrying with next model...`
                );
                modelIdx++;
                thinkingMode = initialThinkingModeForModel(
                    candidateModels[modelIdx] || DEFAULT_GEMINI_MODEL
                );
                retries--;
            } else {
                await recordFailureTelemetry(currentModelName, "ERROR");
                throw err;
            }
        }
    }
    await recordFailureTelemetry(candidateModels[modelIdx] || DEFAULT_GEMINI_MODEL, "ERROR");
    throw new Error("Failed to receive a valid response from the AI model after retries.");
};

/**
 * Universal JSON response parser for LLM outputs.
 * Robustly strips markdown fences (```json ... ```), extracts the outermost JSON
 * object or array, handles common formatting quirks (trailing commas, newlines),
 * and parses typed data with optional fallback.
 */
export function parseAiJson<T = any>(rawText: string, fallback?: T): T {
    if (!rawText || typeof rawText !== "string") {
        if (fallback !== undefined) return fallback;
        throw new Error("[Gemini Parser] Empty or non-string response text received.");
    }

    // 1. Strip markdown fences if present
    const cleaned = rawText
        .replace(/^```(?:json)?\s*/im, "")
        .replace(/\s*```$/im, "")
        .trim();

    // 2. Try direct JSON.parse first (fast path)
    try {
        return JSON.parse(cleaned) as T;
    } catch {
        // Fall through to boundary extraction
    }

    // 3. Find outer JSON boundaries ({ ... } or [ ... ])
    const firstBrace = cleaned.indexOf("{");
    const firstBracket = cleaned.indexOf("[");

    let startIndex = -1;
    let endIndex = -1;

    // Determine if array or object comes first
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        startIndex = firstBrace;
        endIndex = cleaned.lastIndexOf("}");
    } else if (firstBracket !== -1) {
        startIndex = firstBracket;
        endIndex = cleaned.lastIndexOf("]");
    }

    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        const extracted = cleaned.substring(startIndex, endIndex + 1);
        try {
            return JSON.parse(extracted) as T;
        } catch (extractErr: any) {
            // Attempt minor sanitization: strip trailing commas before } or ]
            const sanitized = extracted
                .replace(/,\s*([}\]])/g, "$1")
                .replace(/[\u0000-\u0019]+/g, " "); // remove control chars
            try {
                return JSON.parse(sanitized) as T;
            } catch {
                if (fallback !== undefined) return fallback;
                throw new Error(
                    `[Gemini Parser] Failed to parse extracted JSON block: ${extractErr.message}`
                );
            }
        }
    }

    if (fallback !== undefined) return fallback;
    throw new Error("[Gemini Parser] Could not find valid JSON object or array in AI response.");
}

/**
 * Universal plain-text response cleaner for LLM outputs.
 * Strips conversational preambles, accidental code block wrappers,
 * and excess blank lines.
 */
export function parseAiPlainText(rawText: string): string {
    if (!rawText || typeof rawText !== "string") return "";

    let text = rawText.trim();

    // Strip markdown code fences if model accidentally wrapped output in ```markdown or ```
    if (text.startsWith("```")) {
        text = text.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
    }

    // Strip common conversational preambles (e.g., "Here is your post:", "Sure! Here is the caption:")
    const preambleRegex =
        /^(?:here(?:'s| is) (?:a |the |your )?(?:draft|post|caption|text|announcement|copy)?(?::|-|\n)+|sure!?[^\n]*\n+|certainly!?[^\n]*\n+)/i;
    text = text.replace(preambleRegex, "").trim();

    // Normalize multiple consecutive blank lines to at most two
    text = text.replace(/\n{3,}/g, "\n\n");

    return text;
}
