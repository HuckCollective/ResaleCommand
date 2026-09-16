# Appwrite Storage & Media Architecture Guide

This document outlines the end-to-end media, image storage, and AI-vision pipeline in Resale Command across Astro, Appwrite Cloud, and Vercel.

---

## 1. Core Architecture Principles

### A. Direct Client Uploads (Bypassing Vercel 4.5MB Serverless Limit)
Vercel serverless functions enforce a strict **4.5 MB request body limit**. Sending high-resolution listing photos or multi-image galleries through an Astro API route to upload them to Appwrite causes instant `413 Payload Too Large` failures.

**The Solution:**
- Clients upload directly to Appwrite Storage via the client SDK (`storage.createFile(BUCKET_ID, ID.unique(), file, publicPermissions)`).
- Chunking: Files are streamed directly to Appwrite Cloud with public read permissions.
- Only the lightweight metadata (`imageId`, `galleryImageIds`) is saved to the Appwrite Database document.

---

## 2. Solving Browser CORS in Canvas & Fetch Operations

### The Problem
When client JavaScript (e.g. `ItemDrawer.vue` or `useMediaAssetManager.ts`) calls `fetch()` on raw Appwrite URLs (`https://sfo.cloud.appwrite.io/v1/storage/buckets/...`), the browser blocks the request with a **CORS error** (`No 'Access-Control-Allow-Origin' header`). Standard `<img src="...">` tags can display the photo, but client-side Canvas operations (resizing for AI, cropping, generating base64) throw security errors.

### The Solution: Canonical `getProxiedAssetUrl` & `fetchAssetBlob`
Located in [`src/lib/inventory.ts`](file:///c:/Users/15034/Projects/ResaleCommand/src/lib/inventory.ts):
- **`getProxiedAssetUrl(idOrUrl)`**: Automatically routes remote/Appwrite URLs through `/api/proxy-image?url=...`.
- **`fetchAssetBlob(idOrUrl)`**: Fetches the image through `/api/proxy-image`.
- **Same-Origin Proxy ([`src/pages/api/proxy-image.ts`](file:///c:/Users/15034/Projects/ResaleCommand/src/pages/api/proxy-image.ts))**:
  - Runs on the serverless backend.
  - Automatically injects `X-Appwrite-Project` and `X-Appwrite-Key`.
  - Follows redirects and streams back binary blobs with appropriate `Content-Type` and `Cache-Control`.
  - Browser has **zero CORS errors**!

---

## 3. The AI Vision Canvas Pipeline (`convertAssetToBase64`)

When sending multi-photo lots (e.g. `HUCK-1455`, `HUCK-1460` with 8 to 43 photos) to Gemini AI for Deep Research:
1. The client calls `convertAssetToBase64(idOrUrl, 1024)`.
2. Safe fetch: acquires the image Blob via `fetchAssetBlob`.
3. In-memory Canvas: draws the photo and downscales the largest dimension to 1024px.
4. Compression: exports a lightweight JPEG base64 data URL (`canvas.toDataURL('image/jpeg', 0.85)`).
5. Delivery: Pure base64 images are sent directly to `/api/inspect-lot`. Gemini receives 100% of the photos without needing to re-fetch external URLs on the backend.

---

## 4. Media Duplication & Ownership on Split / Duplicate

When a user splits an item into active inventory (`splitOneActive`), sells a unit (`sellOneQuantity`), or deconstructs a lot:
- **Reference Copy**: The child item immediately inherits the parent's `imageId` and `galleryImageIds` via `cloneItemMediaPayload(parent)` so the UI never displays a blank placeholder.
- **Deep Storage Duplication**: Asynchronously calls `duplicateItemMediaInStorage(parent)` in the background:
  - Fetches the parent photo Blob via `fetchAssetBlob`.
  - Uploads a brand new physical file to Appwrite Storage with `ID.unique()`.
  - Updates the child item with the new file ID.
- **Why this matters**: The child item now **owns its own independent storage file**. If a user later modifies, replaces, or deletes photos on the child item, the parent lot's photos remain completely untouched.

---

## 5. Storage Garbage Collection Pattern (`/api/cleanup-asset`)

When users delete an image or remove photos during editing, orphaned files should not permanently consume storage quota.

### Recommended Route: `src/pages/api/cleanup-asset.ts`
```typescript
import type { APIRoute } from 'astro';
import { Client, Storage } from 'node-appwrite';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { fileId, bucketId = 'item_images' } = await request.json();
    if (!fileId) {
      return new Response(JSON.stringify({ error: 'Missing fileId' }), { status: 400 });
    }

    const client = new Client()
      .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1')
      .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID || '69714b35003a8adab6bb')
      .setKey(process.env.APPWRITE_API_KEY || '');

    const storage = new Storage(client);
    await storage.deleteFile(bucketId, fileId);

    return new Response(JSON.stringify({ success: true, fileId }), { status: 200 });
  } catch (error: any) {
    console.error('[cleanup-asset] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
```

---

## 6. Vercel Edge Caching Headers (`vercel.json`)

To cache Appwrite preview images on Vercel's global CDN:
```json
{
  "headers": [
    {
      "source": "/api/proxy-image(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=86400"
        }
      ]
    }
  ]
}
```
This ensures proxied image previews are cached at the edge nearest to the user, providing near-instant subsequent loads.
