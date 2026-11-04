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

function getDb() {
  const endpoint = import.meta.env?.PUBLIC_APPWRITE_ENDPOINT || process.env.PUBLIC_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1';
  const project = import.meta.env?.PUBLIC_APPWRITE_PROJECT_ID || process.env.PUBLIC_APPWRITE_PROJECT_ID || '';
  const apiKey = import.meta.env?.APPWRITE_API_KEY || process.env.APPWRITE_API_KEY || '';
  const dbId = import.meta.env?.PUBLIC_APPWRITE_DB_ID || process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
  const itemsCol = import.meta.env?.PUBLIC_APPWRITE_ITEMS_COLLECTION_ID || process.env.PUBLIC_APPWRITE_ITEMS_COLLECTION_ID || 'items';
  if (!project || !apiKey) return null;
  const client = new NodeClient().setEndpoint(endpoint).setProject(project).setKey(apiKey);
  return { databases: new NodeDatabases(client), dbId, itemsCol };
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

const cleanSku = (v: unknown) => String(v ?? '').trim().replace(/^['"]+|['"]+$/g, '').toUpperCase();

function manifestMatchesLocation(doc: any, code: string): boolean {
  const meta: any = getLocationSettingMeta(code);
  const ids = [meta?.$id, meta?.id, meta?.docId].filter(Boolean);
  if (doc.locationId && ids.includes(doc.locationId)) return true;
  const names = [meta?.name, meta?.fullName].filter(Boolean);
  return !!doc.locationName && names.includes(doc.locationName);
}

async function fetchItems(db: NonNullable<ReturnType<typeof getDb>>, ids: string[]) {
  const out: any[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const res = await db.databases.listDocuments(db.dbId, db.itemsCol, [
      NodeQuery.equal('$id', ids.slice(i, i + CHUNK)),
      NodeQuery.limit(CHUNK),
    ]);
    out.push(...res.documents);
  }
  return out;
}

export const OPTIONS: APIRoute = async () => new Response(null, { status: 204, headers: CORS_HEADERS });

export const GET: APIRoute = async ({ url }) => {
  const db = getDb();
  if (!db) return json({ error: 'Appwrite server credentials missing' }, 500);
  if (url.searchParams.get('mode') !== 'active_manifests') return json({ error: 'Unsupported mode' }, 400);

  const code = (resolveCanonicalLocationCode(url.searchParams.get('location') || '') || '').toUpperCase();
  if (!code) return json({ error: 'Unknown location' }, 400);

  try {
    const res = await db.databases.listDocuments(db.dbId, MANIFESTS_COL_ID, [
      NodeQuery.equal('status', OPEN_STATUSES),
      NodeQuery.orderDesc('$id'),
      NodeQuery.limit(50),
    ]);
    const manifests = [];
    for (const doc of res.documents as any[]) {
      const itemIds = parseList<string>(doc.itemIds);
      if (!itemIds.length || !manifestMatchesLocation(doc, code)) continue;
      const items = await fetchItems(db, itemIds);
      manifests.push({
        manifestId: doc.$id,
        name: doc.name,
        status: doc.status,
        items: items.map((it: any) => ({
          itemId: it.$id,
          title: it.title,
          price: it.resalePrice ?? it.price ?? 0,
          upc: it.upc || '',
          locationSku: it.locationSku || '',
          quantity: it.quantity ?? 1,
          bound: !!it.locationSku,
        })),
      });
    }
    return json({ location: code, manifests });
  } catch (err: any) {
    return json({ error: err?.message || 'Failed to load manifests' }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  const db = getDb();
  if (!db) return json({ error: 'Appwrite server credentials missing' }, 500);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  if (body?.mode !== 'bind_skus') return json({ error: 'Unsupported mode' }, 400);

  const manifestId = String(body.manifestId || '');
  const mappings: Array<{ itemId: string; locationSku: string }> = Array.isArray(body.mappings) ? body.mappings : [];
  if (!manifestId || !mappings.length) return json({ error: 'manifestId and mappings required' }, 400);

  try {
    const manifest: any = await db.databases.getDocument(db.dbId, MANIFESTS_COL_ID, manifestId);
    const code = (resolveCanonicalLocationCode(String(body.location || '')) || '').toUpperCase();
    if (!code || !manifestMatchesLocation(manifest, code)) {
      return json({ error: 'Manifest does not belong to this location' }, 400);
    }
    const manifestItemIds = parseList<string>(manifest.itemIds);
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
      const clash = await db.databases.listDocuments(db.dbId, db.itemsCol, [
        NodeQuery.equal('locationSku', sku),
        NodeQuery.limit(2),
      ]);
      if (clash.documents.some((d: any) => d.$id !== itemId)) {
        rejected.push({ itemId, reason: `${sku} already bound to another item` });
        continue;
      }
      await db.databases.updateDocument(db.dbId, db.itemsCol, itemId, {
        locationSku: sku,
        storageLocation: code,
      });
      bound.push(itemId);
      (m as any).locationSku = sku;
    }

    // Update manifest snapshot + placed ids (preserve stored shape: array vs JSON string)
    const snapshot = parseList<any>(manifest.itemsSnapshot);
    const skuById = new Map(mappings.filter((m) => bound.includes(m.itemId)).map((m) => [m.itemId, m.locationSku]));
    const nextSnapshot = snapshot.map((s) => {
      const id = s.$id || s.id;
      return skuById.has(id) ? { ...s, locationSku: skuById.get(id) } : s;
    });
    const placed = Array.from(new Set([...parseList<string>(manifest.placedItemIds), ...bound]));
    const allBound = manifestItemIds.every((id) => placed.includes(id));

    const update: Record<string, unknown> = {
      itemsSnapshot: Array.isArray(manifest.itemsSnapshot) ? nextSnapshot : JSON.stringify(nextSnapshot),
      placedItemIds: Array.isArray(manifest.placedItemIds) ? placed : JSON.stringify(placed),
    };
    if (allBound) {
      update.status = 'placed';
      update.placedAt = new Date().toISOString();
    }
    await db.databases.updateDocument(db.dbId, MANIFESTS_COL_ID, manifestId, update);

    return json({ ok: true, bound: bound.length, rejected, manifestPlaced: allBound });
  } catch (err: any) {
    return json({ error: err?.message || 'bind_skus failed' }, 500);
  }
};

