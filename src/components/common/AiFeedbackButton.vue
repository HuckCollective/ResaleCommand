<template>
  <div class="inline-block">
    <button
      type="button"
      class="btn btn-xs sm:btn-sm btn-ghost border border-base-300 gap-1 rounded-lg font-bold"
      title="Tell the Collective when AI got something wrong"
      @click="open = true"
    >
      <span>🚩</span>
      <span class="hidden sm:inline">Report AI Issue</span>
    </button>

    <Teleport to="body">
      <div v-if="open" class="fixed inset-0 z-[500] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" @click.self="open = false">
        <div class="bg-base-100 w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl p-4 space-y-3 max-h-[90dvh] overflow-y-auto">
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="text-sm font-black">🚩 Report AI Issue</div>
              <div class="text-[11px] opacity-70">Goes to the Co-op AI Review Queue. A founder/developer vets it before anything changes — it never edits live scans.</div>
            </div>
            <button type="button" class="btn btn-ghost btn-xs btn-circle" @click="open = false">✕</button>
          </div>

          <div>
            <div class="text-[11px] font-extrabold uppercase opacity-60 mb-1">Where did it happen?</div>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="(label, key) in SURFACES"
                :key="key"
                type="button"
                class="btn btn-xs rounded-lg"
                :class="surfaceModel === key ? 'btn-primary' : 'btn-ghost border border-base-300'"
                @click="surfaceModel = key"
              >{{ label }}</button>
            </div>
          </div>

          <div>
            <div class="text-[11px] font-extrabold uppercase opacity-60 mb-1">What went wrong?</div>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="(label, key) in ISSUES"
                :key="key"
                type="button"
                class="btn btn-xs rounded-lg"
                :class="issue === key ? 'btn-secondary' : 'btn-ghost border border-base-300'"
                @click="issue = key"
              >{{ label }}</button>
            </div>
          </div>

          <div>
            <div class="text-[11px] font-extrabold uppercase opacity-60 mb-1">Honest check: why do you think it happened?</div>
            <div class="flex flex-col gap-1.5">
              <button
                v-for="(label, key) in CAUSES"
                :key="key"
                type="button"
                class="btn btn-xs rounded-lg justify-start"
                :class="cause === key ? 'btn-accent' : 'btn-ghost border border-base-300'"
                @click="cause = key"
              >{{ label }}</button>
            </div>
            <p class="text-[10px] opacity-60 mt-1">If the clue wasn't in the photo, the fix is a better photo — not a rule change.</p>
          </div>

          <textarea
            v-model="note"
            rows="3"
            class="textarea textarea-bordered w-full text-sm"
            placeholder="What did the AI say, and what should it have done? (voice dictation works)"
          ></textarea>

          <button type="button" class="btn btn-primary btn-sm w-full rounded-xl" :disabled="!note.trim() || saving" @click="submit">
            {{ saving ? 'Saving…' : 'Submit to Co-op Review Queue' }}
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
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
    addToast(res.synced ? 'Sent to the Co-op AI Review Queue' : 'Saved on this device (cloud sync failed)', res.synced ? 'success' : 'warning');
    note.value = '';
    open.value = false;
  } catch (err) {
    console.warn('[AiFeedbackButton] submit failed:', err);
    addToast('Could not save report', 'error');
  } finally {
    saving.value = false;
  }
}
</script>
