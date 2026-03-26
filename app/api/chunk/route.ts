import { NextRequest, NextResponse } from 'next/server';
import { generateFileChunk } from '@/lib/ai/chunkGenerator';
import { validateBrowserSafeCode } from '@/lib/validation/security';

export async function POST(request: NextRequest) {
  try {
    const { intent, manifest, targetFile, model, maxTokens, isMultiSlide } = await request.json();
    
    if (!intent || !manifest || !targetFile || !model) {
      return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 });
    }

    const code = await generateFileChunk(intent, manifest, targetFile, model, maxTokens, isMultiSlide);

    // Validate chunk is browser-safe for component/screen files
    const isEntryFile = /index|main|app/i.test(targetFile);
    const safetyCheck = validateBrowserSafeCode(code);
    if (!safetyCheck.isValid && !isEntryFile) {
      console.warn(`[/api/chunk] Browser safety warning for ${targetFile}:`, safetyCheck.issues);
    }

    return NextResponse.json({ success: true, code, safetyWarnings: safetyCheck.issues.length ? safetyCheck.issues : undefined });
  } catch (error) {
    console.error('[/api/chunk] Error:', error);
    return NextResponse.json({ success: false, error: 'Chunk generation failed' }, { status: 500 });
  }
}
