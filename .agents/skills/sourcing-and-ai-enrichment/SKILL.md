---
name: sourcing-and-ai-enrichment
description: Guide to sourcing channel capabilities (ShopGoodwill CSV & API, receipt OCR, barter/cash) and Gemini Multimodal AI Deep Scan extraction for Resale Command.
---

# Sourcing Sources & AI Deep Scan Capabilities

This skill documents the exact data capabilities of every sourcing channel and how they pair with Gemini Multimodal AI Deep Scan during the Haul Intake lifecycle.

---

## 1. Sourcing Channels: What Each Source Can Give Us

### A. ShopGoodwill (Online Auction Hauls)
ShopGoodwill is currently our most comprehensive automated online source.

| Channel / Mechanism | What It Gives Us | Known Quirks & Limitations |
| :--- | :--- | :--- |
| **Shipped Orders CSV** (`BulkImport.vue`) | • `Order #` (PO identification)<br/>• `Item Id` (Numeric ID: `274480963`)<br/>• `Order Date` / Shipped Date<br/>• **Landed Cost Allocation**: Base bid, shipping, handling, and tax accurately divided across lines<br/>• `Tracking #` & Carrier<br/>• Shipping facility/seller | • **Truncated Titles**: SGW truncates titles to 20 characters in CSV exports (e.g., `Dehen University Vin`).<br/>• **BOM Character**: Often contains an invisible Byte Order Mark (`\ufeff`) on `Order #`.<br/>• **No Photos**: CSV does not contain auction images. |
| **ShopGoodwill Buyer API** (`/api/proxy-item-details`) | • **Full, Untruncated Title** (e.g. `Dehen 1920 Vintage Wool Letterman Jacket`)<br/>• Full seller description & condition notes<br/>• Official auction photos (`imageURL` + gallery array)<br/>• Winning bid price | • Buyer API can occasionally rate-limit or fail if items are older than 90 days. |

### B. In-Person Retail & Thrift Receipts (`SpeedEntryForm.vue`)
Used for live thrifting runs (Goodwill, St. Vincent de Paul, Estate Sales).
* **Live Camera Receipt OCR**:
  * Extracts: Store/Vendor name, Date, Total Spent, and line-item prices.
  * Landed Cost: Usually $0 shipping/handling, just subtotal + local sales tax.
  * Limitation: Receipts do not contain product names—only cryptic register codes like `BL WMN SWTR $7.99` or `HH GOOD $4.50`.

### C. Handshake Deals, Barters & Cash Swaps
Zero paperwork sourcing (Flea markets, garage sales, friend swaps).
* **Manual Quick PO / Walk-in Intake**:
  * User inputs: Deal Name (*"Traded Dave for Stereo"*) + Total Cost Basis (*$0* or cash out of pocket).
  * Line items start with $0 or equal split cost basis.

### D. Future Online Sources (In Planning / Scraper Support)
* **eBay**: URL parser (`/api/identify-item`) can scrape listing title, seller asking price, shipping cost, and high-res image gallery.
* **Facebook Marketplace**: URL parser extracts title, asking price, and seller location.
* **HiBid / GovDeals / EstateSales.net**: Currently manual PO or receipt upload; CSV formats pending.

---

## 2. Gemini Multimodal AI Deep Scan Capabilities

AI Deep Scan (`/api/identify-item.ts`) uses Gemini 2.5 multimodal vision. It takes **physical unboxing photos** and transforms them into commercial boutique inventory.

### What AI Deep Scan Extracts:
1. **Physical Tag Title (`tag_title`)**:
   * Strictly **30–42 characters max** for physical thermal barcode price tags (Memory Den Ricochet & DustyTiger Rollo).
   * Formatted cleanly without generic buzzwords: `[Brand] [Item/Model] ([Spec/Size])` (e.g., `Carhartt Detroit Jacket (L)` or `Kenner Star Wars Boba Fett 1979`).
2. **Full SEO Title (`title`)**:
   * 80-character marketplace-ready title optimized for eBay/Poshmark search algorithms.
3. **Verbatim Text OCR (`ocr_detected_text`)**:
   * Reads clothing tags, RN numbers, single-stitch hems, copyright marks (e.g., `© 1979 L.F.L. Kenner`), magazine mastheads, issue numbers, and hallmarks (`925 Sterling`, `14K`).
4. **Boutique Pricing (`price_breakdown.boutique_premium`)**:
   * Suggests high-end physical antique mall / curated boutique retail pricing (e.g., `$45 - $65`).
   * Condition tiers: `mint`, `fair`, `poor`.
5. **Item Strategy & Comp**:
   * Strategic verdict (`BUY_NOW`, `PASS`, `WATCH`, `CHASE_AUCTION`), recommended max bid, and recent market comparables.

### Category-Specific Vision Expertise:
* **Vintage Apparel & Streetwear**: Detects RN#, Made in USA tag indicators, single-stitch vs double-stitch, wash tags, fabric blend (100% Cotton vs 50/50).
* **Vintage Print, Magazines & Comics**: Reads Month, Year, Volume, and Issue Number from the date box or spine; identifies cover artists.
* **Tabletop RPGs & Books**: Detects edition (1st Print, 3.5e, 5e, TSR vs Wizards of the Coast), spine condition.
* **Electronics & Audio**: Reads model/serial numbers (Canon Rebel, Walkman, receivers) and tests condition.
* **Toys & Collectibles**: Reads manufacturer copyright stamps and accessory completeness.

---

## 3. The Power Pairing: Sourcing Data + AI Deep Scan

The optimal workflow in Resale Command does **not** rely on fragile web scraping when you already have the physical item:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. SOURCING (ShopGoodwill CSV / Receipt)                               │
│    • Provides: Order #, Tracking #, Landed Cost ($12.50)               │
│    • Holds placeholder in Purchases until the box arrives              │
└────────────────────────────────────────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. PHYSICAL UNBOXING (Haul Intake)                                     │
│    • User places item on desk & snaps 1 real photo                     │
└────────────────────────────────────────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. GEMINI AI DEEP SCAN                                                 │
│    • Fixes truncated title: "Dehen University Vin" ➔ Real Full Title   │
│    • Generates 30-42 char tag: "Dehen 1920 Wool Letterman (L)"         │
│    • Multiplies Landed Cost ($12.50) into Boutique Retail ($45.00)     │
└────────────────────────────────────────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 4. MULTI-CHANNEL TAKEAWAYS                                             │
│    • Ricochet POS CSV for Memory Den                                   │
│    • Rollo thermal tags for DustyTiger                                 │
│    • Scannable QR thermal labels for Backstock Bins                    │
│    • Item activated in In-Stock inventory                              │
└────────────────────────────────────────────────────────────────────────┘
```
