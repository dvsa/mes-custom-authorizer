import { DynamoDB } from 'aws-sdk';
import { EmployeeId } from './AdJwtVerifier';

export default async function verifyExaminer(
  employeeId: EmployeeId,
): Promise<DynamoDB.Types.GetItemOutput> {

  const ddb = createDynamoClient();
  const result = await ddb.get({
    TableName: getUsersTableName(),
    Key: {
      staffNumber: employeeId,
    },
  }).promise();

  return result;
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
