import { NextRequest, NextResponse } from 'next/server';
import { generateAppManifest } from '@/lib/ai/chunkGenerator';
import { logger } from '@/lib/logger';
import { auth } from '@/lib/auth';
import type { ProviderName } from '@/lib/ai/types';

export async function POST(request: NextRequest) {
  const reqLogger = logger.createRequestLogger('/api/manifest');
  reqLogger.info('Received manifest generation request');

  try {
    // SECURITY: Only accept provider and model from client - NEVER apiKey or baseUrl
    const { intent, model, isMultiSlide, provider } = await request.json();

    if (!intent || !model) {
      reqLogger.warn('Missing intent or model parameters');
      return NextResponse.json({ success: false, error: 'Missing intent or model' }, { status: 400 });
    }

    // Get workspace context from session and headers
    const session = await auth();
    const userId = session?.user?.id;
    const workspaceId = request.headers.get('x-workspace-id') || 'default';
    
    // Validate provider
    const providerId = (provider || 'openai') as ProviderName;

    reqLogger.debug('Generating app manifest', { model, isMultiSlide, provider: providerId, workspaceId });
    const manifest = await generateAppManifest(
      intent, 
      model, 
      isMultiSlide, 
      providerId, 
      workspaceId, 
      userId
    );

    reqLogger.info('Manifest generated successfully', { fileCount: manifest.length });
    reqLogger.end('Request completed successfully');

    return NextResponse.json({ success: true, manifest });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    reqLogger.error('Manifest generation failed', error);
    
    // Check for configuration errors
    if (msg.includes('API key required') || msg.includes('No API key configured')) {
      return NextResponse.json({ 
        success: false, 
        error: 'AI provider not configured. Please configure your API key in settings.' 
      }, { status: 403 });
    }
    
    return NextResponse.json({ success: false, error: 'Manifest generation failed' }, { status: 500 });
  }
}
