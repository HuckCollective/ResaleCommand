<template>
  <CollectiveAccessGate>
  <div class="space-y-6">
    <!-- Canonical Ledger Header -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div class="space-y-1">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="badge badge-secondary badge-xs sm:badge-sm font-black">1h = 1h Solidarity</span>
          <a
            href="/coop/settlements"
            class="badge badge-success badge-outline badge-xs sm:badge-sm font-mono font-bold gap-1 hover:bg-success/10"
            title="Inspect Mondragon 10/45/45 & 4.5:1 Pay-Ratio status in Partner Settlements"
          >
            <span>✅ 1.0:1 Hourly Ratio ≤ {{ policyConfig.payRatioCapStandard || 4.5 }}:1 Cap</span>
          </a>
          <span
            class="badge badge-xs sm:badge-sm font-mono font-bold"
            :class="isCloudSynced ? 'badge-primary badge-outline' : 'badge-ghost'"
          >
            {{ isLoadingLedger ? 'Loading ledger…' : isCloudSynced ? '🔒 Official Ledger' : 'Sign In Required' }}
          </span>
        </div>
        <h1 class="text-3xl sm:text-4xl font-black text-base-content tracking-tight flex items-center gap-3">
          <Icon icon="solar:clock-circle-bold-duotone" class="w-8 h-8 sm:w-9 sm:h-9 text-secondary shrink-0" />
          <span>Sweat-Equity &amp; Enabling Labor Ledger</span>
        </h1>
        <p class="text-sm text-base-content/70 max-w-3xl">
          Producers (sourcing, booth restocking, pop-ups) and Enablers (Dropcast social reels, photography, shipping — $0 inventory required) earn pro-rata shares of the {{ policyConfig.laborPatronagePct }}% Sweat-Equity Pool once approved by a Founder.
        </p>
      </div>

      <div class="flex items-center gap-2 flex-wrap w-full md:w-auto">
        <select
          v-model="selectedMonth"
          class="select select-bordered text-xs font-bold h-10 min-h-10 rounded-xl bg-base-100 border-base-300 focus:border-primary pr-8 shadow-2xs"
        >
          <option value="all">All Months ({{ validEntriesCount }} logs)</option>
          <option v-for="m in availableMonths" :key="m" :value="m">
            {{ isMonthLocked(m) ? '🔒 ' : '' }}{{ monthKeyToLabel(m) }}
          </option>
        </select>

        <button
          type="button"
          class="btn btn-sm sm:btn-md btn-outline btn-primary gap-1.5 shadow-xs font-bold min-h-[40px]"
          :disabled="filteredEntries.length === 0"
          @click="exportCsv"
        >
          <Icon icon="solar:file-download-bold" class="w-4 h-4 shrink-0" />
          <span>Export CSV</span>
        </button>
      </div>
    </div>

    <!-- Compact Operational Notices (Legacy Migration / Locked Month / Invalid Logs) -->
    <div
      v-if="legacyPendingMigrationCount > 0 && canApproveLabor"
      class="alert alert-info rounded-2xl py-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
    >
      <div class="flex items-center gap-2">
        <Icon icon="solar:database-bold-duotone" class="w-5 h-5 shrink-0" />
        <span>
          <strong>{{ legacyPendingMigrationCount }} earlier labor log(s)</strong> found in older records. Import them into the <strong>Official Labor Ledger</strong> (marked <strong>Pending</strong> until you approve).
        </span>
      </div>
      <button
        type="button"
        class="btn btn-xs btn-primary rounded-xl font-black shrink-0"
        :disabled="isSaving"
        @click="handleMigrateLegacy"
      >
        Import {{ legacyPendingMigrationCount }} Legacy Log(s)
      </button>
    </div>

    <div
      v-if="selectedMonth !== 'all' && isMonthLocked(selectedMonth)"
      class="alert alert-warning rounded-2xl py-2.5 text-xs flex items-center justify-between gap-2 flex-wrap"
    >
      <span class="font-bold flex items-center gap-1.5">
        <span>🔒</span>
        <span>{{ monthKeyToLabel(selectedMonth) }} is locked after payout — labor logs are frozen.</span>
      </span>
      <a href="/coop/settlements" class="btn btn-xs btn-outline rounded-xl font-bold">
        Open in Settlements ➔
      </a>
    </div>

    <div
      v-if="approvalSummary.invalidExcludedCount > 0"
      class="alert alert-error rounded-2xl py-2.5 text-xs"
    >
      <span>
        ⚠️ {{ approvalSummary.invalidExcludedCount }} labor log(s) excluded from settlements — fix missing/invalid date or hours ≤ 0.
      </span>
    </div>

    <!-- Canonical 4-Card Icon-Badge KPI Strip -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <div class="bg-base-100 p-3.5 sm:p-5 rounded-2xl border border-base-200 shadow-sm">
        <div class="flex items-center gap-2.5 sm:gap-3">
          <div class="p-2.5 sm:p-3 bg-secondary/10 text-secondary rounded-xl shrink-0">
            <Icon icon="solar:stopwatch-bold" class="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-[11px] uppercase font-bold opacity-60 truncate">Approved / Pending</div>
            <div class="text-lg sm:text-2xl font-black font-mono text-base-content truncate">
              {{ approvalSummary.approvedHours.toFixed(1) }}h
              <span v-if="approvalSummary.pendingHours > 0" class="text-xs font-bold text-warning">
                +{{ approvalSummary.pendingHours.toFixed(1) }}h
              </span>
            </div>
            <div class="text-[10px] font-semibold opacity-55 truncate">
              Prod: {{ producerVsEnablerTotals.producer.toFixed(1) }}h · Enab: {{ producerVsEnablerTotals.enabler.toFixed(1) }}h
            </div>
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
            <div class="text-lg sm:text-2xl font-black font-mono text-primary truncate">
              {{ partnerHours.HUCK.toFixed(1) }}h ({{ huckSharePct }}%)
            </div>
            <div class="text-[10px] font-semibold opacity-55 truncate">Approved Curator &amp; Ops Hours</div>
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
            <div class="text-lg sm:text-2xl font-black font-mono text-accent truncate">
              {{ partnerHours.PDXGL.toFixed(1) }}h ({{ pdxglSharePct }}%)
            </div>
            <div class="text-[10px] font-semibold opacity-55 truncate">Approved Curator &amp; Ops Hours</div>
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
            <div class="text-lg sm:text-2xl font-black font-mono text-info truncate">
              {{ partnerHours.SWEAT.toFixed(1) }}h ({{ sweatSharePct }}%)
            </div>
            <div class="text-[10px] font-semibold opacity-55 truncate">$0 Inventory · Approved Share</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Individual Worker Sweat-Equity Share Breakdown Strip -->
    <div v-if="memberShares.length > 0" class="card bg-base-100 border border-base-200 shadow-sm rounded-2xl p-4 space-y-2.5">
      <div class="flex items-center justify-between text-xs flex-wrap gap-2">
        <span class="font-extrabold uppercase tracking-wider text-base-content/60">
          Individual Worker-Member Sweat-Equity Shares (Approved Hours Feed Gate 4B Payouts)
        </span>
        <a href="/coop/governance?tab=roster" class="link link-primary font-bold text-[11px]">
          + Manage Roles &amp; Account Links in Roster ➔
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
            <div class="text-[10px] text-base-content/65 flex items-center gap-1 flex-wrap mt-0.5">
              <span
                class="badge badge-xs font-mono font-bold"
                :class="m.partner === 'SWEAT' ? 'badge-secondary' : m.partner === 'PDXGL' ? 'badge-accent' : 'badge-primary'"
              >
                {{ m.partner }}-
              </span>
              <span>{{ m.roleLabel }}</span>
            </div>
          </div>
          <div class="text-right shrink-0 space-y-0.5">
            <div class="font-mono font-black text-sm text-secondary">{{ m.approvedHours.toFixed(1) }}h</div>
            <div class="text-[10px] font-mono font-bold text-base-content/70">{{ m.sharePct }}% of pool</div>
            <div v-if="m.pendingHours > 0" class="badge badge-warning badge-outline badge-2xs font-mono">
              +{{ m.pendingHours.toFixed(1) }}h pending
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Top Segmented View Switcher: Task Board vs. Hours & Shifts Ledger -->
    <div class="bg-base-100 border border-base-300 rounded-2xl p-2 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
      <div class="grid grid-cols-2 gap-1.5 flex-1 sm:max-w-xl">
        <button
          type="button"
          class="btn btn-sm h-11 md:h-9 rounded-xl font-black gap-1.5"
          :class="activeLaborView === 'tasks' ? 'btn-primary text-primary-content shadow-2xs' : 'btn-ghost text-base-content/75'"
          @click="setLaborView('tasks')"
        >
          <span>📋 Task Board &amp; Presets</span>
          <span
            v-if="taskActionableBadgeCount > 0"
            class="badge badge-xs badge-warning text-warning-content font-mono font-bold whitespace-nowrap shrink-0"
          >
            {{ taskActionableBadgeCount }}
          </span>
        </button>
        <button
          type="button"
          class="btn btn-sm h-11 md:h-9 rounded-xl font-black gap-1.5"
          :class="activeLaborView === 'ledger' ? 'btn-primary text-primary-content shadow-2xs' : 'btn-ghost text-base-content/75'"
          @click="setLaborView('ledger')"
        >
          <span>⏱️ Hours &amp; Shifts Ledger</span>
          <span
            v-if="approvalSummary.pendingCount > 0"
            class="badge badge-xs badge-warning text-warning-content font-mono font-bold whitespace-nowrap shrink-0"
          >
            {{ approvalSummary.pendingCount }}
          </span>
        </button>
      </div>

      <div class="text-xs font-mono text-base-content/65 px-2 flex items-center gap-2 flex-wrap">
        <span>📣 Promoter · 🔥 Enabler · 🛠️ Builder · ⏱️ Shift</span>
      </div>
    </div>

    <!-- VIEW A: CO-OP TASK BOARD & 12 EDITABLE PRESETS -->
    <CoopTaskBoardPanel
      v-if="activeLaborView === 'tasks'"
      :presets="taskPresets"
      :tasks="boardTasks"
      :loading="isLoadingTasks"
      :saving="isSaving"
      :current-user-id="coopIdentity?.userId || ''"
      :is-founder="isFounder"
      :can-log-labor="canLogLabor"
      :can-edit-presets="canEditPresets"
      :eligible-voter-count="eligibleVoterCount"
      :required-peer-approvals="requiredPeerApprovals"
      :allow-sole-founder-self="allowSoleFounderSelf"
      @open-propose-custom="openProposeCustomDrawer"
      @open-edit-presets="openEditPresetsDrawer"
      @open-complete-task="openCompleteTaskDrawer"
      @post-preset="handlePostPresetTask"
      @vote-value="handleVoteTaskValue"
      @founder-tiebreak="handleFounderTiebreak"
      @claim="handleClaimTask"
      @unclaim="handleUnclaimTask"
      @approve-completion="handleApproveTaskCompletion"
      @archive-task="handleArchiveTask"
    />

    <!-- VIEW B: Main 2-Column Grid: Log Form + Ledger Table -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-6">
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

        <div
          v-if="!canLogLabor"
          class="rounded-xl border border-warning/35 bg-warning/10 p-3 text-xs text-base-content/80"
        >
          Sign in with an active Co-op work role (<code>owner</code>, <code>founder</code>, <code>curator</code>, <code>promoter</code>, <code>enabler</code>, or <code>builder</code>) to log Sweat-Equity hours.
        </div>

        <div
          v-else-if="!isFounder && !coopIdentity?.linkedMemberName"
          class="rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs space-y-1"
        >
          <div class="font-black text-warning">🔗 Account Link Needed</div>
          <p class="text-[11px] opacity-80">
            Ask a Founder to link your account in <a href="/coop/governance?tab=roster" class="link font-bold">/coop/governance (Roster)</a> before logging hours.
          </p>
        </div>

        <div class="form-control">
          <label class="label py-1">
            <span class="label-text text-xs font-bold">Worker-Member &amp; Prefix</span>
          </label>
          <select
            v-model="selectedMemberIdx"
            class="select select-bordered select-sm rounded-xl font-bold text-xs w-full"
            :disabled="!isFounder"
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
              type="text"
              inputmode="decimal"
              class="input input-bordered input-sm rounded-xl font-mono font-bold text-xs w-full"
            />
          </div>
        </div>

        <div class="form-control">
          <label class="label py-1">
            <span class="label-text text-xs font-bold">Channel &amp; Labor Category</span>
            <span
              class="label-text-alt text-[10px] font-mono font-bold"
              :class="classifySurplusLaborRole(form.category) === 'Enabler of Surplus' ? 'text-secondary' : 'text-primary'"
            >
              {{ classifySurplusLaborRole(form.category) }}
            </span>
          </label>
          <select
            v-model="form.category"
            class="select select-bordered select-sm h-11 md:h-8 rounded-xl font-bold text-xs w-full"
            @change="handleFormCategoryChange"
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
            <span class="label-text text-xs font-bold">Function Tag</span>
          </label>
          <div class="grid grid-cols-2 gap-1.5">
            <button
              v-for="ft in COOP_LABOR_FUNCTION_TAGS"
              :key="ft"
              type="button"
              class="btn btn-xs h-11 md:h-8 rounded-xl font-bold justify-start px-2.5"
              :class="form.functionTag === ft ? 'btn-secondary text-secondary-content' : 'btn-ghost bg-base-200/60 border border-base-300'"
              @click="form.functionTag = ft"
            >
              <span>{{ FUNCTION_TAG_META[ft].label }}</span>
            </button>
          </div>
        </div>

        <div class="form-control">
          <label class="label py-1">
            <span class="label-text text-xs font-bold">Deliverable / Reel / Drop Proof (Optional)</span>
          </label>
          <input
            v-model="form.deliverableRef"
            type="text"
            placeholder="e.g. https://instagram.com/reel/... or Dropcast #14"
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

        <div
          v-if="liveFormBarcodeWarning.warning"
          class="rounded-xl border border-warning/45 bg-warning/15 p-3 text-xs space-y-1"
        >
          <div class="font-black text-warning">⚠️ Mentions Worker's Own Barcode Prefix</div>
          <p class="text-[11px] text-base-content/85">
            Detected <strong>{{ liveFormBarcodeWarning.matchedTokens.join(', ') }}</strong>. Own-inventory prep earns Gate 3 Curator profit — log only shared Collective Commons work here.
          </p>
        </div>

        <div class="space-y-1.5">
          <button
            type="button"
            :disabled="isSaving || !canLogLabor || (!isFounder && !coopIdentity?.linkedMemberName) || isFormDateLocked"
            class="btn btn-primary btn-sm h-10 rounded-xl font-black w-full gap-2 shadow-sm"
            @click="handleAddLabor"
          >
            <Icon icon="solar:check-circle-bold" class="w-4 h-4" />
            <span>
              {{
                isFormDateLocked
                  ? '🔒 Selected Month is Locked'
                  : isSaving
                    ? 'Saving hours…'
                    : 'Commit Labor Hours'
              }}
            </span>
          </button>
          <p class="text-[11px] text-center text-base-content/60">
            Hours count toward payouts after a Founder approves them.
          </p>
        </div>
      </div>

      <!-- Right: Cloud Labor Entries Table -->
      <div class="lg:col-span-8 card bg-base-100 border border-base-300 shadow-sm rounded-3xl p-5 space-y-4">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 class="font-black text-base text-base-content">Sweat-Equity &amp; Enabling Labor Entries</h2>
            <p class="text-[11px] text-base-content/65">
              Only <strong>✅ Approved</strong> entries feed into <a href="/coop/settlements" class="link link-primary font-bold">/coop/settlements</a> Gate 4B payouts.
            </p>
          </div>
          <div class="flex items-center gap-1.5 flex-wrap">
            <button
              v-if="canApproveLabor && pendingMonthsForBulk.length > 0"
              type="button"
              class="btn btn-sm h-11 md:h-8 btn-outline btn-success rounded-xl font-black gap-1"
              :disabled="isSaving"
              @click="openBulkApproveDrawer"
            >
              <span>✅ Approve Pending ({{ approvalSummary.pendingCount }})</span>
            </button>
            <a
              href="/coop/settlements"
              class="btn btn-sm h-11 md:h-8 btn-ghost border border-base-300 rounded-xl font-bold gap-1"
            >
              <span>View in Settlements</span>
              <Icon icon="solar:arrow-right-linear" class="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <!-- Status Filter Pills -->
        <div class="flex items-center gap-1.5 flex-wrap">
          <button
            v-for="pill in statusFilterOptions"
            :key="pill.id"
            type="button"
            class="btn btn-sm h-11 md:h-8 rounded-xl font-bold gap-1"
            :class="statusFilter === pill.id ? 'btn-secondary' : 'btn-ghost bg-base-200/70'"
            @click="statusFilter = pill.id"
          >
            <span>{{ pill.label }}</span>
            <span class="badge badge-2xs font-mono whitespace-nowrap shrink-0">{{ pill.count }}</span>
          </button>
        </div>

        <div v-if="isLoadingLedger && entries.length === 0" class="space-y-2.5 py-2">
          <div v-for="n in 4" :key="n" class="skeleton h-12 w-full rounded-xl"></div>
        </div>

        <div v-else class="overflow-x-auto border border-base-200 rounded-2xl">
          <table class="table table-sm">
            <thead>
              <tr class="bg-base-200/60 text-xs font-extrabold uppercase text-base-content/70">
                <th>Date</th>
                <th>Worker</th>
                <th>Prefix</th>
                <th>Category &amp; WSDE Role</th>
                <th class="text-right">Hours</th>
                <th>Status</th>
                <th>Deliverable &amp; Notes</th>
                <th class="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="entry in filteredEntries"
                :key="entry.id"
                class="hover:bg-base-200/40 align-middle"
              >
                <td class="font-mono text-xs whitespace-nowrap">
                  <div class="flex items-center gap-1">
                    <span v-if="isEntryLocked(entry)" title="Month locked — Founder must unlock">🔒</span>
                    <span>{{ entry.date }}</span>
                  </div>
                </td>
                <td class="font-bold text-xs whitespace-nowrap">
                  <div>{{ entry.member }}</div>
                  <div
                    v-if="entry.loggedByName && entry.loggedByName !== entry.member"
                    class="text-[10px] font-normal text-base-content/55"
                  >
                    logged by {{ entry.loggedByName }}
                  </div>
                </td>
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
                    <div class="flex items-center gap-1 flex-wrap">
                      <span
                        class="badge badge-xs font-bold whitespace-nowrap shrink-0"
                        :class="FUNCTION_TAG_META[resolveEntryFunctionTag(entry)].badgeClass"
                      >
                        {{ FUNCTION_TAG_META[resolveEntryFunctionTag(entry)].label }}
                      </span>
                      <span class="badge badge-xs badge-ghost font-semibold whitespace-nowrap shrink-0">
                        {{ entry.category }}
                      </span>
                    </div>
                    <span
                      class="text-[10px] font-mono font-bold"
                      :class="classifySurplusLaborRole(entry.category) === 'Enabler of Surplus' ? 'text-secondary' : 'text-primary'"
                    >
                      {{ classifySurplusLaborRole(entry.category) }}
                    </span>
                  </div>
                </td>
                <td class="text-right font-mono font-black text-xs text-secondary whitespace-nowrap">
                  {{ Number(entry.hours).toFixed(2) }}h
                </td>
                <td class="whitespace-nowrap">
                  <div class="flex flex-col gap-0.5">
                    <span
                      class="badge badge-xs font-bold"
                      :class="statusBadgeClass(entry)"
                    >
                      {{ statusLabel(entry) }}
                    </span>
                    <span v-if="entry.approvedBy" class="text-[10px] text-base-content/55 truncate max-w-28">
                      by {{ entry.approvedBy }}{{ entry.selfApproved ? ' (self)' : '' }}
                    </span>
                  </div>
                </td>
                <td class="text-xs text-base-content/80 max-w-xs">
                  <div v-if="entry.deliverableRef" class="truncate">
                    <a
                      v-if="isHttpUrl(entry.deliverableRef)"
                      :href="entry.deliverableRef"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="link link-primary font-mono font-bold text-[11px]"
                    >
                      🔗 Open Proof Link ↗
                    </a>
                    <span v-else class="font-mono font-bold text-[11px] text-primary">
                      🔗 {{ entry.deliverableRef }}
                    </span>
                  </div>
                  <div class="truncate" :title="entry.notes">{{ entry.notes }}</div>
                  <div v-if="entry.ownBarcodeWarning" class="mt-0.5">
                    <span class="badge badge-2xs badge-warning font-bold whitespace-nowrap shrink-0" title="Entry text mentions worker's own barcode prefix — verify shared Co-op scope">
                      ⚠️ Mentions Own Prefix
                    </span>
                  </div>
                  <div v-if="entry.peerApprovals?.length" class="text-[10px] font-mono text-success">
                    👥 Peer signed: {{ entry.peerApprovals.map((p) => p.name).join(', ') }}
                  </div>
                  <div v-if="entry.decisionNote" class="text-[10px] italic text-warning truncate" :title="entry.decisionNote">
                    Note: {{ entry.decisionNote }}
                  </div>
                </td>
                <td class="text-right whitespace-nowrap">
                  <span
                    v-if="isEntryLocked(entry)"
                    class="badge badge-ghost badge-xs font-mono"
                    title="Month locked — Founder must unlock"
                  >
                    🔒 Locked
                  </span>
                  <div v-else class="inline-flex items-center gap-1 justify-end">
                    <button
                      v-if="canApproveLabor && effectiveLaborApproval(entry) !== 'approved'"
                      type="button"
                      class="btn btn-xs btn-success btn-outline rounded-lg font-bold"
                      title="Approve hours for Gate 4B payout"
                      :disabled="isSaving"
                      @click="handleQuickApprove(entry)"
                    >
                      ✅
                    </button>
                    <button
                      v-if="canApproveLabor && effectiveLaborApproval(entry) !== 'rejected'"
                      type="button"
                      class="btn btn-xs btn-error btn-outline rounded-lg font-bold"
                      title="Reject entry with reason"
                      :disabled="isSaving"
                      @click="openDecisionDrawer(entry, 'reject')"
                    >
                      ❌
                    </button>
                    <button
                      v-if="canApproveLabor && effectiveLaborApproval(entry) === 'approved'"
                      type="button"
                      class="btn btn-xs btn-ghost rounded-lg"
                      title="Return entry to Pending (requires note)"
                      :disabled="isSaving"
                      @click="openDecisionDrawer(entry, 'unapprove')"
                    >
                      ↩️
                    </button>
                    <button
                      v-if="canEditEntry(entry)"
                      type="button"
                      class="btn btn-ghost btn-xs"
                      title="Edit labor entry"
                      :disabled="isSaving"
                      @click="openEditDrawer(entry)"
                    >
                      <Icon icon="solar:pen-bold" class="w-3.5 h-3.5" />
                    </button>
                    <button
                      v-if="canDeleteEntry(entry)"
                      type="button"
                      class="btn btn-ghost btn-xs text-error"
                      title="Remove entry"
                      :disabled="isSaving"
                      @click="handleDeleteLabor(entry)"
                    >
                      <Icon icon="solar:trash-bin-trash-bold" class="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="filteredEntries.length === 0">
                <td colspan="8" class="text-center py-8 text-xs text-base-content/60">
                  No matching labor logs for this period/filter. Use the form on the left to log Dropcast reels, booth restocking, online shipping, or pop-up staffing hours.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- SlideOverDrawer: Reject / Unapprove / Bulk Approve / Edit Entry (Zero Native Browser Prompts) -->
    <SlideOverDrawer
      v-model="drawerOpen"
      size="md"
      :title="drawerTitle"
      :subtitle="drawerSubtitle"
    >
      <div v-if="drawerMode === 'decision' && activeEntry" class="space-y-4 text-xs">
        <div class="rounded-2xl bg-base-200/60 border border-base-300 p-3.5 space-y-1">
          <div class="font-black text-sm">{{ activeEntry.member }} — {{ Number(activeEntry.hours).toFixed(2) }}h</div>
          <div class="font-mono opacity-70">{{ activeEntry.date }} · {{ activeEntry.category }}</div>
          <div v-if="activeEntry.notes" class="opacity-80">{{ activeEntry.notes }}</div>
        </div>

        <div class="form-control">
          <label class="label py-1">
            <span class="label-text font-bold">
              {{ decisionAction === 'reject' ? 'Rejection Reason (Required) *' : 'Reason for Returning to Pending (Required) *' }}
            </span>
          </label>
          <textarea
            v-model="decisionNoteInput"
            rows="3"
            class="textarea textarea-bordered rounded-xl text-xs"
            placeholder="Explain what needs clarification or correction..."
          ></textarea>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn btn-sm btn-ghost rounded-xl" @click="drawerOpen = false">
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-sm rounded-xl font-black"
            :class="decisionAction === 'reject' ? 'btn-error' : 'btn-warning'"
            :disabled="isSaving || !decisionNoteInput.trim()"
            @click="submitDecisionDrawer"
          >
            {{ decisionAction === 'reject' ? 'Confirm Reject' : 'Return to Pending' }}
          </button>
        </div>
      </div>

      <div v-else-if="drawerMode === 'bulkApprove'" class="space-y-4 text-xs">
        <div class="rounded-2xl bg-success/10 border border-success/30 p-4 space-y-2">
          <div class="font-black text-sm text-success">
            Approve {{ approvalSummary.pendingCount }} Pending Log(s) ({{ approvalSummary.pendingHours.toFixed(2) }} hrs)
          </div>
          <p class="opacity-80">
            Approved hours become eligible for Gate 4B Sweat-Equity dividends in <code>/coop/settlements</code>. Locked months are skipped automatically.
          </p>
        </div>

        <div class="form-control">
          <label class="label py-1"><span class="label-text font-bold">Optional Audit Note</span></label>
          <input
            v-model="decisionNoteInput"
            type="text"
            class="input input-bordered input-sm rounded-xl text-xs"
            placeholder="e.g. Verified monthly booth & Dropcast logs"
          />
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn btn-sm btn-ghost rounded-xl" @click="drawerOpen = false">
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-sm btn-success rounded-xl font-black"
            :disabled="isSaving"
            @click="submitBulkApprove"
          >
            ✅ Approve All Pending Hours
          </button>
        </div>
      </div>

      <form v-else-if="drawerMode === 'edit' && editDraft" class="space-y-3.5 text-xs" @submit.prevent="submitEditDrawer">
        <div
          v-if="activeEntry?.approval === 'approved'"
          class="alert alert-warning py-2 rounded-xl text-xs"
        >
          <span>Changing date, hours, category, or worker resets an approved entry back to <strong>Pending</strong>.</span>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="form-control">
            <label class="label py-1"><span class="label-text font-bold">Work Date</span></label>
            <input v-model="editDraft.date" type="date" class="input input-bordered input-sm h-11 md:h-8 rounded-xl font-mono text-xs" required />
          </div>
          <div class="form-control">
            <label class="label py-1"><span class="label-text font-bold">Hours</span></label>
            <input v-model="editDraft.hoursInput" type="text" inputmode="decimal" class="input input-bordered input-sm h-11 md:h-8 rounded-xl font-mono text-xs" required />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="form-control">
            <label class="label py-1"><span class="label-text font-bold">Category</span></label>
            <select v-model="editDraft.category" class="select select-bordered select-sm h-11 md:h-8 rounded-xl font-bold text-xs">
              <option value="Social & Marketing">Social &amp; Marketing</option>
              <option value="Photography & Staging">Photography &amp; Staging</option>
              <option value="Online Fulfillment & Shipping">Online Fulfillment &amp; Shipping</option>
              <option value="Tech & Admin">Tech &amp; Admin</option>
              <option value="Booth Restock">Booth Restock</option>
              <option value="Pop-Up & Event Staffing">Pop-Up &amp; Event Staffing</option>
              <option value="Sourcing">Sourcing</option>
            </select>
          </div>
          <div class="form-control">
            <label class="label py-1"><span class="label-text font-bold">Function Tag</span></label>
            <select v-model="editDraft.functionTag" class="select select-bordered select-sm h-11 md:h-8 rounded-xl font-bold text-xs">
              <option v-for="ft in COOP_LABOR_FUNCTION_TAGS" :key="ft" :value="ft">
                {{ FUNCTION_TAG_META[ft].label }}
              </option>
            </select>
          </div>
        </div>

        <div class="form-control">
          <label class="label py-1"><span class="label-text font-bold">Deliverable Proof</span></label>
          <input v-model="editDraft.deliverableRef" type="text" class="input input-bordered input-sm h-11 md:h-8 rounded-xl text-xs" />
        </div>

        <div class="form-control">
          <label class="label py-1"><span class="label-text font-bold">Notes</span></label>
          <textarea v-model="editDraft.notes" rows="2" class="textarea textarea-bordered rounded-xl text-xs"></textarea>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn btn-sm h-11 md:h-8 btn-ghost rounded-xl" @click="drawerOpen = false">Cancel</button>
          <button type="submit" class="btn btn-sm h-11 md:h-8 btn-primary text-primary-content rounded-xl font-black" :disabled="isSaving">
            Save Changes
          </button>
        </div>
      </form>

      <!-- Hoisted Drawer Mode: Propose Custom Task (48h Quorum Vote) -->
      <form
        v-else-if="drawerMode === 'proposeCustomTask'"
        class="space-y-3.5 text-xs"
        @submit.prevent="submitProposeCustomDrawer"
      >
        <div class="rounded-2xl bg-info/10 border border-info/30 p-3.5 space-y-1">
          <div class="font-black text-info">🗳️ 48h Point-Value Vote (≥ 50% Quorum)</div>
          <p class="text-base-content/80">
            Custom tasks open for claiming once at least half of confirmed voting members ({{ Math.ceil(Math.max(1, eligibleVoterCount) / 2) }} of {{ eligibleVoterCount }}) confirm the point value.
          </p>
        </div>

        <div class="form-control">
          <label class="label py-1"><span class="label-text font-bold">Task Title *</span></label>
          <input
            v-model="customTaskDraft.title"
            type="text"
            maxlength="140"
            placeholder="e.g. Build custom locking acrylic wand display for Dusty Tiger"
            class="input input-bordered input-sm h-11 md:h-9 rounded-xl text-xs font-bold"
            required
          />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="form-control">
            <label class="label py-1"><span class="label-text font-bold">Function Tag</span></label>
            <select
              v-model="customTaskDraft.functionTag"
              class="select select-bordered select-sm h-11 md:h-9 rounded-xl font-bold text-xs"
              @change="customTaskDraft.category = FUNCTION_TAG_META[customTaskDraft.functionTag].defaultCategory"
            >
              <option v-for="ft in COOP_LABOR_FUNCTION_TAGS" :key="ft" :value="ft">
                {{ FUNCTION_TAG_META[ft].label }}
              </option>
            </select>
          </div>

          <div class="form-control">
            <label class="label py-1"><span class="label-text font-bold">Proposed Points (= Hours) *</span></label>
            <input
              v-model="customTaskDraft.pointsInput"
              type="text"
              inputmode="decimal"
              placeholder="e.g. 2.5"
              class="input input-bordered input-sm h-11 md:h-9 rounded-xl font-mono font-bold text-xs"
              required
            />
          </div>
        </div>

        <div class="form-control">
          <label class="label py-1"><span class="label-text font-bold">Labor Category</span></label>
          <select v-model="customTaskDraft.category" class="select select-bordered select-sm h-11 md:h-9 rounded-xl font-bold text-xs">
            <option value="Social & Marketing">Social &amp; Marketing</option>
            <option value="Photography & Staging">Photography &amp; Staging</option>
            <option value="Online Fulfillment & Shipping">Online Fulfillment &amp; Shipping</option>
            <option value="Tech & Admin">Tech &amp; Admin</option>
            <option value="Booth Restock">Booth Restock</option>
            <option value="Pop-Up & Event Staffing">Pop-Up &amp; Event Staffing</option>
            <option value="Sourcing">Sourcing</option>
          </select>
        </div>

        <div class="form-control">
          <label class="label py-1"><span class="label-text font-bold">Scope &amp; Deliverable Details</span></label>
          <textarea
            v-model="customTaskDraft.description"
            rows="3"
            maxlength="600"
            placeholder="Describe what done looks like so voters can weigh the point value..."
            class="textarea textarea-bordered rounded-xl text-xs"
          ></textarea>
        </div>

        <div
          v-if="liveCustomTaskBarcodeWarning.warning"
          class="rounded-xl border border-warning/45 bg-warning/15 p-3 text-xs"
        >
          <strong class="text-warning">⚠️ Mentions Your Barcode Prefix ({{ liveCustomTaskBarcodeWarning.matchedTokens.join(', ') }}):</strong>
          Make sure this task benefits the shared Collective Commons rather than personal inventory.
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn btn-sm h-11 md:h-9 btn-ghost rounded-xl" @click="drawerOpen = false">
            Cancel
          </button>
          <button
            type="submit"
            class="btn btn-sm h-11 md:h-9 btn-primary text-primary-content rounded-xl font-black"
            :disabled="isSaving || customTaskDraft.title.trim().length < 3"
          >
            {{ isSaving ? 'Posting…' : 'Start 48h Point Vote' }}
          </button>
        </div>
      </form>

      <!-- Hoisted Drawer Mode: Submit Task Completion Proof -->
      <form
        v-else-if="drawerMode === 'completeTask' && activeTaskForCompletion"
        class="space-y-3.5 text-xs"
        @submit.prevent="submitCompleteTaskDrawer"
      >
        <div class="rounded-2xl bg-base-200/70 border border-base-300 p-3.5 space-y-1">
          <div class="font-black text-sm">{{ activeTaskForCompletion.title }}</div>
          <div class="font-mono text-secondary font-bold">
            {{ activeTaskForCompletion.points.toFixed(2) }} pts (= {{ activeTaskForCompletion.points.toFixed(2) }}h) ·
            {{ FUNCTION_TAG_META[activeTaskForCompletion.functionTag].label }}
          </div>
        </div>

        <div class="form-control">
          <label class="label py-1"><span class="label-text font-bold">Completion Date *</span></label>
          <input
            v-model="completeTaskDraft.completedDate"
            type="date"
            class="input input-bordered input-sm h-11 md:h-9 rounded-xl font-mono text-xs"
            required
          />
          <span
            v-if="isCompleteDateLocked"
            class="text-[11px] font-bold text-error mt-1"
          >
            🔒 That month is locked after payout — pick an unlocked date or ask a Founder to unlock the month.
          </span>
        </div>

        <div class="form-control">
          <label class="label py-1"><span class="label-text font-bold">Proof Link or Reference (Optional)</span></label>
          <input
            v-model="completeTaskDraft.deliverableRef"
            type="text"
            maxlength="500"
            placeholder="e.g. https://instagram.com/reel/... or PR #42 or Booth photo batch"
            class="input input-bordered input-sm h-11 md:h-9 rounded-xl text-xs"
          />
        </div>

        <div class="form-control">
          <label class="label py-1"><span class="label-text font-bold">What Was Completed *</span></label>
          <textarea
            v-model="completeTaskDraft.completionNotes"
            rows="3"
            maxlength="1500"
            placeholder="Briefly summarize what you finished so peers can verify..."
            class="textarea textarea-bordered rounded-xl text-xs"
            required
          ></textarea>
        </div>

        <div
          v-if="liveCompleteBarcodeWarning.warning"
          class="rounded-xl border border-warning/45 bg-warning/15 p-3 text-xs"
        >
          <strong class="text-warning">⚠️ Mentions Your Barcode Prefix ({{ liveCompleteBarcodeWarning.matchedTokens.join(', ') }}):</strong>
          Peer approvers will see a reminder to confirm this was shared Collective Commons work.
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn btn-sm h-11 md:h-9 btn-ghost rounded-xl" @click="drawerOpen = false">
            Cancel
          </button>
          <button
            type="submit"
            class="btn btn-sm h-11 md:h-9 btn-primary text-primary-content rounded-xl font-black"
            :disabled="isSaving || isCompleteDateLocked || !completeTaskDraft.completionNotes.trim()"
          >
            {{ isSaving ? 'Submitting…' : 'Submit for Peer Sign-Off' }}
          </button>
        </div>
      </form>

      <!-- Hoisted Drawer Mode: Edit 12 Task Presets (Founder / Builder) -->
      <form
        v-else-if="drawerMode === 'editPresets'"
        class="space-y-4 text-xs"
        @submit.prevent="submitEditPresetsDrawer"
      >
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <p class="text-base-content/75">
            Founders and Builders can tune preset titles, function tags, and base points (<code>0.25</code>–<code>24.0</code>).
          </p>
          <button
            type="button"
            class="btn btn-xs h-11 md:h-7 btn-ghost border border-base-300 rounded-lg font-bold"
            @click="resetPresetDraftsToDefaults"
          >
            Reset Defaults
          </button>
        </div>

        <div class="space-y-3 max-h-[62vh] overflow-y-auto pr-1">
          <div
            v-for="(p, idx) in presetDrafts"
            :key="p.id"
            class="rounded-2xl border border-base-300 bg-base-200/45 p-3 space-y-2"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="badge badge-xs badge-outline font-mono font-bold">#{{ idx + 1 }}</span>
              <label class="inline-flex items-center gap-1.5 cursor-pointer font-bold">
                <input v-model="p.active" type="checkbox" class="checkbox checkbox-xs checkbox-primary" />
                <span>Active</span>
              </label>
            </div>

            <input
              v-model="p.title"
              type="text"
              maxlength="120"
              class="input input-bordered input-xs h-11 md:h-8 rounded-lg font-bold text-xs w-full"
              required
            />

            <div class="grid grid-cols-2 gap-2">
              <select
                v-model="p.functionTag"
                class="select select-bordered select-xs h-11 md:h-8 rounded-lg font-bold text-xs"
              >
                <option v-for="ft in COOP_LABOR_FUNCTION_TAGS" :key="ft" :value="ft">
                  {{ FUNCTION_TAG_META[ft].label }}
                </option>
              </select>
              <input
                v-model="p.pointsInput"
                type="text"
                inputmode="decimal"
                placeholder="Pts"
                class="input input-bordered input-xs h-11 md:h-8 rounded-lg font-mono font-bold text-xs"
                required
              />
            </div>

            <input
              v-model="p.description"
              type="text"
              maxlength="400"
              class="input input-bordered input-xs h-11 md:h-8 rounded-lg text-xs w-full"
            />
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn btn-sm h-11 md:h-9 btn-ghost rounded-xl" @click="drawerOpen = false">
            Cancel
          </button>
          <button
            type="submit"
            class="btn btn-sm h-11 md:h-9 btn-primary text-primary-content rounded-xl font-black"
            :disabled="isSaving"
          >
            {{ isSaving ? 'Saving…' : 'Save 12 Presets' }}
          </button>
        </div>
      </form>
    </SlideOverDrawer>
  </div>
  </CollectiveAccessGate>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { Icon } from '@iconify/vue';
import CollectiveAccessGate from '../common/CollectiveAccessGate.vue';
import SlideOverDrawer from '../common/SlideOverDrawer.vue';
import CoopTaskBoardPanel from './CoopTaskBoardPanel.vue';
import { addToast } from '../../stores/toast';
import { askConfirm } from '../../stores/confirm';
import { toUserMessage } from '../../lib/userFacingErrors';
import { parsePriceValue } from '../../lib/lot-strategy';
import { useAuth } from '../../composables/useAuth';
import { useMemberCapabilities } from '../../lib/memberAccess';
import { useCoopFounderGate } from '../../composables/useCoopFounderGate';
import {
  fetchCoopLaborLedger,
  fetchCoopTasksBoard,
  mutateCoopLabor,
  mutateCoopTasksBoard,
  type CoopTasksBoardPendingBadges,
} from '../../lib/coopLedgerClient';
import { monthKeyToLabel } from '../../lib/salesBucketing';
import {
  clampTaskPoints,
  COOP_LABOR_FUNCTION_TAGS,
  DEFAULT_COOP_TASK_PRESETS,
  detectOwnBarcodeWarning,
  FUNCTION_TAG_META,
  inferFunctionTagFromCategory,
  normalizeFunctionTag,
  type CoopLaborFunctionTag,
  type CoopTaskItem,
  type CoopTaskPreset,
} from '../../lib/coopTaskBoard';
import {
  loadCoopGovernanceState,
  getLaborHoursByPartnerForMonth,
  getLaborHoursByMemberForMonth,
  classifySurplusLaborRole,
  effectiveLaborApproval,
  isDemoSeedLaborEntry,
  laborEntryMonthKey,
  pacificTodayYmd,
  summarizeLaborApproval,
  DEFAULT_COOP_POLICY_CONFIG,
  type CoopLaborEntry,
  type CoopLaborCategory,
  type CoopPolicyConfig,
} from '../../lib/coopGovernance';

const { currentTeam } = useAuth();
const { capabilities } = useMemberCapabilities();

const laborEntries = ref<CoopLaborEntry[]>([]);
const policyConfig = ref<CoopPolicyConfig>({ ...DEFAULT_COOP_POLICY_CONFIG });
const rosterRef = computed(() => policyConfig.value.members);
const {
  coopIdentity,
  isFounder,
  canLogLabor,
  canApproveLabor,
  refreshCoopIdentity,
} = useCoopFounderGate(rosterRef);

const isCloudSynced = ref(false);
const isLoadingLedger = ref(false);
const isLoadingTasks = ref(false);
const isSaving = ref(false);
const activeLaborView = ref<'tasks' | 'ledger'>('tasks');
const selectedMonth = ref<string>('all');
const statusFilter = ref<'all' | 'pending' | 'approved' | 'rejected'>('all');
const selectedMemberIdx = ref<number>(0);
const lockedMonths = ref<string[]>([]);
const versionsByMonth = ref<Record<string, number>>({});
const legacyPendingMigrationCount = ref(0);

// Task Board State
const taskPresets = ref<CoopTaskPreset[]>(DEFAULT_COOP_TASK_PRESETS.map((p) => ({ ...p })));
const boardTasks = ref<CoopTaskItem[]>([]);
const taskBoardVersion = ref<number | undefined>(undefined);
const eligibleVoterCount = ref<number>(1);
const requiredPeerApprovals = ref<number>(2);
const allowSoleFounderSelf = ref<boolean>(false);
const canEditPresets = ref<boolean>(false);
const taskPendingBadges = ref<CoopTasksBoardPendingBadges>({
  votesNeededForMe: 0,
  peerSignoffsForMe: 0,
  tiebreaksForFounder: 0,
  pendingLaborForFounder: 0,
  totalActionable: 0,
});

const taskActionableBadgeCount = computed(
  () =>
    taskPendingBadges.value.votesNeededForMe +
    taskPendingBadges.value.peerSignoffsForMe +
    taskPendingBadges.value.tiebreaksForFounder
);

function setLaborView(view: 'tasks' | 'ledger') {
  activeLaborView.value = view;
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    if (view === 'tasks') url.searchParams.delete('view');
    else url.searchParams.set('view', 'ledger');
    window.history.replaceState({}, '', url.toString());
  }
}

const form = ref<{
  date: string;
  hours: number;
  category: CoopLaborCategory;
  functionTag: CoopLaborFunctionTag;
  deliverableRef: string;
  notes: string;
}>({
  date: pacificTodayYmd(),
  hours: 1.5,
  category: 'Social & Marketing',
  functionTag: 'promoter',
  deliverableRef: '',
  notes: '',
});

function handleFormCategoryChange() {
  form.value.functionTag = inferFunctionTagFromCategory(form.value.category);
}

// Single Hoisted Drawer State (§16 — zero stacked right-edge drawers)
type LaborDrawerMode =
  | 'decision'
  | 'bulkApprove'
  | 'edit'
  | 'proposeCustomTask'
  | 'completeTask'
  | 'editPresets';

const drawerOpen = ref(false);
const drawerMode = ref<LaborDrawerMode>('decision');
const decisionAction = ref<'reject' | 'unapprove'>('reject');
const activeEntry = ref<CoopLaborEntry | null>(null);
const decisionNoteInput = ref('');
const editDraft = ref<{
  date: string;
  hoursInput: string;
  category: CoopLaborCategory;
  functionTag: CoopLaborFunctionTag;
  deliverableRef: string;
  notes: string;
} | null>(null);

const customTaskDraft = ref<{
  title: string;
  functionTag: CoopLaborFunctionTag;
  category: CoopLaborCategory;
  pointsInput: string;
  description: string;
}>({
  title: '',
  functionTag: 'enabler',
  category: 'Booth Restock',
  pointsInput: '2.0',
  description: '',
});

const activeTaskForCompletion = ref<CoopTaskItem | null>(null);
const completeTaskDraft = ref<{
  completedDate: string;
  deliverableRef: string;
  completionNotes: string;
}>({
  completedDate: pacificTodayYmd(),
  deliverableRef: '',
  completionNotes: '',
});

interface EditablePresetDraft extends CoopTaskPreset {
  pointsInput: string;
}
const presetDrafts = ref<EditablePresetDraft[]>([]);

const drawerTitle = computed(() => {
  if (drawerMode.value === 'bulkApprove') return 'Approve Pending Labor Hours';
  if (drawerMode.value === 'edit') return 'Edit Labor Entry';
  if (drawerMode.value === 'proposeCustomTask') return 'Propose Custom Collective Task';
  if (drawerMode.value === 'completeTask') return 'Submit Task Proof for Peer Sign-Off';
  if (drawerMode.value === 'editPresets') return 'Edit 12 Collective Task Presets';
  return decisionAction.value === 'reject' ? 'Reject Labor Entry' : 'Return Approved Entry to Pending';
});

const drawerSubtitle = computed(() => {
  if (drawerMode.value === 'bulkApprove') return 'Founder approval into the Official Labor Ledger';
  if (drawerMode.value === 'edit') return 'Month lock & approval reset rules';
  if (drawerMode.value === 'proposeCustomTask') return '48h point-value vote (≥ 50% confirmed member quorum)';
  if (drawerMode.value === 'completeTask') return 'Verified hours log automatically once required peers sign off';
  if (drawerMode.value === 'editPresets') return 'Shared presets open immediately without a 48h vote';
  return 'Written note is stored permanently in the audit trail';
});

const eligibleMembers = computed(() => {
  return policyConfig.value.members.filter(
    (m) => m.partner === 'HUCK' || m.partner === 'PDXGL' || m.partner === 'SWEAT'
  );
});

// Keep non-founders pinned to their linked roster entry
watch(
  [() => coopIdentity.value?.linkedMemberName, eligibleMembers],
  ([linkedName, members]) => {
    if (linkedName) {
      const idx = members.findIndex(
        (m) => m.name.trim().toLowerCase() === linkedName.trim().toLowerCase()
      );
      if (idx >= 0) selectedMemberIdx.value = idx;
    }
  },
  { immediate: true }
);

function isMonthLocked(monthKey: string): boolean {
  return Boolean(monthKey && lockedMonths.value.includes(monthKey));
}

function isEntryLocked(entry: CoopLaborEntry): boolean {
  const mk = laborEntryMonthKey(entry.date);
  return isMonthLocked(mk);
}

const isFormDateLocked = computed(() => {
  const mk = laborEntryMonthKey(form.value.date);
  return isMonthLocked(mk);
});

const isCompleteDateLocked = computed(() => {
  const mk = laborEntryMonthKey(completeTaskDraft.value.completedDate);
  return isMonthLocked(mk);
});

const selectedWorkerPrefix = computed(() => {
  const memberObj = eligibleMembers.value[selectedMemberIdx.value] || eligibleMembers.value[0];
  if (!memberObj) return '';
  return memberObj.inventoryPrefix || (memberObj.partner !== 'SWEAT' ? `${memberObj.partner}-` : '');
});

const currentCallerPrefix = computed(() => {
  const linkedName = coopIdentity.value?.linkedMemberName;
  if (linkedName) {
    const found = policyConfig.value.members.find(
      (m) => m.name.trim().toLowerCase() === linkedName.trim().toLowerCase()
    );
    if (found) {
      return found.inventoryPrefix || (found.partner !== 'SWEAT' ? `${found.partner}-` : '');
    }
  }
  return selectedWorkerPrefix.value;
});

const liveFormBarcodeWarning = computed(() =>
  detectOwnBarcodeWarning([form.value.notes, form.value.deliverableRef], selectedWorkerPrefix.value)
);

const liveCustomTaskBarcodeWarning = computed(() =>
  detectOwnBarcodeWarning(
    [customTaskDraft.value.title, customTaskDraft.value.description],
    currentCallerPrefix.value
  )
);

const liveCompleteBarcodeWarning = computed(() =>
  detectOwnBarcodeWarning(
    [
      activeTaskForCompletion.value?.title,
      completeTaskDraft.value.completionNotes,
      completeTaskDraft.value.deliverableRef,
    ],
    currentCallerPrefix.value
  )
);

function resolveEntryFunctionTag(entry: CoopLaborEntry): CoopLaborFunctionTag {
  return normalizeFunctionTag(entry.functionTag, entry.category);
}

const validEntriesCount = computed(
  () => laborEntries.value.filter((e) => !isDemoSeedLaborEntry(e)).length
);

const availableMonths = computed(() => {
  const set = new Set<string>();
  for (const e of laborEntries.value) {
    const mk = laborEntryMonthKey(e.date);
    if (mk) set.add(mk);
  }
  for (const lm of lockedMonths.value) {
    if (lm) set.add(lm);
  }
  return Array.from(set).sort().reverse();
});

const periodScopedEntries = computed(() => {
  const clean = laborEntries.value.filter((e) => !isDemoSeedLaborEntry(e));
  if (selectedMonth.value === 'all') return clean;
  return clean.filter((e) => laborEntryMonthKey(e.date) === selectedMonth.value);
});

const approvalSummary = computed(() =>
  summarizeLaborApproval(laborEntries.value, selectedMonth.value)
);

const statusFilterOptions = computed(() => [
  { id: 'all' as const, label: 'All', count: periodScopedEntries.value.length },
  { id: 'pending' as const, label: '⏳ Pending', count: approvalSummary.value.pendingCount },
  { id: 'approved' as const, label: '✅ Approved', count: approvalSummary.value.approvedCount },
  { id: 'rejected' as const, label: '❌ Rejected', count: approvalSummary.value.rejectedCount },
]);

const filteredEntries = computed(() => {
  if (statusFilter.value === 'all') return periodScopedEntries.value;
  return periodScopedEntries.value.filter(
    (e) => effectiveLaborApproval(e) === statusFilter.value
  );
});

const pendingMonthsForBulk = computed(() => {
  const set = new Set<string>();
  for (const e of periodScopedEntries.value) {
    const mk = laborEntryMonthKey(e.date);
    if (mk && !isMonthLocked(mk) && effectiveLaborApproval(e) === 'pending') {
      set.add(mk);
    }
  }
  return Array.from(set);
});

const partnerHours = computed(() =>
  getLaborHoursByPartnerForMonth(laborEntries.value, selectedMonth.value, {
    status: 'approved',
  })
);

const memberShares = computed(() =>
  getLaborHoursByMemberForMonth(
    laborEntries.value,
    selectedMonth.value,
    policyConfig.value.members,
    { status: 'all' }
  )
);

const producerVsEnablerTotals = computed(() => {
  let producer = 0;
  let enabler = 0;
  for (const e of periodScopedEntries.value) {
    if (effectiveLaborApproval(e) !== 'approved') continue;
    const hrs = Number(e.hours) || 0;
    if (classifySurplusLaborRole(e.category) === 'Enabler of Surplus') {
      enabler += hrs;
    } else {
      producer += hrs;
    }
  }
  return { producer, enabler };
});

const totalApprovedHours = computed(() =>
  Number(
    (
      partnerHours.value.HUCK +
      partnerHours.value.PDXGL +
      partnerHours.value.SWEAT
    ).toFixed(2)
  )
);

const huckSharePct = computed(() => {
  if (totalApprovedHours.value <= 0) return 0;
  return Math.round((partnerHours.value.HUCK / totalApprovedHours.value) * 100);
});

const pdxglSharePct = computed(() => {
  if (totalApprovedHours.value <= 0) return 0;
  return Math.round((partnerHours.value.PDXGL / totalApprovedHours.value) * 100);
});

const sweatSharePct = computed(() => {
  if (totalApprovedHours.value <= 0) return 0;
  return Math.max(0, 100 - huckSharePct.value - pdxglSharePct.value);
});

function isHttpUrl(val?: string): boolean {
  return Boolean(val && /^https?:\/\//i.test(val.trim()));
}

function statusLabel(entry: CoopLaborEntry): string {
  const s = effectiveLaborApproval(entry);
  if (s === 'approved') return '✅ Approved';
  if (s === 'rejected') return '❌ Rejected';
  return entry.approval ? '⏳ Pending' : '⏳ Legacy Pending';
}

function statusBadgeClass(entry: CoopLaborEntry): string {
  const s = effectiveLaborApproval(entry);
  if (s === 'approved') return 'badge-success';
  if (s === 'rejected') return 'badge-error';
  return 'badge-warning badge-outline';
}

function isOwnEntry(entry: CoopLaborEntry): boolean {
  const uid = coopIdentity.value?.userId;
  if (uid && (entry.loggedByUserId === uid || entry.memberUserId === uid)) return true;
  const linked = coopIdentity.value?.linkedMemberName;
  if (linked && linked.trim().toLowerCase() === entry.member.trim().toLowerCase()) {
    return true;
  }
  return false;
}

function canEditEntry(entry: CoopLaborEntry): boolean {
  if (isEntryLocked(entry)) return false;
  if (isFounder.value) return true;
  return isOwnEntry(entry) && effectiveLaborApproval(entry) === 'pending';
}

function canDeleteEntry(entry: CoopLaborEntry): boolean {
  if (isEntryLocked(entry)) return false;
  if (isFounder.value) return true;
  return isOwnEntry(entry) && effectiveLaborApproval(entry) === 'pending';
}

async function refreshServerLaborLedger() {
  isLoadingLedger.value = true;
  try {
    const res = await fetchCoopLaborLedger('all');
    laborEntries.value = res.entries || [];
    lockedMonths.value = res.lockedMonths || [];
    versionsByMonth.value = res.versionsByMonth || {};
    legacyPendingMigrationCount.value = res.legacyPendingMigrationCount || 0;
    isCloudSynced.value = true;
  } catch (err: any) {
    isCloudSynced.value = false;
    if (err?.status && err.status !== 401) {
      addToast({ type: 'warning', message: err.message });
    }
  } finally {
    isLoadingLedger.value = false;
  }
}

async function refreshTasksBoard() {
  isLoadingTasks.value = true;
  try {
    const res = await fetchCoopTasksBoard();
    taskPresets.value = res.presets || DEFAULT_COOP_TASK_PRESETS.map((p) => ({ ...p }));
    boardTasks.value = res.tasks || [];
    taskBoardVersion.value = res.version;
    eligibleVoterCount.value = res.eligibleVoterCount || 1;
    requiredPeerApprovals.value = res.requiredPeerApprovals || 2;
    allowSoleFounderSelf.value = Boolean(res.allowSoleFounderSelf);
    canEditPresets.value = Boolean(res.canEditPresets);
    if (res.pendingBadges) {
      taskPendingBadges.value = res.pendingBadges;
    }
  } catch (err: any) {
    if (err?.status && err.status !== 401) {
      addToast({ type: 'warning', message: toUserMessage(err, 'Could not load Collective Task Board.') });
    }
  } finally {
    isLoadingTasks.value = false;
  }
}

const handleAddLabor = async () => {
  const memberObj = eligibleMembers.value[selectedMemberIdx.value] || eligibleMembers.value[0];
  const parsedHours = parsePriceValue(form.value.hours);
  if (!memberObj || parsedHours <= 0) {
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

    const res = await mutateCoopLabor({
      mode: 'log',
      date: form.value.date || pacificTodayYmd(),
      member: memberObj.name,
      partner: partnerPrefix,
      category: form.value.category,
      functionTag: form.value.functionTag,
      hours: parsedHours,
      deliverableRef: form.value.deliverableRef.trim() || undefined,
      notes: form.value.notes.trim() || `${form.value.category} contribution`,
    });

    await Promise.all([refreshServerLaborLedger(), refreshTasksBoard()]);
    form.value.notes = '';
    form.value.deliverableRef = '';

    const statusMsg =
      res.entry?.approval === 'approved' ? 'Approved' : 'Pending Founder approval';
    addToast({
      type: 'success',
      message: `Logged ${res.entry?.hours ?? parsedHours}h for ${memberObj.name} (${statusMsg}).`,
    });
  } catch (err: any) {
    addToast({
      type: 'error',
      message: toUserMessage(err, 'Failed to save labor entry.'),
    });
  } finally {
    isSaving.value = false;
  }
};

const handleQuickApprove = async (entry: CoopLaborEntry) => {
  const mk = laborEntryMonthKey(entry.date);
  if (!mk) return;
  isSaving.value = true;
  try {
    await mutateCoopLabor({
      mode: 'approve',
      id: entry.id,
      month: mk,
      expectedVersion: versionsByMonth.value[mk],
    });
    await refreshServerLaborLedger();
    addToast({
      type: 'success',
      message: `Approved ${Number(entry.hours).toFixed(2)}h for ${entry.member}.`,
    });
  } catch (err: any) {
    addToast({ type: 'error', message: err?.message || 'Approval failed.' });
  } finally {
    isSaving.value = false;
  }
};

const openDecisionDrawer = (entry: CoopLaborEntry, action: 'reject' | 'unapprove') => {
  activeEntry.value = entry;
  decisionAction.value = action;
  decisionNoteInput.value = '';
  drawerMode.value = 'decision';
  drawerOpen.value = true;
};

const submitDecisionDrawer = async () => {
  if (!activeEntry.value || !decisionNoteInput.value.trim()) return;
  const mk = laborEntryMonthKey(activeEntry.value.date);
  if (!mk) return;

  isSaving.value = true;
  try {
    await mutateCoopLabor({
      mode: decisionAction.value,
      id: activeEntry.value.id,
      month: mk,
      decisionNote: decisionNoteInput.value.trim(),
      expectedVersion: versionsByMonth.value[mk],
    });
    drawerOpen.value = false;
    await refreshServerLaborLedger();
    addToast({
      type: 'info',
      message:
        decisionAction.value === 'reject'
          ? `Rejected labor entry for ${activeEntry.value.member}.`
          : `Returned ${activeEntry.value.member}'s entry to Pending.`,
    });
  } catch (err: any) {
    addToast({ type: 'error', message: err?.message || 'Action failed.' });
  } finally {
    isSaving.value = false;
  }
};

const openBulkApproveDrawer = () => {
  decisionNoteInput.value = '';
  drawerMode.value = 'bulkApprove';
  drawerOpen.value = true;
};

const submitBulkApprove = async () => {
  isSaving.value = true;
  try {
    let totalApproved = 0;
    for (const mk of pendingMonthsForBulk.value) {
      const res = await mutateCoopLabor({
        mode: 'bulkApprove',
        month: mk,
        decisionNote: decisionNoteInput.value.trim() || undefined,
        expectedVersion: versionsByMonth.value[mk],
      });
      totalApproved += res.approvedCount || 0;
    }
    drawerOpen.value = false;
    await refreshServerLaborLedger();
    addToast({
      type: 'success',
      message: `Approved ${totalApproved} pending labor log(s)!`,
    });
  } catch (err: any) {
    addToast({ type: 'error', message: err?.message || 'Bulk approve failed.' });
  } finally {
    isSaving.value = false;
  }
};

const openEditDrawer = (entry: CoopLaborEntry) => {
  activeEntry.value = entry;
  editDraft.value = {
    date: entry.date,
    hoursInput: String(Number(entry.hours)),
    category: entry.category,
    functionTag: resolveEntryFunctionTag(entry),
    deliverableRef: entry.deliverableRef || '',
    notes: entry.notes || '',
  };
  drawerMode.value = 'edit';
  drawerOpen.value = true;
};

const submitEditDrawer = async () => {
  if (!activeEntry.value || !editDraft.value) return;
  const origMonth = laborEntryMonthKey(activeEntry.value.date);
  const parsedHours = parsePriceValue(editDraft.value.hoursInput);
  if (parsedHours <= 0) {
    addToast({ type: 'error', message: 'Hours must be greater than 0.' });
    return;
  }
  isSaving.value = true;
  try {
    await mutateCoopLabor({
      mode: 'edit',
      id: activeEntry.value.id,
      originalMonth: origMonth || undefined,
      date: editDraft.value.date,
      member: activeEntry.value.member,
      partner: activeEntry.value.partner,
      category: editDraft.value.category,
      functionTag: editDraft.value.functionTag,
      hours: parsedHours,
      deliverableRef: editDraft.value.deliverableRef.trim() || undefined,
      notes: editDraft.value.notes.trim(),
      expectedVersion: origMonth ? versionsByMonth.value[origMonth] : undefined,
    });
    drawerOpen.value = false;
    await refreshServerLaborLedger();
    addToast({ type: 'success', message: 'Saved updated labor entry.' });
  } catch (err: any) {
    addToast({ type: 'error', message: toUserMessage(err, 'Failed to update labor entry.') });
  } finally {
    isSaving.value = false;
  }
};

// Task Board Handlers (Single Hoisted SlideOverDrawer)
const openProposeCustomDrawer = () => {
  customTaskDraft.value = {
    title: '',
    functionTag: 'enabler',
    category: 'Booth Restock',
    pointsInput: '2.0',
    description: '',
  };
  drawerMode.value = 'proposeCustomTask';
  drawerOpen.value = true;
};

const submitProposeCustomDrawer = async () => {
  const pts = clampTaskPoints(parsePriceValue(customTaskDraft.value.pointsInput), 1.5);
  isSaving.value = true;
  try {
    const res = await mutateCoopTasksBoard({
      mode: 'propose_custom',
      title: customTaskDraft.value.title.trim(),
      description: customTaskDraft.value.description.trim() || undefined,
      functionTag: customTaskDraft.value.functionTag,
      category: customTaskDraft.value.category,
      proposedPoints: pts,
      expectedVersion: taskBoardVersion.value,
    });
    drawerOpen.value = false;
    await refreshTasksBoard();
    addToast({
      type: 'success',
      message:
        res.task?.status === 'open'
          ? `Opened "${res.task.title}" (${res.task.points.toFixed(2)} pts).`
          : `Started 48h point vote for "${customTaskDraft.value.title.trim()}".`,
    });
  } catch (err: any) {
    addToast({ type: 'error', message: toUserMessage(err, 'Could not post custom task.') });
  } finally {
    isSaving.value = false;
  }
};

const openEditPresetsDrawer = () => {
  presetDrafts.value = taskPresets.value.map((p) => ({
    ...p,
    pointsInput: String(p.basePoints),
  }));
  drawerMode.value = 'editPresets';
  drawerOpen.value = true;
};

const resetPresetDraftsToDefaults = () => {
  presetDrafts.value = DEFAULT_COOP_TASK_PRESETS.map((p) => ({
    ...p,
    pointsInput: String(p.basePoints),
  }));
};

const submitEditPresetsDrawer = async () => {
  const cleaned: CoopTaskPreset[] = presetDrafts.value.map((d) => ({
    id: d.id,
    title: d.title.trim(),
    functionTag: d.functionTag,
    category: FUNCTION_TAG_META[d.functionTag]?.defaultCategory || d.category,
    basePoints: clampTaskPoints(parsePriceValue(d.pointsInput), d.basePoints),
    description: d.description.trim(),
    active: d.active,
  }));
  isSaving.value = true;
  try {
    await mutateCoopTasksBoard({
      mode: 'save_presets',
      presets: cleaned,
      expectedVersion: taskBoardVersion.value,
    });
    drawerOpen.value = false;
    await refreshTasksBoard();
    addToast({ type: 'success', message: '✅ Saved 12 Collective task presets.' });
  } catch (err: any) {
    addToast({ type: 'error', message: toUserMessage(err, 'Could not save task presets.') });
  } finally {
    isSaving.value = false;
  }
};

const handlePostPresetTask = async (payload: {
  presetId: string;
  description?: string;
  claimImmediately: boolean;
}) => {
  isSaving.value = true;
  try {
    const res = await mutateCoopTasksBoard({
      mode: 'create_from_preset',
      presetId: payload.presetId,
      description: payload.description,
      claimImmediately: payload.claimImmediately,
      expectedVersion: taskBoardVersion.value,
    });
    await refreshTasksBoard();
    addToast({
      type: 'success',
      message: payload.claimImmediately
        ? `🏃 Claimed "${res.task?.title}" (${res.task?.points.toFixed(2)} pts).`
        : `Posted "${res.task?.title}" to the Task Board.`,
    });
  } catch (err: any) {
    addToast({ type: 'error', message: toUserMessage(err, 'Could not post preset task.') });
  } finally {
    isSaving.value = false;
  }
};

const handleVoteTaskValue = async (payload: { taskId: string; points: number }) => {
  isSaving.value = true;
  try {
    const res = await mutateCoopTasksBoard({
      mode: 'vote_value',
      taskId: payload.taskId,
      points: payload.points,
      expectedVersion: taskBoardVersion.value,
    });
    await refreshTasksBoard();
    addToast({
      type: 'success',
      message:
        res.task?.status === 'open'
          ? `✅ Quorum reached — task opened at ${res.task.points.toFixed(2)} pts!`
          : `Recorded your vote (${payload.points.toFixed(2)} pts).`,
    });
  } catch (err: any) {
    addToast({ type: 'error', message: toUserMessage(err, 'Could not submit point vote.') });
  } finally {
    isSaving.value = false;
  }
};

const handleFounderTiebreak = async (payload: {
  taskId: string;
  decision: 'decide' | 'restart';
  points: number;
}) => {
  isSaving.value = true;
  try {
    await mutateCoopTasksBoard({
      mode: 'founder_tiebreak',
      taskId: payload.taskId,
      decision: payload.decision,
      points: payload.points,
      expectedVersion: taskBoardVersion.value,
    });
    await refreshTasksBoard();
    addToast({
      type: 'success',
      message:
        payload.decision === 'decide'
          ? `⚖️ Set task value to ${payload.points.toFixed(2)} pts & opened for claiming.`
          : '🔄 Restarted fresh 48h point-value vote.',
    });
  } catch (err: any) {
    addToast({ type: 'error', message: toUserMessage(err, 'Tiebreak action failed.') });
  } finally {
    isSaving.value = false;
  }
};

const handleClaimTask = async (taskId: string) => {
  isSaving.value = true;
  try {
    await mutateCoopTasksBoard({
      mode: 'claim',
      taskId,
      expectedVersion: taskBoardVersion.value,
    });
    await refreshTasksBoard();
    addToast({ type: 'success', message: '🏃 Task claimed!' });
  } catch (err: any) {
    addToast({ type: 'error', message: toUserMessage(err, 'Could not claim task.') });
  } finally {
    isSaving.value = false;
  }
};

const handleUnclaimTask = async (taskId: string) => {
  isSaving.value = true;
  try {
    await mutateCoopTasksBoard({
      mode: 'unclaim',
      taskId,
      expectedVersion: taskBoardVersion.value,
    });
    await refreshTasksBoard();
    addToast({ type: 'info', message: 'Released task back to Open.' });
  } catch (err: any) {
    addToast({ type: 'error', message: toUserMessage(err, 'Could not release task.') });
  } finally {
    isSaving.value = false;
  }
};

const openCompleteTaskDrawer = (task: CoopTaskItem) => {
  activeTaskForCompletion.value = task;
  completeTaskDraft.value = {
    completedDate: pacificTodayYmd(),
    deliverableRef: '',
    completionNotes: '',
  };
  drawerMode.value = 'completeTask';
  drawerOpen.value = true;
};

const submitCompleteTaskDrawer = async () => {
  if (!activeTaskForCompletion.value) return;
  isSaving.value = true;
  try {
    await mutateCoopTasksBoard({
      mode: 'submit_completion',
      taskId: activeTaskForCompletion.value.id,
      completedDate: completeTaskDraft.value.completedDate,
      deliverableRef: completeTaskDraft.value.deliverableRef.trim() || undefined,
      completionNotes: completeTaskDraft.value.completionNotes.trim(),
      expectedVersion: taskBoardVersion.value,
    });
    drawerOpen.value = false;
    await refreshTasksBoard();
    addToast({
      type: 'success',
      message: '⏳ Submitted! Other Collective members can now sign off.',
    });
  } catch (err: any) {
    addToast({ type: 'error', message: toUserMessage(err, 'Could not submit completion.') });
  } finally {
    isSaving.value = false;
  }
};

const handleApproveTaskCompletion = async (taskId: string) => {
  isSaving.value = true;
  try {
    const res = await mutateCoopTasksBoard({
      mode: 'approve_completion',
      taskId,
      expectedVersion: taskBoardVersion.value,
    });
    await Promise.all([refreshTasksBoard(), refreshServerLaborLedger()]);
    if (res.remainingApprovals === 0) {
      addToast({
        type: 'success',
        message:
          res.linkedLaborApproval === 'approved'
            ? '✅ Task completed & recorded in the Official Labor Ledger (Approved)!'
            : '✅ Peer sign-off complete — logged as Pending for Founder final stamp!',
      });
    } else {
      addToast({
        type: 'success',
        message: `Signed off! ${res.remainingApprovals} more peer sign-off needed.`,
      });
    }
  } catch (err: any) {
    addToast({ type: 'error', message: toUserMessage(err, 'Could not sign off on task.') });
  } finally {
    isSaving.value = false;
  }
};

const handleArchiveTask = async (taskId: string) => {
  const ok = await askConfirm(
    'Archive this task from the active Task Board?',
    'Archive Task',
    'Archive Task',
    'Cancel',
    'btn-warning'
  );
  if (!ok) return;
  isSaving.value = true;
  try {
    await mutateCoopTasksBoard({
      mode: 'archive_task',
      taskId,
      expectedVersion: taskBoardVersion.value,
    });
    await refreshTasksBoard();
    addToast({ type: 'info', message: 'Archived task.' });
  } catch (err: any) {
    addToast({ type: 'error', message: toUserMessage(err, 'Could not archive task.') });
  } finally {
    isSaving.value = false;
  }
};

const handleDeleteLabor = async (entry: CoopLaborEntry) => {
  const mk = laborEntryMonthKey(entry.date);
  if (!mk) return;
  const ok = await askConfirm(
    `Remove ${Number(entry.hours).toFixed(2)}h labor log for ${entry.member} (${entry.date})?`,
    'Remove Labor Log',
    'Remove Entry',
    'Cancel',
    'btn-error'
  );
  if (!ok) return;
  isSaving.value = true;
  try {
    await mutateCoopLabor({
      mode: 'delete',
      id: entry.id,
      month: mk,
      expectedVersion: versionsByMonth.value[mk],
    });
    await refreshServerLaborLedger();
    addToast({ type: 'info', message: 'Removed labor log entry.' });
  } catch (err: any) {
    addToast({ type: 'error', message: toUserMessage(err, 'Could not remove labor log entry.') });
  } finally {
    isSaving.value = false;
  }
};

const handleMigrateLegacy = async () => {
  isSaving.value = true;
  try {
    const res = await mutateCoopLabor({ mode: 'migrateLegacy' });
    await refreshServerLaborLedger();
    addToast({
      type: 'success',
      message: `Imported ${res.migratedCount || 0} earlier labor log(s) into the Official Labor Ledger as Pending.`,
    });
  } catch (err: any) {
    console.warn('[CoopLaborView] Legacy migration failed:', err);
    addToast({ type: 'error', message: toUserMessage(err, "Couldn't import earlier labor logs — please try again.") });
  } finally {
    isSaving.value = false;
  }
};

const exportCsv = () => {
  if (filteredEntries.value.length === 0) return;
  const header = [
    'Date',
    'Member',
    'Partner',
    'FunctionTag',
    'Category',
    'WSDE_Role',
    'Hours',
    'Approval',
    'ApprovedBy',
    'ApprovedAt',
    'OwnPrefixWarning',
    'DecisionNote',
    'DeliverableRef',
    'Notes',
  ];
  const rows = filteredEntries.value.map((l) => [
    l.date,
    `"${l.member.replace(/"/g, '""')}"`,
    l.partner,
    resolveEntryFunctionTag(l),
    `"${l.category}"`,
    `"${classifySurplusLaborRole(l.category)}"`,
    l.hours,
    effectiveLaborApproval(l),
    `"${(l.approvedBy || '').replace(/"/g, '""')}"`,
    l.approvedAt || '',
    l.ownBarcodeWarning ? 'YES' : '',
    `"${(l.decisionNote || '').replace(/"/g, '""')}"`,
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
  if (!capabilities.value.canSeeCollectiveFinancials) return;
  await refreshCoopIdentity();
  const { state } = await loadCoopGovernanceState(
    [],
    currentTeam.value?.$id || 'huck_collective'
  );
  if (state.policyConfig) {
    policyConfig.value = state.policyConfig;
  }

  await Promise.all([refreshServerLaborLedger(), refreshTasksBoard()]);

  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    const monthParam = params.get('month');
    const statusParam = params.get('status');
    const refParam = params.get('deliverableRef') || params.get('ref');
    const hrsParam = Number(params.get('hours'));
    const notesParam = params.get('notes');
    const partnerParam = (params.get('partner') || '').toUpperCase();

    if (
      viewParam === 'ledger' ||
      monthParam ||
      statusParam ||
      refParam ||
      hrsParam > 0 ||
      notesParam
    ) {
      activeLaborView.value = 'ledger';
    } else if (viewParam === 'tasks') {
      activeLaborView.value = 'tasks';
    }

    if (monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam)) {
      selectedMonth.value = monthParam;
    }
    if (statusParam === 'pending' || statusParam === 'approved' || statusParam === 'rejected') {
      statusFilter.value = statusParam;
    }
    if (refParam) form.value.deliverableRef = refParam;
    if (hrsParam > 0) form.value.hours = hrsParam;
    if (notesParam) form.value.notes = notesParam;
    if (
      isFounder.value &&
      (partnerParam === 'SWEAT' || partnerParam === 'PDXGL' || partnerParam === 'HUCK')
    ) {
      const idx = eligibleMembers.value.findIndex((m) => m.partner === partnerParam);
      if (idx >= 0) selectedMemberIdx.value = idx;
    }
  }
});
</script>
