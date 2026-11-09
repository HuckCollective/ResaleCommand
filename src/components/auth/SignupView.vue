<template>
  <div class="flex min-h-screen items-center justify-center bg-base-200 px-4 py-12 sm:px-6 lg:px-8">
    <div class="card w-full max-w-lg bg-base-100 shadow-2xl border border-base-300 rounded-3xl">
      <div class="card-body p-6 sm:p-8 space-y-4">
        <div class="text-center space-y-1">
          <div class="badge badge-primary badge-outline font-bold text-xs">
            {{ hasValidInvite ? '✅ Invitation Verified' : '🤝 Invite-Only Cooperative' }}
          </div>
          <h2 class="text-2xl sm:text-3xl font-black tracking-tight">{{ heading }}</h2>
          <p v-if="subheading && !checking" class="text-xs sm:text-sm text-base-content/70">{{ subheading }}</p>
        </div>

        <!-- Checking spinner -->
        <div v-if="checking" class="flex flex-col items-center justify-center py-8 gap-2">
          <span class="loading loading-spinner loading-md text-primary"></span>
          <span class="text-xs text-base-content/70">Checking your application...</span>
        </div>

        <template v-else>
          <!-- Link problem -->
          <div v-if="loadError" class="rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-xs sm:text-sm" role="alert">
            {{ loadError }}
          </div>

          <!-- VERIFY YOUR EMAIL (shown every visit until verified) -->
          <div
            v-if="view && !view.verified"
            class="rounded-2xl border border-warning/50 bg-warning/10 p-4 space-y-3"
            role="status"
          >
            <div class="flex items-start gap-3">
              <span class="text-2xl leading-none">📧</span>
              <div class="space-y-1 min-w-0">
                <div class="text-sm font-black">Check your inbox to finish</div>
                <p class="text-xs text-base-content/80">
                  We sent a verification link to <span class="font-mono font-bold">{{ view.emailMasked }}</span>. Stewards won't see
                  your application until you click it.
                </p>
                <p class="text-[11px] text-base-content/60">Check spam / Promotions — mail comes from noreply@thehc.llc.</p>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                class="btn btn-xs btn-outline rounded-xl font-bold"
                :disabled="resendBusy || cooldownMs > 0"
                @click="resend"
              >
                <span v-if="resendBusy" class="loading loading-spinner loading-xs"></span>
                {{ cooldownMs > 0 ? `Resend available in ${cooldownLabel}` : 'Resend email' }}
              </button>
              <button type="button" class="btn btn-xs btn-ghost rounded-xl" @click="editOpen = true">Wrong email?</button>
            </div>
            <p v-if="resendMsg" class="text-[11px] text-base-content/70">{{ resendMsg }}</p>
          </div>

          <!-- Onboarding progress -->
          <ul v-if="showStepper" class="steps steps-horizontal w-full text-[11px] font-semibold">
            <li
              v-for="(label, idx) in ONBOARDING_STEPS"
              :key="label"
              class="step"
              :class="idx < stageIndex ? 'step-success' : idx === stageIndex ? 'step-primary' : ''"
            >
              {{ label }}
            </li>
          </ul>

          <!-- Status banner -->
          <div
            v-if="statusMessage"
            class="rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-xs sm:text-sm text-base-content space-y-1"
            role="status"
          >
            <div v-if="statusBadge" class="badge badge-primary badge-sm font-bold">{{ statusBadge }}</div>
            <p>{{ statusMessage }}</p>
          </div>

          <!-- ON-PAGE Q&A PORTAL (steward asked 1 question; owner only) -->
          <div
            v-if="view && view.status === JOIN_REQUEST_STATUS.needs_info && view.isOwner"
            class="rounded-2xl border border-info/40 bg-info/5 p-4 space-y-3"
          >
            <div class="text-xs font-bold text-info uppercase tracking-wider">Message from a Co-op Steward for {{ view.name }}</div>
            <p class="text-sm font-bold text-base-content">
              "{{ view.stewardQuestion || 'Could you share a bit more detail about what you curate or want to help with?' }}"
            </p>
            <textarea
              v-model="applicantReplyDraft"
              maxlength="500"
              class="textarea textarea-bordered rounded-xl text-xs w-full h-24"
              placeholder="Type your answer here (no email needed)..."
            ></textarea>
            <div class="flex justify-end">
              <button
                type="button"
                class="btn btn-sm btn-primary rounded-xl font-black"
                :disabled="replyBusy || !applicantReplyDraft.trim()"
                @click="submitApplicantReply"
              >
                <span v-if="replyBusy" class="loading loading-spinner loading-xs"></span>
                Send Answer to Co-op Stewards
              </button>
            </div>
          </div>

          <!-- Read-only Application Summary + drawer edit -->
          <div v-if="view && showSummary" class="space-y-3">
            <div class="rounded-2xl border border-base-300 bg-base-200/50 p-4 space-y-3">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <div class="text-sm font-black truncate">{{ view.name }}</div>
                  <div class="text-xs text-base-content/70 truncate">{{ view.email || view.emailMasked }}</div>
                </div>
                <button
                  v-if="view.canEdit"
                  type="button"
                  class="btn btn-xs btn-outline rounded-xl font-bold shrink-0"
                  @click="editOpen = true"
                >
                  ✏️ Edit My Selections
                </button>
              </div>
              <div class="space-y-1">
                <div class="text-[11px] font-extrabold uppercase tracking-wider opacity-60">Hats</div>
                <div class="flex flex-wrap gap-1.5">
                  <span v-for="hat in viewHatOptions" :key="hat.id" class="badge badge-primary badge-outline badge-sm gap-1 font-semibold">
                    <span>{{ hat.icon }}</span>{{ hat.title }}
                  </span>
                </div>
              </div>
              <div v-if="view.niches.length" class="space-y-1">
                <div class="text-[11px] font-extrabold uppercase tracking-wider opacity-60">Focus / Specialty</div>
                <div class="flex flex-wrap gap-1.5">
                  <span v-for="n in view.niches" :key="n" class="badge badge-secondary badge-outline badge-sm font-semibold">{{ n }}</span>
                </div>
              </div>
              <div v-if="view.socialUrl" class="space-y-0.5">
                <div class="text-[11px] font-extrabold uppercase tracking-wider opacity-60">Shop / Social</div>
                <div class="text-xs break-all">{{ view.socialUrl }}</div>
              </div>
              <div v-if="view.note" class="space-y-0.5">
                <div class="text-[11px] font-extrabold uppercase tracking-wider opacity-60">Notes</div>
                <div class="text-xs whitespace-pre-line break-words">{{ view.note }}</div>
              </div>
              <p v-if="editHint" class="text-[11px] text-base-content/60">{{ editHint }}</p>
            </div>
          </div>

          <!-- Sign-in / charter links -->
          <div v-if="!hasValidInvite" class="text-center pt-1 flex flex-wrap items-center justify-center gap-4 text-xs">
            <a :href="loginLink" class="link link-primary font-bold">Already a member? Sign in →</a>
            <a href="/coop" class="link link-hover text-base-content/70">Read the Collective Charter</a>
          </div>

          <!-- WITHOUT AN APPLICATION: Request-an-Invite form -->
          <div v-if="!view && !hasValidInvite" class="space-y-4">
            <ConnectWithUsForm :hats="hatOptions" cancel-label="Back to Sign In" @close="goToLogin" />
          </div>

          <!-- WITH VALID INVITE: Create Account Form -->
          <form v-if="hasValidInvite" @submit.prevent="submit" class="space-y-4">
            <div v-if="approvedInvite" class="rounded-2xl bg-success/10 border border-success/30 p-3 text-xs space-y-1">
              <div class="font-bold text-success">Approved Invitation for {{ approvedInvite.name }}</div>
              <div class="flex flex-wrap gap-1 pt-0.5">
                <span v-for="hat in approvedInvite.hats" :key="hat" class="badge badge-xs badge-success badge-outline font-bold">
                  {{ hat }}
                </span>
              </div>
            </div>

            <div class="form-control w-full">
              <label class="label py-1"><span class="label-text font-bold text-xs">Full Name</span></label>
              <input type="text" v-model="name" required placeholder="Jane Doe" class="input input-bordered w-full rounded-xl" />
            </div>

            <div class="form-control w-full">
              <label class="label py-1"><span class="label-text font-bold text-xs">Invited Email Address</span></label>
              <input
                type="email"
                v-model="email"
                required
                :readonly="!!approvedInvite"
                placeholder="you@example.com"
                class="input input-bordered w-full rounded-xl"
                :class="{ 'bg-base-200/70 cursor-not-allowed': !!approvedInvite }"
              />
            </div>

            <div class="form-control w-full">
              <label class="label py-1"><span class="label-text font-bold text-xs">Choose a Password (min 8 characters)</span></label>
              <input type="password" v-model="password" required minlength="8" placeholder="••••••••" class="input input-bordered w-full rounded-xl" />
            </div>

            <div class="flex items-center justify-between text-xs mt-2">
              <a :href="loginLink" class="link link-primary link-hover font-bold">Already have an account? Sign in</a>
            </div>

            <div class="form-control mt-4">
              <button type="submit" class="btn btn-primary w-full rounded-xl font-black" :disabled="loading">
                <span v-if="loading" class="loading loading-spinner loading-sm"></span>
                <span v-else>Accept Invite &amp; Create Account</span>
              </button>
            </div>

            <div v-if="error" class="alert alert-error shadow-lg mt-3 text-xs p-3 rounded-xl">
              <span>{{ error }}</span>
            </div>
          </form>
        </template>
      </div>
    </div>

    <!-- Edit drawer -->
    <SlideOverDrawer v-model="editOpen" title="Edit My Application" subtitle="Update your hats, focus and links.">
      <ConnectWithUsForm
        v-if="editOpen && view"
        :hats="hatOptions"
        :initial-request="viewRequest"
        :tokens="{ t: tokenT, v: tokenV }"
        cancel-label="Cancel"
        @close="editOpen = false"
        @saved="onApplicationSaved"
      />
    </SlideOverDrawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useAuth } from '../../composables/useAuth';
import { addToast } from '../../stores/toast';
import ConnectWithUsForm from '../coop/ConnectWithUsForm.vue';
import SlideOverDrawer from '../common/SlideOverDrawer.vue';
import { JOIN_REQUEST_HAT_OPTIONS, JOIN_REQUEST_STATUS } from '../../lib/joinRequests';
import { joinApi, statusViewToRequest, type JoinStatusView } from '../../lib/joinRequestsClient';

const auth = useAuth();
const hatOptions = JOIN_REQUEST_HAT_OPTIONS;

const name = ref('');
const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');

const checking = ref(true);
const hasTeamRedirectInvite = ref(false);
const loadError = ref('');

const inviteId = ref('');
const tokenT = ref('');
const tokenV = ref('');
const view = ref<JoinStatusView | null>(null);

const editOpen = ref(false);
const applicantReplyDraft = ref('');
const replyBusy = ref(false);
const replyMsg = ref('');

const resendBusy = ref(false);
const resendMsg = ref('');
const cooldownMs = ref(0);
let cooldownTimer: ReturnType<typeof setInterval> | null = null;

const ONBOARDING_STEPS = ['Verify Email', 'Steward Review', 'Invite Approved', 'Account Active'] as const;

const approvedInvite = computed(() =>
  view.value && view.value.status === JOIN_REQUEST_STATUS.approved && view.value.isOwner ? view.value : null
);
const hasValidInvite = computed(() => hasTeamRedirectInvite.value || !!approvedInvite.value);

const viewRequest = computed(() => (view.value ? statusViewToRequest(view.value) : null));
const viewHatOptions = computed(() => hatOptions.filter((h) => (view.value?.hats as readonly string[] | undefined)?.includes(h.id)));

const heading = computed(() => {
  if (hasValidInvite.value) return 'Create your Co-op Account';
  if (view.value?.status === JOIN_REQUEST_STATUS.needs_info && view.value.isOwner) return 'Quick Question on Your Application';
  if (view.value) return 'Your Application Status';
  return 'Request an Invitation';
});

const subheading = computed(() => {
  if (hasValidInvite.value) return '';
  if (view.value) {
    return view.value.canEdit
      ? 'Your saved selections are shown below — you can review or update them anytime while waiting for steward review.'
      : '';
  }
  return 'Accounts at The Huckleberry Collective are created by invitation only. Tell us which hat fits you below and we will email you a link to verify your address.';
});

const stageIndex = computed(() => {
  const v = view.value;
  if (!v) return 0;
  if (!v.verified) return 0;
  if (v.status === JOIN_REQUEST_STATUS.joined) return 3;
  if (v.status === JOIN_REQUEST_STATUS.approved) return 2;
  return 1;
});

const showStepper = computed(() => !!view.value && view.value.status !== JOIN_REQUEST_STATUS.declined);

const showSummary = computed(() => {
  const v = view.value;
  if (!v) return false;
  return v.status === JOIN_REQUEST_STATUS.pending || v.status === JOIN_REQUEST_STATUS.waitlisted || v.status === JOIN_REQUEST_STATUS.needs_info;
});

const editHint = computed(() => {
  const v = view.value;
  if (!v || v.canEdit) return '';
  if (v.verified && !v.isOwner && (v.status === JOIN_REQUEST_STATUS.pending || v.status === JOIN_REQUEST_STATUS.waitlisted)) {
    return 'To edit, open the link from your verification email.';
  }
  return '';
});

const statusBadge = computed(() => {
  const v = view.value;
  if (!v || !v.verified) return '';
  switch (v.status) {
    case JOIN_REQUEST_STATUS.pending:
      return '⏳ Waiting for Steward Review';
    case JOIN_REQUEST_STATUS.waitlisted:
      return '📋 Priority Waitlist';
    case JOIN_REQUEST_STATUS.approved:
      return '✅ Approved';
    case JOIN_REQUEST_STATUS.joined:
      return '✅ Account Active';
    case JOIN_REQUEST_STATUS.declined:
      return 'Application Closed';
    default:
      return '';
  }
});

const statusMessage = computed(() => {
  const v = view.value;
  if (!v) return '';
  if (replyMsg.value) return replyMsg.value;
  if (!v.verified) return '';
  switch (v.status) {
    case JOIN_REQUEST_STATUS.pending:
      return `Hi ${v.name} — your request is in our Co-op Governance queue and waiting for steward review. We'll send an automated update as soon as a steward reviews it!`;
    case JOIN_REQUEST_STATUS.waitlisted:
      return `Hi ${v.name} — your application is on our Priority Waitlist while booth shelf space is full. We'll automatically email your invite link as soon as a spot opens!`;
    case JOIN_REQUEST_STATUS.approved:
      return v.isOwner ? '' : 'Your invitation is approved! Open the link in your approval email to create your account.';
    case JOIN_REQUEST_STATUS.needs_info:
      return v.isOwner ? '' : 'A steward left you a question. Open the link in your email to answer it.';
    case JOIN_REQUEST_STATUS.joined:
      return 'This invitation has already been used to create an account. Please sign in!';
    default:
      return 'Thank you for your interest in The Huckleberry Collective. Our current roster and category mix are full at this time.';
  }
});

const cooldownLabel = computed(() => {
  const total = Math.ceil(cooldownMs.value / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
});

const loginLink = computed(() => {
  if (typeof window !== 'undefined') return '/login' + window.location.search;
  return '/login';
});

const goToLogin = () => {
  if (typeof window !== 'undefined') window.location.href = '/login';
};

const startCooldown = (ms: number) => {
  cooldownMs.value = Math.max(0, ms);
  if (cooldownTimer) clearInterval(cooldownTimer);
  if (cooldownMs.value <= 0) return;
  cooldownTimer = setInterval(() => {
    cooldownMs.value = Math.max(0, cooldownMs.value - 1000);
    if (cooldownMs.value <= 0 && cooldownTimer) {
      clearInterval(cooldownTimer);
      cooldownTimer = null;
    }
  }, 1000);
};

const applyView = (next: JoinStatusView) => {
  view.value = next;
  if (next.isOwner && next.status === JOIN_REQUEST_STATUS.approved) {
    name.value = next.name;
    email.value = next.email;
  }
  if (!next.verified) startCooldown(next.cooldownRemainingMs);
  else startCooldown(0);
};

const resend = async () => {
  if (!view.value) return;
  resendBusy.value = true;
  resendMsg.value = '';
  try {
    const res = await joinApi<{ cooldownRemainingMs?: number }>('resend', { id: inviteId.value, t: tokenT.value });
    if (res.ok) {
      resendMsg.value = 'Sent! Give it a minute and check spam / Promotions too.';
      startCooldown(res.data.cooldownRemainingMs ?? 3600000);
    } else if (res.status === 429 && res.data.cooldownRemainingMs) {
      startCooldown(res.data.cooldownRemainingMs);
    } else {
      resendMsg.value = res.data.error || 'Could not resend right now.';
    }
  } finally {
    resendBusy.value = false;
  }
};

const submitApplicantReply = async () => {
  if (!view.value || !applicantReplyDraft.value.trim()) return;
  replyBusy.value = true;
  try {
    const res = await joinApi<{ request: JoinStatusView }>('reply', {
      id: inviteId.value,
      t: tokenT.value,
      v: tokenV.value,
      reply: applicantReplyDraft.value.trim(),
    });
    if (res.ok) {
      applyView(res.data.request);
      replyMsg.value = 'Thank you! Your answer has been sent straight to our Co-op Governance queue.';
    } else {
      replyMsg.value = res.data.error || 'Could not save your reply. Please try again.';
    }
  } finally {
    replyBusy.value = false;
  }
};

const onApplicationSaved = (next: JoinStatusView) => {
  applyView(next);
  editOpen.value = false;
  addToast('Application updated.', 'success');
};

onMounted(async () => {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect') || '';

  if (redirect.includes('/join')) {
    hasTeamRedirectInvite.value = true;
    checking.value = false;
    return;
  }

  inviteId.value = params.get('invite') || '';
  tokenT.value = params.get('t') || '';
  tokenV.value = params.get('v') || '';

  if (!inviteId.value) {
    checking.value = false;
    return;
  }
  if (!tokenT.value && !tokenV.value) {
    loadError.value = 'This application link is out of date. Request a fresh invitation below.';
    checking.value = false;
    return;
  }

  try {
    // Clicking the emailed link (v) proves mailbox ownership: verify first, then show the page.
    if (tokenV.value) {
      const verified = await joinApi<{ request: JoinStatusView; justVerified?: boolean }>('verify', {
        id: inviteId.value,
        t: tokenT.value,
        v: tokenV.value,
      });
      if (verified.ok) {
        applyView(verified.data.request);
        if (verified.data.justVerified) addToast('Email verified — stewards can now review your application.', 'success');
        return;
      }
    }
    const res = await joinApi<{ request: JoinStatusView }>('status', {
      id: inviteId.value,
      t: tokenT.value,
      v: tokenV.value,
    });
    if (res.ok) {
      applyView(res.data.request);
    } else {
      loadError.value = "We couldn't find that application. Request a fresh invitation below.";
    }
  } finally {
    checking.value = false;
  }
});

onBeforeUnmount(() => {
  if (cooldownTimer) clearInterval(cooldownTimer);
});

const submit = async () => {
  if (!hasValidInvite.value) {
    error.value = 'An approved invitation is required to create an account.';
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    await auth.register(email.value, password.value, name.value);

    if (approvedInvite.value) {
      // Non-blocking: mark the invitation as used.
      await joinApi('accept', { id: inviteId.value, t: tokenT.value, v: tokenV.value });
    }

    const urlParams = new URLSearchParams(window.location.search);
    const redirect = urlParams.get('redirect');
    window.location.href = redirect || '/dashboard';
  } catch (err: any) {
    console.error(err);
    error.value = err.message || 'Registration failed. Please try again.';
  } finally {
    loading.value = false;
  }
};
</script>
