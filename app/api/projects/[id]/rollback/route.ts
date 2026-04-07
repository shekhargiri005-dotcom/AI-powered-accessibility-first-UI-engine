import { NextRequest, NextResponse } from 'next/server';
import { rollbackToVersion } from '@/lib/projects/projectStore';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { version } = body as { version: number };
  if (typeof version !== 'number') {
    return NextResponse.json({ success: false, error: 'Missing field: version (number)' }, { status: 400 });
  }

  const project = await rollbackToVersion(id, version);
  if (!project) {
    return NextResponse.json({ success: false, error: 'Project or version not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, project });
}
