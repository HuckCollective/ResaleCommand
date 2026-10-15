# Financial & Price Parsing Invariants (The Anti-Range Concatenation Law)

## 1. Absolute Prohibition of Destructive Character Stripping on Prices
**NEVER** use regex character-stripping patterns like:
- ❌ `val.replace(/[^0-9.]/g, '')`
- ❌ `val.replace(/[^0-9.-]/g, '')`
- ❌ `val.replace(/\D/g, '')`
- ❌ `parseFloat(str.replace(/[^0-9.]/g, ''))`

### Why This is a Fatal Regression:
Price estimates, appraisal metrics, and catalog entries produced by AI vision (Speed Scout, AI Deep Scan) or scrapers frequently contain **price ranges**:
- `"$50 - $65"` (e.g., Book of Exalted Deeds)
- `"$35 - $45"` (e.g., Player's Handbook)
- `"$15 - $25"` (e.g., floor fillers)

When `.replace(/[^0-9.]/g, '')` is applied to `"$50 - $65"`:
1. The `$` is stripped.
2. The `-` (hyphen) and spaces are stripped.
3. The remaining digits concatenate into `"5065"` $\rightarrow$ **`$5065.00`**!
4. Two book hero items ($5065 + $3545) become an **$8,610.00** gross tag on a $38 lot, generating impossible **+19,835% ROI** spikes.
5. If sent to thermal label printing, the physical tag prints a barcode for $5,065.00.

---

## 2. Mandatory Standard: `parsePriceValue()`
Whenever parsing price, cost, boutique value, appraisal estimate, or fee values from unknown strings, ALWAYS use:

```ts
import { parsePriceValue } from '@/lib/lot-strategy';

// Midpoint (Default for calculations & financial totals)
const priceNum = parsePriceValue(item.val || item.resalePrice, 'midpoint', fallback);

// Bounds
const lowPrice = parsePriceValue(item.val, 'low', fallback);
const highPrice = parsePriceValue(item.val, 'high', fallback);
```

### What `parsePriceValue()` Guarantees:
1. **Zero Concatenation**: Extracts discrete numbers; `"$50 - $65"` becomes `58` (midpoint), `50` (low), or `65` (high).
2. **Dollar Anchoring**: Prioritizes `$` amounts (`"D&D 3.5 ($35 - $45)"` cleanly extracts 35 & 45, ignoring the non-price edition number `3.5`).
3. **Comma Normalization**: Cleans thousands separators (`"$1,200.00"` $\rightarrow$ `1200.00`, never `[1, 200]`).
4. **Display Preservation**: Preserves human-readable strings like `"$50 - $65"` on UI pill badges while using numeric midpoints for financial math.

---

## 3. Financial Sanity & ROI Grounding Invariants
1. **Component Sum Authority**:
   $$\text{Projected Split Yield} = \sum (\text{Hero Singles} + \text{Themed Combines} + \text{Floor Fillers})$$
   Never override real cataloged component sums with hardcoded prompt artifacts (e.g. 180 / 275 / 110).
2. **Gross Margin Sanity Guardrail**:
   Standard resale inventory lots must never output ungrounded astronomical ROIs ($> +1,000\%$) unless physically confirmed by authenticated high-value single items.
3. **Thermal Barcode Printing Integrity**:
   Thermal label generators ([`rolloLabelPrint.ts`](file:///c:/Users/15034/Projects/ResaleCommand/src/lib/rolloLabelPrint.ts), [`pdfLabelGenerator.ts`](file:///c:/Users/15034/Projects/ResaleCommand/src/lib/pdfLabelGenerator.ts)) must always resolve prices through `parsePriceValue()` to ensure physical printed tags match verified catalog numbers.
