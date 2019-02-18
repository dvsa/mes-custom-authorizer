import { uniqueLogStreamName } from '../createFailedAuthLogger';

describe('uniqueLogStreamName', () => {
  const sut = uniqueLogStreamName;

  it('returns a string in the expected format', () => {
    // ACT
    const result = sut();

    // ASSERT
    expect(result).toMatch(/^FailedAuth-\d\d\d\d-\d\d-\d\d-[0-9a-f]{32}$/);
  });

  it('generates unique names each time', () => {
    const results = new Set();
    const countToGenerate = 50000;

    // ACT
    for (let i = 0; i < countToGenerate; i = i + 1) {
      const result = sut();
      results.add(result);
    }

    // ASSERT
    expect(results.size).toEqual(countToGenerate);
  });
});
