import { NextRequest, NextResponse } from 'next/server';
import { prisma, withReconnect } from '@/lib/prisma';
import { getProjectByIdAsync } from '@/lib/ai/memory';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  try {
    // ── Single project lookup ────────────────────────────────────────────────
    if (id) {
      const project = await getProjectByIdAsync(id);
      if (!project) {
        return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, project });
    }

    // ── Full history list ────────────────────────────────────────────────────
    // Returns a lightweight summary shape (no code blobs) identical to what
    // the front-end previously consumed from the history.json endpoint.
    const rows = await withReconnect(() => prisma.project.findMany({
      include: {
        versions: { orderBy: { version: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    }));

    const summarizedHistory = rows
      .map((row) => {
        const latest = row.versions[0];
        if (!latest) return null;

        const intent = latest.intent as {
          description?: string;
          componentName?: string;
        } | null;

        const description = intent?.description ?? '';

        return {
          id:            row.id,
          timestamp:     latest.timestamp.toISOString(),
          componentType: row.componentType,
          componentName: row.name,
          promptSnippet: description.length > 60
            ? description.substring(0, 60) + '...'
            : description,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ history: summarizedHistory });
  } catch (error) {
    console.error('Failed to fetch history from DB:', error);
    return NextResponse.json({ history: [] });
  }
}
