<template>
  <div class="space-y-4 max-w-3xl mx-auto">
    <div class="flex items-center justify-between gap-2">
      <div>
        <h1 class="text-xl font-black">📱 Founder's Idea &amp; Prompt Vault</h1>
        <p class="text-xs opacity-70">Capture ideas on your phone, copy prompts into Gemini, pull specs into the IDE.</p>
      </div>
      <span class="badge badge-sm font-bold" :class="synced ? 'badge-success' : 'badge-warning'">
        {{ synced ? 'Cloud synced' : 'Local only' }}
      </span>
    </div>

    <form class="card bg-base-100 border border-base-300 rounded-2xl p-3 space-y-2" @submit.prevent="addNote">
      <div class="flex gap-1.5">
        <button
          v-for="(meta, k) in KIND_META"
          :key="k"
          type="button"
          class="btn btn-xs rounded-lg"
          :class="draftKind === k ? 'btn-primary' : 'btn-ghost border border-base-300'"
          @click="draftKind = k"
        >
          {{ meta.icon }} {{ meta.label }}
        </button>
      </div>
      <input v-model="draftTitle" class="input input-bordered input-sm w-full" placeholder="Title (optional)" />
      <textarea
        v-model="draftBody"
        class="textarea textarea-bordered w-full text-sm"
        rows="4"
        placeholder="Type or dictate with your phone keyboard mic…"
      ></textarea>
      <button type="submit" class="btn btn-primary btn-sm rounded-xl" :disabled="!draftBody.trim()">Save to Vault</button>
    </form>

    <div class="flex gap-1.5 flex-wrap">
      <button
        v-for="f in filters"
        :key="f.key"
        class="btn btn-xs rounded-lg"
        :class="filter === f.key ? 'btn-neutral' : 'btn-ghost border border-base-300'"
        @click="filter = f.key"
      >
        {{ f.label }}
      </button>
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
          <div class="text-[10px] opacity-50">{{ new Date(note.updatedAt).toLocaleString() }}</div>
        </div>
        <div class="flex gap-1 shrink-0">
          <button class="btn btn-xs btn-primary rounded-lg" @click="copyNote(note)">Copy</button>
          <button class="btn btn-xs btn-ghost border border-base-300 rounded-lg" @click="toggleDone(note)">
            {{ note.done ? 'Reopen' : 'Done' }}
          </button>
          <button class="btn btn-xs btn-ghost text-error rounded-lg" @click="removeNote(note)">✕</button>
        </div>
      </div>
      <pre class="text-xs whitespace-pre-wrap break-words font-sans max-h-48 overflow-auto bg-base-200/50 rounded-xl p-2">{{ note.body }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { addToast } from '../../stores/toast';
import {
  loadVaultNotes,
  saveVaultNotes,
  newVaultNoteId,
  VAULT_KIND_META,
  type VaultNote,
  type VaultNoteKind,
} from '../../lib/founderVault';

const KIND_META = VAULT_KIND_META;
const notes = ref<VaultNote[]>([]);
const synced = ref(false);
const loading = ref(true);
const filter = ref<'all' | VaultNoteKind | 'done'>('all');
const draftKind = ref<VaultNoteKind>('idea');
const draftTitle = ref('');
const draftBody = ref('');

const filters = [
  { key: 'all', label: 'All' },
  { key: 'idea', label: '💡 Ideas' },
  { key: 'prompt', label: '📋 Prompts' },
  { key: 'spec', label: '📌 Specs' },
  { key: 'done', label: '✅ Done' },
] as const;

const visibleNotes = computed(() => {
  const sorted = [...notes.value].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (filter.value === 'all') return sorted.filter((n) => !n.done);
  if (filter.value === 'done') return sorted.filter((n) => n.done);
  return sorted.filter((n) => n.kind === filter.value && !n.done);
});

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

async function copyNote(note: VaultNote) {
  try {
    await navigator.clipboard.writeText(note.body);
    addToast('Copied', 'success');
  } catch {
    addToast('Copy failed — long-press the text to copy', 'error');
  }
}

onMounted(async () => {
  const res = await loadVaultNotes();
  notes.value = res.notes;
  synced.value = res.synced;
  loading.value = false;
});
</script>
