import { account } from './appwrite';
import type { CoopLaborCategory, CoopLaborEntry } from './coopGovernance';
import type { CoopMeIdentity, CoopMonthLockSnapshot } from '../types/coop';

export class CoopLedgerApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'CoopLedgerApiError';
    this.status = status;
    this.code = code;
  }
}

export async function getCoopJwtHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (typeof window === 'undefined') return headers;
  try {
    const jwt = await account.createJWT();
    if (jwt?.jwt) {
      headers['X-Appwrite-JWT'] = jwt.jwt;
    }
  } catch {
    // Caller is not signed in; server will respond with 401 when auth is required
  }
  return headers;
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const msg =
      body?.error ||
      body?.message ||
      (res.status === 401
        ? 'Sign in required to access Co-op ledger.'
        : res.status === 403
          ? 'Your Co-op role does not permit this action.'
          : res.status === 423
            ? 'This settlement month is locked. A Founder must unlock it before changes can be made.'
            : `Co-op ledger request failed (${res.status}).`);
    throw new CoopLedgerApiError(msg, res.status, body?.code);
  }
  return body as T;
}

export async function fetchCoopMe(): Promise<CoopMeIdentity> {
  const headers = await getCoopJwtHeaders();
  const res = await fetch('/api/coop/me', {
    method: 'GET',
    headers,
  });
  return parseJsonResponse<CoopMeIdentity>(res);
}

export interface CoopLaborListResponse {
  entries: CoopLaborEntry[];
  months: string[];
  lockedMonths: string[];
  versionsByMonth: Record<string, number>;
  legacyPendingMigrationCount: number;
  laborMigratedAt?: string;
}

export async function fetchCoopLaborLedger(month = 'all'): Promise<CoopLaborListResponse> {
  const headers = await getCoopJwtHeaders();
  const res = await fetch(`/api/coop/labor?month=${encodeURIComponent(month)}`, {
    method: 'GET',
    headers,
  });
  return parseJsonResponse<CoopLaborListResponse>(res);
}

export type CoopLaborMutationPayload =
  | {
      mode: 'log';
      date: string;
      member: string;
      partner: 'HUCK' | 'PDXGL' | 'SWEAT';
      category: CoopLaborCategory;
      hours: number;
      notes?: string;
      deliverableRef?: string;
    }
  | {
      mode: 'edit';
      id: string;
      originalMonth?: string;
      date: string;
      member: string;
      partner: 'HUCK' | 'PDXGL' | 'SWEAT';
      category: CoopLaborCategory;
      hours: number;
      notes?: string;
      deliverableRef?: string;
      expectedVersion?: number;
    }
  | {
      mode: 'delete';
      id: string;
      month: string;
      expectedVersion?: number;
    }
  | {
      mode: 'approve' | 'reject' | 'unapprove';
      id: string;
      month: string;
      decisionNote?: string;
      expectedVersion?: number;
    }
  | {
      mode: 'bulkApprove';
      month: string;
      ids?: string[];
      decisionNote?: string;
      expectedVersion?: number;
    }
  | {
      mode: 'migrateLegacy';
    };

export interface CoopLaborMutationResponse {
  ok: boolean;
  entry?: CoopLaborEntry;
  entries?: CoopLaborEntry[];
  month?: string;
  version?: number;
  migratedCount?: number;
  approvedCount?: number;
  skippedSelfCount?: number;
  message?: string;
}

export async function mutateCoopLabor(
  payload: CoopLaborMutationPayload
): Promise<CoopLaborMutationResponse> {
  const headers = await getCoopJwtHeaders();
  const res = await fetch('/api/coop/labor', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<CoopLaborMutationResponse>(res);
}

export interface CoopMonthLockListResponse {
  lock: CoopMonthLockSnapshot | null;
  locksByMonth: Record<string, CoopMonthLockSnapshot>;
}

export async function fetchCoopMonthLocks(month = 'all'): Promise<CoopMonthLockListResponse> {
  const headers = await getCoopJwtHeaders();
  const res = await fetch(`/api/coop/month-lock?month=${encodeURIComponent(month)}`, {
    method: 'GET',
    headers,
  });
  return parseJsonResponse<CoopMonthLockListResponse>(res);
}

export async function lockCoopMonth(payload: {
  month: string;
  payoutDate?: string;
  payoutNote?: string;
  snapshot: Omit<
    CoopMonthLockSnapshot,
    'month' | 'status' | 'revision' | 'lockedBy' | 'lockedAt' | 'snapshotHash' | 'unlockHistory' | 'priorRevisionDiff'
  >;
}): Promise<{ ok: boolean; lock: CoopMonthLockSnapshot }> {
  const headers = await getCoopJwtHeaders();
  const res = await fetch('/api/coop/month-lock', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      mode: 'lock',
      ...payload,
    }),
  });
  return parseJsonResponse<{ ok: boolean; lock: CoopMonthLockSnapshot }>(res);
}

export async function unlockCoopMonth(payload: {
  month: string;
  reason: string;
}): Promise<{ ok: boolean; lock: CoopMonthLockSnapshot }> {
  const headers = await getCoopJwtHeaders();
  const res = await fetch('/api/coop/month-lock', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      mode: 'unlock',
      ...payload,
    }),
  });
  return parseJsonResponse<{ ok: boolean; lock: CoopMonthLockSnapshot }>(res);
}
