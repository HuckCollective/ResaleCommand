import { Client, Teams } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client()
    .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const teams = new Teams(client);

async function listTeams() {
    try {
        const response = await teams.list();
        console.log(`Found ${response.total} teams:`);
        response.teams.forEach(t => {
            console.log(`- Name: "${t.name}" | ID: "${t.$id}" | Created: ${t.$createdAt}`);
        });
    } catch (e) {
        console.error('Error listing teams:', e.message);
    }
}

listTeams();
