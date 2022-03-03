import ensureNotNullOrEmpty from '../ensureNotNullOrEmpty';

describe('ensureNotNullOrEmpty', () => {
  const act = (val: any, fieldName: string): Error | null => {
    try {
      ensureNotNullOrEmpty(val, fieldName);
      return null;
    } catch (err) {
      return err as unknown as Error;
    }
  };

  it('does nothing if value is an object', () => {
    // ACT
    const errorThrown = act({ }, 'n/a');

    // ASSERT
    expect(errorThrown).toBeNull();
  });

  it('does nothing if value is a string', () => {
    // ACT
    const errorThrown = act('example text', 'n/a');

    // ASSERT
    expect(errorThrown).toBeNull();
  });

  it('does nothing if value is a number', () => {
    // ACT
    const errorThrown = act(123, 'n/a');

    // ASSERT
    expect(errorThrown).toBeNull();
  });

  it('throws an error if value is null', () => {
    // ACT
    const errorThrown = act(null, 'fieldName1');

    // ASSERT
    expect(errorThrown).toEqual(new Error('fieldName1 is null or empty'));
  });

  it('throws an error if value is undefined', () => {
    // ACT
    const errorThrown = act(undefined, 'fieldName2');

    // ASSERT
    expect(errorThrown).toEqual(new Error('fieldName2 is null or empty'));
  });

  it('throws an error if value is empty string', () => {
    // ACT
    const errorThrown = act('', 'fieldName3');

    // ASSERT
    expect(errorThrown).toEqual(new Error('fieldName3 is null or empty'));
  });
});
