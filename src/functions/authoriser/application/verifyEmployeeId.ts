import { DynamoDB } from 'aws-sdk';
import { EmployeeId } from '../application/AdJwtVerifier';

export default async function verifyEmployeeId(
  employeeId: EmployeeId,
): Promise<boolean> {

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

export function createDynamoClient() {
  return process.env.IS_OFFLINE
    ? new DynamoDB.DocumentClient({ endpoint: 'http://localhost:8000' })
    : new DynamoDB.DocumentClient();
}

export function getUsersTableName(): string {
  let tableName = process.env.USERS_DDB_TABLE_NAME;
  if (tableName === undefined || tableName.length === 0) {
    console.log('No user table name set, using the default');
    tableName = 'user';
  }
  return tableName;
}
