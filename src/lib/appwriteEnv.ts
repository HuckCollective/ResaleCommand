import { isAlphaMode } from '../stores/env';

/**
 * Reads an environment variable safely in client, server (Astro SSR), or Node scripts.
 */
export function getEnvVar(key: string, fallback = ''): string {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key] !== undefined) {
        const val = String(import.meta.env[key]).trim();
        if (val) return val;
    }
    if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
        const val = String(process.env[key]).trim();
        if (val) return val;
    }
    return fallback;
}

/**
 * Returns current normalized environment ('prod', 'dev', 'alpha', etc.)
 * Default is 'prod'.
 */
export function getAppwriteEnvironment(): 'prod' | 'dev' | 'alpha' | string {
    const raw = getEnvVar('PUBLIC_APPWRITE_ENVIRONMENT', '').toLowerCase();
    if (!raw || raw === 'prod' || raw === 'production') return 'prod';
    if (raw === 'dev' || raw === 'development') return 'dev';
    if (raw === 'alpha') return 'alpha';
    return raw;
}

export function isDevEnvironment(): boolean {
    return getAppwriteEnvironment() === 'dev';
}

export function isAlphaEnvironment(): boolean {
    return getAppwriteEnvironment() === 'alpha' || (typeof isAlphaMode !== 'undefined' && isAlphaMode?.get?.());
}

/**
 * Centralized Collection ID resolver with fail-safe Production default.
 * 
 * Rules:
 * 1. If explicitOverride is passed and NOT a generic base name (e.g. not 'items' or 'purchases'), use it.
 * 2. If running in Alpha mode (via toggle or PUBLIC_APPWRITE_ENVIRONMENT=alpha):
 *    - For 'items': use PUBLIC_APPWRITE_ALPHA_COLLECTION_ID || 'items_dev'
 * 3. If running in Dev mode (PUBLIC_APPWRITE_ENVIRONMENT=dev):
 *    - Automatically appends '_dev' to base collection name:
 *      'items' -> 'items_dev'
 *      'purchases' -> 'purchases_dev'
 *    - If an explicit collection variable is set with an explicit custom name, respect it.
 * 4. Otherwise (default = Prod):
 *    - 'items' -> PUBLIC_APPWRITE_COLLECTION_ID || 'items'
 *    - 'purchases' -> PUBLIC_APPWRITE_PURCHASES_COLLECTION_ID || 'purchases'
 */
export function resolveCollectionId(baseName: string, explicitOverride?: string): string {
    if (explicitOverride && explicitOverride !== baseName && explicitOverride !== `${baseName}_dev`) {
        return explicitOverride;
    }

    const env = getAppwriteEnvironment();

    // Check Alpha mode
    if (baseName === 'items' && isAlphaEnvironment()) {
        const alphaOverride = getEnvVar('PUBLIC_APPWRITE_ALPHA_COLLECTION_ID', '');
        return alphaOverride || 'items_dev';
    }

    // Check Dev mode
    if (env === 'dev') {
        if (baseName === 'items') {
            const rawCol = getEnvVar('PUBLIC_APPWRITE_COLLECTION_ID', '');
            if (rawCol && rawCol !== 'items') return rawCol;
            const alphaCol = getEnvVar('PUBLIC_APPWRITE_ALPHA_COLLECTION_ID', '');
            if (alphaCol) return alphaCol;
            return 'items_dev';
        }
        if (baseName === 'purchases' || baseName === 'carts') {
            const rawCol = getEnvVar('PUBLIC_APPWRITE_PURCHASES_COLLECTION_ID', '') || getEnvVar('PUBLIC_APPWRITE_CARTS_COL', '');
            if (rawCol && rawCol !== 'purchases' && rawCol !== 'carts') return rawCol;
            return 'purchases_dev';
        }
        return `${baseName}_dev`;
    }

    // Default: Production
    if (baseName === 'items') {
        return getEnvVar('PUBLIC_APPWRITE_COLLECTION_ID', 'items');
    }
    if (baseName === 'purchases' || baseName === 'carts') {
        return getEnvVar('PUBLIC_APPWRITE_PURCHASES_COLLECTION_ID', 'purchases');
    }

    return baseName;
}

export function getDatabaseId(): string {
    return getEnvVar('PUBLIC_APPWRITE_DB_ID', 'resale_db');
}

export function getItemsCollectionId(): string {
    return resolveCollectionId('items');
}

export function getPurchasesCollectionId(): string {
    return resolveCollectionId('purchases');
}

export function getBucketId(): string {
    const rawBucket = getEnvVar('PUBLIC_APPWRITE_BUCKET_ID', '');
    if (rawBucket && rawBucket !== 'item_images') return rawBucket;
    if (isDevEnvironment()) {
        const devBucket = getEnvVar('PUBLIC_APPWRITE_BUCKET_ID_DEV', '');
        if (devBucket) return devBucket;
    }
    return rawBucket || 'item_images';
}
