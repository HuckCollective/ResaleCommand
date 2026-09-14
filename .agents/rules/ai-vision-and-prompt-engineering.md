# AI Vision & Prompt Engineering Standards

Universal invariants and behavioral constraints for all AI vision, item identification, lot scouting, and prompt engineering in Resale Command.

---

## 1. Physical Substrate First (Object First, Graphics Second)
- **3D Form Factor Precedes Surface Graphics**: Always determine the physical object type (material, container, and construction) **before** reading surface artwork:
  - Turnable paper pages + bound spine $\rightarrow$ **Book / Periodical**.
  - Woven fabric + stitched seams + sizing tag $\rightarrow$ **Apparel / Garment**.
  - Flat wooden board, canvas, framed glass, or hanging panel $\rightarrow$ **Wall Decor / Art Print**.
  - Molded plastic/resin with articulated limbs/accessories $\rightarrow$ **Toy / Action Figure**.
  - Ceramic, porcelain, or glass vessel $\rightarrow$ **Drinkware / Pottery**.
  - Optical discs, ROM cartridges, circuit boards $\rightarrow$ **Media / Electronics**.
- **Surface Graphics Never Change Object Type**:
  - A fantasy painting or comic illustration printed on a wooden plaque is **Wall Art**, never a *Comic Book*.
  - A band photo printed on cotton is a **T-Shirt**, never an *Audio CD*.
  - A video game character on a mug is **Drinkware**, never a *Video Game*.

---

## 2. Verbatim Physical Grounding (Zero Extrapolation)
- **Verbatim Text OCR**: Every item cataloged in `lot_items` must be visually anchored to text legibly printed on its cover, spine, hallmark, or tag.
- **Printed Copyright & Publication Year**: Always extract visible copyright years (e.g. `© 2000`, `© 2003`, `© 2008`). The model's general knowledge maps years to editions cleanly without prompt cheats.
- **Zero Extrapolation Law**: NEVER guess or extrapolate common franchise staples (e.g., do NOT invent *Player's Handbook*, *Monster Manual*, *Complete Warrior*, *Levi's 501*, or *Air Jordan 1*) unless that specific item's cover or tag is visibly present in the photos.

---

## 3. The Anti-Generalization Law
- **Do Not Inherit Online Lot Titles**: Sellers frequently post loose generalizations (e.g. labeling a mixed lot "3.5 Edition" when items inside are 3.0 or 4e, or labeling a lot "Vintage 70s" when items are from 1995).
- **Rule**: Every individual component in a lot must be classified strictly based on its own visible cover art, logos, and printed year—never by blindly copying the auction title onto every item.

---

## 4. Absolute Prohibition of Prompt Hardcoding
- **NO Fragile Cheat Sheets**: Never inject hardcoded lists of editions (e.g., D&D edition tables) or specific artist/item lists (e.g., Frank Frazetta wood plaques) into prompts or global `SYSTEM_INSTRUCTION`s.
- **Why**: Hardcoded trivia introduces severe prompt bias, pollutes attention heads, and breaks identification across other categories (apparel, electronics, collectibles).

---

## 5. User Notes as 100% Authoritative Ground Truth
- When a reseller enters notes or corrections (e.g., `"DMG is 3.0, Ashen Crown is 4e"` or `"Lot contains 8 books"`), the prompt must treat those notes as **100% authoritative ground truth**.
- User corrections always override automated visual inferences.
- **Never Prepend Auction Titles**: Never silently concatenate the auction listing title into user notes.

---

## 6. Unified Multimodal Vision (Zero Blind Synthesis)
- Consolidate multi-photo lots by passing all gallery images directly into Gemini in a single multimodal call (`inlineData: { data, mimeType }`).
- Never strip images down to text descriptions for a second blind text-only synthesis pass.

---

## 7. Item Report Card IA/UX Standards
- **Title Breathing Room**: Titles must have `flex-1 min-w-0` to wrap naturally over 1–2 lines without vertical squishing.
- **Compact Condition Pill**: Condition summaries must be concise 1–2 word pills (`Mint`, `Good`, `Fair`, `Poor`) positioned in the top-right corner using semantic DaisyUI badge classes.
- **Condition Notes Placement**: Specific condition details and flaws must sit directly below the title in an italicized subtitle (`text-[11px] text-base-content/70 italic`).
- **Financial Metrics Integrity**: Bottom metrics bar must cleanly display Boutique, Fair, Buy Range, and split cost basis without overflowing.
