import { databases, Query, ID } from './appwrite';
import type { Models } from 'appwrite';
import { warehousesApi } from './warehouses';

const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
const SALES_COL = 'sales';

export interface SaleData {
    soNumber: string;
    warehouseId: string;
    orderId?: string;
    saleDate?: string;
    status: string;
    grossAmount: number;
    shippingCharged?: number;
    shippingCost?: number;
    commissionFee?: number;
    netPayout: number;
    tenantId: string;
}

export type SaleDocument = SaleData & Models.Document;

export const salesApi = {
    async listSales(tenantId: string): Promise<SaleDocument[]> {
        if (!tenantId) throw new Error("tenantId is required");
        
        const response = await databases.listDocuments(
            DB_ID,
            SALES_COL,
            [
                Query.equal('tenantId', tenantId),
                Query.orderDesc('saleDate'),
                Query.limit(100)
            ]
        );
        return response.documents as SaleDocument[];
    },

    async getSale(id: string): Promise<SaleDocument> {
        return await databases.getDocument(DB_ID, SALES_COL, id) as SaleDocument;
    },

    async generateSoNumber(tenantId: string): Promise<string> {
        const response = await databases.listDocuments(DB_ID, SALES_COL, [
            Query.equal('tenantId', tenantId),
            Query.orderDesc('soNumber'),
            Query.limit(1)
        ]);

        if (response.documents.length === 0) return 'SO-1000';
        
        const lastSo = response.documents[0].soNumber as string;
        const match = lastSo.match(/SO-(\d+)/);
        if (match) {
            return `SO-${parseInt(match[1], 10) + 1}`;
        }
        return `SO-${Date.now().toString().slice(-4)}`;
    },

    async createSale(data: SaleData): Promise<SaleDocument> {
        return await databases.createDocument(
            DB_ID,
            SALES_COL,
            ID.unique(),
            data
        ) as SaleDocument;
    },

    async updateSale(id: string, data: Partial<SaleData>): Promise<SaleDocument> {
        return await databases.updateDocument(
            DB_ID,
            SALES_COL,
            id,
            data
        ) as SaleDocument;
    },

    async deleteSale(id: string): Promise<void> {
        await databases.deleteDocument(DB_ID, SALES_COL, id);
    },

    // Link inventory items to this sale
    async linkItemsToSale(saleId: string, itemIds: string[], warehouseId: string, itemsColId: string): Promise<void> {
        for (const itemId of itemIds) {
            await databases.updateDocument(DB_ID, itemsColId, itemId, { 
                saleId: saleId,
                status: 'sold',
                warehouseId: warehouseId
            });
        }
    }
};
