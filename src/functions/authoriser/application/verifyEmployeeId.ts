import { DynamoDB } from 'aws-sdk';
import { VerifiedTokenPayload, EmployeeIdKey } from '../application/AdJwtVerifier';
import { extractEmployeeIdFromToken, isEmployeeIdEmptyOrNull } from './extractEmployeeIdFromToken';

export default async function verifyEmployeeId(
  verifiedToken: VerifiedTokenPayload, employeeIdExtKey: EmployeeIdKey): Promise<boolean> {

  const employeeId = extractEmployeeIdFromToken(verifiedToken, employeeIdExtKey);

  if (!employeeId || isEmployeeIdEmptyOrNull(employeeId)) {
    throw 'Verified Token does not have employeeId';
  }

  const ddb = createDynamoClient();
  const result = await ddb.get({
    TableName: getUsersTableName(),
    Key: {
      staffNumber: employeeId,
    },
  }).promise();

  if (!result || !result.Item) {
    return false;
  }

  return true;
}

function createDynamoClient() {
  return process.env.IS_OFFLINE
    ? new DynamoDB.DocumentClient({ endpoint: 'http://localhost:8000' })
    : new DynamoDB.DocumentClient();
}

function getUsersTableName(): string {
  let tableName = process.env.USERS_DDB_TABLE_NAME;
  if (tableName === undefined || tableName.length === 0) {
    console.log('No user table name set, using the default');
    tableName = 'user';
  }
  return tableName;
}
