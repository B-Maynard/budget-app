import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/** Versioned AES-256-GCM envelope. Keep this key stable across deploys/backups. */
export class PlaidTokenCipher {
  constructor(private readonly key: Buffer) {
    if (key.length !== 32)
      throw new Error('Bank token encryption requires a 32-byte key');
  }
  encrypt(token: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(token, 'utf8'),
      cipher.final(),
    ]);
    return [
      'v1',
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.');
  }
  decrypt(envelope: string): string {
    const [version, iv, tag, encrypted, extra] = envelope.split('.');
    if (version !== 'v1' || !iv || !tag || !encrypted || extra)
      throw new Error('Invalid bank token envelope');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}
