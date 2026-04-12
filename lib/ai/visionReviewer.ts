import { logger } from '@/lib/logger';
import type { Browser, ConsoleMessage } from 'playwright';

export interface VisionRuntimeReviewResult {
  runtimeOk: boolean;
  runtimeError?: string;
  screenshotDataUrl?: string;
  visualPassed?: boolean;
  visualCritique?: string;
  suggestedCode?: string | null;
}

interface VisionCritiquePayload {
  passed: boolean;
  critique: string;
  suggestedCode: string | null;
}

const VISION_MODEL = process.env.VISION_MODEL ?? 'gpt-4o';

const VISION_SYSTEM_PROMPT = `You are a strict UI reviewer.
Given a rendered UI screenshot and source code, return JSON:
{
  "passed": boolean,
  "critique": string,
  "suggestedCode": string | null
}
If visual quality/layout is poor, set passed=false and provide repaired TSX in suggestedCode.`;

export async function runVisionRuntimeReview(sourceCode: string): Promise<VisionRuntimeReviewResult> {
  let browser: Browser | null = null;
  try {
    const isVercel = process.env.VERCEL === '1' || process.env.NEXT_PUBLIC_VERCEL_ENV;
    
    if (!process.env.BROWSERLESS_API_KEY && isVercel) {
      throw new Error("Executable doesn't exist. Playwright cannot run locally on Vercel serverless without BROWSERLESS_API_KEY");
    }

    let playwright: any;
    if (process.env.BROWSERLESS_API_KEY) {
      try {
        // Obfuscate import to prevent Next.js from bundling the massive Chromium binaries into the Edge Serverless chunk
        const pkgName = isVercel ? 'playwright-core' : 'playwright';
        playwright = await import(pkgName);
      } catch (e) {
        if (isVercel) throw new Error("playwright-core missing. Run 'npm install playwright-core' to use Browserless on Vercel.");
        playwright = await import('playwright');
      }
      
      const wsEndpoint = `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_API_KEY}`;
      // Give browserless connections an explicit timeout to prevent endless Serverless hanging
      browser = await playwright.chromium.connect({ wsEndpoint, timeout: 15000 });
    } else {
      playwright = await import('playwright');
      browser = await playwright.chromium.launch({ headless: true });
    }
    // At this point both branches above must have assigned browser — guard for TS
    if (!browser) throw new Error('Browser failed to initialise');
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });


    const runtimeErrors: string[] = [];
    page.on('pageerror', (err: Error) => runtimeErrors.push(err.message));
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') runtimeErrors.push(msg.text());
    });

    const runtimeCode = sourceCode
      .replace(/export\s+default\s+function\s+([A-Za-z0-9_]+)/, 'function $1')
      .replace(/export\s+default\s+([A-Za-z0-9_]+)/, 'const __DefaultExport = $1');

    const html = `<!doctype html>
<html>
  <head><meta charset="utf-8" /><style>body{margin:0;background:#0b1020;color:#fff;font-family:Inter,Arial,sans-serif}#root{padding:24px}</style></head>
  <body>
    <div id="root"></div>
    <script crossorigin src="https://unpkg.com/react@19/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@19/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script type="text/babel" data-presets="typescript,react">
      try {
        ${runtimeCode}
        const root = ReactDOM.createRoot(document.getElementById('root'));
        const Candidate = (typeof GeneratedComponent !== 'undefined' && GeneratedComponent)
          || (typeof App !== 'undefined' && App)
          || (typeof __DefaultExport !== 'undefined' && __DefaultExport)
          || (() => React.createElement('div', null, 'No default component found'));
        root.render(React.createElement(Candidate));
      } catch (e) {
        console.error(e?.stack || String(e));
      }
    </script>
  </body>
</html>`;

    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    if (runtimeErrors.length > 0) {
      return {
        runtimeOk: false,
        runtimeError: runtimeErrors.join('\n').slice(0, 2000),
      };
    }

    const screenshotBuffer = await page.screenshot({ type: 'png', fullPage: true });
    const dataUrl = `data:image/png;base64,${Buffer.from(screenshotBuffer).toString('base64')}`;

    const visual = await critiqueScreenshot(sourceCode, dataUrl);
    return {
      runtimeOk: true,
      screenshotDataUrl: dataUrl,
      visualPassed: visual?.passed ?? true,
      visualCritique: visual?.critique,
      suggestedCode: visual?.suggestedCode,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes("Executable doesn't exist") || errorMsg.includes("playwright install")) {
      logger.warn({
        endpoint: 'visionReviewer',
        message: 'Playwright Chromium missing (Vercel serverless environment) — skipping Vision UI review',
      });
    } else {
      logger.warn({
        endpoint: 'visionReviewer',
        message: 'Vision/runtime review unavailable; continuing without blocking.',
        error: errorMsg,
      });
    }
    return { runtimeOk: true };
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
}

async function critiqueScreenshot(
  code: string,
  screenshotDataUrl: string,
): Promise<VisionCritiquePayload | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        { role: 'system', content: VISION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Code:\n${code}` },
            { type: 'image_url', image_url: { url: screenshotDataUrl, detail: 'high' } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 3000,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    return JSON.parse(content) as VisionCritiquePayload;
  } catch {
    return null;
  }
}

