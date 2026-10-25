<template>
  <div class="card bg-base-100 shadow-sm border border-base-200 w-full">
    <div class="card-body p-4 sm:p-6 lg:p-8">
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

        <div class="flex items-center gap-2">
          <button 
            v-if="reconciliationHistory.length > 0"
            class="btn btn-sm btn-outline gap-1.5 rounded-xl font-bold"
            @click="isHistoryModalOpen = true"
          >
            <Icon icon="solar:history-bold" class="w-4 h-4 text-primary" />
            <span>Past Reconciliations ({{ reconciliationHistory.length }})</span>
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
                  Memory Den (Booth 0EJ) &bull; Items marked as <strong class="text-success">Sold</strong>, stock updated, and co-op payouts reconciled.
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
            <div class="text-[11px] font-bold uppercase tracking-wider text-base-content/60">Mall Commission (15%)</div>
            <div class="text-2xl font-black font-mono text-error mt-1">-${{ lastCommittedReceipt.mallFee.toFixed(2) }}</div>
            <div class="text-[11px] text-base-content/60 mt-0.5">Retained by Memory Den</div>
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
                How fixed booth rent ($382.50) was covered between members and consignors.
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
              <span class="text-[10px] opacity-60 block mt-0.5">$382.50 minus B&amp;B offset</span>
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

      <!-- Step 1: Upload (shown only when no receipt AND no parsed rows) -->
      <div v-else-if="!parsedRows.length" class="flex flex-col items-center justify-center p-12 border-2 border-dashed border-base-300 rounded-xl bg-base-200/50 hover:bg-base-200 transition-colors">
        <Icon icon="solar:upload-minimalistic-linear" class="w-12 h-12 opacity-50 mb-4" />
        <h3 class="font-bold text-lg mb-2">Upload Sales CSV</h3>
        
        <div class="form-control w-full max-w-xs mb-4">
          <label class="label"><span class="label-text">Select Platform</span></label>
          <select class="select select-bordered" v-model="platform">
            <option value="memoryden">MemoryDen Payout</option>
            <option value="ebay">eBay Orders (Soon)</option>
            <option value="generic">Generic CSV (Soon)</option>
          </select>
        </div>

        <input 
          type="file" 
          accept=".csv,text/csv,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx,.xls,*/*" 
          class="file-input file-input-bordered file-input-primary w-full max-w-xs" 
          @change="handleFileUpload" 
          :disabled="isProcessing || platform !== 'memoryden'"
        />

        <div class="divider text-xs opacity-60 my-3 w-full max-w-xs">OR</div>

        <button 
          type="button"
          class="btn btn-outline btn-sm gap-2 rounded-xl" 
          :disabled="isProcessing"
          @click="loadDefaultPayoutFile"
        >
          <Icon icon="solar:folder-with-files-bold" class="w-4 h-4 text-primary" />
          <span>Load Memory Den Full Payout (Multi-Month)</span>
        </button>
      </div>

      <!-- Step 2: Reconciliation & Settlement UI -->
      <div v-else>
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
              <span class="text-[11px] opacity-60 block uppercase font-medium">2. Venue Fee (15%)</span>
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
                  <th class="min-w-64">Map to ResaleCommand Item</th>
                  <th class="w-20 text-center">Drawer</th>
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
                        <span>SKU: {{ row.extractedSku || 'N/A' }}</span>
                      </span>
                      <span v-if="row.ticketNumber" class="badge badge-xs badge-info font-mono font-bold">
                        🎟️ Ticket #{{ row.ticketNumber }}
                      </span>
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
                  <td @click.stop>
                    <div v-if="row.mappedItem" class="flex items-center gap-2">
                      <span class="badge badge-sm badge-outline font-mono font-bold">{{ row.mappedItem.upc || 'NO UPC' }}</span>
                      <span class="truncate max-w-50 text-sm">{{ row.mappedItem.title }}</span>
                      <button class="btn btn-xs btn-ghost text-error ml-auto" @click="row.mappedItem = null">✕</button>
                    </div>
                    <div v-else class="flex items-center gap-1.5">
                      <select class="select select-bordered select-xs w-full max-w-xs font-mono text-xs" v-model="row.mappedItem">
                        <option :value="null">Search active inventory...</option>
                        <option v-for="item in availableItems" :key="item.$id" :value="item">
                          {{ item.upc ? `[${item.upc}] ` : '' }}{{ item.title }}
                        </option>
                      </select>
                      <button 
                        class="btn btn-xs btn-primary font-bold shrink-0 gap-1"
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
                  <td class="text-center" @click.stop>
                    <button 
                      class="btn btn-xs btn-outline btn-primary gap-1 font-bold rounded-lg"
                      @click="openMatcherDrawer(row)"
                      title="Open Item Matcher Drawer"
                    >
                      <Icon icon="solar:pen-new-square-bold" class="w-3.5 h-3.5" />
                      <span>{{ row.mappedItem ? 'Edit' : 'Match' }}</span>
                    </button>
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
          <!-- Memory Den Mall Reconciliation Hero Banner -->
          <div class="card bg-gradient-to-br from-base-200/90 to-base-300/80 border border-base-300 shadow-md p-5">
            <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-base-content/10 pb-4 mb-4">
              <div>
                <div class="flex items-center gap-2">
                  <span class="badge badge-primary font-bold">Booth 0EJ</span>
                  <h3 class="font-black text-xl text-base-content">Memory Den Statement — {{ currentCycleInfo.label }}</h3>
                </div>
                <p class="text-xs text-base-content/70 mt-1">
                  Reconciled against Memory Den monthly register payout statements and physical checks.
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
                <span class="opacity-60 block">2. Mall Commission (15%):</span>
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
                  :class="{'tab-active !bg-primary !text-primary-content': drawerSubTab === 'create'}" 
                  @click="drawerSubTab = 'create'"
                >
                  <Icon icon="solar:add-circle-bold" class="w-4 h-4 mr-1.5 inline" />
                  <span>Create As Sold Item</span>
                </a>
                <a 
                  class="tab text-xs font-bold flex-1" 
                  :class="{'tab-active !bg-primary !text-primary-content': drawerSubTab === 'search'}" 
                  @click="drawerSubTab = 'search'"
                >
                  <Icon icon="solar:magnifer-linear" class="w-4 h-4 mr-1.5 inline" />
                  <span>Search Catalog ({{ availableItems.length }})</span>
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

              <!-- TAB 2: SEARCH CATALOG -->
              <div v-show="drawerSubTab === 'search'" class="card bg-base-100 border border-base-300 p-4 rounded-2xl space-y-3 shadow-xs">
                <h5 class="font-bold text-sm text-base-content flex items-center justify-between">
                  <span class="flex items-center gap-1.5">
                    <Icon icon="solar:magnifer-linear" class="w-4 h-4 text-primary" />
                    <span>Select from Existing Active Items</span>
                  </span>
                  <span class="badge badge-sm badge-ghost font-mono">{{ availableItems.length }} unmapped</span>
                </h5>

                <div class="relative">
                  <Icon icon="solar:magnifer-linear" class="absolute left-3 top-2.5 w-4 h-4 opacity-50" />
                  <input 
                    type="text" 
                    v-model="drawerSearchQuery" 
                    class="input input-sm input-bordered w-full pl-9 text-xs rounded-xl" 
                    placeholder="Filter by title, UPC, or SKU..."
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

                <div class="max-h-80 overflow-y-auto space-y-1.5 pr-1">
                  <div 
                    v-for="item in filteredCandidateItems" 
                    :key="item.$id"
                    class="p-2.5 rounded-xl border border-base-200 hover:border-primary/50 hover:bg-base-200/50 transition-colors flex items-center justify-between gap-2 text-xs"
                  >
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="badge badge-xs badge-outline font-mono font-bold">{{ item.upc || 'NO UPC' }}</span>
                        <span class="font-bold truncate text-base-content">{{ item.title }}</span>
                      </div>
                      <div class="text-[11px] opacity-60 font-mono mt-0.5 flex items-center gap-2">
                        <span>Listed: ${{ (item.resalePrice || 0).toFixed(2) }}</span>
                        <span>Cost: ${{ getItemCost(item).toFixed(2) }}</span>
                        <span v-if="item.storageLocation">Loc: {{ item.storageLocation }}</span>
                      </div>
                    </div>
                    <button 
                      type="button"
                      class="btn btn-xs btn-primary font-bold shrink-0 gap-1 rounded-lg"
                      @click="linkItemToActiveRow(item)"
                    >
                      <Icon icon="solar:link-bold" class="w-3 h-3" />
                      <span>Link</span>
                    </button>
                  </div>

                  <div v-if="filteredCandidateItems.length === 0" class="text-center py-6 text-xs text-base-content/60">
                    No matching items found. Switch to "Create As Sold Item" to mint a new barcode!
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
import { getCollectionId, DB_ID, normalizeOrgPrefix } from '../../lib/inventory';
import { salesApi } from '../../lib/sales';
import { warehousesApi } from '../../lib/warehouses';
import { generatePartnerSettlementPdf } from '../../lib/coopSettlementPdf';
import BottomActionDock from '../common/BottomActionDock.vue';
import { generateNextUpc } from '../../lib/upcAuthority';

const { user, currentTeam: team } = useAuth();
const { inventoryItems, fetchInventory } = useInventory();
const { showLoader, updateLoader, hideLoader } = useLoader();
const isProcessing = ref(false);
const isImporting = ref(false);
const platform = ref('memoryden');
const activeView = ref('matching'); // 'matching' | 'settlement'
const filterTab = ref('all'); // 'all' | 'matched' | 'unmatched'
const parsedRows = ref<any[]>([]);
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

const STAGING_STORAGE_KEY = 'rc_sales_importer_staging_v1';
const RECEIPTS_STORAGE_KEY = 'rc_sales_reconciliation_history_v1';

const saveStagingSession = () => {
  if (typeof window === 'undefined') return;
  try {
    if (parsedRows.value.length === 0) {
      localStorage.removeItem(STAGING_STORAGE_KEY);
      return;
    }
    const sessionData = {
      tenantId: activeTeamId.value,
      fileName: activeFileName.value || 'Memory Den Payout CSV',
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
    localStorage.setItem(STAGING_STORAGE_KEY, JSON.stringify(sessionData));
  } catch (err) {
    console.warn("Failed to auto-save staging session to localStorage:", err);
  }
};

const recomputePayoutCycles = () => {
  const cycleMap = new Map<string, PayoutCycle>();
  for (const r of parsedRows.value) {
    if (!cycleMap.has(r.cycleId)) {
      cycleMap.set(r.cycleId, {
        id: r.cycleId,
        label: r.cycleLabel,
        paidDate: r.paidDate,
        gross: 0,
        netStore: 0,
        itemCount: 0,
        spaceRental: detectedRentMap.value[r.cycleId] || 382.50,
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
    const raw = localStorage.getItem(STAGING_STORAGE_KEY);
    if (!raw) return;
    const sessionData = JSON.parse(raw);
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
      detectedRentMap.value = sessionData.detectedRentMap || {};
      payoutCycles.value = sessionData.payoutCycles || [];
      selectedCycle.value = sessionData.selectedCycle || (payoutCycles.value[0]?.id || 'ALL');
      activeView.value = sessionData.activeView || 'matching';
      activeFileName.value = sessionData.fileName || 'Memory Den Payout CSV';
      hasRestoredSession.value = true;
      if (payoutCycles.value.length === 0) {
        recomputePayoutCycles();
      }
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

// Slide-Over Item Matcher Drawer State
const isMatcherDrawerOpen = ref(false);
const activeDrawerRowIndex = ref<number>(-1);
const drawerSubTab = ref<'create' | 'search'>('create');
const drawerSearchQuery = ref('');
const isDrawerSaving = ref(false);
const drawerForm = ref({
  title: '',
  prefix: 'HUCK',
  cost: 0,
  resalePrice: 0,
  soldPrice: 0,
  storageLocation: 'MD',
  isMultiQty: false
});

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
    storageLocation: 'MD',
    isMultiQty: !!(row.isMultiQty || row.isMultiQtyCandidate || row.mappedItem?.isMultiQty || (row.mappedItem?.quantity && row.mappedItem.quantity > 1))
  };
  drawerSearchQuery.value = '';
  drawerSubTab.value = row.mappedItem ? 'search' : 'create';
};

const openMatcherDrawer = (row: any) => {
  const idx = displayedRows.value.indexOf(row);
  activeDrawerRowIndex.value = idx >= 0 ? idx : 0;
  populateDrawerForm(row);
  isMatcherDrawerOpen.value = true;
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

const filteredCandidateItems = computed(() => {
  if (!drawerSearchQuery.value.trim()) {
    return availableItems.value.slice(0, 20);
  }
  const q = drawerSearchQuery.value.toLowerCase().trim();
  return availableItems.value.filter(item => {
    return (item.title || '').toLowerCase().includes(q) ||
           (item.upc || '').toLowerCase().includes(q) ||
           (item.locationSku || '').toLowerCase().includes(q);
  }).slice(0, 30);
});

const linkItemToActiveRow = (item: any) => {
  if (!activeDrawerRow.value) return;
  activeDrawerRow.value.mappedItem = item;
  saveStagingSession();
  addToast({ type: 'success', message: `Linked [${item.upc || 'ITEM'}] to sale!` });
};

const unlinkActiveRow = () => {
  if (!activeDrawerRow.value) return;
  activeDrawerRow.value.mappedItem = null;
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
      storageLocation: drawerForm.value.storageLocation || 'MD',
      quantity: isMulti ? Math.max(2, row.repeatCount || 2) : 1
    };
    if (activeTeamId.value) doc.tenantId = activeTeamId.value;

    const createdDoc = await databases.createDocument(DB_ID, ITEMS_COL, ID.unique(), doc);
    createdDoc.isMultiQty = isMulti;
    createdDoc.quantity = isMulti ? Math.max(2, row.repeatCount || 2) : 1;
    row.mappedItem = createdDoc;
    row.isMultiQty = isMulti;
    inventoryItems.value.push(createdDoc);

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

const activeTeamId = computed(() => {
  return team.value?.$id || (typeof window !== 'undefined' ? localStorage.getItem('activeTeamId') : '') || '';
});

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
  if (inventoryItems.value.length === 0) {
    fetchInventory(activeTeamId.value || undefined);
  }
  loadReceiptHistory();
  restoreStagingSession();

  // If no session in localStorage, auto-load stored multi-month payout CSV so the user is never stuck on blank screen
  if (parsedRows.value.length === 0) {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STAGING_STORAGE_KEY) : null;
    if (!raw) {
      await loadDefaultPayoutFile();
    }
  }
});

const activeInventory = computed(() => {
  return inventoryItems.value;
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
  const mappedSingleUnitIds = new Set(
    cycleFilteredRows.value
      .filter(r => r.mappedItem && !r.isMultiQty && !r.mappedItem.isMultiQty && !(r.mappedItem.quantity > 1))
      .map(r => r.mappedItem.$id)
  );
  return activeInventory.value.filter(i => !mappedSingleUnitIds.has(i.$id));
});

const matchedCount = computed(() => cycleFilteredRows.value.filter(r => r.mappedItem).length);
const unmatchedCount = computed(() => cycleFilteredRows.value.filter(r => !r.mappedItem).length);

const currentCycleInfo = computed(() => {
  if (selectedCycle.value === 'ALL') {
    const totalRent = payoutCycles.value.reduce((sum, c) => sum + (c.spaceRental || 382.50), 0) || (382.50 * Math.max(1, payoutCycles.value.length));
    const totalCheck = payoutCycles.value.reduce((sum, c) => sum + c.expectedCheck, 0);
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
    spaceRental: c?.spaceRental || 382.50,
    checkCount: 1,
    isMultiCycle: false,
    paidDate: c?.paidDate,
    expectedCheck: c?.expectedCheck || 0
  };
});

const totalAllChecks = computed(() => {
  return payoutCycles.value.reduce((sum, c) => sum + (c.expectedCheck || 0), 0);
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
  selectedCycle.value = '';
  activeView.value = 'matching';
  lastCommittedReceipt.value = null;
  hasRestoredSession.value = false;
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STAGING_STORAGE_KEY);
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
  const matched = cycleFilteredRows.value.filter(r => r.mappedItem !== null);
  if (matched.length === 0) return [];

  const rawGroups: Record<string, any> = {};
  const boothRent = currentCycleInfo.value.spaceRental;

  for (const row of matched) {
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
    const venueFee = Math.max(0, Number((grossPrice - netStoreDeposit).toFixed(2)));
    const costBasis = isPureConsignor ? 0 : getItemCost(item);
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
    boothLocation: 'Memory Den (Booth 0EJ)',
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

const getCycleInfo = (paidDateStr: string, soldDateStr: string, rentDateStr: string = '') => {
  const dateToUse = soldDateStr || rentDateStr || paidDateStr;
  if (!dateToUse) return { id: 'default', label: 'General Payout' };
  const clean = dateToUse.replace(/['"]/g, '').trim();
  const parts = clean.split(/[-/]/);
  let year = '', month = '';
  if (parts.length === 3) {
    if (parts[0].length === 4) { // YYYY-MM-DD
      year = parts[0];
      month = parts[1].padStart(2, '0');
    } else if (parts[2].length === 4) { // MM-DD-YYYY or MM/DD/YYYY
      year = parts[2];
      month = parts[0].padStart(2, '0');
    }
  }
  if (year && month) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mIdx = parseInt(month, 10);
    const mName = (mIdx >= 1 && mIdx <= 12) ? monthNames[mIdx - 1] : month;
    return { id: `${year}-${month}`, label: `${mName} ${year}` };
  }
  return { id: 'default', label: 'General Payout' };
};

const parseMemoryDenPayout = (csvText: string) => {
  const lines = csvText.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) {
    addToast({ type: 'error', message: 'CSV is empty or invalid.' });
    isProcessing.value = false;
    return;
  }

  const headers = splitCsvLine(lines[0]).map(h => h?.trim().toLowerCase().replace(/"/g, ''));
  const itemIdx = headers.findIndex(h => h === 'name' || h === 'item' || h === 'product name');
  const skuIdx = headers.findIndex(h => h === 'sku' || h === 'location sku');
  
  const amountIdx = headers.findIndex(h => h === 'amount' || h === 'final amount' || h === 'sold amount' || h === 'net amount' || h.includes('amount'));
  const agedPriceIdx = headers.findIndex(h => h.includes('aged price') || h.includes('sold price') || h.includes('sale price'));
  const agreedPriceIdx = headers.findIndex(h => h.includes('agreed price') || h === 'agreed' || h.includes('price') || h.includes('total'));
  
  const paidIdx = headers.findIndex(h => h === 'paid' || h === 'payout date' || h === 'check date');
  const soldIdx = headers.findIndex(h => h === 'sold' || h === 'sold date' || h === 'date sold' || h === 'sale date');
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
  const ticketIdx = headers.findIndex(h => h === 'sale' || h === 'ticket' || h.includes('ticket') || h.includes('receipt') || h.includes('transaction') || h.includes('invoice') || h.includes('sale #'));
  const customerIdx = headers.findIndex(h => h.includes('customer') || h.includes('client') || h.includes('buyer'));

  if (itemIdx === -1) {
    addToast({ type: 'error', message: 'Could not find "Name" or "Item" column in MemoryDen CSV.' });
    isProcessing.value = false;
    return;
  }

  detectedRentMap.value = {};
  const rows: any[] = [];

  // Pre-scan pass to detect multi-quantity items by SKU frequency across rows
  const skuCounts = new Map<string, number>();
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length <= itemIdx) continue;
    const fullItemName = cols[itemIdx]?.trim() || '';
    if (!fullItemName) continue;
    const lowerName = fullItemName.toLowerCase();
    if (lowerName.includes('total for payout') || lowerName.includes('total paid:') || lowerName.includes('space rental') || lowerName.includes('rental') || lowerName.includes('(credit)')) {
      continue;
    }
    let extractedSku = skuIdx !== -1 ? (cols[skuIdx]?.replace(/^'/, '').trim() || '') : '';
    const skuMatch = fullItemName.match(/ - ([A-Z0-9-]+)$/);
    if (!extractedSku && skuMatch) {
      extractedSku = skuMatch[1];
    }
    const skuKey = (extractedSku || fullItemName).trim().toUpperCase();
    if (skuKey) {
      skuCounts.set(skuKey, (skuCounts.get(skuKey) || 0) + 1);
    }
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length <= itemIdx) continue;
    
    const fullItemName = cols[itemIdx]?.trim() || '';
    if (!fullItemName) continue;

    const lowerName = fullItemName.toLowerCase();
    const isRentOrCredit = lowerName.includes('space rental') || lowerName.includes('rental') || lowerName.includes('(credit)');
    const isTotalRow = lowerName.includes('total for payout') || lowerName.includes('total paid:');

    if (isTotalRow) continue;

    if (isRentOrCredit) {
      // Extract rent deduction (e.g. -382.50)
      let rentAmt = 382.50;
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

    const statusVal = statusIdx !== -1 ? cols[statusIdx]?.trim().toLowerCase() : '';
    if (statusVal === 'declined' || statusVal === 'failed' || statusVal === 'void' || statusVal === 'cancelled' || statusVal === 'canceled' || statusVal === 'unsuccessful') {
      continue;
    }
    
    let agreedPriceVal = agreedPriceIdx !== -1 ? parseFloat((cols[agreedPriceIdx] || '').replace(/[^0-9.-]+/g, '')) || 0 : 0;
    let agedPriceVal = agedPriceIdx !== -1 ? parseFloat((cols[agedPriceIdx] || '').replace(/[^0-9.-]+/g, '')) || 0 : 0;
    let grossPrice = agreedPriceVal > 0 ? agreedPriceVal : agedPriceVal;

    let consignorPct = 85; // 85% default payout
    if (splitIdx !== -1 && cols[splitIdx]) {
      const parsedSplit = parseFloat(cols[splitIdx].replace(/[^0-9.]/g, ''));
      if (parsedSplit > 0 && parsedSplit <= 100) consignorPct = parsedSplit;
    }

    let amountVal = amountIdx !== -1 ? parseFloat((cols[amountIdx] || '').replace(/[^0-9.-]+/g, '')) || 0 : 0;
    let netSoldPrice = 0;
    if (amountVal > 0 && amountVal !== grossPrice) {
      netSoldPrice = amountVal;
    } else if (grossPrice > 0) {
      netSoldPrice = Number((grossPrice * (consignorPct / 100)).toFixed(2));
    }

    const paidDate = paidIdx !== -1 ? (cols[paidIdx]?.trim() || '') : '';
    const soldDate = soldIdx !== -1 ? (cols[soldIdx]?.trim() || '') : '';
    const date = soldDate || (dateIdx !== -1 ? cols[dateIdx]?.trim() : '') || new Date().toLocaleDateString();
    const cycle = getCycleInfo(paidDate, soldDate);

    const ticketNumber = ticketIdx !== -1 ? (cols[ticketIdx]?.trim() || '') : '';
    const customerName = customerIdx !== -1 ? (cols[customerIdx]?.trim() || '') : '';

    // MemoryDen SKU either from explicit SKU column or end of title: "Item Name - 0EJ066"
    let extractedSku = skuIdx !== -1 ? (cols[skuIdx]?.replace(/^'/, '').trim() || '') : '';
    let itemName = fullItemName;
    const skuMatch = fullItemName.match(/ - ([A-Z0-9-]+)$/);
    if (!extractedSku && skuMatch) {
      extractedSku = skuMatch[1];
      itemName = fullItemName.replace(skuMatch[0], '').trim();
    }

    // Matching Logic Priority against all inventory
    let matched: any = null;
    
    // 1. Exact Location SKU match
    if (extractedSku) {
      matched = activeInventory.value.find(item => item.locationSku === extractedSku || item.locationSku === `'${extractedSku}`);
    }
    
    // 2. Exact UPC match
    if (!matched && extractedSku) {
      matched = activeInventory.value.find(item => item.upc === extractedSku);
    }

    // 3. Normalized Title Match
    if (!matched) {
      const cleanName = itemName.toLowerCase().replace(/[^a-z0-9]/g, '');
      matched = activeInventory.value.find(item => {
        if (!item.title) return false;
        const itemClean = item.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        return itemClean === cleanName || itemClean.includes(cleanName) || cleanName.includes(itemClean);
      });
    }

    // 4. Sub-Client B&B Auto-Mapping (PDXGL Consignor)
    const upperName = fullItemName.toUpperCase();
    const isBB = upperName.startsWith('B&B ') || upperName.startsWith('B&B-') || 
                 upperName.startsWith('BB ') || upperName.startsWith('BB-') || 
                 (extractedSku && extractedSku.toUpperCase().startsWith('BB'));

    if (!matched && isBB) {
      matched = {
        $id: `subclient_bb_${extractedSku || i}`,
        title: itemName,
        upc: `BB-${extractedSku || String(i).padStart(4, '0')}`,
        locationSku: extractedSku,
        price: grossPrice,
        cost: 0,
        isSubClient: true,
        subClientName: 'B&B Consignment',
        parentPartner: 'PDXGL-'
      };
    }

    const skuKey = (extractedSku || fullItemName).trim().toUpperCase();
    const repeatCount = skuCounts.get(skuKey) || 1;
    const isMultiCandidate = repeatCount > 1;
    const isItemMulti = !!(matched?.isMultiQty || (matched?.quantity && matched.quantity > 1));
    const isMultiQty = isItemMulti || isMultiCandidate;

    rows.push({
      date,
      paidDate,
      cycleId: cycle.id,
      cycleLabel: cycle.label,
      itemName: fullItemName,
      extractedSku,
      ticketNumber,
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
      isMultiQty: isMultiQty
    });
  }

  // Build Payout Cycles list
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
        spaceRental: detectedRentMap[r.cycleId] || 382.50,
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
};

const executeImport = async () => {
  const rowsToImport = cycleFilteredRows.value.filter(r => r.mappedItem !== null);
  if (rowsToImport.length === 0) {
    addToast({ type: 'warning', message: 'No matched items to commit in the selected view.' });
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
    const batchId = 'MD-PAYOUT-' + new Date().toISOString().slice(0, 10);

    // Look up Memory Den warehouse for platform attribution with strict matching (no silent fallback to Dusty Tiger)
    let mdWarehouseId = '';
    try {
      if (activeTeamId.value) {
        const warehouses = await warehousesApi.listWarehouses(activeTeamId.value);
        const mdWh = warehouses.find(w => 
          w.code?.toUpperCase() === 'MD' || 
          w.name.toLowerCase().includes('memory den') ||
          w.displayName?.toLowerCase().includes('memory den') ||
          (w as any).channelName?.toLowerCase().includes('memory den')
        );
        mdWarehouseId = mdWh?.$id || '';
        if (!mdWarehouseId) {
          console.warn("[SalesImporter] Memory Den warehouse not found among team facilities, proceeding without fallback.");
        }
      }
    } catch (whErr) {
      console.warn("[SalesImporter] Could not list warehouses:", whErr);
    }

    // Pre-fetch existing sales to prevent duplicate sales creation on re-import (Anti-Duplication Invariant)
    let existingTicketSet = new Set<string>();
    let existingSoldSkuSet = new Set<string>();
    try {
      if (activeTeamId.value) {
        const existingSales = await salesApi.listSales(activeTeamId.value);
        existingTicketSet = new Set(existingSales.map(s => s.orderId).filter(Boolean) as string[]);
        existingSales.forEach(s => {
          if (s.soNumber) existingSoldSkuSet.add(s.soNumber.trim().toUpperCase());
          if (s.orderId) existingSoldSkuSet.add(s.orderId.trim().toUpperCase());
        });
      }
    } catch (e) {
      console.warn("[SalesImporter] Could not pre-fetch sales for duplicate check:", e);
    }

    for (let idx = 0; idx < rowsToImport.length; idx++) {
      const row = rowsToImport[idx];
      const pct = Math.round(((idx + 1) / rowsToImport.length) * 100);
      updateLoader(undefined, `Saving sale ${idx + 1} of ${rowsToImport.length}: ${(row.itemName || '').slice(0, 32)}...`, pct);

      try {
        let item = row.mappedItem;
        if (!item) continue;

        const isSoldOrPaid = row.status === 'sold' || row.status === 'paid' || true;
        const orderRef = row.ticketNumber ? `Ticket #${row.ticketNumber}` : (row.extractedSku || batchId);

        // Cardinal Resale Invariant: 1 SKU = 1 Physical Unit = at most 1 Sale (Unless multi-qty)
        const isMultiQty = item.isMultiQty || (item.quantity && item.quantity > 1);
        const skuKey = (row.extractedSku || item.locationSku || item.upc || '').trim().toUpperCase();

        if (!isMultiQty) {
          // If this ticket was already recorded, skip!
          if (row.ticketNumber && existingTicketSet.has(orderRef)) {
            importedCount++;
            importedRowRefs.add(row);
            continue;
          }
          // If this SKU was already recorded in sales, skip!
          if (skuKey && existingSoldSkuSet.has(skuKey)) {
            importedCount++;
            importedRowRefs.add(row);
            continue;
          }
          // If the item in inventory is already marked sold with a sale record, skip!
          if (item.status === 'sold' && item.saleId) {
            importedCount++;
            importedRowRefs.add(row);
            continue;
          }
        }

        // If it's an auto-detected sub-client item (like B&B) not yet persisted, create it with valid Appwrite attributes
        if (item.isSubClient && (!item.$createdAt)) {
          try {
            const subDoc: Record<string, any> = {
              title: item.title || row.itemName || 'Consignment Item',
              status: 'sold',
              cost: 0,
              resalePrice: Number(row.listedPrice || row.salePrice || 0),
              soldPrice: Number(row.salePrice || 0)
            };
            if (activeTeamId.value) subDoc.tenantId = activeTeamId.value;
            if (item.upc) subDoc.upc = item.upc;
            if (row.extractedSku || item.locationSku) subDoc.locationSku = row.extractedSku || item.locationSku;

            const createdDoc = await databases.createDocument(DB_ID, ITEMS_COL, ID.unique(), subDoc);
            item = createdDoc;
            row.mappedItem = createdDoc;
          } catch (subErr) {
            console.warn("Sub-client item creation skipped:", subErr);
          }
        }

        const updatePayload: Record<string, any> = {
          locationSku: row.extractedSku || item.locationSku || undefined
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

            let parsedSaleDate = new Date().toISOString();
            if (row.date) {
              const rawDate = String(row.date).trim();
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

            const newSale = await salesApi.createSale({
              tenantId: item.tenantId || activeTeamId.value,
              warehouseId: mdWarehouseId,
              soNumber: item.upc || item.locationSku || `SO-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
              orderId: row.ticketNumber ? `Ticket #${row.ticketNumber}` : (row.extractedSku || item.locationSku || orderRef),
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

        // Update the item in Appwrite only if it is a real stored document
        if (item.$id && !item.$id.startsWith('subclient_')) {
          if (isMultiQty && (!item.quantity || item.quantity <= 1)) {
            updatePayload.quantity = Math.max(2, row.repeatCount || 2);
          }
          await databases.updateDocument(DB_ID, ITEMS_COL, item.$id, updatePayload);
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
        message: `Successfully imported ${importedCount} matched sales!` 
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
