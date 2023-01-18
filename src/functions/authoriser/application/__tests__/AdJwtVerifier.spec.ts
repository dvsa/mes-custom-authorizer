import { Mock, It, Times } from 'typemoq';
import * as jwt from 'jsonwebtoken';
import * as JwksRsa from 'jwks-rsa';
import AdJwtVerifier from '../AdJwtVerifier';

/*eslint-disable */
describe('AdJwtVerifier', () => {
  const moqJwtDecode = Mock.ofInstance(jwt.decode);
  const moqJwtVerify = Mock.ofInstance(jwt.verify);
  const moqJwksClient = Mock.ofType<JwksRsa.JwksClient>();
  const mockToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6IjJaUXBKM1VwYmpBWVhZR2FYRUpsOGxWMFRPSSJ9.eyJhdWQiOiI5MjNiMDdkNC04MGVlLTQ1MjQtOGYzOC1jMTIzMGFlZmUxNTEiLCJpc3MiOiJodHRwczovL2xvZ2luLm1pY3Jvc29mdG9ubGluZS5jb20vNmM0NDhkOTAtNGNhMS00Y2FmLWFiNTktMGEyYWE2N2Q3ODAxL3YyLjAiLCJpYXQiOjE2NjkyMTUyMTAsIm5iZiI6MTY2OTIxNTIxMCwiZXhwIjoxNjY5MjE2NzEwLCJhaW8iOiJBVFFBeS84VEFBQUFQNjJ1eEp2ZDI4dDZVVlRQZDNlZjhrMjRiaXJ0WXI4TjVNKzI0VkI3anhBV2M0TDM3NVJTSEZpSUl1WXRqaG5yIiwibmFtZSI6Ik1FU0JldGEgVXNlciAxIiwib2lkIjoiZDQ4NDEyZTgtMWU5ZS00Zjc3LTliYzYtZWVkOGZlM2I1MWVmIiwicHJlZmVycmVkX3VzZXJuYW1lIjoibW9iZXhhbWluZXIxQGR2c2F0ZXN0LWNsb3VkLnVrIiwicmgiOiIwLkFVZ0FrSTFFYktGTXIweXJXUW9xcG4xNEFkUUhPNUx1Z0NSRmp6akJJd3J2NFZGSUFDUS4iLCJzdWIiOiJpandGUGFDRk9RcjVlTXg1NC1MMkhaZ1FiOEctZHJvRkJGV1ZrUEI0SVdjIiwidGlkIjoiNmM0NDhkOTAtNGNhMS00Y2FmLWFiNTktMGEyYWE2N2Q3ODAxIiwidXRpIjoiOEUtM2JxMDFrMFdRZF9LbzJmdDdBQSIsInZlciI6IjIuMCIsImVtcGxveWVlaWQiOiIxMjM0NTY3In0.cd2Dk8iAXYiA1ts2djjVFZ9G6FeoHQWNDL-cDz4WQrEJzvYI710YNKSTGqMUIPljdaAryOaH90SXq67jiKNvkcQj_7ypVcZQA8pAWw5tZ7ai7JeTB3GR12hWtxK5O2gEliD1cZhU8I3L4va8Syk_3YSvhBD0qAV78vCywUneNaHMu01HzI10z_PnfqudKrK5mWmlGqebHik2rsAFWcI4lPUqPVWtZdeY1edYB349_7zum6X2YxIt-pu5GNIbPZVIPY7WZEf-hEKzeqwlAJbZDCw-dmAsV40xrwsJJH-mI48QeMK8KXucVZp-g1VsY5c6fVmrYiIwkgDkHCBG7DJCWg';
  const mockKid = '2ZQpJ3UpbjAYXYGaXEJl8lV0TOI';

  let testSigningKey: JwksRsa.SigningKey;

  let sut: AdJwtVerifier;

  beforeEach(() => {
    moqJwtDecode.reset();
    moqJwtVerify.reset();
    moqJwksClient.reset();

    moqJwtDecode.setup(x => x(It.isAnyString(), It.isAny()))
      .returns(() => ({
        header: {
          alg: 'test-alg',
          typ: 'test-type',
          kid: 'test-kid',
        },
        payload: 'test-string',
        signature: 'sig',
      }));

    moqJwksClient.setup(x => x.getSigningKey(It.isAnyString()))
      .returns(() => Promise.resolve(testSigningKey));

    moqJwtVerify.setup(x => x(It.isAnyString(), It.isAnyString(), It.isAny()))
      .returns(() => ({
        header: {
          alg: 'test-alg',
          typ: 'test-type',
          kid: 'test-kid',
        },
        payload: {
          key: 'key',
          sub: 'test-subject',
        },
        signature: 'sig',
        sub: 'test-subject',
        preferred_username: 'test-preferred-username',
        'extn.employeeId': [
          'employeeId',
        ],
      }));

    spyOn(jwt, 'verify').and.callFake(moqJwtVerify.object);

    testSigningKey = {
      kid: 'test-kid',
      getPublicKey() { return 'test-publicKey-123'; },
    } as JwksRsa.SigningKey;

    sut = new AdJwtVerifier('test-applicationId', 'test-issuer', moqJwksClient.object);
  });

  describe('verifyJwt', () => {
    //
    it('calls dependencies and returns result as expected', async () => {
      // ACT
      const result = await sut.verifyJwt(mockToken);

      // ASSERT
      moqJwksClient.verify(x => x.getSigningKey(mockKid), Times.once());

      expect(result.sub).toBe('test-subject');
      expect(result.preferred_username).toBe('test-preferred-username');
    });

    it('uses publicKey over rsaPublicKey if they\'re both defined', async () => {

      // ACT
      await sut.verifyJwt(mockToken);

      // ASSERT
      moqJwtVerify.verify(x => x(It.isAny(), 'test-publicKey-123', It.isAny()), Times.once());
    });

    it('throws an error if publicKey is defined', async () => {
      testSigningKey = {
        kid: 'test-kid',
        getPublicKey() { return ''; },
      } as JwksRsa.SigningKey;

      let errorThrown = null; // set to null to check catch path runs

      // ACT
      try {
        await sut.verifyJwt(mockToken);
      } catch (err) {
        errorThrown = new Error(err as unknown as string) as Error;
      }

      // Assert
      expect(errorThrown).toBeInstanceOf(Error);
      expect(errorThrown?.toString()).toContain('Error: No public RSA key for kid');

      moqJwtVerify.verify(x => x(It.isAny(), It.isAny(), It.isAny()), Times.never());
    });
  });
});
