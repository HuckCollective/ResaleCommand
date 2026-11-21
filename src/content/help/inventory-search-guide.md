# 🔍 Inventory Search & Filter Guide

Search runs across both **Table** and **Card** views and keeps active filters in the page address so switching views never loses your place.

## Quick Keyboard Shortcuts
- Press **`/`** anywhere on the page to jump straight to the search box.
- Press **`Esc`** inside the search box to clear your query or step out.

## Everyday Search Tips
- **Multi-word matching:** `brass dragon` finds items with *both* words in any order across titles, tags, barcodes, booth SKUs, vendors, and lot contents.
- **Exact phrases:** `"first edition"` matches words in that exact order.
- **Exclude unwanted terms:** Add `-` before a word or quoted phrase — e.g. `ttrpg -dice` or `vintage -"missing lid"`.

## Targeted Prefixes
- **`upc:` / `barcode:`** — Match barcode tags only (e.g. `upc:11508` or `barcode:HUCK-1024`).
- **`sku:`** — Match booth shelf SKUs (e.g. `sku:0EJ`).
- **`loc:`** — Match physical location codes (e.g. `loc:MD` or `loc:HG`).
- **`notes:` / `desc:`** — Search directly inside condition notes or market descriptions (e.g. `notes:chip`, `desc:signed`).

## Paste a List of Tags
- Paste comma-separated barcodes or SKUs (`HUCK-1024, HUCK-1025, 0EJ08G`) to pull up every matching item at once for batch staging or label printing.

## Notes & Descriptions Toggle
- By default, general search stays focused on titles, tags, SKUs, and lot pieces so long item write-ups don't add noise.
- Whenever extra matches appear inside write-ups, click **`📝 +N in notes & descriptions`** below the toolbar to include them — matching cards and rows show where the match came from.
