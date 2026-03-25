import OpenAI from 'openai';
import {
  INTENT_PARSER_SYSTEM_PROMPT,
  APP_MODE_INTENT_SYSTEM_PROMPT,
  WEBGL_MODE_INTENT_SYSTEM_PROMPT,
  buildIntentParsePrompt,
  buildAppModeIntentPrompt,
  buildWebglModeIntentPrompt,
} from './prompts';
import { findRelevantKnowledge, findAppTemplate, findWebglTemplate } from './knowledgeBase';
import { 
  UIIntentSchema, 
  AppIntentSchema, 
  WebGLIntentSchema, 
  type UIIntent 
} from '../validation/schemas';
import type { GenerationMode } from './componentGenerator';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ParseResult {
  success: boolean;
  intent?: UIIntent;
  error?: string;
  rawResponse?: string;
}

export async function parseIntent(
  userInput: string,
  mode: GenerationMode = 'component'
): Promise<ParseResult> {
  if (!userInput || userInput.trim().length === 0) {
    return { success: false, error: 'Input cannot be empty' };
  }
  if (userInput.trim().length < 3) {
    return { success: false, error: 'Input too short — describe a UI component or app' };
  }
  try {
    let knowledge: string | null;
    let systemPrompt: string;
    let userPrompt: string;

    if (mode === 'webgl') {
      knowledge = findWebglTemplate(userInput) ?? findRelevantKnowledge(userInput);
      systemPrompt = WEBGL_MODE_INTENT_SYSTEM_PROMPT;
      userPrompt = buildWebglModeIntentPrompt(userInput, knowledge);
    } else if (mode === 'app') {
      knowledge = findAppTemplate(userInput) ?? findRelevantKnowledge(userInput);
      systemPrompt = APP_MODE_INTENT_SYSTEM_PROMPT;
      userPrompt = buildAppModeIntentPrompt(userInput, knowledge);
    } else {
      knowledge = findRelevantKnowledge(userInput);
      systemPrompt = INTENT_PARSER_SYSTEM_PROMPT;
      userPrompt = buildIntentParsePrompt(userInput, knowledge);
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const rawContent = response.choices[0]?.message?.content || '';

    if (!rawContent) {
      return { success: false, error: 'AI returned empty response' };
    }

    // Extract JSON if wrapped in markdown
    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, rawContent];
    const cleanedRaw = jsonMatch[1].trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleanedRaw);
    } catch {
      return { success: false, error: 'AI returned malformed JSON', rawResponse: rawContent };
    }

    // Check for error response from AI
    if (typeof parsed === 'object' && parsed !== null && 'error' in parsed) {
      return {
        success: false,
        error: (parsed as { error: string }).error,
        rawResponse: rawContent,
      };
    }

    // Select schema based on mode
    const schema = mode === 'app' ? AppIntentSchema : mode === 'webgl' ? WebGLIntentSchema : UIIntentSchema;

    // Validate against Zod schema
    const validation = schema.safeParse(parsed);
    if (!validation.success) {
      return {
        success: false,
        error: `Schema validation failed: ${validation.error.issues.map(i => i.message).join(', ')}`,
        rawResponse: rawContent,
      };
    }

    const validIntent = validation.data;
    if (validIntent.componentName) {
      validIntent.componentName = validIntent.componentName
        .split(/[^a-zA-Z0-9]+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
      if (!/^[a-zA-Z]/.test(validIntent.componentName)) {
        validIntent.componentName = 'C' + validIntent.componentName;
      }
    }

    return { success: true, intent: validIntent, rawResponse: rawContent };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `OpenAI API error: ${msg}` };
  }
}
