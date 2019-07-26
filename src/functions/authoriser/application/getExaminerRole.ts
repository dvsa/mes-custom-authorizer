import { EmployeeId } from './AdJwtVerifier';
import { createDynamoClient, getUsersTableName } from './verifyEmployeeId';

export default async function getExaminerRole(employeeId: EmployeeId): Promise<string> {
  const role: string = 'role';
  const DE: string = 'DE';

  const ddb = createDynamoClient();
  const result = await ddb.get({
    TableName: getUsersTableName(),
    Key: {
      staffNumber: employeeId,
    },
    ProjectionExpression: '#examinerRole',
    ExpressionAttributeNames: { '#examinerRole': role },
  }).promise();

  // if no result is obtained, they are not an LDTM
  if (!result || !result.Item) {
    return DE;
  }

  return result.Item[role];
}
