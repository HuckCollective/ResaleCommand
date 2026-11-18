<template>
  <div class="space-y-5">
    <!-- 1. QUICK-START BAR: 12 PRESETS + CUSTOM PROPOSAL TRIGGER -->
    <div class="card bg-base-100 border border-base-300 shadow-sm rounded-3xl p-4 sm:p-5 space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div class="flex items-center gap-2 flex-wrap mb-0.5">
            <span class="badge badge-secondary text-secondary-content badge-xs font-black whitespace-nowrap shrink-0">
              12 Collective Presets
            </span>
            <span class="badge badge-outline badge-xs font-mono font-bold whitespace-nowrap shrink-0">
              1 Point = 1.00h Solidarity
            </span>
          </div>
          <h2 class="font-black text-base sm:text-lg text-base-content">
            Pick a Collective Task or Propose a Custom One
          </h2>
          <p class="text-xs text-base-content/65">
            Preset tasks open right away. Custom tasks run a 48h point vote (≥ 50% member quorum), and completed work needs {{ requiredPeerApprovals === 1 && allowSoleFounderSelf ? 'Founder sign-off' : `${requiredPeerApprovals} peer sign-off${requiredPeerApprovals > 1 ? 's' : ''}` }}.
          </p>
        </div>

        <div class="flex items-center gap-2 flex-wrap shrink-0">
          <button
            v-if="canEditPresets"
            type="button"
            class="btn btn-sm h-11 md:h-9 btn-outline rounded-xl font-bold gap-1.5"
            :disabled="saving"
            @click="emit('open-edit-presets')"
          >
            <Icon icon="solar:tuning-2-bold-duotone" class="w-4 h-4 text-primary shrink-0" />
            <span>✏️ Edit 12 Presets</span>
          </button>
          <button
            type="button"
            class="btn btn-sm h-11 md:h-9 btn-outline btn-primary rounded-xl font-black gap-1.5"
            :disabled="saving || !canLogLabor"
            @click="emit('open-propose-custom')"
          >
            <Icon icon="solar:add-circle-bold" class="w-4 h-4 shrink-0" />
            <span>+ Propose Custom Task</span>
          </button>
        </div>
      </div>

      <!-- Preset Selector + 1-Click Post & Claim -->
      <div class="rounded-2xl bg-base-200/60 border border-base-300 p-3.5 space-y-3">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
          <div class="lg:col-span-6 form-control">
            <label class="label py-0.5">
              <span class="label-text text-xs font-bold">Choose from Active Task Presets ({{ activePresets.length }})</span>
            </label>
            <select
              v-model="selectedPresetId"
              aria-label="Task preset"
              class="select select-bordered select-sm h-11 md:h-9 rounded-xl font-bold text-xs w-full"
            >
              <option v-for="p in activePresets" :key="p.id" :value="p.id">
                {{ FUNCTION_TAG_META[p.functionTag].icon }} {{ p.title }} — {{ p.basePoints.toFixed(2) }} pts ({{ FUNCTION_TAG_META[p.functionTag].shortLabel }})
              </option>
            </select>
          </div>

          <div class="lg:col-span-4 form-control">
            <label class="label py-0.5">
              <span class="label-text text-xs font-bold">Specific Scope Note (Optional)</span>
            </label>
            <input
              v-model="presetScopeNote"
              type="text"
              maxlength="300"
              placeholder="e.g. Friday Memory Den shelf reset"
              class="input input-bordered input-sm h-11 md:h-9 rounded-xl text-xs w-full"
            />
          </div>

          <div class="lg:col-span-2 flex items-center gap-2">
            <button
              type="button"
              class="btn btn-sm h-11 md:h-9 btn-primary text-primary-content rounded-xl font-black w-full gap-1.5"
              :disabled="saving || !canLogLabor || !selectedPreset"
              @click="handlePostPreset(true)"
            >
              <span>🏃 Claim Preset</span>
            </button>
          </div>
        </div>

        <div v-if="selectedPreset" class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-base-content/75">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="badge badge-xs font-bold whitespace-nowrap shrink-0" :class="FUNCTION_TAG_META[selectedPreset.functionTag].badgeClass">
              {{ FUNCTION_TAG_META[selectedPreset.functionTag].label }}
            </span>
            <span class="font-mono font-bold text-secondary">{{ selectedPreset.basePoints.toFixed(2) }} pts (= {{ selectedPreset.basePoints.toFixed(2) }}h)</span>
            <span>· {{ selectedPreset.description }}</span>
          </div>
          <button
            type="button"
            class="btn btn-xs h-11 md:h-7 btn-ghost border border-base-300 rounded-lg font-bold self-start sm:self-auto shrink-0"
            :disabled="saving || !canLogLabor"
            @click="handlePostPreset(false)"
          >
            Post Open for Anyone
          </button>
        </div>
      </div>
    </div>

    <!-- 2. TASK BOARD FILTER CHIPS (<= 6 CHIPS) -->
    <div class="card bg-base-100 border border-base-300 shadow-sm rounded-3xl p-4 sm:p-5 space-y-4">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="flex items-center gap-1.5 flex-wrap">
          <button
            v-for="chip in filterChips"
            :key="chip.id"
            type="button"
            class="btn btn-sm h-11 md:h-8 rounded-xl font-bold gap-1.5"
            :class="activeFilter === chip.id ? 'btn-secondary text-secondary-content' : 'btn-ghost bg-base-200/70'"
            @click="activeFilter = chip.id"
          >
            <span>{{ chip.label }}</span>
            <span class="badge badge-2xs font-mono whitespace-nowrap shrink-0">{{ chip.count }}</span>
          </button>
        </div>

        <span class="text-xs font-mono text-base-content/65">
          Eligible Voters: <strong>{{ eligibleVoterCount }}</strong> · Quorum: <strong>≥ {{ Math.ceil(Math.max(1, eligibleVoterCount) / 2) }}</strong>
        </span>
      </div>

      <!-- Loading Skeletons -->
      <div v-if="loading && tasks.length === 0" class="space-y-3 py-2">
        <div v-for="n in 3" :key="n" class="skeleton h-24 w-full rounded-2xl"></div>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="filteredTasks.length === 0"
        class="rounded-2xl border border-dashed border-base-300 p-8 text-center text-xs text-base-content/65"
      >
        No tasks in this view yet. Claim one of the 12 presets above or propose a custom collective task.
      </div>

      <!-- Task Cards List -->
      <div v-else class="space-y-3">
        <article
          v-for="task in filteredTasks"
          :key="task.id"
          class="rounded-2xl border border-base-300 bg-base-200/35 p-4 space-y-3"
        >
          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div class="space-y-1 min-w-0 flex-1">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span
                  class="badge badge-xs font-bold whitespace-nowrap shrink-0"
                  :class="FUNCTION_TAG_META[task.functionTag]?.badgeClass || 'badge-outline'"
                >
                  {{ FUNCTION_TAG_META[task.functionTag]?.label || task.functionTag }}
                </span>
                <span class="badge badge-xs font-bold whitespace-nowrap shrink-0" :class="taskStatusClass(task)">
                  {{ taskStatusLabel(task) }}
                </span>
                <span class="badge badge-xs badge-neutral text-neutral-content font-mono font-bold whitespace-nowrap shrink-0">
                  {{ task.points.toFixed(2) }} pts ({{ task.points.toFixed(2) }}h)
                </span>
                <span v-if="task.isCustom" class="badge badge-xs badge-ghost font-mono whitespace-nowrap shrink-0">
                  ✨ Custom
                </span>
              </div>

              <h3 class="font-black text-sm sm:text-base text-base-content leading-snug">
                {{ task.title }}
              </h3>
              <p v-if="task.description" class="text-xs text-base-content/75">
                {{ task.description }}
              </p>

              <div class="text-[11px] text-base-content/60 flex items-center gap-2 flex-wrap font-mono">
                <span>Posted by {{ task.createdByName }}</span>
                <span v-if="task.claimedByName">· Claimed by <strong>{{ task.claimedByName }}</strong></span>
                <span v-if="task.completedByName && task.completedDate">
                  · Completed {{ task.completedDate }} by <strong>{{ task.completedByName }}</strong>
                </span>
              </div>

              <!-- Own-Barcode Anti-Double-Dip Warning -->
              <div
                v-if="task.ownBarcodeWarning"
                class="rounded-xl border border-warning/45 bg-warning/15 px-3 py-2 text-xs text-base-content flex items-center gap-2 flex-wrap mt-1"
              >
                <span class="font-black text-warning whitespace-nowrap shrink-0">⚠️ Mentions Worker's Own Barcode Prefix</span>
                <span>
                  Found <strong>{{ (task.ownBarcodeMatchedTokens || []).join(', ') || 'own SKU' }}</strong> — confirm this is shared Collective Commons work (own-item prep earns Gate 3 Curator profit, not Labor Pool hours).
                </span>
              </div>

              <!-- Completion Proof & Notes -->
              <div
                v-if="task.status === 'pending_approval' || task.status === 'completed'"
                class="rounded-xl bg-base-100 border border-base-300 px-3 py-2 text-xs space-y-1 mt-1"
              >
                <div v-if="task.completionNotes" class="text-base-content/85">
                  <strong>Work Summary:</strong> {{ task.completionNotes }}
                </div>
                <div v-if="task.deliverableRef" class="font-mono text-[11px]">
                  <a
                    v-if="isHttpUrl(task.deliverableRef)"
                    :href="task.deliverableRef"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="link link-primary font-bold"
                  >
                    🔗 Open Deliverable Proof ↗
                  </a>
                  <span v-else class="text-primary font-bold">🔗 Proof: {{ task.deliverableRef }}</span>
                </div>
                <div v-if="task.peerApprovals?.length" class="text-[11px] text-base-content/65 font-mono">
                  Signed off ({{ task.peerApprovals.length }}/{{ requiredPeerApprovals }}):
                  {{ task.peerApprovals.map((a) => `${a.name}${a.isFounder ? ' 👑' : ''}`).join(', ') }}
                </div>
              </div>
            </div>

            <!-- Right-Side Contextual Actions -->
            <div class="flex items-center gap-2 flex-wrap shrink-0">
              <!-- Open Task: Claim or Mark Done Directly -->
              <template v-if="task.status === 'open' && canLogLabor">
                <button
                  type="button"
                  class="btn btn-sm h-11 md:h-8 btn-outline btn-primary rounded-xl font-bold"
                  :disabled="saving"
                  @click="emit('claim', task.id)"
                >
                  🏃 Claim
                </button>
                <button
                  type="button"
                  class="btn btn-sm h-11 md:h-8 btn-outline btn-success rounded-xl font-bold"
                  :disabled="saving"
                  @click="emit('open-complete-task', task)"
                >
                  ✅ Submit Done
                </button>
              </template>

              <!-- Claimed Task: Submit Completion or Release -->
              <template v-else-if="task.status === 'claimed' && canLogLabor">
                <button
                  v-if="isClaimedByMe(task) || isFounder"
                  type="button"
                  class="btn btn-sm h-11 md:h-8 btn-outline btn-success rounded-xl font-black"
                  :disabled="saving"
                  @click="emit('open-complete-task', task)"
                >
                  ✅ Submit Proof &amp; Finish
                </button>
                <button
                  v-if="isClaimedByMe(task) || isFounder"
                  type="button"
                  class="btn btn-xs h-11 md:h-8 btn-ghost rounded-xl font-bold"
                  :disabled="saving"
                  @click="emit('unclaim', task.id)"
                >
                  Release
                </button>
              </template>

              <!-- Pending Peer Sign-Off -->
              <template v-else-if="task.status === 'pending_approval' && canLogLabor">
                <button
                  v-if="canSignOffTask(task)"
                  type="button"
                  class="btn btn-sm h-11 md:h-8 btn-outline btn-success rounded-xl font-black"
                  :disabled="saving"
                  @click="emit('approve-completion', task.id)"
                >
                  ✅ Sign Off ({{ (task.peerApprovals?.length || 0) + 1 }}/{{ requiredPeerApprovals }})
                </button>
                <span
                  v-else-if="hasSignedOff(task)"
                  class="badge badge-success badge-outline font-bold whitespace-nowrap shrink-0"
                >
                  ✅ You Signed Off ({{ task.peerApprovals?.length || 0 }}/{{ requiredPeerApprovals }})
                </span>
                <span
                  v-else
                  class="badge badge-ghost font-semibold whitespace-nowrap shrink-0"
                  title="Other Collective members verify completed tasks"
                >
                  ⏳ Awaiting {{ Math.max(1, requiredPeerApprovals - (task.peerApprovals?.length || 0)) }} Peer Sign-Off
                </span>
              </template>

              <!-- Completed Badge -->
              <template v-else-if="task.status === 'completed'">
                <span
                  class="badge font-bold whitespace-nowrap shrink-0"
                  :class="task.linkedLaborApproval === 'approved' ? 'badge-success text-success-content' : 'badge-warning badge-outline'"
                >
                  {{
                    task.linkedLaborApproval === 'approved'
                      ? '🔒 Logged & Approved'
                      : '⏳ Logged — Awaiting Founder Stamp'
                  }}
                </span>
              </template>

              <!-- Archive Option for Creator / Founder on Pre-Completion Tasks -->
              <button
                v-if="canArchiveTask(task)"
                type="button"
                class="btn btn-ghost btn-xs h-11 md:h-8 text-base-content/55 hover:text-error rounded-lg"
                title="Archive task"
                :disabled="saving"
                @click="emit('archive-task', task.id)"
              >
                <Icon icon="solar:trash-bin-minimalistic-linear" class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Custom Task 48h Voting Bar -->
          <div
            v-if="task.status === 'voting_value' && canLogLabor"
            class="rounded-xl bg-info/10 border border-info/30 p-3 space-y-2.5 text-xs"
          >
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <span>
                🗳️ <strong>48h Value Vote:</strong> Proposed <strong>{{ task.proposedPoints.toFixed(2) }} pts</strong> ·
                <strong>{{ task.valueVotes?.length || 0 }} / {{ Math.ceil(Math.max(1, task.snapshotEligibleVoters) / 2) }}</strong> votes needed for ≥ 50% quorum
              </span>
              <span v-if="task.votingClosesAt" class="badge badge-xs badge-info text-info-content font-mono whitespace-nowrap shrink-0">
                Closes {{ formatCloseTime(task.votingClosesAt) }}
              </span>
            </div>

            <div class="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                class="btn btn-xs h-11 md:h-8 btn-outline btn-info rounded-xl font-black"
                :disabled="saving"
                @click="emit('vote-value', { taskId: task.id, points: task.proposedPoints })"
              >
                👍 Agree ({{ task.proposedPoints.toFixed(2) }} pts)
              </button>

              <div class="join">
                <input
                  v-model="votePointInputs[task.id]"
                  type="text"
                  inputmode="decimal"
                  aria-label="Suggest custom task points"
                  :placeholder="`${task.proposedPoints.toFixed(2)} pts`"
                  class="join-item input input-bordered input-xs h-11 md:h-8 w-24 font-mono text-xs"
                />
                <button
                  type="button"
                  class="join-item btn btn-xs h-11 md:h-8 btn-outline rounded-r-xl font-bold"
                  :disabled="saving || !votePointInputs[task.id]"
                  @click="submitCustomVotePoints(task)"
                >
                  Vote Pts
                </button>
              </div>

              <span v-if="myVoteOn(task)" class="text-[11px] font-mono text-base-content/70">
                Your vote: <strong>{{ myVoteOn(task)!.points.toFixed(2) }} pts</strong>
              </span>
            </div>
          </div>

          <!-- Founder Tiebreak / Expired Quorum Bar -->
          <div
            v-if="task.status === 'tiebreak_needed'"
            class="rounded-xl bg-warning/15 border border-warning/40 p-3 space-y-2.5 text-xs"
          >
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <span>
                ⚖️ <strong>{{ task.tiebreakReason === 'split_tie' ? 'Point Vote Split Tie' : '48h Vote Closed Below 50% Quorum' }}:</strong>
                A Founder can set final points or restart a fresh 48h vote.
              </span>
              <span class="badge badge-xs badge-warning text-warning-content font-mono whitespace-nowrap shrink-0">
                {{ task.valueVotes?.length || 0 }}/{{ task.snapshotEligibleVoters }} voted
              </span>
            </div>

            <div v-if="isFounder" class="flex items-center gap-2 flex-wrap">
              <input
                v-model="tiebreakPointInputs[task.id]"
                type="text"
                inputmode="decimal"
                aria-label="Founder tiebreak points"
                :placeholder="`${task.proposedPoints.toFixed(2)}`"
                class="input input-bordered input-xs h-11 md:h-8 w-24 rounded-xl font-mono font-bold text-xs"
              />
              <button
                type="button"
                class="btn btn-xs h-11 md:h-8 btn-outline btn-success rounded-xl font-black"
                :disabled="saving"
                @click="submitTiebreak(task, 'decide')"
              >
                ⚖️ Set Points &amp; Open Task
              </button>
              <button
                type="button"
                class="btn btn-xs h-11 md:h-8 btn-ghost border border-base-300 rounded-xl font-bold"
                :disabled="saving"
                @click="submitTiebreak(task, 'restart')"
              >
                🔄 Restart 48h Vote
              </button>
            </div>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { parsePriceValue } from '../../lib/lot-strategy';
import {
  clampTaskPoints,
  FUNCTION_TAG_META,
  type CoopTaskItem,
  type CoopTaskPreset,
  type CoopTaskValueVote,
} from '../../lib/coopTaskBoard';

const props = defineProps<{
  presets: CoopTaskPreset[];
  tasks: CoopTaskItem[];
  loading: boolean;
  saving: boolean;
  currentUserId: string;
  isFounder: boolean;
  canLogLabor: boolean;
  canEditPresets: boolean;
  eligibleVoterCount: number;
  requiredPeerApprovals: number;
  allowSoleFounderSelf: boolean;
}>();

const emit = defineEmits<{
  (e: 'open-propose-custom'): void;
  (e: 'open-edit-presets'): void;
  (e: 'open-complete-task', task: CoopTaskItem): void;
  (e: 'post-preset', payload: { presetId: string; description?: string; claimImmediately: boolean }): void;
  (e: 'vote-value', payload: { taskId: string; points: number }): void;
  (e: 'founder-tiebreak', payload: { taskId: string; decision: 'decide' | 'restart'; points: number }): void;
  (e: 'claim', taskId: string): void;
  (e: 'unclaim', taskId: string): void;
  (e: 'approve-completion', taskId: string): void;
  (e: 'archive-task', taskId: string): void;
}>();

type BoardFilter = 'active' | 'voting' | 'open_claimed' | 'signoff' | 'tiebreak' | 'completed';

const activeFilter = ref<BoardFilter>('active');
const selectedPresetId = ref('');
const presetScopeNote = ref('');
const votePointInputs = ref<Record<string, string>>({});
const tiebreakPointInputs = ref<Record<string, string>>({});

const activePresets = computed(() => (props.presets || []).filter((p) => p.active));

watch(
  activePresets,
  (list) => {
    if (!list.some((p) => p.id === selectedPresetId.value)) {
      selectedPresetId.value = list[0]?.id || '';
    }
  },
  { immediate: true }
);

const selectedPreset = computed(() =>
  activePresets.value.find((p) => p.id === selectedPresetId.value)
);

const visibleBoardTasks = computed(() =>
  (props.tasks || []).filter((t) => t.status !== 'archived')
);

const filterChips = computed(() => {
  const list = visibleBoardTasks.value;
  return [
    {
      id: 'active' as const,
      label: 'All Active',
      count: list.filter((t) => t.status !== 'completed').length,
    },
    {
      id: 'voting' as const,
      label: '🗳️ Needs Vote',
      count: list.filter((t) => t.status === 'voting_value').length,
    },
    {
      id: 'open_claimed' as const,
      label: '🏃 Open / Claimed',
      count: list.filter((t) => t.status === 'open' || t.status === 'claimed').length,
    },
    {
      id: 'signoff' as const,
      label: '⏳ Needs Sign-Off',
      count: list.filter((t) => t.status === 'pending_approval').length,
    },
    {
      id: 'tiebreak' as const,
      label: '⚖️ Tiebreak',
      count: list.filter((t) => t.status === 'tiebreak_needed').length,
    },
    {
      id: 'completed' as const,
      label: '✅ Completed',
      count: list.filter((t) => t.status === 'completed').length,
    },
  ];
});

const filteredTasks = computed(() => {
  const list = visibleBoardTasks.value;
  switch (activeFilter.value) {
    case 'voting':
      return list.filter((t) => t.status === 'voting_value');
    case 'open_claimed':
      return list.filter((t) => t.status === 'open' || t.status === 'claimed');
    case 'signoff':
      return list.filter((t) => t.status === 'pending_approval');
    case 'tiebreak':
      return list.filter((t) => t.status === 'tiebreak_needed');
    case 'completed':
      return list.filter((t) => t.status === 'completed');
    case 'active':
    default:
      return list.filter((t) => t.status !== 'completed');
  }
});

function handlePostPreset(claimImmediately: boolean) {
  if (!selectedPreset.value) return;
  emit('post-preset', {
    presetId: selectedPreset.value.id,
    description: presetScopeNote.value.trim() || undefined,
    claimImmediately,
  });
  presetScopeNote.value = '';
}

function myVoteOn(task: CoopTaskItem): CoopTaskValueVote | undefined {
  if (!props.currentUserId) return undefined;
  return (task.valueVotes || []).find((v) => v.userId === props.currentUserId);
}

function submitCustomVotePoints(task: CoopTaskItem) {
  const raw = votePointInputs.value[task.id];
  const parsed = parsePriceValue(raw);
  const pts = clampTaskPoints(parsed, task.proposedPoints);
  emit('vote-value', { taskId: task.id, points: pts });
  votePointInputs.value[task.id] = '';
}

function submitTiebreak(task: CoopTaskItem, decision: 'decide' | 'restart') {
  const raw = tiebreakPointInputs.value[task.id];
  const parsed = raw ? parsePriceValue(raw) : task.proposedPoints;
  const pts = clampTaskPoints(parsed, task.proposedPoints);
  emit('founder-tiebreak', { taskId: task.id, decision, points: pts });
}

function isClaimedByMe(task: CoopTaskItem): boolean {
  return Boolean(props.currentUserId && task.claimedByUserId === props.currentUserId);
}

function hasSignedOff(task: CoopTaskItem): boolean {
  if (!props.currentUserId) return false;
  return (task.peerApprovals || []).some((a) => a.userId === props.currentUserId);
}

function canSignOffTask(task: CoopTaskItem): boolean {
  if (!props.currentUserId || hasSignedOff(task)) return false;
  if (task.completedByUserId === props.currentUserId) {
    return props.allowSoleFounderSelf;
  }
  return true;
}

function canArchiveTask(task: CoopTaskItem): boolean {
  if (task.status === 'completed' || task.status === 'pending_approval') return false;
  if (props.isFounder) return true;
  return Boolean(props.currentUserId && task.createdByUserId === props.currentUserId && task.status !== 'claimed');
}

function taskStatusLabel(task: CoopTaskItem): string {
  switch (task.status) {
    case 'voting_value':
      return '🗳️ Value Vote Open';
    case 'tiebreak_needed':
      return '⚖️ Founder Tiebreak';
    case 'open':
      return '🟢 Open';
    case 'claimed':
      return '🏃 Claimed';
    case 'pending_approval':
      return '⏳ Needs Peer Sign-Off';
    case 'completed':
      return '✅ Completed';
    default:
      return task.status;
  }
}

function taskStatusClass(task: CoopTaskItem): string {
  switch (task.status) {
    case 'voting_value':
      return 'badge-info';
    case 'tiebreak_needed':
      return 'badge-warning';
    case 'open':
      return 'badge-success badge-outline';
    case 'claimed':
      return 'badge-primary badge-outline';
    case 'pending_approval':
      return 'badge-warning badge-outline';
    case 'completed':
      return 'badge-success';
    default:
      return 'badge-ghost';
  }
}

function formatCloseTime(iso: string): string {
  const ms = Date.parse(iso) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 'Ended';
  const hrs = Math.ceil(ms / (60 * 60 * 1000));
  return `in ~${hrs}h`;
}

function isHttpUrl(val?: string): boolean {
  return Boolean(val && /^https?:\/\//i.test(val.trim()));
}
</script>
