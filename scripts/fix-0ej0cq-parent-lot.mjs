import 'dotenv/config';
import { Client, Databases, Query } from 'node-appwrite';

const ENDPOINT = process.env.PUBLIC_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1';
const PROJECT_ID = process.env.PUBLIC_APPWRITE_PROJECT_ID || '69714b35003a8adab6bb';
const API_KEY = process.env.APPWRITE_API_KEY;
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';

if (!API_KEY) {
  console.error('❌ Missing APPWRITE_API_KEY in .env');
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
const db = new Databases(client);

async function fetchAllItems() {
  const all = [];
  let cursor = null;
  while (true) {
    const queries = [Query.orderDesc('$id'), Query.limit(100)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const res = await db.listDocuments(DB_ID, 'items', queries);
    all.push(...res.documents);
    if (res.documents.length < 100) break;
    cursor = res.documents[res.documents.length - 1].$id;
  }
  return all;
}

function cleanSku(val) {
  return String(val ?? '')
    .trim()
    .replace(/^['"]+/, '')
    .replace(/['"]+$/, '')
    .toUpperCase();
}

async function main() {
  console.log('🔍 Fetching resale_db.items to inspect 0EJ0CQ, HUCK-0467, and HUCK-0790...');
  const items = await fetchAllItems();

  const item0ej0cq = items.find((i) => cleanSku(i.locationSku || i.sku) === '0EJ0CQ');
  const item0ej07j = items.find((i) => cleanSku(i.locationSku || i.sku) === '0EJ07J');
  const huck0467 = items.find((i) => cleanSku(i.upc) === 'HUCK-0467');
  const huck0790 = items.find((i) => cleanSku(i.upc) === 'HUCK-0790');

  console.log('\n=== PARENT LOT CANDIDATES ===');
  if (huck0467) {
    console.log(
      `  • HUCK-0467 ($id=${huck0467.$id}): "${huck0467.title}" | Cost: $${Number(huck0467.cost || 0).toFixed(2)} | Qty: ${huck0467.quantity}`
    );
  } else {
    console.log('  • HUCK-0467: Not found');
  }

  if (huck0790) {
    console.log(
      `  • HUCK-0790 ($id=${huck0790.$id}): "${huck0790.title}" | Cost: $${Number(huck0790.cost || 0).toFixed(2)} | Qty: ${huck0790.quantity}`
    );
  } else {
    console.log('  • HUCK-0790: Not found');
  }

  console.log('\n=== PLANESCAPE BOXED SET BOOTH ITEMS ===');
  if (item0ej07j) {
    console.log(
      `  • 0EJ07J ($id=${item0ej07j.$id} | UPC=${item0ej07j.upc}): "${item0ej07j.title}" | parentLotId=${item0ej07j.parentLotId || 'none'} | Cost=$${Number(item0ej07j.cost || 0).toFixed(2)}`
    );
  } else {
    console.log('  • 0EJ07J: Unlinked in resale_db.items (ready to stage/split from HUCK-0790 in LocationSyncView)');
  }

  if (!item0ej0cq) {
    console.log('  • 0EJ0CQ: Not found in resale_db.items.');
    return;
  }

  console.log(
    `  • 0EJ0CQ ($id=${item0ej0cq.$id} | UPC=${item0ej0cq.upc}): "${item0ej0cq.title}" | parentLotId=${item0ej0cq.parentLotId || 'none'} | Cost=$${Number(item0ej0cq.cost || 0).toFixed(2)}`
  );

  if (!huck0790) {
    console.log('⚠️ Cannot re-link 0EJ0CQ because HUCK-0790 was not found.');
    return;
  }

  const pieceCount = 5;
  const lotCost = Number(huck0790.cost || 0);
  const unitCostShare = Number((lotCost / pieceCount).toFixed(2));

  const needsRelink =
    item0ej0cq.parentLotId !== huck0790.$id ||
    Math.abs(Number(item0ej0cq.cost || 0) - unitCostShare) > 0.01;

  if (needsRelink) {
    const patch = {
      parentLotId: huck0790.$id,
      cost: unitCostShare,
      conditionNotes: `✂️ Split 1/${pieceCount} from Parent Lot HUCK-0790 ("${huck0790.title}") • Proportional Cost: $${unitCostShare.toFixed(2)} • Booth SKU: 0EJ0CQ`,
    };
    if (huck0790.purchaseId) patch.purchaseId = huck0790.purchaseId;
    if (huck0790.orderId) patch.orderId = huck0790.orderId;

    await db.updateDocument(DB_ID, 'items', item0ej0cq.$id, patch);
    console.log(
      `✅ Updated 0EJ0CQ (${item0ej0cq.upc}) parentLotId ➔ HUCK-0790 (${huck0790.$id}) with proportional cost share $${unitCostShare.toFixed(2)}!`
    );
  } else {
    console.log(
      `✅ 0EJ0CQ (${item0ej0cq.upc}) is already linked to HUCK-0790 (${huck0790.$id}) with cost $${unitCostShare.toFixed(2)}.`
    );
  }
}

main().catch((err) => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});

