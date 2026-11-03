import { computed, ref, type ComputedRef } from 'vue';
import type { LocationSettingMeta } from '../lib/warehouses';

export interface UseRicochetSalesSyncOptions {
  activeCanonicalLocationMeta: ComputedRef<LocationSettingMeta>;
  addToast: (toast: { type: 'success' | 'error' | 'warning' | 'info'; message: string }) => void;
  onCsvFallbackPaste: (rawCsvText: string) => void;
  onAfterLiveCommit?: () => void;
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
    return Array.isArray(ricochetSyncPayload.value?.rows) ? ricochetSyncPayload.value.rows : [];
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
      if (r.alreadySynced) alreadySynced++;
    }
    let spaceRentalTotal = 0;
    for (const adj of ricochetSpaceRentalAdjustments.value) {
      spaceRentalTotal += Number(adj.amount || 0);
    }
    const rent = Number(activeCanonicalLocationMeta.value.monthlyRent || 0);
    return {
      soldFound: s?.soldFound ?? rows.length,
      grossSales: s?.grossSales ?? Number(grossSales.toFixed(2)),
      expectedCommission: s?.expectedCommission ?? Number(expectedCommission.toFixed(2)),
      netPayout: s?.expectedNetPayout ?? s?.netPayout ?? Number(netPayout.toFixed(2)),
      pendingPayoutCount: s?.pendingPayoutCount ?? pendingPayoutCount,
      pendingPayoutNet: s?.pendingPayoutNet ?? Number(pendingPayoutNet.toFixed(2)),
      paidHistoryCount: s?.paidHistoryCount ?? paidHistoryCount,
      paidHistoryNet: s?.paidHistoryNet ?? Number(paidHistoryNet.toFixed(2)),
      spaceRentalTotal: s?.spaceRentalTotal ?? Number(spaceRentalTotal.toFixed(2)),
      netAfterCommissionAndRent:
        s?.netAfterRent ?? s?.netAfterCommissionAndRent ?? Number((netPayout - rent).toFixed(2)),
      matchedInBooth: s?.matchedCount ?? s?.matchedInBooth ?? matchedInBooth,
      alreadySynced: s?.alreadySyncedCount ?? s?.alreadySynced ?? alreadySynced,
      unmatchedCount: s?.unmatchedCount ?? Math.max(0, rows.length - matchedInBooth),
    };
  });

  const ricochetActionableNewCount = computed(() => {
    return ricochetStagedRows.value.filter(
      (r: any) =>
        !r.alreadySynced &&
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
          ricochetSyncPayload.value = data.payload;
        }
        ricochetDryRunResult.value = {
          wouldCommitCount: data.wouldCommitCount ?? ricochetActionableNewCount.value,
          wouldGross: data.wouldGross ?? ricochetSummary.value.grossSales,
          wouldNet: data.wouldNet ?? ricochetSummary.value.netPayout,
          skippedAlreadySynced: data.skippedAlreadySynced ?? ricochetSummary.value.alreadySynced,
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

