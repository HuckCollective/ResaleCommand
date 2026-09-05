<template>
  <div class="space-y-8 pb-32">
    <div v-if="loadingInit" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <template v-else>
      <!-- COLLAPSIBLE PURCHASE SUMMARY & COST BREAKDOWN CARD -->
      <div class="card bg-base-100 shadow-xl border border-base-200 overflow-hidden">
        <!-- HEADER SUMMARY BAR (ALWAYS VISIBLE - CLICKABLE ACCORDION HEADER) -->
        <div 
          class="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-base-100 hover:bg-base-200/40 transition-colors select-none cursor-pointer"
          :class="{ 'border-b border-base-200 bg-base-200/20': isExpanded }"
          @click="toggleExpanded"
        >
          <!-- Left: PO Number, Vendor, Status Badge, Receipt Pill -->
          <div class="flex items-center gap-2.5 sm:gap-3 flex-wrap">
            <div class="w-6 h-6 flex items-center justify-center text-base-content/70">
              <Icon :icon="isExpanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'" class="w-5 h-5 transition-transform duration-200" />
            </div>

            <div class="flex items-center gap-2">
              <span class="font-mono font-black text-base sm:text-lg text-primary tracking-tight">
                {{ form.poNumber || (isEdit ? 'PO-PENDING' : 'New Purchase Order') }}
              </span>
              <span class="text-base-content/30 font-bold">•</span>
              <span class="font-bold text-sm sm:text-base text-base-content">
                {{ form.vendor || 'No Vendor' }}
              </span>
            </div>

            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="badge font-bold text-xs" :class="getStatusClass(form.status)">
                {{ form.status || 'Draft' }}
              </span>

              <!-- Receipt Indicator Badge -->
              <span 
                v-if="form.receiptImageId" 
                class="badge badge-sm badge-success/15 text-success border-success/30 font-semibold gap-1 py-2"
                title="Receipt image is attached and linked to this PO"
              >
                <Icon icon="solar:bill-check-bold" class="w-3.5 h-3.5" />
                Receipt
              </span>
            </div>
          </div>

          <!-- Right: Grand Total Cost, Edit Mode Toggle, Expand Chevron -->
          <div class="flex items-center justify-between md:justify-end gap-3 sm:gap-4 shrink-0">
            <div class="flex items-baseline gap-1.5 bg-base-200/70 px-3 py-1.5 rounded-xl border border-base-300/60">
              <span class="text-[11px] font-extrabold uppercase tracking-wider text-base-content/60">Cost</span>
              <span class="font-mono font-black text-lg sm:text-xl text-primary">
                ${{ computedGrandTotal.toFixed(2) }}
              </span>
            </div>

            <div class="divider divider-horizontal my-0 hidden sm:flex"></div>

            <!-- Edit Mode Toggle -->
            <div v-if="isEdit" class="flex items-center" @click.stop>
              <label class="label cursor-pointer gap-2 py-1 px-2.5 rounded-xl bg-base-200/50 hover:bg-base-200 border border-base-300/40 transition-colors">
                <span class="label-text text-xs font-bold uppercase tracking-wider text-base-content/70">Edit</span>
                <input type="checkbox" class="toggle toggle-primary toggle-sm" v-model="editMode" />
              </label>
            </div>

            <div class="w-7 h-7 flex items-center justify-center text-base-content/60">
              <Icon :icon="isExpanded ? 'solar:chevron-up-bold' : 'solar:chevron-down-bold'" class="w-5 h-5 transition-transform duration-200" />
            </div>
          </div>
        </div>

        <!-- EXPANDED CONTENT PANEL -->
        <div v-if="isExpanded" class="card-body p-4 sm:p-6 space-y-6">
          <!-- Hidden File Input for Receipt -->
          <input type="file" ref="receiptFileInput" @change="handleReceiptFileChange" accept="image/*" class="hidden" />

          <!-- 3-COLUMN RESPONSIVE LAYOUT (PO Details, Cost Breakdown, Receipt Image) -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            <!-- COLUMN 1: PO & Order Details (4 Cols on lg) -->
            <div class="lg:col-span-4 space-y-4">
              <div class="flex items-center justify-between pb-2 border-b border-base-200">
                <h3 class="font-bold text-xs uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
                  <Icon icon="solar:document-text-bold-duotone" class="w-4 h-4 text-primary" />
                  <span>Order Information</span>
                </h3>
                <span v-if="isEdit && !editMode" class="badge badge-ghost badge-xs text-[10px] font-semibold opacity-60">
                  Read Only
                </span>
              </div>

              <!-- When Read-Only (!editMode) -->
              <div v-if="isEdit && !editMode" class="space-y-3 text-sm">
                <div class="flex items-center justify-between py-1 border-b border-base-200/60">
                  <span class="text-xs opacity-60 font-medium">PO Number</span>
                  <span class="font-mono font-bold text-primary">{{ form.poNumber || 'Auto-generated' }}</span>
                </div>
                <div class="flex items-center justify-between py-1 border-b border-base-200/60">
                  <span class="text-xs opacity-60 font-medium">Vendor</span>
                  <span class="font-bold text-base-content">{{ form.vendor || 'None specified' }}</span>
                </div>
                <div class="flex items-center justify-between py-1 border-b border-base-200/60">
                  <span class="text-xs opacity-60 font-medium">Order ID</span>
                  <span class="font-mono text-xs">{{ form.orderId || 'None' }}</span>
                </div>
                <div class="flex items-center justify-between py-1 border-b border-base-200/60">
                  <span class="text-xs opacity-60 font-medium">Date</span>
                  <span class="font-semibold">{{ formatDate(form.purchaseDate) }}</span>
                </div>
                <div class="flex items-center justify-between py-1">
                  <span class="text-xs opacity-60 font-medium">Status</span>
                  <span class="badge font-bold text-xs" :class="getStatusClass(form.status)">
                    {{ form.status || 'Draft' }}
                  </span>
                </div>
              </div>

              <!-- When Editable (editMode or New PO) -->
              <div v-else class="space-y-3">
                <div class="form-control w-full">
                  <label class="label py-1"><span class="label-text text-xs font-semibold">PO Number</span></label>
                  <input type="text" v-model="form.poNumber" class="input input-sm input-bordered w-full font-mono font-bold" placeholder="Auto-generated if left blank" />
                </div>
                <div class="form-control w-full">
                  <label class="label py-1"><span class="label-text text-xs font-semibold">Vendor</span></label>
                  <input type="text" v-model="form.vendor" class="input input-sm input-bordered w-full font-medium" placeholder="e.g. ShopGoodwill, Estate Sale" />
                </div>
                <div class="form-control w-full">
                  <label class="label py-1"><span class="label-text text-xs font-semibold">External Order ID</span></label>
                  <input type="text" v-model="form.orderId" class="input input-sm input-bordered w-full font-mono text-xs" placeholder="Vendor Order ID" />
                </div>
                <div class="form-control w-full">
                  <label class="label py-1"><span class="label-text text-xs font-semibold">Purchase Date</span></label>
                  <input type="date" v-model="form.purchaseDate" class="input input-sm input-bordered w-full" />
                </div>
                <div class="form-control w-full">
                  <label class="label py-1"><span class="label-text text-xs font-semibold">Status</span></label>
                  <select v-model="form.status" class="select select-sm select-bordered w-full font-bold">
                    <option value="Draft">Draft</option>
                    <option value="Ordered">Ordered</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Received">Received</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="Returned">Returned</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- COLUMN 2: Cost Breakdown (4 Cols on lg) -->
            <div class="lg:col-span-4 bg-base-200/50 p-4 sm:p-5 rounded-2xl border border-base-300/60 space-y-3">
              <div class="flex items-center justify-between pb-2 border-b border-base-300">
                <h3 class="font-bold text-xs uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
                  <Icon icon="solar:wallet-money-bold-duotone" class="w-4 h-4 text-secondary" />
                  <span>Cost Breakdown</span>
                </h3>
                <span class="font-mono text-xs font-black text-primary">
                  Total: ${{ computedGrandTotal.toFixed(2) }}
                </span>
              </div>

              <!-- When Read-Only (!editMode) -->
              <div v-if="isEdit && !editMode" class="space-y-2.5 text-sm">
                <div class="flex justify-between items-center text-xs">
                  <span class="opacity-70">Subtotal (Items):</span>
                  <span class="font-mono font-semibold">${{ (Number(form.subtotal) || 0).toFixed(2) }}</span>
                </div>
                <div class="flex justify-between items-center text-xs">
                  <span class="opacity-70">Shipping:</span>
                  <span class="font-mono font-semibold">${{ (Number(form.shippingTotal) || 0).toFixed(2) }}</span>
                </div>
                <div class="flex justify-between items-center text-xs">
                  <span class="opacity-70">Handling:</span>
                  <span class="font-mono font-semibold">${{ (Number(form.handlingTotal) || 0).toFixed(2) }}</span>
                </div>
                <div class="flex justify-between items-center text-xs">
                  <span class="opacity-70">Sales Tax:</span>
                  <span class="font-mono font-semibold">${{ (Number(form.taxTotal) || 0).toFixed(2) }}</span>
                </div>
                <div class="flex justify-between items-center text-xs">
                  <span class="opacity-70">Fees:</span>
                  <span class="font-mono font-semibold">${{ (Number(form.feeTotal) || 0).toFixed(2) }}</span>
                </div>
                
                <div class="divider my-1.5"></div>
                
                <div class="flex justify-between items-center text-base font-black text-primary">
                  <span>Grand Total</span>
                  <span class="font-mono text-lg">${{ computedGrandTotal.toFixed(2) }}</span>
                </div>
              </div>

              <!-- When Editable (editMode or New PO) -->
              <div v-else class="space-y-3">
                <div class="form-control w-full">
                  <label class="label py-0.5"><span class="label-text text-xs font-semibold">Subtotal</span></label>
                  <label class="input input-sm input-bordered flex items-center gap-1.5 w-full">
                    <span class="opacity-50 text-xs">$</span>
                    <input type="number" step="0.01" v-model.number="form.subtotal" class="grow w-full font-mono text-sm" />
                  </label>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="form-control w-full">
                    <label class="label py-0.5"><span class="label-text text-xs font-semibold">Shipping</span></label>
                    <label class="input input-sm input-bordered flex items-center gap-1.5 w-full">
                      <span class="opacity-50 text-xs">$</span>
                      <input type="number" step="0.01" v-model.number="form.shippingTotal" class="grow w-full font-mono text-sm" />
                    </label>
                  </div>
                  <div class="form-control w-full">
                    <label class="label py-0.5"><span class="label-text text-xs font-semibold">Handling</span></label>
                    <label class="input input-sm input-bordered flex items-center gap-1.5 w-full">
                      <span class="opacity-50 text-xs">$</span>
                      <input type="number" step="0.01" v-model.number="form.handlingTotal" class="grow w-full font-mono text-sm" />
                    </label>
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="form-control w-full">
                    <label class="label py-0.5"><span class="label-text text-xs font-semibold">Tax</span></label>
                    <label class="input input-sm input-bordered flex items-center gap-1.5 w-full">
                      <span class="opacity-50 text-xs">$</span>
                      <input type="number" step="0.01" v-model.number="form.taxTotal" class="grow w-full font-mono text-sm" />
                    </label>
                  </div>
                  <div class="form-control w-full">
                    <label class="label py-0.5"><span class="label-text text-xs font-semibold">Fees</span></label>
                    <label class="input input-sm input-bordered flex items-center gap-1.5 w-full">
                      <span class="opacity-50 text-xs">$</span>
                      <input type="number" step="0.01" v-model.number="form.feeTotal" class="grow w-full font-mono text-sm" />
                    </label>
                  </div>
                </div>
                
                <div class="divider my-1.5"></div>
                
                <div class="flex justify-between items-center text-base font-black text-primary">
                  <span>Grand Total</span>
                  <span class="font-mono text-lg">${{ computedGrandTotal.toFixed(2) }}</span>
                </div>
              </div>
            </div>

            <!-- COLUMN 3: Receipt Photo & AI Verification (4 Cols on lg) -->
            <div class="lg:col-span-4 bg-base-200/30 p-4 sm:p-5 rounded-2xl border border-base-300/50 space-y-3">
              <div class="flex items-center justify-between pb-2 border-b border-base-200">
                <h3 class="font-bold text-xs uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
                  <Icon icon="solar:bill-list-bold-duotone" class="w-4 h-4 text-accent" />
                  <span>Receipt Photo</span>
                </h3>
                <span v-if="form.receiptImageId" class="badge badge-success badge-xs gap-1 font-bold">
                  Attached
                </span>
                <span v-else class="badge badge-ghost badge-xs text-[10px] opacity-60">
                  None Attached
                </span>
              </div>

              <!-- Case A: Receipt Photo Exists -->
              <div v-if="form.receiptImageId" class="space-y-3">
                <div 
                  class="relative w-full h-44 rounded-xl overflow-hidden bg-base-200 border border-base-300 shadow-sm group cursor-pointer flex items-center justify-center"
                  @click="showReceiptLightbox = true"
                  title="Click to zoom receipt"
                >
                  <img 
                    :src="getAssetUrl(form.receiptImageId)" 
                    alt="Attached Receipt" 
                    class="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                  <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white text-xs font-bold backdrop-blur-xs">
                    <Icon icon="solar:magnifer-zoom-in-bold" class="w-5 h-5" />
                    <span>Zoom In</span>
                  </div>
                  <span class="absolute top-2 left-2 badge badge-xs badge-neutral font-mono font-bold shadow-xs">
                    IRS Record
                  </span>
                </div>

                <!-- Action Controls: BEHIND EDIT TOGGLE -->
                <div v-if="isEdit && editMode" class="flex flex-wrap gap-2 pt-1">
                  <button 
                    type="button" 
                    class="btn btn-xs btn-outline btn-primary font-bold gap-1 rounded-lg" 
                    @click="receiptFileInput?.click()" 
                    :disabled="uploadingReceipt || rescanningReceipt"
                  >
                    <Icon icon="solar:upload-track-bold-duotone" class="w-3.5 h-3.5" />
                    <span>Replace</span>
                  </button>
                  <button 
                    type="button" 
                    class="btn btn-xs btn-outline btn-secondary font-bold gap-1 rounded-lg" 
                    @click="openCameraScanner" 
                    :disabled="uploadingReceipt || rescanningReceipt"
                  >
                    <Icon icon="solar:camera-bold-duotone" class="w-3.5 h-3.5" />
                    <span>Scan Receipt</span>
                  </button>
                  <button 
                    type="button" 
                    class="btn btn-xs btn-warning text-warning-content font-extrabold gap-1 rounded-lg shadow-xs" 
                    @click="rescanReceipt" 
                    :disabled="uploadingReceipt || rescanningReceipt"
                  >
                    <span v-if="rescanningReceipt" class="loading loading-spinner loading-xs"></span>
                    <Icon v-else icon="solar:magic-stick-3-bold-duotone" class="w-3.5 h-3.5" />
                    <span>Rescan AI</span>
                  </button>
                </div>

                <!-- Read-only controls when !editMode -->
                <div v-else class="flex items-center justify-between text-xs pt-1 opacity-70">
                  <button type="button" class="btn btn-xs btn-ghost gap-1 px-1 font-semibold" @click="showReceiptLightbox = true">
                    <Icon icon="solar:eye-linear" class="w-3.5 h-3.5" /> View Full Size
                  </button>
                  <span class="text-[11px] italic">Toggle Edit to change photo</span>
                </div>
              </div>

              <!-- Case B: No Receipt Attached -->
              <div v-else class="py-6 px-3 text-center border-2 border-dashed border-base-300 rounded-xl space-y-2.5 bg-base-100/50">
                <div class="w-9 h-9 mx-auto rounded-xl bg-base-200 flex items-center justify-center text-base-content/40">
                  <Icon icon="solar:bill-cross-linear" class="w-5 h-5" />
                </div>
                <div class="text-xs">
                  <div class="font-bold text-base-content">No Receipt Attached</div>
                  <p class="opacity-60 text-[11px] mt-0.5 max-w-xs mx-auto">
                    {{ editMode ? 'Upload or capture a photo of the paper receipt.' : 'Turn on Edit mode to upload or capture a receipt.' }}
                  </p>
                </div>
                <!-- Upload buttons if editMode is active -->
                <div v-if="editMode || !isEdit" class="flex justify-center gap-2 pt-1">
                  <button type="button" class="btn btn-xs btn-primary font-bold gap-1 rounded-lg" @click="receiptFileInput?.click()">
                    <Icon icon="solar:upload-track-bold-duotone" class="w-3.5 h-3.5" />
                    Upload
                  </button>
                  <button type="button" class="btn btn-xs btn-outline btn-secondary font-bold gap-1 rounded-lg" @click="openCameraScanner">
                    <Icon icon="solar:camera-bold-duotone" class="w-3.5 h-3.5" />
                    Scan with Camera
                  </button>
                </div>
              </div>
            </div>

          </div>

          <!-- Bottom Action Buttons (Delete / Save PO) inside card when Edit Mode is active -->
          <div v-if="!isEdit || editMode" class="card-actions justify-between items-center pt-4 border-t border-base-200 mt-2">
            <button v-if="isEdit" class="btn btn-sm btn-error btn-outline rounded-xl font-bold" @click="handleDelete" :disabled="saving">
              <Icon icon="solar:trash-bin-trash-bold" class="w-4 h-4" />
              Delete Purchase
            </button>
            <div v-else></div> <!-- Spacer -->
            <button class="btn btn-sm btn-primary px-6 rounded-xl font-black gap-1.5 shadow-md" @click="savePurchase" :disabled="saving">
              <span v-if="saving" class="loading loading-spinner loading-xs"></span>
              <Icon v-else icon="solar:diskette-bold" class="w-4 h-4" />
              {{ isEdit ? 'Save PO Changes' : 'Create Purchase Order' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Items Section (Only visible if Editing) -->
      <div v-if="isEdit" class="card bg-base-100 shadow-xl border border-base-200">
        <div class="card-body">
          <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 border-b border-base-200 pb-3">
            <div>
              <h2 class="card-title text-xl flex items-center gap-2">
                <Icon icon="solar:box-bold-duotone" class="w-6 h-6 text-primary" />
                <span>Linked Items &amp; Lots ({{ items.length }})</span>
              </h2>
              <p class="text-xs opacity-60 mt-0.5">
                Total Landed Inventory: ${{ items.reduce((acc, i) => acc + (Number(i.cost) || 0), 0).toFixed(2) }}
              </p>
            </div>
            
            <div class="flex items-center gap-2">
              <a 
                :href="`/inventory?search=${encodeURIComponent(form.orderId || form.poNumber || '')}`" 
                class="btn btn-sm btn-outline btn-secondary gap-1.5 shadow-sm font-bold"
                title="Open and filter all these items in Inventory Manager"
              >
                <Icon icon="solar:magnifer-linear" class="w-4 h-4" />
                <span>View in Inventory</span>
              </a>
            </div>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <!-- Link Existing Item -->
            <div class="bg-base-200 p-4 rounded-box relative">
              <h3 class="font-bold mb-2 text-sm uppercase opacity-70">Link Existing Item</h3>
              <div class="relative w-full">
                <div class="flex items-center">
                  <input 
                    type="text" 
                    v-model="itemSearchQuery" 
                    @input="handleItemSearch" 
                    @focus="showDropdown = true"
                    @blur="setTimeout(() => showDropdown = false, 200)"
                    placeholder="Search inventory by title, UPC, or ID..." 
                    class="input input-bordered w-full pr-10 text-sm"
                  />
                  <span v-if="isSearching" class="absolute right-3 loading loading-spinner loading-sm text-primary"></span>
                </div>
                
                <!-- Search Results Dropdown -->
                <ul v-if="showDropdown && searchResults.length > 0" class="menu bg-base-100 w-full rounded-box shadow-2xl border border-base-300 absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto">
                  <li v-for="res in searchResults" :key="res.$id">
                    <a @click="linkItem(res)" class="flex justify-between items-center gap-4 hover:bg-base-200">
                      <span class="truncate max-w-[80%] flex flex-col">
                        <span class="font-bold text-sm">{{ res.title }}</span>
                        <span class="font-mono text-xs opacity-60">{{ res.upc || res.identity || res.$id }}</span>
                      </span>
                      <span class="shrink-0 flex items-center gap-2">
                        <span v-if="res.purchaseId" class="badge badge-warning badge-xs">Linked</span>
                        <span class="btn btn-xs btn-primary shadow-sm" :class="{'loading': linkingItem === res.$id}">Add</span>
                      </span>
                    </a>
                  </li>
                </ul>
                
                <div v-else-if="showDropdown && itemSearchQuery.length >= 2 && !isSearching" class="absolute left-0 right-0 z-50 mt-1 p-4 bg-base-100 rounded-box shadow-xl border border-base-300 text-center opacity-70 text-xs">
                  No items found.
                </div>
              </div>
            </div>

            <!-- Quick Create New Item -->
            <div class="bg-base-200 p-4 rounded-box relative">
              <h3 class="font-bold mb-2 text-sm uppercase opacity-70">Quick Create New Item</h3>
              <div class="flex flex-col gap-3">
                <input 
                  type="text" 
                  v-model="newItem.title" 
                  placeholder="Item Title" 
                  class="input input-bordered w-full text-sm" 
                />
                <div class="flex gap-2">
                  <label class="input input-bordered flex items-center gap-2 grow text-sm">
                    $ <input type="number" step="0.01" v-model.number="newItem.cost" class="grow w-full" placeholder="Cost" />
                  </label>
                  <button @click="quickCreateItem" class="btn btn-primary shrink-0 text-sm font-bold" :disabled="creatingItem || !newItem.title">
                    <span v-if="creatingItem" class="loading loading-spinner loading-xs"></span>
                    Create & Link
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-if="loadingItems" class="py-8 text-center">
            <span class="loading loading-spinner loading-md text-primary"></span>
          </div>
          <div v-else-if="items.length === 0" class="py-8 text-center opacity-50 border-2 border-dashed border-base-300 rounded-box text-sm">
            No items are linked to this purchase yet.
          </div>
          <div v-else class="space-y-3">
            <!-- Receiving & Items Summary Toolbar -->
            <div class="flex items-center justify-between gap-2 p-3 bg-base-200/80 rounded-xl border border-base-300">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs font-black text-base-content uppercase tracking-wider">
                  {{ items.length }} Line Item(s)
                </span>
                <span class="badge badge-sm badge-neutral font-mono font-bold">
                  Landed Cost: ${{ itemsTotalCost.toFixed(2) }}
                </span>
              </div>
            </div>

            <!-- MOBILE VIEW: Tactile Ergonomic Cards (block md:hidden) -->
            <div class="space-y-3 block md:hidden">
              <div 
                v-for="item in items" 
                :key="'mob-' + item.$id" 
                class="p-3.5 rounded-2xl bg-base-100 border border-base-300 shadow-xs space-y-3"
              >
                <!-- Top Row: Photo, Title, Badges -->
                <div class="flex items-start gap-3">
                  <div 
                    class="w-16 h-16 rounded-xl overflow-hidden bg-base-200/80 border border-base-300 flex flex-col items-center justify-center shrink-0 relative cursor-pointer group" 
                    @click="openEditItem(item)"
                    title="Tap to open ItemDrawer"
                  >
                    <img 
                      v-if="getItemImage(item) && !failedImages[item.$id]" 
                      :src="getItemImage(item)" 
                      class="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                      alt="Item Thumbnail"
                      @error="failedImages[item.$id] = true" 
                    />
                    <div v-else class="flex flex-col items-center justify-center text-center p-1 text-base-content/40">
                      <Icon icon="solar:camera-broken" class="w-6 h-6" />
                      <span class="text-[9px] font-bold mt-0.5 leading-none">No Photo</span>
                    </div>
                  </div>

                  <div class="flex-1 min-w-0 space-y-1">
                    <h4 
                      class="font-bold text-sm text-base-content leading-snug line-clamp-2 cursor-pointer hover:text-primary transition-colors"
                      @click="openEditItem(item)"
                    >
                      {{ item.title }}
                    </h4>
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span v-if="item.upc" class="badge badge-xs badge-neutral font-mono">{{ item.upc }}</span>
                      <span v-else-if="item.identity" class="font-mono text-[11px] opacity-60">{{ item.identity }}</span>
                      <div class="badge badge-xs" :class="item.status === 'in-stock' ? 'badge-success text-success-content font-bold' : (item.status === 'sold' ? 'badge-info' : (item.status === 'placed' ? 'badge-primary' : 'badge-ghost'))">
                        {{ item.status || 'acquired' }}
                      </div>
                      <span v-if="item.storageLocation" class="badge badge-xs badge-outline font-mono">{{ item.storageLocation }}</span>
                      <span v-if="item.quantity > 1 || item.title?.toLowerCase().startsWith('lot of')" class="badge badge-xs badge-secondary font-bold">Lot ({{ item.quantity }})</span>
                    </div>
                  </div>
                </div>

                <!-- Financial Row: Landed Cost & Resale Price -->
                <div class="flex items-center justify-between p-2.5 rounded-xl bg-base-200/60 text-xs">
                  <div>
                    <span class="opacity-60 block text-[10px] uppercase font-bold">Landed Cost</span>
                    <span class="font-mono font-bold text-base-content text-sm">${{ (Number(item.cost) || 0).toFixed(2) }}</span>
                  </div>
                  <div class="text-right">
                    <span class="opacity-60 block text-[10px] uppercase font-bold">Resale Price</span>
                    <span class="font-mono font-extrabold text-success text-sm">
                      {{ item.resalePrice ? '$' + Number(item.resalePrice).toFixed(2) : (item.listPrice ? '$' + Number(item.listPrice).toFixed(2) : 'Not Set') }}
                    </span>
                  </div>
                </div>

                <!-- Action Button Cluster -->
                <div class="flex items-center gap-2 pt-1 border-t border-base-200">
                  <button 
                    class="btn btn-sm btn-primary text-primary-content font-black gap-1.5 flex-1 h-9 rounded-xl shadow-xs" 
                    @click="openEditItem(item)"
                    title="Open ItemDrawer with AI Deep Research, Lot Tools, and Details"
                  >
                    <Icon icon="solar:pen-linear" class="w-4 h-4" />
                    <span>Update</span>
                  </button>

                  <button 
                    v-if="item.status !== 'in-stock' && item.status !== 'placed' && item.status !== 'sold'" 
                    class="btn btn-sm btn-success text-success-content font-bold gap-1 flex-1 h-9 rounded-xl shadow-xs" 
                    @click="receiveToStock(item, 'Backstock')"
                    title="Receive into Backstock"
                  >
                    <Icon icon="solar:check-circle-bold" class="w-4 h-4" />
                    <span>Receive</span>
                  </button>
                  <div v-else class="badge badge-success badge-sm text-success-content font-bold gap-1 px-2.5 h-9 rounded-xl">
                    <Icon icon="solar:check-circle-bold" class="w-3.5 h-3.5" />
                    <span>In-Stock</span>
                  </div>

                  <button 
                    class="btn btn-sm btn-ghost text-error btn-square h-9 w-9 rounded-xl shrink-0" 
                    @click="unlinkItem(item)" 
                    :disabled="linkingItem === item.$id"
                    title="Unlink Item"
                  >
                    <Icon icon="solar:trash-bin-trash-linear" class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <!-- DESKTOP VIEW: Full Table (hidden md:block) -->
            <div class="hidden md:block overflow-x-auto border border-base-200 rounded-box">
              <table class="table table-sm table-zebra w-full">
                <thead>
                  <tr>
                    <th class="w-16">Photo</th>
                    <th>Item Details</th>
                    <th>Cost (Landed)</th>
                    <th>Resale Price</th>
                    <th>Status</th>
                    <th class="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in items" :key="item.$id" class="hover:bg-base-200/50">
                    <td>
                      <div 
                        class="w-12 h-12 rounded-lg overflow-hidden bg-base-200/80 border border-base-300 flex flex-col items-center justify-center shrink-0 cursor-pointer relative group"
                        @click="openEditItem(item)"
                        title="Tap to open ItemDrawer"
                      >
                        <img 
                          v-if="getItemImage(item) && !failedImages[item.$id]" 
                          :src="getItemImage(item)" 
                          class="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                          alt="Item Thumbnail"
                          @error="failedImages[item.$id] = true" 
                        />
                        <div v-else class="flex flex-col items-center justify-center text-center text-base-content/40">
                          <Icon icon="solar:camera-broken" class="w-5 h-5" />
                        </div>
                      </div>
                    </td>
                    <td>
                      <div class="flex flex-col gap-0.5">
                        <span 
                          class="font-bold text-sm text-base-content cursor-pointer hover:text-primary transition-colors"
                          @click="openEditItem(item)"
                        >
                          {{ item.title }}
                        </span>
                        <div class="flex items-center gap-2 flex-wrap">
                          <span v-if="item.upc" class="badge badge-xs badge-neutral font-mono">{{ item.upc }}</span>
                          <span v-else-if="item.identity" class="font-mono text-xs opacity-60">{{ item.identity }}</span>
                          <span v-if="item.storageLocation" class="badge badge-xs badge-outline font-mono">{{ item.storageLocation }}</span>
                          <span v-if="item.quantity > 1 || item.title?.toLowerCase().startsWith('lot of')" class="badge badge-xs badge-secondary font-bold">Lot ({{ item.quantity }})</span>
                          <span v-if="item.parentLotId" class="badge badge-xs badge-accent">Extracted Component</span>
                        </div>
                      </div>
                    </td>
                    <td class="font-mono font-medium">${{ (Number(item.cost) || 0).toFixed(2) }}</td>
                    <td class="font-mono font-medium text-success">
                      {{ item.resalePrice ? '$' + Number(item.resalePrice).toFixed(2) : (item.listPrice ? '$' + Number(item.listPrice).toFixed(2) : '-') }}
                    </td>
                    <td>
                      <div class="badge badge-sm" :class="item.status === 'in-stock' ? 'badge-success text-success-content font-bold' : (item.status === 'sold' ? 'badge-info' : (item.status === 'placed' ? 'badge-primary' : 'badge-ghost'))">
                        {{ item.status || 'acquired' }}
                      </div>
                    </td>
                    <td class="text-right">
                      <div class="flex items-center justify-end gap-1.5 flex-wrap">
                        <button 
                          v-if="item.status !== 'in-stock' && item.status !== 'placed' && item.status !== 'sold'" 
                          class="btn btn-xs btn-ghost text-success hover:bg-success/20 font-bold gap-0.5" 
                          @click="receiveToStock(item, 'Backstock')"
                          title="Receive into Backstock"
                        >
                          <Icon icon="solar:check-circle-linear" class="w-3.5 h-3.5" />
                          <span>Receive</span>
                        </button>
                        <button class="btn btn-xs btn-outline btn-primary gap-1 font-bold" @click="openEditItem(item)">
                          <Icon icon="solar:pen-linear" class="w-3.5 h-3.5" />
                          <span>Update</span>
                        </button>
                        <button class="btn btn-xs btn-error btn-outline" @click="unlinkItem(item)" :disabled="linkingItem === item.$id">
                          <span v-if="linkingItem === item.$id" class="loading loading-spinner loading-xs"></span>
                          <span v-else>Unlink</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- Operating Expenses Section -->
      <div v-if="isEdit" class="card bg-base-100 shadow-xl border border-base-200">
        <div class="card-body">
          <div class="flex justify-between items-center mb-1">
            <h2 class="card-title text-xl">Operating Expenses</h2>
            <button 
              type="button"
              @click="showTaxGuide = true" 
              class="btn btn-xs btn-ghost text-info hover:bg-info/10 font-bold gap-1 rounded-xl"
              title="View Resale Tax & Deductions Guide"
            >
              <Icon icon="solar:info-circle-bold" class="w-4 h-4" />
              <span>Tax & Deductions Guide</span>
            </button>
          </div>
          <p class="text-xs sm:text-sm opacity-70 mb-4">These are kept strictly separate from the Cost of Goods Sold (Subtotal/Shipping/Tax) for accurate accounting.</p>
          
          <div class="bg-base-200 p-4 rounded-box mb-6 space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3 class="font-bold text-xs sm:text-sm uppercase opacity-70">Add Misc Expense</h3>
              <!-- Smart Trip Type Indicator / Switcher -->
              <div class="flex items-center gap-1 bg-base-100 p-0.5 rounded-lg border border-base-300 text-[11px] font-bold">
                <button 
                  type="button" 
                  @click="expenseTypeOverride = 'online'" 
                  class="btn btn-xs rounded-md" 
                  :class="isOnlineTrip ? 'btn-primary font-black' : 'btn-ghost opacity-70'"
                >
                  🌐 Online Order
                </button>
                <button 
                  type="button" 
                  @click="expenseTypeOverride = 'in-person'" 
                  class="btn btn-xs rounded-md" 
                  :class="!isOnlineTrip ? 'btn-primary font-black' : 'btn-ghost opacity-70'"
                >
                  🚗 In-Person Trip
                </button>
              </div>
            </div>

            <!-- Smart Suggestions Chips -->
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-[11px] font-bold opacity-50">Quick Fill:</span>
              <button 
                v-for="sug in currentSuggestions" 
                :key="sug.label"
                type="button"
                @click="applySuggestion(sug)"
                class="badge badge-sm badge-ghost hover:badge-primary cursor-pointer font-bold text-[11px] transition-all"
              >
                {{ sug.label }}
              </button>
            </div>

            <!-- Responsive Input Row (Never Busts Container) -->
            <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input 
                v-model="newExpenseNote" 
                class="input input-sm input-bordered grow text-xs sm:text-sm" 
                :placeholder="isOnlineTrip ? 'e.g. Packing Boxes, Insurance' : 'e.g. Gas, Parking, Lunch'" 
              />
              <div class="flex items-center gap-1.5 shrink-0">
                <label class="input input-sm input-bordered flex items-center gap-1 w-28 text-xs sm:text-sm">
                  <span class="opacity-60 font-bold">$</span>
                  <input 
                    v-model.number="newExpenseAmount" 
                    type="number" 
                    step="0.01" 
                    placeholder="Amount" 
                    class="w-full text-xs sm:text-sm font-mono" 
                    @keydown.enter="handleAddExpense"
                  />
                </label>
                <button 
                  @click="handleAddExpense" 
                  class="btn btn-sm btn-primary font-bold px-3 shrink-0 shadow-xs" 
                  :disabled="!newExpenseAmount || loadingExpenses"
                  title="Add Operating Expense"
                >
                  <span v-if="loadingExpenses" class="loading loading-spinner loading-xs"></span>
                  <Icon v-else icon="solar:add-circle-bold" class="w-4 h-4" />
                  <span class="text-xs">Add</span>
                </button>
              </div>
            </div>
          </div>
          
          <div v-if="loadingExpenses && expenses.length === 0" class="py-4 text-center">
             <span class="loading loading-spinner loading-md"></span>
          </div>
          <div v-else-if="expenses.length === 0" class="py-4 text-center opacity-50 border-2 border-dashed border-base-300 rounded-box">
             No operating expenses recorded for this trip.
          </div>
          <div v-else>
              <ul class="menu bg-base-100 border border-base-200 w-full rounded-box">
                  <li v-for="exp in expenses" :key="exp.$id">
                      <div class="flex justify-between items-center hover:bg-base-200">
                          <span>{{ exp.note || 'Expense' }}</span>
                          <div class="flex items-center gap-4">
                              <span class="font-bold text-warning">${{ exp.amount.toFixed(2) }}</span>
                              <button @click="handleRemoveExpense(exp.$id)" class="btn btn-ghost btn-xs text-error p-1 min-h-0 h-auto">
                                  <Icon icon="solar:trash-bin-trash-linear" class="w-4 h-4" />
                              </button>
                          </div>
                      </div>
                  </li>
              </ul>
              <div class="text-right font-bold mt-4 text-lg">
                 Total Expenses: <span class="text-warning">${{ totalExpenses.toFixed(2) }}</span>
              </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Item Edit Drawer -->
    <ItemDrawer 
      v-if="activeEditItem" 
      :item="activeEditItem" 
      :isOpen="!!activeEditItem" 
      @close="closeEditDrawer" 
      @save="handleSavedItem" 
    />

    <!-- Resale Tax & Deductions Playbook Modal -->
    <dialog class="modal modal-bottom sm:modal-middle" :class="{ 'modal-open': showTaxGuide }">
      <div class="modal-box max-w-xl space-y-4">
        <div class="flex items-center justify-between border-b border-base-200 pb-2">
          <div class="flex items-center gap-2">
            <Icon icon="solar:calculator-bold-duotone" class="w-6 h-6 text-primary" />
            <h3 class="font-black text-lg">Resale Tax & Deductions Playbook</h3>
          </div>
          <button class="btn btn-sm btn-circle btn-ghost" @click="showTaxGuide = false">✕</button>
        </div>

        <div class="space-y-3 text-xs sm:text-sm text-base-content/80 max-h-[65vh] overflow-y-auto pr-1">
          <!-- Section 1 -->
          <div class="p-3.5 bg-base-200/70 rounded-2xl space-y-1.5 border border-base-300">
            <h4 class="font-extrabold text-base-content flex items-center gap-1.5 text-sm">
              <Icon icon="solar:check-circle-bold" class="w-4 h-4 text-success" />
              Pure Expense POs (Zero Inventory)
            </h4>
            <p class="leading-relaxed">A Purchase Order doesn't need resale items! POs for supplies (Uline, Amazon), booth fixtures (Home Depot, IKEA), software, or "dry" sourcing trips (where you bought 0 items but paid parking & gas) are 100% tax-deductible business operating expenses.</p>
          </div>

          <!-- Section 2 -->
          <div class="p-3.5 bg-base-200/70 rounded-2xl space-y-1.5 border border-base-300">
            <h4 class="font-extrabold text-base-content flex items-center gap-1.5 text-sm">
              <Icon icon="solar:hand-money-bold" class="w-4 h-4 text-warning" />
              Cash Purchases Without Receipts (IRS Cohan Rule)
            </h4>
            <p class="leading-relaxed">Under the IRS <em>Cohan Rule</em>, printed register receipts are not strictly required for cash buys (Craigslist, Marketplace, estate sales) as long as you log:</p>
            <ul class="list-disc list-inside space-y-1 opacity-90 pl-1">
              <li><strong>Date</strong> and <strong>Cash Amount Paid</strong></li>
              <li><strong>Item Description</strong> (e.g. <em>"Vintage glass showcase and 2 chrome racks"</em>)</li>
              <li><strong>Source/Vendor</strong> (e.g. <em>"Craigslist seller in Portland"</em>)</li>
              <li><strong>Business Purpose</strong> (e.g. <em>"Display fixtures for Memory Den booth"</em>)</li>
              <li><em>Pro-Tip: Snap a quick photo of the rack/case in your booth or backstock as proof!</em></li>
            </ul>
          </div>

          <!-- Section 3 -->
          <div class="p-3.5 bg-base-200/70 rounded-2xl space-y-1.5 border border-base-300">
            <h4 class="font-extrabold text-base-content flex items-center gap-1.5 text-sm">
              <Icon icon="solar:tag-bold" class="w-4 h-4 text-primary" />
              Immediate 100% Write-Offs (De Minimis Safe Harbor)
            </h4>
            <p class="leading-relaxed">Under IRS Safe Harbor (§ 1.263(a)-1(f)), display racks, shelving, mannequins, and showcases under <strong>$2,500 each</strong> do not need to be depreciated over 7 years—they can be written off 100% in the current tax year!</p>
          </div>
        </div>

        <div class="modal-action">
          <button class="btn btn-sm btn-primary font-bold px-6 rounded-xl" @click="showTaxGuide = false">Got It</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showTaxGuide = false">
        <button>close</button>
      </form>
    </dialog>

    <!-- Receipt Full-Size Lightbox Modal -->
    <dialog class="modal modal-bottom sm:modal-middle" :class="{ 'modal-open': showReceiptLightbox }">
      <div class="modal-box max-w-4xl p-3 sm:p-5 bg-base-100/95 backdrop-blur-xl border border-base-300 shadow-2xl rounded-3xl space-y-3">
        <div class="flex items-center justify-between pb-2 border-b border-base-200">
          <div class="font-black text-sm sm:text-base flex items-center gap-2">
            <Icon icon="solar:bill-list-bold-duotone" class="w-5 h-5 text-primary" />
            <span>Receipt Photo — {{ form.poNumber || 'PO' }}</span>
          </div>
          <button type="button" class="btn btn-sm btn-circle btn-ghost" @click="showReceiptLightbox = false">✕</button>
        </div>
        <div class="flex items-center justify-center max-h-[72vh] overflow-auto bg-base-200/40 rounded-2xl p-2">
          <img 
            v-if="form.receiptImageId" 
            :src="getAssetUrl(form.receiptImageId)" 
            alt="Full Receipt" 
            class="max-w-full max-h-[68vh] object-contain rounded-xl shadow-md" 
          />
        </div>
        <div class="modal-action pt-2 border-t border-base-200 flex justify-between items-center m-0">
          <button type="button" class="btn btn-sm btn-warning text-warning-content font-extrabold gap-1.5 rounded-xl shadow-xs" @click="showReceiptLightbox = false; rescanReceipt();">
            <Icon icon="solar:magic-stick-3-bold-duotone" class="w-4 h-4" />
            Rescan with AI
          </button>
          <button type="button" class="btn btn-sm btn-ghost rounded-xl font-bold" @click="showReceiptLightbox = false">Close</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showReceiptLightbox = false">
        <button>close</button>
      </form>
    </dialog>

    <!-- In-App Camera Scanner Widget for live receipt photos with alignment viewfinder box -->
    <ScannerWidget ref="scannerWidget" :hide-all-triggers="true" overlay-mode="receipt" @photos-captured="handleCapturedReceiptPhotos" />

    <!-- TACTILE FIXED BOTTOM DOCK (MOBILE-FIRST ERGONOMIC CLUSTER) -->
    <div v-if="isEdit" class="fixed bottom-0 inset-x-0 z-40 bg-base-100/90 backdrop-blur-md border-t border-base-300/80 px-4 py-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shadow-2xl transition-all">
      <div class="max-w-4xl mx-auto flex items-center justify-between gap-2.5">
        <!-- Action 1: Delete PO -->
        <button 
          class="btn btn-sm btn-ghost text-error hover:bg-error/10 border border-error/20 font-bold rounded-2xl gap-1.5 h-10 px-3.5"
          @click="handleDelete"
          :disabled="saving"
          title="Delete this Purchase Order"
        >
          <Icon icon="solar:trash-bin-trash-bold" class="w-4 h-4" />
          <span class="text-xs sm:text-sm">Delete PO</span>
        </button>

        <div class="flex items-center gap-2">
          <!-- Action 2: Receive All to Backstock -->
          <button 
            v-if="hasUnreceivedItems" 
            @click="receiveAllToStock('Backstock')" 
            class="btn btn-sm btn-success text-success-content font-black rounded-2xl shadow-md gap-1.5 h-10 px-4 active:scale-95 transition-all"
            title="Receive all unreceived items into Backstock"
          >
            <Icon icon="solar:check-circle-bold" class="w-4 h-4" />
            <span class="text-xs sm:text-sm">Receive All</span>
          </button>

          <!-- Action 3: Save PO Changes (when in edit mode) -->
          <button 
            v-if="editMode" 
            @click="savePurchase" 
            :disabled="saving"
            class="btn btn-sm btn-primary text-primary-content font-black rounded-2xl shadow-md gap-1.5 h-10 px-4 active:scale-95 transition-all"
          >
            <span v-if="saving" class="loading loading-spinner loading-xs"></span>
            <Icon v-else icon="solar:diskette-bold" class="w-4 h-4" />
            <span class="text-xs sm:text-sm">Save PO</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { purchasesAPI, getPurchasesCollectionId } from '../../lib/purchases';
import { getItemsByPurchaseId, searchItems, linkItemToPurchase, updateInventoryItem, BUCKET_ID, getCollectionId } from '../../lib/inventory';
import { databases, storage, client, ID } from '../../lib/appwrite';
import { Query } from 'appwrite';
import { useAuth } from '../../composables/useAuth';
import { useLoader } from '../../composables/useLoader';
import { confirmDialog } from '../../stores/confirm';
import { addToast } from '../../stores/toast';
import { Icon } from '@iconify/vue';
import ItemDrawer from '../common/ItemDrawer.vue';
import ScannerWidget from '../common/ScannerWidget.vue';

const { currentTeam } = useAuth();
const { showLoader, hideLoader } = useLoader();

const props = defineProps({
    purchaseId: {
        type: String,
        default: null
    }
});

const ENDPOINT = import.meta.env.PUBLIC_APPWRITE_ENDPOINT;
const PROJECT = import.meta.env.PUBLIC_APPWRITE_PROJECT_ID;
const BUCKET = BUCKET_ID;

const scannerWidget = ref(null);
const receiptFileInput = ref(null);
const uploadingReceipt = ref(false);
const rescanningReceipt = ref(false);
const showReceiptLightbox = ref(false);

const proxify = (url) => {
    if (!url) return null;
    if (typeof url !== 'string') return url;
    if (url.startsWith('blob:') || url.startsWith('data:') || url.includes('/api/proxy-image')) return url;
    if (url.includes('/storage/buckets/')) return url;
    if (url.startsWith('http')) return `/api/proxy-image?url=${encodeURIComponent(url)}`;
    return url;
};

const getAssetUrl = (id) => {
    if (!id) return '';
    if (typeof id === 'string' && (id.startsWith('http') || id.startsWith('data:') || id.startsWith('blob:') || id.startsWith('/api/'))) {
        return proxify(id);
    }
    return `${ENDPOINT}/storage/buckets/${BUCKET}/files/${id}/view?project=${PROJECT}`;
};

const getItemImage = (item) => {
    if (!item) return null;
    if (item.imageId) return getAssetUrl(item.imageId);
    if (item.imageUrl) return getAssetUrl(item.imageUrl);
    if (item.galleryImageIds && item.galleryImageIds.length > 0) return getAssetUrl(item.galleryImageIds[0]);
    if (item.conditionNotes) {
        const match = item.conditionNotes.match(/\[MAIN IMAGE ID: ([^\]]+)\]/);
        if (match) return getAssetUrl(match[1].split(',')[0].trim());
    }
    return null;
};

const failedImages = ref({});

const activeEditItem = ref(null);
const openEditItem = (item) => {
    activeEditItem.value = item;
};
const closeEditDrawer = () => {
    activeEditItem.value = null;
};
const handleSavedItem = async (payload) => {
    if (!activeEditItem.value) return;
    const editingId = activeEditItem.value.$id;
    showLoader("Saving Item...", {
        step: "Uploading media & updating item...",
        basket: 'solar:diskette-bold-duotone',
        cancelable: false
    });
    try {
        if (payload) {
            await updateInventoryItem(editingId, payload);
            delete failedImages.value[editingId];
            addToast(`Item "${payload.title || activeEditItem.value.title}" saved successfully!`, 'success');
        }
    } catch (e) {
        console.error("Failed to save item from drawer:", e);
        addToast("Failed to save item: " + e.message, "error");
    } finally {
        hideLoader();
        activeEditItem.value = null;
        await loadLinkedItems();
        delete failedImages.value[editingId];
    }
};

const isEdit = computed(() => !!props.purchaseId);
const editMode = ref(!props.purchaseId);
const isExpanded = ref(false);
const loadingInit = ref(false);
const saving = ref(false);

const toggleExpanded = () => {
    isExpanded.value = !isExpanded.value;
};

watch(editMode, (val) => {
    if (val) {
        isExpanded.value = true;
    }
});

const getStatusClass = (status) => {
    switch (status?.toLowerCase()) {
        case 'pending': return 'badge-warning text-warning-content';
        case 'ordered': return 'badge-info text-info-content';
        case 'shipped': return 'badge-info text-info-content';
        case 'received': return 'badge-success text-success-content';
        case 'returned': return 'badge-error text-error-content';
        case 'cancelled': return 'badge-error text-error-content';
        default: return 'badge-ghost';
    }
};

const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'N/A';
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return 'N/A';
    }
};

const form = ref({
    poNumber: '',
    vendor: '',
    orderId: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    status: 'Draft',
    subtotal: 0,
    shippingTotal: 0,
    handlingTotal: 0,
    taxTotal: 0,
    feeTotal: 0,
    receiptImageId: ''
});

const computedGrandTotal = computed(() => {
    return (form.value.subtotal || 0) + 
           (form.value.shippingTotal || 0) + 
           (form.value.handlingTotal || 0) + 
           (form.value.taxTotal || 0) + 
           (form.value.feeTotal || 0);
});

// --- Operating Expenses & Smart Suggestions State ---
const expenses = ref([]);
const loadingExpenses = ref(false);
const newExpenseNote = ref('');
const newExpenseAmount = ref('');
const totalExpenses = computed(() => expenses.value.reduce((sum, e) => sum + (e.amount || 0), 0));

const showTaxGuide = ref(false);
const expenseTypeOverride = ref(null);
const isOnlineTrip = computed(() => {
    if (expenseTypeOverride.value) return expenseTypeOverride.value === 'online';
    return (Number(form.value.shippingTotal || form.value.shippingCost || 0) > 0) || 
           /goodwill|ebay|poshmark|mercari|online|auction/i.test(form.value.vendor || '');
});

const onlineExpenseSuggestions = [
    { label: '📦 Packing Boxes', note: 'Packing Boxes & Supplies' },
    { label: '🛡️ Insurance', note: 'Shipping Insurance Fee' },
    { label: '🏷️ Mailers & Tape', note: 'Bubble Mailers & Tape' },
    { label: '⚠️ Surcharge', note: 'Shipping / Handling Surcharge' }
];

const inPersonExpenseSuggestions = [
    { label: '🚗 Gas & Mileage', note: 'Gas / Mileage for Trip' },
    { label: '🅿️ Parking / Toll', note: 'Parking & Toll Fees' },
    { label: '🍔 Lunch / Meals', note: 'Lunch / Sourcing Meals' },
    { label: '🛒 Cart / Entry', note: 'Bins Cart / Estate Entry Fee' }
];

const currentSuggestions = computed(() => isOnlineTrip.value ? onlineExpenseSuggestions : inPersonExpenseSuggestions);

const applySuggestion = (sug) => {
    newExpenseNote.value = sug.note;
};

// Items State
const items = ref([]);
const itemsWithPhotosCount = computed(() => items.value.filter(i => getItemImage(i)).length);
const itemsTotalCost = computed(() => items.value.reduce((sum, i) => sum + (Number(i.cost) || 0), 0));
const hasUnreceivedItems = computed(() => items.value.some(i => i.status !== 'in-stock' && i.status !== 'placed' && i.status !== 'sold'));
const batchAiRunning = ref(false);
const aiProcessingId = ref(null);

const runItemAiDeepReceive = async (item) => {
    const imgUrl = getItemImage(item);
    if (!imgUrl) {
        addToast('No photo available for this item to run AI Deep Receive', 'warning');
        return;
    }
    aiProcessingId.value = item.$id;
    showLoader('AI Deep Receiving item...', { step: 'Identifying item, estimating boutique price & tag' });
    try {
        const res = await fetch('/api/identify-item', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imageUrl: imgUrl,
                title: item.title,
                notes: `Landed cost: $${item.cost || 0}. Please enrich title, suggest boutique booth retail price, category, brand, and tag_title (30-42 chars max).`
            })
        });
        const data = await res.json();
        if (data.items && data.items.length > 0) {
            const detected = data.items[0];
            const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
            const collId = getCollectionId();
            
            let suggestedPrice = item.resalePrice || (item.cost ? Math.round(item.cost * 3.5) : 0);
            if (detected.price_breakdown?.boutique_premium) {
                const matches = detected.price_breakdown.boutique_premium.match(/([0-9.]+)/);
                if (matches) suggestedPrice = parseFloat(matches[1]);
            }

            const updates = {
                title: detected.title || item.title,
                tag_title: (detected.tag_title || detected.title || '').slice(0, 42),
                brand: detected.brand || item.brand || '',
                category: detected.category || item.category || '',
                resalePrice: suggestedPrice,
                condition: detected.condition_notes || item.condition || ''
            };
            Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);
            
            await databases.updateDocument(DB_ID, collId, item.$id, updates);
            addToast(`AI Deep Received: ${updates.tag_title || updates.title}`, 'success');
            await loadLinkedItems();
        } else {
            addToast('AI could not identify item from photo.', 'warning');
        }
    } catch (e) {
        console.error('AI Deep Receive failed:', e);
        addToast('AI Deep Receive failed: ' + e.message, 'error');
    } finally {
        hideLoader();
        aiProcessingId.value = null;
    }
};

const runBatchAiDeepReceive = async () => {
    const itemsWithPhotos = items.value.filter(i => getItemImage(i));
    if (itemsWithPhotos.length === 0) {
        addToast('No items with photos to AI receive in this purchase.', 'info');
        return;
    }
    batchAiRunning.value = true;
    showLoader(`AI Deep Receiving ${itemsWithPhotos.length} items...`);
    let count = 0;
    for (const item of itemsWithPhotos) {
        try {
            await runItemAiDeepReceive(item);
            count++;
        } catch (e) {
            console.warn(e);
        }
    }
    hideLoader();
    batchAiRunning.value = false;
    addToast(`AI Deep Received ${count} item(s)!`, 'success');
};

const receiveToStock = async (item, location = 'Backstock') => {
    const ok = await confirmDialog(
        `Receive "${item.tag_title || item.title}" into active inventory stored in Backstock? This marks the item as "In-Stock" and makes it ready for pricing, tagging, and retail booth deployment.`,
        'Receive Item to Backstock',
        'Receive to Backstock',
        'Cancel',
        'btn-success'
    );
    if (!ok) return;

    const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
    const collId = getCollectionId();
    try {
        await databases.updateDocument(DB_ID, collId, item.$id, {
            status: 'in-stock',
            storageLocation: item.storageLocation || location
        });
        addToast(`Received "${item.tag_title || item.title}" into Backstock!`, 'success');
        await loadLinkedItems();
    } catch (e) {
        addToast(`Failed to receive item: ${e.message}`, 'error');
    }
};

const receiveAllToStock = async (location = 'Backstock') => {
    if (items.value.length === 0) return;
    const ok = await confirmDialog(
        `This will activate all ${items.value.length} item(s) in this Purchase Order to "In-Stock" status stored in Backstock, and mark this PO as "Received". Once in Backstock, items are ready for inventory tracking and retail booth deployment.`,
        'Receive Entire Haul to Backstock',
        'Receive All to Backstock',
        'Cancel',
        'btn-success'
    );
    if (!ok) return;

    showLoader('Activating items into Backstock...');
    try {
        const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
        const collId = getCollectionId();
        await Promise.all(items.value.map(item => 
            databases.updateDocument(DB_ID, collId, item.$id, {
                status: 'in-stock',
                storageLocation: item.storageLocation || location
            })
        ));
        if (props.purchaseId) {
            await purchasesAPI.updatePurchase(props.purchaseId, { status: 'Received' });
            form.value.status = 'Received';
        }
        addToast(`All ${items.value.length} items are now In-Stock (Backstock)!`, 'success');
        await loadLinkedItems();
    } catch (e) {
        addToast(`Failed to activate items: ${e.message}`, 'error');
    } finally {
        hideLoader();
    }
};
const loadingItems = ref(false);
const itemSearchQuery = ref('');
const searchResults = ref([]);
const searchTimeout = ref(null);
const isSearching = ref(false);
const showDropdown = ref(false);
const linkingItem = ref(null);

const creatingItem = ref(false);
const newItem = ref({
    title: '',
    cost: null
});

onMounted(async () => {
    if (isEdit.value) {
        loadingInit.value = true;
        showLoader("Loading Purchase Details...");
        try {
            // Appwrite doesn't have a simple getDocument without the DB/Coll ID exposed in purchasesAPI,
            // so we do a listPurchases with a filter by ID.
            const res = await purchasesAPI.listPurchases([Query.equal('$id', props.purchaseId)]);
            if (res.documents.length > 0) {
                const p = res.documents[0];
                form.value = {
                    poNumber: p.poNumber || '',
                    vendor: p.vendor || '',
                    orderId: p.orderId || '',
                    purchaseDate: p.purchaseDate ? p.purchaseDate.split('T')[0] : '',
                    status: p.status || 'Draft',
                    subtotal: p.subtotal || 0,
                    shippingTotal: p.shippingTotal || 0,
                    handlingTotal: p.handlingTotal || 0,
                    taxTotal: p.taxTotal || 0,
                    feeTotal: p.feeTotal || 0,
                    receiptImageId: p.receiptImageId || ''
                };
                
                await Promise.all([
                    loadLinkedItems(),
                    loadExpenses()
                ]);
                initRealtime();
            }
        } catch (e) {
            console.error('Failed to load purchase', e);
        } finally {
            loadingInit.value = false;
            hideLoader();
        }
    }
});

let realtimeUnsubscribes = [];

const initRealtime = () => {
    if (!props.purchaseId) return;
    if (realtimeUnsubscribes.length > 0) return;
    
    try {
        const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
        const PURCHASES_COL = getPurchasesCollectionId();
        const ITEMS_COL = getCollectionId();

        // 1. Live update Purchase Order header
        const poSub = client.subscribe(
            `databases.${DB_ID}.collections.${PURCHASES_COL}.documents.${props.purchaseId}`,
            (response) => {
                const doc = response.payload;
                if (!doc || doc.$id !== props.purchaseId) return;
                
                if (!editMode.value) {
                    form.value = {
                        ...form.value,
                        poNumber: doc.poNumber || form.value.poNumber,
                        vendor: doc.vendor || form.value.vendor,
                        orderId: doc.orderId || form.value.orderId,
                        purchaseDate: doc.purchaseDate ? doc.purchaseDate.split('T')[0] : form.value.purchaseDate,
                        status: doc.status || form.value.status,
                        subtotal: doc.subtotal !== undefined ? doc.subtotal : form.value.subtotal,
                        shippingTotal: doc.shippingTotal !== undefined ? doc.shippingTotal : form.value.shippingTotal,
                        handlingTotal: doc.handlingTotal !== undefined ? doc.handlingTotal : form.value.handlingTotal,
                        taxTotal: doc.taxTotal !== undefined ? doc.taxTotal : form.value.taxTotal,
                        feeTotal: doc.feeTotal !== undefined ? doc.feeTotal : form.value.feeTotal,
                        receiptImageId: doc.receiptImageId || form.value.receiptImageId
                    };
                }
            }
        );
        realtimeUnsubscribes.push(poSub);

        // 2. Live update items linked to this purchase
        const itemsSub = client.subscribe(
            `databases.${DB_ID}.collections.${ITEMS_COL}.documents`,
            (response) => {
                const isCreate = response.events.some(e => e.endsWith('.create'));
                const isUpdate = response.events.some(e => e.endsWith('.update'));
                const isDelete = response.events.some(e => e.endsWith('.delete'));
                const doc = response.payload;
                if (!doc || !doc.$id) return;

                const belongsToPo = doc.purchaseId === props.purchaseId || 
                    (form.value.orderId && doc.cartId === form.value.orderId) || 
                    (form.value.poNumber && doc.cartId === form.value.poNumber);

                if (isCreate && belongsToPo) {
                    if (!items.value.find(i => i.$id === doc.$id)) {
                        items.value.push(doc);
                    }
                } else if (isUpdate) {
                    const idx = items.value.findIndex(i => i.$id === doc.$id);
                    if (idx !== -1) {
                        if (belongsToPo) {
                            items.value[idx] = { ...items.value[idx], ...doc };
                        } else {
                            items.value.splice(idx, 1);
                        }
                    } else if (belongsToPo) {
                        items.value.push(doc);
                    }
                } else if (isDelete) {
                    items.value = items.value.filter(i => i.$id !== doc.$id);
                }
            }
        );
        realtimeUnsubscribes.push(itemsSub);

        // 3. Live update expenses linked to this purchase
        const expSub = client.subscribe(
            `databases.${DB_ID}.collections.expenses.documents`,
            (response) => {
                const isCreate = response.events.some(e => e.endsWith('.create'));
                const isUpdate = response.events.some(e => e.endsWith('.update'));
                const isDelete = response.events.some(e => e.endsWith('.delete'));
                const doc = response.payload;
                if (!doc || !doc.$id) return;

                const belongsToPo = doc.purchaseId === props.purchaseId || doc.cartId === props.purchaseId;

                if (isCreate && belongsToPo) {
                    if (!expenses.value.find(e => e.$id === doc.$id)) {
                        expenses.value.push(doc);
                    }
                } else if (isUpdate) {
                    const idx = expenses.value.findIndex(e => e.$id === doc.$id);
                    if (idx !== -1) {
                        if (belongsToPo) {
                            expenses.value[idx] = { ...expenses.value[idx], ...doc };
                        } else {
                            expenses.value.splice(idx, 1);
                        }
                    } else if (belongsToPo) {
                        expenses.value.push(doc);
                    }
                } else if (isDelete) {
                    expenses.value = expenses.value.filter(e => e.$id !== doc.$id);
                }
            }
        );
        realtimeUnsubscribes.push(expSub);
    } catch (rtErr) {
        console.warn('[PurchaseEditor] Realtime subscription warning:', rtErr);
    }
};

onUnmounted(() => {
    realtimeUnsubscribes.forEach(unsub => {
        try { unsub(); } catch {}
    });
    realtimeUnsubscribes = [];
});

const processAndSaveReceiptFile = async (file) => {
    if (!file) return;
    uploadingReceipt.value = true;
    showLoader("Uploading Receipt Photo...", {
        step: "Saving receipt image to storage and linking to PO...",
        cancelable: false
    });
    try {
        const up = await storage.createFile(BUCKET_ID, ID.unique(), file);
        form.value.receiptImageId = up.$id;
        
        // Save immediately to PO
        if (props.purchaseId) {
            await purchasesAPI.updatePurchase(props.purchaseId, {
                receiptImageId: up.$id
            });
        }
        
        addToast("Receipt photo uploaded and linked to Purchase Order!", "success");
        
        // Prompt to rescan
        const shouldRescan = await confirmDialog(
            "Would you like to scan this receipt with AI right now to extract or verify vendor, date, and line items?",
            "Rescan Receipt with AI?"
        );
        if (shouldRescan) {
            await rescanReceipt();
        }
    } catch (e) {
        console.error("Failed to upload receipt:", e);
        addToast("Failed to upload receipt: " + e.message, "error");
    } finally {
        uploadingReceipt.value = false;
        hideLoader();
    }
};

const handleReceiptFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (file) {
        await processAndSaveReceiptFile(file);
    }
    if (event.target) event.target.value = '';
};

const handleCapturedReceiptPhotos = async (capturedPhotos) => {
    if (!capturedPhotos || capturedPhotos.length === 0) return;
    if (scannerWidget.value) {
        scannerWidget.value.stopCamera();
    }
    await processAndSaveReceiptFile(capturedPhotos[0]);
};

const openCameraScanner = () => {
    if (scannerWidget.value) {
        scannerWidget.value.startCamera();
    } else {
        receiptFileInput.value?.click();
    }
};

const rescanReceipt = async () => {
    if (!form.value.receiptImageId) {
        receiptFileInput.value?.click();
        return;
    }
    rescanningReceipt.value = true;
    showLoader("AI Reading & Analyzing Receipt...", {
        step: "Extracting store name, date, totals, and line items...",
        cancelable: false
    });
    try {
        // Fetch the file as blob and convert to base64
        const imgUrl = getAssetUrl(form.value.receiptImageId);
        const resp = await fetch(imgUrl);
        const blob = await resp.blob();
        
        const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
        
        const res = await fetch('/api/parse-receipt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images: [base64] })
        });
        
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Server error (HTTP ${res.status})`);
        }
        
        const parsed = await res.json();
        
        let updateMsg = [];
        const updatePayload = {};
        
        if (parsed.vendor && parsed.vendor.trim()) {
            form.value.vendor = parsed.vendor.trim();
            updatePayload.vendor = parsed.vendor.trim();
            updateMsg.push(`Vendor: ${parsed.vendor}`);
        }
        if (parsed.date) {
            try {
                const d = new Date(parsed.date);
                if (!isNaN(d.getTime())) {
                    form.value.purchaseDate = d.toISOString().split('T')[0];
                    updatePayload.purchaseDate = d.toISOString();
                    updateMsg.push(`Date: ${form.value.purchaseDate}`);
                }
            } catch(e) {}
        }
        if (parsed.total) {
            const pTot = parseFloat(parsed.total);
            if (!isNaN(pTot) && pTot > 0) {
                form.value.subtotal = pTot;
                updatePayload.subtotal = pTot;
                updatePayload.grandTotal = pTot;
                updateMsg.push(`Total: $${pTot.toFixed(2)}`);
            }
        }
        
        // Save PO header updates
        if (Object.keys(updatePayload).length > 0) {
            await purchasesAPI.updatePurchase(props.purchaseId, updatePayload);
        }
        
        // Handle items
        if (parsed.items && Array.isArray(parsed.items) && parsed.items.length > 0) {
            const addItems = await confirmDialog(
                `Receipt scanned!\n\n${updateMsg.join(' • ')}\n\nFound ${parsed.items.length} line items on the receipt. Would you like to add any missing items to this Purchase Order?`,
                "Add Receipt Items to PO?"
            );
            
            if (addItems) {
                showLoader("Adding Receipt Line Items to Inventory...", {
                    step: `Saving ${parsed.items.length} items to inventory...`,
                    cancelable: false
                });
                
                await purchasesAPI.savePurchaseOrder({
                    purchaseId: props.purchaseId,
                    poNumber: form.value.poNumber,
                    vendor: form.value.vendor || 'Receipt Purchase',
                    tenantId: currentTeam.value?.$id || null,
                    receiptImageId: form.value.receiptImageId || undefined,
                    items: parsed.items
                });
                
                await loadLinkedItems();
            }
        }
        
        addToast("Receipt rescanned successfully!", "success");
    } catch (err) {
        console.error("Failed to rescan receipt:", err);
        addToast("Rescan failed: " + (err.message || 'Unknown error'), "error");
    } finally {
        rescanningReceipt.value = false;
        hideLoader();
    }
};

const loadLinkedItems = async () => {
    loadingItems.value = true;
    try {
        items.value = await getItemsByPurchaseId(props.purchaseId, form.value.orderId, form.value.poNumber);
        
        // Auto-fill subtotal from items if it's currently 0 or missing
        if (!form.value.subtotal) {
            form.value.subtotal = items.value.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
            // Optionally auto-save it back to the DB to fix it permanently
            await purchasesAPI.updatePurchase(props.purchaseId, { subtotal: form.value.subtotal });
        }
        
    } catch (e) {
        console.error(e);
    } finally {
        loadingItems.value = false;
    }
};

const savePurchase = async () => {
    saving.value = true;
    showLoader("Saving Purchase...");
    try {
        const payload = {
            ...form.value,
            grandTotal: computedGrandTotal.value
        };
        
        // Let backend handle missing PO Number via auto-gen
        if (!payload.poNumber) {
            delete payload.poNumber;
        }

        if (isEdit.value) {
            await purchasesAPI.updatePurchase(props.purchaseId, payload);
            editMode.value = false;
        } else {
            const res = await purchasesAPI.createPurchase(payload);
            // Redirect to edit page
            window.location.href = `/purchases/${res.$id}`;
        }
    } catch (e) {
        console.error('Failed to save purchase:', e);
        alert('Failed to save: ' + e.message);
    } finally {
        saving.value = false;
        hideLoader();
    }
};

const handleDelete = async () => {
    const ok = await confirmDialog(
        'Deleting this Purchase Order removes this inbound record from Resale Command. All linked inventory items and recorded expenses will remain safely preserved in your inventory, but will no longer be linked to this PO. This action cannot be undone.',
        'Delete Purchase Order',
        'Delete Purchase Order',
        'Cancel',
        'btn-error'
    );
    if (!ok) return;

    saving.value = true;
    try {
        await purchasesAPI.deletePurchase(props.purchaseId);
        addToast('Purchase Order deleted', 'success');
        window.location.href = '/purchases';
    } catch (e) {
        console.error('Failed to delete purchase', e);
        addToast('Failed to delete: ' + e.message, 'error');
    } finally {
        saving.value = false;
    }
};

const handleItemSearch = () => {
    if (searchTimeout.value) clearTimeout(searchTimeout.value);
    
    if (!itemSearchQuery.value || itemSearchQuery.value.trim().length < 2) {
        searchResults.value = [];
        isSearching.value = false;
        showDropdown.value = false;
        return;
    }
    
    isSearching.value = true;
    showDropdown.value = true;
    searchTimeout.value = setTimeout(async () => {
        try {
            searchResults.value = await searchItems(itemSearchQuery.value.trim());
        } catch (e) {
            console.error('Search failed', e);
            searchResults.value = [];
        } finally {
            isSearching.value = false;
        }
    }, 400);
};

const linkItem = async (item) => {
    if (linkingItem.value) return;
    linkingItem.value = item.$id;
    try {
        await linkItemToPurchase(item.$id, props.purchaseId);
        itemSearchQuery.value = '';
        searchResults.value = [];
        await loadLinkedItems();
        
        // Force recalc subtotal when a new item is linked
        form.value.subtotal = items.value.reduce((sum, i) => sum + (Number(i.cost) || 0), 0);
        await purchasesAPI.updatePurchase(props.purchaseId, { subtotal: form.value.subtotal });
        addToast(`Linked ${item.title || item.identity} to this PO`, 'success');
    } catch (e) {
        console.error(e);
        addToast('Failed to link item: ' + e.message, 'error');
    } finally {
        linkingItem.value = null;
    }
};

const unlinkItem = async (item) => {
    if (linkingItem.value) return;
    const ok = await confirmDialog(
        `Remove "${item.tag_title || item.title}" from this Purchase Order? The item will still exist in your active inventory, but will no longer be linked to this PO's landed costs.`,
        'Remove Item from PO',
        'Remove Item',
        'Cancel',
        'btn-error'
    );
    if (!ok) return;
    
    linkingItem.value = item.$id;
    try {
        await linkItemToPurchase(item.$id, null);
        items.value = items.value.filter(i => i.$id !== item.$id);
        
        // Auto-update the subtotal when an item is unlinked
        form.value.subtotal = items.value.reduce((sum, i) => sum + (Number(i.cost) || 0), 0);
        // Persist the new subtotal immediately
        await purchasesAPI.updatePurchase(props.purchaseId, { subtotal: form.value.subtotal });
        addToast(`Unlinked ${item.identity || item.title}`, 'info');
    } catch (e) {
        console.error('Failed to unlink item', e);
        addToast('Failed to unlink item: ' + e.message, 'error');
    } finally {
        linkingItem.value = null;
    }
};

const quickCreateItem = async () => {
    if (!newItem.value.title) return;
    creatingItem.value = true;
    try {
        const generatedIdentity = 'PO-' + Date.now().toString().slice(-6) + '-' + Math.floor(Math.random() * 1000);
        const payload = {
            title: newItem.value.title,
            identity: generatedIdentity
        };
        const extraData = {
            cost: newItem.value.cost || 0,
            purchaseId: props.purchaseId,
            status: 'acquired' // Assuming it's acquired if it's on a PO
        };
        
        await saveItemToInventory(payload, null, extraData, currentTeam.value?.$id);
        
        // Reset form and reload
        newItem.value.title = '';
        newItem.value.cost = null;
        await loadLinkedItems();
        addToast('Item created and linked to PO', 'success');
    } catch (e) {
        console.error('Failed to quick create item', e);
        addToast('Failed to create item: ' + e.message, 'error');
    } finally {
        creatingItem.value = false;
    }
};

const loadExpenses = async () => {
    loadingExpenses.value = true;
    try {
        const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
        const res = await databases.listDocuments(DB_ID, 'expenses', [
            Query.equal('purchaseId', props.purchaseId)
        ]);
        expenses.value = res.documents;
    } catch (e) {
        console.error("Failed to load expenses", e);
    } finally {
        loadingExpenses.value = false;
    }
};

const handleAddExpense = async () => {
    if (!newExpenseAmount.value) return;
    loadingExpenses.value = true;
    try {
        const expense = await databases.createDocument(
            import.meta.env.PUBLIC_APPWRITE_DB_ID,
            'expenses',
            ID.unique(),
            {
                purchaseId: props.purchaseId,
                cartId: props.purchaseId, // legacy support
                tenantId: form.value.tenantId || 'personal',
                amount: newExpenseAmount.value,
                note: newExpenseNote.value || 'Misc Expense',
                date: new Date().toISOString()
            }
        );
        expenses.value.push(expense);
        newExpenseAmount.value = '';
        newExpenseNote.value = '';
        addToast('Expense added', 'success');
    } catch (e) {
        console.error('Failed to add expense', e);
        addToast('Failed to add expense: ' + e.message, 'error');
    } finally {
        loadingExpenses.value = false;
    }
};

const handleRemoveExpense = async (expenseId) => {
    const ok = await confirmDialog(
        'Are you sure you want to remove this expense?',
        'Remove Expense',
        'Remove',
        'Cancel',
        'btn-error'
    );
    if (!ok) return;

    try {
        await databases.deleteDocument(
            import.meta.env.PUBLIC_APPWRITE_DB_ID,
            'expenses',
            expenseId
        );
        expenses.value = expenses.value.filter(e => e.$id !== expenseId);
        addToast('Expense removed', 'info');
    } catch (e) {
        console.error('Failed to remove expense', e);
        addToast('Failed to remove expense: ' + e.message, 'error');
    }
};

</script>
