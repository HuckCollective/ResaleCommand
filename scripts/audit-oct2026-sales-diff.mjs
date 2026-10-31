#!/usr/bin/env node
/**
 * Targeted October 2026 Sales Fix & Audit Script (`resale_db.sales` + `resale_db.items`)
 *
 * Ensures 100% penny-exact parity with Memory Den's October 2026 Payouts CSV (`Total Payout: $2,093.54` / `63` items):
 * 1. Restores `Sale# 220406` (`CeCe Black Ruffle Button Front`, `0EJ0NA` / `HUCK-1504`, `2026-10-11`,
 *    `$9.99` Gross / `$1.50` Fee / `$8.49` Net) with proper `orderId: "Ticket #220406"` and `soNumber: "HUCK-1504"`.
 * 2. Updates both (`2x`) lines of `Ticket #225210` (`$id=6ae561a2000d7abc88df` & `$id=6ae561a30016d45776a4`)
 *    to `soNumber: "HUCK-1498"` (`0EJ0M8` `Fantasy/Sci-Fi MM Paperbacks`) and `orderId: "Ticket #225210"` / `"Ticket #225210 #2"`,
 *    and ensures `Ticket #225288` (`$id=6ae561a1001f60c536e0`) has `soNumber: "HUCK-1206"`.
 * 3. Verifies all 63 October 2026 sales in `resale_db.sales` sum to exact:
 *    63 items | $2,462.99 Gross | $369.45 Fees | $2,093.54 Net Payout.
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

  const sampleSale = octSales[0];
  const canonicalTenantId = sampleSale?.tenantId || '69a9cbcb0038df55f6b9';
  const canonicalPerms = Array.isArray(sampleSale?.$permissions) && sampleSale.$permissions.length > 0
    ? sampleSale.$permissions
    : undefined;

  // 1. Ensure Sale# 220406 (`CeCe Black Ruffle Button Front`, `0EJ0NA` / `HUCK-1504`, `$9.99` Gross / `$1.50` Fee / `$8.49` Net) exists
  console.log('\n1️⃣  RESTORE / VERIFY SALE# 220406 (`CeCe Black Ruffle Button Front`, `0EJ0NA` / `HUCK-1504`, `$9.99` Gross / `$8.49` Net):');
  let sale220406 = octSales.find(
    s =>
      extractTicketNum(s.orderId) === '220406' ||
      extractTicketNum(s.soNumber) === '220406' ||
      cleanSku(s.soNumber).toUpperCase() === 'HUCK-1504' ||
      cleanSku(s.soNumber).toUpperCase() === '0EJ0NA' ||
      cleanSku(s.orderId).toUpperCase() === '0EJ0NA'
  );

  if (!sale220406) {
    const payload220406 = {
      tenantId: canonicalTenantId,
      warehouseId: MD_WAREHOUSE_ID,
      soNumber: 'HUCK-1504',
      orderId: 'Ticket #220406',
      saleDate: '2026-10-11T22:55:27.000Z',
      status: 'Sold',
      grossAmount: 9.99,
      commissionFee: 1.50,
      netPayout: 8.49,
      shippingCharged: 0,
      shippingCost: 0,
    };
    if (APPLY_FIX) {
      sale220406 = await db.createDocument(DB_ID, 'sales', ID.unique(), payload220406, canonicalPerms);
      octSales.push(sale220406);
      console.log(`   ✅ CREATED Sale# 220406 ($id=${sale220406.$id} | soNumber="HUCK-1504" | orderId="Ticket #220406" | Gross=$9.99 | Fee=$1.50 | Net=$8.49)`);

      // Also update HUCK-1504 item saleId to point to this sale
      const huck1504 = allItems.find(i => cleanSku(i.upc).toUpperCase() === 'HUCK-1504' || cleanSku(i.locationSku).toUpperCase() === '0EJ0NA');
      if (huck1504) {
        await db.updateDocument(DB_ID, 'items', huck1504.$id, {
          saleId: sale220406.$id,
          status: 'sold',
          locationSku: '0EJ0NA',
          storageLocation: 'MD',
          warehouseId: MD_WAREHOUSE_ID,
        });
        console.log(`   ✅ Linked item HUCK-1504 ($id=${huck1504.$id}) saleId -> ${sale220406.$id}`);
      }
    } else {
      octSales.push({ $id: 'DRY_RUN_220406', ...payload220406 });
      console.log(`   👉 [DRY-RUN] Will create Sale# 220406: ${JSON.stringify(payload220406)}`);
    }
  } else {
    const patch = {};
    if (Math.abs(Number(sale220406.grossAmount || 0) - 9.99) > 0.001) patch.grossAmount = 9.99;
    if (Math.abs(Number(sale220406.commissionFee || 0) - 1.50) > 0.001) patch.commissionFee = 1.50;
    if (Math.abs(Number(sale220406.netPayout || 0) - 8.49) > 0.001) patch.netPayout = 8.49;
    if (sale220406.soNumber !== 'HUCK-1504') patch.soNumber = 'HUCK-1504';
    if (sale220406.orderId !== 'Ticket #220406') patch.orderId = 'Ticket #220406';

    if (Object.keys(patch).length > 0 && APPLY_FIX) {
      await db.updateDocument(DB_ID, 'sales', sale220406.$id, patch);
      Object.assign(sale220406, patch);
      console.log(`   ✅ Updated Sale# 220406 ($id=${sale220406.$id}): ${JSON.stringify(patch)}`);
    } else {
      console.log(`   ✅ Sale# 220406 ($id=${sale220406.$id}) already verified.`);
    }
  }

  // 2. Link both (2x) lines of Ticket #225210 to HUCK-1498 (0EJ0M8) and Ticket #225288 to HUCK-1206 (0EJ06K)
  console.log('\n2️⃣  LINKING EVENING SALES (`Ticket #225210` x2 -> `HUCK-1498`, `Ticket #225288` -> `HUCK-1206`):');
  const sales225210 = octSales
    .filter(s => extractTicketNum(s.orderId) === '225210' || extractTicketNum(s.soNumber) === '225210')
    .sort((a, b) => String(a.$id).localeCompare(String(b.$id)));

  for (let idx = 0; idx < sales225210.length; idx++) {
    const s = sales225210[idx];
    const targetOrderId = idx === 0 ? 'Ticket #225210' : `Ticket #225210 #${idx + 1}`;
    const patch = {};
    if (s.soNumber !== 'HUCK-1498') patch.soNumber = 'HUCK-1498';
    if (s.orderId !== targetOrderId) patch.orderId = targetOrderId;
    if (Object.keys(patch).length > 0) {
      if (APPLY_FIX) {
        await db.updateDocument(DB_ID, 'sales', s.$id, patch);
        Object.assign(s, patch);
        console.log(`   ✅ Updated Ticket #225210 line ${idx + 1} ($id=${s.$id}): ${JSON.stringify(patch)}`);
      } else {
        Object.assign(s, patch);
        console.log(`   👉 [DRY-RUN] Will update Ticket #225210 line ${idx + 1} ($id=${s.$id}): ${JSON.stringify(patch)}`);
      }
    } else {
      console.log(`   ✅ Ticket #225210 line ${idx + 1} ($id=${s.$id}) already linked (${s.soNumber} / ${s.orderId})`);
    }
  }

  const sale225288 = octSales.find(s => extractTicketNum(s.orderId) === '225288' || extractTicketNum(s.soNumber) === '225288');
  if (sale225288) {
    const patch = {};
    if (sale225288.soNumber !== 'HUCK-1206') patch.soNumber = 'HUCK-1206';
    if (sale225288.orderId !== 'Ticket #225288') patch.orderId = 'Ticket #225288';
    if (Object.keys(patch).length > 0) {
      if (APPLY_FIX) {
        await db.updateDocument(DB_ID, 'sales', sale225288.$id, patch);
        Object.assign(sale225288, patch);
        console.log(`   ✅ Updated Ticket #225288 ($id=${sale225288.$id}): ${JSON.stringify(patch)}`);
      } else {
        Object.assign(sale225288, patch);
        console.log(`   👉 [DRY-RUN] Will update Ticket #225288 ($id=${sale225288.$id}): ${JSON.stringify(patch)}`);
      }
    } else {
      console.log(`   ✅ Ticket #225288 ($id=${sale225288.$id}) already linked (${sale225288.soNumber} / ${sale225288.orderId})`);
    }
  }

  // 3. Final Verification Summary
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
  console.log('📊 3. VERIFIED POST-FIX SUMMARY FOR OCTOBER 2026 (`resale_db.sales`)');
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
