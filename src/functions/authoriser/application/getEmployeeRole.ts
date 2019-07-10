import { isEmployeeIdEmptyOrNull } from './extractEmployeeIdFromToken';
import { EmployeeId } from './AdJwtVerifier';
import { createDynamoClient, getUsersTableName } from './verifyEmployeeId';

export default async function getEmployeeRole(employeeId: EmployeeId): Promise<string> {
  const role: string = 'role';
  const DE: string = 'DE';

  if (!employeeId || isEmployeeIdEmptyOrNull(employeeId)) {
    throw 'Verified Token does not have employeeId';
  }

  const ddb = createDynamoClient();
  const result = await ddb.get({
    TableName: getUsersTableName(),
    Key: {
      staffNumber: employeeId,
    },
    ProjectionExpression: role,
  }).promise();

  // if no result is obtained, they are not an LDTM
  if (!result || !result.Item) {
    return DE;
  }

  return result.Item[role];
}
