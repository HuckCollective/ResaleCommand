import { databases, storage, Query, ID } from './appwrite';
import { Permission, Role, type Models } from 'appwrite';
import { saveItemToInventory } from './inventory';
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
    
    async getPurchase(documentId: string) {
        return await databases.getDocument(DB_ID, getPurchasesCollectionId(), documentId);
    },

    async deletePurchase(documentId: string) {
        return await databases.deleteDocument(DB_ID, getPurchasesCollectionId(), documentId);
    },

    async listPurchases(queries = []) {
        return await databases.listDocuments(DB_ID, getPurchasesCollectionId(), queries);
    },

    /**
     * Centralized, all-in-one Purchase Order saver:
     * 1. Guarantees timestamped PO Number & Order ID across the board
     * 2. Handles receipt photo upload to storage
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
        if (!receiptImageId && payload.receiptFile && payload.receiptFile.size > 0) {
            try {
                const BUCKET_ID = import.meta.env.PUBLIC_APPWRITE_BUCKET_ID || 'item_images';
                const upload = await storage.createFile(BUCKET_ID, ID.unique(), payload.receiptFile);
                receiptImageId = upload.$id;
            } catch (upErr) {
                console.warn('[Purchases] Receipt image upload warning:', upErr);
            }
        }

        // 2. Separate lines into resale and expense
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
                        storageLocation: 'backstock',
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
