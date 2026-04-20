/**
 * @file lib/ai/uiCheatSheet.ts
 *
 * Injected into AI prompts as a quick-reference for packages that are actually
 * available in the Sandpack sandbox. Includes both third-party libraries AND
 * the @ui/* component ecosystem.
 * 
 * OPTIMIZED: Reduced token count by ~60% while maintaining essential information.
 */

export const UI_ECOSYSTEM_API_CHEAT_SHEET = `
=== SANDBOX API (ONLY these imports work) ===

@ui/core: Button, Card, CardHeader/Title/Description/Content/Footer, Input, Textarea, Badge, Avatar, Modal
@ui/forms: Form, FormField, Select, Checkbox, Toggle, RadioGroup  
@ui/layout: Grid, Stack, Container, Divider, Section
@ui/icons: Icon (name: arrow-right, check, search, settings, user, etc.)
@ui/a11y: FocusTrap, useAnnouncer, useKeyboardNav, useRoveFocus
@ui/charts: ChartContainer, BarChart, LineChart, DonutChart
@ui/motion: Motion, MotionGroup
@ui/tokens: colors, spacing, radius, shadow, text, toStyle, transition, easing

@ui/tokens USAGE:
- Colors: colors.primary.bg, colors.surface.base, colors.text.primary
  * colors.primary has: bg, hover, text, muted, ring
  * colors.surface has: base, raised, overlay, sunken
  * colors.text has: primary, secondary, muted, inverse, link (NO .fg suffix!)
  * colors.border has: default, hover, focus, error, success
  * colors.gradient has: primary, warm, cool, sunset, aurora, midnight, glass
- Spacing: spacing.stackMd, spacing.inlineSm  
- Radius: radius.xl, radius.lg
- Shadow: shadow.md, shadow.glow
- Typography: style={toStyle(text.h1)} — ONLY for text.*, never for colors
- Transition: transition.normal, easing.smooth

THIRD-PARTY:
import { motion } from 'framer-motion'
import { ArrowRight, Check, Search } from 'lucide-react'
`.trim();
