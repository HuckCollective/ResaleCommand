<template>
  <dialog ref="modalRef" class="modal modal-bottom sm:modal-middle" :class="{ 'modal-open': isOpen }">
    <div class="modal-box w-full max-w-4xl max-h-[92vh] flex flex-col p-4 sm:p-6 bg-base-100 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
      
      <!-- HEADER -->
      <div class="flex items-center justify-between border-b border-base-200 pb-3">
        <div class="flex items-center gap-2 min-w-0">
          <div class="p-2 bg-primary/10 text-primary rounded-xl shrink-0">
            <Icon icon="solar:scissors-square-bold-duotone" class="w-6 h-6" />
          </div>
          <div class="truncate">
            <h3 class="font-black text-base sm:text-lg tracking-tight truncate">Lot Splitter & Curation Wizard</h3>
            <p class="text-xs text-base-content/60 truncate">{{ lotItem?.title || 'Master Lot' }} • {{ totalItemCount }} Total Pieces</p>
          </div>
        </div>
        <button type="button" class="btn btn-sm btn-circle btn-ghost" @click="closeWizard">✕</button>
      </div>

      <!-- PROGRESS STEPS (Mobile scrollable) -->
      <div class="py-2 border-b border-base-200/60 overflow-x-auto no-scrollbar">
        <ul class="steps steps-horizontal w-full min-w-[340px] text-xs font-bold">
          <li class="step" :class="{ 'step-primary': step >= 1 }">1. Tiers Setup</li>
          <li class="step" :class="{ 'step-primary': step >= 2 }">2. Assign Items</li>
          <li class="step" :class="{ 'step-primary': step >= 3 }">3. Costs & Pricing</li>
          <li class="step" :class="{ 'step-primary': step >= 4 }">4. Create SKUs</li>
        </ul>
      </div>

      <!-- WIZARD BODY (Scrollable) -->
      <div class="flex-1 overflow-y-auto py-4 space-y-4 pr-1">

        <!-- ==================================================== -->
        <!-- STEP 1: CONFIGURE CUSTOM TIERS & OUTPUT FORMATS      -->
        <!-- ==================================================== -->
        <div v-if="step === 1" class="space-y-4">
          <div class="bg-base-200/50 p-3 rounded-xl text-xs text-base-content/80 flex items-start gap-2">
            <Icon icon="solar:info-circle-bold" class="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <span>Customize your pricing tiers and select the <b>Listing Format</b> for each tier. You can add as many custom tiers as needed.</span>
          </div>

          <div class="space-y-3">
            <div 
              v-for="(tier, tIdx) in tiers" 
              :key="tier.id"
              class="p-4 rounded-xl border border-base-200 bg-base-100 shadow-xs space-y-3 relative group"
            >
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 flex-1 min-w-0">
                  <span class="badge badge-sm font-mono font-bold" :class="getTierBadgeClass(tIdx)">Tier {{ tIdx + 1 }}</span>
                  <input 
                    type="text" 
                    v-model="tier.name" 
                    class="input input-sm input-bordered font-bold text-sm w-full max-w-xs"
                    placeholder="Tier Name"
                  />
                </div>
                <button 
                  v-if="tiers.length > 1"
                  type="button" 
                  class="btn btn-xs btn-circle btn-ghost text-error" 
                  @click="removeTier(tIdx)"
                  title="Remove Tier"
                >
                  ✕
                </button>
              </div>

              <!-- Output Listing Mode Selection -->
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <label 
                  class="flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors text-xs"
                  :class="tier.mode === 'single' ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-base-200 hover:bg-base-200/40'"
                >
                  <input type="radio" :name="`mode-${tier.id}`" value="single" v-model="tier.mode" class="radio radio-xs radio-primary" />
                  <div>
                    <div class="font-bold">🌟 Single Items</div>
                    <div class="text-[10px] opacity-70">Dedicated high-ticket tags</div>
                  </div>
                </label>

                <label 
                  class="flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors text-xs"
                  :class="tier.mode === 'multi_qty' ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-base-200 hover:bg-base-200/40'"
                >
                  <input type="radio" :name="`mode-${tier.id}`" value="multi_qty" v-model="tier.mode" class="radio radio-xs radio-primary" />
                  <div>
                    <div class="font-bold">📦 Multi-Qty SKU</div>
                    <div class="text-[10px] opacity-70">1 listing (Qty: {{ getTierItemCount(tier.id) }})</div>
                  </div>
                </label>

                <label 
                  class="flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors text-xs"
                  :class="tier.mode === 'bundle' ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-base-200 hover:bg-base-200/40'"
                >
                  <input type="radio" :name="`mode-${tier.id}`" value="bundle" v-model="tier.mode" class="radio radio-xs radio-primary" />
                  <div>
                    <div class="font-bold">🎁 Mini-Lot Bundle</div>
                    <div class="text-[10px] opacity-70">Sold together as 1 set</div>
                  </div>
                </label>
              </div>

              <!-- Price settings with Dynamic AI Average Suggestion -->
              <div class="flex items-center justify-between text-xs pt-1 border-t border-base-200/40">
                <div class="flex items-center gap-2">
                  <span class="text-base-content/70">Target Price / Unit:</span>
                  <div class="relative w-24">
                    <span class="absolute left-2.5 top-1.5 font-bold text-xs">$</span>
                    <input 
                      type="number" 
                      v-model.number="tier.targetPrice" 
                      @input="onTierPriceInput(tier)"
                      step="0.50" 
                      min="1" 
                      class="input input-xs input-bordered pl-6 font-mono font-bold w-full" 
                    />
                  </div>
                  <button 
                    v-if="getTierAiAverage(tier.id) > 0 && getTierAiAverage(tier.id) !== tier.targetPrice"
                    type="button" 
                    class="btn btn-xs btn-ghost text-primary text-[10px] gap-1 px-1.5"
                    @click="tier.targetPrice = getTierAiAverage(tier.id); onTierPriceInput(tier)"
                    title="Click to apply AI calculated average price"
                  >
                    <span>AI Avg: ${{ getTierAiAverage(tier.id).toFixed(2) }} ↺</span>
                  </button>
                  <span v-else-if="getTierAiAverage(tier.id) > 0" class="text-[10px] text-base-content/50">
                    (AI Avg: ${{ getTierAiAverage(tier.id).toFixed(2) }})
                  </span>
                </div>
                <div class="font-bold text-xs">
                  {{ getTierItemCount(tier.id) }} items assigned
                </div>
              </div>
            </div>
          </div>

          <button 
            type="button" 
            class="btn btn-sm btn-outline btn-primary w-full gap-2 border-dashed"
            @click="addCustomTier"
          >
            <Icon icon="solar:add-circle-bold" class="w-4 h-4" />
            + Add Another Custom Tier
          </button>
        </div>

        <!-- ==================================================== -->
        <!-- STEP 2: ASSIGN ITEMS TO TIERS (MOBILE 1-TAP PILLS)   -->
        <!-- ==================================================== -->
        <div v-if="step === 2" class="space-y-4">
          <!-- Selection & Move Guidance Banner -->
          <div class="alert alert-info py-2 px-3 text-[11px] shadow-xs flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Icon icon="solar:info-circle-bold" class="w-4 h-4 shrink-0" />
              <span>Tap the <b>Tier badge</b> on any item to reassign it, or check boxes to <b>bulk move</b>.</span>
            </div>
            <span class="badge badge-xs badge-neutral font-bold">{{ allItems.length }} total</span>
          </div>

          <!-- Tier Filter Tabs -->
          <div class="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button 
              type="button" 
              class="btn btn-xs rounded-full font-bold"
              :class="activeFilterTab === 'all' ? 'btn-primary' : 'btn-ghost border border-base-200'"
              @click="activeFilterTab = 'all'"
            >
              All Items ({{ allItems.length }})
            </button>
            <button 
              v-for="(tier, idx) in tiers" 
              :key="tier.id"
              type="button"
              class="btn btn-xs rounded-full gap-1 font-bold"
              :class="activeFilterTab === tier.id ? 'btn-primary' : 'btn-ghost border border-base-200'"
              @click="activeFilterTab = tier.id"
            >
              <span class="w-2 h-2 rounded-full" :class="getTierDotClass(idx)"></span>
              Tier {{ idx + 1 }} ({{ getTierItemCount(tier.id) }})
            </button>
          </div>

          <!-- Column Header Labels -->
          <div class="hidden sm:flex items-center justify-between px-3 text-[10px] uppercase font-bold text-base-content/50 tracking-wider">
            <div class="flex items-center gap-6">
              <span>Select</span>
              <span>Item Description &amp; Fair Comps</span>
            </div>
            <div class="flex items-center gap-12 pr-2">
              <span>Tag Price</span>
              <span>Assigned Tier</span>
            </div>
          </div>

          <!-- Empty State if filtered tab has 0 items -->
          <div v-if="filteredItems.length === 0" class="p-8 text-center bg-base-200/40 rounded-xl space-y-3">
            <Icon icon="solar:box-minimalistic-linear" class="w-10 h-10 mx-auto text-base-content/40" />
            <div class="space-y-1">
              <div class="font-bold text-xs sm:text-sm">No items currently in this tier tab</div>
              <p class="text-[11px] text-base-content/60">Tap "All Items" or another tier above to view and assign your items.</p>
            </div>
            <button type="button" class="btn btn-xs btn-primary font-bold" @click="activeFilterTab = 'all'">
              View All Items ({{ allItems.length }})
            </button>
          </div>

          <!-- Items Card List -->
          <div v-else class="space-y-2">
            <div 
              v-for="item in filteredItems" 
              :key="item.index"
              class="p-3 rounded-xl border transition-all flex items-center justify-between gap-3"
              :class="selectedItemIndices.has(item.index) ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40' : 'border-base-200 bg-base-100 shadow-xs hover:border-primary/40'"
            >
              <!-- Checkbox, Thumbnail & Info -->
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <input 
                  type="checkbox" 
                  :checked="selectedItemIndices.has(item.index)" 
                  @change="toggleSelect(item.index)" 
                  class="checkbox checkbox-xs checkbox-primary shrink-0" 
                  title="Check to select for bulk move"
                />
                
                <div class="w-10 h-10 rounded-lg bg-base-200 overflow-hidden shrink-0 border border-base-200 relative">
                  <img v-if="item.image_url" :src="item.image_url" class="w-full h-full object-cover" />
                  <Icon v-else icon="solar:book-bookmark-bold-duotone" class="w-6 h-6 m-2 text-base-content/40" />
                </div>

                <div class="min-w-0 flex-1">
                  <div class="font-bold text-xs sm:text-sm truncate">{{ item.title }}</div>
                  <div class="text-[11px] text-base-content/60 flex items-center gap-2">
                    <span v-if="item.condition" class="badge badge-xs badge-ghost">{{ item.condition }}</span>
                    <span>Est: <b>{{ item.estimated_value || '$15 - $25' }}</b></span>
                  </div>
                </div>
              </div>

              <!-- Individual Tag Price Input & Tier Move Badge -->
              <div class="flex items-center gap-2 shrink-0">
                <div class="relative w-18" title="Retail tag price for this specific item">
                  <span class="absolute left-2 top-1 font-bold text-[11px] text-base-content/50">$</span>
                  <input 
                    type="number" 
                    v-model.number="item.customPrice" 
                    @input="item.isPriceOverridden = true"
                    step="0.50" 
                    min="1"
                    class="input input-xs input-bordered pl-5 font-mono font-bold text-xs w-full text-right" 
                  />
                </div>

                <!-- 1-Tap Tier Selector Button (Mobile First) -->
                <div class="dropdown dropdown-end shrink-0">
                  <label tabindex="0" class="btn btn-xs rounded-full font-bold gap-1 cursor-pointer" :class="getTierBadgeClass(getTierIndex(item.tierId))" title="Tap to move to another tier">
                    <span>{{ getTierShortName(item.tierId) }}</span>
                    <Icon icon="solar:alt-arrow-down-linear" class="w-3 h-3" />
                  </label>
                  <ul tabindex="0" class="dropdown-content z-30 menu p-2 shadow-2xl bg-base-100 rounded-xl w-52 border border-base-200 text-xs mt-1">
                    <li class="menu-title text-[10px] uppercase font-bold opacity-60">Move to Tier</li>
                    <li v-for="(t, idx) in tiers" :key="t.id">
                      <a 
                        @click="assignItemToTier(item.index, t.id)"
                        :class="{ 'active font-bold': item.tierId === t.id }"
                      >
                        <span class="w-2 h-2 rounded-full" :class="getTierDotClass(idx)"></span>
                        {{ t.name }}
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <!-- Sticky Bottom Bulk Action Bar on Mobile -->
          <div 
            v-if="selectedItemIndices.size > 0"
            class="sticky bottom-0 z-20 p-3 bg-base-300/95 backdrop-blur-md rounded-xl border border-primary/30 flex items-center justify-between shadow-xl"
          >
            <div class="text-xs font-bold">
              <span>{{ selectedItemIndices.size }}</span> items selected
            </div>
            <div class="flex items-center gap-2">
              <div class="dropdown dropdown-top dropdown-end">
                <label tabindex="0" class="btn btn-xs btn-primary font-bold gap-1">
                  <span>Move Selected ▾</span>
                </label>
                <ul tabindex="0" class="dropdown-content z-30 menu p-2 shadow-2xl bg-base-100 rounded-xl w-52 border border-base-200 text-xs mb-1">
                  <li v-for="(t, idx) in tiers" :key="t.id">
                    <a @click="moveSelectedToTier(t.id)">
                      <span class="w-2 h-2 rounded-full" :class="getTierDotClass(idx)"></span>
                      Move to {{ t.name }}
                    </a>
                  </li>
                </ul>
              </div>
              <button type="button" class="btn btn-xs btn-ghost" @click="selectedItemIndices.clear()">Clear</button>
            </div>
          </div>
        </div>

        <!-- ==================================================== -->
        <!-- STEP 3: COST BASIS & PROFIT PROJECTIONS              -->
        <!-- ==================================================== -->
        <div v-if="step === 3" class="space-y-4">
          <!-- Total Cost Summary Card with Immutable PO Badge -->
          <div class="p-4 rounded-xl bg-base-200/60 border border-base-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center relative">
            <div>
              <div class="text-[10px] uppercase font-bold text-base-content/60 flex items-center justify-center gap-1">
                <Icon icon="solar:lock-bold" class="w-3 h-3 text-primary" />
                Original PO Cost
              </div>
              <div class="text-base font-mono font-black text-primary">${{ totalCost.toFixed(2) }}</div>
              <div class="text-[9px] text-base-content/50">Immutable Basis</div>
            </div>
            <div>
              <div class="text-[10px] uppercase font-bold text-base-content/60">Total Pieces</div>
              <div class="text-base font-black">{{ totalItemCount }}</div>
            </div>
            <div>
              <div class="text-[10px] uppercase font-bold text-base-content/60">Proj. Total Sales</div>
              <div class="text-base font-mono font-black text-success">${{ projectedGrossSales.toFixed(2) }}</div>
            </div>
            <div>
              <div class="text-[10px] uppercase font-bold text-base-content/60">Est. Net Profit</div>
              <div class="text-base font-mono font-black text-success">+${{ projectedNetProfit.toFixed(2) }}</div>
            </div>
          </div>

          <!-- Cost Allocation Switcher -->
          <div class="form-control p-3 bg-base-100 rounded-xl border border-base-200 space-y-2">
            <label class="label-text font-bold text-xs">Cost Allocation Method:</label>
            <div class="flex gap-4">
              <label class="flex items-center gap-2 text-xs cursor-pointer">
                <input type="radio" value="equal" v-model="costAllocationMode" class="radio radio-xs radio-primary" />
                <span><b>Equal Split:</b> ${{ (totalCost / (totalItemCount || 1)).toFixed(2) }}/unit</span>
              </label>
              <label class="flex items-center gap-2 text-xs cursor-pointer">
                <input type="radio" value="weighted" v-model="costAllocationMode" class="radio radio-xs radio-primary" />
                <span><b>Value-Weighted:</b> Proportional to target price</span>
              </label>
            </div>
          </div>

          <!-- Tier by Tier Breakdown Table -->
          <div class="space-y-2">
            <h4 class="font-bold text-xs uppercase tracking-wider text-base-content/70">Resulting Crated SKUs:</h4>
            
            <div 
              v-for="(tier, idx) in tiers" 
              :key="tier.id"
              class="p-3 rounded-xl border border-base-200 bg-base-100 flex items-center justify-between text-xs"
            >
              <div class="space-y-0.5">
                <div class="font-bold flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full" :class="getTierDotClass(idx)"></span>
                  {{ tier.name }}
                  <span class="badge badge-xs badge-ghost uppercase">{{ tier.mode }}</span>
                </div>
                <div class="text-[11px] text-base-content/60">
                  {{ getTierItemCount(tier.id) }} Items • Cost Basis: ${{ getTierCostBasis(tier).toFixed(2) }}/ea • Retail Tag: {{ getTierDisplayPrice(tier) }}
                </div>
              </div>

              <div class="text-right font-mono">
                <div class="font-bold text-success">${{ getTierTotalYield(tier).toFixed(2) }}</div>
                <div class="text-[10px] text-base-content/60">Yield</div>
              </div>
            </div>
          </div>
        </div>

        <!-- ==================================================== -->
        <!-- STEP 4: REVIEW & EXECUTE GENERATION                  -->
        <!-- ==================================================== -->
        <div v-if="step === 4" class="space-y-4 text-center py-4">
          <div class="w-16 h-16 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto shadow-inner">
            <Icon icon="solar:check-circle-bold-duotone" class="w-10 h-10" />
          </div>

          <div class="space-y-1 max-w-md mx-auto">
            <h3 class="font-black text-lg">Ready to Generate Crated SKUs!</h3>
            <p class="text-xs text-base-content/70">
              This will create <b>{{ totalGeneratedListingCount }} new inventory documents</b> in Appwrite, link component photos, assign cost basis, and prepare tags for Memory Den POS.
            </p>
          </div>

          <!-- Listing Distribution Breakdown -->
          <div class="p-4 bg-base-200/50 rounded-xl max-w-md mx-auto text-left text-xs space-y-2 border border-base-200">
            <div class="font-bold text-xs uppercase tracking-wider text-base-content/60 pb-1 border-b border-base-200">
              Inventory Listings to Create
            </div>
            <div class="flex justify-between">
              <span>🌟 Single Standout Documents:</span>
              <b>{{ singleItemCount }} listings</b>
            </div>
            <div class="flex justify-between">
              <span>📦 Multi-Quantity SKU Listings:</span>
              <b>{{ multiQtyListingCount }} listings</b>
            </div>
            <div class="flex justify-between">
              <span>🎁 Bundled Lot Sets:</span>
              <b>{{ bundleListingCount }} sets</b>
            </div>
            <div class="border-t border-base-200/80 pt-2 flex justify-between font-bold text-primary">
              <span>Total Crated Pieces:</span>
              <span>{{ totalItemCount }} pieces</span>
            </div>
          </div>

          <!-- Financial Profit Audit Box -->
          <div class="p-4 bg-base-200/50 rounded-xl max-w-md mx-auto text-left text-xs space-y-1.5 border border-base-200 font-mono">
            <div class="font-bold font-sans text-xs uppercase tracking-wider text-base-content/60 pb-1 border-b border-base-200">
              Financial Projections (Memory Den)
            </div>
            <div class="flex justify-between">
              <span class="font-sans text-base-content/70">Projected Total Gross Sales:</span>
              <span class="font-bold">${{ projectedGrossSales.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between text-error/80">
              <span class="font-sans text-base-content/70">Est. 12% Booth Commission:</span>
              <span>-${{ (projectedGrossSales * 0.12).toFixed(2) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="font-sans text-base-content/70">Net Booth Payout (88%):</span>
              <span class="font-bold text-primary">${{ (projectedGrossSales * 0.88).toFixed(2) }}</span>
            </div>
            <div class="flex justify-between text-base-content/60">
              <span class="font-sans">Original PO Cost Basis:</span>
              <span>-${{ totalCost.toFixed(2) }}</span>
            </div>
            <div class="border-t border-base-200/80 pt-2 flex justify-between font-bold text-sm text-success">
              <span class="font-sans">Est. Net Profit:</span>
              <span>+${{ projectedNetProfit.toFixed(2) }}</span>
            </div>
          </div>
        </div>

      </div>

      <!-- FOOTER ACTIONS -->
      <div class="border-t border-base-200 pt-3 flex items-center justify-between gap-3">
        <button 
          v-if="step > 1" 
          type="button" 
          class="btn btn-sm btn-ghost gap-1"
          @click="step--"
          :disabled="isSubmitting"
        >
          <Icon icon="solar:arrow-left-linear" class="w-4 h-4" />
          Back
        </button>
        <div v-else></div>

        <div class="flex items-center gap-2">
          <button 
            v-if="step < 4" 
            type="button" 
            class="btn btn-sm btn-primary font-bold gap-1 shadow-sm"
            @click="step++"
          >
            Continue
            <Icon icon="solar:arrow-right-linear" class="w-4 h-4" />
          </button>

          <button 
            v-else 
            type="button" 
            class="btn btn-sm btn-success font-black text-white gap-2 shadow-md"
            @click="executeSplit"
            :disabled="isSubmitting"
          >
            <span v-if="isSubmitting" class="loading loading-spinner loading-xs"></span>
            <Icon v-else icon="solar:rocket-bold" class="w-4 h-4" />
            Create {{ totalGeneratedListingCount }} Inventory SKUs
          </button>
        </div>
      </div>

    </div>
    <form method="dialog" class="modal-backdrop" @click="closeWizard">
      <button>close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useAuth } from '../../composables/useAuth';
import { addToast } from '../../stores/toast';
import { databases, Query } from '../../lib/appwrite';
import { DB_ID, getCollectionId, saveItemToInventory } from '../../lib/inventory';
import { ID } from 'appwrite';

const props = defineProps<{
  isOpen: boolean;
  lotItem: any;
}>();

const emit = defineEmits(['close', 'completed']);

const { currentTeam, user } = useAuth();

const step = ref(1);
const isSubmitting = ref(false);
const activeFilterTab = ref('all');
const costAllocationMode = ref<'equal' | 'weighted'>('equal');
const selectedItemIndices = ref(new Set<number>());

// Custom Tier Definitions
interface CustomTier {
  id: string;
  name: string;
  mode: 'single' | 'multi_qty' | 'bundle';
  targetPrice: number;
}

const tiers = ref<CustomTier[]>([
  { id: 'tier-1', name: '🌟 Tier 1: Standout Keys', mode: 'single', targetPrice: 45 },
  { id: 'tier-2', name: '📦 Tier 2: Mid-Tier Runs', mode: 'multi_qty', targetPrice: 16 },
  { id: 'tier-3', name: '🛒 Tier 3: Reader Packs', mode: 'multi_qty', targetPrice: 8 },
]);

interface ParsedItem {
  index: number;
  title: string;
  tierId: string;
  condition: string;
  estimated_value: string;
  customPrice: number;
  image_url?: string;
}

const allItems = ref<ParsedItem[]>([]);

function parsePriceFromText(val: any): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const match = String(val).match(/\$?\s*(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

// Initialize items from lotItem
watch(() => props.isOpen, (open) => {
  if (open && props.lotItem) {
    step.value = 1;
    selectedItemIndices.value.clear();
    initItemsFromLot();
  }
});

function initItemsFromLot() {
  const lot = props.lotItem;
  if (!lot) return;

  const rawCandidates: ParsedItem[] = [];

  // Parse rawAnalysis or components
  let parsedRaw: any = null;
  try {
    if (typeof lot.rawAnalysis === 'string') parsedRaw = JSON.parse(lot.rawAnalysis);
    else if (typeof lot.rawAnalysis === 'object') parsedRaw = lot.rawAnalysis;
  } catch (e) {}

  const sourceItems = (parsedRaw?.lot_items && Array.isArray(parsedRaw.lot_items) && parsedRaw.lot_items.length > 0)
    ? parsedRaw.lot_items
    : (Array.isArray(lot.components) && lot.components.length > 0)
      ? lot.components
      : [];

  if (sourceItems.length > 0) {
    sourceItems.forEach((it: any, idx: number) => {
      const nameStr = it.name || it.identity || it.title || `Lot Item #${idx + 1}`;
      let assignedTierId = 'tier-2';
      let defaultPrice = 16;
      if (nameStr.includes('Tier 1') || it.is_key_issue) {
        assignedTierId = 'tier-1';
        defaultPrice = 45;
      } else if (nameStr.includes('Tier 3')) {
        assignedTierId = 'tier-3';
        defaultPrice = 8;
      }

      const parsedPrice = parsePriceFromText(it.estimated_value || it.price_breakdown?.fair);

      rawCandidates.push({
        index: idx,
        title: nameStr,
        tierId: assignedTierId,
        condition: it.condition || 'Used/Good',
        estimated_value: it.estimated_value || '$15 - $25',
        customPrice: parsedPrice > 0 ? parsedPrice : defaultPrice,
        image_url: it.image_url || lot.images?.[it.image_index || idx] || lot.images?.[0] || undefined
      });
    });
  } else {
    // Fallback: Create N items based on lot quantity
    const count = Number(lot.quantity || 5);
    for (let i = 0; i < count; i++) {
      const assignedTierId = i === 0 ? 'tier-1' : (i < count - 2 ? 'tier-2' : 'tier-3');
      const defaultPrice = assignedTierId === 'tier-1' ? 45 : (assignedTierId === 'tier-2' ? 16 : 8);
      rawCandidates.push({
        index: i,
        title: `${lot.title || 'Lot Item'} #${i + 1}`,
        tierId: assignedTierId,
        condition: 'Used/Good',
        estimated_value: '$15 - $25',
        customPrice: defaultPrice,
        image_url: lot.images?.[i] || lot.images?.[0] || undefined
      });
    }
  }

  allItems.value = rawCandidates;

  // Auto-populate each tier's initial target price with the actual dynamic AI average
  tiers.value.forEach(t => {
    const avg = getTierAiAverage(t.id);
    if (avg > 0) {
      t.targetPrice = avg;
    }
  });

  // Default every item's price to its assigned tier's target price
  allItems.value.forEach(it => {
    const t = tiers.value.find(tier => tier.id === it.tierId);
    if (t && !it.isPriceOverridden) {
      it.customPrice = t.targetPrice;
    }
  });
}

// Computeds & Helpers
function getTierAiAverage(tierId: string): number {
  const items = allItems.value.filter(it => it.tierId === tierId);
  if (items.length === 0) return 0;
  const sum = items.reduce((s, it) => s + (it.customPrice || 0), 0);
  return Math.round((sum / items.length) * 2) / 2;
}

const totalCost = computed(() => {
  return parseFloat(props.lotItem?.cost || props.lotItem?.purchasePrice || '0') || 0;
});

const totalItemCount = computed(() => allItems.value.length);

const filteredItems = computed(() => {
  if (activeFilterTab.value === 'all') return allItems.value;
  return allItems.value.filter(it => it.tierId === activeFilterTab.value);
});

function getTierItemCount(tierId: string) {
  return allItems.value.filter(it => it.tierId === tierId).length;
}

function getTierIndex(tierId: string) {
  return tiers.value.findIndex(t => t.id === tierId);
}

function getTierShortName(tierId: string) {
  const t = tiers.value.find(t => t.id === tierId);
  if (!t) return 'Tier';
  return t.name.split(':')[0] || t.name;
}

function getTierBadgeClass(idx: number) {
  const classes = [
    'badge-primary text-primary-content',
    'badge-secondary text-secondary-content',
    'badge-accent text-accent-content',
    'badge-info text-info-content',
    'badge-warning text-warning-content'
  ];
  return classes[idx % classes.length];
}

function getTierDotClass(idx: number) {
  const classes = [
    'bg-primary',
    'bg-secondary',
    'bg-accent',
    'bg-info',
    'bg-warning'
  ];
  return classes[idx % classes.length];
}

// User Actions
function addCustomTier() {
  const nextNum = tiers.value.length + 1;
  tiers.value.push({
    id: `tier-${Date.now()}`,
    name: `Tier ${nextNum}: Custom Batch`,
    mode: 'multi_qty',
    targetPrice: 12
  });
}

function removeTier(idx: number) {
  const removed = tiers.value[idx];
  tiers.value.splice(idx, 1);
  const fallbackTierId = tiers.value[0]?.id || 'tier-1';
  allItems.value.forEach(it => {
    if (it.tierId === removed.id) it.tierId = fallbackTierId;
  });
}

function onTierPriceInput(tier: CustomTier) {
  allItems.value.forEach(it => {
    if (it.tierId === tier.id && !it.isPriceOverridden) {
      it.customPrice = tier.targetPrice;
    }
  });
}

function assignItemToTier(itemIndex: number, tierId: string) {
  const it = allItems.value.find(i => i.index === itemIndex);
  if (it) {
    it.tierId = tierId;
    if (!it.isPriceOverridden) {
      const targetTier = tiers.value.find(t => t.id === tierId);
      if (targetTier) it.customPrice = targetTier.targetPrice;
    }
  }
}

function toggleSelect(itemIndex: number) {
  if (selectedItemIndices.value.has(itemIndex)) selectedItemIndices.value.delete(itemIndex);
  else selectedItemIndices.value.add(itemIndex);
}

function moveSelectedToTier(tierId: string) {
  selectedItemIndices.value.forEach(idx => {
    assignItemToTier(idx, tierId);
  });
  selectedItemIndices.value.clear();
}

// Financial calculations & Reconciled Yields
function getTierTotalYield(tier: CustomTier): number {
  const items = allItems.value.filter(it => it.tierId === tier.id);
  if (items.length === 0) return 0;
  if (tier.mode === 'single') {
    return items.reduce((sum, it) => sum + (it.customPrice || tier.targetPrice), 0);
  }
  return items.length * tier.targetPrice;
}

function getTierDisplayPrice(tier: CustomTier): string {
  const items = allItems.value.filter(it => it.tierId === tier.id);
  if (items.length === 0) return `$${tier.targetPrice.toFixed(2)}/ea`;
  if (tier.mode === 'single') {
    const prices = items.map(it => it.customPrice || tier.targetPrice);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    if (minP === maxP) return `$${minP.toFixed(2)}/ea`;
    return `$${minP.toFixed(0)} - $${maxP.toFixed(0)}/ea`;
  }
  return `$${tier.targetPrice.toFixed(2)}/ea`;
}

const projectedGrossSales = computed(() => {
  return tiers.value.reduce((sum, t) => sum + getTierTotalYield(t), 0);
});

const projectedNetProfit = computed(() => {
  // Approximate after 12% memory den booth fee
  const netRevenue = projectedGrossSales.value * 0.88;
  return netRevenue - totalCost.value;
});

function getTierCostBasis(tier: CustomTier) {
  const count = getTierItemCount(tier.id);
  if (count === 0) return 0;

  if (costAllocationMode.value === 'equal') {
    return totalCost.value / (totalItemCount.value || 1);
  } else {
    // Weighted by actual tier yield
    const totalPotential = projectedGrossSales.value;
    if (totalPotential === 0) return 0;
    const tierYield = getTierTotalYield(tier);
    return (totalCost.value * (tierYield / totalPotential)) / count;
  }
}

const singleItemCount = computed(() => {
  return tiers.value.filter(t => t.mode === 'single').reduce((sum, t) => sum + getTierItemCount(t.id), 0);
});

const multiQtyListingCount = computed(() => {
  return tiers.value.filter(t => t.mode === 'multi_qty' && getTierItemCount(t.id) > 0).length;
});

const bundleListingCount = computed(() => {
  return tiers.value.filter(t => t.mode === 'bundle' && getTierItemCount(t.id) > 0).length;
});

const totalGeneratedListingCount = computed(() => {
  return singleItemCount.value + multiQtyListingCount.value + bundleListingCount.value;
});

function closeWizard() {
  emit('close');
}

function extractFileId(urlOrId?: string): string | null {
  if (!urlOrId) return null;
  if (/^[a-zA-Z0-9_-]{10,}$/.test(urlOrId) && !urlOrId.includes('/')) return urlOrId;
  const match = urlOrId.match(/\/files\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

// -------------------------------------------------------------
// EXECUTE GENERATION INTO APPWRITE
// -------------------------------------------------------------
async function executeSplit() {
  const orgId = currentTeam.value?.$id;
  if (!databases || !orgId) {
    addToast({ type: 'error', message: 'Database not initialized or unauthenticated.' });
    return;
  }

  isSubmitting.value = true;
  try {
    const parent = props.lotItem;
    const parentDocId = parent.$id || parent.id;

    // 0. Clean up any existing split children for this parent lot to prevent duplicates on re-split
    if (parentDocId) {
      try {
        const existingChildren = await databases.listDocuments(DB_ID, getCollectionId(), [
          Query.equal('parentLotId', parentDocId),
          Query.limit(100)
        ]);
        for (const child of existingChildren.documents) {
          await databases.deleteDocument(DB_ID, getCollectionId(), child.$id);
        }
      } catch (cleanupErr) {
        console.warn('Old children cleanup check passed:', cleanupErr);
      }
    }

    // 1. Calculate starting sequential UPC barcode
    const prefix = (currentTeam.value as any)?.prefs?.upcPrefix || (user.value as any)?.prefs?.upcPrefix || 'HUCK-';
    const cleanPrefix = prefix.endsWith('-') ? prefix : `${prefix}-`;
    let currentUpcNum = 0;
    try {
      const upcDocs = await databases.listDocuments(DB_ID, getCollectionId(), [
        Query.startsWith('upc', cleanPrefix),
        Query.orderDesc('$createdAt'),
        Query.limit(50)
      ]);
      for (const doc of upcDocs.documents) {
        const u = (doc as any).upc;
        if (u && typeof u === 'string' && u.startsWith(cleanPrefix)) {
          const num = parseInt(u.replace(cleanPrefix, ''), 10);
          if (!isNaN(num) && num > currentUpcNum) currentUpcNum = num;
        }
      }
    } catch (e) {
      console.warn('Auto UPC lookup fallback:', e);
    }

    // Helper to get clean brand/subject for retail booth tags
    const getCleanParentSubject = (parentTitle: string): string => {
      return (parentTitle || 'Vintage Lot')
        .replace(/^Combined Lot of \d+:\s*/i, '')
        .replace(/^Lot of \d+:\s*/i, '')
        .replace(/\b(Lot|Collection|Bundle)\b/gi, '')
        .replace(/[:\-–—]\s*$/, '')
        .trim() || 'Inventory Item';
    };

    const cleanSubject = getCleanParentSubject(parent.title);

    // 2. Create Documents for each tier
    let createdCount = 0;

    for (const tier of tiers.value) {
      const tierItems = allItems.value.filter(it => it.tierId === tier.id);
      if (tierItems.length === 0) continue;

      const unitCost = getTierCostBasis(tier);

      if (tier.mode === 'single') {
        // Create 1 document per item with individual custom price & unique UPC
        for (const item of tierItems) {
          currentUpcNum++;
          const itemUpc = `${cleanPrefix}${currentUpcNum.toString().padStart(4, '0')}`;
          const mainImgId = extractFileId(item.image_url) || extractFileId(parent.images?.[0]) || parent.imageId || null;
          const individualPrice = item.customPrice || tier.targetPrice;
          await databases.createDocument(DB_ID, getCollectionId(), ID.unique(), {
            tenantId: orgId || undefined,
            purchaseId: parent.purchaseId || undefined,
            upc: itemUpc,
            title: (item.title || 'Split Item').slice(0, 250),
            identity: (item.title || itemUpc).slice(0, 950),
            cost: Number(unitCost.toFixed(2)),
            resalePrice: Number(individualPrice.toFixed(2)),
            quantity: 1,
            conditionNotes: `Split from master lot: ${parent.title || 'Lot'}`.slice(0, 950),
            imageId: mainImgId || undefined,
            storageLocation: parent.storageLocation || 'Unsorted',
            sourcingLocation: parent.sourcingLocation || '',
            parentLotId: parentDocId || undefined,
            status: 'placed'
          });
          createdCount++;
        }
      } else if (tier.mode === 'multi_qty') {
        // Create 1 multi-quantity document (Memory Den SKU) & unique UPC
        currentUpcNum++;
        const itemUpc = `${cleanPrefix}${currentUpcNum.toString().padStart(4, '0')}`;
        const issueListNotes = tierItems.map((it, i) => `${i + 1}. ${it.title}`).join('\n');
        const firstImgId = extractFileId(tierItems[0]?.image_url) || extractFileId(parent.images?.[0]) || parent.imageId || null;
        
        let retailTitle = `${cleanSubject} - Choice Issues`;
        if (tier.id === 'tier-3' || tier.name.toLowerCase().includes('reader') || tier.name.toLowerCase().includes('clearance')) {
          retailTitle = `${cleanSubject} - Reader / Clearance`;
        }

        await databases.createDocument(DB_ID, getCollectionId(), ID.unique(), {
          tenantId: orgId || undefined,
          purchaseId: parent.purchaseId || undefined,
          upc: itemUpc,
          title: `${retailTitle} (Qty: ${tierItems.length})`.slice(0, 250),
          identity: `${retailTitle} (Qty: ${tierItems.length})`.slice(0, 950),
          cost: Number(unitCost.toFixed(2)),
          resalePrice: Number(tier.targetPrice.toFixed(2)),
          quantity: tierItems.length,
          conditionNotes: `Multi-Quantity Lot Run:\n${issueListNotes}`.slice(0, 950),
          imageId: firstImgId || undefined,
          storageLocation: parent.storageLocation || 'Unsorted',
          sourcingLocation: parent.sourcingLocation || '',
          parentLotId: parentDocId || undefined,
          status: 'placed'
        });
        createdCount++;
      } else if (tier.mode === 'bundle') {
        // Create 1 bundled lot set document & unique UPC
        currentUpcNum++;
        const itemUpc = `${cleanPrefix}${currentUpcNum.toString().padStart(4, '0')}`;
        const bundleTotal = tier.targetPrice * tierItems.length;
        const totalBundleCost = unitCost * tierItems.length;
        const issueListNotes = tierItems.map((it, i) => `${i + 1}. ${it.title}`).join('\n');
        const firstImgId = extractFileId(tierItems[0]?.image_url) || extractFileId(parent.images?.[0]) || parent.imageId || null;
        await databases.createDocument(DB_ID, getCollectionId(), ID.unique(), {
          tenantId: orgId || undefined,
          purchaseId: parent.purchaseId || undefined,
          upc: itemUpc,
          title: `${cleanSubject} - Set of ${tierItems.length}`.slice(0, 250),
          identity: `${cleanSubject} - Set of ${tierItems.length}`.slice(0, 950),
          cost: Number(totalBundleCost.toFixed(2)),
          resalePrice: Number(bundleTotal.toFixed(2)),
          quantity: 1,
          conditionNotes: `Curated Mini-Lot Set:\n${issueListNotes}`.slice(0, 950),
          imageId: firstImgId || undefined,
          storageLocation: parent.storageLocation || 'Unsorted',
          sourcingLocation: parent.sourcingLocation || '',
          parentLotId: parentDocId || undefined,
          status: 'placed'
        });
        createdCount++;
      }
    }

    // 2. Mark parent lot as Deconstructed / Curated
    if (parentDocId) {
      const existingNotes = parent.conditionNotes || parent.condition_notes || '';
      await databases.updateDocument(DB_ID, getCollectionId(), parentDocId, {
        status: 'deconstructed',
        conditionNotes: `${existingNotes}\n[Deconstructed into ${createdCount} curated tier listings]`.trim()
      });
    }

    addToast({
      type: 'success',
      message: `🎉 Successfully generated ${createdCount} crated inventory listings ready for booth tagging!`
    });

    emit('completed');
    closeWizard();
  } catch (err: any) {
    console.error('[LotSplitterWizard Error]:', err);
    addToast({ type: 'error', message: 'Failed to split lot: ' + err.message });
  } finally {
    isSubmitting.value = false;
  }
}
</script>
