import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import createResponse from './createResponse';
import Response from './Response';

export async function handler(event: APIGatewayProxyEvent, fnCtx: Context): Promise<Response> {
  return createResponse({});
}
