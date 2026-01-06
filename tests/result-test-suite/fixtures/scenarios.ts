/**
 * Test Scenarios and Complex Operations
 *
 * Provides complex operation scenarios for comprehensive Result testing.
 */

import { TestResultTransforms, TestTransforms, TestValues } from "./data";

/**
 * Complex chaining scenarios that test various aspects of Result operations
 */
export const ChainingScenarios = {
  /** Simple linear chains that should all succeed */
  simpleSuccess: [
    {
      name: "number arithmetic chain",
      initialValue: 5,
      operations: [
        (x: number) => x * 2,
        (x: number) => x + 3,
        (x: number) => x / 2,
      ],
      expected: 8,
    },
    {
      name: "string manipulation chain",
      initialValue: "hello",
      operations: [
        (x: string) => x.toUpperCase(),
        (x: string) => x + " WORLD",
        (x: string) => x.toLowerCase(),
      ],
      expected: "hello world",
    },
    {
      name: "mixed type chain",
      initialValue: 42,
      operations: [
        (x: number) => x * 2,
        (x: number) => x.toString(),
        (x: string) => x.length,
      ],
      expected: 2,
    },
  ],

  /** Chains that include errors at various points */
  withErrors: [
    {
      name: "error at start",
      initialValue: "invalid",
      operations: [
        (x: string) => x.length,
        (x: number) => x * 2,
        (x: number) => x + 1,
      ],
      errorType: "string",
    },
    {
      name: "error in middle",
      initialValue: 5,
      operations: [
        (x: number) => x * 2,
        (x: number) => {
          if (x > 5) throw new Error("Too large");
          return x;
        },
        (x: number) => x + 1,
      ],
      errorType: "Too large",
    },
    {
      name: "division by zero",
      initialValue: 10,
      operations: [
        (x: number) => x - 10,
        (x: number) => x / x, // Division by zero!
        (x: number) => x * 2,
      ],
      errorType: "division",
    },
  ],

  /** Complex nested operations */
  nested: [
    {
      name: "nested arithmetic",
      initialValue: [1, 2, 3],
      operations: [
        (arr: number[]) => arr.map((x) => x * 2),
        (arr: number[]) => arr.reduce((a, b) => a + b, 0),
        (sum: number) => Math.sqrt(sum),
      ],
      expected: Math.sqrt(12),
    },
    {
      name: "object transformation",
      initialValue: { a: 1, b: 2, c: { d: 3 } },
      operations: [
        (obj: any) => ({ ...obj, a: obj.a * 2 }),
        (obj: any) => obj.c.d,
        (d: number) => d.toString(),
      ],
      expected: "3",
    },
  ],

  /** Performance testing chains */
  performance: [
    {
      name: "long arithmetic chain",
      chainLength: 100,
      operation: (x: number, i: number) => x + i + 1,
      initialValue: 0,
    },
    {
      name: "string building chain",
      chainLength: 50,
      operation: (x: string, i: number) => x + i.toString(),
      initialValue: "",
    },
  ],
} as const;

/**
 * FlatMap scenarios that test Result chaining
 */
export const FlatMapScenarios = {
  /** Successful flatMap chains */
  success: [
    {
      name: "numeric validation chain",
      initialValue: 42,
      operations: [
        (x: number) =>
          x >= 0 ? { ok: true, value: x } : { ok: false, error: "negative" },
        (x: number) =>
          x <= 100 ? { ok: true, value: x } : { ok: false, error: "too large" },
        (x: number) =>
          x % 2 === 0 ? { ok: true, value: x } : { ok: false, error: "odd" },
      ],
      expected: 42,
    },
    {
      name: "string processing chain",
      initialValue: "hello world",
      operations: [
        (x: string) =>
          x.length > 0 ? { ok: true, value: x } : { ok: false, error: "empty" },
        (x: string) =>
          x.includes("world")
            ? { ok: true, value: x }
            : { ok: false, error: "missing world" },
        (x: string) => ({ ok: true, value: x.toUpperCase() }),
      ],
      expected: "HELLO WORLD",
    },
  ],

  /** Chains that fail at various stages */
  failures: [
    {
      name: "first validator fails",
      initialValue: -5,
      operations: [
        (x: number) =>
          x >= 0 ? { ok: true, value: x } : { ok: false, error: "negative" },
        (x: number) =>
          x <= 100 ? { ok: true, value: x } : { ok: false, error: "too large" },
      ],
      expectedError: "negative",
    },
    {
      name: "middle validator fails",
      initialValue: 150,
      operations: [
        (x: number) =>
          x >= 0 ? { ok: true, value: x } : { ok: false, error: "negative" },
        (x: number) =>
          x <= 100 ? { ok: true, value: x } : { ok: false, error: "too large" },
        (x: number) =>
          x % 2 === 0 ? { ok: true, value: x } : { ok: false, error: "odd" },
      ],
      expectedError: "too large",
    },
    {
      name: "last validator fails",
      initialValue: 7,
      operations: [
        (x: number) =>
          x >= 0 ? { ok: true, value: x } : { ok: false, error: "negative" },
        (x: number) =>
          x <= 100 ? { ok: true, value: x } : { ok: false, error: "too large" },
        (x: number) =>
          x % 2 === 0 ? { ok: true, value: x } : { ok: false, error: "odd" },
      ],
      expectedError: "odd",
    },
  ],
} as const;

/**
 * Zip and flatZip scenarios
 */
export const ZipScenarios = {
  /** Simple zip operations */
  zip: [
    {
      name: "number with double",
      initialValue: 5,
      zipFunction: (x: number) => x * 2,
      expected: [5, 10],
    },
    {
      name: "string with length",
      initialValue: "hello",
      zipFunction: (x: string) => x.length,
      expected: ["hello", 5],
    },
    {
      name: "object with property count",
      initialValue: { a: 1, b: 2, c: 3 },
      zipFunction: (obj: any) => Object.keys(obj).length,
      expected: [{ a: 1, b: 2, c: 3 }, 3],
    },
  ],

  /** flatZip with Results */
  flatZip: [
    {
      name: "successful zip chain",
      initialValue: 10,
      zipFunction: (x: number) =>
        x % 2 === 0 ? { ok: true, value: x / 2 } : { ok: false, error: "odd" },
      expected: [10, 5],
    },
    {
      name: "failing zip chain",
      initialValue: 7,
      zipFunction: (x: number) =>
        x % 2 === 0 ? { ok: true, value: x / 2 } : { ok: false, error: "odd" },
      expectedError: "odd",
    },
  ],
} as const;

/**
 * Async operation scenarios
 */
export const AsyncScenarios = {
  /** Simple async operations */
  basic: [
    {
      name: "delayed double",
      initialValue: 5,
      delayMs: 50,
      operation: async (x: number) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return x * 2;
      },
      expected: 10,
    },
    {
      name: "delayed validation",
      initialValue: "test",
      delayMs: 25,
      operation: async (x: string) => {
        await new Promise((resolve) => setTimeout(resolve, 25));
        return x.length > 0
          ? { ok: true, value: x.length }
          : { ok: false, error: "empty" };
      },
      expected: 4,
    },
  ],

  /** Complex async chains */
  chains: [
    {
      name: "async arithmetic chain",
      initialValue: 1,
      steps: [
        { delayMs: 10, operation: (x: number) => x * 2 },
        { delayMs: 20, operation: (x: number) => x + 3 },
        { delayMs: 15, operation: (x: number) => x * 4 },
      ],
      expected: 28,
    },
    {
      name: "mixed sync-async chain",
      initialValue: "hello",
      steps: [
        { operation: (x: string) => x.toUpperCase() }, // sync
        { delayMs: 30, operation: (x: string) => x + " WORLD" }, // async
        { operation: (x: string) => x.length }, // sync
      ],
      expected: 11,
    },
  ],

  /** Concurrent async operations */
  concurrent: [
    {
      name: "parallel transformations",
      initialValue: 5,
      operations: [
        async (x: number) => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          return x * 2;
        },
        async (x: number) => {
          await new Promise((resolve) => setTimeout(resolve, 30));
          return x + 3;
        },
        async (x: number) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return x.toString();
        },
      ],
    },
  ],
} as const;

/**
 * Error propagation scenarios
 */
export const ErrorScenarios = {
  /** Simple error propagation */
  basic: [
    {
      name: "map preserves error",
      initialValue: "error",
      errorValue: "initial error",
      mapFunction: (x: string) => x.length,
      expectedError: "initial error",
    },
    {
      name: "flatMap preserves error",
      initialValue: "error",
      errorValue: "initial error",
      flatMapFunction: (x: string) => ({ ok: true, value: x.length }),
      expectedError: "initial error",
    },
  ],

  /** Error transformation */
  transformation: [
    {
      name: "mapErr transformation",
      initialValue: "error",
      errorValue: "network error",
      mapErrFunction: (err: string) => `Error: ${err}`,
      expectedError: "Error: network error",
    },
    {
      name: "mapBoth error transformation",
      initialValue: "error",
      errorValue: "timeout",
      mapBothFunctions: {
        okFn: (x: string) => `Success: ${x}`,
        errFn: (err: string) => `Failure: ${err}`,
      },
      expectedError: "Failure: timeout",
    },
  ],

  /** Complex error scenarios */
  complex: [
    {
      name: "nested error propagation",
      initialValue: { nested: { value: null } },
      errorValue: "null error",
      operations: [
        (obj: any) => obj.nested.value,
        (value: any) => value.toString(),
      ],
      expectedError: "null error",
    },
  ],
} as const;

/**
 * Performance and scalability scenarios
 */
export const PerformanceScenarios = {
  /** Large dataset operations */
  largeData: [
    {
      name: "large array transformation",
      arraySize: 10000,
      operation: (arr: number[]) => arr.map((x) => x * 2),
    },
    {
      name: "large array filtering",
      arraySize: 50000,
      operation: (arr: number[]) => arr.filter((x) => x % 2 === 0),
    },
    {
      name: "large array reduction",
      arraySize: 100000,
      operation: (arr: number[]) => arr.reduce((a, b) => a + b, 0),
    },
  ],

  /** Deep nesting scenarios */
  deepNesting: [
    {
      name: "deep object nesting",
      depth: 100,
      operation: (depth: number) => {
        let obj = {} as any;
        for (let i = 0; i < depth; i++) {
          obj = { nested: obj };
        }
        return obj;
      },
    },
    {
      name: "deep array nesting",
      depth: 50,
      operation: (depth: number) => {
        let arr: any = [];
        for (let i = 0; i < depth; i++) {
          arr = [arr];
        }
        return arr;
      },
    },
  ],

  /** Memory stress scenarios */
  memoryStress: [
    {
      name: "large string operations",
      stringLength: 1000000,
      operation: (length: number) => "a".repeat(length),
    },
    {
      name: "many small Results",
      count: 100000,
      operation: (count: number) =>
        Array.from({ length: count }, (_, i) => ({ ok: true, value: i })),
    },
  ],
} as const;
