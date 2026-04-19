/**
 * @ui/tokens — Design token system for the UI Engine
 *
 * Re-exports all token categories for convenient access:
 *   import { colors, spacing, text, transition, ... } from '@ui/tokens';
 */

// Colors
export { brand, colors, statusColors, chartPalette, getChartColor } from './colors';

// Spacing, layout, shadows
export {
  spacing, space, radius, shadow, zIndex,
  breakpoint, containerWidth,
} from './spacing';
export type { SpacingKey } from './spacing';

// Typography
export {
  fontFamily, fontSize, fontWeight, letterSpacing,
  text, toStyle,
} from './typography';

// Transitions & animations
export { duration, easing, transition, keyframes } from './transitions';
