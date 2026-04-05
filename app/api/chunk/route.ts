import { NextRequest, NextResponse } from 'next/server';
import { generateFileChunk } from '@/lib/ai/chunkGenerator';
import { validateBrowserSafeCode, sanitizeGeneratedCode } from '@/lib/validation/security';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const reqLogger = logger.createRequestLogger('/api/chunk');
  reqLogger.info('Received chunk generation request');

  try {
    const { intent, manifest, targetFile, model, maxTokens, isMultiSlide, provider, apiKey, baseUrl } = await request.json();
    const effectiveApiKey = apiKey && apiKey !== '••••' ? apiKey : undefined;

    if (!intent || !manifest || !targetFile || !model) {
      reqLogger.warn('Missing required parameters', { targetFile, model });
      return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 });
    }

    reqLogger.debug('Generating file chunk', { targetFile, model, maxTokens, provider });
    let code = await generateFileChunk(intent, manifest, targetFile, model, maxTokens, isMultiSlide, provider, effectiveApiKey, baseUrl);

    // Sanitize chunk for Babel compatibility
    code = sanitizeGeneratedCode(code);

    // Validate chunk is browser-safe for component/screen files
    const isEntryFile = /index|main|app/i.test(targetFile);
    const safetyCheck = validateBrowserSafeCode(code);
    if (!safetyCheck.isValid && !isEntryFile) {
      reqLogger.warn(`Browser safety warning for ${targetFile}`, { issues: safetyCheck.issues });
    }

    reqLogger.info('Chunk generated successfully', { targetFile, codeLength: code.length });
    reqLogger.end('Request completed successfully');

    return NextResponse.json({ success: true, code, safetyWarnings: safetyCheck.issues.length ? safetyCheck.issues : undefined });
  } catch (error) {
    reqLogger.error('Chunk generation failed', error);
    return NextResponse.json({ success: false, error: 'Chunk generation failed' }, { status: 500 });
  }
}
