# @ui/theming

ThemeProvider, useTheme, persistent user preference, and 
AI-generated custom themes (description -> full theme).

## Installation
```ts
import { ThemeProvider, useTheme, generateCustomTheme } from '@ui/theming';
```

## Usage
```tsx
<ThemeProvider defaultTheme="dark">
  <App />
</ThemeProvider>

const { theme, setTheme } = useTheme();
const newThemeVars = await generateCustomTheme('neon cyberpunk street');
```
