<template>
  <div class="card bg-base-200 shadow-xl border border-base-300/80 overflow-hidden transition-all">
    <div
      @click="toggle"
      class="p-3.5 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 cursor-pointer hover:bg-base-300/40 transition-colors select-none"
      :class="{ 'border-b border-base-300': !isCollapsed }"
      role="button"
      :aria-expanded="!isCollapsed"
      tabindex="0"
      @keydown.enter.space="toggle"
    >
      <div class="flex items-center gap-2.5">
        <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-warning/20 to-success/20 flex items-center justify-center text-warning shadow-sm shrink-0">
          <Icon icon="solar:magic-stick-3-bold-duotone" class="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <div>
          <div class="flex flex-wrap items-center gap-1.5">
            <h3 class="font-extrabold text-sm sm:text-lg tracking-tight text-base-content">Tax Tips &amp; Deductions</h3>
            <span class="badge badge-xs badge-success text-success-content font-bold whitespace-nowrap gap-1 shadow-sm">
              <Icon icon="solar:shield-check-bold" class="w-3 h-3" />
              IRS Schedule C
            </span>
          </div>
          <p class="text-[11px] sm:text-xs text-base-content/70 mt-0.5">Write-off reminders for the Collective and for your own Schedule C</p>
        </div>
      </div>

      <div class="flex items-center justify-between md:justify-end gap-2">
        <span class="badge badge-sm badge-success text-success-content font-bold whitespace-nowrap">{{ taxTips.length }} tips</span>
        <button
          type="button"
          @click.stop="showModal = true"
          class="btn btn-xs sm:btn-sm btn-outline btn-success font-bold gap-1 shadow-sm shrink-0"
          title="Open IRS Tax Write-Offs & Schedule C Playbook"
        >
          <Icon icon="solar:book-bookmark-bold-duotone" class="w-3.5 h-3.5" />
          <span class="text-xs whitespace-nowrap">Playbook</span>
        </button>
        <button type="button" class="btn btn-ghost btn-xs btn-circle shrink-0 hover:bg-base-300" :aria-expanded="!isCollapsed" aria-label="Toggle Tax Tips">
          <Icon icon="solar:alt-arrow-down-linear" class="w-4 h-4 transition-transform duration-200" :class="{ '-rotate-90': isCollapsed }" />
        </button>
      </div>
    </div>

    <div v-show="!isCollapsed" class="p-3 sm:p-5">
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        <a
          v-for="tip in taxTips"
          :key="tip.filter"
          :href="tip.link"
          class="flex flex-col justify-between text-sm p-3.5 sm:p-4 rounded-2xl border bg-base-100 border-success/30 hover:border-success/80 shadow-sm transition-all group hover:shadow-lg"
        >
          <div>
            <div class="flex flex-wrap items-center justify-between gap-1.5 mb-2">
              <span class="badge badge-xs badge-success text-success-content font-extrabold whitespace-nowrap gap-1 uppercase tracking-wider text-[10px]">
                <Icon icon="solar:verified-check-bold" class="w-3 h-3" />
                Tax Write-Off
              </span>
              <span v-if="tip.scheduleC" class="badge badge-xs badge-outline font-mono text-[10px] text-base-content/75 whitespace-nowrap">{{ tip.scheduleC }}</span>
            </div>
            <div class="flex items-start gap-2 font-bold mb-1 text-base-content group-hover:text-primary transition-colors text-xs sm:text-sm">
              <Icon :icon="tip.icon || 'solar:info-circle-bold-duotone'" class="w-4.5 h-4.5 shrink-0 mt-0.5" :class="tip.type === 'warning' ? 'text-warning' : 'text-success'" />
              <span class="leading-snug">{{ tip.title }}</span>
            </div>
            <p class="opacity-75 text-[11px] sm:text-xs leading-relaxed text-base-content">{{ tip.description }}</p>
          </div>
          <div class="mt-3 pt-2 border-t border-base-200 flex items-center justify-between text-xs font-bold text-primary">
            <span>{{ tip.actionText || 'Take Action' }}</span>
            <Icon icon="solar:arrow-right-linear" class="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
          </div>
        </a>
      </div>
    </div>

    <!-- IRS TAX WRITE-OFF & SCHEDULE C PLAYBOOK MODAL -->
    <div v-if="showModal" class="modal modal-open z-50">
      <div class="modal-box max-w-2xl bg-base-100 border border-success/30 shadow-2xl p-5 sm:p-7 relative max-h-[90vh] overflow-y-auto">
        <button @click="showModal = false" class="btn btn-sm btn-circle btn-ghost absolute right-4 top-4 hover:bg-base-200" title="Close Playbook">✕</button>
        <div class="flex items-center gap-3 mb-4 pb-3 border-b border-base-200">
          <div class="w-11 h-11 rounded-xl bg-success/10 flex items-center justify-center text-success shrink-0">
            <Icon icon="solar:book-bookmark-bold-duotone" class="w-6 h-6" />
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="font-extrabold text-lg sm:text-xl text-base-content">Resale Tax &amp; OpEx Playbook</h3>
              <span class="badge badge-sm badge-success text-success-content font-bold whitespace-nowrap">IRS Schedule C</span>
            </div>
            <p class="text-xs text-base-content/70">Expense &amp; tax write-off rules for resale operations</p>
          </div>
        </div>

        <div class="space-y-3.5 text-xs text-base-content">
          <div
            v-for="(rule, i) in rules"
            :key="rule.title"
            class="p-3.5 rounded-xl border"
            :class="rule.warn ? 'bg-warning/10 border-warning/30' : 'bg-base-200/60 border-base-300'"
          >
            <div class="flex flex-wrap items-center justify-between gap-1.5 font-bold text-sm mb-1.5 text-base-content">
              <span class="flex items-center gap-2">
                <Icon :icon="rule.icon" class="w-4 h-4 shrink-0" :class="rule.tone" />
                {{ i + 1 }}. {{ rule.title }}
              </span>
              <span class="badge badge-xs font-mono font-bold whitespace-nowrap" :class="rule.badge">{{ rule.line }}</span>
            </div>
            <p class="text-base-content/80 leading-relaxed">{{ rule.body }}</p>
          </div>
        </div>

        <div class="modal-action mt-5 pt-3 border-t border-base-200 flex flex-wrap items-center justify-between gap-2">
          <a href="/purchases" class="btn btn-sm btn-outline gap-1.5">
            <Icon icon="solar:cart-large-minimalistic-linear" class="w-4 h-4" />
            <span>Go to Purchases &amp; Expenses</span>
          </a>
          <button @click="showModal = false" class="btn btn-sm btn-primary text-primary-content font-bold px-5">Close Playbook</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Icon } from '@iconify/vue';
import { useDashboardSource } from '../../composables/dashboard/useDashboardSource';
import { useDashboardMetrics } from '../../composables/dashboard/useDashboardMetrics';
import { useCollapsibleSection } from '../../composables/dashboard/useCollapsibleSection';

const source = useDashboardSource();
const { taxTips } = useDashboardMetrics();
const { isCollapsed, toggle } = useCollapsibleSection('insights', true, source.mode === 'live');
const showModal = ref(false);

interface PlaybookRule {
  title: string;
  line: string;
  icon: string;
  tone: string;
  badge: string;
  body: string;
  warn?: boolean;
}

const rules: PlaybookRule[] = [
  { title: 'Sourcing Mileage & Travel', line: 'Line 24a', icon: 'solar:routing-2-bold-duotone', tone: 'text-success', badge: 'badge-success text-success-content',
    body: 'Sourcing trips to thrift stores, estate sales, flea markets, and restocking trips to partner venues qualify for the standard IRS mileage rate of $0.67 per mile. Logging 1,500 sourcing miles generates an immediate $1,005 write-off against taxable income.' },
  { title: 'Booth Rent & Mall Fees', line: 'Line 20b', icon: 'solar:shop-2-bold-duotone', tone: 'text-info', badge: 'badge-info text-info-content',
    body: 'Monthly booth rental fees and consignment commission percentages deducted by antique mall operators are 100% tax-deductible Operating Expenses under Rent for Business Property (Line 20b).' },
  { title: 'Online Marketplace Fees (eBay, Poshmark, Etsy)', line: 'Line 10', icon: 'solar:ticket-sale-bold-duotone', tone: 'text-primary', badge: 'badge-primary text-primary-content',
    body: 'Marketplace Final Value fees (10–20%), payment processing charges (2.9% + $0.30), insertion fees, and promoted listing ad spend are 100% tax-deductible commissions & fees under Schedule C Line 10.' },
  { title: 'Shipping Postage & Packaging Supplies', line: 'Line 22 & 27a', icon: 'solar:box-minimalistic-bold-duotone', tone: 'text-success', badge: 'badge-success text-success-content',
    body: 'Commercial shipping labels bought via Pirate Ship, eBay, or USPS are deductible under Line 27a (Other Expenses / Postage). Boxes, poly mailers, bubble wrap, packing tape, and thermal printer labels are 100% deductible as Supplies (Line 22) in the year purchased.' },
  { title: 'Form 1099-K Gross vs. Net Tax Trap', line: 'Line 1–2', icon: 'solar:shield-warning-bold-duotone', tone: 'text-warning', badge: 'badge-warning text-warning-content', warn: true,
    body: 'Online platforms report GROSS buyer payments (including sales tax and buyer-paid shipping) to the IRS. If you only record your bank deposit net payouts without claiming marketplace fees and shipping costs, you will pay income tax on money you never kept!' },
  { title: 'Software, POS & AI API', line: 'Line 27a', icon: 'solar:cpu-bolt-bold-duotone', tone: 'text-primary', badge: 'badge-primary text-primary-content',
    body: 'POS subscriptions, website hosting, and AI API usage for item scouting & OCR are 100% tax-deductible under Other Business Expenses (Line 27a). Track and log your monthly AI spend right from the dashboard.' },
  { title: 'Cash Purchases Without Receipts (Cohan Rule)', line: 'Cohan Rule', icon: 'solar:wallet-money-bold-duotone', tone: 'text-warning', badge: 'badge-warning text-warning-content',
    body: 'Under Cohan v. Commissioner, buying at estate sales or Craigslist with cash is tax-deductible without a register receipt by keeping a contemporaneous 5-point log: Date, Item Description, Cash Amount, Vendor/Location, and Business Purpose + photo evidence.' },
  { title: 'Booth Fixtures Safe Harbor (<$2,500)', line: 'Safe Harbor', icon: 'solar:shield-check-bold', tone: 'text-accent', badge: 'badge-accent text-accent-content',
    body: 'Under the IRS De Minimis Safe Harbor election, tangible business equipment costing up to $2,500 per invoice (such as glass display showcases, chrome garment racks, mannequins, and thermal label printers) can be expensed immediately in Year 1 rather than depreciating over 5–7 years.' },
];
</script>
