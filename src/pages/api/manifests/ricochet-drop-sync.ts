import type { APIRoute } from 'astro';
import {
  Client as NodeClient,
  Databases as NodeDatabases,
  Query as NodeQuery,
} from 'node-appwrite';
import { getLocationSettingMeta, resolveCanonicalLocationCode } from '../../../lib/warehouses';

export const prerender = false;

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const MANIFESTS_COL_ID = 'manifests';
const OPEN_STATUSES = ['draft', 'paused', 'exported', 'in-transit'];
const CHUNK = 100;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });

function getAppwriteClients() {
  const endpoint =
    import.meta.env?.PUBLIC_APPWRITE_ENDPOINT ||
    process.env.PUBLIC_APPWRITE_ENDPOINT ||
    'https://sfo.cloud.appwrite.io/v1';
  const project =
    import.meta.env?.PUBLIC_APPWRITE_PROJECT_ID ||
    process.env.PUBLIC_APPWRITE_PROJECT_ID ||
    '69714b35003a8adab6bb';
  const apiKey =
    import.meta.env?.APPWRITE_API_KEY ||
    process.env.APPWRITE_API_KEY ||
    '';
  const dbId =
    import.meta.env?.PUBLIC_APPWRITE_DB_ID ||
    process.env.PUBLIC_APPWRITE_DB_ID ||
    'resale_db';
  const itemsCol =
    import.meta.env?.PUBLIC_APPWRITE_ITEMS_COLLECTION_ID ||
    process.env.PUBLIC_APPWRITE_ITEMS_COLLECTION_ID ||
    'items';

  const publicClient = new NodeClient().setEndpoint(endpoint).setProject(project);
  const publicDb = new NodeDatabases(publicClient);

  let keyedDb: NodeDatabases | null = null;
  if (apiKey) {
    const keyedClient = new NodeClient().setEndpoint(endpoint).setProject(project).setKey(apiKey);
    keyedDb = new NodeDatabases(keyedClient);
  }

  // Run against keyedDb first if present; automatically fall back to keyless publicDb if X-Appwrite-Key is invalid/expired
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

  return { withDb, dbId, itemsCol };
}

function parseList<T = any>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v : [];
    } catch {
      return raw.split(',').map((s) => s.trim()).filter(Boolean) as unknown as T[];
    }
  }
  return [];
}

const cleanSku = (v: unknown) =>
  String(v ?? '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .toUpperCase();

function parseItemPrice(it: any, snap?: any): number {
  const candidates = [
    it?.boutiquePrice,
    it?.resalePrice,
    it?.price,
    it?.listPrice,
    it?.estValue,
    snap?.boutiquePrice,
    snap?.resalePrice,
    snap?.price,
  ];
  for (const raw of candidates) {
    if (raw === null || raw === undefined || raw === '') continue;
    const cleaned = String(raw).replace(/[^0-9.]/g, '');
    const n = parseFloat(cleaned);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function manifestMatchesLocation(doc: any, code: string): boolean {
  const upperCode = code.toUpperCase();
  const meta: any = getLocationSettingMeta(upperCode);
  const ids = [meta?.$id, meta?.id, meta?.docId, upperCode].filter(Boolean);
  if (doc.locationId && ids.includes(String(doc.locationId))) return true;
  const locName = String(doc.locationName || '').toLowerCase();
  const candidateNames = [meta?.name, meta?.fullName, meta?.shortName]
    .filter(Boolean)
    .map((n: string) => n.toLowerCase());
  if (locName && candidateNames.some((n) => locName.includes(n) || n.includes(locName))) {
    return true;
  }
  return false;
}

async function fetchItems(
  appwrite: ReturnType<typeof getAppwriteClients>,
  ids: string[],
  snapshotFallback: any[] = []
) {
  const out: any[] = [];
  const snapById = new Map<string, any>();
  for (const s of snapshotFallback) {
    const sid = s?.$id || s?.id;
    if (sid) snapById.set(String(sid), s);
  }

  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    try {
      const res = await appwrite.withDb((db) =>
        db.listDocuments(appwrite.dbId, appwrite.itemsCol, [
          NodeQuery.equal('$id', slice),
          NodeQuery.limit(CHUNK),
        ])
      );
      out.push(...res.documents);
    } catch {
      // Fallback to snapshot items if items query fails
      for (const id of slice) {
        if (snapById.has(id)) out.push(snapById.get(id));
      }
    }
  }
  return out;
}

export const OPTIONS: APIRoute = async () =>
  new Response(null, { status: 204, headers: CORS_HEADERS });

export const GET: APIRoute = async ({ url }) => {
  const appwrite = getAppwriteClients();
  if (url.searchParams.get('mode') !== 'active_manifests') {
    return json({ error: 'Unsupported mode' }, 400);
  }

  const code = (
    resolveCanonicalLocationCode(url.searchParams.get('location') || 'MD') || 'MD'
  ).toUpperCase();

  try {
    const res = await appwrite.withDb((db) =>
      db.listDocuments(appwrite.dbId, MANIFESTS_COL_ID, [
        NodeQuery.equal('status', OPEN_STATUSES),
        NodeQuery.orderDesc('$id'),
        NodeQuery.limit(50),
      ])
    );

    const manifests = [];
    for (const doc of res.documents as any[]) {
      const snapshot = parseList<any>(doc.itemsSnapshot);
      let itemIds = parseList<string>(doc.itemIds);
      if (!itemIds.length && snapshot.length) {
        itemIds = snapshot.map((s: any) => s?.$id || s?.id).filter(Boolean);
      }
      if (!itemIds.length || !manifestMatchesLocation(doc, code)) continue;

      const items = await fetchItems(appwrite, itemIds, snapshot);
      const snapById = new Map<string, any>();
      for (const s of snapshot) {
        const sid = s?.$id || s?.id;
        if (sid) snapById.set(String(sid), s);
      }
      manifests.push({
        manifestId: doc.$id,
        name: doc.name,
        status: doc.status,
        items: items.map((it: any) => {
          const itemId = it.$id || it.id;
          const snap = snapById.get(String(itemId));
          return {
            itemId,
            title: it.title || snap?.title || 'Untitled Item',
            price: parseItemPrice(it, snap),
            upc: it.upc || snap?.upc || '',
            locationSku: it.locationSku || snap?.locationSku || '',
            quantity: Number(it.quantity ?? snap?.quantity ?? 1) || 1,
            bound: !!(it.locationSku || snap?.locationSku),
          };
        }),
      });
    }
    return json({ location: code, manifests });
  } catch (err: any) {
    return json({ error: err?.message || 'Failed to load manifests' }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  const appwrite = getAppwriteClients();

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  if (body?.mode !== 'bind_skus') return json({ error: 'Unsupported mode' }, 400);

  const manifestId = String(body.manifestId || '');
  const mappings: Array<{ itemId: string; locationSku: string }> = Array.isArray(body.mappings)
    ? body.mappings
    : [];
  if (!manifestId || !mappings.length) {
    return json({ error: 'manifestId and mappings required' }, 400);
  }

  try {
    const manifest: any = await appwrite.withDb((db) =>
      db.getDocument(appwrite.dbId, MANIFESTS_COL_ID, manifestId)
    );
    const code = (
      resolveCanonicalLocationCode(String(body.location || 'MD')) || 'MD'
    ).toUpperCase();
    if (!manifestMatchesLocation(manifest, code)) {
      return json({ error: 'Manifest does not belong to this location' }, 400);
    }

    const snapshot = parseList<any>(manifest.itemsSnapshot);
    let manifestItemIds = parseList<string>(manifest.itemIds);
    if (!manifestItemIds.length && snapshot.length) {
      manifestItemIds = snapshot.map((s: any) => s?.$id || s?.id).filter(Boolean);
    }

    const bound: string[] = [];
    const rejected: Array<{ itemId: string; reason: string }> = [];

    for (const m of mappings) {
      const itemId = String(m?.itemId || '');
      const sku = cleanSku(m?.locationSku);
      if (!itemId || !sku || !manifestItemIds.includes(itemId)) {
        rejected.push({ itemId, reason: 'Invalid item or SKU' });
        continue;
      }
      // 1-to-1 SKU <-> item bijection guard
      const clash = await appwrite.withDb((db) =>
        db.listDocuments(appwrite.dbId, appwrite.itemsCol, [
          NodeQuery.equal('locationSku', sku),
          NodeQuery.limit(2),
        ])
      );
      if (clash.documents.some((d: any) => d.$id !== itemId)) {
        rejected.push({ itemId, reason: `${sku} already bound to another item` });
        continue;
      }
      await appwrite.withDb((db) =>
        db.updateDocument(appwrite.dbId, appwrite.itemsCol, itemId, {
          locationSku: sku,
          storageLocation: code,
        })
      );
      bound.push(itemId);
      (m as any).locationSku = sku;
    }

    const skuById = new Map(
      mappings.filter((m) => bound.includes(m.itemId)).map((m) => [m.itemId, m.locationSku])
    );
    const nextSnapshot = snapshot.map((s) => {
      const id = s.$id || s.id;
      return skuById.has(id) ? { ...s, locationSku: skuById.get(id) } : s;
    });
    const placed = Array.from(new Set([...parseList<string>(manifest.placedItemIds), ...bound]));
    const allBound = manifestItemIds.every((id) => placed.includes(id));

    const update: Record<string, unknown> = {
      itemsSnapshot: Array.isArray(manifest.itemsSnapshot)
        ? nextSnapshot
        : JSON.stringify(nextSnapshot),
      placedItemIds: Array.isArray(manifest.placedItemIds) ? placed : JSON.stringify(placed),
    };
    if (allBound) {
      update.status = 'placed';
      update.placedAt = new Date().toISOString();
    }
    await appwrite.withDb((db) =>
      db.updateDocument(appwrite.dbId, MANIFESTS_COL_ID, manifestId, update)
    );

    return json({ ok: true, bound: bound.length, rejected, manifestPlaced: allBound });
  } catch (err: any) {
    return json({ error: err?.message || 'bind_skus failed' }, 500);
  }
};
