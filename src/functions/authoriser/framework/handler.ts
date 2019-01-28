import { CustomAuthorizerEvent, CustomAuthorizerResult, Context } from 'aws-lambda';

const newCustomAuthorizerResult = (principalId: string, effect: string, resource: string)
  : CustomAuthorizerResult => ({
    principalId,
    policyDocument: {
      Version: '2012-10-17', // default version
      Statement: [{
        Action: 'execute-api:Invoke', // default action
        Effect: effect,
        Resource: resource,
      }],
    },
  });

export async function handler(event: CustomAuthorizerEvent, fnCtx: Context)
  : Promise<CustomAuthorizerResult> {
  const token = event.authorizationToken;
  const userId = 'user-id';
  if (token) {
    switch (token.toLowerCase()) {
      case 'allow':
        return newCustomAuthorizerResult(userId, 'Allow', event.methodArn);
      case 'deny':
        return newCustomAuthorizerResult(userId, 'Deny', event.methodArn);
      case 'unauthorized':
        throw Error('unauthorized');
      default:
        throw Error('unauthorized');
    }
  }
  throw Error('fallback error');
}
