<template>
  <div class="space-y-6">
    <!-- Canonical Ledger Header (Matches SalesList & CoopExpensesLedger) -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h1 class="text-3xl sm:text-4xl font-black text-base-content tracking-tight flex items-center gap-3">
          <Icon icon="solar:clock-circle-bold-duotone" class="w-8 h-8 sm:w-9 sm:h-9 text-secondary shrink-0" />
          <span>Sweat-Equity &amp; Enabling Labor Ledger</span>
        </h1>
        <p class="text-sm text-base-content/70 mt-1 max-w-3xl">
          Producers (sourcing, booth restocking, pop-ups) and Enablers (Dropcast social reels, photography, shipping — $0 inventory required) earn pro-rata shares of the {{ policyConfig.laborPatronagePct }}% Sweat-Equity Pool ({{ policyConfig.payRatioCapStandard || 4.5 }}:1 Pay Ratio Cap · 1h = 1h).
        </p>
      </div>

      <div class="flex items-center gap-2 flex-wrap w-full md:w-auto">
        <select
          v-model="selectedMonth"
          class="select select-bordered text-xs font-bold h-10 min-h-10 rounded-xl bg-base-100 border-base-300 focus:border-primary pr-8 shadow-2xs"
        >
          <option value="all">All-Time ({{ laborEntries.length }} logs)</option>
          <option v-for="m in availableMonths" :key="m" :value="m">
            {{ m }}
          </option>
        </select>

        <button
          type="button"
          @click="exportCsv"
          class="btn btn-sm sm:btn-md btn-outline btn-primary gap-1.5 shadow-xs font-bold min-h-[40px]"
          :disabled="filteredEntries.length === 0"
        >
          <Icon icon="solar:file-download-bold" class="w-4 h-4 shrink-0" />
          <span>Export CSV</span>
        </button>
      </div>
    </div>

    <!-- Canonical 4-Card Icon-Badge KPI Strip -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <div class="bg-base-100 p-3.5 sm:p-5 rounded-2xl border border-base-200 shadow-sm">
        <div class="flex items-center gap-2.5 sm:gap-3">
          <div class="p-2.5 sm:p-3 bg-secondary/10 text-secondary rounded-xl shrink-0">
            <Icon icon="solar:stopwatch-bold" class="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-[11px] uppercase font-bold opacity-60 truncate">Total Logged</div>
            <div class="text-lg sm:text-2xl font-black font-mono text-base-content truncate">{{ totalFilteredHours.toFixed(1) }} hrs</div>
            <div class="text-[10px] font-semibold opacity-50 truncate">Prod: {{ producerVsEnablerTotals.producer.toFixed(1) }}h · Enab: {{ producerVsEnablerTotals.enabler.toFixed(1) }}h</div>
          </div>
        </div>
      </div>

      <div class="bg-base-100 p-3.5 sm:p-5 rounded-2xl border border-base-200 shadow-sm">
        <div class="flex items-center gap-2.5 sm:gap-3">
          <div class="p-2.5 sm:p-3 bg-primary/10 text-primary rounded-xl shrink-0">
            <Icon icon="solar:users-group-rounded-bold" class="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-[11px] uppercase font-bold opacity-60 truncate">Huckleberry (HUCK-)</div>
            <div class="text-lg sm:text-2xl font-black font-mono text-primary truncate">{{ partnerHours.HUCK.toFixed(1) }}h ({{ huckSharePct }}%)</div>
            <div class="text-[10px] font-semibold opacity-50 truncate">Curator &amp; Ops Hours</div>
          </div>
        </div>
      </div>

      <div class="bg-base-100 p-3.5 sm:p-5 rounded-2xl border border-base-200 shadow-sm">
        <div class="flex items-center gap-2.5 sm:gap-3">
          <div class="p-2.5 sm:p-3 bg-accent/10 text-accent rounded-xl shrink-0">
            <Icon icon="solar:gamepad-bold" class="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-[11px] uppercase font-bold opacity-60 truncate">PDX Game Lib (PDXGL-)</div>
            <div class="text-lg sm:text-2xl font-black font-mono text-accent truncate">{{ partnerHours.PDXGL.toFixed(1) }}h ({{ pdxglSharePct }}%)</div>
            <div class="text-[10px] font-semibold opacity-50 truncate">Curator &amp; Ops Hours</div>
          </div>
        </div>
      </div>

      <div class="bg-base-100 p-3.5 sm:p-5 rounded-2xl border border-base-200 shadow-sm">
        <div class="flex items-center gap-2.5 sm:gap-3">
          <div class="p-2.5 sm:p-3 bg-info/10 text-info rounded-xl shrink-0">
            <Icon icon="solar:camera-add-bold" class="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-[11px] uppercase font-bold opacity-60 truncate">Marketing Enablers (SWEAT-)</div>
            <div class="text-lg sm:text-2xl font-black font-mono text-info truncate">{{ partnerHours.SWEAT.toFixed(1) }}h ({{ sweatSharePct }}%)</div>
            <div class="text-[10px] font-semibold opacity-50 truncate">$0 Inventory · Direct Labor Share</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Individual Worker Sweat-Equity Share Breakdown Strip -->
    <div v-if="memberShares.length > 0" class="card bg-base-100 border border-base-200 shadow-sm rounded-2xl p-4 space-y-2.5">
        <div class="flex items-center justify-between text-xs">
          <span class="font-extrabold uppercase tracking-wider text-base-content/60">
            Individual Worker-Member Sweat-Equity Shares (Feeds Gate 4B Payouts)
          </span>
          <a href="/coop/governance?tab=roster" class="link link-primary font-bold text-[11px]">
            + Add Marketing / Social Worker in Roster ➔
          </a>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div
            v-for="m in memberShares"
            :key="m.member"
            class="p-3 rounded-xl bg-base-200/50 border border-base-300 flex items-center justify-between gap-2 text-xs"
          >
            <div class="min-w-0">
              <div class="font-black text-base-content truncate">{{ m.member }}</div>
              <div class="text-[10px] text-base-content/65 flex items-center gap-1 flex-wrap">
                <span
                  class="badge badge-xs font-mono font-bold"
                  :class="m.partner === 'SWEAT' ? 'badge-secondary' : m.partner === 'PDXGL' ? 'badge-accent' : 'badge-primary'"
                >
                  {{ m.partner }}-
                </span>
                <span>{{ m.roleLabel }}</span>
              </div>
            </div>
            <div class="text-right shrink-0">
              <div class="font-mono font-black text-sm text-secondary">{{ m.hours.toFixed(1) }}h</div>
              <div class="text-[10px] font-mono font-bold text-base-content/70">{{ m.sharePct }}% of pool</div>
            </div>
          </div>
        </div>
    </div>

    <!-- Main 2-Column Grid: Log Form + Ledger Table -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Left: Log Enabling Labor Form -->
      <div class="lg:col-span-4 card bg-base-100 border border-base-300 shadow-sm rounded-3xl p-5 space-y-4 h-fit">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Icon icon="solar:add-circle-bold-duotone" class="w-5 h-5" />
          </div>
          <div>
            <h2 class="font-black text-base text-base-content">Log Co-op Labor Hours</h2>
            <p class="text-[11px] text-base-content/65">
              Booths, Online Shipping, Pop-Ups &amp; Social Reels
            </p>
          </div>
        </div>

        <div class="form-control">
          <label class="label py-1">
            <span class="label-text text-xs font-bold">Worker-Member &amp; Prefix</span>
          </label>
          <select
            v-model="selectedMemberIdx"
            class="select select-bordered select-sm rounded-xl font-bold text-xs w-full"
          >
            <option
              v-for="(m, idx) in eligibleMembers"
              :key="m.name"
              :value="idx"
            >
              {{ m.name }} — [{{ m.partner }}-] ({{ m.role }})
            </option>
          </select>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="form-control">
            <label class="label py-1">
              <span class="label-text text-xs font-bold">Work Date</span>
            </label>
            <input
              v-model="form.date"
              type="date"
              class="input input-bordered input-sm rounded-xl font-mono text-xs w-full"
            />
          </div>

          <div class="form-control">
            <label class="label py-1">
              <span class="label-text text-xs font-bold">Hours Logged</span>
            </label>
            <input
              v-model.number="form.hours"
              type="number"
              min="0.25"
              max="24"
              step="0.25"
              class="input input-bordered input-sm rounded-xl font-mono font-bold text-xs w-full"
            />
          </div>
        </div>

        <div class="form-control">
          <label class="label py-1">
            <span class="label-text text-xs font-bold">Channel &amp; Labor Category</span>
            <span class="label-text-alt text-[10px] font-mono font-bold" :class="classifySurplusLaborRole(form.category) === 'Enabler of Surplus' ? 'text-secondary' : 'text-primary'">
              {{ classifySurplusLaborRole(form.category) }}
            </span>
          </label>
          <select
            v-model="form.category"
            class="select select-bordered select-sm rounded-xl font-bold text-xs w-full"
          >
            <option value="Social & Marketing">📲 Dropcast Reels &amp; Social Marketing (Enabler)</option>
            <option value="Photography & Staging">📸 AI Deep Scan, Photo &amp; Tagging (Enabler)</option>
            <option value="Online Fulfillment & Shipping">📦 Online Order Fulfillment &amp; Shipping (Enabler)</option>
            <option value="Tech & Admin">⚙️ Tech Ops, Sync &amp; Ledger Prep (Enabler)</option>
            <option value="Booth Restock">🏪 Booth Restock &amp; Floor Merchandising (Producer)</option>
            <option value="Pop-Up & Event Staffing">⛺ Pop-Up Market &amp; Event Staffing (Producer)</option>
            <option value="Sourcing">🔍 Collective Sourcing &amp; Lot Splitting (Producer)</option>
          </select>
        </div>

        <div class="form-control">
          <label class="label py-1">
            <span class="label-text text-xs font-bold">Deliverable / Reel / Drop Proof (Optional)</span>
          </label>
          <input
            v-model="form.deliverableRef"
            type="text"
            placeholder="e.g. IG Reel URL, Dropcast #14, Pirate Ship batch, or Pop-Up event"
            class="input input-bordered input-sm rounded-xl text-xs w-full"
          />
        </div>

        <div class="form-control">
          <label class="label py-1">
            <span class="label-text text-xs font-bold">Contribution Notes</span>
          </label>
          <textarea
            v-model="form.notes"
            rows="2"
            placeholder="e.g., Filmed 3 TikTok/IG reels for Friday booth drop, packed 4 eBay orders..."
            class="textarea textarea-bordered textarea-sm rounded-xl text-xs w-full"
          ></textarea>
        </div>

        <button
          type="button"
          @click="handleAddLabor"
          :disabled="isSaving"
          class="btn btn-primary btn-sm h-10 rounded-xl font-black w-full gap-2 shadow-sm"
        >
          <Icon icon="solar:check-circle-bold" class="w-4 h-4" />
          <span>{{ isSaving ? 'Syncing to Cloud...' : 'Commit Labor Hours to Cloud' }}</span>
        </button>
      </div>

      <!-- Right: Cloud Labor Entries Table -->
      <div class="lg:col-span-8 card bg-base-100 border border-base-300 shadow-sm rounded-3xl p-5 space-y-4">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 class="font-black text-base text-base-content">Verified Sweat-Equity Contributions</h2>
            <p class="text-[11px] text-base-content/65">
              Feeds directly into <a href="/coop/settlements" class="link link-primary font-bold">/coop/settlements</a> when distributing Gate 4B Excess Surplus.
            </p>
          </div>
          <a
            href="/coop/settlements"
            class="btn btn-xs btn-ghost border border-base-300 rounded-xl font-bold gap-1"
          >
            <span>View in Settlements</span>
            <Icon icon="solar:arrow-right-linear" class="w-3.5 h-3.5" />
          </a>
        </div>

        <div class="overflow-x-auto border border-base-200 rounded-2xl">
          <table class="table table-sm">
            <thead>
              <tr class="bg-base-200/60 text-xs font-extrabold uppercase text-base-content/70">
                <th>Date</th>
                <th>Worker</th>
                <th>Prefix</th>
                <th>Category &amp; WSDE Role</th>
                <th class="text-right">Hours</th>
                <th>Deliverable &amp; Notes</th>
                <th class="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="entry in filteredEntries"
                :key="entry.id"
                class="hover:bg-base-200/40"
              >
                <td class="font-mono text-xs whitespace-nowrap">{{ entry.date }}</td>
                <td class="font-bold text-xs whitespace-nowrap">{{ entry.member }}</td>
                <td>
                  <span
                    class="badge badge-xs font-mono font-bold"
                    :class="entry.partner === 'SWEAT' ? 'badge-secondary' : entry.partner === 'PDXGL' ? 'badge-accent' : 'badge-primary'"
                  >
                    {{ entry.partner }}-
                  </span>
                </td>
                <td>
                  <div class="flex flex-col gap-0.5">
                    <span class="badge badge-xs badge-ghost font-semibold whitespace-nowrap">
                      {{ entry.category }}
                    </span>
                    <span
                      class="text-[10px] font-mono font-bold"
                      :class="classifySurplusLaborRole(entry.category) === 'Enabler of Surplus' ? 'text-secondary' : 'text-primary'"
                    >
                      {{ classifySurplusLaborRole(entry.category) }}
                    </span>
                  </div>
                </td>
                <td class="text-right font-mono font-black text-xs text-secondary">
                  {{ Number(entry.hours).toFixed(2) }}h
                </td>
                <td class="text-xs text-base-content/80 max-w-xs">
                  <div v-if="entry.deliverableRef" class="font-mono font-bold text-[11px] text-primary truncate">
                    🔗 {{ entry.deliverableRef }}
                  </div>
                  <div class="truncate" :title="entry.notes">{{ entry.notes }}</div>
                </td>
                <td class="text-right">
                  <button
                    type="button"
                    @click="handleDeleteLabor(entry.id)"
                    class="btn btn-ghost btn-xs text-error"
                    title="Remove entry"
                  >
                    <Icon icon="solar:trash-bin-trash-bold" class="w-4 h-4" />
                  </button>
                </td>
              </tr>
              <tr v-if="filteredEntries.length === 0">
                <td colspan="7" class="text-center py-8 text-xs text-base-content/60">
                  No labor hours logged for this period yet. Use the form on the left to log Dropcast reels, booth restocking, online shipping, or pop-up staffing hours.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { addToast } from '../../stores/toast';
import { useAuth } from '../../composables/useAuth';
import {
  loadCoopGovernanceState,
  saveCoopGovernanceState,
  getLaborHoursByPartnerForMonth,
  getLaborHoursByMemberForMonth,
  classifySurplusLaborRole,
  DEFAULT_COOP_POLICY_CONFIG,
  DEFAULT_COOP_LABOR_ENTRIES,
  type CoopLaborEntry,
  type CoopLaborCategory,
  type CoopPolicyConfig,
} from '../../lib/coopGovernance';

const { currentTeam } = useAuth();

const laborEntries = ref<CoopLaborEntry[]>([...DEFAULT_COOP_LABOR_ENTRIES]);
const policyConfig = ref<CoopPolicyConfig>({ ...DEFAULT_COOP_POLICY_CONFIG });
const isCloudSynced = ref(false);
const isSaving = ref(false);
const selectedMonth = ref<string>('all');
const selectedMemberIdx = ref<number>(0);

const form = ref<{
  date: string;
  hours: number;
  category: CoopLaborCategory;
  deliverableRef: string;
  notes: string;
}>({
  date: new Date().toISOString().slice(0, 10),
  hours: 1.5,
  category: 'Social & Marketing',
  deliverableRef: '',
  notes: '',
});

const eligibleMembers = computed(() => {
  return policyConfig.value.members.filter(
    (m) => m.partner === 'HUCK' || m.partner === 'PDXGL' || m.partner === 'SWEAT'
  );
});

const availableMonths = computed(() => {
  const set = new Set<string>();
  for (const e of laborEntries.value) {
    if (e.date && e.date.length >= 7) {
      set.add(e.date.slice(0, 7));
    }
  }
  return Array.from(set).sort().reverse();
});

const filteredEntries = computed(() => {
  if (selectedMonth.value === 'all') return laborEntries.value;
  return laborEntries.value.filter((e) => String(e.date || '').startsWith(selectedMonth.value));
});

const partnerHours = computed(() =>
  getLaborHoursByPartnerForMonth(laborEntries.value, selectedMonth.value)
);

const memberShares = computed(() =>
  getLaborHoursByMemberForMonth(
    laborEntries.value,
    selectedMonth.value,
    policyConfig.value.members
  )
);

const producerVsEnablerTotals = computed(() => {
  let producer = 0;
  let enabler = 0;
  for (const e of filteredEntries.value) {
    const hrs = Number(e.hours) || 0;
    if (classifySurplusLaborRole(e.category) === 'Enabler of Surplus') {
      enabler += hrs;
    } else {
      producer += hrs;
    }
  }
  return { producer, enabler };
});

const totalFilteredHours = computed(
  () =>
    Number(
      (partnerHours.value.HUCK + partnerHours.value.PDXGL + partnerHours.value.SWEAT).toFixed(2)
    )
);

const huckSharePct = computed(() => {
  if (totalFilteredHours.value <= 0) return 0;
  return Math.round((partnerHours.value.HUCK / totalFilteredHours.value) * 100);
});

const pdxglSharePct = computed(() => {
  if (totalFilteredHours.value <= 0) return 0;
  return Math.round((partnerHours.value.PDXGL / totalFilteredHours.value) * 100);
});

const sweatSharePct = computed(() => {
  if (totalFilteredHours.value <= 0) return 0;
  return Math.max(0, 100 - huckSharePct.value - pdxglSharePct.value);
});

const handleAddLabor = async () => {
  const memberObj = eligibleMembers.value[selectedMemberIdx.value] || eligibleMembers.value[0];
  if (!memberObj || form.value.hours <= 0) {
    addToast({ type: 'error', message: 'Please enter valid hours (> 0).' });
    return;
  }

  isSaving.value = true;
  try {
    const partnerPrefix =
      memberObj.partner === 'PDXGL'
        ? 'PDXGL'
        : memberObj.partner === 'SWEAT'
          ? 'SWEAT'
          : 'HUCK';

    const newEntry: CoopLaborEntry = {
      id: `labor-${Date.now()}`,
      date: form.value.date || new Date().toISOString().slice(0, 10),
      member: memberObj.name,
      partner: partnerPrefix,
      category: form.value.category,
      hours: Number(form.value.hours),
      deliverableRef: form.value.deliverableRef.trim() || undefined,
      notes: form.value.notes.trim() || `${form.value.category} contribution`,
    };

    const nextEntries = [newEntry, ...laborEntries.value];
    laborEntries.value = nextEntries;
    const ok = await saveCoopGovernanceState(
      { laborEntries: nextEntries },
      currentTeam.value?.$id || 'huck_collective'
    );
    isCloudSynced.value = ok;
    form.value.notes = '';
    form.value.deliverableRef = '';
    addToast({
      type: 'success',
      message: `Logged ${newEntry.hours}h for ${newEntry.member} (${newEntry.partner}-)`,
    });
  } finally {
    isSaving.value = false;
  }
};

const handleDeleteLabor = async (id: string) => {
  const nextEntries = laborEntries.value.filter((e) => e.id !== id);
  laborEntries.value = nextEntries;
  const ok = await saveCoopGovernanceState(
    { laborEntries: nextEntries },
    currentTeam.value?.$id || 'huck_collective'
  );
  isCloudSynced.value = ok;
  addToast({ type: 'info', message: 'Removed labor log entry.' });
};

const exportCsv = () => {
  if (filteredEntries.value.length === 0) return;
  const header = ['Date', 'Member', 'Partner', 'Category', 'WSDE_Role', 'Hours', 'DeliverableRef', 'Notes'];
  const rows = filteredEntries.value.map((l) => [
    l.date,
    `"${l.member.replace(/"/g, '""')}"`,
    l.partner,
    `"${l.category}"`,
    `"${classifySurplusLaborRole(l.category)}"`,
    l.hours,
    `"${(l.deliverableRef || '').replace(/"/g, '""')}"`,
    `"${l.notes.replace(/"/g, '""')}"`,
  ]);
  const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Coop_Labor_Ledger_${selectedMonth.value}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

onMounted(async () => {
  const { state, syncedFromCloud } = await loadCoopGovernanceState(
    [],
    currentTeam.value?.$id || 'huck_collective'
  );
  isCloudSynced.value = syncedFromCloud;
  if (state.policyConfig) {
    policyConfig.value = state.policyConfig;
  }
  if (Array.isArray(state.laborEntries) && state.laborEntries.length > 0) {
    laborEntries.value = state.laborEntries;
  }
});
</script>
