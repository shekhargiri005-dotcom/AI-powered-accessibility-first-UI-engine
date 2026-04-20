import * as React from 'react';
import { cn } from '../../utils/cn';

/* Zero-dependency chart components for Sandpack — SVG-based */

export interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function ChartContainer({ title, subtitle, children, className, ...props }: ChartContainerProps) {
  return (
    <div className={cn('bg-gray-900/60 border border-gray-800/60 rounded-xl p-5', className)} {...props}>
      {(title || subtitle) && (
        <div className="mb-4">
          {title && <h3 className="text-lg font-semibold text-white">{title}</h3>}
          {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

export interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  showLabels?: boolean;
  showValues?: boolean;
  className?: string;
}

export function BarChart({ data, height = 200, showLabels = true, showValues = true, className }: BarChartProps) {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barWidth = 100 / data.length;
  const defaultColors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];

  return (
    <div className={cn('w-full', className)} role="img" aria-label={`Bar chart with ${data.length} bars`}>
      <svg viewBox={`0 0 ${data.length * 60} ${height + 30}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {data.map((item, i) => {
          const barH = (item.value / maxVal) * height;
          const color = item.color || defaultColors[i % defaultColors.length];
          return (
            <g key={i}>
              <rect
                x={i * 60 + 10}
                y={height - barH}
                width={40}
                height={barH}
                fill={color}
                rx={4}
                className="transition-all duration-300 hover:opacity-80"
              />
              {showValues && (
                <text x={i * 60 + 30} y={height - barH - 5} textAnchor="middle" fill="#9ca3af" fontSize="10">
                  {item.value}
                </text>
              )}
              {showLabels && (
                <text x={i * 60 + 30} y={height + 20} textAnchor="middle" fill="#6b7280" fontSize="10">
                  {item.label.length > 6 ? item.label.slice(0, 6) + '…' : item.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export interface LineChartProps {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  fill?: boolean;
  showDots?: boolean;
  className?: string;
}

export function LineChart({ data, height = 200, color = '#3b82f6', fill = true, showDots = true, className }: LineChartProps) {
  if (data.length < 2) return <div className="text-gray-500 text-sm">Need at least 2 data points</div>;

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const minVal = Math.min(...data.map(d => d.value), 0);
  const range = maxVal - minVal || 1;
  const width = data.length * 60;

  const points = data.map((d, i) => ({
    x: i * 60 + 30,
    y: height - ((d.value - minVal) / range) * (height - 20) - 10,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const fillPath = `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return (
    <div className={cn('w-full', className)} role="img" aria-label={`Line chart with ${data.length} points`}>
      <svg viewBox={`0 0 ${width} ${height + 30}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {fill && <path d={fillPath} fill={`${color}20`} />}
        <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {showDots && points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4} fill={color} className="hover:r-6 transition-all" />
            <text x={p.x} y={height + 20} textAnchor="middle" fill="#6b7280" fontSize="10">
              {data[i].label.length > 6 ? data[i].label.slice(0, 6) + '…' : data[i].label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export interface DonutChartProps {
  data: { label: string; value: number; color?: string }[];
  size?: number;
  thickness?: number;
  className?: string;
}

export function DonutChart({ data, size = 160, thickness = 24, className }: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  const defaultColors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];
  const radius = (size - thickness) / 2;
  const center = size / 2;

  const segments = data.reduce<{ startAngle: number; angle: number; color: string; value: number; label?: string }[]>((acc, item, i) => {
    const angle = (item.value / total) * 360;
    const startAngle = acc.length > 0 ? acc[acc.length - 1].startAngle + acc[acc.length - 1].angle : 0;
    const color = item.color || defaultColors[i % defaultColors.length];
    acc.push({ ...item, startAngle, angle, color });
    return acc;
  }, []);

  const describeArc = (startAngle: number, angle: number) => {
    const start = (startAngle - 90) * (Math.PI / 180);
    const end = (startAngle + angle - 90) * (Math.PI / 180);
    const largeArc = angle > 180 ? 1 : 0;
    const x1 = center + radius * Math.cos(start);
    const y1 = center + radius * Math.sin(start);
    const x2 = center + radius * Math.cos(end);
    const y2 = center + radius * Math.sin(end);
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  return (
    <div className={cn('flex items-center gap-4', className)} role="img" aria-label="Donut chart">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#1f2937" strokeWidth={thickness} />
        {segments.map((seg, i) => (
          <path key={i} d={describeArc(seg.startAngle, seg.angle)} fill="none" stroke={seg.color} strokeWidth={thickness} strokeLinecap="round" />
        ))}
        <text x={center} y={center - 6} textAnchor="middle" fill="white" fontSize="20" fontWeight="bold">
          {total}
        </text>
        <text x={center} y={center + 12} textAnchor="middle" fill="#9ca3af" fontSize="10">
          total
        </text>
      </svg>
      <div className="space-y-1.5">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-gray-400">{seg.label}</span>
            <span className="text-gray-300 font-medium ml-auto">{Math.round((seg.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface SparkLineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

export function SparkLine({ data, width = 120, height = 32, color = '#3b82f6', className }: SparkLineProps) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });

  return (
    <svg width={width} height={height} className={cn('inline-block', className)} aria-hidden="true">
      <polyline fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" points={points.join(' ')} />
    </svg>
  );
}
