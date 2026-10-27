---
name: multi-angle-photo-slicing
description: Contract and standards for multi-angle item "views" + bounding boxes returned by AI lot inspection, front/back spatial correlation, CORS-safe canvas auto-cropping via /api/proxy-image, and automatic imageId + galleryImageIds population when deconstructing lots in the Lot Splitter.
---

# Multi-Angle Photo Slicing

Use when touching `inspectLotWithGemini` / `inspectSinglePhoto`, the `componentItemSchema`, `LotSplitterWizard.vue`, or `src/lib/photoSlicing.ts`.

## 1. `views` schema contract

Every `lot_items` entry (and every `ComponentItem`) carries:

- `image_index`: 0-based primary photo index (Photo #N in the prompt = index N-1).
- `bounding_box`: `[ymin, xmin, ymax, xmax]`, integers 0-1000 (fraction of that photo's height/width).
- `views`: `Array<{ role: 'front'|'back'|'spine'|'detail'|'tag'; image_index: number; bounding_box: [ymin,xmin,ymax,xmax] }>` - one entry for EVERY photo where this specific item appears. The first entry is the primary front view.

Sources of truth:
- Schema: `src/lib/ai/schemas/common.schema.ts` (`componentItemSchema`)
- Prompt: `buildLotInspectionUserPrompt` in `src/lib/ai/instructions/prompt-builders.ts`
- Types + sanitizers: `ItemView`, `normalizeBoundingBox`, `normalizeItemViews` in `src/lib/ai-inspection.ts`

Invariants:
- Never strip `image_index`, `bounding_box` or `views` (verification spreads `...item`; keep it that way).
- Sanitize: indexes within the gallery size, boxes clamped to 0-1000 with `ymin<ymax`/`xmin<xmax`, de-duplicated, unknown roles become `detail`. If no views exist but a primary box does, synthesize a single `front` view.
- Never invent a view for a photo where the item is not visible.

## 2. Front/back spatial correlation

- Overview shots: match Photo #1 fronts to Photo #2 backs per item.
- Turning items over mirrors the left-to-right order (leftmost front = rightmost back when flipped horizontally). Correlate by size, color, shape and visible text, not position alone.
- Closeups (interior maps, inked/signed pages, copyright pages, flaw shots) attach to the matching item as `detail`; price/brand tags as `tag`.

## 3. CORS-safe canvas cropping

- Always load gallery sources via `getProxiedAssetUrl()` (`/api/proxy-image?url=...`) with `img.crossOrigin = 'anonymous'` - never draw a raw Appwrite URL to a canvas.
- Use `cropPhotoToJpeg()` in `src/lib/photoSlicing.ts`:
  - `x = xmin/1000*naturalWidth`, `y = ymin/1000*naturalHeight`
  - `w = (xmax-xmin)/1000*naturalWidth`, `h = (ymax-ymin)/1000*naturalHeight`
  - 5% padding, clamped to image bounds; export JPEG Blob + DataURL.
- No bounding box yet: show the full assigned photo (`images[image_index || 0]`), never a blank icon, and offer the "Auto-Crop Photos" trigger.
- Keep Blobs outside Vue reactivity (plain `Map`); only the preview DataURL lives in state.

## 4. Lot deconstruction: imageId + galleryImageIds

In `LotSplitterWizard.vue` (Step 4 "Create SKUs"):
- Upload the primary `front` crop Blob to `BUCKET_ID` -> child `imageId`.
- Upload every other view (`back`, `spine`, `detail`, `tag`) -> child `galleryImageIds`.
- Multi-qty / bundle SKUs: first item's full view set plus the front crop of each other item (cap 8).
- Only fall back to cloning the parent photo (`duplicateItemMediaInStorage`) when no crop/upload succeeded.
- Step 2 shows a thumbnail strip per item with role badges (tap to cycle role) and a "+" to toggle any gallery photo.

## 5. Related Lot Splitter rules

- Step 2 TAG PRICE defaults to each item's own Boutique midpoint (`getSubItemBoutique` + `parsePriceValue`); never overwrite with a flat tier average unless the user switches that tier to Multi-Qty.
- Tier 2 defaults to "Single Items" when component titles are distinct or the playbook says "Split into N Singles".
- "Rollback Lot" shows only when `status === 'combined'` or the lot has child documents.
