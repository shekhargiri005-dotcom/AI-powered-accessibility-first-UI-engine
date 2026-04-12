import type { AIAdapter, GenerateOptions, GenerateResult, StreamChunk, ProviderName } from './base';

/**
 * A fallback socket adapter used when no API keys are present on the server
 * and the user has not injected one via the client.
 * 
 * Instead of crashing the server with a 500 error, this adapter gracefully
 * returns conversational and code-safe JSON/text asking the user to configure settings.
 */
export class UnconfiguredAdapter implements AIAdapter {
  readonly provider: ProviderName = 'unconfigured';

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    if (options.responseFormat === 'json_object') {
       // Support Intent / Think JSON schemas generically
       return { 
         content: JSON.stringify({
           intentType: "ideation",
           confidence: 1.0,
           summary: "Awaiting AI Socket Configuration.",
           needsClarification: true,
           clarificationQuestion: "Backend AI keys are missing. Please click the Settings gear icon to configure your API key (e.g. Groq, OpenAI).",
           shouldGenerateCode: false,
           // Fallback fields for Thinking schemas
           steps: [{ id: "await_config", title: "Awaiting Configuration", status: "pending", description: "Inject your API key via the settings panel." }]
         }),
         usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
       };
    }

    return { 
      content: '// ⚠️ System Alert: AI Socket Disconnected\n// No backend AI configuration found.\n// Please click the configuration panel (gear icon) to securely inject your API key.',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    };
  }

  async *stream(options: GenerateOptions): AsyncGenerator<StreamChunk, void, unknown> {
    const lines = [
      '// ⚠️ System Alert: AI Socket Disconnected\n',
      '// No backend credentials were found on the server.\n',
      '// Please click the configuration panel (gear icon) to securely inject your API key.\n'
    ];
    for (const line of lines) {
      yield { delta: line, done: false };
    }
    yield { delta: '', done: true, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } };
  }
}
