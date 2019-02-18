declare module 'winston-aws-cloudwatch' {
  import * as Transport from "winston-transport";

  export interface CloudWatchTransportOptions {
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

  export class CloudWatchTransport extends Transport {
    constructor(options: CloudWatchTransportOptions);
  }
}