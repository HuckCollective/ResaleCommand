<template>
  <div class="space-y-4">
    <!-- Done state (only reached for "already applied" / bot-trap generic answers; new applications redirect to the status page) -->
    <div v-if="step === 'done'" class="space-y-3 text-center py-4">
      <div class="text-4xl">📧</div>
      <h4 class="font-black text-base">Check your email</h4>
      <p class="text-sm text-base-content/70 break-words">
        If this address is new to us, we just sent a verification link to finish your application. If you've already applied,
        we re-sent your personal status link. Give it a minute and check spam / Promotions too.
      </p>
      <button type="button" class="btn btn-sm btn-primary rounded-xl font-black" @click="emit('close')">Done</button>
    </div>

    <!-- Form state -->
    <div v-else class="space-y-3">
      <div class="space-y-1.5">
        <div class="text-xs font-bold">1. Which hat fits you?</div>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="hat in hatOptions"
            :key="hat.id"
            type="button"
            class="btn btn-xs sm:btn-sm rounded-xl gap-1.5"
            :class="selectedHats.includes(hat.id) ? 'btn-primary' : 'btn-ghost border border-base-300'"
            @click="toggleHat(hat.id)"
          >
            <span>{{ hat.icon }}</span>
            <span>{{ hat.title }}</span>
          </button>
        </div>
      </div>

      <div class="space-y-1.5">
        <div class="text-xs font-bold">2. What is your focus or specialty? (Pick all that fit)</div>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="chip in nicheChips"
            :key="chip"
            type="button"
            class="btn btn-xs rounded-lg"
            :class="selectedNiches.includes(chip) ? 'btn-secondary' : 'btn-ghost border border-base-300'"
            @click="toggleNiche(chip)"
          >
            {{ chip }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div class="flex flex-col gap-1 w-full">
          <label class="text-xs font-bold whitespace-normal">Your name or shop</label>
          <input v-model="name" type="text" maxlength="80" class="input input-bordered input-sm rounded-xl w-full" placeholder="Name or shop" />
        </div>
        <div class="flex flex-col gap-1 w-full">
          <label class="text-xs font-bold whitespace-normal">Your email</label>
          <input
            v-model="email"
            type="email"
            autocomplete="email"
            :readonly="emailLocked"
            class="input input-bordered input-sm rounded-xl w-full"
            :class="{ 'bg-base-200/70 cursor-not-allowed': emailLocked }"
            placeholder="you@example.com"
          />
          <span v-if="emailLocked" class="text-[10px] text-base-content/60">Your email is verified and can't be changed.</span>
        </div>
      </div>

      <div class="flex flex-col gap-1 w-full">
        <label class="text-xs font-bold whitespace-normal">Instagram, TikTok, eBay, or Shop Link (optional — speeds up review)</label>
        <input v-model="socialUrl" type="text" maxlength="200" class="input input-bordered input-sm rounded-xl w-full" placeholder="@yourhandle or https://..." />
      </div>

      <div class="flex flex-col gap-1 w-full">
        <label class="text-xs font-bold whitespace-normal">Anything else we should know? (Estimated item count, hours/wk, etc.)</label>
        <textarea v-model="note" maxlength="500" class="textarea textarea-bordered rounded-xl text-xs h-16 w-full" placeholder="e.g. ~25 vintage RPG boxes ready for Memory Den, or 3 hrs/wk filming reels..."></textarea>
      </div>

      <!-- Hidden honeypot -->
      <input v-model="website" type="text" tabindex="-1" autocomplete="off" class="hidden" aria-hidden="true" />
      <p class="text-[11px] text-base-content/60">
        Zero email tag: after you send this we'll email you a link to verify your address; stewards review verified applications right inside {{ siteConfig.title }}.
      </p>
      <p v-if="errorMsg" class="text-xs text-error break-words">{{ errorMsg }}</p>
      <div class="flex justify-end gap-2 pt-3 border-t border-base-200">
        <button v-if="!hideCloseButton" type="button" class="btn btn-sm btn-ghost rounded-xl" @click="emit('close')">
          {{ cancelLabel || 'Close' }}
        </button>
        <button type="button" class="btn btn-sm btn-primary rounded-xl font-black" :disabled="busy" @click="submitRequest">
          <span v-if="busy" class="loading loading-spinner loading-xs"></span>
          {{ initialRequest ? 'Save Changes' : 'Send Request' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { siteConfig } from '../../site-config';
import { JOIN_NICHE_CHIPS, JOIN_REQUEST_HATS, type JoinRequest, type JoinRequestHat } from '../../lib/joinRequests';
import { joinApi, type JoinStatusView } from '../../lib/joinRequestsClient';

interface HatOption {
  id: string;
  icon: string;
  title: string;
}

const props = defineProps<{
  hats: readonly HatOption[];
  /** When set the form edits this application (needs `tokens`). */
  initialRequest?: JoinRequest | null;
  /** Signed link tokens from the status URL (`t` = view, `v` = verify/owner). */
  tokens?: { t?: string; v?: string };
  hideCloseButton?: boolean;
  cancelLabel?: string;
}>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved', view: JoinStatusView): void;
}>();

const hatOptions = computed(() => props.hats.filter((h) => (JOIN_REQUEST_HATS as readonly string[]).includes(h.id)));
const nicheChips = JOIN_NICHE_CHIPS;

const step = ref<'form' | 'done'>('form');
const busy = ref(false);
const errorMsg = ref('');
const formOpenedAt = ref(Date.now());

const selectedHats = ref<string[]>([]);
const selectedNiches = ref<string[]>([]);
const name = ref('');
const email = ref('');
const socialUrl = ref('');
const note = ref('');
const website = ref('');

const emailLocked = computed(() => !!props.initialRequest?.verifiedAt && !!props.tokens?.v);

onMounted(() => {
  formOpenedAt.value = Date.now();
});

watch(
  () => props.initialRequest,
  (req) => {
    if (!req) return;
    selectedHats.value = Array.isArray(req.hats) ? [...req.hats] : [];
    selectedNiches.value = Array.isArray(req.niches) ? [...req.niches] : [];
    name.value = req.name || '';
    email.value = req.email || '';
    socialUrl.value = req.socialUrl || '';
    note.value = req.note || '';
  },
  { immediate: true }
);

const toggleHat = (id: string) => {
  selectedHats.value = selectedHats.value.includes(id)
    ? selectedHats.value.filter((h) => h !== id)
    : [...selectedHats.value, id];
};

const toggleNiche = (chip: string) => {
  selectedNiches.value = selectedNiches.value.includes(chip)
    ? selectedNiches.value.filter((n) => n !== chip)
    : [...selectedNiches.value, chip];
};

const submitRequest = async () => {
  errorMsg.value = '';
  if (selectedHats.value.length === 0) return (errorMsg.value = 'Pick at least one hat.');
  if (!name.value.trim()) return (errorMsg.value = 'Please enter your name.');
  if (!/^\S+@\S+\.\S+$/.test(email.value.trim())) return (errorMsg.value = 'Please enter a valid email.');

  busy.value = true;
  try {
    const fields = {
      name: name.value.trim(),
      email: email.value.trim().toLowerCase(),
      socialUrl: socialUrl.value.trim(),
      note: note.value.trim(),
      niches: [...selectedNiches.value],
      hats: selectedHats.value as JoinRequestHat[],
    };

    if (props.initialRequest) {
      const res = await joinApi<{ request: JoinStatusView }>('update', {
        id: props.initialRequest.id,
        t: props.tokens?.t,
        v: props.tokens?.v,
        ...fields,
      });
      if (!res.ok) {
        errorMsg.value = res.data.error || 'Could not save your changes. Please try again.';
        return;
      }
      emit('saved', res.data.request);
      return;
    }

    const res = await joinApi<{ statusUrl?: string; existing?: boolean }>('submit', {
      ...fields,
      website: website.value,
      formOpenedAt: formOpenedAt.value,
    });
    if (!res.ok) {
      errorMsg.value = res.data.error || 'Could not send your request. Please try again.';
      return;
    }
    if (res.data.statusUrl) {
      // Straight to the personal status page (it shows the "verify your email" card).
      window.location.href = res.data.statusUrl;
      return;
    }
    step.value = 'done';
  } finally {
    busy.value = false;
  }
};
</script>
