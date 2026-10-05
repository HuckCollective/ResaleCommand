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
            compileScript(descriptor, { id: file, inlineTemplate: false });
        } catch (scriptErr) {
            console.error(`❌ Script Error in ${relativePath}:`, scriptErr.message);
            hasErrors = true;
        }
    }
}

// 2. VALIDATE TYPESCRIPT & JAVASCRIPT FILES (Syntax, Missing Variables, Broken Imports)
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

const program = ts.createProgram(tsFiles, compilerOptions);
const diagnostics = ts.getPreEmitDiagnostics(program);

for (const diag of diagnostics) {
    if (!diag.file) continue;
    const relFile = path.relative(process.cwd(), diag.file.fileName).replace(/\\/g, '/');
    if (!relFile.startsWith('src/')) continue;

    const code = diag.code;
    // Critical errors:
    // TS2304: Cannot find name 'x' (catches missing imports like isAlphaMode)
    // TS2552: Cannot find name 'x'. Did you mean 'y'?
    // TS2307: Cannot find module 'x' (catches broken import paths)
    // TS1xxx: Any TypeScript/JavaScript syntax error
    const isCritical = (code === 2304 || code === 2552 || code === 2307 || (code >= 1000 && code < 2000));

    if (isCritical) {
        const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
        const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start);
        console.error(`❌ TS Critical Error in ${relFile}:${line + 1}:${character + 1} (TS${code}): ${message}`);
        hasErrors = true;
    }
}

if (!hasErrors) {
    console.log(`✅ Clean lint! All ${vueFiles.length} Vue SFCs and ${tsFiles.length} TS files passed with ZERO syntax, template, or missing identifier errors!`);
} else {
    process.exit(1);
}
