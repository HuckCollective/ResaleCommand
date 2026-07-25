<template>
  <div class="flex min-h-screen items-center justify-center bg-base-200 px-4 py-12 sm:px-6 lg:px-8">
    <div class="card w-full max-w-md bg-base-100 shadow-2xl">
      <div class="card-body">
        <h2 class="card-title text-3xl font-bold justify-center mb-6">
          Sign in to your account
          <span v-if="isDevLogin" class="badge badge-primary badge-sm mt-1 absolute top-4 right-4">Dev Mode</span>
        </h2>
        
        <form @submit.prevent="submit" class="space-y-4">
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text font-medium">Email address</span>
            </label>
            <input 
              type="email" 
              v-model="email" 
              required 
              placeholder="you@example.com" 
              class="input input-bordered w-full" 
            />
          </div>

          <div class="form-control w-full">
            <label class="label">
              <span class="label-text font-medium">Password</span>
            </label>
            <input 
              type="password" 
              v-model="password" 
              required 
              placeholder="••••••••" 
              class="input input-bordered w-full" 
            />
          </div>

          <div class="flex items-center justify-between text-sm mt-2">
            <a :href="signupLink" class="link link-primary link-hover">Don't have an account? Sign up</a>
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
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>{{ error }}</span>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue';
import { useAuth } from '../../composables/useAuth';

const auth = useAuth();
const email = ref(import.meta.env.PUBLIC_TEST_USER_EMAIL || '');
const password = ref(import.meta.env.PUBLIC_TEST_USER_PASSWORD || '');
const loading = ref(false);
const error = ref('');

const isDevLogin = computed(() => !!import.meta.env.PUBLIC_TEST_USER_EMAIL);

// Auto-redirect if already logged in
watchEffect(() => {
    if (auth.isAuthenticated.value && typeof window !== 'undefined') {
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

const submit = async () => {
    loading.value = true;
    error.value = '';
    try {
        await auth.login(email.value, password.value);
        
        // Handle redirect
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
