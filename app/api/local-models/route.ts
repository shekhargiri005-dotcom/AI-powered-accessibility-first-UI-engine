import { NextResponse } from 'next/server';

const LOCAL_RUNTIMES = [
  {
    name: 'Ollama',
    provider: 'ollama',
    baseUrl: 'http://127.0.0.1:11434',
    tagsEndpoint: '/api/tags',
    v1BaseUrl: 'http://127.0.0.1:11434/v1',
  },
  {
    name: 'LM Studio',
    provider: 'lmstudio',
    baseUrl: 'http://127.0.0.1:1234',
    tagsEndpoint: '/v1/models',
    v1BaseUrl: 'http://127.0.0.1:1234/v1',
  },
];

interface DetectedModel {
  id: string;
  label: string;
  size?: string;
  temperature: number;
}

interface DetectedSource {
  name: string;
  provider: string;
  v1BaseUrl: string;
  running: boolean;
  models: DetectedModel[];
}

export async function GET() {
  const sources: DetectedSource[] = [];

  for (const runtime of LOCAL_RUNTIMES) {
    try {
      const res = await fetch(`${runtime.baseUrl}${runtime.tagsEndpoint}`, {
        signal: AbortSignal.timeout(2000),
      });

      if (!res.ok) {
        sources.push({ ...runtime, running: false, models: [] });
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await res.json() as any;

      // Both Ollama (/api/tags) and LM Studio (/v1/models) return a `models` array
      const rawModels: { name?: string; id?: string; size?: number }[] =
        Array.isArray(data.models) ? data.models : (Array.isArray(data.data) ? data.data : []);

      const models: DetectedModel[] = rawModels.map((m) => {
        const rawName = m.name ?? m.id ?? 'unknown';
        return {
          id: rawName,
          label: formatLabel(rawName),
          size: m.size ? formatBytes(m.size) : undefined,
          temperature: guessTemperature(rawName),
        };
      });

      sources.push({ ...runtime, running: true, models });
    } catch {
      sources.push({ ...runtime, running: false, models: [] });
    }
  }

  const anyRunning = sources.some(s => s.running);
  return NextResponse.json({ anyRunning, sources });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatLabel(raw: string): string {
  // "deepseek-coder:6.7b" → "deepseek-coder (6.7b)"
  const [base, tag] = raw.split(':');
  const pretty = base
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return tag ? `${pretty} (${tag})` : pretty;
}

function formatBytes(bytes: number): string {
  if (!bytes) return '';
  const gb = bytes / 1_073_741_824;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / 1_048_576;
  return `${Math.round(mb)} MB`;
}

function guessTemperature(name: string): number {
  const n = name.toLowerCase();
  if (n.includes('coder') || n.includes('code')) return 0.3;
  if (n.includes('instruct') || n.includes('chat'))  return 0.5;
  return 0.6;
}
