import * as awsSdkMock from 'aws-sdk-mock';
import * as sinon from 'sinon';

import { uniqueLogStreamName, createLogger } from '../createLogger';
import { CloudWatchLogs } from 'aws-sdk';

describe('createLogger', () => {

  describe('uniqueLogStreamName', () => {
    const sut = uniqueLogStreamName;

    it('returns a string in the expected format', () => {
      // ACT
      const result = sut('LoggerName');

      // ASSERT
      expect(result).toMatch(/^LoggerName-\d\d\d\d-\d\d-\d\d-[0-9a-f]{32}$/);
    });

    it('generates unique names each time', () => {
      const results = new Set();
      const countToGenerate = 50000;

      // ACT
      for (let i = 0; i < countToGenerate; i = i + 1) {
        const result = sut('LoggerName');
        results.add(result);
      }

      // ASSERT
      expect(results.size).toEqual(countToGenerate);
    });
  });

  describe('Logger', () => {

    const createLogGroupSpy = sinon.stub().resolves(true);
    const createLogStreamSpy = sinon.stub().resolves(true);
    const putLogEventsSpy = sinon.stub().resolves(true);

    beforeEach(() => {

      awsSdkMock.mock('CloudWatchLogs', 'createLogGroup', createLogGroupSpy);
      awsSdkMock.mock('CloudWatchLogs', 'createLogStream', createLogStreamSpy);
      awsSdkMock.mock('CloudWatchLogs', 'putLogEvents', putLogEventsSpy);

      process.env.FAILED_LOGINS_CWLG_NAME = 'testLogGroupName';

    });

    it('should call the correct CloudWatchLogs methods', async () => {
      const logger = await createLogger('testLoggerName');
      logger('test error message', 'error');

      expect(createLogGroupSpy.calledWith({ logGroupName: 'testLogGroupName' })).toBe(true);
      expect(createLogStreamSpy.called).toBe(true);
      expect(putLogEventsSpy.called).toBe(true);
    });
  });
});
