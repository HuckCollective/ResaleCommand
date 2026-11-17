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
          <div class="flex flex-col md:flex-row md:items-center gap-2">
            <h2 class="text-2xl font-bold">{{ user?.name || 'Unnamed User' }}</h2>
            <div class="flex gap-2 justify-center md:justify-start">
              <span v-if="isPartner" class="badge badge-secondary font-semibold whitespace-nowrap shrink-0">Partner</span>
              <span v-if="user?.labels?.includes('alpha')" class="badge badge-warning font-semibold whitespace-nowrap shrink-0">Alpha</span>
            </div>
          </div>
          <p class="text-base-content/70 font-mono text-sm">{{ user?.email }}</p>
          <div class="flex flex-wrap gap-2 justify-center md:justify-start text-xs text-base-content/60">
            <span>Joined: {{ new Date(user?.$createdAt || '').toLocaleDateString() }}</span>
          </div>
        </div>
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
                class="input input-bordered w-full"
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
                  class="input input-bordered w-full"
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
                  class="input input-bordered w-full"
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
                    class="input input-bordered w-full"
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
                    class="input input-bordered w-full"
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
                    class="input input-bordered w-full"
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
import { addToast } from '../../stores/toast';
import { toUserMessage } from '../../lib/userFacingErrors';
import { Icon } from '@iconify/vue';

const { user, isAuthenticated, loading, isPartner, updateName, updateEmail, updatePassword } = useAuth();

// Profile Edit States
const editName = ref('');
const editEmail = ref('');
const emailConfirmPassword = ref('');
const oldPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');

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
