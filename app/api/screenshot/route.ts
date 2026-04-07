/**
 * @file app/api/screenshot/route.ts
 *
 * Server-side screenshot using Playwright Chromium.
 *
 * Takes a URL (typically the Sandpack preview frame), navigates to it
 * in a headless browser, waits for the UI to settle, and returns a
 * base64 PNG screenshot as a data URL.
 *
 * This is Option A (Playwright) from the implementation plan — the only
 * reliable way to capture cross-origin iframe content.
 *
 * POST body: { url: string, delayMs?: number, viewportWidth?: number, viewportHeight?: number }
 * Response:  { success: true, dataUrl: string } | { success: false, error: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const maxDuration = 60;

// Playwright is a devDependency — we import dynamically so it doesn't
// bloat the client bundle or cause issues in environments without it.
async function getChromium() {
  try {
    const { chromium } = await import('playwright');
    return chromium;
  } catch {
    throw new Error(
      'Playwright is not installed or not available in this environment. ' +
      'Run: npx playwright install chromium',
    );
  }
}

interface ScreenshotRequestBody {
  url: string;
  delayMs?: number;
  viewportWidth?: number;
  viewportHeight?: number;
}

export async function POST(req: NextRequest) {
  const reqLogger = logger.createRequestLogger('/api/screenshot');
  reqLogger.info('Screenshot request received');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || !('url' in body)) {
    return NextResponse.json({ success: false, error: 'Missing required field: url' }, { status: 400 });
  }

  const {
    url,
    delayMs = 2500,
    viewportWidth = 1280,
    viewportHeight = 800,
  } = body as ScreenshotRequestBody;

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ success: false, error: 'url must be a non-empty string' }, { status: 400 });
  }

  // Security: only allow localhost / Sandpack CDN origins
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid URL format' }, { status: 400 });
  }

  const allowedHosts = [
    'localhost',
    '127.0.0.1',
    'sandpack.codesandbox.io',
    'codesandbox.io',
  ];
  const isAllowed =
    allowedHosts.some((h) => parsedUrl.hostname === h || parsedUrl.hostname.endsWith('.' + h));

  if (!isAllowed) {
    reqLogger.warn('Blocked screenshot of disallowed host', { hostname: parsedUrl.hostname });
    return NextResponse.json(
      { success: false, error: `Screenshot not allowed for host: ${parsedUrl.hostname}` },
      { status: 403 },
    );
  }

  let browser = null;
  try {
    const chromium = await getChromium();
    reqLogger.info('Launching Chromium for screenshot', { url, delayMs, viewportWidth, viewportHeight });

    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setViewportSize({ width: viewportWidth, height: viewportHeight });

    // Navigate and wait for network to be idle
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Extra delay for JS frameworks to finish rendering
    if (delayMs > 0) {
      await page.waitForTimeout(delayMs);
    }

    // Capture screenshot as PNG buffer
    const screenshotBuffer = await page.screenshot({ type: 'png', fullPage: false });
    const base64 = screenshotBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64}`;

    reqLogger.end('Screenshot captured successfully', { byteLength: screenshotBuffer.byteLength });

    return NextResponse.json({ success: true, dataUrl });

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    reqLogger.error('Screenshot failed', err);
    return NextResponse.json(
      { success: false, error: `Screenshot error: ${msg}` },
      { status: 500 },
    );
  } finally {
    if (browser) {
      await browser.close().catch(() => { /* ignore close errors */ });
    }
  }
}
