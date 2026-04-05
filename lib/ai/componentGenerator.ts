/**
 * @file lib/ai/componentGenerator.ts
 *
 * Core AI generation orchestrator.
 *
 * Enhancement: Now model-agnostic via:
 *  - modelRegistry   → capability profile per model
 *  - tieredPipeline  → pipeline config (temperature, tool rounds, token budget)
 *  - promptBuilder   → model-aware prompt (fill-in-blank / structured / freeform)
 *  - codeExtractor   → multi-strategy extraction (fence / heuristic / aggressive)
 *  - codeBeautifier  → deterministic post-processing (all models)
 *
 * All call sites are unchanged — function signature is identical.
 */

import { getWorkspaceAdapter } from './adapters/index';
import type { AdapterConfig } from './adapters/index';
import { resolveDefaultAdapter } from './resolveDefaultAdapter';
import { executeToolCalls } from './tools';
import { DEFAULT_AGENT_TOOLS } from './agentTools';
import type { Message } from './adapters/base';

import { getRelevantExamples } from './memory';
import { findRelevantKnowledge, findAppTemplate, findWebglTemplate } from './knowledgeBase';
import { type UIIntent } from '../validation/schemas';
import { selectBlueprint, formatBlueprintForPrompt } from '../intelligence/blueprintEngine';
import { applyDesignRules, formatDesignRulesForPrompt } from '../intelligence/designRules';
import { validateGeneratedCode } from '../intelligence/codeValidator';
import { runRepairPipeline } from '../intelligence/repairPipeline';
import { repairGeneratedCode } from './uiReviewer';

// ── New: model-agnostic layer ─────────────────────────────────────────────────
import { getModelProfile, getCloudFallbackProfile } from './modelRegistry';
import { getPipelineConfig } from './tieredPipeline';
import { buildModelAwarePrompt, mergeSystemIntoUser } from './promptBuilder';
import { extractCode, isCompleteComponent } from './codeExtractor';
import { beautifyOutput } from '../intelligence/codeBeautifier';

export type GenerationMode = 'component' | 'app' | 'webgl';

export interface GenerationResult {
  success: boolean;
  code?: string;
  error?: string;
  blueprint?: ReturnType<typeof selectBlueprint>;
  validationWarnings?: string[];
  repairsApplied?: string[];
  /** NEW: model tier used for this generation (for telemetry/debugging) */
  modelTier?: string;
  /** NEW: beautifier transformations applied */
  beautifyTransformations?: string[];
}

export async function generateComponent(
  intent: UIIntent,
  mode: GenerationMode = 'component',
  requestedModel: string = '',
  maxTokens: number = 5000,
  isMultiSlide: boolean = false,
  refinementContext?: { code: string; manifest?: unknown },
  /** Pass a pre-selected blueprint to skip automatic selection. */
  blueprintOverride?: ReturnType<typeof selectBlueprint>,
  workspaceId?: string,
  userId?: string,
  provider?: string,
  apiKey?: string,
  baseUrl?: string,
): Promise<GenerationResult> {
  try {
    const searchText = intent.description + ' ' + intent.componentName;

    // ─── Step 0: UI Intelligence — Blueprint + Design Rules ─────────────────
    const blueprint = blueprintOverride || selectBlueprint(searchText);
    const designRules = applyDesignRules(searchText, blueprint.pageType);
    const blueprintContext = formatBlueprintForPrompt(blueprint);
    const designContext = formatDesignRulesForPrompt(designRules);
    // intelligenceContext is used by cloud/freeform paths that append to prompt
    const intelligenceContext = `${blueprintContext}\n\n${designContext}`;

    // ─── Step 1: Resolve model + credentials ─────────────────────────────────
    let cfg: AdapterConfig;
    if (requestedModel) {
      cfg = {
        model:   requestedModel,
        provider,
        apiKey:  apiKey && apiKey !== '••••' ? apiKey : undefined,
        baseUrl,
      };
    } else {
      cfg = resolveDefaultAdapter('GENERATION');
    }

    // ─── Step 2: Get model profile + pipeline config ──────────────────────────
    const effectiveModel = cfg.model;
    const modelProfile = getModelProfile(effectiveModel) ?? getCloudFallbackProfile();
    const pipelineConfig = getPipelineConfig(modelProfile);

    // ─── Step 3: Knowledge + memory lookup ───────────────────────────────────
    let knowledge: string | null = null;
    let memory = getRelevantExamples(intent);

    if (!intent.isRefinement) {
      if (mode === 'webgl') {
        knowledge = findWebglTemplate(searchText) ?? findRelevantKnowledge(searchText);
      } else if (mode === 'app') {
        knowledge = findAppTemplate(searchText) ?? findRelevantKnowledge(searchText);
      } else {
        knowledge = findRelevantKnowledge(searchText);
      }
    }

    // ─── Step 4: Build model-aware prompt ────────────────────────────────────
    let builtPrompt = buildModelAwarePrompt(
      intent,
      blueprint,
      pipelineConfig,
      mode,
      knowledge,
      memory,
      refinementContext,
    );

    // For cloud/freeform modes: append intelligence context to user prompt
    // (tiny/small models have the blueprint baked into their structured prompts)
    if (pipelineConfig.promptStyle === 'freeform' || pipelineConfig.promptStyle === 'guided-freeform') {
      builtPrompt = {
        system: builtPrompt.system,
        user: builtPrompt.user + '\n\n' + intelligenceContext,
      };
    }

    // If model doesn't honour system role: merge system into user message
    if (pipelineConfig.mergeSystemIntoUser) {
      builtPrompt = mergeSystemIntoUser(builtPrompt);
    }

    // ─── Step 5: Get adapter ─────────────────────────────────────────────────
    const adapter = await getWorkspaceAdapter(cfg, workspaceId, userId);

    // ─── Step 6: Agentic Tool Loop ───────────────────────────────────────────
    // Respects maxToolRounds from pipeline config (0 for tiny/small, up to 3 for cloud)
    const messages: Message[] = builtPrompt.system
      ? [
          { role: 'system', content: builtPrompt.system },
          { role: 'user', content: builtPrompt.user },
        ]
      : [{ role: 'user', content: builtPrompt.user }];

    let rawContent = '';
    const maxToolRounds = pipelineConfig.maxToolRounds;

    for (let round = 0; round <= maxToolRounds; round++) {
      const result = await adapter.generate({
        model: effectiveModel,
        messages,
        temperature: pipelineConfig.temperature,
        maxTokens: Math.min(maxTokens || 5000, pipelineConfig.maxOutputTokens),
        // Only pass tools if the model supports tool calls
        ...(pipelineConfig.maxToolRounds > 0 && {
          tools: DEFAULT_AGENT_TOOLS,
          toolChoice: 'auto' as const,
        }),
      });

      if (result.toolCalls && result.toolCalls.length > 0 && round < maxToolRounds) {
        // Append the assistant's tool-call request
        messages.push({ role: 'assistant', content: result.content || '' });

        // Execute all requested tools in parallel
        const toolResults = await executeToolCalls(result.toolCalls, DEFAULT_AGENT_TOOLS);

        const toolSummary = toolResults
          .map((r) => `[Tool: ${r.name}]\n${r.content}`)
          .join('\n\n');
        messages.push({
          role: 'user',
          content: `Tool results:\n${toolSummary}\n\nNow generate the final React component code.`,
        });

        continue;
      }

      // No tool calls — model produced final output
      rawContent = result.content;
      break;
    }

    // If all rounds exhausted without output
    if (!rawContent) {
      return { success: false, error: 'AI returned empty component code after all tool-call rounds', modelTier: modelProfile.tier };
    }

    // ─── Step 7: Extract code (model-aware strategy) ──────────────────────────
    const extraction = extractCode(rawContent, pipelineConfig.extractionStrategy);
    const cleaned = extraction.code;

    // Basic sanity check
    if (!cleaned || (!cleaned.includes('export') && !cleaned.includes('return'))) {
      return {
        success: false,
        error: `Generated code does not appear to be a valid React component (extraction confidence: ${extraction.confidence}). Output start: "${cleaned?.substring(0, 150) ?? '(empty)'}..."`,
        modelTier: modelProfile.tier,
      };
    }

    // Log low-confidence extractions for monitoring
    if (extraction.confidence === 'low') {
      // Non-blocking — just annotate in the result
    }

    // Check for completeness (missing closing braces / export)
    const complete = isCompleteComponent(cleaned);

    // ─── Step 8: Post-Generation Beautifier (all models) ─────────────────────
    const beautified = beautifyOutput(cleaned, blueprint);

    // ─── Step 9: Validate + Auto-Repair ──────────────────────────────────────
    const validation = validateGeneratedCode(beautified.code);
    let finalCode = beautified.code;
    let repairsApplied: string[] = [];
    const validationWarnings = validation.warnings.map((w) => w.message);

    if (!validation.valid) {
      // Determine repair capability:
      // - Cloud models and 'large' tier → rules-only (no LLM repair)
      // - Tiny/small with ai-cheap → use LLM repair
      const canUseAiRepair =
        pipelineConfig.repairStrategy === 'ai-cheap' ||
        pipelineConfig.repairStrategy === 'ai-strong';

      const repairResult = await runRepairPipeline(
        beautified.code,
        canUseAiRepair
          ? async (code: string, instructions: string) => repairGeneratedCode(code, instructions)
          : undefined,
      );
      finalCode = repairResult.code;
      repairsApplied = repairResult.repairsApplied;
    }

    // If component is incomplete (e.g. truncated by tiny model), note it
    if (!complete && !repairsApplied.length) {
      validationWarnings.push('Component may be incomplete — check closing tags and export');
    }

    return {
      success: true,
      code: finalCode,
      blueprint,
      validationWarnings,
      repairsApplied,
      modelTier: modelProfile.tier,
      beautifyTransformations: beautified.transformations,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `AI generation error: ${msg}` };
  }
}
