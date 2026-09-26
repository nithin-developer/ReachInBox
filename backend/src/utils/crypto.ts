import crypto from 'crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM

// Ensure 32-byte key
const getSecretKey = (): Buffer => {
  const key = env.ENCRYPTION_KEY;
  if (Buffer.from(key, 'hex').length === 32) {
    return Buffer.from(key, 'hex');
  }
  return crypto.createHash('sha256').update(key).digest();
};

export interface EncryptedData {
  encryptedText: string;
  iv: string;
  authTag: string;
}

/**
 * Encrypt a plaintext string using AES-256-GCM
 */
export const encrypt = (text: string): EncryptedData => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getSecretKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    encryptedText: encrypted,
    iv: iv.toString('hex'),
    authTag,
  };
};

/**
 * Decrypt an AES-256-GCM ciphertext
 */
export const decrypt = (encryptedText: string, ivHex: string, authTagHex: string): string => {
  const key = getSecretKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};
