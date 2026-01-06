/**
 * Test Data and Fixtures
 *
 * Provides standardized test data for Result testing scenarios.
 */

/**
 * Standard test values for different data types
 */
export const TestValues = {
  /** Numeric test cases */
  numbers: {
    positive: [1, 42, 100, 999, Number.MAX_SAFE_INTEGER],
    negative: [-1, -42, -100, -999, Number.MIN_SAFE_INTEGER],
    zero: 0,
    special: [Infinity, -Infinity, NaN],
    floating: [0.5, 3.14, -2.71, 0.0],
  },

  /** String test cases */
  strings: {
    simple: ["hello", "world", "test", "data", "Result"],
    complex: ["hello world!", "123 numbers", "special@#$%&*()", "unicode: αβγ"],
    empty: "",
    whitespace: ["  ", "\t", "\n", "\r\n", "   mixed   "],
    long: ["a".repeat(100), "b".repeat(1000), "c".repeat(10000)],
  },

  /** Boolean test cases */
  booleans: {
    true: [true, 1, "true", {}, []] as any[],
    false: [false, 0, "", null, undefined] as any[],
  },

  /** Object test cases */
  objects: {
    simple: [{}, { a: 1 }, { b: "test" }],
    nested: [{ a: { b: { c: 1 } } }, { x: { y: { z: "deep" } } }],
    arrays: [[1, 2, 3], ["a", "b", "c"], [{ nested: true }]],
    functions: [() => "test", (x: number) => x * 2],
  },
} as const;

/**
 * Error test cases for different scenarios
 */
export const TestErrors = {
  /** Simple string errors */
  strings: {
    common: ["error", "failure", "invalid", "timeout", "network"],
    specific: [
      "Validation failed: field required",
      "Network timeout occurred",
      "File not found",
      "Permission denied",
      "Database connection lost",
    ],
  },

  /** Error object instances */
  objects: [
    new Error("Standard error"),
    new TypeError("Type mismatch"),
    new RangeError("Out of bounds"),
    new ReferenceError("Not defined"),
    new SyntaxError("Invalid syntax"),
  ],

  /** Custom error structures */
  custom: [
    { code: 400, message: "Bad Request" },
    { code: 404, message: "Not Found" },
    { code: 500, message: "Internal Server Error" },
    { type: "ValidationError", details: ["field1", "field2"] },
    { type: "NetworkError", timeout: 5000, retryable: true },
  ],

  /** Null and undefined errors */
  nullish: [null, undefined],
} as const;

/**
 * Transformation functions for testing
 */
export const TestTransforms = {
  /** Numeric transformations */
  numeric: {
    identity: (x: number) => x,
    double: (x: number) => x * 2,
    square: (x: number) => x * x,
    add: (n: number) => (x: number) => x + n,
    toString: (x: number) => x.toString(),
    isEven: (x: number) => x % 2 === 0,
  },

  /** String transformations */
  strings: {
    identity: (x: string) => x,
    upper: (x: string) => x.toUpperCase(),
    lower: (x: string) => x.toLowerCase(),
    length: (x: string) => x.length,
    reverse: (x: string) => x.split("").reverse().join(""),
    prefix: (pre: string) => (x: string) => `${pre}${x}`,
    suffix: (suf: string) => (x: string) => `${x}${suf}`,
  },

  /** Object transformations */
  objects: {
    pick:
      <K extends string>(key: K) =>
      (obj: Record<K, any>) =>
        obj[key],
    keys: (obj: object) => Object.keys(obj),
    values: (obj: object) => Object.values(obj),
    entries: (obj: object) => Object.entries(obj),
    merge: (other: object) => (obj: object) => ({ ...obj, ...other }),
  },

  /** Conditional transformations */
  conditional: {
    when:
      <T>(condition: (x: T) => boolean, transform: (x: T) => T) =>
      (x: T) =>
        condition(x) ? transform(x) : x,
    always:
      <T>(transform: (x: T) => T) =>
      (x: T) =>
        transform(x),
    never: <T>(_: T) => _,
  },
} as const;

/**
 * Result-returning transformations for flatMap testing
 */
export const TestResultTransforms = {
  /** Numeric Result transformations */
  numeric: {
    okIfPositive: (x: number) =>
      x >= 0 ? { ok: true, value: x } : { ok: false, error: "negative" },
    okIfEven: (x: number) =>
      x % 2 === 0 ? { ok: true, value: x } : { ok: false, error: "odd" },
    doubleIfPositive: (x: number) =>
      x >= 0 ? { ok: true, value: x * 2 } : { ok: false, error: "negative" },
  },

  /** String Result transformations */
  strings: {
    okIfNonEmpty: (x: string) =>
      x.length > 0 ? { ok: true, value: x } : { ok: false, error: "empty" },
    okIfContains: (substring: string) => (x: string) =>
      x.includes(substring)
        ? { ok: true, value: x }
        : { ok: false, error: `missing ${substring}` },
  },
} as const;

/**
 * Async transformations for testing async operations
 */
export const TestAsyncTransforms = {
  /** Delayed synchronous transforms */
  delayed: {
    withDelay:
      <T, U>(transform: (x: T) => U, delayMs: number = 10) =>
      async (x: T): Promise<U> => {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return transform(x);
      },
    exponentialDelay:
      (baseMs: number = 10) =>
      <T, U>(transform: (x: T) => U) =>
      async (x: T, attempt: number = 1): Promise<U> => {
        await new Promise((resolve) =>
          setTimeout(resolve, baseMs * 2 ** (attempt - 1)),
        );
        return transform(x);
      },
  },

  /** Result-returning async transforms */
  asyncResults: {
    okAfterDelay:
      <T>(value: T, delayMs: number = 10) =>
      async (): Promise<{ ok: true; value: T }> => {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return { ok: true, value };
      },
    errAfterDelay:
      <E>(error: E, delayMs: number = 10) =>
      async (): Promise<{ ok: false; error: E }> => {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return { ok: false, error };
      },
  },
} as const;

/**
 * Complex scenarios and edge cases
 */
export const TestScenarios = {
  /** Chaining scenarios */
  chaining: {
    simple: [
      (x: number) => x * 2,
      (x: number) => x + 1,
      (x: number) => x.toString(),
    ],
    complex: [
      (x: number) => x * 2,
      (x: number) => Math.sqrt(x),
      (x: number) => Math.floor(x),
      (x: number) => x.toString(),
      (x: string) => x.padStart(10, "0"),
    ],
    withErrors: [
      (x: number) => x * 2,
      (x: number) => {
        if (x > 100) throw new Error("Too large");
        return x;
      },
      (x: number) => x + 1,
    ],
  },

  /** Validation scenarios */
  validation: {
    numeric: [
      (x: number) =>
        x >= 0 ? { ok: true, value: x } : { ok: false, error: "negative" },
      (x: number) =>
        x <= 1000 ? { ok: true, value: x } : { ok: false, error: "too large" },
      (x: number) =>
        x % 1 === 0
          ? { ok: true, value: x }
          : { ok: false, error: "not integer" },
    ],
    string: [
      (x: string) =>
        x.length > 0 ? { ok: true, value: x } : { ok: false, error: "empty" },
      (x: string) =>
        x.length <= 100
          ? { ok: true, value: x }
          : { ok: false, error: "too long" },
      (x: string) =>
        /^[a-zA-Z]+$/.test(x)
          ? { ok: true, value: x }
          : { ok: false, error: "invalid chars" },
    ],
  },

  /** Performance test data */
  performance: {
    smallArrays: Array.from({ length: 10 }, (_, i) =>
      Array.from({ length: 10 }, (_, j) => i * 10 + j),
    ),
    mediumArrays: Array.from({ length: 10 }, (_, i) =>
      Array.from({ length: 100 }, (_, j) => i * 100 + j),
    ),
    largeArrays: Array.from({ length: 5 }, (_, i) =>
      Array.from({ length: 1000 }, (_, j) => i * 1000 + j),
    ),
    nestedObjects: Array.from({ length: 100 }, (_, i) => ({
      id: i,
      value: Math.random(),
      nested: { a: i, b: i * 2, deep: { c: i * 3 } },
    })),
  },
} as const;

/**
 * Type helpers for test data
 */
export type TestNumber =
  | (typeof TestValues.numbers.positive)[number]
  | (typeof TestValues.numbers.negative)[number];
export type TestString =
  | (typeof TestValues.strings.simple)[number]
  | (typeof TestValues.strings.complex)[number];
export type TestError =
  | (typeof TestErrors.strings.common)[number]
  | Error
  | { code: number; message: string };

/**
 * Combinations and permutations for exhaustive testing
 */
export const TestCombinations = {
  /** All combinations of values and errors */
  valueErrorPairs: [
    ...TestValues.numbers.positive.map((v) => ({
      value: v,
      error: TestErrors.strings.common[0],
    })),
    ...TestValues.strings.simple.map((v) => ({
      value: v,
      error: TestErrors.strings.common[1],
    })),
  ],

  /** All transformation types */
  allTransforms: [
    ...Object.values(TestTransforms.numeric),
    ...Object.values(TestTransforms.strings),
    ...Object.values(TestTransforms.conditional),
  ],

  /** Error scenarios */
  errorScenarios: [
    ...TestErrors.strings.common,
    ...TestErrors.objects,
    ...TestErrors.custom,
  ],
} as const;
