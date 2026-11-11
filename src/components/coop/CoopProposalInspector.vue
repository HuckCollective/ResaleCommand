<template>
  <div
    v-if="proposal"
    class="card bg-base-100 border shadow-sm rounded-3xl overflow-hidden transition-all"
    :class="cardBorderClass"
  >
    <!-- ===================================================== -->
    <!-- 1. PROPOSAL HEADER & AUTHOR/STEWARD LOCK CONTROLS     -->
    <!-- ===================================================== -->
    <div class="p-4 sm:p-6 border-b border-base-200/80 bg-base-200/40 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="badge badge-sm font-semibold" :class="categoryBadgeClass">
            {{ proposal.category }}
          </span>
          <span
            class="badge badge-sm font-mono font-bold"
            :class="proposal.proposerPartner === 'PDXGL' ? 'badge-secondary' : 'badge-primary'"
          >
            {{ proposal.proposerPartner }}
          </span>
          <span class="text-xs text-base-content/70 font-medium">
            Proposed by <strong class="text-base-content">{{ proposal.proposer }}</strong>
          </span>
          <span class="text-xs text-base-content/40">•</span>
          <span class="text-xs text-base-content/65 font-mono">
            Closing {{ proposal.deadline }}
          </span>
          <span
            v-if="proposal.lastEditKind === 'amendment'"
            class="badge badge-warning badge-2xs font-bold"
          >
            Amended
          </span>
        </div>

        <!-- Lock / Share / Status Actions -->
        <div class="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            class="btn btn-xs btn-ghost rounded-xl font-bold gap-1"
            title="Copy direct shareable link to this proposal"
            @click="copyShareLink"
          >
            <Icon icon="solar:link-bold" class="w-3.5 h-3.5 text-primary" />
            <span>Share</span>
          </button>

          <button
            v-if="canEdit && isLocked"
            type="button"
            class="btn btn-xs btn-outline border-primary/50 text-primary rounded-xl font-black gap-1"
            title="Author / Steward: Unlock raw Markdown & photo editor"
            @click="unlockToEdit"
          >
            <Icon icon="solar:lock-unlocked-bold" class="w-3.5 h-3.5" />
            <span>Unlock to Edit</span>
          </button>
          <span v-else-if="isLocked" class="badge badge-ghost badge-xs font-semibold gap-1">
            🔒 Formatted MD
          </span>
          <span v-else class="badge badge-primary badge-xs font-black gap-1">
            🔓 Editing Raw MD
          </span>
        </div>
      </div>

      <!-- Title & Enact Row (Locked View) -->
      <div v-if="isLocked" class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pt-0.5">
        <div class="space-y-1.5 min-w-0 flex-1">
          <h3 class="text-lg sm:text-xl font-black text-base-content tracking-tight leading-snug">
            {{ cleanEscapedCurrency(proposal.title) }}
          </h3>
          <div
            v-if="distinctFinancialImpact"
            class="inline-flex items-center gap-1.5 text-xs font-bold text-secondary bg-secondary/10 border border-secondary/20 rounded-xl px-2.5 py-1"
          >
            <Icon icon="solar:wallet-money-bold" class="w-3.5 h-3.5 shrink-0" />
            <span>{{ distinctFinancialImpact }}</span>
          </div>
        </div>

        <div class="shrink-0 flex items-center gap-2 flex-wrap">
          <button
            v-if="canEnact"
            type="button"
            class="btn btn-xs btn-primary rounded-xl font-black gap-1 shadow-xs"
            @click="emit('enact', proposal)"
          >
            <Icon icon="solar:bolt-bold" class="w-3.5 h-3.5" />
            <span>⚡ Enact Passed Proposal</span>
          </button>
          <div class="px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-2xs" :class="statusPillClass">
            <Icon :icon="statusPillIcon" class="w-4 h-4 shrink-0" />
            <span>{{ proposal.status === 'passed' ? 'Enacted by Consensus' : statusLabel }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ===================================================== -->
    <!-- 2A. UNLOCKED AUTHOR / STEWARD RAW MD & AI EDITOR      -->
    <!-- ===================================================== -->
    <div v-if="!isLocked" class="p-4 sm:p-6 space-y-4 bg-base-100">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div class="form-control sm:col-span-2 space-y-1">
          <label class="font-black uppercase tracking-wider opacity-75">Proposal Title *</label>
          <input
            v-model="draft.title"
            type="text"
            class="input input-bordered input-sm rounded-xl font-bold text-sm w-full"
            placeholder="Proposal title"
          />
        </div>

        <div class="form-control space-y-1">
          <label class="font-black uppercase tracking-wider opacity-75">Category</label>
          <select v-model="draft.category" class="select select-bordered select-sm rounded-xl font-bold text-xs w-full">
            <option value="Booth & Physical Footprint">🏪 Booth &amp; Physical Footprint</option>
            <option value="Inventory & Consignment">📦 Inventory &amp; Consignment</option>
            <option value="Hardware & Equipment">🏷️ Hardware &amp; Equipment</option>
            <option value="Software & Tech Commons">⚡ Software &amp; Tech Commons</option>
            <option value="Policy & Membership">📜 Policy &amp; Membership</option>
          </select>
        </div>

        <div class="form-control space-y-1">
          <label class="font-black uppercase tracking-wider opacity-75">Closing Date</label>
          <input
            v-model="draft.deadline"
            type="date"
            class="input input-bordered input-sm rounded-xl font-mono text-xs w-full"
          />
        </div>

        <div class="form-control sm:col-span-2 space-y-1">
          <label class="font-black uppercase tracking-wider opacity-75">Financial / Operational Impact (1-Line Summary)</label>
          <input
            v-model="draft.financialImpact"
            type="text"
            class="input input-bordered input-sm rounded-xl text-xs w-full"
            placeholder="e.g. $0 upfront cash; $3,000/mo rolling gross trigger before cash dividends"
          />
        </div>
      </div>

      <!-- Markdown + Photo Composer with Embedded AI Helper Bar -->
      <MarkdownMediaComposer
        v-model="draft.description"
        :locked="false"
        label="Proposal Specification (Markdown)"
        :rows="9"
        :existing-images="draft.existingImages"
        :new-photos="draft.newPhotos"
        :can-upload-photos="canUploadPhotos"
        :max-photos="8"
        photo-title="Proposal Reference Photos, Booth Diagrams & Mockups"
        @update:existing-images="draft.existingImages = $event"
        @update:new-photos="draft.newPhotos = $event"
      >
        <template #ai-bar>
          <div class="rounded-2xl border border-secondary/30 bg-secondary/5 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div class="text-xs leading-snug">
              <span class="font-black text-secondary">✨ AI Proposal Helper:</span>
              <span class="opacity-80 ml-1">Clean up walls of text into scannable Markdown headings &amp; bullets (preserves 100% of numbers).</span>
            </div>
            <div class="flex items-center gap-1.5 shrink-0 flex-wrap">
              <button
                type="button"
                class="btn btn-xs btn-secondary rounded-xl font-black gap-1"
                :disabled="aiFormatting"
                @click="runAiHelper('format_md')"
              >
                <Icon icon="solar:magic-stick-3-bold" class="w-3.5 h-3.5" />
                <span>{{ aiFormatting ? 'Formatting…' : '🪄 Format as MD' }}</span>
              </button>
              <button
                type="button"
                class="btn btn-xs btn-outline btn-secondary rounded-xl font-bold gap-1"
                :disabled="aiFormatting"
                @click="runAiHelper('draft_proposal')"
              >
                <span>✨ AI Refine / Expand</span>
              </button>
            </div>
          </div>
        </template>
      </MarkdownMediaComposer>

      <!-- Rationale Field -->
      <div class="form-control space-y-1">
        <label class="text-xs font-black uppercase tracking-wider opacity-75">
          Benefit to the Collective (WSDE Rationale — Markdown supported)
        </label>
        <textarea
          v-model="draft.rationale"
          rows="3"
          class="textarea textarea-bordered w-full font-mono text-xs leading-relaxed rounded-xl"
          placeholder="Why this helps our booth velocity, cash reserve runway, or shared 70/30 surplus..."
        ></textarea>
      </div>

      <!-- Vote-Integrity Guard When Votes Already Exist -->
      <div
        v-if="voteCount > 0"
        class="rounded-2xl border border-warning/40 bg-warning/10 p-3.5 space-y-2 text-xs"
      >
        <div class="font-black text-warning-content flex items-center gap-1.5">
          <Icon icon="solar:shield-check-bold" class="w-4 h-4 text-warning shrink-0" />
          <span>Vote-Integrity Guard ({{ voteCount }} vote{{ voteCount === 1 ? '' : 's' }} already recorded)</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label
            class="flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer bg-base-100"
            :class="editKind === 'formatting' ? 'border-primary ring-1 ring-primary' : 'border-base-300'"
          >
            <input v-model="editKind" type="radio" value="formatting" class="radio radio-xs radio-primary mt-0.5" />
            <div>
              <div class="font-black">📝 Formatting / Typo Cleanup</div>
              <div class="text-[11px] opacity-70">Keeps all {{ voteCount }} existing member votes intact.</div>
            </div>
          </label>
          <label
            class="flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer bg-base-100"
            :class="editKind === 'amendment' ? 'border-warning ring-1 ring-warning' : 'border-base-300'"
          >
            <input v-model="editKind" type="radio" value="amendment" class="radio radio-xs radio-warning mt-0.5" />
            <div>
              <div class="font-black">⚖️ Substantive Rule Amendment</div>
              <div class="text-[11px] opacity-70">Resets prior votes &amp; re-opens fresh deliberation.</div>
            </div>
          </label>
        </div>
      </div>

      <!-- Save & Lock / Delete Action Bar -->
      <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-base-200">
        <div>
          <button
            v-if="!confirmDelete"
            type="button"
            class="btn btn-xs btn-ghost text-error rounded-xl font-bold gap-1"
            @click="confirmDelete = true"
          >
            <Icon icon="solar:trash-bin-trash-bold" class="w-3.5 h-3.5" />
            <span>Delete Proposal</span>
          </button>
          <div v-else class="flex items-center gap-1.5">
            <span class="text-xs font-bold text-error">Delete permanently?</span>
            <button type="button" class="btn btn-xs btn-error rounded-lg font-black" @click="emit('delete', proposal.id)">
              Yes, Delete
            </button>
            <button type="button" class="btn btn-xs btn-ghost rounded-lg" @click="confirmDelete = false">
              No
            </button>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button type="button" class="btn btn-sm btn-ghost rounded-xl font-bold" @click="cancelEdit">
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-sm btn-primary rounded-xl font-black gap-1.5 px-4 shadow-sm"
            :disabled="saving || !draft.title.trim() || !draft.description.trim()"
            @click="saveAndLock"
          >
            <Icon icon="solar:lock-keyhole-bold" class="w-4 h-4" />
            <span>{{ saving ? 'Saving & Locking…' : 'Save & Lock MD' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ===================================================== -->
    <!-- 2B. LOCKED FORMATTED READER + 4-SIGNAL VOTING         -->
    <!-- ===================================================== -->
    <div v-else class="p-4 sm:p-6 space-y-5">
      <!-- Formatted Markdown Specification + Attached Photos -->
      <MarkdownMediaComposer
        :model-value="proposal.description"
        :locked="true"
        :existing-images="proposalImageIds"
        :can-upload-photos="false"
      />

      <!-- Formatted Collective Rationale -->
      <div
        v-if="proposal.rationale && proposal.rationale.trim()"
        class="p-4 rounded-2xl bg-base-200/60 border border-base-300 space-y-1.5"
      >
        <div class="text-[11px] font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
          <Icon icon="solar:Scale-bold-duotone" class="w-3.5 h-3.5" />
          <span>Collective WSDE Rationale</span>
        </div>
        <div
          class="prose prose-sm max-w-none text-base-content/85 prose-p:my-1 prose-ul:my-1 prose-li:my-0"
          v-html="renderedRationale"
        ></div>
      </div>

      <!-- Live Surplus Profit-Sharing Policy Binding on prop-surplus-policy -->
      <div
        v-if="proposal.id === 'prop-surplus-policy'"
        class="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
      >
        <div class="space-y-0.5">
          <div class="text-xs font-black text-primary flex items-center gap-1.5">
            <Icon icon="solar:settings-minimalistic-bold-duotone" class="w-4 h-4 shrink-0" />
            <span>Active Waterfall Policy Bound to Settlement Ledger</span>
          </div>
          <p class="text-[11px] text-base-content/65">
            Updates the live Co-op Settlement &amp; Waterfall calculator in Appwrite Cloud across all partners.
          </p>
        </div>
        <div class="join border border-base-300 rounded-xl bg-base-100 p-0.5 shrink-0">
          <button
            type="button"
            class="join-item btn btn-xs font-bold rounded-lg border-0"
            :class="surplusPolicyMode === 'patronage_90_10' ? 'btn-primary text-primary-content' : 'btn-ghost text-base-content/70'"
            @click="emit('update-surplus-mode', 'patronage_90_10')"
          >
            ⚖️ 90/10 Dividend
          </button>
          <button
            type="button"
            class="join-item btn btn-xs font-bold rounded-lg border-0"
            :class="surplusPolicyMode === 'cap_100' ? 'btn-primary text-primary-content' : 'btn-ghost text-base-content/70'"
            @click="emit('update-surplus-mode', 'cap_100')"
          >
            🚀 100% Over Ops
          </button>
          <button
            type="button"
            class="join-item btn btn-xs font-bold rounded-lg border-0"
            :class="surplusPolicyMode === 'reserve_100' ? 'btn-neutral text-neutral-content' : 'btn-ghost text-base-content/70'"
            @click="emit('update-surplus-mode', 'reserve_100')"
          >
            🛡️ 100% Reserve
          </button>
        </div>
      </div>

      <!-- Segmented Visual Consensus Bar -->
      <div class="space-y-2">
        <div class="flex items-center justify-between text-xs">
          <span class="font-bold text-base-content/70">Consensus Meter ({{ voteCount }} Votes Cast)</span>
          <span class="font-mono font-bold text-xs" :class="hasBlock ? 'text-error' : 'text-success'">
            {{ hasBlock ? '⚠️ Veto Active' : `${Math.round(agreePercentage)}% Agreement` }}
          </span>
        </div>

        <div class="w-full h-3 rounded-full bg-base-300 overflow-hidden flex shadow-inner">
          <div class="bg-success transition-all duration-300" :style="{ width: `${signalPercent('agree')}%` }"></div>
          <div class="bg-warning transition-all duration-300" :style="{ width: `${signalPercent('abstain')}%` }"></div>
          <div class="bg-secondary transition-all duration-300" :style="{ width: `${signalPercent('disagree')}%` }"></div>
          <div class="bg-error transition-all duration-300" :style="{ width: `${signalPercent('block')}%` }"></div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
          <div class="flex items-center gap-1.5 p-2 rounded-xl bg-success/10 font-bold text-success">
            <span>🟢 Agree:</span>
            <span class="font-mono text-sm">{{ signalCount('agree') }}</span>
          </div>
          <div class="flex items-center gap-1.5 p-2 rounded-xl bg-warning/10 font-bold text-warning">
            <span>🟡 Abstain:</span>
            <span class="font-mono text-sm">{{ signalCount('abstain') }}</span>
          </div>
          <div class="flex items-center gap-1.5 p-2 rounded-xl bg-secondary/10 font-bold text-secondary">
            <span>🟠 Disagree:</span>
            <span class="font-mono text-sm">{{ signalCount('disagree') }}</span>
          </div>
          <div class="flex items-center gap-1.5 p-2 rounded-xl bg-error/10 font-bold text-error">
            <span>🔴 Block:</span>
            <span class="font-mono text-sm">{{ signalCount('block') }}</span>
          </div>
        </div>
      </div>

      <!-- Blocking Objection Alert -->
      <div v-if="hasBlock" class="p-4 rounded-2xl bg-error/10 border border-error/30 text-xs space-y-1.5">
        <div class="font-black text-error flex items-center gap-1.5 text-sm">
          <Icon icon="solar:shield-warning-bold" class="w-4 h-4 shrink-0" />
          <span>Mandatory Deliberation Required</span>
        </div>
        <p class="text-base-content/80 leading-relaxed">
          A member has cast a principled Block. Under our WSDE charter, the proposer can click <b>Unlock to Edit</b> above to amend the proposal and resolve the objection.
        </p>
      </div>

      <!-- Active User Voting Action Card -->
      <div class="p-4 rounded-2xl bg-base-200/50 border border-base-300 space-y-3">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <span class="text-xs font-black uppercase tracking-wider text-base-content">
              Cast Signal as {{ activeVotingMember }}
            </span>
            <p class="text-[11px] text-base-content/60">
              Current vote:
              <strong v-if="currentUserVote" class="capitalize font-mono">
                {{ currentUserVote.signal }}
              </strong>
              <span v-else class="italic opacity-60">Not voted yet</span>
            </p>
          </div>

          <div class="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              class="btn btn-xs sm:btn-sm font-bold gap-1 rounded-xl transition-all"
              :class="pickedSignal === 'agree' ? 'btn-success text-success-content shadow-xs scale-105' : 'btn-ghost border border-success/30 text-success'"
              @click="pickedSignal = 'agree'"
            >
              <span>🟢</span>
              <span>Agree</span>
            </button>
            <button
              type="button"
              class="btn btn-xs sm:btn-sm font-bold gap-1 rounded-xl transition-all"
              :class="pickedSignal === 'abstain' ? 'btn-warning text-warning-content shadow-xs scale-105' : 'btn-ghost border border-warning/30 text-warning'"
              @click="pickedSignal = 'abstain'"
            >
              <span>🟡</span>
              <span>Abstain</span>
            </button>
            <button
              type="button"
              class="btn btn-xs sm:btn-sm font-bold gap-1 rounded-xl transition-all"
              :class="pickedSignal === 'disagree' ? 'btn-secondary text-secondary-content shadow-xs scale-105' : 'btn-ghost border border-secondary/30 text-secondary'"
              @click="pickedSignal = 'disagree'"
            >
              <span>🟠</span>
              <span>Disagree</span>
            </button>
            <button
              type="button"
              class="btn btn-xs sm:btn-sm font-bold gap-1 rounded-xl transition-all"
              :class="pickedSignal === 'block' ? 'btn-error text-error-content shadow-xs scale-105' : 'btn-ghost border border-error/30 text-error'"
              @click="pickedSignal = 'block'"
            >
              <span>🔴</span>
              <span>Block</span>
            </button>
          </div>
        </div>

        <!-- Comment / Option Choice Input (Available on ALL signals; mandatory on Block) -->
        <div v-if="pickedSignal" class="space-y-1 pt-0.5">
          <label class="text-[11px] font-bold" :class="pickedSignal === 'block' ? 'text-error' : 'opacity-75'">
            {{
              pickedSignal === 'block'
                ? 'Mandatory Rationale for Blocking Objection *'
                : pickedSignal === 'disagree'
                  ? 'Reason for Disagreement / Suggested Tweak'
                  : 'Optional Deliberation Note (e.g. "Agree — Option A" or feedback)'
            }}
          </label>
          <textarea
            v-model="voteComment"
            rows="2"
            class="textarea textarea-bordered textarea-xs w-full rounded-xl text-xs"
            :placeholder="
              pickedSignal === 'block'
                ? 'Explain what violates our charter or endangers solvency so we can amend it...'
                : 'Optional note or option choice recorded on the transparent vote roll...'
            "
          ></textarea>
        </div>

        <div class="flex items-center justify-end gap-2 pt-0.5">
          <button
            type="button"
            :disabled="!pickedSignal"
            class="btn btn-xs sm:btn-sm btn-primary rounded-xl font-black gap-1.5 px-4 shadow-sm"
            @click="handleVoteSubmit"
          >
            <Icon icon="solar:check-circle-bold" class="w-3.5 h-3.5" />
            <span>{{ currentUserVote ? 'Update Signal' : 'Confirm Vote' }}</span>
          </button>
        </div>
      </div>

      <!-- Member Vote Roll -->
      <details :open="voteCount > 0" class="group bg-base-200/30 rounded-2xl border border-base-200 p-3 text-xs">
        <summary class="font-bold cursor-pointer list-none flex items-center justify-between text-base-content/75 hover:text-base-content">
          <span class="flex items-center gap-1.5">
            <Icon icon="solar:users-group-rounded-linear" class="w-4 h-4 text-primary" />
            <span>Member Vote Roll ({{ voteCount }} recorded)</span>
          </span>
          <span class="group-open:rotate-180 transition-transform text-xs">▼</span>
        </summary>
        <div v-if="voteCount > 0" class="divide-y divide-base-200 mt-3 pt-2 space-y-2">
          <div
            v-for="(vote, memberKey) in proposal.votes"
            :key="memberKey"
            class="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-xs"
          >
            <div class="space-y-0.5">
              <div class="flex items-center gap-1.5 font-bold text-base-content">
                <span>{{ vote.memberName }}</span>
                <span class="badge badge-xs font-mono font-bold" :class="vote.partner === 'PDXGL' ? 'badge-secondary' : 'badge-ghost'">
                  {{ vote.partner }}
                </span>
              </div>
              <div v-if="vote.comment" class="text-[11px] text-base-content/75 italic max-w-xl">
                "{{ cleanEscapedCurrency(vote.comment) }}"
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="badge badge-sm font-bold uppercase gap-1" :class="signalBadgeClass(vote.signal)">
                <span>{{ signalEmoji(vote.signal) }}</span>
                <span>{{ vote.signal }}</span>
              </span>
              <span class="text-[10px] text-base-content/45 font-mono">{{ String(vote.votedAt || '').slice(0, 10) }}</span>
            </div>
          </div>
        </div>
        <p v-else class="text-[11px] opacity-60 italic mt-2">No signals cast yet — be the first to deliberate above.</p>
      </details>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Icon } from '@iconify/vue';
import MarkdownMediaComposer from '../common/MarkdownMediaComposer.vue';
import { addToast } from '../../stores/toast';
import { cleanEscapedCurrency, renderSafeMarkdown } from '../../lib/safeMarkdown';
import { uploadCoopMediaFiles, syncProposalMarkdownSnapshot } from '../../lib/coopMedia';
import type { CoopProposal, LoomioSignal, SurplusPolicyMode } from '../../lib/coopGovernance';

const props = defineProps<{
  proposal: CoopProposal;
  activeVotingMember: string;
  memberKey: string;
  minAgreeVotes: number;
  canEdit: boolean;
  canUploadPhotos: boolean;
  surplusPolicyMode: SurplusPolicyMode;
}>();

const emit = defineEmits<{
  (e: 'vote', payload: { proposalId: string; signal: LoomioSignal; comment?: string }): void;
  (e: 'save-edit', payload: { updated: CoopProposal; resetVotes: boolean }): void;
  (e: 'delete', proposalId: string): void;
  (e: 'enact', proposal: CoopProposal): void;
  (e: 'update-surplus-mode', mode: SurplusPolicyMode): void;
}>();

const isLocked = ref(true);
const saving = ref(false);
const aiFormatting = ref(false);
const confirmDelete = ref(false);
const editKind = ref<'formatting' | 'amendment'>('formatting');

const pickedSignal = ref<LoomioSignal | null>(null);
const voteComment = ref('');

const draft = ref<{
  title: string;
  category: CoopProposal['category'];
  deadline: string;
  financialImpact: string;
  description: string;
  rationale: string;
  existingImages: string[];
  newPhotos: any[];
}>({
  title: '',
  category: 'Policy & Membership',
  deadline: '',
  financialImpact: '',
  description: '',
  rationale: '',
  existingImages: [],
  newPhotos: [],
});

const proposalImageIds = computed(() =>
  Array.from(
    new Set(
      [props.proposal.imageId, ...(props.proposal.galleryImageIds || [])].filter((id): id is string =>
        Boolean(id && !id.startsWith('data:'))
      )
    )
  )
);

const distinctFinancialImpact = computed(() => {
  const fi = cleanEscapedCurrency(props.proposal.financialImpact || '').trim();
  const ti = cleanEscapedCurrency(props.proposal.title || '').trim();
  if (!fi || fi.toLowerCase() === ti.toLowerCase()) return '';
  return fi;
});

const renderedRationale = computed(() => renderSafeMarkdown(props.proposal.rationale || ''));

const voteCount = computed(() => Object.keys(props.proposal.votes || {}).length);

function signalCount(sig: LoomioSignal): number {
  return Object.values(props.proposal.votes || {}).filter((v) => v.signal === sig).length;
}

function signalPercent(sig: LoomioSignal): number {
  if (voteCount.value === 0) return 0;
  return (signalCount(sig) / voteCount.value) * 100;
}

const agreePercentage = computed(() => signalPercent('agree'));
const hasBlock = computed(() => signalCount('block') > 0);

const canEnact = computed(
  () =>
    !hasBlock.value &&
    signalCount('agree') >= (props.minAgreeVotes || 2) &&
    props.proposal.status !== 'passed'
);

const currentUserVote = computed(() => props.proposal.votes?.[props.memberKey] || null);

const cardBorderClass = computed(() => {
  if (hasBlock.value) return 'border-error/40 bg-error/5';
  if (signalCount('agree') >= (props.minAgreeVotes || 2)) return 'border-success/30';
  return 'border-base-200';
});

const statusLabel = computed(() => {
  if (hasBlock.value) return 'Deliberation Required (Veto)';
  if (signalCount('agree') >= (props.minAgreeVotes || 2)) return 'Consensus Reached';
  return 'Active Deliberation';
});

const statusPillClass = computed(() => {
  if (hasBlock.value) return 'bg-error text-error-content';
  if (signalCount('agree') >= (props.minAgreeVotes || 2)) return 'bg-success text-success-content';
  return 'bg-warning text-warning-content';
});

const statusPillIcon = computed(() => {
  if (hasBlock.value) return 'solar:shield-warning-bold';
  if (signalCount('agree') >= (props.minAgreeVotes || 2)) return 'solar:check-circle-bold';
  return 'solar:clock-circle-bold';
});

const categoryBadgeClass = computed(() => {
  switch (props.proposal.category) {
    case 'Booth & Physical Footprint':
      return 'badge-secondary text-secondary-content';
    case 'Inventory & Consignment':
      return 'badge-accent text-accent-content';
    case 'Hardware & Equipment':
      return 'badge-info text-info-content';
    case 'Software & Tech Commons':
      return 'badge-primary text-primary-content';
    case 'Policy & Membership':
      return 'badge-neutral text-neutral-content';
    default:
      return 'badge-ghost';
  }
});

function signalBadgeClass(signal: LoomioSignal): string {
  switch (signal) {
    case 'agree':
      return 'badge-success text-success-content';
    case 'abstain':
      return 'badge-warning text-warning-content';
    case 'disagree':
      return 'badge-secondary text-secondary-content';
    case 'block':
      return 'badge-error text-error-content';
    default:
      return 'badge-ghost';
  }
}

function signalEmoji(signal: LoomioSignal): string {
  switch (signal) {
    case 'agree':
      return '🟢';
    case 'abstain':
      return '🟡';
    case 'disagree':
      return '🟠';
    case 'block':
      return '🔴';
  }
}

function syncFromProposal() {
  isLocked.value = true;
  confirmDelete.value = false;
  editKind.value = 'formatting';
  const existingVote = props.proposal.votes?.[props.memberKey];
  pickedSignal.value = existingVote?.signal || null;
  voteComment.value = existingVote?.comment || '';
}

watch(
  () => [props.proposal.id, props.memberKey] as const,
  () => {
    syncFromProposal();
  },
  { immediate: true }
);

function unlockToEdit() {
  if (!props.canEdit) return;
  draft.value = {
    title: cleanEscapedCurrency(props.proposal.title),
    category: props.proposal.category,
    deadline: props.proposal.deadline,
    financialImpact: distinctFinancialImpact.value,
    description: cleanEscapedCurrency(props.proposal.description),
    rationale: cleanEscapedCurrency(props.proposal.rationale),
    existingImages: [...proposalImageIds.value],
    newPhotos: [],
  };
  editKind.value = 'formatting';
  confirmDelete.value = false;
  isLocked.value = false;
}

function cancelEdit() {
  isLocked.value = true;
  confirmDelete.value = false;
}

async function runAiHelper(mode: 'format_md' | 'draft_proposal') {
  aiFormatting.value = true;
  try {
    const res = await fetch('/api/format-coop-proposal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode,
        title: draft.value.title,
        category: draft.value.category,
        financialImpact: draft.value.financialImpact,
        description: draft.value.description,
        rationale: draft.value.rationale,
        roughNotes: `${draft.value.title}\n${draft.value.description}\n${draft.value.rationale}`,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'AI formatting failed');

    if (data.title) draft.value.title = data.title;
    if (data.category) draft.value.category = data.category;
    if (data.financialImpact !== undefined) draft.value.financialImpact = data.financialImpact;
    if (data.description) draft.value.description = data.description;
    if (data.rationale) draft.value.rationale = data.rationale;

    addToast(
      mode === 'format_md'
        ? 'Formatted into clean Markdown headings & bullets! Click Preview MD or Save & Lock.'
        : 'AI Helper refined your proposal draft!',
      'success'
    );
  } catch (err: any) {
    addToast(err?.message || 'AI Helper could not format right now.', 'error');
  } finally {
    aiFormatting.value = false;
  }
}

async function saveAndLock() {
  if (!props.canEdit) return;
  saving.value = true;
  try {
    let uploadedIds: string[] = [];
    if (props.canUploadPhotos && draft.value.newPhotos.length > 0) {
      uploadedIds = await uploadCoopMediaFiles(draft.value.newPhotos, props.proposal.id);
    }
    const mergedGallery = [...draft.value.existingImages, ...uploadedIds];
    const resetVotes = voteCount.value > 0 && editKind.value === 'amendment';

    const updated: CoopProposal = {
      ...props.proposal,
      title: cleanEscapedCurrency(draft.value.title.trim()),
      category: draft.value.category,
      deadline: draft.value.deadline || props.proposal.deadline,
      financialImpact: cleanEscapedCurrency(draft.value.financialImpact.trim()) || undefined,
      description: cleanEscapedCurrency(draft.value.description.trim()),
      rationale: cleanEscapedCurrency(draft.value.rationale.trim()),
      imageId: mergedGallery[0] || undefined,
      galleryImageIds: mergedGallery,
      lastEditKind: editKind.value,
      votes: resetVotes ? {} : { ...props.proposal.votes },
      status: resetVotes ? 'active' : props.proposal.status,
      updatedAt: new Date().toISOString(),
    };

    if (props.canUploadPhotos) {
      const mdFileId = await syncProposalMarkdownSnapshot(updated);
      if (mdFileId) updated.mdFileId = mdFileId;
    }

    emit('save-edit', { updated, resetVotes });
    isLocked.value = true;
  } catch (err: any) {
    addToast(err?.message || 'Failed to save proposal edits.', 'error');
  } finally {
    saving.value = false;
  }
}

function handleVoteSubmit() {
  if (!pickedSignal.value) return;
  const cleanComment = voteComment.value.trim();
  if (pickedSignal.value === 'block' && !cleanComment) {
    addToast('A mandatory explanation is required when casting a Block.', 'error');
    return;
  }
  emit('vote', {
    proposalId: props.proposal.id,
    signal: pickedSignal.value,
    comment: cleanComment || undefined,
  });
}

async function copyShareLink() {
  if (typeof window === 'undefined') return;
  const shareUrl = `${window.location.origin}/coop/governance/${encodeURIComponent(props.proposal.id)}`;
  try {
    await navigator.clipboard.writeText(shareUrl);
    addToast('Copied direct proposal link to clipboard!', 'success');
  } catch {
    addToast(shareUrl, 'info');
  }
}
</script>
