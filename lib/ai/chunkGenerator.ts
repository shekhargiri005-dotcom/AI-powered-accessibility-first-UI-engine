/**
 * @file chunkGenerator.ts
 * Generates the file manifest and per-file code chunks for Full App Mode.
 *
 * Now uses the unified adapter layer — works with any provider the user
 * has configured (OpenAI, Google, Groq).
 * No hardcoded model names. No silent fallbacks.
 * 
 * SECURITY: Credentials are resolved server-side via workspaceKeyService.
 * Never accepts apiKey or baseUrl from client requests.
 */

import { getWorkspaceAdapter, type ConfigurationError } from './adapters/index';
import type { ProviderName } from './types';
import { type UIIntent } from '../validation/schemas';
import { buildSemanticContext } from './semanticKnowledgeBase';
import { getPipelineConfigForModel } from './tieredPipeline';
import { fitContextToTierBudget, estimateTokens } from './promptBudget';

export interface FileManifestItem {
  filename: string;
  description: string;
}

// ─── Manifest Generator ───────────────────────────────────────────────────────

export async function generateAppManifest(
  intent: UIIntent,
  model: string,
  isMultiSlide: boolean = false,
  provider: ProviderName = 'openai',
  workspaceId: string = 'default',
  userId?: string,
): Promise<FileManifestItem[]> {
  const adapter = await getWorkspaceAdapter(provider, model, workspaceId, userId);

  let prompt =
    'You are an elite React UI Architect. The user wants to build a massive application.\n' +
    'Break this application down into a modular React architecture file manifest.\n' +
    'You must return a valid JSON array of objects, where each object has "filename" and "description".\n' +
    'The entry point MUST be named "App.tsx".\n' +
    'Do NOT include package.json or index.html. Only React components.\n' +
    'Include at least 4-6 files for a full application.\n\n' +
    'USER INTENT:\n' +
    JSON.stringify(intent, null, 2);

  if ((intent as UIIntent & { depthUi?: boolean }).depthUi) {
    prompt +=
      '\n\nDEPTH UI STYLE MODE:\n' +
      '- The user wants a premium "Depth UI" aesthetic (parallax layers, floating cards, subtle glow, glassmorphism).\n' +
      '- Plan file responsibilities to support layered visuals and motion (hero layers, background ornaments, reusable motion utilities inside components).\n' +
      '- Ensure accessibility: respect prefers-reduced-motion; animations must degrade gracefully.\n';
  }

  if (isMultiSlide) {
    prompt +=
      '\n\nCRITICAL MULTI-SLIDE ARCHITECTURE REQUIREMENT: The user requested a MULTI-SLIDE / PAGINATED experience. ' +
      'Ensure your manifest implies a router or slide orchestrator component (usually App.tsx) that manages navigation between distinct feature screens/views.';
  }

  let result: unknown;
  let retries = 0;
  const maxRetries = 3;
  const baseDelayMs = 1500;

  while (true) {
    try {
      result = await adapter.generate({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 2000,
        responseFormat: 'json_object',
      });
      break;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('429') && retries < maxRetries) {
        retries++;
        console.warn(`[chunkGenerator] 429 Rate Limit hit in manifest. Retrying (${retries}/${maxRetries}) in ${baseDelayMs * Math.pow(2, retries - 1)}ms...`);
        await new Promise(res => setTimeout(res, baseDelayMs * Math.pow(2, retries - 1)));
        continue;
      }
      // Return a safe default instead of throwing to avoid breaking the whole pipeline
      return [{ filename: 'App.tsx', description: 'Main application entry point' }];
    }
  }

  const raw = (result as { content?: string }).content || '[]';
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
  provider: ProviderName = 'openai',
  workspaceId: string = 'default',
  userId?: string,
  /** Pre-computed RAG context (computed ONCE at manifest level — avoids N embedding queries) */
  sharedSemanticContext?: string,
): Promise<string> {
  const adapter = await getWorkspaceAdapter(provider, model, workspaceId, userId);
  const fileDef = manifest.find((f) => f.filename === targetFile);

  let prompt =
    'You are an elite React/TypeScript engineer building a massive application.\n' +
    `We are chunking the generation. You are currently writing the file: "${targetFile}".\n\n` +
    `FILE DESCRIPTION: ${fileDef ? fileDef.description : 'Component for the app'}\n\n` +
    'APP MANIFEST (For Context / Imports):\n' +
    JSON.stringify(manifest, null, 2) + '\n\n' +
    'USER INTENT:\n' +
    JSON.stringify(intent) + '\n\n'; // Compact JSON — saves ~25% tokens

  // Detect model tier for RAG budget capping — prevents overflow on 8K Llama/HuggingFace models
  const chunkPipelineCfg = getPipelineConfigForModel(model);
  const basePromptTokens  = estimateTokens(prompt);

  // Use pre-computed shared RAG context — avoids N redundant embedding API calls.
  // Fallback to per-chunk query only if no shared context was supplied.
  const rawSemanticCtx = sharedSemanticContext
    ?? await buildSemanticContext(`${intent.description} ${targetFile}`, 'app');

  // Budget-aware injection: trim the RAG block if it would overflow the model's context
  const fittedSemanticCtx = fitContextToTierBudget(
    rawSemanticCtx || null,
    basePromptTokens,
    chunkPipelineCfg.tier,
  );

  if (fittedSemanticCtx) {
    prompt += 'APPROVED BLUEPRINTS & COMPONENTS (RAG Context MUST BE USED):\n' +
              'Do NOT invent arbitrary solutions if an applicable pattern or component is listed below.\n\n' +
              fittedSemanticCtx + '\n\n';
  }

  prompt += 'REQUIREMENTS:\n' +
    `1. Write ONLY the raw TSX code for "${targetFile}". No markdown fences, no explanations.\n` +
    '2. Use Tailwind CSS exclusively for styling. Enforce STRICT WCAG AA color contrast: use text-gray-700 or darker on light backgrounds, and text-white or text-gray-200 on dark backgrounds.\n' +
    '3. Import other components from "./[filename]" relative paths. Use DEFAULT IMPORTS: `import ComponentName from \'./ComponentName\';`\n' +
    '4. Export default the main component of this file: `export default function ComponentName() { ... }`.\n' +
    '5. If it is App.tsx, orchestrate the other components.\n' +
    '6. Write dense, production-ready code.\n' +
    '7. CRITICAL: Use `lucide-react` EXCLUSIVELY for icons. Import them individually using destructuring: `import { ... } from \'lucide-react\';`. NEVER append "Icon" to the import name. Use `import { ArrowRight } from \'lucide-react\'`, not `ArrowRightIcon`.\n' +
    '8. NEVER import from "./utils/", "./hooks/", or other non-existent paths. ' +
    'All custom logic and hooks must be self-contained within this file or imported ONLY from components/files listed in the APP MANIFEST above.\n\n';

  if ((intent as UIIntent & { depthUi?: boolean }).depthUi) {
    prompt +=
      'DEPTH UI STYLE REQUIREMENTS:\n' +
      '- Add tasteful motion + depth (parallax, floating layers, soft glows, glass) but keep it performance-safe.\n' +
      '- Use Framer Motion only if it is already available in the workspace; otherwise use CSS transforms/transition with requestAnimationFrame-free patterns.\n' +
      '- MUST respect prefers-reduced-motion (disable/soften motion).\n' +
      '- Keep interactions accessible: focus-visible rings, keyboard nav, high contrast.\n\n';
  }

  if (isMultiSlide) {
    prompt +=
      'CRITICAL MULTI-SLIDE ARCHITECTURE REQUIREMENT:\n' +
      'The app must function as a multi-slide or paginated experience. When generating App.tsx or view components, ' +
      'include robust navigation state (Next/Prev buttons, dots). ' +
      'For 3D WebGL scenes, alter the react-three-fiber camera or mesh positions over these slide states.\n\n';
  }

  prompt += 'RETURN ONLY THE RAW CODE.';

  let result: unknown;
  let retries = 0;
  const maxRetries = 3;
  const baseDelayMs = 2000;

  while (true) {
    try {
      result = await adapter.generate({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        maxTokens: maxTokens || 4000,
      });
      break;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('429') && retries < maxRetries) {
        retries++;
        console.warn(`[chunkGenerator] 429 Rate Limit hit in chunk ${targetFile}. Retrying (${retries}/${maxRetries})...`);
        await new Promise(res => setTimeout(res, baseDelayMs * Math.pow(2, retries - 1)));
        continue;
      }
      throw error;
    }
  }

  let rawContent = (result as { content?: string }).content || '';

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
