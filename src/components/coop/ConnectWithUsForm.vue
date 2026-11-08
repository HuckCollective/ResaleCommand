<template>
  <div class="space-y-4">
    <!-- Done state -->
    <div v-if="step === 'done'" class="space-y-3 text-center py-4">
      <div class="text-4xl">🎉</div>
      <h4 class="font-black text-base">Request received!</h4>
      <p class="text-sm text-base-content/70 break-words">
        Your request is now in our Co-op Governance queue. A member will review it and reach out by email if it is a fit!
      </p>
      <button type="button" class="btn btn-sm btn-primary rounded-xl font-black" @click="emit('close')">Close</button>
    </div>

    <!-- Form state -->
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
      <!-- Hidden honeypot -->
      <input v-model="website" type="text" tabindex="-1" autocomplete="off" class="hidden" aria-hidden="true" />
      <p class="text-[11px] text-base-content/60">
        Your request goes straight to our co-op stewards. Your email is only used to reply to this inquiry.
      </p>
      <p v-if="errorMsg" class="text-xs text-error break-words">{{ errorMsg }}</p>
      <div class="flex justify-end gap-2 pt-3 border-t border-base-200">
        <button type="button" class="btn btn-sm btn-ghost rounded-xl" @click="emit('close')">Close</button>
        <button type="button" class="btn btn-sm btn-primary rounded-xl font-black" :disabled="busy" @click="submitRequest">
          <span v-if="busy" class="loading loading-spinner loading-xs"></span>
          Send Request
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

const step = ref<'form' | 'done'>('form');
const busy = ref(false);
const errorMsg = ref('');

const selectedHats = ref<string[]>([]);
const name = ref('');
const email = ref('');
const note = ref('');
const website = ref('');

const toggleHat = (id: string) => {
  selectedHats.value = selectedHats.value.includes(id)
    ? selectedHats.value.filter((h) => h !== id)
    : [...selectedHats.value, id];
};

const submitRequest = async () => {
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
        name: name.value.trim(),
        email: email.value.trim(),
        note: note.value.trim(),
        hats: selectedHats.value as JoinRequestHat[],
        website: website.value,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Could not save your request.');
    step.value = 'done';
  } catch (err: any) {
    errorMsg.value = err?.message || 'Could not save your request. Please try again.';
  } finally {
    busy.value = false;
  }
};
</script>
