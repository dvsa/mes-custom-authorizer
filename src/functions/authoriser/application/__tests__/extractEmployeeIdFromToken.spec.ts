import { extractEmployeeIdFromToken } from '../extractEmployeeIdFromToken';
import { VerifiedTokenPayload } from '../AdJwtVerifier';

describe('extractEmployeeIdFromToken', () => {
  const token: VerifiedTokenPayload = {
    sub: 'sub',
    unique_name: 'unique_name',
    'extn.employeeId': ['12345678'],
    roles: [],
  };

  it('should return null if they payload does not have a property for the employeeId key', () => {
    const result = extractEmployeeIdFromToken(token, 'employeeid');

    expect(result).toBeNull();
  });

  it('should return null when the employeeId is a null property in the JWT payload', () => {
    const nullEmployeeIdToken: VerifiedTokenPayload = { ...token, employeeid: null };

    const result = extractEmployeeIdFromToken(nullEmployeeIdToken, 'employeeid');

    expect(result).toBeNull();
  });

  it('should return null when the employeeId is an empty string', () => {
    const emptyEmployeeIdToken: VerifiedTokenPayload = { ...token, employeeid: '' };

    const result = extractEmployeeIdFromToken(emptyEmployeeIdToken, 'employeeid');

    expect(result).toBeNull();
  });

  it('should return null when the employeeId is a blank string', () => {
    const blankEmployeeIdToken: VerifiedTokenPayload = { ...token, employeeid: '  ' };

    const result = extractEmployeeIdFromToken(blankEmployeeIdToken, 'employeeid');

    expect(result).toBeNull();
  });

  it('should return null when the employeeId key maps to an empty array', () => {
    const emptyArrayEmployeeIdToken: VerifiedTokenPayload = { ...token, employeeid: [] };

    const result = extractEmployeeIdFromToken(emptyArrayEmployeeIdToken, 'employeeid');

    expect(result).toBeNull();
  });

  it('should return null when employeeId is an array containing a single null', () => {
    const nullArrayEmployeeIdToken: VerifiedTokenPayload = { ...token, employeeid: [null] };

    const result = extractEmployeeIdFromToken(nullArrayEmployeeIdToken, 'employeeid');

    expect(result).toBeNull();
  });

  it('should return null when employeeId is an array containing a single empty string', () => {
    const singleEmptyArrayEmployeeIdToken: VerifiedTokenPayload = { ...token, employeeid: [''] };

    const result = extractEmployeeIdFromToken(singleEmptyArrayEmployeeIdToken, 'employeeid');

    expect(result).toBeNull();
  });

  it('should return null when employeeId is an array containing a single blank string', () => {
    const singleBlankArrayEmployeeIdToken: VerifiedTokenPayload = { ...token, employeeid: ['  '] };

    const result = extractEmployeeIdFromToken(singleBlankArrayEmployeeIdToken, 'employeeid');

    expect(result).toBeNull();
  });

  it('should return null when the employeeId value is a non-numeric string', () => {
    const singleNonNumArrayEmployeeIdToken: VerifiedTokenPayload = { ...token, employeeid: 'o123' };

    const result = extractEmployeeIdFromToken(singleNonNumArrayEmployeeIdToken, 'employeeid');

    expect(result).toBeNull();
  });

  it('should return the employeeId when its a string of a number', () => {
    const singleNumberArrayEmployeeIdToken: VerifiedTokenPayload = { ...token, employeeid: '123' };

    const result = extractEmployeeIdFromToken(singleNumberArrayEmployeeIdToken, 'employeeid');

    expect(result).toBe('123');
  });

  it('should return the employeeId with leading zeroes stripped when it has leading zeroes', () => {
    const singleZeroPaddedNumArrayEmployeeIdToken: VerifiedTokenPayload = { ...token, employeeid: '00123' };

    const result = extractEmployeeIdFromToken(singleZeroPaddedNumArrayEmployeeIdToken, 'employeeid');

    expect(result).toBe('123');
  });

  it('should return the first employeeId encountered if the property is an array', () => {
    const multiArrayEmployeeIdToken: VerifiedTokenPayload = { ...token, employeeid: ['00999', 'o111'] };

    const result = extractEmployeeIdFromToken(multiArrayEmployeeIdToken, 'employeeid');

    expect(result).toBe('999');
  });

});
