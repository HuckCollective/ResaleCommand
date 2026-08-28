# Physical Booth Operations & Multi-Item Lot Curation Rules

This rule defines the core domain logic for managing physical antique mall booths (e.g. Memory Den, DustyTiger) and multi-item lot curation in Resale Command.

## 1. The 3-Tier Physical Booth Lifecycle
Every multi-item lot (magazines, books, clothing bundles, video games, collectibles) follows this 3-tier split-off and pricing strategy:

1. **🌟 Tier 1: Standout Keys & Rare Issues ($25.00 – $65.00+ each)**
   - **Strategy**: Split off as **single individual items**.
   - **Tagging**: Dedicated high-dollar barcode tags, bagged & boarded in showcase/feature displays.

2. **📦 Tier 2: Mid-Tier Collectibles ($12.00 – $22.00 each / $35.00 – $60.00 sets)**
   - **Strategy**: Split off as a **multi-quantity listing** (e.g. "Vintage Heavy Metal Magazine (1980s-90s)" - Qty: 15 @ $16.00/ea).
   - **Tagging**: Print identical bulk barcode stickers to tag the entire run in 1 minute.

3. **🛒 Tier 3: Reader Value Copies ($6.00 – $8.00 / unit or $24.00 – $45.00 / 3-5 pack)**
   - **Strategy**: Split off as **multi-quantity floor-bin listings** ($8.00/ea) or pre-bagged **3–5 issue grab-bags** ($22.00–$35.00).
   - **Tagging**: Fast-turnover impulse bin tagging.

## 2. Standardized AI Component Naming
All individual items extracted by AI must follow this strict naming format:
`[Tier Name] Publication/Brand - Exact Issue Month Year (Vol/No/Model) - Key Feature/Cover Artist/Size`

## 3. End-to-End Workflow
1. Ingest master lot & record total landed buy cost.
2. AI 3-tier inspection & cataloging.
3. Split off into Standout Singles, Multi-Qty Runs, and Reader Bundles.
4. Export/upload SKUs to Memory Den POS software.
5. Print barcode labels, tag items, stock booth.
6. Reconcile sales receipts back to inventory profit tracking.
