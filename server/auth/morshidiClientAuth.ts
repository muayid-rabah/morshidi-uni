import type { FastifyRequest } from 'fastify';
import { safeEqual } from '../store';

export interface MorshidiClientAuthOptions {
  expectedClientId?: string;
  expectedClientSecret?: string;
}

export interface MorshidiClientAuthResult {
  authenticated: boolean;
  clientId?: string;
  error?: 'INVALID_CLIENT';
}

/**
 * Authenticates the calling application (Morshidi backend) using server-to-server headers:
 * - X-Morshidi-Client-Id
 * - X-Morshidi-Client-Secret
 *
 * Security:
 * - Uses constant-time safeEqual to prevent timing attacks.
 * - Fails safely if server-side secret is missing or empty.
 * - Secrets are never logged, stored, or returned.
 */
export function authenticateMorshidiClient(
  request: FastifyRequest,
  options: MorshidiClientAuthOptions = {},
): MorshidiClientAuthResult {
  const expectedClientId = (options.expectedClientId ?? process.env.MORSHIDI_INTEGRATION_CLIENT_ID ?? 'morshidi').trim();
  const expectedClientSecret = (options.expectedClientSecret ?? process.env.MORSHIDI_INTEGRATION_CLIENT_SECRET ?? '').trim();

  // If the server has no configured client secret, fail safely
  if (!expectedClientSecret) {
    return { authenticated: false, error: 'INVALID_CLIENT' };
  }

  const clientIdHeader = request.headers['x-morshidi-client-id'];
  const clientSecretHeader = request.headers['x-morshidi-client-secret'];

  if (typeof clientIdHeader !== 'string' || typeof clientSecretHeader !== 'string') {
    return { authenticated: false, error: 'INVALID_CLIENT' };
  }

  const suppliedClientId = clientIdHeader.trim();
  const suppliedClientSecret = clientSecretHeader.trim();

  if (!suppliedClientId || !suppliedClientSecret) {
    return { authenticated: false, error: 'INVALID_CLIENT' };
  }

  if (suppliedClientId !== expectedClientId) {
    return { authenticated: false, error: 'INVALID_CLIENT' };
  }

  if (!safeEqual(suppliedClientSecret, expectedClientSecret)) {
    return { authenticated: false, error: 'INVALID_CLIENT' };
  }

  return { authenticated: true, clientId: suppliedClientId };
}
