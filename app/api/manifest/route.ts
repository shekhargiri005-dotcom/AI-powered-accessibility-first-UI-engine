import { NextRequest, NextResponse } from 'next/server';
import { generateAppManifest } from '@/lib/ai/chunkGenerator';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const reqLogger = logger.createRequestLogger('/api/manifest');
  reqLogger.info('Received manifest generation request');

  try {
    const body = await request.json();
    const { intent, model, isMultiSlide, provider, apiKey, baseUrl } = body;
    const effectiveApiKey = apiKey && apiKey !== '••••' ? apiKey : undefined;

    if (!intent || !model) {
      reqLogger.warn('Missing intent or model parameters');
      return NextResponse.json({ success: false, error: 'Missing intent or model' }, { status: 400 });
    }

    reqLogger.debug('Generating app manifest', { model, isMultiSlide, provider });
    const manifest = await generateAppManifest(intent, model, isMultiSlide, provider, effectiveApiKey, baseUrl);

    reqLogger.info('Manifest generated successfully', { fileCount: manifest.length });
    reqLogger.end('Request completed successfully');

    return NextResponse.json({ success: true, manifest });
  } catch (error) {
    reqLogger.error('Manifest generation failed', error);
    return NextResponse.json({ success: false, error: 'Manifest generation failed' }, { status: 500 });
  }
}
