import { getWorkspaceAdapter } from './adapters/index';
import type { ProviderName } from './types';
import { resolveDefaultAdapter } from './resolveDefaultAdapter';
import { getModelProfile } from './modelRegistry';
import { ThinkingPlanSchema, type ThinkingPlan, type IntentType } from '../validation/schemas';
import { findMatchingLayouts } from '../intelligence/layoutRegistry';
import { selectBlueprint } from '../intelligence/blueprintEngine';

// Removed static instance. Using getOpenAIClient inside the engine function.

// ─── System Prompt ────────────────────────────────────────────────────────────

const THINKING_SYSTEM_PROMPT = `You are the Planning Intelligence layer of an AI-powered UI development workspace.

You receive a classified user intent + their raw input and produce a structured thinking plan that will be displayed to the user BEFORE any code is generated.

This plan should feel like an expert engineer and designer explaining their thinking to a collaborator — clear, actionable, and collaborative.

OUTPUT: Return ONLY valid JSON matching this exact schema:
{
  "detectedIntent": "ui_generation" | "ui_refinement" | "product_requirement" | "ideation" | "debug_fix" | "context_clarification",
  "summary": string,              // 2-3 sentences: what the AI understood the user wants
  "plannedApproach": string[],    // 4-6 concrete steps the AI plans to take
  "affectedScope": string[],      // File or component names that may change
  "clarificationOpportunities": string[], // 1-3 critical questions to ask the user for further rectification or missing details
  "executionMode": "Generate New UI" | "Edit Existing UI" | "Structure Requirements" | "Debug UI" | "Improve Design" | "Ideation Response",
  "shouldGenerateCode": boolean,  // true only for ui_generation, ui_refinement, debug_fix
  "suggestedMode": "component" | "app" | "webgl",
  
  // NEW: Expert UI Thinking Framework
  "expertReasoning": {
    "purpose": string, // What is the user trying to achieve? Product page, tool, system console?
    "userType": string, // Who is the end user?
    "informationDensity": string, // Simple, focused, data-heavy?
    "interactionModel": string, // Click, drag, inspect, chat, monitor?
    "visualTone": string, // Clean, premium, futuristic, tactical, cinematic?
    "motionStrategy": string, // Minimal, elegant, physics-based, dramatic?
    "renderingStrategy": string, // Tailwind? Framer Motion? Three.js?
    "componentArchitecture": string, // What reusable sections are needed?
    "usabilityCheck": string // Is this still usable? Too decorative?
  },
  
  // NEW: Prompt Understanding Enrichment
  "likelySections": string[], // Array of inferred missing but necessary structure (e.g., ["telemetry panel", "live camera feed", "map"])
  
  "requirementBreakdown": {       // ONLY include if intent is "product_requirement" or "ideation"
    "productSummary": string,
    "coreFeatures": string[],
    "userFlow": string[],
    "uiSections": string[],
    "designStyle": string,
    "targetAudience": string,
    "uxPriorities": string[],
    "componentSuggestions": string[]
  } | null
}

RULES:
- You must perform deep Prompt Understanding Enrichment. Infer missing structure like an expert would.
- If the user's prompt is vague, lacks specific styling details, or omits crucial functional requirements, you MUST ask for further rectification by providing 1-3 targeted questions in \`clarificationOpportunities\`.
- plannedApproach: Be specific and actionable. e.g. "Analyze the hero section layout and identify spacing issues" NOT "Fix things"
- if intent is "product_requirement" or "ideation", always include requirementBreakdown
- shouldGenerateCode = true ONLY for: ui_generation, ui_refinement, debug_fix
- No markdown. JSON only.`;

// ─── JSON Repair Utility ──────────────────────────────────────────────────────

/**
 * Attempt to repair truncated JSON by closing unclosed braces, brackets, and strings.
 *
 * deepseek-coder (and other local models with small maxTokens budgets) often generate
 * valid JSON that is simply cut off before the final closing characters — e.g.:
 *   { "summary": "...", "plannedApproach": ["step 1", "step 2
 *
 * This function:
 * 1. Strips any trailing comma before an incomplete value
 * 2. Closes unclosed string literals
 * 3. Closes unclosed [ and { pairs in reverse order
 *
 * It does NOT attempt to reconstruct missing values — truncated values are left empty.
 */
function repairTruncatedJson(raw: string): string {
  // Remove trailing partial tokens (comma, colon, partial key) before we close
  let s = raw.trimEnd();

  // Strip trailing comma (last char before whitespace)
  s = s.replace(/,\s*$/, '');

  // Track open delimiters using a stack
  const stack: Array<'{' | '['> = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') stack.push('{');
    else if (ch === '[') stack.push('[');
    else if (ch === '}' || ch === ']') stack.pop();
  }

  // Close any unclosed string
  if (inString) s += '"';

  // Close unclosed containers in reverse order
  while (stack.length > 0) {
    s += stack.pop() === '{' ? '}' : ']';
  }

  return s;
}

// ─── Fallback Plan Builder ───────────────────────────────────────────────────

/**
 * Build a deterministic fallback ThinkingPlan from the raw prompt and intent.
 * Used when the AI model fails to produce valid JSON (local models, timeouts).
 * Never calls an LLM — instant and always succeeds.
 */
export function buildFallbackPlan(prompt: string, intentType: IntentType): ThinkingPlan {
  const blueprint = selectBlueprint(prompt.substring(0, 500));
  const shouldGenerate = ['ui_generation', 'ui_refinement', 'debug_fix'].includes(intentType);
  const executionMode = intentType === 'ui_refinement' ? 'Edit Existing UI' : 'Generate New UI';

  return {
    detectedIntent: intentType,
    summary: prompt.substring(0, 200),
    plannedApproach: [
      'Analyse the request and identify required UI components',
      'Select an appropriate layout and visual style',
      'Generate accessible, production-ready React + Tailwind code',
      'Run validation and auto-repair if needed',
    ],
    affectedScope: ['GeneratedComponent.tsx'],
    clarificationOpportunities: [],
    executionMode: executionMode as ThinkingPlan['executionMode'],
    suggestedMode: 'component',
    shouldGenerateCode: shouldGenerate,
    expertReasoning: {
      purpose: 'General UI Generation',
      userType: 'Developer',
      informationDensity: 'Medium',
      interactionModel: 'Standard Web',
      visualTone: 'Clean & Modern',
      motionStrategy: 'Subtle',
      renderingStrategy: 'React + Tailwind CSS',
      componentArchitecture: 'Modular functional components',
      usabilityCheck: 'Maintain visual hierarchy and spacing rhythm',
    },
    likelySections: blueprint.structuralSections.length > 0
      ? blueprint.structuralSections
      : ['Header', 'Main Content', 'Footer'],
  };
}

// ─── Thinking Engine Function ─────────────────────────────────────────────────

export interface ThinkingResult {
  success: boolean;
  plan?: ThinkingPlan;
  error?: string;
}

export async function generateThinkingPlan(
  prompt: string,
  intentType: IntentType,
  projectContext?: { componentName?: string; files?: string[] },
  provider?: ProviderName,
  model?: string,
  workspaceId?: string,
  userId?: string,
): Promise<ThinkingResult> {
  const sanitized = prompt.substring(0, 10000).replace(/system:|assistant:|<\|.*?\|>/gi, '').trim();

  // ─── Blueprint pre-enrichment ───────────────────────────────────────────────
  const blueprint = selectBlueprint(sanitized);
  const matchedLayouts = findMatchingLayouts(sanitized, 2);
  const blueprintHint = matchedLayouts.length > 0
    ? `\n\nUI INTELLIGENCE HINT:\nDetected layout: ${blueprint.layoutName}\nStructural sections: ${blueprint.structuralSections.join(', ')}\nVisual style: ${blueprint.visualStyle}\nAnimation level: ${blueprint.animationDensity}`
    : '';

  const contextBlock = projectContext
    ? `\n\nPROJECT CONTEXT:\nActive Component: ${projectContext.componentName || 'Unknown'}\nProject Files: ${(projectContext.files || []).join(', ') || 'None listed'}`
    : '';

  const userMessage = `Intent Type: ${intentType}\n\nUser Input:\n"${sanitized}"${contextBlock}${blueprintHint}`;

  try {
    // Resolve model and provider
    let modelId: string;
    let providerId: ProviderName;
    let wsId: string;
    let uid: string | undefined;

    if (provider) {
      // Use provided provider (user's selection from UI)
      providerId = provider;
      modelId = model || 'default'; // Use provided model or let adapter resolve
      wsId = workspaceId || 'default';
      uid = userId;
    } else {
      const envModel = process.env.THINKING_MODEL;
      if (!envModel) {
        // No model configured — return a deterministic fallback immediately.
        // The thinking panel is non-blocking; the user can still proceed.
        return { success: true, plan: buildFallbackPlan(sanitized, intentType) };
      }
      const defaultConfig = resolveDefaultAdapter('THINKING');
      modelId = defaultConfig.model;
      providerId = (defaultConfig.provider || 'openai') as ProviderName;
      wsId = 'default';
    }

    const adapter = await getWorkspaceAdapter(providerId, modelId, wsId, uid);

    // Gate JSON mode on model capability (same as intentParser)
    const modelProfile = getModelProfile(modelId);
    const useJsonMode = modelProfile?.supportsJsonMode !== false;

    // Retry loop for 429 and network errors
    let result2;
    let retries = 0;
    const maxRetries = 3;
    const baseDelayMs = 1000;
    const requestTimeout = 30000; // 30 second timeout for thinking requests

    while (true) {
      try {
        result2 = await adapter.generate({
          model: modelId,
          messages: [
            { role: 'system', content: THINKING_SYSTEM_PROMPT },
            { role: 'user', content: userMessage },
          ],
          ...(useJsonMode ? { responseFormat: 'json_object' as const } : {}),
          temperature: 0.3,
          maxTokens: 800,
        });
        break; // Success
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const isNetworkError = msg.includes('429') || msg.includes('Connection error') || msg.includes('fetch failed') || msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT') || msg.includes('502') || msg.includes('503') || msg.includes('504') || msg.includes('timeout');
        
        if (isNetworkError && retries < maxRetries) {
          retries++;
          console.warn(`[thinkingEngine] Network/Rate limit error. Retrying (${retries}/${maxRetries}) in ${baseDelayMs * Math.pow(2, retries - 1)}ms: ${msg}`);
          await new Promise(res => setTimeout(res, baseDelayMs * Math.pow(2, retries - 1)));
          continue;
        }

        if (isNetworkError && provider) {
          console.warn(`[thinkingEngine] User's adapter ${provider} failed with connection/rate limit error. Gracefully falling back to server default adapter.`);
          // Recursive call without provider/model to force resolveDefaultAdapter
          return generateThinkingPlan(prompt, intentType, projectContext, undefined, undefined, workspaceId, userId);
        }

        // Log detailed error information for debugging
        console.error(`[thinkingEngine] Thinking plan generation failed for provider=${providerId}, model=${modelId}:`, {
          error: msg,
          provider: providerId,
          model: modelId,
          workspaceId: wsId,
          hasApiKey: !!process.env[`${providerId.toUpperCase()}_API_KEY`] || !!process.env.LLM_KEY
        });

        throw error;
      }
    }

    const raw = result2.content;
    if (!raw) return { success: false, error: 'Empty response from thinking engine' };

    let parsed: unknown;

    // ── JSON extraction: 4-stage fallback for local models ─────────────────
    // Stage 1: direct parse (cloud models return clean JSON)
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Stage 2: extract from markdown fences (deepseek-coder wraps in ```json```)
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fenceMatch?.[1]) {
        try { parsed = JSON.parse(fenceMatch[1].trim()); } catch { /* fall through */ }
      }

      // Stage 3: extract first {...} block
      if (parsed === undefined) {
        const braceMatch = raw.match(/\{[\s\S]*\}/);
        if (braceMatch) {
          try { parsed = JSON.parse(braceMatch[0]); } catch { /* fall through */ }
        }
      }

      // Stage 4: repair truncated JSON — deepseek-coder stops mid-generation before
      // closing all brackets. Count unclosed delimiters and append them.
      if (parsed === undefined) {
        const candidate = raw.includes('{') ? raw.slice(raw.indexOf('{')) : raw;
        const repaired = repairTruncatedJson(candidate);
        if (repaired !== candidate) {
          try { parsed = JSON.parse(repaired); } catch { /* fall through */ }
        }
      }

      if (parsed === undefined) {
        // All stages failed — log raw output for diagnosis
        console.warn(
          `[ThinkingEngine] All JSON extraction stages failed for ${modelId}. ` +
          `Raw output (first 500 chars): ${raw.substring(0, 500)}`
        );
        return { success: false, error: 'Thinking engine returned malformed JSON' };
      }
    }

    // Handle null requirementBreakdown explicitly
    if (parsed && typeof parsed === 'object' && 'requirementBreakdown' in parsed) {
      const p = parsed as Record<string, unknown>;
      if (p.requirementBreakdown === null) {
        delete p.requirementBreakdown;
      }
    }

    const result = ThinkingPlanSchema.safeParse(parsed);
    if (!result.success) {
      // Schema validation failed — fall back to deterministic plan.
      return { success: true, plan: buildFallbackPlan(sanitized, intentType) };
    }

    return { success: true, plan: result.data };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Thinking engine API error: ${msg}` };
  }
}
