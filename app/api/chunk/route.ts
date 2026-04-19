import { NextRequest, NextResponse } from 'next/server';
import { generateFileChunk } from '@/lib/ai/chunkGenerator';
import { validateBrowserSafeCode, sanitizeGeneratedCode } from '@/lib/validation/security';
import { logger } from '@/lib/logger';
import { auth } from '@/lib/auth';
import type { ProviderName } from '@/lib/ai/types';

export async function POST(request: NextRequest) {
  const reqLogger = logger.createRequestLogger('/api/chunk');
  reqLogger.info('Received chunk generation request');

  try {
    // SECURITY: Only accept providerId and modelId from client - NEVER apiKey or baseUrl
    const { intent, manifest, targetFile, model, maxTokens, isMultiSlide, provider } = await request.json();

    if (!intent || !manifest || !targetFile || !model) {
      reqLogger.warn('Missing required parameters', { targetFile, model });
      return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 });
    }

    // Get workspace context from session and headers
    const session = await auth();
    const userId = session?.user?.id;
    const workspaceId = request.headers.get('x-workspace-id') || 'default';
    
    // Validate provider
    const providerId = (provider || 'openai') as ProviderName;

    reqLogger.info('Starting chunk generation', { 
      targetFile, 
      model, 
      provider: providerId, 
      workspaceId,
      hasUser: !!userId 
    });
    
    let code = await generateFileChunk(
      intent, 
      manifest, 
      targetFile, 
      model, 
      maxTokens, 
      isMultiSlide, 
      providerId,
      workspaceId,
      userId
    );

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
    const msg = error instanceof Error ? error.message : String(error);
    reqLogger.error('Chunk generation failed', error, {
      errorMessage: msg,
      isOpenAIError: msg.includes('status code'),
    });
    
    // Check for configuration errors and return appropriate status
    if (msg.includes('API key required') || msg.includes('No API key configured')) {
      return NextResponse.json({ 
        success: false, 
        error: 'AI provider not configured. Please configure your API key in settings.' 
      }, { status: 403 });
    }
    
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
