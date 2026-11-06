<template>
  <div class="space-y-6 pb-36 sm:pb-44">
    <!-- Canonical Ledger Archetype Header (Matches SalesList & PurchasesList) -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h1 class="text-3xl sm:text-4xl font-black text-base-content tracking-tight flex items-center gap-3">
          <Icon icon="solar:bill-list-bold-duotone" class="w-8 h-8 sm:w-9 sm:h-9 text-primary shrink-0" />
          <span>Commons &amp; Tax Expense Ledger</span>
        </h1>
        <p class="text-sm text-base-content/70 mt-1">
          Reimburse shared Gate 4A operational receipts from the 30% Commons Pool and separate personal IRS Schedule C write-offs.
        </p>
      </div>

      <div class="flex items-center gap-2 flex-wrap w-full md:w-auto">
        <a
          href="/purchases/speed-entry?mode=all_expense"
          class="btn btn-sm sm:btn-md btn-secondary gap-1.5 shadow-md shadow-secondary/20 font-bold flex-1 sm:flex-initial min-h-[40px]"
          title="Scan itemized multi-line paper receipt or screenshot into business expenses via OCR"
        >
          <Icon icon="solar:scanner-bold-duotone" class="w-4 h-4 shrink-0" />
          <span>Scan Receipt</span>
        </a>
        <button
          type="button"
          @click="openImportModal"
          class="btn btn-sm sm:btn-md btn-outline btn-primary gap-1.5 shadow-xs font-bold flex-1 sm:flex-initial min-h-[40px]"
          title="Upload multiple invoice PDFs at once (Appwrite, Google, Vercel, etc.)"
        >
          <Icon icon="solar:upload-track-bold-duotone" class="w-4 h-4 shrink-0" />
          <span>Upload PDFs</span>
        </button>
        <button
          type="button"
          @click="openSubmitModal"
          class="btn btn-sm sm:btn-md btn-primary gap-1.5 shadow-lg shadow-primary/20 font-bold flex-1 sm:flex-initial min-h-[40px]"
          title="Manually log a single expense or receipt"
        >
          <Icon icon="solar:add-circle-bold" class="w-4 h-4 shrink-0" />
          <span>Log Expense</span>
        </button>
      </div>
    </div>

    <!-- Canonical 4-Card Icon-Badge KPI Strip (Matches SalesList.vue) -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <!-- 1. Co-op Shared Commons Pool -->
      <div class="bg-base-100 p-3.5 sm:p-5 rounded-2xl border border-base-200 shadow-sm">
        <div class="flex items-center gap-2.5 sm:gap-3">
          <div class="p-2.5 sm:p-3 bg-primary/10 text-primary rounded-xl shrink-0">
            <Icon icon="solar:buildings-2-bold" class="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-[11px] uppercase font-bold opacity-60 truncate">Co-op Shared Pool</div>
            <div class="text-lg sm:text-2xl font-black font-mono text-primary truncate">${{ metrics.totalCoopShared.toFixed(2) }}</div>
            <div class="text-[10px] font-semibold opacity-50 truncate">{{ countByScope.coop + countByScope.split }} Gate 4A receipts · {{ activeMonthLabel }}</div>
          </div>
        </div>
      </div>

      <!-- 2. Personal Schedule C Tax Write-Offs -->
      <div class="bg-base-100 p-3.5 sm:p-5 rounded-2xl border border-base-200 shadow-sm">
        <div class="flex items-center gap-2.5 sm:gap-3">
          <div class="p-2.5 sm:p-3 bg-secondary/10 text-secondary rounded-xl shrink-0">
            <Icon icon="solar:user-check-rounded-bold" class="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-[11px] uppercase font-bold opacity-60 truncate">Personal Write-Offs</div>
            <div class="text-lg sm:text-2xl font-black font-mono text-secondary truncate">${{ metrics.totalPersonalWriteOff.toFixed(2) }}</div>
            <div class="text-[10px] font-semibold opacity-50 truncate">Schedule C ($0 to Co-op) · {{ activeMonthLabel }}</div>
          </div>
        </div>
      </div>

      <!-- 3. Reimbursed from Commons -->
      <div class="bg-base-100 p-3.5 sm:p-5 rounded-2xl border border-base-200 shadow-sm">
        <div class="flex items-center gap-2.5 sm:gap-3">
          <div class="p-2.5 sm:p-3 bg-success/10 text-success rounded-xl shrink-0">
            <Icon icon="solar:check-circle-bold" class="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-[11px] uppercase font-bold opacity-60 truncate">Reimbursed</div>
            <div class="text-lg sm:text-2xl font-black font-mono text-success truncate">${{ metrics.totalReimbursed.toFixed(2) }}</div>
            <div class="text-[10px] font-semibold opacity-50 truncate">Paid from 30% Commons · {{ activeMonthLabel }}</div>
          </div>
        </div>
      </div>

      <!-- 4. Pending Co-op Reimbursement -->
      <div class="bg-base-100 p-3.5 sm:p-5 rounded-2xl border border-base-200 shadow-sm">
        <div class="flex items-center gap-2.5 sm:gap-3">
          <div class="p-2.5 sm:p-3 bg-warning/10 text-warning rounded-xl shrink-0">
            <Icon icon="solar:clock-circle-bold" class="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-[11px] uppercase font-bold opacity-60 truncate">Pending Payout</div>
            <div class="text-lg sm:text-2xl font-black font-mono text-warning truncate">${{ metrics.totalPending.toFixed(2) }}</div>
            <div class="text-[10px] font-semibold opacity-50 truncate">Owed to fronting members · {{ activeMonthLabel }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- SEARCH & CONTROLS TOOLBAR (CANONICAL 2-ROW PIPELINE PATTERN — MATCHES PURCHASESLIST & INVENTORYHEADER) -->
    <div class="card bg-base-100/90 shadow-sm border border-base-200/80 rounded-2xl p-2.5 sm:p-3">
      <!-- Row 1: Constrained Omnibox Search + Month Filter + Record Count + CSV Export Buttons -->
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
          <!-- Constrained Omnibox Search Input -->
          <div class="relative w-full sm:max-w-md md:max-w-lg flex-1">
            <Icon icon="solar:magnifer-linear" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40 pointer-events-none" />
            <input
              type="text"
              v-model="searchQuery"
              placeholder="Search description, member, partner, category..."
              class="input input-bordered w-full pl-10 pr-9 text-xs sm:text-sm h-10 min-h-10 rounded-xl bg-base-100 border-base-300 focus:border-primary transition-all shadow-inner"
            />
            <button
              v-if="searchQuery"
              type="button"
              @click="searchQuery = ''"
              class="btn btn-ghost btn-circle btn-xs absolute right-2 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 w-6 h-6 min-h-6"
              title="Clear search"
            >
              ✕
            </button>
          </div>

          <!-- Month Filter Dropdown (100% Opaque bg-base-100) -->
          <div class="relative shrink-0">
            <select
              v-model="monthFilter"
              class="select select-bordered text-xs font-bold h-10 min-h-10 rounded-xl bg-base-100 text-base-content border-base-300 focus:border-primary w-full sm:w-auto pr-8 shadow-2xs"
              title="Filter expenses and KPI cards by month"
            >
              <option value="all">All-Time ({{ expenses.length }})</option>
              <option v-for="m in monthOptions" :key="m.key" :value="m.key">{{ m.label }} ({{ m.count }})</option>
            </select>
          </div>
        </div>

        <!-- Right Side: Count & CSV Export Buttons -->
        <div class="flex items-center gap-2 justify-between sm:justify-end text-xs shrink-0 flex-wrap">
          <span class="badge badge-sm badge-ghost font-mono opacity-70">
            {{ filteredExpenses.length }} expense{{ filteredExpenses.length === 1 ? '' : 's' }}
          </span>
          <button
            type="button"
            @click="exportCsvByScope('coop_shared')"
            class="btn btn-xs sm:btn-sm btn-outline btn-primary gap-1.5 font-bold rounded-xl h-9 min-h-9 px-3 active:scale-95 transition-all shadow-2xs"
            title="Export Co-op Shared Commons CSV"
          >
            <Icon icon="solar:file-download-linear" class="w-3.5 h-3.5" />
            <span>Co-op CSV</span>
          </button>
          <button
            type="button"
            @click="exportCsvByScope('personal_write_off')"
            class="btn btn-xs sm:btn-sm btn-outline btn-secondary gap-1.5 font-bold rounded-xl h-9 min-h-9 px-3 active:scale-95 transition-all shadow-2xs"
            title="Export Personal Schedule C Write-Off CSV"
          >
            <Icon icon="solar:user-check-rounded-bold" class="w-3.5 h-3.5" />
            <span>Schedule C CSV</span>
          </button>
        </div>
      </div>

      <!-- Row 2: Horizontal Scope & Status Pipeline Pills (Matches PurchasesList & InventoryHeader) -->
      <div class="flex items-center justify-between gap-2 flex-wrap pt-2.5 mt-1 border-t border-base-200/60 text-xs">
        <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
          <!-- Scope Pills -->
          <button
            type="button"
            class="btn btn-xs rounded-lg font-bold gap-1.5 transition-all shrink-0"
            :class="scopeFilter === 'all' ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost bg-base-200/60 text-base-content/80 hover:bg-base-200'"
            @click="scopeFilter = 'all'"
          >
            <span>All Scopes</span>
            <span class="badge badge-xs font-mono font-bold" :class="scopeFilter === 'all' ? 'badge-neutral' : 'badge-ghost'">{{ monthScopedExpenses.length }}</span>
          </button>

          <button
            type="button"
            class="btn btn-xs rounded-lg font-bold gap-1.5 transition-all shrink-0"
            :class="scopeFilter === 'coop_shared' ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost bg-base-200/60 text-base-content/80 hover:bg-base-200'"
            @click="scopeFilter = 'coop_shared'"
          >
            <span>🤝 Co-op Shared</span>
            <span class="badge badge-xs font-mono font-bold" :class="scopeFilter === 'coop_shared' ? 'badge-neutral' : 'badge-ghost'">{{ countByScope.coop }}</span>
          </button>

          <button
            type="button"
            class="btn btn-xs rounded-lg font-bold gap-1.5 transition-all shrink-0"
            :class="scopeFilter === 'personal_write_off' ? 'btn-secondary text-secondary-content shadow-xs' : 'btn-ghost bg-base-200/60 text-base-content/80 hover:bg-base-200'"
            @click="scopeFilter = 'personal_write_off'"
          >
            <span>👤 Personal Write-Offs</span>
            <span class="badge badge-xs font-mono font-bold" :class="scopeFilter === 'personal_write_off' ? 'badge-neutral' : 'badge-ghost'">{{ countByScope.personal }}</span>
          </button>

          <button
            type="button"
            class="btn btn-xs rounded-lg font-bold gap-1.5 transition-all shrink-0"
            :class="scopeFilter === 'split' ? 'btn-accent text-accent-content shadow-xs' : 'btn-ghost bg-base-200/60 text-base-content/80 hover:bg-base-200'"
            @click="scopeFilter = 'split'"
          >
            <span>⚖️ Split</span>
            <span class="badge badge-xs font-mono font-bold" :class="scopeFilter === 'split' ? 'badge-neutral' : 'badge-ghost'">{{ countByScope.split }}</span>
          </button>

          <div class="h-3.5 w-px bg-base-content/20 shrink-0 mx-1"></div>

          <!-- Status Pipeline Pills -->
          <button
            type="button"
            class="btn btn-xs rounded-lg font-bold gap-1.5 transition-all shrink-0"
            :class="statusFilter === 'all' ? 'btn-neutral text-neutral-content shadow-xs' : 'btn-ghost bg-base-200/60 text-base-content/80 hover:bg-base-200'"
            @click="statusFilter = 'all'"
          >
            <span>All Status</span>
          </button>

          <button
            type="button"
            class="btn btn-xs rounded-lg font-bold gap-1.5 transition-all shrink-0"
            :class="statusFilter === 'pending' ? 'btn-warning text-warning-content shadow-xs' : 'btn-ghost bg-base-200/60 text-base-content/80 hover:bg-base-200'"
            @click="statusFilter = 'pending'"
          >
            <span>🟡 Pending</span>
            <span class="badge badge-xs font-mono font-bold" :class="statusFilter === 'pending' ? 'badge-neutral' : 'badge-ghost'">{{ countByStatus.pending }}</span>
          </button>

          <button
            type="button"
            class="btn btn-xs rounded-lg font-bold gap-1.5 transition-all shrink-0"
            :class="statusFilter === 'approved' ? 'btn-success text-success-content shadow-xs' : 'btn-ghost bg-base-200/60 text-base-content/80 hover:bg-base-200'"
            @click="statusFilter = 'approved'"
          >
            <span>🟢 Approved</span>
            <span class="badge badge-xs font-mono font-bold" :class="statusFilter === 'approved' ? 'badge-neutral' : 'badge-ghost'">{{ countByStatus.approved }}</span>
          </button>

          <button
            type="button"
            class="btn btn-xs rounded-lg font-bold gap-1.5 transition-all shrink-0"
            :class="statusFilter === 'reimbursed' ? 'btn-info text-info-content shadow-xs' : 'btn-ghost bg-base-200/60 text-base-content/80 hover:bg-base-200'"
            @click="statusFilter = 'reimbursed'"
          >
            <span>💎 Reimbursed</span>
            <span class="badge badge-xs font-mono font-bold" :class="statusFilter === 'reimbursed' ? 'badge-neutral' : 'badge-ghost'">{{ countByStatus.reimbursed }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading && expenses.length === 0" class="flex flex-col items-center justify-center py-16 gap-3">
      <span class="loading loading-spinner loading-lg text-primary"></span>
      <span class="text-xs font-bold opacity-60">Loading Shared Commons &amp; Tax Ledger...</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredExpenses.length === 0" class="card bg-base-100 shadow-xl border border-base-200">
      <div class="card-body text-center py-16 space-y-3">
        <div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
          <Icon icon="solar:bill-cross-linear" class="w-6 h-6" />
        </div>
        <h3 class="font-bold text-lg text-base-content">No Expenses Matching Filter</h3>
        <p class="text-xs text-base-content/60 max-w-sm mx-auto">
          {{ searchQuery || scopeFilter !== 'all' || statusFilter !== 'all' || monthFilter !== 'all' ? 'Try clearing your active search or scope filters.' : 'Submit your first receipt or out-of-pocket operational cost.' }}
        </p>
        <div class="pt-2 flex justify-center gap-2">
          <button
            v-if="searchQuery || scopeFilter !== 'all' || statusFilter !== 'all' || monthFilter !== 'all'"
            type="button"
            @click="resetAllFilters"
            class="btn btn-sm btn-outline rounded-xl font-bold"
          >
            Reset Filters
          </button>
          <button type="button" @click="openSubmitModal" class="btn btn-sm btn-primary rounded-xl font-bold">
            + Log Expense
          </button>
        </div>
      </div>
    </div>

    <!-- 1. MOBILE CARD VIEW (VISIBLE ON < MD) -->
    <div v-else class="block md:hidden space-y-3 mb-6">
      <div
        v-for="expense in paginatedExpenses"
        :key="expense.id"
        class="card bg-base-100 shadow-md border rounded-2xl p-3.5 space-y-3 transition-all"
        :class="selectedIds.includes(expense.id) ? 'border-primary ring-1 ring-primary/30 bg-primary/5' : 'border-base-200/80'"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-start gap-2.5 min-w-0">
            <input
              type="checkbox"
              :checked="selectedIds.includes(expense.id)"
              @change="toggleSelectRow(expense.id)"
              class="checkbox checkbox-xs checkbox-primary rounded mt-1 shrink-0"
            />
            <div class="space-y-1 min-w-0">
              <button
                type="button"
                @click="openEditModal(expense)"
                class="font-bold text-sm text-left text-base-content hover:text-primary transition-colors line-clamp-2"
              >
                {{ expense.description }}
              </button>
              <div class="flex items-center gap-1.5 flex-wrap text-[11px] opacity-75">
                <span class="font-mono">{{ formatDate(expense.date) }}</span>
                <span>•</span>
                <span class="font-bold">{{ expense.member }}</span>
                <span class="badge badge-xs badge-outline font-mono">{{ expense.partner }}</span>
              </div>
            </div>
          </div>
          <div class="text-right shrink-0 space-y-1">
            <div class="font-mono font-black text-lg text-base-content">${{ expense.amount.toFixed(2) }}</div>
            <span class="badge badge-xs font-bold uppercase tracking-wider" :class="getStatusBadgeClass(expense.status)">
              {{ expense.status }}
            </span>
          </div>
        </div>

        <div class="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-base-200/60">
          <span class="badge badge-xs font-semibold gap-1 py-2 whitespace-nowrap" :class="getCategoryBadgeClass(expense.category)">
            <Icon :icon="getCategoryIcon(expense.category)" class="w-3 h-3" />
            <span>{{ condenseCategory(expense.category) }}</span>
          </span>

          <button
            type="button"
            @click="openEditModal(expense)"
            class="badge badge-sm font-bold gap-1 py-2.5 px-2.5 cursor-pointer hover:brightness-95 transition-all whitespace-nowrap"
            :class="getScopeBadgeClass(expense.scope)"
            title="Click to edit scope or split percentage"
          >
            <span>{{ getScopeBadgeLabel(expense) }}</span>
            <Icon icon="solar:pen-bold" class="w-2.5 h-2.5 opacity-70" />
          </button>
        </div>

        <div class="flex items-center justify-between gap-2 pt-1">
          <div>
            <button
              v-if="expense.receiptUrl"
              type="button"
              @click="previewReceipt(expense)"
              class="btn btn-xs btn-outline btn-primary rounded-lg gap-1 font-bold"
            >
              <Icon icon="solar:paperclip-bold" class="w-3.5 h-3.5" />
              <span>View Receipt</span>
            </button>
            <label
              v-else
              class="btn btn-xs btn-ghost rounded-lg gap-1 font-bold cursor-pointer opacity-75"
            >
              <Icon icon="solar:upload-minimalistic-bold" class="w-3.5 h-3.5" />
              <span>Attach PDF</span>
              <input type="file" accept=".pdf,image/*" @change="uploadReceiptForExpense(expense, $event)" class="hidden" />
            </label>
          </div>

          <div class="flex items-center gap-1.5">
            <button
              type="button"
              @click="openEditModal(expense)"
              class="btn btn-xs btn-outline btn-primary font-bold rounded-lg gap-1"
            >
              <Icon icon="solar:pen-bold" class="w-3 h-3" />
              <span>Edit</span>
            </button>
            <button
              v-if="expense.status === 'pending'"
              type="button"
              @click="updateStatus(expense, 'approved')"
              class="btn btn-xs btn-success font-bold rounded-lg"
            >
              Approve
            </button>
            <button
              v-if="expense.status === 'approved'"
              type="button"
              @click="updateStatus(expense, 'reimbursed')"
              class="btn btn-xs btn-primary font-bold rounded-lg"
            >
              Reimburse
            </button>
            <button
              type="button"
              @click="confirmDelete(expense)"
              class="btn btn-xs btn-ghost btn-square text-error rounded-lg"
              title="Delete expense"
            >
              <Icon icon="solar:trash-bin-trash-bold" class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 2. DESKTOP TABLE VIEW (CANONICAL MASTER TABLE PATTERN — MATCHES INVENTORYTABLEVIEW & PURCHASESLIST) -->
    <div v-if="filteredExpenses.length > 0" class="hidden md:block card bg-base-100 border border-base-200 shadow-sm overflow-hidden rounded-xl w-full max-w-full min-w-0 mb-6">
      <div class="overflow-x-auto w-full max-w-full min-w-0 overscroll-x-contain touch-pan-x">
        <table class="table table-sm table-pin-rows table-zebra w-full text-xs">
          <thead>
            <tr class="bg-base-200/90 text-base-content font-bold border-b border-base-300 select-none">
              <th class="w-10 text-center">
                <input
                  type="checkbox"
                  :checked="isAllPageSelected"
                  @change="toggleSelectAllPage"
                  class="checkbox checkbox-xs checkbox-primary"
                  title="Select all rows on this page for bulk actions"
                />
              </th>
              <th class="w-28 cursor-pointer hover:text-primary transition-colors whitespace-nowrap" @click="toggleSort('date')">
                <div class="flex items-center gap-1">
                  <span>Date</span>
                  <span v-if="sortBy === 'date'" class="text-xs font-black text-primary">{{ sortDesc ? '▼' : '▲' }}</span>
                  <span v-else class="text-xs opacity-20">▼</span>
                </div>
              </th>
              <th class="min-w-56 cursor-pointer hover:text-primary transition-colors" @click="toggleSort('description')">
                <div class="flex items-center gap-1">
                  <span>Description &amp; Category</span>
                  <span v-if="sortBy === 'description'" class="text-xs font-black text-primary">{{ sortDesc ? '▼' : '▲' }}</span>
                  <span v-else class="text-xs opacity-20">▼</span>
                </div>
              </th>
              <th class="w-36 cursor-pointer hover:text-primary transition-colors whitespace-nowrap" @click="toggleSort('scope')">
                <div class="flex items-center gap-1">
                  <span>Tax / Pool Scope</span>
                  <span v-if="sortBy === 'scope'" class="text-xs font-black text-primary">{{ sortDesc ? '▼' : '▲' }}</span>
                  <span v-else class="text-xs opacity-20">▼</span>
                </div>
              </th>
              <th class="w-24 text-right cursor-pointer hover:text-primary transition-colors whitespace-nowrap" @click="toggleSort('amount')">
                <div class="flex items-center justify-end gap-1">
                  <span>Amount</span>
                  <span v-if="sortBy === 'amount'" class="text-xs font-black text-primary">{{ sortDesc ? '▼' : '▲' }}</span>
                  <span v-else class="text-xs opacity-20">▼</span>
                </div>
              </th>
              <th class="w-28 text-center cursor-pointer hover:text-primary transition-colors whitespace-nowrap" @click="toggleSort('status')">
                <div class="flex items-center justify-center gap-1">
                  <span>Status</span>
                  <span v-if="sortBy === 'status'" class="text-xs font-black text-primary">{{ sortDesc ? '▼' : '▲' }}</span>
                  <span v-else class="text-xs opacity-20">▼</span>
                </div>
              </th>
              <th class="w-20 text-center whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="expense in paginatedExpenses"
              :key="expense.id"
              class="hover:bg-primary/5 transition-colors cursor-pointer group"
              :class="{ 'bg-primary/10 font-medium': selectedIds.includes(expense.id) }"
              @click="openEditModal(expense)"
            >
              <!-- Row Checkbox -->
              <td class="text-center" @click.stop>
                <input
                  type="checkbox"
                  :checked="selectedIds.includes(expense.id)"
                  @change="toggleSelectRow(expense.id)"
                  class="checkbox checkbox-xs checkbox-primary align-middle"
                />
              </td>

              <!-- Date -->
              <td class="font-mono text-xs whitespace-nowrap">
                <span class="font-bold text-base-content/90">{{ formatDate(expense.date) }}</span>
              </td>

              <!-- Description + Condensed Category Badge -->
              <td class="min-w-56 max-w-md">
                <div class="font-bold text-xs text-base-content group-hover:text-primary transition-colors truncate" :title="expense.description">
                  {{ expense.description }}
                </div>
                <div class="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span class="badge badge-xs font-semibold gap-1 py-2 whitespace-nowrap" :class="getCategoryBadgeClass(expense.category)" :title="expense.category">
                    <Icon :icon="getCategoryIcon(expense.category)" class="w-3 h-3 shrink-0" />
                    <span>{{ condenseCategory(expense.category) }}</span>
                  </span>
                  <span class="text-[10px] font-mono opacity-60 truncate max-w-[180px]">{{ expense.partner }} · {{ expense.member }}</span>
                  <button
                    v-if="expense.receiptUrl"
                    type="button"
                    @click.stop="previewReceipt(expense)"
                    class="text-primary hover:scale-110 transition-transform"
                    title="View receipt / PDF"
                  >
                    <Icon icon="solar:paperclip-bold" class="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>

              <!-- Tax / Pool Scope Static Opaque Pill -->
              <td class="whitespace-nowrap" @click.stop="openEditModal(expense)">
                <span
                  class="badge badge-sm font-bold gap-1.5 py-2.5 px-2.5 whitespace-nowrap shadow-2xs"
                  :class="getScopeBadgeClass(expense.scope)"
                  title="Click to edit scope or select multiple rows for bulk change"
                >
                  <span>{{ getScopeBadgeLabel(expense) }}</span>
                </span>
                <div v-if="expense.scope === 'split'" class="text-[10px] font-mono text-base-content/60 mt-0.5">
                  Co-op ${{ expense.coopSharedAmount.toFixed(2) }} · Pers ${{ expense.personalWriteOffAmount.toFixed(2) }}
                </div>
              </td>

              <!-- Amount -->
              <td class="text-right font-mono font-black text-sm whitespace-nowrap text-base-content">
                ${{ expense.amount.toFixed(2) }}
              </td>

              <!-- Status -->
              <td class="text-center whitespace-nowrap">
                <span class="badge badge-xs font-bold uppercase tracking-wider py-2 px-2 whitespace-nowrap" :class="getStatusBadgeClass(expense.status)">
                  {{ expense.status }}
                </span>
              </td>

              <!-- Actions (kebab menu — identical to InventoryTableView) -->
              <td class="text-center" @click.stop>
                <div class="dropdown dropdown-end">
                  <button tabindex="0" type="button" class="btn btn-ghost btn-xs btn-circle opacity-60 hover:opacity-100">
                    <Icon icon="solar:menu-dots-bold" class="w-4 h-4" />
                  </button>
                  <ul tabindex="0" class="dropdown-content z-50 menu p-1.5 shadow-xl bg-base-100 rounded-box w-48 border border-base-200 text-xs font-bold space-y-0.5">
                    <li>
                      <a @click="openEditModal(expense)" class="text-primary">
                        <Icon icon="solar:pen-linear" class="w-3.5 h-3.5" /> Edit Details
                      </a>
                    </li>
                    <li v-if="expense.status === 'pending'">
                      <a @click="updateStatus(expense, 'approved')" class="text-success">
                        <Icon icon="solar:check-circle-bold" class="w-3.5 h-3.5" /> Approve
                      </a>
                    </li>
                    <li v-if="expense.status === 'approved'">
                      <a @click="updateStatus(expense, 'reimbursed')" class="text-info">
                        <Icon icon="solar:card-recive-bold" class="w-3.5 h-3.5" /> Mark Reimbursed
                      </a>
                    </li>
                    <li v-if="expense.receiptUrl">
                      <a @click="previewReceipt(expense)">
                        <Icon icon="solar:paperclip-bold" class="w-3.5 h-3.5" /> View Receipt
                      </a>
                    </li>
                    <li>
                      <label class="cursor-pointer">
                        <Icon icon="solar:upload-minimalistic-bold" class="w-3.5 h-3.5" />
                        {{ expense.receiptUrl ? 'Replace Receipt' : 'Attach Receipt' }}
                        <input type="file" accept=".pdf,image/*" @change="uploadReceiptForExpense(expense, $event)" class="hidden" />
                      </label>
                    </li>
                    <div class="divider my-0.5"></div>
                    <li>
                      <a @click="confirmDelete(expense)" class="text-error">
                        <Icon icon="solar:trash-bin-trash-linear" class="w-3.5 h-3.5" /> Delete
                      </a>
                    </li>
                  </ul>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- UNIFIED 2-TIER BOTTOM DOCK WITH PAGER & 4 ERGONOMIC DOCK TABS (MATCHES INVENTORYPAGINATIONDOCK) -->
    <PaginationDock
      v-if="filteredExpenses.length > 0"
      v-model:currentPage="currentPage"
      v-model:pageSize="pageSize"
      :totalItems="filteredExpenses.length"
      :totalPages="totalPages"
      :isLoading="loading"
      entityLabel="expenses"
      :isFiltered="scopeFilter !== 'all' || statusFilter !== 'all' || monthFilter !== 'all' || !!searchQuery"
      @scroll-top="scrollToTop"
    >
      <template #dock>
        <!-- Dock Item 1: Actions (N) — Opens Multi-Line Bulk Edit Tray/Modal (Matches InventoryPaginationDock) -->
        <button
          type="button"
          @click="isBulkActionsOpen = true"
          class="h-11 my-auto px-2.5 sm:px-3.5 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 cursor-pointer shrink-0"
          :class="selectedIds.length > 0 ? 'bg-warning text-warning-content font-black shadow-md border border-warning-content/25' : 'bg-base-200/80 hover:bg-base-300 text-base-content font-bold border border-base-content/15 shadow-xs'"
          :title="selectedIds.length > 0 ? `${selectedIds.length} expenses selected for multi-line bulk edit` : 'Select rows in the table to run multi-line bulk edits'"
        >
          <Icon icon="solar:bolt-bold" class="w-4.5 h-4.5" />
          <span class="font-extrabold uppercase text-[10px] tracking-tight leading-none whitespace-nowrap">
            Actions ({{ selectedIds.length }})
          </span>
        </button>

        <!-- Dock Item 2: Scan Receipt -->
        <a
          href="/purchases/speed-entry?mode=all_expense"
          class="h-11 my-auto px-2.5 sm:px-3.5 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 bg-base-200/80 hover:bg-secondary/15 text-secondary font-bold border border-secondary/25 shadow-xs active:scale-95 cursor-pointer shrink-0"
          title="Scan multi-line paper receipt via OCR"
        >
          <Icon icon="solar:scanner-bold" class="w-4.5 h-4.5 text-secondary" />
          <span class="font-extrabold uppercase text-[10px] tracking-tight leading-none whitespace-nowrap">Scan OCR</span>
        </a>

        <!-- Dock Item 3: Upload Multi-PDF Invoices -->
        <button
          type="button"
          @click="openImportModal"
          class="h-11 my-auto px-2.5 sm:px-3.5 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 bg-base-200/80 hover:bg-base-300 text-base-content font-bold border border-base-content/15 shadow-xs active:scale-95 cursor-pointer shrink-0"
          title="Upload multiple PDF invoices at once"
        >
          <Icon icon="solar:upload-track-bold" class="w-4.5 h-4.5 text-primary" />
          <span class="font-extrabold uppercase text-[10px] tracking-tight leading-none whitespace-nowrap">Upload PDFs</span>
        </button>

        <!-- Dock Item 4: Log Expense (Elevated Contextual Primary Action) -->
        <button
          type="button"
          @click="openSubmitModal"
          class="h-11 my-auto px-3.5 sm:px-4 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 bg-primary text-primary-content font-black shadow-md border border-primary-content/25 active:scale-95 hover:brightness-110 cursor-pointer shrink-0"
          title="Log a single expense or receipt"
        >
          <Icon icon="solar:add-circle-bold" class="w-4.5 h-4.5 drop-shadow-xs" />
          <span class="font-black uppercase text-[10px] sm:text-[11px] tracking-wide leading-none whitespace-nowrap">Log Expense</span>
        </button>
      </template>
    </PaginationDock>

    <!-- MULTI-LINE BULK ACTIONS TRAY / MODAL (MATCHES INVENTORY BOTTOM ACTION TRAY PATTERN) -->
    <dialog :class="{ 'modal modal-bottom sm:modal-middle': true, 'modal-open': isBulkActionsOpen }">
      <div class="modal-box max-w-lg rounded-t-3xl sm:rounded-3xl p-6 space-y-5 bg-base-100 border border-base-300 shadow-2xl">
        <div class="flex items-center justify-between border-b border-base-200 pb-3">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-warning/15 text-warning flex items-center justify-center">
              <Icon icon="solar:bolt-bold" class="w-5 h-5" />
            </div>
            <div>
              <h3 class="font-black text-base text-base-content">Multi-Line Bulk Actions</h3>
              <p class="text-xs text-base-content/60 font-mono">
                {{ selectedIds.length }} expense{{ selectedIds.length === 1 ? '' : 's' }} selected · ${{ selectedTotalAmount.toFixed(2) }} total
              </p>
            </div>
          </div>
          <button type="button" @click="isBulkActionsOpen = false" class="btn btn-ghost btn-sm btn-circle">✕</button>
        </div>

        <div v-if="selectedIds.length === 0" class="py-6 text-center space-y-3">
          <p class="text-xs text-base-content/70">No rows selected yet. Check rows in the table or select all on this page:</p>
          <button type="button" @click="toggleSelectAllPage" class="btn btn-sm btn-primary font-bold rounded-xl">
            Select All {{ paginatedExpenses.length }} Rows on Page
          </button>
        </div>

        <div v-else class="space-y-4 text-xs">
          <!-- 1. Bulk Tax / Co-op Allocation Scope -->
          <div class="space-y-2">
            <div class="font-black uppercase tracking-wider text-[11px] opacity-70">1. Set Tax / Pool Scope</div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                :disabled="bulkBusy"
                @click="bulkUpdateScope('coop_shared', 100)"
                class="btn btn-sm btn-primary text-primary-content font-bold rounded-xl"
              >
                🤝 Co-op 100%
              </button>
              <button
                type="button"
                :disabled="bulkBusy"
                @click="bulkUpdateScope('personal_write_off', 0)"
                class="btn btn-sm btn-secondary text-secondary-content font-bold rounded-xl"
              >
                👤 Personal 100%
              </button>
              <button
                type="button"
                :disabled="bulkBusy"
                @click="bulkUpdateScope('split', 50)"
                class="btn btn-sm btn-accent text-accent-content font-bold rounded-xl"
              >
                ⚖️ Split 50/50
              </button>
            </div>
          </div>

          <!-- 2. Bulk Reimbursement Status -->
          <div class="space-y-2">
            <div class="font-black uppercase tracking-wider text-[11px] opacity-70">2. Set Reimbursement Status</div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                :disabled="bulkBusy"
                @click="bulkUpdateStatus('pending')"
                class="btn btn-sm btn-warning text-warning-content font-bold rounded-xl"
              >
                🟡 Mark Pending
              </button>
              <button
                type="button"
                :disabled="bulkBusy"
                @click="bulkUpdateStatus('approved')"
                class="btn btn-sm btn-success text-success-content font-bold rounded-xl"
              >
                🟢 Approve ({{ selectedIds.length }})
              </button>
              <button
                type="button"
                :disabled="bulkBusy"
                @click="bulkUpdateStatus('reimbursed')"
                class="btn btn-sm btn-info text-info-content font-bold rounded-xl"
              >
                💎 Reimburse ({{ selectedIds.length }})
              </button>
            </div>
          </div>

          <!-- 3. Clear or Delete -->
          <div class="flex items-center justify-between pt-3 border-t border-base-200">
            <button
              type="button"
              :disabled="bulkBusy"
              @click="bulkDeleteSelected"
              class="btn btn-sm btn-outline btn-error font-bold rounded-xl gap-1.5"
            >
              <Icon icon="solar:trash-bin-trash-bold" class="w-4 h-4" />
              <span>Delete ({{ selectedIds.length }})</span>
            </button>
            <div class="flex items-center gap-2">
              <button
                type="button"
                @click="selectedIds = []; isBulkActionsOpen = false"
                class="btn btn-sm btn-ghost font-bold rounded-xl"
              >
                Clear Selection
              </button>
              <button
                type="button"
                @click="isBulkActionsOpen = false"
                class="btn btn-sm btn-neutral font-bold rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="isBulkActionsOpen = false">close</button>
      </form>
    </dialog>

    <!-- SUBMIT / EDIT EXPENSE MODAL -->
    <dialog :class="{ 'modal modal-open': isSubmitModalOpen }" class="modal">
      <div class="modal-box max-w-lg rounded-3xl p-6 sm:p-7 space-y-5">
        <div class="flex items-center justify-between border-b border-base-200 pb-3">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Icon :icon="editingExpenseId ? 'solar:pen-new-square-bold-duotone' : 'solar:bill-bold-duotone'" class="w-5 h-5" />
            </div>
            <h3 class="font-black text-lg text-base-content">
              {{ editingExpenseId ? 'Edit Expense Details' : 'Log Commons Expense' }}
            </h3>
          </div>
          <button type="button" @click="isSubmitModalOpen = false" class="btn btn-ghost btn-sm btn-circle">✕</button>
        </div>

        <form @submit.prevent="submitExpense" class="space-y-4 text-xs">
          <!-- Member & Partner -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="form-control">
              <label class="label py-1"><span class="label-text font-bold">Fronting Member *</span></label>
              <input 
                type="text" 
                v-model="newExpense.member" 
                placeholder="e.g. Mike or Jesse" 
                class="input input-bordered input-sm rounded-xl font-medium" 
                required 
              />
            </div>
            <div class="form-control">
              <label class="label py-1"><span class="label-text font-bold">Partner Prefix</span></label>
              <select v-model="newExpense.partner" class="select select-bordered select-sm rounded-xl font-bold font-mono">
                <option value="HUCK">HUCK (Huckleberry Collective)</option>
                <option value="PDXGL">PDXGL (PDX Game Library)</option>
                <option value="SHARED">SHARED (All Booth Commons)</option>
              </select>
            </div>
          </div>

          <!-- Category -->
          <div class="form-control">
            <label class="label py-1"><span class="label-text font-bold">Category *</span></label>
            <select v-model="newExpense.category" @change="onNewCategoryChange" class="select select-bordered select-sm rounded-xl font-bold" required>
              <option value="Thermal Tags & Merch Supplies">🏷️ Thermal Tags &amp; Merch Supplies (Labels, Tags, Bags)</option>
              <option value="Booth Rent & Mall Fees">🏪 Booth Rent &amp; Mall Fees (Memory Den / Pop-Up Table)</option>
              <option value="Display Hardware & Fixtures">🪵 Display Hardware &amp; Fixtures (Shelving, Racks, Lights)</option>
              <option value="Tech Commons & AI Credits">⚡ Tech Commons &amp; AI Credits (Hosting, Gemini Credits)</option>
              <option value="Hauling & Sourcing Transport">🚚 Hauling &amp; Sourcing Transport (Mileage, Gas, Tolls)</option>
              <option value="Personal Schedule C Write-Off">👤 Personal Schedule C Write-Off (Home Office, Phone, Curator Tools)</option>
              <option value="Cleaning & Facility Maintenance">🧹 Cleaning &amp; Facility Maintenance</option>
              <option value="General Operational Commons">📦 General Operational Commons</option>
            </select>
          </div>

          <!-- Tax & Co-op Allocation Scope -->
          <div class="p-3.5 rounded-2xl bg-base-200/60 border border-base-300 space-y-2.5">
            <label class="label py-0">
              <span class="label-text font-black text-xs">Who Pays / Tax Write-Off Scope *</span>
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                @click="newExpense.scope = 'coop_shared'; newExpense.coopSharePct = 100"
                class="btn btn-xs rounded-xl font-bold h-9"
                :class="newExpense.scope === 'coop_shared' ? 'btn-primary' : 'btn-ghost border border-base-300'"
              >
                🤝 Co-op Shared (100%)
              </button>
              <button
                type="button"
                @click="newExpense.scope = 'personal_write_off'; newExpense.coopSharePct = 0"
                class="btn btn-xs rounded-xl font-bold h-9"
                :class="newExpense.scope === 'personal_write_off' ? 'btn-secondary' : 'btn-ghost border border-base-300'"
              >
                👤 Personal Write-Off
              </button>
              <button
                type="button"
                @click="newExpense.scope = 'split'; newExpense.coopSharePct = 50"
                class="btn btn-xs rounded-xl font-bold h-9"
                :class="newExpense.scope === 'split' ? 'btn-accent' : 'btn-ghost border border-base-300'"
              >
                ⚖️ Split Co-op / Personal
              </button>
            </div>
            <div v-if="newExpense.scope === 'split'" class="space-y-1 pt-1">
              <div class="flex justify-between text-[11px] font-mono font-bold">
                <span class="text-primary">Co-op Commons: {{ newExpense.coopSharePct }}%</span>
                <span class="text-secondary">Personal Schedule C: {{ 100 - newExpense.coopSharePct }}%</span>
              </div>
              <input type="range" min="10" max="90" step="5" v-model.number="newExpense.coopSharePct" class="range range-xs range-accent" />
            </div>
            <p class="text-[11px] text-base-content/70">
              <span v-if="newExpense.scope === 'coop_shared'">Reimbursed 100% from the 30% Co-op Commons Pool in monthly settlements.</span>
              <span v-else-if="newExpense.scope === 'personal_write_off'">$0.00 charged to Co-op partners; tracked 100% for your Personal IRS Schedule C tax deduction.</span>
              <span v-else>Charges {{ newExpense.coopSharePct }}% to Co-op Commons and {{ 100 - newExpense.coopSharePct }}% to your Personal Schedule C.</span>
            </p>
          </div>

          <!-- Amount & Date -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="form-control">
              <label class="label py-1"><span class="label-text font-bold">Total Amount ($) *</span></label>
              <input 
                type="number" 
                v-model.number="newExpense.amount" 
                step="0.01" 
                min="0.01" 
                placeholder="e.g. 45.99" 
                class="input input-bordered input-sm rounded-xl font-mono font-bold text-sm" 
                required 
              />
            </div>
            <div class="form-control">
              <label class="label py-1"><span class="label-text font-bold">Purchase Date *</span></label>
              <input 
                type="date" 
                v-model="newExpense.date" 
                class="input input-bordered input-sm rounded-xl font-mono text-xs" 
                required 
              />
            </div>
          </div>

          <!-- Description -->
          <div class="form-control">
            <label class="label py-1"><span class="label-text font-bold">Item Description &amp; Itemization *</span></label>
            <textarea 
              v-model="newExpense.description" 
              placeholder="e.g. Rollo 4x6 Direct Thermal Labels (500 pack) ordered from Amazon for booth tagging" 
              class="textarea textarea-bordered rounded-xl text-xs h-20" 
              required
            ></textarea>
          </div>

          <!-- Status (Shown in Edit Mode) -->
          <div v-if="editingExpenseId" class="form-control">
            <label class="label py-1"><span class="label-text font-bold">Reimbursement Status</span></label>
            <select v-model="newExpense.status" class="select select-bordered select-sm rounded-xl font-bold capitalize">
              <option value="pending">🟡 Pending Reimbursement</option>
              <option value="approved">🟢 Approved for Commons Pool</option>
              <option value="reimbursed">💎 Reimbursed</option>
            </select>
          </div>

          <!-- Receipt Upload -->
          <div v-if="!editingExpenseId" class="form-control">
            <label class="label py-1"><span class="label-text font-bold">Receipt / Invoice Photo</span></label>
            <input 
              type="file" 
              accept="image/*,.pdf" 
              @change="handleReceiptFile" 
              class="file-input file-input-bordered file-input-sm rounded-xl w-full text-xs" 
            />
            <span class="text-[10px] text-base-content/50 mt-1">PNG, JPG, or PDF snapshot of store receipt or online order.</span>
          </div>

          <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-base-200">
            <button type="button" @click="isSubmitModalOpen = false" class="btn btn-sm btn-ghost rounded-xl">Cancel</button>
            <button 
              type="submit" 
              class="btn btn-sm btn-primary rounded-xl font-black px-5" 
              :disabled="submitting"
            >
              <span v-if="submitting" class="loading loading-spinner loading-xs"></span>
              <span v-else>{{ editingExpenseId ? 'Save Changes' : 'Submit for Reimbursement' }}</span>
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="isSubmitModalOpen = false">close</button>
      </form>
    </dialog>

    <!-- RECEIPT PREVIEW MODAL -->
    <dialog :class="{ 'modal modal-open': isReceiptPreviewOpen }" class="modal">
      <div class="modal-box max-w-3xl rounded-3xl p-5 space-y-4">
        <div class="flex items-center justify-between border-b border-base-200 pb-2.5">
          <div class="min-w-0 pr-2">
            <h4 class="font-black text-sm text-base-content truncate">
              {{ activeReceipt?.description }}
            </h4>
            <div class="text-xs font-mono text-base-content/60 font-medium">
              ${{ activeReceipt?.amount.toFixed(2) }} • {{ formatDate(activeReceipt?.date || '') }}
            </div>
          </div>
          <button type="button" @click="isReceiptPreviewOpen = false" class="btn btn-ghost btn-sm btn-circle shrink-0">✕</button>
        </div>

        <div class="flex flex-col items-center justify-center p-2 bg-base-200/60 rounded-2xl min-h-[50vh] max-h-[75vh] overflow-hidden">
          <iframe 
            v-if="activeReceipt?.receiptUrl" 
            :src="activeReceipt.receiptUrl" 
            class="w-full h-[65vh] rounded-xl border border-base-300 bg-base-100"
            title="Receipt Document / PDF"
          ></iframe>
        </div>

        <div class="flex items-center justify-between gap-2 pt-2 border-t border-base-200 flex-wrap">
          <label class="btn btn-xs btn-outline gap-1 font-bold cursor-pointer">
            <Icon icon="solar:upload-minimalistic-bold" class="w-3.5 h-3.5" />
            <span>Replace / Re-upload PDF</span>
            <input type="file" accept=".pdf,image/*" @change="replaceActiveReceipt($event)" class="hidden" />
          </label>
          <a 
            v-if="activeReceipt?.receiptUrl" 
            :href="activeReceipt.receiptUrl" 
            target="_blank" 
            class="btn btn-xs btn-primary gap-1 font-bold"
          >
            <Icon icon="solar:arrow-up-right-bold" class="w-3.5 h-3.5" />
            <span>Open in New Tab / Download</span>
          </a>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="isReceiptPreviewOpen = false">close</button>
      </form>
    </dialog>

    <!-- EXPENSE & INVOICE STAGING TRAY (CANONICAL INTERACTIVE BOTTOM SHEET PATTERN) -->
    <Teleport to="body">
      <div v-if="isImportModalOpen" class="relative z-[80]">
        <!-- Backdrop Scrim -->
        <div 
          class="fixed inset-0 z-[80] bg-black/60 backdrop-blur-xs flex flex-col justify-end transition-opacity"
          @click.self="closeImportModal"
        >
          <!-- Bottom Drawer Container -->
          <div class="bg-base-100 border-t border-base-300 rounded-t-3xl max-w-4xl mx-auto w-full max-h-[88dvh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200 overflow-hidden select-none">
            
            <!-- Drag Handle Affordance -->
            <div class="w-12 h-1.5 bg-base-content/20 rounded-full mx-auto mt-2.5 mb-1 shrink-0"></div>

            <!-- STICKY TRAY HEADER -->
            <div class="px-4 py-3 sm:px-6 sm:py-3.5 border-b border-base-200 flex items-center justify-between gap-3 shrink-0 bg-base-200/50">
              <div class="flex items-center gap-2.5 min-w-0 flex-1">
                <div class="w-10 h-10 rounded-2xl bg-secondary/15 text-secondary flex items-center justify-center shrink-0 shadow-xs">
                  <Icon icon="solar:document-bold" class="w-6 h-6" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <h3 class="text-sm sm:text-base font-black text-base-content truncate">
                      Expense &amp; Invoice Staging Tray
                    </h3>
                    <span class="badge badge-primary badge-xs font-mono font-bold">
                      Open Collective
                    </span>
                  </div>
                  <div class="text-[11px] font-mono flex items-center gap-2 mt-0.5 opacity-70 truncate">
                    <span class="font-bold text-secondary">Commons Ledger</span>
                    <span>•</span>
                    <span class="font-bold text-primary">{{ parsedImportExpenses.length }} candidate{{ parsedImportExpenses.length === 1 ? '' : 's' }}</span>
                    <span v-if="totalImportAmount > 0">•</span>
                    <span v-if="totalImportAmount > 0" class="font-bold text-success font-mono">${{ totalImportAmount.toFixed(2) }} settled</span>
                  </div>
                </div>
              </div>

              <button 
                type="button" 
                @click="closeImportModal" 
                class="btn btn-ghost btn-sm btn-circle shrink-0"
                title="Close Staging Tray"
              >
                ✕
              </button>
            </div>

            <!-- SCROLLABLE TRAY BODY -->
            <div class="p-4 sm:p-6 overflow-y-auto space-y-4 max-h-[calc(88dvh-130px)]">
              <!-- Mode Switcher -->
              <div class="join grid grid-cols-2 bg-base-200/80 p-1 rounded-2xl">
                <button 
                  type="button" 
                  class="btn btn-sm join-item font-bold gap-2 text-xs" 
                  :class="importMode === 'pdf' ? 'btn-primary shadow-xs' : 'btn-ghost'"
                  @click="importMode = 'pdf'"
                >
                  <Icon icon="solar:document-bold" class="w-4 h-4" />
                  <span>1. Drop Invoices / PDFs Directly</span>
                </button>
                <button 
                  type="button" 
                  class="btn btn-sm join-item font-bold gap-2 text-xs" 
                  :class="importMode === 'csv' ? 'btn-secondary shadow-xs' : 'btn-ghost'"
                  @click="importMode = 'csv'"
                >
                  <Icon icon="solar:file-text-bold" class="w-4 h-4" />
                  <span>2. Paste / Upload CSV</span>
                </button>
              </div>

              <!-- MODE 1: DIRECT PDF / RECEIPT DROPZONE -->
              <div v-if="importMode === 'pdf'" class="space-y-3">
                <div 
                  class="border-2 border-dashed rounded-3xl p-6 text-center space-y-3 transition-all"
                  :class="isDraggingPdf ? 'border-primary bg-primary/10 scale-[1.01]' : 'border-primary/40 bg-primary/5 hover:border-primary'"
                  @dragover.prevent="isDraggingPdf = true"
                  @dragleave.prevent="isDraggingPdf = false"
                  @drop.prevent="handlePdfDropEvent"
                >
                  <div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                    <Icon icon="solar:upload-track-bold-duotone" class="w-7 h-7" />
                  </div>
                  <div class="space-y-1">
                    <div class="font-black text-sm sm:text-base text-base-content">
                      Drop invoice PDFs, statements, or screenshots here
                    </div>
                    <p class="text-xs text-base-content/70 max-w-md mx-auto">
                      Hold <kbd class="kbd kbd-xs">Ctrl</kbd> or <kbd class="kbd kbd-xs">Shift</kbd> in Windows Explorer to select all your downloaded files at once!
                    </p>
                  </div>

                  <div class="pt-1 flex justify-center">
                    <label class="btn btn-primary btn-sm rounded-xl font-bold gap-2 cursor-pointer shadow-md shadow-primary/20 px-5">
                      <Icon icon="solar:folder-with-files-bold" class="w-4 h-4" />
                      <span>Select Files / Invoices</span>
                      <input 
                        type="file" 
                        multiple 
                        accept=".pdf,application/pdf,image/*" 
                        class="hidden"
                        @change="handleDirectPdfDrop"
                      />
                    </label>
                  </div>

                  <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-base-100 border border-base-300 text-[11px] font-mono font-medium text-base-content/70">
                    <Icon icon="solar:check-circle-bold" class="w-3.5 h-3.5 text-success" />
                    <span>Multi-file upload &amp; multi-month statement expansion supported</span>
                  </div>
                </div>
              </div>

              <!-- MODE 2: CSV UPLOAD / PASTE -->
              <div v-else class="space-y-3">
                <div class="flex flex-col sm:flex-row gap-3 items-center">
                  <input 
                    type="file" 
                    accept=".csv,text/csv,text/plain" 
                    class="file-input file-input-bordered file-input-sm file-input-secondary w-full"
                    @change="handleImportFileUpload"
                  />
                  <span class="text-xs opacity-50 font-bold uppercase shrink-0">or paste CSV rows below</span>
                </div>

                <textarea 
                  v-model="importCsvText" 
                  rows="5" 
                  placeholder="date,vendor,category,invoice_number,amount,status,notes&#10;2026-10-19,Appwrite,Software/Infrastructure,INV-0FCD135D,25.00,Paid,Pro plan monthly subscription&#10;2026-09-19,Vercel,Hosting/Pro,INV-892182,20.00,Paid,Vercel Pro subscription"
                  class="textarea textarea-bordered w-full font-mono text-xs leading-relaxed"
                  @input="parseExpensesCsv(importCsvText)"
                ></textarea>
              </div>

              <!-- Parsed / Staged Preview Table -->
              <div v-if="parsedImportExpenses.length > 0" class="space-y-2 pt-2 border-t border-base-200">
                <div class="flex items-center justify-between text-xs px-1 flex-wrap gap-2">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-bold text-base-content flex items-center gap-1.5">
                      <span>Ready to Review:</span>
                      <span class="badge badge-primary font-bold font-mono">{{ parsedImportExpenses.length }} candidate{{ parsedImportExpenses.length === 1 ? '' : 's' }}</span>
                    </span>
                    <button 
                      type="button" 
                      @click="scanAllPdfsWithAi" 
                      class="btn btn-2xs btn-primary gap-1 font-bold shadow-xs"
                      :disabled="isScanningAllPdfs"
                      title="Automatically read total dollar amounts and dates from inside all invoice PDFs using Gemini"
                    >
                      <span v-if="isScanningAllPdfs" class="loading loading-spinner loading-2xs"></span>
                      <Icon v-else icon="solar:magic-stick-3-bold" class="w-3.5 h-3.5" />
                      <span>{{ isScanningAllPdfs ? 'Scanning Totals...' : '✨ Auto-Read Totals with AI' }}</span>
                    </button>
                  </div>
                  <span class="font-mono font-black text-sm text-primary">
                    Total Commons Pool: ${{ totalImportAmount.toFixed(2) }}
                  </span>
                </div>

                <!-- Duplicate Guard Alert if existing expenses matched -->
                <div v-if="duplicateCountInStaging > 0" class="alert alert-warning text-xs py-2 px-3.5 rounded-2xl flex items-center justify-between border border-warning/30 shadow-xs">
                  <div class="flex items-center gap-2">
                    <Icon icon="solar:shield-warning-bold" class="w-4 h-4 text-warning shrink-0" />
                    <span><strong>Duplicate Guard:</strong> {{ duplicateCountInStaging }} transaction(s) were recognized as already logged in the ledger and automatically unselected to prevent double entry.</span>
                  </div>
                </div>

                <!-- Tax Compliance Alert if Declined Items are present -->
                <div v-if="declinedCountInStaging > 0" class="alert alert-warning text-xs py-2 px-3.5 rounded-2xl flex items-center justify-between border border-warning/30 shadow-xs">
                  <div class="flex items-center gap-2">
                    <Icon icon="solar:danger-triangle-bold" class="w-4 h-4 text-warning shrink-0" />
                    <span><strong>Tax Compliance Guard:</strong> {{ declinedCountInStaging }} declined transaction(s) detected and automatically excluded. Under IRS rules, unpaid charges cannot be claimed as tax-deductible expenses.</span>
                  </div>
                </div>

                <div class="overflow-x-auto max-h-64 rounded-xl border border-base-200 bg-base-100">
                  <table class="table table-xs table-pin-rows">
                    <thead class="bg-base-200">
                      <tr>
                        <th class="w-8 text-center">Include</th>
                        <th>Status</th>
                        <th>File / Receipt</th>
                        <th>Date</th>
                        <th>Description / Vendor</th>
                        <th>Category</th>
                        <th class="text-right">Amount ($)</th>
                        <th class="text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr 
                        v-for="(item, idx) in parsedImportExpenses" 
                        :key="idx" 
                        class="hover:bg-base-200/40"
                        :class="item.isDuplicate ? 'opacity-60 bg-warning/5' : (item.isDeclined ? 'opacity-70 bg-error/5' : '')"
                      >
                        <td class="text-center">
                          <input 
                            type="checkbox" 
                            v-model="item.included" 
                            class="checkbox checkbox-xs" 
                            :class="item.isDuplicate ? 'checkbox-warning' : (item.isDeclined ? 'checkbox-error' : 'checkbox-primary')"
                            :disabled="item.isDuplicate || item.isDeclined"
                            :title="item.isDuplicate ? 'Already logged in ledger' : (item.isDeclined ? 'Declined transactions cannot be claimed as business deductions' : 'Include in Commons Ledger')"
                          />
                        </td>
                        <td>
                          <span 
                            v-if="item.isDuplicate" 
                            class="badge badge-warning badge-xs font-bold gap-1 text-[10px]"
                            :title="item.duplicateReason || 'Already recorded in expenses ledger'"
                          >
                            <Icon icon="solar:shield-warning-bold" class="w-2.5 h-2.5" />
                            Already Logged
                          </span>
                          <span 
                            v-else-if="item.isDeclined" 
                            class="badge badge-error badge-xs font-bold gap-1 text-[10px]"
                            title="Legally excluded from deductions under IRC § 162"
                          >
                            <Icon icon="solar:close-circle-bold" class="w-2.5 h-2.5" />
                            Declined
                          </span>
                          <span 
                            v-else 
                            class="badge badge-success badge-xs font-bold gap-1 text-[10px]"
                          >
                            <Icon icon="solar:check-circle-bold" class="w-2.5 h-2.5" />
                            Settled
                          </span>
                        </td>
                        <td class="whitespace-nowrap">
                          <span v-if="item.matchedFile" class="badge badge-success text-[10px] font-mono gap-1 py-1" :title="item.matchedFileName">
                            <Icon icon="solar:check-circle-bold" class="w-3 h-3" />
                            {{ item.matchedFileName.length > 18 ? item.matchedFileName.slice(0, 16) + '...' : item.matchedFileName }}
                          </span>
                          <label v-else class="btn btn-2xs btn-outline btn-ghost gap-1 font-normal cursor-pointer">
                            <Icon icon="solar:upload-minimalistic-bold" class="w-2.5 h-2.5" />
                            <span>Attach</span>
                            <input type="file" accept=".pdf,image/*" @change="manuallyAttachPdf(idx, $event)" class="hidden" />
                          </label>
                        </td>
                        <td>
                          <input 
                            type="date" 
                            v-model="item.date" 
                            class="input input-bordered input-2xs rounded-lg font-mono text-[11px] w-28" 
                          />
                        </td>
                        <td>
                          <input 
                            type="text" 
                            v-model="item.description" 
                            class="input input-bordered input-2xs rounded-lg text-xs font-medium w-full min-w-36" 
                            placeholder="Vendor / Description"
                          />
                        </td>
                        <td>
                          <select v-model="item.category" class="select select-bordered select-2xs rounded-lg text-[11px] font-semibold w-40">
                            <option value="Tech Commons & AI Credits">⚡ Tech Commons &amp; AI</option>
                            <option value="Booth Rent & Mall Fees">🏪 Booth Rent &amp; Fees</option>
                            <option value="Thermal Tags & Merch Supplies">🏷️ Tags &amp; Merch</option>
                            <option value="Display Hardware & Fixtures">🪵 Display &amp; Fixtures</option>
                            <option value="Hauling & Sourcing Transport">🚚 Transport &amp; Gas</option>
                            <option value="Cleaning & Facility Maintenance">🧹 Cleaning</option>
                            <option value="General Operational Commons">📦 General Commons</option>
                          </select>
                        </td>
                        <td class="text-right">
                          <input 
                            type="number" 
                            step="0.01" 
                            min="0" 
                            v-model.number="item.amount" 
                            class="input input-bordered input-2xs rounded-lg font-mono font-black text-right text-xs w-20"
                            :class="item.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-error'"
                          />
                        </td>
                        <td class="text-center whitespace-nowrap">
                          <div class="flex items-center justify-center gap-1">
                            <button 
                              v-if="item.matchedFile" 
                              type="button" 
                              @click="scanSinglePdfWithAi(idx)" 
                              class="btn btn-ghost btn-2xs text-secondary gap-1"
                              :disabled="item.isScanning"
                              title="Scan with Gemini AI to auto-read total & date"
                            >
                              <span v-if="item.isScanning" class="loading loading-spinner loading-2xs"></span>
                              <Icon v-else icon="solar:magic-stick-3-bold" class="w-3.5 h-3.5" />
                            </button>
                            <button 
                              type="button" 
                              @click="removeMatchedPdf(idx)" 
                              class="btn btn-ghost btn-2xs text-error p-0 w-5 h-5" 
                              title="Remove from import"
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            <!-- STICKY BOTTOM ACTIONS FOOTER -->
            <div class="px-4 py-3 sm:px-6 sm:py-3.5 border-t border-base-200 bg-base-100 flex items-center justify-between gap-3 shrink-0">
              <div class="text-xs font-medium text-base-content/60">
                <span v-if="includedImportExpensesCount > 0" class="font-bold text-success">
                  {{ includedImportExpensesCount }} ready to record
                </span>
                <span v-else>No candidates selected</span>
              </div>
              <div class="flex items-center gap-2">
                <button type="button" @click="closeImportModal" class="btn btn-sm btn-ghost">Cancel</button>
                <button 
                  type="button" 
                  @click="executeExpenseImport" 
                  class="btn btn-sm btn-primary font-bold gap-1.5 shadow-md shadow-primary/20"
                  :disabled="includedImportExpensesCount === 0 || isImportingExpenses"
                >
                  <Icon icon="solar:check-circle-bold" class="w-4 h-4" />
                  <span>Confirm &amp; Import {{ includedImportExpensesCount }} Invoices (${{ totalImportAmount.toFixed(2) }})</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { Icon } from '@iconify/vue';
import PaginationDock from '../common/PaginationDock.vue';
import { addToast } from '../../stores/toast';
import { confirmDialog } from '../../stores/confirm';
import { useAuth } from '../../composables/useAuth';
import { useLoader } from '../../composables/useLoader';
import { pacificMonthKey, monthKeyToLabel } from '../../lib/salesBucketing';
import { 
  coopExpensesApi, 
  inferDefaultScopeForCategory,
  type CoopExpenseItem, 
  type ExpenseCategory, 
  type ExpenseStatus,
  type ExpenseAllocationScope
} from '../../lib/coopExpenses';

const { user, currentTeam } = useAuth();
const { showLoader, updateLoader, hideLoader } = useLoader();

const expenses = ref<CoopExpenseItem[]>([]);
const loading = ref(true);
const submitting = ref(false);
const bulkBusy = ref(false);
const searchQuery = ref('');
const monthFilter = ref<string>('all');
const statusFilter = ref<'all' | 'pending' | 'approved' | 'reimbursed'>('all');
const scopeFilter = ref<'all' | ExpenseAllocationScope>('all');
const currentPage = ref(1);
const pageSize = ref(50);

// Sorting state (matches SalesList.vue)
const sortBy = ref<'date' | 'description' | 'scope' | 'amount' | 'status'>('date');
const sortDesc = ref(true);

const toggleSort = (col: 'date' | 'description' | 'scope' | 'amount' | 'status') => {
  if (sortBy.value === col) {
    sortDesc.value = !sortDesc.value;
  } else {
    sortBy.value = col;
    sortDesc.value = col === 'date' || col === 'amount';
  }
};

// Multi-line selection state
const selectedIds = ref<string[]>([]);
const editingExpenseId = ref<string | null>(null);
const isBulkActionsOpen = ref(false);

watch([searchQuery, monthFilter, statusFilter, scopeFilter], () => {
  currentPage.value = 1;
  selectedIds.value = [];
});

const scrollToTop = () => {
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

const resetAllFilters = () => {
  searchQuery.value = '';
  monthFilter.value = 'all';
  statusFilter.value = 'all';
  scopeFilter.value = 'all';
};

const condenseCategory = (category: ExpenseCategory | string): string => {
  if (category === 'Thermal Tags & Merch Supplies') return 'Thermal Tags & Supplies';
  if (category === 'Booth Rent & Mall Fees') return 'Booth Rent & Fees';
  if (category === 'Display Hardware & Fixtures') return 'Display Fixtures';
  if (category === 'Tech Commons & AI Credits') return 'Tech Commons & AI';
  if (category === 'Hauling & Sourcing Transport') return 'Hauling & Mileage';
  if (category === 'Personal Schedule C Write-Off') return 'Personal Schedule C';
  if (category === 'Cleaning & Facility Maintenance') return 'Facility Maintenance';
  return 'Operational Commons';
};

const getScopeBadgeClass = (scope?: ExpenseAllocationScope): string => {
  if (scope === 'personal_write_off') return 'badge-secondary text-secondary-content';
  if (scope === 'split') return 'badge-accent text-accent-content';
  return 'badge-primary text-primary-content';
};

const getScopeBadgeLabel = (expense: CoopExpenseItem): string => {
  if (expense.scope === 'personal_write_off') return '👤 Personal 100%';
  if (expense.scope === 'split') return `⚖️ Split (${expense.coopSharePct ?? 50}%)`;
  return '🤝 Co-op 100%';
};

// Bulk Invoices & Receipts Import State
const isImportModalOpen = ref(false);
const isImportingExpenses = ref(false);
const importMode = ref<'pdf' | 'csv'>('pdf');
const isDraggingPdf = ref(false);
const importCsvText = ref('');
const parsedImportExpenses = ref<any[]>([]);
const isScanningAllPdfs = ref(false);

const totalImportAmount = computed(() => {
  return Number(
    parsedImportExpenses.value
      .filter(item => item.included !== false)
      .reduce((sum, item) => sum + (item.amount || 0), 0)
      .toFixed(2)
  );
});

const includedImportExpensesCount = computed(() => {
  return parsedImportExpenses.value.filter(item => item.included !== false).length;
});

const declinedCountInStaging = computed(() => {
  return parsedImportExpenses.value.filter(item => item.isDeclined).length;
});

const duplicateCountInStaging = computed(() => {
  return parsedImportExpenses.value.filter(item => item.isDuplicate).length;
});

const isDuplicateOfExisting = (candidate: any): boolean => {
  if (!candidate || !expenses.value || expenses.value.length === 0) return false;
  return expenses.value.some(existing => {
    // 1. Invoice number check if present (at least 6 alphanumeric chars)
    if (candidate.invNum && existing.description) {
      const cleanInv = candidate.invNum.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanInv.length >= 6 && existing.description.toLowerCase().replace(/[^a-z0-9]/g, '').includes(cleanInv)) {
        return true;
      }
    }
    // 2. Exact Date (YYYY-MM-DD) + Exact Amount match (> 0)
    const candDate = (candidate.date || '').slice(0, 10);
    const existDate = (existing.date || '').slice(0, 10);
    const amountMatch = Math.abs((candidate.amount || 0) - (existing.amount || 0)) < 0.01;
    if (candDate && existDate && candDate === existDate && amountMatch && (candidate.amount > 0)) {
      return true;
    }
    return false;
  });
};

const markDuplicates = (items: any[]) => {
  if (!items || items.length === 0) return;
  items.forEach(it => {
    if (isDuplicateOfExisting(it)) {
      it.isDuplicate = true;
      it.included = false;
      it.duplicateReason = `Already logged on ${it.date} for $${Number(it.amount).toFixed(2)}`;
    }
  });
};

const matchedPdfCount = computed(() => {
  return parsedImportExpenses.value.filter(item => !!item.matchedFile).length;
});

// Modals
const isSubmitModalOpen = ref(false);
const isReceiptPreviewOpen = ref(false);
const activeReceipt = ref<CoopExpenseItem | null>(null);

const newExpense = ref<{
  amount: number | '';
  date: string;
  category: ExpenseCategory;
  member: string;
  partner: string;
  description: string;
  status: ExpenseStatus;
  scope: ExpenseAllocationScope;
  coopSharePct: number;
  receiptFile: File | null;
}>({
  amount: '',
  date: new Date().toISOString().slice(0, 10),
  category: 'Thermal Tags & Merch Supplies',
  member: '',
  partner: 'HUCK',
  description: '',
  status: 'pending',
  scope: 'coop_shared',
  coopSharePct: 100,
  receiptFile: null
});

onMounted(async () => {
  await loadExpenses();
  if (user.value?.name) {
    newExpense.value.member = user.value.name;
  }
  if (typeof window !== 'undefined' && window.location.search.includes('openImport=true')) {
    isImportModalOpen.value = true;
  }
});

const loadExpenses = async () => {
  loading.value = true;
  try {
    const tenantId = (currentTeam.value as any)?.$id || '69a9cbcb0038df55f6b9';
    expenses.value = await coopExpensesApi.listExpenses(tenantId);
  } catch (err: any) {
    addToast({ type: 'error', message: 'Failed to load expenses: ' + err.message });
  } finally {
    loading.value = false;
  }
};

const expenseMonthKey = (dateStr?: string): string => {
  if (!dateStr) return '';
  const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0];
  if (/^\d{4}-\d{2}/.test(clean)) return clean.slice(0, 7);
  return pacificMonthKey(dateStr);
};

const monthOptions = computed(() => {
  const map = new Map<string, number>();
  expenses.value.forEach(e => {
    const k = expenseMonthKey(e.date);
    if (k) map.set(k, (map.get(k) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count, label: monthKeyToLabel(key) }))
    .sort((a, b) => b.key.localeCompare(a.key));
});

const activeMonthLabel = computed(() => {
  if (monthFilter.value === 'all') return 'All-Time';
  return monthOptions.value.find(m => m.key === monthFilter.value)?.label || monthFilter.value;
});

const monthScopedExpenses = computed(() => {
  if (monthFilter.value === 'all') return expenses.value;
  return expenses.value.filter(e => expenseMonthKey(e.date) === monthFilter.value);
});

const countByStatus = computed(() => {
  return {
    pending: monthScopedExpenses.value.filter(e => e.status === 'pending').length,
    approved: monthScopedExpenses.value.filter(e => e.status === 'approved').length,
    reimbursed: monthScopedExpenses.value.filter(e => e.status === 'reimbursed').length
  };
});

const countByScope = computed(() => {
  return {
    coop: monthScopedExpenses.value.filter(e => (e.scope || 'coop_shared') === 'coop_shared').length,
    personal: monthScopedExpenses.value.filter(e => e.scope === 'personal_write_off').length,
    split: monthScopedExpenses.value.filter(e => e.scope === 'split').length,
  };
});

const metrics = computed(() => {
  const list = monthScopedExpenses.value;
  const totalExpenses = list.reduce((acc, e) => acc + e.amount, 0);
  const totalCoopShared = list.reduce(
    (acc, e) => acc + (e.coopSharedAmount !== undefined ? e.coopSharedAmount : e.amount),
    0
  );
  const totalPersonalWriteOff = list.reduce(
    (acc, e) => acc + (e.personalWriteOffAmount || 0),
    0
  );
  const totalReimbursed = list
    .filter(e => e.status === 'reimbursed' && (e.scope || 'coop_shared') !== 'personal_write_off')
    .reduce((acc, e) => acc + (e.coopSharedAmount !== undefined ? e.coopSharedAmount : e.amount), 0);
  const totalPending = list
    .filter(e => (e.status === 'pending' || e.status === 'approved') && (e.scope || 'coop_shared') !== 'personal_write_off')
    .reduce((acc, e) => acc + (e.coopSharedAmount !== undefined ? e.coopSharedAmount : e.amount), 0);

  return {
    totalExpenses,
    totalCoopShared,
    totalPersonalWriteOff,
    totalReimbursed,
    totalPending
  };
});

const filteredExpenses = computed(() => {
  let list = [...monthScopedExpenses.value];

  if (scopeFilter.value !== 'all') {
    list = list.filter(e => (e.scope || 'coop_shared') === scopeFilter.value);
  }

  if (statusFilter.value !== 'all') {
    list = list.filter(e => e.status === statusFilter.value);
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter(e => 
      e.description.toLowerCase().includes(q) ||
      e.member.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      e.partner.toLowerCase().includes(q)
    );
  }

  const dir = sortDesc.value ? -1 : 1;
  list.sort((a, b) => {
    if (sortBy.value === 'amount') return (a.amount - b.amount) * dir;
    if (sortBy.value === 'description') return a.description.localeCompare(b.description) * dir;
    if (sortBy.value === 'scope') return (a.scope || 'coop_shared').localeCompare(b.scope || 'coop_shared') * dir;
    if (sortBy.value === 'status') return a.status.localeCompare(b.status) * dir;
    return (a.date || '').localeCompare(b.date || '') * dir;
  });

  return list;
});

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(filteredExpenses.value.length / pageSize.value));
});

const paginatedExpenses = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredExpenses.value.slice(start, start + pageSize.value);
});

const isAllPageSelected = computed(() => {
  if (paginatedExpenses.value.length === 0) return false;
  return paginatedExpenses.value.every(e => selectedIds.value.includes(e.id));
});

const toggleSelectRow = (id: string) => {
  const idx = selectedIds.value.indexOf(id);
  if (idx === -1) {
    selectedIds.value.push(id);
  } else {
    selectedIds.value.splice(idx, 1);
  }
};

const toggleSelectAllPage = () => {
  if (isAllPageSelected.value) {
    const pageSet = new Set(paginatedExpenses.value.map(e => e.id));
    selectedIds.value = selectedIds.value.filter(id => !pageSet.has(id));
  } else {
    const existing = new Set(selectedIds.value);
    paginatedExpenses.value.forEach(e => existing.add(e.id));
    selectedIds.value = Array.from(existing);
  }
};

const selectedTotalAmount = computed(() => {
  const set = new Set(selectedIds.value);
  return expenses.value
    .filter(e => set.has(e.id))
    .reduce((sum, e) => sum + e.amount, 0);
});

const onNewCategoryChange = () => {
  const inferred = inferDefaultScopeForCategory(newExpense.value.category, newExpense.value.description);
  newExpense.value.scope = inferred.scope;
  newExpense.value.coopSharePct = inferred.coopSharePct;
};

const openSubmitModal = () => {
  editingExpenseId.value = null;
  newExpense.value = {
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    category: 'Thermal Tags & Merch Supplies',
    member: user.value?.name || 'Mike',
    partner: 'HUCK',
    description: '',
    status: 'pending',
    scope: 'coop_shared',
    coopSharePct: 100,
    receiptFile: null
  };
  isSubmitModalOpen.value = true;
};

const openEditModal = (expense: CoopExpenseItem) => {
  editingExpenseId.value = expense.id;
  const cleanDate = expense.date ? (expense.date.includes('T') ? expense.date.split('T')[0] : expense.date.slice(0, 10)) : new Date().toISOString().slice(0, 10);
  newExpense.value = {
    amount: expense.amount,
    date: cleanDate,
    category: expense.category,
    member: expense.member,
    partner: expense.partner || 'HUCK',
    description: expense.description,
    status: expense.status,
    scope: expense.scope || 'coop_shared',
    coopSharePct: expense.coopSharePct ?? 100,
    receiptFile: null
  };
  isSubmitModalOpen.value = true;
};

const handleReceiptFile = (e: Event) => {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    newExpense.value.receiptFile = input.files[0];
  }
};

const submitExpense = async () => {
  if (!newExpense.value.amount || Number(newExpense.value.amount) <= 0) {
    addToast({ type: 'warning', message: 'Please enter a valid expense amount.' });
    return;
  }
  if (!newExpense.value.description.trim()) {
    addToast({ type: 'warning', message: 'Please enter an item description.' });
    return;
  }

  submitting.value = true;
  try {
    if (editingExpenseId.value) {
      const target = expenses.value.find(e => e.id === editingExpenseId.value);
      if (!target) throw new Error('Expense record not found.');
      const updated = await coopExpensesApi.updateExpense(editingExpenseId.value, target, {
        amount: Number(newExpense.value.amount),
        date: newExpense.value.date,
        category: newExpense.value.category,
        member: newExpense.value.member,
        partner: newExpense.value.partner,
        description: newExpense.value.description,
        status: newExpense.value.status,
        scope: newExpense.value.scope,
        coopSharePct: newExpense.value.coopSharePct
      });
      const idx = expenses.value.findIndex(e => e.id === editingExpenseId.value);
      if (idx !== -1) expenses.value[idx] = updated;
      isSubmitModalOpen.value = false;
      editingExpenseId.value = null;
      addToast({ type: 'success', message: 'Expense updated!' });
      return;
    }

    const created = await coopExpensesApi.createExpense({
      amount: Number(newExpense.value.amount),
      date: newExpense.value.date,
      category: newExpense.value.category,
      member: newExpense.value.member,
      partner: newExpense.value.partner,
      description: newExpense.value.description,
      scope: newExpense.value.scope,
      coopSharePct: newExpense.value.coopSharePct,
      receiptFile: newExpense.value.receiptFile,
      tenantId: (currentTeam.value as any)?.$id || '69a9cbcb0038df55f6b9'
    });

    expenses.value.unshift(created);
    isSubmitModalOpen.value = false;
    addToast({
      type: 'success',
      message:
        created.scope === 'personal_write_off'
          ? `Logged $${created.amount.toFixed(2)} to Personal Schedule C Write-Offs!`
          : `Logged $${created.coopSharedAmount.toFixed(2)} to Co-op Commons Expenses!`,
    });
  } catch (err: any) {
    addToast({ type: 'error', message: 'Failed to save expense: ' + err.message });
  } finally {
    submitting.value = false;
  }
};

const bulkUpdateScope = async (newScope: ExpenseAllocationScope, pct: number) => {
  if (selectedIds.value.length === 0) return;
  bulkBusy.value = true;
  try {
    const ids = [...selectedIds.value];
    for (const id of ids) {
      const target = expenses.value.find(e => e.id === id);
      if (!target) continue;
      const updated = await coopExpensesApi.updateExpenseScope(id, target, newScope, pct);
      const idx = expenses.value.findIndex(e => e.id === id);
      if (idx !== -1) expenses.value[idx] = updated;
    }
    addToast({
      type: 'success',
      message: `Updated ${ids.length} expense${ids.length === 1 ? '' : 's'} to ${
        newScope === 'personal_write_off' ? 'Personal Schedule C (100%)' : newScope === 'split' ? '50/50 Split' : 'Co-op Shared (100%)'
      }!`,
    });
    selectedIds.value = [];
    isBulkActionsOpen.value = false;
  } catch (err: any) {
    addToast({ type: 'error', message: 'Bulk scope update failed: ' + err.message });
  } finally {
    bulkBusy.value = false;
  }
};

const bulkUpdateStatus = async (newStatus: ExpenseStatus) => {
  if (selectedIds.value.length === 0) return;
  bulkBusy.value = true;
  try {
    const ids = [...selectedIds.value];
    for (const id of ids) {
      const target = expenses.value.find(e => e.id === id);
      if (!target) continue;
      const updated = await coopExpensesApi.updateExpenseStatus(id, target, newStatus);
      const idx = expenses.value.findIndex(e => e.id === id);
      if (idx !== -1) expenses.value[idx] = updated;
    }
    addToast({ type: 'success', message: `Marked ${ids.length} expense${ids.length === 1 ? '' : 's'} as ${newStatus}!` });
    selectedIds.value = [];
    isBulkActionsOpen.value = false;
  } catch (err: any) {
    addToast({ type: 'error', message: 'Bulk status update failed: ' + err.message });
  } finally {
    bulkBusy.value = false;
  }
};

const bulkDeleteSelected = async () => {
  if (selectedIds.value.length === 0) return;
  if (!confirm(`Delete ${selectedIds.value.length} selected expense${selectedIds.value.length === 1 ? '' : 's'}?`)) {
    return;
  }
  bulkBusy.value = true;
  try {
    const ids = [...selectedIds.value];
    for (const id of ids) {
      const target = expenses.value.find(e => e.id === id);
      await coopExpensesApi.deleteExpense(id, target?.receiptImageId);
    }
    const idSet = new Set(ids);
    expenses.value = expenses.value.filter(e => !idSet.has(e.id));
    selectedIds.value = [];
    isBulkActionsOpen.value = false;
    addToast({ type: 'info', message: `Deleted ${ids.length} expense${ids.length === 1 ? '' : 's'}.` });
  } catch (err: any) {
    addToast({ type: 'error', message: 'Bulk delete failed: ' + err.message });
  } finally {
    bulkBusy.value = false;
  }
};

const updateStatus = async (expense: CoopExpenseItem, newStatus: ExpenseStatus) => {
  try {
    const updated = await coopExpensesApi.updateExpenseStatus(expense.id, expense, newStatus);
    const idx = expenses.value.findIndex(e => e.id === expense.id);
    if (idx !== -1) {
      expenses.value[idx] = updated;
    }
    addToast({ type: 'success', message: `Marked as ${newStatus}!` });
  } catch (err: any) {
    addToast({ type: 'error', message: 'Failed to update status: ' + err.message });
  }
};

const confirmDelete = async (expense: CoopExpenseItem) => {
  if (!confirm(`Are you sure you want to delete "${expense.description}" ($${expense.amount.toFixed(2)})?`)) {
    return;
  }
  try {
    await coopExpensesApi.deleteExpense(expense.id, expense.receiptImageId);
    expenses.value = expenses.value.filter(e => e.id !== expense.id);
    selectedIds.value = selectedIds.value.filter(id => id !== expense.id);
    addToast({ type: 'info', message: 'Expense deleted.' });
  } catch (err: any) {
    addToast({ type: 'error', message: 'Failed to delete expense: ' + err.message });
  }
};

const previewReceipt = (expense: CoopExpenseItem) => {
  activeReceipt.value = expense;
  isReceiptPreviewOpen.value = true;
};

const uploadReceiptForExpense = async (expense: CoopExpenseItem, event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];

  showLoader("Uploading Invoice PDF...", {
    step: `Attaching ${file.name} to ${expense.description.slice(0, 30)}...`,
    progress: 40,
    cancelable: false
  });

  try {
    const res = await coopExpensesApi.attachReceipt(expense.id, file, expense.receiptImageId);
    expense.receiptImageId = res.receiptImageId;
    expense.receiptUrl = res.receiptUrl;
    if (activeReceipt.value && activeReceipt.value.id === expense.id) {
      activeReceipt.value.receiptImageId = res.receiptImageId;
      activeReceipt.value.receiptUrl = res.receiptUrl;
    }
    addToast({ type: 'success', message: `Attached ${file.name} to invoice!` });
  } catch (err: any) {
    console.error("Failed to attach receipt:", err);
    addToast({ type: 'error', message: 'Failed to upload receipt: ' + err.message });
  } finally {
    hideLoader();
    input.value = '';
  }
};

const replaceActiveReceipt = async (event: Event) => {
  if (!activeReceipt.value) return;
  await uploadReceiptForExpense(activeReceipt.value, event);
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  try {
    const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      return `${parts[1]}/${parts[2]}/${parts[0].slice(2)}`;
    }
    return clean;
  } catch {
    return dateStr.slice(0, 10);
  }
};

const getCategoryBadgeClass = (category: ExpenseCategory) => {
  switch (category) {
    case 'Booth Rent & Mall Fees': return 'badge-secondary text-secondary-content';
    case 'Thermal Tags & Merch Supplies': return 'badge-info text-info-content';
    case 'Display Hardware & Fixtures': return 'badge-accent text-accent-content';
    case 'Tech Commons & AI Credits': return 'badge-primary text-primary-content';
    case 'Hauling & Sourcing Transport': return 'badge-warning text-warning-content';
    default: return 'badge-ghost';
  }
};

const getCategoryIcon = (category: ExpenseCategory) => {
  switch (category) {
    case 'Booth Rent & Mall Fees': return 'solar:shop-bold';
    case 'Thermal Tags & Merch Supplies': return 'solar:tag-price-bold';
    case 'Display Hardware & Fixtures': return 'solar:box-minimalistic-bold';
    case 'Tech Commons & AI Credits': return 'solar:bolt-bold';
    case 'Hauling & Sourcing Transport': return 'solar:delivery-bold';
    default: return 'solar:folder-with-files-bold';
  }
};

const getStatusBadgeClass = (status: ExpenseStatus) => {
  switch (status) {
    case 'reimbursed': return 'badge-neutral text-neutral-content';
    case 'approved': return 'badge-success text-success-content';
    case 'pending': return 'badge-warning text-warning-content';
    default: return 'badge-ghost';
  }
};

const exportCsv = () => {
  exportCsvByScope('all');
};

const exportCsvByScope = (targetScope: 'all' | 'coop_shared' | 'personal_write_off') => {
  if (expenses.value.length === 0) return;
  const rowsToExport = expenses.value.filter(e => {
    if (targetScope === 'all') return true;
    if (targetScope === 'coop_shared') return (e.coopSharedAmount ?? e.amount) > 0;
    return (e.personalWriteOffAmount ?? 0) > 0;
  });
  if (rowsToExport.length === 0) {
    addToast({ type: 'info', message: 'No matching expenses in that tax scope to export.' });
    return;
  }
  const header = [
    'Date',
    'Member',
    'Partner',
    'Category',
    'AllocationScope',
    'CoopSharePct',
    'CoopSharedAmount',
    'PersonalWriteOffAmount',
    'TotalAmount',
    'Description',
    'Status',
    'ReceiptId'
  ];
  const rows = rowsToExport.map(e => [
    e.date ? e.date.slice(0, 10) : '',
    `"${e.member.replace(/"/g, '""')}"`,
    e.partner,
    `"${e.category}"`,
    e.scope || 'coop_shared',
    e.coopSharePct ?? 100,
    (e.coopSharedAmount ?? e.amount).toFixed(2),
    (e.personalWriteOffAmount ?? 0).toFixed(2),
    e.amount.toFixed(2),
    `"${e.description.replace(/"/g, '""')}"`,
    e.status,
    e.receiptImageId || ''
  ]);
  const csvContent = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const prefix =
    targetScope === 'personal_write_off'
      ? 'Personal_ScheduleC_WriteOffs'
      : targetScope === 'coop_shared'
        ? 'Coop_Shared_Commons_Expenses'
        : 'All_Expenses_Ledger';
  link.setAttribute('download', `${prefix}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  addToast({ type: 'success', message: `Downloaded ${prefix}.csv!` });
};

const openImportModal = () => {
  isImportModalOpen.value = true;
};

const closeImportModal = () => {
  isImportModalOpen.value = false;
  importCsvText.value = '';
  parsedImportExpenses.value = [];
};

const splitCsvRow = (line: string): string[] => {
  const regex = /(?:^|,)(?:"([^"]*)"|([^,]*))/g;
  const result: string[] = [];
  let match: any;
  while ((match = regex.exec(line)) !== null) {
    if (match[1] !== undefined) result.push(match[1]);
    else if (match[2] !== undefined) result.push(match[2]);
    if (regex.lastIndex === match.index) regex.lastIndex++;
  }
  return result;
};

const parseExpensesCsv = (text: string) => {
  if (!text || !text.trim()) {
    parsedImportExpenses.value = [];
    return;
  }
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return;

  const headers = splitCsvRow(lines[0]).map(h => h.trim().toLowerCase());
  const dateIdx = headers.findIndex(h => h.includes('date'));
  const vendorIdx = headers.findIndex(h => h.includes('vendor') || h.includes('payee') || h.includes('merchant'));
  const catIdx = headers.findIndex(h => h.includes('category') || h.includes('type'));
  const invIdx = headers.findIndex(h => h.includes('invoice') || h.includes('ref') || h.includes('id'));
  const amountIdx = headers.findIndex(h => h.includes('amount') || h.includes('total') || h.includes('cost') || h.includes('price'));
  const statusIdx = headers.findIndex(h => h.includes('status'));
  const notesIdx = headers.findIndex(h => h.includes('note') || h.includes('desc') || h.includes('memo'));

  const parsed: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i]);
    if (cols.length === 0 || !cols.some(c => c.trim().length > 0)) continue;

    const rawDate = dateIdx !== -1 ? cols[dateIdx]?.trim() : '';
    const vendor = vendorIdx !== -1 ? cols[vendorIdx]?.trim() : '';
    const rawCategory = catIdx !== -1 ? cols[catIdx]?.trim() : '';
    const invNum = invIdx !== -1 ? cols[invIdx]?.trim() : '';
    const amountVal = amountIdx !== -1 ? parseFloat(cols[amountIdx]?.replace(/[^0-9.]/g, '')) || 0 : 0;
    const rawStatus = statusIdx !== -1 ? cols[statusIdx]?.trim() : '';
    const notes = notesIdx !== -1 ? cols[notesIdx]?.trim() : '';

    if (amountVal <= 0 && !vendor) continue;

    // Smart Category Mapping (Appwrite, Vercel, Software -> Tech Commons)
    let mappedCategory: ExpenseCategory = 'General Operational Commons';
    const catLower = (rawCategory + ' ' + vendor + ' ' + notes).toLowerCase();
    if (catLower.includes('software') || catLower.includes('infrastructure') || catLower.includes('appwrite') || catLower.includes('gemini') || catLower.includes('tech') || catLower.includes('hosting') || catLower.includes('vercel')) {
      mappedCategory = 'Tech Commons & AI Credits';
    } else if (catLower.includes('rent') || catLower.includes('mall') || catLower.includes('booth fee')) {
      mappedCategory = 'Booth Rent & Mall Fees';
    } else if (catLower.includes('label') || catLower.includes('tag') || catLower.includes('rollo') || catLower.includes('bag')) {
      mappedCategory = 'Thermal Tags & Merch Supplies';
    } else if (catLower.includes('shelf') || catLower.includes('fixture') || catLower.includes('rack') || catLower.includes('hardware')) {
      mappedCategory = 'Display Hardware & Fixtures';
    } else if (catLower.includes('gas') || catLower.includes('mileage') || catLower.includes('transport') || catLower.includes('van')) {
      mappedCategory = 'Hauling & Sourcing Transport';
    } else if (catLower.includes('clean')) {
      mappedCategory = 'Cleaning & Facility Maintenance';
    }

    let description = vendor || notes || 'Operational Expense';
    if (vendor && notes && !notes.toLowerCase().includes(vendor.toLowerCase())) {
      description = `${vendor} - ${notes}`;
    }
    if (invNum) {
      description += ` (${invNum})`;
    }

    parsed.push({
      date: rawDate || new Date().toISOString().slice(0, 10),
      amount: amountVal,
      category: mappedCategory,
      member: user.value?.name || 'Mike (Core)',
      partner: 'HUCK',
      description,
      invNum,
      matchedFile: null,
      matchedFileName: '',
      status: (rawStatus.toLowerCase() === 'paid' || rawStatus.toLowerCase() === 'reimbursed') ? 'reimbursed' : 'pending'
    });
  }

  markDuplicates(parsed);
  parsedImportExpenses.value = parsed;
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const formatMonthYear = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0];
    const parts = clean.split(/[-/]/);
    if (parts.length >= 2) {
      const year = parts[0].length === 4 ? parts[0] : (parts[2]?.length === 4 ? parts[2] : '');
      const monthNum = parseInt(parts[0].length === 4 ? parts[1] : parts[0], 10);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthName = months[monthNum - 1] || parts[1];
      return `${monthName} ${year}`.trim();
    }
  } catch {}
  return dateStr;
};

const scanAllPdfsWithAi = async (forceAll: boolean = false) => {
  const itemsToScan = parsedImportExpenses.value.filter(item => 
    item.matchedFile && (forceAll || !item.hasAiScanned || !item.amount || item.amount <= 0)
  );
  if (itemsToScan.length === 0) {
    addToast({ type: 'info', message: 'All invoices already have amounts and dates detected!' });
    return;
  }

  isScanningAllPdfs.value = true;
  showLoader("Reading Invoices with Gemini AI...", {
    step: `Extracting totals & dates from ${itemsToScan.length} dropped invoice PDFs...`,
    progress: 10,
    cancelable: false
  });

  let scannedCount = 0;
  for (let i = 0; i < itemsToScan.length; i++) {
    const item = itemsToScan[i];
    item.isScanning = true;
    const pct = Math.round(((i + 1) / itemsToScan.length) * 100);
    updateLoader(
      undefined,
      `Scanning invoice ${i + 1} of ${itemsToScan.length}: ${item.matchedFileName}...`,
      pct
    );

    try {
      const base64 = await fileToBase64(item.matchedFile);
      const res = await fetch('/api/parse-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 })
      });

      if (res.ok) {
        const data = await res.json();

        // Multi-row Statement Expansion: If the document is a billing ledger or statement with multiple rows
        if ((data.documentType === 'BILLING_STATEMENT_LEDGER' || (data.items && data.items.length > 1)) && data.items.length > 0) {
          const expandedTransactions = data.items.map((it: any) => ({
            date: it.date || data.date || item.date,
            amount: it.cost || 0,
            category: (it.taxCategory && it.taxCategory.includes('Tech')) ? 'Tech Commons & AI Credits' : (item.category || 'Tech Commons & AI Credits'),
            member: item.member,
            partner: item.partner,
            description: `${data.vendor || 'Subscription'} - ${it.title}`,
            invNum: data.invoiceNumber || item.invNum || '',
            matchedFile: item.matchedFile,
            matchedFileName: item.matchedFileName,
            status: it.isDeclined ? 'declined' : 'reimbursed',
            isDeclined: !!it.isDeclined,
            included: !it.isDeclined,
            hasAiScanned: true,
            isScanning: false
          }));

          const curIdx = parsedImportExpenses.value.indexOf(item);
          if (curIdx !== -1) {
            parsedImportExpenses.value.splice(curIdx, 1, ...expandedTransactions);
          }
          if (data.total > 0) scannedCount++;
          continue;
        }

        if (data.total !== undefined && data.total !== null && Number(data.total) > 0) {
          item.amount = Number(data.total);
          scannedCount++;
        }
        if (data.date) {
          item.date = data.date;
        }

        item.isDeclined = !!data.hasDeclinedTransactions && (Number(data.total) === 0);
        item.included = !item.isDeclined;
        item.status = item.isDeclined ? 'declined' : 'reimbursed';

        const v = (data.vendor || '').toLowerCase();
        const f = item.matchedFileName.toLowerCase();
        const my = formatMonthYear(item.date);
        const invTag = data.invoiceNumber || item.invNum || '';

        if (v.includes('google') || f.includes('google') || /^\d{12,24}_\d{8}/.test(item.matchedFileName)) {
          item.category = 'Tech Commons & AI Credits';
          item.description = `Google Cloud - Gemini AI & Infrastructure (${my || 'Monthly'})`;
        } else if (v.includes('appwrite') || f.includes('appwrite') || /^inv-[a-z0-9]{8}/i.test(item.matchedFileName)) {
          item.category = 'Tech Commons & AI Credits';
          if (!item.amount || item.amount <= 0) item.amount = 25.00;
          item.description = `Appwrite - Pro plan (${invTag ? invTag + ' • ' : ''}${my || 'Monthly'})`;
          scannedCount++;
        } else if (v.includes('vercel') || f.includes('vercel')) {
          item.category = 'Tech Commons & AI Credits';
          if (!item.amount || item.amount <= 0) item.amount = 20.00;
          item.description = `Vercel - Pro subscription (${invTag ? invTag + ' • ' : ''}${my || 'Monthly'})`;
          scannedCount++;
        } else if (data.vendor) {
          item.description = `${data.vendor} - ${invTag || 'Invoice'} (${my || item.date || ''})`.trim();
        }

        item.hasAiScanned = true;
      }
    } catch (scanErr) {
      console.warn("Scan failed for", item.matchedFileName, scanErr);
    } finally {
      item.isScanning = false;
    }
  }

  markDuplicates(parsedImportExpenses.value);
  hideLoader();
  isScanningAllPdfs.value = false;

  if (scannedCount > 0) {
    addToast({
      type: 'success',
      message: `Extracted details for ${scannedCount} invoice${scannedCount > 1 ? 's' : ''}! Total Commons Pool: $${totalImportAmount.value.toFixed(2)}`
    });
  } else {
    addToast({
      type: 'warning',
      message: 'Could not auto-read some totals. You can type the dollar amounts directly into the Amount column.'
    });
  }
};

const processPdfFilesList = async (files: File[]) => {
  if (!files || files.length === 0) return;
  const newItems: any[] = [];

  for (const file of files) {
    const fileName = file.name;
    const lower = fileName.toLowerCase();

    // 1. Vendor & Note inference
    let amount = 0;
    let desc = fileName.replace(/\.[^/.]+$/, '');
    let category: ExpenseCategory = 'Tech Commons & AI Credits';

    // Patterns for Google, Appwrite, and Vercel
    const isGoogleNumeric = /^\d{12,24}_\d{8}/.test(fileName);
    const isGoogle = isGoogleNumeric || lower.includes('google') || lower.includes('gcp') || lower.includes('gemini');
    const isAppwrite = lower.includes('appwrite') || 
                       /^inv-[a-z0-9]{8}/i.test(fileName) || 
                       /inv_[a-z0-9]{8}/i.test(fileName) ||
                       lower.includes('0fcd135d') || 
                       lower.includes('68a6b59c') || 
                       lower.includes('1cf37087') || 
                       lower.includes('710d6135') || 
                       lower.includes('713b53f2') || 
                       lower.includes('374730a0') || 
                       lower.includes('bc892c33') || 
                       lower.includes('b2404c55') || 
                       lower.includes('4d1af866');
    const isVercel = lower.includes('vercel');

    if (isAppwrite) {
      amount = 25.00;
      desc = `Appwrite - Pro plan monthly subscription (${desc})`;
      category = 'Tech Commons & AI Credits';
    } else if (isVercel) {
      amount = 20.00;
      desc = `Vercel - Pro plan subscription (${desc})`;
      category = 'Tech Commons & AI Credits';
    } else if (isGoogle) {
      amount = 0; // Populated by AI scan
      desc = `Google Cloud - Gemini AI & Infrastructure (${desc})`;
      category = 'Tech Commons & AI Credits';
    } else if (lower.includes('rollo') || lower.includes('label') || lower.includes('tag')) {
      category = 'Thermal Tags & Merch Supplies';
      desc = `Thermal Supplies - ${desc}`;
    } else if (lower.includes('rent') || lower.includes('memory den')) {
      amount = 382.50;
      desc = 'Memory Den - Booth 0EJ Space Rental';
      category = 'Booth Rent & Mall Fees';
    }

    // 2. Date extraction (YYYY-MM-DD or MM-DD-YYYY or file lastModified)
    let dateStr = new Date().toISOString().slice(0, 10);
    const dateMatch = lower.match(/(202[0-9])[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12][0-9]|3[01])/);
    if (dateMatch) {
      dateStr = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    } else if (file.lastModified) {
      dateStr = new Date(file.lastModified).toISOString().slice(0, 10);
    }

    newItems.push({
      date: dateStr,
      amount,
      category,
      member: user.value?.name || 'Mike (Core)',
      partner: 'HUCK',
      description: desc,
      invNum: fileName.replace(/\.[^/.]+$/, ''),
      matchedFile: file,
      matchedFileName: file.name,
      status: 'reimbursed',
      isScanning: false,
      hasAiScanned: false
    });
  }

  parsedImportExpenses.value = [...parsedImportExpenses.value, ...newItems];

  // Immediately auto-scan dropped invoices to confirm dates and totals
  const needsScan = parsedImportExpenses.value.some(it => it.matchedFile && !it.hasAiScanned);
  if (needsScan) {
    await scanAllPdfsWithAi();
  } else {
    addToast({ 
      type: 'success', 
      message: `Added ${files.length} invoice PDF${files.length > 1 ? 's' : ''}! Review or adjust amounts below.` 
    });
  }
};

const handlePdfDropEvent = async (event: DragEvent) => {
  isDraggingPdf.value = false;
  if (!event.dataTransfer?.files || event.dataTransfer.files.length === 0) return;
  await processPdfFilesList(Array.from(event.dataTransfer.files));
};

const handleDirectPdfDrop = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;
  await processPdfFilesList(Array.from(input.files));
  input.value = '';
};

const scanSinglePdfWithAi = async (idx: number) => {
  const item = parsedImportExpenses.value[idx];
  if (!item || !item.matchedFile) return;

  item.isScanning = true;
  try {
    const base64 = await fileToBase64(item.matchedFile);
    const res = await fetch('/api/parse-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64 })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.total !== undefined && data.total !== null && Number(data.total) > 0) {
        item.amount = Number(data.total);
      }
      if (data.date) item.date = data.date;
      if (data.vendor) {
        const v = data.vendor.toLowerCase();
        if (v.includes('google')) {
          item.category = 'Tech Commons & AI Credits';
          item.description = `Google Cloud - Gemini AI & Infrastructure (${item.date || 'Monthly'})`;
        } else {
          item.description = `${data.vendor} - ${data.invoiceNumber || 'Invoice'} (${item.matchedFileName})`;
        }
      }
      addToast({ type: 'success', message: `AI Scanned: $${item.amount.toFixed(2)} for ${item.matchedFileName}` });
    } else {
      addToast({ type: 'warning', message: 'Could not auto-scan. Please enter the amount manually.' });
    }
  } catch (scanErr) {
    console.warn("AI scan failed:", scanErr);
    addToast({ type: 'warning', message: 'Could not auto-scan. Please enter the amount manually.' });
  } finally {
    item.isScanning = false;
  }
};

const handleBatchPdfUpload = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;

  const files = Array.from(input.files);
  let matched = 0;

  for (const file of files) {
    const fileName = file.name.toLowerCase();

    // 1. Try matching by invoice number (e.g. 0FCD135D or INV-0FCD135D)
    let matchedItem = parsedImportExpenses.value.find(item => {
      if (!item.invNum) return false;
      const cleanInv = item.invNum.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanFileName = fileName.replace(/[^a-z0-9]/g, '');
      return cleanFileName.includes(cleanInv);
    });

    // 2. Try matching by date (e.g. 2026-10-19 or 20261019)
    if (!matchedItem) {
      matchedItem = parsedImportExpenses.value.find(item => {
        if (!item.date) return false;
        const cleanDate = item.date.replace(/-/g, '');
        return fileName.includes(item.date) || fileName.includes(cleanDate);
      });
    }

    if (matchedItem) {
      matchedItem.matchedFile = file;
      matchedItem.matchedFileName = file.name;
      matched++;
    }
  }

  // 3. Fallback: if user uploaded same count of files as rows, match by index
  if (matched === 0 && files.length === parsedImportExpenses.value.length) {
    files.forEach((file, idx) => {
      parsedImportExpenses.value[idx].matchedFile = file;
      parsedImportExpenses.value[idx].matchedFileName = file.name;
    });
    matched = files.length;
  }

  if (matched > 0) {
    addToast({ type: 'success', message: `Matched ${matched} invoice PDF${matched > 1 ? 's' : ''} to expenses!` });
  } else {
    addToast({ type: 'info', message: 'Could not auto-match filenames. Click "Attach" on any row to assign manually.' });
  }
};

const removeMatchedPdf = (idx: number) => {
  if (parsedImportExpenses.value[idx]) {
    parsedImportExpenses.value[idx].matchedFile = null;
    parsedImportExpenses.value[idx].matchedFileName = '';
  }
};

const manuallyAttachPdf = (idx: number, event: Event) => {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0] && parsedImportExpenses.value[idx]) {
    parsedImportExpenses.value[idx].matchedFile = input.files[0];
    parsedImportExpenses.value[idx].matchedFileName = input.files[0].name;
    addToast({ type: 'success', message: `Attached ${input.files[0].name}` });
  }
};

const handleImportFileUpload = (event: any) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e: any) => {
    const text = e.target.result as string;
    importCsvText.value = text;
    parseExpensesCsv(text);
  };
  reader.readAsText(file);
};

const executeExpenseImport = async () => {
  const itemsToImport = parsedImportExpenses.value.filter(item => item.included !== false);
  if (itemsToImport.length === 0) {
    addToast({ type: 'warning', message: 'No valid expenses selected for import.' });
    return;
  }

  // Duplicate Safeguard Confirmation Modal
  if (duplicateCountInStaging.value > 0) {
    const proceed = await confirmDialog(
      `You are about to record ${itemsToImport.length} new expense(s) totaling $${totalImportAmount.value.toFixed(2)} to the Shared Commons Pool. ${duplicateCountInStaging.value} duplicate transaction(s) were recognized from your ledger and safely excluded. Proceed with import?`,
      "Duplicate Safeguards Active",
      "Yes, Import Expenses",
      "Review Candidates",
      "btn-primary"
    );
    if (!proceed) return;
  }

  isImportingExpenses.value = true;
  showLoader("Importing Commons Expenses...", {
    step: `Recording ${itemsToImport.length} expense invoices into Appwrite...`,
    progress: 5,
    cancelable: false
  });

  try {
    let count = 0;
    for (let i = 0; i < itemsToImport.length; i++) {
      const item = itemsToImport[i];
      const pct = Math.round(((i + 1) / itemsToImport.length) * 100);
      updateLoader(undefined, `Saving invoice ${i + 1} of ${itemsToImport.length}: ${item.description.slice(0, 30)}...`, pct);

      await coopExpensesApi.createExpense({
        amount: item.amount,
        date: item.date,
        category: item.category,
        member: item.member,
        partner: item.partner,
        description: item.description,
        receiptFile: item.matchedFile || null,
        tenantId: (currentTeam.value as any)?.$id || '69a9cbcb0038df55f6b9'
      });
      count++;
    }

    addToast({
      type: 'success',
      message: `Successfully imported ${count} expenses totaling $${totalImportAmount.value.toFixed(2)}!`
    });
    closeImportModal();
    await loadExpenses();
  } catch (err: any) {
    console.error("Expense import failed:", err);
    addToast({ type: 'error', message: 'Failed to import expenses: ' + (err?.message || err) });
  } finally {
    isImportingExpenses.value = false;
    hideLoader();
  }
};
</script>
