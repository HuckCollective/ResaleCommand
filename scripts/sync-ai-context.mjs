import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const PLAYBOOK_PATH = path.join(ROOT_DIR, 'docs', 'AI_STUDIO_PLAYBOOK.md');
const ACTIVE_SESSION_PATH = path.join(ROOT_DIR, 'ACTIVE_SESSION.md');
const GEMINI_MD_PATH = path.join(ROOT_DIR, 'GEMINI.md');
const SKILLS_SRC_DIR = path.join(ROOT_DIR, '.agents', 'skills');
const RULES_SRC_DIR = path.join(ROOT_DIR, '.agents', 'rules');
const HUCKS_CORE_SKILL_PATH = path.join(SKILLS_SRC_DIR, 'hucks-resale-core', 'SKILL.md');
const SKILLS_DIST_DIR = path.join(ROOT_DIR, 'dist-gemini-skills');
const MANIFEST_PATH = path.join(SKILLS_DIST_DIR, '.sync-manifest.json');

const GOLDEN_RULES_AND_WAREHOUSES = `---

## The 3 Golden Rules & Canonical Warehouse IDs (\`resale_db.warehouses\`)

### The 3 Golden Rules
1. **\`storageLocation\` must NEVER be blank/unassigned:** Every physical item (\`received\`, \`placed\`, etc.) must have an explicit location code (\`MD\`, \`DT\`, \`HG\`, \`HH\`). Default unplaced intake items to \`HG\` (or \`HH\` when specified).
2. **Never create duplicate warehouse records:** Always query or reference the canonical \`resale_db.warehouses\` document IDs below instead of creating new warehouse documents.
3. **Never modify \`.vue\` files or run local builds on read-only tasks:** When running inspections, pull lists, database audits, or documentation syncs, keep \`.vue\` files untouched and never invoke \`astro build\` or \`npm run build\`.

### Canonical Warehouse & Location IDs
| Code | Name | Document \`$id\` | Type | Commission | Monthly Rent | Notes / Vibes & Exclusions |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **\`MD\`** | Memory Den - Huck's Adventures Outfitters | \`6a7e70050009db0e1857\` | On-Site Booth (\`#0EJ\`) | \`15%\` | \`$382.50/mo\` | Goth, Whimsigoth, TTRPG, metaphysical, eclectic, punk, sci-fi, adventure, horror, cos-play |
| **\`DT\`** | Dusty Tiger | \`6a7e71eb001f53734a86\` | Consignment Booth | \`10%\` | \`$75.00/mo\` | Small Collectibles, Jewelry, Pins, Pocket Items, Wands & Arcana \`<8"\`. **NO Clothes, NO Large Toys, NO Bulky Playsets** |
| **\`HG\`** | Huck's Garage | \`6a7e6f73003a5a2a7c34\` | Warehouse / Backstock | \`0%\` | \`$0.00/mo\` | Primary backstock facility (hardgoods, toys, decor, bulk) |
| **\`HH\`** | Huck's Hideout | \`6ae3afbd0030a7eb8a9c\` | Warehouse / Backstock | \`0%\` | \`$0.00/mo\` | Climate-controlled backstock & staging (\`HH\` — apparel, books, media, electronics, jewelry) |
`;

const HUCKS_CORE_SKILL_HEADER = `---
name: hucks-resale-core
description: Master system DNA, 3 Golden Rules, canonical Appwrite warehouse IDs (MD, DT, HG, HH), co-op waterfall rules, and active session pointers for Resale Command.
---

# Huck's Resale Core — System DNA & Golden Rules

> **Live Session Pointer:** Always check [\`ACTIVE_SESSION.md\`](file:///c:/Users/15034/Projects/ResaleCommand/ACTIVE_SESSION.md) for current active tasks, recent database migrations, and seasonal booth drop targets, and [\`docs/AI_STUDIO_PLAYBOOK.md\`](file:///c:/Users/15034/Projects/ResaleCommand/docs/AI_STUDIO_PLAYBOOK.md) for the multi-chat AI Studio workflow.

---

## 1. Universal Core DNA

You are the Principal Architect & UX Co-Pilot for **Resale Command** (Astro SSR, Vue 3.5, DaisyUI v5, Tailwind v4, Appwrite Cloud \`resale_db\` in \`sfo.cloud.appwrite.io\`, deployed on Vercel at \`resalecmd.com\`).

### BUSINESS & CO-OP CONTEXT
- **Organization:** The Huckleberry Collective (\`HUCK-\`) & PDX Game Library (\`PDXGL-\`) + consignors (\`BB-\`).
- **Primary Retail Venue:** Memory Den Vintage Mall Booth #0EJ (Portland, OR — Ricochet POS, 15% fee, $382.50/mo rent) and Dusty Tiger (\`DT\` — small collectibles/jewelry/wands <8", NO apparel, 10% fee, $75.00/mo rent).
- **Backstock Facilities:** \`HG\` (Huck's Garage) and \`HH\` (Huck's Hideout).
- **Co-op Waterfall:** 1) Venue Fee (15% Memory Den / 10% Dusty Tiger) -> 2) 100% Curator Cost Basis Recouped -> 3) Net Surplus split 70% Curator / 30% Commons Pool (covers $382.50 rent & tech/supplies).

### STRICT SYSTEM INVARIANTS
1. **IDE Prompt Standard:** Always specify the recommended Antigravity IDE model (\`Claude Sonnet 5.5 Medium\` for Vue/TS code, \`Claude Opus 5.5 Medium\` for complex audits, \`Gemini 3.8 Flash Medium\` for fast docs/scripts). Never use multi-line PowerShell blocks to write files—always instruct the IDE to use native file tools.
2. **NO Local \`astro build\`:** Every IDE prompt MUST forbid running \`astro build\` or \`npm run build\` locally (hangs Windows PC). Only run \`node scripts/validate-templates.mjs\` locally; let Vercel build in the cloud.
3. **Plain-English Vocabulary:** Use \`✂️ Split Lot\`, \`📦 Booth Bin (Multi-Qty)\`, \`➕ Restock Bin\`, \`↩️ Undo Combine\`, \`🔍 Deep Scan\`, \`⚡ Quick Scout\`, \`📦 Combine Similar\`, \`🎁 Build Bundle\`.
4. **Appwrite Schema Laws:** Never write \`quantity: 0\` (mark \`status: 'sold'\` or \`'combined'\` with \`quantity >= 1\`), never send \`isMultiQty\` to Appwrite, never store Base64 \`data:\` URLs in \`imageId\`/\`rawAnalysis\`/\`components\`, and paginate with \`Query.orderDesc('$id')\`.
5. **3 Memory Den CSV Formats:**
   - \`Products-*.csv\`: Catalog/Stock sync (\`'0EJ...\` SKU + \`Quantity\` + \`Inventory: In Stock|Paid|Sold\`). Updates \`items\` ONLY—NEVER creates \`sales\` records!
   - \`Payouts *.csv\`: Interim current-month sales (\`Sale#\` + \`Sold Date\`). Deduplicates by 6-digit ticket # + occurrence.
   - \`Payout History *.csv\`: Settled monthly checks (\`Sale\` + \`Sold\` + \` - 0EJXXX\` suffix).

---

## 2. The 3 Golden Rules

1. **\`storageLocation\` must NEVER be blank/unassigned:** Every physical item (\`received\`, \`placed\`, etc.) must have an explicit location code (\`MD\`, \`DT\`, \`HG\`, \`HH\`). Default unplaced intake items to \`HG\` (or \`HH\` when specified).
2. **Never create duplicate warehouse records:** Always query or reference the canonical \`resale_db.warehouses\` document IDs below instead of creating new warehouse documents.
3. **Never modify \`.vue\` files or run local builds on read-only tasks:** When running inspections, pull lists, database audits, or documentation syncs, keep \`.vue\` files untouched and never invoke \`astro build\` or \`npm run build\`.

---

## 3. Canonical Warehouse & Location IDs (\`resale_db.warehouses\`)

| Code | Name | Document \`$id\` | Type | Commission | Monthly Rent | Notes / Vibes & Exclusions |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **\`MD\`** | Memory Den - Huck's Adventures Outfitters | \`6a7e70050009db0e1857\` | On-Site Booth (\`#0EJ\`) | \`15%\` | \`$382.50/mo\` | Goth, Whimsigoth, TTRPG, metaphysical, eclectic, punk, sci-fi, adventure, horror, cos-play |
| **\`DT\`** | Dusty Tiger | \`6a7e71eb001f53734a86\` | Consignment Booth | \`10%\` | \`$75.00/mo\` | Small Collectibles, Jewelry, Pins, Pocket Items, Wands & Arcana \`<8"\`. **NO Clothes, NO Large Toys, NO Bulky Playsets** |
| **\`HG\`** | Huck's Garage | \`6a7e6f73003a5a2a7c34\` | Warehouse / Backstock | \`0%\` | \`$0.00/mo\` | Primary backstock facility (hardgoods, toys, decor, bulk) |
| **\`HH\`** | Huck's Hideout | \`6ae3afbd0030a7eb8a9c\` | Warehouse / Backstock | \`0%\` | \`$0.00/mo\` | Climate-controlled backstock & staging (\`HH\` — apparel, books, media, electronics, jewelry) |
`;

/**
 * The 6 Bundled Gemini Web Skills (matching docs/AI_STUDIO_PLAYBOOK.md)
 */
const GEMINI_WEB_BUNDLES = [
  {
    id: 'hucks-resale-core',
    description:
      'Master system DNA, 3 Golden Rules, canonical Appwrite warehouse IDs (MD, DT, HG, HD, HH), co-op waterfall rules, and live ACTIVE_SESSION.md summary for Resale Command.',
    sources: [{ type: 'skill', name: 'hucks-resale-core' }],
  },
  {
    id: 'rc-1-scout-vision',
    description:
      'Chat 1 (AI Scout & Vision) bundle: AI architecture & cost optimization, Speed Scout & Deep Scan validation, multi-angle photo slicing, secondary market valuation, and sourcing enrichment.',
    sources: [
      { type: 'skill', name: 'ai-architecture-and-cost-optimization' },
      { type: 'skill', name: 'ai-scout-and-deep-scan-validation' },
      { type: 'skill', name: 'multi-angle-photo-slicing' },
      { type: 'skill', name: 'secondary-market-appraisal-and-valuation' },
      { type: 'skill', name: 'sourcing-and-ai-enrichment' },
    ],
  },
  {
    id: 'rc-2-inventory-splitter',
    description:
      'Chat 2 (Inventory, Drawer & Splitter) bundle: core inventory lifecycle & SKU bucketing, lot profit & exit strategy, UX design system taxonomy, and Vue 3 SFC standards.',
    sources: [
      { type: 'skill', name: 'resale-inventory-core' },
      { type: 'skill', name: 'lot-profit-and-exit-strategy' },
      { type: 'skill', name: 'ux-design-system-taxonomy' },
      { type: 'skill', name: 'vue-component-standards' },
    ],
  },
  {
    id: 'rc-3-booth-drops',
    description:
      'Chat 3 (Booth Drops & Theme Puller) bundle: haul ingestion SOP, booth merchandising & bundling, and direct thermal label printing (Ricochet POS & Dusty Tiger).',
    sources: [
      { type: 'skill', name: 'haul-ingestion' },
      { type: 'skill', name: 'resale-merchandising-and-bundling' },
      { type: 'skill', name: 'thermal-label-printing' },
    ],
  },
  {
    id: 'rc-4-sales-coop',
    description:
      'Chat 4 (Sales & Co-op Ledger) bundle: Ricochet POS CSV sales reconciliation & payout invariants, cooperative economics & WSDE waterfall, and IRS tax & expense compliance.',
    sources: [
      { type: 'rule', name: 'sales-reconciliation-and-payout-invariants' },
      { type: 'skill', name: 'democracy-at-work-cooperative' },
      { type: 'skill', name: 'tax-and-expense-compliance' },
    ],
  },
  {
    id: 'rc-5-social-studio',
    description:
      'Chat 5 (Social Dropcast Studio) bundle: social media drop broadcasting & IP guardrails, mobile UX standards (HIG/M3), and DaisyUI v5 + Tailwind v4 component patterns.',
    sources: [
      { type: 'skill', name: 'social-marketing-and-drop-broadcasting' },
      { type: 'skill', name: 'mobile-ux-standards' },
      { type: 'skill', name: 'daisyui' },
    ],
  },
];

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Strips YAML frontmatter from a markdown file so multiple files can be cleanly combined.
 */
function stripFrontmatter(rawContent) {
  const normalized = rawContent.replace(/\r\n/g, '\n');
  const fmMatch = normalized.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  return (fmMatch ? fmMatch[1] : normalized).trim();
}

function syncCoreDocsAndHucksSkill() {
  const playbook = fs.existsSync(PLAYBOOK_PATH)
    ? fs.readFileSync(PLAYBOOK_PATH, 'utf8').trim()
    : '# Google AI Studio — Focused Chat Playbook & System DNA\n\n*(Missing docs/AI_STUDIO_PLAYBOOK.md)*';

  const activeSession = fs.existsSync(ACTIVE_SESSION_PATH)
    ? fs.readFileSync(ACTIVE_SESSION_PATH, 'utf8').trim()
    : '# Active Session State\n\n*(Missing ACTIVE_SESSION.md)*';

  // 1. Write root GEMINI.md with Playbook + Golden Rules/Warehouses + Active Session
  const combinedGeminiMd = [
    '# Resale Command — Universal Core DNA & Master Workspace Guide (`GEMINI.md`)',
    '',
    '> **Auto-Synced Context:** Generated by `npm run skills:sync` (`scripts/sync-ai-context.mjs`) from [`docs/AI_STUDIO_PLAYBOOK.md`](file:///c:/Users/15034/Projects/ResaleCommand/docs/AI_STUDIO_PLAYBOOK.md) and [`ACTIVE_SESSION.md`](file:///c:/Users/15034/Projects/ResaleCommand/ACTIVE_SESSION.md).',
    '',
    playbook,
    '',
    GOLDEN_RULES_AND_WAREHOUSES.trim(),
    '',
    '---',
    '',
    activeSession,
    '',
  ].join('\n');

  fs.writeFileSync(GEMINI_MD_PATH, combinedGeminiMd, 'utf8');
  console.log(`✅ Updated root GEMINI.md (${Buffer.byteLength(combinedGeminiMd, 'utf8')} bytes)`);

  // 2. Embed live ACTIVE_SESSION.md into .agents/skills/hucks-resale-core/SKILL.md
  fs.mkdirSync(path.dirname(HUCKS_CORE_SKILL_PATH), { recursive: true });
  const hucksCoreSkillContent = [
    HUCKS_CORE_SKILL_HEADER.trim(),
    '',
    '---',
    '',
    '## 4. Live Active Session Summary (Auto-Synced from `ACTIVE_SESSION.md`)',
    '',
    activeSession,
    '',
  ].join('\n');

  fs.writeFileSync(HUCKS_CORE_SKILL_PATH, hucksCoreSkillContent, 'utf8');
  console.log(
    `✅ Updated .agents/skills/hucks-resale-core/SKILL.md with live ACTIVE_SESSION.md (${Buffer.byteLength(hucksCoreSkillContent, 'utf8')} bytes)`
  );
}

function loadPreviousManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return { skills: {} };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    return parsed && typeof parsed.skills === 'object' ? parsed : { skills: {} };
  } catch {
    return { skills: {} };
  }
}

function resolveSourceFilePath(source) {
  if (source.type === 'rule') {
    return path.join(RULES_SRC_DIR, `${source.name}.md`);
  }
  return path.join(SKILLS_SRC_DIR, source.name, 'SKILL.md');
}

function syncBundledSkills() {
  // Read previous manifest BEFORE wiping dist-gemini-skills/
  const prevManifest = loadPreviousManifest();

  // Wipe dist-gemini-skills/ completely so only the 6 bundled folders exist
  if (fs.existsSync(SKILLS_DIST_DIR)) {
    fs.rmSync(SKILLS_DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(SKILLS_DIST_DIR, { recursive: true });

  const nextManifestSkills = {};
  const syncedBundles = [];
  const changedBundles = [];

  for (const bundle of GEMINI_WEB_BUNDLES) {
    const sections = [];
    const includedNames = [];

    for (const src of bundle.sources) {
      const filePath = resolveSourceFilePath(src);
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ Missing source for bundle ${bundle.id}: ${filePath}`);
        continue;
      }
      const raw = fs.readFileSync(filePath, 'utf8');
      const body = stripFrontmatter(raw);
      includedNames.push(src.name);

      if (bundle.sources.length === 1) {
        sections.push(body);
      } else {
        sections.push(`<!-- ==================== SOURCE: ${src.type.toUpperCase()} / ${src.name} ==================== -->\n\n${body}`);
      }
    }

    const frontmatter = [
      '---',
      `name: ${bundle.id}`,
      `description: ${bundle.description}`,
      '---',
      '',
    ].join('\n');

    const bundleHeader =
      bundle.sources.length > 1
        ? [
            `# ${bundle.id} — Bundled Gemini Web Skill`,
            '',
            `> **Bundled Modules (${includedNames.length}):** ${includedNames.map(n => `\`${n}\``).join(', ')}`,
            '',
            '---',
            '',
          ].join('\n')
        : '';

    const fullContent = `${frontmatter}${bundleHeader}${sections.join('\n\n---\n\n')}\n`;

    const targetDir = path.join(SKILLS_DIST_DIR, bundle.id);
    fs.mkdirSync(targetDir, { recursive: true });

    const destSkillPath = path.join(targetDir, 'SKILL.md');
    fs.writeFileSync(destSkillPath, fullContent, 'utf8');

    const currentHash = sha256(fullContent);
    const previousHash = prevManifest.skills?.[bundle.id]?.sha256 || null;
    const isChanged = previousHash !== currentHash;

    nextManifestSkills[bundle.id] = {
      name: bundle.id,
      modules: includedNames,
      sha256: currentHash,
      bytes: Buffer.byteLength(fullContent, 'utf8'),
      updatedAt: isChanged
        ? new Date().toISOString()
        : (prevManifest.skills?.[bundle.id]?.updatedAt || new Date().toISOString()),
    };

    const bundleRecord = {
      id: bundle.id,
      modules: includedNames,
      bytes: Buffer.byteLength(fullContent, 'utf8'),
      sha256: currentHash,
      status: !previousHash ? 'NEW' : (isChanged ? 'MODIFIED' : 'UNCHANGED'),
      distPath: `dist-gemini-skills/${bundle.id}/SKILL.md`,
    };

    syncedBundles.push(bundleRecord);
    if (isChanged) {
      changedBundles.push(bundleRecord);
    }
  }

  const nextManifest = {
    lastSyncedAt: new Date().toISOString(),
    totalBundles: syncedBundles.length,
    skills: nextManifestSkills,
  };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(nextManifest, null, 2) + '\n', 'utf8');

  return { syncedBundles, changedBundles };
}

function main() {
  console.log('🔄 Syncing Resale Command AI Context & 6 Bundled Gemini Web Skills...\n');
  syncCoreDocsAndHucksSkill();

  const { syncedBundles, changedBundles } = syncBundledSkills();
  console.log(`\n📦 Exported ${syncedBundles.length} bundled skill folders to dist-gemini-skills/<bundle-name>/SKILL.md:\n`);

  for (const b of syncedBundles) {
    console.log(
      `  • ${b.id.padEnd(26)} (${String(b.bytes).padStart(6)} B) — [${b.modules.length} module${b.modules.length === 1 ? '' : 's'}]: ${b.modules.join(', ')}`
    );
  }

  console.log('\n🔔 GEMINI WEB UPLOAD CHECKLIST (Changed Since Last Sync):');
  if (changedBundles.length === 0) {
    console.log(`  ✅ All ${syncedBundles.length} bundled skills are already up to date — nothing to re-upload!`);
  } else {
    for (const c of changedBundles) {
      console.log(`  ⬆️ [${c.status}] ${c.id} -> ${c.distPath} (${c.bytes} B)`);
    }
  }

  console.log('\n✨ AI context & 6 bundled Gemini Web skills sync complete!');
}

main();
