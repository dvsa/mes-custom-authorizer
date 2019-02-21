import { CloudWatchLogs } from 'aws-sdk';
import { randomBytes } from 'crypto';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type Bag = { [propName: string]: any };

export type Logger = (message: string, level: LogLevel, logData?: Bag) => Promise<void>;

export const uniqueLogStreamName = (loggerName: string): string => {
  const date = new Date();
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth().toString().padStart(2, '0');
  const day = date.getUTCDay().toString().padStart(2, '0');
  const randomUuid = randomBytes(16).toString('hex');
  return `${loggerName}-${year}-${month}-${day}-${randomUuid}`;
};

function ignoreResourceAlreadyExistsException(err: any) {
  if ((err.errorType || err.code) !== 'ResourceAlreadyExistsException') {
    throw err;
  }
}

async function createCloudWatchLogger(logGroupName: string, loggerName: string) {
  const cloudWatchLogs = new CloudWatchLogs();
  const logStreamName = uniqueLogStreamName(loggerName);

  await cloudWatchLogs.createLogStream({ logGroupName, logStreamName }).promise()
    .catch(ignoreResourceAlreadyExistsException);

  let sequenceToken: CloudWatchLogs.SequenceToken | undefined = undefined;

  const cloudWatchLogger = async (json: string) => {
    const logResult = await cloudWatchLogs.putLogEvents({
      logGroupName,
      logStreamName,
      sequenceToken,
      logEvents: [
        {
          message: json,
          timestamp: new Date().getTime(),
        },
      ],
    }).promise();

    sequenceToken = logResult.nextSequenceToken;
  };

  console.log(`Initialised Custom CloudWatch logging to: ${logGroupName}/${logStreamName}`);
  return cloudWatchLogger;
}

export async function createLogger(loggerName: string): Promise<Logger> {
  // If the `FAILED_LOGINS_CWLG_NAME` environment variable is set then log failed auth messages
  // to that CloudWatch log group. This is also used to indicate we are running in the
  // infrastructure, so the Amazon SDK will automatically pull access credentials from IAM Role.
  const cloudWatchLogGroupName: string = process.env.FAILED_LOGINS_CWLG_NAME || '';
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
