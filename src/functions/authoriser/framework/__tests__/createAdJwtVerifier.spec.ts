import { Mock, It, Times } from 'typemoq';
import * as jwksRsa from 'jwks-rsa';
import * as jwks from '../jwks';
import AdJwtVerifier from '../../application/AdJwtVerifier';
import createAdJwtVerifier, {FetchConfigService, IFetchConfigService} from '../createAdJwtVerifier';

describe('createAdJwtVerifier', () => {
  const fetchConfigMock = Mock.ofType<IFetchConfigService>();
  const moqJwksClientFactory = Mock.ofInstance(jwks.jwksClientFactory);
  const moqJwksClient = Mock.ofInstance(new jwksRsa.JwksClient({ jwksUri: 'fdjshd' }));

  let testOpenidConfig = {} as { [key: string]: string };

  const sut = createAdJwtVerifier;
  let spy: jasmine.Spy;

  beforeEach(() => {
    fetchConfigMock.reset();
    moqJwksClientFactory.reset();
    moqJwksClient.reset();

    moqJwksClientFactory
      .setup(x => x(It.isAny()))
      .returns(() => moqJwksClient.object);

    fetchConfigMock
      .setup(f => f.fetchConfig(It.isAnyString(), It.isAnyString()))
      .returns(async () => new Response('Mock Response'));

    spyOn(jwks, 'jwksClientFactory').and.callFake(moqJwksClientFactory.object);

    testOpenidConfig = {
      issuer: 'example-issuer',
      jwks_uri: 'example-jwks_uri',
    };

    spy = spyOn(FetchConfigService, 'fetchConfig').and.callFake(() => {
      return Promise.resolve({
        json() {
          return Promise.resolve({
            ...testOpenidConfig,
          });
        },
      } as Response);
    });

    process.env.AZURE_AD_TENANT_ID = 'example-TenantId';
    process.env.AZURE_AD_CLIENT_ID = 'example-ClientId';
  });

  it('throws an error if TenantId is not set', async () => {
    delete process.env.AZURE_AD_TENANT_ID;

    let errorThrown: Error | undefined;
    let result: AdJwtVerifier | undefined;

    // ACT
    try {
      result = await sut();
    } catch (err) {
      errorThrown = err as unknown as Error;
    }

    // ASSERT
    expect(errorThrown).toEqual(new Error('process.env.AZURE_AD_TENANT_ID is null or empty'));
    expect(result).toBeUndefined();
  });

  it('throws an error if ClientId is not set', async () => {
    delete process.env.AZURE_AD_CLIENT_ID;

    let errorThrown: Error | undefined;
    let result: AdJwtVerifier | undefined;

    // ACT
    try {
      result = await sut();
    } catch (err) {
      errorThrown = err as unknown as Error;
    }

    // ASSERT
    expect(errorThrown).toEqual(new Error('process.env.AZURE_AD_CLIENT_ID is null or empty'));
    expect(result).toBeUndefined();
  });

  it('throws an error if the OpenID response json contains the `error_description` field', async () => {
    testOpenidConfig = {
      error_description: 'Example error in OpenID Config',
    };

    let errorThrown: Error | undefined;
    let result: AdJwtVerifier | undefined;

    // ACT
    try {
      result = await sut();
    } catch (err) {
      errorThrown = err as unknown as Error;
    }

    // ASSERT
    expect(errorThrown).toEqual(new Error('Failed to get openid configuration: Example error in OpenID Config'));
    expect(result).toBeUndefined();
  });

  it('returns an `AdJwtVerifier` with the expected applicationId and issuer', async () => {
    // ACT
    const result = await sut();

    // ASSERT
    expect(result.applicationId).toEqual('example-ClientId');
    expect(result.issuer).toEqual('example-issuer');
  });

  it('calls the expected OpenID Connect discovery URL for the expected tenant', async () => {
    // ACT
    await sut();
    expect(spy).toHaveBeenCalledWith('example-TenantId', 'example-ClientId');
  });

  it('creates a `jwksClient` as expected', async () => {
    // ACT
    await sut();

    // ASSERT
    moqJwksClientFactory.verify(
      x => x(It.isObjectWith({
        jwksUri: 'example-jwks_uri',
        cache: true,
        cacheMaxEntries: 10,
      })),
      Times.once());
  });
});
