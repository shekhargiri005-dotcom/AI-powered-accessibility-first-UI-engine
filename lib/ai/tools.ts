/**
 * @file tools.ts
 * Unified tool / function-calling types for the AI adapter layer.
 *
 * All providers (OpenAI, Google, Groq) have their own
 * proprietary JSON shapes for tools. This module defines a single,
 * canonical schema that the rest of the application uses. Each adapter
 * is responsible for converting to/from the provider-specific format.
 */

// ─── Tool Definition ──────────────────────────────────────────────────────────

/** JSON Schema subset used for parameter descriptions */
export interface ToolParameterSchema {
  type: 'object';
  properties: Record<
    string,
    {
      type: 'string' | 'number' | 'boolean' | 'array' | 'object';
      description?: string;
      enum?: string[];
      items?: { type: string };
    }
  >;
  required?: string[];
  /** Index signature required for compatibility with OpenAI SDK's FunctionParameters */
  [key: string]: unknown;
}

/**
 * A single callable tool that can be passed to any AI adapter.
 *
 * @example
 * const searchTool: Tool = {
 *   name: 'search_components',
 *   description: 'Find UI components in the design system by keyword.',
 *   parameters: {
 *     type: 'object',
 *     properties: {
 *       query: { type: 'string', description: 'Search term' },
 *     },
 *     required: ['query'],
 *   },
 *   execute: async ({ query }) => ({ results: ['Button', 'Card'] }),
 * };
 */
export interface Tool {
  /** Unique name used by the model to invoke the tool */
  name: string;
  /** Human-readable description the model uses to decide when to call the tool */
  description: string;
  /** JSON-Schema-like parameter definition */
  parameters: ToolParameterSchema;
  /**
   * The actual implementation to run when the model requests the tool.
   * Receives the parsed arguments object, returns any serialisable value.
   */
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

/** Tool choice hint sent to the provider */
export type ToolChoice = 'auto' | 'none' | { name: string };

// ─── Tool Call (Model → Us) ───────────────────────────────────────────────────

/**
 * Represents a tool invocation that the model requested.
 * After running `tool.execute(call.arguments)` your code should append
 * the result as a `{ role: 'tool', tool_call_id, content }` message and
 * call `generate()` again to complete the loop.
 */
export interface ToolCall {
  /** Opaque ID used to correlate results back to the model */
  id: string;
  /** The name of the tool the model wants to call */
  name: string;
  /** Parsed argument object (already JSON.parsed) */
  arguments: Record<string, unknown>;
}

// ─── Conversion Helpers (provider → unified) ─────────────────────────────────

/**
 * Convert an OpenAI raw tool_call object to the unified ToolCall type.
 * Accepts the full ChatCompletionMessageToolCall union (including custom tool variants).
 */
export function fromOpenAIToolCall(raw: {
  id: string;
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}): ToolCall {
  let args: Record<string, unknown> = {};
  try {
    if (raw.function?.arguments) {
      args = JSON.parse(raw.function.arguments as string);
    }
  } catch {
    // Keep empty args if JSON is malformed
  }
  return {
    id: raw.id,
    name: (raw.function?.name as string) ?? raw.id,
    arguments: args,
  };
}

/**
 * Convert a unified Tool definition into the OpenAI `tools` array format.
 */
export function toOpenAIToolDefinition(tool: Tool): {
  type: 'function';
  function: { name: string; description: string; parameters: ToolParameterSchema };
} {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}

/**
 * Convert a unified ToolChoice into the OpenAI `tool_choice` format.
 */
export function toOpenAIToolChoice(
  choice: ToolChoice
): 'auto' | 'none' | { type: 'function'; function: { name: string } } {
  if (choice === 'auto' || choice === 'none') return choice;
  return { type: 'function', function: { name: choice.name } };
}

// ─── Tool Execution Helper ────────────────────────────────────────────────────

/**
 * Given a list of ToolCall objects and a registry of Tool instances,
 * execute all requested calls in parallel and return their results.
 *
 * @returns An array of `{ tool_call_id, name, content }` objects ready to
 *          be appended to the messages array as role: 'tool' entries.
 */
export async function executeToolCalls(
  calls: ToolCall[],
  tools: Tool[]
): Promise<Array<{ tool_call_id: string; name: string; content: string }>> {
  const toolMap = new Map(tools.map((t) => [t.name, t]));

  const results = await Promise.allSettled(
    calls.map(async (call) => {
      const tool = toolMap.get(call.name);
      if (!tool) {
        return {
          tool_call_id: call.id,
          name: call.name,
          content: JSON.stringify({ error: `Tool "${call.name}" not found` }),
        };
      }
      const result = await tool.execute(call.arguments);
      return {
        tool_call_id: call.id,
        name: call.name,
        content: typeof result === 'string' ? result : JSON.stringify(result),
      };
    })
  );

  return results.map((r) =>
    r.status === 'fulfilled'
      ? r.value
      : { tool_call_id: '', name: 'error', content: JSON.stringify({ error: String(r.reason) }) }
  );
}
