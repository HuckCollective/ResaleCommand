<template>
  <div class="space-y-6">
    <!-- Header Card -->
    <div class="card bg-base-100 border border-base-200 shadow-sm rounded-3xl p-5 sm:p-7">
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 flex-wrap mb-1.5">
            <span class="badge badge-primary font-black text-xs px-2.5 py-1">
              Open Collective Model
            </span>
            <span class="badge badge-outline font-mono text-xs">
              Tier 1 Commons Pool
            </span>
            <span class="badge badge-neutral font-bold text-xs">
              100% Tax Deductible
            </span>
          </div>
          <h2 class="text-2xl sm:text-3xl font-black text-base-content tracking-tight flex items-center gap-2.5">
            <Icon icon="solar:bill-list-bold-duotone" class="w-7 h-7 sm:w-8 sm:h-8 text-primary shrink-0" />
            <span>Shared Commons Expense Ledger</span>
          </h2>
          <p class="text-xs sm:text-sm text-base-content/70 mt-1 max-w-2xl leading-relaxed">
            Out-of-pocket reimbursements for thermal labels, booth rent, shelving, display hardware, and tech. Reimbursed dollar-for-dollar from the 30% Commons Pool before profits are distributed.
          </p>
        </div>

        <div class="flex items-center gap-2.5 w-full md:w-auto flex-wrap justify-end">
          <a 
            href="/purchases/speed-entry?mode=all_expense"
            class="btn btn-sm btn-secondary gap-2 rounded-xl font-black shadow-md shadow-secondary/25 h-10 px-4"
            title="Scan itemized multi-line paper receipt or screenshot into business expenses via OCR"
          >
            <Icon icon="solar:scanner-bold-duotone" class="w-5 h-5 shrink-0" />
            <span>🧾 Scan Multi-Line Receipt</span>
          </a>

          <button 
            type="button" 
            @click="openImportModal"
            class="btn btn-sm btn-primary gap-2 rounded-xl font-black shadow-md shadow-primary/25 h-10 px-4"
            title="Upload multiple invoice PDFs at once (Appwrite, Google, Vercel, etc.)"
          >
            <Icon icon="solar:upload-track-bold-duotone" class="w-5 h-5 shrink-0" />
            <span>Upload Multi-PDF Invoices</span>
          </button>

          <button 
            type="button" 
            @click="openSubmitModal"
            class="btn btn-sm btn-outline gap-1.5 rounded-xl font-bold h-10"
            title="Manually log a single expense or receipt"
          >
            <Icon icon="solar:add-circle-bold" class="w-4 h-4 shrink-0" />
            <span>+ Single Expense</span>
          </button>
        </div>
      </div>

      <!-- Top KPI Overview -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-base-200">
        <div class="p-4 rounded-2xl bg-base-200/60 border border-base-300 shadow-xs space-y-1">
          <div class="text-[11px] font-bold text-base-content/60 uppercase tracking-wider">Total Commons Expenses</div>
          <div class="text-xl sm:text-2xl font-black text-base-content font-mono">${{ metrics.totalExpenses.toFixed(2) }}</div>
          <div class="text-xs text-base-content/60 font-medium">{{ expenses.length }} logged receipts</div>
        </div>

        <div class="p-4 rounded-2xl bg-success/5 border border-success/30 shadow-xs space-y-1">
          <div class="text-[11px] font-bold text-success uppercase tracking-wider">Reimbursed to Members</div>
          <div class="text-xl sm:text-2xl font-black text-success font-mono">${{ metrics.totalReimbursed.toFixed(2) }}</div>
          <div class="text-xs text-base-content/60 font-medium">Repaid from Tier 1 Pool</div>
        </div>

        <div class="p-4 rounded-2xl bg-warning/5 border border-warning/30 shadow-xs space-y-1">
          <div class="text-[11px] font-bold text-warning uppercase tracking-wider">Pending Reimbursement</div>
          <div class="text-xl sm:text-2xl font-black text-warning font-mono">${{ metrics.totalPending.toFixed(2) }}</div>
          <div class="text-xs text-base-content/60 font-medium">Owed to fronting members</div>
        </div>

        <div class="p-4 rounded-2xl bg-primary/5 border border-primary/30 shadow-xs space-y-1">
          <div class="text-[11px] font-bold text-primary uppercase tracking-wider">Active Booth Rent</div>
          <div class="text-xl sm:text-2xl font-black text-primary font-mono">$382.50<span class="text-xs font-normal opacity-70">/mo</span></div>
          <div class="text-xs text-base-content/60 font-medium">Memory Den (Booth 0EJ)</div>
        </div>
      </div>
    </div>

    <!-- Filter Pills & Search Bar -->
    <div class="card bg-base-100 border border-base-200 shadow-sm rounded-2xl p-3 sm:p-4">
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <!-- Status Filter Tabs -->
        <div class="join bg-base-200/80 p-1 rounded-xl shadow-inner w-full sm:w-auto">
          <button 
            type="button" 
            class="btn btn-xs sm:btn-sm join-item font-bold text-xs" 
            :class="statusFilter === 'all' ? 'btn-primary shadow-xs' : 'btn-ghost opacity-75'"
            @click="statusFilter = 'all'"
          >
            All ({{ expenses.length }})
          </button>
          <button 
            type="button" 
            class="btn btn-xs sm:btn-sm join-item font-bold text-xs" 
            :class="statusFilter === 'pending' ? 'btn-warning text-warning-content shadow-xs font-black' : 'btn-ghost text-warning'"
            @click="statusFilter = 'pending'"
          >
            🟡 Pending ({{ countByStatus.pending }})
          </button>
          <button 
            type="button" 
            class="btn btn-xs sm:btn-sm join-item font-bold text-xs" 
            :class="statusFilter === 'approved' ? 'btn-success text-success-content shadow-xs font-black' : 'btn-ghost text-success'"
            @click="statusFilter = 'approved'"
          >
            🟢 Approved ({{ countByStatus.approved }})
          </button>
          <button 
            type="button" 
            class="btn btn-xs sm:btn-sm join-item font-bold text-xs" 
            :class="statusFilter === 'reimbursed' ? 'btn-neutral text-neutral-content shadow-xs font-black' : 'btn-ghost opacity-75'"
            @click="statusFilter = 'reimbursed'"
          >
            💎 Reimbursed ({{ countByStatus.reimbursed }})
          </button>
        </div>

        <!-- Search Bar & Unobtrusive Export -->
        <div class="flex items-center gap-2 flex-1 max-w-sm justify-end">
          <div class="relative flex-1">
            <Icon icon="solar:magnifer-linear" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40 pointer-events-none" />
            <input 
              type="text" 
              v-model="searchQuery" 
              placeholder="Search expense, member, category..."
              class="input input-bordered input-sm w-full pl-9 text-xs rounded-xl bg-base-200/50 focus:bg-base-100"
            />
          </div>
          <button 
            type="button" 
            @click="exportCsv"
            class="btn btn-sm btn-ghost btn-square rounded-xl text-base-content/60 hover:text-base-content hover:bg-base-200 shrink-0"
            :disabled="expenses.length === 0"
            title="Download CSV for accounting"
          >
            <Icon icon="solar:file-download-bold" class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Expenses Table -->
    <div class="card bg-base-100 border border-base-200 shadow-sm rounded-3xl overflow-hidden">
      <!-- Loading State -->
      <div v-if="loading" class="p-16 flex flex-col items-center justify-center gap-3">
        <span class="loading loading-spinner loading-md text-primary"></span>
        <span class="text-xs font-bold opacity-60">Loading Shared Commons Ledger...</span>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredExpenses.length === 0" class="p-16 text-center space-y-3">
        <div class="w-12 h-12 rounded-2xl bg-base-200 text-base-content/40 flex items-center justify-center mx-auto">
          <Icon icon="solar:bill-cross-linear" class="w-6 h-6" />
        </div>
        <h3 class="font-bold text-base text-base-content">No expenses match your filter</h3>
        <p class="text-xs text-base-content/60 max-w-sm mx-auto">
          {{ searchQuery ? 'Try adjusting your search terms.' : 'Submit your first receipt or out-of-pocket operational cost.' }}
        </p>
        <button type="button" @click="openSubmitModal" class="btn btn-xs btn-primary font-bold">
          Log an Expense
        </button>
      </div>

      <!-- Table Body -->
      <div v-else class="overflow-x-auto">
        <table class="table table-sm w-full">
          <thead>
            <tr class="bg-base-200/80 text-base-content/70 text-xs">
              <th>Date</th>
              <th>Member / Partner</th>
              <th>Category</th>
              <th>Description</th>
              <th class="text-center">Receipt</th>
              <th class="text-right">Amount</th>
              <th>Status</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-base-200 text-xs">
            <tr v-for="expense in filteredExpenses" :key="expense.id" class="hover:bg-base-200/40">
              <td class="font-mono text-xs whitespace-nowrap">
                {{ formatDate(expense.date) }}
              </td>
              <td>
                <div class="font-bold text-base-content">{{ expense.member }}</div>
                <div class="text-[10px] font-mono text-primary font-bold">{{ expense.partner }}</div>
              </td>
              <td>
                <span class="badge badge-sm font-semibold gap-1 whitespace-nowrap" :class="getCategoryBadgeClass(expense.category)">
                  <Icon :icon="getCategoryIcon(expense.category)" class="w-3.5 h-3.5" />
                  <span>{{ expense.category }}</span>
                </span>
              </td>
              <td class="max-w-xs font-medium truncate text-base-content/85" :title="expense.description">
                {{ expense.description }}
              </td>
              <td class="text-center">
                <button 
                  v-if="expense.receiptUrl" 
                  type="button" 
                  @click="previewReceipt(expense)"
                  class="btn btn-ghost btn-xs text-primary gap-1 font-bold"
                  title="View full receipt / PDF"
                >
                  <Icon icon="solar:paperclip-bold" class="w-3.5 h-3.5" />
                  <span>View</span>
                </button>
                <label 
                  v-else 
                  class="btn btn-ghost btn-xs text-base-content/50 hover:text-primary gap-1 font-bold cursor-pointer"
                  title="Attach PDF or receipt"
                >
                  <Icon icon="solar:upload-minimalistic-bold" class="w-3 h-3" />
                  <span>Attach</span>
                  <input type="file" accept=".pdf,image/*" @change="uploadReceiptForExpense(expense, $event)" class="hidden" />
                </label>
              </td>
              <td class="text-right font-mono font-black text-sm whitespace-nowrap text-base-content">
                ${{ expense.amount.toFixed(2) }}
              </td>
              <td>
                <span class="badge badge-sm font-bold capitalize" :class="getStatusBadgeClass(expense.status)">
                  {{ expense.status }}
                </span>
              </td>
              <td class="text-right whitespace-nowrap">
                <div class="flex items-center justify-end gap-1.5">
                  <!-- Approve button -->
                  <button 
                    v-if="expense.status === 'pending'" 
                    type="button" 
                    @click="updateStatus(expense, 'approved')"
                    class="btn btn-xs btn-success text-success-content font-bold gap-1 shadow-2xs"
                    title="Approve for reimbursement"
                  >
                    <Icon icon="solar:check-circle-bold" class="w-3 h-3" />
                    <span>Approve</span>
                  </button>

                  <!-- Mark Reimbursed button -->
                  <button 
                    v-if="expense.status === 'approved'" 
                    type="button" 
                    @click="updateStatus(expense, 'reimbursed')"
                    class="btn btn-xs btn-primary text-primary-content font-bold gap-1 shadow-2xs"
                    title="Mark as paid out from Commons Pool"
                  >
                    <Icon icon="solar:card-recive-bold" class="w-3 h-3" />
                    <span>Reimburse</span>
                  </button>

                  <!-- Delete button -->
                  <button 
                    type="button" 
                    @click="confirmDelete(expense)"
                    class="btn btn-ghost btn-xs text-error opacity-60 hover:opacity-100"
                    title="Delete expense"
                  >
                    <Icon icon="solar:trash-bin-trash-bold" class="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- SUBMIT EXPENSE MODAL -->
    <dialog :class="{ 'modal modal-open': isSubmitModalOpen }" class="modal">
      <div class="modal-box max-w-lg rounded-3xl p-6 sm:p-7 space-y-5">
        <div class="flex items-center justify-between border-b border-base-200 pb-3">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Icon icon="solar:bill-bold-duotone" class="w-5 h-5" />
            </div>
            <h3 class="font-black text-lg text-base-content">Log Commons Expense</h3>
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
            <select v-model="newExpense.category" class="select select-bordered select-sm rounded-xl font-bold" required>
              <option value="Thermal Tags & Merch Supplies">🏷️ Thermal Tags &amp; Merch Supplies (Labels, Tags, Bags)</option>
              <option value="Booth Rent & Mall Fees">🏪 Booth Rent &amp; Mall Fees (Memory Den $382.50)</option>
              <option value="Display Hardware & Fixtures">🪵 Display Hardware &amp; Fixtures (Shelving, Racks, Lights)</option>
              <option value="Tech Commons & AI Credits">⚡ Tech Commons &amp; AI Credits (Hosting, Gemini Credits)</option>
              <option value="Hauling & Sourcing Transport">🚚 Hauling &amp; Sourcing Transport (Gas, Van, Tolls)</option>
              <option value="Cleaning & Facility Maintenance">🧹 Cleaning &amp; Facility Maintenance</option>
              <option value="General Operational Commons">📦 General Operational Commons</option>
            </select>
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

          <!-- Receipt Upload -->
          <div class="form-control">
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
              <span v-else>Submit for Reimbursement</span>
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
import { ref, computed, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { addToast } from '../../stores/toast';
import { confirmDialog } from '../../stores/confirm';
import { useAuth } from '../../composables/useAuth';
import { useLoader } from '../../composables/useLoader';
import { 
  coopExpensesApi, 
  type CoopExpenseItem, 
  type ExpenseCategory, 
  type ExpenseStatus 
} from '../../lib/coopExpenses';

const { user, currentTeam } = useAuth();
const { showLoader, updateLoader, hideLoader } = useLoader();

const expenses = ref<CoopExpenseItem[]>([]);
const loading = ref(true);
const submitting = ref(false);
const searchQuery = ref('');
const statusFilter = ref<'all' | 'pending' | 'approved' | 'reimbursed'>('all');

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
  receiptFile: File | null;
}>({
  amount: '',
  date: new Date().toISOString().slice(0, 10),
  category: 'Thermal Tags & Merch Supplies',
  member: '',
  partner: 'HUCK',
  description: '',
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

const countByStatus = computed(() => {
  return {
    pending: expenses.value.filter(e => e.status === 'pending').length,
    approved: expenses.value.filter(e => e.status === 'approved').length,
    reimbursed: expenses.value.filter(e => e.status === 'reimbursed').length
  };
});

const metrics = computed(() => {
  const totalExpenses = expenses.value.reduce((acc, e) => acc + e.amount, 0);
  const totalReimbursed = expenses.value
    .filter(e => e.status === 'reimbursed')
    .reduce((acc, e) => acc + e.amount, 0);
  const totalPending = expenses.value
    .filter(e => e.status === 'pending' || e.status === 'approved')
    .reduce((acc, e) => acc + e.amount, 0);

  return {
    totalExpenses,
    totalReimbursed,
    totalPending
  };
});

const filteredExpenses = computed(() => {
  let list = [...expenses.value];

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

  return list;
});

const openSubmitModal = () => {
  newExpense.value = {
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    category: 'Thermal Tags & Merch Supplies',
    member: user.value?.name || 'Tyler',
    partner: 'HUCK',
    description: '',
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
    const created = await coopExpensesApi.createExpense({
      amount: Number(newExpense.value.amount),
      date: newExpense.value.date,
      category: newExpense.value.category,
      member: newExpense.value.member,
      partner: newExpense.value.partner,
      description: newExpense.value.description,
      receiptFile: newExpense.value.receiptFile,
      tenantId: (currentTeam.value as any)?.$id || '69a9cbcb0038df55f6b9'
    });

    expenses.value.unshift(created);
    isSubmitModalOpen.value = false;
    addToast({ type: 'success', message: `Logged $${created.amount.toFixed(2)} to Commons Expenses!` });
  } catch (err: any) {
    addToast({ type: 'error', message: 'Failed to save expense: ' + err.message });
  } finally {
    submitting.value = false;
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
  if (expenses.value.length === 0) return;
  const header = ['Date', 'Member', 'Partner', 'Category', 'Description', 'Amount', 'Status', 'ReceiptId'];
  const rows = expenses.value.map(e => [
    e.date ? e.date.slice(0, 10) : '',
    `"${e.member.replace(/"/g, '""')}"`,
    e.partner,
    `"${e.category}"`,
    `"${e.description.replace(/"/g, '""')}"`,
    e.amount.toFixed(2),
    e.status,
    e.receiptImageId || ''
  ]);
  const csvContent = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Coop_Expenses_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  addToast({ type: 'success', message: 'Downloaded Co-op Expense Ledger CSV!' });
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
      "Duplicate Safeguards Active",
      `You are about to record ${itemsToImport.length} new expense(s) totaling $${totalImportAmount.value.toFixed(2)} to the Shared Commons Pool. ${duplicateCountInStaging.value} duplicate transaction(s) were recognized from your ledger and safely excluded. Proceed with import?`,
      "Yes, Import Expenses",
      "Review Candidates"
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
