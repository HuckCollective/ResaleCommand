import type { APIRoute } from 'astro';
import { model, generateContentWithBackoff, parseAiJson } from '../../lib/gemini';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const rawImages: string[] = Array.isArray(body.images) ? body.images : (body.image ? [body.image] : []);

        if (rawImages.length === 0) {
            return new Response(JSON.stringify({ error: "Missing image data" }), { status: 400 });
        }

        const imageParts = rawImages.map(imgStr => {
            let mimeType = "image/jpeg";
            let base64Data = imgStr;
            if (imgStr.startsWith('data:')) {
                const commaIdx = imgStr.indexOf(',');
                if (commaIdx !== -1) {
                    const meta = imgStr.substring(5, commaIdx);
                    mimeType = meta.split(';')[0] || "application/pdf";
                    base64Data = imgStr.substring(commaIdx + 1);
                }
            } else {
                base64Data = imgStr.replace(/^data:[^;]+;base64,/, '');
            }
            return {
                inlineData: {
                    data: base64Data.trim(),
                    mimeType
                }
            };
        });

        const prompt = `
You are an expert OCR receipt, invoice, and financial document parser specializing in:
1. Point of Sale (POS) retail receipts (Goodwill, retail stores, hardware, gas).
2. SaaS & Cloud Infrastructure Invoices (Google Cloud, Google Workspace, Appwrite, Vercel, AWS, Twilio, OpenAI, Gemini API).
3. Billing account summaries, multi-month ledgers, and credit card / transaction statements (Google Payments Center, Stripe billing portal, bank statements).
4. Antique Mall & Consignment Booth settlements (Memory Den, Dusty Tiger, Ricochet POS).

Analyze the document/image/PDF with extreme precision. Extract:
1. DOCUMENT TYPE: Classify the document layout:
   - "POINT_OF_SALE_RECEIPT": A single checkout cart on one date with multiple purchased items.
   - "BILLING_STATEMENT_LEDGER": An account ledger, transaction history, or statement showing multiple chronological charges or billing cycles over time.
   - "SINGLE_INVOICE": A single periodic bill with one invoice number, one due date, and one grand total.
   - "SETTLEMENT_REPORT": Antique mall or consignment payout statement.

2. STORE / VENDOR: The vendor or company name (e.g. "Google One", "Google Cloud", "Google LLC", "Appwrite", "Vercel", "Memory Den", "Goodwill").
3. DATE: Document or transaction date in YYYY-MM-DD format (if a billing period like "May 1 - May 31, 2026" is shown, use the end date 2026-05-31).
4. INVOICE NUMBER: If visible (e.g. INV-0FCD135D, or billing account ID like 9012-8850-2008-4700).

5. LINE ITEMS & TRANSACTIONS (CRITICAL FINANCIAL STATUS & TAX INVARIANT):
   - For EVERY transaction row, billing line, or itemized product, extract:
     * title: Item or subscription description (e.g. "Google AI Ultra (20 TB)").
     * cost: Dollar amount as positive float.
     * quantity: Default 1.
     * date: Exact date of this specific transaction row in YYYY-MM-DD (crucial for statements).
     * status: MUST be "PAID", "DECLINED", "FAILED", "PENDING", or "REFUNDED".
       - In transaction logs (like Google Payments Center, credit card statements), inspect the status column with 100% precision.
       - If a row says "Declined", "Failed", "Unsuccessful", or "Cancelled", you MUST assign status: "DECLINED".
     * taxCategory: Best fitting IRS category ("Tech Commons & AI Credits", "Booth Rent & Mall Fees", "Thermal Tags & Merch Supplies", "Software / SaaS", "COGS / Resale Inventory", "Office Expenses").

6. TOTAL SPENT & SETTLED TOTAL:
   - Under US tax law (IRC § 162), unpaid or declined transactions are NOT deductible business expenses.
   - "total" MUST strictly reflect ONLY successfully settled/PAID transactions.
   - If ALL transactions on the document are "DECLINED" or "FAILED", "total" MUST BE 0.00!

Return a STRICT JSON object:
{
    "documentType": "POINT_OF_SALE_RECEIPT",
    "vendor": "Google One",
    "date": "2026-10-14",
    "total": 0.00,
    "invoiceNumber": "",
    "items": [
        {
            "title": "Google AI Ultra (20 TB)",
            "cost": 99.99,
            "quantity": 1,
            "date": "2026-10-14",
            "status": "DECLINED",
            "taxCategory": "Tech Commons & AI Credits"
        }
    ]
}
`;

        const result = await generateContentWithBackoff([prompt, ...imageParts]);
        
        let responseText = '';
        try {
            responseText = result.response.text();
        } catch (textErr) {
            const candidate = result.response?.candidates?.[0];
            const part = candidate?.content?.parts?.[0];
            if (part && 'text' in part && part.text) {
                responseText = part.text;
            } else {
                throw new Error("Receipt image content could not be read.");
            }
        }
        
        const parsedJson = parseAiJson(responseText) || {};

        const rawItems = Array.isArray(parsedJson.items) ? parsedJson.items : [];
        let declinedCount = 0;
        let settledSum = 0;

        const processedItems = rawItems.map((it: any, idx: number) => {
            const rawTitle = (it?.title || it?.description || `Item #${idx + 1}`).trim();
            const rawStatus = (it?.status || '').toString().toUpperCase().trim();
            const titleLower = rawTitle.toLowerCase();

            // Detect declined or failed status across title and status fields
            const isDeclined = rawStatus === 'DECLINED' || rawStatus === 'FAILED' || rawStatus === 'VOID' ||
                               rawStatus === 'CANCELLED' || rawStatus === 'UNSUCCESSFUL' ||
                               titleLower.includes('decline') || titleLower.includes('failed transaction') ||
                               titleLower.includes('(declined)');

            let itemCost = it.cost !== undefined ? it.cost : (it.price !== undefined ? it.price : it.amount);
            if (typeof itemCost === 'string') {
                itemCost = Math.abs(parseFloat(itemCost.replace(/[^0-9.]/g, '')) || 0);
            } else {
                itemCost = Math.abs(Number(itemCost) || 0);
            }

            const itemStatus = isDeclined ? 'DECLINED' : (rawStatus || 'PAID');
            if (isDeclined) {
                declinedCount++;
            } else {
                settledSum += itemCost;
            }

            return {
                ...it,
                title: rawTitle,
                cost: itemCost,
                quantity: Number(it.quantity) || 1,
                date: it.date || parsedJson.date || new Date().toISOString().slice(0, 10),
                status: itemStatus,
                isDeclined,
                taxCategory: it.taxCategory || 'General Operational Commons',
                lineNumber: idx + 1
            };
        });

        parsedJson.items = processedItems;
        parsedJson.hasDeclinedTransactions = declinedCount > 0;
        parsedJson.declinedCount = declinedCount;

        // Anti-Phantom Tax Law: Total must strictly represent settled/paid funds
        if (declinedCount > 0 && settledSum === 0) {
            parsedJson.total = 0;
            parsedJson.warning = `${declinedCount} transaction(s) on this document were DECLINED or FAILED. Under IRS rules, unpaid transactions cannot be claimed as tax-deductible expenses.`;
        } else if (settledSum > 0) {
            parsedJson.total = Number(settledSum.toFixed(2));
        } else if (parsedJson.total !== undefined) {
            parsedJson.total = Math.abs(Number(parsedJson.total) || 0);
        }

        if (parsedJson.items && Array.isArray(parsedJson.items)) {
            const titleFrequencies = new Map<string, number>();
            for (const it of parsedJson.items) {
                const norm = (it?.title || it?.description || 'Item').trim().toLowerCase();
                titleFrequencies.set(norm, (titleFrequencies.get(norm) || 0) + 1);
            }

            const titleTracker = new Map<string, number>();
            parsedJson.items = parsedJson.items.map((it: any, idx: number) => {
                let cleanTitle = (it?.title || it?.description || `Item #${idx + 1}`).trim();
                const norm = cleanTitle.toLowerCase();
                if ((titleFrequencies.get(norm) || 0) > 1 && !/#\d+$/.test(cleanTitle)) {
                    const count = (titleTracker.get(norm) || 0) + 1;
                    titleTracker.set(norm, count);
                    cleanTitle = `${cleanTitle} #${count}`;
                }

                return {
                    ...it,
                    title: cleanTitle,
                    lineNumber: idx + 1
                };
            });
        }

        return new Response(JSON.stringify(parsedJson), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        console.error('Error parsing receipt:', err);
        return new Response(JSON.stringify({ error: err.message || 'Unknown error' }), { status: 500 });
    }
};
