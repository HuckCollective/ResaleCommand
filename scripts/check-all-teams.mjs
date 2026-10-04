import { Client, Teams } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client();
const ENDPOINT = process.env.PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;

client.setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
const teams = new Teams(client);

async function listTeams() {
    try {
        const res = await teams.list();
        console.log(`Found ${res.teams.length} teams:`);
        res.teams.forEach(t => {
            console.log(`- Team: "${t.name}" | ID: ${t.$id} | Prefs: ${JSON.stringify(t.prefs)}`);
        });
    } catch (e) {
        console.error('Teams list error:', e);
    }
}

listTeams();
