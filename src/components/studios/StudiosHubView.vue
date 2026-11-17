<template>
  <div class="space-y-5 sm:space-y-6 pb-6 sm:pb-8">
    <!-- HEADER (Krug Trunk Test: Exact h1 + Quick Daily Tool Jump Pills, Zero Happy Talk) -->
    <header class="card bg-base-100 border border-base-300 rounded-2xl shadow-sm p-4 sm:p-6">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div class="space-y-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="badge badge-sm badge-primary text-primary-content font-extrabold whitespace-nowrap shrink-0">
              🧰 Reseller Workbenches
            </span>
            <span class="badge badge-sm badge-ghost border border-base-300 font-mono font-bold whitespace-nowrap shrink-0">
              {{ capabilities.roleBadge }}
            </span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-black tracking-tight text-base-content">
            Studios &amp; Reseller Tools
          </h1>
          <p class="text-xs sm:text-sm text-base-content/75">
            Every specialized scouting, thermal barcode, social cross-post, and AI workbench in one place.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2 shrink-0">
          <a
            href="/scout?quick=true"
            class="btn btn-sm h-11 md:h-9 btn-primary text-primary-content rounded-xl font-black gap-1.5 px-4 shadow-xs"
          >
            <Icon icon="solar:scanner-bold" class="w-4 h-4 shrink-0" />
            <span>Open Quick Scout</span>
          </a>
          <a
            href="/labels/studio"
            class="btn btn-sm h-11 md:h-9 btn-outline rounded-xl font-bold gap-1.5"
          >
            <Icon icon="solar:printer-bold-duotone" class="w-4 h-4 shrink-0 text-primary" />
            <span>Print Thermal Tags</span>
          </a>
          <a
            v-if="capabilities.canUseBookmarklets"
            href="/studios/bookmarklets"
            class="btn btn-sm h-11 md:h-9 btn-outline rounded-xl font-bold gap-1.5"
          >
            <Icon icon="solar:shield-keyhole-bold-duotone" class="w-4 h-4 shrink-0 text-warning" />
            <span>Bookmarklet Hub</span>
          </a>
        </div>
      </div>
    </header>

    <!-- 4 SCANNABLE WORKBENCHES GRID (Krug #4 Billboard Design) -->
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-5 sm:gap-6">
      <section
        v-for="wb in workbenches"
        :key="wb.id"
        class="card bg-base-100 border border-base-300 rounded-2xl shadow-sm p-4 sm:p-5 space-y-4"
      >
        <div class="border-b border-base-200 pb-3">
          <h2 class="text-lg sm:text-xl font-black tracking-tight text-base-content flex items-center gap-2">
            <span>{{ wb.emoji }}</span>
            <span>{{ wb.title }}</span>
          </h2>
          <p class="text-xs text-base-content/70 mt-0.5">{{ wb.subtitle }}</p>
        </div>

        <div class="space-y-2.5">
          <a
            v-for="tool in wb.tools"
            :key="tool.id"
            :href="tool.href"
            class="group flex items-center justify-between gap-3 rounded-2xl border border-base-300 bg-base-200/40 hover:bg-base-200 hover:border-primary/40 p-3 sm:p-3.5 transition-all cursor-pointer min-h-14"
          >
            <div class="flex items-start gap-3 min-w-0 flex-1">
              <div class="w-10 h-10 rounded-xl bg-base-100 border border-base-300 flex items-center justify-center shrink-0 shadow-2xs">
                <Icon :icon="tool.icon" class="w-5 h-5" :class="tool.iconColor" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-extrabold text-xs sm:text-sm text-base-content group-hover:text-primary transition-colors">
                    {{ tool.label }}
                  </span>
                  <span
                    v-if="tool.badge"
                    class="badge badge-2xs font-bold whitespace-nowrap shrink-0"
                    :class="tool.badgeClass || 'badge-ghost'"
                  >
                    {{ tool.badge }}
                  </span>
                </div>
                <p class="text-[11px] sm:text-xs text-base-content/70 leading-snug mt-0.5">
                  {{ tool.description }}
                </p>
              </div>
            </div>

            <span class="btn btn-xs h-9 md:h-8 px-3 btn-ghost border border-base-300 bg-base-100 group-hover:border-primary/50 rounded-xl font-bold shrink-0 gap-1">
              <span class="hidden sm:inline">{{ tool.actionLabel }}</span>
              <span class="sm:hidden">Open</span>
              <span>➔</span>
            </span>
          </a>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Icon } from '@iconify/vue';
import { useAuth } from '../../composables/useAuth';
import { useMemberCapabilities } from '../../lib/memberAccess';
import { buildStudiosWorkbenches } from '../../lib/studiosCatalog';
import { warehousesApi, type WarehouseDocument } from '../../lib/warehouses';

const { currentTeam } = useAuth();
const { capabilities } = useMemberCapabilities();
const liveWarehouses = ref<WarehouseDocument[]>([]);

const workbenches = computed(() =>
  buildStudiosWorkbenches(capabilities.value, liveWarehouses.value)
);

onMounted(async () => {
  if (!currentTeam.value?.$id) return;
  try {
    liveWarehouses.value = await warehousesApi.listWarehouses(currentTeam.value.$id);
  } catch {
    // Falls back cleanly to KNOWN_FACILITIES metadata
  }
});
</script>
