# Resale Command: Troubleshooting & Browser Quirks Guide

This document catalogs common environmental quirks, browser extension behaviors, and frontend debugging notes.

---

## 1. Chrome Extension Message Channel Timeout

### Symptom in Console
```text
3 6a97788…:1 Uncaught (in promise) Error: A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received
```

### When It Occurs
* Often right after clicking **Fetch** on a ShopGoodwill, eBay, or online auction link in the Item Drawer.
* On Line 1 of the PO Details or Inventory view (`<id>:1`).

### Cause
* Third-party **Chrome browser extensions** (especially coupon/cashback tools like Honey, Rakuten, Capital One Shopping, or password autofills) hook into `window.fetch` to check URLs.
* When Resale Command proxies external photos, the extension tries to communicate asynchronously with its own background service worker (`chrome.runtime.sendMessage`).
* When the extension worker sleeps or times out, Chrome logs this error on the page.

### Impact & Solution
* **Impact & Solution**: Harmless. Has no connection to Resale Command, Vue reactivity, Appwrite Storage, or database saving. Running in an Incognito / Private window eliminates it.

---

## 2. Appwrite 5,000 Document Boundary & Cursor Pagination Playbook

### Why the 400-Row Cutoff Happened (Historical Context)
* Bulk imports (ShopGoodwill CSVs, Ricochet POS syncs) create hundreds of items within the **exact same second**, sharing identical `$createdAt` timestamps.
* When paginating using `Query.orderDesc('$createdAt')` with `Query.cursorAfter(cursorId)`, Appwrite evaluates `WHERE $createdAt < cursor.createdAt`.
* Because all subsequent items in that batch share the identical timestamp, Appwrite skips them all and halts (which caused the historic 400-item cutoff).

### The Rule for Paginating Past 5,000 Items
1. **Never cursor paginate on `$createdAt`**:
   * Always paginate using unique document IDs:
     ```ts
     const queries = [
         Query.orderDesc('$id'), // 100% unique & monotonic
         Query.limit(pageSize)   // Max 5000 per request
     ];
     if (cursor) {
         queries.push(Query.cursorAfter(cursor));
     }
     ```
   * Live verified: `Query.orderDesc('$id')` traverses 100% of items smoothly through 5k, 10k, and 50k+ documents without stalling on bulk batches.

2. **The 4,000-Item Warning Track**:
   * When `totalItems` crosses 4,000 (~80% of single-query capacity), prepare for multi-batch fetching.
   * `pageSize: 5000` is Appwrite's maximum per single request. Crossing 5,000 requires the `while (hasMoreItems)` loop with `$id` cursor chaining.

3. **DOM Virtualization is Already Active**:
   * `InventoryManager.vue` renders in progressive chunks of 40 (`displayLimit = 40` with `IntersectionObserver`), meaning client memory handles 10,000+ items smoothly without freezing mobile browsers.

4. **25,000+ Items Migration Target**:
   * Above 25k items, switch from loading all items into client memory to **Server-Side Search & Pagination**:
     * `Query.equal('status', filterStatus)`
     * `Query.search('title', searchQuery)`
     * `Query.limit(50)` + `Query.offset(skip)`
