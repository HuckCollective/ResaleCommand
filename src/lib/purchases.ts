import { databases, storage, Query, ID } from './appwrite';
import { Permission, Role, type Models } from 'appwrite';
import { saveItemToInventory, BUCKET_ID } from './inventory';
import { isAlphaMode } from '../stores/env';

export const getPurchasesCollectionId = () => import.meta.env.PUBLIC_APPWRITE_PURCHASES_COLLECTION_ID || 'purchases_dev';
const getItemsCollectionId = () => isAlphaMode.get() 
    ? (import.meta.env.PUBLIC_APPWRITE_ALPHA_COLLECTION_ID || 'alpha_items') 
    : (import.meta.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items');

const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';

export interface PurchaseData {
    poNumber?: string;
    orderId?: string;
    vendor?: string;
    purchaseDate?: string;
    trackingNumber?: string;
    subtotal?: number;
    shippingTotal?: number;
    handlingTotal?: number;
    taxTotal?: number;
    feeTotal?: number;
    grandTotal?: number;
    status?: string;
    tenantId?: string;
    buyerId?: string;
    receiptImageId?: string;
}

export interface PurchaseLineItem {
    title: string;
    cost?: number | string | null;
    quantity?: number | string | null;
    type?: 'resale' | 'expense' | string;
    linkedItemId?: string | null;
}

export interface SavePurchaseOrderPayload {
    purchaseId?: string | null;
    poNumber?: string;
    orderId?: string;
    vendor?: string;
    purchaseDate?: string;
    status?: string;
    subtotal?: number;
    feeTotal?: number;
    grandTotal?: number;
    tenantId?: string | null;
    receiptImageId?: string | null;
    receiptFile?: File | null;
    items?: PurchaseLineItem[];
}

export const purchasesAPI = {
    async createPurchase(data: PurchaseData, permissions?: string[]) {
        if (!data.poNumber) {
            data.poNumber = `PO-${Date.now().toString().slice(-6)}`;
        }
        if (!data.orderId) {
            data.orderId = data.poNumber || `PO-${Date.now().toString().slice(-6)}`;
        }
        if (data.purchaseDate) {
            try {
                data.purchaseDate = new Date(data.purchaseDate).toISOString();
            } catch {
                data.purchaseDate = new Date().toISOString();
            }
        } else {
            data.purchaseDate = new Date().toISOString();
        }

        let perms = permissions;
        if (!perms && data.tenantId) {
            const role = Role.team(data.tenantId);
            perms = [
                Permission.read(role),
                Permission.update(role),
                Permission.delete(role),
            ];
        }

        // Remove undefined keys to satisfy Appwrite strict schema
        Object.keys(data).forEach(key => (data as any)[key] === undefined && delete (data as any)[key]);
        return await databases.createDocument(DB_ID, getPurchasesCollectionId(), ID.unique(), data, perms);
    },

    async updatePurchase(documentId: string, data: Partial<PurchaseData>) {
        if (data.purchaseDate) {
            try {
                data.purchaseDate = new Date(data.purchaseDate).toISOString();
            } catch {
                delete data.purchaseDate;
            }
        }
        Object.keys(data).forEach(key => (data as any)[key] === undefined && delete (data as any)[key]);
        return await databases.updateDocument(DB_ID, getPurchasesCollectionId(), documentId, data);
    },

    async getPurchaseByOrderId(orderId: string) {
        const res = await databases.listDocuments(DB_ID, getPurchasesCollectionId(), [
            Query.equal('orderId', orderId),
            Query.limit(1)
        ]);
        return res.documents.length > 0 ? res.documents[0] : null;
    },

    async getPurchaseByPoNumber(poNumber: string) {
        if (!poNumber) return null;
        try {
            const res = await databases.listDocuments(DB_ID, getPurchasesCollectionId(), [
                Query.equal('poNumber', poNumber.trim()),
                Query.limit(1)
            ]);
            return res.documents.length > 0 ? res.documents[0] : null;
        } catch {
            return null;
        }
    },

    /**
     * Resolves a purchase document whether given an Appwrite document $id,
     * a poNumber (e.g. 'PO-123456'), or an orderId (e.g. 'SC-123456' or SGW order #).
     */
    async findPurchase(identifier: string) {
        if (!identifier) return null;
        const cleanId = String(identifier).trim();

        // 1. Try direct getDocument (Appwrite document ID lookup)
        try {
            const doc = await databases.getDocument(DB_ID, getPurchasesCollectionId(), cleanId);
            if (doc) return doc;
        } catch (err) {
            // Not a valid doc ID or not found, fall through
        }

        // 2. Try poNumber query
        try {
            const poRes = await databases.listDocuments(DB_ID, getPurchasesCollectionId(), [
                Query.equal('poNumber', cleanId),
                Query.limit(1)
            ]);
            if (poRes.documents.length > 0) return poRes.documents[0];
        } catch (err) {}

        // 3. Try orderId query
        try {
            const orderRes = await databases.listDocuments(DB_ID, getPurchasesCollectionId(), [
                Query.equal('orderId', cleanId),
                Query.limit(1)
            ]);
            if (orderRes.documents.length > 0) return orderRes.documents[0];
        } catch (err) {}

        // 4. Case-insensitive fallback across recent purchases
        try {
            const recentRes = await databases.listDocuments(DB_ID, getPurchasesCollectionId(), [
                Query.orderDesc('$createdAt'),
                Query.limit(100)
            ]);
            const lower = cleanId.toLowerCase();
            const matched = recentRes.documents.find((d: any) => 
                (d.poNumber && d.poNumber.toLowerCase() === lower) ||
                (d.orderId && d.orderId.toLowerCase() === lower) ||
                (d.$id && d.$id.toLowerCase() === lower)
            );
            if (matched) return matched;
        } catch (err) {}

        return null;
    },
    
    async getPurchase(documentId: string) {
        return await databases.getDocument(DB_ID, getPurchasesCollectionId(), documentId);
    },

    async deletePurchase(documentId: string) {
        // Clean up attached receipt image from storage bucket to prevent orphan files
        try {
            const doc = await purchasesAPI.findPurchase(documentId) || await databases.getDocument(DB_ID, getPurchasesCollectionId(), documentId).catch(() => null);
            if (doc && doc.receiptImageId) {
                await storage.deleteFile(BUCKET_ID, doc.receiptImageId).catch(delErr => {
                    console.warn('[Purchases] Receipt file cleanup warning:', delErr);
                });
            }
            const actualDocId = doc ? doc.$id : documentId;
            return await databases.deleteDocument(DB_ID, getPurchasesCollectionId(), actualDocId);
        } catch (e) {
            console.warn('[Purchases] Could not inspect PO before deletion, attempting direct doc deletion:', e);
            return await databases.deleteDocument(DB_ID, getPurchasesCollectionId(), documentId);
        }
    },

    async listPurchases(queries = []) {
        return await databases.listDocuments(DB_ID, getPurchasesCollectionId(), queries);
    },

    /**
     * Centralized, all-in-one Purchase Order saver:
     * 1. Guarantees timestamped PO Number & Order ID across the board
     * 2. Handles receipt photo upload to storage with automatic orphan rollback on failure
     * 3. Creates/updates PO document
     * 4. Saves resale items to inventory with unique sequential identity (e.g. PO-005817-01)
     * 5. Saves expense records to expenses collection
     */
    async savePurchaseOrder(payload: SavePurchaseOrderPayload) {
        const timestamp = Date.now().toString().slice(-6);
        const poNumber = (payload.poNumber || `PO-${timestamp}`).trim();
        const orderId = (payload.orderId || `RC-${timestamp}`).trim();
        const vendor = (payload.vendor || 'Receipt Purchase').trim();
        const status = payload.status || 'Received';
        const tenantId = payload.tenantId || null;

        // 1. Upload receipt image if file provided and not yet uploaded
        let receiptImageId = payload.receiptImageId || null;
        let newlyUploadedReceiptId: string | null = null;
        if (!receiptImageId && payload.receiptFile && payload.receiptFile.size > 0) {
            try {
                const upload = await storage.createFile(BUCKET_ID, ID.unique(), payload.receiptFile);
                receiptImageId = upload.$id;
                newlyUploadedReceiptId = upload.$id;
            } catch (upErr) {
                console.warn('[Purchases] Receipt image upload warning:', upErr);
            }
        }

        // 2. If replacing an existing receipt on an existing PO, track old file for post-save cleanup
        let oldReceiptToDelete: string | null = null;
        if (payload.purchaseId && payload.receiptFile && receiptImageId) {
            try {
                const existingDoc = await databases.getDocument(DB_ID, getPurchasesCollectionId(), payload.purchaseId).catch(() => null);
                if (existingDoc && existingDoc.receiptImageId && existingDoc.receiptImageId !== receiptImageId) {
                    oldReceiptToDelete = existingDoc.receiptImageId;
                }
            } catch (cleanupErr) {
                console.warn('[Purchases] Could not inspect existing PO for old receipt:', cleanupErr);
            }
        }

        // 3. Separate lines into resale and expense
        const validItems = (payload.items || []).filter(i => i && i.title && i.title.trim() !== '');
        const resaleLines = validItems.filter(i => i.type !== 'expense');
        const expenseLines = validItems.filter(i => i.type === 'expense');

        const calcSubtotal = resaleLines.reduce((sum, i) => sum + ((Number(i.cost) || 0) * (Number(i.quantity) || 1)), 0);
        const calcFeeTotal = expenseLines.reduce((sum, i) => sum + ((Number(i.cost) || 0) * (Number(i.quantity) || 1)), 0);
        const subtotal = payload.subtotal !== undefined ? Number(payload.subtotal) : calcSubtotal;
        const feeTotal = payload.feeTotal !== undefined ? Number(payload.feeTotal) : calcFeeTotal;
        const grandTotal = (payload.grandTotal !== undefined && !isNaN(Number(payload.grandTotal)) && Number(payload.grandTotal) > 0) 
            ? Number(payload.grandTotal) 
            : (subtotal + feeTotal);

        let finalPurchaseId: string;
        try {
            if (payload.purchaseId) {
                finalPurchaseId = payload.purchaseId;
                const updatePayload: Partial<PurchaseData> = {
                    status,
                    vendor,
                    subtotal,
                    feeTotal,
                    grandTotal
                };
                if (receiptImageId) updatePayload.receiptImageId = receiptImageId;
                await purchasesAPI.updatePurchase(finalPurchaseId, updatePayload);
            } else {
                const createPayload: PurchaseData = {
                    poNumber,
                    orderId,
                    vendor,
                    purchaseDate: payload.purchaseDate || new Date().toISOString(),
                    status,
                    subtotal,
                    feeTotal,
                    grandTotal,
                    tenantId: tenantId || undefined
                };
                if (receiptImageId) createPayload.receiptImageId = receiptImageId;
                const created = await purchasesAPI.createPurchase(createPayload);
                finalPurchaseId = created.$id;
            }
        } catch (dbErr) {
            // CRITICAL: Clean up newly uploaded file from bucket if PO creation/update failed
            if (newlyUploadedReceiptId) {
                await storage.deleteFile(BUCKET_ID, newlyUploadedReceiptId).catch(delErr => {
                    console.warn('[Purchases] Failed to rollback newly uploaded receipt:', delErr);
                });
            }
            throw dbErr;
        }

        // If PO was successfully saved and an old receipt was replaced, clean it up from bucket
        if (oldReceiptToDelete) {
            await storage.deleteFile(BUCKET_ID, oldReceiptToDelete).catch(delErr => {
                console.warn('[Purchases] Could not delete replaced old receipt from bucket:', delErr);
            });
        }

        // 3. Save or update resale items
        const itemsColId = getItemsCollectionId();
        const resalePromises = resaleLines.map(async (item, idx) => {
            if (item.linkedItemId) {
                const itemUpdatePayload: any = {
                    title: item.title,
                    cost: Number(item.cost) || 0,
                    quantity: Number(item.quantity) || 1,
                    status: 'acquired',
                    purchaseId: finalPurchaseId
                };
                if (receiptImageId) itemUpdatePayload.receiptImageId = receiptImageId;
                return databases.updateDocument(DB_ID, itemsColId, item.linkedItemId, itemUpdatePayload);
            } else {
                const seq = String(idx + 1).padStart(2, '0');
                const identity = `${poNumber}-${seq}`;
                return saveItemToInventory(
                    { title: item.title, identity },
                    null,
                    {
                        cost: Number(item.cost) || 0,
                        quantity: Number(item.quantity) || 1,
                        purchaseId: finalPurchaseId,
                        status: 'acquired',
                        storageLocation: 'HG',
                        sourcingLocation: vendor,
                        receiptImageId: receiptImageId || undefined
                    },
                    tenantId || undefined
                );
            }
        });

        // 4. Save operating expenses
        const expensePromises = expenseLines.map(async (exp) => {
            const amount = (Number(exp.cost) || 0) * (Number(exp.quantity) || 1);
            try {
                let permissions: string[] | undefined = undefined;
                if (tenantId) {
                    const role = Role.team(tenantId);
                    permissions = [
                        Permission.read(role),
                        Permission.update(role),
                        Permission.delete(role)
                    ];
                }
                return await databases.createDocument(
                    DB_ID,
                    'expenses',
                    ID.unique(),
                    {
                        purchaseId: finalPurchaseId,
                        cartId: finalPurchaseId,
                        tenantId: tenantId || 'personal',
                        amount,
                        note: exp.title,
                        date: new Date().toISOString()
                    },
                    permissions
                );
            } catch (expErr) {
                console.warn('[Purchases] Expense save warning:', expErr);
            }
        });

        const resaleResults = await Promise.allSettled(resalePromises);
        await Promise.allSettled(expensePromises);

        const failedItems = resaleResults.filter(r => r.status === 'rejected');
        if (failedItems.length > 0) {
            console.error('[Purchases] Some items failed saving:', failedItems);
        }

        return {
            purchaseId: finalPurchaseId,
            poNumber,
            resaleCount: resaleLines.length,
            expenseCount: expenseLines.length,
            failedCount: failedItems.length
        };
    }
};
