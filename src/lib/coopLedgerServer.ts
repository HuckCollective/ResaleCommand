import { Account, Client, Databases, Query, Teams } from 'node-appwrite';
import { createHash } from 'node:crypto';
import { getDatabaseId, getEnvVar } from './appwriteEnv';
import {
  COOP_GOVERNANCE_DOC_ID,
  COOP_LABOR_CATEGORIES,
  currentPacificMonthKey,
  DEFAULT_COOP_POLICY_CONFIG,
  effectiveLaborApproval,
  inferPartnerFromMemberName,
  isDemoSeedLaborEntry,
  isValidLaborEntryData,
  laborEntryMonthKey,
  normalizeLaborEntries,
  normalizePolicyConfig,
  pacificTodayYmd,
  type CoopLaborCategory,
  type CoopLaborEntry,
  type CoopMemberProfile,
  type CoopPolicyConfig,
} from './coopGovernance';
import {
  clampTaskPoints,
  CUSTOM_TASK_VOTE_WINDOW_MS,
  deterministicTaskLaborId,
  detectOwnBarcodeWarning,
  evaluateTaskValueVote,
  normalizeFunctionTag,
  normalizeTaskPresets,
  pruneTasksBoardForStorage,
  refreshTaskStatusesAt,
  resolvePeerApprovalPolicy,
  type CoopLaborFunctionTag,
  type CoopTaskItem,
  type CoopTaskPeerApproval,
  type CoopTaskPreset,
} from './coopTaskBoard';
import type {
  CoopAppwriteRole,
  CoopMeIdentity,
  CoopMonthLockRevisionDiffItem,
  CoopMonthLockSnapshot,
} from '../types/coop';

export const COOP_LEDGER_COL_ID = 'coop_ledger';
export const COOP_LABOR_INDEX_DOC_ID = 'coop_labor_months_index';
export const COOP_TASKS_BOARD_DOC_ID = 'coop_tasks_board';
const MANIFESTS_COL_ID = 'manifests';

export const COOP_VIEW_AND_LOG_ROLES: readonly CoopAppwriteRole[] = [
  'owner',
  'founder',
  'curator',
  'promoter',
  'enabler',
  'builder',
] as const;

export const COOP_FOUNDER_ROLES: readonly CoopAppwriteRole[] = [
  'owner',
  'founder',
] as const;

export const COOP_PRESET_EDIT_ROLES: readonly CoopAppwriteRole[] = [
  'owner',
  'founder',
  'builder',
] as const;

export const COOP_CMS_PUBLISH_ROLES: readonly CoopAppwriteRole[] = [
  'owner',
  'founder',
  'promoter',
  'builder',
] as const;

const KNOWN_ROLES = new Set<CoopAppwriteRole>([
  'owner',
  'founder',
  'curator',
  'promoter',
  'enabler',
  'builder',
  'consignor',
  'member',
]);

export interface CoopServerContext {
  endpoint: string;
  project: string;
  apiKey: string;
  dbId: string;
  coopTeamId: string;
  ledgerColId: string;
  databases: Databases;
  teams: Teams;
  keyClient: Client;
}

export class CoopHttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, message: string, code = 'COOP_ERROR') {
    super(message);
    this.name = 'CoopHttpError';
    this.status = status;
    this.code = code;
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof CoopHttpError) {
    return jsonResponse({ error: err.message, code: err.code }, err.status);
  }
  const msg = err instanceof Error ? err.message : 'Unexpected server error.';
  return jsonResponse({ error: msg, code: 'INTERNAL_ERROR' }, 500);
}

export function getCoopServerContext(): CoopServerContext {
  const endpoint = getEnvVar('PUBLIC_APPWRITE_ENDPOINT');
  const project = getEnvVar('PUBLIC_APPWRITE_PROJECT_ID');
  const apiKey = getEnvVar('APPWRITE_API_KEY');
  const coopTeamId = getEnvVar('COOP_TEAM_ID');

  if (!endpoint || !project || !apiKey) {
    throw new CoopHttpError(
      500,
      'Service temporarily unavailable — please try again.',
      'SERVER_CONFIG_ERROR'
    );
  }
  if (!coopTeamId) {
    throw new CoopHttpError(
      500,
      'COOP_TEAM_ID server environment variable is not configured.',
      'MISSING_COOP_TEAM_ID'
    );
  }

  const keyClient = new Client().setEndpoint(endpoint).setProject(project).setKey(apiKey);
  return {
    endpoint,
    project,
    apiKey,
    dbId: getDatabaseId(),
    coopTeamId,
    ledgerColId: getEnvVar('APPWRITE_COOP_LEDGER_COLLECTION_ID', COOP_LEDGER_COL_ID),
    databases: new Databases(keyClient),
    teams: new Teams(keyClient),
    keyClient,
  };
}

export function canonicalJsonStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map((item) => canonicalJsonStringify(item)).join(',') + ']';
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((k) => record[k] !== undefined)
    .sort();
  return (
    '{' +
    keys
      .map((k) => `${JSON.stringify(k)}:${canonicalJsonStringify(record[k])}`)
      .join(',') +
    '}'
  );
}

export function computeSnapshotHash(
  snapshotWithoutHash: Omit<CoopMonthLockSnapshot, 'snapshotHash'> & { snapshotHash?: string }
): string {
  const clone: Record<string, unknown> = { ...snapshotWithoutHash };
  delete clone.snapshotHash;
  const canonical = canonicalJsonStringify(clone);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export function verifySnapshotHash(snapshot: CoopMonthLockSnapshot): boolean {
  if (!snapshot || !snapshot.snapshotHash) return false;
  const expected = computeSnapshotHash(snapshot);
  return expected === snapshot.snapshotHash;
}

export async function loadGovernancePolicyOnServer(
  ctx: CoopServerContext
): Promise<{
  policyConfig: CoopPolicyConfig;
  rawManifestSnapshot: Record<string, any>;
  manifestExists: boolean;
}> {
  try {
    const doc: any = await ctx.databases.getDocument(
      ctx.dbId,
      MANIFESTS_COL_ID,
      COOP_GOVERNANCE_DOC_ID
    );
    let parsed: Record<string, any> = {};
    if (typeof doc.itemsSnapshot === 'string' && doc.itemsSnapshot.trim().startsWith('{')) {
      parsed = JSON.parse(doc.itemsSnapshot);
    }
    return {
      policyConfig: normalizePolicyConfig(parsed.policyConfig),
      rawManifestSnapshot: parsed,
      manifestExists: true,
    };
  } catch (err: any) {
    if (err?.code === 404) {
      return {
        policyConfig: normalizePolicyConfig(DEFAULT_COOP_POLICY_CONFIG),
        rawManifestSnapshot: {},
        manifestExists: false,
      };
    }
    throw err;
  }
}

export interface VerifiedCoopCaller extends CoopMeIdentity {
  rosterMembers: CoopMemberProfile[];
  linkedMember?: CoopMemberProfile;
  confirmedVotingMemberCount: number;
}

/**
 * Verifies Appwrite JWT + live confirmed membership in `COOP_TEAM_ID` (§8.2).
 * Never trusts client-supplied `tenantId` or client-writable roster hats.
 */
export async function resolveVerifiedCoopCaller(
  request: Request,
  ctx: CoopServerContext
): Promise<VerifiedCoopCaller> {
  const jwt = request.headers.get('X-Appwrite-JWT')?.trim();
  if (!jwt) {
    throw new CoopHttpError(
      401,
      'Authentication required: sign in to access Co-op ledger.',
      'UNAUTHENTICATED'
    );
  }

  let me: any;
  try {
    const userClient = new Client()
      .setEndpoint(ctx.endpoint)
      .setProject(ctx.project)
      .setJWT(jwt);
    me = await new Account(userClient).get();
  } catch {
    throw new CoopHttpError(
      401,
      'Your sign-in expired — please sign in again.',
      'INVALID_JWT'
    );
  }

  // Read live memberships strictly from server-configured COOP_TEAM_ID (Law 2 & §8.2)
  const membershipList = await ctx.teams.listMemberships(ctx.coopTeamId, [
    Query.limit(100),
  ]);
  const allConfirmed = (membershipList.memberships || []).filter(
    (m: any) => m.confirm === true
  );
  const confirmedFounderCount = allConfirmed.filter((m: any) =>
    (m.roles || []).some(
      (r: string) =>
        r.toLowerCase() === 'owner' || r.toLowerCase() === 'founder'
    )
  ).length;
  const rawConfirmedVotingCount = allConfirmed.filter((m: any) =>
    (m.roles || []).some((r: string) =>
      COOP_VIEW_AND_LOG_ROLES.includes(
        String(r || '').trim().toLowerCase() as CoopAppwriteRole
      )
    )
  ).length;

  const myConfirmedMembership = allConfirmed.find(
    (m: any) => m.userId === me.$id
  );
  const isBreakGlassAdmin = Array.isArray(me.labels) && me.labels.includes('admin');

  const normalizedRoles = new Set<CoopAppwriteRole>();
  if (myConfirmedMembership) {
    for (const rawRole of myConfirmedMembership.roles || []) {
      const clean = String(rawRole || '').trim().toLowerCase() as CoopAppwriteRole;
      if (KNOWN_ROLES.has(clean)) {
        normalizedRoles.add(clean);
      }
    }
  }
  if (isBreakGlassAdmin && !normalizedRoles.has('owner') && !normalizedRoles.has('founder')) {
    normalizedRoles.add('founder');
  }

  const roles = Array.from(normalizedRoles);
  const isOwner = normalizedRoles.has('owner');
  const isFounder = isOwner || normalizedRoles.has('founder') || isBreakGlassAdmin;
  const canViewLabor = roles.some((r) => COOP_VIEW_AND_LOG_ROLES.includes(r));
  const canLogLabor = canViewLabor;
  const soleFounder = isFounder && confirmedFounderCount <= 1;

  const { policyConfig } = await loadGovernancePolicyOnServer(ctx);
  const rosterMembers = policyConfig.members || [];
  const meEmailLower = String(me.email || '').trim().toLowerCase();
  const linkedMember =
    rosterMembers.find((m) => m.userId && m.userId === me.$id) ||
    (meEmailLower
      ? rosterMembers.find(
          (m) => !m.userId && m.email && m.email.trim().toLowerCase() === meEmailLower
        )
      : undefined);
  const linkedOwnedPrefixes = Array.from(
    new Set(
      [linkedMember?.inventoryPrefix, ...(linkedMember?.historicalPrefixes || [])]
        .map((p) => String(p || '').trim().toUpperCase())
        .filter(Boolean)
    )
  );

  return {
    authenticated: true,
    userId: String(me.$id),
    name: String(me.name || me.email || 'Co-op User'),
    email: String(me.email || ''),
    teamId: ctx.coopTeamId,
    confirmed: Boolean(myConfirmedMembership) || isBreakGlassAdmin,
    isBreakGlassAdmin,
    roles,
    isOwner,
    isFounder,
    soleFounder,
    canViewLabor,
    canLogLabor,
    canApproveLabor: isFounder,
    canLockMonth: isFounder,
    canEditGlobalFinancials: isFounder,
    linkedMemberName: linkedMember?.name,
    linkedPartner: linkedMember?.partner,
    linkedPrefix: linkedMember?.inventoryPrefix,
    prefixStatus: linkedMember?.prefixStatus,
    requestedPrefix: linkedMember?.requestedPrefix,
    ownedPrefixes: linkedOwnedPrefixes.length > 0 ? linkedOwnedPrefixes : undefined,
    rosterMembers,
    linkedMember,
    confirmedVotingMemberCount: Math.max(1, rawConfirmedVotingCount),
  };
}

export async function requireCoopRole(
  request: Request,
  ctx: CoopServerContext,
  allowedRoles: readonly CoopAppwriteRole[]
): Promise<VerifiedCoopCaller> {
  const caller = await resolveVerifiedCoopCaller(request, ctx);
  if (!caller.confirmed) {
    throw new CoopHttpError(
      403,
      'Confirmed membership in The Huckleberry Collective is required.',
      'UNCONFIRMED_OR_NON_MEMBER'
    );
  }
  const permitted = caller.roles.some((r) => allowedRoles.includes(r));
  if (!permitted) {
    throw new CoopHttpError(
      403,
      `Your Co-op role (${caller.roles.join(', ') || 'none'}) is not authorized for this action.`,
      'FORBIDDEN_ROLE'
    );
  }
  return caller;
}

export async function requireCoopFounder(
  request: Request,
  ctx: CoopServerContext
): Promise<VerifiedCoopCaller> {
  return requireCoopRole(request, ctx, COOP_FOUNDER_ROLES);
}

export async function requireCoopMember(
  request: Request,
  ctx: CoopServerContext
): Promise<VerifiedCoopCaller> {
  return requireCoopRole(request, ctx, COOP_VIEW_AND_LOG_ROLES);
}

export function laborDocIdForMonth(monthKey: string): string {
  return `coop_labor_${monthKey}`;
}

export function lockDocIdForMonth(monthKey: string): string {
  return `coop_lock_${monthKey}`;
}

export interface LaborAuditEvent {
  at: string;
  action: string;
  entryId?: string;
  byUserId: string;
  byName: string;
  breakGlass?: boolean;
  selfApproved?: boolean;
  note?: string;
}

export interface MonthlyLaborLedgerPayload {
  entries: CoopLaborEntry[];
  audit: LaborAuditEvent[];
}

export async function readMonthlyLaborDoc(
  ctx: CoopServerContext,
  monthKey: string
): Promise<{
  exists: boolean;
  version: number;
  entries: CoopLaborEntry[];
  audit: LaborAuditEvent[];
}> {
  const docId = laborDocIdForMonth(monthKey);
  try {
    const doc: any = await ctx.databases.getDocument(
      ctx.dbId,
      ctx.ledgerColId,
      docId
    );
    let parsed: Partial<MonthlyLaborLedgerPayload> = {};
    if (typeof doc.payloadJson === 'string' && doc.payloadJson.trim().startsWith('{')) {
      parsed = JSON.parse(doc.payloadJson);
    }
    return {
      exists: true,
      version: Number(doc.version || 1),
      entries: normalizeLaborEntries(parsed.entries || []),
      audit: Array.isArray(parsed.audit) ? parsed.audit : [],
    };
  } catch (err: any) {
    if (err?.code === 404) {
      return { exists: false, version: 0, entries: [], audit: [] };
    }
    throw err;
  }
}

async function ensureMonthIndexed(ctx: CoopServerContext, monthKey: string): Promise<void> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) return;
  const nowIso = new Date().toISOString();
  try {
    const existing: any = await ctx.databases.getDocument(
      ctx.dbId,
      ctx.ledgerColId,
      COOP_LABOR_INDEX_DOC_ID
    );
    let months: string[] = [];
    if (typeof existing.payloadJson === 'string' && existing.payloadJson.startsWith('{')) {
      const parsed = JSON.parse(existing.payloadJson);
      if (Array.isArray(parsed.months)) months = parsed.months;
    }
    if (!months.includes(monthKey)) {
      const nextMonths = Array.from(new Set([...months, monthKey])).sort();
      await ctx.databases.updateDocument(
        ctx.dbId,
        ctx.ledgerColId,
        COOP_LABOR_INDEX_DOC_ID,
        {
          version: Number(existing.version || 1) + 1,
          payloadJson: JSON.stringify({ months: nextMonths }),
          updatedAt: nowIso,
        }
      );
    }
  } catch (err: any) {
    if (err?.code === 404) {
      try {
        await ctx.databases.createDocument(
          ctx.dbId,
          ctx.ledgerColId,
          COOP_LABOR_INDEX_DOC_ID,
          {
            kind: 'months_index',
            monthKey: 'ALL',
            status: 'active',
            version: 1,
            payloadJson: JSON.stringify({ months: [monthKey] }),
            updatedAt: nowIso,
          },
          []
        );
      } catch {
        // Ignore benign concurrent index creation race
      }
    }
  }
}

export async function listIndexedLaborMonths(ctx: CoopServerContext): Promise<string[]> {
  const monthSet = new Set<string>();
  try {
    const idxDoc: any = await ctx.databases.getDocument(
      ctx.dbId,
      ctx.ledgerColId,
      COOP_LABOR_INDEX_DOC_ID
    );
    if (typeof idxDoc.payloadJson === 'string' && idxDoc.payloadJson.startsWith('{')) {
      const parsed = JSON.parse(idxDoc.payloadJson);
      for (const m of parsed.months || []) {
        if (/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) monthSet.add(m);
      }
    }
  } catch {
    // Fallback / supplement via listDocuments below
  }

  try {
    let cursor: string | null = null;
    while (true) {
      const queries = [Query.orderDesc('$id'), Query.limit(100)];
      if (cursor) queries.push(Query.cursorAfter(cursor));
      const list = await ctx.databases.listDocuments(
        ctx.dbId,
        ctx.ledgerColId,
        queries
      );
      const docs = list.documents || [];
      for (const doc of docs) {
        const mk = String((doc as any).monthKey || '');
        if (/^\d{4}-(0[1-9]|1[0-2])$/.test(mk) && (doc as any).kind === 'labor_month') {
          monthSet.add(mk);
        }
      }
      if (docs.length < 100) break;
      cursor = docs[docs.length - 1].$id;
    }
  } catch {
    // Ignore
  }

  return Array.from(monthSet).sort().reverse();
}

export async function writeMonthlyLaborDoc(
  ctx: CoopServerContext,
  monthKey: string,
  entries: CoopLaborEntry[],
  audit: LaborAuditEvent[],
  caller: VerifiedCoopCaller,
  expectedVersion?: number
): Promise<number> {
  const docId = laborDocIdForMonth(monthKey);
  const current = await readMonthlyLaborDoc(ctx, monthKey);
  if (expectedVersion !== undefined && current.exists && current.version !== expectedVersion) {
    throw new CoopHttpError(
      409,
      `Stale labor ledger version for ${monthKey} (expected v${expectedVersion}, found v${current.version}). Refresh and retry.`,
      'VERSION_CONFLICT'
    );
  }

  const nextVersion = current.version + 1;
  const nowIso = new Date().toISOString();
  const trimmedAudit = audit.slice(-250);
  const payloadJson = JSON.stringify({
    entries,
    audit: trimmedAudit,
  });

  if (payloadJson.length > 495000) {
    throw new CoopHttpError(
      413,
      `Monthly labor payload for ${monthKey} exceeds storage limit.`,
      'PAYLOAD_TOO_LARGE'
    );
  }

  const docData = {
    kind: 'labor_month',
    monthKey,
    status: 'active',
    version: nextVersion,
    payloadJson,
    updatedBy: `${caller.name} (${caller.userId})`.slice(0, 128),
    updatedAt: nowIso,
  };

  if (current.exists) {
    await ctx.databases.updateDocument(ctx.dbId, ctx.ledgerColId, docId, docData);
  } else {
    await ctx.databases.createDocument(ctx.dbId, ctx.ledgerColId, docId, docData, []);
  }

  await ensureMonthIndexed(ctx, monthKey);
  return nextVersion;
}

export async function readMonthLockDoc(
  ctx: CoopServerContext,
  monthKey: string
): Promise<CoopMonthLockSnapshot | null> {
  const docId = lockDocIdForMonth(monthKey);
  try {
    const doc: any = await ctx.databases.getDocument(
      ctx.dbId,
      ctx.ledgerColId,
      docId
    );
    if (typeof doc.payloadJson !== 'string' || !doc.payloadJson.trim().startsWith('{')) {
      return null;
    }
    const snapshot = JSON.parse(doc.payloadJson) as CoopMonthLockSnapshot;
    if (!verifySnapshotHash(snapshot)) {
      throw new CoopHttpError(
        500,
        `Snapshot hash verification failed for ${monthKey} — tamper detected.`,
        'SNAPSHOT_HASH_MISMATCH'
      );
    }
    if (doc.snapshotHash && doc.snapshotHash !== snapshot.snapshotHash) {
      throw new CoopHttpError(
        500,
        `Ledger header hash mismatch for ${monthKey} — tamper detected.`,
        'SNAPSHOT_HASH_MISMATCH'
      );
    }
    return snapshot;
  } catch (err: any) {
    if (err instanceof CoopHttpError) throw err;
    if (err?.code === 404) return null;
    throw err;
  }
}

export async function listAllMonthLockDocs(
  ctx: CoopServerContext
): Promise<Record<string, CoopMonthLockSnapshot>> {
  const locksByMonth: Record<string, CoopMonthLockSnapshot> = {};
  let cursor: string | null = null;
  while (true) {
    const queries = [Query.orderDesc('$id'), Query.limit(100)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const list = await ctx.databases.listDocuments(
      ctx.dbId,
      ctx.ledgerColId,
      queries
    );
    const docs = list.documents || [];
    for (const doc of docs) {
      if ((doc as any).kind !== 'month_lock') continue;
      const mk = String((doc as any).monthKey || '');
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mk)) continue;
      if (typeof (doc as any).payloadJson === 'string') {
        const snap = JSON.parse((doc as any).payloadJson) as CoopMonthLockSnapshot;
        if (
          !verifySnapshotHash(snap) ||
          ((doc as any).snapshotHash && (doc as any).snapshotHash !== snap.snapshotHash)
        ) {
          throw new CoopHttpError(
            500,
            `Snapshot hash verification failed for ${mk} — tamper detected.`,
            'SNAPSHOT_HASH_MISMATCH'
          );
        }
        locksByMonth[mk] = snap;
      }
    }
    if (docs.length < 100) break;
    cursor = docs[docs.length - 1].$id;
  }
  return locksByMonth;
}

export async function assertMonthUnlocked(
  ctx: CoopServerContext,
  monthKey: string
): Promise<void> {
  if (!monthKey) return;
  const lock = await readMonthLockDoc(ctx, monthKey);
  if (lock && lock.status === 'locked') {
    throw new CoopHttpError(
      423,
      `Settlement month ${monthKey} is locked after payout (locked by ${lock.lockedBy.name}). Only a Founder can unlock it.`,
      'MONTH_LOCKED'
    );
  }
}

function validateMonthParam(raw: unknown): string {
  const s = String(raw || '').trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) {
    throw new CoopHttpError(400, `Invalid month key "${s}" (expected YYYY-MM).`, 'INVALID_MONTH');
  }
  return s;
}

function validateAndSanitizeLaborInput(body: any): {
  date: string;
  monthKey: string;
  member: string;
  partner: 'HUCK' | 'PDXGL' | 'SWEAT';
  category: CoopLaborCategory;
  functionTag: CoopLaborFunctionTag;
  hours: number;
  notes: string;
  deliverableRef?: string;
} {
  const date = String(body?.date || '').trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date)) {
    throw new CoopHttpError(
      400,
      'Work date must be a valid calendar date in YYYY-MM-DD format.',
      'INVALID_DATE'
    );
  }
  const monthKey = laborEntryMonthKey(date);
  if (!monthKey) {
    throw new CoopHttpError(400, 'Invalid work date month.', 'INVALID_DATE');
  }

  const hoursNum = Number(body?.hours);
  if (!Number.isFinite(hoursNum) || hoursNum < 0.25 || hoursNum > 24) {
    throw new CoopHttpError(
      400,
      'Hours logged must be between 0.25 and 24.0.',
      'INVALID_HOURS'
    );
  }
  const hours = Number(hoursNum.toFixed(2));

  const categoryRaw = String(body?.category || '').trim() as CoopLaborCategory;
  if (!COOP_LABOR_CATEGORIES.includes(categoryRaw)) {
    throw new CoopHttpError(
      400,
      `Invalid labor category "${categoryRaw}".`,
      'INVALID_CATEGORY'
    );
  }

  const functionTag = normalizeFunctionTag(body?.functionTag, categoryRaw);

  const member = String(body?.member || '').trim().slice(0, 120);
  if (!member) {
    throw new CoopHttpError(400, 'Worker-member name is required.', 'INVALID_MEMBER');
  }

  const partner = inferPartnerFromMemberName(member, body?.partner);
  const notes = String(body?.notes || '').trim().slice(0, 2000);
  const deliverableRefRaw = String(body?.deliverableRef || '').trim().slice(0, 500);

  return {
    date,
    monthKey,
    member,
    partner,
    category: categoryRaw,
    functionTag,
    hours,
    notes,
    deliverableRef: deliverableRefRaw || undefined,
  };
}

function doesEntryTargetCaller(
  entryMemberName: string,
  entryMemberUserId: string | undefined,
  caller: VerifiedCoopCaller
): boolean {
  if (entryMemberUserId && entryMemberUserId === caller.userId) return true;
  const matchedRoster = caller.rosterMembers.find(
    (r) => r.name.trim().toLowerCase() === entryMemberName.trim().toLowerCase()
  );
  if (matchedRoster?.userId && matchedRoster.userId === caller.userId) return true;
  if (
    caller.linkedMember &&
    caller.linkedMember.name.trim().toLowerCase() ===
      entryMemberName.trim().toLowerCase()
  ) {
    return true;
  }
  const stripParens = (s: string) => s.replace(/\(.*?\)/g, '').trim().toLowerCase();
  const cleanEntry = stripParens(entryMemberName);
  const cleanCaller = stripParens(caller.name);
  if (cleanEntry && cleanCaller && cleanEntry === cleanCaller) return true;
  return false;
}

// ============================================================================
// Route Handlers (invoked by Astro SSR endpoints AND direct security tests)
// ============================================================================

export async function handleCoopMeGet(request: Request): Promise<Response> {
  try {
    const ctx = getCoopServerContext();
    const caller = await resolveVerifiedCoopCaller(request, ctx);
    const body: CoopMeIdentity = {
      authenticated: caller.authenticated,
      userId: caller.userId,
      name: caller.name,
      email: caller.email,
      teamId: caller.teamId,
      confirmed: caller.confirmed,
      isBreakGlassAdmin: caller.isBreakGlassAdmin,
      roles: caller.roles,
      isOwner: caller.isOwner,
      isFounder: caller.isFounder,
      soleFounder: caller.soleFounder,
      canViewLabor: caller.confirmed && caller.canViewLabor,
      canLogLabor: caller.confirmed && caller.canLogLabor,
      canApproveLabor: caller.confirmed && caller.canApproveLabor,
      canLockMonth: caller.confirmed && caller.canLockMonth,
      canEditGlobalFinancials: caller.confirmed && caller.canEditGlobalFinancials,
      linkedMemberName: caller.linkedMemberName,
      linkedPartner: caller.linkedPartner,
    };
    return jsonResponse(body, 200);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function handleCoopLaborGet(request: Request): Promise<Response> {
  try {
    const ctx = getCoopServerContext();
    await requireCoopRole(request, ctx, COOP_VIEW_AND_LOG_ROLES);

    const url = new URL(request.url);
    const monthParam = String(url.searchParams.get('month') || 'all').trim();

    const allMonths = await listIndexedLaborMonths(ctx);
    const locksMap = await listAllMonthLockDocs(ctx);
    const lockedMonths = Object.values(locksMap)
      .filter((l) => l.status === 'locked')
      .map((l) => l.month);

    const versionsByMonth: Record<string, number> = {};
    let entries: CoopLaborEntry[] = [];

    if (monthParam !== 'all') {
      const mk = validateMonthParam(monthParam);
      const doc = await readMonthlyLaborDoc(ctx, mk);
      versionsByMonth[mk] = doc.version;
      entries = doc.entries;
    } else {
      for (const mk of allMonths) {
        const doc = await readMonthlyLaborDoc(ctx, mk);
        versionsByMonth[mk] = doc.version;
        entries.push(...doc.entries);
      }
    }

    entries.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

    const { rawManifestSnapshot } = await loadGovernancePolicyOnServer(ctx);
    const laborMigratedAt = rawManifestSnapshot.laborMigratedAt
      ? String(rawManifestSnapshot.laborMigratedAt)
      : undefined;
    const rawLegacy = !laborMigratedAt && Array.isArray(rawManifestSnapshot.laborEntries)
      ? normalizeLaborEntries(rawManifestSnapshot.laborEntries).filter(
          (e) => !isDemoSeedLaborEntry(e)
        )
      : [];

    return jsonResponse({
      entries,
      months: allMonths,
      lockedMonths,
      versionsByMonth,
      legacyPendingMigrationCount: rawLegacy.length,
      laborMigratedAt,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function handleCoopLaborPost(request: Request): Promise<Response> {
  try {
    const ctx = getCoopServerContext();
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      throw new CoopHttpError(400, 'Invalid JSON request body.', 'INVALID_JSON');
    }

    const mode = String(body?.mode || '').trim();
    const nowIso = new Date().toISOString();

    if (
      mode === 'approve' ||
      mode === 'reject' ||
      mode === 'unapprove' ||
      mode === 'bulkApprove' ||
      mode === 'migrateLegacy'
    ) {
      const founder = await requireCoopRole(request, ctx, COOP_FOUNDER_ROLES);

      if (mode === 'migrateLegacy') {
        const { rawManifestSnapshot, manifestExists } =
          await loadGovernancePolicyOnServer(ctx);
        if (!manifestExists) {
          return jsonResponse({
            ok: true,
            migratedCount: 0,
            message: 'No legacy governance manifest found.',
          });
        }
        const legacyEntries = normalizeLaborEntries(
          rawManifestSnapshot.laborEntries || []
        ).filter((e) => !isDemoSeedLaborEntry(e) && isValidLaborEntryData(e));

        const byMonth = new Map<string, CoopLaborEntry[]>();
        for (const entry of legacyEntries) {
          const mk = laborEntryMonthKey(entry.date);
          if (!mk) continue;
          const bucket = byMonth.get(mk) || [];
          bucket.push(entry);
          byMonth.set(mk, bucket);
        }

        // Verify none of the target months are locked before writing
        for (const mk of byMonth.keys()) {
          await assertMonthUnlocked(ctx, mk);
        }

        let migratedCount = 0;
        for (const [mk, monthLegacy] of byMonth.entries()) {
          const doc = await readMonthlyLaborDoc(ctx, mk);
          const existingIds = new Set(doc.entries.map((e) => e.id));
          const additions: CoopLaborEntry[] = [];
          for (const leg of monthLegacy) {
            if (existingIds.has(leg.id)) continue;
            additions.push({
              ...leg,
              // Legacy entries without approval are explicitly marked 'pending' (§6 & §7.3)
              approval:
                leg.approval === 'approved' || leg.approval === 'rejected'
                  ? leg.approval
                  : 'pending',
              updatedAt: nowIso,
            });
            migratedCount += 1;
          }
          if (additions.length > 0) {
            const nextAudit = [
              ...doc.audit,
              {
                at: nowIso,
                action: 'migrateLegacy',
                byUserId: founder.userId,
                byName: founder.name,
                breakGlass: founder.isBreakGlassAdmin || undefined,
                note: `Migrated ${additions.length} legacy labor entries as pending.`,
              },
            ];
            await writeMonthlyLaborDoc(
              ctx,
              mk,
              [...additions, ...doc.entries],
              nextAudit,
              founder
            );
          }
        }

        // Stamp laborMigratedAt on governance manifest while keeping old array untouched as backup
        const currentManifest: any = await ctx.databases.getDocument(
          ctx.dbId,
          MANIFESTS_COL_ID,
          COOP_GOVERNANCE_DOC_ID
        );
        const updatedSnapshot = {
          ...rawManifestSnapshot,
          laborMigratedAt: nowIso,
        };
        await ctx.databases.updateDocument(
          ctx.dbId,
          MANIFESTS_COL_ID,
          COOP_GOVERNANCE_DOC_ID,
          {
            itemsSnapshot: JSON.stringify(updatedSnapshot),
          }
        );

        return jsonResponse({
          ok: true,
          migratedCount,
          laborMigratedAt: nowIso,
        });
      }

      const monthKey = validateMonthParam(body?.month);
      await assertMonthUnlocked(ctx, monthKey);
      const doc = await readMonthlyLaborDoc(ctx, monthKey);
      const expectedVersion =
        body?.expectedVersion !== undefined ? Number(body.expectedVersion) : undefined;

      if (mode === 'bulkApprove') {
        const idFilter =
          Array.isArray(body?.ids) && body.ids.length > 0
            ? new Set(body.ids.map((x: any) => String(x)))
            : null;
        const note = body?.decisionNote ? String(body.decisionNote).trim().slice(0, 500) : undefined;

        let approvedCount = 0;
        let skippedSelfCount = 0;
        const nextAudit = [...doc.audit];

        const nextEntries = doc.entries.map((entry) => {
          if (idFilter && !idFilter.has(entry.id)) return entry;
          if (effectiveLaborApproval(entry) !== 'pending') return entry;
          if (!isValidLaborEntryData(entry) || isDemoSeedLaborEntry(entry)) return entry;

          const isSelf = doesEntryTargetCaller(
            entry.member,
            entry.memberUserId,
            founder
          );
          if (isSelf && !founder.soleFounder) {
            skippedSelfCount += 1;
            return entry;
          }

          approvedCount += 1;
          const selfFlag = isSelf && founder.soleFounder ? true : undefined;
          nextAudit.push({
            at: nowIso,
            action: 'approve',
            entryId: entry.id,
            byUserId: founder.userId,
            byName: founder.name,
            breakGlass: founder.isBreakGlassAdmin || undefined,
            selfApproved: selfFlag,
            note,
          });
          return {
            ...entry,
            approval: 'approved' as const,
            approvedBy: founder.name,
            approvedByUserId: founder.userId,
            approvedAt: nowIso,
            decisionNote: note ?? entry.decisionNote,
            selfApproved: selfFlag,
            updatedAt: nowIso,
          };
        });

        if (approvedCount === 0 && skippedSelfCount > 0) {
          throw new CoopHttpError(
            403,
            'Self-approval blocked: another Founder must approve your own logged hours.',
            'SELF_APPROVAL_BLOCKED'
          );
        }

        const version = await writeMonthlyLaborDoc(
          ctx,
          monthKey,
          nextEntries,
          nextAudit,
          founder,
          expectedVersion
        );
        return jsonResponse({
          ok: true,
          month: monthKey,
          version,
          approvedCount,
          skippedSelfCount,
          entries: nextEntries,
        });
      }

      // Single-entry approve / reject / unapprove
      const entryId = String(body?.id || '').trim();
      const targetIdx = doc.entries.findIndex((e) => e.id === entryId);
      if (targetIdx < 0) {
        throw new CoopHttpError(404, `Labor entry "${entryId}" not found in ${monthKey}.`, 'NOT_FOUND');
      }

      const target = doc.entries[targetIdx];
      const decisionNote = String(body?.decisionNote || '').trim().slice(0, 500);

      if ((mode === 'reject' || mode === 'unapprove') && !decisionNote) {
        throw new CoopHttpError(
          400,
          `A written decision note is required to ${mode} a labor entry.`,
          'DECISION_NOTE_REQUIRED'
        );
      }

      let updatedEntry: CoopLaborEntry;
      let selfFlag: boolean | undefined;

      if (mode === 'approve') {
        if (!isValidLaborEntryData(target) || isDemoSeedLaborEntry(target)) {
          throw new CoopHttpError(
            422,
            'Cannot approve an entry with an invalid date or hours <= 0.',
            'INVALID_ENTRY'
          );
        }
        const isSelf = doesEntryTargetCaller(
          target.member,
          target.memberUserId,
          founder
        );
        if (isSelf && !founder.soleFounder) {
          throw new CoopHttpError(
            403,
            'Self-approval blocked: a second Founder is active, so another Founder must approve your hours.',
            'SELF_APPROVAL_BLOCKED'
          );
        }
        selfFlag = isSelf && founder.soleFounder ? true : undefined;
        updatedEntry = {
          ...target,
          approval: 'approved',
          approvedBy: founder.name,
          approvedByUserId: founder.userId,
          approvedAt: nowIso,
          decisionNote: decisionNote || undefined,
          selfApproved: selfFlag,
          updatedAt: nowIso,
        };
      } else if (mode === 'reject') {
        updatedEntry = {
          ...target,
          approval: 'rejected',
          approvedBy: founder.name,
          approvedByUserId: founder.userId,
          approvedAt: nowIso,
          decisionNote,
          selfApproved: undefined,
          updatedAt: nowIso,
        };
      } else {
        updatedEntry = {
          ...target,
          approval: 'pending',
          approvedBy: undefined,
          approvedByUserId: undefined,
          approvedAt: undefined,
          decisionNote,
          selfApproved: undefined,
          updatedAt: nowIso,
        };
      }

      const nextEntries = doc.entries.map((e, i) => (i === targetIdx ? updatedEntry : e));
      const nextAudit = [
        ...doc.audit,
        {
          at: nowIso,
          action: mode,
          entryId,
          byUserId: founder.userId,
          byName: founder.name,
          breakGlass: founder.isBreakGlassAdmin || undefined,
          selfApproved: selfFlag,
          note: decisionNote || undefined,
        },
      ];
      const version = await writeMonthlyLaborDoc(
        ctx,
        monthKey,
        nextEntries,
        nextAudit,
        founder,
        expectedVersion
      );

      return jsonResponse({
        ok: true,
        month: monthKey,
        version,
        entry: updatedEntry,
      });
    }

    // Member/Founder write modes: log, edit, delete
    if (mode === 'log' || mode === 'edit' || mode === 'delete') {
      const caller = await requireCoopRole(request, ctx, COOP_VIEW_AND_LOG_ROLES);

      if (mode === 'log') {
        const clean = validateAndSanitizeLaborInput(body);
        await assertMonthUnlocked(ctx, clean.monthKey);

        let canonicalMember = clean.member;
        let canonicalPartner = clean.partner;
        let memberUserId: string | undefined;

        if (!caller.isFounder) {
          // §8.4: Non-founders must have a linked roster profile and may ONLY log for themselves
          if (!caller.linkedMember) {
            throw new CoopHttpError(
              403,
              'Ask a Founder to link your account in /coop/governance (Roster -> Co-op Roles) before logging hours.',
              'ACCOUNT_NOT_LINKED'
            );
          }
          if (
            caller.linkedMember.name.trim().toLowerCase() !==
            clean.member.trim().toLowerCase()
          ) {
            throw new CoopHttpError(
              403,
              `You may only log hours for your own linked roster profile (${caller.linkedMember.name}).`,
              'IMPERSONATION_BLOCKED'
            );
          }
          canonicalMember = caller.linkedMember.name;
          canonicalPartner = inferPartnerFromMemberName(
            canonicalMember,
            caller.linkedMember.partner
          );
          memberUserId = caller.userId;
        } else {
          const matched = caller.rosterMembers.find(
            (m) => m.name.trim().toLowerCase() === clean.member.trim().toLowerCase()
          );
          if (matched) {
            canonicalMember = matched.name;
            canonicalPartner = inferPartnerFromMemberName(
              canonicalMember,
              body?.partner || matched.partner
            );
            memberUserId = matched.userId;
          }
        }

        const isSelfTarget = doesEntryTargetCaller(
          canonicalMember,
          memberUserId,
          caller
        );
        const autoApprove = caller.isFounder && (!isSelfTarget || caller.soleFounder);
        const selfFlag =
          autoApprove && isSelfTarget && caller.soleFounder ? true : undefined;

        const workerRoster = caller.rosterMembers.find(
          (m) => m.name.trim().toLowerCase() === canonicalMember.trim().toLowerCase()
        );
        const workerPrefix =
          workerRoster?.inventoryPrefix ||
          caller.linkedMember?.inventoryPrefix ||
          (canonicalPartner !== 'SWEAT' ? `${canonicalPartner}-` : undefined);
        const ownBarcodeCheck = detectOwnBarcodeWarning(
          [clean.notes, clean.deliverableRef],
          workerPrefix
        );

        const newEntry: CoopLaborEntry = {
          id: `labor-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          date: clean.date,
          member: canonicalMember,
          memberUserId,
          partner: canonicalPartner,
          category: clean.category,
          functionTag: clean.functionTag,
          hours: clean.hours,
          ownBarcodeWarning: ownBarcodeCheck.warning || undefined,
          notes: clean.notes,
          deliverableRef: clean.deliverableRef,
          approval: autoApprove ? 'approved' : 'pending',
          approvedBy: autoApprove ? caller.name : undefined,
          approvedByUserId: autoApprove ? caller.userId : undefined,
          approvedAt: autoApprove ? nowIso : undefined,
          selfApproved: selfFlag,
          loggedByUserId: caller.userId,
          loggedByName: caller.name,
          updatedAt: nowIso,
        };

        const doc = await readMonthlyLaborDoc(ctx, clean.monthKey);
        const nextEntries = [newEntry, ...doc.entries];
        const nextAudit = [
          ...doc.audit,
          {
            at: nowIso,
            action: 'log',
            entryId: newEntry.id,
            byUserId: caller.userId,
            byName: caller.name,
            breakGlass: caller.isBreakGlassAdmin || undefined,
            selfApproved: selfFlag,
            note: `${newEntry.hours}h (${newEntry.approval}) for ${newEntry.member}`,
          },
        ];

        const version = await writeMonthlyLaborDoc(
          ctx,
          clean.monthKey,
          nextEntries,
          nextAudit,
          caller
        );
        return jsonResponse({
          ok: true,
          month: clean.monthKey,
          version,
          entry: newEntry,
        });
      }

      if (mode === 'delete') {
        const entryId = String(body?.id || '').trim();
        const monthKey = validateMonthParam(body?.month);
        await assertMonthUnlocked(ctx, monthKey);

        const doc = await readMonthlyLaborDoc(ctx, monthKey);
        const target = doc.entries.find((e) => e.id === entryId);
        if (!target) {
          throw new CoopHttpError(404, `Labor entry "${entryId}" not found.`, 'NOT_FOUND');
        }

        if (!caller.isFounder) {
          const isOwn =
            target.loggedByUserId === caller.userId ||
            target.memberUserId === caller.userId ||
            (caller.linkedMember &&
              caller.linkedMember.name.trim().toLowerCase() ===
                target.member.trim().toLowerCase());
          if (!isOwn || effectiveLaborApproval(target) !== 'pending') {
            throw new CoopHttpError(
              403,
              'Only a Founder can delete an approved entry or another member’s entry.',
              'DELETE_FORBIDDEN'
            );
          }
        }

        const expectedVersion =
          body?.expectedVersion !== undefined ? Number(body.expectedVersion) : undefined;
        const nextEntries = doc.entries.filter((e) => e.id !== entryId);
        const nextAudit = [
          ...doc.audit,
          {
            at: nowIso,
            action: 'delete',
            entryId,
            byUserId: caller.userId,
            byName: caller.name,
            breakGlass: caller.isBreakGlassAdmin || undefined,
          },
        ];
        const version = await writeMonthlyLaborDoc(
          ctx,
          monthKey,
          nextEntries,
          nextAudit,
          caller,
          expectedVersion
        );
        return jsonResponse({ ok: true, month: monthKey, version });
      }

      if (mode === 'edit') {
        const entryId = String(body?.id || '').trim();
        const clean = validateAndSanitizeLaborInput(body);
        const newMonthKey = clean.monthKey;

        let oldMonthKey = body?.originalMonth
          ? validateMonthParam(body.originalMonth)
          : newMonthKey;
        let oldDoc = await readMonthlyLaborDoc(ctx, oldMonthKey);
        let target = oldDoc.entries.find((e) => e.id === entryId);

        if (!target && !body?.originalMonth) {
          const allMonths = await listIndexedLaborMonths(ctx);
          for (const mk of allMonths) {
            const candidateDoc = await readMonthlyLaborDoc(ctx, mk);
            const found = candidateDoc.entries.find((e) => e.id === entryId);
            if (found) {
              oldMonthKey = mk;
              oldDoc = candidateDoc;
              target = found;
              break;
            }
          }
        }

        if (!target) {
          throw new CoopHttpError(404, `Labor entry "${entryId}" not found.`, 'NOT_FOUND');
        }

        // Check month lock on BOTH old and new months (§7.1 item 3b)
        await assertMonthUnlocked(ctx, oldMonthKey);
        if (newMonthKey !== oldMonthKey) {
          await assertMonthUnlocked(ctx, newMonthKey);
        }

        if (!caller.isFounder) {
          const isOwn =
            target.loggedByUserId === caller.userId ||
            target.memberUserId === caller.userId ||
            (caller.linkedMember &&
              caller.linkedMember.name.trim().toLowerCase() ===
                target.member.trim().toLowerCase());
          if (!isOwn || effectiveLaborApproval(target) !== 'pending') {
            throw new CoopHttpError(
              403,
              'Only a Founder can edit an approved entry or another member’s entry.',
              'EDIT_FORBIDDEN'
            );
          }
          if (
            caller.linkedMember &&
            caller.linkedMember.name.trim().toLowerCase() !==
              clean.member.trim().toLowerCase()
          ) {
            throw new CoopHttpError(
              403,
              'You cannot reassign your labor entry to another member.',
              'IMPERSONATION_BLOCKED'
            );
          }
        }

        // §6 & §7.3: Any change to date, hours, category, or member on an approved entry resets approval to 'pending'
        const coreChanged =
          target.date !== clean.date ||
          Number(target.hours) !== clean.hours ||
          target.category !== clean.category ||
          target.member.trim().toLowerCase() !== clean.member.trim().toLowerCase();

        const shouldResetApproval =
          target.approval === 'approved' && coreChanged;

        const editWorkerRoster = caller.rosterMembers.find(
          (m) => m.name.trim().toLowerCase() === clean.member.trim().toLowerCase()
        );
        const editPrefix =
          editWorkerRoster?.inventoryPrefix ||
          (clean.partner !== 'SWEAT' ? `${clean.partner}-` : undefined);
        const editBarcodeCheck = detectOwnBarcodeWarning(
          [clean.notes, clean.deliverableRef],
          editPrefix
        );

        const updatedEntry: CoopLaborEntry = {
          ...target,
          date: clean.date,
          member: clean.member,
          partner: clean.partner,
          category: clean.category,
          functionTag: clean.functionTag,
          hours: clean.hours,
          ownBarcodeWarning: editBarcodeCheck.warning || undefined,
          notes: clean.notes,
          deliverableRef: clean.deliverableRef,
          approval: shouldResetApproval ? 'pending' : target.approval || 'pending',
          approvedBy: shouldResetApproval ? undefined : target.approvedBy,
          approvedByUserId: shouldResetApproval ? undefined : target.approvedByUserId,
          approvedAt: shouldResetApproval ? undefined : target.approvedAt,
          selfApproved: shouldResetApproval ? undefined : target.selfApproved,
          updatedAt: nowIso,
        };

        const expectedVersion =
          body?.expectedVersion !== undefined ? Number(body.expectedVersion) : undefined;

        if (oldMonthKey === newMonthKey) {
          const nextEntries = oldDoc.entries.map((e) =>
            e.id === entryId ? updatedEntry : e
          );
          const nextAudit = [
            ...oldDoc.audit,
            {
              at: nowIso,
              action: shouldResetApproval ? 'edit_reset_to_pending' : 'edit',
              entryId,
              byUserId: caller.userId,
              byName: caller.name,
              breakGlass: caller.isBreakGlassAdmin || undefined,
            },
          ];
          const version = await writeMonthlyLaborDoc(
            ctx,
            newMonthKey,
            nextEntries,
            nextAudit,
            caller,
            expectedVersion
          );
          return jsonResponse({ ok: true, month: newMonthKey, version, entry: updatedEntry });
        } else {
          // Move across months atomically (both months already verified unlocked)
          const oldRemaining = oldDoc.entries.filter((e) => e.id !== entryId);
          await writeMonthlyLaborDoc(
            ctx,
            oldMonthKey,
            oldRemaining,
            [
              ...oldDoc.audit,
              {
                at: nowIso,
                action: 'move_out',
                entryId,
                byUserId: caller.userId,
                byName: caller.name,
                note: `Moved to ${newMonthKey}`,
              },
            ],
            caller,
            expectedVersion
          );

          const destDoc = await readMonthlyLaborDoc(ctx, newMonthKey);
          const version = await writeMonthlyLaborDoc(
            ctx,
            newMonthKey,
            [updatedEntry, ...destDoc.entries],
            [
              ...destDoc.audit,
              {
                at: nowIso,
                action: 'move_in',
                entryId,
                byUserId: caller.userId,
                byName: caller.name,
                note: `Moved from ${oldMonthKey}`,
              },
            ],
            caller
          );
          return jsonResponse({ ok: true, month: newMonthKey, version, entry: updatedEntry });
        }
      }
    }

    throw new CoopHttpError(400, `Unsupported labor action mode "${mode}".`, 'INVALID_MODE');
  } catch (err) {
    return errorResponse(err);
  }
}

export async function handleCoopMonthLockGet(request: Request): Promise<Response> {
  try {
    const ctx = getCoopServerContext();
    await requireCoopRole(request, ctx, COOP_VIEW_AND_LOG_ROLES);

    const url = new URL(request.url);
    const monthParam = String(url.searchParams.get('month') || 'all').trim();

    if (monthParam !== 'all') {
      const mk = validateMonthParam(monthParam);
      const lock = await readMonthLockDoc(ctx, mk);
      return jsonResponse({
        lock,
        locksByMonth: lock ? { [mk]: lock } : {},
      });
    }

    const locksByMonth = await listAllMonthLockDocs(ctx);
    return jsonResponse({
      lock: null,
      locksByMonth,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

function buildRevisionDiff(
  priorRows: any[],
  nextRows: any[]
): CoopMonthLockRevisionDiffItem[] {
  const priorMap = new Map<string, { name: string; check: number }>();
  for (const r of priorRows || []) {
    const k = String(r.rowKey || r.partnerCode || '');
    priorMap.set(k, {
      name: String(r.partnerName || k),
      check: Number(r.finalPayoutCheck || 0),
    });
  }
  const nextMap = new Map<string, { name: string; check: number }>();
  for (const r of nextRows || []) {
    const k = String(r.rowKey || r.partnerCode || '');
    nextMap.set(k, {
      name: String(r.partnerName || k),
      check: Number(r.finalPayoutCheck || 0),
    });
  }

  const allKeys = Array.from(new Set([...priorMap.keys(), ...nextMap.keys()])).sort();
  const diffs: CoopMonthLockRevisionDiffItem[] = [];
  for (const k of allKeys) {
    const prev = priorMap.get(k)?.check ?? 0;
    const nxt = nextMap.get(k)?.check ?? 0;
    const delta = Math.round((nxt - prev) * 100) / 100;
    if (delta !== 0) {
      diffs.push({
        rowKey: k,
        partnerName: nextMap.get(k)?.name || priorMap.get(k)?.name || k,
        previousCheck: prev,
        newCheck: nxt,
        deltaCheck: delta,
      });
    }
  }
  return diffs;
}

export async function handleCoopMonthLockPost(request: Request): Promise<Response> {
  try {
    const ctx = getCoopServerContext();
    const founder = await requireCoopRole(request, ctx, COOP_FOUNDER_ROLES);

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      throw new CoopHttpError(400, 'Invalid JSON request body.', 'INVALID_JSON');
    }

    const mode = String(body?.mode || '').trim();
    const monthKey = validateMonthParam(body?.month);
    const docId = lockDocIdForMonth(monthKey);
    const nowIso = new Date().toISOString();

    if (mode === 'lock') {
      // Precondition 1: Month must be closed (< current Pacific month)
      const currentPac = currentPacificMonthKey();
      if (monthKey >= currentPac) {
        throw new CoopHttpError(
          422,
          `Cannot lock ${monthKey}: month has not closed yet in Pacific time (current: ${currentPac}).`,
          'MONTH_NOT_CLOSED'
        );
      }

      // Precondition 2: Zero pending labor entries in this month (§7.4)
      const laborDoc = await readMonthlyLaborDoc(ctx, monthKey);
      const pendingEntries = laborDoc.entries.filter(
        (e) =>
          !isDemoSeedLaborEntry(e) &&
          effectiveLaborApproval(e) === 'pending'
      );
      if (pendingEntries.length > 0) {
        throw new CoopHttpError(
          422,
          `Cannot lock ${monthKey}: ${pendingEntries.length} pending labor log(s) must be approved or rejected first.`,
          'PENDING_LABOR_EXISTS'
        );
      }

      // Precondition 3 (Law 6 Layer 2 & 3): Check existing lock doc
      const existingLock = await readMonthLockDoc(ctx, monthKey);
      if (existingLock && existingLock.status === 'locked') {
        throw new CoopHttpError(
          409,
          `Already Locked: ${monthKey} was locked by ${existingLock.lockedBy.name} on ${existingLock.lockedAt}.`,
          'ALREADY_LOCKED'
        );
      }

      const rawSnap = body?.snapshot;
      if (!rawSnap || typeof rawSnap !== 'object' || !Array.isArray(rawSnap.rows)) {
        throw new CoopHttpError(
          400,
          'Missing settlement snapshot payload (rows, breakdown, totals, policy).',
          'MISSING_SNAPSHOT'
        );
      }

      const approvedServerEntries = laborDoc.entries.filter(
        (e) => !isDemoSeedLaborEntry(e) && e.approval === 'approved'
      );

      const revision = existingLock ? (Number(existingLock.revision) || 1) + 1 : 1;
      const unlockHistory = existingLock ? [...(existingLock.unlockHistory || [])] : [];
      const priorRevisionDiff = existingLock
        ? buildRevisionDiff(existingLock.rows || [], rawSnap.rows || [])
        : undefined;

      const unsignedSnapshot: Omit<CoopMonthLockSnapshot, 'snapshotHash'> = {
        month: monthKey,
        status: 'locked',
        revision,
        lockedBy: { id: founder.userId, name: founder.name },
        lockedAt: nowIso,
        payoutDate: body?.payoutDate ? String(body.payoutDate).trim().slice(0, 32) : undefined,
        payoutNote: body?.payoutNote ? String(body.payoutNote).trim().slice(0, 1000) : undefined,
        policy: rawSnap.policy,
        laborApproved: approvedServerEntries,
        rows: rawSnap.rows,
        breakdown: rawSnap.breakdown,
        totals: rawSnap.totals,
        unlockHistory,
        priorRevisionDiff,
      };

      const snapshotHash = computeSnapshotHash(unsignedSnapshot);
      const finalSnapshot: CoopMonthLockSnapshot = {
        ...unsignedSnapshot,
        snapshotHash,
      };

      const docPayload = {
        kind: 'month_lock',
        monthKey,
        status: 'locked',
        version: revision,
        payloadJson: JSON.stringify(finalSnapshot),
        snapshotHash,
        updatedBy: `${founder.name} (${founder.userId})`.slice(0, 128),
        updatedAt: nowIso,
      };

      if (existingLock) {
        await ctx.databases.updateDocument(ctx.dbId, ctx.ledgerColId, docId, docPayload);
      } else {
        try {
          await ctx.databases.createDocument(
            ctx.dbId,
            ctx.ledgerColId,
            docId,
            docPayload,
            []
          );
        } catch (createErr: any) {
          if (createErr?.code === 409) {
            throw new CoopHttpError(
              409,
              `Already Locked: ${monthKey} is already locked.`,
              'ALREADY_LOCKED'
            );
          }
          throw createErr;
        }
      }

      return jsonResponse({ ok: true, lock: finalSnapshot });
    }

    if (mode === 'unlock') {
      const reason = String(body?.reason || '').trim().slice(0, 1000);
      if (reason.length < 3) {
        throw new CoopHttpError(
          400,
          'Unlocking a finalized month requires a written reason (at least 3 characters).',
          'REASON_REQUIRED'
        );
      }

      const existingLock = await readMonthLockDoc(ctx, monthKey);
      if (!existingLock || existingLock.status !== 'locked') {
        throw new CoopHttpError(
          409,
          `Month ${monthKey} is not currently locked.`,
          'NOT_LOCKED'
        );
      }

      const nextHistory = [
        ...(existingLock.unlockHistory || []),
        {
          by: { id: founder.userId, name: founder.name },
          at: nowIso,
          reason,
          previousHash: existingLock.snapshotHash,
          revisionUnlocked: existingLock.revision,
        },
      ];

      const unsignedUnlocked: Omit<CoopMonthLockSnapshot, 'snapshotHash'> = {
        ...existingLock,
        status: 'unlocked',
        unlockHistory: nextHistory,
      };
      const nextHash = computeSnapshotHash(unsignedUnlocked);
      const unlockedSnapshot: CoopMonthLockSnapshot = {
        ...unsignedUnlocked,
        snapshotHash: nextHash,
      };

      await ctx.databases.updateDocument(ctx.dbId, ctx.ledgerColId, docId, {
        status: 'unlocked',
        version: existingLock.revision,
        payloadJson: JSON.stringify(unlockedSnapshot),
        snapshotHash: nextHash,
        updatedBy: `${founder.name} (${founder.userId})`.slice(0, 128),
        updatedAt: nowIso,
      });

      return jsonResponse({ ok: true, lock: unlockedSnapshot });
    }

    throw new CoopHttpError(400, `Unsupported month-lock mode "${mode}".`, 'INVALID_MODE');
  } catch (err) {
    return errorResponse(err);
  }
}

// ============================================================================
// Co-op Task Board & Presets (`coop_tasks_board` in server-only `coop_ledger`)
// ============================================================================

export interface TasksBoardPayload {
  presets: CoopTaskPreset[];
  tasks: CoopTaskItem[];
}

export interface CoopTasksPendingBadges {
  votesNeededForMe: number;
  peerSignoffsForMe: number;
  tiebreaksForFounder: number;
  pendingLaborForFounder: number;
  totalActionable: number;
}

export async function readTasksBoardDoc(ctx: CoopServerContext): Promise<{
  exists: boolean;
  version: number;
  presets: CoopTaskPreset[];
  tasks: CoopTaskItem[];
}> {
  try {
    const doc: any = await ctx.databases.getDocument(
      ctx.dbId,
      ctx.ledgerColId,
      COOP_TASKS_BOARD_DOC_ID
    );
    let parsed: Partial<TasksBoardPayload> = {};
    if (typeof doc.payloadJson === 'string' && doc.payloadJson.trim().startsWith('{')) {
      parsed = JSON.parse(doc.payloadJson);
    }
    return {
      exists: true,
      version: Number(doc.version || 1),
      presets: normalizeTaskPresets(parsed.presets),
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    };
  } catch (err: any) {
    if (err?.code === 404) {
      return {
        exists: false,
        version: 0,
        presets: normalizeTaskPresets([]),
        tasks: [],
      };
    }
    throw err;
  }
}

export async function writeTasksBoardDoc(
  ctx: CoopServerContext,
  presets: CoopTaskPreset[],
  tasks: CoopTaskItem[],
  caller: VerifiedCoopCaller,
  expectedVersion?: number
): Promise<number> {
  const current = await readTasksBoardDoc(ctx);
  if (
    expectedVersion !== undefined &&
    current.exists &&
    current.version !== expectedVersion
  ) {
    throw new CoopHttpError(
      409,
      'The Task Board was just updated by another member — please refresh and try again.',
      'VERSION_CONFLICT'
    );
  }

  const nextVersion = current.version + 1;
  const nowIso = new Date().toISOString();
  const prunedTasks = pruneTasksBoardForStorage(tasks);
  const payloadJson = JSON.stringify({
    presets: normalizeTaskPresets(presets),
    tasks: prunedTasks,
  });

  if (payloadJson.length > 495000) {
    throw new CoopHttpError(
      413,
      'Task Board storage limit reached — archive older tasks and try again.',
      'PAYLOAD_TOO_LARGE'
    );
  }

  const docData = {
    kind: 'tasks_board',
    monthKey: 'ALL',
    status: 'active',
    version: nextVersion,
    payloadJson,
    updatedBy: `${caller.name} (${caller.userId})`.slice(0, 128),
    updatedAt: nowIso,
  };

  if (current.exists) {
    await ctx.databases.updateDocument(
      ctx.dbId,
      ctx.ledgerColId,
      COOP_TASKS_BOARD_DOC_ID,
      docData
    );
  } else {
    await ctx.databases.createDocument(
      ctx.dbId,
      ctx.ledgerColId,
      COOP_TASKS_BOARD_DOC_ID,
      docData,
      []
    );
  }

  return nextVersion;
}

function computeTasksPendingBadges(
  tasks: readonly CoopTaskItem[],
  caller: VerifiedCoopCaller,
  pendingLaborForFounder: number
): CoopTasksPendingBadges {
  const policy = resolvePeerApprovalPolicy(
    caller.confirmedVotingMemberCount,
    caller.soleFounder
  );

  let votesNeededForMe = 0;
  let peerSignoffsForMe = 0;
  let tiebreaksForFounder = 0;

  for (const t of tasks || []) {
    if (t.status === 'voting_value') {
      const hasVoted = (t.valueVotes || []).some((v) => v.userId === caller.userId);
      if (!hasVoted) votesNeededForMe += 1;
    } else if (t.status === 'tiebreak_needed') {
      if (caller.isFounder) tiebreaksForFounder += 1;
    } else if (t.status === 'pending_approval') {
      const alreadySigned = (t.peerApprovals || []).some(
        (a) => a.userId === caller.userId
      );
      const isSelf = t.completedByUserId === caller.userId;
      if (!alreadySigned && (!isSelf || policy.allowSoleFounderSelf)) {
        peerSignoffsForMe += 1;
      }
    }
  }

  const founderLaborCount = caller.isFounder ? pendingLaborForFounder : 0;
  return {
    votesNeededForMe,
    peerSignoffsForMe,
    tiebreaksForFounder,
    pendingLaborForFounder: founderLaborCount,
    totalActionable:
      votesNeededForMe + peerSignoffsForMe + tiebreaksForFounder + founderLaborCount,
  };
}

function resolveCallerWorkerProfile(caller: VerifiedCoopCaller): {
  memberName: string;
  partner: 'HUCK' | 'PDXGL' | 'SWEAT';
  prefix?: string;
} {
  if (caller.linkedMember) {
    const partner = inferPartnerFromMemberName(
      caller.linkedMember.name,
      caller.linkedMember.partner
    );
    return {
      memberName: caller.linkedMember.name,
      partner,
      prefix:
        caller.linkedMember.inventoryPrefix ||
        (partner !== 'SWEAT' ? `${partner}-` : undefined),
    };
  }

  const byName = caller.rosterMembers.find(
    (m) => m.name.trim().toLowerCase() === caller.name.trim().toLowerCase()
  );
  if (byName) {
    const partner = inferPartnerFromMemberName(byName.name, byName.partner);
    return {
      memberName: byName.name,
      partner,
      prefix:
        byName.inventoryPrefix || (partner !== 'SWEAT' ? `${partner}-` : undefined),
    };
  }

  return {
    memberName: caller.name,
    partner: inferPartnerFromMemberName(caller.name),
    prefix: 'HUCK-',
  };
}

export async function handleCoopTasksGet(request: Request): Promise<Response> {
  try {
    const ctx = getCoopServerContext();
    const caller = await requireCoopRole(request, ctx, COOP_VIEW_AND_LOG_ROLES);
    const nowIso = new Date().toISOString();

    const board = await readTasksBoardDoc(ctx);
    const refreshed = refreshTaskStatusesAt(board.tasks, nowIso);

    let pendingLaborForFounder = 0;
    if (caller.isFounder) {
      const curMonth = currentPacificMonthKey();
      const curLabor = await readMonthlyLaborDoc(ctx, curMonth);
      pendingLaborForFounder = curLabor.entries.filter(
        (e) =>
          !isDemoSeedLaborEntry(e) &&
          isValidLaborEntryData(e) &&
          effectiveLaborApproval(e) === 'pending'
      ).length;
    }

    const peerPolicy = resolvePeerApprovalPolicy(
      caller.confirmedVotingMemberCount,
      caller.soleFounder
    );
    const pendingBadges = computeTasksPendingBadges(
      refreshed.tasks,
      caller,
      pendingLaborForFounder
    );

    return jsonResponse({
      presets: board.presets,
      tasks: refreshed.tasks,
      version: board.version,
      eligibleVoterCount: caller.confirmedVotingMemberCount,
      requiredPeerApprovals: peerPolicy.requiredCount,
      allowSoleFounderSelf: peerPolicy.allowSoleFounderSelf,
      canEditPresets: caller.roles.some((r) => COOP_PRESET_EDIT_ROLES.includes(r)),
      pendingBadges,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function handleCoopTasksPost(request: Request): Promise<Response> {
  try {
    const ctx = getCoopServerContext();
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      throw new CoopHttpError(400, 'Invalid JSON request body.', 'INVALID_JSON');
    }

    const mode = String(body?.mode || '').trim();
    const nowIso = new Date().toISOString();
    const expectedVersion =
      body?.expectedVersion !== undefined ? Number(body.expectedVersion) : undefined;

    if (mode === 'save_presets') {
      const editor = await requireCoopRole(request, ctx, COOP_PRESET_EDIT_ROLES);
      const board = await readTasksBoardDoc(ctx);
      const refreshed = refreshTaskStatusesAt(board.tasks, nowIso);
      const nextPresets = normalizeTaskPresets(body?.presets);
      const version = await writeTasksBoardDoc(
        ctx,
        nextPresets,
        refreshed.tasks,
        editor,
        expectedVersion
      );
      return jsonResponse({
        ok: true,
        version,
        presets: nextPresets,
        tasks: refreshed.tasks,
      });
    }

    if (mode === 'founder_tiebreak') {
      const founder = await requireCoopFounder(request, ctx);
      const board = await readTasksBoardDoc(ctx);
      const refreshed = refreshTaskStatusesAt(board.tasks, nowIso);
      const taskId = String(body?.taskId || '').trim();
      const idx = refreshed.tasks.findIndex((t) => t.id === taskId);
      if (idx < 0) {
        throw new CoopHttpError(404, 'Task not found on the board.', 'NOT_FOUND');
      }
      const target = refreshed.tasks[idx];
      if (target.status !== 'tiebreak_needed' && target.status !== 'voting_value') {
        throw new CoopHttpError(
          409,
          'This task has already cleared value voting.',
          'INVALID_STATE'
        );
      }

      const decision = String(body?.decision || '').trim();
      const nextPoints = clampTaskPoints(body?.points, target.proposedPoints);
      let updated: CoopTaskItem;

      if (decision === 'decide') {
        updated = {
          ...target,
          points: nextPoints,
          proposedPoints: nextPoints,
          status: 'open',
          tiebreakResolvedBy: founder.name,
          updatedAt: nowIso,
        };
      } else if (decision === 'restart') {
        const closesAt = new Date(
          Date.now() + CUSTOM_TASK_VOTE_WINDOW_MS
        ).toISOString();
        updated = {
          ...target,
          points: nextPoints,
          proposedPoints: nextPoints,
          status: 'voting_value',
          snapshotEligibleVoters: Math.max(1, founder.confirmedVotingMemberCount),
          votingOpensAt: nowIso,
          votingClosesAt: closesAt,
          valueVotes: [],
          tiebreakReason: undefined,
          tiebreakResolvedBy: undefined,
          updatedAt: nowIso,
        };
      } else {
        throw new CoopHttpError(
          400,
          'Founder tiebreak decision must be "decide" or "restart".',
          'INVALID_DECISION'
        );
      }

      const nextTasks = refreshed.tasks.map((t, i) => (i === idx ? updated : t));
      const version = await writeTasksBoardDoc(
        ctx,
        board.presets,
        nextTasks,
        founder,
        expectedVersion
      );
      return jsonResponse({ ok: true, version, task: updated, tasks: nextTasks });
    }

    const caller = await requireCoopRole(request, ctx, COOP_VIEW_AND_LOG_ROLES);
    const board = await readTasksBoardDoc(ctx);
    const refreshed = refreshTaskStatusesAt(board.tasks, nowIso);

    if (mode === 'create_from_preset') {
      const presetId = String(body?.presetId || '').trim();
      const preset = board.presets.find((p) => p.id === presetId && p.active);
      if (!preset) {
        throw new CoopHttpError(
          404,
          'Selected task preset was not found or is inactive.',
          'PRESET_NOT_FOUND'
        );
      }
      const claimImmediately = body?.claimImmediately === true;
      const customNote = String(body?.description || preset.description)
        .trim()
        .slice(0, 600);
      const customTitle =
        String(body?.title || preset.title).trim().slice(0, 140) || preset.title;
      const worker = resolveCallerWorkerProfile(caller);
      const barcodeCheck = detectOwnBarcodeWarning(
        [customTitle, customNote],
        worker.prefix
      );

      const newTask: CoopTaskItem = {
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        presetId: preset.id,
        isCustom: false,
        title: customTitle,
        description: customNote,
        functionTag: preset.functionTag,
        category: preset.category,
        points: clampTaskPoints(preset.basePoints),
        proposedPoints: clampTaskPoints(preset.basePoints),
        status: claimImmediately ? 'claimed' : 'open',
        createdByUserId: caller.userId,
        createdByName: caller.name,
        createdAt: nowIso,
        updatedAt: nowIso,
        snapshotEligibleVoters: caller.confirmedVotingMemberCount,
        valueVotes: [],
        claimedByUserId: claimImmediately ? caller.userId : undefined,
        claimedByName: claimImmediately ? worker.memberName : undefined,
        claimedPartner: claimImmediately ? worker.partner : undefined,
        claimedPrefix: claimImmediately ? worker.prefix : undefined,
        claimedAt: claimImmediately ? nowIso : undefined,
        ownBarcodeWarning: barcodeCheck.warning || undefined,
        ownBarcodeMatchedTokens: barcodeCheck.warning
          ? barcodeCheck.matchedTokens
          : undefined,
        peerApprovals: [],
      };

      const nextTasks = [newTask, ...refreshed.tasks];
      const version = await writeTasksBoardDoc(
        ctx,
        board.presets,
        nextTasks,
        caller,
        expectedVersion
      );
      return jsonResponse({ ok: true, version, task: newTask, tasks: nextTasks });
    }

    if (mode === 'propose_custom') {
      const title = String(body?.title || '').trim().slice(0, 140);
      if (title.length < 3) {
        throw new CoopHttpError(
          400,
          'Custom task title must be at least 3 characters.',
          'INVALID_TITLE'
        );
      }
      const description = String(body?.description || '').trim().slice(0, 600);
      const categoryRaw = String(
        body?.category || 'Booth Restock'
      ).trim() as CoopLaborCategory;
      const category: CoopLaborCategory = COOP_LABOR_CATEGORIES.includes(categoryRaw)
        ? categoryRaw
        : 'Booth Restock';
      const functionTag = normalizeFunctionTag(body?.functionTag, category);
      const proposedPoints = clampTaskPoints(body?.proposedPoints, 1.5);
      const snapshotEligible = Math.max(1, caller.confirmedVotingMemberCount);
      const closesAt = new Date(
        Date.now() + CUSTOM_TASK_VOTE_WINDOW_MS
      ).toISOString();

      const worker = resolveCallerWorkerProfile(caller);
      const barcodeCheck = detectOwnBarcodeWarning(
        [title, description],
        worker.prefix
      );

      const initialVote = {
        userId: caller.userId,
        name: caller.name,
        points: proposedPoints,
        at: nowIso,
      };
      const evalRes = evaluateTaskValueVote(
        {
          proposedPoints,
          snapshotEligibleVoters: snapshotEligible,
          votingClosesAt: closesAt,
          valueVotes: [initialVote],
        },
        nowIso
      );

      const newTask: CoopTaskItem = {
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        isCustom: true,
        title,
        description,
        functionTag,
        category,
        points: evalRes.resolvedPoints,
        proposedPoints,
        status: evalRes.nextStatus,
        createdByUserId: caller.userId,
        createdByName: caller.name,
        createdAt: nowIso,
        updatedAt: nowIso,
        snapshotEligibleVoters: snapshotEligible,
        votingOpensAt: nowIso,
        votingClosesAt: closesAt,
        valueVotes: [initialVote],
        ownBarcodeWarning: barcodeCheck.warning || undefined,
        ownBarcodeMatchedTokens: barcodeCheck.warning
          ? barcodeCheck.matchedTokens
          : undefined,
        peerApprovals: [],
      };

      const nextTasks = [newTask, ...refreshed.tasks];
      const version = await writeTasksBoardDoc(
        ctx,
        board.presets,
        nextTasks,
        caller,
        expectedVersion
      );
      return jsonResponse({ ok: true, version, task: newTask, tasks: nextTasks });
    }

    const taskId = String(body?.taskId || '').trim();
    const taskIdx = refreshed.tasks.findIndex((t) => t.id === taskId);
    if (taskIdx < 0) {
      throw new CoopHttpError(404, 'Task not found on the board.', 'NOT_FOUND');
    }
    const target = refreshed.tasks[taskIdx];

    if (mode === 'vote_value') {
      if (target.status !== 'voting_value') {
        throw new CoopHttpError(
          409,
          'Point-value voting is closed for this task.',
          'VOTING_CLOSED'
        );
      }
      const votedPoints = clampTaskPoints(body?.points, target.proposedPoints);
      const otherVotes = (target.valueVotes || []).filter(
        (v) => v.userId !== caller.userId
      );
      const nextVotes = [
        ...otherVotes,
        {
          userId: caller.userId,
          name: caller.name,
          points: votedPoints,
          at: nowIso,
        },
      ];
      const evalRes = evaluateTaskValueVote(
        {
          proposedPoints: target.proposedPoints,
          snapshotEligibleVoters: target.snapshotEligibleVoters,
          votingClosesAt: target.votingClosesAt,
          valueVotes: nextVotes,
        },
        nowIso
      );

      const updated: CoopTaskItem = {
        ...target,
        valueVotes: nextVotes,
        status: evalRes.nextStatus,
        points:
          evalRes.nextStatus === 'open' ? evalRes.resolvedPoints : target.points,
        tiebreakReason: evalRes.tiebreakReason,
        updatedAt: nowIso,
      };
      const nextTasks = refreshed.tasks.map((t, i) => (i === taskIdx ? updated : t));
      const version = await writeTasksBoardDoc(
        ctx,
        board.presets,
        nextTasks,
        caller,
        expectedVersion
      );
      return jsonResponse({ ok: true, version, task: updated, tasks: nextTasks });
    }

    if (mode === 'claim') {
      if (target.status !== 'open') {
        throw new CoopHttpError(
          409,
          'Only open tasks can be claimed.',
          'NOT_OPEN'
        );
      }
      const worker = resolveCallerWorkerProfile(caller);
      const barcodeCheck = detectOwnBarcodeWarning(
        [target.title, target.description],
        worker.prefix
      );
      const updated: CoopTaskItem = {
        ...target,
        status: 'claimed',
        claimedByUserId: caller.userId,
        claimedByName: worker.memberName,
        claimedPartner: worker.partner,
        claimedPrefix: worker.prefix,
        claimedAt: nowIso,
        ownBarcodeWarning:
          barcodeCheck.warning || target.ownBarcodeWarning || undefined,
        ownBarcodeMatchedTokens: barcodeCheck.warning
          ? barcodeCheck.matchedTokens
          : target.ownBarcodeMatchedTokens,
        updatedAt: nowIso,
      };
      const nextTasks = refreshed.tasks.map((t, i) => (i === taskIdx ? updated : t));
      const version = await writeTasksBoardDoc(
        ctx,
        board.presets,
        nextTasks,
        caller,
        expectedVersion
      );
      return jsonResponse({ ok: true, version, task: updated, tasks: nextTasks });
    }

    if (mode === 'unclaim') {
      if (target.status !== 'claimed') {
        throw new CoopHttpError(409, 'Task is not currently claimed.', 'NOT_CLAIMED');
      }
      if (target.claimedByUserId !== caller.userId && !caller.isFounder) {
        throw new CoopHttpError(
          403,
          'Only the member who claimed this task (or a Founder) can release it.',
          'FORBIDDEN'
        );
      }
      const updated: CoopTaskItem = {
        ...target,
        status: 'open',
        claimedByUserId: undefined,
        claimedByName: undefined,
        claimedPartner: undefined,
        claimedPrefix: undefined,
        claimedAt: undefined,
        updatedAt: nowIso,
      };
      const nextTasks = refreshed.tasks.map((t, i) => (i === taskIdx ? updated : t));
      const version = await writeTasksBoardDoc(
        ctx,
        board.presets,
        nextTasks,
        caller,
        expectedVersion
      );
      return jsonResponse({ ok: true, version, task: updated, tasks: nextTasks });
    }

    if (mode === 'submit_completion') {
      if (target.status !== 'open' && target.status !== 'claimed') {
        throw new CoopHttpError(
          409,
          'Only open or claimed tasks can be submitted for peer sign-off.',
          'INVALID_STATE'
        );
      }
      if (
        target.status === 'claimed' &&
        target.claimedByUserId &&
        target.claimedByUserId !== caller.userId &&
        !caller.isFounder
      ) {
        throw new CoopHttpError(
          403,
          `This task is currently claimed by ${target.claimedByName || 'another member'}.`,
          'CLAIMED_BY_OTHER'
        );
      }

      if (!caller.isFounder && !caller.linkedMember) {
        throw new CoopHttpError(
          403,
          'Ask a Founder to assign your Barcode Prefix in /coop/governance (Roster) before logging task completions.',
          'ACCOUNT_NOT_LINKED'
        );
      }

      const completedDate = String(body?.completedDate || pacificTodayYmd()).trim();
      if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(completedDate)) {
        throw new CoopHttpError(
          400,
          'Completion date must be a valid YYYY-MM-DD calendar date.',
          'INVALID_DATE'
        );
      }
      const completedMonthKey = laborEntryMonthKey(completedDate);
      if (!completedMonthKey) {
        throw new CoopHttpError(400, 'Invalid completion date month.', 'INVALID_DATE');
      }

      // Check month-lock BEFORE moving into pending_approval (Audit Blocker #3)
      await assertMonthUnlocked(ctx, completedMonthKey);

      const worker = resolveCallerWorkerProfile(caller);
      const deliverableRef =
        String(body?.deliverableRef || '').trim().slice(0, 500) || undefined;
      const completionNotes = String(body?.completionNotes || '')
        .trim()
        .slice(0, 1500);

      const barcodeCheck = detectOwnBarcodeWarning(
        [target.title, target.description, completionNotes, deliverableRef],
        worker.prefix
      );

      const updated: CoopTaskItem = {
        ...target,
        status: 'pending_approval',
        completedByUserId: caller.userId,
        completedByName: worker.memberName,
        completedPartner: worker.partner,
        claimedPrefix: worker.prefix,
        completedDate,
        deliverableRef,
        completionNotes: completionNotes || `${target.title} completed`,
        submittedAt: nowIso,
        ownBarcodeWarning: barcodeCheck.warning || undefined,
        ownBarcodeMatchedTokens: barcodeCheck.warning
          ? barcodeCheck.matchedTokens
          : undefined,
        peerApprovals: [],
        updatedAt: nowIso,
      };

      const nextTasks = refreshed.tasks.map((t, i) => (i === taskIdx ? updated : t));
      const version = await writeTasksBoardDoc(
        ctx,
        board.presets,
        nextTasks,
        caller,
        expectedVersion
      );
      return jsonResponse({ ok: true, version, task: updated, tasks: nextTasks });
    }

    if (mode === 'approve_completion') {
      if (target.status !== 'pending_approval') {
        throw new CoopHttpError(
          409,
          'This task is not awaiting peer sign-off.',
          'INVALID_STATE'
        );
      }

      const policy = resolvePeerApprovalPolicy(
        caller.confirmedVotingMemberCount,
        caller.soleFounder
      );
      const isSelf = target.completedByUserId === caller.userId;
      if (isSelf && !policy.allowSoleFounderSelf) {
        throw new CoopHttpError(
          403,
          'Self-approval blocked: another Collective member must sign off on your completed task.',
          'SELF_APPROVAL_BLOCKED'
        );
      }

      if ((target.peerApprovals || []).some((a) => a.userId === caller.userId)) {
        throw new CoopHttpError(
          409,
          'You have already signed off on this task.',
          'ALREADY_SIGNED_OFF'
        );
      }

      const newSignoff: CoopTaskPeerApproval = {
        userId: caller.userId,
        name: caller.name,
        isFounder: caller.isFounder || undefined,
        at: nowIso,
      };
      const nextApprovals = [...(target.peerApprovals || []), newSignoff];

      if (nextApprovals.length < policy.requiredCount) {
        const updatedPending: CoopTaskItem = {
          ...target,
          peerApprovals: nextApprovals,
          updatedAt: nowIso,
        };
        const nextTasks = refreshed.tasks.map((t, i) =>
          i === taskIdx ? updatedPending : t
        );
        const version = await writeTasksBoardDoc(
          ctx,
          board.presets,
          nextTasks,
          caller,
          expectedVersion
        );
        return jsonResponse({
          ok: true,
          version,
          task: updatedPending,
          tasks: nextTasks,
          remainingApprovals: policy.requiredCount - nextApprovals.length,
        });
      }

      // Final peer sign-off reached -> verify month lock & write Official Labor Ledger first (Audit Blockers #1-#3)
      const completedDate = String(target.completedDate || '').trim();
      const completedMonthKey = laborEntryMonthKey(completedDate);
      if (!completedMonthKey) {
        throw new CoopHttpError(
          422,
          'Task has an invalid completion date — please re-submit.',
          'INVALID_DATE'
        );
      }
      await assertMonthUnlocked(ctx, completedMonthKey);

      const founderSigner = nextApprovals.find((a) => a.isFounder === true);
      const hasFounderAuthority = Boolean(founderSigner);
      const laborApprovalStatus: 'approved' | 'pending' = hasFounderAuthority
        ? 'approved'
        : 'pending';
      const selfFlag = isSelf && policy.allowSoleFounderSelf ? true : undefined;

      const detLaborId = deterministicTaskLaborId(target.id);
      const laborDoc = await readMonthlyLaborDoc(ctx, completedMonthKey);
      const alreadyLogged = laborDoc.entries.some((e) => e.id === detLaborId);

      if (!alreadyLogged) {
        const peerNames = nextApprovals.map((a) => a.name).join(', ');
        const combinedNotes = [
          `[Task Board: ${target.title}]`,
          target.completionNotes || '',
          `(Signed off by: ${peerNames})`,
        ]
          .filter(Boolean)
          .join(' ')
          .slice(0, 2000);

        const hours = clampTaskPoints(target.points);
        const laborEntry: CoopLaborEntry = {
          id: detLaborId,
          date: completedDate,
          member: target.completedByName || 'Member',
          memberUserId: target.completedByUserId,
          partner: target.completedPartner || 'HUCK',
          category: target.category,
          functionTag: target.functionTag,
          hours,
          points: hours,
          taskId: target.id,
          ownBarcodeWarning: target.ownBarcodeWarning,
          peerApprovals: nextApprovals,
          notes: combinedNotes,
          deliverableRef: target.deliverableRef,
          approval: laborApprovalStatus,
          approvedBy: founderSigner?.name,
          approvedByUserId: founderSigner?.userId,
          approvedAt: hasFounderAuthority ? nowIso : undefined,
          selfApproved: selfFlag,
          loggedByUserId: target.completedByUserId,
          loggedByName: target.completedByName,
          updatedAt: nowIso,
        };

        const nextLaborAudit: LaborAuditEvent[] = [
          ...laborDoc.audit,
          {
            at: nowIso,
            action: 'task_board_completion',
            entryId: detLaborId,
            byUserId: caller.userId,
            byName: caller.name,
            breakGlass: caller.isBreakGlassAdmin || undefined,
            selfApproved: selfFlag,
            note: `${hours}h (${laborApprovalStatus}) from task "${target.title}"`,
          },
        ];

        await writeMonthlyLaborDoc(
          ctx,
          completedMonthKey,
          [laborEntry, ...laborDoc.entries],
          nextLaborAudit,
          caller,
          laborDoc.version
        );
      }

      const completedTask: CoopTaskItem = {
        ...target,
        status: 'completed',
        peerApprovals: nextApprovals,
        selfApproved: selfFlag,
        linkedLaborEntryId: detLaborId,
        linkedLaborApproval: laborApprovalStatus,
        updatedAt: nowIso,
      };
      const nextTasks = refreshed.tasks.map((t, i) =>
        i === taskIdx ? completedTask : t
      );
      const version = await writeTasksBoardDoc(
        ctx,
        board.presets,
        nextTasks,
        caller,
        expectedVersion
      );

      return jsonResponse({
        ok: true,
        version,
        task: completedTask,
        tasks: nextTasks,
        remainingApprovals: 0,
        linkedLaborEntryId: detLaborId,
        linkedLaborApproval: laborApprovalStatus,
      });
    }

    if (mode === 'archive_task') {
      if (target.status === 'completed') {
        throw new CoopHttpError(
          409,
          'Completed tasks are already archived into the Official Labor Ledger.',
          'ALREADY_COMPLETED'
        );
      }
      if (target.createdByUserId !== caller.userId && !caller.isFounder) {
        throw new CoopHttpError(
          403,
          'Only the creator or a Founder can archive this task.',
          'FORBIDDEN'
        );
      }
      const updated: CoopTaskItem = {
        ...target,
        status: 'archived',
        updatedAt: nowIso,
      };
      const nextTasks = refreshed.tasks.map((t, i) => (i === taskIdx ? updated : t));
      const version = await writeTasksBoardDoc(
        ctx,
        board.presets,
        nextTasks,
        caller,
        expectedVersion
      );
      return jsonResponse({ ok: true, version, task: updated, tasks: nextTasks });
    }

    throw new CoopHttpError(400, `Unsupported task board mode "${mode}".`, 'INVALID_MODE');
  } catch (err) {
    return errorResponse(err);
  }
}
