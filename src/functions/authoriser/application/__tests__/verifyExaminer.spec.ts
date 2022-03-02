import * as aws from 'aws-sdk-mock';

import { VerifiedTokenPayload, EmployeeIdKey } from '../AdJwtVerifier';
import verifyExaminer from '../verifyExaminer';
import { DynamoDB } from 'aws-sdk';

describe('verifyExaminer', () => {

  beforeEach(() => {
    aws.restore('DynamoDB.DocumentClient');
  });

  describe('verifiedToken parameter', () => {
    it('should not throw an exception when employeeid is valid', async () => {

      aws.mock('DynamoDB.DocumentClient', 'get', async (params: any) => ({}));

      try {
        const result = await verifyExaminer('1435134');
        expect(result).toBeDefined();
      } catch (err) {
        fail('verifyExaminer should not fail when employeeid is valid');
      }
    });
  });

  describe('dynamo db get', () => {
    it('should return an empty object when no employeeId found in Users table', async () => {
      aws.mock('DynamoDB.DocumentClient', 'get', async (params: any) => ({}));

      try {
        const result = await verifyExaminer('12345678');
        expect(result).toEqual({});
      } catch (err) {
        fail('verifyExaminer should not fail when no employeeId found in Users table');
      }
    });

    it('should return the db item when employeeId has been found', async () => {
      const ddbItem = {
        Item: {
          staffNumber: '12345678',
          role: 'LDTM',
        },
      };
      aws.mock(
        'DynamoDB.DocumentClient',
        'get',
        async (params: any) => ddbItem,
      );

      try {
        const result = await verifyExaminer('12345678');
        expect(result).toEqual(ddbItem as DynamoDB.Types.GetItemOutput);
      } catch (err) {
        fail(`verifyExaminer should not fail, error: ${err}`);
      }
    });
  });

});
