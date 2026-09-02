import { databases, Query, ID } from './appwrite';
import type { Models } from 'appwrite';

export const getPurchasesCollectionId = () => import.meta.env.PUBLIC_APPWRITE_PURCHASES_COLLECTION_ID || 'purchases_dev';
const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';

export interface PurchaseData {
    poNumber?: string;
    orderId: string;
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
}

export const purchasesAPI = {
    async createPurchase(data: PurchaseData) {
        if (!data.poNumber) {
            data.poNumber = `PO-${Date.now().toString().slice(-6)}`;
        }
        // Remove undefined keys to satisfy Appwrite strict schema
        Object.keys(data).forEach(key => (data as any)[key] === undefined && delete (data as any)[key]);
        return await databases.createDocument(DB_ID, getPurchasesCollectionId(), ID.unique(), data);
    },

    async updatePurchase(documentId: string, data: Partial<PurchaseData>) {
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
    }
};
