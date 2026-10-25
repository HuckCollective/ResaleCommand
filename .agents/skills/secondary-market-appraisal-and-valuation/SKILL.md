---
name: secondary-market-appraisal-and-valuation
description: Enforce realistic, cash-cleared secondary market valuations and channel-specific fee modeling (Poshmark 20%, eBay, Memory Den) for Resale Command, eliminating retail MSRP anchoring and fee calculation bias.
---

# Secondary Market Inventory Appraisal & Valuation Engine

This skill governs how Resale Command appraises inventory, evaluates secondary comps, models platform fee structures, and validates pricing playbooks across online and physical channels.

---

## 1. The Core Purpose: Elimination of Retail & Active Listing Bias

When appraising resale merchandise (vintage apparel, leather jackets, streetwear, collectibles, tabletop), AI models naturally exhibit two destructive biases:
1. **Retail MSRP Anchoring**: Quoting original brand new manufacturer prices (e.g. $1,050 for a leather jacket) rather than real secondary market cash clearance.
2. **Active Listing Delusion**: Basing value on what unsold hopeful sellers are currently asking on eBay or Poshmark rather than what real buyers actually paid.

This engine enforces **cash-cleared reality** and **exact platform net margins**.

---

## 2. Appraisal Rules & Comp Hierarchy

### A. The Comp Hierarchy Law
1. **Tier 1 (Sole Ground Truth)**: Historical completed/cleared sales:
   - **eBay Sold Items** (recent completed transactions within 90 days)
   - **Poshmark Sold** (real accepted offers and Buy It Now sales)
   - **Grailed / Depop / Mercari Cleared Sales**
2. **Tier 2 (Market Ceiling Context Only)**: Active competitive listings:
   - Use active listings *only* to gauge current supply density and competition.
   - **NEVER** use active asking prices as the baseline Fair Market Value (FMV).
3. **Tier 3 (PROHIBITED for Valuation)**:
   - Manufacturer Retail MSRP is **forbidden** as a secondary market valuation anchor.
   - Retail MSRP may only be cited for buyer psychology in listing copy (e.g. *"Original Retail $850 — Save 65%"*), never in inventory equity or net profit projections.

### B. Condition Baselines
- Default baseline condition is **"Pre-owned - Very Good"** unless:
  - New With Tags (NWT) / Deadstock packaging is visibly authenticated.
  - Visible defects, tears, stains, patina, or hardware wear are explicitly noted.
- Condition discounts from mint comps:
  - Excellent / Like New: 85% - 95% of top comp
  - Very Good (Default): 70% - 80% of top comp
  - Good / Moderate Wear: 50% - 65% of top comp
  - Fair / Distressed: 30% - 45% of top comp

### C. Extended Vintage & Specialty Sizing Premiums
- In vintage outerwear and workwear (e.g. Schott NYC, Schott Perfectos, Carhartt Detroit, vintage denim):
  - Standard sizes (38–42, M–L) represent normal liquidity.
  - Extended sizes (48–52, XL–XXL) carry a **15% to 20% rarity/liquidity premium** due to scarcity on the secondary market.
  - *Constraint*: Extended sizing premiums must still be grounded in cleared comp bands for that specific size range.

---

## 3. Platform Fee Matrix (Strict Multi-Channel Schedules)

Never use a blended generic fee (e.g. a flat 10% or 15%) across different selling channels. Apply exact channel fee structures:

| Channel | Fee Formula | Payout Rules & Thresholds |
| :--- | :--- | :--- |
| **Poshmark** | **Flat 20.0%** on sales $\ge \$15.00$ ($2.95 flat fee if $< \$15.00$) | Buyer pays standard shipping (up to 5 lbs). **Overweight Alert**: If item $> 5$ lbs (e.g. heavy leather jacket, boots, bulk lot), seller must pay upgraded label difference ($4.50–$22.50). |
| **eBay Standard** | **13.25% - 15.0%** final value fee + **$0.40** fixed per order | Final value fee applies to item price + shipping paid by buyer. Category variations apply. |
| **Physical Booth (Memory Den Booth 0EJ)** | **15.0%** consignment mall fee + **$382.50/mo** booth rent | 85% paid to consignor/curator; booth rent is covered through the shared Commons Pool. |
| **Direct / Cash / Local Pop-Up** | **0% - 2.9%** (Stripe/Square card processing) | Maximum net retention. |

---

## 4. Output Schema & Liquidity Tiers

Every generated appraisal and exit playbook MUST provide three distinct price targets:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Quick Liquidity Floor (7 - 14 Days)                      │
│    - Fast cash clearance price (~20-25% below median comp)  │
│    - For immediate capital turnover or moving stale stock   │
├─────────────────────────────────────────────────────────────┤
│ 2. Realistic Market Median (30 - 45 Days)                   │
│    - Standard secondary clearing price where 80% settle     │
│    - Baseline for realized ROI and inventory valuation      │
├─────────────────────────────────────────────────────────────┤
│ 3. Strategic Listing Tag (60 - 90+ Days)                    │
│    - Ceiling listing price leaving room for negotiation     │
│    - Provides room for 15-20% "Offer to Likers" (OTL)       │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Automated Validation & Evaluator Standards (Pre-Display Check)

Before any playbook or appraisal is saved to the database or displayed on an item card, run these automated validation invariants:

1. **Net Profit Mathematical Integrity**:
   $$\text{Projected Net Profit} = \text{Sticker Price} - \text{Estimated Channel Fees} - \text{Landed Purchase Cost}$$
2. **Poshmark Fee Verification**:
   If `channel === 'Poshmark'`, assert:
   $$\text{Fee} = \begin{cases} \$2.95 & \text{if } \text{Sticker} < \$15.00 \\ \text{Sticker} \times 0.20 & \text{if } \text{Sticker} \ge \$15.00 \end{cases}$$
3. **Ceiling Outlier Guardrail (Anti-MSRP Hallucination)**:
   If $\text{Sticker Price} > 2.0 \times \text{Median Sold Comp}$, flag as:
   `⚠️ High Risk / Ceiling Warning: Price exceeds 2x median secondary comp. Verify item is not anchored to retail MSRP.`
4. **Overweight Shipping Guardrail**:
   If `channel === 'Poshmark'` and physical weight $> 5\text{ lbs}$, flag:
   `⚠️ Overweight Shipping Alert: Poshmark base label covers up to 5 lbs. Heavy coats/boots require label upgrade deductions.`
