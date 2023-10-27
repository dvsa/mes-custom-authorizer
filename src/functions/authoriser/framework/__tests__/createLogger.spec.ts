import {AwsError, mockClient} from 'aws-sdk-client-mock';
import * as sinon from 'sinon';
import {CloudWatchLogsClient, CreateLogStreamCommand, PutLogEventsCommand} from '@aws-sdk/client-cloudwatch-logs';
import { uniqueLogStreamName, createLogger } from '../createLogger';

describe('Logger', () => {
  const cloudWatchMock = mockClient(CloudWatchLogsClient);

  beforeEach(() => {
    cloudWatchMock.reset();

    cloudWatchMock.on(CreateLogStreamCommand).resolves(Promise.resolve({}));
    cloudWatchMock.on(PutLogEventsCommand).resolves(Promise.resolve({nextSequenceToken: 'example-sequenceToken-123'}));
  });

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
    let createLogStreamSpy;
    let putLogEventsSpy;

    it('should call the correct CloudWatchLogs methods', async () => {
      spyOn(CloudWatchLogsClient.prototype, 'send').and.callFake(async () => ({}));

      createLogStreamSpy = sinon.stub().resolves(true);
      putLogEventsSpy = sinon.stub().resolves(true);

      const logger = await createLogger('testLoggerName', 'testLogGroupName');
      await logger('test error message', 'error');

      // @ts-ignore
      expect(CloudWatchLogsClient.prototype.send).toHaveBeenCalledWith(jasmine.any(CreateLogStreamCommand));
      // @ts-ignore
      expect(CloudWatchLogsClient.prototype.send).toHaveBeenCalledWith(jasmine.any(PutLogEventsCommand));
    });

    it('should swallow a \"ResourceAlreadyExistsException\" error and not throw', async () => {
      putLogEventsSpy = sinon.stub().resolves(true);
      cloudWatchMock.on(CreateLogStreamCommand).rejects({
        errorType: 'ResourceAlreadyExistsException',
        code: 'ResourceAlreadyExistsException',
      } as AwsError);

      try {
        const logger = await createLogger('testLoggerName', 'testLogGroupName');
        await logger('test error message', 'error');
      } catch (er) {
        expect(er).toBeFalsy();
      }
    });

    it('should throw on any other exceptions', async () => {
      putLogEventsSpy = sinon.stub().resolves(true);
      cloudWatchMock.on(CreateLogStreamCommand).rejects({
        errorType: 'SomeOtherException',
        code: 'SomeOtherException',
      } as AwsError);

      let errorThrown: boolean = false;

      try {
        await createLogger('testLoggerName', 'testLogGroupName');
      } catch (e) {
        expect(e).toBeTruthy();
        errorThrown = true;
      }

      expect(errorThrown).toEqual(true);
    });
  });
});
