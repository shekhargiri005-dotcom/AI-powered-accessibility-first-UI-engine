# @ui/a11y

Accessibility primitives including FocusTrap, useAnnouncer, SkipLink, 
and ARIA attribute helpers.

## Installation
```ts
import { FocusTrap, SkipLink, useAnnouncer } from '@ui/a11y';
```

## Usage
```tsx
const announce = useAnnouncer();
announce('Data loaded successfully', 'polite');

<SkipLink targetId="main-content" />
<FocusTrap active={true}>
  <div id="modal">...</div>
</FocusTrap>
```
