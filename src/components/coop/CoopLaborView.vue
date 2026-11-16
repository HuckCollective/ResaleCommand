<template>
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
            {{ isLoadingLedger ? 'Syncing coop_ledger…' : isCloudSynced ? '🔒 Server coop_ledger' : 'Sign In Required' }}
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
          <strong>{{ legacyPendingMigrationCount }} legacy labor log(s)</strong> found in the old governance manifest. Import them into the server-enforced <code>coop_ledger</code> (marked <strong>Pending</strong> until you approve).
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

        <div
          v-if="!canLogLabor"
          class="rounded-xl border border-warning/35 bg-warning/10 p-3 text-xs text-base-content/80"
        >
          Sign in with an active Co-op work role (<code>owner</code>, <code>founder</code>, <code>curator</code>, <code>promoter</code>, or <code>enabler</code>) to log Sweat-Equity hours.
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
            <span
              class="label-text-alt text-[10px] font-mono font-bold"
              :class="classifySurplusLaborRole(form.category) === 'Enabler of Surplus' ? 'text-secondary' : 'text-primary'"
            >
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
                    ? 'Saving to coop_ledger…'
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
              class="btn btn-xs btn-success rounded-xl font-black gap-1"
              :disabled="isSaving"
              @click="openBulkApproveDrawer"
            >
              <span>✅ Approve Pending ({{ approvalSummary.pendingCount }})</span>
            </button>
            <a
              href="/coop/settlements"
              class="btn btn-xs btn-ghost border border-base-300 rounded-xl font-bold gap-1"
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
            class="btn btn-xs rounded-xl font-bold gap-1"
            :class="statusFilter === pill.id ? 'btn-secondary' : 'btn-ghost bg-base-200/70'"
            @click="statusFilter = pill.id"
          >
            <span>{{ pill.label }}</span>
            <span class="badge badge-2xs font-mono">{{ pill.count }}</span>
          </button>
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
            <input v-model="editDraft.date" type="date" class="input input-bordered input-sm rounded-xl font-mono text-xs" required />
          </div>
          <div class="form-control">
            <label class="label py-1"><span class="label-text font-bold">Hours</span></label>
            <input v-model.number="editDraft.hours" type="number" min="0.25" max="24" step="0.25" class="input input-bordered input-sm rounded-xl font-mono text-xs" required />
          </div>
        </div>

        <div class="form-control">
          <label class="label py-1"><span class="label-text font-bold">Category</span></label>
          <select v-model="editDraft.category" class="select select-bordered select-sm rounded-xl font-bold text-xs">
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
          <label class="label py-1"><span class="label-text font-bold">Deliverable Proof</span></label>
          <input v-model="editDraft.deliverableRef" type="text" class="input input-bordered input-sm rounded-xl text-xs" />
        </div>

        <div class="form-control">
          <label class="label py-1"><span class="label-text font-bold">Notes</span></label>
          <textarea v-model="editDraft.notes" rows="2" class="textarea textarea-bordered rounded-xl text-xs"></textarea>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn btn-sm btn-ghost rounded-xl" @click="drawerOpen = false">Cancel</button>
          <button type="submit" class="btn btn-sm btn-primary rounded-xl font-black" :disabled="isSaving">
            Save Changes
          </button>
        </div>
      </form>
    </SlideOverDrawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { Icon } from '@iconify/vue';
import SlideOverDrawer from '../common/SlideOverDrawer.vue';
import { addToast } from '../../stores/toast';
import { useAuth } from '../../composables/useAuth';
import { useCoopFounderGate } from '../../composables/useCoopFounderGate';
import { fetchCoopLaborLedger, mutateCoopLabor } from '../../lib/coopLedgerClient';
import { monthKeyToLabel } from '../../lib/salesBucketing';
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
const isSaving = ref(false);
const selectedMonth = ref<string>('all');
const statusFilter = ref<'all' | 'pending' | 'approved' | 'rejected'>('all');
const selectedMemberIdx = ref<number>(0);
const lockedMonths = ref<string[]>([]);
const versionsByMonth = ref<Record<string, number>>({});
const legacyPendingMigrationCount = ref(0);

const form = ref<{
  date: string;
  hours: number;
  category: CoopLaborCategory;
  deliverableRef: string;
  notes: string;
}>({
  date: pacificTodayYmd(),
  hours: 1.5,
  category: 'Social & Marketing',
  deliverableRef: '',
  notes: '',
});

// Drawer state (replaces window.prompt / window.confirm)
const drawerOpen = ref(false);
const drawerMode = ref<'decision' | 'bulkApprove' | 'edit'>('decision');
const decisionAction = ref<'reject' | 'unapprove'>('reject');
const activeEntry = ref<CoopLaborEntry | null>(null);
const decisionNoteInput = ref('');
const editDraft = ref<{
  date: string;
  hours: number;
  category: CoopLaborCategory;
  deliverableRef: string;
  notes: string;
} | null>(null);

const drawerTitle = computed(() => {
  if (drawerMode.value === 'bulkApprove') return 'Approve Pending Labor Hours';
  if (drawerMode.value === 'edit') return 'Edit Labor Entry';
  return decisionAction.value === 'reject' ? 'Reject Labor Entry' : 'Return Approved Entry to Pending';
});

const drawerSubtitle = computed(() => {
  if (drawerMode.value === 'bulkApprove') return 'Server-audited Founder approval into coop_ledger';
  if (drawerMode.value === 'edit') return 'Server-enforced month lock & approval reset rules';
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

    const res = await mutateCoopLabor({
      mode: 'log',
      date: form.value.date || pacificTodayYmd(),
      member: memberObj.name,
      partner: partnerPrefix,
      category: form.value.category,
      hours: Number(form.value.hours),
      deliverableRef: form.value.deliverableRef.trim() || undefined,
      notes: form.value.notes.trim() || `${form.value.category} contribution`,
    });

    await refreshServerLaborLedger();
    form.value.notes = '';
    form.value.deliverableRef = '';

    const statusMsg =
      res.entry?.approval === 'approved' ? 'Approved' : 'Pending Founder approval';
    addToast({
      type: 'success',
      message: `Logged ${res.entry?.hours ?? form.value.hours}h for ${memberObj.name} (${statusMsg}).`,
    });
  } catch (err: any) {
    addToast({
      type: 'error',
      message: err?.message || 'Failed to save labor entry.',
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
    hours: Number(entry.hours),
    category: entry.category,
    deliverableRef: entry.deliverableRef || '',
    notes: entry.notes || '',
  };
  drawerMode.value = 'edit';
  drawerOpen.value = true;
};

const submitEditDrawer = async () => {
  if (!activeEntry.value || !editDraft.value) return;
  const origMonth = laborEntryMonthKey(activeEntry.value.date);
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
      hours: Number(editDraft.value.hours),
      deliverableRef: editDraft.value.deliverableRef.trim() || undefined,
      notes: editDraft.value.notes.trim(),
      expectedVersion: origMonth ? versionsByMonth.value[origMonth] : undefined,
    });
    drawerOpen.value = false;
    await refreshServerLaborLedger();
    addToast({ type: 'success', message: 'Saved updated labor entry.' });
  } catch (err: any) {
    addToast({ type: 'error', message: err?.message || 'Failed to update labor entry.' });
  } finally {
    isSaving.value = false;
  }
};

const handleDeleteLabor = async (entry: CoopLaborEntry) => {
  const mk = laborEntryMonthKey(entry.date);
  if (!mk) return;
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
    addToast({ type: 'error', message: err?.message || 'Delete rejected by server.' });
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
      message: `Migrated ${res.migratedCount || 0} legacy labor log(s) into coop_ledger as Pending.`,
    });
  } catch (err: any) {
    addToast({ type: 'error', message: err?.message || 'Legacy migration failed.' });
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
    'Category',
    'WSDE_Role',
    'Hours',
    'Approval',
    'ApprovedBy',
    'ApprovedAt',
    'DecisionNote',
    'DeliverableRef',
    'Notes',
  ];
  const rows = filteredEntries.value.map((l) => [
    l.date,
    `"${l.member.replace(/"/g, '""')}"`,
    l.partner,
    `"${l.category}"`,
    `"${classifySurplusLaborRole(l.category)}"`,
    l.hours,
    effectiveLaborApproval(l),
    `"${(l.approvedBy || '').replace(/"/g, '""')}"`,
    l.approvedAt || '',
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
  await refreshCoopIdentity();
  const { state } = await loadCoopGovernanceState(
    [],
    currentTeam.value?.$id || 'huck_collective'
  );
  if (state.policyConfig) {
    policyConfig.value = state.policyConfig;
  }

  await refreshServerLaborLedger();

  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const monthParam = params.get('month');
    if (monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam)) {
      selectedMonth.value = monthParam;
    }
    const statusParam = params.get('status');
    if (statusParam === 'pending' || statusParam === 'approved' || statusParam === 'rejected') {
      statusFilter.value = statusParam;
    }
    const refParam = params.get('deliverableRef') || params.get('ref');
    const hrsParam = Number(params.get('hours'));
    const notesParam = params.get('notes');
    const partnerParam = (params.get('partner') || '').toUpperCase();
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
