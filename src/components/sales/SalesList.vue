<template>
  <CollectiveAccessGate>
  <div v-if="!canAccessSalesSurface" class="max-w-xl mx-auto my-12">
    <div class="card bg-base-100 border-2 border-warning/40 shadow-lg rounded-2xl p-6 text-center space-y-4">
      <div class="text-4xl">🔒</div>
      <h2 class="text-xl font-black text-base-content">Founders &amp; Curators Only</h2>
      <p class="text-sm text-base-content/75 leading-relaxed">
        The raw Register Ticket Ledger is restricted to Founders (👑) and Curators (💎). Open <strong>Monthly Settlements</strong> to inspect the 4-Gate Co-op Waterfall, Commons rent breakeven, and Sweat-Equity payouts.
      </p>
      <div class="pt-2 flex flex-wrap justify-center gap-3">
        <a href="/coop/settlements" class="btn btn-primary font-bold rounded-xl">Open Monthly Settlements</a>
        <a href="/dashboard" class="btn btn-outline font-bold rounded-xl">Command Dashboard</a>
      </div>
    </div>
  </div>
  <div v-else class="space-y-6">
    <!-- Header: Clean Title + 2 Mistake-Proof Actions -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h1 class="text-3xl sm:text-4xl font-black text-base-content tracking-tight flex items-center gap-3">
          <Icon icon="solar:dollar-bold-duotone" class="w-8 h-8 sm:w-9 h-9 text-success shrink-0" />
          <span>{{ isSettlementRoute ? 'Monthly Settlements' : 'Sales & Partner Settlements' }}</span>
        </h1>
        <p class="text-sm text-base-content/70 mt-1">
          {{
            isSettlementRoute
              ? '4-Gate co-op waterfall, Commons rent breakeven, and monthly partner statements.'
              : 'One unified workspace for register sales, paper sheets, and 70/30 co-op payout checks.'
          }}
        </p>
      </div>
      <div v-if="capabilities.canViewSales" class="flex items-center gap-2.5 w-full md:w-auto">
        <!-- 1. Unified Sync / Import Menu -->
        <div class="dropdown dropdown-end flex-1 sm:flex-initial">
          <label tabindex="0" class="btn btn-sm sm:btn-md btn-outline btn-secondary gap-1.5 font-bold w-full min-h-[40px] rounded-xl cursor-pointer">
            <Icon icon="solar:import-bold-duotone" class="w-4 h-4 shrink-0" />
            <span>Import / Sync</span>
            <Icon icon="solar:alt-arrow-down-linear" class="w-3.5 h-3.5 opacity-70" />
          </label>
          <ul tabindex="0" class="dropdown-content menu p-2 shadow-xl bg-base-100 border border-base-300 rounded-2xl w-68 z-50 text-xs font-bold space-y-1 mt-1.5">
            <li>
              <a :href="`/sales/import/${activeRicochetVenueMeta.code}`" class="rounded-xl py-2.5 gap-2.5">
                <Icon icon="solar:file-check-bold-duotone" class="w-4 h-4 text-primary shrink-0" />
                <div>
                  <div class="font-black text-base-content">Import Payout CSV / Live Sync</div>
                  <div class="text-[10px] font-normal opacity-65">Reconcile {{ activeRicochetVenueMeta.shortName }} checks &amp; live POS</div>
                </div>
              </a>
            </li>
            <li>
              <a :href="`/warehouse/sync/${activeRicochetVenueMeta.code}`" class="rounded-xl py-2.5 gap-2.5">
                <Icon icon="solar:round-transfer-horizontal-bold-duotone" class="w-4 h-4 text-secondary shrink-0" />
                <div>
                  <div class="font-black text-base-content">Booth Catalog &amp; Barcode Sync</div>
                  <div class="text-[10px] font-normal opacity-65">Verify booth SKUs &amp; HUCK- tags</div>
                </div>
              </a>
            </li>
            <li class="border-t border-base-200 pt-1">
              <button type="button" @click="exportSalesCsv" class="rounded-xl py-2 gap-2.5">
                <Icon icon="solar:file-download-bold" class="w-4 h-4 text-success shrink-0" />
                <span>Export Filtered Ledger (CSV)</span>
              </button>
            </li>
          </ul>
        </div>

        <!-- 2. Hero Primary Action: Opens Shopping Cart Record Sale Tray -->
        <button
          type="button"
          @click="isRecordDrawerOpen = true"
          class="btn btn-sm sm:btn-md btn-primary gap-1.5 shadow-md shadow-primary/20 font-black flex-1 sm:flex-initial min-h-[40px] rounded-xl"
        >
          <Icon icon="solar:cart-plus-bold" class="w-4 h-4 shrink-0" />
          <span>Record Sale</span>
        </button>
      </div>
    </div>

    <!-- Skeleton Loader -->
    <div v-if="loading && consolidatedSales.length === 0" class="space-y-4 py-4">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div v-for="n in 4" :key="n" class="skeleton h-20 rounded-2xl"></div>
      </div>
      <div class="space-y-2.5">
        <div v-for="n in 4" :key="n" class="skeleton h-16 w-full rounded-2xl"></div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="alert alert-error shadow-sm">
      <Icon icon="solar:danger-circle-bold" class="w-6 h-6 shrink-0" />
      <span>{{ error }}</span>
      <button class="btn btn-xs ml-auto" @click="fetchData">Retry</button>
    </div>

    <!-- Main Content when loaded -->
    <div v-else class="space-y-5">
      <!-- Post-Commit / Sync Feedback Toast Banner -->
      <div
        v-if="stagedSyncStatusToast"
        class="alert shadow-sm rounded-2xl border"
        :class="{
          'alert-success border-success/40': stagedSyncStatusToast.type === 'success',
          'alert-warning border-warning/40': stagedSyncStatusToast.type === 'warning',
          'alert-error border-error/40': stagedSyncStatusToast.type === 'error',
          'alert-info border-info/40': stagedSyncStatusToast.type === 'info',
        }"
      >
        <span class="text-xs sm:text-sm font-bold">{{ stagedSyncStatusToast.message }}</span>
        <button type="button" class="btn btn-xs btn-ghost ml-auto" @click="stagedSyncStatusToast = null">✕</button>
      </div>

      <!-- STAGED RICOCHET SALES COMMIT BANNER (Law 5.3 Dry-Run Preview + 1-Click Idempotent Ledger Commit) -->
      <div
        v-if="capabilities.canViewSales && hasLoadedLiveSalesLedger && ricochetActionableNewCount > 0"
        class="card bg-warning/10 border-2 border-warning/50 shadow-md rounded-2xl p-4 space-y-3"
      >
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div class="space-y-1.5">
            <div class="flex flex-wrap items-center gap-2">
              <span class="badge badge-warning font-black text-xs py-2.5 px-2.5">
                ⚡ {{ ricochetActionableNewCount }} New Staged {{ ricochetActionableNewCount === 1 ? 'Sale' : 'Sales' }}
              </span>
              <span class="text-sm sm:text-base font-black text-base-content">
                {{ activeRicochetVenueMeta.shortName }} POS — ${{ ricochetNewBreakdown.gross.toFixed(2) }} gross / ${{ ricochetNewBreakdown.net.toFixed(2) }} net waiting to commit
              </span>
            </div>

            <!-- Partner Attribution + Match + Month Breakdown Pills -->
            <div class="flex flex-wrap items-center gap-1.5 text-xs font-bold">
              <span v-if="ricochetNewBreakdown.byPartner.HUCK.count > 0" class="badge badge-neutral badge-sm sm:badge-md font-bold gap-1">
                🫐 HUCK {{ ricochetNewBreakdown.byPartner.HUCK.count }} (${{ ricochetNewBreakdown.byPartner.HUCK.gross.toFixed(2) }})
              </span>
              <span v-if="ricochetNewBreakdown.byPartner.PDXGL.count > 0" class="badge badge-secondary badge-sm sm:badge-md font-bold gap-1">
                🎲 PDXGL {{ ricochetNewBreakdown.byPartner.PDXGL.count }} (${{ ricochetNewBreakdown.byPartner.PDXGL.gross.toFixed(2) }})
              </span>
              <span v-if="ricochetNewBreakdown.byPartner.BB.count > 0" class="badge badge-accent badge-sm sm:badge-md font-bold gap-1">
                👗 B&amp;B {{ ricochetNewBreakdown.byPartner.BB.count }} (${{ ricochetNewBreakdown.byPartner.BB.gross.toFixed(2) }})
              </span>
              <span class="badge badge-outline badge-success badge-sm sm:badge-md font-bold">
                🔗 {{ ricochetNewBreakdown.matchedCount }} Matched
              </span>
              <span v-if="ricochetNewBreakdown.unmatchedCount > 0" class="badge badge-outline badge-warning badge-sm sm:badge-md font-bold">
                ⚠️ {{ ricochetNewBreakdown.unmatchedCount }} Unmatched (still recorded)
              </span>
              <span
                v-for="mKey in ricochetNewBreakdown.monthKeys"
                :key="mKey"
                class="badge badge-ghost badge-sm sm:badge-md font-mono font-bold"
              >
                📅 {{ mKey === 'unknown' ? 'Unknown Month' : monthKeyToLabel(mKey) }}: {{ ricochetNewBreakdown.byMonth[mKey].count }} (${{ ricochetNewBreakdown.byMonth[mKey].net.toFixed(2) }} net)
              </span>
            </div>
          </div>

          <!-- Primary Review & Confirm + Reconciler + Refresh Actions (Zero native JS confirm/alert popups) -->
          <div class="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              class="btn btn-sm sm:btn-md btn-success font-black rounded-xl shadow-sm gap-1.5"
              :disabled="isCommittingRicochetSync"
              @click="openRicochetConfirmDrawer"
            >
              <span v-if="isCommittingRicochetSync" class="loading loading-spinner loading-xs"></span>
              <span v-if="isCommittingRicochetSync && ricochetCommitProgress">
                Writing {{ ricochetCommitProgress.done }} / {{ ricochetCommitProgress.total }}...
              </span>
              <span v-else>
                ✅ Review &amp; Confirm {{ ricochetActionableNewCount }} New {{ ricochetActionableNewCount === 1 ? 'Sale' : 'Sales' }} (${{ ricochetNewBreakdown.net.toFixed(2) }} net)
              </span>
            </button>
            <a
              :href="`/sales/import/${activeRicochetVenueMeta.code}`"
              class="btn btn-sm sm:btn-md btn-outline font-bold rounded-xl"
            >
              🔍 Reconciler
            </a>
            <button
              type="button"
              class="btn btn-sm sm:btn-md btn-ghost font-bold rounded-xl"
              :disabled="isLoadingRicochetSync || isCommittingRicochetSync"
              title="Re-check staged sales manifest"
              @click="fetchStagedRicochetSales(true)"
            >
              <span v-if="isLoadingRicochetSync" class="loading loading-spinner loading-xs"></span>
              <span v-else>🔄</span>
            </button>
          </div>
        </div>

        <!-- Collapsible Dry-Run Preview of Exact New Ticket Lines -->
        <details class="bg-base-100/90 border border-base-300 rounded-xl px-3 py-2 text-xs">
          <summary class="cursor-pointer font-extrabold text-base-content/85 select-none">
            📋 Preview {{ ricochetActionableNewCount }} New Ticket {{ ricochetActionableNewCount === 1 ? 'Line' : 'Lines' }} Before Writing to Ledger
          </summary>
          <div class="mt-2 max-h-56 overflow-y-auto divide-y divide-base-200">
            <div
              v-for="(row, rIdx) in ricochetActionableNewRows"
              :key="`${row.payoutId || row.saleNumber}-${row.sku}-${rIdx}`"
              class="py-1.5 flex flex-wrap items-center justify-between gap-2"
            >
              <div class="flex flex-wrap items-center gap-1.5 min-w-0">
                <span class="font-mono font-black text-primary">#{{ String(row.payoutId || row.saleNumber || '').replace(/^#/, '') }}</span>
                <span class="font-mono text-base-content/70">{{ row.soldDate }}</span>
                <span class="badge badge-xs font-bold" :class="row.partnerBucket === 'PDXGL' ? 'badge-secondary' : row.partnerBucket === 'BB' ? 'badge-accent' : 'badge-neutral'">
                  {{ row.partnerBucket || 'HUCK' }}
                </span>
                <span v-if="row.sku" class="font-mono font-bold text-warning">{{ row.sku }}</span>
                <span v-if="row.matchedItemUpc || row.upc" class="font-mono text-info font-bold">{{ row.matchedItemUpc || row.upc }}</span>
                <span class="font-semibold truncate max-w-md">{{ row.matchedItemTitle || row.title }}</span>
              </div>
              <div class="font-mono font-bold shrink-0">
                ${{ Number(row.grossPrice || 0).toFixed(2) }} <span class="opacity-60">→</span> <span class="text-success">${{ Number(row.ricoNetPayout ?? row.expectedNetPayout ?? 0).toFixed(2) }} net</span>
              </div>
            </div>
          </div>
        </details>
      </div>

      <!-- UNIFIED GLOBAL SCOPE BAR (CONTROLS BOTH TABS IN LOCKSTEP — ZERO SPLIT-BRAIN) -->
      <div class="card bg-base-100/95 shadow-sm border border-base-200 rounded-2xl p-3 space-y-3">
        <!-- Top Row: View Switcher + Month + Venue Pills -->
        <div class="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
          <!-- View Switcher -->
          <div class="join bg-base-200/90 p-1 rounded-xl shadow-inner w-full lg:w-auto">
            <button
              v-if="capabilities.canViewSales"
              type="button"
              class="btn btn-sm join-item gap-2 flex-1 lg:flex-initial rounded-lg text-xs font-bold transition-all"
              :class="salesViewTab === 'ledger' ? 'btn-primary shadow-xs font-black' : 'btn-ghost opacity-75'"
              @click="salesViewTab = 'ledger'"
            >
              <Icon icon="solar:list-check-bold" class="w-4 h-4" />
              <span>Sales Ledger ({{ scopedSales.length }})</span>
            </button>
            <button
              type="button"
              class="btn btn-sm join-item gap-2 flex-1 lg:flex-initial rounded-lg text-xs font-bold transition-all"
              :class="salesViewTab === 'coop' ? 'btn-primary shadow-xs font-black' : 'btn-ghost opacity-75'"
              @click="salesViewTab = 'coop'"
            >
              <Icon icon="solar:hand-money-bold-duotone" class="w-4 h-4 text-warning" />
              <span>Partner Payouts &amp; 70/30</span>
            </button>
          </div>

          <!-- Month + Venue Scope Controls -->
          <div class="flex flex-wrap items-center gap-2">
            <!-- Month Filter -->
            <select
              v-model="monthFilter"
              class="select select-bordered text-xs font-bold h-9 min-h-9 rounded-xl bg-base-200/50 hover:bg-base-200/70 focus:bg-base-100 border-base-300 focus:border-primary pr-8"
              title="Filter both Sales Ledger and Partner Payouts by month"
            >
              <option v-for="m in monthOptions" :key="m.key" :value="m.key">{{ m.label }} ({{ m.count }})</option>
              <option value="all">All-Time ({{ consolidatedSales.length }})</option>
            </select>

            <!-- Venue Filter Pills -->
            <div class="join bg-base-200/70 p-0.5 rounded-xl shadow-inner flex-wrap" role="group" aria-label="Filter by venue">
              <button
                type="button"
                class="btn btn-xs sm:btn-sm join-item rounded-lg font-bold gap-1 whitespace-nowrap"
                :class="locationFilter === 'all' ? 'btn-neutral shadow-xs' : 'btn-ghost opacity-75'"
                @click="locationFilter = 'all'"
              >All Venues</button>
              <button
                v-for="loc in boothLocationMetas"
                :key="loc.code"
                type="button"
                class="btn btn-xs sm:btn-sm join-item rounded-lg font-bold gap-1 whitespace-nowrap"
                :class="locationFilter === loc.code ? 'btn-secondary shadow-xs' : 'btn-ghost opacity-75'"
                @click="locationFilter = loc.code"
              >{{ loc.icon }} {{ loc.shortName }} ({{ loc.code }})</button>
            </div>
          </div>
        </div>

        <!-- Bottom Row: Partner Attribution Pills + Search Omnibox -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-base-200/70">
          <!-- Partner Pills -->
          <div class="join bg-base-200/70 p-0.5 rounded-xl shadow-inner shrink-0 flex-wrap" role="group" aria-label="Filter by co-op partner">
            <button
              type="button"
              class="btn btn-xs sm:btn-sm join-item rounded-lg font-bold gap-1 whitespace-nowrap"
              :class="partnerFilter === 'all' ? 'btn-primary shadow-xs' : 'btn-ghost opacity-75'"
              @click="partnerFilter = 'all'"
            >All Co-op <span class="badge badge-xs badge-ghost font-mono">{{ partnerCounts.all }}</span></button>
            <button
              type="button"
              class="btn btn-xs sm:btn-sm join-item rounded-lg font-bold gap-1 whitespace-nowrap"
              :class="partnerFilter === 'HUCK' ? 'btn-primary shadow-xs' : 'btn-ghost opacity-75'"
              @click="partnerFilter = 'HUCK'"
            >🫐 Huck <span class="badge badge-xs badge-ghost font-mono">{{ partnerCounts.HUCK }}</span></button>
            <button
              type="button"
              class="btn btn-xs sm:btn-sm join-item rounded-lg font-bold gap-1 whitespace-nowrap"
              :class="partnerFilter === 'BB' ? 'btn-secondary shadow-xs' : 'btn-ghost opacity-75'"
              @click="partnerFilter = 'BB'"
            >👗 B&amp;B <span class="badge badge-xs badge-ghost font-mono">{{ partnerCounts.BB }}</span></button>
            <button
              type="button"
              class="btn btn-xs sm:btn-sm join-item rounded-lg font-bold gap-1 whitespace-nowrap"
              :class="partnerFilter === 'PDXGL' ? 'btn-accent shadow-xs' : 'btn-ghost opacity-75'"
              @click="partnerFilter = 'PDXGL'"
            >🎲 PDXGL <span class="badge badge-xs badge-ghost font-mono">{{ partnerCounts.PDXGL }}</span></button>
            <button
              v-if="salesViewTab === 'coop' || partnerCounts.SWEAT > 0 || partnerFilter === 'SWEAT'"
              type="button"
              class="btn btn-xs sm:btn-sm join-item rounded-lg font-bold gap-1 whitespace-nowrap"
              :class="partnerFilter === 'SWEAT' ? 'btn-info shadow-xs' : 'btn-ghost opacity-75'"
              @click="partnerFilter = 'SWEAT'"
            >⚡ Sweat-Equity <span class="badge badge-xs badge-ghost font-mono">{{ partnerCounts.SWEAT }}</span></button>
          </div>

          <!-- Search Omnibox (Shown on Ledger Tab) -->
          <div v-if="salesViewTab === 'ledger'" class="flex items-center gap-2 flex-1 max-w-md ml-auto w-full">
            <div class="relative flex-1">
              <Icon icon="solar:magnifer-linear" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40 pointer-events-none" />
              <input
                type="text"
                v-model="searchQuery"
                placeholder="Search title, HUCK- tag, 0EJ SKU, SO#..."
                class="input input-bordered w-full pl-9 pr-15 text-xs sm:text-sm h-9 min-h-9 rounded-xl bg-base-200/50 focus:bg-base-100 border-base-300 focus:border-primary"
              />
              <div class="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                <button
                  v-if="searchQuery"
                  type="button"
                  @click="searchQuery = ''"
                  class="btn btn-ghost btn-circle btn-xs w-6 h-6 min-h-0"
                  title="Clear search"
                >✕</button>
                <button
                  type="button"
                  @click="showBarcodeScanner = true"
                  class="btn btn-ghost btn-circle btn-xs text-primary w-7 h-7 min-h-0"
                  title="Scan tag with camera"
                >
                  <Icon icon="solar:camera-linear" class="w-4 h-4" />
                </button>
              </div>
            </div>
            <span class="badge badge-sm badge-ghost font-mono opacity-70 shrink-0">
              {{ displayedSales.length }}
            </span>
          </div>
          <div v-else class="text-xs font-semibold text-base-content/60 ml-auto flex items-center gap-2">
            <span>Scope: <strong class="text-base-content">{{ scopeLabel }}</strong></span>
          </div>
        </div>

        <!-- Mobile Sort Pills (Ledger Tab Only) -->
        <div v-if="salesViewTab === 'ledger'" class="flex md:hidden items-center gap-1.5 flex-wrap pt-1 text-xs">
          <span class="font-bold opacity-60 mr-1 flex items-center gap-1 whitespace-nowrap shrink-0">
            <Icon icon="solar:sort-vertical-linear" class="w-3.5 h-3.5 shrink-0" /> Sort:
          </span>
          <button type="button" class="btn btn-xs rounded-lg font-bold gap-1" :class="sortBy === 'date' ? 'btn-primary' : 'btn-ghost opacity-75'" @click="toggleSort('date')">
            ⚡ Date <span v-if="sortBy === 'date'">{{ sortDesc ? '↓' : '↑' }}</span>
          </button>
          <button type="button" class="btn btn-xs rounded-lg font-bold gap-1" :class="sortBy === 'so' ? 'btn-primary' : 'btn-ghost opacity-75'" @click="toggleSort('so')">
            # SO# <span v-if="sortBy === 'so'">{{ sortDesc ? '↓' : '↑' }}</span>
          </button>
          <button type="button" class="btn btn-xs rounded-lg font-bold gap-1" :class="sortBy === 'net' ? 'btn-primary' : 'btn-ghost opacity-75'" @click="toggleSort('net')">
            💲 Net <span v-if="sortBy === 'net'">{{ sortDesc ? '↓' : '↑' }}</span>
          </button>
          <button type="button" class="btn btn-xs rounded-lg font-bold gap-1" :class="sortBy === 'gross' ? 'btn-primary' : 'btn-ghost opacity-75'" @click="toggleSort('gross')">
            💲 Gross <span v-if="sortBy === 'gross'">{{ sortDesc ? '↓' : '↑' }}</span>
          </button>
        </div>
      </div>

      <!-- 1. SALES LEDGER TAB -->
      <div v-show="salesViewTab === 'ledger'" class="space-y-5">
        <!-- Ledger 4-Card KPI Strip (Shown ONLY on Ledger tab so Payouts tab never double-stacks 8 boxes!) -->
        <KpiStatGrid :items="salesLedgerKpiStats" />

      <!-- Unlinked Tickets Quick-Filter Banner -->
      <div
        v-if="allUnlinkedTicketsCount > 0"
        class="alert bg-warning/10 border border-warning/40 rounded-2xl py-2.5 px-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs"
      >
        <div class="flex items-center gap-2">
          <span class="badge badge-warning font-black text-xs">⚠️ {{ allUnlinkedTicketsCount }} Unlinked Ticket{{ allUnlinkedTicketsCount === 1 ? '' : 's' }}</span>
          <span class="font-medium text-base-content/85">
            Unmapped register tickets (like <code class="font-mono font-bold">Ticket #...</code> or <code class="font-mono font-bold">SO-...</code>) need an inventory SKU link or Commons Pool assignment.
          </span>
        </div>
        <button
          type="button"
          @click="toggleOnlyUnlinkedFilter"
          class="btn btn-xs font-black rounded-lg shrink-0"
          :class="onlyUnlinkedFilter ? 'btn-neutral' : 'btn-warning'"
        >
          {{ onlyUnlinkedFilter ? '✕ Clear Unlinked Filter (Show All)' : `🔍 Show All ${allUnlinkedTicketsCount} Unlinked Ticket(s)` }}
        </button>
      </div>

      <!-- Empty State -->
      <div v-if="displayedSales.length === 0" class="card bg-base-100 shadow-xl border border-base-200">
        <div class="card-body text-center py-16">
          <div class="flex justify-center mb-4">
            <div class="p-4 bg-primary/10 rounded-full text-primary">
              <Icon icon="solar:box-minimalistic-linear" class="w-10 h-10 opacity-60" />
            </div>
          </div>
          <h3 class="text-xl font-bold">No Sales Matching Filter</h3>
          <p class="opacity-70 mt-2 max-w-md mx-auto text-sm">
            {{ searchQuery || locationFilter !== 'all' ? 'Try adjusting your search query or venue filter.' : 'Record a sale or import your booth payout CSV.' }}
          </p>
          <div class="mt-6 flex justify-center gap-3">
            <a href="/sales/import/MD" class="btn btn-outline btn-secondary font-bold">Import Payout CSV</a>
            <button type="button" @click="isRecordDrawerOpen = true" class="btn btn-primary font-bold">Record Sale</button>
          </div>
        </div>
      </div>

      <!-- 1. MOBILE CARD VIEW (VISIBLE ON MOBILE & TABLET < MD) -->
      <div v-else class="block md:hidden space-y-3 mb-6">
        <div 
          v-for="sale in paginatedSales" 
          :key="sale.uniqueKey"
          class="card bg-base-100 shadow-md border border-base-200/80 hover:border-primary/40 transition-all rounded-2xl p-3.5 space-y-3"
        >
          <!-- Card Header: SO Number + Price + Status -->
          <div class="flex items-start justify-between gap-2">
            <div class="space-y-1">
              <a 
                :href="`/sales/${sale.id}`" 
                class="btn btn-xs btn-primary text-primary-content font-mono font-black gap-1.5 shadow-xs px-2.5 rounded-lg inline-flex items-center active:scale-95 transition-all"
                title="Edit Sale"
              >
                <Icon icon="solar:document-text-bold" class="w-3.5 h-3.5 shrink-0" />
                <span>{{ sale.soNumber }}</span>
              </a>
              <div class="text-[11px] font-medium opacity-70 flex items-center gap-2 flex-wrap pt-0.5">
                <span class="flex items-center gap-1" title="Sale Date">
                  <Icon icon="solar:calendar-linear" class="w-3 h-3 text-primary shrink-0" />
                  <span class="whitespace-nowrap">{{ formatDate(sale.date) }}</span>
                </span>
                <span v-if="formatRelativeTime(sale.date)" class="badge badge-ghost badge-xs font-mono font-bold opacity-80 whitespace-nowrap">
                  {{ formatRelativeTime(sale.date) }}
                </span>
              </div>
            </div>

            <div class="text-right space-y-1 shrink-0">
              <div class="font-mono font-black text-lg text-success leading-none">
                {{ formatCurrency(sale.netPayout) }}
              </div>
              <div class="badge badge-sm font-bold" :class="getStatusClass(sale.status)">
                {{ sale.status }}
              </div>
            </div>
          </div>

          <!-- Item Title & Identifiers -->
          <div class="space-y-1.5">
            <a 
              :href="`/sales/${sale.id}`" 
              class="font-bold text-sm text-base-content hover:text-primary transition-colors line-clamp-2"
              :title="sale.title"
            >
              {{ sale.title }}
            </a>

            <!-- Chips / Pills: Location, UPC, SKU, Unlinked Ticket Warning -->
            <div class="flex items-center gap-1.5 flex-wrap text-xs">
              <span class="badge badge-sm badge-outline font-semibold gap-1 py-2 whitespace-nowrap shrink-0">
                <Icon icon="solar:shop-2-linear" class="w-3 h-3 opacity-60 shrink-0" />
                {{ sale.locationName }}
              </span>
              <span class="badge badge-sm font-bold py-2 whitespace-nowrap shrink-0" :class="partnerBadge(sale.partner).cls">{{ partnerBadge(sale.partner).text }}</span>
              <span v-if="isUnlinkedTicketSale(sale)" class="badge badge-sm badge-warning font-black py-2 whitespace-nowrap shrink-0">
                ⚠️ Unlinked Ticket
              </span>
              <span v-if="sale.sku" class="badge badge-sm badge-secondary badge-outline font-mono text-[10px] font-bold py-2 whitespace-nowrap shrink-0">
                SKU: {{ sale.sku }}
              </span>
              <span v-if="sale.upc" class="badge badge-sm badge-ghost font-mono text-[10px] opacity-75 py-2 whitespace-nowrap shrink-0">
                UPC: {{ sale.upc }}
              </span>
            </div>
          </div>

          <!-- Financial Breakdown Bar (Gross, Fees, Net) -->
          <div class="grid grid-cols-3 gap-2 bg-base-200/50 rounded-xl p-2.5 text-center text-xs">
            <div>
              <div class="text-[10px] uppercase font-bold opacity-50">Gross</div>
              <div class="font-mono font-bold text-base-content">{{ formatCurrency(sale.grossAmount) }}</div>
            </div>
            <div class="border-x border-base-200">
              <div class="text-[10px] uppercase font-bold opacity-50">Fees</div>
              <div class="font-mono font-bold text-error">-{{ formatCurrency(sale.fees) }}</div>
            </div>
            <div>
              <div class="text-[10px] uppercase font-bold opacity-50">Net Payout</div>
              <div class="font-mono font-black text-success">{{ formatCurrency(sale.netPayout) }}</div>
            </div>
          </div>

          <!-- Touch Actions: Link Inventory + Edit Sale + Item Link -->
          <div class="flex items-center gap-2 pt-1 border-t border-base-200/60 flex-wrap">
            <button
              v-if="isUnlinkedTicketSale(sale)"
              type="button"
              @click="openLinkTicketModal(sale)"
              class="btn btn-sm btn-warning font-black flex-1 rounded-xl gap-1.5 min-h-[38px] shadow-xs active:scale-95 transition-all"
            >
              <Icon icon="solar:link-circle-bold" class="w-4 h-4 shrink-0" />
              <span>Link Inventory</span>
            </button>
            <a 
              :href="`/sales/${sale.id}`" 
              class="btn btn-sm btn-primary text-primary-content font-bold flex-1 rounded-xl gap-1.5 min-h-[38px] shadow-xs active:scale-95 transition-all"
              title="Edit Sale Details"
            >
              <Icon icon="solar:pen-bold" class="w-4 h-4 shrink-0" />
              <span>Edit Sale</span>
            </a>

            <button 
              v-if="sale.itemId"
              type="button"
              @click="openItemInspectorById(sale.itemId)" 
              class="btn btn-sm btn-outline btn-secondary font-bold rounded-xl gap-1.5 min-h-[38px] px-3 shrink-0"
              title="Inspect Item in Side Drawer"
            >
              <Icon icon="solar:eye-bold" class="w-4 h-4 shrink-0" />
              <span>Item</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 2. DESKTOP TABLE VIEW (VISIBLE ON MD AND LARGER SCREENS) -->
      <div v-if="displayedSales.length > 0" class="hidden md:block card bg-base-100 shadow-xl border border-base-200 overflow-hidden mb-6">
        <div class="overflow-x-auto">
          <table class="table table-sm table-pin-rows table-zebra w-full text-xs">
            <thead class="bg-base-200/90 text-xs font-bold text-base-content select-none border-b border-base-300">
              <tr>
                <th class="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-base-200 transition-colors" @click="toggleSort('so')">
                  <div class="flex items-center gap-1">
                    SO Number
                    <span v-if="sortBy === 'so'" class="text-xs font-black text-primary">{{ sortDesc ? '▼' : '▲' }}</span>
                  </div>
                </th>
                <th class="py-3 px-3">Item &amp; Partner</th>
                <th class="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-base-200 transition-colors" @click="toggleSort('date')">
                  <div class="flex items-center gap-1">
                    Sale Date
                    <span v-if="sortBy === 'date'" class="text-xs font-black text-primary">{{ sortDesc ? '▼' : '▲' }}</span>
                  </div>
                </th>
                <th class="py-3 px-3 whitespace-nowrap text-right cursor-pointer hover:bg-base-200 transition-colors" @click="toggleSort('gross')">
                  <div class="flex items-center justify-end gap-1">
                    Gross
                    <span v-if="sortBy === 'gross'" class="text-xs font-black text-primary">{{ sortDesc ? '▼' : '▲' }}</span>
                  </div>
                </th>
                <th class="py-3 px-3 whitespace-nowrap text-right">Venue Fee</th>
                <th class="py-3 px-3 whitespace-nowrap text-right cursor-pointer hover:bg-base-200 transition-colors" @click="toggleSort('net')">
                  <div class="flex items-center justify-end gap-1">
                    Net Payout
                    <span v-if="sortBy === 'net'" class="text-xs font-black text-primary">{{ sortDesc ? '▼' : '▲' }}</span>
                  </div>
                </th>
                <th class="py-3 px-3 whitespace-nowrap text-right cursor-pointer hover:bg-base-200 transition-colors" @click="toggleSort('cost')">
                  <div class="flex items-center justify-end gap-1">
                    Cost Basis
                    <span v-if="sortBy === 'cost'" class="text-xs font-black text-primary">{{ sortDesc ? '▼' : '▲' }}</span>
                  </div>
                </th>
                <th class="py-3 px-3 whitespace-nowrap text-right cursor-pointer hover:bg-base-200 transition-colors" @click="toggleSort('profit')">
                  <div class="flex items-center justify-end gap-1">
                    Net Profit
                    <span v-if="sortBy === 'profit'" class="text-xs font-black text-primary">{{ sortDesc ? '▼' : '▲' }}</span>
                  </div>
                </th>
                <th class="py-3 px-2 w-px"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="sale in paginatedSales" :key="sale.uniqueKey" class="hover:bg-base-200/40 transition-colors">
                <!-- SO Number -->
                <td class="py-2.5 px-3 whitespace-nowrap">
                  <a
                    :href="`/sales/${sale.id}`"
                    class="btn btn-xs btn-primary text-primary-content font-mono font-black px-2 h-7 rounded-lg inline-flex items-center"
                    title="Edit Sale"
                  >{{ sale.soNumber }}</a>
                </td>

                <!-- Item & Partner badge + condensed venue -->
                <td class="py-2.5 px-3">
                  <div class="flex items-center gap-2 flex-wrap">
                    <a
                      :href="`/sales/${sale.id}`"
                      class="font-bold text-xs text-base-content hover:text-primary transition-colors block max-w-[14rem] xl:max-w-sm truncate"
                      :title="sale.title"
                    >{{ sale.title }}</a>
                    <span
                      v-if="isUnlinkedTicketSale(sale)"
                      class="badge badge-xs badge-warning font-black whitespace-nowrap"
                    >
                      ⚠️ Unlinked Ticket
                    </span>
                    <button
                      v-if="isUnlinkedTicketSale(sale)"
                      type="button"
                      @click="openLinkTicketModal(sale)"
                      class="btn btn-xs btn-warning font-black h-6 min-h-0 px-2 rounded-lg gap-1 shadow-2xs"
                    >
                      <Icon icon="solar:link-circle-bold" class="w-3 h-3 shrink-0" />
                      <span>Link Inventory</span>
                    </button>
                  </div>
                  <div class="flex items-center gap-1 mt-1 flex-wrap">
                    <span class="badge badge-xs font-bold whitespace-nowrap" :class="partnerBadge(sale.partner).cls">{{ partnerBadge(sale.partner).text }}</span>
                    <span class="badge badge-xs badge-outline font-semibold whitespace-nowrap" :title="`${sale.locationName}${sale.sku ? ' · ' + sale.sku : ''}`">{{ condenseLocation(sale) }}</span>
                    <span v-if="sale.upc" class="font-mono text-[10px] opacity-60 whitespace-nowrap">{{ sale.upc }}</span>
                    <button
                      v-if="!isUnlinkedTicketSale(sale)"
                      type="button"
                      @click="openLinkTicketModal(sale)"
                      class="btn btn-ghost btn-xs h-5 min-h-0 px-1.5 text-[10px] font-bold opacity-60 hover:opacity-100"
                      title="Reassign Partner or Re-link Inventory SKU"
                    >
                      ⇄ Reassign
                    </button>
                  </div>
                </td>

                <!-- Sale Date -->
                <td class="py-2.5 px-3 font-mono text-xs opacity-75 whitespace-nowrap">{{ formatDate(sale.date) }}</td>

                <!-- Gross -->
                <td class="py-2.5 px-3 text-right font-mono font-bold text-xs whitespace-nowrap">{{ formatCurrency(sale.grossAmount) }}</td>

                <!-- Venue fee -->
                <td class="py-2.5 px-3 text-right font-mono text-xs text-error whitespace-nowrap">-{{ formatCurrency(sale.fees) }}</td>

                <!-- Net payout -->
                <td class="py-2.5 px-3 text-right font-mono font-black text-xs text-success whitespace-nowrap">{{ formatCurrency(sale.netPayout) }}</td>

                <!-- Cost basis -->
                <td class="py-2.5 px-3 text-right font-mono text-xs opacity-80 whitespace-nowrap">{{ sale.costBasis > 0 ? formatCurrency(sale.costBasis) : '—' }}</td>

                <!-- Net profit -->
                <td class="py-2.5 px-3 text-right font-mono font-black text-xs whitespace-nowrap" :class="sale.netProfit >= 0 ? 'text-success' : 'text-error'">{{ formatCurrency(sale.netProfit) }}</td>

                <!-- Actions (icon-only so nothing clips) -->
                <td class="py-2.5 px-2 whitespace-nowrap">
                  <div class="flex items-center justify-end gap-1">
                    <a
                      :href="`/sales/${sale.id}`"
                      class="btn btn-xs btn-outline btn-primary btn-square rounded-lg h-7 w-7"
                      title="Edit Sale"
                    >
                      <Icon icon="solar:pen-bold" class="w-3 h-3 shrink-0" />
                    </a>
                    <button
                      v-if="sale.itemId"
                      type="button"
                      @click="openItemInspectorById(sale.itemId)"
                      class="btn btn-xs btn-ghost btn-square text-base-content/70 hover:text-primary rounded-lg h-7 w-7"
                      title="Inspect Item in Side Drawer"
                    >
                      <Icon icon="solar:eye-linear" class="w-3.5 h-3.5 shrink-0" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- UNIFIED 2-TIER BOTTOM DOCK WITH PAGER PATTERN -->
      <PaginationDock
        v-if="displayedSales.length > 0 && salesViewTab === 'ledger'"
        v-model:currentPage="currentPage"
        v-model:pageSize="pageSize"
        :totalItems="displayedSales.length"
        :totalPages="totalPages"
        :isLoading="loading"
        entityLabel="sales"
        :isFiltered="locationFilter !== 'all' || partnerFilter !== 'all' || monthFilter !== 'all' || !!searchQuery"
        @scroll-top="scrollToTop"
      >
        <template #dock>
          <!-- Dock Item 1: Export CSV -->
          <button 
            type="button"
            @click="exportSalesCsv"
            class="h-11 my-auto px-2 sm:px-3 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 bg-base-200/80 hover:bg-base-300 text-base-content font-bold border border-base-content/15 shadow-xs active:scale-95 cursor-pointer"
            title="Export current sales view to CSV"
          >
            <Icon icon="solar:file-download-bold" class="w-4.5 h-4.5" />
            <span class="font-extrabold uppercase text-[10px] tracking-tight leading-none whitespace-nowrap">Export CSV</span>
          </button>

          <!-- Dock Item 2: Record Sale (Opens Shopping Cart Slide-Over Tray) -->
          <button 
            type="button"
            @click="isRecordDrawerOpen = true" 
            class="h-11 my-auto px-3.5 sm:px-4 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 bg-primary text-primary-content font-black shadow-md border border-primary-content/25 active:scale-95 hover:brightness-110 cursor-pointer"
            title="Open Record Sale Cart Tray"
          >
            <Icon icon="solar:cart-plus-bold" class="w-4.5 h-4.5 drop-shadow-xs" />
            <span class="font-black uppercase text-[10px] sm:text-[11px] tracking-wide leading-none whitespace-nowrap">Record Sale</span>
          </button>
        </template>
      </PaginationDock>
      </div>

      <!-- 2. CO-OP SETTLEMENTS TAB -->
      <div v-show="salesViewTab === 'coop'">
        <CoopSettlementView
          :sales="consolidatedSales"
          :period="monthFilter"
          :location="locationFilter"
          :partner-filter="partnerFilter"
          :monthly-rent="boothMonthlyRent"
          :warehouses="warehouses"
          @update:period="monthFilter = $event"
          @update:location="locationFilter = $event"
          @link-sale="openLinkTicketModal"
          @inspect-item="openItemInspectorById"
          @sweat-count="activeSweatWorkerCount = $event"
        />
      </div>

      <!-- Reusable Camera Barcode & QR Scanner Modal -->
      <BarcodeScannerModal 
          :is-open="showBarcodeScanner"
          title="Scan Barcode or Mini QR"
          subtitle="Point camera at any tag or sticker to find sale"
          @close="showBarcodeScanner = false"
          @scan="(res) => { if (res && res.rawValue) searchQuery = res.rawValue; }"
      />

      <!-- Unlinked Ticket Inventory Match & Partner Reassignment Modal -->
      <LinkTicketInventoryModal
        :is-open="isLinkTicketModalOpen"
        :sale="activeSaleForLinking"
        :inventory-items="inventoryItems"
        :live-sale-ids="sales.map((s) => s.$id)"
        :tenant-id="currentTeam?.$id"
        @close="isLinkTicketModalOpen = false"
        @updated="handleSaleLinkedOrReassigned"
      />

      <!-- Shopping Cart Record Sale Slide-Over Tray -->
      <RecordSaleDrawer
        v-model="isRecordDrawerOpen"
        :initial-location="locationFilter"
        :warehouses="warehouses"
        :inventory-items="inventoryItems"
        :tenant-id="currentTeam?.$id"
        @inspect-item="inspectedItem = $event"
        @saved="handleRecordedSalesSaved"
      />

      <!-- Canonical Slide-Over Confirmation Drawer for Staged Ricochet Sales (Zero JS alert/confirm popups) -->
      <SlideOverDrawer
        v-model="isRicochetConfirmDrawerOpen"
        size="lg"
        :title="`Confirm Staged ${activeRicochetVenueMeta.shortName} Sales`"
        :subtitle="`${ricochetConfirmTargetMonthLabel} • Checked against the Official Sales Ledger (duplicates skipped)`"
      >
        <div class="space-y-4">
          <!-- 4-Card Summary Strip -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div class="rounded-xl border border-base-300 bg-base-200/60 p-3">
              <div class="text-[11px] font-bold uppercase tracking-wider text-base-content/60">New Sales</div>
              <div class="text-xl font-black text-info mt-0.5">{{ ricochetActionableNewCount }}</div>
              <div class="text-[11px] text-base-content/65 font-semibold">{{ ricochetConfirmTargetMonthLabel }}</div>
            </div>
            <div class="rounded-xl border border-base-300 bg-base-200/60 p-3">
              <div class="text-[11px] font-bold uppercase tracking-wider text-base-content/60">Gross Added</div>
              <div class="text-xl font-black text-base-content mt-0.5">${{ ricochetNewBreakdown.gross.toFixed(2) }}</div>
              <div class="text-[11px] text-base-content/65 font-semibold">{{ Math.round((activeRicochetVenueMeta.commissionRate || 0) * 100) }}% booth fee</div>
            </div>
            <div class="rounded-xl border border-success/40 bg-success/10 p-3">
              <div class="text-[11px] font-bold uppercase tracking-wider text-success">Net Payout</div>
              <div class="text-xl font-black text-success mt-0.5">+${{ ricochetNewBreakdown.net.toFixed(2) }}</div>
              <div class="text-[11px] text-base-content/70 font-semibold">Cleared to booth</div>
            </div>
            <div class="rounded-xl border border-base-300 bg-base-200/60 p-3">
              <div class="text-[11px] font-bold uppercase tracking-wider text-base-content/60">Item Match</div>
              <div class="text-xl font-black mt-0.5" :class="ricochetNewBreakdown.unmatchedCount === 0 ? 'text-success' : 'text-warning'">
                {{ ricochetNewBreakdown.matchedCount }} / {{ ricochetActionableNewCount }}
              </div>
              <div class="text-[11px] text-base-content/65 font-semibold">
                {{ ricochetNewBreakdown.unmatchedCount === 0 ? '100% SKU/UPC linked' : `${ricochetNewBreakdown.unmatchedCount} unlinked` }}
              </div>
            </div>
          </div>

          <!-- Live Before ➔ After Partner Payout Preview -->
          <div class="rounded-xl border border-base-300 bg-base-100 overflow-hidden">
            <div class="px-3.5 py-2.5 bg-base-200/70 border-b border-base-300 flex items-center justify-between gap-2">
              <div class="text-xs font-black uppercase tracking-wider text-base-content/80">
                📊 Partner Ledger Impact ({{ activeRicochetVenueMeta.shortName }} · {{ ricochetConfirmTargetMonthLabel }})
              </div>
              <span class="badge badge-sm badge-ghost font-semibold">Before ➔ After</span>
            </div>
            <div class="overflow-x-auto">
              <table class="table table-xs sm:table-sm w-full">
                <thead>
                  <tr class="text-[11px] uppercase text-base-content/60 border-b border-base-200">
                    <th>Partner</th>
                    <th class="text-right">In Ledger Now</th>
                    <th class="text-right text-info">+ Adding Now</th>
                    <th class="text-right text-success">New Month Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="pRow in ricochetPartnerBeforeAfter.partners"
                    :key="pRow.key"
                    class="border-b border-base-200/70"
                    :class="pRow.addCount > 0 ? 'bg-info/5 font-semibold' : 'opacity-75'"
                  >
                    <td>
                      <span class="badge badge-sm font-bold" :class="pRow.badgeCls">{{ pRow.label }}</span>
                    </td>
                    <td class="text-right font-mono text-xs">
                      {{ pRow.beforeCount }} <span class="text-base-content/60">(${{ pRow.beforeGross.toFixed(2) }})</span>
                    </td>
                    <td class="text-right font-mono text-xs font-black" :class="pRow.addCount > 0 ? 'text-info' : 'text-base-content/40'">
                      <template v-if="pRow.addCount > 0">
                        +{{ pRow.addCount }} (+${{ pRow.addGross.toFixed(2) }} / +${{ pRow.addNet.toFixed(2) }} net)
                      </template>
                      <template v-else>—</template>
                    </td>
                    <td class="text-right font-mono text-xs font-black" :class="pRow.addCount > 0 ? 'text-success' : ''">
                      {{ pRow.afterCount }} (${{ pRow.afterGross.toFixed(2) }} / ${{ pRow.afterNet.toFixed(2) }} net)
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr class="bg-base-200/80 font-black text-xs border-t-2 border-base-300">
                    <td>Total ({{ activeRicochetVenueMeta.code }})</td>
                    <td class="text-right font-mono">
                      {{ ricochetPartnerBeforeAfter.total.beforeCount }} (${{ ricochetPartnerBeforeAfter.total.beforeNet.toFixed(2) }} net)
                    </td>
                    <td class="text-right font-mono text-info">
                      +{{ ricochetPartnerBeforeAfter.total.addCount }} (+${{ ricochetPartnerBeforeAfter.total.addNet.toFixed(2) }} net)
                    </td>
                    <td class="text-right font-mono text-success">
                      {{ ricochetPartnerBeforeAfter.total.afterCount }} (${{ ricochetPartnerBeforeAfter.total.afterNet.toFixed(2) }} net)
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <!-- Full Scannable Ticket-Line List -->
          <div class="rounded-xl border border-base-300 bg-base-100 overflow-hidden">
            <div class="px-3.5 py-2.5 bg-base-200/70 border-b border-base-300 flex items-center justify-between gap-2">
              <div class="text-xs font-black uppercase tracking-wider text-base-content/80">
                🧾 Ticket Lines to Write ({{ ricochetActionableNewCount }})
              </div>
              <span class="text-[11px] text-base-content/65 font-semibold">📦 Booth Bins keep stock active</span>
            </div>
            <div class="divide-y divide-base-200 max-h-96 overflow-y-auto">
              <div
                v-for="(row, rIdx) in ricochetActionableNewRows"
                :key="`confirm-${row.payoutId || row.saleNumber}-${row.sku}-${rIdx}`"
                class="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-base-200/40"
              >
                <div class="min-w-0 space-y-0.5">
                  <div class="flex flex-wrap items-center gap-1.5 text-xs">
                    <span class="font-mono font-black text-primary">#{{ String(row.payoutId || row.saleNumber || '').replace(/^#/, '') }}</span>
                    <span class="font-mono text-base-content/70">{{ row.soldDate }}</span>
                    <span
                      class="badge badge-xs font-bold"
                      :class="row.partnerBucket === 'PDXGL' ? 'badge-accent' : row.partnerBucket === 'BB' ? 'badge-secondary' : 'badge-primary'"
                    >
                      {{ row.partnerBucket === 'PDXGL' ? '🎲 PDXGL' : row.partnerBucket === 'BB' ? '👗 B&B' : '🫐 HUCK' }}
                    </span>
                    <span v-if="row.sku" class="font-mono font-bold text-warning">{{ row.sku }}</span>
                    <span v-if="row.matchedItemUpc || row.upc" class="font-mono font-bold text-info">{{ row.matchedItemUpc || row.upc }}</span>
                    <span v-if="isStagedRowBoothBin(row)" class="badge badge-xs badge-info badge-outline font-bold">
                      📦 Booth Bin
                    </span>
                  </div>
                  <div class="text-xs font-semibold text-base-content truncate">
                    {{ row.matchedItemTitle || row.title }}
                  </div>
                </div>
                <div class="flex items-center sm:flex-col sm:items-end justify-between gap-1 shrink-0 font-mono text-xs">
                  <div class="font-bold">
                    ${{ Number(row.grossPrice || 0).toFixed(2) }}
                    <span class="opacity-50">→</span>
                    <span class="text-success font-black">${{ Number(row.ricoNetPayout ?? row.expectedNetPayout ?? 0).toFixed(2) }} net</span>
                  </div>
                  <div v-if="row.matchedItemCost !== undefined" class="text-[11px] text-base-content/60">
                    Cost: ${{ Number(row.matchedItemCost || 0).toFixed(2) }}
                  </div>
                </div>
              </div>
              <div v-if="ricochetActionableNewCount === 0" class="p-6 text-center text-sm font-bold text-success">
                ✅ All staged Ricochet ticket lines are now recorded in the ledger!
              </div>
            </div>
          </div>

          <!-- Inline Safety Checkbox ONLY when batch spans >1 month OR >25 rows (zero browser popups) -->
          <label
            v-if="ricochetNewBreakdown.exceedsGuardThreshold"
            class="flex items-start gap-3 p-3.5 rounded-xl border-2 border-warning/60 bg-warning/10 cursor-pointer"
          >
            <input
              v-model="confirmGuardAcknowledged"
              type="checkbox"
              class="checkbox checkbox-warning checkbox-sm mt-0.5 shrink-0"
            />
            <span class="text-xs font-semibold text-base-content leading-snug">
              <strong class="font-black text-warning">⚠️ Large / Multi-Month Batch Check:</strong>
              This batch contains <strong>{{ ricochetNewBreakdown.count }} rows</strong> across
              <strong>{{ ricochetNewBreakdown.monthKeys.join(', ') }}</strong>. I verified these ticket lines are genuinely new before adding to the Official Sales Ledger.
            </span>
          </label>
        </div>

        <template #footer>
          <div class="space-y-2">
            <div v-if="isCommittingRicochetSync && ricochetCommitProgress" class="space-y-1">
              <div class="flex items-center justify-between text-xs font-bold text-info">
                <span>Saving sales to ledger…</span>
                <span class="font-mono">{{ ricochetCommitProgress.done }} / {{ ricochetCommitProgress.total }}</span>
              </div>
              <progress
                class="progress progress-info w-full h-2"
                :value="ricochetCommitProgress.done"
                :max="Math.max(1, ricochetCommitProgress.total)"
              ></progress>
            </div>
            <div class="flex items-center justify-between gap-2">
              <button
                type="button"
                class="btn btn-ghost font-bold rounded-xl"
                :disabled="isCommittingRicochetSync"
                @click="isRicochetConfirmDrawerOpen = false"
              >
                Cancel
              </button>
              <button
                type="button"
                class="btn btn-success font-black rounded-xl shadow-sm gap-2"
                :disabled="
                  isCommittingRicochetSync ||
                  ricochetActionableNewCount === 0 ||
                  (ricochetNewBreakdown.exceedsGuardThreshold && !confirmGuardAcknowledged)
                "
                @click="executeRicochetDrawerCommit"
              >
                <span v-if="isCommittingRicochetSync" class="loading loading-spinner loading-xs"></span>
                <span>
                  ✅ Confirm &amp; Write {{ ricochetActionableNewCount }} {{ ricochetActionableNewCount === 1 ? 'Sale' : 'Sales' }} to Ledger (${{ ricochetNewBreakdown.net.toFixed(2) }} net)
                </span>
              </button>
            </div>
          </div>
        </template>
      </SlideOverDrawer>

      <!-- Canonical Item Side Drawer (Mounted after RecordSaleDrawer so inspecting from Cart stacks cleanly on top!) -->
      <ItemDrawer
        v-if="inspectedItem"
        :item="inspectedItem"
        :isOpen="!!inspectedItem"
        :inventoryItems="inventoryItems"
        @close="closeItemInspector"
        @saved="handleItemInspectorSaved"
        @save="handleItemInspectorSaved"
      />

    </div>
  </div>
  </CollectiveAccessGate>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { Icon } from '@iconify/vue';
import CollectiveAccessGate from '../common/CollectiveAccessGate.vue';
import KpiStatGrid, { type KpiStatItem } from '../common/KpiStatGrid.vue';
import CoopSettlementView from './CoopSettlementView.vue';
import LinkTicketInventoryModal from './LinkTicketInventoryModal.vue';
import RecordSaleDrawer from './RecordSaleDrawer.vue';
import SlideOverDrawer from '../common/SlideOverDrawer.vue';
import ItemDrawer from '../common/ItemDrawer.vue';
import { useAuth } from '../../composables/useAuth';
import { useMemberCapabilities } from '../../lib/memberAccess';
import { useInventory } from '../../composables/useInventory';
import { useRicochetSalesSync } from '../../composables/useRicochetSalesSync';
import { resolveMultiQtyCost } from '../../composables/useItemDrawerForm';
import { client } from '../../lib/appwrite';
import { salesApi } from '../../lib/sales';
import { isIntentionalNoSkuOrderId } from '../../lib/salesChannels';
import { warehousesApi, matchesLocationFilter, findFacility, resolveDefaultRicochetLocationMeta, getAllLocationSettingMetas } from '../../lib/warehouses';
import PaginationDock from '../common/PaginationDock.vue';
import BarcodeScannerModal from '../common/BarcodeScannerModal.vue';
import type { SaleDocument } from '../../lib/sales';
import type { WarehouseDocument } from '../../lib/warehouses';
import {
  pacificMonthKey,
  monthKeyToLabel,
  PREVERIFIED_MD_MULTI_QTY_BINS,
  resolveMdUnitCostBasis,
  cleanCatalogSku,
  buildLockedMultiBinMap,
  splitTrailingBoothSku,
  matchMemoryDenInventoryItem,
} from '../../lib/salesBucketing';

const props = defineProps<{
  initialTab?: 'ledger' | 'coop';
}>();

const { currentTeam } = useAuth();
const { capabilities } = useMemberCapabilities();
const { inventoryItems, fetchInventory } = useInventory();

const isSettlementRoute = computed(() => props.initialTab === 'coop');
const canAccessSalesSurface = computed(() =>
  isSettlementRoute.value
    ? capabilities.value.canSeeCollectiveFinancials
    : capabilities.value.canViewSales
);

const sales = ref<SaleDocument[]>([]);
const warehouses = ref<WarehouseDocument[]>([]);
const loading = ref(true);
const error = ref('');
const searchQuery = ref('');
const locationFilter = ref('all');
type PartnerKey = 'all' | 'HUCK' | 'BB' | 'PDXGL' | 'SWEAT' | 'COMMONS';
const partnerFilter = ref<PartnerKey>('all');
const activeSweatWorkerCount = ref<number>(0);
const monthFilter = ref<string>('all');
let monthDefaulted = false;
const showBarcodeScanner = ref(false);
const salesViewTab = ref<'ledger' | 'coop'>(props.initialTab || 'ledger');
const isLinkTicketModalOpen = ref(false);
const activeSaleForLinking = ref<any | null>(null);
const onlyUnlinkedFilter = ref(false);
const isRecordDrawerOpen = ref(false);
const inspectedItem = ref<any | null>(null);

const openItemInspectorById = (itemId: string) => {
  if (!itemId) return;
  const found = (inventoryItems.value || []).find((i: any) => i.$id === itemId);
  if (found) inspectedItem.value = found;
};

const closeItemInspector = () => {
  inspectedItem.value = null;
  if (isRecordDrawerOpen.value && typeof document !== 'undefined') {
    document.body.style.overflow = 'hidden';
  }
};

const handleItemInspectorSaved = async () => {
  if (currentTeam.value?.$id) {
    await fetchInventory(currentTeam.value.$id).catch(() => {});
  }
  closeItemInspector();
};

const handleRecordedSalesSaved = async ({ sales: newSales }: { sales: SaleDocument[]; linkedItemIds: string[] }) => {
  for (const created of newSales) {
    if (!sales.value.find((s) => s.$id === created.$id)) {
      sales.value.unshift(created);
    }
  }
  if (currentTeam.value?.$id) {
    await fetchInventory(currentTeam.value.$id).catch(() => {});
  }
};

const isIntentionalNoSkuSale = (sale: any): boolean => isIntentionalNoSkuOrderId(sale?.orderId);

const isUnlinkedTicketSale = (sale: any): boolean => {
  if (!sale) return false;
  if (sale.partner === 'COMMONS') return false;
  if (isIntentionalNoSkuSale(sale)) return false;
  const title = String(sale.title || '').trim();
  const so = String(sale.soNumber || '').trim();
  if (/^SO-/i.test(so)) {
    return true;
  }
  if (!sale.itemId && (/^ticket\s*#/i.test(title) || /^order\s+/i.test(title) || /^md-payout/i.test(title))) {
    return true;
  }
  return !sale.itemId;
};

const allUnlinkedTicketsCount = computed(() => {
  return consolidatedSales.value.filter(isUnlinkedTicketSale).length;
});

const toggleOnlyUnlinkedFilter = () => {
  onlyUnlinkedFilter.value = !onlyUnlinkedFilter.value;
  if (onlyUnlinkedFilter.value) {
    monthFilter.value = 'all';
    partnerFilter.value = 'all';
  }
};

const openLinkTicketModal = (sale: any) => {
  activeSaleForLinking.value = sale;
  isLinkTicketModalOpen.value = true;
};

const handleSaleLinkedOrReassigned = async ({ saleId, updatedSale }: { saleId: string; updatedSale: any }) => {
  const idx = sales.value.findIndex((s) => s.$id === saleId);
  if (idx !== -1 && updatedSale) {
    sales.value[idx] = { ...sales.value[idx], ...updatedSale };
  }
  if (currentTeam.value?.$id) {
    await fetchInventory(currentTeam.value.$id).catch(() => {});
  }
};

// Booth rent for Co-op Settlements: resolved from the live Appwrite warehouse document (Ricochet booth), never hardcoded
const activeRicochetVenueMeta = computed(() => resolveDefaultRicochetLocationMeta(warehouses.value));
const boothMonthlyRent = computed(() => Number(activeRicochetVenueMeta.value.monthlyRent || 0));
const boothLocationMetas = computed(() =>
  getAllLocationSettingMetas(warehouses.value).filter((m) => m.monthlyRent > 0 || m.commissionRate > 0)
);

const stagedSyncStatusToast = ref<{ type: 'success' | 'error' | 'warning' | 'info'; message: string } | null>(null);
const isRicochetConfirmDrawerOpen = ref(false);
const confirmGuardAcknowledged = ref(false);
const pendingAutoOpenConfirmDrawer = ref(false);

const {
  hasLoadedLiveSalesLedger,
  isLoadingRicochetSync,
  isCommittingRicochetSync,
  ricochetCommitProgress,
  isRicochetLiveCommitUnlocked,
  ricochetActionableNewRows,
  ricochetActionableNewCount,
  ricochetNewBreakdown,
  fetchStagedRicochetSales,
  commitLiveSales,
} = useRicochetSalesSync({
  activeCanonicalLocationMeta: activeRicochetVenueMeta,
  inventoryItems,
  externalSales: sales,
  addToast: (toast) => {
    stagedSyncStatusToast.value = toast;
  },
  onCsvFallbackPaste: () => {},
  onAfterLiveCommit: () => {
    void fetchData();
  },
  getTenantId: () => currentTeam.value?.$id || '',
});

const openRicochetConfirmDrawer = () => {
  if (isCommittingRicochetSync.value || ricochetActionableNewCount.value === 0) return;
  confirmGuardAcknowledged.value = false;
  isRicochetConfirmDrawerOpen.value = true;
};

const executeRicochetDrawerCommit = async () => {
  if (isCommittingRicochetSync.value || ricochetActionableNewCount.value === 0) return;
  if (ricochetNewBreakdown.value.exceedsGuardThreshold && !confirmGuardAcknowledged.value) return;
  isRicochetLiveCommitUnlocked.value = true;
  await commitLiveSales();
  if (ricochetActionableNewCount.value === 0) {
    isRicochetConfirmDrawerOpen.value = false;
  }
};

// Sorting state (PO treatment)
type SortKey = 'date' | 'so' | 'net' | 'gross' | 'location' | 'status' | 'cost' | 'profit';
const sortBy = ref<SortKey>('date');
const sortDesc = ref(true);

// Pagination state
const currentPage = ref(1);
const pageSize = ref(50);

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(displayedSales.value.length / pageSize.value));
});

const paginatedSales = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return displayedSales.value.slice(start, start + pageSize.value);
});

watch([searchQuery, locationFilter, partnerFilter, monthFilter, sortBy, sortDesc], () => {
  currentPage.value = 1;
});

const scrollToTop = () => {
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

const exportSalesCsv = () => {
  if (!displayedSales.value.length) return;
  const headers = ['SO Number', 'Title', 'Partner', 'UPC', 'SKU', 'Location', 'Date', 'Gross Amount', 'Fees', 'Net Payout', 'Cost Basis', 'Net Profit'];
  const rows = displayedSales.value.map(s => [
    `"${(s.soNumber || '').replace(/"/g, '""')}"`,
    `"${(s.title || '').replace(/"/g, '""')}"`,
    `"${(s.partner || '').replace(/"/g, '""')}"`,
    `"${(s.upc || '').replace(/"/g, '""')}"`,
    `"${(s.sku || '').replace(/"/g, '""')}"`,
    `"${(s.locationName || '').replace(/"/g, '""')}"`,
    `"${(s.date || '').replace(/"/g, '""')}"`,
    s.grossAmount?.toFixed(2) || '0.00',
    s.fees?.toFixed(2) || '0.00',
    s.netPayout?.toFixed(2) || '0.00',
    s.costBasis?.toFixed(2) || '0.00',
    s.netProfit?.toFixed(2) || '0.00'
  ]);
  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `sales_export_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const toggleSort = (field: SortKey) => {
  if (sortBy.value === field) {
    sortDesc.value = !sortDesc.value;
  } else {
    sortBy.value = field;
    sortDesc.value = (field === 'date' || field === 'net' || field === 'gross' || field === 'profit' || field === 'cost');
  }
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return 'N/A';
  const s = String(dateStr).trim();
  const ymd = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:$|T00:00:00(?:\.0+)?Z$|\s)/i);
  if (ymd) {
    return `${Number(ymd[2])}/${Number(ymd[3])}/${ymd[1]}`;
  }
  const mdy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:$|\s)/);
  if (mdy) {
    return `${Number(mdy[1])}/${Number(mdy[2])}/${mdy[3]}`;
  }
  try {
    const d = new Date(s);
    return isNaN(d.getTime())
      ? dateStr
      : d.toLocaleDateString('en-US', {
          timeZone: 'America/Los_Angeles',
          month: 'numeric',
          day: 'numeric',
          year: 'numeric',
        });
  } catch {
    return dateStr;
  }
};

const formatRelativeTime = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays > 0 && diffDays < 30) return `${diffDays}d ago`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths > 0 && diffMonths < 12) return `${diffMonths}mo ago`;
    if (diffMonths >= 12) return `${Math.floor(diffMonths / 12)}y ago`;
    return '';
  } catch {
    return '';
  }
};

const getStatusClass = (status: string) => {
  const s = (status || '').toLowerCase();
  if (s === 'draft') return 'badge-neutral text-neutral-content font-bold whitespace-nowrap';
  if (s === 'sold' || s === 'paid') return 'badge-success text-success-content font-black whitespace-nowrap';
  if (s === 'shipped') return 'badge-primary text-primary-content font-bold whitespace-nowrap';
  if (s === 'delivered') return 'badge-info text-info-content font-bold whitespace-nowrap';
  if (s === 'returned' || s === 'refunded') return 'badge-error text-error-content font-bold whitespace-nowrap';
  return 'badge-ghost text-base-content/80 font-bold whitespace-nowrap';
};

const resolveWarehouse = (locNameOrId?: string): WarehouseDocument | undefined => {
  if (!locNameOrId) return undefined;
  const trimmed = locNameOrId.trim();

  // 1. Match by ID
  const byId = warehouses.value.find(w => w.$id === trimmed);
  if (byId) return byId;

  // 2. Match by code (MD, DT, HG, HD)
  const byCode = warehouses.value.find(w => w.code && w.code.toUpperCase() === trimmed.toUpperCase());
  if (byCode) return byCode;

  // 3. Match via facility helper
  const fac = findFacility(trimmed);
  if (fac) {
    const byFac = warehouses.value.find(w => 
      (w.code && w.code.toUpperCase() === fac.code.toUpperCase()) ||
      findFacility(w.name)?.code === fac.code
    );
    if (byFac) return byFac;
  }

  // 4. Match clean name
  const target = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
  return warehouses.value.find(w => {
    const wClean = w.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return wClean === target || wClean.includes(target) || target.includes(wClean);
  });
};

const getWarehouseName = (warehouseId: string) => {
  const wh = resolveWarehouse(warehouseId);
  return wh ? wh.name : (warehouseId || 'General Location');
};

const getCommissionRate = (locNameOrId: string) => {
  const wh = resolveWarehouse(locNameOrId);
  return wh?.commissionRate ?? 0;
};

// Consolidated list combining sales collection documents & sold items from inventory
const consolidatedSales = computed(() => {
  const list: any[] = [];
  const linkedSaleIds = new Set<string>();
  const claimedItemIdToSku = new Map<string, string>();
  const multiBinBySku = buildLockedMultiBinMap(inventoryItems.value || [], claimedItemIdToSku);
  const isSoldUnitSplitChild = (it: any) => /\(sold unit\)/i.test(String(it?.title || ''));

  // 1. Process official sales collection documents
  sales.value.forEach(sale => {
    if (sale.status === 'Cancelled') return; // Skip cancelled sales so they drop from realized revenue

    const sSo = cleanCatalogSku(sale.soNumber).toUpperCase();
    const sOrd = cleanCatalogSku(sale.orderId).toUpperCase();
    const rawOrderDesc = sale.orderId && sale.orderId.includes('•')
      ? sale.orderId.split('•').slice(1).join('•').trim()
      : String(sale.orderId || '');
    const trailingParsed = splitTrailingBoothSku(rawOrderDesc);
    const extractedSku = cleanCatalogSku(trailingParsed.sku || (/^0EJ/i.test(sSo) ? sSo : '')).toUpperCase();
    const extractedUpc = /^(?:HUCK|PDXGL|BB)-/i.test(sSo) ? sSo : '';

    // Prefer locked Multi-Qty Booth Bins when SKU is a known Booth Bin, then explicit saleId, then canonical 4-tier matchMemoryDenInventoryItem (Law #3)
    const linkedItem =
      (sSo && multiBinBySku.get(sSo)) ||
      (extractedSku && multiBinBySku.get(extractedSku)) ||
      (sOrd && multiBinBySku.get(sOrd)) ||
      inventoryItems.value.find(i => i.saleId === sale.$id && !isSoldUnitSplitChild(i)) ||
      inventoryItems.value.find(i =>
        !isSoldUnitSplitChild(i) && (
          (sSo && (cleanCatalogSku(i.locationSku).toUpperCase() === sSo || cleanCatalogSku(i.upc).toUpperCase() === sSo)) ||
          (extractedSku && (cleanCatalogSku(i.locationSku).toUpperCase() === extractedSku || cleanCatalogSku(i.upc).toUpperCase() === extractedSku)) ||
          (sOrd && (cleanCatalogSku(i.locationSku).toUpperCase() === sOrd || cleanCatalogSku(i.upc).toUpperCase() === sOrd))
        )
      ) ||
      matchMemoryDenInventoryItem({
        sku: extractedSku || sSo,
        upc: extractedUpc,
        title: trailingParsed.title || rawOrderDesc,
        price: Number(sale.grossAmount || 0),
        extraText: `${sale.soNumber || ''} ${sale.orderId || ''}`,
        allowPrefixForPayout: true,
        activeItems: inventoryItems.value || [],
        claimedItemIdToSku,
        multiBinResolvedBySku: multiBinBySku,
      }) ||
      inventoryItems.value.find(i => i.saleId === sale.$id) ||
      inventoryItems.value.find(i =>
        (sSo && (cleanCatalogSku(i.locationSku).toUpperCase() === sSo || cleanCatalogSku(i.upc).toUpperCase() === sSo)) ||
        (extractedSku && (cleanCatalogSku(i.locationSku).toUpperCase() === extractedSku || cleanCatalogSku(i.upc).toUpperCase() === extractedSku)) ||
        (sOrd && (cleanCatalogSku(i.locationSku).toUpperCase() === sOrd || cleanCatalogSku(i.upc).toUpperCase() === sOrd))
      );
    const resolvedBinSku = cleanCatalogSku(linkedItem?.locationSku || linkedItem?.sku || sSo).toUpperCase();
    const resolvedUpc = cleanCatalogSku(linkedItem?.upc || sSo).toUpperCase();
    const matchedBinEntry = Object.entries(PREVERIFIED_MD_MULTI_QTY_BINS).find(
      ([skuKey, b]) =>
        skuKey === resolvedBinSku ||
        (resolvedUpc && ((b.upc && b.upc.toUpperCase() === resolvedUpc) || (b.altUpc && b.altUpc.toUpperCase() === resolvedUpc)))
    );
    const isKnownMultiBin = Boolean(matchedBinEntry);
    const isMultiQty = isKnownMultiBin || linkedItem?.isMultiQty || (linkedItem?.quantity && linkedItem.quantity > 1);

    // Resale Invariant: 1 Sale Record = 1 Register Transaction. Dedupe by sale document id ONLY.
    // Never collapse several sales that share an item: depleted multi-qty bins (e.g. HUCK-1219 Shadowrun x4,
    // HUCK-1308 HMM Mid-Tier x2) keep quantity 1 after their last unit sells, so an item-based check would hide real sales.
    if (linkedSaleIds.has(sale.$id)) return;
    linkedSaleIds.add(sale.$id);

    const locName = getWarehouseName(sale.warehouseId);
    const comm = (sale.commissionFee || 0) + (sale.shippingCost || 0);

    const soUpper = (sale.soNumber || '').trim().toUpperCase();
    const ordUpper = (sale.orderId || '').trim().toUpperCase();
    const isCommons = soUpper.startsWith('COMMONS-') || soUpper.startsWith('COMMONS') || ordUpper.includes('[COMMONS]');
    const isBB = !isCommons && (soUpper.startsWith('BB-') || soUpper.startsWith('BB') || (linkedItem?.upc && linkedItem.upc.toUpperCase().startsWith('BB')));
    const isPDXGL = !isCommons && (soUpper.startsWith('PDXGL-') || soUpper.startsWith('PDXGL') || (linkedItem?.upc && linkedItem.upc.toUpperCase().startsWith('PDXGL')));
    const fallbackUpc = (soUpper.startsWith('HUCK-') || soUpper.startsWith('PDXGL-') || soUpper.startsWith('BB-') || soUpper.startsWith('COMMONS-')) ? soUpper : '';

    const inlineCostMatch = String(sale.orderId || '').match(/\[COST:(\d+(?:\.\d+)?)\]/i);
    const inlineManualCost = inlineCostMatch ? Number(inlineCostMatch[1]) : 0;

    let displayTitle = linkedItem?.title;
    if (!displayTitle) {
      if (sale.orderId && !sale.orderId.startsWith('MD-PAYOUT') && !sale.orderId.startsWith('SYNC-')) {
        const rawPart = sale.orderId.includes('•') ? sale.orderId.split('•')[1].trim() : sale.orderId;
        displayTitle = rawPart.replace(/\s*\[COST:\d+(?:\.\d+)?\]\s*/gi, ' ').trim();
      } else if (isCommons) {
        displayTitle = `[COMMONS] Unclaimed Booth Item (${sale.soNumber})`;
      } else if (isBB) {
        displayTitle = `B&B Consignment Item (${sale.soNumber})`;
      } else if (isPDXGL) {
        displayTitle = `PDX Game Library Item (${sale.soNumber})`;
      } else if (sale.soNumber && sale.soNumber.startsWith('HUCK-')) {
        displayTitle = `Huckleberry Item (${sale.soNumber})`;
      } else {
        displayTitle = sale.orderId || ('Order ' + sale.soNumber);
      }
    }

    const partner: PartnerKey = isCommons ? 'COMMONS' : (isBB ? 'BB' : (isPDXGL ? 'PDXGL' : 'HUCK'));
    // Cost basis per sale: single-unit = item cost; multi-qty bin = verified per-unit cost basis ($2.61, $0.81, $4.46, $4.16, etc.); No-SKU quick tag = inlineManualCost; B&B = $0
    let costBasis = 0;
    if (isBB) {
      costBasis = 0;
    } else if (linkedItem) {
      if (isKnownMultiBin) {
        costBasis = resolveMdUnitCostBasis(linkedItem, matchedBinEntry ? matchedBinEntry[0] : resolvedBinSku, true);
      } else {
        const rawCost = Number(linkedItem.cost ?? linkedItem.purchasePrice ?? 0) || 0;
        const itemQty = Math.max(1, Number(linkedItem.quantity || 1));
        costBasis = isMultiQty
          ? resolveMultiQtyCost(rawCost, itemQty, (linkedItem as any).resalePrice || 0).unitCost
          : rawCost;
      }
    } else if (inlineManualCost > 0) {
      costBasis = inlineManualCost;
    }
    const netPayoutVal = Number(sale.netPayout !== undefined ? sale.netPayout : (sale.grossAmount - comm));

    list.push({
      uniqueKey: `sale-${sale.$id}`,
      id: sale.$id,
      soNumber: sale.soNumber || `SO-${sale.$id.slice(-4).toUpperCase()}`,
      orderId: sale.orderId || '',
      title: displayTitle,
      upc: linkedItem?.upc || fallbackUpc,
      sku: linkedItem?.locationSku || linkedItem?.sku || (sale.orderId && !sale.orderId.startsWith('MD-PAYOUT') ? sale.orderId : '') || sale.soNumber || '',
      locationName: locName,
      date: sale.saleDate || sale.$createdAt,
      status: sale.status || 'Sold',
      grossAmount: Number(sale.grossAmount || 0),
      shippingCharged: Number(sale.shippingCharged || 0),
      shippingCost: Number(sale.shippingCost || 0),
      commissionFee: Number(sale.commissionFee || 0),
      fees: comm,
      netPayout: netPayoutVal,
      partner,
      costBasis,
      netProfit: Number((netPayoutVal - costBasis).toFixed(2)),
      itemId: linkedItem?.$id || '',
      itemUrl: linkedItem ? `/item/${linkedItem.$id}` : '',
      cost: costBasis,
      isMultiQty: !!isMultiQty
    });
  });

  return list;
});

// ---- Month + Partner + Location scoping (drives the KPI cards, ledger, and co-op settlements) ----
const monthKeyOf = (dateStr?: string) => pacificMonthKey(dateStr);

const monthOptions = computed(() => {
  const map = new Map<string, number>();
  consolidatedSales.value.forEach(s => {
    const k = monthKeyOf(s.date);
    if (k) map.set(k, (map.get(k) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([key, count]) => {
      return { key, count, label: monthKeyToLabel(key) };
    })
    .sort((a, b) => b.key.localeCompare(a.key));
});

// Default to the NEWEST month present in the loaded sales (sorted desc) — including the open/current month whose payout check isn't cut yet
watch(monthOptions, (opts) => {
  if (!monthDefaulted && opts.length > 0) {
    monthDefaulted = true;
    monthFilter.value = opts[0].key;
  }
}, { immediate: true });

const ricochetConfirmTargetMonthKey = computed(() => {
  const mKeys = ricochetNewBreakdown.value.monthKeys.filter((k) => k && k !== 'unknown');
  if (mKeys.length === 1) return mKeys[0];
  if (monthFilter.value !== 'all') return monthFilter.value;
  return mKeys[0] || 'all';
});

const ricochetConfirmTargetMonthLabel = computed(() => {
  const mKeys = ricochetNewBreakdown.value.monthKeys.filter((k) => k && k !== 'unknown');
  if (mKeys.length > 1) {
    return mKeys.map((k) => monthKeyToLabel(k)).join(' + ');
  }
  const target = ricochetConfirmTargetMonthKey.value;
  return target === 'all' ? 'All Months' : monthKeyToLabel(target);
});

const isStagedRowBoothBin = (row: any): boolean => {
  const cleanSku = String(row?.sku || row?.ricoSku || '').trim().toUpperCase();
  if (cleanSku && PREVERIFIED_MD_MULTI_QTY_BINS[cleanSku]) return true;
  if (row?.matchedItemId) {
    const it = (inventoryItems.value || []).find((i: any) => i.$id === row.matchedItemId);
    if (it && Number(it.quantity || 1) > 1) return true;
  }
  return false;
};

const ricochetPartnerBeforeAfter = computed(() => {
  const targetMonth = ricochetConfirmTargetMonthKey.value;
  const multiMonths = new Set(ricochetNewBreakdown.value.monthKeys.filter((k) => k && k !== 'unknown'));
  const venueCode = activeRicochetVenueMeta.value.code;
  const beforeSales = consolidatedSales.value.filter((s) => {
    const matchesMonth =
      multiMonths.size > 1
        ? multiMonths.has(monthKeyOf(s.date))
        : targetMonth === 'all'
          ? true
          : monthKeyOf(s.date) === targetMonth;
    if (!matchesMonth) return false;
    return matchesLocationFilter({ storageLocation: s.locationName, sellingLocations: [s.locationName] }, venueCode);
  });

  const defs: Array<{ key: 'HUCK' | 'PDXGL' | 'BB'; label: string; badgeCls: string }> = [
    { key: 'HUCK', label: '🫐 HUCK', badgeCls: 'badge-primary' },
    { key: 'PDXGL', label: '🎲 PDXGL', badgeCls: 'badge-accent' },
    { key: 'BB', label: '👗 B&B', badgeCls: 'badge-secondary' },
  ];

  let totBeforeCount = 0;
  let totBeforeGross = 0;
  let totBeforeNet = 0;
  let totAddCount = 0;
  let totAddGross = 0;
  let totAddNet = 0;

  const partners = defs.map((d) => {
    const pBefore = beforeSales.filter((s) => s.partner === d.key);
    const beforeCount = pBefore.length;
    const beforeGross = Number(pBefore.reduce((acc, s) => acc + Number(s.grossAmount || 0), 0).toFixed(2));
    const beforeNet = Number(pBefore.reduce((acc, s) => acc + Number(s.netPayout || 0), 0).toFixed(2));
    const add = ricochetNewBreakdown.value.byPartner[d.key] || { count: 0, gross: 0, net: 0 };
    const addCount = add.count;
    const addGross = add.gross;
    const addNet = add.net;

    totBeforeCount += beforeCount;
    totBeforeGross += beforeGross;
    totBeforeNet += beforeNet;
    totAddCount += addCount;
    totAddGross += addGross;
    totAddNet += addNet;

    return {
      ...d,
      beforeCount,
      beforeGross,
      beforeNet,
      addCount,
      addGross,
      addNet,
      afterCount: beforeCount + addCount,
      afterGross: Number((beforeGross + addGross).toFixed(2)),
      afterNet: Number((beforeNet + addNet).toFixed(2)),
    };
  });

  return {
    partners,
    total: {
      beforeCount: totBeforeCount,
      beforeGross: Number(totBeforeGross.toFixed(2)),
      beforeNet: Number(totBeforeNet.toFixed(2)),
      addCount: totAddCount,
      addGross: Number(totAddGross.toFixed(2)),
      addNet: Number(totAddNet.toFixed(2)),
      afterCount: totBeforeCount + totAddCount,
      afterGross: Number((totBeforeGross + totAddGross).toFixed(2)),
      afterNet: Number((totBeforeNet + totAddNet).toFixed(2)),
    },
  };
});

watch(
  [ricochetActionableNewCount, hasLoadedLiveSalesLedger, isLoadingRicochetSync],
  ([newCount, loaded, syncing]) => {
    if (!pendingAutoOpenConfirmDrawer.value || !loaded || syncing) return;
    if (newCount > 0) {
      const targetMonth = ricochetConfirmTargetMonthKey.value;
      if (targetMonth && targetMonth !== 'all') {
        monthDefaulted = true;
        monthFilter.value = targetMonth;
      }
      confirmGuardAcknowledged.value = false;
      isRicochetConfirmDrawerOpen.value = true;
      pendingAutoOpenConfirmDrawer.value = false;
    } else if (!loading.value) {
      pendingAutoOpenConfirmDrawer.value = false;
      stagedSyncStatusToast.value = {
        type: 'success',
        message: `✅ All staged ${activeRicochetVenueMeta.value.shortName} sales are already recorded in the ledger!`,
      };
    }
  },
  { immediate: true }
);

const PARTNER_LABELS: Record<Exclude<PartnerKey, 'all'>, string> = {
  HUCK: 'Huck (HUCK-)',
  BB: 'B&B (BB-)',
  PDXGL: 'PDXGL (PDXGL-)',
  SWEAT: 'Sweat-Equity (SWEAT-)',
  COMMONS: 'Commons Pool (COMMONS-)'
};

const monthLabel = computed(() => {
  if (monthFilter.value === 'all') return 'All-Time';
  return monthOptions.value.find(m => m.key === monthFilter.value)?.label || monthFilter.value;
});

const scopeLabel = computed(() => {
  const parts = [monthLabel.value];
  if (partnerFilter.value !== 'all') parts.push(PARTNER_LABELS[partnerFilter.value]);
  if (locationFilter.value !== 'all') parts.push(locationFilter.value);
  return parts.join(' · ');
});

// Sales in the active month + location (partner pills show their counts from this set)
const monthLocationSales = computed(() => {
  let list = consolidatedSales.value;
  if (monthFilter.value !== 'all') list = list.filter(s => monthKeyOf(s.date) === monthFilter.value);
  if (locationFilter.value !== 'all') {
    list = list.filter(s => matchesLocationFilter({ storageLocation: s.locationName, sellingLocations: [s.locationName] }, locationFilter.value));
  }
  return list;
});

const partnerCounts = computed(() => {
  const sweatCnt = activeSweatWorkerCount.value || 0;
  const c: Record<string, number> = {
    all: monthLocationSales.value.length + (salesViewTab.value === 'coop' ? sweatCnt : 0),
    HUCK: 0,
    BB: 0,
    PDXGL: 0,
    SWEAT: sweatCnt,
  };
  monthLocationSales.value.forEach(s => { c[s.partner] = (c[s.partner] || 0) + 1; });
  return c;
});

// The active selection: drives KPI cards + ledger
const scopedSales = computed(() => {
  if (partnerFilter.value === 'all') return monthLocationSales.value;
  return monthLocationSales.value.filter(s => s.partner === partnerFilter.value);
});

const totalGross = computed(() => scopedSales.value.reduce((acc, s) => acc + s.grossAmount, 0));
const totalFees = computed(() => scopedSales.value.reduce((acc, s) => acc + s.fees, 0));
const totalNet = computed(() => scopedSales.value.reduce((acc, s) => acc + s.netPayout, 0));

const salesLedgerKpiStats = computed<KpiStatItem[]>(() => [
  {
    label: 'Gross Sales',
    value: formatCurrency(totalGross.value),
    hint: scopeLabel.value,
    icon: 'solar:dollar-bold-duotone',
    tone: 'text-success',
  },
  {
    label: 'Net Payout',
    value: formatCurrency(totalNet.value),
    hint: scopeLabel.value,
    icon: 'solar:wallet-money-bold-duotone',
    tone: 'text-primary',
  },
  {
    label: 'Total Fees',
    value: formatCurrency(totalFees.value),
    hint: scopeLabel.value,
    icon: 'solar:ticket-sale-bold-duotone',
    tone: 'text-error',
  },
  {
    label: 'Items Sold',
    value: String(scopedSales.value.length),
    hint: scopeLabel.value,
    icon: 'solar:box-bold-duotone',
    tone: 'text-info',
  },
]);

// Condensed venue badge, e.g. "Memory Den #0EJ0MZ"
const condenseLocation = (sale: any) => {
  const raw = String(sale.locationName || '').split(/\s[-–—]\s|\(/)[0].trim() || 'Location';
  const name = raw.length > 16 ? raw.slice(0, 15) + '…' : raw;
  const sku = String(sale.sku || '');
  return /^0EJ/i.test(sku) ? `${name} #${sku.toUpperCase()}` : name;
};

const partnerBadge = (p: string) => {
  if (p === 'COMMONS') return { text: '🏛️ COMMONS (100%)', cls: 'badge-warning' };
  if (p === 'BB') return { text: '👗 B&B', cls: 'badge-secondary' };
  if (p === 'PDXGL') return { text: '🎲 PDXGL', cls: 'badge-accent' };
  return { text: '🫐 HUCK', cls: 'badge-primary' };
};

const displayedSales = computed(() => {
  let list = [...scopedSales.value];

  if (onlyUnlinkedFilter.value) {
    list = list.filter(isUnlinkedTicketSale);
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter(s => 
      (s.title || '').toLowerCase().includes(q) ||
      (s.soNumber || '').toLowerCase().includes(q) ||
      (s.upc || '').toLowerCase().includes(q) ||
      (s.sku || '').toLowerCase().includes(q) ||
      (s.locationName || '').toLowerCase().includes(q)
    );
  }

  list.sort((a, b) => {
    let diff = 0;
    if (sortBy.value === 'date') {
      diff = new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
    } else if (sortBy.value === 'so') {
      diff = (a.soNumber || '').localeCompare(b.soNumber || '');
    } else if (sortBy.value === 'net') {
      diff = a.netPayout - b.netPayout;
    } else if (sortBy.value === 'gross') {
      diff = a.grossAmount - b.grossAmount;
    } else if (sortBy.value === 'cost') {
      diff = a.costBasis - b.costBasis;
    } else if (sortBy.value === 'profit') {
      diff = a.netProfit - b.netProfit;
    } else if (sortBy.value === 'location') {
      diff = (a.locationName || '').localeCompare(b.locationName || '');
    } else if (sortBy.value === 'status') {
      diff = (a.status || '').localeCompare(b.status || '');
    }
    return sortDesc.value ? -diff : diff;
  });

  return list;
});

let salesUnsubscribe: (() => void) | null = null;
let whUnsubscribe: (() => void) | null = null;

const initSalesRealtime = () => {
  if (salesUnsubscribe) return;
  const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';

  try {
    salesUnsubscribe = client.subscribe(
      `databases.${DB_ID}.collections.sales.documents`,
      (response) => {
        const isCreate = response.events.some(e => e.includes('.create'));
        const isUpdate = response.events.some(e => e.includes('.update'));
        const isDelete = response.events.some(e => e.includes('.delete'));
        const doc = response.payload as any;
        if (!doc || !doc.$id) return;

        // Filter by tenant
        if (currentTeam.value && doc.tenantId && doc.tenantId !== currentTeam.value.$id) {
          return;
        }

        if (isCreate) {
          if (!sales.value.find(s => s.$id === doc.$id)) {
            sales.value.unshift(doc);
          }
        } else if (isUpdate) {
          const idx = sales.value.findIndex(s => s.$id === doc.$id);
          if (idx !== -1) {
            sales.value[idx] = { ...sales.value[idx], ...doc };
          } else {
            sales.value.unshift(doc);
          }
        } else if (isDelete) {
          sales.value = sales.value.filter(s => s.$id !== doc.$id);
        }
      }
    );

    whUnsubscribe = client.subscribe(
      `databases.${DB_ID}.collections.warehouses.documents`,
      (response) => {
        const isCreate = response.events.some(e => e.includes('.create'));
        const isUpdate = response.events.some(e => e.includes('.update'));
        const isDelete = response.events.some(e => e.includes('.delete'));
        const doc = response.payload as any;
        if (!doc || !doc.$id) return;

        if (currentTeam.value && doc.tenantId && doc.tenantId !== currentTeam.value.$id) return;

        if (isCreate) {
          if (!warehouses.value.find(w => w.$id === doc.$id)) {
            warehouses.value.push(doc);
          }
        } else if (isUpdate) {
          const idx = warehouses.value.findIndex(w => w.$id === doc.$id);
          if (idx !== -1) {
            warehouses.value[idx] = { ...warehouses.value[idx], ...doc };
          }
        } else if (isDelete) {
          warehouses.value = warehouses.value.filter(w => w.$id !== doc.$id);
        }
      }
    );
  } catch (err) {
    console.warn('[SalesList] Realtime subscription warning:', err);
  }
};

const fetchData = async () => {
  if (!currentTeam.value || !capabilities.value.canSeeCollectiveFinancials) return;
  loading.value = true;
  error.value = '';
  try {
    const [salesRes, whRes] = await Promise.all([
      salesApi.listSales(currentTeam.value.$id).catch(() => []),
      warehousesApi.listWarehouses(currentTeam.value.$id).catch(() => []),
      fetchInventory(currentTeam.value.$id).catch(() => [])
    ]);
    sales.value = salesRes;
    warehouses.value = whRes;
    initSalesRealtime();
  } catch (err: any) {
    console.error('Error fetching sales:', err);
    error.value = err.message || 'Failed to load sales data.';
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('unlinked') === '1') {
      onlyUnlinkedFilter.value = true;
      monthFilter.value = 'all';
      partnerFilter.value = 'all';
      monthDefaulted = true;
    }
    if (params.get('confirmRicochet') === '1') {
      pendingAutoOpenConfirmDrawer.value = true;
      params.delete('confirmRicochet');
      params.delete('location');
      const qs = params.toString();
      const cleanUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash || ''}`;
      window.history.replaceState({}, '', cleanUrl);
    }
  }
  if (currentTeam.value) fetchData();
});

onUnmounted(() => {
  if (salesUnsubscribe) {
    salesUnsubscribe();
    salesUnsubscribe = null;
  }
  if (whUnsubscribe) {
    whUnsubscribe();
    whUnsubscribe = null;
  }
});

watch(currentTeam, (n) => {
  if (n) {
    if (salesUnsubscribe) { salesUnsubscribe(); salesUnsubscribe = null; }
    if (whUnsubscribe) { whUnsubscribe(); whUnsubscribe = null; }
    fetchData();
  } else {
    sales.value = [];
    warehouses.value = [];
  }
});
</script>
