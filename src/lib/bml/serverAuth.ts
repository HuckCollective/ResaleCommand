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
  prefixStatus?: 'unset' | 'requested' | 'locked';
  requestedPrefix?: string;
  ownedPrefixes?: string[];
  role: BookmarkletAllowedRole;
  roleBadge: string;
  iat: number;
  exp: number;
}

const TOKEN_PREFIX = 'rcbml_v1';
const DEFAULT_TTL_SECONDS = 14 * 24 * 60 * 60; // 14 days (matches UI 14-Day Token badge; rotate BML_TOKEN_SECRET to revoke)

export const BML_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Appwrite-JWT, X-RC-BML-Token',
  'Content-Type': 'application/json',
};

let warnedImplicitBmlSecret = false;

function getSigningSecret(): string {
  const keyVersion = getEnvVar('BML_TOKEN_KEY_VERSION') || 'v1';
  const explicit = getEnvVar('BML_TOKEN_SECRET') || getEnvVar('JOIN_LINK_SECRET');
  if (explicit) {
    return `${keyVersion}:${explicit}`;
  }
  const apiKey = getEnvVar('APPWRITE_API_KEY');
  if (!apiKey) {
    throw new Error('BML_TOKEN_SECRET (or APPWRITE_API_KEY) must be configured on the server.');
  }
  if (!warnedImplicitBmlSecret) {
    warnedImplicitBmlSecret = true;
    console.warn(
      '[bml/serverAuth] BML_TOKEN_SECRET is not explicitly set; deriving HMAC key from server secret. Set BML_TOKEN_SECRET in production for independent token rotation.'
    );
  }
  return createHash('sha256')
    .update(`rc-bml-secret:${keyVersion}:${apiKey}`)
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
  userId: string,
  userName: string,
  userEmail: string,
  prefix: string,
  isTeamOwnerOrAdmin: boolean
): Promise<{
  role: BookmarkletAllowedRole | 'restricted';
  isConsignor: boolean;
  rosterMatched?: boolean;
  rosterPrefix?: string;
  prefixStatus?: 'unset' | 'requested' | 'locked';
  requestedPrefix?: string;
  ownedPrefixes?: string[];
}> {
  if (prefix.toUpperCase().startsWith('BB')) {
    return { role: 'restricted', isConsignor: true, prefixStatus: 'locked', ownedPrefixes: ['BB-'] };
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

  const uId = String(userId || '').trim();
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

    // Strict 1-to-1 matching: userId -> email -> unlinked exact name fallback only
    const matched =
      (uId ? members.find((m) => String(m?.userId || m?.id || '').trim() === uId) : undefined) ||
      (uEmail
        ? members.find((m) => {
            const mUid = String(m?.userId || m?.id || '').trim();
            if (mUid && uId && mUid !== uId) return false;
            return String(m?.email || '').trim().toLowerCase() === uEmail;
          })
        : undefined) ||
      (uName
        ? members.find((m) => {
            const mUid = String(m?.userId || m?.id || '').trim();
            const mEm = String(m?.email || '').trim();
            if (mUid || mEm) return false;
            return cleanName(m?.name || '') === uName;
          })
        : undefined);

    if (matched) {
      const normCode = (val: unknown) => {
        const c = String(val || '').trim().toUpperCase();
        return c ? (c.endsWith('-') ? c : `${c}-`) : undefined;
      };
      const rosterPrefix = normCode(matched.inventoryPrefix);
      const requestedPrefix = normCode(matched.requestedPrefix);
      const historicals: string[] = Array.isArray(matched.historicalPrefixes)
        ? matched.historicalPrefixes.map((h: any) => normCode(h)).filter(Boolean) as string[]
        : [];
      const prefixStatus: 'unset' | 'requested' | 'locked' =
        matched.prefixStatus === 'locked' && rosterPrefix
          ? 'locked'
          : matched.prefixStatus === 'requested' || (!rosterPrefix && Boolean(requestedPrefix))
            ? 'requested'
            : rosterPrefix
              ? 'locked'
              : 'unset';
      const ownedPrefixes = Array.from(
        new Set([...(rosterPrefix ? [rosterPrefix] : []), ...historicals])
      );
      const hats: string[] = Array.isArray(matched.hats) ? matched.hats : [];
      const isRosterConsignor =
        Boolean(rosterPrefix?.startsWith('BB')) ||
        matched.partner === 'BB' ||
        matched.role === 'Consignor' ||
        (hats.length === 1 && hats[0] === 'consignor');

      if (isRosterConsignor) {
        return {
          role: 'restricted',
          isConsignor: true,
          rosterMatched: true,
          rosterPrefix: rosterPrefix || 'BB-',
          prefixStatus: 'locked',
          ownedPrefixes: ['BB-'],
        };
      }
      if (isTeamOwnerOrAdmin || hats.includes('founder') || matched.role === 'Co-op Member') {
        return {
          role: 'founder',
          isConsignor: false,
          rosterMatched: true,
          rosterPrefix,
          prefixStatus,
          requestedPrefix,
          ownedPrefixes,
        };
      }
      return {
        role: 'curator',
        isConsignor: false,
        rosterMatched: true,
        rosterPrefix,
        prefixStatus,
        requestedPrefix,
        ownedPrefixes,
      };
    }
  } catch {
    // Fall back to team/label role resolution below
  }

  if (isTeamOwnerOrAdmin) return { role: 'founder', isConsignor: false };
  if (!prefix.toUpperCase().startsWith('BB')) {
    return { role: 'curator', isConsignor: false };
  }
  return { role: 'restricted', isConsignor: true };
}

export async function verifyAppwriteJwtToMember(
  jwt: string
): Promise<
  | { ok: true; member: BookmarkletMemberSession }
  | {
      ok: false;
      status: 401 | 403;
      error: string;
      message: string;
      prefix?: string;
      isConsignor?: boolean;
    }
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

    const teamList = await teamsApi.list().catch(() => ({ teams: [] as any[] }));
    const primaryTeam = teamList.teams?.[0];
    const teamId = primaryTeam?.$id || me.$id;
    const rawTeamPrefix = String(primaryTeam?.prefs?.upcPrefix || '').trim().toUpperCase();
    const teamPrefix = rawTeamPrefix
      ? rawTeamPrefix.endsWith('-')
        ? rawTeamPrefix
        : `${rawTeamPrefix}-`
      : '';

    let myRoles: string[] = [];
    if (primaryTeam?.$id) {
      try {
        const memberships = await teamsApi.listMemberships(primaryTeam.$id);
        const myMembership = memberships.memberships?.find(
          (m: any) => m.userId === me.$id && m.confirm !== false
        );
        myRoles = Array.isArray(myMembership?.roles)
          ? myMembership.roles.map((r: string) => String(r || '').trim().toLowerCase())
          : [];
      } catch {}
    }

    const isTrustedConsignor =
      labels.includes('consignor') ||
      teamPrefix.startsWith('BB') ||
      (myRoles.includes('consignor') &&
        !myRoles.some((r) => ['owner', 'founder', 'admin', 'curator'].includes(r)));
    const isSelfConsignor =
      userPrefs.role === 'consignor' ||
      String(userPrefs.upcPrefix || '').trim().toUpperCase().startsWith('BB');
    const isExplicitSweatOnly =
      labels.includes('sweat_only') || userPrefs.role === 'sweat_only';

    // Trusted & self-restricted consignor/sweat checks run FIRST; userPrefs can never lift a BB- account
    if (isTrustedConsignor || isSelfConsignor || isExplicitSweatOnly) {
      const consignorFlag = Boolean(isTrustedConsignor || isSelfConsignor);
      return {
        ok: false,
        status: 403,
        error: 'role_restricted',
        prefix: consignorFlag ? 'BB-' : 'SWEAT-',
        isConsignor: consignorFlag,
        message:
          '🔒 Founder or Curator Hat Required: Bookmarklet tools are currently restricted to Collective Founders (👑) and Curators (💎).',
      };
    }

    const isTeamOwnerOrAdmin =
      labels.includes('admin') ||
      labels.includes('founder') ||
      myRoles.some((r) => ['owner', 'founder', 'admin'].includes(r));

    const resolved = await resolveCoopRosterMemberRole(
      me.$id,
      me.name || '',
      me.email || '',
      teamPrefix || 'HUCK-',
      isTeamOwnerOrAdmin
    );

    let finalRole: BookmarkletAllowedRole | 'restricted' = resolved.role;
    if (finalRole === 'restricted' && !resolved.isConsignor && myRoles.includes('curator')) {
      finalRole = 'curator';
    }

    const rawUserPrefix = String(userPrefs.upcPrefix || '').trim().toUpperCase();
    const userPrefix = rawUserPrefix
      ? rawUserPrefix.endsWith('-')
        ? rawUserPrefix
        : `${rawUserPrefix}-`
      : '';
    const isUnsetCurator =
      (resolved.rosterMatched &&
        (resolved.prefixStatus === 'unset' || resolved.prefixStatus === 'requested') &&
        !resolved.rosterPrefix) ||
      (!resolved.rosterMatched && !isTeamOwnerOrAdmin && !userPrefix);

    const rawChosenPrefix = isUnsetCurator
      ? ''
      : resolved.rosterPrefix || userPrefix || (isTeamOwnerOrAdmin ? teamPrefix || 'HUCK-' : '');
    const cleanChosen = rawChosenPrefix.trim().toUpperCase();
    const prefix = cleanChosen ? (cleanChosen.endsWith('-') ? cleanChosen : `${cleanChosen}-`) : '';
    const resolvedPrefixStatus: 'unset' | 'requested' | 'locked' =
      resolved.prefixStatus || (prefix ? 'locked' : 'unset');

    if (finalRole === 'restricted' || resolved.isConsignor || prefix.startsWith('BB')) {
      const consignorFlag = Boolean(resolved.isConsignor || prefix.startsWith('BB'));
      return {
        ok: false,
        status: 403,
        error: 'role_restricted',
        prefix: consignorFlag ? 'BB-' : 'SWEAT-',
        isConsignor: consignorFlag,
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
        prefixStatus: resolvedPrefixStatus,
        requestedPrefix: resolved.requestedPrefix,
        ownedPrefixes:
          resolved.ownedPrefixes && resolved.ownedPrefixes.length > 0
            ? resolved.ownedPrefixes
            : prefix
              ? [prefix]
              : [],
        role: finalRole,
        roleBadge: formatRoleBadge(finalRole),
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
  request: Request,
  options?: { allowSameOriginCookieFallback?: boolean }
): Promise<
  | { ok: true; member: BookmarkletMemberSession }
  | { ok: false; response: Response; prefix?: string; isConsignor?: boolean }
> {
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
        prefix: verifiedJwt.prefix,
        isConsignor: verifiedJwt.isConsignor,
        response: new Response(
          JSON.stringify({
            ok: false,
            allowed: false,
            role: 'restricted',
            prefix: verifiedJwt.prefix,
            isConsignor: verifiedJwt.isConsignor,
            error: verifiedJwt.error,
            message: verifiedJwt.message,
            connectPath: '/bml/connect',
          }),
          { status: 403, headers: BML_CORS_HEADERS }
        ),
      };
    }
  }

  if (options?.allowSameOriginCookieFallback && hasSameOriginSessionCookie(request)) {
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

export async function loadServerBmlToolConfig(toolId: 'ricochet_sync' | 'auction_scout' | 'listing_assist') {
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
