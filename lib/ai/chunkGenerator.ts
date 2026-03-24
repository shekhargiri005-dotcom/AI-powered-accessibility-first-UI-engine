import OpenAI from 'openai';
import { type UIIntent } from '../validation/schemas';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface FileManifestItem {
  filename: string;
  description: string;
}

function mapModel(req: string): string {
  if (req.includes('nano') || req.includes('mini')) return 'gpt-4o-mini';
  if (req === 'gpt-4.1') return 'gpt-4-turbo';
  if (req.includes('5.4')) return 'gpt-4o';
  return req || 'gpt-4o';
}

export async function generateAppManifest(
  intent: UIIntent,
  model: string,
  isMultiSlide: boolean = false
): Promise<FileManifestItem[]> {
  let prompt = "You are an elite React UI Architect. The user wants to build a massive application.\n" +
"Break this application down into a modular React architecture file manifest.\n" +
"You must return a valid JSON array of objects, where each object has \"filename\" and \"description\".\n" +
"The entry point MUST be named \"App.tsx\".\n" +
"Do NOT include package.json or index.html. Only React components.\n" +
"Include at least 4-6 files for a full application.\n\n" +
"USER INTENT:\n" +
JSON.stringify(intent, null, 2);

  if (isMultiSlide) {
    prompt += "\n\nCRITICAL MULTI-SLIDE ARCHITECTURE REQUIREMENT: The user requested a MULTI-SLIDE / PAGINATED experience. Ensure your manifest implies a router or slide orchestrator component (usually App.tsx) that manages navigation between distinct feature screens/views.";
  }

  const response = await openai.chat.completions.create({
    model: mapModel(model),
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    response_format: { type: 'json_object' }, 
  });

  const raw = response.choices[0]?.message?.content || '[]';
  
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.files && Array.isArray(parsed.files)) return parsed.files;
    if (parsed.manifest && Array.isArray(parsed.manifest)) return parsed.manifest;
    return [];
  } catch(e) {
    return [{ filename: 'App.tsx', description: 'Main application entry point' }];
  }
}

export async function generateFileChunk(
  intent: UIIntent,
  manifest: FileManifestItem[],
  targetFile: string,
  model: string,
  maxTokens: number,
  isMultiSlide: boolean = false
): Promise<string> {
  const fileDef = manifest.find((f) => f.filename === targetFile);

  let prompt = "You are an elite React/TypeScript engineer building a massive application.\n" +
"We are chunking the generation. You are currently writing the file: \"" + targetFile + "\".\n\n" +
"FILE DESCRIPTION: " + (fileDef ? fileDef.description : 'Component for the app') + "\n\n" +
"APP MANIFEST (For Context / Imports):\n" +
JSON.stringify(manifest, null, 2) + "\n\n" +
"USER INTENT:\n" +
JSON.stringify(intent, null, 2) + "\n\n" +
"REQUIREMENTS:\n" +
"1. Write ONLY the raw TSX code for \"" + targetFile + "\". No markdown fences, no explanations.\n" +
"2. Use Tailwind CSS exclusively for styling.\n" +
"3. Import other components from \"./[filename]\" relative paths based on the manifest.\n" +
"4. Export default the main component of this file.\n" +
"5. If it is App.tsx, orchestrate the other components.\n" +
"6. Write dense, production-ready code.\n\n";

  if (isMultiSlide) {
    prompt += "CRITICAL MULTI-SLIDE ARCHITECTURE REQUIREMENT:\nThe app must function as a multi-slide or paginated experience. When generating App.tsx or view components, include robust navigation state (Next/Prev buttons, dots). For 3D WebGL scenes, alter the react-three-fiber camera or mesh positions over these slide states.\n\n";
  }

  prompt += "RETURN ONLY THE RAW CODE.";

  const response = await openai.chat.completions.create({
    model: mapModel(model),
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
    max_tokens: maxTokens || 4000,
  });

  let rawContent = response.choices[0]?.message?.content || '';
  rawContent = rawContent.replace(/^```(?:tsx?|jsx?|typescript|javascript)?\n?/gim, '').replace(/```\s*$/gim, '').trim();
  
  return rawContent;
}
