export type ChannelTargetSystem =
  | 'ricochet'
  | 'paper_sheet'
  | 'square'
  | 'simpleconsign'
  | 'online_marketplace';

export type ChannelSyncAction =
  | 'deactivate_or_remove'
  | 'update_price'
  | 'update_title'
  | 'fill_blank_upc'
  | 'publish_listing';

export type ChannelSyncIntentStatus = 'pending' | 'applied' | 'skipped' | 'failed';

export interface ChannelSyncIntent {
  id: string;
  locationCode: string;
  targetSystem: ChannelTargetSystem;
  action: ChannelSyncAction;
  /** Optional target marketplace key for `publish_listing` intents (`poshmark`, `depop`, `ebay`, `whatnot`). */
  platform?: string;
  rcItemId: string;
  rcUpc: string;
  externalSku: string;
  title: string;
  keeperUpc?: string;
  keeperExternalSku?: string;
  payload?: Record<string, any>;
  reason: string;
  status: ChannelSyncIntentStatus;
  createdBy: string;
  createdAt: string;
  appliedAt?: string;
  error?: string;
}

export interface ChannelSyncAckResult {
  id: string;
  status: 'applied' | 'skipped' | 'failed';
  error?: string;
  appliedAt?: string;
}

export interface ChannelSyncAdapter {
  id: ChannelTargetSystem;
  label: string;
  matchesLocation(meta: { usesRicochet?: boolean; supportsPaperSalesSheet?: boolean }): boolean;
  fetchPending(locationCode: string): Promise<ChannelSyncIntent[]>;
  ackApplied(locationCode: string, results: ChannelSyncAckResult[]): Promise<void>;
}

export interface ChannelOutboxSnapshot {
  version: 1;
  locationCode: string;
  updatedAt: string;
  intents: ChannelSyncIntent[];
}

export interface NewChannelSyncIntentInput {
  id?: string;
  locationCode?: string;
  targetSystem?: ChannelTargetSystem;
  action: ChannelSyncAction;
  platform?: string;
  rcItemId?: string;
  rcUpc?: string;
  externalSku?: string;
  title: string;
  keeperUpc?: string;
  keeperExternalSku?: string;
  payload?: Record<string, any>;
  reason?: string;
  createdBy?: string;
  createdAt?: string;
}

const cleanStr = (v: unknown, maxLen = 200): string =>
  String(v ?? '')
    .trim()
    .slice(0, maxLen);

const cleanUpper = (v: unknown, maxLen = 64): string =>
  cleanStr(v, maxLen)
    .replace(/^['"]+|['"]+$/g, '')
    .toUpperCase();

export function resolveTargetSystemForLocation(
  meta?: { usesRicochet?: boolean; supportsPaperSalesSheet?: boolean } | null
): ChannelTargetSystem {
  if (meta?.usesRicochet) return 'ricochet';
  if (meta?.supportsPaperSalesSheet) return 'paper_sheet';
  return 'online_marketplace';
}

export function buildIntentDedupeKey(intent: {
  id?: string;
  action: ChannelSyncAction;
  platform?: string;
  payload?: Record<string, any>;
  rcItemId?: string;
  externalSku?: string;
}): string {
  const action = cleanStr(intent.action, 40) || 'deactivate_or_remove';
  const rawPlat = cleanStr(intent.platform || intent.payload?.platform, 32).toLowerCase();
  const platSuffix = action === 'publish_listing' && rawPlat ? `:${rawPlat}` : '';
  const rcItemId = cleanStr(intent.rcItemId, 64);
  if (rcItemId) return `item:${rcItemId}:${action}${platSuffix}`;
  const extSku = cleanUpper(intent.externalSku, 64);
  if (extSku) return `sku:${extSku}:${action}${platSuffix}`;
  return `id:${cleanStr(intent.id, 80) || Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeChannelSyncIntent(
  raw: NewChannelSyncIntentInput | ChannelSyncIntent,
  defaults: {
    locationCode: string;
    targetSystem: ChannelTargetSystem;
    createdBy?: string;
  }
): ChannelSyncIntent {
  const nowIso = new Date().toISOString();
  const action: ChannelSyncAction =
    raw.action === 'update_price' ||
    raw.action === 'update_title' ||
    raw.action === 'fill_blank_upc' ||
    raw.action === 'publish_listing'
      ? raw.action
      : 'deactivate_or_remove';
  const platform = cleanStr(raw.platform || raw.payload?.platform, 32).toLowerCase();
  const rcItemId = cleanStr(raw.rcItemId, 64);
  const rcUpc = cleanUpper(raw.rcUpc, 48);
  const externalSku = cleanUpper(raw.externalSku, 48);
  const locationCode = cleanUpper(raw.locationCode || defaults.locationCode, 16) || defaults.locationCode;
  const targetSystem: ChannelTargetSystem = raw.targetSystem || defaults.targetSystem;

  const fallbackIdSeed = `${locationCode}_${action}${platform ? `_${platform}` : ''}_${rcItemId || externalSku || rcUpc || Date.now()}`
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_');

  const rawStatus = (raw as ChannelSyncIntent).status;
  const status: ChannelSyncIntentStatus =
    rawStatus === 'applied' || rawStatus === 'skipped' || rawStatus === 'failed'
      ? rawStatus
      : 'pending';

  const normalized: ChannelSyncIntent = {
    id: cleanStr(raw.id, 96) || `${fallbackIdSeed}_${Math.random().toString(36).slice(2, 7)}`,
    locationCode,
    targetSystem,
    action,
    rcItemId,
    rcUpc,
    externalSku,
    title: cleanStr(raw.title, 180) || 'Untitled Item',
    reason: cleanStr(raw.reason, 240) || 'Queued from Works@TheHC',
    status,
    createdBy: cleanStr(raw.createdBy || defaults.createdBy || 'Member', 80),
    createdAt: cleanStr(raw.createdAt, 48) || nowIso,
  };

  if (platform) normalized.platform = platform;
  if (raw.keeperUpc) normalized.keeperUpc = cleanUpper(raw.keeperUpc, 48);
  if (raw.keeperExternalSku) normalized.keeperExternalSku = cleanUpper(raw.keeperExternalSku, 48);
  if (raw.payload && typeof raw.payload === 'object' && Object.keys(raw.payload).length > 0) {
    // Keep publish_listing outbox payloads compact and privacy-safe (full copy/photos fetch via /api/bml/listing-packet)
    if (action === 'publish_listing') {
      const safePayload: Record<string, any> = {};
      if (platform) safePayload.platform = platform;
      if (raw.payload.listingUrl) safePayload.listingUrl = cleanStr(raw.payload.listingUrl, 240);
      if (Object.keys(safePayload).length > 0) normalized.payload = safePayload;
    } else {
      normalized.payload = raw.payload;
    }
  }
  if ((raw as ChannelSyncIntent).appliedAt) {
    normalized.appliedAt = cleanStr((raw as ChannelSyncIntent).appliedAt, 48);
  }
  if ((raw as ChannelSyncIntent).error) {
    normalized.error = cleanStr((raw as ChannelSyncIntent).error, 280);
  }
  return normalized;
}

export function upsertOutboxIntents(
  existing: ChannelSyncIntent[],
  incoming: Array<NewChannelSyncIntentInput | ChannelSyncIntent>,
  defaults: {
    locationCode: string;
    targetSystem: ChannelTargetSystem;
    createdBy?: string;
  }
): { intents: ChannelSyncIntent[]; addedCount: number; updatedCount: number } {
  const list = existing.map((it) => ({ ...it }));
  let addedCount = 0;
  let updatedCount = 0;

  for (const raw of incoming) {
    if (!raw || typeof raw !== 'object') continue;
    const candidate = normalizeChannelSyncIntent(raw, defaults);
    const key = buildIntentDedupeKey(candidate);

    const existingIdx = list.findIndex(
      (it) =>
        (it.status === 'pending' || it.status === 'failed') &&
        buildIntentDedupeKey(it) === key
    );

    if (existingIdx !== -1) {
      const prev = list[existingIdx];
      list[existingIdx] = {
        ...prev,
        ...candidate,
        id: prev.id,
        status: 'pending',
        createdAt: prev.createdAt || candidate.createdAt,
        appliedAt: undefined,
        error: undefined,
      };
      updatedCount++;
    } else {
      // Check exact ID collision if caller supplied an explicit ID
      const byIdIdx = list.findIndex((it) => it.id === candidate.id);
      if (byIdIdx !== -1) {
        const prev = list[byIdIdx];
        list[byIdIdx] = {
          ...prev,
          ...candidate,
          id: prev.id,
          status: 'pending',
          appliedAt: undefined,
          error: undefined,
        };
        updatedCount++;
      } else {
        list.unshift(candidate);
        addedCount++;
      }
    }
  }

  return { intents: list, addedCount, updatedCount };
}

export function ackOutboxIntents(
  existing: ChannelSyncIntent[],
  results: ChannelSyncAckResult[]
): { intents: ChannelSyncIntent[]; updatedCount: number } {
  const byId = new Map<string, ChannelSyncAckResult>();
  for (const res of results) {
    if (res && res.id) {
      byId.set(String(res.id), res);
    }
  }

  const nowIso = new Date().toISOString();
  let updatedCount = 0;

  const intents = existing.map((it) => {
    const ack = byId.get(it.id);
    if (!ack) return it;
    updatedCount++;
    const nextStatus: ChannelSyncIntentStatus =
      ack.status === 'applied' || ack.status === 'skipped' || ack.status === 'failed'
        ? ack.status
        : 'applied';

    const next: ChannelSyncIntent = {
      ...it,
      status: nextStatus,
    };
    if (nextStatus === 'applied' || nextStatus === 'skipped') {
      next.appliedAt = cleanStr(ack.appliedAt, 48) || nowIso;
      delete next.error;
    } else if (nextStatus === 'failed') {
      next.error = cleanStr(ack.error || 'Sync attempt failed', 280);
    }
    return next;
  });

  return { intents, updatedCount };
}

export function clearAppliedOutboxIntents(existing: ChannelSyncIntent[]): {
  intents: ChannelSyncIntent[];
  removedCount: number;
} {
  const kept = existing.filter((it) => it.status === 'pending' || it.status === 'failed');
  return {
    intents: kept,
    removedCount: existing.length - kept.length,
  };
}

export function parseOutboxSnapshot(
  rawSnapshot: unknown,
  locationCode: string
): ChannelOutboxSnapshot {
  const fallback: ChannelOutboxSnapshot = {
    version: 1,
    locationCode: cleanUpper(locationCode, 16) || 'MD',
    updatedAt: '',
    intents: [],
  };
  if (!rawSnapshot) return fallback;
  try {
    const parsed =
      typeof rawSnapshot === 'string' ? JSON.parse(rawSnapshot) : (rawSnapshot as any);
    if (parsed && Array.isArray(parsed.intents)) {
      const normalized = parsed.intents.filter(
        (x: any) => x && typeof x === 'object' && x.id && x.action
      );
      return {
        version: 1,
        locationCode: cleanUpper(parsed.locationCode || locationCode, 16) || fallback.locationCode,
        updatedAt: cleanStr(parsed.updatedAt, 48),
        intents: normalized,
      };
    }
    if (Array.isArray(parsed)) {
      return {
        ...fallback,
        intents: parsed.filter((x: any) => x && typeof x === 'object' && x.id && x.action),
      };
    }
  } catch {
    return fallback;
  }
  return fallback;
}

export function compactOutboxForSnapshot(
  intents: ChannelSyncIntent[],
  locationCode: string,
  maxChars = 54000
): { snapshot: ChannelOutboxSnapshot; serialized: string } {
  const code = cleanUpper(locationCode, 16) || 'MD';
  const nowIso = new Date().toISOString();

  const active = intents.filter((it) => it.status === 'pending' || it.status === 'failed');
  const completed = intents
    .filter((it) => it.status === 'applied' || it.status === 'skipped')
    .sort((a, b) =>
      String(b.appliedAt || b.createdAt || '').localeCompare(
        String(a.appliedAt || a.createdAt || '')
      )
    )
    .slice(0, 40);

  let pool = [...active, ...completed];

  const makeSnap = (list: ChannelSyncIntent[]): ChannelOutboxSnapshot => ({
    version: 1,
    locationCode: code,
    updatedAt: nowIso,
    intents: list,
  });

  let snapshot = makeSnap(pool);
  let serialized = JSON.stringify(snapshot);

  // First trim completed entries from tail until within maxChars
  while (serialized.length > maxChars && pool.length > active.length) {
    pool.pop();
    snapshot = makeSnap(pool);
    serialized = JSON.stringify(snapshot);
  }

  // If active pending queue itself exceeds maxChars, compact verbose strings before truncating
  if (serialized.length > maxChars) {
    pool = pool.map((it) => ({
      ...it,
      title: cleanStr(it.title, 72),
      reason: cleanStr(it.reason, 80),
      error: it.error ? cleanStr(it.error, 120) : undefined,
    }));
    snapshot = makeSnap(pool);
    serialized = JSON.stringify(snapshot);

    while (serialized.length > maxChars && pool.length > 1) {
      pool.pop();
      snapshot = makeSnap(pool);
      serialized = JSON.stringify(snapshot);
    }
  }

  return { snapshot, serialized };
}
