import { readFileSync } from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { upsertComponentEmbedding } from '../lib/ai/vectorStore';

dotenv.config();

/**
 * Script to ingest the @ui/* ecosystem directly into pgvector via OpenAI.
 * Reads the compiled UI ecosystem JSON so it has accurate Sandpack-ready code.
 */
async function run() {
  console.log('🚀 Starting UI Ecosystem Knowledge Ingestion...');
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY is missing from .env');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is missing from .env');
    process.exit(1);
  }

  // Read the JSON manually to avoid TS import assertion limits
  const ecosystemRaw = readFileSync(path.join(process.cwd(), 'lib/sandbox/ui-ecosystem.json'), 'utf-8');
  const uiCheatSheet = JSON.parse(ecosystemRaw);
  const entries = Object.entries(uiCheatSheet) as [string, string][];
  console.log(`Found ${entries.length} UI files to analyze...`);

  let count = 0;
  for (const [filepath, code] of entries) {
    // We only care about components index or actual component files in '@ui/'
    if (!filepath.endsWith('.tsx') && !filepath.endsWith('.ts')) continue;
    
    // Example filepath: '/packages/core/components/Button.tsx'
    const name = path.basename(filepath, path.extname(filepath));
    
    const exportMatches = Array.from(code.matchAll(/export\s+(?:function|const|class)\s+([A-Z][a-zA-Z0-9_]+)/g));
    const namedExports = exportMatches.map(m => m[1]);
    
    if (namedExports.length === 0 && name !== 'index') {
       // Skip utility files without UI exports
       continue;
    }

    const rawKeywords = [name, ...namedExports, 'ui', 'component', filepath.split('/')[2]];
    const keywords = Array.from(new Set(rawKeywords.filter(Boolean)));
    const knowledgeId = `registry:${filepath.replace('/packages/', '')}`;

    // The guidelines ARE the raw code, enabling the AI to perfectly mimic the architecture.
    // If the file is huge, slice to 1500 chars to avoid blowing up embedding token limits, 
    // though text-embedding-3-small handles 8191 tokens natively.
    const guidelines = `Component Path: ${filepath}\nExports: ${namedExports.join(', ')}\n\nImplementation:\n\`\`\`tsx\n${code}\n\`\`\``;

    console.log(`⏳ Embedding [${name}] -> ${knowledgeId}...`);
    
    const success = await upsertComponentEmbedding({
      knowledgeId,
      name: name === 'index' ? filepath.split('/')[2] : name, // e.g. 'core' or 'Button'
      keywords,
      guidelines,
      source: 'registry'
    });

    if (success) {
      count++;
      console.log(`   ✅ Success`);
    } else {
      console.warn(`   ⚠️ Failed for ${knowledgeId}`);
    }
    
    // Pause briefly to respect rate limits
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`🎉 Ingestion complete! Upserted ${count} components into the 'registry' vector store.`);
  process.exit(0);
}

run().catch(console.error);
