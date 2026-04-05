/**
 * @file chunkGenerator.ts
 * Generates the file manifest and per-file code chunks for Full App Mode.
 *
 * Now uses the unified adapter layer — works with any provider the user
 * has configured (OpenAI, Anthropic, Groq, Ollama, etc.).
 * No hardcoded model names. No silent fallbacks.
 */

import { getWorkspaceAdapter } from './adapters/index';
import type { AdapterConfig }  from './adapters/index';
import { type UIIntent }       from '../validation/schemas';

export interface FileManifestItem {
  filename: string;
  description: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildAdapterConfig(
  model: string,
  provider?: string,
  apiKey?: string,
  baseUrl?: string,
): AdapterConfig {
  return {
    model,
    provider,
    apiKey: apiKey && apiKey !== '••••' ? apiKey : undefined,
    baseUrl,
  };
}

// ─── Manifest Generator ───────────────────────────────────────────────────────

export async function generateAppManifest(
  intent: UIIntent,
  model: string,
  isMultiSlide: boolean = false,
  provider?: string,
  apiKey?: string,
  baseUrl?: string,
): Promise<FileManifestItem[]> {
  const cfg = buildAdapterConfig(model, provider, apiKey, baseUrl);
  const adapter = await getWorkspaceAdapter(cfg);

  let prompt =
    'You are an elite React UI Architect. The user wants to build a massive application.\n' +
    'Break this application down into a modular React architecture file manifest.\n' +
    'You must return a valid JSON array of objects, where each object has "filename" and "description".\n' +
    'The entry point MUST be named "App.tsx".\n' +
    'Do NOT include package.json or index.html. Only React components.\n' +
    'Include at least 4-6 files for a full application.\n\n' +
    'USER INTENT:\n' +
    JSON.stringify(intent, null, 2);

  if (isMultiSlide) {
    prompt +=
      '\n\nCRITICAL MULTI-SLIDE ARCHITECTURE REQUIREMENT: The user requested a MULTI-SLIDE / PAGINATED experience. ' +
      'Ensure your manifest implies a router or slide orchestrator component (usually App.tsx) that manages navigation between distinct feature screens/views.';
  }

  const result = await adapter.generate({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    maxTokens: 2000,
    responseFormat: 'json_object',
  });

  const raw = result.content || '[]';
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed))                                   return parsed;
    if (parsed.files    && Array.isArray(parsed.files))          return parsed.files;
    if (parsed.manifest && Array.isArray(parsed.manifest))       return parsed.manifest;
    return [];
  } catch {
    return [{ filename: 'App.tsx', description: 'Main application entry point' }];
  }
}

// ─── Chunk Generator ──────────────────────────────────────────────────────────

export async function generateFileChunk(
  intent: UIIntent,
  manifest: FileManifestItem[],
  targetFile: string,
  model: string,
  maxTokens: number,
  isMultiSlide: boolean = false,
  provider?: string,
  apiKey?: string,
  baseUrl?: string,
): Promise<string> {
  const cfg     = buildAdapterConfig(model, provider, apiKey, baseUrl);
  const adapter = await getWorkspaceAdapter(cfg);
  const fileDef = manifest.find((f) => f.filename === targetFile);

  let prompt =
    'You are an elite React/TypeScript engineer building a massive application.\n' +
    `We are chunking the generation. You are currently writing the file: "${targetFile}".\n\n` +
    `FILE DESCRIPTION: ${fileDef ? fileDef.description : 'Component for the app'}\n\n` +
    'APP MANIFEST (For Context / Imports):\n' +
    JSON.stringify(manifest, null, 2) + '\n\n' +
    'USER INTENT:\n' +
    JSON.stringify(intent, null, 2) + '\n\n' +
    'REQUIREMENTS:\n' +
    `1. Write ONLY the raw TSX code for "${targetFile}". No markdown fences, no explanations.\n` +
    '2. Use Tailwind CSS exclusively for styling.\n' +
    '3. Import other components from "./[filename]" relative paths. Use DEFAULT IMPORTS: `import ComponentName from \'./ComponentName\';`\n' +
    '4. Export default the main component of this file: `export default function ComponentName() { ... }`.\n' +
    '5. If it is App.tsx, orchestrate the other components.\n' +
    '6. Write dense, production-ready code.\n' +
    '7. CRITICAL: Use `lucide-react` EXCLUSIVELY for icons. Import them individually using destructuring: `import { ... } from \'lucide-react\';`\n' +
    '8. NEVER import from "./utils/", "./hooks/", or other non-existent paths. ' +
    'All custom logic and hooks must be self-contained within this file or imported ONLY from components/files listed in the APP MANIFEST above.\n\n';

  if (isMultiSlide) {
    prompt +=
      'CRITICAL MULTI-SLIDE ARCHITECTURE REQUIREMENT:\n' +
      'The app must function as a multi-slide or paginated experience. When generating App.tsx or view components, ' +
      'include robust navigation state (Next/Prev buttons, dots). ' +
      'For 3D WebGL scenes, alter the react-three-fiber camera or mesh positions over these slide states.\n\n';
  }

  prompt += 'RETURN ONLY THE RAW CODE.';

  const result = await adapter.generate({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
    maxTokens: maxTokens || 4000,
  });

  let rawContent = result.content || '';

  const match = rawContent.match(/```(?:tsx?|jsx?|typescript|javascript)?\s*([\s\S]*?)(?:```|$)/i);
  if (match && match[1]) {
    rawContent = match[1].trim();
  } else {
    rawContent = rawContent
      .replace(/^```(?:tsx?|jsx?|typescript|javascript)?\n?/gim, '')
      .replace(/```\s*$/gim, '')
      .trim();
  }

  return rawContent;
}
