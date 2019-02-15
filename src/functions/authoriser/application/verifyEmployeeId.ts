import { DynamoDB } from 'aws-sdk';
import { VerifiedTokenPayload } from '../application/AdJwtVerifier';

export default async function verifyEmployeeId(
  verifiedToken: VerifiedTokenPayload): Promise<boolean> {
  if (!verifiedToken['extn.employeeId'] || verifiedToken['extn.employeeId'].length === 0) {
    throw 'Verified Token does not have employeeId';
  }

  const employeeId = verifiedToken['extn.employeeId'][0];

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
