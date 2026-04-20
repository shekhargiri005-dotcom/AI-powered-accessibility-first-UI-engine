import 'server-only';

import type { AIAdapter, GenerateOptions, GenerateResult, StreamChunk } from './base';
import type { ProviderName } from '../types';

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

    const reactCode = `import React from 'react';
import { AlertCircle } from 'lucide-react';

export default function AIUnconfiguredAlert() {
  return (
    <div className="flex items-center justify-center min-h-[400px] w-full bg-gray-50 dark:bg-gray-900 p-8 font-sans">
      <div className="max-w-xl w-full bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-red-100 dark:border-red-900 overflow-hidden transform transition-all hover:scale-105 duration-300">
        <div className="p-8 text-center bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <AlertCircle className="w-10 h-10 text-red-500 dark:text-red-400" />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight">AI Socket Unconfigured</h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
            I am ready to build your UI, but I need an API key to communicate with the models. 
            No backend credentials were found on the server.
          </p>
          <div className="bg-gray-900 dark:bg-black rounded-2xl p-6 text-left shadow-lg">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-gray-400 font-mono text-sm ml-2">quick_start.sh</span>
            </div>
            <ol className="font-mono text-sm text-green-400 space-y-3">
              <li><span className="text-blue-400">1.</span> Click the <span className="text-pink-400 font-bold">Gear Icon</span> ⚙️ in the prompt panel.</li>
              <li><span className="text-blue-400">2.</span> Select <span className="text-yellow-400">"Groq"</span> or <span className="text-yellow-400">"OpenAI"</span>.</li>
              <li><span className="text-blue-400">3.</span> Paste your API key and click <span className="text-white bg-blue-600 px-2 py-0.5 rounded">Save</span>.</li>
              <li><span className="text-blue-400">4.</span> Say <span className="text-purple-400">"Hello"</span> to try again!</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}`;

    return { 
      content: reactCode,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    };
  }

  async *stream(_options: GenerateOptions): AsyncGenerator<StreamChunk, void, unknown> { // eslint-disable-line @typescript-eslint/no-unused-vars
    const reactCodeLines = [
      `import React from 'react';\n`,
      `import { AlertCircle } from 'lucide-react';\n\n`,
      `export default function AIUnconfiguredAlert() {\n`,
      `  return (\n`,
      `    <div className="flex items-center justify-center min-h-[400px] w-full bg-gray-50 dark:bg-gray-900 p-8">\n`,
      `      <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-red-200 dark:border-red-900/50">\n`,
      `        <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />\n`,
      `        <h2 className="text-2xl font-bold mb-4 dark:text-white">AI Socket Disconnected</h2>\n`,
      `        <p className="text-gray-600 dark:text-gray-300">Please click the gear icon to configure your API key.</p>\n`,
      `      </div>\n`,
      `    </div>\n`,
      `  );\n`,
      `}\n`
    ];

    for (const chunk of reactCodeLines) {
      yield { delta: chunk, done: false };
    }
    yield { delta: '', done: true, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } };
  }
}
