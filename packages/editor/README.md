# @ui/editor

RichTextEditor with AI-assisted writing (grammar, tone, summarization).

## Installation
```ts
import { RichTextEditor, summarizeText } from '@ui/editor';
```

## Usage
```tsx
<RichTextEditor 
  onAnalyze={async (text) => {
    const summary = await summarizeText(text);
    alert('Summary: ' + summary);
  }} 
/>
```
