import { CustomAuthorizerEvent, Context } from 'aws-lambda';

export async function handler(event: CustomAuthorizerEvent, fnCtx: Context) {
  const token = event.authorizationToken;
  if (token) {
    switch (token.toLowerCase()) {
      case 'allow':
        return true;
      case 'deny':
        throw Error('Not allowed');
      case 'unauthorized':
        throw Error('unauthorized');
      default:
        throw Error('unauthorized');
    }
  }
  throw Error('fallback error');
}
