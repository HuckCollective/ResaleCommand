export const prerender = false;

import { Client, Databases } from 'node-appwrite';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
    // SECURITY GUARD: Only allow this script to run locally in development mode.
    if (!import.meta.env.DEV) {
        return new Response(JSON.stringify({ error: "Forbidden in production environment" }), { status: 403 });
    }

    try {
        console.log('[API] Starting Sales & Warehouses schema setup...');
        
        const apiKey = import.meta.env.APPWRITE_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'Missing APPWRITE_API_KEY' }), { status: 500 });
        }

        const client = new Client()
            .setEndpoint(import.meta.env.PUBLIC_APPWRITE_ENDPOINT)
            .setProject(import.meta.env.PUBLIC_APPWRITE_PROJECT_ID)
            .setKey(apiKey);

        const databases = new Databases(client);
        const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
        const ITEMS_COL = import.meta.env.PUBLIC_APPWRITE_COLLECTION_ID || 'inventory';

        const results: any[] = [];

        // 1. Create Collections (if they don't exist)
        const collectionsToCreate = [
            { id: 'sales', name: 'Sales' },
            { id: 'warehouses', name: 'Warehouses' }
        ];

        for (const col of collectionsToCreate) {
            try {
                // Read/Create/Update/Delete available to any authenticated user (document security restricts row-level)
                await databases.createCollection(
                    DB_ID,
                    col.id,
                    col.name,
                    ['read("users")', 'create("users")', 'update("users")', 'delete("users")'],
                    true // Document Level Security enabled
                );
                results.push({ collection: col.id, status: 'created' });
            } catch (e: any) {
                if (e.code === 409) {
                    results.push({ collection: col.id, status: 'exists' });
                } else {
                    console.error(`Failed to create collection ${col.id}:`, e.message);
                    results.push({ collection: col.id, status: 'error', error: e.message });
                }
            }
        }

        // Wait a few seconds for collections to be ready before adding attributes
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 2. Define Attributes for Warehouses
        const warehouseStrings = [
            { key: 'name', size: 255 },
            { key: 'type', size: 50 },
            { key: 'tenantId', size: 255 }
        ];
        const warehouseFloats = [
            { key: 'commissionRate' },
            { key: 'monthlyRent' }
        ];

        // 3. Define Attributes for Sales
        const salesStrings = [
            { key: 'soNumber', size: 255 },
            { key: 'warehouseId', size: 255 },
            { key: 'orderId', size: 255 },
            { key: 'saleDate', size: 255 }, // using string for ISO dates for simpler sorting
            { key: 'status', size: 50 },
            { key: 'tenantId', size: 255 }
        ];
        const salesFloats = [
            { key: 'grossAmount' },
            { key: 'shippingCharged' },
            { key: 'shippingCost' },
            { key: 'commissionFee' },
            { key: 'netPayout' }
        ];

        // Helper to create string attributes
        const createStrings = async (colId: string, attrs: any[]) => {
            for (const attr of attrs) {
                try {
                    await databases.createStringAttribute(DB_ID, colId, attr.key, attr.size, false, undefined, false);
                    console.log(`Created string attribute: ${colId}.${attr.key}`);
                } catch (e: any) {
                    if (e.code !== 409) console.error(`Failed ${colId}.${attr.key}:`, e.message);
                }
            }
        };

        // Helper to create float attributes
        const createFloats = async (colId: string, attrs: any[]) => {
            for (const attr of attrs) {
                try {
                    await databases.createFloatAttribute(DB_ID, colId, attr.key, false, undefined, undefined, undefined, false);
                    console.log(`Created float attribute: ${colId}.${attr.key}`);
                } catch (e: any) {
                    if (e.code !== 409) console.error(`Failed ${colId}.${attr.key}:`, e.message);
                }
            }
        };

        await createStrings('warehouses', warehouseStrings);
        await createFloats('warehouses', warehouseFloats);
        
        await createStrings('sales', salesStrings);
        await createFloats('sales', salesFloats);

        // 4. Update existing ITEMS collection
        const itemStrings = [
            { key: 'saleId', size: 255 },
            { key: 'warehouseId', size: 255 }
        ];
        await createStrings(ITEMS_COL, itemStrings);

        // Wait for attributes to be ready before creating indexes
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 5. Create Indexes
        const createIndex = async (colId: string, key: string, type: 'key' | 'fulltext' = 'key') => {
            try {
                await databases.createIndex(DB_ID, colId, `idx_${key}`, type, [key], ['ASC']);
                console.log(`Created index on ${colId} for ${key}`);
            } catch (e: any) {
                if (e.code !== 409) console.error(`Failed index ${colId}.${key}:`, e.message);
            }
        };

        await createIndex('sales', 'soNumber');
        await createIndex('sales', 'saleDate', 'key');
        await createIndex('sales', 'warehouseId');
        
        await createIndex('warehouses', 'name');

        await createIndex(ITEMS_COL, 'saleId');
        await createIndex(ITEMS_COL, 'warehouseId');

        return new Response(JSON.stringify({ success: true, message: "Sales and Warehouses schema created successfully!", results }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('[API Error]', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};
