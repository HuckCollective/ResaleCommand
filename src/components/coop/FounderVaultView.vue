<template>
  <div class="space-y-6">
    <!-- 1. TOP HEADER & PRIMARY ACTIONS -->
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
          <Icon icon="solar:users-group-two-rounded-bold-duotone" class="w-7 h-7 sm:w-8 sm:h-8 text-primary shrink-0" />
          <span>AI Prompt Studio &amp; Governed Learning Vault</span>
        </h1>
        <p class="text-xs sm:text-sm text-base-content/60 font-medium mt-1 max-w-3xl leading-relaxed">
          Tap any card to copy its prompt in 1 click, clone a 🔒 Locked Master Template, or open the Slide-Over Editor &amp; 🤝 AI Ally Drawer to customize, audit bias, and vet community AI reports.
        </p>
      </div>

      <div class="flex items-center gap-2 w-full sm:w-auto flex-wrap justify-end">
        <AiFeedbackButton surface="quick_scout" @submitted="refreshVault('reports')" />

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
          class="btn btn-sm btn-secondary gap-1.5 rounded-xl font-black h-10 px-4 shadow-xs"
          @click="openNewCardInDrawer('prompt', 'copilot')"
        >
          <Icon icon="solar:users-group-two-rounded-bold" class="w-4 h-4 shrink-0" />
          <span>🤝 Ask AI Ally</span>
        </button>

        <button
          type="button"
          class="btn btn-sm btn-primary gap-1.5 rounded-xl font-black shadow-md shadow-primary/20 h-10 px-4"
          @click="openNewCardInDrawer('idea', 'edit')"
        >
          <Icon icon="solar:add-circle-bold" class="w-4 h-4 shrink-0" />
          <span>+ New Vault Card</span>
        </button>
      </div>
    </div>

    <!-- Collapsible Field Guide -->
    <div
      v-if="showGuide"
      class="card bg-base-100 border border-primary/30 shadow-sm rounded-2xl p-4 sm:p-5 space-y-4 animate-in fade-in duration-150"
    >
      <div class="flex items-center justify-between gap-2">
        <div class="text-xs font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5">
          <Icon icon="solar:book-bookmark-bold-duotone" class="w-4 h-4" />
          <span>Field Guide: 🔒 Locked Templates, Slide-Over Drawer &amp; 🤝 AI Ally</span>
        </div>
        <button type="button" class="btn btn-ghost btn-xs btn-circle" @click="showGuide = false">✕</button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div class="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5">
          <div class="font-black text-primary">🔒 1. Locked Master Templates</div>
          <p class="text-base-content/80 leading-relaxed text-[11px]">
            Master templates are locked by Co-op Governance so they can never be overwritten by mistake. Tap <b>📋 Copy</b> or <b>🌱 Use Template</b> to clone your own editable card.
          </p>
        </div>

        <div class="p-3.5 rounded-xl bg-secondary/5 border border-secondary/20 space-y-1.5">
          <div class="font-black text-secondary">🤝 2. Slide-Over Drawer &amp; AI Ally</div>
          <p class="text-base-content/80 leading-relaxed text-[11px]">
            Inside the drawer, switch between <b>✏️ Edit &amp; Details</b>, <b>🤝 AI Ally &amp; Skills</b> (auto-fed from your issue description + routing guide), and <b>🛡️ Bias &amp; Ops Cost</b>.
          </p>
        </div>

        <div class="p-3.5 rounded-xl bg-warning/10 border border-warning/30 space-y-1.5">
          <div class="font-black text-warning">🛡️ 3. Governed AI Review Queue</div>
          <p class="text-base-content/80 leading-relaxed text-[11px]">
            Community <b>🚩 Report AI Issue</b> flags stage here as <b>🟡 Pending Review</b>. Open any report card in the drawer to run the <b>3-Point Anti-Bias Audit</b> and save a vetted IDE fix prompt.
          </p>
        </div>
      </div>
    </div>

    <!-- 2. 4 STANDALONE ICON-BADGE KPI CARDS -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <button
        type="button"
        class="bg-base-100 p-3.5 sm:p-5 rounded-2xl border transition-all shadow-sm flex items-center gap-3 sm:gap-4 text-left"
        :class="activeFilter === 'prompt' ? 'border-primary ring-1 ring-primary/30' : 'border-base-200 hover:border-primary/40'"
        @click="activeFilter = 'prompt'"
      >
        <div class="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
          <Icon icon="solar:magic-stick-3-bold-duotone" class="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <div class="min-w-0">
          <div class="text-[11px] uppercase font-bold opacity-60 truncate">Ready Prompts</div>
          <div class="text-lg sm:text-2xl font-black font-mono text-base-content truncate">{{ promptsCount }}</div>
          <div class="text-[10px] font-semibold opacity-50 truncate">Deal, QA &amp; IDE cards</div>
        </div>
      </button>

      <button
        type="button"
        class="bg-base-100 p-3.5 sm:p-5 rounded-2xl border transition-all shadow-sm flex items-center gap-3 sm:gap-4 text-left"
        :class="activeFilter === 'pending_review' ? 'border-warning ring-1 ring-warning/30' : 'border-base-200 hover:border-warning/50'"
        @click="activeFilter = 'pending_review'"
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
        class="bg-base-100 p-3.5 sm:p-5 rounded-2xl border transition-all shadow-sm flex items-center gap-3 sm:gap-4 text-left"
        :class="activeFilter === 'vetted' ? 'border-success ring-1 ring-success/30' : 'border-base-200 hover:border-success/50'"
        @click="activeFilter = 'vetted'"
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
        @click="openNewCardInDrawer('prompt', 'copilot')"
      >
        <div class="w-10 h-10 sm:w-12 sm:h-12 bg-info/10 text-info rounded-xl flex items-center justify-center shrink-0">
          <Icon icon="solar:users-group-two-rounded-bold-duotone" class="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <div class="min-w-0">
          <div class="text-[11px] uppercase font-bold opacity-60 truncate">🤝 AI Ally &amp; Skills</div>
          <div class="text-lg sm:text-2xl font-black font-mono text-info truncate">6 Bundles</div>
          <div class="text-[10px] font-semibold opacity-50 truncate">Tap to open AI Ally →</div>
        </div>
      </button>
    </div>

    <!-- 3. 🔒 LOCKED & GOVERNED CO-OP MASTER TEMPLATES -->
    <div class="card bg-base-100 border border-base-200 shadow-sm rounded-2xl p-4 sm:p-5 space-y-3">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <div>
          <div class="text-xs font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5">
            <Icon icon="solar:shield-keyhole-bold-duotone" class="w-4 h-4" />
            <span>🔒 Locked Co-op Master Templates (Founder-Governed)</span>
          </div>
          <p class="text-[11px] text-base-content/60">
            Guarded master templates — tap <b>📋 Copy</b> to use right away, or <b>🌱 Use Template</b> to clone a fresh editable copy with your 🤝 AI Ally.
          </p>
        </div>
        <span class="badge badge-warning badge-outline badge-xs font-bold">🔒 Immutable Master Templates</span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <div
          v-for="preset in PLAYBOOK_PRESETS"
          :key="preset.id"
          class="group rounded-2xl border border-base-200 hover:border-primary/50 bg-base-100 hover:shadow-md p-3.5 transition-all flex flex-col justify-between gap-3 cursor-pointer"
          @click="useTemplateAsNewCard(preset)"
        >
          <div class="space-y-1.5">
            <div class="flex items-center justify-between gap-1.5 flex-wrap">
              <span class="text-lg leading-none">{{ preset.icon }}</span>
              <div class="flex items-center gap-1">
                <span class="badge badge-warning badge-2xs font-bold">🔒 Master</span>
                <span class="badge badge-ghost badge-2xs font-semibold">
                  {{ DEST_META[preset.destination].icon }} {{ DEST_META[preset.destination].label }}
                </span>
              </div>
            </div>
            <div class="text-xs sm:text-sm font-black text-base-content group-hover:text-primary transition-colors leading-snug">
              {{ preset.title }}
            </div>
            <p class="text-[11px] text-base-content/70 leading-relaxed line-clamp-3">{{ preset.summary }}</p>
          </div>

          <div class="flex items-center justify-between gap-1 pt-2 border-t border-base-200/70 flex-wrap" @click.stop>
            <button
              type="button"
              class="btn btn-xs btn-primary rounded-lg font-bold gap-1"
              @click="copyPresetPrompt(preset)"
            >
              <Icon icon="solar:copy-bold" class="w-3.5 h-3.5" />
              <span>Copy</span>
            </button>
            <div class="flex items-center gap-1">
              <button
                v-if="isFounder"
                type="button"
                class="btn btn-xs btn-ghost border border-base-300 rounded-lg font-bold"
                title="Inspect Locked Master Template (Founder Governance Guard)"
                @click="inspectLockedMasterTemplate(preset)"
              >
                🔒
              </button>
              <button
                type="button"
                class="btn btn-xs btn-secondary rounded-lg font-bold gap-1"
                @click="useTemplateAsNewCard(preset)"
              >
                <span>🌱 Use Template</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. OMNIBOX SEARCH + PIPELINE FILTER PILLS + VIEW SWITCHER (Catalog Archetype) -->
    <div class="card bg-base-100 border border-base-200 shadow-sm rounded-2xl p-3.5 sm:p-4 space-y-3">
      <div class="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <!-- Omnibox Search -->
        <div class="relative flex-1">
          <Icon
            icon="solar:magnifer-linear"
            class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none"
          />
          <input
            v-model="searchQuery"
            type="text"
            class="input input-bordered input-sm w-full pl-9 pr-8 rounded-xl text-xs h-9"
            placeholder="Search prompts, ideas, specs, or AI reports by title, surface, or keyword..."
          />
          <button
            v-if="searchQuery"
            type="button"
            class="btn btn-ghost btn-2xs btn-circle absolute right-2 top-1/2 -translate-y-1/2"
            @click="searchQuery = ''"
          >
            ✕
          </button>
        </div>

        <!-- View Switcher (Cards Grid vs Table Ledger) -->
        <div class="flex items-center justify-between sm:justify-end gap-2 shrink-0">
          <span class="text-xs font-mono opacity-60">{{ filteredNotes.length }} cards</span>
          <div class="join border border-base-300 rounded-xl p-0.5 bg-base-200/50">
            <button
              type="button"
              class="btn btn-xs join-item rounded-lg gap-1 font-bold border-0"
              :class="viewMode === 'cards' ? 'btn-primary shadow-2xs' : 'btn-ghost'"
              @click="viewMode = 'cards'"
            >
              <Icon icon="solar:widget-2-bold-duotone" class="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
            <button
              type="button"
              class="btn btn-xs join-item rounded-lg gap-1 font-bold border-0"
              :class="viewMode === 'table' ? 'btn-primary shadow-2xs' : 'btn-ghost'"
              @click="viewMode = 'table'"
            >
              <Icon icon="solar:list-bold-duotone" class="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Horizontal Pipeline Filter Pills -->
      <div class="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
        <button
          v-for="f in PIPELINE_FILTERS"
          :key="f.key"
          type="button"
          class="btn btn-xs rounded-xl font-bold shrink-0 gap-1.5 h-7 px-3"
          :class="activeFilter === f.key ? 'btn-primary shadow-2xs' : 'btn-ghost bg-base-200/60 hover:bg-base-200 text-base-content/80'"
          @click="activeFilter = f.key"
        >
          <span>{{ f.label }}</span>
          <span class="badge badge-2xs font-mono" :class="activeFilter === f.key ? 'badge-neutral' : 'badge-ghost'">
            {{ f.count }}
          </span>
        </button>
      </div>
    </div>

    <!-- 5. VAULT CARDS GRID OR TABLE VIEW (Read-Only + 1-Tap Copy; Click Opens Drawer) -->
    <div v-if="loading" class="card bg-base-100 border border-base-200 rounded-2xl p-10 text-center text-sm opacity-60">
      Loading Cloud Vault…
    </div>

    <div
      v-else-if="!filteredNotes.length"
      class="card bg-base-100 border border-base-200 rounded-2xl p-10 text-center space-y-3"
    >
      <div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
        <Icon icon="solar:notebook-bold-duotone" class="w-6 h-6" />
      </div>
      <div class="text-sm font-black">No Vault cards match this filter yet</div>
      <p class="text-xs opacity-60 max-w-md mx-auto">
        Tap <b>+ New Vault Card</b>, <b>🤝 Ask AI Ally</b>, or <b>🌱 Use Template</b> above to create a card.
      </p>
    </div>

    <!-- 5A. 3-COLUMN CLICKABLE CARDS GRID -->
    <div v-else-if="viewMode === 'cards'" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <article
        v-for="note in filteredNotes"
        :key="note.id"
        class="group card bg-base-100 border border-base-200 hover:border-primary/60 hover:shadow-md rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3.5 transition-all cursor-pointer select-none"
        :class="note.done ? 'opacity-60' : ''"
        @click="openCardInDrawer(note, 'edit')"
      >
        <div class="space-y-2.5">
          <!-- Card Top Badge Strip -->
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span v-if="note.isLocked" class="badge badge-warning badge-xs font-bold">
                🔒 Locked
              </span>
              <span class="badge badge-xs font-bold" :class="kindBadgeClass(note.kind)">
                {{ KIND_META[note.kind].icon }} {{ KIND_META[note.kind].label }}
              </span>
              <span class="badge badge-ghost badge-xs font-semibold">
                {{ DEST_META[effectiveDestination(note)].icon }} {{ DEST_META[effectiveDestination(note)].label }}
              </span>
              <span
                v-if="statusOf(note)"
                class="badge badge-xs font-bold"
                :class="GOV[statusOf(note)!].badge"
              >
                {{ GOV[statusOf(note)!].icon }} {{ GOV[statusOf(note)!].label }}
              </span>
              <span v-if="note.surface && note.kind === 'report'" class="badge badge-outline badge-xs font-semibold">
                {{ SURFACES[note.surface] }}
              </span>
            </div>

            <span class="badge badge-ghost badge-xs font-mono opacity-75">
              +{{ estimateTokens(note.draftedFixPrompt || note.body) }} tok
            </span>
          </div>

          <!-- Card Title -->
          <h3
            class="text-sm sm:text-base font-black text-base-content group-hover:text-primary transition-colors leading-snug line-clamp-2"
            :class="note.done ? 'line-through' : ''"
          >
            {{ note.title }}
          </h3>

          <!-- Clean 3-Line Preview (No Giant Raw Pre Box) -->
          <p class="text-xs text-base-content/75 line-clamp-3 leading-relaxed whitespace-pre-line bg-base-200/40 rounded-xl p-2.5 border border-base-200">
            {{ note.body }}
          </p>

          <!-- Clean Parsed Item Snapshot Pill (Instead of Raw JSON Dump!) -->
          <div
            v-if="parsedSummary(note)"
            class="p-2.5 rounded-xl bg-secondary/5 border border-secondary/25 space-y-1 text-xs"
          >
            <div class="flex items-center justify-between gap-1.5 flex-wrap">
              <span class="text-[10px] font-extrabold uppercase tracking-wider text-secondary flex items-center gap-1">
                <Icon icon="solar:box-minimalistic-bold-duotone" class="w-3.5 h-3.5" />
                <span>Scan Snapshot</span>
              </span>
              <div class="flex items-center gap-1 flex-wrap">
                <span v-if="parsedSummary(note)?.tier" class="badge badge-secondary badge-2xs font-bold uppercase">
                  {{ parsedSummary(note)?.tier }}
                </span>
                <span v-if="parsedSummary(note)?.priceOrValue" class="badge badge-success badge-2xs font-mono font-bold">
                  {{ parsedSummary(note)?.priceOrValue }}
                </span>
                <span v-if="parsedSummary(note)?.verdict" class="badge badge-warning badge-2xs font-mono font-bold">
                  {{ parsedSummary(note)?.verdict }}
                </span>
              </div>
            </div>
            <div class="text-[11px] font-bold text-base-content truncate">
              {{ parsedSummary(note)?.title }}
            </div>
          </div>

          <!-- Saved Fix / Bias Audit Indicator Badges -->
          <div v-if="note.draftedFixPrompt || note.antiBiasAudit" class="flex items-center gap-1.5 flex-wrap">
            <span v-if="note.antiBiasAudit" class="badge badge-warning badge-outline badge-xs font-bold">
              🛡️ Bias Audit Saved
            </span>
            <span v-if="note.draftedFixPrompt" class="badge badge-primary badge-outline badge-xs font-bold">
              🎯 IDE Fix Saved
            </span>
          </div>
        </div>

        <!-- Card Footer: Read-Only Metadata + 1-Tap Copy + Open Drawer Cue -->
        <div
          class="flex items-center justify-between gap-2 pt-2.5 border-t border-base-200 text-xs"
          @click.stop
        >
          <div class="flex items-center gap-1.5 min-w-0">
            <button
              v-if="statusOf(note)"
              type="button"
              class="btn btn-xs btn-ghost border border-base-300 rounded-lg font-bold gap-1"
              title="Confirm you have also seen this issue"
              @click="upvoteById(note.id)"
            >
              <span>👍</span>
              <span class="font-mono">{{ note.upvotedBy?.length || 0 }}</span>
            </button>
            <span class="text-[10px] opacity-55 truncate font-mono">
              {{ new Date(note.updatedAt).toLocaleDateString() }}
            </span>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              class="btn btn-xs btn-primary rounded-lg font-bold gap-1 shadow-2xs"
              title="Copy text to clipboard"
              @click="copyText(note.draftedFixPrompt || note.body)"
            >
              <Icon icon="solar:copy-bold" class="w-3.5 h-3.5" />
              <span>Copy</span>
            </button>

            <button
              type="button"
              class="btn btn-xs btn-ghost border border-base-300 hover:border-primary rounded-lg font-bold gap-1"
              title="Open in Slide-Over Drawer to edit or refine with AI"
              @click="openCardInDrawer(note, 'edit')"
            >
              <span>Open</span>
              <Icon icon="solar:alt-arrow-right-linear" class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </article>
    </div>

    <!-- 5B. COMPACT TABLE LEDGER VIEW -->
    <div v-else class="card bg-base-100 border border-base-200 shadow-sm rounded-2xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="table table-sm w-full text-xs">
          <thead>
            <tr class="bg-base-200/60 text-[11px] uppercase tracking-wider">
              <th>Type</th>
              <th>Title &amp; Preview</th>
              <th>Target / Surface</th>
              <th>Governance</th>
              <th>Tokens</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="note in filteredNotes"
              :key="note.id"
              class="hover:bg-base-200/50 cursor-pointer transition-colors"
              @click="openCardInDrawer(note, 'edit')"
            >
              <td class="whitespace-nowrap">
                <span class="badge badge-xs font-bold" :class="kindBadgeClass(note.kind)">
                  {{ KIND_META[note.kind].icon }} {{ KIND_META[note.kind].label }}
                </span>
              </td>
              <td class="max-w-md">
                <div class="font-black text-base-content truncate" :class="note.done ? 'line-through opacity-60' : ''">
                  {{ note.title }}
                </div>
                <div class="text-[11px] opacity-65 truncate">{{ note.body }}</div>
              </td>
              <td class="whitespace-nowrap">
                <span class="badge badge-ghost badge-xs font-semibold">
                  {{ DEST_META[effectiveDestination(note)].icon }} {{ DEST_META[effectiveDestination(note)].label }}
                </span>
              </td>
              <td class="whitespace-nowrap">
                <span
                  v-if="statusOf(note)"
                  class="badge badge-xs font-bold"
                  :class="GOV[statusOf(note)!].badge"
                >
                  {{ GOV[statusOf(note)!].icon }} {{ GOV[statusOf(note)!].label }}
                </span>
                <span v-else class="opacity-40">—</span>
              </td>
              <td class="font-mono whitespace-nowrap">
                +{{ estimateTokens(note.draftedFixPrompt || note.body) }} tok
              </td>
              <td class="text-right whitespace-nowrap" @click.stop>
                <div class="inline-flex items-center gap-1">
                  <button
                    type="button"
                    class="btn btn-xs btn-primary rounded-lg font-bold"
                    @click="copyText(note.draftedFixPrompt || note.body)"
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    class="btn btn-xs btn-ghost border border-base-300 rounded-lg font-bold"
                    @click="openCardInDrawer(note, 'edit')"
                  >
                    Open →
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 6. STICKY VIEWPORT COMMAND DOCK (Canonical BottomActionDock) -->
    <BottomActionDock placement="viewport">
      <template #left>
        <div class="flex items-center gap-2 text-xs">
          <span class="badge badge-primary badge-sm font-mono font-black">{{ filteredNotes.length }}</span>
          <span class="font-bold text-base-content truncate">Vault Cards</span>
          <span v-if="pendingReportsCount > 0" class="badge badge-warning badge-xs font-bold">
            🟡 {{ pendingReportsCount }} Pending Review
          </span>
        </div>
      </template>

      <template #center>
        <div class="hidden xl:flex items-center gap-1">
          <button
            v-for="qf in QUICK_DOCK_FILTERS"
            :key="qf.key"
            type="button"
            class="btn btn-xs rounded-lg font-bold"
            :class="activeFilter === qf.key ? 'btn-primary' : 'btn-ghost'"
            @click="activeFilter = qf.key"
          >
            {{ qf.label }}
          </button>
        </div>
      </template>

      <template #right>
        <AiFeedbackButton surface="quick_scout" @submitted="refreshVault('pending_review')" />

        <button
          type="button"
          class="btn btn-xs sm:btn-sm btn-secondary rounded-xl font-black gap-1.5"
          @click="openNewCardInDrawer('prompt', 'copilot')"
        >
          <Icon icon="solar:users-group-two-rounded-bold" class="w-4 h-4" />
          <span>🤝 AI Ally</span>
        </button>

        <button
          type="button"
          class="btn btn-xs sm:btn-sm btn-primary rounded-xl font-black gap-1.5 px-4 shadow-sm"
          @click="openNewCardInDrawer('idea', 'edit')"
        >
          <Icon icon="solar:add-circle-bold" class="w-4 h-4" />
          <span>+ New Card</span>
        </button>
      </template>
    </BottomActionDock>

    <!-- 7. RIGHT-EDGE SLIDE-OVER EDITOR & AI ALLY DRAWER -->
    <VaultNoteDrawer
      :is-open="isDrawerOpen"
      :note="activeDrawerNote"
      :initial-tab="activeDrawerTab"
      :is-founder="isFounder"
      :can-delete="activeDrawerNote ? canDelete(activeDrawerNote) : false"
      :saving="savingCard"
      :presets="PLAYBOOK_PRESETS"
      @close="isDrawerOpen = false"
      @save="handleSaveFromDrawer"
      @delete="handleDeleteFromDrawer"
      @copy="copyText"
      @upvote="upvoteById"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { useAuth } from '../../composables/useAuth';
import { addToast } from '../../stores/toast';
import BottomActionDock from '../common/BottomActionDock.vue';
import AiFeedbackButton from '../common/AiFeedbackButton.vue';
import VaultNoteDrawer, { type PlaybookPresetItem } from './VaultNoteDrawer.vue';
import {
  loadVaultNotes,
  saveVaultNotes,
  newVaultNoteId,
  effectiveStatus,
  toggleUpvote,
  estimateTokens,
  parseItemContextSummary,
  recommendVaultTemplateAndSurface,
  clonePresetToNewNote,
  buildLockedMasterTemplateNote,
  PLAYBOOK_PRESETS,
  VAULT_KIND_META,
  GOVERNANCE_META,
  DESTINATION_META,
  AI_SURFACE_LABELS,
  type VaultNote,
  type VaultNoteKind,
  type VaultGovernanceStatus,
  type PromptTargetDestination,
  type ParsedItemContextSummary,
} from '../../lib/founderVault';
import {
  loadCoopGovernanceState,
  DEFAULT_COOP_POLICY_CONFIG,
  normalizePolicyConfig,
  canMemberEditGlobalFinancials,
  type CoopMemberProfile,
} from '../../lib/coopGovernance';

type FilterKey =
  | 'all'
  | 'prompt'
  | 'idea'
  | 'spec'
  | 'report'
  | 'pending_review'
  | 'vetted'
  | 'done';

const KIND_META = VAULT_KIND_META;
const GOV = GOVERNANCE_META;
const DEST_META = DESTINATION_META;
const SURFACES = AI_SURFACE_LABELS;

function effectiveDestination(note: VaultNote): PromptTargetDestination {
  return note.destination || recommendVaultTemplateAndSurface(note).recommendedDestination;
}

const QUICK_DOCK_FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'prompt', label: '📋 Prompts' },
  { key: 'report', label: '🚩 AI Reports' },
  { key: 'pending_review', label: '🟡 Pending' },
];

const { user } = useAuth();
const members = ref<CoopMemberProfile[]>(normalizePolicyConfig(DEFAULT_COOP_POLICY_CONFIG).members);

const notes = ref<VaultNote[]>([]);
const synced = ref(false);
const loading = ref(true);
const savingCard = ref(false);
const showGuide = ref(false);
const viewMode = ref<'cards' | 'table'>('cards');
const activeFilter = ref<FilterKey>('all');
const searchQuery = ref('');

const isDrawerOpen = ref(false);
const activeDrawerNote = ref<VaultNote | null>(null);
const activeDrawerTab = ref<'edit' | 'copilot' | 'audit'>('edit');

const memberName = computed(() => user.value?.name || '');

const currentMember = computed(() => {
  const name = user.value?.name?.toLowerCase();
  if (!name) return undefined;
  return members.value.find((m) => m.name.toLowerCase().includes(name));
});

const isFounder = computed(
  () => !!user.value?.labels?.includes('admin') || canMemberEditGlobalFinancials(currentMember.value, false)
);

const promptsCount = computed(() => notes.value.filter((n) => n.kind === 'prompt' && !n.done).length);
const ideasCount = computed(() => notes.value.filter((n) => n.kind === 'idea' && !n.done).length);
const specsCount = computed(() => notes.value.filter((n) => n.kind === 'spec' && !n.done).length);
const reportsCount = computed(() => notes.value.filter((n) => n.kind === 'report' && !n.done).length);
const pendingReportsCount = computed(
  () => notes.value.filter((n) => n.kind === 'report' && !n.done && effectiveStatus(n) === 'pending_review').length
);
const vettedAndShippedCount = computed(
  () =>
    notes.value.filter(
      (n) =>
        n.kind === 'report' &&
        (effectiveStatus(n) === 'vetted_for_dev' || effectiveStatus(n) === 'shipped')
    ).length
);
const doneCount = computed(() => notes.value.filter((n) => n.done).length);

const PIPELINE_FILTERS = computed<Array<{ key: FilterKey; label: string; count: number }>>(() => [
  { key: 'all', label: 'All Active', count: notes.value.filter((n) => !n.done).length },
  { key: 'prompt', label: '📋 Prompts', count: promptsCount.value },
  { key: 'idea', label: '💡 Ideas', count: ideasCount.value },
  { key: 'spec', label: '📌 Specs', count: specsCount.value },
  { key: 'report', label: '🚩 AI Reports', count: reportsCount.value },
  { key: 'pending_review', label: '🟡 Pending Review', count: pendingReportsCount.value },
  { key: 'vetted', label: '🟣/🟢 Vetted & Shipped', count: vettedAndShippedCount.value },
  { key: 'done', label: '✅ Completed', count: doneCount.value },
]);

const filteredNotes = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  const sorted = [...notes.value].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const byFilter = sorted.filter((n) => {
    if (activeFilter.value === 'done') return !!n.done;
    if (n.done) return false;
    if (activeFilter.value === 'all') return true;
    if (activeFilter.value === 'pending_review') {
      return n.kind === 'report' && effectiveStatus(n) === 'pending_review';
    }
    if (activeFilter.value === 'vetted') {
      const st = effectiveStatus(n);
      return st === 'vetted_for_dev' || st === 'shipped';
    }
    return n.kind === activeFilter.value;
  });

  if (!q) return byFilter;
  return byFilter.filter(
    (n) =>
      n.title.toLowerCase().includes(q) ||
      n.body.toLowerCase().includes(q) ||
      (n.itemContext && n.itemContext.toLowerCase().includes(q))
  );
});

function statusOf(note: VaultNote): VaultGovernanceStatus | undefined {
  return effectiveStatus(note);
}

function kindBadgeClass(k: VaultNoteKind): string {
  if (k === 'report') return 'badge-warning';
  if (k === 'prompt') return 'badge-primary';
  if (k === 'spec') return 'badge-secondary';
  return 'badge-accent';
}

function parsedSummary(note: VaultNote): ParsedItemContextSummary | null {
  return parseItemContextSummary(note.itemContext);
}

function canDelete(note: VaultNote): boolean {
  if (note.isLocked || note.isMasterTemplate) return false;
  return isFounder.value || (!!note.author && note.author === memberName.value);
}

function openCardInDrawer(note: VaultNote, tab: 'edit' | 'copilot' | 'audit' = 'edit') {
  activeDrawerNote.value = note;
  activeDrawerTab.value = tab;
  isDrawerOpen.value = true;
}

function openNewCardInDrawer(kind: VaultNoteKind = 'prompt', tab: 'edit' | 'copilot' = 'edit') {
  const now = new Date().toISOString();
  activeDrawerNote.value = {
    id: newVaultNoteId(),
    kind,
    title: '',
    body: '',
    destination: 'antigravity_ide',
    author: memberName.value || undefined,
    createdAt: now,
    updatedAt: now,
  };
  activeDrawerTab.value = tab;
  isDrawerOpen.value = true;
}

function useTemplateAsNewCard(preset: PlaybookPresetItem) {
  const cloned = clonePresetToNewNote(preset);
  cloned.author = memberName.value || undefined;
  activeDrawerNote.value = cloned;
  activeDrawerTab.value = 'copilot';
  isDrawerOpen.value = true;
  addToast('Cloned master template into a new editable card with your AI Ally!', 'info');
}

function inspectLockedMasterTemplate(preset: PlaybookPresetItem) {
  activeDrawerNote.value = buildLockedMasterTemplateNote(preset);
  activeDrawerTab.value = 'edit';
  isDrawerOpen.value = true;
}

function copyPresetPrompt(preset: PlaybookPresetItem) {
  copyText(preset.masterPromptBody);
}

async function persist() {
  synced.value = await saveVaultNotes(notes.value);
}

async function refreshVault(switchFilter?: 'reports' | 'pending_review') {
  const res = await loadVaultNotes();
  notes.value = res.notes;
  synced.value = res.synced;
  if (switchFilter === 'reports') activeFilter.value = 'report';
  if (switchFilter === 'pending_review') activeFilter.value = 'pending_review';
}

async function handleSaveFromDrawer(updated: VaultNote) {
  savingCard.value = true;
  try {
    const id = updated.id || newVaultNoteId();
    const record: VaultNote = {
      ...updated,
      id,
      updatedAt: new Date().toISOString(),
    };
    const idx = notes.value.findIndex((n) => n.id === id);
    if (idx !== -1) {
      notes.value[idx] = record;
    } else {
      notes.value.unshift(record);
    }
    activeDrawerNote.value = record;
    await persist();
    addToast('Saved to Cloud Vault', 'success');
  } finally {
    savingCard.value = false;
  }
}

async function handleDeleteFromDrawer(id: string) {
  const target = notes.value.find((n) => n.id === id);
  if (!target) {
    isDrawerOpen.value = false;
    return;
  }
  if (!window.confirm(`Delete "${target.title}" from the Vault?`)) return;
  notes.value = notes.value.filter((n) => n.id !== id);
  isDrawerOpen.value = false;
  await persist();
  addToast('Deleted from Vault', 'info');
}

async function upvoteById(id: string) {
  const target = notes.value.find((n) => n.id === id);
  if (!target) return;
  toggleUpvote(target, memberName.value || 'member');
  if (activeDrawerNote.value && activeDrawerNote.value.id === id) {
    activeDrawerNote.value = { ...target, upvotedBy: [...(target.upvotedBy || [])] };
  }
  await persist();
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    addToast('Copied to clipboard', 'success');
  } catch {
    addToast('Copy failed — long-press the text to copy', 'error');
  }
}

onMounted(async () => {
  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get('tab');
  if (tabParam === 'reports') {
    activeFilter.value = 'report';
  }

  const res = await loadVaultNotes();
  notes.value = res.notes;
  synced.value = res.synced;
  loading.value = false;

  try {
    const gov = await loadCoopGovernanceState();
    members.value = gov.state.policyConfig.members;
  } catch {
    /* keep defaults */
  }
});
</script>
