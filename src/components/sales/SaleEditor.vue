<template>
  <div class="space-y-6">
    <!-- Loader -->
    <div v-if="loading" class="flex flex-col items-center justify-center p-16 gap-3">
      <span class="loading loading-spinner loading-lg text-primary"></span>
      <span class="text-xs font-bold opacity-60">Loading Sales Order Details...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="alert alert-error shadow-sm rounded-2xl">
      <Icon icon="solar:danger-circle-bold" class="w-6 h-6 shrink-0" />
      <span>{{ error }}</span>
      <button class="btn btn-xs ml-auto" @click="loadData">Retry</button>
    </div>

    <!-- Main Content Container -->
    <div v-else class="space-y-6">

      <!-- Breadcrumb Navigation -->
      <div class="flex items-center justify-between">
        <a 
          href="/sales" 
          class="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-base-content/60 hover:text-primary transition-colors py-1 px-2 rounded-lg hover:bg-base-200"
        >
          <Icon icon="solar:arrow-left-linear" class="w-4 h-4" />
          <span>Back to Sales Orders</span>
        </a>

        <span v-if="!isNew" class="text-xs font-mono font-bold opacity-50">
          ID: {{ effectiveSaleId }}
        </span>
      </div>

      <!-- Top Executive Header Banner -->
      <div class="card bg-base-100 shadow-sm border border-base-300 rounded-2xl p-5 sm:p-6">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div class="flex items-center gap-4">
            <div class="p-3.5 bg-primary/10 text-primary rounded-2xl shrink-0 shadow-inner">
              <Icon icon="solar:document-text-bold" class="w-8 h-8" />
            </div>
            <div>
              <div class="flex items-center gap-2.5 flex-wrap">
                <h1 class="text-2xl sm:text-3xl font-black tracking-tight text-base-content">
                  {{ isNew ? 'Record New Sale' : (form.soNumber ? `Sales Order ${form.soNumber}` : 'Sales Order Details') }}
                </h1>
                <span class="badge badge-lg font-mono font-black shadow-xs" :class="isNew ? 'badge-primary' : 'badge-neutral'">
                  {{ form.soNumber || 'Draft' }}
                </span>
                <span class="badge badge-lg font-bold" :class="getStatusBadgeClass(form.status || 'Sold')">
                  ● {{ form.status || 'Sold' }}
                </span>
              </div>
              <p class="text-xs text-base-content/70 mt-1.5 flex items-center gap-2 flex-wrap font-medium">
                <span v-if="selectedWarehouse" class="font-bold text-base-content flex items-center gap-1">
                  <Icon icon="solar:shop-2-bold" class="w-4 h-4 text-secondary" />
                  {{ selectedWarehouse.name }} ({{ effectiveCommissionRate }}% fee)
                </span>
                <span v-else-if="form.warehouseId" class="font-bold text-base-content flex items-center gap-1">
                  <Icon icon="solar:shop-2-bold" class="w-4 h-4 text-secondary" />
                  {{ form.warehouseId }} ({{ effectiveCommissionRate }}% fee)
                </span>
                <span class="opacity-40">•</span>
                <span v-if="form.saleDate" class="font-mono">
                  Sold on {{ formatDate(form.saleDate) }}
                </span>
                <span v-if="form.orderId" class="opacity-40">•</span>
                <span v-if="form.orderId" class="font-mono font-bold bg-base-200 px-2 py-0.5 rounded text-[11px]">
                  Ref: {{ form.orderId }}
                </span>
              </p>
            </div>
          </div>

          <!-- Header Right Actions: Lock/Unlock Toggle & Cancel Button -->
          <div class="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
            <!-- Edit / Lock Toggle Button -->
            <button 
              v-if="!isNew"
              type="button" 
              @click="toggleLock" 
              class="btn btn-sm gap-2 font-black rounded-xl shadow-xs transition-all h-10 px-4"
              :class="isLocked ? 'btn-outline btn-primary hover:bg-primary hover:text-white' : 'btn-warning text-warning-content shadow-md'"
              :title="isLocked ? 'Unlock to edit pricing or fulfillment' : 'Lock changes and view settlement statement'"
            >
              <Icon :icon="isLocked ? 'solar:pen-bold' : 'solar:lock-bold'" class="w-4 h-4" />
              <span>{{ isLocked ? 'Edit / Unlock' : 'Done / Lock' }}</span>
            </button>

            <!-- Cancel / Return Flow Button -->
            <button 
              v-if="!isNew" 
              type="button" 
              @click="openCancelModal" 
              class="btn btn-sm btn-outline btn-error gap-1.5 font-bold rounded-xl shadow-xs h-10"
              title="Cancel sale, drop from revenue, and return item to stock"
            >
              <Icon icon="solar:close-circle-bold" class="w-4 h-4" />
              <span>Cancel / Return</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 4-Pillar Financial Summary KPI Cards (Visible in both modes, live updates) -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <!-- 1. Gross Sale Amount -->
        <div class="bg-base-100 p-4 sm:p-5 rounded-2xl border border-base-300 shadow-sm flex flex-col justify-between">
          <div>
            <div class="text-[11px] uppercase font-black tracking-wider text-base-content/60 truncate">Gross Retail Price</div>
            <div class="text-2xl sm:text-3xl font-black font-mono text-base-content mt-1">
              {{ formatCurrency(form.grossAmount || 0) }}
            </div>
          </div>
          <div class="text-[11px] text-base-content/60 font-medium mt-2">Customer sticker / tag price</div>
        </div>

        <!-- 2. Platform Consignment Fee -->
        <div class="bg-base-100 p-4 sm:p-5 rounded-2xl border border-rose-500/20 shadow-sm flex flex-col justify-between bg-rose-500/5">
          <div>
            <div class="text-[11px] uppercase font-black tracking-wider text-rose-700 dark:text-rose-400 truncate">
              Platform Fee ({{ effectiveCommissionRate }}%)
            </div>
            <div class="text-2xl sm:text-3xl font-black font-mono text-rose-600 dark:text-rose-400 mt-1">
              -{{ formatCurrency(computedCommissionFee) }}
            </div>
          </div>
          <div class="text-[11px] text-rose-600/80 font-medium mt-2">Consignment deduction</div>
        </div>

        <!-- 3. Net Payout Realized -->
        <div class="bg-base-100 p-4 sm:p-5 rounded-2xl border border-emerald-500/20 shadow-sm flex flex-col justify-between bg-emerald-500/5">
          <div>
            <div class="text-[11px] uppercase font-black tracking-wider text-emerald-700 dark:text-emerald-400 truncate">
              Net Payout Realized
            </div>
            <div class="text-2xl sm:text-3xl font-black font-mono text-emerald-700 dark:text-emerald-400 mt-1">
              {{ formatCurrency(computedNetPayout) }}
            </div>
          </div>
          <div class="text-[11px] text-emerald-700/80 font-medium mt-2">Realized cash settlement</div>
        </div>

        <!-- 4. Realized Net Profit (COGS) -->
        <div 
          class="p-4 sm:p-5 rounded-2xl border shadow-sm flex flex-col justify-between transition-colors"
          :class="netRealizedProfit >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'"
        >
          <div>
            <div class="flex items-center justify-between gap-1">
              <span 
                class="text-[11px] uppercase font-black tracking-wider truncate"
                :class="netRealizedProfit >= 0 ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-800 dark:text-rose-300'"
              >
                {{ netRealizedProfit >= 0 ? 'Realized Net Profit' : 'Realized Net Loss' }}
              </span>
              <span 
                v-if="roiPercent !== null" 
                class="badge badge-sm font-mono font-black shrink-0" 
                :class="Number(roiPercent) >= 0 ? 'badge-success text-white' : 'badge-error text-white'"
              >
                {{ roiPercent }}% ROI
              </span>
            </div>
            <div 
              class="text-2xl sm:text-3xl font-black font-mono mt-1"
              :class="netRealizedProfit >= 0 ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-800 dark:text-rose-300'"
            >
              {{ formatCurrency(netRealizedProfit) }}
            </div>
          </div>
          <div 
            class="text-[11px] font-medium mt-2"
            :class="netRealizedProfit >= 0 ? 'text-emerald-700/80 dark:text-emerald-400/80' : 'text-rose-700/80 dark:text-rose-400/80'"
          >
            After {{ formatCurrency(costBasis) }} buy cost basis
          </div>
        </div>
      </div>

      <!-- =================================================================== -->
      <!-- VIEW 1: READ-ONLY LOCKED EXECUTIVE STATEMENT (DEFAULT FOR SAVED SO) -->
      <!-- =================================================================== -->
      <div v-if="isLocked && !isNew" class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        <!-- Left Column: Linked Inventory Item Details (7 cols) -->
        <div class="lg:col-span-7 space-y-6">
          
          <!-- Linked Product Hero Card -->
          <div v-if="linkedItem" class="card bg-base-100 shadow-sm border border-base-300 rounded-2xl overflow-hidden">
            <div class="p-4 bg-base-200/60 border-b border-base-300 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Icon icon="solar:box-bold" class="w-4 h-4 text-primary" />
                <span class="font-black text-xs uppercase tracking-wider text-base-content">Linked Inventory Item</span>
              </div>
              <a 
                :href="`/item/${linkedItem.$id}`" 
                target="_blank" 
                class="btn btn-xs btn-outline btn-primary font-bold gap-1 rounded-lg hover:underline"
                title="Open item page in new tab"
              >
                <span>View Item</span>
                <Icon icon="solar:arrow-right-up-linear" class="w-3.5 h-3.5" />
              </a>
            </div>

            <div class="p-5 sm:p-6 space-y-5">
              <div class="flex items-start gap-4">
                <ItemThumbnail :item="linkedItem" size="xl" rounded="2xl" class="shadow-sm border border-base-300 shrink-0 w-20 h-20" />
                <div class="min-w-0 flex-1">
                  <a 
                    :href="`/item/${linkedItem.$id}`" 
                    class="font-black text-base sm:text-lg leading-snug hover:text-primary transition-colors line-clamp-2 text-base-content"
                    :title="linkedItem.title"
                  >
                    {{ linkedItem.title }}
                  </a>

                  <div class="flex flex-wrap items-center gap-2 mt-2.5">
                    <span v-if="linkedItem.upc" class="font-mono text-xs text-base-content/80 bg-base-200 border border-base-300 px-2.5 py-1 rounded-lg font-bold">
                      UPC: {{ linkedItem.upc }}
                    </span>
                    <span v-if="linkedItem.locationSku" class="font-mono text-xs text-secondary font-bold bg-secondary/10 border border-secondary/25 px-2.5 py-1 rounded-lg">
                      SKU: {{ linkedItem.locationSku }}
                    </span>
                    <span class="badge badge-md font-bold" :class="linkedItem.status === 'sold' ? 'badge-success text-white' : 'badge-ghost'">
                      {{ linkedItem.status }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Item Logistics & Financial Metrics Grid -->
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-base-200/50 p-4 rounded-xl border border-base-300">
                <div>
                  <span class="text-[10px] font-black uppercase text-base-content/60 block">Warehouse Location</span>
                  <strong class="font-bold text-base-content truncate block text-sm mt-0.5">
                    {{ linkedItem.storageLocation || selectedWarehouse?.name || 'Unassigned' }}
                  </strong>
                </div>
                <div>
                  <span class="text-[10px] font-black uppercase text-base-content/60 block">Buy Cost (COGS)</span>
                  <strong class="font-mono font-black text-rose-600 dark:text-rose-400 block text-sm mt-0.5">
                    {{ formatCurrency(costBasis) }}
                  </strong>
                </div>
                <div class="col-span-2 sm:col-span-1">
                  <span class="text-[10px] font-black uppercase text-base-content/60 block">Inbound PO / Lot</span>
                  <a 
                    v-if="linkedItem.orderId" 
                    :href="`/purchases?search=${encodeURIComponent(linkedItem.orderId)}`" 
                    target="_blank" 
                    class="font-mono text-xs text-primary font-bold hover:underline truncate flex items-center gap-1 mt-0.5"
                  >
                    <span class="truncate">{{ linkedItem.orderId }}</span>
                    <Icon icon="solar:arrow-right-up-linear" class="w-3 h-3 shrink-0" />
                  </a>
                  <span v-else class="text-xs font-mono opacity-50 block mt-0.5">Direct Entry</span>
                </div>
              </div>

              <!-- Import Lineage Badge if from Ricochet / Memory Den Payout -->
              <div v-if="importBatchId" class="alert alert-info py-3 px-4 rounded-xl text-xs flex items-start gap-3 shadow-2xs">
                <Icon icon="solar:import-bold" class="w-5 h-5 text-info shrink-0 mt-0.5" />
                <div class="min-w-0 flex-1">
                  <div class="font-bold">Imported Consignment Payout Lineage</div>
                  <div class="opacity-80 font-mono text-[11px] truncate mt-0.5">Batch Reference: {{ importBatchId }}</div>
                  <div class="opacity-70 text-[10px] mt-0.5">Matched and synchronized from consignment POS sales report.</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Fallback when no linked item exists -->
          <div v-else class="card bg-base-100 shadow-sm border border-base-300 rounded-2xl p-6 text-center space-y-3">
            <Icon icon="solar:box-minimalistic-linear" class="w-12 h-12 opacity-40 mx-auto text-base-content" />
            <div class="font-bold text-base">No Inventory Item Linked</div>
            <p class="text-xs opacity-60 max-w-sm mx-auto">This order record was created without a direct inventory document link.</p>
            <button type="button" @click="isLocked = false" class="btn btn-sm btn-outline btn-primary font-bold rounded-xl">
              <span>Unlock to Link an Item</span>
            </button>
          </div>

          <!-- Order Identification & Audit Card -->
          <div class="card bg-base-100 shadow-sm border border-base-300 rounded-2xl overflow-hidden">
            <div class="p-4 bg-base-200/60 border-b border-base-300 flex items-center gap-2">
              <Icon icon="solar:clipboard-check-bold" class="w-4 h-4 text-base-content/70" />
              <span class="font-black text-xs uppercase tracking-wider text-base-content">Order Audit Details</span>
            </div>
            <div class="p-5 space-y-3 text-xs">
              <div class="flex justify-between items-center py-1.5 border-b border-base-200">
                <span class="font-bold text-base-content/70">Sales Order Number:</span>
                <span class="font-mono font-black text-sm">{{ form.soNumber }}</span>
              </div>
              <div class="flex justify-between items-center py-1.5 border-b border-base-200">
                <span class="font-bold text-base-content/70">Order / Ticket Reference:</span>
                <span class="font-mono font-bold">{{ form.orderId || 'None' }}</span>
              </div>
              <div class="flex justify-between items-center py-1.5 border-b border-base-200">
                <span class="font-bold text-base-content/70">Platform / Warehouse:</span>
                <span class="font-bold">{{ selectedWarehouse?.name || form.warehouseId || 'General' }}</span>
              </div>
              <div class="flex justify-between items-center py-1.5 border-b border-base-200">
                <span class="font-bold text-base-content/70">Fulfillment Status:</span>
                <span class="badge badge-sm font-bold" :class="getStatusBadgeClass(form.status || 'Sold')">
                  {{ form.status || 'Sold' }}
                </span>
              </div>
              <div v-if="daysInStock !== null" class="flex justify-between items-center py-1.5">
                <span class="font-bold text-base-content/70">Inventory Holding Period:</span>
                <span class="font-bold font-mono">{{ daysInStock }} day{{ daysInStock === 1 ? '' : 's' }}</span>
              </div>
            </div>
          </div>

        </div>

        <!-- Right Column: Official Settlement Voucher & P&L Statement (5 cols) -->
        <div class="lg:col-span-5 space-y-6">
          
          <div class="card bg-base-100 shadow-sm border border-base-300 rounded-2xl overflow-hidden">
            <div class="p-4 bg-base-200/60 border-b border-base-300 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Icon icon="solar:wallet-money-bold" class="w-4 h-4 text-success" />
                <span class="font-black text-xs uppercase tracking-wider text-base-content">Settlement & P&L Statement</span>
              </div>
              <span class="badge badge-sm font-mono font-bold">VOUCHER</span>
            </div>

            <div class="p-5 sm:p-6 space-y-4 text-xs">
              <!-- Gross Line -->
              <div class="flex justify-between items-center py-1.5 border-b border-base-200">
                <span class="font-bold text-base-content/70">Gross Retail Price</span>
                <span class="font-mono font-bold text-base text-base-content">{{ formatCurrency(form.grossAmount || 0) }}</span>
              </div>

              <!-- Platform Fee Line -->
              <div class="flex justify-between items-center py-1.5 border-b border-base-200">
                <span class="font-bold text-rose-700 dark:text-rose-400">
                  Platform Fee ({{ effectiveCommissionRate }}%)
                </span>
                <span class="font-mono font-bold text-rose-600 dark:text-rose-400 text-base">
                  -{{ formatCurrency(computedCommissionFee) }}
                </span>
              </div>

              <!-- Shipping Net Line if applicable -->
              <div v-if="Number(form.shippingCharged || 0) > 0 || Number(form.shippingCost || 0) > 0" class="flex justify-between items-center py-1.5 border-b border-base-200">
                <span class="font-bold text-base-content/70">Shipping Net</span>
                <span class="font-mono font-bold text-base" :class="shippingNet >= 0 ? 'text-base-content' : 'text-rose-600'">
                  {{ formatCurrency(shippingNet) }}
                </span>
              </div>

              <!-- Net Payout Box (Highlighted) -->
              <div class="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex justify-between items-center">
                <div>
                  <span class="font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider text-[11px] block">
                    Net Realized Payout
                  </span>
                  <span class="text-[10px] text-emerald-700/80">Cash settlement in-hand</span>
                </div>
                <span class="font-mono font-black text-xl text-emerald-700 dark:text-emerald-400">
                  {{ formatCurrency(computedNetPayout) }}
                </span>
              </div>

              <!-- Buy Cost (COGS) Line -->
              <div class="flex justify-between items-center py-1.5 border-b border-base-200">
                <span class="font-bold text-base-content/70">Less: Buy Cost Basis (COGS)</span>
                <span class="font-mono font-bold text-rose-600 dark:text-rose-400 text-base">
                  -{{ formatCurrency(costBasis) }}
                </span>
              </div>

              <!-- Realized Net Profit Box (Highlighted) -->
              <div 
                class="p-4 rounded-xl border flex justify-between items-center transition-colors"
                :class="netRealizedProfit >= 0 ? 'bg-emerald-500/15 border-emerald-500/30' : 'bg-rose-500/15 border-rose-500/30'"
              >
                <div>
                  <span 
                    class="font-black uppercase tracking-wider text-xs block flex items-center gap-1.5"
                    :class="netRealizedProfit >= 0 ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-800 dark:text-rose-300'"
                  >
                    <Icon :icon="netRealizedProfit >= 0 ? 'solar:cup-first-bold' : 'solar:danger-circle-bold'" class="w-4 h-4" />
                    <span>{{ netRealizedProfit >= 0 ? 'Realized Net Profit' : 'Realized Net Loss' }}</span>
                  </span>
                  <span 
                    class="text-[10px]"
                    :class="netRealizedProfit >= 0 ? 'text-emerald-700/80 dark:text-emerald-400/80' : 'text-rose-700/80 dark:text-rose-400/80'"
                  >
                    Final return on capital
                  </span>
                </div>
                <span 
                  class="font-mono font-black text-2xl"
                  :class="netRealizedProfit >= 0 ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-800 dark:text-rose-300'"
                >
                  {{ formatCurrency(netRealizedProfit) }}
                </span>
              </div>

              <!-- Financial Ratios Summary -->
              <div class="pt-2 grid grid-cols-2 gap-3 text-xs bg-base-200/40 p-3 rounded-xl border border-base-200">
                <div>
                  <span class="text-[10px] font-black uppercase text-base-content/60 block">Net Profit Margin</span>
                  <strong class="font-mono font-bold text-sm" :class="Number(profitMargin || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'">
                    {{ profitMargin || 0 }}%
                  </strong>
                </div>
                <div>
                  <span class="text-[10px] font-black uppercase text-base-content/60 block">Return on Investment</span>
                  <strong class="font-mono font-bold text-sm" :class="Number(roiPercent || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'">
                    {{ roiPercent !== null ? `${roiPercent}%` : 'N/A' }}
                  </strong>
                </div>
              </div>

            </div>
          </div>

        </div>

      </div>

      <!-- =================================================================== -->
      <!-- VIEW 2: EDIT / UNLOCKED MODE (FOR EDITING OR RECORDING NEW SALES)   -->
      <!-- =================================================================== -->
      <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        <!-- Left Column: Edit Form (7 cols) -->
        <div class="lg:col-span-7 space-y-6">
          <form @submit.prevent="saveSale" class="card bg-base-100 shadow-sm border border-base-300 rounded-2xl">
            <div class="card-body p-5 sm:p-6 space-y-5">
              
              <!-- Form Title & Mode Indicator -->
              <div class="flex items-center justify-between pb-3 border-b border-base-200">
                <div>
                  <h2 class="font-black text-xl text-base-content">
                    {{ isNew ? 'Record Sale Details' : 'Edit Sale Details' }}
                  </h2>
                  <p class="text-xs text-base-content/70">Update financial amounts, location platform, and inventory linkage</p>
                </div>
                <span class="badge badge-warning font-black text-xs gap-1.5 py-2.5 px-3">
                  <Icon icon="solar:pen-bold" class="w-3.5 h-3.5" /> Editing Mode
                </span>
              </div>

              <!-- Active Inventory Item Linker (If not already linked) -->
              <div v-if="!linkedItem" class="bg-base-200/60 p-4 rounded-2xl border border-base-300 space-y-3">
                <div class="flex items-center justify-between">
                  <label class="font-black text-xs uppercase tracking-wider text-base-content flex items-center gap-1.5">
                    <Icon icon="solar:box-minimalistic-bold" class="w-4 h-4 text-primary" />
                    Link Active Inventory Item
                  </label>
                  <span class="text-[11px] opacity-60">Auto-fills price, SKU, and location</span>
                </div>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div class="relative">
                    <Icon icon="solar:magnifer-linear" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
                    <input 
                      type="text" 
                      v-model="itemSearchQuery" 
                      placeholder="Search by title, SKU, UPC..." 
                      class="input input-bordered input-sm w-full pl-9 bg-base-100 rounded-xl text-xs h-10 min-h-10 border-base-300"
                    />
                  </div>
                  <select 
                    v-model="selectedDropdownItemId" 
                    @change="onDropdownItemSelect"
                    class="select select-bordered select-sm w-full bg-base-100 font-bold text-xs rounded-xl truncate h-10 min-h-10 border-base-300"
                  >
                    <option value="">Or choose from active inventory...</option>
                    <option v-for="item in availableActiveInventory.slice(0, 50)" :key="item.$id" :value="item.$id">
                      {{ item.title }} ({{ item.upc || item.locationSku || 'No SKU' }})
                    </option>
                  </select>
                </div>

                <!-- Instant Search Results Dropdown -->
                <div v-if="filteredAvailableItems.length > 0" class="max-h-48 overflow-y-auto space-y-1 bg-base-100 p-2 rounded-xl border border-base-300 shadow-sm mt-2">
                  <button 
                    type="button"
                    v-for="item in filteredAvailableItems.slice(0, 8)" 
                    :key="item.$id"
                    @click="selectItemToLink(item)"
                    class="w-full text-left p-2 hover:bg-base-200 rounded-lg flex items-center justify-between gap-2 text-xs transition-colors"
                  >
                    <div class="min-w-0">
                      <div class="font-bold truncate text-base-content">{{ item.title }}</div>
                      <div class="text-[10px] opacity-60 flex gap-2 font-mono mt-0.5">
                        <span v-if="item.upc">UPC: {{ item.upc }}</span>
                        <span v-if="item.locationSku">SKU: {{ item.locationSku }}</span>
                        <span class="text-success font-bold">${{ (item.resalePrice || item.listPrice || 0).toFixed(2) }}</span>
                      </div>
                    </div>
                    <span class="btn btn-xs btn-primary shrink-0 font-bold">Select</span>
                  </button>
                </div>
              </div>

              <!-- Core Order Fields Grid -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Location / Platform -->
                <div class="form-control w-full flex flex-col gap-1.5">
                  <label class="text-xs font-black uppercase tracking-wider text-base-content">
                    Location / Selling Platform
                  </label>
                  <select 
                    v-model="form.warehouseId" 
                    required 
                    class="select select-bordered select-sm w-full h-11 min-h-11 bg-base-100 font-bold text-xs rounded-xl border-base-300 focus:border-primary"
                  >
                    <option value="" disabled>Select Location</option>
                    <option v-for="wh in warehouses" :key="wh.$id" :value="wh.$id">
                      {{ wh.name }} ({{ wh.commissionRate ?? 0 }}% fee)
                    </option>
                    <option value="General">General / Direct Sale (0% fee)</option>
                  </select>
                </div>

                <!-- Sale Date -->
                <div class="form-control w-full flex flex-col gap-1.5">
                  <label class="text-xs font-black uppercase tracking-wider text-base-content">
                    Sale Date
                  </label>
                  <input 
                    type="date" 
                    v-model="form.saleDate" 
                    required 
                    class="input input-bordered input-sm w-full h-11 min-h-11 bg-base-100 font-mono font-bold text-xs rounded-xl border-base-300 focus:border-primary" 
                  />
                </div>

                <!-- Status -->
                <div class="form-control w-full flex flex-col gap-1.5">
                  <label class="text-xs font-black uppercase tracking-wider text-base-content">
                    Order Fulfillment Status
                  </label>
                  <select 
                    v-model="form.status" 
                    required 
                    class="select select-bordered select-sm w-full h-11 min-h-11 bg-base-100 font-bold text-xs rounded-xl border-base-300 focus:border-primary"
                  >
                    <option value="Sold">Sold (Settled / In Booth)</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Draft">Draft</option>
                    <option value="Returned">Returned</option>
                    <option value="Refunded">Refunded</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                <!-- External Order ID / Payout Ref -->
                <div class="form-control w-full flex flex-col gap-1.5">
                  <div class="flex justify-between items-center">
                    <label class="text-xs font-black uppercase tracking-wider text-base-content">Order / Payout ID</label>
                    <span class="opacity-50 text-[10px] font-bold">Reference</span>
                  </div>
                  <input 
                    type="text" 
                    v-model="form.orderId" 
                    placeholder="e.g. MD-PAYOUT, Ticket #, eBay..." 
                    class="input input-bordered input-sm w-full h-11 min-h-11 bg-base-100 font-mono font-bold text-xs rounded-xl border-base-300 focus:border-primary" 
                  />
                </div>
              </div>

              <!-- Financials Section Divider -->
              <div class="divider my-1 text-xs font-black uppercase tracking-wider text-base-content/60">
                Revenue & Pricing Splits
              </div>

              <!-- Dual Interactive Pricing Cards (Clean, Spaced, Zero Text Overlap) -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <!-- 1. Gross Sale Price -->
                <div class="p-4 rounded-2xl bg-base-200/40 border border-base-300 space-y-2">
                  <div class="flex justify-between items-center">
                    <label class="text-xs font-black uppercase tracking-wider text-base-content">Gross Retail Price</label>
                    <span class="badge badge-sm badge-ghost font-bold text-[10px]">Tag / Sticker</span>
                  </div>
                  <div class="relative">
                    <span class="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-sm text-base-content/50 pointer-events-none z-10">$</span>
                    <input 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      v-model.number="form.grossAmount" 
                      @input="onGrossChange" 
                      required 
                      class="input input-bordered w-full h-11 pl-8 bg-base-100 font-mono font-black text-lg text-base-content rounded-xl border-base-300 focus:border-primary" 
                    />
                  </div>
                  <p class="text-[11px] text-base-content/60 font-medium">Customer retail price paid at register</p>
                </div>

                <!-- 2. After-Commission Net Sold Price -->
                <div class="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                  <div class="flex justify-between items-center">
                    <label class="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      After-Commission Net
                    </label>
                    <span class="badge badge-sm badge-error font-bold text-[10px] text-white">
                      -{{ effectiveCommissionRate }}% Fee (-{{ formatCurrency(computedCommissionFee) }})
                    </span>
                  </div>
                  <div class="relative">
                    <span class="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-sm text-emerald-600 pointer-events-none z-10">$</span>
                    <input 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      v-model.number="manualNetSoldPrice" 
                      @input="onNetChange" 
                      placeholder="0.00" 
                      class="input input-bordered w-full h-11 pl-8 bg-base-100 font-mono font-black text-lg text-emerald-700 dark:text-emerald-400 rounded-xl border-emerald-500/40 focus:border-emerald-500" 
                    />
                  </div>
                  <p class="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 font-medium">Net cash payout realized into your account</p>
                </div>
              </div>

              <!-- Shipping Splits Row -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <!-- Shipping Charged -->
                <div class="form-control w-full flex flex-col gap-1.5">
                  <div class="flex justify-between items-center">
                    <label class="text-xs font-black uppercase tracking-wider text-base-content">Shipping Charged</label>
                    <span class="text-[10px] font-bold opacity-60">From Buyer ($0 in-booth)</span>
                  </div>
                  <div class="relative">
                    <span class="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-xs opacity-50 pointer-events-none z-10">$</span>
                    <input 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      v-model.number="form.shippingCharged" 
                      @input="onGrossChange" 
                      class="input input-bordered input-sm w-full h-11 pl-8 bg-base-100 font-mono text-sm rounded-xl border-base-300" 
                    />
                  </div>
                </div>

                <!-- Shipping Cost -->
                <div class="form-control w-full flex flex-col gap-1.5">
                  <div class="flex justify-between items-center">
                    <label class="text-xs font-black uppercase tracking-wider text-base-content">Shipping Cost</label>
                    <span class="text-[10px] font-bold opacity-60">Label Expense ($0 in-booth)</span>
                  </div>
                  <div class="relative">
                    <span class="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-xs opacity-50 pointer-events-none z-10">$</span>
                    <input 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      v-model.number="form.shippingCost" 
                      @input="onGrossChange" 
                      class="input input-bordered input-sm w-full h-11 pl-8 bg-base-100 font-mono text-sm rounded-xl border-base-300" 
                    />
                  </div>
                </div>
              </div>

              <!-- Form Action Footer -->
              <div class="mt-6 pt-4 border-t border-base-200 flex flex-col sm:flex-row justify-between items-center gap-3">
                <button 
                  v-if="!isNew" 
                  type="button" 
                  @click="isLocked = true" 
                  class="btn btn-sm btn-ghost rounded-xl font-bold w-full sm:w-auto h-10"
                >
                  Cancel / Done
                </button>
                <div v-else></div>

                <button 
                  type="submit" 
                  class="btn btn-sm btn-primary px-7 h-11 min-h-11 gap-2 font-black shadow-md shadow-primary/20 rounded-xl w-full sm:w-auto text-sm" 
                  :disabled="saving"
                >
                  <span v-if="saving" class="loading loading-spinner loading-xs"></span>
                  <Icon v-else icon="solar:diskette-bold" class="w-4 h-4" />
                  <span>{{ isNew ? 'Record Sale' : 'Save Changes' }}</span>
                </button>
              </div>

            </div>
          </form>
        </div>

        <!-- Right Column: Live Financial Preview Card (5 cols) -->
        <div class="lg:col-span-5 space-y-6">
          
          <!-- Linked Product Card Preview -->
          <div v-if="linkedItem" class="card bg-base-100 shadow-sm border border-base-300 rounded-2xl p-4 flex items-center gap-3.5">
            <ItemThumbnail :item="linkedItem" size="lg" rounded="xl" class="shadow-sm border border-base-300 shrink-0 w-16 h-16" />
            <div class="min-w-0 flex-1">
              <div class="font-black text-sm truncate text-base-content">{{ linkedItem.title }}</div>
              <div class="text-[11px] font-mono opacity-70 flex items-center gap-2 mt-1">
                <span v-if="linkedItem.upc">UPC: {{ linkedItem.upc }}</span>
                <span class="text-rose-600 font-bold">Cost: {{ formatCurrency(costBasis) }}</span>
              </div>
            </div>
          </div>

          <!-- Live Settlement Breakdown -->
          <div class="card bg-base-100 shadow-sm border border-base-300 rounded-2xl p-5 space-y-3.5 text-xs">
            <div class="flex items-center justify-between pb-2 border-b border-base-200">
              <h3 class="font-black text-sm flex items-center gap-2 text-base-content">
                <Icon icon="solar:wallet-money-bold" class="w-4 h-4 text-success" />
                <span>Real-Time P&L Preview</span>
              </h3>
              <span class="badge badge-xs badge-info font-bold">LIVE SYNC</span>
            </div>

            <div class="flex justify-between py-1 border-b border-base-200">
              <span class="font-bold text-base-content/70">Gross Sale Price</span>
              <span class="font-mono font-bold">{{ formatCurrency(form.grossAmount || 0) }}</span>
            </div>

            <div class="flex justify-between py-1 border-b border-base-200">
              <span class="font-bold text-rose-700 dark:text-rose-400">Platform Fee ({{ effectiveCommissionRate }}%)</span>
              <span class="font-mono font-bold text-rose-600 dark:text-rose-400">-{{ formatCurrency(computedCommissionFee) }}</span>
            </div>

            <div class="flex justify-between py-2 px-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-black">
              <span>Net Payout Realized</span>
              <span class="font-mono text-base">{{ formatCurrency(computedNetPayout) }}</span>
            </div>

            <div class="flex justify-between py-1 border-b border-base-200">
              <span class="font-bold text-base-content/70">Less: Buy Cost Basis</span>
              <span class="font-mono font-bold text-rose-600 dark:text-rose-400">-{{ formatCurrency(costBasis) }}</span>
            </div>

            <div 
              class="flex justify-between py-2.5 px-3 rounded-xl border transition-colors"
              :class="netRealizedProfit >= 0 ? 'bg-emerald-500/15 border-emerald-500/30' : 'bg-rose-500/15 border-rose-500/30'"
            >
              <span 
                class="font-black flex items-center gap-1.5 text-sm"
                :class="netRealizedProfit >= 0 ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-800 dark:text-rose-300'"
              >
                <Icon :icon="netRealizedProfit >= 0 ? 'solar:cup-first-bold' : 'solar:danger-circle-bold'" class="w-4 h-4" />
                <span>{{ netRealizedProfit >= 0 ? 'Realized Net Profit' : 'Realized Net Loss' }}</span>
              </span>
              <span 
                class="font-mono font-black text-base"
                :class="netRealizedProfit >= 0 ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-800 dark:text-rose-300'"
              >
                {{ formatCurrency(netRealizedProfit) }}
              </span>
            </div>
          </div>

        </div>

      </div>

    </div>

    <!-- Full-Screen Order Cancellation & Return Modal -->
    <dialog class="modal" :class="{'modal-open': showCancelModal}">
      <div class="modal-box max-w-lg bg-base-100 shadow-2xl border border-error/30 p-6 space-y-4 rounded-2xl">
        <div class="flex items-center gap-3 text-error">
          <div class="p-3 bg-error/10 rounded-2xl shrink-0">
            <Icon icon="solar:danger-triangle-bold" class="w-7 h-7" />
          </div>
          <div>
            <h3 class="font-black text-xl text-base-content">Cancel Order & Return Item</h3>
            <p class="text-xs text-error font-semibold">Drop from realized sales & restore active inventory</p>
          </div>
        </div>

        <p class="text-xs opacity-80 leading-relaxed">
          Cancelling this order will remove this sale from realized revenue and revert 
          <strong>"{{ linkedItem?.title || form.soNumber }}"</strong> back to active stock. 
          Please verify where this item is physically being returned.
        </p>

        <div class="bg-base-200/60 p-4 rounded-2xl border border-base-300 space-y-3.5">
          <!-- Revert Inventory Status -->
          <div class="form-control flex flex-col gap-1">
            <label class="text-xs font-bold text-base-content">Revert Item Inventory Status</label>
            <select v-model="cancelForm.status" class="select select-bordered select-sm w-full font-bold text-xs bg-base-100 rounded-xl h-10 min-h-10">
              <option value="received">Received (Back in Stock / Active Inventory)</option>
              <option value="placed">Placed (Return to Booth / Sales Floor)</option>
              <option value="acquired">Acquired (Backlog / Needs Prep)</option>
            </select>
          </div>

          <!-- Verified Return Location -->
          <div class="grid grid-cols-2 gap-3">
            <div class="form-control flex flex-col gap-1">
              <label class="text-xs font-bold text-base-content">Return Facility</label>
              <select v-model="cancelForm.facility" class="select select-bordered select-sm w-full font-bold text-xs bg-base-100 rounded-xl h-10 min-h-10">
                <option value="HG">Huck's Garage (HG)</option>
                <option value="MD">Memory Den (MD)</option>
                <option value="DT">Dusty Tiger (DT)</option>
                <option value="HD">Hideout (HD)</option>
              </select>
            </div>

            <div class="form-control flex flex-col gap-1">
              <label class="text-xs font-bold text-base-content">Return Bin / Shelf</label>
              <input 
                type="text" 
                v-model="cancelForm.bin" 
                placeholder="e.g. RED BIN-16" 
                class="input input-bordered input-sm w-full font-mono text-xs bg-base-100 uppercase rounded-xl h-10 min-h-10"
              />
            </div>
          </div>
        </div>

        <div class="modal-action flex justify-end gap-2 pt-2">
          <button type="button" @click="showCancelModal = false" class="btn btn-sm btn-ghost rounded-xl font-bold" :disabled="cancelling">
            Keep Order
          </button>
          <button 
            type="button" 
            @click="confirmCancelOrder" 
            :disabled="cancelling" 
            class="btn btn-sm btn-error text-white font-black gap-2 rounded-xl shadow-md shadow-error/20"
          >
            <span v-if="cancelling" class="loading loading-spinner loading-xs"></span>
            <Icon v-else icon="solar:trash-bin-trash-bold" class="w-4 h-4" />
            <span>Confirm Cancellation & Return</span>
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showCancelModal = false">
        <button>close</button>
      </form>
    </dialog>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { Icon } from '@iconify/vue';
import ItemThumbnail from '../common/ItemThumbnail.vue';
import { useAuth } from '../../composables/useAuth';
import { useInventory } from '../../composables/useInventory';
import { salesApi } from '../../lib/sales';
import { warehousesApi, findFacility, KNOWN_FACILITIES } from '../../lib/warehouses';
import { databases, Query } from '../../lib/appwrite';
import { addToast } from '../../stores/toast';
import type { SaleData, SaleDocument } from '../../lib/sales';
import type { WarehouseDocument } from '../../lib/warehouses';

const props = defineProps<{ saleId?: string }>();
const { currentTeam } = useAuth();
const { inventoryItems, fetchInventory } = useInventory();

const warehouses = ref<WarehouseDocument[]>([]);
const loading = ref(true);
const saving = ref(false);
const cancelling = ref(false);
const error = ref('');

// Lock / Edit Mode Toggle: Default locked for existing sales; unlocked for new sales
const isLocked = ref(true);

// Linked Inventory Item state
const linkedItem = ref<any>(null);
const linkedItemId = ref('');
const isLinkedInventoryItem = ref(false);
const itemSearchQuery = ref('');
const selectedDropdownItemId = ref('');

// Two-way financial inputs
const manualNetSoldPrice = ref<number>(0);

// Cancel Order Modal state
const showCancelModal = ref(false);
const cancelForm = ref({
  status: 'received',
  facility: 'HG',
  bin: ''
});

// Robust saleId getter with URL pathname fallback
const getEffectiveSaleId = (): string => {
  if (props.saleId && props.saleId !== 'new') return props.saleId;
  if (typeof window !== 'undefined') {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && last !== 'new' && last !== 'sales') {
      return last;
    }
  }
  return '';
};

const effectiveSaleId = computed(() => getEffectiveSaleId());
const isNew = computed(() => !effectiveSaleId.value);

const form = ref<Partial<SaleData>>({
  soNumber: '',
  warehouseId: '',
  orderId: '',
  saleDate: new Date().toISOString().split('T')[0],
  status: 'Sold',
  grossAmount: 0,
  shippingCharged: 0,
  shippingCost: 0,
  commissionFee: 0,
  netPayout: 0,
  tenantId: ''
});

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const getStatusBadgeClass = (status: string) => {
  const s = (status || '').toLowerCase();
  if (s === 'sold' || s === 'completed' || s === 'paid') return 'badge-success text-white font-black';
  if (s === 'shipped') return 'badge-primary text-white font-bold';
  if (s === 'delivered') return 'badge-info text-white font-bold';
  if (s === 'returned' || s === 'refunded' || s === 'cancelled') return 'badge-error text-white font-bold';
  return 'badge-neutral font-bold';
};

// Robust warehouse resolver matching code, name, and facility aliases
const resolveWarehouseId = (locStr?: string): string => {
  if (!locStr) return '';
  const trimmed = locStr.trim();
  
  // 1. Direct ID match
  const byId = warehouses.value.find(w => w.$id === trimmed);
  if (byId) return byId.$id;
  
  // 2. Direct code match (MD, DT, HG, HD)
  const byCode = warehouses.value.find(w => w.code && w.code.toUpperCase() === trimmed.toUpperCase());
  if (byCode) return byCode.$id;
  
  // 3. Facility definition helper match
  const fac = findFacility(trimmed);
  if (fac) {
    const byFac = warehouses.value.find(w => 
      (w.code && w.code.toUpperCase() === fac.code.toUpperCase()) ||
      findFacility(w.name)?.code === fac.code
    );
    if (byFac) return byFac.$id;
  }
  
  // 4. Normalized string match
  const clean = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
  const byName = warehouses.value.find(w => {
    const wClean = w.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return wClean === clean || wClean.includes(clean) || clean.includes(wClean);
  });
  return byName?.$id || '';
};

const selectedWarehouse = computed(() => {
  return warehouses.value.find(w => w.$id === form.value.warehouseId);
});

// Effective Commission Rate: checks warehouse rate, or infers from historical commissionFee / grossAmount
const effectiveCommissionRate = computed(() => {
  if (selectedWarehouse.value && selectedWarehouse.value.commissionRate !== undefined && selectedWarehouse.value.commissionRate !== null) {
    return Number(selectedWarehouse.value.commissionRate);
  }
  const gross = Number(form.value.grossAmount) || 0;
  const fee = Number(form.value.commissionFee) || 0;
  if (gross > 0 && fee > 0) {
    return Number(((fee / gross) * 100).toFixed(1));
  }
  return 0;
});

const shippingNet = computed(() => {
  const charged = Number(form.value.shippingCharged) || 0;
  const cost = Number(form.value.shippingCost) || 0;
  return charged - cost;
});

const computedCommissionFee = computed(() => {
  const gross = Number(form.value.grossAmount) || 0;
  if (gross <= 0) return 0;
  if (isLocked.value && form.value.commissionFee !== undefined && form.value.commissionFee !== null && Number(form.value.commissionFee) > 0) {
    return Number(form.value.commissionFee);
  }
  const rate = effectiveCommissionRate.value;
  return Number(((gross * rate) / 100).toFixed(2));
});

const computedNetPayout = computed(() => {
  if (isLocked.value && form.value.netPayout !== undefined && form.value.netPayout !== null && Number(form.value.netPayout) > 0) {
    return Number(form.value.netPayout);
  }
  const gross = Number(form.value.grossAmount) || 0;
  return Number((gross + shippingNet.value - computedCommissionFee.value).toFixed(2));
});

// Synchronize Gross Tag Price and After-Commission Net Sold Price
const onGrossChange = () => {
  const gross = Number(form.value.grossAmount) || 0;
  const rate = effectiveCommissionRate.value;
  const fee = Number(((gross * rate) / 100).toFixed(2));
  form.value.commissionFee = fee;
  manualNetSoldPrice.value = Number((gross - fee + shippingNet.value).toFixed(2));
  form.value.netPayout = manualNetSoldPrice.value;
};

const onNetChange = () => {
  const net = Number(manualNetSoldPrice.value) || 0;
  const rate = effectiveCommissionRate.value;
  if (rate >= 100) {
    form.value.grossAmount = net;
    form.value.commissionFee = 0;
    form.value.netPayout = net;
    return;
  }
  const adjustedNet = Math.max(0, net - shippingNet.value);
  const gross = Number((adjustedNet / (1 - (rate / 100))).toFixed(2));
  form.value.grossAmount = gross;
  form.value.commissionFee = Number((gross - adjustedNet).toFixed(2));
  form.value.netPayout = net;
};

watch(() => form.value.warehouseId, () => {
  onGrossChange();
});

const toggleLock = () => {
  isLocked.value = !isLocked.value;
  if (!isLocked.value) {
    // Entering edit mode: ensure manualNetSoldPrice is in sync
    manualNetSoldPrice.value = computedNetPayout.value;
  }
};

// Reseller Profit & Margins
const costBasis = computed(() => {
  return Number(linkedItem.value?.cost || linkedItem.value?.purchasePrice || 0);
});

const netRealizedProfit = computed(() => {
  return Number((computedNetPayout.value - costBasis.value).toFixed(2));
});

const roiPercent = computed(() => {
  if (costBasis.value <= 0) return null;
  return ((netRealizedProfit.value / costBasis.value) * 100).toFixed(1);
});

const profitMargin = computed(() => {
  const gross = Number(form.value.grossAmount) || 0;
  if (gross <= 0) return null;
  return ((netRealizedProfit.value / gross) * 100).toFixed(1);
});

const daysInStock = computed(() => {
  const acquired = linkedItem.value?.purchaseDate || linkedItem.value?.$createdAt;
  const sold = form.value.saleDate || new Date();
  if (!acquired) return null;
  try {
    const diff = new Date(sold).getTime() - new Date(acquired).getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  } catch {
    return null;
  }
});

const importBatchId = computed(() => {
  const sId = linkedItem.value?.saleId;
  const oId = form.value.orderId;
  if (sId && (sId.startsWith('MD-PAYOUT') || sId.startsWith('IMP-'))) return sId;
  if (oId && (oId.startsWith('MD-PAYOUT') || oId.startsWith('IMP-'))) return oId;
  return null;
});

// Active inventory available for linking
const availableActiveInventory = computed(() => {
  return inventoryItems.value.filter(item => item.status !== 'archived');
});

// Search active items for linking to a new sale
const filteredAvailableItems = computed(() => {
  const q = itemSearchQuery.value.toLowerCase().trim();
  if (!q) return [];
  return availableActiveInventory.value.filter(item => {
    return (
      (item.title || '').toLowerCase().includes(q) ||
      (item.upc || '').toLowerCase().includes(q) ||
      (item.locationSku || '').toLowerCase().includes(q)
    );
  });
});

const selectItemToLink = (item: any) => {
  linkedItem.value = item;
  linkedItemId.value = item.$id;
  isLinkedInventoryItem.value = true;
  itemSearchQuery.value = '';
  selectedDropdownItemId.value = item.$id;

  // Auto-fill sale fields from item
  form.value.soNumber = item.upc || item.locationSku || form.value.soNumber;
  form.value.orderId = item.locationSku || item.upc || item.sku || '';
  form.value.grossAmount = Number(item.resalePrice || item.listPrice || item.soldPrice || 0);
  form.value.status = 'Sold';

  const loc = (Array.isArray(item.sellingLocations) ? item.sellingLocations[0] : item.sellingLocations) || item.storageLocation;
  if (loc) {
    const matchedWhId = resolveWarehouseId(loc);
    if (matchedWhId) form.value.warehouseId = matchedWhId;
  }
  onGrossChange();
  addToast(`Linked to "${item.title}"`, 'info');
};

const onDropdownItemSelect = () => {
  if (!selectedDropdownItemId.value) return;
  const item = inventoryItems.value.find(i => i.$id === selectedDropdownItemId.value);
  if (item) selectItemToLink(item);
};

const loadData = async () => {
  loading.value = true;
  error.value = '';
  const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
  const targetId = effectiveSaleId.value;

  try {
    // 1. Load warehouses: fetch all available warehouses + team warehouses if currentTeam exists
    try {
      const allWhs = await databases.listDocuments(DB_ID, 'warehouses', [Query.limit(100)]).catch(() => ({ documents: [] }));
      const teamWhs = currentTeam.value ? await warehousesApi.listWarehouses(currentTeam.value.$id).catch(() => []) : [];
      const whMap = new Map<string, WarehouseDocument>();
      [...allWhs.documents, ...teamWhs].forEach((w: any) => whMap.set(w.$id, w));
      warehouses.value = Array.from(whMap.values());
    } catch (e) {
      console.warn('Error loading warehouses:', e);
    }

    if (currentTeam.value && inventoryItems.value.length === 0) {
      fetchInventory(currentTeam.value.$id).catch(() => {});
    }
    
    if (targetId) {
      isLocked.value = true; // Default locked when opening an existing sale
      try {
        // Load from sales collection
        const sale = await salesApi.getSale(targetId);
        form.value = { ...sale };
        if (form.value.saleDate) {
          form.value.saleDate = new Date(form.value.saleDate).toISOString().split('T')[0];
        }

        // Ensure the warehouse document is available in warehouses.value
        if (sale.warehouseId && !warehouses.value.some(w => w.$id === sale.warehouseId)) {
          try {
            const whDoc = await databases.getDocument(DB_ID, 'warehouses', sale.warehouseId);
            if (whDoc) warehouses.value.push(whDoc as any);
          } catch (whErr) {
            console.warn('Could not fetch warehouse document:', whErr);
          }
        }

        // Match warehouse ID
        if (sale.warehouseId) {
          form.value.warehouseId = resolveWarehouseId(sale.warehouseId) || sale.warehouseId;
        }

        // Preserve saved financial amounts
        if (sale.commissionFee !== undefined && sale.commissionFee !== null) {
          form.value.commissionFee = Number(sale.commissionFee);
        }
        if (sale.netPayout !== undefined && sale.netPayout !== null) {
          form.value.netPayout = Number(sale.netPayout);
          manualNetSoldPrice.value = Number(sale.netPayout);
        } else {
          manualNetSoldPrice.value = computedNetPayout.value;
        }

        // Search for linked item in memory or DB (by upc, locationSku, saleId, or document ID)
        let foundItem = inventoryItems.value.find(i => 
          i.saleId === sale.$id || 
          (sale.orderId && (i.upc === sale.orderId || i.locationSku === sale.orderId || i.$id === sale.orderId)) ||
          (sale.soNumber && (i.upc === sale.soNumber || i.locationSku === sale.soNumber))
        );

        if (!foundItem && sale.orderId) {
          // Search DB by upc
          try {
            const upcRes = await databases.listDocuments(DB_ID, 'items', [
              Query.equal('upc', sale.orderId),
              Query.limit(1)
            ]);
            if (upcRes.documents.length > 0) foundItem = upcRes.documents[0];
          } catch {}

          // Search DB by locationSku
          if (!foundItem) {
            try {
              const skuRes = await databases.listDocuments(DB_ID, 'items', [
                Query.equal('locationSku', sale.orderId),
                Query.limit(1)
              ]);
              if (skuRes.documents.length > 0) foundItem = skuRes.documents[0];
            } catch {}
          }
        }

        if (foundItem) {
          linkedItem.value = foundItem;
          linkedItemId.value = foundItem.$id;
          if (!form.value.warehouseId) {
            const itemLoc = (Array.isArray(foundItem.sellingLocations) ? foundItem.sellingLocations[0] : foundItem.sellingLocations) || foundItem.storageLocation;
            form.value.warehouseId = resolveWarehouseId(itemLoc);
          }
          if (!form.value.grossAmount && (foundItem.resalePrice || foundItem.listPrice || foundItem.soldPrice)) {
            form.value.grossAmount = Number(foundItem.resalePrice || foundItem.listPrice || foundItem.soldPrice || 0);
          }
        }
        manualNetSoldPrice.value = computedNetPayout.value;
      } catch (saleErr: any) {
        // Fallback: Props.saleId is an inventory item ID
        try {
          const itemDoc = await databases.getDocument(DB_ID, 'items', targetId) as any;
          if (itemDoc) {
            isLinkedInventoryItem.value = true;
            linkedItem.value = itemDoc;
            linkedItemId.value = itemDoc.$id;

            form.value.soNumber = itemDoc.upc || itemDoc.locationSku || await salesApi.generateSoNumber(currentTeam.value.$id);
            form.value.orderId = itemDoc.saleId || itemDoc.locationSku || itemDoc.upc || itemDoc.title;
            form.value.grossAmount = Number(itemDoc.resalePrice || itemDoc.listPrice || itemDoc.soldPrice || 0);
            form.value.status = 'Sold';
            form.value.saleDate = itemDoc.$updatedAt ? new Date(itemDoc.$updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            
            // Match warehouse
            const locName = (Array.isArray(itemDoc.sellingLocations) ? itemDoc.sellingLocations[0] : itemDoc.sellingLocations) || itemDoc.storageLocation;
            if (locName) {
              const matchedWhId = resolveWarehouseId(locName);
              if (matchedWhId) form.value.warehouseId = matchedWhId;
            }
            onGrossChange();
          } else {
            throw saleErr;
          }
        } catch {
          throw saleErr;
        }
      }
    } else {
      // New sale: Unlocked by default
      isLocked.value = false;
      if (currentTeam.value) {
        form.value.soNumber = await salesApi.generateSoNumber(currentTeam.value.$id).catch(() => `SO-${Date.now().toString().slice(-4)}`);
      } else {
        form.value.soNumber = `SO-${Date.now().toString().slice(-4)}`;
      }
      form.value.status = 'Sold';
      
      const mdWh = warehouses.value.find(w => w.code === 'MD' || w.name.toLowerCase().includes('memory den'));
      form.value.warehouseId = mdWh?.$id || warehouses.value[0]?.$id || '';

      // Check URL query parameters for ?itemId=...
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const qId = params.get('itemId') || params.get('item') || params.get('id') || params.get('sku');
        if (qId) {
          const found = inventoryItems.value.find(i => i.$id === qId || i.locationSku === qId || i.upc === qId);
          if (found) {
            selectItemToLink(found);
          }
        }
      }
    }
  } catch (err: any) {
    console.error('Error loading sale editor:', err);
    error.value = err.message || 'Failed to load data';
  } finally {
    loading.value = false;
  }
};

const saveSale = async () => {
  if (!currentTeam.value) return;
  saving.value = true;
  error.value = '';
  const targetId = effectiveSaleId.value;

  try {
    const payload: SaleData = {
      soNumber: form.value.soNumber!,
      warehouseId: form.value.warehouseId || 'General',
      orderId: form.value.orderId,
      saleDate: form.value.saleDate ? new Date(form.value.saleDate).toISOString() : undefined,
      status: form.value.status || 'Sold',
      grossAmount: Number(form.value.grossAmount) || 0,
      shippingCharged: Number(form.value.shippingCharged) || 0,
      shippingCost: Number(form.value.shippingCost) || 0,
      commissionFee: computedCommissionFee.value,
      netPayout: computedNetPayout.value,
      tenantId: currentTeam.value.$id
    };

    const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';

    if (isNew.value || isLinkedInventoryItem.value) {
      const newSale = await salesApi.createSale(payload);
      if (linkedItemId.value) {
        try {
          await databases.updateDocument(DB_ID, 'items', linkedItemId.value, { 
            saleId: newSale.$id,
            status: 'sold',
            soldPrice: payload.grossAmount
          });
        } catch (itemErr) {
          console.warn('Could not link saleId to item:', itemErr);
        }
      }
      addToast(`Sale ${payload.soNumber} recorded successfully!`, 'success');
      window.location.href = `/sales/${newSale.$id}`;
    } else {
      await salesApi.updateSale(targetId, payload);
      if (linkedItemId.value) {
        try {
          await databases.updateDocument(DB_ID, 'items', linkedItemId.value, { 
            saleId: targetId,
            status: payload.status === 'Cancelled' ? 'received' : 'sold',
            soldPrice: payload.grossAmount
          });
        } catch (itemErr) {
          console.warn('Could not update item sold status:', itemErr);
        }
      }
      // Return to locked view on successful save
      isLocked.value = true;
      addToast(`Sale ${payload.soNumber} updated successfully!`, 'success');
    }
  } catch (err: any) {
    console.error('Error saving sale:', err);
    error.value = err.message || 'Failed to save sale';
    addToast(error.value, 'error');
  } finally {
    saving.value = false;
  }
};

const openCancelModal = () => {
  cancelForm.value.status = 'received';
  cancelForm.value.facility = selectedWarehouse.value?.code || 'HG';
  cancelForm.value.bin = linkedItem.value?.bin || '';
  showCancelModal.value = true;
};

const confirmCancelOrder = async () => {
  if (!currentTeam.value) return;
  const targetId = effectiveSaleId.value;
  if (!targetId) return;
  
  cancelling.value = true;
  const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';

  try {
    // 1. Mark sale status as Cancelled
    await salesApi.updateSale(targetId, {
      status: 'Cancelled',
      grossAmount: 0,
      netPayout: 0,
      commissionFee: 0
    });
    form.value.status = 'Cancelled';
    form.value.grossAmount = 0;
    form.value.netPayout = 0;
    form.value.commissionFee = 0;

    // 2. Revert linked item status and storage location
    if (linkedItem.value?.$id) {
      const formattedLoc = warehousesApi.formatWarehouseBin(cancelForm.value.facility, cancelForm.value.bin);
      await databases.updateDocument(DB_ID, 'items', linkedItem.value.$id, {
        status: cancelForm.value.status,
        storageLocation: formattedLoc,
        saleId: null,
        soldPrice: null
      });
      addToast(`Order cancelled. "${linkedItem.value.title}" returned to ${formattedLoc}`, 'info');
    } else {
      addToast(`Order ${form.value.soNumber} cancelled.`, 'info');
    }

    showCancelModal.value = false;
    isLocked.value = true;
  } catch (err: any) {
    console.error('Error cancelling order:', err);
    addToast(err.message || 'Failed to cancel order', 'error');
  } finally {
    cancelling.value = false;
  }
};

onMounted(() => {
  loadData();
});

watch(currentTeam, (newTeam) => {
  if (newTeam) {
    loadData();
  }
});
</script>
