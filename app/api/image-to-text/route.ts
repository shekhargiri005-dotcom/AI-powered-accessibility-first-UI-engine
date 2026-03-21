import { NextResponse } from 'next/server';

const HF_TOKEN = process.env.HF_TOKEN;
const MODEL_URL = 'https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large';

export async function POST(req: Request) {
  if (!HF_TOKEN) {
    return NextResponse.json({ error: 'HF_TOKEN is not configured.' }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const imageFile = formData.get('image') as File | null;

    if (!imageFile) {
      return NextResponse.json({ error: 'No image uploaded' }, { status: 400 });
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Call Hugging Face API
    const response = await fetch(MODEL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        'Content-Type': imageFile.type,
      },
      body: buffer,
    });

    if (!response.ok) {
      // Sometimes HF models are still loading
      const errorText = await response.text();
      return NextResponse.json(
        { error: `API Error ${response.status}: ${errorText}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    
    // BLIP usually returns an array with an object: [{ generated_text: "caption" }]
    let caption = 'An uploaded image';
    if (Array.isArray(result) && result.length > 0 && result[0].generated_text) {
      caption = result[0].generated_text;
    }

    return NextResponse.json({ caption });

  } catch (error: any) {
    console.error('Image to Text error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to process image.' },
      { status: 500 }
    );
  }
}
