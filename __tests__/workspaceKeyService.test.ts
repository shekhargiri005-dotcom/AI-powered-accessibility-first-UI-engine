const mockPrisma = {
  workspaceSettings: {
    findUnique: jest.fn(),
  },
};

const mockEncryption = {
  encryptionService: {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  },
};

// Use doMock to ensure isolation when re-requiring the module
jest.doMock('@/lib/prisma', () => ({ prisma: mockPrisma }));
jest.doMock('@/lib/security/encryption', () => mockEncryption);

describe('WorkspaceKeyService', () => {
  let getWorkspaceApiKey: any;
  let getWorkspaceModel: any;

  beforeEach(() => {
    jest.resetModules();
    const service = require('@/lib/security/workspaceKeyService');
    getWorkspaceApiKey = service.getWorkspaceApiKey;
    getWorkspaceModel = service.getWorkspaceModel;
    jest.clearAllMocks();
  });

  describe('getWorkspaceApiKey', () => {
    it('should decrypt and return key if found', async () => {
      mockPrisma.workspaceSettings.findUnique.mockResolvedValue({
        encryptedApiKey: 'encrypted-stuff',
      });
      mockEncryption.encryptionService.decrypt.mockReturnValue('decrypted-key');

      const key = await getWorkspaceApiKey('openai', 'test-pw');
      expect(key).toBe('decrypted-key');
    });

    it('should use cache on subsequent calls', async () => {
      mockPrisma.workspaceSettings.findUnique.mockResolvedValue({
        encryptedApiKey: 'encrypted-stuff',
      });
      mockEncryption.encryptionService.decrypt.mockReturnValue('decrypted-key');

      await getWorkspaceApiKey('openai', 'cached-ws');
      await getWorkspaceApiKey('openai', 'cached-ws');
      
      expect(mockPrisma.workspaceSettings.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('getWorkspaceModel', () => {
    it('should return model name if found', async () => {
      mockPrisma.workspaceSettings.findUnique.mockResolvedValue({
        model: 'gpt-4o',
      });
      const model = await getWorkspaceModel('openai', 'test-ws');
      expect(model).toBe('gpt-4o');
    });
  });
});
