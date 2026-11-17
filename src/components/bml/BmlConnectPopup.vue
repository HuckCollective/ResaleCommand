<template>
  <div class="max-w-md mx-auto">
    <div class="card bg-base-100 border border-primary/30 shadow-xl rounded-3xl p-5 sm:p-6 space-y-4">
      <div class="text-center space-y-1">
        <div class="inline-flex items-center gap-1.5 badge badge-primary text-primary-content font-bold text-xs px-3 py-1 whitespace-nowrap shrink-0">
          <Icon icon="solar:shield-check-bold" class="w-3.5 h-3.5 shrink-0" />
          <span>👑 Founder &amp; 💎 Curator Access</span>
        </div>
        <h1 class="text-xl sm:text-2xl font-black tracking-tight text-base-content pt-1">
          Connect {{ siteConfig.shortTitle }}
        </h1>
        <p class="text-xs text-base-content/70 leading-relaxed">
          Your sign-in stays strictly on <code class="font-mono font-bold">{{ hostLabel }}</code>—never inside a third-party site.
        </p>
      </div>

      <div v-if="rejectedTargetMsg" role="alert" class="p-4 rounded-2xl bg-error/10 border border-error/40 space-y-2 text-left">
        <div class="font-black text-sm text-error">Blocked Untrusted Return Link</div>
        <p class="text-xs text-base-content/85 leading-relaxed">{{ rejectedTargetMsg }}</p>
        <a href="/studios/bookmarklets" class="btn btn-sm h-11 btn-outline w-full rounded-xl font-bold">
          Open Bookmarklet Hub
        </a>
      </div>

      <div v-else-if="auth.loading.value || minting" class="py-8 text-center space-y-2.5">
        <span class="loading loading-spinner loading-lg text-primary"></span>
        <div class="text-xs font-bold text-base-content/75">
          {{ minting ? 'Verifying Founder / Curator hat & activating 14-day pass…' : 'Checking your Works@TheHC sign-in…' }}
        </div>
      </div>

      <div v-else-if="roleRestrictedMsg" class="space-y-4 text-center py-2">
        <div class="p-4 rounded-2xl bg-warning/15 border border-warning/40 space-y-1.5 text-left">
          <div class="font-black text-sm text-warning flex items-center gap-1.5">
            <span>🔒 Curator or Founder Hat Required</span>
          </div>
          <p class="text-xs text-base-content/80 leading-relaxed">
            {{ roleRestrictedMsg }}
          </p>
        </div>

        <button
          type="button"
          class="btn h-11 btn-primary text-primary-content w-full rounded-xl font-black gap-1.5"
          @click="handleSwitchAccount"
        >
          <span>🚪 Sign Out &amp; Switch Account</span>
        </button>
      </div>

      <div v-else-if="mintedToken && mintedMember" class="space-y-4 text-center py-2">
        <div class="p-4 rounded-2xl bg-success/10 border border-success/35 space-y-1.5">
          <div class="text-2xl">✅</div>
          <div class="font-black text-sm text-success">
            {{ mintedMember.roleBadge }} · {{ mintedMember.name }} ({{ mintedMember.prefix }})
          </div>
          <p class="text-xs text-base-content/75">Active for 14 days on this browser.</p>
        </div>

        <a
          v-if="mobileReturnHref"
          :href="mobileReturnHref"
          class="btn h-11 btn-primary text-primary-content w-full rounded-2xl font-black gap-2 shadow-md"
        >
          <Icon icon="solar:arrow-left-bold" class="w-4 h-4 shrink-0" />
          <span>Return &amp; tap your bookmarklet again</span>
        </a>

        <div class="flex gap-2">
          <button
            type="button"
            class="btn h-11 btn-ghost border border-base-300 flex-1 rounded-xl font-bold text-xs sm:text-sm"
            @click="handleSwitchAccount"
          >
            🚪 Switch Account
          </button>
          <button
            type="button"
            class="btn h-11 btn-outline flex-1 rounded-xl font-bold text-xs sm:text-sm"
            @click="closeOrReturn"
          >
            {{ mobileReturnHref ? 'Return to Page' : 'Close Window' }}
          </button>
        </div>
      </div>

      <form v-else class="space-y-3.5" @submit.prevent="handleLoginAndConnect">
        <div class="flex flex-col gap-1">
          <label for="bml-connect-email" class="text-xs font-bold text-base-content/85">Founder / Curator Email</label>
          <input
            id="bml-connect-email"
            v-model="email"
            type="email"
            required
            autocomplete="email"
            autocapitalize="none"
            spellcheck="false"
            placeholder="you@thehc.llc"
            class="input input-bordered h-11 rounded-xl w-full text-sm"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label for="bml-connect-password" class="text-xs font-bold text-base-content/85">Password</label>
          <input
            id="bml-connect-password"
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            placeholder="••••••••"
            class="input input-bordered h-11 rounded-xl w-full text-sm"
          />
        </div>

        <div v-if="errorMsg" role="alert" class="alert alert-error py-2 px-3 text-xs rounded-xl">
          <span>{{ errorMsg }}</span>
        </div>

        <button
          type="submit"
          class="btn h-11 btn-primary text-primary-content w-full rounded-xl font-black gap-1.5"
          :disabled="submitting"
        >
          <span v-if="submitting" class="loading loading-spinner loading-xs"></span>
          <span>Sign In &amp; Unlock Bookmarklet</span>
        </button>
      </form>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { account } from '../../lib/appwrite';
import { auth as rawAuth } from '../../lib/auth';
import { getCachedBmlRegistryConfig, validateAllowedBmlTargetUrl } from '../../lib/bml/registry';
import { authStore } from '../../lib/store';
import { toUserMessage } from '../../lib/userFacingErrors';
import { useAuth } from '../../composables/useAuth';
import { siteConfig } from '../../site-config';

const UNTRUSTED_LINK_MSG =
  "This link isn't from a Collective tool—open the bookmarklet from the page you're on.";

const auth = useAuth();
const email = ref('');
const password = ref('');
const submitting = ref(false);
const minting = ref(false);
const errorMsg = ref('');
const roleRestrictedMsg = ref('');
const rejectedTargetMsg = ref('');
const mintedToken = ref('');
const mintedMember = ref<{ name: string; prefix: string; role: string; roleBadge: string } | null>(null);
const targetOrigin = ref('');
const returnUrl = ref('');
const hostLabel = ref('works.thehc.llc');
const forceLoginRequested = ref(false);

const mobileReturnHref = computed(() => {
  if (!returnUrl.value || !mintedToken.value || rejectedTargetMsg.value) return '';
  const appOrigin = typeof window !== 'undefined' ? window.location.origin : siteConfig.siteUrl;
  const u = validateAllowedBmlTargetUrl(returnUrl.value, appOrigin, getCachedBmlRegistryConfig());
  if (!u) return '';
  const name = encodeURIComponent(mintedMember.value?.name || 'Member');
  const prefix = encodeURIComponent(mintedMember.value?.prefix || 'HUCK-');
  const role = encodeURIComponent(mintedMember.value?.role || 'founder');
  const tok = encodeURIComponent(mintedToken.value);
  return `${u.origin}${u.pathname}${u.search}#rc_bml_token=${tok}&rc_bml_name=${name}&rc_bml_prefix=${prefix}&rc_bml_role=${role}`;
});

const exchangeJwtForBmlToken = async () => {
  if (minting.value || mintedToken.value || rejectedTargetMsg.value) return;
  minting.value = true;
  errorMsg.value = '';
  roleRestrictedMsg.value = '';
  try {
    const jwtRes = await account.createJWT();
    const res = await fetch('/api/bml/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-JWT': jwtRes.jwt,
      },
    });
    const data = await res.json();
    if (res.status === 403 || data?.error === 'role_restricted') {
      roleRestrictedMsg.value =
        data?.message ||
        '🔒 Bookmarklet tools are restricted to Collective Founders (👑) and Curators (💎).';
      return;
    }
    if (!res.ok || !data?.ok || !data?.token) {
      throw new Error(data?.message || data?.error || 'Could not activate 14-day bookmarklet pass.');
    }
    mintedToken.value = data.token;
    const role = data.member?.role === 'curator' ? 'curator' : 'founder';
    mintedMember.value = {
      name: data.member?.name || 'Member',
      prefix: data.member?.prefix || 'HUCK-',
      role,
      roleBadge: data.member?.roleBadge || (role === 'founder' ? '👑 Founder' : '💎 Curator'),
    };

    try {
      localStorage.setItem(
        'rc_bml_session_v1',
        JSON.stringify({
          token: data.token,
          name: mintedMember.value.name,
          prefix: mintedMember.value.prefix,
          role: mintedMember.value.role,
          roleBadge: mintedMember.value.roleBadge,
          savedAt: Date.now(),
        })
      );
    } catch {}

    // Desktop popup handshake: only postMessage when targetOrigin passed strict https allowlist validation (never '*')
    if (typeof window !== 'undefined' && window.opener && !window.opener.closed && targetOrigin.value) {
      window.opener.postMessage(
        {
          type: 'RC_BML_AUTH_SUCCESS',
          token: data.token,
          member: data.member,
        },
        targetOrigin.value
      );
      setTimeout(() => {
        window.close();
        // iOS/WebKit ignores window.close() on tabs it treats as user-opened: fall back to mobileReturnHref ~700ms after postMessage
        if (mobileReturnHref.value) {
          setTimeout(() => {
            if (!window.closed) {
              window.location.replace(mobileReturnHref.value);
            }
          }, 350);
        }
      }, 350);
      return;
    }

    if (mobileReturnHref.value) {
      setTimeout(() => {
        window.location.replace(mobileReturnHref.value);
      }, 450);
    }
  } catch (err: any) {
    errorMsg.value = toUserMessage(err, 'Could not verify your sign-in — please try again.');
  } finally {
    minting.value = false;
  }
};

const handleSwitchAccount = async () => {
  try {
    await rawAuth.logout();
  } catch {}
  try {
    localStorage.removeItem('rc_bml_session_v1');
    localStorage.removeItem('rc_has_session');
    localStorage.removeItem('cookieFallback');
    document.cookie = 'auth_session_indicator=; path=/; max-age=0; SameSite=Lax';
  } catch {}
  mintedToken.value = '';
  mintedMember.value = null;
  roleRestrictedMsg.value = '';
  errorMsg.value = '';
  authStore.set({
    user: null,
    isAuthenticated: false,
    isPartner: false,
    teams: [],
    currentTeam: null,
    ownedTeam: null,
    loading: false,
  });
};

const handleLoginAndConnect = async () => {
  submitting.value = true;
  errorMsg.value = '';
  roleRestrictedMsg.value = '';
  forceLoginRequested.value = false;
  try {
    await auth.login(email.value.trim().toLowerCase(), password.value);
    await exchangeJwtForBmlToken();
  } catch (err: any) {
    errorMsg.value = toUserMessage(err, 'Sign-in failed. Check your email and password.');
  } finally {
    submitting.value = false;
  }
};

const closeOrReturn = () => {
  if (mobileReturnHref.value) {
    window.location.replace(mobileReturnHref.value);
    return;
  }
  window.close();
};

watch(
  () => auth.isAuthenticated.value,
  (signedIn) => {
    if (signedIn && !mintedToken.value && !forceLoginRequested.value && !rejectedTargetMsg.value) {
      void exchangeJwtForBmlToken();
    }
  }
);

onMounted(async () => {
  if (typeof window !== 'undefined') {
    hostLabel.value = window.location.host;
    const appOrigin = window.location.origin;
    const regCfg = getCachedBmlRegistryConfig();
    const params = new URLSearchParams(window.location.search);

    const rawOriginParam = (params.get('origin') || '').trim();
    const rawReturnParam = (params.get('returnUrl') || '').trim();

    if (rawOriginParam) {
      const validOrigin = validateAllowedBmlTargetUrl(rawOriginParam, appOrigin, regCfg);
      if (!validOrigin) {
        rejectedTargetMsg.value = UNTRUSTED_LINK_MSG;
        return;
      }
      targetOrigin.value = validOrigin.origin;
    }

    if (rawReturnParam) {
      const validReturn = validateAllowedBmlTargetUrl(rawReturnParam, appOrigin, regCfg);
      if (!validReturn || (targetOrigin.value && validReturn.origin !== targetOrigin.value)) {
        rejectedTargetMsg.value = UNTRUSTED_LINK_MSG;
        return;
      }
      returnUrl.value = validReturn.toString();
    }

    if (params.get('forceLogin') === '1') {
      forceLoginRequested.value = true;
      await handleSwitchAccount();
      return;
    }
  }
  if (auth.isAuthenticated.value && !forceLoginRequested.value && !rejectedTargetMsg.value) {
    void exchangeJwtForBmlToken();
  }
});
</script>
