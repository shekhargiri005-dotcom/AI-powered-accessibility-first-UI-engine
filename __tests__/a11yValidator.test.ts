import { validateAccessibility, autoRepairA11y } from '@/lib/validation/a11yValidator';

describe('Accessibility Validator', () => {
  it('should detect missing alt attributes on img tags', () => {
    const badCode = `
      export default function ImageComp() {
        return <img src="/logo.png" />
      }
    `;
    const report = validateAccessibility(badCode);
    expect(report.passed).toBe(false);
    expect(report.violations.some(v => v.ruleId === 'img-alt-text')).toBe(true);
    // Because it's a critical violation, score should be significantly reduced
    expect(report.score).toBeLessThan(100);
  });

  it('should pass correct img alt attributes', () => {
    const goodCode = `
      export default function ImageComp() {
        return <img src="/logo.png" alt="Company Logo" />
      }
    `;
    const report = validateAccessibility(goodCode);
    // Check if there are no img-alt violations
    expect(report.violations.some(v => v.ruleId === 'img-alt-text')).toBe(false);
  });

  it('should detect missing aria-label or accessible text on buttons', () => {
    const badCode = `
      export default function IconBtn() {
        return <button><svg /></button>
      }
    `;
    const report = validateAccessibility(badCode);
    expect(report.passed).toBe(false);
    expect(report.violations.some(v => v.ruleId === 'button-has-accessible-name')).toBe(true);
  });

  it('should pass buttons with text content', () => {
    const goodCode = `
      export default function Btn() {
        return <button>Click Me</button>
      }
    `;
    const report = validateAccessibility(goodCode);
    expect(report.violations.some(v => v.ruleId === 'button-has-accessible-name')).toBe(false);
  });

  it('should detect input without label', () => {
    const badCode = `<input id="user" />`;
    const report = validateAccessibility(badCode);
    expect(report.violations.some(v => v.ruleId === 'input-has-label')).toBe(true);
  });

  it('should pass input with associated label', () => {
    const goodCode = `
      <>
        <label htmlFor="user">User</label>
        <input id="user" />
      </>
    `;
    const report = validateAccessibility(goodCode);
    expect(report.violations.some(v => v.ruleId === 'input-has-label')).toBe(false);
  });

  it('should detect heading jumps', () => {
    const badCode = `<h1>Title</h1><h3>Sub</h3>`;
    const report = validateAccessibility(badCode);
    expect(report.violations.some(v => v.ruleId === 'heading-hierarchy')).toBe(true);
  });

  it('should detect onClick on div without role', () => {
    const badCode = `<div onClick={() => {}} />`;
    const report = validateAccessibility(badCode);
    expect(report.violations.some(v => v.ruleId === 'interactive-keyboard-accessible')).toBe(true);
  });

  it('should detect low-contrast color tokens', () => {
    const badCode = `<span className="text-gray-200">Light Text</span>`;
    const report = validateAccessibility(badCode);
    expect(report.violations.some(v => v.ruleId === 'color-contrast-tokens')).toBe(true);
  });

  it('should detect outline-none without focus ring', () => {
    const badCode = `<button className="outline-none">Fails</button>`;
    const report = validateAccessibility(badCode);
    expect(report.violations.some(v => v.ruleId === 'focus-visible')).toBe(true);
  });

  describe('autoRepairA11y', () => {
    it('should add focus rings to outline-none elements', () => {
      const code = `<button className="outline-none">Test</button>`;
      const { code: repaired } = autoRepairA11y(code);
      expect(repaired).toContain('focus:ring-2');
    });

    it('should add aria-label to icon buttons', () => {
      const code = `<button><svg /></button>`;
      const { code: repaired } = autoRepairA11y(code);
      expect(repaired).toContain('aria-label="Action button"');
    });

    it('should add role="alert" to error text', () => {
      const code = `<p className="text-red-500">Error</p>`;
      const { code: repaired } = autoRepairA11y(code);
      expect(repaired).toContain('role="alert"');
    });
  });
});
