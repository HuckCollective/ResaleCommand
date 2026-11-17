<template>
  <div class="rounded-2xl border border-primary/25 bg-base-200/35 p-4 sm:p-5 space-y-4">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="space-y-0.5">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="badge badge-primary text-primary-content badge-xs font-black">Member Hats &amp; Access</span>
          <span class="badge badge-outline badge-xs font-mono font-bold">🔒 Steward-Verified</span>
          <span
            v-if="isOwner"
            class="badge badge-success text-success-content badge-xs font-bold"
          >
            👑 Account Steward Active
          </span>
          <span
            v-else
            class="badge badge-ghost badge-xs font-semibold"
          >
            👁️ Read-Only (Account Steward Edits Hats)
          </span>
        </div>
        <h4 class="text-base font-black text-base-content">
          Member Hats &amp; Account Linking
        </h4>
        <p class="text-xs text-base-content/70">
          Assign Collective Hats (<code>founder</code>, <code>curator</code>, <code>promoter</code>, <code>enabler</code>, <code>builder</code>, <code>consignor</code>) for verified permissions on labor approvals &amp; month locks, and link each account to a Roster profile.
        </p>
      </div>

      <button
        type="button"
        class="btn btn-xs h-11 min-h-11 md:h-7 md:min-h-0 btn-outline rounded-xl font-bold gap-1.5 self-start sm:self-auto"
        :disabled="loadingMemberships"
        @click="loadMemberships"
      >
        <Icon icon="solar:refresh-bold" class="w-3.5 h-3.5" :class="{ 'animate-spin': loadingMemberships }" />
        <span>Refresh Roles</span>
      </button>
    </div>

    <!-- Invite New Team Member Bar (Owner Only) -->
    <form
      v-if="isOwner && resolvedTeamId"
      class="rounded-xl bg-base-100 border border-base-300 p-3.5 space-y-2.5"
      @submit.prevent="handleInviteMember"
    >
      <div class="text-xs font-black text-base-content flex items-center gap-1.5">
        <Icon icon="solar:user-plus-bold-duotone" class="w-4 h-4 text-primary" />
        <span>Invite to the Collective</span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
        <div class="sm:col-span-4 form-control">
          <label class="label py-0.5"><span class="label-text text-[11px] font-bold">Full Name</span></label>
          <input
            v-model="inviteForm.name"
            type="text"
            autocomplete="name"
            placeholder="e.g. Jesse (Social & Ops)"
            class="input input-bordered input-xs h-11 md:h-8 rounded-lg text-xs"
            required
          />
        </div>
        <div class="sm:col-span-4 form-control">
          <label class="label py-0.5"><span class="label-text text-[11px] font-bold">Email Address</span></label>
          <input
            v-model="inviteForm.email"
            type="email"
            autocomplete="email"
            autocapitalize="none"
            placeholder="partner@example.com"
            class="input input-bordered input-xs h-11 md:h-8 rounded-lg text-xs font-mono"
            required
          />
        </div>
        <div class="sm:col-span-4 flex items-center justify-between sm:justify-end gap-2 flex-wrap">
          <select
            v-model="inviteForm.initialRole"
            class="select select-bordered select-xs h-11 md:h-8 rounded-lg font-bold text-xs"
          >
            <option value="enabler">🔥 Enabler ($0 Inv + Curator)</option>
            <option value="promoter">📣 Promoter ($0 Inv + Curator)</option>
            <option value="builder">🛠️ Builder ($0 Inv + Curator)</option>
            <option value="curator">💎 Curator Partner</option>
            <option value="founder">👑 Co-Founder (+ Curator)</option>
            <option value="consignor">🏷️ Consignor (Isolated)</option>
          </select>
          <button
            type="submit"
            class="btn btn-xs btn-primary text-primary-content h-11 min-h-11 md:h-8 md:min-h-0 rounded-lg font-black px-3"
            :disabled="inviting"
          >
            {{ inviting ? 'Sending…' : '+ Send Invite' }}
          </button>
        </div>
      </div>
    </form>

    <!-- Error / Empty Notice -->
    <div v-if="errorMessage" class="alert alert-warning text-xs py-2.5 rounded-xl">
      <Icon icon="solar:shield-warning-bold" class="w-4 h-4 shrink-0" />
      <span>{{ errorMessage }}</span>
    </div>

    <!-- Live Appwrite Team Memberships Table -->
    <div v-if="memberships.length > 0" class="overflow-x-auto bg-base-100 border border-base-200 rounded-2xl">
      <table class="table table-sm">
        <thead>
          <tr class="bg-base-200/60 text-[11px] font-extrabold uppercase text-base-content/70">
            <th>Account</th>
            <th>Status</th>
            <th>Work &amp; Security Roles</th>
            <th>🔗 Linked Roster Profile</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="m in memberships"
            :key="m.$id"
            class="hover:bg-base-200/35 align-middle"
          >
            <td class="text-xs">
              <div class="font-bold text-base-content flex items-center gap-1.5 flex-wrap">
                <span>{{ m.userName || 'Invited Member' }}</span>
                <span
                  v-if="hasBuiltInOwner(m)"
                  class="badge badge-warning text-warning-content badge-xs font-black"
                  title="Account Steward — protected against accidental lockout"
                >
                  👑 Account Steward ({{ ownerCount === 1 ? 'Protected' : 'Active' }})
                </span>
              </div>
              <div class="text-[11px] font-mono text-base-content/60">{{ m.userEmail || m.userId }}</div>
            </td>

            <td>
              <span
                class="badge badge-xs font-bold"
                :class="m.confirm ? 'badge-success' : 'badge-warning badge-outline'"
              >
                {{ m.confirm ? '✅ Active' : '⏳ Pending Invite' }}
              </span>
            </td>

            <td>
              <div class="flex items-center gap-1.5 flex-wrap">
                <label
                  v-for="roleOpt in customRoleOptions"
                  :key="roleOpt.id"
                  class="inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold transition-colors"
                  :class="[
                    hasCustomRole(m, roleOpt.id)
                      ? 'bg-primary/12 border-primary/40 text-primary'
                      : 'bg-base-200/40 border-base-300 text-base-content/65',
                    isOwner && savingMembershipId !== m.$id
                      ? 'cursor-pointer hover:border-primary/60'
                      : 'opacity-75 cursor-not-allowed',
                  ]"
                >
                  <input
                    type="checkbox"
                    class="checkbox checkbox-xs checkbox-primary"
                    :checked="hasCustomRole(m, roleOpt.id)"
                    :disabled="!isOwner || savingMembershipId === m.$id"
                    @change="toggleCustomRole(m, roleOpt.id)"
                  />
                  <span>{{ roleOpt.icon }} {{ roleOpt.label }}</span>
                </label>
              </div>
            </td>

            <td class="min-w-48">
              <select
                class="select select-bordered select-xs rounded-lg font-bold text-xs w-full max-w-56"
                :value="linkedRosterNameForUser(m.userId)"
                :disabled="!canManageLinks"
                @change="handleLinkSelect(m, ($event.target as HTMLSelectElement).value)"
              >
                <option value="">— Unlinked —</option>
                <option
                  v-for="rm in members"
                  :key="rm.name"
                  :value="rm.name"
                >
                  {{ rm.name }} [{{ rm.partner }}-]
                </option>
              </select>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="text-[11px] text-base-content/65 flex items-center justify-between gap-2 flex-wrap">
      <span>
        <strong>Founder power:</strong> <code>owner</code> or <code>founder</code> (approves labor, locks/unlocks months).
        <strong>Voting/Labor roles:</strong> <code>curator</code>, <code>promoter</code>, <code>enabler</code>, <code>builder</code>.
        <strong>Consignor:</strong> own statement only (no labor access).
      </span>
      <span v-if="soleFounder" class="badge badge-info badge-outline badge-xs font-mono">
        Sole Founder Active (self-approval audited)
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { teams } from '../../lib/appwrite';
import { addToast } from '../../stores/toast';
import { useAuth } from '../../composables/useAuth';
import { useCoopFounderGate } from '../../composables/useCoopFounderGate';
import {
  deriveMemberHatsFromRoles,
  ensureCuratorBaseRoles,
  MEMBER_HAT_META,
  type CoopMemberProfile,
  type MemberHat,
} from '../../lib/coopGovernance';
import { toUserMessage } from '../../lib/userFacingErrors';

const props = defineProps<{
  members: CoopMemberProfile[];
  canManageRosterLinks?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:members', next: CoopMemberProfile[]): void;
}>();

type CustomRoleId = 'founder' | 'curator' | 'promoter' | 'enabler' | 'builder' | 'consignor';

const customRoleOptions: ReadonlyArray<{ id: CustomRoleId; icon: string; label: string }> = [
  { id: 'founder', icon: '👑', label: 'Founder' },
  { id: 'curator', icon: '💎', label: 'Curator' },
  { id: 'promoter', icon: '📣', label: 'Promoter' },
  { id: 'enabler', icon: '🔥', label: 'Enabler' },
  { id: 'builder', icon: '🛠️', label: 'Builder' },
  { id: 'consignor', icon: '🏷️', label: 'Consignor' },
];

const CUSTOM_ROLE_IDS = new Set<string>(customRoleOptions.map((r) => r.id));

const { currentTeam } = useAuth();
const { coopIdentity, isOwner, isFounder, soleFounder, refreshCoopIdentity } =
  useCoopFounderGate();

const memberships = ref<any[]>([]);
const loadingMemberships = ref(false);
const savingMembershipId = ref('');
const inviting = ref(false);
const errorMessage = ref('');

const inviteForm = ref<{
  name: string;
  email: string;
  initialRole: CustomRoleId;
}>({
  name: '',
  email: '',
  initialRole: 'enabler',
});

const resolvedTeamId = computed(
  () => coopIdentity.value?.teamId || currentTeam.value?.$id || ''
);

const canManageLinks = computed(
  () => Boolean(props.canManageRosterLinks) || isFounder.value || isOwner.value
);

const ownerCount = computed(
  () =>
    memberships.value.filter(
      (m) => m.confirm && Array.isArray(m.roles) && m.roles.includes('owner')
    ).length
);

function hasBuiltInOwner(m: any): boolean {
  return Array.isArray(m?.roles) && m.roles.includes('owner');
}

function hasCustomRole(m: any, roleId: CustomRoleId): boolean {
  return Array.isArray(m?.roles) && m.roles.includes(roleId);
}

function linkedRosterNameForUser(userId?: string): string {
  if (!userId) return '';
  const found = props.members.find((rm) => rm.userId === userId);
  return found ? found.name : '';
}

async function loadMemberships() {
  if (!resolvedTeamId.value) return;
  loadingMemberships.value = true;
  errorMessage.value = '';
  try {
    const res = await teams.listMemberships(resolvedTeamId.value);
    memberships.value = res.memberships || [];
  } catch (err: any) {
    console.warn('[CoopRolesPanel] Failed to load memberships:', err);
    errorMessage.value = toUserMessage(
      err,
      'Sign in as a confirmed Collective member to view Member Hats & Access.'
    );
  } finally {
    loadingMemberships.value = false;
  }
}

async function toggleCustomRole(membership: any, roleId: CustomRoleId) {
  if (!isOwner.value || !resolvedTeamId.value) {
    addToast({
      type: 'warning',
      message: 'Only an Account Steward can update Member Hats.',
    });
    return;
  }

  const existingRoles: string[] = Array.isArray(membership.roles)
    ? membership.roles.map((r: any) => String(r))
    : [];

  // Preserve built-in roles ('owner', 'member') untouched (§8.3)
  const builtIns = existingRoles.filter((r) => !CUSTOM_ROLE_IDS.has(r));
  const currentCustom = new Set(existingRoles.filter((r) => CUSTOM_ROLE_IDS.has(r)));

  if (currentCustom.has(roleId)) {
    currentCustom.delete(roleId);
  } else {
    currentCustom.add(roleId);
  }

  // Never strip built-in 'owner', and ensure non-empty roles array for Appwrite
  const merged = Array.from(new Set([...builtIns, ...currentCustom]));
  if (hasBuiltInOwner(membership) && !merged.includes('owner')) {
    merged.unshift('owner');
  }
  if (merged.length === 0) {
    merged.push('member');
  }

  savingMembershipId.value = membership.$id;
  try {
    const updated = await teams.updateMembership(
      resolvedTeamId.value,
      membership.$id,
      merged
    );
    memberships.value = memberships.value.map((m) =>
      m.$id === membership.$id ? updated : m
    );

    // Sync derived display hats onto any linked roster entry (§8.4)
    if (membership.userId) {
      const linkedIdx = props.members.findIndex(
        (rm) => rm.userId === membership.userId
      );
      if (linkedIdx >= 0) {
        const target = props.members[linkedIdx];
        const nextHats = deriveMemberHatsFromRoles(merged, target);
        const nextMembers = props.members.map((rm, idx) =>
          idx === linkedIdx
            ? {
                ...rm,
                hats: nextHats,
                canVote: nextHats.some((h) => MEMBER_HAT_META[h]?.canVote),
              }
            : rm
        );
        emit('update:members', nextMembers);
      }
    }

    await refreshCoopIdentity(true);
    addToast({
      type: 'success',
      message: `Updated roles for ${membership.userName || membership.userEmail}.`,
    });
  } catch (err: any) {
    console.warn('[CoopRolesPanel] Role update failed:', err);
    addToast({
      type: 'error',
      message: toUserMessage(err, "Couldn't update Member Hats — please try again."),
    });
  } finally {
    savingMembershipId.value = '';
  }
}

function handleLinkSelect(membership: any, selectedRosterName: string) {
  if (!canManageLinks.value) return;
  const uid = String(membership.userId || '').trim();
  if (!uid) return;

  const nextMembers = props.members.map((rm) => {
    // Clear any previous roster row linked to this userId first (1-to-1 link)
    if (rm.userId === uid && rm.name !== selectedRosterName) {
      return { ...rm, userId: undefined, email: undefined };
    }
    if (rm.name === selectedRosterName) {
      const derivedHats = deriveMemberHatsFromRoles(membership.roles || [], rm);
      return {
        ...rm,
        userId: uid,
        email: membership.userEmail
          ? String(membership.userEmail).toLowerCase()
          : rm.email,
        hats: derivedHats,
        canVote: derivedHats.some((h) => MEMBER_HAT_META[h]?.canVote),
      };
    }
    return rm;
  });

  emit('update:members', nextMembers);
}

async function handleInviteMember() {
  if (!isOwner.value || !resolvedTeamId.value) return;
  const email = inviteForm.value.email.trim().toLowerCase();
  const name = inviteForm.value.name.trim();
  const invitedRole = inviteForm.value.initialRole;
  if (!email || !name) return;

  // Auto-pair 'curator' ONLY on initial invite for voting/provider roles; keep 'consignor' isolated (§14A).
  const pairedCustomRoles = ensureCuratorBaseRoles([invitedRole]) as MemberHat[];
  const teamRoles = Array.from(new Set(['member', ...pairedCustomRoles]));

  inviting.value = true;
  try {
    const redirectUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/coop/governance`
        : 'https://works.thehc.llc/coop/governance';
    const created = await teams.createMembership(
      resolvedTeamId.value,
      teamRoles,
      email,
      undefined,
      undefined,
      redirectUrl,
      name
    );
    memberships.value = [created, ...memberships.value];

    // Auto-upsert & link a matching Roster profile so the Founder never has to add them twice.
    const createdUid = created?.userId ? String(created.userId).trim() : '';
    const existingIdx = props.members.findIndex(
      (rm) =>
        (createdUid && rm.userId === createdUid) ||
        (rm.email && rm.email.trim().toLowerCase() === email) ||
        rm.name.trim().toLowerCase() === name.toLowerCase()
    );
    const derivedHats = deriveMemberHatsFromRoles(teamRoles);
    const isConsignorOnly = derivedHats.length === 1 && derivedHats[0] === 'consignor';
    const usesPrefix = derivedHats.some((h) => MEMBER_HAT_META[h]?.usesPrefix);

    if (existingIdx >= 0) {
      const nextMembers = props.members.map((rm, idx) => {
        if (idx !== existingIdx) return rm;
        const mergedHats = Array.from(new Set([...(rm.hats || []), ...derivedHats])) as MemberHat[];
        return {
          ...rm,
          userId: createdUid || rm.userId,
          email,
          hats: mergedHats,
          canVote: mergedHats.some((h) => MEMBER_HAT_META[h]?.canVote),
        };
      });
      emit('update:members', nextMembers);
    } else {
      const partner: CoopMemberProfile['partner'] = isConsignorOnly
        ? 'BB'
        : invitedRole === 'curator' || invitedRole === 'founder'
          ? 'HUCK'
          : 'SWEAT';
      const roleLabel: CoopMemberProfile['role'] = isConsignorOnly
        ? 'Consignor'
        : invitedRole === 'founder'
          ? 'Co-op Member'
          : invitedRole === 'curator'
            ? 'Partner Curator'
            : 'Marketing & Social Enabler';
      const newProfile: CoopMemberProfile = {
        name,
        partner,
        role: roleLabel,
        canVote: derivedHats.some((h) => MEMBER_HAT_META[h]?.canVote),
        userId: createdUid || undefined,
        email,
        hats: derivedHats,
        inventoryPrefix: usesPrefix ? (isConsignorOnly ? 'BB-' : 'HUCK-') : undefined,
      };
      emit('update:members', [...props.members, newProfile]);
    }

    inviteForm.value = { name: '', email: '', initialRole: 'enabler' };
    addToast({
      type: 'success',
      message: `Sent Collective invite to ${email} (${pairedCustomRoles.join(' + ')}) & added to Roster.`,
    });
  } catch (err: any) {
    console.warn('[CoopRolesPanel] Invite failed:', err);
    addToast({
      type: 'error',
      message: toUserMessage(err, "Couldn't send invitation — please try again."),
    });
  } finally {
    inviting.value = false;
  }
}

watch(resolvedTeamId, (id) => {
  if (id) loadMemberships();
});

onMounted(async () => {
  await refreshCoopIdentity();
  if (resolvedTeamId.value) {
    await loadMemberships();
  }
});
</script>
