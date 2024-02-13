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
});