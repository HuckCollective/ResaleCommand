import { ref, computed } from 'vue';
import { client, databases, storage, ID, Query } from '../lib/appwrite';
import { Permission, Role, type Models } from 'appwrite';
import { useAuth } from './useAuth';
import { useCart, type Cart, type CartItem } from './useCart';
import { isAlphaMode } from '../stores/env';
import { getPurchasesCollectionId, purchasesAPI } from '../lib/purchases';
import { getItemsByPurchaseId } from '../lib/inventory';

const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
const PURCHASES_COL = getPurchasesCollectionId();
const getItemsCollectionId = () => isAlphaMode.get() 
    ? (import.meta.env.PUBLIC_APPWRITE_ALPHA_COLLECTION_ID || 'alpha_items') 
    : (import.meta.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items');

export interface ScoutPurchase extends Models.Document {
    vendor: string;
    tenantId?: string;
    buyerId?: string;
    purchaseDate: string;
    status: string;
    orderId?: string;
    poNumber?: string;
    subtotal?: number;
    grandTotal?: number;
    receiptImageId?: string;
    itemCount?: number;
}

export interface ScoutPurchaseItem extends Models.Document {
    title: string;
    identity?: string;
    cost?: number;
    resalePrice?: number;
    boutiquePrice?: number;
    condition?: string;
    imageId?: string | null;
    galleryImageIds?: string[];
    rawAnalysis?: string;
    conditionNotes?: string;
    status?: string;
    purchaseId?: string;
    isLot?: boolean;
    lotItemsCount?: number;
}

// Shared module state across Scout components
const activePurchase = ref<ScoutPurchase | null>(null);
const purchaseItems = ref<ScoutPurchaseItem[]>([]);
const draftPurchases = ref<ScoutPurchase[]>([]);
const lastActivePurchaseId = ref<string | null>(null);
const isTrayOpen = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);

let unsubscribe: (() => void) | null = null;

export function useScoutPurchase() {
    const { user, currentTeam } = useAuth();
    const { activeCart, cartItems, setActiveCart: setGlobalActiveCart, leaveCart: leaveGlobalCart } = useCart();

    // -- Reactive Manifest Calculations --
    const singleItems = computed(() => {
        return purchaseItems.value.filter(item => !isItemLot(item));
    });

    const lotItems = computed(() => {
        return purchaseItems.value.filter(item => isItemLot(item));
    });

    const totalCost = computed(() => {
        return purchaseItems.value.reduce((sum, item) => {
            const c = parseFloat(String(item.cost || 0));
            return sum + (isNaN(c) ? 0 : c);
        }, 0);
    });

    const totalBoutiqueValue = computed(() => {
        return purchaseItems.value.reduce((sum, item) => {
            const b = parseItemBoutiquePrice(item);
            return sum + b;
        }, 0);
    });

    const totalFairValue = computed(() => {
        return purchaseItems.value.reduce((sum, item) => {
            const r = parseFloat(String(item.resalePrice || 0));
            return sum + (isNaN(r) ? 0 : r);
        }, 0);
    });

    const projectedProfit = computed(() => {
        return Math.max(0, totalBoutiqueValue.value - totalCost.value);
    });

    const roiMultiple = computed(() => {
        if (totalCost.value <= 0) return totalBoutiqueValue.value > 0 ? '∞' : '0.0x';
        return `${(totalBoutiqueValue.value / totalCost.value).toFixed(1)}x`;
    });

    const profitMargin = computed(() => {
        if (totalBoutiqueValue.value <= 0) return 0;
        return Math.round(((totalBoutiqueValue.value - totalCost.value) / totalBoutiqueValue.value) * 100);
    });

    const tierBreakdown = computed(() => {
        let showcase = 0;
        let core = 0;
        let quickTurn = 0;

        purchaseItems.value.forEach(item => {
            const raw = (item.rawAnalysis || '').toLowerCase();
            const title = (item.title || '').toLowerCase();
            if (raw.includes('"tier":"showcase"') || raw.includes('tier 1') || title.includes('showcase')) {
                showcase++;
            } else if (raw.includes('"tier":"quick_turn"') || raw.includes('tier 3') || title.includes('quick turn')) {
                quickTurn++;
            } else {
                core++;
            }
        });

        return { showcase, core, quickTurn };
    });

    // -- Helper Utilities --
    function isItemLot(item: ScoutPurchaseItem): boolean {
        if (item.isLot) return true;
        if (item.conditionNotes && (item.conditionNotes.includes('[LOT_BUNDLE]') || item.conditionNotes.includes('[LOT]'))) return true;
        if (item.title && (item.title.startsWith('📦 Lot:') || item.title.startsWith('[LOT]'))) return true;
        if (item.rawAnalysis) {
            try {
                const parsed = JSON.parse(item.rawAnalysis);
                const target = Array.isArray(parsed) ? parsed[0] : parsed;
                if (target?.isLot || (target?.lot_items && target.lot_items.length > 0)) return true;
            } catch (e) {}
        }
        return false;
    }

    function parseItemBoutiquePrice(item: ScoutPurchaseItem): number {
        if (item.boutiquePrice && !isNaN(Number(item.boutiquePrice))) {
            return Number(item.boutiquePrice);
        }
        if (item.rawAnalysis) {
            try {
                const parsed = JSON.parse(item.rawAnalysis);
                const target = Array.isArray(parsed) ? parsed[0] : parsed;
                if (target?.boutiquePrice && !isNaN(Number(target.boutiquePrice))) {
                    return Number(target.boutiquePrice);
                }
                const bStr = target?.pricing_potential?.boutique || target?.price_breakdown?.boutique_premium;
                if (bStr) {
                    const clean = String(bStr).replace(/[^0-9.]/g, '');
                    const val = parseFloat(clean);
                    if (!isNaN(val)) return val;
                }
            } catch (e) {}
        }
        if (item.conditionNotes) {
            const match = item.conditionNotes.match(/\[Boutique:\s*\$([0-9.]+)\]/i);
            if (match) {
                const val = parseFloat(match[1]);
                if (!isNaN(val)) return val;
            }
        }
        if (item.resalePrice && !isNaN(Number(item.resalePrice))) {
            return Number(item.resalePrice);
        }
        return 0;
    }

    // -- Actions --

    /**
     * List all draft/in-progress purchases for current user/tenant
     */
    const loadDraftPurchases = async () => {
        loading.value = true;
        error.value = null;
        try {
            const queries = [
                Query.equal('status', 'Draft'),
                Query.orderDesc('$createdAt'),
                Query.limit(50)
            ];

            const tenantId = currentTeam.value?.$id;
            if (tenantId) {
                queries.push(Query.equal('tenantId', tenantId));
            } else if (user.value) {
                queries.push(Query.equal('buyerId', user.value.$id));
            }

            let res = await databases.listDocuments(DB_ID, PURCHASES_COL, queries);
            let rawDocs = res.documents as unknown as ScoutPurchase[];

            // Fallback: if tenant or buyer filter returned 0, load recent drafts so POs are never missing
            if (rawDocs.length === 0 && (tenantId || user.value)) {
                try {
                    const fallbackRes = await databases.listDocuments(DB_ID, PURCHASES_COL, [
                        Query.equal('status', 'Draft'),
                        Query.orderDesc('$createdAt'),
                        Query.limit(50)
                    ]);
                    if (fallbackRes.documents && fallbackRes.documents.length > 0) {
                        rawDocs = fallbackRes.documents as unknown as ScoutPurchase[];
                    }
                } catch (fbErr) {
                    console.warn('[useScoutPurchase] Drafts fallback query error:', fbErr);
                }
            }

            const docs = rawDocs.sort((a, b) => {
                const timeA = new Date(a.$updatedAt || a.purchaseDate || a.$createdAt || 0).getTime();
                const timeB = new Date(b.$updatedAt || b.purchaseDate || b.$createdAt || 0).getTime();
                return timeB - timeA;
            });

            // Set immediately so PO cards render instantly with zero lag or empty states
            draftPurchases.value = docs;

            // Hydrate item counts for all draft purchases so inactive trackers never display 0
            if (docs.length > 0) {
                const collId = getItemsCollectionId();
                const countMap: Record<string, number> = {};

                try {
                    // Fetch recent items (guaranteed to succeed without index issues)
                    const recentItems = await databases.listDocuments(DB_ID, collId, [
                        Query.orderDesc('$createdAt'),
                        Query.limit(100)
                    ]);
                    recentItems.documents.forEach((item: any) => {
                        const pid = item.purchaseId || item.cartId;
                        if (pid) {
                            countMap[pid] = (countMap[pid] || 0) + 1;
                        }
                    });
                } catch (recErr) {
                    console.warn('[useScoutPurchase] Recent items count query fallback:', recErr);
                }

                // Map counts to each draft purchase across $id, poNumber, and orderId
                docs.forEach(d => {
                    const count = countMap[d.$id] || 
                                  (d.poNumber ? countMap[d.poNumber] : 0) || 
                                  (d.orderId ? countMap[d.orderId] : 0) || 
                                  d.itemCount || 
                                  0;
                    d.itemCount = count;
                });

                // If activePurchase is currently in memory, ensure its live item count takes precedence
                if (activePurchase.value) {
                    const activeMatch = docs.find(d => d.$id === activePurchase.value?.$id);
                    if (activeMatch) {
                        if (purchaseItems.value.length > 0) {
                            activeMatch.itemCount = purchaseItems.value.length;
                        }
                        activePurchase.value.itemCount = activeMatch.itemCount;
                    }
                }

                // Trigger full Vue reactivity
                draftPurchases.value = [...docs];
            }

            return draftPurchases.value;
        } catch (e: any) {
            console.error('[useScoutPurchase] Failed to list draft purchases:', e);
            // Safe fallback to at least show any available drafts
            try {
                const safeRes = await databases.listDocuments(DB_ID, PURCHASES_COL, [
                    Query.equal('status', 'Draft'),
                    Query.limit(50)
                ]);
                draftPurchases.value = safeRes.documents as unknown as ScoutPurchase[];
                return draftPurchases.value;
            } catch {
                error.value = e.message;
                return [];
            }
        } finally {
            loading.value = false;
        }
    };

    /**
     * Start a new Draft Purchase
     */
    const startDraftPurchase = async (vendorName: string) => {
        loading.value = true;
        error.value = null;
        try {
            const timestamp = Date.now().toString().slice(-6);
            const teamId = currentTeam.value?.$id;
            const userId = user.value?.$id || 'guest';

            let permissions: string[] = [];
            if (teamId) {
                const role = Role.team(teamId);
                permissions = [
                    Permission.read(role),
                    Permission.update(role),
                    Permission.delete(role),
                ];
            } else if (user.value) {
                const role = Role.user(userId);
                permissions = [
                    Permission.read(role),
                    Permission.update(role),
                    Permission.delete(role),
                ];
            }

            const cleanVendor = (vendorName || 'Thrift Purchase').trim();
            const purchaseDoc = await databases.createDocument(
                DB_ID,
                PURCHASES_COL,
                ID.unique(),
                {
                    vendor: cleanVendor,
                    tenantId: teamId || null,
                    buyerId: userId,
                    purchaseDate: new Date().toISOString(),
                    status: 'Draft',
                    orderId: `SC-${timestamp}`,
                    poNumber: `PO-${timestamp}`,
                    subtotal: 0,
                    grandTotal: 0
                },
                permissions
            );

            setActivePurchase(purchaseDoc as unknown as ScoutPurchase);
            await loadDraftPurchases();
            return purchaseDoc;
        } catch (e: any) {
            console.error('[useScoutPurchase] Failed to create draft purchase:', e);
            error.value = e.message;
            throw e;
        } finally {
            loading.value = false;
        }
    };

    /**
     * Load purchase by ID and set it as active
     */
    const loadPurchaseById = async (purchaseId: string) => {
        if (!purchaseId) return null;
        loading.value = true;
        error.value = null;
        try {
            const purchaseDoc = await purchasesAPI.findPurchase(purchaseId);
            if (!purchaseDoc) throw new Error(`Purchase ${purchaseId} not found`);
            setActivePurchase(purchaseDoc as unknown as ScoutPurchase);
            return purchaseDoc as unknown as ScoutPurchase;
        } catch (e: any) {
            console.error('[useScoutPurchase] Failed to load purchase by ID:', purchaseId, e);
            error.value = e.message;
            throw e;
        } finally {
            loading.value = false;
        }
    };

    /**
     * Set active purchase and fetch its scouted line items
     */
    const setActivePurchase = async (purchase: ScoutPurchase | null) => {
        try {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
                unsubscribe = null;
            }
        } catch (e) {
            console.warn('[useScoutPurchase] Error unsubscribing:', e);
        }

        // Before resetting activePurchase, preserve the item count and subtotal of previous activePurchase in draftPurchases
        if (activePurchase.value) {
            const prevId = activePurchase.value.$id;
            const currentCount = purchaseItems.value.length;
            const match = draftPurchases.value.find(p => p.$id === prevId);
            if (match) {
                if (currentCount > 0 || activePurchase.value.itemCount !== undefined) {
                    match.itemCount = currentCount || activePurchase.value.itemCount;
                }
                if (totalCost.value > 0 || activePurchase.value.subtotal !== undefined) {
                    match.subtotal = totalCost.value || activePurchase.value.subtotal;
                    match.grandTotal = match.subtotal;
                }
            }
        }

        if (purchase) {
            lastActivePurchaseId.value = purchase.$id;
        }

        activePurchase.value = purchase;
        purchaseItems.value = [];

        if (!purchase) {
            try {
                leaveGlobalCart();
            } catch (e) {}
            return;
        }

        try {
            setGlobalActiveCart(purchase as unknown as Cart);
        } catch (e) {
            console.warn('[useScoutPurchase] Error setting global active cart:', e);
        }

        // Subscribe to real-time updates on active purchase AND items collection
        const collId = getItemsCollectionId();
        try {
            unsubscribe = client.subscribe([
                `databases.${DB_ID}.collections.${PURCHASES_COL}.documents.${purchase.$id}`,
                `databases.${DB_ID}.collections.${collId}.documents`
            ], (response) => {
                const payload = response.payload as any;
                // 1. Items real-time updates
                if (response.events.some(e => e.includes(`collections.${collId}.documents`))) {
                    if (payload && (payload.purchaseId === purchase.$id || payload.cartId === purchase.$id)) {
                        console.log('[useScoutPurchase] Real-time items event for active purchase:', payload?.title);
                        fetchPurchaseItems(purchase.$id);
                    }
                }
                // 2. Purchase document real-time updates
                if (response.events.some(e => e.includes(`collections.${PURCHASES_COL}.documents.${purchase.$id}`))) {
                    const updated = response.payload as unknown as ScoutPurchase;
                    if (updated) {
                        if (updated.itemCount === undefined && activePurchase.value?.itemCount !== undefined) {
                            updated.itemCount = activePurchase.value.itemCount;
                        }
                        activePurchase.value = { ...activePurchase.value, ...updated };
                        const idx = draftPurchases.value.findIndex(p => p.$id === updated.$id);
                        if (idx !== -1) {
                            draftPurchases.value[idx] = { ...draftPurchases.value[idx], ...updated };
                            draftPurchases.value = [...draftPurchases.value];
                        }
                    }
                }
            });
        } catch (subErr) {
            console.warn('[useScoutPurchase] Real-time subscription error:', subErr);
        }

        try {
            await fetchPurchaseItems(purchase.$id);
        } catch (fErr) {
            console.warn('[useScoutPurchase] Error fetching purchase items:', fErr);
        }
    };

    /**
     * Fetch all items and lots attached to a purchase
     */
    const fetchPurchaseItems = async (purchaseId: string) => {
        try {
            const collId = getItemsCollectionId();
            let docs: any[] = [];
            try {
                const res = await databases.listDocuments(DB_ID, collId, [
                    Query.equal('purchaseId', purchaseId),
                    Query.orderDesc('$createdAt'),
                    Query.limit(100)
                ]);
                docs = res.documents || [];
            } catch (indexErr) {}

            // If 0 documents found by exact purchaseId, check cartId, orderId, poNumber
            if (docs.length === 0) {
                const matchPurchase = draftPurchases.value.find(p => p.$id === purchaseId) || activePurchase.value;
                const found = await getItemsByPurchaseId(purchaseId, matchPurchase?.orderId, matchPurchase?.poNumber);
                if (found && found.length > 0) {
                    docs = found;
                } else {
                    try {
                        const fallback = await databases.listDocuments(DB_ID, collId, [
                            Query.orderDesc('$createdAt'),
                            Query.limit(100)
                        ]);
                        docs = fallback.documents.filter((doc: any) => 
                            doc.purchaseId === purchaseId || 
                            doc.cartId === purchaseId ||
                            (matchPurchase?.poNumber && (doc.purchaseId === matchPurchase.poNumber || doc.cartId === matchPurchase.poNumber)) ||
                            (matchPurchase?.orderId && (doc.purchaseId === matchPurchase.orderId || doc.cartId === matchPurchase.orderId))
                        );
                    } catch {}
                }
            }

            const mapped = docs.map((doc: any) => {
                let bPrice = doc.resalePrice || 0;
                let isLot = false;
                let lotCount = 0;
                if (doc.conditionNotes && (doc.conditionNotes.includes('[LOT_BUNDLE]') || doc.conditionNotes.includes('[LOT]'))) {
                    isLot = true;
                }
                if (doc.title && (doc.title.startsWith('📦 Lot:') || doc.title.startsWith('[LOT]'))) {
                    isLot = true;
                }
                if (doc.rawAnalysis) {
                    try {
                        const parsed = JSON.parse(doc.rawAnalysis);
                        const target = Array.isArray(parsed) ? parsed[0] : parsed;
                        if (target?.boutiquePrice && !isNaN(Number(target.boutiquePrice))) {
                            bPrice = Number(target.boutiquePrice);
                        }
                        if (target?.isLot || (target?.lot_items && target.lot_items.length > 0)) {
                            isLot = true;
                            lotCount = target?.lot_items?.length || 0;
                        }
                    } catch (e) {}
                }
                if (!bPrice && doc.conditionNotes) {
                    const match = doc.conditionNotes.match(/\[Boutique:\s*\$([0-9.]+)\]/i);
                    if (match) bPrice = parseFloat(match[1]);
                }
                return {
                    ...doc,
                    boutiquePrice: bPrice || doc.resalePrice || 0,
                    isLot,
                    lotItemsCount: lotCount
                } as ScoutPurchaseItem;
            });

            // Preserve freshly added items that have this purchaseId but haven't appeared in the list query yet
            const existingFresh = purchaseItems.value.filter(existing => 
                existing.purchaseId === purchaseId && !mapped.some(m => m.$id === existing.$id)
            );
            purchaseItems.value = [...existingFresh, ...mapped];

            // Sync with global cartItems
            cartItems.value = purchaseItems.value as unknown as CartItem[];

            // Sync item count and subtotal on active and draft purchases so inactives stay accurate
            const currentCount = purchaseItems.value.length;
            const currentSubtotal = totalCost.value;
            if (activePurchase.value && activePurchase.value.$id === purchaseId) {
                activePurchase.value.itemCount = currentCount;
                activePurchase.value.subtotal = currentSubtotal;
                activePurchase.value.grandTotal = currentSubtotal;
            }
            const match = draftPurchases.value.find(p => p.$id === purchaseId);
            if (match) {
                match.itemCount = currentCount;
                match.subtotal = currentSubtotal;
                match.grandTotal = currentSubtotal;
                draftPurchases.value = [...draftPurchases.value];
            }
        } catch (e: any) {
            console.error('[useScoutPurchase] Failed to fetch purchase items:', e);
        }
    };

    /**
     * Add single item to current active purchase
     */
    const addItemToPurchase = async (itemData: {
        title: string;
        cost?: number | string;
        resalePrice?: number | string;
        boutiquePrice?: number | string;
        imageId?: string | null;
        rawAnalysis?: any;
        conditionNotes?: string;
        tier?: string;
    }) => {
        if (!activePurchase.value) throw new Error("No active purchase selected");

        loading.value = true;
        try {
            const teamId = activePurchase.value.tenantId;
            let permissions: string[] = [];
            if (user.value) {
                const userRole = Role.user(user.value.$id);
                permissions.push(Permission.read(userRole), Permission.update(userRole), Permission.delete(userRole));
            }
            if (teamId) {
                try {
                    const teamRole = Role.team(teamId);
                    permissions.push(Permission.read(teamRole), Permission.update(teamRole), Permission.delete(teamRole));
                } catch (e) {}
            }

            const cleanCost = parseFloat(String(itemData.cost || 0)) || 0;
            const cleanResale = parseFloat(String(itemData.resalePrice || 0)) || 0;
            const cleanBoutique = parseFloat(String(itemData.boutiquePrice || cleanResale)) || 0;

            let rawObj: any = {};
            if (typeof itemData.rawAnalysis === 'string') {
                try {
                    rawObj = JSON.parse(itemData.rawAnalysis);
                } catch {
                    rawObj = { raw: itemData.rawAnalysis };
                }
            } else if (itemData.rawAnalysis && typeof itemData.rawAnalysis === 'object') {
                rawObj = { ...itemData.rawAnalysis };
            }
            rawObj.boutiquePrice = cleanBoutique;
            if (itemData.tier) rawObj.tier = itemData.tier;

            const safeRaw = JSON.stringify(rawObj).slice(0, 4900);
            const notes = (itemData.conditionNotes || '') + (cleanBoutique ? `\n[Boutique: $${cleanBoutique.toFixed(2)}]` : '');

            const payload: any = {
                title: itemData.title,
                identity: itemData.title,
                cost: cleanCost,
                resalePrice: cleanResale,
                imageId: itemData.imageId || null,
                purchaseId: activePurchase.value.$id,
                cartId: activePurchase.value.$id,
                tenantId: teamId || null,
                status: 'draft',
                rawAnalysis: safeRaw,
                conditionNotes: notes.slice(0, 4900)
            };

            Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

            const doc = await databases.createDocument(
                DB_ID,
                getItemsCollectionId(),
                ID.unique(),
                payload,
                permissions.length > 0 ? permissions : undefined
            );

            const purchaseItem: ScoutPurchaseItem = {
                ...(doc as unknown as ScoutPurchaseItem),
                boutiquePrice: cleanBoutique,
                isLot: false,
                lotItemsCount: 0
            };

            purchaseItems.value.unshift(purchaseItem);
            if (!cartItems.value.some(i => i.$id === doc.$id)) {
                cartItems.value.unshift(purchaseItem as unknown as CartItem);
            }

            // Update subtotal and itemCount on purchase record
            const newSubtotal = totalCost.value;
            const newCount = purchaseItems.value.length;
            try {
                await databases.updateDocument(DB_ID, PURCHASES_COL, activePurchase.value.$id, {
                    subtotal: newSubtotal,
                    grandTotal: newSubtotal,
                    itemCount: newCount
                });
            } catch (upErr) {
                console.warn('[useScoutPurchase] Failed to update purchase record:', upErr);
            }

            if (activePurchase.value) {
                activePurchase.value.itemCount = newCount;
                activePurchase.value.subtotal = newSubtotal;
                activePurchase.value.grandTotal = newSubtotal;
                const match = draftPurchases.value.find(p => p.$id === activePurchase.value!.$id);
                if (match) {
                    match.itemCount = newCount;
                    match.subtotal = newSubtotal;
                    match.grandTotal = newSubtotal;
                    draftPurchases.value = [...draftPurchases.value];
                }
            }

            return purchaseItem;
        } catch (e: any) {
            console.error('[useScoutPurchase] Failed to add item to purchase:', e);
            throw e;
        } finally {
            loading.value = false;
        }
    };

    /**
     * Add entire lot / bundle to current active purchase
     */
    const addLotToPurchase = async (lotData: {
        title: string;
        lotCost?: number | string;
        totalEstValue?: number | string;
        boutiqueValue?: number | string;
        lotItems: any[];
        imageId?: string | null;
        rawAnalysis?: any;
        conditionNotes?: string;
    }) => {
        if (!activePurchase.value) throw new Error("No active purchase selected");

        loading.value = true;
        try {
            const teamId = activePurchase.value.tenantId;
            let permissions: string[] = [];
            if (user.value) {
                const userRole = Role.user(user.value.$id);
                permissions.push(Permission.read(userRole), Permission.update(userRole), Permission.delete(userRole));
            }
            if (teamId) {
                try {
                    const teamRole = Role.team(teamId);
                    permissions.push(Permission.read(teamRole), Permission.update(teamRole), Permission.delete(teamRole));
                } catch (e) {}
            }

            const cleanCost = parseFloat(String(lotData.lotCost || 0)) || 0;
            const cleanResale = parseFloat(String(lotData.totalEstValue || 0)) || 0;
            const cleanBoutique = parseFloat(String(lotData.boutiqueValue || cleanResale)) || 0;
            const lotCount = lotData.lotItems?.length || 0;

            let rawObj: any = {};
            if (typeof lotData.rawAnalysis === 'string') {
                try {
                    rawObj = JSON.parse(lotData.rawAnalysis);
                } catch {
                    rawObj = { raw: lotData.rawAnalysis };
                }
            } else if (lotData.rawAnalysis && typeof lotData.rawAnalysis === 'object') {
                rawObj = { ...lotData.rawAnalysis };
            }
            rawObj.isLot = true;
            rawObj.lot_items = lotData.lotItems;
            rawObj.boutiquePrice = cleanBoutique;

            const safeRaw = JSON.stringify(rawObj).slice(0, 4900);
            const notes = (lotData.conditionNotes ? `${lotData.conditionNotes}\n` : '') +
                `[LOT_BUNDLE: ${lotCount} items]\n` +
                (lotData.lotItems || []).map((li, idx) => `${idx + 1}. ${li.name || li.title || li.identity} ($${li.estimated_value || '0'})`).join('\n') +
                (cleanBoutique ? `\n[Boutique: $${cleanBoutique.toFixed(2)}]` : '');

            const lotPayload: any = {
                title: `📦 Lot: ${lotData.title} (${lotCount} items)`,
                identity: lotData.title,
                cost: cleanCost,
                resalePrice: cleanResale,
                imageId: lotData.imageId || null,
                purchaseId: activePurchase.value.$id,
                cartId: activePurchase.value.$id,
                tenantId: teamId || null,
                status: 'draft',
                components: lotData.lotItems ? JSON.stringify(lotData.lotItems).slice(0, 65000) : undefined,
                conditionNotes: notes.slice(0, 4900),
                rawAnalysis: safeRaw
            };

            Object.keys(lotPayload).forEach(key => lotPayload[key] === undefined && delete lotPayload[key]);

            const doc = await databases.createDocument(
                DB_ID,
                getItemsCollectionId(),
                ID.unique(),
                lotPayload,
                permissions.length > 0 ? permissions : undefined
            );

            const purchaseItem: ScoutPurchaseItem = {
                ...(doc as unknown as ScoutPurchaseItem),
                boutiquePrice: cleanBoutique,
                isLot: true,
                lotItemsCount: lotCount
            };

            purchaseItems.value.unshift(purchaseItem);
            if (!cartItems.value.some(i => i.$id === doc.$id)) {
                cartItems.value.unshift(purchaseItem as unknown as CartItem);
            }

            // Update subtotal and itemCount on purchase record
            const newSubtotal = totalCost.value;
            const newCount = purchaseItems.value.length;
            try {
                await databases.updateDocument(DB_ID, PURCHASES_COL, activePurchase.value.$id, {
                    subtotal: newSubtotal,
                    grandTotal: newSubtotal,
                    itemCount: newCount
                });
            } catch (upErr) {
                console.warn('[useScoutPurchase] Failed to update purchase record:', upErr);
            }

            if (activePurchase.value) {
                activePurchase.value.itemCount = newCount;
                activePurchase.value.subtotal = newSubtotal;
                activePurchase.value.grandTotal = newSubtotal;
                const match = draftPurchases.value.find(p => p.$id === activePurchase.value!.$id);
                if (match) {
                    match.itemCount = newCount;
                    match.subtotal = newSubtotal;
                    match.grandTotal = newSubtotal;
                    draftPurchases.value = [...draftPurchases.value];
                }
            }

            return purchaseItem;
        } catch (e: any) {
            console.error('[useScoutPurchase] Failed to add lot to purchase:', e);
            throw e;
        } finally {
            loading.value = false;
        }
    };

    /**
     * Remove item or lot from purchase
     */
    const removeItemFromPurchase = async (itemId: string, purchaseId?: string) => {
        const targetPurchaseId = purchaseId || activePurchase.value?.$id;
        if (!targetPurchaseId) return;
        loading.value = true;
        try {
            // Find item first to get image assets
            const item = purchaseItems.value.find(i => i.$id === itemId);
            if (item) {
                const bucketId = import.meta.env.PUBLIC_APPWRITE_BUCKET_ID || 'item_images';
                if (item.imageId) {
                    try {
                        await storage.deleteFile(bucketId, item.imageId);
                    } catch (e) {}
                }
                if (item.galleryImageIds && Array.isArray(item.galleryImageIds)) {
                    for (const gid of item.galleryImageIds) {
                        try {
                            await storage.deleteFile(bucketId, gid);
                        } catch (e) {}
                    }
                }
            }

            await databases.deleteDocument(DB_ID, getItemsCollectionId(), itemId);
            purchaseItems.value = purchaseItems.value.filter(i => i.$id !== itemId);
            cartItems.value = cartItems.value.filter(i => i.$id !== itemId);

            const newSubtotal = totalCost.value;
            await databases.updateDocument(DB_ID, PURCHASES_COL, targetPurchaseId, {
                subtotal: newSubtotal,
                grandTotal: newSubtotal,
                itemCount: purchaseItems.value.length
            });

            if (activePurchase.value && activePurchase.value.$id === targetPurchaseId) {
                activePurchase.value.itemCount = purchaseItems.value.length;
                activePurchase.value.subtotal = newSubtotal;
                activePurchase.value.grandTotal = newSubtotal;
            }
            const match = draftPurchases.value.find(p => p.$id === targetPurchaseId);
            if (match) {
                match.itemCount = purchaseItems.value.length;
                match.subtotal = newSubtotal;
                match.grandTotal = newSubtotal;
                draftPurchases.value = [...draftPurchases.value];
            }
        } catch (e: any) {
            console.error('[useScoutPurchase] Failed to remove item:', e);
            throw e;
        } finally {
            loading.value = false;
        }
    };

    /**
     * Complete the purchase ("Purchase It")
     * Marks purchase as 'Received' and promotes all items from 'draft' to 'received'
     */
    const completePurchase = async (purchaseId?: string) => {
        const targetId = purchaseId || activePurchase.value?.$id;
        if (!targetId) throw new Error("No purchase ID provided");

        loading.value = true;
        try {
            const finalSubtotal = totalCost.value;

            // 1. Update purchase document status to 'Received'
            await databases.updateDocument(DB_ID, PURCHASES_COL, targetId, {
                status: 'Received',
                subtotal: finalSubtotal,
                grandTotal: finalSubtotal
            });

            // 2. Promote all items from 'draft' to 'received'
            const itemColl = getItemsCollectionId();
            const updatePromises = purchaseItems.value.map(item => {
                return databases.updateDocument(DB_ID, itemColl, item.$id, {
                    status: 'received'
                }).catch(err => {
                    console.warn(`[useScoutPurchase] Item status promotion warning for ${item.$id}:`, err);
                });
            });

            await Promise.allSettled(updatePromises);

            // Clean active selection
            setActivePurchase(null);
            await loadDraftPurchases();

            return targetId;
        } catch (e: any) {
            console.error('[useScoutPurchase] Failed to complete purchase:', e);
            throw e;
        } finally {
            loading.value = false;
        }
    };

    /**
     * Discard draft purchase if walked away
     * Permanently deletes tracker, all items, and associated image assets in Storage
     */
    const discardPurchase = async (purchaseId?: string) => {
        const targetId = purchaseId || activePurchase.value?.$id;
        if (!targetId) return;

        loading.value = true;
        try {
            const itemColl = getItemsCollectionId();
            const bucketId = import.meta.env.PUBLIC_APPWRITE_BUCKET_ID || 'item_images';

            // 1. Fetch all items attached to this purchase across purchaseId and cartId
            let itemsToDelete: any[] = [...purchaseItems.value];
            try {
                const res = await databases.listDocuments(DB_ID, itemColl, [
                    Query.equal('purchaseId', targetId),
                    Query.limit(100)
                ]);
                if (res.documents && res.documents.length > 0) {
                    res.documents.forEach((doc: any) => {
                        if (!itemsToDelete.some(i => i.$id === doc.$id)) {
                            itemsToDelete.push(doc);
                        }
                    });
                }
            } catch (err) {
                console.warn('[useScoutPurchase] Query items before discard warning:', err);
            }

            // 2. Delete all items and their associated image files from Storage
            const deletePromises = itemsToDelete.map(async item => {
                // Delete primary image from Storage if present
                if (item.imageId) {
                    try {
                        await storage.deleteFile(bucketId, item.imageId);
                    } catch (imgErr) {
                        console.warn(`[useScoutPurchase] Storage image delete warning (${item.imageId}):`, imgErr);
                    }
                }
                // Delete gallery images from Storage if present
                if (item.galleryImageIds && Array.isArray(item.galleryImageIds)) {
                    for (const gid of item.galleryImageIds) {
                        try {
                            await storage.deleteFile(bucketId, gid);
                        } catch (gErr) {
                            console.warn(`[useScoutPurchase] Storage gallery image delete warning (${gid}):`, gErr);
                        }
                    }
                }
                // Delete the database item document
                try {
                    await databases.deleteDocument(DB_ID, itemColl, item.$id);
                } catch (docErr) {
                    console.warn(`[useScoutPurchase] Failed to delete item document ${item.$id}:`, docErr);
                }
            });
            await Promise.allSettled(deletePromises);

            // 3. Delete the tracker / purchase document
            try {
                await databases.deleteDocument(DB_ID, PURCHASES_COL, targetId);
            } catch (pDelErr) {
                console.warn('[useScoutPurchase] Hard delete failed, attempting cancellation update:', pDelErr);
                try {
                    await databases.updateDocument(DB_ID, PURCHASES_COL, targetId, { status: 'Cancelled' });
                } catch {}
            }

            // 4. Clean active & draft state in memory
            if (activePurchase.value?.$id === targetId) {
                activePurchase.value = null;
            }
            if (lastActivePurchaseId.value === targetId) {
                lastActivePurchaseId.value = null;
            }
            draftPurchases.value = draftPurchases.value.filter(p => p.$id !== targetId);
            purchaseItems.value = [];

            // 5. Clean URL query param if active
            try {
                if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    if (url.searchParams.get('purchase') === targetId) {
                        url.searchParams.delete('purchase');
                        window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
                    }
                }
            } catch (urlErr) {}

            await loadDraftPurchases();
        } catch (e: any) {
            console.error('[useScoutPurchase] Failed to discard purchase:', e);
            throw e;
        } finally {
            loading.value = false;
        }
    };

    /**
     * Update the title / vendor of a purchase
     */
    const updatePurchaseTitle = async (purchaseId: string, newTitle: string): Promise<boolean> => {
        const cleanTitle = newTitle?.trim();
        if (!cleanTitle || !purchaseId) return false;
        try {
            await databases.updateDocument(DB_ID, PURCHASES_COL, purchaseId, {
                vendor: cleanTitle
            });
            if (activePurchase.value && activePurchase.value.$id === purchaseId) {
                activePurchase.value.vendor = cleanTitle;
            }
            const match = draftPurchases.value.find(p => p.$id === purchaseId);
            if (match) {
                match.vendor = cleanTitle;
                match.$updatedAt = new Date().toISOString();
                draftPurchases.value = [...draftPurchases.value];
            }
            return true;
        } catch (e: any) {
            console.error('[useScoutPurchase] Failed to update purchase title:', e);
            throw e;
        }
    };

    /**
     * Refresh purchase items for active purchase
     */
    const refreshActivePurchaseItems = async () => {
        if (!activePurchase.value?.$id) return;
        await fetchPurchaseItems(activePurchase.value.$id);
    };

    const toggleTray = (open?: boolean) => {
        isTrayOpen.value = typeof open === 'boolean' ? open : !isTrayOpen.value;
    };

    const pausedTracker = computed(() => {
        if (activePurchase.value || draftPurchases.value.length === 0) return null;
        if (lastActivePurchaseId.value) {
            const found = draftPurchases.value.find(p => p.$id === lastActivePurchaseId.value);
            if (found) return found;
        }
        return draftPurchases.value[0] || null;
    });

    const pauseTracker = () => {
        if (activePurchase.value) {
            lastActivePurchaseId.value = activePurchase.value.$id;
        }
        setActivePurchase(null);
        try {
            if (typeof window !== 'undefined') {
                const url = new URL(window.location.href);
                if (url.searchParams.has('purchase')) {
                    url.searchParams.delete('purchase');
                    window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
                }
            }
        } catch (e) {}
    };

    const resumeTracker = async (purchase?: ScoutPurchase | null) => {
        const target = purchase || pausedTracker.value || (draftPurchases.value.length > 0 ? draftPurchases.value[0] : null);
        if (!target) return null;
        await setActivePurchase(target);
        try {
            if (typeof window !== 'undefined') {
                const url = new URL(window.location.href);
                url.searchParams.set('purchase', target.$id);
                window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
            }
        } catch (e) {}
        return target;
    };

    return {
        // State
        activePurchase,
        purchaseItems,
        draftPurchases,
        pausedTracker,
        lastActivePurchaseId,
        isTrayOpen,
        loading,
        error,

        // Manifest & Computed Metrics
        singleItems,
        lotItems,
        totalCost,
        totalBoutiqueValue,
        totalFairValue,
        projectedProfit,
        roiMultiple,
        profitMargin,
        tierBreakdown,

        // Actions
        toggleTray,
        loadDraftPurchases,
        loadPurchaseById,
        startDraftPurchase,
        setActivePurchase,
        pauseTracker,
        resumeTracker,
        fetchPurchaseItems,
        refreshActivePurchaseItems,
        updatePurchaseTitle,
        addItemToPurchase,
        addLotToPurchase,
        removeItemFromPurchase,
        completePurchase,
        discardPurchase
    };
}
