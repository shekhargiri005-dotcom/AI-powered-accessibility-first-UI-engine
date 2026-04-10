import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const promptPath = resolve(__dir, '../lib/ai/prompts.ts');

let content = readFileSync(promptPath, 'utf8');

// Replace Component Generator instructions
content = content.replace(
  /6\. Built-In Theme \/ Color Picker \(REQUIRED\):[\s\S]*?- Ensure the picker is accessible and responsive\./m,
  `6. Vibrant Colors & Theming (CRITICAL):
   - Make the UI visually stunning by utilizing Tailwind's rich default color palettes natively (e.g., bg-blue-600, text-emerald-500, bg-zinc-900).
   - Use gradients (bg-gradient-to-r) and complementary text colors to ensure it is not monochromatic.
   - DO NOT use uninitialized CSS variables like \`bg-[var(--primary)]\` unless you strictly initialize them on mount. It's much safer and preferred to use standard Tailwind utility classes directly for maximum color fidelity.
   - If you include a theme picker, ensure it updates standard React state and applies classes dynamically, or initializes root CSS vars properly.`
);

// Replace App Mode instructions
content = content.replace(
  /3\. BUILT-IN THEME \/ COLOR PICKER \(REQUIRED\):[\s\S]*?- All components must reference these variables.*Ensure the picker is accessible and responsive\./m,
  `3. COLORFUL & VIBRANT AESTHETICS (CRITICAL):
   - Make the UI visually breathtaking by using Tailwind's rich default color palettes natively (e.g., bg-indigo-600, text-violet-500, from-rose-500 to-orange-500).
   - Avoid generic/monochrome styles. Every app should have a distinct, colorful personality.
   - DO NOT rely on uninitialized CSS variables like \`bg-[var(--primary)]\` because they evaluate to transparent by default. ALWAYS use standard, fully-qualified Tailwind color utilities mapping directly to the design.
   - If you include a theme customization feature, ensure it falls back gracefully to these vibrant standard Tailwind classes.`
);

writeFileSync(promptPath, content, 'utf8');
console.log('✅ Updated prompts.ts with Tailwind color instructions!');
