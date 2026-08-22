import crypto from 'crypto';

export function generateSecureToken() {
  return crypto.randomBytes(8).toString('hex');
}
