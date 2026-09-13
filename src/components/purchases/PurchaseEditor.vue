<template>
  <div class="space-y-8 pb-44 sm:pb-40">
    <div v-if="loadingInit" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <template v-else>
      <!-- 1. TOP HERO CARD: RECEIPT PHOTO & AI SCANNER (PhotoGalleryManager UI Pattern) -->
      <div class="card bg-base-100 shadow-xl border border-base-200 overflow-hidden">
        <!-- Header -->
        <div class="p-4 sm:p-5 border-b border-base-200 bg-base-200/20 flex items-center justify-between">
          <label class="font-bold text-xs uppercase tracking-wider text-base-content/70 flex items-center gap-2">
            <Icon icon="solar:bill-list-bold-duotone" class="w-5 h-5 text-primary" />
            <span>Receipt Photo &amp; AI Scanner</span>
          </label>
          <div class="flex items-center gap-1.5">
            <span v-if="form.receiptImageId || receiptPreviewUrl" class="badge badge-success text-success-content font-bold text-xs gap-1 py-2">
              <Icon icon="solar:bill-check-bold" class="w-3.5 h-3.5" /> Attached
            </span>
            <span v-else class="badge badge-ghost text-xs text-base-content/60">
              Optional
            </span>
          </div>
        </div>

        <div class="card-body p-4 sm:p-6">
          <!-- Hidden File Input for Receipt -->
          <input type="file" ref="receiptFileInput" @change="handleReceiptFileChange" accept="image/*" class="hidden" />

          <!-- A. EMPTY STATE: Tactile Dropzone with Big Camera Button -->
          <div 
            v-if="!form.receiptImageId && !receiptPreviewUrl"
            class="border-2 border-dashed border-base-300 rounded-2xl p-6 sm:p-8 text-center transition-all bg-base-100/60 cursor-pointer hover:border-primary/60 hover:bg-primary/5 flex flex-col items-center justify-center gap-3 relative select-none"
            @click="receiptFileInput?.click()"
            @dragover.prevent
            @drop.prevent="handleReceiptDrop"
          >
            <div class="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-1 pointer-events-none">
              <Icon icon="solar:bill-cross-bold-duotone" class="w-8 h-8" />
            </div>
            <div class="pointer-events-none">
              <div class="font-black text-sm sm:text-base text-base-content">Tap to upload or drag receipt here</div>
              <p class="text-xs opacity-60 max-w-sm mt-1 mx-auto">
                AI automatically extracts store name, purchase date, cost totals, and line items.
              </p>
            </div>

            <!-- Prominent Large Action Buttons -->
            <div class="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2 w-full max-w-md pointer-events-auto" @click.stop>
              <button 
                type="button" 
                class="btn btn-secondary w-full sm:w-auto sm:flex-1 rounded-2xl font-black text-sm gap-2 h-12 shadow-md active:scale-95 transition-all"
                @click="openCameraScanner"
              >
                <Icon icon="solar:camera-bold" class="w-5 h-5" />
                <span>Take Photo with Camera</span>
              </button>
              <button 
                type="button" 
                class="btn btn-outline btn-primary w-full sm:w-auto rounded-2xl font-bold text-xs gap-1.5 h-12 shadow-xs active:scale-95"
                @click="receiptFileInput?.click()"
              >
                <Icon icon="solar:upload-track-bold" class="w-4 h-4" />
                <span>Upload File</span>
              </button>
              <button 
                type="button" 
                class="btn btn-outline btn-accent w-full sm:w-auto rounded-2xl font-bold text-xs gap-1.5 h-12 shadow-xs active:scale-95"
                @click="pasteReceiptFromClipboard"
                title="Paste receipt screenshot directly from clipboard (Ctrl+V)"
              >
                <Icon icon="solar:clipboard-text-bold" class="w-4 h-4" />
                <span>Paste</span>
              </button>
            </div>
          </div>

          <!-- B. POPULATED STATE: Hero Main Receipt Preview + Action Controls -->
          <div v-else class="space-y-4">
            <div class="relative w-full rounded-2xl overflow-hidden border-2 border-primary/40 bg-black/90 shadow-md group aspect-16/9 max-h-80 flex items-center justify-center">
              <img 
                :src="receiptPreviewUrl || getAssetUrl(form.receiptImageId)" 
                alt="Attached Receipt" 
                class="w-full h-full object-contain cursor-pointer transition-transform duration-300 group-hover:scale-102"
                @click="showReceiptLightbox = true"
              />
              
              <!-- Badges Overlay -->
              <div class="absolute top-3 left-3 flex items-center gap-1.5 z-20">
                <span class="badge badge-success text-success-content font-black text-xs gap-1 shadow-md py-2.5 px-3 rounded-xl">
                  <Icon icon="solar:bill-check-bold" class="w-3.5 h-3.5" />
                  Receipt Attached
                </span>
                <span class="badge badge-neutral font-mono font-bold text-xs shadow-md py-2.5 px-3 rounded-xl">
                  IRS Record
                </span>
              </div>

              <!-- Top Right Controls -->
              <div class="absolute top-3 right-3 flex items-center gap-2 z-20">
                <button 
                  type="button" 
                  class="btn btn-sm btn-circle bg-base-100/90 hover:bg-base-100 shadow-md text-base-content border border-base-300"
                  @click="showReceiptLightbox = true"
                  title="Zoom Full Resolution"
                >
                  <Icon icon="solar:magnifer-zoom-in-bold" class="w-4 h-4" />
                </button>
                <button 
                  v-if="(isEdit && editMode) || !isEdit"
                  type="button" 
                  class="btn btn-sm btn-circle btn-error text-error-content shadow-md"
                  @click="removeReceiptPhoto"
                  title="Remove receipt photo"
                >
                  <Icon icon="solar:trash-bin-trash-bold" class="w-4 h-4" />
                </button>
              </div>

              <div class="absolute bottom-2.5 inset-x-3 text-center pointer-events-none">
                <span class="text-[11px] font-semibold text-white/90 bg-black/60 px-3 py-1 rounded-full backdrop-blur-xs">
                  Click photo to zoom and inspect details
                </span>
              </div>
            </div>

            <!-- Action Strip for Attached Receipt -->
            <div class="flex flex-wrap items-center gap-2 pt-1">
              <button 
                type="button" 
                class="btn btn-sm btn-warning text-warning-content font-black gap-1.5 rounded-xl shadow-xs active:scale-95 border border-warning-content/25"
                @click="rescanReceipt"
                :disabled="rescanningReceipt || uploadingReceipt"
              >
                <span v-if="rescanningReceipt" class="loading loading-spinner loading-xs"></span>
                <Icon v-else icon="solar:magic-stick-3-bold" class="w-4 h-4" />
                <span>{{ rescanningReceipt ? 'AI Scanning...' : 'Rescan with AI' }}</span>
              </button>
              
              <button 
                type="button" 
                class="btn btn-sm btn-secondary text-secondary-content font-bold gap-1.5 rounded-xl shadow-xs active:scale-95"
                @click="openCameraScanner"
                :disabled="rescanningReceipt || uploadingReceipt"
              >
                <Icon icon="solar:camera-bold" class="w-4 h-4" />
                <span>Retake Photo</span>
              </button>

              <button 
                type="button" 
                class="btn btn-sm btn-outline btn-primary font-bold gap-1.5 rounded-xl shadow-xs active:scale-95"
                @click="receiptFileInput?.click()"
                :disabled="rescanningReceipt || uploadingReceipt"
              >
                <Icon icon="solar:upload-track-bold" class="w-4 h-4" />
                <span>Replace File</span>
              </button>

              <button 
                type="button" 
                class="btn btn-sm btn-outline btn-accent font-bold gap-1.5 rounded-xl shadow-xs active:scale-95"
                @click="pasteReceiptFromClipboard"
                :disabled="rescanningReceipt || uploadingReceipt"
                title="Paste new screenshot from clipboard"
              >
                <Icon icon="solar:clipboard-text-bold" class="w-4 h-4" />
                <span>Paste New</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. PURCHASE DETAILS & COST BREAKDOWN CARD -->
      <div class="card bg-base-100 shadow-xl border border-base-200 overflow-hidden">
        <!-- Case A: Existing PO Header (Accordion Clickable) -->
        <div 
          v-if="isEdit"
          class="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-base-100 hover:bg-base-200/40 transition-colors select-none cursor-pointer"
          :class="{ 'border-b border-base-200 bg-base-200/20': isExpanded }"
          @click="toggleExpanded"
        >
          <!-- Left: PO Number, Vendor, Status Badge -->
          <div class="flex items-center gap-2.5 sm:gap-3 flex-wrap">
            <div class="w-6 h-6 flex items-center justify-center text-base-content/70">
              <Icon :icon="isExpanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'" class="w-5 h-5 transition-transform duration-200" />
            </div>

            <div class="flex items-center gap-2">
              <span class="font-mono font-black text-base sm:text-lg text-primary tracking-tight">
                {{ form.poNumber || 'PO-PENDING' }}
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
            <div class="flex items-center" @click.stop>
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

        <!-- Case B: New PO Header (Always Open, Non-Accordion) -->
        <div 
          v-else
          class="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-base-200 bg-base-200/20"
        >
          <div class="flex items-center gap-2.5 sm:gap-3 flex-wrap">
            <div class="w-6 h-6 flex items-center justify-center text-primary">
              <Icon icon="solar:document-add-bold-duotone" class="w-5 h-5" />
            </div>
            <div class="flex items-center gap-2">
              <span class="font-mono font-black text-base sm:text-lg text-primary tracking-tight">
                New Purchase Order
              </span>
              <span class="text-base-content/30 font-bold">•</span>
              <span class="font-bold text-sm sm:text-base text-base-content">
                {{ form.vendor || 'No Vendor' }}
              </span>
            </div>
            <span class="badge badge-warning text-warning-content font-bold text-xs">
              {{ form.status || 'Draft' }}
            </span>
          </div>

          <div class="flex items-baseline gap-1.5 bg-base-200/70 px-3 py-1.5 rounded-xl border border-base-300/60 self-end sm:self-auto shrink-0">
            <span class="text-[11px] font-extrabold uppercase tracking-wider text-base-content/60">Cost</span>
            <span class="font-mono font-black text-lg sm:text-xl text-primary">
              ${{ computedGrandTotal.toFixed(2) }}
            </span>
          </div>
        </div>

        <!-- CONTENT PANEL (Open if New PO, or if isExpanded on existing PO) -->
        <div v-if="!isEdit || isExpanded" class="card-body p-4 sm:p-6 space-y-6">
          <!-- 2-COLUMN RESPONSIVE LAYOUT (PO Details, Cost Breakdown) -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            <!-- COLUMN 1: PO & Order Details (6 Cols on lg) -->
            <div class="lg:col-span-6 space-y-4">
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
                  <span class="text-xs opacity-60 font-medium">External Order ID</span>
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
                    <option value="Partial">Partial</option>
                    <option value="Received">Received</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="Returned">Returned</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- COLUMN 2: Cost Breakdown (6 Cols on lg) -->
            <div class="lg:col-span-6 bg-base-200/50 p-4 sm:p-5 rounded-2xl border border-base-300/60 space-y-3">
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

          </div>
        </div>
      </div>

      <!-- Items Section (Visible if Editing or if items extracted from receipt) -->
      <div v-if="isEdit || items.length > 0" class="card bg-base-100 shadow-xl border border-base-200">
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
            
            <div v-if="isEdit" class="flex items-center gap-2">
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
          
          <div v-if="isEdit" class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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
                      <div class="badge badge-xs whitespace-nowrap" :class="item.status === 'in-stock' ? 'badge-success text-success-content font-bold' : (item.status === 'sold' ? 'badge-info text-info-content font-bold' : (item.status === 'placed' ? 'badge-primary text-primary-content font-bold' : 'badge-ghost text-base-content/80 font-bold'))">
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
                    class="btn btn-sm btn-primary text-primary-content font-black gap-1.5 flex-1 h-9 rounded-xl shadow-xs border border-primary-content/25 active:scale-95" 
                    @click="openEditItem(item)"
                    title="Open ItemDrawer with AI Deep Research, Lot Tools, and Details"
                  >
                    <Icon icon="solar:pen-bold" class="w-4 h-4" />
                    <span>Update</span>
                  </button>

                  <button 
                    v-if="item.status !== 'in-stock' && item.status !== 'placed' && item.status !== 'sold'" 
                    class="btn btn-sm btn-success text-success-content font-black gap-1 flex-1 h-9 rounded-xl shadow-xs border border-success-content/25 active:scale-95" 
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
                    class="btn btn-sm btn-ghost text-error hover:bg-error/15 btn-square h-9 w-9 rounded-xl shrink-0 active:scale-95" 
                    @click="unlinkItem(item)" 
                    :disabled="linkingItem === item.$id"
                    title="Unlink Item"
                  >
                    <Icon icon="solar:trash-bin-trash-bold" class="w-4 h-4" />
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
                      <div class="badge badge-sm whitespace-nowrap" :class="item.status === 'in-stock' ? 'badge-success text-success-content font-bold' : (item.status === 'sold' ? 'badge-info text-info-content font-bold' : (item.status === 'placed' ? 'badge-primary text-primary-content font-bold' : 'badge-ghost text-base-content/80 font-bold'))">
                        {{ item.status || 'acquired' }}
                      </div>
                    </td>
                    <td class="text-right">
                      <div class="flex items-center justify-end gap-1.5 flex-wrap">
                        <button 
                          v-if="item.status !== 'in-stock' && item.status !== 'placed' && item.status !== 'sold'" 
                          class="btn btn-xs btn-success text-success-content font-black shadow-xs border border-success-content/25 gap-1 rounded-lg px-2.5 h-7 active:scale-95" 
                          @click="receiveToStock(item, 'Backstock')"
                          title="Receive into Backstock"
                        >
                          <Icon icon="solar:check-circle-bold" class="w-3.5 h-3.5" />
                          <span>Receive</span>
                        </button>
                        <button class="btn btn-xs btn-primary text-primary-content font-black shadow-xs border border-primary-content/25 gap-1 rounded-lg px-2.5 h-7 active:scale-95" @click="openEditItem(item)">
                          <Icon icon="solar:pen-bold" class="w-3.5 h-3.5" />
                          <span>Update</span>
                        </button>
                        <button class="btn btn-xs btn-ghost text-error hover:bg-error/15 font-bold rounded-lg px-2 h-7 active:scale-95" @click="unlinkItem(item)" :disabled="linkingItem === item.$id">
                          <span v-if="linkingItem === item.$id" class="loading loading-spinner loading-xs"></span>
                          <span v-else class="flex items-center gap-1">
                            <Icon icon="solar:trash-bin-trash-bold" class="w-3.5 h-3.5" />
                            <span>Unlink</span>
                          </span>
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
            v-if="form.receiptImageId || receiptPreviewUrl" 
            :src="receiptPreviewUrl || getAssetUrl(form.receiptImageId)" 
            alt="Full Receipt" 
            class="max-w-full max-h-[68vh] object-contain rounded-xl shadow-md" 
          />
        </div>
        <div class="modal-action pt-2 border-t border-base-200 flex justify-between items-center m-0">
          <button type="button" class="btn btn-sm btn-warning text-warning-content font-black gap-1.5 rounded-xl shadow-xs border border-warning-content/25 active:scale-95" @click="showReceiptLightbox = false; rescanReceipt();">
            <Icon icon="solar:magic-stick-3-bold" class="w-4 h-4" />
            <span>Rescan with AI</span>
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

    <!-- STANDARDIZED ERGONOMIC ACTION BUTTON DOCK -->
    <Teleport to="body">
      <div class="fixed bottom-0 inset-x-0 z-40 bg-base-100/95 dark:bg-base-200/95 backdrop-blur-2xl border-t border-base-300 shadow-[0_-4px_25px_rgba(0,0,0,0.18)] select-none pointer-events-auto flex flex-col pb-[env(safe-area-inset-bottom,0px)]">
        <!-- Tier 1: Slim Telemetry & Cost Strip -->
        <div class="border-b border-base-content/15 bg-base-200 dark:bg-base-300 py-1 px-3 flex items-center justify-between text-xs shadow-2xs font-mono">
          <div class="max-w-xl w-full mx-auto flex items-center justify-between text-xs">
            <div class="flex items-center gap-2 truncate">
              <span class="font-black text-primary text-xs">{{ form.poNumber || (isEdit ? 'PO-PENDING' : 'New PO') }}</span>
              <span class="opacity-40 font-bold">•</span>
              <span class="text-[11px] font-bold text-base-content font-sans truncate max-w-[120px] sm:max-w-[200px]">{{ form.vendor || 'No Vendor' }}</span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="badge badge-xs font-black" :class="getStatusClass(form.status)">{{ form.status || 'Draft' }}</span>
              <span class="font-black text-base-content text-xs">${{ computedGrandTotal.toFixed(2) }}</span>
            </div>
          </div>
        </div>

        <!-- Tier 2: Ergonomic Command Actions -->
        <div class="max-w-xl w-full mx-auto px-2 py-1.5 flex items-center justify-between sm:justify-center gap-2 h-14">
          <!-- Action 1: Delete PO (when isEdit) -->
          <button 
            v-if="isEdit"
            type="button"
            class="h-11 my-auto px-3 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 bg-base-200/80 hover:bg-error/15 text-error font-bold border border-error/25 shadow-xs active:scale-95 cursor-pointer"
            @click="handleDelete"
            :disabled="saving"
            title="Delete this Purchase Order"
          >
            <Icon icon="solar:trash-bin-trash-bold" class="w-4.5 h-4.5" />
            <span class="font-extrabold uppercase text-[10px] tracking-tight leading-none whitespace-nowrap">Delete PO</span>
          </button>

          <!-- Action 2: Receive All / Purchase (when isEdit) -->
          <button 
            v-if="isEdit && (isDraft || hasUnreceivedItems)" 
            type="button"
            @click="handleReceiveOrPurchase('Backstock')" 
            class="h-11 my-auto px-3 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 bg-success text-success-content font-black shadow-md border border-success-content/25 active:scale-95 hover:brightness-110 cursor-pointer"
            :title="isDraft ? 'Complete purchase and activate items into Backstock' : 'Receive all unreceived items into Backstock'"
          >
            <Icon :icon="isDraft ? 'solar:box-minimalistic-bold' : 'solar:check-circle-bold'" class="w-4.5 h-4.5 drop-shadow-xs" />
            <span class="font-black uppercase text-[10px] sm:text-[11px] tracking-wide leading-none whitespace-nowrap">{{ isDraft ? 'Purchase' : 'Receive All' }}</span>
          </button>

          <!-- Action 3: Save / Create PO (Elevated Solid Hero Action) -->
          <button 
            type="button"
            @click="editMode || !isEdit ? savePurchase() : (editMode = true)" 
            :disabled="saving"
            class="h-11 my-auto flex-1 sm:flex-initial sm:min-w-[140px] px-4 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 bg-primary text-primary-content font-black shadow-md border border-primary-content/25 active:scale-95 hover:brightness-110 cursor-pointer"
            :title="editMode || !isEdit ? 'Save Purchase Order changes' : 'Enable Edit Mode'"
          >
            <span v-if="saving" class="loading loading-spinner loading-xs text-primary-content"></span>
            <template v-else>
              <Icon :icon="editMode || !isEdit ? 'solar:diskette-bold' : 'solar:pen-bold'" class="w-4.5 h-4.5 drop-shadow-xs" />
              <span class="font-black uppercase text-[10px] sm:text-[11px] tracking-wide leading-none whitespace-nowrap">
                {{ !isEdit ? 'Create PO' : (editMode ? 'Save PO' : 'Edit PO') }}
              </span>
            </template>
          </button>
        </div>
      </div>
    </Teleport>
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
const pendingReceiptFile = ref(null);
const receiptPreviewUrl = ref('');

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
        await checkAndSyncPoStatus();
    }
};

const isEdit = computed(() => !!props.purchaseId);
const activeDocId = ref(props.purchaseId || null);
const editMode = ref(!props.purchaseId);
const isExpanded = ref(true);
const loadingInit = ref(false);
const saving = ref(false);

const toggleExpanded = () => {
    isExpanded.value = !isExpanded.value;
};

watch(editMode, (val) => {
    if (val) {
        isExpanded.value = true;
    }
}, { immediate: true });

const getStatusClass = (status) => {
    switch (status?.toLowerCase()) {
        case 'pending': return 'badge-warning text-warning-content font-black whitespace-nowrap';
        case 'ordered': return 'badge-info text-info-content font-bold whitespace-nowrap';
        case 'shipped': return 'badge-info text-info-content font-bold whitespace-nowrap';
        case 'partial':
        case 'partially received': return 'badge-secondary text-secondary-content font-bold whitespace-nowrap';
        case 'received': return 'badge-success text-success-content font-black whitespace-nowrap';
        case 'returned': return 'badge-error text-error-content font-bold whitespace-nowrap';
        case 'cancelled': return 'badge-error text-error-content font-bold whitespace-nowrap';
        default: return 'badge-ghost text-base-content/80 font-bold whitespace-nowrap';
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

const isDraft = computed(() => (form.value.status || '').toLowerCase() === 'draft');

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

const checkAndSyncPoStatus = async () => {
    if (!props.purchaseId || items.value.length === 0) return;

    // Do not override if explicitly cancelled or returned
    if (form.value.status === 'Cancelled' || form.value.status === 'Returned') return;

    const total = items.value.length;
    const received = items.value.filter(i => 
        i.status === 'in-stock' || i.status === 'placed' || i.status === 'sold'
    );

    let newStatus = form.value.status;
    if (received.length === total) {
        newStatus = 'Received';
    } else if (received.length > 0) {
        newStatus = 'Partial';
    } else if (form.value.status === 'Received' || form.value.status === 'Partial' || form.value.status === 'Partially Received') {
        newStatus = 'Pending';
    }

    if (newStatus !== form.value.status) {
        form.value.status = newStatus;
        try {
            const docId = activeDocId.value || props.purchaseId;
            await purchasesAPI.updatePurchase(docId, { status: newStatus });
            addToast(`PO status updated to "${newStatus}"`, 'success');
        } catch (e) {
            console.warn('Failed to auto-sync PO status:', e);
        }
    }
};

const receiveToStock = async (item, location = 'HG') => {
    const ok = await confirmDialog(
        `Receive "${item.tag_title || item.title}" into active inventory stored at Huck's Garage (HG)? This marks the item as "In-Stock" and makes it ready for pricing, tagging, and retail booth deployment.`,
        'Receive Item to Huck\'s Garage (HG)',
        'Receive to HG',
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
        addToast(`Received "${item.tag_title || item.title}" into Huck's Garage (HG)!`, 'success');
        await loadLinkedItems();
        await checkAndSyncPoStatus();
    } catch (e) {
        addToast(`Failed to receive item: ${e.message}`, 'error');
    }
};

const receiveAllToStock = async (location = 'HG') => {
    if (items.value.length === 0) return;
    const ok = await confirmDialog(
        `This will activate all ${items.value.length} item(s) in this Purchase Order to "In-Stock" status stored at Huck's Garage (HG), and mark this PO as "Received". Once in Backstock, items are ready for inventory tracking and retail booth deployment.`,
        'Receive Entire Haul to Huck\'s Garage (HG)',
        'Receive All to HG',
        'Cancel',
        'btn-success'
    );
    if (!ok) return;

    showLoader('Activating items into Huck\'s Garage (HG)...');
    try {
        const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
        const collId = getCollectionId();
        await Promise.all(items.value.map(item => 
            databases.updateDocument(DB_ID, collId, item.$id, {
                status: 'in-stock',
                storageLocation: item.storageLocation || location
            })
        ));
        const docId = activeDocId.value || props.purchaseId;
        if (docId) {
            await purchasesAPI.updatePurchase(docId, { status: 'Received' });
            form.value.status = 'Received';
        }
        addToast(`All ${items.value.length} items are now In-Stock at Huck's Garage (HG)!`, 'success');
        await loadLinkedItems();
        await checkAndSyncPoStatus();
    } catch (e) {
        addToast(`Failed to activate items: ${e.message}`, 'error');
    } finally {
        hideLoader();
    }
};

const handleReceiveOrPurchase = async (location = 'HG') => {
    if (isDraft.value) {
        const label = form.value.poNumber || form.value.vendor || 'this order';
        const count = items.value.length;
        const ok = await confirmDialog(
            count > 0
                ? `Finalize purchase for "${label}" (${count} item${count === 1 ? '' : 's'})? This will mark this Purchase Order as "Received" and activate all items into Huck's Garage (HG).`
                : `Finalize purchase for "${label}"? This will mark this Purchase Order as "Received".`,
            'Complete Purchase',
            'Purchase It',
            'Cancel',
            'btn-success'
        );
        if (!ok) return;

        showLoader('Finalizing purchase & activating items into HG...');
        try {
            const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
            const collId = getCollectionId();
            if (count > 0) {
                await Promise.all(items.value.map(item => 
                    databases.updateDocument(DB_ID, collId, item.$id, {
                        status: 'in-stock',
                        storageLocation: item.storageLocation || location
                    })
                ));
            }
            const docId = activeDocId.value || props.purchaseId;
            if (docId) {
                await purchasesAPI.updatePurchase(docId, { 
                    status: 'Received',
                    subtotal: computedGrandTotal.value || form.value.subtotal,
                    grandTotal: computedGrandTotal.value || form.value.grandTotal
                });
                form.value.status = 'Received';
            }
            addToast(`Purchase completed! PO "${label}" is now Received at HG.`, 'success');
            await loadLinkedItems();
            await checkAndSyncPoStatus();
        } catch (e) {
            console.error('Failed to complete purchase:', e);
            addToast(`Failed to complete purchase: ${e.message}`, 'error');
        } finally {
            hideLoader();
        }
    } else {
        await receiveAllToStock(location);
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
            // Support opening via document $id, poNumber (e.g. PO-123456), or orderId
            const p = await purchasesAPI.findPurchase(props.purchaseId);
            if (p) {
                activeDocId.value = p.$id;
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
                    receiptImageId: p.receiptImageId || '',
                    tenantId: p.tenantId || null
                };
                
                if (form.value.status === 'Draft' || !form.value.receiptImageId) {
                    isExpanded.value = true;
                    editMode.value = true;
                }

                await Promise.all([
                    loadLinkedItems(),
                    loadExpenses()
                ]);
                await checkAndSyncPoStatus();
                initRealtime();
            } else {
                addToast(`Purchase Order "${props.purchaseId}" not found.`, 'error');
            }
        } catch (e) {
            console.error('Failed to load purchase', e);
            addToast('Failed to load purchase details: ' + e.message, 'error');
        } finally {
            loadingInit.value = false;
            hideLoader();
        }
    }
});

let realtimeUnsubscribes = [];

const initRealtime = () => {
    const docId = activeDocId.value || props.purchaseId;
    if (!docId) return;
    if (realtimeUnsubscribes.length > 0) return;
    
    try {
        const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
        const PURCHASES_COL = getPurchasesCollectionId();
        const ITEMS_COL = getCollectionId();

        // 1. Live update Purchase Order header
        const poSub = client.subscribe(
            `databases.${DB_ID}.collections.${PURCHASES_COL}.documents.${docId}`,
            (response) => {
                const doc = response.payload;
                if (!doc || doc.$id !== docId) return;
                
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
                const isCreate = response.events.some(e => e.includes('.create'));
                const isUpdate = response.events.some(e => e.includes('.update'));
                const isDelete = response.events.some(e => e.includes('.delete'));
                const doc = response.payload;
                if (!doc || !doc.$id) return;

                const poIdStr = String(docId).trim();
                const belongsToPo = 
                    (doc.purchaseId && String(doc.purchaseId).trim() === poIdStr) ||
                    (doc.cartId && String(doc.cartId).trim() === poIdStr) ||
                    (form.value.orderId && doc.cartId && String(doc.cartId).trim() === String(form.value.orderId).trim()) || 
                    (form.value.poNumber && doc.cartId && String(doc.cartId).trim() === String(form.value.poNumber).trim()) ||
                    (form.value.poNumber && doc.purchaseId && String(doc.purchaseId).trim() === String(form.value.poNumber).trim());

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
                const isCreate = response.events.some(e => e.includes('.create'));
                const isUpdate = response.events.some(e => e.includes('.update'));
                const isDelete = response.events.some(e => e.includes('.delete'));
                const doc = response.payload;
                if (!doc || !doc.$id) return;

                const poIdStr = String(docId).trim();
                const belongsToPo = (doc.purchaseId && String(doc.purchaseId).trim() === poIdStr) ||
                                    (doc.cartId && String(doc.cartId).trim() === poIdStr) ||
                                    (form.value.poNumber && doc.purchaseId && String(doc.purchaseId).trim() === String(form.value.poNumber).trim());

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
    if (receiptPreviewUrl.value) {
        URL.revokeObjectURL(receiptPreviewUrl.value);
    }
    realtimeUnsubscribes.forEach(unsub => {
        try { unsub(); } catch {}
    });
    realtimeUnsubscribes = [];
});

const handleReceiptDrop = async (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
        await processAndSaveReceiptFile(file);
    }
};

const removeReceiptPhoto = async () => {
    const ok = await confirmDialog(
        "Remove attached receipt photo from this Purchase Order?",
        "Remove Receipt Photo",
        "Remove",
        "Cancel",
        "btn-error"
    );
    if (!ok) return;

    if (receiptPreviewUrl.value) {
        URL.revokeObjectURL(receiptPreviewUrl.value);
        receiptPreviewUrl.value = '';
    }
    pendingReceiptFile.value = null;

    const oldImageId = form.value.receiptImageId;
    form.value.receiptImageId = '';

    if (props.purchaseId) {
        const docId = activeDocId.value || props.purchaseId;
        await purchasesAPI.updatePurchase(docId, { receiptImageId: '' });
        if (oldImageId) {
            await storage.deleteFile(BUCKET_ID, oldImageId).catch(delErr => {
                console.warn('[Purchases] Error deleting removed receipt from bucket:', delErr);
            });
        }
    }
    addToast("Receipt photo removed", "info");
};

const processAndSaveReceiptFile = async (file) => {
    if (!file) return;
    uploadingReceipt.value = true;
    showLoader("Reading & Analyzing Receipt...", {
        step: "Extracting receipt data with AI...",
        cancelable: false
    });
    try {
        if (props.purchaseId) {
            // Existing PO: Upload new file and clean up replaced image from bucket
            const oldImageId = form.value.receiptImageId;
            const up = await storage.createFile(BUCKET_ID, ID.unique(), file);
            form.value.receiptImageId = up.$id;
            const docId = activeDocId.value || props.purchaseId;
            await purchasesAPI.updatePurchase(docId, {
                receiptImageId: up.$id
            });
            if (oldImageId && oldImageId !== up.$id) {
                await storage.deleteFile(BUCKET_ID, oldImageId).catch(delErr => {
                    console.warn('[Purchases] Could not delete replaced receipt from bucket:', delErr);
                });
            }
            addToast("Receipt photo updated! Reading details with AI...", "info");
            await scanReceiptImage(file, up.$id);
        } else {
            // New PO: Keep local preview and File in memory.
            // Zero files uploaded to Appwrite bucket until user explicitly creates the PO!
            if (receiptPreviewUrl.value) {
                URL.revokeObjectURL(receiptPreviewUrl.value);
            }
            pendingReceiptFile.value = file;
            receiptPreviewUrl.value = URL.createObjectURL(file);
            addToast("Receipt attached! Reading details with AI...", "info");
            await scanReceiptImage(file);
        }
    } catch (e) {
        console.error("Failed to process receipt:", e);
        addToast("Failed to process receipt: " + e.message, "error");
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

const pasteReceiptFromClipboard = async () => {
    try {
        if (navigator.clipboard && navigator.clipboard.read) {
            const clipItems = await navigator.clipboard.read();
            for (const item of clipItems) {
                for (const type of item.types) {
                    if (type.startsWith('image/')) {
                        const blob = await item.getType(type);
                        const file = new File([blob], `receipt_${Date.now()}.png`, { type });
                        await processAndSaveReceiptFile(file);
                        return;
                    }
                }
            }
            addToast("No receipt image found on clipboard. Copy an image or screenshot first.", "warning");
        } else {
            receiptFileInput.value?.click();
        }
    } catch (e) {
        receiptFileInput.value?.click();
    }
};

const scanReceiptImage = async (fileOrBlob = null, uploadedImageId = null) => {
    const targetImageId = uploadedImageId || form.value.receiptImageId;
    if (!fileOrBlob && !targetImageId) {
        receiptFileInput.value?.click();
        return;
    }
    
    rescanningReceipt.value = true;
    showLoader("AI Reading & Analyzing Receipt...", {
        step: "Extracting store name, date, totals, and line items...",
        cancelable: false
    });
    try {
        let base64 = '';
        if (fileOrBlob instanceof Blob || fileOrBlob instanceof File) {
            base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(fileOrBlob);
            });
        } else {
            const imgUrl = getAssetUrl(targetImageId);
            const resp = await fetch(imgUrl);
            const blob = await resp.blob();
            base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        }
        
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
            updateMsg.push(`Vendor: ${parsed.vendor.trim()}`);
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
        
        // Handle items
        if (parsed.items && Array.isArray(parsed.items) && parsed.items.length > 0) {
            if (isEdit.value) {
                const docId = activeDocId.value || props.purchaseId;
                await purchasesAPI.savePurchaseOrder({
                    purchaseId: docId,
                    poNumber: form.value.poNumber,
                    vendor: form.value.vendor || 'Receipt Purchase',
                    tenantId: currentTeam.value?.$id || null,
                    receiptImageId: form.value.receiptImageId || targetImageId || undefined,
                    items: parsed.items
                });
                await loadLinkedItems();
            } else {
                // On New PO: Populate items into local reactive array so user sees them immediately
                const poPrefix = form.value.poNumber || 'ITEM';
                items.value = parsed.items.map((it, idx) => ({
                    $id: `temp_${Date.now()}_${idx}`,
                    title: it.title || `Receipt Item #${idx + 1}`,
                    cost: Number(it.cost) || 0,
                    quantity: Number(it.quantity) || 1,
                    status: 'acquired',
                    identity: `${poPrefix}-${String(idx + 1).padStart(2, '0')}`,
                    storageLocation: 'HG',
                    sourcingLocation: form.value.vendor || 'Receipt'
                }));
                // Auto-fill subtotal from items if parsed.total was 0
                if (!form.value.subtotal) {
                    form.value.subtotal = items.value.reduce((sum, i) => sum + (Number(i.cost) || 0), 0);
                }
            }
            updateMsg.push(`${parsed.items.length} items`);
        }
        
        // If editing existing PO and has header updates, persist them
        if (isEdit.value && Object.keys(updatePayload).length > 0) {
            const docId = activeDocId.value || props.purchaseId;
            await purchasesAPI.updatePurchase(docId, updatePayload);
        }
        
        addToast(`Receipt scanned! ${updateMsg.join(' • ')}`, "success");
    } catch (err) {
        console.error("Failed to scan receipt:", err);
        addToast("Receipt scan failed: " + (err.message || 'Unknown error'), "error");
    } finally {
        rescanningReceipt.value = false;
        hideLoader();
    }
};

const rescanReceipt = async () => {
    await scanReceiptImage(pendingReceiptFile.value);
};

const loadLinkedItems = async () => {
    loadingItems.value = true;
    try {
        const docId = activeDocId.value || props.purchaseId;
        items.value = await getItemsByPurchaseId(docId, form.value.orderId, form.value.poNumber);
        
        // Auto-fill subtotal from items if it's currently 0 or missing
        if (!form.value.subtotal) {
            form.value.subtotal = items.value.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
            // Optionally auto-save it back to the DB to fix it permanently
            if (docId) {
                await purchasesAPI.updatePurchase(docId, { subtotal: form.value.subtotal });
            }
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
            const docId = activeDocId.value || props.purchaseId;
            await purchasesAPI.updatePurchase(docId, payload);
            editMode.value = false;
            addToast("Purchase Order updated successfully!", "success");
        } else {
            // New PO! Route through savePurchaseOrder so receiptFile is uploaded safely and items are linked
            const res = await purchasesAPI.savePurchaseOrder({
                poNumber: form.value.poNumber || undefined,
                orderId: form.value.orderId || undefined,
                vendor: form.value.vendor || 'Receipt Purchase',
                purchaseDate: form.value.purchaseDate || new Date().toISOString(),
                status: form.value.status || 'Draft',
                subtotal: form.value.subtotal,
                feeTotal: (form.value.shippingTotal || 0) + (form.value.handlingTotal || 0) + (form.value.taxTotal || 0) + (form.value.feeTotal || 0),
                grandTotal: computedGrandTotal.value,
                tenantId: currentTeam.value?.$id || null,
                receiptFile: pendingReceiptFile.value || undefined,
                receiptImageId: form.value.receiptImageId || undefined,
                items: items.value.map(i => ({
                    title: i.title,
                    cost: Number(i.cost) || 0,
                    quantity: Number(i.quantity) || 1
                }))
            });
            if (receiptPreviewUrl.value) {
                URL.revokeObjectURL(receiptPreviewUrl.value);
                receiptPreviewUrl.value = '';
            }
            pendingReceiptFile.value = null;
            addToast("Purchase Order created successfully!", "success");
            window.location.href = `/purchases/${res.poNumber || res.purchaseId}`;
        }
    } catch (e) {
        console.error('Failed to save purchase:', e);
        addToast('Failed to save: ' + e.message, 'error');
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
        const docId = activeDocId.value || props.purchaseId;
        await purchasesAPI.deletePurchase(docId);
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
        await checkAndSyncPoStatus();
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

    // If on New PO (items not yet saved to Appwrite)
    if (!isEdit.value) {
        items.value = items.value.filter(i => i.$id !== item.$id);
        form.value.subtotal = items.value.reduce((sum, i) => sum + (Number(i.cost) || 0), 0);
        addToast(`Removed "${item.title}" from list`, 'info');
        return;
    }

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
        const docId = activeDocId.value || props.purchaseId;
        await linkItemToPurchase(item.$id, null);
        items.value = items.value.filter(i => i.$id !== item.$id);
        
        // Auto-update the subtotal when an item is unlinked
        form.value.subtotal = items.value.reduce((sum, i) => sum + (Number(i.cost) || 0), 0);
        // Persist the new subtotal immediately
        if (docId) {
            await purchasesAPI.updatePurchase(docId, { subtotal: form.value.subtotal });
        }
        await checkAndSyncPoStatus();
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
            status: 'acquired', // Assuming it's acquired if it's on a PO
            storageLocation: 'HG',
            sourcingLocation: form.value.vendor || undefined
        };
        
        await saveItemToInventory(payload, null, extraData, currentTeam.value?.$id);
        
        // Reset form and reload
        newItem.value.title = '';
        newItem.value.cost = null;
        await loadLinkedItems();
        await checkAndSyncPoStatus();
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
        const docId = activeDocId.value || props.purchaseId;
        const res = await databases.listDocuments(DB_ID, 'expenses', [
            Query.equal('purchaseId', docId)
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
        const docId = activeDocId.value || props.purchaseId;
        const expense = await databases.createDocument(
            import.meta.env.PUBLIC_APPWRITE_DB_ID,
            'expenses',
            ID.unique(),
            {
                purchaseId: docId,
                cartId: docId, // legacy support
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
