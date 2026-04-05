import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  recordFeedback,
  getFeedbackStats,
  getAllFeedbackStats,
} from '@/lib/ai/feedbackStore';

// ─── Validation Schema ────────────────────────────────────────────────────────

const FeedbackBodySchema = z.object({
  generationId:   z.string().min(1),
  signal:         z.enum(['thumbs_up', 'thumbs_down', 'corrected', 'discarded']),
  model:          z.string().min(1),
  provider:       z.string().min(1),
  intentType:     z.string().min(1),
  promptHash:     z.string().min(1),
  a11yScore:      z.number().int().min(0).max(100).default(0),
  critiqueScore:  z.number().int().min(0).max(100).default(0),
  latencyMs:      z.number().int().min(0).default(0),
  workspaceId:    z.string().optional(),
  correctionNote: z.string().max(2000).optional(),
  correctedCode:  z.string().max(200000).optional(),
});

// ─── POST /api/feedback ───────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON' },
        { status: 400 },
      );
    }

    const parsed = FeedbackBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(', '),
        },
        { status: 400 },
      );
    }

    await recordFeedback(parsed.data);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

// ─── GET /api/feedback?model=...&intentType=... ───────────────────────────────
// Returns aggregated stats. Used by the Metrics tab in RightPanel.

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const model      = searchParams.get('model');
    const intentType = searchParams.get('intentType');

    if (model && intentType) {
      const stats = getFeedbackStats(model, intentType);
      return NextResponse.json({ success: true, stats });
    }

    // Return all stats when no filter is provided
    const allStats = getAllFeedbackStats();
    return NextResponse.json({ success: true, stats: allStats });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
