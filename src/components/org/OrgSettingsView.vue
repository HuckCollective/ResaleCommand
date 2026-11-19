<template>
  <div v-if="loading" class="space-y-6 py-6">
    <div class="skeleton h-32 w-full rounded-2xl"></div>
    <div class="skeleton h-48 w-full rounded-2xl"></div>
  </div>

  <div v-else-if="!isAuthenticated" class="alert alert-warning">
    <span>Please login to view settings.</span>
  </div>

  <div v-else-if="!currentTeam" class="alert alert-info">
    <span>No organization selected. Please create or join an organization.</span>
  </div>

  <div v-else class="space-y-8">

    <!-- Org Overview -->
    <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
            <div class="flex justify-between items-center mb-4">
                <h2 class="card-title text-2xl">{{ currentTeam.name }}</h2>
                <div class="flex flex-col items-end gap-1">
                    <span class="badge badge-neutral font-mono text-xs whitespace-nowrap shrink-0">Active Workspace</span>
                    <span class="text-xs opacity-75">Logged in as: <strong class="text-primary">{{ user?.email }}</strong></span>
                </div>
            </div>
            
            <div class="stats shadow w-full">
                <div class="stat">
                    <div class="stat-title">Created</div>
                    <div class="stat-value text-lg">{{ new Date(currentTeam.$createdAt).toLocaleDateString() }}</div>
                </div>
                <div class="stat">
                    <div class="stat-title">Members</div>
                    <div class="stat-value text-lg">{{ members.length }}</div>
                </div>
                <div class="stat">
                    <div class="stat-title">My Role</div>
                    <div class="stat-value text-lg badge badge-primary mt-2 whitespace-nowrap shrink-0">{{ isOwner ? 'Account Steward' : 'Member' }}</div>
                </div>
            </div>
        </div>
    </div>

    <!-- Cooperative Charter & Operating Agreement -->
    <div class="card bg-gradient-to-r from-primary/10 via-base-200 to-base-100 border border-primary/20 shadow-md">
      <div class="card-body p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
            <Icon icon="solar:shield-star-bold" class="w-6 h-6" />
          </div>
          <div>
            <h3 class="font-extrabold text-base text-base-content">Huckleberry Collective Charter &amp; Member Rules</h3>
            <p class="text-xs text-base-content/70">
              Democracy at Work, 3-tier financial distribution waterfall, 100% cost recoupment, and partner prefix attribution.
            </p>
          </div>
        </div>
        <a href="/coop" class="btn btn-sm h-11 md:h-8 btn-outline btn-primary gap-1.5 font-bold shrink-0">
          <span>Read Co-op Charter</span>
          <Icon icon="solar:arrow-right-linear" class="w-4 h-4" />
        </a>
      </div>
    </div>

    <!-- Unified Collective Roster Link Card (Replaces Legacy Duplicate Table) -->
    <div v-if="isOwner" class="card bg-base-100 border border-primary/25 shadow-sm rounded-2xl">
        <div class="card-body p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    <Icon icon="solar:users-group-two-rounded-bold-duotone" class="w-5 h-5" />
                </div>
                <div>
                    <div class="flex items-center gap-2 flex-wrap">
                        <h3 class="font-extrabold text-base text-base-content">Collective Roster &amp; Member Access</h3>
                        <span class="badge badge-primary badge-outline badge-xs font-mono font-bold">
                            {{ members.length }} {{ members.length === 1 ? 'member' : 'members' }}
                        </span>
                    </div>
                    <p class="text-xs text-base-content/75 mt-1">
                        Invite new Collective members, edit member names or hats, activate pending invites, and lock unique Curator SKU prefixes in one unified roster.
                    </p>
                </div>
            </div>
            <a href="/coop/governance#roster" class="btn btn-sm h-11 md:h-9 btn-primary rounded-xl font-black gap-1.5 shrink-0">
                <span>Open Unified Collective Roster</span>
                <Icon icon="solar:arrow-right-linear" class="w-4 h-4" />
            </a>
        </div>
    </div>

    <div v-else class="alert">
        <Icon icon="solar:info-circle-linear" class="w-6 h-6 text-info" />
        <span>Only Account Stewards can manage organization settings.</span>
    </div>

    <!-- API Security Settings (Owner Only) -->
    <div v-if="isOwner" class="card bg-base-100 shadow-xl">
        <div class="card-body">
            <h3 class="font-bold text-xl mb-2">API Security</h3>
            
            <div class="form-control w-full max-w-md">
                <label class="label">
                    <span class="label-text font-bold">Allowed API Domains</span>
                    <span class="label-text-alt">Limit 3</span>
                </label>
                
                <div class="flex gap-2">
                    <input type="url" v-model="newDomain" placeholder="https://example.com" class="input input-bordered w-full" @keydown.enter.prevent="addDomain" :disabled="orgSettings.allowedDomains && orgSettings.allowedDomains.length >= 3" />
                    <button class="btn btn-outline btn-primary h-11 md:h-10 font-bold" @click="addDomain" :disabled="!newDomain || savingSettings || (orgSettings.allowedDomains && orgSettings.allowedDomains.length >= 3)">Add</button>
                </div>
            </div>

            <div class="flex flex-col gap-2 mt-4" v-if="orgSettings.allowedDomains && orgSettings.allowedDomains.length > 0">
                <div v-for="(dom, idx) in orgSettings.allowedDomains" :key="idx" class="flex justify-between items-center bg-base-200 p-2 rounded">
                    <span class="font-mono text-sm">{{ dom }}</span>
                    <button class="btn btn-sm h-11 md:h-8 btn-error btn-ghost" @click="removeDomain(idx)">Remove</button>
                </div>
            </div>
            <div v-else class="text-sm opacity-50 mt-4">
                No custom domains added. Your API key will accept requests from any origin.
            </div>
        </div>
    </div>

    <!-- Canonical 4-Location Architecture Reference (Law 1: Zero Free-Text Locations) -->
    <div v-if="isOwner" class="card bg-base-100 border border-base-200 shadow-sm rounded-2xl">
        <div class="card-body p-5 space-y-2">
            <div class="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h3 class="font-bold text-base text-base-content">Booths &amp; Storage Locations</h3>
                    <p class="text-xs text-base-content/70 mt-0.5">
                        Works@TheHC enforces the 4 canonical Selling Booths &amp; Backstock Storage facilities so physical inventory never fragments across free-text bin names.
                    </p>
                </div>
                <a href="/warehouse" class="btn btn-sm h-11 md:h-9 btn-outline btn-primary rounded-xl font-bold">
                    Open Booths &amp; Storage
                </a>
            </div>
        </div>
    </div>

    <!-- Storefront Settings (Owner Only) -->
    <div v-if="isOwner" class="card bg-base-100 shadow-xl border border-base-200">
        <div class="card-body">
            <h3 class="font-bold text-xl mb-2 flex items-center gap-2">
                <Icon icon="solar:shop-linear" class="w-6 h-6 text-primary" />
                Storefront Custom Site Settings
            </h3>
            <p class="text-sm text-base-content/70 mb-4">Configure your public storefront name and custom domain/subdomain mapping.</p>
            
            <div v-if="fetchingDomain" class="space-y-3 py-4 max-w-md">
                <div class="skeleton h-10 w-full rounded-xl"></div>
                <div class="skeleton h-10 w-full rounded-xl"></div>
            </div>
            <div v-else class="space-y-4 max-w-md">
                <div class="form-control w-full">
                    <label class="label">
                        <span class="label-text font-bold">Storefront Name</span>
                    </label>
                    <input type="text" v-model="tenantDomain.storeName" placeholder="e.g. Retro Tabletop Vintage" class="input input-bordered w-full" />
                </div>

                <div class="form-control w-full">
                    <label class="label">
                        <span class="label-text font-bold">Custom Domain or Subdomain</span>
                    </label>
                    <input type="text" v-model="tenantDomain.domain" :placeholder="`e.g. retro.${siteConfig.tenantRootDomain}`" class="input input-bordered w-full font-mono text-sm" />
                    <label class="label">
                        <span class="label-text-alt text-base-content/60">Enter a subdomain like <code>vintage.{{ siteConfig.tenantRootDomain }}</code> or your own custom domain.</span>
                    </label>
                </div>

                <div class="flex justify-end pt-2">
                    <button class="btn btn-primary btn-sm h-11 md:h-9 gap-2 font-black" @click="saveTenantDomain" :disabled="savingDomain || !tenantDomain.storeName || !tenantDomain.domain">
                        <span v-if="savingDomain" class="loading loading-spinner loading-xs"></span>
                        <Icon icon="solar:disk-linear" class="w-4 h-4" />
                        Save Storefront Settings
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Inventory Preferences (Owner Only) -->
    <div v-if="isOwner" class="card bg-base-100 shadow-xl border border-base-200">
        <div class="card-body">
            <h3 class="font-bold text-xl mb-2 flex items-center gap-2">
                <Icon icon="solar:settings-linear" class="w-6 h-6 text-primary" />
                Inventory Preferences
            </h3>
            <p class="text-sm text-base-content/70 mb-4">Set default display options for your organization's inventory.</p>
            
            <div class="form-control">
                <label class="label cursor-pointer justify-start gap-4">
                    <input type="checkbox" v-model="onlyShowFlaggedLocated" class="checkbox checkbox-primary" @change="saveInventoryPrefs" />
                    <div>
                        <span class="label-text font-bold text-base">Only Show Placed & Located Items by Default</span>
                        <p class="text-xs text-base-content/60 mt-0.5">Filter the inventory dashboard to show only items with status 'placed' that are categorized by storage or selling location.</p>
                    </div>
                </label>
            </div>
        </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAuth } from '../../composables/useAuth';
import { teams, ID, databases, Query } from '../../lib/appwrite';
import type { Models } from 'appwrite';
import { addToast } from '../../stores/toast';
import { confirmDialog } from '../../stores/confirm';
import { toUserMessage } from '../../lib/userFacingErrors';
import { Icon } from '@iconify/vue';
import { siteConfig } from '../../site-config';

const { user, isAuthenticated, currentTeam, ownedTeam, loading } = useAuth();

const members = ref<Models.Membership[]>([]);

const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
const orgSettings = ref({ $id: null, tenantId: '', placedLocations: [], allowedDomains: [] });
const newDomain = ref('');
const savingSettings = ref(false);

// Storefront Custom Site Settings
const tenantDomain = ref({ $id: null, domain: '', storeName: '', isActive: true });
const fetchingDomain = ref(false);
const savingDomain = ref(false);

const fetchTenantDomain = async () => {
    if (!currentTeam.value) return;
    fetchingDomain.value = true;
    try {
        const response = await databases.listDocuments(DB_ID, 'tenant_domains', [
            Query.equal('tenantId', currentTeam.value.$id),
            Query.limit(1)
        ]);
        if (response.total > 0) {
            const doc = response.documents[0];
            tenantDomain.value = {
                $id: doc.$id,
                domain: doc.domain || '',
                storeName: doc.storeName || '',
                isActive: doc.isActive ?? true
            };
        } else {
            tenantDomain.value = { $id: null, domain: '', storeName: '', isActive: true };
        }
    } catch (e: any) {
        console.error("Failed to fetch tenant domain:", e);
    } finally {
        fetchingDomain.value = false;
    }
};

const saveTenantDomain = async () => {
    if (!currentTeam.value) return;
    savingDomain.value = true;
    try {
        const dom = tenantDomain.value.domain.trim().toLowerCase();
        const name = tenantDomain.value.storeName.trim();
        
        if (!dom || !name) {
            addToast({ type: 'warning', message: "Storefront name and domain are required." });
            return;
        }

        const payload = {
            domain: dom,
            storeName: name,
            isActive: tenantDomain.value.isActive,
            tenantId: currentTeam.value.$id
        };

        if (tenantDomain.value.$id) {
            await databases.updateDocument(DB_ID, 'tenant_domains', tenantDomain.value.$id, payload);
            addToast({ type: 'success', message: "Storefront settings updated successfully!" });
        } else {
            const doc = await databases.createDocument(DB_ID, 'tenant_domains', ID.unique(), payload);
            tenantDomain.value.$id = doc.$id;
            addToast({ type: 'success', message: "Storefront settings created successfully!" });
        }
    } catch (e: any) {
        console.error("Failed to save tenant domain:", e);
        addToast({ type: 'error', message: toUserMessage(e, "Failed to save storefront settings.") });
    } finally {
        savingDomain.value = false;
    }
};

// Inventory display preferences (per tenant in localStorage)
const onlyShowFlaggedLocated = ref(false);

const loadInventoryPrefs = () => {
    if (!currentTeam.value) return;
    const val = localStorage.getItem(`resale_command_only_flagged_located_${currentTeam.value.$id}`);
    onlyShowFlaggedLocated.value = val === 'true';
};

const saveInventoryPrefs = () => {
    if (!currentTeam.value) return;
    localStorage.setItem(`resale_command_only_flagged_located_${currentTeam.value.$id}`, onlyShowFlaggedLocated.value ? 'true' : 'false');
    addToast({ type: 'success', message: "Inventory display preference saved." });
};

const isOwner = computed(() => {
    // Platform admins (users with 'admin' label) have full access to settings
    if (user.value && user.value.labels?.includes('admin')) {
        return true;
    }
    // Check if the current team matches the owned team from auth store
    if (currentTeam.value && ownedTeam.value && currentTeam.value.$id === ownedTeam.value.$id) {
        return true;
    }
    // Fallback: Check local memberships list
    if (!user.value || !members.value.length) return false;
    const myMembership = members.value.find(m => m.userId === user.value?.$id);
    return myMembership?.roles.includes('owner') || false;
});

const fetchMembers = async () => {
    if (!currentTeam.value) return;
    try {
        const response = await teams.listMemberships(currentTeam.value.$id);
        members.value = response.memberships;
    } catch (e) {
        console.error("Failed to load members", e);
    }
};

const fetchOrgSettings = async () => {
    if (!currentTeam.value) return;
    try {
        const response = await databases.listDocuments(DB_ID, 'org_settings', [
            Query.equal('tenantId', currentTeam.value.$id)
        ]);
        if (response.documents.length > 0) {
            const doc = response.documents[0];
            orgSettings.value = {
                $id: doc.$id,
                tenantId: doc.tenantId,
                placedLocations: doc.placedLocations || [],
                allowedDomains: doc.allowedDomains || []
            };
        } else {
            orgSettings.value = { $id: null, tenantId: currentTeam.value.$id, placedLocations: [], allowedDomains: [] };
        }
    } catch (e) {
        console.error("Failed to fetch org settings:", e);
    }
};

const saveOrgSettings = async () => {
    if (!currentTeam.value) return;
    savingSettings.value = true;
    try {
        if (orgSettings.value.$id) {
            await databases.updateDocument(DB_ID, 'org_settings', orgSettings.value.$id, {
                placedLocations: orgSettings.value.placedLocations,
                allowedDomains: orgSettings.value.allowedDomains
            });
        } else {
            const doc = await databases.createDocument(DB_ID, 'org_settings', ID.unique(), {
                tenantId: currentTeam.value.$id,
                placedLocations: orgSettings.value.placedLocations,
                allowedDomains: orgSettings.value.allowedDomains
            });
            orgSettings.value.$id = doc.$id;
        }
    } catch (e) {
        console.error("Failed to save org settings:", e);
        addToast({ type: 'error', message: "Failed to save settings. See console." });
    } finally {
        savingSettings.value = false;
    }
};

const addDomain = () => {
    let dom = newDomain.value.trim().toLowerCase();
    if (!dom) return;
    if (dom.endsWith('/')) dom = dom.slice(0, -1);
    
    if (!orgSettings.value.allowedDomains) orgSettings.value.allowedDomains = [];
    if (orgSettings.value.allowedDomains.length >= 3) {
        addToast({ type: 'warning', message: "Maximum 3 allowed domains permitter per organization." });
        return;
    }
    
    if (!orgSettings.value.allowedDomains.includes(dom)) {
        orgSettings.value.allowedDomains.push(dom);
        saveOrgSettings();
    }
    newDomain.value = '';
};

const removeDomain = async (idx: number) => {
    const dom = orgSettings.value.allowedDomains?.[idx];
    if (!dom) return;
    const ok = await confirmDialog(
        `Remove allowed domain "${dom}" from your organization?`,
        'Remove Allowed Domain',
        'Remove Domain',
        'Cancel',
        'btn-error'
    );
    if (!ok) return;
    if (orgSettings.value.allowedDomains) {
        orgSettings.value.allowedDomains.splice(idx, 1);
        saveOrgSettings();
    }
};

// React to team changes
watch(currentTeam, (newTeam) => {
    if (newTeam) {
        fetchMembers();
        fetchOrgSettings();
        fetchTenantDomain();
        loadInventoryPrefs();
    }
}, { immediate: true });

</script>
