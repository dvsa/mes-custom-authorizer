import { Mock, It, Times } from 'typemoq';
import {GetCommandOutput} from '@aws-sdk/lib-dynamodb';
import {
  CustomAuthorizerResult,
  AuthResponseContext,
  APIGatewayTokenAuthorizerEvent,
} from 'aws-lambda';
import AdJwtVerifier, { VerifiedTokenPayload } from '../../application/AdJwtVerifier';
import { handler, setFailedAuthLogger } from '../handler';
import { Logger } from '../createLogger';
import * as createAdJwtVerifier from '../createAdJwtVerifier';
import * as verifyExaminer from '../../application/verifyExaminer';
import * as getEmployeeIdKey from '../../application/getEmployeeIdKey';
import * as extractEmployeeIdFromToken from '../../application/extractEmployeeIdFromToken';

describe('handler', () => {
  const moqFailedAuthLogger = Mock.ofType<Logger>();
  const mockAdJwtVerifier = Mock.ofType<AdJwtVerifier>();
  const mockVerifyExaminer = Mock.ofInstance(verifyExaminer.default);
  const mockGetEmployeeIdKey = Mock.ofInstance(getEmployeeIdKey.default);
  const moqExtractEmployeeIdFromToken = Mock.ofInstance(extractEmployeeIdFromToken.extractEmployeeIdFromToken);
  let testCustomAuthorizerEvent: APIGatewayTokenAuthorizerEvent;

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
      type: 'TOKEN',
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
        $metadata: {},
        Item: {
          staffNumber: '12345678',
          role: 'LDTM',
        },
      } as GetCommandOutput));
    spyOn(verifyExaminer, 'default').and.callFake(mockVerifyExaminer.object);
    testCustomAuthorizerEvent.authorizationToken = '';

    let errorThrown: Error | undefined;
    let result: CustomAuthorizerResult | undefined;

    // ACT
    try {
      result = await sut(testCustomAuthorizerEvent);
    } catch (err) {
      errorThrown = err as unknown as Error;
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
      preferred_username: 'test-preferred-username',
      employeeid: '12345678',
      roles: [],
    };

    mockVerifyExaminer.setup(x => x(It.isAny()))
      .returns(() => Promise.resolve({
        $metadata: {},
        Item: {
          staffNumber: '12345678',
          role: 'LDTM',
        },
      } as GetCommandOutput));
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
    expect(result.principalId).toEqual('test-preferred-username');
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
      preferred_username: 'test-preferred-username',
      employeeid: '12345678',
      roles: [],
    };

    mockVerifyExaminer.setup(x => x(It.isAny()))
      .returns(() => Promise.resolve({
        $metadata: {},
        Item: {
          staffNumber: '12345678',
        },
      } as GetCommandOutput));
    spyOn(verifyExaminer, 'default').and.callFake(mockVerifyExaminer.object);

    mockAdJwtVerifier.setup(x => x.verifyJwt(It.isAny()))
      .returns(() => Promise.resolve(testVerifiedTokenPayload));

    // ACT
    const result = await sut(testCustomAuthorizerEvent);

    // ASSERT
    expect(result.policyDocument.Statement[0].Effect).toEqual('Allow');
    expect((<{ Resource: string }>result.policyDocument.Statement[0]).Resource)
      .toEqual('arn:aws:execute-api:region:account-id:api-id/stage-name/*/*');
    expect(result.principalId).toEqual('test-preferred-username');
    expect((<AuthResponseContext>result.context).staffNumber).toBe('12345678');
    expect((<AuthResponseContext>result.context).examinerRole).toBe('DE');

    mockAdJwtVerifier.verify(x => x.verifyJwt('example-token'), Times.once());
  });

  it('should return Deny when token verification fails', async () => {
    // eslint-disable-next-line max-len
    testCustomAuthorizerEvent.authorizationToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6ImtnMkxZczJUMENUaklmajRydDZKSXluZW4zOCJ9.eyJhdWQiOiI5MjNiMDdkNC04MGVlLTQ1MjQtOGYzOC1jMTIzMGFlZmUxNTEiLCJpc3MiOiJodHRwczovL2xvZ2luLm1pY3Jvc29mdG9ubGluZS5jb20vNmM0NDhkOTAtNGNhMS00Y2FmLWFiNTktMGEyYWE2N2Q3ODAxL3YyLjAiLCJpYXQiOjE2MDMxMTQyMTUsIm5iZiI6MTYwMzExNDIxNSwiZXhwIjoxNjAzMTE1NzE1LCJhaW8iOiJBVFFBeS84UkFBQUFwNkNvV3VVZXNFV0hjZGRESTBVTXlMMi82OVdMcS9aVGJZTGZhU2RXRC9VYnc1a0drenVXYXNhZGVOWXlsVkVFIiwiYXpwIjoiOTIzYjA3ZDQtODBlZS00NTI0LThmMzgtYzEyMzBhZWZlMTUxIiwiYXpwYWNyIjoiMCIsImdyb3VwcyI6WyI0Y2RjYzBlMy1lYjRhLTQ1NDgtOTU2ZS0wNDY5MDNiN2JjMjAiXSwibmFtZSI6IlRTVCBERVMgRGVsZWdhdGVkRXhhbWluZXIgREVWIDEiLCJvaWQiOiJjZGU1YjljNC1iY2ZlLTQ5OGItYmM3ZC1mODU3MjYzODM3OWUiLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJUU1QuREVTLURlbGVnYXRlZC1ERVYxQGR2c2F0ZXN0LWNsb3VkLnVrIiwicmgiOiIwLkFBQUFrSTFFYktGTXIweXJXUW9xcG4xNEFkUUhPNUx1Z0NSRmp6akJJd3J2NFZGSUFIWS4iLCJyb2xlcyI6WyJEZWxFeGFtaW5lciJdLCJzY3AiOiJEaXJlY3RvcnkuQWNjZXNzQXNVc2VyLkFsbCBEaXJlY3RvcnkuUmVhZC5BbGwgZW1haWwgb2ZmbGluZV9hY2Nlc3Mgb3BlbmlkIHByb2ZpbGUgVXNlci5SZWFkIiwic3ViIjoieXdNUHJVdG41c1VQNFJleUpDTjRwLUI5dFh0R2w5aTV6LUxVMmdPVFRzTSIsInRpZCI6IjZjNDQ4ZDkwLTRjYTEtNGNhZi1hYjU5LTBhMmFhNjdkNzgwMSIsInV0aSI6IlpUX2ZOREtjUVVDbmI4VjZ3TDZQQUEiLCJ2ZXIiOiIyLjAiLCJ3aWRzIjpbImI3OWZiZjRkLTNlZjktNDY4OS04MTQzLTc2YjE5NGU4NTUwOSJdLCJlbXBsb3llZWlkIjoiMTAwMDAwMTQifQ.lVKgyWWJSl5HJuz9xpMv-j_cdc5J_Cx7AqnraVVbWWNNTbkNhIUV-qVh1GWi6llwEzjJ8YrK_TZXIumGO5jw1nhZw2a3cqGkqmiyri098nNmTmQBpP730R8WqogjOfwV3zFKQboJpxvZjQVQX7kLZyb1IT3CxE3gS5z31zxCOKr5LqnlvA9z6m55gBNIm2xGm-2-xepn8NYT1YplPwkFL4O0vY14uiyDY9Drwb8FyjAlW1trK1u_jOQS2ylT_zIZ0WG8m61DGoKNAAyl8obIPcVvruNHhwd1EV08Aa8yOPbvAKRw6O9EsTins97Ua7nu6Ln_Illait7Vemk-Mqy_5w';  // tslint:disable: max-line-length
    testCustomAuthorizerEvent.methodArn =
      'arn:aws:execute-api:region:account-id:api-id/stage-name/HTTP-VERB/resource/path/specifier';

    mockVerifyExaminer.setup(x => x(It.isAny()))
      .returns(() => Promise.resolve({
        $metadata: {},
        Item: {
          staffNumber: '12345678',
          role: 'LDTM',
        },
      } as GetCommandOutput));
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

    mockAdJwtVerifier.verify(x => x.verifyJwt(It.isAnyString()), Times.once());

    moqFailedAuthLogger.verify(
      x => x(
        It.is<string>(s => /Failed authorization\. Responding with Deny\./.test(s)),
        'error',
        It.isObjectWith({
          failedAuthReason: 'Error: Example invalid token error',
          employee: {
            id: '12345678',
            name: 'TST DES DelegatedExaminer DEV 1',
            preferred_username: 'TST.DES-Delegated-DEV1@dvsatest-cloud.uk',
          },
        }),
      ),
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
      preferred_username: 'test-preferred-username',
      employeeid: '12345678',
      roles: [],
    };
    mockVerifyExaminer.setup(x => x(It.isAny()))
      .returns(() => Promise.resolve({
        $metadata: {},
        Item: {
          staffNumber: '12345678',
          role: 'LDTM',
        },
      } as GetCommandOutput));
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
      preferred_username: 'test-preferred-username',
      employeeid: '12345678',
      roles: [],
    };

    mockVerifyExaminer.setup(x => x(It.isAny()))
      .returns(() => Promise.resolve({} as GetCommandOutput));
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
