<template>
  <div>
  <Teleport v-if="isMounted" to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-450 flex items-end justify-center bg-black/60 p-0 sm:px-4"
      @click.self="closeTray"
    >
      <!-- Upward-Sliding Bottom-Sheet Detent List Tray -->
      <div
        class="bg-base-100 border-t border-x border-base-300 shadow-2xl w-full max-w-3xl rounded-t-3xl flex flex-col max-h-[88dvh] overflow-hidden animate-in slide-in-from-bottom duration-200"
      >
        <!-- Drag Handle Pill -->
        <div class="pt-2.5 pb-1 flex justify-center bg-base-200/40 select-none" @click="toggleViewHeaderTap">
          <div class="w-11 h-1.5 rounded-full bg-base-content/20"></div>
        </div>

        <!-- Pinned Sheet Header -->
        <div class="px-4 sm:px-6 pb-3 pt-1 border-b border-base-200 bg-base-200/40 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2.5 min-w-0">
            <button
              v-if="viewMode !== 'list'"
              type="button"
              class="btn btn-xs btn-ghost btn-circle shrink-0"
              title="Back to Messages & Bug Queue"
              @click="backToList"
            >
              <Icon icon="solar:arrow-left-linear" class="w-4 h-4" />
            </button>
            <div class="w-9 h-9 rounded-2xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Icon
                :icon="
                  viewMode === 'compose'
                    ? 'solar:bug-bold-duotone'
                    : viewMode === 'detail'
                      ? 'solar:document-text-bold-duotone'
                      : 'solar:chat-round-dots-bold-duotone'
                "
                class="w-5 h-5"
              />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="text-sm sm:text-base font-black text-base-content truncate">
                  {{
                    viewMode === 'compose'
                      ? composeKind === 'bug'
                        ? 'Report UI / App Bug'
                        : composeKind === 'message'
                          ? 'New Steward Message'
                          : 'Flag AI Scan Issue'
                      : viewMode === 'detail'
                        ? cleanEscapedCurrency(activeNote?.title || 'Item Details')
                        : 'Co-op Messages & Bug Reports'
                  }}
                </h3>
                <span class="badge badge-primary badge-xs font-mono font-bold">
                  {{ feedNotes.length }}
                </span>
              </div>
              <p class="text-[11px] opacity-65 truncate">
                Synced with AI Vault &amp; Governance • Screenshots saved to <code>coop_media</code>
              </p>
            </div>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <button
              v-if="viewMode === 'list'"
              type="button"
              class="btn btn-xs sm:btn-sm btn-primary rounded-xl font-black gap-1"
              @click="openComposer('bug')"
            >
              <Icon icon="solar:add-circle-bold" class="w-4 h-4" />
              <span>Report Bug / Msg</span>
            </button>
            <a
              href="/coop/vault?tab=reports"
              class="btn btn-xs sm:btn-sm btn-ghost rounded-xl font-bold hidden sm:inline-flex gap-1"
              title="Open full AI Vault & Prompt Maker"
            >
              <span>Vault</span>
              <Icon icon="solar:arrow-right-up-linear" class="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              class="btn btn-sm btn-ghost btn-circle"
              aria-label="Close tray"
              @click="closeTray"
            >
              ✕
            </button>
          </div>
        </div>

        <!-- ======================================================= -->
        <!-- VIEW 1: INTERACTIVE BOTTOM-SHEET LIST                   -->
        <!-- ======================================================= -->
        <template v-if="viewMode === 'list'">
          <!-- Filter Bar -->
          <div class="px-4 sm:px-6 py-2.5 border-b border-base-200 bg-base-100 flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-1.5 overflow-x-auto max-w-full pb-0.5">
              <button
                v-for="tab in FILTER_TABS"
                :key="tab.id"
                type="button"
                class="btn btn-xs rounded-xl font-bold gap-1 shrink-0"
                :class="activeFilter === tab.id ? 'btn-primary' : 'btn-ghost bg-base-200/70'"
                @click="activeFilter = tab.id"
              >
                <span>{{ tab.icon }}</span>
                <span>{{ tab.label }}</span>
                <span class="badge badge-2xs font-mono">{{ countForTab(tab.id) }}</span>
              </button>
            </div>

            <div class="flex items-center gap-1.5">
              <button
                type="button"
                class="btn btn-xs btn-outline border-info/50 text-info rounded-xl font-bold gap-1"
                @click="openComposer('message')"
              >
                <span>💬 Message</span>
              </button>
              <button
                type="button"
                class="btn btn-xs btn-outline border-error/50 text-error rounded-xl font-bold gap-1"
                @click="openComposer('bug')"
              >
                <span>🐞 Bug + Photo</span>
              </button>
            </div>
          </div>

          <!-- Scrollable Feed -->
          <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
            <div v-if="loading" class="py-10 text-center text-xs opacity-60 flex flex-col items-center gap-2">
              <span class="loading loading-spinner loading-sm text-primary"></span>
              <span>Loading messages &amp; bug reports…</span>
            </div>

            <div
              v-else-if="filteredNotes.length === 0"
              class="rounded-2xl border border-dashed border-base-300 bg-base-200/30 p-8 text-center space-y-2"
            >
              <div class="text-2xl">✨</div>
              <div class="font-black text-sm">No items in this view yet</div>
              <p class="text-xs opacity-65 max-w-sm mx-auto">
                Snap or paste a screenshot to log a UI bug, flag an AI scan issue, or leave a note for fellow co-op stewards.
              </p>
              <div class="pt-1 flex justify-center gap-2">
                <button type="button" class="btn btn-xs btn-primary rounded-xl font-bold" @click="openComposer('bug')">
                  🐞 Report a Bug
                </button>
                <button type="button" class="btn btn-xs btn-outline rounded-xl font-bold" @click="openComposer('message')">
                  💬 Post a Message
                </button>
              </div>
            </div>

            <button
              v-for="item in filteredNotes"
              :key="item.id"
              type="button"
              class="w-full text-left rounded-2xl border border-base-300 bg-base-100 hover:border-primary/60 hover:bg-base-200/30 transition-all p-3.5 flex items-start gap-3 shadow-2xs cursor-pointer"
              @click="openDetail(item)"
            >
              <!-- Optional Cover Thumbnail -->
              <div
                v-if="firstImageId(item)"
                class="w-14 h-14 rounded-xl overflow-hidden border border-base-300 bg-base-200 shrink-0 relative"
              >
                <img
                  :src="thumbUrl(firstImageId(item)!)"
                  referrerpolicy="no-referrer"
                  alt="Screenshot"
                  class="w-full h-full object-cover"
                  @error="onThumbError($event, firstImageId(item)!)"
                />
                <span
                  v-if="allImageIds(item).length > 1"
                  class="absolute bottom-0.5 right-0.5 badge badge-2xs bg-black/75 text-white border-0 font-mono"
                >
                  +{{ allImageIds(item).length - 1 }}
                </span>
              </div>
              <div
                v-else
                class="w-10 h-10 rounded-xl bg-base-200 flex items-center justify-center text-base shrink-0 mt-0.5"
              >
                {{ kindMeta(item).icon }}
              </div>

              <!-- Card Content -->
              <div class="min-w-0 flex-1 space-y-1">
                <div class="flex items-center justify-between gap-2 flex-wrap">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="badge badge-2xs font-bold" :class="kindMeta(item).badge">
                      {{ kindMeta(item).icon }} {{ kindMeta(item).label }}
                    </span>
                    <span
                      v-if="effectiveStatus(item)"
                      class="badge badge-2xs font-bold"
                      :class="GOVERNANCE_META[effectiveStatus(item)!].badge"
                    >
                      {{ GOVERNANCE_META[effectiveStatus(item)!].icon }} {{ GOVERNANCE_META[effectiveStatus(item)!].label }}
                    </span>
                    <span v-if="item.pageUrl" class="badge badge-ghost badge-2xs font-mono">
                      {{ item.pageUrl }}
                    </span>
                  </div>
                  <span class="text-[10px] font-mono opacity-55 shrink-0">
                    {{ formatShortDate(item.createdAt) }}
                  </span>
                </div>

                <div class="font-black text-xs sm:text-sm text-base-content line-clamp-1">
                  {{ cleanEscapedCurrency(item.title) }}
                </div>
                <p class="text-xs opacity-75 line-clamp-2 leading-snug">
                  {{ stripMarkdownExcerpt(item.body, 145) }}
                </p>

                <div class="flex items-center justify-between text-[10px] opacity-60 pt-0.5">
                  <span>By {{ item.author || 'Co-op Member' }}</span>
                  <span class="font-bold text-primary">Tap to inspect →</span>
                </div>
              </div>
            </button>
          </div>
        </template>

        <!-- ======================================================= -->
        <!-- VIEW 2: DETAIL INSPECTOR (Locked MD <-> Unlock to Edit) -->
        <!-- ======================================================= -->
        <template v-else-if="viewMode === 'detail' && activeNote">
          <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            <!-- Metadata & Author Unlock Bar -->
            <div class="flex flex-wrap items-center justify-between gap-2 bg-base-200/50 rounded-2xl p-3 border border-base-300">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="badge badge-xs font-bold" :class="kindMeta(activeNote).badge">
                  {{ kindMeta(activeNote).icon }} {{ kindMeta(activeNote).label }}
                </span>
                <span
                  v-if="effectiveStatus(activeNote)"
                  class="badge badge-xs font-bold"
                  :class="GOVERNANCE_META[effectiveStatus(activeNote)!].badge"
                >
                  {{ GOVERNANCE_META[effectiveStatus(activeNote)!].icon }} {{ GOVERNANCE_META[effectiveStatus(activeNote)!].label }}
                </span>
                <span v-if="activeNote.pageUrl" class="badge badge-ghost badge-xs font-mono">
                  📍 {{ activeNote.pageUrl }}
                </span>
                <span class="text-xs opacity-70">
                  Posted by <b>{{ activeNote.author || 'Member' }}</b> • {{ formatShortDate(activeNote.createdAt) }}
                </span>
              </div>

              <div class="flex items-center gap-1.5">
                <button
                  v-if="canEditActiveNote && detailLocked"
                  type="button"
                  class="btn btn-xs btn-outline border-primary/50 text-primary rounded-xl font-bold gap-1"
                  @click="unlockDetailForEdit"
                >
                  <Icon icon="solar:lock-unlocked-bold" class="w-3.5 h-3.5" />
                  <span>Unlock to Edit</span>
                </button>
                <span v-else-if="detailLocked" class="badge badge-ghost badge-xs gap-1 font-semibold">
                  🔒 Formatted MD
                </span>
              </div>
            </div>

            <div v-if="!detailLocked" class="form-control space-y-1">
              <label class="text-xs font-black uppercase tracking-wider opacity-70">Title</label>
              <input
                v-model="editForm.title"
                type="text"
                class="input input-bordered input-sm w-full rounded-xl font-bold"
              />
            </div>

            <MarkdownMediaComposer
              v-model="editForm.body"
              :locked="detailLocked"
              label="Details & Steps (Markdown)"
              :rows="6"
              :existing-images="editForm.existingImages"
              :new-photos="editForm.newPhotos"
              :can-upload-photos="isAuthenticated"
              :max-photos="6"
              photo-title="Attached Screenshots & Photos"
              @update:existing-images="editForm.existingImages = $event"
              @update:new-photos="editForm.newPhotos = $event"
            />
          </div>

          <div class="px-4 sm:px-6 py-3 border-t border-base-200 bg-base-100 flex items-center justify-between gap-2">
            <a
              href="/coop/vault?tab=reports"
              class="btn btn-xs sm:btn-sm btn-outline btn-secondary rounded-xl font-bold gap-1.5"
            >
              <Icon icon="solar:magic-stick-3-bold-duotone" class="w-4 h-4" />
              <span>Open in AI Vault Prompt Maker →</span>
            </a>

            <div class="flex items-center gap-2">
              <template v-if="!detailLocked">
                <button
                  type="button"
                  class="btn btn-xs sm:btn-sm btn-ghost rounded-xl font-bold"
                  @click="cancelDetailEdit"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="btn btn-xs sm:btn-sm btn-primary rounded-xl font-black gap-1"
                  :disabled="savingEdit || !editForm.body.trim()"
                  @click="saveDetailEdit"
                >
                  <Icon icon="solar:lock-keyhole-bold" class="w-4 h-4" />
                  <span>{{ savingEdit ? 'Saving…' : 'Save & Lock' }}</span>
                </button>
              </template>
              <button v-else type="button" class="btn btn-xs sm:btn-sm btn-ghost rounded-xl font-bold" @click="backToList">
                Back to List
              </button>
            </div>
          </div>
        </template>

        <!-- ======================================================= -->
        <!-- VIEW 3: NEW BUG / MESSAGE COMPOSER (+ Photo Upload)     -->
        <!-- ======================================================= -->
        <template v-else-if="viewMode === 'compose'">
          <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            <!-- Type Switcher -->
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="(meta, key) in COOP_MESSAGE_KIND_META"
                :key="key"
                type="button"
                class="p-2.5 rounded-xl border text-left transition-all flex items-center gap-2"
                :class="
                  composeKind === key
                    ? 'border-primary bg-primary/10 text-primary font-black shadow-2xs'
                    : 'border-base-300 bg-base-100 hover:bg-base-200/60 font-semibold text-xs'
                "
                @click="composeKind = key"
              >
                <span class="text-base leading-none">{{ meta.icon }}</span>
                <span class="text-xs truncate">{{ meta.label }}</span>
              </button>
            </div>

            <!-- Auto-Captured Route Pill -->
            <div class="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-base-200/60 border border-base-300 px-3 py-2 text-xs">
              <span class="flex items-center gap-1.5 font-semibold opacity-80">
                <Icon icon="solar:link-circle-bold-duotone" class="w-4 h-4 text-primary" />
                Page Route: <code class="font-mono font-bold">{{ capturedRoute || '/' }}</code>
              </span>
              <span class="text-[11px] opacity-60 font-mono">{{ capturedDevice }}</span>
            </div>

            <div class="form-control space-y-1">
              <label class="text-xs font-black uppercase tracking-wider opacity-75">
                Short Summary Title (Optional)
              </label>
              <input
                v-model="composeTitle"
                type="text"
                class="input input-bordered input-sm w-full rounded-xl font-bold"
                :placeholder="
                  composeKind === 'bug'
                    ? 'Example: Seller boxes overlapping items in Auction Tracker'
                    : 'Short headline...'
                "
              />
            </div>

            <MarkdownMediaComposer
              v-model="composeBody"
              :locked="false"
              :label="
                composeKind === 'bug'
                  ? 'What happened & what you expected (Markdown supported)'
                  : 'Message or Note (Markdown supported)'
              "
              :placeholder="
                composeKind === 'bug'
                  ? 'Describe what looks off or didn’t work. Paste a screenshot below with Ctrl+V or tap Camera!'
                  : 'Share an operational note, question, or idea for fellow co-op stewards...'
              "
              :rows="5"
              :existing-images="composeExistingImages"
              :new-photos="composeNewPhotos"
              :can-upload-photos="isAuthenticated"
              :max-photos="6"
              photo-title="Bug Screenshots & Reference Photos"
              @update:existing-images="composeExistingImages = $event"
              @update:new-photos="composeNewPhotos = $event"
            />
          </div>

          <div class="px-4 sm:px-6 py-3.5 border-t border-base-200 bg-base-100 flex items-center justify-between gap-2">
            <button type="button" class="btn btn-sm btn-ghost rounded-xl font-bold" @click="backToList">
              Cancel
            </button>
            <button
              type="button"
              class="btn btn-sm btn-primary rounded-xl font-black gap-1.5 px-4 shadow-sm"
              :disabled="!composeBody.trim() || submitting"
              @click="submitNewEntry"
            >
              <Icon icon="solar:paper-plane-bold" class="w-4 h-4" />
              <span>{{ submitting ? 'Uploading & Saving…' : 'Submit to Co-op Queue' }}</span>
            </button>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Icon } from '@iconify/vue';
import MarkdownMediaComposer from '../common/MarkdownMediaComposer.vue';
import { useAuth } from '../../composables/useAuth';
import { addToast } from '../../stores/toast';
import { cleanEscapedCurrency, stripMarkdownExcerpt } from '../../lib/safeMarkdown';
import { getCoopMediaUrl, uploadCoopMediaFiles } from '../../lib/coopMedia';
import {
  loadVaultNotes,
  saveVaultNotes,
  submitCoopBugOrMessage,
  COOP_MESSAGE_KIND_META,
  GOVERNANCE_META,
  effectiveStatus,
  resolveNoteMessageKind,
  canUserEditVaultNote,
  type VaultNote,
  type CoopMessageKind,
  type AiSurface,
} from '../../lib/founderVault';

const { user, isAuthenticated, ownedTeam } = useAuth();

const isMounted = ref(false);
const isOpen = ref(false);
const loading = ref(false);
const viewMode = ref<'list' | 'detail' | 'compose'>('list');
const activeFilter = ref<'all' | CoopMessageKind>('all');

const allVaultNotes = ref<VaultNote[]>([]);
const activeNote = ref<VaultNote | null>(null);
const detailLocked = ref(true);
const savingEdit = ref(false);

const editForm = ref<{
  title: string;
  body: string;
  existingImages: string[];
  newPhotos: any[];
}>({
  title: '',
  body: '',
  existingImages: [],
  newPhotos: [],
});

const composeKind = ref<CoopMessageKind>('bug');
const composeTitle = ref('');
const composeBody = ref('');
const composeSurface = ref<AiSurface>('general');
const composeItemContext = ref('');
const composeExistingImages = ref<string[]>([]);
const composeNewPhotos = ref<any[]>([]);
const submitting = ref(false);
const capturedRoute = ref('/');
const capturedDevice = ref('');

const FILTER_TABS: Array<{ id: 'all' | CoopMessageKind; icon: string; label: string }> = [
  { id: 'all', icon: '📥', label: 'All' },
  { id: 'bug', icon: '🐞', label: 'UI Bugs' },
  { id: 'ai_report', icon: '🤖', label: 'AI Flags' },
  { id: 'message', icon: '💬', label: 'Messages' },
];

const feedNotes = computed(() =>
  allVaultNotes.value.filter(
    (n) => !n.isMasterTemplate && (n.kind === 'report' || n.kind === 'idea' || Boolean(n.messageKind))
  )
);

const filteredNotes = computed(() => {
  if (activeFilter.value === 'all') return feedNotes.value;
  return feedNotes.value.filter((n) => resolveNoteMessageKind(n) === activeFilter.value);
});

const isFounderUser = computed(
  () => Boolean(ownedTeam.value) || /mike|tyler/i.test(user.value?.name || '')
);

const canEditActiveNote = computed(() =>
  canUserEditVaultNote(activeNote.value, {
    userEmail: user.value?.email,
    userName: user.value?.name,
    isFounder: isFounderUser.value,
  })
);

function countForTab(tabId: 'all' | CoopMessageKind): number {
  if (tabId === 'all') return feedNotes.value.length;
  return feedNotes.value.filter((n) => resolveNoteMessageKind(n) === tabId).length;
}

function kindMeta(note: VaultNote) {
  return COOP_MESSAGE_KIND_META[resolveNoteMessageKind(note)];
}

function allImageIds(note: VaultNote): string[] {
  return Array.from(
    new Set([note.imageId, ...(note.galleryImageIds || [])].filter((id): id is string => Boolean(id && !id.startsWith('data:'))))
  );
}

function firstImageId(note: VaultNote): string | undefined {
  return allImageIds(note)[0];
}

function thumbUrl(fileId: string): string {
  return getCoopMediaUrl(fileId, { preview: true, width: 180, height: 180, quality: 80 });
}

function onThumbError(ev: Event, fileId: string) {
  const img = ev.target as HTMLImageElement | null;
  if (!img || img.dataset.retriedRaw === '1') return;
  img.dataset.retriedRaw = '1';
  img.src = getCoopMediaUrl(fileId, { preview: false });
}

function formatShortDate(iso?: string): string {
  if (!iso) return '';
  return String(iso).slice(0, 10);
}

function broadcastCount() {
  if (typeof window === 'undefined') return;
  const openCount = feedNotes.value.filter((n) => effectiveStatus(n) === 'pending_review').length;
  window.dispatchEvent(
    new CustomEvent('coop-messages-updated', {
      detail: { total: feedNotes.value.length, pending: openCount },
    })
  );
}

async function refreshFeed() {
  loading.value = true;
  try {
    const res = await loadVaultNotes();
    allVaultNotes.value = res.notes;
    broadcastCount();
  } finally {
    loading.value = false;
  }
}

function captureEnvironment() {
  if (typeof window === 'undefined') return;
  capturedRoute.value = window.location.pathname + (window.location.search || '');
  capturedDevice.value = `${window.innerWidth}×${window.innerHeight}px`;
}

function openComposer(kind: CoopMessageKind = 'bug') {
  captureEnvironment();
  composeKind.value = kind;
  composeTitle.value = '';
  composeBody.value = '';
  composeExistingImages.value = [];
  composeNewPhotos.value = [];
  viewMode.value = 'compose';
}

function openDetail(note: VaultNote) {
  activeNote.value = note;
  detailLocked.value = true;
  editForm.value = {
    title: cleanEscapedCurrency(note.title),
    body: cleanEscapedCurrency(note.body),
    existingImages: allImageIds(note),
    newPhotos: [],
  };
  viewMode.value = 'detail';
}

function unlockDetailForEdit() {
  if (!canEditActiveNote.value) return;
  detailLocked.value = false;
}

function cancelDetailEdit() {
  if (!activeNote.value) return;
  openDetail(activeNote.value);
}

async function saveDetailEdit() {
  if (!activeNote.value || !canEditActiveNote.value) return;
  savingEdit.value = true;
  try {
    let uploadedIds: string[] = [];
    if (isAuthenticated.value && editForm.value.newPhotos.length > 0) {
      uploadedIds = await uploadCoopMediaFiles(editForm.value.newPhotos, 'msg');
    }
    const mergedGallery = [...editForm.value.existingImages, ...uploadedIds];
    const updated: VaultNote = {
      ...activeNote.value,
      title: cleanEscapedCurrency(editForm.value.title.trim()) || activeNote.value.title,
      body: cleanEscapedCurrency(editForm.value.body.trim()),
      imageId: mergedGallery[0] || undefined,
      galleryImageIds: mergedGallery,
      updatedAt: new Date().toISOString(),
    };

    const nextNotes = allVaultNotes.value.map((n) => (n.id === updated.id ? updated : n));
    await saveVaultNotes(nextNotes);
    allVaultNotes.value = nextNotes;
    activeNote.value = updated;
    detailLocked.value = true;
    editForm.value.existingImages = mergedGallery;
    editForm.value.newPhotos = [];
    broadcastCount();
    addToast('Saved & locked formatted note!', 'success');
  } catch (err: any) {
    addToast(err?.message || 'Could not save changes.', 'error');
  } finally {
    savingEdit.value = false;
  }
}

async function submitNewEntry() {
  if (!composeBody.value.trim()) return;
  submitting.value = true;
  try {
    let uploadedIds: string[] = [];
    if (isAuthenticated.value && composeNewPhotos.value.length > 0) {
      uploadedIds = await uploadCoopMediaFiles(composeNewPhotos.value, composeKind.value);
    }
    const mergedGallery = [...composeExistingImages.value, ...uploadedIds];
    const res = await submitCoopBugOrMessage({
      messageKind: composeKind.value,
      title: composeTitle.value.trim() || undefined,
      body: composeBody.value,
      pageUrl: capturedRoute.value,
      deviceSummary: capturedDevice.value,
      imageId: mergedGallery[0] || undefined,
      galleryImageIds: mergedGallery,
      surface: composeSurface.value,
      itemContext: composeItemContext.value || undefined,
      author: user.value?.name || undefined,
      authorEmail: user.value?.email || undefined,
    });

    await refreshFeed();
    openDetail(res.note);
    addToast(
      res.synced
        ? 'Submitted to Co-op Queue (Synced with AI Vault)!'
        : 'Saved locally (cloud sync offline)',
      res.synced ? 'success' : 'warning'
    );
  } catch (err: any) {
    addToast(err?.message || 'Failed to submit report.', 'error');
  } finally {
    submitting.value = false;
  }
}

function backToList() {
  viewMode.value = 'list';
  activeNote.value = null;
  detailLocked.value = true;
}

function toggleViewHeaderTap() {
  if (viewMode.value !== 'list') {
    backToList();
  }
}

function closeTray() {
  isOpen.value = false;
}

function handleOpenTrayEvent(ev: Event) {
  const detail = (ev as CustomEvent)?.detail || {};
  captureEnvironment();
  isOpen.value = true;
  refreshFeed();

  if (detail.surface) composeSurface.value = detail.surface;
  if (detail.itemContext) composeItemContext.value = detail.itemContext;

  if (detail.mode === 'new_bug') {
    openComposer('bug');
  } else if (detail.mode === 'new_message') {
    openComposer('message');
  } else if (detail.filter) {
    activeFilter.value = detail.filter;
    viewMode.value = 'list';
  } else {
    viewMode.value = 'list';
  }
}

onMounted(() => {
  isMounted.value = true;
  if (typeof window !== 'undefined') {
    window.addEventListener('open-coop-messages-tray', handleOpenTrayEvent as EventListener);
  }
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('open-coop-messages-tray', handleOpenTrayEvent as EventListener);
  }
});
</script>
