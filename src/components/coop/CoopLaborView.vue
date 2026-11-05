<template>
  <div class="space-y-6">
    <!-- Header Card -->
    <div class="card bg-base-100 border border-base-300 shadow-sm rounded-3xl p-5 sm:p-6">
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div class="space-y-1.5">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="badge badge-secondary font-bold gap-1 text-xs px-3 py-2.5">
              <Icon icon="solar:clock-circle-bold" class="w-3.5 h-3.5" />
              Gate 4B Enabling Labor Ledger
            </span>
            <span
              class="badge badge-sm font-mono font-bold gap-1 py-2"
              :class="isCloudSynced ? 'badge-success badge-outline' : 'badge-ghost'"
            >
              <Icon
                :icon="isCloudSynced ? 'solar:cloud-check-bold' : 'solar:cloud-upload-bold'"
                class="w-3.5 h-3.5"
              />
              {{ isCloudSynced ? 'Appwrite Cloud Synced' : 'Local Fallback' }}
            </span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-black tracking-tight text-base-content">
            Sweat-Equity &amp; Enabling Labor Ledger
          </h1>
          <p class="text-xs sm:text-sm text-base-content/75 max-w-2xl">
            In Richard Wolff’s WSDE model, enabling work (booth restocking, AI photo enrichment, Dropcast reels, and tech ops) makes booth sales possible. Logged hours determine each partner’s share of the
            <strong class="text-secondary">{{ policyConfig.laborPatronagePct }}% Sweat-Equity Dividend</strong>
            when the 30% Commons Pool exceeds monthly operating costs.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <select
            v-model="selectedMonth"
            class="select select-bordered select-sm rounded-xl font-mono font-bold text-xs"
          >
            <option value="all">All Time ({{ laborEntries.length }} logs)</option>
            <option v-for="m in availableMonths" :key="m" :value="m">
              {{ m }}
            </option>
          </select>

          <button
            type="button"
            @click="exportCsv"
            class="btn btn-sm btn-outline rounded-xl font-bold gap-1.5"
            :disabled="filteredEntries.length === 0"
          >
            <Icon icon="solar:file-download-bold" class="w-4 h-4 text-primary" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <!-- Partner Sweat-Equity Share Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-5 pt-5 border-t border-base-200">
        <div class="rounded-2xl bg-base-200/60 border border-base-300 p-4 flex items-center justify-between">
          <div>
            <div class="text-[11px] font-extrabold uppercase tracking-wider text-base-content/60">
              Total Logged Hours ({{ selectedMonth === 'all' ? 'All-Time' : selectedMonth }})
            </div>
            <div class="text-2xl font-black font-mono text-base-content mt-0.5">
              {{ totalFilteredHours.toFixed(1) }} hrs
            </div>
            <div class="text-[11px] text-base-content/60">
              {{ filteredEntries.length }} verified contributions
            </div>
          </div>
          <div class="w-11 h-11 rounded-2xl bg-secondary/15 text-secondary flex items-center justify-center">
            <Icon icon="solar:stopwatch-bold-duotone" class="w-6 h-6" />
          </div>
        </div>

        <div class="rounded-2xl bg-primary/10 border border-primary/25 p-4 flex items-center justify-between">
          <div>
            <div class="text-[11px] font-extrabold uppercase tracking-wider text-primary">
              Huckleberry Collective (HUCK-)
            </div>
            <div class="text-2xl font-black font-mono text-base-content mt-0.5">
              {{ partnerHours.HUCK.toFixed(1) }} hrs
              <span class="text-sm font-bold text-primary">({{ huckSharePct }}%)</span>
            </div>
            <div class="text-[11px] text-base-content/70">
              Receives {{ huckSharePct }}% of Gate 4B Labor Pool
            </div>
          </div>
          <span class="badge badge-primary font-mono font-bold">HUCK-</span>
        </div>

        <div class="rounded-2xl bg-accent/10 border border-accent/25 p-4 flex items-center justify-between">
          <div>
            <div class="text-[11px] font-extrabold uppercase tracking-wider text-accent">
              PDX Game Library (PDXGL-)
            </div>
            <div class="text-2xl font-black font-mono text-base-content mt-0.5">
              {{ partnerHours.PDXGL.toFixed(1) }} hrs
              <span class="text-sm font-bold text-accent">({{ pdxglSharePct }}%)</span>
            </div>
            <div class="text-[11px] text-base-content/70">
              Receives {{ pdxglSharePct }}% of Gate 4B Labor Pool
            </div>
          </div>
          <span class="badge badge-accent font-mono font-bold">PDXGL-</span>
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
              Saved directly to Appwrite Cloud &amp; Monthly Settlements
            </p>
          </div>
        </div>

        <div class="form-control">
          <label class="label py-1">
            <span class="label-text text-xs font-bold">Member &amp; Partner Prefix</span>
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
              {{ m.name }} — [{{ m.partner }}-]
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
            <span class="label-text text-xs font-bold">Enabling Labor Category</span>
          </label>
          <select
            v-model="form.category"
            class="select select-bordered select-sm rounded-xl font-bold text-xs w-full"
          >
            <option value="Booth Restock">🏪 Booth Restock &amp; Floor Merchandising</option>
            <option value="Photography & Staging">📸 AI Deep Scan, Photo &amp; Tagging</option>
            <option value="Social & Marketing">📲 Dropcast Reels &amp; Social Marketing</option>
            <option value="Tech & Admin">⚙️ Tech Ops, Sync &amp; Ledger Reconciliation</option>
            <option value="Sourcing">📦 Collective Sourcing &amp; Lot Splitting</option>
          </select>
        </div>

        <div class="form-control">
          <label class="label py-1">
            <span class="label-text text-xs font-bold">Contribution Notes</span>
          </label>
          <textarea
            v-model="form.notes"
            rows="2"
            placeholder="e.g., Restocked Booth #0EJ endcap, tagged 14 items with Rollo barcodes..."
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
        <div class="flex items-center justify-between">
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
                <th>Member</th>
                <th>Partner</th>
                <th>Category</th>
                <th class="text-right">Hours</th>
                <th>Notes</th>
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
                    :class="entry.partner === 'PDXGL' ? 'badge-accent' : 'badge-primary'"
                  >
                    {{ entry.partner }}-
                  </span>
                </td>
                <td>
                  <span class="badge badge-xs badge-ghost font-semibold whitespace-nowrap">
                    {{ entry.category }}
                  </span>
                </td>
                <td class="text-right font-mono font-black text-xs text-secondary">
                  {{ Number(entry.hours).toFixed(2) }}h
                </td>
                <td class="text-xs text-base-content/80 max-w-xs truncate" :title="entry.notes">
                  {{ entry.notes }}
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
                  No labor hours logged for this period yet. Use the form on the left to log booth restocking, staging, or tech ops hours.
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
  notes: string;
}>({
  date: new Date().toISOString().slice(0, 10),
  hours: 1.5,
  category: 'Booth Restock',
  notes: '',
});

const eligibleMembers = computed(() => {
  return policyConfig.value.members.filter(
    (m) => m.partner === 'HUCK' || m.partner === 'PDXGL'
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

const totalFilteredHours = computed(
  () => Number((partnerHours.value.HUCK + partnerHours.value.PDXGL).toFixed(2))
);

const huckSharePct = computed(() => {
  if (totalFilteredHours.value <= 0) return 50;
  return Math.round((partnerHours.value.HUCK / totalFilteredHours.value) * 100);
});

const pdxglSharePct = computed(() => {
  if (totalFilteredHours.value <= 0) return 50;
  return 100 - huckSharePct.value;
});

const handleAddLabor = async () => {
  const memberObj = eligibleMembers.value[selectedMemberIdx.value] || eligibleMembers.value[0];
  if (!memberObj || form.value.hours <= 0) {
    addToast({ type: 'error', message: 'Please enter valid hours (> 0).' });
    return;
  }

  isSaving.value = true;
  try {
    const newEntry: CoopLaborEntry = {
      id: `labor-${Date.now()}`,
      date: form.value.date || new Date().toISOString().slice(0, 10),
      member: memberObj.name,
      partner: memberObj.partner === 'PDXGL' ? 'PDXGL' : 'HUCK',
      category: form.value.category,
      hours: Number(form.value.hours),
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
  const header = ['Date', 'Member', 'Partner', 'Category', 'Hours', 'Notes'];
  const rows = filteredEntries.value.map((l) => [
    l.date,
    `"${l.member.replace(/"/g, '""')}"`,
    l.partner,
    `"${l.category}"`,
    l.hours,
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

