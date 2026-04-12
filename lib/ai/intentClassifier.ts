import { getWorkspaceAdapter } from './adapters/index';
import type { AdapterConfig } from './adapters/index';
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
- suggestedMode: "component" for single components, "app" for multi-screen apps, "webgl" for 3D scenes
- clarificationQuestion: only set if needsClarification is true

OUTPUT: Return ONLY valid JSON matching this exact schema:
{
  "intentType": string,
  "confidence": number,
  "summary": string,
  "suggestedMode": "component" | "app" | "webgl",
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
}

export interface AICallConfig {
  model: string;
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
}

export async function classifyIntent(
  userInput: string,
  hasActiveProject: boolean = false,
  modelConfig?: string | AICallConfig,
): Promise<ClassificationResult> {
  if (!userInput || userInput.trim().length < 2) {
    return { success: false, error: 'Input too short to classify' };
  }

  const sanitized = userInput.substring(0, 8000).replace(/system:|assistant:|<\|.*?\|>/gi, '').trim();

  const contextHint = hasActiveProject
    ? `\n\nCONTEXT: The user currently has an active project open. Lean towards "ui_refinement" if the input seems like an edit request.`
    : '';

  try {
    // Build adapter config from whatever the caller provides
    let adapterConfig: AdapterConfig;
    if (!modelConfig) {
      // No model configured by user.
      // delegate to resolveDefaultAdapter which checks generic DEFAULT_MODEL and fallback env keys
      adapterConfig = resolveDefaultAdapter('CLASSIFIER');
    } else if (typeof modelConfig === 'string') {
      adapterConfig = { model: modelConfig };
    } else {
      adapterConfig = {
        model: modelConfig.model,
        provider: modelConfig.provider,
        apiKey: modelConfig.apiKey,
        baseUrl: modelConfig.baseUrl,
      };
    }

    const adapter = await getWorkspaceAdapter(adapterConfig);
    
    // Retry loop for 429 Rate Limit errors
    let adapterResult;
    let retries = 0;
    const maxRetries = 3;
    const baseDelayMs = 1000;

    while (true) {
      try {
        adapterResult = await adapter.generate({
          model: adapterConfig.model,
          messages: [
            { role: 'system', content: CLASSIFIER_SYSTEM_PROMPT },
            { role: 'user', content: `Classify this input:\n\n"${sanitized}"${contextHint}` },
          ],
          responseFormat: 'json_object',
          temperature: 0.1,
          maxTokens: 600,
        });
        break; // Success
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('429') && retries < maxRetries) {
          retries++;
          console.warn(`[intentClassifier] 429 Rate Limit hit. Retrying (${retries}/${maxRetries}) in ${baseDelayMs * Math.pow(2, retries - 1)}ms...`);
          await new Promise(res => setTimeout(res, baseDelayMs * Math.pow(2, retries - 1)));
          continue;
        }
        throw error; // Rethrow if not a 429 or out of retries
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
