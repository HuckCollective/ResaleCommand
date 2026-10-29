<template>
  <div class="space-y-6 pb-36 sm:pb-44">
    <!-- Header -->
    <div
      class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h1
          class="text-3xl sm:text-4xl font-black text-base-content tracking-tight flex items-center gap-3">
          <Icon
            icon="solar:dollar-bold-duotone"
            class="w-8 h-8 sm:w-9 h-9 text-success shrink-0" />
          <span>Sales & Realized Revenue</span>
        </h1>
        <p class="text-sm text-base-content/70 mt-1">
          Track sold items, calculate platform commissions, and monitor net
          payouts across all locations.
        </p>
      </div>
      <div class="flex items-center gap-2 flex-wrap w-full md:w-auto">
        <a
          href="/sales/import"
          class="btn btn-sm sm:btn-md btn-primary gap-1.5 shadow-md shadow-primary/20 font-bold flex-1 sm:flex-initial min-h-[40px]"
          title="Upload & Reconcile Memory Den / POS Payout CSV">
          <Icon icon="solar:import-bold-duotone" class="w-4 h-4 shrink-0" />
          <span>Upload Payout CSV</span>
        </a>
        <a
          href="/warehouse/sync"
          class="btn btn-sm sm:btn-md btn-outline btn-secondary gap-1.5 shadow-xs font-bold flex-1 sm:flex-initial min-h-[40px]">
          <Icon
            icon="solar:round-transfer-horizontal-bold-duotone"
            class="w-4 h-4 shrink-0" />
          <span>Location Sync</span>
        </a>
        <a
          href="/sales/new"
          class="btn btn-sm sm:btn-md btn-primary gap-1.5 shadow-lg shadow-primary/20 font-bold flex-1 sm:flex-initial min-h-[40px]">
          <Icon icon="solar:add-circle-bold" class="w-4 h-4 shrink-0" />
          <span>Record Sale</span>
        </a>
      </div>
    </div>

    <!-- Loader -->
    <div
      v-if="loading && consolidatedSales.length === 0"
      class="flex flex-col items-center justify-center py-16 gap-3">
      <span class="loading loading-spinner loading-lg text-primary"></span>
      <span class="text-xs font-bold opacity-60">Loading Sales Records...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="alert alert-error shadow-sm">
      <Icon icon="solar:danger-circle-bold" class="w-6 h-6 shrink-0" />
      <span>{{ error }}</span>
      <button class="btn btn-xs ml-auto" @click="fetchData">Retry</button>
    </div>

    <!-- Main Content when loaded -->
    <div v-else class="space-y-6">
      <!-- Metrics Overview Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div
          class="bg-base-100 p-3.5 sm:p-5 rounded-2xl border border-base-200 shadow-sm">
          <div class="flex items-center gap-2.5 sm:gap-3">
            <div
              class="p-2.5 sm:p-3 bg-success/10 text-success rounded-xl shrink-0">
              <Icon icon="solar:dollar-bold" class="w-5 h-5 sm:w-6 h-6" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-[11px] uppercase font-bold opacity-60 truncate">
                Gross Sales
              </div>
              <div
                class="text-lg sm:text-2xl font-black font-mono text-success truncate">
                {{ formatCurrency(totalGross) }}
              </div>
              <div
                class="text-[10px] font-semibold opacity-50 truncate"
                :title="scopeLabel">
                {{ scopeLabel }}
              </div>
            </div>
          </div>
        </div>

        <div
          class="bg-base-100 p-3.5 sm:p-5 rounded-2xl border border-base-200 shadow-sm">
          <div class="flex items-center gap-2.5 sm:gap-3">
            <div
              class="p-2.5 sm:p-3 bg-primary/10 text-primary rounded-xl shrink-0">
              <Icon icon="solar:wallet-money-bold" class="w-5 h-5 sm:w-6 h-6" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-[11px] uppercase font-bold opacity-60 truncate">
                Net Payout
              </div>
              <div
                class="text-lg sm:text-2xl font-black font-mono text-primary truncate">
                {{ formatCurrency(totalNet) }}
              </div>
              <div
                class="text-[10px] font-semibold opacity-50 truncate"
                :title="scopeLabel">
                {{ scopeLabel }}
              </div>
            </div>
          </div>
        </div>

        <div
          class="bg-base-100 p-3.5 sm:p-5 rounded-2xl border border-base-200 shadow-sm">
          <div class="flex items-center gap-2.5 sm:gap-3">
            <div
              class="p-2.5 sm:p-3 bg-error/10 text-error rounded-xl shrink-0">
              <Icon icon="solar:ticket-sale-bold" class="w-5 h-5 sm:w-6 h-6" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-[11px] uppercase font-bold opacity-60 truncate">
                Total Fees
              </div>
              <div
                class="text-lg sm:text-2xl font-black font-mono text-error truncate">
                {{ formatCurrency(totalFees) }}
              </div>
              <div
                class="text-[10px] font-semibold opacity-50 truncate"
                :title="scopeLabel">
                {{ scopeLabel }}
              </div>
            </div>
          </div>
        </div>

        <div
          class="bg-base-100 p-3.5 sm:p-5 rounded-2xl border border-base-200 shadow-sm">
          <div class="flex items-center gap-2.5 sm:gap-3">
            <div class="p-2.5 sm:p-3 bg-info/10 text-info rounded-xl shrink-0">
              <Icon icon="solar:box-bold" class="w-5 h-5 sm:w-6 h-6" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-[11px] uppercase font-bold opacity-60 truncate">
                Items Sold
              </div>
              <div
                class="text-lg sm:text-2xl font-black font-mono text-info truncate">
                {{ scopedSales.length }}
              </div>
              <div
                class="text-[10px] font-semibold opacity-50 truncate"
                :title="scopeLabel">
                {{ scopeLabel }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- VIEW TAB SWITCHER (SALES LEDGER VS CO-OP SETTLEMENTS) -->
      <div
        class="flex items-center justify-between gap-3 border-b border-base-200 pb-2">
        <div
          class="join bg-base-200/90 p-1 rounded-2xl shadow-inner w-full sm:w-auto">
          <button
            type="button"
            class="btn btn-sm join-item gap-2 flex-1 sm:flex-initial rounded-xl text-xs font-bold transition-all"
            :class="
              salesViewTab === 'ledger'
                ? 'btn-primary shadow-xs font-black'
                : 'btn-ghost opacity-75'
            "
            @click="salesViewTab = 'ledger'">
            <Icon icon="solar:list-check-bold" class="w-4 h-4" />
            <span>Sales Ledger ({{ scopedSales.length }})</span>
          </button>
          <button
            type="button"
            class="btn btn-sm join-item gap-2 flex-1 sm:flex-initial rounded-xl text-xs font-bold transition-all"
            :class="
              salesViewTab === 'coop'
                ? 'btn-primary shadow-xs font-black'
                : 'btn-ghost opacity-75'
            "
            @click="salesViewTab = 'coop'">
            <Icon
              icon="solar:hand-money-bold-duotone"
              class="w-4 h-4 text-warning" />
            <span>Co-op Settlements (70/30)</span>
          </button>
        </div>
      </div>

      <!-- 1. SALES LEDGER TAB -->
      <div v-show="salesViewTab === 'ledger'" class="space-y-6">
        <!-- SEARCH & CONTROLS TOOLBAR (CLEAN & CONSTRAINED) -->
        <div
          class="card bg-base-100/90 shadow-sm border border-base-200/80 rounded-2xl p-2.5 sm:p-3">
          <div
            class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
            <!-- Left: Constrained Omnibox Search Input + Location Dropdown -->
            <div
              class="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 flex-1">
              <!-- Search Input -->
              <div class="relative flex-1 w-full">
                <Icon
                  icon="solar:magnifer-linear"
                  class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40 pointer-events-none" />
                <input
                  type="text"
                  v-model="searchQuery"
                  placeholder="Search sale by item title, UPC, SKU, SO#..."
                  class="input input-bordered w-full pl-10 pr-16 text-xs sm:text-sm h-10 min-h-10 rounded-xl bg-base-200/50 hover:bg-base-200/70 focus:bg-base-100 border-base-300 focus:border-primary transition-all shadow-inner" />
                <div
                  class="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                  <button
                    v-if="searchQuery"
                    type="button"
                    @click="searchQuery = ''"
                    class="btn btn-ghost btn-circle btn-xs opacity-60 hover:opacity-100 w-6 h-6 min-h-6 flex items-center justify-center font-bold text-xs"
                    title="Clear search">
                    ✕
                  </button>
                  <button
                    type="button"
                    @click="showBarcodeScanner = true"
                    class="btn btn-ghost btn-circle btn-xs text-primary hover:bg-primary/10 transition-colors w-7 h-7 min-h-7 flex items-center justify-center"
                    title="Scan Barcode or Mini QR with Camera"
                    aria-label="Scan barcode or QR with camera">
                    <Icon icon="solar:camera-linear" class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <!-- Month Filter -->
              <div class="relative shrink-0">
                <select
                  v-model="monthFilter"
                  class="select select-bordered text-xs font-bold h-10 min-h-10 rounded-xl bg-base-200/50 hover:bg-base-200/70 focus:bg-base-100 border-base-300 focus:border-primary w-full sm:w-auto pr-8 shadow-2xs"
                  title="Filter the ledger, KPI cards and settlements by month">
                  <option v-for="m in monthOptions" :key="m.key" :value="m.key">
                    {{ m.label }} ({{ m.count }})
                  </option>
                  <option value="all">
                    All-Time ({{ consolidatedSales.length }})
                  </option>
                </select>
              </div>

              <!-- Partner / Member Filter (1-click) -->
              <div
                class="join bg-base-200/70 p-0.5 rounded-xl shadow-inner shrink-0 flex-wrap"
                role="group"
                aria-label="Filter by co-op partner">
                <button
                  type="button"
                  class="btn btn-xs sm:btn-sm join-item rounded-lg font-bold gap-1 whitespace-nowrap transition-all"
                  :class="
                    partnerFilter === 'all'
                      ? 'btn-primary shadow-xs'
                      : 'btn-ghost opacity-75'
                  "
                  @click="partnerFilter = 'all'">
                  All Co-op
                  <span class="badge badge-xs badge-ghost font-mono">{{
                    partnerCounts.all
                  }}</span>
                </button>
                <button
                  type="button"
                  class="btn btn-xs sm:btn-sm join-item rounded-lg font-bold gap-1 whitespace-nowrap transition-all"
                  :class="
                    partnerFilter === 'HUCK'
                      ? 'btn-primary shadow-xs'
                      : 'btn-ghost opacity-75'
                  "
                  @click="partnerFilter = 'HUCK'">
                  🫐 Huck (HUCK-)
                  <span class="badge badge-xs badge-ghost font-mono">{{
                    partnerCounts.HUCK
                  }}</span>
                </button>
                <button
                  type="button"
                  class="btn btn-xs sm:btn-sm join-item rounded-lg font-bold gap-1 whitespace-nowrap transition-all"
                  :class="
                    partnerFilter === 'BB'
                      ? 'btn-secondary shadow-xs'
                      : 'btn-ghost opacity-75'
                  "
                  @click="partnerFilter = 'BB'">
                  👗 B&amp;B (BB-)
                  <span class="badge badge-xs badge-ghost font-mono">{{
                    partnerCounts.BB
                  }}</span>
                </button>
                <button
                  type="button"
                  class="btn btn-xs sm:btn-sm join-item rounded-lg font-bold gap-1 whitespace-nowrap transition-all"
                  :class="
                    partnerFilter === 'PDXGL'
                      ? 'btn-accent shadow-xs'
                      : 'btn-ghost opacity-75'
                  "
                  @click="partnerFilter = 'PDXGL'">
                  🎲 PDXGL (PDXGL-)
                  <span class="badge badge-xs badge-ghost font-mono">{{
                    partnerCounts.PDXGL
                  }}</span>
                </button>
              </div>

              <!-- Location Dropdown Pill -->
              <div class="relative shrink-0">
                <select
                  v-model="locationFilter"
                  class="select select-bordered text-xs font-bold h-10 min-h-10 rounded-xl bg-base-200/50 hover:bg-base-200/70 focus:bg-base-100 border-base-300 focus:border-primary w-full sm:w-auto pr-8 shadow-2xs">
                  <option value="all">All Locations</option>
                  <option
                    v-for="wh in warehouses"
                    :key="wh.$id"
                    :value="wh.name">
                    {{ wh.name }}
                  </option>
                </select>
              </div>
            </div>

            <!-- Right Side: Count Summary -->
            <div
              class="flex items-center gap-2 justify-between sm:justify-end text-xs shrink-0">
              <span class="badge badge-sm badge-ghost font-mono opacity-70">
                {{ displayedSales.length }} record{{
                  displayedSales.length === 1 ? "" : "s"
                }}
              </span>
            </div>
          </div>

          <!-- Sort Control Pills (Mobile Only - Table View uses Column Headers) -->
          <div
            class="flex md:hidden items-center gap-1.5 flex-wrap pt-1 text-xs">
            <span
              class="font-bold opacity-60 mr-1 flex items-center gap-1 whitespace-nowrap shrink-0">
              <Icon
                icon="solar:sort-vertical-linear"
                class="w-3.5 h-3.5 shrink-0" />
              Sort:
            </span>
            <button
              type="button"
              class="btn btn-xs rounded-lg font-bold gap-1 transition-all whitespace-nowrap shrink-0"
              :class="
                sortBy === 'date'
                  ? 'btn-primary shadow-xs'
                  : 'btn-ghost opacity-75'
              "
              @click="toggleSort('date')">
              ⚡ Date
              <span v-if="sortBy === 'date'">{{ sortDesc ? "↓" : "↑" }}</span>
            </button>
            <button
              type="button"
              class="btn btn-xs rounded-lg font-bold gap-1 transition-all whitespace-nowrap shrink-0"
              :class="
                sortBy === 'so'
                  ? 'btn-primary shadow-xs'
                  : 'btn-ghost opacity-75'
              "
              @click="toggleSort('so')">
              # SO#
              <span v-if="sortBy === 'so'">{{ sortDesc ? "↓" : "↑" }}</span>
            </button>
            <button
              type="button"
              class="btn btn-xs rounded-lg font-bold gap-1 transition-all whitespace-nowrap shrink-0"
              :class="
                sortBy === 'net'
                  ? 'btn-primary shadow-xs'
                  : 'btn-ghost opacity-75'
              "
              @click="toggleSort('net')">
              💲 Net
              <span v-if="sortBy === 'net'">{{ sortDesc ? "↓" : "↑" }}</span>
            </button>
            <button
              type="button"
              class="btn btn-xs rounded-lg font-bold gap-1 transition-all whitespace-nowrap shrink-0"
              :class="
                sortBy === 'gross'
                  ? 'btn-primary shadow-xs'
                  : 'btn-ghost opacity-75'
              "
              @click="toggleSort('gross')">
              💲 Gross
              <span v-if="sortBy === 'gross'">{{ sortDesc ? "↓" : "↑" }}</span>
            </button>
          </div>
        </div>

        <!-- Empty State -->
        <div
          v-if="displayedSales.length === 0"
          class="card bg-base-100 shadow-xl border border-base-200">
          <div class="card-body text-center py-16">
            <div class="flex justify-center mb-4">
              <div class="p-4 bg-primary/10 rounded-full text-primary">
                <Icon
                  icon="solar:box-minimalistic-linear"
                  class="w-10 h-10 opacity-60" />
              </div>
            </div>
            <h3 class="text-xl font-bold">No Sales Matching Filter</h3>
            <p class="opacity-70 mt-2 max-w-md mx-auto text-sm">
              {{
                searchQuery || locationFilter !== "all"
                  ? "Try adjusting your search query or location filter."
                  : "Start recording sales or sync from your location booth CSV."
              }}
            </p>
            <div class="mt-6 flex justify-center gap-3">
              <a
                href="/warehouse/sync"
                class="btn btn-outline btn-secondary font-bold"
                >Sync Location CSV</a
              >
              <a href="/sales/new" class="btn btn-primary font-bold"
                >Record First Sale</a
              >
            </div>
          </div>
        </div>

        <!-- 1. MOBILE CARD VIEW (VISIBLE ON MOBILE & TABLET < MD) -->
        <div v-else class="block md:hidden space-y-3 mb-6">
          <div
            v-for="sale in paginatedSales"
            :key="sale.uniqueKey"
            class="card bg-base-100 shadow-md border border-base-200/80 hover:border-primary/40 transition-all rounded-2xl p-3.5 space-y-3">
            <!-- Card Header: SO Number + Price + Status -->
            <div class="flex items-start justify-between gap-2">
              <div class="space-y-1">
                <a
                  :href="`/sales/${sale.id}`"
                  class="btn btn-xs btn-primary text-primary-content font-mono font-black gap-1.5 shadow-xs px-2.5 rounded-lg inline-flex items-center active:scale-95 transition-all"
                  title="Edit Sale">
                  <Icon
                    icon="solar:document-text-bold"
                    class="w-3.5 h-3.5 shrink-0" />
                  <span>{{ sale.soNumber }}</span>
                </a>
                <div
                  class="text-[11px] font-medium opacity-70 flex items-center gap-2 flex-wrap pt-0.5">
                  <span class="flex items-center gap-1" title="Sale Date">
                    <Icon
                      icon="solar:calendar-linear"
                      class="w-3 h-3 text-primary shrink-0" />
                    <span class="whitespace-nowrap">{{
                      formatDate(sale.date)
                    }}</span>
                  </span>
                  <span
                    v-if="formatRelativeTime(sale.date)"
                    class="badge badge-ghost badge-xs font-mono font-bold opacity-80 whitespace-nowrap">
                    {{ formatRelativeTime(sale.date) }}
                  </span>
                </div>
              </div>

              <div class="text-right space-y-1 shrink-0">
                <div
                  class="font-mono font-black text-lg text-success leading-none">
                  {{ formatCurrency(sale.netPayout) }}
                </div>
                <div
                  class="badge badge-sm font-bold"
                  :class="getStatusClass(sale.status)">
                  {{ sale.status }}
                </div>
              </div>
            </div>

            <!-- Item Title & Identifiers -->
            <div class="space-y-1.5">
              <a
                :href="`/sales/${sale.id}`"
                class="font-bold text-sm text-base-content hover:text-primary transition-colors line-clamp-2"
                :title="sale.title">
                {{ sale.title }}
              </a>

              <!-- Chips / Pills: Location, UPC, SKU -->
              <div class="flex items-center gap-1.5 flex-wrap text-xs">
                <span
                  class="badge badge-sm badge-outline font-semibold gap-1 py-2 whitespace-nowrap shrink-0">
                  <Icon
                    icon="solar:shop-2-linear"
                    class="w-3 h-3 opacity-60 shrink-0" />
                  {{ sale.locationName }}
                </span>
                <span
                  class="badge badge-sm font-bold py-2 whitespace-nowrap shrink-0"
                  :class="partnerBadge(sale.partner).cls"
                  >{{ partnerBadge(sale.partner).text }}</span
                >
                <span
                  v-if="sale.sku"
                  class="badge badge-sm badge-secondary badge-outline font-mono text-[10px] font-bold py-2 whitespace-nowrap shrink-0">
                  SKU: {{ sale.sku }}
                </span>
                <span
                  v-if="sale.upc"
                  class="badge badge-sm badge-ghost font-mono text-[10px] opacity-75 py-2 whitespace-nowrap shrink-0">
                  UPC: {{ sale.upc }}
                </span>
              </div>
            </div>

            <!-- Financial Breakdown Bar (Gross, Fees, Net) -->
            <div
              class="grid grid-cols-3 gap-2 bg-base-200/50 rounded-xl p-2.5 text-center text-xs">
              <div>
                <div class="text-[10px] uppercase font-bold opacity-50">
                  Gross
                </div>
                <div class="font-mono font-bold text-base-content">
                  {{ formatCurrency(sale.grossAmount) }}
                </div>
              </div>
              <div class="border-x border-base-200">
                <div class="text-[10px] uppercase font-bold opacity-50">
                  Fees
                </div>
                <div class="font-mono font-bold text-error">
                  -{{ formatCurrency(sale.fees) }}
                </div>
              </div>
              <div>
                <div class="text-[10px] uppercase font-bold opacity-50">
                  Net Payout
                </div>
                <div class="font-mono font-black text-success">
                  {{ formatCurrency(sale.netPayout) }}
                </div>
              </div>
            </div>

            <!-- Touch Actions: Edit Sale + Item Link -->
            <div
              class="flex items-center gap-2 pt-1 border-t border-base-200/60">
              <a
                :href="`/sales/${sale.id}`"
                class="btn btn-sm btn-primary text-primary-content font-bold flex-1 rounded-xl gap-1.5 min-h-[38px] shadow-xs active:scale-95 transition-all"
                title="Edit Sale Details">
                <Icon icon="solar:pen-bold" class="w-4 h-4 shrink-0" />
                <span>Edit Sale</span>
              </a>

              <a
                v-if="sale.itemUrl"
                :href="sale.itemUrl"
                class="btn btn-sm btn-outline btn-secondary font-bold rounded-xl gap-1.5 min-h-[38px] px-3 shrink-0"
                title="View Item Details">
                <Icon
                  icon="solar:box-minimalistic-linear"
                  class="w-4 h-4 shrink-0" />
                <span>Item</span>
              </a>
            </div>
          </div>
        </div>

        <!-- 2. DESKTOP TABLE VIEW (VISIBLE ON MD AND LARGER SCREENS) -->
        <div
          v-if="displayedSales.length > 0"
          class="hidden md:block card bg-base-100 shadow-xl border border-base-200 overflow-hidden mb-6">
          <div class="overflow-x-auto">
            <table class="table table-sm w-full">
              <thead
                class="bg-base-200/70 text-[11px] font-black uppercase tracking-wider text-base-content/80">
                <tr>
                  <th
                    class="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-base-200 transition-colors"
                    @click="toggleSort('so')">
                    <div class="flex items-center gap-1">
                      SO Number
                      <span
                        v-if="sortBy === 'so'"
                        class="text-xs font-black text-primary"
                        >{{ sortDesc ? "▼" : "▲" }}</span
                      >
                    </div>
                  </th>
                  <th class="py-3 px-3">Item &amp; Partner</th>
                  <th
                    class="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-base-200 transition-colors"
                    @click="toggleSort('date')">
                    <div class="flex items-center gap-1">
                      Sale Date
                      <span
                        v-if="sortBy === 'date'"
                        class="text-xs font-black text-primary"
                        >{{ sortDesc ? "▼" : "▲" }}</span
                      >
                    </div>
                  </th>
                  <th
                    class="py-3 px-3 whitespace-nowrap text-right cursor-pointer hover:bg-base-200 transition-colors"
                    @click="toggleSort('gross')">
                    <div class="flex items-center justify-end gap-1">
                      Gross
                      <span
                        v-if="sortBy === 'gross'"
                        class="text-xs font-black text-primary"
                        >{{ sortDesc ? "▼" : "▲" }}</span
                      >
                    </div>
                  </th>
                  <th class="py-3 px-3 whitespace-nowrap text-right">
                    Venue Fee
                  </th>
                  <th
                    class="py-3 px-3 whitespace-nowrap text-right cursor-pointer hover:bg-base-200 transition-colors"
                    @click="toggleSort('net')">
                    <div class="flex items-center justify-end gap-1">
                      Net Payout
                      <span
                        v-if="sortBy === 'net'"
                        class="text-xs font-black text-primary"
                        >{{ sortDesc ? "▼" : "▲" }}</span
                      >
                    </div>
                  </th>
                  <th
                    class="py-3 px-3 whitespace-nowrap text-right cursor-pointer hover:bg-base-200 transition-colors"
                    @click="toggleSort('cost')">
                    <div class="flex items-center justify-end gap-1">
                      Cost Basis
                      <span
                        v-if="sortBy === 'cost'"
                        class="text-xs font-black text-primary"
                        >{{ sortDesc ? "▼" : "▲" }}</span
                      >
                    </div>
                  </th>
                  <th
                    class="py-3 px-3 whitespace-nowrap text-right cursor-pointer hover:bg-base-200 transition-colors"
                    @click="toggleSort('profit')">
                    <div class="flex items-center justify-end gap-1">
                      Net Profit
                      <span
                        v-if="sortBy === 'profit'"
                        class="text-xs font-black text-primary"
                        >{{ sortDesc ? "▼" : "▲" }}</span
                      >
                    </div>
                  </th>
                  <th class="py-3 px-2 w-px">
                    <span class="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="sale in paginatedSales"
                  :key="sale.uniqueKey"
                  class="hover:bg-base-200/40 transition-colors">
                  <!-- SO Number -->
                  <td class="py-2.5 px-3 whitespace-nowrap">
                    <a
                      :href="`/sales/${sale.id}`"
                      class="btn btn-xs btn-primary text-primary-content font-mono font-black px-2 h-7 rounded-lg inline-flex items-center"
                      title="Edit Sale"
                      >{{ sale.soNumber }}</a
                    >
                  </td>

                  <!-- Item & Partner badge + condensed venue -->
                  <td class="py-2.5 px-3">
                    <a
                      :href="`/sales/${sale.id}`"
                      class="font-bold text-xs text-base-content hover:text-primary transition-colors block max-w-[14rem] xl:max-w-sm truncate"
                      :title="sale.title"
                      >{{ sale.title }}</a
                    >
                    <div class="flex items-center gap-1 mt-1 flex-wrap">
                      <span
                        class="badge badge-xs font-bold whitespace-nowrap"
                        :class="partnerBadge(sale.partner).cls"
                        >{{ partnerBadge(sale.partner).text }}</span
                      >
                      <span
                        class="badge badge-xs badge-outline font-semibold whitespace-nowrap"
                        :title="`${sale.locationName}${sale.sku ? ' · ' + sale.sku : ''}`"
                        >{{ condenseLocation(sale) }}</span
                      >
                      <span
                        v-if="sale.upc"
                        class="font-mono text-[10px] opacity-60 whitespace-nowrap"
                        >{{ sale.upc }}</span
                      >
                    </div>
                  </td>

                  <!-- Sale Date -->
                  <td
                    class="py-2.5 px-3 font-mono text-xs opacity-75 whitespace-nowrap">
                    {{ formatDate(sale.date) }}
                  </td>

                  <!-- Gross -->
                  <td
                    class="py-2.5 px-3 text-right font-mono font-bold text-xs whitespace-nowrap">
                    {{ formatCurrency(sale.grossAmount) }}
                  </td>

                  <!-- Venue fee -->
                  <td
                    class="py-2.5 px-3 text-right font-mono text-xs text-error whitespace-nowrap">
                    -{{ formatCurrency(sale.fees) }}
                  </td>

                  <!-- Net payout -->
                  <td
                    class="py-2.5 px-3 text-right font-mono font-black text-xs text-success whitespace-nowrap">
                    {{ formatCurrency(sale.netPayout) }}
                  </td>

                  <!-- Cost basis -->
                  <td
                    class="py-2.5 px-3 text-right font-mono text-xs opacity-80 whitespace-nowrap">
                    {{
                      sale.costBasis > 0 ? formatCurrency(sale.costBasis) : "—"
                    }}
                  </td>

                  <!-- Net profit -->
                  <td
                    class="py-2.5 px-3 text-right font-mono font-black text-xs whitespace-nowrap"
                    :class="
                      sale.netProfit >= 0 ? 'text-success' : 'text-error'
                    ">
                    {{ formatCurrency(sale.netProfit) }}
                  </td>

                  <!-- Actions (icon-only so nothing clips) -->
                  <td class="py-2.5 px-2 whitespace-nowrap">
                    <div class="flex items-center justify-end gap-1">
                      <a
                        :href="`/sales/${sale.id}`"
                        class="btn btn-xs btn-outline btn-primary btn-square rounded-lg h-7 w-7"
                        title="Edit Sale">
                        <Icon icon="solar:pen-bold" class="w-3 h-3 shrink-0" />
                      </a>
                      <a
                        v-if="sale.itemUrl"
                        :href="sale.itemUrl"
                        class="btn btn-xs btn-ghost btn-square text-base-content/70 hover:text-base-content rounded-lg h-7 w-7"
                        title="View Item">
                        <Icon
                          icon="solar:box-minimalistic-linear"
                          class="w-3.5 h-3.5 shrink-0" />
                      </a>
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
          :isFiltered="
            locationFilter !== 'all' ||
            partnerFilter !== 'all' ||
            monthFilter !== 'all' ||
            !!searchQuery
          "
          @scroll-top="scrollToTop">
          <template #dock>
            <!-- Dock Item 1: Location Sync -->
            <a
              href="/warehouse/sync"
              class="h-11 my-auto px-2 sm:px-3 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 bg-base-200/80 hover:bg-secondary/15 text-secondary font-bold border border-secondary/25 shadow-xs active:scale-95 cursor-pointer"
              title="Sync location CSV & sales reports">
              <Icon
                icon="solar:round-transfer-horizontal-bold"
                class="w-4.5 h-4.5 text-secondary" />
              <span
                class="font-extrabold uppercase text-[10px] tracking-tight leading-none whitespace-nowrap"
                >Sync</span
              >
            </a>

            <!-- Dock Item 2: Export CSV -->
            <button
              type="button"
              @click="exportSalesCsv"
              class="h-11 my-auto px-2 sm:px-3 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 bg-base-200/80 hover:bg-base-300 text-base-content font-bold border border-base-content/15 shadow-xs active:scale-95 cursor-pointer"
              title="Export current sales view to CSV">
              <Icon icon="solar:file-download-bold" class="w-4.5 h-4.5" />
              <span
                class="font-extrabold uppercase text-[10px] tracking-tight leading-none whitespace-nowrap"
                >Export CSV</span
              >
            </button>

            <!-- Dock Item 3: Record Sale (Solid Elevated Hero Action) -->
            <a
              href="/sales/new"
              class="h-11 my-auto px-3.5 sm:px-4 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 bg-primary text-primary-content font-black shadow-md border border-primary-content/25 active:scale-95 hover:brightness-110 cursor-pointer"
              title="Record a new completed sale">
              <Icon
                icon="solar:add-circle-bold"
                class="w-4.5 h-4.5 drop-shadow-xs" />
              <span
                class="font-black uppercase text-[10px] sm:text-[11px] tracking-wide leading-none whitespace-nowrap"
                >Record Sale</span
              >
            </a>
          </template>
        </PaginationDock>
      </div>

      <!-- 2. CO-OP SETTLEMENTS TAB -->
      <div v-show="salesViewTab === 'coop'">
        <CoopSettlementView
          :sales="consolidatedSales"
          :period="monthFilter"
          :partner-filter="partnerFilter"
          @update:period="monthFilter = $event" />
      </div>

      <!-- Reusable Camera Barcode & QR Scanner Modal -->
      <BarcodeScannerModal
        :is-open="showBarcodeScanner"
        title="Scan Barcode or Mini QR"
        subtitle="Point camera at any tag or sticker to find sale"
        @close="showBarcodeScanner = false"
        @scan="
          (res) => {
            if (res && res.rawValue) searchQuery = res.rawValue;
          }
        " />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { Icon } from "@iconify/vue";
import CoopSettlementView from "./CoopSettlementView.vue";
import { useAuth } from "../../composables/useAuth";
import { useInventory } from "../../composables/useInventory";
import { resolveMultiQtyCost } from "../../composables/useItemDrawerForm";
import { client } from "../../lib/appwrite";
import { salesApi } from "../../lib/sales";
import {
  warehousesApi,
  matchesLocationFilter,
  findFacility,
} from "../../lib/warehouses";
import PaginationDock from "../common/PaginationDock.vue";
import BarcodeScannerModal from "../common/BarcodeScannerModal.vue";
import type { SaleDocument } from "../../lib/sales";
import type { WarehouseDocument } from "../../lib/warehouses";

const { currentTeam } = useAuth();
const { inventoryItems, fetchInventory } = useInventory();

const sales = ref<SaleDocument[]>([]);
const warehouses = ref<WarehouseDocument[]>([]);
const loading = ref(true);
const error = ref("");
const searchQuery = ref("");
const locationFilter = ref("all");
type PartnerKey = "all" | "HUCK" | "BB" | "PDXGL";
const partnerFilter = ref<PartnerKey>("all");
const monthFilter = ref<string>("all");
let monthDefaulted = false;
const showBarcodeScanner = ref(false);
const salesViewTab = ref<"ledger" | "coop">("ledger");

// Sorting state (PO treatment)
type SortKey =
  | "date"
  | "so"
  | "net"
  | "gross"
  | "location"
  | "status"
  | "cost"
  | "profit";
const sortBy = ref<SortKey>("date");
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

watch(
  [searchQuery, locationFilter, partnerFilter, monthFilter, sortBy, sortDesc],
  () => {
    currentPage.value = 1;
  },
);

const scrollToTop = () => {
  if (typeof window !== "undefined") {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
};

const exportSalesCsv = () => {
  if (!displayedSales.value.length) return;
  const headers = [
    "SO Number",
    "Title",
    "Partner",
    "UPC",
    "SKU",
    "Location",
    "Date",
    "Gross Amount",
    "Fees",
    "Net Payout",
    "Cost Basis",
    "Net Profit",
  ];
  const rows = displayedSales.value.map((s) => [
    `"${(s.soNumber || "").replace(/"/g, '""')}"`,
    `"${(s.title || "").replace(/"/g, '""')}"`,
    `"${(s.partner || "").replace(/"/g, '""')}"`,
    `"${(s.upc || "").replace(/"/g, '""')}"`,
    `"${(s.sku || "").replace(/"/g, '""')}"`,
    `"${(s.locationName || "").replace(/"/g, '""')}"`,
    `"${(s.date || "").replace(/"/g, '""')}"`,
    s.grossAmount?.toFixed(2) || "0.00",
    s.fees?.toFixed(2) || "0.00",
    s.netPayout?.toFixed(2) || "0.00",
    s.costBasis?.toFixed(2) || "0.00",
    s.netProfit?.toFixed(2) || "0.00",
  ]);
  const csvContent =
    "data:text/csv;charset=utf-8," +
    [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute(
    "download",
    `sales_export_${new Date().toISOString().slice(0, 10)}.csv`,
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const toggleSort = (field: SortKey) => {
  if (sortBy.value === field) {
    sortDesc.value = !sortDesc.value;
  } else {
    sortBy.value = field;
    sortDesc.value =
      field === "date" ||
      field === "net" ||
      field === "gross" ||
      field === "profit" ||
      field === "cost";
  }
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? dateStr
      : d.toLocaleDateString("en-US", {
          month: "numeric",
          day: "numeric",
          year: "numeric",
        });
  } catch {
    return dateStr;
  }
};

const formatRelativeTime = (dateStr?: string) => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays > 0 && diffDays < 30) return `${diffDays}d ago`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths > 0 && diffMonths < 12) return `${diffMonths}mo ago`;
    if (diffMonths >= 12) return `${Math.floor(diffMonths / 12)}y ago`;
    return "";
  } catch {
    return "";
  }
};

const getStatusClass = (status: string) => {
  const s = (status || "").toLowerCase();
  if (s === "draft")
    return "badge-neutral text-neutral-content font-bold whitespace-nowrap";
  if (s === "sold" || s === "paid")
    return "badge-success text-success-content font-black whitespace-nowrap";
  if (s === "shipped")
    return "badge-primary text-primary-content font-bold whitespace-nowrap";
  if (s === "delivered")
    return "badge-info text-info-content font-bold whitespace-nowrap";
  if (s === "returned" || s === "refunded")
    return "badge-error text-error-content font-bold whitespace-nowrap";
  return "badge-ghost text-base-content/80 font-bold whitespace-nowrap";
};

const resolveWarehouse = (
  locNameOrId?: string,
): WarehouseDocument | undefined => {
  if (!locNameOrId) return undefined;
  const trimmed = locNameOrId.trim();

  // 1. Match by ID
  const byId = warehouses.value.find((w) => w.$id === trimmed);
  if (byId) return byId;

  // 2. Match by code (MD, DT, HG, HD)
  const byCode = warehouses.value.find(
    (w) => w.code && w.code.toUpperCase() === trimmed.toUpperCase(),
  );
  if (byCode) return byCode;

  // 3. Match via facility helper
  const fac = findFacility(trimmed);
  if (fac) {
    const byFac = warehouses.value.find(
      (w) =>
        (w.code && w.code.toUpperCase() === fac.code.toUpperCase()) ||
        findFacility(w.name)?.code === fac.code,
    );
    if (byFac) return byFac;
  }

  // 4. Match clean name
  const target = trimmed.toLowerCase().replace(/[^a-z0-9]/g, "");
  return warehouses.value.find((w) => {
    const wClean = w.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    return (
      wClean === target || wClean.includes(target) || target.includes(wClean)
    );
  });
};

const getWarehouseName = (warehouseId: string) => {
  const wh = resolveWarehouse(warehouseId);
  return wh ? wh.name : warehouseId || "General Location";
};

const getCommissionRate = (locNameOrId: string) => {
  const wh = resolveWarehouse(locNameOrId);
  return wh?.commissionRate ?? 0;
};

// Consolidated list combining sales collection documents & sold items from inventory
const consolidatedSales = computed(() => {
  const list: any[] = [];
  const linkedSaleIds = new Set<string>();
  const linkedItemIds = new Set<string>();
  const seenSingleItemKeys = new Set<string>();

  // 1. Process official sales collection documents
  sales.value.forEach((sale) => {
    if (sale.status === "Cancelled") return; // Skip cancelled sales so they drop from realized revenue

    const sSo = (sale.soNumber || "").trim().toUpperCase();
    const sOrd = (sale.orderId || "").trim().toUpperCase();
    const linkedItem = inventoryItems.value.find(
      (i) =>
        i.saleId === sale.$id ||
        (sSo &&
          (i.locationSku?.toUpperCase() === sSo ||
            i.upc?.toUpperCase() === sSo)) ||
        (sOrd &&
          (i.locationSku?.toUpperCase() === sOrd ||
            i.upc?.toUpperCase() === sOrd)),
    );
    const isMultiQty =
      linkedItem?.isMultiQty ||
      (linkedItem?.quantity && linkedItem.quantity > 1);

    // Resale Invariant: 1 SKU = 1 Physical Unit = at most 1 Sale (Unless explicitly multi-qty)
    if (linkedSaleIds.has(sale.$id)) return;
    linkedSaleIds.add(sale.$id);

    if (linkedItem && !isMultiQty) {
      if (linkedItemIds.has(linkedItem.$id)) return;
      linkedItemIds.add(linkedItem.$id);
    }

    const locName = getWarehouseName(sale.warehouseId);
    const comm = (sale.commissionFee || 0) + (sale.shippingCost || 0);

    const soUpper = (sale.soNumber || "").trim().toUpperCase();
    const isBB =
      soUpper.startsWith("BB-") ||
      soUpper.startsWith("BB") ||
      (linkedItem?.upc && linkedItem.upc.toUpperCase().startsWith("BB"));
    const isPDXGL =
      soUpper.startsWith("PDXGL-") ||
      soUpper.startsWith("PDXGL") ||
      (linkedItem?.upc && linkedItem.upc.toUpperCase().startsWith("PDXGL"));
    const fallbackUpc =
      soUpper.startsWith("HUCK-") ||
      soUpper.startsWith("PDXGL-") ||
      soUpper.startsWith("BB-")
        ? soUpper
        : "";

    let displayTitle = linkedItem?.title;
    if (!displayTitle) {
      if (
        sale.orderId &&
        !sale.orderId.startsWith("MD-PAYOUT") &&
        !sale.orderId.startsWith("SYNC-")
      ) {
        displayTitle = sale.orderId.includes("•")
          ? sale.orderId.split("•")[1].trim()
          : sale.orderId;
      } else if (isBB) {
        displayTitle = `B&B Consignment Item (${sale.soNumber})`;
      } else if (isPDXGL) {
        displayTitle = `PDX Game Library Item (${sale.soNumber})`;
      } else if (sale.soNumber && sale.soNumber.startsWith("HUCK-")) {
        displayTitle = `Huckleberry Item (${sale.soNumber})`;
      } else {
        displayTitle = sale.orderId || "Order " + sale.soNumber;
      }
    }

    const partner: PartnerKey = isBB ? "BB" : isPDXGL ? "PDXGL" : "HUCK";
    // Cost basis per sale: single-unit = item cost; multi-qty bin = per-unit cost (same rule as the cards/drawer)
    let costBasis = 0;
    if (linkedItem) {
      const rawCost =
        Number(linkedItem.cost ?? linkedItem.purchasePrice ?? 0) || 0;
      const itemQty = Math.max(1, Number(linkedItem.quantity || 1));
      costBasis = isMultiQty
        ? resolveMultiQtyCost(
            rawCost,
            itemQty,
            (linkedItem as any).resalePrice || 0,
          ).unitCost
        : rawCost;
    }
    const netPayoutVal = Number(
      sale.netPayout !== undefined ? sale.netPayout : sale.grossAmount - comm,
    );

    list.push({
      uniqueKey: `sale-${sale.$id}`,
      id: sale.$id,
      soNumber: sale.soNumber || `SO-${sale.$id.slice(-4).toUpperCase()}`,
      orderId: sale.orderId || "",
      title: displayTitle,
      upc: linkedItem?.upc || fallbackUpc,
      sku:
        linkedItem?.locationSku ||
        linkedItem?.sku ||
        (sale.orderId && !sale.orderId.startsWith("MD-PAYOUT")
          ? sale.orderId
          : "") ||
        sale.soNumber ||
        "",
      locationName: locName,
      date: sale.saleDate || sale.$createdAt,
      status: sale.status || "Sold",
      grossAmount: Number(sale.grossAmount || 0),
      fees: comm,
      netPayout: netPayoutVal,
      partner,
      costBasis,
      netProfit: Number((netPayoutVal - costBasis).toFixed(2)),
      itemId: linkedItem?.$id || "",
      itemUrl: linkedItem ? `/item/${linkedItem.$id}` : "",
      cost: costBasis,
      isMultiQty: !!isMultiQty,
    });
  });

  return list;
});

// ---- Month + Partner + Location scoping (drives the KPI cards, ledger, and co-op settlements) ----
const monthKeyOf = (dateStr?: string) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr).slice(0, 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const monthOptions = computed(() => {
  const map = new Map<string, number>();
  consolidatedSales.value.forEach((s) => {
    const k = monthKeyOf(s.date);
    if (k) map.set(k, (map.get(k) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([key, count]) => {
      const [y, m] = key.split("-").map(Number);
      return {
        key,
        count,
        label: new Date(y, (m || 1) - 1, 1).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        }),
      };
    })
    .sort((a, b) => b.key.localeCompare(a.key));
});

// Default to the newest month with real volume (same rule the co-op settlement view uses)
watch(
  monthOptions,
  (opts) => {
    if (!monthDefaulted && opts.length > 0) {
      monthDefaulted = true;
      monthFilter.value = (opts.find((o) => o.count >= 5) || opts[0]).key;
    }
  },
  { immediate: true },
);

const PARTNER_LABELS: Record<Exclude<PartnerKey, "all">, string> = {
  HUCK: "Huck (HUCK-)",
  BB: "B&B (BB-)",
  PDXGL: "PDXGL (PDXGL-)",
};

const monthLabel = computed(() => {
  if (monthFilter.value === "all") return "All-Time";
  return (
    monthOptions.value.find((m) => m.key === monthFilter.value)?.label ||
    monthFilter.value
  );
});

const scopeLabel = computed(() => {
  const parts = [monthLabel.value];
  if (partnerFilter.value !== "all")
    parts.push(PARTNER_LABELS[partnerFilter.value]);
  if (locationFilter.value !== "all") parts.push(locationFilter.value);
  return parts.join(" · ");
});

// Sales in the active month + location (partner pills show their counts from this set)
const monthLocationSales = computed(() => {
  let list = consolidatedSales.value;
  if (monthFilter.value !== "all")
    list = list.filter((s) => monthKeyOf(s.date) === monthFilter.value);
  if (locationFilter.value !== "all") {
    list = list.filter((s) =>
      matchesLocationFilter(
        { storageLocation: s.locationName, sellingLocations: [s.locationName] },
        locationFilter.value,
      ),
    );
  }
  return list;
});

const partnerCounts = computed(() => {
  const c: Record<string, number> = {
    all: monthLocationSales.value.length,
    HUCK: 0,
    BB: 0,
    PDXGL: 0,
  };
  monthLocationSales.value.forEach((s) => {
    c[s.partner] = (c[s.partner] || 0) + 1;
  });
  return c;
});

// The active selection: drives KPI cards + ledger
const scopedSales = computed(() => {
  if (partnerFilter.value === "all") return monthLocationSales.value;
  return monthLocationSales.value.filter(
    (s) => s.partner === partnerFilter.value,
  );
});

const totalGross = computed(() =>
  scopedSales.value.reduce((acc, s) => acc + s.grossAmount, 0),
);
const totalFees = computed(() =>
  scopedSales.value.reduce((acc, s) => acc + s.fees, 0),
);
const totalNet = computed(() =>
  scopedSales.value.reduce((acc, s) => acc + s.netPayout, 0),
);

// Condensed venue badge, e.g. "Memory Den #0EJ0MZ"
const condenseLocation = (sale: any) => {
  const raw =
    String(sale.locationName || "")
      .split(/\s[-–—]\s|\(/)[0]
      .trim() || "Location";
  const name = raw.length > 16 ? raw.slice(0, 15) + "…" : raw;
  const sku = String(sale.sku || "");
  return /^0EJ/i.test(sku) ? `${name} #${sku.toUpperCase()}` : name;
};

const partnerBadge = (p: string) => {
  if (p === "BB") return { text: "👗 B&B", cls: "badge-secondary" };
  if (p === "PDXGL") return { text: "🎲 PDXGL", cls: "badge-accent" };
  return { text: "🫐 HUCK", cls: "badge-primary" };
};

const displayedSales = computed(() => {
  let list = [...scopedSales.value];

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter(
      (s) =>
        (s.title || "").toLowerCase().includes(q) ||
        (s.soNumber || "").toLowerCase().includes(q) ||
        (s.upc || "").toLowerCase().includes(q) ||
        (s.sku || "").toLowerCase().includes(q) ||
        (s.locationName || "").toLowerCase().includes(q),
    );
  }

  list.sort((a, b) => {
    let diff = 0;
    if (sortBy.value === "date") {
      diff = new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
    } else if (sortBy.value === "so") {
      diff = (a.soNumber || "").localeCompare(b.soNumber || "");
    } else if (sortBy.value === "net") {
      diff = a.netPayout - b.netPayout;
    } else if (sortBy.value === "gross") {
      diff = a.grossAmount - b.grossAmount;
    } else if (sortBy.value === "cost") {
      diff = a.costBasis - b.costBasis;
    } else if (sortBy.value === "profit") {
      diff = a.netProfit - b.netProfit;
    } else if (sortBy.value === "location") {
      diff = (a.locationName || "").localeCompare(b.locationName || "");
    } else if (sortBy.value === "status") {
      diff = (a.status || "").localeCompare(b.status || "");
    }
    return sortDesc.value ? -diff : diff;
  });

  return list;
});

let salesUnsubscribe: (() => void) | null = null;
let whUnsubscribe: (() => void) | null = null;

const initSalesRealtime = () => {
  if (salesUnsubscribe) return;
  const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || "resale_db";

  try {
    salesUnsubscribe = client.subscribe(
      `databases.${DB_ID}.collections.sales.documents`,
      (response) => {
        const isCreate = response.events.some((e) => e.includes(".create"));
        const isUpdate = response.events.some((e) => e.includes(".update"));
        const isDelete = response.events.some((e) => e.includes(".delete"));
        const doc = response.payload as any;
        if (!doc || !doc.$id) return;

        // Filter by tenant
        if (
          currentTeam.value &&
          doc.tenantId &&
          doc.tenantId !== currentTeam.value.$id
        ) {
          return;
        }

        if (isCreate) {
          if (!sales.value.find((s) => s.$id === doc.$id)) {
            sales.value.unshift(doc);
          }
        } else if (isUpdate) {
          const idx = sales.value.findIndex((s) => s.$id === doc.$id);
          if (idx !== -1) {
            sales.value[idx] = { ...sales.value[idx], ...doc };
          } else {
            sales.value.unshift(doc);
          }
        } else if (isDelete) {
          sales.value = sales.value.filter((s) => s.$id !== doc.$id);
        }
      },
    );

    whUnsubscribe = client.subscribe(
      `databases.${DB_ID}.collections.warehouses.documents`,
      (response) => {
        const isCreate = response.events.some((e) => e.includes(".create"));
        const isUpdate = response.events.some((e) => e.includes(".update"));
        const isDelete = response.events.some((e) => e.includes(".delete"));
        const doc = response.payload as any;
        if (!doc || !doc.$id) return;

        if (
          currentTeam.value &&
          doc.tenantId &&
          doc.tenantId !== currentTeam.value.$id
        )
          return;

        if (isCreate) {
          if (!warehouses.value.find((w) => w.$id === doc.$id)) {
            warehouses.value.push(doc);
          }
        } else if (isUpdate) {
          const idx = warehouses.value.findIndex((w) => w.$id === doc.$id);
          if (idx !== -1) {
            warehouses.value[idx] = { ...warehouses.value[idx], ...doc };
          }
        } else if (isDelete) {
          warehouses.value = warehouses.value.filter((w) => w.$id !== doc.$id);
        }
      },
    );
  } catch (err) {
    console.warn("[SalesList] Realtime subscription warning:", err);
  }
};

const fetchData = async () => {
  if (!currentTeam.value) return;
  loading.value = true;
  error.value = "";
  try {
    const [salesRes, whRes] = await Promise.all([
      salesApi.listSales(currentTeam.value.$id).catch(() => []),
      warehousesApi.listWarehouses(currentTeam.value.$id).catch(() => []),
      fetchInventory(currentTeam.value.$id).catch(() => []),
    ]);
    sales.value = salesRes;
    warehouses.value = whRes;
    initSalesRealtime();
  } catch (err: any) {
    console.error("Error fetching sales:", err);
    error.value = err.message || "Failed to load sales data.";
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
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
    if (salesUnsubscribe) {
      salesUnsubscribe();
      salesUnsubscribe = null;
    }
    if (whUnsubscribe) {
      whUnsubscribe();
      whUnsubscribe = null;
    }
    fetchData();
  } else {
    sales.value = [];
    warehouses.value = [];
  }
});
</script>
