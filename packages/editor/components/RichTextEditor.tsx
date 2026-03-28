import React, { useState } from 'react';

export function RichTextEditor({ initialValue = '', onAnalyze }: { initialValue?: string; onAnalyze?: (text: string) => void }) {
  const [content, setContent] = useState(initialValue);

  return (
    <div className="border border-gray-700 rounded-xl overflow-hidden bg-gray-900 flex flex-col">
      <div className="flex items-center gap-2 p-2 border-b border-gray-800 bg-gray-950/50">
        <button className="px-2 py-1 hover:bg-gray-800 rounded text-gray-400 font-bold">B</button>
        <button className="px-2 py-1 hover:bg-gray-800 rounded text-gray-400 italic">I</button>
        <button className="px-2 py-1 hover:bg-gray-800 rounded text-gray-400 underline">U</button>
        <div className="flex-1" />
        {onAnalyze && (
          <button onClick={() => onAnalyze(content)} className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg flex items-center gap-2">
            ✨ AI Assist
          </button>
        )}
      </div>
      <textarea 
        className="w-full h-48 bg-transparent p-4 text-gray-200 resize-none focus:outline-none" 
        value={content} 
        onChange={(e) => setContent(e.target.value)} 
        placeholder="Start writing..." 
      />
    </div>
  );
}
