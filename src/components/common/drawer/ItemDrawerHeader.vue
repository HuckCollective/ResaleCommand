<template>
    <div class="border-b border-base-200 bg-base-100 flex-none sticky top-0 z-30 shadow-2xs">
        <!-- 1. MAIN STICKY BAR: ITEM TITLE & IDENTITY -->
        <div class="px-4 py-2.5 sm:px-6 flex justify-between items-center gap-3">
            <!-- Left: Icon & Title + Combined Identity Row -->
            <div class="flex items-center gap-2.5 min-w-0 flex-1">
                <div 
                    class="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 cursor-pointer hover:bg-primary/20 transition-all shadow-2xs"
                    @click="isNamingOpen = !isNamingOpen"
                    :title="isNamingOpen ? 'Close Title & Identity Panel' : 'Edit Title & Identity'"
                >
                    <Icon :icon="isNamingOpen ? 'solar:alt-arrow-up-linear' : 'solar:pen-bold'" class="w-4 h-4 transition-transform duration-200" />
                </div>

                <div class="min-w-0 flex-1">
                    <!-- Title Line with Quick Toggle -->
                    <div class="flex items-center gap-2">
                        <h3 
                            class="font-bold text-sm sm:text-base leading-tight truncate text-base-content hover:text-primary transition-colors cursor-pointer select-none"
                            :title="displayCatalogTitle"
                            @click="isNamingOpen = !isNamingOpen"
                        >
                            {{ displayCatalogTitle }}
                        </h3>

                        <!-- Collapsible Toggle Pill Button -->
                        <button
                            type="button"
                            class="btn btn-xs rounded-lg gap-1 border h-6 min-h-0 px-2 text-[10px] shrink-0 transition-all font-semibold"
                            :class="isNamingOpen 
                                ? 'btn-primary text-primary-content shadow-xs' 
                                : 'btn-ghost border-base-300 hover:border-primary/50 text-base-content/70 hover:text-base-content'"
                            @click="isNamingOpen = !isNamingOpen"
                            :title="isNamingOpen ? 'Close Title & Identity Hub' : 'Edit Title & Identity'"
                        >
                            <Icon :icon="isNamingOpen ? 'solar:alt-arrow-up-linear' : 'solar:pen-2-bold'" class="w-3 h-3" />
                            <span>{{ isNamingOpen ? 'Close' : 'Edit Title & Tag' }}</span>
                        </button>
                    </div>

                    <!-- COMBINED IDENTITY ROW (Barcode, SKU, Lot ID, Sticker Status) -->
                    <div class="flex items-center gap-2 font-mono text-[11px] mt-1 flex-wrap">
                        <!-- Barcode / UPC (Click to copy) -->
                        <button 
                            v-if="effectiveUpc"
                            type="button"
                            class="badge badge-primary badge-xs font-mono font-bold gap-1 py-1.5 px-2 cursor-pointer hover:brightness-110 active:scale-95 transition-all shadow-2xs"
                            @click.stop="copyUpc"
                            :title="`Click to copy barcode: ${effectiveUpc}`"
                        >
                            <Icon icon="solar:tag-horizontal-bold-duotone" class="w-3 h-3" />
                            <span>{{ effectiveUpc }}</span>
                        </button>

                        <!-- Memory Den Booth SKU (Click to copy) -->
                        <button 
                            v-if="effectiveLocationSku"
                            type="button"
                            class="badge badge-secondary badge-xs font-mono font-bold gap-1 py-1.5 px-2 cursor-pointer hover:brightness-110 active:scale-95 transition-all shadow-2xs"
                            @click.stop="copyLocationSku"
                            :title="`Memory Den Booth SKU: ${effectiveLocationSku} (Click to copy)`"
                        >
                            <Icon icon="solar:shop-2-bold" class="w-3 h-3" />
                            <span>DEN: {{ effectiveLocationSku }}</span>
                        </button>

                        <!-- Item Identity (if different from UPC) -->
                        <span 
                            v-if="item?.identity && item.identity !== effectiveUpc" 
                            class="badge badge-ghost badge-xs font-mono text-[10px] text-base-content/70 border border-base-300/80"
                            :title="`Identity / SKU: ${item.identity}`"
                        >
                            Lot: {{ item.identity }}
                        </span>

                        <!-- Document ID -->
                        <span class="opacity-50 text-[10px]" :title="item?.$id || 'Draft'">
                            ID: {{ item?.$id ? `${item.$id.substring(0, 8)}...` : 'Draft' }}
                        </span>

                        <!-- Sticker Tag Status Pill -->
                        <span 
                            class="badge badge-xs font-mono text-[10px] max-w-48 truncate cursor-pointer transition-all border"
                            :class="editForm?.tagTitle 
                                ? 'badge-success/15 border-success/30 text-success font-semibold hover:border-success/60' 
                                : 'badge-ghost opacity-60 border-dashed border-base-300 hover:opacity-100'"
                            @click.stop="isNamingOpen = true"
                            :title="editForm?.tagTitle ? `Sticker Tag: ${editForm.tagTitle}` : 'No short tag name set yet (Click to set)'"
                        >
                            🏷️ {{ editForm?.tagTitle ? editForm.tagTitle : 'No Tag Name Set' }}
                        </span>
                    </div>
                </div>
            </div>

            <!-- Right: Actions & Badges -->
            <div class="flex items-center gap-2 shrink-0">
                <!-- Copy Title Button -->
                <button 
                    type="button" 
                    class="btn btn-xs btn-ghost border border-base-300 text-base-content/70 hover:text-base-content text-[10px] h-6 min-h-0 px-2 hidden sm:inline-flex items-center gap-1"
                    @click="emit('copy-title')"
                    title="Copy full title to clipboard"
                >
                    <Icon icon="solar:copy-linear" class="w-3 h-3" />
                    <span>Copy</span>
                </button>

                <!-- Needs Shop Update Reminder & 1-Click Dismiss -->
                <div v-if="hasShopUpdateReminder" class="flex items-center gap-1.5 bg-warning/15 border border-warning/40 rounded-lg px-2 py-1">
                    <span class="badge badge-warning badge-xs font-bold gap-1 py-1 text-[10px] shadow-xs">
                        <Icon icon="solar:danger-triangle-bold" class="w-3 h-3 text-warning-content" />
                        Needs Shop Update
                    </span>
                    <button 
                        type="button" 
                        class="btn btn-xs btn-success text-[10px] h-6 min-h-0 px-2 font-bold gap-1 shadow-xs"
                        @click.stop="emit('dismiss-shop-update')"
                        title="Click when you have updated this item's barcode in Ricochet POS"
                    >
                        <Icon icon="solar:check-circle-bold" class="w-3 h-3" />
                        Mark Shop Updated
                    </button>
                </div>

                <!-- Optional Quick Flag when not set -->
                <button
                    v-else-if="item?.$id"
                    type="button"
                    class="btn btn-xs btn-ghost border border-dashed border-base-300 text-base-content/60 hover:text-base-content hover:border-base-content/40 text-[10px] h-6 min-h-0 px-2 hidden sm:inline-flex items-center gap-1"
                    @click.stop="emit('flag-shop-update')"
                    title="Flag this item to remind yourself to update its barcode in Ricochet POS"
                >
                    <Icon icon="solar:bell-linear" class="w-3 h-3" />
                    Remind Shop Update
                </button>

                <!-- Multi-Quantity Stock Badge -->
                <div v-if="itemQty > 1" class="hidden sm:flex items-center gap-1 text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-md px-2 py-1 shadow-2xs" :title="`Batch listing with ${itemQty} units`">
                    <Icon icon="solar:box-minimalistic-bold" class="w-3.5 h-3.5 text-amber-500" />
                    <span>{{ itemQty }} in Stock</span>
                </div>

                <!-- Close Drawer Button -->
                <button class="btn btn-sm btn-circle btn-ghost" @click="emit('close')" aria-label="Close Drawer">✕</button>
            </div>
        </div>

        <!-- 2. COLLAPSIBLE TITLE & IDENTITY HUB -->
        <Transition name="naming-slide">
            <div v-if="isNamingOpen" class="border-t border-base-200 bg-base-200/50 backdrop-blur-xs px-4 py-3.5 sm:px-6 shadow-inner space-y-3.5">
                <!-- Panel Header -->
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <Icon icon="solar:tag-price-bold" class="w-4 h-4 text-primary" />
                        <h4 class="font-bold text-xs uppercase tracking-wider text-base-content/80">
                            Item Title & Identity Hub
                        </h4>
                    </div>

                    <div class="flex items-center gap-2">
                        <!-- Magic Shorten Button -->
                        <button
                            type="button"
                            class="btn btn-xs btn-outline btn-primary text-[11px] h-6 min-h-0 px-2 gap-1 rounded-lg shadow-2xs"
                            @click="handleAutoShorten"
                            title="Auto-condense full title into a clean, human-readable sticker name"
                        >
                            <Icon icon="solar:magic-stick-3-bold" class="w-3.5 h-3.5" />
                            <span>Magic Shorten</span>
                        </button>

                        <button 
                            type="button" 
                            class="btn btn-xs btn-ghost text-[11px] h-6 min-h-0 px-2 font-bold gap-1 text-base-content/70 hover:text-base-content"
                            @click="isNamingOpen = false"
                        >
                            <Icon icon="solar:check-circle-bold" class="w-3.5 h-3.5 text-success" />
                            <span>Done</span>
                        </button>
                    </div>
                </div>

                <!-- AI Suggested Title Banners (Full Title & Short Tag) -->
                <div v-if="(suggestedTitleStr && suggestedTitleStr !== editForm.title) || (effectiveSuggestedTagTitle && effectiveSuggestedTagTitle !== editForm.tagTitle)" class="space-y-2">
                    <!-- AI Suggested Full Catalog Title Banner -->
                    <button 
                        v-if="suggestedTitleStr && suggestedTitleStr !== editForm.title" 
                        type="button" 
                        class="btn btn-2xs btn-outline btn-secondary font-normal w-full text-left h-auto py-1 px-2.5 justify-between items-center rounded-xl shadow-xs gap-2"
                        @click="applyAiTitle" 
                        title="Click to apply AI suggested catalog title"
                    >
                        <div class="flex items-center gap-1.5 min-w-0 flex-1">
                            <Icon icon="solar:magic-stick-linear" class="w-3.5 h-3.5 shrink-0 text-secondary" /> 
                            <span class="whitespace-normal break-words leading-tight text-xs truncate">
                                <strong class="font-bold text-secondary">AI Suggested Full Title:</strong> {{ suggestedTitleStr }}
                            </span>
                        </div>
                        <span class="badge badge-secondary badge-2xs font-mono font-bold shrink-0">Apply ↵</span>
                    </button>

                    <!-- AI Suggested Short Sticker Tag Title Banner -->
                    <button 
                        v-if="effectiveSuggestedTagTitle && effectiveSuggestedTagTitle !== editForm.tagTitle" 
                        type="button" 
                        class="btn btn-2xs btn-outline btn-primary font-normal w-full text-left h-auto py-1 px-2.5 justify-between items-center rounded-xl shadow-xs gap-2"
                        @click="applyAiTagTitle(effectiveSuggestedTagTitle)" 
                        title="Click to apply AI suggested sticker tag title"
                    >
                        <div class="flex items-center gap-1.5 min-w-0 flex-1">
                            <Icon icon="solar:tag-price-bold" class="w-3.5 h-3.5 shrink-0 text-primary" /> 
                            <span class="whitespace-normal break-words leading-tight text-xs truncate">
                                <strong class="font-bold text-primary">AI Suggested Sticker Tag:</strong> {{ effectiveSuggestedTagTitle }}
                            </span>
                        </div>
                        <span class="badge badge-primary badge-2xs font-mono font-bold shrink-0">Apply ↵</span>
                    </button>
                </div>

                <!-- 2-Column Responsive Inputs -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-start">
                    <!-- Column 1: Short Sticker Price Tag Title (Physical 2x1 Thermal Label) -->
                    <div class="space-y-1.5">
                        <div class="flex justify-between items-center text-xs">
                            <label class="font-bold text-base-content flex items-center gap-1.5">
                                <span>🏷️ Short Sticker Title (Printed on Price Tag)</span>
                            </label>
                            <!-- Character Count Badge -->
                            <span 
                                class="badge badge-xs font-mono font-bold"
                                :class="tagTitleBadgeClass"
                                :title="tagTitleCount > 38 ? 'Exceeds standard 38-char label width' : 'Fits standard 2x1 label'"
                            >
                                {{ tagTitleCount }} / 38 chars
                            </span>
                        </div>

                        <div class="relative flex items-center">
                            <input 
                                type="text"
                                v-model="editForm.tagTitle"
                                maxlength="42"
                                placeholder="e.g. Wiccan Books (Choice of 9)"
                                class="input input-sm input-bordered w-full pr-16 font-mono text-xs font-semibold focus:input-primary rounded-xl bg-base-100"
                            />
                            <button
                                type="button"
                                class="absolute right-1.5 btn btn-xs btn-ghost text-primary text-[10px] font-bold h-6 min-h-0 px-1.5 gap-0.5 hover:bg-primary/10"
                                @click="handleAutoShorten"
                                title="Auto-condense from full catalog title or cycle suggestions"
                            >
                                <Icon icon="solar:magic-stick-3-bold" class="w-3 h-3" />
                                <span>Auto</span>
                            </button>
                        </div>

                        <!-- Smart Tag Title Suggestion Chips -->
                        <div v-if="tagTitleSuggestions.length > 0" class="flex flex-wrap items-center gap-1 pt-0.5">
                            <span class="text-[9px] uppercase font-bold opacity-50 mr-0.5">Quick Tags:</span>
                            <button 
                                v-for="sug in tagTitleSuggestions" 
                                :key="sug"
                                type="button" 
                                @click="editForm.tagTitle = sug"
                                class="btn btn-2xs font-mono py-0 h-5 min-h-0 px-2 text-[10px] rounded-md transition-all"
                                :class="editForm.tagTitle === sug 
                                    ? 'btn-primary text-primary-content font-bold shadow-2xs' 
                                    : 'btn-ghost border border-base-300 hover:border-primary/50 text-base-content/80'"
                                :title="`Apply: '${sug}' (${sug.length} chars)`"
                            >
                                {{ sug }} <span class="opacity-60 text-[9px] font-sans">({{ sug.length }})</span>
                            </button>
                        </div>

                        <p class="text-[10px] opacity-70 leading-tight">
                            🏷️ <strong>Physical 2"x1" Thermal Label:</strong> Printed on booth price tags (Memory Den / DustyTiger). Strictly capped at 38 chars to guarantee crisp, non-wrapping label print.
                        </p>
                    </div>

                    <!-- Column 2: Full Catalog / Marketplace Title -->
                    <div class="space-y-1.5">
                        <div class="flex justify-between items-center text-xs">
                            <label class="font-bold text-base-content flex items-center gap-1.5">
                                <span>📦 Full Catalog Title (Register & Web)</span>
                            </label>
                            <span class="badge badge-xs badge-ghost font-mono opacity-70">
                                {{ (editForm.title || '').length }} chars
                            </span>
                        </div>

                        <div class="join w-full shadow-xs">
                            <textarea 
                                v-model="editForm.title"
                                rows="2"
                                maxlength="255"
                                placeholder="Brand, Item Name, Model, Edition, Sizing..."
                                class="textarea textarea-bordered join-item grow font-bold text-xs sm:text-sm leading-snug py-1.5 resize-none bg-base-100 focus:textarea-primary"
                            ></textarea>
                            <button 
                                type="button" 
                                class="btn join-item border border-base-300 h-auto px-2.5 flex items-center justify-center hover:bg-base-200" 
                                @click="emit('copy-title')" 
                                title="Copy Title"
                            >
                                <Icon icon="solar:copy-linear" class="w-4 h-4" />
                            </button>
                        </div>

                        <p class="text-[10px] opacity-70 leading-tight">
                            📦 <strong>Register & E-Commerce:</strong> Primary descriptive title for POS cashier lookup, printed customer receipts, and online listings (eBay, Poshmark, Storefront).
                        </p>
                    </div>
                </div>

                <!-- Live Tag vs POS Receipt Preview Strip -->
                <div class="bg-base-100 rounded-xl p-3 border border-base-300 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
                    <!-- Physical Label Preview -->
                    <div class="flex items-center gap-2 min-w-0 flex-1">
                        <span class="badge badge-primary badge-xs uppercase font-mono tracking-wider font-bold shrink-0">
                            🏷️ 2"x1" Thermal Tag
                        </span>
                        <span class="font-bold truncate font-mono text-[11px] text-primary" :title="`Thermal sticker preview: [${effectiveUpc || 'BARCODE'}] $${effectivePrice} — ${effectiveTagTitlePreview}`">
                            [{{ effectiveUpc || 'BARCODE' }}] ${{ effectivePrice }} — {{ effectiveTagTitlePreview }}
                        </span>
                    </div>

                    <!-- POS Register & Receipt Preview -->
                    <div class="flex items-center gap-2 text-[11px] opacity-80 shrink-0 md:border-l md:border-base-300 md:pl-3 max-w-sm lg:max-w-md">
                        <Icon icon="solar:receipt-linear" class="w-4 h-4 text-base-content/60 shrink-0" />
                        <div class="truncate">
                            <span class="opacity-60 text-[10px] uppercase font-bold mr-1">POS & Web Title:</span>
                            <strong class="text-base-content" :title="editForm.title || 'Untitled Item'">{{ editForm.title || 'Untitled Item' }}</strong>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { condenseTitleForTag, cleanTagTitle } from '../../../lib/exportUtils';
import { generateSmartTagTitleSuggestions } from '../../../lib/lotTitleGenerator';
import { addToast } from '../../../stores/toast';

const props = defineProps({
    item: {
        type: Object,
        default: null
    },
    editForm: {
        type: Object,
        default: () => ({})
    },
    suggestedTitleStr: {
        type: String,
        default: null
    },
    suggestedTagTitleStr: {
        type: String,
        default: null
    }
});

const emit = defineEmits(['close', 'dismiss-shop-update', 'flag-shop-update', 'copy-title']);

// Collapsible state (collapsed by default so header stays slim)
const isNamingOpen = ref(false);

const displayCatalogTitle = computed(() => {
    return props.editForm?.title || props.item?.title || (props.item ? 'Untitled Item' : 'New Listing Draft');
});

const effectiveUpc = computed(() => {
    return props.editForm?.upc || props.item?.upc || props.item?.sku || null;
});

const copyUpc = () => {
    if (effectiveUpc.value) {
        navigator.clipboard.writeText(effectiveUpc.value);
        addToast({ type: 'success', message: `Copied barcode ${effectiveUpc.value}!` });
    }
};

const effectiveLocationSku = computed(() => {
    return props.editForm?.locationSku || props.item?.locationSku || null;
});

const copyLocationSku = () => {
    if (effectiveLocationSku.value) {
        navigator.clipboard.writeText(effectiveLocationSku.value);
        addToast({ type: 'success', message: `Copied booth SKU ${effectiveLocationSku.value}!` });
    }
};


const effectiveSuggestedTagTitle = computed(() => {
    if (props.suggestedTagTitleStr && props.suggestedTagTitleStr.trim()) {
        return cleanTagTitle(props.suggestedTagTitleStr.trim());
    }
    if (props.suggestedTitleStr && props.suggestedTitleStr.trim()) {
        return condenseTitleForTag(props.suggestedTitleStr.trim());
    }
    return null;
});

const effectiveTagTitlePreview = computed(() => {
    if (props.editForm?.tagTitle && props.editForm.tagTitle.trim()) {
        return cleanTagTitle(props.editForm.tagTitle.trim());
    }
    const full = props.editForm?.title || props.item?.title || '';
    return full ? condenseTitleForTag(full) : 'Untitled Item';
});

const tagTitleCount = computed(() => {
    return (props.editForm?.tagTitle || '').length;
});

const tagTitleBadgeClass = computed(() => {
    const len = tagTitleCount.value;
    if (len === 0) return 'badge-ghost opacity-60';
    if (len <= 38) return 'badge-success text-success-content';
    if (len <= 42) return 'badge-warning text-warning-content';
    return 'badge-error text-error-content';
});

const tagTitleSuggestions = computed(() => {
    const full = props.editForm?.title || props.item?.title || props.suggestedTitleStr || '';
    return generateSmartTagTitleSuggestions(full, {
        tagTitle: props.editForm?.tagTitle,
        quantity: itemQty.value,
        aiTagTitle: effectiveSuggestedTagTitle.value,
        brand: props.editForm?.brand || props.item?.brand
    });
});

const applyAiTagTitle = (tagVal) => {
    const target = tagVal || effectiveSuggestedTagTitle.value;
    if (target) {
        props.editForm.tagTitle = cleanTagTitle(target);
        addToast({ type: 'success', message: `Applied sticker tag: "${props.editForm.tagTitle}"` });
    }
};

const handleAutoShorten = () => {
    // If smart suggestions are available, pick the top one or cycle to the next alternative
    if (tagTitleSuggestions.value.length > 0) {
        const current = (props.editForm?.tagTitle || '').trim();
        const next = tagTitleSuggestions.value.find(s => s.toLowerCase() !== current.toLowerCase()) || tagTitleSuggestions.value[0];
        props.editForm.tagTitle = next;
        addToast({ type: 'success', message: `Set sticker tag: "${next}" (${next.length} chars)` });
        return;
    }
    const full = props.editForm?.title || props.item?.title || '';
    if (!full || !full.trim()) {
        addToast({ type: 'warning', message: 'Enter a catalog title first to auto-shorten.' });
        return;
    }
    const shortened = condenseTitleForTag(full);
    props.editForm.tagTitle = shortened;
    addToast({ type: 'success', message: `Created sticker tag: "${shortened}" (${shortened.length} chars)` });
};

const applyAiTitle = () => {
    if (props.suggestedTitleStr) {
        props.editForm.title = props.suggestedTitleStr;
        // Also auto-suggest tag if tag title is empty
        if (!props.editForm.tagTitle) {
            props.editForm.tagTitle = effectiveSuggestedTagTitle.value || condenseTitleForTag(props.suggestedTitleStr);
        }
        addToast({ type: 'success', message: 'Applied AI Suggested Full Title!' });
    }
};

const itemQty = computed(() => {
    return Math.max(1, Number(props.editForm?.quantity || props.item?.quantity || 1));
});

const hasShopUpdateReminder = computed(() => {
    const itemFlags = Array.isArray(props.item?.redFlags) ? props.item.redFlags : [];
    const formFlags = Array.isArray(props.editForm?.redFlags) ? props.editForm.redFlags : [];
    const inFlags = itemFlags.includes('needs_shop_update') || formFlags.includes('needs_shop_update');
    const inNotes = typeof props.item?.conditionNotes === 'string' && props.item.conditionNotes.includes('[NEEDS_SHOP_UPDATE]');
    return inFlags || inNotes;
});
</script>

<style scoped>
.naming-slide-enter-active,
.naming-slide-leave-active {
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    max-height: 380px;
    overflow: hidden;
    opacity: 1;
}

.naming-slide-enter-from,
.naming-slide-leave-to {
    max-height: 0;
    opacity: 0;
    padding-top: 0;
    padding-bottom: 0;
    transform: translateY(-6px);
}
</style>
