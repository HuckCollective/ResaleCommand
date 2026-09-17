import dotenv from 'dotenv';
import { Client, Databases } from 'node-appwrite';
dotenv.config();

const client = new Client()
    .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

async function inspectItems() {
    const skirt = await databases.getDocument('resale_db', 'items', '6aab36c3002836101065');
    console.log('Skirt doc:', {
        id: skirt.$id,
        title: skirt.title,
        upc: skirt.upc,
        status: skirt.status,
        storageLocation: skirt.storageLocation,
        sellingLocations: skirt.sellingLocations,
        locationSku: skirt.locationSku,
        createdAt: skirt.$createdAt
    });

    const hat = await databases.getDocument('resale_db', 'items', '6aa6df24002ea4c5e34b');
    console.log('Hat doc:', {
        id: hat.$id,
        title: hat.title,
        upc: hat.upc,
        status: hat.status,
        storageLocation: hat.storageLocation,
        sellingLocations: hat.sellingLocations,
        locationSku: hat.locationSku,
        createdAt: hat.$createdAt
    });
}
inspectItems().catch(console.error);
