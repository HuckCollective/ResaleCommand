/**
 * Utility for handling API rate limits (HTTP 429 / AppwriteException) with exponential backoff and jitter.
 */

export interface RetryOptions {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    onRetry?: (attempt: number, delayMs: number, error: any) => void;
}

/**
 * Checks whether an error represents an HTTP 429 Rate Limit.
 */
export function isRateLimitError(err: any): boolean {
    if (!err) return false;
    if (err.code === 429 || err.status === 429 || err.statusCode === 429) return true;
    const msg = String(err.message || err).toLowerCase();
    return msg.includes('rate limit') || msg.includes('rate_limit') || msg.includes('429') || msg.includes('too many requests');
}

/**
 * Executes an async function with exponential backoff and jitter when encountering 429 rate limit errors.
 */
export async function withRateLimitRetry<T>(
    fn: () => Promise<T>,
    options?: RetryOptions
): Promise<T> {
    const maxRetries = options?.maxRetries ?? 5;
    const baseDelayMs = options?.baseDelayMs ?? 2000;
    const maxDelayMs = options?.maxDelayMs ?? 15000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err: any) {
            if (isRateLimitError(err) && attempt < maxRetries) {
                // Jitter: random 100-300ms
                const jitter = Math.floor(Math.random() * 200) + 100;
                const delayMs = Math.min(Math.round(baseDelayMs * Math.pow(1.6, attempt - 1)) + jitter, maxDelayMs);

                if (options?.onRetry) {
                    options.onRetry(attempt, delayMs, err);
                } else {
                    console.warn(`[RateLimit] 429 detected. Pausing for ${delayMs}ms before retry ${attempt}/${maxRetries}...`);
                }

                await new Promise(resolve => setTimeout(resolve, delayMs));
            } else {
                throw err;
            }
        }
    }
    throw new Error('Operation failed after maximum rate limit retries.');
}

/**
 * Simple pause helper for spacing consecutive requests.
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
