---
name: ai-context-sync
description: On-demand workspace context, sibling flagship repo (thehcllc) skill mirror, Gemini Web bundle exporter, and Dev AI model roster freshness check. Use when the user asks to sync skills to thehcllc, export Gemini Web skill bundles, or check Dev AI model roster freshness.
---

# On-Demand AI Context & Skill Sync (`ai-context-sync`)

> **Why This Is an On-Demand Skill Instead of a Commit Script:**
> - Root [`AGENTS.md`](file:///c:/Users/15034/Projects/ResaleCommand/AGENTS.md) and `.agents/skills/*/SKILL.md` are first-class Markdown files edited directly in the IDE.
> - `/coop/vault` (`src/pages/api/generate-vault-prompt.ts`) imports `AGENTS.md?raw`, `ACTIVE_SESSION.md?raw`, and `.agents/skills/*/SKILL.md?raw` **at Vite compile time** via [`src/lib/generatedSkillBundles.ts`](file:///c:/Users/15034/Projects/ResaleCommand/src/lib/generatedSkillBundles.ts) — so Vercel deployments automatically pick up skill edits with **zero** sync script!
> - `npm run verify` runs `node scripts/validate-templates.mjs` **read-only inside the sandbox** with zero file mutations.

Run ONLY the workflow below that matches what the user asked for:

---

## Workflow A — Mirror Curated Flagship Skills & Brand Config to `thehcllc`

**Trigger phrases:** *"Sync skills to thehcllc"*, *"Mirror flagship context"*, *"Sync brand config to thehcllc"*

1. Verify sibling repo `c:\Users\15034\Projects\thehcllc` exists on disk.
2. Mirror ONLY these **9 curated flagship skills** recursively (including `references/` subfolders) from `c:\Users\15034\Projects\ResaleCommand\.agents\skills\<skill>` to `c:\Users\15034\Projects\thehcllc\.agents\skills\<skill>` (excluding internal POS/warehouse/printer/tax skills):
   - `laws-of-ux`
   - `huckleberry-brand-and-domain-identity`
   - `democracy-at-work-cooperative`
   - `social-marketing-and-drop-broadcasting`
   - `ux-design-system-taxonomy`
   - `mobile-ux-standards`
   - `daisyui`
   - `vue-component-standards`
   - `hucks-resale-core`
3. If `c:\Users\15034\Projects\ResaleCommand\src\site-config.ts` contains `socialMeta`, copy it to `c:\Users\15034\Projects\thehcllc\src\site-config.ts`.
4. Ensure `c:\Users\15034\Projects\thehcllc\AGENTS.md` is up to date and remove any legacy `.clinerules` or duplicate `GEMINI.md` in `thehcllc` so Antigravity loads a single clean `AGENTS.md` there too.

---

## Workflow B — Export 6 Bundled `SKILL.md` Files for Gemini Web (`dist-gemini-skills/`)

**Trigger phrases:** *"Export Gemini Web skill bundles"*, *"Rebuild dist-gemini-skills"*

1. Read the 6 bundle definitions in [`src/lib/generatedSkillBundles.ts`](file:///c:/Users/15034/Projects/ResaleCommand/src/lib/generatedSkillBundles.ts) (`hucks-resale-core`, `rc-1-scout-vision`, `rc-2-inventory-splitter`, `rc-3-booth-drops`, `rc-4-sales-coop`, `rc-5-social-studio`).
2. Using a temporary script in git-ignored `scratch/` (deleted immediately after running) or native `write_file` calls, write each assembled bundle to git-ignored `dist-gemini-skills/<bundle-id>/SKILL.md` and report which bundles changed since the last export so the user knows which ones to re-upload to Gemini Web.

---

## Workflow C — Dev AI Model Roster Freshness Check (`30-Day Cadence`)

**Trigger phrases:** *"Check AI model roster"*, *"Audit devAiRouting"*

1. Read `DEV_AI_ROSTER_LAST_REVIEWED` and `DEV_AI_REVIEW_INTERVAL_DAYS` in [`src/lib/devAiRouting.ts`](file:///c:/Users/15034/Projects/ResaleCommand/src/lib/devAiRouting.ts).
2. If more than `30` days old, prompt the user to check the Antigravity Model Picker for newer Gemini / partner models and update `DEV_AI_ROSTER_LAST_REVIEWED`.
