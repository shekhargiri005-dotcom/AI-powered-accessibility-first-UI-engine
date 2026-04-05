import { NextResponse } from 'next/server';

const OLLAMA_BASE = 'http://127.0.0.1:11434';

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

interface OllamaTagsResponse {
  models: OllamaModel[];
}

export async function GET() {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      method: 'GET',
      // Short timeout — if Ollama isn't running we want to fail fast
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      return NextResponse.json({ running: false, models: [] });
    }

    const data: OllamaTagsResponse = await res.json();

    const models = (data.models ?? []).map((m) => ({
      id: m.name,                         // e.g. "deepseek-coder:6.7b"
      label: formatModelLabel(m.name),    // e.g. "DeepSeek-Coder 6.7B"
      size: formatBytes(m.size),          // e.g. "3.8 GB"
      temperature: defaultTemp(m.name),
    }));

    return NextResponse.json({ running: true, models });
  } catch {
    // Ollama not running or unreachable
    return NextResponse.json({ running: false, models: [] });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatModelLabel(name: string): string {
  // "deepseek-coder:6.7b" → "DeepSeek-Coder 6.7B"
  const [base, tag] = name.split(':');
  const pretty = base
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return tag ? `${pretty} (${tag.toUpperCase()})` : pretty;
}

function formatBytes(bytes: number): string {
  if (!bytes) return '';
  const gb = bytes / 1_073_741_824;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / 1_048_576;
  return `${mb.toFixed(0)} MB`;
}

function defaultTemp(name: string): number {
  const n = name.toLowerCase();
  if (n.includes('coder') || n.includes('code')) return 0.4;
  if (n.includes('instruct'))                     return 0.5;
  return 0.6;
}
