import * as awsSdkMock from 'aws-sdk-mock';
import * as sinon from 'sinon';

import { uniqueLogStreamName, createLogger } from '../createLogger';
import { CloudWatchLogs } from 'aws-sdk';

describe('Logger', () => {

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

  describe('createLogger', () => {

    let createLogGroupSpy;
    let createLogStreamSpy;
    let putLogEventsSpy;

    beforeEach(() => {

      awsSdkMock.restore('CloudWatchLogs', 'createLogGroup');
      awsSdkMock.restore('CloudWatchLogs', 'createLogStream');
      awsSdkMock.restore('CloudWatchLogs', 'putLogEvents');

      process.env.FAILED_LOGINS_CWLG_NAME = 'testLogGroupName';

    });

    it('should call the correct CloudWatchLogs methods', async () => {

      createLogGroupSpy = sinon.stub().resolves(true);
      createLogStreamSpy = sinon.stub().resolves(true);
      putLogEventsSpy = sinon.stub().resolves(true);

      awsSdkMock.mock('CloudWatchLogs', 'createLogGroup', createLogGroupSpy);
      awsSdkMock.mock('CloudWatchLogs', 'createLogStream', createLogStreamSpy);
      awsSdkMock.mock('CloudWatchLogs', 'putLogEvents', putLogEventsSpy);

      const logger = await createLogger('testLoggerName');
      logger('test error message', 'error');

      expect(createLogGroupSpy.calledWith({ logGroupName: 'testLogGroupName' })).toBe(true);
      expect(createLogStreamSpy.called).toBe(true);
      expect(putLogEventsSpy.called).toBe(true);
    });

    it('should swallow a \"ResourceAlreadyExistsException\" error', async () => {

      createLogStreamSpy = sinon.stub().resolves(true);
      putLogEventsSpy = sinon.stub().resolves(true);

      awsSdkMock.mock('CloudWatchLogs', 'createLogGroup', async (params) => {
        throw {
          errorType: 'ResourceAlreadyExistsException',
          code: 'ResourceAlreadyExistsException',
        };
      });
      awsSdkMock.mock('CloudWatchLogs', 'createLogStream', createLogStreamSpy);
      awsSdkMock.mock('CloudWatchLogs', 'putLogEvents', putLogEventsSpy);

      const logger = await createLogger('testLoggerName');
      logger('test error message', 'error');

      expect(createLogStreamSpy.called).toBe(true);
      expect(putLogEventsSpy.called).toBe(true);
    });

    it('should throw on any other exceptions', async (done) => {

      createLogStreamSpy = sinon.stub().resolves(true);
      putLogEventsSpy = sinon.stub().resolves(true);

      awsSdkMock.mock('CloudWatchLogs', 'createLogGroup', async (params) => {
        throw {
          errorType: 'SomeOtherException',
          code: 'SomeOtherException',
        };
      });
      awsSdkMock.mock('CloudWatchLogs', 'createLogStream', createLogStreamSpy);
      awsSdkMock.mock('CloudWatchLogs', 'putLogEvents', putLogEventsSpy);

      try {
        const logger = await createLogger('testLoggerName');
      } catch (e) {
        expect(e).toBeTruthy();
        done();
      }
    });
  });
});
