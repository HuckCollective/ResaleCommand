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
          <!-- Time Period Selector -->
          <div class="form-control">
            <select v-model="selectedPeriod" class="select select-bordered select-sm font-bold text-xs h-9 min-h-9 rounded-xl">
              <option value="all">All Time ({{ sales.length }} sales)</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="memory_den">Memory Den Only</option>
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
        <div class="text-[11px] font-bold text-warning uppercase tracking-wider flex items-center gap-1">
          <span>🤝 Guarantee 3</span>
        </div>
        <div class="text-2xl font-black text-warning font-mono">+${{ settlementSummary.totalCommonsPool.toFixed(2) }}</div>
        <div class="text-xs font-bold" :class="settlementSummary.isRentCovered ? 'text-success' : 'text-warning'">
          {{ settlementSummary.isRentCovered ? `✅ Rent ($382.50) Covered (+${settlementSummary.commonsSurplusAfterRent.toFixed(2)})` : `Rent Shortfall: -$${Math.abs(settlementSummary.commonsSurplusAfterRent).toFixed(2)}` }}
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="partnerSettlements.length === 0" class="card bg-base-100 border border-base-200 shadow-sm p-12 text-center">
      <div class="w-12 h-12 rounded-full bg-base-200 text-base-content/50 flex items-center justify-center mx-auto mb-3">
        <Icon icon="solar:document-text-linear" class="w-6 h-6" />
      </div>
      <h3 class="text-base font-bold">No sales in selected period</h3>
      <p class="text-xs text-base-content/60 mt-1 max-w-sm mx-auto">
        Adjust the time filter above to include earlier dates or all-time sales.
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
              <div class="text-xs text-base-content/60 font-semibold uppercase tracking-wider">Final Payout Check</div>
              <div class="text-2xl font-black text-success font-mono">${{ partner.totalPayoutCheck.toFixed(2) }}</div>
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
import { ref, computed } from 'vue';
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
const selectedPeriod = ref<'all' | 'this_month' | 'last_month' | 'memory_den'>('all');

// Filter sales by selected period
const filteredSales = computed(() => {
  if (!props.sales || props.sales.length === 0) return [];

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  return props.sales.filter(s => {
    if (s.status === 'Cancelled') return false;

    if (selectedPeriod.value === 'memory_den') {
      const loc = (s.locationName || '').toLowerCase();
      return loc.includes('memory') || loc.includes('huck');
    }

    if (selectedPeriod.value === 'this_month') {
      if (!s.date) return false;
      const d = new Date(s.date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    }

    if (selectedPeriod.value === 'last_month') {
      if (!s.date) return false;
      const d = new Date(s.date);
      const targetMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const targetYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
    }

    return true; // 'all'
  });
});

const resolveItemPrefix = (item: SaleItem): string => {
  const upc = (item.upc || '').trim().toUpperCase();
  const sku = (item.sku || '').trim().toUpperCase();
  const title = (item.title || '').trim().toUpperCase();

  const extracted = extractOrgPrefix(upc) || extractOrgPrefix(sku);
  if (extracted) return extracted;

  if (upc.startsWith('PDXGL') || sku.startsWith('PDXGL') || title.startsWith('PDXGL')) {
    return 'PDXGL-';
  }
  if (upc.startsWith('HUCK') || sku.startsWith('HUCK') || title.startsWith('HUCK')) {
    return 'HUCK-';
  }

  const partnerList = (currentTeam.value?.prefs as any)?.partnerPrefixes || [];
  for (const p of partnerList) {
    const pStr = normalizeOrgPrefix(typeof p === 'string' ? p : p?.prefix);
    if (pStr && (upc.startsWith(pStr) || sku.startsWith(pStr))) {
      return pStr;
    }
  }

  return normalizeOrgPrefix((currentTeam.value?.prefs as any)?.upcPrefix || 'HUCK-');
};

const resolvePartnerName = (prefix: string): string => {
  const clean = prefix.replace(/[-_]$/, '');
  if (clean === 'HUCK') return 'Huckleberry Collective';
  if (clean === 'PDXGL') return 'PDX Game Library';

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
    groups[prefix].totalPayoutCheck = Number((groups[prefix].totalCostBasis + groups[prefix].totalCuratorProfit).toFixed(2));
  }

  return Object.values(groups);
});

const settlementSummary = computed(() => {
  const totalGross = partnerSettlements.value.reduce((acc, p) => acc + p.totalGross, 0);
  const totalVenueFee = partnerSettlements.value.reduce((acc, p) => acc + p.totalVenueFee, 0);
  const totalCostBasis = partnerSettlements.value.reduce((acc, p) => acc + p.totalCostBasis, 0);
  const totalNetSurplus = partnerSettlements.value.reduce((acc, p) => acc + p.totalNetSurplus, 0);
  const totalCuratorPayouts = partnerSettlements.value.reduce((acc, p) => acc + p.totalPayoutCheck, 0);
  const totalCommonsPool = partnerSettlements.value.reduce((acc, p) => acc + p.totalCommonsTake, 0);

  const FIXED_BOOTH_RENT = 382.50;
  const isRentCovered = totalCommonsPool >= FIXED_BOOTH_RENT;
  const commonsSurplusAfterRent = totalCommonsPool - FIXED_BOOTH_RENT;

  return {
    totalGross,
    totalVenueFee,
    totalCostBasis,
    totalNetSurplus,
    totalCuratorPayouts,
    totalCommonsPool,
    isRentCovered,
    commonsSurplusAfterRent
  };
});

const getPeriodLabel = (): string => {
  if (selectedPeriod.value === 'this_month') {
    return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  if (selectedPeriod.value === 'last_month') {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  if (selectedPeriod.value === 'memory_den') {
    return 'Memory Den Cumulative';
  }
  return 'All Time Realized Sales';
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
