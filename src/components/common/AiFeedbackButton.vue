<template>
  <div class="inline-flex items-center">
    <button
      type="button"
      class="btn btn-xs sm:btn-sm btn-outline border-warning/50 text-warning hover:bg-warning/15 hover:border-warning gap-1.5 rounded-xl font-bold shadow-2xs"
      title="Flag a bad AI price, OCR miss, or wrong Playbook for Co-op review"
      @click="openModal"
    >
      <Icon icon="solar:flag-2-bold-duotone" class="w-4 h-4 shrink-0" />
      <span class="hidden sm:inline">Report AI Issue</span>
      <span class="sm:hidden">AI Flag</span>
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        class="fixed inset-0 z-500 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 animate-in fade-in duration-150"
        @click.self="open = false"
      >
        <div
          class="bg-base-100 border border-base-300 shadow-2xl w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl flex flex-col max-h-[92dvh] overflow-hidden"
        >
          <!-- Modal Header -->
          <div class="px-4 sm:px-6 py-4 border-b border-base-200 flex items-start justify-between gap-3 bg-base-200/40">
            <div class="flex items-start gap-3 min-w-0">
              <div class="w-10 h-10 rounded-2xl bg-warning/15 text-warning flex items-center justify-center shrink-0 mt-0.5">
                <Icon icon="solar:shield-warning-bold-duotone" class="w-6 h-6" />
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="text-base sm:text-lg font-black text-base-content">Report AI Scan or Playbook Issue</h3>
                  <span class="badge badge-warning badge-xs font-bold">Governed Queue</span>
                </div>
                <p class="text-xs text-base-content/70 mt-0.5 leading-relaxed">
                  Staged in Appwrite for Founder &amp; Developer vetting. Submissions never auto-mutate live prompts.
                </p>
              </div>
            </div>
            <button
              type="button"
              class="btn btn-ghost btn-sm btn-circle shrink-0"
              aria-label="Close modal"
              @click="open = false"
            >
              ✕
            </button>
          </div>

          <!-- Modal Scroll Body -->
          <div class="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
            <!-- Step 1: AI Surface -->
            <div class="space-y-2">
              <label class="text-xs font-extrabold uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
                <span class="badge badge-xs badge-primary font-mono">1</span>
                <span>Which AI Engine Had the Issue?</span>
              </label>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  v-for="(label, key) in SURFACES"
                  :key="key"
                  type="button"
                  class="p-2.5 rounded-xl border text-left transition-all flex items-center gap-2"
                  :class="
                    surfaceModel === key
                      ? 'border-primary bg-primary/10 text-primary font-black shadow-xs'
                      : 'border-base-300 bg-base-100 hover:bg-base-200/60 font-semibold text-xs'
                  "
                  @click="surfaceModel = key"
                >
                  <span class="text-xs truncate">{{ label }}</span>
                </button>
              </div>
            </div>

            <!-- Step 2: What Went Wrong -->
            <div class="space-y-2">
              <label class="text-xs font-extrabold uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
                <span class="badge badge-xs badge-secondary font-mono">2</span>
                <span>What Did the AI Get Wrong?</span>
              </label>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  v-for="(label, key) in ISSUES"
                  :key="key"
                  type="button"
                  class="p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2"
                  :class="
                    issue === key
                      ? 'border-secondary bg-secondary/10 text-secondary font-black shadow-xs'
                      : 'border-base-300 bg-base-100 hover:bg-base-200/60 font-semibold'
                  "
                  @click="issue = key"
                >
                  <span class="text-xs truncate">{{ label }}</span>
                  <Icon
                    v-if="issue === key"
                    icon="solar:check-circle-bold"
                    class="w-4 h-4 text-secondary shrink-0"
                  />
                </button>
              </div>
            </div>

            <!-- Step 3: Anti-Bias Root Cause Filter -->
            <div class="p-3.5 rounded-2xl bg-base-200/60 border border-base-300 space-y-2.5">
              <div class="flex items-center justify-between gap-2">
                <label class="text-xs font-extrabold uppercase tracking-wider text-base-content/80 flex items-center gap-1.5">
                  <span class="badge badge-xs badge-accent font-mono">3</span>
                  <span>🛡️ Anti-Bias Root Cause Check</span>
                </label>
                <span class="text-[10px] font-bold opacity-60">Prevents 1-item overfitting</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  v-for="(label, key) in CAUSES"
                  :key="key"
                  type="button"
                  class="p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2"
                  :class="
                    cause === key
                      ? 'border-accent bg-accent/15 text-base-content font-black shadow-xs'
                      : 'border-base-300 bg-base-100 hover:bg-base-200 font-medium'
                  "
                  @click="cause = key"
                >
                  <span class="text-xs leading-snug">{{ label }}</span>
                  <Icon
                    v-if="cause === key"
                    icon="solar:check-circle-bold"
                    class="w-4 h-4 text-accent shrink-0"
                  />
                </button>
              </div>
              <p
                v-if="cause === 'missing_photo_info'"
                class="text-[11px] text-warning font-semibold bg-warning/10 border border-warning/30 rounded-xl p-2"
              >
                💡 Note: When a copyright date, tag, or hallmark isn't visible in the photo, changing AI rules would cause hallucinations. Retaking a closeup photo or adding an Authoritative Reseller Note solves this immediately!
              </p>
            </div>

            <!-- Step 4: Member Correction Note -->
            <div class="space-y-1.5">
              <label class="text-xs font-extrabold uppercase tracking-wider text-base-content/70 flex items-center justify-between">
                <span>What Should the AI Have Done Instead?</span>
                <span class="text-[10px] font-normal opacity-60">Voice mic supported</span>
              </label>
              <textarea
                v-model="note"
                rows="3"
                class="textarea textarea-bordered w-full text-sm rounded-xl leading-relaxed"
                placeholder="Example: Priced modern 5e reprint at $45 like a 1st print; should be $15–$18 in our booth bin based on © 2018 copyright on page 2."
              ></textarea>
            </div>

            <!-- Captured Item Context Preview -->
            <details v-if="itemContext" class="text-xs bg-base-200/50 border border-base-300 rounded-xl p-2.5">
              <summary class="cursor-pointer font-bold text-base-content/70 flex items-center justify-between">
                <span>📎 Auto-Attached Item Snapshot (Included with Report)</span>
                <span class="badge badge-ghost badge-xs font-mono">{{ itemContext.length }} chars</span>
              </summary>
              <pre class="text-[11px] whitespace-pre-wrap break-words font-mono opacity-75 mt-2 max-h-28 overflow-y-auto">{{ itemContext }}</pre>
            </details>
          </div>

          <!-- Modal Footer -->
          <div class="px-4 sm:px-6 py-3.5 border-t border-base-200 bg-base-100 flex items-center justify-between gap-2">
            <a href="/coop/vault?tab=reports" class="link link-hover text-xs font-bold text-primary">
              Open Review Queue →
            </a>
            <div class="flex items-center gap-2">
              <button type="button" class="btn btn-sm btn-ghost rounded-xl font-bold" @click="open = false">
                Cancel
              </button>
              <button
                type="button"
                class="btn btn-sm btn-primary rounded-xl font-black gap-1.5 px-4 shadow-sm"
                :disabled="!note.trim() || saving"
                @click="submit"
              >
                <Icon icon="solar:paper-plane-bold" class="w-4 h-4" />
                <span>{{ saving ? 'Submitting…' : 'Submit to Review Queue' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useAuth } from '../../composables/useAuth';
import { addToast } from '../../stores/toast';
import {
  submitAiFeedbackReport,
  AI_SURFACE_LABELS,
  AI_ISSUE_LABELS,
  AI_ROOT_CAUSE_LABELS,
  type AiSurface,
  type AiIssueType,
  type AiRootCause,
} from '../../lib/founderVault';

const props = withDefaults(
  defineProps<{
    surface?: AiSurface;
    itemContext?: string;
  }>(),
  { surface: 'quick_scout', itemContext: '' }
);

const emit = defineEmits<{
  (e: 'submitted'): void;
}>();

const SURFACES = AI_SURFACE_LABELS;
const ISSUES = AI_ISSUE_LABELS;
const CAUSES = AI_ROOT_CAUSE_LABELS;

const { user } = useAuth();
const open = ref(false);
const saving = ref(false);
const surfaceModel = ref<AiSurface>(props.surface);
const issue = ref<AiIssueType>('bad_price');
const cause = ref<AiRootCause>('ignored_visible_clue');
const note = ref('');

watch(
  () => props.surface,
  (next) => {
    if (next) surfaceModel.value = next;
  }
);

function openModal() {
  surfaceModel.value = props.surface || 'quick_scout';
  open.value = true;
}

async function submit() {
  saving.value = true;
  try {
    const res = await submitAiFeedbackReport({
      surface: surfaceModel.value,
      issueType: issue.value,
      rootCause: cause.value,
      note: note.value,
      itemContext: props.itemContext,
      author: user.value?.name || undefined,
    });
    addToast(
      res.synced
        ? 'Submitted to the Co-op AI Review Queue (Pending Dev Vetting)'
        : 'Saved locally on this device (cloud sync offline)',
      res.synced ? 'success' : 'warning'
    );
    note.value = '';
    open.value = false;
    emit('submitted');
  } catch (err) {
    console.warn('[AiFeedbackButton] submit failed:', err);
    addToast('Could not save report', 'error');
  } finally {
    saving.value = false;
  }
}
</script>
