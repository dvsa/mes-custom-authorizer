import { Given, When, Then, After } from 'cucumber';
import { Mock, It, Times, IMock } from 'typemoq';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as crypto from 'crypto';
import { CustomAuthorizerEvent, CustomAuthorizerResult } from 'aws-lambda';
import * as jsonwebtoken from 'jsonwebtoken';
import * as testKeys from './testKeys';
import * as authoriser from '../../src/functions/authoriser/framework/handler';
import AdJwtVerifier, { JwksClient } from '../../src/functions/authoriser/application/AdJwtVerifier';

const uuid = () => crypto.randomBytes(16).toString('hex');
const oneMinute = 60;

const createToken = (context: AuthoriseStepsContext, notBefore: number, expiresIn: number): string => {
  const payload = {
    unique_name: context.testTokenUniqueName,
  };

  const signOptions: jsonwebtoken.SignOptions = {
    algorithm: 'RS256',
    keyid: context.testKid,
    audience: context.testAppId,
    issuer: context.testIssuer,
    subject: context.testTokenSubject,
    notBefore: notBefore,
    expiresIn: expiresIn,
  };

  return jsonwebtoken.sign(payload, testKeys.ourCertificate.privateKey, signOptions);
}

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

After(function() {
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
    methodArn: 'arn:aws:dummy:method:arn/stage/VERB/some/path'
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
  const adJwtVerifier = new AdJwtVerifier(context.testAppId, context.testIssuer, context.moqJwksClient.object);  
  authoriser.setAdJwtVerifier(adJwtVerifier);

  // Setup out mock JwksClient so that it returns our test public key
  context.moqJwksClient
    .setup(x => x.getSigningKey(context.testKid))
    .returns(kid => Promise.resolve({
      kid: kid,
      rsaPublicKey: testKeys.ourCertificate.publicKey
    }));
});

Given('a valid token', function () {
  const context: AuthoriseStepsContext = this.context;
  context.token = createToken(context, -oneMinute, oneMinute * 5);
});

Given(
  'a token that is valid between {int} hours and {int} hours',
  function(startHours: number, endHours: number) {
    const context: AuthoriseStepsContext = this.context;
    context.token = createToken(context, oneMinute * startHours, oneMinute * endHours);
  });

Given('a methodArn of {string}', function (methodArn: string) {
  const context: AuthoriseStepsContext = this.context;
  context.methodArn = methodArn;
});

Given('the token\'s payload is changed', () => {
  // rs-todo: Write code here that turns the phrase above into concrete actions
  return 'pending';
});

Given('the token\'s header is changed', () => {
  // rs-todo: Write code here that turns the phrase above into concrete actions
  return 'pending';
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

  expect((<{ Resource: string }>result.policyDocument.Statement[0]).Resource).to.equal(expectedResultMethodArn);
});

Then('the failed authorization reason should contain {string}', function (failureReason: string) {
  const context: AuthoriseStepsContext = this.context;

  context.moqConsoleLog.verify(
    x => x(It.is<string>(
      s => /Failed authorization\. Responding with Deny\./.test(s) && s.indexOf(failureReason) > -1)),
    Times.once());
});
