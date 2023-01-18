import { decode, JwtHeader, verify } from 'jsonwebtoken';
import * as JwksRsa from 'jwks-rsa';

export type EmployeeIdKey = 'extn.employeeId' | 'employeeid';
export type EmployeeId = string;

export type BaseVerifiedTokenPayload = {
  readonly sub: string;
  readonly preferred_username: string;
  readonly [index: string]: any;
};

export interface EmployeeIdExtKeyVerifiedTokenPayload extends BaseVerifiedTokenPayload {
  'extn.employeeId': string[];
}

export interface EmployeeIdKeyVerifiedTokenPayload extends BaseVerifiedTokenPayload {
  employeeid: string;
}

export interface EmployeeRolesVerifiedTokenPayload extends BaseVerifiedTokenPayload {
  roles: string[];
}

export type VerifiedTokenPayload =
    EmployeeIdExtKeyVerifiedTokenPayload | EmployeeIdKeyVerifiedTokenPayload | EmployeeRolesVerifiedTokenPayload;

export default class AdJwtVerifier {
  readonly applicationId: string;
  readonly issuer: string;
  readonly jwksClient: JwksRsa.JwksClient;

  constructor(applicationId: string, issuer: string, jwksClient: JwksRsa.JwksClient) {
    this.applicationId = applicationId;
    this.issuer = issuer;
    this.jwksClient = jwksClient;
  }

  /**
   * Verifies the specified Azure AD JWT id/access token.  Throws an error if the token is invalid.
   * token - The encoded JWT token to verify.
   * returns - The decoded and verified token.
   */
  async verifyJwt(token: string): Promise<VerifiedTokenPayload> {
    const { kid } = decode(token, { complete: true })?.header as JwtHeader;
    const signingKey = await this.jwksClient.getSigningKey(kid as string);
    const rsaPublicKey = signingKey.getPublicKey() || '';
    if (rsaPublicKey === '') {
      throw new Error(`No public RSA key for kid: ${kid}`);
    }

    return <VerifiedTokenPayload>verify(token, rsaPublicKey, {
      audience: this.applicationId,
      issuer: this.issuer,
      clockTolerance: 30, /* seconds */
    });
  }
}
