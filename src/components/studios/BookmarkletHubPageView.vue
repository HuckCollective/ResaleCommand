<template>
  <div class="space-y-4 pb-6 sm:pb-8">
    <!-- Wayfinding Breadcrumb (Krug #5 Trunk Test) -->
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <a
        href="/studios"
        class="btn btn-xs sm:btn-sm h-11 md:h-8 btn-ghost border border-base-300 rounded-xl font-bold gap-1.5"
      >
        <Icon icon="solar:arrow-left-linear" class="w-4 h-4 shrink-0" />
        <span>Back to Studios &amp; Tools</span>
      </a>
      <span class="badge badge-sm badge-ghost border border-base-300 font-mono font-bold whitespace-nowrap shrink-0">
        {{ capabilities.roleBadge }}
      </span>
    </div>

    <div
      v-if="!capabilities.canUseBookmarklets"
      role="alert"
      class="card bg-base-100 border border-warning/40 rounded-2xl p-5 sm:p-6 space-y-3"
    >
      <div class="flex items-center gap-2 text-warning font-black text-base">
        <Icon icon="solar:shield-warning-bold" class="w-5 h-5 shrink-0" />
        <h1>Founder or Curator Hat Required</h1>
      </div>
      <p class="text-xs sm:text-sm text-base-content/80 leading-relaxed">
        Cross-site sourcing and POS sync bookmarklets are restricted to Collective Founders (👑) and Curators (💎).
      </p>
      <div>
        <a href="/studios" class="btn btn-sm h-11 md:h-9 btn-primary text-primary-content rounded-xl font-black">
          Return to Studios &amp; Tools
        </a>
      </div>
    </div>

    <BookmarkletRegistryPanel
      v-else
      heading-tag="h1"
      :can-edit="capabilities.canUseBookmarklets"
      :default-location-code="defaultRicochetMeta.code"
      :default-location-short-name="defaultRicochetMeta.shortName"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Icon } from '@iconify/vue';
import BookmarkletRegistryPanel from '../bml/BookmarkletRegistryPanel.vue';
import { useAuth } from '../../composables/useAuth';
import { useMemberCapabilities } from '../../lib/memberAccess';
import {
  resolveDefaultRicochetLocationMeta,
  warehousesApi,
  type WarehouseDocument,
} from '../../lib/warehouses';

const { currentTeam } = useAuth();
const { capabilities } = useMemberCapabilities();
const liveWarehouses = ref<WarehouseDocument[]>([]);

const defaultRicochetMeta = computed(() =>
  resolveDefaultRicochetLocationMeta(liveWarehouses.value)
);

onMounted(async () => {
  if (!currentTeam.value?.$id) return;
  try {
    liveWarehouses.value = await warehousesApi.listWarehouses(currentTeam.value.$id);
  } catch {
    // Uses canonical default Ricochet booth metadata
  }
});
</script>
