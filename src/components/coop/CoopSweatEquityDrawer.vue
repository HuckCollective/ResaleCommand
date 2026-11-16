<template>
  <SlideOverDrawer
    v-model="openProxy"
    size="lg"
    title="Sweat-Equity Labor, Cash vs. ICA & Pool Simulator"
    subtitle="Mondragon 10/45/45 solidarity status, Seller-style policy comparison & itemized worker proof logs"
  >
    <div class="space-y-5 text-xs">
      <!-- 1. Mondragon 10/45/45 & 4.5:1 Pay-Ratio Guardrail Header -->
      <div class="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span
              class="badge badge-xs font-black"
              :class="mondragonStatus.isMondragon104545 ? 'badge-primary' : 'badge-outline'"
            >
              {{ mondragonStatus.isMondragon104545 ? '🏛️ Mondragon 10/45/45 Active' : `Active Split: ${draftPolicy.reserveSharePct}/${draftPolicy.salesPatronagePct}/${draftPolicy.laborPatronagePct}` }}
            </span>
            <span
              class="badge badge-xs font-mono font-bold"
              :class="mondragonStatus.isPayRatioCompliant ? 'badge-success' : 'badge-warning'"
            >
              {{
                mondragonStatus.payRatioActual !== null
                  ? `${mondragonStatus.isPayRatioCompliant ? '✅' : '⚠️'} ${mondragonStatus.payRatioActual.toFixed(2)}:1 Ratio (Cap ${mondragonStatus.payRatioCap}:1)`
                  : '⚠️ Ratio Unbounded (0$/h min)'
              }}
            </span>
            <span class="badge badge-secondary badge-outline badge-xs font-mono font-bold">
              Labor Pool Rate: ${{ mondragonStatus.effectiveHourlyDividendRate.toFixed(2) }}/hr
            </span>
          </div>

          <!-- 1-Click Preset Switcher -->
          <div class="join border border-base-300 rounded-xl bg-base-100 p-0.5">
            <button
              type="button"
              class="join-item btn btn-xs h-11 min-h-11 md:h-7 md:min-h-0 rounded-lg font-bold px-2"
              :class="isPreset(10, 60, 30) ? 'btn-primary text-primary-content' : 'btn-ghost'"
              @click="applyPreset(10, 60, 30)"
            >
              10/60/30 WSDE
            </button>
            <button
              type="button"
              class="join-item btn btn-xs h-11 min-h-11 md:h-7 md:min-h-0 rounded-lg font-bold px-2"
              :class="isPreset(10, 45, 45) ? 'btn-primary text-primary-content' : 'btn-ghost'"
              @click="applyPreset(10, 45, 45)"
            >
              10/45/45 Mondragon
            </button>
          </div>
        </div>

        <p class="text-[11px] text-base-content/75 leading-relaxed">
          Under Worker Self-Directed Enterprise &amp; Mondragon cooperative rules, Producers and Enablers of Surplus share <strong>1h = 1h</strong> in the Sweat-Equity Labor Pool. Pay-ratio tracking is advisory and never reduces base cost recoupment.
        </p>

        <div
          v-if="draftPolicy.laborPatronagePct === 0 && !(draftBasis === 'equal' && draftPolicy.sweatSalesPoolMode === 'equal_all')"
          class="alert alert-warning py-2 rounded-xl text-xs"
        >
          <span>
            ⚠️ <strong>0% Labor Pool Warning:</strong> With <code>laborPatronagePct = 0%</code>, $0-inventory <code>SWEAT-</code> enablers earn <strong>$0.00</strong> unless Equal-All Pool mode is active.
          </span>
        </div>

        <div
          v-if="approvalsChangedAfterExportLabel"
          class="alert alert-info py-2 rounded-xl text-xs"
        >
          <span>
            🔄 Approvals changed after {{ approvalsChangedAfterExportLabel }} — re-download PDF statements so paper records match the cloud ledger.
          </span>
        </div>
      </div>

      <!-- Sample Excess Surplus Selector Bar (Seller-Style Live Comparison) -->
      <div class="flex items-center justify-between flex-wrap gap-2 bg-base-200/60 border border-base-300 rounded-2xl px-3.5 py-2.5">
        <span class="font-extrabold uppercase tracking-wider text-base-content/75">
          🔍 Preview Surplus Basis ({{ sampleBasisLabel }}):
        </span>
        <div class="join border border-base-300 rounded-xl bg-base-100 p-0.5">
          <button
            type="button"
            class="join-item btn btn-xs h-11 min-h-11 md:h-7 md:min-h-0 px-2 rounded-lg font-mono"
            :class="sampleSurplus === 0 ? 'btn-neutral text-neutral-content' : 'btn-ghost'"
            @click="sampleSurplus = 0"
          >
            Actual (${{ actualDistributablePool.toFixed(0) }})
          </button>
          <button
            v-for="amt in [100, 250, 500]"
            :key="amt"
            type="button"
            class="join-item btn btn-xs h-11 min-h-11 md:h-7 md:min-h-0 px-2 rounded-lg font-mono"
            :class="sampleSurplus === amt ? 'btn-neutral text-neutral-content' : 'btn-ghost'"
            @click="sampleSurplus = amt"
          >
            Ex: ${{ amt }}
          </button>
        </div>
      </div>

      <!-- 2A. Comparison 1: Monthly Cash Check vs. Mondragon ICA Retained Split -->
      <div class="space-y-2.5">
        <div class="flex items-center justify-between flex-wrap gap-1">
          <span class="font-black text-sm text-base-content">
            1. Monthly Cash Check vs. Mondragon Internal Capital Account (ICA)
          </span>
          <span class="text-[11px] font-mono opacity-70">
            Applies to Gate 4B bonus only (Cost + {{ draftPolicy.curatorSharePct }}% base + reimbursements are always 100% cash)
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <!-- Option A: 100% Cash Monthly -->
          <button
            type="button"
            class="text-left p-3.5 rounded-2xl border-2 transition-all space-y-2 flex flex-col justify-between cursor-pointer"
            :class="draftPolicy.icaRetainedPct === 0 ? 'border-success bg-success/10 shadow-xs' : 'border-base-300 bg-base-100 hover:border-base-content/30'"
            @click="draftPolicy.icaRetainedPct = 0"
          >
            <div class="space-y-1">
              <div class="flex items-center justify-between gap-2">
                <span class="font-black text-xs">💵 100% Cash Monthly (0% ICA)</span>
                <span v-if="draftPolicy.icaRetainedPct === 0" class="badge badge-success badge-xs font-bold">ACTIVE</span>
              </div>
              <p class="text-[11px] text-base-content/70">
                Every dollar of Gate 4B Sales &amp; Sweat-Equity bonus is paid immediately in the monthly payout check.
              </p>
            </div>
            <div class="pt-2 border-t border-base-300/70 font-mono space-y-0.5">
              <div class="flex justify-between">
                <span class="font-sans opacity-70">Paid in Cash Check:</span>
                <span class="font-black text-success">+${{ previewPoolDollars.toFixed(2) }}</span>
              </div>
              <div class="flex justify-between text-[11px] opacity-60">
                <span class="font-sans">Retained ICA Credit:</span>
                <span>$0.00</span>
              </div>
            </div>
          </button>

          <!-- Option B: Mondragon Cash + Retained ICA -->
          <div
            class="text-left p-3.5 rounded-2xl border-2 transition-all space-y-2 flex flex-col justify-between cursor-pointer"
            :class="draftPolicy.icaRetainedPct > 0 ? 'border-primary bg-primary/10 shadow-xs' : 'border-base-300 bg-base-100 hover:border-base-content/30'"
            @click="activateMondragonIcaCard"
          >
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-2">
                <span class="font-black text-xs">🏦 Mondragon Cash + Retained ICA ({{ draftPolicy.icaRetainedPct || 25 }}%)</span>
                <span v-if="draftPolicy.icaRetainedPct > 0" class="badge badge-primary badge-xs font-bold">ACTIVE</span>
              </div>
              <div class="flex items-center gap-1 flex-wrap" @click.stop>
                <span class="text-[10px] font-bold opacity-65">Retain:</span>
                <button
                  v-for="pct in [15, 25, 45, 50]"
                  :key="pct"
                  type="button"
                  class="btn btn-xs h-11 min-h-11 md:h-7 md:min-h-0 rounded-md font-mono"
                  :class="draftPolicy.icaRetainedPct === pct ? 'btn-primary text-primary-content' : 'btn-ghost border border-base-300'"
                  @click="draftPolicy.icaRetainedPct = pct"
                >
                  {{ pct }}%
                </button>
              </div>
              <p class="text-[10px] text-base-content/65 leading-snug">
                This month’s retained credit — <em>not yet recorded in a persistent ICA ledger</em>. Est. {{ draftPolicy.icaAnnualYieldRatePct }}%/yr yield is a projection, not an accrual.
              </p>
            </div>
            <div class="pt-2 border-t border-base-300/70 font-mono space-y-0.5">
              <div class="flex justify-between">
                <span class="font-sans opacity-70">Cash Check Today:</span>
                <span class="font-black text-success">+${{ icaPreviewSplit.cashToday.toFixed(2) }}</span>
              </div>
              <div class="flex justify-between text-primary font-bold">
                <span class="font-sans">Member ICA Credit:</span>
                <span>+${{ icaPreviewSplit.retainedIca.toFixed(2) }} (~+${{ icaPreviewSplit.estAnnualYield.toFixed(2) }}/yr)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 2B. Comparison 2: $0-Inventory Enabler Sales Pool Scope -->
      <div class="space-y-2.5">
        <div class="flex items-center justify-between flex-wrap gap-1">
          <span class="font-black text-sm text-base-content">
            2. $0-Inventory Enabler Pool Eligibility
          </span>
          <span class="text-[11px] font-mono opacity-70">
            Controls whether <code>SWEAT-</code> workers share only in the Labor Pool or Equal Share of Both Pools
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            class="text-left p-3.5 rounded-2xl border-2 transition-all space-y-2 flex flex-col justify-between cursor-pointer"
            :class="draftPolicy.sweatSalesPoolMode === 'labor_only' ? 'border-secondary bg-secondary/10 shadow-xs' : 'border-base-300 bg-base-100 hover:border-base-content/30'"
            @click="draftPolicy.sweatSalesPoolMode = 'labor_only'"
          >
            <div class="space-y-1">
              <div class="flex items-center justify-between gap-2">
                <span class="font-black text-xs">⏱️ Labor Pool Only (WSDE Standard)</span>
                <span v-if="draftPolicy.sweatSalesPoolMode === 'labor_only'" class="badge badge-secondary badge-xs font-bold">ACTIVE</span>
              </div>
              <p class="text-[11px] text-base-content/70">
                Inventory Curators (<code>HUCK-</code>, <code>PDXGL-</code>) split the {{ draftPolicy.salesPatronagePct }}% Sales Pool; all verified workers split the {{ draftPolicy.laborPatronagePct }}% Sweat-Equity Pool 1h = 1h.
              </p>
            </div>
            <div class="pt-2 border-t border-base-300/70 font-mono text-[11px] flex justify-between">
              <span class="font-sans opacity-70">SWEAT- Enabler Total Share:</span>
              <span class="font-black text-secondary">+${{ scopePreviewTotals.laborOnlySweatTotal.toFixed(2) }}</span>
            </div>
          </button>

          <button
            type="button"
            class="text-left p-3.5 rounded-2xl border-2 transition-all space-y-2 flex flex-col justify-between cursor-pointer"
            :class="draftPolicy.sweatSalesPoolMode === 'equal_all' && draftBasis === 'equal' ? 'border-primary bg-primary/10 shadow-xs' : 'border-base-300 bg-base-100 hover:border-base-content/30'"
            @click="selectEqualAllScope"
          >
            <div class="space-y-1">
              <div class="flex items-center justify-between gap-2">
                <span class="font-black text-xs">🤝 Equal Share of Both Pools (Equal Mode)</span>
                <span v-if="draftPolicy.sweatSalesPoolMode === 'equal_all' && draftBasis === 'equal'" class="badge badge-primary badge-xs font-bold">ACTIVE</span>
              </div>
              <p class="text-[11px] text-base-content/70">
                Switches Sales Split Basis to <strong>Equal</strong>: one equal share per active row (each active <code>SWEAT-</code> worker = 1 share; each org row = 1 share), plus 1h = 1h Labor Pool.
              </p>
            </div>
            <div class="pt-2 border-t border-base-300/70 font-mono text-[11px] flex justify-between">
              <span class="font-sans opacity-70">SWEAT- Enabler Total Share:</span>
              <span class="font-black text-primary">+${{ scopePreviewTotals.equalAllSweatTotal.toFixed(2) }}</span>
            </div>
          </button>
        </div>

        <!-- Save / Read-Only Action Bar -->
        <div class="flex items-center justify-between gap-2 pt-1">
          <span v-if="!canSavePolicy" class="text-[11px] text-base-content/60">
            👁️ Simulation preview only — Founder role required to save global policy defaults.
          </span>
          <span v-else-if="isLockedMonth" class="text-[11px] text-warning font-bold">
            🔒 Active month is locked (saving updates policy for open/future months only).
          </span>
          <span v-else class="text-[11px] text-base-content/60">
            Changes sync live to <code>manifests/coop_governance_proposals_v1</code>.
          </span>

          <button
            v-if="canSavePolicy"
            type="button"
            class="btn btn-xs sm:btn-sm h-11 min-h-11 md:h-9 md:min-h-9 btn-primary text-primary-content rounded-xl font-black gap-1.5"
            :disabled="saving"
            @click="handleSavePolicy"
          >
            <Icon icon="solar:cloud-upload-bold" class="w-4 h-4" />
            <span>{{ saving ? 'Saving…' : 'Save Policy to Cloud' }}</span>
          </button>
        </div>
      </div>

      <!-- 3. Individual Worker-Member Sweat-Equity Ledger & Deliverable Proof Links -->
      <div class="space-y-3 pt-3 border-t border-base-200">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h4 class="font-black text-sm text-base-content flex items-center gap-1.5">
              <Icon icon="solar:users-group-rounded-bold-duotone" class="w-4 h-4 text-secondary" />
              <span>Individual Worker-Member Sweat-Equity Ledger ({{ periodLabel }})</span>
            </h4>
            <p class="text-[11px] text-base-content/65">
              Click any proof link to verify reels/drops, or download an official Worker Statement PDF.
            </p>
          </div>
          <div class="flex items-center gap-1.5">
            <button
              v-if="focusedMember"
              type="button"
              class="btn btn-2xs btn-ghost rounded-lg font-bold"
              @click="emit('clear-focus')"
            >
              Show All Workers
            </button>
            <a href="/coop/labor" class="btn btn-xs btn-outline rounded-xl font-bold">
              Open Labor Ledger ➔
            </a>
          </div>
        </div>

        <div v-if="displayedWorkerCards.length === 0" class="rounded-2xl border border-dashed border-base-300 p-6 text-center text-base-content/60">
          No Sweat-Equity labor entries logged for this period yet.
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="w in displayedWorkerCards"
            :key="w.member"
            class="rounded-2xl border border-base-300 bg-base-100 p-3.5 space-y-2.5 shadow-2xs"
          >
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div class="space-y-0.5">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="font-black text-sm text-base-content">{{ w.member }}</span>
                  <span
                    class="badge badge-xs font-mono font-bold"
                    :class="w.partner === 'SWEAT' ? 'badge-secondary' : w.partner === 'PDXGL' ? 'badge-accent' : 'badge-primary'"
                  >
                    {{ w.partner }}-
                  </span>
                  <span class="badge badge-ghost badge-xs font-semibold">{{ w.roleLabel }}</span>
                </div>
                <div class="text-[11px] text-base-content/65 font-mono">
                  Approved: <strong>{{ w.approvedHours.toFixed(2) }}h</strong> ({{ w.sharePct }}% of pool · Prod {{ w.producerHours.toFixed(1) }}h / Enab {{ w.enablerHours.toFixed(1) }}h)
                  <span v-if="w.pendingHours > 0" class="text-warning font-bold ml-1">
                    · ⏳ +{{ w.pendingHours.toFixed(2) }}h pending ($0 until approved)
                  </span>
                </div>
              </div>

              <div class="flex items-center gap-2.5 justify-between sm:justify-end">
                <div class="text-right font-mono">
                  <div class="font-black text-sm text-success">
                    +${{ workerLaborDividend(w).toFixed(2) }}
                  </div>
                  <div class="text-[10px] opacity-60">Labor Pool Share</div>
                </div>
                <button
                  v-if="findSettlementRowForWorker(w)"
                  type="button"
                  class="btn btn-xs btn-primary rounded-xl font-bold gap-1"
                  @click="handleDownloadWorkerPdf(w)"
                >
                  <Icon icon="solar:file-download-bold" class="w-3.5 h-3.5" />
                  <span>Statement PDF</span>
                </button>
              </div>
            </div>

            <!-- Itemized Log Entries + Clickable Deliverable Proof Links -->
            <div class="overflow-x-auto border border-base-200 rounded-xl">
              <table class="table table-xs">
                <thead>
                  <tr class="bg-base-200/60 text-[10px] uppercase font-bold text-base-content/65">
                    <th>Date</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Proof / Notes</th>
                    <th class="text-right">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="lg in w.entries" :key="lg.id">
                    <td class="font-mono whitespace-nowrap">{{ lg.date }}</td>
                    <td class="whitespace-nowrap">{{ lg.category }}</td>
                    <td class="whitespace-nowrap">
                      <span
                        class="badge badge-2xs font-bold"
                        :class="lg.approval === 'approved' ? 'badge-success' : 'badge-warning badge-outline'"
                      >
                        {{ lg.approval === 'approved' ? '✅ Approved' : '⏳ Pending' }}
                      </span>
                      <span v-if="lg.approvedBy" class="text-[10px] opacity-60 ml-1">
                        by {{ lg.approvedBy }}
                      </span>
                    </td>
                    <td class="max-w-xs">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <a
                          v-if="lg.deliverableRef && /^https?:\/\//i.test(lg.deliverableRef)"
                          :href="lg.deliverableRef"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="badge badge-primary badge-outline badge-xs font-mono font-bold hover:bg-primary/15"
                        >
                          🔗 Proof Link ↗
                        </a>
                        <span
                          v-else-if="lg.deliverableRef"
                          class="badge badge-ghost badge-xs font-mono"
                        >
                          🔗 {{ lg.deliverableRef }}
                        </span>
                        <span class="truncate opacity-80">{{ lg.notes }}</span>
                      </div>
                    </td>
                    <td class="text-right font-mono font-bold">{{ Number(lg.hours).toFixed(2) }}h</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </SlideOverDrawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Icon } from '@iconify/vue';
import SlideOverDrawer from '../common/SlideOverDrawer.vue';
import { allocateCents, fromCents, toCents } from '../../lib/coop/settlementEngine';
import type { EnrichedPartnerSettlement } from '../../lib/coop/settlementInputs';
import type {
  CoopPolicyConfig,
  MemberLaborShareSummary,
  SurplusSplitBasis,
} from '../../lib/coopGovernance';
import type { MondragonPayRatioStatus } from '../../types/coop';

const props = defineProps<{
  modelValue: boolean;
  periodKey: string;
  periodLabel: string;
  policyConfig: CoopPolicyConfig;
  surplusSplitBasis: SurplusSplitBasis;
  mondragonStatus: MondragonPayRatioStatus;
  actualDistributablePool: number;
  actualLaborPool: number;
  memberShares: MemberLaborShareSummary[];
  settlementRows: EnrichedPartnerSettlement[];
  canSavePolicy: boolean;
  isLockedMonth?: boolean;
  focusedMember?: string;
  latestApprovedAt?: string;
  lastPdfExportAt?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (
    e: 'save-policy',
    payload: {
      policyConfig: CoopPolicyConfig;
      surplusSplitBasis: SurplusSplitBasis;
    }
  ): void;
  (e: 'download-pdf', row: EnrichedPartnerSettlement): void;
  (e: 'clear-focus'): void;
}>();

const openProxy = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

const draftPolicy = ref<CoopPolicyConfig>({ ...props.policyConfig });
const draftBasis = ref<SurplusSplitBasis>(props.surplusSplitBasis);
const sampleSurplus = ref<number>(0);
const saving = ref(false);

watch(
  () => [props.policyConfig, props.surplusSplitBasis, props.modelValue] as const,
  ([cfg, basis]) => {
    draftPolicy.value = { ...cfg };
    draftBasis.value = basis;
  },
  { immediate: true }
);

const approvalsChangedAfterExportLabel = computed(() => {
  if (!props.latestApprovedAt || !props.lastPdfExportAt) return '';
  if (props.latestApprovedAt > props.lastPdfExportAt) {
    return props.lastPdfExportAt.slice(0, 10);
  }
  return '';
});

function isPreset(r: number, s: number, l: number): boolean {
  return (
    Math.round(draftPolicy.value.reserveSharePct) === r &&
    Math.round(draftPolicy.value.salesPatronagePct) === s &&
    Math.round(draftPolicy.value.laborPatronagePct) === l
  );
}

function applyPreset(r: number, s: number, l: number) {
  draftPolicy.value = {
    ...draftPolicy.value,
    reserveSharePct: r,
    salesPatronagePct: s,
    laborPatronagePct: l,
  };
}

function selectEqualAllScope() {
  draftPolicy.value.sweatSalesPoolMode = 'equal_all';
  draftBasis.value = 'equal';
}

function activateMondragonIcaCard() {
  if (draftPolicy.value.icaRetainedPct === 0) {
    draftPolicy.value.icaRetainedPct = 25;
  }
}

const previewPoolDollars = computed(() =>
  sampleSurplus.value > 0 ? sampleSurplus.value : props.actualDistributablePool
);

const sampleBasisLabel = computed(() =>
  sampleSurplus.value > 0
    ? `$${sampleSurplus.value} Sample Distributable Surplus`
    : `Actual Period Surplus ($${props.actualDistributablePool.toFixed(2)})`
);

const icaPreviewSplit = computed(() => {
  const poolCents = toCents(previewPoolDollars.value);
  const pct = draftPolicy.value.icaRetainedPct > 0 ? draftPolicy.value.icaRetainedPct : 25;
  const retainedCents = Math.round((poolCents * pct) / 100);
  const cashCents = poolCents - retainedCents;
  const estYieldCents = Math.round(
    (retainedCents * Number(draftPolicy.value.icaAnnualYieldRatePct || 7)) / 100
  );
  return {
    cashToday: fromCents(cashCents),
    retainedIca: fromCents(retainedCents),
    estAnnualYield: fromCents(estYieldCents),
  };
});

const scopePreviewTotals = computed(() => {
  const poolCents = toCents(previewPoolDollars.value);
  const sW = Math.max(0, Number(draftPolicy.value.salesPatronagePct) || 0);
  const lW = Math.max(0, Number(draftPolicy.value.laborPatronagePct) || 0);
  const sRate = sW + lW > 0 ? sW / (sW + lW) : 1;
  const salesPoolCents = Math.round(poolCents * sRate);
  const laborPoolCents = poolCents - salesPoolCents;

  const coopRows = props.settlementRows.filter(
    (r) => !r.isConsignor && !r.isCommonsPool
  );
  const laborWeights = coopRows
    .filter((r) => (r.laborHoursLogged || 0) > 0)
    .map((r) => ({ rowKey: r.rowKey, weight: r.laborHoursLogged || 0 }));
  const laborAlloc = allocateCents(laborPoolCents, laborWeights);

  let laborOnlySweatCents = 0;
  for (const r of coopRows) {
    if (r.isSweatEnabler) {
      laborOnlySweatCents += laborAlloc.get(r.rowKey) || 0;
    }
  }

  const equalAllEligible = coopRows.filter(
    (r) => r.itemsSold > 0 || (r.laborHoursLogged || 0) > 0
  );
  const equalSalesAlloc = allocateCents(
    salesPoolCents,
    equalAllEligible.map((r) => ({ rowKey: r.rowKey, weight: 1 }))
  );
  let equalAllSweatCents = laborOnlySweatCents;
  for (const r of coopRows) {
    if (r.isSweatEnabler) {
      equalAllSweatCents += equalSalesAlloc.get(r.rowKey) || 0;
    }
  }

  return {
    laborOnlySweatTotal: fromCents(laborOnlySweatCents),
    equalAllSweatTotal: fromCents(equalAllSweatCents),
  };
});

const displayedWorkerCards = computed(() => {
  if (!props.focusedMember) return props.memberShares;
  const q = props.focusedMember.trim().toLowerCase();
  const filtered = props.memberShares.filter(
    (m) =>
      m.member.trim().toLowerCase() === q ||
      `${m.partner}-`.toLowerCase() === q ||
      m.partner.toLowerCase() === q
  );
  return filtered.length > 0 ? filtered : props.memberShares;
});

function workerLaborDividend(w: MemberLaborShareSummary): number {
  const sW = Math.max(0, Number(draftPolicy.value.salesPatronagePct) || 0);
  const lW = Math.max(0, Number(draftPolicy.value.laborPatronagePct) || 0);
  const laborPool =
    sampleSurplus.value > 0
      ? sW + lW > 0
        ? (sampleSurplus.value * lW) / (sW + lW)
        : 0
      : props.actualLaborPool;
  return Number(((laborPool * w.sharePct) / 100).toFixed(2));
}

function findSettlementRowForWorker(
  w: MemberLaborShareSummary
): EnrichedPartnerSettlement | undefined {
  if (w.partner === 'SWEAT') {
    return props.settlementRows.find(
      (r) =>
        r.isSweatEnabler &&
        r.partnerName.trim().toLowerCase() === w.member.trim().toLowerCase()
    );
  }
  return props.settlementRows.find(
    (r) => r.partnerCode.replace(/[-_]+$/, '').toUpperCase() === w.partner
  );
}

function handleDownloadWorkerPdf(w: MemberLaborShareSummary) {
  const row = findSettlementRowForWorker(w);
  if (row) {
    emit('download-pdf', row);
  }
}

async function handleSavePolicy() {
  if (!props.canSavePolicy) return;
  saving.value = true;
  try {
    emit('save-policy', {
      policyConfig: { ...draftPolicy.value },
      surplusSplitBasis: draftBasis.value,
    });
  } finally {
    saving.value = false;
  }
}
</script>
