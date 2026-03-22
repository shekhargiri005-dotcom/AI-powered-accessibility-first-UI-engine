import fs from 'fs';
import path from 'path';
import { type UIIntent } from '../validation/schemas';

const MEMORY_FILE_PATH = path.join(process.cwd(), 'data', 'history.json');

export interface MemoryEntry {
  id: string;
  timestamp: string;
  componentType: string;
  componentName: string;
  intent: UIIntent;
  code: string;
  a11yScore: number;
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

export function saveGeneration(intent: UIIntent, code: string, a11yScore: number): void {
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
      a11yScore,
    };

    // Keep the last 500 successful generations — disk reads are trivial at this size
    const updatedHistory = [entry, ...history].slice(0, 500);

    fs.writeFileSync(MEMORY_FILE_PATH, JSON.stringify(updatedHistory, null, 2));
  } catch (error) {
    console.error('Failed to save memory:', error);
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
