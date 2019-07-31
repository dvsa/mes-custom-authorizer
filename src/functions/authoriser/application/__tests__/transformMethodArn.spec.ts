import * as transformMethodArn from '../transformMethodArn';

describe('transformMethodArn.toAllVerbsAndAllResources', () => {
  const sut = transformMethodArn.toAllVerbsAndAllResources;

  it('changes httpVerb and resourcePath parts to wildcard', () => {
    // ACT
    const result = sut('arn:aws:execute-api:eu-west-1:920842203002:y2rp6iy583/dev/GET/journal');

    // ASSERT
    expect(result).toEqual('arn:aws:execute-api:eu-west-1:920842203002:y2rp6iy583/dev/*/*');
  });

  it('changes appends httpVerb and resourcePath wildcards if not present', () => {
    // ACT
    const result = sut('arn:aws:execute-api:eu-west-1:920842203002:y2rp6iy583/dev');

    // ASSERT
    expect(result).toEqual('arn:aws:execute-api:eu-west-1:920842203002:y2rp6iy583/dev/*/*');
  });

  it('does not perform validation', () => {
    // ACT
    const result = sut('abc/xyz');

    // ASSERT
    expect(result).toEqual('abc/xyz/*/*');
  });

  it(
    'does not care about anything other than having at least 2 parts in the input methodArn',
    () => {
      // ACT
      const result = sut(
        'arn:aws:execute-api:{regionId}:{accountId}:{appId}/{stage}/{httpVerb}/{resrc}/{child}');

      // ASSERT
      expect(result)
        .toEqual('arn:aws:execute-api:{regionId}:{accountId}:{appId}/{stage}/*/*');
    });

  it('throws error if stage name is not present', () => {
    expect(() => sut('abc'))
      .toThrow(new Error('Failed to extract arnBase and stageName from methodArn: "abc"'));
  });

  it('throws error if passed empty string', () => {
    expect(() => sut(''))
      .toThrow(new Error('Failed to extract arnBase and stageName from methodArn: ""'));
  });

  it('throws error if passed whitespace string', () => {
    expect(() => sut(' \t '))
      .toThrow(new Error('Failed to extract arnBase and stageName from methodArn: " \t "'));
  });

  it('throws error if passed null string', () => {
    expect(() => sut(<string><unknown>null))
      .toThrow(new Error('Failed to extract arnBase and stageName from methodArn: (null)'));
  });

  it('throws error if passed undefined string', () => {
    expect(() => sut(<string><unknown>undefined))
      .toThrow(new Error('Failed to extract arnBase and stageName from methodArn: (undefined)'));
  });
});
