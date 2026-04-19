import * as React from 'react';
import { cn } from '../../utils/cn';

export interface DragDropProps {
  items: { id: string; content: React.ReactNode; disabled?: boolean }[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  className?: string;
  orientation?: 'vertical' | 'horizontal';
}

export function DragDrop({ items, onReorder, className, orientation = 'vertical' }: DragDropProps) {
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [overIndex, setOverIndex] = React.useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== index) {
      onReorder(dragIndex, index);
    }
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <div className={cn('flex', orientation === 'vertical' ? 'flex-col' : 'flex-row', className)} role="list" aria-label="Reorderable list">
      {items.map((item, index) => (
        <div
          key={item.id}
          role="listitem"
          draggable={!item.disabled}
          onDragStart={e => !item.disabled && handleDragStart(e, index)}
          onDragOver={e => handleDragOver(e, index)}
          onDrop={e => handleDrop(e, index)}
          onDragEnd={handleDragEnd}
          className={cn(
            'select-none cursor-grab active:cursor-grabbing transition-all duration-150',
            orientation === 'vertical' ? 'mb-2' : 'mr-2',
            dragIndex === index && 'opacity-50 scale-95',
            overIndex === index && dragIndex !== index && 'border-2 border-blue-500/50 rounded-lg',
            item.disabled && 'opacity-50 cursor-not-allowed',
          )}
          aria-grabbed={dragIndex === index}
          aria-disabled={item.disabled}
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}

export interface DropZoneProps {
  onDrop: (data: string) => void;
  accept?: string[];
  children: React.ReactNode;
  className?: string;
  active?: boolean;
}

export function DropZone({ onDrop, children, className, active = false }: DropZoneProps) {
  const [isOver, setIsOver] = React.useState(false);

  return (
    <div
      onDragOver={e => { e.preventDefault(); setIsOver(true); }}
      onDragLeave={() => setIsOver(false)}
      onDrop={e => {
        e.preventDefault();
        setIsOver(false);
        const data = e.dataTransfer.getData('text/plain');
        if (data) onDrop(data);
      }}
      className={cn(
        'border-2 border-dashed rounded-lg p-4 transition-colors duration-200',
        isOver ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700',
        active && !isOver && 'border-gray-600',
        className
      )}
      role="region"
      aria-label="Drop zone"
    >
      {children}
    </div>
  );
}
