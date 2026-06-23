import { Client, Teams } from 'node-appwrite';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client()
    .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const teams = new Teams(client);

async function run() {
    try {
        const teamsList = await teams.list();
        if (teamsList.teams.length === 0) {
            console.log("No teams found");
            return;
        }
        const teamId = teamsList.teams[0].$id;
        console.log(`Fetching memberships for team "${teamsList.teams[0].name}" (${teamId})...`);
        const res = await teams.listMemberships(teamId);
        console.log("Memberships raw first item:", JSON.stringify(res.memberships[0], null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
