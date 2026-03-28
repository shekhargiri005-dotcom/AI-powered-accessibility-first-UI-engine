import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.join(__dirname, '..');
const PACKAGES_DIR = path.join(ROOT_DIR, 'packages');
const OUTPUT_FILE = path.join(ROOT_DIR, 'lib', 'sandbox', 'ui-ecosystem.json');

const ecosystemMap = {};

function scanDirectory(dirPath, basePath = '') {
    if (!fs.existsSync(dirPath)) return;
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const relativePath = path.join(basePath, item).replace(/\\/g, '/');
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            scanDirectory(fullPath, relativePath);
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            ecosystemMap[relativePath] = content;
        }
    }
}

console.log('Building UI Ecosystem Map for Sandpack Integration...');

// Read the contents of every file inside /packages
scanDirectory(PACKAGES_DIR);

// Build the final JSON object
// We prefix the keys with '/packages/' so they align with the Sandpack virtual filesystem root
const processedMap = {};
for (const [relPath, content] of Object.entries(ecosystemMap)) {
    processedMap[`/packages/${relPath}`] = content;
}

// Write the compiled JSON to lib/sandbox/ui-ecosystem.json
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(processedMap, null, 2), 'utf-8');

console.log(`Successfully compiled ${Object.keys(processedMap).length} files into ${OUTPUT_FILE}`);
