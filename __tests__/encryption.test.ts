import { encryptionService } from '@/lib/security/encryption';

describe('Encryption Service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should encrypt and decrypt correctly with valid 32-byte string key', async () => {
    process.env.ENCRYPTION_SECRET = '12345678901234567890123456789012'; // 32 chars
    
    // Dynamic import re-evaluates the module with the new env var in place
    const { encryptionService: srv } = await import('@/lib/security/encryption');
    
    const plainText = 'my-super-secret-api-key';
    const encrypted = srv.encrypt(plainText);
    
    expect(encrypted).not.toBe(plainText);
    expect(encrypted.split(':').length).toBe(3); // iv:authTag:encrypted
    
    const decrypted = srv.decrypt(encrypted);
    expect(decrypted).toBe(plainText);
  });

  it('should produce different ciphertexts for the same plaintext due to IV salting', () => {
    process.env.ENCRYPTION_SECRET = '12345678901234567890123456789012';
    const plainText = 'constant-plaintext';
    
    const cipher1 = encryptionService.encrypt(plainText);
    const cipher2 = encryptionService.encrypt(plainText);
    
    expect(cipher1).not.toBe(cipher2);
    expect(encryptionService.decrypt(cipher1)).toBe(plainText);
    expect(encryptionService.decrypt(cipher2)).toBe(plainText);
  });

  it('should handle empty strings gracefully', () => {
    process.env.ENCRYPTION_SECRET = '12345678901234567890123456789012';
    expect(encryptionService.encrypt('')).toBe('');
    expect(encryptionService.decrypt('')).toBe('');
  });
});
