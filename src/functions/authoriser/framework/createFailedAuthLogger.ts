import { createLogger, transports, format, Logger } from 'winston';
import CloudWatchTransport = require('winston-aws-cloudwatch'); // tslint:disable-line
import { randomBytes } from 'crypto';

export const uniqueLogStreamName = () => {
  const date = new Date();
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth().toString().padStart(2, '0');
  const day = date.getUTCDay().toString().padStart(2, '0');
  const randomUuid = randomBytes(16).toString('hex');
  return `FailedAuth-${year}-${month}-${day}-${randomUuid}`;
};

export default function createFailedAuthLogger(): Logger {
  let logger = createLogger();

  // Always log to console, this is helpful when running locally, and also if any issues arise
  // with accessing the dedicated FAILED_LOGINS_CWLG CloudWatch log.
  logger.add(new transports.Console({
    format: format.json(),
  }));

  // If the `FAILED_LOGINS_CWLG_NAME` environment variable is set then log failed auth messages to
  // that CloudWatch log group. This is also used to indicate we are running in the infrastructure,
  // so the underlying Amazon SDK will automatically pull access credentials from IAM Role.
  const cloudWatchLogGroupName: string = process.env.FAILED_LOGINS_CWLG_NAME || '';
  if (cloudWatchLogGroupName && cloudWatchLogGroupName.length > 0) {
    const streamName = uniqueLogStreamName();

    logger = createLogger({
      transports: [
        new transports.Console({
          format: format.json(),
        }),
        new CloudWatchTransport({
          logGroupName: cloudWatchLogGroupName,
          logStreamName: streamName,
          createLogGroup: true,
          createLogStream: true,
          submissionInterval: 1000,
          submissionRetryCount: 3,
          awsConfig: {
            region: 'eu-west-1',
            accessKeyId: <string><unknown>undefined,
            secretAccessKey: <string><unknown>undefined,
          }
        })
      ]
    });
    
    // logger.add(new CloudWatchTransport({
    //   logGroupName: cloudWatchLogGroupName,
    //   logStreamName: streamName,
    //   createLogGroup: true,
    //   createLogStream: true,
    //   submissionInterval: 1000,
    //   submissionRetryCount: 3,
    //   awsConfig: {
    //     region: 'eu-west-1',
    //     accessKeyId: <string><unknown>null,
    //     secretAccessKey: <string><unknown>null,
    //   }
    // }));
    console.log(`rs-todo: undefined Initialised Failed Auth logging to: ${cloudWatchLogGroupName}/${streamName}`);
  }

  logger.on('error', function (err) { 
    console.log(`Error during logging: ${err}`);
  });

  return logger;
}
