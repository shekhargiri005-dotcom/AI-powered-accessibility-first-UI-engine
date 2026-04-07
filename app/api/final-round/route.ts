import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { runFinalRoundCritic } from '@/lib/ai/finalRoundCritic';
import type { FinalRoundCriticOptions } from '@/lib/ai/finalRoundCritic';

export const maxDuration = 120;

interface FinalRoundRequestBody {
  /** Base64 data URL screenshot of the rendered UI */
  imageDataUrl: string;
  /** Generated source code (string or multi-file object) */
  code: string | Record<string, string>;
  /** Model identifier chosen by the user — same model that generated the UI */
  model: string;
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
}

export async function POST(req: NextRequest) {
  const reqLogger = logger.createRequestLogger('/api/final-round');
  reqLogger.info('Final Round critique request received');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ success: false, error: 'Request body must be a JSON object' }, { status: 400 });
  }

  const { imageDataUrl, code, model, provider, apiKey, baseUrl } = body as FinalRoundRequestBody;

  if (!imageDataUrl || !code || !model) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields: imageDataUrl, code, model' },
      { status: 400 },
    );
  }

  // Sanitise masked keys (page.tsx stores '••••' for loaded keys)
  const effectiveApiKey = apiKey && apiKey !== '••••' ? apiKey : undefined;

  reqLogger.info('Running Final Round critic', { model, provider });

  const opts: FinalRoundCriticOptions = {
    imageDataUrl,
    code,
    model,
    provider,
    apiKey: effectiveApiKey,
    baseUrl,
  };

  const response = await runFinalRoundCritic(opts);

  reqLogger.end('Final Round critic completed', { status: response.status });

  return NextResponse.json({
    success: true,
    ...response,
  });
}
