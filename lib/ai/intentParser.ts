import { getWorkspaceAdapter } from './adapters/index';
import type { ProviderName } from './types';
import { resolveDefaultAdapter } from './resolveDefaultAdapter';
import { getModelProfile } from './modelRegistry';
import {
  INTENT_PARSER_SYSTEM_PROMPT,
  APP_MODE_INTENT_SYSTEM_PROMPT,
  DEPTH_UI_INTENT_SYSTEM_PROMPT,
  buildIntentParsePrompt,
  buildAppModeIntentPrompt,
  buildDepthUIModeIntentPrompt,
} from './prompts';
import {
  findRelevantKnowledgeSemantic,
  findAppTemplateSemantic,
  findDepthUITemplateSemantic,
  findRelevantFeedback,
} from './semanticKnowledgeBase';
import { 
  UIIntentSchema, 
  AppIntentSchema, 
  DepthUIIntentSchema, 
  type UIIntent 
} from '../validation/schemas';
import type { GenerationMode } from './componentGenerator';

// Dynamic client used inside the function.

export interface ParseResult {
  success: boolean;
  intent?: UIIntent;
  error?: string;
  rawResponse?: string;
}

export async function parseIntent(
  userInput: string,
  mode: GenerationMode = 'component',
  /** Link to persistent project if provided — enables refinement detection */
  contextId?: string,
  /**
   * Caller-supplied provider and model.
   * When provided, credentials are resolved server-side via workspaceKeyService.
   * When omitted, falls through to resolveDefaultAdapter.
   */
  provider?: ProviderName,
  model?: string,
  workspaceId?: string,
  userId?: string,
): Promise<ParseResult> {
  if (!userInput || userInput.trim().length === 0) {
    return { success: false, error: 'Input cannot be empty' };
  }
  if (userInput.trim().length < 3) {
    return { success: false, error: 'Input too short — describe a UI component or app' };
  }
  try {
    let rawKnowledge: string | null = null;
    let systemPrompt: string;
    let userPrompt: string;

    // ── Semantic knowledge retrieval (falls back to keyword matching internally) ──
    if (mode === 'depth_ui') {
      rawKnowledge = await findDepthUITemplateSemantic(userInput) ?? await findRelevantKnowledgeSemantic(userInput);
      systemPrompt = DEPTH_UI_INTENT_SYSTEM_PROMPT;
    } else if (mode === 'app') {
      rawKnowledge = await findAppTemplateSemantic(userInput) ?? await findRelevantKnowledgeSemantic(userInput);
      systemPrompt = APP_MODE_INTENT_SYSTEM_PROMPT;
    } else {
      // Semantic component search + RAG from past user corrections
      const [semanticKnowledge, feedbackContext] = await Promise.all([
        findRelevantKnowledgeSemantic(userInput),
        findRelevantFeedback(userInput),
      ]);
      rawKnowledge = [semanticKnowledge, feedbackContext].filter(Boolean).join('\n\n') || null;
      systemPrompt = INTENT_PARSER_SYSTEM_PROMPT;
    }

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
      const defaultConfig = resolveDefaultAdapter('INTENT');
      modelId = defaultConfig.model;
      providerId = (defaultConfig.provider || 'openai') as ProviderName;
      wsId = 'default';
    }

    // Ensure the knowledge string doesn't overflow the context limits of small/local models
    const { fitContextToTierBudget, estimateTokens } = await import('./promptBudget');
    
    // Safe estimation: 500 system prompt tokens + user input tokens
    const baseSystemTokens = 500 + estimateTokens(userInput);
    // Rough mapping of model limits. Default to 'large' (3500 system tokens) for cloud models,
    // and 'medium' (1800) for local/hf models without explicit token capacities.
    const tier = /hf-|local|llama|mistral|gemma/i.test(modelId) ? 'medium' : 'large';
    
    const knowledge = fitContextToTierBudget(rawKnowledge, baseSystemTokens, tier);

    if (mode === 'depth_ui') {
      userPrompt = buildDepthUIModeIntentPrompt(userInput, knowledge);
    } else if (mode === 'app') {
      userPrompt = buildAppModeIntentPrompt(userInput, knowledge);
    } else {
      userPrompt = buildIntentParsePrompt(userInput, knowledge);
    }

    if (contextId) {
      userPrompt += `\n\n=== ITERATIVE CONTEXT ===\nThis request is a follow-up to project ID: ${contextId}. Determine if this is a refinement/modification and set "isRefinement" accordingly in your JSON response.`;
    }

    // adapter logic (credentials resolved server-side)
    const adapter = await getWorkspaceAdapter(providerId, modelId, wsId, uid);

    // Look up model capacity — governs whether JSON mode is safe to enable.
    // Models like deepseek-coder report supportsJsonMode: false; we skip it for them.
    // Ensure the system prompt contains the word "json" when JSON mode is enabled.
    const modelProfile = getModelProfile(modelId);
    const useJsonMode = modelProfile?.supportsJsonMode !== false;

    // Ensure the system prompt contains the word "json" when using JSON mode.
    // This is a no-op for cloud models that ignore it.
    const effectiveSystemPrompt = useJsonMode && !systemPrompt.toLowerCase().includes('json')
      ? `Respond with valid JSON only.\n\n${systemPrompt}`
      : systemPrompt;

    const adapterResult = await (async () => {
      // Retry loop for 429 rate limit errors
      let lastError: unknown;
      const maxRetries = 2;
      const baseDelayMs = 2000;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await adapter.generate({
            model: modelId,
            messages: [
              { role: 'system', content: effectiveSystemPrompt },
              { role: 'user', content: userPrompt },
            ],
            ...(useJsonMode ? { responseFormat: 'json_object' as const } : {}),
            temperature: 0.2,
          });
        } catch (error) {
          lastError = error;
          const msg = error instanceof Error ? error.message : String(error);
          const isRateLimit = msg.includes('429') || msg.includes('rate_limit') || msg.includes('quota');
          const isNetworkError = isRateLimit || msg.includes('Connection error') || msg.includes('fetch failed') || msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT') || msg.includes('502') || msg.includes('503') || msg.includes('504');

          if (isNetworkError && attempt < maxRetries) {
            const delay = baseDelayMs * Math.pow(2, attempt);
            console.warn(`[intentParser] Network/Rate limit error. Retrying (${attempt + 1}/${maxRetries}) in ${delay}ms: ${msg}`);
            await new Promise(res => setTimeout(res, delay));
            continue;
          }

          if (isRateLimit) {
            // Rate limit exhausted — build a local fallback intent so generation can still proceed
            console.warn(`[intentParser] Provider ${providerId} rate limited. Returning local fallback intent.`);
            const fallbackIntent = {
              componentType: mode === 'app' ? 'app' : mode === 'depth_ui' ? 'depth_ui' : 'component',
              componentName: userInput.trim().split(' ').slice(0, 3).map(
                (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
              ).join('').replace(/[^a-zA-Z0-9]/g, '') || 'GeneratedComponent',
              description: userInput.trim().substring(0, 200),
              fields: [],
              layout: { type: 'single-column', maxWidth: 'lg', alignment: 'center' },
              interactions: [],
              theme: { variant: 'default', size: 'md' },
              a11yRequired: ['keyboard navigation', 'aria-labels'],
              semanticElements: ['main', 'section'],
              isRefinement: !!contextId,
              ...(mode === 'app' ? {
                appType: 'web-app',
                screens: [{ name: 'Home', description: 'Main screen', isDefault: true }],
                colorScheme: { primary: '#6366f1', background: '#0f172a', surface: '#1e293b', text: '#f1f5f9' },
                features: [],
                navStyle: 'sidebar',
              } : {}),
              ...(mode === 'depth_ui' ? {
                depthArchetype: 'soft_depth',
                colorScheme: { primary: '#6366f1', background: '#0f172a', surface: '#1e293b', text: '#f1f5f9' },
              } : {}),
            };
            const fallbackValidation = (mode === 'app' ? AppIntentSchema : mode === 'depth_ui' ? DepthUIIntentSchema : UIIntentSchema).safeParse(fallbackIntent);
            if (fallbackValidation.success) {
              return { content: JSON.stringify(fallbackValidation.data) };
            }
          }

          throw error;
        }
      }
      throw lastError;
    })();

    const rawContent = adapterResult.content;

    if (!rawContent) {
      return { success: false, error: 'AI returned empty response' };
    }

    // 1. Strip thinking blocks completely so they don't corrupt JSON parsing
    const noThinkBlock = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    // 2. Extract JSON if wrapped in markdown
    const jsonMatch = noThinkBlock.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    
    let cleanedRaw = noThinkBlock;
    if (jsonMatch) {
      cleanedRaw = jsonMatch[1].trim();
    } else {
      // 3. Fallback: walk forward from the first '{' counting bracket depth.
      //    lastIndexOf('}') is NOT safe — trailing text like "handles {screens}" would
      //    return the wrong closing brace and produce malformed JSON.
      const start = noThinkBlock.indexOf('{');
      if (start !== -1) {
        let depth = 0;
        let inString = false;
        let escape = false;
        let end = -1;
        for (let i = start; i < noThinkBlock.length; i++) {
          const ch = noThinkBlock[i];
          if (escape)             { escape = false; continue; }
          if (ch === '\\' && inString) { escape = true;  continue; }
          if (ch === '"')         { inString = !inString; continue; }
          if (inString)           continue;
          if (ch === '{')         depth++;
          else if (ch === '}') {
            depth--;
            if (depth === 0) { end = i; break; }
          }
        }
        if (end !== -1) cleanedRaw = noThinkBlock.substring(start, end + 1);
      }
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleanedRaw);
    } catch {
      return { success: false, error: 'AI returned malformed JSON', rawResponse: rawContent };
    }

    // Check for error response from AI
    if (typeof parsed === 'object' && parsed !== null && 'error' in parsed) {
      const aiErrorMsg = (parsed as { error: string }).error;

      // "Not a UI description" is a soft rejection — the model was too strict.
      // The prompt already passed input validation + classify, so we attempt a
      // minimal-intent recovery instead of hard-failing the whole pipeline.
      if (aiErrorMsg === 'Not a UI description' || aiErrorMsg?.toLowerCase().includes('not a ui')) {
        // Build a minimal fallback intent so generation can still proceed
        const fallbackIntent = {
          componentType: 'component',
          componentName: userInput.trim().split(' ').slice(0, 3).map(
            (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
          ).join('') + 'Component',
          description: userInput.trim().substring(0, 200),
          fields: [],
          layout: { type: 'single-column', maxWidth: 'lg', alignment: 'center' },
          interactions: [],
          theme: { variant: 'default', size: 'md' },
          a11yRequired: ['keyboard navigation', 'aria-labels'],
          semanticElements: ['main', 'section'],
          isRefinement: false,
        };
        const fallbackValidation = (mode === 'app' ? AppIntentSchema : mode === 'depth_ui' ? DepthUIIntentSchema : UIIntentSchema).safeParse(fallbackIntent);
        if (fallbackValidation.success) {
          return { success: true, intent: fallbackValidation.data, rawResponse: rawContent };
        }
      }

      return {
        success: false,
        error: `AI rejected this prompt: ${aiErrorMsg}. Try rephrasing as a UI component description (e.g. "a login form", "a dashboard card", "a hero section").`,
        rawResponse: rawContent,
      };
    }

    // Select schema based on mode
    const schema = mode === 'app' ? AppIntentSchema : mode === 'depth_ui' ? DepthUIIntentSchema : UIIntentSchema;

    // Validate against Zod schema
    const validation = schema.safeParse(parsed);
    if (!validation.success) {
      return {
        success: false,
        error: `Schema validation failed: ${validation.error.issues.map((i: { message: string }) => i.message).join(', ')}`,
        rawResponse: rawContent,
      };
    }

    const validIntent = validation.data;
    if (validIntent.componentName) {
      validIntent.componentName = validIntent.componentName
        .split(/[^a-zA-Z0-9]+/)
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
      if (!/^[a-zA-Z]/.test(validIntent.componentName)) {
        validIntent.componentName = 'C' + validIntent.componentName;
      }
    }

    return { success: true, intent: validIntent, rawResponse: rawContent };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Intent parser error: ${msg}` };
  }
}
