<template>
  <div v-if="loading" class="space-y-6 py-6">
    <div class="skeleton h-32 w-full rounded-2xl"></div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="skeleton h-64 w-full rounded-2xl"></div>
      <div class="skeleton h-64 w-full rounded-2xl"></div>
    </div>
  </div>

  <div v-else-if="!isAuthenticated" class="alert alert-warning">
    <span>Please login to view profile settings.</span>
  </div>

  <div v-else class="space-y-8">
    <!-- User Overview Card -->
    <div class="card bg-base-100 shadow-xl border border-base-200">
      <div class="card-body flex-col md:flex-row gap-6 items-center">
        <!-- Avatar Column -->
        <div class="avatar placeholder">
          <div class="bg-primary text-primary-content rounded-full w-24 ring ring-primary ring-offset-base-100 ring-offset-2">
            <span class="text-3xl font-bold">{{ userInitial }}</span>
          </div>
        </div>
        
        <!-- Info Column -->
        <div class="flex-1 text-center md:text-left space-y-2">
          <div class="flex flex-col md:flex-row md:items-center gap-2 flex-wrap">
            <h2 class="text-2xl font-bold">{{ user?.name || 'Unnamed User' }}</h2>
            <div class="flex flex-wrap gap-2 justify-center md:justify-start">
              <span
                v-if="capabilitiesResolved"
                class="badge badge-primary text-primary-content font-black whitespace-nowrap shrink-0"
              >
                {{ capabilities.roleBadge }}
              </span>
              <span
                v-if="capabilitiesResolved && capabilities.prefixStatus === 'locked' && capabilities.prefix"
                class="badge badge-outline font-mono font-bold whitespace-nowrap shrink-0"
                title="Physical barcode sticker prefix locked to your account"
              >
                🔒 {{ capabilities.prefix }}
              </span>
              <span
                v-else-if="capabilitiesResolved && capabilities.prefixStatus === 'requested' && capabilities.requestedPrefix"
                class="badge badge-warning text-warning-content font-mono font-bold whitespace-nowrap shrink-0"
                title="Waiting for Account Steward to lock your requested barcode prefix"
              >
                ⏳ Requested: {{ capabilities.requestedPrefix }}
              </span>
              <span
                v-else-if="capabilitiesResolved && !capabilities.isConsignor"
                class="badge badge-warning badge-outline font-bold whitespace-nowrap shrink-0"
              >
                ⚡ Pick Your SKU Below
              </span>
              <span
                v-if="currentTeam?.name"
                class="badge badge-ghost border border-base-300 font-semibold whitespace-nowrap shrink-0"
              >
                {{ currentTeam.name }}
              </span>
              <span v-if="user?.labels?.includes('alpha')" class="badge badge-warning text-warning-content font-semibold whitespace-nowrap shrink-0">Alpha</span>
            </div>
          </div>
          <p class="text-base-content/70 font-mono text-sm">{{ user?.email }}</p>
          <div class="flex flex-wrap items-center gap-3 justify-center md:justify-start text-xs text-base-content/65">
            <span>Joined: {{ new Date(user?.$createdAt || '').toLocaleDateString() }}</span>
            <a
              v-if="capabilitiesResolved && capabilities.canViewCollectiveTools"
              href="/coop/governance?tab=roster"
              class="link link-primary font-bold"
            >
              View Collective Roster &amp; Member Hats ➔
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- Curator Unique Barcode Prefix (SKU) Card -->
    <div
      v-if="capabilitiesResolved && !capabilities.isConsignor"
      class="card bg-base-100 shadow-xl border-2"
      :class="capabilities.prefixStatus === 'locked' ? 'border-base-200' : 'border-warning/50'"
    >
      <div class="card-body space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="font-bold text-lg flex items-center gap-2">
                <Icon icon="solar:tag-horizontal-bold-duotone" class="w-5 h-5 text-primary shrink-0" />
                <span>My Curator Barcode Prefix (SKU)</span>
              </h3>
              <span
                v-if="capabilities.prefixStatus === 'locked' && capabilities.prefix"
                class="badge badge-success text-success-content font-mono font-black whitespace-nowrap"
              >
                🔒 {{ capabilities.prefix }} Locked
              </span>
              <span
                v-else-if="capabilities.prefixStatus === 'requested' && capabilities.requestedPrefix"
                class="badge badge-warning text-warning-content font-mono font-black whitespace-nowrap"
              >
                ⏳ Pending Lock: {{ capabilities.requestedPrefix }}
              </span>
              <span v-else class="badge badge-warning text-warning-content font-bold whitespace-nowrap">
                ⚡ Setup Required Before Placing Items
              </span>
            </div>
            <p class="text-xs text-base-content/70 mt-1 leading-relaxed">
              Every Curator gets a globally unique barcode prefix for their inventory, purchases, and payouts. Your SKU prefix must be locked by an Account Steward before placing products in booths or printing physical shelf stickers.
            </p>
          </div>
          <button
            v-if="capabilities.prefixStatus === 'locked' && !showChangePrefixForm"
            type="button"
            class="btn btn-xs h-11 md:h-8 btn-ghost border border-base-300 rounded-xl font-bold shrink-0 self-start sm:self-center"
            @click="showChangePrefixForm = true"
          >
            Request Prefix Change
          </button>
        </div>

        <div
          v-if="capabilities.prefixStatus === 'locked' && !showChangePrefixForm"
          class="rounded-xl bg-base-200/50 border border-base-300 p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
        >
          <div class="space-y-0.5">
            <div class="font-bold text-base-content">
              Active shelf tag format:
              <span class="font-mono font-black text-primary ml-1">{{ capabilities.prefix }}0001</span>
            </div>
            <div v-if="capabilities.requestedPrefix && capabilities.requestedPrefix !== capabilities.prefix" class="text-warning font-semibold">
              ⏳ Requested change to <span class="font-mono font-black">{{ capabilities.requestedPrefix }}</span> is waiting on Account Steward review.
            </div>
            <div v-else-if="capabilities.ownedPrefixes.length > 1" class="text-base-content/65">
              Earlier tag prefixes still credited to you:
              <span class="font-mono font-bold">{{ capabilities.ownedPrefixes.filter((p) => p !== capabilities.prefix).join(', ') }}</span>
            </div>
          </div>
        </div>

        <form
          v-else
          class="rounded-2xl bg-base-200/40 border border-base-300 p-3.5 sm:p-4 space-y-3"
          @submit.prevent="handleRequestPrefix"
        >
          <div v-if="capabilities.prefixStatus === 'locked'" class="alert alert-info py-2 px-3 rounded-xl text-xs">
            <span>
              <strong>Physical Sticker Safety:</strong> Changing your prefix only affects future items. Any stickers already printed on booth shelves keep their existing barcode and still pay out to you.
            </span>
          </div>

          <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div class="space-y-1">
              <label class="label py-0">
                <span class="label-text text-xs font-bold">Choose 2–6 letters or numbers (hyphen is added automatically)</span>
              </label>
              <div class="flex items-center gap-3 flex-wrap">
                <div class="join">
                  <input
                    :value="rawPrefixDraft"
                    type="text"
                    maxlength="6"
                    placeholder="DOM"
                    aria-label="Curator SKU Prefix Code"
                    class="input input-bordered join-item h-11 md:h-9 w-28 font-mono font-black uppercase text-sm tracking-wider"
                    :disabled="savingPrefix"
                    @input="onPrefixDraftInput(($event.target as HTMLInputElement).value)"
                  />
                  <span class="btn btn-neutral no-animation pointer-events-none join-item h-11 md:h-9 px-3 font-mono font-black text-sm">
                    -
                  </span>
                </div>
                <span v-if="sanitizedDraftRoot.length >= 2" class="badge badge-outline font-mono font-bold py-3 px-3">
                  Preview: {{ sanitizedDraftRoot }}-0001
                </span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button
                v-if="showChangePrefixForm"
                type="button"
                class="btn btn-ghost btn-sm h-11 md:h-9 rounded-xl font-bold"
                :disabled="savingPrefix"
                @click="showChangePrefixForm = false"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="btn btn-primary text-primary-content btn-sm h-11 md:h-9 rounded-xl font-black gap-1.5 px-4"
                :disabled="savingPrefix || sanitizedDraftRoot.length < 2"
              >
                <span v-if="savingPrefix" class="loading loading-spinner loading-xs"></span>
                <span>{{ capabilities.prefixStatus === 'locked' ? 'Submit Change Request' : 'Request My SKU Prefix' }}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <!-- Left Column: Name & Email -->
      <div class="space-y-8">
        <!-- Profile Info Card -->
        <div class="card bg-base-100 shadow-xl border border-base-200">
          <div class="card-body">
            <h3 class="font-bold text-lg mb-2 flex items-center gap-2">
              <Icon icon="solar:user-id-linear" class="w-5 h-5 text-primary" />
              Profile Information
            </h3>
            
            <div class="form-control w-full">
              <label class="label">
                <span class="label-text font-bold">Display Name</span>
              </label>
              <input 
                type="text" 
                v-model="editName" 
                placeholder="Your Name" 
                class="input input-bordered h-11 md:h-10 w-full"
                :disabled="savingName"
              />
            </div>
            
            <div class="card-actions justify-end mt-4">
              <button 
                class="btn btn-primary btn-sm h-11 md:h-9 gap-2 font-black" 
                @click="handleUpdateName" 
                :disabled="savingName || !editName.trim() || editName.trim() === user?.name"
              >
                <span v-if="savingName" class="loading loading-spinner loading-xs"></span>
                <Icon icon="solar:disk-linear" class="w-4 h-4" />
                Save Name
              </button>
            </div>
          </div>
        </div>

        <!-- Change Email Card -->
        <div class="card bg-base-100 shadow-xl border border-base-200">
          <div class="card-body">
            <h3 class="font-bold text-lg mb-2 flex items-center gap-2">
              <Icon icon="solar:letter-linear" class="w-5 h-5 text-primary" />
              Change Email
            </h3>
            <p class="text-xs text-base-content/70 mb-2">Note: Changing your email will update your login credentials.</p>

            <div class="space-y-4">
              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text font-bold">New Email Address</span>
                </label>
                <input 
                  type="email" 
                  autocomplete="email"
                  autocapitalize="none"
                  v-model="editEmail" 
                  placeholder="name@example.com" 
                  class="input input-bordered h-11 md:h-10 w-full"
                  :disabled="savingEmail"
                />
              </div>

              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text font-bold">Current Password</span>
                </label>
                <input 
                  type="password" 
                  autocomplete="current-password"
                  v-model="emailConfirmPassword" 
                  placeholder="Enter current password to verify" 
                  class="input input-bordered h-11 md:h-10 w-full"
                  :disabled="savingEmail"
                />
              </div>
            </div>

            <div class="card-actions justify-end mt-4">
              <button 
                class="btn btn-outline btn-primary btn-sm h-11 md:h-9 gap-2 font-bold" 
                @click="handleUpdateEmail" 
                :disabled="savingEmail || !editEmail.trim() || !emailConfirmPassword || editEmail.trim().toLowerCase() === (user?.email || '').toLowerCase()"
              >
                <span v-if="savingEmail" class="loading loading-spinner loading-xs"></span>
                <Icon icon="solar:check-read-linear" class="w-4 h-4" />
                Update Email
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Password -->
      <div>
        <!-- Change Password Card -->
        <div class="card bg-base-100 shadow-xl border border-base-200 h-full">
          <div class="card-body flex flex-col justify-between">
            <div>
              <h3 class="font-bold text-lg mb-2 flex items-center gap-2">
                <Icon icon="solar:lock-password-linear" class="w-5 h-5 text-primary" />
                Change Password
              </h3>
              <p class="text-xs text-base-content/70 mb-4">Ensure your account is using a long, random password to stay secure.</p>

              <div class="space-y-4">
                <div class="form-control w-full">
                  <label class="label">
                    <span class="label-text font-bold">Current Password</span>
                  </label>
                  <input 
                    type="password" 
                    autocomplete="current-password"
                    v-model="oldPassword" 
                    placeholder="Enter current password" 
                    class="input input-bordered h-11 md:h-10 w-full"
                    :disabled="savingPassword"
                  />
                </div>

                <div class="form-control w-full">
                  <label class="label">
                    <span class="label-text font-bold">New Password</span>
                  </label>
                  <input 
                    type="password" 
                    autocomplete="new-password"
                    v-model="newPassword" 
                    placeholder="Enter new password" 
                    class="input input-bordered h-11 md:h-10 w-full"
                    :disabled="savingPassword"
                  />
                </div>

                <div class="form-control w-full">
                  <label class="label">
                    <span class="label-text font-bold">Confirm New Password</span>
                  </label>
                  <input 
                    type="password" 
                    autocomplete="new-password"
                    v-model="confirmPassword" 
                    placeholder="Re-enter new password" 
                    class="input input-bordered h-11 md:h-10 w-full"
                    :disabled="savingPassword"
                  />
                </div>
              </div>
            </div>

            <div class="card-actions justify-end mt-6">
              <button 
                class="btn btn-outline btn-primary btn-sm h-11 md:h-9 gap-2 font-bold" 
                @click="handleUpdatePassword" 
                :disabled="savingPassword || !oldPassword || !newPassword || !confirmPassword"
              >
                <span v-if="savingPassword" class="loading loading-spinner loading-xs"></span>
                <Icon icon="solar:key-linear" class="w-4 h-4" />
                Update Password
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useAuth } from '../../composables/useAuth';
import { useMemberCapabilities } from '../../lib/memberAccess';
import { sanitizePrefixRootInput } from '../../lib/coopGovernance';
import { getCoopJwtHeaders } from '../../lib/coopLedgerClient';
import { addToast } from '../../stores/toast';
import { toUserMessage } from '../../lib/userFacingErrors';
import { Icon } from '@iconify/vue';

const { user, currentTeam, isAuthenticated, loading, updateName, updateEmail, updatePassword } = useAuth();
const { capabilities, capabilitiesResolved, refreshCapabilities } = useMemberCapabilities();

// Profile Edit States
const editName = ref('');
const editEmail = ref('');
const emailConfirmPassword = ref('');
const oldPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const rawPrefixDraft = ref('');
const savingPrefix = ref(false);
const showChangePrefixForm = ref(false);

const sanitizedDraftRoot = computed(() => sanitizePrefixRootInput(rawPrefixDraft.value));

function onPrefixDraftInput(val: string) {
  rawPrefixDraft.value = sanitizePrefixRootInput(val);
}

async function handleRequestPrefix() {
  const root = sanitizedDraftRoot.value;
  if (root.length < 2) return;
  savingPrefix.value = true;
  try {
    const headers = await getCoopJwtHeaders();
    const res = await fetch('/api/coop/prefix-request', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'request', prefix: root }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || 'Could not submit SKU prefix request.');
    }
    await refreshCapabilities();
    showChangePrefixForm.value = false;
    addToast({
      type: 'success',
      message: `Requested ${root}- as your unique Curator SKU! An Account Steward can now lock it in 1 click.`,
    });
  } catch (err: any) {
    addToast({
      type: 'error',
      message: toUserMessage(err, 'Could not submit SKU prefix request.'),
    });
  } finally {
    savingPrefix.value = false;
  }
}

// Button loading states
const savingName = ref(false);
const savingEmail = ref(false);
const savingPassword = ref(false);

const userInitial = computed(() => {
  return user.value && user.value.name ? user.value.name.charAt(0).toUpperCase() : '?';
});

// Initialize form fields once user is loaded
const initForm = () => {
  if (user.value) {
    editName.value = user.value.name || '';
    editEmail.value = user.value.email || '';
  }
};

onMounted(() => {
  initForm();
});

watch(user, () => {
  initForm();
}, { immediate: true });

// Actions
const handleUpdateName = async () => {
  const nameToSave = editName.value.trim();
  if (!nameToSave) return;
  savingName.value = true;
  try {
    await updateName(nameToSave);
    addToast({ type: 'success', message: 'Name updated successfully!' });
  } catch (error: any) {
    addToast({ type: 'error', message: toUserMessage(error, 'Failed to update name.') });
  } finally {
    savingName.value = false;
  }
};

const handleUpdateEmail = async () => {
  const emailToSave = editEmail.value.trim().toLowerCase();
  const password = emailConfirmPassword.value;
  if (!emailToSave || !password) return;
  savingEmail.value = true;
  try {
    await updateEmail(emailToSave, password);
    emailConfirmPassword.value = '';
    addToast({ type: 'success', message: 'Email updated successfully!' });
  } catch (error: any) {
    addToast({ type: 'error', message: toUserMessage(error, 'Failed to update email.') });
  } finally {
    savingEmail.value = false;
  }
};

const handleUpdatePassword = async () => {
  const oldPass = oldPassword.value;
  const newPass = newPassword.value;
  const confirmPass = confirmPassword.value;

  if (!oldPass || !newPass || !confirmPass) return;
  
  if (newPass !== confirmPass) {
    addToast({ type: 'warning', message: 'New passwords do not match.' });
    return;
  }

  if (newPass.length < 8) {
    addToast({ type: 'warning', message: 'New password must be at least 8 characters long.' });
    return;
  }

  savingPassword.value = true;
  try {
    await updatePassword(newPass, oldPass);
    oldPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
    addToast({ type: 'success', message: 'Password updated successfully!' });
  } catch (error: any) {
    addToast({ type: 'error', message: toUserMessage(error, 'Failed to update password.') });
  } finally {
    savingPassword.value = false;
  }
};
</script>
