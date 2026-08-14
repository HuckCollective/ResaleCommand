import { databases, Query, ID } from './appwrite';
import type { Models } from 'appwrite';

const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
const WAREHOUSES_COL = 'warehouses';

export interface WarehouseData {
    name: string;
    type: string;
    commissionRate?: number;
    monthlyRent?: number;
    tenantId: string;
}

export type WarehouseDocument = WarehouseData & Models.Document;

export const warehousesApi = {
    async listWarehouses(tenantId: string): Promise<WarehouseDocument[]> {
        if (!tenantId) throw new Error("tenantId is required to list warehouses");
        
        const response = await databases.listDocuments(
            DB_ID,
            WAREHOUSES_COL,
            [
                Query.equal('tenantId', tenantId),
                Query.orderAsc('name'),
                Query.limit(100)
            ]
        );
        return response.documents as WarehouseDocument[];
    },

    async getWarehouse(id: string): Promise<WarehouseDocument> {
        if (!id) throw new Error("id is required");
        return await databases.getDocument(DB_ID, WAREHOUSES_COL, id) as WarehouseDocument;
    },

    async createWarehouse(data: WarehouseData): Promise<WarehouseDocument> {
        if (!data.tenantId) throw new Error("tenantId is required");
        return await databases.createDocument(
            DB_ID,
            WAREHOUSES_COL,
            ID.unique(),
            data
        ) as WarehouseDocument;
    },

    async updateWarehouse(id: string, data: Partial<WarehouseData>): Promise<WarehouseDocument> {
        if (!id) throw new Error("id is required");
        return await databases.updateDocument(
            DB_ID,
            WAREHOUSES_COL,
            id,
            data
        ) as WarehouseDocument;
    },

    async deleteWarehouse(id: string): Promise<void> {
        if (!id) throw new Error("id is required");
        await databases.deleteDocument(DB_ID, WAREHOUSES_COL, id);
    }
};
