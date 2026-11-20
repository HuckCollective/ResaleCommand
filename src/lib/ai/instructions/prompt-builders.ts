export function buildSpeedScoutUserPrompt(params: {
  authoritativeUserNotes?: string;
  scrapedListingContext?: string;
  organizationChannels?: string;
  shippingSummary?: string;
  calibrationBlock?: string;
  declaredUnitCount?: number;
}): string {
  const sections: string[] = [
    `[1. AUTHORITATIVE RESELLER NOTES (100% GROUND TRUTH OVERRIDE)]\n${params.authoritativeUserNotes ? params.authoritativeUserNotes.trim() : 'None provided.'}`,
    `[2. SCRAPED ONLINE LISTING METADATA (UNTRUSTED SELLER TEXT - VERIFY AGAINST PHOTOS)]\n${params.scrapedListingContext ? params.scrapedListingContext.trim() : 'In-person camera scan (No external listing URL).'}`,
    `[3. SHIPPING & FEE CONTEXT]\n${params.shippingSummary || 'Inbound shipping $0 (In-person) or estimate from screenshot.'}`,
    `[4. ORGANIZATION SELLING CHANNELS & BOOTH NICHES]\n${params.organizationChannels || 'Memory Den Booth #0EJ (Vintage Apparel, RPGs, Books, Media, Collectibles); eBay; Poshmark.'}`,
  ];

  if (params.calibrationBlock && params.calibrationBlock.trim()) {
    sections.push(
      `[5. CALIBRATION & FEE BASELINE (ADVISORY — NOT HUMAN OVERRIDE)]\n${params.calibrationBlock.trim()}`
    );
  }

  if (params.declaredUnitCount && params.declaredUnitCount >= 2) {
    sections.push(
      `[6. MULTI-ITEM LOT DECOMPOSITION REQUIREMENT]\nListing declares ${params.declaredUnitCount} physical units. You MUST populate 'lot_items' (>= 2 lines) and set 'detected_unit_count' to ${params.declaredUnitCount}. Extract standout/higher-value items visible via spine/cover OCR as individual 'showcase' singles (quantity: 1), group like series/author/format items into 'core' lines with 'quantity: N' and '(xN)' in the name, and group any remaining/unreadable units into a 'quick_turn' remainder pack line with 'quantity: N' and '(xN)' so that the sum of 'quantity' across all 'lot_items' equals ${params.declaredUnitCount}. All price fields on a line represent the LINE TOTAL for all 'quantity' units on that line.`
    );
  }

  return sections.join('\n\n').trim();
}

export function buildLotInspectionUserPrompt(params: {
  authoritativeUserNotes?: string;
  lotTitle?: string;
  targetQuantity?: number;
  sourcingLocation?: string;
  landedCost?: number;
  verifiedExistingItems?: any[];
  locationsSummary?: string;
  imageCount: number;
}): string {
  const hasVerifiedExisting = Boolean(params.verifiedExistingItems?.length);
  const isLargeUnverifiedLot =
    !hasVerifiedExisting && Boolean(params.targetQuantity && params.targetQuantity > 10);

  const verifiedExistingContext = hasVerifiedExisting
    ? `\n[VERIFIED CONSTITUENT ITEMS IN THIS LOT (${params.verifiedExistingItems!.length} verified items)]:\n` +
      JSON.stringify(params.verifiedExistingItems, null, 2) +
      `\nCRITICAL CONSTITUENT INSTRUCTION:\nThe seller has ALREADY split, cataloged, and verified these items! Use these verified items as the definitive catalog for this lot. Do NOT invent new items or hallucinate different categories.\n`
    : '';

  const countInstruction = hasVerifiedExisting
    ? `Match and inspect the ${params.verifiedExistingItems!.length} verified constituent items listed below 1-to-1. Do NOT merge or regroup verified items.`
    : isLargeUnverifiedLot
      ? `The reseller states this bulk lot contains ${params.targetQuantity} physical units (> 10 units). Decompose it into AT MOST 12 structured 'lot_items' rows whose 'quantity' values sum to EXACTLY ${params.targetQuantity}: extract the top 6-8 standout/hero titles legible via verbatim cover/spine OCR as individual 'showcase' singles (quantity: 1), roll matching author/series/format runs into grouped 'core' lines with 'quantity: N' and '(xN)' in 'name', and roll remaining common/unreadable units into a 'quick_turn' remainder floor pack with 'quantity: N' and '(xN)' in 'name'.`
      : params.targetQuantity && params.targetQuantity > 1
        ? `The reseller states this lot contains EXACTLY ${params.targetQuantity} items (<= 10 units). You MUST reconcile all photos to identify and extract all ${params.targetQuantity} distinct pieces 1-to-1 (quantity: 1 each, unless identical duplicate copies).`
        : `If <= 10 distinct physical pieces are visible in the gallery photos, identify and extract every piece 1-to-1 (quantity: 1). If > 10 physical pieces are visible in an uncounted bulk lot, extract the top 6-8 standout 'showcase' singles (quantity: 1) and roll remaining units into grouped 'core' and 'quick_turn' '(xN)' lines so total 'lot_items' stays <= 12 rows and 'quantity' values sum to the total visible unit count.`;

  const largeLotGroupingSection =
    !hasVerifiedExisting && (!params.targetQuantity || params.targetQuantity <= 1 || isLargeUnverifiedLot)
      ? `\n\n[5. LARGE LOT GROUPED DECOMPOSITION & LINE-TOTAL PRICING LAW]
- Threshold Rule: Use 1-to-1 per-piece extraction ONLY when the lot has <= 10 physical units. Whenever the lot has > 10 physical units (${params.targetQuantity ? `here: ${params.targetQuantity} units` : 'uncounted bulk lot'}), NEVER output > 12 rows in "lot_items".
- Required Bucket Structure (<= 12 total rows, sum(quantity) === ${params.targetQuantity && params.targetQuantity > 10 ? params.targetQuantity : 'total visible units'}):
  1. "showcase" (top 6-8 standout/hero titles legible from spine or cover OCR): output each as its own single row with "quantity": 1 and a tight per-item bounding_box + views[].
  2. "core" (remaining identifiable series, author, or format runs): roll into grouped rows with "quantity": N and "(xN)" at the end of "name", using a cluster/shelf bounding_box.
  3. "quick_turn" (remaining common, budget, or unreadable filler units): roll into 1-2 remainder pack rows with "quantity": N and "(xN)" at the end of "name", using a cluster/shelf bounding_box, so 100% of physical units are accounted for without duplicating any item.
- LINE TOTAL PRICING LAW: Every price field on a "lot_items" entry ("estimated_value", "pricing_potential", "price_breakdown", "buy_range") MUST equal the LINE TOTAL across all "quantity" units on that row (never per-unit when quantity > 1), and top-level "price_breakdown" must equal the sum of all "lot_items" line totals.`
      : '';

  return `
[1. GALLERY PHOTOS CONTEXT]
ALL ${params.imageCount} GALLERY PHOTOS ARE ATTACHED DIRECTLY TO THIS REQUEST:
Photo #1 through Photo #${params.imageCount}. Inspect every image carefully. Cross-reference group/overview shots with individual item closeups and spines.

[1b. MULTI-ANGLE VIEWS & BOUNDING BOXES (REQUIRED FOR EVERY lot_items ENTRY)]
- Photo #N in this prompt = image_index N-1 (0-based). Valid image_index range: 0 to ${Math.max(0, params.imageCount - 1)}.
- For every single-unit row (quantity: 1), return top-level "image_index": 0 (primary/front photo) and "bounding_box": [ymin, xmin, ymax, xmax] as integers 0-1000 (fraction of that photo's height/width) tightly enclosing ONLY that item. For grouped multi-unit rows (quantity > 1 in >10-unit bulk lots), return "bounding_box" and "views" enclosing the visible shelf row, stack, or cluster containing those grouped units.
- Also return "views": one entry for EVERY photo where this specific item appears: [{ "role": "front", "image_index": 0, "bounding_box": [ymin, xmin, ymax, xmax] }]. The first entry should be the primary front view.
- Cross-reference group overview shots: if Photo #1 shows fronts and Photo #2 shows the same items turned over, match each item to its back. Turning items over MIRRORS the left-to-right order (leftmost front = rightmost back) when flipped horizontally, so correlate by size, color, shape, and visible text rather than position alone.
- Cross-reference individual closeups (interior maps, inked/signed pages, copyright pages, flaw closeups, tags) and attach them to the matching item with role 'detail' or 'tag'. Never invent a view for a photo where the item is not visible.
- Every single entry in "lot_items" MUST explicitly follow this JSON pattern:
  {
    "name": "Example Item Title",
    "quantity": 1,
    "image_index": 0,
    "bounding_box": [ymin, xmin, ymax, xmax],
    "views": [
      { "role": "front", "image_index": 0, "bounding_box": [ymin, xmin, ymax, xmax] }
    ]
  }

[2. AUTHORITATIVE RESELLER NOTES (100% GROUND TRUTH OVERRIDE)]
${params.authoritativeUserNotes ? params.authoritativeUserNotes.trim() : 'None provided.'}

[3. LOT DETAILS & PURCHASE CONTEXT]
- Listing Title: "${params.lotTitle || 'Multi-Item Lot'}"
- Physical Count Target: ${countInstruction}
- Sourcing Location / Origin: "${params.sourcingLocation || 'N/A'}"
- Total Landed Purchase Cost: ${params.landedCost ? `$${params.landedCost}` : 'Not provided'}
${verifiedExistingContext}

[4. ORGANIZATION PHYSICAL BOOTHS & SELLING CHANNELS]
${params.locationsSummary || 'Memory Den Booth #0EJ (Vintage Apparel, RPGs, Books, Media, Collectibles); eBay; Poshmark.'}${largeLotGroupingSection}
`.trim();
}
