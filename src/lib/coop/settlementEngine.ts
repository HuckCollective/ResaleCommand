import type { PartnerSummary, SettlementConfig, SettlementResult } from '../../types/coop';

const DEFAULT_CONSIGNOR_FIXED_RENT = 85.41;

function roundCents(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function isConsignorPartner(partner: PartnerSummary): boolean {
  const code = String(partner.partnerCode || '').toUpperCase();
  return partner.role === 'Consignor' || code.startsWith('BB');
}

function isCommonsPoolRow(partner: PartnerSummary): boolean {
  const code = String(partner.partnerCode || '').toUpperCase();
  return code.startsWith('COMMONS');
}

/**
 * Pure 4-Gate Co-op Waterfall & WSDE Patronage Settlement Engine.
 *
 * - Gate 1: Deduct venue fee (e.g. 15% Memory Den fee).
 * - Gate 2: Consignors (BB-) deduct fixed rent ($85.41) to offset gross rent ($382.50 -> $297.09 net rent).
 * - Gate 3: Co-op partners (HUCK-, PDXGL-, SO-) recoup 100% cost basis first, then split net margin 70% Curator / 30% Commons.
 * - Gate 4A: Commons collected vs operating costs ($297.09 net rent + $219.99 tech + $6.18 supplies = $523.26).
 * - Shortfall Priority: Carried-over shortfall (e.g. -$132.97) is repaid first before any Gate 4B bonus dividends.
 * - Gate 4B: Distributable partner bonus pool split 50% Sales Margin pro-rata / 50% Labor Bounties pro-rata.
 */
export function runCoopSettlement(
  partners: PartnerSummary[],
  config: SettlementConfig
): SettlementResult {
  const venueFeeRate = Number.isFinite(config.venueFeeRate) ? config.venueFeeRate : 0.15;
  const curatorSplitRate = Number.isFinite(config.curatorSplitRate) ? config.curatorSplitRate : 0.70;
  const commonsSplitRate = Number.isFinite(config.commonsSplitRate) ? config.commonsSplitRate : 0.30;
  const configuredConsignorRent =
    config.consignorFixedRent !== undefined ? config.consignorFixedRent : DEFAULT_CONSIGNOR_FIXED_RENT;

  let totalConsignorRentOffset = 0;

  // Gates 1, 2 & 3 per partner
  const computedPartners: PartnerSummary[] = partners.map((partner) => {
    const grossSales = roundCents(partner.grossSales);
    const venueFee = roundCents(grossSales * venueFeeRate);
    const netAfterVenue = roundCents(grossSales - venueFee);
    const frontedReimbursement = roundCents(partner.frontedReimbursement);

    // Gate 2: Consignor (BB-) pays fixed sub-lease rent ($85.41) to offset gross booth rent
    if (isConsignorPartner(partner)) {
      const consignorRentDeducted = roundCents(
        partner.consignorRentDeducted !== undefined
          ? partner.consignorRentDeducted
          : configuredConsignorRent
      );
      totalConsignorRentOffset = roundCents(totalConsignorRentOffset + consignorRentDeducted);

      const costRecoup = roundCents(partner.costRecoup);
      const netConsignorEarnings = roundCents(netAfterVenue - consignorRentDeducted - costRecoup);
      const finalPayoutCheck = roundCents(
        netAfterVenue - consignorRentDeducted + frontedReimbursement
      );

      return {
        ...partner,
        role: 'Consignor',
        grossSales,
        venueFee,
        costRecoup,
        baseProfit70: netConsignorEarnings,
        commons30: 0,
        frontedReimbursement,
        consignorRentDeducted,
        salesPatronageBonus: 0,
        laborBountyBonus: 0,
        totalBonusDividend: 0,
        finalPayoutCheck,
      };
    }

    // Mystery / Unclaimed items assigned to Commons Pool sweep 100% of net margin to Commons
    if (isCommonsPoolRow(partner)) {
      const costRecoup = roundCents(partner.costRecoup);
      const netMargin = roundCents(Math.max(0, netAfterVenue - costRecoup));
      return {
        ...partner,
        grossSales,
        venueFee,
        costRecoup,
        baseProfit70: 0,
        commons30: netMargin,
        frontedReimbursement,
        consignorRentDeducted: 0,
        salesPatronageBonus: 0,
        laborBountyBonus: 0,
        totalBonusDividend: 0,
        finalPayoutCheck: roundCents(costRecoup + frontedReimbursement),
      };
    }

    // Gate 3: Co-op Partners (HUCK-, PDXGL-, SO-) recoup 100% cost basis first, then 70/30 split
    const costRecoup = roundCents(partner.costRecoup);
    const netMargin = roundCents(netAfterVenue - costRecoup);

    let baseProfit70 = 0;
    let commons30 = 0;

    if (netMargin > 0) {
      commons30 = roundCents(netMargin * commonsSplitRate);
      baseProfit70 = roundCents(netMargin - commons30);
    } else if (netMargin < 0) {
      // If an item sold below cost basis after venue fee, reflect negative margin on curator split
      baseProfit70 = roundCents(netMargin * curatorSplitRate);
      commons30 = 0;
    }

    const baseCheck = roundCents(costRecoup + baseProfit70 + frontedReimbursement);

    return {
      ...partner,
      role: 'Co-op Partner',
      grossSales,
      venueFee,
      costRecoup,
      baseProfit70,
      commons30,
      frontedReimbursement,
      consignorRentDeducted: 0,
      salesPatronageBonus: 0,
      laborBountyBonus: 0,
      totalBonusDividend: 0,
      finalPayoutCheck: baseCheck,
    };
  });

  // Gate 4A: Commons collected vs Operating Breakeven ($297.09 net rent + $219.99 tech + $6.18 supplies = $523.26)
  const grossRent = roundCents(config.grossRent);
  const netRent = roundCents(Math.max(0, grossRent - totalConsignorRentOffset));
  const techOps = roundCents(config.techOps);
  const supplies = roundCents(config.supplies);
  const operatingBreakeven = roundCents(netRent + techOps + supplies);

  const totalCommonsCollected = roundCents(
    computedPartners.reduce((sum, p) => sum + p.commons30, 0)
  );

  const netOperatingBalanceBeforeShortfall = roundCents(
    totalCommonsCollected - operatingBreakeven
  );

  // Shortfall priority: Carried-over shortfall (e.g. -$132.97 or 132.97) must be repaid before Gate 4B dividends
  const priorShortfallDebt = roundCents(Math.abs(config.carriedOverShortfall || 0));
  let shortfallRepaid = 0;
  let remainingShortfall = priorShortfallDebt;
  let excessSurplus = 0;

  if (netOperatingBalanceBeforeShortfall >= 0) {
    shortfallRepaid = roundCents(Math.min(netOperatingBalanceBeforeShortfall, priorShortfallDebt));
    remainingShortfall = roundCents(priorShortfallDebt - shortfallRepaid);
    excessSurplus = roundCents(netOperatingBalanceBeforeShortfall - shortfallRepaid);
  } else {
    // Current month operating deficit adds to the carried-over shortfall
    shortfallRepaid = 0;
    remainingShortfall = roundCents(priorShortfallDebt + Math.abs(netOperatingBalanceBeforeShortfall));
    excessSurplus = 0;
  }

  // Gate 4B: Reserve allocation & 50% Sales Margin / 50% Labor Bounties pro-rata bonus pool
  const currentReserve = roundCents(config.reserveBalance);
  const reserveCap = roundCents(config.reserveCap);
  const reserveRoom = roundCents(Math.max(0, reserveCap - currentReserve));
  const reserveRate =
    config.reserveContributionRate !== undefined ? config.reserveContributionRate : 0;

  const desiredReserveAddition =
    reserveRoom > 0 && reserveRate > 0 ? roundCents(excessSurplus * reserveRate) : 0;
  const reserveAdded = roundCents(Math.min(excessSurplus, reserveRoom, desiredReserveAddition));
  const newReserveBalance = roundCents(currentReserve + reserveAdded);

  const partnerBonusPool = roundCents(Math.max(0, excessSurplus - reserveAdded));
  const salesPatronageRate =
    config.salesPatronageRate !== undefined ? config.salesPatronageRate : 0.50;
  const laborBountyRate =
    config.laborBountyRate !== undefined ? config.laborBountyRate : 1 - salesPatronageRate;

  const salesPatronagePool = roundCents(partnerBonusPool * salesPatronageRate);
  const laborBountyPool = roundCents(partnerBonusPool - salesPatronagePool);

  if (partnerBonusPool > 0) {
    const eligibleCoopPartners = computedPartners.filter(
      (p) => !isConsignorPartner(p) && !isCommonsPoolRow(p)
    );

    const totalSalesMarginBasis = roundCents(
      eligibleCoopPartners.reduce((sum, p) => sum + Math.max(0, p.baseProfit70), 0)
    );
    const totalLaborBasis = roundCents(
      eligibleCoopPartners.reduce((sum, p) => sum + Math.max(0, p.laborBountyWeight || 0), 0)
    );

    for (const partner of eligibleCoopPartners) {
      const salesShare =
        totalSalesMarginBasis > 0
          ? Math.max(0, partner.baseProfit70) / totalSalesMarginBasis
          : 1 / Math.max(1, eligibleCoopPartners.length);

      const laborShare =
        totalLaborBasis > 0
          ? Math.max(0, partner.laborBountyWeight || 0) / totalLaborBasis
          : salesShare;

      const salesBonus = roundCents(salesPatronagePool * salesShare);
      const laborBonus = roundCents(laborBountyPool * laborShare);
      const totalBonus = roundCents(salesBonus + laborBonus);

      partner.salesPatronageBonus = salesBonus;
      partner.laborBountyBonus = laborBonus;
      partner.totalBonusDividend = totalBonus;
      partner.finalPayoutCheck = roundCents(partner.finalPayoutCheck + totalBonus);
    }
  }

  return {
    operatingBreakeven,
    partners: computedPartners,
    excessSurplus,
    reserveAdded,
    partnerBonusPool,
    breakdown: {
      grossRent,
      consignorRentOffset: totalConsignorRentOffset,
      netRent,
      techOps,
      supplies,
      totalCommonsCollected,
      netOperatingBalanceBeforeShortfall,
      shortfallRepaid,
      remainingShortfall,
      newReserveBalance,
      salesPatronagePool,
      laborBountyPool,
    },
  };
}

