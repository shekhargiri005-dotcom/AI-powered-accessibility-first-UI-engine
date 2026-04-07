import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/projects/projectStore';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true, project });
}
