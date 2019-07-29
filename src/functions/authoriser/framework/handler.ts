import { CustomAuthorizerEvent, CustomAuthorizerResult } from 'aws-lambda';
import AdJwtVerifier, { EmployeeIdKey, EmployeeId, VerifiedTokenPayload } from '../application/AdJwtVerifier';
import * as transformMethodArn from '../application/transformMethodArn';
import { createLogger, Logger } from './createLogger';
import createAdJwtVerifier from './createAdJwtVerifier';
import ensureNotNullOrEmpty from './ensureNotNullOrEmpty';
import verifyEmployeeId from '../application/verifyEmployeeId';
import getEmployeeIdKey from '../application/getEmployeeIdKey';
import { extractEmployeeIdFromToken } from '../application/extractEmployeeIdFromToken';
import getExaminerRole from '../application/getExaminerRole';

type Effect = 'Allow' | 'Deny';

let adJwtVerifier: AdJwtVerifier | null = null;
let failedAuthLogger: Logger | null = null;
let employeeId: EmployeeId | null;
let examinerRole: string;
let verifiedToken: VerifiedTokenPayload;

export async function handler(event: CustomAuthorizerEvent): Promise<CustomAuthorizerResult> {
  if (adJwtVerifier === null) {
    adJwtVerifier = await createAdJwtVerifier();
  }

  const token = event.authorizationToken || '';
  ensureNotNullOrEmpty(token, 'event.authorizationToken');

  const employeeIdExtKey: EmployeeIdKey = getEmployeeIdKey();
  ensureNotNullOrEmpty(employeeIdExtKey, 'employeeid or extn.employeeId');

  const methodArn = transformMethodArn.toAllVerbsAndAllResources(event.methodArn);

  try {
    verifiedToken = await adJwtVerifier.verifyJwt(token);
    employeeId = extractEmployeeIdFromToken(verifiedToken, employeeIdExtKey);
    if (employeeId === null) {
      throw new Error('Verified Token does not have employeeId');
    }

    examinerRole = await getExaminerRole(employeeId);
    const result = await verifyEmployeeId(employeeId);

    if (!result) {
      return handleError('The employee id was not found', event, methodArn);
    }
    return createAuthResult(verifiedToken.unique_name, 'Allow', methodArn);
  } catch (err) {
    return handleError(err, event, methodArn);
  }
}

function createAuthResult(
  principalId: string, effect: Effect, resource: string,
): CustomAuthorizerResult {
  const staffNumber = employeeId;
  const context = {
    staffNumber,
    examinerRole,
  };
  return {
    context,
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
  const id = employeeId || null;
  const name = verifiedToken ? verifiedToken.name : null;
  const unique_name = verifiedToken ? verifiedToken.unique_name : null; // tslint:disable-line:variable-name

  const failedAuthDetails = {
    err,
    event,
    failedAuthReason: err && err.toString ? err.toString() : null,
    timestamp: new Date(),
    employee: {
      id,
      name,
      unique_name,
    },
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
