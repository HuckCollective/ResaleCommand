---
trigger: glob
globs: "**/src/pages/api/**/*.ts, **/src/lib/**/*.ts, **/src/composables/**/*.ts"
description: "Appwrite schema limits, anti-truncation pagination, price parsing, purchase saving, and World 1 Gemini SDK rules."
---

# Appwrite Schema, Pagination, Price Math & API Guardrails

1. **Appwrite `resale_db` Attribute & Payload Invariants:**
   - **Never write `quantity: 0`**: Appwrite integer validation enforces `quantity >= 1`. Mark sold/merged items `status: 'sold'` or `'combined'` with `quantity: 1` (or actual pack count).
   - **Never send `isMultiQty` or unknown schema keys**: Appwrite rejects unknown attributes with HTTP `400`. Hydrate `isMultiQty` in client memory (`quantity > 1`).
   - **Strict String Caps & Zero Base64 in DB**:
     - `imageId` & `galleryImageIds[]`: `<= 255`-char Appwrite Storage File IDs or short URLs ONLY — **NEVER** `data:image/...;base64,...` strings (upload blobs to `item_images` bucket first).
     - `rawAnalysis` & `components`: Strip Base64 thumbnails and guard serialized JSON to `<= 64,000` chars (`65,000` schema cap).
     - `title` (`<= 255`), `upc` / `sku` / `locationSku` (`<= 100`), `status` (`received`, `placed`, `listed`, `sold`, `combined`, `deconstructed`, `archived` — never `'in-stock'`).

2. **Mandatory Auto-Pagination (Zero Silent 25-Row Truncation):**
   - Appwrite `listDocuments()` returns **only 25 documents by default** when `Query.limit()` is omitted!
   - Every list/sync/audit query against `items`, `sales`, `purchases`, `expenses`, or `manifests` MUST paginate in a loop (`Query.limit(100)` + `Query.cursorAfter(lastId)` or `Query.offset(offset)`, ordered deterministically with `Query.orderDesc('$id')`) or use shared paginated helpers (`fetchAllInventoryItems`, etc.).

3. **Canonical Purchase & Price Parsing Pipelines:**
   - **Purchases (`resale_db.purchases`)**: Always save/ingest POs through `purchasesAPI.savePurchaseOrder(payload)` in `src/lib/purchases.ts` so `orderId`, `totalCost`, `purchaseDate`, `taxPaid`, `shippingPaid`, and `feesPaid` normalize identically across CSV, Auction Scout, and manual entry.
   - **Price Parsing (`parsePriceValue` in `@lib/lot-strategy`)**: **NEVER** parse AI or user price strings with `.replace(/[^0-9.]/g, '')` (`"$25 - $35"` catastrophically concatenates into `$2535`!). Always import `parsePriceValue` from `@lib/lot-strategy` (note: `tsconfig.json` defines `@lib/*`, NOT `@/*` or `@stores/*`).

4. **Zero Hardcoded Locations & Strict World 1 vs. World 2 AI Separation:**
   - Resolve `commissionRate`, `monthlyRent`, `usesRicochet`, `salesIntakeMode`, and manifest doc IDs dynamically from `src/lib/warehouses.ts` + `src/lib/locationSettingsServer.ts` (Laws 1–4). Delegate all SKU/UPC/ticket matching to `src/lib/salesBucketing.ts`.
   - **World 1 (`src/lib/gemini.ts`)**: App runtime AI uses the official `@google/genai` SDK (`GoogleGenAI`) billed to Huckleberry Collective Cloud credits (`gemini-2.5-flash` / `gemini-2.5-pro`). Never mix World 2 IDE model IDs (`src/lib/devAiRouting.ts`) into runtime API calls, and keep `calibrationBlock` strictly separate from `authoritativeUserNotes` in `/api/identify-item.ts`.

5. **Plain-English User-Facing Errors & Loader Text (`validate-templates.mjs` §15):**
   - Applies **ONLY** to strings a member can read (`{ error }` JSON responses, `CoopHttpError`, `addToast`, `showLoader` `step:`, `toUserMessage` in `src/lib/userFacingErrors.ts`). Code identifiers, file names (`lib/appwrite.ts`), comments, AI docs/rules, and `console.*` keep technical names. Never expose `Appwrite`, `Vercel`, `resale_db`, `coop_ledger`, `JWT`, or `localStorage` in user-facing error or status strings.
