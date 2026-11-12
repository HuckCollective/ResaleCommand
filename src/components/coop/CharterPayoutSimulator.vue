<template>
  <div class="card bg-base-100 border border-primary/30 shadow-xl overflow-hidden rounded-3xl">
    <div class="p-4 sm:p-6 bg-gradient-to-r from-primary/10 via-base-200/60 to-base-100 border-b border-base-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="flex items-center gap-2.5">
        <div class="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
          <Icon icon="solar:calculator-bold" class="w-6 h-6" />
        </div>
        <div>
          <h2 class="font-black text-lg sm:text-xl text-base-content">
            Live Member Payout Simulator ({{ liveCuratorPct }} / {{ liveCommonsPct }} Net Surplus)
          </h2>
          <p class="text-xs text-base-content/70">
            Test any item across retail booths, online marketplaces, or pop-ups to see your exact take-home check.
          </p>
        </div>
      </div>
      <span class="badge badge-sm badge-primary font-bold">Universal Channel Math</span>
    </div>

    <div class="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Inputs Column -->
      <div class="lg:col-span-5 space-y-4">
        <h3 class="font-bold text-xs uppercase tracking-wider text-base-content/60">Sale Inputs</h3>

        <div class="form-control">
          <label class="label py-1">
            <span class="label-text font-bold text-xs">Retail Customer Price</span>
            <span class="label-text-alt font-mono font-bold text-primary text-sm">${{ simSalePrice.toFixed(2) }}</span>
          </label>
          <input
            type="range"
            v-model.number="simSalePrice"
            min="10"
            max="250"
            step="5"
            class="range range-xs range-primary"
          />
        </div>

        <div class="form-control">
          <label class="label py-1">
            <span class="label-text font-bold text-xs">Your Acquisition Cost (100% Returned)</span>
            <span class="label-text-alt font-mono font-bold text-success text-sm">${{ simCostBasis.toFixed(2) }}</span>
          </label>
          <input
            type="range"
            v-model.number="simCostBasis"
            :max="maxCostSlider"
            min="0"
            step="2.5"
            class="range range-xs range-success"
          />
          <span class="text-[11px] text-base-content/60 mt-1">What you paid at thrift, estate sale, or auction.</span>
        </div>

        <div class="form-control space-y-1.5">
          <label class="label py-0">
            <span class="label-text font-bold text-xs">Sales Channel &amp; Platform Cut (Gate 1)</span>
            <span class="label-text-alt font-mono font-bold">{{ simVenueFeeRate }}%</span>
          </label>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            <button
              v-for="preset in channelPresets"
              :key="preset.id"
              type="button"
              class="btn btn-xs rounded-xl font-bold"
              :class="selectedPresetId === preset.id ? 'btn-primary text-primary-content' : 'btn-ghost border border-base-300'"
              @click="selectPreset(preset)"
            >
              {{ preset.label }}
            </button>
          </div>
        </div>

        <div class="form-control">
          <label class="label py-1">
            <span class="label-text font-bold text-xs">Outbound Shipping Label Postage (Online)</span>
            <span class="label-text-alt font-mono font-bold text-info text-sm">${{ simShippingCost.toFixed(2) }}</span>
          </label>
          <input
            type="range"
            v-model.number="simShippingCost"
            min="0"
            max="35"
            step="1"
            class="range range-xs range-info"
          />
          <span class="text-[11px] text-base-content/60 mt-1">100% recouped before Net Surplus is split.</span>
        </div>

        <div class="p-3.5 rounded-2xl bg-base-200/60 border border-base-300 text-[11px] space-y-1 text-base-content/75">
          <div class="font-bold text-base-content">Live Governance Split ({{ liveCuratorPct }} / {{ liveCommonsPct }}):</div>
          <p>
            You keep <strong>{{ liveCuratorPct }}% of Net Surplus</strong>. The Collective allocates <strong>{{ liveCommonsPct }}%</strong> to cover retail booth rent, pop-up fees, thermal labels, software, and Sweat-Equity marketing &amp; floor labor.
          </p>
        </div>
      </div>

      <!-- Waterfall Breakdown Column -->
      <div class="lg:col-span-7 bg-base-200/50 rounded-2xl p-4 sm:p-5 border border-base-300 space-y-3 flex flex-col justify-between">
        <div class="space-y-2.5">
          <div class="flex items-center justify-between text-xs font-bold text-base-content/70 px-1">
            <span>4-Gate Cooperative Waterfall</span>
            <span class="font-mono">Gross ${{ simSalePrice.toFixed(2) }}</span>
          </div>

          <div class="p-3 rounded-xl bg-base-100 border border-base-300 flex items-center justify-between text-xs">
            <div>
              <div class="font-bold text-base-content">Gate 1: Channel / Register Fee ({{ simVenueFeeRate }}%)</div>
              <div class="text-[10px] text-base-content/65">Net deposit after venue register or marketplace cut: ${{ simNetAfterVenue.toFixed(2) }}</div>
            </div>
            <span class="font-mono font-bold text-error text-sm">-${{ simVenueFee.toFixed(2) }}</span>
          </div>

          <div class="p-3 rounded-xl bg-success/10 border border-success/30 flex items-center justify-between text-xs">
            <div>
              <span class="font-bold text-success flex items-center gap-1.5">
                <Icon icon="solar:shield-check-bold" class="w-3.5 h-3.5 shrink-0" />
                <span>Gate 2: Your Cost Basis<span v-if="simShippingCost > 0"> + Shipping Postage</span> Returned (100%)</span>
              </span>
              <div class="text-[10px] text-base-content/65">Guaranteed dollar-for-dollar return of out-of-pocket spend</div>
            </div>
            <span class="font-mono font-black text-success text-sm">+${{ simCapitalReturned.toFixed(2) }}</span>
          </div>

          <div class="p-3 rounded-xl bg-primary/10 border border-primary/25 space-y-2 text-xs">
            <div class="flex items-center justify-between font-bold text-primary">
              <span>Gate 3: Net Surplus Generated (Profit to Split)</span>
              <span class="font-mono font-black text-sm">${{ simNetSurplus.toFixed(2) }}</span>
            </div>

            <div class="grid grid-cols-2 gap-2 pt-1">
              <div class="bg-base-100 p-2.5 rounded-xl border border-primary/20">
                <div class="text-[10px] text-base-content/60 font-semibold">Your Curator Profit ({{ liveCuratorPct }}%)</div>
                <div class="font-mono font-black text-sm text-success mt-0.5">+${{ simCuratorProfit.toFixed(2) }}</div>
              </div>
              <div class="bg-base-100 p-2.5 rounded-xl border border-primary/20">
                <div class="text-[10px] text-base-content/60 font-semibold">Commons Pool ({{ liveCommonsPct }}%)</div>
                <div class="font-mono font-black text-sm text-secondary mt-0.5">${{ simCommonsTake.toFixed(2) }}</div>
              </div>
            </div>
          </div>

          <div class="p-4 rounded-2xl bg-gradient-to-r from-success/20 to-primary/20 border border-success/40 flex items-center justify-between shadow-xs">
            <div>
              <div class="text-xs font-black uppercase tracking-wider text-base-content">
                Your Total Cash Payout
              </div>
              <div class="text-[11px] text-base-content/75 font-medium">
                Capital ($<span class="font-mono">{{ simCapitalReturned.toFixed(2) }}</span>) + Profit ($<span class="font-mono">{{ simCuratorProfit.toFixed(2) }}</span>)
              </div>
            </div>
            <div class="text-2xl sm:text-3xl font-black text-success font-mono">
              ${{ simTotalCuratorPayout.toFixed(2) }}
            </div>
          </div>
        </div>

        <div
          v-if="isAuthenticated"
          class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-base-100 border border-base-300"
        >
          <div class="space-y-0.5">
            <div class="font-bold text-xs text-base-content flex items-center gap-1.5">
              <Icon icon="solar:document-text-bold" class="w-4 h-4 text-primary shrink-0" />
              <span>Monthly Venue Payout CSV Ready?</span>
            </div>
            <div class="text-[11px] text-base-content/70">
              Reconcile POS register sales and generate 1-click partner PDF statements.
            </div>
          </div>
          <a href="/sales/import" class="btn btn-xs sm:btn-sm btn-primary text-primary-content rounded-xl gap-1.5 font-bold shrink-0 shadow-xs">
            <Icon icon="solar:import-bold-duotone" class="w-4 h-4 shrink-0" />
            <span>Launch Settlement Importer</span>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { getAllLocationSettingMetas } from '../../lib/warehouses';
import { DEFAULT_COOP_POLICY_CONFIG, loadCoopGovernanceState } from '../../lib/coopGovernance';

interface ChannelPreset {
  id: string;
  label: string;
  rate: number;
  defaultShipping: number;
}

defineProps<{
  isAuthenticated: boolean;
}>();

const locationMetas = computed(() => getAllLocationSettingMetas());

const channelPresets = computed<ChannelPreset[]>(() => {
  const retailPresets: ChannelPreset[] = locationMetas.value
    .filter((m) => m.commissionRate > 0 || m.monthlyRent > 0)
    .map((m) => ({
      id: `loc-${m.code}`,
      label: `${m.shortName} (${m.commissionRate}%)`,
      rate: m.commissionRate,
      defaultShipping: 0,
    }));

  return [
    ...retailPresets,
    { id: 'ebay-etsy', label: 'eBay / Etsy (13%)', rate: 13, defaultShipping: 8 },
    { id: 'poshmark', label: 'Poshmark (20%)', rate: 20, defaultShipping: 0 },
    { id: 'popup-card', label: 'Pop-up Card (2.9%)', rate: 2.9, defaultShipping: 0 },
    { id: 'popup-cash', label: 'Pop-up Cash (0%)', rate: 0, defaultShipping: 0 },
  ];
});

const initialPreset = channelPresets.value[0] || { id: 'default', label: 'Retail Booth', rate: 15, defaultShipping: 0 };

const selectedPresetId = ref<string>(initialPreset.id);
const simSalePrice = ref<number>(60);
const simCostBasis = ref<number>(10);
const simVenueFeeRate = ref<number>(initialPreset.rate);
const simShippingCost = ref<number>(initialPreset.defaultShipping);

const liveCuratorPct = ref<number>(DEFAULT_COOP_POLICY_CONFIG.curatorSharePct);
const liveCommonsPct = ref<number>(DEFAULT_COOP_POLICY_CONFIG.commonsSharePct);

const maxCostSlider = computed(() => Math.min(Math.round(simSalePrice.value * 0.7), 100));

watch(maxCostSlider, (cap) => {
  if (simCostBasis.value > cap) {
    simCostBasis.value = cap;
  }
});

const selectPreset = (preset: ChannelPreset) => {
  selectedPresetId.value = preset.id;
  simVenueFeeRate.value = preset.rate;
  simShippingCost.value = preset.defaultShipping;
};

const simVenueFee = computed(() => Number((simSalePrice.value * (simVenueFeeRate.value / 100)).toFixed(2)));
const simNetAfterVenue = computed(() => Math.max(0, Number((simSalePrice.value - simVenueFee.value).toFixed(2))));
const simNetDeposit = computed(() => Math.max(0, Number((simNetAfterVenue.value - simShippingCost.value).toFixed(2))));
const simNetSurplus = computed(() => Math.max(0, Number((simNetDeposit.value - simCostBasis.value).toFixed(2))));
const simCapitalReturned = computed(() =>
  Number(Math.min(simNetAfterVenue.value, simCostBasis.value + simShippingCost.value).toFixed(2))
);
const simCuratorProfit = computed(() => Number((simNetSurplus.value * (liveCuratorPct.value / 100)).toFixed(2)));
const simCommonsTake = computed(() => Number((simNetSurplus.value * (liveCommonsPct.value / 100)).toFixed(2)));
const simTotalCuratorPayout = computed(() => Number((simCapitalReturned.value + simCuratorProfit.value).toFixed(2)));

onMounted(async () => {
  try {
    const gov = await loadCoopGovernanceState();
    if (gov.policyConfig) {
      liveCuratorPct.value = gov.policyConfig.curatorSharePct;
      liveCommonsPct.value = gov.policyConfig.commonsSharePct;
    }
  } catch {
    // Keep default Charter split if unauthenticated or offline
  }
});
</script>

