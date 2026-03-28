# @ui/command-palette

CommandPalette component with semantic search (OpenAI embeddings ready), 
voice command support, and multi-modal triggers.

## Installation
```ts
import { CommandPalette, semanticSearch } from '@ui/command-palette';
```

## Usage
```tsx
const [open, setOpen] = useState(false);

<CommandPalette isOpen={open} onClose={() => setOpen(false)}>
  <div className="p-3 hover:bg-gray-800 rounded cursor-pointer text-gray-300">
    ⚡ Generate new component
  </div>
  <div className="p-3 hover:bg-gray-800 rounded cursor-pointer text-gray-300">
    🎨 Change theme
  </div>
</CommandPalette>
```
