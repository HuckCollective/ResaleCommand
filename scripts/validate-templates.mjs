import fs from 'fs';
import path from 'path';
import { parse, compileTemplate } from 'vue/compiler-sfc';

function getVueFiles(dir, files = []) {
    for (const item of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, item);
        if (fs.statSync(fullPath).isDirectory()) {
            if (item !== 'node_modules' && item !== '.astro' && item !== 'dist') {
                getVueFiles(fullPath, files);
            }
        } else if (item.endsWith('.vue')) {
            files.push(fullPath);
        }
    }
    return files;
}

const vueFiles = getVueFiles('src');
let hasErrors = false;

for (const file of vueFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const { descriptor, errors: sfcErrors } = parse(content, { filename: file });

    if (sfcErrors && sfcErrors.length > 0) {
        console.error(`❌ SFC Parse Error in ${file}:`);
        sfcErrors.forEach(e => console.error('  ', e.message));
        hasErrors = true;
        continue;
    }

    if (descriptor.template) {
        const result = compileTemplate({
            id: file,
            filename: file,
            source: descriptor.template.content,
            compilerOptions: { mode: 'module' }
        });

        if (result.errors && result.errors.length > 0) {
            console.error(`❌ Template Compilation Error in ${file}:`);
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
}

if (!hasErrors) {
    console.log(`✅ All ${vueFiles.length} Vue templates compiled with ZERO tag/syntax errors!`);
} else {
    process.exit(1);
}
