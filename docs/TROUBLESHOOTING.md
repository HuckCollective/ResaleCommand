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
* **Harmless**: It has no connection to Resale Command, Vue reactivity, Appwrite Storage, or database saving.
* **Verification**: Running the page in an Incognito / Private window eliminates the message completely.
