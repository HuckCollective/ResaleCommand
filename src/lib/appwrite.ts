import { Client, Databases, Storage, Account, Teams, ID as AppwriteID, Query as AppwriteQuery } from 'appwrite';

export const client = new Client();

const endpoint = import.meta.env?.PUBLIC_APPWRITE_ENDPOINT;
const project = import.meta.env?.PUBLIC_APPWRITE_PROJECT_ID;

if (endpoint && project) {
    client
        .setEndpoint(endpoint)
        .setProject(project);
} else {
    console.error("🚨 APPWRITE CONFIG MISSING: PUBLIC_APPWRITE_ENDPOINT or PUBLIC_APPWRITE_PROJECT_ID is not set.");
}

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export const teams = new Teams(client);
export const ID = AppwriteID;
export const Query = AppwriteQuery;
