/**
 * Server-only Appwrite persistence & zero-PII bundle builder for the Flagship & Events CMS
 * (`manifests/public_flagship_cms_v1`).
 */
import { getCollection } from 'astro:content';
import { Client, Databases, Permission, Role } from 'node-appwrite';
import { getDatabaseId, getEnvVar } from './appwriteEnv';
import {
  COOP_GOVERNANCE_DOC_ID,
  DEFAULT_COOP_POLICY_CONFIG,
  normalizePolicyConfig,
} from './coopGovernance';
import { CoopHttpError, type CoopServerContext } from './coopLedgerServer';
import {
  DEFAULT_FLAGSHIP_CMS_CONTENT,
  PUBLIC_FLAGSHIP_CMS_DOC_ID,
  normalizeFlagshipCmsContent,
  type FlagshipCmsContent,
  type PublicFlagshipApiBundle,
  type PublicRoleSummaryCard,
} from './flagshipContent';

const MANIFESTS_COL_ID = 'manifests';
const MAX_SNAPSHOT_CHARS = 60_000;

function createOptionalReadonlyDatabases(): { databases: Databases; dbId: string } | null {
  const endpoint = getEnvVar('PUBLIC_APPWRITE_ENDPOINT');
  const project = getEnvVar('PUBLIC_APPWRITE_PROJECT_ID');
  const apiKey = getEnvVar('APPWRITE_API_KEY');
  if (!endpoint || !project) return null;

  const client = new Client().setEndpoint(endpoint).setProject(project);
  if (apiKey) {
    client.setKey(apiKey);
  }
  return {
    databases: new Databases(client),
    dbId: getDatabaseId(),
  };
}

export async function readFlagshipCmsOnServer(
  databases?: Databases,
  dbId?: string
): Promise<{ content: FlagshipCmsContent; exists: boolean }> {
  const resolved = databases && dbId ? { databases, dbId } : createOptionalReadonlyDatabases();
  if (!resolved) {
    return {
      content: normalizeFlagshipCmsContent(DEFAULT_FLAGSHIP_CMS_CONTENT),
      exists: false,
    };
  }

  try {
    const doc: any = await resolved.databases.getDocument(
      resolved.dbId,
      MANIFESTS_COL_ID,
      PUBLIC_FLAGSHIP_CMS_DOC_ID
    );
    let parsed: any = {};
    if (typeof doc.itemsSnapshot === 'string' && doc.itemsSnapshot.trim().startsWith('{')) {
      parsed = JSON.parse(doc.itemsSnapshot);
    }
    return {
      content: normalizeFlagshipCmsContent(parsed),
      exists: true,
    };
  } catch (err: any) {
    if (err?.code === 404) {
      return {
        content: normalizeFlagshipCmsContent(DEFAULT_FLAGSHIP_CMS_CONTENT),
        exists: false,
      };
    }
    console.warn('[flagshipContentServer] Falling back to default CMS content:', err?.message || err);
    return {
      content: normalizeFlagshipCmsContent(DEFAULT_FLAGSHIP_CMS_CONTENT),
      exists: false,
    };
  }
}

export async function writeFlagshipCmsOnServer(
  ctx: CoopServerContext,
  rawInput: unknown,
  tenantId = 'huck_collective'
): Promise<FlagshipCmsContent> {
  const rawStr = JSON.stringify(rawInput ?? {});
  if (/data:[a-z0-9+/=-]+;base64,/i.test(rawStr)) {
    throw new CoopHttpError(
      400,
      "Embedded image data isn't supported here — please use an https:// link.",
      'BASE64_FORBIDDEN'
    );
  }

  const normalized = normalizeFlagshipCmsContent({
    ...(typeof rawInput === 'object' && rawInput !== null ? rawInput : {}),
    updatedAt: new Date().toISOString(),
  });

  const serialized = JSON.stringify(normalized);
  if (serialized.length > MAX_SNAPSHOT_CHARS) {
    throw new CoopHttpError(
      413,
      'This page has too much text to save at once — please trim a few items and try again.',
      'PAYLOAD_TOO_LARGE'
    );
  }

  // Exact `manifests` collection schema attributes (Law 4 — zero unknown attributes)
  const docPayload = {
    name: 'Public Flagship & Multi-Channel Events CMS',
    tenantId: tenantId || 'huck_collective',
    locationId: 'PUBLIC_FLAGSHIP_CMS',
    locationName: 'TheHC Flagship & Events CMS',
    status: 'cms_published',
    itemsSnapshot: serialized,
    itemCount: normalized.events.length,
    notes: JSON.stringify({
      version: normalized.version,
      eventCount: normalized.events.length,
      channelCount: normalized.channels.length,
      updatedAt: normalized.updatedAt,
    }).slice(0, 4900),
  };

  // Public read ONLY — never grant Role.any() update/delete (§1C-B); pass permissions on update too to strip legacy perms.
  const publicReadOnlyPermissions = [Permission.read(Role.any())];

  try {
    await ctx.databases.updateDocument(
      ctx.dbId,
      MANIFESTS_COL_ID,
      PUBLIC_FLAGSHIP_CMS_DOC_ID,
      docPayload,
      publicReadOnlyPermissions
    );
  } catch (updateErr: any) {
    if (updateErr?.code === 404) {
      await ctx.databases.createDocument(
        ctx.dbId,
        MANIFESTS_COL_ID,
        PUBLIC_FLAGSHIP_CMS_DOC_ID,
        docPayload,
        publicReadOnlyPermissions
      );
    } else {
      throw updateErr;
    }
  }

  return normalized;
}

async function loadPublicRoleSummaryCards(): Promise<PublicRoleSummaryCard[]> {
  try {
    const rawRoles = await getCollection('roleHelp');
    return [...rawRoles]
      .filter((entry) => entry.data.showInJoinGrid)
      .sort((a, b) => a.data.order - b.data.order)
      .map((entry) => ({
        id: String(entry.data.hatId),
        icon: String(entry.data.icon),
        title: String(entry.data.title),
        pitch: String(entry.data.pitch),
        tags: Array.isArray(entry.data.tags) ? entry.data.tags.map(String) : [],
      }));
  } catch {
    return [];
  }
}

async function loadPublicPolicySplit(
  databases?: Databases,
  dbId?: string
): Promise<{ curatorSharePct: number; commonsSharePct: number }> {
  const resolved = databases && dbId ? { databases, dbId } : createOptionalReadonlyDatabases();
  if (!resolved) {
    return {
      curatorSharePct: DEFAULT_COOP_POLICY_CONFIG.curatorSharePct,
      commonsSharePct: DEFAULT_COOP_POLICY_CONFIG.commonsSharePct,
    };
  }

  try {
    const doc: any = await resolved.databases.getDocument(
      resolved.dbId,
      MANIFESTS_COL_ID,
      COOP_GOVERNANCE_DOC_ID
    );
    if (typeof doc.itemsSnapshot === 'string' && doc.itemsSnapshot.trim().startsWith('{')) {
      const parsed = JSON.parse(doc.itemsSnapshot);
      const policy = normalizePolicyConfig(parsed.policyConfig);
      return {
        curatorSharePct: policy.curatorSharePct,
        commonsSharePct: policy.commonsSharePct,
      };
    }
  } catch {
    // Graceful fallback to Charter 70/30 defaults
  }

  return {
    curatorSharePct: DEFAULT_COOP_POLICY_CONFIG.curatorSharePct,
    commonsSharePct: DEFAULT_COOP_POLICY_CONFIG.commonsSharePct,
  };
}

/**
 * Builds the strictly sanitized, zero-PII public JSON payload consumed by `thehc.llc`
 * and `RecordSaleDrawer.vue` event chips.
 */
export async function loadPublicFlagshipBundle(): Promise<PublicFlagshipApiBundle> {
  const resolved = createOptionalReadonlyDatabases();
  const [{ content, exists }, policySplit, roles] = await Promise.all([
    readFlagshipCmsOnServer(resolved?.databases, resolved?.dbId),
    loadPublicPolicySplit(resolved?.databases, resolved?.dbId),
    loadPublicRoleSummaryCards(),
  ]);

  return {
    version: 1,
    source: exists ? 'live_cms' : 'default_fallback',
    updatedAt: content.updatedAt || '',
    policySplit,
    worksSpotlight: content.worksSpotlight,
    channels: content.channels.filter((c) => c.active),
    events: content.events,
    roles,
  };
}
