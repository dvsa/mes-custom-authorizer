import { VerifiedTokenPayload, EmployeeIdKey, EmployeeId } from './AdJwtVerifier';

export const extractEmployeeIdFromToken = (
  verifiedToken: VerifiedTokenPayload,
  employeeIdKey: EmployeeIdKey): EmployeeId | null => {

  const employeeId = verifiedToken[employeeIdKey];
  return Array.isArray(employeeId) ? employeeId[0] : employeeId;

};

export const isEmployeeIdEmptyOrNull = (employeeId: EmployeeId): boolean => {
  if (Array.isArray(employeeId)) return employeeId.length === 0;
  if (typeof employeeId === 'string') return employeeId === '';
  if (typeof employeeId === 'undefined') return false;
  throw new Error('Provided employee id is neither an array or a string');
};
