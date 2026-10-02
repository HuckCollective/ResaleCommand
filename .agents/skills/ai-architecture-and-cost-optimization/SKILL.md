---
name: ai-architecture-and-cost-optimization
description: Master architecture, endpoint taxonomy, cost-optimization standards, and anti-bleed invariants for all AI services in Resale Command. Use when building, modifying, or debugging AI endpoints.
---

# Resale Command: AI Architecture & Cost-Optimization Taxonomy

This skill serves as the canonical system reference for all artificial intelligence engines in Resale Command. It ensures every AI feature is cost-effective, avoids reinventing the wheel, adheres to strict scope boundaries, and directly serves either **Reseller Efficiency** or **Developer Velocity**.

---

## 1. Core Architectural Foundation: Single Source of Truth

All AI services in Resale Command MUST route through [`src/lib/gemini.ts`](file:///Users/michaelstanley/Projects/ResaleCommand/src/lib/gemini.ts).

### Invariants:
1. **Dynamic Model Pointer (`DEFAULT_GEMINI_MODEL`)**:
   - Primary: `gemini-flash-latest` (Google-maintained stable alias, ~1.5–3s latency, lowest cost per token).
   - Configurable: Can be overridden at runtime via `.env` (`GEMINI_MODEL=gemini-pro-latest` or specific versions).
2. **Automated Exponential Backoff & Tiered Fallback**:
   - `generateContentWithBackoff()` automatically cascades across `[DEFAULT_GEMINI_MODEL, "gemini-flash-latest", "gemini-pro-latest"]`.
   - Transient failures (429 Rate Limits, 503 Overloads, network interruptions) back off automatically with jitter before trying the next tier.
3. **Robust Sanitized Parsers**:
   - `parseAiJson<T>()`: Extracts JSON objects/arrays, strips markdown fences, sanitizes trailing commas and control characters.
   - `parseAiPlainText()`: Strips conversational preambles ("Sure! Here is...") and excess markdown wrappers for copy-paste listing ready text.

---

## 2. The 3 Scout Archetypes & The Reseller Decision Model

Resale appraisal is not one-size-fits-all. Scout AI operates across 3 distinct operational modes, each with distinct inputs, shipping models, and decision goals:

| Scout Mode | Physical Context | Input Data | Shipping Model | The Core Reseller Question |
| :--- | :--- | :--- | :--- | :--- |
| **1. In-Person Camera Scout** | Thrift Store, Estate Sale, Flea Market, Garage Sale | 1–10 Phone Camera Photos + Optional Notes | **Inbound Shipping is $0** (cash in hand). Outbound shipping to online buyer must be estimated! | *"Is this worth picking off the shelf for cash right now?"* |
| **2. Online URL Scout** | ShopGoodwill, eBay, FB Marketplace, Mercari | Pasted Product URL + Optional User ZIP | **Inbound Shipping Drag is Critical!** (Must parse or calculate carrier fees + handling). | *"After high inbound shipping and fees, is there enough margin left to bid or buy?"* |
| **3. Batch / Haul Ingestion Scout** | Warehouse, Bulk Unboxing, Storage Locker Intake | Multi-photo Gallery or CSV Order Sync | **Landed Cost Allocation**: Pre-calculated purchase price + allocated order freight. | *"How should I deconstruct this lot to recoup 100% of my cost basis on item #1?"* |

---

## 3. URL Scouting: Sale Format Detection (Auction vs. Straight Sale)

When analyzing an online listing URL, Scout AI must distinguish between two fundamentally different financial models:

### A. The Auction Dynamic (ShopGoodwill, eBay Auctions)
* **The Reality**: The displayed price is only the *current bid*, NOT the purchase price. A $5.00 bid with 20 minutes left will likely close much higher.
* **What the Reseller Needs**:
  - `sale_type: "AUCTION"`
  - **Current Bid** & **Bid Count**
  - **Auction Countdown / End Time**
  - **Suggested Max Bid Ceiling**: The exact dollar limit where the reseller must stop bidding to ensure profitability after inbound shipping and marketplace selling fees.
  - Sourcing Verdict: `CHASE_AUCTION` (if bid < 50% max bid) or `WATCH` (if bid is nearing ceiling).

### B. The Straight Sale Dynamic (Buy It Now, FB Marketplace, Mercari, Poshmark)
* **The Reality**: The price is fixed. The buyer either pulls the trigger now or moves on.
* **What the Reseller Needs**:
  - `sale_type: "STRAIGHT_SALE"`
  - **Firm Asking Price**
  - **Instant Buy Margin**: $\text{Target Resale} - (\text{Asking Price} + \text{Inbound Shipping}) - \text{Selling Fees}$.
  - Sourcing Verdict: `BUY_NOW` (strong margin), `NEGOTIATE` (marginal spread), or `PASS` (underwater).

---

## 4. Shipping Drag & Landed Cost Intelligence

Shipping is the silent profit killer in e-commerce resale. A $12 item with $18 shipping and $4 handling creates a **$34 landed cost**—wiping out the profit on a $30 item.

### The Two-Stage Shipping Strategy:
1. **Explicit Carrier Shipping (Online URL Scout)**:
   - For ShopGoodwill: Call Buyer API `CalculateShipping` endpoint using the user's saved ZIP code to retrieve exact FedEx/USPS shipping and handling fees.
   - For eBay: Parse the shipping element or metadata from listing HTML (e.g. `Free Shipping` or exact calculated rate).
2. **AI Package Tiering Fallback (Camera Scout & Unknown URLs)**:
   - When shipping is not provided, Gemini vision estimates the physical package class based on visible substrate, size, and weight:
     - 📦 **Media Mail (~$4.50)**: Books, vinyl records, DVDs, VHS, educational media.
     - ✉️ **Ground Advantage Lightweight (~$5.50)**: Items under 1 lb (T-shirts, video game cartridges, jewelry, ties).
     - 📦 **Standard Priority (~$10.00–$14.00)**: Items 1–3 lbs (jackets, boots, small appliances, boxed toys).
     - 🏋️ **Bulky / Heavy (~$20.00–$35.00+)**: Items 4–10+ lbs (cast iron, vintage receivers, board game bundles, heavy ceramics).

### The "Make the Call" Financial Card:
Every Scout evaluation must compute the full financial equation:
$$\text{Projected Net Cash} = \text{Target Fair Resale} - \text{Total Landed Cost} (\text{Item Price} + \text{Inbound Shipping}) - \text{Est. Platform Fees} (\sim 13\text{--}15\%)$$
* **`BUY_NOW`**: Projected Net Profit $\ge \$15.00$ AND $\text{ROI} \ge 50\%$.
* **`PASS`**: Projected Net Profit $< \$5.00$ OR underwater after shipping.

---

## 5. Complete AI Services Taxonomy & Lifecycle Matrix

| Service / Endpoint | Core Function | Model Strategy & Cost | Reseller Impact (Why it Matters) | Developer Impact (Why it Matters) |
| :--- | :--- | :--- | :--- | :--- |
| **Speed Scout**<br/>`/api/identify-item.ts` | **Pre-acquisition decision**: Quick photo or URL scan (SGW, eBay, FB) for instant Fair/Boutique value, Buy/Pass verdict, and max bid. | `gemini-flash-latest`<br/>(1 multimodal call, ~1.5–3s) | **Fast decisions in the field**: Zero typing. Evaluates margins while standing at thrift store or bidding in closing seconds of an auction. | Single request/response contract. Avoids heavy DB state before item is purchased. |
| **AI Deep Scan**<br/>`src/lib/ai-inspection.ts`<br/>`/api/inspect-lot.ts` | **Post-acquisition lot deconstruction**: In-depth multi-photo inspection of owned inventory. Splits lots into Hero recovery, Combines, and Booth tiers. | `gemini-flash-latest`<br/>(unified multimodal pass, all photos in 1 prompt) | **Maximizes net profit**: Recoups 100% cost basis on the first single sale; groups remainder into high-velocity booth packs. | Full gallery context in 1 prompt prevents duplicate item counting or blind image synthesis. |
| **Headless Scout & Save**<br/>`/api/scout-and-save.ts` | **Automated ingestion**: External scripts/workers send image URLs with API key auth to scout and automatically save drafted items into Appwrite. | `gemini-flash-latest`<br/>(Headless server execution) | **Hands-off batch intake**: Reseller can dump photos from mobile or drive, and drafts appear ready in the intake queue. | Reuses `getSafeRawAnalysis()` to guarantee payloads fit within Appwrite 5,000-char string limits. |
| **Description Generator**<br/>`/api/generate-description.ts` | **One-click marketplace copy**: Writes clean, SEO-optimized plain text descriptions for eBay/Poshmark using item photos & specs. | `gemini-flash-latest`<br/>(Plain-text targeted prompt) | **Eliminates listing friction**: Writes structured bullet points with condition honesty and measurements without formatting hassles. | Direct DB update to `marketDescription` with client fallback; zero manual copy-pasting needed. |
| **Social Drop Broadcaster**<br/>`/api/generate-social-post.ts` | **Multi-channel drop promotions**: Crafts tailored marketing copy for Instagram, TikTok/Reels captions, and Discord drop alerts. | `gemini-flash-latest`<br/>(Persona & platform tuned) | **Drives sell-through velocity**: Turns freshly cataloged inventory into hype marketing copy with hashtags in 5 seconds. | Uses `parseAiPlainText` to strip conversational chatbot fluff completely. |
| **Valuation Estimator**<br/>`/api/estimate-price.ts` | **Micro-pricing check**: Estimates min, max, and fair market value from a quick title/description string without requiring images. | `gemini-flash-latest`<br/>(Ultra-low token text prompt) | **Instant price check**: Gives price confidence when manually creating or editing an item without taking photos. | Micro-payload (<100 tokens), zero image overhead, blazingly fast. |
| **Box / Set Component Counter**<br/>`/api/extract-components.ts` | **Parts verification**: Reads the back of board games, TTRPG sets, or tech kits to list expected parts and build a checklist. | `gemini-flash-latest`<br/>(Structured OCR extraction) | **Prevents returns & disputes**: Gives a checkable list (e.g. `50 Cards`, `1 Board`) to verify completeness before listing. | Outputs normalized `{ name, expected, found: 0, verified: false }` array ready for UI checklist state. |
| **Receipt OCR Parser**<br/>`/api/parse-receipt.ts` | **Thrift / Estate receipt intake**: Extracts vendor, date, line items, and landed tax from paper receipts. | `gemini-flash-latest`<br/>(Receipt-tuned vision) | **Automatic bookkeeping**: Eliminates manual cost entry for 20-item thrift store hauls. | Pairs with `vue-component-standards` camera viewfinder; returns parsed JSON directly into PO intake. |
| **Lot & Merchandising Matchers**<br/>`/api/suggest-lot-matches.ts` | **Cross-inventory bundling**: Searches active inventory to suggest theme-based combines (e.g. 5 Sci-Fi books for $10 booth pack). | `gemini-flash-latest`<br/>(Cross-item heuristic synthesis) | **Moves slow deadstock**: Pairs slow-moving items with anchor items to free up physical booth shelf space. | Feeds straight into the Lot Merchandising & Shelving Lifecycle engine. |
| **AI Telemetry & Metrics**<br/>`/api/admin/ai-metrics.ts` | **Cost monitoring**: Tracks real-time API call counts, Google Cloud billed expenditure, and cost-per-scan forecasts. | No LLM call<br/>(Reads DB metrics) | **Protects reseller margins**: Proves AI costs stay under pennies per item so technology remains profitable. | Provides live telemetry, audits dev vs prod usage, confirms active model pointers. |

---

## 6. The Anti-Bleed & Scope Separation Laws

1. **Scout Ground Truth is Immutable**:
   - An item's intake identification (`identity`, `ocr_detected_text`, `scoutData`, `[SCOUT_REPORT_ID]`) is **immutable historical truth**.
   - Downstream tools (Description Generator, Social Broadcaster, Price Estimator) must **read** from `scoutData` or `conditionNotes`—they MUST NOT overwrite or wipe original scout tags or raw analysis.
2. **Pre-Acquisition vs Post-Acquisition Separation**:
   - **Speed Scout (`/api/identify-item.ts`)** is strictly for **Pre-Acquisition** (`status !== 'acquired'`). Focuses on quick buy/pass verdicts and max bid targets. It does not clutter catalogs with unowned child items.
   - **AI Deep Scan (`/api/inspect-lot.ts` / `src/lib/ai-inspection.ts`)** is strictly for **Post-Acquisition** (`status === 'acquired'`). Focuses on physical constituent item decomposition and exit playbooks.
3. **Unified Multimodal Pass (No Chained Blind Calls)**:
   - When analyzing lots with multiple images, **never** make separate calls to summarize image 1, then image 2, then chain them with text LLMs.
   - Always supply all images simultaneously to Gemini in a single multimodal array. Gemini's native visual attention correlates views, eliminates duplicate items, and cuts API cost by >60%.

---

## 7. Developer Checklist for Adding or Updating AI Features

Whenever adding or editing an AI feature:
1. [ ] **Import from `src/lib/gemini.ts`**: Never import `@google/generative-ai` directly in endpoints.
2. [ ] **Use `generateContentWithBackoff`**: Ensures retries, rate-limit recovery, and fallback models work automatically.
3. [ ] **Use `parseAiJson` or `parseAiPlainText`**: Prevents markdown fence syntax errors and conversational preamble leaks.
4. [ ] **Verify Token & Image Size**: For storage images, prefer 1000px preview transforms (`/preview?width=1000&height=1000&output=webp`) to keep network transfer fast and under Google payload limits.
5. [ ] **Audit Telemetry**: Ensure any new endpoint logs cleanly to telemetry without breaking `npm run build`.
