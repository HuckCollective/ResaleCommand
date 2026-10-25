<template>
  <div class="space-y-8">
    <div v-if="!currentTeam" class="alert alert-info">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      <span>You are currently in your <strong>Personal Inventory</strong>. Some settings are only available when working within a Team/Workspace.</span>
    </div>

    <!-- UPC & Inventory Intake Settings -->
    <div class="card bg-base-100 shadow-xl border border-base-200">
      <div class="card-body">
        <h2 class="card-title text-xl mb-4">Inventory &amp; Intake Defaults</h2>
        
        <form @submit.prevent="saveSettings" class="space-y-6 max-w-lg">
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text font-bold">Default Receiving / Backstock Facility</span>
              <span class="label-text-alt opacity-70">Where new purchases are placed</span>
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select 
                v-model="form.defaultStorageLocation" 
                class="select select-bordered w-full bg-base-200"
                :disabled="loading"
              >
                <option value="HG">HG — Main Warehouse / Home Base</option>
                <option value="MD">MD — Memory Den</option>
                <option value="DT">DT — Dusty Tiger</option>
                <option value="ONLINE">ONLINE — E-Commerce / Staged</option>
                <option :value="customLocationValue" v-if="isCustomLocation">
                  Custom: {{ form.defaultStorageLocation }}
                </option>
              </select>
              <input 
                type="text" 
                v-model="form.defaultStorageLocation" 
                placeholder="Or enter code (e.g. HG, BIN-A1)" 
                class="input input-bordered w-full bg-base-200 font-mono uppercase" 
                :disabled="loading"
              />
            </div>
            <label class="label">
              <span class="label-text-alt opacity-70">
                New purchases, received lots, and cart checkouts will automatically assign to this storage location unless specified.
              </span>
            </label>
          </div>

          <div class="divider my-2"></div>

          <div class="form-control w-full">
            <label class="label">
              <span class="label-text font-bold">Primary Organization UPC / SKU Prefix</span>
            </label>
            <input 
              type="text" 
              v-model="form.upcPrefix" 
              placeholder="e.g. HUCK-" 
              class="input input-bordered w-full bg-base-200 font-mono uppercase font-bold" 
              :disabled="loading"
            />
            <label class="label">
              <span class="label-text-alt opacity-70">Primary prefix used to generate unique readable barcodes for your organization (e.g. {{ form.upcPrefix || 'HUCK-' }}0001).</span>
            </label>
          </div>

          <!-- Partner & Vendor Consignor Prefixes -->
          <div class="form-control w-full p-4 rounded-2xl bg-base-200/50 border border-base-300 space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <label class="label-text font-bold text-sm flex items-center gap-1.5">
                  <Icon icon="solar:users-group-two-rounded-bold" class="w-4 h-4 text-primary" />
                  Partner &amp; Vendor SKU / Barcode Prefixes
                </label>
                <p class="text-xs text-base-content/70 mt-0.5">
                  Partition partner inventory, payout ledgers, and sales reports (e.g. <code>PDXGL-</code> for PDX Game Library).
                  <a href="/coop" class="link link-primary font-bold ml-1 text-xs">Learn how partner splits work &rarr;</a>
                </p>
              </div>
              <button 
                type="button" 
                class="btn btn-xs btn-primary gap-1"
                @click="addPartnerPrefix"
                :disabled="loading"
              >
                <Icon icon="solar:add-circle-bold" class="w-3.5 h-3.5" />
                Add Partner
              </button>
            </div>

            <div v-if="form.partnerPrefixes.length === 0" class="text-xs opacity-60 italic py-1">
              No partner prefixes configured. Add one below to separate partner sales ledgers.
            </div>

              <div 
                v-for="(partner, idx) in form.partnerPrefixes" 
                :key="idx" 
                class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-base-100 p-2.5 rounded-xl border border-base-200"
              >
                <!-- Prefix -->
                <div class="w-full sm:w-32">
                  <span class="text-[10px] uppercase font-bold opacity-60 block">Prefix</span>
                  <input 
                    type="text" 
                    v-model="partner.prefix" 
                    placeholder="e.g. PDXGL-" 
                    class="input input-bordered input-xs w-full font-mono uppercase font-bold text-xs"
                    :disabled="loading"
                  />
                </div>

                <!-- Partner Name -->
                <div class="flex-1 min-w-0">
                  <span class="text-[10px] uppercase font-bold opacity-60 block">Partner / Consignor Name</span>
                  <input 
                    type="text" 
                    v-model="partner.name" 
                    placeholder="e.g. PDX Game Library" 
                    class="input input-bordered input-xs w-full text-xs"
                    :disabled="loading"
                  />
                </div>

                <!-- Linked App Organization (If partner is another org on Resale Command) -->
                <div class="w-full sm:w-44">
                  <span class="text-[10px] uppercase font-bold opacity-60 block flex items-center gap-1">
                    <Icon icon="solar:link-minimalistic-bold" class="w-3 h-3 text-secondary" />
                    Linked App Org
                  </span>
                  <select 
                    v-model="partner.linkedTeamId" 
                    @change="onPartnerTeamSelect(partner)"
                    class="select select-bordered select-xs w-full text-xs font-medium"
                    :disabled="loading"
                  >
                    <option value="">(External Partner)</option>
                    <option v-for="t in otherTeams" :key="t.$id" :value="t.$id">
                      {{ t.name }}
                    </option>
                  </select>
                </div>

                <!-- Remove Button -->
                <button 
                  type="button" 
                  class="btn btn-xs btn-ghost btn-circle text-error sm:mt-4 self-end sm:self-center" 
                  @click="removePartnerPrefix(idx)"
                  title="Remove partner prefix"
                >
                  ✕
                </button>
              </div>
          </div>

          <div class="mt-4 flex gap-2">
            <button type="submit" class="btn btn-primary px-8" :disabled="loading || saving">
              <span v-if="saving" class="loading loading-spinner loading-sm"></span>
              Save Settings
            </button>
          </div>
          
          <div v-if="message" class="text-success text-sm font-bold mt-2">
            {{ message }}
          </div>
          <div v-if="error" class="text-error text-sm font-bold mt-2">
            {{ error }}
          </div>
        </form>
      </div>
    </div>

    <!-- Thermal Label & Hardware Studio Card -->
    <div class="card bg-base-100 shadow-xl border border-base-200">
      <div class="card-body">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="card-title text-xl flex items-center gap-2">
              <Icon icon="solar:printer-bold" class="w-6 h-6 text-primary" />
              Thermal Label &amp; Hardware Studio
            </h2>
            <p class="text-sm text-base-content/70 mt-1 max-w-xl">
              Calibrate direct thermal printers, preview vector Code128 barcodes, test gap sensors, and print on-the-fly replacement tags for lost booth stickers.
            </p>
          </div>
          <a href="/labels/studio" class="btn btn-primary font-bold gap-2 shrink-0">
            <Icon icon="solar:printer-bold" class="w-5 h-5" />
            Launch Studio ➔
          </a>
        </div>

        <div class="divider my-3"></div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="p-3 rounded-xl bg-base-200/60 border border-base-300">
            <div class="text-xs font-bold text-base-content/80">🏷️ Supported Media</div>
            <div class="text-xs text-base-content/60 mt-1">2"×1" Booth, 2.2"×0.5" Butterfly Jewelry, 3"×2" Bin, 4"×6" Shipping</div>
          </div>
          <div class="p-3 rounded-xl bg-base-200/60 border border-base-300">
            <div class="text-xs font-bold text-base-content/80">🖨️ Hardware Profiles</div>
            <div class="text-xs text-base-content/60 mt-1">Rollo Direct Thermal, Zebra ZD411, Dymo 550, Munbyn (Mac &amp; PC)</div>
          </div>
          <div class="p-3 rounded-xl bg-base-200/60 border border-base-300">
            <div class="text-xs font-bold text-base-content/80">⚡ Ricochet POS Authority</div>
            <div class="text-xs text-base-content/60 mt-1">Memory Den 6-char location SKU encoding for instant register checkout</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useAuth } from '../../composables/useAuth';
import { getDefaultStorageLocation } from '../../lib/warehouses';

const { currentTeam, teams, user, updateTeamPrefs, updatePrefs } = useAuth();
const loading = ref(false);
const saving = ref(false);
const message = ref('');
const error = ref('');

const form = ref({
  upcPrefix: '',
  defaultStorageLocation: 'HG',
  partnerPrefixes: [] as Array<{ prefix: string; name: string; linkedTeamId?: string }>
});

const isCustomLocation = computed(() => {
  const loc = form.value.defaultStorageLocation?.trim().toUpperCase();
  return loc && !['HG', 'MD', 'DT', 'ONLINE'].includes(loc);
});

const customLocationValue = computed(() => form.value.defaultStorageLocation);

const otherTeams = computed(() => {
  const currentId = currentTeam.value?.$id;
  return (teams.value || []).filter(t => t && t.$id !== currentId);
});

const onPartnerTeamSelect = (partner: any) => {
  if (!partner.linkedTeamId) return;
  const match = teams.value?.find((t: any) => t.$id === partner.linkedTeamId);
  if (match) {
    if (!partner.name || partner.name.includes('Partner')) {
      partner.name = match.name;
    }
    const teamPref = (match.prefs as any)?.upcPrefix;
    if (!partner.prefix && teamPref) {
      partner.prefix = teamPref;
    }
  }
};

const addPartnerPrefix = () => {
  form.value.partnerPrefixes.push({ prefix: '', name: '', linkedTeamId: '' });
};

const removePartnerPrefix = (idx: number) => {
  form.value.partnerPrefixes.splice(idx, 1);
};

const loadSettings = () => {
  const prefs = (currentTeam.value ? currentTeam.value.prefs : user.value?.prefs) || {};
  form.value.upcPrefix = prefs.upcPrefix || 'HUCK-';
  form.value.defaultStorageLocation = getDefaultStorageLocation(currentTeam.value || user.value);
  
  if (Array.isArray(prefs.partnerPrefixes) && prefs.partnerPrefixes.length > 0) {
    form.value.partnerPrefixes = prefs.partnerPrefixes.map((p: any) => 
      typeof p === 'string' 
        ? { prefix: p, name: `${p.replace(/[-_]$/, '')} Partner`, linkedTeamId: '' } 
        : { prefix: p.prefix || '', name: p.name || '', linkedTeamId: p.linkedTeamId || '' }
    );
  } else {
    // Default initial partner configuration for PDX Game Library and Sub-Clients
    form.value.partnerPrefixes = [
      { prefix: 'PDXGL-', name: 'PDX Game Library', linkedTeamId: '' },
      { prefix: 'BB-', name: 'B&B Consignment (PDXGL Sub-Client)', linkedTeamId: '' }
    ];
  }
};

const saveSettings = async () => {
  saving.value = true;
  message.value = '';
  error.value = '';
  try {
    const cleanLocation = form.value.defaultStorageLocation?.trim().toUpperCase() || 'HG';
    const cleanPrimaryPrefix = form.value.upcPrefix?.trim().toUpperCase() || 'HUCK-';
    const cleanPartners = form.value.partnerPrefixes
      .filter(p => p.prefix && p.prefix.trim())
      .map(p => {
        let pref = p.prefix.trim().toUpperCase();
        if (!pref.endsWith('-') && !pref.endsWith('_')) pref += '-';
        return {
          prefix: pref,
          name: p.name.trim() || `${pref.replace(/[-_]$/, '')} Partner`,
          linkedTeamId: p.linkedTeamId || undefined
        };
      });

    const teamId = currentTeam.value?.$id || 
                   teams.value?.find((t: any) => t?.$id)?.$id || 
                   (typeof localStorage !== 'undefined' ? localStorage.getItem('activeTeamId') : null);

    if (teamId) {
      console.log('Saving for team ID:', teamId);
      const currentPrefs = currentTeam.value?.prefs || currentTeam.value || {};
      await updateTeamPrefs(teamId, {
        ...(typeof currentPrefs === 'object' ? currentPrefs : {}),
        upcPrefix: cleanPrimaryPrefix,
        partnerPrefixes: cleanPartners,
        defaultStorageLocation: cleanLocation
      });
    } else {
      const currentPrefs = user.value?.prefs || {};
      await updatePrefs({
        ...currentPrefs,
        upcPrefix: cleanPrimaryPrefix,
        partnerPrefixes: cleanPartners,
        defaultStorageLocation: cleanLocation
      });
    }
    message.value = 'Settings saved successfully!';
    setTimeout(() => { message.value = ''; }, 3000);
  } catch (err: any) {
    console.error('Failed to save settings:', err);
    error.value = err.message || 'Failed to save settings.';
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  loadSettings();
});

watch(currentTeam, () => {
  loadSettings();
});
</script>
