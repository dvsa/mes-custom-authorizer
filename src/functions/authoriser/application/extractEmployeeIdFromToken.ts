import { VerifiedTokenPayload, EmployeeIdKey, EmployeeId } from './AdJwtVerifier';

export const extractEmployeeIdFromToken = (
  verifiedToken: VerifiedTokenPayload,
  employeeIdKey: EmployeeIdKey): EmployeeId | null => {

  const employeeId = verifiedToken[employeeIdKey];
  return Array.isArray(employeeId) ? employeeId[0] : employeeId;

};
