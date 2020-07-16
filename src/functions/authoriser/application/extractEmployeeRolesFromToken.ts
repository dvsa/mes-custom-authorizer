import { VerifiedTokenPayload } from './AdJwtVerifier';

const USER_ROLES_KEY: string = 'roles';

enum AccessRole {
    DELEGATED_EXAMINER = 'DelExaminer',
}

export const extractEmployeeRolesFromToken = (verifiedToken: VerifiedTokenPayload): string[] => {
  const employeeRoles: string[] = verifiedToken[USER_ROLES_KEY];

  if (!employeeRoles || employeeRoles.length === 0) {
    return [];
  }
  return employeeRoles;
};

export const hasDelegatedExaminerRole = (verifiedToken: VerifiedTokenPayload): boolean => {
  return extractEmployeeRolesFromToken(verifiedToken).includes(AccessRole.DELEGATED_EXAMINER);
};
