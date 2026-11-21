# Prompt 03 — Flagship Storefront UI & Checkout Modes in `apps/flagship`

Run **after** prompt 02 has produced the sharded public catalog. Paste the block below into the IDE window opened on `thehc-platform`. Reference: [`docs/ONLINE_STOREFRONT_AND_CHANNEL_ARCHITECTURE.md`](../ONLINE_STOREFRONT_AND_CHANNEL_ARCHITECTURE.md).

```text
RECOMMENDED MODEL: Gemini 4 Argon (Medium) or Orchestrator (Argon)
BEST GEMINI $0-POOL SWAP: Gemini 4 Neon (Medium) or Orchestrator (Neon)

TASK: Render the public storefront on `thehc.llc` (`apps/flagship`) from the sharded zero-PII catalog and support all four checkout modes.

PRE-FLIGHT (DO NOT SKIP):
1. Confirm your active workspace is `thehc-platform` and that `functions/fn-storefront-catalog-sync` and `packages/core/src/storefront` already exist. If not, STOP and tell me to run prompt 02 first.
2. Read `../ResaleCommand/docs/ONLINE_STOREFRONT_AND_CHANNEL_ARCHITECTURE.md` (read-only; never edit `../ResaleCommand`). Read `apps/flagship` (pages, components, astro.config), `packages/ui`, and the `huckleberry-design-system` skill.
3. Present a short plan and wait for approval before writing code.

FORBIDDEN ACTIONS:
- Zero edits to `../ResaleCommand` or `../thehcllc`.
- On Windows NEVER run `astro build`, `vite build`, Playwright, Puppeteer, or headless browsers.
- No `set:html` / `v-html`: render every catalog string as plain text. Only https links; strip anything else.
- No private fields: only consume `PublicStorefrontItem` from `@thehc/core/storefront`.
- Zero DaisyUI v4 shorthands; use the `huckleberry` 29-token theme and `@thehc/ui` primitives.
- Never store shopper data in a public document.

BUILD:
1. Data loading: fetch the catalog index document `public_storefront_catalog_v1`, then its pages `_p01..pNN` (server-side in Astro with a short edge cache, e.g. `s-maxage=60, stale-while-revalidate=300`), using the public read-only permission. Fall back to a friendly empty state when the index is missing.
2. Images: build photo URLs client-side from File IDs; every `<img>` tries `/preview` then falls back to `/view`, then to the next File ID.
3. Product page/card UI with search, price filter, and a clear Verb + Object call to action per `checkoutMode`:
   - `marketplace_links`: verified https "Buy on <marketplace>" buttons.
   - `external_checkout`: "Pay securely" button opening the https payment link.
   - `reserve_hold`: "Ask to reserve this item" inline form (name, email, note, honeypot field) posting to a rate-limited inquiry endpoint that stores team-only-readable documents (never public) and returns a plain-English confirmation.
   - `native_cart`: render a disabled "Cart coming soon" state wired to the existing structured price, SKU, quantity, and weight fields so the cart can be added later without a contract change.
4. Show `localPickupPortland` and shipping weight when present. Items that disappear from the catalog must show a friendly "No longer available" state when a stale link is opened.
5. Verify with `pnpm.cmd verify` (Windows) / `pnpm verify` (macOS/Linux). Let Vercel build in the cloud.

OUTPUT AT THE END:
A concise file table, the four checkout-mode behaviors, test results, and the QA URLs to check on the Vercel preview.
```
