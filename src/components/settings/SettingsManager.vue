<template>
  <div class="space-y-8">
    <div v-if="!currentTeam" class="alert alert-info">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      <span>You are currently in your <strong>Personal Inventory</strong>. Some settings are only available when working within a Team/Workspace.</span>
    </div>

    <!-- UPC Settings -->
    <div class="card bg-base-100 shadow-xl border border-base-200">
      <div class="card-body">
        <h2 class="card-title text-xl mb-4">Inventory UID Settings</h2>
        
        <form @submit.prevent="saveSettings" class="space-y-6 max-w-lg">
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text font-bold">Custom UPC / SKU Prefix</span>
            </label>
            <input 
              type="text" 
              v-model="form.upcPrefix" 
              placeholder="e.g. HUCK- or ORG-" 
              class="input input-bordered w-full bg-base-200" 
              :disabled="loading"
            />
            <label class="label">
              <span class="label-text-alt opacity-70">Used to automatically generate unique readable IDs for your items (e.g. {{ form.upcPrefix || 'HUCK-' }}0001).</span>
            </label>
          </div>

          <div class="mt-4 flex gap-2">
            <button type="submit" class="btn btn-primary px-8" :disabled="loading || saving">
              <span v-if="saving" class="loading loading-spinner loading-sm"></span>
              Save Settings
            </button>
          </div>
          
          <div v-if="message" class="text-success text-sm font-bold mt-2">
            {{ message }}
          </div>
          <div v-if="error" class="text-error text-sm font-bold mt-2">
            {{ error }}
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useAuth } from '../../composables/useAuth';

const { currentTeam, user, updateTeamPrefs, updatePrefs } = useAuth();
const loading = ref(false);
const saving = ref(false);
const message = ref('');
const error = ref('');

const form = ref({
  upcPrefix: ''
});

const loadSettings = () => {
  if (currentTeam.value) {
    form.value.upcPrefix = currentTeam.value.prefs?.upcPrefix || '';
  } else if (user.value) {
    form.value.upcPrefix = user.value.prefs?.upcPrefix || '';
  }
};

const saveSettings = async () => {
  saving.value = true;
  message.value = '';
  error.value = '';
  try {
    if (currentTeam.value) {
      console.log('Saving for team:', currentTeam.value);
      if (!currentTeam.value.$id) {
          throw new Error("currentTeam.$id is undefined. Payload: " + JSON.stringify(currentTeam.value));
      }
      const currentPrefs = currentTeam.value.prefs || {};
      await updateTeamPrefs(currentTeam.value.$id, {
        ...currentPrefs,
        upcPrefix: form.value.upcPrefix
      });
    } else {
      const currentPrefs = user.value?.prefs || {};
      await updatePrefs({
        ...currentPrefs,
        upcPrefix: form.value.upcPrefix
      });
    }
    message.value = 'Settings saved successfully!';
    setTimeout(() => { message.value = ''; }, 3000);
  } catch (err: any) {
    console.error('Failed to save settings:', err);
    error.value = err.message || 'Failed to save settings.';
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  loadSettings();
});

watch(currentTeam, () => {
  loadSettings();
});
</script>
