import {CloudWatchLogsClient, CreateLogStreamCommand, PutLogEventsCommand} from '@aws-sdk/client-cloudwatch-logs';
import { randomBytes } from 'crypto';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type Bag = { [propName: string]: any };

export type Logger = (message: string, level: LogLevel, logData?: Bag) => Promise<void>;

export const uniqueLogStreamName = (loggerName: string): string => {
  const date = new Date();
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  const randomUuid = randomBytes(16).toString('hex');
  return `${loggerName}-${year}-${month}-${day}-${randomUuid}`;
};

function ignoreResourceAlreadyExistsException(err: any) {
  if ((err.errorType || err.code) !== 'ResourceAlreadyExistsException') {
    throw err;
  }
}

async function createCloudWatchLogger(logGroupName: string, loggerName: string) {
  const cloudWatchLogs = new CloudWatchLogsClient();
  const logStreamName = uniqueLogStreamName(loggerName);

  await cloudWatchLogs.send(
    new CreateLogStreamCommand({ logGroupName, logStreamName })
  ).catch(
    (err) => ignoreResourceAlreadyExistsException(err),
  );

  let sequenceToken: string | undefined = undefined;

  const cloudWatchLogger = async (json: string) => {
    const logResult = await cloudWatchLogs.send(
      new PutLogEventsCommand({
        logGroupName,
        logStreamName,
        sequenceToken,
        logEvents: [
          {
            message: json,
            timestamp: new Date().getTime(),
          },
        ],
      })
    );

    sequenceToken = logResult.nextSequenceToken;
  };

  console.log(`Initialised Custom CloudWatch logging to: ${logGroupName}/${logStreamName}`);
  return cloudWatchLogger;
}

export async function createLogger(loggerName: string, cloudWatchLogGroupName: string | undefined): Promise<Logger> {
  // If the `cloudWatchLogGroupName` variable is set then log to that CloudWatch log group.
  // This is also used to indicate we are running in the infrastructure, so the Amazon SDK will
  // automatically pull access credentials from IAM Role.
  const cloudWatchLogger = (cloudWatchLogGroupName && cloudWatchLogGroupName.length > 0)
    ? await createCloudWatchLogger(cloudWatchLogGroupName, loggerName)
    : null;

  // Create and return the logging delegate
  const logger: Logger = async (message: string, level: LogLevel, logData?: Bag) => {
    const json = JSON.stringify(Object.assign({}, logData, { loggerName, message, level }));

    console.log(json);

    if (cloudWatchLogger) {
      await cloudWatchLogger(json);
    }
  };

  return logger;
}
