#!/usr/bin/env node
/**
 * Targeted October 2026 Sales Fix & Audit Script (`resale_db.sales` + `resale_db.items`)
 *
 * Actions performed when run with `--fix`:
 * 1. DELETES ONLY the 1 true duplicate sale `$id=6ae23ae00022cbe726b0`
 *    (`soNumber: "HUCK-1504"`, `orderId: "0EJ0NA"`, `$9.99` CeCe Black Ruffle Button Front — duplicate of Sale# 220406).
 * 2. KEEPS the 2 real Oct 30 evening sales (`$id=6ae561a2000d7abc88df` Ticket #225210 `$10.00` HUCK-1498
 *    and `$id=6ae561a1001f60c536e0` Ticket #225288 `$30.00` HUCK-1206).
 * 3. Re-links `Sale# 224726` (`Vintage Star Trek Book & Mag Lot`, `$10.00`, `2026-10-28`) to `HUCK-9455`
 *    (`$id=6ac089d30026240a4440`, `0EJ0NQ`, `status: 'placed'`, `quantity: 8`, unit cost `$2.61`).
 * 4. Re-links `Sale# 219387` (`Vintage Paperback Books J.R.R. Tolkien`, `$15.00`, `2026-10-08`) to `HUCK-0296`
 *    (`$id=6a049d76002f359baf4f`, `0EJ09E`, `status: 'placed'`, `quantity: 2`, unit cost `$4.16`).
 * 5. Ensures Multi-Qty Booth Bins `HUCK-1323` (`6ada66460027f2ff407c`, `0EJ0MN`, `status: 'placed'`, `quantity: 3`)
 *    and `HUCK-1308` (`6ada664b003164246de0`, `0EJ0FQ`, `status: 'placed'`, `quantity: 10`) are properly synced.
 *
 * Usage:
 *   node scripts/audit-oct2026-sales-diff.mjs          (Dry-run preview)
 *   node scripts/audit-oct2026-sales-diff.mjs --fix    (Apply targeted fixes & verify)
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Client, Databases, Query } from 'node-appwrite';

const ENDPOINT = process.env.PUBLIC_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1';
const PROJECT_ID = process.env.PUBLIC_APPWRITE_PROJECT_ID || '69714b35003a8adab6bb';
const API_KEY = process.env.APPWRITE_API_KEY;
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
const MD_WAREHOUSE_ID = '6a7e70050009db0e1857';

const APPLY_FIX = process.argv.includes('--fix');

if (!API_KEY) {
  console.error('❌ Missing APPWRITE_API_KEY in .env');
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
const db = new Databases(client);

// Explicit IDs from Audit
const DUPLICATE_SALE_ID_TO_DELETE = '6ae23ae00022cbe726b0'; // Duplicate of Sale# 220406 ($9.99 0EJ0NA HUCK-1504)
const PROTECTED_EVENING_SALE_IDS = new Set([
  '6ae561a2000d7abc88df', // Real evening sale Ticket #225210 ($10.00 0EJ0M8 HUCK-1498)
  '6ae561a1001f60c536e0', // Real evening sale Ticket #225288 ($30.00 0EJ06K HUCK-1206)
]);

const PREVERIFIED_MULTI_QTY_BINS = {
  '0EJ0H5': { upc: 'HUCK-1425', altUpc: 'HUCK-1380', expectedQty: 3, unitCostOverride: 22.83, label: 'Frank Frazetta Fantasy Art' },
  '0EJ0FR': { upc: 'HUCK-1309', expectedQty: 12, unitCostOverride: 4.14, label: 'HMM Reader' },
  '0EJ0FQ': { upc: 'HUCK-1308', itemId: '6ada664b003164246de0', expectedQty: 10, unitCostOverride: 0.46, label: 'HMM Mid-Tier' },
  '0EJ0MN': { upc: 'HUCK-1323', itemId: '6ada66460027f2ff407c', expectedQty: 3, unitCostOverride: 4.46, label: 'Assorted TTRPG Dungeons & Dragons 5e Rules Hardcover.' },
  '0EJ0EC': { upc: 'HUCK-0113', expectedQty: 14, unitCostOverride: 1.25, label: "Huck's TTRPG Themed Paperback Novels" },
  '0EJ0JK': { upc: 'HUCK-1460', itemId: '6aa9e112003c40817457', expectedQty: 43, unitCostOverride: 0.81, label: 'Startrek/SciFi Paperbacks' },
  '0EJ0NQ': { upc: 'HUCK-9455', itemId: '6ac089d30026240a4440', expectedQty: 8, unitCostOverride: 2.61, label: 'Vintage Star Trek Book & Mag Lot' },
  '0EJ07M': { upc: null, expectedQty: 33, unitCostOverride: 0.00, label: 'Shadowrun RPG 2e/3e Source book' },
  '0EJ09E': { upc: 'HUCK-0296', itemId: '6a049d76002f359baf4f', expectedQty: 2, unitCostOverride: 4.16, label: 'Vintage Paperback Books J.R.R. Tolkien' },
};

function parseCsvRfc4180(content) {
  const text = content.replace(/^\uFEFF/, '');
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentField += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (ch === '\r' && next === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += ch;
      }
    }
  }
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }
  const nonEmpty = rows.filter(r => r.some(c => String(c).trim() !== ''));
  if (nonEmpty.length === 0) return [];
  const headers = nonEmpty[0].map(h => String(h).trim());
  return nonEmpty.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h || `col_${idx}`] = r[idx] !== undefined ? String(r[idx]).trim() : '';
    });
    return obj;
  });
}

function parseMoney(val) {
  if (val === undefined || val === null) return 0;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function cleanSku(raw) {
  return String(raw ?? '').trim().replace(/^'+/, '').trim();
}

function normTitle(str) {
  return String(str ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function pacificMonthKey(dateStr) {
  if (!dateStr) return '';
  const s = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0, 7);
  const d = new Date(s);
  if (isNaN(d.getTime())) return s.slice(0, 7);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(d);
  return `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}`;
}

function extractTicketNum(str) {
  if (!str) return '';
  const m = String(str).match(/\b(\d{6})\b/);
  return m ? m[1] : '';
}

async function fetchAll(collectionId) {
  const docs = [];
  let cursor = null;
  while (true) {
    const queries = [Query.limit(100), Query.orderDesc('$id')];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const res = await db.listDocuments(DB_ID, collectionId, queries);
    docs.push(...res.documents);
    if (res.documents.length < 100) break;
    cursor = res.documents[res.documents.length - 1].$id;
  }
  return docs;
}

function findPayoutsCsv() {
  const exactName = 'Payouts Michael Stanley - 2026-10-30T22_29_03.919Z.csv';
  const dirs = [
    path.join(os.homedir(), 'Downloads'),
    process.cwd(),
    path.join(process.cwd(), 'data'),
  ];
  for (const d of dirs) {
    const full = path.join(d, exactName);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

async function main() {
  console.log('================================================================================');
  console.log(`🎯 TARGETED OCT 2026 SALES FIX (${APPLY_FIX ? '⚡ --fix LIVE EXECUTION' : '🛡️ DRY-RUN PREVIEW'})`);
  console.log('================================================================================');

  const [allSales, allItems] = await Promise.all([
    fetchAll('sales'),
    fetchAll('items'),
  ]);

  const octSales = allSales.filter(s => {
    if (s.status === 'Cancelled') return false;
    return pacificMonthKey(s.saleDate || s.$createdAt) === '2026-10';
  });

  // 1. Check Duplicate Sale $id=6ae23ae00022cbe726b0
  const dupSale = octSales.find(s => s.$id === DUPLICATE_SALE_ID_TO_DELETE);
  console.log('\n1️⃣  DUPLICATE SALE CHECK (`0EJ0NA` / `HUCK-1504` `$9.99` CeCe Black Ruffle Button Front):');
  if (dupSale) {
    console.log(`   • Found duplicate sale $id=${dupSale.$id} | soNumber="${dupSale.soNumber}" | orderId="${dupSale.orderId}" | Gross=$${Number(dupSale.grossAmount || 0).toFixed(2)}`);
    if (APPLY_FIX) {
      await db.deleteDocument(DB_ID, 'sales', dupSale.$id);
      console.log(`   ✅ DELETED duplicate sale $id=${dupSale.$id}`);
    } else {
      console.log(`   👉 [DRY-RUN] Will delete $id=${dupSale.$id}`);
    }
  } else {
    console.log(`   ✅ Duplicate sale $id=${DUPLICATE_SALE_ID_TO_DELETE} is already deleted.`);
  }

  // 2. Verify Protected Evening Sales (#225210 & #225288)
  console.log('\n2️⃣  PROTECTED OCT 30 EVENING SALES (KEPT INTACT):');
  for (const keptId of PROTECTED_EVENING_SALE_IDS) {
    const keptSale = octSales.find(s => s.$id === keptId);
    if (keptSale) {
      console.log(`   ✅ KEEPING $id=${keptSale.$id} | soNumber="${keptSale.soNumber}" | orderId="${keptSale.orderId}" | Gross=$${Number(keptSale.grossAmount || 0).toFixed(2)} | Net=$${Number(keptSale.netPayout || 0).toFixed(2)}`);
    } else {
      console.log(`   ⚠️ Warning: Protected evening sale $id=${keptId} not found in octSales.`);
    }
  }

  // 3. Re-link the 2 Mislinked Bin Sales in `resale_db.sales`
  console.log('\n3️⃣  RE-LINKING MISLINKED BIN SALES IN `resale_db.sales`:');

  // 3a. Sale# 224726 (Vintage Star Trek Book & Mag Lot, $10.00, 2026-10-28) -> HUCK-9455 ($id=6ac089d30026240a4440, 0EJ0NQ)
  const sale224726 = octSales.find(s => extractTicketNum(s.orderId) === '224726' || extractTicketNum(s.soNumber) === '224726');
  if (sale224726) {
    console.log(`   • Sale# 224726 ($id=${sale224726.$id}): current soNumber="${sale224726.soNumber}" | orderId="${sale224726.orderId}"`);
    if (sale224726.soNumber !== 'HUCK-9455') {
      if (APPLY_FIX) {
        await db.updateDocument(DB_ID, 'sales', sale224726.$id, {
          soNumber: 'HUCK-9455',
        });
        sale224726.soNumber = 'HUCK-9455';
        console.log(`     ✅ Updated Sale# 224726 ($id=${sale224726.$id}) soNumber -> "HUCK-9455" (0EJ0NQ, unit cost $2.61)`);
      } else {
        console.log(`     👉 [DRY-RUN] Will update Sale# 224726 soNumber -> "HUCK-9455"`);
      }
    } else {
      console.log(`     ✅ Sale# 224726 already linked to soNumber="HUCK-9455"`);
    }
  }

  // 3b. Sale# 219387 (Vintage Paperback Books J.R.R. Tolkien, $15.00, 2026-10-08) -> HUCK-0296 ($id=6a049d76002f359baf4f, 0EJ09E)
  const sale219387 = octSales.find(s => extractTicketNum(s.orderId) === '219387' || extractTicketNum(s.soNumber) === '219387');
  if (sale219387) {
    console.log(`   • Sale# 219387 ($id=${sale219387.$id}): current soNumber="${sale219387.soNumber}" | orderId="${sale219387.orderId}"`);
    if (sale219387.soNumber !== 'HUCK-0296') {
      if (APPLY_FIX) {
        await db.updateDocument(DB_ID, 'sales', sale219387.$id, {
          soNumber: 'HUCK-0296',
        });
        sale219387.soNumber = 'HUCK-0296';
        console.log(`     ✅ Updated Sale# 219387 ($id=${sale219387.$id}) soNumber -> "HUCK-0296" (0EJ09E, unit cost $4.16)`);
      } else {
        console.log(`     👉 [DRY-RUN] Will update Sale# 219387 soNumber -> "HUCK-0296"`);
      }
    } else {
      console.log(`     ✅ Sale# 219387 already linked to soNumber="HUCK-0296"`);
    }

    // Clear saleId on HUCK-0669 (69e93594000d30435816) if it pointed to Sale# 219387
    const huck0669 = allItems.find(i => i.$id === '69e93594000d30435816' || cleanSku(i.upc).toUpperCase() === 'HUCK-0669');
    if (huck0669 && huck0669.saleId === sale219387.$id) {
      if (APPLY_FIX) {
        await db.updateDocument(DB_ID, 'items', huck0669.$id, { saleId: null });
        huck0669.saleId = null;
        console.log(`     ✅ Cleared stale saleId on HUCK-0669 ($id=${huck0669.$id})`);
      } else {
        console.log(`     👉 [DRY-RUN] Will clear stale saleId on HUCK-0669 ($id=${huck0669.$id})`);
      }
    }
  }

  // 4. Sync the Multi-Qty Booth Bin items in `resale_db.items`
  console.log('\n4️⃣  VERIFYING & SYNCING MULTI-QTY BOOTH BINS IN `resale_db.items`:');
  const binsToSync = [
    { sku: '0EJ0NQ', upc: 'HUCK-9455', itemId: '6ac089d30026240a4440', expectedQty: 8 },
    { sku: '0EJ09E', upc: 'HUCK-0296', itemId: '6a049d76002f359baf4f', expectedQty: 2 },
    { sku: '0EJ0MN', upc: 'HUCK-1323', itemId: '6ada66460027f2ff407c', expectedQty: 3 },
    { sku: '0EJ0FQ', upc: 'HUCK-1308', itemId: '6ada664b003164246de0', expectedQty: 10 },
    { sku: '0EJ0FR', upc: 'HUCK-1309', itemId: '6a93d4b80025d0cdf4e8', expectedQty: 12 },
    { sku: '0EJ0JK', upc: 'HUCK-1460', itemId: '6aa9e112003c40817457', expectedQty: 43 },
    { sku: '0EJ0H5', upc: 'HUCK-1425', itemId: '6a99cf96001d864b98de', expectedQty: 3 },
  ];

  for (const b of binsToSync) {
    const item = allItems.find(i => i.$id === b.itemId) || allItems.find(i => cleanSku(i.upc).toUpperCase() === b.upc);
    if (!item) {
      console.log(`   ⚠️ Could not find item ${b.upc} (${b.itemId})`);
      continue;
    }
    const patch = {};
    if (item.status !== 'placed') patch.status = 'placed';
    if (Number(item.quantity ?? 1) !== b.expectedQty) patch.quantity = b.expectedQty;
    if (cleanSku(item.locationSku).toUpperCase() !== b.sku) patch.locationSku = b.sku;
    if (item.storageLocation !== 'MD') patch.storageLocation = 'MD';
    if (item.warehouseId !== MD_WAREHOUSE_ID) patch.warehouseId = MD_WAREHOUSE_ID;

    if (Object.keys(patch).length > 0) {
      if (APPLY_FIX) {
        await db.updateDocument(DB_ID, 'items', item.$id, patch);
        Object.assign(item, patch);
        console.log(`   ✅ Updated ${b.upc} (${b.sku}, $id=${item.$id}): ${JSON.stringify(patch)}`);
      } else {
        console.log(`   👉 [DRY-RUN] Will update ${b.upc} (${b.sku}, $id=${item.$id}): ${JSON.stringify(patch)}`);
      }
    } else {
      console.log(`   ✅ ${b.upc} (${b.sku}, $id=${item.$id}) already in sync (status=placed, qty=${item.quantity}, loc=MD)`);
    }
  }

  // 5. Post-Fix Verification Summary
  const remainingOctSales = octSales.filter(s => !(APPLY_FIX && s.$id === DUPLICATE_SALE_ID_TO_DELETE) && s.$id !== DUPLICATE_SALE_ID_TO_DELETE);
  const official60Sales = remainingOctSales.filter(s => !PROTECTED_EVENING_SALE_IDS.has(s.$id));
  const evening2Sales = remainingOctSales.filter(s => PROTECTED_EVENING_SALE_IDS.has(s.$id));

  const isSoldUnitSplitChild = it => /\(sold unit\)/i.test(String(it?.title || ''));
  const computeSaleCost = s => {
    const sSo = cleanSku(s.soNumber).toUpperCase();
    const sOrd = cleanSku(s.orderId).toUpperCase();
    if (sSo.startsWith('BB-') || sSo.startsWith('BB')) return 0;

    // Check preverified multi-qty bins by SKU or UPC
    for (const [binSku, cfg] of Object.entries(PREVERIFIED_MULTI_QTY_BINS)) {
      if (sSo === binSku || sOrd === binSku || (cfg.upc && sSo === cfg.upc) || (cfg.altUpc && sSo === cfg.altUpc)) {
        return cfg.unitCostOverride;
      }
    }

    const linked =
      allItems.find(i => i.saleId === s.$id && !isSoldUnitSplitChild(i)) ||
      allItems.find(i => !isSoldUnitSplitChild(i) && (
        (sSo && (cleanSku(i.locationSku).toUpperCase() === sSo || cleanSku(i.upc).toUpperCase() === sSo)) ||
        (sOrd && (cleanSku(i.locationSku).toUpperCase() === sOrd || cleanSku(i.upc).toUpperCase() === sOrd))
      ));

    if (!linked) return 0;
    if (String(linked.upc || '').toUpperCase().startsWith('BB-')) return 0;
    const lSku = cleanSku(linked.locationSku).toUpperCase();
    const lUpc = cleanSku(linked.upc).toUpperCase();
    for (const [binSku, cfg] of Object.entries(PREVERIFIED_MULTI_QTY_BINS)) {
      if (lSku === binSku || (cfg.upc && lUpc === cfg.upc) || (cfg.altUpc && lUpc === cfg.altUpc)) {
        return cfg.unitCostOverride;
      }
    }
    return Number(linked.cost ?? linked.purchasePrice ?? 0);
  };

  const sumMetrics = list => {
    let gross = 0, net = 0, fee = 0, cost = 0;
    for (const s of list) {
      gross += Number(s.grossAmount || 0);
      net += Number(s.netPayout || 0);
      fee += Number(s.commissionFee || 0) + Number(s.shippingCost || 0);
      cost += computeSaleCost(s);
    }
    return { count: list.length, gross, net, fee, cost };
  };

  const m60 = sumMetrics(official60Sales);
  const mEvening = sumMetrics(evening2Sales);
  const mAll62 = sumMetrics(remainingOctSales);

  console.log('\n================================================================================');
  console.log('📊 5. VERIFIED POST-FIX SUMMARY FOR OCTOBER 2026');
  console.log('================================================================================');
  console.log(`  • Official 60 Ricochet CSV Sales (thru 22:29Z):`);
  console.log(`      ${m60.count} Items Sold | $${m60.gross.toFixed(2)} Gross | $${m60.net.toFixed(2)} Net Payout | $${m60.fee.toFixed(2)} Venue Fee | $${m60.cost.toFixed(2)} Cost Basis`);
  console.log(`  • Plus 2 Real Oct 30 Evening Sales (#225210 & #225288):`);
  console.log(`      ${mEvening.count} Items Sold | $${mEvening.gross.toFixed(2)} Gross | $${mEvening.net.toFixed(2)} Net Payout | $${mEvening.fee.toFixed(2)} Venue Fee | $${mEvening.cost.toFixed(2)} Cost Basis`);
  console.log(`  ------------------------------------------------------------------------------`);
  console.log(`  • Total Active Oct 2026 Sales in resale_db.sales:`);
  console.log(`      ${mAll62.count} Items Sold | $${mAll62.gross.toFixed(2)} Gross | $${mAll62.net.toFixed(2)} Net Payout | $${mAll62.fee.toFixed(2)} Venue Fee | $${mAll62.cost.toFixed(2)} Cost Basis`);
  console.log('================================================================================');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
