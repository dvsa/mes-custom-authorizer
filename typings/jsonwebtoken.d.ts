// declare module 'jsonwebtoken' {
//   export interface VerifyOptions {
//     algorithms?: string[];
//     audience?: string | string[];
//     clockTimestamp?: number;
//     clockTolerance?: number;
//     issuer?: string | string[];
//     ignoreExpiration?: boolean;
//     ignoreNotBefore?: boolean;
//     jwtid?: string;
//     subject?: string;
//   }
//
//   export interface DecodeOptions {
//     complete?: boolean;
//     json?: boolean;
//   }
//
//   export interface TokenPayload {
//     readonly sub: string;
//     readonly preferred_username: string;
//     readonly [propName: string]: any;
//   }
//
//   export interface TokenHeader {
//     readonly typ: string;
//     readonly alg: string;
//     readonly kid: string;
//     readonly x5t?: string;
//     readonly [propName: string]: any;
//   }
//
//   export interface DecodedToken {
//     readonly header: TokenHeader;
//   }
//
//   /**
//    * Synchronously verify given token using a secret or a public key to get a decoded token
//    * token - JWT string to verify
//    * secretOrPublicKey - Either the secret for HMAC algorithms, or the PEM encoded public key for RSA and ECDSA.
//    * [options] - Options for the verification
//    * returns - The verified decoded token.
//    */
//   export function verify(
//     token: string,
//     secretOrPublicKey: string | Buffer,
//     options?: VerifyOptions,
//   ): TokenPayload;
//
//   /**
//    * Returns the decoded payload without verifying if the signature is valid.
//    * token - JWT string to decode
//    * [options] - Options for decoding
//    * returns - The decoded Token
//    */
//   export function decode(
//     token: string,
//     options?: DecodeOptions,
//   ): DecodedToken;
//
//   /**
//    * Synchronously sign the given payload into a JSON Web Token string
//    * payload - Payload to sign, could be an literal, buffer or string
//    * secretOrPrivateKey - Either the secret for HMAC algorithms, or the PEM encoded private key for RSA and ECDSA.
//    * [options] - Options for the signature
//    * returns - The JSON Web Token string
//    */
//   export function sign(
//     payload: string | Buffer | object,
//     secretOrPrivateKey: Secret,
//     options?: SignOptions,
//   ): string;
//
//   export type Secret = string | Buffer | { key: string; passphrase: string };
//
//   export interface SignOptions {
//     /**
//      * Signature algorithm. Could be one of these values :
//      * - HS256:    HMAC using SHA-256 hash algorithm (default)
//      * - HS384:    HMAC using SHA-384 hash algorithm
//      * - HS512:    HMAC using SHA-512 hash algorithm
//      * - RS256:    RSASSA using SHA-256 hash algorithm
//      * - RS384:    RSASSA using SHA-384 hash algorithm
//      * - RS512:    RSASSA using SHA-512 hash algorithm
//      * - ES256:    ECDSA using P-256 curve and SHA-256 hash algorithm
//      * - ES384:    ECDSA using P-384 curve and SHA-384 hash algorithm
//      * - ES512:    ECDSA using P-521 curve and SHA-512 hash algorithm
//      * - none:     No digital signature or MAC value included
//      */
//     algorithm?: string;
//     keyid?: string;
//     /**
//      * Expressed in seconds, or a string describing a time span (https://github.com/zeit/ms.js),
//      * e.g: 60, "2 days", "10h", "7d".
//      * */
//     expiresIn?: string | number;
//     /**
//      * Expressed in seconds, or a string describing a time span (https://github.com/zeit/ms.js),
//      * e.g: 60, "2 days", "10h", "7d".
//      * */
//     notBefore?: string | number;
//     audience?: string | string[];
//     subject?: string;
//     issuer?: string;
//     jwtid?: string;
//     noTimestamp?: boolean;
//     header?: object;
//     encoding?: string;
//   }
// }
