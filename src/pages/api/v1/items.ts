import type { APIRoute } from 'astro';
import { Client, Databases, Query } from "node-appwrite";

export const prerender = false;

// Initialize Server-Side Appwrite Client
const ENDPOINT = import.meta.env.PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = import.meta.env.PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = import.meta.env.APPWRITE_API_KEY || process.env.APPWRITE_API_KEY;

const client = new Client();

if (ENDPOINT && PROJECT_ID) {
    client.setEndpoint(ENDPOINT).setProject(PROJECT_ID);
} else {
    console.warn("Appwrite environment variables for Endpoint/Project missing in backend items api");
}

if (API_KEY) {
    client.setKey(API_KEY as string);
}

import { getDatabaseId, getItemsCollectionId } from '../../../lib/appwriteEnv';

const db = new Databases(client);

// Ensure we respect environment if defined globally
const DB_ID = getDatabaseId();
const ITEMS_COL = getItemsCollectionId();
const API_KEYS_COL = "api_keys";

export const GET: APIRoute = async ({ request }) => {
    try {
        // 1. Headless API Key Auth Check
        const authHeader = request.headers.get("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return new Response(JSON.stringify({ error: "Unauthorized", details: "Missing or invalid Authorization Bearer token" }), { 
                status: 401,
                headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
            });
        }
        
        const providedKey = authHeader.split(" ")[1];
        
        const keysList = await db.listDocuments(DB_ID, API_KEYS_COL, [
            Query.equal("key", providedKey),
            Query.equal("isActive", true)
        ]);
        
        if (keysList.total === 0) {
            return new Response(JSON.stringify({ error: "Forbidden", details: "Invalid or inactive API Key" }), { 
                status: 403,
                headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
            });
        }
        
        const apiKeyDoc = keysList.documents[0];
        const tenantId = apiKeyDoc.tenantId;

        if (!tenantId) {
             return new Response(JSON.stringify({ error: "Server Configuration Error", details: "API Key lacks a valid tenantId" }), { 
                 status: 500,
                 headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
             });
        }

        // 1.5 Organization Domain Security Check
        const originHeader = request.headers.get("Origin");
        if (originHeader) {
            try {
                const orgSettingsFetch = await db.listDocuments(DB_ID, 'org_settings', [
                    Query.equal('tenantId', tenantId)
                ]);
                if (orgSettingsFetch.documents.length > 0) {
                    const orgSettingsDoc = orgSettingsFetch.documents[0];
                    const allowedDomains = orgSettingsDoc.allowedDomains || [];
                    
                    if (allowedDomains.length > 0) {
                        const normalizedOrigin = originHeader.toLowerCase().trim().replace(/\/$/, "");
                        
                        const isAllowed = allowedDomains.some((dom: string) => {
                            const normalizedDom = dom.toLowerCase().trim().replace(/\/$/, "");
                            return normalizedOrigin === normalizedDom;
                        });

                        if (!isAllowed) {
                            return new Response(JSON.stringify({ error: "Forbidden", details: `CORS Origin '${originHeader}' is not whitelisted by the organization.` }), { 
                                status: 403,
                                headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
                            });
                        }
                    }
                }
            } catch (err) {
                 console.error("Domain verification failed softly:", err);
            }
        }

        // 2. Extract Query Parameters
        const url = new URL(request.url);
        const limitParam = parseInt(url.searchParams.get("limit") || "100", 10);
        const offsetParam = parseInt(url.searchParams.get("offset") || "0", 10);
        const statusParam = url.searchParams.get("status");

        // Enforce max limits
        const limit = isNaN(limitParam) ? 100 : Math.min(limitParam, 100); 
        const offset = isNaN(offsetParam) ? 0 : offsetParam;

        const queries = [
            Query.equal("tenantId", tenantId),
            Query.orderDesc("$createdAt"), // Return newest first by default
            Query.limit(limit),
            Query.offset(offset)
        ];

        if (statusParam) {
            queries.push(Query.equal("status", statusParam));
        }

        // 3. Fetch data from Appwrite
        const itemsList = await db.listDocuments(DB_ID, ITEMS_COL, queries);

        // 4. Return Data
        return new Response(JSON.stringify({ 
            success: true, 
            total: itemsList.total,
            limit: limit,
            offset: offset,
            items: itemsList.documents 
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                "Access-Control-Allow-Origin": "*"
            }
        });

    } catch (error: any) {
        console.error("Fetch Items API Error:", error);
        return new Response(JSON.stringify({ 
            error: 'Server Error', 
            details: error instanceof Error ? error.message : "Unknown error processing request" 
        }), { 
            status: 500,
            headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
        });
    }
}

export const OPTIONS: APIRoute = async () => {
    return new Response(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
    });
};
