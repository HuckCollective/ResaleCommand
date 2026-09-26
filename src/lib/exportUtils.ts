/**
 * Export utilities for generating marketplace-specific CSV formats.
 */

export type ExportFormat = 'generic' | 'ebay' | 'poshmark' | 'ricochet';

/**
 * Helper to escape CSV strings
 */
const escapeCsv = (str: any) => {
    if (str === null || str === undefined) return '';
    return `"${String(str).replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
};

/**
 * Generate standard generic export
 */
export function generateGenericCsv(items: any[]): string {
    const headers = ['ID', 'UPC / SKU', 'Title', 'Status', 'Cost', 'Resale Price', 'Est. Value', 'Location', 'Condition Notes', 'Keywords', 'Date Added'];
    
    const rows = items.map(item => [
        item.$id,
        item.upc || item.sku || item.$id,
        item.title || '',
        item.status || '',
        item.cost ?? '',
        item.resalePrice ?? '',
        item.estValue ?? '',
        item.storageLocation || '',
        item.conditionNotes || '',
        (item.keywords || []).join('; '),
        item.$createdAt ? new Date(item.$createdAt).toLocaleDateString() : ''
    ]);

    const csvContent = [headers, ...rows]
        .map(row => row.map(val => escapeCsv(val)).join(','))
        .join('\n');

    return csvContent;
}

/**
 * Generate eBay File Exchange / Seller Hub Report CSV
 * Standard required fields for eBay bulk upload.
 */
export function generateEbayCsv(items: any[]): string {
    // Basic eBay Seller Hub headers
    const headers = [
        '*Action(SiteID=US|Country=US|Currency=USD|Version=1193)',
        '*Category',
        '*Title',
        '*Description',
        '*ConditionID',
        'PicURL',
        '*Quantity',
        '*Format',
        '*StartPrice',
        '*Duration',
        '*Location',
        'CustomLabel', // SKU
        'C:Country/Region of Manufacture'
    ];

    const rows = items.map(item => {
        // Build description combining notes and analysis if available
        let desc = item.conditionNotes || '';
        let country = '';
        if (item.rawAnalysis) {
            try {
                const ai = JSON.parse(item.rawAnalysis);
                const aiObj = Array.isArray(ai) ? ai[0] : ai;
                if (aiObj && aiObj.condition_notes) {
                    desc = aiObj.condition_notes + '\n\n' + desc;
                }
                if (aiObj && aiObj.country_of_origin && aiObj.country_of_origin !== 'Unknown') {
                    country = aiObj.country_of_origin;
                }
            } catch (e) {}
        }

        const rawPrice = item.resalePrice || item.listPrice || item.estValue || item.cost || 0;
        const cleanPrice = String(rawPrice).replace(/[^0-9.]/g, '') || '';

        return [
            'Add', // Action
            '', // Category (Must be filled by user usually, or mapped)
            (item.title || '').substring(0, 80), // Max 80 chars
            desc, // Description
            '3000', // Default ConditionID (Used)
            '', // PicURL (Would map to our public image URL if enabled)
            item.quantity || 1, // Quantity
            'FixedPrice', // Format
            cleanPrice, // StartPrice
            'GTC', // Duration (Good 'Til Cancelled)
            item.storageLocation || 'US', // Location
            item.upc || item.sku || item.$id, // CustomLabel / SKU
            country // C:Country/Region of Manufacture
        ];
    });

    const csvContent = [headers, ...rows]
        .map(row => row.map(val => escapeCsv(val)).join(','))
        .join('\n');

    return csvContent;
}

/**
 * Generate Poshmark Bulk Upload CSV
 */
export function generatePoshmarkCsv(items: any[]): string {
    const headers = [
        'Department',
        'Category',
        'Subcategory',
        'Size',
        'Brand',
        'Color',
        'New With Tags',
        'Title',
        'Description',
        'Price',
        'Original Price',
        'SKU'
    ];

    const rows = items.map(item => {
        let desc = item.conditionNotes || '';
        if (item.rawAnalysis) {
            try {
                const ai = JSON.parse(item.rawAnalysis);
                const aiObj = Array.isArray(ai) ? ai[0] : ai;
                if (aiObj && aiObj.condition_notes) {
                    desc = aiObj.condition_notes + '\n\n' + desc;
                }
            } catch (e) {}
        }

        const rawPrice = item.resalePrice || item.listPrice || item.estValue || item.cost || 0;
        const cleanPrice = String(rawPrice).replace(/[^0-9.]/g, '') || '';

        return [
            '', // Department
            '', // Category
            '', // Subcategory
            'OS', // Size (Default One Size)
            '', // Brand
            '', // Color
            'No', // New With Tags
            (item.title || '').substring(0, 50), // Title max 50 chars for Poshmark
            desc, // Description
            cleanPrice, // Price
            '0', // Original Price
            item.upc || item.sku || item.$id // SKU
        ];
    });

    const csvContent = [headers, ...rows]
        .map(row => row.map(val => escapeCsv(val)).join(','))
        .join('\n');

    return csvContent;
}

/**
 * Helper to strip internal Resale Command tags, database IDs, and diagnostic notes
 * from customer-facing and POS descriptions.
 */
export function sanitizeRicochetDescription(text: string | null | undefined): string {
    if (!text) return '';
    return text
        .replace(/\[[A-Z0-9_ ]+:[^\]]+\]/gi, '') // e.g. [MAIN IMAGE ID: ...], [RECEIPT ID: ...]
        .replace(/--- IMPORT DETAILS ---[\s\S]*/gi, '')
        .replace(/(Paid|Resale|Sold|Location|Est\. Low|Est\. High|Condition|Order #):[^\n]*/gi, '')
        .replace(/https?:\/\/[^\s]+/gi, '') // strip internal URLs
        .replace(/[\r\n"\\]+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

/**
 * Checks if a SKU or UPC matches the organization prefix (e.g. HUCK-1460)
 */
export function isOrgUpc(upc: string | null | undefined, prefix: string = 'HUCK'): boolean {
    if (!upc) return false;
    const clean = upc.trim().toUpperCase();
    const cleanPrefix = prefix.replace(/[-_]$/, '').toUpperCase();
    return clean.startsWith(`${cleanPrefix}-`) || clean.startsWith(cleanPrefix);
}

export interface RicochetExportOptions {
    orgPrefix?: string; // e.g. 'HUCK'
    unsyncedOnly?: boolean; // filter out items already verified in Ricochet
    syncedUpcs?: Set<string> | string[]; // Set/Array of SKUs already in Ricochet
}

/**
 * Helper to derive a clean, short physical booth tag title (<= 38 chars)
 * tailored specifically for thermal label rolls (e.g. Memory Den / DustyTiger).
 */
export function extractShortTagTitle(item: any): string {
    // 1. Direct explicit tagTitle from item document or draft
    if (item.tagTitle && typeof item.tagTitle === 'string' && item.tagTitle.trim()) {
        return cleanTagTitle(item.tagTitle);
    }
    if (item.tag_title && typeof item.tag_title === 'string' && item.tag_title.trim()) {
        return cleanTagTitle(item.tag_title);
    }

    // 2. Check AI Deep Scan / Speed Scout rawAnalysis
    if (item.rawAnalysis) {
        try {
            const ai = typeof item.rawAnalysis === 'string' ? JSON.parse(item.rawAnalysis) : item.rawAnalysis;
            const aiObj = Array.isArray(ai) ? ai[0] : ai;
            if (aiObj && (aiObj.tag_title || aiObj.tagTitle)) {
                return cleanTagTitle(aiObj.tag_title || aiObj.tagTitle);
            }
        } catch (e) {}
    }

    // 3. Intelligently condense the full title if no explicit tag title exists
    const full = (item.title || item.identity || 'Inventory Item').trim();
    return condenseTitleForTag(full);
}

function cleanTagTitle(title: string): string {
    return title
        .replace(/["\\]/g, '')
        .replace(/^[📦🛍️🏷️✨]\s*/, '')
        .replace(/ - Multi-Quantity Lot Run of \d+ Issues/i, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .substring(0, 38);
}

function condenseTitleForTag(title: string): string {
    let t = title
        .replace(/["\\]/g, '')
        .replace(/^[📦🛍️🏷️✨]\s*/, '')
        .replace(/ - Multi-Quantity Lot Run of \d+ Issues/i, '')
        .replace(/\b(Women's|Mens'|Men's|Womens)\b/gi, '')
        .replace(/\b(Vintage Style|Pre-owned|Gently Used)\b/gi, '')
        .replace(/\bSize\s*([0-9]+|[SMLX]+)\b/gi, '($1)')
        .replace(/\s{2,}/g, ' ')
        .trim();

    if (t.length <= 38) return t;

    // Check if there is a dash / separator: "Brand Item - Extra Details"
    const sepMatch = t.match(/^(.*?)(?:\s+[-–—:|]\s+)/);
    if (sepMatch && sepMatch[1].length >= 8 && sepMatch[1].length <= 38) {
        return sepMatch[1].trim();
    }

    // Try stripping parenthetical details
    const strippedParens = t.replace(/\s*\([^)]*\)/g, '').replace(/\s{2,}/g, ' ').trim();
    if (strippedParens.length >= 8 && strippedParens.length <= 38) {
        return strippedParens;
    }

    // If still over 38 chars, truncate cleanly at nearest word boundary
    const base = strippedParens.length >= 12 ? strippedParens : t;
    const cut = base.substring(0, 36);
    const lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > 14 ? cut.substring(0, lastSpace) : cut).trim();
}

/**
 * Generate Ricochet Consign New Inventory Import CSV
 * Exact official template matching ricoconsign.com (Consigned Inventory)
 *
 * MAPPING STANDARD:
 * - SKU: Clean org barcode (e.g. HUCK-1460)
 * - Item Title: Short & sweet booth tag title (<= 38 chars) for physical thermal label stickers
 * - Description: Full longer product name / title (for POS register search, cashier screen & receipts)
 * - Web Description: Rich market writeup + condition notes for e-commerce
 */
export function generateRicochetCsv(items: any[], options?: RicochetExportOptions): string {
    const headers = [
        'SKU',
        'Item Title',
        'Description',
        'Web Description',
        'Price',
        'Quantity',
        'In-Stock Date',
        'Category',
        'Brand'
    ];

    const todayStr = new Date().toLocaleDateString('en-US'); // e.g. 8/30/2026
    const orgPrefix = (options?.orgPrefix || 'HUCK').replace(/[-_]$/, '').toUpperCase();

    const syncedSet = new Set(
        Array.isArray(options?.syncedUpcs)
            ? options.syncedUpcs.map(s => String(s).trim().toUpperCase())
            : options?.syncedUpcs
                ? Array.from(options.syncedUpcs).map(s => String(s).trim().toUpperCase())
                : []
    );

    const filteredItems = items.filter(item => {
        if (options?.unsyncedOnly) {
            const upc = (item.upc || item.sku || '').trim().toUpperCase();
            if (upc && syncedSet.has(upc)) return false;
            if (item.ricochetSynced === true) return false;
        }
        return true;
    });

    const rows = filteredItems.map(item => {
        let conditionText = item.conditionNotes || item.condition_notes || '';
        let webDesc = item.marketDescription || item.description || '';
        let brandStr = '';
        let catStr = 'Vintage Collectibles';

        if (item.rawAnalysis) {
            try {
                const ai = typeof item.rawAnalysis === 'string' ? JSON.parse(item.rawAnalysis) : item.rawAnalysis;
                const aiObj = Array.isArray(ai) ? ai[0] : ai;
                if (aiObj && aiObj.condition_notes) {
                    conditionText = aiObj.condition_notes;
                }
                if (aiObj && aiObj.keywords && Array.isArray(aiObj.keywords) && aiObj.keywords.length > 0) {
                    brandStr = aiObj.keywords[0];
                    catStr = aiObj.keywords[1] || catStr;
                }
            } catch (e) {}
        }

        // 1. Physical Barcode Sticker Title (Short & sweet, strictly <= 38 chars)
        const tagTitle = extractShortTagTitle(item);

        // 2. POS Register & Receipt Description (The full, longer descriptive name!)
        const fullItemName = (item.title || item.identity || tagTitle)
            .replace(/["\\]/g, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
        const cleanPosDescription = sanitizeRicochetDescription(fullItemName).substring(0, 250);

        // 3. Web Description (Full catalog description + condition disclosure appended)
        let fullWebText = webDesc || fullItemName;
        if (conditionText && conditionText.trim() && conditionText.trim() !== fullItemName) {
            const cleanCond = sanitizeRicochetDescription(conditionText);
            if (cleanCond) {
                fullWebText = fullWebText ? `${fullWebText} | Condition: ${cleanCond}` : `Condition: ${cleanCond}`;
            }
        }
        const cleanWebDesc = sanitizeRicochetDescription(fullWebText).substring(0, 500);

        // 4. Clean Numeric Price
        const rawPrice = item.resalePrice || item.listPrice || item.estValue || item.cost || 0;
        const cleanPrice = String(rawPrice).replace(/[^0-9.]/g, '') || '0.00';

        // 5. Ensure SKU strictly uses valid org prefix (never raw Appwrite ID)
        let sku = (item.upc || item.sku || '').trim().toUpperCase();
        if (!sku || sku.length > 18 || !isOrgUpc(sku, orgPrefix)) {
            if (item.upc && /^[A-Z]{2,6}-\d+/i.test(item.upc)) {
                sku = item.upc.trim().toUpperCase();
            } else {
                const digits = (sku || item.$id || '').replace(/[^0-9]/g, '').slice(-4);
                sku = `${orgPrefix}-${digits || '1001'}`;
            }
        }

        return [
            sku, // SKU strictly formatted with org prefix (e.g. HUCK-1460)
            tagTitle, // Item Title (short & sweet: fits physical barcode sticker tag without wrapping)
            cleanPosDescription, // Description (longer descriptive name: shown on POS register screen & receipt)
            cleanWebDesc, // Web Description (clean e-commerce writeup + condition disclosure)
            cleanPrice, // Price (clean decimal, no $)
            item.quantity || 1, // Quantity
            todayStr, // In-Stock Date
            '', // Category (leave blank so Ricochet uses default/consignor category without format errors)
            (brandStr || 'Vintage').replace(/["\\]/g, '') // Brand
        ];
    });

    const csvContent = [headers, ...rows]
        .map(row => row.map(val => escapeCsv(val)).join(','))
        .join('\n');

    return csvContent;
}

/**
 * Trigger file download in browser
 */
export function downloadCsv(csvContent: string, filename: string) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        if (document.body.contains(a)) {
            document.body.removeChild(a);
        }
        URL.revokeObjectURL(url);
    }, 150);
}

