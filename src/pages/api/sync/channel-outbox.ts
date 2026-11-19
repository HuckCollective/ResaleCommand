import type { APIRoute } from 'astro';
import {
  Client as NodeClient,
  Databases as NodeDatabases,
  Permission as NodePermission,
  Role as NodeRole,
} from 'node-appwrite';
import { getEnvVar } from '../../../lib/appwriteEnv';
import { BML_CORS_HEADERS, requireBookmarkletMember } from '../../../lib/bml/serverAuth';
import {
  ackOutboxIntents,
  clearAppliedOutboxIntents,
  compactOutboxForSnapshot,
  parseOutboxSnapshot,
  resolveTargetSystemForLocation,
  upsertOutboxIntents,
  type ChannelSyncAckResult,
  type ChannelSyncIntent,
} from '../../../lib/channelSyncOutbox';
import { loadLiveWarehouseDocs } from '../../../lib/locationSettingsServer';
import { toUserMessage } from '../../../lib/userFacingErrors';
import {
  getLocationManifestDocIds,
  getLocationSettingMeta,
  resolveCanonicalLocationCode,
  resolveDefaultRicochetLocationMeta,
} from '../../../lib/warehouses';

export const prerender = false;

const CORS_HEADERS: Record<string, string> = BML_CORS_HEADERS;
const MANIFESTS_COL_ID = 'manifests';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });

function getAppwriteClients() {
  const endpoint = getEnvVar('PUBLIC_APPWRITE_ENDPOINT', 'https://sfo.cloud.appwrite.io/v1');
  const project = getEnvVar('PUBLIC_APPWRITE_PROJECT_ID', '69714b35003a8adab6bb');
  const apiKey = getEnvVar('APPWRITE_API_KEY', '');
  const dbId = getEnvVar('PUBLIC_APPWRITE_DB_ID', 'resale_db');

  const publicClient = new NodeClient().setEndpoint(endpoint).setProject(project);
  const publicDb = new NodeDatabases(publicClient);

  let keyedDb: NodeDatabases | null = null;
  if (apiKey) {
    const keyedClient = new NodeClient().setEndpoint(endpoint).setProject(project).setKey(apiKey);
    keyedDb = new NodeDatabases(keyedClient);
  }

  async function withDb<T>(fn: (db: NodeDatabases) => Promise<T>): Promise<T> {
    if (keyedDb) {
      try {
        return await fn(keyedDb);
      } catch (err: any) {
        const msg = String(err?.message || '');
        if (err?.code === 401 || err?.code === 403 || msg.includes('X-Appwrite-Key') || msg.includes('API key')) {
          keyedDb = null;
          return await fn(publicDb);
        }
        throw err;
      }
    }
    return await fn(publicDb);
  }

  return { withDb, dbId };
}

function getDocPerms() {
  return [
    NodePermission.read(NodeRole.any()),
    NodePermission.update(NodeRole.any()),
    NodePermission.delete(NodeRole.any()),
  ];
}

async function resolveOutboxContext(rawLocation?: string | null) {
  const liveWarehouses = await loadLiveWarehouseDocs().catch(() => []);
  const defaultMeta = resolveDefaultRicochetLocationMeta(liveWarehouses);
  const resolvedCode = resolveCanonicalLocationCode(rawLocation || '', liveWarehouses);
  const locationCode = (resolvedCode || defaultMeta.code).toUpperCase();
  const locMeta = getLocationSettingMeta(locationCode, liveWarehouses);
  const { channelOutboxDocId } = getLocationManifestDocIds(locMeta.code, liveWarehouses);
  const targetSystem = resolveTargetSystemForLocation(locMeta);
  return { locMeta, channelOutboxDocId, targetSystem };
}

async function loadOutboxIntents(
  appwrite: ReturnType<typeof getAppwriteClients>,
  docId: string,
  locationCode: string
) {
  try {
    const doc: any = await appwrite.withDb((db) =>
      db.getDocument(appwrite.dbId, MANIFESTS_COL_ID, docId)
    );
    const parsed = parseOutboxSnapshot(doc?.itemsSnapshot, locationCode);
    return parsed;
  } catch (err: any) {
    if (err?.code === 404 || String(err?.message || '').toLowerCase().includes('not be found')) {
      return parseOutboxSnapshot(null, locationCode);
    }
    throw err;
  }
}

async function saveOutboxIntents(
  appwrite: ReturnType<typeof getAppwriteClients>,
  ctx: Awaited<ReturnType<typeof resolveOutboxContext>>,
  intents: ChannelSyncIntent[]
) {
  const { locMeta, channelOutboxDocId } = ctx;
  const { snapshot, serialized } = compactOutboxForSnapshot(intents, locMeta.code);
  const pendingCount = snapshot.intents.filter((it) => it.status === 'pending').length;
  const failedCount = snapshot.intents.filter((it) => it.status === 'failed').length;

  const docPayload: Record<string, any> = {
    name: `${locMeta.shortName} Channel Sync Outbox`,
    tenantId: 'system',
    locationId: locMeta.id || locMeta.code,
    locationName: locMeta.shortName,
    status: 'channel_outbox',
    itemCount: pendingCount,
    itemsSnapshot: serialized,
    notes: JSON.stringify({
      updatedAt: snapshot.updatedAt,
      pendingCount,
      failedCount,
      totalCount: snapshot.intents.length,
    }).slice(0, 4000),
  };

  const docPerms = getDocPerms();
  try {
    await appwrite.withDb((db) =>
      db.updateDocument(appwrite.dbId, MANIFESTS_COL_ID, channelOutboxDocId, docPayload, docPerms)
    );
  } catch (updateErr: any) {
    if (
      updateErr?.code === 404 ||
      String(updateErr?.message || '').toLowerCase().includes('not be found')
    ) {
      await appwrite.withDb((db) =>
        db.createDocument(appwrite.dbId, MANIFESTS_COL_ID, channelOutboxDocId, docPayload, docPerms)
      );
    } else {
      throw updateErr;
    }
  }

  return snapshot;
}

export const OPTIONS: APIRoute = async () =>
  new Response(null, { status: 204, headers: CORS_HEADERS });

export const GET: APIRoute = async ({ request, url }) => {
  const auth = await requireBookmarkletMember(request, { allowSameOriginCookieFallback: true });
  if (!auth.ok) return auth.response;

  try {
    const rawLocation = url.searchParams.get('location') || '';
    const ctx = await resolveOutboxContext(rawLocation);
    const appwrite = getAppwriteClients();
    const snapshot = await loadOutboxIntents(appwrite, ctx.channelOutboxDocId, ctx.locMeta.code);
    const pendingIntents = snapshot.intents.filter((it) => it.status === 'pending' || it.status === 'failed');

    return json({
      ok: true,
      locationCode: ctx.locMeta.code,
      locationName: ctx.locMeta.shortName,
      targetSystem: ctx.targetSystem,
      pendingCount: pendingIntents.length,
      totalCount: snapshot.intents.length,
      updatedAt: snapshot.updatedAt || null,
      intents: snapshot.intents,
      pendingIntents,
    });
  } catch (err: any) {
    return json(
      {
        ok: false,
        error: toUserMessage(err, 'Could not load the channel sync queue right now.'),
      },
      500
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireBookmarkletMember(request);
  if (!auth.ok) return auth.response;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Please send a valid sync request.' }, 400);
  }

  const mode = String(body?.mode || '').trim();
  if (!['enqueue', 'ack', 'clear_applied'].includes(mode)) {
    return json({ ok: false, error: 'Unsupported sync queue action.' }, 400);
  }

  try {
    const rawLocation = String(body?.location || body?.locationCode || '').trim();
    const ctx = await resolveOutboxContext(rawLocation);
    const appwrite = getAppwriteClients();
    const current = await loadOutboxIntents(appwrite, ctx.channelOutboxDocId, ctx.locMeta.code);

    let nextIntents = current.intents;
    let addedCount = 0;
    let updatedCount = 0;
    let removedCount = 0;

    if (mode === 'enqueue') {
      const incoming = Array.isArray(body?.intents)
        ? body.intents
        : body?.intent && typeof body.intent === 'object'
          ? [body.intent]
          : [];
      if (incoming.length === 0) {
        return json({ ok: false, error: 'Choose at least one item to queue for sync.' }, 400);
      }
      const res = upsertOutboxIntents(current.intents, incoming, {
        locationCode: ctx.locMeta.code,
        targetSystem: ctx.targetSystem,
        createdBy: auth.member.name || 'Member',
      });
      nextIntents = res.intents;
      addedCount = res.addedCount;
      updatedCount = res.updatedCount;
    } else if (mode === 'ack') {
      const results: ChannelSyncAckResult[] = Array.isArray(body?.results)
        ? body.results
        : body?.id
          ? [
              {
                id: String(body.id),
                status: body.status === 'skipped' || body.status === 'failed' ? body.status : 'applied',
                error: body.error ? String(body.error) : undefined,
              },
            ]
          : [];
      if (results.length === 0) {
        return json({ ok: false, error: 'Choose at least one sync item to update.' }, 400);
      }
      const res = ackOutboxIntents(current.intents, results);
      nextIntents = res.intents;
      updatedCount = res.updatedCount;
    } else if (mode === 'clear_applied') {
      const res = clearAppliedOutboxIntents(current.intents);
      nextIntents = res.intents;
      removedCount = res.removedCount;
    }

    const saved = await saveOutboxIntents(appwrite, ctx, nextIntents);
    const pendingIntents = saved.intents.filter((it) => it.status === 'pending' || it.status === 'failed');

    return json({
      ok: true,
      mode,
      locationCode: ctx.locMeta.code,
      locationName: ctx.locMeta.shortName,
      targetSystem: ctx.targetSystem,
      addedCount,
      updatedCount,
      removedCount,
      pendingCount: pendingIntents.length,
      totalCount: saved.intents.length,
      updatedAt: saved.updatedAt,
      intents: saved.intents,
      pendingIntents,
    });
  } catch (err: any) {
    return json(
      {
        ok: false,
        error: toUserMessage(err, 'Could not update the channel sync queue right now.'),
      },
      500
    );
  }
};
