<template>
  <div class="card bg-base-100 border border-base-200 shadow-sm rounded-3xl p-5 sm:p-6 space-y-5">
    <!-- Header & 14-Day Member Session Status -->
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div class="space-y-1">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="badge badge-sm badge-primary text-primary-content font-extrabold whitespace-nowrap">
            🔐 Member-Gated Bookmarklets
          </span>
          <span
            v-if="localSession"
            class="badge badge-sm badge-success text-success-content font-mono font-bold whitespace-nowrap"
          >
            ✅ Active: {{ localSession.name }} ({{ localSession.prefix }})
          </span>
          <span
            v-else
            class="badge badge-sm badge-warning text-warning-content font-bold whitespace-nowrap"
          >
            ⏳ Not Minted on This Browser Yet
          </span>
        </div>
        <h3 class="text-lg font-black text-base-content">
          Bookmarklet Hub, Bar Customizer &amp; Pixel 8 Triggers
        </h3>
        <p class="text-xs text-base-content/70 max-w-2xl leading-relaxed">
          Customize your Chrome Bookmarks Bar labels, icons, HUD titles, and Pixel 8 address-bar trigger keywords. All bookmarklet API routes enforce a signed 14-day member session (<code class="font-mono font-bold">/bml/connect</code>) so zero credentials ever touch third-party pages.
        </p>
      </div>

      <div class="flex items-center gap-2 flex-wrap shrink-0">
        <button
          type="button"
          class="btn btn-sm btn-primary text-primary-content font-black rounded-xl gap-1.5 shadow-xs"
          :disabled="minting"
          @click="mintLocalToken"
        >
          <span v-if="minting" class="loading loading-spinner loading-xs"></span>
          <Icon v-else icon="solar:shield-keyhole-bold" class="w-4 h-4 shrink-0" />
          <span>{{ localSession ? 'Refresh 14-Day Token' : 'Activate 14-Day Token' }}</span>
        </button>
        <a
          href="/bml/connect"
          target="_blank"
          rel="noopener"
          class="btn btn-sm btn-outline rounded-xl font-bold gap-1.5"
        >
          <Icon icon="solar:square-top-down-bold" class="w-3.5 h-3.5 shrink-0" />
          <span>Handshake Page</span>
        </a>
      </div>
    </div>

    <!-- 2-Card Registry Grid -->
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div
        v-for="toolId in toolOrder"
        :key="toolId"
        class="rounded-2xl border border-base-300 bg-base-200/40 p-4 sm:p-5 space-y-4 flex flex-col justify-between"
      >
        <div class="space-y-3.5">
          <!-- Tool Header + Live Draggable Pill -->
          <div class="flex items-start justify-between gap-2 flex-wrap">
            <div class="space-y-0.5">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-black text-sm text-base-content">
                  {{ registry.tools[toolId].icon }} {{ registry.tools[toolId].barTitle }}
                </span>
                <span
                  v-if="registry.tools[toolId].status === 'active'"
                  class="badge badge-xs badge-success text-success-content font-bold whitespace-nowrap"
                >
                  Live Active
                </span>
                <span
                  v-else
                  class="badge badge-xs badge-info text-info-content font-bold whitespace-nowrap"
                >
                  Phase 2 Ready
                </span>
              </div>
              <div class="text-[11px] font-mono text-base-content/65">
                Target: {{ registry.tools[toolId].targetSites }}
              </div>
            </div>

            <!-- Live Draggable Pill Preview -->
            <a
              v-if="registry.tools[toolId].status === 'active'"
              :href="ricochetHref"
              @click.prevent="notifyDrag(toolId)"
              class="btn btn-xs sm:btn-sm btn-warning text-warning-content font-black shadow-xs border border-warning-content/20 cursor-grab active:cursor-grabbing gap-1.5"
              :title="'⬆️ Drag me to your Desktop Chrome Bookmarks Bar (Ctrl+Shift+B)!'"
            >
              <span>{{ getBarPreview(toolId) }}</span>
            </a>
            <span
              v-else
              class="badge badge-sm badge-ghost border border-base-300 font-bold whitespace-nowrap"
              title="Bookmarklet bar preview for Phase 2 Auction Scout"
            >
              {{ getBarPreview(toolId) }}
            </span>
          </div>

          <p class="text-xs text-base-content/75 leading-relaxed">
            {{ registry.tools[toolId].summary }}
          </p>

          <!-- Install Actions (Desktop Drag + Pixel 8 Address-Bar Keyword) -->
          <div class="rounded-xl bg-base-100 border border-base-300 p-3 space-y-2">
            <div class="flex items-center justify-between gap-2 flex-wrap text-xs">
              <span class="font-extrabold text-base-content">📱 Pixel 8 Chrome Trigger Name:</span>
              <code class="font-mono font-black text-primary bg-primary/10 px-2 py-0.5 rounded-lg">
                {{ getMobileBookmarkName(toolId) }}
              </code>
            </div>
            <div class="text-[11px] text-base-content/65">
              On Android Chrome, save any bookmark with this name, paste the copied JS URL as its address, then type
              <kbd class="kbd kbd-xs font-mono">{{ getKeywordPreview(toolId) }}</kbd> in the address bar on target pages.
            </div>
            <div v-if="registry.tools[toolId].status === 'active'" class="flex items-center gap-2 flex-wrap pt-1">
              <button
                type="button"
                class="btn btn-xs btn-outline font-bold gap-1"
                @click="copyJsUrl(toolId)"
              >
                <span>📋 Copy JS URL</span>
              </button>
              <button
                type="button"
                class="btn btn-xs btn-ghost border border-base-300 font-bold gap-1"
                @click="copyMobileTitle(toolId)"
              >
                <span>📱 Copy Pixel 8 Name</span>
              </button>
            </div>
          </div>

          <!-- Customizer Controls -->
          <div class="space-y-3 pt-1">
            <!-- Icon Presets & Display Mode -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div class="flex items-center gap-1 flex-wrap">
                <span class="text-[11px] font-bold opacity-70 mr-1">Icon:</span>
                <button
                  v-for="ic in BML_ICON_PRESETS"
                  :key="ic"
                  type="button"
                  :disabled="!canEdit"
                  class="btn btn-xs h-7 w-7 min-h-0 rounded-lg font-normal"
                  :class="registry.tools[toolId].icon === ic ? 'btn-primary text-primary-content' : 'btn-ghost border border-base-300'"
                  @click="registry.tools[toolId].icon = ic"
                >
                  {{ ic }}
                </button>
              </div>

              <div class="join">
                <button
                  v-for="m in displayModes"
                  :key="m.id"
                  type="button"
                  :disabled="!canEdit"
                  class="btn btn-xs join-item font-bold"
                  :class="registry.tools[toolId].displayMode === m.id ? 'btn-secondary text-secondary-content' : 'btn-ghost border border-base-300'"
                  @click="registry.tools[toolId].displayMode = m.id"
                >
                  {{ m.label }}
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div class="form-control">
                <label class="label py-0.5">
                  <span class="label-text text-[11px] font-bold text-base-content/75">Bookmarks Bar Title</span>
                </label>
                <input
                  v-model="registry.tools[toolId].barTitle"
                  type="text"
                  maxlength="32"
                  :disabled="!canEdit"
                  class="input input-bordered input-xs rounded-lg w-full bg-base-100 font-semibold"
                />
              </div>

              <div class="form-control">
                <label class="label py-0.5">
                  <span class="label-text text-[11px] font-bold text-base-content/75">Compact Title &amp; Pixel Keyword</span>
                </label>
                <div class="flex items-center gap-1.5">
                  <input
                    v-model="registry.tools[toolId].compactTitle"
                    type="text"
                    maxlength="16"
                    :disabled="!canEdit"
                    placeholder="MD Sync"
                    class="input input-bordered input-xs rounded-lg flex-1 min-w-0 bg-base-100 font-semibold"
                  />
                  <input
                    v-model="registry.tools[toolId].mobileKeyword"
                    type="text"
                    maxlength="8"
                    :disabled="!canEdit"
                    placeholder="md"
                    title="Short Pixel 8 Chrome address-bar keyword"
                    class="input input-bordered input-xs rounded-lg w-16 bg-base-100 font-mono font-bold lowercase text-center"
                  />
                </div>
              </div>
            </div>

            <div class="form-control">
              <label class="label py-0.5">
                <span class="label-text text-[11px] font-bold text-base-content/75">In-Page HUD Header Title</span>
              </label>
              <input
                v-model="registry.tools[toolId].hudTitle"
                type="text"
                maxlength="56"
                :disabled="!canEdit"
                class="input input-bordered input-xs rounded-lg w-full bg-base-100 font-semibold"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Phase 0 Diagnostic Tester Card (🧪 BML Test) -->
    <div class="rounded-2xl border border-info/40 bg-info/10 p-4 sm:p-5 space-y-3">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="space-y-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="badge badge-xs badge-info text-info-content font-black uppercase tracking-wider">
              Phase 0 Diagnostic
            </span>
            <h4 class="font-black text-sm text-base-content">
              🧪 BML Test — Cross-Site CSP, Ping &amp; DOM Inspector
            </h4>
          </div>
          <p class="text-xs text-base-content/75 leading-relaxed max-w-2xl">
            1) Drag <strong class="font-bold">🧪 BML Test</strong> to your Chrome Bookmarks Bar. 2) Open any ShopGoodwill page and click it. 3) Click <strong class="font-bold">📋 Copy Report</strong> on the bottom-right pill and paste the 5-line report back into chat! (Zero third-party cookies or tokens are ever read.)
          </p>
        </div>

        <div class="flex items-center gap-2 flex-wrap shrink-0">
          <a
            :href="bmlTestHref"
            @click.prevent="notifyTestDrag"
            class="btn btn-xs sm:btn-sm btn-info text-info-content font-black shadow-xs border border-info-content/20 cursor-grab active:cursor-grabbing gap-1.5"
            title="⬆️ Drag me to your Desktop Chrome Bookmarks Bar (Ctrl+Shift+B)!"
          >
            <span>🧪 BML Test</span>
          </a>
          <button
            type="button"
            class="btn btn-xs sm:btn-sm btn-outline font-bold gap-1"
            @click="copyTestJsUrl"
          >
            <span>📋 Copy Tester URL</span>
          </button>
        </div>
      </div>

      <div class="flex items-center gap-2 flex-wrap text-[11px] pt-1 border-t border-info/20">
        <span class="font-bold text-base-content/70">Quick Test Targets:</span>
        <a
          href="https://shopgoodwill.com/shopgoodwill/inprogress-auctions"
          target="_blank"
          rel="noopener noreferrer"
          class="badge badge-sm badge-outline hover:badge-info font-mono font-bold gap-1"
        >
          <span>1. inprogress-auctions ↗</span>
        </a>
        <a
          href="https://shopgoodwill.com/shopgoodwill/closed-auctions"
          target="_blank"
          rel="noopener noreferrer"
          class="badge badge-sm badge-outline hover:badge-info font-mono font-bold gap-1"
        >
          <span>2. closed-auctions ↗</span>
        </a>
        <a
          href="https://shopgoodwill.com/shopgoodwill/shipped-orders"
          target="_blank"
          rel="noopener noreferrer"
          class="badge badge-sm badge-outline hover:badge-info font-mono font-bold gap-1"
        >
          <span>3. shipped-orders ↗</span>
        </a>
      </div>
    </div>

    <!-- Save / Reset Action Footer -->
    <div class="flex items-center justify-between gap-3 flex-wrap pt-1 border-t border-base-200">
      <div class="text-xs text-base-content/65">
        <span v-if="savedMsg" class="text-success font-bold">{{ savedMsg }}</span>
        <span v-else-if="errMsg" class="text-error font-bold">{{ errMsg }}</span>
        <span v-else>Changes update both the draggable Bookmarks Bar pills and the live in-page HUD header immediately.</span>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="btn btn-xs sm:btn-sm btn-ghost border border-base-300 rounded-xl font-bold"
          :disabled="!canEdit || saving"
          @click="resetDefaults"
        >
          ↺ Reset Defaults
        </button>
        <button
          type="button"
          class="btn btn-xs sm:btn-sm btn-primary text-primary-content rounded-xl font-black gap-1.5"
          :disabled="!canEdit || saving"
          @click="saveRegistry"
        >
          <span v-if="saving" class="loading loading-spinner loading-xs"></span>
          <span>💾 Save Bookmarklet Registry</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Icon } from '@iconify/vue';
import { account } from '../../lib/appwrite';
import { useAuth } from '../../composables/useAuth';
import { addToast } from '../../stores/toast';
import { buildRicochetBookmarkletHref } from '../../lib/warehouses';
import {
  BML_ICON_PRESETS,
  DEFAULT_BML_REGISTRY_CONFIG,
  buildEvergreenBookmarkletHref,
  formatBmlBarLabel,
  formatBmlMobileBookmarkName,
  getCachedBmlRegistryConfig,
  loadBmlRegistryConfig,
  normalizeBmlRegistryConfig,
  saveBmlRegistryConfig,
  type BookmarkletDisplayMode,
  type BookmarkletRegistryConfig,
  type BookmarkletToolId,
} from '../../lib/bml/registry';

const props = withDefaults(
  defineProps<{
    canEdit?: boolean;
    defaultLocationCode?: string;
    defaultLocationShortName?: string;
  }>(),
  {
    canEdit: true,
    defaultLocationCode: 'MD',
    defaultLocationShortName: 'Memory Den',
  }
);

const { currentTeam, user } = useAuth();
const toolOrder: BookmarkletToolId[] = ['ricochet_sync', 'auction_scout'];
const displayModes: { id: BookmarkletDisplayMode; label: string }[] = [
  { id: 'full', label: 'Full' },
  { id: 'compact', label: 'Compact' },
  { id: 'icon_only', label: 'Icon' },
];

const registry = ref<BookmarkletRegistryConfig>(getCachedBmlRegistryConfig());
const saving = ref(false);
const minting = ref(false);
const savedMsg = ref('');
const errMsg = ref('');
const localSession = ref<{ name: string; prefix: string } | null>(null);
const browserOrigin = ref<string>(
  typeof window !== 'undefined' && window.location?.origin ? window.location.origin : ''
);

const ricochetHref = computed(() => {
  void browserOrigin.value;
  return buildRicochetBookmarkletHref(props.defaultLocationCode || 'MD');
});
const bmlTestHref = computed(() =>
  buildEvergreenBookmarkletHref('/scripts/bml-test.js', browserOrigin.value || undefined)
);

const getBarPreview = (id: BookmarkletToolId) =>
  formatBmlBarLabel(
    registry.value.tools[id],
    id === 'ricochet_sync' ? props.defaultLocationShortName : undefined
  );

const getMobileBookmarkName = (id: BookmarkletToolId) =>
  formatBmlMobileBookmarkName(
    registry.value.tools[id],
    id === 'ricochet_sync' ? registry.value.tools[id].mobileKeyword || props.defaultLocationCode : undefined
  );

const getKeywordPreview = (id: BookmarkletToolId) =>
  (registry.value.tools[id].mobileKeyword || (id === 'ricochet_sync' ? 'md' : 'sgw')).toLowerCase();

const readBrowserBmlSession = () => {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('rc_bml_session_v1');
    if (!raw) {
      localSession.value = null;
      return;
    }
    const parsed = JSON.parse(raw);
    if (parsed?.token) {
      localSession.value = {
        name: parsed.name || 'Member',
        prefix: parsed.prefix || 'HUCK-',
      };
    }
  } catch {
    localSession.value = null;
  }
};

const mintLocalToken = async () => {
  minting.value = true;
  errMsg.value = '';
  try {
    const jwtRes = await account.createJWT();
    const res = await fetch('/api/bml/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-JWT': jwtRes.jwt,
      },
    });
    const data = await res.json();
    if (!res.ok || !data?.ok || !data?.token) {
      throw new Error(data?.error || 'Could not mint bookmarklet token.');
    }
    const memberInfo = {
      name: data.member?.name || user.value?.name || 'Member',
      prefix: data.member?.prefix || 'HUCK-',
    };
    localStorage.setItem(
      'rc_bml_session_v1',
      JSON.stringify({
        token: data.token,
        name: memberInfo.name,
        prefix: memberInfo.prefix,
        savedAt: Date.now(),
      })
    );
    localSession.value = memberInfo;
    addToast({ type: 'success', message: `14-day Bookmarklet Token active for ${memberInfo.name}!` });
  } catch (e: any) {
    errMsg.value = e?.message || 'Failed to mint bookmarklet token.';
  } finally {
    minting.value = false;
  }
};

const notifyDrag = (id: BookmarkletToolId) => {
  addToast({
    type: 'info',
    message: `Drag "${getBarPreview(id)}" up to your Chrome Bookmarks Bar (Ctrl+Shift+B), then click it on your target tab!`,
  });
};

const copyJsUrl = async (id: BookmarkletToolId) => {
  if (id !== 'ricochet_sync') return;
  try {
    await navigator.clipboard.writeText(ricochetHref.value);
    addToast({ type: 'success', message: 'Copied Bookmarklet JavaScript URL to clipboard!' });
  } catch {
    addToast({ type: 'error', message: 'Could not copy bookmarklet URL.' });
  }
};

const notifyTestDrag = () => {
  addToast({
    type: 'info',
    message: 'Drag "🧪 BML Test" up to your Chrome Bookmarks Bar (Ctrl+Shift+B), then click it on any ShopGoodwill tab!',
  });
};

const copyTestJsUrl = async () => {
  try {
    await navigator.clipboard.writeText(bmlTestHref.value);
    addToast({ type: 'success', message: 'Copied 🧪 BML Test JavaScript URL to clipboard!' });
  } catch {
    addToast({ type: 'error', message: 'Could not copy tester bookmarklet URL.' });
  }
};

const copyMobileTitle = async (id: BookmarkletToolId) => {
  try {
    const label = getMobileBookmarkName(id);
    await navigator.clipboard.writeText(label);
    addToast({ type: 'success', message: `Copied Pixel 8 bookmark name: "${label}"` });
  } catch {
    addToast({ type: 'error', message: 'Could not copy mobile bookmark name.' });
  }
};

const resetDefaults = () => {
  registry.value = normalizeBmlRegistryConfig(DEFAULT_BML_REGISTRY_CONFIG);
};

const saveRegistry = async () => {
  if (!props.canEdit) return;
  saving.value = true;
  savedMsg.value = '';
  errMsg.value = '';
  try {
    const updated = await saveBmlRegistryConfig(
      registry.value,
      currentTeam.value?.$id || 'huck_collective',
      user.value?.name || user.value?.email || 'Member'
    );
    registry.value = updated;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rc-bml-registry-updated', { detail: updated }));
    }
    savedMsg.value = '✅ Bookmarklet registry saved & synced to cloud!';
    setTimeout(() => {
      savedMsg.value = '';
    }, 3500);
  } catch (e: any) {
    errMsg.value = e?.message || 'Failed to save bookmarklet registry.';
  } finally {
    saving.value = false;
  }
};

onMounted(async () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    browserOrigin.value = window.location.origin;
  }
  readBrowserBmlSession();
  registry.value = await loadBmlRegistryConfig();
});
</script>
