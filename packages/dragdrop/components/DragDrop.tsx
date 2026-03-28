import React from 'react';

// Stubs for drag and drop library components
export function Draggable({ children, id }: { children: React.ReactNode; id: string }) {
  return <div draggable className="cursor-grab active:cursor-grabbing hover:ring-2 ring-blue-500/50 rounded-lg">{children}</div>;
}

export function Droppable({ children, onDrop }: { children: React.ReactNode; onDrop?: (id: string) => void }) {
  return (
    <div 
      className="p-4 border-2 border-dashed border-gray-700 hover:border-blue-500 rounded-xl transition-colors min-h-[100px]"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (onDrop) onDrop('dropped-id'); // simplified stub
      }}
    >
      {children}
    </div>
  );
}

export function SortableList({ items, onSort }: { items: string[]; onSort?: (newItems: string[]) => void }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="p-3 bg-gray-800 rounded-lg shadow-sm border border-gray-700 cursor-move">
          {item}
        </li>
      ))}
    </ul>
  );
}
