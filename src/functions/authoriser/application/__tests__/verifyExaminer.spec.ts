import * as aws from 'aws-sdk-mock';

import { VerifiedTokenPayload, EmployeeIdKey } from '../AdJwtVerifier';
import verifyExaminer from '../verifyExaminer';

describe('verifyExaminer', () => {

  beforeEach(() => {
    aws.restore('DynamoDB.DocumentClient');
  });

  describe('verifiedToken parameter', () => {
    it('should not throw an exception when employeeid is valid', async () => {

      aws.mock('DynamoDB.DocumentClient', 'get', async params => ({}));

      try {
        const result = await verifyExaminer('1435134');
        expect(result).toBeDefined();
      } catch (err) {
        fail('verifyExaminer should not fail when employeeid is valid');
      }
    });
  });

  describe('dynamo db get', () => {
    it('should return false when no employeeId found in Users table', async () => {
      aws.mock('DynamoDB.DocumentClient', 'get', async params => ({}));

      try {
        const result = await verifyExaminer('12345678');
        expect(JSON.stringify(result)).toEqual(JSON.stringify({}));
      } catch (err) {
        fail('verifyExaminer should not fail when no employeeId found in Users table');
      }
    });

    it('should return the verifed token when employeeId has been found', async () => {
      aws.mock(
        'DynamoDB.DocumentClient',
        'get',
        async params => ({
          Item: {
            staffNumber: '12345678',
          },
        }),
      );

      try {
        const result = await verifyExaminer('12345678');
        expect(result).toBeDefined();
      } catch (err) {
        fail(`verifyExaminer should not fail, error: ${err}`);
      }
    });
  });

});
