import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import { Client, Databases, Query, ID, Permission, Role } from 'node-appwrite';
import { getDatabaseId, resolveCollectionId } from '../../../lib/appwriteEnv';

export const prerender = false;

const ENDPOINT = import.meta.env.PUBLIC_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1';
const PROJECT_ID = import.meta.env.PUBLIC_APPWRITE_PROJECT_ID || '69714b35003a8adab6bb';
const API_KEY = import.meta.env.APPWRITE_API_KEY || process.env.APPWRITE_API_KEY;
const DB_ID = getDatabaseId();
const SALES_COL = resolveCollectionId('sales');
const ITEMS_COL = resolveCollectionId('items');
const WAREHOUSES_COL = resolveCollectionId('warehouses');

function splitCsvLine(line: string): string[] {
  const regex = /(?:^|,)(?:"([^"]*)"|([^,]*))/g;
  const result: string[] = [];
  let match;
  while ((match = regex.exec(line)) !== null) {
    if (match[1] !== undefined) result.push(match[1]);
    else if (match[2] !== undefined) result.push(match[2]);
    if (regex.lastIndex === match.index) regex.lastIndex++;
  }
  return result;
}

interface ParsedSaleRow {
  itemName: string;
  extractedSku: string;
  ticketNumber: string;
  soldDate: string;
  paidDate: string;
  grossPrice: number;
  fee: number;
  netPrice: number;
  cycleKey: string;
}

function parsePayoutCsv(): { rows: ParsedSaleRow[]; rentDeductions: Record<string, number> } {
  const csvPath = path.resolve(process.cwd(), 'public', 'MemoryDen_MultiMonth_Payout_Full.csv');
  if (!fs.existsSync(csvPath)) {
    throw new Error('MemoryDen_MultiMonth_Payout_Full.csv not found');
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return { rows: [], rentDeductions: {} };

  const headers = splitCsvLine(lines[0]).map(h => h?.trim().toLowerCase().replace(/"/g, ''));
  const itemIdx = headers.findIndex(h => h === 'name' || h === 'item' || h === 'product name');
  const agreedIdx = headers.findIndex(h => h.includes('agreed') || h === 'price');
  const agedIdx = headers.findIndex(h => h.includes('aged price') || h.includes('sale price'));
  const amountIdx = headers.findIndex(h => h === 'amount' || h.includes('amount'));
  const paidIdx = headers.findIndex(h => h === 'paid');
  const soldIdx = headers.findIndex(h => h === 'sold');
  const ticketIdx = headers.findIndex(h => h === 'sale' || h === 'ticket');
  const splitIdx = headers.findIndex(h => h.includes('cost/split') || h.includes('split'));

  const rows: ParsedSaleRow[] = [];
  const rentDeductions: Record<string, number> = {};

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length <= itemIdx) continue;

    const fullItemName = cols[itemIdx]?.trim() || '';
    if (!fullItemName) continue;

    const lower = fullItemName.toLowerCase();
    if (lower.includes('total for payout') || lower.includes('total paid:')) continue;

    if (lower.includes('space rental') || lower.includes('(credit)')) {
      let rentAmt = 382.50;
      for (const col of cols) {
        const val = parseFloat((col || '').replace(/[^0-9.-]+/g, ''));
        if (!isNaN(val) && val < 0) {
          rentAmt = Math.abs(val);
          break;
        }
      }
      const dateMatch = fullItemName.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
      let rDate = dateMatch ? `${dateMatch[3]}-${dateMatch[1].padStart(2, '0')}` : (cols[soldIdx] || cols[paidIdx] || '');
      if (rDate.includes('-') && rDate.length >= 7) {
        rentDeductions[rDate.slice(0, 7)] = rentAmt;
      }
      continue;
    }

    let gross = agreedIdx !== -1 ? parseFloat((cols[agreedIdx] || '').replace(/[^0-9.-]+/g, '')) || 0 : 0;
    if (gross === 0 && agedIdx !== -1) {
      gross = parseFloat((cols[agedIdx] || '').replace(/[^0-9.-]+/g, '')) || 0;
    }

    let net = amountIdx !== -1 ? parseFloat((cols[amountIdx] || '').replace(/[^0-9.-]+/g, '')) || 0 : 0;
    if (net === 0 && gross > 0) {
      let split = 85;
      if (splitIdx !== -1 && cols[splitIdx]) {
        const pSplit = parseFloat(cols[splitIdx].replace(/[^0-9.]/g, ''));
        if (pSplit > 0 && pSplit <= 100) split = pSplit;
      }
      net = Number((gross * (split / 100)).toFixed(2));
    }

    const fee = Math.max(0, Number((gross - net).toFixed(2)));
    const soldDateRaw = soldIdx !== -1 ? (cols[soldIdx]?.trim() || '') : '';
    const paidDateRaw = paidIdx !== -1 ? (cols[paidIdx]?.trim() || '') : '';
    const ticket = ticketIdx !== -1 ? (cols[ticketIdx]?.trim() || '') : '';

    let extractedSku = '';
    const skuMatch = fullItemName.match(/ - ([A-Z0-9-]+)$/);
    if (skuMatch) extractedSku = skuMatch[1].trim();

    let cycleKey = '';
    if (soldDateRaw) {
      const parts = soldDateRaw.split(/[-/]/);
      if (parts.length === 3) {
        cycleKey = `${parts[2]}-${parts[0].padStart(2, '0')}`;
      }
    }

    rows.push({
      itemName: fullItemName,
      extractedSku,
      ticketNumber: ticket,
      soldDate: soldDateRaw,
      paidDate: paidDateRaw,
      grossPrice: gross,
      fee,
      netPrice: net,
      cycleKey
    });
  }

  return { rows, rentDeductions };
}

export const GET: APIRoute = async ({ url }) => {
  try {
    if (!API_KEY) {
      return new Response(JSON.stringify({ error: 'APPWRITE_API_KEY missing' }), { status: 500 });
    }

    const execute = url.searchParams.get('execute') === 'true';
    const purgeOnly = url.searchParams.get('purgeOnly') === 'true';
    const purgeAll = url.searchParams.get('purgeAll') === 'true';
    const dedupeOnly = url.searchParams.get('dedupeOnly') === 'true';
    const tenantOverride = url.searchParams.get('tenantId') || undefined;

    if (dedupeOnly) {
      const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
      const db = new Databases(client);

      const allSales: any[] = [];
      let offset = 0;
      while (true) {
        const res = await db.listDocuments(DB_ID, SALES_COL, [
          Query.limit(100),
          Query.offset(offset)
        ]);
        allSales.push(...res.documents);
        offset += res.documents.length;
        if (offset >= res.total || res.documents.length === 0) break;
      }

      const seen = new Set<string>();
      const idsToDelete: string[] = [];

      for (const s of allSales) {
        const sig = `${s.soNumber}|${s.orderId}|${s.saleDate}|${s.grossAmount}`;
        if (seen.has(sig)) {
          idsToDelete.push(s.$id);
        } else {
          seen.add(sig);
        }
      }

      let deleted = 0;
      for (let i = 0; i < idsToDelete.length; i += 25) {
        const chunk = idsToDelete.slice(i, i + 25);
        const results = await Promise.allSettled(chunk.map(id => db.deleteDocument(DB_ID, SALES_COL, id)));
        deleted += results.filter(r => r.status === 'fulfilled').length;
        await new Promise(r => setTimeout(r, 60));
      }

      return new Response(JSON.stringify({
        success: true,
        totalFound: allSales.length,
        duplicatesFound: idsToDelete.length,
        deletedCount: deleted,
        remainingCount: allSales.length - deleted
      }, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (execute) {
      return await executeSyncAction(tenantOverride, purgeAll, purgeOnly);
    }

    const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
    const db = new Databases(client);

    const existingSalesRes = await db.listDocuments(DB_ID, SALES_COL, [
      Query.limit(1000)
    ]);

    const docs = existingSalesRes.documents;
    const soPartnerSales = docs.filter(d => 
      (d.soNumber && d.soNumber.startsWith('SO-')) || 
      (d.orderId && d.orderId.startsWith('SYNC-')) ||
      (d.orderId && d.orderId.startsWith('MD-PAYOUT')) ||
      (!d.soNumber && !d.orderId)
    );

    const { rows } = parsePayoutCsv();
    const cycleCounts: Record<string, { count: number; gross: number; net: number }> = {};
    for (const r of rows) {
      if (!cycleCounts[r.cycleKey]) {
        cycleCounts[r.cycleKey] = { count: 0, gross: 0, net: 0 };
      }
      cycleCounts[r.cycleKey].count++;
      cycleCounts[r.cycleKey].gross = Number((cycleCounts[r.cycleKey].gross + r.grossPrice).toFixed(2));
      cycleCounts[r.cycleKey].net = Number((cycleCounts[r.cycleKey].net + r.netPrice).toFixed(2));
    }

    const existingMonthlyCounts: Record<string, number> = {};
    for (const d of docs) {
      const month = d.saleDate ? d.saleDate.slice(0, 7) : 'no-date';
      existingMonthlyCounts[month] = (existingMonthlyCounts[month] || 0) + 1;
    }

    return new Response(JSON.stringify({
      message: 'Status check ready.',
      currentDatabaseStatus: {
        totalSalesInDb: existingSalesRes.total,
        legacySoPartnerSalesCount: soPartnerSales.length,
        cleanSalesCount: docs.length - soPartnerSales.length,
        existingMonthlyCounts
      },
      sampleMaySales: docs.filter(d => d.saleDate && d.saleDate.startsWith('2026-05')).slice(0, 10).map(d => ({
        id: d.$id,
        soNumber: d.soNumber,
        orderId: d.orderId,
        gross: d.grossAmount,
        date: d.saleDate
      })),
      canonicalPayoutFile: {
        merchandiseItemsToImport: rows.length,
        monthlyCycles: cycleCounts
      }
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

async function executeSyncAction(tenantIdOverride?: string, purgeAll: boolean = true, purgeOnly: boolean = false) {
  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY!);
  const db = new Databases(client);

  // 1. Find Memory Den Warehouse ID
  let mdWarehouseId = '6a7e70050009db0e1857'; // Canonical Memory Den - Huck's Adventures Outfitters
  try {
    const whRes = await db.listDocuments(DB_ID, WAREHOUSES_COL, [Query.limit(50)]);
    const mdWh = whRes.documents.find(w => 
      w.$id === '6a7e70050009db0e1857' ||
      (w.code && w.code.toUpperCase() === 'MD') ||
      (w.name && w.name.toLowerCase().includes('memory den'))
    );
    if (mdWh) mdWarehouseId = mdWh.$id;
  } catch (whErr) {
    console.warn("Could not find warehouse:", whErr);
  }

  // 2. Detect tenantId from sales or items
  let detectedTenantId = tenantIdOverride || '69a9cbcb0038df55f6b9';
  if (!tenantIdOverride) {
    const sample = await db.listDocuments(DB_ID, SALES_COL, [Query.limit(5)]);
    const foundTenant = sample.documents.find(d => d.tenantId)?.tenantId;
    if (foundTenant) detectedTenantId = foundTenant;
  }

  // 3. Fast Parallel Purge of existing duplicate sales in batches of 50
  let purgedCount = 0;
  while (true) {
    const res = await db.listDocuments(DB_ID, SALES_COL, [Query.limit(100)]);
    if (res.documents.length === 0) break;

    const docsToDelete = purgeAll ? res.documents : res.documents.filter(sale => {
      const isLegacy = 
        (sale.soNumber && sale.soNumber.startsWith('SO-')) ||
        (sale.orderId && sale.orderId.startsWith('SYNC-')) ||
        (sale.orderId && sale.orderId.startsWith('MD-PAYOUT')) ||
        (!sale.soNumber && !sale.orderId);
      return isLegacy;
    });

    if (docsToDelete.length === 0) {
      break;
    }

    // Run chunk deletion concurrently with slight pause to avoid Appwrite rate limits
    for (let i = 0; i < docsToDelete.length; i += 25) {
      const chunk = docsToDelete.slice(i, i + 25);
      const results = await Promise.allSettled(chunk.map(d => db.deleteDocument(DB_ID, SALES_COL, d.$id)));
      purgedCount += results.filter(r => r.status === 'fulfilled').length;
      await new Promise(resolve => setTimeout(resolve, 80));
    }
  }

  if (purgeOnly) {
    return new Response(JSON.stringify({
      success: true,
      message: 'Purge completed successfully.',
      purgedLegacyCount: purgedCount
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 4. Fetch Inventory Items for Linking
  const inventoryItems: any[] = [];
  let itemOffset = 0;
  while (true) {
    const iRes = await db.listDocuments(DB_ID, ITEMS_COL, [
      Query.limit(100),
      Query.offset(itemOffset)
    ]);
    inventoryItems.push(...iRes.documents);
    itemOffset += iRes.documents.length;
    if (itemOffset >= iRes.total || iRes.documents.length === 0) break;
  }

  // 5. Parse canonical CSV and insert clean sales
  const { rows } = parsePayoutCsv();
  let importedCount = 0;

  // Build document permissions so both team and authenticated users can view/manage
  const permissions: string[] = [];
  if (detectedTenantId) {
    const teamRole = Role.team(detectedTenantId);
    permissions.push(
      Permission.read(teamRole),
      Permission.update(teamRole),
      Permission.delete(teamRole)
    );
  }
  permissions.push(
    Permission.read(Role.users()),
    Permission.update(Role.users())
  );

  const rowChunks: any[][] = [];
  for (let i = 0; i < rows.length; i += 20) {
    rowChunks.push(rows.slice(i, i + 20));
  }

  for (const chunk of rowChunks) {
    await Promise.allSettled(chunk.map(async (r) => {
      // Real register date first: CSV row's Sold date, then the matched item's soldDate; "now" only as a last resort
      let saleDateIso = new Date().toISOString();
      let datedFromRow = false;
      if (r.soldDate) {
        const parts = r.soldDate.split(/[-/]/);
        if (parts.length === 3) {
          const d = new Date(parseInt(parts[2], 10), parseInt(parts[0], 10) - 1, parseInt(parts[1], 10), 12, 0, 0);
          if (!isNaN(d.getTime())) {
            saleDateIso = d.toISOString();
            datedFromRow = true;
          }
        }
      }

      let matchedItem = null;
      if (r.extractedSku) {
        matchedItem = inventoryItems.find(i => 
          i.locationSku?.toUpperCase() === r.extractedSku.toUpperCase() ||
          i.upc?.toUpperCase() === r.extractedSku.toUpperCase()
        );
      }

      if (!datedFromRow && matchedItem?.soldDate) {
        const itemDate = new Date(matchedItem.soldDate);
        if (!isNaN(itemDate.getTime())) saleDateIso = itemDate.toISOString();
      }

      const cleanTitle = r.itemName.replace(/\s*-\s*[A-Z0-9-]+$/, '').trim();
      const orderRef = r.ticketNumber ? `T-${r.ticketNumber} • ${cleanTitle}` : cleanTitle;
      const soNum = matchedItem?.upc || r.extractedSku || `MD-${r.ticketNumber || ID.unique().slice(-6)}`;

      const saleData = {
        soNumber: soNum,
        orderId: orderRef,
        saleDate: saleDateIso,
        status: 'Sold',
        grossAmount: r.grossPrice,
        commissionFee: r.fee,
        netPayout: r.netPrice,
        shippingCharged: 0,
        shippingCost: 0,
        warehouseId: mdWarehouseId,
        tenantId: matchedItem?.tenantId || detectedTenantId
      };

      try {
        const createdSale = await db.createDocument(DB_ID, SALES_COL, ID.unique(), saleData, permissions);
        importedCount++;

        if (matchedItem && matchedItem.status !== 'sold') {
          try {
            await db.updateDocument(DB_ID, ITEMS_COL, matchedItem.$id, {
              status: 'sold',
              soldPrice: r.netPrice,
              resalePrice: r.grossPrice,
              saleId: createdSale.$id
            });
          } catch (uErr) {
            // ignore
          }
        }
      } catch (insErr) {
        console.warn("Could not insert sale:", insErr);
      }
    }));
  }

  return new Response(JSON.stringify({
    success: true,
    message: 'Successfully purged legacy sales and imported canonical Memory Den sales!',
    purgedLegacyCount: purgedCount,
    importedCanonicalCount: importedCount,
    activeTenantId: detectedTenantId,
    warehouseId: mdWarehouseId
  }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    if (!API_KEY) {
      return new Response(JSON.stringify({ error: 'APPWRITE_API_KEY missing' }), { status: 500 });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    return await executeSyncAction(body.tenantId, body.purgeAll !== false, body.purgeOnly);
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
