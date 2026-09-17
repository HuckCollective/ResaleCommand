/**
 * deep-scan-lot.mjs
 * 
 * Standalone CLI tool to execute Gemini Multimodal AI Deep Scan on large multi-item lots
 * and collections directly against Appwrite Storage and Database.
 * 
 * Bypasses Vercel serverless HTTP payload limits (4.5MB) and function timeouts (10-15s).
 * Adheres strictly to the invariants defined in the ai-scout-and-deep-scan-validation skill:
 *  - Verbatim OCR Grounding (Spines, covers, copyright years, titles)
 *  - Physical Substrate First (Books vs Wall Art vs Media)
 *  - Anti-Hallucination Guard (Zero invented core rulebooks or staples)
 *  - 3-Tier Classification (🌟 Showcase / 📦 Core / ⚡ Quick Turn)
 *  - Authoritative User Notes & Lineage Ground Truth
 * 
 * Usage:
 *   node scripts/deep-scan-lot.mjs --prod --upc=HUCK-1460
 *   node scripts/deep-scan-lot.mjs --prod --upc=HUCK-1460 --apply
 *   node scripts/deep-scan-lot.mjs --prod --upc=HUCK-1460 --apply --model=gemini-2.5-flash
 */

import { Client, Databases, Storage, Query, ID, Permission, Role } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Parse CLI flags
const isProd = process.argv.includes('--prod');
const isApply = process.argv.includes('--apply');
const targetUpcArg = process.argv.find(a => a.startsWith('--upc='));
const targetIdArg = process.argv.find(a => a.startsWith('--id='));
const modelArg = process.argv.find(a => a.startsWith('--model='));
const qtyArg = process.argv.find(a => a.startsWith('--qty='));

const TARGET_UPC = targetUpcArg ? targetUpcArg.replace('--upc=', '').trim() : 'HUCK-1460';
const TARGET_ID = targetIdArg ? targetIdArg.replace('--id=', '').trim() : null;
const MODEL_NAME = modelArg ? modelArg.replace('--model=', '').trim() : 'gemini-2.5-flash';
const OVERRIDE_QTY = qtyArg ? parseInt(qtyArg.replace('--qty=', '').trim(), 10) : null;

// Appwrite Configuration
const ENDPOINT = process.env.PUBLIC_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1';
const PROJECT_ID = process.env.PUBLIC_APPWRITE_PROJECT_ID || '69714b35003a8adab6bb';
const API_KEY = process.env.APPWRITE_API_KEY;
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
const COLLECTION_ID = isProd ? 'items' : (process.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items');
const IMAGES_BUCKET_ID = isProd ? 'item_images' : (process.env.PUBLIC_APPWRITE_BUCKET_ID || 'item_images');
const REPORTS_BUCKET_ID = 'reports';

// Gemini Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error('❌ Missing APPWRITE_API_KEY in .env');
    process.exit(1);
}

if (!GEMINI_API_KEY) {
    console.error('❌ Missing GEMINI_API_KEY in .env');
    process.exit(1);
}

const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

const databases = new Databases(client);
const storage = new Storage(client);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const RESALE_SAFETY_SETTINGS = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const SYSTEM_INSTRUCTION = `You are a master multi-category resale appraiser and inventory valuation expert.
Strictly ground all item identifications and conditions in physical OCR, printed copyright dates, and visible features from provided images or verified user notes.`;

function cleanAndParseJSON(rawText) {
    let cleaned = rawText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    try {
        return JSON.parse(cleaned);
    } catch (err) {
        const firstOpen = cleaned.indexOf('{');
        const lastClose = cleaned.lastIndexOf('}');
        if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
            const candidate = cleaned.slice(firstOpen, lastClose + 1);
            try {
                return JSON.parse(candidate);
            } catch (e) {
                const fixed = candidate.replace(/,\s*([\}\]])/g, '$1');
                return JSON.parse(fixed);
            }
        }
        throw err;
    }
}

async function run() {
    console.log(`\n================================================================`);
    console.log(`🚀 AI DEEP SCAN FOR LOT APPRAISAL & CURATION`);
    console.log(`================================================================`);
    console.log(`   Database: ${DB_ID} / ${COLLECTION_ID} (${isProd ? '🔴 PRODUCTION' : '🟡 DEV'})`);
    console.log(`   Target:   ${TARGET_ID ? `ID: ${TARGET_ID}` : `UPC: ${TARGET_UPC}`}`);
    console.log(`   Model:    ${MODEL_NAME}`);
    console.log(`   Mode:     ${isApply ? '🚀 APPLY (Will update Appwrite DB & upload report)' : '⚠️ DRY RUN (Audit only)'}`);
    console.log(`----------------------------------------------------------------\n`);

    // 1. Fetch Target Item Document
    let itemDoc = null;
    if (TARGET_ID) {
        itemDoc = await databases.getDocument(DB_ID, COLLECTION_ID, TARGET_ID);
    } else {
        const res = await databases.listDocuments(DB_ID, COLLECTION_ID, [
            Query.equal('upc', TARGET_UPC),
            Query.limit(1)
        ]);
        if (res.documents.length === 0) {
            console.error(`❌ Item with UPC '${TARGET_UPC}' not found in [${COLLECTION_ID}]!`);
            process.exit(1);
        }
        itemDoc = res.documents[0];
    }

    console.log(`📦 Loaded Item: "${itemDoc.title}"`);
    console.log(`   Doc ID:   ${itemDoc.$id}`);
    console.log(`   UPC:      ${itemDoc.upc || 'N/A'}`);
    console.log(`   Status:   ${itemDoc.status}`);
    console.log(`   Quantity: ${itemDoc.quantity} units`);
    console.log(`   Cost:     $${Number(itemDoc.cost || 0).toFixed(2)}`);
    console.log(`   Current Resale: $${Number(itemDoc.resalePrice || 0).toFixed(2)}`);
    console.log(`   Location: ${itemDoc.storageLocation || 'N/A'}`);

    const targetQuantity = OVERRIDE_QTY || itemDoc.quantity || 1;
    console.log(`   Target Physical Count: ${targetQuantity} items`);

    // 2. Query Child Items (Merged or Extracted)
    console.log(`\n🔗 Checking for linked child items in lineage (parentLotId = ${itemDoc.$id})...`);
    const childDocsRes = await databases.listDocuments(DB_ID, COLLECTION_ID, [
        Query.equal('parentLotId', itemDoc.$id),
        Query.limit(100)
    ]);
    const childDocs = childDocsRes.documents;
    console.log(`   Found ${childDocs.length} linked child items in database:`);
    childDocs.forEach((c, idx) => {
        console.log(`   ${idx + 1}. [${c.upc || 'NO-UPC'}] ${c.title} (Status: ${c.status}, Resale: $${c.resalePrice || 0})`);
    });

    // 3. Collect and Audit All Images
    console.log(`\n🖼️ Gathering all gallery photos...`);
    const candidatePhotoIds = Array.from(new Set([
        ...(itemDoc.imageId ? [itemDoc.imageId] : []),
        ...(Array.isArray(itemDoc.galleryImageIds) ? itemDoc.galleryImageIds : [])
    ])).filter(id => id && typeof id === 'string');

    // Also include photos from child items if not present
    for (const child of childDocs) {
        const childImages = [
            ...(child.imageId ? [child.imageId] : []),
            ...(Array.isArray(child.galleryImageIds) ? child.galleryImageIds : [])
        ];
        for (const cImg of childImages) {
            if (cImg && !candidatePhotoIds.includes(cImg)) {
                candidatePhotoIds.push(cImg);
            }
        }
    }

    console.log(`   Found ${candidatePhotoIds.length} candidate image IDs in metadata:`);
    candidatePhotoIds.forEach((id, idx) => console.log(`   - Photo #${idx + 1}: ${id}`));

    if (candidatePhotoIds.length === 0) {
        console.error(`❌ No images found for item ${itemDoc.upc}! Deep Scan requires at least 1 image.`);
        process.exit(1);
    }

    // 4. Download Images from Appwrite Storage
    console.log(`\n⬇️ Downloading image binary buffers from Appwrite Storage [${IMAGES_BUCKET_ID}]...`);
    const imageParts = [];
    for (let i = 0; i < candidatePhotoIds.length; i++) {
        const fileId = candidatePhotoIds[i];
        try {
            process.stdout.write(`   Downloading Photo #${i + 1} (${fileId})...\r`);
            const fileMeta = await storage.getFile(IMAGES_BUCKET_ID, fileId);
            const arrayBuffer = await storage.getFileDownload(IMAGES_BUCKET_ID, fileId);
            const buffer = Buffer.isBuffer(arrayBuffer) ? arrayBuffer : Buffer.from(arrayBuffer);
            const base64 = buffer.toString('base64');
            const mimeType = fileMeta.mimeType || 'image/jpeg';

            imageParts.push({
                inlineData: {
                    data: base64,
                    mimeType: mimeType
                },
                fileId: fileId,
                index: i,
                size: buffer.length
            });
            console.log(`   ✅ Photo #${i + 1} downloaded (${fileId}): ${buffer.length.toLocaleString()} bytes, ${mimeType}`);
        } catch (err) {
            console.log(`   ⚠️ Failed to download photo ${fileId}: ${err.message}`);
        }
    }

    if (imageParts.length === 0) {
        console.error(`❌ Could not download any images from storage bucket [${IMAGES_BUCKET_ID}]!`);
        process.exit(1);
    }

    console.log(`\n📸 Successfully prepared ${imageParts.length} photos for Gemini Multimodal Analysis.`);

    // 5. Construct Deep Scan Multimodal Prompt
    const existingItemsContext = childDocs.length > 0
        ? `\nVERIFIED CONSTITUENT ITEMS IN THIS LOT (${childDocs.length} verified listings in lineage):
${JSON.stringify(childDocs.map(c => ({
            upc: c.upc,
            title: c.title,
            price: c.resalePrice || c.price,
            quantity: c.quantity || 1,
            status: c.status
        })), null, 2)}
CRITICAL INSTRUCTION: The reseller has ALREADY split, cataloged, and verified these items! Use these verified items as authoritative ground truth. Match and incorporate them directly without duplicate counting.`
        : '';

    const countInstruction = targetQuantity > 1
        ? `Physical Lot Stated Count: EXACTLY ${targetQuantity} physical items. Locate and catalogue all ${targetQuantity} distinct physical items shown across the photos.`
        : `Physical Lot Stated Count: Auto-detect distinct items based on unique visible pieces across photos. Do NOT duplicate items shown across multiple angles.`;

    const prompt = `
You are a master multi-category resale appraiser and inventory valuation expert performing high-precision inspection, item cataloging, and booth pricing for a multi-item collection/lot.

ALL ${imageParts.length} GALLERY PHOTOS ARE ATTACHED DIRECTLY TO THIS REQUEST:
Photo #1 through Photo #${imageParts.length}. Inspect every image carefully. Cross-reference group/overview shots with individual item closeups and spines.

LOT CONTEXT:
- Stated Listing Title: "${itemDoc.title}"
- ${countInstruction}
- Sourcing Location: "${itemDoc.sourcingLocation || 'Combined Lot'}"
- Total Landed Purchase Cost: $${Number(itemDoc.cost || 0).toFixed(2)}
- Storage Location: "${itemDoc.storageLocation || 'MD'}"
${existingItemsContext}

CORE MULTI-CATEGORY APPRAISAL PRINCIPLES:
1. STRICT PHYSICAL GROUNDING & VERBATIM OCR (ZERO HALLUCINATION):
   - You MUST identify each item strictly by what is physically visible in the attached photos.
   - For Books, Media, Games, RPGs: Read the exact title, author, and subtitle printed on each physical cover or spine.
   - Extract the visible copyright/publication year (e.g. "© 2000", "© 2004", "© 2009", "© 1974").
   - DO NOT assume all items in a lot share the edition, era, or brand stated in the general listing title! Use each individual item's visible cover design, logos, and printed copyright/publication year to determine its true secondary market value.
   - STRICT ANTI-HALLUCINATION GUARD: NEVER invent, extrapolate, or guess famous franchise staples or core rulebooks unless that exact item's cover, tag, or spine is visibly present in the photos!
   - Every single entry in "lot_items" must correspond to a real, visible physical item on the table/shelf.

2. PHYSICAL COUNT FIDELITY & CROSS-PHOTO MERGING:
   - Carefully cross-reference group shots with individual closeups.
   - Merge multi-photo appearances of the same item so that each physical piece appears exactly ONCE in "lot_items".
   - Target total count: ${targetQuantity} items.

3. PHYSICAL SUBSTRATE & CATEGORY ACCURACY:
   - Accurately distinguish physical substrate:
     * Paper pages / bound spines / staples = Books, RPGs, Comics, or Periodicals.
     * Fabric weave, stitched seams, brand tags = Apparel & Workwear.
     * Wooden boards / framed panels / mounted prints = Wall Decor & Art Plaques. NEVER classify wall art as books or magazines.
     * Cartridges / optical discs / cases = Video Games & Media.
   - Multi-disc sets (e.g. 2-CD sets) stay 1 single inventory unit. Distinct individual books, games, or garments get split into individual lot_items.

4. 3-TIER INVENTORY CLASSIFICATION (RETURN "lot_items" SORTED IN THIS EXACT ORDER):
   - **Showcase (🌟 Tier 1)**: High-ticket single items ($40+ secondary market value, rare 1st printings, vintage key issues, pristine collectors' pieces).
   - **Core (📦 Tier 2)**: Solid mid-tier items ($15 - $35 value, standard popular franchise titles, clean complete volumes).
   - **Quick Turn (⚡ Tier 3)**: High-volume reader copies, clearance paperbacks, lower-value duplicates ($5 - $12 value).

5. PHYSICAL TAG LABEL FORMATTING:
   - "tag_title" MUST BE <= 40 CHARACTERS for thermal barcode label printing (Rollo & Ricochet POS).

6. VALUATION MATRIX HIERARCHY:
   - Mint Price >= Boutique Premium Price >= Fair Market Price >= Poor Price.

OUTPUT FORMAT: Return strictly a valid JSON object matching this schema:
{
  "identity": "Brief master title describing the entire lot",
  "title": "Optimized, keyword-rich master lot title",
  "tag_title": "Max 40 char thermal tag title",
  "keywords": ["tag1", "tag2", ...],
  "condition_notes": "Comprehensive overview of physical condition across the lot",
  "redFlags": ["Damage, missing pieces, structural flaws, if any"],
  "price_breakdown": {
    "mint": "$XXX",
    "fair": "$XXX",
    "poor": "$XXX",
    "boutique_premium": "$XXX",
    "confidence": "high" | "medium" | "low"
  },
  "purchase_strategy": {
    "verdict": "BUY_NOW" | "BUY" | "CHASE_AUCTION" | "WATCH" | "PASS",
    "max_bid": 0,
    "advice": "Clear explanation of sourcing strategy and margin targets"
  },
  "market_report": {
    "best_platform": "Physical Booth (Memory Den / Dusty Tiger)" | "eBay" | "Mercari" | "Amazon",
    "platform_rationale": "Why this platform generates the highest net profit",
    "sell_through_velocity": "Fast (< 14 days)" | "Medium (14-45 days)" | "Slow (> 45 days)",
    "channels": [
      {
        "name": "Memory Den Booth",
        "est_price": "$XXX",
        "net_payout": "$XXX",
        "speed": "Fast",
        "recommendation": "Primary showcase"
      }
    ]
  },
  "lot_items": [
    {
      "name": "Full Title, Subtitle & Author/Publisher",
      "identity": "Short identification",
      "tag_title": "Max 40 char tag title",
      "quantity": 1,
      "tier": "showcase" | "core" | "quick_turn",
      "tier_label": "🌟 Showcase" | "📦 Core" | "⚡ Quick Turn",
      "estimated_value": "$XX - $YY",
      "condition": "Like New" | "Very Good" | "Good" | "Fair" | "Poor",
      "image_index": 0,
      "price_breakdown": {
        "mint": "$XX",
        "fair": "$XX",
        "poor": "$XX",
        "boutique_premium": "$XX"
      },
      "ocr_detected_text": "Exact text read on cover/spine",
      "red_flags": []
    }
  ]
}
`;

    // 6. Execute Gemini Generation with Backoff or Load Cache
    const cacheFile = path.resolve(__dirname, `../.cache-deep-scan-${itemDoc.upc || itemDoc.$id}.json`);
    const isForce = process.argv.includes('--force');

    let result = null;
    if (!isForce && fs.existsSync(cacheFile)) {
        try {
            console.log(`\n💾 Found cached Deep Scan results at ${path.basename(cacheFile)}! Loading from cache...`);
            const cachedContent = fs.readFileSync(cacheFile, 'utf-8');
            result = JSON.parse(cachedContent);
            console.log(`✅ Loaded ${result.lot_items?.length || 0} cataloged items from local cache.`);
        } catch (e) {
            console.warn(`   ⚠️ Could not parse cache file: ${e.message}. Calling Gemini fresh...`);
            result = null;
        }
    }

    if (!result) {
        console.log(`\n🧠 Calling Gemini (${MODEL_NAME}) with ${imageParts.length} photos in single multimodal pass...`);
        console.log(`   (This may take 20-45 seconds for a 44-piece lot. Please wait...)`);

        const geminiModel = genAI.getGenerativeModel({
            model: MODEL_NAME,
            safetySettings: RESALE_SAFETY_SETTINGS,
            systemInstruction: SYSTEM_INSTRUCTION
        });

        const contents = [
            ...imageParts.map(p => ({ inlineData: p.inlineData })),
            prompt
        ];

        let rawText = '';
        const startTime = Date.now();

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const res = await geminiModel.generateContent(contents);
                rawText = res.response.text();
                result = cleanAndParseJSON(rawText);
                fs.writeFileSync(cacheFile, JSON.stringify(result, null, 2), 'utf-8');
                console.log(`💾 Saved AI appraisal to local cache: ${path.basename(cacheFile)}`);
                break;
            } catch (err) {
                console.warn(`   ⚠️ Attempt ${attempt} failed: ${err.message}`);
                if (attempt === 3) {
                    console.error(`❌ Gemini inspection failed after 3 attempts.`);
                    process.exit(1);
                }
                console.log(`   Retrying in 5 seconds...`);
                await new Promise(r => setTimeout(r, 5000));
            }
        }

        const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n✅ Gemini analysis completed in ${durationSec}s!`);
    }

    // 7. Validate & Display Deep Scan Results
    const lotItems = result.lot_items || [];
    console.log(`\n================================================================`);
    console.log(`📊 AI DEEP SCAN RESULTS SUMMARY`);
    console.log(`================================================================`);
    console.log(`📌 Master Title:     "${result.title || result.identity}"`);
    console.log(`🏷️ Tag Title:        "${result.tag_title || ''}"`);
    console.log(`📦 Cataloged Items:  ${lotItems.length} physical items`);
    console.log(`🎯 Strategy Verdict: ${result.purchase_strategy?.verdict || 'N/A'}`);
    console.log(`💡 Strategy Advice:  ${result.purchase_strategy?.advice || 'N/A'}`);
    console.log(`💰 Valuation Matrix:`);
    console.log(`   - Mint:             ${result.price_breakdown?.mint || 'N/A'}`);
    console.log(`   - Fair Market:      ${result.price_breakdown?.fair || 'N/A'}`);
    console.log(`   - Boutique Premium: ${result.price_breakdown?.boutique_premium || 'N/A'}`);
    console.log(`   - Reader / Poor:    ${result.price_breakdown?.poor || 'N/A'}`);
    console.log(`🏪 Best Platform:    ${result.market_report?.best_platform || 'N/A'}`);
    console.log(`----------------------------------------------------------------`);

    // Group items by tier
    const showcaseItems = lotItems.filter(i => i.tier === 'showcase');
    const coreItems = lotItems.filter(i => i.tier === 'core' || (!i.tier && i.tier_label?.includes('Core')));
    const quickTurnItems = lotItems.filter(i => i.tier === 'quick_turn' || (!i.tier && !showcaseItems.includes(i) && !coreItems.includes(i)));

    console.log(`\n🌟 TIER 1: SHOWCASE (${showcaseItems.length} items):`);
    showcaseItems.forEach((it, i) => {
        console.log(`   ${i + 1}. ${it.name || it.identity} | Value: ${it.estimated_value || it.price_breakdown?.fair} | Cond: ${it.condition}`);
    });

    console.log(`\n📦 TIER 2: CORE (${coreItems.length} items):`);
    coreItems.forEach((it, i) => {
        console.log(`   ${i + 1}. ${it.name || it.identity} | Value: ${it.estimated_value || it.price_breakdown?.fair} | Cond: ${it.condition}`);
    });

    console.log(`\n⚡ TIER 3: QUICK TURN (${quickTurnItems.length} items):`);
    quickTurnItems.forEach((it, i) => {
        console.log(`   ${i + 1}. ${it.name || it.identity} | Value: ${it.estimated_value || it.price_breakdown?.fair} | Cond: ${it.condition}`);
    });

    if (!isApply) {
        console.log(`\n⚠️ DRY RUN COMPLETED. No database changes were made.`);
        console.log(`👉 To save these results to Appwrite (rawAnalysis, components, and reports bucket), re-run with:`);
        console.log(`   node scripts/deep-scan-lot.mjs ${isProd ? '--prod ' : ''}--upc=${itemDoc.upc} --apply\n`);
        return;
    }

    // 8. APPLY: Save Report to Storage Bucket and Update Appwrite Document
    console.log(`\n🚀 APPLYING TO APPWRITE DATABASE & STORAGE...`);

    // 8a. Upload full JSON report to 'reports' bucket
    let scoutReportId = null;
    try {
        console.log(`   Uploading scout.json to [${REPORTS_BUCKET_ID}] storage bucket...`);
        const reportJsonStr = JSON.stringify(result, null, 2);
        const reportUpload = await storage.createFile(
            REPORTS_BUCKET_ID,
            ID.unique(),
            InputFile.fromBuffer(Buffer.from(reportJsonStr, 'utf-8'), 'scout.json')
        );
        scoutReportId = reportUpload.$id;
        console.log(`   ✅ Created report file in Appwrite Storage: ${scoutReportId}`);
    } catch (e) {
        console.warn(`   ⚠️ Could not upload to reports bucket: ${e.message}`);
    }

    // 8b. Format conditionNotes with scout overview and metadata tags
    let updatedNotes = itemDoc.conditionNotes || '';
    if (result.condition_notes) {
        // Strip previous scout report text if any
        updatedNotes = updatedNotes.replace(/^--- 📦 MASTER LOT APPRAISAL[\s\S]*?\n\n/i, '');
        updatedNotes = `${result.condition_notes}\n\n${updatedNotes}`.trim();
    }

    // Update SCOUT_REPORT_ID tag
    if (scoutReportId) {
        if (/\[SCOUT_REPORT_ID:[^\]]+\]/i.test(updatedNotes)) {
            updatedNotes = updatedNotes.replace(/\[SCOUT_REPORT_ID:[^\]]+\]/gi, `[SCOUT_REPORT_ID: ${scoutReportId}]`);
        } else {
            updatedNotes += `\n[SCOUT_REPORT_ID: ${scoutReportId}]`;
        }
    }

    // Clamp conditionNotes to 5000 characters
    if (updatedNotes.length > 5000) {
        updatedNotes = updatedNotes.slice(0, 4990) + '...';
    }

    // 8c. Prepare keywords
    const combinedKeywords = Array.from(new Set([
        ...(itemDoc.keywords || []),
        ...(result.keywords || [])
    ])).slice(0, 50);

    // 8d. Prepare rawAnalysis and components
    const rawAnalysisStr = JSON.stringify(result);
    const componentsStr = JSON.stringify(result.lot_items || []);

    const updatePayload = {
        rawAnalysis: rawAnalysisStr.slice(0, 65000),
        components: componentsStr.slice(0, 65000),
        conditionNotes: updatedNotes,
        keywords: combinedKeywords
    };

    // If resale price is 0 or empty, populate with AI fair price
    if (!itemDoc.resalePrice || Number(itemDoc.resalePrice) === 0) {
        const fairValMatch = String(result.price_breakdown?.fair || '').match(/\$?\s*(\d+(?:\.\d+)?)/);
        if (fairValMatch) {
            updatePayload.resalePrice = parseFloat(fairValMatch[1]);
        }
    }

    console.log(`   Updating item document ${itemDoc.$id} in [${COLLECTION_ID}]...`);
    const updatedDoc = await databases.updateDocument(
        DB_ID,
        COLLECTION_ID,
        itemDoc.$id,
        updatePayload
    );

    console.log(`\n🎉 SUCCESS! Item ${itemDoc.upc} updated with AI Deep Scan intelligence.`);
    console.log(`   - rawAnalysis: ${updatePayload.rawAnalysis.length} chars`);
    console.log(`   - components:  ${lotItems.length} cataloged items`);
    console.log(`   - report file: ${scoutReportId || 'N/A'}`);
    console.log(`\n✨ You can now open https://www.resalecmd.com/inventory?search=61911148&upc=${itemDoc.upc}`);
    console.log(`   The drawer will display "Report Ready" with all 44 items, pricing tiers, and the Multi-Tier Lot Splitter ready to launch!`);
}

run().catch(err => {
    console.error(`\n❌ Unhandled error in deep-scan-lot:`, err);
    process.exit(1);
});
