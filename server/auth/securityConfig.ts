export interface SecretValidationOptions {
  morshidiTokenSecret?: string;
  morshidiClientSecret?: string;
  serviceSecret?: string;
  isProduction?: boolean;
}

export interface SecretValidationResult {
  valid: boolean;
  errors: string[];
}

export const MIN_PRODUCTION_SECRET_LENGTH = 32;

/**
 * Validates integration secrets to prevent weak or missing credentials in production.
 * Supports both canonical MORSHIDI_INTEGRATION_* and alias MORSHIDI_* variable names.
 */
export function checkIntegrationSecrets(options: SecretValidationOptions): SecretValidationResult {
  const isProd = options.isProduction ?? (process.env.NODE_ENV === 'production');
  const errors: string[] = [];

  if (isProd) {
    const tokenSecret = options.morshidiTokenSecret ?? process.env.MORSHIDI_INTEGRATION_TOKEN_SECRET ?? process.env.MORSHIDI_TOKEN_SECRET;
    const clientSecret = options.morshidiClientSecret ?? process.env.MORSHIDI_INTEGRATION_CLIENT_SECRET ?? process.env.MORSHIDI_CLIENT_SECRET;
    const serviceSecret = options.serviceSecret ?? process.env.UNI_SERVICE_KEY;

    if (!tokenSecret || tokenSecret.length < MIN_PRODUCTION_SECRET_LENGTH) {
      errors.push(`MORSHIDI_INTEGRATION_TOKEN_SECRET must be configured and at least ${MIN_PRODUCTION_SECRET_LENGTH} characters long in production.`);
    }
    if (!clientSecret || clientSecret.length < MIN_PRODUCTION_SECRET_LENGTH) {
      errors.push(`MORSHIDI_INTEGRATION_CLIENT_SECRET must be configured and at least ${MIN_PRODUCTION_SECRET_LENGTH} characters long in production.`);
    }
    if (serviceSecret !== undefined && serviceSecret.length < MIN_PRODUCTION_SECRET_LENGTH) {
      errors.push(`UNI_SERVICE_KEY must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters long in production.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Asserts that secrets meet production security standards, throwing a ConfigurationError if invalid.
 */
export function assertIntegrationSecrets(options: SecretValidationOptions): void {
  const result = checkIntegrationSecrets(options);
  if (!result.valid) {
    throw new Error(`Integration security configuration error: ${result.errors.join(' ')}`);
  }
}
