<template>
  <div class="space-y-6">
    <!-- 1. TOP HEADER & PRIMARY ACTIONS (Canonical Co-op Ledger Archetype) -->
    <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
      <div>
        <div class="flex items-center gap-2 flex-wrap mb-1.5">
          <span class="badge badge-primary font-black text-xs px-2.5 py-1">
            6 Bundled Repo Skills
          </span>
          <span class="badge badge-outline font-mono text-xs">
            🛡️ 3-Point Anti-Bias Guard
          </span>
          <span
            class="badge font-bold text-xs gap-1"
            :class="synced ? 'badge-success' : 'badge-warning'"
          >
            <span>{{ synced ? '☁️ Cloud Synced' : '📱 Device Only' }}</span>
          </span>
          <span class="badge badge-neutral font-bold text-xs">
            {{ isFounder ? '👑 Founder / Dev Vetting' : '👀 Member View' }}
          </span>
        </div>

        <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-base-content flex items-center gap-2.5">
          <Icon icon="solar:magic-stick-3-bold-duotone" class="w-7 h-7 sm:w-8 sm:h-8 text-primary shrink-0" />
          <span>AI Prompt Studio &amp; Governed Learning Vault</span>
        </h1>
        <p class="text-xs sm:text-sm text-base-content/60 font-medium mt-1 max-w-3xl leading-relaxed">
          Build deal-hunting, QA, and IDE prompts grounded in our collective skills, capture voice ideas on the go, and vet community AI reports before testing on <code class="font-mono text-xs">alpha-1</code>.
        </p>
      </div>

      <div class="flex items-center gap-2 w-full sm:w-auto flex-wrap justify-end">
        <AiFeedbackButton surface="quick_scout" @submitted="refreshVault" />
        <button
          type="button"
          class="btn btn-sm btn-outline gap-1.5 rounded-xl font-bold h-10"
          @click="showGuide = !showGuide"
        >
          <Icon icon="solar:question-circle-bold-duotone" class="w-4 h-4 text-primary shrink-0" />
          <span>{{ showGuide ? 'Hide Guide' : 'How It Works' }}</span>
        </button>

        <button
          type="button"
          class="btn btn-sm btn-primary gap-1.5 rounded-xl font-black shadow-md shadow-primary/20 h-10 px-4"
          @click="openQuickNoteModal('idea')"
        >
          <Icon icon="solar:add-circle-bold" class="w-4 h-4 shrink-0" />
          <span>+ Quick Note / Voice Idea</span>
        </button>
      </div>
    </div>

    <!-- Collapsible How-It-Works Guide Card -->
    <div
      v-if="showGuide"
      class="card bg-base-100 border border-primary/30 shadow-sm rounded-2xl p-4 sm:p-5 space-y-4 animate-in fade-in duration-150"
    >
      <div class="flex items-center justify-between gap-2">
        <div class="text-xs font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5">
          <Icon icon="solar:book-bookmark-bold-duotone" class="w-4 h-4" />
          <span>Field Guide: Using the Prompt Co-Pilot, Phone Workflow &amp; AI Governance</span>
        </div>
        <button type="button" class="btn btn-ghost btn-xs btn-circle" @click="showGuide = false">✕</button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div class="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5">
          <div class="font-black text-primary flex items-center gap-1.5">
            <span>🪄 1. Deal-Hunter &amp; QA Prompt Co-Pilot</span>
          </div>
          <p class="text-base-content/80 leading-relaxed text-[11px]">
            Tap a starter card (like <b>Auction Sweeper</b> or <b>FBMP Negotiation Coach</b>) or dictate a custom goal. Pick where you'll paste it (<b>Phone Gemini App</b>, <b>Chrome Sidebar</b>, <b>AI Studio</b>, or <b>Antigravity IDE</b>), then tap the Co-Pilot's follow-up chips to refine.
          </p>
        </div>

        <div class="p-3.5 rounded-xl bg-secondary/5 border border-secondary/20 space-y-1.5">
          <div class="font-black text-secondary flex items-center gap-1.5">
            <span>📱 2. Phone-to-PC Sync Workflow</span>
          </div>
          <p class="text-base-content/80 leading-relaxed text-[11px]">
            Everything saved here syncs to Appwrite Cloud. Dictate ideas or save specs from your phone while out scouting; when you sit down at your PC, tell Antigravity: <i>"Read my latest Vault notes and build the top spec on alpha-1."</i>
          </p>
        </div>

        <div class="p-3.5 rounded-xl bg-warning/10 border border-warning/30 space-y-1.5">
          <div class="font-black text-warning flex items-center gap-1.5">
            <span>🛡️ 3. Governed AI Reports &amp; Bias Guard</span>
          </div>
          <p class="text-base-content/80 leading-relaxed text-[11px]">
            Community <b>🚩 Report AI Issue</b> flags land in the Review Queue as <b>🟡 Pending Review</b> and <b>never</b> alter live scans. A Founder/Developer runs the <b>3-Point Anti-Bias &amp; Ops Cost Audit</b> and tests fixes on <code class="font-mono">alpha-1</code> first.
          </p>
        </div>
      </div>
    </div>

    <!-- 2. 4 STANDALONE ICON-BADGE KPI CARDS -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <button
        type="button"
        class="bg-base-100 p-3.5 sm:p-5 rounded-2xl border border-base-200 hover:border-primary/40 shadow-sm flex items-center gap-3 sm:gap-4 text-left transition-all"
        @click="activeTab = 'vault'; vaultFilter = 'prompt'"
      >
        <div class="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
          <Icon icon="solar:magic-stick-3-bold-duotone" class="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <div class="min-w-0">
          <div class="text-[11px] uppercase font-bold opacity-60 truncate">Ready Prompts</div>
          <div class="text-lg sm:text-2xl font-black font-mono text-base-content truncate">{{ promptsCount }}</div>
          <div class="text-[10px] font-semibold opacity-50 truncate">Deal, QA &amp; IDE templates</div>
        </div>
      </button>

      <button
        type="button"
        class="bg-base-100 p-3.5 sm:p-5 rounded-2xl border border-base-200 hover:border-warning/50 shadow-sm flex items-center gap-3 sm:gap-4 text-left transition-all"
        @click="activeTab = 'reports'; reportFilter = 'pending_review'"
      >
        <div class="w-10 h-10 sm:w-12 sm:h-12 bg-warning/15 text-warning rounded-xl flex items-center justify-center shrink-0">
          <Icon icon="solar:flag-2-bold-duotone" class="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <div class="min-w-0">
          <div class="text-[11px] uppercase font-bold opacity-60 truncate">Pending AI Review</div>
          <div class="text-lg sm:text-2xl font-black font-mono text-warning truncate">{{ pendingReportsCount }}</div>
          <div class="text-[10px] font-semibold opacity-50 truncate">Awaiting Dev / Founder vet</div>
        </div>
      </button>

      <button
        type="button"
        class="bg-base-100 p-3.5 sm:p-5 rounded-2xl border border-base-200 hover:border-success/50 shadow-sm flex items-center gap-3 sm:gap-4 text-left transition-all"
        @click="activeTab = 'reports'; reportFilter = 'all'"
      >
        <div class="w-10 h-10 sm:w-12 sm:h-12 bg-success/10 text-success rounded-xl flex items-center justify-center shrink-0">
          <Icon icon="solar:shield-check-bold-duotone" class="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <div class="min-w-0">
          <div class="text-[11px] uppercase font-bold opacity-60 truncate">Vetted &amp; Shipped</div>
          <div class="text-lg sm:text-2xl font-black font-mono text-success truncate">{{ vettedAndShippedCount }}</div>
          <div class="text-[10px] font-semibold opacity-50 truncate">Bias-audited in Git</div>
        </div>
      </button>

      <button
        type="button"
        class="bg-base-100 p-3.5 sm:p-5 rounded-2xl border border-base-200 hover:border-info/50 shadow-sm flex items-center gap-3 sm:gap-4 text-left transition-all"
        @click="activeTab = 'studio'"
      >
        <div class="w-10 h-10 sm:w-12 sm:h-12 bg-info/10 text-info rounded-xl flex items-center justify-center shrink-0">
          <Icon icon="solar:cpu-bolt-bold-duotone" class="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <div class="min-w-0">
          <div class="text-[11px] uppercase font-bold opacity-60 truncate">Skill Library</div>
          <div class="text-lg sm:text-2xl font-black font-mono text-info truncate">6 Bundles</div>
          <div class="text-[10px] font-semibold opacity-50 truncate">$40/mo Cloud Credit Pool</div>
        </div>
      </button>
    </div>

    <!-- 3. SEGMENTED WORKSPACE TABS -->
    <div class="bg-base-100 border border-base-200 rounded-2xl p-1.5 shadow-sm flex flex-wrap gap-1.5">
      <button
        type="button"
        class="btn btn-sm flex-1 min-w-[170px] rounded-xl gap-2 font-black h-10"
        :class="activeTab === 'studio' ? 'btn-primary shadow-xs' : 'btn-ghost text-base-content/75'"
        @click="activeTab = 'studio'"
      >
        <Icon icon="solar:magic-stick-3-bold-duotone" class="w-4 h-4 shrink-0" />
        <span>1. Interactive Prompt Co-Pilot</span>
      </button>

      <button
        type="button"
        class="btn btn-sm flex-1 min-w-[170px] rounded-xl gap-2 font-black h-10"
        :class="activeTab === 'vault' ? 'btn-primary shadow-xs' : 'btn-ghost text-base-content/75'"
        @click="activeTab = 'vault'"
      >
        <Icon icon="solar:notebook-bold-duotone" class="w-4 h-4 shrink-0" />
        <span>2. Saved Prompts, Ideas &amp; Specs</span>
        <span class="badge badge-xs font-mono" :class="activeTab === 'vault' ? 'badge-neutral' : 'badge-ghost'">
          {{ nonReportNotesCount }}
        </span>
      </button>

      <button
        type="button"
        class="btn btn-sm flex-1 min-w-[170px] rounded-xl gap-2 font-black h-10"
        :class="activeTab === 'reports' ? 'btn-primary shadow-xs' : 'btn-ghost text-base-content/75'"
        @click="activeTab = 'reports'"
      >
        <Icon icon="solar:flag-2-bold-duotone" class="w-4 h-4 shrink-0" />
        <span>3. AI Review Queue (Governance)</span>
        <span
          class="badge badge-xs font-mono"
          :class="pendingReportsCount > 0 ? 'badge-warning' : 'badge-ghost'"
        >
          {{ reportsCount }}
        </span>
      </button>
    </div>

    <!-- =================================================================== -->
    <!-- TAB 1: INTERACTIVE PROMPT CO-PILOT STUDIO                           -->
    <!-- =================================================================== -->
    <div v-if="activeTab === 'studio'" class="space-y-5">
      <!-- 1-Tap Field Playbook & QA Starter Cards -->
      <div class="card bg-base-100 border border-base-200 shadow-sm rounded-2xl p-4 sm:p-5 space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div>
            <div class="text-xs font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Icon icon="solar:bolt-circle-bold-duotone" class="w-4 h-4" />
              <span>1-Tap Resale &amp; QA Playbook Starters (Or Write Your Own Below)</span>
            </div>
            <p class="text-[11px] text-base-content/60">
              Tap any card to load a pre-built prompt or customize it with the Co-Pilot for your current hunt.
            </p>
          </div>
          <span class="badge badge-ghost badge-xs font-mono">Uses 70/30 Waterfall + Booth Rules</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <div
            v-for="preset in PLAYBOOK_PRESETS"
            :key="preset.id"
            class="rounded-2xl border p-3.5 transition-all flex flex-col justify-between gap-3 bg-base-100 hover:border-primary/50 hover:shadow-sm"
            :class="activePresetId === preset.id ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-base-200'"
          >
            <div class="space-y-1.5">
              <div class="flex items-center justify-between gap-2">
                <span class="text-lg leading-none">{{ preset.icon }}</span>
                <span class="badge badge-ghost badge-xs font-semibold">
                  {{ DEST_META[preset.destination].icon }} {{ DEST_META[preset.destination].label }}
                </span>
              </div>
              <div class="text-xs sm:text-sm font-black text-base-content">{{ preset.title }}</div>
              <p class="text-[11px] text-base-content/70 leading-relaxed">{{ preset.summary }}</p>
            </div>

            <div class="flex items-center gap-1.5 pt-1 border-t border-base-200/70">
              <button
                type="button"
                class="btn btn-xs btn-primary flex-1 rounded-lg font-bold gap-1"
                @click="loadPresetInstant(preset)"
              >
                <Icon icon="solar:copy-bold" class="w-3.5 h-3.5" />
                <span>Load Ready Prompt</span>
              </button>
              <button
                type="button"
                class="btn btn-xs btn-ghost border border-base-300 rounded-lg font-bold"
                title="Customize with AI Co-Pilot"
                @click="customizePresetWithAi(preset)"
              >
                🪄 Customize
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 2-Column Studio Workspace -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <!-- Left Column: Builder Controls (5 cols on lg) -->
        <div class="lg:col-span-5 card bg-base-100 border border-base-200 shadow-sm rounded-2xl p-4 sm:p-5 space-y-4">
          <div class="flex items-center justify-between gap-2 border-b border-base-200 pb-3">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Icon icon="solar:tuning-square-2-bold-duotone" class="w-4 h-4" />
              </div>
              <div>
                <div class="text-sm font-black">Configure Prompt Target</div>
                <div class="text-[11px] opacity-60">Pick where you will run this prompt</div>
              </div>
            </div>
            <button
              v-if="makerIdea || draft"
              type="button"
              class="btn btn-ghost btn-xs rounded-lg"
              @click="resetStudio"
            >
              Reset
            </button>
          </div>

          <!-- Step A: Destination Cards -->
          <div class="space-y-2">
            <label class="text-xs font-extrabold uppercase tracking-wider text-base-content/70">
              1. Where Will You Paste This Prompt?
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                v-for="(meta, key) in DEST_META"
                :key="key"
                type="button"
                class="p-2.5 rounded-xl border text-left transition-all flex items-start gap-2.5"
                :class="
                  destination === key
                    ? 'border-primary bg-primary/10 text-base-content shadow-xs ring-1 ring-primary/30'
                    : 'border-base-300 bg-base-100 hover:bg-base-200/60'
                "
                @click="destination = key"
              >
                <span class="text-base leading-none mt-0.5 shrink-0">{{ meta.icon }}</span>
                <div class="min-w-0">
                  <div class="text-xs font-black truncate">{{ meta.label }}</div>
                  <div class="text-[10px] opacity-65 leading-snug">{{ DESTINATION_HINTS[key] }}</div>
                </div>
              </button>
            </div>
          </div>

          <!-- Step B: Skill Bundles -->
          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <label class="text-xs font-extrabold uppercase tracking-wider text-base-content/70">
                2. Resale Command Skills to Include
              </label>
              <button
                v-if="selectedBundles.length > 0"
                type="button"
                class="link link-primary text-[11px] font-bold"
                @click="selectedBundles = []"
              >
                Switch to ✨ Auto-Match
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
                    ? 'btn-secondary shadow-2xs'
                    : 'btn-ghost border border-base-300 text-base-content/80'
                "
                @click="toggleBundle(b.id)"
              >
                <span>{{ b.label }}</span>
              </button>
            </div>
            <p class="text-[10px] opacity-60">
              Core DNA (<code class="font-mono">hucks-resale-core</code>: 70/30 waterfall + booth vibes + 7 laws) is always included automatically.
            </p>
          </div>

          <!-- Step C: Goal / Idea Input -->
          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <label class="text-xs font-extrabold uppercase tracking-wider text-base-content/70">
                3. Your Goal or Deal-Hunting Scenario
              </label>
              <span class="text-[10px] opacity-60">🎙️ Phone mic friendly</span>
            </div>
            <textarea
              v-model="makerIdea"
              rows="4"
              class="textarea textarea-bordered w-full text-sm rounded-xl leading-relaxed"
              placeholder="Example: Help me scan a ShopGoodwill search page of vintage RPG books and tell me which 3 lots have an anchor book that recoups my bid, or help me negotiate a $120 FBMP goth jacket bundle down to $65 cash..."
              @input="draftReportContext = ''"
            ></textarea>
          </div>

          <button
            type="button"
            class="btn btn-primary w-full rounded-xl font-black gap-2 shadow-md shadow-primary/20 h-11"
            :disabled="!makerIdea.trim() || making"
            @click="runMaker(false)"
          >
            <Icon icon="solar:magic-stick-3-bold" class="w-5 h-5" />
            <span>{{ making ? 'Co-Pilot Is Drafting with Skills…' : '✨ Generate Prompt with Skills' }}</span>
          </button>

          <div
            v-if="makerError"
            class="alert alert-error text-xs rounded-xl py-2.5 px-3 font-semibold"
          >
            <span>{{ makerError }}</span>
          </div>
        </div>

        <!-- Right Column: Live Output Canvas, Ops Cost & Co-Pilot Refinement (7 cols on lg) -->
        <div class="lg:col-span-7 card bg-base-100 border border-base-200 shadow-sm rounded-2xl p-4 sm:p-5 space-y-4">
          <template v-if="draft">
            <!-- Output Header & Primary Copy/Save Actions -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-base-200 pb-3">
              <div class="min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap mb-1">
                  <span class="badge badge-primary badge-xs font-bold">
                    {{ DEST_META[destination].icon }} {{ DEST_META[destination].label }}
                  </span>
                  <span
                    v-for="bid in draft.bundlesUsed"
                    :key="bid"
                    class="badge badge-ghost badge-xs font-mono"
                  >
                    {{ bid }}
                  </span>
                </div>
                <h2 class="text-base sm:text-lg font-black text-base-content truncate">{{ draft.title }}</h2>
              </div>

              <div class="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  class="btn btn-sm btn-primary rounded-xl font-black gap-1.5 shadow-sm"
                  @click="copyText(draft.promptText)"
                >
                  <Icon icon="solar:copy-bold" class="w-4 h-4" />
                  <span>Copy Prompt</span>
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-outline rounded-xl font-bold gap-1.5"
                  @click="saveDraft"
                >
                  <Icon icon="solar:bookmark-square-minimalistic-bold-duotone" class="w-4 h-4" />
                  <span>Save to Vault</span>
                </button>
              </div>
            </div>

            <!-- Ops Token & Cost Impact Bar -->
            <div class="p-3 rounded-2xl bg-base-200/60 border border-base-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div class="flex items-center gap-2.5 flex-wrap">
                <span class="badge badge-sm font-black py-2.5 px-2.5" :class="bloat.badge">
                  {{ bloat.icon }} +{{ draft.opsImpact.addedTokens }} tokens
                </span>
                <span class="text-xs font-mono font-bold text-base-content">
                  ~${{ draft.opsImpact.costPer1kScansUsd.toFixed(4) }} / 1k scans
                </span>
                <span class="text-[11px] opacity-70 font-semibold">
                  ({{ draft.opsImpact.pctOfMonthlyCredit.toFixed(3) }}% of $40/mo Cloud Credit)
                </span>
              </div>
              <span class="text-[11px] font-semibold opacity-75">{{ draft.opsImpact.recommendation }}</span>
            </div>

            <!-- 3-Point Anti-Bias Audit Callout (When Present) -->
            <div
              v-if="draft.antiBiasAudit"
              class="p-3.5 rounded-2xl bg-warning/10 border border-warning/30 space-y-1 text-xs"
            >
              <div class="font-black text-warning flex items-center gap-1.5">
                <Icon icon="solar:shield-warning-bold-duotone" class="w-4 h-4" />
                <span>🛡️ 3-Point Anti-Bias &amp; Overfitting Audit</span>
              </div>
              <p class="text-base-content/85 whitespace-pre-wrap leading-relaxed">{{ draft.antiBiasAudit }}</p>
            </div>

            <!-- Editable / Copyable Prompt Canvas -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-[11px] font-bold opacity-65">
                <span>PROMPT CANVAS (YOU CAN EDIT DIRECTLY BEFORE COPYING OR SAVING)</span>
                <span class="font-mono">{{ draft.promptText.length }} chars</span>
              </div>
              <textarea
                v-model="draft.promptText"
                rows="11"
                class="textarea textarea-bordered w-full font-mono text-xs leading-relaxed rounded-2xl bg-base-200/40"
              ></textarea>
            </div>

            <p v-if="draft.coPilotNotes" class="text-xs text-base-content/75 bg-primary/5 border border-primary/20 rounded-xl p-3">
              <b class="text-primary">💬 Co-Pilot Strategy Note:</b> {{ draft.coPilotNotes }}
            </p>

            <!-- Interactive Co-Pilot Follow-Up Questions & Refinement Loop -->
            <div class="p-4 rounded-2xl bg-base-200/50 border border-base-300 space-y-3">
              <div class="flex items-center justify-between gap-2">
                <div class="text-xs font-extrabold uppercase tracking-wider text-secondary flex items-center gap-1.5">
                  <Icon icon="solar:chat-round-dots-bold-duotone" class="w-4 h-4" />
                  <span>Interactive Co-Pilot Refinement (Tap Chips or Reply to Dial It In)</span>
                </div>
                <span class="badge badge-secondary badge-xs font-bold">Conversational Loop</span>
              </div>

              <div v-if="draft.followUpQuestions?.length" class="space-y-2.5">
                <div
                  v-for="(q, qi) in draft.followUpQuestions"
                  :key="qi"
                  class="p-3 rounded-xl bg-base-100 border border-base-200 space-y-2"
                >
                  <div class="text-xs font-bold text-base-content">{{ qi + 1 }}. {{ q.question }}</div>
                  <div class="flex flex-wrap gap-1.5">
                    <button
                      v-for="chip in q.chips"
                      :key="chip"
                      type="button"
                      class="btn btn-xs btn-outline border-base-300 hover:border-secondary hover:bg-secondary/10 rounded-lg font-semibold"
                      @click="addRefinement(q.question, chip)"
                    >
                      + {{ chip }}
                    </button>
                  </div>
                </div>
              </div>

              <div class="flex flex-col sm:flex-row gap-2 pt-1">
                <textarea
                  v-model="refinement"
                  rows="2"
                  class="textarea textarea-bordered flex-1 text-xs rounded-xl"
                  placeholder="Tap answer chips above or type how you want to tweak this prompt (e.g., 'Add a $35 max bid cap and focus on Memory Den #0EJ TTRPG books')…"
                ></textarea>
                <button
                  type="button"
                  class="btn btn-secondary rounded-xl font-black gap-1.5 sm:self-stretch px-4"
                  :disabled="!refinement.trim() || making"
                  @click="runMaker(true)"
                >
                  <Icon icon="solar:refresh-circle-bold" class="w-4 h-4" />
                  <span>{{ making ? 'Refining…' : '🔄 Refine Draft' }}</span>
                </button>
              </div>
            </div>
          </template>

          <!-- Empty State When No Draft Is Loaded Yet -->
          <div v-else class="py-12 px-4 text-center space-y-3">
            <div class="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Icon icon="solar:magic-stick-3-bold-duotone" class="w-8 h-8" />
            </div>
            <div class="text-base font-black text-base-content">
              Ready to Build Your Next Deal-Hunting, QA, or IDE Prompt
            </div>
            <p class="text-xs text-base-content/60 max-w-md mx-auto leading-relaxed">
              Tap one of the <b>4 Playbook Starter Cards</b> above for an instant prompt, or describe your goal on the left and tap <b>✨ Generate Prompt with Skills</b>.
            </p>
            <div class="flex flex-wrap justify-center gap-2 pt-2">
              <button
                type="button"
                class="btn btn-xs btn-outline rounded-xl font-bold"
                @click="loadPresetInstant(PLAYBOOK_PRESETS[0])"
              >
                🔭 Load Auction Sweeper
              </button>
              <button
                type="button"
                class="btn btn-xs btn-outline rounded-xl font-bold"
                @click="loadPresetInstant(PLAYBOOK_PRESETS[1])"
              >
                🤝 Load FBMP Negotiation Coach
              </button>
              <button
                type="button"
                class="btn btn-xs btn-outline rounded-xl font-bold"
                @click="loadPresetInstant(PLAYBOOK_PRESETS[3])"
              >
                🧪 Load Sidebar QA Tester
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- =================================================================== -->
    <!-- TAB 2: SAVED PROMPTS, IDEAS & SPECS VAULT                           -->
    <!-- =================================================================== -->
    <div v-if="activeTab === 'vault'" class="space-y-4">
      <div class="card bg-base-100 border border-base-200 shadow-sm rounded-2xl p-3.5 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-1.5">
          <button
            v-for="f in VAULT_TAB_FILTERS"
            :key="f.key"
            type="button"
            class="btn btn-xs sm:btn-sm rounded-xl font-bold"
            :class="vaultFilter === f.key ? 'btn-primary shadow-2xs' : 'btn-ghost border border-base-300'"
            @click="vaultFilter = f.key"
          >
            <span>{{ f.label }}</span>
          </button>
        </div>

        <div class="flex items-center gap-2">
          <input
            v-model="searchQuery"
            type="text"
            class="input input-bordered input-sm rounded-xl w-full md:w-64 text-xs"
            placeholder="Search saved prompts, ideas, specs…"
          />
          <button
            type="button"
            class="btn btn-sm btn-primary rounded-xl font-bold shrink-0"
            @click="openQuickNoteModal('idea')"
          >
            + Add Note
          </button>
        </div>
      </div>

      <div v-if="loading" class="card bg-base-100 border border-base-200 rounded-2xl p-8 text-center text-sm opacity-60">
        Loading cloud vault…
      </div>
      <div
        v-else-if="!filteredVaultNotes.length"
        class="card bg-base-100 border border-base-200 rounded-2xl p-8 text-center space-y-2"
      >
        <div class="text-sm font-black">No notes match this filter yet</div>
        <p class="text-xs opacity-60">Tap "+ Add Note" or generate a prompt in the Studio tab.</p>
      </div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div
          v-for="note in filteredVaultNotes"
          :key="note.id"
          class="card bg-base-100 border border-base-200 hover:border-primary/40 shadow-sm rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3 transition-all"
          :class="note.done ? 'opacity-60' : ''"
        >
          <div class="space-y-2.5">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0 space-y-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="badge badge-xs font-bold" :class="note.kind === 'prompt' ? 'badge-primary' : note.kind === 'spec' ? 'badge-secondary' : 'badge-accent'">
                    {{ KIND_META[note.kind].icon }} {{ KIND_META[note.kind].label }}
                  </span>
                  <span v-if="note.destination" class="badge badge-ghost badge-xs font-semibold">
                    {{ DEST_META[note.destination].icon }} {{ DEST_META[note.destination].label }}
                  </span>
                  <span class="text-[10px] opacity-50 font-mono">
                    {{ new Date(note.updatedAt).toLocaleDateString() }}
                  </span>
                </div>
                <h3 class="text-sm sm:text-base font-black text-base-content leading-snug" :class="note.done ? 'line-through' : ''">
                  {{ note.title }}
                </h3>
              </div>

              <div class="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  class="btn btn-xs btn-primary rounded-lg font-bold gap-1"
                  @click="copyText(note.body)"
                >
                  <Icon icon="solar:copy-bold" class="w-3.5 h-3.5" />
                  <span>Copy</span>
                </button>
                <button
                  type="button"
                  class="btn btn-xs btn-ghost border border-base-300 rounded-lg font-semibold"
                  title="Open in Co-Pilot Studio to refine or convert"
                  @click="loadNoteIntoStudio(note)"
                >
                  🪄 Studio
                </button>
              </div>
            </div>

            <pre class="text-xs whitespace-pre-wrap break-words font-sans max-h-52 overflow-y-auto bg-base-200/50 border border-base-300/60 rounded-xl p-3 leading-relaxed">{{ note.body }}</pre>
          </div>

          <div class="flex items-center justify-between gap-2 pt-2 border-t border-base-200 text-xs">
            <span class="text-[11px] opacity-60 truncate">
              {{ note.author ? `Saved by ${note.author}` : 'Collective Vault' }}
            </span>
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                class="btn btn-xs btn-ghost border border-base-300 rounded-lg font-semibold"
                @click="toggleDone(note)"
              >
                {{ note.done ? '↩️ Reopen' : '✅ Mark Done' }}
              </button>
              <button
                v-if="canDelete(note)"
                type="button"
                class="btn btn-xs btn-ghost text-error rounded-lg"
                title="Delete note"
                @click="removeNote(note)"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- =================================================================== -->
    <!-- TAB 3: COMMUNITY AI REVIEW QUEUE (GOVERNANCE)                       -->
    <!-- =================================================================== -->
    <div v-if="activeTab === 'reports'" class="space-y-4">
      <!-- Governance & Anti-Bias Safeguard Banner -->
      <div class="card bg-base-100 border border-warning/40 shadow-sm rounded-2xl p-4 sm:p-5">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div class="space-y-1">
            <div class="text-xs font-extrabold uppercase tracking-wider text-warning flex items-center gap-1.5">
              <Icon icon="solar:shield-check-bold-duotone" class="w-4 h-4" />
              <span>Governed AI Vetting Pipeline (Zero Auto-Mutation of Live Scans)</span>
            </div>
            <p class="text-xs text-base-content/75 leading-relaxed max-w-3xl">
              Reports submitted via <b>🚩 Report AI Issue</b> in Quick Scout or Item Drawers are staged here in Appwrite. Members can <b>👍 Confirm (+1)</b> recurring issues. Only a <b>👑 Founder / Developer</b> can vet reports, run the <b>🛡️ 3-Point Anti-Bias Audit</b>, and test fixes on <code class="font-mono">alpha-1</code>.
            </p>
          </div>

          <div class="flex flex-wrap gap-1.5 shrink-0">
            <button
              v-for="rf in REPORT_TAB_FILTERS"
              :key="rf.key"
              type="button"
              class="btn btn-xs rounded-xl font-bold"
              :class="reportFilter === rf.key ? 'btn-neutral' : 'btn-ghost border border-base-300'"
              @click="reportFilter = rf.key"
            >
              {{ rf.label }}
            </button>
          </div>
        </div>
      </div>

      <div
        v-if="!filteredReportNotes.length"
        class="card bg-base-100 border border-base-200 rounded-2xl p-8 text-center space-y-2"
      >
        <div class="text-sm font-black">No AI reports in this status</div>
        <p class="text-xs opacity-60">
          Members can flag bad Quick Scout, Deep Scan, or Playbook outputs using the <b>🚩 Report AI Issue</b> button on any scan result or item drawer.
        </p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="note in filteredReportNotes"
          :key="note.id"
          class="card bg-base-100 border border-base-200 shadow-sm rounded-2xl p-4 sm:p-5 space-y-3"
        >
          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div class="space-y-1.5 min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span
                  v-if="statusOf(note)"
                  class="badge badge-sm font-bold"
                  :class="GOV[statusOf(note)!].badge"
                >
                  {{ GOV[statusOf(note)!].icon }} {{ GOV[statusOf(note)!].label }}
                </span>
                <span v-if="note.surface" class="badge badge-outline badge-xs font-bold">
                  {{ SURFACES[note.surface] }}
                </span>
                <span v-if="note.rootCause" class="badge badge-ghost badge-xs font-semibold">
                  {{ ROOT_CAUSES[note.rootCause] }}
                </span>
                <span class="text-[11px] opacity-55 font-mono">
                  {{ new Date(note.updatedAt).toLocaleString() }}
                  <template v-if="note.author"> · Reported by {{ note.author }}</template>
                </span>
              </div>
              <h3 class="text-sm sm:text-base font-black text-base-content">{{ note.title }}</h3>
            </div>

            <div class="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                class="btn btn-xs btn-outline rounded-xl font-bold gap-1"
                title="Confirm you have also seen this AI issue"
                @click="upvote(note)"
              >
                <span>👍 Confirm Issue</span>
                <span class="badge badge-xs badge-primary font-mono">{{ note.upvotedBy?.length || 0 }}</span>
              </button>
              <button
                type="button"
                class="btn btn-xs btn-ghost border border-base-300 rounded-xl font-semibold"
                @click="copyText(note.body)"
              >
                Copy
              </button>
              <button
                v-if="canDelete(note)"
                type="button"
                class="btn btn-xs btn-ghost text-error rounded-xl"
                @click="removeNote(note)"
              >
                ✕
              </button>
            </div>
          </div>

          <p class="text-xs sm:text-sm bg-base-200/50 border border-base-300/60 rounded-xl p-3 whitespace-pre-wrap leading-relaxed">
            {{ note.body }}
          </p>

          <details v-if="note.itemContext" class="text-xs bg-base-200/30 border border-base-200 rounded-xl p-2.5">
            <summary class="cursor-pointer font-bold text-base-content/75">
              📎 View Attached Item &amp; Scan Context
            </summary>
            <pre class="text-[11px] whitespace-pre-wrap break-words font-mono opacity-80 mt-2 max-h-40 overflow-y-auto">{{ note.itemContext }}</pre>
          </details>

          <!-- Founder / Developer Vetting Action Bar -->
          <div
            v-if="isFounder"
            class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-base-200"
          >
            <div class="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                class="btn btn-xs btn-secondary rounded-xl font-bold"
                @click="setStatus(note, 'vetted_for_dev')"
              >
                🟣 Approve / Vet for Dev
              </button>
              <button
                type="button"
                class="btn btn-xs btn-success rounded-xl font-bold"
                @click="setStatus(note, 'shipped')"
              >
                🟢 Mark Shipped in Git
              </button>
              <button
                type="button"
                class="btn btn-xs btn-ghost border border-base-300 rounded-xl font-semibold"
                @click="setStatus(note, 'rejected')"
              >
                ⚪ Archive / Photo Limit
              </button>
            </div>

            <button
              type="button"
              class="btn btn-xs sm:btn-sm btn-primary rounded-xl font-black gap-1.5"
              :disabled="making"
              @click="auditAndDraft(note)"
            >
              <Icon icon="solar:magic-stick-3-bold" class="w-4 h-4" />
              <span>✨ Run Anti-Bias Audit &amp; Draft IDE Fix</span>
            </button>
          </div>
          <div v-else class="text-[11px] opacity-60 pt-1 border-t border-base-200">
            🔒 Only a Founder / Developer can change governance status or promote rules to <code class="font-mono">alpha-1</code>.
          </div>
        </div>
      </div>
    </div>

    <!-- =================================================================== -->
    <!-- QUICK NOTE / VOICE IDEA MODAL                                       -->
    <!-- =================================================================== -->
    <Teleport to="body">
      <div
        v-if="showQuickNoteModal"
        class="fixed inset-0 z-500 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 animate-in fade-in duration-150"
        @click.self="showQuickNoteModal = false"
      >
        <form
          class="bg-base-100 border border-base-300 shadow-2xl w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-4 sm:p-6 space-y-4"
          @submit.prevent="addNote"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <h3 class="text-base sm:text-lg font-black">Save Quick Idea, Prompt or Spec</h3>
              <p class="text-xs opacity-65">Syncs straight to Appwrite Cloud across your phone and PC.</p>
            </div>
            <button type="button" class="btn btn-ghost btn-sm btn-circle" @click="showQuickNoteModal = false">✕</button>
          </div>

          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="(meta, k) in KIND_META"
              :key="k"
              type="button"
              class="btn btn-xs sm:btn-sm rounded-xl font-bold"
              :class="draftKind === k ? 'btn-primary' : 'btn-ghost border border-base-300'"
              @click="draftKind = k"
            >
              {{ meta.icon }} {{ meta.label }}
            </button>
          </div>

          <input
            v-model="draftTitle"
            class="input input-bordered w-full text-sm rounded-xl"
            placeholder="Short title (optional — auto-filled from first line)"
          />

          <textarea
            v-model="draftBody"
            class="textarea textarea-bordered w-full text-sm rounded-xl leading-relaxed"
            rows="5"
            placeholder="Type or tap your phone keyboard microphone to dictate…"
          ></textarea>

          <div class="flex items-center justify-end gap-2 pt-1">
            <button type="button" class="btn btn-sm btn-ghost rounded-xl font-bold" @click="showQuickNoteModal = false">
              Cancel
            </button>
            <button type="submit" class="btn btn-sm btn-primary rounded-xl font-black px-5" :disabled="!draftBody.trim()">
              💾 Save to Cloud Vault
            </button>
          </div>
        </form>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { useAuth } from '../../composables/useAuth';
import { addToast } from '../../stores/toast';
import AiFeedbackButton from '../common/AiFeedbackButton.vue';
import {
  loadVaultNotes,
  saveVaultNotes,
  newVaultNoteId,
  effectiveStatus,
  toggleUpvote,
  estimatePromptOpsImpact,
  STARTER_VAULT_NOTES,
  VAULT_KIND_META,
  GOVERNANCE_META,
  DESTINATION_META,
  AI_SURFACE_LABELS,
  AI_ROOT_CAUSE_LABELS,
  BLOAT_BADGE,
  type VaultNote,
  type VaultNoteKind,
  type VaultGovernanceStatus,
  type PromptTargetDestination,
  type PromptOpsImpact,
} from '../../lib/founderVault';
import {
  loadCoopGovernanceState,
  DEFAULT_COOP_POLICY_CONFIG,
  normalizePolicyConfig,
  canMemberEditGlobalFinancials,
  type CoopMemberProfile,
} from '../../lib/coopGovernance';

interface DraftResult {
  title: string;
  promptText: string;
  coPilotNotes: string;
  followUpQuestions: Array<{ question: string; chips: string[] }>;
  antiBiasAudit: string;
  bundlesUsed: string[];
  opsImpact: PromptOpsImpact;
}

interface PlaybookPreset {
  id: string;
  starterNoteId?: string;
  icon: string;
  title: string;
  summary: string;
  destination: PromptTargetDestination;
  bundles: string[];
  defaultGoal: string;
}

const KIND_META = VAULT_KIND_META;
const GOV = GOVERNANCE_META;
const DEST_META = DESTINATION_META;
const SURFACES = AI_SURFACE_LABELS;
const ROOT_CAUSES = AI_ROOT_CAUSE_LABELS;

const DESTINATION_HINTS: Record<PromptTargetDestination, string> = {
  gemini_app: 'Short phone bullets + cumulative Spec block',
  chrome_sidebar: 'Reads live browser tab DOM + 4-line report',
  ai_studio: 'System Instructions + structured test prompt',
  antigravity_ide: '1-shot surgical edit + ALLOWED FILES lock',
  product_spec: 'UX flow, Appwrite rules & test checklist',
};

const PLAYBOOK_PRESETS: PlaybookPreset[] = [
  {
    id: 'auction-sweeper',
    starterNoteId: 'starter-auction-sweeper',
    icon: '🔭',
    title: 'Whole-Page Auction Grid Sweeper',
    summary: 'Scans 24–50 ShopGoodwill, HiBid, or eBay search lots in Chrome Sidebar and ranks the Top 3–5 sleeper lots where 1 Anchor item recoups your bid.',
    destination: 'chrome_sidebar',
    bundles: ['rc-1-scout-vision', 'rc-2-inventory-splitter'],
    defaultGoal:
      'Scan this entire auction search results page and rank the top 3-5 sleeper lots worth clicking for our booths, factoring in shipping drag, buyer premium, and 1-anchor cost recovery.',
  },
  {
    id: 'fbmp-coach',
    starterNoteId: 'starter-fbmp-coach',
    icon: '🤝',
    title: 'FBMP / Local Deal & Negotiation Coach',
    summary: 'Builds an Opening Anchor -> Walk-Away Offer Ladder, 3 non-tip-off seller questions, and 3 copy-paste DM negotiation scripts.',
    destination: 'gemini_app',
    bundles: ['rc-1-scout-vision', 'rc-3-booth-drops'],
    defaultGoal:
      'Evaluate a Facebook Marketplace / Craigslist local pickup listing, give me an Opening Anchor to Walk-Away Offer Ladder, 3 non-tip-off inspection questions, and 3 copy-paste DM scripts.',
  },
  {
    id: 'estate-triage',
    icon: '🧭',
    title: 'Estate Table / Thrift Pile Triage',
    summary: 'Use your phone camera in Gemini App to scan a whole table or shelf of items, spot the highest-margin pieces, and suggest a bundle offer.',
    destination: 'gemini_app',
    bundles: ['rc-1-scout-vision', 'rc-2-inventory-splitter'],
    defaultGoal:
      'I am at an estate sale / flea market looking at a table of items. Help me spot the highest-margin pieces from my photo, flag any reprints/traps, and suggest a single cash bundle offer for the pile.',
  },
  {
    id: 'paired-qa',
    starterNoteId: 'starter-paired-qa-sidebar',
    icon: '🧪',
    title: 'Paired Human-AI Live Page QA Tester',
    summary: 'Step-by-step live DOM verification in Chrome Gemini Sidebar with pre-click checklists and 4-line status reports for Antigravity IDE.',
    destination: 'chrome_sidebar',
    bundles: ['rc-2-inventory-splitter', 'rc-5-social-studio'],
    defaultGoal:
      'Create a step-by-step Paired Human-AI Chrome Sidebar QA prompt to test our latest feature on alpha.resalecmd.com one page at a time.',
  },
];

const specialistBundles = [
  { id: 'rc-1-scout-vision', label: '🔍 1. Scout & Valuation' },
  { id: 'rc-2-inventory-splitter', label: '📦 2. Lots & Playbooks' },
  { id: 'rc-3-booth-drops', label: '🏷️ 3. Booth & Labels' },
  { id: 'rc-4-sales-coop', label: '🤝 4. Sales & Co-op' },
  { id: 'rc-5-social-studio', label: '📱 5. Social & Mobile UX' },
];

const VAULT_TAB_FILTERS = [
  { key: 'all', label: 'All Saved' },
  { key: 'prompt', label: '📋 Prompts' },
  { key: 'idea', label: '💡 Ideas' },
  { key: 'spec', label: '📌 Specs' },
  { key: 'done', label: '✅ Completed' },
] as const;

const REPORT_TAB_FILTERS = [
  { key: 'all', label: 'All Reports' },
  { key: 'pending_review', label: '🟡 Pending Review' },
  { key: 'vetted_for_dev', label: '🟣 Vetted for Dev' },
  { key: 'shipped', label: '🟢 Shipped in Git' },
  { key: 'rejected', label: '⚪ Archived' },
] as const;

const { user } = useAuth();
const members = ref<CoopMemberProfile[]>(normalizePolicyConfig(DEFAULT_COOP_POLICY_CONFIG).members);

const notes = ref<VaultNote[]>([]);
const synced = ref(false);
const loading = ref(true);
const showGuide = ref(false);
const showQuickNoteModal = ref(false);

const activeTab = ref<'studio' | 'vault' | 'reports'>('studio');
const vaultFilter = ref<'all' | 'prompt' | 'idea' | 'spec' | 'done'>('all');
const reportFilter = ref<'all' | VaultGovernanceStatus>('all');
const searchQuery = ref('');

const draftKind = ref<VaultNoteKind>('idea');
const draftTitle = ref('');
const draftBody = ref('');

const activePresetId = ref<string>('auction-sweeper');
const destination = ref<PromptTargetDestination>('chrome_sidebar');
const selectedBundles = ref<string[]>([]);
const makerIdea = ref('');
const refinement = ref('');
const making = ref(false);
const makerError = ref('');
const draft = ref<DraftResult | null>(null);
const draftReportContext = ref('');

const memberName = computed(() => user.value?.name || '');

const currentMember = computed(() => {
  const name = user.value?.name?.toLowerCase();
  if (!name) return undefined;
  return members.value.find((m) => m.name.toLowerCase().includes(name));
});

const isFounder = computed(
  () => !!user.value?.labels?.includes('admin') || canMemberEditGlobalFinancials(currentMember.value, false)
);

const bloat = computed(() => BLOAT_BADGE[draft.value?.opsImpact.bloatRating || 'lean']);

const promptsCount = computed(() => notes.value.filter((n) => n.kind === 'prompt' && !n.done).length);
const nonReportNotesCount = computed(() => notes.value.filter((n) => n.kind !== 'report' && !n.done).length);
const reportsCount = computed(() => notes.value.filter((n) => n.kind === 'report').length);
const pendingReportsCount = computed(
  () => notes.value.filter((n) => n.kind === 'report' && effectiveStatus(n) === 'pending_review').length
);
const vettedAndShippedCount = computed(
  () =>
    notes.value.filter(
      (n) =>
        n.kind === 'report' &&
        (effectiveStatus(n) === 'vetted_for_dev' || effectiveStatus(n) === 'shipped')
    ).length
);

const filteredVaultNotes = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  const base = [...notes.value]
    .filter((n) => n.kind !== 'report')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const byKind =
    vaultFilter.value === 'done'
      ? base.filter((n) => n.done)
      : vaultFilter.value === 'all'
        ? base.filter((n) => !n.done)
        : base.filter((n) => n.kind === vaultFilter.value && !n.done);

  if (!q) return byKind;
  return byKind.filter(
    (n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
  );
});

const filteredReportNotes = computed(() => {
  const base = [...notes.value]
    .filter((n) => n.kind === 'report')
    .sort((a, b) => (b.upvotedBy?.length || 0) - (a.upvotedBy?.length || 0) || b.updatedAt.localeCompare(a.updatedAt));
  if (reportFilter.value === 'all') return base;
  return base.filter((n) => effectiveStatus(n) === reportFilter.value);
});

function statusOf(note: VaultNote): VaultGovernanceStatus | undefined {
  return effectiveStatus(note);
}

function canDelete(note: VaultNote): boolean {
  return isFounder.value || (!!note.author && note.author === memberName.value);
}

function toggleBundle(id: string) {
  selectedBundles.value = selectedBundles.value.includes(id)
    ? selectedBundles.value.filter((b) => b !== id)
    : [...selectedBundles.value, id];
}

function openQuickNoteModal(kind: VaultNoteKind = 'idea') {
  draftKind.value = kind;
  draftTitle.value = '';
  draftBody.value = '';
  showQuickNoteModal.value = true;
}

function loadPresetInstant(preset: PlaybookPreset) {
  activePresetId.value = preset.id;
  destination.value = preset.destination;
  selectedBundles.value = [...preset.bundles];
  makerIdea.value = preset.defaultGoal;

  const existing = preset.starterNoteId
    ? notes.value.find((n) => n.id === preset.starterNoteId) ||
      STARTER_VAULT_NOTES.find((n) => n.id === preset.starterNoteId)
    : undefined;

  const text = existing ? existing.body : preset.defaultGoal;
  draft.value = {
    title: preset.title,
    promptText: text,
    coPilotNotes:
      'Loaded instant Playbook template. You can copy it right now, or use the Interactive Co-Pilot chips below to tailor it to a specific auction site, budget, or booth.',
    followUpQuestions: [
      {
        question: 'Which venue or channel are you hunting for today?',
        chips: ['Memory Den #0EJ (Goth / TTRPG / Sci-Fi)', 'Dusty Tiger (<8in Smalls / Pins)', 'Online Grail Flip (eBay / Poshmark)'],
      },
      {
        question: 'What is your target max cash outlay or bid ceiling per lot?',
        chips: ['Under $25 fast turn', '$30–$65 Anchor Lot', '$75+ Grail / Hero Lot'],
      },
    ],
    antiBiasAudit: '',
    bundlesUsed: preset.bundles,
    opsImpact: estimatePromptOpsImpact(text),
  };
}

async function customizePresetWithAi(preset: PlaybookPreset) {
  activePresetId.value = preset.id;
  destination.value = preset.destination;
  selectedBundles.value = [...preset.bundles];
  makerIdea.value = preset.defaultGoal;
  await runMaker(false);
}

function loadNoteIntoStudio(note: VaultNote) {
  activeTab.value = 'studio';
  if (note.destination) destination.value = note.destination;
  makerIdea.value = note.title;
  draft.value = {
    title: note.title,
    promptText: note.body,
    coPilotNotes: 'Loaded from your saved Vault. Add a refinement below and tap 🔄 Refine Draft to iterate.',
    followUpQuestions: [
      {
        question: 'How would you like to evolve this saved prompt or idea?',
        chips: ['Make it shorter for mobile', 'Convert to Antigravity IDE prompt', 'Add stricter anti-hallucination rules'],
      },
    ],
    antiBiasAudit: '',
    bundlesUsed: selectedBundles.value,
    opsImpact: estimatePromptOpsImpact(note.body),
  };
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetStudio() {
  makerIdea.value = '';
  refinement.value = '';
  draftReportContext.value = '';
  draft.value = null;
  makerError.value = '';
}

async function persist() {
  synced.value = await saveVaultNotes(notes.value);
}

async function refreshVault() {
  const res = await loadVaultNotes();
  notes.value = res.notes;
  synced.value = res.synced;
  activeTab.value = 'reports';
}

async function addNote() {
  const body = draftBody.value.trim();
  if (!body) return;
  const now = new Date().toISOString();
  notes.value.push({
    id: newVaultNoteId(),
    kind: draftKind.value,
    title: draftTitle.value.trim() || body.split('\n')[0].slice(0, 60),
    body,
    author: memberName.value || undefined,
    createdAt: now,
    updatedAt: now,
  });
  draftTitle.value = '';
  draftBody.value = '';
  showQuickNoteModal.value = false;
  await persist();
  addToast('Saved to Cloud Vault', 'success');
}

async function toggleDone(note: VaultNote) {
  note.done = !note.done;
  note.updatedAt = new Date().toISOString();
  await persist();
}

async function removeNote(note: VaultNote) {
  if (!window.confirm(`Delete "${note.title}"?`)) return;
  notes.value = notes.value.filter((n) => n.id !== note.id);
  await persist();
}

async function upvote(note: VaultNote) {
  toggleUpvote(note, memberName.value || 'member');
  await persist();
}

async function setStatus(note: VaultNote, status: VaultGovernanceStatus) {
  if (!isFounder.value) return;
  note.status = status;
  note.vettedBy = memberName.value || undefined;
  note.vettedAt = new Date().toISOString();
  note.updatedAt = note.vettedAt;
  await persist();
  addToast(`Marked ${GOV[status].label}`, 'success');
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    addToast('Copied to clipboard', 'success');
  } catch {
    addToast('Copy failed — long-press the text to copy', 'error');
  }
}

function addRefinement(question: string, chip: string) {
  refinement.value = `${refinement.value ? refinement.value + '\n' : ''}${question} → ${chip}`;
}

async function runMaker(isRefine = false) {
  making.value = true;
  makerError.value = '';
  try {
    const res = await fetch('/api/generate-vault-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idea: makerIdea.value,
        destination: destination.value,
        bundleIds: selectedBundles.value,
        reportContext: draftReportContext.value,
        currentDraft: isRefine ? draft.value?.promptText : undefined,
        userRefinement: isRefine ? refinement.value : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Generation failed');
    draft.value = data as DraftResult;
    if (isRefine) refinement.value = '';
  } catch (err: any) {
    makerError.value = err?.message || 'Generation failed';
  } finally {
    making.value = false;
  }
}

async function saveDraft() {
  if (!draft.value) return;
  const now = new Date().toISOString();
  notes.value.push({
    id: newVaultNoteId(),
    kind: destination.value === 'product_spec' ? 'spec' : 'prompt',
    title: draft.value.title,
    body: draft.value.promptText,
    destination: destination.value,
    author: memberName.value || undefined,
    createdAt: now,
    updatedAt: now,
  });
  await persist();
  addToast('Saved to Cloud Vault', 'success');
}

async function auditAndDraft(note: VaultNote) {
  activeTab.value = 'studio';
  destination.value = 'antigravity_ide';
  makerIdea.value = `Run a 3-Point Anti-Bias Audit and draft a generalizable Antigravity IDE fix for this community AI report.\nTitle: ${note.title}\nReporter note: ${note.body}`;
  draftReportContext.value = [
    note.itemContext ? `Item context: ${note.itemContext}` : '',
    note.rootCause ? `Reporter root cause: ${ROOT_CAUSES[note.rootCause]}` : '',
    `Community confirmations: ${note.upvotedBy?.length || 0}`,
  ]
    .filter(Boolean)
    .join('\n');
  await runMaker(false);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

onMounted(async () => {
  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get('tab');
  if (tabParam === 'vault' || tabParam === 'reports' || tabParam === 'studio') {
    activeTab.value = tabParam;
  }

  const res = await loadVaultNotes();
  notes.value = res.notes;
  synced.value = res.synced;
  loading.value = false;

  // Pre-load the Auction Sweeper starter into the right-hand canvas so the studio feels alive immediately
  loadPresetInstant(PLAYBOOK_PRESETS[0]);

  try {
    const gov = await loadCoopGovernanceState();
    members.value = gov.state.policyConfig.members;
  } catch {
    /* keep defaults */
  }
});
</script>
