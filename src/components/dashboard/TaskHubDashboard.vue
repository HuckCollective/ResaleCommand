<template>
  <div class="space-y-4 sm:space-y-5">
    <!-- 1-LINE PERSONAL PULSE STRIP (Replaces 15-KPI Multi-Grid Stack) -->
    <section
      class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3"
      aria-label="Personal and collective pulse"
    >
      <!-- Pill 1: My SKU Prefix -->
      <a
        :href="skuPillHref"
        class="rounded-2xl bg-base-100 border p-3.5 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between gap-1"
        :class="effectivePrefixStatus === 'locked' ? 'border-base-300 hover:border-primary/50' : 'border-warning/60 bg-warning/5'"
      >
        <div class="text-[11px] font-extrabold uppercase tracking-wider text-base-content/65">
          🏷️ My SKU Prefix
        </div>
        <div
          v-if="effectivePrefixStatus === 'locked' && effectivePrefix"
          class="text-base sm:text-lg font-black font-mono text-primary break-words"
        >
          🔒 {{ effectivePrefix }}
        </div>
        <div
          v-else-if="effectivePrefixStatus === 'requested' && effectiveRequestedPrefix"
          class="text-sm sm:text-base font-black font-mono text-warning break-words"
        >
          ⏳ {{ effectiveRequestedPrefix }}
        </div>
        <div v-else class="text-sm sm:text-base font-black text-warning break-words">
          ⚡ Pick Your SKU ➔
        </div>
        <div class="text-[11px] text-base-content/65 break-words">
          <template v-if="effectivePrefixStatus === 'locked'">
            {{ myActiveItems.length }} active item{{ myActiveItems.length === 1 ? '' : 's' }} in stock
          </template>
          <template v-else-if="effectivePrefixStatus === 'requested'">
            Awaiting Steward lock
          </template>
          <template v-else>
            Required before placing booth items
          </template>
        </div>
      </a>

      <!-- Pill 2: My Month Est. -->
      <a
        href="/coop/settlements"
        class="rounded-2xl bg-base-100 border border-base-300 p-3.5 shadow-2xs hover:border-primary/50 hover:shadow-sm transition-all flex flex-col justify-between gap-1"
      >
        <div class="text-[11px] font-extrabold uppercase tracking-wider text-base-content/65">
          💵 My Month Est.
        </div>
        <div class="text-base sm:text-lg font-black font-mono text-success break-words">
          {{ statement ? money(statement.payout) : '$0.00' }}
        </div>
        <div class="text-[11px] text-base-content/65 break-words">
          {{ statement ? `${money(statement.grossSales)} gross · Statement ➔` : 'Open payout statement ➔' }}
        </div>
      </a>

      <!-- Pill 3: My Hours This Month -->
      <a
        href="/coop/labor"
        class="rounded-2xl bg-base-100 border border-base-300 p-3.5 shadow-2xs hover:border-primary/50 hover:shadow-sm transition-all flex flex-col justify-between gap-1"
      >
        <div class="text-[11px] font-extrabold uppercase tracking-wider text-base-content/65">
          ⏱️ My Hours
        </div>
        <div class="text-base sm:text-lg font-black font-mono text-secondary break-words">
          {{ myHoursThisMonth.toFixed(1) }}h
        </div>
        <div class="text-[11px] text-base-content/65 break-words">
          Tasks &amp; sweat-equity log ➔
        </div>
      </a>

      <!-- Pill 4: Collective Health -->
      <a
        href="/coop"
        class="rounded-2xl bg-base-100 border border-base-300 p-3.5 shadow-2xs hover:border-primary/50 hover:shadow-sm transition-all flex flex-col justify-between gap-1"
      >
        <div class="text-[11px] font-extrabold uppercase tracking-wider text-base-content/65">
          🏛️ Collective Pulse
        </div>
        <div class="text-base sm:text-lg font-black font-mono text-base-content break-words">
          {{ money(globalProfit) }}
        </div>
        <div class="text-[11px] text-base-content/65 break-words">
          {{ totalActiveItemsCount }} active items · Open-book ledger ➔
        </div>
      </a>
    </section>

    <!-- 4 PLAIN-ENGLISH JOB TABS ("What are you trying to do right now?") -->
    <section ref="tabSectionRef" class="scroll-mt-20 card bg-base-100 border border-base-300/85 shadow-sm rounded-3xl p-3.5 sm:p-5 space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div class="text-xs font-extrabold uppercase tracking-wider text-base-content/60">
          What are you working on right now?
        </div>
        <div class="text-[11px] text-base-content/60">
          All Curators can pitch in across every tab
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Workspace tasks"
        class="grid grid-cols-2 lg:grid-cols-4 gap-2"
      >
        <button
          v-for="tab in jobTabs"
          :key="tab.id"
          type="button"
          role="tab"
          :aria-selected="activeTab === tab.id"
          class="btn btn-sm h-11 min-h-11 rounded-2xl font-black gap-1.5 justify-between px-3 transition-all"
          :class="activeTab === tab.id ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost bg-base-200/55 border border-base-300/70 text-base-content'"
          @click="selectTab(tab.id)"
        >
          <span class="flex items-center gap-1.5 text-left break-words">
            <span>{{ tab.icon }}</span>
            <span>{{ tab.label }}</span>
          </span>
          <span
            v-if="tab.badge > 0"
            class="badge badge-xs font-mono font-black whitespace-nowrap shrink-0"
            :class="activeTab === tab.id ? 'badge-neutral text-neutral-content' : 'badge-warning text-warning-content'"
          >
            {{ tab.badge }}
          </span>
        </button>
      </div>

      <!-- TAB 1: 📦 MY STUFF -->
      <div v-if="activeTab === 'stuff'" class="space-y-4 pt-1">
        <div class="flex flex-wrap gap-2">
          <a href="/scout" class="btn btn-sm h-11 md:h-9 btn-primary text-primary-content rounded-xl font-black gap-1.5 px-4">
            <Icon icon="solar:camera-bold-duotone" class="w-4 h-4 shrink-0" />
            <span>📸 Quick Scout</span>
          </a>
          <a href="/purchases" class="btn btn-sm h-11 md:h-9 btn-outline btn-primary rounded-xl font-bold gap-1.5 px-4">
            <Icon icon="solar:cart-plus-bold-duotone" class="w-4 h-4 shrink-0" />
            <span>📥 Log / Unbox Purchase</span>
          </a>
          <a href="/inventory" class="btn btn-sm h-11 md:h-9 btn-outline rounded-xl font-bold gap-1.5 px-4">
            <Icon icon="solar:box-bold-duotone" class="w-4 h-4 shrink-0" />
            <span>🏷️ My Inventory</span>
          </a>
        </div>

        <!-- SKU Setup Guard Banner when not yet locked -->
        <div
          v-if="effectivePrefixStatus !== 'locked'"
          class="rounded-2xl border-2 border-warning/45 bg-warning/10 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div class="space-y-0.5">
            <div class="text-sm font-black text-base-content">
              {{ effectivePrefixStatus === 'requested'
                ? `⏳ Requested prefix ${effectiveRequestedPrefix} is waiting on Founder lock`
                : '⚡ Claim & lock your unique Curator SKU prefix first' }}
            </div>
            <p class="text-xs text-base-content/75">
              You can scout and log purchases into Backstock now. Locking your personal barcode prefix unlocks booth placement and thermal sticker printing.
            </p>
          </div>
          <a href="/profile" class="btn btn-sm h-11 md:h-9 btn-warning text-warning-content rounded-xl font-black shrink-0">
            {{ effectivePrefixStatus === 'requested' ? 'View Request on Profile ➔' : 'Pick SKU Prefix ➔' }}
          </a>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <a
            href="/purchases"
            class="rounded-2xl border border-base-300 bg-base-200/35 p-3.5 hover:border-primary/45 transition-all space-y-1"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-black">🚚 Open Purchase Orders</span>
              <span class="badge badge-sm font-mono font-bold" :class="openPurchasesCount > 0 ? 'badge-warning text-warning-content' : 'badge-ghost'">
                {{ openPurchasesCount }}
              </span>
            </div>
            <p class="text-xs text-base-content/65">
              {{ openPurchasesCount > 0 ? 'Shipments & hauls awaiting check-in or receiving.' : 'All purchase orders received.' }}
            </p>
          </a>

          <a
            href="/inventory"
            class="rounded-2xl border border-base-300 bg-base-200/35 p-3.5 hover:border-primary/45 transition-all space-y-1"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-black">📦 Unplaced Backstock (My SKU)</span>
              <span class="badge badge-sm font-mono font-bold" :class="myUnplacedCount > 0 ? 'badge-info text-info-content' : 'badge-ghost'">
                {{ myUnplacedCount }}
              </span>
            </div>
            <p class="text-xs text-base-content/65">
              {{ myUnplacedCount > 0 ? 'Items priced & received in garage/hideout ready for a booth or online.' : 'No unplaced backstock under your SKU.' }}
            </p>
          </a>

          <a
            href="/coop/governance"
            class="rounded-2xl border border-base-300 bg-base-200/35 p-3.5 hover:border-primary/45 transition-all space-y-1"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-black">🗳️ Open Collective Votes</span>
              <span class="badge badge-sm font-mono font-bold" :class="openVotesCount > 0 ? 'badge-primary text-primary-content' : 'badge-ghost'">
                {{ openVotesCount }}
              </span>
            </div>
            <p class="text-xs text-base-content/65">
              {{ openVotesCount > 0 ? 'Active proposals waiting for member consent votes.' : 'All current proposals voted.' }}
            </p>
          </a>
        </div>

        <!-- Live Duplicate & Sold-Ghost Health Check Callout -->
        <a
          v-if="healthTotalFlaggedCount > 0"
          href="/inventory#health"
          class="rounded-2xl border-2 border-warning/45 bg-warning/10 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-warning transition-all"
        >
          <div class="space-y-0.5 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs sm:text-sm font-black text-base-content">
                🧹 Stock &amp; PO Health Check
              </span>
              <span class="badge badge-xs sm:badge-sm badge-warning text-warning-content font-mono font-black">
                {{ healthTotalFlaggedCount }} spotted
              </span>
            </div>
            <p class="text-xs text-base-content/80">
              {{ healthBreakdownSummary }} — review &amp; archive duplicates safely without deleting history.
            </p>
          </div>
          <span class="btn btn-sm h-11 md:h-9 btn-warning text-warning-content rounded-xl font-black shrink-0">
            Review &amp; Clean Up ➔
          </span>
        </a>
      </div>

      <!-- TAB 2: 🏪 BOOTHS & ONLINE -->
      <div v-else-if="activeTab === 'booths'" class="space-y-4 pt-1">
        <div class="flex flex-wrap gap-2">
          <a href="/warehouse/sync/MD" class="btn btn-sm h-11 md:h-9 btn-primary text-primary-content rounded-xl font-black gap-1.5 px-4">
            <span>🔄 Sync Memory Den (#0EJ)</span>
          </a>
          <a href="/warehouse/sync/DT" class="btn btn-sm h-11 md:h-9 btn-outline btn-primary rounded-xl font-bold gap-1.5 px-4">
            <span>🐯 Sync Dusty Tiger</span>
          </a>
          <a href="/inventory" class="btn btn-sm h-11 md:h-9 btn-outline rounded-xl font-bold gap-1.5 px-4">
            <span>🌐 Online Ready Bin</span>
          </a>
          <a href="/coop/labor" class="btn btn-sm h-11 md:h-9 btn-ghost border border-base-300 rounded-xl font-bold gap-1.5 px-4">
            <span>📋 Claim Booth Task</span>
          </a>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <a
            href="/warehouse/sync/MD"
            class="rounded-2xl border border-base-300 bg-base-200/35 p-3.5 hover:border-primary/45 transition-all space-y-1"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-black">🕒 Last Booth Sync</span>
              <span class="badge badge-xs font-bold" :class="lastSyncLabel === 'Sync overdue' ? 'badge-warning text-warning-content' : 'badge-success text-success-content'">
                {{ lastSyncLabel }}
              </span>
            </div>
            <p class="text-xs text-base-content/65">
              Run the booth bookmarklet or upload payouts to keep sales and shelf SKUs current.
            </p>
          </a>

          <a
            href="/inventory"
            class="rounded-2xl border border-base-300 bg-base-200/35 p-3.5 hover:border-primary/45 transition-all space-y-1"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-black">🌐 Online Ready Co-Curation</span>
              <span class="badge badge-sm badge-info text-info-content font-mono font-bold">{{ onlineReadyCount }}</span>
            </div>
            <p class="text-xs text-base-content/65">
              Items staged for collective online listing &amp; shared co-curation splits.
            </p>
          </a>

          <a
            href="/sales"
            class="rounded-2xl border border-base-300 bg-base-200/35 p-3.5 hover:border-primary/45 transition-all space-y-1"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-black">🎟️ Unlinked Register Sales</span>
              <span class="badge badge-sm font-mono font-bold" :class="unlinkedSalesCount > 0 ? 'badge-warning text-warning-content' : 'badge-ghost'">
                {{ unlinkedSalesCount }}
              </span>
            </div>
            <p class="text-xs text-base-content/65">
              {{ unlinkedSalesCount > 0 ? 'Tickets waiting to be matched to a Curator SKU.' : 'Every synced register ticket is linked!' }}
            </p>
          </a>
        </div>
      </div>

      <!-- TAB 3: 📣 PROMOTE & DROPS -->
      <div v-else-if="activeTab === 'promote'" class="space-y-4 pt-1">
        <div class="flex flex-wrap gap-2">
          <a href="/social" class="btn btn-sm h-11 md:h-9 btn-primary text-primary-content rounded-xl font-black gap-1.5 px-4">
            <span>📣 Open Dropcast Studio</span>
          </a>
          <a href="/coop/labor" class="btn btn-sm h-11 md:h-9 btn-outline btn-primary rounded-xl font-bold gap-1.5 px-4">
            <span>⏱️ Log Promo / Reel Task</span>
          </a>
        </div>

        <div class="rounded-2xl border border-base-300 bg-base-200/30 p-3.5 sm:p-4 space-y-2.5">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="text-xs font-black text-base-content">
              ✨ Top Placed Booth Heroes Ready to Feature ({{ heroPlacedItems.length }})
            </div>
            <span v-if="unannouncedDropsCount > 0" class="badge badge-warning badge-xs font-bold">
              {{ unannouncedDropsCount }} unannounced drop{{ unannouncedDropsCount === 1 ? '' : 's' }}
            </span>
          </div>

          <div v-if="heroPlacedItems.length === 0" class="text-xs text-base-content/65">
            Place priced items into Memory Den or Dusty Tiger to surface fresh booth heroes here.
          </div>
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <a
              v-for="item in heroPlacedItems"
              :key="item.$id"
              :href="item.$id ? `/item/${item.$id}` : '/inventory'"
              class="rounded-xl bg-base-100 border border-base-300 px-3 py-2 flex items-center justify-between gap-2 hover:border-primary/50 transition-all text-xs"
            >
              <span class="font-bold text-base-content break-words">
                {{ cleanLabel(item.title || item.upc || 'Booth Item') }}
              </span>
              <span class="badge badge-primary badge-xs font-mono font-black shrink-0">
                ${{ Number(itemPrice(item)).toFixed(0) }}
              </span>
            </a>
          </div>
        </div>
      </div>

      <!-- TAB 4: 🛠️ BUILD & APPROVALS (OR 🤝 TASKS & IDEAS FOR NON-FOUNDERS) -->
      <div v-else class="space-y-4 pt-1">
        <!-- Founder 1-Stop Approval Inbox -->
        <div
          v-if="isFounderAdmin"
          class="rounded-2xl border-2 border-primary/35 bg-primary/5 p-3.5 sm:p-4 space-y-3"
        >
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="text-sm font-black text-base-content">
              👑 Founder 1-Stop Approval Inbox
            </div>
            <span class="badge badge-primary badge-sm font-mono font-black">
              {{ totalApprovalCount }} waiting
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <a
              href="/coop/governance#roster"
              class="rounded-xl bg-base-100 border border-base-300 px-3 py-2.5 flex items-center justify-between gap-2 hover:border-primary/50"
            >
              <div class="space-y-0.5">
                <div class="font-bold">🏷️ SKU Prefix Lock Requests</div>
                <div v-if="snapshot.pendingPrefixRequests.length > 0" class="text-[11px] font-mono text-warning font-bold">
                  {{ snapshot.pendingPrefixRequests.map((r) => `${r.name}: ${r.requestedPrefix}`).join(' · ') }}
                </div>
              </div>
              <span class="badge badge-sm font-mono font-bold" :class="snapshot.pendingPrefixRequests.length > 0 ? 'badge-warning text-warning-content' : 'badge-ghost'">
                {{ snapshot.pendingPrefixRequests.length }}
              </span>
            </a>

            <a
              href="/expenses"
              class="rounded-xl bg-base-100 border border-base-300 px-3 py-2.5 flex items-center justify-between gap-2 hover:border-primary/50"
            >
              <span class="font-bold">🧾 Pending Shared Expenses</span>
              <span class="badge badge-sm font-mono font-bold" :class="snapshot.pendingSharedExpenses > 0 ? 'badge-warning text-warning-content' : 'badge-ghost'">
                {{ snapshot.pendingSharedExpenses }}
              </span>
            </a>

            <a
              href="/coop/labor"
              class="rounded-xl bg-base-100 border border-base-300 px-3 py-2.5 flex items-center justify-between gap-2 hover:border-primary/50"
            >
              <span class="font-bold">⏱️ Pending Labor Sign-Offs</span>
              <span class="badge badge-sm font-mono font-bold" :class="snapshot.pendingLaborCount > 0 ? 'badge-warning text-warning-content' : 'badge-ghost'">
                {{ snapshot.pendingLaborCount }}
              </span>
            </a>

            <button
              type="button"
              class="rounded-xl bg-base-100 border border-base-300 px-3 py-2.5 flex items-center justify-between gap-2 hover:border-primary/50 text-left"
              @click="$emit('open-join-queue')"
            >
              <span class="font-bold">📬 Verified Join Requests</span>
              <span class="badge badge-sm font-mono font-bold" :class="snapshot.joinRequests > 0 ? 'badge-warning text-warning-content' : 'badge-ghost'">
                {{ snapshot.joinRequests }}
              </span>
            </button>

            <button
              type="button"
              class="rounded-xl bg-base-100 border border-base-300 px-3 py-2.5 flex items-center justify-between gap-2 hover:border-primary/50 text-left sm:col-span-2"
              @click="$emit('open-messages')"
            >
              <span class="font-bold">💬 Member Messages &amp; Bug Reports</span>
              <span class="badge badge-sm font-mono font-bold" :class="snapshot.coopMessages > 0 ? 'badge-info text-info-content' : 'badge-ghost'">
                {{ snapshot.coopMessages }}
              </span>
            </button>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <a href="/coop/labor" class="btn btn-sm h-11 md:h-9 btn-outline btn-primary rounded-xl font-bold gap-1.5 px-4">
            <span>📋 Open Co-op Task Board</span>
          </a>
          <a href="/coop/governance" class="btn btn-sm h-11 md:h-9 btn-outline rounded-xl font-bold gap-1.5 px-4">
            <span>🗳️ Governance &amp; Roster</span>
          </a>
          <button
            type="button"
            class="btn btn-sm h-11 md:h-9 btn-ghost border border-base-300 rounded-xl font-bold gap-1.5 px-4"
            @click="$emit('open-messages')"
          >
            <span>💬 Messages &amp; Ideas</span>
          </button>
          <a v-if="isFounderOrBuilder" href="/coop/cms" class="btn btn-sm h-11 md:h-9 btn-ghost border border-base-300 rounded-xl font-bold gap-1.5 px-4">
            <span>📝 Website CMS</span>
          </a>
          <a v-if="isFounderOrBuilder" href="/coop/vault" class="btn btn-sm h-11 md:h-9 btn-ghost border border-base-300 rounded-xl font-bold gap-1.5 px-4">
            <span>🧠 Dev AI Vault</span>
          </a>
          <a v-if="isFounderAdmin" href="/settings" class="btn btn-sm h-11 md:h-9 btn-ghost border border-base-300 rounded-xl font-bold gap-1.5 px-4">
            <span>⚙️ Collective Settings</span>
          </a>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import { useUrlTab } from '../../composables/useUrlTab';
import { useDashboardSource } from '../../composables/dashboard/useDashboardSource';
import { useDashboardMetrics } from '../../composables/dashboard/useDashboardMetrics';
import { isActiveInventory, itemsOwnedBy, parseItemValue } from '../../lib/dashboardAlerts';
import { normalizeInventoryStatus } from '../../lib/inventoryStatus';
import { auditInventoryAndPurchaseHealth } from '../../lib/inventoryHealthAudit';

defineEmits<{
  (e: 'open-join-queue'): void;
  (e: 'open-messages'): void;
}>();

type TaskTabId = 'stuff' | 'booths' | 'promote' | 'steward';
const TAB_STORAGE_KEY = 'rc_task_hub_tab_v1';

const source = useDashboardSource();
const { globalProfit } = useDashboardMetrics();

const {
  activeTab,
  setTab: selectTab,
  tabSectionRef,
} = useUrlTab<TaskTabId>({
  tabs: ['stuff', 'booths', 'promote', 'steward'],
  defaultTab: 'stuff',
  legacyQueryParams: ['tab'],
  aliases: { build: 'steward', approvals: 'steward', tasks: 'steward' },
  fallbackStorageKey: TAB_STORAGE_KEY,
});

const snapshot = computed(() => source.snapshot.value);
const member = computed(() => source.member.value);
const statement = computed(() => snapshot.value.statement);

const isFounderAdmin = computed(
  () => source.isAdmin.value || member.value.hats.includes('founder')
);
const isFounderOrBuilder = computed(
  () => isFounderAdmin.value || member.value.hats.includes('builder')
);

const effectivePrefix = computed(() =>
  String(member.value.inventoryPrefix || '').trim().toUpperCase()
);
const effectiveRequestedPrefix = computed(() =>
  String(member.value.requestedPrefix || '').trim().toUpperCase()
);
const effectivePrefixStatus = computed<'unset' | 'requested' | 'locked'>(() => {
  if (member.value.prefixStatus) return member.value.prefixStatus;
  if (effectivePrefix.value) return 'locked';
  if (effectiveRequestedPrefix.value) return 'requested';
  return 'unset';
});

const skuPillHref = computed(() =>
  effectivePrefixStatus.value === 'locked' ? '/inventory' : '/profile'
);

const myOwnedItems = computed(() => {
  const prefixes = Array.from(
    new Set(
      [effectivePrefix.value, ...(member.value.historicalPrefixes || [])]
        .map((p) => String(p || '').trim().toUpperCase())
        .filter(Boolean)
    )
  );
  if (prefixes.length === 0) return itemsOwnedBy(snapshot.value.items, member.value);
  return snapshot.value.items.filter((i: any) => {
    const upc = String(i?.upc || '').trim().toUpperCase();
    return prefixes.some((px) => upc.startsWith(px));
  });
});

const myActiveItems = computed(() => myOwnedItems.value.filter(isActiveInventory));
const myUnplacedCount = computed(
  () =>
    myActiveItems.value.filter((i: any) => {
      const norm = normalizeInventoryStatus(i?.status);
      return norm === 'received' || norm === 'acquired';
    }).length
);

const totalActiveItemsCount = computed(
  () => snapshot.value.items.filter(isActiveInventory).length
);

const myHoursThisMonth = computed(() => {
  const cleanName = member.value.name.replace(/\(.*?\)/g, '').trim().toLowerCase();
  return snapshot.value.laborEntries
    .filter((e: any) => {
      const mName = String(e?.member || '').replace(/\(.*?\)/g, '').trim().toLowerCase();
      return cleanName && (mName === cleanName || mName.includes(cleanName));
    })
    .reduce((sum: number, e: any) => sum + (Number(e?.hours) || 0), 0);
});

const dashboardSalesForAudit = computed(() =>
  snapshot.value.sales.map((s) => ({
    $id: s.id,
    orderId: s.title ? `Ticket • ${s.title}` : '',
    saleDate: s.soldAt,
    grossAmount: s.amount,
  }))
);

const dashboardCapabilities = computed(() => {
  const prefixes = Array.from(
    new Set(
      [effectivePrefix.value, ...(member.value.historicalPrefixes || [])]
        .map((p) => String(p || '').trim().toUpperCase())
        .filter(Boolean)
    )
  );
  const isConsignor =
    member.value.hats.includes('consignor') &&
    !isFounderAdmin.value &&
    !member.value.hats.includes('curator');
  return {
    role: isFounderAdmin.value ? ('founder' as const) : ('curator' as const),
    prefix: effectivePrefix.value,
    prefixStatus: effectivePrefixStatus.value,
    ownedPrefixes: prefixes,
    isConsignor,
  };
});

const healthReport = computed(() =>
  auditInventoryAndPurchaseHealth({
    items: snapshot.value.items,
    purchases: snapshot.value.purchases,
    sales: dashboardSalesForAudit.value,
    capabilities: dashboardCapabilities.value,
    userId: null,
    scope: dashboardCapabilities.value.isConsignor ? 'all' : 'mine',
  })
);

const openPurchasesCount = computed(() => healthReport.value.actionableOpenPurchasesCount);

const healthTotalFlaggedCount = computed(
  () => healthReport.value.totalHighConfidenceCount + healthReport.value.totalReviewCount
);

const healthBreakdownSummary = computed(() => {
  const r = healthReport.value;
  const parts: string[] = [];
  if (r.unclosedSplitLots.length > 0) {
    parts.push(`${r.unclosedSplitLots.length} already-split parent lot${r.unclosedSplitLots.length === 1 ? '' : 's'}`);
  }
  if (r.soldTwinGhosts.length > 0) {
    parts.push(`${r.soldTwinGhosts.length} sold/split backstock twin${r.soldTwinGhosts.length === 1 ? '' : 's'}`);
  }
  if (r.activeDuplicateClusters.length > 0) {
    parts.push(`${r.extraActiveClonesCount} extra duplicate cop${r.extraActiveClonesCount === 1 ? 'y' : 'ies'}`);
  }
  if (r.barcodeCollisions.length > 0) {
    parts.push(`${r.barcodeCollisions.length} barcode clash${r.barcodeCollisions.length === 1 ? '' : 'es'}`);
  }
  if (r.staleOpenPurchases.length > 0) {
    parts.push(`${r.staleOpenPurchases.length} ready-to-close PO${r.staleOpenPurchases.length === 1 ? '' : 's'}`);
  }
  return parts.join(' · ');
});
const openVotesCount = computed(
  () => snapshot.value.proposals.filter((p) => p.status === 'active').length
);

const lastSyncLabel = computed(() => {
  const iso = snapshot.value.lastSyncAt;
  if (!iso) return 'Not synced yet';
  const days = Math.floor((snapshot.value.now - Date.parse(iso)) / 86_400_000);
  if (isNaN(days) || days > 14) return 'Sync overdue';
  return days === 0 ? 'Synced today' : `${days}d ago`;
});

const onlineReadyCount = computed(
  () =>
    snapshot.value.items.filter((i: any) => {
      const locs = Array.isArray(i?.sellingLocations) ? i.sellingLocations : [i?.sellingLocations];
      return locs.some((v: any) => String(v || '').toUpperCase() === 'ONLINE_READY_BIN');
    }).length
);

const unlinkedSalesCount = computed(
  () => snapshot.value.sales.filter((s) => !s.matched).length
);

const unannouncedDropsCount = computed(
  () => snapshot.value.drops.filter((d) => d.status === 'ready').length
);

const itemPrice = (i: any) =>
  parseItemValue(i, 'resalePrice', 'Resale') ||
  parseItemValue(i, 'estValue', 'Est. Low') ||
  parseItemValue(i, 'listPrice', 'Est') ||
  0;

const cleanLabel = (raw: unknown) => String(raw || '').replace(/\\\$/g, '$').trim();

const heroPlacedItems = computed(() =>
  snapshot.value.items
    .filter((i: any) => i.status === 'placed' && itemPrice(i) > 0)
    .slice()
    .sort((a: any, b: any) => itemPrice(b) - itemPrice(a))
    .slice(0, 4)
);

const totalApprovalCount = computed(() => {
  const snap = snapshot.value;
  return (
    snap.pendingPrefixRequests.length +
    snap.pendingSharedExpenses +
    snap.pendingLaborCount +
    snap.joinRequests +
    snap.coopMessages
  );
});

const myStuffActionCount = computed(
  () => (effectivePrefixStatus.value !== 'locked' ? 1 : 0) + openPurchasesCount.value
);

const jobTabs = computed(() => [
  { id: 'stuff' as const, icon: '📦', label: 'My Stuff', badge: myStuffActionCount.value },
  { id: 'booths' as const, icon: '🏪', label: 'Booths & Online', badge: unlinkedSalesCount.value },
  { id: 'promote' as const, icon: '📣', label: 'Promote & Drops', badge: unannouncedDropsCount.value },
  {
    id: 'steward' as const,
    icon: isFounderOrBuilder.value ? '🛠️' : '🤝',
    label: isFounderOrBuilder.value ? 'Build & Approvals' : 'Tasks & Ideas',
    badge: isFounderAdmin.value ? totalApprovalCount.value : snapshot.value.coopMessages,
  },
]);

const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;
</script>
