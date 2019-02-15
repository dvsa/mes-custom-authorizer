import * as aws from 'aws-sdk-mock';

import { VerifiedTokenPayload } from '../AdJwtVerifier';
import verifyEmployeeId from '../verifyEmployeeId';

describe('verifyEmployeeId', () => {
  describe('veriedToken parameter', () => {
    it('should throw an exception when extn.employeeId is undefined', async () => {
      const verifiedToken: VerifiedTokenPayload = {
        sub: 'sub',
        unique_name: 'unique_name',
        'extn.employeeId': [],
      };

      try {
        await verifyEmployeeId(verifiedToken);
      } catch (err) {
        expect(err).toBe('Verified Token does not have employeeId');
      }
    });
  });

  describe('dynamo db get', () => {
    beforeEach(() => {
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
        await verifyEmployeeId(verifiedToken);
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
        await verifyEmployeeId(verifiedToken);
      }).not.toThrow();
    });
  });
});
