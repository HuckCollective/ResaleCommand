<template>
  <Teleport to="body">
    <div v-if="isOpen" class="relative z-400">
      <!-- Backdrop (Solid bg-black/60 without blur for smooth 60fps mobile/desktop transitions) -->
      <div
        class="fixed inset-0 bg-black/60 transition-opacity"
        @click.stop.prevent="emit('close')"
      ></div>

      <!-- Slide-Over Drawer Container: Mobile full-width, Desktop expanded (matches ItemDrawer.vue) -->
      <div
        class="fixed inset-y-0 right-0 w-full md:w-155 lg:w-220 xl:w-240 bg-base-100 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out"
      >
        <!-- 1. PINNED DRAWER HEADER -->
        <div class="border-b border-base-200 bg-base-100 flex-none sticky top-0 z-30 px-4 py-3 sm:px-6 flex items-center justify-between gap-3 shadow-2xs">
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <div
              class="w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0 shadow-2xs"
              :class="
                form.kind === 'report'
                  ? 'bg-warning/15 text-warning'
                  : form.kind === 'prompt'
                    ? 'bg-primary/15 text-primary'
                    : form.kind === 'spec'
                      ? 'bg-secondary/15 text-secondary'
                      : 'bg-accent/15 text-accent'
              "
            >
              <span>{{ KIND_META[form.kind].icon }}</span>
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span v-if="form.isLocked || form.isMasterTemplate" class="badge badge-error badge-xs font-bold gap-1">
                  <span>{{ isCardLocked ? '🔒 Locked' : '🔓 Founder Unlocked' }}</span>
                </span>
                <span class="badge badge-xs font-bold" :class="kindBadgeClass(form.kind)">
                  {{ KIND_META[form.kind].icon }} {{ KIND_META[form.kind].label }}
                </span>
                <span v-if="form.destination" class="badge badge-ghost badge-xs font-semibold">
                  {{ DEST_META[form.destination].icon }} {{ DEST_META[form.destination].label }}
                </span>
                <span
                  v-if="effectiveGovStatus"
                  class="badge badge-xs font-bold"
                  :class="GOV_META[effectiveGovStatus].badge"
                >
                  {{ GOV_META[effectiveGovStatus].icon }} {{ GOV_META[effectiveGovStatus].label }}
                </span>
                <span class="badge badge-xs font-mono" :class="bloatBadge.badge">
                  {{ bloatBadge.icon }} +{{ opsImpact.addedTokens }} tok
                </span>
              </div>

              <input
                v-model="form.title"
                type="text"
                :disabled="isCardLocked"
                class="font-black text-sm sm:text-base text-base-content bg-transparent border-b border-transparent hover:border-base-300 focus:border-primary focus:outline-none w-full mt-0.5 py-0.5 truncate disabled:opacity-80"
                placeholder="Enter card title..."
              />
            </div>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              class="btn btn-xs sm:btn-sm btn-primary rounded-xl font-bold gap-1.5 shadow-2xs"
              title="Copy prompt / note text to clipboard"
              @click="emit('copy', form.draftedFixPrompt || form.body)"
            >
              <Icon icon="solar:copy-bold" class="w-4 h-4" />
              <span>{{ form.draftedFixPrompt ? 'Copy Prompt' : 'Copy' }}</span>
            </button>
            <button
              type="button"
              class="btn btn-sm btn-ghost btn-circle"
              aria-label="Close drawer"
              @click="emit('close')"
            >
              ✕
            </button>
          </div>
        </div>

        <!-- 2. SEGMENTED DRAWER TABS (Matches ItemDrawer.vue) -->
        <div class="px-4 sm:px-6 pt-1 pb-0 bg-base-100 border-b border-base-200 flex-none z-20">
          <div role="tablist" class="tabs tabs-bordered font-bold w-full">
            <a
              role="tab"
              class="tab flex-1 text-xs sm:text-sm py-2.5 gap-1.5"
              :class="{ 'tab-active text-primary font-black': drawerTab === 'edit' }"
              @click="switchTab('edit')"
            >
              <Icon icon="solar:pen-new-square-bold-duotone" class="w-4 h-4" />
              <span>Edit &amp; Details</span>
            </a>
            <a
              role="tab"
              class="tab flex-1 text-xs sm:text-sm py-2.5 gap-1.5"
              :class="{ 'tab-active text-secondary font-black': drawerTab === 'copilot' }"
              @click="switchTab('copilot')"
            >
              <Icon icon="solar:users-group-two-rounded-bold-duotone" class="w-4 h-4" />
              <span>🤝 AI Ally &amp; Skills</span>
            </a>
            <a
              role="tab"
              class="tab flex-1 text-xs sm:text-sm py-2.5 gap-1.5"
              :class="{ 'tab-active text-accent font-black': drawerTab === 'audit' }"
              @click="switchTab('audit')"
            >
              <Icon icon="solar:shield-check-bold-duotone" class="w-4 h-4" />
              <span>🛡️ Bias &amp; Ops Cost</span>
            </a>
          </div>
        </div>

        <!-- 3. SCROLLABLE DRAWER BODY -->
        <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          <!-- 🔒 LOCKED TEMPLATE / CARD GOVERNANCE GUARD BANNER -->
          <div
            v-if="form.isLocked || form.isMasterTemplate"
            class="rounded-2xl border p-4 space-y-3"
            :class="
              isCardLocked
                ? 'border-warning/50 bg-warning/10'
                : 'border-error/50 bg-error/10'
            "
          >
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div class="space-y-0.5">
                <div class="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                  <span>{{ isCardLocked ? '🔒 Locked & Guarded by Co-op Governance' : '🔓 Founder Governance Override Active' }}</span>
                </div>
                <p class="text-xs opacity-80 leading-relaxed">
                  <template v-if="isCardLocked">
                    This template is locked so it stays clean for the whole co-op. Click <b>🌱 Clone as New Editable Card</b> to customize your own copy, or (👑 Founder/Dev only) unlock the governance guard below.
                  </template>
                  <template v-else>
                    You have temporarily unlocked this guarded card as a 👑 Founder / Developer. Click <b>🔒 Re-Lock Guard</b> when finished.
                  </template>
                </p>
              </div>

              <div class="flex flex-wrap items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  class="btn btn-xs sm:btn-sm btn-primary rounded-xl font-black gap-1.5"
                  @click="cloneCurrentCardToEditable"
                >
                  <span>🌱 Clone as New Editable Card</span>
                </button>

                <template v-if="isFounder">
                  <button
                    v-if="isCardLocked && !showUnlockConfirm"
                    type="button"
                    class="btn btn-xs sm:btn-sm btn-outline border-warning text-warning-content rounded-xl font-bold"
                    @click="showUnlockConfirm = true"
                  >
                    🔓 Founder Override
                  </button>
                  <button
                    v-else-if="!isCardLocked"
                    type="button"
                    class="btn btn-xs sm:btn-sm btn-warning rounded-xl font-black"
                    @click="reLockCard"
                  >
                    🔒 Re-Lock Guard
                  </button>
                </template>
              </div>
            </div>

            <!-- 2-Step Founder Governance Confirmation -->
            <div
              v-if="isFounder && isCardLocked && showUnlockConfirm"
              class="p-3 rounded-xl bg-base-100 border border-warning/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
            >
              <span class="font-bold text-warning">
                ⚠️ Confirm 👑 Founder / Dev Governance Override to unlock direct editing on this guarded card?
              </span>
              <div class="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  class="btn btn-xs btn-ghost rounded-lg font-semibold"
                  @click="showUnlockConfirm = false"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="btn btn-xs btn-error rounded-lg font-black"
                  @click="confirmFounderUnlock"
                >
                  🔓 Confirm Unlock
                </button>
              </div>
            </div>
          </div>

          <!-- ============================================================= -->
          <!-- TAB A: EDIT & DETAILS                                         -->
          <!-- ============================================================= -->
          <div v-show="drawerTab === 'edit'" class="space-y-5">
            <!-- Card Kind & Target Surface Grid -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div class="bg-base-200/50 rounded-2xl p-4 border border-base-300 space-y-2.5">
                <label class="text-xs font-extrabold uppercase tracking-wider text-base-content/70 block">
                  Card Type
                </label>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    v-for="(meta, k) in KIND_META"
                    :key="k"
                    type="button"
                    :disabled="isCardLocked"
                    class="p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 disabled:opacity-60"
                    :class="
                      form.kind === k
                        ? 'border-primary bg-primary/10 text-primary font-black shadow-2xs'
                        : 'border-base-300 bg-base-100 hover:bg-base-200 font-semibold text-xs'
                    "
                    @click="form.kind = k"
                  >
                    <span class="text-base leading-none">{{ meta.icon }}</span>
                    <span class="text-xs truncate">{{ meta.label }}</span>
                  </button>
                </div>
              </div>

              <div class="bg-base-200/50 rounded-2xl p-4 border border-base-300 space-y-2.5">
                <div class="flex items-center justify-between gap-1">
                  <label class="text-xs font-extrabold uppercase tracking-wider text-base-content/70 block">
                    Target AI Surface (Where You Paste It)
                  </label>
                  <span
                    class="badge badge-secondary badge-xs font-bold"
                    title="Auto-recommended from your issue description"
                  >
                    ✨ Best: {{ DEST_META[detectedRecommendation.recommendedDestination].label }}
                  </span>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    v-for="(meta, key) in DEST_META"
                    :key="key"
                    type="button"
                    :disabled="isCardLocked"
                    class="p-2 rounded-xl border text-left transition-all flex items-center justify-between gap-1.5 disabled:opacity-60"
                    :class="
                      form.destination === key
                        ? 'border-secondary bg-secondary/10 text-secondary font-black shadow-2xs'
                        : 'border-base-300 bg-base-100 hover:bg-base-200 font-semibold text-xs'
                    "
                    @click="form.destination = key"
                  >
                    <div class="flex items-center gap-1.5 min-w-0">
                      <span class="text-sm leading-none">{{ meta.icon }}</span>
                      <span class="text-xs truncate">{{ meta.label }}</span>
                    </div>
                    <span
                      v-if="detectedRecommendation.recommendedDestination === key"
                      class="badge badge-xs badge-secondary font-bold shrink-0"
                    >
                      Auto
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Title Input -->
            <div class="form-control space-y-1.5">
              <label class="text-xs font-extrabold uppercase tracking-wider text-base-content/70">
                Card Title
              </label>
              <input
                v-model="form.title"
                type="text"
                :disabled="isCardLocked"
                class="input input-bordered w-full rounded-xl font-bold text-sm disabled:opacity-70"
                placeholder="Descriptive title for this prompt, idea, spec, or AI report..."
              />
            </div>

            <!-- Parsed Item Snapshot Card (When an AI Report has itemContext) -->
            <div
              v-if="parsedContext"
              class="rounded-2xl border border-secondary/30 bg-secondary/5 p-4 space-y-2.5"
            >
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <div class="text-xs font-extrabold uppercase tracking-wider text-secondary flex items-center gap-1.5">
                  <Icon icon="solar:box-minimalistic-bold-duotone" class="w-4 h-4" />
                  <span>Attached Scan / Item Snapshot</span>
                </div>
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span v-if="parsedContext.tier" class="badge badge-secondary badge-xs font-bold uppercase">
                    {{ parsedContext.tier }}
                  </span>
                  <span v-if="parsedContext.priceOrValue" class="badge badge-success badge-xs font-mono font-bold">
                    {{ parsedContext.priceOrValue }}
                  </span>
                  <span v-if="parsedContext.verdict" class="badge badge-warning badge-xs font-mono font-bold">
                    {{ parsedContext.verdict }}
                  </span>
                </div>
              </div>

              <div class="text-sm font-black text-base-content">{{ parsedContext.title }}</div>
              <p v-if="parsedContext.whyPayUp" class="text-xs text-base-content/80 leading-relaxed">
                <b>Why Pay Up / Notes:</b> {{ parsedContext.whyPayUp }}
              </p>
              <p v-if="parsedContext.whyPass" class="text-xs text-warning leading-relaxed">
                <b>Condition / Risk Flags:</b> {{ parsedContext.whyPass }}
              </p>

              <details class="text-[11px] opacity-70 pt-1">
                <summary class="cursor-pointer font-semibold">Show raw snapshot payload</summary>
                <pre class="text-[10px] font-mono whitespace-pre-wrap break-words mt-1.5 max-h-32 overflow-y-auto bg-base-100 p-2 rounded-xl border border-base-300">{{ parsedContext.rawText }}</pre>
              </details>
            </div>

            <!-- Main Editable Prompt / Note Body -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <label class="text-xs font-extrabold uppercase tracking-wider text-base-content/70">
                  {{ form.kind === 'report' ? 'Reported AI Issue & Expected Behavior (Feeds Your AI Ally Automatically)' : 'Prompt / Spec / Idea Content' }}
                </label>
                <div class="flex items-center gap-2">
                  <span class="text-[11px] font-mono opacity-60">
                    {{ form.body.length }} chars • ~{{ opsImpact.addedTokens }} tokens
                  </span>
                  <button
                    type="button"
                    class="btn btn-xs btn-secondary rounded-lg font-bold gap-1"
                    @click="sendDescriptionToCoPilot"
                  >
                    <Icon icon="solar:users-group-two-rounded-bold" class="w-3.5 h-3.5" />
                    <span>Ask AI Ally to Build Prompt →</span>
                  </button>
                </div>
              </div>
              <textarea
                v-model="form.body"
                rows="10"
                :disabled="isCardLocked"
                class="textarea textarea-bordered w-full font-mono text-xs sm:text-sm leading-relaxed rounded-2xl bg-base-200/40 disabled:opacity-75"
                placeholder="Write or paste your issue description, expected behavior, idea, or prompt here..."
                @input="handleBodyEdited"
              ></textarea>
            </div>

            <!-- 🧭 WHERE & HOW TO PASTE THIS PROMPT (Smart Routing & Handoff Guide) -->
            <div
              class="rounded-2xl border border-info/40 bg-info/5 p-4 space-y-3"
            >
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div class="space-y-0.5">
                  <div class="text-xs font-extrabold uppercase tracking-wider text-info flex items-center gap-1.5">
                    <Icon icon="solar:compass-big-bold-duotone" class="w-4 h-4" />
                    <span>🧭 Where &amp; How to Use This Prompt</span>
                  </div>
                  <div class="text-sm font-black text-base-content">
                    {{ activeRoutingGuide.whereToPasteLabel }}
                  </div>
                </div>

                <span class="badge badge-info badge-sm font-mono font-bold self-start sm:self-center">
                  {{ activeRoutingGuide.modelPickerBadge }}
                </span>
              </div>

              <p class="text-xs text-base-content/80 leading-relaxed">
                <b>Why this surface:</b> {{ activeRoutingGuide.whyThisSurface }}
              </p>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div
                  v-for="step in activeRoutingGuide.handoffSteps"
                  :key="step"
                  class="p-2.5 rounded-xl bg-base-100 border border-base-200 text-xs font-semibold leading-snug"
                >
                  {{ step }}
                </div>
              </div>
            </div>

            <!-- Saved Drafted Fix Prompt (When an AI Report has had a fix drafted) -->
            <div
              v-if="form.draftedFixPrompt"
              class="rounded-2xl border border-primary/40 bg-primary/5 p-4 space-y-2.5"
            >
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <div class="text-xs font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Icon icon="solar:code-square-bold-duotone" class="w-4 h-4" />
                  <span>Saved Vetted Prompt (Ready for {{ DEST_META[form.destination || 'antigravity_ide'].label }})</span>
                </div>
                <button
                  type="button"
                  class="btn btn-xs btn-primary rounded-lg font-bold gap-1"
                  @click="emit('copy', form.draftedFixPrompt)"
                >
                  <Icon icon="solar:copy-bold" class="w-3.5 h-3.5" />
                  <span>📋 Copy Generated Prompt</span>
                </button>
              </div>
              <textarea
                v-model="form.draftedFixPrompt"
                rows="8"
                :disabled="isCardLocked"
                class="textarea textarea-bordered w-full font-mono text-xs leading-relaxed rounded-xl bg-base-100 disabled:opacity-75"
              ></textarea>
            </div>

            <!-- Governance & Vetting Controls (For AI Reports, Ideas & Founder Card Locking) -->
            <div class="bg-base-200/60 rounded-2xl p-4 border border-base-300 space-y-3">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div class="text-xs font-extrabold uppercase tracking-wider text-base-content/80 flex items-center gap-1.5">
                    <Icon icon="solar:shield-user-bold-duotone" class="w-4 h-4 text-primary" />
                    <span>Co-op Governance, Vetting &amp; Card Lock</span>
                  </div>
                  <p class="text-[11px] opacity-65">
                    Only a 👑 Founder / Developer can lock cards, approve reports for <code class="font-mono">alpha-1</code>, or mark them shipped in Git.
                  </p>
                </div>

                <div class="flex items-center gap-1.5 self-start sm:self-center">
                  <button
                    v-if="isFounder && !form.isMasterTemplate"
                    type="button"
                    class="btn btn-xs rounded-xl font-bold gap-1"
                    :class="form.isLocked ? 'btn-warning' : 'btn-outline border-base-300'"
                    @click="toggleFounderLock"
                  >
                    <span>{{ form.isLocked ? '🔒 Locked Card' : '🔓 Lock This Card' }}</span>
                  </button>

                  <button
                    type="button"
                    class="btn btn-xs btn-outline rounded-xl font-bold gap-1.5"
                    @click="emit('upvote', form.id)"
                  >
                    <span>👍 Confirm Pattern</span>
                    <span class="badge badge-xs badge-primary font-mono">{{ form.upvotedBy?.length || 0 }}</span>
                  </button>
                </div>
              </div>

              <div v-if="isFounder" class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  v-for="(gMeta, gKey) in GOV_META"
                  :key="gKey"
                  type="button"
                  :disabled="isCardLocked"
                  class="btn btn-xs sm:btn-sm rounded-xl font-bold justify-start gap-1.5"
                  :class="
                    effectiveGovStatus === gKey
                      ? 'btn-primary shadow-xs'
                      : 'btn-ghost bg-base-100 border border-base-300'
                  "
                  @click="form.status = gKey"
                >
                  <span>{{ gMeta.icon }}</span>
                  <span class="truncate">{{ gMeta.label }}</span>
                </button>
              </div>
              <div v-else class="text-xs opacity-65">
                Current status: <b>{{ effectiveGovStatus ? GOV_META[effectiveGovStatus].label : 'Pending Review' }}</b> (Founder/Dev required to change)
              </div>
            </div>
          </div>

          <!-- ============================================================= -->
          <!-- TAB B: 🤝 AI ALLY & COLLECTIVE SKILLS                         -->
          <!-- ============================================================= -->
          <div v-show="drawerTab === 'copilot'" class="space-y-5">
            <!-- Auto-Detected Template & Surface Banner -->
            <div class="rounded-2xl border border-secondary/35 bg-secondary/5 p-4 space-y-2.5">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div class="space-y-0.5">
                  <div class="text-xs font-extrabold uppercase tracking-wider text-secondary flex items-center gap-1.5">
                    <Icon icon="solar:stars-bold-duotone" class="w-4 h-4" />
                    <span>✨ AI Ally Auto-Matched Template &amp; Surface from Your Description</span>
                  </div>
                  <div class="text-xs sm:text-sm font-black text-base-content">
                    Template: {{ detectedRecommendation.recommendedPresetTitle }} → {{ DEST_META[form.destination || detectedRecommendation.recommendedDestination].icon }} {{ DEST_META[form.destination || detectedRecommendation.recommendedDestination].label }}
                  </div>
                </div>

                <button
                  type="button"
                  class="btn btn-xs btn-secondary rounded-lg font-bold gap-1 self-start sm:self-center"
                  @click="applyRecommendedSetup"
                >
                  <Icon icon="solar:bolt-bold" class="w-3.5 h-3.5" />
                  <span>Apply Recommended Setup</span>
                </button>
              </div>

              <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span class="text-[11px] font-bold opacity-70">Switch Target Chat:</span>
                <button
                  v-for="(meta, key) in DEST_META"
                  :key="key"
                  type="button"
                  :disabled="isCardLocked"
                  class="btn btn-xs rounded-lg font-bold gap-1"
                  :class="form.destination === key ? 'btn-primary' : 'btn-ghost bg-base-100 border border-base-300'"
                  @click="form.destination = key"
                >
                  <span>{{ meta.icon }}</span>
                  <span>{{ meta.label }}</span>
                </button>
              </div>
            </div>

            <!-- 5 Locked Master Templates Bar (With Auto-Matched Highlight) -->
            <div class="bg-base-200/50 rounded-2xl p-4 border border-base-300 space-y-2.5">
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <span>🔒 Locked Co-op Master Templates</span>
                </span>
                <span class="text-[10px] opacity-60">Tap any template to load into AI Ally (never overwrites master)</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  v-for="preset in presets"
                  :key="preset.id"
                  type="button"
                  class="p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2.5"
                  :class="
                    detectedRecommendation.recommendedPresetId === preset.id
                      ? 'border-secondary bg-secondary/10 shadow-2xs'
                      : 'border-base-300 bg-base-100 hover:border-primary/50'
                  "
                  @click="applyPresetInDrawer(preset)"
                >
                  <div class="flex items-center gap-2.5 min-w-0">
                    <span class="text-lg leading-none shrink-0">{{ preset.icon }}</span>
                    <div class="min-w-0">
                      <div class="text-xs font-black truncate">{{ preset.title }}</div>
                      <div class="text-[10px] opacity-65 truncate">
                        🔒 Master • {{ DEST_META[preset.destination].icon }} {{ DEST_META[preset.destination].label }}
                      </div>
                    </div>
                  </div>
                  <span
                    v-if="detectedRecommendation.recommendedPresetId === preset.id"
                    class="badge badge-secondary badge-xs font-bold shrink-0"
                  >
                    ✨ Best Fit
                  </span>
                </button>
              </div>
            </div>

            <!-- Skill Bundles Selector -->
            <div class="bg-base-200/50 rounded-2xl p-4 border border-base-300 space-y-2.5">
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-extrabold uppercase tracking-wider text-base-content/75">
                  Resale Command Skill Bundles
                </span>
                <button
                  v-if="selectedBundles.length > 0"
                  type="button"
                  class="link link-primary text-[11px] font-bold"
                  @click="selectedBundles = [...detectedRecommendation.recommendedBundles]"
                >
                  Reset to ✨ Auto-Matched Bundles
                </button>
                <span v-else class="badge badge-primary badge-xs font-bold">✨ Auto-Matching by Keyword</span>
              </div>

              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="b in specialistBundles"
                  :key="b.id"
                  type="button"
                  class="btn btn-xs rounded-xl font-bold h-7 px-2.5"
                  :class="
                    selectedBundles.includes(b.id)
                      ? 'btn-secondary'
                      : 'btn-ghost bg-base-100 border border-base-300'
                  "
                  @click="toggleBundle(b.id)"
                >
                  {{ b.label }}
                </button>
              </div>
            </div>

            <!-- AI Ally Goal / Instruction Box (Auto-Fed from Issue Description!) -->
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <label class="text-xs font-extrabold uppercase tracking-wider text-base-content/75 block">
                  What Should Your 🤝 AI Ally Build or Refine for This Card? (Auto-Fed from Issue Description)
                </label>
                <button
                  type="button"
                  class="btn btn-xs btn-ghost border border-base-300 rounded-lg font-bold gap-1"
                  @click="syncGoalFromCard(true)"
                >
                  <Icon icon="solar:refresh-bold" class="w-3.5 h-3.5" />
                  <span>🔄 Pull Latest Issue Description</span>
                </button>
              </div>

              <textarea
                v-model="coPilotGoal"
                rows="5"
                :disabled="isCardLocked"
                class="textarea textarea-bordered w-full text-xs sm:text-sm rounded-xl leading-relaxed font-mono bg-base-200/30 disabled:opacity-75"
                placeholder="Describe what you want your AI Ally to generate or how to improve this card..."
                @input="goalManuallyEdited = true"
              ></textarea>

              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  class="btn btn-primary btn-sm rounded-xl font-black gap-1.5 shadow-sm"
                  :disabled="!coPilotGoal.trim() || making || isCardLocked"
                  @click="runCoPilot(false)"
                >
                  <span v-if="making" class="loading loading-spinner loading-xs"></span>
                  <Icon v-else icon="solar:users-group-two-rounded-bold" class="w-4 h-4" />
                  <span>
                    {{
                      making
                        ? 'AI Ally Drafting & Saving…'
                        : `✨ Draft ${DEST_META[form.destination || detectedRecommendation.recommendedDestination].label} Prompt with AI Ally`
                    }}
                  </span>
                </button>

                <button
                  v-if="form.kind === 'report'"
                  type="button"
                  class="btn btn-secondary btn-sm rounded-xl font-black gap-1.5"
                  :disabled="making || isCardLocked"
                  @click="runReportAuditAndFix"
                >
                  <Icon icon="solar:shield-check-bold" class="w-4 h-4" />
                  <span>🛡️ Run Anti-Bias Audit &amp; Draft Antigravity IDE Fix</span>
                </button>
              </div>

              <div v-if="coPilotError" class="alert alert-error text-xs rounded-xl py-2 px-3">
                {{ coPilotError }}
              </div>
            </div>

            <!-- 🧭 WHERE TO PASTE + GENERATED PROMPT PREVIEW RIGHT INSIDE AI ALLY TAB -->
            <div
              v-if="form.draftedFixPrompt || form.coPilotNotes"
              class="rounded-2xl border border-primary/40 bg-primary/5 p-4 space-y-3"
            >
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div class="text-xs font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Icon icon="solar:compass-big-bold-duotone" class="w-4 h-4" />
                    <span>{{ activeRoutingGuide.whereToPasteLabel }}</span>
                  </div>
                  <div class="text-[11px] font-mono font-bold text-secondary mt-0.5">
                    {{ activeRoutingGuide.modelPickerBadge }}
                  </div>
                </div>

                <button
                  type="button"
                  class="btn btn-xs sm:btn-sm btn-primary rounded-xl font-black gap-1.5 self-start sm:self-center"
                  @click="emit('copy', form.draftedFixPrompt || form.body)"
                >
                  <Icon icon="solar:copy-bold" class="w-4 h-4" />
                  <span>📋 Copy Prompt to Paste</span>
                </button>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div
                  v-for="step in activeRoutingGuide.handoffSteps"
                  :key="step"
                  class="p-2 rounded-xl bg-base-100 border border-base-200 text-[11px] font-semibold leading-snug"
                >
                  {{ step }}
                </div>
              </div>

              <textarea
                v-if="form.draftedFixPrompt"
                v-model="form.draftedFixPrompt"
                rows="7"
                :disabled="isCardLocked"
                class="textarea textarea-bordered w-full font-mono text-xs leading-relaxed rounded-xl bg-base-100 disabled:opacity-75"
              ></textarea>
            </div>

            <!-- AI Ally Strategy Note & Follow-Up Question Chips -->
            <div
              v-if="form.coPilotNotes || (form.followUpQuestions && form.followUpQuestions.length)"
              class="p-4 rounded-2xl bg-base-200/60 border border-base-300 space-y-3"
            >
              <p v-if="form.coPilotNotes" class="text-xs text-base-content/85 bg-primary/10 border border-primary/25 rounded-xl p-3">
                <b class="text-primary">🤝 AI Ally Routing &amp; Strategy Note:</b> {{ form.coPilotNotes }}
              </p>

              <div v-if="form.followUpQuestions?.length" class="space-y-2">
                <div class="text-xs font-extrabold uppercase tracking-wider text-secondary">
                  Tap Answer Chips Below to Refine Conversationally with Your AI Ally
                </div>
                <div
                  v-for="(q, qi) in form.followUpQuestions"
                  :key="qi"
                  class="p-3 rounded-xl bg-base-100 border border-base-200 space-y-1.5"
                >
                  <div class="text-xs font-bold">{{ qi + 1 }}. {{ q.question }}</div>
                  <div class="flex flex-wrap gap-1.5">
                    <button
                      v-for="chip in q.chips"
                      :key="chip"
                      type="button"
                      :disabled="isCardLocked"
                      class="btn btn-xs btn-outline border-base-300 hover:border-secondary hover:bg-secondary/10 rounded-lg font-semibold"
                      @click="appendRefinementChip(q.question, chip)"
                    >
                      + {{ chip }}
                    </button>
                  </div>
                </div>
              </div>

              <div class="flex flex-col sm:flex-row gap-2 pt-1">
                <textarea
                  v-model="refinementInput"
                  rows="2"
                  :disabled="isCardLocked"
                  class="textarea textarea-bordered flex-1 text-xs rounded-xl bg-base-100"
                  placeholder="Tap chips above or type a tweak, then click 🔄 Refine & Save..."
                ></textarea>
                <button
                  type="button"
                  class="btn btn-secondary rounded-xl font-black gap-1.5 sm:self-stretch px-4"
                  :disabled="!refinementInput.trim() || making || isCardLocked"
                  @click="runCoPilot(true)"
                >
                  <Icon icon="solar:refresh-circle-bold" class="w-4 h-4" />
                  <span>{{ making ? 'Refining…' : '🔄 Refine & Save' }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- ============================================================= -->
          <!-- TAB C: ANTI-BIAS & OPS COST AUDIT                             -->
          <!-- ============================================================= -->
          <div v-show="drawerTab === 'audit'" class="space-y-5">
            <!-- DaisyUI Stats Bar for Ops Cost & Token Impact -->
            <div class="stats stats-vertical sm:stats-horizontal shadow-xs w-full bg-base-200/70 border border-base-300 text-xs">
              <div class="stat px-4 py-3">
                <div class="stat-title text-[10px] font-bold uppercase opacity-60">Prompt Size</div>
                <div class="stat-value text-base sm:text-lg font-mono text-primary">+{{ opsImpact.addedTokens }} tok</div>
                <div class="stat-desc text-[10px]">{{ activeAuditText.length }} characters</div>
              </div>
              <div class="stat px-4 py-3">
                <div class="stat-title text-[10px] font-bold uppercase opacity-60">Cost / 1,000 Scans</div>
                <div class="stat-value text-base sm:text-lg font-mono text-success">${{ opsImpact.costPer1kScansUsd.toFixed(4) }}</div>
                <div class="stat-desc text-[10px]">Gemini Flash input rate</div>
              </div>
              <div class="stat px-4 py-3">
                <div class="stat-title text-[10px] font-bold uppercase opacity-60">$40/mo Credit Impact</div>
                <div class="stat-value text-base sm:text-lg font-mono text-info">{{ opsImpact.pctOfMonthlyCredit.toFixed(3) }}%</div>
                <div class="stat-desc text-[10px]">At ~1,500 scans / month</div>
              </div>
              <div class="stat px-4 py-3">
                <div class="stat-title text-[10px] font-bold uppercase opacity-60">Prompt-Bloat Rating</div>
                <div class="stat-value text-sm sm:text-base font-black">
                  <span class="badge badge-sm font-black" :class="bloatBadge.badge">
                    {{ bloatBadge.icon }} {{ opsImpact.bloatRating.toUpperCase() }}
                  </span>
                </div>
                <div class="stat-desc text-[10px] truncate">{{ opsImpact.recommendation }}</div>
              </div>
            </div>

            <!-- 3-Point Anti-Bias & Overfitting Audit Box -->
            <div class="bg-base-200/50 rounded-2xl p-4 border border-base-300 space-y-3">
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h4 class="text-xs font-extrabold uppercase tracking-wider text-warning flex items-center gap-1.5">
                    <Icon icon="solar:shield-warning-bold-duotone" class="w-4 h-4" />
                    <span>🛡️ 3-Point Anti-Bias &amp; Generalization Audit</span>
                  </h4>
                  <p class="text-[11px] opacity-65">
                    Checks for (1) One-Item Overfitting, (2) Seller Optimism vs. MSRP Bias, and (3) Missing Photo Evidence vs. AI Logic Bug.
                  </p>
                </div>

                <button
                  type="button"
                  class="btn btn-xs sm:btn-sm btn-warning rounded-xl font-black gap-1.5"
                  :disabled="making || isCardLocked"
                  @click="runReportAuditAndFix"
                >
                  <span v-if="making" class="loading loading-spinner loading-xs"></span>
                  <Icon v-else icon="solar:shield-check-bold" class="w-4 h-4" />
                  <span>{{ form.antiBiasAudit ? '🔄 Re-Run Bias Audit' : '✨ Run Anti-Bias Audit Now' }}</span>
                </button>
              </div>

              <textarea
                v-model="form.antiBiasAudit"
                rows="6"
                :disabled="isCardLocked"
                class="textarea textarea-bordered w-full text-xs leading-relaxed rounded-xl bg-base-100 disabled:opacity-75"
                placeholder="No Anti-Bias Audit recorded on this card yet. Click '✨ Run Anti-Bias Audit Now' above to analyze this card and save the audit result."
              ></textarea>
            </div>
          </div>
        </div>

        <!-- 4. PINNED DRAWER FOOTER (Canonical BottomActionDock placement="container") -->
        <BottomActionDock placement="container" :teleport="false">
          <template #left>
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                class="btn btn-xs sm:btn-sm btn-secondary rounded-xl font-black gap-1.5"
                @click="switchTab(drawerTab === 'copilot' ? 'edit' : 'copilot')"
              >
                <Icon icon="solar:users-group-two-rounded-bold" class="w-4 h-4" />
                <span>{{ drawerTab === 'copilot' ? '✏️ Back to Editor' : '🤝 AI Ally' }}</span>
              </button>

              <button
                v-if="canDelete && !isCardLocked && !form.isMasterTemplate"
                type="button"
                class="btn btn-xs sm:btn-sm btn-ghost text-error hover:bg-error/10 rounded-xl font-bold gap-1"
                @click="emit('delete', form.id)"
              >
                <Icon icon="solar:trash-bin-trash-bold-duotone" class="w-4 h-4" />
                <span class="hidden sm:inline">Delete</span>
              </button>
            </div>
          </template>

          <template #right>
            <div class="flex items-center gap-2">
              <button
                v-if="isCardLocked"
                type="button"
                class="btn btn-sm btn-primary rounded-xl font-black gap-1.5 px-4 shadow-md"
                @click="cloneCurrentCardToEditable"
              >
                <span>🌱 Clone as New Editable Card</span>
              </button>

              <template v-else>
                <button
                  type="button"
                  class="btn btn-xs sm:btn-sm btn-outline border-base-300 rounded-xl font-bold"
                  @click="toggleDoneAndSave"
                >
                  {{ form.done ? '↩️ Reopen Card' : '✅ Mark Done' }}
                </button>

                <button
                  type="button"
                  class="btn btn-xs sm:btn-sm btn-ghost rounded-xl font-semibold"
                  @click="emit('close')"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  class="btn btn-sm btn-primary rounded-xl font-black gap-1.5 px-5 shadow-md"
                  :disabled="!form.body.trim() || saving"
                  @click="saveCard"
                >
                  <Icon icon="solar:diskette-bold" class="w-4 h-4" />
                  <span>{{ saving ? 'Saving…' : 'Save Card' }}</span>
                </button>
              </template>
            </div>
          </template>
        </BottomActionDock>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Icon } from '@iconify/vue';
import BottomActionDock from '../common/BottomActionDock.vue';
import { addToast } from '../../stores/toast';
import {
  VAULT_KIND_META,
  GOVERNANCE_META,
  DESTINATION_META,
  BLOAT_BADGE,
  newVaultNoteId,
  effectiveStatus,
  estimatePromptOpsImpact,
  parseItemContextSummary,
  buildCoPilotBriefFromNote,
  recommendVaultTemplateAndSurface,
  type PlaybookPresetItem,
  type VaultNote,
  type VaultNoteKind,
} from '../../lib/founderVault';

export type { PlaybookPresetItem };

const props = defineProps<{
  isOpen: boolean;
  note: VaultNote | null;
  initialTab?: 'edit' | 'copilot' | 'audit';
  isFounder: boolean;
  canDelete: boolean;
  saving?: boolean;
  presets: PlaybookPresetItem[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', updated: VaultNote): void;
  (e: 'delete', id: string): void;
  (e: 'copy', text: string): void;
  (e: 'upvote', id: string): void;
}>();

const KIND_META = VAULT_KIND_META;
const GOV_META = GOVERNANCE_META;
const DEST_META = DESTINATION_META;

const specialistBundles = [
  { id: 'rc-1-scout-vision', label: '🔍 1. Scout & Valuation' },
  { id: 'rc-2-inventory-splitter', label: '📦 2. Lots & Playbooks' },
  { id: 'rc-3-booth-drops', label: '🏷️ 3. Booth & Labels' },
  { id: 'rc-4-sales-coop', label: '🤝 4. Sales & Co-op' },
  { id: 'rc-5-social-studio', label: '📱 5. Social & Mobile UX' },
];

const drawerTab = ref<'edit' | 'copilot' | 'audit'>('edit');
const selectedBundles = ref<string[]>([]);
const coPilotGoal = ref('');
const goalManuallyEdited = ref(false);
const refinementInput = ref('');
const making = ref(false);
const coPilotError = ref('');
const founderUnlockedSession = ref(false);
const showUnlockConfirm = ref(false);

const emptyForm = (): VaultNote => ({
  id: '',
  kind: 'prompt',
  title: '',
  body: '',
  destination: 'antigravity_ide',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const form = ref<VaultNote>(emptyForm());

const isCardLocked = computed(
  () => Boolean(form.value.isLocked || form.value.isMasterTemplate) && !founderUnlockedSession.value
);

const detectedRecommendation = computed(() => recommendVaultTemplateAndSurface(form.value));
const activeRoutingGuide = computed(() =>
  recommendVaultTemplateAndSurface(form.value, form.value.destination)
);

function confirmFounderUnlock() {
  if (!props.isFounder) return;
  founderUnlockedSession.value = true;
  showUnlockConfirm.value = false;
  addToast('Founder Governance Override unlocked for this session.', 'info');
}

function reLockCard() {
  founderUnlockedSession.value = false;
  showUnlockConfirm.value = false;
  form.value.isLocked = true;
  addToast('Card re-locked under Co-op Governance.', 'success');
}

function toggleFounderLock() {
  if (!props.isFounder) return;
  form.value.isLocked = !form.value.isLocked;
  if (form.value.isLocked) {
    founderUnlockedSession.value = false;
  }
}

function cloneCurrentCardToEditable() {
  const now = new Date().toISOString();
  form.value = {
    ...form.value,
    id: newVaultNoteId(),
    title: `${form.value.title.replace(/\s*\(Custom Copy\)$/i, '')} (Custom Copy)`,
    isLocked: false,
    isMasterTemplate: false,
    createdAt: now,
    updatedAt: now,
  };
  founderUnlockedSession.value = false;
  showUnlockConfirm.value = false;
  addToast('Cloned into a new editable card — master template remains locked!', 'success');
}

function syncGoalFromCard(force = false) {
  if (!force && goalManuallyEdited.value && coPilotGoal.value.trim()) return;
  coPilotGoal.value = buildCoPilotBriefFromNote(form.value);
  goalManuallyEdited.value = false;
}

function handleBodyEdited() {
  if (!goalManuallyEdited.value) {
    coPilotGoal.value = buildCoPilotBriefFromNote(form.value);
  }
}

function switchTab(nextTab: 'edit' | 'copilot' | 'audit') {
  if (nextTab === 'copilot') {
    syncGoalFromCard(false);
  }
  drawerTab.value = nextTab;
}

function sendDescriptionToCoPilot() {
  syncGoalFromCard(true);
  applyRecommendedSetup();
  drawerTab.value = 'copilot';
}

function applyRecommendedSetup() {
  const rec = detectedRecommendation.value;
  form.value.destination = rec.recommendedDestination;
  selectedBundles.value = [...rec.recommendedBundles];
  syncGoalFromCard(true);
}

watch(
  () => [props.isOpen, props.note, props.initialTab] as const,
  ([open, incoming, tab]) => {
    if (!open) return;
    drawerTab.value = tab || 'edit';
    coPilotError.value = '';
    refinementInput.value = '';
    goalManuallyEdited.value = false;
    founderUnlockedSession.value = false;
    showUnlockConfirm.value = false;
    if (incoming) {
      const rec = recommendVaultTemplateAndSurface(incoming);
      form.value = {
        ...incoming,
        destination: incoming.destination || rec.recommendedDestination,
        upvotedBy: [...(incoming.upvotedBy || [])],
        followUpQuestions: incoming.followUpQuestions ? [...incoming.followUpQuestions] : undefined,
        bundlesUsed: incoming.bundlesUsed ? [...incoming.bundlesUsed] : undefined,
      };
      selectedBundles.value =
        incoming.bundlesUsed && incoming.bundlesUsed.length
          ? [...incoming.bundlesUsed]
          : [...rec.recommendedBundles];
      coPilotGoal.value = buildCoPilotBriefFromNote(form.value);
    } else {
      form.value = emptyForm();
      selectedBundles.value = [];
      coPilotGoal.value = '';
    }
  },
  { immediate: true }
);

const effectiveGovStatus = computed(() => effectiveStatus(form.value));
const parsedContext = computed(() => parseItemContextSummary(form.value.itemContext));
const activeAuditText = computed(() => form.value.draftedFixPrompt || form.value.body || '');
const opsImpact = computed(() => estimatePromptOpsImpact(activeAuditText.value));
const bloatBadge = computed(() => BLOAT_BADGE[opsImpact.value.bloatRating]);

function kindBadgeClass(k: VaultNoteKind): string {
  if (k === 'report') return 'badge-warning';
  if (k === 'prompt') return 'badge-primary';
  if (k === 'spec') return 'badge-secondary';
  return 'badge-accent';
}

function toggleBundle(id: string) {
  selectedBundles.value = selectedBundles.value.includes(id)
    ? selectedBundles.value.filter((b) => b !== id)
    : [...selectedBundles.value, id];
}

function applyPresetInDrawer(preset: PlaybookPresetItem) {
  if (isCardLocked.value) {
    cloneCurrentCardToEditable();
  }
  form.value.destination = preset.destination;
  if (!form.value.title.trim()) {
    form.value.title = `${preset.icon} ${preset.title} (Custom Copy)`;
  }
  selectedBundles.value = [...preset.bundles];
  const existingDescription = form.value.body.trim();
  if (existingDescription) {
    coPilotGoal.value = `${preset.defaultGoal}\n\nCard Title: ${form.value.title}\nUser Issue / Context:\n${existingDescription}`;
  } else {
    coPilotGoal.value = preset.defaultGoal;
    form.value.body = preset.masterPromptBody;
  }
  goalManuallyEdited.value = true;
}

function appendRefinementChip(question: string, chip: string) {
  refinementInput.value = `${refinementInput.value ? refinementInput.value + '\n' : ''}${question} → ${chip}`;
}

async function runCoPilot(isRefine = false) {
  if (isCardLocked.value) return;
  making.value = true;
  coPilotError.value = '';
  try {
    const res = await fetch('/api/generate-vault-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idea: coPilotGoal.value || buildCoPilotBriefFromNote(form.value),
        cardTitle: form.value.title,
        issueDescription: form.value.body,
        kind: form.value.kind,
        surface: form.value.surface,
        issueType: form.value.issueType,
        rootCause: form.value.rootCause,
        destination: form.value.destination || detectedRecommendation.value.recommendedDestination,
        bundleIds: selectedBundles.value,
        reportContext: form.value.itemContext || '',
        currentDraft: isRefine ? form.value.draftedFixPrompt || form.value.body : undefined,
        userRefinement: isRefine ? refinementInput.value : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Generation failed');

    if (form.value.kind === 'report') {
      form.value.draftedFixPrompt = data.promptText;
    } else {
      form.value.body = data.promptText;
      if (!form.value.title.trim() || isRefine === false) {
        form.value.title = data.title || form.value.title;
      }
    }
    if (data.antiBiasAudit) form.value.antiBiasAudit = data.antiBiasAudit;
    form.value.coPilotNotes = data.coPilotNotes || '';
    form.value.followUpQuestions = data.followUpQuestions || [];
    form.value.bundlesUsed = data.bundlesUsed || [];
    if (data.routingGuide) {
      form.value.routingGuide = data.routingGuide;
    }
    form.value.updatedAt = new Date().toISOString();
    if (isRefine) refinementInput.value = '';

    emit('save', { ...form.value });
    addToast('AI Ally drafted & saved prompt to card!', 'success');
  } catch (err: any) {
    coPilotError.value = err?.message || 'Generation failed';
  } finally {
    making.value = false;
  }
}

async function runReportAuditAndFix() {
  if (isCardLocked.value) return;
  form.value.destination = 'antigravity_ide';
  syncGoalFromCard(true);
  await runCoPilot(false);
}

function saveCard() {
  if (isCardLocked.value) return;
  if (!form.value.title.trim()) {
    form.value.title = form.value.body.trim().split('\n')[0].slice(0, 60) || 'Untitled Vault Card';
  }
  form.value.routingGuide = activeRoutingGuide.value;
  form.value.updatedAt = new Date().toISOString();
  emit('save', { ...form.value });
}

function toggleDoneAndSave() {
  if (isCardLocked.value) return;
  form.value.done = !form.value.done;
  saveCard();
}
</script>
