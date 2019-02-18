import { CustomAuthorizerEvent, CustomAuthorizerResult } from 'aws-lambda';
import { Logger } from 'winston';
import AdJwtVerifier from '../application/AdJwtVerifier';
import * as transformMethodArn from '../application/transformMethodArn';
import createFailedAuthLogger from './createFailedAuthLogger';
import createAdJwtVerifier from './createAdJwtVerifier';
import ensureNotNullOrEmpty from './ensureNotNullOrEmpty';
import verifyEmployeeId from '../application/verifyEmployeeId';

type Effect = 'Allow' | 'Deny';

let adJwtVerifier: AdJwtVerifier | null = null;
let failedAuthLogger: Logger = createFailedAuthLogger();

process.on('exit', () => {
  if (failedAuthLogger !== null) {
    failedAuthLogger.end();
  }
});

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

function handleError(err: any, event: CustomAuthorizerEvent, methodArn: string) {
  const failedAuthDetails = {
    failedAuthReason: err && err.toString ? err.toString() : null,
    timestamp: new Date(),
    err, event, // tslint:disable-line
  };
  failedAuthLogger.error('Failed authorization. Responding with Deny.', failedAuthDetails);
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
