# Prompt 02 — Build the Storefront Catalog & Channel Dispatcher Cloud Functions in `thehc-platform`

Paste the block below into the IDE window opened on `thehc-platform`. Read the blueprint first: [`docs/ONLINE_STOREFRONT_AND_CHANNEL_ARCHITECTURE.md`](../ONLINE_STOREFRONT_AND_CHANNEL_ARCHITECTURE.md) (attach `ResaleCommand` read-only).

```text
RECOMMENDED MODEL: Gemini 4 Carbon (High) or Orchestrator (Carbon)
BEST GEMINI $0-POOL SWAP: Gemini 4 Neon (High) or Orchestrator (Neon) for the 1-turn plan audit

TASK: Stage 1 — build the zero-PII sharded public storefront catalog Cloud Function and the shared storefront contracts in `thehc-platform`, plus a safe skeleton for the channel dispatcher.

PRE-FLIGHT (DO NOT SKIP):
1. Confirm your active workspace is `thehc-platform`.
2. Read `../ResaleCommand/docs/ONLINE_STOREFRONT_AND_CHANNEL_ARCHITECTURE.md` (sections 2, 3, 6, 7 are binding) and `../ResaleCommand/.agents/rules/sales-reconciliation-and-payout-invariants.md`. If you cannot read `../ResaleCommand`, STOP and ask me to attach it read-only. NEVER guess its contents and NEVER edit anything inside `../ResaleCommand`.
3. Read `functions/fn-coop-waterfall-ledger/` (src, test, package.json, tsdown config, scripts/verify-bundled.mjs), `packages/core/src/appwrite`, `packages/core/src/domain`, `appwrite.config.json`, and `tools/scripts`.
4. Present a short implementation plan and wait for my approval before writing code.

FORBIDDEN ACTIONS:
- Zero edits to `../ResaleCommand` or `../thehcllc`.
- On Windows (`win32`) NEVER run `astro build`, `vite build`, Playwright, Puppeteer, or headless browsers.
- Zero `.cmd` suffixes inside any `package.json` script.
- Zero `@google/generative-ai`, zero `PUBLIC_*` secrets, zero hardcoded drive-letter paths or local file URIs.
- Zero new Appwrite schema attributes: reuse the exact existing `manifests` attributes (name, tenantId, locationId, locationName, status, itemsSnapshot, itemCount, notes).
- Never call a marketplace that has no public seller API (Poshmark, Mercari, Depop, Whatnot, Facebook Marketplace) from a function or agent. Those channels use outbox intents that the member's own browser acts on.
- Never log event payloads (they contain cost). Log IDs and counts only.
- Never write to a live production resale_db from tests; use `@thehc/fn-harness` and unit tests.

BUILD:
1. `packages/core/src/storefront/` (pure TypeScript, Zod 4):
   - `PublicStorefrontItemSchema` with ONLY these fields: id, sku, title, publicSummary (<= 400 chars), condition, priceCents (integer), quantityAvailable, keywords, imageFileIds (max 4, File IDs <= 255 chars, never URLs or base64), checkoutMode (marketplace_links | external_checkout | reserve_hold | native_cart), checkoutUrl (https only), allowReserveHold, localPickupPortland, shippingWeightOz, marketplaceLinks[] (https only).
   - `toPublicStorefrontItem(item, coCurationRecord)` as an allowlist builder. It must make it impossible to emit cost, purchasePrice, maxBuyPrice, purchaseId, buyerId, rawAnalysis, components, emails, user IDs, or addresses. Add tests that feed an item containing every private field and assert none appear anywhere in the serialized output.
   - `isPublishable(item)`: false for storageLocation not HG/HH, quantity > 1, terminal statuses (sold, combined, deconstructed, archived), or missing ONLINE_READY_BIN / storefront tags. Keep status as-is (do NOT force `placed`).
   - `computeSyncHash(output)` (SHA-256 of canonical JSON), shard builder (pages <= 54,000 serialized chars, index document with page count, total, updatedAt, syncHash), and a `ChannelConnector` interface (publish, updatePrice, withdraw, harvestOrders).
2. `functions/fn-storefront-catalog-sync/` (Node 24, tsdown bundle, `@thehc/fn-harness` vitest, same layout as the ledger function):
   - Events ONLY: `databases.resale_db.collections.items.documents.*.update` and `databases.resale_db.collections.sales.documents.*.create` / `.update`. NEVER subscribe to `manifests` events. Register in `appwrite.config.json` with `execute: []`.
   - Loop safety: return early if the event document id starts with `public_storefront_catalog` or `channel_outbox_`; rebuild from current database state (paginated with `Query.limit(100)` + `Query.orderDesc('$id')`, filter `sellingLocations` in memory because it is not indexed); compute syncHash and SKIP every write whose hash matches the stored one (store the hash in `notes`); retry on HTTP 409.
   - Write `manifests/public_storefront_catalog_v1` (index) and `..._p01..pNN` (pages) with `Permission.read(Role.any())` only, update-then-create-on-404, pass permissions on update. Delete or empty surplus pages when the catalog shrinks.
   - Tests must prove: no private field leaks; own-output events are ignored; an unchanged rebuild performs zero writes; a sale removes the item from its page; a booth-located or multi-quantity item is excluded.
3. `functions/fn-channel-dispatcher/` SKELETON ONLY (no live API calls yet): typed connector slots for eBay Inventory API, Stripe Checkout, Shopify, Etsy; HMAC/signature verification helper for the webhook path; deterministic sale document id helper derived from marketplace order id (409 means already recorded); per-intent outbox document writer (one document per intent, reusing the ChannelSyncIntent model from `../ResaleCommand/src/lib/channelSyncOutbox.ts` and adding a `publish_listing` action). Secrets are read from function environment variables only. Public execute is allowed only on the webhook path.
4. Verify with `pnpm.cmd verify` (Windows) / `pnpm verify` (macOS/Linux), plus `pnpm.cmd bundle:functions` / `pnpm bundle:functions`. Zero local Astro or Vite builds on Windows.

OUTPUT AT THE END:
A concise table of files created, the event-to-write loop-safety table for each function, test results, and the remaining launch checklist (public read permission on the item photo bucket, API keys needed for Stage 3).
```
