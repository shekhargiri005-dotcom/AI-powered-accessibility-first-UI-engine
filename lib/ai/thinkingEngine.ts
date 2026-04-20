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
  "suggestedMode": "component" | "app" | "depth_ui",
  
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
 * Build an intelligent fallback ThinkingPlan from the raw prompt and intent.
 * Uses the blueprint engine + layout registry to extract real structural insights
 * even without an LLM call. Produces prompt-specific analysis, not generic boilerplate.
 */
export function buildFallbackPlan(prompt: string, intentType: IntentType): ThinkingPlan {
  const sanitized = prompt.substring(0, 500);
  const lower = sanitized.toLowerCase();
  const shouldGenerate = ['ui_generation', 'ui_refinement', 'debug_fix'].includes(intentType);
  const isRefinement = intentType === 'ui_refinement';
  const isDebug = intentType === 'debug_fix';
  const isProductReq = intentType === 'product_requirement';
  const isIdeation = intentType === 'ideation';

  // ─── Blueprint + Layout intelligence ─────────────────────────────────────
  const blueprint = selectBlueprint(sanitized);
  const matchedLayouts = findMatchingLayouts(sanitized, 2);
  const primaryLayout = matchedLayouts[0];

  // ─── Derive prompt-specific summary ─────────────────────────────────────
  const layoutLabel = primaryLayout ? primaryLayout.name : 'Custom UI';
  const styleLabel = blueprint.visualStyle;
  let summary: string;
  if (isRefinement) {
    summary = `Refining the existing ${layoutLabel} — ${sanitized.substring(0, 150)}`;
  } else if (isDebug) {
    summary = `Debugging UI issue: ${sanitized.substring(0, 150)}`;
  } else if (isProductReq) {
    summary = `Structuring product requirements for a ${layoutLabel} — ${sanitized.substring(0, 120)}`;
  } else {
    summary = `Building a ${styleLabel} ${layoutLabel} — ${sanitized.substring(0, 120)}`;
  }

  // ─── Extract component name early (needed for scope detection & planned approach) ──
  const componentName = extractComponentName(sanitized);
  
  // ─── Detect component-scope vs app-scope ─────────────────────────────
  // If the prompt describes a single element (card, badge, button, input, etc.)
  // it should NOT get full-app scope even if the blueprint matches "dashboard".
  const singleComponentHints = /\b(?:card|badge|button|input|textarea|chip|tag|avatar|tooltip|alert|stat|metric|toggle|checkbox|radio|slider|progress|calendar|clock|icon|pill|dot|separator|divider|breadcrumb|tab\s*item|nav\s*item|menu\s*item|list\s*item|table\s*row)\b/i;
  const fullAppHints = /\b(?:full\s*app|entire\s*app|complete\s*app|multi\s*page|dashboard\s+app|admin\s+panel|saas\s+tool|layout\s+with\s+sidebar|app\s+with\s+nav|app\s+with\s+routing|multiple\s*screens|multi\s*screen)\b/i;
  const isComponentScope = singleComponentHints.test(sanitized) && !fullAppHints.test(sanitized);

  // ─── Derive prompt-specific planned approach ────────────────────────────
  const plannedApproach: string[] = [];

  if (isDebug) {
    plannedApproach.push(
      'Identify the reported UI issue from the prompt and existing code',
      'Analyse the component structure for layout, state, or styling bugs',
      'Apply targeted fix while preserving existing functionality',
      'Validate the fix renders correctly and meets WCAG AA standards',
    );
  } else if (isRefinement) {
    plannedApproach.push(
      `Analyse the existing ${layoutLabel} and identify what needs to change`,
      'Map the refinement request to specific component modifications',
      'Update styles, layout, and interactions while maintaining structure',
      'Validate the refined UI meets accessibility and visual standards',
    );
  } else if (isComponentScope) {
    // Component-scope: build a single focused component, NOT a full page/layout
    plannedApproach.push(
      `Build a single ${componentName} component with focused structure`,
      `Apply ${styleLabel} visual style with token-based theming`,
      'Generate accessible, production-ready React + Tailwind code (100-350 lines)',
    );
    if (shouldGenerate) {
      plannedApproach.push('Run WCAG 2.1 AA validation and auto-repair if needed');
    }
  } else {
    // ui_generation / product_requirement / ideation — full app scope
    if (primaryLayout) {
      plannedApproach.push(
        `Set up ${layoutLabel} structure with ${blueprint.structuralSections.slice(0, 4).join(', ')}`,
      );
    } else {
      plannedApproach.push('Analyse the request and identify required UI components');
    }

    if (blueprint.requiredComponents.length > 0) {
      plannedApproach.push(
        `Implement required components: ${blueprint.requiredComponents.slice(0, 4).join(', ')}`,
      );
    } else {
      plannedApproach.push('Select appropriate layout and visual components');
    }

    plannedApproach.push(
      `Apply ${styleLabel} visual style with ${blueprint.animationDensity} animations`,
      'Generate accessible, production-ready React + Tailwind code',
    );

    if (shouldGenerate) {
      plannedApproach.push('Run WCAG 2.1 AA validation and auto-repair if needed');
    }
  }

  // ─── Derive affected scope ──────────────────────────────────────────────
  const affectedScope = isRefinement
    ? [`${componentName}.tsx`, 'styles']
    : [`${componentName}.tsx`];

  // ─── Derive clarification opportunities ─────────────────────────────────
  const clarifications: string[] = [];
  if (!lower.includes('color') && !lower.includes('theme') && !lower.includes('dark') && !lower.includes('light')) {
    clarifications.push('Should this use a dark or light theme, or support both?');
  }
  if (lower.includes('dashboard') && !lower.includes('data') && !lower.includes('chart') && !lower.includes('metric')) {
    clarifications.push('What kind of data or metrics should the dashboard display?');
  }
  if (lower.includes('form') && !lower.includes('field') && !lower.includes('input') && !lower.includes('validation')) {
    clarifications.push('What fields should the form include, and what validation rules apply?');
  }
  if (lower.includes('page') && !lower.includes('section') && !lower.includes('layout') && !lower.includes('responsive')) {
    clarifications.push('Should this be a single-page or multi-page layout?');
  }
  if (lower.includes('app') && !lower.includes('navigation') && !lower.includes('sidebar') && !lower.includes('router')) {
    clarifications.push('How should navigation work — sidebar, tabs, or top nav?');
  }
  // Max 3 clarifications
  const clarificationOpportunities = clarifications.slice(0, 3);

  // ─── Derive execution mode ──────────────────────────────────────────────
  const executionModeMap: Record<string, ThinkingPlan['executionMode']> = {
    ui_generation: 'Generate New UI',
    ui_refinement: 'Edit Existing UI',
    product_requirement: 'Structure Requirements',
    ideation: 'Ideation Response',
    debug_fix: 'Debug UI',
    context_clarification: 'Improve Design',
  };

  // ─── Derive expert reasoning ────────────────────────────────────────────
  const purposeMap: Record<string, string> = {
    dashboard: 'Data monitoring and decision-making',
    saas: 'Productivity and workflow management',
    ecommerce: 'Product discovery and purchase',
    auth: 'User authentication and onboarding',
    fintech: 'Financial tracking and transactions',
    social: 'Communication and content sharing',
  };
  const purpose = primaryLayout ? (purposeMap[primaryLayout.category] || `${primaryLayout.name} interface`) : 'General UI Generation';

  const infoDensityMap: Record<string, string> = {
    dashboard: 'Data-heavy',
    analytics: 'Data-heavy',
    admin: 'Data-heavy',
    auth: 'Simple & focused',
    landing: 'Visual & sparse',
    portfolio: 'Visual & sparse',
  };
  const informationDensity = primaryLayout ? (infoDensityMap[primaryLayout.category] || 'Medium') : 'Medium';

  const interactionMap: Record<string, string> = {
    dashboard: 'Click, filter, inspect',
    saas: 'Click, drag, type',
    ecommerce: 'Browse, click, checkout',
    social: 'Scroll, interact, compose',
    auth: 'Type, submit',
  };
  const interactionModel = primaryLayout ? (interactionMap[primaryLayout.category] || 'Standard Web') : 'Standard Web';

  // ─── Build requirement breakdown (only for product_requirement / ideation) ──
  const requirementBreakdown = (isProductReq || isIdeation) ? {
    productSummary: summary,
    coreFeatures: blueprint.structuralSections.slice(0, 5),
    userFlow: [`Open ${componentName}`, ...blueprint.structuralSections.slice(1, 4).map(s => `Interact with ${s}`), 'Complete task'],
    uiSections: blueprint.structuralSections,
    designStyle: styleLabel,
    targetAudience: primaryLayout?.bestFitScenarios[0] || 'General users',
    uxPriorities: ['Accessibility (WCAG 2.1 AA)', 'Responsive design', 'Fast load time'],
    componentSuggestions: [...blueprint.requiredComponents, ...blueprint.suggestedComponents.slice(0, 3)],
  } : undefined;

  return {
    detectedIntent: intentType,
    summary,
    plannedApproach,
    affectedScope,
    clarificationOpportunities,
    executionMode: executionModeMap[intentType] || 'Generate New UI',
    suggestedMode: (() => {
      // Suggest depth_ui for prompts that explicitly request parallax, depth, cinematic, or floating elements
      const depthKeywords = /parallax|depth|cinematic|floating|3d|layered|immersive|scroll.*(animation|effect)|hero.*(section|layout|page)|landing.*(page|site)|premium.*(ui|layout|interface)|visual.*rich/i;
      if (depthKeywords.test(prompt)) return 'depth_ui';
      // Component-scope prompts (single card, badge, etc.) should always be 'component'
      if (isComponentScope) return 'component';
      if (primaryLayout?.category === 'dashboard' || primaryLayout?.category === 'saas') return 'app';
      return 'component';
    })(),
    shouldGenerateCode: shouldGenerate,
    expertReasoning: {
      purpose,
      userType: 'Developer / End User',
      informationDensity,
      interactionModel,
      visualTone: styleLabel.charAt(0).toUpperCase() + styleLabel.slice(1).replace(/-/g, ' '),
      motionStrategy: blueprint.animationDensity.charAt(0).toUpperCase() + blueprint.animationDensity.slice(1),
      renderingStrategy: blueprint.motionLibrary ? `React + Tailwind + ${blueprint.motionLibrary}` : 'React + Tailwind CSS',
      componentArchitecture: blueprint.requiredComponents.length > 0
        ? `Modular: ${blueprint.requiredComponents.slice(0, 3).join(', ')}`
        : 'Modular functional components',
      usabilityCheck: 'Maintain visual hierarchy, spacing rhythm, and 4.5:1 contrast',
    },
    likelySections: isComponentScope
      ? [componentName]
      : (blueprint.structuralSections.length > 0
        ? blueprint.structuralSections
        : ['Header', 'Main Content', 'Footer']),
    requirementBreakdown,
  };
}

/**
 * Extract a PascalCase component name from the user prompt.
 * Looks for quoted names, capitalized words, or falls back to "GeneratedComponent".
 */
function extractComponentName(prompt: string): string {
  // Check for quoted name: 'PulseBoard', "MyApp"
  const quotedMatch = prompt.match(/['"]([A-Z][A-Za-z0-9]+)['"]/);
  if (quotedMatch) return quotedMatch[1];

  // Check for "called X" or "named X" pattern
  const calledMatch = prompt.match(/(?:called|named)\s+([A-Z][A-Za-z0-9]+)/i);
  if (calledMatch) return calledMatch[1];

  // Check for first capitalized word that looks like a name
  const capMatch = prompt.match(/\b([A-Z][a-z]+(?:[A-Z][a-z]+)*)\b/);
  if (capMatch && !['Build', 'Create', 'Design', 'Generate', 'Make', 'Develop', 'Implement'].includes(capMatch[1])) {
    return capMatch[1];
  }

  return 'GeneratedComponent';
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
          maxTokens: 1200,
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
          console.warn(`[thinkingEngine] User's adapter ${provider} failed with connection/rate limit error. Returning fallback plan.`);
          const fallback = buildFallbackPlan(prompt, intentType);
          return { success: true, plan: fallback };
        }

        // Log detailed error information for debugging
        console.error(`[thinkingEngine] Thinking plan generation failed for provider=${providerId}, model=${modelId}:`, {
          error: msg,
          provider: providerId,
          model: modelId,
          workspaceId: wsId,
          hasApiKey: !!process.env[`${providerId.toUpperCase()}_API_KEY`]
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

      // Stage 3: extract first {...} block — use balanced brace matching to avoid
      // matching too much (e.g. LLM explanation text after the JSON)
      if (parsed === undefined) {
        const firstBrace = raw.indexOf('{');
        if (firstBrace !== -1) {
          let depth = 0;
          let endIdx = -1;
          for (let i = firstBrace; i < raw.length; i++) {
            if (raw[i] === '{') depth++;
            else if (raw[i] === '}') {
              depth--;
              if (depth === 0) { endIdx = i + 1; break; }
            }
          }
          if (endIdx !== -1) {
            try { parsed = JSON.parse(raw.substring(firstBrace, endIdx)); } catch { /* fall through */ }
          }
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
        // Stage 5: Strip common LLM preamble (e.g. "Here is the plan:\n")
        // and try balanced brace matching again
        const stripped = raw.replace(/^(?:Here(?:'s| is)|Sure|Below|The|I'll|Let me|Based on)[^\n]*\n*/i, '');
        if (stripped !== raw) {
          const firstBrace = stripped.indexOf('{');
          if (firstBrace !== -1) {
            let depth = 0;
            let endIdx = -1;
            for (let i = firstBrace; i < stripped.length; i++) {
              if (stripped[i] === '{') depth++;
              else if (stripped[i] === '}') {
                depth--;
                if (depth === 0) { endIdx = i + 1; break; }
              }
            }
            if (endIdx !== -1) {
              try { parsed = JSON.parse(stripped.substring(firstBrace, endIdx)); } catch { /* fall through */ }
            }
          }
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
