declare module 'winston-aws-cloudwatch' {
  import * as Transport from "winston-transport";

  interface CloudWatchTransportOptions {
    logGroupName: string;
    logStreamName: string;
    createLogGroup?: boolean;
    createLogStream?: boolean;
    submissionInterval?: number;
    submissionRetryCount?: number;
    batchSize?: number;
    awsConfig?: {
      accessKeyId: string;
      secretAccessKey: string;
      region: string;
    };
  }

  class CloudWatchTransport extends Transport {
    constructor(options: CloudWatchTransportOptions);
  }

  export = CloudWatchTransport
}