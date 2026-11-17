<template>
  <div>
    <!-- Wait for server capability resolution before mounting protected Collective slots -->
    <div v-if="!capabilitiesResolved" class="space-y-4 py-6">
      <div class="skeleton h-20 w-full rounded-2xl"></div>
      <div class="skeleton h-48 w-full rounded-2xl"></div>
    </div>

    <!-- Consignor Isolation Card (Zero Collective Roster / Labor / Contract Leaks) -->
    <div
      v-else-if="!capabilities.canSeeCollectiveFinancials"
      class="max-w-xl mx-auto my-10"
    >
      <div class="card bg-base-100 border-2 border-warning/40 shadow-lg rounded-2xl p-6 text-center space-y-4">
        <div class="text-4xl">🤝</div>
        <h2 class="text-xl font-black text-base-content">
          Your Consignor Statement Is on Your Command Dashboard
        </h2>
        <p class="text-sm text-base-content/75 leading-relaxed">
          Collective labor ledgers, member rosters, and workspace settings are restricted to Voting Collective members. View your personal sold items, rent deductions, and monthly payout statement directly on your Command Dashboard.
        </p>
        <div class="pt-2 flex flex-wrap justify-center gap-3">
          <a
            href="/dashboard"
            class="btn btn-primary h-11 md:h-10 text-primary-content font-black rounded-xl px-5"
          >
            Open My Command Dashboard
          </a>
          <a
            href="/inventory"
            class="btn btn-outline h-11 md:h-10 font-bold rounded-xl px-4"
          >
            View My Inventory
          </a>
        </div>
      </div>
    </div>

    <!-- Authorized Voting Collective Member Slot -->
    <slot v-else />
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { useAuth } from '../../composables/useAuth';
import { useMemberCapabilities } from '../../lib/memberAccess';

const props = withDefaults(
  defineProps<{
    redirectOnDeny?: boolean;
  }>(),
  {
    redirectOnDeny: true,
  }
);

const { isAuthenticated, loading: authLoading } = useAuth();
const { capabilities, capabilitiesResolved } = useMemberCapabilities();

if (typeof window !== 'undefined') {
  watch(
    [capabilitiesResolved, () => capabilities.value.canSeeCollectiveFinancials, isAuthenticated, authLoading],
    ([resolved, allowed, authed, isLoading]) => {
      if (!props.redirectOnDeny) return;
      if (!resolved || isLoading || !authed) return;
      if (!allowed) {
        const path = window.location.pathname;
        // Never redirect off the public/shared /coop Living Charter route
        if (path === '/coop' || path === '/coop/') return;
        window.location.replace('/dashboard');
      }
    },
    { immediate: true }
  );
}
</script>
