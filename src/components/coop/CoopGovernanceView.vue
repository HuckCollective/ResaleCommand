<template>
  <div class="space-y-6">
    <!-- Top Header & Actions (Canonical Ledger Archetype) -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
        <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-base-content flex items-center gap-2.5">
          <Icon icon="solar:users-group-two-rounded-bold-duotone" class="w-7 h-7 sm:w-8 sm:h-8 text-primary shrink-0" />
          <span>Democratic Governance &amp; Consent Voting</span>
        </h1>
        <p class="text-xs sm:text-sm text-base-content/60 font-medium mt-1 max-w-2xl leading-relaxed">
          Every member has equal voting authority. Operational proposals require consent under the Loomio 4-signal protocol. Any member can cast a Block to halt an unsafe action and trigger deliberation.
        </p>
      </div>

      <div class="flex items-center gap-2 w-full sm:w-auto flex-wrap justify-end">
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

    <!-- 4 Standalone Icon-Badge KPI Cards (Canonical Ledger Archetype) -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <div class="bg-base-100 p-3.5 sm:p-5 rounded-2xl border border-base-200 shadow-sm flex items-center gap-3 sm:gap-4">
        <div class="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
          <Icon icon="solar:chat-round-dots-bold-duotone" class="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <div class="min-w-0">
          <div class="text-[11px] uppercase font-bold opacity-60 truncate">Active Deliberations</div>
          <div class="text-lg sm:text-2xl font-black font-mono text-base-content truncate">{{ activeProposalsCount }}</div>
          <div class="text-[10px] font-semibold opacity-50 truncate">Open for member voting</div>
        </div>
      </div>

      <div class="bg-base-100 p-3.5 sm:p-5 rounded-2xl border border-base-200 shadow-sm flex items-center gap-3 sm:gap-4">
        <div class="w-10 h-10 sm:w-12 sm:h-12 bg-success/10 text-success rounded-xl flex items-center justify-center shrink-0">
          <Icon icon="solar:check-circle-bold-duotone" class="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <div class="min-w-0">
          <div class="text-[11px] uppercase font-bold opacity-60 truncate">Consensus Achieved</div>
          <div class="text-lg sm:text-2xl font-black font-mono text-success truncate">{{ consensusProposalsCount }}</div>
          <div class="text-[10px] font-semibold opacity-50 truncate">Passed by collective consent</div>
        </div>
      </div>

      <div class="bg-base-100 p-3.5 sm:p-5 rounded-2xl border border-base-200 shadow-sm flex items-center gap-3 sm:gap-4">
        <div class="w-10 h-10 sm:w-12 sm:h-12 bg-error/10 text-error rounded-xl flex items-center justify-center shrink-0">
          <Icon icon="solar:forbidden-circle-bold-duotone" class="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <div class="min-w-0">
          <div class="text-[11px] uppercase font-bold opacity-60 truncate">Active Blocks / Vetoes</div>
          <div class="text-lg sm:text-2xl font-black font-mono text-error truncate">{{ blockedProposalsCount }}</div>
          <div class="text-[10px] font-semibold opacity-50 truncate">{{ blockedProposalsCount === 0 ? 'Zero active objections' : 'Requires deliberation' }}</div>
        </div>
      </div>

      <div class="bg-base-100 p-3.5 sm:p-5 rounded-2xl border border-base-200 shadow-sm flex items-center gap-3 sm:gap-4">
        <div class="w-10 h-10 sm:w-12 sm:h-12 bg-info/10 text-info rounded-xl flex items-center justify-center shrink-0">
          <Icon icon="solar:shield-check-bold-duotone" class="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <div class="min-w-0">
          <div class="text-[11px] uppercase font-bold opacity-60 truncate">Consensus Standard</div>
          <div class="text-lg sm:text-2xl font-black font-mono text-info truncate">0 Blocks</div>
          <div class="text-[10px] font-semibold opacity-50 truncate">Consent over majoritarianism</div>
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

        <div class="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <select v-model="activeVotingMember" @change="initializeActiveSignals" class="select select-bordered select-sm rounded-xl font-bold text-xs h-9 min-h-9 flex-1 sm:w-56">
            <option v-for="m in policyConfig.members" :key="m.name" :value="m.name">
              {{ m.name }} — [{{ m.partner }}-]
            </option>
          </select>
          <span class="badge badge-sm badge-success font-bold shrink-0">Eligible Voter</span>
          <span
            class="badge badge-sm font-mono font-bold shrink-0 gap-1"
            :class="isCloudSynced ? 'badge-primary' : 'badge-ghost'"
            :title="isCloudSynced ? 'Proposals & Votes synced live in Appwrite Cloud (resale_db)' : 'Using browser fallback storage'"
          >
            <Icon :icon="isCloudSynced ? 'solar:cloud-check-bold' : 'solar:cloud-storage-linear'" class="w-3.5 h-3.5" />
            <span>{{ isSavingCloud ? 'Saving...' : isCloudSynced ? 'Appwrite DB Live' : 'Local Cache' }}</span>
          </span>
        </div>
      </div>
    </div>

    <!-- 3-Tab Governance Workbench Switcher -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1.5 bg-base-200/80 border border-base-300 rounded-2xl shadow-xs">
      <button
        type="button"
        @click="setGovTab('proposals')"
        class="btn btn-sm h-10 rounded-xl font-bold gap-2 transition-all"
        :class="activeGovTab === 'proposals' ? 'btn-primary shadow-xs' : 'btn-ghost text-base-content/75'"
      >
        <Icon icon="solar:chat-round-check-bold-duotone" class="w-4 h-4 shrink-0" />
        <span>1. Active Proposals ({{ proposals.length }})</span>
      </button>
      <button
        type="button"
        @click="setGovTab('rules')"
        class="btn btn-sm h-10 rounded-xl font-bold gap-2 transition-all"
        :class="activeGovTab === 'rules' ? 'btn-primary shadow-xs' : 'btn-ghost text-base-content/75'"
      >
        <Icon icon="solar:settings-minimalistic-bold-duotone" class="w-4 h-4 shrink-0" />
        <span>2. Configurable Rules &amp; Sliders ({{ policyConfig.curatorSharePct }}/{{ policyConfig.commonsSharePct }})</span>
      </button>
      <button
        type="button"
        @click="setGovTab('roster')"
        class="btn btn-sm h-10 rounded-xl font-bold gap-2 transition-all"
        :class="activeGovTab === 'roster' ? 'btn-primary shadow-xs' : 'btn-ghost text-base-content/75'"
      >
        <Icon icon="solar:users-group-rounded-bold-duotone" class="w-4 h-4 shrink-0" />
        <span>3. Partner &amp; Voter Roster ({{ policyConfig.members.length }})</span>
      </button>
    </div>

    <!-- TAB 2: CONFIGURABLE CO-OP RULES & 3-WAY WSDE SLIDERS -->
    <div v-if="activeGovTab === 'rules'" class="card bg-base-100 border border-primary/30 shadow-md rounded-3xl p-5 sm:p-7 space-y-6">
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-base-200 pb-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="badge badge-primary font-bold text-xs">5 Democratic Dials</span>
            <span class="badge badge-outline font-mono text-xs">Appwrite Cloud Policy Engine</span>
          </div>
          <h3 class="text-xl sm:text-2xl font-black text-base-content mt-1">
            Configurable 4-Gate WSDE Waterfall &amp; Excess Surplus Sliders
          </h3>
          <p class="text-xs text-base-content/70 mt-0.5">
            Adjusting and enacting these sliders updates <a href="/coop/settlements" class="link link-primary font-bold">/coop/settlements</a>, <a href="/sales" class="link link-primary font-bold">/sales</a>, and <a href="/coop" class="link link-primary font-bold">/coop</a> in real time.
          </p>
        </div>
        <button
          type="button"
          @click="savePolicyConfigToCloud"
          :disabled="isSavingCloud"
          class="btn btn-primary btn-sm h-10 px-5 rounded-xl font-black gap-2 shadow-sm shrink-0"
        >
          <Icon icon="solar:cloud-upload-bold" class="w-4 h-4" />
          <span>{{ isSavingCloud ? 'Saving...' : 'Enact & Sync Policy to Cloud' }}</span>
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Dial 1: Gate 3 Item Margin Split -->
        <div class="p-5 rounded-2xl bg-base-200/50 border border-base-300 space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-xs font-extrabold uppercase tracking-wider text-primary">Dial 1 • Gate 3 Item Margin Split</div>
              <div class="text-sm font-black text-base-content">Curator Share vs. Shared Commons Pool</div>
            </div>
            <span class="badge badge-primary font-mono font-black text-sm py-3 px-3">
              {{ policyConfig.curatorSharePct }}% / {{ policyConfig.commonsSharePct }}%
            </span>
          </div>
          <input
            type="range"
            min="50"
            max="90"
            step="5"
            v-model.number="policyConfig.curatorSharePct"
            @input="onCuratorShareChange"
            class="range range-primary range-sm"
          />
          <div class="flex justify-between text-xs font-mono text-base-content/70">
            <span>Curator Profit: <strong>{{ policyConfig.curatorSharePct }}%</strong></span>
            <span>Commons Pool: <strong>{{ policyConfig.commonsSharePct }}%</strong></span>
          </div>
        </div>

        <!-- Dial 2: Gate 4B 3-Way Excess Surplus Split -->
        <div class="p-5 rounded-2xl bg-base-200/50 border border-base-300 space-y-4">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div class="text-xs font-extrabold uppercase tracking-wider text-secondary">Dial 2 • Gate 4B Excess Surplus (Over Operating Costs)</div>
              <div class="text-sm font-black text-base-content">Reserve % + Sales Patronage % + Sweat-Equity Labor %</div>
            </div>
            <div class="flex gap-1 flex-wrap">
              <button type="button" @click="applyExcessPreset(10, 60, 30)" class="btn btn-xs rounded-lg font-mono" :class="policyConfig.salesPatronagePct === 60 && policyConfig.laborPatronagePct === 30 ? 'btn-secondary' : 'btn-ghost border border-base-300'">10/60/30 WSDE</button>
              <button type="button" @click="applyExcessPreset(10, 45, 45)" class="btn btn-xs rounded-lg font-mono" :class="policyConfig.salesPatronagePct === 45 && policyConfig.laborPatronagePct === 45 ? 'btn-accent' : 'btn-ghost border border-base-300'" title="Mondragon 10% Coordination Reserve / 45% Sales & Enterprise / 45% Member Labor & ICA">10/45/45 Mondragon</button>
              <button type="button" @click="applyExcessPreset(10, 90, 0)" class="btn btn-xs rounded-lg font-mono" :class="policyConfig.salesPatronagePct === 90 ? 'btn-primary' : 'btn-ghost border border-base-300'">10/90/0 Sales</button>
            </div>
          </div>

          <div class="space-y-3">
            <div>
              <div class="flex justify-between text-xs font-bold mb-1">
                <span>🛡️ Rainy-Day Reserve Slice</span>
                <span class="font-mono text-info">{{ policyConfig.reserveSharePct }}%</span>
              </div>
              <input type="range" min="0" max="50" step="5" v-model.number="policyConfig.reserveSharePct" @input="rebalanceExcessSliders('reserve')" class="range range-xs range-info" />
            </div>

            <div>
              <div class="flex justify-between text-xs font-bold mb-1">
                <span>📊 Partner Sales Patronage Dividend</span>
                <span class="font-mono text-success">{{ policyConfig.salesPatronagePct }}%</span>
              </div>
              <input type="range" min="0" max="100" step="5" v-model.number="policyConfig.salesPatronagePct" @input="rebalanceExcessSliders('sales')" class="range range-xs range-success" />
            </div>

            <div>
              <div class="flex justify-between text-xs font-bold mb-1">
                <span>⏱️ Sweat-Equity Enabling Labor Dividend (<a href="/coop/labor" class="link link-secondary">logged hours</a>)</span>
                <span class="font-mono text-secondary">{{ policyConfig.laborPatronagePct }}%</span>
              </div>
              <input type="range" min="0" max="100" step="5" v-model.number="policyConfig.laborPatronagePct" @input="rebalanceExcessSliders('labor')" class="range range-xs range-secondary" />
            </div>
          </div>
        </div>
      </div>

      <!-- Dials 3, 4, 5, 6: Reserve Cap, Shortfall Carryover, Consensus Quorum, Orphan Ticket Window -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="p-4 rounded-2xl bg-base-200/40 border border-base-300 space-y-1.5">
          <label class="text-xs font-extrabold uppercase tracking-wider text-base-content/60">Dial 3 • Rainy-Day Reserve Cap ($)</label>
          <input type="number" min="0" step="50" v-model.number="policyConfig.reserveCapTarget" class="input input-bordered input-sm rounded-xl font-mono font-bold w-full" />
          <p class="text-[11px] text-base-content/60">Once Reserve reaches ${{ policyConfig.reserveCapTarget }}, the {{ policyConfig.reserveSharePct }}% slice overflows to Partner Dividends.</p>
        </div>

        <div class="p-4 rounded-2xl bg-base-200/40 border border-base-300 space-y-1.5">
          <label class="text-xs font-extrabold uppercase tracking-wider text-warning">Dial 4 • Prior Shortfall Carryover ($)</label>
          <input type="number" min="0" step="10" v-model.number="policyConfig.carriedOverShortfall" class="input input-bordered input-sm rounded-xl font-mono font-bold w-full" />
          <p class="text-[11px] text-base-content/60">Prior deficit repaid 100% first in Gate 4A before Gate 4B bonus dividends unlock.</p>
        </div>

        <div class="p-4 rounded-2xl bg-base-200/40 border border-base-300 space-y-1.5">
          <label class="text-xs font-extrabold uppercase tracking-wider text-base-content/60">Dial 5 • Consensus Quorum (Agree Votes)</label>
          <input type="number" min="1" max="10" step="1" v-model.number="policyConfig.minAgreeVotes" class="input input-bordered input-sm rounded-xl font-mono font-bold w-full" />
          <p class="text-[11px] text-base-content/60">Minimum Agree signals (with 0 Blocks) required to pass a proposal.</p>
        </div>

        <div class="p-4 rounded-2xl bg-base-200/40 border border-base-300 space-y-1.5">
          <label class="text-xs font-extrabold uppercase tracking-wider text-base-content/60">Dial 6 • Orphan Ticket Window (Days)</label>
          <input type="number" min="7" max="90" step="1" v-model.number="policyConfig.orphanClaimWindowDays" class="input input-bordered input-sm rounded-xl font-mono font-bold w-full" />
          <p class="text-[11px] text-base-content/60">Days before an unlinked register ticket can be swept 100% to Commons Pool.</p>
        </div>
      </div>

      <!-- Consignor Agreements & Straight Commission Settings -->
      <div class="p-4 sm:p-5 rounded-2xl bg-base-200/40 border border-base-300 space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div class="text-xs font-extrabold uppercase tracking-wider text-secondary">Consignor Agreements</div>
            <div class="text-sm font-black text-base-content">Straight Consignment Deals (applied on /coop/settlements)</div>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <input v-model="newConsignor.prefix" type="text" placeholder="PREFIX (e.g. CON)" class="input input-bordered input-sm rounded-xl font-mono text-xs w-32" />
            <input v-model="newConsignor.displayName" type="text" placeholder="Display name" class="input input-bordered input-sm rounded-xl text-xs w-40" />
            <button type="button" @click="addConsignor" class="btn btn-sm btn-secondary rounded-xl font-bold">+ Add Straight Consignor</button>
          </div>
        </div>

        <div v-if="policyConfig.consignors.length === 0" class="text-xs text-base-content/60">No consignors configured yet.</div>

        <div v-for="(c, idx) in policyConfig.consignors" :key="c.prefix" class="p-4 rounded-2xl bg-base-100 border border-base-300 space-y-3">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="flex items-center gap-2">
              <span class="badge badge-sm badge-warning font-mono font-bold">{{ c.prefix }}</span>
              <span class="font-black text-sm">{{ c.displayName }}</span>
            </div>
            <button type="button" @click="removeConsignor(idx)" class="btn btn-ghost btn-xs text-error">Remove</button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div class="form-control">
              <label class="label py-1"><span class="label-text font-bold text-xs">Deal Mode</span></label>
              <select v-model="c.mode" class="select select-bordered select-sm rounded-xl font-bold text-xs">
                <option v-for="(label, key) in CONSIGNOR_DEAL_MODE_LABELS" :key="key" :value="key">{{ label }}</option>
              </select>
            </div>

            <div class="form-control">
              <label class="label py-1">
                <span class="label-text font-bold text-xs">✂️ % Split (After Venue Take)</span>
                <span class="font-mono font-black text-xs text-primary">{{ c.coopCommissionPct }}% Co-op / {{ 100 - c.coopCommissionPct }}% Consignor</span>
              </label>
              <div class="flex items-center gap-2">
                <input type="range" min="0" max="60" step="1" v-model.number="c.coopCommissionPct" class="range range-secondary range-xs flex-1" />
                <input type="number" min="0" max="60" step="1" v-model.number="c.coopCommissionPct" class="input input-bordered input-xs w-14 font-mono font-bold text-right" />
              </div>
              <div class="flex items-center gap-1 flex-wrap mt-1">
                <button
                  v-for="pct in [10, 15, 20, 25, 30, 50]"
                  :key="pct"
                  type="button"
                  @click="c.coopCommissionPct = pct; c.mode = 'flat_commission'"
                  class="btn btn-xs h-5 min-h-0 px-1.5 rounded font-mono text-[10px]"
                  :class="c.coopCommissionPct === pct && c.mode === 'flat_commission' ? 'btn-secondary' : 'btn-ghost border border-base-300'"
                >
                  {{ pct }}%
                </button>
              </div>
            </div>

            <div class="form-control">
              <label class="label py-1"><span class="label-text font-bold text-xs">🏪 Fixed Shelf Rent ($/mo)</span></label>
              <input type="number" min="0" step="5" v-model.number="c.fixedMonthlyRent" class="input input-bordered input-sm rounded-xl font-mono font-bold" />
            </div>
          </div>

          <!-- Interactive 3-Mode Side-by-Side Example Calculator -->
          <div class="p-3 rounded-xl bg-base-200/60 border border-base-300 space-y-2 text-xs">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <span class="font-extrabold uppercase tracking-wider text-[11px] text-base-content/70">
                🔍 Live 3-Mode Example Calculator (After 15% Venue Fee = ${{ (consignorSampleGross * 0.85).toFixed(2) }} Net Deposit):
              </span>
              <div class="join border border-base-300 rounded-lg bg-base-100 p-0.5">
                <button
                  v-for="amt in [100, 250, 500]"
                  :key="amt"
                  type="button"
                  @click="consignorSampleGross = amt"
                  class="join-item btn btn-xs h-5 min-h-0 px-2 font-mono text-[10px]"
                  :class="consignorSampleGross === amt ? 'btn-primary' : 'btn-ghost'"
                >
                  ${{ amt }} Gross
                </button>
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px]">
              <button
                type="button"
                @click="c.mode = 'flat_commission'"
                class="text-left p-2.5 rounded-xl border transition-all"
                :class="c.mode === 'flat_commission' ? 'border-primary bg-primary/10 font-bold' : 'border-base-300 bg-base-100'"
              >
                <div class="font-sans font-black text-xs mb-0.5">✂️ 1. Straight {{ c.coopCommissionPct }}% Split</div>
                <div class="text-base-content/70">$0 Rent • Co-op gets ${{ ((consignorSampleGross * 0.85 * c.coopCommissionPct) / 100).toFixed(2) }}</div>
                <div class="text-success font-black mt-0.5">Consignor: ${{ (consignorSampleGross * 0.85 * (1 - c.coopCommissionPct / 100)).toFixed(2) }}</div>
              </button>
              <button
                type="button"
                @click="c.mode = 'fixed_shelf_rent'"
                class="text-left p-2.5 rounded-xl border transition-all"
                :class="c.mode === 'fixed_shelf_rent' ? 'border-primary bg-primary/10 font-bold' : 'border-base-300 bg-base-100'"
              >
                <div class="font-sans font-black text-xs mb-0.5">🏪 2. Fixed ${{ Number(c.fixedMonthlyRent || 0).toFixed(0) }}/mo Shelf</div>
                <div class="text-base-content/70">-${{ Math.min(consignorSampleGross * 0.85, Number(c.fixedMonthlyRent || 0)).toFixed(2) }} Rent + {{ c.coopCommissionPct }}% Co-op</div>
                <div class="text-success font-black mt-0.5">
                  Consignor: ${{ (Math.max(0, consignorSampleGross * 0.85 - Number(c.fixedMonthlyRent || 0)) * (1 - c.coopCommissionPct / 100)).toFixed(2) }}
                </div>
              </button>
              <button
                type="button"
                @click="c.mode = 'pro_rata_rent'"
                class="text-left p-2.5 rounded-xl border transition-all"
                :class="c.mode === 'pro_rata_rent' ? 'border-primary bg-primary/10 font-bold' : 'border-base-300 bg-base-100'"
              >
                <div class="font-sans font-black text-xs mb-0.5">📊 3. Pro-Rata Booth Rent</div>
                <div class="text-base-content/70">0% Co-op • ~${{ Math.min(consignorSampleGross * 0.85, (consignorSampleGross / 2000) * 382.5).toFixed(2) }} Rent Share</div>
                <div class="text-success font-black mt-0.5">
                  Consignor: ${{ Math.max(0, consignorSampleGross * 0.85 - (consignorSampleGross / 2000) * 382.5).toFixed(2) }}
                </div>
              </button>
            </div>
          </div>

          <label class="label cursor-pointer justify-start gap-2 py-0">
            <input type="checkbox" v-model="c.capRentAtNetSales" class="checkbox checkbox-sm checkbox-primary" />
            <span class="label-text text-xs font-bold">Never let rent push payout below $0</span>
          </label>
        </div>
        <p class="text-[11px] text-base-content/60">Click "Enact &amp; Sync Policy to Cloud" above to save consignor deals.</p>
      </div>

      <!-- Mondragon Federation & WSDE Structural Guardrails -->
      <div class="p-4 sm:p-5 rounded-2xl bg-base-200/40 border border-base-300 space-y-3">
        <div class="text-xs font-extrabold uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
          <Icon icon="solar:shield-check-bold" class="w-4 h-4 text-accent" />
          <span>Mondragon Federation &amp; WSDE Structural Guardrails</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div class="p-3 rounded-xl bg-base-100 border border-base-300 space-y-1">
            <div class="font-black text-base-content">🔄 Reversed Hierarchy</div>
            <p class="text-[11px] text-base-content/75 leading-relaxed">
              The General Assembly (<span class="font-mono font-bold">1M1V</span>) evaluates and directs operational leads. Financial prep &amp; reconciliation count as credited enabling labor.
            </p>
          </div>
          <div class="p-3 rounded-xl bg-base-100 border border-base-300 space-y-1">
            <div class="font-black text-base-content">⚖️ 4.5:1 Pay Ratio Cap</div>
            <p class="text-[11px] text-base-content/75 leading-relaxed">
              Labor bounty &amp; compensation tiers are compressed to a <span class="font-mono font-bold">4.5:1</span> standard (<span class="font-mono font-bold">6.5:1</span> max exception) + <span class="font-mono font-bold">7%</span> ICA target yield.
            </p>
          </div>
          <div class="p-3 rounded-xl bg-base-100 border border-base-300 space-y-1">
            <div class="font-black text-base-content">🛒 Open Procurement</div>
            <p class="text-[11px] text-base-content/75 leading-relaxed">
              Competitive sourcing for thermal labels, fixtures, and software inputs (best quality at lowest price) with 100% receipt transparency.
            </p>
          </div>
          <div class="p-3 rounded-xl bg-base-100 border border-base-300 space-y-1">
            <div class="font-black text-base-content">🤝 Niche Non-Competition</div>
            <p class="text-[11px] text-base-content/75 leading-relaxed">
              Co-op partners curate complementary niches (<span class="font-mono font-bold">HUCK-</span> vintage/apparel/oddities vs. <span class="font-mono font-bold">PDXGL-</span> tabletop games/RPGs) rather than competing head-to-head.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 3: PARTNER & VOTER ROSTER REGISTRY -->
    <div v-if="activeGovTab === 'roster'" class="card bg-base-100 border border-base-300 shadow-sm rounded-3xl p-5 sm:p-7 space-y-5">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 class="text-xl font-black text-base-content">Co-op Partner, Marketing Worker &amp; Voter Roster</h3>
          <p class="text-xs text-base-content/70">Manage eligible Loomio voters, Curator Partners (HUCK-, PDXGL-), Marketing &amp; Social Enablers (SWEAT- — $0 inventory required), and Consignors (BB-).</p>
        </div>
        <div class="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <input v-model="newRosterMember.name" type="text" placeholder="Member Name (e.g. Alex)" class="input input-bordered input-sm rounded-xl text-xs" />
          <select v-model="newRosterMember.partner" class="select select-bordered select-sm rounded-xl font-mono font-bold text-xs">
            <option value="HUCK">HUCK- (Curator)</option>
            <option value="PDXGL">PDXGL- (Curator)</option>
            <option value="SWEAT">SWEAT- (Marketing &amp; Social Enabler)</option>
            <option value="BB">BB- (Consignor)</option>
          </select>
          <button type="button" @click="addRosterMember" class="btn btn-sm btn-primary rounded-xl font-bold">+ Add Member</button>
        </div>
      </div>

      <div class="overflow-x-auto border border-base-200 rounded-2xl">
        <table class="table table-sm">
          <thead>
            <tr class="bg-base-200/60 text-xs font-extrabold uppercase text-base-content/70">
              <th>Member Name</th>
              <th>Partner Prefix</th>
              <th>Role</th>
              <th>Voting Rights</th>
              <th class="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(member, idx) in policyConfig.members" :key="member.name" class="hover:bg-base-200/40">
              <td class="font-bold text-xs">{{ member.name }}</td>
              <td>
                <span class="badge badge-xs font-mono font-bold" :class="member.partner === 'SWEAT' ? 'badge-secondary' : member.partner === 'PDXGL' ? 'badge-accent' : member.partner === 'BB' ? 'badge-warning' : 'badge-primary'">
                  {{ member.partner }}-
                </span>
              </td>
              <td class="text-xs">{{ member.role }}</td>
              <td>
                <span class="badge badge-xs font-bold" :class="member.canVote ? 'badge-success' : 'badge-ghost'">
                  {{ member.canVote ? '1 Member = 1 Vote' : 'Observer' }}
                </span>
              </td>
              <td class="text-right">
                <button v-if="policyConfig.members.length > 1" type="button" @click="removeRosterMember(idx)" class="btn btn-ghost btn-xs text-error">
                  Remove
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Proposals List (TAB 1) -->
    <div v-show="activeGovTab === 'proposals'" class="space-y-4">
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

          <!-- Status Indicator Pill & 1-Click Enact Button -->
          <div class="shrink-0 flex items-center gap-2 flex-wrap">
            <button
              v-if="!hasBlock(proposal) && getSignalCount(proposal, 'agree') >= (policyConfig.minAgreeVotes || 2) && proposal.status !== 'passed'"
              type="button"
              @click="enactConsensusProposal(proposal)"
              class="btn btn-xs btn-primary rounded-xl font-black gap-1 shadow-xs"
              title="Mark proposal as Enacted and sync policy rules to Appwrite Cloud"
            >
              <Icon icon="solar:bolt-bold" class="w-3.5 h-3.5" />
              <span>⚡ Enact Passed Proposal</span>
            </button>
            <div 
              class="px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-xs"
              :class="getStatusPillClass(proposal)"
            >
              <Icon :icon="getStatusPillIcon(proposal)" class="w-4 h-4 shrink-0" />
              <span>{{ proposal.status === 'passed' ? 'Enacted by Consensus' : getProposalStatusLabel(proposal) }}</span>
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
                  Changing this option updates the live Co-op Settlement &amp; Waterfall calculator in Appwrite Cloud across all partners.
                </p>
              </div>
              <div class="join border border-base-300 rounded-xl bg-base-100 p-0.5 shrink-0">
                <button
                  type="button"
                  @click="updateCloudSurplusPolicy('patronage_90_10')"
                  class="join-item btn btn-xs font-bold rounded-lg border-0"
                  :class="activeSurplusPolicyMode === 'patronage_90_10' ? 'btn-primary text-primary-content' : 'btn-ghost text-base-content/70'"
                >
                  ⚖️ 90/10 Dividend
                </button>
                <button
                  type="button"
                  @click="updateCloudSurplusPolicy('cap_100')"
                  class="join-item btn btn-xs font-bold rounded-lg border-0"
                  :class="activeSurplusPolicyMode === 'cap_100' ? 'btn-primary text-primary-content' : 'btn-ghost text-base-content/70'"
                >
                  🚀 100% Over Ops
                </button>
                <button
                  type="button"
                  @click="updateCloudSurplusPolicy('reserve_100')"
                  class="join-item btn btn-xs font-bold rounded-lg border-0"
                  :class="activeSurplusPolicyMode === 'reserve_100' ? 'btn-neutral text-neutral-content' : 'btn-ghost text-base-content/70'"
                >
                  🛡️ 100% Reserve
                </button>
              </div>
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
import {
  loadCoopGovernanceState,
  saveCoopGovernanceState,
  DEFAULT_COOP_POLICY_CONFIG,
  CONSIGNOR_DEAL_MODE_LABELS,
  type LoomioSignal,
  type ProposalVote,
  type CoopProposal,
  type SurplusPolicyMode,
  type CoopPolicyConfig,
} from '../../lib/coopGovernance';

const { user, currentTeam } = useAuth();

const activeGovTab = ref<'proposals' | 'rules' | 'roster'>('proposals');
const activeVotingMember = ref(DEFAULT_COOP_POLICY_CONFIG.members[0]?.name || 'Mike (HUCK)');
const isNewProposalModalOpen = ref(false);
const isCloudSynced = ref(false);
const isSavingCloud = ref(false);
const activeSurplusPolicyMode = ref<SurplusPolicyMode>('patronage_90_10');
const policyConfig = ref<CoopPolicyConfig>({
  ...DEFAULT_COOP_POLICY_CONFIG,
  members: [...DEFAULT_COOP_POLICY_CONFIG.members],
});

const newRosterMember = ref<{
  name: string;
  partner: 'HUCK' | 'PDXGL' | 'SWEAT' | 'BB';
}>({
  name: '',
  partner: 'HUCK',
});

const newConsignor = ref({ prefix: '', displayName: '' });
const consignorSampleGross = ref<number>(100);

const addConsignor = () => {
  const clean = newConsignor.value.prefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) {
    addToast({ type: 'warning', message: 'Enter a consignor prefix first.' });
    return;
  }
  const prefix = `${clean}-`;
  if (policyConfig.value.consignors.some((c) => c.prefix === prefix)) {
    addToast({ type: 'warning', message: `${prefix} already has an agreement.` });
    return;
  }
  policyConfig.value.consignors.push({
    prefix,
    displayName: newConsignor.value.displayName.trim() || `${clean} Consignor`,
    mode: 'flat_commission',
    coopCommissionPct: 20,
    fixedMonthlyRent: 0,
    capRentAtNetSales: true,
  });
  newConsignor.value = { prefix: '', displayName: '' };
};

const removeConsignor = (idx: number) => {
  policyConfig.value.consignors.splice(idx, 1);
};

const setGovTab = (tab: 'proposals' | 'rules' | 'roster') => {
  activeGovTab.value = tab;
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    if (tab === 'proposals') {
      url.searchParams.delete('tab');
    } else {
      url.searchParams.set('tab', tab);
    }
    window.history.replaceState({}, '', url.toString());
  }
};

const onCuratorShareChange = () => {
  policyConfig.value.commonsSharePct = Math.max(10, 100 - policyConfig.value.curatorSharePct);
};

const rebalanceExcessSliders = (changed: 'reserve' | 'sales' | 'labor') => {
  const r = Math.min(100, Math.max(0, Number(policyConfig.value.reserveSharePct) || 0));
  const s = Math.min(100, Math.max(0, Number(policyConfig.value.salesPatronagePct) || 0));
  const l = Math.min(100, Math.max(0, Number(policyConfig.value.laborPatronagePct) || 0));

  if (changed === 'reserve') {
    const remaining = Math.max(0, 100 - r);
    const currentSL = s + l;
    if (currentSL > 0) {
      policyConfig.value.salesPatronagePct = Math.round((s / currentSL) * remaining);
      policyConfig.value.laborPatronagePct = remaining - policyConfig.value.salesPatronagePct;
    } else {
      policyConfig.value.salesPatronagePct = remaining;
      policyConfig.value.laborPatronagePct = 0;
    }
  } else if (changed === 'sales') {
    const maxSales = Math.max(0, 100 - r);
    policyConfig.value.salesPatronagePct = Math.min(s, maxSales);
    policyConfig.value.laborPatronagePct = Math.max(0, 100 - r - policyConfig.value.salesPatronagePct);
  } else {
    const maxLabor = Math.max(0, 100 - r);
    policyConfig.value.laborPatronagePct = Math.min(l, maxLabor);
    policyConfig.value.salesPatronagePct = Math.max(0, 100 - r - policyConfig.value.laborPatronagePct);
  }
};

const applyExcessPreset = (reserve: number, sales: number, labor: number) => {
  policyConfig.value.reserveSharePct = reserve;
  policyConfig.value.salesPatronagePct = sales;
  policyConfig.value.laborPatronagePct = labor;
};

const savePolicyConfigToCloud = async () => {
  await saveProposals();
  addToast({
    type: 'success',
    message: `Enacted Policy: ${policyConfig.value.curatorSharePct}/${policyConfig.value.commonsSharePct} Gate 3 • ${policyConfig.value.reserveSharePct}% Res / ${policyConfig.value.salesPatronagePct}% Sales / ${policyConfig.value.laborPatronagePct}% Labor!`,
  });
};

const addRosterMember = async () => {
  const rawName = newRosterMember.value.name.trim();
  if (!rawName) {
    addToast({ type: 'warning', message: 'Enter a member name first.' });
    return;
  }
  const partner = newRosterMember.value.partner;
  const formattedName = rawName.includes('(') ? rawName : `${rawName} (${partner})`;
  policyConfig.value.members.push({
    name: formattedName,
    partner,
    role:
      partner === 'BB'
        ? 'Consignor'
        : partner === 'SWEAT'
          ? 'Marketing & Social Enabler'
          : partner === 'PDXGL'
            ? 'Partner Curator'
            : 'Co-op Member',
    canVote: partner !== 'BB',
  });
  newRosterMember.value.name = '';
  await saveProposals();
  addToast({ type: 'success', message: `Added ${formattedName} to Co-op Roster!` });
};

const enactConsensusProposal = async (proposal: CoopProposal) => {
  proposal.status = 'passed';
  if (proposal.presetAction === 'mondragon_10_45_45') {
    applyExcessPreset(10, 45, 45);
  } else if (proposal.presetAction === 'wsde_10_60_30') {
    applyExcessPreset(10, 60, 30);
  } else if (proposal.presetAction === 'sales_10_90_0') {
    applyExcessPreset(10, 90, 0);
  }
  await saveProposals();
  addToast({
    type: 'success',
    message: `Enacted "${proposal.title}" and synced policy to Appwrite Cloud!`,
  });
};

const removeRosterMember = async (idx: number) => {
  const removed = policyConfig.value.members.splice(idx, 1);
  await saveProposals();
  if (removed[0]) {
    addToast({ type: 'info', message: `Removed ${removed[0].name} from Co-op Roster.` });
  }
};

// Local state for active voting controls per proposal
const selectedSignal = ref<Record<string, LoomioSignal>>({});
const votingRationale = ref<Record<string, string>>({});

// Initial Seed Proposals representing authentic collective choices
const defaultProposals: CoopProposal[] = [
  {
    id: 'prop-surplus-policy',
    title: 'Adopt Partner Surplus Dividend When Monthly Commons Pool Exceeds Operating Costs',
    proposer: 'Mike (Core)',
    proposerPartner: 'HUCK',
    category: 'Policy & Membership',
    description: 'When the 30% Monthly Commons Pool exceeds actual Monthly Operating Costs (Booth Rent net of Consignor Share + Tech Ops + Supplies), keep 10% of the excess in the Collective Rainy-Day Reserve and distribute 90% of the excess back to Co-op Partners (HUCK- & PDXGL-) as a Bonus Surplus Dividend.',
    rationale: 'Ensures Operating Costs and 100% Cost Basis are always covered first while rewarding active Co-op Partners with real profit sharing whenever the booth beats monthly operating expenses.',
    financialImpact: 'Distributes 90% of Commons Surplus above Operating Costs to Partners (10% to Reserve)',
    deadline: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10),
    status: 'active',
    createdAt: new Date().toISOString(),
    votes: {
      'mike': { signal: 'agree', memberName: 'Mike (Core)', partner: 'HUCK', comment: 'Lets partners share directly in upside once booth rent and tech ops are paid.', votedAt: new Date().toISOString() }
    }
  },
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

onMounted(async () => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'rules' || tab === 'roster' || tab === 'proposals') {
      activeGovTab.value = tab;
    }
  }

  const tenantId = currentTeam.value?.$id || 'huck_collective';
  const { state, syncedFromCloud } = await loadCoopGovernanceState(defaultProposals, tenantId);
  proposals.value = state.proposals;
  activeSurplusPolicyMode.value = state.surplusPolicyMode;
  if (state.policyConfig) {
    policyConfig.value = state.policyConfig;
  }
  isCloudSynced.value = syncedFromCloud;

  if (user.value?.name) {
    const matched = policyConfig.value.members.find((m) =>
      m.name.toLowerCase().includes(user.value!.name.toLowerCase())
    );
    activeVotingMember.value = matched?.name || policyConfig.value.members[0]?.name || user.value.name;
    newProposal.value.proposer = activeVotingMember.value;
  } else if (policyConfig.value.members[0]) {
    activeVotingMember.value = policyConfig.value.members[0].name;
  }

  // Pre-fill active votes for current member
  initializeActiveSignals();
});

const saveProposals = async () => {
  isSavingCloud.value = true;
  try {
    const tenantId = currentTeam.value?.$id || 'huck_collective';
    const ok = await saveCoopGovernanceState(
      {
        proposals: proposals.value,
        surplusPolicyMode: activeSurplusPolicyMode.value,
        policyConfig: policyConfig.value,
      },
      tenantId
    );
    isCloudSynced.value = ok;
  } finally {
    isSavingCloud.value = false;
  }
};

const updateCloudSurplusPolicy = async (mode: SurplusPolicyMode) => {
  activeSurplusPolicyMode.value = mode;
  await saveProposals();
  addToast({
    type: 'success',
    message: `Active Co-op Surplus Policy updated in Appwrite Cloud (${mode === 'patronage_90_10' ? '90/10 Dividend' : mode === 'cap_100' ? '100% Over Ops' : '100% Reserve'})!`,
  });
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
