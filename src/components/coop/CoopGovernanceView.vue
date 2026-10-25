<template>
  <div class="space-y-6">
    <!-- Header Card -->
    <div class="card bg-base-100 border border-base-200 shadow-sm rounded-3xl p-5 sm:p-7">
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 flex-wrap mb-1.5">
            <span class="badge badge-primary font-black text-xs px-2.5 py-1">
              Loomio Consent Protocol
            </span>
            <span class="badge badge-outline font-mono text-xs">
              1 Member = 1 Vote
            </span>
            <span class="badge badge-neutral font-bold text-xs">
              Zero Backroom Decisions
            </span>
          </div>
          <h2 class="text-2xl sm:text-3xl font-black text-base-content tracking-tight flex items-center gap-2.5">
            <Icon icon="solar:users-group-two-rounded-bold-duotone" class="w-7 h-7 sm:w-8 sm:h-8 text-primary shrink-0" />
            <span>Democratic Governance &amp; Consent Voting</span>
          </h2>
          <p class="text-xs sm:text-sm text-base-content/70 mt-1 max-w-2xl leading-relaxed">
            Every member has equal voting authority. Operational proposals require consent under the Loomio 4-signal protocol. Any member can cast a Block to halt an unsafe action and trigger deliberation.
          </p>
        </div>

        <div class="flex items-center gap-2.5 w-full md:w-auto flex-wrap justify-end">
          <button 
            type="button" 
            @click="exportProposalsCsv"
            class="btn btn-sm btn-outline gap-1.5 rounded-xl font-bold h-10"
            title="Download CSV record of all proposals and member votes"
          >
            <Icon icon="solar:file-download-bold" class="w-4 h-4 shrink-0" />
            <span>Export Record</span>
          </button>

          <button 
            type="button" 
            @click="isNewProposalModalOpen = true"
            class="btn btn-sm btn-primary gap-1.5 rounded-xl font-black shadow-md shadow-primary/20 h-10 px-4"
          >
            <Icon icon="solar:add-circle-bold" class="w-4 h-4 shrink-0" />
            <span>Create Proposal</span>
          </button>
        </div>
      </div>

      <!-- Top KPI Overview -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-base-200">
        <div class="p-4 rounded-2xl bg-base-200/60 border border-base-300 shadow-xs space-y-1">
          <div class="text-[11px] font-bold text-base-content/60 uppercase tracking-wider">Active Deliberations</div>
          <div class="text-xl sm:text-2xl font-black text-base-content font-mono">{{ activeProposalsCount }}</div>
          <div class="text-xs text-base-content/60 font-medium">Open for member voting</div>
        </div>

        <div class="p-4 rounded-2xl bg-success/5 border border-success/30 shadow-xs space-y-1">
          <div class="text-[11px] font-bold text-success uppercase tracking-wider">Consensus Achieved</div>
          <div class="text-xl sm:text-2xl font-black text-success font-mono">{{ consensusProposalsCount }}</div>
          <div class="text-xs text-base-content/60 font-medium">Passed by collective consent</div>
        </div>

        <div class="p-4 rounded-2xl bg-error/5 border border-error/30 shadow-xs space-y-1">
          <div class="text-[11px] font-bold text-error uppercase tracking-wider">Active Blocks / Vetoes</div>
          <div class="text-xl sm:text-2xl font-black text-error font-mono">{{ blockedProposalsCount }}</div>
          <div class="text-xs text-base-content/60 font-medium">{{ blockedProposalsCount === 0 ? 'Zero active objections' : 'Requires collective deliberation' }}</div>
        </div>

        <div class="p-4 rounded-2xl bg-primary/5 border border-primary/30 shadow-xs space-y-1">
          <div class="text-[11px] font-bold text-primary uppercase tracking-wider">Consensus Standard</div>
          <div class="text-xl sm:text-2xl font-black text-primary font-mono">0 Blocks</div>
          <div class="text-xs text-base-content/60 font-medium">Consent over pure majoritarianism</div>
        </div>
      </div>
    </div>

    <!-- Loomio 4-Signal Protocol Explainer Card -->
    <div class="card bg-base-100 border border-base-200 shadow-sm rounded-2xl p-4 sm:p-5">
      <div class="text-xs font-bold text-base-content/70 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
        <Icon icon="solar:info-circle-bold" class="w-4 h-4 text-primary" />
        <span>How 4-Signal Consent Voting Works (Loomio Protocol)</span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div class="p-3 rounded-xl bg-success/10 border border-success/20 space-y-1">
          <div class="font-bold text-success flex items-center gap-1.5">
            <span class="text-sm">🟢</span>
            <span>AGREE</span>
          </div>
          <p class="text-base-content/80 text-[11px] leading-relaxed">
            "I support this proposal and want to proceed." Counts toward positive consensus.
          </p>
        </div>

        <div class="p-3 rounded-xl bg-warning/10 border border-warning/20 space-y-1">
          <div class="font-bold text-warning flex items-center gap-1.5">
            <span class="text-sm">🟡</span>
            <span>ABSTAIN</span>
          </div>
          <p class="text-base-content/80 text-[11px] leading-relaxed">
            "I will go along with the group's decision." Neutral signal; does not block progress.
          </p>
        </div>

        <div class="p-3 rounded-xl bg-secondary/10 border border-secondary/20 space-y-1">
          <div class="font-bold text-secondary flex items-center gap-1.5">
            <span class="text-sm">🟠</span>
            <span>DISAGREE</span>
          </div>
          <p class="text-base-content/80 text-[11px] leading-relaxed">
            "I have reservations or better ideas, but won't block." Logged for discussion.
          </p>
        </div>

        <div class="p-3 rounded-xl bg-error/10 border border-error/20 space-y-1">
          <div class="font-bold text-error flex items-center gap-1.5">
            <span class="text-sm">🔴</span>
            <span>BLOCK (VETO)</span>
          </div>
          <p class="text-base-content/80 text-[11px] leading-relaxed">
            "This violates our charter or endangers the collective." Immediately pauses decision.
          </p>
        </div>
      </div>
    </div>

    <!-- Active Voting Member Persona Selector Bar -->
    <div class="card bg-base-100 border border-base-200 shadow-sm rounded-2xl p-3 sm:p-4">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Icon icon="solar:user-hand-up-bold" class="w-4 h-4" />
          </div>
          <div>
            <div class="text-xs font-bold text-base-content">Casting Votes As:</div>
            <div class="text-[11px] text-base-content/60">Select your active member persona or enter custom name</div>
          </div>
        </div>

        <div class="flex items-center gap-2 w-full sm:w-auto">
          <select v-model="activeVotingMember" class="select select-bordered select-sm rounded-xl font-bold text-xs h-9 min-h-9 flex-1 sm:w-56">
            <option value="Tyler (Core)">Tyler (Core - HUCK)</option>
            <option value="PDX Partner">PDX Partner (PDXGL)</option>
            <option value="Member Jesse">Member Jesse (HUCK)</option>
            <option value="Member Alex">Member Alex (Associate)</option>
            <option value="Guest Curator">Guest Curator (Consignor)</option>
          </select>
          <span class="badge badge-sm badge-success font-bold shrink-0">Eligible Voter</span>
        </div>
      </div>
    </div>

    <!-- Proposals List -->
    <div class="space-y-4">
      <div 
        v-for="proposal in proposals" 
        :key="proposal.id"
        class="card bg-base-100 border shadow-sm rounded-3xl overflow-hidden transition-all"
        :class="getProposalCardBorderClass(proposal)"
      >
        <!-- Proposal Header -->
        <div class="p-5 sm:p-6 border-b border-base-200/80 bg-base-200/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div class="space-y-1.5 max-w-2xl">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="badge badge-sm font-semibold" :class="getCategoryBadgeClass(proposal.category)">
                {{ proposal.category }}
              </span>
              <span class="badge badge-sm font-mono font-bold" :class="proposal.proposerPartner === 'PDXGL' ? 'badge-secondary' : 'badge-primary'">
                {{ proposal.proposerPartner }}
              </span>
              <span class="text-xs text-base-content/60 font-medium">
                Proposed by <strong class="text-base-content">{{ proposal.proposer }}</strong>
              </span>
              <span class="text-xs text-base-content/40">•</span>
              <span class="text-xs text-base-content/60 font-mono">
                Closing: {{ proposal.deadline }}
              </span>
            </div>

            <h3 class="text-lg sm:text-xl font-black text-base-content tracking-tight">
              {{ proposal.title }}
            </h3>

            <div v-if="proposal.financialImpact" class="flex items-center gap-1.5 text-xs font-semibold text-secondary">
              <Icon icon="solar:wallet-money-bold" class="w-3.5 h-3.5 shrink-0" />
              <span>Financial Impact: {{ proposal.financialImpact }}</span>
            </div>
          </div>

          <!-- Status Indicator Pill -->
          <div class="shrink-0">
            <div 
              class="px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-xs"
              :class="getStatusPillClass(proposal)"
            >
              <Icon :icon="getStatusPillIcon(proposal)" class="w-4 h-4 shrink-0" />
              <span>{{ getProposalStatusLabel(proposal) }}</span>
            </div>
          </div>
        </div>

        <!-- Proposal Body & Consensus Breakdown -->
        <div class="p-5 sm:p-6 space-y-5">
          <!-- Description & Rationale -->
          <div class="space-y-2 text-xs sm:text-sm text-base-content/85 leading-relaxed">
            <p>{{ proposal.description }}</p>
            <div class="p-3.5 rounded-2xl bg-base-200/60 border border-base-300 text-xs space-y-1">
              <span class="font-bold text-base-content">Collective Rationale: </span>
              <span class="text-base-content/75">{{ proposal.rationale }}</span>
            </div>
          </div>

          <!-- Segmented Visual Consensus Bar -->
          <div class="space-y-2">
            <div class="flex items-center justify-between text-xs">
              <span class="font-bold text-base-content/70">Consensus Meter ({{ getVoteCount(proposal) }} Votes Cast)</span>
              <span class="font-mono font-bold text-xs" :class="hasBlock(proposal) ? 'text-error' : 'text-success'">
                {{ hasBlock(proposal) ? '⚠️ Veto Active' : `${Math.round(getAgreePercentage(proposal))}% Agreement` }}
              </span>
            </div>

            <!-- Stacked bar -->
            <div class="w-full h-3 rounded-full bg-base-300 overflow-hidden flex shadow-inner">
              <div 
                class="bg-success transition-all duration-300" 
                :style="{ width: `${getSignalPercent(proposal, 'agree')}%` }" 
                :title="`Agree: ${getSignalCount(proposal, 'agree')}`"
              ></div>
              <div 
                class="bg-warning transition-all duration-300" 
                :style="{ width: `${getSignalPercent(proposal, 'abstain')}%` }" 
                :title="`Abstain: ${getSignalCount(proposal, 'abstain')}`"
              ></div>
              <div 
                class="bg-secondary transition-all duration-300" 
                :style="{ width: `${getSignalPercent(proposal, 'disagree')}%` }" 
                :title="`Disagree: ${getSignalCount(proposal, 'disagree')}`"
              ></div>
              <div 
                class="bg-error transition-all duration-300" 
                :style="{ width: `${getSignalPercent(proposal, 'block')}%` }" 
                :title="`Block: ${getSignalCount(proposal, 'block')}`"
              ></div>
            </div>

            <!-- Vote Counts Breakdown -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
              <div class="flex items-center gap-1.5 p-2 rounded-xl bg-success/10 font-bold text-success">
                <span>🟢 Agree:</span>
                <span class="font-mono text-sm">{{ getSignalCount(proposal, 'agree') }}</span>
              </div>
              <div class="flex items-center gap-1.5 p-2 rounded-xl bg-warning/10 font-bold text-warning">
                <span>🟡 Abstain:</span>
                <span class="font-mono text-sm">{{ getSignalCount(proposal, 'abstain') }}</span>
              </div>
              <div class="flex items-center gap-1.5 p-2 rounded-xl bg-secondary/10 font-bold text-secondary">
                <span>🟠 Disagree:</span>
                <span class="font-mono text-sm">{{ getSignalCount(proposal, 'disagree') }}</span>
              </div>
              <div class="flex items-center gap-1.5 p-2 rounded-xl bg-error/10 font-bold text-error">
                <span>🔴 Block:</span>
                <span class="font-mono text-sm">{{ getSignalCount(proposal, 'block') }}</span>
              </div>
            </div>
          </div>

          <!-- Blocking Objection Alert (If Any) -->
          <div v-if="hasBlock(proposal)" class="p-4 rounded-2xl bg-error/10 border border-error/30 text-xs space-y-2">
            <div class="font-black text-error flex items-center gap-1.5 text-sm">
              <Icon icon="solar:shield-warning-bold" class="w-4 h-4 shrink-0" />
              <span>Mandatory Deliberation Required</span>
            </div>
            <p class="text-base-content/80 leading-relaxed">
              A member has exercised their constitutional right to cast a Block. In a Worker Self-Directed Enterprise, blocking objections must be deliberated collaboratively to amend the proposal or withdraw it.
            </p>
          </div>

          <!-- Active User Voting Action Card -->
          <div class="p-4 rounded-2xl bg-base-200/50 border border-base-300 space-y-3">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <span class="text-xs font-black uppercase tracking-wider text-base-content">
                  Cast Your Vote as {{ activeVotingMember }}
                </span>
                <p class="text-[11px] text-base-content/60">
                  Current vote: 
                  <strong v-if="getUserVote(proposal)" class="capitalize font-mono">
                    {{ getUserVote(proposal)?.signal }}
                  </strong>
                  <span v-else class="italic opacity-60">Not voted yet</span>
                </p>
              </div>

              <div class="flex items-center gap-1.5 flex-wrap">
                <button 
                  type="button"
                  @click="selectSignal(proposal, 'agree')"
                  class="btn btn-xs sm:btn-sm font-bold gap-1 rounded-xl transition-all"
                  :class="selectedSignal[proposal.id] === 'agree' ? 'btn-success text-success-content shadow-xs scale-105' : 'btn-ghost border border-success/30 text-success'"
                >
                  <span>🟢</span>
                  <span>Agree</span>
                </button>

                <button 
                  type="button"
                  @click="selectSignal(proposal, 'abstain')"
                  class="btn btn-xs sm:btn-sm font-bold gap-1 rounded-xl transition-all"
                  :class="selectedSignal[proposal.id] === 'abstain' ? 'btn-warning text-warning-content shadow-xs scale-105' : 'btn-ghost border border-warning/30 text-warning'"
                >
                  <span>🟡</span>
                  <span>Abstain</span>
                </button>

                <button 
                  type="button"
                  @click="selectSignal(proposal, 'disagree')"
                  class="btn btn-xs sm:btn-sm font-bold gap-1 rounded-xl transition-all"
                  :class="selectedSignal[proposal.id] === 'disagree' ? 'btn-secondary text-secondary-content shadow-xs scale-105' : 'btn-ghost border border-secondary/30 text-secondary'"
                >
                  <span>🟠</span>
                  <span>Disagree</span>
                </button>

                <button 
                  type="button"
                  @click="selectSignal(proposal, 'block')"
                  class="btn btn-xs sm:btn-sm font-bold gap-1 rounded-xl transition-all"
                  :class="selectedSignal[proposal.id] === 'block' ? 'btn-error text-error-content shadow-xs scale-105' : 'btn-ghost border border-error/30 text-error'"
                >
                  <span>🔴</span>
                  <span>Block</span>
                </button>
              </div>
            </div>

            <!-- Mandatory Rationale input if Disagree or Block is selected -->
            <div v-if="selectedSignal[proposal.id] === 'disagree' || selectedSignal[proposal.id] === 'block'" class="space-y-1.5 pt-1">
              <label class="label py-0">
                <span class="label-text font-bold text-xs text-error">
                  {{ selectedSignal[proposal.id] === 'block' ? 'Mandatory Rationale for Blocking Objection *' : 'Reason for Disagreement (Recommended)' }}
                </span>
              </label>
              <textarea 
                v-model="votingRationale[proposal.id]" 
                placeholder="Explain the reason for your objection so the collective can address it..." 
                class="textarea textarea-bordered textarea-xs w-full rounded-xl text-xs"
                rows="2"
              ></textarea>
            </div>

            <!-- Submit / Update Vote Button -->
            <div class="flex items-center justify-end gap-2 pt-1">
              <button 
                type="button"
                @click="submitVote(proposal)"
                :disabled="!selectedSignal[proposal.id]"
                class="btn btn-xs sm:btn-sm btn-primary rounded-xl font-black gap-1.5 px-4 shadow-sm"
              >
                <Icon icon="solar:check-circle-bold" class="w-3.5 h-3.5" />
                <span>{{ getUserVote(proposal) ? 'Update Your Signal' : 'Confirm Vote' }}</span>
              </button>
            </div>
          </div>

          <!-- Expandable Member Vote Roll & Deliberation Comments -->
          <div class="pt-1">
            <details class="group bg-base-200/30 rounded-2xl border border-base-200 p-3 text-xs">
              <summary class="font-bold cursor-pointer list-none flex items-center justify-between text-base-content/75 hover:text-base-content">
                <span class="flex items-center gap-1.5">
                  <Icon icon="solar:users-group-rounded-linear" class="w-4 h-4 text-primary" />
                  <span>View Member Vote Roll ({{ Object.keys(proposal.votes).length }} recorded)</span>
                </span>
                <span class="group-open:rotate-180 transition-transform text-xs">▼</span>
              </summary>
              <div class="divide-y divide-base-200 mt-3 pt-2 space-y-2">
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
                    <div v-if="vote.comment" class="text-[11px] text-base-content/70 italic max-w-lg">
                      "{{ vote.comment }}"
                    </div>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <span class="badge badge-sm font-bold uppercase gap-1" :class="getSignalBadgeClass(vote.signal)">
                      <span>{{ getSignalEmoji(vote.signal) }}</span>
                      <span>{{ vote.signal }}</span>
                    </span>
                    <span class="text-[10px] text-base-content/40 font-mono">{{ formatDate(vote.votedAt) }}</span>
                  </div>
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>

    <!-- CREATE PROPOSAL MODAL -->
    <dialog :class="{ 'modal modal-open': isNewProposalModalOpen }" class="modal">
      <div class="modal-box max-w-lg rounded-3xl p-6 sm:p-7 space-y-5">
        <div class="flex items-center justify-between border-b border-base-200 pb-3">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Icon icon="solar:document-add-bold-duotone" class="w-5 h-5" />
            </div>
            <h3 class="font-black text-lg text-base-content">Create Collective Proposal</h3>
          </div>
          <button type="button" @click="isNewProposalModalOpen = false" class="btn btn-ghost btn-sm btn-circle">✕</button>
        </div>

        <form @submit.prevent="createProposal" class="space-y-4 text-xs">
          <!-- Proposer & Partner -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="form-control">
              <label class="label py-1"><span class="label-text font-bold">Proposer Name *</span></label>
              <input 
                type="text" 
                v-model="newProposal.proposer" 
                placeholder="e.g. Tyler or Jesse" 
                class="input input-bordered input-sm rounded-xl font-medium" 
                required 
              />
            </div>
            <div class="form-control">
              <label class="label py-1"><span class="label-text font-bold">Partner Prefix</span></label>
              <select v-model="newProposal.proposerPartner" class="select select-bordered select-sm rounded-xl font-bold font-mono">
                <option value="HUCK">HUCK (Huckleberry Collective)</option>
                <option value="PDXGL">PDXGL (PDX Game Library)</option>
                <option value="SHARED">SHARED (All Commons)</option>
              </select>
            </div>
          </div>

          <!-- Proposal Category -->
          <div class="form-control">
            <label class="label py-1"><span class="label-text font-bold">Category *</span></label>
            <select v-model="newProposal.category" class="select select-bordered select-sm rounded-xl font-bold" required>
              <option value="Booth & Physical Footprint">🏪 Booth &amp; Physical Footprint (Memory Den 0EJ)</option>
              <option value="Inventory & Consignment">📦 Inventory &amp; Consignment Sourcing</option>
              <option value="Hardware & Equipment">🏷️ Hardware &amp; Operational Equipment</option>
              <option value="Software & Tech Commons">⚡ Software &amp; Tech Commons</option>
              <option value="Policy & Membership">📜 Policy, Membership &amp; Rules</option>
            </select>
          </div>

          <!-- Title -->
          <div class="form-control">
            <label class="label py-1"><span class="label-text font-bold">Proposal Title *</span></label>
            <input 
              type="text" 
              v-model="newProposal.title" 
              placeholder="e.g. Expand Memory Den Booth 0EJ Second Shelf Tier" 
              class="input input-bordered input-sm rounded-xl font-bold text-sm" 
              required 
            />
          </div>

          <!-- Financial Impact & Closing Date -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="form-control">
              <label class="label py-1"><span class="label-text font-bold">Financial Impact</span></label>
              <input 
                type="text" 
                v-model="newProposal.financialImpact" 
                placeholder="e.g. $45 from Commons Pool or $0" 
                class="input input-bordered input-sm rounded-xl text-xs" 
              />
            </div>
            <div class="form-control">
              <label class="label py-1"><span class="label-text font-bold">Deliberation Closing *</span></label>
              <input 
                type="date" 
                v-model="newProposal.deadline" 
                class="input input-bordered input-sm rounded-xl font-mono text-xs" 
                required 
              />
            </div>
          </div>

          <!-- Description -->
          <div class="form-control">
            <label class="label py-1"><span class="label-text font-bold">Proposal Description &amp; Concrete Action *</span></label>
            <textarea 
              v-model="newProposal.description" 
              placeholder="What specifically are we doing, buying, or changing?" 
              class="textarea textarea-bordered rounded-xl text-xs h-20" 
              required
            ></textarea>
          </div>

          <!-- Rationale -->
          <div class="form-control">
            <label class="label py-1"><span class="label-text font-bold">Benefit to the Collective (Rationale) *</span></label>
            <textarea 
              v-model="newProposal.rationale" 
              placeholder="Why is this good for the members, the booth, or our shared prosperity?" 
              class="textarea textarea-bordered rounded-xl text-xs h-16" 
              required
            ></textarea>
          </div>

          <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-base-200">
            <button type="button" @click="isNewProposalModalOpen = false" class="btn btn-sm btn-ghost rounded-xl">Cancel</button>
            <button 
              type="submit" 
              class="btn btn-sm btn-primary rounded-xl font-black px-5"
            >
              Publish for Voting
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="isNewProposalModalOpen = false">close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { addToast } from '../../stores/toast';
import { useAuth } from '../../composables/useAuth';

export type LoomioSignal = 'agree' | 'abstain' | 'disagree' | 'block';

export interface ProposalVote {
  signal: LoomioSignal;
  memberName: string;
  partner: string;
  comment?: string;
  votedAt: string;
}

export interface CoopProposal {
  id: string;
  title: string;
  proposer: string;
  proposerPartner: string;
  category: 'Booth & Physical Footprint' | 'Inventory & Consignment' | 'Hardware & Equipment' | 'Software & Tech Commons' | 'Policy & Membership';
  description: string;
  rationale: string;
  financialImpact?: string;
  deadline: string;
  status: 'active' | 'passed' | 'blocked';
  createdAt: string;
  votes: Record<string, ProposalVote>;
}

const { user } = useAuth();

const activeVotingMember = ref('Tyler (Core)');
const isNewProposalModalOpen = ref(false);

// Local state for active voting controls per proposal
const selectedSignal = ref<Record<string, LoomioSignal>>({});
const votingRationale = ref<Record<string, string>>({});

// Initial Seed Proposals representing authentic collective choices
const defaultProposals: CoopProposal[] = [
  {
    id: 'prop-1',
    title: 'Expand Memory Den Booth 0EJ Second Shelf Tier',
    proposer: 'Tyler (Core)',
    proposerPartner: 'HUCK',
    category: 'Booth & Physical Footprint',
    description: 'Add a 2nd riser shelf tier in booth #0EJ to display 60 additional vintage paperbacks and boxed tabletop games, increasing gross sales capacity without expanding rent.',
    rationale: 'Rent stays locked at $382.50 while floor merchandise density increases by ~30%.',
    financialImpact: '$45.00 one-time hardware from Tier 1 Commons Pool',
    deadline: new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10),
    status: 'active',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    votes: {
      'tyler': { signal: 'agree', memberName: 'Tyler (Core)', partner: 'HUCK', votedAt: new Date(Date.now() - 86400000 * 2).toISOString() },
      'pdxgl': { signal: 'agree', memberName: 'PDX Partner', partner: 'PDXGL', comment: 'Great for boxed RPG modules and rulebooks.', votedAt: new Date(Date.now() - 86400000).toISOString() },
      'jesse': { signal: 'agree', memberName: 'Member Jesse', partner: 'HUCK', votedAt: new Date(Date.now() - 43200000).toISOString() }
    }
  },
  {
    id: 'prop-2',
    title: 'Onboard Retro Game Consigner under PDXGL- Barcode Prefix',
    proposer: 'PDX Partner',
    proposerPartner: 'PDXGL',
    category: 'Inventory & Consignment',
    description: 'Trial 3-month consignment partnership with local retro gaming curator under the PDXGL- prefix (15 SNES / N64 titles). Sourced items follow the 70/30 Net Surplus split.',
    rationale: 'Broadens tabletop/retro offerings in Booth 0EJ, driving foot traffic with zero out-of-pocket capital risk to the collective.',
    financialImpact: '$0 out-of-pocket (standard 70/30 split)',
    deadline: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
    status: 'active',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    votes: {
      'pdxgl': { signal: 'agree', memberName: 'PDX Partner', partner: 'PDXGL', votedAt: new Date(Date.now() - 86400000 * 3).toISOString() },
      'tyler': { signal: 'agree', memberName: 'Tyler (Core)', partner: 'HUCK', comment: 'Complies with 70/30 rule. 100% cost recoupment protected.', votedAt: new Date(Date.now() - 86400000 * 2).toISOString() }
    }
  },
  {
    id: 'prop-3',
    title: 'Acquire Shared Munbyn Bluetooth Thermal Label Printer',
    proposer: 'Tyler (Core)',
    proposerPartner: 'HUCK',
    category: 'Hardware & Equipment',
    description: 'Purchase a portable battery-powered thermal label printer for on-the-go price tagging during weekly mall booth restocks.',
    rationale: 'Saves 30 minutes per restock run by printing barcode labels directly from phone in the booth aisle.',
    financialImpact: '$119.00 from Tier 1 Commons Pool',
    deadline: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10),
    status: 'active',
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    votes: {
      'tyler': { signal: 'agree', memberName: 'Tyler (Core)', partner: 'HUCK', votedAt: new Date(Date.now() - 86400000).toISOString() },
      'alex': { signal: 'abstain', memberName: 'Member Alex', partner: 'HUCK', comment: 'Current Rollo at home works fine for me, but happy if booth team wants it.', votedAt: new Date().toISOString() }
    }
  }
];

const proposals = ref<CoopProposal[]>([]);

const newProposal = ref<{
  title: string;
  proposer: string;
  proposerPartner: string;
  category: CoopProposal['category'];
  description: string;
  rationale: string;
  financialImpact: string;
  deadline: string;
}>({
  title: '',
  proposer: 'Tyler (Core)',
  proposerPartner: 'HUCK',
  category: 'Booth & Physical Footprint',
  description: '',
  rationale: '',
  financialImpact: '',
  deadline: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10)
});

onMounted(() => {
  try {
    const saved = localStorage.getItem('huck_coop_proposals_v1');
    if (saved) {
      proposals.value = JSON.parse(saved);
    } else {
      proposals.value = defaultProposals;
      saveProposals();
    }
  } catch {
    proposals.value = defaultProposals;
  }

  if (user.value?.name) {
    activeVotingMember.value = user.value.name;
    newProposal.value.proposer = user.value.name;
  }

  // Pre-fill active votes for current member
  initializeActiveSignals();
});

const saveProposals = () => {
  try {
    localStorage.setItem('huck_coop_proposals_v1', JSON.stringify(proposals.value));
  } catch {}
};

const initializeActiveSignals = () => {
  for (const p of proposals.value) {
    const vote = getUserVote(p);
    if (vote) {
      selectedSignal.value[p.id] = vote.signal;
      if (vote.comment) {
        votingRationale.value[p.id] = vote.comment;
      }
    }
  }
};

const activeProposalsCount = computed(() => {
  return proposals.value.filter(p => !hasBlock(p)).length;
});

const consensusProposalsCount = computed(() => {
  return proposals.value.filter(p => !hasBlock(p) && getSignalCount(p, 'agree') >= 2).length;
});

const blockedProposalsCount = computed(() => {
  return proposals.value.filter(p => hasBlock(p)).length;
});

const getVoteCount = (proposal: CoopProposal) => {
  return Object.keys(proposal.votes || {}).length;
};

const getSignalCount = (proposal: CoopProposal, signal: LoomioSignal) => {
  const votes = Object.values(proposal.votes || {});
  return votes.filter(v => v.signal === signal).length;
};

const getSignalPercent = (proposal: CoopProposal, signal: LoomioSignal) => {
  const total = getVoteCount(proposal);
  if (total === 0) return 0;
  return (getSignalCount(proposal, signal) / total) * 100;
};

const getAgreePercentage = (proposal: CoopProposal) => {
  const total = getVoteCount(proposal);
  if (total === 0) return 0;
  return (getSignalCount(proposal, 'agree') / total) * 100;
};

const hasBlock = (proposal: CoopProposal) => {
  return getSignalCount(proposal, 'block') > 0;
};

const getMemberKey = () => {
  return activeVotingMember.value.toLowerCase().replace(/[^a-z0-9]/g, '_');
};

const getUserVote = (proposal: CoopProposal) => {
  const key = getMemberKey();
  return proposal.votes?.[key] || null;
};

const selectSignal = (proposal: CoopProposal, signal: LoomioSignal) => {
  selectedSignal.value[proposal.id] = signal;
};

const submitVote = (proposal: CoopProposal) => {
  const signal = selectedSignal.value[proposal.id];
  if (!signal) {
    addToast({ type: 'warning', message: 'Please select a signal (Agree, Abstain, Disagree, or Block).' });
    return;
  }

  const comment = votingRationale.value[proposal.id]?.trim() || '';
  if (signal === 'block' && !comment) {
    addToast({ type: 'error', message: 'A mandatory explanation is required when exercising a Block.' });
    return;
  }

  const key = getMemberKey();
  const partner = activeVotingMember.value.includes('PDX') ? 'PDXGL' : 'HUCK';

  proposal.votes[key] = {
    signal,
    memberName: activeVotingMember.value,
    partner,
    comment: comment || undefined,
    votedAt: new Date().toISOString()
  };

  saveProposals();

  if (signal === 'block') {
    addToast({ type: 'error', message: 'Block recorded. Deliberation is now mandatory for this proposal.' });
  } else {
    addToast({ type: 'success', message: `Vote recorded as ${signal.toUpperCase()} for "${proposal.title}"` });
  }
};

const createProposal = () => {
  if (!newProposal.value.title.trim() || !newProposal.value.description.trim()) {
    addToast({ type: 'warning', message: 'Please fill in all required fields.' });
    return;
  }

  const p: CoopProposal = {
    id: 'prop-' + Date.now(),
    title: newProposal.value.title.trim(),
    proposer: newProposal.value.proposer.trim(),
    proposerPartner: newProposal.value.proposerPartner,
    category: newProposal.value.category,
    description: newProposal.value.description.trim(),
    rationale: newProposal.value.rationale.trim(),
    financialImpact: newProposal.value.financialImpact.trim() || undefined,
    deadline: newProposal.value.deadline || new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10),
    status: 'active',
    createdAt: new Date().toISOString(),
    votes: {
      [getMemberKey()]: {
        signal: 'agree',
        memberName: newProposal.value.proposer.trim(),
        partner: newProposal.value.proposerPartner,
        votedAt: new Date().toISOString()
      }
    }
  };

  proposals.value.unshift(p);
  saveProposals();
  isNewProposalModalOpen.value = false;

  newProposal.value.title = '';
  newProposal.value.description = '';
  newProposal.value.rationale = '';
  newProposal.value.financialImpact = '';

  addToast({ type: 'success', message: `Proposal "${p.title}" published for voting!` });
};

const getProposalCardBorderClass = (proposal: CoopProposal) => {
  if (hasBlock(proposal)) return 'border-error/40 bg-error/5';
  if (getSignalCount(proposal, 'agree') >= 2) return 'border-success/30';
  return 'border-base-200';
};

const getProposalStatusLabel = (proposal: CoopProposal) => {
  if (hasBlock(proposal)) return 'Deliberation Required (Veto)';
  if (getSignalCount(proposal, 'agree') >= 2) return 'Consensus Reached';
  return 'Active Deliberation';
};

const getStatusPillClass = (proposal: CoopProposal) => {
  if (hasBlock(proposal)) return 'bg-error text-error-content';
  if (getSignalCount(proposal, 'agree') >= 2) return 'bg-success text-success-content';
  return 'bg-warning text-warning-content';
};

const getStatusPillIcon = (proposal: CoopProposal) => {
  if (hasBlock(proposal)) return 'solar:shield-warning-bold';
  if (getSignalCount(proposal, 'agree') >= 2) return 'solar:check-circle-bold';
  return 'solar:clock-circle-bold';
};

const getCategoryBadgeClass = (category: CoopProposal['category']) => {
  switch (category) {
    case 'Booth & Physical Footprint': return 'badge-secondary text-secondary-content';
    case 'Inventory & Consignment': return 'badge-accent text-accent-content';
    case 'Hardware & Equipment': return 'badge-info text-info-content';
    case 'Software & Tech Commons': return 'badge-primary text-primary-content';
    case 'Policy & Membership': return 'badge-neutral text-neutral-content';
    default: return 'badge-ghost';
  }
};

const getSignalBadgeClass = (signal: LoomioSignal) => {
  switch (signal) {
    case 'agree': return 'badge-success text-success-content';
    case 'abstain': return 'badge-warning text-warning-content';
    case 'disagree': return 'badge-secondary text-secondary-content';
    case 'block': return 'badge-error text-error-content';
    default: return 'badge-ghost';
  }
};

const getSignalEmoji = (signal: LoomioSignal) => {
  switch (signal) {
    case 'agree': return '🟢';
    case 'abstain': return '🟡';
    case 'disagree': return '🟠';
    case 'block': return '🔴';
  }
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  return dateStr.slice(0, 10);
};

const exportProposalsCsv = () => {
  if (proposals.value.length === 0) return;
  const header = ['ID', 'Title', 'Category', 'Proposer', 'Partner', 'Deadline', 'Status', 'AgreeCount', 'BlockCount'];
  const rows = proposals.value.map(p => [
    p.id,
    `"${p.title.replace(/"/g, '""')}"`,
    `"${p.category}"`,
    `"${p.proposer.replace(/"/g, '""')}"`,
    p.proposerPartner,
    p.deadline,
    getProposalStatusLabel(p),
    getSignalCount(p, 'agree'),
    getSignalCount(p, 'block')
  ]);
  const csvContent = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Coop_Governance_Proposals_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  addToast({ type: 'success', message: 'Downloaded Governance Proposals CSV!' });
};
</script>
