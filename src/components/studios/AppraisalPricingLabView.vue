<template>
  <div class="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-20 space-y-5">
    <!-- Top Studio Header -->
    <header class="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-base-100 border border-base-300 rounded-2xl p-4 sm:p-5 shadow-xs">
      <div class="space-y-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="badge badge-sm badge-info text-info-content font-black whitespace-nowrap">
            🔬 STUDIOS
          </span>
          <h1 class="text-xl sm:text-2xl font-black tracking-tight text-base-content">
            Appraisal &amp; Pricing Lab
          </h1>
          <span
            v-if="liveRules"
            class="badge badge-xs badge-ghost font-mono font-bold whitespace-nowrap"
          >
            Rules v{{ liveRules.version }}
          </span>
        </div>
        <p class="text-xs sm:text-sm text-base-content/70">
          Closed-loop Estimate-vs-Sold calibration, live venue fee multipliers, and Gemini $40/mo Cloud Credit telemetry.
        </p>
      </div>

      <div class="flex items-center gap-2 flex-wrap shrink-0">
        <select
          v-model.number="windowDays"
          class="select select-bordered select-sm rounded-xl font-bold text-xs bg-base-100"
          aria-label="Calibration lookback window"
          @change="loadAllLabData(true)"
        >
          <option :value="90">Last 90 Days</option>
          <option :value="180">Last 180 Days</option>
          <option :value="365">Last 365 Days</option>
          <option :value="730">All History (2 Yrs)</option>
        </select>

        <button
          type="button"
          class="btn btn-primary btn-sm text-primary-content font-black rounded-xl gap-1.5 shadow-xs"
          @click="isTestbenchOpen = true"
        >
          <Icon icon="solar:test-tube-minimalistic-bold" class="w-4 h-4 shrink-0" />
          <span>Try It Testbench</span>
        </button>

        <button
          type="button"
          class="btn btn-outline btn-sm rounded-xl gap-1.5 font-bold"
          :disabled="loadingLab"
          @click="loadAllLabData(true)"
        >
          <span v-if="loadingLab" class="loading loading-spinner loading-xs"></span>
          <Icon v-else icon="solar:refresh-bold" class="w-4 h-4 shrink-0" />
          <span class="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </header>

    <!-- Error Alert -->
    <div
      v-if="loadError"
      role="alert"
      class="alert alert-error rounded-2xl border border-error/40 text-sm font-semibold"
    >
      <Icon icon="solar:danger-triangle-bold" class="w-5 h-5 shrink-0" />
      <span>{{ loadError }}</span>
      <button type="button" class="btn btn-xs btn-ghost font-bold" @click="loadAllLabData(true)">
        Retry
      </button>
    </div>

    <!-- 4-Tile KPI Top Strip (Reusing Canonical KpiStatGrid) -->
    <KpiStatGrid :items="kpiStats" :columns="4" />

    <!-- 3-Tab Segmented Workbench Bar -->
    <div ref="tabSectionRef" class="scroll-mt-20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-base-300 pb-3">
      <div role="tablist" class="tabs tabs-box bg-base-200/80 p-1 rounded-2xl w-full sm:w-auto">
        <button
          type="button"
          role="tab"
          class="tab text-xs sm:text-sm font-black gap-1.5 rounded-xl px-3 sm:px-4 transition-all"
          :class="activeTab === 'scorecard' ? 'tab-active bg-primary text-primary-content shadow-xs' : 'text-base-content/75'"
          @click="setTab('scorecard')"
        >
          <span>🎯 Truth Scorecard</span>
          <span
            v-if="scorecard"
            class="badge badge-xs font-mono font-black whitespace-nowrap"
            :class="activeTab === 'scorecard' ? 'badge-neutral text-neutral-content' : 'badge-ghost'"
          >
            {{ scorecard.headline.sampleSize }} sold
          </span>
        </button>

        <button
          type="button"
          role="tab"
          class="tab text-xs sm:text-sm font-black gap-1.5 rounded-xl px-3 sm:px-4 transition-all"
          :class="activeTab === 'rules' ? 'tab-active bg-primary text-primary-content shadow-xs' : 'text-base-content/75'"
          @click="setTab('rules')"
        >
          <span>⚙️ Rules &amp; Test</span>
          <span
            v-if="ruleDiffs.length > 0"
            class="badge badge-xs badge-warning text-warning-content font-black whitespace-nowrap"
          >
            {{ ruleDiffs.length }} unsaved
          </span>
        </button>

        <button
          type="button"
          role="tab"
          class="tab text-xs sm:text-sm font-black gap-1.5 rounded-xl px-3 sm:px-4 transition-all"
          :class="activeTab === 'telemetry' ? 'tab-active bg-primary text-primary-content shadow-xs' : 'text-base-content/75'"
          @click="setTab('telemetry')"
        >
          <span>📊 AI Spend &amp; Credits</span>
          <span class="badge badge-xs badge-success text-success-content font-mono font-bold whitespace-nowrap">
            $0 OOP
          </span>
        </button>

        <button
          type="button"
          role="tab"
          class="tab text-xs sm:text-sm font-black gap-1.5 rounded-xl px-3 sm:px-4 transition-all"
          :class="activeTab === 'bookmarklets' ? 'tab-active bg-primary text-primary-content shadow-xs' : 'text-base-content/75'"
          @click="setTab('bookmarklets')"
        >
          <span>🔖 Bookmarklets</span>
          <span
            class="badge badge-xs font-mono font-bold whitespace-nowrap"
            :class="activeTab === 'bookmarklets' ? 'badge-neutral text-neutral-content' : 'badge-ghost'"
          >
            All BMLs
          </span>
        </button>
      </div>

      <div v-if="saveNotice" class="badge badge-success text-success-content font-bold whitespace-nowrap py-3 px-3 gap-1.5">
        <Icon icon="solar:check-circle-bold" class="w-4 h-4 shrink-0" />
        <span>{{ saveNotice }}</span>
      </div>
    </div>

    <!-- Loading Skeleton -->
    <div
      v-if="loadingLab && !scorecard"
      class="card bg-base-100 border border-base-300 rounded-2xl p-6 space-y-4"
    >
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="skeleton h-40 w-full rounded-2xl"></div>
        <div class="skeleton h-40 w-full rounded-2xl"></div>
      </div>
      <div class="skeleton h-56 w-full rounded-2xl"></div>
    </div>

    <!-- =================================================================== -->
    <!-- TAB 1: TRUTH SCORECARD (Default)                                     -->
    <!-- =================================================================== -->
    <section v-else-if="activeTab === 'scorecard'" class="space-y-4">
      <!-- Plain-English Explainer Banner -->
      <div class="bg-base-100 border border-base-300 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div class="space-y-0.5">
          <div class="font-black text-base-content flex items-center gap-1.5 flex-wrap">
            <span>💡 What You Are Looking At:</span>
            <span class="badge badge-xs badge-primary text-primary-content font-bold">AI Price Grade Card &amp; Booth Tuner</span>
          </div>
          <p class="text-base-content/75">
            Compares what your items <strong>actually sold for at the register</strong> against the <strong>AI / tag estimate</strong>.
            <strong>100%</strong> = sold right on target • <strong>138%</strong> = sold for <strong>38% MORE</strong> than estimated (click <strong>Use 1.38x</strong> to raise future AI booth prices!).
          </p>
        </div>
      </div>

      <!-- Low Sample / Link Coverage Guidance Banner -->
      <div
        v-if="scorecard && scorecard.headline.lowConfidence"
        class="bg-warning/15 border border-warning/40 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
      >
        <div class="flex items-start gap-2.5">
          <Icon icon="solar:info-circle-bold" class="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div>
            <p class="font-black text-base-content">
              Building Sales History ({{ scorecard.headline.sampleSize }} sold items scored • 8+ sales needed per category)
            </p>
            <p class="text-base-content/75 mt-0.5">
              Categories with fewer than 8 sold items wait for more sales before suggesting price changes so 1 lucky sale never skews your AI pricing. Register Ticket Match Rate:
              <strong class="font-mono">{{ scorecard.headline.linkCoveragePct }}%</strong>.
            </p>
          </div>
        </div>
        <a href="/sales" class="btn btn-xs btn-warning text-warning-content font-bold rounded-lg shrink-0 whitespace-nowrap">
          Reconcile Sales ➔
        </a>
      </div>

      <!-- Venue & Category Segment Ribbons -->
      <div v-if="scorecard && (scorecard.byVenue.length > 0 || scorecard.byCategory.length > 0)" class="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <!-- By Venue -->
        <div class="card bg-base-100 border border-base-300 rounded-2xl p-4 space-y-2.5">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-xs uppercase tracking-wider font-extrabold text-base-content/70">
              Actual Sold vs. Estimate by Booth / Venue
            </h2>
            <span class="badge badge-xs badge-ghost font-mono whitespace-nowrap">Tap row to filter table</span>
          </div>
          <div class="space-y-2">
            <div
              v-for="seg in scorecard.byVenue"
              :key="seg.key"
              class="flex items-center justify-between gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all"
              :class="venueFilter === seg.key ? 'bg-primary/15 border-primary shadow-2xs' : 'bg-base-200/60 border-base-300/70 hover:border-primary/40'"
              @click="toggleVenueFilter(seg.key)"
            >
              <div class="min-w-0">
                <div class="font-bold text-base-content truncate flex items-center gap-1.5">
                  <span>{{ seg.label }}</span>
                  <span v-if="venueFilter === seg.key" class="badge badge-2xs badge-primary text-primary-content font-bold">Filtered ✕</span>
                </div>
                <div class="text-[11px] text-base-content/65 font-mono">
                  <template v-if="seg.suppressed">
                    ⏳ {{ seg.sampleSize }} of 8 sold — need {{ seg.neededMoreCount }} more sales to unlock %
                  </template>
                  <template v-else>
                    {{ seg.sampleSize }} sold • Typical range: {{ seg.iqrLowPct }}%–{{ seg.iqrHighPct }}%
                    <span v-if="seg.medianDaysToSell !== null"> • ~{{ seg.medianDaysToSell }}d to sell</span>
                  </template>
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span
                  v-if="!seg.suppressed && seg.medianRealizationPct !== null"
                  class="badge badge-sm font-mono font-black whitespace-nowrap"
                  :class="getRealizationBadgeClass(seg.medianRealizationPct)"
                >
                  {{ seg.medianRealizationPct }}%
                </span>
                <span v-else class="badge badge-xs badge-ghost font-mono whitespace-nowrap">
                  {{ seg.sampleSize }} sold
                </span>
                <button
                  v-if="!seg.suppressed && seg.suggestedMultiplier && isPhysicalVenueCode(seg.key)"
                  type="button"
                  class="btn btn-2xs btn-outline rounded-lg font-mono font-bold"
                  :title="'Stage suggested ' + seg.suggestedMultiplier + 'x multiplier in Rules tab'"
                  @click.stop="stageSuggestedVenueMultiplier(seg.key, seg.suggestedMultiplier)"
                >
                  Use {{ seg.suggestedMultiplier.toFixed(2) }}x
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- By Category -->
        <div class="card bg-base-100 border border-base-300 rounded-2xl p-4 space-y-2.5">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-xs uppercase tracking-wider font-extrabold text-base-content/70">
              Actual Sold vs. Estimate by Category
            </h2>
            <span class="badge badge-xs badge-ghost font-mono whitespace-nowrap">Tap category to filter table</span>
          </div>
          <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
            <div
              v-for="cat in scorecard.byCategory.slice(0, 6)"
              :key="cat.key"
              class="flex items-center justify-between gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all"
              :class="categoryFilter === cat.key ? 'bg-primary/15 border-primary shadow-2xs' : 'bg-base-200/60 border-base-300/70 hover:border-primary/40'"
              @click="toggleCategoryFilter(cat.key)"
            >
              <div class="min-w-0">
                <div class="font-bold text-base-content truncate flex items-center gap-1.5">
                  <span>{{ cat.label }}</span>
                  <span v-if="categoryFilter === cat.key" class="badge badge-2xs badge-primary text-primary-content font-bold">Filtered ✕</span>
                </div>
                <div class="text-[11px] text-base-content/65 font-mono">
                  <template v-if="cat.suppressed">
                    ⏳ {{ cat.sampleSize }} of 8 sold — need {{ cat.neededMoreCount }} more sales to unlock %
                  </template>
                  <template v-else>
                    {{ cat.sampleSize }} sold • Typical: {{ cat.iqrLowPct }}%–{{ cat.iqrHighPct }}% • Avg Net ${{ (cat.medianNetUsd || 0).toFixed(2) }}
                  </template>
                </div>
              </div>
              <span
                v-if="!cat.suppressed && cat.medianRealizationPct !== null"
                class="badge badge-sm font-mono font-black whitespace-nowrap shrink-0"
                :class="getRealizationBadgeClass(cat.medianRealizationPct)"
              >
                {{ cat.medianRealizationPct }}%
              </span>
              <span v-else class="badge badge-xs badge-ghost font-mono whitespace-nowrap shrink-0">
                {{ cat.sampleSize }} sold
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Filter Chips + Venue, Category & Search Bar -->
      <div class="card bg-base-100 border border-base-300 rounded-2xl p-3.5 space-y-3">
        <div class="flex items-center gap-1.5 flex-wrap">
          <button
            v-for="chip in filterChipOptions"
            :key="chip.key"
            type="button"
            class="btn btn-xs rounded-xl font-bold gap-1"
            :class="scorecardFilter === chip.key ? 'btn-primary text-primary-content' : 'btn-ghost bg-base-200/70'"
            @click="setScorecardFilter(chip.key)"
          >
            <span>{{ chip.label }}</span>
            <span class="font-mono opacity-80">({{ chip.count }})</span>
          </button>
        </div>

        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div class="join flex-1 shadow-2xs">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search item title, UPC, category, or booth SKU..."
              class="input input-bordered input-sm join-item w-full bg-base-100 text-xs"
              @input="currentPage = 1"
            />
            <button
              v-if="searchQuery"
              type="button"
              class="btn btn-ghost btn-sm join-item"
              aria-label="Clear search"
              @click="searchQuery = ''; currentPage = 1"
            >
              ✕
            </button>
          </div>

          <select
            v-model="categoryFilter"
            class="select select-bordered select-sm rounded-xl text-xs font-bold bg-base-100 sm:w-48"
            aria-label="Filter by category"
            @change="currentPage = 1"
          >
            <option value="ALL">All Categories</option>
            <option v-for="c in availableCategoryFilters" :key="c.key" :value="c.key">
              {{ c.label }} ({{ c.count }})
            </option>
          </select>

          <select
            v-model="venueFilter"
            class="select select-bordered select-sm rounded-xl text-xs font-bold bg-base-100 sm:w-48"
            aria-label="Filter by venue"
            @change="currentPage = 1"
          >
            <option value="ALL">All Venues &amp; Channels</option>
            <option v-for="v in availableVenueFilters" :key="v.code" :value="v.code">
              {{ v.label }}
            </option>
          </select>

          <button
            v-if="isTableFiltered"
            type="button"
            class="btn btn-xs btn-ghost border border-base-300 rounded-xl font-bold whitespace-nowrap"
            @click="resetAllTableFilters"
          >
            Reset Filters ✕
          </button>
        </div>
      </div>

      <!-- View Mode A: Aged Unsold >90d Over-Estimate Candidates -->
      <div
        v-if="scorecardFilter === 'aged_unsold'"
        class="card bg-base-100 border border-base-300 rounded-2xl overflow-hidden shadow-xs"
      >
        <div class="px-4 py-3 border-b border-base-200 flex items-center justify-between gap-2 bg-base-200/40">
          <span class="text-xs font-black text-base-content">
            ⏳ Aged Unsold Stock &gt; 90 Days (Tap any row to open ItemDrawer &amp; re-price)
          </span>
          <span class="badge badge-xs badge-warning text-warning-content font-mono font-bold whitespace-nowrap">
            {{ filteredAgedRows.length }} items
          </span>
        </div>
        <div class="overflow-x-auto">
          <table class="table table-sm w-full">
            <thead>
              <tr class="text-[11px] uppercase tracking-wider text-base-content/65 bg-base-200/30">
                <th>Item</th>
                <th>Venue</th>
                <th class="text-right">Age</th>
                <th class="text-right">Scout Mid</th>
                <th class="text-right">Tagged</th>
                <th class="text-right">Cost Basis</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="paginatedAgedRows.length === 0">
                <td colspan="6" class="text-center py-8 text-xs text-base-content/60">
                  No aged unsold items (&gt;90d) match the current filter.
                </td>
              </tr>
              <tr
                v-for="row in paginatedAgedRows"
                :key="row.itemId"
                class="hover:bg-base-200/60 cursor-pointer transition-colors"
                @click="openItemInDrawer(row.itemId)"
              >
                <td class="max-w-xs">
                  <div class="flex items-center gap-2.5">
                    <ItemThumbnail :item="row" size="sm" rounded="lg" />
                    <div class="min-w-0">
                      <div class="font-bold text-xs text-base-content truncate" :title="row.title">{{ row.title }}</div>
                      <div class="flex items-center gap-1.5 flex-wrap mt-0.5 text-[10px] font-mono text-base-content/60">
                        <span>{{ row.upc || row.itemId.slice(0, 8) }}</span>
                        <span class="badge badge-2xs badge-ghost font-sans font-bold whitespace-nowrap">{{ row.category }}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="badge badge-xs badge-ghost font-mono font-bold whitespace-nowrap">{{ row.venueCode }}</span>
                </td>
                <td class="text-right font-mono text-xs font-black text-warning">{{ row.ageDays }}d</td>
                <td class="text-right font-mono text-xs">
                  {{ row.scoutMidpoint ? '$' + row.scoutMidpoint.toFixed(2) : '—' }}
                </td>
                <td class="text-right font-mono text-xs font-bold">${{ row.taggedPrice.toFixed(2) }}</td>
                <td class="text-right font-mono text-xs text-base-content/70">${{ row.cost.toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- View Mode B: Multi-Qty Booth Bins Sell-Through -->
      <div
        v-else-if="scorecardFilter === 'booth_bins'"
        class="card bg-base-100 border border-base-300 rounded-2xl overflow-hidden shadow-xs"
      >
        <div class="px-4 py-3 border-b border-base-200 flex items-center justify-between gap-2 bg-base-200/40">
          <span class="text-xs font-black text-base-content">
            📦 Booth Bin (Multi-Qty) Sell-Through — Isolated from 1-of-1 Appraisal Accuracy (Rule C2)
          </span>
          <span class="badge badge-xs badge-secondary text-secondary-content font-mono font-bold whitespace-nowrap">
            {{ filteredBinRows.length }} bins
          </span>
        </div>
        <div class="overflow-x-auto">
          <table class="table table-sm w-full">
            <thead>
              <tr class="text-[11px] uppercase tracking-wider text-base-content/65 bg-base-200/30">
                <th>Booth Bin SKU</th>
                <th>Venue</th>
                <th class="text-right">Stocked</th>
                <th class="text-right">Units Sold</th>
                <th class="text-right">Sell-Through</th>
                <th class="text-right">Median Unit $</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="paginatedBinRows.length === 0">
                <td colspan="6" class="text-center py-8 text-xs text-base-content/60">
                  No multi-quantity Booth Bins match the current filter.
                </td>
              </tr>
              <tr
                v-for="bin in paginatedBinRows"
                :key="bin.itemId + ':' + bin.sku"
                class="hover:bg-base-200/60 cursor-pointer transition-colors"
                @click="openItemInDrawer(bin.itemId)"
              >
                <td class="max-w-xs">
                  <div class="flex items-center gap-2.5">
                    <ItemThumbnail :item="bin" size="sm" rounded="lg" />
                    <div class="min-w-0">
                      <div class="font-bold text-xs text-base-content truncate" :title="bin.title">{{ bin.title }}</div>
                      <div class="text-[10px] font-mono text-base-content/60">
                        {{ bin.sku }} <span v-if="bin.upc">• {{ bin.upc }}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="badge badge-xs badge-ghost font-mono font-bold whitespace-nowrap">{{ bin.venueCode }}</span>
                </td>
                <td class="text-right font-mono text-xs">{{ bin.unitsStocked }}</td>
                <td class="text-right font-mono text-xs font-bold text-success">{{ bin.unitsSold }}</td>
                <td class="text-right font-mono text-xs font-black">{{ bin.sellThroughPct }}%</td>
                <td class="text-right font-mono text-xs font-bold">${{ bin.medianUnitPrice.toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- View Mode C (Default): 6-Column Estimate-vs-Sold Truth Scorecard -->
      <div
        v-else
        class="card bg-base-100 border border-base-300 rounded-2xl overflow-hidden shadow-xs"
      >
        <div class="px-4 py-3 border-b border-base-200 flex items-center justify-between gap-2 bg-base-200/40">
          <span class="text-xs font-black text-base-content">
            🎯 Scored Sales vs. Initial Speed Scout (Tap any row to inspect in ItemDrawer)
          </span>
          <span class="text-[11px] font-mono text-base-content/65">
            Showing {{ paginatedScoredRows.length }} of {{ filteredScoredRows.length }} sold
          </span>
        </div>

        <div class="overflow-x-auto">
          <table class="table table-sm w-full">
            <thead>
              <tr class="text-[11px] uppercase tracking-wider text-base-content/65 bg-base-200/30">
                <th>Item</th>
                <th class="text-right">Scout Said</th>
                <th class="text-right">You Tagged</th>
                <th class="text-right">It Sold For</th>
                <th class="text-right">Sold vs Est</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="paginatedScoredRows.length === 0">
                <td colspan="6" class="text-center py-10 space-y-2">
                  <p class="text-xs font-bold text-base-content/75">
                    No scored sold items match this filter yet.
                  </p>
                  <p class="text-[11px] text-base-content/60 max-w-md mx-auto">
                    Click "Reset Filters" above or choose another Category / Venue to view all scored sales.
                  </p>
                </td>
              </tr>
              <tr
                v-for="row in paginatedScoredRows"
                :key="row.id"
                class="hover:bg-base-200/60 cursor-pointer transition-colors"
                @click="openItemInDrawer(row.itemId)"
              >
                <td class="max-w-[260px] sm:max-w-sm">
                  <div class="flex items-center gap-2.5">
                    <ItemThumbnail :item="row" size="sm" rounded="lg" />
                    <div class="min-w-0">
                      <div class="font-bold text-xs text-base-content truncate" :title="row.title">
                        {{ row.title }}
                      </div>
                      <div class="flex items-center gap-1.5 flex-wrap mt-0.5 text-[10px] font-mono text-base-content/60">
                        <span>{{ row.venueCode }}</span>
                        <span v-if="row.upc">• {{ row.upc }}</span>
                        <span v-if="row.locationSku">• {{ row.locationSku }}</span>
                        <span class="badge badge-2xs badge-ghost font-sans font-bold whitespace-nowrap">
                          {{ row.category }}
                        </span>
                        <span
                          v-if="row.kind === 'split_lot'"
                          class="badge badge-2xs badge-secondary text-secondary-content font-bold whitespace-nowrap"
                        >
                          ✂️ Split Lot ({{ row.soldChildCount }}/{{ row.childCount }})
                        </span>
                      </div>
                    </div>
                  </div>
                </td>
                <td class="text-right font-mono text-xs whitespace-nowrap">
                  <div class="font-bold text-base-content">${{ row.scoutMidpoint.toFixed(0) }}</div>
                  <div class="text-[10px] text-base-content/55">
                    ${{ row.scoutLow.toFixed(0) }}–${{ row.scoutHigh.toFixed(0) }}
                  </div>
                </td>
                <td class="text-right font-mono text-xs whitespace-nowrap">
                  {{ row.taggedPrice > 0 ? '$' + row.taggedPrice.toFixed(2) : '—' }}
                </td>
                <td class="text-right font-mono text-xs whitespace-nowrap">
                  <div class="font-black text-success">${{ row.soldUnitGross.toFixed(2) }}</div>
                  <div class="text-[10px] text-base-content/60">Net ${{ row.soldUnitNet.toFixed(2) }}</div>
                </td>
                <td class="text-right font-mono text-xs font-black whitespace-nowrap">
                  <span :class="getRealizationTextClass(row.realizationPct)">
                    {{ row.realizationPct }}%
                  </span>
                </td>
                <td class="whitespace-nowrap">
                  <span
                    v-if="row.chip === 'on_target'"
                    class="badge badge-xs badge-success text-success-content font-bold whitespace-nowrap"
                  >
                    🎯 On Target
                  </span>
                  <span
                    v-else-if="row.chip === 'under_priced_gem'"
                    class="badge badge-xs badge-info text-info-content font-bold whitespace-nowrap"
                  >
                    💎 Sold Higher (&gt;115%)
                  </span>
                  <span
                    v-else
                    class="badge badge-xs badge-warning text-warning-content font-bold whitespace-nowrap"
                  >
                    ⚠️ Sold Lower (&lt;85%)
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Excluded / Why Ledger Reconciliation Footer (Rule C10) -->
      <div
        v-if="scorecard"
        class="bg-base-200/60 border border-base-300 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-base-content/75"
      >
        <div class="font-bold text-base-content flex items-center gap-1.5">
          <Icon icon="solar:shield-check-bold" class="w-4 h-4 text-primary shrink-0" />
          <span>Excluded from 1-of-1 Accuracy % (Why):</span>
        </div>
        <div class="flex items-center gap-2 flex-wrap font-mono text-[11px]">
          <span class="badge badge-xs badge-ghost whitespace-nowrap">
            📦 Booth Bin units: {{ scorecard.excludedBreakdown.boothBinUnits }}
          </span>
          <span class="badge badge-xs badge-ghost whitespace-nowrap">
            🧾 Unlinked tickets: {{ scorecard.excludedBreakdown.unlinkedTickets }}
          </span>
          <span class="badge badge-xs badge-ghost whitespace-nowrap">
            🕵️ No pre-buy AI est: {{ scorecard.excludedBreakdown.missingPreBuyEstimate }}
          </span>
          <span class="badge badge-xs badge-ghost whitespace-nowrap">
            ✂️ Partial split lots: {{ scorecard.excludedBreakdown.inProgressSplitLots }}
          </span>
          <span class="badge badge-xs badge-ghost whitespace-nowrap">
            📅 Outside {{ windowDays }}d: {{ scorecard.excludedBreakdown.outsideDateWindow }}
          </span>
        </div>
      </div>
    </section>

    <!-- =================================================================== -->
    <!-- TAB 2: RULES & TEST (`ai_appraisal_rules_v1`)                        -->
    <!-- =================================================================== -->
    <section v-else-if="activeTab === 'rules' && draftRules" class="space-y-4">
      <!-- Compiled Prompt Preview (`<= 600 chars / ~150 tokens`) -->
      <div class="card bg-base-100 border border-base-300 rounded-2xl p-4 space-y-2 shadow-xs">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="flex items-center gap-2">
            <Icon icon="solar:code-square-bold-duotone" class="w-5 h-5 text-primary shrink-0" />
            <h2 class="text-sm font-black text-base-content">
              Live Prompt Injection Preview (Injected into Speed Scout &amp; Price Estimator)
            </h2>
          </div>
          <span
            class="badge badge-xs font-mono font-bold whitespace-nowrap"
            :class="promptPreviewText.length <= 600 ? 'badge-success text-success-content' : 'badge-warning text-warning-content'"
          >
            {{ promptPreviewText.length }} / 600 chars (~{{ Math.ceil(promptPreviewText.length / 4) }} tokens)
          </span>
        </div>
        <pre class="bg-base-200/80 border border-base-300 rounded-xl p-3 text-[11px] font-mono whitespace-pre-wrap break-words text-base-content/85">{{ promptPreviewText }}</pre>
        <p class="text-[11px] text-base-content/60">
          ⏱️ ✅ Saved rules apply across all new scans within 5 minutes.
        </p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- 3-Tier ROI Multipliers + Online Channel Fees -->
        <div class="card bg-base-100 border border-base-300 rounded-2xl p-4 space-y-4 shadow-xs">
          <div>
            <h3 class="text-sm font-black text-base-content">
              🎯 3-Tier Max Bid ROI Multipliers
            </h3>
            <p class="text-xs text-base-content/65">
              Divides net payout after venue fees to compute Conservative, Balanced, and Aggressive Max Bid ceilings.
            </p>
          </div>

          <div class="grid grid-cols-3 gap-2.5">
            <label class="form-control">
              <span class="label-text text-[11px] font-bold mb-1">🛡️ Conservative (x)</span>
              <input
                v-model.number="draftRules.roiTargets.conservative"
                type="text"
                inputmode="decimal"
                class="input input-bordered input-sm font-mono font-bold bg-base-100"
              />
            </label>
            <label class="form-control">
              <span class="label-text text-[11px] font-bold mb-1">⚖️ Balanced (x)</span>
              <input
                v-model.number="draftRules.roiTargets.balanced"
                type="text"
                inputmode="decimal"
                class="input input-bordered input-sm font-mono font-bold bg-base-100"
              />
            </label>
            <label class="form-control">
              <span class="label-text text-[11px] font-bold mb-1">🔥 Aggressive (x)</span>
              <input
                v-model.number="draftRules.roiTargets.aggressive"
                type="text"
                inputmode="decimal"
                class="input input-bordered input-sm font-mono font-bold bg-base-100"
              />
            </label>
          </div>

          <div class="divider my-0"></div>

          <div>
            <h3 class="text-sm font-black text-base-content">
              🌐 Online Marketplace Fee Guardrails
            </h3>
            <p class="text-xs text-base-content/65">
              Physical booth commissions read live from Location Settings; configure external online fee rates here.
            </p>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <label class="form-control">
              <span class="label-text text-[11px] font-bold mb-1">eBay Fee %</span>
              <input
                v-model.number="draftRules.channelFees.ebayPct"
                type="text"
                inputmode="decimal"
                class="input input-bordered input-sm font-mono bg-base-100"
              />
            </label>
            <label class="form-control">
              <span class="label-text text-[11px] font-bold mb-1">eBay Fixed $</span>
              <input
                v-model.number="draftRules.channelFees.ebayFixedUsd"
                type="text"
                inputmode="decimal"
                class="input input-bordered input-sm font-mono bg-base-100"
              />
            </label>
            <label class="form-control">
              <span class="label-text text-[11px] font-bold mb-1">Poshmark %</span>
              <input
                v-model.number="draftRules.channelFees.poshmarkPct"
                type="text"
                inputmode="decimal"
                class="input input-bordered input-sm font-mono bg-base-100"
              />
            </label>
            <label class="form-control">
              <span class="label-text text-[11px] font-bold mb-1">Posh &lt;$15 Flat</span>
              <input
                v-model.number="draftRules.channelFees.poshmarkUnder15FlatUsd"
                type="text"
                inputmode="decimal"
                class="input input-bordered input-sm font-mono bg-base-100"
              />
            </label>
          </div>
        </div>

        <!-- Dynamic Physical Booth Calibration Multipliers (Law 2: Driven by warehouses.ts) -->
        <div class="card bg-base-100 border border-base-300 rounded-2xl p-4 space-y-3 shadow-xs">
          <div class="flex items-center justify-between gap-2">
            <div>
              <h3 class="text-sm font-black text-base-content">
                🏪 Retail Booth Shelf Multipliers
              </h3>
              <p class="text-xs text-base-content/65">
                Scales Boutique tag estimates per physical booth (`1.00` = neutral, `0.90` = -10% trim, `1.10` = +10% lift).
              </p>
            </div>
            <a href="/settings" class="btn btn-xs btn-ghost font-bold text-primary whitespace-nowrap">
              Booth Fees ↗
            </a>
          </div>

          <div class="space-y-2.5">
            <div
              v-for="booth in retailBoothMetas"
              :key="booth.code"
              class="p-3 rounded-xl bg-base-200/60 border border-base-300/80 flex items-center justify-between gap-3"
            >
              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="text-base leading-none">{{ booth.icon }}</span>
                  <span class="font-bold text-xs text-base-content truncate">{{ booth.displayName }}</span>
                  <span class="badge badge-2xs badge-ghost font-mono whitespace-nowrap">{{ booth.code }}</span>
                </div>
                <div class="text-[11px] text-base-content/65 font-mono mt-0.5">
                  {{ booth.commissionRate }}% fee • ${{ booth.monthlyRent.toFixed(2) }}/mo rent
                </div>
              </div>

              <div class="flex items-center gap-2 shrink-0">
                <input
                  v-model.number="draftRules.venueBias[booth.code]"
                  type="text"
                  inputmode="decimal"
                  class="input input-bordered input-sm w-24 font-mono font-black text-right bg-base-100"
                />
                <span class="text-xs font-mono font-bold text-base-content/65">x</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Sourcing Domain Guardrails (Cloud-Stored in manifests/ai_appraisal_rules_v1) -->
      <div
        v-if="draftRules.domainProfiles"
        class="card bg-base-100 border border-base-300 rounded-2xl p-4 space-y-3 shadow-xs"
      >
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h3 class="text-sm font-black text-base-content">
              🧭 Sourcing Domain Guardrails &amp; Combined Shipping
            </h3>
            <p class="text-xs text-base-content/65">
              Global camera <code>/scout</code> stays 100% free of online auction bias. Combined shipping is enabled for ShopGoodwill only by default and bucketed by domain tracker prefix.
            </p>
          </div>
          <span class="badge badge-sm badge-primary text-primary-content font-bold">
            Cloud Synced
          </span>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
          <div
            v-for="domKey in editableDomainKeys"
            :key="domKey"
            class="p-3 rounded-xl bg-base-200/50 border border-base-300 space-y-2"
          >
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="text-base leading-none">{{ draftRules.domainProfiles[domKey].icon }}</span>
                <span class="text-xs font-black text-base-content">
                  {{ draftRules.domainProfiles[domKey].label }}
                </span>
                <span class="badge badge-2xs badge-neutral font-mono font-bold">
                  {{ draftRules.domainProfiles[domKey].trackerPrefix }}-
                </span>
              </div>

              <label
                v-if="domKey !== 'in_person'"
                class="inline-flex items-center gap-1.5 cursor-pointer select-none"
              >
                <input
                  v-model="draftRules.domainProfiles[domKey].allowsCombinedShipping"
                  type="checkbox"
                  class="toggle toggle-xs toggle-success"
                />
                <span class="text-[11px] font-bold text-base-content/80">
                  Combine S&amp;H
                </span>
              </label>
              <span
                v-else
                class="badge badge-2xs badge-success text-success-content font-bold"
              >
                Zero-Bias Camera Lock
              </span>
            </div>

            <div
              v-if="domKey !== 'in_person'"
              class="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end"
            >
              <div class="sm:col-span-3">
                <label class="label py-0.5">
                  <span class="label-text text-[10px] font-bold uppercase opacity-70">Buyer Prem %</span>
                </label>
                <input
                  v-model.number="draftRules.domainProfiles[domKey].defaultBuyersPremiumPct"
                  type="number"
                  min="0"
                  max="50"
                  step="0.5"
                  class="input input-bordered input-xs w-full font-mono font-bold bg-base-100"
                />
              </div>

              <div class="sm:col-span-3">
                <label class="label py-0.5">
                  <span class="label-text text-[10px] font-bold uppercase opacity-70">Max Box Lbs</span>
                </label>
                <input
                  v-model.number="draftRules.domainProfiles[domKey].maxWeightLbs"
                  type="number"
                  min="0"
                  max="200"
                  step="1"
                  :disabled="!draftRules.domainProfiles[domKey].allowsCombinedShipping"
                  class="input input-bordered input-xs w-full font-mono font-bold bg-base-100"
                />
              </div>

              <div class="sm:col-span-6">
                <label class="label py-0.5">
                  <span class="label-text text-[10px] font-bold uppercase opacity-70">Domain Prompt Note (≤120c)</span>
                </label>
                <input
                  v-model="draftRules.domainProfiles[domKey].guardrailNote"
                  type="text"
                  maxlength="120"
                  placeholder="Optional domain-only note..."
                  class="input input-bordered input-xs w-full bg-base-100"
                />
              </div>
            </div>
            <p v-else class="text-[11px] text-base-content/65">
              Used when scanning physical items with the camera in <code>/scout</code>. Never injects auction shipping or online marketplace assumptions.
            </p>
          </div>
        </div>
      </div>

      <!-- Category Calibration Notes (Max 5 notes, <= 120 chars each) -->
      <div class="card bg-base-100 border border-base-300 rounded-2xl p-4 space-y-3 shadow-xs">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h3 class="text-sm font-black text-base-content">
              📚 Category Calibration Guardrails (Max 5 Rules • ≤120 Chars Each)
            </h3>
            <p class="text-xs text-base-content/65">
              Matched dynamically by keyword so only relevant category rules enter the prompt token budget.
            </p>
          </div>
          <button
            type="button"
            class="btn btn-xs btn-outline btn-primary rounded-xl font-bold gap-1"
            :disabled="draftRules.categoryNotes.length >= 5"
            @click="addCategoryNote"
          >
            <span>+ Add Category Rule ({{ draftRules.categoryNotes.length }}/5)</span>
          </button>
        </div>

        <div class="space-y-2.5">
          <div
            v-for="(noteObj, idx) in draftRules.categoryNotes"
            :key="noteObj.key || idx"
            class="p-3 rounded-xl bg-base-200/50 border border-base-300 grid grid-cols-1 md:grid-cols-12 gap-2.5 items-start"
          >
            <div class="md:col-span-3">
              <label class="label py-0.5">
                <span class="label-text text-[10px] font-bold uppercase opacity-70">Category Label</span>
              </label>
              <input
                v-model="noteObj.label"
                type="text"
                maxlength="40"
                placeholder="e.g. Apparel & Boots"
                class="input input-bordered input-xs w-full font-bold bg-base-100"
              />
            </div>

            <div class="md:col-span-3">
              <label class="label py-0.5">
                <span class="label-text text-[10px] font-bold uppercase opacity-70">Match Keywords (comma)</span>
              </label>
              <input
                :value="(noteObj.keywords || []).join(', ')"
                type="text"
                placeholder="jacket, coat, dress, boots"
                class="input input-bordered input-xs w-full font-mono bg-base-100"
                @input="updateNoteKeywords(idx, ($event.target as HTMLInputElement).value)"
              />
            </div>

            <div class="md:col-span-5">
              <label class="label py-0.5 flex justify-between">
                <span class="label-text text-[10px] font-bold uppercase opacity-70">Calibration Instruction</span>
                <span class="font-mono text-[10px] opacity-60">{{ (noteObj.note || '').length }}/120</span>
              </label>
              <input
                v-model="noteObj.note"
                type="text"
                maxlength="120"
                placeholder="Never anchor to MSRP; price at cleared sold comps..."
                class="input input-bordered input-xs w-full bg-base-100"
              />
            </div>

            <div class="md:col-span-1 flex md:justify-end pt-4">
              <button
                type="button"
                class="btn btn-ghost btn-xs text-error font-bold"
                title="Remove rule"
                @click="removeCategoryNote(idx)"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Diff Preview + Save / Reset Action Bar -->
      <div class="card bg-base-200/80 border border-base-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="space-y-1 min-w-0">
          <div class="text-xs font-black text-base-content">
            <template v-if="ruleDiffs.length > 0">
              📝 {{ ruleDiffs.length }} Pending Change(s) Before Save:
            </template>
            <template v-else>
              ✅ Calibration rules are synced to the Collective Ledger (v{{ liveRules?.version || 1 }}).
            </template>
          </div>
          <div v-if="ruleDiffs.length > 0" class="flex items-center gap-1.5 flex-wrap">
            <span
              v-for="d in ruleDiffs"
              :key="d"
              class="badge badge-xs badge-warning text-warning-content font-mono font-bold whitespace-nowrap"
            >
              {{ d }}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            class="btn btn-ghost btn-sm rounded-xl font-bold"
            :disabled="savingRules"
            @click="resetRulesToDefaults"
          >
            ↩️ Reset to Defaults
          </button>
          <button
            type="button"
            class="btn btn-outline btn-sm rounded-xl font-bold"
            @click="isTestbenchOpen = true"
          >
            🧪 Try It
          </button>
          <button
            type="button"
            class="btn btn-success btn-sm text-success-content font-black rounded-xl gap-1.5 shadow-xs"
            :disabled="savingRules || ruleDiffs.length === 0"
            @click="saveRulesChanges"
          >
            <span v-if="savingRules" class="loading loading-spinner loading-xs"></span>
            <span>💾 Save Calibration Rules</span>
          </button>
        </div>
      </div>
    </section>

    <!-- =================================================================== -->
    <!-- TAB 3: AI SPEND & CREDITS (`ai_telemetry` + `ai_billing_ledger_v1`) -->
    <!-- =================================================================== -->
    <section v-else-if="activeTab === 'telemetry'" class="space-y-4">
      <!-- $40/mo Credit Coverage Banner -->
      <div class="card bg-base-100 border border-base-300 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="text-base font-black text-base-content">
                Google Developer Program Monthly Credit Pool ($40.00 / mo)
              </h2>
              <span
                class="badge badge-sm font-black whitespace-nowrap"
                :class="creditOutOfPocketUsd <= 0 ? 'badge-success text-success-content' : 'badge-warning text-warning-content'"
              >
                {{ creditOutOfPocketUsd <= 0 ? '🟢 $0.00 Net Out-of-Pocket' : '🟡 $' + creditOutOfPocketUsd.toFixed(2) + ' Over Monthly Grant' }}
              </span>
            </div>
            <p class="text-xs text-base-content/70 mt-0.5">
              {{ aiMetrics?.summary?.thisMonth?.period || 'Current Pacific Month' }} • Banked Gen AI &amp; Cloud Reserve:
              <strong class="font-mono">${{ (aiMetrics?.creditPool?.bankedCreditsUsd ?? 156.99).toFixed(2) }}</strong>
            </p>
          </div>

          <div class="text-left sm:text-right font-mono">
            <div class="text-lg font-black text-base-content">
              ${{ thisMonthSpendUsd.toFixed(2) }}
              <span class="text-xs font-normal text-base-content/60">
                / ${{ creditGrantUsd.toFixed(2) }}
              </span>
            </div>
            <div class="text-[11px] text-base-content/60">
              EOM Forecast: ${{ (aiMetrics?.summary?.thisMonth?.forecast ?? 0).toFixed(2) }}
            </div>
          </div>
        </div>

        <progress
          class="progress w-full h-3"
          :class="creditBarPercent < 80 ? 'progress-success' : creditBarPercent < 100 ? 'progress-warning' : 'progress-error'"
          :value="Math.min(100, creditBarPercent)"
          max="100"
        ></progress>

        <!-- Scout Pass-vs-Buy Funnel -->
        <div
          v-if="thisMonthFunnel && thisMonthFunnel.totalScouts > 0"
          class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1"
        >
          <div class="p-2.5 rounded-xl bg-base-200/60 border border-base-300/70">
            <div class="text-[10px] font-bold uppercase text-base-content/60">Total Scouts</div>
            <div class="font-mono font-black text-base">{{ thisMonthFunnel.totalScouts }}</div>
          </div>
          <div class="p-2.5 rounded-xl bg-success/10 border border-success/30">
            <div class="text-[10px] font-bold uppercase text-success">🔥 Buy / Chase</div>
            <div class="font-mono font-black text-base text-success">{{ thisMonthFunnel.buyCount }}</div>
          </div>
          <div class="p-2.5 rounded-xl bg-warning/10 border border-warning/30">
            <div class="text-[10px] font-bold uppercase text-warning">👀 Watch</div>
            <div class="font-mono font-black text-base text-warning">{{ thisMonthFunnel.watchCount }}</div>
          </div>
          <div class="p-2.5 rounded-xl bg-error/10 border border-error/30">
            <div class="text-[10px] font-bold uppercase text-error">🛑 Walk-Away Pass</div>
            <div class="font-mono font-black text-base text-error">
              {{ thisMonthFunnel.passCount }} ({{ thisMonthFunnel.passFilterRatePct }}%)
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <!-- Surface Breakdown Table -->
        <div class="lg:col-span-7 card bg-base-100 border border-base-300 rounded-2xl overflow-hidden shadow-xs">
          <div class="px-4 py-3 border-b border-base-200 flex items-center justify-between bg-base-200/40">
            <h3 class="text-xs font-black uppercase tracking-wider text-base-content/80">
              Token &amp; Latency Breakdown by AI Surface (This Month)
            </h3>
            <span class="badge badge-xs badge-ghost font-mono whitespace-nowrap">
              {{ aiMetrics?.telemetry?.thisMonth?.totalCalls || 0 }} live calls
            </span>
          </div>
          <div class="overflow-x-auto">
            <table class="table table-sm w-full">
              <thead>
                <tr class="text-[11px] uppercase text-base-content/65 bg-base-200/30">
                  <th>Surface</th>
                  <th class="text-right">Calls</th>
                  <th class="text-right">Tokens</th>
                  <th class="text-right">Avg Latency</th>
                  <th class="text-right">Est. USD</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="surfaceRows.length === 0">
                  <td colspan="5" class="text-center py-8 text-xs text-base-content/60">
                    New `ai_telemetry` events will populate per-surface token &amp; latency stats automatically as you scan.
                  </td>
                </tr>
                <tr v-for="s in surfaceRows" :key="s.surface">
                  <td class="text-xs font-bold">{{ s.label }}</td>
                  <td class="text-right font-mono text-xs">{{ s.calls }}</td>
                  <td class="text-right font-mono text-xs">{{ formatCompactNumber(s.totalTokens) }}</td>
                  <td class="text-right font-mono text-xs">
                    {{ s.avgLatencyMs > 0 ? (s.avgLatencyMs / 1000).toFixed(1) + 's' : '—' }}
                  </td>
                  <td class="text-right font-mono text-xs font-bold">${{ s.estimatedUsd.toFixed(3) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Google Cloud Billing Invoice & Credit Updater (`ai_billing_ledger_v1`) -->
        <div class="lg:col-span-5 card bg-base-100 border border-base-300 rounded-2xl p-4 space-y-3 shadow-xs">
          <div>
            <h3 class="text-sm font-black text-base-content">
              🧾 Google Cloud Billing Ground-Truth Ledger
            </h3>
            <p class="text-xs text-base-content/65">
              Override estimated token spend with your closed Google Cloud Console invoice or update banked credits—zero hardcoded constants.
            </p>
          </div>

          <div class="grid grid-cols-2 gap-2.5">
            <label class="form-control">
              <span class="label-text text-[11px] font-bold mb-1">Billing Month</span>
              <select
                v-model="ledgerForm.monthKey"
                class="select select-bordered select-sm font-mono text-xs bg-base-100"
              >
                <option
                  v-for="m in (aiMetrics?.monthlyHistory || []).slice(0, 6)"
                  :key="m.key"
                  :value="m.key"
                >
                  {{ m.label }} ({{ m.key }})
                </option>
              </select>
            </label>

            <label class="form-control">
              <span class="label-text text-[11px] font-bold mb-1">Cloud Invoice $ (blank = est)</span>
              <input
                v-model="ledgerForm.invoicedUsd"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 4.85"
                class="input input-bordered input-sm font-mono bg-base-100"
              />
            </label>

            <label class="form-control">
              <span class="label-text text-[11px] font-bold mb-1">Monthly Credit Grant ($)</span>
              <input
                v-model.number="ledgerForm.monthlyCreditGrantUsd"
                type="number"
                step="1"
                min="0"
                class="input input-bordered input-sm font-mono bg-base-100"
              />
            </label>

            <label class="form-control">
              <span class="label-text text-[11px] font-bold mb-1">Banked GCP Credits ($)</span>
              <input
                v-model.number="ledgerForm.bankedCreditsUsd"
                type="number"
                step="0.01"
                min="0"
                class="input input-bordered input-sm font-mono bg-base-100"
              />
            </label>
          </div>

          <label class="form-control">
            <span class="label-text text-[11px] font-bold mb-1">Audit Note (optional)</span>
            <input
              v-model="ledgerForm.note"
              type="text"
              maxlength="160"
              placeholder="e.g. GCP Invoice #9921 covered 100% by Developer Program credit"
              class="input input-bordered input-sm text-xs bg-base-100"
            />
          </label>

          <button
            type="button"
            class="btn btn-primary btn-sm text-primary-content font-black rounded-xl w-full gap-1.5"
            :disabled="savingLedger"
            @click="saveBillingLedgerUpdate"
          >
            <span v-if="savingLedger" class="loading loading-spinner loading-xs"></span>
            <span>💾 Save Billing Ground Truth</span>
          </button>
        </div>
      </div>
    </section>

    <!-- =================================================================== -->
    <!-- TAB 4: BOOKMARKLETS HUB (ALL CO-OP BMLs & ALPHA LIVE-LOADER)        -->
    <!-- =================================================================== -->
    <section v-else-if="activeTab === 'bookmarklets'" class="space-y-4">
      <div class="bg-primary/10 border border-primary/35 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div class="space-y-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="badge badge-sm badge-primary text-primary-content font-black">🔖 Universal Bookmarklets Hub</span>
            <span class="badge badge-sm badge-success text-success-content font-mono font-bold">12-Photo Vision • Multi-Domain • Photo Archival</span>
          </div>
          <p class="text-xs text-base-content/80">
            Drag any pill below directly to your Chrome Bookmarks Bar (<kbd class="kbd kbd-xs">Ctrl+Shift+B</kbd>). Each pill is bound to the exact domain you opened this Lab on (e.g. <code class="font-mono font-bold">alpha.resalecmd.com</code> vs <code class="font-mono font-bold">resalecmd.com</code>) so you can test new 12-photo Gallery Strip &amp; Multi-Domain Auction Scout features immediately.
          </p>
        </div>
      </div>

      <BookmarkletRegistryPanel />
    </section>

    <!-- =================================================================== -->
    <!-- SLIDE-OVER DRAWER: TRY IT PRICE & VENUE TESTBENCH                    -->
    <!-- =================================================================== -->
    <SlideOverDrawer
      v-model="isTestbenchOpen"
      title="🧪 Price & Venue Testbench"
      subtitle="Test live calibration rules, booth exclusions & 3-tier max bids"
      size="lg"
    >
      <div class="space-y-4">
        <!-- Quick 1-Click Sample Presets -->
        <div class="space-y-1.5">
          <div class="text-[11px] font-bold uppercase tracking-wider text-base-content/65">
            Quick Presets:
          </div>
          <div class="flex items-center gap-1.5 flex-wrap">
            <button
              v-for="preset in testbenchPresets"
              :key="preset.label"
              type="button"
              class="btn btn-xs btn-outline rounded-xl font-bold"
              @click="applyTestPreset(preset)"
            >
              {{ preset.label }}
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label class="form-control sm:col-span-2">
            <span class="label-text text-xs font-bold mb-1">Item Title *</span>
            <input
              v-model="testForm.title"
              type="text"
              placeholder="e.g. TSR AD&D Ravenloft Module I6 (1983 Complete)"
              class="input input-bordered input-sm w-full bg-base-100"
            />
          </label>

          <label class="form-control">
            <span class="label-text text-xs font-bold mb-1">Category</span>
            <input
              v-model="testForm.category"
              type="text"
              placeholder="e.g. TTRPG / Apparel / Brass Curio"
              class="input input-bordered input-sm w-full bg-base-100"
            />
          </label>

          <label class="form-control">
            <span class="label-text text-xs font-bold mb-1">Condition</span>
            <input
              v-model="testForm.condition"
              type="text"
              placeholder="e.g. VG+ Complete / Untested"
              class="input input-bordered input-sm w-full bg-base-100"
            />
          </label>

          <label class="form-control">
            <span class="label-text text-xs font-bold mb-1">Preferred Exit Venue</span>
            <select
              v-model="testForm.preferredVenue"
              class="select select-bordered select-sm w-full bg-base-100 text-xs font-bold"
            >
              <option value="">Auto-Pick Highest Net Venue</option>
              <option v-for="b in retailBoothMetas" :key="b.code" :value="b.code">
                {{ b.icon }} {{ b.displayName }} ({{ b.commissionRate }}% fee)
              </option>
              <option value="EBAY">🌐 eBay (Sold Comps)</option>
              <option value="POSHMARK">👗 Poshmark</option>
            </select>
          </label>

          <label class="form-control">
            <span class="label-text text-xs font-bold mb-1">Retail MSRP Tag $ (Tests 60% Cap)</span>
            <input
              v-model.number="testForm.msrpTagPrice"
              type="number"
              step="1"
              min="0"
              placeholder="Optional, e.g. 120"
              class="input input-bordered input-sm w-full font-mono bg-base-100"
            />
          </label>

          <label class="form-control sm:col-span-2">
            <span class="label-text text-xs font-bold mb-1">Details / Reseller Ground-Truth Notes</span>
            <textarea
              v-model="testForm.description"
              rows="2"
              placeholder="Hallmarks, edition, flaws, or lot contents..."
              class="textarea textarea-bordered textarea-sm w-full bg-base-100 text-xs"
            ></textarea>
          </label>
        </div>

        <button
          type="button"
          class="btn btn-primary btn-sm text-primary-content font-black rounded-xl w-full gap-1.5"
          :disabled="runningTest || !testForm.title.trim()"
          @click="runTestbenchEstimate"
        >
          <span v-if="runningTest" class="loading loading-spinner loading-xs"></span>
          <Icon v-else icon="solar:magic-stick-3-bold" class="w-4 h-4 shrink-0" />
          <span>Run Calibrated Price &amp; Venue Estimate</span>
        </button>

        <!-- Testbench Result Output -->
        <div v-if="testResult" class="space-y-3 pt-2 border-t border-base-300">
          <!-- Warnings (e.g. Anti-MSRP 60% Ceiling Alert) -->
          <div
            v-for="w in testResult.warnings || []"
            :key="w"
            class="bg-warning/15 border border-warning/40 rounded-xl p-2.5 text-xs font-semibold text-base-content"
          >
            ⚠️ {{ w }}
          </div>

          <div class="grid grid-cols-3 gap-2.5">
            <div class="p-3 rounded-xl bg-base-200/70 border border-base-300">
              <div class="text-[10px] font-bold uppercase text-base-content/60">Boutique Shelf</div>
              <div class="font-mono font-black text-lg text-success">${{ Number(testResult.boutiquePrice).toFixed(2) }}</div>
              <div class="text-[10px] text-base-content/60">Physical Booth Tag</div>
            </div>
            <div class="p-3 rounded-xl bg-base-200/70 border border-base-300">
              <div class="text-[10px] font-bold uppercase text-base-content/60">Fair Online</div>
              <div class="font-mono font-black text-lg text-info">${{ Number(testResult.fair).toFixed(2) }}</div>
              <div class="text-[10px] text-base-content/60">Range ${{ testResult.min }}–${{ testResult.max }}</div>
            </div>
            <div class="p-3 rounded-xl bg-base-200/70 border border-base-300">
              <div class="text-[10px] font-bold uppercase text-base-content/60">Best Net Payout</div>
              <div class="font-mono font-black text-lg text-primary">${{ Number(testResult.netAfterVenueFee).toFixed(2) }}</div>
              <div class="text-[10px] text-base-content/60 truncate">{{ testResult.recommendedVenue }}</div>
            </div>
          </div>

          <div class="bg-base-200/50 border border-base-300 rounded-xl p-3 text-xs">
            <span class="font-bold">AI Comp Rationale (Rules v{{ testResult.rulesVersion }}):</span>
            <span class="text-base-content/80 ml-1">{{ testResult.reason }}</span>
          </div>

          <!-- 3-Tier Max Bids -->
          <div v-if="testResult.maxTargetBids" class="grid grid-cols-3 gap-2 text-center">
            <div class="p-2.5 rounded-xl bg-base-200/60 border border-base-300">
              <div class="text-[10px] font-bold text-base-content/70">🛡️ Conservative</div>
              <div class="font-mono font-black text-sm">${{ Number(testResult.maxTargetBids.conservative).toFixed(2) }}</div>
            </div>
            <div class="p-2.5 rounded-xl bg-primary/10 border border-primary/40">
              <div class="text-[10px] font-bold text-primary">⚖️ Balanced Max Buy</div>
              <div class="font-mono font-black text-sm text-primary">${{ Number(testResult.maxTargetBids.balanced).toFixed(2) }}</div>
            </div>
            <div class="p-2.5 rounded-xl bg-base-200/60 border border-base-300">
              <div class="text-[10px] font-bold text-base-content/70">🔥 Aggressive</div>
              <div class="font-mono font-black text-sm">${{ Number(testResult.maxTargetBids.aggressive).toFixed(2) }}</div>
            </div>
          </div>

          <!-- All-Channel Net Comparison Table -->
          <div v-if="testResult.channelBreakdown?.length" class="overflow-x-auto border border-base-300 rounded-xl">
            <table class="table table-xs w-full">
              <thead>
                <tr class="bg-base-200/60 text-[10px] uppercase">
                  <th>Venue / Channel</th>
                  <th class="text-right">Gross Tag</th>
                  <th class="text-right">Fee</th>
                  <th class="text-right">Net Payout</th>
                  <th>Policy</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="ch in testResult.channelBreakdown"
                  :key="ch.code"
                  :class="!ch.eligible ? 'opacity-55' : ch.code === testResult.recommendedVenueCode ? 'bg-success/10 font-bold' : ''"
                >
                  <td class="text-xs">{{ ch.label }}</td>
                  <td class="text-right font-mono text-xs">${{ Number(ch.grossPrice).toFixed(2) }}</td>
                  <td class="text-right font-mono text-xs">
                    {{ ch.feePct }}%<span v-if="ch.fixedFeeUsd > 0"> + ${{ ch.fixedFeeUsd.toFixed(2) }}</span>
                  </td>
                  <td class="text-right font-mono text-xs font-black text-success">
                    ${{ Number(ch.netPayout).toFixed(2) }}
                  </td>
                  <td>
                    <span
                      v-if="!ch.eligible"
                      class="badge badge-2xs badge-error text-error-content font-bold whitespace-nowrap"
                    >
                      🚫 Excluded
                    </span>
                    <span
                      v-else-if="ch.code === testResult.recommendedVenueCode"
                      class="badge badge-2xs badge-success text-success-content font-bold whitespace-nowrap"
                    >
                      🏆 Best Net
                    </span>
                    <span v-else class="badge badge-2xs badge-ghost whitespace-nowrap">Eligible</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SlideOverDrawer>

    <!-- Slide-Over ItemDrawer for Inspecting Any Scored / Aged / Bin Item -->
    <ItemDrawer
      v-if="isItemDrawerOpen && selectedDrawerItem"
      :item="selectedDrawerItem"
      :isOpen="isItemDrawerOpen"
      @close="closeItemDrawer"
      @save="handleDrawerItemSaved"
      @saved="handleDrawerItemSaved"
    />

    <!-- Canonical 2-Tier Pagination & Command Dock (ux-design-system-taxonomy) -->
    <PaginationDock
      v-if="activeTab === 'scorecard' && activeTotalRowCount > 0"
      v-model:currentPage="currentPage"
      v-model:pageSize="pageSize"
      :totalItems="activeTotalRowCount"
      :totalPages="totalPages"
      :isLoading="loadingLab"
      entityLabel="items"
      :isFiltered="isTableFiltered"
      @scroll-top="scrollToTop"
    >
      <template #dock>
        <button
          type="button"
          class="btn h-11 flex-1 sm:flex-initial px-2.5 sm:px-3.5 rounded-2xl inline-flex items-center justify-center gap-1.5 transition-all duration-200 bg-base-200/80 hover:bg-base-300 text-base-content font-bold border border-base-content/15 shadow-xs active:scale-95 cursor-pointer shrink-0"
          :disabled="loadingLab"
          @click="loadAllLabData(true)"
          title="Refresh Estimate-vs-Sold audit"
        >
          <Icon icon="solar:refresh-bold" class="w-4 h-4 text-primary shrink-0" />
          <span class="font-extrabold text-xs whitespace-nowrap">Refresh</span>
        </button>

        <button
          type="button"
          class="btn h-11 flex-1 sm:flex-initial px-2.5 sm:px-3.5 rounded-2xl inline-flex items-center justify-center gap-1.5 transition-all duration-200 bg-base-200/80 hover:bg-base-300 text-base-content font-bold border border-base-content/15 shadow-xs active:scale-95 cursor-pointer shrink-0"
          @click="activeTab = 'rules'"
          title="Open Calibration Rules & Venue Bias"
        >
          <Icon icon="solar:settings-bold" class="w-4 h-4 shrink-0" />
          <span class="font-extrabold text-xs whitespace-nowrap">Rules</span>
        </button>

        <button
          type="button"
          class="btn h-11 flex-1 sm:flex-initial px-2.5 sm:px-3.5 rounded-2xl inline-flex items-center justify-center gap-1.5 transition-all duration-200 bg-base-200/80 hover:bg-base-300 text-base-content font-bold border border-base-content/15 shadow-xs active:scale-95 cursor-pointer shrink-0"
          @click="activeTab = 'bookmarklets'"
          title="Open Universal Bookmarklets Hub"
        >
          <Icon icon="solar:bookmark-bold" class="w-4 h-4 shrink-0" />
          <span class="font-extrabold text-xs whitespace-nowrap">BMLs</span>
        </button>

        <button
          type="button"
          class="btn h-11 flex-1 sm:flex-initial px-3.5 sm:px-5 rounded-2xl inline-flex items-center justify-center gap-1.5 transition-all duration-200 bg-primary text-primary-content font-black shadow-md border border-primary-content/25 active:scale-95 hover:brightness-110 cursor-pointer shrink-0"
          @click="isTestbenchOpen = true"
          title="Open Price & Venue Testbench"
        >
          <Icon icon="solar:test-tube-bold" class="w-4 h-4 drop-shadow-xs shrink-0" />
          <span class="font-black text-xs tracking-wide whitespace-nowrap">Try It</span>
        </button>
      </template>
    </PaginationDock>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, defineAsyncComponent } from 'vue';
import { Icon } from '@iconify/vue';
import { useUrlTab } from '../../composables/useUrlTab';
import KpiStatGrid, { type KpiStatItem } from '../common/KpiStatGrid.vue';
import PaginationDock from '../common/PaginationDock.vue';
import ItemThumbnail from '../common/ItemThumbnail.vue';
import SlideOverDrawer from '../common/SlideOverDrawer.vue';
import ItemDrawer from '../common/ItemDrawer.vue';
import { account, databases } from '../../lib/appwrite';
import { DB_ID, getCollectionId } from '../../lib/inventory';
import { getAllLocationSettingMetas, type LocationSettingMeta } from '../../lib/warehouses';
import { addToast } from '../../stores/toast';
import type {
  AppraisalRulesConfig,
  EstimateVsSoldScorecard,
} from '../../lib/appraisalCalibration';
import {
  SOURCING_DOMAIN_KEYS,
  cloneDefaultDomainProfiles,
  sanitizeDomainProfilesInput,
  type SourcingDomainKey,
} from '../../lib/sourcingDomains';

const BookmarkletRegistryPanel = defineAsyncComponent(() => import('../bml/BookmarkletRegistryPanel.vue'));
const editableDomainKeys: readonly SourcingDomainKey[] = SOURCING_DOMAIN_KEYS;

type LabTab = 'scorecard' | 'rules' | 'telemetry' | 'bookmarklets';
type ScorecardFilterKey =
  | 'all'
  | 'under_priced_gem'
  | 'on_target'
  | 'over_estimated'
  | 'aged_unsold'
  | 'booth_bins';

// Core State (Declared strictly above computed/lifecycle to prevent TDZ)
const { activeTab, setTab, tabSectionRef } = useUrlTab<LabTab>({
  tabs: ['scorecard', 'rules', 'telemetry', 'bookmarklets'],
  defaultTab: 'scorecard',
  legacyQueryParams: ['tab'],
});
const windowDays = ref<number>(180);
const loadingLab = ref<boolean>(true);
const loadError = ref<string | null>(null);
const saveNotice = ref<string | null>(null);

const liveRules = ref<AppraisalRulesConfig | null>(null);
const defaultRules = ref<AppraisalRulesConfig | null>(null);
const draftRules = ref<AppraisalRulesConfig | null>(null);
const warehouseMetas = ref<LocationSettingMeta[]>(getAllLocationSettingMetas());
const scorecard = ref<EstimateVsSoldScorecard | null>(null);
const promptPreviewServer = ref<string>('');
const aiMetrics = ref<any | null>(null);

// Scorecard Filters & Pagination
const scorecardFilter = ref<ScorecardFilterKey>('all');
const venueFilter = ref<string>('ALL');
const categoryFilter = ref<string>('ALL');
const searchQuery = ref<string>('');
const currentPage = ref<number>(1);
const pageSize = ref<number>(25);

// Rules & Ledger Save State
const savingRules = ref<boolean>(false);
const savingLedger = ref<boolean>(false);
const ledgerForm = ref<{
  monthKey: string;
  invoicedUsd: string | number;
  monthlyCreditGrantUsd: number;
  bankedCreditsUsd: number;
  note: string;
}>({
  monthKey: '',
  invoicedUsd: '',
  monthlyCreditGrantUsd: 40,
  bankedCreditsUsd: 156.99,
  note: '',
});

// Testbench Drawer State
const isTestbenchOpen = ref<boolean>(false);
const runningTest = ref<boolean>(false);
const testResult = ref<any | null>(null);
const testForm = ref({
  title: '',
  category: '',
  condition: 'Very Good',
  preferredVenue: '',
  msrpTagPrice: 0,
  description: '',
});

const testbenchPresets = [
  {
    label: '🎲 TSR AD&D Module',
    title: 'TSR AD&D Dungeon Module I6 Ravenloft (1983 Complete w/ Dual Maps)',
    category: 'TTRPG & Adventure',
    condition: 'VG+ Complete, light corner rub',
    preferredVenue: '',
    msrpTagPrice: 0,
    description: 'First printing 9075, both outer sleeves intact, clean interior.',
  },
  {
    label: '🖤 Whimsigoth Jacket ($120 MSRP)',
    title: 'Vintage 90s Black Velvet Celestial Embroidered Duster Coat',
    category: 'Apparel & Whimsigoth',
    condition: 'Excellent Vintage',
    preferredVenue: '',
    msrpTagPrice: 120,
    description: 'Tests Anti-MSRP 60% ceiling & small-curio booth apparel exclusion.',
  },
  {
    label: '🧭 Pocket Brass Compass (<8")',
    title: 'Antique Heavy Brass Sundial Pocket Compass in Fitted Wood Case (3.5")',
    category: 'Small Collectibles & Arcana',
    condition: 'Working needle, rich patina',
    preferredVenue: '',
    msrpTagPrice: 0,
    description: 'Pocket-sized curio under 8 inches.',
  },
];

// ItemDrawer State
const isItemDrawerOpen = ref<boolean>(false);
const selectedDrawerItem = ref<any | null>(null);

// Cached short-lived JWT for authenticated API calls if session cookie fallback needs reinforcement
let cachedJwt = '';
let cachedJwtExpMs = 0;

async function buildLabAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (cachedJwt && Date.now() < cachedJwtExpMs) {
    headers['X-Appwrite-JWT'] = cachedJwt;
    return headers;
  }
  try {
    const jwtRes = await account.createJWT();
    if (jwtRes?.jwt) {
      cachedJwt = jwtRes.jwt;
      cachedJwtExpMs = Date.now() + 10 * 60 * 1000;
      headers['X-Appwrite-JWT'] = cachedJwt;
    }
  } catch {
    // Same-origin session cookie fallback on server handles this cleanly
  }
  return headers;
}

function cloneRules(r: AppraisalRulesConfig): AppraisalRulesConfig {
  const cloned: AppraisalRulesConfig = JSON.parse(JSON.stringify(r));
  cloned.domainProfiles = sanitizeDomainProfilesInput(
    cloned.domainProfiles,
    cloneDefaultDomainProfiles()
  );
  return cloned;
}

const retailBoothMetas = computed(() =>
  warehouseMetas.value.filter((m) => m.commissionRate > 0)
);

function isPhysicalVenueCode(code: string): boolean {
  return retailBoothMetas.value.some((m) => m.code === code);
}

const thisMonthSpendUsd = computed(() =>
  Number(aiMetrics.value?.summary?.thisMonth?.actualBilled ?? 0)
);

const creditGrantUsd = computed(() =>
  Number(aiMetrics.value?.creditPool?.monthlyCreditGrantUsd ?? 40)
);

const creditOutOfPocketUsd = computed(() =>
  Math.max(0, Number((thisMonthSpendUsd.value - creditGrantUsd.value).toFixed(2)))
);

const creditBarPercent = computed(() =>
  creditGrantUsd.value > 0
    ? Math.round((thisMonthSpendUsd.value / creditGrantUsd.value) * 100)
    : 0
);

const thisMonthFunnel = computed(() => aiMetrics.value?.summary?.thisMonth?.funnel || null);

const surfaceRows = computed(() => aiMetrics.value?.telemetry?.thisMonth?.bySurface || []);

// 4-Tile KPI Strip (Section 2b-E)
const kpiStats = computed<KpiStatItem[]>(() => {
  const h = scorecard.value?.headline;
  const n = h?.sampleSize ?? 0;
  const med = h?.medianRealizationPct ?? null;

  let tile1Value = 'Building';
  let tile1Badge = `⏳ ${n}/8 sold`;
  let tile1BadgeClass = 'badge-ghost';
  let tile1Tone = 'text-base-content';
  if (med !== null && n > 0) {
    tile1Value = `${med}%`;
    if (n < 8) {
      tile1Badge = `🟡 ${n} sold (need 8)`;
      tile1BadgeClass = 'badge-warning text-warning-content';
      tile1Tone = 'text-warning';
    } else if (med >= 85 && med <= 115) {
      tile1Badge = `🟢 On Target · ${n} sold`;
      tile1BadgeClass = 'badge-success text-success-content';
      tile1Tone = 'text-success';
    } else {
      tile1Badge = `🔴 ${med > 115 ? 'Selling Higher' : 'Selling Lower'} · ${n} sold`;
      tile1BadgeClass = 'badge-error text-error-content';
      tile1Tone = 'text-warning';
    }
  }

  const funnel = thisMonthFunnel.value;
  const totalScans = Number(aiMetrics.value?.summary?.thisMonth?.totalScans ?? 0);
  const passRate = funnel?.passFilterRatePct ?? 0;

  const topVenue = (scorecard.value?.byVenue || []).find((v) => !v.suppressed && v.medianNetUsd !== null) ||
    (scorecard.value?.byVenue || [])[0];

  const spendStr = `$${thisMonthSpendUsd.value.toFixed(2)} / $${creditGrantUsd.value.toFixed(0)}`;

  return [
    {
      label: 'Actual Sold vs. AI Est.',
      value: tile1Value,
      badge: tile1Badge,
      badgeClass: tile1BadgeClass,
      tone: tile1Tone,
      hint:
        h && h.iqrLowPct !== null && h.iqrHighPct !== null
          ? `Typical: ${h.iqrLowPct}%–${h.iqrHighPct}% • Ticket Match ${h.linkCoveragePct}%`
          : `Ticket match ${h?.linkCoveragePct ?? 100}% across ${windowDays.value}d`,
    },
    {
      label: 'Scout Funnel (This Month)',
      value: `${totalScans} scans`,
      badge: funnel && funnel.totalScouts > 0 ? `🛑 ${passRate}% Pass` : `🟢 Live`,
      badgeClass: 'badge-secondary text-secondary-content',
      tone: 'text-primary',
      hint:
        funnel && funnel.totalScouts > 0
          ? `Buy ${funnel.buyCount} • Watch ${funnel.watchCount} • Pass ${funnel.passCount} saved`
          : 'Logs Buy / Watch / Walk-Away Pass verdicts',
    },
    {
      label: 'Typical Net Payout by Booth',
      value:
        topVenue && topVenue.medianNetUsd !== null
          ? `$${topVenue.medianNetUsd.toFixed(2)} net`
          : `${retailBoothMetas.value.length} Booths`,
      badge: topVenue ? `${topVenue.sampleSize} sold` : '🏪 Live Fees',
      badgeClass: 'badge-ghost',
      tone: 'text-success',
      hint: topVenue
        ? `${topVenue.label} after booth commission`
        : 'Net after booth commissions',
    },
    {
      label: 'Monthly AI Spend vs. Credit',
      value: spendStr,
      badge: creditOutOfPocketUsd.value <= 0 ? '🟢 $0 OOP' : '🟡 Over Grant',
      badgeClass:
        creditOutOfPocketUsd.value <= 0
          ? 'badge-success text-success-content'
          : 'badge-warning text-warning-content',
      tone: creditOutOfPocketUsd.value <= 0 ? 'text-success' : 'text-warning',
      hint: `$${Math.max(0, creditGrantUsd.value - thisMonthSpendUsd.value).toFixed(2)} monthly grant left`,
    },
  ];
});

const filterChipOptions = computed(() => {
  const rows = scorecard.value?.rows || [];
  return [
    { key: 'all' as ScorecardFilterKey, label: 'All Scored', count: rows.length },
    {
      key: 'under_priced_gem' as ScorecardFilterKey,
      label: '💎 Under-Priced Gems',
      count: rows.filter((r) => r.chip === 'under_priced_gem').length,
    },
    {
      key: 'on_target' as ScorecardFilterKey,
      label: '🎯 On Target',
      count: rows.filter((r) => r.chip === 'on_target').length,
    },
    {
      key: 'over_estimated' as ScorecardFilterKey,
      label: '⚠️ Over-Estimated',
      count: rows.filter((r) => r.chip === 'over_estimated').length,
    },
    {
      key: 'aged_unsold' as ScorecardFilterKey,
      label: '⏳ Aged Unsold >90d',
      count: (scorecard.value?.agedUnsoldCandidates || []).length,
    },
    {
      key: 'booth_bins' as ScorecardFilterKey,
      label: '📦 Booth Bins',
      count: (scorecard.value?.binSellThrough || []).length,
    },
  ];
});

const availableVenueFilters = computed(() => {
  const map = new Map<string, string>();
  for (const m of warehouseMetas.value) {
    map.set(m.code, `${m.icon} ${m.shortName} (${m.code})`);
  }
  for (const r of scorecard.value?.rows || []) {
    if (r.venueCode && !map.has(r.venueCode)) {
      map.set(r.venueCode, r.venueLabel || r.venueCode);
    }
  }
  return Array.from(map.entries()).map(([code, label]) => ({ code, label }));
});

const availableCategoryFilters = computed(() => {
  const counts = new Map<string, number>();
  for (const r of scorecard.value?.rows || []) {
    const cat = r.category || 'Decor & Collectibles';
    counts.set(cat, (counts.get(cat) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((a, b) => b.count - a.count);
});

const isTableFiltered = computed(
  () =>
    scorecardFilter.value !== 'all' ||
    venueFilter.value !== 'ALL' ||
    categoryFilter.value !== 'ALL' ||
    searchQuery.value.trim().length > 0
);

function toggleVenueFilter(code: string) {
  venueFilter.value = venueFilter.value === code ? 'ALL' : code;
  currentPage.value = 1;
}

function toggleCategoryFilter(catKey: string) {
  categoryFilter.value = categoryFilter.value === catKey ? 'ALL' : catKey;
  currentPage.value = 1;
}

function resetAllTableFilters() {
  scorecardFilter.value = 'all';
  venueFilter.value = 'ALL';
  categoryFilter.value = 'ALL';
  searchQuery.value = '';
  currentPage.value = 1;
}

function scrollToTop() {
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

const filteredScoredRows = computed(() => {
  let rows = scorecard.value?.rows || [];
  if (
    scorecardFilter.value === 'under_priced_gem' ||
    scorecardFilter.value === 'on_target' ||
    scorecardFilter.value === 'over_estimated'
  ) {
    rows = rows.filter((r) => r.chip === scorecardFilter.value);
  }
  if (venueFilter.value !== 'ALL') {
    rows = rows.filter((r) => r.venueCode === venueFilter.value);
  }
  if (categoryFilter.value !== 'ALL') {
    rows = rows.filter((r) => r.category === categoryFilter.value);
  }
  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    rows = rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.upc || '').toLowerCase().includes(q) ||
        (r.locationSku || '').toLowerCase().includes(q) ||
        (r.category || '').toLowerCase().includes(q)
    );
  }
  return rows;
});

const filteredAgedRows = computed(() => {
  let rows = scorecard.value?.agedUnsoldCandidates || [];
  if (venueFilter.value !== 'ALL') {
    rows = rows.filter((r) => r.venueCode === venueFilter.value);
  }
  if (categoryFilter.value !== 'ALL') {
    rows = rows.filter((r) => r.category === categoryFilter.value);
  }
  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    rows = rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.upc || '').toLowerCase().includes(q) ||
        (r.category || '').toLowerCase().includes(q)
    );
  }
  return rows;
});

const filteredBinRows = computed(() => {
  let rows = scorecard.value?.binSellThrough || [];
  if (venueFilter.value !== 'ALL') {
    rows = rows.filter((r) => r.venueCode === venueFilter.value);
  }
  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    rows = rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.sku || '').toLowerCase().includes(q) ||
        (r.upc || '').toLowerCase().includes(q)
    );
  }
  return rows;
});

const activeTotalRowCount = computed(() => {
  if (scorecardFilter.value === 'aged_unsold') return filteredAgedRows.value.length;
  if (scorecardFilter.value === 'booth_bins') return filteredBinRows.value.length;
  return filteredScoredRows.value.length;
});

const totalPages = computed(() =>
  Math.max(1, Math.ceil(activeTotalRowCount.value / Math.max(1, pageSize.value)))
);

const paginatedScoredRows = computed(() => {
  const size = Math.max(1, pageSize.value);
  const start = (currentPage.value - 1) * size;
  return filteredScoredRows.value.slice(start, start + size);
});

const paginatedAgedRows = computed(() => {
  const size = Math.max(1, pageSize.value);
  const start = (currentPage.value - 1) * size;
  return filteredAgedRows.value.slice(start, start + size);
});

const paginatedBinRows = computed(() => {
  const size = Math.max(1, pageSize.value);
  const start = (currentPage.value - 1) * size;
  return filteredBinRows.value.slice(start, start + size);
});

// Live client-side preview of compiled prompt string (`<= 600 chars`)
const promptPreviewText = computed(() => {
  if (!draftRules.value) return promptPreviewServer.value;
  const r = draftRules.value;
  const venueParts = retailBoothMetas.value.map((m) => {
    const bias = Number(r.venueBias?.[m.code] ?? 1.0);
    const biasTxt = bias !== 1 ? ` x${bias.toFixed(2)}` : '';
    return `${m.code}:${m.commissionRate}%fee${biasTxt}`;
  });
  const lines = [
    `[CALIBRATION v${r.version}] ROI:${r.roiTargets.conservative}/${r.roiTargets.balanced}/${r.roiTargets.aggressive}x | Booths:${venueParts.join(',')} | Online:eBay ${r.channelFees.ebayPct}%+$${r.channelFees.ebayFixedUsd},Posh ${r.channelFees.poshmarkPct}%`,
    ...r.categoryNotes
      .filter((n) => n.note && n.note.trim())
      .slice(0, 3)
      .map((n) => `- ${n.label || 'Rule'}: ${n.note.trim().slice(0, 120)}`),
  ];
  let out = '';
  for (const ln of lines) {
    const cand = out ? `${out}\n${ln}` : ln;
    if (cand.length > 600) break;
    out = cand;
  }
  return out;
});

const ruleDiffs = computed<string[]>(() => {
  if (!liveRules.value || !draftRules.value) return [];
  const diffs: string[] = [];
  const a = liveRules.value;
  const b = draftRules.value;

  if (a.roiTargets.conservative !== b.roiTargets.conservative) {
    diffs.push(`Conservative ROI: ${a.roiTargets.conservative}x ➔ ${b.roiTargets.conservative}x`);
  }
  if (a.roiTargets.balanced !== b.roiTargets.balanced) {
    diffs.push(`Balanced ROI: ${a.roiTargets.balanced}x ➔ ${b.roiTargets.balanced}x`);
  }
  if (a.roiTargets.aggressive !== b.roiTargets.aggressive) {
    diffs.push(`Aggressive ROI: ${a.roiTargets.aggressive}x ➔ ${b.roiTargets.aggressive}x`);
  }

  for (const m of retailBoothMetas.value) {
    const vA = Number(a.venueBias?.[m.code] ?? 1);
    const vB = Number(b.venueBias?.[m.code] ?? 1);
    if (Math.abs(vA - vB) >= 0.005) {
      diffs.push(`${m.code} Bias: ${vA.toFixed(2)}x ➔ ${vB.toFixed(2)}x`);
    }
  }

  if (
    a.channelFees.ebayPct !== b.channelFees.ebayPct ||
    a.channelFees.ebayFixedUsd !== b.channelFees.ebayFixedUsd ||
    a.channelFees.poshmarkPct !== b.channelFees.poshmarkPct ||
    a.channelFees.poshmarkUnder15FlatUsd !== b.channelFees.poshmarkUnder15FlatUsd
  ) {
    diffs.push('Online Channel Fees updated');
  }

  if (JSON.stringify(a.categoryNotes) !== JSON.stringify(b.categoryNotes)) {
    diffs.push(`Category Notes (${b.categoryNotes.length})`);
  }

  if (
    JSON.stringify(sanitizeDomainProfilesInput(a.domainProfiles)) !==
    JSON.stringify(sanitizeDomainProfilesInput(b.domainProfiles))
  ) {
    diffs.push('Sourcing Domain Guardrails updated');
  }

  return diffs;
});

function setScorecardFilter(key: ScorecardFilterKey) {
  scorecardFilter.value = key;
  currentPage.value = 1;
}

function getRealizationBadgeClass(pct: number): string {
  if (pct >= 85 && pct <= 115) return 'badge-success text-success-content';
  if (pct > 115) return 'badge-info text-info-content';
  return 'badge-warning text-warning-content';
}

function getRealizationTextClass(pct: number): string {
  if (pct >= 85 && pct <= 115) return 'text-success';
  if (pct > 115) return 'text-info';
  return 'text-warning';
}

function formatCompactNumber(num: number): string {
  const n = Number(num) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function stageSuggestedVenueMultiplier(venueCode: string, mult: number) {
  if (!draftRules.value) return;
  draftRules.value.venueBias = {
    ...(draftRules.value.venueBias || {}),
    [venueCode]: mult,
  };
  activeTab.value = 'rules';
  addToast({
    type: 'info',
    message: `Staged ${venueCode} shelf multiplier (${mult.toFixed(2)}x). Review & click Save Calibration Rules.`,
  });
}

function addCategoryNote() {
  if (!draftRules.value || draftRules.value.categoryNotes.length >= 5) return;
  draftRules.value.categoryNotes.push({
    key: `cat_${Date.now().toString(36)}`,
    label: 'New Category',
    keywords: [],
    note: '',
  });
}

function removeCategoryNote(idx: number) {
  if (!draftRules.value) return;
  draftRules.value.categoryNotes.splice(idx, 1);
}

function updateNoteKeywords(idx: number, raw: string) {
  if (!draftRules.value || !draftRules.value.categoryNotes[idx]) return;
  draftRules.value.categoryNotes[idx].keywords = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 12);
}

async function loadAllLabData(forceRefresh = false) {
  loadingLab.value = true;
  loadError.value = null;

  try {
    const headers = await buildLabAuthHeaders();
    const [labRes, metricsRes] = await Promise.all([
      fetch(`/api/estimate-price?mode=lab_snapshot&windowDays=${windowDays.value}`, {
        method: 'GET',
        credentials: 'same-origin',
        headers,
      }),
      fetch(`/api/admin/ai-metrics${forceRefresh ? '?refresh=true' : ''}`, {
        method: 'GET',
        credentials: 'same-origin',
      }),
    ]);

    const labData = await labRes.json();
    if (!labRes.ok || !labData?.success) {
      throw new Error(labData?.message || labData?.error || 'Failed to load Appraisal Lab snapshot.');
    }

    liveRules.value = labData.rules;
    defaultRules.value = labData.defaults;
    draftRules.value = cloneRules(labData.rules);
    if (Array.isArray(labData.warehouses) && labData.warehouses.length > 0) {
      warehouseMetas.value = labData.warehouses;
      // Ensure every retail booth has an initialized bias key on draftRules
      for (const m of labData.warehouses) {
        if (m.commissionRate > 0 && draftRules.value && draftRules.value.venueBias[m.code] === undefined) {
          draftRules.value.venueBias[m.code] = 1.0;
          if (liveRules.value) liveRules.value.venueBias[m.code] = 1.0;
        }
      }
    }
    scorecard.value = labData.scorecard || null;
    promptPreviewServer.value = labData.promptPreview || '';

    if (metricsRes.ok) {
      const mData = await metricsRes.json();
      if (mData?.success) {
        aiMetrics.value = mData;
        const tmKey = mData.summary?.thisMonth?.key || '';
        const tmInvoiced = mData.monthlyHistory?.find((h: any) => h.key === tmKey)?.invoicedUsd;
        ledgerForm.value = {
          monthKey: ledgerForm.value.monthKey || tmKey,
          invoicedUsd: typeof tmInvoiced === 'number' ? tmInvoiced : '',
          monthlyCreditGrantUsd: mData.creditPool?.monthlyCreditGrantUsd ?? 40,
          bankedCreditsUsd: mData.creditPool?.bankedCreditsUsd ?? 156.99,
          note: '',
        };
      }
    }
  } catch (err: any) {
    loadError.value = err?.message || 'Unable to load Appraisal & Pricing Lab.';
  } finally {
    loadingLab.value = false;
  }
}

async function saveRulesChanges() {
  if (!draftRules.value) return;
  savingRules.value = true;
  saveNotice.value = null;

  try {
    const headers = await buildLabAuthHeaders();
    const res = await fetch('/api/estimate-price', {
      method: 'PUT',
      credentials: 'same-origin',
      headers,
      body: JSON.stringify({
        ...draftRules.value,
        expectedVersion: liveRules.value?.version,
      }),
    });
    const data = await res.json();
    if (res.status === 409) {
      addToast({
        type: 'warning',
        message: 'Another tab updated rules first — reloading latest version.',
      });
      await loadAllLabData(true);
      return;
    }
    if (!res.ok || !data?.success) {
      throw new Error(data?.error || 'Failed to save calibration rules.');
    }

    liveRules.value = data.rules;
    draftRules.value = cloneRules(data.rules);
    promptPreviewServer.value = data.promptPreview || promptPreviewServer.value;
    saveNotice.value = data.cacheNotice || 'Saved — applies to all scans within 5 minutes.';
    addToast({ type: 'success', message: saveNotice.value });
  } catch (err: any) {
    addToast({ type: 'error', message: err?.message || 'Failed to save rules.' });
  } finally {
    savingRules.value = false;
  }
}

async function resetRulesToDefaults() {
  savingRules.value = true;
  saveNotice.value = null;

  try {
    const headers = await buildLabAuthHeaders();
    const res = await fetch('/api/estimate-price', {
      method: 'PUT',
      credentials: 'same-origin',
      headers,
      body: JSON.stringify({
        resetToDefaults: true,
        expectedVersion: liveRules.value?.version,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data?.success) {
      throw new Error(data?.error || 'Failed to reset rules.');
    }
    liveRules.value = data.rules;
    draftRules.value = cloneRules(data.rules);
    promptPreviewServer.value = data.promptPreview || '';
    saveNotice.value = 'Reset to defaults — applies to all scans within 5 minutes.';
    addToast({ type: 'success', message: saveNotice.value });
  } catch (err: any) {
    addToast({ type: 'error', message: err?.message || 'Failed to reset rules.' });
  } finally {
    savingRules.value = false;
  }
}

async function saveBillingLedgerUpdate() {
  savingLedger.value = true;
  try {
    const res = await fetch('/api/admin/ai-metrics', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'update_ledger',
        monthKey: ledgerForm.value.monthKey,
        invoicedUsd: ledgerForm.value.invoicedUsd === '' ? null : Number(ledgerForm.value.invoicedUsd),
        monthlyCreditGrantUsd: Number(ledgerForm.value.monthlyCreditGrantUsd),
        bankedCreditsUsd: Number(ledgerForm.value.bankedCreditsUsd),
        note: ledgerForm.value.note,
        expectedVersion: aiMetrics.value?.creditPool?.ledgerVersion,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data?.success) {
      throw new Error(data?.error || 'Failed to update billing ledger.');
    }
    addToast({ type: 'success', message: data.message || 'Billing ledger updated!' });
    await loadAllLabData(true);
  } catch (err: any) {
    addToast({ type: 'error', message: err?.message || 'Billing update failed.' });
  } finally {
    savingLedger.value = false;
  }
}

function applyTestPreset(preset: typeof testbenchPresets[number]) {
  testForm.value = {
    title: preset.title,
    category: preset.category,
    condition: preset.condition,
    preferredVenue: preset.preferredVenue,
    msrpTagPrice: preset.msrpTagPrice,
    description: preset.description,
  };
  testResult.value = null;
}

async function runTestbenchEstimate() {
  if (!testForm.value.title.trim()) return;
  runningTest.value = true;
  try {
    const res = await fetch('/api/estimate-price', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testForm.value),
    });
    const data = await res.json();
    if (!res.ok || data?.error) {
      throw new Error(data?.error || 'Estimate failed.');
    }
    testResult.value = data;
  } catch (err: any) {
    addToast({ type: 'error', message: err?.message || 'Testbench estimate failed.' });
  } finally {
    runningTest.value = false;
  }
}

async function openItemInDrawer(itemId: string) {
  if (!itemId) return;
  try {
    const doc = await databases.getDocument(DB_ID, getCollectionId(), itemId);
    selectedDrawerItem.value = doc;
    isItemDrawerOpen.value = true;
  } catch (err: any) {
    addToast({
      type: 'warning',
      message: `Could not open item (${itemId}): ${err?.message || 'not found in active workspace'}.`,
    });
  }
}

function closeItemDrawer() {
  isItemDrawerOpen.value = false;
  selectedDrawerItem.value = null;
}

async function handleDrawerItemSaved() {
  closeItemDrawer();
  await loadAllLabData(true);
}

onMounted(() => {
  loadAllLabData(false);
});
</script>
