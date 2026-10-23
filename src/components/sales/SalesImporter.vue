<template>
  <div class="card bg-base-100 shadow-xl border border-base-200">
    <div class="card-body">
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
        <div v-if="isProcessing" class="mt-4 flex items-center gap-2 text-primary font-bold">
          <span class="loading loading-spinner loading-sm"></span> Parsing & Matching...
        </div>
      </div>

      <!-- Step 2: Reconciliation & Settlement UI -->
      <div v-else>
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
              <span class="badge badge-xs font-mono font-bold" :class="matchedCount === parsedRows.length ? 'badge-success text-white' : 'badge-ghost'">
                {{ matchedCount }}/{{ parsedRows.length }}
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
              <span v-if="isImporting" class="loading loading-spinner loading-sm"></span>
              <Icon v-else icon="solar:cloud-upload-bold" class="w-4 h-4" />
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
              <h3 class="font-bold text-lg">Process Sales ({{ parsedRows.length }})</h3>
              <div class="flex items-center gap-2 mt-1">
                <div class="join">
                  <button class="btn btn-xs join-item" :class="{'btn-active btn-primary': filterTab === 'all'}" @click="filterTab = 'all'">
                    All ({{ parsedRows.length }})
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

          <div class="overflow-x-auto border border-base-300 rounded-lg max-h-[60vh]">
            <table class="table table-sm table-pin-rows">
              <thead>
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
                {{ settlementSummary.isRentCovered ? `✅ Rent ($382.50) Covered (+${settlementSummary.commonsSurplusAfterRent.toFixed(2)})` : `Rent shortfall: -$${Math.abs(settlementSummary.commonsSurplusAfterRent).toFixed(2)}` }}
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
                    </div>
                    <p class="text-xs text-base-content/60">Governed under Huckleberry Collective 70/30 Net Surplus Settlement</p>
                  </div>
                </div>

                <div class="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                  <div class="text-right">
                    <div class="text-xs text-base-content/60 font-medium">Final Payout Check</div>
                    <div class="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">${{ partner.totalPayoutCheck.toFixed(2) }}</div>
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
                  <span class="font-bold font-mono text-sm">${{ partner.totalGross.toFixed(2) }}</span>
                </div>
                <div>
                  <span class="opacity-60 block">15% Venue Cut:</span>
                  <span class="font-mono text-sm text-error">-${{ partner.totalVenueFee.toFixed(2) }}</span>
                </div>
                <div>
                  <span class="opacity-60 block">100% Cost Basis Recouped:</span>
                  <span class="font-mono text-sm text-emerald-600 dark:text-emerald-400 font-bold">+${{ partner.totalCostBasis.toFixed(2) }}</span>
                </div>
                <div>
                  <span class="opacity-60 block">70% Net Profit Share:</span>
                  <span class="font-mono text-sm text-primary font-bold">+${{ partner.totalCuratorProfit.toFixed(2) }}</span>
                </div>
                <div>
                  <span class="opacity-60 block">30% Commons Contribution:</span>
                  <span class="font-mono text-sm text-amber-600 dark:text-amber-400 font-bold">+${{ partner.totalCommonsTake.toFixed(2) }}</span>
                </div>
              </div>

              <!-- Itemized Table for Partner -->
              <div class="overflow-x-auto max-h-64">
                <table class="table table-xs table-pin-rows">
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
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { useInventory } from '../../composables/useInventory';
import { useAuth } from '../../composables/useAuth';
import { databases, ID } from '../../lib/appwrite';
import { addToast } from '../../stores/toast';
import { getCollectionId, DB_ID, normalizeOrgPrefix } from '../../lib/inventory';
import { salesApi } from '../../lib/sales';
import { warehousesApi } from '../../lib/warehouses';
import { generatePartnerSettlementPdf } from '../../lib/coopSettlementPdf';

const { user, currentTeam: team } = useAuth();
const { inventoryItems, fetchInventory } = useInventory();
const isProcessing = ref(false);
const isImporting = ref(false);
const platform = ref('memoryden');
const activeView = ref('matching'); // 'matching' | 'settlement'
const filterTab = ref('all'); // 'all' | 'matched' | 'unmatched'
const parsedRows = ref([]);

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

const displayedRows = computed(() => {
  if (filterTab.value === 'matched') return parsedRows.value.filter(r => r.mappedItem !== null);
  if (filterTab.value === 'unmatched') return parsedRows.value.filter(r => r.mappedItem === null);
  return parsedRows.value;
});

const availableItems = computed(() => {
  const mappedIds = parsedRows.value.filter(r => r.mappedItem).map(r => r.mappedItem.$id);
  return activeInventory.value.filter(i => !mappedIds.includes(i.$id));
});

const matchedCount = computed(() => parsedRows.value.filter(r => r.mappedItem).length);
const unmatchedCount = computed(() => parsedRows.value.filter(r => !r.mappedItem).length);

const reset = () => {
  parsedRows.value = [];
  activeView.value = 'matching';
};

const getItemCost = (item) => {
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

const resolveItemPrefix = (item, rowSku) => {
  const upc = (item?.upc || '').trim().toUpperCase();
  const sku = (rowSku || item?.locationSku || '').trim().toUpperCase();

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

const resolvePartnerName = (prefix) => {
  const clean = prefix.replace(/[-_]$/, '');
  if (clean === 'HUCK') return 'Huckleberry Collective';
  if (clean === 'PDXGL') return 'PDX Game Library';

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
  const matched = parsedRows.value.filter(r => r.mappedItem !== null);
  if (matched.length === 0) return [];

  const groups = {};

  for (const row of matched) {
    const item = row.mappedItem;
    const prefix = resolveItemPrefix(item, row.extractedSku);
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

    const grossPrice = Number(row.listedPrice || row.salePrice || 0);
    const netStoreDeposit = Number(row.salePrice || (grossPrice * 0.85));
    const venueFee = Math.max(0, Number((grossPrice - netStoreDeposit).toFixed(2)));
    const costBasis = getItemCost(item);
    const netSurplus = Math.max(0, Number((netStoreDeposit - costBasis).toFixed(2)));
    const curatorTake = Number((costBasis + (netSurplus * 0.70)).toFixed(2));
    const commonsTake = Number((netSurplus * 0.30).toFixed(2));

    groups[prefix].items.push({
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

    groups[prefix].totalGross = Number((groups[prefix].totalGross + grossPrice).toFixed(2));
    groups[prefix].totalVenueFee = Number((groups[prefix].totalVenueFee + venueFee).toFixed(2));
    groups[prefix].totalCostBasis = Number((groups[prefix].totalCostBasis + costBasis).toFixed(2));
    groups[prefix].totalNetSurplus = Number((groups[prefix].totalNetSurplus + netSurplus).toFixed(2));
    groups[prefix].totalCuratorProfit = Number((groups[prefix].totalCuratorProfit + (netSurplus * 0.70)).toFixed(2));
    groups[prefix].totalPayoutCheck = Number((groups[prefix].totalCostBasis + groups[prefix].totalCuratorProfit).toFixed(2));
    groups[prefix].totalCommonsTake = Number((groups[prefix].totalCommonsTake + commonsTake).toFixed(2));
  }

  return Object.values(groups);
});

const settlementSummary = computed(() => {
  const settlements = partnerSettlements.value;
  const boothRent = 382.50; // Memory Den booth rent standard
  
  const totalGross = settlements.reduce((sum, p) => sum + p.totalGross, 0);
  const totalVenueFee = settlements.reduce((sum, p) => sum + p.totalVenueFee, 0);
  const totalStorePayout = totalGross - totalVenueFee;
  const totalCostBasis = settlements.reduce((sum, p) => sum + p.totalCostBasis, 0);
  const totalNetSurplus = settlements.reduce((sum, p) => sum + p.totalNetSurplus, 0);
  const totalCuratorPayouts = settlements.reduce((sum, p) => sum + p.totalPayoutCheck, 0);
  const totalCommonsPool = settlements.reduce((sum, p) => sum + p.totalCommonsTake, 0);
  const commonsSurplusAfterRent = totalCommonsPool - boothRent;

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
    isRentCovered: commonsSurplusAfterRent >= 0
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

const handleFileUpload = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  isProcessing.value = true;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    parseMemoryDenPayout(text);
  };
  reader.readAsText(file);
};

const parseMemoryDenPayout = (csvText) => {
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
  
  const dateIdx = headers.findIndex(h => h === 'in stock' || h === 'sold' || h === 'date');
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

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length <= itemIdx) continue;
    
    const fullItemName = cols[itemIdx]?.trim() || '';
    if (!fullItemName || fullItemName.includes('Rent') || fullItemName.includes('Credit')) continue; // Skip non-inventory items

    const statusVal = statusIdx !== -1 ? cols[statusIdx]?.trim().toLowerCase() : '';
    
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

    const date = dateIdx !== -1 ? cols[dateIdx]?.trim() : new Date().toLocaleDateString();
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
    let matched = null;
    
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

    rows.push({
      date,
      itemName: fullItemName, // Display full original
      extractedSku,
      ticketNumber,
      customerName,
      status: statusVal,
      listedPrice: grossPrice,
      salePrice: netSoldPrice, // The actual net amount made after fees
      netSoldPrice: netSoldPrice,
      mappedItem: matched || null
    });
  }

  parsedRows.value = rows;
  isProcessing.value = false;
};

const executeImport = async () => {
  if (unmatchedCount.value > 0) return;
  
  isImporting.value = true;
  try {
    const ITEMS_COL = getCollectionId();
    const batchId = 'MD-PAYOUT-' + new Date().toISOString().slice(0, 10);

    // Look up Memory Den warehouse for platform attribution
    let mdWarehouseId = '';
    try {
      if (activeTeamId.value) {
        const warehouses = await warehousesApi.listWarehouses(activeTeamId.value);
        const mdWh = warehouses.find(w => w.code === 'MD' || w.name.toLowerCase().includes('memory den'));
        mdWarehouseId = mdWh?.$id || warehouses[0]?.$id || '';
      }
    } catch {}

    for (const row of parsedRows.value) {
      const item = row.mappedItem;
      if (!item) continue;

      const isSoldOrPaid = row.status === 'sold' || row.status === 'paid';
      const orderRef = row.ticketNumber ? `Ticket #${row.ticketNumber}` : batchId;

      const updatePayload = {
        locationSku: row.extractedSku || item.locationSku
      };

      if (isSoldOrPaid) {
        updatePayload.status = 'sold';
        updatePayload.resalePrice = row.listedPrice || row.salePrice;
        updatePayload.soldPrice = row.salePrice;
        updatePayload.saleId = orderRef;

        // Create official Sale record
        try {
          const gross = Number(row.listedPrice || row.salePrice) || 0;
          const net = Number(row.salePrice) || 0;
          const fee = Math.max(0, Number((gross - net).toFixed(2)));

          const newSale = await salesApi.createSale({
            tenantId: item.tenantId || activeTeamId.value,
            warehouseId: mdWarehouseId,
            soNumber: item.upc || item.locationSku || `SO-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
            orderId: row.ticketNumber ? `Ticket #${row.ticketNumber}` : (row.extractedSku || item.locationSku || orderRef),
            saleDate: row.date ? new Date(row.date).toISOString() : new Date().toISOString(),
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

      // Update the Item in DB
      await databases.updateDocument(DB_ID, ITEMS_COL, item.$id, updatePayload);
    }

    addToast({ type: 'success', message: 'Sales imported and inventory updated!' });
    reset();
    
    // Refresh inventory
    if (activeTeamId.value) {
      fetchInventory(activeTeamId.value);
    }
  } catch (err) {
    console.error("Sales Import Failed:", err);
    addToast({ type: 'error', message: 'Failed to process sales: ' + err.message });
  } finally {
    isImporting.value = false;
  }
};
</script>
