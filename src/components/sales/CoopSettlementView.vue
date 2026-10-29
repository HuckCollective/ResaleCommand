<template>
  <div class="space-y-6">
    <!-- Settlement Header & Period Filter Controls -->
    <div class="card bg-base-100 border border-base-200 shadow-sm rounded-2xl p-4 sm:p-5">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="badge badge-primary font-black text-xs px-2.5 py-1">
              70 / 30 WSDE Model
            </span>
            <span class="badge badge-outline font-mono text-xs">
              {{ filteredSales.length }} Sales Included
            </span>
          </div>
          <h2 class="text-xl sm:text-2xl font-black text-base-content tracking-tight mt-1 flex items-center gap-2">
            <Icon icon="solar:hand-money-bold-duotone" class="w-6 h-6 text-primary shrink-0" />
            <span>Co-op Settlements &amp; Partner Statements</span>
          </h2>
          <p class="text-xs text-base-content/70 mt-0.5">
            Calculated directly from committed sales in your database. 100% cost recoupment, 70% curator net profits, and 30% commons pool.
          </p>
        </div>

        <div class="flex items-center gap-2.5 w-full sm:w-auto flex-wrap justify-end">
          <!-- Link to Payout CSV Importer -->
          <a 
            href="/sales/import" 
            class="btn btn-sm btn-primary gap-1.5 rounded-xl font-bold h-9 min-h-9 px-3 text-xs shadow-sm"
            title="Upload Memory Den or register payout CSV to import and reconcile sales"
          >
            <Icon icon="solar:import-bold-duotone" class="w-4 h-4 shrink-0" />
            <span>Upload Payout CSV</span>
          </a>

          <!-- Link to Shared Commons Expense Ledger -->
          <a 
            href="/expenses" 
            class="btn btn-sm btn-outline gap-1.5 rounded-xl font-bold h-9 min-h-9 px-3 text-xs bg-base-100"
            title="View shared commons expenses, receipts & reimbursements"
          >
            <Icon icon="solar:bill-list-bold-duotone" class="w-4 h-4 text-primary shrink-0" />
            <span>Commons Expenses</span>
          </a>

          <!-- Location / Channel Selector -->
          <div class="form-control">
            <select v-model="selectedLocation" class="select select-bordered select-sm font-bold text-xs h-9 min-h-9 rounded-xl">
              <option value="memory_den">🏪 Memory Den (Booth 0EJ)</option>
              <option value="all">🌐 All Channels &amp; Locations</option>
            </select>
          </div>

          <!-- Dynamic Time Period Selector -->
          <div class="form-control">
            <select v-model="selectedPeriod" @change="emit('update:period', selectedPeriod)" class="select select-bordered select-sm font-bold text-xs h-9 min-h-9 rounded-xl font-mono">
              <option v-for="m in availableMonths" :key="m.key" :value="m.key">
                {{ m.label }} ({{ m.count }} sales)
              </option>
              <option value="all">All Time Realized ({{ sales.length }} sales)</option>
            </select>
          </div>

          <!-- Download All Button -->
          <button 
            type="button" 
            class="btn btn-sm btn-success text-success-content font-black gap-1.5 shadow-sm rounded-xl h-9 min-h-9 px-3.5"
            :disabled="partnerSettlements.length === 0"
            @click="exportAllPartnerPdfs"
            title="Download official PDF settlement statements for all partners"
          >
            <Icon icon="solar:file-download-bold" class="w-4 h-4 shrink-0" />
            <span>Download All Statements (PDF)</span>
          </button>
        </div>
      </div>
    </div>

    <!-- The 4 Core Guarantee Summary KPI Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <div class="card bg-base-100 p-4 sm:p-5 rounded-2xl border border-base-200 shadow-sm space-y-1">
        <div class="text-[11px] font-bold text-base-content/60 uppercase tracking-wider">Gross Realized Sales</div>
        <div class="text-2xl font-black text-base-content font-mono">${{ settlementSummary.totalGross.toFixed(2) }}</div>
        <div class="text-xs text-base-content/50 font-medium">
          Venue Cut (15%): -${{ settlementSummary.totalVenueFee.toFixed(2) }}
        </div>
      </div>

      <div class="card bg-base-100 p-4 sm:p-5 rounded-2xl border border-success/30 shadow-sm space-y-1 bg-success/5">
        <div class="text-[11px] font-bold text-success uppercase tracking-wider flex items-center gap-1">
          <span>🛡️ Guarantee 1</span>
        </div>
        <div class="text-2xl font-black text-success font-mono">+${{ settlementSummary.totalCostBasis.toFixed(2) }}</div>
        <div class="text-xs text-base-content/70 font-medium">
          100% Capital Recouped First
        </div>
      </div>

      <div class="card bg-base-100 p-4 sm:p-5 rounded-2xl border border-primary/30 shadow-sm space-y-1 bg-primary/5">
        <div class="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
          <span>💎 Guarantee 2</span>
        </div>
        <div class="text-2xl font-black text-primary font-mono">+${{ settlementSummary.totalCuratorPayouts.toFixed(2) }}</div>
        <div class="text-xs text-base-content/70 font-medium">
          Curator Net Checks (Cost + 70% Profit)
        </div>
      </div>

      <div class="card bg-base-100 p-4 sm:p-5 rounded-2xl border border-warning/30 shadow-sm space-y-1.5 bg-warning/5">
        <div class="text-[11px] font-bold text-warning uppercase tracking-wider flex items-center justify-between gap-1">
          <span>🤝 Guarantee 3</span>
          <a href="/expenses" class="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5" title="View all receipts & reimbursements">
            <span>Expenses</span>
            <Icon icon="solar:arrow-right-linear" class="w-3 h-3" />
          </a>
        </div>
        <div class="text-2xl font-black text-warning font-mono">+${{ settlementSummary.totalCommonsPool.toFixed(2) }}</div>
        <div class="text-[11px] text-base-content/70 font-medium space-y-0.5">
          <div class="flex justify-between">
            <span>Rent:</span>
            <span class="font-mono text-error font-semibold">-${{ settlementSummary.boothRent.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between">
            <span>Tech Ops:</span>
            <span class="font-mono text-primary font-semibold">-${{ settlementSummary.techOps.toFixed(2) }}</span>
          </div>
          <div v-if="settlementSummary.supplies > 0" class="flex justify-between">
            <span>Supplies:</span>
            <span class="font-mono text-base-content/70 font-semibold">-${{ settlementSummary.supplies.toFixed(2) }}</span>
          </div>
        </div>
        <div class="text-xs font-bold pt-1 border-t border-warning/20" :class="settlementSummary.isCommonsFullyCovered ? 'text-success' : 'text-warning'">
          {{ settlementSummary.isCommonsFullyCovered ? `✅ Surplus (+${settlementSummary.commonsNetBalance.toFixed(2)}) to Reserve` : `⚠️ Shortfall: -$${Math.abs(settlementSummary.commonsNetBalance).toFixed(2)} (Carried Over)` }}
        </div>
      </div>
    </div>

    <!-- Member / Partner Payout Statements: directly under the 4 waterfall cards -->
    <!-- Empty State -->
      <div v-if="visiblePartnerSettlements.length === 0" class="card bg-base-100 border border-base-200 shadow-sm p-12 text-center">
      <div class="w-12 h-12 rounded-full bg-base-200 text-base-content/50 flex items-center justify-center mx-auto mb-3">
        <Icon icon="solar:document-text-linear" class="w-6 h-6" />
      </div>
      <h3 class="text-base font-bold">No sales in selected period or location</h3>
      <p class="text-xs text-base-content/60 mt-1 max-w-sm mx-auto">
        Try adjusting the month selector or switching to "All Channels &amp; Locations".
      </p>
    </div>

    <!-- Partner Settlement Cards -->
    <div v-else class="space-y-6">
      <div 
        v-for="partner in visiblePartnerSettlements" 
        :key="partner.prefix" 
        class="card bg-base-100 border border-base-300 shadow-md overflow-hidden rounded-2xl"
      >
        <!-- Card Header -->
        <div class="bg-base-200/70 p-4 sm:p-5 border-b border-base-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="w-11 h-11 rounded-2xl bg-primary/15 text-primary flex items-center justify-center font-black text-lg shadow-xs">
              {{ partner.prefix.replace(/[-_]$/, '').slice(0, 2) }}
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="font-black text-lg text-base-content">{{ partner.name }}</h3>
                <span class="badge badge-sm badge-outline font-mono font-bold">{{ partner.prefix }}</span>
                <span class="badge badge-sm badge-ghost font-bold">{{ partner.items.length }} {{ partner.items.length === 1 ? 'item sold' : 'items sold' }}</span>
              </div>
              <p class="text-xs text-base-content/60">Governed under Huckleberry Collective 70/30 Net Surplus Settlement</p>
            </div>
          </div>

          <div class="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <div class="text-right">
              <div class="text-xs text-base-content/60 font-semibold uppercase tracking-wider">
                Final Payout Check
              </div>
              <div class="text-2xl font-black font-mono" :class="partner.totalPayoutCheck < 0 ? 'text-error' : 'text-success'">
                ${{ partner.totalPayoutCheck.toFixed(2) }}
              </div>
              <div v-if="partner.reimbursements > 0" class="text-[11px] text-success font-bold flex items-center justify-end gap-1">
                <Icon icon="solar:bolt-bold" class="w-3.5 h-3.5" />
                <span>Includes +${{ partner.reimbursements.toFixed(2) }} Fronted Reimbursement</span>
              </div>
            </div>
            <button 
              type="button" 
              class="btn btn-sm btn-primary gap-1.5 shadow-sm rounded-xl font-bold"
              @click="downloadPartnerPdf(partner)"
              title="Download PDF settlement statement for this partner"
            >
              <Icon icon="solar:document-medicine-bold" class="w-4 h-4 shrink-0" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>

        <!-- Financial Waterfall Bar -->
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-base-200/30 text-xs border-b border-base-200">
          <div>
            <span class="opacity-60 block font-medium">Gross Register:</span>
            <span class="font-bold font-mono text-sm text-base-content">${{ partner.totalGross.toFixed(2) }}</span>
          </div>
          <div>
            <span class="opacity-60 block font-medium">15% Venue Cut:</span>
            <span class="font-mono text-sm text-error font-bold">-${{ partner.totalVenueFee.toFixed(2) }}</span>
          </div>
          <div v-if="partner.isConsignor">
            <span class="opacity-60 block font-medium">Booth Rent Share:</span>
            <span class="font-mono text-sm text-warning font-bold">-${{ (partner.rentDeduction || 0).toFixed(2) }}</span>
          </div>
          <div v-else>
            <span class="opacity-60 block font-medium">100% Cost Basis Recouped:</span>
            <span class="font-mono text-sm text-success font-bold">+${{ partner.totalCostBasis.toFixed(2) }}</span>
          </div>
          <div v-if="partner.isConsignor">
            <span class="opacity-60 block font-medium">Net Consignor Payout:</span>
            <span class="font-mono text-sm text-success font-bold">${{ partner.totalPayoutCheck.toFixed(2) }}</span>
          </div>
          <div v-else>
            <span class="opacity-60 block font-medium">70% Net Profit Share:</span>
            <span class="font-mono text-sm text-primary font-bold">+${{ partner.totalCuratorProfit.toFixed(2) }}</span>
          </div>
          <div v-if="!partner.isConsignor">
            <span class="opacity-60 block font-medium">30% Commons Contribution:</span>
            <span class="font-mono text-sm text-warning font-bold">+${{ partner.totalCommonsTake.toFixed(2) }}</span>
          </div>
          <div v-else>
            <span class="opacity-60 block font-medium">Relationship:</span>
            <span class="badge badge-sm badge-secondary font-bold">Consignor</span>
          </div>
        </div>

        <!-- Itemized Table (Collapsible) -->
        <div class="overflow-x-auto max-h-72">
          <table class="table table-xs table-pin-rows">
            <thead>
              <tr class="bg-base-200/60 text-base-content/70">
                <th>Date</th>
                <th>SKU / UPC</th>
                <th>Description</th>
                <th class="text-right">Gross</th>
                <th class="text-right">Venue Fee</th>
                <th class="text-right">Cost Recoup</th>
                <th class="text-right">Net Surplus</th>
                <th class="text-right font-bold text-success">{{ partner.isConsignor ? 'Net After Fee (85%)' : 'Total Payout (Cost + 70%)' }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(it, iIdx) in partner.items" :key="iIdx" class="hover:bg-base-200/40">
                <td class="font-mono text-xs">{{ it.date ? String(it.date).slice(0, 10) : 'N/A' }}</td>
                <td class="font-mono text-xs font-semibold">{{ cleanSkuDisplay(it.sku) }}</td>
                <td class="max-w-xs truncate font-medium">{{ it.title }}</td>
                <td class="text-right font-mono font-semibold">${{ it.grossPrice.toFixed(2) }}</td>
                <td class="text-right font-mono text-error">-${{ it.venueFee.toFixed(2) }}</td>
                <td class="text-right font-mono text-success font-semibold">${{ it.costBasis.toFixed(2) }}</td>
                <td class="text-right font-mono">${{ it.netSurplus.toFixed(2) }}</td>
                <td class="text-right font-mono font-bold text-success">${{ it.curatorTake.toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Venue check, booth rent & shared overhead (collapsed so rent / tech ops are not repeated up top) -->
    <details class="collapse collapse-arrow bg-base-100 border border-base-200 rounded-2xl shadow-sm">
      <summary class="collapse-title font-bold text-sm flex items-center gap-2">
        <span>🏪 Venue check, booth rent &amp; shared overhead</span>
        <span class="badge badge-ghost badge-sm font-mono">Memory Den reconciliation</span>
      </summary>
      <div class="collapse-content space-y-6">
    <!-- Memory Den Check Reconciliation Banner -->
    <div class="card bg-base-100 border border-base-200 shadow-sm rounded-2xl p-4 sm:p-5 space-y-3">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-base-200 pb-3">
        <div>
          <span class="text-xs font-bold text-base-content/60 uppercase tracking-wider">
            Memory Den Monthly Settlement Check Reconciler
          </span>
          <div class="text-lg font-black text-base-content flex items-center gap-2">
            <span>Period: {{ getPeriodLabel() }}</span>
            <span class="badge badge-primary font-mono text-xs font-bold">{{ filteredSales.length }} items</span>
          </div>
        </div>
        <div class="text-left sm:text-right">
          <span class="text-xs text-base-content/60 font-semibold block uppercase">Actual Net Check from Memory Den:</span>
          <span class="text-2xl font-black font-mono" :class="settlementSummary.memoryDenNetCheck >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-error'">
            ${{ settlementSummary.memoryDenNetCheck.toFixed(2) }}
          </span>
        </div>
      </div>

      <!-- Payout Disbursement Cadence Banner (15th of the Month) -->
      <div class="alert alert-info/10 border border-info/30 rounded-xl py-2.5 px-3.5 text-xs flex items-center gap-2.5 text-base-content">
        <Icon icon="solar:calendar-date-bold-duotone" class="w-5 h-5 text-info shrink-0" />
        <div class="flex-1">
          <strong class="font-bold text-info">Venue Payout Schedule:</strong>
          <span class="opacity-80 ml-1">Memory Den settlement checks deposit on <strong>{{ settlementSummary.memoryDenDisbursementDate }}</strong> (the 15th of the month). Curator checks should disburse after the venue deposit clears.</span>
        </div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs">
        <div>
          <span class="text-base-content/60 block">1. Gross Register Sales</span>
          <span class="font-bold font-mono text-sm text-base-content">${{ settlementSummary.totalGross.toFixed(2) }}</span>
        </div>
        <div>
          <span class="text-error block">2. Venue Fee (15%)</span>
          <span class="font-bold font-mono text-sm text-error">-${{ settlementSummary.totalVenueFee.toFixed(2) }}</span>
        </div>
        <div>
          <span class="text-warning block">3. Booth Space Rental</span>
          <span class="font-bold font-mono text-sm text-warning font-black">-${{ settlementSummary.boothRent.toFixed(2) }}</span>
        </div>
        <div>
          <span class="text-primary block">4. Net Mall Deposit</span>
          <span class="font-bold font-mono text-sm text-primary font-black">${{ settlementSummary.memoryDenNetCheck.toFixed(2) }}</span>
        </div>
      </div>
    </div>

    <!-- Tier 1 Commons Overhead & Tech Ops Ledger -->
    <div class="card bg-base-100 border border-base-200 shadow-sm rounded-2xl p-4 sm:p-5">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-base-200 pb-3">
        <div>
          <div class="flex items-center gap-2">
            <span class="badge badge-warning font-black text-xs px-2.5 py-0.5">Tier 1 Covered First</span>
            <span class="badge badge-outline font-mono text-xs">{{ filteredExpenses.length }} Expenses Tracked</span>
          </div>
          <h3 class="text-base font-black text-base-content tracking-tight mt-1 flex items-center gap-2">
            <Icon icon="solar:bolt-bold-duotone" class="w-5 h-5 text-warning shrink-0" />
            <span>Tier 1 Shared Overhead &amp; Tech Ops</span>
          </h3>
          <p class="text-xs text-base-content/60">
            Paid collectively by the 30% Commons Pool. Covers fixed mall booth space, tech hosting, AI tokens, and supplies.
          </p>
        </div>
        <div class="text-left sm:text-right">
          <span class="text-xs text-base-content/60 font-semibold block uppercase">Total Overhead &amp; Tech:</span>
          <span class="text-xl font-black font-mono text-warning">
            ${{ settlementSummary.totalCommonsOverhead.toFixed(2) }}
          </span>
        </div>
      </div>

      <!-- 3-Pillar Overhead Breakdown -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
        <div class="p-3 rounded-xl bg-base-200/50 border border-base-200 space-y-1">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-base-content/70">🏪 Booth Space Rent</span>
            <span class="badge badge-xs badge-neutral font-mono font-bold">Auto-Deducted</span>
          </div>
          <div class="text-lg font-black font-mono text-base-content">
            ${{ settlementSummary.boothRent.toFixed(2) }}
          </div>
          <p class="text-[11px] text-base-content/50">Memory Den monthly space rental</p>
        </div>

        <div class="p-3 rounded-xl bg-base-200/50 border border-base-200 space-y-1">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-base-content/70">⚡ Tech Commons &amp; AI</span>
            <span class="badge badge-xs badge-primary font-mono font-bold">{{ techOpsExpenses.length }} items</span>
          </div>
          <div class="text-lg font-black font-mono text-primary">
            ${{ settlementSummary.techOps.toFixed(2) }}
          </div>
          <p class="text-[11px] text-base-content/50">Appwrite DB, Gemini AI credits, hosting</p>
        </div>

        <div class="p-3 rounded-xl bg-base-200/50 border border-base-200 space-y-1">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-base-content/70">🏷️ Merch Supplies &amp; Ops</span>
            <span class="badge badge-xs badge-ghost font-mono font-bold">{{ suppliesExpenses.length }} items</span>
          </div>
          <div class="text-lg font-black font-mono text-base-content">
            ${{ settlementSummary.supplies.toFixed(2) }}
          </div>
          <p class="text-[11px] text-base-content/50">Thermal tags, barcodes, displays</p>
        </div>
      </div>

      <!-- Itemized Tech Ops & Supplies List (if any exist) -->
      <div v-if="filteredExpenses.length > 0" class="mt-4 pt-3 border-t border-base-200">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold uppercase tracking-wider text-base-content/60">Itemized Operating Receipts in Period</span>
          <a href="/expenses" class="text-xs text-primary font-bold hover:underline flex items-center gap-1">
            <span>Manage All Receipts in Expense Ledger</span>
            <Icon icon="solar:arrow-right-linear" class="w-3.5 h-3.5" />
          </a>
        </div>
        <div class="overflow-x-auto max-h-48 border border-base-200 rounded-xl">
          <table class="table table-xs">
            <thead>
              <tr class="bg-base-200/60 text-base-content/70">
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Fronted By</th>
                <th class="text-right">Amount</th>
                <th class="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="exp in filteredExpenses" :key="exp.id" class="hover:bg-base-200/40">
                <td class="font-mono text-[11px]">{{ exp.date ? String(exp.date).slice(0, 10) : 'N/A' }}</td>
                <td>
                  <span class="badge badge-xs font-bold truncate max-w-[140px]" :class="exp.category.includes('Tech') ? 'badge-primary' : 'badge-ghost'">
                    {{ exp.category }}
                  </span>
                </td>
                <td class="font-medium max-w-xs truncate">{{ exp.description }}</td>
                <td class="font-semibold text-xs">{{ exp.member }} ({{ exp.partner || 'HUCK' }})</td>
                <td class="text-right font-mono font-bold">${{ Number(exp.amount || 0).toFixed(2) }}</td>
                <td class="text-center">
                  <span class="badge badge-xs font-mono font-bold" :class="exp.status === 'reimbursed' ? 'badge-success' : 'badge-warning'">
                    {{ exp.status }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div v-else class="mt-3 pt-3 border-t border-base-200 flex items-center justify-between text-xs text-base-content/60">
        <span>No additional operational receipts logged for this period.</span>
        <a href="/expenses" class="text-primary font-bold hover:underline flex items-center gap-1">
          <span>+ Log Tech or Supply Receipt</span>
          <Icon icon="solar:add-circle-bold" class="w-3.5 h-3.5" />
        </a>
      </div>
    </div>

      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { addToast } from '../../stores/toast';
import { useAuth } from '../../composables/useAuth';
import { normalizeOrgPrefix, extractOrgPrefix } from '../../lib/inventoryUpc';
import { generatePartnerSettlementPdf, type PartnerStatementData } from '../../lib/coopSettlementPdf';
import { coopExpensesApi, type CoopExpenseItem } from '../../lib/coopExpenses';
import { cleanSkuDisplay, pacificMonthKey } from '../../lib/salesBucketing';

interface SaleItem {
  id: string;
  soNumber?: string;
  title?: string;
  upc?: string;
  sku?: string;
  locationName?: string;
  date?: string;
  status?: string;
  grossAmount?: number;
  fees?: number;
  netPayout?: number;
  cost?: number;
}

const props = defineProps<{
  sales: SaleItem[];
  /** Month filter shared with the /sales page ('YYYY-MM' or 'all'). */
  period?: string;
  /** Partner filter shared with the /sales page ('all' | 'HUCK' | 'BB' | 'PDXGL'). */
  partnerFilter?: string;
}>();

const emit = defineEmits<{ (e: 'update:period', value: string): void }>();

const { currentTeam } = useAuth();
const selectedPeriod = ref<string>('all');
const selectedLocation = ref<'memory_den' | 'all'>('memory_den');

// Keep this view's month in sync with the /sales page filter
watch(() => props.period, (p) => {
  if (p && p !== selectedPeriod.value) selectedPeriod.value = p;
}, { immediate: true });

// Shared Commons Expenses State
const expenses = ref<CoopExpenseItem[]>([]);
const loadingExpenses = ref(false);

const loadExpenses = async () => {
  if (!currentTeam.value) return;
  loadingExpenses.value = true;
  try {
    expenses.value = await coopExpensesApi.listExpenses(currentTeam.value.$id);
  } catch (e) {
    console.warn('[CoopSettlementView] Failed to load expenses:', e);
  } finally {
    loadingExpenses.value = false;
  }
};

onMounted(() => {
  loadExpenses();
});

watch(currentTeam, (n) => {
  if (n) loadExpenses();
});

// Dynamically extract all distinct monthly settlement cycles from real sales data (Zero-Dupe Invariant)
const availableMonths = computed(() => {
  const months = new Map<string, { key: string; label: string; count: number; date: Date }>();
  const seenMonthSaleIds = new Set<string>();

  for (const s of props.sales) {
    if (!s.date || s.status === 'Cancelled') continue;

    if (s.id) {
      if (seenMonthSaleIds.has(s.id)) continue;
      seenMonthSaleIds.add(s.id);
    }

    const key = pacificMonthKey(s.date);
    const [yy, mm] = key.split('-');
    if (yy && mm && yy.length === 4) {
      {
        const year = yy;
        const month = mm;
        const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
        const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const existing = months.get(key);
        if (existing) {
          existing.count++;
        } else {
          months.set(key, { key, label, count: 1, date: d });
        }
      }
    }
  }
  return Array.from(months.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
});

// Default to the most recent month that has substantial sales (or newest)
watch(availableMonths, (months) => {
  if (months.length > 0 && selectedPeriod.value === 'all' && props.period === undefined) {
    const substantialMonth = months.find(m => m.count >= 5);
    selectedPeriod.value = substantialMonth ? substantialMonth.key : months[0].key;
  }
}, { immediate: true });

// Filter sales by selected month and location (Zero-Dupe Invariant)
const filteredSales = computed(() => {
  if (!props.sales || props.sales.length === 0) return [];
  const seenFilteredIds = new Set<string>();

  return props.sales.filter(s => {
    if (s.status === 'Cancelled') return false;

    // 1. Date / Month Filter First
    if (selectedPeriod.value !== 'all') {
      if (!s.date) return false;
      if (pacificMonthKey(s.date) !== selectedPeriod.value) return false;
    }

    // 2. Venue isolation filter: Strictly verify Memory Den venue attribution
    if (selectedLocation.value === 'memory_den') {
      const loc = (s.locationName || '').toLowerCase();
      const sSku = (s.sku || '').toLowerCase();
      const sUpc = (s.upc || '').toLowerCase();
      const soNumber = (s.soNumber || '').toLowerCase();
      const orderId = ((s as any).orderId || '').toLowerCase();
      const whId = ((s as any).warehouseId || '').toLowerCase();
      const isMd = loc.includes('memory') || loc.includes('0ej') || loc === 'md' ||
                   sSku.includes('0ej') || sUpc.includes('0ej') || soNumber.includes('0ej') ||
                   orderId.startsWith('md-payout') || orderId.startsWith('md-') || orderId.startsWith('t-') ||
                   whId === '6a7e70050009db0e1857' || whId === '6ab9a37500233d76d580';
      if (!isMd) return false;
    }

    // 3. Resale Invariant: 1 Sale Record = 1 Unique Physical Register Transaction
    if (s.id) {
      if (seenFilteredIds.has(s.id)) return false;
      seenFilteredIds.add(s.id);
    }

    return true;
  });
});

const resolveItemPrefix = (item: SaleItem): string => {
  const upc = (item.upc || '').trim().toUpperCase();
  const sku = (item.sku || '').trim().toUpperCase();
  const soNumber = (item.soNumber || '').trim().toUpperCase();
  const title = (item.title || '').trim().toUpperCase();

  const extracted = extractOrgPrefix(upc) || extractOrgPrefix(sku) || extractOrgPrefix(soNumber);
  if (extracted) return extracted;

  if (upc.startsWith('BB') || sku.startsWith('BB') || soNumber.startsWith('BB') || 
      title.startsWith('B&B') || title.startsWith('BB ') || title.startsWith('BB-') || 
      title.includes(' B&B ') || title.endsWith(' BB')) {
    return 'BB-';
  }
  if (upc.startsWith('PDXGL') || sku.startsWith('PDXGL') || soNumber.startsWith('PDXGL') || title.startsWith('PDXGL')) {
    return 'PDXGL-';
  }
  if (upc.startsWith('HUCK') || sku.startsWith('HUCK') || soNumber.startsWith('HUCK') || title.startsWith('HUCK')) {
    return 'HUCK-';
  }

  const partnerList = (currentTeam.value?.prefs as any)?.partnerPrefixes || [];
  for (const p of partnerList) {
    const pStr = normalizeOrgPrefix(typeof p === 'string' ? p : p?.prefix);
    if (pStr && (upc.startsWith(pStr) || sku.startsWith(pStr) || soNumber.startsWith(pStr))) {
      return pStr;
    }
  }

  return normalizeOrgPrefix((currentTeam.value?.prefs as any)?.upcPrefix || 'HUCK-');
};

const resolvePartnerName = (prefix: string): string => {
  const clean = prefix.replace(/[-_]$/, '');
  if (clean === 'HUCK') return 'Huckleberry Collective';
  if (clean === 'PDXGL') return 'PDX Game Library';
  if (clean === 'BB') return 'B&B Consignment (PDXGL Sub-Client)';

  const partnerList = (currentTeam.value?.prefs as any)?.partnerPrefixes || [];
  for (const p of partnerList) {
    const pStr = normalizeOrgPrefix(typeof p === 'string' ? p : p?.prefix);
    if (pStr === prefix && typeof p === 'object' && p.name) {
      return p.name;
    }
  }
  return `${clean} Partner`;
};

// Filter expenses by selected month and active tenant
const filteredExpenses = computed(() => {
  return expenses.value.filter(exp => {
    if (exp.status === 'rejected') return false;
    if (selectedPeriod.value === 'all') return true;
    if (!exp.date) return false;
    const cleanDate = exp.date.includes('T') ? exp.date.split('T')[0] : exp.date.split(' ')[0];
    const parts = cleanDate.split(/[-/]/);
    if (parts.length >= 2) {
      const year = parts[0].length === 4 ? parts[0] : parts[2];
      const month = parts[0].length === 4 ? parts[1] : parts[0];
      const key = `${year}-${month.padStart(2, '0')}`;
      return key === selectedPeriod.value;
    }
    return cleanDate.startsWith(selectedPeriod.value);
  });
});

const techOpsExpenses = computed(() => {
  return filteredExpenses.value.filter(e => {
    const cat = (e.category || '').toLowerCase();
    const desc = (e.description || '').toLowerCase();
    return cat.includes('tech') || cat.includes('ai') || 
           desc.includes('gemini') || desc.includes('appwrite') || 
           desc.includes('vercel') || desc.includes('hosting') || 
           desc.includes('software') || desc.includes('cloud') ||
           desc.includes('ai credits');
  });
});

const suppliesExpenses = computed(() => {
  return filteredExpenses.value.filter(e => {
    if (techOpsExpenses.value.some(t => t.id === e.id)) return false;
    const cat = (e.category || '').toLowerCase();
    if (cat.includes('rent') || cat.includes('mall fee')) return false;
    return true;
  });
});

const totalTechOpsAmount = computed(() => {
  return Number(techOpsExpenses.value.reduce((sum, e) => sum + Number(e.amount || 0), 0).toFixed(2));
});

const totalSuppliesAmount = computed(() => {
  return Number(suppliesExpenses.value.reduce((sum, e) => sum + Number(e.amount || 0), 0).toFixed(2));
});

// Member reimbursements from approved expenses
const memberReimbursements = computed(() => {
  const map: Record<string, number> = {};
  for (const exp of filteredExpenses.value) {
    if (exp.status === 'rejected') continue;
    const cat = (exp.category || '').toLowerCase();
    if (cat.includes('rent') || cat.includes('mall fee')) continue;
    const partnerPrefix = normalizeOrgPrefix(exp.partner || 'HUCK-');
    map[partnerPrefix] = Number(((map[partnerPrefix] || 0) + Number(exp.amount || 0)).toFixed(2));
  }
  return map;
});

// Memory Den pays out on the 15th of the month following the sales cycle
const memoryDenDisbursementDate = computed(() => {
  if (selectedPeriod.value === 'all') return '15th of each month';
  const parts = selectedPeriod.value.split(/[-/]/);
  if (parts.length >= 2) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10); // 1-12
    const nextDate = new Date(year, month, 15);
    return nextDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  return '15th of the month';
});

const partnerSettlements = computed(() => {
  if (filteredSales.value.length === 0) return [];

  const groups: Record<string, any> = {};
  const FIXED_BOOTH_RENT = 382.50;

  for (const sale of filteredSales.value) {
    const prefix = resolveItemPrefix(sale);
    const partnerName = resolvePartnerName(prefix);

    if (!groups[prefix]) {
      groups[prefix] = {
        prefix,
        name: partnerName,
        isConsignor: prefix === 'BB-',
        items: [],
        totalGross: 0,
        totalVenueFee: 0,
        totalCostBasis: 0,
        totalNetSurplus: 0,
        totalCuratorProfit: 0,
        grossCuratorShare: 0,
        rentDeduction: 0,
        reimbursements: 0,
        totalPayoutCheck: 0,
        totalCommonsTake: 0
      };
    }

    const isPureConsignor = prefix === 'BB-';
    const grossPrice = Number(sale.grossAmount || 0);
    const netStoreDeposit = Number(sale.netPayout !== undefined ? sale.netPayout : (grossPrice * 0.85));
    const venueFee = Math.max(0, Number(sale.fees !== undefined ? sale.fees : (grossPrice - netStoreDeposit)));
    const costBasis = isPureConsignor ? 0 : Number(sale.cost || 0);
    const netSurplus = Math.max(0, Number((netStoreDeposit - costBasis).toFixed(2)));
    const curatorTake = isPureConsignor ? netStoreDeposit : Number((costBasis + (netSurplus * 0.70)).toFixed(2));
    const commonsTake = isPureConsignor ? 0 : Number((netSurplus * 0.30).toFixed(2));

    groups[prefix].items.push({
      date: sale.date,
      sku: sale.sku || sale.upc || sale.soNumber || 'N/A',
      title: sale.title || 'Sold Item',
      grossPrice,
      venueFee,
      costBasis,
      netSurplus,
      curatorTake
    });

    groups[prefix].totalGross = Number((groups[prefix].totalGross + grossPrice).toFixed(2));
    groups[prefix].totalVenueFee = Number((groups[prefix].totalVenueFee + venueFee).toFixed(2));
    groups[prefix].totalCostBasis = Number((groups[prefix].totalCostBasis + costBasis).toFixed(2));
    groups[prefix].totalNetSurplus = Number((groups[prefix].totalNetSurplus + netSurplus).toFixed(2));
    groups[prefix].totalCuratorProfit = Number((groups[prefix].totalCuratorProfit + (isPureConsignor ? netStoreDeposit : (netSurplus * 0.70))).toFixed(2));
    groups[prefix].totalCommonsTake = Number((groups[prefix].totalCommonsTake + commonsTake).toFixed(2));
    groups[prefix].grossCuratorShare = Number((groups[prefix].totalCostBasis + groups[prefix].totalCuratorProfit).toFixed(2));
  }

  const allGroups = Object.values(groups);
  const totalGrossAll = Number(allGroups.reduce((sum, g) => sum + g.totalGross, 0).toFixed(2));

  for (const grp of allGroups) {
    const grossRatio = totalGrossAll > 0 ? (grp.totalGross / totalGrossAll) : 0;
    const rentShare = Number((grossRatio * FIXED_BOOTH_RENT).toFixed(2));
    grp.rentDeduction = rentShare;

    if (grp.isConsignor) {
      // Pure Consignor: Gross - 15% Mall Fee - Proportional Booth Rent Share
      grp.totalCuratorProfit = Math.max(0, Number((grp.totalGross - grp.totalVenueFee - rentShare).toFixed(2)));
      grp.totalPayoutCheck = grp.totalCuratorProfit;
    } else {
      // Co-op Member: Rent is covered by 30% Commons Pool
      const reimbursements = memberReimbursements.value[grp.prefix] || 0;
      grp.reimbursements = reimbursements;
      grp.totalPayoutCheck = Number((grp.grossCuratorShare + reimbursements).toFixed(2));
    }
  }

  return allGroups;
});

// Partner statements visible under the /sales partner filter (All Co-op | HUCK | BB | PDXGL)
const visiblePartnerSettlements = computed(() => {
  const f = (props.partnerFilter || 'all').toUpperCase();
  const list = f === 'ALL'
    ? [...partnerSettlements.value]
    : partnerSettlements.value.filter(p => String(p.prefix || '').replace(/[-_]$/, '').toUpperCase() === f);
  // Huckleberry Collective (HUCK-) always first
  const rank = (p: any) => (String(p.prefix || '').toUpperCase().startsWith('HUCK') ? 0 : 1);
  return list.sort((a, b) => rank(a) - rank(b));
});

const settlementSummary = computed(() => {
  const totalGross = Number(partnerSettlements.value.reduce((acc, p) => acc + p.totalGross, 0).toFixed(2));
  const totalVenueFee = Number(partnerSettlements.value.reduce((acc, p) => acc + p.totalVenueFee, 0).toFixed(2));
  const totalCostBasis = Number(partnerSettlements.value.reduce((acc, p) => acc + p.totalCostBasis, 0).toFixed(2));
  const totalNetSurplus = Number(partnerSettlements.value.reduce((acc, p) => acc + p.totalNetSurplus, 0).toFixed(2));
  const totalCuratorPayouts = Number(partnerSettlements.value.reduce((acc, p) => acc + p.totalPayoutCheck, 0).toFixed(2));
  const totalCommonsPool = Number(partnerSettlements.value.reduce((acc, p) => acc + p.totalCommonsTake, 0).toFixed(2));

  const FIXED_BOOTH_RENT = 382.50;
  const totalStorePayout = Number((totalGross - totalVenueFee).toFixed(2));
  const memoryDenNetCheck = Number((totalStorePayout - FIXED_BOOTH_RENT).toFixed(2));

  // Consignor Rent Contributions collected (e.g. B&B's rent deduction) offset the booth rent
  const consignorRentOffsets = Number(partnerSettlements.value.filter(p => p.isConsignor).reduce((acc, p) => acc + (p.rentDeduction || 0), 0).toFixed(2));
  const netBoothRentForCoop = Math.max(0, Number((FIXED_BOOTH_RENT - consignorRentOffsets).toFixed(2)));

  const techOps = totalTechOpsAmount.value;
  const supplies = totalSuppliesAmount.value;
  const totalCommonsOverhead = Number((netBoothRentForCoop + techOps + supplies).toFixed(2));
  const commonsNetBalance = Number((totalCommonsPool - totalCommonsOverhead).toFixed(2));
  const isCommonsFullyCovered = commonsNetBalance >= 0;

  return {
    totalGross,
    totalVenueFee,
    totalStorePayout,
    totalCostBasis,
    totalNetSurplus,
    totalCuratorPayouts,
    totalCommonsPool,
    boothRent: FIXED_BOOTH_RENT,
    consignorRentOffsets,
    netBoothRentForCoop,
    techOps,
    supplies,
    totalCommonsOverhead,
    commonsNetBalance,
    isCommonsFullyCovered,
    memoryDenNetCheck,
    memoryDenDisbursementDate: memoryDenDisbursementDate.value
  };
});

const getPeriodLabel = (): string => {
  if (selectedPeriod.value === 'all') return 'All Time Realized Sales';
  const found = availableMonths.value.find(m => m.key === selectedPeriod.value);
  if (found) return found.label;
  return selectedPeriod.value;
};

const downloadPartnerPdf = (partner: any) => {
  try {
    const data: PartnerStatementData = {
      statementDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      periodLabel: getPeriodLabel(),
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
      reimbursements: partner.reimbursements || 0,
      rentDeduction: partner.isConsignor ? (partner.rentDeduction || 0) : undefined
    };

    const doc = generatePartnerSettlementPdf(data);
    const filename = `Settlement_${partner.prefix.replace(/[-_]$/, '')}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
    addToast({ type: 'success', message: `Downloaded PDF statement for ${partner.name}!` });
  } catch (err: any) {
    console.error('PDF Generation Error:', err);
    addToast({ type: 'error', message: 'Failed to generate PDF statement: ' + err.message });
  }
};

const exportAllPartnerPdfs = () => {
  if (partnerSettlements.value.length === 0) {
    addToast({ type: 'warning', message: 'No partner statements to generate' });
    return;
  }
  partnerSettlements.value.forEach(p => downloadPartnerPdf(p));
  addToast({ type: 'success', message: `Downloaded ${partnerSettlements.value.length} partner settlement statements!` });
};
</script>
