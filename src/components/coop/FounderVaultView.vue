<template>
  <div class="space-y-4 max-w-3xl mx-auto">
    <div class="flex items-center justify-between gap-2">
      <div>
        <h1 class="text-xl font-black">📱 AI Vault &amp; Prompt Maker</h1>
        <p class="text-xs opacity-70">Capture ideas, build prompts for any Gemini surface, and vet community AI reports.</p>
      </div>
      <div class="flex flex-col items-end gap-1">
        <span class="badge badge-sm font-bold" :class="synced ? 'badge-success' : 'badge-warning'">
          {{ synced ? 'Cloud synced' : 'Local only' }}
        </span>
        <span class="badge badge-sm badge-outline">{{ isFounder ? '👑 Founder / Dev vetting' : '👀 Member (read-only vetting)' }}</span>
      </div>
    </div>

    <div class="collapse collapse-arrow bg-base-100 border border-primary/30 rounded-2xl">
      <input type="checkbox" />
      <div class="collapse-title text-sm font-black">❓ How to use the Vault, Prompt Maker &amp; AI Reports</div>
      <div class="collapse-content text-xs space-y-3">
        <div>
          <div class="font-black">Prompt Maker (🪄)</div>
          <p class="opacity-80">Type a rough idea (or tap a starter), pick where you will run it, and Gemini — grounded in our skill library — drafts the prompt. It also asks 2–3 follow-up questions; tap a chip or reply and press <b>Refine</b> until it's right, then <b>Save to Vault</b>.</p>
        </div>
        <div>
          <div class="font-black">Where each destination goes</div>
          <ul class="list-disc pl-4 opacity-80 space-y-0.5">
            <li><b>📱 Gemini App</b> — phone brainstorming at gemini.google.com/app.</li>
            <li><b>🌐 Chrome Sidebar</b> — open the page first, then paste; the sidebar reads the page when you press Enter.</li>
            <li><b>🧪 AI Studio</b> — System Instructions + first message.</li>
            <li><b>🎯 Antigravity IDE</b> — surgical prompt for your PC (the model to pick is on its first line).</li>
          </ul>
        </div>
        <div>
          <div class="font-black">AI Reports &amp; governance</div>
          <p class="opacity-80">Anyone can tap <b>🚩 Report AI Issue</b> in Quick Scout or an item's drawer. Reports land here as 🟡 Pending Review and <b>never change live scans</b>. Members can 👍 confirm patterns. A founder/developer vets (🟣), drafts a bias-checked IDE fix prompt, tests it on alpha-1, and only then marks it 🟢 Shipped in Git.</p>
        </div>
        <div>
          <div class="font-black">Bias check</div>
          <p class="opacity-80">One odd item is not a rule. Ask: was the clue visible in the photo? Is this one outlier or a pattern? Are we anchoring to retail MSRP?</p>
        </div>
        <p class="opacity-60">Notes are visible to anyone with app access — never store passwords or API keys here. The "Ops impact" pill is a rough estimate.</p>
      </div>
    </div>

    <!-- PROMPT MAKER STUDIO -->
    <div class="card bg-base-100 border border-primary/30 rounded-2xl p-3 space-y-2">
      <div class="text-sm font-black">🪄 Prompt Maker</div>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="(meta, key) in DEST_META"
          :key="key"
          type="button"
          class="btn btn-xs rounded-lg"
          :class="destination === key ? 'btn-primary' : 'btn-ghost border border-base-300'"
          @click="destination = key"
        >{{ meta.icon }} {{ meta.label }}</button>
      </div>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="b in specialistBundles"
          :key="b.id"
          type="button"
          class="btn btn-xs rounded-lg"
          :class="selectedBundles.includes(b.id) ? 'btn-secondary' : 'btn-ghost border border-base-300'"
          @click="toggleBundle(b.id)"
        >{{ b.label }}</button>
        <span class="text-[10px] opacity-60 self-center">{{ selectedBundles.length ? 'Manual skills' : 'Auto-matching skills' }}</span>
      </div>
      <textarea
        v-model="makerIdea"
        rows="3"
        class="textarea textarea-bordered w-full text-sm"
        @input="draftReportContext = ''"
        placeholder="Rough idea or goal… e.g. 'Help me hunt goth/RPG lots on this auction page'"
      ></textarea>
      <button type="button" class="btn btn-primary btn-sm rounded-xl" :disabled="!makerIdea.trim() || making" @click="runMaker()">
        {{ making ? 'Drafting…' : '✨ Generate with Skills' }}
      </button>
      <div v-if="makerError" class="text-xs text-error">{{ makerError }}</div>

      <div v-if="draft" class="space-y-2 border-t border-base-200 pt-2">
        <div class="text-sm font-black">{{ draft.title }}</div>
        <pre class="text-xs whitespace-pre-wrap break-words font-sans max-h-72 overflow-auto bg-base-200/50 rounded-xl p-2">{{ draft.promptText }}</pre>
        <div class="flex flex-wrap gap-1.5 items-center">
          <span class="badge badge-sm font-bold" :class="bloat.badge">
            {{ bloat.icon }} Ops: +{{ draft.opsImpact.addedTokens }} tokens · ~${{ draft.opsImpact.costPer1kScansUsd.toFixed(4) }}/1k scans · {{ draft.opsImpact.pctOfMonthlyCredit.toFixed(3) }}% of monthly credit
          </span>
          <span class="text-[10px] opacity-70">{{ draft.opsImpact.recommendation }}</span>
        </div>
        <div v-if="draft.antiBiasAudit" class="text-xs bg-warning/10 border border-warning/30 rounded-xl p-2 whitespace-pre-wrap">
          <b>🛡️ Anti-bias audit:</b> {{ draft.antiBiasAudit }}
        </div>
        <p v-if="draft.coPilotNotes" class="text-[11px] opacity-70">💬 {{ draft.coPilotNotes }}</p>

        <div v-for="(q, qi) in draft.followUpQuestions" :key="qi" class="space-y-1">
          <div class="text-xs font-bold">{{ q.question }}</div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="chip in q.chips"
              :key="chip"
              type="button"
              class="btn btn-xs btn-ghost border border-base-300 rounded-lg"
              @click="addRefinement(q.question, chip)"
            >{{ chip }}</button>
          </div>
        </div>
        <textarea v-model="refinement" rows="2" class="textarea textarea-bordered w-full text-sm" placeholder="Answer or tweak… (chips above fill this in)"></textarea>
        <div class="flex flex-wrap gap-1.5">
          <button type="button" class="btn btn-sm btn-secondary rounded-xl" :disabled="!refinement.trim() || making" @click="runMaker(true)">🔄 Refine</button>
          <button type="button" class="btn btn-sm btn-primary rounded-xl" @click="copyText(draft.promptText)">📋 Copy</button>
          <button type="button" class="btn btn-sm btn-ghost border border-base-300 rounded-xl" @click="saveDraft">💾 Save to Vault</button>
        </div>
      </div>
    </div>

    <form class="card bg-base-100 border border-base-300 rounded-2xl p-3 space-y-2" @submit.prevent="addNote">
      <div class="flex gap-1.5 flex-wrap">
        <button
          v-for="(meta, k) in KIND_META"
          :key="k"
          type="button"
          class="btn btn-xs rounded-lg"
          :class="draftKind === k ? 'btn-primary' : 'btn-ghost border border-base-300'"
          @click="draftKind = k"
        >{{ meta.icon }} {{ meta.label }}</button>
      </div>
      <input v-model="draftTitle" class="input input-bordered input-sm w-full" placeholder="Title (optional)" />
      <textarea v-model="draftBody" class="textarea textarea-bordered w-full text-sm" rows="3" placeholder="Type or dictate with your phone keyboard mic…"></textarea>
      <button type="submit" class="btn btn-primary btn-sm rounded-xl" :disabled="!draftBody.trim()">Save to Vault</button>
    </form>

    <div class="flex gap-1.5 flex-wrap">
      <button
        v-for="f in filters"
        :key="f.key"
        class="btn btn-xs rounded-lg"
        :class="filter === f.key ? 'btn-neutral' : 'btn-ghost border border-base-300'"
        @click="filter = f.key"
      >{{ f.label }}</button>
    </div>

    <div v-if="loading" class="text-sm opacity-60">Loading…</div>
    <div v-else-if="!visibleNotes.length" class="text-sm opacity-60">Nothing here yet.</div>

    <div
      v-for="note in visibleNotes"
      :key="note.id"
      class="card bg-base-100 border border-base-300 rounded-2xl p-3 space-y-2"
      :class="note.done ? 'opacity-60' : ''"
    >
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="text-sm font-black" :class="note.done ? 'line-through' : ''">
            {{ KIND_META[note.kind].icon }} {{ note.title }}
          </div>
          <div class="text-[10px] opacity-50 flex flex-wrap gap-1 items-center">
            <span>{{ new Date(note.updatedAt).toLocaleString() }}</span>
            <span v-if="note.author">· {{ note.author }}</span>
            <span v-if="note.destination">· {{ DEST_META[note.destination].icon }} {{ DEST_META[note.destination].label }}</span>
            <span v-if="statusOf(note)" class="badge badge-xs" :class="GOV[statusOf(note)!].badge">{{ GOV[statusOf(note)!].icon }} {{ GOV[statusOf(note)!].label }}</span>
          </div>
        </div>
        <div class="flex gap-1 shrink-0 flex-wrap justify-end">
          <button class="btn btn-xs btn-primary rounded-lg" @click="copyText(note.body)">Copy</button>
          <button v-if="statusOf(note)" class="btn btn-xs btn-ghost border border-base-300 rounded-lg" @click="upvote(note)">
            👍 {{ note.upvotedBy?.length || 0 }}
          </button>
          <button class="btn btn-xs btn-ghost border border-base-300 rounded-lg" @click="toggleDone(note)">{{ note.done ? 'Reopen' : 'Done' }}</button>
          <button v-if="canDelete(note)" class="btn btn-xs btn-ghost text-error rounded-lg" @click="removeNote(note)">✕</button>
        </div>
      </div>
      <pre class="text-xs whitespace-pre-wrap break-words font-sans max-h-48 overflow-auto bg-base-200/50 rounded-xl p-2">{{ note.body }}</pre>
      <details v-if="note.itemContext" class="text-[11px] opacity-80">
        <summary class="cursor-pointer font-bold">Item context</summary>
        <pre class="whitespace-pre-wrap break-words font-sans mt-1">{{ note.itemContext }}</pre>
      </details>
      <div v-if="note.rootCause" class="text-[11px] opacity-70">Reporter's root cause: {{ ROOT_CAUSES[note.rootCause] }}</div>

      <div v-if="statusOf(note) && isFounder" class="flex flex-wrap gap-1.5 border-t border-base-200 pt-2">
        <button class="btn btn-xs btn-secondary rounded-lg" @click="setStatus(note, 'vetted_for_dev')">🟣 Vet for Dev</button>
        <button class="btn btn-xs btn-success rounded-lg" @click="setStatus(note, 'shipped')">🟢 Mark Shipped</button>
        <button class="btn btn-xs btn-ghost border border-base-300 rounded-lg" @click="setStatus(note, 'rejected')">⚪ Reject</button>
        <button class="btn btn-xs btn-accent rounded-lg" :disabled="making" @click="auditAndDraft(note)">✨ Audit Bias &amp; Draft IDE Fix</button>
      </div>
      <div v-else-if="statusOf(note)" class="text-[10px] opacity-60">Only a founder/developer can change review status.</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuth } from '../../composables/useAuth';
import { addToast } from '../../stores/toast';
import {
  loadVaultNotes,
  saveVaultNotes,
  newVaultNoteId,
  effectiveStatus,
  toggleUpvote,
  estimatePromptOpsImpact,
  VAULT_KIND_META,
  GOVERNANCE_META,
  DESTINATION_META,
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

const KIND_META = VAULT_KIND_META;
const GOV = GOVERNANCE_META;
const DEST_META = DESTINATION_META;
const ROOT_CAUSES = AI_ROOT_CAUSE_LABELS;

/** Labels for the manual skill-bundle chips (ids match generatedSkillBundles). */
const specialistBundles = [
  { id: 'rc-1-scout-vision', label: '🔍 Scout & Vision' },
  { id: 'rc-2-inventory-splitter', label: '📦 Inventory & Splitter' },
  { id: 'rc-3-booth-drops', label: '🏷️ Booth & Sync' },
  { id: 'rc-4-sales-coop', label: '🤝 Sales & Co-op' },
  { id: 'rc-5-social-studio', label: '📱 Social & Mobile UX' },
];

const { user } = useAuth();
const members = ref<CoopMemberProfile[]>(normalizePolicyConfig(DEFAULT_COOP_POLICY_CONFIG).members);

const notes = ref<VaultNote[]>([]);
const synced = ref(false);
const loading = ref(true);
const filter = ref<'all' | VaultNoteKind | 'done' | 'pending'>('all');
const draftKind = ref<VaultNoteKind>('idea');
const draftTitle = ref('');
const draftBody = ref('');

const destination = ref<PromptTargetDestination>('gemini_app');
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

const filters = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: '🟡 Needs Review' },
  { key: 'report', label: '🚩 AI Reports' },
  { key: 'idea', label: '💡 Ideas' },
  { key: 'prompt', label: '📋 Prompts' },
  { key: 'spec', label: '📌 Specs' },
  { key: 'done', label: '✅ Done' },
] as const;

const visibleNotes = computed(() => {
  const sorted = [...notes.value].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (filter.value === 'done') return sorted.filter((n) => n.done);
  const open = sorted.filter((n) => !n.done);
  if (filter.value === 'all') return open;
  if (filter.value === 'pending') return open.filter((n) => effectiveStatus(n) === 'pending_review');
  return open.filter((n) => n.kind === filter.value);
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

async function persist() {
  synced.value = await saveVaultNotes(notes.value);
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
  await persist();
  addToast('Saved to Vault', 'success');
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
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    addToast('Copied', 'success');
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
  addToast('Saved to Vault', 'success');
}

async function auditAndDraft(note: VaultNote) {
  destination.value = 'antigravity_ide';
  makerIdea.value = `Draft a bias-checked fix for this community AI report. Title: ${note.title}\nReporter note: ${note.body}`;
  draftReportContext.value = [
    note.itemContext ? `Item context: ${note.itemContext}` : '',
    note.rootCause ? `Reporter root cause: ${ROOT_CAUSES[note.rootCause]}` : '',
    `Confirmations: ${note.upvotedBy?.length || 0}`,
  ]
    .filter(Boolean)
    .join('\n');
  await runMaker();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

onMounted(async () => {
  const res = await loadVaultNotes();
  notes.value = res.notes;
  synced.value = res.synced;
  loading.value = false;
  try {
    const gov = await loadCoopGovernanceState();
    members.value = gov.state.policyConfig.members;
  } catch {
    /* keep defaults — founder controls stay hidden for non-admins */
  }
});
</script>
