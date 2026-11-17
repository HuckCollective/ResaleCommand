import type { APIRoute } from 'astro';
import { Permission, Role } from 'node-appwrite';
import { pacificTodayYmd } from '../../../lib/coopGovernance';
import {
  CoopHttpError,
  errorResponse,
  getCoopServerContext,
  jsonResponse,
  requireCoopMember,
  type CoopServerContext,
} from '../../../lib/coopLedgerServer';
import {
  SOCIAL_TRACKER_DOC_ID,
  normalizeSocialCampaign,
  normalizeSocialTrackerSnapshot,
  pruneStaleSocialCampaigns,
  type SocialTrackerSnapshot,
} from '../../../lib/socialTracker';

export const prerender = false;

const MANIFESTS_COL_ID = 'manifests';
const MAX_SNAPSHOT_CHARS = 60_000;

async function readTrackerDoc(ctx: CoopServerContext): Promise<{
  snapshot: SocialTrackerSnapshot;
  exists: boolean;
}> {
  try {
    const doc: any = await ctx.databases.getDocument(
      ctx.dbId,
      MANIFESTS_COL_ID,
      SOCIAL_TRACKER_DOC_ID
    );
    let parsed: any = {};
    if (typeof doc.itemsSnapshot === 'string' && doc.itemsSnapshot.trim().startsWith('{')) {
      parsed = JSON.parse(doc.itemsSnapshot);
    }
    return {
      snapshot: normalizeSocialTrackerSnapshot(parsed),
      exists: true,
    };
  } catch (err: any) {
    if (err?.code === 404) {
      return {
        snapshot: { version: 1, campaigns: [], updatedAt: '' },
        exists: false,
      };
    }
    throw err;
  }
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const ctx = getCoopServerContext();
    await requireCoopMember(request, ctx);
    const { snapshot } = await readTrackerDoc(ctx);
    return jsonResponse({
      ok: true,
      version: snapshot.version,
      updatedAt: snapshot.updatedAt,
      campaigns: snapshot.campaigns,
    });
  } catch (err) {
    return errorResponse(err);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const ctx = getCoopServerContext();
    const caller = await requireCoopMember(request, ctx);

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const rawBodyStr = JSON.stringify(body ?? {});
    if (/data:[a-z0-9+/=-]+;base64,/i.test(rawBodyStr)) {
      throw new CoopHttpError(
        400,
        "Embedded image data isn't supported here — please use https:// post links.",
        'BASE64_FORBIDDEN'
      );
    }

    const { snapshot: current, exists } = await readTrackerDoc(ctx);
    const expectedVersion =
      body?.expectedVersion !== undefined ? Number(body.expectedVersion) : undefined;

    if (
      exists &&
      expectedVersion !== undefined &&
      Number.isFinite(expectedVersion) &&
      expectedVersion !== current.version
    ) {
      throw new CoopHttpError(
        409,
        'Another member updated the Social Tracker — refresh to load the latest links.',
        'VERSION_CONFLICT'
      );
    }

    const action = String(body?.action || 'upsert_campaign');
    const nowIso = new Date().toISOString();
    let nextCampaigns = [...current.campaigns];

    if (action === 'delete_campaign') {
      const targetId = String(body?.id || '').trim();
      nextCampaigns = nextCampaigns.filter((c) => c.id !== targetId);
    } else {
      const incoming = normalizeSocialCampaign(
        {
          ...(body?.campaign || {}),
          updatedAt: nowIso,
        },
        nextCampaigns.length
      );
      // Stamp caller name on newly posted channels missing postedBy
      for (const key of Object.keys(incoming.posts) as Array<keyof typeof incoming.posts>) {
        const p = incoming.posts[key];
        if (p.status === 'posted' && !p.postedBy) {
          p.postedBy = caller.linkedMemberName || caller.name;
        }
        if (p.status === 'posted' && !p.postedAt) {
          p.postedAt = pacificTodayYmd();
        }
      }

      const idx = nextCampaigns.findIndex((c) => c.id === incoming.id);
      if (idx >= 0) {
        incoming.createdAt = nextCampaigns[idx].createdAt || incoming.createdAt;
        nextCampaigns.splice(idx, 1, incoming);
      } else {
        incoming.createdAt = nowIso;
        nextCampaigns.unshift(incoming);
      }
    }

    const pruned = pruneStaleSocialCampaigns(nextCampaigns, pacificTodayYmd(), 90);
    const nextSnapshot: SocialTrackerSnapshot = {
      version: exists ? current.version + 1 : 1,
      campaigns: pruned,
      updatedAt: nowIso,
    };

    const serialized = JSON.stringify(nextSnapshot);
    if (serialized.length > MAX_SNAPSHOT_CHARS) {
      throw new CoopHttpError(
        413,
        'Too many active campaigns in the tracker — archive older rows and try again.',
        'PAYLOAD_TOO_LARGE'
      );
    }

    const docPayload = {
      name: 'Collective Social Cross-Post & Promo Link Tracker',
      tenantId: 'huck_collective',
      locationId: 'COOP_SOCIAL_TRACKER',
      locationName: 'Collective Social Tracker',
      status: 'social_tracker',
      itemsSnapshot: serialized,
      itemCount: nextSnapshot.campaigns.length,
      notes: JSON.stringify({
        version: nextSnapshot.version,
        campaignCount: nextSnapshot.campaigns.length,
        updatedAt: nextSnapshot.updatedAt,
      }).slice(0, 4900),
    };

    const teamReadPermissions = [Permission.read(Role.team(ctx.coopTeamId))];

    if (exists) {
      await ctx.databases.updateDocument(
        ctx.dbId,
        MANIFESTS_COL_ID,
        SOCIAL_TRACKER_DOC_ID,
        docPayload,
        teamReadPermissions
      );
    } else {
      await ctx.databases.createDocument(
        ctx.dbId,
        MANIFESTS_COL_ID,
        SOCIAL_TRACKER_DOC_ID,
        docPayload,
        teamReadPermissions
      );
    }

    return jsonResponse({
      ok: true,
      version: nextSnapshot.version,
      updatedAt: nextSnapshot.updatedAt,
      campaigns: nextSnapshot.campaigns,
    });
  } catch (err) {
    return errorResponse(err);
  }
};
