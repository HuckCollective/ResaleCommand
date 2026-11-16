<template>
  <div v-if="period !== 'all' && location === 'all'" class="space-y-2.5">
    <!-- Compact Month Finalization & Lock Bar -->
    <div
      class="rounded-2xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
      :class="statusContainerClass"
    >
      <div class="space-y-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="badge badge-xs font-black" :class="statusBadgeClass">
            {{ statusBadgeLabel }}
          </span>
          <span v-if="activeLock?.snapshotHash" class="badge badge-outline badge-xs font-mono">
            snapshot #{{ activeLock.snapshotHash.slice(0, 8) }}
            <template v-if="activeLock.revision > 1"> · rev {{ activeLock.revision }}</template>
          </span>
          <span v-if="activeLock?.payoutDate" class="text-[11px] font-mono opacity-75">
            Paid: {{ activeLock.payoutDate }}
          </span>
        </div>

        <p class="text-[11px] text-base-content/75">
          <template v-if="activeLock?.status === 'locked'">
            Locked by <strong>{{ activeLock.lockedBy.name }}</strong> on {{ activeLock.lockedAt.slice(0, 10) }}. Statements &amp; PDFs render strictly from this frozen payout snapshot.
          </template>
          <template v-else-if="activeLock?.status === 'unlocked'">
            Reopened after payout — review adjustments and re-lock <strong>{{ periodLabel }}</strong> to finalize revision {{ (activeLock.revision || 1) + 1 }}.
          </template>
          <template v-else-if="isMonthInProgress">
            {{ periodLabel }} is still open in Pacific time — booth rent and Gate 4B bonuses finalize once the calendar month closes.
          </template>
          <template v-else>
            {{ periodLabel }} is closed and unlocked. Once checks are issued, a Founder can lock this month so later edits never alter paid figures.
          </template>
        </p>
      </div>

      <div class="flex items-center gap-2 shrink-0 flex-wrap">
        <template v-if="canLockMonth">
          <button
            v-if="activeLock?.status === 'locked'"
            type="button"
            class="btn btn-xs sm:btn-sm h-11 min-h-11 md:h-9 md:min-h-9 btn-warning btn-outline rounded-xl font-bold gap-1.5"
            :disabled="isSubmitting"
            @click="openUnlockDrawer"
          >
            <span>🔓 Unlock (Reason Required)</span>
          </button>
          <button
            v-else-if="!isMonthInProgress"
            type="button"
            class="btn btn-xs sm:btn-sm h-11 min-h-11 md:h-9 md:min-h-9 btn-primary text-primary-content rounded-xl font-black gap-1.5 shadow-2xs"
            :disabled="isSubmitting"
            @click="openLockDrawer"
          >
            <span>🔒 {{ activeLock?.status === 'unlocked' ? 'Re-Lock Month' : 'Lock Month & Record Payouts' }}</span>
          </button>
        </template>
        <span v-else class="text-[11px] opacity-65 font-semibold">
          {{ activeLock?.status === 'locked' ? 'Ask a Founder to reopen' : 'Founder locks after payout' }}
        </span>
      </div>
    </div>

    <!-- Live-Drift Alert (When Locked Month Differs from Current Live Sales/Expenses/Policy) -->
    <div
      v-if="activeLock?.status === 'locked' && hasLiveDrift"
      class="alert alert-warning rounded-2xl py-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
    >
      <div class="flex items-center gap-2">
        <Icon icon="solar:danger-triangle-bold" class="w-4 h-4 shrink-0" />
        <span>
          ⚠️ <strong>Live data now differs from the locked payout by ${{ Math.abs(driftDeltaChecks).toFixed(2) }}</strong> — locked figures &amp; PDFs are unchanged.
        </span>
      </div>
      <button
        type="button"
        class="btn btn-xs h-11 min-h-11 md:h-7 md:min-h-0 btn-outline rounded-lg font-bold shrink-0"
        @click="showDriftDetails = !showDriftDetails"
      >
        {{ showDriftDetails ? 'Hide Drift' : 'Review Drift' }}
      </button>
    </div>

    <div
      v-if="activeLock?.status === 'locked' && hasLiveDrift && showDriftDetails"
      class="rounded-2xl border border-warning/40 bg-warning/5 p-3.5 text-xs space-y-1.5"
    >
      <div class="font-black">Locked Snapshot vs. Current Live Inputs</div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px]">
        <div>
          Locked Total Checks: <strong>${{ Number(activeLock.totals.totalCuratorPayouts).toFixed(2) }}</strong>
        </div>
        <div>
          Live Recomputed Checks: <strong>${{ liveTotalPayoutChecks.toFixed(2) }}</strong>
        </div>
        <div>
          Delta: <strong :class="driftDeltaChecks >= 0 ? 'text-success' : 'text-error'">{{ driftDeltaChecks >= 0 ? '+' : '' }}${{ driftDeltaChecks.toFixed(2) }}</strong>
        </div>
      </div>
      <p class="text-[11px] opacity-75">
        Tip: Prefer recording small adjustments in the next open month rather than reopening a paid settlement.
      </p>
    </div>

    <!-- Append-Only Unlock History & Revision Diff -->
    <details
      v-if="activeLock && ((activeLock.unlockHistory && activeLock.unlockHistory.length > 0) || (activeLock.priorRevisionDiff && activeLock.priorRevisionDiff.length > 0))"
      class="rounded-xl bg-base-100 border border-base-300 px-3.5 py-2 text-xs"
    >
      <summary class="cursor-pointer font-bold text-base-content/75">
        📜 Lock Audit History ({{ activeLock.unlockHistory?.length || 0 }} reopen event{{ (activeLock.unlockHistory?.length || 0) === 1 ? '' : 's' }} · rev {{ activeLock.revision }})
      </summary>
      <div class="pt-2 mt-2 border-t border-base-200 space-y-2 text-[11px]">
        <div
          v-for="(u, idx) in activeLock.unlockHistory || []"
          :key="idx"
          class="font-mono"
        >
          🔓 {{ u.at.slice(0, 16).replace('T', ' ') }} — <strong>{{ u.by.name }}</strong> reopened rev {{ u.revisionUnlocked }}: "{{ u.reason }}" (prev #{{ u.previousHash.slice(0, 8) }})
        </div>
        <div v-if="activeLock.priorRevisionDiff && activeLock.priorRevisionDiff.length > 0" class="pt-1 border-t border-base-200">
          <div class="font-bold mb-1">Revision {{ activeLock.revision }} Payout Deltas:</div>
          <div
            v-for="d in activeLock.priorRevisionDiff"
            :key="d.rowKey"
            class="font-mono flex justify-between max-w-md"
          >
            <span>{{ d.partnerName }}: ${{ d.previousCheck.toFixed(2) }} ➔ ${{ d.newCheck.toFixed(2) }}</span>
            <span :class="d.deltaCheck >= 0 ? 'text-success font-bold' : 'text-error font-bold'">
              {{ d.deltaCheck >= 0 ? '+' : '' }}${{ d.deltaCheck.toFixed(2) }}
            </span>
          </div>
        </div>
      </div>
    </details>

    <!-- SlideOverDrawer: Lock / Unlock Confirmation -->
    <SlideOverDrawer
      v-model="drawerOpen"
      size="md"
      :title="drawerMode === 'lock' ? `Lock ${periodLabel} & Record Payouts` : `Unlock ${periodLabel} Settlement`"
      :subtitle="drawerMode === 'lock' ? 'Freezes monthly payout checks, Gate 4B bonuses & SHA-256 audit hash' : 'Append-only audit trail — written reason required'"
    >
      <div v-if="drawerMode === 'lock'" class="space-y-4 text-xs">
        <!-- Preconditions Checklist -->
        <div class="rounded-2xl border border-base-300 bg-base-200/50 p-3.5 space-y-2">
          <div class="font-black uppercase tracking-wider text-[11px] opacity-70">Server Preconditions Checklist</div>
          <div class="flex items-center justify-between">
            <span>1. Calendar month closed in Pacific time</span>
            <span class="badge badge-xs font-bold" :class="!isMonthInProgress ? 'badge-success' : 'badge-error'">
              {{ !isMonthInProgress ? '✓ Closed' : '✗ Still Open' }}
            </span>
          </div>
          <div class="flex items-center justify-between">
            <span>2. Zero pending Sweat-Equity labor entries</span>
            <span class="badge badge-xs font-bold" :class="pendingLaborCount === 0 ? 'badge-success' : 'badge-error'">
              {{ pendingLaborCount === 0 ? '✓ 0 Pending' : `✗ ${pendingLaborCount} Pending` }}
            </span>
          </div>
          <div v-if="pendingLaborCount > 0" class="pt-1">
            <a :href="`/coop/labor?month=${period}&status=pending`" class="btn btn-xs btn-warning rounded-xl font-bold w-full">
              Review &amp; Approve/Reject {{ pendingLaborCount }} Pending Labor Log(s) First ➔
            </a>
          </div>
        </div>

        <!-- Totals Summary -->
        <div class="rounded-2xl border border-success/30 bg-success/5 p-3.5 space-y-1 font-mono">
          <div class="flex justify-between">
            <span class="font-sans opacity-75">Total Gross Sales:</span>
            <span class="font-bold">${{ liveTotalGross.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="font-sans opacity-75">Gate 4B Bonus Pool:</span>
            <span class="font-bold text-primary">+${{ liveBonusPool.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between text-sm pt-1 border-t border-success/20">
            <span class="font-sans font-black">Total Partner Payout Checks:</span>
            <span class="font-black text-success">${{ liveTotalPayoutChecks.toFixed(2) }}</span>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="form-control">
            <label class="label py-1"><span class="label-text font-bold">Payout Date</span></label>
            <input v-model="payoutDate" type="date" class="input input-bordered input-sm rounded-xl font-mono text-xs" />
          </div>
          <div class="form-control">
            <label class="label py-1"><span class="label-text font-bold">Disbursement Reference (Optional)</span></label>
            <input v-model="payoutNote" type="text" placeholder="e.g. Zelle / Check batch #10" class="input input-bordered input-sm rounded-xl text-xs" />
          </div>
        </div>

        <label class="label cursor-pointer justify-start gap-2.5 rounded-xl border border-base-300 p-3">
          <input v-model="confirmedIssued" type="checkbox" class="checkbox checkbox-sm checkbox-primary" />
          <span class="label-text text-xs font-bold">
            I have verified or issued these monthly payouts and want to freeze {{ periodLabel }}.
          </span>
        </label>

        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn btn-sm h-11 min-h-11 md:h-9 md:min-h-9 btn-ghost rounded-xl" @click="drawerOpen = false">Cancel</button>
          <button
            type="button"
            class="btn btn-sm h-11 min-h-11 md:h-9 md:min-h-9 btn-primary text-primary-content rounded-xl font-black"
            :disabled="isSubmitting || isMonthInProgress || pendingLaborCount > 0 || !confirmedIssued"
            @click="submitLock"
          >
            {{ isSubmitting ? 'Locking Month…' : '🔒 Confirm Lock & Freeze Snapshot' }}
          </button>
        </div>
      </div>

      <div v-else class="space-y-4 text-xs">
        <div class="alert alert-warning rounded-2xl text-xs">
          <span>
            Reopening a locked month allows labor edits and re-locking as revision {{ (activeLock?.revision || 1) + 1 }}. This action is permanently recorded in <code>unlockHistory</code>.
          </span>
        </div>

        <div class="form-control">
          <label class="label py-1"><span class="label-text font-bold">Reason for Reopening (Required) *</span></label>
          <textarea
            v-model="unlockReason"
            rows="3"
            class="textarea textarea-bordered rounded-xl text-xs"
            placeholder="Explain what needs correction before re-locking..."
          ></textarea>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn btn-sm h-11 min-h-11 md:h-9 md:min-h-9 btn-ghost rounded-xl" @click="drawerOpen = false">Cancel</button>
          <button
            type="button"
            class="btn btn-sm h-11 min-h-11 md:h-9 md:min-h-9 btn-warning text-warning-content rounded-xl font-black"
            :disabled="isSubmitting || unlockReason.trim().length < 3"
            @click="submitUnlock"
          >
            {{ isSubmitting ? 'Unlocking…' : '🔓 Confirm Unlock' }}
          </button>
        </div>
      </div>
    </SlideOverDrawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Icon } from '@iconify/vue';
import SlideOverDrawer from '../common/SlideOverDrawer.vue';
import { pacificTodayYmd } from '../../lib/coopGovernance';
import type { CoopMonthLockSnapshot } from '../../types/coop';

const props = defineProps<{
  period: string;
  periodLabel: string;
  location: string;
  isMonthInProgress: boolean;
  pendingLaborCount: number;
  canLockMonth: boolean;
  activeLock: CoopMonthLockSnapshot | null;
  liveTotalGross: number;
  liveBonusPool: number;
  liveTotalPayoutChecks: number;
  isSubmitting?: boolean;
}>();

const emit = defineEmits<{
  (e: 'lock-month', payload: { payoutDate: string; payoutNote: string }): void;
  (e: 'unlock-month', payload: { reason: string }): void;
}>();

const drawerOpen = ref(false);
const drawerMode = ref<'lock' | 'unlock'>('lock');
const payoutDate = ref(pacificTodayYmd());
const payoutNote = ref('');
const confirmedIssued = ref(false);
const unlockReason = ref('');
const showDriftDetails = ref(false);

const statusBadgeLabel = computed(() => {
  if (props.activeLock?.status === 'locked') {
    return `🔒 Locked ${props.activeLock.lockedAt.slice(0, 10)} by ${props.activeLock.lockedBy.name}`;
  }
  if (props.activeLock?.status === 'unlocked') {
    return '🔓 Reopened';
  }
  if (props.isMonthInProgress) {
    return '⏳ Open (Month In Progress)';
  }
  return '🟢 Open (Ready to Lock After Payout)';
});

const statusBadgeClass = computed(() => {
  if (props.activeLock?.status === 'locked') return 'badge-success';
  if (props.activeLock?.status === 'unlocked') return 'badge-warning';
  return 'badge-ghost';
});

const statusContainerClass = computed(() => {
  if (props.activeLock?.status === 'locked') {
    return 'border-success/35 bg-success/5';
  }
  if (props.activeLock?.status === 'unlocked') {
    return 'border-warning/40 bg-warning/5';
  }
  return 'border-base-200 bg-base-100';
});

const driftDeltaChecks = computed(() => {
  if (!props.activeLock || props.activeLock.status !== 'locked') return 0;
  return Number(
    (
      props.liveTotalPayoutChecks -
      Number(props.activeLock.totals?.totalCuratorPayouts || 0)
    ).toFixed(2)
  );
});

const hasLiveDrift = computed(
  () =>
    props.activeLock?.status === 'locked' &&
    Math.abs(driftDeltaChecks.value) >= 0.01
);

function openLockDrawer() {
  payoutDate.value = pacificTodayYmd();
  payoutNote.value = '';
  confirmedIssued.value = false;
  drawerMode.value = 'lock';
  drawerOpen.value = true;
}

function openUnlockDrawer() {
  unlockReason.value = '';
  drawerMode.value = 'unlock';
  drawerOpen.value = true;
}

function submitLock() {
  emit('lock-month', {
    payoutDate: payoutDate.value,
    payoutNote: payoutNote.value.trim(),
  });
  drawerOpen.value = false;
}

function submitUnlock() {
  emit('unlock-month', {
    reason: unlockReason.value.trim(),
  });
  drawerOpen.value = false;
}
</script>
