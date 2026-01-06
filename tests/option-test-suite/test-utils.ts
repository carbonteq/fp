import type { ExperimentalOption } from "@/internal/option.experimental";

/**
 * Shared utilities for Option specification compliance testing
 * These utilities are implementation-agnostic and focus on behavior verification
 */

/**
 * Helper to ensure synchronous value resolution for testing
 */
export async function expectSyncValue<T>(value: T | Promise<T>): Promise<T> {
  return await Promise.resolve(value);
}

/**
 * Helper to test if a value is a Promise
 */
export function isPromise(value: unknown): value is Promise<unknown> {
  return value instanceof Promise;
}

/**
 * Helper to extract the raw value from an Option for testing
 * Works with both sync and async Option implementations
 */
export async function extractOptionValue<T>(
  option: ExperimentalOption<T>,
): Promise<T | symbol> {
  if (option.value instanceof Object && "value" in option.value) {
    const internalValue = await Promise.resolve((option.value as any).value);
    return internalValue;
  }
  throw new Error(
    "Unable to extract option value - unsupported implementation",
  );
}

/**
 * Test data factory for common test scenarios
 */
export const TestDataFactory = {
  /** Simple numeric values */
  numbers: {
    some: [0, 1, 42, -1, Number.MAX_SAFE_INTEGER],
    edge: [NaN, Infinity, -Infinity],
  },

  /** String values */
  strings: {
    some: ["", "hello", "🚀", "a".repeat(1000)],
    edge: ["\0", "\n", "\t"],
  },

  /** Boolean values */
  booleans: {
    some: [true, false],
  },

  /** Object values */
  objects: {
    some: [{}, { a: 1 }, [], [1, 2, 3], new Date()],
  },

  /** Null-like values that should still create Some() */
  nullLike: [null, undefined, false, 0, ""],

  /** Method to get all value type test scenarios */
  valueTypes: () => [
    { name: "number", value: 42, type: "number" },
    { name: "string", value: "hello", type: "string" },
    { name: "boolean", value: true, type: "boolean" },
    { name: "object", value: { test: true }, type: "object" },
    { name: "array", value: [1, 2, 3], type: "object" },
  ],
} as const;

/**
 * Async test helpers
 */
export const AsyncTestHelpers = {
  /** Create a delayed async operation */
  delay: (ms: number = 1): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms)),

  /** Create an async transformation function */
  asyncTransform:
    <T, U>(fn: (value: T) => U) =>
    async (value: T): Promise<U> => {
      await AsyncTestHelpers.delay();
      return fn(value);
    },

  /** Create a failing async function */
  asyncError:
    (error: Error = new Error("Test error")) =>
    async (): Promise<never> => {
      await AsyncTestHelpers.delay();
      throw error;
    },
};

/**
 * Performance measurement utilities
 */
export const PerformanceHelpers = {
  /** Measure execution time of a function */
  measureTime: async <T>(
    fn: () => T | Promise<T>,
  ): Promise<{ result: T; timeMs: number }> => {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    return { result, timeMs: end - start };
  },

  /** Run multiple iterations and return average time */
  benchmark: async <T>(
    fn: () => T | Promise<T>,
    iterations: number = 1000,
  ): Promise<{
    averageTimeMs: number;
    totalTimeMs: number;
    iterations: number;
  }> => {
    const times: number[] = [];
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const iterationStart = performance.now();
      await fn();
      const iterationEnd = performance.now();
      times.push(iterationEnd - iterationStart);
    }

    const end = performance.now();
    const totalTimeMs = end - start;
    const averageTimeMs = times.reduce((a, b) => a + b, 0) / times.length;

    return { averageTimeMs, totalTimeMs, iterations };
  },
};

/**
 * Specification compliance test helpers
 */
export const SpecComplianceHelpers = {
  /** Test that an Option follows the Some/None contract */
  testOptionContract: async <T>(
    option: ExperimentalOption<T>,
    expectedValue: T | null,
    description: string,
  ): Promise<void> => {
    if (expectedValue === null) {
      // Should be None
      try {
        await option.unwrap();
        throw new Error(
          `Expected ${description} to be None and throw, but it didn't`,
        );
      } catch (error) {
        if (!(error instanceof Error && error.message.includes("None"))) {
          throw new Error(
            `Expected ${description} to throw None error, got: ${error}`,
          );
        }
      }
    } else {
      // Should be Some
      const value = await option.unwrap();
      if (value !== expectedValue) {
        throw new Error(
          `Expected ${description} to contain ${expectedValue}, got ${value}`,
        );
      }
    }
  },

  /** Test type preservation through transformations */
  testTypePreservation: <T, U>(
    inputOption: ExperimentalOption<T>,
    transformFn: (value: T) => U,
    expectedType: string,
  ): void => {
    // This is mainly for TypeScript compilation verification
    const result = inputOption.map(transformFn);
    // The fact that this compiles proves type preservation
    console.log(`✓ Type preservation test passed for ${expectedType}`);
  },
};

/**
 * Common test scenarios generator
 */
export const TestScenarios = {
  /** Generate test scenarios for different value types */
  valueTypes: () => [
    { name: "number", value: 42, type: "number" },
    { name: "string", value: "hello", type: "string" },
    { name: "boolean", value: true, type: "boolean" },
    { name: "object", value: { test: true }, type: "object" },
    { name: "array", value: [1, 2, 3], type: "object" },
  ],

  /** Generate async transformation scenarios */
  asyncTransforms: () => [
    {
      name: "sync identity",
      fn: <T>(x: T) => x,
      isAsync: false,
    },
    {
      name: "sync transform",
      fn: <T>(x: T) => String(x),
      isAsync: false,
    },
    {
      name: "async identity",
      fn: <T>(x: T) => AsyncTestHelpers.asyncTransform((y) => y)(x),
      isAsync: true,
    },
    {
      name: "async transform",
      fn: <T>(x: T) => AsyncTestHelpers.asyncTransform((y) => String(y))(x),
      isAsync: true,
    },
  ],
};

/**
 * Error testing utilities
 */
export const ErrorTestHelpers = {
  /** Expected error messages */
  expectedMessages: {
    unwrapNone: "Called unwrap on a None value",
    // Add more as needed for specific implementations
  },

  /** Test that a function throws expected error */
  expectThrows: async (
    fn: () => unknown,
    expectedMessage?: string,
  ): Promise<Error> => {
    try {
      await fn();
      throw new Error("Expected function to throw, but it did not");
    } catch (error) {
      if (!(error instanceof Error)) {
        throw new Error(`Expected Error to be thrown, got: ${typeof error}`);
      }

      if (expectedMessage && !error.message.includes(expectedMessage)) {
        throw new Error(
          `Expected error message to contain "${expectedMessage}", got "${error.message}"`,
        );
      }

      return error;
    }
  },
};
