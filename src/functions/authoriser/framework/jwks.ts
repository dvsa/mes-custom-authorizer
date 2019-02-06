import * as jwksRsa from 'jwks-rsa';

export const jwksClientFactory =
  (options: jwksRsa.Options): jwksRsa.JwksClient => jwksRsa(options);
