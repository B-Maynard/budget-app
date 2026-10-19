import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  Configuration,
  JWKPublicKey,
  PlaidApi,
  PlaidEnvironments,
} from 'plaid';
import { createHash, createPublicKey, timingSafeEqual } from 'crypto';
import { decode, verify, JwtPayload } from 'jsonwebtoken';
import { PlaidTokenCipher } from './plaid-token-cipher';

@Injectable()
export class PlaidService {
  private api?: PlaidApi;

  get configuration() {
    const environment = process.env.PLAID_ENV || 'sandbox';
    let message: string | null = null;
    if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET)
      message =
        'Bank connections need Plaid credentials configured on the server.';
    else if (!['sandbox', 'production'].includes(environment))
      message = 'PLAID_ENV must be sandbox or production.';
    else if (
      !/^[a-fA-F0-9]{64}$/.test(process.env.PLAID_TOKEN_ENCRYPTION_KEY || '')
    )
      message =
        'Bank connections need a 32-byte encryption key configured on the server.';
    else if (
      environment === 'production' &&
      (!this.httpsUrl(process.env.PLAID_WEBHOOK_URL) ||
        !this.httpsUrl(process.env.PLAID_REDIRECT_URI))
    )
      message =
        'Production bank connections need HTTPS webhook and OAuth redirect URLs configured on the server.';
    return {
      enabled: !message,
      environment,
      refreshEnabled: process.env.PLAID_ENABLE_REFRESH === 'true',
      message,
    };
  }

  private httpsUrl(value?: string): boolean {
    try {
      const url = new URL(value || '');
      return url.protocol === 'https:' && !url.hash && !url.search;
    } catch {
      return false;
    }
  }

  get client(): PlaidApi {
    if (!this.configuration.enabled)
      throw new ServiceUnavailableException(this.configuration.message);
    return (this.api ??= new PlaidApi(
      new Configuration({
        basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
        baseOptions: {
          timeout: 30000,
          headers: {
            'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
            'PLAID-SECRET': process.env.PLAID_SECRET,
          },
        },
      }),
    ));
  }

  get cipher(): PlaidTokenCipher {
    if (!this.configuration.enabled)
      throw new ServiceUnavailableException(this.configuration.message);
    return new PlaidTokenCipher(
      Buffer.from(process.env.PLAID_TOKEN_ENCRYPTION_KEY!, 'hex'),
    );
  }

  async verifyWebhook(
    signature: string | undefined,
    rawBody: Buffer | undefined,
  ): Promise<void> {
    if (!signature || signature.length > 4096 || !rawBody)
      throw new UnauthorizedException('Invalid Plaid webhook');
    const decoded = decode(signature, { complete: true });
    if (
      !decoded ||
      decoded.header.alg !== 'ES256' ||
      typeof decoded.header.kid !== 'string'
    )
      throw new UnauthorizedException('Invalid Plaid webhook');
    // Only keys retrieved from Plaid are trusted; never follow a key URL from the JWT.
    let key: JWKPublicKey;
    try {
      key = (
        await this.client.webhookVerificationKeyGet({
          key_id: decoded.header.kid,
        })
      ).data.key;
    } catch (error) {
      if (plaidErrorCode(error) === 'INVALID_WEBHOOK_VERIFICATION_KEY')
        throw new UnauthorizedException('Invalid Plaid webhook');
      throw new ServiceUnavailableException(
        'Plaid webhook verification is temporarily unavailable',
      );
    }
    try {
      if (
        key.expired_at !== null ||
        key.alg !== 'ES256' ||
        key.kty !== 'EC' ||
        key.crv !== 'P-256'
      )
        throw new Error('Invalid key');
      const publicKey = createPublicKey({ key: { ...key }, format: 'jwk' });
      const payload = verify(signature, publicKey, {
        algorithms: ['ES256'],
        maxAge: '5m',
      }) as JwtPayload;
      if (
        typeof payload.iat !== 'number' ||
        payload.iat > Date.now() / 1000 + 30 ||
        !/^[a-f0-9]{64}$/.test(payload.request_body_sha256 || '')
      )
        throw new Error('Invalid payload');
      const expected = Buffer.from(payload.request_body_sha256, 'hex');
      const actual = createHash('sha256').update(rawBody).digest();
      if (!timingSafeEqual(expected, actual)) throw new Error('Body mismatch');
    } catch {
      throw new UnauthorizedException('Invalid Plaid webhook');
    }
  }
}

/** Never log/return SDK errors: their request config can contain credentials. */
export function plaidErrorCode(error: unknown): string {
  const value = (error as { response?: { data?: { error_code?: unknown } } })
    ?.response?.data?.error_code;
  return typeof value === 'string' && /^[A-Z0-9_]{1,100}$/.test(value)
    ? value
    : 'SYNC_FAILED';
}
