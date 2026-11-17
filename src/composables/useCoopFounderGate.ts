import { ref, computed, watch, type Ref } from 'vue';
import { useAuth } from './useAuth';
import { useMemberCapabilities } from '../lib/memberAccess';
import { fetchCoopMe } from '../lib/coopLedgerClient';
import type { CoopMemberProfile } from '../lib/coopGovernance';
import type { CoopMeIdentity } from '../types/coop';

const sharedIdentity = ref<CoopMeIdentity | null>(null);
const sharedLoading = ref(false);
let inFlightPromise: Promise<CoopMeIdentity | null> | null = null;
let loadedForUserId = '';

export function matchRosterMemberStrict(
  members: readonly CoopMemberProfile[] | undefined | null,
  opts: { userId?: string; email?: string; name?: string }
): CoopMemberProfile | null {
  const list = Array.isArray(members) ? members : [];
  if (list.length === 0) return null;

  if (opts.userId) {
    const byId = list.find((m) => m.userId && m.userId === opts.userId);
    if (byId) return byId;
  }

  const cleanEmail = String(opts.email || '').trim().toLowerCase();
  if (cleanEmail) {
    const byEmail = list.find(
      (m) => m.email && m.email.trim().toLowerCase() === cleanEmail
    );
    if (byEmail) return byEmail;
  }

  const stripParens = (s?: string) =>
    String(s || '')
      .replace(/\(.*?\)/g, '')
      .trim()
      .toLowerCase();

  const cleanName = stripParens(opts.name);
  if (!cleanName) return null;

  const exactByName = list.find((m) => stripParens(m.name) === cleanName);
  if (exactByName) return exactByName;

  const firstWordTarget = cleanName.split(/\s+/)[0] || '';
  if (firstWordTarget.length >= 3) {
    const byFirstWord = list.find((m) => {
      const fw = stripParens(m.name).split(/\s+/)[0] || '';
      return fw.length >= 3 && fw === firstWordTarget;
    });
    if (byFirstWord) return byFirstWord;
  }

  return null;
}

export function useCoopFounderGate(rosterMembers?: Ref<CoopMemberProfile[]>) {
  const { user, isAuthenticated } = useAuth();
  const { capabilities } = useMemberCapabilities();

  async function refreshCoopIdentity(force = false): Promise<CoopMeIdentity | null> {
    if (typeof window === 'undefined') return null;
    if (!isAuthenticated.value || !user.value?.$id || capabilities.value.isConsignor) {
      sharedIdentity.value = null;
      loadedForUserId = '';
      return null;
    }
    if (!force && sharedIdentity.value && loadedForUserId === user.value.$id) {
      return sharedIdentity.value;
    }
    if (inFlightPromise && !force) {
      return inFlightPromise;
    }

    sharedLoading.value = true;
    inFlightPromise = fetchCoopMe()
      .then((me) => {
        sharedIdentity.value = me;
        loadedForUserId = user.value?.$id || '';
        return me;
      })
      .catch(() => {
        sharedIdentity.value = null;
        return null;
      })
      .finally(() => {
        sharedLoading.value = false;
        inFlightPromise = null;
      });

    return inFlightPromise;
  }

  watch(
    () => user.value?.$id,
    (uid) => {
      if (uid) {
        refreshCoopIdentity(uid !== loadedForUserId);
      } else {
        sharedIdentity.value = null;
        loadedForUserId = '';
      }
    },
    { immediate: true }
  );

  const currentMember = computed<CoopMemberProfile | null>(() => {
    const members = rosterMembers?.value || [];
    if (sharedIdentity.value?.linkedMemberName) {
      const linked = members.find(
        (m) =>
          m.name.trim().toLowerCase() ===
          sharedIdentity.value!.linkedMemberName!.trim().toLowerCase()
      );
      if (linked) return linked;
    }
    return matchRosterMemberStrict(members, {
      userId: user.value?.$id,
      email: user.value?.email,
      name: user.value?.name,
    });
  });

  const currentMemberName = computed<string>(() => {
    return (
      sharedIdentity.value?.linkedMemberName ||
      currentMember.value?.name ||
      user.value?.name ||
      ''
    );
  });

  // Server-verified role flags (UI display hints; server re-verifies every request via JWT)
  const isOwner = computed(() => Boolean(sharedIdentity.value?.isOwner));
  const isFounder = computed(() => Boolean(sharedIdentity.value?.isFounder));
  const soleFounder = computed(() => Boolean(sharedIdentity.value?.soleFounder));
  const canViewLabor = computed(() => Boolean(sharedIdentity.value?.canViewLabor));
  const canLogLabor = computed(() => Boolean(sharedIdentity.value?.canLogLabor));
  const canApproveLabor = computed(() => Boolean(sharedIdentity.value?.canApproveLabor));
  const canLockMonth = computed(() => Boolean(sharedIdentity.value?.canLockMonth));
  const canEditGlobalFinancials = computed(() =>
    Boolean(sharedIdentity.value?.canEditGlobalFinancials)
  );

  return {
    coopIdentity: sharedIdentity,
    isLoadingIdentity: sharedLoading,
    isOwner,
    isFounder,
    soleFounder,
    canViewLabor,
    canLogLabor,
    canApproveLabor,
    canLockMonth,
    canEditGlobalFinancials,
    currentMember,
    currentMemberName,
    refreshCoopIdentity,
  };
}
