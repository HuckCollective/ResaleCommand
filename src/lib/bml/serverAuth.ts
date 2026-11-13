import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Account, Client, Databases, Teams } from 'node-appwrite';
import { getEnvVar } from '../appwriteEnv';
import { SYNC_FALLBACK_ORIGINS } from '../../site-config';

export interface BookmarkletMemberSession {
  userId: string;
  teamId: string;
  name: string;
  email: string;
  prefix: string;
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

export function mintBookmarkletToken(
  member: Omit<BookmarkletMemberSession, 'iat' | 'exp'>,
  ttlSeconds = DEFAULT_TTL_SECONDS
): { token: string; session: BookmarkletMemberSession } {
  const nowSec = Math.floor(Date.now() / 1000);
  const session: BookmarkletMemberSession = {
    userId: member.userId,
    teamId: member.teamId || 'huck_collective',
    name: member.name || 'Member',
    email: member.email || '',
    prefix: (member.prefix || 'HUCK-').toUpperCase(),
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

    const parsed = JSON.parse(base64UrlDecode(encoded)) as BookmarkletMemberSession;
    const nowSec = Math.floor(Date.now() / 1000);
    if (!parsed?.userId || !parsed?.exp || parsed.exp < nowSec) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function verifyAppwriteJwtToMember(jwt: string): Promise<BookmarkletMemberSession | null> {
  if (!jwt) return null;
  const endpoint = getEnvVar('PUBLIC_APPWRITE_ENDPOINT') || 'https://sfo.cloud.appwrite.io/v1';
  const project = getEnvVar('PUBLIC_APPWRITE_PROJECT_ID') || '69714b35003a8adab6bb';

  try {
    const userClient = new Client().setEndpoint(endpoint).setProject(project).setJWT(jwt);
    const account = new Account(userClient);
    const teamsApi = new Teams(userClient);

    const me = await account.get();
    const teamList = await teamsApi.list().catch(() => ({ teams: [] as any[] }));
    const primaryTeam = teamList.teams?.[0];
    const teamId = primaryTeam?.$id || me.$id;
    const rawPrefix = primaryTeam?.prefs?.upcPrefix || (me.prefs as any)?.upcPrefix || 'HUCK-';
    const prefix = String(rawPrefix).trim().toUpperCase();

    const nowSec = Math.floor(Date.now() / 1000);
    return {
      userId: me.$id,
      teamId,
      name: me.name || me.email || 'Member',
      email: me.email || '',
      prefix: prefix.endsWith('-') ? prefix : `${prefix}-`,
      iat: nowSec,
      exp: nowSec + DEFAULT_TTL_SECONDS,
    };
  } catch {
    return null;
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
    if (verifiedJwt) {
      return { ok: true, member: verifiedJwt };
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
        message: 'Sign in to Works@TheHC to use this bookmarklet.',
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

