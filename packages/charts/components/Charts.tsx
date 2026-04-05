'use client';

import React from 'react';

/** A minimal data point with a numeric value. Extra fields are allowed. */
export interface ChartDataPoint {
  value: number;
  label?: string;
  [key: string]: unknown;
}

export interface BarChartProps {
  data: ChartDataPoint[];
  className?: string;
  /** Accessible label for the chart region. */
  ariaLabel?: string;
}

/** Stub bar chart — visual preview only. Replace with recharts for production. */
export function BarChart({ data, className = '', ariaLabel = 'Bar chart' }: BarChartProps) {
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={`w-full h-48 bg-gray-900 border border-gray-800 rounded-lg flex items-end justify-around p-4 ${className}`}
    >
      {data.map((d, i) => (
        <div
          key={i}
          title={d.label ? `${d.label}: ${d.value}` : String(d.value)}
          className="w-8 bg-blue-500 rounded-t-md transition-all duration-500 hover:bg-blue-400"
          style={{ height: `${Math.min(100, Math.max(0, d.value))}%` }}
        />
      ))}
    </div>
  );
}

export interface LineChartProps {
  data: ChartDataPoint[];
  className?: string;
  ariaLabel?: string;
}

/** Stub line chart. */
export function LineChart({ data, className = '', ariaLabel = 'Line chart' }: LineChartProps) {
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={`w-full h-48 bg-gray-900 border border-gray-800 rounded-lg flex flex-col items-center justify-center text-gray-500 ${className}`}
    >
      [ Line Chart: {data.length} points ]
    </div>
  );
}

export interface PieChartProps {
  data: ChartDataPoint[];
  className?: string;
  ariaLabel?: string;
}

/** Stub pie chart. */
export function PieChart({ data: _data, className = '', ariaLabel = 'Pie chart' }: PieChartProps) {
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={`w-48 h-48 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold ${className}`}
    >
      Pie
    </div>
  );
}
