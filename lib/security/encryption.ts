import crypto from "crypto";

// Get encryption key from environment variable
// Must be 32 bytes (256 bits) for AES-256-GCM.
// You can generate one with: crypto.randomBytes(32).toString('base64')
const getSecretKey = () => {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error("ENCRYPTION_SECRET environment variable is missing.");
  }
  
  // Try to parse as base64 first. If not base64, buffer it directly.
  const buffer = Buffer.from(secret, 'base64');
  
  // If the secret isn't a valid base64 32-byte string, maybe it's just a raw 32-char string.
  if (buffer.length === 32) {
    return buffer;
  }
  
  const rawBuffer = Buffer.from(secret, 'utf-8');
  if (rawBuffer.length === 32) {
    return rawBuffer;
  }
  
  throw new Error("ENCRYPTION_SECRET must be exactly 32 bytes (base64 or string).");
};

const ALGORITHM = "aes-256-gcm";

export const encryptionService = {
  encrypt: (text: string): string => {
    if (!text) return "";
    
    // GCM needs a 12-byte initialization vector
    const iv = crypto.randomBytes(12);
    const key = getSecretKey();
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    const authTag = cipher.getAuthTag().toString("hex");
    
    // Format: iv:authTag:encryptedData
    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
  },

  decrypt: (encryptedText: string): string => {
    if (!encryptedText) return "";
    
    const key = getSecretKey();
    
    // Split the formatted string
    const parts = encryptedText.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted text format. Expected iv:authTag:encryptedData");
    }
    
    const [ivHex, authTagHex, encryptedData] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  }
};

// ─── Startup Validation ───────────────────────────────────────────────────────
// Validate the key is present and correctly sized at module load time.
//
// IMPORTANT: We do NOT call process.exit(1) here.
// Next.js imports every server module during the build's "Collecting page data"
// phase — a process.exit() at that point kills the entire Vercel build even
// though the secret isn't needed until a real request arrives.
//
// Instead we warn loudly. The actual encrypt() / decrypt() calls will throw at
// request time if the secret is still missing, returning a safe 500 to the client.
if (process.env.NODE_ENV !== 'test' && !process.env.SKIP_ENV_VALIDATION) {
  try {
    getSecretKey();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Use CRITICAL prefix so it's visible in build/server logs
    console.error(`CRITICAL (non-fatal at build): ${msg}`);
    console.error(
      'Set ENCRYPTION_SECRET to a 32-byte value in your deployment environment.\n' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
    // Do NOT process.exit() — let the build succeed; requests will fail-safe at runtime.
  }
}
