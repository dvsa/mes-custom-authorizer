import * as aws from 'aws-sdk-mock';

import { VerifiedTokenPayload, EmployeeIdKey } from '../AdJwtVerifier';
import verifyEmployeeId from '../verifyEmployeeId';

describe('verifyEmployeeId', () => {
  let employeeIdExtKey = 'extn.employeeId' as EmployeeIdKey;
  describe('verifiedToken parameter', () => {
    it('should throw an exception when extn.employeeId is undefined', async () => {
      const verifiedToken: VerifiedTokenPayload = {
        sub: 'sub',
        unique_name: 'unique_name',
        'extn.employeeId': [],
      };

      try {
        await verifyEmployeeId(verifiedToken, employeeIdExtKey);
      } catch (err) {
        expect(err).toBe('Verified Token does not have employeeId');
      }
    });

    it('should throw an exception when employeeid is an empty string', async () => {

      employeeIdExtKey = 'employeeid';

      const verifiedToken: VerifiedTokenPayload = {
        sub: 'sub',
        unique_name: 'unique_name',
        employeeid: '',
      };

      try {
        await verifyEmployeeId(verifiedToken, employeeIdExtKey);
      } catch (err) {
        expect(err).toBe('Verified Token does not have employeeId');
      }
    });

    it('should not throw an exception when employeeid is valid', async () => {

      employeeIdExtKey = 'employeeid';

      const verifiedToken: VerifiedTokenPayload = {
        sub: 'sub',
        unique_name: 'unique_name',
        employeeid: '1435134',
      };

      expect(async () => {
        await verifyEmployeeId(verifiedToken, employeeIdExtKey);
      }).not.toThrow();
    });
  });

  describe('dynamo db get', () => {
    beforeEach(() => {
      employeeIdExtKey = 'extn.employeeId';
      aws.restore('DynamoDB.DocumentClient');
    });

    it('should throw an exception when no employeeId found in Users table', async () => {
      aws.mock('DynamoDB.DocumentClient', 'get', async params => ({}));
      const verifiedToken: VerifiedTokenPayload = {
        sub: 'sub',
        unique_name: 'unique_name',
        'extn.employeeId': ['12345678'],
      };

      try {
        await verifyEmployeeId(verifiedToken, employeeIdExtKey);
      } catch (err) {
        expect(err).toBe('The employee id was not found');
      }
    });

    it('should return the verifed token when employeeId has been found', () => {
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

      expect(async () => {
        await verifyEmployeeId(verifiedToken, employeeIdExtKey);
      }).not.toThrow();
    });
  });
});
