/**
 * Translates raw SDK, HTTP, or network errors into calm, reassuring Collective-voice messages
 * while callers log the full technical error via `console.warn` / `console.error`.
 *
 * Pure TypeScript — zero SDK imports (safe in browser, SSR, and §14D contexts).
 */

const TECHNICAL_LEAK_RE =
  /\b(?:appwrite|vercel|supabase|resale_db|coop_ledger|coop_proposals|itemssnapshot|jwt|localstorage|document with the requested id|general_argument_invalid|user_unauthorized)\b/i;

export function toUserMessage(
  err: unknown,
  fallback = "Couldn't save right now — please try again."
): string {
  const status = Number((err as any)?.status || (err as any)?.code || 0);
  const rawMsg =
    typeof err === 'string'
      ? err.trim()
      : err instanceof Error
        ? String(err.message || '').trim()
        : String((err as any)?.message || '').trim();

  if (status === 401 || /\b(?:401|jwt|session expired|unauthenticated)\b/i.test(rawMsg)) {
    return 'Your sign-in expired — please sign in again.';
  }
  if (status === 403 || /\b(?:403|not authorized|forbidden_role|unauthorized)\b/i.test(rawMsg)) {
    return "Your current Collective Hat doesn't include this action.";
  }
  if (status === 404 || /document with the requested id could not be found/i.test(rawMsg)) {
    return "That record couldn't be found — refresh and try again.";
  }
  if (status === 409 || /document_already_exists|already exists|version conflict/i.test(rawMsg)) {
    return 'Already saved — refresh to see the latest update.';
  }
  if (status === 429 || /rate limit|too many requests/i.test(rawMsg)) {
    return 'A lot is saving at once — wait a few seconds and tap Retry.';
  }
  if (status >= 500) {
    return fallback;
  }

  if (!rawMsg || TECHNICAL_LEAK_RE.test(rawMsg)) {
    return fallback;
  }

  return rawMsg;
}
