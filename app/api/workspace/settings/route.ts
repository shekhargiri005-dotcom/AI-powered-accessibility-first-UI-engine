/**
 * @file app/api/workspace/settings/route.ts
 * 
 * GET  – returns saved providers/models (never exposes raw API keys).
 * POST – validates, encrypts, and saves a key. Accepts { clear: true } to delete.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encryptionService } from '@/lib/security/encryption';
import { invalidateWorkspaceKey } from '@/lib/security/workspaceKeyService';
import { getAdapter } from '@/lib/ai/adapters/index';
import { z } from 'zod';

const DEFAULT_WORKSPACE = 'default';

// Default test model per provider (lightweight / cheap)
const PROVIDER_TEST_MODELS: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-haiku-20240307',
  deepseek: 'deepseek-chat',
  google: 'gemini-2.0-flash',
};

const postSchema = z.object({
  provider: z.string().min(1),
  model: z.string().optional(),
  apiKey: z.string().optional(),
  clear: z.boolean().optional(),
});

// ─── GET ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const settings = await prisma.workspaceSettings.findMany({
      where: { workspaceId: DEFAULT_WORKSPACE },
      select: { provider: true, model: true, updatedAt: true },
    });

    // Map to { [provider]: { model, hasApiKey, updatedAt } } – key never exposed
    const providerMap = settings.reduce<Record<string, { model: string | null; hasApiKey: boolean; updatedAt: Date }>>(
      (acc, s) => {
        acc[s.provider] = { model: s.model, hasApiKey: true, updatedAt: s.updatedAt };
        return acc;
      },
      {}
    );

    return NextResponse.json({ settings: providerMap });
  } catch (error) {
    console.error('[GET /api/workspace/settings] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = postSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { provider, model, apiKey, clear } = parsed.data;

    // ── Clear path ──────────────────────────────────────────────────────────
    if (clear) {
      await prisma.workspaceSettings.deleteMany({
        where: { workspaceId: DEFAULT_WORKSPACE, provider },
      });
      // Invalidate in-memory cache
      invalidateWorkspaceKey(provider, DEFAULT_WORKSPACE);
      return NextResponse.json({ success: true, message: `Settings cleared for ${provider}` });
    }

    // ── Save path ───────────────────────────────────────────────────────────
    if (!apiKey) {
      return NextResponse.json(
        { error: 'apiKey is required unless clear: true' },
        { status: 400 }
      );
    }

    // 1. Validate key with a lightweight test call (skip for Ollama – no key needed)
    if (provider !== 'ollama') {
      const testModelName = model || PROVIDER_TEST_MODELS[provider];
      if (!testModelName) {
        return NextResponse.json(
          { error: `Unknown provider: ${provider}` },
          { status: 400 }
        );
      }

      try {
        const testAdapter = getAdapter(testModelName, apiKey);
        await testAdapter.generate({
          model: testModelName,
          messages: [{ role: 'user', content: 'Reply with the single word: OK' }],
          maxTokens: 5,
        });
      } catch (err: unknown) {
        const msg =
          (err as any)?.error?.message ||
          (err as any)?.message ||
          'The API key appears to be invalid or the provider is unreachable.';
        return NextResponse.json(
          { error: `Key validation failed: ${msg}` },
          { status: 401 }
        );
      }
    }

    // 2. Encrypt the key
    const encryptedApiKey = encryptionService.encrypt(apiKey);

    // 3. Upsert into DB
    await prisma.workspaceSettings.upsert({
      where: {
        workspaceId_provider: { workspaceId: DEFAULT_WORKSPACE, provider },
      },
      update: { encryptedApiKey, model: model ?? null },
      create: {
        workspaceId: DEFAULT_WORKSPACE,
        provider,
        encryptedApiKey,
        model: model ?? null,
      },
    });

    // 4. Invalidate TTL cache so next request picks up new key immediately
    invalidateWorkspaceKey(provider, DEFAULT_WORKSPACE);

    return NextResponse.json({ success: true, message: 'API key saved and validated.' });
  } catch (error) {
    console.error('[POST /api/workspace/settings] Error:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
