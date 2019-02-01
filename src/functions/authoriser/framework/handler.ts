import * as util from 'util';
import { CustomAuthorizerEvent, CustomAuthorizerResult } from 'aws-lambda';
import * as jwksClient from 'jwks-rsa';
import nodeFetch from 'node-fetch';
import { AdJwtVerifier } from '../application/AdJwtVerifier';

const ensureNotNullOrEmpty = (val: any, fieldName: string) => {
  if (val === null || val === undefined || val === '') {
    throw `Error: ${fieldName} is null or empty`;
  }
};

/**
 * Creates an AdJwtVerifier that can verify the authenticity of Azure Active Directory JWTs.
 */
const createAdJwtVerifier = async (): Promise<AdJwtVerifier> => {
  const tenantId: string = process.env.DVSA_MES_AzureAD_TenantId || '';
  const applicationId: string = process.env.DVSA_MES_AzureAD_ClientId || '';

  ensureNotNullOrEmpty(tenantId, 'tenantId');
  ensureNotNullOrEmpty(applicationId, 'applicationId');

  const openidConfig = await (await nodeFetch(
    `https://login.microsoftonline.com/${tenantId}/.well-known/openid-configuration`,
  )).json();

  if (openidConfig.error_description) {
    throw `Failed to get openid configuration: ${openidConfig.error_description}`;
  }

  const jwksclient = jwksClient({
    jwksUri: openidConfig.jwks_uri,
    cache: true,
    cacheMaxEntries: 10,
  });

  return new AdJwtVerifier(applicationId, openidConfig.issuer, {
    getSigningKey: util.promisify(jwksclient.getSigningKey),
  });
};

/**
 * Helper to create AWS Custom Authorizer Result policy documents.
 */
type Effect = 'Allow' | 'Deny';
const createAuthResult = (principalId: string, effect: Effect, resource: string)
  : CustomAuthorizerResult => ({
    principalId,
    policyDocument: {
      Version: '2012-10-17', // default version
      Statement: [{
        Action: 'execute-api:Invoke', // default action
        Effect: effect,
        Resource: resource,
      }],
    },
  });

/**
 * Exported entry point to the Custom Authorizer Lambda.
 */
let adJwtVerifier: AdJwtVerifier | null = null;
export async function handler(event: CustomAuthorizerEvent) : Promise<CustomAuthorizerResult> {
  // One-time initialization
  if (adJwtVerifier === null) {
    adJwtVerifier = await createAdJwtVerifier();
  }

  // Get token from event, and verify
  const token = event.authorizationToken || '';
  ensureNotNullOrEmpty(token, 'event.authorizationToken');

  try {
    const verifiedToken = await adJwtVerifier.verifyJwt(token);
    return createAuthResult(verifiedToken.unique_name, 'Allow', event.methodArn);
  } catch (err) {
    const failedAuthLogMessage = JSON.stringify({
      err,
      event,
      message: 'Failed authorization. Responding with Deny.',
      reason: err && err.toString ? err.toString() : null,
      timestamp: new Date(),
    });
    console.log(failedAuthLogMessage);
    return createAuthResult('not-authorized', 'Deny', event.methodArn);
  }
}
