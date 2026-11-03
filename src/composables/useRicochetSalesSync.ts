import { computed, ref, type ComputedRef } from 'vue';
import {
  cleanCatalogSku,
  isLeakedInventoryDomRow,
  isPayoutSummaryRow,
  resolvePartnerBucketForSaleRow,
  splitTrailingBoothSku,
} from '../lib/salesBucketing';
import type { LocationSettingMeta } from '../lib/warehouses';

export interface UseRicochetSalesSyncOptions {
  activeCanonicalLocationMeta: ComputedRef<LocationSettingMeta>;
  addToast: (toast: { type: 'success' | 'error' | 'warning' | 'info'; message: string }) => void;
  onCsvFallbackPaste: (rawCsvText: string) => void;
  onAfterLiveCommit?: () => void;
}

function hasRealPaidDate(rawPaidDate: any): boolean {
  if (!rawPaidDate) return false;
  const s = String(rawPaidDate).trim().toLowerCase();
  if (!s || s === '—' || s === '-' || s === 'n/a' || s === 'null' || s === 'undefined' || s.includes('unpaid') || s.includes('pending')) {
    return false;
  }
  return /\d{2,4}/.test(s);
}

export function useRicochetSalesSync(options: UseRicochetSalesSyncOptions) {
  const { activeCanonicalLocationMeta, addToast, onCsvFallbackPaste, onAfterLiveCommit } = options;

  const ricochetSyncPayload = ref<any | null>(null);
  const isLoadingRicochetSync = ref(false);
  const isSimulatingRicochetSync = ref(false);
  const isCommittingRicochetSync = ref(false);
  const isRicochetLiveCommitUnlocked = ref(false);
  const ricochetDryRunResult = ref<any | null>(null);
  const ricochetSubFilter = ref<'all' | 'pending_payout' | 'paid' | 'space_rental'>('all');
  const isPasteRicochetDrawerOpen = ref(false);
  const pastedRicochetSyncText = ref('');

  const ricochetStagedRows = computed<any[]>(() => {
    const rawList = Array.isArray(ricochetSyncPayload.value?.rows) ? ricochetSyncPayload.value.rows : [];
    return rawList
      .filter((r: any) => {
        const rawTitle = String(r?.title || r?.itemName || r?.name || '').trim();
        const rawSku = String(r?.sku || r?.ricoSku || '').trim();
        return !isPayoutSummaryRow(rawTitle) && !isPayoutSummaryRow(rawSku) && !isLeakedInventoryDomRow(r);
      })
      .map((r: any) => {
        const rawTitle = String(r?.title || r?.itemName || r?.name || '').trim();
        const trailing = splitTrailingBoothSku(rawTitle);
        const cleanTitle = trailing.sku ? trailing.title : rawTitle;
        const resolvedSku = cleanCatalogSku(r?.ricoSku || r?.sku || trailing.sku || '').toUpperCase();
        const rawPayoutStatus = String(r?.payoutStatus || '').toLowerCase().trim();
        const rawStatus = String(r?.status || '').toLowerCase().trim();
        const payoutStatus: 'pending_payout' | 'paid' =
          rawPayoutStatus === 'pending_payout' || rawStatus === 'unpaid'
            ? 'pending_payout'
            : rawPayoutStatus === 'paid' || hasRealPaidDate(r?.paidDate) || rawStatus === 'paid'
              ? 'paid'
              : 'pending_payout';
        const isSynced = Boolean(r?.alreadySynced || r?.alreadyRecorded || r?.isAlreadyRecorded);
        const isMatched = Boolean(
          r?.matchStatus === 'matched' ||
            r?.matchedItemId ||
            (r?.matchTier && r.matchTier !== 'unmatched')
        );
        const partnerBucket = resolvePartnerBucketForSaleRow({
          ...r,
          sku: resolvedSku || r?.sku,
          title: cleanTitle || rawTitle,
        });
        return {
          ...r,
          title: cleanTitle || rawTitle,
          sku: resolvedSku || r?.sku || '',
          ricoSku: resolvedSku || r?.ricoSku || r?.sku || '',
          payoutStatus,
          alreadySynced: isSynced,
          alreadyRecorded: isSynced,
          matchStatus: isMatched ? 'matched' : 'unmatched',
          partnerBucket,
        };
      });
  });

  const ricochetSpaceRentalAdjustments = computed<any[]>(() => {
    return Array.isArray(ricochetSyncPayload.value?.spaceRentalAdjustments)
      ? ricochetSyncPayload.value.spaceRentalAdjustments
      : [];
  });

  const ricochetPendingRowsCount = computed(() => {
    return ricochetStagedRows.value.filter((r: any) => r.payoutStatus === 'pending_payout').length;
  });

  const ricochetPaidRowsCount = computed(() => {
    return ricochetStagedRows.value.filter((r: any) => r.payoutStatus !== 'pending_payout').length;
  });

  const filteredRicochetStagedRows = computed<any[]>(() => {
    if (ricochetSubFilter.value === 'pending_payout') {
      return ricochetStagedRows.value.filter((r: any) => r.payoutStatus === 'pending_payout');
    }
    if (ricochetSubFilter.value === 'paid') {
      return ricochetStagedRows.value.filter((r: any) => r.payoutStatus !== 'pending_payout');
    }
    return ricochetStagedRows.value;
  });

  const ricochetSummary = computed(() => {
    const s = ricochetSyncPayload.value?.summary;
    const rows = ricochetStagedRows.value;
    let grossSales = 0;
    let expectedCommission = 0;
    let netPayout = 0;
    let pendingPayoutCount = 0;
    let pendingPayoutNet = 0;
    let paidHistoryCount = 0;
    let paidHistoryNet = 0;
    let matchedInBooth = 0;
    let alreadySynced = 0;
    for (const r of rows) {
      const net = Number(r.ricoNetPayout ?? r.expectedNetPayout ?? 0);
      grossSales += Number(r.grossPrice || 0);
      expectedCommission += Number(r.expectedFee ?? r.expectedCommission ?? r.ricoCommission ?? 0);
      netPayout += net;
      if (r.payoutStatus === 'pending_payout') {
        pendingPayoutCount++;
        pendingPayoutNet += net;
      } else {
        paidHistoryCount++;
        paidHistoryNet += net;
      }
      if (r.matchStatus === 'matched' || r.matchedItemId || (r.matchTier && r.matchTier !== 'unmatched')) {
        matchedInBooth++;
      }
      if (r.alreadySynced || r.alreadyRecorded) alreadySynced++;
    }
    let spaceRentalTotal = 0;
    for (const adj of ricochetSpaceRentalAdjustments.value) {
      spaceRentalTotal += Number(adj.amount || 0);
    }
    const rent = Number(activeCanonicalLocationMeta.value.monthlyRent || 0);
    if (spaceRentalTotal === 0 && rent > 0) {
      spaceRentalTotal = s?.spaceRentalTotal ?? -Math.abs(rent);
    }
    const hasRows = rows.length > 0;
    return {
      soldFound: hasRows ? rows.length : (s?.soldFound ?? 0),
      grossSales: hasRows ? Number(grossSales.toFixed(2)) : (s?.grossSales ?? 0),
      expectedCommission: hasRows ? Number(expectedCommission.toFixed(2)) : (s?.expectedCommission ?? 0),
      netPayout: hasRows ? Number(netPayout.toFixed(2)) : (s?.expectedNetPayout ?? s?.netPayout ?? 0),
      pendingPayoutCount: hasRows ? pendingPayoutCount : (s?.pendingPayoutCount ?? 0),
      pendingPayoutNet: hasRows ? Number(pendingPayoutNet.toFixed(2)) : (s?.pendingPayoutNet ?? 0),
      paidHistoryCount: hasRows ? paidHistoryCount : (s?.paidHistoryCount ?? 0),
      paidHistoryNet: hasRows ? Number(paidHistoryNet.toFixed(2)) : (s?.paidHistoryNet ?? 0),
      spaceRentalTotal: Number(spaceRentalTotal.toFixed(2)),
      netAfterCommissionAndRent: hasRows
        ? Number((netPayout - rent).toFixed(2))
        : (s?.netAfterRent ?? s?.netAfterCommissionAndRent ?? 0),
      matchedInBooth: hasRows ? matchedInBooth : (s?.matchedCount ?? s?.matchedInBooth ?? 0),
      alreadySynced: hasRows ? alreadySynced : (s?.alreadySyncedCount ?? s?.alreadySynced ?? 0),
      unmatchedCount: hasRows ? Math.max(0, rows.length - matchedInBooth) : (s?.unmatchedCount ?? 0),
    };
  });

  const ricochetActionableNewCount = computed(() => {
    return ricochetStagedRows.value.filter(
      (r: any) =>
        !r.alreadySynced &&
        !r.alreadyRecorded &&
        (r.matchStatus === 'matched' ||
          r.matchedItemId ||
          (r.matchTier && r.matchTier !== 'unmatched') ||
          Number(r.grossPrice || 0) > 0)
    ).length;
  });

  const fetchStagedRicochetSales = async (manualTrigger: boolean = false) => {
    if (!activeCanonicalLocationMeta.value.usesRicochet) return;
    isLoadingRicochetSync.value = true;
    try {
      const code = encodeURIComponent(activeCanonicalLocationMeta.value.code);
      const res = await fetch(`/api/sales/ricochet-sync?location=${code}&t=${Date.now()}`);
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok && data?.payload) {
        ricochetSyncPayload.value = data.payload;
        if (manualTrigger) {
          addToast({
            type: 'success',
            message: `🔄 Loaded ${ricochetStagedRows.value.length} staged Ricochet sales for ${activeCanonicalLocationMeta.value.shortName} (Dry-Run Preview)!`,
          });
        }
      }
    } catch (err: any) {
      if (manualTrigger) {
        addToast({
          type: 'warning',
          message: `Could not fetch staged Ricochet sales: ${err?.message || 'Network error'}`,
        });
      }
    } finally {
      isLoadingRicochetSync.value = false;
    }
  };

  const applyPastedRicochetSyncPayload = async () => {
    const raw = pastedRicochetSyncText.value.trim();
    if (!raw) return;

    if (raw.startsWith('{') || raw.startsWith('[')) {
      isLoadingRicochetSync.value = true;
      try {
        const parsed = JSON.parse(raw);
        const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.rows) ? parsed.rows : [];
        const spaceRentalAdjustments = Array.isArray(parsed?.spaceRentalAdjustments)
          ? parsed.spaceRentalAdjustments
          : [];
        const res = await fetch('/api/sales/ricochet-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'stage',
            dryRun: true,
            locationCode: activeCanonicalLocationMeta.value.code,
            rows,
            spaceRentalAdjustments,
          }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.ok && data?.payload) {
          ricochetSyncPayload.value = data.payload;
          ricochetDryRunResult.value = null;
          pastedRicochetSyncText.value = '';
          isPasteRicochetDrawerOpen.value = false;
          addToast({
            type: 'success',
            message: `🧪 Staged ${rows.length} Ricochet sold lines in Dry-Run Sandbox Mode for ${activeCanonicalLocationMeta.value.shortName}!`,
          });
        } else {
          throw new Error(data?.error || 'Failed to stage pasted JSON');
        }
      } catch (err: any) {
        addToast({
          type: 'error',
          message: `Invalid Ricochet Sync JSON: ${err?.message || 'Parse error'}`,
        });
      } finally {
        isLoadingRicochetSync.value = false;
      }
      return;
    }

    pastedRicochetSyncText.value = '';
    isPasteRicochetDrawerOpen.value = false;
    onCsvFallbackPaste(raw);
    addToast({
      type: 'success',
      message: `📄 Parsed pasted CSV into ${activeCanonicalLocationMeta.value.shortName} staging table!`,
    });
  };

  const simulateStagedRicochetSales = async () => {
    if (isSimulatingRicochetSync.value || ricochetStagedRows.value.length === 0) return;
    isSimulatingRicochetSync.value = true;
    try {
      const res = await fetch('/api/sales/ricochet-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'dry_run',
          dryRun: true,
          locationCode: activeCanonicalLocationMeta.value.code,
          rows: ricochetStagedRows.value,
          spaceRentalAdjustments: ricochetSpaceRentalAdjustments.value,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        if (data.payload) {
          const updatedRows = Array.isArray(data.payload.rows)
            ? data.payload.rows.map((r: any) => {
                const isSynced = Boolean(r?.alreadySynced || r?.alreadyRecorded || r?.isAlreadyRecorded);
                return {
                  ...r,
                  alreadySynced: isSynced,
                  alreadyRecorded: isSynced,
                };
              })
            : [];
          ricochetSyncPayload.value = {
            ...data.payload,
            rows: updatedRows,
          };
        }
        ricochetDryRunResult.value = {
          wouldCommitCount: data.wouldCommitCount ?? ricochetActionableNewCount.value,
          wouldGross: data.wouldGross ?? ricochetSummary.value.grossSales,
          wouldNet: data.wouldNet ?? ricochetSummary.value.netPayout,
          skippedAlreadySynced:
            data.skippedAlreadySynced ?? data.alreadySyncedCount ?? ricochetSummary.value.alreadySynced,
        };
        addToast({
          type: 'info',
          message: `🧪 Dry-Run Simulation: Would commit ${ricochetDryRunResult.value.wouldCommitCount} sales ($${Number(ricochetDryRunResult.value.wouldNet || 0).toFixed(2)} net) with 0 DB writes!`,
        });
      } else {
        throw new Error(data?.error || 'Dry-run simulation failed');
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        message: `Dry-Run failed: ${err?.message || 'Unknown error'}`,
      });
    } finally {
      isSimulatingRicochetSync.value = false;
    }
  };

  const commitStagedRicochetSales = async () => {
    if (
      isCommittingRicochetSync.value ||
      ricochetActionableNewCount.value === 0 ||
      !isRicochetLiveCommitUnlocked.value
    ) {
      return;
    }
    isCommittingRicochetSync.value = true;
    try {
      const res = await fetch('/api/sales/ricochet-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'commit',
          dryRun: false,
          locationCode: activeCanonicalLocationMeta.value.code,
          rows: ricochetStagedRows.value,
          spaceRentalAdjustments: ricochetSpaceRentalAdjustments.value,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        if (data.payload) {
          ricochetSyncPayload.value = data.payload;
        }
        ricochetDryRunResult.value = null;
        isRicochetLiveCommitUnlocked.value = false;
        addToast({
          type: 'success',
          message: `✅ Committed ${data.committedCount || 0} verified Ricochet sales (${data.skippedAlreadySynced || 0} already synced)!`,
        });
        onAfterLiveCommit?.();
      } else {
        throw new Error(data?.error || 'Commit request failed');
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        message: `Failed to commit Ricochet sales: ${err?.message || 'Unknown error'}`,
      });
    } finally {
      isCommittingRicochetSync.value = false;
    }
  };

  return {
    ricochetSyncPayload,
    isLoadingRicochetSync,
    isSimulatingRicochetSync,
    isCommittingRicochetSync,
    isRicochetLiveCommitUnlocked,
    ricochetDryRunResult,
    ricochetSubFilter,
    isPasteRicochetDrawerOpen,
    pastedRicochetSyncText,
    ricochetStagedRows,
    ricochetSpaceRentalAdjustments,
    ricochetPendingRowsCount,
    ricochetPaidRowsCount,
    filteredRicochetStagedRows,
    ricochetSummary,
    ricochetActionableNewCount,
    fetchStagedRicochetSales,
    applyPastedRicochetSyncPayload,
    simulateStagedRicochetSales,
    commitStagedRicochetSales,
  };
}

