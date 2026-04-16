import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { runFinalRoundCritic } from '@/lib/ai/finalRoundCritic';
import type { FinalRoundCriticOptions } from '@/lib/ai/finalRoundCritic';
import { auth } from '@/lib/auth';

export const maxDuration = 120;

interface FinalRoundRequestBody {
  /** Base64 data URL screenshot of the rendered UI */
  imageDataUrl: string;
  /** Generated source code (string or multi-file object) */
  code: string | Record<string, string>;
  /** Model identifier chosen by the user — same model that generated the UI */
  model: string;
  provider?: string;
  // SECURITY: apiKey and baseUrl are NEVER accepted from client
  // Credentials are resolved server-side via workspaceKeyService
}

export async function POST(req: NextRequest) {
  const reqLogger = logger.createRequestLogger('/api/final-round');
  reqLogger.info('Final Round critique request received');

  // Get workspace and user context for credential resolution
  const session = await auth();
  const userId = session?.user?.id;
  const workspaceId = req.headers.get('x-workspace-id') || 'default';

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ success: false, error: 'Request body must be a JSON object' }, { status: 400 });
  }

  // SECURITY: Only accept provider and model from client - NEVER apiKey or baseUrl
  const { imageDataUrl, code, model, provider } = body as FinalRoundRequestBody;

  if (!imageDataUrl || !code || !model) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields: imageDataUrl, code, model' },
      { status: 400 },
    );
  }

  reqLogger.info('Running Final Round critic', { model, provider });

  const opts: FinalRoundCriticOptions = {
    imageDataUrl,
    code,
    model,
    provider,
    workspaceId,
    userId,
  };

  const response = await runFinalRoundCritic(opts);

  reqLogger.end('Final Round critic completed', { status: response.status });

  return NextResponse.json({
    success: true,
    ...response,
  });
}
