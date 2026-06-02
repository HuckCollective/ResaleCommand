import { defineMiddleware } from "astro:middleware";
import { Client, Databases, Query } from "node-appwrite";

// Simple local cache to prevent querying Appwrite on every single request
const domainCache = new Map<string, { tenantId: string | null; expiry: number }>();
const CACHE_TTL_MS = 60000; // 1 minute

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const host = context.request.headers.get("host") || url.host;
  
  // 1. Skip system paths, assets, api calls, server islands, and already rewritten subsite paths
  const isSystemPath = 
    url.pathname.startsWith('/_astro') || 
    url.pathname.startsWith('/_server-islands') || 
    url.pathname.startsWith('/api/') || 
    url.pathname.startsWith('/subsite') || 
    url.pathname.startsWith('/favicon.ico');
    
  console.log(`[Middleware] Request: host=${host}, pathname=${url.pathname}, isSystemPath=${isSystemPath}`);

  if (isSystemPath) {
    console.log(`[Middleware] Bypassing system/rewritten path: ${url.pathname}`);
    return next();
  }

  // 2. Identify if we are on a custom tenant domain or subdomain
  const primaryDomains = ["resalecmd.com", "resalecommand.com"];
  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1") || host.includes("localhost:4321");
  
  let tenantId: string | null = null;
  
  const matchingPrimary = primaryDomains.find(d => host === d || host === `www.${d}`);
  
  if (matchingPrimary) {
    // Main site, no tenant rewrite
    tenantId = null;
  } else if (!isLocalhost) {
    // Check if it is a subdomain of any of our primary domains
    const matchedDomain = primaryDomains.find(d => host.endsWith("." + d));
    if (matchedDomain) {
      // Extract subdomain
      const parts = host.split(".");
      const subdomain = parts[0];
      if (subdomain !== "www") {
        tenantId = subdomain;
      }
    } else {
      // Custom Domain: Lookup tenantId in Appwrite
      tenantId = await resolveTenantIdFromHost(host);
    }
  } else if (isLocalhost) {
    // For local testing: if hostname contains a port, strip it, or check subdomains
    const subdomain = host.split(":")[0];
    if (subdomain !== "localhost" && subdomain !== "127.0.0.1" && subdomain !== "www") {
      // e.g. "tenant1.localhost:4321" -> "tenant1"
      tenantId = subdomain.split(".")[0];
    }
  }

  console.log(`[Middleware] Resolved tenantId=${tenantId} for host=${host}`);

  // 3. Perform routing rewrite
  if (tenantId) {
    // Set tenant context in locals for pages/components to access
    context.locals.tenantId = tenantId;

    // Rewrite request internally to the subsite pages folder
    const targetPath = `/subsite${url.pathname === '/' ? '' : url.pathname}`;
    console.log(`[Middleware] Rewriting ${url.pathname} -> ${targetPath} (tenantId=${tenantId})`);
    return context.rewrite(targetPath);
  }

  // 4. Default authentication guards for primary application site
  const protectedRoutes = ["/dashboard", "/inventory", "/partners"];
  if (protectedRoutes.some(route => url.pathname.startsWith(route))) {
    const authCookie = context.cookies.get("auth_session_indicator");
    if (!authCookie || !authCookie.value) {
      console.log(`[Middleware] Redirecting unauthenticated user from ${url.pathname} to /login`);
      return context.redirect("/login", 302);
    }
  }

  return next();
});

// Queries the new Appwrite collection with a local cache
async function resolveTenantIdFromHost(host: string): Promise<string | null> {
  const now = Date.now();
  const cached = domainCache.get(host);
  if (cached && cached.expiry > now) {
    return cached.tenantId;
  }

  // Set up Appwrite Client (Server Side)
  const client = new Client();
  client
    .setEndpoint(import.meta.env.PUBLIC_APPWRITE_ENDPOINT)
    .setProject(import.meta.env.PUBLIC_APPWRITE_PROJECT_ID);
  
  const apiKey = process.env.APPWRITE_API_KEY || import.meta.env.APPWRITE_API_KEY;
  if (apiKey) {
    client.setKey(apiKey);
  }

  const db = new Databases(client);
  const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || "resale_db";
  
  try {
    const response = await db.listDocuments(DB_ID, "tenant_domains", [
      Query.equal("domain", host),
      Query.equal("isActive", true)
    ]);
    
    const tenantId = response.total > 0 ? (response.documents[0].tenantId as string) : null;
    domainCache.set(host, { tenantId, expiry: now + CACHE_TTL_MS });
    return tenantId;
  } catch (err: any) {
    if (err.type === "collection_not_found" || err.code === 404) {
      console.warn(`[Middleware] Domain lookup bypassed for ${host}: 'tenant_domains' collection not found in database.`);
    } else {
      console.error(`[Middleware] Domain lookup failed for host ${host}:`, err.message || err);
    }
    return null;
  }
}

