# @ui/forms

Form components, real-time validation (Zod/Yup ready),
and AI-powered autocomplete.

## Installation
```ts
import { Form, Field, predictAutocomplete } from '@ui/forms';
```

## Usage
```tsx
<Form onSubmit={handle}>
  <Field label="Country" error="Required">
    <input type="text" />
  </Field>
</Form>
```
