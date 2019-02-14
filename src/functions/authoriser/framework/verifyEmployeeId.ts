import { DynamoDB } from 'aws-sdk';

export async function verifyEmployeeId(verifiedToken: any): Promise<any> {
  const employeeId = verifiedToken['extn.employeeId'][0];

  const createDynamoClient = () => {
    return process.env.IS_OFFLINE
      ? new DynamoDB.DocumentClient({
        region: process.env.AWS_REGION,
        endpoint: 'http://localhost:8000',
      })
      : new DynamoDB.DocumentClient();
  };

  const ddb = createDynamoClient();
  const result = await ddb.get({
    TableName: getUsersTableName(),
    Key: {
      staffNumber: employeeId,
    },
  }).promise();

  if (!result || !result.Item) {
    throw 'There was no employeeId in Users table';
  }

  return verifiedToken;
}

function getUsersTableName(): string {
  let tableName = process.env.USERS_DDB_TABLE_NAME;
  if (tableName === undefined || tableName.length === 0) {
    console.log('No user table name set, using the default');
    tableName = 'user';
  }
  return tableName;
}
