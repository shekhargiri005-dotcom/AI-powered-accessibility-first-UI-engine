import { getWorkspaceAdapter } from './adapters/index';
import type { ProviderName } from './types';
import { resolveDefaultAdapter } from './resolveDefaultAdapter';
import { IntentClassificationSchema, type IntentClassification } from '../validation/schemas';

// Dynamic client used inside the function.

// ─── System Prompt ────────────────────────────────────────────────────────────

const CLASSIFIER_SYSTEM_PROMPT = `You are an intent classification engine for an AI-powered UI development workspace.

Your ONLY job is to classify the user's raw input into one of the following intent types and return a JSON object.

INTENT TYPES:
- "ui_generation": User explicitly wants UI/screens/code created from scratch. Examples: "Create a SaaS dashboard", "Build a login page", "Generate a button component"
- "ui_refinement": User wants to improve, fix, or edit an EXISTING project/component. Examples: "Make the navbar cleaner", "Fix mobile responsiveness", "Improve the hero section colors"
- "product_requirement": User is DESCRIBING what they want (product/app idea) but NOT explicitly asking for code yet. Examples: "I want a platform where users can upload videos", "This app should help students prepare for exams", "We need a B2B SaaS for inventory management"
- "ideation": User wants design direction, patterns, or strategy advice. Examples: "What UI pattern fits a drone control system?", "How should this dashboard feel?", "What's the best layout for a crypto trading app?"
- "debug_fix": User has a specific broken element to fix. Examples: "The sidebar breaks on mobile", "This component won't render", "Fix the login form validation"
- "context_clarification": User is adding constraints, context, or clarification. Examples: "Make it futuristic but minimal", "This is for enterprise users", "Avoid heavy animations", "The primary color should be indigo"

RULES:
- "shouldGenerateCode" is true ONLY for "ui_generation", "ui_refinement", and "debug_fix" intents
- For "product_requirement", "ideation", "context_clarification" — shouldGenerateCode is false (we need to show the thinking panel first)
- confidence: 0.0-1.0 representing how certain you are
- summary: 1-2 sentences describing what the user wants in plain English
- suggestedMode: "component" for single components, "app" for multi-screen apps, "depth_ui" for parallax/depth/cinematic/landing-page UI
- clarificationQuestion: only set if needsClarification is true

OUTPUT: Return ONLY valid JSON matching this exact schema:
{
  "intentType": string,
  "confidence": number,
  "summary": string,
  "suggestedMode": "component" | "app" | "depth_ui",
  "needsClarification": boolean,
  "clarificationQuestion": string | null,
  "shouldGenerateCode": boolean,
  "purpose": "landing-page" | "dashboard" | "admin-panel" | "saas-tool" | "chat-ui" | "portfolio" | "login-signup" | "onboarding" | "e-commerce" | "education" | "simulation" | "robotics-drone" | "cyber-tactical" | "dev-tool" | "analytics" | "unknown",
  "visualType": "2d-standard" | "aesthetic-motion" | "minimal-futuristic" | "3d-component" | "full-3d" | "physics-based" | "simulation-ui" | "hud-ui" | "cinematic" | "hybrid" | "unknown",
  "complexity": "simple" | "medium" | "advanced" | "system-level",
  "platform": "web" | "mobile" | "tablet" | "desktop" | "responsive",
  "layout": "single-page" | "multi-section" | "split-screen" | "multi-panel" | "dashboard-grid" | "wizard-flow" | "command-workspace" | "immersive-spatial",
  "motionLevel": "none" | "subtle" | "moderate" | "high",
  "preferredStack": ["react", "tailwind", "framer-motion", "threejs", "r3f", "canvas"]
}

TECH STACK SELECTION RULES:
- React + Tailwind: for standard dashboards, forms, admin panels, SaaS layouts, normal landing pages.
- React + Tailwind + framer-motion: for premium landing pages, animated portfolios, polished AI interfaces.
- React + Tailwind + framer-motion + threejs/r3f: for 3D hero sections, futuristic UIs, holographic scenes.

No markdown. No explanation. JSON only.`;

// ─── Classifier Function ─────────────────────────────────────────────────────

export interface ClassificationResult {
  success: boolean;
  classification?: IntentClassification;
  error?: string;
  _fallback?: boolean;
}

/**
 * Build a deterministic local classification when the LLM is rate-limited or unavailable.
 * Uses simple heuristics to determine intent type from the prompt text.
 */
export function buildLocalClassification(prompt: string, hasActiveProject: boolean): IntentClassification {
  const lower = prompt.toLowerCase();
  
  // Detect refinement vs generation
  const refinementKeywords = ['fix', 'change', 'update', 'improve', 'make the', 'adjust', 'modify', 'refine', 'edit', 'remove', 'add a', 'replace'];
  const generationKeywords = ['build', 'create', 'generate', 'design', 'make a', 'develop', 'construct'];
  const isRefinement = hasActiveProject && refinementKeywords.some(k => lower.includes(k));
  const isGeneration = generationKeywords.some(k => lower.includes(k));

  let intentType: string;
  if (isRefinement) {
    intentType = 'ui_refinement';
  } else if (isGeneration || !hasActiveProject) {
    intentType = 'ui_generation';
  } else {
    intentType = 'ui_generation'; // Default to generation
  }

  // Detect single-component vs full-app vs depth prompts
  const singleComponentHints = /\b(?:card|badge|button|input|textarea|chip|tag|avatar|tooltip|alert|stat|metric|toggle|checkbox|radio|slider|progress|calendar|clock|icon|pill|dot|separator|divider|breadcrumb|tab\s*item|nav\s*item|menu\s*item|list\s*item|table\s*row)\b/i;
  const fullAppHints = /\b(?:full\s*app|entire\s*app|complete\s*app|multi\s*page|dashboard\s+app|admin\s+panel|saas\s+tool|layout\s+with\s+sidebar|app\s+with\s+nav|app\s+with\s+routing|multiple\s*screens|multi\s*screen)\b/i;
  const isComponentScope = singleComponentHints.test(prompt) && !fullAppHints.test(prompt);

  const depthIndicators = (lower.match(/\b(parallax|depth|cinematic|floating|layered|immersive|3d|landing\s*page|hero\s*(section|layout))\b/g) || []).length;
  const suggestedMode: 'component' | 'app' | 'depth_ui' =
    depthIndicators >= 2 ? 'depth_ui' :
    isComponentScope ? 'component' :
    (lower.match(/\b(build|create|design|make)\b/g) || []).length >= 2 ? 'app' :
    'component';

  return {
    intentType: intentType as IntentClassification['intentType'],
    confidence: 0.6, // Lower confidence for local fallback
    summary: prompt.substring(0, 150),
    shouldGenerateCode: ['ui_generation', 'ui_refinement', 'debug_fix'].includes(intentType),
    suggestedMode: suggestedMode,
    needsClarification: false,
    clarificationQuestion: undefined,
    purpose: 'unknown',
    visualType: '2d-standard',
    complexity: 'medium',
    platform: 'responsive',
    layout: 'single-page',
    motionLevel: 'subtle',
    preferredStack: ['react', 'tailwind'],
  };
}

export async function classifyIntent(
  userInput: string,
  hasActiveProject: boolean = false,
  provider?: ProviderName,
  model?: string,
  workspaceId?: string,
  userId?: string,
): Promise<ClassificationResult> {
  if (!userInput || userInput.trim().length < 2) {
    return { success: false, error: 'Input too short to classify' };
  }

  const sanitized = userInput.substring(0, 8000).replace(/system:|assistant:|<\|.*?\|>/gi, '').trim();

  const contextHint = hasActiveProject
    ? `\n\nCONTEXT: The user currently has an active project open. Lean towards "ui_refinement" if the input seems like an edit request.`
    : '';

  try {
    // Resolve model and provider
    let modelId: string;
    let providerId: ProviderName;
    let wsId: string;
    let uid: string | undefined;

    console.log('[intentClassifier] Input parameters:', { provider, model, workspaceId, userId });

    if (provider) {
      // Use provided provider (user's selection from UI)
      console.log('[intentClassifier] ✓ Using user-selected provider:', provider);
      providerId = provider;
      modelId = model || 'default'; // Use provided model or let adapter resolve
      wsId = workspaceId || 'default';
      uid = userId;
    } else {
      // Fall back to default adapter resolution
      console.log('[intentClassifier] ⚠ No provider specified, falling back to default');
      const defaultConfig = resolveDefaultAdapter('CLASSIFIER');
      modelId = defaultConfig.model;
      providerId = (defaultConfig.provider || 'openai') as ProviderName;
      wsId = 'default';
    }

    const adapter = await getWorkspaceAdapter(providerId, modelId, wsId, uid);
    
    // Retry loop for 429 Rate Limit errors
    let adapterResult;
    let retries = 0;
    const maxRetries = 2; // Reduced from 3 — classify is lightweight, fail fast
    const baseDelayMs = 1500;

    while (true) {
      try {
        adapterResult = await adapter.generate({
          model: modelId,
          messages: [
            { role: 'system', content: CLASSIFIER_SYSTEM_PROMPT },
            { role: 'user', content: `Classify this input:\n\n"${sanitized}"${contextHint}` },
          ],
          responseFormat: 'json_object',
          temperature: 0.1,
          maxTokens: 800,
        });
        break; // Success
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const isRateLimit = msg.includes('429') || msg.includes('rate_limit') || msg.includes('quota');
        const isNetworkError = isRateLimit || msg.includes('Connection error') || msg.includes('fetch failed') || msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT') || msg.includes('502') || msg.includes('503') || msg.includes('504') || msg.includes('timeout');
        
        if (isNetworkError && retries < maxRetries) {
          retries++;
          console.warn(`[intentClassifier] Network/Rate limit error. Retrying (${retries}/${maxRetries}) in ${baseDelayMs * Math.pow(2, retries - 1)}ms: ${msg}`);
          await new Promise(res => setTimeout(res, baseDelayMs * Math.pow(2, retries - 1)));
          continue;
        }

        if (isRateLimit) {
          // Rate limit exhausted — return a smart local fallback instead of failing the pipeline
          console.warn(`[intentClassifier] Provider ${provider} rate limited. Returning local classification fallback.`);
          const localResult = buildLocalClassification(sanitized, hasActiveProject);
          return { success: true, classification: localResult, _fallback: true };
        }

        if (isNetworkError) {
          console.warn(`[intentClassifier] User's adapter ${provider} failed with connection error after retries.`);
          const localResult = buildLocalClassification(sanitized, hasActiveProject);
          return { success: true, classification: localResult, _fallback: true };
        }

        // Log detailed error information for debugging
        console.error(`[intentClassifier] Classification failed for provider=${providerId}, model=${modelId}:`, {
          error: msg,
          provider: providerId,
          model: modelId,
          workspaceId: wsId,
          hasApiKey: !!process.env[`${providerId.toUpperCase()}_API_KEY`]
        });

        throw error; // Rethrow if not a transient network error or out of retries
      }
    }

    const raw = adapterResult.content;
    if (!raw) return { success: false, error: 'Empty response from classifier' };

    let parsed: unknown;
    try {
      let cleanRaw = raw.trim();
      const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        cleanRaw = match[1].trim();
      } else {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start !== -1 && end !== -1 && start < end) {
          cleanRaw = raw.substring(start, end + 1);
        }
      }
      parsed = JSON.parse(cleanRaw);
    } catch {
      return { success: false, error: 'Classifier returned malformed JSON' };
    }

    const result = IntentClassificationSchema.safeParse(parsed);
    if (!result.success) {
      // Local models (deepseek-coder, mistral:7b, etc.) sometimes return null for optional
      // fields. Attempt a coerced re-parse by normalising null → undefined on known fields.
      const p = parsed as Record<string, unknown>;
      if (p.clarificationQuestion === null) delete p.clarificationQuestion;

      const retried = IntentClassificationSchema.safeParse(p);
      if (retried.success) {
        return { success: true, classification: retried.data };
      }

      const issues = retried.error ? retried.error.issues.map(i => i.message).join(', ') : 'Validation failed';
      return { success: false, error: `Classifier output failed schema validation: ${issues}` };
    }

    return { success: true, classification: result.data };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Classifier API error: ${msg}` };
  }
}
