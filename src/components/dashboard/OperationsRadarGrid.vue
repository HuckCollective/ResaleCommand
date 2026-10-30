<template>
    <div class="card bg-base-100 shadow-xl border border-base-300/80 overflow-hidden transition-all">
        <!-- Section Header -->
        <div
            @click="toggleCollapsed"
            class="p-3 sm:p-4 flex items-center justify-between gap-2 cursor-pointer hover:bg-base-200/50 transition-colors select-none"
            :class="{ 'border-b border-base-200': !isCollapsed }"
            role="button"
            :aria-expanded="!isCollapsed"
            tabindex="0"
            @keydown.enter.space="toggleCollapsed"
        >
            <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-secondary/15 flex items-center justify-center text-secondary shadow-sm shrink-0">
                    <Icon icon="solar:radar-2-bold-duotone" class="w-4.5 h-4.5 sm:w-6 sm:h-6" />
                </div>
                <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-1.5">
                        <h3 class="font-extrabold text-sm sm:text-base text-base-content tracking-tight truncate">
                            Operations &amp; Booth Restock Radar
                        </h3>
                        <span class="badge badge-2xs sm:badge-xs badge-secondary text-secondary-content font-bold whitespace-nowrap">
                            Live Queues
                        </span>
                    </div>
                    <p class="text-[10px] sm:text-xs text-base-content/65 truncate">
                        One-click triage queues, vibe-matched booth pulls, and spatial stock counts
                    </p>
                </div>
            </div>

            <!-- Header Controls -->
            <div class="flex items-center gap-1 shrink-0">
                <button
                    type="button"
                    @click.stop="isCustomizing = !isCustomizing; if (isCollapsed) isCollapsed = false;"
                    class="btn btn-xs font-bold gap-1 transition-all px-2 h-7 min-h-7"
                    :class="isCustomizing ? 'btn-secondary text-secondary-content shadow-xs' : 'btn-outline border-base-300'"
                    title="Customize which radar cards appear on your Command Center"
                >
                    <span class="text-[11px] whitespace-nowrap">⚙️ Customize</span>
                    <span v-if="hiddenCardIds.length > 0" class="badge badge-2xs badge-neutral font-mono">
                        {{ allRadarCards.length - hiddenCardIds.length }}/{{ allRadarCards.length }}
                    </span>
                </button>

                <button
                    type="button"
                    class="btn btn-ghost btn-xs btn-circle shrink-0 hover:bg-base-300"
                    :aria-expanded="!isCollapsed"
                    aria-label="Toggle Operations Radar"
                >
                    <Icon
                        icon="solar:alt-arrow-down-linear"
                        class="w-4 h-4 transition-transform duration-200"
                        :class="{ '-rotate-90': isCollapsed }"
                    />
                </button>
            </div>
        </div>

        <!-- Collapsible Body -->
        <div v-show="!isCollapsed" class="p-2.5 sm:p-4 space-y-2.5">
            <!-- Customize Cards Panel -->
            <div
                v-if="isCustomizing"
                class="p-3 rounded-2xl bg-base-200/80 border border-secondary/30 space-y-2.5 animate-fade-in"
            >
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-1.5 text-xs font-extrabold text-base-content">
                        <span>⚙️ Select Radar Cards to Display</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <button
                            v-if="hiddenCardIds.length > 0"
                            type="button"
                            @click="resetCardConfig"
                            class="btn btn-2xs btn-ghost text-warning font-bold"
                        >
                            Reset Default
                        </button>
                        <button
                            type="button"
                            @click="isCustomizing = false"
                            class="btn btn-2xs btn-secondary text-secondary-content font-bold px-2.5"
                        >
                            Done
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                    <label
                        v-for="card in allRadarCards"
                        :key="`cfg-${card.id}`"
                        class="flex items-center justify-between gap-2 p-2 rounded-xl border bg-base-100 cursor-pointer select-none transition-all text-xs"
                        :class="isCardVisible(card.id) ? 'border-secondary/40 font-bold' : 'border-base-300 opacity-60'"
                    >
                        <div class="flex items-center gap-2 min-w-0">
                            <input
                                type="checkbox"
                                class="checkbox checkbox-xs checkbox-secondary"
                                :checked="isCardVisible(card.id)"
                                @change="toggleCardVisibility(card.id)"
                            />
                            <span class="truncate">{{ card.title }}</span>
                        </div>
                        <span class="badge badge-2xs badge-ghost font-mono shrink-0">{{ card.count }}</span>
                    </label>
                </div>
            </div>

            <!-- Category Tabs (Hidden Scrollbar, Mobile-First) -->
            <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-1 bg-base-200/80 p-1 rounded-xl overflow-x-auto max-w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    <button
                        type="button"
                        @click="activeCategory = 'queues'"
                        class="btn btn-xs rounded-lg font-bold gap-1 shrink-0 transition-all h-7 min-h-7 px-2.5"
                        :class="activeCategory === 'queues' ? 'btn-secondary text-secondary-content shadow-xs' : 'btn-ghost text-base-content/75'"
                    >
                        <span>Restock &amp; Triage</span>
                        <span class="badge badge-2xs font-mono font-bold" :class="activeCategory === 'queues' ? 'badge-neutral' : 'badge-ghost'">
                            {{ categoryCounts.queues }}
                        </span>
                    </button>

                    <button
                        type="button"
                        @click="activeCategory = 'locations'"
                        class="btn btn-xs rounded-lg font-bold gap-1 shrink-0 transition-all h-7 min-h-7 px-2.5"
                        :class="activeCategory === 'locations' ? 'btn-info text-info-content shadow-xs' : 'btn-ghost text-base-content/75'"
                    >
                        <span>Locations</span>
                        <span class="badge badge-2xs font-mono font-bold" :class="activeCategory === 'locations' ? 'badge-neutral' : 'badge-ghost'">
                            {{ categoryCounts.locations }}
                        </span>
                    </button>

                    <button
                        type="button"
                        @click="activeCategory = 'partners'"
                        class="btn btn-xs rounded-lg font-bold gap-1 shrink-0 transition-all h-7 min-h-7 px-2.5"
                        :class="activeCategory === 'partners' ? 'btn-accent text-accent-content shadow-xs' : 'btn-ghost text-base-content/75'"
                    >
                        <span>Partners</span>
                        <span class="badge badge-2xs font-mono font-bold" :class="activeCategory === 'partners' ? 'badge-neutral' : 'badge-ghost'">
                            {{ categoryCounts.partners }}
                        </span>
                    </button>

                    <button
                        type="button"
                        @click="activeCategory = 'all'"
                        class="btn btn-xs rounded-lg font-bold gap-1 shrink-0 transition-all h-7 min-h-7 px-2.5"
                        :class="activeCategory === 'all' ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost text-base-content/75'"
                    >
                        <span>All</span>
                        <span class="badge badge-2xs font-mono font-bold" :class="activeCategory === 'all' ? 'badge-neutral' : 'badge-ghost'">
                            {{ categoryCounts.all }}
                        </span>
                    </button>
                </div>

                <span class="text-[11px] text-base-content/60 hidden lg:inline font-mono shrink-0">
                    Tap card to open Workbench queue
                </span>
            </div>

            <!-- Cards Grid (High-Density Mobile Bento Layout) -->
            <div
                v-if="visibleRadarCards.length > 0"
                class="grid gap-2 sm:gap-2.5"
                :class="activeCategory === 'locations' || activeCategory === 'partners'
                    ? 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'"
            >
                <a
                    v-for="card in visibleRadarCards"
                    :key="card.id"
                    :href="card.link"
                    class="flex flex-col justify-between p-2.5 sm:p-3.5 rounded-xl border bg-base-100 transition-all cursor-pointer group hover:shadow-md active:scale-[0.99]"
                    :class="[card.borderClass, card.isAlert ? 'bg-warning/5' : '']"
                >
                    <!-- Top Row: Title + Badge on Left, Item Count + $Value on Right -->
                    <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-1.5 min-w-0">
                                <h4 class="font-extrabold text-xs sm:text-sm text-base-content group-hover:text-primary transition-colors truncate">
                                    {{ card.title }}
                                </h4>
                                <span
                                    class="badge badge-2xs font-extrabold uppercase tracking-wider text-[8px] px-1.5 py-1 shrink-0 hidden xs:inline-flex"
                                    :class="card.isAlert ? 'badge-warning text-warning-content' : 'badge-ghost border-base-300 text-base-content/70'"
                                >
                                    {{ card.badgeLabel }}
                                </span>
                            </div>
                            <p class="text-[10px] sm:text-[11px] text-base-content/60 leading-tight line-clamp-1 mt-0.5">
                                {{ card.subtitle }}
                            </p>
                        </div>

                        <!-- Right Metric Pill -->
                        <div class="flex flex-col items-end shrink-0 text-right">
                            <div class="flex items-center gap-1 font-mono leading-none">
                                <span class="font-black text-sm sm:text-base text-base-content">{{ card.count.toLocaleString() }}</span>
                                <span class="text-[10px] text-base-content/60">items</span>
                                <Icon icon="solar:arrow-right-linear" class="w-3 h-3 text-primary transform group-hover:translate-x-0.5 transition-transform" />
                            </div>
                            <div class="flex items-center gap-1 mt-0.5">
                                <span v-if="card.unitCount > card.count" class="text-[9px] font-mono text-base-content/55">
                                    {{ card.unitCount.toLocaleString() }}u ·
                                </span>
                                <span class="text-[10px] sm:text-xs font-mono font-extrabold text-success">
                                    ${{ card.totalValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }}
                                </span>
                            </div>
                        </div>
                    </div>
                </a>
            </div>

            <div v-else class="text-center py-5 border border-dashed border-base-300 rounded-xl text-xs text-base-content/60 space-y-2">
                <p>No radar cards visible in this category.</p>
                <button type="button" @click="resetCardConfig" class="btn btn-xs btn-outline">
                    Reset Card Visibility
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Icon } from '@iconify/vue';
import { useOperationsRadar } from '../../composables/dashboard/useOperationsRadar';

const {
    activeCategory,
    isCustomizing,
    hiddenCardIds,
    allRadarCards,
    visibleRadarCards,
    categoryCounts,
    isCardVisible,
    toggleCardVisibility,
    resetCardConfig
} = useOperationsRadar();

// Expanded by default
const isCollapsed = ref(false);

const toggleCollapsed = () => {
    isCollapsed.value = !isCollapsed.value;
    try {
        localStorage.setItem('rc_dash_collapsed_radar', String(isCollapsed.value));
    } catch {}
};

const handleToggleAllEvent = (e: Event) => {
    const customEvent = e as CustomEvent<{ collapse: boolean }>;
    if (customEvent.detail && typeof customEvent.detail.collapse === 'boolean') {
        isCollapsed.value = customEvent.detail.collapse;
        try {
            localStorage.setItem('rc_dash_collapsed_radar', String(isCollapsed.value));
        } catch {}
    }
};

onMounted(() => {
    try {
        const saved = localStorage.getItem('rc_dash_collapsed_radar');
        if (saved !== null) {
            isCollapsed.value = saved === 'true';
        }
    } catch {}
    window.addEventListener('rc:toggle-all-dashboard', handleToggleAllEvent);
});

onUnmounted(() => {
    window.removeEventListener('rc:toggle-all-dashboard', handleToggleAllEvent);
});
</script>
