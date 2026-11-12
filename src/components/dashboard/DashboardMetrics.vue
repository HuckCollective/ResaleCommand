<template>
  <DashboardShell
    mode="live"
    :tax-playbook-html="taxPlaybookHtml"
    :role-help-html-map="roleHelpHtmlMap"
  />
</template>

<script setup lang="ts">
import DashboardShell from './DashboardShell.vue';
import type { MemberHat } from '../../lib/memberHats';

defineProps<{
  taxPlaybookHtml?: string;
  roleHelpHtmlMap?: Partial<Record<MemberHat, string>>;
}>();
</script>

