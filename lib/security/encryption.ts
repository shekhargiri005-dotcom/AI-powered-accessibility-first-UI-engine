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

// Validate key at startup (if not skipping validation for builds)
if (process.env.NODE_ENV !== "test" && !process.env.SKIP_ENV_VALIDATION) {
  try {
    getSecretKey();
  } catch (err) {
    if (process.env.NODE_ENV === "production") {
      console.error("CRITICAL:", err instanceof Error ? err.message : String(err));
      process.exit(1);
    } else {
      console.warn("WARNING:", err instanceof Error ? err.message : String(err));
    }
  }
}
