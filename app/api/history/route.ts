import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const MEMORY_FILE_PATH = path.join(process.cwd(), 'data', 'history.json');
    if (!fs.existsSync(MEMORY_FILE_PATH)) {
      return NextResponse.json({ history: [] });
    }
    
    const data = fs.readFileSync(MEMORY_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    
    // We don't want to send the entire raw code blocks over the wire just for a history list,
    // so we map it out to lightweight summary chips
    const summarizedHistory = parsed.map((entry: any) => ({
      id: entry.id,
      timestamp: entry.timestamp,
      componentName: entry.componentName,
      promptSnippet: entry.intent.description.length > 60 
        ? entry.intent.description.substring(0, 60) + '...' 
        : entry.intent.description
    }));

    return NextResponse.json({ history: summarizedHistory });
  } catch (error) {
    console.error('Failed to parse history JSON:', error);
    return NextResponse.json({ history: [] });
  }
}
