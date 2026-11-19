<template>
  <Teleport v-if="mounted" to="body">
    <Transition name="rc-health-sheet">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-400 bg-black/60 backdrop-blur-xs flex flex-col justify-end"
        role="dialog"
        aria-modal="true"
        aria-label="Stock and Purchase Health Check"
        @click.self="closeTray"
      >
        <div
          class="bg-base-100 border-t border-base-300 rounded-t-3xl max-w-5xl mx-auto w-full max-h-[86dvh] flex flex-col shadow-2xl overflow-hidden pb-[env(safe-area-inset-bottom,0px)]"
        >
          <!-- Drag Handle Affordance -->
          <div class="w-12 h-1.5 rounded-full bg-base-content/25 mx-auto mt-2.5 mb-1 shrink-0"></div>

          <!-- Sticky Header -->
          <header
            class="px-4 sm:px-6 py-2.5 border-b border-base-200 flex flex-wrap items-center justify-between gap-2.5 shrink-0"
          >
            <div class="min-w-0">
              <h3
                class="text-base sm:text-lg font-black tracking-tight text-base-content flex items-center gap-2 flex-wrap"
              >
                <span>🧹 Stock &amp; PO Health Check</span>
                <span
                  v-if="report.totalHighConfidenceCount > 0"
                  class="badge badge-xs sm:badge-sm badge-warning text-warning-content font-mono font-black whitespace-nowrap shrink-0"
                >
                  {{ report.totalHighConfidenceCount }} ready to clean
                </span>
                <span
                  v-if="report.totalReviewCount > 0"
                  class="badge badge-xs sm:badge-sm badge-ghost border border-base-300 font-mono font-bold whitespace-nowrap shrink-0"
                >
                  +{{ report.totalReviewCount }} review
                </span>
              </h3>
              <p class="text-xs text-base-content/70">
                Finds already-split parent lots, already-sold backstock twins, extra copies, barcode clashes, and received POs — zero hard-deletes.
              </p>
            </div>

            <div class="flex items-center gap-2 ml-auto shrink-0">
              <div
                v-if="!capabilities.isConsignor"
                class="join border border-base-300 rounded-xl overflow-hidden"
              >
                <button
                  type="button"
                  class="btn btn-xs join-item h-9 px-2.5 font-bold"
                  :class="
                    scope === 'mine'
                      ? 'btn-primary text-primary-content'
                      : 'btn-ghost bg-base-200/70 text-base-content/80'
                  "
                  @click="emit('update:scope', 'mine')"
                >
                  🏷️ Mine
                </button>
                <button
                  type="button"
                  class="btn btn-xs join-item h-9 px-2.5 font-bold"
                  :class="
                    scope === 'all'
                      ? 'btn-neutral text-neutral-content'
                      : 'btn-ghost bg-base-200/70 text-base-content/80'
                  "
                  @click="emit('update:scope', 'all')"
                >
                  🏛️ All Collective
                </button>
              </div>

              <button
                v-if="dismissedCount > 0"
                type="button"
                class="btn btn-xs h-9 btn-ghost border border-base-300 rounded-xl font-bold"
                title="Restore dismissed warnings on this device"
                @click="emit('reset-dismissed')"
              >
                ↺ {{ dismissedCount }} hidden
              </button>

              <button
                type="button"
                class="btn btn-ghost btn-sm h-11 w-11 md:h-9 md:w-9 btn-circle shrink-0"
                aria-label="Close Health Check"
                @click="closeTray"
              >
                ✕
              </button>
            </div>
          </header>

          <!-- 5 Segmented Bucket Tabs -->
          <div class="px-4 sm:px-6 py-2 bg-base-200/50 border-b border-base-200 shrink-0 space-y-2">
            <div role="tablist" class="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
              <button
                v-for="t in bucketTabs"
                :key="t.id"
                type="button"
                role="tab"
                :aria-selected="activeTab === t.id"
                class="btn btn-xs sm:btn-sm h-11 md:h-9 rounded-xl font-bold gap-1.5 px-3 shrink-0 border"
                :class="
                  activeTab === t.id
                    ? 'btn-neutral text-neutral-content border-neutral shadow-xs'
                    : 'btn-ghost bg-base-100 border-base-300 text-base-content/85'
                "
                @click="switchTab(t.id)"
              >
                <span class="whitespace-nowrap">{{ t.label }}</span>
                <span
                  class="badge badge-xs font-mono font-extrabold whitespace-nowrap shrink-0"
                  :class="
                    activeTab === t.id
                      ? 'bg-neutral-content/20 text-neutral-content border-0'
                      : t.count > 0
                        ? 'badge-warning text-warning-content'
                        : 'badge-ghost'
                  "
                >
                  {{ t.count }}
                </span>
              </button>
            </div>

            <!-- Sub-filter for Sold Ghosts (Exact Proof vs Fuzzy Title Review) -->
            <div
              v-if="activeTab === 'sold_ghosts'"
              class="flex flex-wrap items-center justify-between gap-2 text-xs"
            >
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  class="btn btn-xs h-8 rounded-lg font-bold gap-1"
                  :class="
                    ghostConfidenceFilter === 'exact'
                      ? 'btn-error text-error-content'
                      : 'btn-ghost bg-base-100 border border-base-300'
                  "
                  @click="ghostConfidenceFilter = 'exact'; clearSelection()"
                >
                  <span>🔒 Exact Proof</span>
                  <span class="badge badge-2xs font-mono font-bold">{{ report.exactSoldGhostsCount }}</span>
                </button>
                <button
                  type="button"
                  class="btn btn-xs h-8 rounded-lg font-bold gap-1"
                  :class="
                    ghostConfidenceFilter === 'fuzzy'
                      ? 'btn-warning text-warning-content'
                      : 'btn-ghost bg-base-100 border border-base-300'
                  "
                  @click="ghostConfidenceFilter = 'fuzzy'; clearSelection()"
                >
                  <span>🔎 Possible Title Matches</span>
                  <span class="badge badge-2xs font-mono font-bold">{{ report.fuzzySoldGhostsCount }}</span>
                </button>
              </div>
              <span class="text-[11px] text-base-content/70">
                {{
                  ghostConfidenceFilter === 'exact'
                    ? 'Matched by exact sourcing lot #, item identity, or barcode sale. Safe for batch archive.'
                    : 'Matched by keyword similarity — review photos side-by-side and archive or keep one by one.'
                }}
              </span>
            </div>

            <p v-else class="text-[11px] text-base-content/75 leading-snug">
              {{ activeTabDescription }}
            </p>
          </div>

          <!-- Scrollable Findings List -->
          <div class="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-3 space-y-2.5">
            <!-- TAB 1: UNCLOSED SPLIT LOTS -->
            <template v-if="activeTab === 'split_lots'">
              <div v-if="report.unclosedSplitLots.length === 0" class="py-12 text-center space-y-1.5">
                <div class="text-2xl">✅</div>
                <div class="text-sm font-black text-base-content">All split parent lots are cleanly closed</div>
                <p class="text-xs text-base-content/65">
                  No active parent lots have extracted split items waiting to be marked Deconstructed.
                </p>
              </div>

              <div
                v-for="row in report.unclosedSplitLots"
                :key="row.id"
                class="rounded-2xl border border-base-300 bg-base-100 p-3 hover:border-primary/40 transition-colors space-y-2.5"
              >
                <div class="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                  <div class="flex items-start gap-2.5 min-w-0 flex-1">
                    <input
                      v-if="row.canEdit"
                      type="checkbox"
                      class="checkbox checkbox-sm checkbox-primary mt-1 shrink-0"
                      :checked="selectedIds.has(row.id)"
                      @change="toggleSelect(row.id)"
                    />
                    <ItemThumbnail :item="row.parentLot" size="sm" rounded="lg" class="shrink-0" />
                    <div class="min-w-0 flex-1">
                      <div class="font-bold text-xs sm:text-sm text-base-content break-words">
                        {{ row.parentLot.title || 'Untitled Parent Lot' }}
                      </div>
                      <div class="flex items-center gap-1.5 flex-wrap mt-1 text-[11px] font-mono">
                        <span class="badge badge-2xs badge-neutral text-neutral-content font-bold">
                          {{ row.parentLot.upc || 'NO-UPC' }}
                        </span>
                        <span class="badge badge-2xs badge-warning text-warning-content font-bold">
                          {{ row.parentLot.status }} @ {{ row.parentLot.storageLocation || 'HG' }}
                        </span>
                        <span v-if="Number(row.parentLot.cost || 0) > 0" class="text-base-content/75">
                          Cost: ${{ Number(row.parentLot.cost).toFixed(2) }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-1.5 shrink-0 ml-auto">
                    <button
                      type="button"
                      class="btn btn-xs h-9 btn-ghost border border-base-300 rounded-xl font-bold"
                      @click="emit('inspect-item', row.parentLot)"
                    >
                      Inspect
                    </button>
                    <button
                      v-if="row.canEdit"
                      type="button"
                      class="btn btn-xs h-9 btn-primary text-primary-content rounded-xl font-black px-3"
                      :disabled="isSubmitting"
                      @click="markParentsDeconstructed([row.id])"
                    >
                      ✂️ Mark Split
                    </button>
                    <span v-else class="badge badge-xs badge-ghost">Read-only</span>
                  </div>
                </div>

                <!-- Extracted Children Proof Strip -->
                <div class="rounded-xl bg-base-200/60 border border-base-300/70 px-3 py-2 text-xs space-y-1">
                  <div class="font-bold text-base-content/80 flex items-center gap-2 flex-wrap">
                    <span>✂️ {{ row.children.length }} Extracted Child Item{{ row.children.length === 1 ? '' : 's' }}:</span>
                    <span v-if="row.soldChildrenCount > 0" class="badge badge-2xs badge-success text-success-content font-bold">
                      {{ row.soldChildrenCount }} sold
                    </span>
                    <span v-if="row.placedChildrenCount > 0" class="badge badge-2xs badge-info text-info-content font-bold">
                      {{ row.placedChildrenCount }} placed
                    </span>
                    <span v-if="row.receivedChildrenCount > 0" class="badge badge-2xs badge-ghost font-bold">
                      {{ row.receivedChildrenCount }} backstock
                    </span>
                  </div>
                  <div class="flex flex-wrap gap-1.5 pt-0.5">
                    <button
                      v-for="kid in row.children.slice(0, 6)"
                      :key="kid.$id"
                      type="button"
                      class="badge badge-sm bg-base-100 border border-base-300 text-base-content font-mono gap-1 hover:border-primary cursor-pointer"
                      @click="emit('inspect-item', kid)"
                    >
                      <span>{{ kid.upc || 'Item' }}</span>
                      <span class="opacity-65">({{ kid.status }})</span>
                    </button>
                    <span v-if="row.children.length > 6" class="text-[11px] text-base-content/65 self-center">
                      +{{ row.children.length - 6 }} more
                    </span>
                  </div>
                </div>
              </div>
            </template>

            <!-- TAB 2: ALREADY-SOLD BACKSTOCK GHOSTS -->
            <template v-else-if="activeTab === 'sold_ghosts'">
              <div v-if="filteredSoldGhosts.length === 0" class="py-12 text-center space-y-1.5">
                <div class="text-2xl">✨</div>
                <div class="text-sm font-black text-base-content">
                  No {{ ghostConfidenceFilter === 'exact' ? 'exact sold twins' : 'possible title matches' }} in this view
                </div>
                <p class="text-xs text-base-content/65">
                  Switch between Exact Proof and Possible Title Matches above to check the other list.
                </p>
              </div>

              <div
                v-for="g in filteredSoldGhosts"
                :key="g.id"
                class="rounded-2xl border border-base-300 bg-base-100 p-3 hover:border-primary/40 transition-colors space-y-2.5"
              >
                <div class="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                  <div class="flex items-center gap-2">
                    <input
                      v-if="g.confidence === 'exact' && g.canEditGhost"
                      type="checkbox"
                      class="checkbox checkbox-sm checkbox-primary"
                      :checked="selectedIds.has(g.id)"
                      @change="toggleSelect(g.id)"
                    />
                    <span
                      class="badge badge-xs font-bold"
                      :class="
                        g.confidence === 'exact'
                          ? 'badge-error text-error-content'
                          : 'badge-warning text-warning-content'
                      "
                    >
                      {{ g.confidence === 'exact' ? '🔒 Exact Proof' : '🔎 Review Match' }}
                    </span>
                    <span class="font-semibold text-base-content/80">{{ g.reasonLabel }}</span>
                  </div>

                  <span
                    v-if="g.provenanceToCarry?.cost && g.canBackfillKeeper"
                    class="badge badge-xs badge-info text-info-content font-bold"
                  >
                    💡 Carries ${{ Number(g.provenanceToCarry.cost).toFixed(2) }} cost to Sold Record
                  </span>
                </div>

                <!-- Side-by-Side Comparison -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <!-- Left: Backstock Ghost -->
                  <div class="rounded-xl bg-warning/8 border border-warning/30 p-2.5 flex items-start gap-2.5">
                    <ItemThumbnail :item="g.ghostItem" size="sm" rounded="lg" class="shrink-0" />
                    <div class="min-w-0 flex-1 space-y-0.5">
                      <div class="text-[10px] font-extrabold uppercase tracking-wider text-base-content/60">
                        Backstock Copy (Unplaced)
                      </div>
                      <div class="font-bold text-xs text-base-content break-words">
                        {{ g.ghostItem.title || 'Untitled Item' }}
                      </div>
                      <div class="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                        <span class="badge badge-2xs badge-neutral text-neutral-content font-bold">
                          {{ g.ghostItem.upc || 'NO-UPC' }}
                        </span>
                        <span>📍 {{ g.ghostItem.storageLocation || 'HG' }} ({{ g.ghostItem.status }})</span>
                        <span v-if="Number(g.ghostItem.cost || 0) > 0">
                          • Cost ${{ Number(g.ghostItem.cost).toFixed(2) }}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      class="btn btn-2xs h-7 px-2 btn-ghost border border-base-300 rounded-lg font-bold shrink-0"
                      @click="emit('inspect-item', g.ghostItem)"
                    >
                      Open
                    </button>
                  </div>

                  <!-- Right: Sold / Deconstructed Proof -->
                  <div class="rounded-xl bg-success/8 border border-success/30 p-2.5 flex items-start gap-2.5">
                    <ItemThumbnail
                      v-if="g.matchedItem"
                      :item="g.matchedItem"
                      size="sm"
                      rounded="lg"
                      class="shrink-0"
                    />
                    <div class="min-w-0 flex-1 space-y-0.5">
                      <div class="text-[10px] font-extrabold uppercase tracking-wider text-success">
                        👑 Official Sold / Split Record (Kept)
                      </div>
                      <div class="font-bold text-xs text-base-content break-words">
                        {{
                          g.matchedItem?.title ||
                          g.matchedSale?.orderId ||
                          g.matchedSale?.soNumber ||
                          'Recorded Sale'
                        }}
                      </div>
                      <div class="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                        <span
                          v-if="g.matchedItem?.upc"
                          class="badge badge-2xs badge-success text-success-content font-bold"
                        >
                          {{ g.matchedItem.upc }}
                        </span>
                        <span
                          v-if="g.matchedItem?.locationSku"
                          class="badge badge-2xs badge-secondary text-secondary-content font-bold"
                        >
                          {{ g.matchedItem.locationSku }}
                        </span>
                        <span v-if="g.matchedSale">
                          🎟️ ${{ Number(g.matchedSale.grossAmount || 0).toFixed(2) }}
                          <template v-if="g.matchedSale.saleDate">
                            ({{ String(g.matchedSale.saleDate).slice(0, 10) }})
                          </template>
                        </span>
                        <span v-else-if="g.matchedItem">
                          Status: {{ g.matchedItem.status }}
                        </span>
                      </div>
                    </div>
                    <button
                      v-if="g.matchedItem"
                      type="button"
                      class="btn btn-2xs h-7 px-2 btn-ghost border border-base-300 rounded-lg font-bold shrink-0"
                      @click="emit('inspect-item', g.matchedItem)"
                    >
                      Open
                    </button>
                  </div>
                </div>

                <!-- Row Actions -->
                <div class="flex items-center justify-end gap-2 pt-0.5 flex-wrap">
                  <button
                    type="button"
                    class="btn btn-xs h-9 btn-ghost border border-base-300 rounded-xl font-bold"
                    @click="emit('dismiss-pair', g.pairKey)"
                  >
                    ✋ Keep in Stock (Real 2nd Copy)
                  </button>
                  <button
                    v-if="g.canEditGhost"
                    type="button"
                    class="btn btn-xs h-9 btn-primary text-primary-content rounded-xl font-black px-3"
                    :disabled="isSubmitting"
                    @click="archiveSoldGhosts([g])"
                  >
                    📥 Archive Backstock Ghost
                  </button>
                  <span v-else class="badge badge-xs badge-ghost">Read-only</span>
                </div>
              </div>
            </template>

            <!-- TAB 3: ACTIVE DUPLICATE CLUSTERS -->
            <template v-else-if="activeTab === 'active_clones'">
              <div v-if="report.activeDuplicateClusters.length === 0" class="py-12 text-center space-y-1.5">
                <div class="text-2xl">✅</div>
                <div class="text-sm font-black text-base-content">Zero duplicate active copies found</div>
                <p class="text-xs text-base-content/65">
                  Every active single-unit item has a distinct sourcing ID and title.
                </p>
              </div>

              <div
                v-for="cluster in report.activeDuplicateClusters"
                :key="cluster.id"
                class="rounded-2xl border border-base-300 bg-base-100 p-3 space-y-2.5"
              >
                <div class="flex items-center justify-between gap-2 flex-wrap text-xs">
                  <div class="flex items-center gap-2">
                    <input
                      v-if="!cluster.requiresManualCheck && canArchiveCluster(cluster)"
                      type="checkbox"
                      class="checkbox checkbox-sm checkbox-primary"
                      :checked="selectedIds.has(cluster.id)"
                      @change="toggleSelect(cluster.id)"
                    />
                    <span class="badge badge-xs badge-secondary text-secondary-content font-bold">
                      {{ cluster.allItems.length }} copies
                    </span>
                    <span class="font-bold text-base-content/85">{{ cluster.matchKeyLabel }}</span>
                    <span
                      v-if="cluster.requiresManualCheck"
                      class="badge badge-xs badge-warning text-warning-content font-bold"
                    >
                      ⚠️ Multiple booth tags — inspect manually
                    </span>
                  </div>

                  <div class="flex items-center gap-1.5">
                    <button
                      type="button"
                      class="btn btn-xs h-8 btn-ghost border border-base-300 rounded-lg font-bold"
                      @click="emit('dismiss-pair', cluster.id)"
                    >
                      ✋ Keep All Copies
                    </button>
                    <button
                      v-if="!cluster.requiresManualCheck && canArchiveCluster(cluster)"
                      type="button"
                      class="btn btn-xs h-8 btn-primary text-primary-content rounded-lg font-black px-2.5"
                      :disabled="isSubmitting"
                      @click="archiveClusters([cluster])"
                    >
                      📥 Archive {{ cluster.clones.length }} Extra
                    </button>
                  </div>
                </div>

                <!-- Keeper + Clones List -->
                <div class="space-y-1.5">
                  <div
                    v-for="it in getOrderedClusterItems(cluster)"
                    :key="it.$id"
                    class="rounded-xl px-2.5 py-2 border flex items-center justify-between gap-2.5 flex-wrap sm:flex-nowrap"
                    :class="
                      it.$id === getEffectiveKeeper(cluster).$id
                        ? 'bg-success/10 border-success/35'
                        : 'bg-base-200/50 border-base-300/80'
                    "
                  >
                    <div class="flex items-center gap-2.5 min-w-0 flex-1">
                      <ItemThumbnail :item="it" size="sm" rounded="lg" class="shrink-0" />
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5 flex-wrap">
                          <span
                            v-if="it.$id === getEffectiveKeeper(cluster).$id"
                            class="badge badge-2xs badge-success text-success-content font-black"
                          >
                            👑 KEEP
                          </span>
                          <span
                            v-else
                            class="badge badge-2xs badge-warning text-warning-content font-bold"
                          >
                            EXTRA COPY
                          </span>
                          <span class="font-bold text-xs text-base-content truncate">
                            {{ it.title || 'Untitled' }}
                          </span>
                        </div>
                        <div class="flex flex-wrap items-center gap-1.5 text-[11px] font-mono mt-0.5">
                          <span class="font-bold">{{ it.upc || 'NO-UPC' }}</span>
                          <span
                            v-if="it.locationSku"
                            class="badge badge-2xs badge-secondary text-secondary-content font-bold"
                          >
                            {{ it.locationSku }}
                          </span>
                          <span>• {{ it.status }} @ {{ it.storageLocation || 'HG' }}</span>
                          <span v-if="Number(it.cost || 0) > 0">
                            • Cost ${{ Number(it.cost).toFixed(2) }}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div class="flex items-center gap-1.5 shrink-0">
                      <button
                        v-if="
                          it.$id !== getEffectiveKeeper(cluster).$id &&
                          !getEffectiveKeeper(cluster).locationSku
                        "
                        type="button"
                        class="btn btn-2xs h-7 px-2 btn-ghost border border-base-300 rounded-lg font-bold"
                        title="Make this copy the Keeper instead"
                        @click="keeperOverrides[cluster.id] = it.$id"
                      >
                        Make Keeper
                      </button>
                      <button
                        type="button"
                        class="btn btn-2xs h-7 px-2 btn-ghost border border-base-300 rounded-lg font-bold"
                        @click="emit('inspect-item', it)"
                      >
                        Open
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <!-- TAB 4: BARCODE COLLISIONS -->
            <template v-else-if="activeTab === 'barcodes'">
              <div v-if="report.barcodeCollisions.length === 0" class="py-12 text-center space-y-1.5">
                <div class="text-2xl">🏷️</div>
                <div class="text-sm font-black text-base-content">Zero barcode collisions detected</div>
                <p class="text-xs text-base-content/65">
                  Every active item has a conflict-free barcode.
                </p>
              </div>

              <div
                v-for="col in report.barcodeCollisions"
                :key="col.id"
                class="rounded-2xl border border-base-300 bg-base-100 p-3 space-y-2"
              >
                <div class="flex items-center justify-between gap-2 flex-wrap">
                  <div class="flex items-center gap-2 text-xs">
                    <span class="badge badge-sm badge-error text-error-content font-mono font-black">
                      {{ col.upc }}
                    </span>
                    <span class="font-bold text-base-content">
                      Protected Tag Owner: {{ col.protectedSummary }}
                    </span>
                  </div>
                </div>

                <div
                  v-for="target in col.retagTargets"
                  :key="target.$id"
                  class="rounded-xl bg-base-200/60 border border-base-300 p-2.5 flex items-center justify-between gap-2.5 flex-wrap sm:flex-nowrap"
                >
                  <div class="flex items-center gap-2.5 min-w-0 flex-1">
                    <ItemThumbnail :item="target" size="sm" rounded="lg" class="shrink-0" />
                    <div class="min-w-0">
                      <div class="font-bold text-xs text-base-content break-words">
                        {{ target.title || 'Unplaced Item' }}
                      </div>
                      <div class="text-[11px] font-mono text-base-content/75">
                        {{ target.status }} @ {{ target.storageLocation || 'HG' }} • Needs fresh barcode
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      class="btn btn-xs h-9 btn-ghost border border-base-300 rounded-xl font-bold"
                      @click="emit('inspect-item', target)"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      class="btn btn-xs h-9 btn-primary text-primary-content rounded-xl font-black px-3"
                      :disabled="isSubmitting"
                      @click="mintFreshBarcodeForItem(target)"
                    >
                      🔄 Mint Fresh Barcode
                    </button>
                  </div>
                </div>

                <div
                  v-if="col.retagTargets.length === 0"
                  class="text-xs text-warning font-semibold px-1"
                >
                  Both items have physical booth tags or belong to another Curator — inspect manually before re-tagging.
                </div>
              </div>
            </template>

            <!-- TAB 5: STALE / ALREADY-RECEIVED OPEN PURCHASE ORDERS -->
            <template v-else>
              <div v-if="report.staleOpenPurchases.length === 0" class="py-12 text-center space-y-1.5">
                <div class="text-2xl">🚚</div>
                <div class="text-sm font-black text-base-content">No stale Open Purchase Orders found</div>
                <p class="text-xs text-base-content/65">
                  All remaining open POs still have items in transit or awaiting check-in.
                </p>
              </div>

              <div
                v-for="poRow in report.staleOpenPurchases"
                :key="poRow.id"
                class="rounded-2xl border border-base-300 bg-base-100 p-3 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap"
              >
                <div class="flex items-start gap-2.5 min-w-0 flex-1">
                  <input
                    v-if="poRow.canEdit"
                    type="checkbox"
                    class="checkbox checkbox-sm checkbox-primary mt-1 shrink-0"
                    :checked="selectedIds.has(poRow.id)"
                    @change="toggleSelect(poRow.id)"
                  />
                  <div class="min-w-0 space-y-0.5">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="font-mono font-black text-xs sm:text-sm text-base-content">
                        {{ poRow.purchase.poNumber || poRow.purchase.orderId || 'Purchase Order' }}
                      </span>
                      <span class="badge badge-2xs badge-warning text-warning-content font-bold">
                        {{ poRow.purchase.status || 'Open' }}
                      </span>
                      <span class="text-xs font-semibold text-base-content/75">
                        {{ poRow.purchase.vendor || 'Vendor' }} • ${{
                          Number(poRow.purchase.grandTotal || 0).toFixed(2)
                        }}
                      </span>
                    </div>
                    <div class="text-xs text-base-content/75">
                      {{ poRow.reasonLabel }}
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-1.5 shrink-0 ml-auto">
                  <a
                    :href="`/purchases?q=${encodeURIComponent(poRow.purchase.poNumber || poRow.purchase.orderId || '')}`"
                    class="btn btn-xs h-9 btn-ghost border border-base-300 rounded-xl font-bold"
                  >
                    View PO ↗
                  </a>
                  <button
                    v-if="poRow.canEdit"
                    type="button"
                    class="btn btn-xs h-9 btn-success text-success-content rounded-xl font-black px-3"
                    :disabled="isSubmitting"
                    @click="markPurchasesReceived([poRow.id])"
                  >
                    ✅ Mark Received
                  </button>
                </div>
              </div>
            </template>
          </div>

          <!-- Mandatory Visible Pre-Flight Batch Queue Preview + Sticky Footer -->
          <footer class="border-t border-base-300 bg-base-200/80 px-4 sm:px-6 py-2.5 space-y-2 shrink-0">
            <div
              v-if="selectedPreviewLines.length > 0"
              class="rounded-xl bg-base-100 border border-primary/35 px-3 py-2 text-xs space-y-1 max-h-28 overflow-y-auto"
            >
              <div class="font-black text-primary flex items-center justify-between">
                <span>📋 Pre-Flight Preview ({{ selectedPreviewLines.length }} selected)</span>
                <button type="button" class="link link-hover text-[11px]" @click="clearSelection">
                  Clear selection
                </button>
              </div>
              <div
                v-for="(line, idx) in selectedPreviewLines.slice(0, 12)"
                :key="idx"
                class="font-mono text-[11px] text-base-content/80 truncate"
              >
                {{ line }}
              </div>
              <div v-if="selectedPreviewLines.length > 12" class="text-[11px] text-base-content/65">
                +{{ selectedPreviewLines.length - 12 }} more in batch…
              </div>
            </div>

            <div class="flex items-center justify-between gap-2 flex-wrap">
              <div class="flex items-center gap-2">
                <button
                  v-if="selectableIdsInActiveTab.length > 0"
                  type="button"
                  class="btn btn-xs sm:btn-sm h-11 md:h-9 btn-ghost border border-base-300 rounded-xl font-bold"
                  :disabled="isSubmitting"
                  @click="toggleSelectAllActiveTab"
                >
                  {{
                    allSelectableChecked
                      ? 'Unselect All'
                      : `Select All Safe (${selectableIdsInActiveTab.length})`
                  }}
                </button>
                <span class="text-xs text-base-content/70 hidden sm:inline">
                  Physical booth tags are always locked &amp; protected.
                </span>
              </div>

              <div class="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  class="btn btn-sm h-11 md:h-9 btn-ghost rounded-xl font-bold"
                  :disabled="isSubmitting"
                  @click="closeTray"
                >
                  Done
                </button>

                <button
                  v-if="selectedIds.size > 0 && batchActionLabel"
                  type="button"
                  class="btn btn-sm h-11 md:h-9 btn-primary text-primary-content rounded-xl font-black px-4 shadow-xs"
                  :disabled="isSubmitting"
                  @click="runSelectedBatchAction"
                >
                  <span v-if="isSubmitting" class="loading loading-spinner loading-xs"></span>
                  <span>{{ batchActionLabel }}</span>
                </button>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import ItemThumbnail from '../common/ItemThumbnail.vue';
import { useBodyScrollLock } from '../../composables/useBodyScrollLock';
import { useMemberCapabilities } from '../../lib/memberAccess';
import { getCollectionId, DB_ID } from '../../lib/inventory';
import { getCoopJwtHeaders } from '../../lib/coopLedgerClient';
import { generateNextUpc } from '../../lib/upcAuthority';
import { extractItemOwnerPrefix, resolveMintingPrefixForMember } from '../../lib/curatorOwnership';
import { purchasesAPI } from '../../lib/purchases';
import { toUserMessage } from '../../lib/userFacingErrors';
import { addToast } from '../../stores/toast';
import { confirmDialog } from '../../stores/confirm';
import { useAuth } from '../../composables/useAuth';
import type {
  ActiveDuplicateCluster,
  HealthAuditScope,
  InventoryHealthReport,
  SoldTwinGhostFinding,
} from '../../lib/inventoryHealthAudit';

type HealthBucketTabId =
  | 'split_lots'
  | 'sold_ghosts'
  | 'active_clones'
  | 'barcodes'
  | 'stale_pos';

const props = defineProps<{
  modelValue: boolean;
  report: InventoryHealthReport;
  scope: HealthAuditScope;
  dismissedCount: number;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'update:scope', val: HealthAuditScope): void;
  (e: 'inspect-item', item: any): void;
  (e: 'dismiss-pair', key: string): void;
  (e: 'reset-dismissed'): void;
  (e: 'refresh-all'): void;
}>();

const mounted = ref(false);
onMounted(() => {
  mounted.value = true;
});

useBodyScrollLock(() => props.modelValue);

const { capabilities } = useMemberCapabilities();
const { user } = useAuth();

const activeTab = ref<HealthBucketTabId>('sold_ghosts');
const ghostConfidenceFilter = ref<'exact' | 'fuzzy'>('exact');
const selectedIds = ref<Set<string>>(new Set());
const keeperOverrides = reactive<Record<string, string>>({});
const isSubmitting = ref(false);

const closeTray = () => {
  emit('update:modelValue', false);
};

const clearSelection = () => {
  selectedIds.value = new Set();
};

const switchTab = (tab: HealthBucketTabId) => {
  activeTab.value = tab;
  clearSelection();
};

const bucketTabs = computed(() => [
  {
    id: 'split_lots' as const,
    label: '✂️ Split Lots',
    count: props.report.unclosedSplitLots.length,
  },
  {
    id: 'sold_ghosts' as const,
    label: '💸 Sold Ghosts',
    count: props.report.soldTwinGhosts.length,
  },
  {
    id: 'active_clones' as const,
    label: '👯 Active Clones',
    count: props.report.activeDuplicateClusters.length,
  },
  {
    id: 'barcodes' as const,
    label: '🏷️ Barcode Clashes',
    count: props.report.barcodeCollisions.length,
  },
  {
    id: 'stale_pos' as const,
    label: '🚚 Ready-to-Close POs',
    count: props.report.staleOpenPurchases.length,
  },
]);

const activeTabDescription = computed(() => {
  switch (activeTab.value) {
    case 'split_lots':
      return 'Parent lots that already have extracted child items in stock or sold. Marking them Split (Deconstructed) removes the ghost parent from Unplaced Backstock while keeping full lineage.';
    case 'active_clones':
      return 'Multiple active single-unit records for the same item. Booth-tagged items are automatically locked as Keeper; extra copies are safely archived.';
    case 'barcodes':
      return 'Unplaced backstock items sharing a barcode with a placed/sold booth tag. Minting a fresh barcode updates only the unplaced item.';
    case 'stale_pos':
      return 'Open Purchase Orders where 100% of linked items are already checked in, placed, or sold.';
    default:
      return '';
  }
});

const filteredSoldGhosts = computed(() =>
  props.report.soldTwinGhosts.filter((g) => g.confidence === ghostConfidenceFilter.value)
);

const getEffectiveKeeper = (cluster: ActiveDuplicateCluster) => {
  const overrideId = keeperOverrides[cluster.id];
  if (overrideId) {
    const found = cluster.allItems.find((i) => i.$id === overrideId);
    if (found) return found;
  }
  return cluster.keeper;
};

const getOrderedClusterItems = (cluster: ActiveDuplicateCluster) => {
  const keeper = getEffectiveKeeper(cluster);
  return [keeper, ...cluster.allItems.filter((i) => i.$id !== keeper.$id)];
};

const canArchiveCluster = (cluster: ActiveDuplicateCluster) => {
  const keeper = getEffectiveKeeper(cluster);
  const clones = cluster.allItems.filter((i) => i.$id !== keeper.$id);
  return clones.length > 0 && !clones.some((c) => Boolean(c.locationSku));
};

const selectableIdsInActiveTab = computed<string[]>(() => {
  if (activeTab.value === 'split_lots') {
    return props.report.unclosedSplitLots.filter((r) => r.canEdit).map((r) => r.id);
  }
  if (activeTab.value === 'sold_ghosts' && ghostConfidenceFilter.value === 'exact') {
    return filteredSoldGhosts.value.filter((g) => g.canEditGhost).map((g) => g.id);
  }
  if (activeTab.value === 'active_clones') {
    return props.report.activeDuplicateClusters
      .filter((c) => !c.requiresManualCheck && canArchiveCluster(c))
      .map((c) => c.id);
  }
  if (activeTab.value === 'stale_pos') {
    return props.report.staleOpenPurchases.filter((p) => p.canEdit).map((p) => p.id);
  }
  return [];
});

const allSelectableChecked = computed(
  () =>
    selectableIdsInActiveTab.value.length > 0 &&
    selectableIdsInActiveTab.value.every((id) => selectedIds.value.has(id))
);

const toggleSelect = (id: string) => {
  const next = new Set(selectedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selectedIds.value = next;
};

const toggleSelectAllActiveTab = () => {
  if (allSelectableChecked.value) {
    clearSelection();
  } else {
    selectedIds.value = new Set(selectableIdsInActiveTab.value);
  }
};

const selectedPreviewLines = computed<string[]>(() => {
  const ids = selectedIds.value;
  if (ids.size === 0) return [];

  if (activeTab.value === 'split_lots') {
    return props.report.unclosedSplitLots
      .filter((r) => ids.has(r.id))
      .map(
        (r) =>
          `${r.parentLot.upc || 'LOT'} ➔ Deconstructed (${r.children.length} extracted items) • "${r.parentLot.title}"`
      );
  }
  if (activeTab.value === 'sold_ghosts') {
    return filteredSoldGhosts.value
      .filter((g) => ids.has(g.id))
      .map(
        (g) =>
          `${g.ghostItem.upc || 'ITEM'} (${g.ghostItem.storageLocation || 'HG'}) ➔ Archived [Kept: ${g.matchedItem?.upc || g.matchedSale?.soNumber || 'Sold Record'}]`
      );
  }
  if (activeTab.value === 'active_clones') {
    return props.report.activeDuplicateClusters
      .filter((c) => ids.has(c.id))
      .map((c) => {
        const k = getEffectiveKeeper(c);
        const cloneUpcs = c.allItems
          .filter((i) => i.$id !== k.$id)
          .map((i) => i.upc || 'Clone')
          .join(', ');
        return `Keep ${k.upc || 'Primary'} ➔ Archive [${cloneUpcs}] • "${k.title}"`;
      });
  }
  if (activeTab.value === 'stale_pos') {
    return props.report.staleOpenPurchases
      .filter((p) => ids.has(p.id))
      .map(
        (p) =>
          `${p.purchase.poNumber || p.purchase.orderId} (${p.purchase.vendor || 'Vendor'}) ➔ Status: Received`
      );
  }
  return [];
});

const batchActionLabel = computed(() => {
  const n = selectedIds.value.size;
  if (n === 0) return '';
  switch (activeTab.value) {
    case 'split_lots':
      return `✂️ Mark ${n} Split Lot${n === 1 ? '' : 's'} Deconstructed`;
    case 'sold_ghosts':
      return `📥 Archive ${n} Sold Ghost${n === 1 ? '' : 's'}`;
    case 'active_clones':
      return `📥 Clean ${n} Duplicate Group${n === 1 ? '' : 's'}`;
    case 'stale_pos':
      return `✅ Mark ${n} PO${n === 1 ? '' : 's'} Received`;
    default:
      return '';
  }
});

async function postBulkItemUpdate(itemIds: string[], updates: Record<string, any>) {
  const resp = await fetch('/api/inventory/bulk-update', {
    method: 'POST',
    headers: await getCoopJwtHeaders(),
    body: JSON.stringify({
      itemIds,
      updates,
      collectionId: getCollectionId(),
      dbId: DB_ID,
    }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data?.error || 'Could not save inventory cleanup changes.');
  }
  return data;
}

const todayStamp = () => new Date().toISOString().slice(0, 10);

const markParentsDeconstructed = async (ids: string[]) => {
  if (ids.length === 0) return;
  if (ids.length > 1) {
    const ok = await confirmDialog({
      title: 'Mark Parent Lots Split?',
      message: `Mark ${ids.length} already-split parent lots as Deconstructed? Their extracted child items, photos, and purchase history stay untouched.`,
      confirmText: `Mark ${ids.length} Split`,
      cancelText: 'Cancel',
    });
    if (!ok) return;
  }

  isSubmitting.value = true;
  try {
    const res = await postBulkItemUpdate(ids, {
      status: 'deconstructed',
      appendAuditNote: `[Marked Split/Deconstructed via Health Check • ${todayStamp()}]`,
    });
    addToast({
      type: 'success',
      message: `✅ Marked ${res.updatedCount ?? ids.length} split parent lot${ids.length === 1 ? '' : 's'} as Deconstructed.`,
    });
    clearSelection();
    emit('refresh-all');
  } catch (err) {
    console.error('[HealthAudit] markParentsDeconstructed error:', err);
    addToast({
      type: 'error',
      message: toUserMessage(err, "Couldn't update split lot status — please try again."),
    });
  } finally {
    isSubmitting.value = false;
  }
};

const archiveSoldGhosts = async (ghostRows: SoldTwinGhostFinding[]) => {
  if (ghostRows.length === 0) return;
  if (ghostRows.length > 1) {
    const ok = await confirmDialog({
      title: 'Archive Sold Backstock Ghosts?',
      message: `Archive ${ghostRows.length} backstock ghost items that already have an official sold/split record? Missing purchase costs on sold records will carry forward automatically.`,
      confirmText: `Archive ${ghostRows.length} Ghosts`,
      cancelText: 'Cancel',
    });
    if (!ok) return;
  }

  isSubmitting.value = true;
  try {
    // 1. Backfill missing cost / PO provenance onto surviving sold records first
    for (const g of ghostRows) {
      if (g.matchedItem?.$id && g.provenanceToCarry && g.canBackfillKeeper) {
        await postBulkItemUpdate([g.matchedItem.$id], {
          backfillIfMissing: g.provenanceToCarry,
        }).catch((e) => console.warn('[HealthAudit] Keeper provenance backfill skipped:', e));
      }
    }

    // 2. Archive ghost items non-destructively
    const ids = ghostRows.map((g) => g.ghostItem.$id);
    const res = await postBulkItemUpdate(ids, {
      status: 'archived',
      appendAuditNote: `[Archived Sold-Twin Duplicate via Health Check • ${todayStamp()}]`,
    });

    addToast({
      type: 'success',
      message: `✅ Archived ${res.updatedCount ?? ids.length} sold backstock ghost${ids.length === 1 ? '' : 's'}.`,
    });
    clearSelection();
    emit('refresh-all');
  } catch (err) {
    console.error('[HealthAudit] archiveSoldGhosts error:', err);
    addToast({
      type: 'error',
      message: toUserMessage(err, "Couldn't archive duplicate items — please try again."),
    });
  } finally {
    isSubmitting.value = false;
  }
};

const archiveClusters = async (clusters: ActiveDuplicateCluster[]) => {
  if (clusters.length === 0) return;
  const allCloneIds: string[] = [];
  for (const c of clusters) {
    const keeper = getEffectiveKeeper(c);
    for (const item of c.allItems) {
      if (item.$id !== keeper.$id) allCloneIds.push(item.$id);
    }
  }
  if (allCloneIds.length === 0) return;

  if (clusters.length > 1 || allCloneIds.length > 1) {
    const ok = await confirmDialog({
      title: 'Archive Extra Duplicate Copies?',
      message: `Keep 1 primary record per group and archive ${allCloneIds.length} extra duplicate copies?`,
      confirmText: `Archive ${allCloneIds.length} Copies`,
      cancelText: 'Cancel',
    });
    if (!ok) return;
  }

  isSubmitting.value = true;
  try {
    for (const c of clusters) {
      const keeper = getEffectiveKeeper(c);
      if (keeper?.$id && c.provenanceToCarry && c.canEditKeeper) {
        await postBulkItemUpdate([keeper.$id], {
          backfillIfMissing: c.provenanceToCarry,
        }).catch((e) => console.warn('[HealthAudit] Cluster keeper backfill skipped:', e));
      }
    }

    const res = await postBulkItemUpdate(allCloneIds, {
      status: 'archived',
      appendAuditNote: `[Archived Extra Duplicate Copy via Health Check • ${todayStamp()}]`,
    });
    addToast({
      type: 'success',
      message: `✅ Archived ${res.updatedCount ?? allCloneIds.length} extra duplicate cop${allCloneIds.length === 1 ? 'y' : 'ies'}.`,
    });
    clearSelection();
    emit('refresh-all');
  } catch (err) {
    console.error('[HealthAudit] archiveClusters error:', err);
    addToast({
      type: 'error',
      message: toUserMessage(err, "Couldn't archive extra copies — please try again."),
    });
  } finally {
    isSubmitting.value = false;
  }
};

const mintFreshBarcodeForItem = async (item: any) => {
  if (!item?.$id) return;
  isSubmitting.value = true;
  try {
    const rawPrefix =
      extractItemOwnerPrefix(item) ||
      resolveMintingPrefixForMember(capabilities.value, user.value?.$id).prefix ||
      'HUCK-';
    const cleanRoot = rawPrefix.replace(/-$/, '');
    const freshUpc = await generateNextUpc(cleanRoot);
    await postBulkItemUpdate([item.$id], {
      upc: freshUpc,
      appendAuditNote: `[Re-barcoded from colliding ${item.upc || 'UPC'} ➔ ${freshUpc} • ${todayStamp()}]`,
    });
    addToast({
      type: 'success',
      message: `✅ Assigned fresh barcode ${freshUpc} to "${item.title || 'item'}".`,
    });
    emit('refresh-all');
  } catch (err) {
    console.error('[HealthAudit] mintFreshBarcodeForItem error:', err);
    addToast({
      type: 'error',
      message: toUserMessage(err, "Couldn't mint a fresh barcode — please try again."),
    });
  } finally {
    isSubmitting.value = false;
  }
};

const markPurchasesReceived = async (poIds: string[]) => {
  if (poIds.length === 0) return;
  if (poIds.length > 1) {
    const ok = await confirmDialog({
      title: 'Mark Purchase Orders Received?',
      message: `Mark ${poIds.length} Purchase Orders as Received? Every linked item on these orders is already checked in, placed, or sold.`,
      confirmText: `Mark ${poIds.length} Received`,
      cancelText: 'Cancel',
    });
    if (!ok) return;
  }

  isSubmitting.value = true;
  try {
    let done = 0;
    for (const id of poIds) {
      await purchasesAPI.updatePurchase(id, { status: 'Received' });
      done++;
    }
    addToast({
      type: 'success',
      message: `✅ Marked ${done} Purchase Order${done === 1 ? '' : 's'} as Received.`,
    });
    clearSelection();
    emit('refresh-all');
  } catch (err) {
    console.error('[HealthAudit] markPurchasesReceived error:', err);
    addToast({
      type: 'error',
      message: toUserMessage(err, "Couldn't update Purchase Order status — please try again."),
    });
  } finally {
    isSubmitting.value = false;
  }
};

const runSelectedBatchAction = async () => {
  const ids = Array.from(selectedIds.value);
  if (ids.length === 0) return;

  if (activeTab.value === 'split_lots') {
    await markParentsDeconstructed(ids);
  } else if (activeTab.value === 'sold_ghosts') {
    const rows = filteredSoldGhosts.value.filter((g) => selectedIds.value.has(g.id));
    await archiveSoldGhosts(rows);
  } else if (activeTab.value === 'active_clones') {
    const clusters = props.report.activeDuplicateClusters.filter((c) =>
      selectedIds.value.has(c.id)
    );
    await archiveClusters(clusters);
  } else if (activeTab.value === 'stale_pos') {
    await markPurchasesReceived(ids);
  }
};
</script>
