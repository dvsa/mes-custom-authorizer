import { promisify } from 'util';
import fetch from 'node-fetch';
import AdJwtVerifier from '../application/AdJwtVerifier';
import ensureNotNullOrEmpty from './ensureNotNullOrEmpty';
import { jwksClientFactory } from './jwks';
import * as JwksRsa from 'jwks-rsa';

/**
 * Creates an AdJwtVerifier that can verify the authenticity of Azure Active Directory JWTs.
 */
export default async function createAdJwtVerifier(): Promise<AdJwtVerifier> {
  const tenantId: string = process.env.AZURE_AD_TENANT_ID || '';
  const applicationId: string = process.env.AZURE_AD_CLIENT_ID || '';

  ensureNotNullOrEmpty(tenantId, 'process.env.AZURE_AD_TENANT_ID');
  ensureNotNullOrEmpty(applicationId, 'process.env.AZURE_AD_CLIENT_ID');

  const openidConfigRes = await fetch(
    `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration?appid=${applicationId}`,
  );
  const openidConfig = await openidConfigRes.json() as { error_description: string, jwks_uri: string,  issuer: string };

  if (openidConfig.error_description) {
    throw new Error(`Failed to get openid configuration: ${openidConfig.error_description}`);
  }

  const jwksClient = jwksClientFactory({
    jwksUri: openidConfig.jwks_uri,
    cache: true,
    cacheMaxEntries: 10,
  });

  return new AdJwtVerifier(applicationId, openidConfig.issuer, {
    getSigningKey: promisify(jwksClient.getSigningKey),
  } as JwksRsa.JwksClient);
}
