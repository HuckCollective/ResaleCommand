<template>
  <div class="max-w-4xl mx-auto space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-base-100 p-5 sm:p-6 rounded-3xl border border-base-300 shadow-sm">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <div class="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black">
            <Icon icon="solar:printer-bold" class="w-6 h-6" />
          </div>
          <div>
            <h1 class="text-xl sm:text-2xl font-black text-base-content tracking-tight">Rollo Thermal Print Studio</h1>
            <p class="text-xs text-base-content/60 font-mono">Custom Partner Orgs • Manual Overrides • Dual-ID &amp; Pure UPC • 1D/2D QR</p>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <a href="/inventory" class="btn btn-sm btn-ghost gap-1 font-bold">
          <Icon icon="solar:arrow-left-linear" class="w-4 h-4" />
          <span>Back to Inventory</span>
        </a>
      </div>
    </div>

    <!-- Main Workbench Grid: Controls on Left, Live Preview on Right -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      <!-- Left Column: Controls (7 cols) -->
      <div class="lg:col-span-7 space-y-5">
        
        <!-- 1. Venue & Partner Org Selector -->
        <div class="bg-base-100 p-5 rounded-3xl border border-base-300 shadow-sm space-y-3">
          <div class="flex items-center justify-between">
            <label class="text-xs font-black uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
              <Icon icon="solar:shop-bold" class="w-4 h-4 text-primary" />
              <span>Partner Org &amp; Venue Profile</span>
            </label>
            <div class="flex items-center gap-1.5">
              <button 
                type="button" 
                @click="showPartnerCreator = !showPartnerCreator" 
                class="btn btn-xs btn-outline border-base-300 font-bold gap-1 rounded-xl hover:btn-primary"
              >
                <Icon :icon="showPartnerCreator ? 'solar:close-circle-bold' : 'solar:add-circle-bold'" class="w-3.5 h-3.5" />
                <span>{{ showPartnerCreator ? 'Close' : '+ New Partner Org' }}</span>
              </button>
              <span class="badge badge-sm font-mono font-bold" :class="activeLocation.badgeClass">
                {{ activeLocation.badge }}
              </span>
            </div>
          </div>

          <!-- Inline Partner Org Creator Card -->
          <div v-if="showPartnerCreator" class="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-3 transition-all">
            <div class="flex items-center justify-between">
              <span class="text-xs font-black text-primary flex items-center gap-1">
                <Icon icon="solar:user-plus-rounded-bold" class="w-4 h-4" />
                <span>Define New Partner Org / Custom Venue</span>
              </span>
              <span class="text-[10px] font-mono text-base-content/60">Saved locally in browser</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div class="space-y-1">
                <label class="text-[10px] font-bold text-base-content/70">Partner Org Name</label>
                <input 
                  v-model="newPartnerForm.name" 
                  type="text" 
                  class="input input-xs input-bordered w-full font-bold rounded-lg"
                  placeholder="e.g. Rose City Retro Co-Op"
                />
              </div>

              <div class="space-y-1">
                <label class="text-[10px] font-bold text-base-content/70">Label Header (Printed on Tag)</label>
                <input 
                  v-model="newPartnerForm.vendorHeader" 
                  type="text" 
                  class="input input-xs input-bordered w-full font-mono text-xs uppercase font-black rounded-lg"
                  placeholder="ROSE CITY RETRO"
                />
              </div>

              <div class="space-y-1">
                <label class="text-[10px] font-bold text-base-content/70">Identifier Structure</label>
                <select 
                  v-model="newPartnerForm.archetype" 
                  class="select select-xs select-bordered w-full font-bold text-[11px] rounded-lg"
                >
                  <option value="pure_upc">Pure UPC / Org Code (Single ID)</option>
                  <option value="dual_id">Dual-ID (Store Register SKU + UPC)</option>
                  <option value="warehouse_bin">Warehouse (UPC + Bin / Shelf)</option>
                </select>
              </div>

              <div class="space-y-1">
                <label class="text-[10px] font-bold text-base-content/70">Default Barcode Prefix</label>
                <input 
                  v-model="newPartnerForm.defaultSkuPrefix" 
                  type="text" 
                  class="input input-xs input-bordered w-full font-mono text-xs uppercase rounded-lg"
                  placeholder="RCR-"
                />
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-1">
              <button 
                type="button" 
                @click="showPartnerCreator = false" 
                class="btn btn-xs btn-ghost rounded-lg font-bold"
              >
                Cancel
              </button>
              <button 
                type="button" 
                @click="saveNewPartnerOrg" 
                class="btn btn-xs btn-primary text-primary-content rounded-lg font-bold gap-1"
                :disabled="!newPartnerForm.name || !newPartnerForm.vendorHeader"
              >
                <Icon icon="solar:disk-bold" class="w-3.5 h-3.5" />
                <span>Save &amp; Select Partner</span>
              </button>
            </div>
          </div>

          <!-- Target Venue Dropdown & Header Input -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <label class="text-[11px] font-bold text-base-content/70">Select Target Venue / Partner</label>
                <button 
                  v-if="activeLocation.isCustomPartner" 
                  type="button" 
                  @click="deleteCustomPartner(activeLocation.id)" 
                  class="text-[10px] text-error hover:underline font-mono"
                  title="Remove this custom partner profile"
                >
                  Remove Partner
                </button>
              </div>
              <select 
                v-model="selectedLocationId" 
                @change="handleLocationChange"
                class="select select-sm select-bordered w-full font-bold text-xs rounded-xl"
              >
                <optgroup label="Standard Venues &amp; Channels">
                  <option v-for="loc in standardLocations" :key="loc.id" :value="loc.id">
                    {{ loc.icon }} {{ loc.name }} ({{ loc.code }})
                  </option>
                </optgroup>
                <optgroup v-if="savedCustomPartners.length > 0" label="Custom Partner Organizations">
                  <option v-for="loc in savedCustomPartners" :key="loc.id" :value="loc.id">
                    ⭐ {{ loc.name }} ({{ loc.code }})
                  </option>
                </optgroup>
              </select>
            </div>

            <div class="space-y-1">
              <label class="text-[11px] font-bold text-base-content/70">Header on Printed Label</label>
              <input 
                v-model="vendorHeader" 
                type="text" 
                class="input input-sm input-bordered w-full font-mono text-xs rounded-xl uppercase font-black"
                placeholder="MEMORY DEN"
              />
            </div>
          </div>

          <!-- Active Venue Context Banner -->
          <div class="bg-base-200/60 rounded-2xl p-3 text-xs text-base-content/70 flex items-start gap-2.5">
            <Icon icon="solar:info-circle-bold" class="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div class="space-y-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-black text-base-content text-[11px]">{{ activeLocation.desc }}</span>
                <span class="badge badge-xs font-mono font-bold" :class="effectiveHasStoreSku ? 'badge-primary' : 'badge-neutral'">
                  {{ effectiveHasStoreSku ? 'Dual-ID (Store SKU + UPC)' : (effectiveSupportsBin ? 'Warehouse (UPC + Bin)' : 'Pure UPC / Asset Code') }}
                </span>
              </div>
              <p class="font-mono text-[10px] text-base-content/60">
                <span v-if="effectiveHasStoreSku">
                  Dual-ID: Scans register SKU (<code>0EJ...</code>) with canonical UPC fallback.
                </span>
                <span v-else-if="effectiveSupportsBin">
                  Warehouse mode: Scans canonical UPC (<code>{{ activeLocation.defaultSkuPrefix }}xxxx</code>). Physical bin printed.
                </span>
                <span v-else>
                  Pure UPC mode: Scans single canonical UPC (<code>{{ activeLocation.defaultSkuPrefix || '12-Digit' }}</code>).
                </span>
              </p>
            </div>
          </div>
        </div>

        <!-- 2. Manual Overrides Panel (Collapsible / Granular) -->
        <div class="bg-base-100 p-5 rounded-3xl border border-base-300 shadow-sm space-y-3">
          <div class="flex items-center justify-between">
            <label class="text-xs font-black uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
              <Icon icon="solar:tuning-square-bold" class="w-4 h-4 text-warning" />
              <span>Manual Label &amp; Barcode Overrides</span>
            </label>
            <span v-if="hasActiveOverrides" class="badge badge-xs badge-warning font-bold font-mono">
              Overrides Active
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <!-- Identifier Mode Override -->
            <div class="space-y-1">
              <label class="text-[11px] font-bold text-base-content/70">Identifier Structure Override</label>
              <select 
                v-model="overrideIdentifierMode" 
                class="select select-sm select-bordered w-full font-bold text-xs rounded-xl"
              >
                <option value="auto">Auto (Match Venue Default)</option>
                <option value="dual">Dual-ID (Store SKU + Canonical UPC)</option>
                <option value="pure_upc">Pure UPC / Barcode (Single Identifier)</option>
                <option value="bin">Warehouse (UPC + Storage Bin/Tote)</option>
              </select>
            </div>

            <!-- Barcode Authority Override -->
            <div class="space-y-1">
              <label class="text-[11px] font-bold text-base-content/70">Scanned Barcode Authority</label>
              <select 
                v-model="overrideBarcodeAuthority" 
                class="select select-sm select-bordered w-full font-bold text-xs rounded-xl"
              >
                <option value="auto">Auto (Store SKU if present, else UPC)</option>
                <option value="upc">Force Canonical UPC</option>
                <option value="store_sku">Force Store / POS SKU</option>
                <option value="custom">Force Custom Barcode String...</option>
              </select>
            </div>
          </div>

          <!-- Custom Barcode Value Input (if Custom selected) -->
          <div v-if="overrideBarcodeAuthority === 'custom'" class="space-y-1 pt-1">
            <label class="text-[11px] font-bold text-warning">Custom Barcode String to Encode</label>
            <input 
              v-model="customBarcodeValue" 
              type="text" 
              class="input input-sm input-bordered w-full font-mono font-bold text-xs rounded-xl uppercase text-warning"
              placeholder="e.g. SPECIAL-PROMO-99 or ORG-4401"
            />
          </div>

          <!-- Custom Caption Override Checkbox & Input -->
          <div class="pt-2 border-t border-base-200 space-y-2">
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <input 
                type="checkbox" 
                v-model="useCustomCaption" 
                class="checkbox checkbox-xs checkbox-warning rounded-md"
              />
              <span class="text-xs font-bold text-base-content/80">Override Printed Caption Text</span>
            </label>

            <div v-if="useCustomCaption" class="space-y-1">
              <input 
                v-model="customCaptionText" 
                type="text" 
                class="input input-sm input-bordered w-full font-mono font-bold text-xs rounded-xl"
                placeholder="e.g. CONSIGNOR #14 • PDXGL or BOOTH 42 • FINAL SALE"
              />
              <p class="text-[10px] text-base-content/50 font-mono">This exact text will print beneath the barcode/QR code on physical tags.</p>
            </div>
          </div>
        </div>

        <!-- 3. Barcode Type & 2D Mini QR Toggle -->
        <div class="bg-base-100 p-5 rounded-3xl border border-base-300 shadow-sm space-y-3">
          <div class="flex items-center justify-between">
            <label class="text-xs font-black uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
              <Icon icon="solar:scanner-bold" class="w-4 h-4 text-secondary" />
              <span>Barcode Format &amp; Mini QR</span>
            </label>
            <span class="badge badge-xs font-mono font-bold" :class="selectedBarcodeType === 'qr' ? 'badge-secondary' : 'badge-neutral'">
              {{ selectedBarcodeType === 'qr' ? '2D Matrix' : '1D Linear' }}
            </span>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <button 
              type="button" 
              @click="selectedBarcodeType = 'code128'"
              class="btn btn-sm rounded-2xl border flex items-center gap-2 transition-all"
              :class="selectedBarcodeType === 'code128' ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost border-base-300'"
            >
              <Icon icon="solar:code-file-bold" class="w-4 h-4" />
              <div class="flex flex-col items-start leading-tight">
                <span class="font-black text-xs">Code 128 (1D)</span>
                <span class="text-[9px] opacity-75 font-mono">Laser POS Gun</span>
              </div>
            </button>

            <button 
              type="button" 
              @click="selectedBarcodeType = 'qr'"
              class="btn btn-sm rounded-2xl border flex items-center gap-2 transition-all"
              :class="selectedBarcodeType === 'qr' ? 'btn-secondary text-secondary-content shadow-xs' : 'btn-ghost border-base-300'"
            >
              <Icon icon="solar:qr-code-bold" class="w-4 h-4" />
              <div class="flex flex-col items-start leading-tight">
                <span class="font-black text-xs">Mini QR Code (2D)</span>
                <span class="text-[9px] opacity-75 font-mono">Compact / Phone</span>
              </div>
            </button>
          </div>

          <!-- QR Sub-Options -->
          <div v-if="selectedBarcodeType === 'qr'" class="bg-secondary/10 border border-secondary/20 rounded-2xl p-3 space-y-2">
            <div class="flex items-center justify-between text-xs font-bold text-secondary">
              <span class="flex items-center gap-1">
                <Icon icon="solar:tuning-bold" class="w-3.5 h-3.5" />
                <span>QR Encoded Payload</span>
              </span>
              <span class="text-[10px] font-mono opacity-80">{{ selectedQrFormat === 'url' ? 'Direct Mobile Web Link' : 'Hardware Scannable Identifier' }}</span>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <label class="flex items-center gap-2 p-2 rounded-xl bg-base-100/90 border border-secondary/20 cursor-pointer">
                <input 
                  type="radio" 
                  name="qr_format" 
                  value="sku" 
                  v-model="selectedQrFormat" 
                  class="radio radio-xs radio-secondary"
                />
                <div class="text-left leading-tight">
                  <div class="font-black text-xs text-base-content">Raw Identifier</div>
                  <div class="font-mono text-[9px] text-base-content/60 truncate max-w-[130px]">{{ displayBarcodeVal }}</div>
                </div>
              </label>

              <label class="flex items-center gap-2 p-2 rounded-xl bg-base-100/90 border border-secondary/20 cursor-pointer">
                <input 
                  type="radio" 
                  name="qr_format" 
                  value="url" 
                  v-model="selectedQrFormat" 
                  class="radio radio-xs radio-secondary"
                />
                <div class="text-left leading-tight">
                  <div class="font-black text-xs text-base-content">Item Web URL</div>
                  <div class="font-mono text-[9px] text-base-content/60 truncate max-w-[130px]">resalecommand.com/i/...</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <!-- 4. Label Dimensions & Sizes -->
        <div class="bg-base-100 p-5 rounded-3xl border border-base-300 shadow-sm space-y-3">
          <div class="flex items-center justify-between">
            <label class="text-xs font-black uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
              <Icon icon="solar:ruler-bold" class="w-4 h-4 text-primary" />
              <span>Label Stock Dimensions</span>
            </label>
            <span class="badge badge-xs font-mono font-bold badge-primary">{{ selectedSizeDisplay }}</span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            <button 
              type="button"
              v-for="s in sizeOptions"
              :key="s.id"
              @click="selectedSize = s.id"
              class="btn btn-sm flex flex-col h-auto py-2 px-2 rounded-2xl border transition-all"
              :class="selectedSize === s.id ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost border-base-300 hover:border-primary/40'"
            >
              <span class="font-black text-xs">{{ s.label }}</span>
              <span class="text-[9px] opacity-70 font-mono">{{ s.desc }}</span>
            </button>
          </div>
        </div>

        <!-- 5. Real-World Merchandise Presets across Venues -->
        <div class="bg-base-100 p-5 rounded-3xl border border-base-300 shadow-sm space-y-3">
          <label class="text-xs font-black uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
            <Icon icon="solar:bookmark-bold" class="w-4 h-4 text-primary" />
            <span>Merchandise Presets by Venue</span>
          </label>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button 
              type="button" 
              v-for="p in presets" 
              :key="p.title"
              @click="applyPreset(p)"
              class="btn btn-sm text-left h-auto py-2 px-2.5 flex flex-col items-start border rounded-2xl transition-all"
              :class="activeForm.title === p.title ? 'btn-primary text-primary-content shadow-xs' : 'btn-ghost border-base-300 hover:border-primary/40'"
            >
              <div class="flex items-center justify-between w-full">
                <span class="font-black text-xs truncate">{{ p.shortName }}</span>
                <span class="badge badge-xs font-mono font-bold" :class="p.locationId === 'MD' ? 'badge-primary' : (p.locationId === 'HG' ? 'badge-neutral' : 'badge-accent')">
                  {{ p.locationId }}
                </span>
              </div>
              <span class="text-[10px] opacity-75 font-mono truncate w-full">
                ${{ p.price }} • {{ p.locationSku ? `${p.locationSku} (${p.upc})` : (p.bin ? `${p.bin} (${p.upc})` : p.upc) }}
              </span>
            </button>
          </div>
        </div>

        <!-- 6. Active Item Field Customization (Context-Adaptive) -->
        <div class="bg-base-100 p-5 rounded-3xl border border-base-300 shadow-sm space-y-4">
          <div class="flex items-center justify-between">
            <label class="text-xs font-black uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
              <Icon icon="solar:tag-bold" class="w-4 h-4 text-primary" />
              <span>Item Tag Data</span>
            </label>
            <span class="text-[10px] font-mono" :class="tagLengthClass">
              {{ (activeForm.tagTitle || activeForm.title || '').length }}/38 chars
            </span>
          </div>

          <div class="space-y-3">
            <div class="space-y-1">
              <label class="text-[11px] font-bold text-base-content/70">Physical Tag Title (under 38 chars)</label>
              <input 
                v-model="activeForm.tagTitle" 
                type="text" 
                maxlength="45"
                class="input input-sm input-bordered w-full font-bold text-xs rounded-xl"
                placeholder="Carhartt Detroit Duck Canvas Jacket (L)"
              />
            </div>

            <!-- Case A: Dual-ID Mode (Ricochet POS) -->
            <div v-if="effectiveHasStoreSku" class="grid grid-cols-3 gap-2.5">
              <div class="space-y-1">
                <label class="text-[11px] font-bold text-base-content/70">Price ($)</label>
                <input 
                  v-model="activeForm.price" 
                  type="text" 
                  class="input input-sm input-bordered w-full font-mono font-black text-xs rounded-xl"
                  placeholder="15.00"
                />
              </div>

              <div class="space-y-1">
                <div class="flex items-center justify-between">
                  <label class="text-[11px] font-bold text-base-content/70">Store / POS SKU</label>
                  <span class="text-[9px] text-primary font-mono font-bold">Register</span>
                </div>
                <input 
                  v-model="activeForm.locationSku" 
                  type="text" 
                  class="input input-sm input-bordered w-full font-mono font-bold text-xs rounded-xl uppercase"
                  placeholder="0EJ0MG"
                />
              </div>

              <div class="space-y-1">
                <label class="text-[11px] font-bold text-base-content/70">Canonical UPC</label>
                <input 
                  v-model="activeForm.upc" 
                  type="text" 
                  class="input input-sm input-bordered w-full font-mono font-bold text-xs rounded-xl uppercase"
                  placeholder="HUCK-1471"
                />
              </div>
            </div>

            <!-- Case B: Warehouse with Bin Storage (Garage Backstock / Online) -->
            <div v-else-if="effectiveSupportsBin" class="grid grid-cols-3 gap-2.5">
              <div class="space-y-1">
                <label class="text-[11px] font-bold text-base-content/70">Price ($)</label>
                <input 
                  v-model="activeForm.price" 
                  type="text" 
                  class="input input-sm input-bordered w-full font-mono font-black text-xs rounded-xl"
                  placeholder="125.00"
                />
              </div>

              <div class="space-y-1">
                <div class="flex items-center justify-between">
                  <label class="text-[11px] font-bold text-base-content/70">Canonical UPC</label>
                  <span class="text-[9px] text-base-content/50 font-mono">Barcode</span>
                </div>
                <input 
                  v-model="activeForm.upc" 
                  type="text" 
                  class="input input-sm input-bordered w-full font-mono font-bold text-xs rounded-xl uppercase"
                  placeholder="HUCK-1502"
                />
              </div>

              <div class="space-y-1">
                <label class="text-[11px] font-bold text-base-content/70">Storage Bin / Tote</label>
                <input 
                  v-model="activeForm.bin" 
                  type="text" 
                  class="input input-sm input-bordered w-full font-mono font-bold text-xs rounded-xl uppercase"
                  placeholder="TOTE-04"
                />
              </div>
            </div>

            <!-- Case C: Pure Org UPC / Manufacturer Barcode (Single ID) -->
            <div v-else class="grid grid-cols-3 gap-2.5">
              <div class="space-y-1">
                <label class="text-[11px] font-bold text-base-content/70">Price ($)</label>
                <input 
                  v-model="activeForm.price" 
                  type="text" 
                  class="input input-sm input-bordered w-full font-mono font-black text-xs rounded-xl"
                  placeholder="35.00"
                />
              </div>

              <div class="col-span-2 space-y-1">
                <div class="flex items-center justify-between">
                  <label class="text-[11px] font-bold text-base-content/70">Organization Asset / Barcode Code</label>
                  <span class="text-[9px] text-base-content/50 font-mono">Single ID</span>
                </div>
                <input 
                  v-model="activeForm.upc" 
                  type="text" 
                  class="input input-sm input-bordered w-full font-mono font-bold text-xs rounded-xl uppercase"
                  :placeholder="activeLocation.code === 'MFR' ? '744511048231' : `${activeLocation.defaultSkuPrefix}0441`"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 7. Mac & Rollo Protocol Card -->
        <div class="bg-success/10 border border-success/30 rounded-3xl p-4 text-xs text-success-content space-y-2">
          <div class="font-black flex items-center gap-1.5 text-success">
            <Icon icon="solar:check-circle-bold" class="w-4 h-4" />
            <span>Mac &amp; Rollo Print Protocol (Verified):</span>
          </div>
          <p class="leading-relaxed opacity-90">
            1. <strong>Direct Shortcut</strong>: Press <kbd class="kbd kbd-xs font-mono font-bold bg-base-100">⌥ ⌘ P</kbd> (Option + Command + P) to open the macOS System Print Dialog directly.
          </p>
          <p class="leading-relaxed opacity-90">
            2. <strong>Paper Size</strong>: Select <code>2x1</code>, <code>2.25x1.25</code>, or <code>Den Label</code> in macOS driver settings.
          </p>
          <p class="leading-relaxed opacity-90">
            3. <strong>Margins</strong>: Always set to <strong>None</strong> with <strong>Portrait</strong> orientation.
          </p>
        </div>
      </div>

      <!-- Right Column: Live Sticky Label Mockup (5 cols) -->
      <div class="lg:col-span-5 space-y-5">
        <div class="sticky top-6 bg-base-100 p-6 rounded-3xl border border-base-300 shadow-md flex flex-col items-center space-y-5">
          
          <div class="w-full flex items-center justify-between border-b border-base-200 pb-3">
            <div class="flex items-center gap-2">
              <Icon icon="solar:eye-bold" class="w-4 h-4 text-primary" />
              <h3 class="font-black text-xs uppercase tracking-wider text-base-content/80">Live Physical Preview</h3>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="badge badge-xs font-mono font-bold badge-outline">{{ activeLocation.code }}</span>
              <span class="badge badge-xs font-mono font-bold badge-primary">{{ selectedSizeDisplay }}</span>
            </div>
          </div>

          <!-- THE PHYSICAL STICKER MOCKUP (Scaled for crisp screen inspection) -->
          <div class="py-4 flex justify-center w-full bg-base-200/50 rounded-2xl p-4 border border-dashed border-base-300">
            
            <!-- CASE 1: Butterfly Tag (Dual-Paddle Jewelry layout) -->
            <div 
              v-if="selectedSize === 'butterfly'"
              class="bg-white text-black shadow-xl rounded-sm border border-neutral-300 p-1.5 flex flex-row justify-between items-stretch select-none transition-all duration-200"
              :style="mockupStyle"
            >
              <!-- Left Paddle: Vendor, Price, Title -->
              <div class="w-[130px] flex flex-col justify-between pr-1 border-r border-dashed border-neutral-300">
                <span class="font-mono font-black text-[9px] tracking-wider uppercase text-neutral-800">{{ vendorHeader || 'MEMORY DEN' }}</span>
                <span class="font-black text-xs font-sans tracking-tight">${{ formattedPrice }}</span>
                <span class="font-bold text-[9px] leading-tight text-neutral-900 truncate" :title="displayTitle">{{ displayTitle }}</span>
              </div>

              <!-- Center Bridge (Non-Adhesive tail for ring/chain wrap) -->
              <div class="w-[90px] flex flex-col items-center justify-center bg-neutral-100/80 border-x border-neutral-200/80 text-[8px] text-neutral-400 font-mono text-center px-1">
                <span>Ring Wrap</span>
                <span class="text-[7px] text-neutral-400/80">(Blank Tail)</span>
              </div>

              <!-- Right Paddle: Code128 Barcode OR Mini QR -->
              <div class="w-[130px] flex flex-col justify-center items-center pl-1 border-l border-dashed border-neutral-300">
                <div v-if="selectedBarcodeType === 'qr'" class="w-10 h-10 flex items-center justify-center p-0.5 bg-white" v-html="previewQrSvg"></div>
                <div v-else class="w-full flex justify-center scale-95" v-html="previewBarcodeSvg"></div>
                <div class="font-mono font-black text-[9px] text-center tracking-widest text-neutral-800 mt-0.5">
                  {{ displayBarcodeVal }}
                </div>
              </div>
            </div>

            <!-- CASE 2: 2D Mini QR Rectangle Tag (Split Side-by-Side) -->
            <div 
              v-else-if="selectedBarcodeType === 'qr'"
              class="bg-white text-black shadow-xl rounded-sm border border-neutral-300 p-2.5 flex flex-row justify-between items-stretch select-none transition-all duration-200"
              :style="mockupStyle"
            >
              <!-- Left Column: Big Price, Header, Title -->
              <div class="flex-1 flex flex-col justify-between pr-2 overflow-hidden">
                <div class="font-mono font-black text-[10px] tracking-wider uppercase text-neutral-800 border-b border-black/10 pb-0.5">
                  {{ vendorHeader || 'MEMORY DEN' }}
                </div>
                <div class="font-black text-2xl font-sans tracking-tight text-neutral-950 my-auto">
                  ${{ formattedPrice }}
                </div>
                <div class="font-bold text-[11px] leading-tight text-neutral-900 line-clamp-2">
                  {{ displayTitle }}
                </div>
                <div class="font-mono font-bold text-[9px] tracking-wider text-neutral-600 truncate mt-0.5">
                  {{ displayCaption }}
                </div>
              </div>

              <!-- Right Column: 2D Mini QR Code Matrix -->
              <div class="w-[90px] flex flex-col items-center justify-center border-l border-dashed border-neutral-300 pl-2 shrink-0">
                <div class="w-18 h-18 p-1 bg-white flex items-center justify-center rounded-xs shadow-2xs border border-neutral-200" v-html="previewQrSvg"></div>
                <div class="font-mono font-black text-[8px] text-center tracking-wider text-neutral-800 mt-1">
                  {{ displayBarcodeVal }}
                </div>
              </div>
            </div>

            <!-- CASE 3: Standard 1D Code128 Rectangle Tag (Stacked) -->
            <div 
              v-else
              class="bg-white text-black shadow-xl rounded-sm border border-neutral-300 p-2 flex flex-col justify-between select-none transition-all duration-200"
              :style="mockupStyle"
            >
              <!-- Header: Store & Price -->
              <div class="flex items-baseline justify-between w-full border-b border-black/10 pb-0.5">
                <span class="font-mono font-black text-[10px] tracking-wider uppercase text-neutral-800">{{ vendorHeader || 'MEMORY DEN' }}</span>
                <span class="font-black text-sm font-sans tracking-tight">${{ formattedPrice }}</span>
              </div>

              <!-- Title -->
              <div class="font-bold text-[11px] leading-tight text-neutral-900 line-clamp-2 my-1 text-center">
                {{ displayTitle }}
              </div>

              <!-- Vector Barcode -->
              <div class="w-full flex justify-center my-0.5" v-html="previewBarcodeSvg"></div>

              <!-- Caption -->
              <div class="font-mono font-black text-[9px] text-center tracking-widest text-neutral-700">
                {{ displayCaption }}
              </div>
            </div>
          </div>

          <!-- Print Quantity Control -->
          <div class="w-full flex items-center justify-between bg-base-200/50 p-2.5 rounded-2xl border border-base-300">
            <span class="text-xs font-bold text-base-content/80 flex items-center gap-1.5">
              <Icon icon="solar:copy-bold" class="w-4 h-4 text-primary" />
              <span>Copies to Print:</span>
            </span>
            <div class="flex items-center gap-1.5">
              <button 
                type="button" 
                @click="printQuantity = Math.max(1, printQuantity - 1)" 
                class="btn btn-xs btn-circle btn-ghost border border-base-300 font-bold"
              >
                -
              </button>
              <input 
                v-model.number="printQuantity" 
                type="number" 
                min="1" 
                max="20" 
                class="input input-xs input-bordered w-12 font-mono font-bold text-center rounded-lg"
              />
              <button 
                type="button" 
                @click="printQuantity = Math.min(20, printQuantity + 1)" 
                class="btn btn-xs btn-circle btn-ghost border border-base-300 font-bold"
              >
                +
              </button>
            </div>
          </div>

          <!-- Print Buttons -->
          <div class="w-full space-y-2.5">
            <!-- 1. Universal Vector PDF Print (Default, 1-Click) -->
            <button 
              type="button" 
              @click="handlePrint(printQuantity)" 
              class="btn btn-primary btn-block text-primary-content font-black shadow-lg rounded-2xl gap-2 h-12 text-sm sm:text-base active:scale-95 transition-all"
            >
              <Icon icon="solar:printer-bold" class="w-5 h-5" />
              <span>Print {{ printQuantity }} Label{{ printQuantity > 1 ? 's' : '' }} on Rollo ➔</span>
            </button>

            <!-- 2. Inspect / Download Vector PDF -->
            <button 
              type="button" 
              @click="handleOpenPdf()" 
              class="btn btn-outline border-base-300 btn-block font-bold text-xs rounded-2xl gap-1.5 h-10 hover:bg-base-200 transition-all"
              title="Opens the exact vector PDF in a new browser tab to inspect or save"
            >
              <Icon icon="solar:document-bold" class="w-4 h-4 text-primary" />
              <span>Inspect / Save Vector PDF</span>
            </button>

            <!-- 3. Continuous Feed Alignment Run -->
            <button 
              type="button" 
              @click="handlePrint(3)" 
              class="btn btn-ghost btn-sm btn-block text-base-content/60 font-mono text-[11px] gap-1 hover:text-base-content"
              title="Prints 3 continuous labels to test roll gap calibration"
            >
              <Icon icon="solar:layers-linear" class="w-3.5 h-3.5" />
              <span>Test 3-Label Feed Alignment Run</span>
            </button>
          </div>

        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { generateCode128Svg } from '../../lib/barcode128';
import { generateQrCodeSvg, resolveQrPayload } from '../../lib/qrCodeHelper';
import { printRolloLabels, generateLabelsPdf, type RolloPrintItem, type RolloPrintOptions } from '../../lib/rolloLabelPrint';
import { extractShortTagTitle } from '../../lib/exportUtils';
import { addToast } from '../../stores/toast';

// -------------------------------------------------------------
// 1. Partner Organizations & Venue Profiles
// -------------------------------------------------------------
export interface LocationPreset {
  id: string;
  name: string;
  code: string;
  icon: string;
  vendorHeader: string;
  badge: string;
  badgeClass: string;
  desc: string;
  hasStoreSku: boolean;
  supportsBin: boolean;
  defaultSkuPrefix: string;
  defaultBin?: string;
  isCustomPartner?: boolean;
}

const standardLocations: LocationPreset[] = [
  {
    id: 'MD',
    name: 'Memory Den Booth',
    code: 'MD',
    icon: '🏛️',
    vendorHeader: 'MEMORY DEN',
    badge: 'Ricochet POS (Dual-ID)',
    badgeClass: 'badge-primary',
    desc: 'Antique Mall Booth #42 — Cash register scans Ricochet 0EJ SKU',
    hasStoreSku: true,
    supportsBin: false,
    defaultSkuPrefix: 'HUCK-'
  },
  {
    id: 'HG',
    name: 'Garage Backstock',
    code: 'HG',
    icon: '📦',
    vendorHeader: 'GARAGE BACKSTOCK',
    badge: 'Warehouse (UPC + Bin)',
    badgeClass: 'badge-neutral',
    desc: 'Intake totes & warehouse backstock — Uses canonical UPC and physical bin storage',
    hasStoreSku: false,
    supportsBin: true,
    defaultSkuPrefix: 'HUCK-',
    defaultBin: 'TOTE-04'
  },
  {
    id: 'PDX',
    name: 'Portland Gaming Lib',
    code: 'PDX',
    icon: '🎲',
    vendorHeader: 'PDX GAMING LIB',
    badge: 'Co-Op Org (UPC Only)',
    badgeClass: 'badge-accent',
    desc: 'Non-profit gaming co-op — Uses canonical organization asset UPC',
    hasStoreSku: false,
    supportsBin: false,
    defaultSkuPrefix: 'PDX-'
  },
  {
    id: 'DT',
    name: 'Dusty Tiger',
    code: 'DT',
    icon: '🐅',
    vendorHeader: 'DUSTY TIGER',
    badge: 'Vendor Tagging',
    badgeClass: 'badge-secondary',
    desc: 'Consignment collective — Uses direct vendor string tag code',
    hasStoreSku: false,
    supportsBin: false,
    defaultSkuPrefix: 'DUSTY-'
  },
  {
    id: 'MFR',
    name: 'Commercial Item',
    code: 'MFR',
    icon: '🏷️',
    vendorHeader: 'COMMERCIAL GOODS',
    badge: 'Standard 12-Digit UPC',
    badgeClass: 'badge-warning',
    desc: 'Commercial retail barcode (no store or org SKU needed)',
    hasStoreSku: false,
    supportsBin: false,
    defaultSkuPrefix: ''
  },
  {
    id: 'ONLINE',
    name: 'Online E-Commerce',
    code: 'ONLINE',
    icon: '🌐',
    vendorHeader: 'ONLINE INVENTORY',
    badge: 'eBay / Poshmark',
    badgeClass: 'badge-info',
    desc: 'Warehouse shelf bin location for online listings',
    hasStoreSku: false,
    supportsBin: true,
    defaultSkuPrefix: 'EB-',
    defaultBin: 'SHELF-B2'
  },
  {
    id: 'CUSTOM',
    name: 'Custom Venue',
    code: 'CUST',
    icon: '✏️',
    vendorHeader: 'CUSTOM STORE',
    badge: 'Custom',
    badgeClass: 'badge-outline',
    desc: 'Freeform custom store or event booth name',
    hasStoreSku: false,
    supportsBin: false,
    defaultSkuPrefix: 'TAG-'
  }
];

// Custom Partner Orgs persisted in LocalStorage
const savedCustomPartners = ref<LocationPreset[]>([]);
const showPartnerCreator = ref(false);
const newPartnerForm = ref({
  name: '',
  vendorHeader: '',
  archetype: 'pure_upc' as 'pure_upc' | 'dual_id' | 'warehouse_bin',
  defaultSkuPrefix: ''
});

const loadSavedPartners = () => {
  try {
    const raw = localStorage.getItem('rc_saved_partner_orgs');
    if (raw) {
      savedCustomPartners.value = JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load saved partner orgs:', e);
  }
};

const saveNewPartnerOrg = () => {
  const name = newPartnerForm.value.name.trim();
  const header = newPartnerForm.value.vendorHeader.trim().toUpperCase();
  if (!name || !header) return;

  const id = `partner_${Date.now()}`;
  const code = header.split(/\s+/).map(w => w[0]).join('').slice(0, 4) || 'PRT';
  const archetype = newPartnerForm.value.archetype;

  const newOrg: LocationPreset = {
    id,
    name,
    code,
    icon: '🤝',
    vendorHeader: header,
    badge: 'Custom Partner',
    badgeClass: 'badge-accent',
    desc: `Partner Org (${name}) — ${archetype === 'dual_id' ? 'Dual-ID Store SKU' : (archetype === 'warehouse_bin' ? 'Warehouse Bin' : 'Pure UPC Code')}`,
    hasStoreSku: archetype === 'dual_id',
    supportsBin: archetype === 'warehouse_bin',
    defaultSkuPrefix: newPartnerForm.value.defaultSkuPrefix.trim().toUpperCase() || `${code}-`,
    defaultBin: archetype === 'warehouse_bin' ? 'BIN-01' : undefined,
    isCustomPartner: true
  };

  savedCustomPartners.value.push(newOrg);
  try {
    localStorage.setItem('rc_saved_partner_orgs', JSON.stringify(savedCustomPartners.value));
  } catch (e) {
    console.error('Failed to persist partner org:', e);
  }

  // Select the newly created partner
  selectedLocationId.value = id;
  vendorHeader.value = header;
  showPartnerCreator.value = false;
  newPartnerForm.value = { name: '', vendorHeader: '', archetype: 'pure_upc', defaultSkuPrefix: '' };
  addToast({ type: 'success', message: `Saved & activated partner org: ${name}` });
};

const deleteCustomPartner = (id: string) => {
  savedCustomPartners.value = savedCustomPartners.value.filter(p => p.id !== id);
  try {
    localStorage.setItem('rc_saved_partner_orgs', JSON.stringify(savedCustomPartners.value));
  } catch (e) {
    console.error('Failed to remove partner org:', e);
  }
  selectedLocationId.value = 'MD';
  handleLocationChange();
  addToast({ type: 'info', message: 'Removed custom partner profile' });
};

onMounted(() => {
  loadSavedPartners();
});

const locationPresets = computed(() => {
  return [...standardLocations, ...savedCustomPartners.value];
});

const selectedLocationId = ref('MD');
const vendorHeader = ref('MEMORY DEN');

const activeLocation = computed(() => {
  return locationPresets.value.find(l => l.id === selectedLocationId.value) || locationPresets.value[0];
});

// -------------------------------------------------------------
// 2. Granular Manual Overrides
// -------------------------------------------------------------
const overrideIdentifierMode = ref<'auto' | 'dual' | 'pure_upc' | 'bin'>('auto');
const overrideBarcodeAuthority = ref<'auto' | 'upc' | 'store_sku' | 'custom'>('auto');
const customBarcodeValue = ref('');
const useCustomCaption = ref(false);
const customCaptionText = ref('');

const effectiveHasStoreSku = computed(() => {
  if (overrideIdentifierMode.value === 'dual') return true;
  if (overrideIdentifierMode.value === 'pure_upc' || overrideIdentifierMode.value === 'bin') return false;
  return activeLocation.value.hasStoreSku;
});

const effectiveSupportsBin = computed(() => {
  if (overrideIdentifierMode.value === 'bin') return true;
  if (overrideIdentifierMode.value === 'pure_upc' || overrideIdentifierMode.value === 'dual') return false;
  return activeLocation.value.supportsBin;
});

const hasActiveOverrides = computed(() => {
  return overrideIdentifierMode.value !== 'auto' ||
    overrideBarcodeAuthority.value !== 'auto' ||
    useCustomCaption.value;
});

const handleLocationChange = () => {
  const loc = activeLocation.value;
  vendorHeader.value = loc.vendorHeader;

  // Reset override identifier mode to auto on venue change
  overrideIdentifierMode.value = 'auto';

  if (!loc.hasStoreSku) {
    activeForm.value.locationSku = '';
  } else if (!activeForm.value.locationSku) {
    activeForm.value.locationSku = '0EJ0MG';
  }

  if (loc.supportsBin) {
    if (!activeForm.value.bin) activeForm.value.bin = loc.defaultBin || 'TOTE-04';
  } else {
    activeForm.value.bin = '';
  }

  if (loc.defaultSkuPrefix && !activeForm.value.upc.startsWith(loc.defaultSkuPrefix)) {
    const num = Math.floor(1000 + Math.random() * 9000);
    activeForm.value.upc = `${loc.defaultSkuPrefix}${num}`;
  } else if (loc.code === 'MFR') {
    activeForm.value.upc = '744511048231';
  }

  addToast({ type: 'info', message: `Switched venue to: ${loc.name}` });
};

// -------------------------------------------------------------
// 3. Barcode Type & 2D Mini QR Toggle
// -------------------------------------------------------------
const selectedBarcodeType = ref<'code128' | 'qr'>('code128');
const selectedQrFormat = ref<'sku' | 'url'>('sku');

// -------------------------------------------------------------
// 4. Label Sizes & Dimensions
// -------------------------------------------------------------
const selectedSize = ref<'2x1' | '2.25x1.25' | '3x2' | '4x6' | 'butterfly'>('2x1');
const printQuantity = ref(1);

const sizeOptions = [
  { id: '2x1' as const, label: '2" × 1"', desc: 'Booth Shelf' },
  { id: 'butterfly' as const, label: '2.2" × 0.5"', desc: 'Butterfly Jewelry' },
  { id: '2.25x1.25' as const, label: '2.25" × 1.25"', desc: 'Hangtag Sticker' },
  { id: '3x2' as const, label: '3" × 2"', desc: 'Medium Tag' },
  { id: '4x6' as const, label: '4" × 6"', desc: 'Bin / Carton' }
];

const selectedSizeDisplay = computed(() => {
  const opt = sizeOptions.find(o => o.id === selectedSize.value);
  return opt ? opt.label : '2" × 1"';
});

// -------------------------------------------------------------
// 5. Real-World Merchandise Presets across Venues
// -------------------------------------------------------------
const presets = [
  {
    shortName: 'Gothic Skull (Booth)',
    locationId: 'MD',
    title: 'Hamlon Gothic Skull on Pedestal Halloween Decor Figurine by Michaels Store',
    tagTitle: 'Hamlon Gothic Skull Pedestal',
    price: '15.00',
    locationSku: '0EJ0MG',
    upc: 'HUCK-1471',
    bin: ''
  },
  {
    shortName: 'Carhartt (Warehouse)',
    locationId: 'HG',
    title: 'Vintage Carhartt Detroit Duck Canvas Blanket Lined Workwear Jacket (L)',
    tagTitle: 'Vintage Carhartt Detroit Jacket (L)',
    price: '125.00',
    locationSku: '',
    upc: 'HUCK-1502',
    bin: 'TOTE-04'
  },
  {
    shortName: 'Cthulhu RPG (Co-Op)',
    locationId: 'PDX',
    title: 'Chaosium Call of Cthulhu RPG 7th Edition Hardcover Keeper Rulebook',
    tagTitle: 'Call of Cthulhu RPG Keeper Rulebook',
    price: '35.00',
    locationSku: '',
    upc: 'PDX-0441',
    bin: ''
  },
  {
    shortName: 'Boba Fett (MFR UPC)',
    locationId: 'MFR',
    title: 'Kenner Star Wars Vintage Collection Boba Fett Action Figure 3.75 Inch',
    tagTitle: 'Kenner Star Wars Boba Fett 3.75"',
    price: '28.00',
    locationSku: '',
    upc: '744511048231',
    bin: ''
  },
  {
    shortName: 'Opal Ring (Jewelry)',
    locationId: 'MD',
    title: 'Vintage 14K Yellow Gold Australian Fire Opal Solitaire Ring Size 7',
    tagTitle: '14K Opal Ring',
    price: '48.00',
    locationSku: '0EJ0J1',
    upc: 'HUCK-1490',
    bin: ''
  },
  {
    shortName: 'Dusty Tiger Jacket',
    locationId: 'DT',
    title: 'Saint Tropez West Classics Black Velvet Embroidered Beaded Bolero Shrug Jacket (M)',
    tagTitle: 'Saint Tropez Black Velvet Bolero (M)',
    price: '30.00',
    locationSku: '',
    upc: 'DUSTY-1088',
    bin: ''
  }
];

const activeForm = ref({
  title: presets[0].title,
  tagTitle: presets[0].tagTitle,
  price: presets[0].price,
  locationSku: presets[0].locationSku,
  upc: presets[0].upc,
  bin: presets[0].bin
});

const applyPreset = (p: typeof presets[0]) => {
  activeForm.value = { ...p };
  selectedLocationId.value = p.locationId;
  const loc = locationPresets.value.find(l => l.id === p.locationId);
  if (loc) {
    vendorHeader.value = loc.vendorHeader;
  }
  if (p.shortName.includes('Opal Ring')) {
    selectedSize.value = 'butterfly';
  } else if (selectedSize.value === 'butterfly') {
    selectedSize.value = '2x1';
  }
  addToast({ type: 'info', message: `Loaded preset: ${p.shortName}` });
};

// -------------------------------------------------------------
// 6. Computed Display Properties (Smart Resolution + Overrides)
// -------------------------------------------------------------
const formattedPrice = computed(() => {
  const num = Number(String(activeForm.value.price).replace(/[^0-9.]/g, '')) || 0;
  return num.toFixed(2);
});

const displayTitle = computed(() => {
  if (activeForm.value.tagTitle && activeForm.value.tagTitle.trim()) {
    return activeForm.value.tagTitle.trim();
  }
  return extractShortTagTitle(activeForm.value);
});

const displayBarcodeVal = computed(() => {
  // Explicit custom barcode override
  if (overrideBarcodeAuthority.value === 'custom' && customBarcodeValue.value.trim()) {
    return customBarcodeValue.value.trim().toUpperCase();
  }

  const sku = (activeForm.value.locationSku || '').trim().toUpperCase();
  const upc = (activeForm.value.upc || '').trim().toUpperCase();

  if (overrideBarcodeAuthority.value === 'upc') {
    return upc || sku || 'UPC-0000';
  }
  if (overrideBarcodeAuthority.value === 'store_sku') {
    return sku || upc || 'UPC-0000';
  }

  // Auto mode:
  return sku || upc || 'UPC-0000';
});

const displayCaption = computed(() => {
  // Explicit caption override
  if (useCustomCaption.value && customCaptionText.value.trim()) {
    return customCaptionText.value.trim();
  }

  const sku = (activeForm.value.locationSku || '').trim().toUpperCase();
  const upc = (activeForm.value.upc || '').trim().toUpperCase();
  const bin = (activeForm.value.bin || '').trim().toUpperCase();

  // 1. Dual ID (Memory Den): 0EJ0MG • HUCK-1471
  if (effectiveHasStoreSku.value && sku && upc && sku !== upc) {
    return `${sku} • ${upc}`;
  }
  // 2. Warehouse with Bin: BIN: TOTE-04 • HUCK-1502
  if (effectiveSupportsBin.value && bin && upc) {
    return `BIN: ${bin} • ${upc}`;
  }
  // 3. Pure UPC / Org Asset / Commercial UPC
  if (upc) {
    return upc;
  }
  if (sku) {
    return sku;
  }
  return 'UPC-0000';
});

// 1D Code 128 SVG
const previewBarcodeSvg = computed(() => {
  const isBfly = selectedSize.value === 'butterfly';
  return generateCode128Svg(displayBarcodeVal.value, {
    height: isBfly ? 18 : (selectedSize.value === '2x1' ? 30 : 36),
    barWidth: isBfly ? 1.5 : 2,
    includeText: false
  });
});

// 2D Mini QR SVG
const previewQrPayload = computed(() => {
  if (overrideBarcodeAuthority.value === 'custom' && customBarcodeValue.value.trim()) {
    return customBarcodeValue.value.trim();
  }
  return resolveQrPayload(
    { locationSku: activeForm.value.locationSku, upc: activeForm.value.upc },
    selectedQrFormat.value
  );
});

const previewQrSvg = computed(() => {
  return generateQrCodeSvg(previewQrPayload.value, {
    whiteColor: 'transparent',
    blackColor: '#000000'
  });
});

const tagLengthClass = computed(() => {
  const len = (activeForm.value.tagTitle || activeForm.value.title || '').length;
  if (selectedSize.value === 'butterfly') {
    if (len <= 14) return 'text-success font-bold';
    if (len <= 18) return 'text-warning font-bold';
    return 'text-error font-black';
  }
  if (len <= 38) return 'text-success font-bold';
  if (len <= 42) return 'text-warning font-bold';
  return 'text-error font-black';
});

// Scaled CSS dimensions for physical preview mockup
const mockupStyle = computed(() => {
  if (selectedSize.value === 'butterfly') {
    return {
      width: '360px',
      height: '84px'
    };
  } else if (selectedSize.value === '2.25x1.25') {
    return {
      width: '270px',
      height: '150px'
    };
  } else if (selectedSize.value === '3x2') {
    return {
      width: '300px',
      height: '200px'
    };
  } else if (selectedSize.value === '4x6') {
    return {
      width: '320px',
      height: '480px'
    };
  }
  // Default 2" x 1" (scaled up for legible screen preview)
  return {
    width: '270px',
    height: '135px'
  };
});

// -------------------------------------------------------------
// 7. Print Triggers
// -------------------------------------------------------------
const handlePrint = (quantity = 1) => {
  const itemToPrint: RolloPrintItem = {
    title: displayTitle.value,
    tagTitle: displayTitle.value,
    price: formattedPrice.value,
    resalePrice: formattedPrice.value,
    locationSku: activeForm.value.locationSku,
    upc: activeForm.value.upc,
    bin: activeForm.value.bin,
    barcodeVal: displayBarcodeVal.value,
    customCaption: useCustomCaption.value ? customCaptionText.value : undefined,
    quantity
  };

  const options: RolloPrintOptions = {
    size: selectedSize.value,
    vendorHeader: vendorHeader.value || 'MEMORY DEN',
    barcodeType: selectedBarcodeType.value,
    qrDataFormat: selectedQrFormat.value,
    barcodeAuthority: overrideBarcodeAuthority.value === 'store_sku' ? 'ricochet_sku' : (overrideBarcodeAuthority.value === 'upc' ? 'upc' : 'auto'),
    customCaption: useCustomCaption.value ? customCaptionText.value : undefined
  };

  printRolloLabels([itemToPrint], options);
  addToast({ type: 'success', message: `Opened ${selectedBarcodeType.value === 'qr' ? '2D Mini QR' : '1D'} print dialog for ${quantity} label(s)!` });
};

const handleOpenPdf = () => {
  const itemToPrint: RolloPrintItem = {
    title: displayTitle.value,
    tagTitle: displayTitle.value,
    price: formattedPrice.value,
    resalePrice: formattedPrice.value,
    locationSku: activeForm.value.locationSku,
    upc: activeForm.value.upc,
    bin: activeForm.value.bin,
    barcodeVal: displayBarcodeVal.value,
    customCaption: useCustomCaption.value ? customCaptionText.value : undefined,
    quantity: printQuantity.value
  };

  const doc = generateLabelsPdf([itemToPrint], {
    size: selectedSize.value,
    vendorHeader: vendorHeader.value || 'MEMORY DEN',
    barcodeType: selectedBarcodeType.value,
    qrDataFormat: selectedQrFormat.value,
    barcodeAuthority: overrideBarcodeAuthority.value === 'store_sku' ? 'ricochet_sku' : (overrideBarcodeAuthority.value === 'upc' ? 'upc' : 'auto'),
    customCaption: useCustomCaption.value ? customCaptionText.value : undefined
  });

  const blobUrl = doc.output('bloburl');
  window.open(blobUrl, '_blank');
  addToast({ type: 'info', message: 'Opened vector PDF in new browser tab!' });
};
</script>
