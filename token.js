import crypto from 'crypto';

export function generateSecureToken() {
  // Generates 8 random bytes, converted to a 16-character hexadecimal string
  return crypto.randomBytes(8).toString('hex');
}
