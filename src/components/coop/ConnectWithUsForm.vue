<template>
  <div class="space-y-4">
    <!-- Step 3: done -->
    <div v-if="step === 'done'" class="space-y-3 text-center py-4">
      <div class="text-4xl">🎉</div>
      <h4 class="font-black text-base">Request received!</h4>
      <p class="text-sm text-base-content/70 break-words">
        {{ alreadyReviewed
          ? 'We already have your request on file. A member will be in touch.'
          : 'A member will review your request and email you an invite link if it is a fit.' }}
      </p>
      <button type="button" class="btn btn-sm btn-primary rounded-xl font-black" @click="emit('close')">Close</button>
    </div>

    <!-- Step 2: code -->
    <div v-else-if="step === 'code'" class="space-y-3">
      <p class="text-sm break-words">
        We emailed a 6-digit code to <strong class="break-all">{{ email }}</strong>. Enter it below to confirm it is really you.
      </p>
      <div class="flex flex-col gap-1 w-full">
        <label class="text-xs font-bold whitespace-normal">6-digit code</label>
        <input
          v-model="code"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          class="input input-bordered input-sm rounded-xl w-full font-mono tracking-widest"
          placeholder="123456"
          @keyup.enter="verifyAndSubmit"
        />
      </div>
      <p v-if="errorMsg" class="text-xs text-error break-words">{{ errorMsg }}</p>
      <div class="flex flex-wrap justify-between gap-2 pt-3 border-t border-base-200">
        <button type="button" class="btn btn-sm btn-ghost rounded-xl" :disabled="busy" @click="backToForm">Back</button>
        <button type="button" class="btn btn-sm btn-primary rounded-xl font-black" :disabled="busy || code.length !== 6" @click="verifyAndSubmit">
          <span v-if="busy" class="loading loading-spinner loading-xs"></span>
          Confirm &amp; Send Request
        </button>
      </div>
    </div>

    <!-- Step 1: form -->
    <div v-else class="space-y-3">
      <div class="space-y-2">
        <div class="text-xs font-bold">Which hat fits you?</div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="hat in hatOptions"
            :key="hat.id"
            type="button"
            class="btn btn-sm rounded-xl gap-1.5"
            :class="selectedHats.includes(hat.id) ? 'btn-primary' : 'btn-ghost border border-base-300'"
            @click="toggleHat(hat.id)"
          >
            <span>{{ hat.icon }}</span>
            <span>{{ hat.title }}</span>
          </button>
        </div>
      </div>
      <div class="flex flex-col gap-1 w-full">
        <label class="text-xs font-bold whitespace-normal">Your name</label>
        <input v-model="name" type="text" maxlength="80" class="input input-bordered input-sm rounded-xl w-full" placeholder="Name or shop" />
      </div>
      <div class="flex flex-col gap-1 w-full">
        <label class="text-xs font-bold whitespace-normal">Your email</label>
        <input v-model="email" type="email" autocomplete="email" class="input input-bordered input-sm rounded-xl w-full" placeholder="you@example.com" />
      </div>
      <div class="flex flex-col gap-1 w-full">
        <label class="text-xs font-bold whitespace-normal">What do you curate, create or want to help with?</label>
        <textarea v-model="note" maxlength="500" class="textarea textarea-bordered rounded-xl text-xs h-20 w-full" placeholder="Vintage TTRPG, jewelry, reels, booth restocking..."></textarea>
      </div>
      <p class="text-[11px] text-base-content/60">
        We email you a one-time code to confirm your address. Your email is only used to reply to this request.
      </p>
      <p v-if="errorMsg" class="text-xs text-error break-words">{{ errorMsg }}</p>
      <div class="flex justify-end gap-2 pt-3 border-t border-base-200">
        <button type="button" class="btn btn-sm btn-ghost rounded-xl" @click="emit('close')">Close</button>
        <button type="button" class="btn btn-sm btn-primary rounded-xl font-black" :disabled="busy" @click="sendCode">
          <span v-if="busy" class="loading loading-spinner loading-xs"></span>
          Email Me a Code
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { JOIN_REQUEST_HATS, type JoinRequestHat } from '../../lib/joinRequests';

interface HatOption {
  id: string;
  icon: string;
  title: string;
}

const props = defineProps<{ hats: readonly HatOption[] }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const hatOptions = computed(() => props.hats.filter((h) => (JOIN_REQUEST_HATS as readonly string[]).includes(h.id)));

const step = ref<'form' | 'code' | 'done'>('form');
const busy = ref(false);
const errorMsg = ref('');
const alreadyReviewed = ref(false);

const selectedHats = ref<string[]>([]);
const name = ref('');
const email = ref('');
const note = ref('');
const code = ref('');
const tempUserId = ref('');

const toggleHat = (id: string) => {
  selectedHats.value = selectedHats.value.includes(id)
    ? selectedHats.value.filter((h) => h !== id)
    : [...selectedHats.value, id];
};

const backToForm = () => {
  errorMsg.value = '';
  code.value = '';
  step.value = 'form';
};

const sendCode = async () => {
  errorMsg.value = '';
  if (selectedHats.value.length === 0) return (errorMsg.value = 'Pick at least one hat.');
  if (!name.value.trim()) return (errorMsg.value = 'Please enter your name.');
  if (!/^\S+@\S+\.\S+$/.test(email.value.trim())) return (errorMsg.value = 'Please enter a valid email.');
  busy.value = true;
  try {
    const res = await fetch('/api/join-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send_code',
        email: email.value.trim(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.userId) {
      throw new Error(data?.error || 'Could not send the code. Please try again.');
    }
    tempUserId.value = data.userId;
    step.value = 'code';
  } catch (err: any) {
    errorMsg.value = err?.message || 'Could not send the code. Please try again.';
  } finally {
    busy.value = false;
  }
};

const verifyAndSubmit = async () => {
  errorMsg.value = '';
  busy.value = true;
  try {
    const res = await fetch('/api/join-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'verify',
        userId: tempUserId.value,
        code: code.value.trim(),
        name: name.value,
        note: note.value,
        hats: selectedHats.value as JoinRequestHat[],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'That code did not work. Please try again.');
    alreadyReviewed.value = !!data.alreadyReviewed;
    step.value = 'done';
  } catch (err: any) {
    errorMsg.value = err?.message || 'That code did not work. Please try again.';
  } finally {
    busy.value = false;
  }
};
</script>

