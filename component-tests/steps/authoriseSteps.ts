import { Given, When, Then, After } from 'cucumber';
import { Mock, It, Times, IMock } from 'typemoq';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as crypto from 'crypto';
import { Buffer } from 'buffer';
import { CustomAuthorizerEvent, CustomAuthorizerResult } from 'aws-lambda';
import * as jsonwebtoken from 'jsonwebtoken';
import * as authoriser from '../../src/functions/authoriser/framework/handler';
import AdJwtVerifier, { JwksClient } from
  '../../src/functions/authoriser/application/AdJwtVerifier';

interface AuthoriseStepsContext {
  sinonSandbox: sinon.SinonSandbox;
  sut: (event: CustomAuthorizerEvent) => Promise<CustomAuthorizerResult>;
  moqConsoleLog: IMock<(message?: any, ...optionalParams: any[]) => void>;
  moqJwksClient: IMock<JwksClient>;
  testAppId: string;
  testIssuer: string;
  testKid: string;
  testTokenUniqueName: string;
  testTokenSubject: string;
  token: string;
  methodArn: string;
  result?: CustomAuthorizerResult;
}

After(function () {
  const context: AuthoriseStepsContext = this.context;
  context.sinonSandbox.restore();
});

Given('a custom authoriser lambda', function () {
  const context: AuthoriseStepsContext = this.context = {
    sut: authoriser.handler,
    sinonSandbox: sinon.createSandbox(),
    moqConsoleLog: Mock.ofInstance(console.log),
    moqJwksClient: Mock.ofType<JwksClient>(),
    testAppId: uuid(),
    testIssuer: uuid(),
    testKid: uuid(),
    testTokenUniqueName: uuid(),
    testTokenSubject: uuid(),
    token: 'token-not-set',
    methodArn: 'arn:aws:dummy:method:arn/stage/VERB/some/path',
  };

  // Override `console.log` with a Moq, so we can intercept calls to it,
  // but still redirect back to the original `console.log`
  const originalConsoleLog = console.log;
  context.moqConsoleLog
    .setup(x => x(It.isAny(), It.isAny()))
    .callback(
      (message?: any, ...optionalParams: any[]) => originalConsoleLog(message, ...optionalParams));
  context.sinonSandbox.replace(console, 'log', context.moqConsoleLog.object);

  // Override the system under test's `AdJwtVerifier`, so we can use an AdJwtVerifier that performs
  // exactly as normal, other than it won't make any external web calls to get public keys.
  const adJwtVerifier = new AdJwtVerifier(
    context.testAppId,
    context.testIssuer,
    context.moqJwksClient.object);
  authoriser.setAdJwtVerifier(adJwtVerifier);

  // Setup out mock JwksClient so that it returns our test public key
  context.moqJwksClient
    .setup(x => x.getSigningKey(context.testKid))
    .returns(kid => Promise.resolve({
      kid,
      rsaPublicKey: testKeys.ourCertificate.publicKey,
    }));
});

Given('a valid token', function () {
  const context: AuthoriseStepsContext = this.context;
  context.token = createToken(context);
});

Given(
  'a token that is valid between {int} hours and {int} hours',
  function (startHours: number, endHours: number) {
    const context: AuthoriseStepsContext = this.context;
    context.token = createToken(context, oneMinute * startHours, oneMinute * endHours);
  });

Given('a token signed with a non-genuine certificate', function () {
  const context: AuthoriseStepsContext = this.context;
  context.token = createToken(
    context,
    undefined,
    undefined,
    testKeys.anotherCertificate.privateKey);
});

Given('a valid token but from a different issuer', function () {
  const context: AuthoriseStepsContext = this.context;
  context.token = createToken(context, undefined, undefined, undefined, uuid());
});

Given('a valid token but intended for another application', function () {
  const context: AuthoriseStepsContext = this.context;
  context.token = createToken(context, undefined, undefined, undefined, undefined, uuid());
});

Given('a methodArn of {string}', function (methodArn: string) {
  const context: AuthoriseStepsContext = this.context;
  context.methodArn = methodArn;
});

Given('the token\'s payload is changed', function () {
  const context: AuthoriseStepsContext = this.context;

  const parts = context.token.split('.');

  const payload = base64Decode(parts[1]);
  payload['unique_name'] = uuid();
  parts[1] = base64Encode(payload).replace('=', '');

  context.token = parts.join('.');
});

Given('the token\'s header is changed', function () {
  const context: AuthoriseStepsContext = this.context;

  const parts = context.token.split('.');

  const header = base64Decode(parts[0]);
  header['test'] = 'abc';
  parts[0] = base64Encode(header).replace('=', '');

  context.token = parts.join('.');
});

Given('the token\'s signature is removed', function () {
  const context: AuthoriseStepsContext = this.context;

  const parts = context.token.split('.');
  parts[2] = '';

  context.token = parts.join('.');
});

When('the token is verified', async function () {
  const context: AuthoriseStepsContext = this.context;

  context.result = await context.sut({
    type: 'token',
    authorizationToken: context.token,
    methodArn: context.methodArn,
  });
});

Then('the result should Allow access', function () {
  const context: AuthoriseStepsContext = this.context;
  const result = <CustomAuthorizerResult>context.result;

  expect(result.policyDocument.Statement[0].Effect).to.equal('Allow');
  expect(result.principalId).to.equal(context.testTokenUniqueName);
});

Then('the result should Deny access', function () {
  const context: AuthoriseStepsContext = this.context;
  const result = <CustomAuthorizerResult>context.result;

  expect(result.policyDocument.Statement[0].Effect).to.equal('Deny');
  expect(result.principalId).to.equal('not-authorized');
});

Then('the result policy methodArn should be {string}', function (expectedResultMethodArn: string) {
  const context: AuthoriseStepsContext = this.context;
  const result = <CustomAuthorizerResult>context.result;

  expect((<{ Resource: string }>result.policyDocument.Statement[0]).Resource)
    .to.equal(expectedResultMethodArn);
});

Then('the failed authorization reason should contain {string}', function (failureReason: string) {
  const context: AuthoriseStepsContext = this.context;

  context.moqConsoleLog.verify(
    x => x(It.is<string>(s =>
      /Failed authorization\. Responding with Deny\./.test(s) &&
      s.indexOf(failureReason) > -1)),
    Times.once());
});

const testKeys = getTestKeys();

const uuid = () => crypto.randomBytes(16).toString('hex');
const oneMinute = 60;

const createToken = (
  context: AuthoriseStepsContext,
  notBefore?: number,
  expiresIn?: number,
  privateKey?: string,
  issuer?: string,
  audience?: string): string => {
  const payload = {
    unique_name: context.testTokenUniqueName,
  };

  const signOptions: jsonwebtoken.SignOptions = {
    algorithm: 'RS256',
    keyid: context.testKid,
    audience: audience || context.testAppId,
    issuer: issuer || context.testIssuer,
    subject: context.testTokenSubject,
    notBefore: notBefore || -oneMinute,
    expiresIn: expiresIn || (oneMinute * 5),
  };

  return jsonwebtoken.sign(payload, privateKey || testKeys.ourCertificate.privateKey, signOptions);
};

const base64Decode = (base64String: string): { [propName: string]: any } => {
  const buffer = new Buffer(base64String, 'base64');
  const json = buffer.toString('ascii');
  const object = JSON.parse(json);
  return object;
};

const base64Encode = (object: any): string => {
  const json = JSON.stringify(object);
  const buffer = new Buffer(json);
  const base64String = buffer.toString('base64');
  return base64String;
};


function getTestKeys() {
  // These private keys were generated specifically for exclusive use by these component tests.
  // This is committed to a public repository, so can be seen by anybody in the universe.
  // These keys should never be used for any real world security purposes!
  return {
    ourCertificate: {
      privateKey: `-----BEGIN RSA PRIVATE KEY-----
MIIEpQIBAAKCAQEA2EA/5Mw2rVqYPruR07ptRHfr7pVieJphEZDMo73lgaXYbGLz
PmKr+MPJa8ouyDG/4fHv2JBbX0PM/C1QYvxaJ+kHkRvxG+q9TecipGgc6ZfD9DfK
AeFv3+qD7Z9sv+owMGhb2EZEDHUQwyaB5XvWgPct9xubU2jvfonZgDjlquRUB+OU
OxtRcvYhQ3e3c6tHu8DAYqvL9vw77Hm2/YqWO+kKhQRhPezhk4EeVbKLWqN3wyQ5
HiYQwhAZ/iZWZiU/lBfmtkE3edOrpvKCtv8Vr3ZyHjfQcav8llIM4Pq5DJdyxADs
MPd9udhYxCChNH5sNMGTsRz4ybAIhWlSO7QUmwIDAQABAoIBAQC/aufjw+wmOMoI
xYmIrD2qXKiH0M2QSb7giJbL3fy4bTAMiO4da8Qj+FJjylzssjTScJDI1sc6pU5e
blH4vL2lFD2xcdVTy85zlcPxWYM2NjOrCnMShRW9U94hyXu+yTKMtuONpmz3xevn
gj96/cpa7/FNCa/M/lb4YFcZi8OoJsGKTuhIadeDeKlajw1Fln4vCW3fKtatpHHR
NerYBpouRhqxwjloJ0Pj/GtKrKQ0ScWhyIdwpUXwoYw2x1PGTOxPKF17JD0jtrbL
0z6ZjGi1uSYvsNPkmF6ZuZJl97dndQEpY8y1VJ1L3Ji/bgyIZPNqOjH0ISzel9q1
LHUfs6yhAoGBAPKYJIFDoSECMZEwhdP0ckdv6/i7kUHVQhYMgn6YVAQ6y8iT3wcS
4pElD5d2hAl617n5hSPuJ6VhmeBVHb5nNeeV3CYZ9AFwBIi1K+vCOgeaqxOcUQmo
nBzcUQaXCuXhZkHdUUzPuvBUJzxJIXhf7aBNI0PHTNTykBkTJB2w0z8xAoGBAOQz
cP0XG9uydnVqE7AwaaeuhRLPxBPD656cRstjA3emlez0FdXlnNnB0OqEFLWv4U2s
ihE5T5NWJ8keoKzM1yPwAMidCQ+BLQLVWOh+x867j4aFOW/7DiOG3av9EAdr+Pi9
dvtapYVDFf4/Ru6WEBJII+sDmg8piJQUlSGi/dWLAoGBAMSFHz1f7c1xm3nEVwVG
xrS8I+pQ9/DeszRtWeD3wUfT4XVQ5KE0WTm/Tgwiw/9x9gP/8C0VJiTBFgg2q2us
7Gv4aGitKY9okSO1sCjCJIQ4dVHjlXo/joeKqlCuVvO2TkIY6V1SAlvhsA8UJvr+
qt7q3iBv+Pugq77EVMOAlQBhAoGAOzKhB/a7slVsZ28aJmWYsvgR61xcaCg18lJm
BxLrblmXoP18wJ0tAExIDt4upSc4EjdFJcyxOO5rqb+5PLpywQ7clS4vkIcZDxgb
VUy2NonvZJ0g1kzRUSQGUzx1sQcwcg5sVC4irBxIE0mE9BWXm7Z9ItUvXOmQVaG1
QiGPKZsCgYEAnmajQprAqCqb/1nzv8vmxlEbLabIQRHSXd5yhmz0iBBvwmzHABVU
CXerGfymZu2mGPKI+alavNEOl8TGaNl0fShX4N4vMBsUgX7BaJltghtQ3bTlv1X0
lsAyCb6xv4VnCMgpmd1HTcePxD4IEuU7JSRp24tdOJfksCh9vga5G04=
-----END RSA PRIVATE KEY-----`,
      publicKey: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2EA/5Mw2rVqYPruR07pt
RHfr7pVieJphEZDMo73lgaXYbGLzPmKr+MPJa8ouyDG/4fHv2JBbX0PM/C1QYvxa
J+kHkRvxG+q9TecipGgc6ZfD9DfKAeFv3+qD7Z9sv+owMGhb2EZEDHUQwyaB5XvW
gPct9xubU2jvfonZgDjlquRUB+OUOxtRcvYhQ3e3c6tHu8DAYqvL9vw77Hm2/YqW
O+kKhQRhPezhk4EeVbKLWqN3wyQ5HiYQwhAZ/iZWZiU/lBfmtkE3edOrpvKCtv8V
r3ZyHjfQcav8llIM4Pq5DJdyxADsMPd9udhYxCChNH5sNMGTsRz4ybAIhWlSO7QU
mwIDAQAB
-----END PUBLIC KEY-----`,
    },
    anotherCertificate: {
      privateKey: `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAmj5dwynCVRWzAB+4s7+TUQEp7Wo2NaEOGdvidOeRDk3CpVjq
dl0k1JnteU2/vvCRIxNn9u+wLh2j3cGQEWI6ES2SSl2OltlB/x0A6F2IFIQ7sehO
4/QRM25A61ZjazOdSzP5+LdvmIiWmA+8FXhtIgZ7hADWD5T4bRmOeOj2KmiFKD9Z
vRURo+gHR/4XgsUQIwNmsBDq+7ySsZOI2ORt7sEbKjIIZdgss+5AEBcZktLqI7kF
+7BU/Bl+bF7F7DVS5CX47NmWhdk1wp2fFwF+DrP+VfbRA05bc+9F9NwQ3HnxPTQl
fyVMAmNV1HlxCiLzrLjufk2HUoKLMLAWh2bgXwIDAQABAoIBAG/aDBpr3O3gl3be
ig1nPog+hM4S+I65ZUVhS/4ksu8heqZ3LUd6UiwOF8Sgmgz33PgHqZvLwwIeIme8
ZyIEDkHIv05IPA+uKwq6WJ8ovHbMUZG4+gSaSCL4sAE5G01xF36iiYJQW4/MdRB+
UJFtTA6hjs5x4MlZ6TEMmGGb5m9nTfp4S1emPtJE/iiWcpgZqZWBLaRR3DNYxbbt
s2vqKogyadWvIvnpXWiUl0EHn0e2oQf/j7lxDDt7esPgCEUwFA2VIk3a8xZkefdW
x3oKEbtetDuUfSt75DrZtT0e6jGNqdM1CkdpDHYjCEQdVjhuW1NUZhE4s37ABp8h
B7ueDPECgYEAyGV4NQQjuKNTmVUFmsuIpPJRvznrcf6En+//Y21pQZYJSjQnNwmL
goHTbj9H+RZpYaArGpzN4KqVI4gDk9gO4WL126xWFstvorZ3/BJVr9sCugNTIHTr
5KtQw9f188tdIaKgNvjKKwfy3u/hrffGifxgf0mMYnIpTs4WSLGyTKcCgYEAxQqU
kF0q3RiVaxdPoDdVk3W22JiCq1/oRM6bUx3k69sTMezq3bj9rGYuy0zEX52Wyw05
D09uefX02+qQDy7RSkPKP4b5lGqZ1jWEjOQS2QQT3bYRRtwWKI4OVDmb3Me5yq5e
fP+9+s68H3uwryXWAbp5S9ABB/a+UGww3iA5rYkCgYBEdDz6xz44jTo6b4uplAtK
ZSg9jVh7KTk+tSnlWfORnuHvgh8/MriATT7fMyiv0tMOsTroLVY6f6rQZ17peu2i
Wj6n2pfR045/45ra9ZxlpQeqaQZVWPtXspm1PKlcrURUAAyAmr3csytoskLCPZiJ
fDeuY35cBqlLrSR5kpHYkwKBgQCezQIivxOWkQOLBYSE6VOsvkgYlAFrwKXfHmwM
NqGSfEMiD4DSJQ887DV2X248aTNofkWoUyoEXPd0bbygn+jI442SWWO3+5n0C7nC
GuYdxK2GGAAgjavGD4b41l0JOGZCNPmt4CbqhccT0In6/pFVX0X2lbLfCjsjca6I
towFkQKBgDF2B7LNl93ATmFC1mjTRtd7odFOJHKxhhHf+VOes+eyEH28CYtKiYCB
e+FEcVx8kII+O/pnHzX4sIb/mh+lm6Hi0BdcmdCrrjcNOOTc8oBiNnQP0CEDBZrC
ceAeqwtdSbP7gQ2VrCiH4xLXyKCbXSI87mXJcuFom6NUQKMvk8hc
-----END RSA PRIVATE KEY-----`,
    },
  };
}
