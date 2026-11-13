import { computed, ref, watch } from 'vue';
import { useStore } from '@nanostores/vue';
import { account } from './appwrite';
import { authStore } from './store';

export type MemberRole = 'founder' | 'curator' | 'restricted';

export interface MemberCapabilities {
  role: MemberRole;
  roleBadge: string;
  prefix: string;
  canUseBml: boolean;
  canViewPurchases: boolean;
  canViewSales: boolean;
  canScoutByUrl: boolean;
  canUseBuyTracker: boolean;
}

export function capabilitiesForRole(role: MemberRole, prefix = 'HUCK-'): MemberCapabilities {
  const cleanPrefix = String(prefix || 'HUCK-').trim().toUpperCase();
  const normalizedPrefix = cleanPrefix.endsWith('-') ? cleanPrefix : `${cleanPrefix}-`;

  if (role === 'restricted' || normalizedPrefix.startsWith('BB')) {
    return {
      role: 'restricted',
      roleBadge: normalizedPrefix.startsWith('BB') ? '🤝 Consignor' : '🌱 Sweat Partner',
      prefix: normalizedPrefix,
      canUseBml: false,
      canViewPurchases: false,
      canViewSales: false,
      canScoutByUrl: false,
      canUseBuyTracker: false,
    };
  }

  return {
    role,
    roleBadge: role === 'founder' ? '👑 Founder' : '💎 Curator',
    prefix: normalizedPrefix,
    canUseBml: true,
    canViewPurchases: true,
    canViewSales: true,
    canScoutByUrl: true,
    canUseBuyTracker: true,
  };
}

const SESSION_CACHE_KEY_PREFIX = 'rc_member_caps_v1:';
const resolvedCapsByUserId = ref<Record<string, MemberCapabilities>>({});
const inflightByUserId = new Map<string, Promise<MemberCapabilities | null>>();

function inferLocalRoleAndPrefix(authState: any): { role: MemberRole; prefix: string } {
  const u = authState?.user;
  const team = authState?.currentTeam || authState?.ownedTeam;
  const rawPrefix = team?.prefs?.upcPrefix || u?.prefs?.upcPrefix || 'HUCK-';
  const cleanPrefix = String(rawPrefix).trim().toUpperCase();
  const prefix = cleanPrefix.endsWith('-') ? cleanPrefix : `${cleanPrefix}-`;

  if (!u) {
    return { role: 'founder', prefix };
  }

  const labels = Array.isArray(u.labels) ? u.labels.map((l: string) => String(l).toLowerCase()) : [];
  const prefRole = String(u.prefs?.role || '').toLowerCase();

  if (
    prefix.startsWith('BB') ||
    labels.includes('consignor') ||
    labels.includes('sweat_only') ||
    prefRole === 'consignor' ||
    prefRole === 'sweat_only'
  ) {
    return { role: 'restricted', prefix };
  }

  if (labels.includes('admin') || labels.includes('founder') || prefRole === 'founder' || authState?.ownedTeam) {
    return { role: 'founder', prefix };
  }

  if (prefix.startsWith('PDXGL') || labels.includes('curator') || prefRole === 'curator') {
    return { role: 'curator', prefix };
  }

  return { role: 'founder', prefix };
}

async function fetchServerMemberCapabilities(userId: string): Promise<MemberCapabilities | null> {
  if (!userId || typeof window === 'undefined') return null;

  try {
    const cachedRaw = sessionStorage.getItem(`${SESSION_CACHE_KEY_PREFIX}${userId}`);
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw);
      if (parsed && parsed.savedAt && Date.now() - parsed.savedAt < 10 * 60 * 1000 && parsed.capabilities) {
        resolvedCapsByUserId.value = {
          ...resolvedCapsByUserId.value,
          [userId]: parsed.capabilities,
        };
        return parsed.capabilities as MemberCapabilities;
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
      const caps: MemberCapabilities | null =
        data?.capabilities ||
        (data?.member?.role ? capabilitiesForRole(data.member.role, data.member.prefix) : null) ||
        (res.status === 403 ? capabilitiesForRole('restricted', data?.prefix || 'BB-') : null);

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
    return capabilitiesForRole(inferred.role, inferred.prefix);
  });

  if (typeof window !== 'undefined') {
    watch(
      () => state.value.user?.$id,
      (userId) => {
        if (userId) {
          void fetchServerMemberCapabilities(userId);
        }
      },
      { immediate: true }
    );
  }

  return {
    capabilities,
    refreshCapabilities: () => {
      const userId = state.value.user?.$id;
      if (!userId) return Promise.resolve(null);
      try {
        sessionStorage.removeItem(`${SESSION_CACHE_KEY_PREFIX}${userId}`);
      } catch {}
      return fetchServerMemberCapabilities(userId);
    },
  };
}
