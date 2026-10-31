#!/usr/bin/env node
/**
 * 100% Read-Only Diagnostic Script: Audit Unmatched In-Stock Memory Den Rows
 *
 * Usage:
 *   node scripts/audit-unmatched-md-instock.mjs
 *
 * Scans Products-2026-10-30 22_34_38.csv against resale_db.items, rules out items
 * that already have a different 0EJ... locationSku or are already claimed, and prints:
 *   1) High-confidence unambiguous matches (ready for PREVERIFIED_MD_SKU_TO_UPC_OR_ID)
 *   2) Top 3 unclaimed candidate suggestions for each remaining unmatched In-Stock row.
 */

import fs from 'node:fs';
import path from 'node:path';
import { Client, Databases, Query } from 'node-appwrite';

const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
}

const ENDPOINT = process.env.PUBLIC_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1';
const PROJECT_ID = process.env.PUBLIC_APPWRITE_PROJECT_ID || '69714b35003a8adab6bb';
const API_KEY = process.env.APPWRITE_API_KEY;
const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';

if (!API_KEY) {
  console.error('❌ Missing APPWRITE_API_KEY in .env');
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
const databases = new Databases(client);

function cleanSku(raw) {
  return String(raw ?? '').trim().replace(/^'+/, '').trim();
}

function normTitle(str) {
  return String(str ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function parseCsvRfc4180(text) {
  const clean = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') {
        row.push(field.trim());
        field = '';
      } else if (ch === '\r' && next === '\n') {
        row.push(field.trim());
        if (row.some(c => c.length > 0)) rows.push(row);
        row = [];
        field = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        row.push(field.trim());
        if (row.some(c => c.length > 0)) rows.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    if (row.some(c => c.length > 0)) rows.push(row);
  }
  return rows;
}

const STOP = new Set([
  'the', 'and', 'with', 'for', 'from', 'vintage', 'style', 'new', 'old', 'size',
  'black', 'white', 'red', 'blue', 'green', 'brown', 'womens', 'mens',
]);

async function main() {
  const csvCandidates = [
    path.resolve(process.cwd(), 'Products-2026-10-30 22_34_38.csv'),
    path.resolve(process.cwd(), 'data', 'Products-2026-10-30 22_34_38.csv'),
  ];
  const csvPath = csvCandidates.find(p => fs.existsSync(p));
  if (!csvPath) {
    console.error('❌ Could not find Products-2026-10-30 22_34_38.csv');
    process.exit(1);
  }

  console.log(`📂 Reading ${path.basename(csvPath)}...`);
  const rows = parseCsvRfc4180(fs.readFileSync(csvPath, 'utf8'));
  const headers = rows[0].map(h => h.toLowerCase().trim());
  const skuIdx = headers.indexOf('sku');
  const upcIdx = headers.indexOf('upc');
  const titleIdx = headers.indexOf('title');
  const priceIdx = headers.indexOf('price');
  const invIdx = headers.indexOf('inventory');
  const qtyIdx = headers.indexOf('quantity');

  const allItems = [];
  let cursor = null;
  while (true) {
    const queries = [Query.limit(100), Query.orderDesc('$id')];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const res = await databases.listDocuments(DB_ID, 'items', queries);
    allItems.push(...res.documents);
    if (res.documents.length < 100) break;
    cursor = res.documents[res.documents.length - 1].$id;
  }

  console.log(`📦 Loaded ${allItems.length} items from resale_db.items.`);

  const claimedIds = new Set();
  const inStockRows = [];

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    const sku = cleanSku(cols[skuIdx]).toUpperCase();
    const upc = cleanSku(cols[upcIdx]).toUpperCase();
    const title = String(cols[titleIdx] || '').trim();
    const price = parseFloat(String(cols[priceIdx] || '0').replace(/[^0-9.-]/g, '')) || 0;
    const inv = String(cols[invIdx] || '').trim();
    const qty = parseInt(String(cols[qtyIdx] || '1'), 10) || 1;
    if (!/^0EJ/i.test(sku)) continue;

    // Direct UPC or SKU match
    const direct = allItems.find(it => {
      const iUpc = cleanSku(it.upc).toUpperCase();
      const iSku = cleanSku(it.locationSku || it.sku).toUpperCase();
      return (upc && iUpc === upc) || (sku && iSku === sku);
    });
    if (direct) {
      claimedIds.add(direct.$id);
      continue;
    }

    if (/in\s*stock/i.test(inv)) {
      inStockRows.push({ sku, upc, title, price, qty });
    }
  }

  console.log(`\n🔍 Auditing ${inStockRows.length} Unmatched In-Stock 0EJ Rows (ruling out items with other 0EJ SKUs & sold items):\n`);

  for (const r of inStockRows) {
    const rNorm = normTitle(r.title);
    const rTokens = rNorm.split(' ').filter(t => t.length >= 3 && !STOP.has(t));

    const scored = [];
    for (const it of allItems) {
      if (claimedIds.has(it.$id)) continue;
      const st = String(it.status || '').toLowerCase();
      if (st === 'sold' || st === 'combined' || st === 'deconstructed' || st === 'tracked' || st === 'draft' || st === 'scouted') continue;
      const iSku = cleanSku(it.locationSku || it.sku).toUpperCase();
      if (/^0EJ/i.test(iSku) && iSku !== r.sku) continue;

      const iNorm = normTitle(it.title || it.identity);
      const iSet = new Set(iNorm.split(' ').filter(Boolean));
      const hits = rTokens.filter(t => iSet.has(t) || iNorm.includes(t));
      const dbPrice = Number(it.resalePrice || 0);
      const priceDiff = r.price > 0 && dbPrice > 0 ? Math.abs(dbPrice - r.price) : 999;

      if (hits.length === 0 && priceDiff > 0.05) continue;
      const score = hits.length * 18 + (priceDiff < 0.05 ? 25 : priceDiff <= 5 ? 12 : 0);
      scored.push({ it, score, hits, priceDiff, dbPrice });
    }

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 3);
    console.log(`[${r.sku}] $${r.price.toFixed(2)} | "${r.title}"`);
    if (top.length === 0) {
      console.log(`   └─ (No unclaimed candidates with keyword/price overlap)`);
    } else {
      for (const c of top) {
        console.log(
          `   └─ Score ${c.score}: [${c.it.upc || c.it.$id}] $${c.dbPrice.toFixed(2)} (${c.it.status} @ ${c.it.storageLocation || 'HG'}) "${c.it.title}" [hits: ${c.hits.join(', ')}]`
        );
      }
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

