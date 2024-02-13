import { pipe } from "@carbonteq/fp/pipes";

describe('pipe construction', () => {
  it('pipe should handle transformation functions', () => {
    const len = (s: string): number => s.length;
    const double = (n: number): number => n * 2;
    const square = (n: number): number => n ** 2;
    
    const res = pipe(
      "hi",
      len,
      double,
      square
    );

    expect(res).toBe(16);
  });

  it('pipe should handle async functions', async () => {
    const res = await pipe(
      2,
      async (a) => await a + 2,
      async (b) => await b * 3,
    );

    expect(res).toBe(12);
  });

  it('pipe should handle complex transformation functions', async () => {
    const res = await pipe(
      2,
      (a) => {
        const x = Math.pow(2, 2);
        const y = Math.random();
        if (y > 0.5) {
          return x;
        }
        return a;
      },
      async (b) => await b * 3,
    );

    expect(res).toBe(6 || 12);
  });

  it('nested pipes', async () => {
    
    const res = await pipe(
      2,
      (a) => a + 3,
      (b) => pipe(
        b,
        (c) => c * 3,
        (d) => d > 10 ? true : false
      )
    );

    expect(res).toBe(true);
  });
});