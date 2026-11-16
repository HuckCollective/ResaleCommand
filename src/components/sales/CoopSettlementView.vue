<template>
  <div class="space-y-5">
    <!-- Compact Action & Statement Export Bar -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-base-100 border border-base-200 shadow-2xs rounded-2xl px-4 py-3">
      <div class="flex items-center gap-2 flex-wrap text-xs">
        <span class="badge badge-primary font-black text-xs px-2.5 py-1">
          {{ policyConfig.curatorSharePct }} / {{ policyConfig.commonsSharePct }} Payout Waterfall
        </span>
        <span class="badge badge-outline font-mono font-bold text-xs">
          {{ filteredSales.length }} {{ filteredSales.length === 1 ? 'sale' : 'sales' }} in scope
        </span>
        <span
          class="badge badge-xs font-mono font-bold"
          :class="settlementSummary.mondragonStatus.isPayRatioCompliant ? 'badge-success badge-outline' : 'badge-warning'"
          title="Advisory Mondragon pay-ratio solidarity status"
        >
          {{
            settlementSummary.mondragonStatus.isMondragon104545
              ? '🏛️ Mondragon 10/45/45'
              : `Split ${policyConfig.reserveSharePct}/${policyConfig.salesPatronagePct}/${policyConfig.laborPatronagePct}`
          }}
          ·
          {{
            settlementSummary.mondragonStatus.payRatioActual !== null
              ? `${settlementSummary.mondragonStatus.payRatioActual.toFixed(1)}:1 ≤ ${settlementSummary.mondragonStatus.payRatioCap}:1`
              : `Cap ${settlementSummary.mondragonStatus.payRatioCap}:1`
          }}
        </span>
      </div>

      <div class="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
        <button
          type="button"
          class="btn btn-sm btn-secondary btn-outline gap-1.5 rounded-xl font-bold h-11 min-h-11 md:h-9 md:min-h-9 px-3 text-xs"
          @click="openSweatDrawer()"
        >
          <Icon icon="solar:users-group-rounded-bold" class="w-4 h-4 shrink-0" />
          <span>🏦 Compare Cash vs. ICA &amp; Worker Logs</span>
        </button>

        <a
          href="/expenses"
          class="btn btn-sm btn-outline gap-1.5 rounded-xl font-bold h-11 min-h-11 md:h-9 md:min-h-9 px-3 text-xs bg-base-100"
          title="View shared commons expenses, receipts & reimbursements"
        >
          <Icon icon="solar:bill-list-bold" class="w-4 h-4 text-primary shrink-0" />
          <span>Commons Expenses</span>
        </a>

        <button
          type="button"
          class="btn btn-sm btn-success text-success-content font-black gap-1.5 shadow-sm rounded-xl h-11 min-h-11 md:h-9 md:min-h-9 px-3.5"
          :disabled="partnerSettlements.length === 0"
          title="Download official PDF settlement statements for all active partners & Sweat-Equity workers"
          @click="exportAllPartnerPdfs"
        >
          <Icon icon="solar:file-download-bold" class="w-4 h-4 shrink-0" />
          <span>Download All Statements (PDF)</span>
        </button>
      </div>
    </div>

    <!-- Server-Enforced Post-Payout Month Lock Bar -->
    <CoopMonthLockBar
      :period="selectedPeriod"
      :period-label="getPeriodLabel()"
      :location="selectedLocation"
      :is-month-in-progress="settlementSummary.isMonthInProgress"
      :pending-labor-count="settlementBundle.laborApproval.pendingCount"
      :can-lock-month="canLockMonth"
      :active-lock="activeMonthLock"
      :live-total-gross="liveComparisonBundle.summary.totalGross"
      :live-bonus-pool="liveComparisonBundle.summary.distributablePartnerBonusPool"
      :live-total-payout-checks="liveComparisonBundle.summary.totalCuratorPayouts"
      :is-submitting="isLockSubmitting"
      @lock-month="handleLockMonth"
      @unlock-month="handleUnlockMonth"
    />

    <!-- Venue Scope Guard Banner (§5 item 22) -->
    <div
      v-if="settlementSummary.isVenueScopedPreview"
      class="alert alert-info rounded-2xl py-2.5 text-xs flex items-center justify-between gap-2 flex-wrap"
    >
      <span>
        📍 <strong>Venue preview ({{ activeLocationMeta?.shortName || selectedLocation }}):</strong> Gates 1–3 item splits are shown for this venue. Collective overhead, Sweat-Equity labor, and Gate 4B / ICA bonuses settle on <strong>All Venues</strong> so hours are never double-paid.
      </span>
      <button
        type="button"
        class="btn btn-xs btn-primary rounded-xl font-bold"
        @click="emit('update:location', 'all')"
      >
        Switch to All Venues
      </button>
    </div>

    <!-- Pending Labor Approval Banner (§6) -->
    <div
      v-if="!settlementSummary.isVenueScopedPreview && !settlementSummary.isLockedSnapshot && settlementBundle.laborApproval.pendingHours > 0"
      class="alert alert-warning rounded-2xl py-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
    >
      <div class="flex items-center gap-2">
        <Icon icon="solar:clock-circle-bold" class="w-4 h-4 shrink-0" />
        <span>
          ⚠️ <strong>{{ settlementBundle.laborApproval.pendingCount }} pending labor log(s) ({{ settlementBundle.laborApproval.pendingHours.toFixed(2) }}h)</strong> are NOT included in Sweat-Equity dividends (worth $0 until approved).
        </span>
      </div>
      <a
        v-if="canApproveLabor"
        :href="`/coop/labor${selectedPeriod !== 'all' ? `?month=${selectedPeriod}&status=pending` : '?status=pending'}`"
        class="btn btn-xs btn-warning rounded-xl font-black shrink-0"
      >
        Review &amp; Approve ➔
      </a>
      <span v-else class="font-bold opacity-80 shrink-0">Ask a Founder to approve</span>
    </div>

    <!-- Excluded Invalid Labor / Unassigned Reimbursements / Zero-Sale Booth Warnings -->
    <div
      v-if="settlementBundle.laborApproval.invalidExcludedCount > 0 || settlementBundle.unassignedReimbursements.length > 0 || settlementBundle.zeroSaleBoothWarnings.length > 0"
      class="space-y-1.5"
    >
      <div
        v-if="settlementBundle.laborApproval.invalidExcludedCount > 0"
        class="alert alert-error rounded-xl py-2 text-xs flex items-center justify-between"
      >
        <span>
          ⚠️ {{ settlementBundle.laborApproval.invalidExcludedCount }} labor log(s) excluded — fix missing/invalid date or hours in <code>/coop/labor</code>.
        </span>
        <a href="/coop/labor" class="link font-bold">Fix in Labor ➔</a>
      </div>

      <div
        v-for="(reimb, rIdx) in settlementBundle.unassignedReimbursements"
        :key="`unassigned-${rIdx}`"
        class="alert alert-warning rounded-xl py-2 text-xs"
      >
        <span>
          ⚠️ <strong>Unassigned reimbursement (${{ reimb.amount.toFixed(2) }}):</strong> "{{ reimb.description }}" ({{ reimb.owner }} / {{ reimb.partner }}) could not be matched to an eligible Co-op partner or named Sweat-Equity worker.
        </span>
      </div>

      <div
        v-for="(wMsg, wIdx) in settlementBundle.zeroSaleBoothWarnings"
        :key="`zbooth-${wIdx}`"
        class="rounded-xl border border-base-300 bg-base-200/50 px-3 py-1.5 text-[11px] text-base-content/75 flex items-center gap-1.5"
      >
        <span>ℹ️</span>
        <span>{{ wMsg }}</span>
      </div>
    </div>

    <!-- Single 4-Card Plain-English Money Waterfall -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <div class="card bg-base-100 p-4 sm:p-5 rounded-2xl border border-base-200 shadow-sm space-y-1">
        <div class="text-[11px] font-bold text-base-content/60 uppercase tracking-wider">1. Register Gross Sales</div>
        <div class="text-2xl font-black text-base-content font-mono">${{ settlementSummary.totalGross.toFixed(2) }}</div>
        <div class="text-xs text-base-content/50 font-medium">
          Venue Cut ({{ settlementSummary.venueFeePct }}%): -${{ settlementSummary.totalVenueFee.toFixed(2) }}
        </div>
      </div>

      <div class="card bg-base-100 p-4 sm:p-5 rounded-2xl border border-success/30 shadow-sm space-y-1 bg-success/5">
        <div class="text-[11px] font-bold text-success uppercase tracking-wider flex items-center gap-1">
          <span>🛡️ 2. Cost Paid Back First</span>
        </div>
        <div class="text-2xl font-black text-success font-mono">+${{ settlementSummary.totalCostBasis.toFixed(2) }}</div>
        <div class="text-xs text-base-content/70 font-medium">
          100% Purchase &amp; Label Capital Recouped
          <span v-if="settlementSummary.totalUnrecoupedCost > 0" class="text-warning font-mono block">
            (Below-cost cap: ${{ settlementSummary.totalUnrecoupedCost.toFixed(2) }} unrecouped)
          </span>
        </div>
      </div>

      <div class="card bg-base-100 p-4 sm:p-5 rounded-2xl border border-primary/30 shadow-sm space-y-1 bg-primary/5">
        <div class="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
          <span>💎 3. Partner Cash Checks</span>
        </div>
        <div class="text-2xl font-black text-primary font-mono">+${{ settlementSummary.totalCuratorPayouts.toFixed(2) }}</div>
        <div class="text-xs text-base-content/70 font-medium">
          Cost + {{ policyConfig.curatorSharePct }}% Share + Gate 4B Cash Bonus
          <span v-if="settlementSummary.mondragonStatus.totalIcaRetained > 0" class="text-info font-mono block">
            (+${{ settlementSummary.mondragonStatus.totalIcaRetained.toFixed(2) }} ICA Credit Retained)
          </span>
        </div>
      </div>

      <div class="card bg-base-100 p-4 sm:p-5 rounded-2xl border border-warning/30 shadow-sm space-y-1.5 bg-warning/5">
        <div class="text-[11px] font-bold text-warning uppercase tracking-wider flex items-center justify-between gap-1">
          <span>🤝 4. Rent &amp; Ops Pool ({{ policyConfig.commonsSharePct }}%)</span>
          <a href="/expenses" class="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5">
            <span>Expenses</span>
            <Icon icon="solar:arrow-right-linear" class="w-3 h-3" />
          </a>
        </div>
        <div class="text-2xl font-black text-warning font-mono">+${{ settlementSummary.totalCommonsPool.toFixed(2) }}</div>
        <div class="text-[11px] text-base-content/70 font-medium space-y-0.5">
          <div class="flex justify-between">
            <span>Net Rent:</span>
            <span v-if="settlementSummary.isMonthInProgress" class="font-mono text-base-content/60 font-semibold">at month end</span>
            <span v-else class="font-mono text-error font-semibold">-${{ settlementSummary.netBoothRentForCoop.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between">
            <span>Tech Ops:</span>
            <span class="font-mono text-primary font-semibold">-${{ settlementSummary.techOps.toFixed(2) }}</span>
          </div>
          <div v-if="settlementSummary.supplies > 0" class="flex justify-between">
            <span>Supplies:</span>
            <span class="font-mono text-base-content/70 font-semibold">-${{ settlementSummary.supplies.toFixed(2) }}</span>
          </div>
        </div>
        <div class="text-xs font-bold pt-1 border-t border-warning/20" :class="settlementSummary.isCommonsFullyCovered ? 'text-success' : 'text-warning'">
          {{
            settlementSummary.isMonthInProgress
              ? 'Month in progress — booth rent bills at month end'
              : settlementSummary.isVenueScopedPreview
                ? '📍 Settles collectively on All Venues'
                : settlementSummary.isCommonsFullyCovered
                  ? `✅ Over Operating Costs (+$${settlementSummary.excessSurplus.toFixed(2)} Surplus)`
                  : `⚠️ Projected Carryover: -$${settlementSummary.remainingShortfall.toFixed(2)}`
          }}
        </div>
      </div>
    </div>

    <!-- Projected Next-Month Shortfall Carryover Bar (Read-Only + Explicit Founder Apply — §5 item 13) -->
    <div
      v-if="selectedPeriod !== 'all' && !settlementSummary.isMonthInProgress && !settlementSummary.isVenueScopedPreview && !settlementSummary.isLockedSnapshot && Math.abs(settlementSummary.remainingShortfall - Number(policyConfig.carriedOverShortfall || 0)) >= 0.01"
      class="rounded-2xl border border-warning/35 bg-warning/5 px-4 py-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
    >
      <span>
        📊 <strong>Projected next-month shortfall carryover:</strong>
        <code class="font-mono font-bold ml-1">${{ settlementSummary.remainingShortfall.toFixed(2) }}</code>
        <span class="opacity-70 ml-1">(Policy Dial 4 currently set to ${{ Number(policyConfig.carriedOverShortfall || 0).toFixed(2) }} — never auto-overwritten).</span>
      </span>
      <button
        v-if="canEditGlobalFinancials"
        type="button"
        class="btn btn-xs btn-warning rounded-xl font-black shrink-0"
        @click="applyShortfallToPolicy"
      >
        Apply ${{ settlementSummary.remainingShortfall.toFixed(2) }} to Policy
      </button>
    </div>

    <!-- ABOVE-THE-FOLD PARTNER PAYOUT CHECK SUMMARY TABLE -->
    <div v-if="partnerSettlements.length > 0" class="card bg-base-100 border border-base-200 shadow-sm rounded-2xl overflow-hidden">
      <div class="px-4 py-3 border-b border-base-200 flex items-center justify-between gap-2 flex-wrap bg-base-200/40">
        <div class="flex items-center gap-2">
          <Icon icon="solar:wad-of-money-bold-duotone" class="w-5 h-5 text-success" />
          <h3 class="text-sm sm:text-base font-black text-base-content">Partner &amp; Sweat-Equity Payout Summary</h3>
        </div>
        <span class="text-[11px] text-base-content/60 font-medium">
          Click any worker’s hours to inspect proof links &amp; compare Cash vs. Mondragon ICA
        </span>
      </div>
      <div class="overflow-x-auto">
        <table class="table table-xs sm:table-sm">
          <thead>
            <tr class="bg-base-200/70 text-base-content/70 font-bold">
              <th>Partner / Worker</th>
              <th>Role</th>
              <th class="text-right">Gross Sales</th>
              <th class="text-right">Venue Fee</th>
              <th class="text-right">100% Cost Recoup</th>
              <th class="text-right">Base ({{ policyConfig.curatorSharePct }}%)</th>
              <th class="text-right">Ops / Rent</th>
              <th class="text-right">Labor</th>
              <th class="text-right text-primary">Sales Bonus</th>
              <th class="text-right text-secondary">Sweat-Equity</th>
              <th class="text-right font-black">Final Cash Check</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="p in partnerSettlements"
              :key="'summary-' + p.rowKey"
              class="hover:bg-base-200/40 align-middle"
            >
              <td class="font-bold">
                <div>{{ p.name }} <span class="font-mono text-[10px] opacity-60">({{ p.prefix }})</span></div>
                <div v-if="p.reimbursements > 0" class="text-[10px] font-mono text-success">
                  +${{ p.reimbursements.toFixed(2) }} reimb.
                </div>
              </td>
              <td>
                <span
                  class="badge badge-xs font-bold whitespace-nowrap"
                  :class="
                    p.isConsignor
                      ? 'badge-warning'
                      : p.isSweatEnabler
                        ? 'badge-secondary'
                        : p.isCommonsPool
                          ? 'badge-ghost'
                          : 'badge-primary'
                  "
                >
                  {{
                    p.isConsignor
                      ? 'Consignor'
                      : p.isSweatEnabler
                        ? 'Sweat-Equity Enabler'
                        : p.isCommonsPool
                          ? 'Commons Pool'
                          : 'Co-op Partner'
                  }}
                </span>
              </td>
              <td class="text-right font-mono">${{ p.totalGross.toFixed(2) }}</td>
              <td class="text-right font-mono text-error">
                {{ p.totalVenueFee > 0 ? `-$${p.totalVenueFee.toFixed(2)}` : '$0.00' }}
              </td>
              <td class="text-right font-mono text-success">
                {{ p.isConsignor || p.isSweatEnabler ? '—' : `+$${p.totalCostBasis.toFixed(2)}` }}
              </td>
              <td class="text-right font-mono text-primary">
                {{ p.isConsignor || p.isSweatEnabler ? '—' : `+$${p.totalCuratorProfit.toFixed(2)}` }}
              </td>
              <td class="text-right font-mono text-warning whitespace-nowrap">
                <template v-if="p.isConsignor">
                  -${{ ((p.rentDeduction || 0) + (p.coopCommission || 0)).toFixed(2) }}
                  {{ p.dealMode === 'flat_commission' ? 'Co-op' : 'Rent' }}
                </template>
                <template v-else-if="p.isSweatEnabler">
                  $0 Inv
                </template>
                <template v-else>
                  ${{ p.totalCommonsTake.toFixed(2) }} ({{ policyConfig.commonsSharePct }}%)
                </template>
              </td>
              <td class="text-right font-mono whitespace-nowrap">
                <span v-if="p.isConsignor || p.isCommonsPool" class="opacity-45">—</span>
                <button
                  v-else
                  type="button"
                  class="btn btn-2xs btn-ghost font-mono font-bold text-secondary hover:bg-secondary/15 rounded-lg"
                  title="Inspect itemized Sweat-Equity logs & proof links"
                  @click="openSweatDrawer(p.isSweatEnabler ? p.name : p.prefix)"
                >
                  <span>{{ (p.laborHoursLogged || 0).toFixed(1) }}h</span>
                  <span v-if="(p.pendingLaborHours || 0) > 0" class="text-warning ml-0.5">
                    (+{{ (p.pendingLaborHours || 0).toFixed(1) }}p)
                  </span>
                </button>
              </td>
              <td class="text-right font-mono font-bold whitespace-nowrap">
                <span v-if="p.isConsignor || p.isCommonsPool" class="opacity-45">—</span>
                <span v-else-if="settlementSummary.isVenueScopedPreview" class="text-[10px] opacity-60">📍 All Venues</span>
                <span v-else-if="settlementSummary.isMonthInProgress" class="text-[10px] opacity-60">⏳ month end</span>
                <span v-else :class="(p.salesPatronageBonus || 0) > 0 ? 'text-primary' : 'opacity-50'">
                  +${{ (p.salesPatronageBonus || 0).toFixed(2) }}
                </span>
              </td>
              <td class="text-right font-mono font-bold whitespace-nowrap">
                <span v-if="p.isConsignor || p.isCommonsPool" class="opacity-45">—</span>
                <span v-else-if="settlementSummary.isVenueScopedPreview" class="text-[10px] opacity-60">📍 All Venues</span>
                <span v-else-if="settlementSummary.isMonthInProgress" class="text-[10px] opacity-60">⏳ month end</span>
                <span v-else :class="(p.laborBountyBonus || 0) > 0 ? 'text-secondary' : 'opacity-50'">
                  +${{ (p.laborBountyBonus || 0).toFixed(2) }}
                </span>
              </td>
              <td class="text-right font-mono whitespace-nowrap">
                <div class="font-black text-success">${{ p.totalPayoutCheck.toFixed(2) }}</div>
                <div
                  v-if="(p.icaRetainedCredit || 0) > 0"
                  class="badge badge-info badge-outline badge-2xs font-mono"
                  title="This month's retained Mondragon ICA credit (not yet recorded in a persistent ledger)"
                >
                  🏦 +${{ (p.icaRetainedCredit || 0).toFixed(2) }} ICA
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- COLLAPSIBLE ACCORDION: RENT BREAKEVEN, LABOR DIVIDENDS & POLICY SIMULATOR -->
    <details v-if="partnerSettlements.length > 0" class="collapse collapse-arrow bg-base-100 border border-primary/20 rounded-2xl shadow-2xs">
      <summary class="collapse-title font-bold text-xs sm:text-sm flex items-center justify-between gap-2 flex-wrap pr-10">
        <div class="flex items-center gap-2 flex-wrap">
          <span>⚙️ Rent Breakeven Progress, Sweat-Equity Labor &amp; Policy Simulator</span>
          <span
            class="badge badge-xs font-bold"
            :class="settlementSummary.commonsNetBalance > 0 ? 'badge-success text-success-content' : 'badge-warning text-warning-content'"
          >
            {{
              settlementSummary.isMonthInProgress
                ? '⏳ Month In Progress'
                : settlementSummary.isVenueScopedPreview
                  ? '📍 Venue Preview'
                  : settlementSummary.commonsNetBalance > 0
                    ? `+$${settlementSummary.commonsNetBalance.toFixed(2)} Over Ops`
                    : `$${Math.abs(settlementSummary.commonsNetBalance).toFixed(2)} Until Breakeven`
            }}
          </span>
          <span class="badge badge-xs badge-outline font-mono">
            Approved Labor: {{ settlementBundle.laborApproval.approvedHours.toFixed(1) }}h
          </span>
        </div>
      </summary>
      <div class="collapse-content space-y-4 pt-2 border-t border-base-200/70">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div class="space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <a
                href="/coop/governance?tab=rules"
                class="badge badge-sm badge-secondary text-secondary-content font-bold gap-1 hover:brightness-110 whitespace-nowrap shrink-0"
              >
                <Icon icon="solar:user-hand-up-bold" class="w-3 h-3" />
                <span>Configure Sliders ({{ policyConfig.reserveSharePct }}/{{ policyConfig.salesPatronagePct }}/{{ policyConfig.laborPatronagePct }}) ➔</span>
              </a>
              <button
                type="button"
                class="badge badge-sm badge-primary font-bold gap-1 cursor-pointer"
                @click="openSweatDrawer()"
              >
                <span>🏦 Cash vs. ICA ({{ policyConfig.icaRetainedPct || 0 }}%) &amp; Enabler Scope</span>
              </button>
              <a
                href="/coop/labor"
                class="badge badge-sm badge-outline border-accent/40 text-accent font-mono font-bold gap-1 hover:bg-accent/10 whitespace-nowrap shrink-0"
              >
                <Icon icon="solar:clock-circle-bold" class="w-3 h-3" />
                <span>Manage Labor Hours ➔</span>
              </a>
            </div>
            <p class="text-xs text-base-content/70">
              Once the {{ policyConfig.commonsSharePct }}% Rent &amp; Ops Pool covers Monthly Operating Costs &amp; prior shortfall, excess surplus distributes across Reserve ({{ policyConfig.reserveSharePct }}%), Sales Patronage ({{ policyConfig.salesPatronagePct }}%), and Sweat-Equity Labor ({{ policyConfig.laborPatronagePct }}%).
            </p>
          </div>

          <!-- Policy Mode & Partner Split Switchers (Founder-gated writes) -->
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            <div class="join bg-base-200/80 p-0.5 rounded-xl border border-base-300">
              <button
                type="button"
                class="join-item btn btn-xs font-bold rounded-lg px-2.5"
                :class="surplusPolicyMode === 'patronage_90_10' ? 'btn-primary text-primary-content' : 'btn-ghost opacity-75'"
                :disabled="!canEditGlobalFinancials || settlementSummary.isLockedSnapshot"
                @click="setSurplusPolicyMode('patronage_90_10')"
              >
                ⚖️ 90/10 Dividend
              </button>
              <button
                type="button"
                class="join-item btn btn-xs font-bold rounded-lg px-2.5"
                :class="surplusPolicyMode === 'cap_100' ? 'btn-primary text-primary-content' : 'btn-ghost opacity-75'"
                :disabled="!canEditGlobalFinancials || settlementSummary.isLockedSnapshot"
                @click="setSurplusPolicyMode('cap_100')"
              >
                🚀 100% Over Ops
              </button>
              <button
                type="button"
                class="join-item btn btn-xs font-bold rounded-lg px-2.5"
                :class="surplusPolicyMode === 'reserve_100' ? 'btn-primary text-primary-content' : 'btn-ghost opacity-75'"
                :disabled="!canEditGlobalFinancials || settlementSummary.isLockedSnapshot"
                @click="setSurplusPolicyMode('reserve_100')"
              >
                🛡️ 100% Reserve
              </button>
            </div>

            <div
              v-if="surplusPolicyMode !== 'reserve_100'"
              class="join bg-base-200/80 p-0.5 rounded-xl border border-base-300"
            >
              <button
                type="button"
                class="join-item btn btn-xs font-bold rounded-lg px-2"
                :class="surplusSplitBasis === 'volume' ? 'btn-secondary text-secondary-content' : 'btn-ghost opacity-75'"
                :disabled="!canEditGlobalFinancials || settlementSummary.isLockedSnapshot"
                @click="setSurplusSplitBasis('volume')"
              >
                📊 Pro-Rata Sales
              </button>
              <button
                type="button"
                class="join-item btn btn-xs font-bold rounded-lg px-2"
                :class="surplusSplitBasis === 'equal' ? 'btn-secondary text-secondary-content' : 'btn-ghost opacity-75'"
                :disabled="!canEditGlobalFinancials || settlementSummary.isLockedSnapshot"
                @click="setSurplusSplitBasis('equal')"
              >
                🤝 Equal Split
              </button>
            </div>
          </div>
        </div>

        <!-- Visual Operating Costs Breakeven Progress Bar -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-xs flex-wrap gap-2">
            <span class="font-bold text-base-content/80">
              {{ policyConfig.commonsSharePct }}% Pool Collected:
              <strong class="font-mono text-warning">${{ settlementSummary.totalCommonsPool.toFixed(2) }}</strong>
              <span class="opacity-60 mx-1">vs.</span>
              Operating Hurdle:
              <strong class="font-mono text-base-content">${{ settlementSummary.totalCommonsOverhead.toFixed(2) }}</strong>
              <span class="opacity-60 text-[11px]">
                (Rent ${{ settlementSummary.netBoothRentForCoop.toFixed(2) }} + Tech ${{ settlementSummary.techOps.toFixed(2) }} + Supplies ${{ settlementSummary.supplies.toFixed(2) }}<template v-if="settlementSummary.carriedOverShortfall > 0"> + Prior Shortfall ${{ settlementSummary.carriedOverShortfall.toFixed(2) }}</template>)
              </span>
            </span>
            <span class="font-mono font-black text-xs" :class="settlementSummary.distributablePartnerBonusPool > 0 ? 'text-success' : 'text-base-content/60'">
              Sales Pool: +${{ settlementSummary.salesPatronagePool.toFixed(2) }} · Labor Pool: +${{ settlementSummary.laborBonusPool.toFixed(2) }} · Reserve: +${{ settlementSummary.reserveAddition.toFixed(2) }}
            </span>
          </div>
          <div class="w-full h-3 rounded-full bg-base-300 overflow-hidden flex shadow-inner">
            <div
              class="transition-all duration-300"
              :class="settlementSummary.isCommonsFullyCovered ? 'bg-success' : 'bg-warning'"
              :style="{ width: `${settlementSummary.breakevenProgressPct}%` }"
            ></div>
          </div>
        </div>

        <!-- Sweat-Equity Worker Dividend Strip (Clickable -> Opens CoopSweatEquityDrawer) -->
        <div v-if="settlementBundle.allMemberShares.length > 0" class="p-3.5 rounded-2xl bg-base-200/50 border border-base-300 space-y-2">
          <div class="flex items-center justify-between flex-wrap gap-2 text-xs">
            <span class="font-extrabold uppercase tracking-wider text-secondary flex items-center gap-1.5">
              <Icon icon="solar:users-group-rounded-bold" class="w-4 h-4" />
              <span>Sweat-Equity &amp; Marketing Worker Dividend ({{ policyConfig.laborPatronagePct }}% Labor Pool = ${{ settlementSummary.laborBonusPool.toFixed(2) }})</span>
            </span>
            <span class="badge badge-xs badge-outline font-mono font-bold">
              Mondragon ICA Target Yield: {{ policyConfig.icaAnnualYieldRatePct || 7 }}%/yr
            </span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
            <button
              v-for="worker in settlementBundle.allMemberShares"
              :key="worker.member"
              type="button"
              class="text-left p-2.5 rounded-xl bg-base-100 border border-base-300 hover:border-secondary transition-colors flex items-center justify-between gap-2 cursor-pointer"
              @click="openSweatDrawer(worker.member)"
            >
              <div class="min-w-0">
                <div class="font-bold text-base-content truncate">{{ worker.member }}</div>
                <div class="text-[10px] text-base-content/60 flex items-center gap-1">
                  <span
                    class="badge badge-xs font-mono font-bold"
                    :class="worker.partner === 'SWEAT' ? 'badge-secondary' : worker.partner === 'PDXGL' ? 'badge-accent' : 'badge-primary'"
                  >
                    {{ worker.partner }}-
                  </span>
                  <span class="truncate">{{ worker.roleLabel }}</span>
                </div>
              </div>
              <div class="text-right shrink-0 font-mono">
                <div class="font-black text-success">
                  {{
                    settlementSummary.isMonthInProgress
                      ? '⏳ open'
                      : `+$${((settlementSummary.laborBonusPool * worker.sharePct) / 100).toFixed(2)}`
                  }}
                </div>
                <div class="text-[10px] text-base-content/60">
                  {{ worker.approvedHours.toFixed(1) }}h ({{ worker.sharePct }}%)
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </details>

    <!-- Empty State (Only when 0 rows AND 0 hours/reimbursements — §5 item 12) -->
    <div v-if="visiblePartnerSettlements.length === 0" class="card bg-base-100 border border-base-200 shadow-sm p-12 text-center">
      <div class="w-12 h-12 rounded-full bg-base-200 text-base-content/50 flex items-center justify-center mx-auto mb-3">
        <Icon icon="solar:document-text-linear" class="w-6 h-6" />
      </div>
      <h3 class="text-base font-bold">No sales, approved labor, or reimbursements in selected scope</h3>
      <p class="text-xs text-base-content/60 mt-1 max-w-sm mx-auto">
        Try adjusting the month/partner filter or switching to "All Channels &amp; Locations".
      </p>
    </div>

    <!-- Partner & Sweat-Equity Worker Settlement Cards -->
    <div v-else class="space-y-6">
      <div
        v-for="partner in visiblePartnerSettlements"
        :key="partner.rowKey"
        class="card bg-base-100 border border-base-300 shadow-md overflow-hidden rounded-2xl"
      >
        <!-- Card Header -->
        <div class="bg-base-200/70 p-4 sm:p-5 border-b border-base-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div
              class="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-lg shadow-xs"
              :class="partner.isSweatEnabler ? 'bg-secondary/15 text-secondary' : 'bg-primary/15 text-primary'"
            >
              {{ partner.isSweatEnabler ? '⚡' : partner.prefix.replace(/[-_]$/, '').slice(0, 2) }}
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="font-black text-lg text-base-content">{{ partner.name }}</h3>
                <span class="badge badge-sm badge-outline font-mono font-bold">{{ partner.prefix }}</span>
                <span
                  v-if="partner.isSweatEnabler"
                  class="badge badge-sm badge-secondary font-bold"
                >
                  Sweat-Equity Enabler ({{ (partner.laborHoursLogged || 0).toFixed(1) }}h)
                </span>
                <span v-else class="badge badge-sm badge-ghost font-bold">
                  {{ (partner.items || []).length }} {{ (partner.items || []).length === 1 ? 'item sold' : 'items sold' }}
                </span>
              </div>
              <p class="text-xs text-base-content/60">
                {{
                  partner.isConsignor
                    ? `Consignor deal: ${partner.dealFormulaLabel || 'Pro-Rata Booth Rent Share'}`
                    : partner.isSweatEnabler
                      ? '$0-Inventory Enabling Worker — Pro-Rata Gate 4B Sweat-Equity Dividend'
                      : `Governed under Huckleberry Collective ${policyConfig.curatorSharePct}/${policyConfig.commonsSharePct} Net Surplus Settlement`
                }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
            <div class="text-right">
              <div class="text-xs text-base-content/60 font-semibold uppercase tracking-wider">
                Final Cash Payout Check
              </div>
              <div class="text-2xl font-black font-mono" :class="partner.totalPayoutCheck < 0 ? 'text-error' : 'text-success'">
                ${{ partner.totalPayoutCheck.toFixed(2) }}
              </div>
              <div v-if="partner.reimbursements > 0" class="text-[11px] text-success font-bold flex items-center justify-end gap-1">
                <Icon icon="solar:bolt-bold" class="w-3.5 h-3.5" />
                <span>Includes +${{ partner.reimbursements.toFixed(2) }} Fronted Reimbursement</span>
              </div>
              <div v-if="(partner.icaRetainedCredit || 0) > 0" class="text-[11px] text-info font-mono font-bold">
                🏦 +${{ (partner.icaRetainedCredit || 0).toFixed(2) }} Mondragon ICA Credit
              </div>
            </div>
            <button
              v-if="partner.isConsignor"
              type="button"
              class="btn btn-sm btn-outline gap-1.5 rounded-xl font-bold"
              :disabled="settlementSummary.isLockedSnapshot"
              @click="openDealModal(partner)"
            >
              <Icon icon="solar:settings-bold-duotone" class="w-4 h-4 shrink-0" />
              <span>⚙️ Adjust Consignor Deal</span>
            </button>
            <button
              v-else-if="partner.isSweatEnabler || (partner.laborHoursLogged || 0) > 0"
              type="button"
              class="btn btn-sm btn-outline btn-secondary gap-1.5 rounded-xl font-bold"
              @click="openSweatDrawer(partner.isSweatEnabler ? partner.name : partner.prefix)"
            >
              <Icon icon="solar:clock-circle-bold-duotone" class="w-4 h-4 shrink-0" />
              <span>Logs &amp; Proof</span>
            </button>
            <button
              type="button"
              class="btn btn-sm btn-primary gap-1.5 shadow-sm rounded-xl font-bold"
              @click="downloadPartnerPdf(partner)"
            >
              <Icon icon="solar:document-medicine-bold" class="w-4 h-4 shrink-0" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>

        <!-- Financial Waterfall Bar (Dynamic Venue Fee % — Law 2) -->
        <div
          v-if="partner.isSweatEnabler"
          class="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-base-200/30 text-xs border-b border-base-200"
        >
          <div>
            <span class="opacity-60 block font-medium">Approved Hours:</span>
            <span class="font-bold font-mono text-sm text-secondary">
              {{ (partner.laborHoursLogged || 0).toFixed(2) }} hrs
            </span>
          </div>
          <div>
            <span class="opacity-60 block font-medium">Sweat-Equity Dividend:</span>
            <span class="font-mono text-sm text-success font-bold">
              {{
                settlementSummary.isMonthInProgress
                  ? '⏳ accrues at month end'
                  : `+$${(partner.laborBountyBonus || 0).toFixed(2)}`
              }}
            </span>
          </div>
          <div>
            <span class="opacity-60 block font-medium">Sales Pool Share:</span>
            <span class="font-mono text-sm text-primary font-bold">
              +${{ (partner.salesPatronageBonus || 0).toFixed(2) }}
            </span>
          </div>
          <div>
            <span class="opacity-60 block font-medium">Expense Reimbursements:</span>
            <span class="font-mono text-sm text-base-content font-bold">
              +${{ (partner.reimbursements || 0).toFixed(2) }}
            </span>
          </div>
        </div>

        <div
          v-else
          class="grid grid-cols-2 sm:grid-cols-6 gap-3 p-4 bg-base-200/30 text-xs border-b border-base-200"
        >
          <div>
            <span class="opacity-60 block font-medium">Gross Register:</span>
            <span class="font-bold font-mono text-sm text-base-content">${{ partner.totalGross.toFixed(2) }}</span>
          </div>
          <div>
            <span class="opacity-60 block font-medium">Venue Cut ({{ partnerVenueFeePct(partner) }}%):</span>
            <span class="font-mono text-sm text-error font-bold">-${{ partner.totalVenueFee.toFixed(2) }}</span>
          </div>
          <div v-if="partner.isConsignor">
            <span class="opacity-60 block font-medium">
              {{ partner.dealMode === 'flat_commission' ? 'Co-op Commission:' : partner.dealMode === 'fixed_shelf_rent' ? 'Shelf Rent:' : 'Booth Rent Share:' }}
            </span>
            <span class="font-mono text-sm text-warning font-bold">
              -${{ (partner.dealMode === 'flat_commission' ? (partner.coopCommission || 0) : (partner.rentDeduction || 0)).toFixed(2) }}
            </span>
          </div>
          <div v-else>
            <span class="opacity-60 block font-medium">100% Cost Recouped:</span>
            <span class="font-mono text-sm text-success font-bold">+${{ partner.totalCostBasis.toFixed(2) }}</span>
          </div>
          <div v-if="partner.isConsignor">
            <span class="opacity-60 block font-medium">Net Consignor Payout:</span>
            <span class="font-mono text-sm text-success font-bold">${{ partner.totalPayoutCheck.toFixed(2) }}</span>
          </div>
          <div v-else>
            <span class="opacity-60 block font-medium">{{ policyConfig.curatorSharePct }}% Base Profit:</span>
            <span class="font-mono text-sm text-primary font-bold">+${{ partner.totalCuratorProfit.toFixed(2) }}</span>
          </div>
          <div v-if="!partner.isConsignor">
            <span class="opacity-60 block font-medium">{{ policyConfig.commonsSharePct }}% Commons Pool:</span>
            <span class="font-mono text-sm text-warning font-bold">+${{ partner.totalCommonsTake.toFixed(2) }}</span>
          </div>
          <div v-if="!partner.isConsignor">
            <span class="opacity-60 block font-medium">Gate 4B Bonus (Sales + Labor):</span>
            <span class="font-mono text-sm text-success font-bold">
              {{
                settlementSummary.isVenueScopedPreview
                  ? '📍 All Venues'
                  : settlementSummary.isMonthInProgress
                    ? '⏳ Month End'
                    : `+$${(partner.bonusSurplusDividend || 0).toFixed(2)}`
              }}
            </span>
          </div>
          <div v-else class="sm:col-span-2">
            <span class="opacity-60 block font-medium">Relationship:</span>
            <span class="badge badge-sm badge-secondary font-bold">Consignor</span>
          </div>
        </div>

        <!-- Itemized Labor Logs Table (for $0-Inventory SWEAT- Workers & 0-Sale Labor Contributors) -->
        <div
          v-if="(partner.items || []).length === 0 && (partner.laborLogs || []).length > 0"
          class="overflow-x-auto max-h-72"
        >
          <table class="table table-xs table-pin-rows">
            <thead>
              <tr class="bg-base-200/60 text-base-content/70">
                <th>Work Date</th>
                <th>Category</th>
                <th>Approval</th>
                <th>Deliverable Proof / Contribution Notes</th>
                <th class="text-right font-bold text-secondary">Hours</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="lg in partner.laborLogs" :key="lg.id" class="hover:bg-base-200/40">
                <td class="font-mono text-xs whitespace-nowrap">{{ lg.date }}</td>
                <td class="text-xs font-semibold whitespace-nowrap">{{ lg.category }}</td>
                <td class="whitespace-nowrap">
                  <span
                    class="badge badge-xs font-bold"
                    :class="lg.approval === 'approved' ? 'badge-success' : 'badge-warning badge-outline'"
                  >
                    {{ lg.approval === 'approved' ? '✅ Approved' : '⏳ Pending ($0)' }}
                  </span>
                </td>
                <td class="max-w-md text-xs">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <a
                      v-if="lg.deliverableRef && /^https?:\/\//i.test(lg.deliverableRef)"
                      :href="lg.deliverableRef"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="link link-primary font-mono font-bold text-[11px]"
                    >
                      🔗 Open Proof Link ↗
                    </a>
                    <span v-else-if="lg.deliverableRef" class="badge badge-ghost badge-xs font-mono">
                      🔗 {{ lg.deliverableRef }}
                    </span>
                    <span class="truncate">{{ lg.notes }}</span>
                  </div>
                </td>
                <td class="text-right font-mono font-bold text-secondary">{{ Number(lg.hours).toFixed(2) }}h</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Itemized Sold SKU Table -->
        <div v-else-if="(partner.items || []).length > 0" class="overflow-x-auto max-h-72">
          <table class="table table-xs table-pin-rows">
            <thead>
              <tr class="bg-base-200/60 text-base-content/70">
                <th>Date</th>
                <th>SKU / UPC</th>
                <th>Description</th>
                <th class="text-right">Gross</th>
                <th class="text-right">Venue Fee</th>
                <th class="text-right">Cost Recoup</th>
                <th class="text-right">Net Surplus</th>
                <th class="text-right font-bold text-success">
                  {{ partner.isConsignor ? 'Net Deposit' : `Base Payout (Cost + ${policyConfig.curatorSharePct}%)` }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(it, iIdx) in partner.items" :key="iIdx" class="hover:bg-base-200/40">
                <td class="font-mono text-xs">{{ it.date ? String(it.date).slice(0, 10) : 'N/A' }}</td>
                <td class="font-mono text-xs font-semibold">{{ cleanSkuDisplay(it.sku) }}</td>
                <td class="max-w-xs">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <button
                      v-if="it.rawSale?.itemId"
                      type="button"
                      class="truncate font-medium text-left hover:text-primary cursor-pointer inline-flex items-center gap-1 max-w-full"
                      title="Inspect item in Side Drawer"
                      @click="$emit('inspect-item', it.rawSale.itemId)"
                    >
                      <span class="truncate">{{ it.title }}</span>
                      <Icon icon="solar:eye-linear" class="w-3 h-3 text-primary shrink-0" />
                    </button>
                    <span v-else class="truncate font-medium">{{ it.title }}</span>
                    <span
                      v-if="isUnlinkedRow(it)"
                      class="badge badge-xs badge-warning font-black"
                    >
                      ⚠️ Unlinked Ticket
                    </span>
                    <button
                      v-if="isUnlinkedRow(it) && !settlementSummary.isLockedSnapshot"
                      type="button"
                      class="btn btn-xs btn-warning font-black h-5 min-h-0 px-2 rounded-md"
                      @click="$emit('link-sale', it.rawSale)"
                    >
                      Link Inventory
                    </button>
                    <button
                      v-else-if="it.rawSale && !settlementSummary.isLockedSnapshot"
                      type="button"
                      class="btn btn-ghost btn-xs h-5 min-h-0 px-1.5 text-[10px] opacity-60 hover:opacity-100"
                      @click="$emit('link-sale', it.rawSale)"
                    >
                      ⇄ Reassign
                    </button>
                  </div>
                </td>
                <td class="text-right font-mono font-semibold">${{ it.grossPrice.toFixed(2) }}</td>
                <td class="text-right font-mono text-error">-${{ it.venueFee.toFixed(2) }}</td>
                <td class="text-right font-mono text-success font-semibold">${{ it.costBasis.toFixed(2) }}</td>
                <td class="text-right font-mono">${{ it.netSurplus.toFixed(2) }}</td>
                <td class="text-right font-mono font-bold text-success">${{ it.curatorTake.toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Venue check, booth rent & shared overhead -->
    <details class="collapse collapse-arrow bg-base-100 border border-base-200 rounded-2xl shadow-sm">
      <summary class="collapse-title font-bold text-sm flex items-center gap-2">
        <span>🏪 Venue check, booth rent &amp; shared overhead</span>
        <span class="badge badge-ghost badge-sm font-mono">Venue reconciliation</span>
      </summary>
      <div class="collapse-content space-y-6">
        <div class="card bg-base-100 border border-base-200 shadow-sm rounded-2xl p-4 sm:p-5 space-y-3">
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-base-200 pb-3">
            <div>
              <span class="text-xs font-bold text-base-content/60 uppercase tracking-wider">
                Monthly Venue Settlement Check Reconciler
              </span>
              <div class="text-lg font-black text-base-content flex items-center gap-2">
                <span>Period: {{ getPeriodLabel() }}</span>
                <span class="badge badge-primary font-mono text-xs font-bold">{{ filteredSales.length }} items</span>
              </div>
            </div>
            <div class="text-left sm:text-right">
              <span class="text-xs text-base-content/60 font-semibold block uppercase">Actual Net Venue Deposit:</span>
              <span class="text-2xl font-black font-mono" :class="settlementSummary.memoryDenNetCheck >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-error'">
                ${{ settlementSummary.memoryDenNetCheck.toFixed(2) }}
              </span>
            </div>
          </div>

          <div class="alert alert-info/10 border border-info/30 rounded-xl py-2.5 px-3.5 text-xs flex items-center gap-2.5 text-base-content">
            <Icon icon="solar:calendar-date-bold-duotone" class="w-5 h-5 text-info shrink-0" />
            <div class="flex-1">
              <strong class="font-bold text-info">Venue Payout Schedule:</strong>
              <span class="opacity-80 ml-1">Booth settlement checks deposit on <strong>{{ memoryDenDisbursementDate }}</strong>. Partner checks disburse after the venue deposit clears.</span>
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs">
            <div>
              <span class="text-base-content/60 block">1. Gross Register Sales</span>
              <span class="font-bold font-mono text-sm text-base-content">${{ settlementSummary.totalGross.toFixed(2) }}</span>
            </div>
            <div>
              <span class="text-error block">2. Venue Fee ({{ settlementSummary.venueFeePct }}%)</span>
              <span class="font-bold font-mono text-sm text-error">-${{ settlementSummary.totalVenueFee.toFixed(2) }}</span>
            </div>
            <div>
              <span class="text-warning block">3. Booth Space Rental</span>
              <span class="font-bold font-mono text-sm text-warning font-black">-${{ settlementSummary.boothRent.toFixed(2) }}</span>
            </div>
            <div>
              <span class="text-primary block">4. Net Mall Deposit</span>
              <span class="font-bold font-mono text-sm text-primary font-black">${{ settlementSummary.memoryDenNetCheck.toFixed(2) }}</span>
            </div>
          </div>
        </div>

        <!-- Tier 1 Commons Overhead & Tech Ops Ledger -->
        <div class="card bg-base-100 border border-base-200 shadow-sm rounded-2xl p-4 sm:p-5">
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-base-200 pb-3">
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="badge badge-warning font-black text-xs px-2.5 py-0.5">Tier 1 Covered First</span>
                <span class="badge badge-outline font-mono text-xs">{{ filteredExpenses.length }} Co-op Shared Receipts</span>
                <a
                  v-if="personalWriteOffSummary.count > 0"
                  href="/expenses"
                  class="badge badge-secondary badge-outline font-mono font-bold text-xs"
                >
                  👤 {{ personalWriteOffSummary.count }} Personal Write-Offs (${{ personalWriteOffSummary.amount.toFixed(2) }}) Excluded from Co-op Pool
                </a>
              </div>
              <h3 class="text-base font-black text-base-content tracking-tight mt-1 flex items-center gap-2">
                <Icon icon="solar:bolt-bold-duotone" class="w-5 h-5 text-warning shrink-0" />
                <span>Tier 1 Shared Overhead &amp; Tech Ops</span>
              </h3>
              <p class="text-xs text-base-content/60">
                Paid collectively by the {{ policyConfig.commonsSharePct }}% Commons Pool. Covers fixed booth space, tech hosting, AI tokens, and supplies.
              </p>
            </div>
            <div class="text-left sm:text-right">
              <span class="text-xs text-base-content/60 font-semibold block uppercase">Total Overhead &amp; Tech:</span>
              <span class="text-xl font-black font-mono text-warning">
                ${{ settlementSummary.totalCommonsOverhead.toFixed(2) }}
              </span>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
            <div class="p-3 rounded-xl bg-base-200/50 border border-base-200 space-y-1">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-base-content/70">🏪 Booth Space Rent</span>
                <span class="badge badge-xs badge-neutral font-mono font-bold">Live Warehouse Config</span>
              </div>
              <div class="text-lg font-black font-mono text-base-content">
                ${{ settlementSummary.boothRent.toFixed(2) }}
              </div>
              <p class="text-[11px] text-base-content/50">Active booth monthly space rental</p>
            </div>

            <div class="p-3 rounded-xl bg-base-200/50 border border-base-200 space-y-1">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-base-content/70">⚡ Tech Commons &amp; AI</span>
                <span class="badge badge-xs badge-primary font-mono font-bold">{{ techOpsExpenses.length }} items</span>
              </div>
              <div class="text-lg font-black font-mono text-primary">
                ${{ settlementSummary.techOps.toFixed(2) }}
              </div>
              <p class="text-[11px] text-base-content/50">Appwrite DB, Gemini AI credits, hosting</p>
            </div>

            <div class="p-3 rounded-xl bg-base-200/50 border border-base-200 space-y-1">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-base-content/70">🏷️ Merch Supplies &amp; Ops</span>
                <span class="badge badge-xs badge-ghost font-mono font-bold">{{ suppliesExpenses.length }} items</span>
              </div>
              <div class="text-lg font-black font-mono text-base-content">
                ${{ settlementSummary.supplies.toFixed(2) }}
              </div>
              <p class="text-[11px] text-base-content/50">Thermal tags, barcodes, displays</p>
            </div>
          </div>
        </div>
      </div>
    </details>

    <!-- Sweat-Equity, Cash vs. ICA & Pool Scope SlideOverDrawer -->
    <CoopSweatEquityDrawer
      v-model="sweatDrawerOpen"
      :period-key="selectedPeriod"
      :period-label="getPeriodLabel()"
      :policy-config="policyConfig"
      :surplus-split-basis="surplusSplitBasis"
      :mondragon-status="settlementSummary.mondragonStatus"
      :actual-distributable-pool="settlementSummary.distributablePartnerBonusPool"
      :actual-labor-pool="settlementSummary.laborBonusPool"
      :member-shares="settlementBundle.allMemberShares"
      :settlement-rows="partnerSettlements"
      :can-save-policy="canEditGlobalFinancials"
      :is-locked-month="settlementSummary.isLockedSnapshot"
      :focused-member="focusedWorkerOrPartner"
      :latest-approved-at="settlementBundle.laborApproval.latestApprovedAt"
      :last-pdf-export-at="lastPdfExportTimestamp"
      @save-policy="handleSaveSweatPolicy"
      @download-pdf="downloadPartnerPdf"
      @clear-focus="focusedWorkerOrPartner = ''"
    />

    <!-- Consignor Deal Quick-Adjust & 3-Mode Interactive Comparison Modal -->
    <dialog :class="{ 'modal modal-open': dealModalPartner && dealDraft }" class="modal">
      <div v-if="dealModalPartner && dealDraft" class="modal-box max-w-2xl rounded-3xl p-5 sm:p-6 space-y-4">
        <div class="flex items-center justify-between border-b border-base-200 pb-3">
          <div>
            <div class="badge badge-secondary badge-xs font-mono font-bold mb-1">{{ dealDraft.prefix }} CONSIGNOR</div>
            <h3 class="font-black text-lg">⚙️ Consignor Deal &amp; Live Mode Comparison — {{ dealDraft.displayName }}</h3>
          </div>
          <button type="button" class="btn btn-ghost btn-sm btn-circle" @click="closeDealModal">✕</button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-base-200/50 border border-base-300">
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-extrabold uppercase tracking-wider text-primary">✂️ % Split (After Venue Take)</span>
              <span class="badge badge-primary badge-sm font-mono font-black">
                {{ dealDraft.coopCommissionPct }}% Co-op / {{ 100 - dealDraft.coopCommissionPct }}% Consignor
              </span>
            </div>
            <div class="flex items-center gap-2">
              <input
                v-model.number="dealDraft.coopCommissionPct"
                type="range"
                min="0"
                max="60"
                step="1"
                class="range range-primary range-xs flex-1"
              />
              <div class="join">
                <input
                  v-model.number="dealDraft.coopCommissionPct"
                  type="number"
                  min="0"
                  max="60"
                  step="1"
                  class="input input-bordered input-xs w-14 font-mono font-bold text-right join-item"
                />
                <span class="btn btn-xs btn-ghost border border-base-300 join-item pointer-events-none font-mono">%</span>
              </div>
            </div>
            <div class="flex items-center gap-1 flex-wrap">
              <span class="text-[10px] font-bold opacity-60 mr-1">Quick %:</span>
              <button
                v-for="pct in [10, 15, 20, 25, 30, 50]"
                :key="pct"
                type="button"
                class="btn btn-xs h-6 min-h-0 px-2 rounded-lg font-mono"
                :class="dealDraft.coopCommissionPct === pct && dealDraft.mode === 'flat_commission' ? 'btn-primary' : 'btn-ghost border border-base-300'"
                @click="dealDraft.coopCommissionPct = pct; dealDraft.mode = 'flat_commission'"
              >
                {{ pct }}% / {{ 100 - pct }}%
              </button>
            </div>
            <p class="text-[11px] text-base-content/65">
              Taken out of the <strong>Net Store Deposit</strong> (after the live venue commission rate).
            </p>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-extrabold uppercase tracking-wider text-warning">🏪 Fixed Shelf Rent ($/mo)</span>
              <span class="badge badge-warning badge-sm font-mono font-black">${{ Number(dealDraft.fixedMonthlyRent || 0).toFixed(2) }}/mo</span>
            </div>
            <div class="flex items-center gap-2">
              <input
                v-model.number="dealDraft.fixedMonthlyRent"
                type="number"
                min="0"
                step="5"
                class="input input-bordered input-sm rounded-xl font-mono font-bold w-full"
              />
            </div>
            <div class="flex items-center gap-1 flex-wrap">
              <span class="text-[10px] font-bold opacity-60 mr-1">Presets:</span>
              <button
                v-for="amt in [0, 35, 50, 75]"
                :key="amt"
                type="button"
                class="btn btn-xs h-6 min-h-0 px-2 rounded-lg font-mono"
                :class="Number(dealDraft.fixedMonthlyRent) === amt && dealDraft.mode === 'fixed_shelf_rent' ? 'btn-warning' : 'btn-ghost border border-base-300'"
                @click="dealDraft.fixedMonthlyRent = amt; if (amt > 0) dealDraft.mode = 'fixed_shelf_rent'"
              >
                ${{ amt }}
              </button>
            </div>
            <label class="label cursor-pointer justify-start gap-2 py-0 pt-1">
              <input v-model="dealDraft.capRentAtNetSales" type="checkbox" class="checkbox checkbox-xs checkbox-primary" />
              <span class="label-text text-[11px] font-bold">Never let rent push payout below $0</span>
            </label>
          </div>
        </div>

        <div v-if="dealModeComparison" class="space-y-2.5">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <span class="text-xs font-extrabold uppercase tracking-wider text-base-content/75">
              🔍 Click Any Card Below to Pick That Deal Mode ({{ dealModeComparison.basisLabel }}):
            </span>
            <div class="join border border-base-300 rounded-xl bg-base-200/60 p-0.5">
              <button
                type="button"
                class="join-item btn btn-xs h-6 min-h-0 px-2 rounded-lg font-mono"
                :class="dealSampleGross === 0 ? 'btn-neutral' : 'btn-ghost'"
                @click="dealSampleGross = 0"
              >
                Actual (${{ dealModalPartner.totalGross.toFixed(0) }})
              </button>
              <button
                v-for="sample in [100, 250, 500]"
                :key="sample"
                type="button"
                class="join-item btn btn-xs h-6 min-h-0 px-2 rounded-lg font-mono"
                :class="dealSampleGross === sample ? 'btn-neutral' : 'btn-ghost'"
                @click="dealSampleGross = sample"
              >
                Ex: ${{ sample }}
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <button
              v-for="card in dealModeComparison.cards"
              :key="card.mode"
              type="button"
              class="text-left p-3.5 rounded-2xl border-2 transition-all space-y-2 flex flex-col justify-between"
              :class="dealDraft.mode === card.mode ? 'border-primary bg-primary/10 shadow-sm' : 'border-base-300 bg-base-100 hover:border-base-content/30'"
              @click="dealDraft.mode = card.mode"
            >
              <div class="space-y-1.5">
                <div class="flex items-center justify-between gap-1">
                  <span class="font-black text-xs text-base-content">{{ card.title }}</span>
                  <span v-if="dealDraft.mode === card.mode" class="badge badge-xs badge-primary font-bold">ACTIVE</span>
                </div>
                <p class="text-[11px] text-base-content/65 leading-snug">{{ card.subtitle }}</p>
                <div class="pt-1 border-t border-base-300/80 space-y-1 font-mono text-[11px]">
                  <div class="flex justify-between">
                    <span class="opacity-65">Gross Sales:</span>
                    <span>${{ dealModeComparison.gross.toFixed(2) }}</span>
                  </div>
                  <div class="flex justify-between text-error">
                    <span>Venue Take ({{ dealModeComparison.venueFeePct }}%):</span>
                    <span>-${{ dealModeComparison.venueFee.toFixed(2) }}</span>
                  </div>
                  <div class="flex justify-between font-bold border-b border-base-300/60 pb-1">
                    <span>After Venue Take:</span>
                    <span>${{ dealModeComparison.netAfterVenue.toFixed(2) }}</span>
                  </div>
                  <div v-if="card.result.rentDeduction > 0" class="flex justify-between text-warning">
                    <span>Shelf / Booth Rent:</span>
                    <span>-${{ card.result.rentDeduction.toFixed(2) }}</span>
                  </div>
                  <div v-if="card.result.coopCommission > 0" class="flex justify-between text-primary">
                    <span>Co-op Cut ({{ dealDraft.coopCommissionPct }}%):</span>
                    <span>-${{ card.result.coopCommission.toFixed(2) }}</span>
                  </div>
                </div>
              </div>

              <div class="pt-2 border-t border-base-300 font-mono">
                <div class="flex items-center justify-between">
                  <span class="text-[10px] font-sans font-bold uppercase opacity-70">Consignor Gets:</span>
                  <span class="text-sm font-black text-success">${{ card.result.payout.toFixed(2) }}</span>
                </div>
                <div class="flex items-center justify-between text-[10px] text-base-content/60">
                  <span class="font-sans">Co-op Gets:</span>
                  <span class="font-bold text-warning">+${{ (card.result.rentDeduction + card.result.coopCommission).toFixed(2) }}</span>
                </div>
              </div>
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between gap-2 pt-3 border-t border-base-200">
          <div class="text-xs font-mono">
            Selected: <strong class="text-primary">{{ CONSIGNOR_DEAL_MODE_LABELS[dealDraft.mode] }}</strong>
          </div>
          <div class="flex gap-2">
            <button type="button" class="btn btn-sm btn-ghost rounded-xl" @click="closeDealModal">Cancel</button>
            <button
              type="button"
              class="btn btn-sm btn-primary rounded-xl font-black px-5"
              :disabled="isSavingDeal || !canEditGlobalFinancials"
              @click="saveDeal"
            >
              {{ isSavingDeal ? 'Saving...' : 'Save & Sync Deal' }}
            </button>
          </div>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop"><button @click="closeDealModal">close</button></form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { addToast } from '../../stores/toast';
import { useAuth } from '../../composables/useAuth';
import { useCoopFounderGate } from '../../composables/useCoopFounderGate';
import CoopSweatEquityDrawer from '../coop/CoopSweatEquityDrawer.vue';
import CoopMonthLockBar from '../coop/CoopMonthLockBar.vue';
import {
  buildPartnerPdfFilename,
  generatePartnerSettlementPdf,
  type PartnerStatementData,
} from '../../lib/coopSettlementPdf';
import { coopExpensesApi, type CoopExpenseItem } from '../../lib/coopExpenses';
import {
  fetchCoopLaborLedger,
  fetchCoopMonthLocks,
  lockCoopMonth,
  unlockCoopMonth,
} from '../../lib/coopLedgerClient';
import {
  loadCoopGovernanceState,
  saveCoopGovernanceState,
  currentPacificMonthKey as getCurrentPacificMonthKey,
  isSettlementEligibleLabor,
  laborEntryMonthKey,
  pacificTodayYmd,
  DEFAULT_COOP_POLICY_CONFIG,
  CONSIGNOR_DEAL_MODE_LABELS,
  calculateConsignorSettlement,
  findConsignorAgreement,
  type ConsignorAgreementConfig,
  type ConsignorDealMode,
  type SurplusPolicyMode,
  type SurplusSplitBasis,
  type CoopPolicyConfig,
  type CoopLaborEntry,
} from '../../lib/coopGovernance';
import {
  buildMonthlySettlementFromInputs,
  expenseMonthKey,
  resolveSaleLocationCode,
  type EnrichedPartnerSettlement,
} from '../../lib/coop/settlementInputs';
import { cleanSkuDisplay, pacificMonthKey, monthKeyToLabel } from '../../lib/salesBucketing';
import {
  getAllLocationSettingMetas,
  getLocationSettingMeta,
  resolveCanonicalLocationCode,
} from '../../lib/warehouses';
import type { CoopMonthLockSnapshot } from '../../types/coop';

interface SaleItem {
  id: string;
  soNumber?: string;
  title?: string;
  upc?: string;
  sku?: string;
  locationName?: string;
  date?: string;
  status?: string;
  grossAmount?: number;
  fees?: number;
  netPayout?: number;
  shippingCost?: number;
  cost?: number;
}

const props = defineProps<{
  sales: SaleItem[];
  period?: string;
  location?: string;
  partnerFilter?: string;
  monthlyRent?: number;
  warehouses?: any[];
}>();

const emit = defineEmits<{
  (e: 'update:period', value: string): void;
  (e: 'update:location', value: string): void;
  (e: 'link-sale', sale: any): void;
  (e: 'inspect-item', itemId: string): void;
  (e: 'sweat-count', count: number): void;
}>();

const isUnlinkedRow = (it: any): boolean => {
  const rawOrd = String(it?.rawSale?.orderId || '').trim().toUpperCase();
  if (
    rawOrd.includes('-SHEET') ||
    rawOrd.startsWith('ONLINE') ||
    rawOrd.startsWith('EBAY') ||
    rawOrd.startsWith('POSH') ||
    rawOrd.startsWith('POPUP')
  ) {
    return false;
  }
  const title = String(it?.title || '').trim();
  const sku = String(it?.sku || '').trim();
  return /^ticket\s*#/i.test(title) || /^order\s+/i.test(title) || /^SO-/i.test(sku);
};

const { currentTeam } = useAuth();
const selectedPeriod = ref<string>('all');
const selectedLocation = ref<string>(props.location || 'all');

const surplusPolicyMode = ref<SurplusPolicyMode>('patronage_90_10');
const surplusSplitBasis = ref<SurplusSplitBasis>('volume');
const policyConfig = ref<CoopPolicyConfig>({ ...DEFAULT_COOP_POLICY_CONFIG });
const laborEntries = ref<CoopLaborEntry[]>([]);
const locksByMonth = ref<Record<string, CoopMonthLockSnapshot>>({});
const isLockSubmitting = ref(false);

const rosterRef = computed(() => policyConfig.value.members);
const {
  canApproveLabor,
  canLockMonth,
  canEditGlobalFinancials,
  refreshCoopIdentity,
} = useCoopFounderGate(rosterRef);

// Sweat-Equity Drawer State
const sweatDrawerOpen = ref(false);
const focusedWorkerOrPartner = ref('');
const lastPdfExportTimestamp = ref('');

function readLastPdfExportTimestamp(periodKey: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(`rc_coop_pdf_export_${periodKey}`) || '';
  } catch {
    return '';
  }
}

function recordPdfExportTimestamp(periodKey: string) {
  if (typeof window === 'undefined') return;
  try {
    const ts = new Date().toISOString();
    localStorage.setItem(`rc_coop_pdf_export_${periodKey}`, ts);
    lastPdfExportTimestamp.value = ts;
  } catch {
    // Best-effort client audit notice
  }
}

function openSweatDrawer(focus = '') {
  focusedWorkerOrPartner.value = focus;
  lastPdfExportTimestamp.value = readLastPdfExportTimestamp(selectedPeriod.value);
  sweatDrawerOpen.value = true;
}

const boothLocationMetas = computed(() =>
  getAllLocationSettingMetas(props.warehouses).filter(
    (m) => m.monthlyRent > 0 || m.commissionRate > 0
  )
);

const activeLocationMeta = computed(() => {
  if (selectedLocation.value === 'all') return null;
  return getLocationSettingMeta(selectedLocation.value, props.warehouses);
});

const activeMonthLock = computed<CoopMonthLockSnapshot | null>(() => {
  if (selectedPeriod.value === 'all' || selectedLocation.value !== 'all') return null;
  return locksByMonth.value[selectedPeriod.value] || null;
});

const setSurplusPolicyMode = async (mode: SurplusPolicyMode) => {
  if (!canEditGlobalFinancials.value) return;
  surplusPolicyMode.value = mode;
  await saveCoopGovernanceState(
    { surplusPolicyMode: mode, surplusSplitBasis: surplusSplitBasis.value },
    currentTeam.value?.$id || 'huck_collective'
  );
};

const setSurplusSplitBasis = async (basis: SurplusSplitBasis) => {
  if (!canEditGlobalFinancials.value) return;
  surplusSplitBasis.value = basis;
  await saveCoopGovernanceState(
    { surplusPolicyMode: surplusPolicyMode.value, surplusSplitBasis: basis },
    currentTeam.value?.$id || 'huck_collective'
  );
};

const handleSaveSweatPolicy = async (payload: {
  policyConfig: CoopPolicyConfig;
  surplusSplitBasis: SurplusSplitBasis;
}) => {
  if (!canEditGlobalFinancials.value) return;
  policyConfig.value = payload.policyConfig;
  surplusSplitBasis.value = payload.surplusSplitBasis;
  const ok = await saveCoopGovernanceState(
    {
      policyConfig: payload.policyConfig,
      surplusSplitBasis: payload.surplusSplitBasis,
      surplusPolicyMode: surplusPolicyMode.value,
    },
    currentTeam.value?.$id || 'huck_collective'
  );
  addToast({
    type: ok ? 'success' : 'warning',
    message: ok
      ? 'Saved Sweat-Equity & Mondragon ICA policy to cloud!'
      : 'Saved locally; cloud sync unavailable.',
  });
};

const applyShortfallToPolicy = async () => {
  if (!canEditGlobalFinancials.value) return;
  const next = {
    ...policyConfig.value,
    carriedOverShortfall: settlementSummary.value.remainingShortfall,
  };
  policyConfig.value = next;
  const ok = await saveCoopGovernanceState(
    { policyConfig: next },
    currentTeam.value?.$id || 'huck_collective'
  );
  addToast({
    type: ok ? 'success' : 'warning',
    message: `Applied $${next.carriedOverShortfall.toFixed(2)} projected shortfall carryover to Policy Dial 4.`,
  });
};

// Shared Commons Expenses State
const expenses = ref<CoopExpenseItem[]>([]);

const loadExpenses = async () => {
  if (!currentTeam.value) return;
  try {
    expenses.value = await coopExpensesApi.listExpenses(currentTeam.value.$id);
  } catch (e) {
    console.warn('[CoopSettlementView] Failed to load expenses:', e);
  }
};

const refreshServerLedgerAndLocks = async () => {
  try {
    const [laborRes, lockRes] = await Promise.all([
      fetchCoopLaborLedger('all'),
      fetchCoopMonthLocks('all'),
    ]);
    laborEntries.value = laborRes.entries || [];
    locksByMonth.value = lockRes.locksByMonth || {};
  } catch {
    // Non-members / logged-out sessions fall back cleanly to empty labor/lock maps
  }
};

onMounted(async () => {
  await refreshCoopIdentity();
  loadExpenses();
  const { state } = await loadCoopGovernanceState(
    [],
    currentTeam.value?.$id || 'huck_collective'
  );
  surplusPolicyMode.value = state.surplusPolicyMode;
  surplusSplitBasis.value = state.surplusSplitBasis;
  if (state.policyConfig) {
    policyConfig.value = state.policyConfig;
  }
  await refreshServerLedgerAndLocks();
  lastPdfExportTimestamp.value = readLastPdfExportTimestamp(selectedPeriod.value);
});

watch(currentTeam, (n) => {
  if (n) loadExpenses();
});

watch(
  () => props.period,
  (p) => {
    if (p && p !== selectedPeriod.value) {
      selectedPeriod.value = p;
      lastPdfExportTimestamp.value = readLastPdfExportTimestamp(p);
    }
  },
  { immediate: true }
);

watch(
  () => props.location,
  (loc) => {
    if (loc && loc !== selectedLocation.value) selectedLocation.value = loc;
  },
  { immediate: true }
);

// Distinct monthly settlement cycles from real sales, labor, and locks (Law 7 — Zero Date#getMonth)
const availableMonths = computed(() => {
  const months = new Map<string, { key: string; label: string; count: number }>();
  const seenSaleIds = new Set<string>();

  for (const s of props.sales || []) {
    if (!s.date || s.status === 'Cancelled') continue;
    if (s.id) {
      if (seenSaleIds.has(s.id)) continue;
      seenSaleIds.add(s.id);
    }
    const key = pacificMonthKey(s.date);
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) {
      const existing = months.get(key);
      if (existing) existing.count += 1;
      else months.set(key, { key, label: monthKeyToLabel(key), count: 1 });
    }
  }

  for (const mk of Object.keys(locksByMonth.value)) {
    if (!months.has(mk) && /^\d{4}-(0[1-9]|1[0-2])$/.test(mk)) {
      months.set(mk, { key: mk, label: monthKeyToLabel(mk), count: 0 });
    }
  }

  return Array.from(months.values()).sort((a, b) => b.key.localeCompare(a.key));
});

watch(
  availableMonths,
  (months) => {
    if (months.length > 0 && selectedPeriod.value === 'all' && props.period === undefined) {
      selectedPeriod.value = months[0].key;
    }
  },
  { immediate: true }
);

// Filtered sales for display counts
const filteredSales = computed(() => {
  if (!props.sales || props.sales.length === 0) return [];
  const seenIds = new Set<string>();
  const targetLoc =
    selectedLocation.value !== 'all'
      ? resolveCanonicalLocationCode(selectedLocation.value, props.warehouses) ||
        selectedLocation.value.toUpperCase()
      : 'all';

  return props.sales.filter((s) => {
    if (s.status === 'Cancelled') return false;
    if (selectedPeriod.value !== 'all') {
      if (!s.date || pacificMonthKey(s.date) !== selectedPeriod.value) return false;
    }
    if (targetLoc !== 'all') {
      if (resolveSaleLocationCode(s, props.warehouses) !== targetLoc) return false;
    }
    if (s.id) {
      if (seenIds.has(s.id)) return false;
      seenIds.add(s.id);
    }
    return true;
  });
});

// Law 7 expense filtering for Tier 1 summary cards
const allPeriodExpenses = computed(() => {
  return expenses.value.filter((exp) => {
    if (exp.status === 'rejected') return false;
    if (selectedPeriod.value === 'all') return true;
    return expenseMonthKey(exp.date) === selectedPeriod.value;
  });
});

const filteredExpenses = computed(() =>
  allPeriodExpenses.value.filter(
    (exp) => exp.scope !== 'personal_write_off' && Number(exp.coopSharedAmount ?? exp.amount ?? 0) > 0
  )
);

const personalWriteOffSummary = computed(() => {
  let count = 0;
  let amount = 0;
  for (const exp of allPeriodExpenses.value) {
    const personalAmt =
      exp.personalWriteOffAmount ?? (exp.scope === 'personal_write_off' ? exp.amount : 0);
    if (personalAmt > 0) {
      count += 1;
      amount += personalAmt;
    }
  }
  return { count, amount: Number(amount.toFixed(2)) };
});

const techOpsExpenses = computed(() =>
  filteredExpenses.value.filter((e) => {
    const cat = String(e.category || '').toLowerCase();
    const desc = String(e.description || '').toLowerCase();
    return (
      cat.includes('tech') ||
      cat.includes('ai') ||
      desc.includes('gemini') ||
      desc.includes('appwrite') ||
      desc.includes('vercel') ||
      desc.includes('hosting') ||
      desc.includes('software') ||
      desc.includes('cloud') ||
      desc.includes('ai credits')
    );
  })
);

const suppliesExpenses = computed(() =>
  filteredExpenses.value.filter((e) => {
    if (techOpsExpenses.value.some((t) => t.id === e.id)) return false;
    const cat = String(e.category || '').toLowerCase();
    return !cat.includes('rent') && !cat.includes('mall fee');
  })
);

// Canonical 4-Gate Settlement Delegation (Single Source of Truth)
const currentPacificMonth = computed(() => getCurrentPacificMonthKey());

const settlementBundle = computed(() =>
  buildMonthlySettlementFromInputs({
    sales: props.sales || [],
    period: selectedPeriod.value,
    location: selectedLocation.value,
    warehouses: props.warehouses || [],
    monthlyRentFallback: props.monthlyRent,
    expenses: expenses.value,
    laborEntries: laborEntries.value,
    policyConfig: policyConfig.value,
    surplusPolicyMode: surplusPolicyMode.value,
    surplusSplitBasis: surplusSplitBasis.value,
    teamPartnerPrefixes: (currentTeam.value?.prefs as any)?.partnerPrefixes || [],
    defaultUpcPrefix: (currentTeam.value?.prefs as any)?.upcPrefix || 'HUCK-',
    currentPacificMonth: currentPacificMonth.value,
    lockedSnapshotsByMonth: locksByMonth.value,
  })
);

// Unfrozen live calculation used by CoopMonthLockBar to detect drift on locked months (§7.4)
const liveComparisonBundle = computed(() =>
  buildMonthlySettlementFromInputs({
    sales: props.sales || [],
    period: selectedPeriod.value,
    location: selectedLocation.value,
    warehouses: props.warehouses || [],
    monthlyRentFallback: props.monthlyRent,
    expenses: expenses.value,
    laborEntries: laborEntries.value,
    policyConfig: policyConfig.value,
    surplusPolicyMode: surplusPolicyMode.value,
    surplusSplitBasis: surplusSplitBasis.value,
    teamPartnerPrefixes: (currentTeam.value?.prefs as any)?.partnerPrefixes || [],
    defaultUpcPrefix: (currentTeam.value?.prefs as any)?.upcPrefix || 'HUCK-',
    currentPacificMonth: currentPacificMonth.value,
    lockedSnapshotsByMonth: {},
  })
);

const partnerSettlements = computed(() => settlementBundle.value.rows);
const settlementSummary = computed(() => settlementBundle.value.summary);

// Notify parent SalesList of active SWEAT- worker count for the partner filter pill (§5 item 22)
const activeSweatWorkersCount = computed(
  () => partnerSettlements.value.filter((r) => r.isSweatEnabler).length
);
watch(
  activeSweatWorkersCount,
  (cnt) => {
    emit('sweat-count', cnt);
  },
  { immediate: true }
);

const visiblePartnerSettlements = computed(() => {
  const f = (props.partnerFilter || 'all').toUpperCase();
  const list =
    f === 'ALL'
      ? [...partnerSettlements.value]
      : partnerSettlements.value.filter(
          (p) => String(p.prefix || '').replace(/[-_]$/, '').toUpperCase() === f
        );
  const rank = (p: EnrichedPartnerSettlement) =>
    String(p.prefix || '').toUpperCase().startsWith('HUCK')
      ? 0
      : p.isSweatEnabler
        ? 2
        : 1;
  return list.sort((a, b) => rank(a) - rank(b));
});

function partnerVenueFeePct(partner: EnrichedPartnerSettlement): number {
  if (partner.totalGross > 0) {
    return Number(((partner.totalVenueFee / partner.totalGross) * 100).toFixed(1));
  }
  return settlementSummary.value.venueFeePct;
}

const memoryDenDisbursementDate = computed(() => {
  if (selectedPeriod.value === 'all') return 'the 15th of each month';
  const m = selectedPeriod.value.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonthLabel = monthKeyToLabel(
      `${nextYear}-${String(nextMonth).padStart(2, '0')}`
    ).split(' ')[0];
    return `${nextMonthLabel} 15, ${nextYear}`;
  }
  return 'the 15th of the month';
});

const getPeriodLabel = (): string => {
  if (selectedPeriod.value === 'all') return 'All Time Realized Sales';
  return monthKeyToLabel(selectedPeriod.value) || selectedPeriod.value;
};

// --- Month Lock / Unlock Handlers (§7.4) ---
const handleLockMonth = async (payload: { payoutDate: string; payoutNote: string }) => {
  if (selectedPeriod.value === 'all' || selectedLocation.value !== 'all') return;
  isLockSubmitting.value = true;
  try {
    const live = liveComparisonBundle.value;
    const res = await lockCoopMonth({
      month: selectedPeriod.value,
      payoutDate: payload.payoutDate,
      payoutNote: payload.payoutNote,
      snapshot: {
        policy: {
          curatorSharePct: policyConfig.value.curatorSharePct,
          commonsSharePct: policyConfig.value.commonsSharePct,
          reserveSharePct: policyConfig.value.reserveSharePct,
          salesPatronagePct: policyConfig.value.salesPatronagePct,
          laborPatronagePct: policyConfig.value.laborPatronagePct,
          icaRetainedPct: policyConfig.value.icaRetainedPct || 0,
          icaAnnualYieldRatePct: policyConfig.value.icaAnnualYieldRatePct || 7,
          payRatioCapStandard: policyConfig.value.payRatioCapStandard || 4.5,
          sweatSalesPoolMode: policyConfig.value.sweatSalesPoolMode || 'labor_only',
          surplusPolicyMode: surplusPolicyMode.value,
          surplusSplitBasis: surplusSplitBasis.value,
          carriedOverShortfallUsed: live.summary.carriedOverShortfall,
          grossBoothRentUsed: live.summary.boothRent,
          venueFeePctActual: live.summary.venueFeePct,
        },
        laborApproved: laborEntries.value.filter(
          (e) =>
            isSettlementEligibleLabor(e) &&
            laborEntryMonthKey(e.date) === selectedPeriod.value
        ),
        rows: live.rows,
        breakdown: live.engineResult.breakdown,
        totals: {
          totalGross: live.summary.totalGross,
          totalVenueFee: live.summary.totalVenueFee,
          totalStorePayout: live.summary.totalStorePayout,
          totalCostBasis: live.summary.totalCostBasis,
          totalNetSurplus: live.summary.totalNetSurplus,
          totalCuratorPayouts: live.summary.totalCuratorPayouts,
          totalCommonsPool: live.summary.totalCommonsPool,
          operatingBreakeven: live.engineResult.operatingBreakeven,
          excessSurplus: live.summary.excessSurplus,
          reserveAdded: live.summary.reserveAddition,
          partnerBonusPool: live.summary.distributablePartnerBonusPool,
        },
      },
    });
    locksByMonth.value = {
      ...locksByMonth.value,
      [selectedPeriod.value]: res.lock,
    };
    addToast({
      type: 'success',
      message: `Locked ${getPeriodLabel()} (snapshot #${res.lock.snapshotHash.slice(0, 8)})!`,
    });
  } catch (err: any) {
    addToast({
      type: 'error',
      message: err?.message || 'Failed to lock settlement month.',
    });
  } finally {
    isLockSubmitting.value = false;
  }
};

const handleUnlockMonth = async (payload: { reason: string }) => {
  if (selectedPeriod.value === 'all') return;
  isLockSubmitting.value = true;
  try {
    const res = await unlockCoopMonth({
      month: selectedPeriod.value,
      reason: payload.reason,
    });
    locksByMonth.value = {
      ...locksByMonth.value,
      [selectedPeriod.value]: res.lock,
    };
    addToast({
      type: 'warning',
      message: `Reopened ${getPeriodLabel()} — re-lock once adjustments are complete.`,
    });
  } catch (err: any) {
    addToast({
      type: 'error',
      message: err?.message || 'Failed to unlock settlement month.',
    });
  } finally {
    isLockSubmitting.value = false;
  }
};

// --- Consignor Deal Quick-Adjust Modal (Law 2: zero hardcoded fallback rent/commission) ---
const dealModalPartner = ref<any | null>(null);
const dealDraft = ref<ConsignorAgreementConfig | null>(null);
const dealSampleGross = ref<number>(0);
const isSavingDeal = ref(false);

const openDealModal = (partner: any) => {
  const existing = findConsignorAgreement(policyConfig.value.consignors, partner.prefix);
  dealDraft.value = existing
    ? { ...existing }
    : {
        prefix: partner.prefix,
        displayName: partner.name,
        mode: 'flat_commission',
        coopCommissionPct: 20,
        fixedMonthlyRent: 50,
        capRentAtNetSales: true,
      };
  dealSampleGross.value = 0;
  dealModalPartner.value = partner;
};

const closeDealModal = () => {
  dealModalPartner.value = null;
  dealDraft.value = null;
};

const dealModeComparison = computed(() => {
  const p = dealModalPartner.value;
  const d = dealDraft.value;
  if (!p || !d) return null;

  const actualGross = Number(p.totalGross || 0);
  const actualFee = Number(p.totalVenueFee || 0);
  const liveVenueRate =
    activeLocationMeta.value && Number(activeLocationMeta.value.commissionRate) > 0
      ? Number(activeLocationMeta.value.commissionRate) /
        (Number(activeLocationMeta.value.commissionRate) > 1 ? 100 : 1)
      : boothLocationMetas.value[0] && Number(boothLocationMetas.value[0].commissionRate) > 0
        ? Number(boothLocationMetas.value[0].commissionRate) /
          (Number(boothLocationMetas.value[0].commissionRate) > 1 ? 100 : 1)
        : 0;
  const feeRatio = actualGross > 0 ? actualFee / actualGross : liveVenueRate;

  const gross = dealSampleGross.value > 0 ? dealSampleGross.value : actualGross;
  const venueFee = Number((gross * feeRatio).toFixed(2));
  const netAfterVenue = Number((gross - venueFee).toFixed(2));
  const venueFeePct = Number((feeRatio * 100).toFixed(1));

  const totalGrossAll = partnerSettlements.value.reduce((s, g) => s + g.totalGross, 0);
  const grossRatio =
    dealSampleGross.value > 0
      ? Math.min(1, gross / Math.max(gross, totalGrossAll || 1000))
      : totalGrossAll > 0
        ? actualGross / totalGrossAll
        : 0;
  const boothRent =
    settlementSummary.value.boothRent ||
    Number(
      activeLocationMeta.value?.monthlyRent ??
        boothLocationMetas.value[0]?.monthlyRent ??
        props.monthlyRent ??
        0
    );

  const buildForMode = (mode: ConsignorDealMode) =>
    calculateConsignorSettlement({
      agreement: { ...d, mode },
      netStoreDeposit: netAfterVenue,
      grossRatio,
      boothRent,
      isMonthInProgress:
        dealSampleGross.value > 0 ? false : settlementSummary.value.isMonthInProgress,
    });

  return {
    basisLabel:
      dealSampleGross.value > 0
        ? `$${dealSampleGross.value} Sample Sales`
        : `Actual Period Sales ($${actualGross.toFixed(2)})`,
    gross,
    venueFee,
    venueFeePct,
    netAfterVenue,
    cards: [
      {
        mode: 'flat_commission' as ConsignorDealMode,
        title: '✂️ 1. Straight % Split',
        subtitle: `$0 rent. Co-op takes ${d.coopCommissionPct}% after venue fee; Consignor keeps ${100 - d.coopCommissionPct}%.`,
        result: buildForMode('flat_commission'),
      },
      {
        mode: 'fixed_shelf_rent' as ConsignorDealMode,
        title: '🏪 2. Fixed Shelf Rent',
        subtitle: `Flat $${Number(d.fixedMonthlyRent || 0).toFixed(2)}/mo space fee${d.coopCommissionPct > 0 ? ` + ${d.coopCommissionPct}% Co-op cut` : ''}.`,
        result: buildForMode('fixed_shelf_rent'),
      },
      {
        mode: 'pro_rata_rent' as ConsignorDealMode,
        title: '📊 3. Pro-Rata Rent Share',
        subtitle: `Pays ${(grossRatio * 100).toFixed(1)}% of $${boothRent.toFixed(2)} booth rent (0% Co-op cut).`,
        result: buildForMode('pro_rata_rent'),
      },
    ],
  };
});

const saveDeal = async () => {
  if (!dealDraft.value || !canEditGlobalFinancials.value) return;
  isSavingDeal.value = true;
  try {
    const draft = { ...dealDraft.value };
    const others = (policyConfig.value.consignors || []).filter(
      (c) => c.prefix !== draft.prefix
    );
    const next = { ...policyConfig.value, consignors: [...others, draft] };
    policyConfig.value = next;
    const ok = await saveCoopGovernanceState(
      { policyConfig: next },
      currentTeam.value?.$id || 'huck_collective'
    );
    addToast({
      type: ok ? 'success' : 'warning',
      message: ok
        ? `Saved consignor deal for ${draft.displayName}`
        : 'Saved locally; cloud sync failed',
    });
    closeDealModal();
  } finally {
    isSavingDeal.value = false;
  }
};

// --- PDF Statement Export (§2, §5 items 20 & 22, §6, §7.5) ---
const downloadPartnerPdf = (partner: EnrichedPartnerSettlement) => {
  try {
    const locked =
      activeMonthLock.value?.status === 'locked'
        ? {
            lockedAt: activeMonthLock.value.lockedAt,
            lockedByName: activeMonthLock.value.lockedBy.name,
            snapshotHash: activeMonthLock.value.snapshotHash,
            revision: activeMonthLock.value.revision,
          }
        : undefined;

    const data: PartnerStatementData = {
      statementDate: pacificTodayYmd(),
      periodLabel: getPeriodLabel(),
      periodKey: selectedPeriod.value,
      partnerName: partner.name,
      prefix: partner.prefix,
      role: partner.role,
      isSweatEnabler: Boolean(partner.isSweatEnabler),
      isConsignor: Boolean(partner.isConsignor),
      isVenueScopedPreview: settlementSummary.value.isVenueScopedPreview,
      curatorSharePct: policyConfig.value.curatorSharePct,
      commonsSharePct: policyConfig.value.commonsSharePct,
      venueFeePct: partnerVenueFeePct(partner),
      items: partner.items || [],
      totalGross: partner.totalGross,
      totalVenueFee: partner.totalVenueFee,
      totalCostBasis: partner.totalCostBasis,
      unrecoupedCost: partner.unrecoupedCost,
      totalNetSurplus: partner.totalNetSurplus,
      totalCuratorProfit: partner.totalCuratorProfit,
      totalPayoutCheck: partner.totalPayoutCheck,
      boothLocation: activeLocationMeta.value
        ? `${activeLocationMeta.value.shortName} (${activeLocationMeta.value.code})`
        : 'All Co-op Channels',
      reimbursements: partner.reimbursements || 0,
      rentDeduction: partner.isConsignor ? partner.rentDeduction || 0 : undefined,
      coopCommission: partner.isConsignor ? partner.coopCommission || 0 : undefined,
      dealFormulaLabel: partner.isConsignor ? partner.dealFormulaLabel : undefined,
      laborHoursLogged: partner.laborHoursLogged || 0,
      laborLogs: partner.laborLogs || [],
      salesPatronageBonus: partner.salesPatronageBonus || 0,
      laborBountyBonus: partner.laborBountyBonus || 0,
      icaRetainedCredit: partner.icaRetainedCredit || 0,
      cashBonusPaid: partner.cashBonusPaid || 0,
      icaAnnualYieldRatePct: policyConfig.value.icaAnnualYieldRatePct || 7,
      monthlySubtotals: partner.monthlySubtotals,
      lockedInfo: locked,
    };

    const doc = generatePartnerSettlementPdf(data);
    const periodOrDate =
      selectedPeriod.value !== 'all' ? selectedPeriod.value : pacificTodayYmd();
    const filename = buildPartnerPdfFilename(
      partner.name,
      partner.prefix,
      periodOrDate
    );
    doc.save(filename);
    recordPdfExportTimestamp(selectedPeriod.value);
    addToast({
      type: 'success',
      message: `Downloaded PDF statement for ${partner.name}!`,
    });
  } catch (err: any) {
    console.error('PDF Generation Error:', err);
    addToast({
      type: 'error',
      message: 'Failed to generate PDF statement: ' + err.message,
    });
  }
};

const exportAllPartnerPdfs = () => {
  if (partnerSettlements.value.length === 0) {
    addToast({ type: 'warning', message: 'No partner statements to generate' });
    return;
  }
  partnerSettlements.value.forEach((p) => downloadPartnerPdf(p));
  addToast({
    type: 'success',
    message: `Downloaded ${partnerSettlements.value.length} settlement statement PDF(s)!`,
  });
};
</script>
