import xlsx from 'xlsx';
import { Client, Databases, Query } from 'node-appwrite';
import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const client = new Client()
    .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID;
const COL_ID = 'items'; // Prod collection

async function run() {
    const excelFilePath = process.argv[2];
    
    if (!excelFilePath) {
        console.error("Usage: node scratch/test_shipping_split.mjs <path_to_excel_file>");
        process.exit(1);
    }

    console.log(`Loading Excel file from: ${excelFilePath}...`);
    let workbook;
    try {
        workbook = xlsx.readFile(excelFilePath);
    } catch (e) {
        console.error(`Failed to read file at ${excelFilePath}: ${e.message}`);
        process.exit(1);
    }
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const json = xlsx.utils.sheet_to_json(worksheet);

    const orderGroups = {};
    const identityMap = {};

    json.forEach(row => {
        const oid = row['Order #'];
        if (!orderGroups[oid]) {
            orderGroups[oid] = { items: [], maxShippingTotal: 0 };
        }
        
        const priceStr = String(row['Item Price'] || '0');
        const shipStr = String(row['Shipping Price'] || '0');
        const handlingStr = String(row['Handling Price'] || '0');
        const taxStr = String(row['Tax'] || '0');
        const feeStr = String(row['Additional Fee'] || '0');
        
        const price = parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0;
        const shippingBase = parseFloat(shipStr.replace(/[^0-9.]/g, '')) || 0;
        const handling = parseFloat(handlingStr.replace(/[^0-9.]/g, '')) || 0;
        const tax = parseFloat(taxStr.replace(/[^0-9.]/g, '')) || 0;
        const fee = parseFloat(feeStr.replace(/[^0-9.]/g, '')) || 0;
        
        const itemTotalExtra = shippingBase + handling + tax + fee;
        
        if (itemTotalExtra > orderGroups[oid].maxShippingTotal) {
            orderGroups[oid].maxShippingTotal = itemTotalExtra;
        }
        
        const itemId = String(row['Item Id']);
        
        const itemObj = {
            itemId: itemId,
            title: row['Item'],
            price: price,
            calculatedCost: 0
        };
        
        orderGroups[oid].items.push(itemObj);
        identityMap[itemId] = itemObj;
    });

    console.log("Calculating perfect cost splits...");
    for (const oid in orderGroups) {
        const group = orderGroups[oid];
        const count = group.items.length;
        const extraPerItem = group.maxShippingTotal / count;
        
        group.items.forEach(item => {
            item.calculatedCost = item.price + extraPerItem;
        });
    }

    const itemIdsToFetch = Object.keys(identityMap);
    console.log(`Found ${itemIdsToFetch.length} unique items in the Excel file.`);
    
    // Fetch from Appwrite in chunks of 50
    const chunkSize = 50;
    const dbItems = [];
    console.log("Querying Appwrite database for these items...");
    
    for (let i = 0; i < itemIdsToFetch.length; i += chunkSize) {
        const chunk = itemIdsToFetch.slice(i, i + chunkSize);
        try {
            const res = await databases.listDocuments(DB_ID, COL_ID, [
                Query.equal('identity', chunk),
                Query.limit(100)
            ]);
            dbItems.push(...res.documents);
        } catch (e) {
            console.error("Error fetching chunk:", e.message);
        }
    }

    console.log(`\nFound ${dbItems.length} matching items already in the database!\n`);
    
    console.log("=========================================");
    console.log("UPDATE RUN (APPLYING CHANGES TO DB)");
    console.log("=========================================\n");

    let needsFix = 0;
    let fixed = 0;
    
    // Group DB items back by order
    for (const oid in orderGroups) {
        const group = orderGroups[oid];
        
        // Find which items in this order are in the DB (find ALL matches for duplicates)
        const dbItemsInOrder = [];
        group.items.forEach(xlItem => {
            const matches = dbItems.filter(db => db.identity === xlItem.itemId);
            dbItemsInOrder.push(...matches);
        });
            
        if (dbItemsInOrder.length === 0) continue;
        
        const extraPerItem = group.maxShippingTotal / group.items.length;
        
        console.log(`\n📦 Order #${oid} [${group.items.length} items total, ${dbItemsInOrder.length} in DB]`);
        console.log(`   Order Max Extra Fees (Ship+Hand+Tax+Fee): $${group.maxShippingTotal.toFixed(2)}`);
        if (group.items.length > 1) {
             console.log(`   Split per item: $${extraPerItem.toFixed(2)}`);
        }
        
        dbItemsInOrder.forEach(dbItem => {
            const xlItem = identityMap[dbItem.identity];
            const currentDbCost = dbItem.cost || 0;
            const targetCost = xlItem.calculatedCost;
            const basePrice = xlItem.price;
            
            console.log(`   -------------------------------------------------`);
            if (Math.abs(currentDbCost - targetCost) > 0.01) {
                needsFix++;
                console.log(`   ❌ MISMATCH | ID: ${dbItem.identity} | ${dbItem.title?.substring(0,25)}...`);
                console.log(`      Breakdown:       Base Cost $${basePrice.toFixed(2)} + Fees Share $${extraPerItem.toFixed(2)} = $${targetCost.toFixed(2)}`);
                console.log(`      Current DB Cost: $${currentDbCost.toFixed(2)}  ➔  Corrected Cost: $${targetCost.toFixed(2)}`);
            } else {
                console.log(`   ✅ MATCH    | ID: ${dbItem.identity} | ${dbItem.title?.substring(0,25)}...`);
                console.log(`      Breakdown:       Base Cost $${basePrice.toFixed(2)} + Fees Share $${extraPerItem.toFixed(2)} = $${targetCost.toFixed(2)}`);
                console.log(`      Cost is correct: $${currentDbCost.toFixed(2)}`);
            }
        });
    }
    
    // Process updates
    console.log(`\nFound ${needsFix} items that need updating. Applying changes...`);
    
    for (const oid in orderGroups) {
        const group = orderGroups[oid];
        const dbItemsInOrder = [];
        group.items.forEach(xlItem => {
            const matches = dbItems.filter(db => db.identity === xlItem.itemId);
            dbItemsInOrder.push(...matches);
        });
            
        for (const dbItem of dbItemsInOrder) {
            const xlItem = identityMap[dbItem.identity];
            const currentDbCost = dbItem.cost || 0;
            const targetCost = xlItem.calculatedCost;
            
            if (Math.abs(currentDbCost - targetCost) > 0.01) {
                try {
                    await databases.updateDocument(DB_ID, COL_ID, dbItem.$id, {
                        cost: targetCost
                    });
                    fixed++;
                    console.log(`   ✅ UPDATED | ID: ${dbItem.identity} | Cost changed from $${currentDbCost.toFixed(2)} to $${targetCost.toFixed(2)}`);
                } catch (e) {
                    console.error(`   ❌ FAILED to update ID: ${dbItem.identity} - ${e.message}`);
                }
            }
        }
    }

    console.log(`\nSummary: Successfully updated ${fixed} out of ${needsFix} items!`);
}

run();
