<template>
    <div class="space-y-4">
        <!-- ============================================================= -->
        <!-- 0. EXIT STRATEGY & PROFIT PLAYBOOK (Unified Command Center)   -->
        <!-- ============================================================= -->
        <div v-if="availablePlays && availablePlays.length > 0" class="bg-base-200/90 rounded-box p-4 border-2 border-secondary/40 space-y-4 shadow-sm">
            <!-- Header with Title, Category, and AI Learning Pill -->
            <div class="flex items-center justify-between border-b border-base-300 pb-3 gap-2 flex-wrap">
                <div class="flex items-center gap-2 min-w-0">
                    <div class="w-8 h-8 rounded-box bg-secondary/15 text-secondary flex items-center justify-center shrink-0">
                        <Icon icon="solar:clipboard-check-bold" class="w-5 h-5" />
                    </div>
                    <div class="min-w-0">
                        <h4 class="font-black text-xs sm:text-sm uppercase tracking-wider text-base-content flex items-center gap-2 flex-wrap">
                            <span>Resale Profit Playbook</span>
                            <span class="badge badge-xs font-mono font-bold bg-base-100 text-base-content/80 border border-base-300 uppercase">
                                {{ isLot ? 'Lot / Multi-Piece' : 'Single Catalog Item' }}
                            </span>
                        </h4>
                        <div class="flex items-center gap-2 text-[11px] opacity-75 mt-0.5 flex-wrap">
                            <span>Category: <strong class="capitalize">{{ itemCategory.replace('_', ' ') }}</strong></span>
                            <span v-if="totalPlaysRecorded > 0" class="badge badge-xs badge-info/20 text-info font-medium gap-1 border-0">
                                <Icon icon="solar:magic-stick-bold" class="w-3 h-3" />
                                Trained on {{ totalPlaysRecorded }} past play{{ totalPlaysRecorded === 1 ? '' : 's' }}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Active Play Primary CTA & AI Catalog Matching Shortcuts -->
                <div class="flex items-center gap-1.5 flex-wrap shrink-0">
                    <button 
                        v-if="currentPlay"
                        type="button" 
                        class="btn btn-xs sm:btn-sm font-black gap-1.5 shadow-sm shrink-0 active:scale-95 transition-all"
                        :class="currentPlay.strategyType === 'lot_split' 
                            ? 'btn-secondary text-secondary-content' 
                            : (currentPlay.strategyType === 'bundle_combine' 
                                ? 'btn-accent text-accent-content' 
                                : (currentPlay.strategyType === 'volume_combine'
                                    ? 'btn-info text-info-content'
                                    : (currentPlay.strategyType === 'restock'
                                        ? 'btn-warning text-warning-content'
                                        : 'btn-primary text-primary-content')))"
                        @click="handleExecutePlay(currentPlay)"
                        :title="currentPlay.tagline"
                    >
                        <Icon :icon="currentPlay.icon" class="w-4 h-4" />
                        <span v-if="currentPlay.strategyType === 'lot_split'">Launch Lot Splitter</span>
                        <span v-else-if="currentPlay.strategyType === 'bundle_combine'">Open Companion Bundler</span>
                        <span v-else-if="currentPlay.strategyType === 'volume_combine'">Create Volume Batch</span>
                        <span v-else-if="currentPlay.strategyType === 'restock'">
                            {{ currentPlay.id === 'restock_merge' ? 'Merge into Active Batch' : 'Restock Units into Batch' }}
                        </span>
                        <span v-else>Apply Play to Item (${{ Math.round(currentPlay.targetPrice || currentPlay.projectedYield) }}.00)</span>
                    </button>

                    <button 
                        type="button" 
                        class="btn btn-xs btn-outline btn-secondary font-bold gap-1 shrink-0" 
                        @click="$emit('open-combine', item)" 
                        title="Find matching items in your inventory catalog to batch together"
                    >
                        <Icon icon="solar:magic-stick-3-bold" class="w-3.5 h-3.5" />
                        <span>AI Batch Catalog</span>
                    </button>
                    <button 
                        type="button" 
                        class="btn btn-xs btn-outline btn-accent font-bold gap-1 shrink-0" 
                        @click="$emit('open-bundle', item)" 
                        title="Find companion items in your inventory catalog to bundle together"
                    >
                        <Icon icon="solar:gift-bold" class="w-3.5 h-3.5" />
                        <span>AI Bundle Catalog</span>
                    </button>
                </div>
            </div>

            <!-- Collapsible Strategic Play Selector -->
            <div class="space-y-2">
                <div class="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider opacity-60">
                    <span class="flex items-center gap-1.5">
                        <Icon icon="solar:chart-square-bold" class="w-3.5 h-3.5 text-secondary" />
                        <span>Strategic Playbook</span>
                    </span>
                    <span>{{ availablePlays.length }} Plays Generated</span>
                </div>

                <!-- Active / Selected Play Card (Clicking toggles dropdown/accordion) -->
                <div 
                    class="rounded-xl border transition-all cursor-pointer select-none bg-base-100 shadow-xs"
                    :class="isPlaySelectorOpen 
                        ? 'border-secondary ring-2 ring-secondary/30' 
                        : 'border-base-300 hover:border-secondary/50 hover:bg-base-200/40'"
                    @click="isPlaySelectorOpen = !isPlaySelectorOpen"
                >
                    <div class="p-3 flex items-center justify-between gap-3">
                        <div class="flex items-center gap-2.5 min-w-0">
                            <div class="w-8 h-8 rounded-lg bg-secondary/15 text-secondary flex items-center justify-center shrink-0">
                                <Icon :icon="currentPlay?.icon || 'solar:play-circle-bold'" class="w-4 h-4" />
                            </div>
                            <div class="min-w-0">
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    <strong class="text-xs sm:text-sm font-bold text-base-content">{{ currentPlay?.name || 'Select Play' }}</strong>
                                    <span v-if="currentPlay?.isRecommended" class="badge badge-xs badge-secondary font-black">Top Pick</span>
                                    <span v-else-if="currentPlay?.badge" class="badge badge-xs font-bold" :class="currentPlay.badgeClass">{{ currentPlay.badge }}</span>
                                </div>
                                <span class="text-[10px] opacity-60 truncate block mt-0.5">
                                    {{ currentPlay?.summary || 'Choose a strategic sales play for this item' }}
                                </span>
                            </div>
                        </div>

                        <!-- Right Stats & Dropdown Toggle Pill -->
                        <div class="flex items-center gap-2 shrink-0">
                            <div class="text-right hidden sm:block font-mono">
                                <div class="text-xs font-bold text-base-content">
                                    <span class="text-[9px] uppercase opacity-50 font-sans mr-0.5">Tag:</span>${{ Math.round(currentPlay?.projectedYield || 0) }}
                                </div>
                                <div class="text-[10px] font-bold text-success leading-none">
                                    +${{ Math.round(currentPlay?.netProfit || 0) }} profit
                                </div>
                            </div>
                            <button 
                                type="button" 
                                class="btn btn-xs gap-1 border font-bold"
                                :class="isPlaySelectorOpen ? 'btn-secondary text-secondary-content' : 'btn-ghost border-base-300'"
                            >
                                <span class="text-[11px]">{{ isPlaySelectorOpen ? 'Close' : 'Change Play' }}</span>
                                <Icon :icon="isPlaySelectorOpen ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'" class="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    <!-- Collapsible Play Options Drawer -->
                    <div 
                        v-if="isPlaySelectorOpen" 
                        class="p-2.5 pt-0 border-t border-base-200/80 space-y-1.5 bg-base-200/30 rounded-b-xl"
                        @click.stop
                    >
                        <div class="text-[10px] uppercase font-bold tracking-wider opacity-60 py-1 flex items-center justify-between">
                            <span>Available Strategic Strategies ({{ availablePlays.length }}):</span>
                            <span>Click any play to apply</span>
                        </div>

                        <div 
                            v-for="play in availablePlays" 
                            :key="play.id"
                            @click="selectPlay(play.id)"
                            class="p-2.5 rounded-lg border text-left transition-all flex items-center justify-between gap-3 cursor-pointer select-none"
                            :class="selectedPlayId === play.id 
                                ? 'border-secondary bg-secondary/10 ring-1 ring-secondary/40 shadow-xs' 
                                : 'border-base-300/80 bg-base-100 hover:border-secondary/40 hover:bg-base-200/60'"
                        >
                            <div class="flex items-center gap-2.5 min-w-0">
                                <div 
                                    class="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                                    :class="selectedPlayId === play.id ? 'bg-secondary text-secondary-content' : 'bg-base-200 text-base-content/70'"
                                >
                                    <Icon :icon="selectedPlayId === play.id ? 'solar:check-circle-bold' : play.icon" class="w-3.5 h-3.5" />
                                </div>
                                <div class="min-w-0">
                                    <div class="flex items-center gap-1.5 flex-wrap">
                                        <strong class="text-xs font-bold text-base-content">{{ play.name }}</strong>
                                        <span v-if="play.isRecommended" class="badge badge-2xs badge-secondary font-black">Top Pick</span>
                                        <span v-else class="badge badge-2xs font-bold" :class="play.badgeClass">{{ play.badge }}</span>
                                    </div>
                                    <p class="text-[10px] opacity-70 truncate max-w-sm sm:max-w-md mt-0.5 leading-tight">{{ play.summary }}</p>
                                </div>
                            </div>

                            <div class="flex items-center gap-3 shrink-0 text-right font-mono">
                                <div>
                                    <div class="text-xs font-bold text-base-content">${{ Math.round(play.projectedYield) }}</div>
                                    <div class="text-[10px] font-bold text-success">+${{ Math.round(play.netProfit) }}</div>
                                </div>
                                <span class="badge badge-xs" :class="selectedPlayId === play.id ? 'badge-secondary' : 'badge-ghost opacity-60'">
                                    {{ selectedPlayId === play.id ? 'Active' : 'Select' }}
                                </span>
                            </div>
                        </div>

                        <div class="flex justify-end pt-1">
                            <button 
                                type="button" 
                                @click="isPlaySelectorOpen = false" 
                                class="btn btn-xs btn-ghost gap-1 opacity-70 hover:opacity-100 text-[11px]"
                            >
                                <Icon icon="solar:alt-arrow-up-linear" class="w-3 h-3" />
                                <span>Collapse Options</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Active Play Detail Showcase -->
            <div v-if="currentPlay" class="space-y-3 pt-1">
                <!-- Rationale & Recommendation Banner -->
                <div class="p-3 bg-base-100 rounded-box border border-base-300 space-y-1">
                    <div class="flex items-center justify-between gap-2 flex-wrap">
                        <div class="flex items-center gap-1.5">
                            <Icon :icon="currentPlay.icon" class="w-4 h-4 text-secondary" />
                            <strong class="text-xs font-black text-base-content">{{ currentPlay.name }}</strong>
                        </div>
                        <span v-if="currentPlay.recommendationReason" class="text-[10px] font-bold text-secondary flex items-center gap-1">
                            {{ currentPlay.recommendationReason }}
                        </span>
                    </div>
                    <p class="text-[11px] opacity-80 leading-relaxed">{{ currentPlay.summary }}</p>
                </div>

                <!-- Financial Comparison Grid (Cost -> Gross -> Take-Home -> Profit) -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div class="p-2 bg-base-100 rounded-box border border-base-300">
                        <span class="text-[9px] uppercase font-bold opacity-60 block">Landed Cost</span>
                        <strong class="font-mono text-warning text-xs sm:text-sm">${{ Number(totalCost || 0).toFixed(2) }}</strong>
                        <span class="text-[9px] opacity-50 block mt-0.5">Capital basis</span>
                    </div>
                    <div class="p-2 bg-base-100 rounded-box border border-secondary/40 bg-secondary/5">
                        <span class="text-[9px] uppercase font-bold text-secondary block">Sticker Tag</span>
                        <strong class="font-mono text-secondary text-xs sm:text-sm">${{ Number(currentPlay.projectedYield || 0).toFixed(2) }}</strong>
                        <span class="text-[9px] text-secondary/70 block mt-0.5">Gross sale price</span>
                    </div>
                    <div class="p-2 bg-base-100 rounded-box border border-info/40 bg-info/5">
                        <span class="text-[9px] uppercase font-bold text-info block">Take-Home Cash</span>
                        <strong class="font-mono text-info text-xs sm:text-sm">~${{ Number(currentPlay.netPayout || currentPlay.projectedYield || 0).toFixed(2) }}</strong>
                        <span class="text-[9px] text-info/70 block mt-0.5">After est. fees (-${{ Number(currentPlay.estFees || 0).toFixed(2) }})</span>
                    </div>
                    <div class="p-2 bg-base-100 rounded-box border border-success/40 bg-success/5">
                        <span class="text-[9px] uppercase font-bold text-success block">Clean Net Profit</span>
                        <strong class="font-mono text-success text-xs sm:text-sm">+${{ Number(currentPlay.netProfit || 0).toFixed(2) }}</strong>
                        <span class="text-[9px] text-success/80 font-bold block mt-0.5">+{{ Math.round(currentPlay.roiPct || 0) }}% ROI</span>
                    </div>
                </div>

                <!-- Execution Parameters Strip -->
                <div class="flex items-center justify-between gap-2 p-2 bg-base-100 rounded-box border border-base-300 text-[11px] flex-wrap">
                    <div class="flex items-center gap-1.5 opacity-80">
                        <Icon icon="solar:calendar-bold" class="w-3.5 h-3.5 text-info" />
                        <span>Est. Velocity: <strong>{{ currentPlay.velocityDays }}</strong></span>
                    </div>
                    <div class="flex items-center gap-1.5 opacity-80">
                        <Icon icon="solar:hammer-bold" class="w-3.5 h-3.5 text-warning" />
                        <span>Labor Effort: <strong>{{ currentPlay.laborEffort }}</strong></span>
                    </div>
                    <div class="flex items-center gap-1.5 opacity-80">
                        <Icon icon="solar:shop-2-bold" class="w-3.5 h-3.5 text-primary" />
                        <span>Channel: <strong>{{ currentPlay.targetChannels?.join(' / ') }}</strong></span>
                    </div>
                </div>

                <!-- Tiers / Execution Action Breakdown -->
                <div v-if="currentPlay.tiersBreakdown && currentPlay.tiersBreakdown.length > 0" class="space-y-1.5">
                    <span class="text-[10px] font-black uppercase tracking-wider text-base-content/70 block">
                        Play Execution Slices & Targets:
                    </span>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div 
                            v-for="(tier, tIdx) in currentPlay.tiersBreakdown" 
                            :key="tIdx" 
                            class="p-2.5 bg-base-100 rounded-box border border-base-300 text-xs space-y-1"
                        >
                            <div class="flex items-center justify-between gap-1.5">
                                <strong class="truncate text-base-content font-bold text-xs">{{ tier.title }}</strong>
                                <span class="badge badge-xs badge-success font-mono font-bold">{{ tier.price }}</span>
                            </div>
                            <div class="flex items-center justify-between text-[10px] opacity-70">
                                <span>{{ tier.channel }}</span>
                                <span class="font-bold text-secondary">{{ tier.purpose }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- ============================================================= -->
        <!-- 1. SOURCE & PROVENANCE (Sourcing Origin)                       -->
        <!-- ============================================================= -->
        <div class="bg-base-200/70 rounded-box p-4 border border-base-300 space-y-3 shadow-xs text-xs">
            <div class="flex items-center justify-between border-b border-base-300/70 pb-2">
                <span class="font-bold text-[10px] uppercase tracking-wider opacity-70 flex items-center gap-1.5">
                    <Icon icon="solar:document-medicine-bold" class="w-4 h-4 text-primary" />
                    Source & Provenance
                </span>
                <span v-if="item?.purchaseOrderNumber || item?.purchaseOrderId" class="badge badge-xs font-mono font-bold bg-primary/10 text-primary border-0">
                    PO: {{ item.purchaseOrderNumber || item.purchaseOrderId }}
                </span>
                <span v-else class="badge badge-xs badge-ghost opacity-60">Single Intake</span>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <!-- Sourcing Channel / Vendor -->
                <div class="space-y-0.5">
                    <span class="text-[10px] opacity-60 uppercase font-semibold block">Channel / Source</span>
                    <strong class="text-base-content text-xs block truncate capitalize">
                        {{ item?.source || item?.sourcingChannel || item?.vendor || 'General Intake' }}
                    </strong>
                </div>

                <!-- Acquired Date -->
                <div class="space-y-0.5">
                    <span class="text-[10px] opacity-60 uppercase font-semibold block">Acquired Date</span>
                    <strong class="text-base-content text-xs block font-mono">
                        {{ formattedAcquisitionDate }}
                    </strong>
                </div>

                <!-- Unit Cost Basis -->
                <div class="space-y-0.5">
                    <span class="text-[10px] opacity-60 uppercase font-semibold block">Unit Cost Basis</span>
                    <strong class="text-base-content text-xs block font-mono text-primary">
                        ${{ unitCost.toFixed(2) }}<span v-if="isMultiQty" class="text-[10px] opacity-60 font-normal">/ea</span>
                    </strong>
                </div>

                <!-- Total Lot Cost -->
                <div class="space-y-0.5">
                    <span class="text-[10px] opacity-60 uppercase font-semibold block">Total Cost Basis</span>
                    <strong class="text-base-content text-xs block font-mono">
                        ${{ totalCost.toFixed(2) }}
                    </strong>
                </div>
            </div>
        </div>

        <!-- ============================================================= -->
        <!-- 2. PARENT & SIBLINGS (Haul Hierarchy)                         -->
        <!-- ============================================================= -->
        <div v-if="item?.parentLotId || (siblingItems && siblingItems.length > 0)" class="space-y-2">
            <!-- Parent Haul Origin Banner with Complete Telemetry -->
            <div v-if="item?.parentLotId" class="bg-base-200/70 rounded-box p-3 sm:p-4 border border-base-300 space-y-2.5 shadow-xs text-xs">
                <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <Icon icon="solar:link-circle-bold" class="w-5 h-5 text-primary shrink-0" />
                        <div class="truncate">
                            <span class="opacity-70 text-[10px] block uppercase font-bold tracking-wider">Split from Parent Haul</span>
                            <strong class="text-base-content text-xs sm:text-sm truncate block">{{ parentItem?.title || item.parentLotId }}</strong>
                        </div>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                        <button 
                            v-if="parentItem"
                            type="button" 
                            class="btn btn-xs sm:btn-sm btn-primary gap-1 font-bold shadow-xs" 
                            @click="$emit('selectItem', parentItem)"
                        >
                            <Icon icon="solar:arrow-left-bold" class="w-3.5 h-3.5" />
                            <span>Open Parent</span>
                        </button>
                        <button 
                            v-if="siblingItems && siblingItems.length > 0"
                            type="button" 
                            class="btn btn-xs sm:btn-sm btn-ghost border border-base-300 font-bold gap-1"
                            @click="showSiblingDrawer = !showSiblingDrawer"
                        >
                            <Icon :icon="showSiblingDrawer ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'" class="w-3.5 h-3.5" />
                            <span>{{ showSiblingDrawer ? 'Hide' : 'View' }} Siblings ({{ siblingItems.length }})</span>
                        </button>
                    </div>
                </div>

                <!-- Overall Parent Haul Telemetry Grid -->
                <div v-if="parentHaulCost > 0 || haulTotalValue > 0" class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-base-300/70 text-center font-mono">
                    <div class="p-1.5 bg-base-100 rounded-lg border border-base-300">
                        <span class="text-[9px] uppercase font-bold opacity-60 font-sans block">Haul Cost</span>
                        <strong class="text-xs text-base-content">${{ parentHaulCost.toFixed(2) }}</strong>
                    </div>
                    <div class="p-1.5 bg-base-100 rounded-lg border border-base-300">
                        <span class="text-[9px] uppercase font-bold opacity-60 font-sans block">Total Haul Value</span>
                        <strong class="text-xs text-primary">${{ haulTotalValue.toFixed(2) }}</strong>
                        <span class="text-[8px] opacity-60 font-sans block">Across {{ allHaulItems.length }} items</span>
                    </div>
                    <div class="p-1.5 bg-base-100 rounded-lg border border-base-300">
                        <span class="text-[9px] uppercase font-bold opacity-60 font-sans block">Realized Sales</span>
                        <strong class="text-xs text-success">${{ haulRealizedSales.toFixed(2) }}</strong>
                    </div>
                    <div class="p-1.5 bg-base-100 rounded-lg border border-base-300">
                        <span class="text-[9px] uppercase font-bold opacity-60 font-sans block">Est. Haul Profit</span>
                        <strong class="text-xs font-bold" :class="haulEstProfit >= 0 ? 'text-success' : 'text-error'">
                            {{ haulEstProfit >= 0 ? '+' : '' }}${{ haulEstProfit.toFixed(2) }}
                        </strong>
                        <span class="text-[8px] opacity-60 font-sans block">{{ haulRecoupedPct }}% recouped</span>
                    </div>
                </div>
            </div>

            <!-- Collapsible Sibling Items -->
            <div v-if="showSiblingDrawer && siblingItems && siblingItems.length > 0" class="bg-base-200/50 p-3 rounded-box border border-base-300 space-y-2 text-xs">
                <div class="flex justify-between items-center font-bold pb-1 border-b border-base-300">
                    <span>Sibling items extracted from same parent haul ({{ siblingItems.length }})</span>
                    <button type="button" @click="showSiblingDrawer = false" class="btn btn-2xs btn-ghost">✕</button>
                </div>
                <div class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    <div 
                        v-for="sibling in siblingItems" 
                        :key="sibling.$id" 
                        class="bg-base-100 p-2 rounded-box border flex items-center justify-between gap-2 cursor-pointer hover:border-primary transition-all"
                        :class="sibling.$id === item?.$id ? 'border-primary ring-1 ring-primary/30 bg-primary/5' : 'border-base-300'"
                        @click="$emit('selectItem', sibling)"
                    >
                        <div class="flex items-center gap-1.5 min-w-0">
                            <span class="badge badge-xs badge-ghost font-mono text-[9px]">{{ sibling.upc || 'NO-UPC' }}</span>
                            <span v-if="sibling.$id === item?.$id" class="badge badge-xs badge-primary font-bold text-[9px]">Current</span>
                            <span class="truncate font-medium">{{ sibling.title }}</span>
                        </div>
                        <span class="font-mono font-bold text-success shrink-0 text-xs">${{ Number(sibling.resalePrice || 0).toFixed(2) }}</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- ============================================================= -->
        <!-- 3. CONTENTS (When viewing a Lot / Bundle with Children)        -->
        <!-- ============================================================= -->
        <div v-if="lotChildren && lotChildren.length > 0" class="space-y-3">
            <!-- Financial ROI Telemetry Stats -->
            <div class="stats stats-horizontal shadow-xs w-full bg-base-200/80 border border-base-300 text-xs">
                <div class="stat px-3 py-2.5">
                    <div class="stat-title text-[10px] font-bold uppercase opacity-60">Bundle Cost</div>
                    <div class="stat-value text-sm sm:text-base font-mono">${{ Number(item?.cost || totalCost || 0).toFixed(2) }}</div>
                </div>
                <div class="stat px-3 py-2.5">
                    <div class="stat-title text-[10px] font-bold uppercase opacity-60">Listed Value</div>
                    <div class="stat-value text-sm sm:text-base text-primary font-mono">${{ (totalSplitResaleValue || 0).toFixed(2) }}</div>
                </div>
                <div class="stat px-3 py-2.5">
                    <div class="stat-title text-[10px] font-bold uppercase opacity-60">Realized Sales</div>
                    <div class="stat-value text-sm sm:text-base text-success font-mono">${{ (lotRealizedRevenue || 0).toFixed(2) }}</div>
                </div>
                <div class="stat px-3 py-2.5">
                    <div class="stat-title text-[10px] font-bold uppercase opacity-60">Est. Profit</div>
                    <div class="stat-value text-sm sm:text-base font-mono font-bold" :class="(lotROI || 0) >= 0 ? 'text-success' : 'text-error'">
                        {{ (lotROI || 0) >= 0 ? '+' : '' }}${{ (lotROI || 0).toFixed(2) }}
                    </div>
                </div>
            </div>

            <!-- Contents Child Items List -->
            <div class="bg-base-200/60 rounded-box p-4 border border-base-300 space-y-3 shadow-xs">
                <div class="flex items-center justify-between border-b border-base-300 pb-2.5">
                    <h4 class="font-bold text-xs uppercase tracking-wider text-base-content flex items-center gap-1.5">
                        <Icon icon="solar:box-minimalistic-bold" class="w-4 h-4 text-secondary" />
                        <span>Contents ({{ lotChildren.length }} Items)</span>
                    </h4>
                    <button 
                        type="button" 
                        class="btn btn-2xs sm:btn-xs btn-outline btn-error font-bold gap-1 shrink-0" 
                        @click="$emit('uncombine')" 
                        :disabled="uncombining"
                        title="Restore constituent child items back into individual active inventory and remove this lot"
                    >
                        <span v-if="uncombining" class="loading loading-spinner loading-2xs"></span>
                        <Icon v-else icon="solar:restart-bold" class="w-3.5 h-3.5" />
                        <span>Deconstruct Lot</span>
                    </button>
                </div>

                <div class="space-y-2 max-h-80 overflow-y-auto pr-1">
                    <div 
                        v-for="child in lotChildren" 
                        :key="child.$id" 
                        class="bg-base-100 p-2.5 rounded-box border border-base-300 flex items-center justify-between gap-3 shadow-xs hover:border-primary/50 transition-all cursor-pointer group"
                        @click="$emit('selectItem', child)"
                        title="Click to inspect this child item"
                    >
                        <div class="flex items-center gap-2.5 min-w-0">
                            <ItemThumbnail :item="child" size="xs" class="w-9 h-9 pointer-events-none rounded-box shrink-0" />
                            <div class="min-w-0">
                                <div class="flex items-center gap-1.5">
                                    <span class="badge badge-xs badge-ghost font-mono font-bold">{{ child.upc || 'NO-UPC' }}</span>
                                    <span v-if="child.quantity > 1" class="badge badge-xs badge-accent font-bold">Qty: {{ child.quantity }}</span>
                                    <span class="badge badge-xs" :class="child.status === 'sold' ? 'badge-success' : 'badge-ghost'">{{ child.status }}</span>
                                </div>
                                <p class="text-xs font-bold truncate text-base-content mt-0.5 group-hover:text-primary transition-colors">{{ child.title }}</p>
                            </div>
                        </div>
                        <div class="text-right shrink-0 flex items-center gap-2.5">
                            <div>
                                <span class="text-xs font-bold text-success font-mono block">${{ Number(child.resalePrice || 0).toFixed(2) }}</span>
                                <span class="text-[10px] opacity-60 font-mono block">Cost: ${{ Number(child.cost || 0).toFixed(2) }}</span>
                            </div>
                            <Icon icon="solar:arrow-right-linear" class="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- ============================================================= -->
        <!-- 4. MOVEMENTS & LOCATION TRAIL                                 -->
        <!-- ============================================================= -->
        <div class="bg-base-200/70 rounded-box p-4 border border-base-300 space-y-2.5 shadow-xs text-xs">
            <span class="font-bold text-[10px] uppercase tracking-wider opacity-70 flex items-center gap-1.5">
                <Icon icon="solar:map-point-wave-bold" class="w-4 h-4 text-info" />
                Movement & Placement Trail
            </span>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <!-- Storage Location -->
                <div class="p-2 bg-base-100 rounded-box border border-base-300">
                    <span class="text-[10px] opacity-60 uppercase font-semibold block">Current Location</span>
                    <strong class="text-base-content text-xs font-mono block mt-0.5">
                        {{ item?.storageLocation || 'Unassigned' }}
                    </strong>
                </div>

                <!-- Status Progression -->
                <div class="p-2 bg-base-100 rounded-box border border-base-300">
                    <span class="text-[10px] opacity-60 uppercase font-semibold block">Lifecycle Status</span>
                    <div class="mt-0.5 flex items-center gap-1">
                        <span class="badge badge-xs font-bold uppercase" :class="item?.status === 'placed' ? 'badge-success' : 'badge-ghost'">
                            {{ item?.status || 'Active' }}
                        </span>
                        <span v-if="item?.channel" class="text-[10px] opacity-70">via {{ item.channel }}</span>
                    </div>
                </div>

                <!-- Drop Manifest Context -->
                <div class="p-2 bg-base-100 rounded-box border border-base-300">
                    <span class="text-[10px] opacity-60 uppercase font-semibold block">Outbound Drop</span>
                    <strong class="text-base-content text-xs block mt-0.5 truncate">
                        {{ item?.manifestId ? 'Staged in Manifest' : 'Ready in Storage' }}
                    </strong>
                </div>
            </div>
        </div>

        <!-- ============================================================= -->
        <!-- 5. LOCKED PRE-BUY SOURCING AUDIT (Historical Provenance Log)  -->
        <!-- ============================================================= -->
        <div v-if="sourcingAuditLog" class="collapse collapse-arrow bg-base-200/50 rounded-box border border-base-300 shadow-2xs text-xs">
            <input type="checkbox" />
            <div class="collapse-title font-bold text-xs flex items-center gap-2 text-base-content/80 select-none py-2.5 min-h-0">
                <Icon icon="solar:lock-bold" class="w-4 h-4 text-warning" />
                <span>Original Pre-Buy Sourcing Audit</span>
                <span class="badge badge-xs badge-neutral font-mono uppercase ml-1">{{ sourcingAuditLog.verdict || 'AUDIT LOG' }}</span>
            </div>
            <div class="collapse-content space-y-2.5 pt-1 text-xs">
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2.5 bg-base-100 rounded-box border border-base-300">
                    <div>
                        <span class="text-[10px] opacity-60 uppercase font-semibold block">Pre-Purchase Verdict</span>
                        <strong class="font-bold text-xs text-base-content">{{ sourcingAuditLog.verdict || 'N/A' }}</strong>
                    </div>
                    <div>
                        <span class="text-[10px] opacity-60 uppercase font-semibold block">Asking / Bid at Intake</span>
                        <strong class="font-mono text-xs text-base-content">{{ sourcingAuditLog.current_asking_price || (item?.cost ? `$${item.cost}` : 'N/A') }}</strong>
                    </div>
                    <div>
                        <span class="text-[10px] opacity-60 uppercase font-semibold block">Max Bid Ceiling</span>
                        <strong class="font-mono text-xs text-base-content">{{ sourcingAuditLog.max_bid ? `$${sourcingAuditLog.max_bid}` : 'N/A' }}</strong>
                    </div>
                </div>
                <div v-if="sourcingAuditLog.advice" class="p-2.5 bg-base-100 rounded-box border border-base-300 text-xs leading-relaxed opacity-80">
                    <span class="font-bold block text-[10px] uppercase opacity-60 mb-0.5">Sourcing Advice at Intake:</span>
                    {{ sourcingAuditLog.advice }}
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { Icon } from '@iconify/vue';
import ItemThumbnail from '../ItemThumbnail.vue';
import { deriveLotExitPlaybook, deriveInventoryPlays } from '../../../lib/lot-strategy';
import { usePlaybookLearning, detectItemCategory } from '../../../composables/usePlaybookLearning';

const props = defineProps({
    item: {
        type: Object,
        default: null
    },
    parentItem: {
        type: Object,
        default: null
    },
    lotChildren: {
        type: Array,
        default: () => []
    },
    siblingItems: {
        type: Array,
        default: () => []
    },
    uncombining: {
        type: Boolean,
        default: false
    },
    lotDashboardItem: {
        type: Object,
        default: null
    },
    totalSplitResaleValue: {
        type: Number,
        default: 0
    },
    lotRealizedRevenue: {
        type: Number,
        default: 0
    },
    lotROI: {
        type: Number,
        default: 0
    },
    inventoryItems: {
        type: Array,
        default: () => []
    },
    scoutResult: {
        type: [Object, Array],
        default: null
    },
    scoutPurchaseStrategy: {
        type: Object,
        default: null
    }
});

const emit = defineEmits([
    'selectItem', 
    'open-splitter', 
    'uncombine', 
    'refresh-lot',
    'open-bundle',
    'open-combine',
    'open-restock',
    'apply-single-play'
]);

const showSiblingDrawer = ref(false);

// Playbook Learning Composable
const { getCategoryAffinities, recordPlayExecution, totalPlaysRecorded } = usePlaybookLearning();

const isLot = computed(() => {
    const it = props.item;
    if (!it) return false;
    return !!(
        it.isLot || 
        it.status === 'combined' || 
        Number(it.quantity || 1) > 1 || 
        (Array.isArray(it.components) && it.components.length > 1) ||
        /\b(?:lot|bundle|crate|pack|collection)\b/i.test(it.title || '')
    );
});

const itemCategory = computed(() => detectItemCategory(props.item));
const categoryAffinities = computed(() => getCategoryAffinities(itemCategory.value));

const availablePlays = computed(() => {
    return deriveInventoryPlays(props.item, props.scoutResult, categoryAffinities.value, props.inventoryItems);
});

const selectedPlayId = ref('');

watch(availablePlays, (plays) => {
    if (plays && plays.length > 0) {
        if (!selectedPlayId.value || !plays.some(p => p.id === selectedPlayId.value)) {
            const rec = plays.find(p => p.isRecommended) || plays[0];
            selectedPlayId.value = rec.id;
        }
    }
}, { immediate: true });

const isPlaySelectorOpen = ref(false);

const selectPlay = (playId) => {
    selectedPlayId.value = playId;
    isPlaySelectorOpen.value = false;
};

// Parent Haul Financials
const parentHaulCost = computed(() => Number(props.parentItem?.cost || 0));
const allHaulItems = computed(() => {
    const list = [];
    if (props.item) list.push(props.item);
    if (props.siblingItems && props.siblingItems.length > 0) {
        list.push(...props.siblingItems);
    }
    return list;
});
const haulRealizedSales = computed(() => {
    return allHaulItems.value
        .filter(i => i.status === 'sold')
        .reduce((sum, i) => sum + (Number(i.soldPrice || i.price || 0)), 0);
});
const haulUnsoldListedValue = computed(() => {
    return allHaulItems.value
        .filter(i => i.status !== 'sold')
        .reduce((sum, i) => sum + (Number(i.resalePrice || i.boutiquePrice || 0) * Number(i.quantity || 1)), 0);
});
const haulTotalValue = computed(() => haulRealizedSales.value + haulUnsoldListedValue.value);
const haulEstProfit = computed(() => haulTotalValue.value - parentHaulCost.value);
const haulRecoupedPct = computed(() => {
    if (parentHaulCost.value <= 0) return 100;
    return Math.round((haulRealizedSales.value / parentHaulCost.value) * 100);
});

const currentPlay = computed(() => {
    if (!availablePlays.value || availablePlays.value.length === 0) return null;
    return availablePlays.value.find(p => p.id === selectedPlayId.value) || availablePlays.value[0];
});

const exitPlaybook = computed(() => {
    return currentPlay.value?.lotExitPlaybook || deriveLotExitPlaybook(props.item, props.scoutResult);
});

function handleExecutePlay(play) {
    if (!play) return;

    recordPlayExecution(play, props.item, {
        channel: play.targetChannels?.[0],
        targetPrice: play.targetPrice || play.projectedYield
    });

    if (play.strategyType === 'lot_split') {
        emit('open-splitter', { exitPlaybook: play.lotExitPlaybook || exitPlaybook.value, playId: play.id });
    } else if (play.strategyType === 'bundle_combine') {
        emit('open-bundle', play.executionAction?.payload?.item || props.item);
    } else if (play.strategyType === 'volume_combine') {
        emit('open-combine', play.executionAction?.payload?.item || props.item);
    } else if (play.strategyType === 'restock') {
        emit('open-restock', play.executionAction?.payload?.targetItem || props.item);
    } else if (play.strategyType === 'single_channel' || play.strategyType === 'liquidation') {
        emit('apply-single-play', {
            item: props.item,
            play,
            channel: play.targetChannels?.[0] || 'Memory Den',
            price: play.targetPrice || play.projectedYield
        });
    }
}

const sourcingAuditLog = computed(() => {
    if (props.scoutPurchaseStrategy) return props.scoutPurchaseStrategy;
    if (props.scoutResult?.purchase_strategy) return props.scoutResult.purchase_strategy;
    if (Array.isArray(props.scoutResult) && props.scoutResult[0]?.purchase_strategy) return props.scoutResult[0].purchase_strategy;
    return null;
});

const isMultiQty = computed(() => {
    return Number(props.item?.quantity || 1) > 1;
});

const totalCost = computed(() => {
    return Number(props.item?.cost || props.item?.purchasePrice || 0);
});

const unitCost = computed(() => {
    const qty = Math.max(1, Number(props.item?.quantity || 1));
    return totalCost.value / qty;
});

const formattedAcquisitionDate = computed(() => {
    const raw = props.item?.purchaseDate || props.item?.$createdAt;
    if (!raw) return 'N/A';
    try {
        const d = new Date(raw);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return raw;
    }
});
</script>
