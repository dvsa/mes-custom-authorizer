import { CustomAuthorizerEvent, CustomAuthorizerResult } from 'aws-lambda';
import AdJwtVerifier from '../application/AdJwtVerifier';
import createAdJwtVerifier from './createAdJwtVerifier';
import ensureNotNullOrEmpty from './ensureNotNullOrEmpty';
import * as transformMethodArn from '../application/transformMethodArn';

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
export async function handler(event: CustomAuthorizerEvent): Promise<CustomAuthorizerResult> {
  // One-time initialization
  if (adJwtVerifier === null) {
    adJwtVerifier = await createAdJwtVerifier();
  }

  // Get token from event, and verify
  const token = event.authorizationToken || '';
  ensureNotNullOrEmpty(token, 'event.authorizationToken');

  const methodArn = transformMethodArn.toAllVerbsAndAllResources(event.methodArn);

  try {
    const verifiedToken = await adJwtVerifier.verifyJwt(token);
    return createAuthResult(verifiedToken.unique_name, 'Allow', methodArn);
  } catch (err) {
    const failedAuthLogMessage = JSON.stringify({
      message: 'Failed authorization. Responding with Deny.',
      reason: err && err.toString ? err.toString() : null,
      timestamp: new Date(),
      err, event, // tslint:disable-line
    });
    console.log(failedAuthLogMessage);
    return createAuthResult('not-authorized', 'Deny', methodArn);
  }
}
