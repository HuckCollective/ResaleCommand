/**
 * Shared Tokenized Search, Relevance Scoring & Zero-Circular-Import Inventory Store Bridge.
 * Leaf module — zero imports from composables or Appwrite SDKs.
 */

export interface InventoryStoreBridge {
    getSnapshot: () => any[];
    upsert: (docs: any[]) => void;
    patch: (ids: string[], updates: Record<string, any>) => void;
    remove: (ids: string[]) => void;
    preMark?: (ids: string[]) => void;
    beginWrite?: () => () => void;
}

let storeBridge: InventoryStoreBridge | null = null;

export function registerInventoryStoreBridge(bridge: InventoryStoreBridge): void {
    storeBridge = bridge;
}

export function getLiveInventorySnapshot(): any[] {
    try {
        return storeBridge ? storeBridge.getSnapshot() || [] : [];
    } catch {
        return [];
    }
}

export function notifyInventoryPreMutation(ids: string[]): void {
    if (!storeBridge?.preMark || !Array.isArray(ids) || ids.length === 0) return;
    const validIds = ids.filter((id) => typeof id === 'string' && id.trim().length > 0);
    if (validIds.length > 0) {
        storeBridge.preMark(validIds);
    }
}

export function beginInventoryWrite(): () => void {
    if (!storeBridge?.beginWrite) return () => {};
    return storeBridge.beginWrite();
}

export function notifyInventoryUpsert(docs: any[]): void {
    if (!storeBridge || !Array.isArray(docs) || docs.length === 0) return;
    const valid = docs.filter((d) => d && typeof d === 'object' && d.$id);
    if (valid.length > 0) {
        storeBridge.upsert(valid);
    }
}

export function notifyInventoryPatch(ids: string[], updates: Record<string, any>): void {
    if (!storeBridge || !Array.isArray(ids) || ids.length === 0 || !updates) return;
    const validIds = ids.filter((id) => typeof id === 'string' && id.trim().length > 0);
    if (validIds.length > 0) {
        storeBridge.patch(validIds, updates);
    }
}

export function notifyInventoryRemove(ids: string[]): void {
    if (!storeBridge || !Array.isArray(ids) || ids.length === 0) return;
    const validIds = ids.filter((id) => typeof id === 'string' && id.trim().length > 0);
    if (validIds.length > 0) {
        storeBridge.remove(validIds);
    }
}

/**
 * Canonical Purchase Order linkage keys for items and POs (excludes non-existent item.poNumber).
 */
export function getItemPurchaseLinkKeys(item: any): string[] {
    if (!item || typeof item !== 'object') return [];
    const seen = new Set<string>();
    for (const raw of [item.purchaseId, item.orderId, item.cartId]) {
        const clean = String(raw || '').trim();
        if (clean) seen.add(clean);
    }
    return Array.from(seen);
}

export function getPurchaseIdentityKeys(purchase: any): string[] {
    if (!purchase || typeof purchase !== 'object') return [];
    const seen = new Set<string>();
    for (const raw of [purchase.$id, purchase.orderId, purchase.poNumber]) {
        const clean = String(raw || '').trim();
        if (clean) seen.add(clean);
    }
    return Array.from(seen);
}

export type SearchPrefixType = 'upc' | 'barcode' | 'sku' | 'loc' | 'notes' | 'desc' | null;

export interface ParsedSearchQuery {
    raw: string;
    lower: string;
    isEmpty: boolean;
    isMultiSkuList: boolean;
    multiSkuTokens: string[];
    prefix: SearchPrefixType;
    prefixTarget: string;
    phrases: string[];
    tokens: string[];
    excludeTokens: string[];
}

export interface ScoreInventorySearchOptions {
    includeNotes?: boolean;
    vendorName?: string;
    matchesPurchaseLookup?: boolean;
}

export interface ProseMatchOrigin {
    field: 'description' | 'notes';
    snippet: string;
}

export interface InventorySearchScoreResult {
    matched: boolean;
    score: number;
    isProseOnly: boolean;
    proseOrigin: ProseMatchOrigin | null;
}

function extractPhrasesAndTokens(body: string): {
    phrases: string[];
    tokens: string[];
    excludeTokens: string[];
} {
    const phrases: string[] = [];
    const excludeTokens: string[] = [];
    const tokens: string[] = [];

    let rest = body;

    // 1. Negated quoted phrases: -"exact phrase"
    rest = rest.replace(/(?:^|\s)-"([^"]+)"/g, (_m, inner) => {
        const clean = String(inner || '').trim();
        if (clean) excludeTokens.push(clean);
        return ' ';
    });

    // 2. Positive quoted phrases: "exact phrase"
    rest = rest.replace(/"([^"]+)"/g, (_m, inner) => {
        const clean = String(inner || '').trim();
        if (clean) phrases.push(clean);
        return ' ';
    });

    // 3. Remaining whitespace-delimited tokens & -negated tokens
    for (const tok of rest.split(/\s+/).filter(Boolean)) {
        if (tok === '-' || tok === '--') continue;
        if (tok.startsWith('-') && tok.length > 1) {
            const cleanEx = tok.slice(1).trim();
            if (cleanEx) excludeTokens.push(cleanEx);
        } else {
            tokens.push(tok);
        }
    }

    return { phrases, tokens, excludeTokens };
}

export function parseSearchQuery(rawQuery: string): ParsedSearchQuery {
    const raw = String(rawQuery || '').trim();
    if (!raw) {
        return {
            raw: '',
            lower: '',
            isEmpty: true,
            isMultiSkuList: false,
            multiSkuTokens: [],
            prefix: null,
            prefixTarget: '',
            phrases: [],
            tokens: [],
            excludeTokens: [],
        };
    }

    const lower = raw.toLowerCase();

    if (raw.includes(',')) {
        const multi = raw
            .split(',')
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean);
        if (multi.length > 1) {
            return {
                raw,
                lower,
                isEmpty: false,
                isMultiSkuList: true,
                multiSkuTokens: multi,
                prefix: null,
                prefixTarget: '',
                phrases: [],
                tokens: [],
                excludeTokens: [],
            };
        }
    }

    let prefix: SearchPrefixType = null;
    let prefixTarget = '';
    const prefixMatch = lower.match(/^(upc|barcode|sku|loc|notes|desc):(.*)$/i);
    if (prefixMatch) {
        prefix = prefixMatch[1].toLowerCase() as SearchPrefixType;
        prefixTarget = prefixMatch[2].trim();
    }

    const body = prefix ? prefixTarget : lower;
    const { phrases, tokens, excludeTokens } = extractPhrasesAndTokens(body);

    return {
        raw,
        lower,
        isEmpty: false,
        isMultiSkuList: false,
        multiSkuTokens: [],
        prefix,
        prefixTarget,
        phrases,
        tokens,
        excludeTokens,
    };
}

const componentCache = new WeakMap<object, { raw: unknown; text: string }>();

function collectStructuredComponentStrings(node: any, out: string[]): void {
    if (node === null || node === undefined) return;
    if (typeof node === 'string') {
        const trimmed = node.trim();
        if (trimmed) out.push(trimmed);
        return;
    }
    if (Array.isArray(node)) {
        for (const el of node) {
            collectStructuredComponentStrings(el, out);
        }
        return;
    }
    if (typeof node === 'object') {
        const parts = [
            node.title,
            node.name,
            node.itemName,
            node.identity,
            node.upc,
            node.sku,
            node.locationSku,
        ];
        for (const p of parts) {
            if (p !== null && p !== undefined) {
                const s = String(p).trim();
                if (s) out.push(s);
            }
        }
        if (Array.isArray(node.items)) {
            collectStructuredComponentStrings(node.items, out);
        }
    }
}

/**
 * Extracts only structured lot sub-item identifiers (title, name, identity, upc, sku, locationSku)
 * from item.components so raw JSON keys and sub-item essays never trigger false-positive searches.
 */
export function extractComponentSearchText(item: any): string {
    if (!item || typeof item !== 'object') return '';
    const raw = item.components;
    if (raw === null || raw === undefined || raw === '') return '';

    const cached = componentCache.get(item);
    if (cached && cached.raw === raw) {
        return cached.text;
    }

    let text = '';
    if (Array.isArray(raw)) {
        const parts: string[] = [];
        collectStructuredComponentStrings(raw, parts);
        text = parts.join(' ').toLowerCase();
    } else if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
            try {
                const parsed = JSON.parse(trimmed);
                const parts: string[] = [];
                collectStructuredComponentStrings(parsed, parts);
                text = parts.join(' ').toLowerCase();
            } catch {
                text = trimmed.toLowerCase();
            }
        } else {
            text = trimmed.toLowerCase();
        }
    } else if (typeof raw === 'object') {
        const parts: string[] = [];
        collectStructuredComponentStrings(raw, parts);
        text = parts.join(' ').toLowerCase();
    } else {
        text = String(raw).toLowerCase();
    }

    componentCache.set(item, { raw, text });
    return text;
}

/**
 * Strips sync/scaffold boilerplate and system bracket tags from conditionNotes
 * while preserving genuine human condition notes and red-flag observations.
 */
export function sanitizeConditionNotesForSearch(notes?: string | null): string {
    if (!notes || typeof notes !== 'string') return '';
    return notes
        .replace(/created via booth sync/gi, ' ')
        .replace(
            /\[(?:MAIN IMAGE ID|IMAGE_ID|GALLERY IDS|RECEIPT ID|SCOUT_REPORT_ID|SCOUT_REPORT_MD|SCOUT_DATA|SCOUT_DATA_LITE|TAG_TITLE):[^\]]*\]/gi,
            ' '
        )
        .replace(/\[NEEDS_SHOP_UPDATE\]/gi, ' ')
        .replace(
            /^[ \t]*(?:Paid|Resale|Sold|Boutique|Location|Order\s*#|Est\.\s*Low|Est\.\s*High|Condition)[ \t]*:[ \t]*/gim,
            ''
        )
        .replace(/\s+/g, ' ')
        .trim();
}

function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsWholeWord(haystack: string, needle: string): boolean {
    if (!haystack || !needle) return false;
    const re = new RegExp(`(^|[^a-z0-9])${escapeRegExp(needle)}([^a-z0-9]|$)`, 'i');
    return re.test(haystack);
}

function buildProseSnippet(rawText: string, terms: string[]): string {
    const clean = String(rawText || '').replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    const lower = clean.toLowerCase();

    let hitIdx = -1;
    for (const t of terms) {
        if (!t) continue;
        const idx = lower.indexOf(t.toLowerCase());
        if (idx !== -1 && (hitIdx === -1 || idx < hitIdx)) {
            hitIdx = idx;
        }
    }

    if (hitIdx === -1) {
        return clean.length > 90 ? `${clean.slice(0, 89)}…` : clean;
    }

    const start = Math.max(0, hitIdx - 42);
    const end = Math.min(clean.length, hitIdx + 48);
    const prefix = start > 0 ? '…' : '';
    const suffix = end < clean.length ? '…' : '';
    return `${prefix}${clean.slice(start, end).trim()}${suffix}`;
}

export function scoreInventoryItemSearch(
    item: any,
    parsed: ParsedSearchQuery,
    opts?: ScoreInventorySearchOptions
): InventorySearchScoreResult {
    if (!parsed || parsed.isEmpty) {
        return { matched: true, score: 0, isProseOnly: false, proseOrigin: null };
    }

    const itemUpc = String(item?.upc || item?.sku || '').trim().toLowerCase();
    const itemLocSku = String(item?.locationSku || '').trim().toLowerCase().replace(/^'+/, '');
    const itemSkuFallback = String(item?.sku || '').trim().toLowerCase().replace(/^'+/, '');
    const titleLower = String(item?.title || item?.itemName || '').toLowerCase();
    const idLower = String(item?.$id || '').toLowerCase();
    const identityLower = String(item?.identity || '').toLowerCase();
    const binLower = String(item?.storageLocation || '').toLowerCase();
    const orderLower = String(item?.orderId || item?.sourceOrderId || '').toLowerCase();
    const cartLower = String(item?.cartId || '').toLowerCase();
    const purchaseLower = String(item?.purchaseId || '').toLowerCase();
    const sourcingLower = String(item?.sourcingLocation || '').toLowerCase();
    const vendorLower = String(opts?.vendorName || '').toLowerCase();
    const keywordsArr: string[] = Array.isArray(item?.keywords)
        ? item.keywords.map((k: any) => String(k).toLowerCase())
        : [];
    const componentsLower = extractComponentSearchText(item);
    const itemUpcDigits = itemUpc.replace(/\D/g, '');

    // Case A: Comma-separated multi-SKU list
    if (parsed.isMultiSkuList) {
        const hit = parsed.multiSkuTokens.some((tok) => {
            const cleanTok = tok.replace(/^'+/, '');
            return (
                itemUpc.includes(tok) ||
                (itemLocSku && itemLocSku.includes(cleanTok)) ||
                (itemSkuFallback && itemSkuFallback.includes(cleanTok)) ||
                titleLower.includes(tok) ||
                idLower.includes(tok)
            );
        });
        return hit
            ? { matched: true, score: 900, isProseOnly: false, proseOrigin: null }
            : { matched: false, score: 0, isProseOnly: false, proseOrigin: null };
    }

    // Case B: Explicit prefixes
    if (parsed.prefix === 'upc' || parsed.prefix === 'barcode' || parsed.prefix === 'sku') {
        const target = parsed.prefixTarget;
        if (!target) return { matched: true, score: 0, isProseOnly: false, proseOrigin: null };
        const cleanTarget = target.replace(/^'+/, '');
        const hit =
            itemUpc.includes(target) ||
            (itemLocSku && itemLocSku.includes(cleanTarget)) ||
            (itemSkuFallback && itemSkuFallback.includes(cleanTarget));
        return hit
            ? { matched: true, score: 950, isProseOnly: false, proseOrigin: null }
            : { matched: false, score: 0, isProseOnly: false, proseOrigin: null };
    }

    if (parsed.prefix === 'loc') {
        const target = parsed.prefixTarget;
        if (!target) return { matched: true, score: 0, isProseOnly: false, proseOrigin: null };
        const hit = binLower.includes(target);
        return hit
            ? { matched: true, score: 950, isProseOnly: false, proseOrigin: null }
            : { matched: false, score: 0, isProseOnly: false, proseOrigin: null };
    }

    if (parsed.prefix === 'notes' || parsed.prefix === 'desc') {
        if (!parsed.prefixTarget) {
            return { matched: true, score: 0, isProseOnly: false, proseOrigin: null };
        }
        const rawDesc = String(item?.marketDescription || '');
        const descLower = rawDesc.toLowerCase();
        const cleanNotes = sanitizeConditionNotesForSearch(item?.conditionNotes);
        const notesLower = cleanNotes.toLowerCase();
        const proseCombined = `${descLower} ${notesLower}`;

        if (parsed.excludeTokens.some((ex) => proseCombined.includes(ex))) {
            return { matched: false, score: 0, isProseOnly: false, proseOrigin: null };
        }

        const allTerms = [...parsed.phrases, ...parsed.tokens];
        if (allTerms.length === 0) {
            return { matched: true, score: 200, isProseOnly: false, proseOrigin: null };
        }

        const matchedAll = allTerms.every((t) => descLower.includes(t) || notesLower.includes(t));
        if (!matchedAll) {
            return { matched: false, score: 0, isProseOnly: false, proseOrigin: null };
        }

        const matchedDesc = allTerms.some((t) => descLower.includes(t));
        const proseOrigin: ProseMatchOrigin = matchedDesc
            ? { field: 'description', snippet: buildProseSnippet(rawDesc, allTerms) }
            : { field: 'notes', snippet: buildProseSnippet(cleanNotes, allTerms) };

        return { matched: true, score: 200, isProseOnly: true, proseOrigin };
    }

    // Case C: Standard tokenized query
    const coreExcludeHaystack = [
        titleLower,
        identityLower,
        itemUpc,
        itemLocSku,
        itemSkuFallback,
        binLower,
        keywordsArr.join(' '),
        componentsLower,
    ].join(' ');

    if (parsed.excludeTokens.some((ex) => coreExcludeHaystack.includes(ex))) {
        return { matched: false, score: 0, isProseOnly: false, proseOrigin: null };
    }

    const rawDesc = opts?.includeNotes ? String(item?.marketDescription || '') : '';
    const descLower = rawDesc.toLowerCase();
    const cleanNotes = opts?.includeNotes ? sanitizeConditionNotesForSearch(item?.conditionNotes) : '';
    const notesLower = cleanNotes.toLowerCase();

    if (opts?.includeNotes && parsed.excludeTokens.some((ex) => descLower.includes(ex) || notesLower.includes(ex))) {
        return { matched: false, score: 0, isProseOnly: false, proseOrigin: null };
    }

    const allTerms = [...parsed.phrases, ...parsed.tokens];
    if (allTerms.length === 0) {
        // Query contained only -negated exclusion terms
        return { matched: true, score: 100, isProseOnly: false, proseOrigin: null };
    }

    const isSingleToken = allTerms.length === 1 && parsed.phrases.length === 0;

    const termMatchesCore = (term: string): boolean => {
        if (
            titleLower.includes(term) ||
            idLower.includes(term) ||
            identityLower.includes(term) ||
            itemUpc.includes(term) ||
            (itemLocSku && itemLocSku.includes(term.replace(/^'+/, ''))) ||
            (itemSkuFallback && itemSkuFallback.includes(term.replace(/^'+/, ''))) ||
            binLower.includes(term) ||
            sourcingLower.includes(term) ||
            orderLower.includes(term) ||
            cartLower.includes(term) ||
            purchaseLower.includes(term) ||
            componentsLower.includes(term) ||
            vendorLower.includes(term) ||
            keywordsArr.some((k) => k.includes(term))
        ) {
            return true;
        }

        if (isSingleToken && opts?.matchesPurchaseLookup) {
            return true;
        }

        if (!term.includes(' ')) {
            const digits = term.replace(/\D/g, '');
            if (digits.length >= 1 && itemUpcDigits) {
                if (itemUpcDigits.endsWith(digits) || itemUpcDigits.includes(digits)) {
                    return true;
                }
                const padded = digits.padStart(4, '0');
                if (itemUpcDigits.endsWith(padded) || itemUpc.includes(padded)) {
                    return true;
                }
            }
        }

        return false;
    };

    const coreMatches = allTerms.every((t) => termMatchesCore(t));
    if (coreMatches) {
        const cleanQuery = parsed.lower.replace(/^'+/, '');
        let score = 350;

        if (
            itemUpc === parsed.lower ||
            (itemLocSku && itemLocSku === cleanQuery) ||
            (itemSkuFallback && itemSkuFallback === cleanQuery)
        ) {
            score = 1000;
        } else if (
            itemUpc.startsWith(parsed.lower) ||
            (itemLocSku && itemLocSku.startsWith(cleanQuery)) ||
            (itemSkuFallback && itemSkuFallback.startsWith(cleanQuery)) ||
            (parsed.tokens.length === 1 &&
                parsed.phrases.length === 0 &&
                /^\d+$/.test(parsed.tokens[0]) &&
                itemUpcDigits &&
                (itemUpcDigits.endsWith(parsed.tokens[0].padStart(4, '0')) || itemUpcDigits === parsed.tokens[0]))
        ) {
            score = 850;
        } else if (parsed.phrases.length === 0 && titleLower.startsWith(parsed.lower)) {
            score = 750;
        } else if (allTerms.every((t) => containsWholeWord(titleLower, t))) {
            score = 650;
        } else if (allTerms.every((t) => titleLower.includes(t))) {
            score = 500;
        }

        return { matched: true, score, isProseOnly: false, proseOrigin: null };
    }

    // Opt-in prose fallback
    if (opts?.includeNotes) {
        const matchedWithProse = allTerms.every(
            (t) => termMatchesCore(t) || descLower.includes(t) || notesLower.includes(t)
        );
        if (matchedWithProse) {
            const nonCoreTerms = allTerms.filter((t) => !termMatchesCore(t));
            const snippetTerms = nonCoreTerms.length > 0 ? nonCoreTerms : allTerms;
            const matchedDesc = snippetTerms.some((t) => descLower.includes(t));
            const proseOrigin: ProseMatchOrigin = matchedDesc
                ? { field: 'description', snippet: buildProseSnippet(rawDesc, snippetTerms) }
                : { field: 'notes', snippet: buildProseSnippet(cleanNotes, snippetTerms) };

            return { matched: true, score: 100, isProseOnly: true, proseOrigin };
        }
    }

    return { matched: false, score: 0, isProseOnly: false, proseOrigin: null };
}

/**
 * Lightweight tokenized matcher (multi-word, quoted phrases, -exclude) for /store and ledgers.
 */
export function matchesTokenizedFields(
    rawQuery: string,
    fields: Array<string | string[] | null | undefined>
): boolean {
    const parsed = parseSearchQuery(rawQuery);
    if (parsed.isEmpty) return true;

    const parts: string[] = [];
    for (const f of fields) {
        if (!f) continue;
        if (Array.isArray(f)) {
            for (const el of f) {
                if (el !== null && el !== undefined && el !== '') parts.push(String(el));
            }
        } else {
            parts.push(String(f));
        }
    }
    const haystack = parts.join(' ').toLowerCase();

    if (parsed.excludeTokens.some((ex) => haystack.includes(ex))) {
        return false;
    }

    if (parsed.isMultiSkuList) {
        return parsed.multiSkuTokens.some((tok) => haystack.includes(tok));
    }

    const bodyTerms = [...parsed.phrases, ...parsed.tokens];
    if (bodyTerms.length === 0) return true;
    return bodyTerms.every((t) => haystack.includes(t));
}
