import fs from 'fs';
import path from 'path';
import { type UIIntent } from '../validation/schemas';
import { type FileManifestItem } from './chunkGenerator';

const MEMORY_FILE_PATH = path.join(process.cwd(), 'data', 'history.json');

export interface MemoryEntry {
  id: string;
  timestamp: string;
  componentType: string;
  componentName: string;
  intent: UIIntent;
  code: string | Record<string, string>;
  manifest?: FileManifestItem[];
  a11yScore: number;
  parentId?: string;
}

// Ensure data directory exists
function ensureMemoryFile() {
  const dir = path.dirname(MEMORY_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(MEMORY_FILE_PATH)) {
    fs.writeFileSync(MEMORY_FILE_PATH, JSON.stringify([]));
  }
}

export function saveGeneration(
  intent: UIIntent, 
  code: string | Record<string, string>, 
  a11yScore: number,
  manifest?: FileManifestItem[],
  parentId?: string
): void {
  try {
    ensureMemoryFile();
    const data = fs.readFileSync(MEMORY_FILE_PATH, 'utf-8');
    const history: MemoryEntry[] = JSON.parse(data);

    // Create new entry
    const entry: MemoryEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      componentType: intent.componentType.toLowerCase(),
      componentName: intent.componentName,
      intent,
      code,
      manifest,
      a11yScore,
      parentId,
    };

    // Keep the last 500 successful generations — disk reads are trivial at this size
    const updatedHistory = [entry, ...history].slice(0, 500);

    fs.writeFileSync(MEMORY_FILE_PATH, JSON.stringify(updatedHistory, null, 2));
  } catch (error) {
    console.error('Failed to save memory:', error);
  }
}

export function getProjectById(id: string): MemoryEntry | null {
  try {
    ensureMemoryFile();
    const data = fs.readFileSync(MEMORY_FILE_PATH, 'utf-8');
    const history: MemoryEntry[] = JSON.parse(data);
    return history.find((entry) => entry.id === id) || null;
  } catch (error) {
    console.error(`Failed to find project with ID ${id}:`, error);
    return null;
  }
}

export function getRelevantExamples(intent: UIIntent): MemoryEntry[] {
  try {
    ensureMemoryFile();
    const data = fs.readFileSync(MEMORY_FILE_PATH, 'utf-8');
    const history: MemoryEntry[] = JSON.parse(data);

    if (history.length === 0) return [];

    // Filter by same component type, and only those with high a11y scores
    const relevant = history.filter(
      (entry) =>
        entry.a11yScore === 100 &&
        (entry.componentType === intent.componentType.toLowerCase() ||
          entry.componentName.includes(intent.componentName) ||
          intent.description.toLowerCase().includes(entry.componentType))
    );

    // Return the top 2 most recent relevant examples
    return relevant.slice(0, 2);
  } catch (error) {
    console.error('Failed to read memory:', error);
    return [];
  }
}
