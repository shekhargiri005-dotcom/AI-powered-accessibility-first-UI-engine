import { encryptionService } from '../lib/security/encryption';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local for testing
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function test() {
  console.log('Testing Encryption Service...');
  
  const sampleKey = 'sk-proj-test1234567890';
  console.log('Original Key:', sampleKey);
  
  try {
    const encrypted = encryptionService.encrypt(sampleKey);
    console.log('\nEncrypted Output:', encrypted);
    
    const decrypted = encryptionService.decrypt(encrypted);
    console.log('\nDecrypted Output:', decrypted);
    
    if (sampleKey === decrypted) {
      console.log('\n✅ VERIFICATION SUCCESSFUL: Decrypted key matches the original.');
    } else {
      console.error('\n❌ VERIFICATION FAILED: Decrypted key does NOT match.');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ ERROR during encryption/decryption test:', error);
    process.exit(1);
  }
}

test();
