import fs from 'fs';
import path from 'path';
import type { UIIntent, A11yReport } from '../validation/schemas';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProjectVersion {
  version: number;
  timestamp: string;
  code: string | Record<string, string>;
  intent: UIIntent;
  a11yReport: A11yReport;
  changeDescription: string;
  linesChanged?: number;
}

export interface Project {
  id: string;
  name: string;
  componentType: 'component' | 'app' | 'webgl';
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

// ─── Constants ────────────────────────────────────────────────────────────────

const PROJECTS_DIR = path.join(process.cwd(), 'data', 'projects');

function ensureProjectsDir() {
  if (!fs.existsSync(PROJECTS_DIR)) {
    fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  }
}

function projectFilePath(id: string) {
  return path.join(PROJECTS_DIR, `${id}.json`);
}

// ─── CRUD Operations ──────────────────────────────────────────────────────────

export function createProject(
  id: string,
  name: string,
  componentType: 'component' | 'app' | 'webgl',
  code: string | Record<string, string>,
  intent: UIIntent,
  a11yReport: A11yReport,
): Project {
  ensureProjectsDir();

  const now = new Date().toISOString();
  const project: Project = {
    id,
    name,
    componentType,
    createdAt: now,
    updatedAt: now,
    currentVersion: 1,
    versions: [
      {
        version: 1,
        timestamp: now,
        code,
        intent,
        a11yReport,
        changeDescription: 'Initial generation',
        linesChanged: typeof code === 'string' ? code.split('\n').length : 0,
      },
    ],
  };

  fs.writeFileSync(projectFilePath(id), JSON.stringify(project, null, 2), 'utf-8');
  return project;
}

export function saveVersion(
  id: string,
  code: string | Record<string, string>,
  intent: UIIntent,
  a11yReport: A11yReport,
  changeDescription: string,
): Project | null {
  ensureProjectsDir();
  const filePath = projectFilePath(id);
  if (!fs.existsSync(filePath)) return null;

  const project: Project = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const newVersionNumber = project.currentVersion + 1;
  const now = new Date().toISOString();

  // Estimate lines changed
  const prevCode = project.versions[project.versions.length - 1]?.code;
  const prevLines = typeof prevCode === 'string' ? prevCode.split('\n').length : 0;
  const newLines = typeof code === 'string' ? code.split('\n').length : 0;
  const linesChanged = Math.abs(newLines - prevLines);

  project.versions.push({
    version: newVersionNumber,
    timestamp: now,
    code,
    intent,
    a11yReport,
    changeDescription,
    linesChanged,
  });
  project.currentVersion = newVersionNumber;
  project.updatedAt = now;

  fs.writeFileSync(filePath, JSON.stringify(project, null, 2), 'utf-8');
  return project;
}

export function getProject(id: string): Project | null {
  ensureProjectsDir();
  const filePath = projectFilePath(id);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

export function listProjects(): ProjectSummary[] {
  ensureProjectsDir();
  try {
    const files = fs.readdirSync(PROJECTS_DIR).filter(f => f.endsWith('.json'));
    return files
      .map(file => {
        try {
          const project: Project = JSON.parse(
            fs.readFileSync(path.join(PROJECTS_DIR, file), 'utf-8'),
          );
          const latest = project.versions[project.versions.length - 1];
          return {
            id: project.id,
            name: project.name,
            componentType: project.componentType,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            currentVersion: project.currentVersion,
            versionCount: project.versions.length,
            latestDescription: latest?.changeDescription || '',
          } satisfies ProjectSummary;
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b!.updatedAt).getTime() - new Date(a!.updatedAt).getTime()) as ProjectSummary[];
  } catch {
    return [];
  }
}

export function rollbackToVersion(id: string, targetVersion: number): Project | null {
  ensureProjectsDir();
  const filePath = projectFilePath(id);
  if (!fs.existsSync(filePath)) return null;

  const project: Project = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const versionEntry = project.versions.find(v => v.version === targetVersion);
  if (!versionEntry) return null;

  const now = new Date().toISOString();
  // Add a new version that is a copy of the rollback target
  const newVersionNumber = project.currentVersion + 1;
  project.versions.push({
    ...versionEntry,
    version: newVersionNumber,
    timestamp: now,
    changeDescription: `Rolled back to v${targetVersion}`,
    linesChanged: 0,
  });
  project.currentVersion = newVersionNumber;
  project.updatedAt = now;

  fs.writeFileSync(filePath, JSON.stringify(project, null, 2), 'utf-8');
  return project;
}

export function deleteProject(id: string): boolean {
  ensureProjectsDir();
  const filePath = projectFilePath(id);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}
