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

if (!hasErrors) {
    console.log(`✅ Clean lint! All ${vueFiles.length} Vue SFCs, ${tsFiles.length} TS files, TDZ declaration order, scripts/ allowlist, Zero Hardcoded Locations, and price-parsing invariants passed with ZERO errors!`);
} else {
    process.exit(1);
}

