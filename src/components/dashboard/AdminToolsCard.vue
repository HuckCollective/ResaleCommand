<template>
  <div class="card bg-base-100 border border-base-300 shadow-sm rounded-2xl p-4 sm:p-5 space-y-3">
    <div>
      <div class="text-[11px] font-extrabold uppercase tracking-wider text-primary">Steward Tools</div>
      <p class="text-xs text-base-content/65 leading-relaxed">
        The Founder steward has extra controls, not extra information. Every voting member sees the same collective numbers.
      </p>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <a
        v-for="tool in tools"
        :key="tool.label"
        :href="tool.href"
        class="p-3 rounded-xl bg-base-200/50 border border-base-300 hover:border-primary/50 hover:bg-base-200 transition-all flex items-center gap-2.5"
      >
        <Icon :icon="tool.icon" class="w-5 h-5 text-primary shrink-0" />
        <div class="min-w-0">
          <div class="text-xs font-black break-words">{{ tool.label }}</div>
          <div class="text-[10px] opacity-60 break-words">{{ tool.hint }}</div>
        </div>
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';

const tools = [
  { label: 'Global financial settings', hint: 'Splits, deal terms, rates', icon: 'solar:settings-bold-duotone', href: '/settings' },
  { label: 'Register barcode prefixes', hint: 'Permanent once registered', icon: 'solar:tag-horizontal-bold-duotone', href: '/settings' },
  { label: 'Enact a passed vote', hint: 'Apply policy presets', icon: 'solar:users-group-two-rounded-bold-duotone', href: '/coop/governance' },
];
</script>
