import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cacheLife } from 'next/cache';

async function getCachedWorkspaces(userId: string) {
  'use cache';
  cacheLife('minutes');

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: {
      workspace: {
        include: {
          _count: {
            select: { settings: true }
          }
        }
      }
    }
  });

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
    const workspaces = await getCachedWorkspaces(session.user.id);
    return NextResponse.json({ success: true, workspaces });
  } catch (error) {
    console.error('[workspaces] Failed to fetch:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
