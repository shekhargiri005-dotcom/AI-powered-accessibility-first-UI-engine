import { validateBrowserSafeCode, sanitizeGeneratedCode } from '@/lib/validation/security';

describe('Security Validator', () => {
  describe('validateBrowserSafeCode', () => {
    it('should detect unsafe node imports', () => {
      const code = "import fs from 'fs'; export default function App() { return <div />; }";
      const result = validateBrowserSafeCode(code);
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Code contains unsupported Node.js standard library imports (e.g., fs, path, child_process).');
    });

    it('should detect process.exit()', () => {
      const code = "export default function App() { process.exit(1); return <div />; }";
      const result = validateBrowserSafeCode(code);
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('process.exit() is not supported in the browser.');
    });

    it('should detect terminal manipulation', () => {
      const code = "export default function App() { console.clear(); return <div />; }";
      const result = validateBrowserSafeCode(code);
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Terminal/TTY manipulation methods are not supported in Sandpack.');
    });

    it('should detect missing exports', () => {
      const code = "function App() { return <div />; }";
      const result = validateBrowserSafeCode(code);
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('File does not export a valid React component (missing export default or export const/function).');
    });

    it('should pass valid browser code', () => {
      const code = "export default function App() { return <div>Hello</div>; }";
      const result = validateBrowserSafeCode(code);
      expect(result.isValid).toBe(true);
    });
  });

  describe('sanitizeGeneratedCode', () => {
    it('should collapse multi-line template literals', () => {
      const code = "const className = `\n  flex\n  items-center\n`;";
      const sanitized = sanitizeGeneratedCode(code);
      expect(sanitized).toBe("const className = ` flex items-center `;");
    });

    it('should remove carriage returns', () => {
      const code = "const x = 1;\r\nconst y = 2;";
      const sanitized = sanitizeGeneratedCode(code);
      expect(sanitized).toBe("const x = 1;\nconst y = 2;");
    });
    
    it('should handle escaped backticks in template literals', () => {
        const code = "const x = `hello \\` world`;";
        const sanitized = sanitizeGeneratedCode(code);
        expect(sanitized).toBe(code);
    });
  });
});
