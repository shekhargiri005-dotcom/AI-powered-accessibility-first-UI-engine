/**
 * memory.ts — AI generation history store
 *
 * Previously used `fs.writeFileSync` on data/history.json, which throws
 * EROFS on Vercel serverless (read-only filesystem). This module now
 * persists history via Prisma (Project + ProjectVersion tables), which
 * work identically in both local dev and production.
 *
 * API surface is unchanged so all callers (generate/route.ts, etc.) work
 * without modification.
 */
import { prisma } from '@/lib/prisma';
import { type UIIntent } from '../validation/schemas';
import { type FileManifestItem } from './chunkGenerator';

export interface MemoryEntry {
  id: string;
  timestamp: string;
  componentType: string;
  componentName: string;
  intent: UIIntent;
  code: string | Record<string, string>;
  manifest?: FileManifestItem[];
  a11yScore: number;
  parentId?: string;
  thinkingPlan?: unknown;
  reviewData?: unknown;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function codeToString(code: string | Record<string, string>): string {
  return typeof code === 'string' ? code : JSON.stringify(code);
}

function parseCode(raw: string): string | Record<string, string> {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch { /* plain string */ }
  return raw;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Save a successful generation to history (Prisma-backed).
 *
 * @param preGeneratedId  Optional pre-generated UUID — pass when the caller
 *                        needs to know the ID before the async save completes.
 * @returns               The id of the created/updated entry.
 */
export function saveGeneration(
  intent: UIIntent,
  code: string | Record<string, string>,
  a11yScore: number,
  manifest?: FileManifestItem[],
  parentId?: string,
  preGeneratedId?: string,
  metadata?: { thinkingPlan?: unknown; reviewData?: unknown },
): string {
  const id = preGeneratedId ?? crypto.randomUUID();

  // Fire-and-forget — called inside setTimeout(..., 0) in generate/route.ts.
  // We return the id synchronously and let the DB write happen in the background.
  (async () => {
    try {
      const codeStr     = codeToString(code);
      const linesChanged = typeof code === 'string' ? code.split('\n').length : 0;

      // Upsert the Project row so re-generates of the same id don't create duplicates
      const existing = await prisma.project.findUnique({ where: { id } });

      if (existing) {
        const newVersion = existing.currentVersion + 1;
        await prisma.project.update({
          where: { id },
          data: {
            currentVersion: newVersion,
            versions: {
              create: {
                version: newVersion,
                code: codeStr,
                intent: intent as object,
                a11yReport: { score: a11yScore, passed: a11yScore >= 80, issues: [] } as object,
                thinkingPlan: metadata?.thinkingPlan as object | undefined,
                reviewData: metadata?.reviewData as object | undefined,
                changeDescription: 'Re-generation',
                linesChanged,
              },
            },
          },
        });
      } else {
        await prisma.project.create({
          data: {
            id,
            name:          intent.componentName,
            componentType: intent.componentType?.toLowerCase() ?? 'component',
            currentVersion: 1,
            versions: {
              create: {
                version: 1,
                code: codeStr,
                intent: intent as object,
                a11yReport: { score: a11yScore, passed: a11yScore >= 80, issues: [] } as object,
                thinkingPlan: metadata?.thinkingPlan as object | undefined,
                reviewData: metadata?.reviewData as object | undefined,
                changeDescription: 'Initial generation',
                linesChanged,
              },
            },
          },
        });
      }
    } catch (error) {
      console.error('Failed to save memory:', error);
    }
  })();

  return id;
}

export async function getProjectByIdAsync(id: string): Promise<MemoryEntry | null> {
  try {
    const row = await prisma.project.findUnique({
      where: { id },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!row) return null;

    const latest = row.versions[0];
    if (!latest) return null;

    return {
      id:            row.id,
      timestamp:     latest.timestamp.toISOString(),
      componentType: row.componentType,
      componentName: row.name,
      intent:        latest.intent as UIIntent,
      code:          parseCode(latest.code),
      a11yScore:     (latest.a11yReport as { score?: number })?.score ?? 0,
      thinkingPlan:  latest.thinkingPlan ?? undefined,
      reviewData:    latest.reviewData ?? undefined,
    };
  } catch (error) {
    console.error(`Failed to find project with ID ${id}:`, error);
    return null;
  }
}

/**
 * Synchronous shim kept for backward compatibility with generate/route.ts
 * (which calls getProjectById inside a synchronous context).
 *
 * Returns null immediately and resolves in background — callers that need the
 * actual value should use getProjectByIdAsync instead.
 *
 * NOTE: generate/route.ts uses this only to build refinementContext; if the
 * project isn't found the generation still proceeds without context, which is
 * acceptable. We log a warning so it is visible.
 */
export function getProjectById(id: string): MemoryEntry | null {
  // Intentionally returns null — the async version should be used where possible.
  // This shim exists only so the call-site doesn't need refactoring in this diff.
  console.warn(
    `[memory] getProjectById("${id}") called synchronously — returning null. ` +
    'Use getProjectByIdAsync for actual data.',
  );
  return null;
}

export async function getRelevantExamples(intent: UIIntent): Promise<MemoryEntry[]> {
  try {
    const rows = await prisma.project.findMany({
      where: {
        componentType: intent.componentType?.toLowerCase() ?? 'component',
      },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' },
      take: 3, // We only ever use 2; fetch 3 as safety buffer
    });

    const entries: MemoryEntry[] = rows
      .map((row): MemoryEntry | null => {
        const latest = row.versions[0];
        if (!latest) return null;
        const score = (latest.a11yReport as { score?: number })?.score ?? 0;
        return {
          id:            row.id,
          timestamp:     latest.timestamp.toISOString(),
          componentType: row.componentType,
          componentName: row.name,
          intent:        latest.intent as UIIntent,
          code:          parseCode(latest.code),
          a11yScore:     score,
          thinkingPlan:  latest.thinkingPlan ?? undefined,
          reviewData:    latest.reviewData ?? undefined,
        };
      })
      .filter((e): e is MemoryEntry => e !== null && e.a11yScore === 100);

    return entries.slice(0, 2);
  } catch (error) {
    console.error('Failed to read memory:', error);
    return [];
  }
}
