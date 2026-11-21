# Saved Cross-Repo IDE Prompts (Parked)

Self-contained copy-paste prompts for the IDE window opened on `thehc-platform`. Each file holds exactly one fenced `text` block. Nothing here runs automatically; paste a prompt only when you are ready.

| # | File | Target repo | Recommended model | Run order | Status |
| :-: | :--- | :--- | :--- | :-: | :--- |
| 01 | [`01-thehc-platform-skills-migration.md`](01-thehc-platform-skills-migration.md) | `thehc-platform` | Gemini 4 Carbon (High) or Orchestrator (Carbon) | 1 | Parked |
| 02 | [`02-thehc-platform-storefront-cloud-functions.md`](02-thehc-platform-storefront-cloud-functions.md) | `thehc-platform` | Gemini 4 Carbon (High) or Orchestrator (Carbon) | 2 | Parked |
| 03 | [`03-flagship-storefront-ui-and-checkout.md`](03-flagship-storefront-ui-and-checkout.md) | `thehc-platform` (`apps/flagship`) | Gemini 4 Argon (Medium) or Orchestrator (Argon) | 3 (after 02) | Parked |

Architecture reference for prompts 02 and 03: [`docs/ONLINE_STOREFRONT_AND_CHANNEL_ARCHITECTURE.md`](../ONLINE_STOREFRONT_AND_CHANNEL_ARCHITECTURE.md).

## Rules for every prompt
- The target IDE reads `ResaleCommand` strictly read-only (attach it as a workspace folder or approve read access) and never edits it.
- On Windows, never run `astro build`, `vite build`, Playwright, Puppeteer, or headless browsers; verify with `pnpm.cmd verify` (Windows) or `pnpm verify` (macOS/Linux).
- No hardcoded drive-letter paths or local file URIs inside any skill, rule, agent, or config file.
- Update the Status column here when a prompt has been run.
