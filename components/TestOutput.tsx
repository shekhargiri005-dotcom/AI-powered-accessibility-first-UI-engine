'use client';

import React, { useState } from 'react';
import { TestTube, Copy, Download, Check } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';

interface TestOutputProps {
  tests: {
    rtl: string;
    playwright: string;
  };
  componentName: string;
}

type Tab = 'rtl' | 'playwright';

export default function TestOutput({ tests, componentName }: TestOutputProps) {
  const [activeTab, setActiveTab] = useState<Tab>('rtl');
  const [copied, setCopied] = useState(false);

  const currentCode = activeTab === 'rtl' ? tests.rtl : tests.playwright;
  const fileName = activeTab === 'rtl'
    ? `${componentName}.test.tsx`
    : `${componentName}.e2e.ts`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentCode);
    } catch {
      const el = document.createElement('textarea');
      el.value = currentCode;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([currentCode], { type: 'text/typescript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lineCount = currentCode.split('\n').length;

  return (
    <section
      aria-labelledby="test-output-heading"
      className="rounded-xl border border-gray-700/50 bg-gray-900/60 backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/80 border-b border-gray-700/50">
        <div className="flex items-center gap-2">
          <TestTube className="w-4 h-4 text-violet-400" aria-hidden="true" />
          <h3 id="test-output-heading" className="text-sm font-semibold text-white">
            Generated Tests
          </h3>
          <span className="text-xs text-gray-500 ml-1">{lineCount} lines</span>
        </div>

        <div className="flex items-center gap-2" role="group" aria-label="Test file actions">
          <button
            onClick={handleCopy}
            aria-label={copied ? 'Copied' : `Copy ${fileName}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-gray-600/50 text-gray-300 hover:border-blue-500/50 hover:text-blue-400 hover:bg-blue-500/10 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-gray-900"
          >
            {copied ? (
              <><Check className="w-3 h-3 text-green-400" aria-hidden="true" /><span className="text-green-400">Copied!</span></>
            ) : (
              <><Copy className="w-3 h-3" aria-hidden="true" />Copy</>
            )}
          </button>
          <button
            onClick={handleDownload}
            aria-label={`Download ${fileName}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-gray-600/50 text-gray-300 hover:border-violet-500/50 hover:text-violet-400 hover:bg-violet-500/10 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-gray-900"
          >
            <Download className="w-3 h-3" aria-hidden="true" />
            Download
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Test type selector"
        className="flex border-b border-gray-700/50 bg-gray-900/60"
      >
        {[
          { id: 'rtl' as Tab, label: 'React Testing Library', fileName: `${componentName}.test.tsx` },
          { id: 'playwright' as Tab, label: 'Playwright E2E', fileName: `${componentName}.e2e.ts` },
        ].map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-4 py-2.5 text-xs font-medium transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset
              ${activeTab === tab.id
                ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5'
                : 'text-gray-400 hover:text-gray-200 border-b-2 border-transparent'
              }
            `}
          >
            <span>{tab.label}</span>
            <span className="ml-1.5 text-gray-600 font-normal">{tab.fileName}</span>
          </button>
        ))}
      </div>

      {/* Code panel */}
      <div
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        className="overflow-auto max-h-[400px]"
      >
        <CodeMirror
          value={currentCode}
          theme={oneDark}
          extensions={[javascript({ jsx: true, typescript: true })]}
          readOnly
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: false,
          }}
          style={{ fontSize: '12px' }}
        />
      </div>
    </section>
  );
}
