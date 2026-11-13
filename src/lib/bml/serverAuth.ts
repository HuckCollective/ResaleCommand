import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Account, Client, Databases, Teams } from 'node-appwrite';
import { getEnvVar } from '../appwriteEnv';
import { SYNC_FALLBACK_ORIGINS } from '../../site-config';

export type BookmarkletAllowedRole = 'founder' | 'curator';

export interface BookmarkletMemberSession {
  userId: string;
  teamId: string;
  name: string;
  email: string;
  prefix: string;
  role: BookmarkletAllowedRole;
  roleBadge: string;
  iat: number;
  exp: number;
}

const TOKEN_PREFIX = 'rcbml_v1';
const DEFAULT_TTL_SECONDS = 14 * 24 * 60 * 60; // 14 days

export const BML_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Appwrite-JWT, X-RC-BML-Token',
  'Content-Type': 'application/json',
};

function getSigningSecret(): string {
  const explicit = getEnvVar('BML_TOKEN_SECRET') || getEnvVar('JOIN_LINK_SECRET');
  if (explicit) return explicit;
  const apiKey = getEnvVar('APPWRITE_API_KEY');
  const project = getEnvVar('PUBLIC_APPWRITE_PROJECT_ID') || '69714b35003a8adab6bb';
  return createHash('sha256')
    .update(`rc-bml-secret:${apiKey || project}`)
    .digest('hex');
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function signPayloadSegment(encodedSegment: string): string {
  return createHmac('sha256', getSigningSecret())
    .update(`${TOKEN_PREFIX}.${encodedSegment}`)
    .digest('base64url');
}

export function formatRoleBadge(role: BookmarkletAllowedRole): string {
  return role === 'founder' ? '👑 Founder' : '💎 Curator';
}

export function mintBookmarkletToken(
  member: Omit<BookmarkletMemberSession, 'iat' | 'exp' | 'roleBadge'> & { roleBadge?: string },
  ttlSeconds = DEFAULT_TTL_SECONDS
): { token: string; session: BookmarkletMemberSession } {
  const nowSec = Math.floor(Date.now() / 1000);
  const role: BookmarkletAllowedRole = member.role === 'curator' ? 'curator' : 'founder';
  const session: BookmarkletMemberSession = {
    userId: member.userId,
    teamId: member.teamId || 'huck_collective',
    name: member.name || 'Member',
    email: member.email || '',
    prefix: (member.prefix || 'HUCK-').toUpperCase(),
    role,
    roleBadge: member.roleBadge || formatRoleBadge(role),
    iat: nowSec,
    exp: nowSec + ttlSeconds,
  };
  const encoded = base64UrlEncode(JSON.stringify(session));
  const sig = signPayloadSegment(encoded);
  return {
    token: `${TOKEN_PREFIX}.${encoded}.${sig}`,
    session,
  };
}

export function verifyBookmarkletToken(rawToken?: string | null): BookmarkletMemberSession | null {
  if (!rawToken || typeof rawToken !== 'string') return null;
  const clean = rawToken.replace(/^Bearer\s+/i, '').trim();
  const parts = clean.split('.');
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return null;

  const [, encoded, givenSig] = parts;
  if (!encoded || !givenSig) return null;

  const expectedSig = signPayloadSegment(encoded);
  try {
    const a = Buffer.from(givenSig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const parsed = JSON.parse(base64UrlDecode(encoded)) as Partial<BookmarkletMemberSession>;
    const nowSec = Math.floor(Date.now() / 1000);
    if (!parsed?.userId || !parsed?.exp || parsed.exp < nowSec) return null;

    const prefix = String(parsed.prefix || 'HUCK-').toUpperCase();
    // Consignor prefixes (BB-) are never allowed to use Curator/Founder bookmarklet tools
    if (prefix.startsWith('BB')) return null;

    const role: BookmarkletAllowedRole =
      parsed.role === 'curator'
        ? 'curator'
        : parsed.role === 'founder'
          ? 'founder'
          : prefix.startsWith('PDXGL')
            ? 'curator'
            : 'founder';

    return {
      userId: parsed.userId,
      teamId: parsed.teamId || 'huck_collective',
      name: parsed.name || 'Member',
      email: parsed.email || '',
      prefix,
      role,
      roleBadge: parsed.roleBadge || formatRoleBadge(role),
      iat: parsed.iat || nowSec,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

async function resolveCoopRosterMemberRole(
  userName: string,
  userEmail: string,
  prefix: string,
  isTeamOwnerOrAdmin: boolean
): Promise<BookmarkletAllowedRole | 'restricted'> {
  if (prefix.toUpperCase().startsWith('BB')) {
    return 'restricted';
  }

  const endpoint = getEnvVar('PUBLIC_APPWRITE_ENDPOINT') || 'https://sfo.cloud.appwrite.io/v1';
  const project = getEnvVar('PUBLIC_APPWRITE_PROJECT_ID') || '69714b35003a8adab6bb';
  const apiKey = getEnvVar('APPWRITE_API_KEY') || '';
  const dbId = getEnvVar('PUBLIC_APPWRITE_DB_ID') || 'resale_db';

  const cleanName = (s: string) =>
    String(s || '')
      .replace(/\(.*?\)/g, '')
      .trim()
      .toLowerCase();

  const uName = cleanName(userName);
  const uEmail = String(userEmail || '').trim().toLowerCase();

  try {
    const client = new Client().setEndpoint(endpoint).setProject(project);
    if (apiKey) client.setKey(apiKey);
    const db = new Databases(client);
    const doc: any = await db.getDocument(dbId, 'manifests', 'coop_governance_proposals_v1');
    const raw = doc?.itemsSnapshot || doc?.notes_raw;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const members: any[] = Array.isArray(parsed?.policyConfig?.members) ? parsed.policyConfig.members : [];

    for (const m of members) {
      const mName = cleanName(m?.name || '');
      const firstWordMatch =
        uName && mName && uName.split(/\s+/)[0].length >= 3 && uName.split(/\s+/)[0] === mName.split(/\s+/)[0];
      if ((uName && mName && (uName === mName || firstWordMatch)) || (uEmail && mName && uEmail.startsWith(mName))) {
        const hats: string[] = Array.isArray(m.hats) ? m.hats : [];
        if (hats.includes('founder') || m.role === 'Co-op Member') return 'founder';
        if (hats.includes('curator') || m.role === 'Partner Curator') return 'curator';
        if (
          m.partner === 'SWEAT' ||
          m.partner === 'BB' ||
          m.role === 'Marketing & Social Enabler' ||
          m.role === 'Consignor'
        ) {
          return isTeamOwnerOrAdmin ? 'founder' : 'restricted';
        }
      }
    }
  } catch {
    // Fall back to team/label role resolution below
  }

  if (isTeamOwnerOrAdmin) return 'founder';
  if (prefix.toUpperCase().startsWith('PDXGL') || prefix.toUpperCase().startsWith('HUCK')) {
    return 'curator';
  }
  return 'restricted';
}

export async function verifyAppwriteJwtToMember(
  jwt: string
): Promise<
  | { ok: true; member: BookmarkletMemberSession }
  | { ok: false; status: 401 | 403; error: string; message: string }
> {
  if (!jwt) {
    return {
      ok: false,
      status: 401,
      error: 'missing_jwt',
      message: 'Sign in to Works@TheHC to connect this bookmarklet.',
    };
  }
  const endpoint = getEnvVar('PUBLIC_APPWRITE_ENDPOINT') || 'https://sfo.cloud.appwrite.io/v1';
  const project = getEnvVar('PUBLIC_APPWRITE_PROJECT_ID') || '69714b35003a8adab6bb';

  try {
    const userClient = new Client().setEndpoint(endpoint).setProject(project).setJWT(jwt);
    const account = new Account(userClient);
    const teamsApi = new Teams(userClient);

    const me = await account.get();
    const labels = Array.isArray(me.labels) ? me.labels.map((l) => String(l).toLowerCase()) : [];
    const userPrefs = (me.prefs || {}) as Record<string, any>;

    // Explicit restriction check on user labels/prefs
    if (
      labels.includes('consignor') ||
      labels.includes('sweat_only') ||
      userPrefs.role === 'consignor' ||
      userPrefs.role === 'sweat_only'
    ) {
      return {
        ok: false,
        status: 403,
        error: 'role_restricted',
        message:
          '🔒 Founder or Curator Hat Required: Bookmarklet tools are currently restricted to Collective Founders (👑) and Curators (💎).',
      };
    }

    const teamList = await teamsApi.list().catch(() => ({ teams: [] as any[] }));
    const primaryTeam = teamList.teams?.[0];
    const teamId = primaryTeam?.$id || me.$id;
    const rawPrefix = primaryTeam?.prefs?.upcPrefix || userPrefs.upcPrefix || 'HUCK-';
    const cleanPrefix = String(rawPrefix).trim().toUpperCase();
    const prefix = cleanPrefix.endsWith('-') ? cleanPrefix : `${cleanPrefix}-`;

    let isTeamOwnerOrAdmin = labels.includes('admin') || labels.includes('founder') || userPrefs.role === 'founder';
    if (!isTeamOwnerOrAdmin && primaryTeam?.$id) {
      try {
        const memberships = await teamsApi.listMemberships(primaryTeam.$id);
        const myMembership = memberships.memberships?.find((m: any) => m.userId === me.$id);
        if (myMembership?.roles?.some((r: string) => ['owner', 'founder', 'admin'].includes(r.toLowerCase()))) {
          isTeamOwnerOrAdmin = true;
        }
      } catch {}
    }

    const resolvedRole = await resolveCoopRosterMemberRole(
      me.name || '',
      me.email || '',
      prefix,
      isTeamOwnerOrAdmin
    );

    if (resolvedRole === 'restricted') {
      return {
        ok: false,
        status: 403,
        error: 'role_restricted',
        message:
          '🔒 Founder or Curator Hat Required: Bookmarklet tools are currently restricted to Collective Founders (👑) and Curators (💎).',
      };
    }

    const nowSec = Math.floor(Date.now() / 1000);
    return {
      ok: true,
      member: {
        userId: me.$id,
        teamId,
        name: me.name || me.email || 'Member',
        email: me.email || '',
        prefix,
        role: resolvedRole,
        roleBadge: formatRoleBadge(resolvedRole),
        iat: nowSec,
        exp: nowSec + DEFAULT_TTL_SECONDS,
      },
    };
  } catch {
    return {
      ok: false,
      status: 401,
      error: 'invalid_session',
      message: 'Your Works@TheHC session expired. Please sign in again.',
    };
  }
}

function hasSameOriginSessionCookie(request: Request): boolean {
  const cookieHeader = request.headers.get('cookie') || '';
  const hasIndicator = /(?:^|;\s*)(?:auth_session_indicator=true\b|a_session_)/i.test(cookieHeader);
  if (!hasIndicator) return false;

  const secFetchSite = (request.headers.get('sec-fetch-site') || '').toLowerCase();
  if (secFetchSite === 'cross-site') {
    return false;
  }
  if (secFetchSite === 'same-origin' || secFetchSite === 'same-site') {
    return true;
  }

  const reqHost = new URL(request.url).host;
  const origin = request.headers.get('origin') || request.headers.get('referer') || '';
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    if (originHost === reqHost) return true;
    return SYNC_FALLBACK_ORIGINS.some((o) => new URL(o).host === originHost);
  } catch {
    return false;
  }
}

export async function requireBookmarkletMember(
  request: Request
): Promise<{ ok: true; member: BookmarkletMemberSession } | { ok: false; response: Response }> {
  const url = new URL(request.url);
  const bearerHeader =
    request.headers.get('Authorization') ||
    request.headers.get('X-RC-BML-Token') ||
    url.searchParams.get('bmlToken') ||
    '';

  if (bearerHeader) {
    const verified = verifyBookmarkletToken(bearerHeader);
    if (verified) {
      return { ok: true, member: verified };
    }
  }

  const jwtHeader = request.headers.get('X-Appwrite-JWT') || '';
  if (jwtHeader) {
    const verifiedJwt = await verifyAppwriteJwtToMember(jwtHeader);
    if (verifiedJwt.ok) {
      return { ok: true, member: verifiedJwt.member };
    }
    if (verifiedJwt.status === 403) {
      return {
        ok: false,
        response: new Response(
          JSON.stringify({
            ok: false,
            error: verifiedJwt.error,
            message: verifiedJwt.message,
            connectPath: '/bml/connect',
          }),
          { status: 403, headers: BML_CORS_HEADERS }
        ),
      };
    }
  }

  if (hasSameOriginSessionCookie(request)) {
    const nowSec = Math.floor(Date.now() / 1000);
    return {
      ok: true,
      member: {
        userId: 'same_origin_member',
        teamId: 'huck_collective',
        name: 'Signed-in Member',
        email: '',
        prefix: 'HUCK-',
        role: 'founder',
        roleBadge: '👑 Founder',
        iat: nowSec,
        exp: nowSec + 3600,
      },
    };
  }

  return {
    ok: false,
    response: new Response(
      JSON.stringify({
        ok: false,
        error: 'auth_required',
        message: 'Sign in as a Works@TheHC Founder (👑) or Curator (💎) to use this tool.',
        connectPath: '/bml/connect',
      }),
      {
        status: 401,
        headers: BML_CORS_HEADERS,
      }
    ),
  };
}

export async function loadServerBmlToolConfig(toolId: 'ricochet_sync' | 'auction_scout') {
  const endpoint = getEnvVar('PUBLIC_APPWRITE_ENDPOINT') || 'https://sfo.cloud.appwrite.io/v1';
  const project = getEnvVar('PUBLIC_APPWRITE_PROJECT_ID') || '69714b35003a8adab6bb';
  const apiKey = getEnvVar('APPWRITE_API_KEY') || '';
  const dbId = getEnvVar('PUBLIC_APPWRITE_DB_ID') || 'resale_db';

  try {
    const client = new Client().setEndpoint(endpoint).setProject(project);
    if (apiKey) client.setKey(apiKey);
    const db = new Databases(client);
    const doc: any = await db.getDocument(dbId, 'manifests', 'bml_registry_config_v1');
    const raw = doc?.itemsSnapshot || doc?.notes_raw;
    if (raw) {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (parsed?.tools?.[toolId]) {
        return parsed.tools[toolId];
      }
    }
  } catch {}
  return null;
}
