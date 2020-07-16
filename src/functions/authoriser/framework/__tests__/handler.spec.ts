import { Mock, It, Times } from 'typemoq';
import { CustomAuthorizerEvent, CustomAuthorizerResult, AuthResponseContext } from 'aws-lambda';
import AdJwtVerifier, { VerifiedTokenPayload } from '../../application/AdJwtVerifier';
import { handler, setFailedAuthLogger } from '../handler';
import { Logger } from '../createLogger';
import * as createAdJwtVerifier from '../createAdJwtVerifier';
import * as verifyExaminer from '../../application/verifyExaminer';
import * as getEmployeeIdKey from '../../application/getEmployeeIdKey';
import * as extractEmployeeIdFromToken from '../../application/extractEmployeeIdFromToken';
import { DynamoDB } from 'aws-sdk';

describe('handler', () => {
  const moqFailedAuthLogger = Mock.ofType<Logger>();
  const mockAdJwtVerifier = Mock.ofType<AdJwtVerifier>();
  const mockVerifyExaminer = Mock.ofInstance(verifyExaminer.default);
  const mockGetEmployeeIdKey = Mock.ofInstance(getEmployeeIdKey.default);
  const moqExtractEmployeeIdFromToken = Mock.ofInstance(extractEmployeeIdFromToken.extractEmployeeIdFromToken);
  let testCustomAuthorizerEvent: CustomAuthorizerEvent;

  const sut = handler;

  beforeEach(() => {
    moqFailedAuthLogger.reset();
    mockAdJwtVerifier.reset();
    mockVerifyExaminer.reset();
    mockGetEmployeeIdKey.reset();
    moqExtractEmployeeIdFromToken.reset();

    mockAdJwtVerifier.setup((x: any) => x.then).returns(() => undefined); // TypeMoq limitation
    mockGetEmployeeIdKey.setup(x => x()).returns(() => 'employeeid');
    moqExtractEmployeeIdFromToken.setup(x => x(It.isAny(), It.isAny())).returns(() => '12345678');

    testCustomAuthorizerEvent = {
      type: 'type',
      methodArn: '',
      authorizationToken: '',
    };

    spyOn(createAdJwtVerifier, 'default')
      .and.returnValue(Promise.resolve(mockAdJwtVerifier.object));
    spyOn(getEmployeeIdKey, 'default').and.callFake(mockGetEmployeeIdKey.object);
    spyOn(extractEmployeeIdFromToken, 'extractEmployeeIdFromToken').and.callFake(moqExtractEmployeeIdFromToken.object);

    setFailedAuthLogger(moqFailedAuthLogger.object);
  });

  it('should throw an error if authorizationToken is not set', async () => {
    mockVerifyExaminer.setup(x => x(It.isAny()))
      .returns(() => Promise.resolve({
        Item: {
          staffNumber: '12345678',
          role: 'LDTM',
        },
      } as DynamoDB.Types.GetItemOutput));
    spyOn(verifyExaminer, 'default').and.callFake(mockVerifyExaminer.object);
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

  it('should return Allow with the correct context when token verification passes', async () => {
    testCustomAuthorizerEvent.authorizationToken = 'example-token';
    testCustomAuthorizerEvent.methodArn =
      'arn:aws:execute-api:region:account-id:api-id/stage-name/HTTP-VERB/resource/path/specifier';

    const testVerifiedTokenPayload: VerifiedTokenPayload = {
      sub: 'test-subject',
      unique_name: 'test-unique_name',
      employeeid: '12345678',
      roles: [],
    };

    mockVerifyExaminer.setup(x => x(It.isAny()))
      .returns(() => Promise.resolve({
        Item: {
          staffNumber: '12345678',
          role: 'LDTM',
        },
      } as DynamoDB.Types.GetItemOutput));
    spyOn(verifyExaminer, 'default').and.callFake(mockVerifyExaminer.object);

    mockAdJwtVerifier.setup(x => x.verifyJwt(It.isAny()))
      .returns(() => Promise.resolve(testVerifiedTokenPayload));

    // ACT
    const result = await sut(testCustomAuthorizerEvent);

    // ASSERT
    moqFailedAuthLogger.verify(x => x(It.isAny(), It.isAny()), Times.never());
    moqFailedAuthLogger.verify(x => x(It.isAny(), It.isAny(), It.isAny()), Times.never());
    mockVerifyExaminer.verify(x => x(It.isValue(testVerifiedTokenPayload.employeeid)), Times.once());

    expect(result.policyDocument.Statement[0].Effect).toEqual('Allow');
    expect((<{ Resource: string }>result.policyDocument.Statement[0]).Resource)
      .toEqual('arn:aws:execute-api:region:account-id:api-id/stage-name/*/*');
    expect(result.principalId).toEqual('test-unique_name');
    expect((<AuthResponseContext>result.context).staffNumber).toBe('12345678');
    expect((<AuthResponseContext>result.context).examinerRole).toBe('LDTM');

    mockAdJwtVerifier.verify(x => x.verifyJwt('example-token'), Times.once());
  });

  it('should return a default role of "DE" with the correct context when there is no role present', async () => {
    testCustomAuthorizerEvent.authorizationToken = 'example-token';
    testCustomAuthorizerEvent.methodArn =
      'arn:aws:execute-api:region:account-id:api-id/stage-name/HTTP-VERB/resource/path/specifier';

    const testVerifiedTokenPayload: VerifiedTokenPayload = {
      sub: 'test-subject',
      unique_name: 'test-unique_name',
      employeeid: '12345678',
      roles: [],
    };

    mockVerifyExaminer.setup(x => x(It.isAny()))
      .returns(() => Promise.resolve({
        Item: {
          staffNumber: '12345678',
        },
      } as DynamoDB.Types.GetItemOutput));
    spyOn(verifyExaminer, 'default').and.callFake(mockVerifyExaminer.object);

    mockAdJwtVerifier.setup(x => x.verifyJwt(It.isAny()))
      .returns(() => Promise.resolve(testVerifiedTokenPayload));

    // ACT
    const result = await sut(testCustomAuthorizerEvent);

    // ASSERT
    expect(result.policyDocument.Statement[0].Effect).toEqual('Allow');
    expect((<{ Resource: string }>result.policyDocument.Statement[0]).Resource)
      .toEqual('arn:aws:execute-api:region:account-id:api-id/stage-name/*/*');
    expect(result.principalId).toEqual('test-unique_name');
    expect((<AuthResponseContext>result.context).staffNumber).toBe('12345678');
    expect((<AuthResponseContext>result.context).examinerRole).toBe('DE');

    mockAdJwtVerifier.verify(x => x.verifyJwt('example-token'), Times.once());
  });

  it('should return Deny when token verification fails', async () => {
    testCustomAuthorizerEvent.authorizationToken = 'example-token';
    testCustomAuthorizerEvent.methodArn =
      'arn:aws:execute-api:region:account-id:api-id/stage-name/HTTP-VERB/resource/path/specifier';

    mockVerifyExaminer.setup(x => x(It.isAny()))
      .returns(() => Promise.resolve({
        Item: {
          staffNumber: '12345678',
          role: 'LDTM',
        },
      } as DynamoDB.Types.GetItemOutput));
    spyOn(verifyExaminer, 'default').and.callFake(mockVerifyExaminer.object);

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

  it('should return Deny when the employeeId cannot be found in the JWT', async () => {
    // ARRANGE
    testCustomAuthorizerEvent.authorizationToken = 'example-token';
    testCustomAuthorizerEvent.methodArn =
      'arn:aws:execute-api:region:account-id:api-id/stage-name/HTTP-VERB/resource/path/specifier';
    moqExtractEmployeeIdFromToken.reset();
    moqExtractEmployeeIdFromToken.setup(x => x(It.isAny(), It.isAny())).returns(() => null);
    const testVerifiedTokenPayload: VerifiedTokenPayload = {
      sub: 'test-subject',
      unique_name: 'test-unique_name',
      employeeid: '12345678',
      roles: [],
    };
    mockVerifyExaminer.setup(x => x(It.isAny()))
      .returns(() => Promise.resolve({
        Item: {
          staffNumber: '12345678',
          role: 'LDTM',
        },
      } as DynamoDB.Types.GetItemOutput));
    spyOn(verifyExaminer, 'default').and.callFake(mockVerifyExaminer.object);
    mockAdJwtVerifier.setup(x => x.verifyJwt(It.isAny()))
      .returns(() => Promise.resolve(testVerifiedTokenPayload));

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
        It.is<any>(o => /Verified Token does not have employeeId/.test(o.failedAuthReason))),
      Times.once());
  });

  it('should return Deny when no employee is found', async () => {
    testCustomAuthorizerEvent.authorizationToken = 'example-token';
    testCustomAuthorizerEvent.methodArn =
      'arn:aws:execute-api:region:account-id:api-id/stage-name/HTTP-VERB/resource/path/specifier';
    const testVerifiedTokenPayload: VerifiedTokenPayload = {
      sub: 'test-subject',
      unique_name: 'test-unique_name',
      employeeid: '12345678',
      roles: [],
    };

    mockVerifyExaminer.setup(x => x(It.isAny()))
      .returns(() => Promise.resolve({} as DynamoDB.Types.GetItemOutput));
    spyOn(verifyExaminer, 'default').and.callFake(mockVerifyExaminer.object);

    mockAdJwtVerifier.setup(x => x.verifyJwt(It.isAny()))
      .returns(() => Promise.resolve(testVerifiedTokenPayload));

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
        It.is<any>(o => /The employee id was not found/.test(o.failedAuthReason))),
      Times.once());
  });
});
