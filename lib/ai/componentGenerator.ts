import { getWorkspaceAdapter, resolveModelName } from './adapters/index';
import { executeToolCalls } from './tools';
import { DEFAULT_AGENT_TOOLS } from './agentTools';
import type { Message } from './adapters/base';

import {
  COMPONENT_GENERATOR_SYSTEM_PROMPT,
  APP_MODE_SYSTEM_PROMPT,
  WEBGL_MODE_SYSTEM_PROMPT,
  buildComponentGeneratorPrompt,
  buildAppModeGeneratorPrompt,
  buildWebglModeGeneratorPrompt,
  REFINEMENT_SYSTEM_PROMPT,
} from './prompts';
import { getRelevantExamples } from './memory';
import { findRelevantKnowledge, findAppTemplate, findWebglTemplate } from './knowledgeBase';
import { type UIIntent } from '../validation/schemas';
import { selectBlueprint, formatBlueprintForPrompt } from '../intelligence/blueprintEngine';
import { applyDesignRules, formatDesignRulesForPrompt } from '../intelligence/designRules';
import { validateGeneratedCode } from '../intelligence/codeValidator';
import { runRepairPipeline } from '../intelligence/repairPipeline';
import { repairGeneratedCode } from './uiReviewer';

// Removed local instantiation - now using getOpenAIClient inside the generator function.

export type GenerationMode = 'component' | 'app' | 'webgl';

export interface GenerationResult {
  success: boolean;
  code?: string;
  error?: string;
  blueprint?: ReturnType<typeof selectBlueprint>;
  validationWarnings?: string[];
  repairsApplied?: string[];
}

// Model name resolution is now handled by adapters/index.ts > resolveModelName

function cleanGeneratedCode(raw: string): string {
  // Try to find a code block first, ignoring any conversational filler.
  const match = raw.match(/```(?:tsx?|jsx?|typescript|javascript)?\s*([\s\S]*?)(?:```|$)/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  
  // Fallback: strip exact fences if no matching pair is found
  return raw
    .replace(/^```(?:tsx?|jsx?|typescript|javascript)?\n?/gim, '')
    .replace(/```\s*$/gim, '')
    .trim();
}

export async function generateComponent(
  intent: UIIntent,
  mode: GenerationMode = 'component',
  requestedModel: string = 'gpt-5.4-mini',
  maxTokens: number = 5000,
  isMultiSlide: boolean = false,
  refinementContext?: { code: string; manifest?: unknown },
  blueprintOverride?: any,
  workspaceId?: string,
  userId?: string
): Promise<GenerationResult> {
  try {
    const searchText = intent.description + ' ' + intent.componentName;

    // ─── Step 0: UI Intelligence — Blueprint + Design Rules ─────────────────
    const blueprint = blueprintOverride || selectBlueprint(searchText);
    const designRules = applyDesignRules(searchText, blueprint.pageType);
    const blueprintContext = formatBlueprintForPrompt(blueprint);
    const designContext = formatDesignRulesForPrompt(designRules);
    const intelligenceContext = `${blueprintContext}\n\n${designContext}`;

    let knowledge: string | null;
    let systemPrompt: string;
    let userPrompt: string;

    if (intent.isRefinement && refinementContext) {
      systemPrompt = REFINEMENT_SYSTEM_PROMPT;
      userPrompt = `TARGET FILE CODE:\n${refinementContext.code}\n\n` +
                   `APP MANIFEST:\n${JSON.stringify(refinementContext.manifest || [], null, 2)}\n\n` +
                   `REFINEMENT INTENT:\n${JSON.stringify(intent, null, 2)}`;
    } else if (mode === 'webgl') {
      knowledge = findWebglTemplate(searchText) ?? findRelevantKnowledge(searchText);
      systemPrompt = WEBGL_MODE_SYSTEM_PROMPT;
      userPrompt = buildWebglModeGeneratorPrompt(intent, knowledge, isMultiSlide) + '\n\n' + intelligenceContext;
    } else if (mode === 'app') {
      knowledge = findAppTemplate(searchText) ?? findRelevantKnowledge(searchText);
      const memory = getRelevantExamples(intent);
      systemPrompt = APP_MODE_SYSTEM_PROMPT;
      userPrompt = buildAppModeGeneratorPrompt(intent, knowledge, memory, isMultiSlide) + '\n\n' + intelligenceContext;
    } else {
      knowledge = findRelevantKnowledge(searchText);
      const memory = getRelevantExamples(intent);
      systemPrompt = COMPONENT_GENERATOR_SYSTEM_PROMPT;
      userPrompt = buildComponentGeneratorPrompt(intent, knowledge, memory, isMultiSlide) + '\n\n' + intelligenceContext;
    }

    const resolvedModel = resolveModelName(requestedModel);
    const adapter = await getWorkspaceAdapter(resolvedModel, workspaceId, userId);

    // ─── Agentic Tool Loop ───────────────────────────────────────────────────
    // The model may call tools (design-system lookup, a11y advisor, etc.)
    // before producing the final code. We allow up to 3 tool-call rounds.
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    let rawContent = '';
    const MAX_TOOL_ROUNDS = 3;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const result = await adapter.generate({
        model: resolvedModel,
        messages,
        temperature: mode === 'app' || mode === 'webgl' ? 0.6 : 0.4,
        maxTokens: maxTokens || 5000,
        tools: DEFAULT_AGENT_TOOLS,
        toolChoice: 'auto',
      });

      if (result.toolCalls && result.toolCalls.length > 0) {
        // Append the assistant's tool-call request
        messages.push({ role: 'assistant', content: result.content || '' });

        // Execute all requested tools in parallel
        const toolResults = await executeToolCalls(result.toolCalls, DEFAULT_AGENT_TOOLS);

        // Append each tool result as a 'user' message (OpenAI-compat: role 'tool')
        // We stringify it into the user turn for maximum provider compatibility
        const toolSummary = toolResults
          .map((r) => `[Tool: ${r.name}]\n${r.content}`)
          .join('\n\n');
        messages.push({ role: 'user', content: `Tool results:\n${toolSummary}\n\nNow generate the final React component code.` });

        // Continue to next round with tool results injected
        continue;
      }

      // No tool calls — model produced final output
      rawContent = result.content;
      break;
    }

    if (!rawContent) {
      rawContent = 'export default function PlaceholderComponent() { return <div>Generation failed</div>; }';
    }

    if (!rawContent) {
      return { success: false, error: 'AI returned empty component code' };
    }

    const cleaned = cleanGeneratedCode(rawContent);

    // Basic sanity check
    if (!cleaned.includes('export') && !cleaned.includes('return')) {
      return {
        success: false,
        error: `Generated code does not appear to be a valid React component. AI Output start: "${cleaned.substring(0, 150)}..."`,
      };
    }

    // ─── Post-Generation: Validate + Auto-Repair ────────────────────────────
    const validation = validateGeneratedCode(cleaned);
    let finalCode = cleaned;
    let repairsApplied: string[] = [];
    const validationWarnings = validation.warnings.map(w => w.message);

    if (!validation.valid) {
      const repairResult = await runRepairPipeline(cleaned, async (code, instructions) => {
        return repairGeneratedCode(code, instructions);
      });
      finalCode = repairResult.code;
      repairsApplied = repairResult.repairsApplied;
    }

    return { success: true, code: finalCode, blueprint, validationWarnings, repairsApplied };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `OpenAI API error: ${msg}` };
  }
}
