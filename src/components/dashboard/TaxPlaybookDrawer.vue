<template>
  <SlideOverDrawer
    v-model="isOpen"
    title="IRS Schedule C Tax & OpEx Playbook"
    subtitle="Statutory write-off categories, Commons vs. Personal rules, and Cohan compliance"
    size="lg"
  >
    <div class="space-y-4 text-xs text-base-content">
      <!-- Live Actionable Tax Tips from Current Snapshot -->
      <div v-if="taxTips.length > 0" class="space-y-2">
        <div class="text-[11px] font-extrabold uppercase tracking-wider text-success">
          Live Deduction Opportunities ({{ taxTips.length }})
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <a
            v-for="tip in taxTips"
            :key="tip.filter"
            :href="tip.link"
            class="p-3 rounded-xl border border-success/35 bg-success/5 hover:border-success/80 transition-all space-y-1 block"
          >
            <div class="flex flex-wrap items-center justify-between gap-1">
              <span class="font-bold text-xs text-base-content break-words">{{ tip.title }}</span>
              <span v-if="tip.scheduleC" class="badge badge-2xs badge-outline font-mono whitespace-nowrap">{{ tip.scheduleC }}</span>
            </div>
            <p class="text-[11px] text-base-content/75 leading-relaxed break-words">{{ tip.description }}</p>
          </a>
        </div>
      </div>

      <!-- Server-Rendered Markdown CMS Playbook (src/content/tax/rules.md) -->
      <div
        v-if="playbookHtml"
        class="prose prose-sm max-w-none prose-headings:font-black prose-headings:tracking-tight prose-p:leading-relaxed prose-blockquote:border-warning prose-blockquote:bg-warning/10 prose-blockquote:rounded-r-xl prose-blockquote:py-2 prose-blockquote:px-4"
        v-html="playbookHtml"
      ></div>
    </div>

    <template #footer>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <a href="/expenses" class="btn btn-sm btn-outline rounded-xl font-bold gap-1.5">
          <Icon icon="solar:bill-list-bold-duotone" class="w-4 h-4" />
          <span>Open Expenses &amp; Receipts</span>
        </a>
        <button type="button" class="btn btn-sm btn-primary text-primary-content rounded-xl font-bold px-5" @click="isOpen = false">
          Done
        </button>
      </div>
    </template>
  </SlideOverDrawer>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { Icon } from '@iconify/vue';
import SlideOverDrawer from '../common/SlideOverDrawer.vue';
import { useDashboardMetrics } from '../../composables/dashboard/useDashboardMetrics';

defineProps<{
  playbookHtml?: string;
}>();

const isOpen = ref(false);
const { taxTips } = useDashboardMetrics();

const openPlaybook = () => {
  isOpen.value = true;
};

onMounted(() => {
  window.addEventListener('rc:open-tax-playbook', openPlaybook);
});

onUnmounted(() => {
  window.removeEventListener('rc:open-tax-playbook', openPlaybook);
});
</script>

