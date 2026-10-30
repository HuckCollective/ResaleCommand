<template>
    <div class="space-y-5 sm:space-y-7">
        
        <!-- Unified Single Command Center Header -->
        <div class="flex items-center justify-between gap-2">
            <div class="min-w-0">
                <h1 class="text-xl sm:text-2xl font-extrabold tracking-tight text-base-content leading-tight">Command Center</h1>
                <p class="text-[11px] sm:text-xs text-base-content/65 truncate">Live restock radar, financials, and AI insights</p>
            </div>

            <div class="flex items-center gap-1.5 shrink-0">
                <a href="/scout" class="btn btn-xs sm:btn-sm btn-primary text-primary-content font-bold gap-1 shadow-xs">
                    <span>🚀 Scout</span>
                </a>
                <button 
                    @click="toggleAllSections"
                    class="btn btn-xs sm:btn-sm btn-ghost border border-base-300/80 font-bold gap-1 hover:bg-base-200 transition-all shrink-0"
                    :title="allCollapsed ? 'Expand All Dashboard Areas' : 'Collapse All Dashboard Areas'"
                >
                    <Icon :icon="allCollapsed ? 'solar:maximize-square-minimalistic-bold' : 'solar:minimize-square-minimalistic-bold'" class="w-3.5 h-3.5 text-primary" />
                    <span class="text-xs hidden xs:inline">{{ allCollapsed ? 'Expand All' : 'Collapse All' }}</span>
                </button>
            </div>
        </div>

        <!-- AREA 0: OPERATIONS & BOOTH RESTOCK RADAR (EXPANDED BY DEFAULT) -->
        <OperationsRadarGrid />

        <!-- AREA 1: KEY METRICS & BUSINESS FINANCIALS (COLLAPSIBLE, 2x2 BENTO GRID ON MOBILE) -->
        <div class="card bg-base-100 shadow-xl border border-base-300/80 overflow-hidden transition-all">
            <!-- Area 1 Header with Roll-Up Summary -->
            <div 
                @click="toggleSection('overview')" 
                class="p-3.5 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 cursor-pointer hover:bg-base-200/50 transition-colors select-none"
                :class="{ 'border-b border-base-200': !isCollapsed.overview }"
                role="button"
                :aria-expanded="!isCollapsed.overview"
                tabindex="0"
                @keydown.enter.space="toggleSection('overview')"
            >
                <div class="flex items-center gap-2.5">
                    <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm flex-shrink-0">
                        <Icon icon="solar:chart-2-bold-duotone" class="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <h3 class="font-extrabold text-sm sm:text-lg text-base-content tracking-tight">
                                Business Financials &amp; Inventory
                            </h3>
                            <span class="badge badge-xs badge-ghost text-base-content/70 font-bold hidden sm:inline whitespace-nowrap">Overview</span>
                        </div>
                        <p class="text-[11px] sm:text-xs text-base-content/65">
                            Real-time profit, estimated stock valuation, and purchase costs
                        </p>
                    </div>
                </div>

                <!-- Roll-Up Summary Chips & Chevron -->
                <div class="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto overflow-x-auto max-w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    <!-- Roll-Up Badges -->
                    <div class="flex items-center gap-1.5 shrink-0">
                        <div class="badge badge-xs sm:badge-sm badge-success text-success-content font-extrabold whitespace-nowrap gap-1 shadow-xs">
                            <Icon icon="solar:wallet-money-bold" class="w-3 h-3" />
                            <span>+${{ globalProfit.toFixed(2) }}</span>
                            <span class="opacity-80 font-normal hidden sm:inline">Profit</span>
                        </div>
                        <div class="badge badge-xs sm:badge-sm badge-info text-info-content font-extrabold whitespace-nowrap gap-1 shadow-xs">
                            <Icon icon="solar:chart-square-bold" class="w-3 h-3" />
                            <span>${{ globalProjectedRevenue.toFixed(2) }}</span>
                            <span class="opacity-80 font-normal hidden sm:inline">Valuation</span>
                        </div>
                        <div class="badge badge-xs sm:badge-sm badge-warning text-warning-content font-bold whitespace-nowrap gap-1 shadow-xs">
                            <span>{{ totalItemsCount }} in stock</span>
                        </div>
                        <div class="badge badge-xs sm:badge-sm badge-secondary text-secondary-content font-bold whitespace-nowrap gap-1 shadow-xs hidden lg:inline-flex">
                            <span>{{ totalPurchasesCount }} orders</span>
                        </div>
                    </div>

                    <!-- Chevron Button -->
                    <button 
                        type="button" 
                        class="btn btn-ghost btn-xs btn-circle shrink-0 hover:bg-base-300 ml-1"
                        :aria-expanded="!isCollapsed.overview"
                        aria-label="Toggle Financial Overview"
                    >
                        <Icon 
                            icon="solar:alt-arrow-down-linear" 
                            class="w-4 h-4 transition-transform duration-200" 
                            :class="{ '-rotate-90': isCollapsed.overview }" 
                        />
                    </button>
                </div>
            </div>

            <!-- Area 1 Content: 2x2 Bento Grid on Mobile, 4-Column Row on Desktop -->
            <div v-show="!isCollapsed.overview" class="p-3 sm:p-4 grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 bg-base-100">
                <!-- Stat 1: Total Profit -->
                <div class="p-3 sm:p-4 rounded-xl bg-base-200/50 border border-base-300/80 flex flex-col justify-between">
                    <div class="flex items-center justify-between gap-1.5 mb-1">
                        <span class="text-[11px] sm:text-xs font-bold text-base-content/70 truncate">Total Profit</span>
                        <Icon icon="solar:wallet-money-bold-duotone" class="w-4 h-4 sm:w-5 sm:h-5 text-success shrink-0" />
                    </div>
                    <div class="font-black font-mono text-success text-lg sm:text-2xl leading-tight truncate">
                        ${{ globalProfit.toFixed(2) }}
                    </div>
                    <div class="text-[10px] sm:text-xs text-base-content/60 mt-0.5 truncate">From sold inventory</div>
                </div>

                <!-- Stat 2: Est. Inventory Value -->
                <div class="p-3 sm:p-4 rounded-xl bg-base-200/50 border border-base-300/80 flex flex-col justify-between">
                    <div class="flex items-center justify-between gap-1.5 mb-1">
                        <span class="text-[11px] sm:text-xs font-bold text-base-content/70 truncate">Est. Stock Value</span>
                        <Icon icon="solar:chart-square-bold-duotone" class="w-4 h-4 sm:w-5 sm:h-5 text-info shrink-0" />
                    </div>
                    <div class="font-black font-mono text-info text-lg sm:text-2xl leading-tight truncate">
                        ${{ globalProjectedRevenue.toFixed(2) }}
                    </div>
                    <div class="text-[10px] sm:text-xs text-base-content/60 mt-0.5 truncate">Unsold items in stock</div>
                </div>

                <!-- Stat 3: Items in Inventory -->
                <div class="p-3 sm:p-4 rounded-xl bg-base-200/50 border border-base-300/80 flex flex-col justify-between">
                    <div class="flex items-center justify-between gap-1.5 mb-1">
                        <span class="text-[11px] sm:text-xs font-bold text-base-content/70 truncate">Items in Stock</span>
                        <Icon icon="solar:box-bold-duotone" class="w-4 h-4 sm:w-5 sm:h-5 text-warning shrink-0" />
                    </div>
                    <div class="font-black font-mono text-warning text-lg sm:text-2xl leading-tight truncate">
                        {{ totalItemsCount }}
                    </div>
                    <div class="text-[10px] sm:text-xs text-warning/80 mt-0.5 truncate">${{ globalSunkCost.toFixed(2) }} sunk cost</div>
                </div>

                <!-- Stat 4: Orders Placed -->
                <div class="p-3 sm:p-4 rounded-xl bg-base-200/50 border border-base-300/80 flex flex-col justify-between">
                    <div class="flex items-center justify-between gap-1.5 mb-1">
                        <span class="text-[11px] sm:text-xs font-bold text-base-content/70 truncate">Orders Placed</span>
                        <Icon icon="solar:cart-large-minimalistic-bold-duotone" class="w-4 h-4 sm:w-5 sm:h-5 text-secondary shrink-0" />
                    </div>
                    <div class="font-black font-mono text-secondary text-lg sm:text-2xl leading-tight truncate">
                        {{ totalPurchasesCount }}
                    </div>
                    <div class="text-[10px] sm:text-xs text-secondary/80 mt-0.5 truncate">${{ totalSpentPurchases.toFixed(2) }} total spent</div>
                </div>
            </div>
        </div>

        <!-- AREA 2: AI BUSINESS INSIGHTS & TAX DEDUCTIONS (COLLAPSIBLE) -->
        <div v-if="insights.length > 0" class="card bg-base-200 shadow-xl border border-base-300/80 animate-fade-in overflow-hidden transition-all">
            <!-- Area 2 Header with Roll-Up Summary -->
            <div 
                @click="toggleSection('insights')" 
                class="p-3.5 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 cursor-pointer hover:bg-base-300/40 transition-colors select-none"
                :class="{ 'border-b border-base-300': !isCollapsed.insights }"
                role="button"
                :aria-expanded="!isCollapsed.insights"
                tabindex="0"
                @keydown.enter.space="toggleSection('insights')"
            >
                <div class="flex items-center gap-2.5">
                    <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-warning/20 to-success/20 flex items-center justify-center text-warning shadow-sm flex-shrink-0">
                        <Icon icon="solar:magic-stick-3-bold-duotone" class="w-5 h-5 sm:w-6 sm:h-6 text-warning" />
                    </div>
                    <div>
                        <div class="flex flex-wrap items-center gap-1.5">
                            <h3 class="font-extrabold text-sm sm:text-lg tracking-tight text-base-content">
                                AI Business Insights &amp; Tax Deductions
                            </h3>
                            <span class="badge badge-2xs sm:badge-xs badge-success text-success-content font-bold whitespace-nowrap gap-1 shadow-sm">
                                <Icon icon="solar:shield-check-bold" class="w-3 h-3" />
                                IRS Schedule C
                            </span>
                        </div>
                        <p class="text-[11px] sm:text-xs text-base-content/70 mt-0.5">
                            Automated inventory health diagnostics &amp; tax write-off recommendations
                        </p>
                    </div>
                </div>

                <!-- Roll-Up Summary Badges, Tax Playbook Trigger, and Collapse Chevron -->
                <div class="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto overflow-x-auto max-w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    <!-- Roll-Up Badges -->
                    <div class="flex items-center gap-1.5 shrink-0">
                        <div class="badge badge-xs sm:badge-sm badge-warning text-warning-content font-bold whitespace-nowrap gap-1 shadow-xs">
                            <Icon icon="solar:box-bold" class="w-3 h-3" />
                            <span>{{ inventoryInsights.length }} Alerts</span>
                        </div>
                        <div class="badge badge-xs sm:badge-sm badge-success text-success-content font-bold whitespace-nowrap gap-1 shadow-xs">
                            <Icon icon="solar:dollar-minimalistic-bold" class="w-3 h-3" />
                            <span>{{ taxInsights.length }} Tax</span>
                        </div>
                    </div>

                    <div class="flex items-center gap-1 shrink-0">
                        <!-- Tax Playbook Button (Click stop so it doesn't toggle collapse!) -->
                        <button 
                            @click.stop="showTaxModal = true" 
                            class="btn btn-xs sm:btn-sm btn-outline btn-success font-bold gap-1 shadow-sm shrink-0 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            title="Open IRS Tax Write-Offs & Schedule C Playbook"
                        >
                            <Icon icon="solar:book-bookmark-bold-duotone" class="w-3.5 h-3.5" />
                            <span class="text-xs whitespace-nowrap">Playbook</span>
                        </button>

                        <!-- Chevron Button -->
                        <button 
                            type="button" 
                            class="btn btn-ghost btn-xs btn-circle shrink-0 hover:bg-base-300"
                            :aria-expanded="!isCollapsed.insights"
                            aria-label="Toggle AI Business Insights"
                        >
                            <Icon 
                                icon="solar:alt-arrow-down-linear" 
                                class="w-4 h-4 transition-transform duration-200" 
                                :class="{ '-rotate-90': isCollapsed.insights }" 
                            />
                        </button>
                    </div>
                </div>
            </div>

            <!-- Area 2 Content (Collapsible) -->
            <div v-show="!isCollapsed.insights" class="p-3 sm:p-5 space-y-3.5">
                <!-- Filter Segmented Tabs (Defaulting to Inventory Alerts first!) -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div class="flex items-center gap-1 bg-base-300/60 p-1 rounded-xl overflow-x-auto max-w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        <button 
                            @click="activeInsightCategory = 'inventory'"
                            class="btn btn-xs sm:btn-sm rounded-lg font-bold gap-1.5 shrink-0 transition-all"
                            :class="activeInsightCategory === 'inventory' ? 'btn-warning text-warning-content shadow-sm' : 'btn-ghost text-base-content/75'"
                        >
                            <Icon icon="solar:box-bold" class="w-3.5 h-3.5 shrink-0" />
                            <span class="whitespace-nowrap">Inventory Alerts</span>
                            <span class="badge badge-2xs sm:badge-xs font-bold whitespace-nowrap" :class="activeInsightCategory === 'inventory' ? 'badge-neutral' : 'badge-warning text-warning-content'">{{ inventoryInsights.length }}</span>
                        </button>

                        <button 
                            @click="activeInsightCategory = 'tax'"
                            class="btn btn-xs sm:btn-sm rounded-lg font-bold gap-1.5 shrink-0 transition-all"
                            :class="activeInsightCategory === 'tax' ? 'btn-success text-success-content shadow-sm' : 'btn-ghost text-base-content/75'"
                        >
                            <Icon icon="solar:dollar-minimalistic-bold" class="w-3.5 h-3.5 shrink-0" />
                            <span class="whitespace-nowrap">Tax Write-Offs</span>
                            <span class="badge badge-2xs sm:badge-xs font-bold whitespace-nowrap" :class="activeInsightCategory === 'tax' ? 'badge-neutral' : 'badge-success text-success-content'">{{ taxInsights.length }}</span>
                        </button>

                        <button 
                            @click="activeInsightCategory = 'all'"
                            class="btn btn-xs sm:btn-sm rounded-lg font-bold gap-1.5 shrink-0 transition-all"
                            :class="activeInsightCategory === 'all' ? 'btn-primary text-primary-content shadow-sm' : 'btn-ghost text-base-content/75'"
                        >
                            <span class="whitespace-nowrap">All</span>
                            <span class="badge badge-2xs sm:badge-xs whitespace-nowrap font-bold" :class="activeInsightCategory === 'all' ? 'badge-neutral' : 'badge-ghost'">{{ insights.length }}</span>
                        </button>
                    </div>

                    <span class="text-[11px] text-base-content/60 hidden md:inline whitespace-nowrap">
                        Showing {{ filteredInsights.length }} of {{ insights.length }} recommendations
                    </span>
                </div>

                <!-- Insights Cards Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                    <a 
                        v-for="(insight, idx) in filteredInsights" 
                        :key="idx"
                        :href="insight.link || `/inventory?insightFilter=${insight.filter}`" 
                        class="flex flex-col justify-between text-sm p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group hover:shadow-lg"
                        :class="insight.category === 'tax' 
                            ? 'bg-base-100 border-success/30 hover:border-success/80 shadow-sm' 
                            : 'bg-base-100 border-base-300 hover:border-warning/80 shadow-sm'"
                    >
                        <div>
                            <!-- Badge Row -->
                            <div class="flex flex-wrap items-center justify-between gap-1.5 mb-2">
                                <span 
                                    v-if="insight.category === 'tax'" 
                                    class="badge badge-xs badge-success text-success-content font-extrabold whitespace-nowrap gap-1 shadow-xs uppercase tracking-wider text-[10px] shrink-0"
                                >
                                    <Icon icon="solar:verified-check-bold" class="w-3 h-3" />
                                    Tax Write-Off
                                </span>
                                <span 
                                    v-else 
                                    class="badge badge-xs badge-warning text-warning-content font-extrabold whitespace-nowrap gap-1 shadow-xs uppercase tracking-wider text-[10px] shrink-0"
                                >
                                    <Icon icon="solar:box-bold" class="w-3 h-3" />
                                    Inventory Alert
                                </span>

                                <span 
                                    v-if="insight.scheduleC" 
                                    class="badge badge-xs badge-outline font-mono text-[10px] text-base-content/75 whitespace-nowrap shrink-0 ml-auto"
                                >
                                    {{ insight.scheduleC }}
                                </span>
                            </div>

                            <!-- Title & Icon -->
                            <div class="flex items-start gap-2 font-bold mb-1 text-base-content group-hover:text-primary transition-colors text-xs sm:text-sm">
                                <Icon 
                                    :icon="insight.icon || 'solar:info-circle-bold-duotone'" 
                                    class="w-4.5 h-4.5 flex-shrink-0 mt-0.5" 
                                    :class="insight.category === 'tax' ? 'text-success' : (insight.type === 'error' ? 'text-error' : 'text-warning')" 
                                />
                                <span class="leading-snug">{{ insight.title }}</span>
                            </div>

                            <!-- Description -->
                            <p class="opacity-75 text-[11px] sm:text-xs leading-relaxed text-base-content">
                                {{ insight.description }}
                            </p>
                        </div>

                        <!-- Action Link Footer -->
                        <div class="mt-3 pt-2 border-t border-base-200 flex items-center justify-between text-xs font-bold text-primary group-hover:text-primary-focus">
                            <span>{{ insight.actionText || 'Take Action' }}</span>
                            <Icon icon="solar:arrow-right-linear" class="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                        </div>
                    </a>
                </div>
            </div>
        </div>

        <!-- IRS TAX WRITE-OFF & SCHEDULE C PLAYBOOK MODAL -->
        <div v-if="showTaxModal" class="modal modal-open z-50">
                <div class="modal-box max-w-2xl bg-base-100 border border-success/30 shadow-2xl p-5 sm:p-7 relative max-h-[90vh] overflow-y-auto">
                    <button 
                        @click="showTaxModal = false" 
                        class="btn btn-sm btn-circle btn-ghost absolute right-4 top-4 hover:bg-base-200"
                        title="Close Playbook"
                    >
                        ✕
                    </button>

                    <div class="flex items-center gap-3 mb-4 pb-3 border-b border-base-200">
                        <div class="w-11 h-11 rounded-xl bg-success/10 flex items-center justify-center text-success flex-shrink-0">
                            <Icon icon="solar:book-bookmark-bold-duotone" class="w-6 h-6" />
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <h3 class="font-extrabold text-lg sm:text-xl text-base-content">
                                    Resale Tax &amp; OpEx Playbook
                                </h3>
                                <span class="badge badge-sm badge-success text-success-content font-bold whitespace-nowrap">IRS Schedule C</span>
                            </div>
                            <p class="text-xs text-base-content/70">
                                Official expense &amp; tax write-off rules for Huckleberry Collective LLC
                            </p>
                        </div>
                    </div>

                    <div class="space-y-3.5 text-xs text-base-content">
                        <!-- Rule 1: Sourcing Mileage -->
                        <div class="p-3.5 rounded-xl bg-base-200/60 border border-base-300">
                            <div class="flex flex-wrap items-center justify-between gap-1.5 font-bold text-sm mb-1.5 text-base-content">
                                <span class="flex items-center gap-2">
                                    <Icon icon="solar:routing-2-bold-duotone" class="w-4 h-4 text-success" />
                                    1. Sourcing Mileage &amp; Travel
                                </span>
                                <span class="badge badge-xs badge-success text-success-content font-mono font-bold whitespace-nowrap shrink-0">Line 24a</span>
                            </div>
                            <p class="text-base-content/80 leading-relaxed">
                                Sourcing trips to thrift stores, estate sales, flea markets, and restocking trips to Memory Den or DustyTiger qualify for the standard IRS mileage rate of <strong>$0.67 per mile</strong>. Logging 1,500 sourcing miles generates an immediate <strong>$1,005 write-off</strong> against taxable income.
                            </p>
                        </div>

                        <!-- Rule 2: Booth Rent & Consignment -->
                        <div class="p-3.5 rounded-xl bg-base-200/60 border border-base-300">
                            <div class="flex flex-wrap items-center justify-between gap-1.5 font-bold text-sm mb-1.5 text-base-content">
                                <span class="flex items-center gap-2">
                                    <Icon icon="solar:shop-2-bold-duotone" class="w-4 h-4 text-info" />
                                    2. Memory Den Booth Rent &amp; Mall Fees
                                </span>
                                <span class="badge badge-xs badge-info text-info-content font-mono font-bold whitespace-nowrap shrink-0">Line 20b</span>
                            </div>
                            <p class="text-base-content/80 leading-relaxed">
                                Monthly booth rental fees and consignment commission percentages deducted by antique mall operators are <strong>100% tax-deductible Operating Expenses</strong> under Rent for Business Property (Line 20b).
                            </p>
                        </div>

                        <!-- Rule 3: Online Marketplace Seller & Processing Fees -->
                        <div class="p-3.5 rounded-xl bg-base-200/60 border border-base-300">
                            <div class="flex flex-wrap items-center justify-between gap-1.5 font-bold text-sm mb-1.5 text-base-content">
                                <span class="flex items-center gap-2">
                                    <Icon icon="solar:ticket-sale-bold-duotone" class="w-4 h-4 text-primary" />
                                    3. Online Marketplace Fees (eBay, Poshmark, Etsy)
                                </span>
                                <span class="badge badge-xs badge-primary text-primary-content font-mono font-bold whitespace-nowrap shrink-0">Line 10</span>
                            </div>
                            <p class="text-base-content/80 leading-relaxed">
                                Marketplace Final Value fees (10–20%), payment processing charges (2.9% + $0.30), insertion fees, and promoted listing ad spend are <strong>100% tax-deductible commissions &amp; fees</strong> under Schedule C Line 10.
                            </p>
                        </div>

                        <!-- Rule 4: Shipping Postage & Packaging Supplies -->
                        <div class="p-3.5 rounded-xl bg-base-200/60 border border-base-300">
                            <div class="flex flex-wrap items-center justify-between gap-1.5 font-bold text-sm mb-1.5 text-base-content">
                                <span class="flex items-center gap-2">
                                    <Icon icon="solar:box-minimalistic-bold-duotone" class="w-4 h-4 text-success" />
                                    4. Shipping Postage &amp; Packaging Supplies
                                </span>
                                <span class="badge badge-xs badge-success text-success-content font-mono font-bold whitespace-nowrap shrink-0">Line 22 &amp; 27a</span>
                            </div>
                            <p class="text-base-content/80 leading-relaxed">
                                Commercial shipping labels bought via Pirate Ship, eBay, or USPS are deductible under Line 27a (Other Expenses / Postage). Boxes, poly mailers, bubble wrap, packing tape, and thermal printer labels are 100% deductible as <strong>Supplies (Line 22)</strong> in the year purchased.
                            </p>
                        </div>

                        <!-- Rule 5: 1099-K Gross vs Net Reconciliation Trap -->
                        <div class="p-3.5 rounded-xl bg-warning/10 border border-warning/30">
                            <div class="flex flex-wrap items-center justify-between gap-1.5 font-bold text-sm mb-1.5 text-base-content">
                                <span class="flex items-center gap-2">
                                    <Icon icon="solar:shield-warning-bold-duotone" class="w-4 h-4 text-warning" />
                                    5. Form 1099-K Gross vs. Net Tax Trap
                                </span>
                                <span class="badge badge-xs badge-warning text-warning-content font-mono font-bold whitespace-nowrap shrink-0">Line 1–2</span>
                            </div>
                            <p class="text-base-content/80 leading-relaxed">
                                Online platforms report <strong>GROSS buyer payments</strong> (including sales tax and buyer-paid shipping) to the IRS. If you only record your bank deposit net payouts without claiming marketplace fees and shipping costs, you will pay income tax on money you never kept!
                            </p>
                        </div>

                        <!-- Rule 6: Software & AI Subscriptions -->
                        <div class="p-3.5 rounded-xl bg-base-200/60 border border-base-300">
                            <div class="flex flex-wrap items-center justify-between gap-1.5 font-bold text-sm mb-1.5 text-base-content">
                                <span class="flex items-center gap-2">
                                    <Icon icon="solar:cpu-bolt-bold-duotone" class="w-4 h-4 text-primary" />
                                    6. Software, POS &amp; Gemini AI API
                                </span>
                                <span class="badge badge-xs badge-primary text-primary-content font-mono font-bold whitespace-nowrap shrink-0">Line 27a</span>
                            </div>
                            <p class="text-base-content/80 leading-relaxed">
                                Ricochet POS subscriptions, website hosting, and Gemini AI API usage for item scouting &amp; OCR are 100% tax-deductible under Other Business Expenses (Line 27a). Track and log your monthly AI spend right from the dashboard tracker below.
                            </p>
                        </div>

                        <!-- Rule 7: Cash Sourcing Cohan Rule -->
                        <div class="p-3.5 rounded-xl bg-base-200/60 border border-base-300">
                            <div class="flex flex-wrap items-center justify-between gap-1.5 font-bold text-sm mb-1.5 text-base-content">
                                <span class="flex items-center gap-2">
                                    <Icon icon="solar:wallet-money-bold-duotone" class="w-4 h-4 text-warning" />
                                    7. Cash Purchases Without Receipts (Cohan Rule)
                                </span>
                                <span class="badge badge-xs badge-warning text-warning-content font-mono font-bold whitespace-nowrap shrink-0">Cohan Rule</span>
                            </div>
                            <p class="text-base-content/80 leading-relaxed">
                                Under <em>Cohan v. Commissioner</em>, buying at estate sales or Craigslist with cash is tax-deductible without a register receipt by keeping a contemporaneous 5-point log: <strong>Date, Item Description, Cash Amount, Vendor/Location, and Business Purpose</strong> + photo evidence.
                            </p>
                        </div>

                        <!-- Rule 8: De Minimis Safe Harbor -->
                        <div class="p-3.5 rounded-xl bg-base-200/60 border border-base-300">
                            <div class="flex flex-wrap items-center justify-between gap-1.5 font-bold text-sm mb-1.5 text-base-content">
                                <span class="flex items-center gap-2">
                                    <Icon icon="solar:shield-check-bold" class="w-4 h-4 text-accent" />
                                    8. Booth Fixtures Safe Harbor (&lt;$2,500)
                                </span>
                                <span class="badge badge-xs badge-accent text-accent-content font-mono font-bold whitespace-nowrap shrink-0">Safe Harbor</span>
                            </div>
                            <p class="text-base-content/80 leading-relaxed">
                                Under the IRS De Minimis Safe Harbor election, tangible business equipment costing up to $2,500 per invoice (such as glass display showcases, chrome garment racks, mannequins, and thermal label printers) can be expensed immediately in Year 1 rather than depreciating over 5–7 years.
                            </p>
                        </div>
                    </div>

                    <div class="modal-action mt-5 pt-3 border-t border-base-200 flex flex-wrap items-center justify-between gap-2">
                        <a 
                            href="/purchases" 
                            class="btn btn-sm btn-outline gap-1.5"
                        >
                            <Icon icon="solar:cart-large-minimalistic-linear" class="w-4 h-4" />
                            <span>Go to Purchases &amp; Expenses</span>
                        </a>

                        <button 
                            @click="showTaxModal = false" 
                            class="btn btn-sm btn-primary text-primary-content font-bold px-5"
                        >
                            Close Playbook
                        </button>
                    </div>
                </div>
            </div>

        <!-- GEMINI AI USAGE & COST MONITOR (ADMIN ONLY) -->
        <AiUsageCard v-if="isAdmin" />
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { useDashboardMetrics } from '../../composables/dashboard/useDashboardMetrics';
import { useLoader } from '../../composables/useLoader';
import { useAuth } from '../../composables/useAuth';
import AiUsageCard from './AiUsageCard.vue';
import OperationsRadarGrid from './OperationsRadarGrid.vue';

const { isAdmin } = useAuth();

const {
    loading,
    totalItemsCount,
    globalProfit,
    globalProjectedRevenue,
    globalSunkCost,
    totalSpentPurchases,
    totalPurchasesCount,
    insights,
    initDashboard
} = useDashboardMetrics();

// Default to 'inventory' (Actionable Inventory Alerts) instead of static tax rules
const activeInsightCategory = ref<'all' | 'tax' | 'inventory'>('inventory');
const showTaxModal = ref(false);

// Collapsible Sections State (Default: true / Collapsed)
const isCollapsed = ref({
    overview: true,
    insights: true
});

const allCollapsed = computed(() => isCollapsed.value.overview && isCollapsed.value.insights);

const toggleSection = (section: 'overview' | 'insights') => {
    isCollapsed.value[section] = !isCollapsed.value[section];
    try {
        localStorage.setItem(`rc_dash_collapsed_${section}`, String(isCollapsed.value[section]));
    } catch {}
};

const toggleAllSections = () => {
    const targetState = !allCollapsed.value;
    isCollapsed.value.overview = targetState;
    isCollapsed.value.insights = targetState;
    try {
        localStorage.setItem('rc_dash_collapsed_overview', String(targetState));
        localStorage.setItem('rc_dash_collapsed_insights', String(targetState));
        // Signal to AiUsageCard or other listener components
        window.dispatchEvent(new CustomEvent('rc:toggle-all-dashboard', { detail: { collapse: targetState } }));
    } catch {}
};

const taxInsights = computed(() => (insights.value || []).filter(i => i.category === 'tax'));
const inventoryInsights = computed(() => (insights.value || []).filter(i => i.category === 'inventory'));

const filteredInsights = computed(() => {
    if (activeInsightCategory.value === 'tax') return taxInsights.value;
    if (activeInsightCategory.value === 'inventory') return inventoryInsights.value;
    return insights.value || [];
});

const { showLoader } = useLoader();
showLoader("Loading Dashboard...");

onMounted(() => {
    try {
        const savedOverview = localStorage.getItem('rc_dash_collapsed_overview');
        if (savedOverview !== null) {
            isCollapsed.value.overview = savedOverview === 'true';
        } else {
            isCollapsed.value.overview = true;
        }

        const savedInsights = localStorage.getItem('rc_dash_collapsed_insights');
        if (savedInsights !== null) {
            isCollapsed.value.insights = savedInsights === 'true';
        } else {
            isCollapsed.value.insights = true;
        }
    } catch {}
    initDashboard();
});
</script>
