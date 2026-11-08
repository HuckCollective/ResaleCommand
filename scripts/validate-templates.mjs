import fs from 'fs';
import path from 'path';
import { parse, compileTemplate, compileScript } from 'vue/compiler-sfc';
import ts from 'typescript';

function getFiles(dir, exts, files = []) {
    for (const item of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, item);
        if (fs.statSync(fullPath).isDirectory()) {
            if (item !== 'node_modules' && item !== '.astro' && item !== 'dist' && item !== '.git') {
                getFiles(fullPath, exts, files);
            }
        } else if (exts.some(ext => item.endsWith(ext))) {
            files.push(fullPath);
        }
    }
    return files;
}

const vueFiles = getFiles('src', ['.vue']);
const tsFiles = getFiles('src', ['.ts', '.d.ts']);
let hasErrors = false;
const virtualVueMap = new Map();
const virtualVueFiles = [];

console.log(`🔍 [Linter] Validating ${vueFiles.length} Vue SFCs and ${tsFiles.length} TypeScript files...`);

// 1. VALIDATE VUE SFCs (Template & Script)
for (const file of vueFiles) {
    const relativePath = path.relative(process.cwd(), file);
    const content = fs.readFileSync(file, 'utf8');
    const { descriptor, errors: sfcErrors } = parse(content, { filename: file });

    if (sfcErrors && sfcErrors.length > 0) {
        console.error(`❌ SFC Parse Error in ${relativePath}:`);
        sfcErrors.forEach(e => console.error('  ', e.message));
        hasErrors = true;
        continue;
    }

    // Validate Template syntax
    if (descriptor.template) {
        const result = compileTemplate({
            id: file,
            filename: file,
            source: descriptor.template.content,
            compilerOptions: { mode: 'module' }
        });

        if (result.errors && result.errors.length > 0) {
            console.error(`❌ Template Compilation Error in ${relativePath}:`);
            result.errors.forEach(e => {
                const msg = typeof e === 'string' ? e : (e.message || JSON.stringify(e));
                console.error('  ', msg);
                if (e.loc) {
                    console.error(`   at line ${e.loc.start.line}:${e.loc.start.column}`);
                }
            });
            hasErrors = true;
        }
    }

    // Validate Script & Script Setup
    if (descriptor.script || descriptor.scriptSetup) {
        try {
            const compiled = compileScript(descriptor, { id: file, inlineTemplate: false });
            const vName = file + '.ts';
            virtualVueMap.set(vName, compiled.content);
            virtualVueFiles.push(vName);
        } catch (scriptErr) {
            console.error(`❌ Script Error in ${relativePath}:`, scriptErr.message);
            hasErrors = true;
        }
    }
}

// 2. VALIDATE TYPESCRIPT, JAVASCRIPT & VUE SFC SCRIPTS (Syntax, Missing Variables, Broken Imports)
const tsconfigPath = path.resolve('tsconfig.json');
let compilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    skipLibCheck: true,
    allowJs: true
};

if (fs.existsSync(tsconfigPath)) {
    try {
        const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
        if (!configFile.error) {
            const parsedConfig = ts.parseJsonConfigFileContent(
                configFile.config,
                ts.sys,
                path.dirname(tsconfigPath)
            );
            compilerOptions = { ...compilerOptions, ...parsedConfig.options, noEmit: true, skipLibCheck: true };
        }
    } catch {
        // Fall back to default compilerOptions
    }
}

const defaultHost = ts.createCompilerHost(compilerOptions);
const customHost = {
    ...defaultHost,
    getSourceFile: (fileName, languageVersion) => {
        if (virtualVueMap.has(fileName)) {
            return ts.createSourceFile(fileName, virtualVueMap.get(fileName), languageVersion, true);
        }
        return defaultHost.getSourceFile(fileName, languageVersion);
    },
    fileExists: (fileName) => {
        if (virtualVueMap.has(fileName)) return true;
        return defaultHost.fileExists(fileName);
    }
};

const allFilesToCheck = [...tsFiles, ...virtualVueFiles];
const program = ts.createProgram(allFilesToCheck, compilerOptions, customHost);
const diagnostics = ts.getPreEmitDiagnostics(program);

for (const diag of diagnostics) {
    if (!diag.file) continue;
    let relFile = path.relative(process.cwd(), diag.file.fileName).replace(/\\/g, '/');
    if (!relFile.startsWith('src/')) continue;
    relFile = relFile.replace(/\.ts$/, '');

    const code = diag.code;
    // Critical errors:
    // TS2304: Cannot find name 'x' (catches missing imports)
    // TS2552: Cannot find name 'x'. Did you mean 'y'?
    // TS2307: Cannot find module 'x' (catches broken import paths)
    // TS2448: Block-scoped variable 'x' used before its declaration (TDZ)
    // TS2454: Variable 'x' is used before being assigned (TDZ)
    // TS1xxx: Any TypeScript/JavaScript syntax error
    const isCritical = (code === 2304 || code === 2552 || code === 2307 || code === 2448 || code === 2454 || (code >= 1000 && code < 2000));

    if (isCritical) {
        // Ignore known benign imports of raw Vue SFC components without shim in virtual TS files
        if (code === 2307 && diag.messageText && String(diag.messageText).includes('.vue')) {
            continue;
        }
        const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
        const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start);
        console.error(`❌ Critical Error in ${relFile}:${line + 1}:${character + 1} (TS${code}): ${message}`);
        hasErrors = true;
    }
}

// 3. VALIDATE ANTI-RANGE CONCATENATION INVARIANT (Price Parsing Security)
const pricingCriticalFiles = [
    'src/lib/lot-strategy.ts',
    'src/lib/ai-inspection.ts',
    'src/lib/rolloLabelPrint.ts',
    'src/lib/pdfLabelGenerator.ts',
    'src/composables/useScoutPurchase.ts',
    'src/composables/useLotSplitter.ts',
    'src/components/common/drawer/ItemLotTab.vue',
    'src/components/inventory/LotSplitterWizard.vue'
];

for (const relPath of pricingCriticalFiles) {
    const fullPath = path.resolve(relPath);
    if (!fs.existsSync(fullPath)) continue;
    const fileContent = fs.readFileSync(fullPath, 'utf8');
    const dangerousRegex = /\.replace\(\/\[\^0-9\.\-\]\/g,\s*['"]['"]\)|\.replace\(\/\[\^0-9\.\]\/g,\s*['"]['"]\)/g;
    let match;
    while ((match = dangerousRegex.exec(fileContent)) !== null) {
        const line = fileContent.slice(0, match.index).split('\n').length;
        console.error(`❌ Anti-Concatenation Invariant Violation in ${relPath}:${line}:`);
        console.error(`   Destructive regex character stripping detected. Always use parsePriceValue() from src/lib/lot-strategy.ts instead of regex stripping on prices!`);
        hasErrors = true;
    }
}

// 4. VALIDATE <script setup> TDZ & IMMEDIATE WATCHER DECLARATION ORDER
for (const file of vueFiles) {
    const relativePath = path.relative(process.cwd(), file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    const { descriptor } = parse(content, { filename: file });
    if (!descriptor.scriptSetup) continue;

    const setupContent = descriptor.scriptSetup.content;
    const setupStartLine = descriptor.scriptSetup.loc.start.line;
    const sf = ts.createSourceFile(file + '.setup.ts', setupContent, ts.ScriptTarget.ESNext, true);

    // Collect top-level const/let declarations & their positions, plus computed() dependency graph
    const declPosByName = new Map();
    const declLineByName = new Map();
    const computedDeps = new Map();

    function extractBindingNames(nameNode, pos, line) {
        if (ts.isIdentifier(nameNode)) {
            declPosByName.set(nameNode.text, pos);
            declLineByName.set(nameNode.text, line);
        } else if (ts.isObjectBindingPattern(nameNode) || ts.isArrayBindingPattern(nameNode)) {
            for (const el of nameNode.elements) {
                if (ts.isBindingElement(el)) {
                    extractBindingNames(el.name, pos, line);
                }
            }
        }
    }

    function collectIdentifiers(node, outSet) {
        if (!node) return;
        if (ts.isIdentifier(node)) {
            // Skip property access right-hand side (obj.prop) unless it's the object itself
            if (node.parent && ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) {
                return;
            }
            if (node.parent && ts.isPropertyAssignment(node.parent) && node.parent.name === node) {
                return;
            }
            outSet.add(node.text);
        }
        ts.forEachChild(node, child => collectIdentifiers(child, outSet));
    }

    for (const stmt of sf.statements) {
        if (ts.isVariableStatement(stmt)) {
            const isConstOrLet = (stmt.declarationList.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let)) !== 0;
            if (!isConstOrLet) continue;
            for (const decl of stmt.declarationList.declarations) {
                const line = setupStartLine + sf.getLineAndCharacterOfPosition(decl.getStart()).line;
                extractBindingNames(decl.name, decl.getStart(), line);
                if (
                    ts.isIdentifier(decl.name) &&
                    decl.initializer &&
                    ts.isCallExpression(decl.initializer) &&
                    ts.isIdentifier(decl.initializer.expression) &&
                    decl.initializer.expression.text === 'computed'
                ) {
                    const idents = new Set();
                    collectIdentifiers(decl.initializer.arguments[0], idents);
                    computedDeps.set(decl.name.text, idents);
                }
            }
        }
    }

    // Resolve transitive dependencies for any identifier (including chains of computed -> computed -> ref)
    function getTransitiveDeps(rootName, visited = new Set()) {
        if (visited.has(rootName)) return visited;
        visited.add(rootName);
        const direct = computedDeps.get(rootName);
        if (direct) {
            for (const dep of direct) {
                if (declPosByName.has(dep)) {
                    getTransitiveDeps(dep, visited);
                }
            }
        }
        return visited;
    }

    // Check every watch(..., { immediate: true }) and watchEffect(...) in <script setup>
    for (const stmt of sf.statements) {
        if (!ts.isExpressionStatement(stmt) || !ts.isCallExpression(stmt.expression)) continue;
        const call = stmt.expression;
        if (!ts.isIdentifier(call.expression)) continue;
        const fnName = call.expression.text;
        const callPos = call.getStart();
        const callLine = setupStartLine + sf.getLineAndCharacterOfPosition(callPos).line;

        const isWatchEffect = fnName === 'watchEffect';
        const isImmediateWatch =
            fnName === 'watch' &&
            call.arguments.length >= 3 &&
            call.arguments[2] &&
            call.arguments[2].getText().includes('immediate') &&
            call.arguments[2].getText().includes('true');

        if (!isWatchEffect && !isImmediateWatch) continue;

        const watchedRoots = new Set();
        collectIdentifiers(call.arguments[0], watchedRoots);
        if (call.arguments[1]) {
            collectIdentifiers(call.arguments[1], watchedRoots);
        }

        const allEvaluated = new Set();
        for (const r of watchedRoots) {
            if (declPosByName.has(r)) {
                for (const d of getTransitiveDeps(r)) {
                    allEvaluated.add(d);
                }
            }
        }

        for (const dep of allEvaluated) {
            const depPos = declPosByName.get(dep);
            const depLine = declLineByName.get(dep);
            if (depPos !== undefined && depPos > callPos) {
                console.error(
                    `❌ TDZ ReferenceError Risk in ${relativePath}:${callLine}: "${fnName}(..., { immediate: true })" evaluates "${dep}" before its declaration at line ${depLine}!`
                );
                hasErrors = true;
            }
        }
    }
}

// =========================================================================
// 5. VALIDATE SCRIPTS/ DIRECTORY ALLOWLIST (NO ONE-OFF SCRIPTS IN SCRIPTS/)
// =========================================================================
const ALLOWED_PERMANENT_SCRIPTS = new Set([
    'inspect_schema.js',
    'audit_schema.mjs',
    'sync-ai-context.mjs',
    'validate-templates.mjs',
]);

const scriptsDir = path.join(process.cwd(), 'scripts');
if (fs.existsSync(scriptsDir)) {
    const scriptEntries = fs.readdirSync(scriptsDir, { withFileTypes: true });
    for (const entry of scriptEntries) {
        if (!entry.isFile()) continue;
        if (!ALLOWED_PERMANENT_SCRIPTS.has(entry.name)) {
            console.error(
                `❌ Forbidden one-off script in scripts/${entry.name}: Only permanent scripts (${Array.from(ALLOWED_PERMANENT_SCRIPTS).join(', ')}) are allowed in scripts/. Put temporary scripts in git-ignored scratch/ and delete them before committing!`
            );
            hasErrors = true;
        }
    }
}

// =========================================================================
// 5b. SALES-SYNC INTEGRITY RULES (Laws 2, 4 and 7) - these fail `npm run verify` so a regression can never reach production
// =========================================================================
const salesSyncGuardedFiles = [
    'src/composables/useRicochetSalesSync.ts',
    'src/lib/ricochetPayoutParser.ts',
    'src/lib/salesBucketing.ts',
];
const salesSyncForbiddenPatterns = [
    { pattern: /SO-\$\{Date\.now\(\)/, reason: 'Never invent a random SO-<timestamp> order number (it defeats duplicate detection). Use the UPC, SKU or Ticket # instead.' },
    { pattern: /['"`]20\d{2}-\d{2}-\d{2}['"`]/, reason: 'Law 2: no hardcoded calendar dates. The sold date must come from the Ricochet row, never a fixed or fallback date.' },
    { pattern: /['"`]0EJ[0-9A-Z]{3,5}['"`]/, reason: 'Law 4: no hardcoded booth SKU (0EJxxx) in sales-sync code. Lookups come from live Appwrite items.' },
    { pattern: /['"`](?:HUCK|PDXGL|BB)-\d{3,6}['"`]/, reason: 'Law 4: no hardcoded partner barcode (HUCK-/PDXGL-/BB-1234) in sales-sync code. Lookups come from live Appwrite items.' },
    { pattern: /paidDate[^\n]{0,80}(?:\|\||\?\?)[^\n]{0,40}soldDate|soldDate\s*=[^\n]{0,80}paidDate/, reason: 'Law 7: the sold date is never derived from the paid/check date.' },
];
for (const rel of salesSyncGuardedFiles) {
    const full = path.join(process.cwd(), rel);
    if (!fs.existsSync(full)) continue;
    const lines = fs.readFileSync(full, 'utf8').split('\n');
    lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
        for (const { pattern, reason } of salesSyncForbiddenPatterns) {
            if (pattern.test(line)) {
                console.error(`❌ Sales-sync rule violation in ${rel}:${i + 1}: ${reason}`);
                hasErrors = true;
            }
        }
    });
}

// =========================================================================
// 5c. SKILL & RULE HEALTH CHECK (broken references, missing frontmatter, missing triggers)
// =========================================================================
{
    const skillsRoot = path.join(process.cwd(), '.agents', 'skills');
    const rulesRoot = path.join(process.cwd(), '.agents', 'rules');
    if (fs.existsSync(skillsRoot)) {
        for (const dir of fs.readdirSync(skillsRoot, { withFileTypes: true })) {
            if (!dir.isDirectory()) continue;
            const skillFile = path.join(skillsRoot, dir.name, 'SKILL.md');
            if (!fs.existsSync(skillFile)) {
                console.error(`❌ Skill health: .agents/skills/${dir.name}/ has no SKILL.md`);
                hasErrors = true;
                continue;
            }
            const text = fs.readFileSync(skillFile, 'utf8');
            const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
            if (!fm || !/^name:\s*\S/m.test(fm[1]) || !/^description:\s*\S/m.test(fm[1])) {
                console.error(`❌ Skill health: .agents/skills/${dir.name}/SKILL.md needs frontmatter with both "name:" and "description:"`);
                hasErrors = true;
                continue;
            }
            const nameValue = (fm[1].match(/^name:\s*(.+)$/m) || [])[1]?.trim();
            if (nameValue && nameValue !== dir.name) {
                console.warn(`⚠️ Skill health: .agents/skills/${dir.name}/SKILL.md has name "${nameValue}" (folder is "${dir.name}")`);
            }
            if (!/(use\s+(when|this|for)|read\s+first)/i.test(fm[1])) {
                console.warn(`⚠️ Skill health: "${dir.name}" description has no trigger phrase ("Use when…" / "READ FIRST…"), so an agent may never open it`);
            }
        }
    }
    // Every module named in a Gemini Web bundle must exist as a skill folder or a rule file
    const syncScriptPath = path.join(process.cwd(), 'scripts', 'sync-ai-context.mjs');
    if (fs.existsSync(syncScriptPath)) {
        const syncSource = fs.readFileSync(syncScriptPath, 'utf8');
        const bundleRef = /\{\s*type:\s*'(skill|rule)'\s*,\s*name:\s*'([^']+)'\s*\}/g;
        let m;
        while ((m = bundleRef.exec(syncSource))) {
            const [, kind, name] = m;
            const target = kind === 'skill' ? path.join(skillsRoot, name, 'SKILL.md') : path.join(rulesRoot, `${name}.md`);
            if (!fs.existsSync(target)) {
                console.error(`❌ Skill health: Gemini bundle references ${kind} "${name}" but ${path.relative(process.cwd(), target)} does not exist`);
                hasErrors = true;
            }
        }
    }
}

// =========================================================================
// 6. VALIDATE GOLDEN RULE #2: ZERO HARDCODED LOCATIONS IN UI COMPONENTS
// =========================================================================
const locationDrivenFiles = [
    'src/components/warehouses/LocationSyncView.vue',
    'src/components/sales/SalesImporter.vue',
    'src/components/common/drawer/ItemDetailsTab.vue',
    'src/components/inventory/InventorySpatialBar.vue',
];

const forbiddenHardcodedLocationPatterns = [
    { pattern: /CANONICAL_LOCATION_CARDS\s*=\s*\[/, reason: 'Do not define static CANONICAL_LOCATION_CARDS in components; use getAllLocationSettingMetas() from src/lib/warehouses.ts' },
    { pattern: /KNOWN_CODES\s*=\s*\[/, reason: 'Do not define static KNOWN_CODES in components; use KNOWN_FACILITY_CODES from src/lib/warehouses.ts' },
    { pattern: /['"]md_verify_report_latest['"]/, reason: 'Do not hardcode "md_verify_report_latest" in components; use getLocationManifestDocIds(code).reportDocId from src/lib/warehouses.ts' },
    { pattern: /['"]md_live_payload_latest['"]/, reason: 'Do not hardcode "md_live_payload_latest" in components; use getLocationManifestDocIds(code).payloadDocId from src/lib/warehouses.ts' },
    { pattern: /Memory Den Barcode Verification Report/, reason: 'Use dynamic {{ activeCanonicalLocationMeta.shortName }} Barcode Verification Report instead of hardcoded "Memory Den"' },
    { pattern: /Load Memory Den Full Payout/, reason: 'Use dynamic {{ activeCanonicalLocationMeta.shortName }} instead of hardcoded "Load Memory Den Full Payout"' },
    { pattern: /STAGING_STORAGE_KEY\s*=\s*['"]rc_sales_importer_staging_v1['"]/, reason: 'Do not use an unscoped global auto-save key; scope by canonical location code via getScopedStagingStorageKey(code)' },
    { pattern: /(?:rentAmt\s*=\s*(?:75(?:\.00)?|382\.50)|spaceRental:\s*[^\n,;]*\b(?:75(?:\.00)?|382\.50)\b)/, reason: 'Do not hardcode 75 / 75.00 / 382.50 rent fallbacks; derive monthlyRent 100% from activeCanonicalLocationMeta' },
];

for (const relPath of locationDrivenFiles) {
    const fullPath = path.resolve(relPath);
    if (!fs.existsSync(fullPath)) continue;
    const fileContent = fs.readFileSync(fullPath, 'utf8');
    for (const check of forbiddenHardcodedLocationPatterns) {
        const match = check.pattern.exec(fileContent);
        if (match) {
            const line = fileContent.slice(0, match.index).split('\n').length;
            console.error(`❌ Golden Rule #2 (Zero Hardcoded Locations) Violation in ${relPath}:${line}: ${check.reason}`);
            hasErrors = true;
        }
    }
}

// =========================================================================
// 7. VALIDATE GOLDEN RULE #3: RICOCHET LIVE SALES PANEL & PARSER DELEGATION
// =========================================================================
const requiredArchitectureContracts = [
    {
        file: 'src/components/sales/RicochetLiveSalesPanel.vue',
        mustContain: [
            { pattern: /toggleMatchFilter\(['"]matched['"]\)/, label: 'Clickable Matched filter control' },
            { pattern: /toggleMatchFilter\(['"]unmatched['"]\)/, label: 'Clickable Unmatched filter control' },
            { pattern: /toggleMatchFilter\(['"]already_synced['"]\)/, label: 'Clickable Already Synced / In DB filter control' },
            { pattern: /toggleMatchFilter\(['"]ready_to_sync['"]\)/, label: 'Clickable New / Ready to Sync filter control' },
            { pattern: /togglePartnerFilter\(['"]HUCK['"]\)/, label: 'Clickable ⭐ HUCK Partner filter pill' },
            { pattern: /togglePartnerFilter\(['"]PDXGL['"]\)/, label: 'Clickable 🎲 PDXGL Partner filter pill' },
            { pattern: /togglePartnerFilter\(['"]BB['"]\)/, label: 'Clickable 💛 B&B Partner filter pill' },
        ],
    },
    {
        file: 'src/lib/salesBucketing.ts',
        mustContain: [
            { pattern: /\bexport\s+function\s+isLeakedInventoryDomRow\s*\(/, label: 'Exported isLeakedInventoryDomRow guard against leaked Ricochet Inventory DOM rows' },
        ],
    },
    {
        file: 'src/lib/ricochetPayoutParser.ts',
        mustContain: [
            { pattern: /\bexport\s+function\s+parseRicochetExportCsv\s*\(/, label: 'Exported dual-schema parseRicochetExportCsv parser for Payout and Payout History Export CSVs' },
            { pattern: /\bisPayoutSummaryRow\s*\(/, label: 'Delegation of summary-row filtering to isPayoutSummaryRow from salesBucketing.ts' },
            { pattern: /\bisLeakedInventoryDomRow\s*\(/, label: 'Delegation of leaked Inventory DOM row filtering to isLeakedInventoryDomRow from salesBucketing.ts' },
            { pattern: /\bsplitTrailingBoothSku\s*\(/, label: 'Delegation of trailing SKU extraction to splitTrailingBoothSku from salesBucketing.ts' },
            { pattern: /\bmatchMemoryDenInventoryItem\s*\(/, label: 'Delegation of inventory matching to matchMemoryDenInventoryItem from salesBucketing.ts' },
            { pattern: /\bflagAlreadyRecordedRows\s*\(/, label: 'Delegation of ledger deduplication to flagAlreadyRecordedRows from salesBucketing.ts' },
        ],
    },
    {
        file: 'src/composables/useRicochetSalesSync.ts',
        mustContain: [
            { pattern: /\bparseRicochetExportCsv\s*\(/, label: 'Unified dual-schema Ricochet Export CSV parsing in useRicochetSalesSync.ts' },
            { pattern: /\bmatchMemoryDenInventoryItem\s*\(/, label: 'Delegation of inventory matching to matchMemoryDenInventoryItem from salesBucketing.ts' },
            { pattern: /\bbuildLockedMultiBinMap\s*\(/, label: 'Delegation of multi-bin lot map building to buildLockedMultiBinMap from salesBucketing.ts' },
        ],
    },
    {
        file: 'public/ricochet-upc-sync.user.js',
        mustContain: [
            { pattern: /\bcaptureSpaExportCsvInMemory\s*\(/, label: 'In-memory native Export CSV capture on Payout and Payout History tabs' },
            { pattern: /\bparseRicochetExportCsvText\s*\(/, label: 'Dual-schema Ricochet Export CSV parser in userscript' },
            { pattern: /out\\s\+of/, label: 'Multi-page ("1 out of 2" -> "2 out of 2") Payout History traversal' },
        ],
    },
];

for (const contract of requiredArchitectureContracts) {
    const fullPath = path.resolve(contract.file);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf8');
    for (const req of contract.mustContain) {
        if (!req.pattern.test(content)) {
            console.error(`❌ Golden Rule #3 Architecture Contract Violation in ${contract.file}: Missing ${req.label}`);
            hasErrors = true;
        }
    }
}

// =========================================================================
// 8. BAN HARDCODED '2026-10-15' FALLBACK DATE IN RICOCHET SYNC PIPELINE
// =========================================================================
const noHardcodedFallbackDateFiles = [
    'src/lib/ricochetPayoutParser.ts',
    'src/composables/useRicochetSalesSync.ts',
    'public/ricochet-upc-sync.user.js',
];

for (const relPath of noHardcodedFallbackDateFiles) {
    const fullPath = path.resolve(relPath);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf8');
    if (/['"]2026-10-15['"]/.test(content)) {
        console.error(`❌ Hardcoded Date Violation in ${relPath}: Do not hardcode '2026-10-15' fallback dates; parse real Paid/Sold dates from Ricochet Export CSVs and Payout History pages.`);
        hasErrors = true;
    }
}

// =========================================================================
// 9. AUTOMATED ARCHITECTURE CIRCUIT BREAKER: ZERO HARDCODED SKU DICTIONARIES
// =========================================================================
function assertNoHardcodedSkuMaps() {
    const scanDirs = ['src', 'public'];
    const targetExts = ['.ts', '.js', '.mjs', '.vue', '.astro'];
    const hardcodedSkuRegex = /0EJ[0-9A-Z]{3}["']?\s*:\s*["'](HUCK|PDXGL)/g;

    for (const dir of scanDirs) {
        if (!fs.existsSync(dir)) continue;
        const filesToScan = getFiles(dir, targetExts);
        for (const filePath of filesToScan) {
            const relFile = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
            const content = fs.readFileSync(filePath, 'utf8');
            const matches = content.match(hardcodedSkuRegex);
            if (matches && matches.length > 2) {
                console.error(
                    `❌ Fatal Architecture Error in ${relFile}: Found ${matches.length} hardcoded 0EJxxx -> HUCK/PDXGL dictionary mappings (> 2 max allowed). Populate Appwrite documents via scripts/seed-md-booth-skus.mjs and build lookup maps dynamically at runtime!`
                );
                process.exit(1);
            }
        }
    }
}

assertNoHardcodedSkuMaps();

// =========================================================================
// 10. BOOKMARKLET CLEANLINESS: NO BOOTSTRAP PAYLOAD / BAKED SKU MAPS / LITERAL FEE+RENT FALLBACKS
// =========================================================================
const bookmarkletFiles = ['src/pages/scripts/rico-bookmarklet.js.ts', 'public/ricochet-upc-sync.user.js'];
const forbiddenBookmarkletPatterns = [
    { pattern: /__RC_BOOTSTRAP_PAYLOAD__/, reason: 'window.__RC_BOOTSTRAP_PAYLOAD__ / baked skuToUpcMap snapshots are forbidden; fetch live data from /api/md-verify-report instead' },
    { pattern: /PREVERIFIED_MD_SKU_TO_UPC_OR_ID/, reason: 'Bookmarklet must not import or inject static SKU dictionaries' },
    { pattern: /(?:monthlyRent|commissionRate|feePct)\s*:\s*(?:382\.5|15)\b/, reason: 'Do not hardcode monthlyRent 382.5 / commissionRate 15 / feePct 15; read from central Location Settings' },
    { pattern: /activeCommissionRate\s*\|\|\s*15\b/, reason: 'Do not fall back to a literal 15% commission rate' },
];
for (const relPath of bookmarkletFiles) {
    const fullPath = path.resolve(relPath);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf8');
    for (const check of forbiddenBookmarkletPatterns) {
        const m = check.pattern.exec(content);
        if (m) {
            const line = content.slice(0, m.index).split('\n').length;
            console.error(`❌ Bookmarklet Cleanliness Violation in ${relPath}:${line}: ${check.reason}`);
            hasErrors = true;
        }
    }
}

// =========================================================================
// 11. RAW CSV TRANSPORT + LIVE APPWRITE LOCATION SETTINGS GUARDRAIL
// =========================================================================
const transportContracts = [
    {
        file: 'public/ricochet-upc-sync.user.js',
        mustContain: [
            { pattern: /rawCsv\s*:/, label: 'rawCsv in the POST payload to /api/sales/ricochet-sync' },
            { pattern: /payoutHistoryPages\s*:/, label: 'payoutHistoryPages (all harvested "N out of M" pages) in the POST payload' },
        ],
    },
    {
        file: 'src/pages/api/sales/ricochet-sync.ts',
        mustContain: [
            { pattern: /\bingestRawCsvAndPages\s*\(/, label: 'Server-side ingestion of body.rawCsv + payoutHistoryPages' },
            { pattern: /\bparseRicochetExportCsv\s*\(/, label: 'Dual-schema Export CSV parsing of the staged rawCsv' },
            { pattern: /\bloadLiveWarehouseDocs\s*\(/, label: 'Live Appwrite location settings (fee / rent) for sales sync' },
        ],
    },
    {
        file: 'src/composables/useRicochetSalesSync.ts',
        mustContain: [
            { pattern: /\bricochetRawCsv\b/, label: 'Ingestion of rawCsv from the staged API payload' },
        ],
        mustNotContain: [
            { pattern: /localStorage\.getItem\(\s*['"`]rc_ricochet_export_capture/, label: 'cross-origin localStorage lookup of Ricochet captures' },
        ],
    },
    {
        file: 'src/pages/scripts/rico-bookmarklet.js.ts',
        mustContain: [
            { pattern: /\bloadLiveWarehouseDocs\s*\(/, label: 'Bookmarklet fee / rent resolved from live Appwrite location document' },
        ],
    },
    {
        file: 'src/components/sales/SalesImportTray.vue',
        mustContain: [
            { pattern: /Upload Month-End Payout CSV/, label: 'Month-End Payout CSV dropzone inside the slide-over tray' },
            { pattern: /Multi-Month Demo/, label: 'Multi-Month Demo button inside the slide-over tray' },
            { pattern: /emit\(\s*['"]close['"]\s*\)/, label: 'Auto-close of the tray on file selection / demo load' },
        ],
    },
    {
        file: 'src/components/sales/SalesImporter.vue',
        mustContain: [
            { pattern: /<SalesImportTray\b/, label: 'Slide-over tray mounted in the Sales Importer' },
            { pattern: /Manual CSV &amp; Demo/, label: '"📂 Manual CSV & Demo" toolbar trigger' },
        ],
        mustNotContain: [
            { pattern: /Consignment Mall Lifecycle/, label: 'redundant workflow explainer card in the main page body' },
            { pattern: /<h3 class="font-bold text-lg mb-1">Upload Month-End Payout CSV<\/h3>/, label: 'inline Upload Month-End Payout CSV dropzone (belongs in the tray)' },
        ],
    },
    {
        file: 'src/components/sales/RicochetLiveSalesPanel.vue',
        mustContain: [
            { pattern: /<BottomActionDock\b/, label: 'Sticky bottom action bar (BottomActionDock)' },
            { pattern: /Unlock Live Commit/, label: 'Unlock Live Commit checkbox in the bottom bar' },
            { pattern: /Committing to Appwrite\.\.\./, label: 'Live batch progress text in the bottom bar' },
            { pattern: /Already Synced \(\{\{\s*lockedItemCount\s*\}\} items committed\)/, label: 'Permanent Already Synced badge' },
        ],
    },
    {
        file: 'src/composables/useRicochetSalesSync.ts',
        mustContain: [
            { pattern: /COMMIT_BATCH_SIZE\s*=\s*25\b/, label: 'Chunked client-side commits of 25 rows' },
            { pattern: /await\s+databases\.createDocument\(\s*DATABASE_ID\s*,\s*COLLECTION_SALES\s*,\s*ID\.unique\(\)\s*,\s*saleDoc/, label: 'Direct client-side Appwrite SDK sales document creation' },
            { pattern: /Promise\.all\(\s*pendingWrites\s*\)/, label: 'Client-side batch writes via Promise.all' },
            { pattern: /ticketLineKey\s*\(/, label: 'Per-line (multiset) ticket + gross + net duplicate ledger' },
            { pattern: /skippedNoTicket/, label: 'Sales are created only from rows that have a real Ricochet ticket + sold date' },
            { pattern: /if\s*\(\s*row\.matchedItemId\s*&&\s*!isBinSale\s*\)/, label: 'Booth Bin double-depletion guard (!isBinSale on item update)' },
            { pattern: /Appwrite rejected batch/, label: 'Exact Appwrite error surfaced when a batch is rejected' },
        ],
        mustNotContain: [
            { pattern: /mode:\s*['"](?:commit|finalize)['"]/, label: 'serverless proxy commit/finalize calls (commits must use client Appwrite SDK directly)' },
            { pattern: /X-Appwrite-Key/i, label: 'serverless X-Appwrite-Key usage inside client sales sync composable' },
        ],
    },
    {
        file: 'src/pages/api/sales/ricochet-sync.ts',
        mustContain: [
            { pattern: /\bskippedDuplicateTickets\b/, label: 'Layer 3 ticket + date + location idempotency shield' },
            { pattern: /\bmarkRawCsvManifestCommitted\s*\(/, label: 'Layer 2 manifest commit state lock' },
            { pattern: /committed_at/, label: 'committed_at timestamp on the staging manifest' },
            { pattern: /committed_count/, label: 'committed_count on the staging manifest' },
        ],
    },
    {
        file: '.agents/skills/hucks-resale-core/SKILL.md',
        mustContain: [
            { pattern: /LAW 1 — 4 Locations Only/, label: 'Law 1 (4 Locations Only) in the master shared skill' },
            { pattern: /LAW 2 — Zero Hardcoding/, label: 'Law 2 (Zero Hardcoding) in the master shared skill' },
            { pattern: /LAW 3 — 100% Shared Matching/, label: 'Law 3 (Shared Matching via salesBucketing.ts) in the master shared skill' },
            { pattern: /LAW 4 — Appwrite-First Persistence/, label: 'Law 4 (Appwrite-First Persistence) in the master shared skill' },
            { pattern: /LAW 5 — Enterprise UX\/IA Pattern/, label: 'Law 5 (Enterprise UX/IA Pattern) in the master shared skill' },
            { pattern: /LAW 6 — 3-Tier Commit Idempotency/, label: 'Law 6 (3-Tier Commit Idempotency) in the master shared skill' },
            { pattern: /LAW 7 — Date Bucketing Standard/, label: 'Law 7 (Date Bucketing Standard) in the master shared skill' },
        ],
    },
    {
        file: 'scripts/sync-ai-context.mjs',
        mustContain: [
            { pattern: /const MASTER_ARCHITECTURE_LAWS\s*=/, label: 'Single-source MASTER_ARCHITECTURE_LAWS constant' },
            { pattern: /LAW 7 — Date Bucketing Standard/, label: 'Law 7 inside the sync generator (skill header + GEMINI.md)' },
        ],
    },
    {
        file: 'src/lib/salesBucketing.ts',
        mustContain: [
            { pattern: /export function calendarMonthKeyFromDateString\s*\(/, label: 'One-indexed calendar sold-date month key helper' },
            { pattern: /export function monthKeyToLabel\s*\(/, label: 'monthKeyToLabel (2026-11 -> November 2026)' },
        ],
    },
    {
        file: 'src/components/sales/SalesImporter.vue',
        mustContain: [
            { pattern: /calendarMonthKeyFromDateString\(\s*soldDateStr\s*\)/, label: 'Payout cycles grouped by calendar sold date' },
        ],
        mustNotContain: [
            { pattern: /soldDateStr\s*\|\|\s*rentDateStr\s*\|\|\s*paidDateStr/, label: 'payout-check (paid date) month bucketing' },
        ],
    },
    {
        file: 'src/components/sales/CoopSettlementView.vue',
        mustNotContain: [
            { pattern: /\.getMonth\s*\(/, label: 'Date#getMonth() (0-indexed) month bucketing' },
            { pattern: /FIXED_BOOTH_RENT\s*=\s*\d/, label: 'hardcoded booth rent (resolve from the live warehouse document)' },
        ],
    },
    {
        file: 'src/components/sales/SalesList.vue',
        mustNotContain: [
            { pattern: /\.getMonth\s*\(/, label: 'Date#getMonth() (0-indexed) month bucketing' },
        ],
    },
];
// The master shared skill is the single source of truth for the 7 laws — no standalone rule files
if (fs.existsSync(path.resolve('.agents/rules/master-architecture-laws.md'))) {
    console.error('❌ Standalone .agents/rules/master-architecture-laws.md must be deleted: the 7 laws live ONLY in the master shared skill (hucks-resale-core) via scripts/sync-ai-context.mjs.');
    hasErrors = true;
}

for (const contract of transportContracts) {
    const fullPath = path.resolve(contract.file);
    if (!fs.existsSync(fullPath)) {
        console.error(`❌ Transport Contract Violation: missing ${contract.file}`);
        hasErrors = true;
        continue;
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    for (const req of contract.mustContain || []) {
        if (!req.pattern.test(content)) {
            console.error(`❌ Transport Contract Violation in ${contract.file}: Missing ${req.label}`);
            hasErrors = true;
        }
    }
    for (const ban of contract.mustNotContain || []) {
        if (ban.pattern.test(content)) {
            console.error(`❌ Transport Contract Violation in ${contract.file}: Forbidden ${ban.label}`);
            hasErrors = true;
        }
    }
}

// =========================================================================
// 12. DAISYUI V5 & TAILWIND ANTI-OVERLAP / ANTI-CLIPPING GUARDRAILS
// =========================================================================
{
    // 12A. Ensure global.css enforces .badge { white-space: nowrap } and defines .badge-2xs / .btn-2xs
    const globalCssPath = path.resolve('src/styles/global.css');
    if (fs.existsSync(globalCssPath)) {
        const globalCss = fs.readFileSync(globalCssPath, 'utf8');
        if (!/\.badge\s*\{[^}]*white-space:\s*nowrap/s.test(globalCss)) {
            console.error(
                '❌ Global Badge Overflow Guard Missing in src/styles/global.css: .badge must enforce "white-space: nowrap" so badges never wrap onto 2 lines and overflow into card titles!'
            );
            hasErrors = true;
        }
        if (!/\.badge-2xs\s*\{/.test(globalCss) || !/\.btn-2xs\s*\{/.test(globalCss)) {
            console.error(
                '❌ Micro-Badge Utility Missing in src/styles/global.css: .badge-2xs and .btn-2xs must be defined in global.css so compact badges never fall back to badge-md height!'
            );
            hasErrors = true;
        }
    }

    // 12D. Views that render <BottomActionDock> self-clear via its built-in spacer — ban stacked manual pb-24..pb-48 on the same file
    const dockUserFiles = getFiles('src', ['.vue']).filter(
        (f) => !f.endsWith('BottomActionDock.vue') && /<BottomActionDock\b/.test(fs.readFileSync(f, 'utf8'))
    );
    for (const f of dockUserFiles) {
        const rel = path.relative(process.cwd(), f).replace(/\\/g, '/');
        const src = fs.readFileSync(f, 'utf8');
        if (/\bpb-(?:28|32|36|40|44|48)\b/.test(src.split('<script')[0]) && !/overflow-y-auto/.test(src.split('<script')[0].match(/class="[^"]*\bpb-(?:28|32|36|40|44|48)\b[^"]*"/)?.[0] || '')) {
            console.error(
                `❌ Stacked Dock Clearance in ${rel}: this view uses <BottomActionDock> (self-clearing spacer) — remove manual pb-28..pb-48 and use pb-6 sm:pb-8!`
            );
            hasErrors = true;
        }
    }

    const uiFiles = getFiles('src', ['.vue', '.astro']);
    const classAttrRegex = /\bclass="([^"]+)"/g;

    for (const filePath of uiFiles) {
        const relFile = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
        const content = fs.readFileSync(filePath, 'utf8');

        // Scan static class="..." attributes for CSS clipping / responsive padding traps
        let cm;
        while ((cm = classAttrRegex.exec(content)) !== null) {
            const cls = cm[1];
            const line = content.slice(0, cm.index).split('\n').length;

            // 12B. Never combine line-clamp-* and vertical padding (p-*, py-*, pb-*) on the same element
            // (overflow: hidden clips at the border box, so line N+1 renders inside bottom padding and gets sliced horizontally in half!)
            if (/\bline-clamp-[1-6]\b/.test(cls) && /\b(?:p-\d+(?:\.\d+)?|py-\d+(?:\.\d+)?|pb-\d+(?:\.\d+)?)\b/.test(cls)) {
                console.error(
                    `❌ CSS Line-Clamp Clipping Bug in ${relFile}:${line}: Do not put "line-clamp-*" and vertical padding (p-*/py-*/pb-*) on the same element (line N+1 peeks into bottom padding and gets sliced in half). Put padding/border/bg on an outer <div> and line-clamp-* on an inner unpadded element!`
                );
                hasErrors = true;
            }

            // 12C. Never combine md:p-* / lg:p-* with a large pb-* dock-clearance class without md:pb-*
            // (md:p-8 resets padding-bottom to 2rem on desktop, causing fixed bottom docks to overlap page content!)
            if (
                /\b(?:md|lg):p-\d+\b/.test(cls) &&
                /\bpb-(?:24|28|32|36|40|44|48)\b/.test(cls) &&
                !/\b(?:md|lg):pb-/.test(cls)
            ) {
                console.error(
                    `❌ Responsive Dock-Clearance Override Bug in ${relFile}:${line}: "${cls}" uses md:p-* / lg:p-* which overrides pb-* at desktop breakpoints and causes BottomActionDock to cover bottom content. Use px-* pt-* sm:px-* sm:pt-* md:px-* md:pt-* pb-* instead!`
                );
                hasErrors = true;
            }
        }
    }
}

if (!hasErrors) {
    console.log(`✅ Clean lint! All ${vueFiles.length} Vue SFCs, ${tsFiles.length} TS files, TDZ declaration order, scripts/ allowlist, Zero Hardcoded Locations, and price-parsing invariants passed with ZERO errors!`);
} else {
    process.exit(1);
}

