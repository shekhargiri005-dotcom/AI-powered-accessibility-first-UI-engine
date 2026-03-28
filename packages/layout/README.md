# @ui/layout

Responsive Grid, Stack, and Container components.
Includes an AI-suggested layout utility that analyzes content and recommends grid props.

## Installation
```ts
import { Grid, Stack, Container, suggestLayoutForContent } from '@ui/layout';
```

## Usage
```tsx
const layoutProps = await suggestLayoutForContent('A gallery of 12 product cards');
// returns { type: 'grid', props: { cols: 3, gap: 6 } }

<Grid cols={3} gap={6}>
  {/* cards */}
</Grid>
```
