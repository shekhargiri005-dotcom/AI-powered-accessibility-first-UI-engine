import OpenAI from 'openai';
import { ThinkingPlanSchema, type ThinkingPlan, type IntentType } from '../validation/schemas';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── System Prompt ────────────────────────────────────────────────────────────

const THINKING_SYSTEM_PROMPT = `You are the Planning Intelligence layer of an AI-powered UI development workspace.

You receive a classified user intent + their raw input and produce a structured thinking plan that will be displayed to the user BEFORE any code is generated.

This plan should feel like an expert engineer and designer explaining their thinking to a collaborator — clear, actionable, and collaborative.

OUTPUT: Return ONLY valid JSON matching this exact schema:
{
  "detectedIntent": "ui_generation" | "ui_refinement" | "product_requirement" | "ideation" | "debug_fix" | "context_clarification",
  "summary": string,              // 2-3 sentences: what the AI understood the user wants
  "plannedApproach": string[],    // 4-6 concrete steps the AI plans to take
  "affectedScope": string[],      // File or component names that may change (e.g. "Dashboard.tsx", "Sidebar.tsx", "Design Tokens")
  "clarificationOpportunities": string[], // 0-2 optional questions that could improve the output
  "executionMode": "Generate New UI" | "Edit Existing UI" | "Structure Requirements" | "Debug UI" | "Improve Design" | "Ideation Response",
  "shouldGenerateCode": boolean,  // true only for ui_generation, ui_refinement, debug_fix
  "suggestedMode": "component" | "app" | "webgl",
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
- plannedApproach: Be specific and actionable. e.g. "Analyze the hero section layout and identify spacing issues" NOT "Fix things"
- affectedScope: For new generations, list the main component file. For refinements, list specific files. For requirements, list suggested component names.
- If intent is "product_requirement" or "ideation", always include requirementBreakdown (never null for those types)
- If intent is "ui_generation" or "ui_refinement" or "debug_fix", set requirementBreakdown to null
- shouldGenerateCode = true ONLY for: ui_generation, ui_refinement, debug_fix
- executionMode mapping: ui_generation→"Generate New UI", ui_refinement→"Edit Existing UI", product_requirement→"Structure Requirements", ideation→"Ideation Response", debug_fix→"Debug UI", context_clarification→"Improve Design"
- No markdown. JSON only.`;

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
): Promise<ThinkingResult> {
  const sanitized = prompt.substring(0, 10000).replace(/system:|assistant:|<\|.*?\|>/gi, '').trim();

  const contextBlock = projectContext
    ? `\n\nPROJECT CONTEXT:\nActive Component: ${projectContext.componentName || 'Unknown'}\nProject Files: ${(projectContext.files || []).join(', ') || 'None listed'}`
    : '';

  const userMessage = `Intent Type: ${intentType}\n\nUser Input:\n"${sanitized}"${contextBlock}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: THINKING_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 1200,
    });

    const raw = response.choices[0]?.message?.content || '';
    if (!raw) return { success: false, error: 'Empty response from thinking engine' };

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { success: false, error: 'Thinking engine returned malformed JSON' };
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
      // Fallback to a safe default plan
      const fallback: ThinkingPlan = {
        detectedIntent: intentType,
        summary: sanitized.substring(0, 200),
        plannedApproach: [
          'Analyze the user request in detail',
          'Identify UI components and layout requirements',
          'Generate accessible, production-ready React code',
          'Validate output for WCAG 2.1 AA compliance',
        ],
        affectedScope: ['GeneratedComponent.tsx'],
        clarificationOpportunities: [],
        executionMode: intentType === 'ui_refinement' ? 'Edit Existing UI' : 'Generate New UI',
        suggestedMode: 'component',
        shouldGenerateCode: ['ui_generation', 'ui_refinement', 'debug_fix'].includes(intentType),
      };
      return { success: true, plan: fallback };
    }

    return { success: true, plan: result.data };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Thinking engine API error: ${msg}` };
  }
}
