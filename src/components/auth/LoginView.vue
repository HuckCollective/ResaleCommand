<template>
  <div class="flex min-h-screen items-center justify-center bg-base-200 px-4 py-12 sm:px-6 lg:px-8">
    <div class="card w-full max-w-md bg-base-100 shadow-2xl">
      <div class="card-body">
        <div class="text-center space-y-1 mb-5">
          <div class="flex items-center justify-center gap-1.5">
            <h1 class="text-2xl sm:text-3xl font-black tracking-tight text-primary">{{ siteConfig.shortTitle }}</h1>
            <span class="badge badge-primary badge-outline badge-sm font-mono font-black whitespace-nowrap shrink-0">{{ siteConfig.badgeText }}</span>
          </div>
          <p class="text-xs font-semibold text-base-content/70">{{ siteConfig.subtitle }}</p>
          <span v-if="isDevLogin" class="badge badge-primary badge-sm mt-1 absolute top-4 right-4">Dev Mode</span>
        </div>

        <div v-if="notice" class="alert alert-success text-xs sm:text-sm font-semibold mb-3 p-3">
          <span>{{ notice }}</span>
        </div>

        <!-- MODE 1: STANDARD SIGN IN -->
        <form v-if="mode === 'login'" @submit.prevent="submit" class="space-y-4">
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text font-medium">Email address</span>
            </label>
            <input
              type="email"
              autocomplete="email"
              autocapitalize="none"
              v-model="email"
              required
              placeholder="you@example.com"
              class="input input-bordered w-full"
            />
          </div>

          <div class="form-control w-full">
            <label class="label justify-between">
              <span class="label-text font-medium">Password</span>
              <button
                type="button"
                class="link link-primary link-hover text-xs font-bold"
                @click="openForgotMode"
              >
                Forgot / Set password?
              </button>
            </label>
            <input
              type="password"
              autocomplete="current-password"
              v-model="password"
              required
              placeholder="••••••••"
              class="input input-bordered w-full"
            />
          </div>

          <div class="flex flex-wrap items-center justify-between gap-2 text-sm mt-2">
            <a v-if="hasInviteRedirect" :href="signupLink" class="link link-primary link-hover font-bold">Have an invitation? Create your account</a>
            <template v-else>
              <a :href="signupLink" class="link link-primary link-hover font-bold">Need an account? Request an invitation →</a>
              <a href="/coop" class="link link-hover text-xs text-base-content/70">Collective Charter</a>
            </template>
          </div>

          <div class="form-control mt-6">
            <button
              type="submit"
              class="btn btn-primary w-full"
              :disabled="loading"
            >
              <span v-if="loading" class="loading loading-spinner loading-sm"></span>
              <span v-else>Sign in</span>
            </button>
          </div>

          <div v-if="error" class="alert alert-error shadow-lg mt-4 text-sm p-3">
            <span>{{ error }}</span>
          </div>
        </form>

        <!-- MODE 2: REQUEST PASSWORD SETUP / RESET EMAIL -->
        <form v-else-if="mode === 'forgot'" @submit.prevent="sendPasswordReset" class="space-y-4">
          <div class="text-sm font-bold text-base-content">Forgot or Need to Set a Password?</div>
          <p class="text-xs text-base-content/70 leading-relaxed">
            Enter your Collective member email and we will send you a one-click link to choose your password.
          </p>

          <div class="form-control w-full">
            <label class="label">
              <span class="label-text font-medium">Member Email</span>
            </label>
            <input
              type="email"
              autocomplete="email"
              autocapitalize="none"
              v-model="email"
              required
              placeholder="you@example.com"
              class="input input-bordered w-full"
            />
          </div>

          <div class="flex items-center justify-between gap-2 pt-2">
            <button type="button" class="btn btn-ghost btn-sm font-bold" @click="mode = 'login'; error = ''">
              ← Back to Sign In
            </button>
            <button type="submit" class="btn btn-primary btn-sm font-black px-4" :disabled="sendingReset">
              <span v-if="sendingReset" class="loading loading-spinner loading-xs"></span>
              <span v-else>Send Setup Link</span>
            </button>
          </div>

          <div v-if="error" class="alert alert-error text-sm p-3">
            <span>{{ error }}</span>
          </div>
        </form>

        <!-- MODE 3: FINISH PASSWORD RESET / SETUP (?userId=...&secret=...) -->
        <form v-else @submit.prevent="completePasswordReset" class="space-y-4">
          <div class="text-sm font-bold text-base-content">Choose Your New Password</div>
          <p class="text-xs text-base-content/70">Pick a password of at least 8 characters for future sign-ins.</p>

          <div class="form-control w-full">
            <label class="label"><span class="label-text font-medium">New Password</span></label>
            <input
              type="password"
              autocomplete="new-password"
              v-model="newPassword"
              required
              minlength="8"
              placeholder="••••••••"
              class="input input-bordered w-full"
            />
          </div>

          <div class="form-control w-full">
            <label class="label"><span class="label-text font-medium">Confirm Password</span></label>
            <input
              type="password"
              autocomplete="new-password"
              v-model="confirmNewPassword"
              required
              minlength="8"
              placeholder="••••••••"
              class="input input-bordered w-full"
            />
          </div>

          <div class="form-control mt-4">
            <button type="submit" class="btn btn-primary w-full font-black" :disabled="savingRecovery">
              <span v-if="savingRecovery" class="loading loading-spinner loading-sm"></span>
              <span v-else>Save Password &amp; Continue</span>
            </button>
          </div>

          <div v-if="error" class="alert alert-error text-sm p-3">
            <span>{{ error }}</span>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watchEffect, onMounted } from 'vue';
import { account } from '../../lib/appwrite';
import { useAuth } from '../../composables/useAuth';
import { siteConfig } from '../../site-config';
import { toUserMessage } from '../../lib/userFacingErrors';

const auth = useAuth();
const email = ref(import.meta.env.DEV ? (import.meta.env.PUBLIC_TEST_USER_EMAIL || '') : '');
const password = ref(import.meta.env.DEV ? (import.meta.env.PUBLIC_TEST_USER_PASSWORD || '') : '');
const loading = ref(false);
const sendingReset = ref(false);
const savingRecovery = ref(false);
const error = ref('');
const notice = ref('');

type AuthMode = 'login' | 'forgot' | 'recovery';
const mode = ref<AuthMode>('login');
const recoveryUserId = ref('');
const recoverySecret = ref('');
const newPassword = ref('');
const confirmNewPassword = ref('');

const isDevLogin = computed(() => import.meta.env.DEV && !!import.meta.env.PUBLIC_TEST_USER_EMAIL);

// Membership is by invitation: only show "Sign up" when arriving from a /join invite link.
const hasInviteRedirect = ref(false);
onMounted(() => {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect') || '';
    hasInviteRedirect.value = redirect.includes('/join');

    const uid = params.get('userId') || '';
    const sec = params.get('secret') || '';
    if (uid && sec) {
        recoveryUserId.value = uid;
        recoverySecret.value = sec;
        mode.value = 'recovery';
    }
});

// Auto-redirect if already logged in (unless finishing recovery)
watchEffect(() => {
    if (auth.isAuthenticated.value && mode.value === 'login' && typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const redirect = urlParams.get('redirect');
        window.location.href = redirect || '/dashboard';
    }
});

// Preserve redirect query parameter for signup link
const signupLink = computed(() => {
    if (typeof window !== 'undefined') {
        return '/signup' + window.location.search;
    }
    return '/signup';
});

function openForgotMode() {
    error.value = '';
    notice.value = '';
    mode.value = 'forgot';
}

const sendPasswordReset = async () => {
    const cleanEmail = email.value.trim().toLowerCase();
    if (!cleanEmail) return;
    sendingReset.value = true;
    error.value = '';
    notice.value = '';
    try {
        await account.createRecovery({
            email: cleanEmail,
            url: `${window.location.origin}/login`,
        });
        notice.value = `If an account exists for ${cleanEmail}, we sent a password setup link. Check your inbox and click it to choose your password.`;
        mode.value = 'login';
    } catch (err: any) {
        error.value = toUserMessage(err, 'Could not send password setup link — please try again.');
    } finally {
        sendingReset.value = false;
    }
};

const completePasswordReset = async () => {
    error.value = '';
    if (newPassword.value.length < 8) {
        error.value = 'Password must be at least 8 characters long.';
        return;
    }
    if (newPassword.value !== confirmNewPassword.value) {
        error.value = 'Passwords do not match.';
        return;
    }
    savingRecovery.value = true;
    try {
        await account.updateRecovery({
            userId: recoveryUserId.value,
            secret: recoverySecret.value,
            password: newPassword.value,
        });
        window.history.replaceState({}, '', '/login');
        newPassword.value = '';
        confirmNewPassword.value = '';
        mode.value = 'login';
        notice.value = 'Password saved! Sign in below with your new password.';
    } catch (err: any) {
        error.value = toUserMessage(err, 'That setup link expired or is invalid — request a fresh link below.');
    } finally {
        savingRecovery.value = false;
    }
};

const submit = async () => {
    loading.value = true;
    error.value = '';
    notice.value = '';
    try {
        await auth.login(email.value.trim().toLowerCase(), password.value);

        const urlParams = new URLSearchParams(window.location.search);
        const redirect = urlParams.get('redirect');
        if (redirect) {
            window.location.href = redirect;
        } else {
            window.location.href = '/dashboard';
        }
    } catch (err: any) {
        console.error(err);
        error.value = err.message || 'Login failed. Please check your credentials.';
    } finally {
        loading.value = false;
    }
};
</script>
