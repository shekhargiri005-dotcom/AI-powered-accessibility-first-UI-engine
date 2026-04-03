import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getWorkspaceApiKey } from '@/lib/security/workspaceKeyService';
import { logger } from '@/lib/logger';

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

export async function POST(req: NextRequest) {
    const reqLogger = logger.createRequestLogger('/api/vision');
    reqLogger.info('Received Vision critique request');

    try {
        const { image, code } = await req.json();

        if (!image || !code) {
            return NextResponse.json({ success: false, error: 'Missing image or code' }, { status: 400 });
        }

        // Vision requires the raw OpenAI client for multimodal content.
        // Use workspace key if saved, otherwise fall back to env var.
        const workspaceKey = await getWorkspaceApiKey('openai');
        const openai = new OpenAI({ apiKey: workspaceKey ?? process.env.OPENAI_API_KEY });
        // Convert components string into array of files if it is multi-file.
        const codeContext = typeof code === 'string'
            ? `=== CURRENT COMPONENT CODE ===\n${code}`
            : `=== CURRENT MULTI-FILE CODE ===\n${JSON.stringify(code, null, 2)}`;

        reqLogger.info('Calling GPT-4o for visual critique');

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: VISION_SYSTEM_PROMPT,
                },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: `Here is the current source code:\n\n${codeContext}` },
                        {
                            type: 'image_url',
                            image_url: {
                                url: image,
                                detail: 'high',
                            },
                        },
                    ],
                },
            ],
            response_format: { type: 'json_object' },
            max_tokens: 4000,
        });

        const resultText = response.choices[0].message.content;
        if (!resultText) throw new Error('No response from Vision model');

        const parsedResult = JSON.parse(resultText);

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
