<template>
  <div class="card bg-base-100 border border-base-200 shadow-sm rounded-3xl p-5 sm:p-6 space-y-5 sm:space-y-6">
    <!-- Header & 14-Day Member Session Status -->
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div class="space-y-1.5">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="badge badge-sm badge-primary text-primary-content font-extrabold whitespace-nowrap shrink-0">
            🔐 Member-Gated Bookmarklets
          </span>
          <span
            v-if="localSession"
            class="badge badge-sm badge-success text-success-content font-mono font-bold whitespace-nowrap shrink-0"
          >
            ✅ Active: {{ localSession.name }} ({{ localSession.prefix }})
          </span>
          <span
            v-else
            class="badge badge-sm badge-warning text-warning-content font-bold whitespace-nowrap shrink-0"
          >
            ⏳ Pass Not Active on This Browser Yet
          </span>
        </div>
        <component :is="headingTag" class="text-xl sm:text-2xl font-black tracking-tight text-base-content">
          Bookmarklet Hub, Desktop Bar &amp; Mobile Shortcuts
        </component>
        <p class="text-xs sm:text-sm text-base-content/75 max-w-2xl leading-relaxed">
          Customize your desktop Bookmarks Bar labels, icons, HUD titles, and mobile address-bar shortcut keywords. Every tool uses a signed 14-day member pass (<code class="font-mono font-bold">/bml/connect</code>) so zero passwords ever touch third-party pages.
        </p>
      </div>

      <div class="flex items-center gap-2 flex-wrap shrink-0">
        <button
          type="button"
          class="btn btn-sm h-11 md:h-9 rounded-xl gap-1.5 shadow-xs"
          :class="
            !localSession
              ? 'btn-primary text-primary-content font-black'
              : 'btn-outline btn-primary font-bold'
          "
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
          class="btn btn-sm h-11 md:h-9 btn-outline rounded-xl font-bold gap-1.5"
        >
          <Icon icon="solar:square-top-down-bold" class="w-3.5 h-3.5 shrink-0" />
          <span>Open Sign-In Page</span>
        </a>
      </div>
    </div>

    <!-- 3-Card Registry Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
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
                  class="badge badge-xs badge-success text-success-content font-bold whitespace-nowrap shrink-0"
                >
                  Live Active
                </span>
                <span
                  v-else
                  class="badge badge-xs badge-info text-info-content font-bold whitespace-nowrap shrink-0"
                >
                  Coming Soon
                </span>
              </div>
              <div class="text-[11px] font-mono text-base-content/65">
                Target: {{ registry.tools[toolId].targetSites }}
              </div>
            </div>

            <!-- Live Draggable Pill Preview -->
            <div v-if="registry.tools[toolId].status === 'active'" class="flex flex-col items-end gap-0.5">
              <a
                :href="getToolHref(toolId)"
                @mousedown="stampFreshHref($event, toolId)"
                @dragstart="stampFreshHref($event, toolId)"
                @click.prevent="notifyDrag(toolId)"
                class="btn btn-xs sm:btn-sm h-11 md:h-8 font-black shadow-xs cursor-grab active:cursor-grabbing gap-1.5"
                :class="toolId === 'ricochet_sync' ? 'btn-warning text-warning-content border border-warning-content/20' : 'btn-outline border-primary text-primary'"
                :title="'⬆️ Drag me to your Desktop Bookmarks Bar (Ctrl+Shift+B)!'"
              >
                <span>{{ getBarPreview(toolId) }}</span>
              </a>
              <span v-if="targetHost" class="text-[10px] font-mono font-bold text-base-content/60 whitespace-nowrap">
                🌐 Target Host: {{ targetHost }}
              </span>
            </div>
            <span
              v-else
              class="badge badge-sm badge-ghost border border-base-300 font-bold whitespace-nowrap shrink-0"
              title="Bookmarklet bar preview"
            >
              {{ getBarPreview(toolId) }}
            </span>
          </div>

          <p class="text-xs text-base-content/75 leading-relaxed">
            {{ registry.tools[toolId].summary }}
          </p>

          <!-- Install Actions (Desktop Drag + Device-Agnostic Mobile Shortcut & Progressive Disclosure) -->
          <div class="rounded-xl bg-base-100 border border-base-300 p-3.5 space-y-2.5">
            <div class="flex items-center justify-between gap-2 flex-wrap text-xs">
              <span class="font-extrabold text-base-content">📱 Mobile Browser Shortcut:</span>
              <code class="font-mono font-black text-primary bg-primary/10 px-2 py-0.5 rounded-lg">
                {{ getMobileBookmarkName(toolId) }}
              </code>
            </div>

            <!-- Default Visible Compact Trigger Guide -->
            <ul class="text-[11px] text-base-content/80 space-y-1.5 leading-snug list-disc pl-4">
              <li>
                <strong>Chrome / Brave / Edge (Android &amp; iOS):</strong> On target pages, tap the top address bar, type
                <kbd class="kbd kbd-xs font-mono">{{ getKeywordPreview(toolId) }}</kbd> <em>(do not press Enter)</em>, and tap the
                <strong>★ Starred suggestion</strong> in the dropdown.
                <span class="opacity-75">(Note: Tapping from the Chrome Bookmarks menu will not run scripts).</span>
              </li>
              <li>
                <strong>Safari (iPhone / iPad):</strong> Tap the saved bookmark directly from your <strong>Bookmarks menu</strong> on the target page.
              </li>
              <li>
                <strong>Firefox Mobile:</strong> Not supported (blocks <code>javascript:</code> bookmarklets).
              </li>
            </ul>

            <div v-if="registry.tools[toolId].status === 'active'" class="flex items-center gap-2 flex-wrap pt-0.5">
              <button
                type="button"
                class="btn btn-xs h-11 md:h-8 px-3 btn-outline font-bold gap-1.5 rounded-lg"
                @click="copyJsUrl(toolId)"
              >
                <span>📋 Copy Script URL</span>
              </button>
              <button
                type="button"
                class="btn btn-xs h-11 md:h-8 px-3 btn-ghost border border-base-300 font-bold gap-1.5 rounded-lg"
                @click="copyMobileTitle(toolId)"
              >
                <span>📱 Copy Mobile Name</span>
              </button>
            </div>

            <!-- Collapsible First-Time Phone Setup (Progressive Disclosure — Krug #3) -->
            <details class="group rounded-xl border border-base-300 bg-base-200/50 px-3 py-2 text-[11px]">
              <summary class="cursor-pointer font-extrabold text-base-content flex items-center justify-between gap-2 select-none min-h-11 md:min-h-9 list-none">
                <span>📲 First-time phone setup</span>
                <span class="text-xs opacity-60 group-open:rotate-180 transition-transform">▾</span>
              </summary>
              <ol class="mt-2 pt-2 border-t border-base-300/70 space-y-1.5 list-decimal pl-4 text-base-content/80 leading-relaxed">
                <li>
                  <strong>Authenticate:</strong> Tap <strong>{{ localSession ? 'Refresh 14-Day Token' : 'Activate 14-Day Token' }}</strong> at the top of this page on your phone.
                  <span class="opacity-80">On each target site's first run, tap <strong>⚡ Connect Works@TheHC</strong> once. Your saved sign-in on a site can expire after about a week of not visiting it—just tap Connect again.</span>
                </li>
                <li>
                  <strong>Install (Desktop Sync — Easiest):</strong> Drag the pill above to your desktop Bookmarks Bar, click <strong>Copy Mobile Name</strong>, and rename that desktop bookmark so it syncs to your phone automatically.
                </li>
                <li>
                  <strong>Install (Phone Only):</strong> Bookmark any page on your phone, tap <strong>Edit</strong>, paste <strong>Copy Mobile Name</strong> as the name and <strong>Copy Script URL</strong> as the URL <em>(keep the <code>javascript:</code> prefix intact)</em>.
                </li>
              </ol>
            </details>
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
                  class="btn btn-xs h-11 w-11 md:h-7 md:w-7 min-h-0 rounded-lg font-normal"
                  :class="registry.tools[toolId].icon === ic ? 'btn-secondary text-secondary-content' : 'btn-ghost border border-base-300'"
                  @click="markDirtyAndSetIcon(toolId, ic)"
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
                  class="btn btn-xs h-11 md:h-7 join-item font-bold"
                  :class="registry.tools[toolId].displayMode === m.id ? 'btn-secondary text-secondary-content' : 'btn-ghost border border-base-300'"
                  @click="markDirtyAndSetMode(toolId, m.id)"
                >
                  {{ m.label }}
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div class="flex flex-col gap-1">
                <label :for="`bml-bar-title-${toolId}`" class="text-[11px] font-bold text-base-content/75">
                  Bookmarks Bar Title
                </label>
                <input
                  :id="`bml-bar-title-${toolId}`"
                  v-model="registry.tools[toolId].barTitle"
                  type="text"
                  maxlength="32"
                  :disabled="!canEdit"
                  class="input input-bordered input-xs h-11 md:h-8 rounded-lg w-full bg-base-100 font-semibold"
                  @input="isDirty = true"
                />
              </div>

              <div class="flex flex-col gap-1">
                <label :for="`bml-compact-title-${toolId}`" class="text-[11px] font-bold text-base-content/75">
                  Compact Title &amp; Shortcut Keyword
                </label>
                <div class="flex items-center gap-1.5">
                  <input
                    :id="`bml-compact-title-${toolId}`"
                    v-model="registry.tools[toolId].compactTitle"
                    type="text"
                    maxlength="16"
                    :disabled="!canEdit"
                    placeholder="MD Sync"
                    class="input input-bordered input-xs h-11 md:h-8 rounded-lg flex-1 min-w-0 bg-base-100 font-semibold"
                    @input="isDirty = true"
                  />
                  <input
                    v-model="registry.tools[toolId].mobileKeyword"
                    type="text"
                    maxlength="8"
                    :disabled="!canEdit"
                    placeholder="md"
                    aria-label="Mobile address-bar shortcut keyword"
                    title="Short mobile address-bar shortcut keyword"
                    class="input input-bordered input-xs h-11 md:h-8 rounded-lg w-20 bg-base-100 font-mono font-bold lowercase text-center"
                    @input="isDirty = true"
                  />
                </div>
              </div>
            </div>

            <div class="flex flex-col gap-1">
              <label :for="`bml-hud-title-${toolId}`" class="text-[11px] font-bold text-base-content/75">
                In-Page HUD Header Title
              </label>
              <input
                :id="`bml-hud-title-${toolId}`"
                v-model="registry.tools[toolId].hudTitle"
                type="text"
                maxlength="56"
                :disabled="!canEdit"
                class="input input-bordered input-xs h-11 md:h-8 rounded-lg w-full bg-base-100 font-semibold"
                @input="isDirty = true"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Diagnostic Tester Card (🧪 BML Test) -->
    <div class="rounded-2xl border border-info/40 bg-info/10 p-4 sm:p-5 space-y-3">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="space-y-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="badge badge-xs badge-info text-info-content font-black uppercase tracking-wider whitespace-nowrap shrink-0">
              Diagnostic
            </span>
            <h4 class="font-black text-sm text-base-content">
              🧪 BML Test — Cross-Site Connection &amp; Page Inspector
            </h4>
          </div>
          <p class="text-xs text-base-content/75 leading-relaxed max-w-2xl">
            Drag <strong class="font-bold">🧪 BML Test</strong> to your Bookmarks Bar, click it on any auction page, and tap <strong class="font-bold">📋 Copy Report</strong> to share connection diagnostics.
          </p>
        </div>

        <div class="flex items-center gap-2 flex-wrap shrink-0">
          <a
            :href="bmlTestHref"
            @mousedown="stampFreshHref($event, 'bml_test')"
            @dragstart="stampFreshHref($event, 'bml_test')"
            @click.prevent="notifyTestDrag"
            class="btn btn-xs sm:btn-sm h-11 md:h-8 btn-info text-info-content font-black shadow-xs border border-info-content/20 cursor-grab active:cursor-grabbing gap-1.5"
            title="⬆️ Drag me to your Desktop Bookmarks Bar (Ctrl+Shift+B)!"
          >
            <span>🧪 BML Test</span>
          </a>
          <button
            type="button"
            class="btn btn-xs sm:btn-sm h-11 md:h-8 btn-outline font-bold gap-1"
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
          class="btn btn-2xs h-11 md:h-6 btn-outline font-mono font-bold gap-1 rounded-lg"
        >
          <span>1. inprogress-auctions ↗</span>
        </a>
        <a
          href="https://shopgoodwill.com/shopgoodwill/closed-auctions"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-2xs h-11 md:h-6 btn-outline font-mono font-bold gap-1 rounded-lg"
        >
          <span>2. closed-auctions ↗</span>
        </a>
        <a
          href="https://shopgoodwill.com/shopgoodwill/shipped-orders"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-2xs h-11 md:h-6 btn-outline font-mono font-bold gap-1 rounded-lg"
        >
          <span>3. shipped-orders ↗</span>
        </a>
      </div>
    </div>

    <!-- Save / Reset Action Footer -->
    <div class="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-base-200">
      <div class="text-xs text-base-content/70 flex items-center gap-2 flex-wrap">
        <span v-if="savedMsg" class="text-success font-bold">{{ savedMsg }}</span>
        <template v-else-if="errMsg">
          <span class="text-error font-bold">{{ errMsg }}</span>
          <button type="button" class="btn btn-xs h-11 md:h-7 btn-outline rounded-lg font-bold" @click="saveRegistry">
            Retry Save
          </button>
        </template>
        <span v-else>Changes update both draggable Bookmarks Bar pills and the live in-page HUD header immediately.</span>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="btn btn-xs sm:btn-sm h-11 md:h-9 btn-ghost border border-base-300 rounded-xl font-bold"
          :disabled="!canEdit || saving"
          @click="resetDefaults"
        >
          ↺ Reset Defaults
        </button>
        <button
          type="button"
          class="btn btn-xs sm:btn-sm h-11 md:h-9 rounded-xl gap-1.5"
          :class="
            localSession
              ? 'btn-primary text-primary-content font-black shadow-xs'
              : isDirty
                ? 'btn-secondary text-secondary-content font-black shadow-xs'
                : 'btn-outline btn-primary font-bold'
          "
          :disabled="!canEdit || saving"
          @click="saveRegistry"
        >
          <span v-if="saving" class="loading loading-spinner loading-xs"></span>
          <span>💾 Save Shortcut Labels</span>
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
import { toUserMessage } from '../../lib/userFacingErrors';
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
    headingTag?: 'h1' | 'h2' | 'h3';
  }>(),
  {
    canEdit: true,
    defaultLocationCode: 'MD',
    defaultLocationShortName: 'Memory Den',
    headingTag: 'h3',
  }
);

const { currentTeam, user } = useAuth();
const toolOrder: BookmarkletToolId[] = ['ricochet_sync', 'auction_scout', 'listing_assist'];
const displayModes: { id: BookmarkletDisplayMode; label: string }[] = [
  { id: 'full', label: 'Full' },
  { id: 'compact', label: 'Compact' },
  { id: 'icon_only', label: 'Icon' },
];

const registry = ref<BookmarkletRegistryConfig>(getCachedBmlRegistryConfig());
const saving = ref(false);
const minting = ref(false);
const isDirty = ref(false);
const savedMsg = ref('');
const errMsg = ref('');
const localSession = ref<{ name: string; prefix: string } | null>(null);
// SSR-hydration lock: MUST start empty on BOTH server and client so onMounted() produces a real reactive change.
const browserOrigin = ref<string>('');

const ricochetHref = computed(() =>
  buildRicochetBookmarkletHref(props.defaultLocationCode || 'MD', browserOrigin.value || undefined)
);
const auctionScoutHref = computed(() =>
  buildEvergreenBookmarkletHref('/scripts/auction-bookmarklet.js', browserOrigin.value || undefined)
);
const listingAssistHref = computed(() =>
  buildEvergreenBookmarkletHref('/scripts/listing-bookmarklet.js', browserOrigin.value || undefined)
);
const bmlTestHref = computed(() =>
  buildEvergreenBookmarkletHref('/scripts/bml-test.js', browserOrigin.value || undefined)
);

const targetHost = computed(() => {
  try {
    return browserOrigin.value ? new URL(browserOrigin.value).host : '';
  } catch {
    return browserOrigin.value;
  }
});

const getToolHref = (id: BookmarkletToolId) =>
  id === 'ricochet_sync'
    ? ricochetHref.value
    : id === 'listing_assist'
      ? listingAssistHref.value
      : auctionScoutHref.value;

/** Synchronously re-stamps the anchor with a fresh href built from the LIVE page origin right before a drag / click begins. */
const stampFreshHref = (event: Event, id: BookmarkletToolId | 'bml_test') => {
  if (typeof window === 'undefined' || !window.location?.origin) return;
  const anchor = event.currentTarget as HTMLAnchorElement | null;
  if (!anchor) return;
  const origin = window.location.origin;
  const fresh =
    id === 'ricochet_sync'
      ? buildRicochetBookmarkletHref(props.defaultLocationCode || 'MD', origin)
      : id === 'auction_scout'
        ? buildEvergreenBookmarkletHref('/scripts/auction-bookmarklet.js', origin)
        : id === 'listing_assist'
          ? buildEvergreenBookmarkletHref('/scripts/listing-bookmarklet.js', origin)
          : buildEvergreenBookmarkletHref('/scripts/bml-test.js', origin);
  if (anchor.getAttribute('href') !== fresh) anchor.setAttribute('href', fresh);
};

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
  (
    registry.value.tools[id].mobileKeyword ||
    (id === 'ricochet_sync' ? 'md' : id === 'listing_assist' ? 'rclist' : 'sgw')
  ).toLowerCase();

const markDirtyAndSetIcon = (id: BookmarkletToolId, icon: string) => {
  registry.value.tools[id].icon = icon;
  isDirty.value = true;
};

const markDirtyAndSetMode = (id: BookmarkletToolId, mode: BookmarkletDisplayMode) => {
  registry.value.tools[id].displayMode = mode;
  isDirty.value = true;
};

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
      throw new Error(data?.error || 'Could not activate 14-day bookmarklet pass.');
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
    addToast({ type: 'success', message: `✅ 14-day Bookmarklet Token active for ${memberInfo.name}!` });
  } catch (e: any) {
    errMsg.value = toUserMessage(e, "Couldn't activate your 14-day pass — please try again.");
  } finally {
    minting.value = false;
  }
};

const notifyDrag = (id: BookmarkletToolId) => {
  addToast({
    type: 'info',
    message: `Drag "${getBarPreview(id)}" up to your desktop Bookmarks Bar (Ctrl+Shift+B), then click it on your target tab!`,
  });
};

const copyJsUrl = async (id: BookmarkletToolId) => {
  try {
    await navigator.clipboard.writeText(getToolHref(id));
    addToast({ type: 'success', message: 'Copied Bookmarklet Script URL to clipboard!' });
  } catch {
    addToast({ type: 'error', message: 'Could not copy bookmarklet script URL.' });
  }
};

const notifyTestDrag = () => {
  addToast({
    type: 'info',
    message: 'Drag "🧪 BML Test" up to your desktop Bookmarks Bar (Ctrl+Shift+B), then click it on any auction tab!',
  });
};

const copyTestJsUrl = async () => {
  try {
    await navigator.clipboard.writeText(bmlTestHref.value);
    addToast({ type: 'success', message: 'Copied 🧪 BML Test Script URL to clipboard!' });
  } catch {
    addToast({ type: 'error', message: 'Could not copy tester script URL.' });
  }
};

const copyMobileTitle = async (id: BookmarkletToolId) => {
  try {
    const label = getMobileBookmarkName(id);
    await navigator.clipboard.writeText(label);
    addToast({ type: 'success', message: `Copied mobile shortcut name: "${label}"` });
  } catch {
    addToast({ type: 'error', message: 'Could not copy mobile shortcut name.' });
  }
};

const resetDefaults = () => {
  registry.value = normalizeBmlRegistryConfig(DEFAULT_BML_REGISTRY_CONFIG);
  isDirty.value = true;
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
    isDirty.value = false;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rc-bml-registry-updated', { detail: updated }));
    }
    savedMsg.value = '✅ Saved — shortcut labels updated across devices!';
    setTimeout(() => {
      savedMsg.value = '';
    }, 3500);
  } catch (e: any) {
    errMsg.value = toUserMessage(e, "Couldn't save shortcut settings — tap Retry Save.");
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
