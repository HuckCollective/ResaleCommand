<template>
  <DashboardShell mode="live" :tax-playbook-html="taxPlaybookHtml" />
</template>

<script setup lang="ts">
import DashboardShell from './DashboardShell.vue';

defineProps<{
  taxPlaybookHtml?: string;
}>();
</script>
