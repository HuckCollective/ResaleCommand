<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
    
    <!-- Hero Banner with Richard Wolff WSDE Framing -->
    <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/15 via-base-200 to-base-100 border border-primary/25 p-6 sm:p-10 shadow-xl">
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
        <div class="space-y-3 max-w-2xl">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="badge badge-primary font-bold gap-1 text-xs px-3 py-1 shadow-sm">
              <Icon icon="solar:shield-star-bold" class="w-3.5 h-3.5" />
              Worker Self-Directed Enterprise (WSDE)
            </span>
            <span class="badge badge-outline text-xs font-semibold">
              Democracy at Work
            </span>
            <span class="badge badge-neutral text-xs font-mono font-bold">
              1 Member = 1 Vote
            </span>
          </div>

          <h1 class="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-base-content">
            The Huckleberry Collective
          </h1>
          <p class="text-sm sm:text-base text-base-content/85 leading-relaxed font-medium">
            Worker Cooperative &amp; Multi-Channel Resale Consortium. Equal partners, 100% financial transparency, and shared prosperity without middleman cuts.
          </p>
        </div>

        <!-- Quick Action Buttons -->
        <div class="flex flex-wrap items-center gap-2.5 shrink-0">
          <a 
            href="/expenses" 
            class="btn btn-sm btn-secondary gap-2 shadow-sm font-bold"
            title="Upload invoice PDFs and view Commons Expense Ledger"
          >
            <Icon icon="solar:document-bold" class="w-4 h-4" />
            <span>Upload Invoices &amp; Receipts</span>
          </a>

          <button 
            @click="handlePrint" 
            class="btn btn-sm btn-outline gap-2 shadow-sm font-bold bg-base-100/80 hover:bg-base-200"
            title="Print or Save Charter as PDF"
          >
            <Icon icon="solar:printer-bold" class="w-4 h-4 text-primary" />
            <span>Print / PDF</span>
          </button>
          
          <button 
            @click="copyShareLink" 
            class="btn btn-sm btn-primary gap-2 shadow-sm font-bold"
            title="Copy link to send to prospective members or partner curators"
          >
            <Icon :icon="copiedLink ? 'solar:check-circle-bold' : 'solar:share-bold'" class="w-4 h-4" />
            <span>{{ copiedLink ? 'Copied Link!' : 'Share with Members' }}</span>
          </button>
        </div>
      </div>

      <!-- The 3 Core Guarantees (Richard Wolff Principles) -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-8 pt-6 border-t border-base-content/10">
        <div class="bg-base-100/80 backdrop-blur-xs p-4 rounded-2xl border border-success/30 shadow-xs space-y-1">
          <div class="flex items-center gap-2">
            <span class="text-xl">🛡️</span>
            <span class="font-extrabold text-sm text-success">Guarantee 1</span>
          </div>
          <div class="text-base font-black text-base-content">100% Capital Returned First</div>
          <p class="text-xs text-base-content/75 leading-relaxed">
            Whatever you paid out of pocket to buy inventory is returned dollar-for-dollar first. You never take a loss on sold goods.
          </p>
        </div>

        <div class="bg-base-100/80 backdrop-blur-xs p-4 rounded-2xl border border-primary/30 shadow-xs space-y-1">
          <div class="flex items-center gap-2">
            <span class="text-xl">💎</span>
            <span class="font-extrabold text-sm text-primary">Guarantee 2</span>
          </div>
          <div class="text-base font-black text-base-content">70% Curator Profit Share</div>
          <p class="text-xs text-base-content/75 leading-relaxed">
            You had the eye to spot the item and took the sourcing risk. You keep the vast majority of the net profit on every sale.
          </p>
        </div>

        <div class="bg-base-100/80 backdrop-blur-xs p-4 rounded-2xl border border-secondary/30 shadow-xs space-y-1">
          <div class="flex items-center gap-2">
            <span class="text-xl">🤝</span>
            <span class="font-extrabold text-sm text-secondary">Guarantee 3</span>
          </div>
          <div class="text-base font-black text-base-content">30% Shared Commons Pool</div>
          <p class="text-xs text-base-content/75 leading-relaxed">
            A transparent shared fund covers booth rent ($382.50), software, labels, and pays labor dividends to members working the floor and social.
          </p>
        </div>
      </div>
    </div>

    <!-- RESPONSIVE SEGMENTED MODULE SWITCHER (NO SIDE SCROLLING) -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 p-1.5 bg-base-200/90 rounded-2xl border border-base-300 shadow-sm">
      <button 
        v-for="section in sections" 
        :key="section.id"
        @click="activeSection = section.id"
        type="button"
        class="btn btn-sm sm:btn-md gap-2 font-bold rounded-xl transition-all text-xs sm:text-sm"
        :class="activeSection === section.id ? 'btn-primary shadow-sm' : 'btn-ghost hover:bg-base-100 text-base-content/80'"
      >
        <Icon :icon="section.icon" class="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
        <span class="truncate">{{ section.label }}</span>
      </button>
    </div>

    <!-- MODULE 1: THE 70/30 PROFIT ENGINE & LIVE CALCULATOR -->
    <div v-show="activeSection === 'payouts'" class="space-y-6">
      
      <!-- Interactive 70/30 Simulator -->
      <div class="card bg-base-100 border border-primary/30 shadow-xl overflow-hidden">
        <div class="p-4 sm:p-6 bg-gradient-to-r from-primary/10 via-base-200/60 to-base-100 border-b border-base-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-2.5">
            <div class="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
              <Icon icon="solar:calculator-bold" class="w-6 h-6" />
            </div>
            <div>
              <h2 class="font-black text-lg sm:text-xl text-base-content">
                Live Member Payout Simulator (70 / 30 Net Surplus)
              </h2>
              <p class="text-xs text-base-content/70">
                Test any item to see exactly what you take home and what goes to the shared commons.
              </p>
            </div>
          </div>
          <span class="badge badge-sm badge-primary font-bold">Universal Channel Math</span>
        </div>

        <div class="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <!-- Inputs Column -->
          <div class="lg:col-span-5 space-y-4">
            <h3 class="font-bold text-xs uppercase tracking-wider text-base-content/60">Sale Inputs</h3>

            <!-- Sale Price -->
            <div class="form-control">
              <label class="label py-1">
                <span class="label-text font-bold text-xs">Retail Customer Price</span>
                <span class="label-text-alt font-mono font-bold text-primary text-sm">${{ simSalePrice.toFixed(2) }}</span>
              </label>
              <input 
                type="range" 
                v-model.number="simSalePrice" 
                min="10" 
                max="250" 
                step="5" 
                class="range range-xs range-primary" 
              />
            </div>

            <!-- Member Cost Basis -->
            <div class="form-control">
              <label class="label py-1">
                <span class="label-text font-bold text-xs">Your Acquisition Cost (100% Returned)</span>
                <span class="label-text-alt font-mono font-bold text-success text-sm">${{ simCostBasis.toFixed(2) }}</span>
              </label>
              <input 
                type="range" 
                v-model.number="simCostBasis" 
                :max="Math.min(simSalePrice * 0.7, 100)" 
                min="0" 
                step="2.5" 
                class="range range-xs range-success" 
              />
              <span class="text-[11px] text-base-content/60 mt-1">What you paid at thrift, estate sale, or auction.</span>
            </div>

            <!-- Sales Channel Fee Presets -->
            <div class="form-control space-y-1.5">
              <label class="label py-0">
                <span class="label-text font-bold text-xs">Sales Channel &amp; Venue Cut</span>
                <span class="label-text-alt font-mono font-bold">{{ simVenueFeeRate }}%</span>
              </label>
              <div class="grid grid-cols-3 gap-2">
                <button 
                  type="button" 
                  class="btn btn-xs rounded-xl font-bold" 
                  :class="simVenueFeeRate === 15 ? 'btn-primary' : 'btn-ghost border border-base-300'"
                  @click="simVenueFeeRate = 15"
                >
                  Memory Den (15%)
                </button>
                <button 
                  type="button" 
                  class="btn btn-xs rounded-xl font-bold" 
                  :class="simVenueFeeRate === 13 ? 'btn-primary' : 'btn-ghost border border-base-300'"
                  @click="simVenueFeeRate = 13"
                >
                  eBay / Etsy (13%)
                </button>
                <button 
                  type="button" 
                  class="btn btn-xs rounded-xl font-bold" 
                  :class="simVenueFeeRate === 2.9 ? 'btn-primary' : 'btn-ghost border border-base-300'"
                  @click="simVenueFeeRate = 2.9"
                >
                  Pop-up / Card (2.9%)
                </button>
              </div>
            </div>

            <!-- Explainer Box -->
            <div class="p-3.5 rounded-2xl bg-base-200/60 border border-base-300 text-[11px] space-y-1 text-base-content/75">
              <div class="font-bold text-base-content">Why 70 / 30 is the Fairest Model:</div>
              <p>
                Sourcing great goods takes curation skill and capital risk. You keep <strong>70% of the net profit</strong>. The collective takes <strong>30%</strong> to pay the booth rent, software, and member staffing.
              </p>
            </div>
          </div>

          <!-- Payout Breakdown Column -->
          <div class="lg:col-span-7 bg-base-200/50 p-5 rounded-2xl border border-base-300 space-y-3.5">
            <h3 class="font-bold text-xs uppercase tracking-wider text-base-content/60">
              Where Every Dollar Goes (100% Auditable)
            </h3>

            <!-- Gross -->
            <div class="flex items-center justify-between p-2.5 rounded-xl bg-base-100 border border-base-300">
              <span class="font-bold text-xs text-base-content">Gross Customer Payment</span>
              <span class="font-black text-sm text-base-content font-mono">${{ simSalePrice.toFixed(2) }}</span>
            </div>

            <!-- Venue Cut -->
            <div class="flex items-center justify-between p-2.5 rounded-xl bg-base-100 border border-base-300 text-xs">
              <span class="text-error font-medium flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-error"></span>
                Venue / Platform Fee ({{ simVenueFeeRate }}%)
              </span>
              <span class="font-mono font-bold text-error">-${{ simVenueFee.toFixed(2) }}</span>
            </div>

            <!-- Cost Returned -->
            <div class="flex items-center justify-between p-2.5 rounded-xl bg-success/10 border border-success/30 text-xs">
              <div>
                <span class="font-bold text-success flex items-center gap-1.5">
                  <Icon icon="solar:shield-check-bold" class="w-3.5 h-3.5" />
                  Your Cost Basis Returned (100%)
                </span>
                <div class="text-[10px] text-base-content/65">Guaranteed refund of your out-of-pocket spend</div>
              </div>
              <span class="font-mono font-black text-success text-sm">+${{ simCostBasis.toFixed(2) }}</span>
            </div>

            <!-- Net Surplus -->
            <div class="p-3 rounded-xl bg-primary/10 border border-primary/25 space-y-2 text-xs">
              <div class="flex items-center justify-between font-bold text-primary">
                <span>Net Surplus Generated (Profit to Split)</span>
                <span class="font-mono font-black text-sm">${{ simNetSurplus.toFixed(2) }}</span>
              </div>

              <div class="grid grid-cols-2 gap-2 pt-1">
                <div class="bg-base-100 p-2.5 rounded-xl border border-primary/20">
                  <div class="text-[10px] text-base-content/60 font-semibold">Your Curator Profit (70%)</div>
                  <div class="font-mono font-black text-sm text-success mt-0.5">+${{ simCuratorProfit.toFixed(2) }}</div>
                </div>
                <div class="bg-base-100 p-2.5 rounded-xl border border-primary/20">
                  <div class="text-[10px] text-base-content/60 font-semibold">Commons Pool (30%)</div>
                  <div class="font-mono font-black text-sm text-secondary mt-0.5">${{ simCommonsTake.toFixed(2) }}</div>
                </div>
              </div>
            </div>

            <!-- Final Take-Home Box -->
            <div class="p-4 rounded-2xl bg-gradient-to-r from-success/20 to-primary/20 border border-success/40 flex items-center justify-between shadow-xs">
              <div>
                <div class="text-xs font-black uppercase tracking-wider text-base-content">
                  Your Total Cash Payout
                </div>
                <div class="text-[11px] text-base-content/75 font-medium">
                  Cost ($<span class="font-mono">{{ simCostBasis.toFixed(2) }}</span>) + Profit ($<span class="font-mono">{{ simCuratorProfit.toFixed(2) }}</span>)
                </div>
              </div>
              <div class="text-2xl sm:text-3xl font-black text-success font-mono">
                ${{ (simCostBasis + simCuratorProfit).toFixed(2) }}
              </div>
            </div>

            <!-- Settlement Importer Quick Action Banner -->
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-base-200/90 border border-base-300">
              <div class="space-y-0.5">
                <div class="font-bold text-xs text-base-content flex items-center gap-1.5">
                  <Icon icon="solar:document-text-bold" class="w-4 h-4 text-primary" />
                  Monthly Payout History Ready?
                </div>
                <div class="text-[11px] text-base-content/70">
                  Upload your Memory Den Ricochet CSV to auto-split partner shares and generate 1-click PDF statements.
                </div>
              </div>
              <a href="/sales/import" class="btn btn-xs sm:btn-sm btn-primary gap-1.5 font-bold shrink-0 shadow-sm">
                <Icon icon="solar:import-bold-duotone" class="w-4 h-4" />
                <span>Launch Settlement Importer</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Sourcing vs Co-op Fund Card -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="p-5 rounded-2xl bg-base-100 border border-base-300 shadow-sm space-y-2">
          <div class="flex items-center gap-2 text-primary font-bold text-sm">
            <Icon icon="solar:user-bold" class="w-4 h-4" />
            Member Personal Curation (Most Common)
          </div>
          <p class="text-xs text-base-content/75 leading-relaxed">
            You buy an item with personal money (e.g. at thrift or estate sale). You receive <strong>100% of your purchase cost back + 70% of the net profit</strong> when it sells.
          </p>
        </div>

        <div class="p-5 rounded-2xl bg-base-100 border border-base-300 shadow-sm space-y-2">
          <div class="flex items-center gap-2 text-secondary font-bold text-sm">
            <Icon icon="solar:box-minimalistic-bold" class="w-4 h-4" />
            Co-op Shared Purchases (Bulk Auction Lots)
          </div>
          <p class="text-xs text-base-content/75 leading-relaxed">
            A large lot is bought with the shared Huckleberry Collective business account. The co-op fund gets its cost back 100%, and the profit is split among the members who unboxed, tested, and staged it!
          </p>
        </div>
      </div>
    </div>

    <!-- MODULE 2: MONTHLY SETTLEMENTS & BOOTH RENT -->
    <div v-show="activeSection === 'monthly'" class="space-y-6">
      <div class="card bg-base-100 border border-base-300 shadow-md">
        <div class="card-body p-6 space-y-6">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary shrink-0">
              <Icon icon="solar:calendar-date-bold" class="w-6 h-6" />
            </div>
            <div>
              <h2 class="text-xl font-black text-base-content tracking-tight">
                Monthly Settlement Cadence &amp; Rent Accounting
              </h2>
              <p class="text-xs text-base-content/70">
                How Memory Den pays once a month, how the $382.50 booth rent is covered, and multi-channel handling.
              </p>
            </div>
          </div>

          <!-- How Mall Check Works -->
          <div class="bg-base-200/50 p-5 rounded-2xl border border-base-300 space-y-2.5 text-xs text-base-content/80 leading-relaxed">
            <h3 class="font-bold text-sm text-base-content flex items-center gap-2">
              <Icon icon="solar:bill-check-bold" class="w-4 h-4 text-success" />
              The Reality: Memory Den Deducts Rent on the Check Automatically
            </h3>
            <p>
              Antique malls pay the collective <strong>once a month</strong> by check or direct deposit. Memory Den automatically subtracts their 15% register cut and the <strong>$382.50 fixed booth rent</strong> directly from gross sales before delivering the net deposit.
            </p>
            <p>
              Therefore, settlements are run <strong>monthly</strong> matching the venue sales CSV. Under our <strong>70 / 30 rule</strong>, the collective's 30% cut effortlessly pays the $382.50 rent, so no member ever gets a surprise rent bill!
            </p>
          </div>

          <!-- Real Monthly Walkthrough Table -->
          <div class="space-y-3 pt-1">
            <h3 class="font-extrabold text-sm text-base-content flex items-center gap-2">
              <Icon icon="solar:document-text-bold" class="w-4 h-4 text-primary" />
              Real Monthly Statement: $2,500 Gross Sales at Memory Den (Booth 0EJ)
            </h3>

            <div class="overflow-x-auto rounded-2xl border border-base-300 bg-base-100">
              <table class="table table-sm w-full text-xs">
                <thead class="bg-base-200/80 text-base-content/70">
                  <tr>
                    <th>Line Item</th>
                    <th class="text-center font-bold">Total Booth Pool</th>
                    <th class="text-center text-primary font-bold">Huck Collective (A)</th>
                    <th class="text-center text-secondary font-bold">PDX Game Library (B)</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-base-200">
                  <tr>
                    <td class="font-bold">Gross Register Sales</td>
                    <td class="text-center font-mono font-black">$2,500.00</td>
                    <td class="text-center font-mono font-bold">$1,600.00 (64%)</td>
                    <td class="text-center font-mono font-bold">$900.00 (36%)</td>
                  </tr>
                  <tr class="bg-base-200/30 text-error">
                    <td>Memory Den 15% Fee (Withheld)</td>
                    <td class="text-center font-mono font-bold">-$375.00</td>
                    <td class="text-center font-mono">-$240.00</td>
                    <td class="text-center font-mono">-$135.00</td>
                  </tr>
                  <tr class="bg-base-200/30 text-error">
                    <td>Fixed Booth Rent (Withheld)</td>
                    <td class="text-center font-mono font-bold">-$382.50</td>
                    <td class="text-center font-mono" colspan="2">Paid out of the 30% Commons Pool!</td>
                  </tr>
                  <tr class="bg-success/10 font-bold text-success">
                    <td>Curator Cost Basis Recouped (100%)</td>
                    <td class="text-center font-mono font-black">-$550.00</td>
                    <td class="text-center font-mono">+ $350.00 (Cost Back)</td>
                    <td class="text-center font-mono">+ $200.00 (Cost Back)</td>
                  </tr>
                  <tr>
                    <td class="font-extrabold text-base-content">Net Surplus (Profit Generated)</td>
                    <td class="text-center font-mono font-black text-primary">$1,575.00</td>
                    <td class="text-center font-mono font-bold">$1,010.00</td>
                    <td class="text-center font-mono font-bold">$565.00</td>
                  </tr>
                  <tr class="bg-primary/5 font-bold">
                    <td class="text-primary">Curator 70% Profit Share</td>
                    <td class="text-center font-mono text-primary font-black">$1,102.50</td>
                    <td class="text-center font-mono text-success">+$707.00</td>
                    <td class="text-center font-mono text-secondary">+$395.50</td>
                  </tr>
                  <tr class="bg-secondary/5 font-bold">
                    <td class="text-secondary">30% Commons Pool Take</td>
                    <td class="text-center font-mono text-secondary font-black">$472.50</td>
                    <td class="text-center text-base-content/70" colspan="2">
                      Covers $382.50 Rent + $60 Software/AI + $30 Reserve
                    </td>
                  </tr>
                  <tr class="bg-gradient-to-r from-success/20 to-primary/20 text-base-content font-black text-sm">
                    <td>TOTAL MONTHLY PAYOUT CHECK</td>
                    <td class="text-center font-mono">$1,652.50</td>
                    <td class="text-center font-mono text-success font-black text-base">$1,057.00</td>
                    <td class="text-center font-mono text-secondary font-black text-base">$595.50</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="p-3.5 rounded-2xl bg-info/10 border border-info/20 text-xs flex items-start gap-2.5">
              <Icon icon="solar:shield-check-bold" class="w-5 h-5 text-info shrink-0 mt-0.5" />
              <div>
                <span class="font-bold text-base-content">Why This Math Works in Slow Months: </span>
                <span class="text-base-content/75">
                  Notice that the 30% Commons Pool collected <strong>$472.50</strong>, which fully paid the $382.50 booth rent and left money for reserve. In slower months, the accumulated reserve cushions rent so no member pays out of pocket!
                </span>
              </div>
            </div>
          </div>

          <!-- Multi-Channel Comparison (Online / Flea Markets) -->
          <div class="space-y-2.5 pt-2">
            <h4 class="font-bold text-xs uppercase tracking-wider text-base-content/60">Across Other Channels</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div class="p-4 rounded-2xl bg-base-200/60 border border-base-300 space-y-1">
                <div class="font-bold text-primary flex items-center gap-1.5">
                  <Icon icon="solar:cart-large-bold" class="w-4 h-4" />
                  Online Marketplaces (eBay, Etsy, Subsite)
                </div>
                <p class="text-base-content/75">
                  Platform takes 12%–15% + postage label. Curator gets 100% cost back + 70% of profit. Collective keeps 30% for shipping supplies &amp; hosting.
                </p>
              </div>

              <div class="p-4 rounded-2xl bg-base-200/60 border border-base-300 space-y-1">
                <div class="font-bold text-secondary flex items-center gap-1.5">
                  <Icon icon="solar:shop-2-bold" class="w-4 h-4" />
                  Pop-ups &amp; Flea Markets
                </div>
                <p class="text-base-content/75">
                  Card processing is only 2.9%. Curator gets cost back + 70% of profit. Collective keeps 30% to pay the table fee and banner printing.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- MODULE 3: SHARED COMMONS EXPENSE REIMBURSEMENT LEDGER (OPEN COLLECTIVE) -->
    <div v-show="activeSection === 'expenses'" class="space-y-6">
      <div class="card bg-base-100 border border-base-300 shadow-md rounded-3xl overflow-hidden">
        <div class="card-body p-6 sm:p-8 space-y-6">
          <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-base-200 pb-6">
            <div class="space-y-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="badge badge-primary badge-sm font-bold uppercase tracking-wider">Tier 1 Overhead</span>
                <span class="badge badge-outline badge-sm font-medium">100% Tax Deductible</span>
              </div>
              <h2 class="text-2xl font-black text-base-content tracking-tight flex items-center gap-2.5">
                <Icon icon="solar:wallet-bold-duotone" class="w-7 h-7 text-primary" />
                Shared Commons Expense Pool
              </h2>
              <p class="text-xs sm:text-sm text-base-content/70 max-w-2xl leading-relaxed">
                Out-of-pocket operational costs (booth space rental, thermal tags, display hardware, AI tech credits) are covered dollar-for-dollar from the 30% Commons Pool before profits are distributed.
              </p>
            </div>

            <!-- Single Clean Button: Push to Expenses -->
            <a 
              href="/expenses" 
              class="btn btn-primary rounded-2xl font-black text-sm gap-2 h-12 px-6 shadow-md shadow-primary/25 whitespace-nowrap active:scale-95 transition-all"
            >
              <span>Manage Expenses &amp; Invoices</span>
              <Icon icon="solar:arrow-right-bold" class="w-5 h-5" />
            </a>
          </div>

          <!-- Top KPI Overview (Commons Pool Status) -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div class="p-4 rounded-2xl bg-base-200/60 border border-base-300 shadow-xs space-y-1">
              <div class="text-[11px] font-bold text-base-content/60 uppercase tracking-wider">Total Commons Expenses</div>
              <div class="text-xl sm:text-2xl font-black text-base-content font-mono">$2,819.54</div>
              <div class="text-xs text-base-content/60 font-medium">49 logged receipts</div>
            </div>

            <div class="p-4 rounded-2xl bg-success/5 border border-success/30 shadow-xs space-y-1">
              <div class="text-[11px] font-bold text-success uppercase tracking-wider">Reimbursed to Members</div>
              <div class="text-xl sm:text-2xl font-black text-success font-mono">$134.54</div>
              <div class="text-xs text-base-content/60 font-medium">Repaid from Tier 1 Pool</div>
            </div>

            <div class="p-4 rounded-2xl bg-warning/5 border border-warning/30 shadow-xs space-y-1">
              <div class="text-[11px] font-bold text-warning uppercase tracking-wider">Pending Reimbursement</div>
              <div class="text-xl sm:text-2xl font-black text-warning font-mono">$2,685.00</div>
              <div class="text-xs text-base-content/60 font-medium">Owed to fronting members</div>
            </div>

            <div class="p-4 rounded-2xl bg-primary/5 border border-primary/30 shadow-xs space-y-1">
              <div class="text-[11px] font-bold text-primary uppercase tracking-wider">Active Booth Rent</div>
              <div class="text-xl sm:text-2xl font-black text-primary font-mono">$382.50<span class="text-xs font-normal opacity-70">/mo</span></div>
              <div class="text-xs text-base-content/60 font-medium">Memory Den (Booth 0EJ)</div>
            </div>
          </div>

          <!-- How the Open Collective Model Works -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div class="p-5 rounded-2xl bg-base-200/50 border border-base-300 space-y-2">
              <div class="flex items-center gap-2 text-primary font-bold text-sm">
                <Icon icon="solar:bill-check-bold" class="w-5 h-5" />
                1. Member Incurs Cost
              </div>
              <p class="text-xs text-base-content/75 leading-relaxed">
                Any member fronting cash for booth supplies, tape, or tech snaps a photo of the receipt on the Expenses page.
              </p>
            </div>

            <div class="p-5 rounded-2xl bg-base-200/50 border border-base-300 space-y-2">
              <div class="flex items-center gap-2 text-warning font-bold text-sm">
                <Icon icon="solar:clock-circle-bold" class="w-5 h-5" />
                2. Transparent Verification
              </div>
              <p class="text-xs text-base-content/75 leading-relaxed">
                Expense appears as "Pending" in the Open Collective ledger where all partners can verify the receipt attachment.
              </p>
            </div>

            <div class="p-5 rounded-2xl bg-base-200/50 border border-base-300 space-y-2">
              <div class="flex items-center gap-2 text-success font-bold text-sm">
                <Icon icon="solar:card-recive-bold" class="w-5 h-5" />
                3. Reimburse from 30% Pool
              </div>
              <p class="text-xs text-base-content/75 leading-relaxed">
                During monthly settlement, the 30% Commons Pool pays out reimbursements first before remaining profits distribute.
              </p>
            </div>
          </div>

          <!-- Bottom Action Banner -->
          <div class="p-4 sm:p-5 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div class="space-y-0.5 text-center sm:text-left">
              <div class="font-bold text-sm text-base-content">Need to log a receipt or view full line-item history?</div>
              <div class="text-xs text-base-content/70">Access multi-PDF invoice uploads, AI receipt scanning, and approval workflows in the dedicated workspace.</div>
            </div>
            <a 
              href="/expenses" 
              class="btn btn-sm btn-primary rounded-xl font-black gap-1.5 px-5 shadow-xs whitespace-nowrap"
            >
              <span>Go to Expenses &amp; Invoices</span>
              <Icon icon="solar:arrow-right-bold" class="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- MODULE 4: DEMOCRATIC GOVERNANCE & LOOMIO 4-SIGNAL CONSENT VOTING -->
    <div v-show="activeSection === 'governance'" class="space-y-6">
      <CoopGovernanceView />
    </div>

    <!-- MODULE 5: LEGAL STRUCTURE, PARTNER AUTONOMY & LABOR -->
    <div v-show="activeSection === 'legal'" class="space-y-6">
      <div class="card bg-base-100 border border-base-300 shadow-md">
        <div class="card-body p-6 space-y-6">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-neutral/15 flex items-center justify-center text-neutral shrink-0">
              <Icon icon="solar:diploma-verified-bold" class="w-6 h-6 text-base-content" />
            </div>
            <div>
              <h2 class="text-xl font-black text-base-content tracking-tight">
                Legal Consortium Model &amp; Labor Dividends
              </h2>
              <p class="text-xs text-base-content/70">
                Why members join as Contractual Cooperative Associates (1099-NEC), independent partner barcode prefixes, and verified labor dividends.
              </p>
            </div>
          </div>

          <!-- Why Consortium (No K-1s) -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="p-5 rounded-2xl bg-success/10 border border-success/30 space-y-2">
              <div class="flex items-center gap-2 text-success font-black text-sm">
                <Icon icon="solar:check-circle-bold" class="w-5 h-5" />
                The Co-op Consortium (Our Standard)
              </div>
              <ul class="text-xs text-base-content/80 space-y-1.5 list-disc list-inside">
                <li>Huckleberry Collective LLC holds the booth lease and bank account.</li>
                <li>Partners join under this Charter as <strong>Cooperative Associates</strong>.</li>
                <li>Earnings over $600 reported simply via <strong>Form 1099-NEC</strong>.</li>
                <li><strong>Zero K-1 tax headaches</strong> (saves $1,500+ in annual CPA fees).</li>
                <li>Partners retain complete brand identity and inventory ownership.</li>
              </ul>
            </div>

            <div class="p-5 rounded-2xl bg-base-200/60 border border-base-300 space-y-2">
              <div class="flex items-center gap-2 text-base-content font-black text-sm">
                <Icon icon="solar:users-group-two-rounded-bold" class="w-5 h-5 text-primary" />
                1 Member = 1 Vote Democracy
              </div>
              <p class="text-xs text-base-content/75 leading-relaxed">
                You don’t have to be on the state corporate deed to have a democratic voice. Our Charter legally guarantees <strong>1 Member = 1 Vote</strong> on all operational decisions using the Loomio consent protocol:
              </p>
              <div class="grid grid-cols-2 gap-2 text-[11px] pt-1">
                <span class="p-1.5 rounded-lg bg-success/20 font-bold text-center">🟢 Agree</span>
                <span class="p-1.5 rounded-lg bg-warning/20 font-bold text-center">🟡 Abstain</span>
                <span class="p-1.5 rounded-lg bg-secondary/20 font-bold text-center">🟠 Disagree</span>
                <span class="p-1.5 rounded-lg bg-error/20 font-bold text-center">🔴 Block (Veto)</span>
              </div>
            </div>
          </div>

          <!-- Multi-Org Prefixes -->
          <div class="p-5 rounded-2xl bg-base-200/50 border border-base-300 space-y-3">
            <h3 class="font-bold text-sm text-base-content flex items-center gap-2">
              <Icon icon="solar:scanner-bold" class="w-4 h-4 text-secondary" />
              Independent Barcode Prefixes (Collision-Free Tracking)
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div class="p-3 bg-base-100 rounded-xl border border-base-300">
                <span class="badge badge-primary font-mono font-bold text-[10px] mb-1">HUCK-</span>
                <div class="font-bold text-base-content">Huckleberry Collective</div>
                <p class="text-base-content/65">Curated vintage apparel, leatherwear, paperbacks, and oddities.</p>
              </div>
              <div class="p-3 bg-base-100 rounded-xl border border-base-300">
                <span class="badge badge-secondary font-mono font-bold text-[10px] mb-1">PDXGL-</span>
                <div class="font-bold text-base-content">PDX Game Library</div>
                <p class="text-base-content/65">Curated tabletop board games, roleplaying books, and accessories.</p>
              </div>
            </div>
          </div>

          <!-- Marketing Labor Recognition -->
          <div class="p-4 rounded-2xl bg-base-200/70 border border-base-300 space-y-2 text-xs">
            <div class="font-bold text-base-content flex items-center gap-1.5">
              <Icon icon="solar:camera-bold" class="w-4 h-4 text-accent" />
              Social Media, Photography &amp; Tech Hours Count as Labor:
            </div>
            <p class="text-base-content/75 leading-relaxed">
              In retail resale, nobody buys if nobody knows the goods are on the rack. Taking photos, staging displays, and broadcasting drops count as credited cooperative labor. Surplus left in the 30% commons pool after rent is distributed to members based on verified hours worked!
            </p>
          </div>

          <!-- Simple Labor & Engagement Logger -->
          <div class="card bg-base-200/50 border border-base-300 p-5 rounded-2xl space-y-4">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-base-300 pb-3">
              <div>
                <h3 class="font-bold text-sm text-base-content flex items-center gap-2">
                  <Icon icon="solar:clock-circle-bold" class="w-4 h-4 text-primary" />
                  <span>Co-op Labor &amp; Engagement Logger</span>
                </h3>
                <p class="text-xs text-base-content/70">
                  Log hours for booth restock, staging, photography, or social media drops. Recognized for Commons labor dividends.
                </p>
              </div>
              <div class="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <span class="badge badge-primary font-mono font-bold">{{ totalLaborHours }} hrs total</span>
                <button 
                  v-if="laborLogs.length > 0"
                  class="btn btn-xs btn-outline gap-1"
                  @click="exportLaborCsv"
                >
                  <Icon icon="solar:file-download-bold" class="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            <!-- Quick Add Form -->
            <form @submit.prevent="logLabor" class="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end text-xs">
              <div class="sm:col-span-3">
                <label class="label py-0.5"><span class="label-text-alt font-bold">Member / Partner</span></label>
                <input 
                  type="text" 
                  v-model="newLabor.member" 
                  placeholder="e.g. Mike (Core)" 
                  class="input input-bordered input-xs w-full"
                  required
                />
              </div>

              <div class="sm:col-span-2">
                <label class="label py-0.5"><span class="label-text-alt font-bold">Date</span></label>
                <input 
                  type="date" 
                  v-model="newLabor.date" 
                  class="input input-bordered input-xs w-full font-mono"
                  required
                />
              </div>

              <div class="sm:col-span-3">
                <label class="label py-0.5"><span class="label-text-alt font-bold">Activity</span></label>
                <select v-model="newLabor.category" class="select select-bordered select-xs w-full">
                  <option value="Booth Restock">Booth Restock &amp; Merch</option>
                  <option value="Photography &amp; Staging">Photography &amp; Staging</option>
                  <option value="Social &amp; Marketing">Social &amp; Marketing</option>
                  <option value="Tech &amp; Admin">Tech &amp; Operations</option>
                  <option value="Sourcing">Sourcing Curation</option>
                </select>
              </div>

              <div class="sm:col-span-2">
                <label class="label py-0.5"><span class="label-text-alt font-bold">Hours</span></label>
                <input 
                  type="number" 
                  v-model.number="newLabor.hours" 
                  step="0.5" 
                  min="0.5" 
                  max="12" 
                  class="input input-bordered input-xs w-full font-mono"
                  required
                />
              </div>

              <div class="sm:col-span-2">
                <button type="submit" class="btn btn-xs btn-primary w-full gap-1 font-bold">
                  <Icon icon="solar:add-circle-bold" class="w-3.5 h-3.5" />
                  <span>Log Hours</span>
                </button>
              </div>

              <div class="sm:col-span-12">
                <input 
                  type="text" 
                  v-model="newLabor.notes" 
                  placeholder="Accomplishments &amp; notes (e.g. Restocked 12 jackets, dusted shelving, posted 2 stories)" 
                  class="input input-bordered input-xs w-full"
                />
              </div>
            </form>

            <!-- Table of Logged Contributions -->
            <div v-if="laborLogs.length > 0" class="overflow-x-auto border border-base-300 rounded-xl bg-base-100 max-h-56">
              <table class="table table-xs table-pin-rows">
                <thead>
                  <tr class="bg-base-200">
                    <th>Date</th>
                    <th>Member</th>
                    <th>Category</th>
                    <th class="text-right">Hours</th>
                    <th>Notes</th>
                    <th class="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="log in laborLogs" :key="log.id" class="hover:bg-base-200/40">
                    <td class="font-mono text-[11px]">{{ log.date }}</td>
                    <td class="font-bold">{{ log.member }}</td>
                    <td>
                      <span 
                        class="badge badge-xs font-semibold"
                        :class="{
                          'badge-primary': log.category === 'Booth Restock',
                          'badge-secondary': log.category === 'Photography & Staging',
                          'badge-accent': log.category === 'Social & Marketing',
                          'badge-info': log.category === 'Tech & Admin',
                          'badge-warning': log.category === 'Sourcing'
                        }"
                      >
                        {{ log.category }}
                      </span>
                    </td>
                    <td class="text-right font-mono font-bold text-success">{{ log.hours.toFixed(1) }}h</td>
                    <td class="max-w-xs truncate opacity-80">{{ log.notes }}</td>
                    <td class="text-right">
                      <button 
                        class="btn btn-ghost btn-xs text-error p-0 h-auto min-h-0 hover:bg-transparent"
                        @click="deleteLabor(log.id)"
                        title="Delete entry"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="text-center py-4 text-xs opacity-60 italic">
              No labor hours logged yet. Use the form above to record your first contribution!
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- Bottom Call-to-Action -->
    <div class="rounded-3xl bg-base-200 p-6 sm:p-8 border border-base-300 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="space-y-1 text-center sm:text-left">
        <h3 class="text-lg font-black text-base-content">Ready to Curate Together?</h3>
        <p class="text-xs text-base-content/70">
          Equal partners. Transparent numbers. Shared prosperity.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <a href="/sales/import" class="btn btn-sm btn-outline gap-1.5 font-bold">
          <Icon icon="solar:document-medicine-bold" class="w-4 h-4 text-primary" />
          <span>Sales &amp; Settlements</span>
        </a>
        <a href="/settings" class="btn btn-sm btn-outline font-bold">
          Partner Settings
        </a>
        <a href="/scout" class="btn btn-sm btn-primary font-bold">
          Start Scouting Inventory
        </a>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { addToast } from '../../stores/toast';
import CoopGovernanceView from './CoopGovernanceView.vue';

const activeSection = ref<'payouts' | 'monthly' | 'expenses' | 'governance' | 'legal'>('payouts');
const copiedLink = ref(false);

const sections = [
  { id: 'payouts', label: '1. 70/30 Profit Engine', icon: 'solar:calculator-bold' },
  { id: 'monthly', label: '2. Monthly Settlements', icon: 'solar:calendar-date-bold' },
  { id: 'expenses', label: '3. Commons Expense Ledger', icon: 'solar:bill-list-bold' },
  { id: 'governance', label: '4. Democratic Governance', icon: 'solar:users-group-two-rounded-bold' },
  { id: 'legal', label: '5. Legal Model & Labor', icon: 'solar:diploma-verified-bold' }
] as const;

// Interactive Simulator Reactive State (Clean 70/30 Formula)
const simSalePrice = ref<number>(60);
const simCostBasis = ref<number>(10);
const simVenueFeeRate = ref<number>(15);

const simVenueFee = computed(() => {
  return Number((simSalePrice.value * (simVenueFeeRate.value / 100)).toFixed(2));
});

const simNetDeposit = computed(() => {
  return Math.max(0, Number((simSalePrice.value - simVenueFee.value).toFixed(2)));
});

const simNetSurplus = computed(() => {
  return Math.max(0, Number((simNetDeposit.value - simCostBasis.value).toFixed(2)));
});

const simCuratorProfit = computed(() => {
  return Number((simNetSurplus.value * 0.70).toFixed(2));
});

const simCommonsTake = computed(() => {
  return Number((simNetSurplus.value * 0.30).toFixed(2));
});

// Co-op Labor & Engagement Logger State
export interface LaborLogEntry {
  id: string;
  date: string;
  member: string;
  category: 'Booth Restock' | 'Photography & Staging' | 'Social & Marketing' | 'Tech & Admin' | 'Sourcing';
  hours: number;
  notes: string;
}

const defaultLaborLogs: LaborLogEntry[] = [
  { id: '1', date: new Date().toISOString().slice(0, 10), member: 'Mike (Core)', category: 'Booth Restock', hours: 2.0, notes: 'Restocked booth #0EJ, staged 15 outerwear pieces & updated pricing.' },
  { id: '2', date: new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10), member: 'PDX Partner', category: 'Photography & Staging', hours: 1.5, notes: 'Deep Scan photo enrichment on 18 tabletop games & cataloged.' },
  { id: '3', date: new Date(Date.now() - 86400000 * 4).toISOString().slice(0, 10), member: 'Mike (Core)', category: 'Social & Marketing', hours: 1.0, notes: 'Created Instagram Reel & stories showcasing new vintage glass haul.' }
];

const laborLogs = ref<LaborLogEntry[]>([]);

const newLabor = ref({
  member: 'Mike (Core)',
  date: new Date().toISOString().slice(0, 10),
  category: 'Booth Restock' as LaborLogEntry['category'],
  hours: 1.5,
  notes: ''
});

onMounted(() => {
  try {
    const params = new URLSearchParams(window.location.search);
    const sec = params.get('section') || params.get('tab');
    if (sec && (sec === 'payouts' || sec === 'monthly' || sec === 'expenses' || sec === 'governance' || sec === 'legal')) {
      activeSection.value = sec;
    }
  } catch {}

  try {
    const saved = localStorage.getItem('huck_coop_labor_logs');
    if (saved) {
      const parsed = JSON.parse(saved);
      laborLogs.value = parsed.map((l: any) => ({
        ...l,
        member: l.member === 'Tyler (Core)' ? 'Mike (Core)' : l.member
      }));
    } else {
      laborLogs.value = defaultLaborLogs;
      localStorage.setItem('huck_coop_labor_logs', JSON.stringify(defaultLaborLogs));
    }
  } catch {
    laborLogs.value = defaultLaborLogs;
  }
});

const totalLaborHours = computed(() => {
  return Number(laborLogs.value.reduce((sum, l) => sum + l.hours, 0).toFixed(1));
});

const logLabor = () => {
  if (!newLabor.value.member.trim() || newLabor.value.hours <= 0) {
    addToast({ type: 'error', message: 'Please enter member name and valid hours' });
    return;
  }
  const entry: LaborLogEntry = {
    id: 'labor-' + Date.now(),
    date: newLabor.value.date || new Date().toISOString().slice(0, 10),
    member: newLabor.value.member.trim(),
    category: newLabor.value.category,
    hours: Number(newLabor.value.hours),
    notes: newLabor.value.notes.trim() || 'General contribution'
  };
  laborLogs.value.unshift(entry);
  try {
    localStorage.setItem('huck_coop_labor_logs', JSON.stringify(laborLogs.value));
  } catch {}
  newLabor.value.notes = '';
  addToast({ type: 'success', message: `Logged ${entry.hours}h labor for ${entry.member}!` });
};

const deleteLabor = (id: string) => {
  laborLogs.value = laborLogs.value.filter(l => l.id !== id);
  try {
    localStorage.setItem('huck_coop_labor_logs', JSON.stringify(laborLogs.value));
  } catch {}
  addToast({ type: 'info', message: 'Removed labor entry' });
};

const exportLaborCsv = () => {
  if (laborLogs.value.length === 0) return;
  const header = ['Date', 'Member', 'Category', 'Hours', 'Notes'];
  const rows = laborLogs.value.map(l => [
    l.date,
    `"${l.member.replace(/"/g, '""')}"`,
    `"${l.category}"`,
    l.hours,
    `"${l.notes.replace(/"/g, '""')}"`
  ]);
  const csvContent = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Coop_Labor_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  addToast({ type: 'success', message: 'Downloaded Co-op Labor Ledger CSV!' });
};

const handlePrint = () => {
  window.print();
};

const copyShareLink = async () => {
  try {
    const url = window.location.origin + '/coop';
    await navigator.clipboard.writeText(url);
    copiedLink.value = true;
    addToast({ type: 'success', message: 'Charter link copied to clipboard!' });
    setTimeout(() => {
      copiedLink.value = false;
    }, 2500);
  } catch {
    addToast({ type: 'error', message: 'Could not copy link' });
  }
};
</script>

<style scoped>
@media print {
  .btn, .range, nav {
    display: none !important;
  }
}
</style>
