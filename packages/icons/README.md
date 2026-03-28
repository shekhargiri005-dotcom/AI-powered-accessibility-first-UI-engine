# @ui/icons

SVG icon component with semantic search capabilities (natural language -> icon),
and an AI-generated icon function.

## Installation
```ts
import { Icon, generateIconSvg } from '@ui/icons';
```

## Usage
```tsx
<Icon name="play button" size={32} className="text-blue-500" />

const customSvg = await generateIconSvg('a futuristic glowing gear');
```
