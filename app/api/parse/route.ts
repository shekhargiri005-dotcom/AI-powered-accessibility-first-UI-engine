import { NextRequest, NextResponse } from 'next/server';
import { parseIntent } from '@/lib/ai/intentParser';

// Rate limit simple implementation (per-request, no persistence)
const MAX_INPUT_LENGTH = 10000;

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Type guard
    if (!body || typeof body !== 'object' || !('prompt' in body)) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: prompt' },
        { status: 400 }
      );
    }

    const { prompt } = body as { prompt: unknown };

    // Validate prompt type and length
    if (typeof prompt !== 'string') {
      return NextResponse.json(
        { success: false, error: 'prompt must be a string' },
        { status: 400 }
      );
    }

    if (prompt.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'prompt cannot be empty' },
        { status: 400 }
      );
    }

    if (prompt.length > MAX_INPUT_LENGTH) {
      return NextResponse.json(
        { success: false, error: `prompt exceeds maximum length of ${MAX_INPUT_LENGTH} characters` },
        { status: 400 }
      );
    }

    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OPENAI_API_KEY is not configured. Add it to your .env.local file.' },
        { status: 500 }
      );
    }

    // Parse intent via AI
    const result = await parseIntent(prompt);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      intent: result.intent,
    });
  } catch (error) {
    console.error('[/api/parse] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
