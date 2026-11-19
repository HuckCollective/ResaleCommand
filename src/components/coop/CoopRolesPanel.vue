<template>
  <div class="rounded-2xl border border-primary/25 bg-base-200/35 p-4 sm:p-5 space-y-4">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="space-y-0.5">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="badge badge-primary text-primary-content badge-xs font-black">Member Hats &amp; Access</span>
          <span class="badge badge-outline badge-xs font-mono font-bold">🔒 Steward-Verified</span>
          <span
            v-if="isOwner || isFounder"
            class="badge badge-success text-success-content badge-xs font-bold"
          >
            👑 Account Steward Active
          </span>
          <span
            v-else
            class="badge badge-ghost badge-xs font-semibold"
          >
            👁️ Read-Only (Account Steward Edits Hats &amp; Locks SKUs)
          </span>
        </div>
        <h4 class="text-base font-black text-base-content">
          Unified Collective Roster &amp; Unique Curator SKUs
        </h4>
        <p class="text-xs text-base-content/70">
          Every voting member is a Curator with their own unique barcode prefix (hyphen added automatically) and open-book financial visibility.
        </p>
      </div>

      <div class="flex items-center gap-2 flex-wrap self-start sm:self-auto">
        <button
          v-if="canManageLinks && hasStaleOrSharedRows"
          type="button"
          class="btn btn-xs h-11 min-h-11 md:h-8 md:min-h-0 btn-warning text-warning-content rounded-xl font-black gap-1.5"
          :disabled="cleaningRoster"
          @click="handleCleanupPlaceholders"
        >
          <span v-if="cleaningRoster" class="loading loading-spinner loading-xs"></span>
          <span v-else>🧹 Clean Up Stale Rows</span>
        </button>

        <button
          type="button"
          class="btn btn-xs h-11 min-h-11 md:h-8 md:min-h-0 btn-outline rounded-xl font-bold gap-1.5"
          :disabled="loadingMemberships"
          @click="loadMemberships"
        >
          <Icon icon="solar:refresh-bold" class="w-3.5 h-3.5" :class="{ 'animate-spin': loadingMemberships }" />
          <span>Refresh Roster</span>
        </button>
      </div>
    </div>

    <!-- Stale Placeholder / Shared HUCK- Repair Notice -->
    <div
      v-if="canManageLinks && hasStaleOrSharedRows"
      class="alert alert-warning py-2.5 px-3.5 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
    >
      <span>
        <strong>Roster Sync Ready:</strong> Older placeholder rows or shared <code>HUCK-</code> defaults were detected. Click <strong>Clean Up Stale Rows</strong> or lock each member's unique SKU prefix below.
      </span>
    </div>

    <!-- Invite New Collective Member Bar (Steward Only; Consignor Frozen) -->
    <form
      v-if="isOwner && resolvedTeamId"
      class="rounded-xl bg-base-100 border border-base-300 p-3.5 space-y-2.5"
      @submit.prevent="handleInviteMember"
    >
      <div class="text-xs font-black text-base-content flex items-center justify-between gap-2 flex-wrap">
        <span class="flex items-center gap-1.5">
          <Icon icon="solar:user-plus-bold-duotone" class="w-4 h-4 text-primary" />
          <span>Invite Real Member to the Collective</span>
        </span>
        <span class="text-[11px] font-semibold text-base-content/60">
          Every member joins as a Curator and chooses their own unique SKU prefix
        </span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
        <div class="sm:col-span-4 form-control">
          <label class="label py-0.5"><span class="label-text text-[11px] font-bold">Full Name</span></label>
          <input
            v-model="inviteForm.name"
            type="text"
            autocomplete="name"
            placeholder="e.g. Alex Rivera"
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
            placeholder="member@example.com"
            class="input input-bordered input-xs h-11 md:h-8 rounded-lg text-xs font-mono"
            required
          />
        </div>
        <div class="sm:col-span-4 flex items-center justify-between sm:justify-end gap-2 flex-wrap">
          <select
            v-model="inviteForm.initialRole"
            aria-label="Initial Member Role"
            class="select select-bordered select-xs h-11 md:h-8 rounded-lg font-bold text-xs"
          >
            <option value="curator">💎 Curator Member</option>
            <option value="promoter">📣 Curator + Promoter</option>
            <option value="enabler">🔥 Curator + Floor Ops</option>
            <option value="builder">🛠️ Curator + Builder</option>
            <option value="founder">👑 Co-Founder + Curator</option>
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

    <!-- Single Unified Roster & Unique Barcode Prefix Table -->
    <div v-if="memberships.length > 0 || legacyConsignors.length > 0" class="overflow-x-auto bg-base-100 border border-base-200 rounded-2xl">
      <table class="table table-sm">
        <thead>
          <tr class="bg-base-200/60 text-[11px] font-extrabold uppercase text-base-content/70">
            <th>Member &amp; Account</th>
            <th>Status &amp; Vote</th>
            <th>Collective Hats &amp; Permissions</th>
            <th>🏷️ Unique SKU Prefix</th>
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
                <span>{{ displayNameForMembership(m) }}</span>
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

            <td class="space-y-1.5">
              <div>
                <span
                  class="badge badge-xs font-bold whitespace-nowrap"
                  :class="m.confirm ? 'badge-success text-success-content' : 'badge-warning badge-outline'"
                >
                  {{ m.confirm ? '✅ Active' : '⏳ Pending Invite' }}
                </span>
              </div>
              <div
                v-if="!m.confirm && canManageLinks && !hasBuiltInOwner(m)"
                class="flex items-center gap-1 flex-wrap"
              >
                <button
                  type="button"
                  class="btn btn-2xs h-8 md:h-6 min-h-0 px-2 btn-success btn-outline rounded-lg font-black"
                  :disabled="pendingActionRowId === m.$id"
                  title="Confirm this member as Active immediately without waiting for an email click"
                  @click="runPendingMembershipAction(m, 'activate')"
                >
                  {{ pendingActionRowId === m.$id ? '…' : '✅ Activate' }}
                </button>
                <button
                  type="button"
                  class="btn btn-2xs h-8 md:h-6 min-h-0 px-2 btn-ghost border border-base-300 rounded-lg font-bold"
                  :disabled="pendingActionRowId === m.$id"
                  title="Re-send a working invitation email"
                  @click="runPendingMembershipAction(m, 'resend')"
                >
                  📧 Resend
                </button>
                <button
                  type="button"
                  class="btn btn-2xs h-8 md:h-6 min-h-0 px-1.5 btn-ghost text-error rounded-lg font-bold"
                  :disabled="pendingActionRowId === m.$id"
                  title="Cancel pending invite"
                  @click="confirmCancelPendingInvite(m)"
                >
                  ✕
                </button>
              </div>
              <div class="text-[10px] font-bold text-base-content/60">
                {{ hasCustomRole(m, 'consignor') && !hasCustomRole(m, 'curator') ? 'Statement Only' : '1 Member = 1 Vote' }}
              </div>
            </td>

            <td>
              <div class="flex items-center gap-1.5 flex-wrap">
                <label
                  v-for="roleOpt in visibleRoleOptionsForRow(m)"
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

            <td class="min-w-60">
              <!-- Case 1: Requested prefix waiting on Steward Lock -->
              <div
                v-if="requestedPrefixForRow(m) && editingPrefixRowId !== m.$id"
                class="flex items-center gap-1.5 flex-wrap"
              >
                <span class="badge badge-warning text-warning-content font-mono font-black badge-sm whitespace-nowrap">
                  ⏳ Requested: {{ requestedPrefixForRow(m) }}
                </span>
                <button
                  v-if="canManageLinks"
                  type="button"
                  class="btn btn-xs h-9 md:h-7 btn-success text-success-content rounded-lg font-black"
                  :disabled="lockingRowId === m.$id"
                  @click="lockPrefixForMembership(m, requestedPrefixForRow(m))"
                >
                  {{ lockingRowId === m.$id ? 'Locking…' : `✅ Lock ${requestedPrefixForRow(m)}` }}
                </button>
                <button
                  v-if="canManageLinks"
                  type="button"
                  class="btn btn-xs h-9 md:h-7 btn-ghost rounded-lg font-bold"
                  @click="openInlinePrefixEditor(m)"
                >
                  Edit
                </button>
              </div>

              <!-- Case 2: Uniquely Locked Prefix (not a duplicate placeholder HUCK-) -->
              <div
                v-else-if="uniqueLockedPrefixForRow(m) && editingPrefixRowId !== m.$id"
                class="flex items-center gap-1.5 flex-wrap"
              >
                <span class="badge badge-outline font-mono font-black badge-sm py-2.5 px-2.5 whitespace-nowrap">
                  🔒 {{ uniqueLockedPrefixForRow(m) }}
                </span>
                <button
                  v-if="canManageLinks"
                  type="button"
                  class="btn btn-xs h-9 md:h-7 btn-ghost text-base-content/65 rounded-lg font-semibold"
                  title="Issue a new future SKU prefix (printed booth stickers keep their existing code)"
                  @click="openInlinePrefixEditor(m)"
                >
                  Change
                </button>
              </div>

              <!-- Case 3: Unset, Shared HUCK- Warning, or Inline Editor Open -->
              <div v-else class="space-y-1">
                <div
                  v-if="hasSharedPlaceholderPrefix(m) && editingPrefixRowId !== m.$id"
                  class="text-[11px] font-bold text-warning"
                >
                  ⚠️ Shared <code>HUCK-</code> — assign own SKU:
                </div>
                <div v-if="canManageLinks" class="flex items-center gap-1.5 flex-wrap">
                  <div class="join">
                    <input
                      :value="prefixDrafts[m.$id] || ''"
                      type="text"
                      maxlength="6"
                      placeholder="DOM"
                      aria-label="Member SKU Prefix Root"
                      class="input input-bordered input-xs join-item h-10 md:h-7 w-20 font-mono font-black uppercase text-xs"
                      :disabled="lockingRowId === m.$id"
                      @input="onRowDraftInput(m.$id, ($event.target as HTMLInputElement).value)"
                      @keydown.enter.prevent="submitInlinePrefixLock(m)"
                    />
                    <span class="btn btn-xs btn-neutral no-animation pointer-events-none join-item h-10 md:h-7 px-2 font-mono font-black">
                      -
                    </span>
                  </div>
                  <button
                    type="button"
                    class="btn btn-xs h-10 md:h-7 btn-primary text-primary-content rounded-lg font-black px-2.5"
                    :disabled="lockingRowId === m.$id || (prefixDrafts[m.$id] || '').length < 2"
                    @click="submitInlinePrefixLock(m)"
                  >
                    {{ lockingRowId === m.$id ? '…' : '🔒 Lock' }}
                  </button>
                  <button
                    v-if="editingPrefixRowId === m.$id"
                    type="button"
                    class="btn btn-xs h-10 md:h-7 btn-ghost rounded-lg"
                    @click="editingPrefixRowId = ''"
                  >
                    ✕
                  </button>
                </div>
                <span v-else class="badge badge-ghost badge-xs font-semibold">
                  ⚡ Member Picking SKU
                </span>
              </div>
            </td>
          </tr>

          <!-- Legacy External Consignor Row(s) (BB- Preserved; New Consignors Paused) -->
          <tr
            v-for="c in legacyConsignors"
            :key="`consignor-${c.prefix}`"
            class="bg-warning/5 align-middle"
          >
            <td class="text-xs">
              <div class="font-bold text-base-content flex items-center gap-1.5 flex-wrap">
                <span>{{ c.displayName }}</span>
                <span class="badge badge-warning badge-outline badge-xs font-bold">Legacy Consignor</span>
              </div>
              <div class="text-[11px] text-base-content/60">External consignment contract (new consignors paused)</div>
            </td>
            <td>
              <span class="badge badge-ghost badge-xs font-semibold">Contract Only (No Vote)</span>
            </td>
            <td>
              <span class="badge badge-warning text-warning-content badge-xs font-bold">🏷️ Consignor</span>
            </td>
            <td>
              <span class="badge badge-outline font-mono font-black badge-sm py-2.5 px-2.5">🔒 {{ c.prefix }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Hat-Derived BCC Group Emails (Consignors Strictly Excluded §14A) -->
    <div
      v-if="hasAnyBccEmails"
      class="rounded-xl bg-base-100 border border-base-300 p-3.5 space-y-2.5"
    >
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div class="text-xs font-black text-base-content flex items-center gap-1.5">
            <Icon icon="solar:letter-bold-duotone" class="w-4 h-4 text-primary shrink-0" />
            <span>Hat-Based Group Email (BCC)</span>
          </div>
          <p class="text-[11px] text-base-content/65">
            Addresses stay private in BCC. Consignors are never included in collective group lists.
          </p>
        </div>

        <div v-if="activeBccGroup && activeBccGroup.count > 0" class="flex items-center gap-2 flex-wrap shrink-0">
          <a
            :href="activeBccGroup.mailtoHref"
            class="btn btn-xs h-11 md:h-8 btn-outline btn-primary rounded-lg font-black gap-1.5"
          >
            <span>✉️ Email {{ activeBccGroup.label }} ({{ activeBccGroup.count }})</span>
          </a>
          <button
            type="button"
            class="btn btn-xs h-11 md:h-8 btn-ghost border border-base-300 rounded-lg font-bold gap-1"
            @click="copyActiveBccEmails"
          >
            <Icon icon="solar:copy-bold" class="w-3.5 h-3.5 text-primary shrink-0" />
            <span>Copy BCC</span>
          </button>
        </div>
      </div>

      <div class="flex items-center gap-1.5 flex-wrap">
        <button
          v-for="grp in bccGroups"
          :key="grp.id"
          type="button"
          class="btn btn-xs h-11 md:h-7 rounded-lg font-bold gap-1"
          :class="selectedBccGroupId === grp.id ? 'btn-secondary text-secondary-content' : 'btn-ghost bg-base-200/60'"
          :disabled="grp.count === 0"
          @click="selectedBccGroupId = grp.id"
        >
          <span>{{ grp.icon }} {{ grp.label }}</span>
          <span class="badge badge-2xs font-mono whitespace-nowrap shrink-0">{{ grp.count }}</span>
        </button>
      </div>
    </div>

    <div class="text-[11px] text-base-content/65 flex items-center justify-between gap-2 flex-wrap">
      <span>
        <strong>Founder power:</strong> approves SKU locks, PO receipts, expenses, labor &amp; month locks.
        <strong>Curators:</strong> all real members — open-book financials + own-SKU inventory control.
        <strong>Legacy BB-:</strong> own statement only.
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
import { askConfirm } from '../../stores/confirm';
import { useAuth } from '../../composables/useAuth';
import { useMemberCapabilities } from '../../lib/memberAccess';
import { useCoopFounderGate } from '../../composables/useCoopFounderGate';
import { getCoopJwtHeaders } from '../../lib/coopLedgerClient';
import {
  deriveMemberHatsFromRoles,
  ensureCuratorBaseRoles,
  formatAutoHyphenPrefix,
  MEMBER_HAT_META,
  sanitizePrefixRootInput,
  type ConsignorAgreementConfig,
  type CoopMemberProfile,
  type MemberHat,
} from '../../lib/coopGovernance';
import { buildHatBccGroups, type BccGroupKey } from '../../lib/coopTaskBoard';
import { toUserMessage } from '../../lib/userFacingErrors';

const props = withDefaults(
  defineProps<{
    members: CoopMemberProfile[];
    consignors?: ConsignorAgreementConfig[];
    canManageRosterLinks?: boolean;
  }>(),
  {
    consignors: () => [],
    canManageRosterLinks: false,
  }
);

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
const { refreshCapabilities } = useMemberCapabilities();
const { coopIdentity, isOwner, isFounder, soleFounder, refreshCoopIdentity } =
  useCoopFounderGate();

const memberships = ref<any[]>([]);
const loadingMemberships = ref(false);
const savingMembershipId = ref('');
const pendingActionRowId = ref('');
const lockingRowId = ref('');
const editingPrefixRowId = ref('');
const cleaningRoster = ref(false);
const inviting = ref(false);
const errorMessage = ref('');
const selectedBccGroupId = ref<BccGroupKey>('all_voting');
const prefixDrafts = ref<Record<string, string>>({});

const legacyConsignors = computed(() => props.consignors || []);

const bccGroups = computed(() =>
  buildHatBccGroups(memberships.value, props.members)
);

const hasAnyBccEmails = computed(() =>
  bccGroups.value.some((g) => g.count > 0)
);

const activeBccGroup = computed(
  () =>
    bccGroups.value.find((g) => g.id === selectedBccGroupId.value) ||
    bccGroups.value[0]
);

function visibleRoleOptionsForRow(m: any) {
  if (hasCustomRole(m, 'consignor')) return customRoleOptions;
  return customRoleOptions.filter((r) => r.id !== 'consignor');
}

async function copyActiveBccEmails() {
  const grp = activeBccGroup.value;
  if (!grp || grp.emails.length === 0) return;
  try {
    await navigator.clipboard.writeText(grp.emails.join(', '));
    addToast({
      type: 'success',
      message: `Copied ${grp.count} ${grp.label} email(s) — paste into your email BCC field.`,
    });
  } catch {
    addToast({
      type: 'warning',
      message: 'Could not copy automatically — click Email button to open your mail app.',
    });
  }
}

const inviteForm = ref<{
  name: string;
  email: string;
  initialRole: Exclude<CustomRoleId, 'consignor'>;
}>({
  name: '',
  email: '',
  initialRole: 'curator',
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

/**
 * Audit Fix #2: Strict 1-to-1 account matching by userId -> email ONLY (never fuzzy display name!).
 */
function rosterIndexForMembership(m: any): number {
  const uid = String(m?.userId || '').trim();
  const email = String(m?.userEmail || '').trim().toLowerCase();
  if (uid) {
    const byUid = props.members.findIndex((rm) => rm.userId && rm.userId.trim() === uid);
    if (byUid >= 0) return byUid;
  }
  if (email) {
    const byEmail = props.members.findIndex(
      (rm) =>
        (!rm.userId || !uid || rm.userId.trim() === uid) &&
        rm.email &&
        rm.email.trim().toLowerCase() === email
    );
    if (byEmail >= 0) return byEmail;
  }
  return -1;
}

function profileForMembership(m: any): CoopMemberProfile | undefined {
  const idx = rosterIndexForMembership(m);
  return idx >= 0 ? props.members[idx] : undefined;
}

function displayNameForMembership(m: any): string {
  const rawUserName = String(m?.userName || '').trim();
  if (rawUserName && !rawUserName.includes('@')) return rawUserName;
  const prof = profileForMembership(m);
  if (prof?.name && !prof.name.includes('(')) return prof.name;
  return rawUserName || String(m?.userEmail || 'Invited Member');
}

function isStewardHuckOwner(m: any): boolean {
  const email = String(m?.userEmail || '').trim().toLowerCase();
  return hasBuiltInOwner(m) || email === 'huck@thehc.llc';
}

function hasSharedPlaceholderPrefix(m: any): boolean {
  const prof = profileForMembership(m);
  if (!prof?.inventoryPrefix) return false;
  const norm = formatAutoHyphenPrefix(prof.inventoryPrefix);
  if (norm === 'HUCK-' && !isStewardHuckOwner(m) && !prof.prefixLockedAt) {
    return true;
  }
  // Check if another distinct membership row also claims this exact prefix
  const otherClaim = memberships.value.some((other) => {
    if (other.$id === m.$id) return false;
    const otherProf = profileForMembership(other);
    if (!otherProf?.inventoryPrefix) return false;
    if (formatAutoHyphenPrefix(otherProf.inventoryPrefix) !== norm) return false;
    // If the other row is the primary steward for HUCK-, mark non-steward as shared
    return isStewardHuckOwner(other) || Boolean(otherProf.prefixLockedAt && !prof.prefixLockedAt);
  });
  return otherClaim;
}

function requestedPrefixForRow(m: any): string {
  const prof = profileForMembership(m);
  return prof?.requestedPrefix ? formatAutoHyphenPrefix(prof.requestedPrefix) : '';
}

function uniqueLockedPrefixForRow(m: any): string {
  if (hasSharedPlaceholderPrefix(m)) return '';
  const prof = profileForMembership(m);
  if (prof?.inventoryPrefix) return formatAutoHyphenPrefix(prof.inventoryPrefix);
  if (isStewardHuckOwner(m)) return 'HUCK-';
  return '';
}

const hasStaleOrSharedRows = computed(() => {
  const hasUnlinkedPlaceholders = props.members.some(
    (rm) => !rm.userId && !rm.email && rm.partner !== 'BB'
  );
  const hasShared = memberships.value.some((m) => hasSharedPlaceholderPrefix(m));
  return hasUnlinkedPlaceholders || hasShared;
});

function onRowDraftInput(rowId: string, val: string) {
  prefixDrafts.value = {
    ...prefixDrafts.value,
    [rowId]: sanitizePrefixRootInput(val),
  };
}

function openInlinePrefixEditor(m: any) {
  const current = uniqueLockedPrefixForRow(m).replace(/-$/, '');
  prefixDrafts.value = {
    ...prefixDrafts.value,
    [m.$id]: current === 'HUCK' && !isStewardHuckOwner(m) ? '' : current,
  };
  editingPrefixRowId.value = m.$id;
}

async function submitInlinePrefixLock(m: any) {
  const root = sanitizePrefixRootInput(prefixDrafts.value[m.$id] || '');
  if (root.length < 2) return;
  await lockPrefixForMembership(m, root);
}

async function lockPrefixForMembership(m: any, rawPrefix: string) {
  if (!canManageLinks.value) return;
  lockingRowId.value = m.$id;
  try {
    const headers = await getCoopJwtHeaders();
    const res = await fetch('/api/coop/prefix-request', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'lock',
        prefix: rawPrefix,
        targetUserId: m.userId || undefined,
        targetEmail: m.userEmail || undefined,
        targetName: displayNameForMembership(m),
        targetRoles: Array.isArray(m.roles) ? m.roles : ['curator'],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || 'Could not lock SKU prefix.');
    }
    if (Array.isArray(data?.policyConfig?.members)) {
      emit('update:members', data.policyConfig.members);
    }
    editingPrefixRowId.value = '';
    await refreshCapabilities();
    const formatted = formatAutoHyphenPrefix(rawPrefix);
    addToast({
      type: 'success',
      message: `Locked unique SKU prefix ${formatted} for ${displayNameForMembership(m)}.`,
    });
  } catch (err: any) {
    addToast({
      type: 'error',
      message: toUserMessage(err, 'Could not lock SKU prefix.'),
    });
  } finally {
    lockingRowId.value = '';
  }
}

async function handleCleanupPlaceholders() {
  if (!canManageLinks.value) return;
  cleaningRoster.value = true;
  try {
    const headers = await getCoopJwtHeaders();
    const res = await fetch('/api/coop/prefix-request', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cleanup_placeholders' }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || 'Could not clean up stale roster rows.');
    }
    if (Array.isArray(data?.policyConfig?.members)) {
      emit('update:members', data.policyConfig.members);
    }
    await refreshCapabilities();
    addToast({
      type: 'success',
      message: 'Synced Collective Roster — stale placeholder rows cleared!',
    });
  } catch (err: any) {
    addToast({
      type: 'error',
      message: toUserMessage(err, 'Could not clean up stale roster rows.'),
    });
  } finally {
    cleaningRoster.value = false;
  }
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

  const builtIns = existingRoles.filter((r) => !CUSTOM_ROLE_IDS.has(r));
  const currentCustom = new Set(existingRoles.filter((r) => CUSTOM_ROLE_IDS.has(r)));

  if (currentCustom.has(roleId)) {
    currentCustom.delete(roleId);
  } else {
    currentCustom.add(roleId);
  }

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

    const linkedIdx = rosterIndexForMembership(membership);
    if (linkedIdx >= 0) {
      const target = props.members[linkedIdx];
      const nextHats = deriveMemberHatsFromRoles(merged, target);
      const nextMembers = props.members.map((rm, idx) =>
        idx === linkedIdx
          ? {
              ...rm,
              userId: membership.userId || rm.userId,
              email: membership.userEmail
                ? String(membership.userEmail).toLowerCase()
                : rm.email,
              hats: nextHats,
              canVote: nextHats.some((h) => MEMBER_HAT_META[h]?.canVote),
            }
          : rm
      );
      emit('update:members', nextMembers);
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

async function confirmCancelPendingInvite(m: any) {
  const label = m.userEmail || displayNameForMembership(m);
  const ok = await askConfirm(
    `Cancel pending invitation for ${label}? You can always invite them again later.`,
    'Cancel Pending Invite',
    'Cancel Invite',
    'Keep Pending',
    'btn-error'
  );
  if (!ok) return;
  await runPendingMembershipAction(m, 'cancel');
}

async function runPendingMembershipAction(m: any, action: 'activate' | 'resend' | 'cancel') {
  if (!canManageLinks.value) return;
  pendingActionRowId.value = m.$id;
  try {
    const headers = await getCoopJwtHeaders();
    const res = await fetch('/api/coop/membership-action', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        membershipId: m.$id,
        origin: typeof window !== 'undefined' ? window.location.origin : undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || 'Could not update pending invitation.');
    }

    if (action === 'cancel') {
      memberships.value = memberships.value.filter((row) => row.$id !== m.$id);
      addToast({
        type: 'info',
        message: `Cancelled pending invite for ${m.userEmail || displayNameForMembership(m)}.`,
      });
      return;
    }

    if (data?.membership) {
      memberships.value = memberships.value.map((row) =>
        row.$id === m.$id ? data.membership : row
      );
    }

    if (action === 'activate') {
      await refreshCoopIdentity(true);
      await refreshCapabilities();
      addToast({
        type: 'success',
        message: data?.hasPassword
          ? `Activated ${displayNameForMembership(m)}! They are now Active in the Collective.`
          : `Activated ${displayNameForMembership(m)}! Since they haven't chosen a password yet, have them click "Forgot / Set password?" on /login.`,
      });
    } else {
      addToast({
        type: 'success',
        message: `Sent a fresh invitation email to ${m.userEmail || displayNameForMembership(m)}.`,
      });
    }
  } catch (err: any) {
    addToast({
      type: 'error',
      message: toUserMessage(err, 'Could not update pending invitation.'),
    });
  } finally {
    pendingActionRowId.value = '';
  }
}

async function handleInviteMember() {
  if (!isOwner.value || !resolvedTeamId.value) return;
  const email = inviteForm.value.email.trim().toLowerCase();
  const name = inviteForm.value.name.trim();
  const invitedRole = inviteForm.value.initialRole;
  if (!email || !name) return;

  // Every real invited member includes 'curator' base role (§14A).
  const pairedCustomRoles = ensureCuratorBaseRoles([invitedRole]) as MemberHat[];
  const teamRoles = Array.from(new Set(['member', ...pairedCustomRoles]));

  inviting.value = true;
  try {
    const redirectUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/join`
        : 'https://works.thehc.llc/join';
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

    const createdUid = created?.userId ? String(created.userId).trim() : '';
    const existingIdx = props.members.findIndex(
      (rm) =>
        (createdUid && rm.userId === createdUid) ||
        (!rm.userId && rm.email && rm.email.trim().toLowerCase() === email)
    );
    const derivedHats = deriveMemberHatsFromRoles(teamRoles);

    if (existingIdx >= 0) {
      const nextMembers = props.members.map((rm, idx) => {
        if (idx !== existingIdx) return rm;
        const mergedHats = Array.from(new Set([...(rm.hats || []), ...derivedHats])) as MemberHat[];
        return {
          ...rm,
          name: rm.name.includes('(') ? name : rm.name,
          userId: createdUid || rm.userId,
          email,
          hats: mergedHats,
          canVote: mergedHats.some((h) => MEMBER_HAT_META[h]?.canVote),
        };
      });
      emit('update:members', nextMembers);
    } else {
      // New Curator starts with prefixStatus: 'unset' so they pick/lock their OWN unique SKU (never sharing HUCK-)!
      const newProfile: CoopMemberProfile = {
        name,
        partner: 'CURATOR',
        role: invitedRole === 'founder' ? 'Co-op Member' : 'Partner Curator',
        canVote: derivedHats.some((h) => MEMBER_HAT_META[h]?.canVote),
        userId: createdUid || undefined,
        email,
        hats: derivedHats,
        inventoryPrefix: undefined,
        prefixStatus: 'unset',
      };
      emit('update:members', [...props.members, newProfile]);
    }

    inviteForm.value = { name: '', email: '', initialRole: 'curator' };
    addToast({
      type: 'success',
      message: `Sent Collective invite to ${email} (${pairedCustomRoles.join(' + ')}). They can request their unique SKU on their Profile!`,
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
