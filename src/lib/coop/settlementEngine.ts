import type {
  MondragonPayRatioStatus,
  PartnerSummary,
  SettlementConfig,
  SettlementResult,
} from '../../types/coop';

export function toCents(value: number): number {
  return Math.round((Number(value) || 0) * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

/**
 * Deterministic largest-remainder integer-cent allocator using exact BigInt Euclidean remainders.
 * Guarantees `sum(allocated) === poolCents` with deterministic `rowKey` tie-breaking.
 */
export function allocateCents(
  poolCents: number,
  items: ReadonlyArray<{ rowKey: string; weight: number }>
): Map<string, number> {
  const result = new Map<string, number>();
  for (const item of items) {
    result.set(item.rowKey, 0);
  }
  if (poolCents <= 0 || items.length === 0) return result;

  const positive = items
    .map((item) => ({
      rowKey: item.rowKey,
      scaledWeight: BigInt(Math.max(0, Math.round((Number(item.weight) || 0) * 1_000_000))),
    }))
    .filter((item) => item.scaledWeight > 0n);

  if (positive.length === 0) return result;

  const totalWeight = positive.reduce((acc, item) => acc + item.scaledWeight, 0n);
  if (totalWeight <= 0n) return result;

  const poolBig = BigInt(Math.round(poolCents));
  const shares = positive.map((item) => {
    const numerator = poolBig * item.scaledWeight;
    const quotient = Number(numerator / totalWeight);
    const remainder = numerator % totalWeight;
    return {
      rowKey: item.rowKey,
      quotient,
      remainder,
    };
  });

  let distributed = 0;
  for (const s of shares) {
    result.set(s.rowKey, s.quotient);
    distributed += s.quotient;
  }

  let leftover = Math.round(poolCents) - distributed;
  if (leftover > 0) {
    shares.sort((a, b) => {
      if (b.remainder > a.remainder) return 1;
      if (b.remainder < a.remainder) return -1;
      return a.rowKey.localeCompare(b.rowKey);
    });
    for (let i = 0; i < leftover; i++) {
      const target = shares[i % shares.length];
      result.set(target.rowKey, (result.get(target.rowKey) || 0) + 1);
    }
  }

  return result;
}

function isConsignorRow(partner: PartnerSummary): boolean {
  return partner.role === 'Consignor' || partner.isConsignor === true;
}

function isCommonsPoolRow(partner: PartnerSummary): boolean {
  const code = String(partner.partnerCode || '').toUpperCase();
  return partner.role === 'Commons Pool' || partner.isCommonsPool === true || code.startsWith('COMMONS');
}

function isSweatRow(partner: PartnerSummary): boolean {
  const code = String(partner.partnerCode || '').toUpperCase();
  return (
    partner.role === 'Marketing & Social Enabler' ||
    partner.isSweatEnabler === true ||
    code.startsWith('SWEAT')
  );
}

/**
 * Pure 4-Gate Co-op Waterfall & WSDE / Mondragon Settlement Engine (Integer Cents).
 *
 * Law 2 enforced: zero hardcoded rent, commission, or split defaults. All rates come from the caller.
 */
export function runCoopSettlement(
  partners: PartnerSummary[],
  config: SettlementConfig
): SettlementResult {
  const warnings: string[] = [];
  const isMonthInProgress = Boolean(config.isMonthInProgress);

  const hasValidSplits =
    Number.isFinite(config.curatorSplitRate) &&
    Number.isFinite(config.commonsSplitRate) &&
    config.curatorSplitRate >= 0 &&
    config.commonsSplitRate >= 0;

  if (!hasValidSplits) {
    warnings.push('Missing curatorSplitRate or commonsSplitRate in SettlementConfig.');
  }

  const curatorSplitRate = hasValidSplits ? config.curatorSplitRate : 0;
  const commonsSplitRate = hasValidSplits ? config.commonsSplitRate : 0;

  let totalConsignorRentOffsetCents = 0;

  // Gates 1, 2 & 3 per partner row
  const computedPartners: PartnerSummary[] = partners.map((partner, idx) => {
    const rowKey = partner.rowKey || `${partner.partnerCode || 'ROW'}::${idx}`;
    const grossCents = toCents(partner.grossSales);

    let venueFeeCents: number;
    if (partner.venueFee !== undefined && Number.isFinite(partner.venueFee)) {
      venueFeeCents = Math.max(0, toCents(partner.venueFee));
    } else if (config.venueFeeRate !== undefined && Number.isFinite(config.venueFeeRate)) {
      venueFeeCents = Math.max(0, Math.round(grossCents * config.venueFeeRate));
    } else {
      if (grossCents > 0) {
        warnings.push(`Missing venueFee and venueFeeRate for ${partner.partnerName || rowKey}.`);
      }
      venueFeeCents = 0;
    }

    const netAfterVenueCents = Math.max(0, grossCents - venueFeeCents);

    // Gate 2: Straight Consignor (agreement-driven via calculateConsignorSettlement in settlementInputs)
    if (isConsignorRow(partner)) {
      const consignorRentCents = isMonthInProgress
        ? 0
        : Math.max(0, toCents(partner.consignorRentDeducted ?? 0));
      const coopCommissionCents = Math.max(0, toCents(partner.coopCommission ?? 0));
      totalConsignorRentOffsetCents += consignorRentCents;

      const payoutCents = Math.max(
        0,
        netAfterVenueCents - consignorRentCents - coopCommissionCents
      );

      return {
        ...partner,
        rowKey,
        role: 'Consignor',
        isConsignor: true,
        grossSales: fromCents(grossCents),
        venueFee: fromCents(venueFeeCents),
        netAfterVenue: fromCents(netAfterVenueCents),
        costRecoup: 0,
        unrecoupedCost: 0,
        netMargin: 0,
        baseProfit70: fromCents(payoutCents),
        // §5 item 2: consignor coopCommission flows into Commons Pool (Gate 4A)
        commons30: fromCents(coopCommissionCents),
        frontedReimbursement: 0,
        consignorRentDeducted: fromCents(consignorRentCents),
        coopCommission: fromCents(coopCommissionCents),
        salesPatronageBonus: 0,
        laborBountyBonus: 0,
        totalBonusDividend: 0,
        icaRetainedCredit: 0,
        cashBonusPaid: 0,
        projectedAnnualIcaYield: 0,
        finalPayoutCheck: fromCents(payoutCents),
      };
    }

    // Commons-claimed / orphan register items sweep 100% of net deposit to Commons Pool (§5 item 5)
    if (isCommonsPoolRow(partner)) {
      return {
        ...partner,
        rowKey,
        role: 'Commons Pool',
        isCommonsPool: true,
        grossSales: fromCents(grossCents),
        venueFee: fromCents(venueFeeCents),
        netAfterVenue: fromCents(netAfterVenueCents),
        costRecoup: 0,
        unrecoupedCost: 0,
        netMargin: 0,
        baseProfit70: 0,
        commons30: fromCents(netAfterVenueCents),
        frontedReimbursement: 0,
        consignorRentDeducted: 0,
        coopCommission: 0,
        salesPatronageBonus: 0,
        laborBountyBonus: 0,
        totalBonusDividend: 0,
        icaRetainedCredit: 0,
        cashBonusPaid: 0,
        projectedAnnualIcaYield: 0,
        finalPayoutCheck: 0,
      };
    }

    // Gate 3: Co-op Partner or Marketing & Social Enabler (SWEAT-)
    const frontedCents = Math.max(0, toCents(partner.frontedReimbursement));
    const hasPreAggregatedItemSplits =
      Array.isArray(partner.items) &&
      partner.items.length > 0 &&
      partner.netMargin !== undefined &&
      Number.isFinite(partner.baseProfit70) &&
      Number.isFinite(partner.commons30);

    let effectiveCostRecoupCents: number;
    let unrecoupedCostCents: number;
    let netMarginCents: number;
    let baseProfitCents: number;
    let commonsCents: number;

    if (hasPreAggregatedItemSplits) {
      effectiveCostRecoupCents = Math.max(0, toCents(partner.costRecoup));
      unrecoupedCostCents = Math.max(0, toCents(partner.unrecoupedCost ?? 0));
      netMarginCents = Math.max(0, toCents(partner.netMargin ?? 0));
      baseProfitCents = Math.max(0, toCents(partner.baseProfit70));
      commonsCents = Math.max(0, toCents(partner.commons30));
    } else {
      const rawCostCents = Math.max(0, toCents(partner.costRecoup));
      if (netAfterVenueCents < rawCostCents) {
        // §5 item 4: below-cost sale — cap recoup at netAfterVenue; never pay out > netAfterVenue
        effectiveCostRecoupCents = netAfterVenueCents;
        unrecoupedCostCents = rawCostCents - effectiveCostRecoupCents;
        netMarginCents = 0;
        baseProfitCents = 0;
        commonsCents = 0;
      } else {
        effectiveCostRecoupCents = rawCostCents;
        unrecoupedCostCents = 0;
        netMarginCents = netAfterVenueCents - rawCostCents;
        commonsCents = hasValidSplits ? Math.round(netMarginCents * commonsSplitRate) : 0;
        baseProfitCents = hasValidSplits
          ? netMarginCents - commonsCents
          : Math.round(netMarginCents * curatorSplitRate);
      }
    }

    const sweat = isSweatRow(partner);
    const baseCheckCents = effectiveCostRecoupCents + baseProfitCents + frontedCents;

    return {
      ...partner,
      rowKey,
      role: sweat ? 'Marketing & Social Enabler' : 'Co-op Partner',
      isSweatEnabler: sweat,
      grossSales: fromCents(grossCents),
      venueFee: fromCents(venueFeeCents),
      netAfterVenue: fromCents(netAfterVenueCents),
      costRecoup: fromCents(effectiveCostRecoupCents),
      unrecoupedCost: fromCents(unrecoupedCostCents),
      netMargin: fromCents(netMarginCents),
      baseProfit70: fromCents(baseProfitCents),
      commons30: fromCents(commonsCents),
      frontedReimbursement: fromCents(frontedCents),
      consignorRentDeducted: 0,
      coopCommission: 0,
      salesPatronageBonus: 0,
      laborBountyBonus: 0,
      totalBonusDividend: 0,
      icaRetainedCredit: 0,
      cashBonusPaid: 0,
      projectedAnnualIcaYield: 0,
      finalPayoutCheck: fromCents(baseCheckCents),
    };
  });

  // Gate 4A: Commons collected vs Operating Breakeven (§5 items 10–13)
  const grossRentCents = isMonthInProgress ? 0 : Math.max(0, toCents(config.grossRent));
  const netRentCents = isMonthInProgress
    ? 0
    : Math.max(0, grossRentCents - totalConsignorRentOffsetCents);
  const techOpsCents = Math.max(0, toCents(config.techOps));
  const suppliesCents = Math.max(0, toCents(config.supplies));
  const operatingBreakevenCents = netRentCents + techOpsCents + suppliesCents;

  const totalCommonsCollectedCents = computedPartners.reduce(
    (sum, p) => sum + toCents(p.commons30),
    0
  );
  const netOperatingBalanceBeforeShortfallCents =
    totalCommonsCollectedCents - operatingBreakevenCents;

  const configuredShortfallCents = Math.max(
    0,
    Math.abs(toCents(config.carriedOverShortfall || 0))
  );

  let shortfallRepaidCents = 0;
  let remainingShortfallCents = configuredShortfallCents;
  let excessSurplusCents = 0;

  if (isMonthInProgress) {
    // §5 item 10: while month is in progress, rent = 0, shortfall = 0, bonus pool = 0
    shortfallRepaidCents = 0;
    remainingShortfallCents = configuredShortfallCents;
    excessSurplusCents = 0;
  } else if (netOperatingBalanceBeforeShortfallCents >= 0) {
    shortfallRepaidCents = Math.min(
      netOperatingBalanceBeforeShortfallCents,
      configuredShortfallCents
    );
    remainingShortfallCents = configuredShortfallCents - shortfallRepaidCents;
    excessSurplusCents = netOperatingBalanceBeforeShortfallCents - shortfallRepaidCents;
  } else {
    shortfallRepaidCents = 0;
    remainingShortfallCents =
      configuredShortfallCents + Math.abs(netOperatingBalanceBeforeShortfallCents);
    excessSurplusCents = 0;
  }

  // Gate 4B: Reserve slice + Sales Patronage Pool + Sweat-Equity Labor Pool (§5 items 15–18)
  const currentReserveCents = Math.max(0, toCents(config.reserveBalance));
  const reserveCapCents = Math.max(0, toCents(config.reserveCap));
  const reserveRoomCents = Math.max(0, reserveCapCents - currentReserveCents);

  let reserveAddedCents = 0;
  if (!isMonthInProgress && excessSurplusCents > 0) {
    if (config.surplusPolicyMode === 'reserve_100') {
      reserveAddedCents = excessSurplusCents;
    } else if (config.surplusPolicyMode === 'cap_100') {
      reserveAddedCents = 0;
    } else {
      const reservePct = Math.min(100, Math.max(0, Number(config.reserveSharePct) || 0)) / 100;
      const desiredReserveCents = Math.round(excessSurplusCents * reservePct);
      reserveAddedCents = Math.min(excessSurplusCents, reserveRoomCents, desiredReserveCents);
    }
  }

  let partnerBonusPoolCents = Math.max(0, excessSurplusCents - reserveAddedCents);

  const salesPctWeight = Math.max(0, Number(config.salesPatronagePct) || 0);
  const laborPctWeight = Math.max(0, Number(config.laborPatronagePct) || 0);
  const combinedWeight = salesPctWeight + laborPctWeight;
  const salesRate = combinedWeight > 0 ? salesPctWeight / combinedWeight : 1;

  let salesPatronagePoolCents = Math.round(partnerBonusPoolCents * salesRate);
  let laborBountyPoolCents = partnerBonusPoolCents - salesPatronagePoolCents;

  const candidateCoopRows = computedPartners.filter(
    (p) => !isConsignorRow(p) && !isCommonsPoolRow(p)
  );

  // Build Sales Pool weights (§5 item 17)
  let salesWeights: Array<{ rowKey: string; weight: number }> = [];
  if (config.surplusSplitBasis === 'equal') {
    const equalEligible =
      config.sweatSalesPoolMode === 'equal_all'
        ? candidateCoopRows.filter(
            (p) => p.itemsSold > 0 || (Number(p.laborBountyWeight) || 0) > 0
          )
        : candidateCoopRows.filter((p) => !isSweatRow(p) && p.itemsSold > 0);
    salesWeights = equalEligible.map((p) => ({ rowKey: p.rowKey, weight: 1 }));
  } else {
    // 'volume' basis: weight = row netMargin; SWEAT always 0 regardless of sweatSalesPoolMode
    const volumeEligible = candidateCoopRows.filter((p) => !isSweatRow(p) && p.itemsSold > 0);
    const totalNetMarginCents = volumeEligible.reduce(
      (sum, p) => sum + Math.max(0, toCents(p.netMargin ?? 0)),
      0
    );
    salesWeights = volumeEligible.map((p) => ({
      rowKey: p.rowKey,
      weight: totalNetMarginCents > 0 ? Math.max(0, toCents(p.netMargin ?? 0)) : 1,
    }));
  }

  // Build Labor Pool weights (§5 item 17)
  const laborEligible = candidateCoopRows.filter(
    (p) => (Number(p.laborBountyWeight) || 0) > 0
  );
  let laborWeights: Array<{ rowKey: string; weight: number }> = [];
  if (laborEligible.length > 0) {
    laborWeights = laborEligible.map((p) => ({
      rowKey: p.rowKey,
      weight: Math.max(0, Number(p.laborBountyWeight) || 0),
    }));
  } else if (salesWeights.length > 0) {
    // 0 approved hours logged -> fall back to sales-share rule among sales-eligible rows
    laborWeights = salesWeights;
  }

  if (salesPatronagePoolCents > 0 && salesWeights.length === 0) {
    reserveAddedCents += salesPatronagePoolCents;
    partnerBonusPoolCents -= salesPatronagePoolCents;
    salesPatronagePoolCents = 0;
  }

  if (laborBountyPoolCents > 0 && laborWeights.length === 0) {
    reserveAddedCents += laborBountyPoolCents;
    partnerBonusPoolCents -= laborBountyPoolCents;
    laborBountyPoolCents = 0;
  }

  const salesAllocated = allocateCents(salesPatronagePoolCents, salesWeights);
  const laborAllocated = allocateCents(laborBountyPoolCents, laborWeights);

  const icaPct = Math.min(50, Math.max(0, Math.round(Number(config.icaRetainedPct) || 0)));
  const icaYieldRatePct = Math.max(0, Number(config.icaAnnualYieldRatePct) || 0);

  let totalIcaRetainedCents = 0;
  let totalCashBonusPaidCents = 0;

  for (const partner of candidateCoopRows) {
    const salesBonusCents = salesAllocated.get(partner.rowKey) || 0;
    const laborBonusCents = laborAllocated.get(partner.rowKey) || 0;
    const totalBonusCents = salesBonusCents + laborBonusCents;

    const icaRetainedCents =
      icaPct > 0 && totalBonusCents > 0
        ? Math.round((totalBonusCents * icaPct) / 100)
        : 0;
    const cashBonusCents = totalBonusCents - icaRetainedCents;
    const projectedAnnualIcaYieldCents =
      icaRetainedCents > 0
        ? Math.round((icaRetainedCents * icaYieldRatePct) / 100)
        : 0;

    totalIcaRetainedCents += icaRetainedCents;
    totalCashBonusPaidCents += cashBonusCents;

    partner.salesPatronageBonus = fromCents(salesBonusCents);
    partner.laborBountyBonus = fromCents(laborBonusCents);
    partner.totalBonusDividend = fromCents(totalBonusCents);
    partner.icaRetainedCredit = fromCents(icaRetainedCents);
    partner.cashBonusPaid = fromCents(cashBonusCents);
    partner.projectedAnnualIcaYield = fromCents(projectedAnnualIcaYieldCents);
    partner.finalPayoutCheck = fromCents(toCents(partner.finalPayoutCheck) + cashBonusCents);
  }

  const newReserveBalanceCents = currentReserveCents + reserveAddedCents;

  // Advisory Mondragon 10/45/45 & 4.5:1 Pay-Ratio Status (§5 item 19)
  const payRatioCap = Number(config.payRatioCapStandard) > 0 ? Number(config.payRatioCapStandard) : 4.5;
  const isMondragon104545 =
    Math.round(Number(config.reserveSharePct)) === 10 &&
    Math.round(Number(config.salesPatronagePct)) === 45 &&
    Math.round(Number(config.laborPatronagePct)) === 45;

  const totalApprovedHours = candidateCoopRows.reduce(
    (sum, p) => sum + Math.max(0, Number(p.laborBountyWeight) || 0),
    0
  );
  const effectiveHourlyDividendRate =
    totalApprovedHours > 0
      ? fromCents(Math.round(laborBountyPoolCents / totalApprovedHours))
      : 0;

  const rowsWithHours = candidateCoopRows.filter(
    (p) => (Number(p.laborBountyWeight) || 0) > 0
  );
  const noHoursBonusRows = candidateCoopRows
    .filter(
      (p) =>
        (Number(p.laborBountyWeight) || 0) <= 0 &&
        toCents(p.totalBonusDividend ?? 0) > 0
    )
    .map((p) => p.partnerName);

  let payRatioActual: number | null = null;
  let isPayRatioCompliant = true;

  if (rowsWithHours.length > 0) {
    const hourlyTotalRates = rowsWithHours.map(
      (p) => (Number(p.totalBonusDividend) || 0) / Number(p.laborBountyWeight)
    );
    const maxRate = Math.max(...hourlyTotalRates);
    const minRate = Math.min(...hourlyTotalRates);

    if (maxRate === 0) {
      payRatioActual = 1;
      isPayRatioCompliant = true;
    } else if (minRate <= 0) {
      payRatioActual = null;
      isPayRatioCompliant = false;
    } else {
      payRatioActual = Number((maxRate / minRate).toFixed(2));
      isPayRatioCompliant = payRatioActual <= payRatioCap;
    }
  }

  const hasZeroLaborPresetWarning =
    Math.round(Number(config.laborPatronagePct) || 0) === 0 &&
    !(config.surplusSplitBasis === 'equal' && config.sweatSalesPoolMode === 'equal_all');

  const mondragonStatus: MondragonPayRatioStatus = {
    isMondragon104545,
    effectiveHourlyDividendRate,
    payRatioActual,
    payRatioCap,
    isPayRatioCompliant,
    noHoursBonusRows,
    totalIcaRetained: fromCents(totalIcaRetainedCents),
    totalCashBonusPaid: fromCents(totalCashBonusPaidCents),
    hasZeroLaborPresetWarning,
  };

  return {
    operatingBreakeven: fromCents(operatingBreakevenCents),
    partners: computedPartners,
    excessSurplus: fromCents(excessSurplusCents),
    reserveAdded: fromCents(reserveAddedCents),
    partnerBonusPool: fromCents(partnerBonusPoolCents),
    warnings,
    breakdown: {
      isMonthInProgress,
      grossRent: fromCents(grossRentCents),
      consignorRentOffset: fromCents(totalConsignorRentOffsetCents),
      netRent: fromCents(netRentCents),
      techOps: fromCents(techOpsCents),
      supplies: fromCents(suppliesCents),
      totalCommonsCollected: fromCents(totalCommonsCollectedCents),
      netOperatingBalanceBeforeShortfall: fromCents(netOperatingBalanceBeforeShortfallCents),
      shortfallRepaid: fromCents(shortfallRepaidCents),
      remainingShortfall: fromCents(remainingShortfallCents),
      newReserveBalance: fromCents(newReserveBalanceCents),
      salesPatronagePool: fromCents(salesPatronagePoolCents),
      laborBountyPool: fromCents(laborBountyPoolCents),
      mondragonStatus,
    },
  };
}
