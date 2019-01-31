declare module 'jsonwebtoken' {
  export interface VerifyOptions {
    algorithms?: string[];
    audience?: string | string[];
    clockTimestamp?: number;
    clockTolerance?: number;
    issuer?: string | string[];
    ignoreExpiration?: boolean;
    ignoreNotBefore?: boolean;
    jwtid?: string;
    subject?: string;
  }

  export interface DecodeOptions {
    complete?: boolean;
    json?: boolean;
  }

  export interface TokenPayload {
    readonly sub: string;
    readonly unique_name: string;
    readonly [propName: string]: any;
  }

  export interface TokenHeader {
    readonly typ: string;
    readonly alg: string;
    readonly kid: string;
    readonly x5t?: string;
    readonly [propName: string]: any;
  }

  export interface DecodedToken {
    readonly header: TokenHeader;
  }

  /**
   * Synchronously verify given token using a secret or a public key to get a decoded token
   * token - JWT string to verify
   * secretOrPublicKey - Either the secret for HMAC algorithms, or the PEM encoded public key for RSA and ECDSA.
   * [options] - Options for the verification
   * returns - The verified decoded token.
   */
  export function verify(
    token: string,
    secretOrPublicKey: string | Buffer,
    options?: VerifyOptions,
  ): TokenPayload;

  /**
   * Returns the decoded payload without verifying if the signature is valid.
   * token - JWT string to decode
   * [options] - Options for decoding
   * returns - The decoded Token
   */
  export function decode(
    token: string,
    options?: DecodeOptions,
  ): DecodedToken;
}