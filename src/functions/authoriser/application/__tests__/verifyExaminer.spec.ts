import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {GetCommand, GetCommandOutput} from '@aws-sdk/lib-dynamodb';
import {mockClient} from 'aws-sdk-client-mock';
import verifyExaminer from '../verifyExaminer';

describe('verifyExaminer', () => {
  const dynamoDbMock = mockClient(DynamoDBClient);
  const ddbItem = {
    $metadata: {},
    Item: {
      staffNumber: '12345678',
      role: 'LDTM',
    },
  } as GetCommandOutput;

  beforeEach(() => {
    dynamoDbMock.reset();
  });

  describe('verifiedToken parameter', () => {
    it('should not throw an exception when employeeid is valid', async () => {
      dynamoDbMock.on(GetCommand).resolves(ddbItem);

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
      dynamoDbMock.on(GetCommand).resolves({});

      try {
        const result = await verifyExaminer('12345678');
        expect(result).toEqual({} as GetCommandOutput);
      } catch (err) {
        fail('verifyExaminer should not fail when no employeeId found in Users table');
      }
    });

    it('should return the db item when employeeId has been found', async () => {
      dynamoDbMock.on(GetCommand).resolves(ddbItem);

      try {
        const result = await verifyExaminer('12345678');
        expect(result).toEqual(ddbItem);
      } catch (err) {
        fail(`verifyExaminer should not fail, error: ${err}`);
      }
    });
  });
});
