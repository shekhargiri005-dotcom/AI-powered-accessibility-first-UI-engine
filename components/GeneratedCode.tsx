'use client';

import React, { useState } from 'react';
import { Copy, Download, Check, Code2 } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';

interface GeneratedCodeProps {
  code: string;
  componentName: string;
}

export default function GeneratedCode({ code, componentName }: GeneratedCodeProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
      const el = document.createElement('textarea');
      el.value = code;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/typescript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${componentName}.tsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lineCount = code.split('\n').length;

  return (
    <section
      aria-labelledby="generated-code-heading"
      className="h-full flex flex-col rounded-xl border border-gray-700/50 bg-gray-900/60 backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50 bg-gray-900/80">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-blue-400" aria-hidden="true" />
          <h3 id="generated-code-heading" className="text-sm font-semibold text-white">
            {componentName}.tsx
          </h3>
          <span className="text-xs text-gray-500 ml-1">
            {lineCount} lines
          </span>
        </div>

        <div className="flex items-center gap-2" role="group" aria-label="Code actions">
          <button
            onClick={handleCopy}
            aria-label={copied ? 'Code copied to clipboard' : 'Copy code to clipboard'}
            className="
              flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
              border border-gray-600/50 text-gray-300
              hover:border-blue-500/50 hover:text-blue-400 hover:bg-blue-500/10
              transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-gray-900
            "
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-green-400" aria-hidden="true" />
                <span className="text-green-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" aria-hidden="true" />
                Copy
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            aria-label={`Download ${componentName}.tsx`}
            className="
              flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
              border border-gray-600/50 text-gray-300
              hover:border-violet-500/50 hover:text-violet-400 hover:bg-violet-500/10
              transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-gray-900
            "
          >
            <Download className="w-3 h-3" aria-hidden="true" />
            Download
          </button>
        </div>
      </div>

      {/* Code Editor */}
      <div
        role="region"
        aria-label="Generated TypeScript component code"
        className="flex-1 overflow-auto"
      >
        <CodeMirror
          value={code}
          theme={oneDark}
          extensions={[javascript({ jsx: true, typescript: true })]}
          readOnly
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: false,
            highlightSelectionMatches: false,
          }}
          style={{ fontSize: '13px' }}
        />
      </div>
    </section>
  );
}
