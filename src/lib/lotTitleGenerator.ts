import { cleanTagTitle, condenseTitleForTag } from './exportUtils';

/**
 * Generates intelligent, human-friendly titles for combined lots and batches
 * by analyzing common tokens, themes, brands, and categories across items.
 *
 * Ensures generated phrasing makes natural commercial sense (e.g. "Pair" for 2,
 * "Set of 3" for 3, "Lot of N" for 4+; never "Mega Lot" on small quantities).
 */
export function generateSmartLotTitle(items: any[], totalQty: number): { defaultTitle: string; suggestions: string[] } {
    if (!items || items.length === 0) {
        const qty = totalQty || 1;
        return { 
            defaultTitle: qty === 2 ? 'Inventory Pair (2-Pack)' : `Main Lot (${qty} Items)`, 
            suggestions: [] 
        };
    }

    const qty = totalQty || items.length || 1;

    // Clean individual title noise (e.g., "12pc", "Lot of 5", "Auction", SGW tags)
    const cleanTitles = items.map(i => {
        let t = (i.title || i.identity || '').trim();
        t = t.replace(/^(lot of \d+|\d+\s*(?:pc|pcs|items?|piece|pieces|count|mags?|magazines?))\s*[:-]?\s*/gi, '');
        t = t.replace(/\s*\(?(?:lot of \d+|\d+\s*(?:pc|pcs|items?|piece|pieces|count))\)?/gi, '');
        t = t.replace(/\[[^\]]*\]/g, ''); // remove [tags]
        t = t.replace(/\b\d{6,}\b/g, ''); // remove long random numeric IDs
        t = t.replace(/\s{2,}/g, ' ');
        return t.trim();
    }).filter(t => t.length > 0);

    // Stop words to exclude from thematic phrase detection
    const stopWords = new Set([
        'and', 'the', 'for', 'with', 'from', 'vintage', 'rare', 'lot', 'set', 
        'pcs', 'piece', 'pieces', 'items', 'mixed', 'collection', 'huge', 
        'great', 'condition', 'pre-owned', 'authentic', 'choice', 'bundle'
    ]);

    const tokenLists = cleanTitles.map(t => 
        t.toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2 && !stopWords.has(w))
    );

    // Find words common across all items
    const commonTokens = (tokenLists[0] || []).filter(token => 
        tokenLists.every(list => list.includes(token))
    );

    let theme = '';
    if (commonTokens.length > 0) {
        // Look for common continuous phrase in original title
        const primaryClean = cleanTitles[0];
        const phraseRegex = new RegExp(commonTokens.join('\\s+'), 'i');
        const match = primaryClean.match(phraseRegex);
        if (match) {
            theme = match[0];
        } else {
            theme = commonTokens.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }
    } else {
        // Fallback to shared brand/category or primary clean title subject
        const sharedBrand = items.find(i => i.brand)?.brand;
        const sharedCat = items.find(i => i.category)?.category;
        
        if (sharedBrand) {
            theme = sharedBrand;
        } else if (sharedCat && sharedCat !== 'General' && sharedCat !== 'Other') {
            theme = sharedCat;
        } else if (cleanTitles[0]) {
            // Strip after first separator
            const sepMatch = cleanTitles[0].match(/^(.*?)(?:\s+[-–—:|]\s+)/);
            theme = sepMatch && sepMatch[1].length >= 4 ? sepMatch[1].trim() : cleanTitles[0].slice(0, 30);
        } else {
            theme = 'Collectibles';
        }
    }

    // Capitalize words nicely
    theme = theme.replace(/\b\w/g, l => l.toUpperCase()).trim();

    const suggestions: string[] = [];

    // Sensible phrasing based on actual count
    if (qty === 1) {
        suggestions.push(theme);
        suggestions.push(`Single: ${theme}`);
    } else if (qty === 2) {
        suggestions.push(`${theme} Pair (2-Pack)`);
        suggestions.push(`${theme} (2-Piece Set)`);
        suggestions.push(`${theme} Duo`);
        // If 2 distinct clean titles that are short, pair them
        if (cleanTitles.length === 2) {
            const short1 = cleanTitles[0].split(/[-–—:|]/)[0].trim().slice(0, 24);
            const short2 = cleanTitles[1].split(/[-–—:|]/)[0].trim().slice(0, 24);
            if (short1 && short2 && short1.toLowerCase() !== short2.toLowerCase()) {
                suggestions.push(`${short1} & ${short2} (Pair)`);
            }
        }
    } else if (qty === 3) {
        suggestions.push(`${theme} Trio (3-Pack)`);
        suggestions.push(`${theme} (Set of 3)`);
        suggestions.push(`${theme} 3-Piece Lot`);
        if (cleanTitles.length === 3) {
            const s1 = cleanTitles[0].split(/[-–—:|]/)[0].trim().slice(0, 16);
            const s2 = cleanTitles[1].split(/[-–—:|]/)[0].trim().slice(0, 16);
            const s3 = cleanTitles[2].split(/[-–—:|]/)[0].trim().slice(0, 16);
            if (s1 && s2 && s3) {
                suggestions.push(`${s1} + ${s2} + ${s3} (Set of 3)`);
            }
        }
    } else if (qty >= 4 && qty <= 8) {
        suggestions.push(`${theme} (Lot of ${qty})`);
        suggestions.push(`${theme} (Set of ${qty})`);
        suggestions.push(`${theme} Multi-Pack (${qty} Items)`);
        suggestions.push(`Assorted ${theme} Collection (${qty} Pcs)`);
    } else {
        // 9+ items: legitimate bulk / volume lot
        suggestions.push(`${theme} Bulk Lot (${qty} Items)`);
        suggestions.push(`${theme} (Lot of ${qty})`);
        suggestions.push(`Large ${theme} Collection (${qty} Pcs)`);
    }

    const defaultTitle = suggestions[0] || `${theme} (Lot of ${qty})`;
    return { defaultTitle, suggestions };
}

/**
 * Generates intelligent, human-friendly titles for curated companion bundles
 * (cross-category lifestyle or complementary accessory sets).
 */
export function generateSmartBundleTitle(items: any[]): { defaultTitle: string; suggestions: string[] } {
    if (!items || items.length === 0) {
        return {
            defaultTitle: 'Curated Companion Bundle',
            suggestions: ['Curated Companion Bundle', 'Turnkey Gift Set']
        };
    }

    const count = items.length;

    // Identify primary hero item (highest price or first item)
    const sorted = [...items].sort((a, b) => {
        const pA = Number(a.resalePrice || a.price || a.cost || 0);
        const pB = Number(b.resalePrice || b.price || b.cost || 0);
        return pB - pA;
    });

    const lead = sorted[0];
    const second = sorted[1];

    const cleanLeadTitle = (lead.title || lead.identity || 'Collectible')
        .replace(/^(lot of \d+|\d+\s*(?:pc|pcs|items?|piece|pieces|count))\s*[:-]?\s*/gi, '')
        .replace(/\s*\(?[^)]*(?:lot|pc|pcs|count)[^)]*\)?/gi, '')
        .split(/[-–—:|]/)[0]
        .trim();

    const cleanSecondTitle = second ? (second.title || second.identity || 'Accessory')
        .replace(/^(lot of \d+|\d+\s*(?:pc|pcs|items?|piece|pieces|count))\s*[:-]?\s*/gi, '')
        .replace(/\s*\(?[^)]*(?:lot|pc|pcs|count)[^)]*\)?/gi, '')
        .split(/[-–—:|]/)[0]
        .trim() : '';

    // Detect shared brand or category
    const brand = items.find(i => i.brand)?.brand || '';
    const subject = brand || cleanLeadTitle.slice(0, 28);

    const suggestions: string[] = [];

    // Phrasing designed for companion bundles
    if (count === 2 && cleanSecondTitle) {
        const s1 = cleanLeadTitle.slice(0, 24);
        const s2 = cleanSecondTitle.slice(0, 24);
        suggestions.push(`${s1} with ${s2} Companion Set`);
        suggestions.push(`${subject} Curated Duo (2 Pieces)`);
        suggestions.push(`${s1} & ${s2} Starter Pack`);
    } else {
        suggestions.push(`${subject} Curated Companion Set (${count} Pieces)`);
        suggestions.push(`${subject} Starter Bundle (${count} Items)`);
        suggestions.push(`${subject} Turnkey Gift Set`);
        if (cleanSecondTitle) {
            suggestions.push(`${cleanLeadTitle.slice(0, 22)} + Companion Accessories (${count} Pcs)`);
        }
    }

    const defaultTitle = suggestions[0] || `${subject} Curated Bundle (${count} Items)`;
    return { defaultTitle, suggestions };
}

/**
 * Generates smart, human-friendly Short Sticker Tag Title suggestions
 * specifically formatted for physical 2"x1" thermal barcode labels (<= 38 chars).
 */
export function generateSmartTagTitleSuggestions(
    fullTitle: string, 
    options?: { 
        tagTitle?: string; 
        quantity?: number; 
        aiTagTitle?: string; 
        brand?: string 
    }
): string[] {
    const list: string[] = [];
    const seen = new Set<string>();

    const addIfValid = (raw: string | undefined | null) => {
        if (!raw || typeof raw !== 'string') return;
        const cleaned = cleanTagTitle(raw.trim());
        if (cleaned && cleaned.length >= 3 && cleaned.length <= 38 && !seen.has(cleaned.toLowerCase())) {
            seen.add(cleaned.toLowerCase());
            list.push(cleaned);
        }
    };

    // 1. Prioritize explicit AI Suggested Tag Title if provided
    if (options?.aiTagTitle) {
        addIfValid(options.aiTagTitle);
    }

    // 2. Intelligent regex condensed tag title from catalog full title
    if (fullTitle) {
        const condensed = condenseTitleForTag(fullTitle);
        addIfValid(condensed);

        // 3. Extract core subject if title has a separator (e.g. "Brand Item - Details")
        const sepMatch = fullTitle.match(/^(.*?)(?:\s+[-–—:|]\s+)/);
        if (sepMatch && sepMatch[1].trim().length >= 4) {
            addIfValid(sepMatch[1].trim());
        }

        // 4. Quantity / Pack format if batch listing (> 1)
        const qty = options?.quantity || 1;
        if (qty > 1) {
            const baseSubj = (sepMatch ? sepMatch[1] : condensed)
                .replace(/\s*\([^)]*\)/g, '')
                .replace(/\b(lot|set|pack|box)\b/gi, '')
                .trim();
            if (baseSubj && baseSubj.length <= 26) {
                addIfValid(`${baseSubj} (Choice of ${qty})`);
                addIfValid(`${baseSubj} (${qty} Pk)`);
            }
        }
    }

    // 5. Existing tag title if clean and different
    if (options?.tagTitle) {
        addIfValid(options.tagTitle);
    }

    return list.slice(0, 4);
}
