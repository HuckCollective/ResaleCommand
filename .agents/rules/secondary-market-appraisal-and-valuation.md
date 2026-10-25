# Secondary Market Inventory Appraisal & Valuation Invariants

This rule governs prompt engineering, AI pricing generation, and channel fee validation across Resale Command.

---

## 1. Absolute Prohibition of Retail MSRP Anchoring
- **Secondary Comps Only**: All item valuations, baseline resale prices, and profit projections must anchor exclusively to completed/cleared secondary sales (eBay Sold, Poshmark Sold, Grailed Cleared).
- **No Retail MSRP in Projections**: Brand new retail MSRP (e.g., $1,050 for a leather jacket) must NEVER be used as the expected secondary sale price. It may only be cited in listing marketing copy ("Original retail $X, save Y%").

---

## 2. Multi-Channel Fee Accuracy
When modeling channel profitability or exit playbooks:
- **Poshmark**: Flat 20.0% fee on items $\ge \$15.00$ ($2.95 if $< \$15.00$). Add weight warning for coats/boots $> 5$ lbs.
- **eBay**: 13.25% - 15.0% + $0.40 order fee.
- **Memory Den Booth 0EJ**: 15.0% mall commission. Booth rent ($382.50) is covered by the shared Commons Pool.
- **No Generic Blends**: Never use a single generic 10% or 15% fee across different channels.

---

## 3. The 3 Liquidity Tiers Requirement
Every valuation or playbook recommendation must provide:
1. **Quick Liquidity Floor (7-14 Days)**: ~20-25% below median for rapid cash recovery.
2. **Realistic Market Median (30-45 Days)**: Standard clearing price where ~80% of comps settle.
3. **Strategic Listing Tag (60-90+ Days)**: High ceiling leaving room for 15-20% "Offer to Likers" (OTL).

---

## 4. Evaluator / Validation Hook Invariants
Before accepting or rendering playbook prices:
1. `(Sticker Price - Estimated Fees - Landed Cost) == Projected Net Profit`.
2. For Poshmark targets: `Fee == Sticker Price * 0.20` (for $\ge \$15$).
3. If `Sticker Price > 2.0 * Median Sold Comp`, trigger a **"High Risk / Ceiling Warning"** requiring manual verification.
