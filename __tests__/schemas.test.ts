import { 
  IntentClassificationSchema, 
  UIIntentSchema, 
  A11yReportSchema,
  AppIntentSchema,
  WebGLIntentSchema
} from '@/lib/validation/schemas';

describe('Zod Schemas', () => {
  describe('IntentClassificationSchema', () => {
    it('should parse valid intent', () => {
      const data = {
        intentType: 'ui_generation',
        confidence: 0.9,
        summary: 'test',
        suggestedMode: 'component',
        needsClarification: false,
        shouldGenerateCode: true,
        purpose: 'dashboard',
        visualType: '2d-standard',
        complexity: 'simple',
        platform: 'web',
        layout: 'single-page',
        motionLevel: 'none',
        preferredStack: ['react', 'tailwind']
      };
      const parsed = IntentClassificationSchema.parse(data);
      expect(parsed.intentType).toBe('ui_generation');
    });

    it('should use defaults for missing values', () => {
      const parsed = IntentClassificationSchema.parse({});
      expect(parsed.intentType).toBe('ui_generation');
      expect(parsed.confidence).toBe(0.8);
    });
  });

  describe('UIIntentSchema', () => {
    it('should parse valid UI intent', () => {
      const data = {
        componentType: 'component',
        componentName: 'MyButton',
        description: 'A test button',
        fields: [],
        layout: { type: 'centered', maxWidth: 'md', alignment: 'center' },
        interactions: [],
        theme: { variant: 'primary', size: 'md' },
        a11yRequired: [],
        semanticElements: []
      };
      const parsed = UIIntentSchema.parse(data);
      expect(parsed.componentName).toBe('MyButton');
    });
  });

  describe('A11yReportSchema', () => {
      it('should parse valid report', () => {
          const data = {
              passed: true,
              score: 100,
              violations: [],
              suggestions: [],
              timestamp: new Date().toISOString()
          };
          const parsed = A11yReportSchema.parse(data);
          expect(parsed.passed).toBe(true);
      });
  });

  describe('AppIntentSchema', () => {
    it('should extend UIIntentSchema correctly', () => {
        const data = {
            componentType: 'app',
            componentName: 'MyApp',
            description: 'A test app',
            fields: [],
            layout: { type: 'centered', maxWidth: 'md', alignment: 'center' },
            interactions: [],
            theme: { variant: 'primary', size: 'md' },
            a11yRequired: [],
            semanticElements: [],
            appType: 'multiscreen',
            screens: [{ name: 'Home', description: 'Home screen', isDefault: true }],
            colorScheme: { primary: '#000', background: '#fff', surface: '#eee', text: '#333' },
            features: ['auth'],
            navStyle: 'sidebar'
        };
        const parsed = AppIntentSchema.parse(data);
        expect(parsed.componentType).toBe('app');
        expect(parsed.screens).toHaveLength(1);
    });
  });

  describe('WebGLIntentSchema', () => {
    it('should extend UIIntentSchema correctly', () => {
        const data = {
            componentType: 'webgl',
            componentName: 'MyScene',
            description: 'A test scene',
            fields: [],
            layout: { type: 'centered', maxWidth: 'md', alignment: 'center' },
            interactions: [],
            theme: { variant: 'primary', size: 'md' },
            a11yRequired: [],
            semanticElements: [],
            webglType: 'canvas',
            sceneElements: [],
            colorScheme: { primary: '#000', background: '#fff', ambientLight: '#fff', directionalLight: '#fff' },
            uiOverlay: [],
            cameraSetup: { position: [0, 0, 10], fov: 60 }
        };
        const parsed = WebGLIntentSchema.parse(data);
        expect(parsed.componentType).toBe('webgl');
        expect(parsed.cameraSetup.fov).toBe(60);
    });
  });
});
