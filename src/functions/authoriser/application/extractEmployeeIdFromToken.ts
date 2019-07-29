import { VerifiedTokenPayload, EmployeeIdKey, EmployeeId } from './AdJwtVerifier';

export const extractEmployeeIdFromToken = (
  verifiedToken: VerifiedTokenPayload,
  employeeIdKey: EmployeeIdKey,
): EmployeeId | null => {
  const employeeId = verifiedToken[employeeIdKey];
  if (typeof employeeId !== 'string' && !Array.isArray(employeeId)) {
    return null;
  }

  if (typeof employeeId === 'string') {
    return extractEmployeeIdFromString(employeeId);
  }
  return extractEmployeeIdFromArray(employeeId);
};

const extractEmployeeIdFromString = (employeeIdClaim: string): string | null => {
  if (employeeIdClaim.trim().length === 0) {
    return null;
  }
  const numericEmployeeId = Number.parseInt(employeeIdClaim, 10);
  if (Number.isNaN(numericEmployeeId)) {
    return null;
  }
  return numericEmployeeId.toString();
};

const extractEmployeeIdFromArray = (employeeIdClaimArr: any[]): string | null => {
  if (employeeIdClaimArr.length === 0) {
    return null;
  }
  const firstClaim = employeeIdClaimArr[0];
  if (typeof firstClaim !== 'string') {
    return null;
  }
  return extractEmployeeIdFromString(firstClaim);
};
