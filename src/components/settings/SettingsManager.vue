<template>
  <CollectiveAccessGate>
  <div class="space-y-6">
    <div v-if="!currentTeam" class="alert alert-info">
      <Icon icon="solar:info-circle-bold" class="w-6 h-6 shrink-0" />
      <span>You are currently in your <strong>Personal Inventory</strong>. Co-op settings are only available inside a Team / Workspace.</span>
    </div>

    <!-- Top KPI Summary -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <div class="bg-base-100 p-3.5 sm:p-5 rounded-2xl border border-base-200 shadow-sm flex items-center gap-3">
        <div class="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
          <Icon icon="solar:tag-bold-duotone" class="w-5 h-5" />
        </div>
        <div class="min-w-0">
          <div class="text-[11px] uppercase font-bold opacity-60 truncate">Primary Prefix</div>
          <div class="text-lg font-black font-mono truncate">🔒 {{ form.upcPrefix || 'HUCK-' }}</div>
        </div>
      </div>
      <div class="bg-base-100 p-3.5 sm:p-5 rounded-2xl border border-base-200 shadow-sm flex items-center gap-3">
        <div class="w-10 h-10 bg-secondary/10 text-secondary rounded-xl flex items-center justify-center shrink-0">
          <Icon icon="solar:users-group-two-rounded-bold-duotone" class="w-5 h-5" />
        </div>
        <div class="min-w-0">
          <div class="text-[11px] uppercase font-bold opacity-60 truncate">Collective Members</div>
          <div class="text-lg font-black font-mono">{{ policy.members.length }}</div>
        </div>
      </div>
      <div class="bg-base-100 p-3.5 sm:p-5 rounded-2xl border border-base-200 shadow-sm flex items-center gap-3">
        <div class="w-10 h-10 bg-warning/10 text-warning rounded-xl flex items-center justify-center shrink-0">
          <Icon icon="solar:document-text-bold-duotone" class="w-5 h-5" />
        </div>
        <div class="min-w-0">
          <div class="text-[11px] uppercase font-bold opacity-60 truncate">Consignor Contracts</div>
          <div class="text-lg font-black font-mono">{{ policy.consignors.length }}</div>
        </div>
      </div>
      <div class="bg-base-100 p-3.5 sm:p-5 rounded-2xl border border-base-200 shadow-sm flex items-center gap-3">
        <div class="w-10 h-10 bg-success/10 text-success rounded-xl flex items-center justify-center shrink-0">
          <Icon icon="solar:shop-2-bold-duotone" class="w-5 h-5" />
        </div>
        <div class="min-w-0">
          <div class="text-[11px] uppercase font-bold opacity-60 truncate">Locations</div>
          <div class="text-lg font-black font-mono">{{ locationMetas.length }}</div>
        </div>
      </div>
    </div>

    <!-- Tab Switcher -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-2 p-1.5 bg-base-200/80 border border-base-300 rounded-2xl">
      <button
        v-for="t in tabs"
        :key="t.id"
        type="button"
        @click="setTab(t.id)"
        class="btn btn-sm h-10 rounded-xl font-bold gap-2"
        :class="activeTab === t.id ? 'btn-primary shadow-xs' : 'btn-ghost text-base-content/75'"
      >
        <Icon :icon="t.icon" class="w-4 h-4 shrink-0" />
        <span class="truncate text-xs">{{ t.label }}</span>
      </button>
    </div>

    <!-- Sandbox / Founder banner -->
    <div
      v-if="currentTeam && activeTab !== 'team' && activeTab !== 'hardware'"
      class="rounded-2xl border px-4 py-2.5 text-xs flex items-center gap-2"
      :class="canEditGlobal ? 'border-success/30 bg-success/5 text-success' : 'border-warning/40 bg-warning/10 text-warning'"
    >
      <Icon :icon="canEditGlobal ? 'solar:crown-bold' : 'solar:gamepad-bold'" class="w-4 h-4 shrink-0" />
      <span class="font-bold">
        {{ canEditGlobal
          ? '👑 Founder access: changes you save here apply to the whole collective.'
          : '🎮 Sandbox Preview: you can explore every calculator. Ask a 👑 Founder to enact changes.' }}
      </span>
    </div>

    <!-- TAB 1: PERSONAS, PREFIXES & CONSIGNOR CONTRACTS -->
    <div v-show="activeTab === 'personas'" class="space-y-6">
      <!-- Locked Barcode Prefix Registry -->
      <div class="card bg-base-100 border border-base-200 shadow-sm rounded-3xl p-5 sm:p-6 space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div class="text-xs font-extrabold uppercase tracking-wider text-primary">Barcode Prefix Registry</div>
            <h3 class="text-lg font-black">Prefixes are printed on physical tags, so they are locked once registered</h3>
            <p class="text-xs text-base-content/65 mt-0.5">
              Rename the display name any time. The prefix code itself cannot be edited or removed.
              <a href="/coop" class="link link-primary font-bold ml-1">How partner splits work &rarr;</a>
            </p>
          </div>
          <button type="button" class="btn btn-sm h-11 md:h-8 btn-outline btn-primary gap-1.5 rounded-xl font-bold" :disabled="!canEditGlobal" @click="addPrefixRow">
            <Icon icon="solar:add-circle-bold" class="w-4 h-4" />
            Register New Prefix
          </button>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <!-- Primary Org Prefix -->
          <div class="p-3.5 rounded-2xl bg-base-200/50 border border-base-300 flex items-center gap-3">
            <span class="badge badge-primary font-mono font-black px-3 py-3">🔒 {{ form.upcPrefix }}</span>
            <div class="min-w-0">
              <div class="font-black text-sm truncate">{{ currentTeam?.name || 'Primary Organization' }}</div>
              <div class="text-[11px] opacity-60">Primary organization prefix</div>
            </div>
          </div>

          <div
            v-for="(p, idx) in form.partnerPrefixes"
            :key="idx"
            class="p-3.5 rounded-2xl bg-base-200/50 border border-base-300 flex items-center gap-3"
          >
            <template v-if="p.isNew">
              <input
                v-model="p.prefix"
                type="text"
                maxlength="7"
                placeholder="CON-"
                class="input input-bordered input-sm w-24 font-mono font-bold uppercase"
              />
            </template>
            <span v-else class="badge badge-outline font-mono font-black px-3 py-3 shrink-0">🔒 {{ p.prefix }}</span>
            <input v-model="p.name" type="text" placeholder="Display name" class="input input-bordered input-sm flex-1 min-w-0" />
            <button
              v-if="p.isNew"
              type="button"
              class="btn btn-ghost btn-xs btn-circle text-error"
              title="Discard this unsaved prefix"
              @click="form.partnerPrefixes.splice(idx, 1)"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      <!-- Unified Collective Roster Link + PO Receipt Auto-Approve Cap -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="card bg-base-100 border border-base-200 shadow-sm rounded-3xl p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div class="space-y-1.5">
            <div class="text-xs font-extrabold uppercase tracking-wider text-secondary">Unified Member Roster &amp; SKUs</div>
            <h3 class="text-lg font-black">Everyone is a Curator with their own unique barcode prefix</h3>
            <p class="text-xs text-base-content/70 leading-relaxed">
              Manage Member Hats, invites, and locked Curator SKU prefixes in one unified Collective Roster so accounts never get duplicated.
            </p>
          </div>
          <div class="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-base-200">
            <span class="badge badge-ghost badge-sm font-mono font-bold">
              {{ policy.members.length }} Roster Profile{{ policy.members.length === 1 ? '' : 's' }}
            </span>
            <a href="/coop/governance?tab=roster" class="btn btn-sm h-11 md:h-8 btn-primary text-primary-content rounded-xl font-black gap-1.5">
              <span>Open Unified Roster &amp; SKU Locks</span>
              <span>➔</span>
            </a>
          </div>
        </div>

        <div class="card bg-base-100 border border-base-200 shadow-sm rounded-3xl p-5 sm:p-6 space-y-3">
          <div>
            <div class="text-xs font-extrabold uppercase tracking-wider text-primary">Cost-Basis Recoupment Policy</div>
            <h3 class="text-lg font-black">PO Receipt Auto-Approve Threshold</h3>
            <p class="text-xs text-base-content/70 mt-0.5 leading-relaxed">
              Receipt-backed Purchase Orders at or below this dollar amount auto-approve for Gate 2 cost recoupment. Set to <strong>$0</strong> to require Founder sign-off on every PO.
            </p>
          </div>
          <div class="flex items-center gap-3 flex-wrap pt-1">
            <label class="text-xs font-bold text-base-content/75">Auto-Approve Cap ($ USD)</label>
            <input
              v-model.number="policy.autoApproveReceiptPoMaxUsd"
              type="number"
              min="0"
              max="5000"
              step="5"
              :disabled="!canEditGlobal"
              class="input input-bordered input-sm h-11 md:h-9 w-32 rounded-xl font-mono font-black text-right"
            />
            <span class="badge badge-outline badge-sm font-mono font-bold">
              {{ Number(policy.autoApproveReceiptPoMaxUsd || 0) <= 0 ? 'Manual on every PO' : `Auto ≤ $${Number(policy.autoApproveReceiptPoMaxUsd || 0)}` }}
            </span>
          </div>
        </div>
      </div>

      <!-- Legacy Consignor Contracts (BB- Preserved; New Consignors Paused) -->
      <div class="card bg-base-100 border border-base-200 shadow-sm rounded-3xl p-5 sm:p-6 space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div class="text-xs font-extrabold uppercase tracking-wider text-warning">Legacy Consignor Contract</div>
            <h3 class="text-lg font-black">Straight % split, fixed shelf rent, or pro-rata booth rent</h3>
          </div>
          <span class="badge badge-warning badge-outline font-bold text-xs whitespace-nowrap">
            🔒 Legacy BB- Only (New Consignors Paused)
          </span>
        </div>

        <!-- Shared example inputs -->
        <div class="flex items-center gap-2 flex-wrap text-xs">
          <span class="font-extrabold uppercase tracking-wider opacity-70">Example sales:</span>
          <button
            v-for="amt in [100, 250, 500]"
            :key="amt"
            type="button"
            class="btn btn-xs rounded-lg font-mono"
            :class="sampleGross === amt ? 'btn-neutral' : 'btn-ghost border border-base-300'"
            @click="sampleGross = amt"
          >
            ${{ amt }}
          </button>
          <span class="opacity-60">after {{ venueFeePct }}% venue fee, booth rent ${{ boothRent.toFixed(2) }}/mo</span>
        </div>

        <div v-if="policy.consignors.length === 0" class="text-xs text-base-content/60 italic">No consignor contracts yet.</div>

        <div v-for="(c, idx) in policy.consignors" :key="c.prefix" class="p-4 rounded-2xl bg-base-200/40 border border-base-300 space-y-3">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="flex items-center gap-2">
              <span class="badge badge-warning font-mono font-black">🔒 {{ c.prefix }}</span>
              <input v-model="c.displayName" type="text" :disabled="!canEditGlobal" class="input input-bordered input-sm w-56 max-w-full" />
            </div>
            <button v-if="canEditGlobal" type="button" class="btn btn-ghost btn-xs text-error" @click="removeConsignorFromSettings(idx)">Remove Contract</button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs">
                <span class="font-extrabold uppercase tracking-wider text-primary">✂️ % Split After Venue Take</span>
                <span class="badge badge-primary badge-sm font-mono font-black">{{ c.coopCommissionPct }}% Co-op / {{ 100 - c.coopCommissionPct }}% Consignor</span>
              </div>
              <div class="flex items-center gap-2">
                <input type="range" min="0" max="60" step="1" v-model.number="c.coopCommissionPct" :disabled="!canEditGlobal" class="range range-primary range-xs flex-1" />
                <input type="text" inputmode="decimal" v-model.number="c.coopCommissionPct" :disabled="!canEditGlobal" class="input input-bordered input-xs w-14 font-mono font-bold text-right" />
              </div>
              <div class="flex gap-1 flex-wrap">
                <button
                  v-for="pct in [10, 15, 20, 25, 30, 50]"
                  :key="pct"
                  type="button"
                  :disabled="!canEditGlobal"
                  class="btn btn-xs h-6 min-h-0 px-2 rounded-lg font-mono"
                  :class="c.coopCommissionPct === pct ? 'btn-primary' : 'btn-ghost border border-base-300'"
                  @click="c.coopCommissionPct = pct; c.mode = 'flat_commission'"
                >
                  {{ pct }}%
                </button>
              </div>
            </div>
            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs">
                <span class="font-extrabold uppercase tracking-wider text-warning">🏪 Fixed Shelf Rent ($/mo)</span>
                <span class="badge badge-warning badge-sm font-mono font-black">${{ Number(c.fixedMonthlyRent || 0).toFixed(2) }}</span>
              </div>
              <input type="text" inputmode="decimal" v-model.number="c.fixedMonthlyRent" :disabled="!canEditGlobal" class="input input-bordered input-sm rounded-xl font-mono font-bold w-full" />
              <label class="label cursor-pointer justify-start gap-2 py-0">
                <input type="checkbox" v-model="c.capRentAtNetSales" :disabled="!canEditGlobal" class="checkbox checkbox-xs checkbox-primary" />
                <span class="label-text text-[11px] font-bold">Never let rent push payout below $0</span>
              </label>
            </div>
          </div>

          <!-- 3-mode example cards -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <button
              v-for="card in consignorCards(c)"
              :key="card.mode"
              type="button"
              :disabled="!canEditGlobal"
              class="text-left p-3 rounded-xl border-2 transition-all"
              :class="c.mode === card.mode ? 'border-primary bg-primary/10' : 'border-base-300 bg-base-100 hover:border-base-content/30'"
              @click="c.mode = card.mode"
            >
              <div class="flex items-center justify-between gap-1">
                <span class="font-black">{{ card.title }}</span>
                <span v-if="c.mode === card.mode" class="badge badge-primary badge-xs font-bold">ACTIVE</span>
              </div>
              <div class="font-mono text-[11px] mt-1.5 space-y-0.5">
                <div class="flex justify-between text-base-content/70"><span>After venue</span><span>${{ card.net.toFixed(2) }}</span></div>
                <div v-if="card.result.rentDeduction > 0" class="flex justify-between text-warning"><span>Rent</span><span>-${{ card.result.rentDeduction.toFixed(2) }}</span></div>
                <div v-if="card.result.coopCommission > 0" class="flex justify-between text-primary"><span>Co-op</span><span>-${{ card.result.coopCommission.toFixed(2) }}</span></div>
                <div class="flex justify-between font-black text-success border-t border-base-300 pt-1"><span>Consignor</span><span>${{ card.result.payout.toFixed(2) }}</span></div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: LOCATIONS -->
    <div v-show="activeTab === 'locations'" class="card bg-base-100 border border-base-200 shadow-sm rounded-3xl p-5 sm:p-6 space-y-4">
      <div>
        <div class="text-xs font-extrabold uppercase tracking-wider text-success">Locations &amp; Intake Defaults</div>
        <h3 class="text-lg font-black">Where new purchases land by default</h3>
        <p class="text-xs text-base-content/65 mt-0.5">Fees and rent come straight from your live location settings.</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <button
          v-for="loc in locationMetas"
          :key="loc.code"
          type="button"
          class="text-left p-4 rounded-2xl border-2 transition-all space-y-1"
          :class="form.defaultStorageLocation === loc.code ? 'border-primary bg-primary/10' : 'border-base-300 bg-base-200/40 hover:border-base-content/30'"
          @click="form.defaultStorageLocation = loc.code"
        >
          <div class="flex items-center justify-between">
            <span class="font-black text-sm">{{ loc.icon }} {{ loc.shortName }}</span>
            <span class="badge badge-sm font-mono font-bold">{{ loc.code }}</span>
          </div>
          <div class="text-[11px] text-base-content/65">{{ loc.subtitle }}</div>
          <div class="text-[11px] font-mono flex gap-3 pt-1">
            <span>{{ loc.feePct }}% fee</span>
            <span>${{ Number(loc.monthlyRent || 0).toFixed(2) }}/mo</span>
          </div>
          <div v-if="form.defaultStorageLocation === loc.code" class="text-[11px] font-bold text-primary">✓ Default receiving location</div>
        </button>
      </div>
    </div>

    <!-- TAB 3: TEAM, STOREFRONT & API (existing organization manager) -->
    <div v-if="activeTab === 'team'">
      <OrgSettingsView />
    </div>

    <!-- TAB 4: THERMAL HARDWARE & BOOKMARKLETS -->
    <div v-show="activeTab === 'hardware'" class="space-y-6">
      <BookmarkletRegistryPanel
        :can-edit="canEditGlobal"
        :default-location-code="ricochetMeta.code"
        :default-location-short-name="ricochetMeta.shortName"
      />

      <div class="card bg-base-100 border border-base-200 shadow-sm rounded-3xl p-5 sm:p-6 space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 class="text-lg font-black flex items-center gap-2">
              <Icon icon="solar:printer-bold" class="w-6 h-6 text-primary" />
              Thermal Label &amp; Hardware Studio
            </h3>
            <p class="text-sm text-base-content/70 mt-1 max-w-xl">
              Calibrate direct thermal printers, preview Code128 barcodes, test gap sensors, and print replacement tags for lost booth stickers.
            </p>
          </div>
          <a href="/labels/studio" class="btn btn-primary text-primary-content font-bold gap-2 shrink-0">
            <Icon icon="solar:printer-bold" class="w-5 h-5" />
            Launch Studio
          </a>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="p-3 rounded-xl bg-base-200/60 border border-base-300">
            <div class="text-xs font-bold">🏷️ Supported Media</div>
            <div class="text-xs text-base-content/60 mt-1">2"×1" Booth, 2.2"×0.5" Butterfly Jewelry, 3"×2" Bin, 4"×6" Shipping</div>
          </div>
          <div class="p-3 rounded-xl bg-base-200/60 border border-base-300">
            <div class="text-xs font-bold">🖨️ Hardware Profiles</div>
            <div class="text-xs text-base-content/60 mt-1">Rollo Direct Thermal, Zebra ZD411, Dymo 550, Munbyn (Mac &amp; PC)</div>
          </div>
          <div class="p-3 rounded-xl bg-base-200/60 border border-base-300">
            <div class="text-xs font-bold">⚡ Ricochet POS Authority</div>
            <div class="text-xs text-base-content/60 mt-1">Memory Den 6-char location SKU encoding for instant register checkout</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Sticky Bottom Action Dock (personas + locations tabs — Law 5) -->
    <BottomActionDock
      :visible="Boolean(currentTeam && (activeTab === 'personas' || activeTab === 'locations'))"
      placement="viewport"
    >
      <template #left>
        <div class="flex items-center gap-2 text-xs">
          <span v-if="message" class="text-success font-bold">{{ message }}</span>
          <span v-else-if="error" class="text-error font-bold">{{ error }}</span>
          <span v-else class="text-base-content/70 font-semibold">
            {{ canEditGlobal ? 'Save changes to update Collective prefixes, hats, and location defaults.' : '🔒 Founder required to enact Collective changes.' }}
          </span>
        </div>
      </template>
      <template #right>
        <button
          type="button"
          class="btn btn-primary btn-sm h-11 md:h-9 px-6 rounded-xl font-black text-primary-content"
          :disabled="loading || saving || !canEditGlobal"
          @click="saveSettings"
        >
          <span v-if="saving" class="loading loading-spinner loading-xs"></span>
          {{ canEditGlobal ? 'Save Settings' : '🔒 Founder Required to Save' }}
        </button>
      </template>
    </BottomActionDock>
  </div>
  </CollectiveAccessGate>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useAuth } from '../../composables/useAuth';
import { useMemberCapabilities } from '../../lib/memberAccess';
import { askConfirm } from '../../stores/confirm';
import { toUserMessage } from '../../lib/userFacingErrors';
import BottomActionDock from '../common/BottomActionDock.vue';
import CollectiveAccessGate from '../common/CollectiveAccessGate.vue';
import OrgSettingsView from '../org/OrgSettingsView.vue';
import BookmarkletRegistryPanel from '../bml/BookmarkletRegistryPanel.vue';
import {
  warehousesApi,
  getAllLocationSettingMetas,
  getDefaultStorageLocation,
  resolveDefaultRicochetLocationMeta,
  type WarehouseDocument,
} from '../../lib/warehouses';
import {
  loadCoopGovernanceState,
  saveCoopGovernanceState,
  normalizePolicyConfig,
  calculateConsignorSettlement,
  canMemberEditGlobalFinancials,
  isProtectedPrefix,
  DEFAULT_COOP_POLICY_CONFIG,
  type ConsignorAgreementConfig,
  type ConsignorDealMode,
  type CoopMemberProfile,
  type CoopPolicyConfig,
} from '../../lib/coopGovernance';

type SettingsTab = 'personas' | 'locations' | 'team' | 'hardware';

const { currentTeam, teams, user, ownedTeam, updateTeamPrefs, updatePrefs } = useAuth();
const { capabilities } = useMemberCapabilities();
const loading = ref(false);
const saving = ref(false);
const message = ref('');
const error = ref('');

const tabs: { id: SettingsTab; label: string; icon: string }[] = [
  { id: 'personas', label: 'Personas, Prefixes & Contracts', icon: 'solar:masks-bold-duotone' },
  { id: 'locations', label: 'Locations & Intake', icon: 'solar:shop-2-bold-duotone' },
  { id: 'team', label: 'Team, Storefront & API', icon: 'solar:users-group-two-rounded-bold-duotone' },
  { id: 'hardware', label: 'Bookmarklets & Thermal', icon: 'solar:printer-bold-duotone' },
];
const activeTab = ref<SettingsTab>('personas');

const setTab = (tab: SettingsTab) => {
  activeTab.value = tab;
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    if (tab === 'personas') url.searchParams.delete('tab');
    else url.searchParams.set('tab', tab);
    window.history.replaceState({}, '', url.toString());
  }
};

interface PrefixRow {
  prefix: string;
  name: string;
  linkedTeamId?: string;
  isNew?: boolean;
}

const form = ref({
  upcPrefix: 'HUCK-',
  defaultStorageLocation: 'HG',
  partnerPrefixes: [] as PrefixRow[],
});
const policy = ref<CoopPolicyConfig>(normalizePolicyConfig(DEFAULT_COOP_POLICY_CONFIG));
const warehouses = ref<WarehouseDocument[]>([]);
const persistedPrefixes = ref<string[]>([]);

const sampleGross = ref(250);

const locationMetas = computed(() => getAllLocationSettingMetas(warehouses.value));
const ricochetMeta = computed(() => resolveDefaultRicochetLocationMeta(warehouses.value));
const venueFeePct = computed(() => Number(ricochetMeta.value.feePct || 0));
const boothRent = computed(() => Number(ricochetMeta.value.monthlyRent || 0));

const isTeamOwner = computed(() => {
  if (user.value?.labels?.includes('admin')) return true;
  return !!(currentTeam.value && ownedTeam.value && currentTeam.value.$id === ownedTeam.value.$id);
});

const currentMember = computed(() => {
  const name = user.value?.name?.toLowerCase();
  if (!name) return undefined;
  return policy.value.members.find((m) => m.name.toLowerCase().includes(name));
});

const canEditGlobal = computed(() => canMemberEditGlobalFinancials(currentMember.value, isTeamOwner.value));

const derivePartnerCode = (m: CoopMemberProfile): string => {
  const hats = m.hats || [];
  if (hats.length === 1 && hats[0] === 'consignor') return 'BB';
  if (m.inventoryPrefix) {
    return m.inventoryPrefix.trim().toUpperCase().replace(/[-_]+$/, '');
  }
  return m.partner || 'CURATOR';
};

const deriveRoleLabel = (m: CoopMemberProfile): CoopMemberProfile['role'] => {
  const hats = m.hats || [];
  if (hats.length === 1 && hats[0] === 'consignor') return 'Consignor';
  return hats.includes('founder') ? 'Co-op Member' : 'Partner Curator';
};

const removeConsignorFromSettings = async (idx: number) => {
  const target = policy.value.consignors[idx];
  if (!target) return;
  const ok = await askConfirm(
    `Remove consignor contract for ${target.displayName || target.prefix} (${target.prefix})? (Click Save Settings to enact.)`,
    'Remove Consignor Contract',
    'Remove Contract',
    'Cancel',
    'btn-error'
  );
  if (!ok) return;
  policy.value.consignors.splice(idx, 1);
};

const addPrefixRow = () => {
  form.value.partnerPrefixes.push({ prefix: '', name: '', linkedTeamId: '', isNew: true });
};

const consignorCards = (c: ConsignorAgreementConfig) => {
  const gross = sampleGross.value;
  const net = Number((gross * (1 - venueFeePct.value / 100)).toFixed(2));
  const grossRatio = boothRent.value > 0 ? Math.min(1, gross / Math.max(gross, 2000)) : 0;
  const build = (mode: ConsignorDealMode) =>
    calculateConsignorSettlement({
      agreement: { ...c, mode },
      netStoreDeposit: net,
      grossRatio,
      boothRent: boothRent.value,
      isMonthInProgress: false,
    });
  return [
    { mode: 'flat_commission' as ConsignorDealMode, title: '✂️ Straight % Split', net, result: build('flat_commission') },
    { mode: 'fixed_shelf_rent' as ConsignorDealMode, title: '🏪 Fixed Shelf Rent', net, result: build('fixed_shelf_rent') },
    { mode: 'pro_rata_rent' as ConsignorDealMode, title: '📊 Pro-Rata Rent', net, result: build('pro_rata_rent') },
  ];
};

const loadSettings = async () => {
  const prefs = (currentTeam.value ? currentTeam.value.prefs : user.value?.prefs) || {};
  form.value.upcPrefix = (prefs.upcPrefix || 'HUCK-').toUpperCase();
  form.value.defaultStorageLocation = getDefaultStorageLocation(currentTeam.value || user.value);

  const rawPartners: any[] =
    Array.isArray(prefs.partnerPrefixes) && prefs.partnerPrefixes.length > 0
      ? prefs.partnerPrefixes
      : [
          { prefix: 'PDXGL-', name: 'PDX Game Library' },
          { prefix: 'BB-', name: 'B&B Consignment (PDXGL Sub-Client)' },
        ];
  form.value.partnerPrefixes = rawPartners.map((p: any) =>
    typeof p === 'string'
      ? { prefix: p, name: `${p.replace(/[-_]$/, '')} Partner`, linkedTeamId: '' }
      : { prefix: p.prefix || '', name: p.name || '', linkedTeamId: p.linkedTeamId || '' }
  );
  persistedPrefixes.value = [form.value.upcPrefix, ...form.value.partnerPrefixes.map((p) => p.prefix)];

  try {
    const { state } = await loadCoopGovernanceState([], currentTeam.value?.$id || 'huck_collective');
    policy.value = normalizePolicyConfig(state.policyConfig);
  } catch (e) {
    console.warn('[SettingsManager] Could not load co-op policy:', e);
  }
};

const loadWarehouses = async () => {
  try {
    warehouses.value = await warehousesApi.listWarehouses(currentTeam.value?.$id);
  } catch (e) {
    console.warn('[SettingsManager] Could not load warehouses (using canonical defaults):', e);
  }
};

const validatePrefixRows = (): string | null => {
  const seen = new Set<string>([form.value.upcPrefix.toUpperCase()]);
  for (const row of form.value.partnerPrefixes) {
    if (!row.isNew && !row.prefix.trim()) continue;
    let px = row.prefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!/^(?=.*[A-Z])[A-Z0-9]{2,6}$/.test(px)) {
      return `Prefix "${row.prefix}" must be 2–6 letters/numbers (hyphen added automatically).`;
    }
    px += '-';
    if (seen.has(px)) return `Prefix ${px} is already registered.`;
    seen.add(px);
    row.prefix = px;
  }
  return null;
};

const saveSettings = async () => {
  if (!canEditGlobal.value) return;
  saving.value = true;
  message.value = '';
  error.value = '';
  try {
    const problem = validatePrefixRows();
    if (problem) throw new Error(problem);

    const newOnes = form.value.partnerPrefixes.filter((p) => p.isNew && p.prefix);
    if (newOnes.length > 0) {
      const ok = await askConfirm(
        `Register ${newOnes.map((p) => p.prefix).join(', ')}? Once printed on physical tags, a barcode prefix is permanent.`,
        'Lock New Barcode Prefix',
        'Register & Lock Prefix',
        'Cancel',
        'btn-primary'
      );
      if (!ok) {
        saving.value = false;
        return;
      }
    }

    const cleanPartners = form.value.partnerPrefixes
      .filter((p) => p.prefix && p.prefix.trim())
      .map((p) => ({
        prefix: p.prefix.trim().toUpperCase(),
        name: p.name.trim() || `${p.prefix.replace(/[-_]$/, '')} Partner`,
        linkedTeamId: p.linkedTeamId || undefined,
      }));

    // Protected prefixes can never disappear from the registry
    for (const protectedPx of persistedPrefixes.value) {
      if (protectedPx !== form.value.upcPrefix && !cleanPartners.some((p) => p.prefix === protectedPx) && isProtectedPrefix(protectedPx, persistedPrefixes.value)) {
        throw new Error(`${protectedPx} is printed on physical tags and cannot be removed.`);
      }
    }

    const nextPolicy = normalizePolicyConfig({
      ...policy.value,
      members: policy.value.members.map((m) => ({
        ...m,
        partner: derivePartnerCode(m),
        role: deriveRoleLabel(m),
      })),
    });

    const teamId = currentTeam.value?.$id || teams.value?.find((t: any) => t?.$id)?.$id;
    const cleanLocation = form.value.defaultStorageLocation?.trim().toUpperCase() || 'HG';

    if (teamId) {
      const currentPrefs = currentTeam.value?.prefs || {};
      await updateTeamPrefs(teamId, {
        ...(typeof currentPrefs === 'object' ? currentPrefs : {}),
        upcPrefix: form.value.upcPrefix,
        partnerPrefixes: cleanPartners,
        defaultStorageLocation: cleanLocation,
      });
    } else {
      await updatePrefs({
        ...(user.value?.prefs || {}),
        upcPrefix: form.value.upcPrefix,
        partnerPrefixes: cleanPartners,
        defaultStorageLocation: cleanLocation,
      });
    }

    const synced = await saveCoopGovernanceState({ policyConfig: nextPolicy }, teamId || 'huck_collective');
    policy.value = nextPolicy;
    form.value.partnerPrefixes = form.value.partnerPrefixes.map((p) => ({ ...p, isNew: false }));
    persistedPrefixes.value = [form.value.upcPrefix, ...cleanPartners.map((p) => p.prefix)];
    message.value = synced ? 'Settings saved & synced to the collective.' : 'Saved locally. Cloud sync failed.';
    setTimeout(() => { message.value = ''; }, 3500);
  } catch (err: any) {
    console.error('Failed to save settings:', err);
    error.value = toUserMessage(err, 'Failed to save settings.');
  } finally {
    saving.value = false;
  }
};

onMounted(async () => {
  if (!capabilities.value.canSeeCollectiveFinancials) return;
  if (typeof window !== 'undefined') {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab === 'personas' || tab === 'locations' || tab === 'team' || tab === 'hardware') activeTab.value = tab;
    if (tab === 'bookmarklets') activeTab.value = 'hardware';
    if (tab === 'members') activeTab.value = 'team';
  }
  await Promise.all([loadSettings(), loadWarehouses()]);
});

watch(currentTeam, async () => {
  if (!capabilities.value.canSeeCollectiveFinancials) return;
  await Promise.all([loadSettings(), loadWarehouses()]);
});
</script>
