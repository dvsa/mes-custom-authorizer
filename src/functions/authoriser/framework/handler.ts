import { CustomAuthorizerEvent, CustomAuthorizerResult } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

import AdJwtVerifier, { VerifiedTokenPayload } from '../application/AdJwtVerifier';
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
  console.log('We are in authorizer', event);
  // One-time initialization
  if (adJwtVerifier === null) {
    adJwtVerifier = await createAdJwtVerifier();
  }

  // Get token from event, and verify
  const token = event.authorizationToken || '';
  ensureNotNullOrEmpty(token, 'event.authorizationToken');
  // const token = event.headers && event.headers.Authorization || '';
  // ensureNotNullOrEmpty(token, 'event.headers.Authorization');

  const methodArn = transformMethodArn.toAllVerbsAndAllResources(event.methodArn);

  let verifiedToken: VerifiedTokenPayload;
  try {
    verifiedToken = await adJwtVerifier.verifyJwt(token);
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

  try {
    // config.update({
    //   region: 'eu-west-1',
    // });

    const employeeId = verifiedToken['extn.employeeId'][0];

    const createDynamoClient = () => {
      return process.env.IS_OFFLINE
        ? new DynamoDB.DocumentClient({ endpoint: 'http://localhost:8000' })
        : new DynamoDB.DocumentClient();
    };

    const ddb = createDynamoClient();
    const result = await ddb.get({
      TableName: getUsersTableName(),
      Key: {
        staffNumber: employeeId,
      },
    }).promise();

    if (result === undefined || result === null) {
      throw 'There was no employeeId in Users table';
    }

    if (result.Item === undefined || result.Item === null) {
      throw 'There was no employeeId in Users table';
    }
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

  return createAuthResult(verifiedToken.unique_name, 'Allow', methodArn);
}

function getUsersTableName(): string {
  let tableName = process.env.USERS_DDB_TABLE_NAME;
  if (tableName === undefined || tableName.length === 0) {
    console.log('No journal table name set, using the default');
    tableName = 'journal';
  }
  return tableName;
}

/**
 * Ability to explicitly set the AdJwtVerifier, for use by the tests.
 */
export async function setAdJwtVerifier(adJwtVerifierOverride: AdJwtVerifier) {
  adJwtVerifier = adJwtVerifierOverride;
}
