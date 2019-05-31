import * as aws from 'aws-sdk-mock';

import { VerifiedTokenPayload, EmployeeIdKey, EmployeeId } from '../AdJwtVerifier';
import verifyEmployeeId from '../verifyEmployeeId';

describe('verifyEmployeeId', () => {

  let employeeIdExtKey = 'extn.employeeId' as EmployeeIdKey;
  let employeeId: EmployeeId;

  beforeEach(() => {
    employeeIdExtKey = 'extn.employeeId';
    aws.restore('DynamoDB.DocumentClient');
  });

  describe('verifiedToken parameter', () => {
    it('should throw an exception when employeeId is undefined', async () => {

      aws.mock('DynamoDB.DocumentClient', 'get', async params => ({}));
      const verifiedToken: VerifiedTokenPayload = {
        sub: 'sub',
        unique_name: 'unique_name',
        'extn.employeeId': [],
      };

      try {
        await verifyEmployeeId(verifiedToken, verifiedToken['extn.employeeId']);
        fail('verifyEmployeeId should not succeed when employeeId is undefined');
      } catch (err) {
        expect(err).toBe('Verified Token does not have employeeId');
      }
    });

    it('should throw an exception when employeeid is an empty string', async () => {

      aws.mock('DynamoDB.DocumentClient', 'get', async params => ({}));

      const verifiedToken: VerifiedTokenPayload = {
        sub: 'sub',
        unique_name: 'unique_name',
        employeeid: '',
      };

      try {
        await verifyEmployeeId(verifiedToken, verifiedToken.employeeid);
        fail('verifyEmployeeId should not succeed when employeeid is an empty string');
      } catch (err) {
        expect(err).toBe('Verified Token does not have employeeId');
      }
    });

    it('should not throw an exception when employeeid is valid', async () => {

      aws.mock('DynamoDB.DocumentClient', 'get', async params => ({}));
      employeeIdExtKey = 'employeeid';
      employeeId = '1435134';

      const verifiedToken: VerifiedTokenPayload = {
        sub: 'sub',
        unique_name: 'unique_name',
        employeeid: '1435134',
      };

      try {
        const result = await verifyEmployeeId(verifiedToken, employeeId);
        expect(result).toBeDefined();
      } catch (err) {
        fail('verifyEmployeeId should not fail when employeeid is valid');
      }
    });
  });

  describe('dynamo db get', () => {
    beforeEach(() => {
      employeeIdExtKey = 'extn.employeeId';
      aws.restore('DynamoDB.DocumentClient');
    });

    it('should throw an exception when no employeeId found in Users table', async () => {

      employeeId = '12345678';
      aws.mock('DynamoDB.DocumentClient', 'get', async params => ({}));
      const verifiedToken: VerifiedTokenPayload = {
        sub: 'sub',
        unique_name: 'unique_name',
        'extn.employeeId': ['12345678'],
      };

      try {
        const result = await verifyEmployeeId(verifiedToken, employeeId);
        expect(result).toBe(false);
      } catch (err) {
        fail('verifyEmployeeId should not fail when no employeeId found in Users table');
      }
    });

    it('should return the verifed token when employeeId has been found', async () => {

      employeeId = '12345678';
      aws.mock(
        'DynamoDB.DocumentClient',
        'get',
        async params => ({
          Item: {
            staffNumber: '12345678',
          },
        }),
      );
      const verifiedToken: VerifiedTokenPayload = {
        sub: 'sub',
        unique_name: 'unique_name',
        'extn.employeeId': ['12345678'],
      };

      try {
        const result = await verifyEmployeeId(verifiedToken, employeeId);
        expect(result).toBeDefined();
      } catch (err) {
        fail(`verifyEmployeeId should not fail, error: ${err}`);
      }
    });
  });
});
