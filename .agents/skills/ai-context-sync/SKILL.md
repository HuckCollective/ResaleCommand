---
name: ai-context-sync
description: On-demand workspace context, sibling flagship repo (thehcllc / thehc-platform) prompt generator, Gemini Web bundle exporter, and Dev AI model roster freshness check. Use when the user asks to sync skills to thehcllc or thehc-platform, export Gemini Web skill bundles, or check Dev AI model roster freshness.
---

# On-Demand AI Context & Skill Sync (`ai-context-sync`)

> **Zero Cross-Repo Shell Scripts (Zero Permission Prompts!):**
> - Root [`AGENTS.md`](AGENTS.md) and `.agents/skills/*/SKILL.md` are first-class Markdown files edited directly in the IDE across Windows, macOS, and Linux.
> - `/coop/vault` (`src/pages/api/generate-vault-prompt.ts`) imports `AGENTS.md?raw`, `ACTIVE_SESSION.md?raw`, and `.agents/skills/*/SKILL.md?raw` **at Vite compile time** via [`src/lib/generatedSkillBundles.ts`](src/lib/generatedSkillBundles.ts).
> - Never run unsandboxed cross-repo scripts from `ResaleCommand` into `../thehcllc` or `../thehc-platform` (and in `thehc-platform`, use `pnpm agent:link` / `pnpm agent:export-web`). Instead, output a **ready-to-paste prompt for the target IDE window** where that sibling repo is the native active workspace!

Run ONLY the workflow below that matches what the user asked for:

---

## Workflow A — Self-Contained Copy-Paste Prompt for Sibling Repos (Zero File Transfers!)

**Trigger phrases:** *"Sync skills to thehcllc"*, *"Sync skills to thehc-platform"*, *"Mirror flagship context"*, *"Dump skills for thehcllc"*

1. **Zero Cross-Repo Reads or Writes:** Neither `ResaleCommand` nor `../thehcllc` / `../thehc-platform` should ever read or write across sibling repo folders (which can trigger sandbox blocks or fail across machines).
2. **Embed the Exact File Contents Directly Inside the Prompt:**
   - Identify which of the 9 curated flagship skills (`laws-of-ux`, `huckleberry-brand-and-domain-identity`, `democracy-at-work-cooperative`, `social-marketing-and-drop-broadcasting`, `ux-design-system-taxonomy`, `mobile-ux-standards`, `daisyui`, `vue-component-standards`, `hucks-resale-core`), `src/site-config.ts`, or `AGENTS.md` rules changed (or include all requested files if the user asks for a full dump).
   - Output **ONE self-contained copy-paste IDE prompt block** containing the **exact full Markdown/TS contents inline** for each target path inside the sibling repo (e.g. `FILE: .agents/skills/<name>/SKILL.md` followed by its exact content).
   - Instruct the target agent to write those embedded payloads directly into its own workspace via native `write_file` / `edit_file` (with **zero** reads from `../ResaleCommand`), run its native verifier (`node scripts/validate-templates.mjs` or `pnpm verify` in `thehc-platform`) inside its own sandbox (`BypassSandbox: false`), and commit/push when requested.

---

## Workflow B — Export 6 Bundled `SKILL.md` Files for Gemini Web (`dist-gemini-skills/`)

**Trigger phrases:** *"Export Gemini Web skill bundles"*, *"Rebuild dist-gemini-skills"*

1. Read the 6 bundle definitions in [`src/lib/generatedSkillBundles.ts`](src/lib/generatedSkillBundles.ts) (`hucks-resale-core`, `rc-1-scout-vision`, `rc-2-inventory-splitter`, `rc-3-booth-drops`, `rc-4-sales-coop`, `rc-5-social-studio`).
2. Using native `write_file` calls inside `dist-gemini-skills/<bundle-id>/SKILL.md` (repo-relative on Windows, macOS, and Linux — zero `BypassSandbox` needed!), write each assembled bundle and list which bundles changed so the user knows which ones to re-upload to Gemini Web.

---

## Workflow C — Dev AI Model Roster Freshness Check (`30-Day Cadence`)

**Trigger phrases:** *"Check AI model roster"*, *"Audit devAiRouting"*

1. Read `DEV_AI_ROSTER_LAST_REVIEWED` and `DEV_AI_REVIEW_INTERVAL_DAYS` in [`src/lib/devAiRouting.ts`](src/lib/devAiRouting.ts).
2. If more than `30` days old, prompt the user to check the Antigravity Model Picker for newer Gemini / partner models and update `DEV_AI_ROSTER_LAST_REVIEWED`.
