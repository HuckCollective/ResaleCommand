import type { APIRoute } from 'astro';
import { Client, Databases, Query } from 'node-appwrite';

export const prerender = false;

// Pricing: Gemini 2.5 Flash ($0.075 / 1M prompt, $0.30 / 1M completion)
// Average scan: ~1,500 input + ~400 output tokens
const COST_PER_SCAN = (1500 * 0.075 / 1_000_000) + (400 * 0.30 / 1_000_000); // ~$0.0002325
const TOKENS_PER_SCAN = 1900;

interface MonthBucket {
    key: string; // "YYYY-MM"
    label: string; // "August 2026"
    year: number;
    month: number; // 0-11
    totalScans: number;
    prodScans: number;
    devScans: number;
    estCost: number;
    prodCost: number;
    devCost: number;
    totalTokens: number;
}

interface UserBucket {
    userId: string;
    totalScans: number;
    prodScans: number;
    devScans: number;
    estCost: number;
    lastActive: string;
}

export const GET: APIRoute = async () => {
    try {
        const endpoint = import.meta.env.PUBLIC_APPWRITE_ENDPOINT || process.env.PUBLIC_APPWRITE_ENDPOINT;
        const projectId = import.meta.env.PUBLIC_APPWRITE_PROJECT_ID || process.env.PUBLIC_APPWRITE_PROJECT_ID;
        const apiKey = process.env.APPWRITE_API_KEY || import.meta.env.APPWRITE_API_KEY;
        const dbId = import.meta.env.PUBLIC_APPWRITE_DB_ID || process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';

        if (!endpoint || !projectId || !apiKey) {
            return new Response(JSON.stringify({ error: 'Appwrite credentials not configured' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const client = new Client()
            .setEndpoint(endpoint)
            .setProject(projectId)
            .setKey(apiKey);

        const databases = new Databases(client);

        // Fetch documents from both Prod and Dev
        const fetchCollectionItems = async (colId: string) => {
            const items: any[] = [];
            let offset = 0;
            const limit = 100;
            let hasMore = true;

            while (hasMore) {
                try {
                    const res = await databases.listDocuments(dbId, colId, [
                        Query.limit(limit),
                        Query.offset(offset),
                        Query.orderDesc('$createdAt')
                    ]);
                    items.push(...res.documents);
                    offset += limit;
                    // Cap at 1,000 documents per collection to protect serverless timeout
                    if (res.documents.length < limit || items.length >= 1000) {
                        hasMore = false;
                    }
                } catch {
                    hasMore = false;
                }
            }
            return items;
        };

        const [prodItems, devItems] = await Promise.all([
            fetchCollectionItems('items'),
            fetchCollectionItems('items_dev')
        ]);

        const monthlyMap = new Map<string, MonthBucket>();
        const userMap = new Map<string, UserBucket>();

        let allTimeProdScans = 0;
        let allTimeDevScans = 0;

        const processDocument = (doc: any, isProd: boolean) => {
            // Check if document was processed or enriched by AI
            const isAiScanned = !!doc.rawAnalysis || doc.status === 'scouted' || (Array.isArray(doc.keywords) && doc.keywords.length > 0);
            if (!isAiScanned) return;

            if (isProd) {
                allTimeProdScans++;
            } else {
                allTimeDevScans++;
            }

            const date = new Date(doc.$createdAt || doc.$updatedAt || Date.now());
            const year = date.getFullYear();
            const month = date.getMonth();
            const key = `${year}-${String(month + 1).padStart(2, '0')}`;

            const monthName = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });

            if (!monthlyMap.has(key)) {
                monthlyMap.set(key, {
                    key,
                    label: monthName,
                    year,
                    month,
                    totalScans: 0,
                    prodScans: 0,
                    devScans: 0,
                    estCost: 0,
                    prodCost: 0,
                    devCost: 0,
                    totalTokens: 0
                });
            }

            const bucket = monthlyMap.get(key)!;
            bucket.totalScans++;
            bucket.totalTokens += TOKENS_PER_SCAN;
            bucket.estCost += COST_PER_SCAN;

            if (isProd) {
                bucket.prodScans++;
                bucket.prodCost += COST_PER_SCAN;
            } else {
                bucket.devScans++;
                bucket.devCost += COST_PER_SCAN;
            }

            // User attribution
            const userId = doc.tenantId || 'Primary Team';
            if (!userMap.has(userId)) {
                userMap.set(userId, {
                    userId,
                    totalScans: 0,
                    prodScans: 0,
                    devScans: 0,
                    estCost: 0,
                    lastActive: doc.$createdAt
                });
            }

            const userBucket = userMap.get(userId)!;
            userBucket.totalScans++;
            userBucket.estCost += COST_PER_SCAN;
            if (isProd) {
                userBucket.prodScans++;
            } else {
                userBucket.devScans++;
            }
        };

        prodItems.forEach(doc => processDocument(doc, true));
        devItems.forEach(doc => processDocument(doc, false));

        // Sort monthly history descending (most recent first)
        const monthlyHistory = Array.from(monthlyMap.values()).sort((a, b) => b.key.localeCompare(a.key));

        const now = new Date();
        const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

        const thisMonth = monthlyMap.get(currentKey) || {
            key: currentKey,
            label: now.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
            year: now.getFullYear(),
            month: now.getMonth(),
            totalScans: 0,
            prodScans: 0,
            devScans: 0,
            estCost: 0,
            prodCost: 0,
            devCost: 0,
            totalTokens: 0
        };

        const lastMonth = monthlyMap.get(lastMonthKey) || {
            key: lastMonthKey,
            label: lastMonthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
            year: lastMonthDate.getFullYear(),
            month: lastMonthDate.getMonth(),
            totalScans: 0,
            prodScans: 0,
            devScans: 0,
            estCost: 0,
            prodCost: 0,
            devCost: 0,
            totalTokens: 0
        };

        const allTimeTotalScans = allTimeProdScans + allTimeDevScans;
        const allTimeTotalCost = allTimeTotalScans * COST_PER_SCAN;

        const byUser = Array.from(userMap.values()).sort((a, b) => b.totalScans - a.totalScans);

        return new Response(JSON.stringify({
            success: true,
            model: 'gemini-2.5-flash',
            pricingRates: {
                promptPerMillion: 0.075,
                completionPerMillion: 0.30,
                avgScanCost: COST_PER_SCAN
            },
            summary: {
                thisMonth,
                lastMonth,
                allTime: {
                    totalScans: allTimeTotalScans,
                    prodScans: allTimeProdScans,
                    devScans: allTimeDevScans,
                    totalCost: allTimeTotalCost,
                    prodCost: allTimeProdScans * COST_PER_SCAN,
                    devCost: allTimeDevScans * COST_PER_SCAN,
                    totalTokens: allTimeTotalScans * TOKENS_PER_SCAN
                }
            },
            monthlyHistory,
            byUser
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, max-age=0'
            }
        });

    } catch (e: any) {
        return new Response(JSON.stringify({
            success: false,
            error: e.message || 'Failed to aggregate AI metrics'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
