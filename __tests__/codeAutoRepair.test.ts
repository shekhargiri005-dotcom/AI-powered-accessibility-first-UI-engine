/**
 * @file __tests__/codeAutoRepair.test.ts
 * Tests for the auto-repair module that fixes common AI-generated code mistakes.
 */

import { autoRepairCode, needsRepair } from '../lib/intelligence/codeAutoRepair';

describe('autoRepairCode', () => {
  describe('style prop fixes', () => {
    it('fixes style= color: "red" to style={{color: "red"}}', () => {
      const input = '<div style= color: "red" />';
      const result = autoRepairCode(input);
      expect(result.code).toContain('style={{color: "red"}}');
      expect(result.fixes.length).toBeGreaterThan(0);
      expect(result.hadErrors).toBe(true);
    });

    it('fixes style= ...text.h1, lineHeight: 1.2 to style={{...text.h1, lineHeight: 1.2}}', () => {
      const input = '<h1 style= ...text.h1, lineHeight: 1.2>Title</h1>';
      const result = autoRepairCode(input);
      expect(result.code).toContain('style={{ ...text.h1, lineHeight: 1.2 }}');
      expect(result.fixes.length).toBeGreaterThan(0);
    });

    it('fixes style= backgroundImage: colors.gradient.sunset', () => {
      const input = '<div style= backgroundImage: colors.gradient.sunset />';
      const result = autoRepairCode(input);
      expect(result.code).toContain('style={{backgroundImage: colors.gradient.sunset}}');
    });

    it('does NOT break valid style={{}} syntax', () => {
      const input = 'function Test() { return <div style={{ color: "red" }} />; }\nexport default Test;';
      const result = autoRepairCode(input);
      expect(result.code).toContain('style={{ color: "red" }}');
      expect(result.hadErrors).toBe(false);
    });
  });

  describe('token path fixes', () => {
    it('fixes colors.text.primary.fg to colors.text.primary', () => {
      const input = 'style={{ color: colors.text.primary.fg }}';
      const result = autoRepairCode(input);
      expect(result.code).toContain('colors.text.primary');
      expect(result.code).not.toContain('colors.text.primary.fg');
      expect(result.fixes.some(f => f.includes('Fixed token path'))).toBe(true);
    });

    it('fixes colors.text.secondary.bg to colors.text.secondary', () => {
      const input = 'style={{ color: colors.text.secondary.bg }}';
      const result = autoRepairCode(input);
      expect(result.code).toContain('colors.text.secondary');
      expect(result.code).not.toContain('colors.text.secondary.bg');
    });
  });

  describe('missing export default', () => {
    it('adds export default when missing', () => {
      const input = 'function MyComponent() { return <div>Hello</div>; }';
      const result = autoRepairCode(input);
      expect(result.code).toContain('export default MyComponent');
      expect(result.fixes.some(f => f.includes('Added missing export default'))).toBe(true);
    });

    it('does NOT add export if already present', () => {
      const input = 'function MyComponent() { return <div>Hello</div>; }\nexport default MyComponent;';
      const result = autoRepairCode(input);
      expect(result.fixes.filter(f => f.includes('export default')).length).toBe(0);
    });
  });

  describe('needsRepair detection', () => {
    it('returns true for invalid style prop', () => {
      expect(needsRepair('<div style= color: "red" />')).toBe(true);
    });

    it('returns true for wrong token path', () => {
      expect(needsRepair('colors.text.primary.fg')).toBe(true);
    });

    it('returns true for missing export', () => {
      expect(needsRepair('function Test() {}')).toBe(true);
    });

    it('returns false for valid code', () => {
      expect(needsRepair('function Test() {}\nexport default Test;')).toBe(false);
    });
  });

  describe('complex real-world example', () => {
    it('fixes crypto trading hero with multiple errors', () => {
      const badCode = `
const CryptoTradingHero = () => {
  return (
    <section style= color: colors.text.primary.fg >
      <h1 style= ...text.h1, lineHeight: 1.1 >Trade</h1>
    </section>
  );
};
`;
      const result = autoRepairCode(badCode);
      expect(result.code).toContain('style={{color: colors.text.primary}}');
      expect(result.code).toContain('style={{ ...text.h1, lineHeight: 1.1 }}');
      expect(result.code).toContain('export default CryptoTradingHero');
      expect(result.fixes.length).toBeGreaterThanOrEqual(3);
    });
  });
});
