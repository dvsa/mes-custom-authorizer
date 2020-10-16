import { CustomAuthorizerEvent, CustomAuthorizerResult } from 'aws-lambda';
import AdJwtVerifier, { EmployeeIdKey, EmployeeId, VerifiedTokenPayload } from '../application/AdJwtVerifier';
import * as transformMethodArn from '../application/transformMethodArn';
import { createLogger, Logger } from './createLogger';
import createAdJwtVerifier from './createAdJwtVerifier';
import ensureNotNullOrEmpty from './ensureNotNullOrEmpty';
import verifyExaminer from '../application/verifyExaminer';
import getEmployeeIdKey from '../application/getEmployeeIdKey';
import { extractEmployeeIdFromToken } from '../application/extractEmployeeIdFromToken';
import { hasDelegatedExaminerRole } from '../application/extractEmployeeRolesFromToken';

type Effect = 'Allow' | 'Deny';

let adJwtVerifier: AdJwtVerifier | null = null;
let failedAuthLogger: Logger | null = null;
let employeeId: EmployeeId | null;
let examinerRole: string;
let verifiedToken: VerifiedTokenPayload;
const role: string = 'role';
const DE: string = 'DE';
const DLG: string = 'DLG';

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

    if (hasDelegatedExaminerRole(verifiedToken)) {
      examinerRole = DLG;
      return createAuthResult(verifiedToken.preferred_username || 'N/A', 'Allow', methodArn);
    }

    const result = await verifyExaminer(employeeId);

    if (!result || !result.Item) {
      return handleError('The employee id was not found', event, methodArn);
    }
    // Default to DE role
    examinerRole = result.Item[role] as string || DE;

    return createAuthResult(verifiedToken.preferred_username || 'N/A', 'Allow', methodArn);
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
  const preferred_username = verifiedToken ? verifiedToken.preferred_username : null; // tslint:disable-line:variable-name max-line-length

  const failedAuthDetails = {
    err,
    event,
    failedAuthReason: err && err.toString ? err.toString() : null,
    timestamp: new Date(),
    employee: {
      id,
      name,
      preferred_username,
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
