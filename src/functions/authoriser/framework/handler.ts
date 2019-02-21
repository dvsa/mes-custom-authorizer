import { CustomAuthorizerEvent, CustomAuthorizerResult } from 'aws-lambda';
import AdJwtVerifier from '../application/AdJwtVerifier';
import * as transformMethodArn from '../application/transformMethodArn';
import { createLogger, Logger } from './createLogger';
import createAdJwtVerifier from './createAdJwtVerifier';
import ensureNotNullOrEmpty from './ensureNotNullOrEmpty';
import verifyEmployeeId from '../application/verifyEmployeeId';

type Effect = 'Allow' | 'Deny';

let adJwtVerifier: AdJwtVerifier | null = null;
let failedAuthLogger: Logger | null = null;

export async function handler(event: CustomAuthorizerEvent): Promise<CustomAuthorizerResult> {
  if (adJwtVerifier === null) {
    adJwtVerifier = await createAdJwtVerifier();
  }

  const token = event.authorizationToken || '';
  ensureNotNullOrEmpty(token, 'event.authorizationToken');

  const methodArn = transformMethodArn.toAllVerbsAndAllResources(event.methodArn);

  try {
    const verifiedToken = await adJwtVerifier.verifyJwt(token);
    const result = await verifyEmployeeId(verifiedToken);
    if (!result) {
      return handleError('The employee id was not found', event, methodArn);
    }
    return createAuthResult(verifiedToken.unique_name, 'Allow', methodArn);
  } catch (err) {
    return handleError(err, event, methodArn);
  }
}

function createAuthResult(
  principalId: string, effect: Effect, resource: string): CustomAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17', // default version
      Statement: [{
        Action: 'execute-api:Invoke', // default action
        Effect: effect,
        Resource: resource,
      }],
    },
  };
}

async function handleError(err: any, event: CustomAuthorizerEvent, methodArn: string) {
  const failedAuthDetails = {
    err,
    event,
    failedAuthReason: err && err.toString ? err.toString() : null,
    timestamp: new Date(),
  };

  if (failedAuthLogger === null) {
    failedAuthLogger = await createLogger('FailedAuthLogger', process.env.FAILED_LOGINS_CWLG_NAME);
  }
  await failedAuthLogger('Failed authorization. Responding with Deny.', 'error', failedAuthDetails);

  return createAuthResult('not-authorized', 'Deny', methodArn);
}

/**
 * Ability to explicitly set the AdJwtVerifier, for use by the tests.
 */
export async function setAdJwtVerifier(adJwtVerifierOverride: AdJwtVerifier) {
  adJwtVerifier = adJwtVerifierOverride;
}

/**
 * Ability to explicitly set the Failed Authorisation Logger, for use by the tests.
 */
export async function setFailedAuthLogger(failedAuthLoggerOverride: Logger) {
  failedAuthLogger = failedAuthLoggerOverride;
}
