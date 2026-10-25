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
            <select v-model="selectedPeriod" class="select select-bordered select-sm font-bold text-xs h-9 min-h-9 rounded-xl font-mono">
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

      <div class="card bg-base-100 p-4 sm:p-5 rounded-2xl border border-warning/30 shadow-sm space-y-1 bg-warning/5">
        <div class="text-[11px] font-bold text-warning uppercase tracking-wider flex items-center justify-between gap-1">
          <span>🤝 Guarantee 3</span>
          <a href="/expenses" class="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5">
            <span>Expenses</span>
            <Icon icon="solar:arrow-right-linear" class="w-3 h-3" />
          </a>
        </div>
        <div class="text-2xl font-black text-warning font-mono">+${{ settlementSummary.totalCommonsPool.toFixed(2) }}</div>
        <div class="text-xs font-bold" :class="settlementSummary.isRentCovered ? 'text-success' : 'text-warning'">
          {{ settlementSummary.isRentCovered ? `✅ Rent ($382.50) Covered (+${settlementSummary.commonsSurplusAfterRent.toFixed(2)})` : `Rent Shortfall: -$${Math.abs(settlementSummary.commonsSurplusAfterRent).toFixed(2)}` }}
        </div>
      </div>
    </div>

    <!-- Memory Den Check Reconciliation Banner -->
    <div class="card bg-base-100 border border-base-200 shadow-sm rounded-2xl p-4 sm:p-5">
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

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-xs">
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
          <span class="font-bold font-mono text-sm text-warning font-black">-$382.50</span>
        </div>
        <div>
          <span class="text-primary block">4. Net Mall Deposit</span>
          <span class="font-bold font-mono text-sm text-primary font-black">${{ settlementSummary.memoryDenNetCheck.toFixed(2) }}</span>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="partnerSettlements.length === 0" class="card bg-base-100 border border-base-200 shadow-sm p-12 text-center">
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
        v-for="partner in partnerSettlements" 
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
                {{ partner.prefix === 'HUCK-' ? 'Net Bank Check (After Rent)' : 'Final Payout Check' }}
              </div>
              <div class="text-2xl font-black font-mono" :class="partner.totalPayoutCheck < 0 ? 'text-error' : 'text-success'">
                ${{ partner.totalPayoutCheck.toFixed(2) }}
              </div>
              <div v-if="partner.rentDeduction > 0" class="text-[10px] text-base-content/60 font-medium">
                Gross ${{ partner.grossCuratorShare.toFixed(2) }} - Rent ${{ partner.rentDeduction.toFixed(2) }}
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
          <div>
            <span class="opacity-60 block font-medium">100% Cost Basis Recouped:</span>
            <span class="font-mono text-sm text-success font-bold">+${{ partner.totalCostBasis.toFixed(2) }}</span>
          </div>
          <div>
            <span class="opacity-60 block font-medium">70% Net Profit Share:</span>
            <span class="font-mono text-sm text-primary font-bold">+${{ partner.totalCuratorProfit.toFixed(2) }}</span>
          </div>
          <div>
            <span class="opacity-60 block font-medium">30% Commons Contribution:</span>
            <span class="font-mono text-sm text-warning font-bold">+${{ partner.totalCommonsTake.toFixed(2) }}</span>
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
                <th class="text-right font-bold text-success">Curator Take (70%)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(it, iIdx) in partner.items" :key="iIdx" class="hover:bg-base-200/40">
                <td class="font-mono text-xs">{{ it.date ? String(it.date).slice(0, 10) : 'N/A' }}</td>
                <td class="font-mono text-xs font-semibold">{{ it.sku }}</td>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { addToast } from '../../stores/toast';
import { useAuth } from '../../composables/useAuth';
import { normalizeOrgPrefix, extractOrgPrefix } from '../../lib/inventoryUpc';
import { generatePartnerSettlementPdf, type PartnerStatementData } from '../../lib/coopSettlementPdf';

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
}>();

const { currentTeam } = useAuth();
const selectedPeriod = ref<string>('all');
const selectedLocation = ref<'memory_den' | 'all'>('memory_den');

// Dynamically extract all distinct monthly settlement cycles from real sales data
const availableMonths = computed(() => {
  const months = new Map<string, { key: string; label: string; count: number; date: Date }>();
  for (const s of props.sales) {
    if (!s.date || s.status === 'Cancelled') continue;
    const cleanDate = s.date.includes('T') ? s.date.split('T')[0] : s.date.split(' ')[0];
    const parts = cleanDate.split(/[-/]/);
    if (parts.length >= 2) {
      let year = parts[0].length === 4 ? parts[0] : parts[2];
      let month = parts[0].length === 4 ? parts[1] : parts[0];
      if (year && month && year.length === 4) {
        const key = `${year}-${month.padStart(2, '0')}`;
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

// Default to the most recent month that has real sales instead of all-time cumulative
watch(availableMonths, (months) => {
  if (months.length > 0 && selectedPeriod.value === 'all') {
    selectedPeriod.value = months[0].key;
  }
}, { immediate: true });

// Filter sales by selected month and location
const filteredSales = computed(() => {
  if (!props.sales || props.sales.length === 0) return [];

  return props.sales.filter(s => {
    if (s.status === 'Cancelled') return false;

    // Venue isolation filter
    if (selectedLocation.value === 'memory_den') {
      const loc = (s.locationName || '').toLowerCase();
      const sku = (s.sku || '').toLowerCase();
      const upc = (s.upc || '').toLowerCase();
      const soNumber = (s.soNumber || '').toLowerCase();
      const orderId = ((s as any).orderId || '').toLowerCase();
      const title = (s.title || '').toLowerCase();
      const isMd = loc.includes('memory') || loc.includes('0ej') || sku.includes('0ej') || upc.includes('0ej') || 
                   loc.includes('huck') || title.includes('0ej') || soNumber.startsWith('bb-') || 
                   soNumber.startsWith('pdxgl-') || orderId.startsWith('md-') || loc.includes('booth');
      if (!isMd) return false;
    }

    if (selectedPeriod.value === 'all') return true;

    if (!s.date) return false;
    const cleanDate = s.date.includes('T') ? s.date.split('T')[0] : s.date.split(' ')[0];
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

const partnerSettlements = computed(() => {
  if (filteredSales.value.length === 0) return [];

  const groups: Record<string, any> = {};

  for (const sale of filteredSales.value) {
    const prefix = resolveItemPrefix(sale);
    const partnerName = resolvePartnerName(prefix);

    if (!groups[prefix]) {
      groups[prefix] = {
        prefix,
        name: partnerName,
        items: [],
        totalGross: 0,
        totalVenueFee: 0,
        totalCostBasis: 0,
        totalNetSurplus: 0,
        totalCuratorProfit: 0,
        grossCuratorShare: 0,
        rentDeduction: 0,
        totalPayoutCheck: 0,
        totalCommonsTake: 0
      };
    }

    const grossPrice = Number(sale.grossAmount || 0);
    const netStoreDeposit = Number(sale.netPayout !== undefined ? sale.netPayout : (grossPrice * 0.85));
    const venueFee = Math.max(0, Number(sale.fees !== undefined ? sale.fees : (grossPrice - netStoreDeposit)));
    const costBasis = Number(sale.cost || 0);
    const netSurplus = Math.max(0, Number((netStoreDeposit - costBasis).toFixed(2)));
    const curatorTake = Number((costBasis + (netSurplus * 0.70)).toFixed(2));
    const commonsTake = Number((netSurplus * 0.30).toFixed(2));

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
    groups[prefix].totalCuratorProfit = Number((groups[prefix].totalCuratorProfit + (netSurplus * 0.70)).toFixed(2));
    groups[prefix].totalCommonsTake = Number((groups[prefix].totalCommonsTake + commonsTake).toFixed(2));
    groups[prefix].grossCuratorShare = Number((groups[prefix].totalCostBasis + groups[prefix].totalCuratorProfit).toFixed(2));

    // For Huckleberry Collective (anchor leaseholder), show the net bank payout after Memory Den deducts the $382.50 rent
    if (prefix === 'HUCK-' && selectedLocation.value === 'memory_den') {
      groups[prefix].rentDeduction = 382.50;
      groups[prefix].totalPayoutCheck = Number((groups[prefix].grossCuratorShare - 382.50).toFixed(2));
    } else {
      groups[prefix].rentDeduction = 0;
      groups[prefix].totalPayoutCheck = groups[prefix].grossCuratorShare;
    }
  }

  return Object.values(groups);
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
  const isRentCovered = totalCommonsPool >= FIXED_BOOTH_RENT;
  const commonsSurplusAfterRent = Number((totalCommonsPool - FIXED_BOOTH_RENT).toFixed(2));

  return {
    totalGross,
    totalVenueFee,
    totalStorePayout,
    totalCostBasis,
    totalNetSurplus,
    totalCuratorPayouts,
    totalCommonsPool,
    boothRent: FIXED_BOOTH_RENT,
    memoryDenNetCheck,
    isRentCovered,
    commonsSurplusAfterRent
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
      boothLocation: 'Memory Den (Booth 0EJ)'
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
