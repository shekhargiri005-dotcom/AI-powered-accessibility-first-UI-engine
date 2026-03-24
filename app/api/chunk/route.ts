import { NextRequest, NextResponse } from 'next/server';
import { generateFileChunk } from '@/lib/ai/chunkGenerator';

export async function POST(request: NextRequest) {
  try {
    const { intent, manifest, targetFile, model, maxTokens } = await request.json();
    
    if (!intent || !manifest || !targetFile || !model) {
      return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 });
    }

    const code = await generateFileChunk(intent, manifest, targetFile, model, maxTokens);
    return NextResponse.json({ success: true, code });
  } catch (error) {
    console.error('[/api/chunk] Error:', error);
    return NextResponse.json({ success: false, error: 'Chunk generation failed' }, { status: 500 });
  }
}
