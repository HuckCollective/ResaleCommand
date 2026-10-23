<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
    
    <!-- Hero Banner -->
    <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/15 via-base-200 to-base-100 border border-primary/25 p-6 sm:p-10 shadow-xl">
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
        <div class="space-y-3 max-w-2xl">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="badge badge-primary font-bold gap-1 text-xs px-3 py-1 shadow-sm">
              <Icon icon="solar:shield-star-bold" class="w-3.5 h-3.5" />
              Worker Self-Directed Enterprise (WSDE)
            </span>
            <span class="badge badge-outline text-xs font-semibold">
              Rochdale Principles
            </span>
            <span class="badge badge-neutral text-xs font-mono font-bold">
              1 Member = 1 Vote
            </span>
          </div>

          <h1 class="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-base-content">
            The Huckleberry Collective
          </h1>
          <p class="text-sm sm:text-base text-base-content/80 leading-relaxed font-medium">
            Worker Cooperative &amp; Partner Collaboration Charter. A democratic, 100% transparent, and shared-equity retail consortium.
          </p>
        </div>

        <!-- Quick Action Buttons -->
        <div class="flex flex-wrap items-center gap-2.5 shrink-0">
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

      <!-- Quick Principles Strip -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-8 pt-6 border-t border-base-content/10">
        <div class="bg-base-100/70 backdrop-blur-xs p-3.5 rounded-2xl border border-base-content/5">
          <div class="text-xs text-base-content/60 font-semibold">Governance</div>
          <div class="text-base sm:text-lg font-black text-primary">1 Member = 1 Vote</div>
          <div class="text-[11px] text-base-content/70 mt-0.5">Democratic equality</div>
        </div>
        <div class="bg-base-100/70 backdrop-blur-xs p-3.5 rounded-2xl border border-base-content/5">
          <div class="text-xs text-base-content/60 font-semibold">Capital Protection</div>
          <div class="text-base sm:text-lg font-black text-success">100% Cost Recoup</div>
          <div class="text-[11px] text-base-content/70 mt-0.5">Paid dollar-for-dollar</div>
        </div>
        <div class="bg-base-100/70 backdrop-blur-xs p-3.5 rounded-2xl border border-base-content/5">
          <div class="text-xs text-base-content/60 font-semibold">Partner Identity</div>
          <div class="text-base sm:text-lg font-black text-secondary">Discrete Ledgers</div>
          <div class="text-[11px] text-base-content/70 mt-0.5">Dedicated SKU prefixes</div>
        </div>
        <div class="bg-base-100/70 backdrop-blur-xs p-3.5 rounded-2xl border border-base-content/5">
          <div class="text-xs text-base-content/60 font-semibold">Surplus Sharing</div>
          <div class="text-base sm:text-lg font-black text-info">Patronage Splits</div>
          <div class="text-[11px] text-base-content/70 mt-0.5">Sales + Labor hours</div>
        </div>
      </div>
    </div>

    <!-- Section Navigation Tabs -->
    <div class="flex items-center gap-2 overflow-x-auto pb-2 border-b border-base-300 scrollbar-none">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        @click="activeTab = tab.id"
        class="btn btn-sm gap-2 shrink-0 font-bold transition-all rounded-xl"
        :class="activeTab === tab.id ? 'btn-primary' : 'btn-ghost hover:bg-base-200'"
      >
        <Icon :icon="tab.icon" class="w-4 h-4" />
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <!-- TAB 1: 3-TIER WATERFALL & INTERACTIVE SIMULATOR -->
    <div v-show="activeTab === 'waterfall'" class="space-y-6">
      
      <!-- Explainer Card -->
      <div class="card bg-base-100 border border-base-300 shadow-md">
        <div class="card-body p-6 space-y-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-success/15 flex items-center justify-center text-success shrink-0">
              <Icon icon="solar:waterfall-linear" class="w-6 h-6" />
            </div>
            <div>
              <h2 class="text-xl font-black text-base-content tracking-tight">The 3-Tier Financial Waterfall</h2>
              <p class="text-xs text-base-content/70">
                How every dollar from retail registers (Memory Den, Ricochet POS, online) is partitioned.
              </p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <!-- Tier 1 -->
            <div class="bg-base-200/60 rounded-2xl p-4 border border-base-300 space-y-2">
              <div class="flex items-center justify-between">
                <span class="badge badge-sm badge-neutral font-bold">Tier 1</span>
                <span class="text-xs text-base-content/60 font-semibold">Covered First</span>
              </div>
              <h3 class="font-extrabold text-base text-base-content">Shared Commons Pool</h3>
              <ul class="text-xs text-base-content/80 space-y-1.5 list-disc list-inside">
                <li>Retail POS commission (e.g. 15% Memory Den fee)</li>
                <li>Monthly shared booth rent ($382.50 at Memory Den)</li>
                <li>Shared supplies (thermal barcode rolls, tags, tape)</li>
                <li><strong>Tech Commons</strong>: Hosting, Appwrite, and 100% repayment for fronted AI credits ($100 Google Prepay)</li>
              </ul>
            </div>

            <!-- Tier 2 -->
            <div class="bg-base-200/60 rounded-2xl p-4 border border-base-300 space-y-2">
              <div class="flex items-center justify-between">
                <span class="badge badge-sm badge-success text-success-content font-bold">Tier 2</span>
                <span class="text-xs text-success font-semibold">Dollar-for-Dollar</span>
              </div>
              <h3 class="font-extrabold text-base text-base-content">Capital Basis Recoupment</h3>
              <ul class="text-xs text-base-content/80 space-y-1.5 list-disc list-inside">
                <li><strong>100% return</strong> of member out-of-pocket inventory cost</li>
                <li>Acquisition cost returned before any profit calculation</li>
                <li>Logged member out-of-pocket store expenses</li>
                <li>Zero risk of members taking a loss on sold inventory</li>
              </ul>
            </div>

            <!-- Tier 3 -->
            <div class="bg-base-200/60 rounded-2xl p-4 border border-base-300 space-y-2">
              <div class="flex items-center justify-between">
                <span class="badge badge-sm badge-primary text-primary-content font-bold">Tier 3</span>
                <span class="text-xs text-primary font-semibold">Equitable Split</span>
              </div>
              <h3 class="font-extrabold text-base text-base-content">Surplus Patronage Dividends</h3>
              <ul class="text-xs text-base-content/80 space-y-1.5 list-disc list-inside">
                <li><strong>10% Collective Reserve</strong> (Equipment, slow month cushion)</li>
                <li><strong>50% Sales Volume Share</strong> (Goes to the item curator/purchaser)</li>
                <li><strong>40% Labor / Sweat Equity Share</strong> (Hours worked: booth stocking, tagging, <strong>social media &amp; photography</strong>, dev time)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- Interactive Waterfall Simulator -->
      <div class="card bg-base-100 border border-primary/30 shadow-xl overflow-hidden">
        <div class="p-4 sm:p-6 bg-gradient-to-r from-primary/10 via-base-200/60 to-base-100 border-b border-base-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-2.5">
            <Icon icon="solar:calculator-bold-duotone" class="w-6 h-6 text-primary" />
            <div>
              <h3 class="font-black text-base sm:text-lg text-base-content">
                Interactive Member Payout Calculator
              </h3>
              <p class="text-xs text-base-content/70">
                Adjust values to simulate real payouts on any sold item.
              </p>
            </div>
          </div>
          <span class="badge badge-sm badge-primary font-bold">Live Simulation</span>
        </div>

        <div class="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <!-- Inputs Column -->
          <div class="lg:col-span-5 space-y-4">
            <h4 class="font-bold text-xs uppercase tracking-wider text-base-content/60">Simulation Inputs</h4>

            <!-- Sale Price -->
            <div class="form-control">
              <label class="label py-1">
                <span class="label-text font-bold text-xs">Retail Sale Price (Gross)</span>
                <span class="label-text-alt font-mono font-bold text-primary">${{ simSalePrice.toFixed(2) }}</span>
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
                <span class="label-text font-bold text-xs">Member Acquisition Cost Basis (Tier 2)</span>
                <span class="label-text-alt font-mono font-bold text-success">${{ simCostBasis.toFixed(2) }}</span>
              </label>
              <input 
                type="range" 
                v-model.number="simCostBasis" 
                :max="Math.min(simSalePrice * 0.7, 100)" 
                min="0" 
                step="2.5" 
                class="range range-xs range-success" 
              />
              <span class="text-[11px] text-base-content/60 mt-1">What you originally paid at thrift/auction for this item.</span>
            </div>

            <!-- Venue Commission Rate -->
            <div class="form-control">
              <label class="label py-1">
                <span class="label-text font-bold text-xs">Venue Commission Split (Memory Den)</span>
                <span class="label-text-alt font-mono font-bold">{{ simVenueFeeRate }}%</span>
              </label>
              <div class="grid grid-cols-3 gap-2">
                <button 
                  type="button" 
                  class="btn btn-xs" 
                  :class="simVenueFeeRate === 15 ? 'btn-primary' : 'btn-ghost border border-base-300'"
                  @click="simVenueFeeRate = 15"
                >
                  15% (Memory Den)
                </button>
                <button 
                  type="button" 
                  class="btn btn-xs" 
                  :class="simVenueFeeRate === 10 ? 'btn-primary' : 'btn-ghost border border-base-300'"
                  @click="simVenueFeeRate = 10"
                >
                  10% (Pop-up/Boutique)
                </button>
                <button 
                  type="button" 
                  class="btn btn-xs" 
                  :class="simVenueFeeRate === 0 ? 'btn-primary' : 'btn-ghost border border-base-300'"
                  @click="simVenueFeeRate = 0"
                >
                  0% (Direct/Online)
                </button>
              </div>
            </div>

            <!-- Proportional Shared Commons Overhead -->
            <div class="form-control">
              <label class="label py-1">
                <span class="label-text font-bold text-xs">Shared Booth/Tech Commons Allocation</span>
                <span class="label-text-alt font-mono font-bold">${{ simCommonsFee.toFixed(2) }}</span>
              </label>
              <input 
                type="range" 
                v-model.number="simCommonsFee" 
                min="1" 
                max="10" 
                step="0.5" 
                class="range range-xs range-neutral" 
              />
              <span class="text-[11px] text-base-content/60 mt-1">Covers booth rent, barcode tags, hosting &amp; AI service pool.</span>
            </div>
          </div>

          <!-- Waterfall Output Column -->
          <div class="lg:col-span-7 bg-base-200/50 p-5 rounded-2xl border border-base-300 space-y-4">
            <h4 class="font-bold text-xs uppercase tracking-wider text-base-content/60">
              Where Every Dollar Goes (100% Auditable)
            </h4>

            <div class="space-y-2.5">
              <!-- Gross -->
              <div class="flex items-center justify-between p-2.5 rounded-xl bg-base-100 border border-base-300">
                <span class="font-bold text-sm text-base-content">Gross Customer Payment</span>
                <span class="font-black text-base text-base-content font-mono">${{ simSalePrice.toFixed(2) }}</span>
              </div>

              <!-- Tier 1 -->
              <div class="p-3 rounded-xl bg-base-100 border border-base-300 space-y-1.5 text-xs">
                <div class="flex items-center justify-between font-bold text-base-content/80">
                  <span class="flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-error"></span>
                    Tier 1: Mandatory Fees &amp; Shared Commons
                  </span>
                  <span class="font-mono text-error font-bold">-${{ (simVenueFee + simCommonsFee).toFixed(2) }}</span>
                </div>
                <div class="flex justify-between pl-3 text-base-content/60 text-[11px]">
                  <span>Venue Fee ({{ simVenueFeeRate }}%):</span>
                  <span class="font-mono">-${{ simVenueFee.toFixed(2) }}</span>
                </div>
                <div class="flex justify-between pl-3 text-base-content/60 text-[11px]">
                  <span>Shared Commons (Rent, Tags, Tech Pool):</span>
                  <span class="font-mono">-${{ simCommonsFee.toFixed(2) }}</span>
                </div>
              </div>

              <!-- Tier 2 -->
              <div class="flex items-center justify-between p-2.5 rounded-xl bg-success/10 border border-success/30 text-xs">
                <div>
                  <div class="font-bold text-success flex items-center gap-1.5">
                    <Icon icon="solar:check-circle-bold" class="w-3.5 h-3.5" />
                    Tier 2: Member Cost Basis Recoupment
                  </div>
                  <div class="text-[11px] text-base-content/70">100% returned to curator</div>
                </div>
                <span class="font-mono font-black text-success text-sm">+${{ simCostBasis.toFixed(2) }}</span>
              </div>

              <!-- Tier 3 Net Surplus -->
              <div class="p-3 rounded-xl bg-primary/10 border border-primary/25 space-y-2 text-xs">
                <div class="flex items-center justify-between font-bold text-primary">
                  <span>Tier 3: Net Operating Surplus</span>
                  <span class="font-mono font-black text-sm">${{ simNetSurplus.toFixed(2) }}</span>
                </div>

                <div class="grid grid-cols-3 gap-2 pt-1">
                  <div class="bg-base-100 p-2 rounded-lg border border-primary/20 text-center">
                    <div class="text-[10px] text-base-content/60 font-semibold">Reserve (10%)</div>
                    <div class="font-mono font-bold text-xs text-base-content mt-0.5">${{ (simNetSurplus * 0.1).toFixed(2) }}</div>
                  </div>
                  <div class="bg-base-100 p-2 rounded-lg border border-primary/20 text-center">
                    <div class="text-[10px] text-base-content/60 font-semibold">Curator Share (50%)</div>
                    <div class="font-mono font-bold text-xs text-success mt-0.5">+${{ (simNetSurplus * 0.5).toFixed(2) }}</div>
                  </div>
                  <div class="bg-base-100 p-2 rounded-lg border border-primary/20 text-center">
                    <div class="text-[10px] text-base-content/60 font-semibold">Labor Share (40%)</div>
                    <div class="font-mono font-bold text-xs text-secondary mt-0.5">${{ (simNetSurplus * 0.4).toFixed(2) }}</div>
                  </div>
                </div>
              </div>

              <!-- Grand Total Member Take-Home -->
              <div class="p-3.5 rounded-xl bg-gradient-to-r from-success/20 to-primary/20 border border-success/40 flex items-center justify-between">
                <div>
                  <div class="text-xs font-black uppercase tracking-wider text-base-content">
                    Estimated Curator Take-Home
                  </div>
                  <div class="text-[11px] text-base-content/75">
                    Basis ($<span class="font-mono">{{ simCostBasis.toFixed(2) }}</span>) + Curator Profit ($<span class="font-mono">{{ (simNetSurplus * 0.5).toFixed(2) }}</span>)
                  </div>
                </div>
                <div class="text-xl sm:text-2xl font-black text-success font-mono">
                  ${{ (simCostBasis + (simNetSurplus * 0.5)).toFixed(2) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: MONTHLY SETTLEMENTS & BOOTH RENT -->
    <div v-show="activeTab === 'monthly'" class="space-y-6">
      <div class="card bg-base-100 border border-base-300 shadow-md">
        <div class="card-body p-6 space-y-6">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary shrink-0">
              <Icon icon="solar:calendar-date-bold" class="w-6 h-6" />
            </div>
            <div>
              <h2 class="text-xl font-black text-base-content tracking-tight">
                Monthly Settlement Cadence &amp; Booth Rent Accounting
              </h2>
              <p class="text-xs text-base-content/70">
                How Memory Den's monthly check is reconciled and how the $382.50 booth rent is divided.
              </p>
            </div>
          </div>

          <!-- Explanation of Monthly Check -->
          <div class="bg-base-200/50 p-5 rounded-2xl border border-base-300 space-y-3 text-xs leading-relaxed text-base-content/80">
            <h3 class="font-bold text-sm text-base-content flex items-center gap-2">
              <Icon icon="solar:bill-check-bold" class="w-4 h-4 text-success" />
              The Monthly Payout Reality: Memory Den Withholds Rent on the Check
            </h3>
            <p>
              Memory Den (and most antique malls) pays the collective <strong>once a month</strong> by check or direct deposit. Memory Den automatically deducts their 15% register commission and the <strong>$382.50 fixed booth rent</strong> directly off the gross sales before the check is delivered.
            </p>
            <p>
              Because of this, cooperative settlements are calculated <strong>monthly</strong> upon receiving the Ricochet POS sales CSV. No member is asked to pay micro-rent per-sale.
            </p>
          </div>

          <!-- How Rent is Divided (Options A vs B) -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="p-5 rounded-2xl bg-base-200/50 border border-base-300 space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="badge badge-sm badge-primary font-bold">Standard Model</span>
                <span class="text-xs text-success font-bold">Recommended</span>
              </div>
              <h4 class="font-extrabold text-base text-base-content">Option A: Proportional to Sales</h4>
              <p class="text-xs text-base-content/70 leading-relaxed">
                Rent is absorbed by the Tier 1 Shared Commons Pool before net profit is split. If Huck Collective items generate 65% of the sales, Huck absorbs 65% of the rent ($248.60). If PDX Game Library generates 35%, they absorb 35% ($133.90).
              </p>
              <div class="p-2.5 bg-base-100 rounded-xl border border-base-300 text-[11px] text-base-content/80 font-medium">
                ★ <strong>Benefit</strong>: If a partner has a slow month or is just starting out, they are never hit with an out-of-pocket rent bill!
              </div>
            </div>

            <div class="p-5 rounded-2xl bg-base-200/50 border border-base-300 space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="badge badge-sm badge-neutral font-bold">Footprint Model</span>
                <span class="text-xs text-base-content/60 font-semibold">Fixed Shelving</span>
              </div>
              <h4 class="font-extrabold text-base text-base-content">Option B: Dedicated Shelf Space</h4>
              <p class="text-xs text-base-content/70 leading-relaxed">
                If a partner leases a specific number of shelving units (e.g. 1 unit out of 4 = 25% of the booth footprint), their fixed share ($95.63/month) is deducted directly from their item sales.
              </p>
              <div class="p-2.5 bg-base-100 rounded-xl border border-base-300 text-[11px] text-base-content/80 font-medium">
                ★ <strong>Benefit</strong>: Clean for high-volume partners who want guaranteed, permanent shelf space.
              </div>
            </div>
          </div>

          <!-- Real Monthly Statement Walkthrough Table ($2,500 Example) -->
          <div class="space-y-3 pt-2">
            <h3 class="font-extrabold text-sm text-base-content flex items-center gap-2">
              <Icon icon="solar:document-text-bold" class="w-4 h-4 text-primary" />
              Example Monthly Statement: $2,500 Gross Sales at Memory Den Booth #0EJ
            </h3>

            <div class="overflow-x-auto rounded-2xl border border-base-300 bg-base-100">
              <table class="table table-sm w-full text-xs">
                <thead class="bg-base-200/80 text-base-content/70">
                  <tr>
                    <th>Line Item / Waterfall Stage</th>
                    <th class="text-center">Total Co-op Pool</th>
                    <th class="text-center text-primary font-bold">Huck Collective (A)</th>
                    <th class="text-center text-secondary font-bold">PDX Game Library (B)</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-base-200">
                  <tr>
                    <td class="font-bold">Gross Register Sales (Ricochet POS)</td>
                    <td class="text-center font-mono font-black">$2,500.00</td>
                    <td class="text-center font-mono font-bold">$1,600.00 (64%)</td>
                    <td class="text-center font-mono font-bold">$900.00 (36%)</td>
                  </tr>
                  <tr class="bg-base-200/30">
                    <td class="text-error font-medium">Tier 1: Memory Den 15% POS Fee</td>
                    <td class="text-center font-mono text-error font-bold">-$375.00</td>
                    <td class="text-center font-mono text-error">-$240.00</td>
                    <td class="text-center font-mono text-error">-$135.00</td>
                  </tr>
                  <tr class="bg-base-200/30">
                    <td class="text-error font-medium">Tier 1: Fixed Booth Rent (Withheld by Mall)</td>
                    <td class="text-center font-mono text-error font-bold">-$382.50</td>
                    <td class="text-center font-mono text-error">-$244.80</td>
                    <td class="text-center font-mono text-error">-$137.70</td>
                  </tr>
                  <tr class="bg-base-200/30">
                    <td class="text-error font-medium">Tier 1: Shared Commons (Hosting, Labels, AI)</td>
                    <td class="text-center font-mono text-error font-bold">-$60.00</td>
                    <td class="text-center font-mono text-error">-$38.40</td>
                    <td class="text-center font-mono text-error">-$21.60</td>
                  </tr>
                  <tr class="bg-success/10 font-bold">
                    <td class="text-success">Tier 2: 100% Capital Basis Recouped</td>
                    <td class="text-center font-mono text-success font-black">-$550.00</td>
                    <td class="text-center font-mono text-success">+$350.00 (Cost Back)</td>
                    <td class="text-center font-mono text-success">+$200.00 (Cost Back)</td>
                  </tr>
                  <tr>
                    <td class="font-extrabold text-base-content">Tier 3: Net Distributable Surplus</td>
                    <td class="text-center font-mono font-black text-primary">$1,132.50</td>
                    <td class="text-center text-base-content/60" colspan="2">Split into Reserve (10%), Sales (50%), Labor (40%)</td>
                  </tr>
                  <tr>
                    <td class="pl-6 text-base-content/70">↳ 10% Collective Reserve Fund (Slow Month Cushion)</td>
                    <td class="text-center font-mono font-bold">$113.25</td>
                    <td class="text-center text-base-content/50" colspan="2">Retained in Co-op Bank Account</td>
                  </tr>
                  <tr>
                    <td class="pl-6 text-base-content/70">↳ 50% Curator Sales Dividend ($566.25)</td>
                    <td class="text-center font-mono font-bold">$566.25</td>
                    <td class="text-center font-mono font-bold text-success">+$362.40</td>
                    <td class="text-center font-mono font-bold text-secondary">+$203.85</td>
                  </tr>
                  <tr>
                    <td class="pl-6 text-base-content/70">↳ 40% Labor Pool ($453 across 20 hrs = $22.65/hr)</td>
                    <td class="text-center font-mono font-bold">$453.00</td>
                    <td class="text-center font-mono font-bold text-success">+$271.80 (12 hrs)</td>
                    <td class="text-center font-mono font-bold text-secondary">+$181.20 (8 hrs)</td>
                  </tr>
                  <tr class="bg-gradient-to-r from-success/20 to-primary/20 text-base-content font-black text-sm">
                    <td>FINAL MONTHLY PAYOUT CHECK</td>
                    <td class="text-center font-mono">$1,682.50</td>
                    <td class="text-center font-mono text-success font-black text-base">$984.20</td>
                    <td class="text-center font-mono text-secondary font-black text-base">$585.05</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Slow Month Reserve Callout -->
            <div class="p-3.5 rounded-xl bg-info/10 border border-info/20 text-xs flex items-start gap-2.5">
              <Icon icon="solar:shield-check-bold" class="w-5 h-5 text-info shrink-0 mt-0.5" />
              <div>
                <span class="font-bold text-base-content">The 10% Reserve Safety Net: </span>
                <span class="text-base-content/75">
                  Notice the <strong>$113.25</strong> retained in the Co-op Reserve. When a slow retail month happens (e.g. post-holiday lulls), this accumulated reserve covers booth rent so no individual member ever has to pay out-of-pocket!
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 3: PURCHASER REWARDS -->
    <div v-show="activeTab === 'purchaser'" class="space-y-6">
      <div class="card bg-base-100 border border-base-300 shadow-md">
        <div class="card-body p-6 space-y-6">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-success/15 flex items-center justify-center text-success shrink-0">
              <Icon icon="solar:wallet-money-bold" class="w-6 h-6" />
            </div>
            <div>
              <h2 class="text-xl font-black text-base-content tracking-tight">
                The Purchaser Reward: Why Sourcing Curators Take Home the Most Pay
              </h2>
              <p class="text-xs text-base-content/70">
                How capital risk, curation taste, and hunting effort are fully protected and compensated.
              </p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="p-5 rounded-2xl bg-base-200/50 border border-base-300 space-y-2">
              <div class="text-2xl">💵</div>
              <h3 class="font-black text-base text-base-content">1. 100% Cost Recoupment First</h3>
              <p class="text-xs text-base-content/70 leading-relaxed">
                Every dollar you spend out of pocket at thrift stores, yard sales, estate sales, or ShopGoodwill is returned to you <strong>first, dollar-for-dollar</strong> upon sale. You never take a loss on sold inventory.
              </p>
            </div>

            <div class="p-5 rounded-2xl bg-base-200/50 border border-base-300 space-y-2">
              <div class="text-2xl">🎯</div>
              <h3 class="font-black text-base text-base-content">2. 50% Curator Profit Share</h3>
              <p class="text-xs text-base-content/70 leading-relaxed">
                Half of the net profit on that specific item goes directly to the member who sourced it. Sourcing winners requires taste and effort—the curator is rewarded for bringing high-margin goods to the booth.
              </p>
            </div>

            <div class="p-5 rounded-2xl bg-base-200/50 border border-base-300 space-y-2">
              <div class="text-2xl">⏱️</div>
              <h3 class="font-black text-base text-base-content">3. Sourcing Labor Hours</h3>
              <p class="text-xs text-base-content/70 leading-relaxed">
                Driving to sales, unboxing hauls, and researching comps takes time. Sourcing hours are logged in the <strong>Labor Hours Pool</strong>, earning you an additional share of the monthly surplus.
              </p>
            </div>
          </div>

          <!-- Comparison: Personal Curation vs Co-op Bulk Buys -->
          <div class="p-5 rounded-2xl bg-base-200/60 border border-base-300 space-y-3">
            <h4 class="font-extrabold text-sm text-base-content">Two Ways Goods Enter the Collective:</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div class="p-3.5 rounded-xl bg-base-100 border border-base-300 space-y-1">
                <div class="font-bold text-primary">Member Personal Curation (Most Common)</div>
                <p class="text-base-content/70">
                  You or a partner (e.g. PDX Game Library) buy goods with personal funds. You get <strong>100% of your cost back + 50% of the net profit</strong> when sold.
                </p>
              </div>
              <div class="p-3.5 rounded-xl bg-base-100 border border-base-300 space-y-1">
                <div class="font-bold text-secondary">Co-op Shared Purchases (Bulk Auction Lots)</div>
                <p class="text-base-content/70">
                  A large lot is bought with the shared Huckleberry Collective business fund. The fund recoups its cost 100%, and the profit is split among the members who unboxed, tested, tagged, and merchandised it!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 4: TECH, HOSTING & SOCIAL MEDIA LABOR -->
    <div v-show="activeTab === 'operations'" class="space-y-6">
      <div class="card bg-base-100 border border-base-300 shadow-md">
        <div class="card-body p-6 space-y-6">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary shrink-0">
              <Icon icon="solar:server-square-bold" class="w-6 h-6" />
            </div>
            <div>
              <h2 class="text-xl font-black text-base-content tracking-tight">
                Tech Operations, Hosting, AI Billing &amp; Social Media Labor
              </h2>
              <p class="text-xs text-base-content/70">
                Transparent accounting for cloud hosting, the Google AI Studio credit balance, and marketing hours.
              </p>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- 1. AI Vision Service -->
            <div class="bg-base-200/50 p-5 rounded-2xl border border-base-300 space-y-3">
              <div class="flex items-center justify-between">
                <span class="badge badge-sm badge-primary font-bold">Google Cloud Prepay</span>
                <Icon icon="solar:cpu-bolt-bold" class="w-4 h-4 text-primary" />
              </div>
              <h3 class="font-extrabold text-base text-base-content">AI Vision Scans</h3>
              <p class="text-xs text-base-content/75 leading-relaxed">
                Gemini Flash multimodal vision scans cost ~<strong>$0.001 to $0.005</strong> per scan. The developer advanced a <strong>$100.00 prepayment balance</strong> to Google AI Studio to keep the vision pipeline active.
              </p>
              <div class="p-2.5 rounded-xl bg-base-100 border border-base-300 text-[11px] space-y-1">
                <div class="flex justify-between">
                  <span class="text-base-content/65">Accounting:</span>
                  <span class="font-bold text-success">Tier 1 Reimbursable</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-base-content/65">Recoupment:</span>
                  <span class="font-semibold">Paid 100% off sales</span>
                </div>
              </div>
            </div>

            <!-- 2. Cloud Infrastructure & Hosting -->
            <div class="bg-base-200/50 p-5 rounded-2xl border border-base-300 space-y-3">
              <div class="flex items-center justify-between">
                <span class="badge badge-sm badge-neutral font-bold">Cloud Utilities</span>
                <Icon icon="solar:cloud-storage-bold" class="w-4 h-4 text-neutral-content" />
              </div>
              <h3 class="font-extrabold text-base text-base-content">Hosting &amp; Appwrite</h3>
              <p class="text-xs text-base-content/75 leading-relaxed">
                Web application hosting, domain DNS, and the Appwrite database server form the digital commons that powers live barcode lookups and inventory sync.
              </p>
              <div class="p-2.5 rounded-xl bg-base-100 border border-base-300 text-[11px] space-y-1">
                <div class="flex justify-between">
                  <span class="text-base-content/65">Category:</span>
                  <span class="font-bold text-info">Shared Commons (Tier 1)</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-base-content/65">Visibility:</span>
                  <span class="font-semibold">All Members Auditable</span>
                </div>
              </div>
            </div>

            <!-- 3. Developer Time & Sweat Equity -->
            <div class="bg-base-200/50 p-5 rounded-2xl border border-base-300 space-y-3">
              <div class="flex items-center justify-between">
                <span class="badge badge-sm badge-secondary font-bold">WSDE Labor</span>
                <Icon icon="solar:code-circle-bold" class="w-4 h-4 text-secondary" />
              </div>
              <h3 class="font-extrabold text-base text-base-content">Developer Hours</h3>
              <p class="text-xs text-base-content/75 leading-relaxed">
                In a Worker Self-Directed Enterprise, software engineering hours are recognized alongside retail booth staging and tagging. Dev hours earn <strong>Tier 3 Labor Patronage Dividends</strong>.
              </p>
              <div class="p-2.5 rounded-xl bg-base-100 border border-base-300 text-[11px] space-y-1">
                <div class="flex justify-between">
                  <span class="text-base-content/65">Model:</span>
                  <span class="font-bold text-secondary">Sweat Equity / Patronage</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-base-content/65">Distribution:</span>
                  <span class="font-semibold">Proportional to hours</span>
                </div>
              </div>
            </div>

            <!-- 4. Social Media & Content Marketing Hours -->
            <div class="bg-base-200/50 p-5 rounded-2xl border border-base-300 space-y-3">
              <div class="flex items-center justify-between">
                <span class="badge badge-sm badge-accent text-accent-content font-bold">Marketing Labor</span>
                <Icon icon="solar:broadcast-bold" class="w-4 h-4 text-accent" />
              </div>
              <h3 class="font-extrabold text-base text-base-content">Social &amp; Dropcasts</h3>
              <p class="text-xs text-base-content/75 leading-relaxed">
                Staging photos, filming video reels, writing captions, and broadcasting drops drive foot traffic to Memory Den. Social media hours earn <strong>Tier 3 Labor Patronage Dividends</strong>.
              </p>
              <div class="p-2.5 rounded-xl bg-base-100 border border-base-300 text-[11px] space-y-1">
                <div class="flex justify-between">
                  <span class="text-base-content/65">Studio Tool:</span>
                  <a href="/social" class="font-bold text-primary underline">Dropcast Studio</a>
                </div>
                <div class="flex justify-between">
                  <span class="text-base-content/65">Compensation:</span>
                  <span class="font-semibold">Labor Equity / Dividends</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Tax & Legal Classification Note -->
          <div class="p-4 rounded-2xl bg-base-200/80 border border-base-300 flex items-start gap-3">
            <Icon icon="solar:info-circle-bold" class="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div class="text-xs space-y-1">
              <div class="font-bold text-base-content">IRS &amp; Tax Deductibility Invariant:</div>
              <p class="text-base-content/75 leading-relaxed">
                All cloud subscriptions, software tools, and the $100 Google AI Studio prepay are classified as 
                <strong>100% Current-Year Deductible Operating Expenses (OpEx)</strong> under Schedule C (Line 27a). They reduce the collective’s taxable profit immediately without waiting for inventory to sell.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 5: LEGAL STRUCTURE & CONSORTIUM -->
    <div v-show="activeTab === 'legal'" class="space-y-6">
      <div class="card bg-base-100 border border-base-300 shadow-md">
        <div class="card-body p-6 space-y-6">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-neutral/15 flex items-center justify-center text-neutral shrink-0">
              <Icon icon="solar:diploma-verified-bold" class="w-6 h-6 text-base-content" />
            </div>
            <div>
              <h2 class="text-xl font-black text-base-content tracking-tight">
                Legal Structure: The Cooperative Consortium Model
              </h2>
              <p class="text-xs text-base-content/70">
                Why members join as Contractual Cooperative Associates rather than LLC equity owners.
              </p>
            </div>
          </div>

          <!-- The Table Comparing Both -->
          <div class="overflow-x-auto rounded-2xl border border-base-300 bg-base-100">
            <table class="table table-sm w-full text-xs">
              <thead class="bg-base-200/80 text-base-content/70">
                <tr>
                  <th class="w-1/3">Factor</th>
                  <th class="text-success font-bold">✅ Cooperative Consortium (Our Standard)</th>
                  <th class="text-error font-bold">❌ Adding Everyone to the LLC Filing</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-base-200">
                <tr>
                  <td class="font-bold">Tax Filings &amp; CPA Cost</td>
                  <td class="text-success font-medium">
                    <strong>Simple.</strong> LLC files single Schedule C. Partners receive standard <strong>Form 1099-NEC</strong> if profit > $600. Partners file their own Schedule C. Zero extra accounting fees.
                  </td>
                  <td class="text-error font-medium">
                    <strong>Nightmare.</strong> Mandatory IRS Form 1065 (Partnership Return) and Schedule K-1s to every person. CPAs charge $1,000–$2,500/yr just to prepare this return.
                  </td>
                </tr>
                <tr>
                  <td class="font-bold">Partner Identity &amp; Autonomy</td>
                  <td class="text-success font-medium">
                    Partners keep their independent brand (e.g. <code>PDXGL-</code> for PDX Game Library) and own their inventory completely.
                  </td>
                  <td class="text-base-content/70">
                    Partners are legally subsumed into one corporation.
                  </td>
                </tr>
                <tr>
                  <td class="font-bold">Joining &amp; Exiting</td>
                  <td class="text-success font-medium">
                    <strong>Fluid and safe.</strong> A partner can join or exit anytime. If they leave, they pack their inventory and get their final check with zero legal paperwork.
                  </td>
                  <td class="text-error font-medium">
                    <strong>Complex.</strong> Removing a member requires formal buyout agreements, corporate valuation, and state filing amendments.
                  </td>
                </tr>
                <tr>
                  <td class="font-bold">Democratic Equality</td>
                  <td class="text-success font-medium">
                    <strong>1 Member = 1 Vote</strong> guaranteed contractually by this Charter.
                  </td>
                  <td class="text-base-content/70">
                    Governed by statutory corporate stock ownership.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- The 1-Year Candidacy Path -->
          <div class="p-4 rounded-2xl bg-base-200/80 border border-base-300 space-y-2 text-xs">
            <div class="font-bold text-base-content">The 1-Year Candidacy Rule for Equity Ownership:</div>
            <p class="text-base-content/75 leading-relaxed">
              If a dedicated member works actively for 12 consecutive months and wishes to become a formal permanent co-owner of the LLC entity, the active collective can vote by unanimous consent to formally amend the Oregon Articles of Organization and grant legal equity membership.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 6: MULTI-ORG AUTONOMY & BARCODES -->
    <div v-show="activeTab === 'multiorg'" class="space-y-6">
      <div class="card bg-base-100 border border-base-300 shadow-md">
        <div class="card-body p-6 space-y-6">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-secondary/15 flex items-center justify-center text-secondary shrink-0">
              <Icon icon="solar:scanner-bold" class="w-6 h-6" />
            </div>
            <div>
              <h2 class="text-xl font-black text-base-content tracking-tight">
                Multi-Org Prefix Attribution &amp; Autonomous Ledgers
              </h2>
              <p class="text-xs text-base-content/70">
                How independent partner collectives sell together in the same physical booth without mixing accounts.
              </p>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Huck Collective -->
            <div class="p-4 rounded-2xl bg-base-200/60 border border-base-300 space-y-2">
              <div class="flex items-center justify-between">
                <span class="badge badge-primary font-mono font-black text-xs">HUCK-</span>
                <span class="text-xs text-base-content/60 font-semibold">Primary Collective</span>
              </div>
              <div class="font-bold text-base text-base-content">Huckleberry Collective</div>
              <p class="text-xs text-base-content/70">
                Curated vintage apparel, leatherwear, speculative fiction paperbacks, and oddities.
              </p>
              <div class="text-[11px] font-mono bg-base-100 p-2 rounded-lg border border-base-300 text-base-content/80">
                Sample Barcode: <strong class="text-primary">HUCK-04921</strong>
              </div>
            </div>

            <!-- PDX Game Library -->
            <div class="p-4 rounded-2xl bg-base-200/60 border border-base-300 space-y-2">
              <div class="flex items-center justify-between">
                <span class="badge badge-secondary font-mono font-black text-xs">PDXGL-</span>
                <span class="text-xs text-base-content/60 font-semibold">Partner Curator</span>
              </div>
              <div class="font-bold text-base text-base-content">PDX Game Library</div>
              <p class="text-xs text-base-content/70">
                Curated tabletop board games, roleplaying sourcebooks (TSR, D&amp;D, Cyberpunk), and gaming accessories.
              </p>
              <div class="text-[11px] font-mono bg-base-100 p-2 rounded-lg border border-base-300 text-base-content/80">
                Sample Barcode: <strong class="text-secondary">PDXGL-01084</strong>
              </div>
            </div>
          </div>

          <!-- Walkthrough of POS Scanning -->
          <div class="space-y-3 pt-2">
            <h3 class="font-extrabold text-sm text-base-content">How the Shared Register Works:</h3>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div class="p-3 bg-base-200 rounded-xl border border-base-300 space-y-1">
                <div class="font-bold text-primary">1. Thermal Tagging</div>
                <p class="text-base-content/75">Each item receives a dual tag: Venue SKU for the register + your Co-op Prefix.</p>
              </div>
              <div class="p-3 bg-base-200 rounded-xl border border-base-300 space-y-1">
                <div class="font-bold text-primary">2. Staged on Floor</div>
                <p class="text-base-content/75">Goods are merchandised in prime shared booth space at Memory Den.</p>
              </div>
              <div class="p-3 bg-base-200 rounded-xl border border-base-300 space-y-1">
                <div class="font-bold text-primary">3. Automated POS Sync</div>
                <p class="text-base-content/75">Ricochet POS reports are parsed. Sales bucket automatically by barcode prefix.</p>
              </div>
              <div class="p-3 bg-base-200 rounded-xl border border-base-300 space-y-1">
                <div class="font-bold text-primary">4. Transparent Payout</div>
                <p class="text-base-content/75">Itemized statement generated with zero cross-contamination between partners.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 7: DEMOCRATIC GOVERNANCE & CONSENT (LOOMIO PROTOCOL) -->
    <div v-show="activeTab === 'governance'" class="space-y-6">
      <div class="card bg-base-100 border border-base-300 shadow-md">
        <div class="card-body p-6 space-y-6">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-info/15 flex items-center justify-center text-info shrink-0">
              <Icon icon="solar:users-group-two-rounded-bold" class="w-6 h-6" />
            </div>
            <div>
              <h2 class="text-xl font-black text-base-content tracking-tight">
                Democratic Governance: The 4-Signal Consent Protocol
              </h2>
              <p class="text-xs text-base-content/70">
                How collective decisions are made (Loomio / Sociocracy Standard).
              </p>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- Agree -->
            <div class="p-4 rounded-2xl bg-success/10 border border-success/30 space-y-2">
              <div class="text-2xl">🟢</div>
              <h3 class="font-black text-base text-success">Agree</h3>
              <p class="text-xs text-base-content/80 font-medium">"I support this proposal."</p>
              <div class="text-[11px] text-base-content/65">Counted toward positive consensus.</div>
            </div>

            <!-- Abstain -->
            <div class="p-4 rounded-2xl bg-warning/10 border border-warning/30 space-y-2">
              <div class="text-2xl">🟡</div>
              <h3 class="font-black text-base text-warning">Abstain</h3>
              <p class="text-xs text-base-content/80 font-medium">"I trust the collective to proceed without my input."</p>
              <div class="text-[11px] text-base-content/65">Neutral; does not block the group.</div>
            </div>

            <!-- Disagree -->
            <div class="p-4 rounded-2xl bg-secondary/10 border border-secondary/30 space-y-2">
              <div class="text-2xl">🟠</div>
              <h3 class="font-black text-base text-secondary">Disagree</h3>
              <p class="text-xs text-base-content/80 font-medium">"I have reservations, but I won't block the decision."</p>
              <div class="text-[11px] text-base-content/65">Logged for discussion; does not veto.</div>
            </div>

            <!-- Block -->
            <div class="p-4 rounded-2xl bg-error/10 border border-error/30 space-y-2">
              <div class="text-2xl">🔴</div>
              <h3 class="font-black text-base text-error">Block</h3>
              <p class="text-xs text-base-content/80 font-medium">"This violates our charter or endangers the collective."</p>
              <div class="text-[11px] text-base-content/65">Triggers mandatory group deliberation.</div>
            </div>
          </div>

          <!-- What We Vote On -->
          <div class="p-4 rounded-2xl bg-base-200/80 border border-base-300 space-y-2 text-xs">
            <div class="font-bold text-base-content">Decisions Governed by Democratic Vote:</div>
            <ul class="grid grid-cols-1 sm:grid-cols-2 gap-2 list-disc list-inside text-base-content/80">
              <li>Expanding to new retail booths or antique malls</li>
              <li>Purchasing major shared capital equipment (printers, showcases)</li>
              <li>Welcoming new partner organizations or curator collectives</li>
              <li>Adjusting seasonal shared overhead splits or reserve rates</li>
            </ul>
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
      <div class="flex items-center gap-3">
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
import { ref, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { addToast } from '../../stores/toast';

const activeTab = ref<'waterfall' | 'monthly' | 'purchaser' | 'operations' | 'legal' | 'multiorg' | 'governance'>('waterfall');
const copiedLink = ref(false);

const tabs = [
  { id: 'waterfall', label: '3-Tier Waterfall & Simulator', icon: 'solar:waterfall-linear' },
  { id: 'monthly', label: 'Monthly Settlement & Booth Rent', icon: 'solar:calendar-date-bold' },
  { id: 'purchaser', label: 'Purchaser Curation Rewards', icon: 'solar:wallet-money-bold' },
  { id: 'operations', label: 'Tech, AI & Social Media Labor', icon: 'solar:server-square-bold' },
  { id: 'legal', label: 'Legal Structure & Membership', icon: 'solar:diploma-verified-bold' },
  { id: 'multiorg', label: 'Partner Autonomy & Prefixes', icon: 'solar:scanner-bold' },
  { id: 'governance', label: 'Democratic Voting & Consent', icon: 'solar:users-group-two-rounded-bold' }
] as const;

// Interactive Simulator Reactive State
const simSalePrice = ref<number>(65);
const simCostBasis = ref<number>(12);
const simVenueFeeRate = ref<number>(15);
const simCommonsFee = ref<number>(3.50);

const simVenueFee = computed(() => {
  return Number((simSalePrice.value * (simVenueFeeRate.value / 100)).toFixed(2));
});

const simNetSurplus = computed(() => {
  const deductions = simVenueFee.value + simCommonsFee.value + simCostBasis.value;
  return Math.max(0, Number((simSalePrice.value - deductions).toFixed(2)));
});

const handlePrint = () => {
  window.print();
};

const copyShareLink = async () => {
  try {
    const url = window.location.origin + '/coop';
    await navigator.clipboard.writeText(url);
    copiedLink.value = true;
    addToast('Charter link copied to clipboard!', 'success');
    setTimeout(() => {
      copiedLink.value = false;
    }, 2500);
  } catch {
    addToast('Could not copy link', 'error');
  }
};
</script>

<style scoped>
@media print {
  /* Clean print layout */
  .btn, .range, nav {
    display: none !important;
  }
}
</style>
