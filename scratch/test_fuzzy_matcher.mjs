import { Client, Databases, Query } from 'node-appwrite';

const client = new Client()
    .setEndpoint('https://sfo.cloud.appwrite.io/v1')
    .setProject('69714b35003a8adab6bb')
    .setKey('standard_7f468ae83deeee6b932fd40312e1be602c94a4d75922ad72d895e677dff7a06b7715984f93fb5c3bebc1a5a174996039c7db6f03f81c21085e5bf01a3aa23c62caa66f8df87b2662ddaef338661cab157e1b4d74d07e4bb1ddf36868cd69ce66c3014450d88ec69029a7716cbcea45ee66c8533a2776a5b522cfc213820e0034');

const databases = new Databases(client);

const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'for', 'in', 'on', 'at', 'to', 'with', 'by', 'from', 'is', 'it', 'as']);

function extractKeywords(str) {
    return (str || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

function findBestItemMatch(csvName, inventory) {
    if (!csvName || !inventory || inventory.length === 0) return null;
    
    // 1. Exact string / cleaned string match
    const cleanCsv = csvName.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const item of inventory) {
        const cleanTitle = (item?.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanTitle && (cleanTitle === cleanCsv || cleanTitle.includes(cleanCsv) || cleanCsv.includes(cleanTitle))) {
            return item;
        }
    }

    // 2. Tokenized keyword overlap match
    const csvTokens = new Set(extractKeywords(csvName));
    if (csvTokens.size === 0) return null;

    let bestItem = null;
    let bestScore = 0;
    let bestMatches = 0;

    for (const item of inventory) {
        const dbTokens = new Set(extractKeywords(item.title));
        if (dbTokens.size === 0) continue;

        let matchingTokens = 0;
        for (const token of csvTokens) {
            if (dbTokens.has(token)) {
                matchingTokens++;
            }
        }

        // Overlap ratio relative to smaller token set
        const minSize = Math.min(csvTokens.size, dbTokens.size);
        const score = matchingTokens / minSize;
        const jaccard = matchingTokens / (csvTokens.size + dbTokens.size - matchingTokens);

        // Quality threshold: at least 60% overlap and >= 2 matching significant words (or 1 long unique word >= 6 chars)
        if (score >= 0.6 && (matchingTokens >= 2 || (matchingTokens === 1 && [...csvTokens].some(t => dbTokens.has(t) && t.length >= 6)))) {
            // Pick highest combined score
            const combinedScore = score * 0.6 + jaccard * 0.4;
            if (combinedScore > bestScore) {
                bestScore = combinedScore;
                bestMatches = matchingTokens;
                bestItem = item;
            }
        }
    }

    return bestItem;
}

async function testMatcher() {
    const res = await databases.listDocuments('resale_db', 'items_dev', [Query.limit(100)]);
    const inventory = res.documents;

    const sampleCsvTitles = [
        "Legend of the Five Rings (L5R) RPG Sourcebook: Secrets of the Crab",
        "Legend of the Five Rings (L5R) Mimura The Village of Promises",
        "Legend of the Five Rings: Time of the Void",
        "D&D 3.5e Fiendish Codex I: Hordes of the Abyss",
        "AD&D Planescape: The Deva Spark Adventure Module",
        "Dr. Martens Quad Wild Croc Platform Boots",
        "Cyberpunk 2020 Core Rulebook RPG"
    ];

    sampleCsvTitles.forEach(title => {
        const match = findBestItemMatch(title, inventory);
        console.log(`\nCSV: "${title}"`);
        if (match) {
            console.log(`-> MATCHED: "${match.title}" (UPC: ${match.upc})`);
        } else {
            console.log(`-> NO MATCH FOUND`);
        }
    });
}

testMatcher().catch(console.error);
