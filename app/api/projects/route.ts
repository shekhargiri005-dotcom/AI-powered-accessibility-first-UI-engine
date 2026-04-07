import { NextRequest, NextResponse } from 'next/server';
import {
  createProject, saveVersion, listProjects, deleteProject,
} from '@/lib/projects/projectStore';
import type { UIIntent, A11yReport } from '@/lib/validation/schemas';

// GET /api/projects — list all projects
export async function GET() {
  const projects = await listProjects();
  return NextResponse.json({ success: true, projects });
}

// POST /api/projects — create new or upsert a version
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const {
      id, name, componentType, code, intent, a11yReport,
      changeDescription, isNewProject,
    } = body as {
      id: string;
      name: string;
      componentType: 'component' | 'app' | 'webgl';
      code: string | Record<string, string>;
      intent: UIIntent;
      a11yReport: A11yReport;
      changeDescription?: string;
      isNewProject?: boolean;
    };

    if (!id || !code || !intent) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: id, code, intent' },
        { status: 400 },
      );
    }

    let project;
    if (isNewProject) {
      project = await createProject(
        id, name || intent.componentName,
        componentType || 'component',
        code, intent, a11yReport,
      );
    } else {
      project = await saveVersion(id, code, intent, a11yReport, changeDescription || 'Refinement');
      if (!project) {
        // Project not found — create it (handles edge-case of first-time save without isNewProject flag)
        project = await createProject(
          id, name || intent.componentName,
          componentType || 'component',
          code, intent, a11yReport,
        );
      }
    }

    return NextResponse.json({ success: true, project });
  } catch (error) {
    console.error('[/api/projects POST] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects?id=<id>
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
  const deleted = await deleteProject(id);
  return NextResponse.json({ success: deleted });
}
