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
import { buildSemanticContext } from './semanticKnowledgeBase';
import { type UIIntent, type DepthUIModePreset } from '../validation/schemas';
import { evaluateDepthExperience } from '../intelligence/depthEngine';
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
import { resolveStyleDNA, formatStyleDNAForPrompt } from '../intelligence/styleDNA';
import { buildUXStateContract } from '../intelligence/uxStateEngine';

export type GenerationMode = 'component' | 'app' | 'depth_ui';

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
  thinkingPlan?: unknown,
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
    // Track whether the profile is EXPLICIT (registered) vs fallback.
    // Tools must never be passed to unregistered/unknown models — they may silently 400.
    const explicitProfile = getModelProfile(effectiveModel);
    const modelProfile = explicitProfile ?? getCloudFallbackProfile();
    const pipelineConfig = getPipelineConfig(modelProfile);

    // ─── Step 3: Knowledge + memory lookup ───────────────────────────────────
    // Phase 4: buildSemanticContext() runs all 5 sources in parallel:
    //  template | registry | blueprint | motion (depth_ui only) | feedback
    // Returns a single merged context block with graceful per-source fallbacks.
    let knowledge: string | null = null;
    const memory = await getRelevantExamples(intent);

    if (!intent.isRefinement) {
      const semanticContext = await buildSemanticContext(searchText, mode);
      knowledge = semanticContext || null;
    }

    // ─── Step 3.2: Depth UI Engine Evaluation ────────────────────────────────
    if (mode === 'depth_ui') {
      const depthSpec: DepthUIModePreset = evaluateDepthExperience(intent, blueprint);
      // Inject into intent so promptBuilder can see it
      (intent as UIIntent & { depthSpec?: DepthUIModePreset }).depthSpec = depthSpec;
    }

    // ─── Step 3.5: Feedback enrichment ───────────────────────────────────────
    // Reads the local stats cache (zero network) and injects corrective guidance
    // and/or approved example snippets into the system prompt when applicable.
    const feedbackEnrichment = await enrichPromptWithFeedback(intent, effectiveModel);

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

    if (thinkingPlan) {
      const serializedPlan = JSON.stringify(thinkingPlan, null, 2);
      builtPrompt = {
        ...builtPrompt,
        system: (
          (builtPrompt.system ?? '') +
          '\n\nREASONING ALIGNMENT:\n' +
          'Follow this approved thinking plan while matching prior gold-standard fixes.\n' +
          serializedPlan
        ).trimStart(),
      };
    }

    // ─── Step 4.5: Style DNA + UX State Contract (component / depth_ui only) ──────
    // Injects a deterministic visual fingerprint and interaction-state contract
    // into the system prompt. Skip for app mode (has its own design system).
    if (mode === 'component' || mode === 'depth_ui') {
      const dna            = resolveStyleDNA(intent.description, blueprint.pageType, mode);
      const dnaBlock       = formatStyleDNAForPrompt(dna);
      const uxContract     = buildUXStateContract(intent.description) ?? '';

      const dnaAndContract = [dnaBlock, uxContract].filter(Boolean).join('\n\n');
      if (dnaAndContract) {
        builtPrompt = {
          ...builtPrompt,
          system: ((builtPrompt.system ?? '') + '\n\n' + dnaAndContract).trimStart(),
        };
      }
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

    // Only inject tools when the model has an explicit registry entry with supportsToolCalls:true.
    // Fallback/unknown models must NOT receive tools — they may silently reject them (400 no body).
    let toolsEnabled = explicitProfile !== null && maxToolRounds > 0;

    for (let round = 0; round <= maxToolRounds; round++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let result: any;
      try {
        result = await adapter.generate({
          model:       effectiveModel,
          messages,
          temperature: pipelineConfig.temperature,
          maxTokens:   Math.min(maxTokens || 5000, pipelineConfig.maxOutputTokens),
          ...(toolsEnabled && {
            tools:      DEFAULT_AGENT_TOOLS,
            toolChoice: 'auto' as const,
          }),
        });
      } catch (genErr: unknown) {
        const errMsg = genErr instanceof Error ? genErr.message : String(genErr);
        // If tools were injected and caused a 400, retry once without tools
        // then disable tools for all remaining rounds (self-healing fallback).
        if (toolsEnabled && errMsg.includes('400')) {
          console.warn(
            `[componentGenerator] Tool-call 400 on ${effectiveModel} (round ${round}). ` +
            'Retrying without tools and disabling for remaining rounds.'
          );
          toolsEnabled = false;
          result = await adapter.generate({
            model:       effectiveModel,
            messages,
            temperature: pipelineConfig.temperature,
            maxTokens:   Math.min(maxTokens || 5000, pipelineConfig.maxOutputTokens),
          });
        } else {
          throw genErr;
        }
      }

      if (toolsEnabled && result.toolCalls && result.toolCalls.length > 0 && round < maxToolRounds) {
        // 1. Append assistant message WITH the raw tool_calls array intact (protocol requirement).
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

        // 3. One role:'tool' message per call (NOT role:'user' — that causes 400)
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
    // Log the ORIGINAL error with its full stack here so Vercel logs show the real call site.
    // Without this, the stack is discarded and reqLogger.error(new Error(...)) in the route
    // creates a NEW Error whose stack points only at the logging call — not the actual throw.
    const originalStack = error instanceof Error ? error.stack : String(error);
    const msg           = error instanceof Error ? error.message : 'Unknown error';
    console.error('[componentGenerator] Fatal error — original stack:\n', originalStack);
    return { success: false, error: `AI generation error: ${msg}` };
  }
}
