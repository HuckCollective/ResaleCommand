---
name: ai-scout-and-deep-scan-validation
description: Guidelines, invariants, and validation standards for Resale Command's AI vision engines (Speed Scout and AI Deep Scan), ensuring zero hallucinations, strict physical OCR grounding, user note authority, and financial math integrity.
---

# AI Scout & Deep Scan Vision Validation Standards

This skill documents the architectural invariants, prompt engineering rules, and verification standards for **Speed Scout** (`/api/identify-item.ts`) and **AI Deep Scan** (`src/lib/ai-inspection.ts`).

---

## 1. Engine Architectures & Responsibilities

| Dimension | Speed Scout (`/api/identify-item.ts`) | AI Deep Scan (`src/lib/ai-inspection.ts`) |
| :--- | :--- | :--- |
| **Primary Use Case** | Rapid single-item or lot intake, auction scouting, live purchase verdicts | Full multi-item lot breakdown, 3-tier booth cataloging, deep condition & channel strategy |
| **Image Input** | Single image or multi-photo array (all photos passed in 1 call) | Full multi-photo gallery (all photos passed directly via unified multimodal vision) |
| **Output Payload** | Single item or `lot_items` array with purchase strategy | `LotInspectionResult`: 3-tier `lot_items`, channel payouts, comprehensive condition overview |
| **Execution Model** | Single multimodal pass (Gemini 2.5 Flash) | Single unified multimodal pass (Gemini 2.5 Flash) |

---

## 2. Core Invariants (The Anti-Hallucination Laws)

### A. Physical Form Factor & Substrate First (Object First, Graphics Second)
- **The Rule**: Resale appraisal is physical-first. Always determine the 3D physical object type (material, container, and construction) **before** reading 2D surface graphics or artwork:
  - Turnable paper pages + bound spine $\rightarrow$ **Book / Periodical**.
  - Woven fabric + stitched seams + sizing $\rightarrow$ **Apparel / Garment**.
  - Flat wooden board, canvas, framed glass, or panel intended for display $\rightarrow$ **Wall Decor / Art**.
  - Molded plastic/resin with limbs/accessories $\rightarrow$ **Toy / Figure**.
  - Ceramic, porcelain, or glass vessel $\rightarrow$ **Drinkware / Pottery**.
  - Optical discs, game cartridges, consoles $\rightarrow$ **Media / Electronics**.
- **Surface Graphics Never Change Object Type**: A character, band logo, or franchise illustration printed ON an object does not alter its physical nature:
  - A fantasy painting on wood is **Wall Decor**, never a *Comic Book*.
  - A rock band logo on cotton is a **T-Shirt**, never an *Audio CD*.
  - A video game character on a mug is **Drinkware**, never a *Game Cartridge*.

### B. Verbatim Physical Grounding (OCR First)
- **Cover & Spine Reading**: Every item cataloged in `lot_items` must be visually anchored to text legibly printed on a cover, spine, tag, or hallmark.
- **Printed Copyright / Publication Year**: Always extract the printed copyright or publication year (e.g. `© 2000`, `© 2004`, `© 2009`). The vision model's general knowledge maps year to edition/era naturally without fragile hardcoded rules.
- **Zero Extrapolation Rule**: NEVER extrapolate or guess standard core franchise titles (e.g., do NOT invent *Player's Handbook*, *Monster Manual*, *Complete Warrior*, *Levi's 501*, or *Air Jordan 1*) unless that exact item's cover, tag, or spine is visibly present in the photos.

### C. The Anti-Generalization Law
- **Do Not Inherit Online Lot Titles**: Online auction titles often contain loose seller generalizations (e.g. labeling an entire mixed lot "3.5 Edition" when individual modules are 3.0 or 4e, or labeling a lot "Vintage 1970s" when pieces are from 1990).
- **Rule**: Every individual component in a lot must be classified based on its own visible cover design, logos, and printed publication/copyright year—never by blindly copying the auction title onto every item.

### D. Prohibition of Category-Specific Hardcoding in Prompts
- **NO Fragile Cheat Sheets**: Never inject hardcoded lists of specific editions (e.g., D&D 3.0 vs 3.5 vs 4e tables) or artist/artwork titles (e.g., Frank Frazetta wood plaques) into general prompts.
- **Why**: Hardcoded trivia introduces severe prompt bias, consumes unnecessary token window, and skews attention away from legitimate visual text when scanning other merchandise categories (apparel, electronics, collectibles).

### E. Unified Multimodal Vision (Never Strip Images)
- **Zero Blind Synthesis**: When consolidating multi-photo lots, **never** perform text-only synthesis on stripped image descriptions.
- **Unified Context**: All gallery photos (overview shots, spine angles, closeups) must be supplied directly to Gemini in the same request. This enables Gemini to cross-reference multiple views and eliminate duplicate counts.

### F. User Notes as Authoritative Ground Truth
- When a reseller enters notes or corrections (e.g., `"DMG is 3.0, Ashen Crown is 4e"` or `"Lot contains 8 books"`), the AI prompt must treat those notes as **100% authoritative ground truth**.
- User corrections always override automated visual inferences.

### G. Sourcing Lifecycle Guardrail: Scout vs. Deep Scan
- **Pre-Acquisition (`status !== 'acquired'` / scouting drafts)**:
  - Strictly use **Speed Scout AI** (`/api/identify-item.ts`).
  - Running multi-image Deep Scan or extracting constituent lots on unowned inventory is prohibited to conserve API cost and avoid cluttering catalog with unpurchased goods.
- **Post-Acquisition (`status === 'acquired'` or in active inventory)**:
  - Unlocks full multi-image **AI Deep Scan** (`src/lib/ai-inspection.ts`) and the **Lot Profit Playbook**.
  - Replaces obsolete pre-buy advice with actionable exit merchandising tiers (Hero recovery, Themed Combines, Booth packs).

---

## 3. Merchandising & Substrate Rules

### A. Multi-Disc & Multi-Part Rule
- **2-CD / Multi-Disc Sets**: A 2-disc CD album or multi-disc media set is strictly **ONE inventory item** (1 sellable unit). Never split individual discs into separate `lot_items`.
- **Book / Game Lots**: Distinct adventure modules, sourcebooks, or cartridges sold in a collection get split into individual `lot_items`.

### B. Substrate Verification
- **Books & Periodicals**: Only classify as books if bound spines, paper pages, or staple bindings are visibly present.
- **Wall Art & Mounted Plaques**: Art prints mounted on wooden boards, plaques, or framed glass are **WALL ART / WALL DECOR**. Never classify wall art as books, comics, or magazines.
- **Apparel & Workwear**: Look for stitched seams, fabric weave, inner brand tags, and wash tags.

---

## 4. Financial & Pricing Invariants

1. **Split Cost Conservation**:
   $$\sum (\text{Component Split Costs}) = \text{Total Lot Landed Cost}$$
2. **Pricing Matrix Hierarchy**:
   $$\text{Mint Price} \ge \text{Boutique Premium Price} \ge \text{Fair Market Price} \ge \text{Poor Price}$$
3. **Physical Thermal Tag Title Limit**:
   - `tag_title` must be strictly $\le 40$ characters for clean Rollo and Ricochet barcode label printing.

---

## 5. Testing & Validation Checklist

Before releasing changes to `identify-item.ts` or `ai-inspection.ts`, verify:
- [ ] Multi-item lots accurately count physical items without phantom additions.
- [ ] No hallucinated core rulebooks appear on tabletop RPG lots.
- [ ] Visible copyright years and editions are transcribed accurately from covers/spines.
- [ ] User notes cleanly override visual guesses.
- [ ] The app builds cleanly with zero TypeScript errors: `npm run build`.
