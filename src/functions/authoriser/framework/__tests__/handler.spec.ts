import { Mock, It, Times } from 'typemoq';
import { CustomAuthorizerEvent, CustomAuthorizerResult } from 'aws-lambda';
import AdJwtVerifier, { VerifiedTokenPayload } from '../../application/AdJwtVerifier';
import { handler } from '../handler';
import * as createAdJwtVerifier from '../createAdJwtVerifier';

describe('handler', () => {
  const moqConsoleLog = Mock.ofInstance(console.log);
  const mockAdJwtVerifier = Mock.ofType<AdJwtVerifier>();

  let testCustomAuthorizerEvent: CustomAuthorizerEvent;

  const sut = handler;

  beforeEach(() => {
    moqConsoleLog.reset();
    mockAdJwtVerifier.reset();

    mockAdJwtVerifier.setup((x: any) => x.then).returns(() => undefined); // TypeMoq limitation

    testCustomAuthorizerEvent = {
      type: 'type',
      methodArn: '',
      authorizationToken: '',
    };

    spyOn(createAdJwtVerifier, 'default').and.returnValue(Promise.resolve(mockAdJwtVerifier.object));
    spyOn(console, 'log').and.callFake(moqConsoleLog.object);
  });

  it('should throw an error if authorizationToken is not set', async () => {
    testCustomAuthorizerEvent.authorizationToken = '';

    let errorThrown: Error | undefined;
    let result: CustomAuthorizerResult | undefined;

    // ACT
    try {
      result = await sut(testCustomAuthorizerEvent);
    } catch (err) {
      errorThrown = err;
    }

    // ASSERT
    expect(errorThrown).toEqual(new Error('event.authorizationToken is null or empty'));
    expect(result).toBeUndefined();

    mockAdJwtVerifier.verify(x => x.verifyJwt('example-token'), Times.never());
  });

  it('should return Allow when token verification passes', async () => {
    testCustomAuthorizerEvent.authorizationToken = 'example-token';
    testCustomAuthorizerEvent.methodArn =
      'arn:aws:execute-api:region:account-id:api-id/stage-name/HTTP-VERB/resource/path/specifier';

    const testVerifiedTokenPayload: VerifiedTokenPayload = {
      sub: 'test-subject',
      unique_name: 'test-unique_name',
    };

    mockAdJwtVerifier.setup(x => x.verifyJwt(It.isAny()))
      .returns(() => Promise.resolve(testVerifiedTokenPayload));

    // ACT
    const result = await sut(testCustomAuthorizerEvent);

    // ASSERT
    expect(result.policyDocument.Statement[0].Effect).toEqual('Allow');
    expect((<{ Resource: string }>result.policyDocument.Statement[0]).Resource)
      .toEqual('arn:aws:execute-api:region:account-id:api-id/stage-name/*/*');
    expect(result.principalId).toEqual('test-unique_name');

    mockAdJwtVerifier.verify(x => x.verifyJwt('example-token'), Times.once());
  });

  it('should return Deny when token verification fails', async () => {
    testCustomAuthorizerEvent.authorizationToken = 'example-token';
    testCustomAuthorizerEvent.methodArn =
      'arn:aws:execute-api:region:account-id:api-id/stage-name/HTTP-VERB/resource/path/specifier';

    mockAdJwtVerifier.setup(x => x.verifyJwt(It.isAny()))
      .throws(new Error('Example invalid token error'));

    // ACT
    const result = await sut(testCustomAuthorizerEvent);

    // ASSERT
    expect(result.policyDocument.Statement[0].Effect).toEqual('Deny');
    expect((<{ Resource: string }>result.policyDocument.Statement[0]).Resource)
      .toEqual('arn:aws:execute-api:region:account-id:api-id/stage-name/*/*');
    expect(result.principalId).toEqual('not-authorized');

    mockAdJwtVerifier.verify(x => x.verifyJwt('example-token'), Times.once());

    moqConsoleLog.verify(
      x => x(It.is<string>(s => /Failed authorization\. Responding with Deny\./.test(s))),
      Times.once());
  });
});
