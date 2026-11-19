import { computed, ref, watch } from 'vue';
import { useStore } from '@nanostores/vue';
import { account } from './appwrite';
import { authStore } from './store';

export type MemberRole = 'founder' | 'curator' | 'restricted';

export interface MemberCapabilities {
  role: MemberRole;
  roleBadge: string;
  prefix: string;
  isConsignor: boolean;
  canUseBml: boolean;
  canUseBookmarklets: boolean;
  canViewPurchases: boolean;
  canViewSales: boolean;
  canScoutByUrl: boolean;
  canUseBuyTracker: boolean;
  canViewCollectiveTools: boolean;
  canSeeCollectiveFinancials: boolean;
}

export function capabilitiesForRole(
  role: MemberRole,
  prefix = 'HUCK-',
  options?: { forceConsignor?: boolean }
): MemberCapabilities {
  const cleanPrefix = String(prefix || 'HUCK-').trim().toUpperCase();
  const normalizedPrefix = cleanPrefix.endsWith('-') ? cleanPrefix : `${cleanPrefix}-`;
  const isConsignor = Boolean(
    options?.forceConsignor ?? normalizedPrefix.startsWith('BB')
  );
  const canAccessCollective = !isConsignor;

  if (role === 'restricted' || isConsignor) {
    return {
      role: 'restricted',
      roleBadge: isConsignor ? '🤝 Consignor' : '🌱 Sweat Partner',
      prefix: normalizedPrefix,
      isConsignor,
      canUseBml: false,
      canUseBookmarklets: false,
      canViewPurchases: false,
      canViewSales: false,
      canScoutByUrl: false,
      canUseBuyTracker: false,
      canViewCollectiveTools: canAccessCollective,
      canSeeCollectiveFinancials: canAccessCollective,
    };
  }

  return {
    role,
    roleBadge: role === 'founder' ? '👑 Founder' : '💎 Curator',
    prefix: normalizedPrefix,
    isConsignor: false,
    canUseBml: true,
    canUseBookmarklets: true,
    canViewPurchases: true,
    canViewSales: true,
    canScoutByUrl: true,
    canUseBuyTracker: true,
    canViewCollectiveTools: true,
    canSeeCollectiveFinancials: true,
  };
}

const SESSION_CACHE_KEY_PREFIX = 'rc_member_caps_v3:';
const resolvedCapsByUserId = ref<Record<string, MemberCapabilities>>({});
const checkedByUserId = ref<Record<string, boolean>>({});
const inflightByUserId = new Map<string, Promise<MemberCapabilities | null>>();

function inferLocalRoleAndPrefix(authState: any): {
  role: MemberRole;
  prefix: string;
  isConsignor: boolean;
} {
  const u = authState?.user;
  const team = authState?.currentTeam || authState?.ownedTeam;
  const rawPrefix = u?.prefs?.upcPrefix || team?.prefs?.upcPrefix || 'HUCK-';
  const cleanPrefix = String(rawPrefix).trim().toUpperCase();
  const prefix = cleanPrefix.endsWith('-') ? cleanPrefix : `${cleanPrefix}-`;

  if (!u) {
    return { role: 'curator', prefix, isConsignor: false };
  }

  const labels = Array.isArray(u.labels)
    ? u.labels.map((l: string) => String(l).toLowerCase())
    : [];
  const prefRole = String(u.prefs?.role || '').toLowerCase();

  const isConsignor =
    prefix.startsWith('BB') ||
    labels.includes('consignor') ||
    prefRole === 'consignor';

  if (
    isConsignor ||
    labels.includes('sweat_only') ||
    prefRole === 'sweat_only'
  ) {
    return {
      role: 'restricted',
      prefix: isConsignor ? (prefix.startsWith('BB') ? prefix : 'BB-') : prefix,
      isConsignor,
    };
  }

  if (
    labels.includes('admin') ||
    labels.includes('founder') ||
    authState?.ownedTeam
  ) {
    return { role: 'founder', prefix, isConsignor: false };
  }

  return { role: 'curator', prefix, isConsignor: false };
}

function normalizeServerCapabilities(raw: any): MemberCapabilities | null {
  if (!raw || typeof raw !== 'object') return null;
  const role: MemberRole =
    raw.role === 'founder' || raw.role === 'curator' || raw.role === 'restricted'
      ? raw.role
      : 'restricted';
  const isConsignor = Boolean(
    raw.isConsignor ?? String(raw.prefix || '').toUpperCase().startsWith('BB')
  );
  return capabilitiesForRole(role, raw.prefix || 'HUCK-', {
    forceConsignor: isConsignor,
  });
}

async function fetchServerMemberCapabilities(
  userId: string,
  authStateSnapshot?: any
): Promise<MemberCapabilities | null> {
  if (!userId || typeof window === 'undefined') return null;

  try {
    const cachedRaw = sessionStorage.getItem(`${SESSION_CACHE_KEY_PREFIX}${userId}`);
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw);
      const normalized = normalizeServerCapabilities(parsed?.capabilities);
      if (parsed && parsed.savedAt && Date.now() - parsed.savedAt < 10 * 60 * 1000 && normalized) {
        resolvedCapsByUserId.value = {
          ...resolvedCapsByUserId.value,
          [userId]: normalized,
        };
        checkedByUserId.value = {
          ...checkedByUserId.value,
          [userId]: true,
        };
        return normalized;
      }
    }
  } catch {}

  if (inflightByUserId.has(userId)) {
    return inflightByUserId.get(userId)!;
  }

  const promise = (async (): Promise<MemberCapabilities | null> => {
    try {
      const jwtRes = await account.createJWT();
      const res = await fetch('/api/bml/session', {
        method: 'GET',
        headers: {
          'X-Appwrite-JWT': jwtRes.jwt,
        },
      });
      const data = await res.json().catch(() => null);
      const inferred = inferLocalRoleAndPrefix(authStateSnapshot);
      const caps: MemberCapabilities | null =
        normalizeServerCapabilities(data?.capabilities) ||
        (data?.member?.role
          ? capabilitiesForRole(data.member.role, data.member.prefix)
          : null) ||
        (res.status === 403
          ? capabilitiesForRole(
              'restricted',
              data?.prefix || inferred.prefix || 'SWEAT-',
              {
                forceConsignor: Boolean(
                  data?.isConsignor ?? inferred.isConsignor
                ),
              }
            )
          : null);

      if (caps) {
        resolvedCapsByUserId.value = {
          ...resolvedCapsByUserId.value,
          [userId]: caps,
        };
        try {
          sessionStorage.setItem(
            `${SESSION_CACHE_KEY_PREFIX}${userId}`,
            JSON.stringify({ savedAt: Date.now(), capabilities: caps })
          );
        } catch {}
      }
      return caps;
    } catch {
      return null;
    } finally {
      checkedByUserId.value = {
        ...checkedByUserId.value,
        [userId]: true,
      };
      inflightByUserId.delete(userId);
    }
  })();

  inflightByUserId.set(userId, promise);
  return promise;
}

export function useMemberCapabilities() {
  const state = useStore(authStore);

  const capabilities = computed<MemberCapabilities>(() => {
    const userId = state.value.user?.$id;
    if (userId && resolvedCapsByUserId.value[userId]) {
      return resolvedCapsByUserId.value[userId];
    }
    const inferred = inferLocalRoleAndPrefix(state.value);
    return capabilitiesForRole(inferred.role, inferred.prefix, {
      forceConsignor: inferred.isConsignor,
    });
  });

  const capabilitiesResolved = computed<boolean>(() => {
    if (state.value.loading) return false;
    const userId = state.value.user?.$id;
    if (!userId) return true;
    return Boolean(resolvedCapsByUserId.value[userId] || checkedByUserId.value[userId]);
  });

  if (typeof window !== 'undefined') {
    watch(
      () => state.value.user?.$id,
      (userId) => {
        if (userId) {
          void fetchServerMemberCapabilities(userId, state.value);
        }
      },
      { immediate: true }
    );
  }

  return {
    capabilities,
    capabilitiesResolved,
    refreshCapabilities: () => {
      const userId = state.value.user?.$id;
      if (!userId) return Promise.resolve(null);
      try {
        sessionStorage.removeItem(`${SESSION_CACHE_KEY_PREFIX}${userId}`);
      } catch {}
      return fetchServerMemberCapabilities(userId, state.value);
    },
  };
}
