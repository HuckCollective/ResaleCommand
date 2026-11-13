import type { KpiStatItem } from '../components/common/KpiStatGrid.vue';

function parseItemUnitRetail(item: any): number {
  const direct = Number(item?.resalePrice || item?.listPrice || item?.boutiquePrice);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const rawEst = item?.estValue;
  if (typeof rawEst === 'number' && Number.isFinite(rawEst) && rawEst > 0) return rawEst;
  if (typeof rawEst === 'string') {
    const m = rawEst.match(/(\d+(?:\.\d+)?)/);
    if (m) return Number(m[1]) || 0;
  }
  return 0;
}

export function computeInventoryKpiStats(items: any[] = []): KpiStatItem[] {
  let totalUnits = 0;
  let totalRetail = 0;
  let totalCost = 0;
  let pricedCount = 0;
  let placedCount = 0;

  for (const item of items) {
    if (!item) continue;
    const qty = Math.max(1, Number(item.quantity) || 1);
    const unitRetail = parseItemUnitRetail(item);
    const itemCost = Number(item.cost ?? item.purchasePrice) || 0;

    totalUnits += qty;
    totalCost += itemCost;
    if (unitRetail > 0) {
      pricedCount++;
      totalRetail += unitRetail * qty;
    }
    const st = String(item.status || '').toLowerCase().trim();
    if (st === 'placed' || st === 'listed') {
      placedCount++;
    }
  }

  const spread = totalRetail - totalCost;
  const avgRetail = totalUnits > 0 ? totalRetail / totalUnits : 0;

  return [
    {
      label: 'Filtered Catalog',
      value: `${totalUnits.toLocaleString()} units`,
      hint: `${items.length.toLocaleString()} SKU${items.length === 1 ? '' : 's'} · ${placedCount} placed in booths`,
      icon: 'solar:box-bold-duotone',
      tone: 'text-base-content',
    },
    {
      label: 'Est. Retail Value',
      value: `$${totalRetail.toFixed(2)}`,
      hint: `${pricedCount}/${items.length} priced · avg $${avgRetail.toFixed(2)}/unit`,
      icon: 'solar:tag-price-bold-duotone',
      tone: 'text-info',
    },
    {
      label: 'Landed Cost Basis',
      value: `$${totalCost.toFixed(2)}`,
      hint: '100% recouped first at Gate 2',
      icon: 'solar:wallet-money-bold-duotone',
      tone: 'text-warning',
    },
    {
      label: 'Projected Spread',
      value: `${spread >= 0 ? '+$' : '-$'}${Math.abs(spread).toFixed(2)}`,
      hint:
        totalCost > 0 && totalRetail > 0
          ? `${(totalRetail / totalCost).toFixed(1)}x multiple on cost`
          : 'Price items to calculate ROI multiple',
      icon: 'solar:chart-2-bold-duotone',
      tone: spread >= 0 ? 'text-success' : 'text-error',
      badge: spread > 0 && totalCost > 0 ? `+${Math.round((spread / totalCost) * 100)}% ROI` : undefined,
      badgeClass: 'badge-success text-success-content',
    },
  ];
}
