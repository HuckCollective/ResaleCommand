<template>
    <div class="space-y-5">
        <!-- A. IF VIEWING A MAIN LOT (Has children, or qty > 1, or marked combined) -->
        <div v-if="isMainLot" class="space-y-4">
            <!-- Parent Lineage Banner (When viewing a sub-lot or multi-qty split from another collection) -->
            <div v-if="item?.parentLotId" class="bg-base-200/70 rounded-box p-3 sm:p-4 border border-base-300 flex items-center justify-between gap-3 shadow-xs text-xs">
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

            <!-- Collapsible Sibling Items extracted from same parent haul -->
            <div v-if="item?.parentLotId && showSiblingDrawer && siblingItems && siblingItems.length > 0" class="bg-base-200/50 p-3 rounded-box border border-base-300 space-y-2 text-xs">
                <div class="flex justify-between items-center font-bold pb-1 border-b border-base-300">
                    <span>Sibling items extracted from same parent haul ({{ siblingItems.length }})</span>
                    <button type="button" @click="showSiblingDrawer = false" class="btn btn-2xs btn-ghost">✕</button>
                </div>
                <div class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    <div v-for="sibling in siblingItems" :key="sibling.$id" 
                         class="bg-base-100 p-2 rounded-box border flex items-center justify-between gap-2 cursor-pointer hover:border-primary transition-all"
                         :class="sibling.$id === item.$id ? 'border-primary ring-1 ring-primary/30 bg-primary/5' : 'border-base-300'"
                         @click="$emit('selectItem', sibling)">
                        <div class="flex items-center gap-1.5 min-w-0">
                            <span class="badge badge-xs badge-ghost font-mono text-[9px]">{{ sibling.upc || 'NO-UPC' }}</span>
                            <span v-if="sibling.$id === item.$id" class="badge badge-xs badge-primary font-bold text-[9px]">Current</span>
                            <span class="truncate font-medium">{{ sibling.title }}</span>
                        </div>
                        <span class="font-mono font-bold text-success shrink-0 text-xs">${{ Number(sibling.resalePrice || 0).toFixed(2) }}</span>
                    </div>
                </div>
            </div>

            <!-- Top Action Toolbar -->
            <div class="flex flex-wrap items-center justify-between gap-2 bg-base-200/80 p-3 rounded-box border border-base-300 shadow-xs">
                <div class="flex items-center gap-2 flex-wrap">
                    <button 
                        type="button" 
                        class="btn btn-sm btn-secondary gap-1.5 font-bold shadow-xs hover:scale-105 transition-all"
                        @click="toggleAddItemsPanel"
                    >
                        <Icon icon="solar:add-circle-bold" class="w-4 h-4" />
                        <span>➕ Add Items to Lot</span>
                    </button>

                    <button 
                        type="button" 
                        class="btn btn-sm btn-ghost border border-secondary/30 text-secondary gap-1.5 font-bold shadow-xs hover:bg-secondary/10"
                        @click="fetchAiItemSuggestions"
                        :disabled="loadingAiMatches"
                        title="Token-efficient AI match: finds in-stock items with high synergy to add to this lot"
                    >
                        <span v-if="loadingAiMatches" class="loading loading-spinner loading-xs"></span>
                        <Icon v-else icon="solar:magic-stick-3-bold" class="w-4 h-4 text-secondary" />
                        <span>✨ AI Suggest Items</span>
                    </button>

                    <button 
                        type="button" 
                        class="btn btn-sm btn-primary btn-outline gap-1.5 font-bold shadow-xs"
                        @click="$emit('open-splitter')"
                    >
                        <Icon icon="solar:scissors-square-bold" class="w-4 h-4" />
                        <span>Lot Splitter</span>
                    </button>
                    
                    <button 
                        type="button"
                        class="btn btn-sm btn-ghost btn-outline gap-1 font-bold shadow-xs text-xs"
                        @click="viewInTable"
                        title="Filter inventory table to show items in this Main Lot"
                    >
                        <Icon icon="solar:filter-bold" class="w-3.5 h-3.5" />
                        <span>View Table</span>
                    </button>
                </div>

                <!-- Rollback / Uncombine Button -->
                <button 
                    v-if="lotChildren && lotChildren.length > 0"
                    type="button" 
                    class="btn btn-xs btn-outline btn-error font-bold gap-1 shrink-0" 
                    @click="$emit('uncombine')" 
                    :disabled="uncombining"
                    title="Restore original items and remove this Main Lot"
                >
                    <span v-if="uncombining" class="loading loading-spinner loading-xs"></span>
                    <Icon v-else icon="solar:restart-bold" class="w-3 h-3" />
                    <span>Rollback Lot</span>
                </button>
            </div>


            <!-- INLINE PANEL: ADD ITEMS TO THIS MAIN LOT -->
            <div v-if="showAddPanel" class="bg-base-200 p-4 rounded-box border border-secondary/40 space-y-3 shadow-md animate-fade-in">
                <div class="flex items-center justify-between border-b border-base-300 pb-2">
                    <div class="flex items-center gap-2">
                        <Icon icon="solar:box-minimalistic-bold" class="w-5 h-5 text-secondary" />
                        <h4 class="font-bold text-xs uppercase tracking-wider text-base-content">
                            Add In-Stock Items to this Main Lot
                        </h4>
                    </div>
                    <button type="button" class="btn btn-xs btn-ghost btn-circle" @click="showAddPanel = false">✕</button>
                </div>

                <!-- Curation Focus & Merchant Notes (Feeds AI Search) -->
                <div class="bg-base-100 p-3 rounded-box border border-base-300 space-y-1.5 shadow-2xs">
                    <div class="flex items-center justify-between">
                        <label class="font-bold text-xs uppercase tracking-wider opacity-70 flex items-center gap-1.5">
                            <Icon icon="solar:notes-bold" class="w-3.5 h-3.5 text-secondary" />
                            Curation Focus & Guidance for this Lot
                        </label>
                        <button 
                            v-if="curationNotesChanged"
                            type="button" 
                            class="btn btn-2xs btn-primary font-bold shadow-xs gap-1"
                            @click="saveCurationNotes"
                            :disabled="savingCurationNotes"
                        >
                            <span v-if="savingCurationNotes" class="loading loading-spinner loading-2xs"></span>
                            <Icon v-else icon="solar:check-circle-bold" class="w-3 h-3" />
                            Save Guidance
                        </button>
                    </div>
                    <textarea 
                        v-model="curationNotes" 
                        @input="curationNotesChanged = true"
                        rows="2" 
                        class="textarea textarea-bordered textarea-xs w-full text-xs font-medium bg-base-200/50 focus:bg-base-100 leading-normal" 
                        placeholder="e.g. Vintage fantasy paperbacks $10/ea: Dragonlance, Forgotten Realms, Salvatore, McCaffrey. No expensive hardcovers or modern games.">
                    </textarea>
                </div>

                <!-- Search & Filters -->
                <div class="flex items-center gap-2">
                    <div class="relative flex-1">
                        <Icon icon="solar:magnifer-linear" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                        <input 
                            v-model="candidateSearchQuery" 
                            type="text" 
                            class="input input-sm input-bordered w-full pl-9 text-xs" 
                            placeholder="Search by title, UPC, or bin location..." 
                        />
                    </div>
                    <button 
                        type="button" 
                        class="btn btn-xs btn-outline btn-secondary font-bold gap-1 shrink-0"
                        @click="fetchAiItemSuggestions"
                        :disabled="loadingAiMatches"
                    >
                        <span v-if="loadingAiMatches" class="loading loading-spinner loading-xs"></span>
                        <Icon v-else icon="solar:magic-stick-3-bold" class="w-3 h-3" />
                        <span>Run AI Match</span>
                    </button>
                </div>

                <!-- AI Synergy Banner (If results present) -->
                <div v-if="aiMatches.length > 0" class="alert alert-info py-2 px-3 text-xs flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <Icon icon="solar:stars-bold" class="w-4 h-4 shrink-0 text-info-content" />
                        <span>AI found <strong>{{ aiMatches.length }}</strong> high-synergy matches for this Main Lot!</span>
                    </div>
                    <button type="button" class="btn btn-xs btn-ghost text-[10px] font-bold" @click="selectAllAiMatches">
                        Select All AI Matches
                    </button>
                </div>

                <!-- Candidate List (Rank-Ordered by AI Matches) -->
                <div class="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                    <div v-if="loadingCandidates" class="text-center py-6 text-xs opacity-60">
                        <span class="loading loading-spinner loading-sm mb-1 block mx-auto"></span>
                        Loading in-stock inventory items...
                    </div>
                    <div v-else-if="filteredCandidates.length === 0" class="text-center py-6 text-xs opacity-60">
                        No in-stock items found matching your search.
                    </div>
                    <div 
                        v-else 
                        v-for="cand in filteredCandidates" 
                        :key="cand.$id"
                        class="p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all cursor-pointer relative"
                        :class="[
                            getAiMatch(cand.$id) 
                                ? (getAiMatch(cand.$id).matchType === 'combine' 
                                    ? 'border-secondary/80 ring-2 ring-secondary/40 bg-secondary/10 shadow-xs' 
                                    : 'border-info/80 ring-2 ring-info/40 bg-info/10 shadow-xs')
                                : (selectedCandidateIds.has(cand.$id) 
                                    ? 'border-secondary ring-1 ring-secondary/30 bg-secondary/5' 
                                    : 'bg-base-100 border-base-300 hover:border-base-content/20')
                        ]"
                        @click="toggleCandidate(cand.$id)"
                    >
                        <div class="flex items-center gap-2.5 min-w-0">
                            <input 
                                type="checkbox" 
                                class="checkbox checkbox-secondary checkbox-xs shrink-0" 
                                :checked="selectedCandidateIds.has(cand.$id)" 
                                @click.stop="toggleCandidate(cand.$id)" 
                            />
                            <ItemThumbnail :item="cand" size="xs" rounded="lg" class="shrink-0" />
                            <div class="min-w-0">
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    <span class="badge badge-xs badge-ghost font-mono font-bold">{{ cand.upc || 'ITEM' }}</span>
                                    
                                    <!-- Storage Location & Affinity Badges -->
                                    <span 
                                        v-if="cand.storageLocation" 
                                        class="badge badge-xs font-mono font-semibold"
                                        :class="item?.storageLocation && cand.storageLocation.toLowerCase() === item.storageLocation.toLowerCase() ? 'badge-success/20 text-success border-success/30' : 'badge-outline opacity-70'"
                                        :title="item?.storageLocation && cand.storageLocation.toLowerCase() === item.storageLocation.toLowerCase() ? 'In same storage location / booth' : 'Location'"
                                    >
                                        {{ cand.storageLocation }}
                                    </span>
                                    
                                    <span v-if="cand.quantity > 1" class="badge badge-xs badge-accent font-bold">Qty: {{ cand.quantity }}</span>

                                    <!-- AI Match Badges (Combine vs Companion Bundle) -->
                                    <span 
                                        v-if="getAiMatch(cand.$id) && getAiMatch(cand.$id).matchType === 'combine'" 
                                        class="badge badge-xs badge-secondary font-black gap-1 shadow-xs animate-pulse"
                                    >
                                        <Icon icon="solar:box-minimalistic-bold" class="w-3 h-3" />
                                        {{ getAiMatch(cand.$id).matchScore }}% Combine Match
                                    </span>
                                    <span 
                                        v-else-if="getAiMatch(cand.$id)" 
                                        class="badge badge-xs badge-info font-black gap-1 shadow-xs animate-pulse"
                                    >
                                        <Icon icon="solar:stars-bold" class="w-3 h-3" />
                                        {{ getAiMatch(cand.$id).matchScore }}% Companion Bundle
                                    </span>

                                    <!-- Cross-Mall Warning Badge -->
                                    <span 
                                        v-if="item?.storageLocation && cand.storageLocation && cand.storageLocation.toLowerCase() !== item.storageLocation.toLowerCase() && !['hg', 'hd', 'backstock', 'home'].includes(cand.storageLocation.toLowerCase())" 
                                        class="badge badge-xs badge-warning/80 text-[10px] font-bold"
                                    >
                                        ⚠️ Different Booth
                                    </span>
                                </div>

                                <p class="font-bold truncate text-base-content mt-0.5">{{ cand.title }}</p>

                                <!-- AI Synergy Reason Callout (High Contrast on all themes) -->
                                <div 
                                    v-if="getAiMatch(cand.$id)" 
                                    class="text-[11px] font-semibold mt-1.5 p-1.5 px-2.5 rounded-lg border leading-tight flex items-start gap-1.5 shadow-2xs"
                                    :class="getAiMatch(cand.$id).matchType === 'combine' ? 'text-base-content bg-base-100 border-secondary/50' : 'text-base-content bg-base-100 border-info/50'"
                                >
                                    <span class="shrink-0 mt-0.5">{{ getAiMatch(cand.$id).matchType === 'combine' ? '📦' : '✨' }}</span>
                                    <span class="line-clamp-2 text-base-content">{{ getAiMatch(cand.$id).synergyReason }}</span>
                                </div>
                            </div>
                        </div>
                        <div class="text-right shrink-0">
                            <span class="font-mono font-bold text-success block">${{ Number(cand.resalePrice || cand.listPrice || 0).toFixed(2) }}</span>
                            <span class="text-[10px] opacity-60 font-mono block">Cost: ${{ Number(cand.cost || 0).toFixed(2) }}</span>
                        </div>
                    </div>
                </div>

                <!-- Persistent Staged Items Tray (Resale Command Selection Pattern) -->
                <div v-if="selectedCandidateIds.size > 0" class="bg-base-100 p-2.5 rounded-box border border-secondary/40 shadow-xs space-y-2">
                    <div class="flex items-center justify-between text-[11px] font-bold">
                        <span class="text-secondary flex items-center gap-1.5">
                            <Icon icon="solar:checklist-bold" class="w-4 h-4" />
                            Staged Items to Add ({{ selectedCandidateObjects.length }})
                        </span>
                        <button type="button" @click="selectedCandidateIds.clear()" class="btn btn-2xs btn-ghost text-error">
                            Clear Staged
                        </button>
                    </div>
                    <div class="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                        <div 
                            v-for="staged in selectedCandidateObjects" 
                            :key="staged.$id"
                            class="badge badge-sm badge-outline gap-1.5 text-[11px] font-semibold bg-base-200/80 border-base-300 pr-1.5 py-2.5 max-w-full truncate"
                        >
                            <span class="truncate max-w-[180px]">{{ staged.title }}</span>
                            <span class="font-mono text-success font-bold shrink-0">${{ Number(staged.resalePrice || staged.listPrice || 0).toFixed(2) }}</span>
                            <button type="button" class="btn btn-ghost btn-circle btn-2xs hover:bg-error hover:text-white" @click.stop="toggleCandidate(staged.$id)">✕</button>
                        </div>
                    </div>
                </div>

                <!-- Bottom Action Controls -->
                <div class="flex items-center justify-between border-t border-base-300 pt-2 text-xs">
                    <div class="font-bold">
                        <span>Selected: <strong>{{ selectedCandidateIds.size }}</strong> items</span>
                        <span class="opacity-60 ml-2">(+${{ selectedCandidatesTotalCost.toFixed(2) }} Cost, +{{ selectedCandidatesTotalQty }} Qty)</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <button type="button" class="btn btn-xs btn-ghost" @click="showAddPanel = false" :disabled="mergingItems">
                            Cancel
                        </button>
                        <button 
                            type="button" 
                            class="btn btn-xs btn-secondary font-bold px-4 shadow-sm"
                            @click="executeMergeIntoMainLot"
                            :disabled="selectedCandidateIds.size === 0 || mergingItems"
                        >
                            <span v-if="mergingItems" class="loading loading-spinner loading-xs mr-1"></span>
                            <span>Add {{ selectedCandidateIds.size }} to Main Lot</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Financial ROI Stats -->
            <div class="stats stats-horizontal shadow-xs w-full bg-base-200/80 border border-base-300 text-xs">
                <div class="stat px-3 py-2.5">
                    <div class="stat-title text-[10px] font-bold uppercase opacity-60">Box Cost</div>
                    <div class="stat-value text-sm sm:text-base font-mono">${{ Number(lotDashboardItem?.cost || 0).toFixed(2) }}</div>
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
                    <div class="stat-title text-[10px] font-bold uppercase opacity-60">Net Profit</div>
                    <div class="stat-value text-sm sm:text-base font-mono font-bold" :class="(lotROI || 0) >= 0 ? 'text-success' : 'text-error'">
                        {{ (lotROI || 0) >= 0 ? '+' : '' }}${{ (lotROI || 0).toFixed(2) }}
                    </div>
                </div>
            </div>

            <!-- Split Child Inventory List -->
            <div class="bg-base-200/60 rounded-2xl p-4 border border-base-300 space-y-3 shadow-xs">
                <div class="flex items-center justify-between border-b border-base-300 pb-2.5">
                    <h4 class="font-bold text-xs uppercase tracking-wider text-base-content flex items-center gap-1.5">
                        <Icon icon="solar:box-minimalistic-bold" class="w-4 h-4 text-secondary" />
                        Constituent Listings ({{ lotChildren.length }} Items)
                    </h4>
                    <span class="text-[11px] opacity-60">Merged or split items in this Main Lot</span>
                </div>

                <div v-if="!lotChildren || lotChildren.length === 0" class="text-center py-8 border-2 border-dashed border-base-300 rounded-xl">
                    <Icon icon="solar:box-linear" class="w-8 h-8 text-base-content/30 mx-auto mb-1.5" />
                    <p class="text-xs font-bold opacity-70">No items added to this Main Lot yet.</p>
                    <p class="text-[11px] opacity-50 mt-0.5">Use "+ Add Items to Lot" above to fold inventory items into this bundle.</p>
                </div>

                <div v-else class="space-y-2 max-h-96 overflow-y-auto pr-1">
                    <div 
                        v-for="child in lotChildren" 
                        :key="child.$id" 
                        class="bg-base-100 p-2.5 rounded-xl border border-base-300 flex items-center justify-between gap-3 shadow-xs hover:border-primary/50 transition-all cursor-pointer group"
                        @click="$emit('selectItem', child)"
                        title="Click to open this child item"
                    >
                        <div class="flex items-center gap-2.5 min-w-0">
                            <ItemThumbnail :item="child" size="xs" rounded="lg" class="shrink-0" />
                            <div class="min-w-0">
                                <div class="flex items-center gap-1.5">
                                    <span class="badge badge-xs badge-ghost font-mono font-bold">{{ child.upc || 'NO-UPC' }}</span>
                                    <span v-if="child.quantity > 1" class="badge badge-xs badge-accent font-bold">Qty: {{ child.quantity }}</span>
                                    <span class="badge badge-xs" :class="child.status === 'sold' ? 'badge-success' : 'badge-primary'">{{ child.status }}</span>
                                </div>
                                <p class="text-xs font-bold truncate text-base-content mt-0.5 group-hover:text-primary transition-colors">{{ child.title }}</p>
                            </div>
                        </div>
                        <div class="text-right shrink-0 flex items-center gap-3">
                            <div>
                                <span class="text-xs font-bold text-success font-mono block">${{ Number(child.resalePrice || 0).toFixed(2) }}</span>
                                <span class="text-[10px] opacity-60 font-mono block">Cost: ${{ Number(child.cost || 0).toFixed(2) }}</span>
                            </div>
                            <button type="button" class="btn btn-xs btn-ghost btn-circle text-primary group-hover:bg-primary group-hover:text-primary-content transition-all">
                                <Icon icon="solar:arrow-right-linear" class="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- B. IF VIEWING A SINGLE EXTRACTED CHILD ITEM (From a Parent Haul/Lot, qty <= 1) -->
        <div v-else-if="item?.parentLotId" class="space-y-4">
            <!-- Parent Origin Box -->
            <div class="bg-base-200/70 rounded-2xl p-4 border border-base-300 space-y-3 shadow-xs">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] uppercase font-bold tracking-wider opacity-60 flex items-center gap-1.5">
                        <Icon icon="solar:link-circle-bold" class="w-4 h-4 text-primary" />
                        Parent Lot Origin
                    </span>
                    <span class="badge badge-xs badge-secondary font-mono font-bold">{{ parentItem?.upc || item.parentLotId }}</span>
                </div>
                <div class="flex items-center justify-between gap-3">
                    <div class="min-w-0">
                        <h4 class="font-bold text-xs truncate text-base-content">{{ parentItem?.title || item.parentLotId }}</h4>
                        <p v-if="parentItem?.cost" class="text-[11px] opacity-60 font-mono mt-0.5">Box Cost: ${{ Number(parentItem.cost).toFixed(2) }}</p>
                    </div>
                    <button 
                        v-if="parentItem"
                        type="button" 
                        class="btn btn-xs btn-primary gap-1 font-bold shadow-xs shrink-0" 
                        @click="$emit('selectItem', parentItem)"
                    >
                        <Icon icon="solar:arrow-left-bold" class="w-3.5 h-3.5" />
                        <span>Open Parent</span>
                    </button>
                </div>
            </div>

            <!-- Sibling items from this batch (Collapsible) -->
            <div v-if="siblingItems && siblingItems.length > 0" class="bg-base-200/50 rounded-2xl p-4 border border-base-300 space-y-2.5 shadow-xs">
                <div class="flex items-center justify-between border-b border-base-300 pb-2">
                    <button 
                        type="button" 
                        class="text-xs font-bold uppercase tracking-wider opacity-70 flex items-center gap-1.5 hover:opacity-100 transition-opacity"
                        @click="showSiblingDrawer = !showSiblingDrawer"
                    >
                        <Icon :icon="showSiblingDrawer ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'" class="w-3.5 h-3.5" />
                        <span>Sibling Items in this Batch ({{ siblingItems.length }})</span>
                    </button>
                    <button type="button" class="btn btn-2xs btn-ghost border border-base-300 font-bold" @click="viewInTable">
                        View in Table
                    </button>
                </div>
                <div v-if="showSiblingDrawer" class="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    <div 
                        v-for="sibling in siblingItems" 
                        :key="sibling.$id" 
                        class="bg-base-100 p-2 rounded-lg border flex items-center justify-between gap-2 cursor-pointer hover:border-primary transition-all"
                        :class="sibling.$id === item.$id ? 'border-primary ring-1 ring-primary/30 bg-primary/5' : 'border-base-300'"
                        @click="$emit('selectItem', sibling)"
                    >
                        <div class="flex items-center gap-1.5 min-w-0">
                            <span class="badge badge-xs badge-ghost font-mono text-[9px]">{{ sibling.upc || 'NO-UPC' }}</span>
                            <span v-if="sibling.$id === item.$id" class="badge badge-xs badge-primary font-bold text-[9px]">Current</span>
                            <span class="truncate font-medium text-xs">{{ sibling.title }}</span>
                        </div>
                        <span class="font-mono font-bold text-success shrink-0 text-xs">${{ Number(sibling.resalePrice || 0).toFixed(2) }}</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- C. IF VIEWING A SINGLE INDEPENDENT ITEM (Not a Main Lot and Not a Child) -->
        <div v-else class="space-y-4">
            <div class="bg-base-200/70 rounded-2xl p-5 border border-base-300 space-y-4 shadow-xs">
                <div class="flex items-center gap-3">
                    <div class="p-2.5 bg-secondary/10 text-secondary rounded-xl">
                        <Icon icon="solar:box-minimalistic-bold" class="w-6 h-6" />
                    </div>
                    <div>
                        <h4 class="font-bold text-sm text-base-content">Lot Merchandising Hub</h4>
                        <p class="text-xs opacity-60">This is an individual item. You can add it to an existing Main Lot or convert it into one.</p>
                    </div>
                </div>

                <!-- Action 1: On-Demand AI Main Lot Search (Click to find) -->
                <div class="bg-base-100 p-4 rounded-xl border border-base-300 space-y-3">
                    <div class="flex items-center justify-between">
                        <span class="text-xs font-bold uppercase tracking-wider opacity-70 flex items-center gap-1.5">
                            <Icon icon="solar:magic-stick-3-bold" class="w-4 h-4 text-secondary" />
                            Smart Main Lot Matching
                        </span>
                        <button 
                            type="button" 
                            class="btn btn-xs btn-secondary font-bold gap-1 shadow-xs"
                            @click="findBestMainLotsForThisItem"
                            :disabled="findingMainLots"
                        >
                            <span v-if="findingMainLots" class="loading loading-spinner loading-xs"></span>
                            <Icon v-else icon="solar:stars-bold" class="w-3 h-3" />
                            <span>✨ Find Main Lot with AI</span>
                        </button>
                    </div>

                    <!-- AI Suggested Main Lots List -->
                    <div v-if="aiLotMatches.length > 0" class="space-y-2 mt-2">
                        <div 
                            v-for="lotMatch in aiLotMatches" 
                            :key="lotMatch.lotId"
                            class="bg-base-200/80 p-3 rounded-xl border flex items-center justify-between gap-3 text-xs"
                            :class="lotMatch.matchType === 'combine' ? 'border-secondary/60 ring-1 ring-secondary/20' : 'border-info/60 ring-1 ring-info/20'"
                        >
                            <div class="min-w-0">
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    <span v-if="lotMatch.matchType === 'combine'" class="badge badge-xs badge-secondary font-black gap-1 shadow-xs">
                                        <Icon icon="solar:box-minimalistic-bold" class="w-3 h-3" />
                                        {{ lotMatch.matchScore }}% Combine Match
                                    </span>
                                    <span v-else class="badge badge-xs badge-info font-black gap-1 shadow-xs">
                                        <Icon icon="solar:stars-bold" class="w-3 h-3" />
                                        {{ lotMatch.matchScore }}% Companion Bundle
                                    </span>
                                    <span class="font-bold truncate text-base-content">{{ getLotTitle(lotMatch.lotId) }}</span>
                                </div>
                                <p class="text-[11px] font-bold mt-1 p-1 px-2 rounded-lg border leading-tight" :class="lotMatch.matchType === 'combine' ? 'text-secondary bg-secondary/15 border-secondary/30' : 'text-info bg-info/15 border-info/30'">
                                    💡 {{ lotMatch.synergyReason }}
                                </p>
                            </div>
                            <button 
                                type="button" 
                                class="btn btn-xs btn-secondary font-bold shrink-0 shadow-xs"
                                @click="mergeCurrentItemIntoLot(lotMatch.lotId)"
                                :disabled="mergingItemIntoLot"
                            >
                                <span>Add to Lot</span>
                            </button>
                        </div>
                    </div>
                    <p v-else-if="hasRunLotSearch" class="text-xs opacity-60 text-center py-2">
                        No high-synergy Main Lots found for this item. You can manually select one below.
                    </p>
                </div>

                <!-- Action 2: Manual Dropdown Selector -->
                <div class="bg-base-100 p-4 rounded-xl border border-base-300 space-y-3">
                    <span class="text-xs font-bold uppercase tracking-wider opacity-70 block">
                        Manual Lot Assignment
                    </span>
                    <div class="flex items-center gap-2">
                        <select v-model="selectedDestinationLotId" class="select select-sm select-bordered flex-1 text-xs font-bold">
                            <option value="">-- Choose an Existing Main Lot --</option>
                            <option v-for="lot in availableMainLots" :key="lot.$id" :value="lot.$id">
                                {{ lot.title }} (Qty: {{ lot.quantity || 1 }}, Cost: ${{ Number(lot.cost || 0).toFixed(2) }})
                            </option>
                        </select>
                        <button 
                            type="button" 
                            class="btn btn-sm btn-secondary font-bold text-xs shadow-xs shrink-0"
                            :disabled="!selectedDestinationLotId || mergingItemIntoLot"
                            @click="mergeCurrentItemIntoLot(selectedDestinationLotId)"
                        >
                            <span v-if="mergingItemIntoLot" class="loading loading-spinner loading-xs mr-1"></span>
                            <span>Add to Lot</span>
                        </button>
                    </div>
                </div>

                <!-- Action 3: Convert this Item into a New Main Lot -->
                <div class="flex items-center justify-between border-t border-base-300 pt-3">
                    <div>
                        <h5 class="font-bold text-xs">Want to build a lot around this item?</h5>
                        <p class="text-[11px] opacity-60">Make this item the foundation of a new Main Lot listing.</p>
                    </div>
                    <button 
                        type="button" 
                        class="btn btn-xs btn-outline btn-primary font-bold shadow-xs"
                        @click="$emit('open-splitter')"
                    >
                        <span>Split / Curate</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { Icon } from '@iconify/vue';
import ItemThumbnail from '../ItemThumbnail.vue';
import { databases, Query } from '../../../lib/appwrite';
import { DB_ID, getCollectionId, updateInventoryItem } from '../../../lib/inventory';
import { syncPurchaseStatusForItems } from '../../../lib/purchases';
import { addToast } from '../../../stores/toast';
import { useLoader } from '../../../composables/useLoader';

const { showLoader, hideLoader, updateLoader } = useLoader();
let aiMatchAbortController = null;
let aiLotMatchAbortController = null;

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
    }
});

const emit = defineEmits(['selectItem', 'open-splitter', 'uncombine', 'refresh-lot']);

// Distinguish between a Main Lot vs a single individual item
const isMainLot = computed(() => {
    if (!props.item) return false;
    // An item is an active lot hub if:
    // 1. It has lot children, OR
    // 2. Its quantity is greater than 1 (multi-qty format lot / crate), OR
    // 3. Its status is 'combined'
    if (props.lotChildren && props.lotChildren.length > 0) return true;
    if (Number(props.item.quantity || 1) > 1) return true;
    if (props.item.status === 'combined') return true;
    // If it has parentLotId and qty <= 1, it is a single individual extracted piece
    if (props.item.parentLotId) return false; 
    return /\b(?:lot|bundle|collection|set\s+of|pack\s+of|box\s+of)\b/i.test(props.item.title || '');
});

// State for Sibling Drawer
const showSiblingDrawer = ref(false);

// State for Curation Guidance
const curationNotes = ref(props.item?.conditionNotes || props.item?.condition_notes || '');
const curationNotesChanged = ref(false);
const savingCurationNotes = ref(false);

async function saveCurationNotes() {
    if (!props.item?.$id) return;
    savingCurationNotes.value = true;
    try {
        await updateInventoryItem(props.item.$id, {
            conditionNotes: curationNotes.value
        });
        if (props.item) {
            props.item.conditionNotes = curationNotes.value;
        }
        curationNotesChanged.value = false;
        addToast({ type: 'success', message: 'Lot curation guidance saved!' });
    } catch (e) {
        addToast({ type: 'error', message: 'Failed to save guidance: ' + e.message });
    } finally {
        savingCurationNotes.value = false;
    }
}

// State for Adding Items to a Main Lot
const showAddPanel = ref(false);
const candidateSearchQuery = ref('');
const candidates = ref([]);
const loadingCandidates = ref(false);
const selectedCandidateIds = ref(new Set());
const mergingItems = ref(false);

// Map selected IDs to actual item objects for Staged Tray
const selectedCandidateObjects = computed(() => {
    const all = [...(candidates.value || []), ...(props.inventoryItems || [])];
    const map = new Map();
    all.forEach(item => {
        if (item?.$id) map.set(item.$id, item);
    });
    return Array.from(selectedCandidateIds.value).map(id => map.get(id)).filter(Boolean);
});

// AI Suggestions State
const loadingAiMatches = ref(false);
const aiMatches = ref([]);

// State for Matching Loose Item to Main Lots
const availableMainLots = ref([]);
const selectedDestinationLotId = ref('');
const findingMainLots = ref(false);
const hasRunLotSearch = ref(false);
const aiLotMatches = ref([]);
const mergingItemIntoLot = ref(false);

// Strict candidate validation: completely excludes sold, combined, deconstructed, out-of-stock,
// current item, constituent children, parent haul, and sibling items from the same parent haul.
function isItemCandidateValid(d) {
    if (!d || !d.$id) return false;
    if (d.$id === props.item?.$id) return false;

    // Strict status & stock filter: NEVER suggest sold, combined, or deconstructed items
    const status = (d.status || '').toLowerCase().trim();
    if (['sold', 'combined', 'deconstructed'].includes(status)) return false;
    if (d.quantity !== undefined && Number(d.quantity) <= 0) return false;

    // Exclude if already an active child of this Main Lot
    if (d.parentLotId && d.parentLotId === props.item?.$id) return false;
    if (Array.isArray(props.lotChildren) && props.lotChildren.some(c => c?.$id === d.$id)) return false;

    // Exclude parent haul / origin item
    if (props.item?.parentLotId && d.$id === props.item.parentLotId) return false;
    if (props.parentItem?.$id && d.$id === props.parentItem.$id) return false;

    // Exclude sibling items split from the same parent haul
    if (props.item?.parentLotId && d.parentLotId && d.parentLotId === props.item.parentLotId) return false;
    if (Array.isArray(props.siblingItems) && props.siblingItems.some(s => s?.$id === d.$id)) return false;

    return true;
}

const filteredCandidates = computed(() => {
    let list = (candidates.value || []).filter(c => isItemCandidateValid(c));

    if (candidateSearchQuery.value.trim()) {
        const q = candidateSearchQuery.value.toLowerCase().trim();
        list = list.filter(c => 
            (c.title || '').toLowerCase().includes(q) ||
            (c.upc || '').toLowerCase().includes(q) ||
            (c.storageLocation || '').toLowerCase().includes(q) ||
            (Array.isArray(c.keywords) && c.keywords.some(k => (k || '').toLowerCase().includes(q)))
        );
    }

    // Always sort by AI Match Rank if AI matches exist
    if (aiMatches.value && aiMatches.value.length > 0) {
        const matchMap = new Map();
        aiMatches.value.forEach(m => {
            if (m.id) matchMap.set(m.id, m);
        });

        return [...list].sort((a, b) => {
            const matchA = matchMap.get(a.$id);
            const matchB = matchMap.get(b.$id);

            // 1. Matches always come before non-matches
            if (matchA && !matchB) return -1;
            if (!matchA && matchB) return 1;

            // 2. If both match, sort by matchScore descending (e.g. 95% before 80%)
            if (matchA && matchB) {
                const scoreDiff = (Number(matchB.matchScore) || 0) - (Number(matchA.matchScore) || 0);
                if (scoreDiff !== 0) return scoreDiff;
            }

            // 3. Tie-breaker: same location as Main Lot preferred
            const targetLoc = (props.item?.storageLocation || '').toLowerCase().trim();
            const aSameLoc = (a.storageLocation || '').toLowerCase().trim() === targetLoc;
            const bSameLoc = (b.storageLocation || '').toLowerCase().trim() === targetLoc;
            if (aSameLoc && !bSameLoc) return -1;
            if (!aSameLoc && bSameLoc) return 1;

            return 0;
        });
    }

    return list;
});

const selectedCandidatesTotalCost = computed(() => {
    return Array.from(selectedCandidateIds.value).reduce((sum, id) => {
        const item = candidates.value.find(c => c.$id === id);
        return sum + Number(item?.cost || 0);
    }, 0);
});

const selectedCandidatesTotalQty = computed(() => {
    return Array.from(selectedCandidateIds.value).reduce((sum, id) => {
        const item = candidates.value.find(c => c.$id === id);
        return sum + Number(item?.quantity || 1);
    }, 0);
});

function toggleCandidate(id) {
    if (selectedCandidateIds.value.has(id)) {
        selectedCandidateIds.value.delete(id);
    } else {
        selectedCandidateIds.value.add(id);
    }
}

function getAiMatch(id) {
    return aiMatches.value.find(m => m.id === id);
}

function selectAllAiMatches() {
    aiMatches.value.forEach(m => {
        if (m.id) selectedCandidateIds.value.add(m.id);
    });
}

function getLotTitle(lotId) {
    const lot = availableMainLots.value.find(l => l.$id === lotId);
    return lot ? lot.title : `Lot (${lotId})`;
}

// Extract distinctive seed keyword or tag for auto-filtering
function extractSeedKeyword(itemOrTitle) {
    if (!itemOrTitle) return '';
    const item = typeof itemOrTitle === 'object' ? itemOrTitle : null;
    const title = typeof itemOrTitle === 'string' ? itemOrTitle : (item?.title || '');

    // If item has explicit keywords/tags, prefer the most distinctive tag
    if (item && Array.isArray(item.keywords) && item.keywords.length > 0) {
        const validTag = item.keywords.find(k => k && k.length > 2 && !/^(item|misc|lot|vintage|used|good|new)$/i.test(k));
        if (validTag) return validTag;
    }

    const clean = title.replace(/\b(?:main|parent|master|lot|bundle|collection|set\s+of|pack\s+of|of|\d+|vintage|rare|new|the|a|an)\b/gi, ' ').trim();
    const tokens = clean.split(/[\s,/-]+/).map(t => t.replace(/[^a-zA-Z0-9]/g, '')).filter(t => t.length > 2);
    const priority = tokens.find(t => /^(paperback|fantasy|novel|novels|book|books|hat|hats|comic|comics|cassette|cassettes|vinyl|toy|toys|denim|jacket|rpg|ttrpg|dice|dnd|star wars)$/i.test(t));
    return priority || tokens[0] || '';
}

// Fetch Candidate in-stock items with strict validation
async function loadCandidates(force = false) {
    if (!force && candidates.value.length > 0) return;
    loadingCandidates.value = true;
    try {
        let rawList = [];
        if (props.inventoryItems && props.inventoryItems.length > 0) {
            rawList = props.inventoryItems;
        } else {
            const collId = getCollectionId();
            const res = await databases.listDocuments(DB_ID, collId, [
                Query.limit(100),
                Query.orderDesc('$createdAt')
            ]);
            rawList = res.documents || [];
        }
        candidates.value = rawList.filter(d => isItemCandidateValid(d));
    } catch (e) {
        console.error('[ItemLotTab] Failed to load candidate items:', e);
    } finally {
        loadingCandidates.value = false;
    }
}

// Fetch active Main Lots for single-item assignment
async function loadAvailableMainLots() {
    if (availableMainLots.value.length > 0) return;
    try {
        if (props.inventoryItems && props.inventoryItems.length > 0) {
            availableMainLots.value = props.inventoryItems.filter(d => 
                d.$id !== props.item?.$id &&
                d.status !== 'sold' &&
                d.status !== 'deconstructed' &&
                (!d.parentLotId || Number(d.quantity || 1) > 1 || d.status === 'combined') &&
                (Number(d.quantity || 1) > 1 || d.status === 'combined' || /\b(?:lot|bundle|collection|set\s+of|pack\s+of)\b/i.test(d.title || ''))
            );
        } else {
            const collId = getCollectionId();
            const res = await databases.listDocuments(DB_ID, collId, [
                Query.limit(100),
                Query.orderDesc('$createdAt')
            ]);
            availableMainLots.value = (res.documents || []).filter(d => 
                d.$id !== props.item?.$id &&
                d.status !== 'sold' &&
                d.status !== 'deconstructed' &&
                (!d.parentLotId || Number(d.quantity || 1) > 1 || d.status === 'combined') &&
                (Number(d.quantity || 1) > 1 || d.status === 'combined' || /\b(?:lot|bundle|collection)\b/i.test(d.title || ''))
            );
        }
    } catch (e) {
        console.error('[ItemLotTab] Failed to load available main lots:', e);
    }
}

function viewInTable() {
    if (!props.item?.$id) return;
    if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.pathname = '/inventory';
        url.searchParams.set('parentLotId', props.item.$id);
        url.searchParams.delete('upc');
        url.searchParams.delete('item');
        window.location.href = url.toString();
    }
}

async function toggleAddItemsPanel() {
    showAddPanel.value = !showAddPanel.value;
    if (showAddPanel.value) {
        await loadCandidates(true);
        if (!candidateSearchQuery.value.trim() && props.item) {
            candidateSearchQuery.value = extractSeedKeyword(props.item);
        }
    }
}

// Token-efficient on-demand AI suggestions for Main Lot
async function fetchAiItemSuggestions() {
    if (!props.item) return;
    showAddPanel.value = true;
    await loadCandidates(true);
    
    const validCandidates = (candidates.value || []).filter(c => isItemCandidateValid(c));
    if (validCandidates.length === 0) {
        addToast({ type: 'warning', message: 'No eligible in-stock candidate items found to match.' });
        return;
    }

    loadingAiMatches.value = true;
    aiMatchAbortController = new AbortController();

    let progressTimer = null;
    let progressVal = 15;

    showLoader("Finding Matching Items with AI...", {
        step: "Filtering inventory candidates and calculating semantic match...",
        progress: progressVal,
        basket: 'solar:magic-stick-3-bold-duotone',
        berries: ['solar:box-minimalistic-bold-duotone', 'solar:tag-price-bold-duotone', 'solar:stars-bold-duotone'],
        basketColor: 'text-primary-content',
        berryColor: 'text-primary-content',
        backgroundColor: 'bg-primary/80',
        cancelable: true,
        onCancel: () => {
            if (progressTimer) clearInterval(progressTimer);
            if (aiMatchAbortController) aiMatchAbortController.abort();
            loadingAiMatches.value = false;
        }
    });

    progressTimer = setInterval(() => {
        if (progressVal < 50) {
            progressVal += 8;
        } else if (progressVal < 80) {
            progressVal += 4;
        } else if (progressVal < 92) {
            progressVal += 1;
        }
        let stepMsg = progressVal < 50 
            ? "Gemini is comparing item keywords, categories & storage locations..." 
            : "Scoring candidate compatibility and ranking bundle matches...";
        updateLoader("Finding Matching Items with AI...", stepMsg, progressVal);
    }, 1200);

    try {
        // 1. Full Thematic Semantic Fingerprint
        const rawStrings = [
            props.item.title || '',
            ...(Array.isArray(props.item.keywords) ? props.item.keywords : []),
            props.item.conditionNotes || props.item.condition_notes || '',
            props.item.category || ''
        ].join(' ');

        const lotTokens = rawStrings
            .toLowerCase()
            .replace(/\b(?:main|parent|master|lot|bundle|collection|set\s+of|pack\s+of|vintage|item|items|condition|notes)\b/gi, ' ')
            .split(/[\s,/-]+/)
            .map(t => t.replace(/[^a-z0-9]/g, ''))
            .filter(t => t.length > 2);

        const uniqueLotTokens = Array.from(new Set(lotTokens));
        const targetLoc = (props.item.storageLocation || '').trim().toLowerCase();

        // 2. Score candidates by token overlap + physical location affinity
        const scoredCandidates = validCandidates.map(c => {
            const cKeywords = Array.isArray(c.keywords) ? c.keywords.join(' ') : '';
            const cNotes = c.condition_notes || c.conditionNotes || '';
            const cText = `${c.title || ''} ${c.storageLocation || ''} ${cKeywords} ${c.category || ''} ${cNotes}`.toLowerCase();
            const candLoc = (c.storageLocation || '').trim().toLowerCase();

            let score = 0;
            uniqueLotTokens.forEach(token => {
                if (cText.includes(token)) score += 15;
                if (Array.isArray(c.keywords) && c.keywords.some(k => (k || '').toLowerCase() === token)) {
                    score += 20; // High bonus for shared exact tag
                }
            });

            // Physical Storage Location Affinity
            if (targetLoc && candLoc) {
                if (candLoc === targetLoc) {
                    score += 25; // Same booth or backstock bin -> zero friction
                } else if (['hg', 'hd', 'backstock', 'home'].includes(candLoc)) {
                    score += 10; // Unassigned backstock can be packed anywhere
                } else {
                    score -= 10; // Different physical mall -> cross-mall friction
                }
            }

            return { item: c, score };
        });

        // Sort candidates so highest thematic & location synergy items are sliced
        scoredCandidates.sort((a, b) => b.score - a.score);
        const topCandidates = scoredCandidates.slice(0, 50).map(s => s.item);

        const res = await fetch('/api/suggest-lot-matches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: 'find_items_for_lot',
                mainLot: {
                    id: props.item.$id,
                    parentLotId: props.item.parentLotId,
                    title: props.item.title,
                    storageLocation: props.item.storageLocation,
                    conditionNotes: curationNotes.value || props.item.conditionNotes || '',
                    keywords: props.item.keywords,
                    unitResalePrice: Number(props.item.resalePrice || props.item.listPrice || 10)
                },
                excludedIds: [
                    props.item.$id,
                    ...(props.item.parentLotId ? [props.item.parentLotId] : []),
                    ...(Array.isArray(props.lotChildren) ? props.lotChildren.map(c => c?.$id).filter(Boolean) : []),
                    ...(Array.isArray(props.siblingItems) ? props.siblingItems.map(s => s?.$id).filter(Boolean) : [])
                ],
                existingChildren: (props.lotChildren || []).map(c => c.title),
                candidates: topCandidates
            }),
            signal: aiMatchAbortController.signal
        });

        if (!res.ok) throw new Error('AI match failed');
        const data = await res.json();
        aiMatches.value = data.matches || [];

        // Note: Do NOT auto-preselect candidates so the merchant maintains 100% control over selections!

        if (aiMatches.value.length > 0) {
            addToast({ 
                type: 'success', 
                message: `✨ AI found ${aiMatches.value.length} matching items for this lot!` 
            });
        } else {
            addToast({
                type: 'info',
                message: 'No closely matching items found in current inventory for this category.'
            });
        }
    } catch (e) {
        if (e.name === 'AbortError') {
            addToast({ type: 'info', message: 'AI lot search cancelled.' });
        } else {
            console.error('[ItemLotTab] AI match error:', e);
            addToast({ type: 'error', message: 'AI suggestion error: ' + e.message });
        }
    } finally {
        if (progressTimer) clearInterval(progressTimer);
        loadingAiMatches.value = false;
        hideLoader();
    }
}

// Token-efficient on-demand AI search for which Main Lot a single item belongs to
async function findBestMainLotsForThisItem() {
    if (!props.item) return;
    await loadAvailableMainLots();

    if (availableMainLots.value.length === 0) {
        addToast({ type: 'warning', message: 'No active Main Lots found in inventory.' });
        return;
    }

    findingMainLots.value = true;
    hasRunLotSearch.value = true;
    aiLotMatchAbortController = new AbortController();

    let progressTimer = null;
    let progressVal = 15;

    showLoader("Finding Matching Main Lots...", {
        step: "Evaluating inventory Main Lots with Gemini AI...",
        progress: progressVal,
        basket: 'solar:box-minimalistic-bold-duotone',
        berries: ['solar:tag-price-bold-duotone', 'solar:stars-bold-duotone'],
        basketColor: 'text-primary-content',
        berryColor: 'text-primary-content',
        backgroundColor: 'bg-primary/80',
        cancelable: true,
        onCancel: () => {
            if (progressTimer) clearInterval(progressTimer);
            if (aiLotMatchAbortController) aiLotMatchAbortController.abort();
            findingMainLots.value = false;
        }
    });

    progressTimer = setInterval(() => {
        if (progressVal < 50) {
            progressVal += 10;
        } else if (progressVal < 85) {
            progressVal += 5;
        }
        let stepMsg = progressVal < 50
            ? "Gemini is comparing item attributes against existing lots..."
            : "Ranking compatibility and bundling suitability...";
        updateLoader("Finding Matching Main Lots...", stepMsg, progressVal);
    }, 1200);

    try {
        const res = await fetch('/api/suggest-lot-matches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: 'find_lots_for_item',
                item: {
                    title: props.item.title,
                    storageLocation: props.item.storageLocation,
                    conditionNotes: props.item.conditionNotes,
                    keywords: props.item.keywords
                },
                mainLots: availableMainLots.value
            }),
            signal: aiLotMatchAbortController.signal
        });

        if (!res.ok) throw new Error('AI search failed');
        const data = await res.json();
        aiLotMatches.value = data.matches || [];

        if (aiLotMatches.value.length > 0) {
            addToast({ 
                type: 'success', 
                message: `✨ AI found ${aiLotMatches.value.length} matching Main Lots!` 
            });
        }
    } catch (e) {
        if (e.name === 'AbortError') {
            addToast({ type: 'info', message: 'Main Lot search cancelled.' });
        } else {
            console.error('[ItemLotTab] AI lot match error:', e);
            addToast({ type: 'error', message: 'AI match error: ' + e.message });
        }
    } finally {
        if (progressTimer) clearInterval(progressTimer);
        findingMainLots.value = false;
        hideLoader();
    }
}

// Execute adding candidate items into this Main Lot
async function executeMergeIntoMainLot() {
    if (selectedCandidateIds.value.size === 0 || !props.item?.$id) return;
    mergingItems.value = true;
    showLoader("Adding Items to Main Lot...", {
        step: "Updating inventory records and linking bundle items...",
        basket: 'solar:box-minimalistic-bold-duotone',
        cancelable: false
    });
    try {
        const targetLot = props.item;
        const selectedItems = candidates.value.filter(c => selectedCandidateIds.value.has(c.$id));
        
        // 1. Gather combined media IDs
        const existingGallery = new Set(targetLot.galleryImageIds || []);
        if (targetLot.imageId) existingGallery.add(targetLot.imageId);

        selectedItems.forEach(item => {
            if (item.imageId) existingGallery.add(item.imageId);
            if (Array.isArray(item.galleryImageIds)) {
                item.galleryImageIds.forEach(id => existingGallery.add(id));
            }
        });

        // 2. Calculate updated cost and quantity
        const addedCost = selectedCandidatesTotalCost.value;
        const addedQty = selectedCandidatesTotalQty.value;
        const newCost = Number((Number(targetLot.cost || 0) + addedCost).toFixed(2));
        const newQty = Math.max(1, Number(targetLot.quantity || 1) + addedQty);

        // 3. Update target Main Lot with reminder for shop barcode update
        const lotFlags = Array.isArray(targetLot.redFlags) ? [...targetLot.redFlags] : [];
        if (!lotFlags.includes('needs_shop_update')) {
            lotFlags.push('needs_shop_update');
        }

        await updateInventoryItem(targetLot.$id, {
            cost: newCost,
            quantity: newQty,
            galleryImageIds: Array.from(existingGallery),
            redFlags: lotFlags
        });
        targetLot.redFlags = lotFlags;

        // 4. Update each child item: set parentLotId and status = combined
        const childPromises = selectedItems.map(item => {
            return updateInventoryItem(item.$id, {
                parentLotId: targetLot.$id,
                status: 'combined'
            });
        });
        await Promise.all(childPromises);

        // 4b. If any added item was a combine, reparent its nested children to targetLot
        const nestedChildren = (props.inventoryItems || []).filter(i => 
            selectedItems.some(added => added.$id === i.parentLotId)
        );
        if (nestedChildren.length > 0) {
            await Promise.all(nestedChildren.map(nc => 
                updateInventoryItem(nc.$id, { parentLotId: targetLot.$id })
            ));
        }

        // 5. Sync PO status for purchase orders
        syncPurchaseStatusForItems(selectedItems).catch(e => console.warn('[ItemLotTab] PO sync warning:', e));

        addToast({ 
            type: 'success', 
            message: `Successfully added ${selectedItems.length} items to ${targetLot.title}!` 
        });

        // Reset panel & refresh lot
        selectedCandidateIds.value.clear();
        showAddPanel.value = false;
        candidates.value = [];
        emit('refresh-lot');
    } catch (e) {
        console.error('[ItemLotTab] Merge failed:', e);
        addToast({ type: 'error', message: 'Failed to add items: ' + e.message });
    } finally {
        mergingItems.value = false;
        hideLoader();
    }
}

// Execute merging current loose item into an existing Main Lot
async function mergeCurrentItemIntoLot(destLotId) {
    if (!destLotId || !props.item?.$id) return;
    mergingItemIntoLot.value = true;
    showLoader("Merging Item into Main Lot...", {
        step: "Updating destination lot and reparenting item...",
        basket: 'solar:box-minimalistic-bold-duotone',
        cancelable: false
    });
    try {
        const destLot = availableMainLots.value.find(l => l.$id === destLotId);
        const currentItem = props.item;

        // 1. Gather combined media
        const existingGallery = new Set(destLot?.galleryImageIds || []);
        if (destLot?.imageId) existingGallery.add(destLot.imageId);
        if (currentItem.imageId) existingGallery.add(currentItem.imageId);
        if (Array.isArray(currentItem.galleryImageIds)) {
            currentItem.galleryImageIds.forEach(id => existingGallery.add(id));
        }

        // 2. Calculate updated cost and quantity
        const newCost = Number((Number(destLot?.cost || 0) + Number(currentItem.cost || 0)).toFixed(2));
        const newQty = Math.max(1, Number(destLot?.quantity || 1) + Number(currentItem.quantity || 1));

        // 3. Update destination Main Lot with reminder for shop barcode update
        const destFlags = Array.isArray(destLot?.redFlags) ? [...destLot.redFlags] : [];
        if (!destFlags.includes('needs_shop_update')) {
            destFlags.push('needs_shop_update');
        }

        await updateInventoryItem(destLotId, {
            cost: newCost,
            quantity: newQty,
            galleryImageIds: Array.from(existingGallery),
            redFlags: destFlags
        });
        if (destLot) destLot.redFlags = destFlags;

        // 4. Update current item
        await updateInventoryItem(currentItem.$id, {
            parentLotId: destLotId,
            status: 'combined'
        });

        // 5. Sync purchase orders
        syncPurchaseStatusForItems([currentItem]).catch(e => console.warn('[ItemLotTab] PO sync warning:', e));

        addToast({ 
            type: 'success', 
            message: `Successfully merged into Main Lot: ${destLot?.title || 'Main Lot'}!` 
        });

        emit('refresh-lot');
    } catch (e) {
        console.error('[ItemLotTab] Failed to merge into lot:', e);
        addToast({ type: 'error', message: 'Failed to merge: ' + e.message });
    } finally {
        mergingItemIntoLot.value = false;
        hideLoader();
    }
}

onMounted(() => {
    if (!isMainLot.value && !props.item?.parentLotId) {
        loadAvailableMainLots();
    }
});

// Clear stale candidates and AI match states when viewing a different item
watch(() => props.item?.$id, () => {
    candidates.value = [];
    aiMatches.value = [];
    selectedCandidateIds.value.clear();
    showAddPanel.value = false;
    showSiblingDrawer.value = false;
    availableMainLots.value = [];
    aiLotMatches.value = [];
    curationNotes.value = props.item?.conditionNotes || props.item?.condition_notes || '';
    curationNotesChanged.value = false;
});
</script>
