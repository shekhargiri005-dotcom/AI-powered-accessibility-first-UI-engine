import { NextRequest, NextResponse } from 'next/server';
import { generateAppManifest } from '@/lib/ai/chunkGenerator';
import { UIIntentSchema } from '@/lib/validation/schemas';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { intent, model, isMultiSlide } = body;
    
    if (!intent || !model) {
      return NextResponse.json({ success: false, error: 'Missing intent or model' }, { status: 400 });
    }

    const manifest = await generateAppManifest(intent, model, isMultiSlide);
    return NextResponse.json({ success: true, manifest });
  } catch (error) {
    console.error('[/api/manifest] Error:', error);
    return NextResponse.json({ success: false, error: 'Manifest generation failed' }, { status: 500 });
  }
}
