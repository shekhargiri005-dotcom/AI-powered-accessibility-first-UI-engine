import { prisma, withReconnect } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import type { UIIntent, A11yReport } from '../validation/schemas';

/** P2021 = table does not exist (migration pending). Treat as non-fatal. */
function isTableMissingError(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2021';
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProjectVersion {
  version: number;
  timestamp: string;
  code: string | Record<string, string>;
  intent: UIIntent;
  a11yReport: A11yReport;
  thinkingPlan?: unknown;
  reviewData?: unknown;
  changeDescription: string;
  linesChanged?: number;
}

export interface Project {
  id: string;
  name: string;
  componentType: 'component' | 'app' | 'depth_ui';
  createdAt: string;
  updatedAt: string;
  currentVersion: number;
  versions: ProjectVersion[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  componentType: string;
  createdAt: string;
  updatedAt: string;
  currentVersion: number;
  versionCount: number;
  latestDescription: string;
}

// ─── DB row → domain type ─────────────────────────────────────────────────────

type DbVersion = {
  version: number;
  timestamp: Date;
  code: string;
  intent: unknown;
  a11yReport: unknown;
  thinkingPlan?: unknown | null;
  reviewData?: unknown | null;
  changeDescription: string;
  linesChanged: number;
};

type DbProject = {
  id: string;
  name: string;
  componentType: string;
  createdAt: Date;
  updatedAt: Date;
  currentVersion: number;
  versions: DbVersion[];
};

function parseCode(raw: string): string | Record<string, string> {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch { /* not JSON — plain string */ }
  return raw;
}

function toProject(row: DbProject): Project {
  return {
    id: row.id,
    name: row.name,
    componentType: row.componentType as 'component' | 'app' | 'depth_ui',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    currentVersion: row.currentVersion,
    versions: row.versions.map((v) => ({
      version: v.version,
      timestamp: v.timestamp.toISOString(),
      code: parseCode(v.code),
      intent: v.intent as UIIntent,
      a11yReport: v.a11yReport as A11yReport,
      thinkingPlan: v.thinkingPlan ?? undefined,
      reviewData: v.reviewData ?? undefined,
      changeDescription: v.changeDescription,
      linesChanged: v.linesChanged,
    })),
  };
}

const VERSION_INCLUDE = { versions: { orderBy: { version: 'asc' as const } } };

// ─── CRUD Operations (all async — Prisma replaces filesystem) ─────────────────

export async function createProject(
  id: string,
  name: string,
  componentType: 'component' | 'app' | 'depth_ui',
  code: string | Record<string, string>,
  intent: UIIntent,
  a11yReport: A11yReport,
  metadata?: { thinkingPlan?: unknown; reviewData?: unknown; workspaceId?: string },
): Promise<Project> {
  const codeStr = typeof code === 'string' ? code : JSON.stringify(code);
  // Calculate lines for both single file and multi-file projects
  const linesChanged = typeof code === 'string' 
    ? code.split('\n').length 
    : Object.values(code).reduce((total, fileContent) => total + fileContent.split('\n').length, 0);
  const now = new Date().toISOString();

  try {
    const row = await withReconnect(() => prisma.project.create({
      data: {
        id,
        name,
        componentType,
        workspaceId: metadata?.workspaceId,
        currentVersion: 1,
        versions: {
          create: {
            version: 1,
            code: codeStr,
            intent: intent as object,
            a11yReport: a11yReport as object,
            thinkingPlan: metadata?.thinkingPlan as Prisma.InputJsonValue | undefined,
            reviewData: metadata?.reviewData as Prisma.InputJsonValue | undefined,
            changeDescription: 'Initial generation',
            linesChanged,
          },
        },
      },
      include: VERSION_INCLUDE,
    }));
    return toProject(row as DbProject);
  } catch (e) {
    if (isTableMissingError(e)) {
      // Migration pending — return a synthetic in-memory project so the UI still works
      console.warn('[projectStore] Project table missing (migration pending) — returning in-memory stub');
      return {
        id, name, componentType,
        createdAt: now, updatedAt: now, currentVersion: 1,
        versions: [{
          version: 1, timestamp: now, code,
          intent, a11yReport,
          thinkingPlan: metadata?.thinkingPlan,
          reviewData: metadata?.reviewData,
          changeDescription: 'Initial generation', linesChanged,
        }],
      };
    }
    throw e;
  }
}

export async function saveVersion(
  id: string,
  code: string | Record<string, string>,
  intent: UIIntent,
  a11yReport: A11yReport,
  changeDescription: string,
  metadata?: { thinkingPlan?: unknown; reviewData?: unknown },
): Promise<Project | null> {
  try {
    const existing = await withReconnect(() => prisma.project.findUnique({
      where: { id },
      include: VERSION_INCLUDE,
    }));
    if (!existing) return null;

    const codeStr = typeof code === 'string' ? code : JSON.stringify(code);
    const lastVersion = existing.versions[existing.versions.length - 1];
    const prevLines = (lastVersion?.code ?? '').split('\n').length;
    const newLines = typeof code === 'string' ? code.split('\n').length : 0;
    const linesChanged = Math.abs(newLines - prevLines);
    const newVersionNumber = existing.currentVersion + 1;

    const row = await withReconnect(() => prisma.project.update({
      where: { id },
      data: {
        currentVersion: newVersionNumber,
        versions: {
          create: {
            version: newVersionNumber,
            code: codeStr,
            intent: intent as object,
            a11yReport: a11yReport as object,
            thinkingPlan: metadata?.thinkingPlan as Prisma.InputJsonValue | undefined,
            reviewData: metadata?.reviewData as Prisma.InputJsonValue | undefined,
            changeDescription,
            linesChanged,
          },
        },
      },
      include: VERSION_INCLUDE,
    }));
    return toProject(row as DbProject);
  } catch (e) {
    if (isTableMissingError(e)) return null;
    throw e;
  }
}

export async function getProject(id: string): Promise<Project | null> {
  try {
    const row = await withReconnect(() => prisma.project.findUnique({
      where: { id },
      include: VERSION_INCLUDE,
    }));
    return row ? toProject(row as DbProject) : null;
  } catch {
    return null;
  }
}

export async function listProjects(workspaceId?: string): Promise<ProjectSummary[]> {
  try {
    const rows = await withReconnect(() => prisma.project.findMany({
      where: workspaceId ? { workspaceId } : undefined,
      include: {
        versions: { orderBy: { version: 'desc' }, take: 1 },
        _count: { select: { versions: true } },
      },
      orderBy: { updatedAt: 'desc' },
    }));
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      componentType: p.componentType,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      currentVersion: p.currentVersion,
      versionCount: p._count.versions,
      latestDescription: p.versions[0]?.changeDescription ?? '',
    }));
  } catch {
    return [];
  }
}

export async function rollbackToVersion(id: string, targetVersion: number): Promise<Project | null> {
  try {
    const existing = await withReconnect(() => prisma.project.findUnique({
      where: { id },
      include: VERSION_INCLUDE,
    }));
    if (!existing) return null;

    const target = existing.versions.find((v) => v.version === targetVersion);
    if (!target) return null;

    const newVersionNumber = existing.currentVersion + 1;
    const row = await withReconnect(() => prisma.project.update({
      where: { id },
      data: {
        currentVersion: newVersionNumber,
        versions: {
          create: {
            version: newVersionNumber,
            code: target.code,
            intent: target.intent as object,
            a11yReport: target.a11yReport as object,
            changeDescription: `Rolled back to v${targetVersion}`,
            linesChanged: 0,
          },
        },
      },
      include: VERSION_INCLUDE,
    }));
    return toProject(row as DbProject);
  } catch (e) {
    if (isTableMissingError(e)) return null;
    throw e;
  }
}

export async function deleteProject(id: string): Promise<boolean> {
  try {
    await withReconnect(() => prisma.project.delete({ where: { id } }));
    return true;
  } catch {
    return false;
  }
}
