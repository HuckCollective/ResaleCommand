import { parsePriceValue } from '../../lot-strategy';
import type { LotInspectionResult, ComponentItem } from '../../ai-inspection';

export function verifyAndSanitizeLotResult(
  raw: LotInspectionResult,
  landedCost?: number
): LotInspectionResult {
  const items: ComponentItem[] = Array.isArray(raw.lot_items) ? raw.lot_items : [];

  // 1. Sanitize each component item
  const sanitizedItems: ComponentItem[] = items.map((item, idx) => {
    const cleanName = (item.name || item.identity || `Item #${idx + 1}`)
      .replace(/\[Tier \d[^\]]*\]\s*/i, '')
      .trim();

    // Enforce <= 40 char thermal tag limit
    const rawTag = (item as any).tag_title || cleanName;
    const cleanTag = rawTag.replace(/\[Tier \d[^\]]*\]\s*/i, '').trim().slice(0, 40);

    // Safe price extraction using parsePriceValue (Anti-Concatenation Law)
    const fairMid = parsePriceValue(item.price_breakdown?.fair || item.estimated_value, 'midpoint', 15);
    const boutiqueMid = Math.max(
      fairMid,
      parsePriceValue(item.price_breakdown?.boutique_premium, 'midpoint', Math.round(fairMid * 1.25))
    );
    const mintMid = Math.max(
      boutiqueMid,
      parsePriceValue(item.price_breakdown?.mint, 'midpoint', Math.round(boutiqueMid * 1.25))
    );
    const poorMid = Math.min(
      fairMid,
      parsePriceValue(item.price_breakdown?.poor, 'midpoint', Math.max(2, Math.round(fairMid * 0.45)))
    );

    const isKey = item.tier === 'showcase' || Boolean(item.is_key_issue);
    const isQuick = !isKey && item.tier === 'quick_turn';
    const tierVal: 'showcase' | 'core' | 'quick_turn' = isKey ? 'showcase' : isQuick ? 'quick_turn' : 'core';

    const bBox = (item as any).bounding_box || undefined;
    const imgIdx = (item as any).image_index !== undefined ? (item as any).image_index : 0;
    const views = Array.isArray((item as any).views) && (item as any).views.length > 0
      ? (item as any).views
      : (bBox ? [{ role: 'front', image_index: imgIdx, bounding_box: bBox }] : undefined);

    return {
      ...item,
      name: cleanName,
      identity: (item.identity || cleanName).replace(/\[Tier \d[^\]]*\]\s*/i, '').trim(),
      tag_title: cleanTag,
      tier: tierVal,
      tier_label: isKey ? '🌟 Showcase' : isQuick ? '⚡ Quick Turn' : '📦 Core',
      tier_number: isKey ? 1 : isQuick ? 3 : 2,
      is_key_issue: isKey,
      estimated_value: item.estimated_value || `$${fairMid}`,
      price_breakdown: {
        mint: item.price_breakdown?.mint || `$${mintMid}`,
        boutique_premium: item.price_breakdown?.boutique_premium || `$${boutiqueMid}`,
        fair: item.price_breakdown?.fair || `$${fairMid}`,
        poor: item.price_breakdown?.poor || `$${poorMid}`
      },
      image_index: imgIdx,
      image_url: (item as any).image_url || undefined,
      bounding_box: bBox || (views && views[0]?.bounding_box ? views[0].bounding_box : undefined),
      views: views
    };
  });

  // Sort with Hero Anchor at slot #1 descending by Boutique value
  sanitizedItems.sort((a, b) => {
    const aHero = a.tier_number === 1 || Boolean((a as any).anchor || (a as any).hero || (a as any).is_anchor || (a as any).is_hero);
    const bHero = b.tier_number === 1 || Boolean((b as any).anchor || (b as any).hero || (b as any).is_anchor || (b as any).is_hero);
    if (aHero && !bHero) return -1;
    if (!aHero && bHero) return 1;

    const aVal = parsePriceValue(a.price_breakdown?.boutique_premium || a.estimated_value, 'midpoint', 0);
    const bVal = parsePriceValue(b.price_breakdown?.boutique_premium || b.estimated_value, 'midpoint', 0);
    if (bVal !== aVal) return bVal - aVal;

    return (a.tier_number || 2) - (b.tier_number || 2);
  });

  // 2. Deterministic Component Sum Authority (Replaces hardcoded prompt artifacts)
  if (sanitizedItems.length > 0 && raw.exit_strategy) {
    const realSplitSum = sanitizedItems.reduce((sum, item) => {
      return sum + parsePriceValue(item.price_breakdown?.boutique_premium || item.estimated_value, 'midpoint', 15);
    }, 0);

    const realFairSum = sanitizedItems.reduce((sum, item) => {
      return sum + parsePriceValue(item.price_breakdown?.fair || item.estimated_value, 'midpoint', 12);
    }, 0);

    const bulkYield = Math.round(realFairSum * 0.65);
    const splitYield = Math.round(realSplitSum);
    const increasePct = bulkYield > 0 ? Math.round(((splitYield - bulkYield) / bulkYield) * 100) : 50;

    raw.exit_strategy.projected_bulk_yield = bulkYield;
    raw.exit_strategy.projected_split_yield = splitYield;
    raw.exit_strategy.profit_increase_pct = Math.max(0, increasePct);
  }

  return {
    ...raw,
    lot_items: sanitizedItems
  };
}
