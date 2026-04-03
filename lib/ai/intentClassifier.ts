import { DEFAULT_LOCAL_MODEL } from './config';
import { getWorkspaceAdapter, resolveModelName } from './adapters/index';
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

export async function classifyIntent(
  userInput: string,
  hasActiveProject: boolean = false,
  model?: string,
): Promise<ClassificationResult> {
  if (!userInput || userInput.trim().length < 2) {
    return { success: false, error: 'Input too short to classify' };
  }

  const sanitized = userInput.substring(0, 8000).replace(/system:|assistant:|<\|.*?\|>/gi, '').trim();

  const contextHint = hasActiveProject
    ? `\n\nCONTEXT: The user currently has an active project open. Lean towards "ui_refinement" if the input seems like an edit request.`
    : '';

  try {
    const selectedModel = model || process.env.CLASSIFIER_MODEL || (process.env.OPENAI_API_KEY ? 'gpt-4o-mini' : DEFAULT_LOCAL_MODEL);
    const resolvedModel = resolveModelName(selectedModel);
    const adapter = await getWorkspaceAdapter(resolvedModel);

    const adapterResult = await adapter.generate({
      model: resolvedModel,
      messages: [
        { role: 'system', content: CLASSIFIER_SYSTEM_PROMPT },
        { role: 'user', content: `Classify this input:\n\n"${sanitized}"${contextHint}` },
      ],
      responseFormat: 'json_object',
      temperature: 0.1,
      maxTokens: 600,
    });

    const raw = adapterResult.content;
    if (!raw) return { success: false, error: 'Empty response from classifier' };

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { success: false, error: 'Classifier returned malformed JSON' };
    }

    const result = IntentClassificationSchema.safeParse(parsed);
    if (!result.success) {
      return { success: false, error: 'Classification schema validation failed' };
    }

    return { success: true, classification: result.data };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Classifier API error: ${msg}` };
  }
}
