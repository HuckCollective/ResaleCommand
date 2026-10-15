import { databases, Query, ID } from './appwrite';
import type { Models } from 'appwrite';
import { Permission, Role } from 'appwrite';
import { warehousesApi } from './warehouses';

import { getDatabaseId, resolveCollectionId } from './appwriteEnv';

const DB_ID = getDatabaseId();
const getSalesCol = () => resolveCollectionId('sales');

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
            getSalesCol(),
            [
                Query.equal('tenantId', tenantId),
                Query.orderDesc('saleDate'),
                Query.limit(100)
            ]
        );
        return response.documents as SaleDocument[];
    },

    async getSale(id: string): Promise<SaleDocument> {
        return await databases.getDocument(DB_ID, getSalesCol(), id) as SaleDocument;
    },

    async generateSoNumber(tenantId: string): Promise<string> {
        const response = await databases.listDocuments(DB_ID, getSalesCol(), [
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
        try {
            let permissions: string[] = [];
            if (data.tenantId) {
                const role = Role.team(data.tenantId);
                permissions = [
                    Permission.read(role),
                    Permission.update(role),
                    Permission.delete(role),
                ];
            }
            return await databases.createDocument(
                DB_ID,
                getSalesCol(),
                ID.unique(),
                data,
                permissions.length > 0 ? permissions : undefined
            ) as SaleDocument;
        } catch (err: any) {
            if (err?.code === 400 || err?.code === 401 || err?.code === 403) {
                return await databases.createDocument(
                    DB_ID,
                    getSalesCol(),
                    ID.unique(),
                    data
                ) as SaleDocument;
            }
            throw err;
        }
    },

    async updateSale(id: string, data: Partial<SaleData>): Promise<SaleDocument> {
        return await databases.updateDocument(
            DB_ID,
            getSalesCol(),
            id,
            data
        ) as SaleDocument;
    },

    async deleteSale(id: string): Promise<void> {
        await databases.deleteDocument(DB_ID, getSalesCol(), id);
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
