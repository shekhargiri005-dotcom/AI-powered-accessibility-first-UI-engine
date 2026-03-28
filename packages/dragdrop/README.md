# @ui/dragdrop

Draggable, Droppable, and SortableList primitives ready for 
integrating gesture recognition (mouse, touch, camera).

## Installation
```ts
import { Draggable, Droppable, SortableList } from '@ui/dragdrop';
```

## Usage
```tsx
<Droppable onDrop={(id) => console.log('Dropped', id)}>
  <Draggable id="item-1">Drag Me</Draggable>
</Droppable>

<SortableList items={['One', 'Two', 'Three']} />
```
