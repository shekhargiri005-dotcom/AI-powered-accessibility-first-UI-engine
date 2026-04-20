/**
 * @file lib/ai/promptBuilder.ts
 *
 * Model-aware prompt construction.
 *
 * Returns the correct system + user prompt pair for any model tier.
 * The output of this module flows directly into adapter.generate().
 *
 * Prompt strategies:
 *
 * fill-in-blank (tiny)
 *   A near-complete TSX skeleton with {{TOKENS}} that the model fills.
 *   Locked imports are prepended. Temperature is 0.0.
 *   The model's job is pattern completion, not generation.
 *
 * structured-template (small)
 *   A numbered, step-by-step system prompt with a blueprint summary.
 *   Blueprint is truncated to the model's token budget.
 *   Explicit output format hint is included.
 *
 * guided-freeform (medium)
 *   Style guidelines + design rules. Blueprint in full but concise form.
 *   The model has creative freedom within constraints.
 *
 * freeform (large, cloud)
 *   The existing full system prompts from prompts.ts.
 *   No extra constraints — the model is trusted.
 */

import type { UIIntent } from '../validation/schemas';
import type { UIBlueprint } from '../intelligence/blueprintEngine';
import type { PipelineConfig } from './tieredPipeline';
import { truncateToTokenBudget } from './tieredPipeline';
import {
  COMPONENT_GENERATOR_SYSTEM_PROMPT,
  APP_MODE_SYSTEM_PROMPT,
  DEPTH_UI_SYSTEM_PROMPT,
  REFINEMENT_SYSTEM_PROMPT,
  buildComponentGeneratorPrompt,
  buildAppModeGeneratorPrompt,
  buildDepthUIModeGeneratorPrompt,
} from './prompts';
import { formatBlueprintForPrompt } from '../intelligence/blueprintEngine';
import type { MemoryEntry } from './memory';
import type { GenerationMode } from './componentGenerator';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BuiltPrompt {
  system: string;
  user: string;
}

// ─── Locked Import Block ──────────────────────────────────────────────────────

/**
 * Injected into tiny/small model prompts to prevent import hallucination.
 * These are the only imports the model is allowed to use.
 */
const LOCKED_IMPORTS = `import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { BarChart, LineChart, PieChart, Bar, Line, Pie, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { ArrowRight, Check, X, ChevronDown, Search, Bell, Settings, User, Menu, Home, Star, Plus, Edit, Trash2, Eye, Filter, TrendingUp, TrendingDown, Activity, BarChart2, Target, Award, MessageSquare, AlertCircle, Info, CheckCircle, XCircle, Clock, Calendar, Mail, Phone, Globe, Lock, Shield, Zap } from 'lucide-react';

// @ui/* COMPONENT ECOSYSTEM (available in Sandpack sandbox):
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Input, Textarea, Modal, ModalContent, ModalTrigger, ModalHeader, ModalTitle, ModalDescription, ModalFooter, Badge, Avatar } from '@ui/core';
import { Form, FormField, Select, Checkbox, Toggle, RadioGroup } from '@ui/forms';
import { Grid, Stack, Container, Divider, Section } from '@ui/layout';
import { Icon } from '@ui/icons';
import { FocusTrap, SkipLink, VisuallyHidden, useAnnouncer, useKeyboardNav } from '@ui/a11y';
import { ChartContainer, BarChart as UiBarChart, LineChart as UiLineChart, DonutChart, SparkLine } from '@ui/charts';
import { DragDrop, DropZone } from '@ui/dragdrop';
import { RichTextEditor } from '@ui/editor';
import { Motion, MotionGroup } from '@ui/motion';
import { ThemeProvider, useTheme } from '@ui/theming';
import { CommandPalette, CommandInput, CommandList, CommandGroup, CommandItem, CommandEmpty } from '@ui/command-palette';
import { colors, brand, spacing, space, radius, shadow, zIndex, fontSize, fontWeight, text, toStyle, transition, easing, duration, chartPalette, getChartColor } from '@ui/tokens';

// TAILWIND AVAILABLE: bg-*, text-*, p-*, m-*, flex, grid, rounded-*, shadow-*, border-*, transition-*, hover:*, focus:*
// DO NOT import ANY packages not listed above — they do not exist in the sandbox.`.trim();

// ─── Fill-in-Blank Template (tiny models) ────────────────────────────────────

const FILL_IN_BLANK_SYSTEM = `You are a code completion machine. You complete code templates.
RULES (non-negotiable):
1. Output ONLY valid TSX code. No explanation. No markdown.
2. Do NOT add any imports — imports are already provided.
3. Do NOT change the export structure.
4. Fill in ONLY the marked TODO sections.
5. Keep Tailwind classes. Do NOT invent spacing values like p-[13px].
6. Every JSX tag you open MUST be closed.`;

function buildFillInBlankPrompt(
  intent: UIIntent,
  blueprint: UIBlueprint,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _config: PipelineConfig,
): BuiltPrompt {
  const componentName = intent.componentName || 'GeneratedComponent';
  const description = intent.description || 'A React component';

  // Derive structural sections and visual style from blueprint (truncated)
  const sections = blueprint.structuralSections.slice(0, 3);
  const visualStyle = blueprint.visualStyle;
  const requiredComponents = blueprint.requiredComponents.slice(0, 3);

  // Map visual style to tailwind class hints
  const styleHints: Record<string, string> = {
    glassmorphism: 'backdrop-blur-xl bg-white/10 border border-white/20',
    'premium-dark': 'bg-gray-900 text-white',
    minimal: 'bg-white text-gray-900',
    futuristic: 'bg-black text-cyan-400 border border-cyan-800',
    luxury: 'bg-gradient-to-br from-amber-900 to-stone-900 text-amber-100',
    animated: 'bg-white text-gray-900',
    cyberpunk: 'bg-black text-yellow-400 border border-yellow-600',
    'bento-grid': 'grid grid-cols-2 gap-4 bg-gray-100',
  };

  const containerClass = styleHints[visualStyle] ?? 'bg-white text-gray-900';

  const skeleton = `${LOCKED_IMPORTS}

interface ${componentName}Props {
  // TODO: Add 2-3 relevant props for a ${description}
}

export default function ${componentName}({ }: ${componentName}Props) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // TODO: Simulate data loading (use setTimeout, 1000ms)
  }, []);

  return (
    <div className="${containerClass} p-6 rounded-xl" role="main" aria-label="${description}">
      {/* SECTION: ${sections[0] ?? 'Header'} */}
      <header className="mb-6">
        {/* TODO: Render the ${sections[0] ?? 'header'} content */}
        {/* Use at least one of: ${requiredComponents.join(', ')} */}
      </header>

      {/* SECTION: ${sections[1] ?? 'Main Content'} */}
      <main className="flex flex-col gap-4">
        {/* TODO: Render the ${sections[1] ?? 'main content'} */}
      </main>

      {/* SECTION: ${sections[2] ?? 'Footer'} */}
      <footer className="mt-8 pt-4 border-t border-current/10">
        {/* TODO: Render the ${sections[2] ?? 'footer'} content */}
      </footer>
    </div>
  );
}`;

  return {
    system: FILL_IN_BLANK_SYSTEM,
    user: `Complete this React component. Fill ONLY the TODO sections.\n\nComponent purpose: ${description}\n\n\`\`\`tsx\n${skeleton}\n\`\`\``,
  };
}

// ─── Structured Template (small models) ──────────────────────────────────────

function buildStructuredPrompt(
  intent: UIIntent,
  blueprint: UIBlueprint,
  config: PipelineConfig,
  knowledge: string | null,
): BuiltPrompt {
  const blueprintText = truncateToTokenBudget(
    formatBlueprintForPrompt(blueprint),
    config.blueprintTokenBudget,
  );

  const system = `You are a React/TypeScript developer. Follow these steps to generate a component:

STEP 1 — Read the blueprint below carefully.
STEP 2 — Use ONLY these imports:
${LOCKED_IMPORTS}

STEP 3 — Generate a complete, valid TSX component.

MANDATORY RULES:
- Output ONLY raw TSX code. No markdown fences. No explanation.
- Export default the main component.
- Use Tailwind CSS for all styling.
- Add aria-label to interactive elements.
- Close every JSX tag you open.
- Use only valid Tailwind spacing: p-4, m-2, gap-6 (NOT p-[13px]).

${blueprintText}`;

  const requiredComp = intent.componentName || 'GeneratedComponent';
  // Compact JSON — no pretty-print for small models (saves ~25% tokens on intent payload)
  let user = `Build a React TypeScript component: "${requiredComp}"\n\nDescription: ${intent.description}\n\nRequired sections: ${blueprint.structuralSections.join(', ')}\n\nMust include: ${blueprint.requiredComponents.slice(0, 3).join(', ')}\n\nIntent: ${JSON.stringify(intent)}`;

  if (knowledge) {
    user += `\n\nKNOWLEDGE BASE:\n${knowledge.substring(0, 600)}`;
  }

  return { system, user };
}

// ─── Guided Freeform (medium models) ─────────────────────────────────────────

function buildGuidedFreeformPrompt(
  intent: UIIntent,
  blueprint: UIBlueprint,
  config: PipelineConfig,
  knowledge: string | null,
  memory: MemoryEntry[],
): BuiltPrompt {
  const blueprintText = truncateToTokenBudget(
    formatBlueprintForPrompt(blueprint),
    config.blueprintTokenBudget,
  );

  const system = `You are an expert React/TypeScript developer specialising in accessible, modern, visually stunning UI components.

DESIGN GUIDELINES:
- Visual style: ${blueprint.visualStyle}
- Animation level: ${blueprint.animationDensity}
- Responsive: mobile-first with Tailwind sm: md: lg: xl: prefixes
- Accessibility: WCAG 2.1 AA — all interactive elements need aria-labels, semantic HTML
- Tailwind spacing scale: use only standard values (p-4, m-2, gap-6 — NOT p-[13px])
- COLORS: Use vibrant, modern color palettes with gradients, accent colors, and thoughtful contrast
- CREATIVITY: Be bold and creative with visual design — use shadows, rounded corners, gradients, and modern aesthetics
- NEVER use plain gray/white designs unless explicitly requested — always add visual interest

LAYOUT STRUCTURE RULES (CRITICAL):
- Component mode = ONE focused, self-contained component. NOT a full page with sidebar, nav, routing, or multiple unrelated sections.
- A "dashboard card" = a single card with metric + trend. NOT an entire dashboard with sidebar + charts + tables + feeds.
- If the user wants a multi-section page layout with navigation, that is APP mode — do NOT generate that here.
- When generating MULTIPLE components in one file, organize them in a STRUCTURED GRID LAYOUT — NOT a flat vertical stack.
- Use responsive grids: \`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6\` for card layouts.
- Wrap each distinct component in its own \`<section>\` with a heading and visual identity.
- NEVER dump all components in a flat list — create visual hierarchy with grouping.
- Pricing cards: 3-col grid, popular tier highlighted with ring + scale + badge.
- Forms: centered in a card with proper field spacing.
- Profile cards: consistent dimensions, avatar + stats + action buttons.
- Dropdowns/notifications: relative-positioned container with z-index layering.
- NEVER generate sidebar navigation, multi-screen routing, or full-page layouts in COMPONENT mode.

AVAILABLE IMPORTS (sandbox only — no other packages exist):
- \`import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';\`
- \`import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';\`
- \`import { BarChart, LineChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';\`
- \`import { ArrowRight, Check, X, ChevronDown, Search, Bell, Settings, User, Menu, Home, Star, Plus, Edit, Trash2, Eye, Filter, TrendingUp, TrendingDown, Activity } from 'lucide-react';\`
- @ui/* COMPONENTS (available in Sandpack — use when appropriate):
  - \`import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Input, Textarea, Badge, Avatar, Modal, ModalContent, ModalTrigger, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from '@ui/core'\`
  - \`import { Form, FormField, Select, Checkbox, Toggle, RadioGroup } from '@ui/forms'\`
  - \`import { Grid, Stack, Container, Divider, Section } from '@ui/layout'\`
  - \`import { Icon } from '@ui/icons'\` (50+ SVG icons by name)
  - \`import { FocusTrap, SkipLink, VisuallyHidden, useAnnouncer, useKeyboardNav, useRoveFocus } from '@ui/a11y'\`
    * useAnnouncer(): returns announce fn — usage: const announce = useAnnouncer(); announce('Message', 'polite');
    * useKeyboardNav(bindings): for global shortcuts — usage: useKeyboardNav([{ key:'k', ctrl:true, handler:() => {} }]);
    * useRoveFocus(itemCount, orientation): for arrow-key navigation — usage: const { currentIndex, handleKeyDown } = useRoveFocus(5, 'horizontal');
  - \`import { ChartContainer, BarChart as UiBarChart, LineChart as UiLineChart, DonutChart, SparkLine } from '@ui/charts'\`
  - \`import { Motion, MotionGroup } from '@ui/motion'\`
  - \`import { ThemeProvider, useTheme } from '@ui/theming'\`
  - \`import { colors, brand, statusColors, space, spacing, radius, shadow, zIndex, breakpoint, containerWidth, fontFamily, fontSize, fontWeight, letterSpacing, text, toStyle, transition, easing, duration, keyframes, chartPalette, getChartColor } from '@ui/tokens'\`
You MUST use @ui/tokens and @ui/core when available. These are NOT optional — they are the project's design system.
- @ui/tokens RULES (CRITICAL — VIOLATION = REJECT):
  * If the user mentions colors.primary, colors.surface, space.stackMd, radius.xl, shadow.md, toStyle(), transition.normal, or ANY token name → you MUST import and use those exact tokens. Do NOT substitute with raw Tailwind values.
  * Example: user says "colors.primary.bg" → use \`colors.primary.bg\` as the background style, NOT \`bg-violet-500\`.
  * Example: user says "radius.xl" → use \`borderRadius: radius.xl\`, NOT \`rounded-2xl\`.
  * Example: user says "toStyle(text.h3)" → use \`style={toStyle(text.h3)}\`, NOT \`className="text-2xl font-bold"\`.
  * CRITICAL: toStyle() is ONLY for typography presets (text.h1, text.body, etc.). NEVER use toStyle() with colors, space, or other non-typography tokens.
  * CRITICAL: All imports MUST be at the TOP of the file, before any component code. NEVER place imports at the bottom of the file.
  * Apply tokens via the style prop when tokens return CSS values: \`<Card style={{ background: colors.primary.bg, borderRadius: radius.xl, boxShadow: shadow.md }}>\`
  * CRITICAL: The style prop MUST be a valid JavaScript object wrapped in curly braces: \`style={{ property: value }}\`. NEVER use \`style= property: value\` or \`style= ...spread\` syntax.
  * CRITICAL: When combining toStyle() with other styles, use object spread: \`style={{ ...toStyle(text.h1), lineHeight: 1.2 }}\` — NOT \`style= ...text.h1, lineHeight: 1.2\`.
  * You can still use Tailwind className for layout (flex, grid, gap, p-4) BUT color, radius, shadow, typography, and transitions MUST come from @ui/tokens when the user references them.
- @ui/core RULES (CRITICAL):
  * Use Card, CardHeader, CardContent, CardFooter instead of raw <div> containers when building card layouts.
  * Use Badge instead of <span> for status badges, tags, and labels.
  * Use Button instead of <button> for all interactive buttons.
- Use lucide-react for icons that are not available in @ui/icons.

${blueprintText}

OUTPUT: Return ONLY raw TSX code. No markdown. No explanation. Export default the main component.
Generate 100-350 lines of FOCUSED code — a single component, NOT a full application with sidebar and routing.
Include 1-3 sub-components max and 5-8 mock data items.`;


  const userPrompt = buildComponentGeneratorPrompt(intent, knowledge, memory, false);

  return { system, user: userPrompt };
}

// ─── Public Entry Point ───────────────────────────────────────────────────────

/**
 * Build the final system + user prompt for code generation.
 *
 * Routes to the appropriate strategy based on the pipeline config.
 * Cloud/large models use the existing full prompt builders from prompts.ts.
 *
 * @param intent    Parsed UI intent
 * @param blueprint Selected UI blueprint from blueprintEngine
 * @param config    Pipeline config derived from the model's capability profile
 * @param mode      Generation mode: 'component' | 'app' | 'depth_ui'
 * @param knowledge Optional knowledge base injection (pattern examples)
 * @param memory    Optional few-shot examples from memory store
 * @param refinementContext  If set, this is a refinement request
 */
export function buildModelAwarePrompt(
  intent: UIIntent,
  blueprint: UIBlueprint,
  config: PipelineConfig,
  mode: GenerationMode,
  knowledge: string | null = null,
  memory: MemoryEntry[] = [],
  refinementContext?: { code: string; manifest?: unknown },
): BuiltPrompt {
  // ── Refinement always uses full freeform regardless of model tier ──────────
  if (intent.isRefinement && refinementContext) {
    return {
      system: REFINEMENT_SYSTEM_PROMPT,
      user:
        `TARGET FILE CODE:\n${refinementContext.code}\n\n` +
        `APP MANIFEST:\n${JSON.stringify(refinementContext.manifest || [], null, 2)}\n\n` +
        `REFINEMENT INTENT:\n${JSON.stringify(intent, null, 2)}`,
    };
  }

  // ── Dispatch by prompt strategy ───────────────────────────────────────────
  switch (config.promptStyle) {
    case 'fill-in-blank':
      // Tiny models — fill-in-blank skeleton (mode is always 'component' for tiny)
      return buildFillInBlankPrompt(intent, blueprint, config);

    case 'structured-template':
      // Small models — structured numbered steps
      return buildStructuredPrompt(intent, blueprint, config, knowledge);

    case 'guided-freeform':
      // Medium models — style guidelines + design rules
      return buildGuidedFreeformPrompt(intent, blueprint, config, knowledge, memory);

    case 'freeform':
    default:
      // Large and cloud models — full existing system prompts
      if (mode === 'depth_ui') {
        return {
          system: DEPTH_UI_SYSTEM_PROMPT,
          user: buildDepthUIModeGeneratorPrompt(intent, knowledge, false),
        };
      }
      if (mode === 'app') {
        return {
          system: APP_MODE_SYSTEM_PROMPT,
          user: buildAppModeGeneratorPrompt(intent, knowledge, memory, false),
        };
      }
      return {
        system: COMPONENT_GENERATOR_SYSTEM_PROMPT,
        user: buildComponentGeneratorPrompt(intent, knowledge, memory, false),
      };
  }
}

/**
 * If the model does not honour the system role (mergeSystemIntoUser: true),
 * collapse system + user into a single user message.
 *
 * Usage: call this AFTER buildModelAwarePrompt() when config.mergeSystemIntoUser is true.
 */
export function mergeSystemIntoUser(prompt: BuiltPrompt): BuiltPrompt {
  return {
    system: '',
    user: `${prompt.system}\n\n---\n\n${prompt.user}`,
  };
}
