---
name: resale-merchandising-and-bundling
description: Standard Operating Procedure (SOP) and AI heuristics for booth merchandising, online e-commerce combines/bundles, fixed-price multi-quantity lotting ($10 book packs, felt hat combines, starter bundles), 2-stage candidate retrieval, shelving lifecycle, and non-dev friendly UX.
---

# Resale Merchandising: Combines, Bundles & Multi-Channel Lotting SOP

This standard codifies the business heuristics, AI matching guardrails, physical booth shelving lifecycle, online e-commerce economics, and non-developer UX patterns for Resale Command.

---

## 1. Merchandising Strategy: Combines vs Bundles across Booths & Online

Merchandising in Resale Command is **channel-agnostic**—it drives velocity both on physical antique mall shelves (**Memory Den**, **Dusty Tiger**) and on digital marketplaces (**eBay**, **Etsy**, **Poshmark**, **Shopify**).

### A. The Fundamental Distinction: Combine vs Bundle

| Concept | Primary Driver | Item Relationship | Resale Goal | Example |
| :--- | :--- | :--- | :--- | :--- |
| **Combine** | **Volume & Format Stacking** | **Like-with-Like** (Identical format, medium, & era) | Clear low-dollar inventory fast; hit impulse flat-price points; maximize shipping weight efficiency. | 4 Fantasy mass-market paperbacks for $10.00; 2 vintage wool felt fedoras for $25.00; 4 rock cassettes for $12.00. |
| **Bundle** | **Thematic Lifestyle Companion Synergy** | **Cross-Category Curation** (Complementary accessories + main item) | Elevate average order value (AOV); escape race-to-the-bottom price matching; create ready-to-use gift sets. | Vintage D&D Player's Handbook + velvet polyhedral dice bag + pewter miniature; wool cowboy hat + tooled leather belt + western paperback. |

---

### B. Physical Booth Strategy (Memory Den & Dusty Tiger)
In physical antique malls, single low-dollar items ($2–$4 paperbacks, loose accessories, individual hats) create friction:
1. **Clutter**: Loose $2 items clutter booth shelves and look messy.
2. **Low Perceived Value**: Shoppers walk past them.
3. **Admin Friction**: Tracking individual $2 tags through Ricochet POS creates checkout fatigue.

**The Booth Solution**:
- **Combines**: Flat-price grab-and-go impulse bags ($10, $15, $20 flat bills). One shelf footprint returns $10–$20 instead of $2.50.
- **Bundles**: Curated tabletop displays that catch shopper eyes and sell an instant lifestyle or aesthetic.

---

### C. Online E-Commerce Strategy (eBay, Etsy, Poshmark)
Online sellers face the **"Shipping & Labor Trap"**:
- Selling a single $4 vintage paperback on eBay costs ~$4.50 in USPS shipping, plus 13% platform fees + $0.40 fee. Net profit is under $0.80 for 20 minutes of work.
- Mega-sellers (ThriftBooks, BetterWorldBooks) use automated algorithmic repricers to drive single-book prices to pennies.

**The Online Solution**:
1. **Combines (Media Mail & Weight Leverage)**:
   - Combine 5 fantasy paperbacks into a **$24.00 Author/Genre Lot**.
   - USPS **Media Mail** costs ~$4.60 for the entire bundle!
   - 1 photo shoot, 1 listing, 1 package to ship, netting **$16+ clean profit** (10x labor leverage).
2. **Bundles (Escaping Direct Price Matching)**:
   - Mega-sellers cannot create curated companion bundles.
   - An eBay listing for *"D&D 2E Handbook + Velvet Dice Bag + Metal Minis Starter Set"* has **zero direct competitors**, complete pricing power, and dominates long-tail search keywords across books, gaming, and gifts.

---

## 2. Category Synergy Heuristics & Matching Rules

When bundling or using AI to suggest items to add into a **Main Lot**, adhere to strict domain synergy:

| Category | Combine Rule (Like-with-Like) | Bundle Rule (Thematic Companion Synergy) | Anti-Pattern (DO NOT PAIR) |
| :--- | :--- | :--- | :--- |
| **Books** | Match by **genre, author, era, and format** (e.g. 4 DAW/Del Rey 1980s Fantasy paperbacks). | Pair with **thematic companion accessories** (e.g. Fantasy book + tarot deck; RPG book + polyhedral dice). | Fantasy paperback + calculus textbook + kid's board book. |
| **Vintage Hats** | Match by **style, era, and material** (e.g. Two 1970s wool felt fedoras). | Pair with **wearable / care accessories** (e.g. Wool felt hat + vintage hat brush or tooled leather belt). | Wool felt fedora + modern polyester baseball cap. |
| **Comics** | Match by **publisher, era, and character/universe** (e.g. 3 Bronze Age Spider-Man issues). | Pair with **collector companions** (e.g. 3 comics + matching vintage action figure or collector card set). | Indie black-and-white zine + Marvel superhero. |
| **Media / Music** | Match by **medium and genre** (e.g. 4 Classic Rock cassettes). | Pair with **lifestyle companions** (e.g. Rock vinyl + vintage band tee or turntable cleaner). | 1 cassette + 1 CD + 1 VHS tape. |
| **Gaming / TTRPG** | Match by **game system and edition** (e.g. 3 AD&D 2E sourcebooks). | Pair with **gameplay accessories** (e.g. Sourcebook + polyhedral dice + DM screen + pewter minis). | D&D sourcebook + unrelated golf video game. |

---

## 3. Two-Stage Candidate Retrieval (Zero AI Hallucination)

To prevent AI hallucinations and eliminate irrelevant suggestions, all suggestion pipelines **MUST** follow a 2-stage retrieval architecture:

```mermaid
flowchart TD
    A[In-Stock Inventory Catalog: 1,600+ items] -->|Stage 1: Full Thematic Fingerprint & Location Boost| B[Filtered & Ranked Candidates: <= 50 items]
    B -->|Stage 2: Gemini Multi-Channel Semantic Evaluation| C{Match Score >= 75?}
    C -->|Yes: Valid Combine or Companion Bundle| D[Top-Ranked Matches with Synergy Reason]
    C -->|No: Unrelated Category| E[Return Empty matches: []]
```

### Stage 1: Deterministic In-Memory Pre-Filtering (Full Thematic Fingerprint)
1. **Full Catalog Access**: Scan all in-stock items in memory (`inventoryItems`), excluding sold and already-combined items.
2. **The Full Thematic Fingerprint**:
   - Extract tokens not just from title, but from **Title + Tags/Keywords (`keywords` array) + Era/Aesthetic + Condition Notes**.
3. **Physical Location Affinity Scoring**:
   - **Same Storage Location (+20 pts)**: Items already in the same booth (`MD`) or backstock bin (`HG`) can be combined with zero operational friction.
   - **Unassigned Backstock (+10 pts)**: Items ready to be allocated anywhere.
   - **Cross-Mall Conflict (-15 pts)**: Items physically located at a different antique mall (e.g. Item in `DT` when lot is in `MD`) require physical transfer.
4. **Keyword & Tag Overlap Scoring**:
   - Keyword/Tag overlap: +15 pts per shared tag.
   - Format match: +20 pts.
5. **Top 50 Slicing**: Send the top 50 pre-scored candidates to the AI model.

### Stage 2: Strict LLM Negative Constraint & Mode Awareness
The AI prompt must explicitly mandate:
- **Distinguish Match Type**:
  - `type: 'combine'` (Format/genre volume stacking).
  - `type: 'bundle'` (Thematic cross-category companion accessory).
- **Negative Rejection Constraint**: If candidates do not share genuine format synergy or companion utility, return an empty array `{"matches": []}`.
- **Threshold**: Discard any match with `matchScore < 75`.

---

## 4. UI & UX Standards for Lot Matching

1. **Auto-Sort by Match Rank (Pin to Top)**:
   - When AI matches are returned, the candidate list **MUST** automatically sort the matched items to the very top, ordered by `matchScore` descending (e.g., 95%, 90%, 85%), followed by unmatched items.
2. **High-Contrast Glowing Visual Distinction**:
   - Matched cards must be unmistakably highlighted with an active accent border (`border-info ring-2 ring-info/40 bg-info/5`).
   - Prominent badge displaying match type and score: `✨ 95% Match • Companion Bundle` or `📦 90% Match • Format Combine`.
   - Clear synergy callout showing the exact merchandising reasoning.
3. **1-Click Bulk Selection**:
   - A single-tap `Select All AI Matches` button that auto-checks all high-synergy recommendations.

---

## 5. Booth Shelving & Restock Lifecycle

```
[1. Select Loose Items] ──> [2. Combine / Bundle into Main Lot] ──> [3. 1-Click Price Preset]
                                                                                │
[6. Physical Shelf Placed] <── [5. Print Ricochet Tag] <── [4. Shelve to Booth Location]
```

1. **Lot Assembly**: Merchant checks loose items or uses `➕ Add Items to Lot` in the Item Drawer.
2. **Pricing Preset**: Apply 1-click pricing preset ($10, $15, $25, or custom e-commerce price).
3. **Shelving Assignment**: Set storage location to `MD` (Memory Den) or `DT` (Dusty Tiger) and auto-queue into active Restock Pack.
4. **Thermal Barcode Label**: Ricochet tag formatted for 30–42 chars: `Fantasy Paperback Pack (4)`.
5. **Physical Check-In**: At the mall, vendor opens the **Restock Pack**, places items on shelves, and taps `Verify & Mark Placed`.

---

## 6. Non-Developer UX Invariants

| Engineering / ERP Jargon | Plain-English Booth Term | Vendor Definition |
| :--- | :--- | :--- |
| *Outbound Drop Manifest* | **Booth Restock Pack** (or **Take to Booth**) | The list of items packed in your tote to take to the mall today. |
| *Field Inventory* | **Currently in Booth** | Items physically on your booth shelves right now. |
| *Warehouse* | **Booth or Storage Location** | Memory Den, Dusty Tiger, or Backstock Totes. |
| *Reconciliation / SKU Sync* | **Record Booth Sales / Payout** | Uploading the monthly Ricochet sales report to see what sold. |
| *Verify Placement Item* | **Put on Shelf / Check-In** | Checking off items as you place them on booth shelves. |
| *Commission Rate %* | **Store Commission** | "Memory Den takes 15% ($1.50 on a $10 lot; you keep $8.50)." |
| *Monthly Rent $* | **Booth Rent & Breakeven** | "Rent is $150/mo. You need 18 x $10 book lots to cover rent!" |
| *Lot Merchandising Tools / Lineage* | **Playbook** | The game plan to maximize profit: Hero singles, themed combines, grab bags, and origin lineage. |
