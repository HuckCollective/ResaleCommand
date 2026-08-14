export const prerender = false;

import { Client, Databases } from 'node-appwrite';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
    // SECURITY GUARD: Only allow this script to run locally in development mode.
    if (!import.meta.env.DEV) {
        return new Response(JSON.stringify({ error: "Forbidden in production environment" }), { status: 403 });
    }

    try {
        console.log('[API] Starting schema migration...');
        
        const apiKey = import.meta.env.APPWRITE_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'Missing APPWRITE_API_KEY' }), { status: 500 });
        }

        const client = new Client()
            .setEndpoint(import.meta.env.PUBLIC_APPWRITE_ENDPOINT)
            .setProject(import.meta.env.PUBLIC_APPWRITE_PROJECT_ID)
            .setKey(apiKey);

        const databases = new Databases(client);

        const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID;
        const COLLECTION_ID = import.meta.env.PUBLIC_APPWRITE_COLLECTION_ID;

        if (!DB_ID || !COLLECTION_ID) {
            return new Response(JSON.stringify({ error: 'Missing DB or Collection ID' }), { status: 500 });
        }

        // Define attributes based on inventory.ts
        const stringAttributes = [
            { key: 'title', size: 255, required: false, array: false },
            { key: 'identity', size: 1000, required: false, array: false },
            { key: 'conditionNotes', size: 1000, required: false, array: false },
            { key: 'status', size: 255, required: false, array: false },
            { key: 'tenantId', size: 255, required: false, array: false },
            { key: 'imageId', size: 255, required: false, array: false },
            { key: 'receiptImageId', size: 255, required: false, array: false },
            { key: 'cartId', size: 255, required: false, array: false },
            { key: 'sourcingLocation', size: 255, required: false, array: false },
            { key: 'storageLocation', size: 255, required: false, array: false },
            { key: 'marketDescription', size: 65000, required: false, array: false },
            { key: 'sellingLocations', size: 255, required: false, array: false },
            { key: 'upc', size: 255, required: false, array: false },
            { key: 'locationSku', size: 255, required: false, array: false },
            { key: 'saleId', size: 255, required: false, array: false },
            { key: 'warehouseId', size: 255, required: false, array: false },
            
            // Array attributes
            { key: 'galleryImageIds', size: 255, required: false, array: true },
            { key: 'keywords', size: 255, required: false, array: true },
        ];

        const floatAttributes = [
            { key: 'cost', required: false, array: false },
            { key: 'resalePrice', required: false, array: false },
            { key: 'maxBuyPrice', required: false, array: false },
        ];

        const results: any[] = [];

        // 1. Create String Attributes
        for (const attr of stringAttributes) {
            try {
                await databases.createStringAttribute(
                    DB_ID,
                    COLLECTION_ID,
                    attr.key,
                    attr.size,
                    attr.required,
                    undefined, // default
                    attr.array
                );
                results.push({ key: attr.key, status: 'created' });
                console.log(`Created string attribute: ${attr.key}`);
            } catch (e: any) {
                if (e.code === 409) {
                    results.push({ key: attr.key, status: 'exists' });
                } else {
                    console.error(`Failed to create ${attr.key}:`, e.message);
                    results.push({ key: attr.key, status: 'error', error: e.message });
                }
            }
        }

        // 2. Create Float Attributes
        for (const attr of floatAttributes) {
            try {
                await databases.createFloatAttribute(
                    DB_ID,
                    COLLECTION_ID,
                    attr.key,
                    attr.required,
                    undefined,
                    undefined,
                    undefined,
                    attr.array
                );
                results.push({ key: attr.key, status: 'created' });
                console.log(`Created float attribute: ${attr.key}`);
            } catch (e: any) {
                if (e.code === 409) {
                    results.push({ key: attr.key, status: 'exists' });
                } else {
                    console.error(`Failed to create ${attr.key}:`, e.message);
                    results.push({ key: attr.key, status: 'error', error: e.message });
                }
            }
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: 'Schema migration complete. Appwrite will process changes asynchronously.',
            results 
        }, null, 2), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};
