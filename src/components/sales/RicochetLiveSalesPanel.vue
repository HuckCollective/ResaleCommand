<template>
  <!-- ========================================================================= -->
  <!-- ⚡ RICOCHET LIVE SALES & PAYOUT SYNC PANEL                                 -->
  <!-- Driven 100% by locationMeta.usesRicochet                                  -->
  <!-- ========================================================================= -->
  <div
    v-if="locationMeta.usesRicochet"
    class="card bg-base-100 border-2 border-primary/35 shadow-md p-4 sm:p-6 rounded-2xl mb-6 space-y-4"
  >
    <!-- 1. Sync Status & Controls Bar -->
    <div class="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-base-200 pb-4">
      <div class="flex items-start gap-3">
        <div class="w-12 h-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center text-2xl shrink-0">
          ⚡
        </div>
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <h3 class="text-lg sm:text-xl font-black text-base-content">
              Ricochet Live Sales &amp; Payout Sync — {{ locationMeta.shortName }} ({{ locationMeta.code }})
            </h3>
            <span class="badge badge-xs badge-primary text-primary-content font-mono font-bold">
              Fee: {{ locationMeta.commissionRate }}% | Rent: ${{ Number(locationMeta.monthlyRent || 0).toFixed(2) }}/mo
            </span>
            <span
              class="badge badge-xs font-mono font-bold"
              :class="isLiveCommitUnlocked ? 'badge-warning text-warning-content' : 'badge-info text-info-content'"
            >
              {{ isLiveCommitUnlocked ? '🔓 Live Commit Unlocked' : '🧪 Dry-Run Sandbox Mode (Safe Default)' }}
            </span>
            <span
              v-if="syncedAt"
              class="badge badge-xs badge-success text-success-content font-mono font-bold"
            >
              Last Synced: {{ new Date(syncedAt).toLocaleString() }}
            </span>
          </div>
          <p class="text-xs opacity-75 mt-0.5">
            Auto-harvests <span class="font-mono font-bold">/payouts</span> (Unpaid) + <span class="font-mono font-bold">/payout_history</span> (Paid) from your <span class="font-bold">⚡ {{ locationMeta.shortName }} Sync</span> bookmarklet with 4-tier SKU/UPC cross-linking. Defaults to <span class="font-bold">🧪 Dry-Run Preview Mode</span> so zero production items are marked sold until you unlock Live Commit.
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-end">
        <button
          type="button"
          class="btn btn-sm btn-outline btn-primary font-bold gap-1.5"
          :disabled="isLoading"
          @click="emit('refresh')"
        >
          <span v-if="isLoading" class="loading loading-spinner loading-xs"></span>
          <span v-else>🔄</span>
          <span>Refresh Staged Sales</span>
        </button>

        <button
          type="button"
          class="btn btn-sm btn-ghost border border-base-300 font-bold gap-1.5"
          @click="emit('update:isPasteDrawerOpen', !isPasteDrawerOpen)"
        >
          <span>📋 Paste Sync JSON / CSV</span>
        </button>

        <button
          v-if="stagedRows.length > 0"
          type="button"
          class="btn btn-sm btn-info text-info-content font-black gap-1.5 shadow-sm"
          :disabled="isSimulating"
          @click="emit('simulate')"
        >
          <span v-if="isSimulating" class="loading loading-spinner loading-xs"></span>
          <span v-else>🧪</span>
          <span>Dry-Run / Simulate Commit ({{ actionableNewCount }})</span>
        </button>

        <label
          v-if="actionableNewCount > 0"
          class="label cursor-pointer gap-1.5 bg-base-200 px-2.5 py-1 rounded-lg border border-base-300 text-xs font-bold"
          title="Unlock Live Commit when ready to write sales & mark booth inventory sold"
        >
          <input
            :checked="isLiveCommitUnlocked"
            type="checkbox"
            class="checkbox checkbox-xs checkbox-warning"
            @change="emit('update:isLiveCommitUnlocked', ($event.target as HTMLInputElement).checked)"
          />
          <span>🔓 Unlock Live Commit</span>
        </label>

        <button
          v-if="actionableNewCount > 0 && isLiveCommitUnlocked"
          type="button"
          class="btn btn-sm btn-success text-success-content font-black gap-1.5 shadow-sm"
          :disabled="isCommitting"
          @click="emit('commit')"
        >
          <span v-if="isCommitting" class="loading loading-spinner loading-xs"></span>
          <span v-else>✅</span>
          <span>Live Commit Verified Sales ({{ actionableNewCount }})</span>
        </button>
      </div>
    </div>

    <!-- Dry-Run Simulation Banner -->
    <div
      v-if="dryRunResult"
      class="bg-info/15 border border-info/40 rounded-xl p-3.5 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
    >
      <div class="space-y-1">
        <div class="font-black text-info-content flex items-center gap-2">
          <span>🧪 Dry-Run Simulation Complete (Zero Production DB Writes Performed)</span>
          <span class="badge badge-xs badge-info font-mono">Safe Sandbox</span>
        </div>
        <div class="opacity-85 font-mono">
          Would Commit: <span class="font-black">{{ dryRunResult.wouldCommitCount }}</span> new sales |
          Would Gross: <span class="font-black text-success">${{ Number(dryRunResult.wouldGross || 0).toFixed(2) }}</span> |
          Would Net: <span class="font-black text-primary">${{ Number(dryRunResult.wouldNet || 0).toFixed(2) }}</span> |
          Skipped (Already Synced): <span class="font-black">{{ dryRunResult.skippedAlreadySynced || 0 }}</span>
        </div>
      </div>
      <button
        type="button"
        class="btn btn-xs btn-ghost"
        @click="emit('dismissDryRun')"
      >
        ✕ Dismiss
      </button>
    </div>

    <!-- Collapsible Paste Ricochet Sync JSON / CSV Fallback Drawer -->
    <div
      v-if="isPasteDrawerOpen"
      class="bg-base-200/70 border border-base-300 rounded-xl p-3.5 space-y-2.5"
    >
      <div class="flex items-center justify-between gap-2">
        <span class="text-xs font-black uppercase tracking-wider opacity-80">
          📋 Paste Bookmarklet Sales Sync JSON or Ricochet Payout CSV
        </span>
        <button
          type="button"
          class="btn btn-xs btn-ghost"
          @click="emit('update:isPasteDrawerOpen', false)"
        >
          ✕ Close
        </button>
      </div>
      <textarea
        :value="pastedText"
        rows="4"
        placeholder='Paste JSON copied from "📋 Copy Sales Sync JSON" in the bookmarklet or raw Ricochet CSV rows...'
        class="textarea textarea-bordered w-full font-mono text-xs bg-base-100"
        @input="emit('update:pastedText', ($event.target as HTMLTextAreaElement).value)"
      ></textarea>
      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="btn btn-xs sm:btn-sm btn-primary font-black"
          :disabled="!pastedText.trim() || isLoading"
          @click="emit('applyPasted')"
        >
          Stage Pasted Sales Payload (Dry-Run)
        </button>
      </div>
    </div>

    <!-- Summary KPI Strip for Staged Ricochet Sales -->
    <div
      v-if="stagedRows.length > 0 || spaceRentalAdjustments.length > 0"
      class="grid grid-cols-2 sm:grid-cols-6 gap-2.5 bg-base-200/50 p-3 rounded-xl border border-base-300 text-xs"
    >
      <div class="bg-base-100 p-2.5 rounded-lg border border-base-200">
        <div class="opacity-65 font-bold uppercase text-[10px]">⏳ Pending Payout (/payouts)</div>
        <div class="text-base font-black font-mono text-warning mt-0.5">
          ${{ Number(summary.pendingPayoutNet || 0).toFixed(2) }}
          <span class="text-[10px] opacity-70">({{ summary.pendingPayoutCount || 0 }})</span>
        </div>
      </div>
      <div class="bg-base-100 p-2.5 rounded-lg border border-base-200">
        <div class="opacity-65 font-bold uppercase text-[10px]">🏢 Space Rental / Credits</div>
        <div class="text-base font-black font-mono text-error mt-0.5">
          ${{ Number(summary.spaceRentalTotal || 0).toFixed(2) }}
          <span class="text-[10px] opacity-70">({{ spaceRentalAdjustments.length }})</span>
        </div>
      </div>
      <div class="bg-base-100 p-2.5 rounded-lg border border-base-200">
        <div class="opacity-65 font-bold uppercase text-[10px]">✅ Paid History (/payout_history)</div>
        <div class="text-base font-black font-mono text-success mt-0.5">
          ${{ Number(summary.paidHistoryNet || 0).toFixed(2) }}
          <span class="text-[10px] opacity-70">({{ summary.paidHistoryCount || 0 }})</span>
        </div>
      </div>
      <div class="bg-base-100 p-2.5 rounded-lg border border-base-200">
        <div class="opacity-65 font-bold uppercase text-[10px]">Gross Sales ({{ summary.soldFound }})</div>
        <div class="text-base font-black font-mono text-primary mt-0.5">${{ Number(summary.grossSales || 0).toFixed(2) }}</div>
      </div>
      <div class="bg-base-100 p-2.5 rounded-lg border border-base-200">
        <div class="opacity-65 font-bold uppercase text-[10px]">🔗 Matched in Booth</div>
        <div class="text-base font-black font-mono text-success mt-0.5">
          {{ summary.matchedInBooth }}
          <span class="text-[10px] text-info font-bold">/ {{ summary.alreadySynced }} Synced</span>
        </div>
      </div>
      <div class="bg-base-100 p-2.5 rounded-lg border border-base-200">
        <div class="opacity-65 font-bold uppercase text-[10px]">⚪ Unmatched</div>
        <div class="text-base font-black font-mono mt-0.5" :class="summary.unmatchedCount > 0 ? 'text-warning' : 'text-success'">
          {{ summary.unmatchedCount }}
        </div>
      </div>
    </div>

    <!-- Sub-Filter Pills (All Sold | Pending Payout | Paid History | Space Rental) -->
    <div
      v-if="stagedRows.length > 0 || spaceRentalAdjustments.length > 0"
      class="flex items-center gap-2 flex-wrap"
    >
      <button
        type="button"
        class="btn btn-xs font-bold rounded-full"
        :class="subFilter === 'all' ? 'btn-primary' : 'btn-ghost border border-base-300'"
        @click="emit('update:subFilter', 'all')"
      >
        All Sold ({{ stagedRows.length }})
      </button>
      <button
        type="button"
        class="btn btn-xs font-bold rounded-full"
        :class="subFilter === 'pending_payout' ? 'btn-warning text-warning-content' : 'btn-ghost border border-base-300'"
        @click="emit('update:subFilter', 'pending_payout')"
      >
        ⏳ Pending Payout /payouts ({{ pendingRowsCount }})
      </button>
      <button
        type="button"
        class="btn btn-xs font-bold rounded-full"
        :class="subFilter === 'paid' ? 'btn-success text-success-content' : 'btn-ghost border border-base-300'"
        @click="emit('update:subFilter', 'paid')"
      >
        ✅ Paid History /payout_history ({{ paidRowsCount }})
      </button>
      <button
        type="button"
        class="btn btn-xs font-bold rounded-full"
        :class="subFilter === 'space_rental' ? 'btn-error text-error-content' : 'btn-ghost border border-base-300'"
        @click="emit('update:subFilter', 'space_rental')"
      >
        🏢 Space Rental &amp; Adjustments ({{ spaceRentalAdjustments.length }})
      </button>
    </div>

    <!-- Space Rental & Adjustments Table View -->
    <div
      v-if="subFilter === 'space_rental'"
      class="overflow-x-auto border border-base-300 rounded-xl max-h-60"
    >
      <table class="table table-xs sm:table-sm w-full">
        <thead>
          <tr class="bg-base-200 text-[11px] uppercase tracking-wider font-black">
            <th>Adjustment / Deduction Label</th>
            <th>Date</th>
            <th class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(adj, adjIdx) in spaceRentalAdjustments"
            :key="adjIdx"
            class="hover:bg-base-200/40"
          >
            <td class="font-bold text-xs">{{ adj.label }}</td>
            <td class="font-mono text-xs">{{ adj.date || '—' }}</td>
            <td class="font-mono text-xs text-right font-black text-error">
              ${{ Number(adj.amount || 0).toFixed(2) }}
            </td>
          </tr>
          <tr v-if="spaceRentalAdjustments.length === 0">
            <td colspan="3" class="text-center text-xs opacity-60 py-4">
              No space rental or credit adjustments in this staged batch.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 2. Reconciliation Staging Table -->
    <div
      v-else-if="filteredRows.length > 0"
      class="overflow-x-auto border border-base-300 rounded-xl max-h-80"
    >
      <table class="table table-xs sm:table-sm table-pin-rows w-full">
        <thead>
          <tr class="bg-base-200 text-[11px] uppercase tracking-wider font-black">
            <th>Ricochet SKU / UPC</th>
            <th>Sale #</th>
            <th>Title</th>
            <th>Sold / Paid Date</th>
            <th class="text-right">Agreed / Split</th>
            <th class="text-right">Expected Fee ({{ locationMeta.commissionRate }}%)</th>
            <th class="text-right">Net Payout</th>
            <th>4-Tier Match Badge</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(rRow, rIdx) in filteredRows"
            :key="`${rRow.saleNumber || ''}_${rRow.ricoSku || rRow.sku || rIdx}`"
            class="hover:bg-base-200/40"
          >
            <td class="font-mono text-xs whitespace-nowrap">
              <div class="font-black text-primary">{{ rRow.ricoSku || rRow.sku || '—' }}</div>
              <div v-if="rRow.upc || rRow.matchedItemUpc" class="text-[10px] opacity-80 font-bold">
                {{ rRow.matchedItemUpc || rRow.upc }}
              </div>
            </td>
            <td class="font-mono text-xs whitespace-nowrap">
              <span v-if="rRow.saleNumber" class="badge badge-xs badge-ghost font-mono font-bold">
                #{{ String(rRow.saleNumber).replace(/^#/, '') }}
              </span>
              <span v-else class="opacity-40">—</span>
            </td>
            <td class="max-w-xs">
              <div class="font-bold text-xs truncate" :title="rRow.title">{{ rRow.title }}</div>
              <div v-if="rRow.matchedItemTitle && rRow.matchedItemTitle !== rRow.title" class="text-[10px] opacity-70 truncate">
                ↳ Booth Item: {{ rRow.matchedItemTitle }}
              </div>
            </td>
            <td class="font-mono text-xs whitespace-nowrap">
              <div>{{ rRow.soldDate || '—' }}</div>
              <div class="mt-0.5">
                <span
                  v-if="rRow.payoutStatus === 'pending_payout'"
                  class="badge badge-2xs badge-warning text-warning-content font-bold"
                >
                  ⏳ Unpaid (/payouts)
                </span>
                <span
                  v-else
                  class="badge badge-2xs badge-success text-success-content font-bold"
                >
                  ✅ Paid {{ rRow.paidDate ? `(${rRow.paidDate})` : '' }}
                </span>
              </div>
            </td>
            <td class="font-mono text-xs text-right whitespace-nowrap">
              <div class="font-bold">${{ Number(rRow.grossPrice || rRow.agreedPrice || 0).toFixed(2) }}</div>
              <div v-if="rRow.splitPct" class="text-[10px] opacity-65">Split: {{ String(rRow.splitPct).replace(/%/g, '') }}%</div>
            </td>
            <td class="font-mono text-xs text-right text-warning">-${{ Number(rRow.expectedFee ?? rRow.expectedCommission ?? rRow.ricoCommission ?? 0).toFixed(2) }}</td>
            <td class="font-mono text-xs text-right font-black text-success">${{ Number(rRow.ricoNetPayout ?? rRow.expectedNetPayout ?? 0).toFixed(2) }}</td>
            <td class="whitespace-nowrap">
              <span
                v-if="rRow.alreadySynced"
                class="badge badge-xs badge-neutral font-bold gap-1"
              >
                ✅ Already Synced
              </span>
              <span
                v-else-if="rRow.matchStatus === 'matched' || rRow.matchedItemId || (rRow.matchTier && rRow.matchTier !== 'unmatched')"
                class="badge badge-xs badge-success text-success-content font-bold gap-1"
              >
                🔗 Matched ({{ rRow.matchTier || 'upc' }})
              </span>
              <button
                v-else
                type="button"
                class="btn btn-2xs btn-warning text-warning-content font-black"
                @click="emit('assignRow', rRow)"
              >
                ⚪ Unmatched — Assign Booth Item
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="text-xs opacity-75 bg-base-200/40 border border-dashed border-base-300 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
      <div>
        No staged live Ricochet sales batch yet for <span class="font-bold">{{ locationMeta.shortName }}</span>. Open the <span class="font-mono font-bold">⚡ {{ locationMeta.shortName }} Sync</span> bookmarklet on Ricochet and click <span class="font-bold">🧪 Stage Sales to Resale Core (Dry-Run)</span> in the <span class="font-bold">💰 Sales &amp; Payout Sync</span> tab, or paste JSON above.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LocationSettingMeta } from '../../lib/warehouses';

defineProps<{
  locationMeta: LocationSettingMeta;
  syncedAt?: string | null;
  stagedRows: any[];
  filteredRows: any[];
  spaceRentalAdjustments: any[];
  pendingRowsCount: number;
  paidRowsCount: number;
  summary: {
    soldFound: number;
    grossSales: number;
    expectedCommission: number;
    netPayout: number;
    pendingPayoutCount: number;
    pendingPayoutNet: number;
    paidHistoryCount: number;
    paidHistoryNet: number;
    spaceRentalTotal: number;
    netAfterCommissionAndRent: number;
    matchedInBooth: number;
    alreadySynced: number;
    unmatchedCount: number;
  };
  actionableNewCount: number;
  subFilter: 'all' | 'pending_payout' | 'paid' | 'space_rental';
  isLoading: boolean;
  isSimulating: boolean;
  isCommitting: boolean;
  isLiveCommitUnlocked: boolean;
  dryRunResult: any | null;
  isPasteDrawerOpen: boolean;
  pastedText: string;
}>();

const emit = defineEmits<{
  (e: 'refresh'): void;
  (e: 'simulate'): void;
  (e: 'commit'): void;
  (e: 'dismissDryRun'): void;
  (e: 'applyPasted'): void;
  (e: 'assignRow', row: any): void;
  (e: 'update:subFilter', val: 'all' | 'pending_payout' | 'paid' | 'space_rental'): void;
  (e: 'update:isLiveCommitUnlocked', val: boolean): void;
  (e: 'update:isPasteDrawerOpen', val: boolean): void;
  (e: 'update:pastedText', val: string): void;
}>();
</script>

