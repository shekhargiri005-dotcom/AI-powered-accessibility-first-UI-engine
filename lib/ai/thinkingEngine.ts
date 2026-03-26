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
  "affectedScope": string[],      // File or component names that may change
  "clarificationOpportunities": string[], // 0-2 optional questions that could improve the output
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
- plannedApproach: Be specific and actionable. e.g. "Analyze the hero section layout and identify spacing issues" NOT "Fix things"
- if intent is "product_requirement" or "ideation", always include requirementBreakdown
- shouldGenerateCode = true ONLY for: ui_generation, ui_refinement, debug_fix
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
        ],
        affectedScope: ['GeneratedComponent.tsx'],
        clarificationOpportunities: [],
        executionMode: intentType === 'ui_refinement' ? 'Edit Existing UI' : 'Generate New UI',
        suggestedMode: 'component',
        shouldGenerateCode: ['ui_generation', 'ui_refinement', 'debug_fix'].includes(intentType),
        expertReasoning: {
          purpose: 'General UI Generation',
          userType: 'General User',
          informationDensity: 'Medium',
          interactionModel: 'Standard Web',
          visualTone: 'Clean',
          motionStrategy: 'Minimal',
          renderingStrategy: 'Tailwind CSS',
          componentArchitecture: 'Modular functional components',
          usabilityCheck: 'Ensure hierarchy and spacing rhythms are maintained'
        },
        likelySections: ['Main Content', 'Header', 'Footer']
      };
      return { success: true, plan: fallback };
    }

    return { success: true, plan: result.data };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Thinking engine API error: ${msg}` };
  }
}
