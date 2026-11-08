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
import { databases } from '../../lib/appwrite';
import { getDatabaseId } from '../../lib/appwriteEnv';
import {
  JOIN_REQUEST_HATS,
  JOIN_REQUEST_LIMITS,
  JOIN_REQUEST_LOCATION_ID,
  JOIN_REQUEST_STATUS,
  type JoinRequestHat,
} from '../../lib/joinRequests';

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

async function buildJoinDocId(cleanEmail: string): Promise<string> {
  const bytes = new TextEncoder().encode(cleanEmail);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `join_${hex.slice(0, 28)}`;
}

const submitRequest = async () => {
  errorMsg.value = '';
  if (selectedHats.value.length === 0) return (errorMsg.value = 'Pick at least one hat.');
  if (!name.value.trim()) return (errorMsg.value = 'Please enter your name.');
  if (!/^\S+@\S+\.\S+$/.test(email.value.trim())) return (errorMsg.value = 'Please enter a valid email.');
  if (website.value.trim()) {
    step.value = 'done';
    return;
  }

  busy.value = true;
  try {
    const cleanName = name.value.trim().slice(0, JOIN_REQUEST_LIMITS.name);
    const cleanEmail = email.value.trim().toLowerCase().slice(0, JOIN_REQUEST_LIMITS.email);
    const cleanNote = note.value.trim().slice(0, JOIN_REQUEST_LIMITS.note);
    const hats = selectedHats.value as JoinRequestHat[];

    const docId = await buildJoinDocId(cleanEmail);
    const docData = {
      name: `Join request: ${cleanName}`.slice(0, 120),
      tenantId: 'system',
      locationId: JOIN_REQUEST_LOCATION_ID,
      locationName: 'Join Requests',
      status: JOIN_REQUEST_STATUS.pending,
      itemCount: 0,
      itemsSnapshot: JSON.stringify({
        name: cleanName,
        email: cleanEmail,
        hats,
        note: cleanNote,
        requestedAt: new Date().toISOString(),
      }),
      notes: '',
    };

    const dbId = getDatabaseId();
    try {
      await databases.createDocument(dbId, 'manifests', docId, docData);
    } catch (err: any) {
      if (err?.code === 409) {
        await databases.updateDocument(dbId, 'manifests', docId, docData);
      } else {
        throw err;
      }
    }

    // Trigger server-side Appwrite Messaging (`coop-founders` Topic email via Porkbun SMTP)
    fetch('/api/join-request', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: cleanName,
        email: cleanEmail,
        note: cleanNote,
        hats,
        website: website.value,
      }),
    }).catch(() => {});

    step.value = 'done';
  } catch (err: any) {
    errorMsg.value = err?.message || 'Could not save your request. Please try again.';
  } finally {
    busy.value = false;
  }
};
</script>
