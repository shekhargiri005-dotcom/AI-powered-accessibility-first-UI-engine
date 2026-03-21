import OpenAI from 'openai';
import { INTENT_PARSER_SYSTEM_PROMPT, buildIntentParsePrompt } from './prompts';
import { UIIntentSchema, type UIIntent } from '../validation/schemas';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ParseResult {
  success: boolean;
  intent?: UIIntent;
  error?: string;
  rawResponse?: string;
}

export async function parseIntent(userInput: string): Promise<ParseResult> {
  if (!userInput || userInput.trim().length === 0) {
    return { success: false, error: 'Input cannot be empty' };
  }

  if (userInput.trim().length < 3) {
    return { success: false, error: 'Input too short — describe a UI component' };
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1, // Low temperature for consistent structured output
      max_tokens: 2000,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: INTENT_PARSER_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: buildIntentParsePrompt(userInput),
        },
      ],
    });

    const rawContent = response.choices[0]?.message?.content;

    if (!rawContent) {
      return { success: false, error: 'AI returned empty response' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      return {
        success: false,
        error: 'AI returned malformed JSON',
        rawResponse: rawContent,
      };
    }

    // Check for error response from AI
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'error' in parsed
    ) {
      return {
        success: false,
        error: (parsed as { error: string }).error,
        rawResponse: rawContent,
      };
    }

    // Validate against Zod schema
    const validation = UIIntentSchema.safeParse(parsed);
    if (!validation.success) {
      return {
        success: false,
        error: `Schema validation failed: ${validation.error.issues.map(i => i.message).join(', ')}`,
        rawResponse: rawContent,
      };
    }

    return {
      success: true,
      intent: validation.data,
      rawResponse: rawContent,
    };
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      return {
        success: false,
        error: `OpenAI API error: ${error.message} (status: ${error.status})`,
      };
    }
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
