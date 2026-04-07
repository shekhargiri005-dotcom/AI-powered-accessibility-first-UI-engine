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
import { enrichPromptWithFeedback } from './feedbackProcessor';

export type GenerationMode = 'component' | 'app' | 'webgl';

export interface GenerationResult {
  success: boolean;
  code?: string;
  error?: string;
  blueprint?: ReturnType<typeof selectBlueprint>;
  validationWarnings?: string[];
  repairsApplied?: string[];
  /** Model tier used for this generation (for telemetry/debugging) */
  modelTier?: string;
  /** Beautifier transformations applied */
  beautifyTransformations?: string[];
  /** True when feedback history enriched the system prompt */
  feedbackEnriched?: boolean;
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

    // ─── Step 3.5: Feedback enrichment ───────────────────────────────────────
    // Reads the local stats cache (zero network) and injects corrective guidance
    // and/or approved example snippets into the system prompt when applicable.
    const feedbackEnrichment = enrichPromptWithFeedback(intent, effectiveModel);

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

    // Inject feedback enrichment into system prompt (after main prompt is built)
    if (feedbackEnrichment.systemPromptAppend) {
      builtPrompt = {
        ...builtPrompt,
        system: ((builtPrompt.system ?? '') + '\n\n' + feedbackEnrichment.systemPromptAppend).trimStart(),
      };
    }

    // If model doesn't honour system role: merge system into user message
    if (pipelineConfig.mergeSystemIntoUser) {
      builtPrompt = mergeSystemIntoUser(builtPrompt);
    }

    // ─── Step 5: Get adapter ─────────────────────────────────────────────────
    const adapter = await getWorkspaceAdapter(cfg, workspaceId, userId);

    // ─── Step 6: Agentic Tool Loop ───────────────────────────────────────────
    // Respects maxToolRounds from pipeline config (0 for tiny/small, up to 3 for cloud).
    //
    // OpenAI tool-call protocol (strict — violating causes 400 no-body):
    //   1. User sends messages + tools array
    //   2. Model responds with assistant message containing `tool_calls`
    //   3. Client must append:
    //       a. The assistant message WITH the raw tool_calls array intact
    //       b. One { role:'tool', tool_call_id, content } per call
    //   4. Client calls generate() again — model produces final text
    //
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: any[] = builtPrompt.system
      ? [
          { role: 'system', content: builtPrompt.system },
          { role: 'user',   content: builtPrompt.user   },
        ]
      : [{ role: 'user', content: builtPrompt.user }];

    let rawContent = '';
    const maxToolRounds = pipelineConfig.maxToolRounds;

    for (let round = 0; round <= maxToolRounds; round++) {
      const result = await adapter.generate({
        model:       effectiveModel,
        messages,
        temperature: pipelineConfig.temperature,
        maxTokens:   Math.min(maxTokens || 5000, pipelineConfig.maxOutputTokens),
        // Only pass tools if the model supports tool calls
        ...(pipelineConfig.maxToolRounds > 0 && {
          tools:      DEFAULT_AGENT_TOOLS,
          toolChoice: 'auto' as const,
        }),
      });

      if (result.toolCalls && result.toolCalls.length > 0 && round < maxToolRounds) {
        // 1. Append assistant message — MUST include the raw tool_calls array.
        //    Without it the next API call returns 400 (no body).
        messages.push({
          role:       'assistant',
          content:    result.content || null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tool_calls: result.toolCalls.map((tc: any) => ({
            id:       tc.id,
            type:     'function',
            function: {
              name:      tc.name,
              arguments: JSON.stringify(tc.arguments ?? {}),
            },
          })),
        });

        // 2. Execute all requested tools in parallel
        const toolResults = await executeToolCalls(result.toolCalls, DEFAULT_AGENT_TOOLS);

        // 3. Append one role:'tool' message per call (NOT role:'user')
        for (const tr of toolResults) {
          messages.push({
            role:         'tool',
            tool_call_id: tr.tool_call_id,
            content:      tr.content,
          });
        }

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
      feedbackEnriched: !!feedbackEnrichment.systemPromptAppend,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `AI generation error: ${msg}` };
  }
}
