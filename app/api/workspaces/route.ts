import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma, withReconnect } from '@/lib/prisma';



async function getWorkspaces(userId: string) {
  const memberships = await withReconnect(() => prisma.workspaceMember.findMany({
    where: { userId },
    include: {
      workspace: {
        include: {
          _count: {
            select: { settings: true }
          }
        }
      }
    },
    orderBy: { createdAt: 'asc' },
  }));

  return memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    slug: m.workspace.slug,
    role: m.role,
    settingsCount: m.workspace._count.settings
  }));
}

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const workspaces = await getWorkspaces(session.user.id);
    return NextResponse.json({ success: true, workspaces });
  } catch (error) {
    console.error('[workspaces GET] Failed to fetch:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let name: string;
  try {
    const body = await request.json();
    name = (body.name ?? '').trim();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!name) {
    return NextResponse.json({ success: false, error: 'Workspace name is required' }, { status: 400 });
  }
  if (name.length > 64) {
    return NextResponse.json({ success: false, error: 'Name must be 64 characters or fewer' }, { status: 400 });
  }

  try {
    // Derive a unique slug: lowercase-dashes + cuid suffix to avoid collisions
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'workspace';
    const slug = `${base}-${Date.now().toString(36)}`;

    // The credentials provider returns id:'owner' — ensure the User row exists in DB
    // before creating the FK-dependent WorkspaceMember.
    await withReconnect(() => prisma.user.upsert({
      where: { id: session.user.id },
      create: {
        id: session.user.id,
        email: session.user.email ?? undefined,
        name: session.user.name ?? 'Owner',
      },
      update: {},
    }));

    // Atomic create: workspace + OWNER membership in one transaction
    const workspace = await withReconnect(() => prisma.workspace.create({
      data: {
        name,
        slug,
        members: {
          create: {
            userId: session.user.id,
            role: 'OWNER',
          },
        },
      },
    }));

    return NextResponse.json({
      success: true,
      workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug, role: 'OWNER' },
    });
  } catch (error) {
    console.error('[workspaces POST] Failed to create:', error);
    return NextResponse.json({ success: false, error: 'Failed to create workspace' }, { status: 500 });
  }
}
