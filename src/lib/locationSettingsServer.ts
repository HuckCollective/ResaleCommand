import { Client, Databases, Query } from 'node-appwrite';

/**
 * Server-side loader for live Location Settings stored in the Appwrite `warehouses` collection
 * (canonical `resale_db.warehouses` docs for MD / DT / HG / HH — commissionRate, monthlyRent, usesRicochet, ...).
 *
 * The returned docs are passed as the `liveWarehouses` argument of `getLocationSettingMeta()` /
 * `resolveRicochetLocation()` so fee and rent resolve from the Appwrite document, not from static code.
 * Short in-memory cache (60s) avoids a DB round-trip per request. Read-only: never writes.
 */
const CACHE_TTL_MS = 60_000;

export async function loadLiveWarehouseDocs(): Promise<any[]> {
  const g = globalThis as any;
  const cached = g.__RC_LIVE_WAREHOUSE_DOCS__;
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.docs;

  const endpoint =
    (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_APPWRITE_ENDPOINT) ||
    process.env.PUBLIC_APPWRITE_ENDPOINT ||
    'https://sfo.cloud.appwrite.io/v1';
  const project =
    (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_APPWRITE_PROJECT_ID) ||
    process.env.PUBLIC_APPWRITE_PROJECT_ID ||
    '69714b35003a8adab6bb';
  const apiKey =
    (typeof import.meta !== 'undefined' && import.meta.env?.APPWRITE_API_KEY) ||
    process.env.APPWRITE_API_KEY ||
    '';
  const dbId =
    (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_APPWRITE_DB_ID) ||
    process.env.PUBLIC_APPWRITE_DB_ID ||
    'resale_db';

  let docs: any[] = [];
  try {
    const client = new Client().setEndpoint(endpoint).setProject(project);
    if (apiKey) client.setKey(apiKey);
    const databases = new Databases(client);
    const res = await databases.listDocuments(dbId, 'warehouses', [Query.limit(100)]);
    docs = res.documents || [];
  } catch {
    docs = [];
  }
  g.__RC_LIVE_WAREHOUSE_DOCS__ = { at: Date.now(), docs };
  return docs;
}

