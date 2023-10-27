import {GetCommand} from '@aws-sdk/lib-dynamodb';
import {DynamoDBClient, DynamoDBClientConfig} from '@aws-sdk/client-dynamodb';
import {EmployeeId} from './AdJwtVerifier';

export default async function verifyExaminer(
  employeeId: EmployeeId,
) {
  const ddb = createDynamoClient();

  return await ddb.send(
    new GetCommand({
      TableName: getUsersTableName(),
      Key: { staffNumber: employeeId },
    })
  );
}

export function createDynamoClient() {
  const opts = { region: 'eu-west-1' } as DynamoDBClientConfig;

  if (process.env.IS_OFFLINE === 'true') {
    // warn('Using SLS offline');
    opts.endpoint = process.env.DDB_OFFLINE_ENDPOINT;
  }

  return new DynamoDBClient(opts);
}

export function getUsersTableName(): string {
  let tableName = process.env.USERS_DDB_TABLE_NAME;
  if (tableName === undefined || tableName.length === 0) {
    console.log('No user table name set, using the default');
    tableName = 'user';
  }
  return tableName;
}
