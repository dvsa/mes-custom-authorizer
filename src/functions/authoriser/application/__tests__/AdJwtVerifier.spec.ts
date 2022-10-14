import { Mock, It, Times } from 'typemoq';
import * as jwt from 'jsonwebtoken';
import * as JwksRsa from 'jwks-rsa';
import AdJwtVerifier from '../AdJwtVerifier';
import {SigningKey} from 'jwks-rsa';

describe('AdJwtVerifier', () => {
  const moqJwtDecode = Mock.ofInstance(jwt.decode);
  const moqJwtVerify = Mock.ofInstance(jwt.verify);
  const moqJwksClient = Mock.ofType<JwksRsa.JwksClient>();

  let testSigningKey: SigningKey;

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
      }));

    spyOn(jwt, 'decode').and.callFake(moqJwtDecode.object);
    spyOn(jwt, 'verify').and.callFake(moqJwtVerify.object);

    testSigningKey = { kid: 'test-kid', publicKey: 'test-publicKey' } as SigningKey;

    sut = new AdJwtVerifier('test-applicationId', 'test-issuer', moqJwksClient.object);
  });

  describe('verifyJwt', () => {
    it('calls dependencies and returns result as expected', async () => {
      // ACT
      const result = await sut.verifyJwt('example-token');

      // ASSERT
      moqJwtDecode.verify(
        x => x('example-token', It.isObjectWith({ complete: true })),
        Times.once());

      moqJwksClient.verify(x => x.getSigningKey('test-kid'), Times.once());

      moqJwtVerify.verify(
        x => x('example-token', 'test-publicKey', It.is<jwt.VerifyOptions>(o =>
          o.audience === 'test-applicationId' &&
          o.issuer === 'test-issuer' &&
          o.clockTolerance !== undefined &&
          o.clockTolerance > 0)),
        Times.once());

      expect(result.sub).toBe('test-subject');
      expect(result.preferred_username).toBe('test-preferred-username');
    });

    it('uses publicKey over rsaPublicKey if they\'re both defined', async () => {
      testSigningKey = {
        kid: 'xyz',
        publicKey: 'test-publicKey-123',
      } as SigningKey;

      // ACT
      await sut.verifyJwt('example-token');

      // ASSERT
      moqJwtVerify.verify(x => x(It.isAny(), 'test-publicKey-123', It.isAny()), Times.once());
    });

    it('throws an error if publicKey is defined', async () => {
      testSigningKey = { kid: 'xyz' } as SigningKey;

      let errorThrown: Error = new Error();

      // ACT
      try {
        await sut.verifyJwt('example-token');
      } catch (err) {
        errorThrown = err as unknown as Error;
      }

      // Assert
      expect(errorThrown).toEqual(new Error('No public RSA key for kid: test-kid'));
      expect(errorThrown.toString()).toEqual('Error: No public RSA key for kid: test-kid');

      moqJwtVerify.verify(x => x(It.isAny(), It.isAny(), It.isAny()), Times.never());
    });
  });
});
