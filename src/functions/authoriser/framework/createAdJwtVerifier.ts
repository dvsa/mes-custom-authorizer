import { promisify } from 'util';
import nodeFetch from 'node-fetch';
import AdJwtVerifier from '../application/AdJwtVerifier';
import ensureNotNullOrEmpty from './ensureNotNullOrEmpty';
import { jwksClientFactory } from './jwks';

/**
 * Creates an AdJwtVerifier that can verify the authenticity of Azure Active Directory JWTs.
 */
export default async function createAdJwtVerifier(): Promise<AdJwtVerifier> {
  const tenantId: string = process.env.DVSA_MES_AzureAD_TenantId || '';
  const applicationId: string = process.env.DVSA_MES_AzureAD_ClientId || '';

  ensureNotNullOrEmpty(tenantId, 'process.env.DVSA_MES_AzureAD_TenantId');
  ensureNotNullOrEmpty(applicationId, 'process.env.DVSA_MES_AzureAD_ClientId');

  const openidConfigRes = await nodeFetch(
    `https://login.microsoftonline.com/${tenantId}/.well-known/openid-configuration`,
  );
  const openidConfig = await openidConfigRes.json();

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
  });
}