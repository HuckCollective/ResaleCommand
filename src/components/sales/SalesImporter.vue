<template>
  <div class="card bg-base-100 shadow-sm border border-base-200 w-full">
    <div class="card-body p-4 sm:p-6 lg:p-8 pb-6 sm:pb-8">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 class="card-title text-2xl font-bold flex items-center gap-2">
            <Icon icon="solar:import-bold-duotone" class="w-8 h-8 text-primary" />
            Universal Sales Importer &amp; Reconciliation
          </h2>
          <p class="text-xs sm:text-sm opacity-80 mt-1">
            Reconcile payout CSVs, match items to inventory, track booth rent &amp; partner shares, and persist sales to cloud database.
          </p>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <!-- Hidden Inputs Preserving Exact DOM ID & Value for Scripts -->
          <input type="hidden" id="rc-sales-location-select" :value="activeLocationCode" />
          <input type="hidden" id="rc-sales-platform-select" :value="platform" />

          <!-- Locked Location Header Badge (Replaces Error-Prone <select> Dropdown) -->
          <div
            v-if="isLocationLocked && activeCanonicalLocationMeta"
            class="flex items-center gap-2.5 bg-base-200/80 px-3.5 py-2 rounded-xl border border-primary/30 shadow-2xs"
          >
            <span class="badge badge-primary font-mono font-black text-xs px-2.5 py-2.5 gap-1 shrink-0">
              <span>{{ activeCanonicalLocationMeta.icon }}</span>
              <span>{{ activeCanonicalLocationMeta.code }}</span>
            </span>
            <div class="text-left min-w-0">
              <div class="text-[10px] uppercase font-bold opacity-60 leading-none">
                🔒 Locked Target Location
              </div>
              <div class="text-xs sm:text-sm font-black text-base-content truncate max-w-[16rem] sm:max-w-[20rem]">
                {{ activeCanonicalLocationMeta.fullName }}
              </div>
            </div>
            <div class="bg-base-100 px-2.5 py-1 rounded-lg border border-base-300 text-center shrink-0">
              <div class="text-[9px] uppercase font-bold opacity-60 leading-none">Booth Fee</div>
              <div class="text-xs font-extrabold text-primary font-mono leading-tight">{{ activeCanonicalLocationMeta.feePct }}%</div>
            </div>
            <button
              type="button"
              class="btn btn-xs btn-ghost border border-base-300 font-bold gap-1 shrink-0"
              @click="isLocationLocked = false"
              title="Switch target location"
            >
              <span>← Switch Location</span>
            </button>
          </div>

          <button
            v-else
            type="button"
            class="btn btn-sm btn-outline btn-primary font-bold gap-1.5"
            @click="isLocationLocked = false"
          >
            <span>📍 Select Target Location</span>
          </button>

          <button 
            v-if="reconciliationHistory.length > 0"
            class="btn btn-sm btn-outline gap-1.5 rounded-xl font-bold"
            @click="isHistoryModalOpen = true"
          >
            <Icon icon="solar:history-bold" class="w-4 h-4 text-primary" />
            <span>Past Reconciliations ({{ reconciliationHistory.length }})</span>
          </button>

          <!-- Slide-over tray trigger: manual CSV upload + multi-month demo live in the tray, not the page body -->
          <button
            v-if="!lastCommittedReceipt"
            type="button"
            class="btn btn-sm btn-outline btn-primary gap-1.5 rounded-xl font-bold"
            @click="isImportTrayOpen = true"
          >
            <span>📂 Manual CSV &amp; Demo</span>
          </button>
        </div>
      </div>

      <!-- Unified Ricochet POS 2-Way Sync Bookmarklet Bar (Matches Auction Scout & Orders Pattern) -->
      <BookmarkletHeroBar
        v-if="activeCanonicalLocationMeta.usesRicochet"
        tool="ricochet_sync"
        :location-meta="activeCanonicalLocationMeta"
        class="mb-5"
      />

      <!-- 4-Location Card Picker (Shown When Visiting Without a Location in URL or Clicking ← Switch Location) -->
      <div
        v-if="!isLocationLocked"
        class="card bg-base-100 border-2 border-primary/30 shadow-md p-5 sm:p-6 rounded-2xl space-y-4 mb-6"
      >
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h3 class="text-lg font-black text-base-content flex items-center gap-2">
              <span>📍 Select &amp; Lock Target Location</span>
            </h3>
            <p class="text-xs opacity-70">
              Choose one of the 4 canonical locations below to lock this Sales Importer and prevent accidental cross-location payout imports.
            </p>
          </div>
          <button
            v-if="activeLocationCode"
            type="button"
            class="btn btn-xs btn-ghost"
            @click="isLocationLocked = true"
          >
            Keep {{ activeCanonicalLocationMeta?.code || 'Current' }} Locked ✕
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            v-for="card in locationCards"
            :key="card.code"
            type="button"
            class="card bg-base-200/60 hover:bg-primary/10 border-2 transition-all p-4 rounded-2xl text-left cursor-pointer flex flex-col justify-between gap-3"
            :class="activeLocationCode === card.code ? 'border-primary bg-primary/10 shadow-sm' : 'border-base-300'"
            @click="selectAndLockSalesLocation(card.code)"
          >
            <div class="space-y-1.5 w-full">
              <div class="flex items-center justify-between gap-2">
                <span class="badge badge-primary font-mono font-black text-xs px-2.5 py-2.5 gap-1">
                  <span>{{ card.icon }}</span>
                  <span>{{ card.code }}</span>
                </span>
                <span class="badge badge-outline font-mono font-bold text-xs">
                  {{ card.feePct }}% Fee
                </span>
              </div>
              <div class="font-black text-sm text-base-content leading-snug pt-1">
                {{ card.fullName }}
              </div>
              <div class="text-[11px] opacity-70">
                {{ card.subtitle }}
              </div>
              <div class="pt-0.5 flex items-center gap-1.5 flex-wrap">
                <span
                  v-if="card.supportsPaperSalesSheet"
                  class="badge badge-xs badge-secondary text-secondary-content font-bold gap-1"
                >
                  <span>📸 Paper Sales Sheet</span>
                </span>
                <span
                  v-else-if="card.usesRicochet"
                  class="badge badge-xs badge-warning text-warning-content font-bold gap-1"
                >
                  <span>⚡ POS Payout CSV</span>
                </span>
                <span
                  v-else
                  class="badge badge-xs badge-ghost border border-base-300 font-semibold opacity-75"
                >
                  <span>📋 Standard CSV</span>
                </span>
              </div>
            </div>
            <div class="pt-2 border-t border-base-300/70 flex items-center justify-between text-xs font-bold text-primary w-full">
              <span>Lock {{ card.code }} Payouts</span>
              <span>➔</span>
            </div>
          </button>
        </div>
      </div>

      <!-- Resumed Staging Alert (Auto-save) -->
      <div v-if="hasRestoredSession && parsedRows.length > 0 && !lastCommittedReceipt" class="alert alert-info py-2 px-4 mb-4 text-xs flex items-center justify-between rounded-xl shadow-xs">
        <div class="flex items-center gap-2">
          <Icon icon="solar:disk-bold" class="w-4 h-4 text-info shrink-0" />
          <span><strong>Auto-Save Active:</strong> Resumed your in-progress reconciliation ({{ parsedRows.length }} items staged). Matches are saved automatically.</span>
        </div>
        <button class="btn btn-xs btn-ghost text-error" @click="resetAndUploadNew">Discard &amp; Start Fresh</button>
      </div>

      <!-- VIEW 0: RECONCILIATION SUCCESS RECEIPT & SETTLEMENT DASHBOARD -->
      <div v-if="lastCommittedReceipt" class="space-y-6">
        <!-- Hero Celebration Banner -->
        <div class="card bg-linear-to-r from-emerald-500/10 via-base-100 to-primary/10 border-2 border-emerald-500/30 p-6 rounded-2xl shadow-md">
          <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div class="flex items-center gap-4">
              <div class="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-inner">
                <Icon icon="solar:check-circle-bold" class="w-8 h-8" />
              </div>
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="badge badge-success text-white font-bold uppercase text-xs tracking-wider">Reconciliation Complete</span>
                  <span class="badge badge-neutral font-mono font-bold">{{ lastCommittedReceipt.cycleLabel }}</span>
                  <span class="badge badge-outline text-xs">Recorded {{ lastCommittedReceipt.timestamp }}</span>
                </div>
                <h3 class="text-2xl font-black text-base-content mt-1">
                  {{ lastCommittedReceipt.itemCount }} Sales Recorded to Inventory &amp; Ledger
                </h3>
                <p class="text-xs text-base-content/70">
                  {{ activeCanonicalLocationMeta.shortName }} ({{ activeCanonicalLocationMeta.code }}) &bull; Items marked as <strong class="text-success">Sold</strong>, stock updated, and co-op payouts reconciled.
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
              <a href="/sales" class="btn btn-sm btn-primary gap-1.5 shadow-sm font-bold">
                <Icon icon="solar:list-check-bold" class="w-4 h-4" />
                <span>View in Sales Ledger</span>
              </a>
              <button 
                v-if="lastCommittedReceipt.partnerSettlements.length > 0"
                class="btn btn-sm btn-success text-white gap-1.5 shadow-sm font-bold"
                @click="exportReceiptPartnerPdfs"
              >
                <Icon icon="solar:file-download-bold" class="w-4 h-4" />
                <span>Download Statements (PDF)</span>
              </button>
            </div>
          </div>
        </div>

        <!-- The 4 Reseller Owner Pillars -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="card bg-base-100 border border-base-300 p-4 shadow-xs">
            <div class="text-[11px] font-bold uppercase tracking-wider text-base-content/60">Gross Register Sales</div>
            <div class="text-2xl font-black font-mono text-base-content mt-1">${{ lastCommittedReceipt.gross.toFixed(2) }}</div>
            <div class="text-[11px] text-base-content/60 mt-0.5">{{ lastCommittedReceipt.itemCount }} items sold at register</div>
          </div>

          <div class="card bg-base-100 border border-base-300 p-4 shadow-xs">
            <div class="text-[11px] font-bold uppercase tracking-wider text-base-content/60">Venue Commission ({{ activeCanonicalLocationMeta.feePct }}%)</div>
            <div class="text-2xl font-black font-mono text-error mt-1">-${{ lastCommittedReceipt.mallFee.toFixed(2) }}</div>
            <div class="text-[11px] text-base-content/60 mt-0.5">Retained by {{ activeCanonicalLocationMeta.shortName }}</div>
          </div>

          <div class="card bg-base-100 border border-base-300 p-4 shadow-xs">
            <div class="text-[11px] font-bold uppercase tracking-wider text-base-content/60">Booth Rent Paid</div>
            <div class="text-2xl font-black font-mono text-warning mt-1">-${{ lastCommittedReceipt.rent.toFixed(2) }}</div>
            <div class="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">Paid in full from sales</div>
          </div>

          <div class="card border p-4 shadow-xs" :class="lastCommittedReceipt.netCheck >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-error/10 border-error/30'">
            <div class="text-[11px] font-bold uppercase tracking-wider" :class="lastCommittedReceipt.netCheck >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-error'">Net Payout Check to Bank</div>
            <div class="text-2xl font-black font-mono mt-1" :class="lastCommittedReceipt.netCheck >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-error'">
              {{ lastCommittedReceipt.netCheck >= 0 ? `+$${lastCommittedReceipt.netCheck.toFixed(2)}` : `-$${Math.abs(lastCommittedReceipt.netCheck).toFixed(2)}` }}
            </div>
            <div class="text-[11px] opacity-80 mt-0.5 font-medium">Actual deposit to your account</div>
          </div>
        </div>

        <!-- Operational Health & Co-op Solvency -->
        <div class="card bg-base-200/50 border border-base-300 p-5 rounded-2xl shadow-xs space-y-4">
          <div class="flex items-center justify-between border-b border-base-300/80 pb-3 flex-wrap gap-2">
            <div>
              <h4 class="font-bold text-base flex items-center gap-2 text-base-content">
                <Icon icon="solar:shield-check-bold" class="w-5 h-5 text-emerald-500" />
                <span>Booth Solvency &amp; Overhead Settlement</span>
              </h4>
              <p class="text-xs text-base-content/60">
                How fixed booth rent (${{ Number(activeCanonicalLocationMeta.monthlyRent || 0).toFixed(2) }}) was covered between members and consignors.
              </p>
            </div>
            <div>
              <span class="badge font-bold py-3 px-3 text-xs" :class="lastCommittedReceipt.settlementSummary.isRentCovered ? 'badge-success text-white' : 'badge-warning'">
                {{ lastCommittedReceipt.settlementSummary.isRentCovered ? '✅ Overhead Fully Covered' : '⚠️ Rent Shortfall' }}
              </span>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div class="bg-base-100 p-3.5 rounded-xl border border-base-300/70">
              <span class="text-xs text-base-content/60 block font-medium">B&amp;B Consignor Rent Contribution</span>
              <span class="font-mono text-lg font-black text-secondary">+${{ (lastCommittedReceipt.settlementSummary.consignorRentOffsets || 0).toFixed(2) }}</span>
              <span class="text-[10px] opacity-60 block mt-0.5">Offsets booth rent dollar-for-dollar</span>
            </div>

            <div class="bg-base-100 p-3.5 rounded-xl border border-base-300/70">
              <span class="text-xs text-base-content/60 block font-medium">Net Rent Absorbed by Co-op</span>
              <span class="font-mono text-lg font-black text-warning">-${{ (lastCommittedReceipt.settlementSummary.netBoothRentForCoop || 0).toFixed(2) }}</span>
              <span class="text-[10px] opacity-60 block mt-0.5">${{ Number(activeCanonicalLocationMeta.monthlyRent || 0).toFixed(2) }} minus B&amp;B offset</span>
            </div>

            <div class="bg-base-100 p-3.5 rounded-xl border border-base-300/70">
              <span class="text-xs text-base-content/60 block font-medium">Commons Reserve Balance</span>
              <span class="font-mono text-lg font-black" :class="lastCommittedReceipt.settlementSummary.commonsSurplusAfterRent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-error'">
                {{ lastCommittedReceipt.settlementSummary.commonsSurplusAfterRent >= 0 ? `+$${lastCommittedReceipt.settlementSummary.commonsSurplusAfterRent.toFixed(2)}` : `-$${Math.abs(lastCommittedReceipt.settlementSummary.commonsSurplusAfterRent).toFixed(2)}` }}
              </span>
              <span class="text-[10px] opacity-60 block mt-0.5">Surplus remaining after paying rent</span>
            </div>
          </div>
        </div>

        <!-- Partner Payout Obligation Cards -->
        <div class="space-y-3">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <h4 class="font-bold text-base flex items-center gap-2 text-base-content">
              <Icon icon="solar:hand-money-bold-duotone" class="w-5 h-5 text-primary" />
              <span>Partner Payout Checks Due</span>
            </h4>
            <span class="text-xs opacity-60">Huckleberry Collective 70/30 Net Surplus Settlement</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div 
              v-for="partner in lastCommittedReceipt.partnerSettlements" 
              :key="partner.prefix"
              class="card bg-base-100 border border-base-300 p-4 rounded-2xl shadow-xs space-y-3"
            >
              <div class="flex items-center justify-between">
                <div>
                  <h5 class="font-bold text-sm text-base-content">{{ partner.name }}</h5>
                  <span class="badge badge-xs badge-outline font-mono font-bold">{{ partner.prefix }}</span>
                  <span v-if="partner.isConsignor" class="badge badge-xs badge-secondary font-bold ml-1">Consignor</span>
                </div>
                <button class="btn btn-xs btn-outline btn-primary gap-1" @click="downloadPartnerPdf(partner)">
                  <Icon icon="solar:document-bold" class="w-3.5 h-3.5" />
                  <span>PDF</span>
                </button>
              </div>

              <div class="space-y-1 text-xs">
                <div class="flex justify-between">
                  <span class="opacity-60">Gross Sales:</span>
                  <span class="font-mono font-bold">${{ partner.totalGross.toFixed(2) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="opacity-60">15% Venue Fee:</span>
                  <span class="font-mono text-error">-${{ partner.totalVenueFee.toFixed(2) }}</span>
                </div>
                <div v-if="partner.isConsignor" class="flex justify-between">
                  <span class="opacity-60">Booth Rent Share:</span>
                  <span class="font-mono text-warning font-bold">-${{ (partner.rentDeduction || 0).toFixed(2) }}</span>
                </div>
                <div v-else class="flex justify-between">
                  <span class="opacity-60">100% Cost Recouped:</span>
                  <span class="font-mono text-emerald-600 font-bold">+${{ partner.totalCostBasis.toFixed(2) }}</span>
                </div>
                <div v-if="!partner.isConsignor" class="flex justify-between">
                  <span class="opacity-60">70% Curator Profit:</span>
                  <span class="font-mono text-primary font-bold">+${{ partner.totalCuratorProfit.toFixed(2) }}</span>
                </div>
              </div>

              <div class="pt-2 border-t border-base-200 flex justify-between items-baseline">
                <span class="text-xs font-bold text-base-content/80">Net Payout Check:</span>
                <span class="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                  ${{ partner.totalPayoutCheck.toFixed(2) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Bottom Navigation Actions -->
        <div class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-base-300">
          <div class="text-xs text-base-content/70">
            <span v-if="parsedRows.length > 0">
              <strong>{{ parsedRows.length }} items</strong> remain in staging across other monthly cycles.
            </span>
            <span v-else>
              All items from your file have been committed and reconciled.
            </span>
          </div>

          <div class="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            <button 
              v-if="parsedRows.length > 0" 
              class="btn btn-sm btn-primary font-bold gap-1.5 shadow-sm"
              @click="dismissReceiptAndContinue"
            >
              <span>Reconcile Next Month ({{ remainingCyclesCount }} Remaining)</span>
              <Icon icon="solar:arrow-right-bold" class="w-4 h-4" />
            </button>

            <button 
              class="btn btn-sm btn-ghost border border-base-300 gap-1.5"
              @click="resetAndUploadNew"
            >
              <Icon icon="solar:upload-bold" class="w-4 h-4" />
              <span>Upload Another Payout File</span>
            </button>

            <a href="/sales" class="btn btn-sm btn-neutral gap-1.5 font-bold">
              <Icon icon="solar:cart-bold" class="w-4 h-4" />
              <span>Return to Sales</span>
            </a>
          </div>
        </div>
      </div>

      <!-- ========================================================================= -->
      <!-- ⚡ RICOCHET LIVE SALES & PAYOUT SYNC PANEL (MODULARIZED SUB-COMPONENT)    -->
      <!-- Driven 100% by activeCanonicalLocationMeta.usesRicochet                   -->
      <!-- ========================================================================= -->
      <RicochetLiveSalesPanel
        v-if="!lastCommittedReceipt && activeCanonicalLocationMeta.usesRicochet"
        :location-meta="activeCanonicalLocationMeta"
        :synced-at="ricochetSyncPayload?.syncedAt || null"
        :staged-rows="ricochetStagedRows"
        :filtered-rows="filteredRicochetStagedRows"
        :space-rental-adjustments="ricochetSpaceRentalAdjustments"
        :pending-rows-count="ricochetPendingRowsCount"
        :paid-rows-count="ricochetPaidRowsCount"
        :summary="ricochetSummary"
        :actionable-new-count="ricochetActionableNewCount"
        v-model:sub-filter="ricochetSubFilter"
        :is-loading="isLoadingRicochetSync"
        :is-simulating="isSimulatingRicochetSync"
        :is-committing="isCommittingRicochetSync"
        :is-auto-creating-unmatched="isAutoCreatingAll"
        v-model:is-live-commit-unlocked="isRicochetLiveCommitUnlocked"
        :dry-run-result="ricochetDryRunResult"
        v-model:is-paste-drawer-open="isPasteRicochetDrawerOpen"
        v-model:pasted-text="pastedRicochetSyncText"
        :commit-progress="ricochetCommitProgress"
        :manifest-status="ricochetManifestStatus"
        :manifest-committed-count="ricochetManifestCommittedCount"
        :manifest-committed-at="ricochetManifestCommittedAt"
        @refresh="fetchStagedRicochetSales(true)"
        @simulate="simulateStagedRicochetSales"
        @commit="commitStagedRicochetSales"
        @dismiss-dry-run="ricochetDryRunResult = null"
        @apply-pasted="applyPastedRicochetSyncPayload"
        @assign-row="stageSingleRicochetRowIntoHandsOnMatcher"
        @quick-create-row="quickCreateRicochetStagedRow"
        @auto-create-all-unmatched="autoCreateAllUnmatchedRicochetRows"
      />

      <!-- ========================================================================= -->
      <!-- 📸 PAPER SALES SHEET & HANDS-ON RECONCILER WORKSPACE                      -->
      <!-- Driven 100% by activeCanonicalLocationMeta.supportsPaperSalesSheet / tab   -->
      <!-- ========================================================================= -->
      <div v-if="!lastCommittedReceipt && !activeCanonicalLocationMeta.usesRicochet" class="mb-6 space-y-4">
        <!-- Intake Mode Switcher Strip (Paper Sales Sheet vs POS Payout CSV) -->
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-base-200/70 p-2.5 rounded-2xl border border-base-300">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs font-black uppercase tracking-wider px-2 text-base-content/75 flex items-center gap-1.5">
              <span>{{ activeCanonicalLocationMeta.icon }}</span>
              <span>{{ activeCanonicalLocationMeta.shortName }} Intake Mode:</span>
            </span>
            <div class="join bg-base-100 p-0.5 rounded-xl border border-base-300 shadow-2xs">
              <button
                type="button"
                class="btn btn-xs sm:btn-sm join-item gap-1.5 font-bold"
                :class="salesIntakeTab === 'paper_sheet' ? 'btn-secondary text-secondary-content shadow-xs font-black' : 'btn-ghost'"
                @click="salesIntakeTab = 'paper_sheet'"
              >
                <span>📸 Paper Sales Sheet &amp; Hands-On Entry</span>
                <span v-if="activeCanonicalLocationMeta.supportsPaperSalesSheet" class="badge badge-xs badge-warning text-warning-content font-mono font-bold">Default</span>
              </button>
              <button
                type="button"
                class="btn btn-xs sm:btn-sm join-item gap-1.5 font-bold"
                :class="salesIntakeTab === 'pos_csv' ? 'btn-primary text-primary-content shadow-xs font-black' : 'btn-ghost'"
                @click="salesIntakeTab = 'pos_csv'"
              >
                <span>📄 POS Payout CSV Upload</span>
                <span v-if="!activeCanonicalLocationMeta.supportsPaperSalesSheet" class="badge badge-xs badge-primary text-primary-content font-mono font-bold">Default</span>
              </button>
            </div>
          </div>

          <div class="flex items-center gap-2 text-xs font-mono px-2">
            <span class="badge badge-sm badge-outline font-bold">
              Fee: {{ activeCanonicalLocationMeta.feePct }}%
            </span>
            <span class="badge badge-sm badge-outline font-bold">
              Rent: ${{ Number(activeCanonicalLocationMeta.monthlyRent || 0).toFixed(2) }}/mo
            </span>
          </div>
        </div>

        <!-- PAPER SALES SHEET & HANDS-ON ENTRY PANEL -->
        <div
          v-if="salesIntakeTab === 'paper_sheet'"
          class="card bg-base-100 border-2 border-secondary/35 shadow-md p-4 sm:p-6 rounded-2xl space-y-5"
        >
          <!-- Top Header + Camera / Upload Trigger + + Add Sold Line by Hand -->
          <div class="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-base-200 pb-4">
            <div class="flex items-start gap-3">
              <div class="w-12 h-12 rounded-2xl bg-secondary/15 text-secondary flex items-center justify-center text-2xl shrink-0">
                📸
              </div>
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="text-lg sm:text-xl font-black text-base-content">
                    {{ activeCanonicalLocationMeta.shortName }} ({{ activeCanonicalLocationMeta.code }}) Paper Sales Sheet &amp; Hands-On Reconciler
                  </h3>
                  <span class="badge badge-xs badge-secondary text-secondary-content font-mono font-bold">
                    {{ activeCanonicalLocationMeta.feePct }}% Booth Fee Auto-Calculated
                  </span>
                </div>
                <p class="text-xs opacity-75 mt-0.5">
                  Snap or upload a photo of your handwritten/printed booth sales sheet for Gemini Vision OCR extraction, add lines by hand, or 1-click pick from active {{ activeCanonicalLocationMeta.shortName }} booth stock below.
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-end">
              <!-- Snap or Upload Sales Sheet Photo (Camera / File Input) -->
              <label
                class="btn btn-sm sm:btn-md btn-secondary text-secondary-content font-black gap-2 shadow-md cursor-pointer"
                :class="{ 'btn-disabled opacity-60': isParsingSheetPhoto }"
              >
                <span v-if="isParsingSheetPhoto" class="loading loading-spinner loading-xs"></span>
                <span v-else>📸</span>
                <span>{{ isParsingSheetPhoto ? 'AI Reading Sales Sheet...' : 'Snap / Upload Sales Sheet Photo' }}</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  class="hidden"
                  :disabled="isParsingSheetPhoto"
                  @change="handleSalesSheetPhotoUpload"
                />
              </label>

              <!-- + Add Sold Line by Hand -->
              <button
                type="button"
                class="btn btn-sm sm:btn-md btn-primary font-black gap-1.5 shadow-sm"
                @click="addManualSoldLine()"
              >
                <span>✍️ + Add Sold Line by Hand</span>
              </button>
            </div>
          </div>

          <!-- Sheet Photo Preview Strip (When a Sales Sheet Photo was Snapped/Uploaded) -->
          <div
            v-if="sheetPhotoPreviewUrl"
            class="p-3 rounded-xl bg-base-200/70 border border-base-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
          >
            <div class="flex items-center gap-3">
              <img
                :src="sheetPhotoPreviewUrl"
                alt="Sales Sheet Preview"
                class="w-14 h-14 rounded-lg object-cover border border-base-300 shrink-0"
              />
              <div class="text-xs space-y-0.5">
                <div class="font-black text-base-content flex items-center gap-1.5">
                  <span>✅ Sales Sheet Photo Processed</span>
                  <span v-if="lastParsedSheetTitle" class="badge badge-xs badge-secondary font-mono">{{ lastParsedSheetTitle }}</span>
                </div>
                <p class="opacity-70">
                  Review and edit the extracted sold lines below, or snap another page to append more rows.
                </p>
              </div>
            </div>
            <button
              type="button"
              class="btn btn-xs btn-ghost text-error"
              @click="sheetPhotoPreviewUrl = ''; lastParsedSheetTitle = ''"
            >
              Clear Photo Preview ✕
            </button>
          </div>

          <!-- ✍️ HANDS-ON EDITABLE SALES TABLE (Inline Date, Title, Tag/UPC, Qty, Gross, Auto-Fee, Auto-Net) -->
          <div class="space-y-3">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <div class="flex items-center gap-2">
                <h4 class="font-black text-sm uppercase tracking-wider text-base-content/80 flex items-center gap-1.5">
                  <span>✍️ Hands-On Editable Sold Lines ({{ parsedRows.length }})</span>
                </h4>
                <span class="text-xs opacity-65">
                  Edits update Booth Fee ({{ activeCanonicalLocationMeta.feePct }}%) &amp; Net Payout live
                </span>
              </div>

              <div v-if="parsedRows.length > 0" class="flex items-center gap-3 text-xs font-mono">
                <span>Gross: <strong class="text-base-content">${{ handsOnTotals.gross.toFixed(2) }}</strong></span>
                <span>Fee ({{ activeCanonicalLocationMeta.feePct }}%): <strong class="text-error">-${{ handsOnTotals.fee.toFixed(2) }}</strong></span>
                <span>Net After Fee: <strong class="text-emerald-600 dark:text-emerald-400">+${{ handsOnTotals.net.toFixed(2) }}</strong></span>
              </div>
            </div>

            <div
              v-if="parsedRows.length === 0"
              class="p-6 rounded-2xl bg-base-200/40 border border-dashed border-base-300 text-center space-y-2"
            >
              <div class="text-2xl">📝</div>
              <div class="font-bold text-sm text-base-content">
                No sold lines staged for {{ activeCanonicalLocationMeta.shortName }} ({{ activeCanonicalLocationMeta.code }}) yet
              </div>
              <p class="text-xs opacity-65 max-w-md mx-auto">
                Click <strong>📸 Snap / Upload Sales Sheet Photo</strong> above to extract lines with AI Vision, click <strong>✍️ + Add Sold Line by Hand</strong>, or click any item in the <strong>📦 Active Booth Inventory Pick-List</strong> below!
              </p>
            </div>

            <div v-else class="overflow-x-auto rounded-xl border border-base-300 bg-base-100">
              <table class="table table-xs sm:table-sm w-full">
                <thead>
                  <tr class="bg-base-200/80 text-[11px] uppercase tracking-wider font-black text-base-content/75">
                    <th class="w-32">Sold Date</th>
                    <th class="w-28">Tag / UPC</th>
                    <th class="min-w-48">Item Description</th>
                    <th class="w-16 text-center">Qty</th>
                    <th class="w-28 text-right">Gross ($)</th>
                    <th class="w-24 text-right">Fee ({{ activeCanonicalLocationMeta.feePct }}%)</th>
                    <th class="w-24 text-right">Net ($)</th>
                    <th class="min-w-44">Linked Booth Item</th>
                    <th class="w-16 text-center">Remove</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-base-200">
                  <tr
                    v-for="(row, rIdx) in parsedRows"
                    :key="rIdx"
                    class="hover:bg-base-200/40 transition-colors"
                  >
                    <!-- Editable Date -->
                    <td>
                      <input
                        type="date"
                        :value="normalizeRowDateForInput(row.date)"
                        class="input input-xs input-bordered font-mono w-full"
                        @input="onHandsOnDateChange(row, ($event.target as HTMLInputElement).value)"
                      />
                    </td>

                    <!-- Editable Tag / UPC -->
                    <td>
                      <input
                        type="text"
                        v-model="row.extractedSku"
                        placeholder="HUCK-..."
                        class="input input-xs input-bordered font-mono font-bold uppercase w-full"
                        @change="onHandsOnSkuOrTitleEdit(row)"
                      />
                    </td>

                    <!-- Editable Description / Title -->
                    <td>
                      <input
                        type="text"
                        v-model="row.itemName"
                        placeholder="Item sold description..."
                        class="input input-xs input-bordered font-semibold w-full"
                        @change="onHandsOnSkuOrTitleEdit(row)"
                      />
                    </td>

                    <!-- Editable Quantity -->
                    <td class="text-center">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        :value="row.repeatCount || 1"
                        class="input input-xs input-bordered font-mono text-center w-14"
                        @input="onHandsOnQtyChange(row, Number(($event.target as HTMLInputElement).value))"
                      />
                    </td>

                    <!-- Editable Gross Sold Price -->
                    <td class="text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        :value="row.listedPrice"
                        class="input input-xs input-bordered font-mono font-bold text-right w-24"
                        @input="onHandsOnGrossChange(row, Number(($event.target as HTMLInputElement).value))"
                      />
                    </td>

                    <!-- Auto-Computed Venue Fee -->
                    <td class="text-right font-mono text-xs text-error font-semibold">
                      -${{ Number((Number(row.listedPrice || 0) - Number(row.salePrice || 0)).toFixed(2)).toFixed(2) }}
                    </td>

                    <!-- Auto-Computed Net Payout -->
                    <td class="text-right font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">
                      +${{ Number(row.salePrice || 0).toFixed(2) }}
                    </td>

                    <!-- Linked Booth Item or 1-Click Match Trigger -->
                    <td>
                      <div v-if="row.mappedItem" class="flex items-center justify-between gap-1.5 bg-success/10 border border-success/30 px-2 py-1 rounded-lg">
                        <div class="truncate text-xs">
                          <span class="badge badge-xs badge-primary font-mono font-bold mr-1">{{ row.mappedItem.upc || 'ITEM' }}</span>
                          <span class="font-semibold">{{ row.mappedItem.title }}</span>
                        </div>
                        <button
                          type="button"
                          class="btn btn-xs btn-ghost btn-circle text-error shrink-0"
                          title="Unlink item"
                          @click="row.mappedItem = null; saveStagingSession()"
                        >
                          ✕
                        </button>
                      </div>
                      <div v-else class="flex items-center gap-1">
                        <button
                          type="button"
                          class="btn btn-xs btn-outline border-base-300 hover:border-primary font-bold gap-1"
                          @click="openMatcherDrawer(row)"
                        >
                          <span>🔍 Match</span>
                        </button>
                        <button
                          type="button"
                          class="btn btn-xs btn-ghost border border-base-300 font-bold"
                          :disabled="row.isQuickAdding"
                          @click="quickAddRow(row)"
                          title="Create new sold item with next barcode"
                        >
                          + New
                        </button>
                      </div>
                    </td>

                    <!-- Remove Row -->
                    <td class="text-center">
                      <button
                        type="button"
                        class="btn btn-xs btn-ghost text-error btn-circle"
                        title="Remove line"
                        @click="removeHandsOnRow(rIdx)"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 📦 ACTIVE BOOTH INVENTORY PICK-LIST (Items Currently Placed at activeCanonicalLocationMeta.code) -->
          <div class="pt-3 border-t border-base-200 space-y-3">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <h4 class="font-black text-sm flex items-center gap-1.5 text-base-content">
                  <span>📦 Active {{ activeCanonicalLocationMeta.shortName }} ({{ activeCanonicalLocationMeta.code }}) Booth Inventory Pick-List</span>
                  <span class="badge badge-xs badge-primary font-mono font-bold">{{ activeBoothInventoryForLocation.length }} in booth</span>
                </h4>
                <p class="text-[11px] opacity-70">
                  Click <strong>+ Add as Sold Line</strong> on any active {{ activeCanonicalLocationMeta.shortName }} item below to drop it straight into your sales sheet with its barcode, price, and {{ activeCanonicalLocationMeta.feePct }}% fee!
                </p>
              </div>

              <div class="relative w-full sm:w-64">
                <input
                  type="text"
                  v-model="boothPickListSearch"
                  :placeholder="'Search ' + activeCanonicalLocationMeta.shortName + ' stock (HUCK-..., title)...'"
                  class="input input-xs sm:input-sm input-bordered w-full font-mono"
                />
              </div>
            </div>

            <div
              v-if="filteredBoothPickList.length === 0"
              class="p-4 rounded-xl bg-base-200/40 border border-base-300 text-xs opacity-70 text-center"
            >
              No active inventory items matched in {{ activeCanonicalLocationMeta.shortName }} ({{ activeCanonicalLocationMeta.code }}). You can still add any sold line by hand above!
            </div>

            <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1">
              <div
                v-for="bItem in filteredBoothPickList"
                :key="bItem.$id"
                class="p-2.5 rounded-xl bg-base-200/50 hover:bg-base-200 border border-base-300 flex items-center justify-between gap-2.5 transition-all"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="w-9 h-9 rounded-lg bg-base-300 overflow-hidden shrink-0 flex items-center justify-center">
                    <img
                      v-if="getItemThumbUrl(bItem)"
                      :src="getItemThumbUrl(bItem)"
                      :alt="bItem.title"
                      class="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <Icon v-else icon="solar:tag-bold" class="w-4 h-4 opacity-40" />
                  </div>
                  <div class="min-w-0 text-xs">
                    <div class="font-bold truncate text-base-content" :title="bItem.title">{{ bItem.title }}</div>
                    <div class="font-mono text-[10px] opacity-75 flex items-center gap-1.5">
                      <span class="text-primary font-black">{{ bItem.upc || bItem.locationSku || 'NO UPC' }}</span>
                      <span>•</span>
                      <span class="text-secondary font-bold">${{ Number(bItem.boutiquePrice || bItem.resalePrice || bItem.price || 0).toFixed(2) }}</span>
                      <span v-if="Number(bItem.quantity || 1) > 1" class="badge badge-xs badge-outline">Qty {{ bItem.quantity }}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  class="btn btn-xs btn-secondary text-secondary-content font-black shrink-0 gap-1 shadow-2xs"
                  @click="addActiveBoothItemAsSoldLine(bItem)"
                  title="Add this active booth item directly as a sold line"
                >
                  <span>+ Sold</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty canvas state: manual CSV upload + multi-month demo live in the right-edge slide-over tray -->
      <div
        v-if="!lastCommittedReceipt && !parsedRows.length && salesIntakeTab === 'pos_csv' && !activeCanonicalLocationMeta.usesRicochet"
        class="flex flex-col items-center justify-center text-center gap-3 py-16 border-2 border-dashed border-base-300 rounded-2xl bg-base-200/40"
      >
        <Icon icon="solar:upload-minimalistic-linear" class="w-10 h-10 opacity-50 text-primary" />
        <div class="font-bold text-base-content">No payout rows staged for {{ activeCanonicalLocationMeta.shortName }} yet</div>
        <p class="text-xs opacity-70 max-w-sm">Open the tray to upload a month-end payout CSV or load the multi-month demo.</p>
        <button type="button" class="btn btn-sm btn-primary gap-1.5 rounded-xl font-bold" @click="isImportTrayOpen = true">
          <span>📂 Manual CSV &amp; Demo</span>
        </button>
      </div>

      <!-- Slide-Over Tray: Upload Month-End Payout CSV dropzone + Load Multi-Month Demo -->
      <SalesImportTray
        :is-open="isImportTrayOpen"
        :is-processing="isProcessing"
        :catalog-file-detected="catalogFileDetected"
        :location-meta="activeCanonicalLocationMeta"
        @close="isImportTrayOpen = false"
        @file-selected="handleFileUpload"
        @load-demo="loadDefaultPayoutFile"
      />

      <!-- Step 2: Reconciliation & Settlement UI -->
      <div v-if="!lastCommittedReceipt && parsedRows.length > 0">
        <!-- Monthly Payout Cycle Tabs & Statement Banner -->
        <div v-if="payoutCycles.length > 0" class="bg-base-200/70 p-4 rounded-2xl border border-base-300 mb-5 shadow-sm space-y-3">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold uppercase tracking-wider text-base-content/80 flex items-center gap-1.5">
                <Icon icon="solar:calendar-date-bold" class="w-4 h-4 text-primary" />
                Select Payout Month:
              </span>
              <span class="badge badge-primary font-bold font-mono">{{ currentCycleInfo.label }}</span>
            </div>
            <div class="text-xs font-mono text-base-content/70 flex items-center gap-2">
              <span v-if="currentCycleInfo.paidDate">Paid Check: <strong class="text-base-content">{{ currentCycleInfo.paidDate }}</strong></span>
              <span class="badge badge-sm badge-warning font-bold">Space Rent: -${{ currentCycleInfo.spaceRental.toFixed(2) }}</span>
            </div>
          </div>

          <!-- Month Selector Pills: Single Months First -->
          <div class="flex flex-wrap gap-1.5">
            <button 
              v-for="cycle in payoutCycles" 
              :key="cycle.id"
              class="btn btn-sm rounded-xl font-mono gap-1.5"
              :class="selectedCycle === cycle.id ? 'btn-primary font-bold shadow-md' : 'btn-ghost bg-base-100/70'"
              @click="selectedCycle = cycle.id"
            >
              <span>{{ cycle.label }}</span>
              <span class="badge badge-xs font-mono" :class="selectedCycle === cycle.id ? 'badge-neutral' : 'badge-ghost'">
                {{ cycle.itemCount }} {{ cycle.itemCount === 1 ? 'item' : 'items' }} · ${{ cycle.expectedCheck.toFixed(2) }} Check
              </span>
            </button>
            <button 
              v-if="payoutCycles.length > 1"
              class="btn btn-sm rounded-xl gap-1.5" 
              :class="selectedCycle === 'ALL' ? 'btn-neutral font-bold shadow-md' : 'btn-ghost bg-base-100/70'"
              @click="selectedCycle = 'ALL'"
            >
              <span>All Months Combined ({{ payoutCycles.length }} Mos)</span>
              <span class="badge badge-xs font-mono" :class="selectedCycle === 'ALL' ? 'badge-primary' : 'badge-ghost'">
                {{ parsedRows.length }} items · ${{ totalAllChecks.toFixed(2) }}
              </span>
            </button>
          </div>

          <!-- Active Selected Month Financial Pillars -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
            <div class="bg-base-100 p-3 rounded-xl border border-base-300/50">
              <span class="text-[11px] opacity-60 block uppercase font-medium">1. Gross Register Sales</span>
              <span class="font-bold font-mono text-lg text-base-content">${{ selectedCycleFinancials.gross.toFixed(2) }}</span>
            </div>
            <div class="bg-base-100 p-3 rounded-xl border border-base-300/50">
              <span class="text-[11px] opacity-60 block uppercase font-medium">2. Venue Fee ({{ activeCanonicalLocationMeta.feePct }}%)</span>
              <span class="font-mono text-lg text-error font-semibold">-${{ selectedCycleFinancials.mallFee.toFixed(2) }}</span>
            </div>
            <div class="bg-base-100 p-3 rounded-xl border border-base-300/50">
              <span class="text-[11px] opacity-60 block uppercase font-medium">3. Space Rental (Rent)</span>
              <span class="font-mono text-lg text-warning font-bold">-${{ selectedCycleFinancials.rent.toFixed(2) }}</span>
            </div>
            <div class="p-3 rounded-xl border" :class="selectedCycleFinancials.netCheck >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-error/10 border-error/30'">
              <span class="text-[11px] block uppercase font-bold" :class="selectedCycleFinancials.netCheck >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-error'">4. Net Payout Check</span>
              <span class="font-mono text-xl font-black" :class="selectedCycleFinancials.netCheck >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-error'">
                {{ selectedCycleFinancials.netCheck >= 0 ? `+$${selectedCycleFinancials.netCheck.toFixed(2)}` : `-$${Math.abs(selectedCycleFinancials.netCheck).toFixed(2)}` }}
              </span>
            </div>
          </div>
        </div>

        <!-- Top Mode Switcher -->
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-base-300 pb-4 mb-5">
          <div class="join bg-base-200 p-1 rounded-xl shadow-inner w-full md:w-auto">
            <button 
              class="btn btn-sm join-item gap-2 flex-1 md:flex-none"
              :class="activeView === 'matching' ? 'btn-primary shadow-sm' : 'btn-ghost'"
              @click="activeView = 'matching'"
            >
              <Icon icon="solar:checklist-minimalistic-bold" class="w-4 h-4" />
              <span>Review & Match Items</span>
              <span class="badge badge-xs font-mono font-bold" :class="matchedCount === cycleFilteredRows.length ? 'badge-success text-white' : 'badge-ghost'">
                {{ matchedCount }}/{{ cycleFilteredRows.length }}
              </span>
            </button>
            <button 
              class="btn btn-sm join-item gap-2 flex-1 md:flex-none"
              :class="activeView === 'settlement' ? 'btn-primary shadow-sm' : 'btn-ghost'"
              @click="activeView = 'settlement'"
              :disabled="matchedCount === 0"
            >
              <Icon icon="solar:hand-money-bold-duotone" class="w-4 h-4" />
              <span>Co-op Settlement & Statements</span>
              <span v-if="matchedCount > 0" class="badge badge-xs badge-success text-white font-bold ml-1">
                {{ partnerSettlements.length }} {{ partnerSettlements.length === 1 ? 'Partner' : 'Partners' }}
              </span>
            </button>
          </div>

          <div class="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
            <button 
              class="btn btn-sm btn-outline btn-ghost text-xs gap-1"
              @click="exportStagingSessionJson"
              title="Save this in-progress session to a portable JSON file so you or a teammate can resume anytime on another computer"
            >
              <Icon icon="solar:share-bold" class="w-3.5 h-3.5 text-primary" />
              <span class="hidden sm:inline">Share / Export Session</span>
            </button>
            <button class="btn btn-sm btn-ghost text-xs" @click="resetAndUploadNew">Upload New File</button>
            
            <button 
              v-if="activeView === 'matching'"
              class="btn btn-sm btn-primary shadow-md shadow-primary/20 gap-1.5" 
              :disabled="matchedCount === 0 || isImporting" 
              @click="executeImport"
            >
              <Icon icon="solar:cloud-upload-bold" class="w-4 h-4" />
              Commit {{ matchedCount }} Matched {{ matchedCount === 1 ? 'Item' : 'Items' }}
            </button>

            <button
              v-else-if="activeView === 'settlement' && partnerSettlements.length > 0"
              class="btn btn-sm btn-success text-white shadow-md shadow-success/20 gap-1.5"
              @click="exportAllPartnerPdfs"
            >
              <Icon icon="solar:file-download-bold" class="w-4 h-4" />
              Download All Partner Statements (PDF)
            </button>
          </div>
        </div>

        <!-- VIEW 1: MATCHING & RECONCILIATION -->
        <div v-if="activeView === 'matching'">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 mb-4">
            <div>
              <h3 class="font-bold text-lg">Process Sales — {{ currentCycleInfo.label }} ({{ cycleFilteredRows.length }} Items)</h3>
              <div class="flex items-center gap-2 mt-1">
                <div class="join">
                  <button class="btn btn-xs join-item" :class="{'btn-active btn-primary': filterTab === 'all'}" @click="filterTab = 'all'">
                    All ({{ cycleFilteredRows.length }})
                  </button>
                  <button class="btn btn-xs join-item text-success" :class="{'btn-active btn-success text-white': filterTab === 'matched'}" @click="filterTab = 'matched'">
                    Matched ({{ matchedCount }})
                  </button>
                  <button class="btn btn-xs join-item text-error" :class="{'btn-active btn-error text-white': filterTab === 'unmatched'}" @click="filterTab = 'unmatched'">
                    Unmatched ({{ unmatchedCount }})
                  </button>
                  <button class="btn btn-xs join-item text-info" :class="{'btn-active btn-info text-white': filterTab === 'multi'}" @click="filterTab = 'multi'">
                    Multi-Qty ({{ multiCount }})
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="overflow-x-auto border border-base-300 rounded-xl bg-base-100 shadow-sm">
            <table class="table table-sm">
              <thead class="sticky top-0 bg-base-200/90 backdrop-blur z-10">
                <tr class="bg-base-200">
                  <th class="w-10">Match</th>
                  <th class="w-16">CSV Status</th>
                  <th>Sold Item (CSV)</th>
                  <th class="w-24">Price</th>
                  <th class="min-w-64">Matched ResaleCommand Item</th>
                  <th class="w-36 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr 
                  v-for="(row, index) in displayedRows" 
                  :key="index" 
                  :class="{'bg-success/10': row.mappedItem, 'hover:bg-base-200/60 cursor-pointer': true}"
                  @click="openMatcherDrawer(row)"
                >
                  <td>
                    <Icon v-if="row.mappedItem" icon="solar:check-circle-bold" class="w-5 h-5 text-success" />
                    <Icon v-else icon="solar:danger-circle-bold" class="w-5 h-5 text-error" />
                  </td>
                  <td>
                    <span class="badge badge-xs" :class="{'badge-success': row.status === 'sold' || row.status === 'paid', 'badge-ghost': row.status !== 'sold' && row.status !== 'paid'}">
                      {{ row.status || 'N/A' }}
                    </span>
                  </td>
                  <td>
                    <div class="font-semibold text-sm">{{ row.itemName }}</div>
                    <div class="font-mono text-xs opacity-70 flex items-center gap-1.5 flex-wrap">
                      <span class="flex items-center gap-1">
                        <Icon icon="solar:tag-bold" class="w-3 h-3 text-secondary" />
                        <span v-if="row.extractedSku">CSV SKU: {{ row.extractedSku }}</span>
                        <span v-else-if="row.mappedItem?.locationSku" class="text-success font-bold font-mono">
                          SKU: {{ row.mappedItem.locationSku }}
                        </span>
                        <span v-else-if="row.mappedItem?.upc" class="text-success font-bold font-mono">
                          UPC: {{ row.mappedItem.upc }}
                        </span>
                        <span v-else class="opacity-50">SKU: Not in CSV</span>
                      </span>
                      <span v-if="row.ticketNumber" class="badge badge-xs badge-info font-mono font-bold">
                        🎟️ Ticket #{{ row.ticketNumber }}
                      </span>
                      <span v-if="row.isAlreadyRecorded" class="badge badge-xs badge-success font-bold whitespace-nowrap" title="This sale is already in the sales ledger. It will be skipped and will not change stock.">✅ Already Recorded (Skipped)</span>
                      <span v-if="row.isMultiQty || row.isMultiQtyCandidate" class="badge badge-xs font-bold font-mono" :class="row.isMultiQty ? 'badge-info text-white' : 'badge-ghost opacity-70'">
                        📦 {{ row.isMultiQty ? `Multi-Qty (${row.repeatCount || 2}x in file)` : `Repeats ${row.repeatCount || 2}x (Single)` }}
                      </span>
                      <button 
                        type="button" 
                        class="btn btn-xs py-0 px-1.5 h-5 min-h-0 rounded-md font-bold gap-1 transition-all"
                        :class="row.isMultiQty ? 'btn-info text-white shadow-xs' : 'btn-ghost text-base-content/60 border border-base-300'"
                        @click.stop="toggleRowMultiQty(row)"
                        :title="row.isMultiQty ? 'Flagged as Multi-Quantity SKU (Multiple sales permitted)' : 'Single-Unit SKU (Strictly 1 sale max)'"
                      >
                        <Icon :icon="row.isMultiQty ? 'solar:box-minimalistic-bold' : 'solar:box-minimalistic-linear'" class="w-3 h-3" />
                        <span class="text-[10px]">{{ row.isMultiQty ? 'Multi-Qty' : 'Single' }}</span>
                      </button>
                      <span v-if="row.isSubClient" class="badge badge-xs badge-secondary font-bold font-mono">
                        👗 B&B Consignment (BB-)
                      </span>
                      <span v-if="row.cycleLabel" class="badge badge-xs badge-ghost font-mono">
                        📅 {{ row.cycleLabel }}
                      </span>
                      <span v-if="row.customerName" class="badge badge-xs badge-secondary">
                        👤 {{ row.customerName }}
                      </span>
                    </div>
                  </td>
                  <td class="font-mono text-success font-bold">${{ row.salePrice.toFixed(2) }}</td>
                  <td @click.stop="openMatcherDrawer(row)" class="py-2.5">
                    <div v-if="row.mappedItem" class="flex items-start sm:items-center gap-2.5 p-2 rounded-xl bg-base-100 border border-base-300">
                      <div class="w-9 h-9 rounded-lg bg-base-200 border border-base-300 overflow-hidden shrink-0 flex items-center justify-center">
                        <img
                          v-if="getItemThumbUrl(row.mappedItem)"
                          :src="getItemThumbUrl(row.mappedItem)"
                          :alt="row.mappedItem.title"
                          class="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <Icon v-else icon="solar:gallery-minimalistic-linear" class="w-4 h-4 opacity-35" />
                      </div>
                      <div class="flex-1 min-w-0 space-y-0.5">
                        <div class="flex items-center gap-1.5 flex-wrap">
                          <span class="badge badge-xs badge-primary text-primary-content font-mono font-black">{{ row.mappedItem.upc || 'NO UPC' }}</span>
                          <span class="badge badge-xs badge-ghost font-mono">DB: ${{ Number(row.mappedItem.resalePrice || 0).toFixed(2) }}</span>
                          <span v-if="row.isSavedToMd" class="badge badge-xs badge-success text-success-content font-black">✓ Saved to MD</span>
                        </div>
                        <div class="text-xs font-bold leading-snug text-base-content break-words whitespace-normal">
                          {{ row.mappedItem.title }}
                        </div>
                      </div>
                      <button class="btn btn-xs btn-ghost text-error shrink-0 hover:bg-error/10" @click.stop="row.mappedItem = null; row.isSavedToMd = false;" title="Unlink Item">✕</button>
                    </div>
                    <div v-else class="flex items-center gap-2">
                      <button
                        type="button"
                        class="btn btn-xs btn-outline border-base-300 hover:border-primary text-base-content font-bold gap-1.5"
                        @click.stop="openMatcherDrawer(row)"
                      >
                        <span>🔍 Open Match Drawer</span>
                        <span
                          v-if="getRowSuggestedCount(row) > 0"
                          class="badge badge-xs badge-success text-success-content font-black"
                        >
                          {{ getRowSuggestedCount(row) }} suggested
                        </span>
                      </button>
                    </div>
                  </td>
                  <td class="text-center" @click.stop>
                    <div class="flex items-center justify-center gap-1.5">
                      <button 
                        type="button"
                        class="btn btn-xs gap-1 font-bold rounded-lg shadow-xs"
                        :class="row.mappedItem ? 'btn-ghost border border-base-300 hover:btn-primary' : 'btn-primary'"
                        @click="openMatcherDrawer(row)"
                        :title="row.mappedItem ? 'Open Inventory Match Drawer to change item' : 'Open Inventory Match Drawer'"
                      >
                        <span>{{ row.mappedItem ? '🔄 Change' : '🔍 Match' }}</span>
                      </button>
                      <button 
                        v-if="!row.mappedItem"
                        type="button"
                        class="btn btn-xs btn-ghost text-base-content/70 hover:btn-primary font-bold shrink-0 gap-1 border border-base-300 rounded-lg"
                        :disabled="row.isQuickAdding"
                        @click="quickAddRow(row)"
                        title="Create this item with next barcode and mark as sold"
                      >
                        <span v-if="row.isQuickAdding" class="loading loading-spinner loading-xs"></span>
                        <Icon v-else icon="solar:add-circle-bold" class="w-3.5 h-3.5" />
                        <span>+ Add</span>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div v-if="unmatchedCount > 0" class="alert alert-warning mt-4 p-3.5 rounded-2xl shadow-sm border border-warning/30 bg-warning/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div class="flex items-center gap-2.5">
              <Icon icon="solar:shield-warning-bold" class="w-6 h-6 text-warning shrink-0" />
              <div>
                <div class="font-bold text-sm text-base-content">{{ unmatchedCount }} uncataloged or sub-client items need barcodes.</div>
                <div class="text-xs opacity-75">Click "Auto-Create" to generate sequential barcodes (HUCK-, PDXGL-, BB-) and mark them as Sold so your production sales records match 100% of this payout.</div>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
              <button 
                class="btn btn-sm btn-secondary font-bold gap-1.5 shadow-sm"
                :disabled="isAutoCreatingAll"
                @click="autoCreateAllUnmatched"
              >
                <span v-if="isAutoCreatingAll" class="loading loading-spinner loading-xs"></span>
                <Icon v-else icon="solar:magic-stick-3-bold" class="w-4 h-4" />
                <span>Auto-Create All {{ unmatchedCount }} as Sold</span>
              </button>
              <button class="btn btn-sm btn-ghost border border-base-300" @click="filterTab = filterTab === 'unmatched' ? 'all' : 'unmatched'">
                {{ filterTab === 'unmatched' ? 'Show All' : 'Review Unmatched' }}
              </button>
            </div>
          </div>
        </div>

        <!-- VIEW 2: CO-OP SETTLEMENT & STATEMENTS -->
        <div v-else class="space-y-6">
          <!-- Unmatched Warning Alert for Settlement View -->
          <div v-if="unmatchedCount > 0" class="alert alert-warning border border-warning/40 bg-warning/10 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <Icon icon="solar:danger-triangle-bold" class="w-8 h-8 text-warning shrink-0" />
              <div>
                <h4 class="font-black text-sm text-base-content">Partial Settlement Notice: {{ unmatchedCount }} Items Not Yet Cataloged!</h4>
                <p class="text-xs text-base-content/80 mt-0.5">
                  Currently, this statement is only calculating payouts for the <strong>{{ matchedCount }} matched items</strong> while deducting the full ${{ currentCycleInfo.spaceRental.toFixed(2) }} booth rent. Auto-create or match the remaining {{ unmatchedCount }} items to reflect your true gross revenue and net check!
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
              <button 
                class="btn btn-sm btn-secondary font-bold gap-1.5 shadow-sm"
                :disabled="isAutoCreatingAll"
                @click="autoCreateAllUnmatched"
              >
                <span v-if="isAutoCreatingAll" class="loading loading-spinner loading-xs"></span>
                <Icon v-else icon="solar:magic-stick-3-bold" class="w-4 h-4" />
                <span>Auto-Create All {{ unmatchedCount }}</span>
              </button>
              <button class="btn btn-sm btn-outline border-base-300" @click="activeView = 'matching'">
                Review Matches
              </button>
            </div>
          </div>

          <!-- Venue Reconciliation Hero Banner -->
          <div class="card bg-gradient-to-br from-base-200/90 to-base-300/80 border border-base-300 shadow-md p-5">
            <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-base-content/10 pb-4 mb-4">
              <div>
                <div class="flex items-center gap-2">
                  <span class="badge badge-primary font-bold">{{ activeCanonicalLocationMeta.code }}</span>
                  <h3 class="font-black text-xl text-base-content">{{ activeCanonicalLocationMeta.shortName }} Statement — {{ currentCycleInfo.label }}</h3>
                </div>
                <p class="text-xs text-base-content/70 mt-1">
                  Reconciled against {{ activeCanonicalLocationMeta.shortName }} monthly register payout statements and physical checks.
                </p>
              </div>
              <div class="text-left md:text-right">
                <div class="text-xs uppercase font-semibold text-base-content/60 tracking-wider">Net Store Check Payout</div>
                <div class="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  ${{ settlementSummary.memoryDenNetCheck.toFixed(2) }}
                </div>
              </div>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div class="bg-base-100/70 p-3 rounded-xl border border-base-300/50">
                <span class="opacity-60 block">1. Gross Register Sales:</span>
                <span class="font-bold font-mono text-base text-base-content">${{ settlementSummary.totalGross.toFixed(2) }}</span>
              </div>
              <div class="bg-base-100/70 p-3 rounded-xl border border-base-300/50">
                <span class="opacity-60 block">2. Venue Commission ({{ activeCanonicalLocationMeta.feePct }}%):</span>
                <span class="font-mono text-base text-error">-${{ settlementSummary.totalVenueFee.toFixed(2) }}</span>
              </div>
              <div class="bg-base-100/70 p-3 rounded-xl border border-base-300/50">
                <span class="opacity-60 block">3. Space Rental (Rent):</span>
                <span class="font-mono text-base text-warning font-bold">-${{ settlementSummary.boothRent.toFixed(2) }}</span>
              </div>
              <div class="bg-base-100/70 p-3 rounded-xl border border-base-300/50">
                <span class="opacity-60 block">4. Final Check Payout:</span>
                <span class="font-mono text-base text-emerald-600 dark:text-emerald-400 font-bold">${{ settlementSummary.memoryDenNetCheck.toFixed(2) }}</span>
              </div>
            </div>
          </div>

          <!-- Summary Banner & Commons Pool Status -->
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div class="card bg-base-200/60 border border-base-300 shadow-sm p-4">
              <div class="text-xs font-semibold text-base-content/60 uppercase tracking-wider">Gross Sales</div>
              <div class="text-2xl font-black mt-1 text-base-content font-mono">${{ settlementSummary.totalGross.toFixed(2) }}</div>
              <div class="text-xs text-base-content/50 mt-0.5">Venue Cut (15%): -${{ settlementSummary.totalVenueFee.toFixed(2) }}</div>
            </div>

            <div class="card bg-base-200/60 border border-base-300 shadow-sm p-4">
              <div class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Guarantee 1: Cost Return</div>
              <div class="text-2xl font-black mt-1 text-emerald-600 dark:text-emerald-400 font-mono">+${{ settlementSummary.totalCostBasis.toFixed(2) }}</div>
              <div class="text-xs text-base-content/50 mt-0.5">100% Capital Recouped First</div>
            </div>

            <div class="card bg-base-200/60 border border-base-300 shadow-sm p-4">
              <div class="text-xs font-semibold text-primary uppercase tracking-wider">Guarantee 2: Curator Profits</div>
              <div class="text-2xl font-black mt-1 text-primary font-mono">+${{ settlementSummary.totalCuratorPayouts.toFixed(2) }}</div>
              <div class="text-xs text-base-content/50 mt-0.5">Cost + 70% Net Surplus</div>
            </div>

            <div class="card bg-base-200/60 border border-base-300 shadow-sm p-4">
              <div class="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Guarantee 3: Commons Pool</div>
              <div class="text-2xl font-black mt-1 text-amber-600 dark:text-amber-400 font-mono">+${{ settlementSummary.totalCommonsPool.toFixed(2) }}</div>
              <div class="text-xs font-semibold mt-0.5" :class="settlementSummary.isRentCovered ? 'text-emerald-500' : 'text-amber-500'">
                {{ settlementSummary.isRentCovered ? `✅ Rent ($${settlementSummary.boothRent.toFixed(2)}) Covered (+${settlementSummary.commonsSurplusAfterRent.toFixed(2)})` : `Rent shortfall: -$${Math.abs(settlementSummary.commonsSurplusAfterRent).toFixed(2)}` }}
              </div>
            </div>
          </div>

          <!-- Unmatched warning notice -->
          <div v-if="unmatchedCount > 0" class="alert alert-warning py-2 text-xs flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Icon icon="solar:danger-triangle-bold" class="w-4 h-4" />
              <span><strong>Notice:</strong> {{ unmatchedCount }} sold items are currently unmatched. They are excluded from settlement statements until mapped to inventory.</span>
            </div>
            <button class="btn btn-xs btn-outline" @click="activeView = 'matching'">Map Unmatched Items</button>
          </div>

          <!-- Partner Statements Breakdown Cards -->
          <div class="space-y-5">
            <div 
              v-for="partner in partnerSettlements" 
              :key="partner.prefix" 
              class="card bg-base-100 border border-base-300 shadow-md overflow-hidden"
            >
              <!-- Partner Card Header -->
              <div class="bg-base-200/70 p-4 sm:p-5 border-b border-base-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                    {{ partner.prefix.replace(/[-_]$/, '').slice(0, 2) }}
                  </div>
                  <div>
                    <div class="flex items-center gap-2">
                      <h4 class="font-bold text-lg text-base-content">{{ partner.name }}</h4>
                      <span class="badge badge-sm badge-outline font-mono font-bold">{{ partner.prefix }}</span>
                      <span class="badge badge-sm badge-ghost">{{ partner.items.length }} {{ partner.items.length === 1 ? 'item sold' : 'items sold' }}</span>
                      <span v-if="partner.bbSubClient" class="badge badge-sm badge-secondary font-bold">+ B&B Consignment Sub-Client</span>
                    </div>
                    <p class="text-xs text-base-content/60">Governed under Huckleberry Collective 70/30 Net Surplus Settlement</p>
                  </div>
                </div>

                <div class="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                  <div class="text-right">
                    <div class="text-xs text-base-content/60 font-medium">{{ partner.bbSubClient ? 'Combined Final Payout' : 'Final Payout Check' }}</div>
                    <div class="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                      ${{ (partner.masterPayoutCheck !== undefined ? partner.masterPayoutCheck : partner.totalPayoutCheck).toFixed(2) }}
                    </div>
                  </div>
                  <button 
                    class="btn btn-sm btn-primary gap-1.5 shadow-sm"
                    @click="downloadPartnerPdf(partner)"
                  >
                    <Icon icon="solar:document-medicine-bold" class="w-4 h-4" />
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>

              <!-- Partner Financial Summary Bar -->
              <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 p-4 bg-base-200/30 text-xs border-b border-base-200">
                <div>
                  <span class="opacity-60 block">Gross Register:</span>
                  <span class="font-bold font-mono text-sm">${{ (partner.masterGross !== undefined ? partner.masterGross : partner.totalGross).toFixed(2) }}</span>
                </div>
                <div>
                  <span class="opacity-60 block">15% Venue Cut:</span>
                  <span class="font-mono text-sm text-error">-${{ (partner.masterVenueFee !== undefined ? partner.masterVenueFee : partner.totalVenueFee).toFixed(2) }}</span>
                </div>
                <div v-if="partner.isConsignor">
                  <span class="opacity-60 block">Booth Rent Share:</span>
                  <span class="font-mono text-sm text-warning font-bold">-${{ (partner.rentDeduction || 0).toFixed(2) }}</span>
                </div>
                <div v-else>
                  <span class="opacity-60 block">100% Cost Recouped:</span>
                  <span class="font-mono text-sm text-emerald-600 dark:text-emerald-400 font-bold">+${{ (partner.masterCostBasis !== undefined ? partner.masterCostBasis : partner.totalCostBasis).toFixed(2) }}</span>
                </div>
                <div v-if="partner.isConsignor">
                  <span class="opacity-60 block">Net Consignor Payout:</span>
                  <span class="font-mono text-sm text-emerald-600 dark:text-emerald-400 font-bold">${{ partner.totalPayoutCheck.toFixed(2) }}</span>
                </div>
                <div v-else>
                  <span class="opacity-60 block">70% Net Profit Share:</span>
                  <span class="font-mono text-sm text-primary font-bold">+${{ (partner.masterCuratorProfit !== undefined ? partner.masterCuratorProfit : partner.totalCuratorProfit).toFixed(2) }}</span>
                </div>
                <div v-if="!partner.isConsignor">
                  <span class="opacity-60 block">30% Commons Contribution:</span>
                  <span class="font-mono text-sm text-amber-600 dark:text-amber-400 font-bold">+${{ (partner.masterCommonsTake !== undefined ? partner.masterCommonsTake : partner.totalCommonsTake).toFixed(2) }}</span>
                </div>
                <div v-else>
                  <span class="opacity-60 block">Relationship:</span>
                  <span class="badge badge-sm badge-secondary font-bold">Consignor</span>
                </div>
              </div>

              <!-- Itemized Table for Partner Core Items -->
              <div class="overflow-x-auto rounded-lg border border-base-200 bg-base-100">
                <table class="table table-xs">
                  <thead>
                    <tr class="bg-base-200/50">
                      <th>Date</th>
                      <th>SKU / UPC</th>
                      <th>Description</th>
                      <th class="text-right">Gross</th>
                      <th class="text-right">Venue Fee</th>
                      <th class="text-right">Cost Recoup</th>
                      <th class="text-right">Net Surplus</th>
                      <th class="text-right font-bold">Curator Take (70%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(it, iIdx) in partner.items" :key="iIdx" class="hover:bg-base-200/40">
                      <td class="font-mono text-xs">{{ it.date }}</td>
                      <td class="font-mono text-xs font-semibold">{{ it.sku }}</td>
                      <td class="max-w-xs truncate font-medium">{{ it.title }}</td>
                      <td class="text-right font-mono">${{ it.grossPrice.toFixed(2) }}</td>
                      <td class="text-right font-mono text-error">-${{ it.venueFee.toFixed(2) }}</td>
                      <td class="text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold">+${{ it.costBasis.toFixed(2) }}</td>
                      <td class="text-right font-mono opacity-80">${{ it.netSurplus.toFixed(2) }}</td>
                      <td class="text-right font-mono font-bold text-base-content">${{ it.curatorTake.toFixed(2) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- B&B Consignment Sub-Client Section under PDXGL -->
              <div v-if="partner.bbSubClient && partner.bbSubClient.items.length > 0" class="border-t-2 border-secondary/30 bg-secondary/5 p-4">
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
                  <div class="flex items-center gap-2">
                    <span class="badge badge-secondary font-bold font-mono">BB-</span>
                    <h5 class="font-bold text-sm text-base-content">B&B Consignment (PDXGL Sub-Client)</h5>
                    <span class="badge badge-sm badge-ghost">{{ partner.bbSubClient.items.length }} sold items</span>
                  </div>
                  <div class="flex items-center gap-3">
                    <div class="text-xs font-mono font-bold text-secondary">
                      Sub-Client Total Payout: ${{ partner.bbSubClient.totalPayoutCheck.toFixed(2) }}
                    </div>
                    <button 
                      class="btn btn-xs btn-outline btn-secondary gap-1"
                      @click="downloadPartnerPdf(partner.bbSubClient)"
                    >
                      <Icon icon="solar:document-bold" class="w-3.5 h-3.5" />
                      Download B&B Slip (PDF)
                    </button>
                  </div>
                </div>

                <!-- B&B Financial Summary -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 bg-base-100/80 rounded-lg text-xs border border-secondary/20 mb-3">
                  <div>
                    <span class="opacity-60 block">B&B Gross Sales:</span>
                    <span class="font-bold font-mono text-sm">${{ partner.bbSubClient.totalGross.toFixed(2) }}</span>
                  </div>
                  <div>
                    <span class="opacity-60 block">Mall 15% Fee:</span>
                    <span class="font-mono text-sm text-error">-${{ partner.bbSubClient.totalVenueFee.toFixed(2) }}</span>
                  </div>
                  <div>
                    <span class="opacity-60 block">B&B Net Payout (85%):</span>
                    <span class="font-mono text-sm text-emerald-600 dark:text-emerald-400 font-bold">${{ partner.bbSubClient.totalPayoutCheck.toFixed(2) }}</span>
                  </div>
                  <div>
                    <span class="opacity-60 block">Parent Partner:</span>
                    <span class="font-bold text-xs text-base-content">PDX Game Library</span>
                  </div>
                </div>

                <!-- B&B Itemized Table -->
                <div class="overflow-x-auto rounded-lg border border-base-200 bg-base-100">
                  <table class="table table-xs">
                    <thead>
                      <tr class="bg-base-200/60 text-secondary">
                        <th>Date</th>
                        <th>UPC / Tag</th>
                        <th>Item Description</th>
                        <th class="text-right">Gross Price</th>
                        <th class="text-right">Mall Fee (15%)</th>
                        <th class="text-right font-bold">Consignor Net (85%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(it, bIdx) in partner.bbSubClient.items" :key="bIdx" class="hover:bg-secondary/10">
                        <td class="font-mono text-xs">{{ it.date }}</td>
                        <td class="font-mono text-xs font-semibold">{{ it.sku }}</td>
                        <td class="max-w-xs truncate font-medium">{{ it.title }}</td>
                        <td class="text-right font-mono">${{ it.grossPrice.toFixed(2) }}</td>
                        <td class="text-right font-mono text-error">-${{ it.venueFee.toFixed(2) }}</td>
                        <td class="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">${{ it.curatorTake.toFixed(2) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Canonical Bottom Command Dock -->
    <BottomActionDock v-if="parsedRows.length > 0" placement="viewport">
      <template #left>
        <div class="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span class="badge badge-primary font-bold font-mono text-xs">{{ currentCycleInfo.label }}</span>
          <div class="text-xs font-mono font-bold flex items-center gap-1.5">
            <span>Matched: <strong class="text-success">{{ matchedCount }}</strong> / {{ cycleFilteredRows.length }}</span>
            <span v-if="unmatchedCount > 0" class="badge badge-xs badge-warning font-bold">
              {{ unmatchedCount }} unmatched
            </span>
          </div>
          <div class="text-xs font-mono font-bold text-base-content/80 hidden sm:inline">
            Net Check: <span class="font-black text-sm" :class="selectedCycleFinancials.netCheck >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-error'">
              {{ selectedCycleFinancials.netCheck >= 0 ? `+$${selectedCycleFinancials.netCheck.toFixed(2)}` : `-$${Math.abs(selectedCycleFinancials.netCheck).toFixed(2)}` }}
            </span>
          </div>
        </div>
      </template>

      <template #center>
        <div class="join bg-base-200/90 p-0.5 rounded-xl border border-base-300 shadow-inner">
          <button 
            class="btn btn-xs join-item" 
            :class="filterTab === 'all' ? 'btn-active btn-primary font-bold' : 'btn-ghost'"
            @click="filterTab = 'all'"
          >
            All ({{ cycleFilteredRows.length }})
          </button>
          <button 
            class="btn btn-xs join-item text-success" 
            :class="filterTab === 'matched' ? 'btn-active btn-success text-white font-bold' : 'btn-ghost'"
            @click="filterTab = 'matched'"
          >
            Matched ({{ matchedCount }})
          </button>
          <button 
            class="btn btn-xs join-item text-error" 
            :class="filterTab === 'unmatched' ? 'btn-active btn-error text-white font-bold' : 'btn-ghost'"
            @click="filterTab = 'unmatched'"
          >
            Unmatched ({{ unmatchedCount }})
          </button>
        </div>
      </template>

      <template #right>
        <button 
          v-if="unmatchedCount > 0"
          class="btn btn-sm btn-secondary font-bold gap-1.5 shadow-sm"
          :disabled="isAutoCreatingAll"
          @click="autoCreateAllUnmatched"
          title="Auto-create all remaining unmatched rows with sequential barcodes and status=sold"
        >
          <span v-if="isAutoCreatingAll" class="loading loading-spinner loading-xs"></span>
          <Icon v-else icon="solar:magic-stick-3-bold" class="w-4 h-4" />
          <span class="hidden sm:inline">Auto-Create {{ unmatchedCount }} Unmatched</span>
          <span class="sm:hidden">Auto-Create ({{ unmatchedCount }})</span>
        </button>

        <button 
          v-if="activeView === 'matching'"
          class="btn btn-sm btn-primary font-bold shadow-md shadow-primary/20 gap-1.5" 
          :disabled="matchedCount === 0 || isImporting" 
          @click="executeImport"
        >
          <Icon icon="solar:cloud-upload-bold" class="w-4 h-4" />
          <span>Commit {{ matchedCount }} Matched</span>
        </button>

        <button
          v-else-if="activeView === 'settlement' && partnerSettlements.length > 0"
          class="btn btn-sm btn-success text-white font-bold shadow-md shadow-success/20 gap-1.5"
          @click="exportAllPartnerPdfs"
        >
          <Icon icon="solar:file-download-bold" class="w-4 h-4" />
          <span>Download All Statements (PDF)</span>
        </button>
      </template>
    </BottomActionDock>

    <!-- SLIDE-OVER ITEM MATCHER DRAWER -->
    <Teleport to="body">
      <div v-if="isMatcherDrawerOpen" class="fixed inset-0 z-[9990] overflow-hidden">
        <!-- Backdrop Scrim -->
        <div 
          class="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
          @click="closeMatcherDrawer"
        ></div>

        <!-- Slide-Over Panel Container -->
        <div class="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
          <div class="w-screen max-w-md sm:max-w-xl bg-base-100 shadow-2xl flex flex-col border-l border-base-300 transform transition-transform duration-300">
            
            <!-- Sticky Drawer Header -->
            <div class="p-4 sm:p-5 border-b border-base-200 bg-base-200/50 flex items-center justify-between gap-3 shrink-0">
              <div class="flex items-center gap-2">
                <span class="badge badge-neutral font-mono font-bold text-xs">
                  Row {{ activeDrawerRowIndex + 1 }} / {{ displayedRows.length }}
                </span>
                <span v-if="activeDrawerRow?.mappedItem" class="badge badge-success text-white font-bold gap-1 text-xs">
                  <Icon icon="solar:check-circle-bold" class="w-3.5 h-3.5" /> Matched
                </span>
                <span v-else class="badge badge-warning font-bold gap-1 text-xs">
                  <Icon icon="solar:danger-circle-bold" class="w-3.5 h-3.5" /> Needs Match
                </span>
              </div>

              <!-- Step navigation & close -->
              <div class="flex items-center gap-1.5">
                <button 
                  type="button"
                  class="btn btn-xs btn-circle btn-ghost" 
                  :disabled="activeDrawerRowIndex <= 0" 
                  @click="goToPreviousDrawerRow"
                  title="Previous Row"
                >
                  <Icon icon="solar:arrow-left-linear" class="w-4 h-4" />
                </button>
                <button 
                  type="button"
                  class="btn btn-xs btn-circle btn-ghost" 
                  :disabled="activeDrawerRowIndex >= displayedRows.length - 1" 
                  @click="goToNextDrawerRow"
                  title="Next Row"
                >
                  <Icon icon="solar:arrow-right-linear" class="w-4 h-4" />
                </button>
                <div class="divider divider-horizontal my-1 mx-0.5"></div>
                <button 
                  type="button"
                  class="btn btn-xs btn-circle btn-ghost" 
                  @click="closeMatcherDrawer"
                  title="Close Drawer"
                >
                  ✕
                </button>
              </div>
            </div>

            <!-- Scrollable Drawer Body -->
            <div v-if="activeDrawerRow" class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              <!-- POS Transaction Card -->
              <div class="card bg-base-200/60 border border-base-300 p-4 rounded-2xl space-y-3">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <span class="text-[11px] font-bold uppercase tracking-wider text-base-content/60">POS Transaction</span>
                    <h4 class="font-bold text-base text-base-content">{{ activeDrawerRow.itemName }}</h4>
                  </div>
                  <span v-if="activeDrawerRow.ticketNumber" class="badge badge-info font-mono font-bold text-xs shrink-0">
                    🎟️ Ticket #{{ activeDrawerRow.ticketNumber }}
                  </span>
                </div>

                <div class="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
                  <div class="p-2 bg-base-100 rounded-xl border border-base-300/50">
                    <span class="text-[10px] opacity-60 block uppercase font-sans">Gross Sold</span>
                    <span class="font-bold text-sm text-base-content">${{ (activeDrawerRow.listedPrice || activeDrawerRow.salePrice || 0).toFixed(2) }}</span>
                  </div>
                  <div class="p-2 bg-base-100 rounded-xl border border-base-300/50">
                    <span class="text-[10px] opacity-60 block uppercase font-sans">Mall Fee (15%)</span>
                    <span class="font-semibold text-sm text-error">-${{ Math.max(0, (activeDrawerRow.listedPrice || activeDrawerRow.salePrice || 0) - activeDrawerRow.salePrice).toFixed(2) }}</span>
                  </div>
                  <div class="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/30">
                    <span class="text-[10px] text-emerald-700 dark:text-emerald-400 block uppercase font-sans font-bold">Net Deposit</span>
                    <span class="font-bold text-sm text-emerald-600 dark:text-emerald-400">+${{ activeDrawerRow.salePrice.toFixed(2) }}</span>
                  </div>
                </div>

                <div class="flex items-center gap-2 text-xs text-base-content/70 flex-wrap">
                  <span v-if="activeDrawerRow.date">📅 Sold Date: <strong class="font-mono text-base-content">{{ activeDrawerRow.date }}</strong></span>
                  <span v-if="activeDrawerRow.extractedSku">🏷️ Register Tag: <strong class="font-mono text-base-content">{{ activeDrawerRow.extractedSku }}</strong></span>
                </div>
              </div>

              <!-- If Already Mapped Section -->
              <div v-if="activeDrawerRow.mappedItem" class="alert alert-success/15 border border-success/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-success text-success-content flex items-center justify-center font-bold shrink-0">
                    <Icon icon="solar:check-circle-bold" class="w-6 h-6" />
                  </div>
                  <div>
                    <span class="text-xs font-bold text-success uppercase tracking-wider block">Currently Linked Item</span>
                    <div class="font-bold text-sm text-base-content flex items-center gap-1.5 flex-wrap">
                      <span class="badge badge-sm badge-outline font-mono font-bold">{{ activeDrawerRow.mappedItem.upc || 'NO UPC' }}</span>
                      <span>{{ activeDrawerRow.mappedItem.title }}</span>
                    </div>
                    <div class="text-xs opacity-75 font-mono mt-0.5">
                      Cost Basis: ${{ getItemCost(activeDrawerRow.mappedItem).toFixed(2) }} • Location: {{ activeDrawerRow.mappedItem.storageLocation || 'MD' }}
                    </div>
                  </div>
                </div>
                <button type="button" class="btn btn-xs btn-error btn-outline shrink-0 gap-1" @click="unlinkActiveRow">
                  <Icon icon="solar:link-broken-bold" class="w-3.5 h-3.5" />
                  <span>Unlink</span>
                </button>
              </div>

              <!-- Drawer Mode Tabs -->
              <div class="tabs tabs-boxed bg-base-200 p-1 rounded-xl">
                <a 
                  class="tab text-xs font-bold flex-1" 
                  :class="{'tab-active !bg-primary !text-primary-content': drawerSubTab === 'search'}" 
                  @click="drawerSubTab = 'search'"
                >
                  <Icon icon="solar:magnifer-linear" class="w-4 h-4 mr-1.5 inline" />
                  <span>🎯 Suggested &amp; Search ({{ filteredCandidateResults.length }})</span>
                </a>
                <a 
                  class="tab text-xs font-bold flex-1" 
                  :class="{'tab-active !bg-primary !text-primary-content': drawerSubTab === 'create'}" 
                  @click="drawerSubTab = 'create'"
                >
                  <Icon icon="solar:add-circle-bold" class="w-4 h-4 mr-1.5 inline" />
                  <span>+ Create As Sold Item</span>
                </a>
              </div>

              <!-- TAB 1: QUICK CREATE AS SOLD ITEM -->
              <div v-show="drawerSubTab === 'create'" class="card bg-base-100 border border-base-300 p-4 rounded-2xl space-y-4 shadow-xs">
                <h5 class="font-bold text-sm text-base-content flex items-center gap-2">
                  <Icon icon="solar:box-minimalistic-bold" class="w-4 h-4 text-primary" />
                  <span>Catalog New Sold Item</span>
                </h5>

                <!-- Title -->
                <div class="form-control">
                  <label class="label py-1"><span class="label-text text-xs font-bold">Item Title / Description</span></label>
                  <input 
                    type="text" 
                    v-model="drawerForm.title" 
                    class="input input-sm input-bordered w-full font-medium text-xs rounded-xl" 
                    placeholder="Clean Title..."
                  />
                </div>

                <!-- Partner Prefix Selector -->
                <div class="form-control">
                  <label class="label py-1"><span class="label-text text-xs font-bold">Partner Org / Barcode Authority</span></label>
                  <div class="grid grid-cols-3 gap-2">
                    <button 
                      type="button" 
                      class="btn btn-sm rounded-xl font-bold flex flex-col h-auto py-2 px-1 text-xs"
                      :class="drawerForm.prefix === 'HUCK' ? 'btn-primary' : 'btn-outline border-base-300'"
                      @click="drawerForm.prefix = 'HUCK'"
                    >
                      <span class="font-mono text-sm font-black">HUCK-</span>
                      <span class="text-[10px] opacity-80 font-normal">Huckleberry</span>
                    </button>
                    <button 
                      type="button" 
                      class="btn btn-sm rounded-xl font-bold flex flex-col h-auto py-2 px-1 text-xs"
                      :class="drawerForm.prefix === 'PDXGL' ? 'btn-primary' : 'btn-outline border-base-300'"
                      @click="drawerForm.prefix = 'PDXGL'"
                    >
                      <span class="font-mono text-sm font-black">PDXGL-</span>
                      <span class="text-[10px] opacity-80 font-normal">PDX Game Lib</span>
                    </button>
                    <button 
                      type="button" 
                      class="btn btn-sm rounded-xl font-bold flex flex-col h-auto py-2 px-1 text-xs"
                      :class="drawerForm.prefix === 'BB' ? 'btn-secondary' : 'btn-outline border-base-300'"
                      @click="drawerForm.prefix = 'BB'"
                    >
                      <span class="font-mono text-sm font-black">BB-</span>
                      <span class="text-[10px] opacity-80 font-normal">B&B Consign</span>
                    </button>
                  </div>
                </div>

                <!-- Cost Basis (Zero-Cost Rule reminder) & Prices -->
                <div class="grid grid-cols-2 gap-3">
                  <div class="form-control">
                    <label class="label py-1">
                      <span class="label-text text-xs font-bold flex items-center gap-1">
                        <span>Landed Cost ($)</span>
                        <span class="badge badge-xs badge-ghost">Default $0</span>
                      </span>
                    </label>
                    <div class="relative">
                      <span class="absolute left-3 top-2 text-xs opacity-50 font-mono">$</span>
                      <input 
                        type="number" 
                        step="0.01" 
                        min="0"
                        v-model.number="drawerForm.cost" 
                        class="input input-sm input-bordered w-full pl-6 font-mono text-xs rounded-xl" 
                        placeholder="0.00"
                      />
                    </div>
                    <span class="text-[10px] opacity-60 mt-0.5">Leave 0 if unreceipted (Zero-Cost Rule)</span>
                  </div>

                  <div class="form-control">
                    <label class="label py-1"><span class="label-text text-xs font-bold">Register Net Price ($)</span></label>
                    <div class="relative">
                      <span class="absolute left-3 top-2 text-xs opacity-50 font-mono">$</span>
                      <input 
                        type="number" 
                        step="0.01" 
                        v-model.number="drawerForm.soldPrice" 
                        class="input input-sm input-bordered w-full pl-6 font-mono text-xs rounded-xl bg-base-200/50" 
                        readonly
                      />
                    </div>
                    <span class="text-[10px] opacity-60 mt-0.5">Locked to POS transaction</span>
                  </div>
                </div>

                <!-- Multi-Quantity SKU Toggle (Batch Stock) -->
                <div class="form-control bg-base-200/50 p-3 rounded-xl border border-base-300">
                  <label class="label cursor-pointer p-0">
                    <div class="flex items-center gap-2">
                      <Icon icon="solar:box-minimalistic-bold" class="w-5 h-5 text-info shrink-0" />
                      <div>
                        <span class="label-text text-xs font-bold block">Multi-Quantity SKU (Batch Stock)</span>
                        <span class="text-[10px] opacity-70 block">
                          Enable for batch stock (book packs, felt hats, stickers) that can sell multiple times across tickets without duplicate errors.
                        </span>
                      </div>
                    </div>
                    <input 
                      type="checkbox" 
                      v-model="drawerForm.isMultiQty" 
                      class="toggle toggle-info toggle-sm ml-2" 
                    />
                  </label>
                </div>

                <!-- Actions -->
                <div class="pt-2 flex items-center gap-2">
                  <button 
                    type="button"
                    class="btn btn-sm btn-primary flex-1 font-bold rounded-xl gap-1.5"
                    :disabled="isDrawerSaving"
                    @click="saveAndLinkNewItem(false)"
                  >
                    <span v-if="isDrawerSaving" class="loading loading-spinner loading-xs"></span>
                    <Icon v-else icon="solar:check-circle-bold" class="w-4 h-4" />
                    <span>Save &amp; Mark Sold</span>
                  </button>
                  <button 
                    type="button"
                    class="btn btn-sm btn-secondary flex-1 font-bold rounded-xl gap-1.5"
                    :disabled="isDrawerSaving"
                    @click="saveAndLinkNewItem(true)"
                    title="Save and advance directly to next row"
                  >
                    <span>Save &amp; Next</span>
                    <Icon icon="solar:arrow-right-bold" class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <!-- TAB 2: SEARCH CATALOG (Rich Visual Candidate Cards + Strict 0EJ Exclusion) -->
              <div v-show="drawerSubTab === 'search'" class="card bg-base-100 border border-base-300 p-4 rounded-2xl space-y-3 shadow-xs">
                <div class="flex items-center justify-between gap-2 flex-wrap">
                  <h5 class="font-bold text-sm text-base-content flex items-center gap-1.5">
                    <Icon icon="solar:magnifer-linear" class="w-4 h-4 text-primary" />
                    <span>Unclaimed Inventory Candidates</span>
                  </h5>
                  <span class="text-[11px] opacity-65">
                    🛡️ Ruling out other <code>0EJ</code> SKUs &amp; cross-org items
                  </span>
                </div>

                <div class="relative">
                  <Icon icon="solar:magnifer-linear" class="absolute left-3 top-2.5 w-4 h-4 opacity-50" />
                  <input 
                    type="text" 
                    v-model="drawerSearchQuery" 
                    class="input input-sm input-bordered w-full pl-9 text-xs rounded-xl" 
                    placeholder="Multi-word search by title, noun, brand, UPC, or price (e.g. 'wand', 'vampire', 'tweed')..."
                  />
                  <button 
                    v-if="drawerSearchQuery" 
                    type="button"
                    class="btn btn-xs btn-ghost btn-circle absolute right-2 top-1.5" 
                    @click="drawerSearchQuery = ''"
                  >
                    ✕
                  </button>
                </div>

                <div class="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    class="btn btn-xs rounded-lg font-bold"
                    :class="drawerFilterMode === 'suggested' && !drawerSearchQuery ? 'btn-primary text-primary-content' : 'btn-ghost border border-base-300'"
                    @click="drawerSearchQuery = ''; drawerFilterMode = 'suggested'"
                  >
                    🎯 Top Suggested
                  </button>
                  <button
                    type="button"
                    class="btn btn-xs rounded-lg font-bold"
                    :class="drawerFilterMode === 'same_price' ? 'btn-primary text-primary-content' : 'btn-ghost border border-base-300'"
                    @click="drawerFilterMode = 'same_price'"
                  >
                    💲 Close Price (~${{ Number(activeDrawerRow.listedPrice || activeDrawerRow.salePrice || 0).toFixed(0) }})
                  </button>
                  <button
                    type="button"
                    class="btn btn-xs rounded-lg font-bold"
                    :class="drawerFilterMode === 'all' ? 'btn-primary text-primary-content' : 'btn-ghost border border-base-300'"
                    @click="drawerFilterMode = 'all'"
                  >
                    📋 All Unclaimed
                  </button>
                </div>

                <div class="max-h-96 overflow-y-auto space-y-2.5 pr-1">
                  <div 
                    v-for="cand in filteredCandidateResults" 
                    :key="cand.item.$id"
                    class="p-3 rounded-xl border border-base-300 hover:border-primary/50 hover:bg-base-200/40 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                  >
                    <div class="flex items-start gap-2.5 min-w-0 flex-1">
                      <!-- Photo Thumbnail -->
                      <div class="w-12 h-12 rounded-xl bg-base-200 border border-base-300 overflow-hidden shrink-0 flex items-center justify-center">
                        <img
                          v-if="getItemThumbUrl(cand.item)"
                          :src="getItemThumbUrl(cand.item)"
                          :alt="cand.item.title"
                          class="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <Icon v-else icon="solar:gallery-minimalistic-linear" class="w-5 h-5 opacity-35" />
                      </div>

                      <div class="min-w-0 flex-1 space-y-1">
                        <div class="flex items-center gap-1.5 flex-wrap">
                          <span class="badge badge-xs font-mono font-black" :class="cand.item.upc ? 'badge-primary text-primary-content' : 'badge-ghost'">
                            {{ cand.item.upc || 'NO UPC' }}
                          </span>
                          <span class="badge badge-xs badge-outline font-mono font-bold">
                            {{ cand.item.status || 'received' }} @ {{ cand.item.storageLocation || 'HG' }}
                          </span>
                          <span v-if="cand.isExactPrice" class="badge badge-xs badge-success text-success-content font-black">
                            ✓ Exact ${{ Number(cand.item.resalePrice || 0).toFixed(2) }}
                          </span>
                          <span v-else class="badge badge-xs badge-ghost font-mono">
                            DB: ${{ Number(cand.item.resalePrice || 0).toFixed(2) }} • Cost: ${{ getItemCost(cand.item).toFixed(2) }}
                          </span>
                        </div>

                        <!-- Full Untruncated Title -->
                        <div class="font-bold text-sm leading-snug text-base-content break-words whitespace-normal">
                          {{ cand.item.title }}
                        </div>

                        <div v-if="cand.reasons && cand.reasons.length > 0" class="flex items-center gap-1 flex-wrap">
                          <span
                            v-for="(reason, rIdx) in cand.reasons"
                            :key="rIdx"
                            class="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold"
                          >
                            {{ reason }}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button 
                      type="button"
                      class="btn btn-xs sm:btn-sm btn-primary text-primary-content font-black shrink-0 gap-1 rounded-lg w-full sm:w-auto"
                      :disabled="isSavingDrawerLink === cand.item.$id"
                      @click="linkAndSaveItemToActiveRow(cand.item)"
                    >
                      <span v-if="isSavingDrawerLink === cand.item.$id" class="loading loading-spinner loading-xs"></span>
                      <span v-else>🔗 Link &amp; Save to MD</span>
                    </button>
                  </div>

                  <div v-if="filteredCandidateResults.length === 0" class="text-center py-6 text-xs text-base-content/60 space-y-2">
                    <div>No unclaimed candidate items matched.</div>
                    <div class="flex justify-center gap-2">
                      <button type="button" class="btn btn-xs btn-outline" @click="drawerFilterMode = 'all'">
                        📋 Browse All Unclaimed
                      </button>
                      <button type="button" class="btn btn-xs btn-primary font-bold" @click="drawerSubTab = 'create'">
                        + Create As Sold Item
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Sticky Drawer Footer -->
            <div class="p-4 border-t border-base-200 bg-base-200/30 flex items-center justify-between shrink-0">
              <div class="text-xs font-mono opacity-70">
                <span>{{ matchedCount }} of {{ cycleFilteredRows.length }} matched in cycle</span>
              </div>
              <button type="button" class="btn btn-sm btn-ghost border border-base-300 rounded-xl" @click="closeMatcherDrawer">
                Done / Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Past Reconciliations Modal -->
    <Teleport to="body">
      <div v-if="isHistoryModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div class="card bg-base-100 border border-base-200 shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden">
          <div class="p-4 sm:p-5 border-b border-base-200 flex items-center justify-between bg-base-200/50 shrink-0">
            <div class="flex items-center gap-2">
              <Icon icon="solar:history-bold" class="w-6 h-6 text-primary" />
              <div>
                <h3 class="font-bold text-lg">Reconciliation History &amp; Settlement Archive</h3>
                <p class="text-xs text-base-content/70">Committed monthly settlements with partner payout statements.</p>
              </div>
            </div>
            <button class="btn btn-sm btn-ghost btn-circle" @click="isHistoryModalOpen = false">✕</button>
          </div>

          <div class="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
            <div v-if="reconciliationHistory.length === 0" class="text-center py-12 text-sm text-base-content/60">
              <Icon icon="solar:document-text-linear" class="w-12 h-12 mx-auto mb-2 opacity-40" />
              <p>No reconciliation receipts saved yet.</p>
              <p class="text-xs mt-1">Once you commit a monthly payout, the financial breakdown and PDF statements will be stored here permanently.</p>
            </div>

            <div v-else class="space-y-3">
              <div 
                v-for="(hist, idx) in reconciliationHistory" 
                :key="idx" 
                class="card bg-base-100 border border-base-300 p-4 rounded-xl shadow-xs hover:border-primary/50 transition-colors"
              >
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="badge badge-primary font-bold font-mono">{{ hist.cycleLabel }}</span>
                      <span class="badge badge-neutral text-xs">{{ hist.itemCount }} sales committed</span>
                      <span class="text-xs text-base-content/60">{{ hist.timestamp }}</span>
                    </div>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                      <div>
                        <div class="text-base-content/60 font-semibold uppercase text-[10px]">Gross Sales</div>
                        <div class="font-bold font-mono text-sm">${{ (hist.gross || 0).toFixed(2) }}</div>
                      </div>
                      <div>
                        <div class="text-base-content/60 font-semibold uppercase text-[10px]">Mall Fee</div>
                        <div class="font-bold font-mono text-sm text-error">-${{ (hist.mallFee || 0).toFixed(2) }}</div>
                      </div>
                      <div>
                        <div class="text-base-content/60 font-semibold uppercase text-[10px]">Rent Paid</div>
                        <div class="font-bold font-mono text-sm text-warning">-${{ (hist.rent || 0).toFixed(2) }}</div>
                      </div>
                      <div>
                        <div class="text-base-content/60 font-semibold uppercase text-[10px]">Net Payout Check</div>
                        <div class="font-bold font-mono text-sm text-emerald-600 dark:text-emerald-400">
                          +${{ (hist.netCheck || 0).toFixed(2) }}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-2 shrink-0">
                    <button 
                      class="btn btn-sm btn-outline gap-1.5"
                      @click="viewHistoricReceipt(hist)"
                    >
                      <Icon icon="solar:eye-bold" class="w-4 h-4" />
                      <span>View Receipt</span>
                    </button>
                    <button 
                      v-if="hist.partnerSettlements && hist.partnerSettlements.length > 0"
                      class="btn btn-sm btn-primary gap-1.5"
                      @click="downloadHistoricPartnerPdfs(hist)"
                    >
                      <Icon icon="solar:file-download-bold" class="w-4 h-4" />
                      <span>PDFs</span>
                    </button>
                    <button 
                      class="btn btn-sm btn-ghost text-error btn-square"
                      title="Delete receipt record"
                      @click="deleteHistoricReceipt(idx)"
                    >
                      <Icon icon="solar:trash-bin-trash-bold" class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="p-4 border-t border-base-200 bg-base-200/30 flex justify-end shrink-0">
            <button class="btn btn-sm btn-ghost border border-base-300 rounded-xl" @click="isHistoryModalOpen = false">
              Close
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useInventory } from '../../composables/useInventory';
import { useAuth } from '../../composables/useAuth';
import { useLoader } from '../../composables/useLoader';
import { databases, ID } from '../../lib/appwrite';
import { addToast } from '../../stores/toast';
import { getCollectionId, DB_ID, normalizeOrgPrefix, getAssetUrl, updateInventoryItem } from '../../lib/inventory';
import { salesApi } from '../../lib/sales';
import {
  stripBom,
  normalizeCsvHeader,
  isSaleNumberHeader,
  isSoldDateHeader,
  flagAlreadyRecordedRows,
  isPayoutSummaryRow,
  splitTrailingBoothSku,
  canonicalTicketNumber,
  toSaleIso,
  isProductCatalogHeaders,
  parseCsvRfc4180Rows,
  MD_CANONICAL_WAREHOUSE_ID,
  PREVERIFIED_MD_MULTI_QTY_BINS,
  PREVERIFIED_MD_SKU_TO_UPC_OR_ID,
  cleanCatalogSku,
  isBbConsignorRow,
  isBbConsignorDbItem,
  resolveMdUnitCostBasis,
  resolveMemoryDenSkuFromPayoutRow,
  buildLockedMultiBinMap,
  matchMemoryDenInventoryItem,
  getUnclaimedMatchCandidatesForRow,
  getPrimaryItemImageId,
  calendarMonthKeyFromDateString,
  monthKeyToLabel,
} from '../../lib/salesBucketing';
import {
  warehousesApi,
  resolveCanonicalLocationCode,
  getLocationSettingMeta,
  getAllLocationSettingMetas,
  matchesLocationFilter,
} from '../../lib/warehouses';
import { generatePartnerSettlementPdf } from '../../lib/coopSettlementPdf';
import BottomActionDock from '../common/BottomActionDock.vue';
import BookmarkletHeroBar from '../bml/BookmarkletHeroBar.vue';
import RicochetLiveSalesPanel from './RicochetLiveSalesPanel.vue';
import SalesImportTray from './SalesImportTray.vue';
import { useRicochetSalesSync } from '../../composables/useRicochetSalesSync';
import { generateNextUpc } from '../../lib/upcAuthority';

const props = defineProps<{
  initialLocation?: string;
}>();

const { user, currentTeam: team } = useAuth();
const { inventoryItems, fetchInventory } = useInventory();
const { showLoader, updateLoader, hideLoader } = useLoader();
const isProcessing = ref(false);
const isImportTrayOpen = ref(false);
const isImporting = ref(false);
const platform = ref('memoryden');
const locations = ref<any[]>([]);

const activeLocationCode = ref<string>(
  props.initialLocation ? (resolveCanonicalLocationCode(props.initialLocation) || 'MD') : 'MD'
);
const isLocationLocked = ref<boolean>(Boolean(props.initialLocation));

const locationCards = computed(() => {
  return getAllLocationSettingMetas(locations.value);
});

const activeCanonicalLocationMeta = computed(() => {
  return getLocationSettingMeta(activeLocationCode.value, locations.value);
});

const salesIntakeTab = ref<'paper_sheet' | 'pos_csv'>(
  activeCanonicalLocationMeta.value.salesIntakeMode ||
    (activeCanonicalLocationMeta.value.supportsPaperSalesSheet ? 'paper_sheet' : 'pos_csv')
);
const isParsingSheetPhoto = ref(false);
const sheetPhotoPreviewUrl = ref('');
const lastParsedSheetTitle = ref('');
const boothPickListSearch = ref('');

const activeTeamId = computed(() => {
  return team.value?.$id || (typeof window !== 'undefined' ? localStorage.getItem('activeTeamId') : '') || '';
});

let handleRicochetCsvFallback: (rawCsv: string) => void = () => {};

// Ricochet Live Sales & Payout Sync State (modularized into useRicochetSalesSync)
const {
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
  ricochetCommitProgress,
  ricochetManifestStatus,
  ricochetManifestCommittedCount,
  ricochetManifestCommittedAt,
  fetchStagedRicochetSales,
  applyPastedRicochetSyncPayload,
  simulateStagedRicochetSales,
  commitStagedRicochetSales,
} = useRicochetSalesSync({
  activeCanonicalLocationMeta,
  inventoryItems,
  addToast,
  onCsvFallbackPaste: (rawCsv: string) => handleRicochetCsvFallback(rawCsv),
  getTenantId: () => activeTeamId.value,
  onAfterLiveCommit: () => {
    if (activeTeamId.value) {
      fetchInventory(activeTeamId.value);
    }
  },
});

const normalizeSalesLocationUrlParam = (code: string) => {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  try {
    const targetPath = `/sales/import/${encodeURIComponent(code)}`;
    if (window.location.pathname !== targetPath || window.location.search) {
      window.history.replaceState({}, '', targetPath);
    }
  } catch {}
};

const selectAndLockSalesLocation = (code: string) => {
  const resolved = resolveCanonicalLocationCode(code, locations.value) || 'MD';
  activeLocationCode.value = resolved;
  isLocationLocked.value = true;
  normalizeSalesLocationUrlParam(resolved);
  const meta = getLocationSettingMeta(resolved, locations.value);
  salesIntakeTab.value = meta.salesIntakeMode || (meta.supportsPaperSalesSheet ? 'paper_sheet' : 'pos_csv');
};
const activeView = ref('matching'); // 'matching' | 'settlement'
const filterTab = ref('all'); // 'all' | 'matched' | 'unmatched'
const parsedRows = ref<any[]>([]);
const catalogFileDetected = ref(false);
const lastCommittedReceipt = ref<any | null>(null);
const reconciliationHistory = ref<any[]>([]);
const isHistoryModalOpen = ref(false);
const hasRestoredSession = ref(false);
const activeFileName = ref<string>('');
const detectedRentMap = ref<Record<string, number>>({});

// Month-to-Month Payout Cycle State
interface PayoutCycle {
  id: string; // '2026-09'
  label: string; // 'Sep 2026'
  paidDate: string; // '10-07-2026'
  gross: number;
  netStore: number;
  itemCount: number;
  spaceRental: number;
  expectedCheck: number;
}

const payoutCycles = ref<PayoutCycle[]>([]);
const selectedCycle = ref<string>('ALL');
const isAutoCreatingAll = ref(false);

const LEGACY_UNSCOPED_STAGING_KEY = 'rc_sales_importer_staging_' + 'v1';
const getScopedStagingStorageKey = (locCode?: string) => {
  const code = resolveCanonicalLocationCode(locCode || activeLocationCode.value, locations.value) || 'MD';
  return `rc_sales_importer_staging_v2_${code}`;
};
const RECEIPTS_STORAGE_KEY = 'rc_sales_reconciliation_history_v1';

const saveStagingSession = () => {
  if (typeof window === 'undefined') return;
  try {
    const locMeta = activeCanonicalLocationMeta.value;
    const locCode = locMeta.code;
    const scopedKey = getScopedStagingStorageKey(locCode);
    localStorage.removeItem(LEGACY_UNSCOPED_STAGING_KEY);
    if (parsedRows.value.length === 0) {
      localStorage.removeItem(scopedKey);
      return;
    }
    const sessionData = {
      tenantId: activeTeamId.value,
      locationCode: locCode,
      monthlyRent: Number(locMeta.monthlyRent ?? 0),
      commissionRate: Number(locMeta.commissionRate ?? locMeta.feePct ?? 0),
      fileName: activeFileName.value || `${locMeta.shortName} Payout CSV`,
      updatedAt: new Date().toISOString(),
      selectedCycle: selectedCycle.value,
      activeView: activeView.value,
      payoutCycles: payoutCycles.value,
      detectedRentMap: detectedRentMap.value,
      parsedRows: parsedRows.value.map(r => ({
        ...r,
        mappedItem: r.mappedItem ? {
          $id: r.mappedItem.$id,
          title: r.mappedItem.title,
          upc: r.mappedItem.upc,
          locationSku: r.mappedItem.locationSku,
          cost: r.mappedItem.cost,
          price: r.mappedItem.price || r.mappedItem.resalePrice,
          isSubClient: r.mappedItem.isSubClient,
          subClientName: r.mappedItem.subClientName,
          parentPartner: r.mappedItem.parentPartner
        } : null
      }))
    };
    localStorage.setItem(scopedKey, JSON.stringify(sessionData));
  } catch (err) {
    console.warn("Failed to auto-save staging session to localStorage:", err);
  }
};

const recomputePayoutCycles = () => {
  const defaultRent = Number(activeCanonicalLocationMeta.value.monthlyRent ?? 0);
  const cycleMap = new Map<string, PayoutCycle>();
  for (const r of parsedRows.value) {
    if (!cycleMap.has(r.cycleId)) {
      const candidateRent = detectedRentMap.value[r.cycleId];
      const validDetectedRent =
        typeof candidateRent === 'number' && !isNaN(candidateRent) && candidateRent > 0 && Math.abs(candidateRent - defaultRent) < 0.01
          ? candidateRent
          : defaultRent;
      cycleMap.set(r.cycleId, {
        id: r.cycleId,
        label: r.cycleLabel,
        paidDate: r.paidDate,
        gross: 0,
        netStore: 0,
        itemCount: 0,
        spaceRental: validDetectedRent,
        expectedCheck: 0
      });
    }
    const c = cycleMap.get(r.cycleId)!;
    c.gross = Number((c.gross + (r.listedPrice || 0)).toFixed(2));
    c.netStore = Number((c.netStore + (r.salePrice || 0)).toFixed(2));
    c.itemCount++;
  }

  for (const c of cycleMap.values()) {
    c.expectedCheck = Number((c.netStore - c.spaceRental).toFixed(2));
  }

  payoutCycles.value = Array.from(cycleMap.values())
    .filter(c => c.itemCount > 0)
    .sort((a, b) => b.id.localeCompare(a.id));

  if (!payoutCycles.value.some(c => c.id === selectedCycle.value)) {
    selectedCycle.value = payoutCycles.value[0]?.id || 'ALL';
  }
};

const restoreStagingSession = () => {
  if (typeof window === 'undefined') return;
  try {
    // Always purge legacy unscoped Auto-Save draft so cross-location drafts ($75 DT vs $382.50 MD) never leak
    localStorage.removeItem(LEGACY_UNSCOPED_STAGING_KEY);
    const locMeta = activeCanonicalLocationMeta.value;
    const targetCode = locMeta.code;
    const expectedRent = Number(locMeta.monthlyRent ?? 0);
    const expectedFee = Number(locMeta.commissionRate ?? locMeta.feePct ?? 0);
    const scopedKey = getScopedStagingStorageKey(targetCode);
    const raw = localStorage.getItem(scopedKey);
    if (!raw) {
      parsedRows.value = [];
      payoutCycles.value = [];
      detectedRentMap.value = {};
      hasRestoredSession.value = false;
      return;
    }
    const sessionData = JSON.parse(raw);
    const savedLocCode = sessionData?.locationCode ? resolveCanonicalLocationCode(sessionData.locationCode, locations.value) : '';
    const hasRentConflict =
      sessionData?.monthlyRent !== undefined && Math.abs(Number(sessionData.monthlyRent) - expectedRent) > 0.01;
    const hasFeeConflict =
      sessionData?.commissionRate !== undefined && Math.abs(Number(sessionData.commissionRate) - expectedFee) > 0.01;
    const hasCycleRentConflict =
      Array.isArray(sessionData?.payoutCycles) &&
      sessionData.payoutCycles.some((c: any) => c && typeof c.spaceRental === 'number' && Math.abs(Number(c.spaceRental) - expectedRent) > 0.01);

    if (savedLocCode !== targetCode || hasRentConflict || hasFeeConflict || hasCycleRentConflict) {
      localStorage.removeItem(scopedKey);
      parsedRows.value = [];
      payoutCycles.value = [];
      detectedRentMap.value = {};
      hasRestoredSession.value = false;
      return;
    }

    if (sessionData && Array.isArray(sessionData.parsedRows) && sessionData.parsedRows.length > 0) {
      // Ensure multi-qty attributes exist even if restored from an earlier staging session format
      const skuCounts = new Map<string, number>();
      sessionData.parsedRows.forEach((r: any) => {
        const skuKey = (r.extractedSku || r.itemName || '').trim().toUpperCase();
        if (skuKey) skuCounts.set(skuKey, (skuCounts.get(skuKey) || 0) + 1);
      });
      parsedRows.value = sessionData.parsedRows.map((r: any) => {
        const skuKey = (r.extractedSku || r.itemName || '').trim().toUpperCase();
        const repeatCount = r.repeatCount || skuCounts.get(skuKey) || 1;
        const isCandidate = r.isMultiQtyCandidate !== undefined ? r.isMultiQtyCandidate : (repeatCount > 1);
        const isMulti = r.isMultiQty !== undefined ? r.isMultiQty : isCandidate;
        return {
          ...r,
          repeatCount,
          isMultiQtyCandidate: isCandidate,
          isMultiQty: isMulti
        };
      });
      detectedRentMap.value = {};
      selectedCycle.value = sessionData.selectedCycle || 'ALL';
      activeView.value = sessionData.activeView || 'matching';
      activeFileName.value = sessionData.fileName || `${locMeta.shortName} Payout CSV`;
      hasRestoredSession.value = true;
      recomputePayoutCycles();
    }
  } catch (err) {
    console.warn("Failed to restore staging session:", err);
  }
};

const loadReceiptHistory = () => {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(RECEIPTS_STORAGE_KEY);
    if (raw) {
      reconciliationHistory.value = JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Could not load reconciliation history:", e);
  }
};

const saveReceiptToHistory = (receipt: any) => {
  if (typeof window === 'undefined' || !receipt) return;
  try {
    const existing = reconciliationHistory.value;
    const updated = [receipt, ...existing.filter((r: any) => r.cycleId !== receipt.cycleId || r.timestamp !== receipt.timestamp)].slice(0, 50);
    localStorage.setItem(RECEIPTS_STORAGE_KEY, JSON.stringify(updated));
    reconciliationHistory.value = updated;
  } catch (e) {
    console.warn("Could not save receipt history:", e);
  }
};

const viewHistoricReceipt = (hist: any) => {
  lastCommittedReceipt.value = hist;
  isHistoryModalOpen.value = false;
};

const downloadHistoricPartnerPdfs = (hist: any) => {
  if (!hist.partnerSettlements || hist.partnerSettlements.length === 0) return;
  hist.partnerSettlements.forEach((partner: any, idx: number) => {
    setTimeout(() => {
      generatePartnerSettlementPdf({
        partnerName: partner.partnerName,
        partnerPrefix: partner.partnerPrefix,
        billingCycle: hist.cycleLabel,
        grossSales: partner.grossSales,
        netSales: partner.netSales,
        mallCommission: partner.mallCommission,
        subtotalAfterMall: partner.subtotalAfterMall,
        rentShareAmount: partner.rentShareAmount,
        rentSharePct: partner.rentSharePct,
        coopFeePct: partner.coopFeePct,
        coopFeeAmount: partner.coopFeeAmount,
        finalPayoutAmount: partner.finalPayoutAmount,
        itemsCount: partner.itemsCount,
        items: partner.items || []
      });
    }, idx * 300);
  });
};

const deleteHistoricReceipt = (idx: number) => {
  if (!confirm("Are you sure you want to remove this receipt from history?")) return;
  reconciliationHistory.value.splice(idx, 1);
  if (typeof window !== 'undefined') {
    localStorage.setItem(RECEIPTS_STORAGE_KEY, JSON.stringify(reconciliationHistory.value));
  }
  addToast({ type: 'info', message: 'Receipt removed from history.' });
};

watch(selectedCycle, () => {
  saveStagingSession();
});

watch(activeView, () => {
  saveStagingSession();
});

watch(activeLocationCode, (newCode) => {
  const meta = getLocationSettingMeta(newCode, locations.value);
  salesIntakeTab.value = meta.salesIntakeMode || (meta.supportsPaperSalesSheet ? 'paper_sheet' : 'pos_csv');
  restoreStagingSession();
  recomputePayoutCycles();
  if (meta.usesRicochet) {
    fetchStagedRicochetSales(false);
  }
});

const handsOnTotals = computed(() => {
  let gross = 0;
  let net = 0;
  for (const r of parsedRows.value) {
    gross += Number(r.listedPrice || r.salePrice || 0);
    net += Number(r.salePrice || 0);
  }
  const grossRounded = Number(gross.toFixed(2));
  const netRounded = Number(net.toFixed(2));
  const feeRounded = Math.max(0, Number((grossRounded - netRounded).toFixed(2)));
  return {
    gross: grossRounded,
    net: netRounded,
    fee: feeRounded,
  };
});

const activeBoothInventoryForLocation = computed(() => {
  const locCode = activeCanonicalLocationMeta.value.code;
  return (inventoryItems.value || []).filter((item: any) => {
    const s = String(item.status || '').toLowerCase().trim();
    if (s === 'sold' || s === 'combined' || s === 'deconstructed' || s === 'draft' || s === 'tracked' || s === 'scouted') {
      return false;
    }
    return matchesLocationFilter(item, locCode);
  });
});

const filteredBoothPickList = computed(() => {
  const list = activeBoothInventoryForLocation.value;
  const q = boothPickListSearch.value.trim().toLowerCase();
  if (!q) return list;
  return list.filter((item: any) => {
    const title = String(item.title || '').toLowerCase();
    const upc = String(item.upc || '').toLowerCase();
    const sku = String(item.locationSku || '').toLowerCase();
    return title.includes(q) || upc.includes(q) || sku.includes(q);
  });
});

const normalizeRowDateForInput = (dateStr: string): string => {
  const raw = String(dateStr || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }
  const parts = raw.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    if (parts[2].length === 4) {
      return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    }
  }
  return new Date().toISOString().slice(0, 10);
};

const matchSingleHandsOnRow = (skuOrUpc: string, title: string, grossPrice: number): any => {
  const cleanCode = String(skuOrUpc || '').trim().toUpperCase();
  if (cleanCode) {
    const exact = (inventoryItems.value || []).find((item: any) => {
      const s = String(item.status || '').toLowerCase().trim();
      if (s === 'combined' || s === 'deconstructed') return false;
      const itemUpc = String(item.upc || '').trim().toUpperCase();
      const itemSku = cleanCatalogSku(item.locationSku).toUpperCase();
      return itemUpc === cleanCode || itemSku === cleanCode;
    });
    if (exact) return dereferenceParentLot(exact);
  }
  if (title && title.trim().length >= 3) {
    const candidates = getUnclaimedMatchCandidatesForRow({
      rowSku: cleanCode,
      rowTitle: title,
      rowPrice: grossPrice,
      rowIsInStock: false,
      rowIsBb: isBbConsignorRow({ sku: cleanCode, title }),
      searchQuery: '',
      filterMode: 'suggested',
      allItems: inventoryItems.value || [],
      claimedItemIds: claimedItemIdsForRow(),
      allowMultiQtyReuse: true,
      limit: 3,
    });
    if (candidates.length > 0 && candidates[0].confidence >= 85) {
      return dereferenceParentLot(candidates[0].item);
    }
  }
  return null;
};

const recalculateRowFinancials = (row: any) => {
  if (!row) return;
  const gross = Math.max(0, Number(Number(row.listedPrice || 0).toFixed(2)));
  const feePct = Number(activeCanonicalLocationMeta.value.feePct || 0);
  const fee = Number((gross * (feePct / 100)).toFixed(2));
  const net = Number((gross - fee).toFixed(2));
  row.listedPrice = gross;
  row.venueFee = fee;
  row.salePrice = net;
  row.netSoldPrice = net;
  const cycle = getCycleInfo('', row.date || row.soldDate || '');
  row.cycleId = cycle.id;
  row.cycleLabel = cycle.label;
  recomputePayoutCycles();
  saveStagingSession();
};

const addManualSoldLine = (prefill?: Partial<{
  date: string;
  sku: string;
  title: string;
  gross: number;
  qty: number;
  mappedItem: any;
  ticketNumber: string;
}>) => {
  const isoDate = normalizeRowDateForInput(prefill?.date || new Date().toISOString().slice(0, 10));
  const qty = Math.max(1, Number(prefill?.qty || 1));
  const gross = Math.max(0, Number(Number(prefill?.gross ?? 0).toFixed(2)));
  const feePct = Number(activeCanonicalLocationMeta.value.feePct || 0);
  const fee = Number((gross * (feePct / 100)).toFixed(2));
  const net = Number((gross - fee).toFixed(2));
  const sku = String(prefill?.sku || '').trim();
  const title = String(prefill?.title || '').trim() || (prefill?.mappedItem?.title || '');
  const matched = prefill?.mappedItem || matchSingleHandsOnRow(sku, title, gross);
  const isBB = isBbConsignorRow({ sku, title }) || Boolean(matched?.isSubClient);
  const cycle = getCycleInfo('', isoDate);

  const newRow: any = {
    date: isoDate,
    soldDate: isoDate,
    paidDate: isoDate,
    cycleId: cycle.id,
    cycleLabel: cycle.label,
    itemName: title || 'Booth Sale Item',
    extractedSku: sku || matched?.upc || matched?.locationSku || '',
    ticketNumber: prefill?.ticketNumber || `${activeCanonicalLocationMeta.value.code}-${isoDate.replace(/-/g, '')}-${parsedRows.value.length + 1}`,
    ticketOccurrence: 1,
    customerName: '',
    status: 'sold',
    qty,
    listedPrice: gross,
    venueFee: fee,
    salePrice: net,
    netSoldPrice: net,
    mappedItem: matched || null,
    isSubClient: isBB,
    subClientName: isBB ? 'B&B Consignment' : (matched?.subClientName || null),
    parentPartner: isBB ? 'PDXGL-' : (matched?.parentPartner || null),
    isMultiQtyCandidate: qty > 1,
    repeatCount: qty,
    isMultiQty: qty > 1 || Boolean(matched?.isMultiQty || (matched?.quantity && matched.quantity > 1)),
  };

  parsedRows.value.push(newRow);
  if (!activeFileName.value) {
    activeFileName.value = `${activeCanonicalLocationMeta.value.name} Sales Sheet (${isoDate})`;
  }
  recomputePayoutCycles();
  saveStagingSession();
};

const addActiveBoothItemAsSoldLine = (bItem: any) => {
  if (!bItem) return;
  const unitPrice = Number(bItem.boutiquePrice || bItem.resalePrice || bItem.price || 0);
  addManualSoldLine({
    date: new Date().toISOString().slice(0, 10),
    sku: bItem.upc || bItem.locationSku || '',
    title: bItem.title || 'Booth Item',
    gross: unitPrice,
    qty: 1,
    mappedItem: bItem,
  });
  addToast({
    type: 'success',
    message: `Added [${bItem.upc || 'ITEM'}] ${(bItem.title || '').slice(0, 32)} to Sold Lines!`,
  });
};

const onHandsOnDateChange = (row: any, newDate: string) => {
  if (!row) return;
  const cleanDate = normalizeRowDateForInput(newDate);
  row.date = cleanDate;
  row.soldDate = cleanDate;
  row.paidDate = cleanDate;
  recalculateRowFinancials(row);
};

const onHandsOnSkuOrTitleEdit = (row: any) => {
  if (!row) return;
  const matched = matchSingleHandsOnRow(row.extractedSku, row.itemName, Number(row.listedPrice || 0));
  if (matched) {
    row.mappedItem = matched;
    if (!row.itemName || row.itemName === 'Booth Sale Item') {
      row.itemName = matched.title || row.itemName;
    }
    if ((!row.listedPrice || Number(row.listedPrice) === 0) && (matched.boutiquePrice || matched.resalePrice || matched.price)) {
      row.listedPrice = Number(matched.boutiquePrice || matched.resalePrice || matched.price || 0);
    }
  }
  recalculateRowFinancials(row);
};

const onHandsOnQtyChange = (row: any, newQty: number) => {
  if (!row) return;
  const q = Math.max(1, Number(newQty || 1));
  row.qty = q;
  row.repeatCount = q;
  row.isMultiQtyCandidate = q > 1;
  if (q > 1) row.isMultiQty = true;
  saveStagingSession();
};

const onHandsOnGrossChange = (row: any, newGross: number) => {
  if (!row) return;
  row.listedPrice = Math.max(0, Number(newGross || 0));
  recalculateRowFinancials(row);
};

const removeHandsOnRow = (idx: number) => {
  if (idx < 0 || idx >= parsedRows.value.length) return;
  parsedRows.value.splice(idx, 1);
  recomputePayoutCycles();
  saveStagingSession();
};

const handleSalesSheetPhotoUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input?.files?.[0];
  if (!file) return;

  isParsingSheetPhoto.value = true;
  try {
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
    sheetPhotoPreviewUrl.value = dataUrl;

    const res = await fetch('/api/sales/parse-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: dataUrl,
        mimeType: file.type || 'image/jpeg',
        locationCode: activeCanonicalLocationMeta.value.code,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || `Vision parser error (${res.status})`);
    }

    lastParsedSheetTitle.value = data.sheetTitle || file.name || `${activeCanonicalLocationMeta.value.name} Paper Sales Sheet`;
    activeFileName.value = lastParsedSheetTitle.value;

    const extractedRows = Array.isArray(data.rows) ? data.rows : [];
    if (extractedRows.length === 0) {
      addToast({
        type: 'warning',
        message: 'No sold lines were detected on the photo. You can add lines by hand below!',
      });
      return;
    }

    for (const r of extractedRows) {
      const qty = Math.max(1, Number(r.qty || 1));
      const gross = Math.max(0, Number(r.soldPrice || 0));
      addManualSoldLine({
        date: r.date || new Date().toISOString().slice(0, 10),
        sku: r.upc || '',
        title: r.title || 'Sold Booth Item',
        gross,
        qty,
        ticketNumber: r.ticketNumber || '',
      });
    }

    if (typeof data.detectedRent === 'number' && data.detectedRent > 0 && payoutCycles.value.length > 0) {
      const topCycleId = payoutCycles.value[0].id;
      detectedRentMap.value[topCycleId] = Number(data.detectedRent);
      recomputePayoutCycles();
    }

    addToast({
      type: 'success',
      message: `📸 Extracted ${extractedRows.length} sold line(s) from ${lastParsedSheetTitle.value}! Review & verify below.`,
    });
  } catch (err: any) {
    console.error('[SalesImporter] Failed to parse sales sheet photo:', err);
    addToast({
      type: 'error',
      message: `Could not read sales sheet photo: ${err?.message || 'Unknown error'}`,
    });
  } finally {
    isParsingSheetPhoto.value = false;
    if (input) input.value = '';
  }
};

// Slide-Over Item Matcher Drawer State
const isMatcherDrawerOpen = ref(false);
const activeDrawerRowIndex = ref<number>(-1);
const drawerSubTab = ref<'create' | 'search'>('search');
const drawerSearchQuery = ref('');
const drawerFilterMode = ref<'suggested' | 'all' | 'same_price'>('suggested');
const isDrawerSaving = ref(false);
const isSavingDrawerLink = ref<string | null>(null);
const drawerForm = ref({
  title: '',
  prefix: 'HUCK',
  cost: 0,
  resalePrice: 0,
  soldPrice: 0,
  storageLocation: activeCanonicalLocationMeta.value.code,
  isMultiQty: false
});

const getItemThumbUrl = (item: any): string => {
  const imgId = getPrimaryItemImageId(item);
  if (!imgId) return '';
  return getAssetUrl(imgId, { preview: true, width: 160, height: 160, quality: 80 });
};

const claimedItemIdsForRow = (targetRow?: any): Set<string> => {
  const set = new Set<string>();
  for (const r of parsedRows.value) {
    if (r === targetRow) continue;
    if (r.mappedItem && r.mappedItem.$id) {
      set.add(r.mappedItem.$id);
    }
  }
  return set;
};

const getRowSuggestedCount = (row: any): number => {
  if (!row || !inventoryItems.value || inventoryItems.value.length === 0) return 0;
  return getUnclaimedMatchCandidatesForRow({
    rowSku: row.extractedSku,
    rowTitle: row.itemName,
    rowPrice: Number(row.listedPrice || row.salePrice || 0),
    rowIsInStock: false,
    rowIsBb: Boolean(row.isSubClient || isBbConsignorRow({ sku: row.extractedSku, title: row.itemName })),
    searchQuery: '',
    filterMode: 'suggested',
    allItems: inventoryItems.value,
    claimedItemIds: claimedItemIdsForRow(row),
    allowMultiQtyReuse: true,
    limit: 8,
  }).length;
};

const activeDrawerRow = computed(() => {
  if (activeDrawerRowIndex.value < 0 || activeDrawerRowIndex.value >= displayedRows.value.length) {
    return null;
  }
  return displayedRows.value[activeDrawerRowIndex.value];
});

const populateDrawerForm = (row: any) => {
  if (!row) return;
  let defaultPrefix = 'HUCK';
  if (row.isSubClient || row.parentPartner === 'PDXGL-') {
    defaultPrefix = 'BB';
  } else if (row.extractedSku && row.extractedSku.toUpperCase().startsWith('BB')) {
    defaultPrefix = 'BB';
  } else if (row.extractedSku && row.extractedSku.toUpperCase().startsWith('PDXGL')) {
    defaultPrefix = 'PDXGL';
  }

  drawerForm.value = {
    title: row.mappedItem?.title || row.itemName || '',
    prefix: defaultPrefix,
    cost: row.mappedItem ? getItemCost(row.mappedItem) : 0,
    resalePrice: Number(row.listedPrice || row.salePrice || 0),
    soldPrice: Number(row.salePrice || 0),
    storageLocation: activeCanonicalLocationMeta.value.code,
    isMultiQty: !!(row.isMultiQty || row.isMultiQtyCandidate || row.mappedItem?.isMultiQty || (row.mappedItem?.quantity && row.mappedItem.quantity > 1))
  };
  drawerSearchQuery.value = '';
  const suggestedCount = getRowSuggestedCount(row);
  drawerFilterMode.value = suggestedCount > 0 ? 'suggested' : 'all';
  drawerSubTab.value = row.mappedItem || suggestedCount > 0 ? 'search' : 'create';
};

const openMatcherDrawer = (row: any) => {
  const idx = displayedRows.value.indexOf(row);
  activeDrawerRowIndex.value = idx >= 0 ? idx : 0;
  populateDrawerForm(row);
  isMatcherDrawerOpen.value = true;
};

const activeRicochetSourceRow = ref<any | null>(null);

const applyMatchedItemToRicochetPayloadRow = (targetRicoRow: any, item: any) => {
  if (!targetRicoRow || !item || !Array.isArray(ricochetSyncPayload.value?.rows)) return;
  const itemSku = cleanCatalogSku(item.locationSku || item.sku || targetRicoRow.sku || '').toUpperCase();
  const itemUpc = cleanCatalogSku(item.upc || targetRicoRow.upc || '').toUpperCase();
  const rawMatch = ricochetSyncPayload.value.rows.find(
    (r: any) =>
      r === targetRicoRow ||
      (r.saleNumber && r.saleNumber === targetRicoRow.saleNumber && (r.title === targetRicoRow.title || r.sku === targetRicoRow.sku)) ||
      (r.ricoItemId && r.ricoItemId === targetRicoRow.ricoItemId && r.title === targetRicoRow.title)
  );
  const rowToMutate = rawMatch || targetRicoRow;
  rowToMutate.matchedItemId = item.$id;
  rowToMutate.matchedItemUpc = itemUpc || item.upc;
  rowToMutate.matchedItemTitle = item.title;
  rowToMutate.matchedItemCost = Number(item.cost || 0);
  if (!rowToMutate.sku && itemSku) rowToMutate.sku = itemSku;
  if (!rowToMutate.ricoSku && itemSku) rowToMutate.ricoSku = itemSku;
  if (!rowToMutate.upc && itemUpc) rowToMutate.upc = itemUpc;
  rowToMutate.matchTier = itemUpc ? 'upc' : itemSku ? 'sku' : 'title';
  rowToMutate.matchStatus = 'matched';
  ricochetSyncPayload.value = {
    ...ricochetSyncPayload.value,
    rows: [...ricochetSyncPayload.value.rows],
  };
};

const stageSingleRicochetRowIntoHandsOnMatcher = (rRow: any) => {
  if (!rRow) return;
  activeRicochetSourceRow.value = rRow;
  const existingMapped = rRow.matchedItemId
    ? (inventoryItems.value || []).find((i: any) => i.$id === rRow.matchedItemId) || null
    : null;
  addManualSoldLine({
    date: rRow.soldDate || rRow.paidDate || new Date().toISOString().slice(0, 10),
    sku: rRow.sku || rRow.ricoSku || rRow.upc || rRow.ricoItemId || '',
    title: rRow.title || 'Sold Booth Item',
    gross: Number(rRow.grossPrice || rRow.agreedPrice || 0),
    qty: 1,
    mappedItem: existingMapped,
    ticketNumber: rRow.payoutId || rRow.saleNumber || rRow.ricoItemId || '',
  });
  const newestRow = parsedRows.value[parsedRows.value.length - 1];
  if (newestRow) {
    newestRow._ricochetSourceRow = rRow;
    openMatcherDrawer(newestRow);
  }
};

const createSoldItemDocForRicochetRow = async (rRow: any) => {
  const ITEMS_COL = getCollectionId();
  const sku = cleanCatalogSku(rRow.ricoSku || rRow.sku || '').toUpperCase();
  const existingItem = sku
    ? (inventoryItems.value || []).find(
        (i: any) =>
          cleanCatalogSku(i.locationSku || i.sku).toUpperCase() === sku ||
          cleanCatalogSku(i.upc).toUpperCase() === sku
      )
    : null;
  if (existingItem) {
    applyMatchedItemToRicochetPayloadRow(rRow, existingItem);
    return existingItem;
  }

  let prefix = 'HUCK';
  if (rRow.partnerBucket === 'BB' || isBbConsignorRow({ sku, upc: rRow.upc, title: rRow.title })) {
    prefix = 'BB';
  } else if (rRow.partnerBucket === 'PDXGL' || sku.startsWith('PDXGL')) {
    prefix = 'PDXGL';
  }

  const nextUpc = await generateNextUpc(prefix);
  const gross = Number(rRow.grossPrice || rRow.agreedPrice || 0);
  const net = Number(rRow.ricoNetPayout ?? rRow.expectedNetPayout ?? gross);
  const activeCode = activeCanonicalLocationMeta.value.code;
  const activeWhId = activeCanonicalLocationMeta.value.id || MD_CANONICAL_WAREHOUSE_ID;

  const doc: Record<string, any> = {
    title: rRow.title || sku || 'Sold Booth Item',
    status: 'sold',
    cost: 0,
    resalePrice: gross,
    soldPrice: net,
    upc: nextUpc,
    locationSku: sku || undefined,
    storageLocation: activeCode,
    warehouseId: activeWhId,
    quantity: 1,
  };
  if (activeTeamId.value) doc.tenantId = activeTeamId.value;

  const createdDoc = await databases.createDocument(DB_ID, ITEMS_COL, ID.unique(), doc);
  inventoryItems.value.push(createdDoc);
  applyMatchedItemToRicochetPayloadRow(rRow, createdDoc);
  return createdDoc;
};

const quickCreateRicochetStagedRow = async (rRow: any) => {
  if (!rRow) return;
  try {
    const created = await createSoldItemDocForRicochetRow(rRow);
    addToast({
      type: 'success',
      message: `✅ Auto-created & linked [${created.upc}] ${created.title}!`,
    });
  } catch (err: any) {
    addToast({
      type: 'error',
      message: `Failed to auto-create item: ${err?.message || 'Unknown error'}`,
    });
  }
};

const autoCreateAllUnmatchedRicochetRows = async () => {
  const unmatched = ricochetStagedRows.value.filter(
    (r: any) => !r.matchedItemId && (!r.matchTier || r.matchTier === 'unmatched') && r.matchStatus !== 'matched'
  );
  if (unmatched.length === 0) {
    addToast({ type: 'info', message: 'All staged Ricochet rows are already matched!' });
    return;
  }
  isAutoCreatingAll.value = true;
  showLoader('Auto-Creating Unmatched Ricochet Items...', {
    step: `Generating barcodes for ${unmatched.length} items...`,
    progress: 5,
    cancelable: false,
  });
  try {
    let count = 0;
    for (let i = 0; i < unmatched.length; i++) {
      const rRow = unmatched[i];
      const pct = Math.round(((i + 1) / unmatched.length) * 100);
      updateLoader(undefined, `Creating ${i + 1}/${unmatched.length}: ${(rRow.title || '').slice(0, 30)}...`, pct);
      await createSoldItemDocForRicochetRow(rRow);
      count++;
    }
    addToast({
      type: 'success',
      message: `✨ Auto-created & linked ${count} sold booth items!`,
    });
  } catch (err: any) {
    addToast({
      type: 'error',
      message: `Auto-create failed: ${err?.message || 'Unknown error'}`,
    });
  } finally {
    isAutoCreatingAll.value = false;
    hideLoader();
  }
};

const closeMatcherDrawer = () => {
  isMatcherDrawerOpen.value = false;
  activeDrawerRowIndex.value = -1;
  drawerSearchQuery.value = '';
};

const goToPreviousDrawerRow = () => {
  if (activeDrawerRowIndex.value > 0) {
    activeDrawerRowIndex.value--;
    populateDrawerForm(activeDrawerRow.value);
  }
};

const goToNextDrawerRow = () => {
  if (activeDrawerRowIndex.value < displayedRows.value.length - 1) {
    activeDrawerRowIndex.value++;
    populateDrawerForm(activeDrawerRow.value);
  }
};

const filteredCandidateResults = computed(() => {
  const row = activeDrawerRow.value;
  if (!row || !inventoryItems.value) return [];
  const q = drawerSearchQuery.value.trim();
  const effectiveFilter = q ? 'all' : drawerFilterMode.value;
  return getUnclaimedMatchCandidatesForRow({
    rowSku: row.extractedSku,
    rowTitle: row.itemName,
    rowPrice: Number(row.listedPrice || row.salePrice || 0),
    rowIsInStock: false,
    rowIsBb: Boolean(row.isSubClient || isBbConsignorRow({ sku: row.extractedSku, title: row.itemName })),
    searchQuery: q,
    filterMode: effectiveFilter,
    allItems: inventoryItems.value,
    claimedItemIds: claimedItemIdsForRow(row),
    allowMultiQtyReuse: true,
    limit: q || effectiveFilter !== 'suggested' ? 35 : 8,
  });
});

/**
 * 1-Click `🔗 Link & Save to MD` inside SalesImporter Drawer:
 * Links the item to the active Payout row AND persists `locationSku`, `storageLocation: 'MD'`,
 * and `warehouseId: '6a7e70050009db0e1857'` to Appwrite right now!
 */
const linkAndSaveItemToActiveRow = async (item: any) => {
  const row = activeDrawerRow.value;
  if (!row || !item) return;
  const target = dereferenceParentLot(item);
  if (!target || !target.$id) return;

  isSavingDrawerLink.value = target.$id;
  try {
    const cleanSku = cleanCatalogSku(row.extractedSku);
    const normSkuUpper = cleanSku.toUpperCase();
    const binConfig = PREVERIFIED_MD_MULTI_QTY_BINS[normSkuUpper];
    const isMultiBin = Boolean(binConfig) || Boolean(target.isMultiQty) || Number(target.quantity || 1) > 1;
    const targetStatus = isMultiBin ? 'placed' : 'sold';
    const targetQty = binConfig
      ? Math.max(1, binConfig.expectedRemainingQty)
      : Math.max(1, Number(target.quantity || 1));

    const activeCode = activeCanonicalLocationMeta.value.code;
    const activeWhId = activeCanonicalLocationMeta.value.id || MD_CANONICAL_WAREHOUSE_ID;
    const updatePayload: any = {
      status: targetStatus,
      storageLocation: activeCode,
      warehouseId: activeWhId,
      quantity: targetQty,
    };
    if (cleanSku) {
      updatePayload.locationSku = cleanSku;
    }

    await updateInventoryItem(target.$id, updatePayload);

    target.status = targetStatus;
    target.storageLocation = activeCode;
    target.warehouseId = activeWhId;
    target.quantity = targetQty;
    if (cleanSku) target.locationSku = cleanSku;

    row.mappedItem = target;
    row.isSavedToMd = true;
    if (isMultiBin) {
      row.isMultiQty = true;
    }
    if (row._ricochetSourceRow || activeRicochetSourceRow.value) {
      applyMatchedItemToRicochetPayloadRow(row._ricochetSourceRow || activeRicochetSourceRow.value, target);
      activeRicochetSourceRow.value = null;
    }
    saveStagingSession();
    addToast({
      type: 'success',
      message: `✅ Linked & Saved [${target.upc || 'ITEM'}] ➔ ${cleanSku || activeCode} (${targetStatus} @ ${activeCode})!`,
    });
    closeMatcherDrawer();
  } catch (err: any) {
    console.error('[SalesImporter] Failed to link & save item to MD:', err);
    addToast({ type: 'error', message: `Failed to save link to Appwrite: ${err?.message || 'Unknown error'}` });
  } finally {
    isSavingDrawerLink.value = null;
  }
};

const unlinkActiveRow = () => {
  if (!activeDrawerRow.value) return;
  activeDrawerRow.value.mappedItem = null;
  activeDrawerRow.value.isSavedToMd = false;
  saveStagingSession();
  addToast({ type: 'info', message: 'Item unlinked.' });
};

const saveAndLinkNewItem = async (autoAdvance: boolean = false) => {
  const row = activeDrawerRow.value;
  if (!row) return;

  isDrawerSaving.value = true;
  try {
    const ITEMS_COL = getCollectionId();
    const nextUpc = await generateNextUpc(drawerForm.value.prefix);
    const gross = Number(drawerForm.value.resalePrice || row.listedPrice || row.salePrice || 0);
    const net = Number(drawerForm.value.soldPrice || row.salePrice || 0);
    const isMulti = !!drawerForm.value.isMultiQty;

    const doc: Record<string, any> = {
      title: drawerForm.value.title || row.itemName || 'Sold Item',
      status: 'sold',
      cost: Number(drawerForm.value.cost || 0),
      resalePrice: gross,
      soldPrice: net,
      upc: nextUpc,
      locationSku: row.extractedSku || undefined,
      storageLocation: drawerForm.value.storageLocation || activeCanonicalLocationMeta.value.code,
      warehouseId: activeCanonicalLocationMeta.value.id || MD_CANONICAL_WAREHOUSE_ID,
      quantity: isMulti ? Math.max(2, row.repeatCount || 2) : 1
    };
    if (activeTeamId.value) doc.tenantId = activeTeamId.value;

    const createdDoc = await databases.createDocument(DB_ID, ITEMS_COL, ID.unique(), doc);
    createdDoc.isMultiQty = isMulti;
    createdDoc.quantity = isMulti ? Math.max(2, row.repeatCount || 2) : 1;
    row.mappedItem = createdDoc;
    row.isMultiQty = isMulti;
    inventoryItems.value.push(createdDoc);
    if (row._ricochetSourceRow || activeRicochetSourceRow.value) {
      applyMatchedItemToRicochetPayloadRow(row._ricochetSourceRow || activeRicochetSourceRow.value, createdDoc);
      activeRicochetSourceRow.value = null;
    }

    // If multi-quantity SKU, auto-map any other staged rows sharing this exact SKU
    if (row.extractedSku && isMulti) {
      const sku = row.extractedSku.toUpperCase();
      parsedRows.value.forEach(r => {
        if (r.extractedSku && r.extractedSku.toUpperCase() === sku) {
          r.mappedItem = createdDoc;
          r.isMultiQty = true;
        }
      });
    }

    saveStagingSession();
    addToast({ type: 'success', message: `Created [${nextUpc}] ${doc.title}${isMulti ? ' (Multi-Qty Batch Stock)' : ''}` });

    if (autoAdvance && activeDrawerRowIndex.value < displayedRows.value.length - 1) {
      goToNextDrawerRow();
    }
  } catch (err: any) {
    console.error("Failed to save item from matcher drawer:", err);
    addToast({ type: 'error', message: 'Failed to create item: ' + err.message });
  } finally {
    isDrawerSaving.value = false;
  }
};

const quickAddRow = async (row: any) => {
  row.isQuickAdding = true;
  try {
    const ITEMS_COL = getCollectionId();
    let prefix = 'HUCK';
    if (row.isSubClient || row.parentPartner === 'PDXGL-') {
      prefix = 'BB';
    } else if (row.extractedSku && row.extractedSku.toUpperCase().startsWith('BB')) {
      prefix = 'BB';
    } else if (row.extractedSku && row.extractedSku.toUpperCase().startsWith('PDXGL')) {
      prefix = 'PDXGL';
    }

    const nextUpc = await generateNextUpc(prefix);
    const gross = Number(row.listedPrice || row.salePrice || 0);
    const net = Number(row.salePrice || 0);
    const isMulti = !!(row.isMultiQty || row.isMultiQtyCandidate);

    const doc: Record<string, any> = {
      title: row.itemName,
      status: 'sold',
      cost: 0,
      resalePrice: gross,
      soldPrice: net,
      upc: nextUpc,
      locationSku: row.extractedSku || undefined,
      storageLocation: activeCanonicalLocationMeta.value.code,
      warehouseId: activeCanonicalLocationMeta.value.id || MD_CANONICAL_WAREHOUSE_ID,
      quantity: isMulti ? Math.max(2, row.repeatCount || 2) : 1
    };
    if (activeTeamId.value) doc.tenantId = activeTeamId.value;

    const createdDoc = await databases.createDocument(DB_ID, ITEMS_COL, ID.unique(), doc);
    createdDoc.isMultiQty = isMulti;
    createdDoc.quantity = isMulti ? Math.max(2, row.repeatCount || 2) : 1;
    row.mappedItem = createdDoc;
    row.isMultiQty = isMulti;
    inventoryItems.value.push(createdDoc);
    if (row._ricochetSourceRow || activeRicochetSourceRow.value) {
      applyMatchedItemToRicochetPayloadRow(row._ricochetSourceRow || activeRicochetSourceRow.value, createdDoc);
      activeRicochetSourceRow.value = null;
    }

    // Auto-link any other rows that share this exact SKU
    if (row.extractedSku && isMulti) {
      const sku = row.extractedSku.toUpperCase();
      parsedRows.value.forEach(r => {
        if (r.extractedSku && r.extractedSku.toUpperCase() === sku) {
          r.mappedItem = createdDoc;
          r.isMultiQty = true;
        }
      });
    }

    saveStagingSession();
    addToast({ type: 'success', message: `Created [${nextUpc}] ${row.itemName}${isMulti ? ' (Multi-Qty)' : ''}` });
  } catch (err: any) {
    console.error("Quick add failed:", err);
    addToast({ type: 'error', message: 'Failed to create item: ' + err.message });
  } finally {
    row.isQuickAdding = false;
  }
};

const toggleRowMultiQty = (row: any) => {
  row.isMultiQty = !row.isMultiQty;
  if (row.extractedSku) {
    const sku = row.extractedSku.toUpperCase();
    parsedRows.value.forEach(r => {
      if (r.extractedSku && r.extractedSku.toUpperCase() === sku) {
        r.isMultiQty = row.isMultiQty;
      }
    });
  }
  if (row.mappedItem) {
    row.mappedItem.isMultiQty = row.isMultiQty;
  }
  saveStagingSession();
  addToast({ 
    type: 'info', 
    message: `${row.extractedSku || row.itemName}: ${row.isMultiQty ? 'Flagged as Multi-Quantity (batch stock)' : 'Flagged as Single-Unit'}` 
  });
};

const autoCreateAllUnmatched = async () => {
  const unmatched = cycleFilteredRows.value.filter(r => !r.mappedItem);
  if (unmatched.length === 0) {
    addToast({ type: 'info', message: 'All items in this cycle are already matched!' });
    return;
  }

  isAutoCreatingAll.value = true;
  showLoader("Auto-Creating Unmatched Items as Sold...", {
    step: `Generating barcodes for ${unmatched.length} items...`,
    progress: 5,
    cancelable: false
  });

  try {
    const ITEMS_COL = getCollectionId();
    let createdCount = 0;

    for (let idx = 0; idx < unmatched.length; idx++) {
      const row = unmatched[idx];
      if (row.mappedItem) continue; // Might have been auto-linked by an earlier multi-qty item

      const pct = Math.round(((idx + 1) / unmatched.length) * 100);
      updateLoader(undefined, `Creating ${idx + 1}/${unmatched.length}: ${(row.itemName || '').slice(0, 30)}...`, pct);

      // Check if an item with this exact SKU already exists in inventory (Zero Duplicate Inventory Law)
      if (row.extractedSku) {
        const existingItem = activeInventory.value.find(i => 
          (i.locationSku && i.locationSku.toUpperCase() === row.extractedSku.toUpperCase()) || 
          (i.upc && i.upc.toUpperCase() === row.extractedSku.toUpperCase())
        );
        if (existingItem) {
          row.mappedItem = existingItem;
          if (row.isMultiQty || row.isMultiQtyCandidate || existingItem.isMultiQty) {
            row.isMultiQty = true;
            existingItem.isMultiQty = true;
          }
          createdCount++;
          continue; // Re-use existing item, do not mint duplicate
        }
      }

      let prefix = 'HUCK';
      if (row.isSubClient || row.parentPartner === 'PDXGL-') {
        prefix = 'BB';
      } else if (row.extractedSku && row.extractedSku.toUpperCase().startsWith('BB')) {
        prefix = 'BB';
      } else if (row.extractedSku && row.extractedSku.toUpperCase().startsWith('PDXGL')) {
        prefix = 'PDXGL';
      }

      const isMulti = !!(row.isMultiQty || row.isMultiQtyCandidate);
      const nextUpc = await generateNextUpc(prefix);
      const gross = Number(row.listedPrice || row.salePrice || 0);
      const net = Number(row.salePrice || 0);

      const doc: Record<string, any> = {
        title: row.itemName,
        status: 'sold',
        cost: 0,
        resalePrice: gross,
        soldPrice: net,
        upc: nextUpc,
        locationSku: row.extractedSku || undefined,
        storageLocation: 'MD',
        quantity: isMulti ? Math.max(2, row.repeatCount || 2) : 1
      };
      if (activeTeamId.value) doc.tenantId = activeTeamId.value;

      const createdDoc = await databases.createDocument(DB_ID, ITEMS_COL, ID.unique(), doc);
      createdDoc.isMultiQty = isMulti;
      createdDoc.quantity = isMulti ? Math.max(2, row.repeatCount || 2) : 1;
      row.mappedItem = createdDoc;
      row.isMultiQty = isMulti;
      inventoryItems.value.push(createdDoc);
      createdCount++;

      // If multi-qty, map other staged rows with the same SKU in this batch immediately!
      if (row.extractedSku && isMulti) {
        const sku = row.extractedSku.toUpperCase();
        for (let j = idx + 1; j < unmatched.length; j++) {
          const otherRow = unmatched[j];
          if (!otherRow.mappedItem && otherRow.extractedSku && otherRow.extractedSku.toUpperCase() === sku) {
            otherRow.mappedItem = createdDoc;
            otherRow.isMultiQty = true;
            createdCount++;
          }
        }
      }
    }

    saveStagingSession();
    addToast({ 
      type: 'success', 
      message: `Auto-created ${createdCount} items with barcodes! All items are now matched and ready to commit.` 
    });
  } catch (err: any) {
    console.error("Auto-create all failed:", err);
    addToast({ type: 'error', message: 'Failed during auto-creation: ' + err.message });
  } finally {
    isAutoCreatingAll.value = false;
    hideLoader();
  }
};

const loadDefaultPayoutFile = async () => {
  isProcessing.value = true;
  showLoader("Loading Memory Den Payout CSV...", {
    step: "Fetching stored multi-month payout records...",
    progress: 10,
    cancelable: false
  });
  try {
    let res = await fetch('/api/sales/default-payout');
    if (!res.ok) {
      res = await fetch('/MemoryDen_MultiMonth_Payout_Full.csv');
    }
    if (!res.ok) {
      // In production where no local sample CSV is present, gracefully remain ready for user upload
      return;
    }
    const text = await res.text();
    activeFileName.value = 'MemoryDen_MultiMonth_Payout_Full.csv';
    parseMemoryDenPayout(text);
  } catch (err: any) {
    console.info("No default payout CSV present; waiting for user file upload.");
  } finally {
    isProcessing.value = false;
    hideLoader();
  }
};

onMounted(async () => {
  if (activeTeamId.value) {
    try {
      locations.value = await warehousesApi.listWarehouses(activeTeamId.value);
    } catch {}
  }

  let rawTargetLocation = String(props.initialLocation || '').trim();
  if (!rawTargetLocation && typeof window !== 'undefined') {
    const pathMatch = window.location.pathname.match(/\/sales\/import\/([^/?#]+)/i);
    if (pathMatch && pathMatch[1]) {
      try {
        rawTargetLocation = decodeURIComponent(pathMatch[1]).trim();
      } catch {
        rawTargetLocation = pathMatch[1].trim();
      }
    }
    if (!rawTargetLocation && window.location?.search) {
      const p = new URLSearchParams(window.location.search);
      rawTargetLocation = (p.get('location') || '').trim();
    }
  }

  if (rawTargetLocation) {
    const resolved = resolveCanonicalLocationCode(rawTargetLocation, locations.value) || 'MD';
    activeLocationCode.value = resolved;
    isLocationLocked.value = true;
    normalizeSalesLocationUrlParam(resolved);
    const meta = getLocationSettingMeta(resolved, locations.value);
    salesIntakeTab.value = meta.salesIntakeMode || (meta.supportsPaperSalesSheet ? 'paper_sheet' : 'pos_csv');
  } else {
    isLocationLocked.value = false;
  }

  if (inventoryItems.value.length === 0) {
    fetchInventory(activeTeamId.value || undefined);
  }
  loadReceiptHistory();
  restoreStagingSession();

  if (activeCanonicalLocationMeta.value.usesRicochet) {
    fetchStagedRicochetSales(false);
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('resale_command_sync');
        bc.onmessage = (ev) => {
          if (ev?.data?.type === 'RC_RICOCHET_SALES_SYNCED' && ev?.data?.payload) {
            ricochetSyncPayload.value = ev.data.payload;
          }
        };
      }
    } catch {}
  }

  // If no session in localStorage, auto-load stored multi-month payout CSV for POS CSV booths
  if (parsedRows.value.length === 0 && !activeCanonicalLocationMeta.value.supportsPaperSalesSheet) {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(getScopedStagingStorageKey(activeLocationCode.value)) : null;
    if (!raw) {
      await loadDefaultPayoutFile();
    }
  }
});

// Helper: Dereference combined/deconstructed child items to their active Parent Lot
const dereferenceParentLot = (item: any): any => {
  if (!item) return null;
  const s = String(item.status || '').toLowerCase().trim();
  if ((s === 'combined' || s === 'deconstructed') && item.parentLotId) {
    const parent = inventoryItems.value.find(p => p.$id === item.parentLotId);
    if (parent) return dereferenceParentLot(parent);
  }
  return item;
};

const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'for', 'in', 'on', 'at', 'to', 'with', 'by', 'from', 'is', 'it', 'as', 'game', 'sc', 'aeg']);

const extractKeywords = (str: string): string[] => {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
};

const activeInventory = computed(() => {
  return inventoryItems.value;
});

// Title search candidates: strictly exclude 'combined' and 'deconstructed' items (Lineage Absorption Law)
const titleEligibleInventory = computed(() => {
  return inventoryItems.value.filter(item => {
    const s = String(item.status || '').toLowerCase().trim();
    return s !== 'combined' && s !== 'deconstructed' && s !== 'tracked' && s !== 'draft' && s !== 'scouted';
  });
});

const cycleFilteredRows = computed(() => {
  if (selectedCycle.value === 'ALL') return parsedRows.value;
  return parsedRows.value.filter(r => r.cycleId === selectedCycle.value);
});

const multiCount = computed(() => cycleFilteredRows.value.filter(r => r.isMultiQty || r.isMultiQtyCandidate).length);

const displayedRows = computed(() => {
  const base = cycleFilteredRows.value;
  if (filterTab.value === 'matched') return base.filter(r => r.mappedItem !== null);
  if (filterTab.value === 'unmatched') return base.filter(r => r.mappedItem === null);
  if (filterTab.value === 'multi') return base.filter(r => r.isMultiQty || r.isMultiQtyCandidate);
  return base;
});

const availableItems = computed(() => {
  // Count how many times each item is mapped in cycleFilteredRows
  const usageCountMap = new Map<string, number>();
  cycleFilteredRows.value.forEach(r => {
    if (r.mappedItem?.$id) {
      usageCountMap.set(r.mappedItem.$id, (usageCountMap.get(r.mappedItem.$id) || 0) + 1);
    }
  });

  return inventoryItems.value.filter(i => {
    const s = String(i.status || '').toLowerCase().trim();
    // Exclude combined/deconstructed children from candidate drawer list
    if (s === 'combined' || s === 'deconstructed') return false;

    const used = usageCountMap.get(i.$id) || 0;
    const capacity = Math.max(1, Number(i.quantity || 1));
    const isMulti = i.isMultiQty || capacity > 1;

    // Multi-qty lots are always available to link; single-unit items only if not yet used
    if (isMulti) return true;
    return used === 0;
  });
});

const matchedCount = computed(() => cycleFilteredRows.value.filter(r => r.mappedItem).length);
const unmatchedCount = computed(() => cycleFilteredRows.value.filter(r => !r.mappedItem).length);

const currentCycleInfo = computed(() => {
  const defaultRent = Number(activeCanonicalLocationMeta.value.monthlyRent ?? 0);
  if (selectedCycle.value === 'ALL') {
    const totalRent = payoutCycles.value.reduce((sum, _c) => sum + defaultRent, 0) || (defaultRent * Math.max(1, payoutCycles.value.length));
    const totalCheck = payoutCycles.value.reduce((sum, c) => sum + Number((c.netStore - defaultRent).toFixed(2)), 0);
    return {
      id: 'ALL',
      label: `All Cycles (${payoutCycles.value.length} Checks)`,
      spaceRental: totalRent,
      checkCount: payoutCycles.value.length,
      isMultiCycle: payoutCycles.value.length > 1,
      expectedCheck: totalCheck
    };
  }
  const c = payoutCycles.value.find(cy => cy.id === selectedCycle.value);
  return {
    id: selectedCycle.value,
    label: c?.label || selectedCycle.value,
    spaceRental: defaultRent,
    checkCount: 1,
    isMultiCycle: false,
    paidDate: c?.paidDate,
    expectedCheck: c ? Number((c.netStore - defaultRent).toFixed(2)) : 0
  };
});

const totalAllChecks = computed(() => {
  const defaultRent = Number(activeCanonicalLocationMeta.value.monthlyRent ?? 0);
  return payoutCycles.value.reduce((sum, c) => sum + Number(((c.netStore || 0) - defaultRent).toFixed(2)), 0);
});

const selectedCycleFinancials = computed(() => {
  const rows = cycleFilteredRows.value;
  const gross = Number(rows.reduce((sum, r) => sum + (Number(r.listedPrice || r.salePrice) || 0), 0).toFixed(2));
  const netStore = Number(rows.reduce((sum, r) => sum + (Number(r.salePrice) || 0), 0).toFixed(2));
  const mallFee = Math.max(0, Number((gross - netStore).toFixed(2)));
  const rent = rows.length > 0 ? currentCycleInfo.value.spaceRental : 0;
  const netCheck = rows.length > 0 ? Number((netStore - rent).toFixed(2)) : 0;

  return {
    itemCount: rows.length,
    gross,
    netStore,
    mallFee,
    rent,
    netCheck
  };
});

const reset = () => {
  parsedRows.value = [];
  payoutCycles.value = [];
  detectedRentMap.value = {};
  selectedCycle.value = '';
  activeView.value = 'matching';
  lastCommittedReceipt.value = null;
  hasRestoredSession.value = false;
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LEGACY_UNSCOPED_STAGING_KEY);
    localStorage.removeItem(getScopedStagingStorageKey(activeLocationCode.value));
  }
};

const getItemCost = (item: any) => {
  if (!item) return 0;
  if (item.cost !== undefined && item.cost !== null && !isNaN(Number(item.cost))) {
    return Number(item.cost);
  }
  if (item.purchasePrice !== undefined && item.purchasePrice !== null && !isNaN(Number(item.purchasePrice))) {
    return Number(item.purchasePrice);
  }
  if (item.conditionNotes) {
    const match = item.conditionNotes.match(/Paid[:\s]*\$?([\d.]+)/i);
    if (match) {
      const val = parseFloat(match[1]);
      if (!isNaN(val)) return val;
    }
  }
  return 0;
};

const resolveItemPrefix = (item: any, rowSku?: string, itemName?: string) => {
  const upc = (item?.upc || '').trim().toUpperCase();
  const sku = (rowSku || item?.locationSku || '').trim().toUpperCase();
  const name = (itemName || item?.title || '').trim().toUpperCase();

  // B&B Sub-client (routes to BB-)
  if (upc.startsWith('BB-') || sku.startsWith('BB-') || sku.startsWith('BB') || 
      name.startsWith('B&B ') || name.startsWith('B&B-') || name.startsWith('BB ') || name.startsWith('BB-') ||
      item?.isSubClient) {
    return 'BB-';
  }
  if (upc.startsWith('PDXGL-') || sku.startsWith('PDXGL-') || sku.startsWith('PDXGL')) {
    return 'PDXGL-';
  }
  if (upc.startsWith('HUCK-') || sku.startsWith('HUCK-') || sku.startsWith('HUCK')) {
    return 'HUCK-';
  }

  const partnerList = team.value?.prefs?.partnerPrefixes || [];
  for (const p of partnerList) {
    const pStr = normalizeOrgPrefix(typeof p === 'string' ? p : p?.prefix);
    if (pStr && (upc.startsWith(pStr) || sku.startsWith(pStr))) {
      return pStr;
    }
  }

  const upcMatch = upc.match(/^([A-Z0-9]+-)/);
  if (upcMatch) return upcMatch[1];

  return normalizeOrgPrefix(team.value?.prefs?.upcPrefix || 'HUCK-');
};

const resolvePartnerName = (prefix: string) => {
  const clean = prefix.replace(/[-_]$/, '');
  if (clean === 'HUCK') return 'Huckleberry Collective';
  if (clean === 'PDXGL') return 'PDX Game Library';
  if (clean === 'BB') return 'B&B Consignment (PDXGL Sub-Client)';

  const partnerList = team.value?.prefs?.partnerPrefixes || [];
  for (const p of partnerList) {
    const pStr = normalizeOrgPrefix(typeof p === 'string' ? p : p?.prefix);
    if (pStr === prefix && typeof p === 'object' && p.name) {
      return p.name;
    }
  }
  return `${clean} Partner`;
};

const partnerSettlements = computed(() => {
  const rows = cycleFilteredRows.value;
  if (rows.length === 0) return [];

  const rawGroups: Record<string, any> = {};
  const boothRent = currentCycleInfo.value.spaceRental;

  for (const row of rows) {
    const item = row.mappedItem;
    const prefix = resolveItemPrefix(item, row.extractedSku, row.itemName);
    const partnerName = resolvePartnerName(prefix);

    if (!rawGroups[prefix]) {
      rawGroups[prefix] = {
        prefix,
        name: partnerName,
        isConsignor: prefix === 'BB-',
        isSubClient: prefix === 'BB-',
        parentPartner: prefix === 'BB-' ? 'PDXGL-' : null,
        items: [],
        totalGross: 0,
        totalVenueFee: 0,
        totalCostBasis: 0,
        totalNetSurplus: 0,
        totalCuratorProfit: 0,
        rentDeduction: 0,
        totalPayoutCheck: 0,
        totalCommonsTake: 0
      };
    }

    const isPureConsignor = prefix === 'BB-';
    const grossPrice = Number(row.listedPrice || row.salePrice || 0);
    const netStoreDeposit = Number(row.salePrice || (grossPrice * 0.85));
    const venueFee = Number((row.venueFee !== undefined ? row.venueFee : (grossPrice - netStoreDeposit)).toFixed(2));
    let costBasis = 0;
    if (!isPureConsignor && item) {
      const itemQty = Math.max(1, Number(item.quantity || 1));
      const isMulti = Boolean(item.isMultiQty || itemQty > 1 || row.isMultiQty);
      costBasis = resolveMdUnitCostBasis(item, row.extractedSku, isMulti);
    }
    const netSurplus = Math.max(0, Number((netStoreDeposit - costBasis).toFixed(2)));
    const curatorTake = isPureConsignor ? netStoreDeposit : Number((costBasis + (netSurplus * 0.70)).toFixed(2));
    const commonsTake = isPureConsignor ? 0 : Number((netSurplus * 0.30).toFixed(2));

    rawGroups[prefix].items.push({
      date: row.date,
      sku: item?.upc || row.extractedSku || item?.locationSku || 'N/A',
      ticketNumber: row.ticketNumber,
      title: item?.title || row.itemName,
      grossPrice,
      venueFee,
      costBasis,
      netSurplus,
      curatorTake
    });

    rawGroups[prefix].totalGross = Number((rawGroups[prefix].totalGross + grossPrice).toFixed(2));
    rawGroups[prefix].totalVenueFee = Number((rawGroups[prefix].totalVenueFee + venueFee).toFixed(2));
    rawGroups[prefix].totalCostBasis = Number((rawGroups[prefix].totalCostBasis + costBasis).toFixed(2));
    rawGroups[prefix].totalNetSurplus = Number((rawGroups[prefix].totalNetSurplus + netSurplus).toFixed(2));
    rawGroups[prefix].totalCuratorProfit = Number((rawGroups[prefix].totalCuratorProfit + (isPureConsignor ? netStoreDeposit : (netSurplus * 0.70))).toFixed(2));
    rawGroups[prefix].totalCommonsTake = Number((rawGroups[prefix].totalCommonsTake + commonsTake).toFixed(2));
  }

  const allGroups = Object.values(rawGroups);
  const totalGrossAll = Number(allGroups.reduce((sum, g) => sum + g.totalGross, 0).toFixed(2));

  for (const grp of allGroups) {
    const grossRatio = totalGrossAll > 0 ? (grp.totalGross / totalGrossAll) : 0;
    const rentShare = Number((grossRatio * boothRent).toFixed(2));
    grp.rentDeduction = rentShare;

    if (grp.isConsignor) {
      // Pure Consignor (B&B): Gross - 15% Mall Fee - Proportional Booth Rent Share
      // In Sept 2026: $239.00 - $35.85 - $38.68 = $164.47
      grp.totalCuratorProfit = Math.max(0, Number((grp.totalGross - grp.totalVenueFee - rentShare).toFixed(2)));
      grp.totalPayoutCheck = grp.totalCuratorProfit;
    } else {
      // Co-op Member: 100% Cost Basis + 70% Net Surplus
      grp.totalPayoutCheck = Number((grp.totalCostBasis + grp.totalCuratorProfit).toFixed(2));
    }
  }

  // Return standalone partner groups: HUCK, PDXGL, and B&B Consignment
  const result: any[] = [];
  if (rawGroups['HUCK-']) result.push(rawGroups['HUCK-']);
  if (rawGroups['PDXGL-']) result.push(rawGroups['PDXGL-']);
  if (rawGroups['BB-']) result.push(rawGroups['BB-']);

  // Any other partner groups
  for (const [key, grp] of Object.entries(rawGroups)) {
    if (key !== 'HUCK-' && key !== 'PDXGL-' && key !== 'BB-') {
      result.push(grp);
    }
  }

  return result;
});

const settlementSummary = computed(() => {
  const settlements = partnerSettlements.value;
  const boothRent = currentCycleInfo.value.spaceRental;
  
  const totalGross = Number(settlements.reduce((sum, p) => sum + (p.masterGross !== undefined ? p.masterGross : p.totalGross), 0).toFixed(2));
  const totalVenueFee = Number(settlements.reduce((sum, p) => sum + (p.masterVenueFee !== undefined ? p.masterVenueFee : p.totalVenueFee), 0).toFixed(2));
  const totalStorePayout = Number((totalGross - totalVenueFee).toFixed(2));
  const totalCostBasis = Number(settlements.reduce((sum, p) => sum + (p.masterCostBasis !== undefined ? p.masterCostBasis : p.totalCostBasis), 0).toFixed(2));
  const totalNetSurplus = Number(settlements.reduce((sum, p) => sum + (p.masterNetSurplus !== undefined ? p.masterNetSurplus : p.totalNetSurplus), 0).toFixed(2));
  const totalCuratorPayouts = Number(settlements.reduce((sum, p) => sum + (p.masterPayoutCheck !== undefined ? p.masterPayoutCheck : p.totalPayoutCheck), 0).toFixed(2));
  const totalCommonsPool = Number(settlements.reduce((sum, p) => sum + (p.masterCommonsTake !== undefined ? p.masterCommonsTake : p.totalCommonsTake), 0).toFixed(2));

  // Consignor Rent Contributions collected (e.g. B&B's rent deduction) offset the booth rent
  const consignorRentOffsets = Number(settlements.filter(p => p.isConsignor).reduce((sum, p) => sum + (p.rentDeduction || 0), 0).toFixed(2));
  const netBoothRentForCoop = Math.max(0, Number((boothRent - consignorRentOffsets).toFixed(2)));
  const commonsSurplusAfterRent = Number((totalCommonsPool - netBoothRentForCoop).toFixed(2));
  const memoryDenNetCheck = Number((totalStorePayout - boothRent).toFixed(2));

  return {
    totalGross,
    totalVenueFee,
    totalStorePayout,
    totalCostBasis,
    totalNetSurplus,
    totalCuratorPayouts,
    totalCommonsPool,
    boothRent,
    consignorRentOffsets,
    netBoothRentForCoop,
    commonsSurplusAfterRent,
    isRentCovered: commonsSurplusAfterRent >= 0,
    memoryDenNetCheck
  };
});

const downloadPartnerPdf = (partner) => {
  const doc = generatePartnerSettlementPdf({
    statementDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
    periodLabel: `${currentCycleInfo.value.label} Settlement`,
    partnerName: partner.name,
    prefix: partner.prefix,
    items: partner.items,
    totalGross: partner.totalGross,
    totalVenueFee: partner.totalVenueFee,
    totalCostBasis: partner.totalCostBasis,
    totalNetSurplus: partner.totalNetSurplus,
    totalCuratorProfit: partner.totalCuratorProfit,
    totalPayoutCheck: partner.totalPayoutCheck,
    boothLocation: `${activeCanonicalLocationMeta.value.shortName} (${activeCanonicalLocationMeta.value.code})`,
    rentDeduction: partner.isConsignor ? (partner.rentDeduction || 0) : undefined
  });
  const filename = `Settlement_${partner.prefix.replace(/[-_]$/, '')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
  addToast({ type: 'success', message: `Downloaded PDF statement for ${partner.name}!` });
};

const exportAllPartnerPdfs = () => {
  if (partnerSettlements.value.length === 0) return;
  partnerSettlements.value.forEach((partner, idx) => {
    setTimeout(() => {
      downloadPartnerPdf(partner);
    }, idx * 300);
  });
};

const exportReceiptPartnerPdfs = () => {
  if (!lastCommittedReceipt.value || !lastCommittedReceipt.value.partnerSettlements) return;
  lastCommittedReceipt.value.partnerSettlements.forEach((partner: any, idx: number) => {
    setTimeout(() => {
      downloadPartnerPdf(partner);
    }, idx * 300);
  });
};

const dismissReceiptAndContinue = () => {
  lastCommittedReceipt.value = null;
  if (payoutCycles.value.length > 0) {
    selectedCycle.value = payoutCycles.value[0].id;
  }
  saveStagingSession();
};

const resetAndUploadNew = () => {
  lastCommittedReceipt.value = null;
  reset();
};

const remainingCyclesCount = computed(() => {
  return payoutCycles.value.length;
});

const exportStagingSessionJson = () => {
  if (parsedRows.value.length === 0) return;
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tenantId: activeTeamId.value,
    selectedCycle: selectedCycle.value,
    payoutCycles: payoutCycles.value,
    parsedRows: parsedRows.value.map(r => ({
      ...r,
      mappedItem: r.mappedItem ? {
        $id: r.mappedItem.$id,
        title: r.mappedItem.title,
        upc: r.mappedItem.upc,
        locationSku: r.mappedItem.locationSku,
        cost: r.mappedItem.cost,
        price: r.mappedItem.price || r.mappedItem.resalePrice,
        isSubClient: r.mappedItem.isSubClient,
        subClientName: r.mappedItem.subClientName,
        parentPartner: r.mappedItem.parentPartner
      } : null
    }))
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `RC_Reconciliation_${selectedCycle.value || 'Staging'}_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  addToast({ type: 'success', message: 'Exported reconciliation session to JSON!' });
};

const splitCsvLine = (line) => {
  const regex = /(?:^|,)(?:"([^"]*)"|([^,]*))/g;
  const result = [];
  let match;
  while ((match = regex.exec(line)) !== null) {
      if (match[1] !== undefined) result.push(match[1]);
      else if (match[2] !== undefined) result.push(match[2]);
      if (regex.lastIndex === match.index) regex.lastIndex++;
  }
  return result;
};

const handleFileUpload = async (event: any) => {
  const file = event.target.files[0];
  if (!file) return;

  isProcessing.value = true;
  showLoader("Reading Sales File...", {
    step: "Reading transaction rows and detecting monthly cycles...",
    cancelable: false
  });

  activeFileName.value = file.name || 'Memory Den Payout CSV';
  const fileName = (file.name || '').toLowerCase();

  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    try {
      const XLSX = await import('xlsx');
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const data = new Uint8Array(e.target.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const csvText = XLSX.utils.sheet_to_csv(firstSheet);
          parseMemoryDenPayout(csvText);
        } catch (excelErr: any) {
          hideLoader();
          addToast({ type: 'error', message: 'Failed to read Excel file: ' + excelErr.message });
          isProcessing.value = false;
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (importErr: any) {
      hideLoader();
      addToast({ type: 'error', message: 'Failed to load Excel reader: ' + importErr.message });
      isProcessing.value = false;
    }
  } else {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const text = e.target.result as string;
      parseMemoryDenPayout(text);
    };
    reader.onerror = () => {
      hideLoader();
      isProcessing.value = false;
    };
    reader.readAsText(file);
  }
};

/**
 * Payout-month bucketing standard: group strictly by the CALENDAR sold date (never by the payout check / paid date).
 * Pure string parsing (1-indexed month) so 11-02-2026 and 11-03-2026 always land in "November 2026".
 */
const getCycleInfo = (_paidDateStr: string, soldDateStr: string, rentDateStr: string = '') => {
  const key = calendarMonthKeyFromDateString(soldDateStr) || calendarMonthKeyFromDateString(rentDateStr);
  if (!key) return { id: 'default', label: 'General Payout' };
  return { id: key, label: monthKeyToLabel(key) };
};

// When several inventory docs share one booth SKU (legacy syncs), prefer the one whose title matches the register row.
const pickSkuMatch = (sku: string, name: string) => {
  const cands = activeInventory.value.filter((i: any) => i.locationSku === sku || i.locationSku === `'${sku}`);
  if (cands.length <= 1) return cands[0] || null;
  const toks = (s: string) => new Set(String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(w => w.length > 1));
  const a = toks(name);
  const score = (i: any) => {
    let best = 0;
    [i.tagTitle, i.title].forEach((t: string) => {
      const b = toks(t || '');
      let hit = 0;
      a.forEach(w => { if (b.has(w)) hit++; });
      best = Math.max(best, a.size ? hit / a.size : 0);
    });
    return best;
  };
  return [...cands].sort((x, y) => score(y) - score(x))[0];
};

const parseMemoryDenPayout = (csvText: string) => {
  const rfcRows = parseCsvRfc4180Rows(csvText);
  if (rfcRows.length < 2) {
    addToast({ type: 'error', message: 'CSV is empty or invalid.' });
    isProcessing.value = false;
    return;
  }

  const headers = rfcRows[0].map(h => normalizeCsvHeader(h));

  // Product Catalog export (Products-*.csv): no Sale# and no Sold Date. It can never produce sales - redirect the user.
  if (isProductCatalogHeaders(headers)) {
    catalogFileDetected.value = true;
    parsedRows.value = [];
    isProcessing.value = false;
    addToast({ type: 'warning', message: 'This is a Product Catalog export (Products-*.csv) - no sales were created. Use Payouts-*.csv here, or sync catalog stock in Location Sync.' });
    return;
  }
  catalogFileDetected.value = false;

  const itemIdx = headers.findIndex(h => h === 'name' || h === 'item' || h === 'product name');
  const skuIdx = headers.findIndex(h => h === 'sku' || h === 'location sku');
  
  const amountIdx = headers.findIndex(h => h === 'amount' || h === 'final amount' || h === 'sold amount' || h === 'net amount' || h.includes('amount'));
  const agedPriceIdx = headers.findIndex(h => h.includes('aged price') || h.includes('sold price') || h.includes('sale price'));
  const agreedPriceIdx = headers.findIndex(h => h.includes('agreed price') || h === 'agreed' || h.includes('price') || h.includes('total'));
  
  const paidIdx = headers.findIndex(h => h === 'paid' || h === 'payout date' || h === 'check date');
  const soldIdx = headers.findIndex(h => isSoldDateHeader(h));
  const dateIdx = headers.findIndex(h => 
    h === 'sold' || 
    h === 'sold date' || 
    h === 'date sold' || 
    h === 'sale date' || 
    h === 'date' || 
    h === 'transaction date' ||
    h === 'paid' || 
    h === 'payout date'
  );
  const statusIdx = headers.findIndex(h => h === 'inventory' || h === 'status');
  const costIdx = headers.findIndex(h => h === 'cost' || h === 'fee' || h === 'cost/split' || h === 'split / cost');
  const splitIdx = headers.findIndex(h => h.includes('consignor %') || h.includes('split') || h.includes('split / cost'));
  const ticketIdx = headers.findIndex(h => isSaleNumberHeader(h));
  const customerIdx = headers.findIndex(h => h.includes('customer') || h.includes('client') || h.includes('buyer'));

  if (itemIdx === -1) {
    addToast({ type: 'error', message: 'Could not find "Name" or "Item" column in MemoryDen CSV.' });
    isProcessing.value = false;
    return;
  }

  detectedRentMap.value = {};
  const rows: any[] = [];

  // Pre-build locked Multi-Qty Booth Bin map (`0EJ0FR` -> `HUCK-1309`, `0EJ0H5` -> `HUCK-1425`, etc.)
  const claimedItemIdToSku = new Map<string, string>();
  const multiBinResolvedBySku = buildLockedMultiBinMap(activeInventory.value, claimedItemIdToSku);

  // Pre-scan pass to detect multi-quantity items by SKU frequency across rows
  const skuCounts = new Map<string, number>();
  for (let i = 1; i < rfcRows.length; i++) {
    const cols = rfcRows[i];
    if (cols.length <= itemIdx) continue;
    const fullItemName = cols[itemIdx]?.trim() || '';
    if (!fullItemName) continue;
    const lowerName = fullItemName.toLowerCase();
    if (lowerName.includes('total for payout') || lowerName.includes('total paid:') || lowerName.includes('space rental') || lowerName.includes('rental') || lowerName.includes('(credit)')) {
      continue;
    }
    let extractedSku = skuIdx !== -1 ? cleanCatalogSku(cols[skuIdx]) : '';
    const trailing = splitTrailingBoothSku(fullItemName);
    let itemName = trailing.sku ? trailing.title : fullItemName;
    if (!extractedSku && trailing.sku) {
      extractedSku = trailing.sku;
    }
    const rawTicket = ticketIdx !== -1 ? (cols[ticketIdx]?.trim() || '') : '';
    const ticketNumber = canonicalTicketNumber(rawTicket) || rawTicket;
    const agreedPriceVal = agreedPriceIdx !== -1 ? parseFloat((cols[agreedPriceIdx] || '').replace(/[^0-9.-]+/g, '')) || 0 : 0;
    const agedPriceVal = agedPriceIdx !== -1 ? parseFloat((cols[agedPriceIdx] || '').replace(/[^0-9.-]+/g, '')) || 0 : 0;
    const grossPrice = agreedPriceVal > 0 ? agreedPriceVal : agedPriceVal;

    extractedSku = resolveMemoryDenSkuFromPayoutRow({
      extractedSku,
      itemName,
      ticketNumber,
      grossPrice
    });

    const skuKey = (extractedSku || itemName).trim().toUpperCase();
    if (skuKey) {
      skuCounts.set(skuKey, (skuCounts.get(skuKey) || 0) + 1);
    }
  }

  // Stateful Stock Capacity Counter initialized to each item's active quantity
  const remainingStockMap = new Map<string, number>();
  inventoryItems.value.forEach(item => {
    const q = Math.max(1, Number(item.quantity || 1));
    remainingStockMap.set(item.$id, q);
  });
  const ticketLineOccurrenceMap = new Map<string, number>();

  for (let i = 1; i < rfcRows.length; i++) {
    const cols = rfcRows[i];
    if (cols.length <= itemIdx) continue;
    
    const fullItemName = cols[itemIdx]?.trim() || '';
    if (!fullItemName) continue;

    const lowerName = fullItemName.toLowerCase();
    const isRentOrCredit = lowerName.includes('space rental') || lowerName.includes('rental') || lowerName.includes('(credit)');
    const isTotalRow = lowerName.includes('total for payout') || lowerName.includes('total paid:');

    if (isTotalRow) continue;

    if (isRentOrCredit) {
      // Extract rent deduction from CSV or fall back to active location's configured monthlyRent
      const configuredLocationRent = Number(activeCanonicalLocationMeta.value.monthlyRent ?? 0);
      let rentAmt = configuredLocationRent;
      for (const col of cols) {
        const val = parseFloat((col || '').replace(/[^0-9.-]+/g, ''));
        if (!isNaN(val) && val < 0) {
          rentAmt = Math.abs(val);
          break;
        }
      }
      // Date from text or cols
      const dateMatch = fullItemName.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
      let rentDate = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : (cols[soldIdx] || cols[paidIdx] || '');
      const cycle = getCycleInfo('', '', rentDate);
      detectedRentMap.value[cycle.id] = rentAmt;
      continue;
    }

    // Summary / empty rows (Total for payout, Total Paid, rows missing Sale / Agreed / Amount) are never sales
    if (isPayoutSummaryRow(fullItemName)) continue;
    if (ticketIdx !== -1 && agreedPriceIdx !== -1 && amountIdx !== -1 &&
        (!(cols[ticketIdx] || '').trim() || !(cols[agreedPriceIdx] || '').trim() || !(cols[amountIdx] || '').trim())) {
      continue;
    }

    const statusVal = statusIdx !== -1 ? cols[statusIdx]?.trim().toLowerCase() : '';
    if (statusVal === 'declined' || statusVal === 'failed' || statusVal === 'void' || statusVal === 'cancelled' || statusVal === 'canceled' || statusVal === 'unsuccessful') {
      continue;
    }
    
    let agreedPriceVal = agreedPriceIdx !== -1 ? parseFloat((cols[agreedPriceIdx] || '').replace(/[^0-9.-]+/g, '')) || 0 : 0;
    let agedPriceVal = agedPriceIdx !== -1 ? parseFloat((cols[agedPriceIdx] || '').replace(/[^0-9.-]+/g, '')) || 0 : 0;
    let grossPrice = Number((agreedPriceVal > 0 ? agreedPriceVal : agedPriceVal).toFixed(2));

    const configuredCommissionPct = Number(activeCanonicalLocationMeta.value.commissionRate ?? activeCanonicalLocationMeta.value.feePct ?? 0);
    let consignorPct = Math.max(0, 100 - configuredCommissionPct); // Derived 100% from active canonical location config
    if (splitIdx !== -1 && cols[splitIdx]) {
      const parsedSplit = parseFloat(cols[splitIdx].replace(/[^0-9.]/g, ''));
      if (parsedSplit > 0 && parsedSplit <= 100) consignorPct = parsedSplit;
    }

    let amountVal = amountIdx !== -1 ? parseFloat((cols[amountIdx] || '').replace(/[^0-9.-]+/g, '')) || 0 : 0;
    let netSoldPrice = 0;
    if (amountVal > 0) {
      netSoldPrice = Number(amountVal.toFixed(2));
    } else if (grossPrice > 0) {
      netSoldPrice = Number((grossPrice * (consignorPct / 100)).toFixed(2));
    }

    const paidDate = paidIdx !== -1 ? (cols[paidIdx]?.trim() || '') : '';
    const soldDate = soldIdx !== -1 ? (cols[soldIdx]?.trim() || '') : '';
    // Never stamp a missing Sold Date with "now" - an empty date is resolved later from the item's soldDate
    const date = soldDate || (dateIdx !== -1 ? cols[dateIdx]?.trim() : '') || '';
    const cycle = getCycleInfo(paidDate, soldDate);

    const rawTicket = ticketIdx !== -1 ? (cols[ticketIdx]?.trim() || '') : '';
    // Canonical numeric ticket id ("T-217301 • Title" / "Ticket #217301" / "217301" -> "217301")
    const ticketNumber = canonicalTicketNumber(rawTicket) || rawTicket;
    const ticketOcc = ticketNumber ? (ticketLineOccurrenceMap.get(ticketNumber) || 0) + 1 : 1;
    if (ticketNumber) ticketLineOccurrenceMap.set(ticketNumber, ticketOcc);
    const customerName = customerIdx !== -1 ? (cols[customerIdx]?.trim() || '') : '';

    // MemoryDen SKU either from explicit SKU column, end of title ("Item Name - 0EJ066"), or pre-verified Oct payout map
    let extractedSku = skuIdx !== -1 ? cleanCatalogSku(cols[skuIdx]) : '';
    let itemName = fullItemName;
    const trailing = splitTrailingBoothSku(fullItemName);
    if (trailing.sku) {
      if (!extractedSku) extractedSku = trailing.sku;
      itemName = trailing.title;
    }
    extractedSku = resolveMemoryDenSkuFromPayoutRow({
      extractedSku,
      itemName,
      ticketNumber,
      grossPrice
    });

    // Strict B&B Consignor namespace check (never match HUCK- or PDXGL- items)
    const isBB = isBbConsignorRow({ sku: extractedSku, title: fullItemName });

    // Matching Logic Priority against all inventory (Verified Dry-Run Matcher + Lineage Absorption Law)
    let matched: any = null;

    // 0. Verified Dry-Run Matcher (handles locked Multi-Qty Booth Bins, trap guards, B&B namespace isolation, and pre-verified UPCs)
    const verifiedMatch = matchMemoryDenInventoryItem({
      sku: extractedSku,
      title: itemName,
      price: grossPrice,
      allowPrefixForPayout: true,
      activeItems: activeInventory.value,
      claimedItemIdToSku,
      multiBinResolvedBySku,
    });
    const normSkuCheck = cleanCatalogSku(extractedSku).toUpperCase();
    const rowClaimKey = normSkuCheck || (itemName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (verifiedMatch) {
      matched = verifiedMatch;
      if (!multiBinResolvedBySku.has(normSkuCheck) && matched.$id) {
        claimedItemIdToSku.set(matched.$id, rowClaimKey);
      }
    }

    // 1. Exact Location SKU match for historical months (with strict B&B namespace isolation)
    if (!matched && extractedSku) {
      const skuCand = pickSkuMatch(extractedSku, itemName);
      if (skuCand && isBbConsignorDbItem(skuCand) === isBB) {
        const deref = dereferenceParentLot(skuCand);
        if (isBbConsignorDbItem(deref) === isBB) {
          matched = deref;
        }
      }
    }

    // 2. Exact UPC match (with strict B&B namespace isolation)
    if (!matched && extractedSku) {
      const upcCand = activeInventory.value.find(item => item.upc === extractedSku && isBbConsignorDbItem(item) === isBB);
      if (upcCand) matched = dereferenceParentLot(upcCand);
    }

    // Helper to get candidate titles for an item (both tagTitle and title)
    const getItemTitles = (itm: any): string[] => {
      const list: string[] = [];
      if (itm.tagTitle) list.push(itm.tagTitle);
      if (itm.title) list.push(itm.title);
      return list;
    };

    // 3. Exact Cleaned Title Match (strictly titleEligibleInventory & matching namespace)
    if (!matched && itemName && !isBB) {
      const cleanName = itemName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const exactCandidates = titleEligibleInventory.value.filter(item => {
        if (isBbConsignorDbItem(item) !== isBB) return false;
        const existingClaim = claimedItemIdToSku.get(item.$id);
        if (existingClaim && existingClaim !== normSkuCheck && existingClaim !== rowClaimKey) return false;
        const titles = getItemTitles(item);
        return titles.some(t => t.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanName);
      });

      if (exactCandidates.length > 0) {
        exactCandidates.sort((a, b) => {
          const remA = remainingStockMap.get(a.$id) ?? 0;
          const remB = remainingStockMap.get(b.$id) ?? 0;
          if (remA > 0 && remB <= 0) return -1;
          if (remB > 0 && remA <= 0) return 1;

          const qtyA = Number(a.quantity || 1);
          const qtyB = Number(b.quantity || 1);
          if (qtyA > 1 && qtyB <= 1) return -1;
          if (qtyB > 1 && qtyA <= 1) return 1;

          const placedA = a.status === 'placed' ? 1 : 0;
          const placedB = b.status === 'placed' ? 1 : 0;
          return placedB - placedA;
        });

        matched = dereferenceParentLot(exactCandidates[0]);
      }
    }

    // 4. Substring Containment Match (strictly titleEligibleInventory & non-BB)
    if (!matched && itemName && !isBB) {
      const cleanName = itemName.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanName.length >= 6) {
        const subCandidates = titleEligibleInventory.value.filter(item => {
          if (isBbConsignorDbItem(item) !== isBB) return false;
          const existingClaim = claimedItemIdToSku.get(item.$id);
          if (existingClaim && existingClaim !== normSkuCheck && existingClaim !== rowClaimKey) return false;
          const titles = getItemTitles(item);
          return titles.some(t => {
            const itemClean = t.toLowerCase().replace(/[^a-z0-9]/g, '');
            return itemClean.includes(cleanName) || cleanName.includes(itemClean);
          });
        });

        if (subCandidates.length > 0) {
          subCandidates.sort((a, b) => {
            const remA = remainingStockMap.get(a.$id) ?? 0;
            const remB = remainingStockMap.get(b.$id) ?? 0;
            if (remA > 0 && remB <= 0) return -1;
            if (remB > 0 && remA <= 0) return 1;

            const qtyA = Number(a.quantity || 1);
            const qtyB = Number(b.quantity || 1);
            if (qtyA > 1 && qtyB <= 1) return -1;
            if (qtyB > 1 && qtyA <= 1) return 1;

            const placedA = a.status === 'placed' ? 1 : 0;
            const placedB = b.status === 'placed' ? 1 : 0;
            return placedB - placedA;
          });

          matched = dereferenceParentLot(subCandidates[0]);
        }
      }
    }

    // 5. Smart Fuzzy Keyword Overlap & Jaccard Matching (Fallback for historical months lacking SKUs; never for B&B or rows with an explicit 0EJ SKU)
    if (!matched && itemName && !isBB && !extractedSku) {
      const csvTokens = new Set(extractKeywords(itemName));
      if (csvTokens.size > 0) {
        const scoredCandidates: { item: any; score: number }[] = [];

        for (const item of titleEligibleInventory.value) {
          if (isBbConsignorDbItem(item) !== isBB) continue;
          if (claimedItemIdToSku.has(item.$id)) continue;
          const combinedText = `${item.tagTitle || ''} ${item.title || ''}`;
          if (!combinedText.trim()) continue;
          const dbTokens = new Set(extractKeywords(combinedText));
          if (dbTokens.size === 0) continue;

          let matchingTokens = 0;
          for (const token of csvTokens) {
            if (dbTokens.has(token)) {
              matchingTokens++;
            }
          }

          if (matchingTokens === 0) continue;

          const minSize = Math.min(csvTokens.size, dbTokens.size);
          const score = matchingTokens / minSize;
          const jaccard = matchingTokens / (csvTokens.size + dbTokens.size - matchingTokens);

          // Threshold: >= 50% overlap and (>= 2 matching words OR 1 distinctive word >= 5 chars)
          if (score >= 0.50 && (matchingTokens >= 2 || (matchingTokens === 1 && [...csvTokens].some(t => dbTokens.has(t) && t.length >= 5)))) {
            const combinedScore = score * 0.6 + jaccard * 0.4;
            scoredCandidates.push({ item, score: combinedScore });
          }
        }

        if (scoredCandidates.length > 0) {
          scoredCandidates.sort((a, b) => {
            if (Math.abs(a.score - b.score) > 0.15) {
              return b.score - a.score;
            }
            const remA = remainingStockMap.get(a.item.$id) ?? 0;
            const remB = remainingStockMap.get(b.item.$id) ?? 0;
            if (remA > 0 && remB <= 0) return -1;
            if (remB > 0 && remA <= 0) return 1;

            const qtyA = Number(a.item.quantity || 1);
            const qtyB = Number(b.item.quantity || 1);
            if (qtyA > 1 && qtyB <= 1) return -1;
            if (qtyB > 1 && qtyA <= 1) return 1;

            const placedA = a.item.status === 'placed' ? 1 : 0;
            const placedB = b.item.status === 'placed' ? 1 : 0;
            if (placedB !== placedA) return placedB - placedA;

            return b.score - a.score;
          });

          matched = dereferenceParentLot(scoredCandidates[0].item);
        }
      }
    }

    // Decrement capacity counter in remainingStockMap for the matched item
    if (matched) {
      const curStock = remainingStockMap.get(matched.$id) ?? Math.max(1, Number(matched.quantity || 1));
      remainingStockMap.set(matched.$id, curStock - 1);
    }

    // 6. Sub-Client B&B Auto-Mapping (PDXGL Consignor - strict namespace isolation, cost: 0)
    if (!matched && isBB) {
      const bbCode = extractedSku || String(i).padStart(4, '0');
      matched = {
        $id: `subclient_bb_${bbCode}`,
        title: itemName,
        upc: `BB-${bbCode}`,
        locationSku: extractedSku || undefined,
        price: grossPrice,
        resalePrice: grossPrice,
        cost: 0,
        quantity: 1,
        storageLocation: 'MD',
        isSubClient: true,
        subClientName: 'B&B Consignment',
        parentPartner: 'PDXGL-'
      };
    }

    const normSku = cleanCatalogSku(extractedSku || matched?.locationSku).toUpperCase();
    const isPreverifiedMultiBin = !!(normSku && PREVERIFIED_MD_MULTI_QTY_BINS[normSku]);
    const skuKey = (extractedSku || fullItemName).trim().toUpperCase();
    const repeatCount = skuCounts.get(skuKey) || 1;
    const isMultiCandidate = repeatCount > 1;
    const isItemMulti = !!(isPreverifiedMultiBin || matched?.isMultiQty || (matched?.quantity && Number(matched.quantity) > 1));
    const isMultiQty = isItemMulti || isMultiCandidate;

    rows.push({
      date,
      soldDate,
      paidDate,
      cycleId: cycle.id,
      cycleLabel: cycle.label,
      itemName: itemName,
      extractedSku,
      ticketNumber,
      ticketOccurrence: ticketOcc,
      customerName,
      status: statusVal,
      listedPrice: grossPrice,
      salePrice: netSoldPrice,
      netSoldPrice: netSoldPrice,
      mappedItem: matched || null,
      isSubClient: isBB || !!matched?.isSubClient,
      subClientName: isBB ? 'B&B Consignment' : (matched?.subClientName || null),
      parentPartner: isBB ? 'PDXGL-' : (matched?.parentPartner || null),
      isMultiQtyCandidate: isMultiCandidate,
      repeatCount: repeatCount,
      isMultiQty: isMultiQty || ticketOcc > 1
    });
  }

  // Build Payout Cycles list
  const configuredDefaultRent = Number(activeCanonicalLocationMeta.value.monthlyRent ?? 0);
  const cycleMap = new Map<string, PayoutCycle>();
  for (const r of rows) {
    if (!cycleMap.has(r.cycleId)) {
      cycleMap.set(r.cycleId, {
        id: r.cycleId,
        label: r.cycleLabel,
        paidDate: r.paidDate,
        gross: 0,
        netStore: 0,
        itemCount: 0,
        spaceRental: detectedRentMap.value[r.cycleId] !== undefined ? detectedRentMap.value[r.cycleId] : configuredDefaultRent,
        expectedCheck: 0
      });
    }
    const c = cycleMap.get(r.cycleId)!;
    c.gross = Number((c.gross + (r.listedPrice || 0)).toFixed(2));
    c.netStore = Number((c.netStore + (r.salePrice || 0)).toFixed(2));
    c.itemCount++;
  }

  for (const c of cycleMap.values()) {
    c.expectedCheck = Number((c.netStore - c.spaceRental).toFixed(2));
  }

  payoutCycles.value = Array.from(cycleMap.values())
    .filter(c => c.itemCount > 0)
    .sort((a, b) => b.id.localeCompare(a.id));
  if (payoutCycles.value.length > 0) {
    // Select the single most recent month by default, so the user sees JUST that month!
    selectedCycle.value = payoutCycles.value[0].id;
  }

  parsedRows.value = rows;
  recomputePayoutCycles();
  saveStagingSession();
  isProcessing.value = false;
  hideLoader();
  addToast({ 
    type: 'success', 
    message: `Parsed ${rows.length} sales rows across ${payoutCycles.value.length} payout cycles!` 
  });
  // Cumulative CSV idempotency: flag rows already recorded in the sales ledger (non-blocking)
  void refreshAlreadyRecordedFlags();
};
handleRicochetCsvFallback = parseMemoryDenPayout;

// Occurrence-indexed fingerprint guard (`saleNumber|soldDateIso|gross#occurrence`) against resale_db.sales.
// Rows already recorded are flagged `isAlreadyRecorded` and are never committed or used to decrement stock again.
const salesRowAccessors = {
  getSaleNumber: (r: any) => r.ticketNumber,
  getSoldDate: (r: any) => r.soldDate || r.date,
  getGross: (r: any) => r.listedPrice,
  getSku: (r: any) => r.extractedSku,
  getTitle: (r: any) => r.itemName
};
const refreshAlreadyRecordedFlags = async () => {
  try {
    if (!activeTeamId.value || parsedRows.value.length === 0) return;
    const existing = await salesApi.listSales(activeTeamId.value);
    const { recordedCount, newCount } = flagAlreadyRecordedRows(parsedRows.value, existing || [], salesRowAccessors);
    parsedRows.value = [...parsedRows.value];
    if (recordedCount > 0) {
      addToast({ type: 'info', message: `✅ ${recordedCount} row(s) already recorded (skipped). ${newCount} new.` });
    }
  } catch (e) {
    console.warn('[SalesImporter] Could not flag already-recorded rows:', e);
  }
};

const executeImport = async () => {
  const rowsToImport = cycleFilteredRows.value;
  if (rowsToImport.length === 0) {
    addToast({ type: 'warning', message: 'No sales rows to commit in the selected view.' });
    return;
  }
  
  isImporting.value = true;
  showLoader("Committing Matched Sales to Inventory...", {
    step: `Recording ${rowsToImport.length} sales into Appwrite database...`,
    progress: 5,
    cancelable: false
  });

  let importedCount = 0;
  const importedRowRefs = new Set();

  try {
    const ITEMS_COL = getCollectionId();
    const activeCode = activeCanonicalLocationMeta.value.code;
    const activeWhId = activeCanonicalLocationMeta.value.id || MD_CANONICAL_WAREHOUSE_ID;
    const batchId = `${activeCode}-PAYOUT-` + new Date().toISOString().slice(0, 10);

    // Resolve active warehouse ID dynamically from Location Settings
    let mdWarehouseId = activeWhId;
    try {
      if (activeTeamId.value) {
        const warehouses = await warehousesApi.listWarehouses(activeTeamId.value);
        const matchedMeta = getLocationSettingMeta(activeCode, warehouses);
        mdWarehouseId = matchedMeta?.id || activeWhId;
      }
    } catch (whErr) {
      console.warn("[SalesImporter] Could not list warehouses:", whErr);
    }

    // Pre-fetch existing sales to prevent duplicate sales creation on re-import (Anti-Duplication Invariant)
    let existingTicketSet = new Set<string>();
    let existingSoldSkuSet = new Set<string>();
    let existingSalesList: any[] = [];
    try {
      if (activeTeamId.value) {
        const existingSales = await salesApi.listSales(activeTeamId.value);
        existingSalesList = existingSales || [];
        existingTicketSet = new Set(existingSales.map(s => s.orderId).filter(Boolean) as string[]);
        existingSales.forEach(s => {
          if (s.soNumber) existingSoldSkuSet.add(s.soNumber.trim().toUpperCase());
          if (s.orderId) existingSoldSkuSet.add(s.orderId.trim().toUpperCase());
        });
      }
    } catch (e) {
      console.warn("[SalesImporter] Could not pre-fetch sales for duplicate check:", e);
    }

    // Occurrence-indexed idempotency: re-flag against the freshest sales ledger right before committing
    // Occurrence indices are computed across the WHOLE file (not just the matched subset) so ticket #N copies stay aligned
    flagAlreadyRecordedRows(parsedRows.value, existingSalesList, salesRowAccessors);
    let skippedAlreadyRecorded = 0;

    // Count verified sales planned per item in this import batch (already-recorded rows never count - they must not decrement stock)
    const salesPerItemCount = new Map<string, number>();
    rowsToImport.forEach(r => {
      if (r.isAlreadyRecorded) return;
      const itm = r.mappedItem;
      if (itm?.$id && !itm.$id.startsWith('subclient_')) {
        salesPerItemCount.set(itm.$id, (salesPerItemCount.get(itm.$id) || 0) + 1);
      }
    });

    const updatedItemIds = new Set<string>();
    const createdSubClientBySku = new Map<string, any>();

    for (let idx = 0; idx < rowsToImport.length; idx++) {
      const row = rowsToImport[idx];
      const pct = Math.round(((idx + 1) / rowsToImport.length) * 100);
      updateLoader(undefined, `Saving sale ${idx + 1} of ${rowsToImport.length}: ${(row.itemName || '').slice(0, 32)}...`, pct);

      // ✅ Already Recorded (Skipped): never create a sale or touch stock/status; just clear it from staging
      if (row.isAlreadyRecorded) {
        skippedAlreadyRecorded++;
        importedRowRefs.add(row);
        continue;
      }

      try {
        let item = row.mappedItem;
        if (!item) {
          const fallbackSku = cleanCatalogSku(row.extractedSku).toUpperCase();
          const fallbackUpc = (fallbackSku && PREVERIFIED_MD_SKU_TO_UPC_OR_ID[fallbackSku]) || fallbackSku || '';
          item = {
            $id: '',
            title: row.itemName || 'Memory Den Sale',
            upc: fallbackUpc,
            locationSku: fallbackSku || undefined,
            tenantId: activeTeamId.value,
            isSubClient: Boolean(row.isSubClient),
          };
        }

        const isSoldOrPaid = row.status === 'sold' || row.status === 'paid' || true;
        const occNum = Math.max(Number(row.ticketOccurrence || 1), Number((row as any).occurrenceIndex || 1));
        const formattedTicketRef = row.ticketNumber
          ? (occNum > 1 ? `Ticket #${row.ticketNumber} #${occNum}` : `Ticket #${row.ticketNumber}`)
          : '';
        const orderRef = formattedTicketRef || row.extractedSku || batchId;

        // Cardinal Resale Invariant: Every line in a Ricochet Payouts *.csv is a real register sale.
        // Deduplication relies strictly on occurrence-indexed `row.isAlreadyRecorded` (`flagAlreadyRecordedRows`),
        // NEVER on `existingSoldSkuSet` or `item.status === 'sold'`, so 2nd/3rd/4th lines on the same ticket (e.g. Ticket #225210 x2) are never dropped!
        const normRowSku = cleanCatalogSku(row.extractedSku || item.locationSku).toUpperCase();
        const binConfig = normRowSku ? PREVERIFIED_MD_MULTI_QTY_BINS[normRowSku] : undefined;
        const isMultiQty = !!(binConfig || item.isMultiQty || (item.quantity && item.quantity > 1) || occNum > 1);

        if (row.isAlreadyRecorded) {
          importedCount++;
          importedRowRefs.add(row);
          continue;
        }

        // If it's an auto-detected sub-client item (like B&B) not yet persisted, create it with valid Appwrite attributes
        if (item.isSubClient && (!item.$createdAt)) {
          const bbSkuCacheKey = normRowSku || item.upc || row.itemName;
          if (bbSkuCacheKey && createdSubClientBySku.has(bbSkuCacheKey)) {
            item = createdSubClientBySku.get(bbSkuCacheKey);
            row.mappedItem = item;
          } else {
            try {
              const subDoc: Record<string, any> = {
                title: item.title || row.itemName || 'Consignment Item',
                status: 'sold',
                cost: 0,
                quantity: 1,
                storageLocation: activeCode,
                warehouseId: mdWarehouseId || activeWhId,
                resalePrice: Number(row.listedPrice || row.salePrice || 0),
                soldPrice: Number(row.salePrice || 0)
              };
              if (activeTeamId.value) subDoc.tenantId = activeTeamId.value;
              if (item.upc) subDoc.upc = item.upc;
              if (row.extractedSku || item.locationSku) subDoc.locationSku = cleanCatalogSku(row.extractedSku || item.locationSku);

              const createdDoc = await databases.createDocument(DB_ID, ITEMS_COL, ID.unique(), subDoc);
              item = createdDoc;
              row.mappedItem = createdDoc;
              if (bbSkuCacheKey) createdSubClientBySku.set(bbSkuCacheKey, createdDoc);
            } catch (subErr) {
              console.warn("Sub-client item creation skipped:", subErr);
            }
          }
        }

        const updatePayload: Record<string, any> = {
          locationSku: cleanCatalogSku(row.extractedSku || item.locationSku) || undefined
        };

        if (isSoldOrPaid) {
          updatePayload.status = 'sold';
          updatePayload.resalePrice = Number(row.listedPrice || row.salePrice || 0);
          updatePayload.soldPrice = Number(row.salePrice || 0);
          updatePayload.saleId = orderRef;

          // Create official Sale record
          try {
            const gross = Number(row.listedPrice || row.salePrice) || 0;
            const net = Number(row.salePrice) || 0;
            const fee = Math.max(0, Number((gross - net).toFixed(2)));

            // Real register date first (CSV row, then the item's own soldDate); "now" is only a last resort
            let parsedSaleDate = new Date().toISOString();
            const rowOrItemDate = row.date || item.soldDate;
            if (rowOrItemDate) {
              const rawDate = String(rowOrItemDate).trim();
              const d = new Date(rawDate);
              if (!isNaN(d.getTime())) {
                parsedSaleDate = d.toISOString();
              } else {
                const parts = rawDate.split(/[-/]/);
                if (parts.length === 3 && parts[2].length === 4) {
                  const testD = new Date(`${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
                  if (!isNaN(testD.getTime())) parsedSaleDate = testD.toISOString();
                }
              }
            }

            // Date-only payouts (Format B "MM-DD-YYYY") become noon local; timestamped ones keep their time
            const libIso = toSaleIso(rowOrItemDate);
            if (libIso) parsedSaleDate = libIso;

            const newSale = await salesApi.createSale({
              tenantId: item.tenantId || activeTeamId.value,
              warehouseId: mdWarehouseId || MD_CANONICAL_WAREHOUSE_ID,
              soNumber: item.upc || cleanCatalogSku(row.extractedSku || item.locationSku) || `SO-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
              orderId: formattedTicketRef || cleanCatalogSku(row.extractedSku || item.locationSku) || orderRef,
              saleDate: parsedSaleDate,
              grossAmount: gross,
              commissionFee: fee,
              netPayout: net,
              shippingCharged: 0,
              shippingCost: 0,
              status: 'Sold'
            });
            updatePayload.saleId = newSale.$id;
          } catch (saleErr) {
            console.warn("Sale creation failed, setting fallback saleId:", saleErr);
          }
        }

        // Update the item in Appwrite (Appwrite Schema Safe)
        // Partial vs. Full Multi-Quantity Depletion Law + Verified Multi-Qty Booth Bin Guard
        if (item.$id && !item.$id.startsWith('subclient_') && !updatedItemIds.has(item.$id)) {
          updatedItemIds.add(item.$id);
          const K = salesPerItemCount.get(item.$id) || 1;
          const N = Math.max(1, Number(item.quantity || 1));
          const isMulti = !!(binConfig || item.isMultiQty || N > 1 || row.isMultiQty);

          if (binConfig) {
            // Verified Active Multi-Qty Booth Bin (e.g. 0EJ0H5 Frank Frazetta qty=3, 0EJ0FR HMM Reader qty=12):
            // Always stay `status: 'placed'` at active booth with `quantity >= 1`, never overwrite parent Booth Bin `saleId` or mark `sold`!
            const targetQty = Math.max(1, binConfig.expectedRemainingQty);
            const lotPayload: Record<string, any> = {
              status: 'placed',
              storageLocation: activeCode,
              warehouseId: mdWarehouseId || activeWhId,
              quantity: targetQty
            };
            if (row.extractedSku || item.locationSku) {
              lotPayload.locationSku = cleanCatalogSku(row.extractedSku || item.locationSku);
            }
            await databases.updateDocument(DB_ID, ITEMS_COL, item.$id, lotPayload);
            item.status = 'placed';
            item.storageLocation = activeCode;
            item.warehouseId = mdWarehouseId || activeWhId;
            item.quantity = targetQty;
          } else if (isMulti && K < N) {
            // Partial Depletion Law (K < N):
            // e.g. 4 sold out of 9: quantity becomes 5, status stays 'placed' (or 'in-stock')!
            const remainingQty = Math.max(1, N - K);
            const totalCost = Number(item.cost || 0);
            const unitCost = N > 0 ? (totalCost / N) : 0;
            const remainingCost = Math.max(0, Number((totalCost - (unitCost * K)).toFixed(2)));

            const lotPayload: Record<string, any> = {
              quantity: remainingQty,
              cost: remainingCost,
              status: item.status === 'placed' ? 'placed' : 'in-stock',
              storageLocation: activeCode,
              warehouseId: mdWarehouseId || activeWhId
            };
            if (row.extractedSku || item.locationSku) {
              lotPayload.locationSku = cleanCatalogSku(row.extractedSku || item.locationSku);
            }
            await databases.updateDocument(DB_ID, ITEMS_COL, item.$id, lotPayload);
            item.quantity = remainingQty;
            item.cost = remainingCost;
          } else {
            // Full Depletion Law (K >= N or single-unit item):
            const lotPayload: Record<string, any> = {
              status: 'sold',
              storageLocation: activeCode,
              warehouseId: mdWarehouseId || activeWhId,
              quantity: 1, // Appwrite constraint: quantity >= 1 (never 0)
              resalePrice: Number(row.listedPrice || row.salePrice || 0),
              soldPrice: Number(row.salePrice || 0),
              saleId: updatePayload.saleId || orderRef
            };
            if (row.extractedSku || item.locationSku) {
              lotPayload.locationSku = cleanCatalogSku(row.extractedSku || item.locationSku);
            }
            await databases.updateDocument(DB_ID, ITEMS_COL, item.$id, lotPayload);
            item.status = 'sold';
            item.storageLocation = activeCode;
            item.warehouseId = mdWarehouseId || activeWhId;
            item.quantity = 1;
            item.soldPrice = Number(row.salePrice || 0);
          }
        }

        importedCount++;
        importedRowRefs.add(row);
      } catch (rowErr) {
        console.error("Failed to commit individual row:", row, rowErr);
      }
    }

    if (importedCount > 0) {
      addToast({ 
        type: 'success', 
        message: `Successfully imported ${importedCount} matched sales!${skippedAlreadyRecorded > 0 ? ` (${skippedAlreadyRecorded} already recorded, skipped)` : ''}` 
      });

      // Capture receipt for owner-operator summary before altering parsedRows
      lastCommittedReceipt.value = {
        cycleLabel: currentCycleInfo.value.label,
        cycleId: selectedCycle.value,
        timestamp: new Date().toLocaleDateString('en-US', { 
          month: 'short', day: 'numeric', year: 'numeric', 
          hour: 'numeric', minute: '2-digit' 
        }),
        itemCount: importedCount,
        gross: selectedCycleFinancials.value.gross,
        mallFee: selectedCycleFinancials.value.mallFee,
        rent: selectedCycleFinancials.value.rent,
        netCheck: selectedCycleFinancials.value.netCheck,
        partnerSettlements: JSON.parse(JSON.stringify(partnerSettlements.value)),
        settlementSummary: JSON.parse(JSON.stringify(settlementSummary.value))
      };

      // Save completed settlement receipt into persistent history
      saveReceiptToHistory(lastCommittedReceipt.value);

      // Remove imported rows from parsedRows so user clearly sees committed items leave the staging queue
      parsedRows.value = parsedRows.value.filter(r => !importedRowRefs.has(r));

      // Re-evaluate remaining payoutCycles and persist to localStorage
      recomputePayoutCycles();
      saveStagingSession();

      if (parsedRows.value.length > 0) {
        addToast({
          type: 'info',
          message: `${parsedRows.value.length} items remain across other cycles.`
        });
      }

      // Refresh inventory
      if (activeTeamId.value) {
        fetchInventory(activeTeamId.value);
      }
    } else if (skippedAlreadyRecorded > 0) {
      addToast({ type: 'info', message: `✅ All ${skippedAlreadyRecorded} selected row(s) were already recorded - nothing new to import.` });
      parsedRows.value = parsedRows.value.filter(r => !importedRowRefs.has(r));
      recomputePayoutCycles();
      saveStagingSession();
    } else {
      addToast({ type: 'warning', message: 'No items could be imported. Please verify your items.' });
    }
  } catch (err: any) {
    console.error("Sales Import Failed:", err);
    addToast({ type: 'error', message: 'Failed to process sales: ' + (err?.message || err) });
  } finally {
    isImporting.value = false;
    hideLoader();
  }
};
</script>
