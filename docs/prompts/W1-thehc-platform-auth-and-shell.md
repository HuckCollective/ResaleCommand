```text
MODEL: Orchestrator (Carbon) or Gemini 4 Carbon (High)
BEST GEMINI $0-POOL SWAP: Gemini 4 Neon (High) for 1-turn plan audit; Gemini 4 Hydrogen (Medium) for file recon & pnpm.cmd verify

WAVE 1 OF 6 (CUTOVER BLOCKER #1 — SECURITY LOCKDOWN, AUTH, MEMBER HATS & SHELL)
TARGET WORKSPACE: thehc-platform (branch: dev)
READ-ONLY REFERENCE SIBLING: ResaleCommand (attach read-only; NEVER edit ResaleCommand)

GOAL
Lock down apps/works behind verified Appwrite SSR authentication + Member Hats & Access BEFORE any preview URL is exposed publicly, eliminate hardcoded fallback tenantIds (Law 2), upgrade dynamic warehouse config flags, and ship the complete Auth, Org Settings, Operator Dashboard, and Bookmarklet Pairing shell.

CRITICAL SECURITY & ARCHITECTURE INVARIANTS
1. IMMEDIATE LOCKDOWN GATE (src/middleware.ts):
   - Currently apps/works/src/actions/index.ts exposes 5 astro:actions using createAdminAppwriteFromEnv with ZERO auth check and a hardcoded fallback tenantId ('69a9cbcb0038df55f6b9').
   - Step 1 of Wave 1 MUST create apps/works/src/middleware.ts guarding ALL SSR pages, ALL /_actions/* calls, and ALL /api/* routes.
   - Public allowlist in apps/works: ONLY /api/health, /login, /logout, /signup, /join, /scripts/*.js (static loader bootstrap), and CORS OPTIONS preflights.
   - Bookmarklet routes (/api/bml/*) authenticate via short-lived or paired Bookmarklet Bearer token (bml/serverAuth), NEVER unauthenticated admin access.
   - Remove the hardcoded '69a9cbcb0038df55f6b9' fallback from apps/works/src/actions/index.ts — resolve active user, tenantId, member hats, and allowed prefixes (HUCK-, PDXGL-, BB-) dynamically from context.locals!
2. DYNAMIC WAREHOUSE CONFIG (Law 1 & Law 2):
   - Upgrade packages/core/src/domain/warehouses.ts to parse labelConfig JSON from resale_db.warehouses rows (usesRicochet, supportsPaperSalesSheet, salesIntakeMode, dynamic manifest keys) matching ResaleCommand/src/lib/warehouses.ts + locationSettingsServer.ts, with zero hardcoded venue fees or rents.
3. PLAIN-ENGLISH COLLECTIVE VOICE (validate-templates.mjs):
   - Use "Member Hats & Access" and "Account Steward" in UI copy; never expose Appwrite, Vercel, Astro, resale_db, JWT, or localStorage in user-visible strings; wrap errors with toUserMessage().

READ-ONLY SOURCE FILES IN SIBLING ResaleCommand
- src/lib/auth.ts, src/lib/memberAccess.ts, src/lib/memberHats.ts, src/lib/curatorOwnership.ts, src/lib/publicRoutes.ts
- src/lib/joinRequests.ts, src/lib/joinRequestsServer.ts, src/lib/joinLinkTokens.ts
- src/lib/warehouses.ts, src/lib/locationSettingsServer.ts
- src/lib/bml/registry.ts, src/lib/bml/serverAuth.ts, src/lib/bml/clientCore.ts (keep ONLY ricochet_sync and auction_scout — NEVER re-add listing_assist!)
- src/pages/login.astro, src/pages/logout.astro, src/pages/signup.astro, src/pages/join.astro, src/pages/profile.astro, src/pages/settings.astro, src/pages/org/settings.astro, src/pages/bml/connect.astro, src/pages/dashboard.astro

DELIVERABLES IN thehc-platform
1. packages/core:
   - Port auth session cookie helpers, memberAccess, memberHats, curatorOwnership, joinRequests, bml/registry + bml/serverAuth (only ricochet_sync & auction_scout), and upgraded warehouses.ts labelConfig parsing + Vitest unit tests in packages/core/test/.
2. apps/works:
   - src/middleware.ts enforcing SSR session auth across pages, /_actions/*, and /api/*, populating Astro.locals.user and Astro.locals.memberAccess.
   - Update src/actions/index.ts to require context.locals.memberAccess (zero hardcoded tenantId) and add typed Zod 4 actions for login/session exchange, profile/prefix switch, org settings & warehouse config updates, member hat management, and bookmarklet token mint/revoke.
   - Pages: /login, /logout, /signup, /join, /profile, /settings, /org/settings, /bml/connect, /dashboard (and /), /404.
   - Bookmarklet pairing endpoints (so /bml/connect works end-to-end in Wave 1): src/pages/api/bml/session.ts, src/pages/api/bml/ping.ts, src/pages/scripts/bml-test.js.ts with explicit CORS OPTIONS headers.
   - Upgrade OperatorLayout.astro navigation with real route links (/dashboard, /inventory, /purchases, /scout, /warehouse, /sales, /expenses, /coop, /org/settings), active org/prefix badge, and logout control.

FORBIDDEN ACTIONS
- NEVER edit ResaleCommand or read .env files.
- NEVER run astro build, vite build, Playwright, Puppeteer, or headless browsers on Windows.
- NEVER commit or push to main (commit to dev only).

VERIFICATION GATE
1. Start with /plan (implementation_plan.md stamped at Line 1) before writing code.
2. Add Vitest tests covering middleware route gating (unauthenticated /_actions/* returns 401), warehouse labelConfig parsing, member hat checks, and /api/bml/ping Bearer auth + CORS OPTIONS.
3. Run pnpm.cmd verify (on Windows) or pnpm verify (on macOS/Linux) — must pass with 0 lint, typecheck, template, or test errors.
4. Run read-only hc-design-critic on new auth/settings/dashboard views before committing to dev.
```
