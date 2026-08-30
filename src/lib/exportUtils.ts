/**
 * Export utilities for generating marketplace-specific CSV formats.
 */

export type ExportFormat = 'generic' | 'ebay' | 'poshmark' | 'ricochet';

/**
 * Helper to escape CSV strings
 */
const escapeCsv = (str: any) => {
    if (str === null || str === undefined) return '';
    return `"${String(str).replace(/"/g, '""').replace(/\n/g, ' ')}"`;
};

/**
 * Generate standard generic export
 */
export function generateGenericCsv(items: any[]): string {
    const headers = ['ID', 'Title', 'Status', 'Cost', 'Resale Price', 'Est. Value', 'Location', 'Condition Notes', 'Keywords', 'Date Added'];
    
    const rows = items.map(item => [
        item.$id,
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

        return [
            'Add', // Action
            '', // Category (Must be filled by user usually, or mapped)
            (item.title || '').substring(0, 80), // Max 80 chars
            desc, // Description
            '3000', // Default ConditionID (Used)
            '', // PicURL (Would map to our public image URL if enabled)
            item.quantity || 1, // Quantity
            'FixedPrice', // Format
            item.resalePrice || item.estValue || '', // StartPrice
            'GTC', // Duration (Good 'Til Cancelled)
            item.storageLocation || 'US', // Location
            item.$id, // CustomLabel / SKU
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
            item.resalePrice || item.estValue || '', // Price
            '0', // Original Price
            item.$id // SKU
        ];
    });

    const csvContent = [headers, ...rows]
        .map(row => row.map(val => escapeCsv(val)).join(','))
        .join('\n');

    return csvContent;
}

/**
 * Generate Ricochet Consign New Inventory Import CSV
 * Exact official template matching ricoconsign.com (Consigned Inventory)
 */
export function generateRicochetCsv(items: any[]): string {
    const headers = [
        'SKU',
        'Item Title',
        'Description ',
        'Web Description',
        'Price',
        'Quantity',
        'In-Stock Date',
        'Category',
        'Brand'
    ];

    const todayStr = new Date().toLocaleDateString('en-US'); // e.g. 8/30/2026

    const rows = items.map(item => {
        let desc = item.conditionNotes || '';
        let webDesc = item.marketDescription || '';
        let brandStr = '';
        let catStr = 'Vintage Collectibles';

        if (item.rawAnalysis) {
            try {
                const ai = JSON.parse(item.rawAnalysis);
                const aiObj = Array.isArray(ai) ? ai[0] : ai;
                if (aiObj && aiObj.condition_notes) {
                    desc = aiObj.condition_notes;
                }
                if (aiObj && aiObj.keywords && Array.isArray(aiObj.keywords) && aiObj.keywords.length > 0) {
                    brandStr = aiObj.keywords[0];
                    catStr = aiObj.keywords[1] || catStr;
                }
            } catch (e) {}
        }

        const price = item.resalePrice || item.estValue || '0';
        const cleanPrice = typeof price === 'number' ? price.toFixed(2) : String(price).replace(/[^0-9.]/g, '') || '0.00';

        return [
            item.upc || item.sku || item.$id, // SKU
            (item.title || 'Inventory Item').substring(0, 100), // Item Title
            desc.replace(/[\r\n]+/g, ' ').substring(0, 250), // Description 
            (webDesc || desc).replace(/[\r\n]+/g, ' ').substring(0, 500), // Web Description
            cleanPrice, // Price (no $)
            item.quantity || 1, // Quantity
            todayStr, // In-Stock Date
            catStr, // Category
            brandStr || 'Vintage' // Brand
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
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
