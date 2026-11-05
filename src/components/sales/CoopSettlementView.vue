<template>
  <div class="space-y-6">
    <!-- Settlement Header & Period Filter Controls -->
    <div class="card bg-base-100 border border-base-200 shadow-sm rounded-2xl p-4 sm:p-5">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="badge badge-primary font-black text-xs px-2.5 py-1">
              70 / 30 WSDE Model
            </span>
            <span class="badge badge-outline font-mono text-xs">
              {{ filteredSales.length }} Sales Included
            </span>
          </div>
          <h2 class="text-xl sm:text-2xl font-black text-base-content tracking-tight mt-1 flex items-center gap-2">
            <Icon icon="solar:hand-money-bold-duotone" class="w-6 h-6 text-primary shrink-0" />
            <span>Co-op Settlements &amp; Partner Statements</span>
          </h2>
          <p class="text-xs text-base-content/70 mt-0.5">
            Calculated directly from committed sales in your database. 100% cost recoupment, 70% curator net profits, and 30% commons pool.
          </p>
        </div>

        <div class="flex items-center gap-2.5 w-full sm:w-auto flex-wrap justify-end">
          <!-- Link to Payout CSV Importer -->
          <a 
            href="/sales/import" 
            class="btn btn-sm btn-primary gap-1.5 rounded-xl font-bold h-9 min-h-9 px-3 text-xs shadow-sm"
            title="Upload Memory Den or register payout CSV to import and reconcile sales"
          >
            <Icon icon="solar:import-bold-duotone" class="w-4 h-4 shrink-0" />
            <span>Upload Payout CSV</span>
          </a>

          <!-- Link to Shared Commons Expense Ledger -->
          <a 
            href="/expenses" 
            class="btn btn-sm btn-outline gap-1.5 rounded-xl font-bold h-9 min-h-9 px-3 text-xs bg-base-100"
            title="View shared commons expenses, receipts & reimbursements"
          >
            <Icon icon="solar:bill-list-bold-duotone" class="w-4 h-4 text-primary shrink-0" />
            <span>Commons Expenses</span>
          </a>

          <!-- Location / Channel Selector -->
          <div class="form-control">
            <select v-model="selectedLocation" class="select select-bordered select-sm font-bold text-xs h-9 min-h-9 rounded-xl">
              <option value="memory_den">🏪 Memory Den (Booth 0EJ)</option>
              <option value="all">🌐 All Channels &amp; Locations</option>
            </select>
          </div>

          <!-- Dynamic Time Period Selector -->
          <div class="form-control">
            <select v-model="selectedPeriod" @change="emit('update:period', selectedPeriod)" class="select select-bordered select-sm font-bold text-xs h-9 min-h-9 rounded-xl font-mono">
              <option v-for="m in availableMonths" :key="m.key" :value="m.key">
                {{ m.label }} ({{ m.count }} sales)
              </option>
              <option value="all">All Time Realized ({{ sales.length }} sales)</option>
            </select>
          </div>

          <!-- Download All Button -->
          <button 
            type="button" 
            class="btn btn-sm btn-success text-success-content font-black gap-1.5 shadow-sm rounded-xl h-9 min-h-9 px-3.5"
            :disabled="partnerSettlements.length === 0"
            @click="exportAllPartnerPdfs"
            title="Download official PDF settlement statements for all partners"
          >
            <Icon icon="solar:file-download-bold" class="w-4 h-4 shrink-0" />
            <span>Download All Statements (PDF)</span>
          </button>
        </div>
      </div>
    </div>

    <!-- The 4 Core Guarantee Summary KPI Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <div class="card bg-base-100 p-4 sm:p-5 rounded-2xl border border-base-200 shadow-sm space-y-1">
        <div class="text-[11px] font-bold text-base-content/60 uppercase tracking-wider">Gross Realized Sales</div>
        <div class="text-2xl font-black text-base-content font-mono">${{ settlementSummary.totalGross.toFixed(2) }}</div>
        <div class="text-xs text-base-content/50 font-medium">
          Venue Cut ({{ settlementSummary.venueFeePct }}%): -${{ settlementSummary.totalVenueFee.toFixed(2) }}
        </div>
      </div>

      <div class="card bg-base-100 p-4 sm:p-5 rounded-2xl border border-success/30 shadow-sm space-y-1 bg-success/5">
        <div class="text-[11px] font-bold text-success uppercase tracking-wider flex items-center gap-1">
          <span>🛡️ Guarantee 1</span>
        </div>
        <div class="text-2xl font-black text-success font-mono">+${{ settlementSummary.totalCostBasis.toFixed(2) }}</div>
        <div class="text-xs text-base-content/70 font-medium">
          100% Capital Recouped First
        </div>
      </div>

      <div class="card bg-base-100 p-4 sm:p-5 rounded-2xl border border-primary/30 shadow-sm space-y-1 bg-primary/5">
        <div class="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
          <span>💎 Guarantee 2</span>
        </div>
        <div class="text-2xl font-black text-primary font-mono">+${{ settlementSummary.totalCuratorPayouts.toFixed(2) }}</div>
        <div class="text-xs text-base-content/70 font-medium">
          Curator Net Checks (Cost + 70% Profit)
        </div>
      </div>

      <div class="card bg-base-100 p-4 sm:p-5 rounded-2xl border border-warning/30 shadow-sm space-y-1.5 bg-warning/5">
        <div class="text-[11px] font-bold text-warning uppercase tracking-wider flex items-center justify-between gap-1">
          <span>🤝 Guarantee 3</span>
          <a href="/expenses" class="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5" title="View all receipts & reimbursements">
            <span>Expenses</span>
            <Icon icon="solar:arrow-right-linear" class="w-3 h-3" />
          </a>
        </div>
        <div class="text-2xl font-black text-warning font-mono">+${{ settlementSummary.totalCommonsPool.toFixed(2) }}</div>
        <div class="text-[11px] text-base-content/70 font-medium space-y-0.5">
          <div class="flex justify-between">
            <span>Rent:</span>
            <span v-if="settlementSummary.isMonthInProgress" class="font-mono text-base-content/60 font-semibold">at month end</span>
            <span v-else class="font-mono text-error font-semibold">-${{ settlementSummary.boothRent.toFixed(2) }}</span>
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
          {{ settlementSummary.isMonthInProgress ? 'Month in progress - rent is billed by Memory Den at month end' : settlementSummary.isCommonsFullyCovered ? `✅ Over Operating Costs (+$${settlementSummary.commonsNetBalance.toFixed(2)} Surplus)` : `⚠️ Shortfall: -$${Math.abs(settlementSummary.commonsNetBalance).toFixed(2)} (Carried Over)` }}
        </div>
      </div>
    </div>

    <!-- Operating Costs Breakeven & Partner Profit-Sharing Policy Card (Up for Co-op Vote) -->
    <div v-if="partnerSettlements.length > 0" class="card bg-base-100 border border-primary/25 shadow-sm rounded-2xl p-4 sm:p-5 space-y-4">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-base-200 pb-3">
        <div class="space-y-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="badge badge-sm badge-primary text-primary-content font-black whitespace-nowrap shrink-0">
              Gate 3 ➔ Gate 4 Breakeven
            </span>
            <span
              class="badge badge-sm font-bold whitespace-nowrap shrink-0"
              :class="settlementSummary.commonsNetBalance > 0 ? 'badge-success text-success-content' : 'badge-warning text-warning-content'"
            >
              {{
                settlementSummary.isMonthInProgress
                  ? '⏳ Month In Progress'
                  : settlementSummary.commonsNetBalance > 0
                    ? `🎉 +$${settlementSummary.commonsNetBalance.toFixed(2)} Over Operating Costs`
                    : `$${Math.abs(settlementSummary.commonsNetBalance).toFixed(2)} Until Operating Breakeven`
              }}
            </span>
            <a
              href="/coop/governance?tab=rules"
              class="badge badge-sm badge-secondary text-secondary-content font-bold gap-1 hover:brightness-110 whitespace-nowrap shrink-0"
              title="Open Co-op Governance & Policy Sliders to configure Gate 3 and Gate 4B rules"
            >
              <Icon icon="solar:user-hand-up-bold" class="w-3 h-3" />
              <span>Configure Sliders ({{ policyConfig.reserveSharePct }}/{{ policyConfig.salesPatronagePct }}/{{ policyConfig.laborPatronagePct }}) ➔</span>
            </a>
            <a
              href="/coop/labor"
              class="badge badge-sm badge-outline border-accent/40 text-accent font-mono font-bold gap-1 hover:bg-accent/10 whitespace-nowrap shrink-0"
              title="Log or review verified Sweat-Equity Labor hours"
            >
              <Icon icon="solar:clock-circle-bold" class="w-3 h-3" />
              <span>Labor: {{ periodLaborHours.HUCK + periodLaborHours.PDXGL + periodLaborHours.SWEAT }}h logged</span>
            </a>
          </div>
          <h3 class="text-base sm:text-lg font-black text-base-content">
            Multi-Channel Operating Breakeven, Mondragon ICAs &amp; Partner Profit Sharing
          </h3>
          <p class="text-xs text-base-content/70">
            Once the {{ policyConfig.commonsSharePct }}% Commons Pool covers 100% of Monthly Operating Costs (Net Booth Rent + Tech Ops + Supplies + Prior Shortfall Carryover), excess surplus distributes across Reserve ({{ policyConfig.reserveSharePct }}%), Sales Patronage ({{ policyConfig.salesPatronagePct }}%), and Sweat-Equity Labor ({{ policyConfig.laborPatronagePct }}%).
          </p>
        </div>

        <!-- Policy Mode & Partner Split Switchers -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
          <div class="join bg-base-200/80 p-0.5 rounded-xl border border-base-300">
            <button
              type="button"
              class="join-item btn btn-xs font-bold rounded-lg px-2.5"
              :class="surplusPolicyMode === 'patronage_90_10' ? 'btn-primary text-primary-content' : 'btn-ghost opacity-75'"
              @click="setSurplusPolicyMode('patronage_90_10')"
              title="10% to Rainy-Day Reserve, 90% distributed to Co-op Partners"
            >
              ⚖️ 90/10 Dividend
            </button>
            <button
              type="button"
              class="join-item btn btn-xs font-bold rounded-lg px-2.5"
              :class="surplusPolicyMode === 'cap_100' ? 'btn-primary text-primary-content' : 'btn-ghost opacity-75'"
              @click="setSurplusPolicyMode('cap_100')"
              title="Cap Commons at Operating Costs; 100% of excess goes to Co-op Partners"
            >
              🚀 100% Over Ops
            </button>
            <button
              type="button"
              class="join-item btn btn-xs font-bold rounded-lg px-2.5"
              :class="surplusPolicyMode === 'reserve_100' ? 'btn-primary text-primary-content' : 'btn-ghost opacity-75'"
              @click="setSurplusPolicyMode('reserve_100')"
              title="Keep 100% of excess in the Collective Rainy-Day Reserve"
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
              @click="setSurplusSplitBasis('volume')"
              title="Split excess surplus proportional to each partner's contributed net surplus"
            >
              📊 Pro-Rata Sales
            </button>
            <button
              type="button"
              class="join-item btn btn-xs font-bold rounded-lg px-2"
              :class="surplusSplitBasis === 'equal' ? 'btn-secondary text-secondary-content' : 'btn-ghost opacity-75'"
              @click="setSurplusSplitBasis('equal')"
              title="Split excess surplus equally (50/50) among active Co-op Partners"
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
            {{ policyConfig.commonsSharePct }}% Commons Pool Collected:
            <strong class="font-mono text-warning">${{ settlementSummary.totalCommonsPool.toFixed(2) }}</strong>
            <span class="opacity-60 mx-1">vs.</span>
            Operating Hurdle:
            <strong class="font-mono text-base-content">${{ settlementSummary.totalCommonsOverhead.toFixed(2) }}</strong>
            <span class="opacity-60 text-[11px]">
              (Rent ${{ settlementSummary.netBoothRentForCoop.toFixed(2) }} + Tech ${{ settlementSummary.techOps.toFixed(2) }} + Supplies ${{ settlementSummary.supplies.toFixed(2) }}<template v-if="settlementSummary.carriedOverShortfall > 0"> + Prior Shortfall ${{ settlementSummary.carriedOverShortfall.toFixed(2) }}</template>)
            </span>
          </span>
          <span class="font-mono font-black text-xs" :class="settlementSummary.distributablePartnerBonusPool > 0 ? 'text-success' : 'text-base-content/60'">
            Partner Bonus Pool: +${{ settlementSummary.distributablePartnerBonusPool.toFixed(2) }} | Reserve Added: +${{ settlementSummary.reserveAddition.toFixed(2) }}
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

      <!-- Individual Marketing / Social & Sweat-Equity Worker Dividend + Mondragon ICA Strip -->
      <div v-if="periodMemberLaborShares.length > 0" class="p-3.5 rounded-2xl bg-base-200/50 border border-base-300 space-y-2">
        <div class="flex items-center justify-between flex-wrap gap-2 text-xs">
          <span class="font-extrabold uppercase tracking-wider text-secondary flex items-center gap-1.5">
            <Icon icon="solar:users-group-rounded-bold" class="w-4 h-4" />
            <span>Gate 4B Sweat-Equity &amp; Marketing Worker Dividend Breakdown ({{ policyConfig.laborPatronagePct }}% Labor Pool = ${{ settlementSummary.laborBonusPool.toFixed(2) }})</span>
          </span>
          <span class="badge badge-xs badge-outline font-mono font-bold">
            Mondragon ICA Target Yield: {{ policyConfig.icaAnnualYieldRatePct || 7 }}%/yr
          </span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          <div
            v-for="worker in periodMemberLaborShares"
            :key="worker.member"
            class="p-2.5 rounded-xl bg-base-100 border border-base-300 flex items-center justify-between gap-2"
          >
            <div class="min-w-0">
              <div class="font-bold text-base-content truncate">{{ worker.member }}</div>
              <div class="text-[10px] text-base-content/60 flex items-center gap-1">
                <span class="badge badge-xs font-mono font-bold" :class="worker.partner === 'SWEAT' ? 'badge-secondary' : worker.partner === 'PDXGL' ? 'badge-accent' : 'badge-primary'">
                  {{ worker.partner }}-
                </span>
                <span class="truncate">{{ worker.roleLabel }}</span>
              </div>
            </div>
            <div class="text-right shrink-0 font-mono">
              <div class="font-black text-success">
                +${{ ((settlementSummary.laborBonusPool * worker.sharePct) / 100).toFixed(2) }}
              </div>
              <div class="text-[10px] text-base-content/60">{{ worker.hours.toFixed(1) }}h ({{ worker.sharePct }}%)</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Side-by-Side Partner Profit-Sharing Summary Table -->
      <div class="overflow-x-auto border border-base-200 rounded-xl">
        <table class="table table-xs">
          <thead>
            <tr class="bg-base-200/70 text-base-content/70 font-bold">
              <th>Partner</th>
              <th>Role</th>
              <th class="text-right">Gross Sales</th>
              <th class="text-right">15% Venue Fee</th>
              <th class="text-right">100% Cost Recoup</th>
              <th class="text-right">Base Profit ({{ policyConfig.curatorSharePct }}%)</th>
              <th class="text-right">Ops / Rent Share</th>
              <th class="text-right">Labor Logged</th>
              <th class="text-right text-success">Bonus Over Ops</th>
              <th class="text-right font-black">Final Payout Check</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in partnerSettlements" :key="'summary-' + p.prefix" class="hover:bg-base-200/40">
              <td class="font-bold">{{ p.name }} <span class="font-mono text-[10px] opacity-60">({{ p.prefix }})</span></td>
              <td>
                <span class="badge badge-xs font-bold whitespace-nowrap" :class="p.isConsignor ? 'badge-secondary text-secondary-content' : 'badge-primary text-primary-content'">
                  {{ p.isConsignor ? 'Consignor' : 'Co-op Partner' }}
                </span>
              </td>
              <td class="text-right font-mono">${{ p.totalGross.toFixed(2) }}</td>
              <td class="text-right font-mono text-error">-${{ p.totalVenueFee.toFixed(2) }}</td>
              <td class="text-right font-mono text-success">{{ p.isConsignor ? '—' : `+$${p.totalCostBasis.toFixed(2)}` }}</td>
              <td class="text-right font-mono text-primary">{{ p.isConsignor ? '—' : `+$${p.totalCuratorProfit.toFixed(2)}` }}</td>
              <td class="text-right font-mono text-warning">
                {{ p.isConsignor ? `-$${(p.rentDeduction || 0).toFixed(2)} Rent` : `$${p.totalCommonsTake.toFixed(2)} (${policyConfig.commonsSharePct}%)` }}
              </td>
              <td class="text-right font-mono text-secondary">
                {{ p.isConsignor ? '—' : `${(p.laborHoursLogged || 0).toFixed(1)}h` }}
              </td>
              <td class="text-right font-mono font-bold" :class="p.bonusSurplusDividend > 0 ? 'text-success' : 'opacity-50'">
                {{ p.isConsignor ? '—' : `+$${(p.bonusSurplusDividend || 0).toFixed(2)}` }}
              </td>
              <td class="text-right font-mono font-black text-success">${{ p.totalPayoutCheck.toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Member / Partner Payout Statements: directly under the 4 waterfall cards -->
    <!-- Empty State -->
      <div v-if="visiblePartnerSettlements.length === 0" class="card bg-base-100 border border-base-200 shadow-sm p-12 text-center">
      <div class="w-12 h-12 rounded-full bg-base-200 text-base-content/50 flex items-center justify-center mx-auto mb-3">
        <Icon icon="solar:document-text-linear" class="w-6 h-6" />
      </div>
      <h3 class="text-base font-bold">No sales in selected period or location</h3>
      <p class="text-xs text-base-content/60 mt-1 max-w-sm mx-auto">
        Try adjusting the month selector or switching to "All Channels &amp; Locations".
      </p>
    </div>

    <!-- Partner Settlement Cards -->
    <div v-else class="space-y-6">
      <div 
        v-for="partner in visiblePartnerSettlements" 
        :key="partner.prefix" 
        class="card bg-base-100 border border-base-300 shadow-md overflow-hidden rounded-2xl"
      >
        <!-- Card Header -->
        <div class="bg-base-200/70 p-4 sm:p-5 border-b border-base-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="w-11 h-11 rounded-2xl bg-primary/15 text-primary flex items-center justify-center font-black text-lg shadow-xs">
              {{ partner.prefix.replace(/[-_]$/, '').slice(0, 2) }}
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="font-black text-lg text-base-content">{{ partner.name }}</h3>
                <span class="badge badge-sm badge-outline font-mono font-bold">{{ partner.prefix }}</span>
                <span class="badge badge-sm badge-ghost font-bold">{{ partner.items.length }} {{ partner.items.length === 1 ? 'item sold' : 'items sold' }}</span>
              </div>
              <p class="text-xs text-base-content/60">Governed under Huckleberry Collective 70/30 Net Surplus Settlement</p>
            </div>
          </div>

          <div class="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <div class="text-right">
              <div class="text-xs text-base-content/60 font-semibold uppercase tracking-wider">
                Final Payout Check
              </div>
              <div class="text-2xl font-black font-mono" :class="partner.totalPayoutCheck < 0 ? 'text-error' : 'text-success'">
                ${{ partner.totalPayoutCheck.toFixed(2) }}
              </div>
              <div v-if="partner.reimbursements > 0" class="text-[11px] text-success font-bold flex items-center justify-end gap-1">
                <Icon icon="solar:bolt-bold" class="w-3.5 h-3.5" />
                <span>Includes +${{ partner.reimbursements.toFixed(2) }} Fronted Reimbursement</span>
              </div>
            </div>
            <button 
              type="button" 
              class="btn btn-sm btn-primary gap-1.5 shadow-sm rounded-xl font-bold"
              @click="downloadPartnerPdf(partner)"
              title="Download PDF settlement statement for this partner"
            >
              <Icon icon="solar:document-medicine-bold" class="w-4 h-4 shrink-0" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>

        <!-- Financial Waterfall Bar -->
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-base-200/30 text-xs border-b border-base-200">
          <div>
            <span class="opacity-60 block font-medium">Gross Register:</span>
            <span class="font-bold font-mono text-sm text-base-content">${{ partner.totalGross.toFixed(2) }}</span>
          </div>
          <div>
            <span class="opacity-60 block font-medium">15% Venue Cut:</span>
            <span class="font-mono text-sm text-error font-bold">-${{ partner.totalVenueFee.toFixed(2) }}</span>
          </div>
          <div v-if="partner.isConsignor">
            <span class="opacity-60 block font-medium">Booth Rent Share:</span>
            <span class="font-mono text-sm text-warning font-bold">-${{ (partner.rentDeduction || 0).toFixed(2) }}</span>
          </div>
          <div v-else>
            <span class="opacity-60 block font-medium">100% Cost Basis Recouped:</span>
            <span class="font-mono text-sm text-success font-bold">+${{ partner.totalCostBasis.toFixed(2) }}</span>
          </div>
          <div v-if="partner.isConsignor">
            <span class="opacity-60 block font-medium">Net Consignor Payout:</span>
            <span class="font-mono text-sm text-success font-bold">${{ partner.totalPayoutCheck.toFixed(2) }}</span>
          </div>
          <div v-else>
            <span class="opacity-60 block font-medium">70% Net Profit Share:</span>
            <span class="font-mono text-sm text-primary font-bold">+${{ partner.totalCuratorProfit.toFixed(2) }}</span>
          </div>
          <div v-if="!partner.isConsignor">
            <span class="opacity-60 block font-medium">30% Commons Contribution:</span>
            <span class="font-mono text-sm text-warning font-bold">+${{ partner.totalCommonsTake.toFixed(2) }}</span>
          </div>
          <div v-else>
            <span class="opacity-60 block font-medium">Relationship:</span>
            <span class="badge badge-sm badge-secondary font-bold">Consignor</span>
          </div>
        </div>

        <!-- Itemized Table (Collapsible) -->
        <div class="overflow-x-auto max-h-72">
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
                <th class="text-right font-bold text-success">{{ partner.isConsignor ? 'Net After Fee (85%)' : 'Total Payout (Cost + 70%)' }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(it, iIdx) in partner.items" :key="iIdx" class="hover:bg-base-200/40">
                <td class="font-mono text-xs">{{ it.date ? String(it.date).slice(0, 10) : 'N/A' }}</td>
                <td class="font-mono text-xs font-semibold">{{ cleanSkuDisplay(it.sku) }}</td>
                <td class="max-w-xs">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="truncate font-medium">{{ it.title }}</span>
                    <span
                      v-if="isUnlinkedRow(it)"
                      class="badge badge-xs badge-warning font-black"
                    >
                      ⚠️ Unlinked Ticket
                    </span>
                    <button
                      v-if="isUnlinkedRow(it)"
                      type="button"
                      @click="$emit('link-sale', it.rawSale)"
                      class="btn btn-xs btn-warning font-black h-5 min-h-0 px-2 rounded-md"
                    >
                      Link Inventory
                    </button>
                    <button
                      v-else-if="it.rawSale"
                      type="button"
                      @click="$emit('link-sale', it.rawSale)"
                      class="btn btn-ghost btn-xs h-5 min-h-0 px-1.5 text-[10px] opacity-60 hover:opacity-100"
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

    <!-- Venue check, booth rent & shared overhead (collapsed so rent / tech ops are not repeated up top) -->
    <details class="collapse collapse-arrow bg-base-100 border border-base-200 rounded-2xl shadow-sm">
      <summary class="collapse-title font-bold text-sm flex items-center gap-2">
        <span>🏪 Venue check, booth rent &amp; shared overhead</span>
        <span class="badge badge-ghost badge-sm font-mono">Memory Den reconciliation</span>
      </summary>
      <div class="collapse-content space-y-6">
    <!-- Memory Den Check Reconciliation Banner -->
    <div class="card bg-base-100 border border-base-200 shadow-sm rounded-2xl p-4 sm:p-5 space-y-3">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-base-200 pb-3">
        <div>
          <span class="text-xs font-bold text-base-content/60 uppercase tracking-wider">
            Memory Den Monthly Settlement Check Reconciler
          </span>
          <div class="text-lg font-black text-base-content flex items-center gap-2">
            <span>Period: {{ getPeriodLabel() }}</span>
            <span class="badge badge-primary font-mono text-xs font-bold">{{ filteredSales.length }} items</span>
          </div>
        </div>
        <div class="text-left sm:text-right">
          <span class="text-xs text-base-content/60 font-semibold block uppercase">Actual Net Check from Memory Den:</span>
          <span class="text-2xl font-black font-mono" :class="settlementSummary.memoryDenNetCheck >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-error'">
            ${{ settlementSummary.memoryDenNetCheck.toFixed(2) }}
          </span>
        </div>
      </div>

      <!-- Payout Disbursement Cadence Banner (15th of the Month) -->
      <div class="alert alert-info/10 border border-info/30 rounded-xl py-2.5 px-3.5 text-xs flex items-center gap-2.5 text-base-content">
        <Icon icon="solar:calendar-date-bold-duotone" class="w-5 h-5 text-info shrink-0" />
        <div class="flex-1">
          <strong class="font-bold text-info">Venue Payout Schedule:</strong>
          <span class="opacity-80 ml-1">Memory Den settlement checks deposit on <strong>{{ settlementSummary.memoryDenDisbursementDate }}</strong> (the 15th of the month). Curator checks should disburse after the venue deposit clears.</span>
        </div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs">
        <div>
          <span class="text-base-content/60 block">1. Gross Register Sales</span>
          <span class="font-bold font-mono text-sm text-base-content">${{ settlementSummary.totalGross.toFixed(2) }}</span>
        </div>
        <div>
          <span class="text-error block">2. Venue Fee (15%)</span>
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
              title="Personal Schedule C Write-Offs are excluded from Co-op Commons overhead"
            >
              👤 {{ personalWriteOffSummary.count }} Personal Write-Offs (${{ personalWriteOffSummary.amount.toFixed(2) }}) Excluded from Co-op Pool
            </a>
          </div>
          <h3 class="text-base font-black text-base-content tracking-tight mt-1 flex items-center gap-2">
            <Icon icon="solar:bolt-bold-duotone" class="w-5 h-5 text-warning shrink-0" />
            <span>Tier 1 Shared Overhead &amp; Tech Ops</span>
          </h3>
          <p class="text-xs text-base-content/60">
            Paid collectively by the 30% Commons Pool. Covers fixed mall booth space, tech hosting, AI tokens, and supplies.
          </p>
        </div>
        <div class="text-left sm:text-right">
          <span class="text-xs text-base-content/60 font-semibold block uppercase">Total Overhead &amp; Tech:</span>
          <span class="text-xl font-black font-mono text-warning">
            ${{ settlementSummary.totalCommonsOverhead.toFixed(2) }}
          </span>
        </div>
      </div>

      <!-- 3-Pillar Overhead Breakdown -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
        <div class="p-3 rounded-xl bg-base-200/50 border border-base-200 space-y-1">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-base-content/70">🏪 Booth Space Rent</span>
            <span class="badge badge-xs badge-neutral font-mono font-bold">Auto-Deducted</span>
          </div>
          <div class="text-lg font-black font-mono text-base-content">
            ${{ settlementSummary.boothRent.toFixed(2) }}
          </div>
          <p class="text-[11px] text-base-content/50">Memory Den monthly space rental</p>
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

      <!-- Itemized Tech Ops & Supplies List (if any exist) -->
      <div v-if="filteredExpenses.length > 0" class="mt-4 pt-3 border-t border-base-200">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold uppercase tracking-wider text-base-content/60">Itemized Operating Receipts in Period</span>
          <a href="/expenses" class="text-xs text-primary font-bold hover:underline flex items-center gap-1">
            <span>Manage All Receipts in Expense Ledger</span>
            <Icon icon="solar:arrow-right-linear" class="w-3.5 h-3.5" />
          </a>
        </div>
        <div class="overflow-x-auto max-h-48 border border-base-200 rounded-xl">
          <table class="table table-xs">
            <thead>
              <tr class="bg-base-200/60 text-base-content/70">
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Fronted By</th>
                <th class="text-right">Amount</th>
                <th class="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="exp in filteredExpenses" :key="exp.id" class="hover:bg-base-200/40">
                <td class="font-mono text-[11px]">{{ exp.date ? String(exp.date).slice(0, 10) : 'N/A' }}</td>
                <td>
                  <span class="badge badge-xs font-bold truncate max-w-[140px]" :class="exp.category.includes('Tech') ? 'badge-primary' : 'badge-ghost'">
                    {{ exp.category }}
                  </span>
                </td>
                <td class="font-medium max-w-xs truncate">{{ exp.description }}</td>
                <td class="font-semibold text-xs">{{ exp.member }} ({{ exp.partner || 'HUCK' }})</td>
                <td class="text-right font-mono font-bold">${{ Number(exp.amount || 0).toFixed(2) }}</td>
                <td class="text-center">
                  <span class="badge badge-xs font-mono font-bold" :class="exp.status === 'reimbursed' ? 'badge-success' : 'badge-warning'">
                    {{ exp.status }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div v-else class="mt-3 pt-3 border-t border-base-200 flex items-center justify-between text-xs text-base-content/60">
        <span>No additional operational receipts logged for this period.</span>
        <a href="/expenses" class="text-primary font-bold hover:underline flex items-center gap-1">
          <span>+ Log Tech or Supply Receipt</span>
          <Icon icon="solar:add-circle-bold" class="w-3.5 h-3.5" />
        </a>
      </div>
    </div>

      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { addToast } from '../../stores/toast';
import { useAuth } from '../../composables/useAuth';
import { normalizeOrgPrefix, extractOrgPrefix } from '../../lib/inventoryUpc';
import { generatePartnerSettlementPdf, type PartnerStatementData } from '../../lib/coopSettlementPdf';
import { coopExpensesApi, type CoopExpenseItem } from '../../lib/coopExpenses';
import {
  loadCoopGovernanceState,
  saveCoopGovernanceState,
  getLaborHoursByPartnerForMonth,
  getLaborHoursByMemberForMonth,
  DEFAULT_COOP_POLICY_CONFIG,
  DEFAULT_COOP_LABOR_ENTRIES,
  type SurplusPolicyMode,
  type SurplusSplitBasis,
  type CoopPolicyConfig,
  type CoopLaborEntry,
} from '../../lib/coopGovernance';
import { cleanSkuDisplay, pacificMonthKey, monthKeyToLabel } from '../../lib/salesBucketing';

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
  cost?: number;
}

const props = defineProps<{
  sales: SaleItem[];
  /** Month filter shared with the /sales page ('YYYY-MM' or 'all'). */
  period?: string;
  /** Partner filter shared with the /sales page ('all' | 'HUCK' | 'BB' | 'PDXGL'). */
  partnerFilter?: string;
  /** Monthly booth rent from the live Appwrite `warehouses` document (never hardcoded). */
  monthlyRent?: number;
}>();

const emit = defineEmits<{
  (e: 'update:period', value: string): void;
  (e: 'link-sale', sale: any): void;
}>();

const isUnlinkedRow = (it: any): boolean => {
  const title = String(it?.title || '').trim();
  const sku = String(it?.sku || '').trim();
  return /^ticket\s*#/i.test(title) || /^order\s+/i.test(title) || /^SO-/i.test(sku);
};

const { currentTeam } = useAuth();
const selectedPeriod = ref<string>('all');
const selectedLocation = ref<'memory_den' | 'all'>('memory_den');

const surplusPolicyMode = ref<SurplusPolicyMode>('patronage_90_10');
const surplusSplitBasis = ref<SurplusSplitBasis>('volume');
const policyConfig = ref<CoopPolicyConfig>({ ...DEFAULT_COOP_POLICY_CONFIG });
const laborEntries = ref<CoopLaborEntry[]>([...DEFAULT_COOP_LABOR_ENTRIES]);

const periodLaborHours = computed(() =>
  getLaborHoursByPartnerForMonth(laborEntries.value, selectedPeriod.value)
);

const periodMemberLaborShares = computed(() =>
  getLaborHoursByMemberForMonth(
    laborEntries.value,
    selectedPeriod.value,
    policyConfig.value.members
  )
);

const setSurplusPolicyMode = async (mode: SurplusPolicyMode) => {
  surplusPolicyMode.value = mode;
  await saveCoopGovernanceState(
    { surplusPolicyMode: mode, surplusSplitBasis: surplusSplitBasis.value },
    currentTeam.value?.$id || 'huck_collective'
  );
};

const setSurplusSplitBasis = async (basis: SurplusSplitBasis) => {
  surplusSplitBasis.value = basis;
  await saveCoopGovernanceState(
    { surplusPolicyMode: surplusPolicyMode.value, surplusSplitBasis: basis },
    currentTeam.value?.$id || 'huck_collective'
  );
};

// Keep this view's month in sync with the /sales page filter
watch(() => props.period, (p) => {
  if (p && p !== selectedPeriod.value) selectedPeriod.value = p;
}, { immediate: true });

// Shared Commons Expenses State
const expenses = ref<CoopExpenseItem[]>([]);
const loadingExpenses = ref(false);

const loadExpenses = async () => {
  if (!currentTeam.value) return;
  loadingExpenses.value = true;
  try {
    expenses.value = await coopExpensesApi.listExpenses(currentTeam.value.$id);
  } catch (e) {
    console.warn('[CoopSettlementView] Failed to load expenses:', e);
  } finally {
    loadingExpenses.value = false;
  }
};

onMounted(async () => {
  loadExpenses();
  const { state } = await loadCoopGovernanceState([], currentTeam.value?.$id || 'huck_collective');
  surplusPolicyMode.value = state.surplusPolicyMode;
  surplusSplitBasis.value = state.surplusSplitBasis;
  if (state.policyConfig) {
    policyConfig.value = state.policyConfig;
  }
  if (Array.isArray(state.laborEntries) && state.laborEntries.length > 0) {
    laborEntries.value = state.laborEntries;
  }
});

watch(currentTeam, (n) => {
  if (n) loadExpenses();
});

// Dynamically extract all distinct monthly settlement cycles from real sales data (Zero-Dupe Invariant)
const availableMonths = computed(() => {
  const months = new Map<string, { key: string; label: string; count: number; date: Date }>();
  const seenMonthSaleIds = new Set<string>();

  for (const s of props.sales) {
    if (!s.date || s.status === 'Cancelled') continue;

    if (s.id) {
      if (seenMonthSaleIds.has(s.id)) continue;
      seenMonthSaleIds.add(s.id);
    }

    const key = pacificMonthKey(s.date);
    const [yy, mm] = key.split('-');
    if (yy && mm && yy.length === 4) {
      {
        const year = yy;
        const month = mm;
        const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
        const label = monthKeyToLabel(key);
        const existing = months.get(key);
        if (existing) {
          existing.count++;
        } else {
          months.set(key, { key, label, count: 1, date: d });
        }
      }
    }
  }
  return Array.from(months.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
});

// Default to the NEWEST month present in the sales (availableMonths is sorted newest-first), incl. the open current month
watch(availableMonths, (months) => {
  if (months.length > 0 && selectedPeriod.value === 'all' && props.period === undefined) {
    selectedPeriod.value = months[0].key;
  }
}, { immediate: true });

// Filter sales by selected month and location (Zero-Dupe Invariant)
const filteredSales = computed(() => {
  if (!props.sales || props.sales.length === 0) return [];
  const seenFilteredIds = new Set<string>();

  return props.sales.filter(s => {
    if (s.status === 'Cancelled') return false;

    // 1. Date / Month Filter First
    if (selectedPeriod.value !== 'all') {
      if (!s.date) return false;
      if (pacificMonthKey(s.date) !== selectedPeriod.value) return false;
    }

    // 2. Venue isolation filter: Strictly verify Memory Den venue attribution
    if (selectedLocation.value === 'memory_den') {
      const loc = (s.locationName || '').toLowerCase();
      const sSku = (s.sku || '').toLowerCase();
      const sUpc = (s.upc || '').toLowerCase();
      const soNumber = (s.soNumber || '').toLowerCase();
      const orderId = ((s as any).orderId || '').toLowerCase();
      const whId = ((s as any).warehouseId || '').toLowerCase();
      const isMd = loc.includes('memory') || loc.includes('0ej') || loc === 'md' ||
                   sSku.includes('0ej') || sUpc.includes('0ej') || soNumber.includes('0ej') ||
                   orderId.startsWith('md-payout') || orderId.startsWith('md-') || orderId.startsWith('t-') ||
                   whId === '6a7e70050009db0e1857' || whId === '6ab9a37500233d76d580';
      if (!isMd) return false;
    }

    // 3. Resale Invariant: 1 Sale Record = 1 Unique Physical Register Transaction
    if (s.id) {
      if (seenFilteredIds.has(s.id)) return false;
      seenFilteredIds.add(s.id);
    }

    return true;
  });
});

const resolveItemPrefix = (item: SaleItem): string => {
  const upc = (item.upc || '').trim().toUpperCase();
  const sku = (item.sku || '').trim().toUpperCase();
  const soNumber = (item.soNumber || '').trim().toUpperCase();
  const title = (item.title || '').trim().toUpperCase();

  if (upc.startsWith('COMMONS') || sku.startsWith('COMMONS') || soNumber.startsWith('COMMONS') || title.includes('[COMMONS]')) {
    return 'COMMONS-';
  }

  const extracted = extractOrgPrefix(upc) || extractOrgPrefix(sku) || extractOrgPrefix(soNumber);
  if (extracted) return extracted;

  if (upc.startsWith('BB') || sku.startsWith('BB') || soNumber.startsWith('BB') || 
      title.startsWith('B&B') || title.startsWith('BB ') || title.startsWith('BB-') || 
      title.includes(' B&B ') || title.endsWith(' BB')) {
    return 'BB-';
  }
  if (upc.startsWith('PDXGL') || sku.startsWith('PDXGL') || soNumber.startsWith('PDXGL') || title.startsWith('PDXGL')) {
    return 'PDXGL-';
  }
  if (upc.startsWith('HUCK') || sku.startsWith('HUCK') || soNumber.startsWith('HUCK') || title.startsWith('HUCK')) {
    return 'HUCK-';
  }

  const partnerList = (currentTeam.value?.prefs as any)?.partnerPrefixes || [];
  for (const p of partnerList) {
    const pStr = normalizeOrgPrefix(typeof p === 'string' ? p : p?.prefix);
    if (pStr && (upc.startsWith(pStr) || sku.startsWith(pStr) || soNumber.startsWith(pStr))) {
      return pStr;
    }
  }

  return normalizeOrgPrefix((currentTeam.value?.prefs as any)?.upcPrefix || 'HUCK-');
};

const resolvePartnerName = (prefix: string): string => {
  const clean = prefix.replace(/[-_]$/, '');
  if (clean === 'COMMONS') return 'Shared Commons Pool (100% Margin Sweep)';
  if (clean === 'HUCK') return 'Huckleberry Collective';
  if (clean === 'PDXGL') return 'PDX Game Library';
  if (clean === 'BB') return 'B&B Consignment (PDXGL Sub-Client)';

  const partnerList = (currentTeam.value?.prefs as any)?.partnerPrefixes || [];
  for (const p of partnerList) {
    const pStr = normalizeOrgPrefix(typeof p === 'string' ? p : p?.prefix);
    if (pStr === prefix && typeof p === 'object' && p.name) {
      return p.name;
    }
  }
  return `${clean} Partner`;
};

// Filter expenses by selected month and active tenant
const allPeriodExpenses = computed(() => {
  return expenses.value.filter(exp => {
    if (exp.status === 'rejected') return false;
    if (selectedPeriod.value === 'all') return true;
    if (!exp.date) return false;
    const cleanDate = exp.date.includes('T') ? exp.date.split('T')[0] : exp.date.split(' ')[0];
    const parts = cleanDate.split(/[-/]/);
    if (parts.length >= 2) {
      const year = parts[0].length === 4 ? parts[0] : parts[2];
      const month = parts[0].length === 4 ? parts[1] : parts[0];
      const key = `${year}-${month.padStart(2, '0')}`;
      return key === selectedPeriod.value;
    }
    return cleanDate.startsWith(selectedPeriod.value);
  });
});

// Strictly exclude Personal IRS Schedule C Write-Offs from the Co-op Shared Commons Pool
const filteredExpenses = computed(() => {
  return allPeriodExpenses.value.filter(exp => {
    if (exp.scope === 'personal_write_off') return false;
    return (exp.coopSharedAmount ?? exp.amount) > 0;
  });
});

const personalWriteOffSummary = computed(() => {
  let count = 0;
  let amount = 0;
  for (const exp of allPeriodExpenses.value) {
    const personalAmt = exp.personalWriteOffAmount ?? (exp.scope === 'personal_write_off' ? exp.amount : 0);
    if (personalAmt > 0) {
      count += 1;
      amount += personalAmt;
    }
  }
  return { count, amount: Number(amount.toFixed(2)) };
});

const techOpsExpenses = computed(() => {
  return filteredExpenses.value.filter(e => {
    const cat = (e.category || '').toLowerCase();
    const desc = (e.description || '').toLowerCase();
    return cat.includes('tech') || cat.includes('ai') || 
           desc.includes('gemini') || desc.includes('appwrite') || 
           desc.includes('vercel') || desc.includes('hosting') || 
           desc.includes('software') || desc.includes('cloud') ||
           desc.includes('ai credits');
  });
});

const suppliesExpenses = computed(() => {
  return filteredExpenses.value.filter(e => {
    if (techOpsExpenses.value.some(t => t.id === e.id)) return false;
    const cat = (e.category || '').toLowerCase();
    if (cat.includes('rent') || cat.includes('mall fee')) return false;
    return true;
  });
});

const totalTechOpsAmount = computed(() => {
  return Number(techOpsExpenses.value.reduce((sum, e) => sum + Number(e.coopSharedAmount ?? e.amount ?? 0), 0).toFixed(2));
});

const totalSuppliesAmount = computed(() => {
  return Number(suppliesExpenses.value.reduce((sum, e) => sum + Number(e.coopSharedAmount ?? e.amount ?? 0), 0).toFixed(2));
});

// Member reimbursements from approved Co-op Shared expenses only
const memberReimbursements = computed(() => {
  const map: Record<string, number> = {};
  for (const exp of filteredExpenses.value) {
    if (exp.status === 'rejected') continue;
    const cat = (exp.category || '').toLowerCase();
    if (cat.includes('rent') || cat.includes('mall fee')) continue;
    const partnerPrefix = normalizeOrgPrefix(exp.partner || 'HUCK-');
    const sharedAmt = Number(exp.coopSharedAmount ?? exp.amount ?? 0);
    map[partnerPrefix] = Number(((map[partnerPrefix] || 0) + sharedAmt).toFixed(2));
  }
  return map;
});

// Memory Den pays out on the 15th of the month following the sales cycle
const memoryDenDisbursementDate = computed(() => {
  if (selectedPeriod.value === 'all') return '15th of each month';
  const parts = selectedPeriod.value.split(/[-/]/);
  if (parts.length >= 2) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10); // 1-12
    const nextDate = new Date(year, month, 15);
    return nextDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  return '15th of the month';
});

// Month "in progress" = the current Pacific calendar month. Memory Den posts that month's space-rental credit only at month end,
// so no booth rent (and no rent shortfall / consignor rent share) is charged against a month that has not closed yet.
const currentPacificMonthKey = computed(() =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7)
);
const isMonthInProgress = computed(
  () => selectedPeriod.value !== 'all' && selectedPeriod.value === currentPacificMonthKey.value
);
const effectiveMonthlyRent = computed(() => (isMonthInProgress.value ? 0 : Number(props.monthlyRent ?? 0)));

const partnerSettlements = computed(() => {
  if (filteredSales.value.length === 0) return [];

  const groups: Record<string, any> = {};
  const FIXED_BOOTH_RENT = effectiveMonthlyRent.value; // live Appwrite warehouse rent, or 0 while the month is still in progress

  for (const sale of filteredSales.value) {
    const prefix = resolveItemPrefix(sale);
    const partnerName = resolvePartnerName(prefix);

    if (!groups[prefix]) {
      groups[prefix] = {
        prefix,
        name: partnerName,
        isConsignor: prefix === 'BB-',
        isCommonsPool: prefix === 'COMMONS-',
        items: [],
        totalGross: 0,
        totalVenueFee: 0,
        totalCostBasis: 0,
        totalNetSurplus: 0,
        totalCuratorProfit: 0,
        grossCuratorShare: 0,
        rentDeduction: 0,
        reimbursements: 0,
        totalPayoutCheck: 0,
        totalCommonsTake: 0
      };
    }

    const isPureConsignor = prefix === 'BB-';
    const isCommonsClaimed = prefix === 'COMMONS-';
    const grossPrice = Number(sale.grossAmount || 0);
    const netStoreDeposit = Number(sale.netPayout !== undefined ? sale.netPayout : (grossPrice - Number(sale.fees ?? 0)));
    const venueFee = Math.max(0, Number(sale.fees !== undefined ? sale.fees : (grossPrice - netStoreDeposit)));
    const itemCostBasis = (isPureConsignor || isCommonsClaimed) ? 0 : Number(sale.cost || 0);
    const shippingLabelRecouped = (isPureConsignor || isCommonsClaimed) ? 0 : Number((sale as any).shippingCost || 0);
    const costBasis = Number((itemCostBasis + shippingLabelRecouped).toFixed(2));
    const netSurplus = Math.max(0, Number((netStoreDeposit - itemCostBasis).toFixed(2)));
    const curatorRatio = (policyConfig.value.curatorSharePct || 70) / 100;
    const commonsRatio = (policyConfig.value.commonsSharePct || 30) / 100;
    const curatorTake = isCommonsClaimed
      ? 0
      : isPureConsignor
        ? netStoreDeposit
        : Number((costBasis + (netSurplus * curatorRatio)).toFixed(2));
    const commonsTake = isCommonsClaimed
      ? netSurplus
      : isPureConsignor
        ? 0
        : Number((netSurplus * commonsRatio).toFixed(2));

    groups[prefix].items.push({
      date: sale.date,
      sku: sale.sku || sale.upc || sale.soNumber || 'N/A',
      title: sale.title || 'Sold Item',
      grossPrice,
      venueFee,
      costBasis,
      netSurplus,
      curatorTake,
      rawSale: sale
    });

    groups[prefix].totalGross = Number((groups[prefix].totalGross + grossPrice).toFixed(2));
    groups[prefix].totalVenueFee = Number((groups[prefix].totalVenueFee + venueFee).toFixed(2));
    groups[prefix].totalCostBasis = Number((groups[prefix].totalCostBasis + costBasis).toFixed(2));
    groups[prefix].totalNetSurplus = Number((groups[prefix].totalNetSurplus + netSurplus).toFixed(2));
    groups[prefix].totalCuratorProfit = Number((groups[prefix].totalCuratorProfit + (isCommonsClaimed ? 0 : isPureConsignor ? netStoreDeposit : (netSurplus * curatorRatio))).toFixed(2));
    groups[prefix].totalCommonsTake = Number((groups[prefix].totalCommonsTake + commonsTake).toFixed(2));
    groups[prefix].grossCuratorShare = Number((groups[prefix].totalCostBasis + groups[prefix].totalCuratorProfit).toFixed(2));
  }

  const allGroups = Object.values(groups);
  const totalGrossAll = Number(allGroups.reduce((sum, g) => sum + g.totalGross, 0).toFixed(2));

  // First pass: compute consignor rent offsets, labor hours, and base payouts
  for (const grp of allGroups) {
    const grossRatio = totalGrossAll > 0 ? (grp.totalGross / totalGrossAll) : 0;
    const rentShare = Number((grossRatio * FIXED_BOOTH_RENT).toFixed(2));
    grp.rentDeduction = rentShare;
    grp.bonusSurplusDividend = 0;
    grp.laborHoursLogged = grp.prefix === 'PDXGL-' ? periodLaborHours.value.PDXGL : grp.prefix === 'HUCK-' ? periodLaborHours.value.HUCK : 0;

    if (grp.isCommonsPool) {
      grp.totalCuratorProfit = 0;
      grp.grossCuratorShare = 0;
      grp.totalPayoutCheck = 0;
    } else if (grp.isConsignor) {
      // Pure Consignor: Gross - 15% Mall Fee - Proportional Booth Rent Share
      grp.totalCuratorProfit = Math.max(0, Number((grp.totalGross - grp.totalVenueFee - rentShare).toFixed(2)));
      grp.totalPayoutCheck = grp.totalCuratorProfit;
    } else {
      // Co-op Member: Rent is covered by Commons Pool
      const reimbursements = memberReimbursements.value[grp.prefix] || 0;
      grp.reimbursements = reimbursements;
      grp.totalPayoutCheck = Number((grp.grossCuratorShare + reimbursements).toFixed(2));
    }
  }

  // Second pass: Gate 4B WSDE Partner Surplus Sharing when Commons Pool exceeds Operating Costs
  const totalCommonsPool = Number(allGroups.reduce((acc, g) => acc + g.totalCommonsTake, 0).toFixed(2));
  const consignorRentOffsets = Number(
    allGroups.filter(g => g.isConsignor).reduce((acc, g) => acc + (g.rentDeduction || 0), 0).toFixed(2)
  );
  const netBoothRentForCoop = Math.max(0, Number((FIXED_BOOTH_RENT - consignorRentOffsets).toFixed(2)));
  const carriedOverShortfall = isMonthInProgress.value ? 0 : Math.max(0, Number(policyConfig.value.carriedOverShortfall || 0));
  const totalCommonsOverhead = Number((netBoothRentForCoop + totalTechOpsAmount.value + totalSuppliesAmount.value + carriedOverShortfall).toFixed(2));
  const commonsNetBalance = Number((totalCommonsPool - totalCommonsOverhead).toFixed(2));

  const coopPartners = allGroups.filter(g => !g.isConsignor && !g.isCommonsPool);
  if (commonsNetBalance > 0 && coopPartners.length > 0 && !isMonthInProgress.value) {
    const reserveSliceRatio =
      surplusPolicyMode.value === 'reserve_100'
        ? 1.0
        : surplusPolicyMode.value === 'cap_100'
          ? 0.0
          : (policyConfig.value.reserveSharePct ?? 10) / 100;

    const rawReserve = Number((commonsNetBalance * reserveSliceRatio).toFixed(2));
    const capRoom = Math.max(0, (policyConfig.value.reserveCapTarget || 500) - (policyConfig.value.currentReserveBalance || 0));
    const effectiveReserve = surplusPolicyMode.value === 'reserve_100' ? commonsNetBalance : Math.min(rawReserve, capRoom);
    const distributablePool = Math.max(0, Number((commonsNetBalance - effectiveReserve).toFixed(2)));

    const salesWeight = policyConfig.value.salesPatronagePct ?? 60;
    const laborWeight = policyConfig.value.laborPatronagePct ?? 30;
    const totalWeight = salesWeight + laborWeight;
    const salesPool = totalWeight > 0 ? Number((distributablePool * (salesWeight / totalWeight)).toFixed(2)) : distributablePool;
    const laborPool = Math.max(0, Number((distributablePool - salesPool).toFixed(2)));

    const totalCoopNetSurplus = Number(coopPartners.reduce((acc, g) => acc + g.totalNetSurplus, 0).toFixed(2));
    const totalCoopLaborHours = Number(coopPartners.reduce((acc, g) => acc + (g.laborHoursLogged || 0), 0).toFixed(2));

    for (const grp of coopPartners) {
      const salesShareRatio =
        surplusSplitBasis.value === 'equal'
          ? 1 / coopPartners.length
          : totalCoopNetSurplus > 0
            ? grp.totalNetSurplus / totalCoopNetSurplus
            : 1 / coopPartners.length;
      const laborShareRatio =
        totalCoopLaborHours > 0
          ? (grp.laborHoursLogged || 0) / totalCoopLaborHours
          : salesShareRatio;

      const salesBonus = Number((salesPool * salesShareRatio).toFixed(2));
      const laborBonus = Number((laborPool * laborShareRatio).toFixed(2));
      const bonus = Number((salesBonus + laborBonus).toFixed(2));
      grp.bonusSurplusDividend = bonus;
      grp.totalPayoutCheck = Number((grp.grossCuratorShare + (grp.reimbursements || 0) + bonus).toFixed(2));
    }
  }

  return allGroups;
});

// Partner statements visible under the /sales partner filter (All Co-op | HUCK | BB | PDXGL)
const visiblePartnerSettlements = computed(() => {
  const f = (props.partnerFilter || 'all').toUpperCase();
  const list = f === 'ALL'
    ? [...partnerSettlements.value]
    : partnerSettlements.value.filter(p => String(p.prefix || '').replace(/[-_]$/, '').toUpperCase() === f);
  // Huckleberry Collective (HUCK-) always first
  const rank = (p: any) => (String(p.prefix || '').toUpperCase().startsWith('HUCK') ? 0 : 1);
  return list.sort((a, b) => rank(a) - rank(b));
});

const settlementSummary = computed(() => {
  const totalGross = Number(partnerSettlements.value.reduce((acc, p) => acc + p.totalGross, 0).toFixed(2));
  const totalVenueFee = Number(partnerSettlements.value.reduce((acc, p) => acc + p.totalVenueFee, 0).toFixed(2));
  const totalCostBasis = Number(partnerSettlements.value.reduce((acc, p) => acc + p.totalCostBasis, 0).toFixed(2));
  const totalNetSurplus = Number(partnerSettlements.value.reduce((acc, p) => acc + p.totalNetSurplus, 0).toFixed(2));
  const totalCuratorPayouts = Number(partnerSettlements.value.reduce((acc, p) => acc + p.totalPayoutCheck, 0).toFixed(2));
  const totalCommonsPool = Number(partnerSettlements.value.reduce((acc, p) => acc + p.totalCommonsTake, 0).toFixed(2));

  const FIXED_BOOTH_RENT = effectiveMonthlyRent.value; // live Appwrite warehouse rent, or 0 while the month is still in progress
  const totalStorePayout = Number((totalGross - totalVenueFee).toFixed(2));
  const memoryDenNetCheck = Number((totalStorePayout - FIXED_BOOTH_RENT).toFixed(2));

  // Consignor Rent Contributions collected (e.g. B&B's rent deduction) offset the booth rent
  const consignorRentOffsets = Number(partnerSettlements.value.filter(p => p.isConsignor).reduce((acc, p) => acc + (p.rentDeduction || 0), 0).toFixed(2));
  const netBoothRentForCoop = Math.max(0, Number((FIXED_BOOTH_RENT - consignorRentOffsets).toFixed(2)));

  const techOps = totalTechOpsAmount.value;
  const supplies = totalSuppliesAmount.value;
  const carriedOverShortfall = isMonthInProgress.value ? 0 : Math.max(0, Number(policyConfig.value.carriedOverShortfall || 0));
  const totalCommonsOverhead = Number((netBoothRentForCoop + techOps + supplies + carriedOverShortfall).toFixed(2));
  const commonsNetBalance = Number((totalCommonsPool - totalCommonsOverhead).toFixed(2));
  const isCommonsFullyCovered = commonsNetBalance >= 0;
  const distributablePartnerBonusPool = Number(
    partnerSettlements.value.reduce((acc, p) => acc + Number(p.bonusSurplusDividend || 0), 0).toFixed(2)
  );
  const reserveAddition = Math.max(0, Number((commonsNetBalance - distributablePartnerBonusPool).toFixed(2)));
  const salesWeight = policyConfig.value.salesPatronagePct ?? 60;
  const laborWeight = policyConfig.value.laborPatronagePct ?? 30;
  const totalWeight = salesWeight + laborWeight;
  const laborBonusPool =
    distributablePartnerBonusPool > 0 && totalWeight > 0
      ? Number((distributablePartnerBonusPool * (laborWeight / totalWeight)).toFixed(2))
      : 0;
  const breakevenProgressPct =
    totalCommonsOverhead > 0
      ? Math.min(100, Math.round((totalCommonsPool / totalCommonsOverhead) * 100))
      : 100;

  return {
    totalGross,
    totalVenueFee,
    // Effective venue fee % derived from the real committed sales (fee / gross), never a typed-in rate
    venueFeePct: totalGross > 0 ? Number(((totalVenueFee / totalGross) * 100).toFixed(1)) : 0,
    totalStorePayout,
    totalCostBasis,
    totalNetSurplus,
    totalCuratorPayouts,
    totalCommonsPool,
    boothRent: FIXED_BOOTH_RENT,
    isMonthInProgress: isMonthInProgress.value,
    consignorRentOffsets,
    netBoothRentForCoop,
    techOps,
    supplies,
    carriedOverShortfall,
    totalCommonsOverhead,
    commonsNetBalance,
    isCommonsFullyCovered,
    distributablePartnerBonusPool,
    laborBonusPool,
    reserveAddition,
    breakevenProgressPct,
    memoryDenNetCheck,
    memoryDenDisbursementDate: memoryDenDisbursementDate.value
  };
});

const getPeriodLabel = (): string => {
  if (selectedPeriod.value === 'all') return 'All Time Realized Sales';
  const found = availableMonths.value.find(m => m.key === selectedPeriod.value);
  if (found) return found.label;
  return selectedPeriod.value;
};

const downloadPartnerPdf = (partner: any) => {
  try {
    const data: PartnerStatementData = {
      statementDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      periodLabel: getPeriodLabel(),
      partnerName: partner.name,
      prefix: partner.prefix,
      items: partner.items,
      totalGross: partner.totalGross,
      totalVenueFee: partner.totalVenueFee,
      totalCostBasis: partner.totalCostBasis,
      totalNetSurplus: partner.totalNetSurplus,
      totalCuratorProfit: partner.totalCuratorProfit,
      totalPayoutCheck: partner.totalPayoutCheck,
      boothLocation: 'Memory Den (Booth 0EJ)',
      reimbursements: partner.reimbursements || 0,
      rentDeduction: partner.isConsignor ? (partner.rentDeduction || 0) : undefined
    };

    const doc = generatePartnerSettlementPdf(data);
    const filename = `Settlement_${partner.prefix.replace(/[-_]$/, '')}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
    addToast({ type: 'success', message: `Downloaded PDF statement for ${partner.name}!` });
  } catch (err: any) {
    console.error('PDF Generation Error:', err);
    addToast({ type: 'error', message: 'Failed to generate PDF statement: ' + err.message });
  }
};

const exportAllPartnerPdfs = () => {
  if (partnerSettlements.value.length === 0) {
    addToast({ type: 'warning', message: 'No partner statements to generate' });
    return;
  }
  partnerSettlements.value.forEach(p => downloadPartnerPdf(p));
  addToast({ type: 'success', message: `Downloaded ${partnerSettlements.value.length} partner settlement statements!` });
};
</script>
