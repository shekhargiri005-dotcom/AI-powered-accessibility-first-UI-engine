import React from 'react';

// Stubs for chart components
export function BarChart({ data, className = '' }: { data: any[]; className?: string }) {
  return (
    <div className={`w-full h-48 bg-gray-900 border border-gray-800 rounded-lg flex items-end justify-around p-4 ${className}`}>
      {data.map((d, i) => (
        <div key={i} className="w-8 bg-blue-500 rounded-t-md transition-all duration-500 hover:bg-blue-400" style={{ height: `${d.value}%` }} />
      ))}
    </div>
  );
}

export function LineChart({ data, className = '' }: { data: any[]; className?: string }) {
  return <div className={`w-full h-48 bg-gray-900 border border-gray-800 rounded-lg flex flex-col items-center justify-center text-gray-500 ${className}`}>[ Line Chart: {data.length} points ]</div>;
}

export function PieChart({ data, className = '' }: { data: any[]; className?: string }) {
  return <div className={`w-48 h-48 rounded-full bg-conic-gradient from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold ${className}`}>Pie</div>;
}
