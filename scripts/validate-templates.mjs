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
            const vName = path.resolve(file + '.ts').replace(/\\/g, '/');
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
const normalizeVirtualKey = (f) => path.resolve(f).replace(/\\/g, '/');
const customHost = {
    ...defaultHost,
    getSourceFile: (fileName, languageVersion) => {
        const key = virtualVueMap.has(fileName) ? fileName : normalizeVirtualKey(fileName);
        if (virtualVueMap.has(key)) {
            return ts.createSourceFile(fileName, virtualVueMap.get(key), languageVersion, true);
        }
        return defaultHost.getSourceFile(fileName, languageVersion);
    },
    fileExists: (fileName) => {
        if (virtualVueMap.has(fileName) || virtualVueMap.has(normalizeVirtualKey(fileName))) return true;
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
    // TS2554 / TS2555: Wrong function argument count (e.g., passing 5 positional args instead of 1 options object)
    // TS2559: Incompatible weak/fallback object shape (e.g., passing string label instead of fallback object to parseAiJson)
    // TS1xxx: Any TypeScript/JavaScript syntax error
    const isCritical = (code === 2304 || code === 2552 || code === 2307 || code === 2448 || code === 2454 || code === 2554 || code === 2555 || code === 2559 || (code >= 1000 && code < 2000));

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
// 5c. SKILL, RULE, AGENTS.MD & PLUGIN SUBAGENT HEALTH CHECK
// =========================================================================
{
    const agentsMdPath = path.join(process.cwd(), 'AGENTS.md');
    if (!fs.existsSync(agentsMdPath)) {
        console.error('❌ Rule health: Missing root AGENTS.md workspace rules file!');
        hasErrors = true;
    } else {
        const agentsBytes = Buffer.byteLength(fs.readFileSync(agentsMdPath, 'utf8'), 'utf8');
        if (agentsBytes >= 24000) {
            console.error(`❌ Rule health: AGENTS.md is ${agentsBytes} bytes (>= 24,000 B Antigravity hard cap — Laws 1–7 will truncate!)`);
            hasErrors = true;
        } else if (agentsBytes >= 20000) {
            console.warn(`⚠️ Rule health: AGENTS.md is ${agentsBytes} bytes (approaching 24,000 B cap; keep < 20,000 B)`);
        }
    }
    for (const legacyRule of ['GEMINI.md', '.clinerules']) {
        if (fs.existsSync(path.join(process.cwd(), legacyRule))) {
            console.error(`❌ Rule health: Legacy root ${legacyRule} found alongside AGENTS.md — delete it to prevent duplicate rule token loading!`);
            hasErrors = true;
        }
    }

    const skillsRoot = path.join(process.cwd(), '.agents', 'skills');
    const rulesRoot = path.join(process.cwd(), '.agents', 'rules');
    const looseAgentsRoot = path.join(process.cwd(), '.agents', 'agents');
    const pluginsRoot = path.join(process.cwd(), '.agents', 'plugins');

    if (fs.existsSync(skillsRoot)) {
        for (const dir of fs.readdirSync(skillsRoot, { withFileTypes: true })) {
            if (!dir.isDirectory()) {
                if (dir.name !== '.DS_Store') {
                    console.error(`❌ Skill health: loose file .agents/skills/${dir.name} is ignored by Antigravity; delete or move into .agents/skills/<name>/SKILL.md`);
                    hasErrors = true;
                }
                continue;
            }
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

    if (fs.existsSync(rulesRoot)) {
        for (const entry of fs.readdirSync(rulesRoot, { withFileTypes: true })) {
            if (entry.isDirectory()) {
                console.error(`❌ Rule health: subdirectory .agents/rules/${entry.name}/ is ignored by Antigravity; rules must sit flat in .agents/rules/*.md`);
                hasErrors = true;
                continue;
            }
            if (!entry.name.endsWith('.md')) continue;
            const rulePath = path.join(rulesRoot, entry.name);
            const ruleText = fs.readFileSync(rulePath, 'utf8');
            const ruleBytes = Buffer.byteLength(ruleText, 'utf8');
            if (ruleBytes >= 24000) {
                console.error(`❌ Rule health: .agents/rules/${entry.name} is ${ruleBytes} bytes (>= 24,000 B Antigravity hard cap)`);
                hasErrors = true;
            }
            const fm = ruleText.match(/^---\r?\n([\s\S]*?)\r?\n---/);
            if (!fm) {
                console.error(`❌ Rule health: .agents/rules/${entry.name} is missing YAML frontmatter ("trigger: always_on | glob | model_decision | manual")`);
                hasErrors = true;
                continue;
            }
            const triggerMatch = fm[1].match(/^trigger:\s*(always_on|glob|model_decision|manual)\s*$/m);
            if (!triggerMatch) {
                console.error(`❌ Rule health: .agents/rules/${entry.name} has invalid or missing "trigger:" in frontmatter`);
                hasErrors = true;
                continue;
            }
            if (triggerMatch[1] === 'glob') {
                const globsMatch = fm[1].match(/^globs:\s*(.+)$/m);
                if (!globsMatch || !globsMatch[1].trim()) {
                    console.error(`❌ Rule health: .agents/rules/${entry.name} has "trigger: glob" without non-empty "globs:"`);
                    hasErrors = true;
                } else if (/[{}]/.test(globsMatch[1])) {
                    console.error(`❌ Rule health: .agents/rules/${entry.name} "globs:" contains "{...}" brace syntax (expand to comma-separated patterns)`);
                    hasErrors = true;
                }
            }
        }
    }

    if (fs.existsSync(looseAgentsRoot)) {
        console.error(`❌ Agent health: .agents/agents/ is not discovered by Antigravity; package custom subagents under .agents/plugins/<plugin>/agents/*.md with plugin.json`);
        hasErrors = true;
    }

    if (fs.existsSync(pluginsRoot)) {
        for (const plug of fs.readdirSync(pluginsRoot, { withFileTypes: true })) {
            if (!plug.isDirectory()) continue;
            const manifestPath = path.join(pluginsRoot, plug.name, 'plugin.json');
            if (!fs.existsSync(manifestPath)) {
                console.error(`❌ Plugin health: .agents/plugins/${plug.name}/ is missing plugin.json`);
                hasErrors = true;
            } else {
                try {
                    const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                    if (!parsed.name) {
                        console.error(`❌ Plugin health: .agents/plugins/${plug.name}/plugin.json is missing "name"`);
                        hasErrors = true;
                    }
                } catch (e) {
                    console.error(`❌ Plugin health: .agents/plugins/${plug.name}/plugin.json invalid JSON: ${e.message}`);
                    hasErrors = true;
                }
            }
            const plugAgentsDir = path.join(pluginsRoot, plug.name, 'agents');
            if (fs.existsSync(plugAgentsDir)) {
                for (const ag of fs.readdirSync(plugAgentsDir, { withFileTypes: true })) {
                    if (!ag.isFile() || !ag.name.endsWith('.md')) continue;
                    const agText = fs.readFileSync(path.join(plugAgentsDir, ag.name), 'utf8');
                    const fm = agText.match(/^---\r?\n([\s\S]*?)\r?\n---/);
                    if (
                        !fm ||
                        !/^name:\s*\S/m.test(fm[1]) ||
                        !/^description:\s*\S/m.test(fm[1]) ||
                        !/^subagent:\s*(true|false)\s*$/m.test(fm[1]) ||
                        !/^tools:\s*\[/m.test(fm[1])
                    ) {
                        console.error(`❌ Plugin agent health: .agents/plugins/${plug.name}/agents/${ag.name} needs frontmatter with name, description, subagent, and tools`);
                        hasErrors = true;
                    }
                }
            }
        }
    }

    // Every ?raw module imported in src/lib/generatedSkillBundles.ts must exist on disk
    const skillBundlesPath = path.join(process.cwd(), 'src', 'lib', 'generatedSkillBundles.ts');
    if (!fs.existsSync(skillBundlesPath)) {
        console.error('❌ Skill health: Missing src/lib/generatedSkillBundles.ts');
        hasErrors = true;
    } else {
        const bundlesSource = fs.readFileSync(skillBundlesPath, 'utf8');
        const rawImportRegex = /from\s+['"]([^'"]+)\?raw['"]/g;
        let m;
        let count = 0;
        while ((m = rawImportRegex.exec(bundlesSource))) {
            count += 1;
            const relImport = m[1];
            const resolved = path.resolve(path.dirname(skillBundlesPath), relImport);
            if (!fs.existsSync(resolved)) {
                console.error(`❌ Skill health: generatedSkillBundles.ts imports "${relImport}?raw" but ${path.relative(process.cwd(), resolved)} does not exist`);
                hasErrors = true;
            }
        }
        if (count === 0) {
            console.error('❌ Skill health: src/lib/generatedSkillBundles.ts has zero ?raw skill imports');
            hasErrors = true;
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
            { pattern: /Saving sales to ledger/, label: 'Live batch progress text in the bottom bar (Plain-English Collective Voice)' },
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
            { pattern: /Couldn't save batch \$\{batchNo\}\/\$\{batchCount\}/, label: 'Reassuring batch retry error surfaced when a batch fails' },
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
        file: 'AGENTS.md',
        mustContain: [
            { pattern: /LAW 1 — 4 Locations Only/, label: 'Law 1 (4 Locations Only) in root AGENTS.md' },
            { pattern: /LAW 2 — Zero Hardcoding/, label: 'Law 2 (Zero Hardcoding) in root AGENTS.md' },
            { pattern: /LAW 3 — 100% Shared Matching/, label: 'Law 3 (Shared Matching via salesBucketing.ts) in root AGENTS.md' },
            { pattern: /LAW 4 — Appwrite-First Persistence/, label: 'Law 4 (Appwrite-First Persistence) in root AGENTS.md' },
            { pattern: /LAW 5 — Enterprise UX\/IA Pattern/, label: 'Law 5 (Enterprise UX/IA Pattern) in root AGENTS.md' },
            { pattern: /LAW 6 — 3-Tier Commit Idempotency/, label: 'Law 6 (3-Tier Commit Idempotency) in root AGENTS.md' },
            { pattern: /LAW 7 — Date Bucketing Standard/, label: 'Law 7 (Date Bucketing Standard) in root AGENTS.md' },
        ],
    },
    {
        file: '.agents/skills/hucks-resale-core/SKILL.md',
        mustContain: [
            { pattern: /AGENTS\.md/, label: 'Pointer to root AGENTS.md (single source of truth for Laws 1–7)' },
            { pattern: /ACTIVE_SESSION\.md/, label: 'Pointer to ACTIVE_SESSION.md' },
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
        mustContain: [
            { pattern: /\bbuildMonthlySettlementFromInputs\s*\(/, label: 'Delegation of 4-Gate settlement math to buildMonthlySettlementFromInputs' },
        ],
        mustNotContain: [
            { pattern: /\.getMonth\s*\(/, label: 'Date#getMonth() (0-indexed) month bucketing' },
            { pattern: /FIXED_BOOTH_RENT\s*=\s*\d/, label: 'hardcoded booth rent (resolve from the live warehouse document)' },
            { pattern: /\?\?\s*382\.5\b/, label: 'hardcoded 382.5 booth rent fallback (Law 2)' },
            { pattern: /15%/, label: 'hardcoded 15% venue fee string in CoopSettlementView (use dynamic venueFeePct)' },
            { pattern: /\bDEFAULT_COOP_LABOR_ENTRIES\b/, label: 'demo seed labor entries inside CoopSettlementView' },
            { pattern: /\bgetLaborHoursByMemberForMonth\s*\(/, label: 'direct getLaborHoursByMemberForMonth call in CoopSettlementView (must come via settlementInputs with status filter)' },
        ],
    },
    {
        file: 'src/lib/coop/settlementEngine.ts',
        mustNotContain: [
            { pattern: /\b85\.41\b/, label: 'hardcoded 85.41 consignor rent default in settlementEngine (Law 2)' },
            { pattern: /=\s*0\.15\b/, label: 'hardcoded 0.15 venueFeeRate fallback in settlementEngine (Law 2)' },
            { pattern: /=\s*0\.70?\b/, label: 'hardcoded 0.70 curatorSplitRate fallback in settlementEngine (Law 2)' },
            { pattern: /=\s*0\.30?\b/, label: 'hardcoded 0.30 commonsSplitRate fallback in settlementEngine (Law 2)' },
            { pattern: /\.getMonth\s*\(/, label: 'Date#getMonth() (0-indexed) month bucketing' },
        ],
    },
    {
        file: 'src/lib/coop/settlementInputs.ts',
        mustContain: [
            { pattern: /\bisSettlementEligibleLabor\s*\(/, label: 'isSettlementEligibleLabor gate before weighting labor hours' },
            { pattern: /getLaborHoursByMemberForMonth\([\s\S]*?\{\s*status:/, label: 'explicit status option on getLaborHoursByMemberForMonth' },
        ],
        mustNotContain: [
            { pattern: /\b85\.41\b/, label: 'hardcoded 85.41 consignor rent default in settlementInputs (Law 2)' },
            { pattern: /=\s*0\.15\b/, label: 'hardcoded 0.15 venueFeeRate fallback in settlementInputs (Law 2)' },
            { pattern: /=\s*0\.70?\b/, label: 'hardcoded 0.70 curatorSplitRate fallback in settlementInputs (Law 2)' },
            { pattern: /=\s*0\.30?\b/, label: 'hardcoded 0.30 commonsSplitRate fallback in settlementInputs (Law 2)' },
            { pattern: /\.getMonth\s*\(/, label: 'Date#getMonth() (0-indexed) month bucketing' },
        ],
    },
    {
        file: 'src/lib/coopSettlementPdf.ts',
        mustNotContain: [
            { pattern: /\b(?:70|30)%/, label: 'hardcoded 70% / 30% strings in coopSettlementPdf (use dynamic curatorSharePct / commonsSharePct)' },
            { pattern: /\.(?:getMonth|getUTCMonth)\s*\(/, label: 'Date#getMonth() / getUTCMonth() date formatting in coopSettlementPdf (Law 7)' },
        ],
    },
    {
        file: 'src/components/coop/CoopLaborView.vue',
        mustContain: [
            { pattern: /\buseCoopFounderGate\s*\(/, label: 'server-backed useCoopFounderGate role check in CoopLaborView' },
        ],
        mustNotContain: [
            { pattern: /\bsaveCoopGovernanceState\b/, label: 'direct client saveCoopGovernanceState labor writes in CoopLaborView (must route via /api/coop/labor)' },
            { pattern: /\bDEFAULT_COOP_LABOR_ENTRIES\b/, label: 'demo seed labor entries in CoopLaborView' },
            { pattern: /\.getMonth\s*\(/, label: 'Date#getMonth() (0-indexed) month bucketing' },
        ],
    },
    {
        file: 'src/pages/api/coop/me.ts',
        mustContain: [
            { pattern: /\brequireCoopRole\b/, label: 'requireCoopRole live Appwrite Team role verification' },
        ],
        mustNotContain: [
            { pattern: /\btenantId\b/, label: 'client-supplied tenantId in /api/coop/me (must use server COOP_TEAM_ID)' },
        ],
    },
    {
        file: 'src/pages/api/coop/labor.ts',
        mustContain: [
            { pattern: /\brequireCoopRole\b/, label: 'requireCoopRole live Appwrite Team role verification' },
            { pattern: /\brequireCoopFounder\b/, label: 'requireCoopFounder approval gate' },
            { pattern: /\brequireCoopMember\b/, label: 'requireCoopMember member gate' },
            { pattern: /\bassertMonthUnlocked\b/, label: 'assertMonthUnlocked month-lock check before writes' },
        ],
        mustNotContain: [
            { pattern: /\btenantId\b/, label: 'client-supplied tenantId in /api/coop/labor (must use server COOP_TEAM_ID)' },
        ],
    },
    {
        file: 'src/pages/api/coop/month-lock.ts',
        mustContain: [
            { pattern: /\brequireCoopRole\b/, label: 'requireCoopRole live Appwrite Team role verification' },
            { pattern: /\brequireCoopFounder\b/, label: 'requireCoopFounder lock/unlock gate' },
            { pattern: /\bassertMonthUnlocked\b/, label: 'month-lock enforcement reference' },
        ],
        mustNotContain: [
            { pattern: /\btenantId\b/, label: 'client-supplied tenantId in /api/coop/month-lock (must use server COOP_TEAM_ID)' },
        ],
    },
    {
        file: 'src/components/sales/SalesList.vue',
        mustContain: [
            { pattern: /<SlideOverDrawer\b/, label: 'Canonical SlideOverDrawer confirmation UI for staged Ricochet sales' },
        ],
        mustNotContain: [
            { pattern: /\.getMonth\s*\(/, label: 'Date#getMonth() (0-indexed) month bucketing' },
        ],
    },
    {
        file: 'src/pages/api/identify-item.ts',
        mustContain: [
            { pattern: /calibrationBlock:\s*calibrationBlock/, label: 'Strict Context Separation (Law 2.G): pass calibrationBlock separately to buildSpeedScoutUserPrompt' },
        ],
        mustNotContain: [
            { pattern: /notesWithCalibration/, label: 'Concatenating calibration rules into authoritativeUserNotes (Law 2.G violation)' },
            { pattern: /authoritativeUserNotes:\s*`[^`]*calibrationBlock/, label: 'Interpolating calibrationBlock into authoritativeUserNotes (Law 2.G violation)' },
        ],
    },
    {
        file: 'public/auction-scout-sync.user.js',
        mustNotContain: [
            { pattern: /var\s+unitLandedInline\s*=\s*\(Number\(rep\./, label: 'Undefined rep reference inside renderItemTrayBody (must use state.scoutReport / repObj)' },
        ],
    },
];
// Root AGENTS.md is the single source of truth for the 7 laws — no standalone rule files
if (fs.existsSync(path.resolve('.agents/rules/master-architecture-laws.md'))) {
    console.error('❌ Standalone .agents/rules/master-architecture-laws.md must be deleted: the 7 laws live ONLY in root AGENTS.md.');
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
// 11B. ZERO NATIVE BROWSER JS ALERT / CONFIRM / PROMPT DIALOGS IN SALES SYNC
// =========================================================================
{
    const noNativeDialogFiles = [
        'public/ricochet-upc-sync.user.js',
        'src/components/sales/SalesList.vue',
        'src/components/sales/RicochetLiveSalesPanel.vue',
        'src/components/sales/CoopSettlementView.vue',
        'src/components/coop/CoopLaborView.vue',
        'src/components/coop/CoopMonthLockBar.vue',
        'src/components/coop/CoopSweatEquityDrawer.vue',
        'src/components/coop/CoopRolesPanel.vue',
        'src/composables/useRicochetSalesSync.ts',
    ];
    for (const relFile of noNativeDialogFiles) {
        const fullPath = path.resolve(relFile);
        if (!fs.existsSync(fullPath)) continue;
        const raw = fs.readFileSync(fullPath, 'utf8');
        // Strip HTML comments, block comments, and // line comments before checking
        const codeOnly = raw
            .replace(/<!--[\s\S]*?-->/g, '')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/^\s*\/\/.*$/gm, '');
        const match = codeOnly.match(/(?:^|[^\w$.])(?:window\.)?(alert|confirm|prompt)\s*\(/m);
        if (match) {
            console.error(
                `❌ UX Law Violation in ${relFile}: Native browser JS dialog (${match[0].trim()}) is strictly forbidden — use canonical SlideOverDrawer / DaisyUI UI on The Works.`
            );
            hasErrors = true;
        }
    }

    // 11C. Server-Only coop_ledger Guard: Ban direct client SDK writes to coop_ledger / coop_labor_* / coop_lock_*
    const clientCheckDirs = ['src/components', 'src/composables', 'src/lib'];
    for (const dir of clientCheckDirs) {
        if (!fs.existsSync(dir)) continue;
        const files = getFiles(dir, ['.ts', '.js', '.vue']);
        for (const fPath of files) {
            const rel = path.relative(process.cwd(), fPath).replace(/\\/g, '/');
            if (rel === 'src/lib/coopLedgerServer.ts' || rel === 'src/lib/generatedSkillBundles.ts') continue;
            const txt = fs.readFileSync(fPath, 'utf8');
            if (/databases\.(?:create|update|delete)Document\s*\([^)]*(?:coop_ledger|coop_labor_|coop_lock_|COOP_LEDGER_COL_ID)/s.test(txt)) {
                console.error(
                    `❌ Security Violation in ${rel}: Direct client SDK write to coop_ledger / coop_labor_* / coop_lock_* is forbidden — route all writes via /api/coop/labor or /api/coop/month-lock.`
                );
                hasErrors = true;
            }
        }
    }
}

// =========================================================================
// 12. DAISYUI V5 & TAILWIND ANTI-OVERLAP / ANTI-CLIPPING GUARDRAILS
// =========================================================================
{
    // 12A. Verify Complete 29-Token DaisyUI v5 Theme Contract in src/styles/theme.css
    const themeCssPath = path.resolve('src/styles/theme.css');
    if (fs.existsSync(themeCssPath)) {
        const themeCss = fs.readFileSync(themeCssPath, 'utf8');
        const requiredThemeTokens = [
            '--border:',
            '--size-selector:',
            '--size-field:',
            '--depth:',
            '--noise:',
            '--radius-selector:',
            '--radius-field:',
            '--radius-box:',
            '--color-info:',
            '--color-success:',
            '--color-warning:',
            '--color-error:'
        ];
        for (const token of requiredThemeTokens) {
            if (!themeCss.includes(token)) {
                console.error(`❌ DaisyUI v5 Theme Token Contract Violation in src/styles/theme.css: missing "${token}" in huckleberry theme! Without this, DaisyUI's calc() expressions become invalid and collapse badge/button inner padding.`);
                hasErrors = true;
            }
        }
    }

    // 12B. Ban Legacy PostCSS & Tailwind v3 Config Files in Root
    for (const forbiddenConfig of ['postcss.config.js', 'postcss.config.mjs', 'postcss.config.cjs', 'tailwind.config.js', 'tailwind.config.mjs', 'tailwind.config.ts']) {
        if (fs.existsSync(path.resolve(forbiddenConfig))) {
            console.error(`❌ Forbidden Legacy Config File: "${forbiddenConfig}" found! Resale Command runs Tailwind v4 via @tailwindcss/vite in astro.config.mjs (Rust Oxide + Lightning CSS). Having PostCSS configs causes duplicate CSS passes and breaks DaisyUI v5 cascade layers.`);
            hasErrors = true;
        }
    }

    // 12C. Ensure global.css enforces .badge { white-space: nowrap } and defines utilities inside @layer utilities
    const globalCssPath = path.resolve('src/styles/global.css');
    if (fs.existsSync(globalCssPath)) {
        const globalCss = fs.readFileSync(globalCssPath, 'utf8');
        if (!/\.badge\s*\{[^}]*white-space:\s*nowrap/s.test(globalCss)) {
            console.error(
                '❌ Global Badge Overflow Guard Missing in src/styles/global.css: .badge must enforce "white-space: nowrap" so badges never wrap onto 2 lines and overflow into card titles!'
            );
            hasErrors = true;
        }
        if (!/@layer\s+utilities\s*\{[\s\S]*?\.badge-2xs/m.test(globalCss) || !/@layer\s+utilities\s*\{[\s\S]*?\.btn-2xs/m.test(globalCss)) {
            console.error(
                '❌ CSS Cascade Layer Violation in src/styles/global.css: .badge-2xs and .btn-2xs must be defined inside @layer utilities so standard Tailwind utilities can properly override them!'
            );
            hasErrors = true;
        }
        for (const cls of ['rc-page-shell', 'rc-page-shell-narrow', 'rc-card-grid', 'rc-dock-spacer']) {
            if (!new RegExp(`\\.${cls}\\s*\\{`).test(globalCss)) {
                console.error(`❌ Layout Primitive Missing in src/styles/global.css: .${cls} must be defined in @layer components!`);
                hasErrors = true;
            }
        }
    }

    // 12D. Views that render <BottomActionDock> self-clear via its built-in spacer — ban stacked manual pb-24..pb-48 on the same file
    const dockUserFiles = getFiles('src', ['.vue']).filter(
        (f) => !/(?:BottomActionDock|PaginationDock|InventoryPaginationDock)\.vue$/.test(f) && /<(?:BottomActionDock|PaginationDock|InventoryPaginationDock)\b/.test(fs.readFileSync(f, 'utf8'))
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

    const layoutSrc = fs.existsSync('src/layouts/Layout.astro') ? fs.readFileSync('src/layouts/Layout.astro', 'utf8') : '';
    if (/<(?:CoopMessagesTray|ToastContainer|ConfirmContainer|HuckleberryLoader)\b[^>]*\bclient:(?:load|idle|visible)\b/.test(layoutSrc)) {
        console.error(
            `❌ SSR <Teleport to="body"> Hydration Wipeout Bug in src/layouts/Layout.astro: Global body-teleported overlays (CoopMessagesTray, ToastContainer, ConfirmContainer, HuckleberryLoader) MUST use client:only="vue", never client:load/idle/visible!`
        );
        hasErrors = true;
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

            // 12E. Ban arbitrary pixel height/width hacks (h-[72px], h-[100px], max-w-[1600px]) on docks and page shells — enforce rem tokens & .rc-page-shell / .rc-dock-spacer
            if (/\b(?:h-\[72px\]|h-\[100px\]|max-w-\[1600px\])\b/.test(cls)) {
                console.error(
                    `❌ Arbitrary Pixel Shell/Dock Hack in ${relFile}:${line}: "${cls}" uses hardcoded pixel utilities (h-[72px]/h-[100px]/max-w-[1600px]). Use .rc-page-shell (96rem) and .rc-dock-spacer (useDockClearance) instead!`
                );
                hasErrors = true;
            }

            // 12F. Ban p-0 / px-0 on .badge elements (strips horizontal padding and causes text to touch borders)
            if (/\bbadge\b/.test(cls) && /\b(?:p-0|px-0)\b/.test(cls)) {
                console.error(
                    `❌ Stripped Badge Padding Bug in ${relFile}:${line}: "${cls}" applies p-0/px-0 to a .badge element! Badges require their proportional DaisyUI inner padding to prevent text/numbers from colliding with borders.`
                );
                hasErrors = true;
            }
        }

        // 12G. Style block @apply & @reference verification in Tailwind v4
        const styleRegex = /<style\b[^>]*>([\s\S]*?)<\/style>/g;
        let sm;
        while ((sm = styleRegex.exec(content)) !== null) {
            const styleBody = sm[1];
            if (/@apply\b/.test(styleBody) && !/@reference\b/.test(styleBody)) {
                console.error(
                    `❌ Tailwind v4 @apply Missing @reference in ${relFile}: Component <style> blocks using @apply must include @reference "../.../styles/global.css"; at the top so Vite and @tailwindcss/vite can resolve utility classes!`
                );
                hasErrors = true;
            }
            if (/@import\s+['"]tailwindcss['"]/.test(styleBody)) {
                console.error(
                    `❌ Duplicate Tailwind Bundle in ${relFile}: Do NOT use @import "tailwindcss" inside a component <style> block! Use @reference instead to avoid bundle duplication.`
                );
                hasErrors = true;
            }
        }
    }

    // 12H. Enforce Canonical Table & PaginationDock Pattern on Primary Table Views (ux-design-system-taxonomy Red Flag #8)
    const canonicalTableViews = [
        { file: 'src/components/purchases/PurchasesList.vue', astro: 'src/pages/purchases/index.astro', requireThumb: false },
        { file: 'src/components/sales/SalesList.vue', astro: 'src/pages/sales.astro', requireThumb: false },
        { file: 'src/components/studios/AppraisalPricingLabView.vue', astro: 'src/pages/studios/appraisal.astro', requireThumb: true },
    ];
    for (const tv of canonicalTableViews) {
        const vPath = path.resolve(tv.file);
        if (!fs.existsSync(vPath)) continue;
        const vSrc = fs.readFileSync(vPath, 'utf8');
        if (!/<PaginationDock\b/.test(vSrc)) {
            console.error(
                `❌ Canonical Table Pattern Violation in ${tv.file}: Primary data table views MUST mount <PaginationDock> from src/components/common/PaginationDock.vue (never hand-roll inline Prev/Next pagination bars)!`
            );
            hasErrors = true;
        }
        if (tv.requireThumb && !/<ItemThumbnail\b/.test(vSrc)) {
            console.error(
                `❌ Canonical Table Pattern Violation in ${tv.file}: Item data tables MUST render <ItemThumbnail> from src/components/common/ItemThumbnail.vue on item rows!`
            );
            hasErrors = true;
        }
        const aPath = path.resolve(tv.astro);
        if (fs.existsSync(aPath)) {
            const aSrc = fs.readFileSync(aPath, 'utf8');
            if (!/\bhideFooter\s*=\s*\{\s*true\s*\}/.test(aSrc)) {
                console.error(
                    `❌ Canonical Dock Page Violation in ${tv.astro}: Astro pages mounting <PaginationDock> or <BottomActionDock> MUST pass hideFooter={true} to <Layout>!`
                );
                hasErrors = true;
            }
        }
    }
}

// 13. ACCESS CONTROL: default-deny middleware allowlist, guest-gated member links, cookie consent, guest scout limiter
{
    const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');
    const fail = (msg) => { console.error(`❌ [Access Control] ${msg}`); hasErrors = true; };

    const middleware = read('src/middleware.ts');
    if (!/isPublicPagePath\s*\(/.test(middleware) || /protectedRoutes\s*=/.test(middleware)) {
        fail('src/middleware.ts must use the default-deny isPublicPagePath() allowlist (src/lib/publicRoutes.ts), not a protectedRoutes blocklist.');
    }

    const publicRoutes = read('src/lib/publicRoutes.ts');
    for (const mustBeMemberOnly of ['/dashboard', '/inventory', '/sales', '/expenses', '/warehouse', '/purchases', '/settings', '/studios', '/studios/bookmarklets', '/coop/vault', '/coop/settlements', '/coop/cms', '/item']) {
        if (new RegExp(`['"]${mustBeMemberOnly}['"]`).test(publicRoutes.split('PUBLIC_PREFIXES')[0])) {
            fail(`src/lib/publicRoutes.ts must NOT list ${mustBeMemberOnly} as a public path.`);
        }
    }

    const store = read('src/lib/store.ts');
    if (!/isPublicPagePath/.test(store)) {
        fail('src/lib/store.ts initAuth() must redirect guests on member-only pages via isPublicPagePath().');
    }

    const charter = read('src/components/coop/CoopCharterView.vue');
    if (/<CoopGovernanceView\s*\/>/.test(charter) && !/<CoopGovernanceView\s+v-if="isAuthenticated"/.test(charter)) {
        fail('CoopCharterView.vue must mount <CoopGovernanceView> only when isAuthenticated.');
    }

    const navbar = read('src/components/nav/Navbar.vue');
    if (/displayTrackedCount\s*>\s*0"/.test(navbar) && !/isAuthenticated\s*&&\s*displayTrackedCount\s*>\s*0/.test(navbar)) {
        fail('Navbar.vue must only show the tracked-item count badge to authenticated users.');
    }

    const cookie = read('src/components/common/CookieConsent.astro');
    if (!cookie || !/cookie-consent-updated/.test(cookie) || /\b(?:truncate|line-clamp-)/.test(cookie.split('<script')[0])) {
        fail('src/components/common/CookieConsent.astro must exist, dispatch cookie-consent-updated, and never use truncate/line-clamp.');
    }
    if (!/<CookieConsent\s*\/>/.test(read('src/layouts/Layout.astro'))) {
        fail('Layout.astro must mount <CookieConsent />.');
    }

    const identify = read('src/pages/api/identify-item.ts');
    if (!/isGuestRequest\(/.test(identify) || !/consumeGuestScan\(/.test(identify)) {
        fail('src/pages/api/identify-item.ts must enforce the guest preview limiter (isGuestRequest + consumeGuestScan).');
    }
}

// 14. DASHBOARD: role layouts, widget audiences, public /demo and the demo-sync guard
{
    const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');
    const fail = (msg) => { console.error(`❌ [Dashboard] ${msg}`); hasErrors = true; };

    // 14A. Every widget is in a layout and declares an audience
    const widgetsSrc = read('src/lib/dashboardWidgets.ts');
    const widgetIds = [...widgetsSrc.matchAll(/\{\s*id:\s*'([a-z_]+)',\s*title:/g)].map((m) => m[1]);
    const layoutBlock = (widgetsSrc.split('export const ROLE_LAYOUTS')[1] || '').split('};')[0];
    for (const id of widgetIds) {
        if (!layoutBlock.includes(`'${id}'`)) fail(`Widget "${id}" in dashboardWidgets.ts is not used by any ROLE_LAYOUTS entry.`);
    }
    if ((widgetsSrc.match(/audience:\s*'/g) || []).length < widgetIds.length) {
        fail('Every widget in DASHBOARD_WIDGETS must declare an audience.');
    }
    for (const collective of ['financials', 'radar', 'labor_week']) {
        const row = widgetsSrc.split('\n').find((l) => l.includes(`id: '${collective}'`)) || '';
        if (!row.includes("'voting_members'")) fail(`Widget "${collective}" shows collective data and must use the 'voting_members' audience.`);
    }
    const consignorLayout = (layoutBlock.match(/consignor:\s*\[([^\]]*)\]/) || [])[1] || '';
    for (const banned of ['financials', 'radar', 'tax_tips', 'labor_week', 'admin_tools', 'ai_usage']) {
        if (consignorLayout.includes(`'${banned}'`)) fail(`The consignor layout must not include "${banned}" (consignors only see their own statement).`);
    }

    // 14B. Demo sample data must cover every alert type, or the demo drifts from the real dashboard
    const alertsSrc = read('src/lib/dashboardAlerts.ts');
    const alertIds = [...alertsSrc.matchAll(/^\s*id:\s*'([a-z_0-9]+)',\s*category:/gm)].map((m) => m[1]);
    const coverageBlock = (read('src/lib/demoDashboardData.ts').split('DEMO_ALERT_COVERAGE')[1] || '').split('};')[0];
    for (const id of alertIds) {
        if (!new RegExp(`\\b${id}:`).test(coverageBlock)) {
            fail(`Alert type "${id}" has no entry in DEMO_ALERT_COVERAGE (add sample records in demoDashboardData.ts, then list it).`);
        }
    }

    // 14C. Public demo exists and is reachable
    if (!/'\/demo'/.test(read('src/lib/publicRoutes.ts'))) fail("'/demo' must be in the public allowlist (src/lib/publicRoutes.ts).");
    if (!fs.existsSync('src/pages/demo.astro')) fail('src/pages/demo.astro is missing.');

    // 14D. The public demo must never touch the database: demo-safe files may not import data/auth modules
    const FORBIDDEN = /(lib\/appwrite|lib\/auth|useAuth|useInventory|usePurchases|coopGovernance|coopExpenses|lib\/manifests)['"]?$/;
    const demoSafe = [
        ...fs.readdirSync('src/components/dashboard').filter((f) => f.endsWith('.vue') && f !== 'AiUsageCard.vue').map((f) => `src/components/dashboard/${f}`),
        ...(fs.existsSync('src/components/dashboard/trays')
            ? fs.readdirSync('src/components/dashboard/trays').filter((f) => f.endsWith('.vue')).map((f) => `src/components/dashboard/trays/${f}`)
            : []),
        ...fs.readdirSync('src/composables/dashboard').filter((f) => f !== 'useLiveDashboardSource.ts').map((f) => `src/composables/dashboard/${f}`),
        'src/lib/dashboardAlerts.ts', 'src/lib/dashboardWidgets.ts', 'src/lib/demoDashboardData.ts',
        'src/lib/dashboardTypes.ts', 'src/lib/memberHats.ts', 'src/pages/demo.astro',
    ];
    for (const file of demoSafe) {
        const src = read(file);
        for (const m of src.matchAll(/import\s+(type\s+)?[\s\S]*?\sfrom\s+['"]([^'"]+)['"]/g)) {
            if (!m[1] && FORBIDDEN.test(m[2])) {
                fail(`${file} imports "${m[2]}". Dashboard widgets and the public demo must read data only through useDashboardSource().`);
            }
        }
        if (file.endsWith('.vue') && /\b(truncate|line-clamp-)/.test(src.split('<script')[0])) {
            fail(`${file} uses truncate/line-clamp. Dashboard text must wrap fully.`);
        }
    }
}

// 15. COLLECTIVE VOICE & PLAIN-ENGLISH UI GUARD: zero infrastructure/vendor jargon in member-readable templates & sinks
{
    const fail = (msg) => { console.error(`❌ [Plain-English UI §15] ${msg}`); hasErrors = true; };
    const INFRA_JARGON_RE =
        /\b(?:Appwrite|Vercel|Supabase|resale_db|coop_ledger|coop_proposals|localStorage|JWT)\b|\bAstro\s+(?:\d|Server|SSR)|\bDaisyUI\b|\bTailwind\b/;

    const stripVendorOkMarkup = (markup) =>
        markup
            .replace(/<([a-zA-Z0-9-]+)\b[^>]*\bdata-vendor-ok\b[^>]*>[\s\S]*?<\/\1>/g, '')
            .replace(/<[^>]*\bdata-vendor-ok\b[^>]*>/g, '');

    // Pass 1: Templates & HTML Markup (.vue <template> and .astro body)
    const markupFiles = getFiles('src', ['.vue', '.astro']);
    for (const fullPath of markupFiles) {
        const rel = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
        if (/FounderVault|AiStudio/i.test(rel)) continue;
        const raw = fs.readFileSync(fullPath, 'utf8');

        let tpl = '';
        if (rel.endsWith('.vue')) {
            tpl = raw.split('<script')[0] || '';
        } else {
            tpl = raw
                .replace(/^---[\s\S]*?---/, '')
                .replace(/<script\b[\s\S]*?<\/script>/gi, '')
                .replace(/<style\b[\s\S]*?<\/style>/gi, '');
        }
        tpl = stripVendorOkMarkup(tpl.replace(/<!--[\s\S]*?-->/g, ''));

        const lines = tpl.split('\n');
        lines.forEach((line, idx) => {
            const m = INFRA_JARGON_RE.exec(line);
            if (m) {
                fail(`${rel} (template line ~${idx + 1}): exposes developer/vendor term "${m[0]}" in user-facing markup ("${line.trim().slice(0, 110)}"). Use Collective plain English or mark legitimate SaaS vendor bill examples with data-vendor-ok.`);
            }
        });
    }

    // Pass 2: Script-side user-facing sinks (toasts, loader steps, error responses, titles/hints)
    const SINK_TRIGGER_RE =
        /\b(?:addToast|confirmDialog|showLoader|CoopHttpError)\s*\(|\b(?:message|step|subtitle|hint)\s*:|\b(?:errorMsg|loadError|errorMessage)\.value\s*=|\bnew\s+Error\s*\(|\bjson\s*\(\s*\{\s*error\b|\{\s*error\s*:/;
    const LITERAL_EXTRACT_RE = /'([^'\\\n]*(?:\\.[^'\\\n]*)*)'|"([^"\\\n]*(?:\\.[^"\\\n]*)*)"|`([^`\\]*(?:\\.[^`\\]*)*)`/g;
    const scriptRoots = [
        ...getFiles('src/components', ['.vue']),
        ...getFiles('src/composables', ['.ts']),
        ...getFiles('src/lib', ['.ts']),
        ...getFiles('src/pages/api', ['.ts']),
    ];

    for (const fullPath of scriptRoots) {
        const rel = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
        if (
            rel === 'src/lib/generatedSkillBundles.ts' ||
            rel === 'src/lib/devAiRouting.ts' ||
            rel === 'src/lib/founderVault.ts' ||
            rel === 'src/lib/userFacingErrors.ts' ||
            /FounderVault|AiStudio/i.test(rel)
        ) {
            continue;
        }
        const raw = fs.readFileSync(fullPath, 'utf8');
        const scriptPart = rel.endsWith('.vue') ? (raw.split(/<script\b[^>]*>/i)[1] || '') : raw;
        const lines = scriptPart.split('\n');
        lines.forEach((line, idx) => {
            const trimmed = line.trim();
            if (
                !trimmed ||
                trimmed.startsWith('//') ||
                trimmed.startsWith('*') ||
                trimmed.startsWith('/*') ||
                trimmed.startsWith('import ') ||
                /\bconsole\.(?:log|warn|error|info|debug)\b/.test(line) ||
                line.includes('rc-vendor-ok')
            ) {
                return;
            }
            if (!SINK_TRIGGER_RE.test(line)) return;

            let lm;
            LITERAL_EXTRACT_RE.lastIndex = 0;
            while ((lm = LITERAL_EXTRACT_RE.exec(line)) !== null) {
                const rawLit = lm[1] ?? lm[2] ?? lm[3] ?? '';
                const withoutInterps = rawLit.replace(/\$\{[^}]*\}/g, '');
                const hit = INFRA_JARGON_RE.exec(withoutInterps);
                if (hit) {
                    fail(`${rel} (script line ~${idx + 1}): user-facing string exposes developer/vendor term "${hit[0]}" ("${withoutInterps.trim().slice(0, 110)}"). Use plain Collective language or toUserMessage().`);
                }
            }
        });
    }
}

// 16. ZERO OVERLAPPING RIGHT-EDGE DRAWERS GUARD (laws-of-ux §3 Bucket 2 / ux-design-system-taxonomy Red Flag #9)
{
    const fail = (msg) => { console.error(`❌ [Overlay Hierarchy §16] ${msg}`); hasErrors = true; };

    if (fs.existsSync('src/components/inventory/OnlineCoCurationDrawer.vue')) {
        fail('src/components/inventory/OnlineCoCurationDrawer.vue must be removed — render Online Bin & Co-Curation inline via src/components/common/drawer/ItemOnlineTab.vue inside ItemDrawer.vue.');
    }

    const itemDrawerSrc = fs.existsSync('src/components/common/ItemDrawer.vue')
        ? fs.readFileSync('src/components/common/ItemDrawer.vue', 'utf8')
        : '';
    if (/<(?:SlideOverDrawer|OnlineCoCurationDrawer)\b/.test(itemDrawerSrc)) {
        fail('src/components/common/ItemDrawer.vue must NEVER mount a nested right-edge <SlideOverDrawer> on top of itself — use an inline lazy v-if tab instead.');
    }

    for (const fullPath of getFiles('src', ['.vue'])) {
        const rel = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
        const tpl = (fs.readFileSync(fullPath, 'utf8').split('<script')[0] || '').replace(/<!--[\s\S]*?-->/g, '');
        if (/<SlideOverDrawer\b[^>]*\b(?:z-class|zClass)\s*=/.test(tpl)) {
            fail(`${rel}: <SlideOverDrawer> must not pass z-class/zClass stacking overrides — enforce single active right-edge drawer mutual exclusivity.`);
        }
        let drawerDepth = 0;
        for (const tok of tpl.matchAll(/<\/?SlideOverDrawer\b[^>]*>/g)) {
            const tag = tok[0];
            if (tag.startsWith('</')) {
                drawerDepth = Math.max(0, drawerDepth - 1);
            } else if (!/\/>\s*$/.test(tag)) {
                if (drawerDepth > 0) {
                    fail(`${rel}: Nested <SlideOverDrawer> inside another <SlideOverDrawer> is forbidden.`);
                    break;
                }
                drawerDepth += 1;
            }
        }
    }
}

// 17. GLOBAL HEADER & MOBILE DRAWER NAVIGATION BUDGET GUARD (Miller's Law <= 5 pillars, Choice Overload <= 7 items/dropdown)
{
    const fail = (msg) => { console.error(`❌ [Nav Budget §17] ${msg}`); hasErrors = true; };

    const navSrc = fs.existsSync('src/components/nav/Navbar.vue')
        ? fs.readFileSync('src/components/nav/Navbar.vue', 'utf8')
        : '';
    const catalogSrc = fs.existsSync('src/lib/studiosCatalog.ts')
        ? fs.readFileSync('src/lib/studiosCatalog.ts', 'utf8')
        : '';

    if (!catalogSrc) {
        fail('src/lib/studiosCatalog.ts is missing — desktop nav, mobile drawer, and /studios must share one canonical catalog.');
    } else {
        const pillarCapMatch = catalogSrc.match(/export\s+const\s+MAX_NAV_PILLARS\s*=\s*(\d+)/);
        const dropdownCapMatch = catalogSrc.match(/export\s+const\s+MAX_DROPDOWN_ITEMS\s*=\s*(\d+)/);
        if (!pillarCapMatch || Number(pillarCapMatch[1]) > 5) {
            fail('src/lib/studiosCatalog.ts must export MAX_NAV_PILLARS <= 5.');
        }
        if (!dropdownCapMatch || Number(dropdownCapMatch[1]) > 7) {
            fail('src/lib/studiosCatalog.ts must export MAX_DROPDOWN_ITEMS <= 7.');
        }
        const catalogCodeOnly = catalogSrc
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/^\s*\/\/.*$/gm, '');
        if (/\/warehouse\/sync\/MD\b/.test(catalogCodeOnly)) {
            fail('src/lib/studiosCatalog.ts must NOT hardcode /warehouse/sync/MD (Law 2) — build booth POS sync links dynamically from getSellingBoothMetas().');
        }
        const pillarsReturnBlock = catalogCodeOnly.split('const pillars: NavPillarConfig[] = [')[1] || '';
        const definedPillars = (pillarsReturnBlock.match(/\bid:\s*['"][a-z_]+['"]/g) || []).length;
        if (definedPillars === 0 || definedPillars > 5) {
            fail(`src/lib/studiosCatalog.ts defines ${definedPillars} top-level nav pillars (must be 1..5).`);
        }
        if (!/pillars\.slice\(\s*0\s*,\s*MAX_NAV_PILLARS\s*\)/.test(catalogCodeOnly) || !/\.slice\(\s*0\s*,\s*MAX_DROPDOWN_ITEMS\s*\)/.test(catalogCodeOnly)) {
            fail('src/lib/studiosCatalog.ts must enforce .slice(0, MAX_NAV_PILLARS) and .slice(0, MAX_DROPDOWN_ITEMS).');
        }
    }

    if (navSrc) {
        const navTpl = (navSrc.split('<script')[0] || '').replace(/<!--[\s\S]*?-->/g, '');
        if (!/\bbuildResellerNavConfig\b/.test(navSrc)) {
            fail('Navbar.vue must consume buildResellerNavConfig() from src/lib/studiosCatalog.ts for desktop & mobile parity.');
        }
        if (!/\bdata-rc-nav-center\b/.test(navTpl) || !/\bdata-rc-toolbelt\b/.test(navTpl) || !/\bdata-rc-mobile-drawer\b/.test(navTpl)) {
            fail('Navbar.vue must mark desktop center nav (data-rc-nav-center), right toolbelt (data-rc-toolbelt), and mobile drawer (data-rc-mobile-drawer).');
        }
        const centerSlice = ((navTpl.split('data-rc-nav-center')[1] || '').split('data-rc-toolbelt')[0] || '');
        const hardcodedAnchorCount = (centerSlice.match(/<a\b[^>]*?(?<!:)\bhref="/g) || []).length;
        if (hardcodedAnchorCount > 0) {
            fail(`Navbar.vue desktop center contains ${hardcodedAnchorCount} hardcoded <a href="..."> element(s) — drive all center pillars from resellerPillars loop.`);
        }
        const desktopOnlySlice = navTpl.split('data-rc-mobile-drawer')[0] || '';
        const settingsLinksInDesktop = (desktopOnlySlice.match(/href="\/settings"/g) || []).length;
        if (settingsLinksInDesktop > 1) {
            fail(`Navbar.vue renders ${settingsLinksInDesktop} duplicate /settings links on desktop — keep a single unified Workspace & Settings menu.`);
        }
        if (!/direct\.slice\(\s*0\s*,\s*MAX_DROPDOWN_ITEMS\s*\)/.test(navSrc)) {
            fail('Navbar.vue mobilePrimaryLinks must enforce .slice(0, MAX_DROPDOWN_ITEMS) so mobile groups stay bounded.');
        }
    }
}

// 18. WAVE 1 (P0) ROLE ISOLATION, NATIVE BROWSER DIALOG BAN & ITEMTHUMBNAIL FALLBACK GUARD
{
    const fail = (msg) => { console.error(`❌ [Wave 1 P0 Guard §18] ${msg}`); hasErrors = true; };
    const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');

    // 18A. CollectiveAccessGate mounted across Collective-only surfaces
    for (const gatedView of [
        'src/components/coop/CoopLaborView.vue',
        'src/components/coop/CoopGovernanceView.vue',
        'src/components/coop/FounderVaultView.vue',
        'src/components/settings/SettingsManager.vue',
        'src/components/social/SocialCrossPostView.vue',
        'src/components/sales/SalesList.vue',
    ]) {
        const src = read(gatedView);
        if (!/<CollectiveAccessGate\b/.test(src)) {
            fail(`${gatedView} must wrap its view inside <CollectiveAccessGate> so Straight Consignors (BB-) never see Collective rosters, labor, or settings.`);
        }
    }

    // 18B. Steward-only Voting As selector in CoopGovernanceView.vue & Sweat-only unblock in SalesList.vue + session.ts
    const govSrc = read('src/components/coop/CoopGovernanceView.vue');
    if (!/<select[\s\S]{0,120}v-if="isStewardOrFounder"[\s\S]{0,120}v-model="activeVotingMember"/.test(govSrc)) {
        fail('CoopGovernanceView.vue must lock the <select v-model="activeVotingMember"> selector behind v-if="isStewardOrFounder".');
    }
    const salesSrc = read('src/components/sales/SalesList.vue');
    if (!/Monthly Settlements/.test(salesSrc) || !/canAccessSalesSurface/.test(salesSrc)) {
        fail('SalesList.vue must unblock $0-inventory Voting Collective members on /coop/settlements (canAccessSalesSurface) and render an honest "Monthly Settlements" <h1>.');
    }
    const bmlSessionSrc = read('src/pages/api/bml/session.ts');
    if (/capabilitiesForRole\(\s*['"]restricted['"]\s*,\s*['"]BB-['"]\s*\)/.test(bmlSessionSrc)) {
        fail("src/pages/api/bml/session.ts must NOT hardcode capabilitiesForRole('restricted', 'BB-') on 403 (overwrites Sweat-only Collective partners with Consignor capabilities).");
    }

    // 18C. Zero native browser confirm() / alert() / prompt() in Wave 1 P0 audited surfaces
    const NATIVE_DIALOG_RE = /(?<![\w.$])(?:window\.)?(?:confirm|alert|prompt)\s*\(/;
    const wave1DialogCheckedFiles = [
        'src/components/warehouses/LocationDetailView.vue',
        'src/components/coop/FounderVaultView.vue',
        'src/components/coop/CoopLaborView.vue',
        'src/components/coop/CoopGovernanceView.vue',
        'src/components/settings/SettingsManager.vue',
        'src/components/org/OrgSettingsView.vue',
        'src/components/cart/CartView.vue',
        'src/components/social/SocialCrossPostView.vue',
        'src/components/sales/SalesList.vue',
        'src/components/studios/AppraisalPricingLabView.vue',
    ];
    for (const rel of wave1DialogCheckedFiles) {
        const fullPath = path.resolve(rel);
        if (!fs.existsSync(fullPath)) continue;
        const raw = fs.readFileSync(fullPath, 'utf8');
        const scriptPart = raw.split(/<script\b[^>]*>/i)[1] || '';
        const codeLines = scriptPart.split('\n');
        codeLines.forEach((line, idx) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
            // Strip string literals before matching so help text mentioning "alert()" doesn't false-positive
            const withoutStrings = line
                .replace(/'(?:\\.|[^'\\])*'/g, "''")
                .replace(/"(?:\\.|[^"\\])*"/g, '""')
                .replace(/`(?:\\.|[^`\\])*`/g, '``');
            const m = NATIVE_DIALOG_RE.exec(withoutStrings);
            if (m) {
                fail(`${rel} (script line ~${idx + 1}): uses native browser dialog "${m[0].trim()}" — use askConfirm() / confirmDialog() or <SlideOverDrawer> instead.`);
            }
        });
    }

    // 18D. ItemThumbnail 2-stage /preview -> /view + galleryImageIds fallback & /scan 302 redirect
    const thumbSrc = read('src/components/common/ItemThumbnail.vue');
    if (!/preview:\s*false/.test(thumbSrc) || !/galleryImageIds/.test(thumbSrc) || !/useRawView/.test(thumbSrc)) {
        fail('src/components/common/ItemThumbnail.vue must implement 2-stage /preview -> /view (preview: false) + galleryImageIds @error fallback (System Invariant #3).');
    }
    const scanSrc = read('src/pages/scan.astro');
    if (!/Astro\.redirect\(\s*['"]\/scout['"]/.test(scanSrc)) {
        fail("src/pages/scan.astro must 302-redirect to '/scout'.");
    }
    const storeCartSrc = read('src/components/store/StoreHeaderCart.astro');
    if (/href=["']\/cart["']/.test(storeCartSrc) || /Tenant:\s*\{tenantId\}/.test(storeCartSrc)) {
        fail('src/components/store/StoreHeaderCart.astro must not leak public shoppers to internal /cart or expose raw Tenant: {tenantId}.');
    }
}

if (!hasErrors) {
    console.log(`✅ Clean lint! All ${vueFiles.length} Vue SFCs, ${tsFiles.length} TS files, TDZ declaration order, scripts/ allowlist, Zero Hardcoded Locations, access-control guards, and price-parsing invariants passed with ZERO errors!`);
} else {
    process.exit(1);
}

