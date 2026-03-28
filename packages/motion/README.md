# @ui/motion

Pre-built fade/slide/scale animations, a Motion component with spring physics stubs
and generative motion utility (description -> keyframes).

## Installation
```ts
import { Motion, generateMotionFromDescription } from '@ui/motion';
```

## Usage
```tsx
<Motion animation="slide">
  <div>Content slides in</div>
</Motion>

const customKeyframes = await generateMotionFromDescription('A playful bounce effect');
```
