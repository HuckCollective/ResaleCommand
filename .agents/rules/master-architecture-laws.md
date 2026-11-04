# Resale Command — 7 Immutable Architecture Laws

> **Source of truth.** This file is embedded verbatim into `GEMINI.md` and the `hucks-resale-core` skill by `npm run skills:sync` (`scripts/sync-ai-context.mjs`). `scripts/validate-templates.mjs` fails the build if any law below is removed.

1. **LAW 1 — 4 Locations Only (`HG`, `HH`, `MD`, `DT`).**
   Every physical item and every sale belongs to exactly one of these four canonical `resale_db.warehouses` documents. Never invent a fifth location code, never create duplicate warehouse records, never leave `storageLocation` blank.

2. **LAW 2 — Zero Hardcoding.**
   No fallback dates (never stamp "today" or a past check date onto a missing sold/paid date), no rent amounts, no commission/fee percentages, no account/project IDs inside UI components, composables, API routes, or bookmarklets. Fee, rent, `usesRicochet`, `salesIntakeMode` etc. always resolve from the live Appwrite `warehouses` document via `src/lib/warehouses.ts` (+ `src/lib/locationSettingsServer.ts` on the server).

3. **LAW 3 — 100% Shared Matching via `src/lib/salesBucketing.ts`.**
   SKU/UPC/title matching, ticket parsing, partner bucketing, occurrence fingerprints, ledger de-duplication and month bucketing are implemented ONCE in `src/lib/salesBucketing.ts` (`matchMemoryDenInventoryItem`, `buildLockedMultiBinMap`, `splitTrailingBoothSku`, `canonicalTicketNumber`, `flagAlreadyRecordedRows`, `pacificMonthKey`, `calendarMonthKeyFromDateString`). Components, composables and API routes delegate to it — never re-implement matching or bucketing.

4. **LAW 4 — Appwrite-First Persistence.**
   Zero static lookup dictionaries (no `0EJxxx -> HUCK-xxxx` tables, no baked JSON snapshots) in code. Lookup maps are built at runtime, in memory, from live `resale_db` documents: `items`, `warehouses`, `sales`, `manifests`. Staging/commit state lives in `manifests`; seed historical mappings into Appwrite documents (`scripts/seed-md-booth-skus.mjs`), never into source files.

5. **LAW 5 — Enterprise UX/IA Pattern.**
   Primary canvas = Top KPIs ➔ full DataTable ➔ Sticky Bottom Action Bar (`BottomActionDock`, `fixed bottom-0`, `backdrop-blur`, `z-50`, page clearance `pb-36 sm:pb-44`, Astro page passes `hideFooter={true}`). Secondary inputs (manual CSV upload, demo loaders, paste drawers) live in right-edge Slide-Over Trays (`SalesImportTray.vue` pattern), triggered from the top toolbar — never as large cards in the page body.

6. **LAW 6 — 3-Tier Commit Idempotency.**
   Every money-moving commit must be safe to click twice, retry, or resume:
   - **Layer 1 — UI button lock:** the commit button disables synchronously on click (`isSubmitting`/`isCommitting = true`) and shows batch progress; writes are chunked (25–50 rows per request).
   - **Layer 2 — Manifest status transition:** on success the Appwrite staging manifest moves `staged ➔ committed` (`committed_at`, `committed_count`); a committed manifest hides Commit and shows "✅ Already Synced".
   - **Layer 3 — Database ticket de-duplication:** the server checks `ticket_number + sale date + location` against `sales` before every insert and skips anything already present (0 duplicate sales, ever).

7. **LAW 7 — Date Bucketing Standard.**
   Group sales by the **calendar `sold_date`** as written — never by payout/check/paid dates. Month keys are one-indexed `YYYY-MM` strings produced by string parsing (`calendarMonthKeyFromDateString`, `pacificMonthKey`) and labeled by `monthKeyToLabel` (`2026-11` ➔ `November 2026`). Never derive a month from `Date#getMonth()` (0-indexed), and never convert a date-only/UTC-midnight sold date through a time zone. `11-02-2026` and `11-03-2026` must render as "November 2026".

