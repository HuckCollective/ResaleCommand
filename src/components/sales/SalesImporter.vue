<template>
  <div class="card bg-base-100 shadow-sm border border-base-200 w-full">
    <div class="card-body p-4 sm:p-6 lg:p-8">
      <h2 class="card-title text-2xl font-bold flex items-center gap-2">
        <Icon icon="solar:import-bold-duotone" class="w-8 h-8 text-primary" />
        Universal Sales Importer
      </h2>
      <p class="text-sm opacity-80 mb-6">
        Upload a Payout History CSV (e.g., MemoryDen). We will match sold items to your inventory, mark them as Sold, create the sale records, and learn your manual mappings for future imports.
      </p>

      <!-- Step 1: Upload -->
      <div v-if="!parsedRows.length" class="flex flex-col items-center justify-center p-12 border-2 border-dashed border-base-300 rounded-xl bg-base-200/50 hover:bg-base-200 transition-colors">
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
                ${{ cycle.expectedCheck.toFixed(2) }} Check
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
                ${{ totalAllChecks.toFixed(2) }}
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
            <div class="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/30">
              <span class="text-[11px] text-emerald-700 dark:text-emerald-400 block uppercase font-bold">4. Net Payout Check</span>
              <span class="font-mono text-xl text-emerald-600 dark:text-emerald-400 font-black">+${{ selectedCycleFinancials.netCheck.toFixed(2) }}</span>
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

          <div class="flex items-center gap-2 w-full md:w-auto justify-end">
            <button class="btn btn-sm btn-ghost text-xs" @click="reset">Upload New File</button>
            
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
                </div>
              </div>
            </div>
          </div>

          <div class="overflow-x-auto border border-base-300 rounded-xl bg-base-100 shadow-sm">
            <table class="table table-sm">
              <thead class="sticky top-0 bg-base-200/90 backdrop-blur z-10">
                <tr class="bg-base-200">
                  <th>Match</th>
                  <th>CSV Status</th>
                  <th>Sold Item (CSV)</th>
                  <th>Price</th>
                  <th>Map to ResaleCommand Item</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, index) in displayedRows" :key="index" :class="{'bg-success/10': row.mappedItem}">
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
                      <span v-if="row.isSubClient" class="badge badge-xs badge-secondary font-bold font-mono">
                        👗 B&B Sub-Client (PDXGL)
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
                  <td>
                    <div v-if="row.mappedItem" class="flex items-center gap-2">
                      <span class="badge badge-sm badge-outline font-mono font-bold">{{ row.mappedItem.upc || 'NO UPC' }}</span>
                      <span class="truncate max-w-50 text-sm">{{ row.mappedItem.title }}</span>
                      <button class="btn btn-xs btn-ghost text-error ml-auto" @click="row.mappedItem = null">✕</button>
                    </div>
                    <select v-else class="select select-bordered select-sm w-full max-w-xs" v-model="row.mappedItem">
                      <option :value="null">Search active inventory...</option>
                      <option v-for="item in availableItems" :key="item.$id" :value="item">
                        {{ item.upc ? `[${item.upc}] ` : '' }}{{ item.title }}
                      </option>
                    </select>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div v-if="unmatchedCount > 0 && filterTab !== 'unmatched'" class="alert alert-info mt-4 py-2 text-xs flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Icon icon="solar:info-circle-bold" class="w-4 h-4" />
              <span>{{ unmatchedCount }} items are unmatched. Clicking "Commit" will safely process only the {{ matchedCount }} matched items.</span>
            </div>
            <button class="btn btn-xs btn-outline" @click="filterTab = 'unmatched'">Review Unmatched</button>
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
                <div>
                  <span class="opacity-60 block">100% Cost Recouped:</span>
                  <span class="font-mono text-sm text-emerald-600 dark:text-emerald-400 font-bold">+${{ (partner.masterCostBasis !== undefined ? partner.masterCostBasis : partner.totalCostBasis).toFixed(2) }}</span>
                </div>
                <div>
                  <span class="opacity-60 block">70% Net Profit Share:</span>
                  <span class="font-mono text-sm text-primary font-bold">+${{ (partner.masterCuratorProfit !== undefined ? partner.masterCuratorProfit : partner.totalCuratorProfit).toFixed(2) }}</span>
                </div>
                <div>
                  <span class="opacity-60 block">30% Commons Contribution:</span>
                  <span class="font-mono text-sm text-amber-600 dark:text-amber-400 font-bold">+${{ (partner.masterCommonsTake !== undefined ? partner.masterCommonsTake : partner.totalCommonsTake).toFixed(2) }}</span>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
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

const { user, currentTeam: team } = useAuth();
const { inventoryItems, fetchInventory } = useInventory();
const { showLoader, updateLoader, hideLoader } = useLoader();
const isProcessing = ref(false);
const isImporting = ref(false);
const platform = ref('memoryden');
const activeView = ref('matching'); // 'matching' | 'settlement'
const filterTab = ref('all'); // 'all' | 'matched' | 'unmatched'
const parsedRows = ref<any[]>([]);

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

const activeTeamId = computed(() => {
  return team.value?.$id || (typeof window !== 'undefined' ? localStorage.getItem('activeTeamId') : '') || '';
});

onMounted(() => {
  if (inventoryItems.value.length === 0) {
    fetchInventory(activeTeamId.value || undefined);
  }
});

const activeInventory = computed(() => {
  return inventoryItems.value;
});

const cycleFilteredRows = computed(() => {
  if (selectedCycle.value === 'ALL') return parsedRows.value;
  return parsedRows.value.filter(r => r.cycleId === selectedCycle.value);
});

const displayedRows = computed(() => {
  const base = cycleFilteredRows.value;
  if (filterTab.value === 'matched') return base.filter(r => r.mappedItem !== null);
  if (filterTab.value === 'unmatched') return base.filter(r => r.mappedItem === null);
  return base;
});

const availableItems = computed(() => {
  const mappedIds = cycleFilteredRows.value.filter(r => r.mappedItem).map(r => r.mappedItem.$id);
  return activeInventory.value.filter(i => !mappedIds.includes(i.$id));
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
  const rent = currentCycleInfo.value.spaceRental;
  const netCheck = Number((netStore - rent).toFixed(2));

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

  for (const row of matched) {
    const item = row.mappedItem;
    const prefix = resolveItemPrefix(item, row.extractedSku, row.itemName);
    const partnerName = resolvePartnerName(prefix);

    if (!rawGroups[prefix]) {
      rawGroups[prefix] = {
        prefix,
        name: partnerName,
        isSubClient: prefix === 'BB-',
        parentPartner: prefix === 'BB-' ? 'PDXGL-' : null,
        items: [],
        totalGross: 0,
        totalVenueFee: 0,
        totalCostBasis: 0,
        totalNetSurplus: 0,
        totalCuratorProfit: 0,
        totalPayoutCheck: 0,
        totalCommonsTake: 0
      };
    }

    const grossPrice = Number(row.listedPrice || row.salePrice || 0);
    const netStoreDeposit = Number(row.salePrice || (grossPrice * 0.85));
    const venueFee = Math.max(0, Number((grossPrice - netStoreDeposit).toFixed(2)));
    const costBasis = getItemCost(item);
    const netSurplus = Math.max(0, Number((netStoreDeposit - costBasis).toFixed(2)));
    const curatorTake = Number((costBasis + (netSurplus * 0.70)).toFixed(2));
    const commonsTake = Number((netSurplus * 0.30).toFixed(2));

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
    rawGroups[prefix].totalCuratorProfit = Number((rawGroups[prefix].totalCuratorProfit + (netSurplus * 0.70)).toFixed(2));
    rawGroups[prefix].totalPayoutCheck = Number((rawGroups[prefix].totalCostBasis + rawGroups[prefix].totalCuratorProfit).toFixed(2));
    rawGroups[prefix].totalCommonsTake = Number((rawGroups[prefix].totalCommonsTake + commonsTake).toFixed(2));
  }

  // Roll up B&B Sub-Client under PDX Game Library
  const result: any[] = [];
  const pdxglGroup = rawGroups['PDXGL-'];
  const bbGroup = rawGroups['BB-'];

  // HUCK group
  if (rawGroups['HUCK-']) {
    result.push(rawGroups['HUCK-']);
  }

  // PDXGL master partner group
  if (pdxglGroup || bbGroup) {
    const combinedPdxgl = pdxglGroup ? { ...pdxglGroup } : {
      prefix: 'PDXGL-',
      name: 'PDX Game Library',
      isSubClient: false,
      items: [],
      totalGross: 0,
      totalVenueFee: 0,
      totalCostBasis: 0,
      totalNetSurplus: 0,
      totalCuratorProfit: 0,
      totalPayoutCheck: 0,
      totalCommonsTake: 0
    };

    if (bbGroup) {
      combinedPdxgl.bbSubClient = bbGroup;
      combinedPdxgl.masterGross = Number((combinedPdxgl.totalGross + bbGroup.totalGross).toFixed(2));
      combinedPdxgl.masterVenueFee = Number((combinedPdxgl.totalVenueFee + bbGroup.totalVenueFee).toFixed(2));
      combinedPdxgl.masterCostBasis = Number((combinedPdxgl.totalCostBasis + bbGroup.totalCostBasis).toFixed(2));
      combinedPdxgl.masterNetSurplus = Number((combinedPdxgl.totalNetSurplus + bbGroup.totalNetSurplus).toFixed(2));
      combinedPdxgl.masterCuratorProfit = Number((combinedPdxgl.totalCuratorProfit + bbGroup.totalCuratorProfit).toFixed(2));
      combinedPdxgl.masterPayoutCheck = Number((combinedPdxgl.totalPayoutCheck + bbGroup.totalPayoutCheck).toFixed(2));
      combinedPdxgl.masterCommonsTake = Number((combinedPdxgl.totalCommonsTake + bbGroup.totalCommonsTake).toFixed(2));
    }
    result.push(combinedPdxgl);
  }

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
  const commonsSurplusAfterRent = Number((totalCommonsPool - boothRent).toFixed(2));
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
    commonsSurplusAfterRent,
    isRentCovered: commonsSurplusAfterRent >= 0,
    memoryDenNetCheck
  };
});

const downloadPartnerPdf = (partner) => {
  const doc = generatePartnerSettlementPdf({
    statementDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
    periodLabel: 'Memory Den Monthly Settlement',
    partnerName: partner.name,
    prefix: partner.prefix,
    items: partner.items,
    totalGross: partner.totalGross,
    totalVenueFee: partner.totalVenueFee,
    totalCostBasis: partner.totalCostBasis,
    totalNetSurplus: partner.totalNetSurplus,
    totalCuratorProfit: partner.totalCuratorProfit,
    totalPayoutCheck: partner.totalPayoutCheck,
    boothLocation: 'Memory Den (Booth 0EJ)'
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
  const ticketIdx = headers.findIndex(h => h.includes('ticket') || h.includes('receipt') || h.includes('transaction') || h.includes('invoice') || h.includes('sale #'));
  const customerIdx = headers.findIndex(h => h.includes('customer') || h.includes('client') || h.includes('buyer'));

  if (itemIdx === -1) {
    addToast({ type: 'error', message: 'Could not find "Name" or "Item" column in MemoryDen CSV.' });
    isProcessing.value = false;
    return;
  }

  const detectedRentMap: Record<string, number> = {};
  const rows: any[] = [];

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
      detectedRentMap[cycle.id] = rentAmt;
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
      parentPartner: isBB ? 'PDXGL-' : (matched?.parentPartner || null)
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

  payoutCycles.value = Array.from(cycleMap.values()).sort((a, b) => b.id.localeCompare(a.id));
  if (payoutCycles.value.length > 0) {
    // Select the single most recent month by default, so the user sees JUST that month!
    selectedCycle.value = payoutCycles.value[0].id;
  }

  parsedRows.value = rows;
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

    for (let idx = 0; idx < rowsToImport.length; idx++) {
      const row = rowsToImport[idx];
      const pct = Math.round(((idx + 1) / rowsToImport.length) * 100);
      updateLoader(undefined, `Saving sale ${idx + 1} of ${rowsToImport.length}: ${(row.itemName || '').slice(0, 32)}...`, pct);

      try {
        let item = row.mappedItem;
        if (!item) continue;

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

        const isSoldOrPaid = row.status === 'sold' || row.status === 'paid' || true;
        const orderRef = row.ticketNumber ? `Ticket #${row.ticketNumber}` : batchId;

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

      // Remove imported rows from parsedRows so user clearly sees committed items leave the staging queue
      parsedRows.value = parsedRows.value.filter(r => !importedRowRefs.has(r));

      if (parsedRows.value.length === 0) {
        reset();
      } else {
        addToast({
          type: 'info',
          message: `${parsedRows.value.length} unmatched items remain in staging.`
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
