import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceApiKey } from '@/lib/security/workspaceKeyService';
import { logger } from '@/lib/logger';

/**
 * Vision route — performs visual UI critique using a multimodal model.
 *
 * ⚠️ PROVIDER NOTE: This endpoint requires a vision-capable model.
 * It defaults to OpenAI gpt-4o (the de-facto multimodal standard) unless the
 * workspace has configured a different OpenAI-compatible vision model via
 * VISION_MODEL env var. Google vision would require separate adapter config.
 */
const VISION_MODEL = process.env.VISION_MODEL ?? 'gpt-4o';

const VISION_SYSTEM_PROMPT = `You are a world-class UI/UX design expert and strict frontend reviewer.
Your job is to look at the attached screenshot of the rendered UI and the accompanying raw code, and identify aesthetic flaws.

CHECK FOR:
1. Spacing and Alignment: Are elements bleeding into each other? Is padding consistent?
2. Color & Contrast: Do the text colors fail WCAG AAA? Are gradients jarring?
3. Sizing & Hierarchy: Are titles too small? Are buttons massively oversized?
4. Structure: Is the layout fundamentally broken on the rendered screen?

IF IT LOOKS GREAT:
Return a JSON object: { "passed": true, "critique": "The UI looks perfect.", "suggestedCode": null }

IF IT HAS FLAWS:
Provide the EXACT code to fix it. Do not just summarize.
Return a JSON object: 
{ 
  "passed": false, 
  "critique": "The contrast on the primary button is low. The sidebar is overflowing its container.", 
  "suggestedCode": "// The fully repaired raw TSX code here..." 
}`;

interface VisionRequestBody {
  image: string;
  code: string | Record<string, string>;
}

interface VisionCritiqueResult {
  passed: boolean;
  critique: string;
  suggestedCode: string | null;
}

export async function POST(req: NextRequest) {
  const reqLogger = logger.createRequestLogger('/api/vision');
  reqLogger.info('Received Vision critique request');

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || !('image' in body) || !('code' in body)) {
      return NextResponse.json({ success: false, error: 'Missing image or code fields' }, { status: 400 });
    }

    const { image, code } = body as VisionRequestBody;

    if (!image || !code) {
      return NextResponse.json({ success: false, error: 'image and code must be non-empty' }, { status: 400 });
    }

    // Resolve API key: workspace-saved key takes precedence over env var.
    const workspaceKey = await getWorkspaceApiKey('openai');
    const apiKey = workspaceKey ?? process.env.OPENAI_API_KEY;

    if (!apiKey) {
      reqLogger.warn('No OpenAI API key available for vision critique');
      return NextResponse.json(
        { success: false, error: 'Vision critique requires an OpenAI API key. Configure it in the AI Engine settings.' },
        { status: 503 },
      );
    }

    // Vision requires the raw OpenAI REST API for multimodal content.
    // We use fetch directly to avoid importing the sdk at module level.
    const codeContext =
      typeof code === 'string'
        ? `=== CURRENT COMPONENT CODE ===\n${code}`
        : `=== CURRENT MULTI-FILE CODE ===\n${JSON.stringify(code, null, 2)}`;

    reqLogger.info('Calling vision model for visual critique', { model: VISION_MODEL });

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          { role: 'system', content: VISION_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Here is the current source code:\n\n${codeContext}` },
              {
                type: 'image_url',
                image_url: { url: image, detail: 'high' },
              },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4000,
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text().catch(() => 'unknown error');
      reqLogger.error('OpenAI vision API returned non-OK status', undefined, { status: openaiRes.status, body: errText });
      return NextResponse.json(
        { success: false, error: `Vision model error (HTTP ${openaiRes.status})` },
        { status: 502 },
      );
    }

    const openaiData = await openaiRes.json() as {
      choices: Array<{ message: { content: string | null } }>;
    };

    const resultText = openaiData.choices[0]?.message?.content;
    if (!resultText) throw new Error('No response content from vision model');

    const parsedResult = JSON.parse(resultText) as VisionCritiqueResult;

    reqLogger.end('Vision critique completed successfully', { passed: parsedResult.passed });

    return NextResponse.json({
      success: true,
      critique: parsedResult,
    });
  } catch (error) {
    reqLogger.error('Vision API error', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
