import { Mock, It, Times } from 'typemoq';
import { CustomAuthorizerEvent, CustomAuthorizerResult } from 'aws-lambda';
import AdJwtVerifier, { VerifiedTokenPayload } from '../../application/AdJwtVerifier';
import { handler, setFailedAuthLogger } from '../handler';
import { Logger } from '../createLogger';
import * as createAdJwtVerifier from '../createAdJwtVerifier';
import * as verifyEmployeeId from '../../application/verifyEmployeeId';
import * as getEmployeeIdKey from '../../application/getEmployeeIdKey';

describe('handler', () => {
  const moqFailedAuthLogger = Mock.ofType<Logger>();
  const mockAdJwtVerifier = Mock.ofType<AdJwtVerifier>();
  const mockVerifyEmployeeId = Mock.ofInstance(verifyEmployeeId.default);
  const mockGetEmployeeIdKey = Mock.ofInstance(getEmployeeIdKey.default);

  let testCustomAuthorizerEvent: CustomAuthorizerEvent;

  const sut = handler;

  beforeEach(() => {
    moqFailedAuthLogger.reset();
    mockAdJwtVerifier.reset();
    mockVerifyEmployeeId.reset();
    mockGetEmployeeIdKey.reset();

    mockAdJwtVerifier.setup((x: any) => x.then).returns(() => undefined); // TypeMoq limitation
    mockVerifyEmployeeId.setup(x => x(It.isAny(), It.isAny()))
      .returns(() => Promise.resolve(true));
    mockGetEmployeeIdKey.setup(x => x()).returns(() => 'employeeid');

    testCustomAuthorizerEvent = {
      type: 'type',
      methodArn: '',
      authorizationToken: '',
    };

    spyOn(createAdJwtVerifier, 'default')
      .and.returnValue(Promise.resolve(mockAdJwtVerifier.object));

    spyOn(verifyEmployeeId, 'default').and.callFake(mockVerifyEmployeeId.object);
    spyOn(getEmployeeIdKey, 'default').and.callFake(mockGetEmployeeIdKey.object);

    setFailedAuthLogger(moqFailedAuthLogger.object);
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
      employeeid: '12345678',
    };

    mockAdJwtVerifier.setup(x => x.verifyJwt(It.isAny()))
      .returns(() => Promise.resolve(testVerifiedTokenPayload));

    // ACT
    const result = await sut(testCustomAuthorizerEvent);

    // ASSERT
    moqFailedAuthLogger.verify(x => x(It.isAny(), It.isAny()), Times.never());
    moqFailedAuthLogger.verify(x => x(It.isAny(), It.isAny(), It.isAny()), Times.never());

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

    moqFailedAuthLogger.verify(
      x => x(
        It.is<string>(s => /Failed authorization\. Responding with Deny\./.test(s)),
        'error',
        It.is<any>(o => /Example invalid token error/.test(o.failedAuthReason))),
      Times.once());
  });
});
