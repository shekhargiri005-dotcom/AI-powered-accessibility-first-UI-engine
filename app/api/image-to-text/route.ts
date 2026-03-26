import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY is not configured.' }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const imageFile = formData.get('image') as File | null;

    if (!imageFile) {
      return NextResponse.json({ error: 'No image uploaded' }, { status: 400 });
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');
    const mimeType = imageFile.type;
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this image and describe the UI components, layout, and purpose shown. Keep it concise but highly descriptive so it can be used to generate a matching React component.' },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      max_tokens: 300,
    });

    const caption = response.choices[0]?.message?.content || 'An uploaded image';
    return NextResponse.json({ caption });

  } catch (error) {
    console.error('Image to Text error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process image with OpenAI Vision.' },
      { status: 500 }
    );
  }
}
