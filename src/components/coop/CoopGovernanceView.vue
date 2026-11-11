<template>
  <div class="space-y-5 pb-24">
    <!-- ===================================================== -->
    <!-- 1. /sales-STYLE COMPACT HEADER & 2-BUTTON ACTIONS     -->
    <!-- ===================================================== -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
      <div class="space-y-1">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="badge badge-primary badge-xs sm:badge-sm font-black">Loomio 4-Signal Consent</span>
          <span class="badge badge-outline badge-xs sm:badge-sm font-mono font-bold">1 Member = 1 Vote</span>
          <span
            class="badge badge-xs sm:badge-sm font-mono font-bold gap-1"
            :class="isCloudSynced ? 'badge-success badge-outline' : 'badge-ghost'"
            :title="isCloudSynced ? 'Synced live to resale_db.coop_proposals' : 'Local browser fallback'"
          >
            <Icon :icon="isCloudSynced ? 'solar:cloud-check-bold' : 'solar:cloud-storage-linear'" class="w-3.5 h-3.5" />
            <span>{{ isSavingCloud ? 'Syncing…' : isCloudSynced ? 'coop_proposals Live' : 'Local Cache' }}</span>
          </span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-base-content flex items-center gap-2.5">
          <Icon icon="solar:users-group-two-rounded-bold-duotone" class="w-7 h-7 text-primary shrink-0" />
          <span>Co-op Governance &amp; Proposals</span>
        </h1>
      </div>

      <!-- Right Action Pair: Secondary Dropdown + Primary Create CTA -->
      <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
        <div class="dropdown dropdown-end">
          <div tabindex="0" role="button" class="btn btn-sm btn-outline rounded-xl font-bold gap-1.5 h-10">
            <Icon icon="solar:book-bookmark-bold-duotone" class="w-4 h-4 text-primary" />
            <span>Docs &amp; Tools</span>
            <Icon icon="solar:alt-arrow-down-linear" class="w-3.5 h-3.5 opacity-60" />
          </div>
          <ul
            tabindex="0"
            class="dropdown-content menu z-50 mt-1.5 p-2 shadow-xl bg-base-100 border border-base-200 rounded-2xl w-64 space-y-1 text-xs"
          >
            <li>
              <button type="button" class="font-bold rounded-xl" @click="setGovTab('docs')">
                <Icon icon="solar:notebook-bookmark-bold-duotone" class="w-4 h-4 text-primary" />
                <span>📚 Strategy Docs ({{ strategyDocs.length }})</span>
              </button>
            </li>
            <li>
              <button type="button" class="font-bold rounded-xl" @click="openMessagesTray('list')">
                <Icon icon="solar:chat-round-dots-bold-duotone" class="w-4 h-4 text-info" />
                <span>💬 Messages &amp; Bugs ({{ messagesCount }})</span>
              </button>
            </li>
            <li>
              <button type="button" class="font-bold rounded-xl text-warning" @click="openMessagesTray('new_bug')">
                <Icon icon="solar:bug-bold-duotone" class="w-4 h-4 text-warning" />
                <span>🐞 Report UI Bug + Screenshot</span>
              </button>
            </li>
            <div class="divider my-0.5"></div>
            <li>
              <button type="button" class="font-bold rounded-xl" @click="exportProposalsCsv">
                <Icon icon="solar:file-download-bold" class="w-4 h-4 text-success" />
                <span>📥 Export Proposals CSV</span>
              </button>
            </li>
          </ul>
        </div>

        <button
          type="button"
          class="btn btn-sm btn-primary gap-1.5 rounded-xl font-black shadow-md shadow-primary/20 h-10 px-4"
          @click="openNewProposalDrawer()"
        >
          <Icon icon="solar:add-circle-bold" class="w-4 h-4 shrink-0" />
          <span>Create Proposal</span>
        </button>
      </div>
    </div>

    <JoinRequestsPanel />

    <!-- ===================================================== -->
    <!-- 2. 4 STANDALONE KPI CARDS (Canonical Ledger Pattern)  -->
    <!-- ===================================================== -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <button
        type="button"
        class="text-left bg-base-100 p-3.5 sm:p-4 rounded-2xl border border-base-200 shadow-xs flex items-center gap-3 hover:border-primary/40 transition-all cursor-pointer"
        @click="selectProposalFilter('active')"
      >
        <div class="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
          <Icon icon="solar:chat-round-dots-bold-duotone" class="w-5 h-5" />
        </div>
        <div class="min-w-0">
          <div class="text-[11px] uppercase font-bold opacity-60 truncate">Active Deliberations</div>
          <div class="text-lg sm:text-2xl font-black font-mono text-base-content">{{ activeProposalsCount }}</div>
        </div>
      </button>

      <button
        type="button"
        class="text-left bg-base-100 p-3.5 sm:p-4 rounded-2xl border border-base-200 shadow-xs flex items-center gap-3 hover:border-success/40 transition-all cursor-pointer"
        @click="selectProposalFilter('consensus')"
      >
        <div class="w-10 h-10 bg-success/10 text-success rounded-xl flex items-center justify-center shrink-0">
          <Icon icon="solar:check-circle-bold-duotone" class="w-5 h-5" />
        </div>
        <div class="min-w-0">
          <div class="text-[11px] uppercase font-bold opacity-60 truncate">Consensus Reached</div>
          <div class="text-lg sm:text-2xl font-black font-mono text-success">{{ consensusProposalsCount }}</div>
        </div>
      </button>

      <button
        type="button"
        class="text-left bg-base-100 p-3.5 sm:p-4 rounded-2xl border border-base-200 shadow-xs flex items-center gap-3 hover:border-error/40 transition-all cursor-pointer"
        @click="selectProposalFilter('blocked')"
      >
        <div class="w-10 h-10 bg-error/10 text-error rounded-xl flex items-center justify-center shrink-0">
          <Icon icon="solar:forbidden-circle-bold-duotone" class="w-5 h-5" />
        </div>
        <div class="min-w-0">
          <div class="text-[11px] uppercase font-bold opacity-60 truncate">Active Blocks</div>
          <div class="text-lg sm:text-2xl font-black font-mono text-error">{{ blockedProposalsCount }}</div>
        </div>
      </button>

      <button
        type="button"
        class="text-left bg-base-100 p-3.5 sm:p-4 rounded-2xl border border-base-200 shadow-xs flex items-center gap-3 hover:border-info/40 transition-all cursor-pointer"
        @click="setGovTab('docs')"
      >
        <div class="w-10 h-10 bg-info/10 text-info rounded-xl flex items-center justify-center shrink-0">
          <Icon icon="solar:notebook-bookmark-bold-duotone" class="w-5 h-5" />
        </div>
        <div class="min-w-0">
          <div class="text-[11px] uppercase font-bold opacity-60 truncate">Strategy Docs</div>
          <div class="text-lg sm:text-2xl font-black font-mono text-info">{{ strategyDocs.length }}</div>
        </div>
      </button>
    </div>

    <!-- ===================================================== -->
    <!-- 3. UNIFIED GLOBAL SCOPE BAR (/sales Archetype)        -->
    <!-- ===================================================== -->
    <div class="bg-base-100 border border-base-200 rounded-2xl p-3 sm:p-4 shadow-xs space-y-3">
      <!-- Top Row: 4-Tab Segmented Navigation + Inline Voter Selector -->
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-base-200/80 border border-base-300 rounded-xl flex-1">
          <button
            type="button"
            class="btn btn-xs sm:btn-sm h-9 rounded-lg font-bold gap-1.5"
            :class="activeGovTab === 'proposals' ? 'btn-primary shadow-2xs' : 'btn-ghost text-base-content/75'"
            @click="setGovTab('proposals')"
          >
            <span>🗳️ Proposals ({{ proposals.length }})</span>
          </button>
          <button
            type="button"
            class="btn btn-xs sm:btn-sm h-9 rounded-lg font-bold gap-1.5"
            :class="activeGovTab === 'rules' ? 'btn-primary shadow-2xs' : 'btn-ghost text-base-content/75'"
            @click="setGovTab('rules')"
          >
            <span>⚖️ Rules ({{ policyConfig.curatorSharePct }}/{{ policyConfig.commonsSharePct }})</span>
          </button>
          <button
            type="button"
            class="btn btn-xs sm:btn-sm h-9 rounded-lg font-bold gap-1.5"
            :class="activeGovTab === 'roster' ? 'btn-primary shadow-2xs' : 'btn-ghost text-base-content/75'"
            @click="setGovTab('roster')"
          >
            <span>👥 Roster ({{ policyConfig.members.length }})</span>
          </button>
          <button
            type="button"
            class="btn btn-xs sm:btn-sm h-9 rounded-lg font-bold gap-1.5"
            :class="activeGovTab === 'docs' ? 'btn-primary shadow-2xs' : 'btn-ghost text-base-content/75'"
            @click="setGovTab('docs')"
          >
            <span>📚 Docs ({{ strategyDocs.length }})</span>
          </button>
        </div>

        <!-- Inline Voter Persona Selector -->
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-xs font-extrabold uppercase tracking-wider opacity-65 whitespace-nowrap">
            👤 Voting As:
          </span>
          <select
            v-model="activeVotingMember"
            class="select select-bordered select-sm rounded-xl font-bold text-xs h-9 min-h-9 min-w-44"
          >
            <option v-for="m in policyConfig.members" :key="m.name" :value="m.name">
              {{ m.name }} — [{{ m.partner }}-]
            </option>
          </select>
        </div>
      </div>

      <!-- Second Row (Proposals Tab Only): Status Pills + Category + Search + Collapsible 4-Signal Guide -->
      <div v-if="activeGovTab === 'proposals'" class="space-y-2.5 pt-1 border-t border-base-200/80">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          <div class="flex items-center gap-1.5 flex-wrap">
            <button
              v-for="b in proposalBuckets"
              :key="b.id"
              type="button"
              class="btn btn-xs rounded-xl font-bold gap-1"
              :class="statusFilter === b.id ? 'btn-secondary' : 'btn-ghost bg-base-200/70'"
              @click="statusFilter = b.id"
            >
              <span>{{ b.label }}</span>
              <span class="badge badge-2xs font-mono">{{ b.items.length }}</span>
            </button>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <select
              v-model="categoryFilter"
              class="select select-bordered select-xs rounded-xl font-bold text-xs h-8 min-h-8"
            >
              <option value="all">All Categories</option>
              <option value="Policy & Membership">📜 Policy &amp; Membership</option>
              <option value="Software & Tech Commons">⚡ Software &amp; Tech</option>
              <option value="Booth & Physical Footprint">🏪 Booth &amp; Footprint</option>
              <option value="Inventory & Consignment">📦 Inventory &amp; Consignment</option>
              <option value="Hardware & Equipment">🏷️ Hardware &amp; Equipment</option>
            </select>

            <label class="input input-bordered input-xs rounded-xl flex items-center gap-1.5 h-8 min-w-44">
              <Icon icon="solar:magnifer-linear" class="w-3.5 h-3.5 opacity-60" />
              <input
                v-model="searchQuery"
                type="search"
                placeholder="Search proposals…"
                class="grow text-xs"
              />
            </label>
          </div>
        </div>

        <!-- Tucked 1-Line Collapsible Loomio 4-Signal Explainer (Zero Above-the-Fold Pushdown) -->
        <details class="group rounded-xl bg-base-200/50 border border-base-300/70 px-3 py-2 text-xs">
          <summary class="cursor-pointer list-none flex items-center justify-between font-bold text-base-content/75">
            <span class="flex items-center gap-2 flex-wrap">
              <Icon icon="solar:info-circle-bold" class="w-4 h-4 text-primary shrink-0" />
              <span>How 4-Signal Loomio Consent Works:</span>
              <span class="font-normal opacity-80">🟢 Agree • 🟡 Abstain • 🟠 Disagree • 🔴 Block (Veto)</span>
            </span>
            <span class="text-[11px] text-primary font-bold group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2.5 mt-2 border-t border-base-300/60">
            <div class="p-2.5 rounded-xl bg-success/10 border border-success/20">
              <div class="font-black text-success">🟢 AGREE</div>
              <p class="text-[11px] opacity-80 mt-0.5">"I support this proposal and want to proceed." Counts toward consensus ({{ policyConfig.minAgreeVotes }}+ needed).</p>
            </div>
            <div class="p-2.5 rounded-xl bg-warning/10 border border-warning/20">
              <div class="font-black text-warning">🟡 ABSTAIN</div>
              <p class="text-[11px] opacity-80 mt-0.5">"I trust the group's decision." Neutral signal; does not block progress.</p>
            </div>
            <div class="p-2.5 rounded-xl bg-secondary/10 border border-secondary/20">
              <div class="font-black text-secondary">🟠 DISAGREE</div>
              <p class="text-[11px] opacity-80 mt-0.5">"I have reservations or ideas, but won't block." Logged on the vote roll.</p>
            </div>
            <div class="p-2.5 rounded-xl bg-error/10 border border-error/20">
              <div class="font-black text-error">🔴 BLOCK (VETO)</div>
              <p class="text-[11px] opacity-80 mt-0.5">"Violates our charter or endangers solvency." Pauses enactment for amendment.</p>
            </div>
          </div>
        </details>
      </div>
    </div>

    <!-- ===================================================== -->
    <!-- TAB 1: PROPOSALS GRID (Clean MD Excerpts + Thumbs)    -->
    <!-- ===================================================== -->
    <div v-show="activeGovTab === 'proposals'" class="space-y-4">
      <div
        v-if="filteredProposals.length === 0"
        class="rounded-3xl border border-dashed border-base-300 bg-base-100 p-10 text-center space-y-2"
      >
        <div class="text-2xl">🗳️</div>
        <div class="font-black text-sm">No matching proposals</div>
        <p class="text-xs opacity-65">Clear your search/filter above or publish a new proposal.</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        <button
          v-for="p in filteredProposals"
          :key="`row-${p.id}`"
          type="button"
          class="text-left card bg-base-100 border shadow-xs rounded-2xl p-4 hover:shadow-md hover:border-primary/50 transition-all flex flex-col justify-between gap-3 h-full cursor-pointer"
          :class="getProposalCardBorderClass(p)"
          @click="openProposalDrawer(p)"
        >
          <div class="space-y-2 min-w-0">
            <div class="flex items-center justify-between gap-1.5 flex-wrap">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="badge badge-xs font-semibold" :class="getCategoryBadgeClass(p.category)">{{ p.category }}</span>
                <span v-if="canEditProposalCard(p)" class="badge badge-ghost badge-2xs font-bold" title="You can unlock & edit this proposal">
                  ✏️ Yours
                </span>
              </div>
              <span class="px-2 py-0.5 rounded-lg font-black text-[10px] flex items-center gap-1 shrink-0" :class="getStatusPillClass(p)">
                <Icon :icon="getStatusPillIcon(p)" class="w-3 h-3 shrink-0" />
                <span>{{ p.status === 'passed' ? 'Enacted' : getProposalStatusLabel(p) }}</span>
              </span>
            </div>

            <div class="flex items-start gap-3">
              <div class="min-w-0 flex-1 space-y-1">
                <div class="text-sm font-black leading-snug line-clamp-2 break-words text-base-content">
                  {{ cleanEscapedCurrency(p.title) }}
                </div>
                <p class="text-xs text-base-content/70 line-clamp-2 leading-relaxed">
                  {{ stripMarkdownExcerpt(p.description, 130) }}
                </p>
              </div>
              <div
                v-if="proposalCoverThumb(p)"
                class="w-14 h-14 rounded-xl overflow-hidden border border-base-300 bg-base-200 shrink-0"
              >
                <img
                  :src="proposalCoverThumb(p)"
                  referrerpolicy="no-referrer"
                  alt="Proposal cover"
                  class="w-full h-full object-cover"
                />
              </div>
            </div>

            <div class="text-[10px] text-base-content/55 font-mono flex items-center justify-between gap-2">
              <span>Closing {{ p.deadline }} · {{ p.proposer }}</span>
              <span v-if="p.galleryImageIds && p.galleryImageIds.length > 0" class="font-bold text-primary">
                📷 {{ p.galleryImageIds.length }}
              </span>
            </div>
          </div>

          <div class="space-y-1.5 pt-2 border-t border-base-200/70">
            <div class="w-full h-1.5 rounded-full bg-base-300 overflow-hidden flex">
              <div class="bg-success" :style="{ width: `${getSignalPercent(p, 'agree')}%` }"></div>
              <div class="bg-warning" :style="{ width: `${getSignalPercent(p, 'abstain')}%` }"></div>
              <div class="bg-secondary" :style="{ width: `${getSignalPercent(p, 'disagree')}%` }"></div>
              <div class="bg-error" :style="{ width: `${getSignalPercent(p, 'block')}%` }"></div>
            </div>
            <div class="flex items-center justify-between gap-2 text-[11px]">
              <span class="text-base-content/70 font-semibold truncate">
                {{ getVoteCount(p) }} vote{{ getVoteCount(p) === 1 ? '' : 's' }} ·
                <strong class="capitalize">{{ getUserVote(p)?.signal || 'not voted' }}</strong>
              </span>
              <span class="font-black text-primary shrink-0">Inspect &amp; Vote →</span>
            </div>
          </div>
        </button>
      </div>
    </div>

    <!-- ===================================================== -->
    <!-- TAB 4: ASTRO 6 NATIVE STRATEGY DOCS LIBRARY           -->
    <!-- ===================================================== -->
    <div v-if="activeGovTab === 'docs'" class="space-y-4">
      <div class="card bg-base-100 border border-base-300 rounded-3xl p-5 sm:p-7 space-y-5 shadow-xs">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-base-200 pb-4">
          <div>
            <span class="badge badge-info badge-sm font-black">Astro 6 Content Collection</span>
            <h3 class="text-xl font-black text-base-content mt-1">
              Co-op Charter &amp; Strategy Markdown Library
            </h3>
            <p class="text-xs text-base-content/70 mt-0.5">
              Canonical strategy documents rendered cleanly with GitHub-Flavored Markdown tables, print-to-PDF support, and 1-click proposal drafting.
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            v-for="doc in strategyDocs"
            :key="doc.slug"
            class="rounded-2xl border border-base-300 bg-base-200/30 hover:border-primary/50 transition-all p-5 flex flex-col justify-between gap-4"
          >
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <span class="badge badge-primary badge-xs font-bold">{{ doc.category }}</span>
                <span class="text-[11px] font-mono opacity-60">Updated {{ doc.updatedDate }}</span>
              </div>
              <h4 class="text-base font-black text-base-content leading-snug">
                {{ doc.title }}
              </h4>
              <p class="text-xs text-base-content/75 leading-relaxed">
                {{ doc.summary }}
              </p>
              <div class="flex flex-wrap gap-1 pt-1">
                <span
                  v-for="hat in doc.hatTags"
                  :key="hat"
                  class="badge badge-outline badge-2xs font-semibold"
                >
                  {{ hat }}
                </span>
              </div>
            </div>

            <div class="flex items-center justify-between gap-2 pt-3 border-t border-base-300/70">
              <button
                type="button"
                class="btn btn-xs btn-ghost rounded-xl font-bold text-secondary gap-1"
                @click="draftProposalFromStrategyDoc(doc)"
              >
                <Icon icon="solar:magic-stick-3-bold" class="w-3.5 h-3.5" />
                <span>✨ Draft Motion</span>
              </button>
              <a
                :href="`/coop/docs/${doc.slug}`"
                class="btn btn-xs sm:btn-sm btn-primary rounded-xl font-black gap-1"
              >
                <span>Read Formatted Doc →</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ===================================================== -->
    <!-- TAB 2: CONFIGURABLE CO-OP RULES & 3-WAY WSDE SLIDERS  -->
    <!-- ===================================================== -->
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
          :disabled="isSavingCloud"
          class="btn btn-primary btn-sm h-10 px-5 rounded-xl font-black gap-2 shadow-sm shrink-0"
          @click="savePolicyConfigToCloud"
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
            v-model.number="policyConfig.curatorSharePct"
            type="range"
            min="50"
            max="90"
            step="5"
            class="range range-primary range-sm"
            @input="onCuratorShareChange"
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
              <button type="button" class="btn btn-xs rounded-lg font-mono" :class="policyConfig.salesPatronagePct === 60 && policyConfig.laborPatronagePct === 30 ? 'btn-secondary' : 'btn-ghost border border-base-300'" @click="applyExcessPreset(10, 60, 30)">10/60/30 WSDE</button>
              <button type="button" class="btn btn-xs rounded-lg font-mono" :class="policyConfig.salesPatronagePct === 45 && policyConfig.laborPatronagePct === 45 ? 'btn-accent' : 'btn-ghost border border-base-300'" title="Mondragon 10% Coordination Reserve / 45% Sales & Enterprise / 45% Member Labor & ICA" @click="applyExcessPreset(10, 45, 45)">10/45/45 Mondragon</button>
              <button type="button" class="btn btn-xs rounded-lg font-mono" :class="policyConfig.salesPatronagePct === 90 ? 'btn-primary' : 'btn-ghost border border-base-300'" @click="applyExcessPreset(10, 90, 0)">10/90/0 Sales</button>
            </div>
          </div>

          <div class="space-y-3">
            <div>
              <div class="flex justify-between text-xs font-bold mb-1">
                <span>🛡️ Rainy-Day Reserve Slice</span>
                <span class="font-mono text-info">{{ policyConfig.reserveSharePct }}%</span>
              </div>
              <input v-model.number="policyConfig.reserveSharePct" type="range" min="0" max="50" step="5" class="range range-xs range-info" @input="rebalanceExcessSliders('reserve')" />
            </div>

            <div>
              <div class="flex justify-between text-xs font-bold mb-1">
                <span>📊 Partner Sales Patronage Dividend</span>
                <span class="font-mono text-success">{{ policyConfig.salesPatronagePct }}%</span>
              </div>
              <input v-model.number="policyConfig.salesPatronagePct" type="range" min="0" max="100" step="5" class="range range-xs range-success" @input="rebalanceExcessSliders('sales')" />
            </div>

            <div>
              <div class="flex justify-between text-xs font-bold mb-1">
                <span>⏱️ Sweat-Equity Enabling Labor Dividend (<a href="/coop/labor" class="link link-secondary">logged hours</a>)</span>
                <span class="font-mono text-secondary">{{ policyConfig.laborPatronagePct }}%</span>
              </div>
              <input v-model.number="policyConfig.laborPatronagePct" type="range" min="0" max="100" step="5" class="range range-xs range-secondary" @input="rebalanceExcessSliders('labor')" />
            </div>
          </div>
        </div>
      </div>

      <!-- Dials 3, 4, 5, 6 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="p-4 rounded-2xl bg-base-200/40 border border-base-300 space-y-1.5">
          <label class="text-xs font-extrabold uppercase tracking-wider text-base-content/60">Dial 3 • Rainy-Day Reserve Cap ($)</label>
          <input v-model.number="policyConfig.reserveCapTarget" type="number" min="0" step="50" class="input input-bordered input-sm rounded-xl font-mono font-bold w-full" />
          <p class="text-[11px] text-base-content/60">Once Reserve reaches ${{ policyConfig.reserveCapTarget }}, the {{ policyConfig.reserveSharePct }}% slice overflows to Partner Dividends.</p>
        </div>

        <div class="p-4 rounded-2xl bg-base-200/40 border border-base-300 space-y-1.5">
          <label class="text-xs font-extrabold uppercase tracking-wider text-warning">Dial 4 • Prior Shortfall Carryover ($)</label>
          <input v-model.number="policyConfig.carriedOverShortfall" type="number" min="0" step="10" class="input input-bordered input-sm rounded-xl font-mono font-bold w-full" />
          <p class="text-[11px] text-base-content/60">Prior deficit repaid 100% first in Gate 4A before Gate 4B bonus dividends unlock.</p>
        </div>

        <div class="p-4 rounded-2xl bg-base-200/40 border border-base-300 space-y-1.5">
          <label class="text-xs font-extrabold uppercase tracking-wider text-base-content/60">Dial 5 • Consensus Quorum (Agree Votes)</label>
          <input v-model.number="policyConfig.minAgreeVotes" type="number" min="1" max="10" step="1" class="input input-bordered input-sm rounded-xl font-mono font-bold w-full" />
          <p class="text-[11px] text-base-content/60">Minimum Agree signals (with 0 Blocks) required to pass a proposal.</p>
        </div>

        <div class="p-4 rounded-2xl bg-base-200/40 border border-base-300 space-y-1.5">
          <label class="text-xs font-extrabold uppercase tracking-wider text-base-content/60">Dial 6 • Orphan Ticket Window (Days)</label>
          <input v-model.number="policyConfig.orphanClaimWindowDays" type="number" min="7" max="90" step="1" class="input input-bordered input-sm rounded-xl font-mono font-bold w-full" />
          <p class="text-[11px] text-base-content/60">Days before an unlinked register ticket can be swept 100% to Commons Pool.</p>
        </div>
      </div>

      <!-- Consignor Agreements -->
      <div class="p-4 sm:p-5 rounded-2xl bg-base-200/40 border border-base-300 space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div class="text-xs font-extrabold uppercase tracking-wider text-secondary">Consignor Agreements</div>
            <div class="text-sm font-black text-base-content">Straight Consignment Deals (applied on /coop/settlements)</div>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <input v-model="newConsignor.prefix" type="text" placeholder="PREFIX (e.g. CON)" class="input input-bordered input-sm rounded-xl font-mono text-xs w-32" />
            <input v-model="newConsignor.displayName" type="text" placeholder="Display name" class="input input-bordered input-sm rounded-xl text-xs w-40" />
            <button type="button" class="btn btn-sm btn-secondary rounded-xl font-bold" @click="addConsignor">+ Add Straight Consignor</button>
          </div>
        </div>

        <div v-if="policyConfig.consignors.length === 0" class="text-xs text-base-content/60">No consignors configured yet.</div>

        <div v-for="(c, idx) in policyConfig.consignors" :key="c.prefix" class="p-4 rounded-2xl bg-base-100 border border-base-300 space-y-3">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="flex items-center gap-2">
              <span class="badge badge-sm badge-warning font-mono font-bold">{{ c.prefix }}</span>
              <span class="font-black text-sm">{{ c.displayName }}</span>
            </div>
            <button type="button" class="btn btn-ghost btn-xs text-error" @click="removeConsignor(idx)">Remove</button>
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
                <input v-model.number="c.coopCommissionPct" type="range" min="0" max="60" step="1" class="range range-secondary range-xs flex-1" />
                <input v-model.number="c.coopCommissionPct" type="number" min="0" max="60" step="1" class="input input-bordered input-xs w-14 font-mono font-bold text-right" />
              </div>
              <div class="flex items-center gap-1 flex-wrap mt-1">
                <button
                  v-for="pct in [10, 15, 20, 25, 30, 50]"
                  :key="pct"
                  type="button"
                  class="btn btn-xs h-5 min-h-0 px-1.5 rounded font-mono text-[10px]"
                  :class="c.coopCommissionPct === pct && c.mode === 'flat_commission' ? 'btn-secondary' : 'btn-ghost border border-base-300'"
                  @click="c.coopCommissionPct = pct; c.mode = 'flat_commission'"
                >
                  {{ pct }}%
                </button>
              </div>
            </div>

            <div class="form-control">
              <label class="label py-1"><span class="label-text font-bold text-xs">🏪 Fixed Shelf Rent ($/mo)</span></label>
              <input v-model.number="c.fixedMonthlyRent" type="number" min="0" step="5" class="input input-bordered input-sm rounded-xl font-mono font-bold" />
            </div>
          </div>

          <label class="label cursor-pointer justify-start gap-2 py-0">
            <input v-model="c.capRentAtNetSales" type="checkbox" class="checkbox checkbox-sm checkbox-primary" />
            <span class="label-text text-xs font-bold">Never let rent push payout below $0</span>
          </label>
        </div>
      </div>
    </div>

    <!-- ===================================================== -->
    <!-- TAB 3: PARTNER & VOTER ROSTER REGISTRY                -->
    <!-- ===================================================== -->
    <div v-if="activeGovTab === 'roster'" class="card bg-base-100 border border-base-300 shadow-sm rounded-3xl p-5 sm:p-7 space-y-5">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 class="text-xl font-black text-base-content">Co-op Partner, Skill Partner &amp; Voter Roster</h3>
          <p class="text-xs text-base-content/70">Manage eligible Loomio voters, Curator Partners (HUCK-, PDXGL-), Promoters &amp; Surplus Enablers (SWEAT- — $0 inventory required), and Consignors (BB-).</p>
        </div>
        <div class="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <input v-model="newRosterMember.name" type="text" placeholder="Member Name (e.g. Alex)" class="input input-bordered input-sm rounded-xl text-xs" />
          <select v-model="newRosterMember.partner" class="select select-bordered select-sm rounded-xl font-mono font-bold text-xs">
            <option value="HUCK">HUCK- (Curator)</option>
            <option value="PDXGL">PDXGL- (Curator)</option>
            <option value="SWEAT">SWEAT- (Skill / Floor Partner)</option>
            <option value="BB">BB- (Consignor)</option>
          </select>
          <button type="button" class="btn btn-sm btn-primary rounded-xl font-bold" @click="addRosterMember">+ Add Member</button>
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
                <button v-if="policyConfig.members.length > 1" type="button" class="btn btn-ghost btn-xs text-error" @click="removeRosterMember(idx)">
                  Remove
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ===================================================== -->
    <!-- PROPOSAL DELIBERATION & LOCKED/UNLOCKED MD DRAWER     -->
    <!-- ===================================================== -->
    <SlideOverDrawer
      v-model="proposalDrawerOpen"
      size="lg"
      :title="cleanEscapedCurrency(selectedProposal?.title || 'Proposal')"
      subtitle="Formatted Markdown specification, photos & 4-Signal consent vote"
    >
      <CoopProposalInspector
        v-if="selectedProposal"
        :proposal="selectedProposal"
        :active-voting-member="activeVotingMember"
        :member-key="getMemberKey()"
        :min-agree-votes="policyConfig.minAgreeVotes || 2"
        :can-edit="canEditProposalCard(selectedProposal)"
        :can-upload-photos="isAuthenticated"
        :surplus-policy-mode="activeSurplusPolicyMode"
        @vote="handleInspectorVote"
        @save-edit="handleInspectorSaveEdit"
        @delete="handleInspectorDelete"
        @enact="enactConsensusProposal"
        @update-surplus-mode="updateCloudSurplusPolicy"
      />
    </SlideOverDrawer>

    <!-- ===================================================== -->
    <!-- CREATE NEW PROPOSAL DRAWER (Markdown + AI + Photos)   -->
    <!-- ===================================================== -->
    <SlideOverDrawer
      v-model="isNewProposalModalOpen"
      size="lg"
      title="Create Collective Proposal"
      subtitle="Draft in Markdown with AI Helper & optional reference photos"
    >
      <form class="space-y-4 text-xs" @submit.prevent="createProposal">
        <!-- Quick AI Draft Bar -->
        <div class="rounded-2xl border border-secondary/35 bg-secondary/5 p-3.5 space-y-2.5">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <span class="font-black text-secondary flex items-center gap-1.5">
              <Icon icon="solar:magic-stick-3-bold-duotone" class="w-4 h-4" />
              <span>✨ AI Proposal Drafter &amp; Markdown Formatter</span>
            </span>
            <span class="badge badge-secondary badge-outline badge-2xs font-mono">70/30 WSDE Aware</span>
          </div>
          <textarea
            v-model="aiRoughPrompt"
            rows="2"
            class="textarea textarea-bordered textarea-xs w-full rounded-xl text-xs bg-base-100"
            placeholder="Optional: Jotted rough idea or bullets (e.g. 'Pitch Tier 2 25-pt QR lookbook cards for Memory Den booth #0EJ at $18 print cost')..."
          ></textarea>
          <div class="flex items-center justify-end gap-1.5 flex-wrap">
            <button
              v-if="newProposal.description.trim()"
              type="button"
              class="btn btn-xs btn-outline btn-secondary rounded-xl font-bold"
              :disabled="creatingAiDraft"
              @click="runCreateAiHelper('format_md')"
            >
              🪄 Format Current Text as MD
            </button>
            <button
              type="button"
              class="btn btn-xs btn-secondary rounded-xl font-black gap-1"
              :disabled="creatingAiDraft || (!aiRoughPrompt.trim() && !newProposal.description.trim() && !newProposal.title.trim())"
              @click="runCreateAiHelper('draft_proposal')"
            >
              <Icon icon="solar:stars-bold" class="w-3.5 h-3.5" />
              <span>{{ creatingAiDraft ? 'Drafting MD…' : '✨ AI Help Define & Format MD' }}</span>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="form-control">
            <label class="label py-1"><span class="label-text font-bold">Proposer Name *</span></label>
            <input
              v-model="newProposal.proposer"
              type="text"
              placeholder="e.g. Mike (HUCK)"
              class="input input-bordered input-sm rounded-xl font-medium"
              required
            />
          </div>
          <div class="form-control">
            <label class="label py-1"><span class="label-text font-bold">Partner Prefix</span></label>
            <select v-model="newProposal.proposerPartner" class="select select-bordered select-sm rounded-xl font-bold font-mono">
              <option value="HUCK">HUCK (Huckleberry Collective)</option>
              <option value="PDXGL">PDXGL (PDX Game Library)</option>
              <option value="SWEAT">SWEAT (Promoter / Enabler)</option>
              <option value="SHARED">SHARED (All Commons)</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="form-control">
            <label class="label py-1"><span class="label-text font-bold">Category *</span></label>
            <select v-model="newProposal.category" class="select select-bordered select-sm rounded-xl font-bold" required>
              <option value="Booth & Physical Footprint">🏪 Booth &amp; Physical Footprint</option>
              <option value="Inventory & Consignment">📦 Inventory &amp; Consignment</option>
              <option value="Hardware & Equipment">🏷️ Hardware &amp; Equipment</option>
              <option value="Software & Tech Commons">⚡ Software &amp; Tech Commons</option>
              <option value="Policy & Membership">📜 Policy &amp; Membership</option>
            </select>
          </div>

          <div class="form-control">
            <label class="label py-1"><span class="label-text font-bold">Deliberation Closing *</span></label>
            <input
              v-model="newProposal.deadline"
              type="date"
              class="input input-bordered input-sm rounded-xl font-mono text-xs"
              required
            />
          </div>
        </div>

        <div class="form-control">
          <label class="label py-1"><span class="label-text font-bold">Proposal Title *</span></label>
          <input
            v-model="newProposal.title"
            type="text"
            placeholder="e.g. Expand Memory Den Booth 0EJ Second Shelf Tier"
            class="input input-bordered input-sm rounded-xl font-bold text-sm"
            required
          />
        </div>

        <div class="form-control">
          <label class="label py-1"><span class="label-text font-bold">Financial / Patronage Impact (1-Line Summary)</span></label>
          <input
            v-model="newProposal.financialImpact"
            type="text"
            placeholder="e.g. $45 from Commons Pool or Tier 2 (25 pts) Sweat Equity"
            class="input input-bordered input-sm rounded-xl text-xs"
          />
        </div>

        <MarkdownMediaComposer
          v-model="newProposal.description"
          :locked="false"
          label="Proposal Specification & Action Plan * (Markdown)"
          :rows="7"
          :existing-images="newProposalExistingImages"
          :new-photos="newProposalPhotos"
          :can-upload-photos="isAuthenticated"
          :max-photos="8"
          photo-title="Attach Booth Photos, Mockups or Receipts (Optional)"
          @update:existing-images="newProposalExistingImages = $event"
          @update:new-photos="newProposalPhotos = $event"
        />

        <div class="form-control">
          <label class="label py-1"><span class="label-text font-bold">Benefit to the Collective (WSDE Rationale) *</span></label>
          <textarea
            v-model="newProposal.rationale"
            placeholder="Why does this improve booth velocity, protect cash reserves, or grow shared 70/30 surplus?"
            class="textarea textarea-bordered rounded-xl font-mono text-xs h-20"
            required
          ></textarea>
        </div>

        <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-base-200">
          <button type="button" class="btn btn-sm btn-ghost rounded-xl" @click="isNewProposalModalOpen = false">
            Cancel
          </button>
          <button
            type="submit"
            :disabled="publishingProposal"
            class="btn btn-sm btn-primary rounded-xl font-black px-5 gap-1.5"
          >
            <Icon icon="solar:lock-keyhole-bold" class="w-4 h-4" />
            <span>{{ publishingProposal ? 'Publishing…' : 'Lock MD & Publish for Voting' }}</span>
          </button>
        </div>
      </form>
    </SlideOverDrawer>

    <!-- ===================================================== -->
    <!-- THUMB-ZONE BOTTOM ACTION DOCK (+ Bottom-Sheet Tray)   -->
    <!-- ===================================================== -->
    <BottomActionDock placement="viewport">
      <template #left>
        <div class="hidden sm:flex items-center gap-1.5 text-xs">
          <span class="font-bold opacity-70">Queue:</span>
          <button
            type="button"
            class="btn btn-2xs rounded-lg font-bold"
            :class="statusFilter === 'active' ? 'btn-primary' : 'btn-ghost'"
            @click="selectProposalFilter('active')"
          >
            Active ({{ activeProposalsCount }})
          </button>
          <button
            type="button"
            class="btn btn-2xs rounded-lg font-bold"
            :class="statusFilter === 'consensus' ? 'btn-success' : 'btn-ghost'"
            @click="selectProposalFilter('consensus')"
          >
            Consensus ({{ consensusProposalsCount }})
          </button>
        </div>
      </template>

      <template #right>
        <button
          type="button"
          class="btn btn-xs sm:btn-sm btn-outline rounded-xl font-bold gap-1.5"
          title="Slide up the Co-op Messages & Bug Reports tray"
          @click="openMessagesTray('list')"
        >
          <Icon icon="solar:chat-round-dots-bold-duotone" class="w-4 h-4 text-info" />
          <span>Messages &amp; Bugs</span>
          <span v-if="messagesCount > 0" class="badge badge-info badge-2xs font-mono font-bold">{{ messagesCount }}</span>
        </button>

        <button
          type="button"
          class="btn btn-xs sm:btn-sm btn-outline border-warning/60 text-warning rounded-xl font-bold gap-1"
          title="Snap or paste a screenshot to report a UI bug"
          @click="openMessagesTray('new_bug')"
        >
          <Icon icon="solar:bug-bold-duotone" class="w-4 h-4" />
          <span class="hidden xs:inline">Report Bug</span>
        </button>

        <button
          type="button"
          class="btn btn-xs sm:btn-sm btn-primary rounded-xl font-black gap-1 px-3 shadow-sm"
          @click="openNewProposalDrawer()"
        >
          <Icon icon="solar:add-circle-bold" class="w-4 h-4" />
          <span>New Proposal</span>
        </button>
      </template>
    </BottomActionDock>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Icon } from '@iconify/vue';
import { addToast } from '../../stores/toast';
import { useAuth } from '../../composables/useAuth';
import JoinRequestsPanel from './JoinRequestsPanel.vue';
import CoopProposalInspector from './CoopProposalInspector.vue';
import SlideOverDrawer from '../common/SlideOverDrawer.vue';
import BottomActionDock from '../common/BottomActionDock.vue';
import MarkdownMediaComposer from '../common/MarkdownMediaComposer.vue';
import { cleanEscapedCurrency, stripMarkdownExcerpt } from '../../lib/safeMarkdown';
import { getCoopMediaUrl, uploadCoopMediaFiles, syncProposalMarkdownSnapshot } from '../../lib/coopMedia';
import {
  loadCoopGovernanceState,
  saveCoopGovernanceState,
  saveSingleCoopProposal,
  deleteCoopProposal,
  canUserEditProposal,
  DEFAULT_COOP_POLICY_CONFIG,
  CONSIGNOR_DEAL_MODE_LABELS,
  type LoomioSignal,
  type CoopProposal,
  type SurplusPolicyMode,
  type CoopPolicyConfig,
} from '../../lib/coopGovernance';

export interface StrategyDocItem {
  slug: string;
  title: string;
  summary: string;
  category: string;
  updatedDate: string;
  hatTags: string[];
  bodyPreview?: string;
}

const props = withDefaults(
  defineProps<{
    strategyDocs?: StrategyDocItem[];
    initialProposalId?: string;
  }>(),
  {
    strategyDocs: () => [],
    initialProposalId: '',
  }
);

const { user, isAuthenticated, currentTeam, ownedTeam } = useAuth();

type GovTab = 'proposals' | 'rules' | 'roster' | 'docs';
type ProposalBucket = 'all' | 'active' | 'consensus' | 'blocked';

const activeGovTab = ref<GovTab>('proposals');
const statusFilter = ref<ProposalBucket>('all');
const categoryFilter = ref<string>('all');
const searchQuery = ref('');

const activeVotingMember = ref(DEFAULT_COOP_POLICY_CONFIG.members[0]?.name || 'Mike (HUCK)');
const isNewProposalModalOpen = ref(false);
const selectedProposalId = ref('');
const messagesCount = ref(0);

const isCloudSynced = ref(false);
const isSavingCloud = ref(false);
const publishingProposal = ref(false);
const creatingAiDraft = ref(false);
const aiRoughPrompt = ref('');

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

const defaultProposals: CoopProposal[] = [
  {
    id: 'prop-surplus-policy',
    title: 'Adopt Partner Surplus Dividend When Monthly Commons Pool Exceeds Operating Costs',
    proposer: 'Mike (Core)',
    proposerPartner: 'HUCK',
    category: 'Policy & Membership',
    description:
      'When the 30% Monthly Commons Pool exceeds actual Monthly Operating Costs (Booth Rent net of Consignor Share + Tech Ops + Supplies), keep 10% of the excess in the Collective Rainy-Day Reserve and distribute 90% of the excess back to Co-op Partners (HUCK- & PDXGL-) as a Bonus Surplus Dividend.',
    rationale:
      'Ensures Operating Costs and 100% Cost Basis are always covered first while rewarding active Co-op Partners with real profit sharing whenever the booth beats monthly operating expenses.',
    financialImpact: 'Distributes 90% of Commons Surplus above Operating Costs to Partners (10% to Reserve)',
    deadline: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10),
    status: 'active',
    createdAt: new Date().toISOString().slice(0, 10),
    votes: {
      mike: {
        signal: 'agree',
        memberName: 'Mike (Core)',
        partner: 'HUCK',
        comment: 'Lets partners share directly in upside once booth rent and tech ops are paid.',
        votedAt: new Date().toISOString(),
      },
    },
  },
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
  proposer: 'Mike (HUCK)',
  proposerPartner: 'HUCK',
  category: 'Policy & Membership',
  description: '',
  rationale: '',
  financialImpact: '',
  deadline: new Date(Date.now() + 86400000 * 14).toISOString().slice(0, 10),
});

const newProposalExistingImages = ref<string[]>([]);
const newProposalPhotos = ref<any[]>([]);

const isStewardOrFounder = computed(() => {
  if (ownedTeam.value) return true;
  const activeRoster = policyConfig.value.members.find((m) => m.name === activeVotingMember.value);
  if (activeRoster?.hats?.includes('founder')) return true;
  return /mike|tyler/i.test(user.value?.name || '');
});

function canEditProposalCard(p: CoopProposal): boolean {
  return canUserEditProposal(p, {
    userId: user.value?.$id,
    userEmail: user.value?.email,
    userName: user.value?.name,
    activeVotingMember: activeVotingMember.value,
    isSteward: isStewardOrFounder.value,
  });
}

function proposalCoverThumb(p: CoopProposal): string {
  const firstId = p.imageId || p.galleryImageIds?.[0];
  if (!firstId || firstId.startsWith('data:')) return '';
  return getCoopMediaUrl(firstId, { preview: true, width: 200, height: 200, quality: 80 });
}

const selectedProposal = computed(
  () => proposals.value.find((p) => p.id === selectedProposalId.value) || null
);

const proposalDrawerOpen = computed({
  get: () => Boolean(selectedProposal.value),
  set: (open: boolean) => {
    if (!open) {
      selectedProposalId.value = '';
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/coop/governance/')) {
        window.history.replaceState({}, '', '/coop/governance');
      }
    }
  },
});

const activeProposalsCount = computed(() => proposals.value.filter((p) => !hasBlock(p)).length);
const consensusProposalsCount = computed(
  () => proposals.value.filter((p) => !hasBlock(p) && getSignalCount(p, 'agree') >= (policyConfig.value.minAgreeVotes || 2)).length
);
const blockedProposalsCount = computed(() => proposals.value.filter((p) => hasBlock(p)).length);

const proposalBuckets = computed(() => [
  { id: 'all' as ProposalBucket, label: 'All', items: proposals.value },
  { id: 'active' as ProposalBucket, label: 'Active', items: proposals.value.filter((p) => !hasBlock(p)) },
  {
    id: 'consensus' as ProposalBucket,
    label: 'Consensus',
    items: proposals.value.filter((p) => !hasBlock(p) && getSignalCount(p, 'agree') >= (policyConfig.value.minAgreeVotes || 2)),
  },
  { id: 'blocked' as ProposalBucket, label: 'Blocked', items: proposals.value.filter((p) => hasBlock(p)) },
]);

const filteredProposals = computed(() => {
  const bucket = proposalBuckets.value.find((b) => b.id === statusFilter.value)?.items || proposals.value;
  const q = searchQuery.value.trim().toLowerCase();
  return bucket.filter((p) => {
    if (categoryFilter.value !== 'all' && p.category !== categoryFilter.value) return false;
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.proposer.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  });
});

function selectProposalFilter(filter: ProposalBucket) {
  activeGovTab.value = 'proposals';
  statusFilter.value = filter;
}

function openProposalDrawer(p: { id: string }) {
  selectedProposalId.value = p.id;
}

function openNewProposalDrawer(prefill?: { title?: string; roughNotes?: string }) {
  if (prefill?.title) newProposal.value.title = prefill.title;
  if (prefill?.roughNotes) aiRoughPrompt.value = prefill.roughNotes;
  isNewProposalModalOpen.value = true;
}

function draftProposalFromStrategyDoc(doc: StrategyDocItem) {
  openNewProposalDrawer({
    title: `Motion: ${doc.title}`,
    roughNotes: `Draft a concrete governance motion from "${doc.title}": ${doc.summary}\n\n${doc.bodyPreview || ''}`,
  });
}

function openMessagesTray(mode: 'list' | 'new_bug' | 'new_message' = 'list') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('open-coop-messages-tray', { detail: { mode } }));
  }
}

function onMessagesUpdated(ev: Event) {
  const detail = (ev as CustomEvent)?.detail;
  if (typeof detail?.total === 'number') {
    messagesCount.value = detail.total;
  }
}

const setGovTab = (tab: GovTab) => {
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

onMounted(async () => {
  if (typeof window !== 'undefined') {
    window.addEventListener('coop-messages-updated', onMessagesUpdated as EventListener);
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'rules' || tab === 'roster' || tab === 'proposals' || tab === 'docs') {
      activeGovTab.value = tab;
    }
    const draftTitle = params.get('draftTitle');
    const draftFromDoc = params.get('draftFromDoc');
    if (draftTitle || draftFromDoc) {
      const matchedDoc = props.strategyDocs.find((d) => d.slug === draftFromDoc);
      openNewProposalDrawer({
        title: draftTitle ? `Motion: ${draftTitle}` : undefined,
        roughNotes: matchedDoc
          ? `Draft a governance proposal based on "${matchedDoc.title}": ${matchedDoc.summary}\n\n${matchedDoc.bodyPreview || ''}`
          : draftTitle || '',
      });
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

  if (props.initialProposalId && proposals.value.some((p) => p.id === props.initialProposalId)) {
    selectedProposalId.value = props.initialProposalId;
  }
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('coop-messages-updated', onMessagesUpdated as EventListener);
  }
});

const savePolicyAndManifestState = async () => {
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

const persistSingleProposal = async (proposal: CoopProposal) => {
  isSavingCloud.value = true;
  try {
    const tenantId = currentTeam.value?.$id || 'huck_collective';
    const ok = await saveSingleCoopProposal(proposal, tenantId);
    isCloudSynced.value = ok;
  } finally {
    isSavingCloud.value = false;
  }
};

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
  await savePolicyAndManifestState();
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
  await savePolicyAndManifestState();
  addToast({ type: 'success', message: `Added ${formattedName} to Co-op Roster!` });
};

const removeRosterMember = async (idx: number) => {
  const removed = policyConfig.value.members.splice(idx, 1);
  await savePolicyAndManifestState();
  if (removed[0]) {
    addToast({ type: 'info', message: `Removed ${removed[0].name} from Co-op Roster.` });
  }
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
  await persistSingleProposal(proposal);
  await savePolicyAndManifestState();
  addToast({
    type: 'success',
    message: `Enacted "${cleanEscapedCurrency(proposal.title)}" in Appwrite Cloud!`,
  });
};

const updateCloudSurplusPolicy = async (mode: SurplusPolicyMode) => {
  activeSurplusPolicyMode.value = mode;
  await savePolicyAndManifestState();
  addToast({
    type: 'success',
    message: `Active Co-op Surplus Policy updated (${mode === 'patronage_90_10' ? '90/10 Dividend' : mode === 'cap_100' ? '100% Over Ops' : '100% Reserve'})!`,
  });
};

const getVoteCount = (proposal: CoopProposal) => Object.keys(proposal.votes || {}).length;
const getSignalCount = (proposal: CoopProposal, signal: LoomioSignal) =>
  Object.values(proposal.votes || {}).filter((v) => v.signal === signal).length;
const getSignalPercent = (proposal: CoopProposal, signal: LoomioSignal) => {
  const total = getVoteCount(proposal);
  return total === 0 ? 0 : (getSignalCount(proposal, signal) / total) * 100;
};
const hasBlock = (proposal: CoopProposal) => getSignalCount(proposal, 'block') > 0;
const getMemberKey = () => activeVotingMember.value.toLowerCase().replace(/[^a-z0-9]/g, '_');
const getUserVote = (proposal: CoopProposal) => proposal.votes?.[getMemberKey()] || null;

async function handleInspectorVote(payload: { proposalId: string; signal: LoomioSignal; comment?: string }) {
  const target = proposals.value.find((p) => p.id === payload.proposalId);
  if (!target) return;

  const key = getMemberKey();
  const partner = activeVotingMember.value.includes('PDX')
    ? 'PDXGL'
    : activeVotingMember.value.includes('SWEAT') || activeVotingMember.value.includes('Social')
      ? 'SWEAT'
      : 'HUCK';

  target.votes = {
    ...(target.votes || {}),
    [key]: {
      signal: payload.signal,
      memberName: activeVotingMember.value,
      partner,
      comment: payload.comment,
      votedAt: new Date().toISOString(),
    },
  };

  await persistSingleProposal(target);

  if (payload.signal === 'block') {
    addToast({ type: 'error', message: 'Block recorded. Deliberation is now mandatory for this proposal.' });
  } else {
    addToast({
      type: 'success',
      message: `Vote recorded as ${payload.signal.toUpperCase()} for "${cleanEscapedCurrency(target.title)}"`,
    });
  }
}

async function handleInspectorSaveEdit(payload: { updated: CoopProposal; resetVotes: boolean }) {
  proposals.value = proposals.value.map((p) => (p.id === payload.updated.id ? payload.updated : p));
  await persistSingleProposal(payload.updated);
  addToast(
    payload.resetVotes
      ? 'Saved amended proposal & re-opened voting deliberation!'
      : 'Saved & locked formatted Markdown proposal!',
    'success'
  );
}

async function handleInspectorDelete(proposalId: string) {
  const tenantId = currentTeam.value?.$id || 'huck_collective';
  proposals.value = proposals.value.filter((p) => p.id !== proposalId);
  selectedProposalId.value = '';
  await deleteCoopProposal(proposalId, tenantId);
  addToast('Deleted proposal from governance ledger.', 'info');
}

async function runCreateAiHelper(mode: 'format_md' | 'draft_proposal') {
  creatingAiDraft.value = true;
  try {
    const res = await fetch('/api/format-coop-proposal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode,
        title: newProposal.value.title,
        category: newProposal.value.category,
        financialImpact: newProposal.value.financialImpact,
        description: newProposal.value.description,
        rationale: newProposal.value.rationale,
        roughNotes: aiRoughPrompt.value || newProposal.value.description || newProposal.value.title,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'AI drafting failed');

    if (data.title) newProposal.value.title = data.title;
    if (data.category) newProposal.value.category = data.category;
    if (data.financialImpact) newProposal.value.financialImpact = data.financialImpact;
    if (data.description) newProposal.value.description = data.description;
    if (data.rationale) newProposal.value.rationale = data.rationale;

    addToast('AI Helper structured your proposal in clean Markdown!', 'success');
  } catch (err: any) {
    addToast(err?.message || 'AI Helper unavailable right now.', 'error');
  } finally {
    creatingAiDraft.value = false;
  }
}

async function createProposal() {
  if (!newProposal.value.title.trim() || !newProposal.value.description.trim()) {
    addToast({ type: 'warning', message: 'Please fill in title and specification.' });
    return;
  }

  publishingProposal.value = true;
  try {
    const propId = `prop-${Date.now()}`;
    let uploadedIds: string[] = [];
    if (isAuthenticated.value && newProposalPhotos.value.length > 0) {
      uploadedIds = await uploadCoopMediaFiles(newProposalPhotos.value, propId);
    }
    const galleryIds = [...newProposalExistingImages.value, ...uploadedIds];

    const p: CoopProposal = {
      id: propId,
      title: cleanEscapedCurrency(newProposal.value.title.trim()),
      proposer: newProposal.value.proposer.trim(),
      proposerPartner: newProposal.value.proposerPartner,
      proposerUserId: user.value?.$id || undefined,
      proposerEmail: user.value?.email || undefined,
      category: newProposal.value.category,
      description: cleanEscapedCurrency(newProposal.value.description.trim()),
      rationale: cleanEscapedCurrency(newProposal.value.rationale.trim()),
      financialImpact: cleanEscapedCurrency(newProposal.value.financialImpact.trim()) || undefined,
      deadline: newProposal.value.deadline || new Date(Date.now() + 86400000 * 14).toISOString().slice(0, 10),
      status: 'active',
      createdAt: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString(),
      imageId: galleryIds[0] || undefined,
      galleryImageIds: galleryIds,
      votes: {
        [getMemberKey()]: {
          signal: 'agree',
          memberName: newProposal.value.proposer.trim(),
          partner: newProposal.value.proposerPartner,
          votedAt: new Date().toISOString(),
        },
      },
    };

    if (isAuthenticated.value) {
      const mdId = await syncProposalMarkdownSnapshot(p);
      if (mdId) p.mdFileId = mdId;
    }

    proposals.value.unshift(p);
    await persistSingleProposal(p);
    isNewProposalModalOpen.value = false;
    selectedProposalId.value = p.id;

    newProposal.value.title = '';
    newProposal.value.description = '';
    newProposal.value.rationale = '';
    newProposal.value.financialImpact = '';
    aiRoughPrompt.value = '';
    newProposalExistingImages.value = [];
    newProposalPhotos.value = [];

    addToast({ type: 'success', message: `Published & locked "${p.title}" for voting!` });
  } catch (err: any) {
    addToast(err?.message || 'Failed to publish proposal.', 'error');
  } finally {
    publishingProposal.value = false;
  }
}

const getProposalCardBorderClass = (proposal: CoopProposal) => {
  if (hasBlock(proposal)) return 'border-error/40 bg-error/5';
  if (getSignalCount(proposal, 'agree') >= (policyConfig.value.minAgreeVotes || 2)) return 'border-success/30';
  return 'border-base-200';
};

const getProposalStatusLabel = (proposal: CoopProposal) => {
  if (hasBlock(proposal)) return 'Deliberation Required (Veto)';
  if (getSignalCount(proposal, 'agree') >= (policyConfig.value.minAgreeVotes || 2)) return 'Consensus Reached';
  return 'Active Deliberation';
};

const getStatusPillClass = (proposal: CoopProposal) => {
  if (hasBlock(proposal)) return 'bg-error text-error-content';
  if (getSignalCount(proposal, 'agree') >= (policyConfig.value.minAgreeVotes || 2)) return 'bg-success text-success-content';
  return 'bg-warning text-warning-content';
};

const getStatusPillIcon = (proposal: CoopProposal) => {
  if (hasBlock(proposal)) return 'solar:shield-warning-bold';
  if (getSignalCount(proposal, 'agree') >= (policyConfig.value.minAgreeVotes || 2)) return 'solar:check-circle-bold';
  return 'solar:clock-circle-bold';
};

const getCategoryBadgeClass = (category: CoopProposal['category']) => {
  switch (category) {
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
};

const exportProposalsCsv = () => {
  if (proposals.value.length === 0) return;
  const header = ['ID', 'Title', 'Category', 'Proposer', 'Partner', 'Deadline', 'Status', 'AgreeCount', 'BlockCount'];
  const rows = proposals.value.map((p) => [
    p.id,
    `"${cleanEscapedCurrency(p.title).replace(/"/g, '""')}"`,
    `"${p.category}"`,
    `"${p.proposer.replace(/"/g, '""')}"`,
    p.proposerPartner,
    p.deadline,
    getProposalStatusLabel(p),
    getSignalCount(p, 'agree'),
    getSignalCount(p, 'block'),
  ]);
  const csvContent = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
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
