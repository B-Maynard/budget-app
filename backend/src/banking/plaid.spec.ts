import { createHash, generateKeyPairSync, randomBytes } from 'crypto';
import { sign } from 'jsonwebtoken';
import { PlaidTokenCipher } from './plaid-token-cipher';
import { PlaidService, plaidErrorCode } from './plaid.service';

// The monorepo also loads Jasmine types; use Jest's matcher declarations here.
const expect = (globalThis as unknown as { expect: jest.Expect }).expect;

describe('bank token encryption', () => {
  const cipher = new PlaidTokenCipher(randomBytes(32));
  it('uses a fresh nonce for each token and decrypts both', () => {
    const first = cipher.encrypt('access-sandbox-secret');
    const second = cipher.encrypt('access-sandbox-secret');
    expect(first).not.toContain('access-sandbox-secret');
    expect(first).not.toEqual(second);
    expect(cipher.decrypt(first)).toBe('access-sandbox-secret');
    expect(cipher.decrypt(second)).toBe('access-sandbox-secret');
  });
  it('rejects modified ciphertext and the wrong key', () => {
    const encrypted = cipher.encrypt('access-secret');
    const parts = encrypted.split('.');
    const bytes = Buffer.from(parts[3], 'base64url');
    bytes[0] ^= 1;
    parts[3] = bytes.toString('base64url');
    expect(() => cipher.decrypt(parts.join('.'))).toThrow();
    expect(() =>
      new PlaidTokenCipher(randomBytes(32)).decrypt(encrypted),
    ).toThrow();
    expect(() => new PlaidTokenCipher(Buffer.alloc(16))).toThrow();
  });
});

describe('Plaid webhook verification', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
  });
  const body = Buffer.from(
    '{ "item_id": "item-test", "webhook_type": "TRANSACTIONS" }',
  );
  const hash = createHash('sha256').update(body).digest('hex');
  const key = {
    ...publicKey.export({ format: 'jwk' }),
    alg: 'ES256',
    expired_at: null,
  };
  let service: PlaidService;
  const signature = (payload = {}) =>
    sign(
      {
        iat: Math.floor(Date.now() / 1000),
        request_body_sha256: hash,
        ...payload,
      },
      privateKey,
      { algorithm: 'ES256', keyid: 'test-key' },
    );
  beforeEach(() => {
    service = new PlaidService();
    jest
      .spyOn(service, 'client', 'get')
      .mockReturnValue({
        webhookVerificationKeyGet: jest
          .fn()
          .mockResolvedValue({ data: { key } }),
      } as any);
  });
  it('accepts a genuine ES256 signature over the exact raw request', async () => {
    await expect(
      service.verifyWebhook(signature(), body),
    ).resolves.toBeUndefined();
  });
  it('rejects changed body bytes, expired/future signatures and missing signatures', async () => {
    await expect(
      service.verifyWebhook(
        signature(),
        Buffer.from(JSON.stringify(JSON.parse(body.toString()))),
      ),
    ).rejects.toThrow('Invalid Plaid webhook');
    await expect(
      service.verifyWebhook(
        signature({ iat: Math.floor(Date.now() / 1000) - 301 }),
        body,
      ),
    ).rejects.toThrow();
    await expect(
      service.verifyWebhook(
        signature({ iat: Math.floor(Date.now() / 1000) + 120 }),
        body,
      ),
    ).rejects.toThrow();
    await expect(service.verifyWebhook(undefined, body)).rejects.toThrow();
  });
  it('rejects an unexpected algorithm without requesting a key', async () => {
    const token = sign({ request_body_sha256: hash }, 'secret', {
      algorithm: 'HS256',
      keyid: 'test-key',
    });
    await expect(service.verifyWebhook(token, body)).rejects.toThrow();
    expect(service.client.webhookVerificationKeyGet).not.toHaveBeenCalled();
  });
  it('rejects a signature made with a different private key', async () => {
    const other = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const token = sign({ request_body_sha256: hash }, other.privateKey, {
      algorithm: 'ES256',
      keyid: 'test-key',
    });
    await expect(service.verifyWebhook(token, body)).rejects.toThrow();
  });
  it('does not expose credentials from SDK errors', () => {
    expect(plaidErrorCode({ config: { data: 'access_token=secret' } })).toBe(
      'SYNC_FAILED',
    );
    expect(
      plaidErrorCode({
        response: { data: { error_code: 'ITEM_LOGIN_REQUIRED' } },
      }),
    ).toBe('ITEM_LOGIN_REQUIRED');
  });
});
