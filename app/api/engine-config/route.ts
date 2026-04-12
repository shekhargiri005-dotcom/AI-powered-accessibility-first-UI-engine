/**
 * @file app/api/engine-config/route.ts
 *
 * GET  /api/engine-config  → returns the current workspace engine config (provider + model, NO key)
 * POST /api/engine-config  → saves provider + model + encrypted API key to WorkspaceSettings DB
 * DELETE /api/engine-config → removes config (deactivates engine)
 *
 * The API key is AES-256 encrypted at rest. It is NEVER returned to the client.
 * The adapter layer reads the key directly from DB per-request via workspaceKeyService.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encryptionService } from '@/lib/security/encryption';
import { invalidateWorkspaceKey } from '@/lib/security/workspaceKeyService';
import { auth } from '@/lib/auth';

export const maxDuration = 15;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getWorkspaceId(userId?: string): Promise<string> {
  if (!userId) return 'default';
  // Find the user's primary (owned) workspace
  const ws = await prisma.workspace.findFirst({
    where: {
      members: { some: { userId, role: 'OWNER' } },
    },
    select: { id: true },
  });
  return ws?.id ?? 'default';
}

// ─── GET — return public config (no key) ─────────────────────────────────────

export async function GET() {
  try {
    const session = await auth();
    const workspaceId = await getWorkspaceId(session?.user?.id);

    const settings = await prisma.workspaceSettings.findMany({
      where: { workspaceId },
      select: { provider: true, model: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });

    // Return the most-recently updated entry as the "active" config
    const active = settings[0] ?? null;

    return NextResponse.json({
      success: true,
      config: active
        ? {
            provider: active.provider,
            model: active.model ?? null,
            hasKey: true,
            updatedAt: active.updatedAt,
          }
        : null,
    });
  } catch (err) {
    console.error('[engine-config GET]', err);
    return NextResponse.json({ success: false, error: 'Failed to load config' }, { status: 500 });
  }
}

// ─── POST — save config + encrypted key ──────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const workspaceId = await getWorkspaceId(session?.user?.id);

    const body = await request.json() as {
      provider: string;
      model?: string;
      apiKey?: string;
      temperature?: number;
      fullAppMode?: boolean;
      multiSlideMode?: boolean;
    };

    const { provider, model, apiKey } = body;

    if (!provider) {
      return NextResponse.json({ success: false, error: 'provider is required' }, { status: 400 });
    }

    // Encrypt the key only if provided; if omitted, keep existing encrypted key
    let encryptedApiKey: string | undefined;
    if (apiKey && apiKey !== '••••' && apiKey !== 'local') {
      encryptedApiKey = encryptionService.encrypt(apiKey);
    }

    if (encryptedApiKey) {
      // Upsert — update if exists, create if not
      await prisma.workspaceSettings.upsert({
        where: { workspaceId_provider: { workspaceId, provider } },
        update: {
          model: model ?? null,
          encryptedApiKey,
        },
        create: {
          workspaceId,
          provider,
          model: model ?? null,
          encryptedApiKey,
        },
      });

      // ⚡ Invalidate the per-process cache immediately so next request reads fresh key
      invalidateWorkspaceKey(provider, workspaceId);
    } else if (model) {
      // Update only model (no new key provided)
      await prisma.workspaceSettings.updateMany({
        where: { workspaceId, provider },
        data: { model },
      });
      invalidateWorkspaceKey(provider, workspaceId);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[engine-config POST]', err);
    return NextResponse.json({ success: false, error: 'Failed to save config' }, { status: 500 });
  }
}

// ─── DELETE — deactivate engine (remove all keys for workspace) ───────────────

export async function DELETE() {
  try {
    const session = await auth();
    const workspaceId = await getWorkspaceId(session?.user?.id);

    const deleted = await prisma.workspaceSettings.findMany({
      where: { workspaceId },
      select: { provider: true },
    });

    await prisma.workspaceSettings.deleteMany({ where: { workspaceId } });

    // Invalidate cache for every deleted provider
    for (const { provider } of deleted) {
      invalidateWorkspaceKey(provider, workspaceId);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[engine-config DELETE]', err);
    return NextResponse.json({ success: false, error: 'Failed to deactivate engine' }, { status: 500 });
  }
}
