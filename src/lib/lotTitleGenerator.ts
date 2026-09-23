/**
 * Generates intelligent, human-friendly titles for combined lots and bundles
 * by analyzing common tokens, themes, brands, and categories across items.
 */
export function generateSmartLotTitle(items: any[], totalQty: number): { defaultTitle: string; suggestions: string[] } {
    if (!items || items.length === 0) return { defaultTitle: `Main Lot (Qty: ${totalQty})`, suggestions: [] };

    // Clean individual title noise (e.g., "12pc", "Lot of 5", "Auction", SGW tags)
    const cleanTitles = items.map(i => {
        let t = (i.title || '').trim();
        t = t.replace(/^(lot of \d+|\d+\s*(?:pc|pcs|items?|piece|pieces|count|mags?|magazines?))\s*[:-]?\s*/gi, '');
        t = t.replace(/\s*\(?(?:lot of \d+|\d+\s*(?:pc|pcs|items?|piece|pieces|count))\)?/gi, '');
        t = t.replace(/\[[^\]]*\]/g, ''); // remove [tags]
        t = t.replace(/\b\d{6,}\b/g, ''); // remove long random numeric IDs
        return t.trim();
    }).filter(t => t.length > 0);

    // Token analysis for common keywords across all titles
    const stopWords = new Set(['and', 'the', 'for', 'with', 'from', 'vintage', 'rare', 'lot', 'set', 'pcs', 'piece', 'pieces', 'items', 'mixed', 'collection', 'huge', 'great', 'condition']);
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
        // Fallback to shared brand/category or primary clean title
        const sharedBrand = items.find(i => i.brand)?.brand;
        const sharedCat = items.find(i => i.category)?.category;
        theme = sharedBrand || sharedCat || cleanTitles[0] || 'Items';
    }

    // Capitalize words nicely
    theme = theme.replace(/\b\w/g, l => l.toUpperCase()).trim();

    // Generate formatted suggestions
    const suggestions: string[] = [];
    
    // Suggestion 1: Clean Subject (Lot of X)
    suggestions.push(`${theme} (Lot of ${totalQty})`);
    
    // Suggestion 2: Combined Lot of X: Theme
    suggestions.push(`Combined Lot of ${totalQty}: ${theme}`);
    
    // Suggestion 3: Mega Lot: Theme (X Items)
    suggestions.push(`${theme} Mega Lot (${totalQty} Items)`);

    // If 2-3 short distinct titles, offer combined titles
    if (cleanTitles.length >= 2 && cleanTitles.length <= 3) {
        const shortNames = cleanTitles.map(t => t.length > 22 ? t.slice(0, 20) + '...' : t).join(' + ');
        suggestions.push(`${shortNames} (Lot of ${totalQty})`);
    }

    const defaultTitle = suggestions[0] || `Main Lot of ${totalQty} Items`;
    return { defaultTitle, suggestions };
}
