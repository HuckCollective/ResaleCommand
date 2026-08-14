import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Replace this with your actual CSV file name
const csvFile = path.resolve(__dirname, '../src/Payout History Michael Michael - 2026-08-14 01_56_19.csv');

function parseCSVLine(line) {
    const regex = /(?:^|,)(?:"([^"]*)"|([^,]*))/g;
    const result = [];
    let match;
    while ((match = regex.exec(line)) !== null) {
        if (match[1] !== undefined) result.push(match[1]);
        else if (match[2] !== undefined) result.push(match[2]);
        // Zero-width match prevention
        if (regex.lastIndex === match.index) regex.lastIndex++;
    }
    return result;
}

async function run() {
    if (!fs.existsSync(csvFile)) {
        console.error('File not found:', csvFile);
        return;
    }

    const content = fs.readFileSync(csvFile, 'utf8');
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    
    // Skip header row
    console.log(`Analyzing ${lines.length - 1} rows from Payout History...\n`);
    
    let matchedSkus = 0;
    
    for (let i = 1; i < lines.length; i++) {
        const row = parseCSVLine(lines[i]);
        const itemCol = row[0]; // e.g., "Elric of Melnibone... - 0EJ066"
        const saleId = row[1];
        const gross = row[2];
        const net = row[8];
        
        if (!itemCol) continue;
        
        // Extract SKU from the end of the item string
        const skuMatch = itemCol.match(/ - ([A-Z0-9]+)$/);
        const sku = skuMatch ? skuMatch[1] : null;
        
        if (sku) {
            matchedSkus++;
            console.log(`✅ Found SKU: [${sku}] -> Item: ${itemCol.replace(` - ${sku}`, '')} | Gross: $${gross} | Net: $${net}`);
        } else {
            console.log(`⚠️ NO SKU FOUND: ${itemCol} | Gross: $${gross}`);
        }
    }
    
    console.log(`\n--- SUMMARY ---`);
    console.log(`Total Rows: ${lines.length - 1}`);
    console.log(`SKUs Successfully Extracted: ${matchedSkus}`);
}

run().catch(console.error);
