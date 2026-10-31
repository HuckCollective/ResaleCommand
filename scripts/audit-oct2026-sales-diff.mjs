#!/usr/bin/env node
/**
 * Targeted October 2026 Sales Fix & Audit Script (`resale_db.sales` + `resale_db.items`)
 *
 * Ensures 100% penny-exact parity with Memory Den's October 2026 Payouts CSV (`Total Payout: $2,093.54` / `63` items):
 * 1. DELETES the 1 true duplicate sale `$id=6ae23ae00022cbe726b0` (`0EJ0NA` / `HUCK-1504`).
 * 2. ENSURES both (`2x`) lines of `Ticket #225210` (`0EJ0M8` / `HUCK-1498` `Fantasy/Sci-Fi MM Paperbacks`,
 *    `$10.00` Gross / `$8.50` Net / `$1.50` Fee each) exist in `resale_db.sales` (`Ticket #225210` and `Ticket #225210 #2`),
 *    plus `Ticket #225288` (`0EJ06K` / `HUCK-1206`, `$30.00` Gross / `$25.50` Net).
 * 3. FIXES any `$0.01` rounding on `Sale# 220406` (`0EJ0NA` / `HUCK-1504` `CeCe Black Ruffle Button Front`)
 *    so `grossAmount = 9.99`, `netPayout = 8.49`, `commissionFee = 1.50`.
 * 4. Re-links `Sale# 224726` (`Vintage Star Trek Book & Mag Lot`, `$10.00`) -> `HUCK-9455` (`0EJ0NQ`, unit cost `$2.61`)
 *    and `Sale# 219387` (`Vintage Paperback Books J.R.R. Tolkien`, `$15.00`) -> `HUCK-0296` (`0EJ09E`, unit cost `$4.16`).
 * 5. Syncs Multi-Qty Booth Bins (`HUCK-9455`, `HUCK-0296`, `HUCK-1323`, `HUCK-1308`, `HUCK-1309`, `HUCK-1460`, `HUCK-1425`, `HUCK-1498`).
 *
 * Usage:
 *   node scripts/audit-oct2026-sales-diff.mjs          (Dry-run preview)
 *   node scripts/audit-oct2026-sales-diff.mjs --fix    (Apply targeted fixes & verify)
 */

import 'dotenv/config';
import { Client, Databases, ID, Query } from 'node-appwrite';

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

const DUPLICATE_SALE_ID_TO_DELETE = '6ae23ae00022cbe726b0';

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
  '0EJ0M8': { upc: 'HUCK-1498', expectedQty: 8, unitCostOverride: 0.04, label: 'Fantasy/Sci-Fi MM Paperbacks' },
};

function cleanSku(raw) {
  return String(raw ?? '').trim().replace(/^'+/, '').trim();
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

async function main() {
  console.log('================================================================================');
  console.log(`🎯 TARGETED OCT 2026 SALES FIX (${APPLY_FIX ? '⚡ --fix LIVE EXECUTION' : '🛡️ DRY-RUN PREVIEW'})`);
  console.log('================================================================================');

  const [allSales, allItems] = await Promise.all([
    fetchAll('sales'),
    fetchAll('items'),
  ]);

  let octSales = allSales.filter(s => {
    if (s.status === 'Cancelled') return false;
    return pacificMonthKey(s.saleDate || s.$createdAt) === '2026-10';
  });

  // 1. Delete Duplicate Sale $id=6ae23ae00022cbe726b0 if present
  const dupSale = octSales.find(s => s.$id === DUPLICATE_SALE_ID_TO_DELETE);
  console.log('\n1️⃣  DUPLICATE SALE CHECK (`0EJ0NA` / `HUCK-1504` duplicate without ticket):');
  if (dupSale) {
    console.log(`   • Found duplicate sale $id=${dupSale.$id} | soNumber="${dupSale.soNumber}" | orderId="${dupSale.orderId}" | Gross=$${Number(dupSale.grossAmount || 0).toFixed(2)}`);
    if (APPLY_FIX) {
      await db.deleteDocument(DB_ID, 'sales', dupSale.$id);
      octSales = octSales.filter(s => s.$id !== dupSale.$id);
      console.log(`   ✅ DELETED duplicate sale $id=${dupSale.$id}`);
    } else {
      octSales = octSales.filter(s => s.$id !== dupSale.$id);
      console.log(`   👉 [DRY-RUN] Will delete $id=${dupSale.$id}`);
    }
  } else {
    console.log(`   ✅ Duplicate sale $id=${DUPLICATE_SALE_ID_TO_DELETE} is already deleted.`);
  }

  // 2. Ensure BOTH (2x) lines of Ticket #225210 ($10.00 / $8.50 each, HUCK-1498 / 0EJ0M8) exist
  console.log('\n2️⃣  MULTI-LINE TICKET #225210 CHECK (`2x` Fantasy/Sci-Fi MM Paperbacks `0EJ0M8` / `HUCK-1498`):');
  const sales225210 = octSales.filter(
    s => extractTicketNum(s.orderId) === '225210' || extractTicketNum(s.soNumber) === '225210'
  );
  console.log(`   • Currently found ${sales225210.length} sale record(s) for Ticket #225210 in resale_db.sales.`);
  for (const s of sales225210) {
    console.log(`     - $id=${s.$id} | soNumber="${s.soNumber}" | orderId="${s.orderId}" | Gross=$${Number(s.grossAmount || 0).toFixed(2)} | Net=$${Number(s.netPayout || 0).toFixed(2)}`);
  }

  if (sales225210.length < 2) {
    const firstLine = sales225210[0];
    const newSalePayload = {
      tenantId: firstLine?.tenantId || 'huck',
      warehouseId: MD_WAREHOUSE_ID,
      soNumber: 'HUCK-1498',
      orderId: 'Ticket #225210 #2',
      saleDate: firstLine?.saleDate || '2026-10-30T23:27:00.000Z',
      status: 'Sold',
      grossAmount: 10.00,
      netPayout: 8.50,
      commissionFee: 1.50,
      shippingCharged: 0,
      shippingCost: 0,
    };
    if (APPLY_FIX) {
      const created = await db.createDocument(DB_ID, 'sales', ID.unique(), newSalePayload);
      octSales.push(created);
      console.log(`   ✅ CREATED 2nd line for Ticket #225210 ($id=${created.$id} | soNumber="HUCK-1498" | orderId="Ticket #225210 #2" | Gross=$10.00 | Net=$8.50)`);
    } else {
      octSales.push({ $id: 'DRY_RUN_225210_LINE_2', ...newSalePayload });
      console.log(`   👉 [DRY-RUN] Will create 2nd line for Ticket #225210: ${JSON.stringify(newSalePayload)}`);
    }
  } else {
    console.log(`   ✅ Both (2x) lines of Ticket #225210 are present in resale_db.sales.`);
  }

  // 3. Fix $0.01 rounding on Sale# 220406 (CeCe Black Ruffle Button Front, 0EJ0NA / HUCK-1504 -> $9.99 Gross / $8.49 Net / $1.50 Fee)
  console.log('\n3️⃣  EXACT CENTS CHECK ON SALE# 220406 (`CeCe Black Ruffle Button Front`, `0EJ0NA` / `HUCK-1504`):');
  const sale220406 = octSales.find(
    s =>
      extractTicketNum(s.orderId) === '220406' ||
      extractTicketNum(s.soNumber) === '220406' ||
      cleanSku(s.soNumber).toUpperCase() === 'HUCK-1504' ||
      cleanSku(s.soNumber).toUpperCase() === '0EJ0NA' ||
      cleanSku(s.orderId).toUpperCase() === '0EJ0NA'
  );
  if (sale220406) {
    const curGross = Number(sale220406.grossAmount || 0);
    const curNet = Number(sale220406.netPayout || 0);
    const curFee = Number(sale220406.commissionFee || 0);
    console.log(`   • Found Sale# 220406 ($id=${sale220406.$id}): Gross=$${curGross.toFixed(2)} | Net=$${curNet.toFixed(2)} | Fee=$${curFee.toFixed(2)}`);
    if (Math.abs(curGross - 9.99) > 0.001 || Math.abs(curNet - 8.49) > 0.001 || Math.abs(curFee - 1.50) > 0.001) {
      const patch = { grossAmount: 9.99, netPayout: 8.49, commissionFee: 1.50 };
      if (APPLY_FIX) {
        await db.updateDocument(DB_ID, 'sales', sale220406.$id, patch);
        Object.assign(sale220406, patch);
        console.log(`   ✅ Updated Sale# 220406 ($id=${sale220406.$id}) to exact cents: Gross=$9.99 | Net=$8.49 | Fee=$1.50`);
      } else {
        Object.assign(sale220406, patch);
        console.log(`   👉 [DRY-RUN] Will update Sale# 220406 ($id=${sale220406.$id}) to: ${JSON.stringify(patch)}`);
      }
    } else {
      console.log(`   ✅ Sale# 220406 already has exact cents ($9.99 Gross / $8.49 Net / $1.50 Fee).`);
    }
  } else {
    console.log(`   ⚠️ Warning: Could not find Sale# 220406 in octSales.`);
  }

  // 4. Re-link Mislinked Bin Sales in `resale_db.sales`
  console.log('\n4️⃣  RE-LINKING MISLINKED BIN SALES IN `resale_db.sales`:');

  const sale224726 = octSales.find(s => extractTicketNum(s.orderId) === '224726' || extractTicketNum(s.soNumber) === '224726');
  if (sale224726) {
    if (sale224726.soNumber !== 'HUCK-9455') {
      if (APPLY_FIX) {
        await db.updateDocument(DB_ID, 'sales', sale224726.$id, { soNumber: 'HUCK-9455' });
        sale224726.soNumber = 'HUCK-9455';
        console.log(`   ✅ Updated Sale# 224726 ($id=${sale224726.$id}) soNumber -> "HUCK-9455"`);
      } else {
        sale224726.soNumber = 'HUCK-9455';
        console.log(`   👉 [DRY-RUN] Will update Sale# 224726 soNumber -> "HUCK-9455"`);
      }
    } else {
      console.log(`   ✅ Sale# 224726 already linked to soNumber="HUCK-9455"`);
    }
  }

  const sale219387 = octSales.find(s => extractTicketNum(s.orderId) === '219387' || extractTicketNum(s.soNumber) === '219387');
  if (sale219387) {
    if (sale219387.soNumber !== 'HUCK-0296') {
      if (APPLY_FIX) {
        await db.updateDocument(DB_ID, 'sales', sale219387.$id, { soNumber: 'HUCK-0296' });
        sale219387.soNumber = 'HUCK-0296';
        console.log(`   ✅ Updated Sale# 219387 ($id=${sale219387.$id}) soNumber -> "HUCK-0296"`);
      } else {
        sale219387.soNumber = 'HUCK-0296';
        console.log(`   👉 [DRY-RUN] Will update Sale# 219387 soNumber -> "HUCK-0296"`);
      }
    } else {
      console.log(`   ✅ Sale# 219387 already linked to soNumber="HUCK-0296"`);
    }
  }

  // 5. Sync Multi-Qty Booth Bins in `resale_db.items`
  console.log('\n5️⃣  VERIFYING & SYNCING MULTI-QTY BOOTH BINS IN `resale_db.items`:');
  const binsToSync = [
    { sku: '0EJ0NQ', upc: 'HUCK-9455', itemId: '6ac089d30026240a4440', expectedQty: 8 },
    { sku: '0EJ09E', upc: 'HUCK-0296', itemId: '6a049d76002f359baf4f', expectedQty: 2 },
    { sku: '0EJ0MN', upc: 'HUCK-1323', itemId: '6ada66460027f2ff407c', expectedQty: 3 },
    { sku: '0EJ0FQ', upc: 'HUCK-1308', itemId: '6ada664b003164246de0', expectedQty: 10 },
    { sku: '0EJ0FR', upc: 'HUCK-1309', itemId: '6a93d4b80025d0cdf4e8', expectedQty: 12 },
    { sku: '0EJ0JK', upc: 'HUCK-1460', itemId: '6aa9e112003c40817457', expectedQty: 43 },
    { sku: '0EJ0H5', upc: 'HUCK-1425', itemId: '6a99cf96001d864b98de', expectedQty: 3 },
    { sku: '0EJ0M8', upc: 'HUCK-1498', itemId: null, expectedQty: 8 },
  ];

  for (const b of binsToSync) {
    const item =
      (b.itemId && allItems.find(i => i.$id === b.itemId)) ||
      allItems.find(i => cleanSku(i.upc).toUpperCase() === b.upc) ||
      allItems.find(i => cleanSku(i.locationSku).toUpperCase() === b.sku);
    if (!item) {
      console.log(`   ⚠️ Could not find item ${b.upc} (${b.sku})`);
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

  // 6. Post-Fix Verification Summary
  const isSoldUnitSplitChild = it => /\(sold unit\)/i.test(String(it?.title || ''));
  const computeSaleCost = s => {
    const sSo = cleanSku(s.soNumber).toUpperCase();
    const sOrd = cleanSku(s.orderId).toUpperCase();
    if (sSo.startsWith('BB-') || sSo.startsWith('BB')) return 0;

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

  let gross = 0, net = 0, fee = 0, cost = 0;
  for (const s of octSales) {
    gross += Number(s.grossAmount || 0);
    net += Number(s.netPayout || 0);
    fee += Number(s.commissionFee || 0) + Number(s.shippingCost || 0);
    cost += computeSaleCost(s);
  }

  console.log('\n================================================================================');
  console.log('📊 6. VERIFIED POST-FIX SUMMARY FOR OCTOBER 2026 (`resale_db.sales`)');
  console.log('================================================================================');
  console.log(`  • Total Active Oct 2026 Sales: ${octSales.length} (Target: 63)`);
  console.log(`  • Gross Sales:                 $${gross.toFixed(2)} (Target: $2,462.99)`);
  console.log(`  • Venue Fees (15%):            $${fee.toFixed(2)} (Target: $369.45)`);
  console.log(`  • Total Net Payout:            $${net.toFixed(2)} (Target: $2,093.54)`);
  console.log(`  • Cost Basis Recouped:         $${cost.toFixed(2)}`);
  console.log('================================================================================');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
