import * as ai from 'ai';
import * as fs from 'fs';
fs.writeFileSync('ai_exports.json', JSON.stringify(Object.keys(ai), null, 2));
