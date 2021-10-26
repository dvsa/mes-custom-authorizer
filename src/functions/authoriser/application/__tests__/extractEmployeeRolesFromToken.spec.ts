import { VerifiedTokenPayload } from '../AdJwtVerifier';
import { extractEmployeeRolesFromToken, hasDelegatedExaminerRole } from '../extractEmployeeRolesFromToken';

describe('extractEmployeeRolesFromToken', () => {
  const token: Partial<VerifiedTokenPayload> = {
    sub: 'sub',
    preferred_username: 'preferred_username',
    employeeid: '1234567',
  };

  it('should return the entire role array when not empty', () => {
    expect(extractEmployeeRolesFromToken({ ...token, roles: ['role1', 'role2'] } as VerifiedTokenPayload))
      .toEqual(['role1', 'role2']);
  });

  it('should return an empty array when roles key is present but empty', () => {
    expect(extractEmployeeRolesFromToken({ ...token, roles: [] } as VerifiedTokenPayload)).toEqual([]);
  });

  it('should return an empty array when no roles key is found', () => {
    expect(extractEmployeeRolesFromToken(token as any)).toEqual([]);
  });
});

describe('hasDelegatedExaminerRole', () => {
  const token: Partial<VerifiedTokenPayload> = {
    sub: 'sub',
    preferred_username: 'preferred_username',
    employeeid: '1234567',
  };

  it('should return true meaning the delegated examiner role is present', () => {
    expect(hasDelegatedExaminerRole({ ...token, roles: ['DelExaminer'] } as VerifiedTokenPayload))
      .toEqual(true);
  });

  it('should return false meaning no delegated examiner role is present', () => {
    expect(hasDelegatedExaminerRole({ ...token, roles: ['SomeExaminer'] } as VerifiedTokenPayload))
      .toEqual(false);
  });
});
