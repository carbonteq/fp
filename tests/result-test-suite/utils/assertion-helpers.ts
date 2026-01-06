/**
 * Custom Assertion Helpers
 *
 * Provides custom matchers and assertion utilities
 * specifically designed for Result testing.
 */

import { expect } from "bun:test";
import type {
  AsyncResult,
  BetterResult,
  SyncResult,
} from "@/internal/result.experimental";

/**
 * Custom matchers for Result instances
 */
export const ResultMatchers = {
  /**
   * Asserts that a Result is an Ok value with expected data
   */
  toBeOk: <T, E>(
    result: SyncResult<T, E> | BetterResult<T, E>,
    expectedValue?: T,
  ) => {
    expect(result.isOk()).toBe(true);
    expect(result.isErr()).toBe(false);

    if (expectedValue !== undefined) {
      expect(result.unwrap()).toEqual(expectedValue);
    }
  },

  /**
   * Asserts that a Result is an Err value with expected error
   */
  toBeErr: <T, E>(
    result: SyncResult<T, E> | BetterResult<T, E>,
    expectedError?: E,
  ) => {
    expect(result.isOk()).toBe(false);
    expect(result.isErr()).toBe(true);

    if (expectedError !== undefined) {
      expect(result.unwrapErr()).toEqual(expectedError);
    }
  },

  /**
   * Asserts async Result state
   */
  async toBeAsyncOk<T, E>(
    result: AsyncResult<T, E> | BetterResult<T, E>,
    expectedValue?: T,
  ) {
    const isOk = await result.isOk();
    const isErr = await result.isErr();

    expect(isOk).toBe(true);
    expect(isErr).toBe(false);

    if (expectedValue !== undefined) {
      const value = await result.unwrap();
      expect(value).toEqual(expectedValue);
    }
  },

  /**
   * Asserts async Result error state
   */
  async toBeAsyncErr<T, E>(
    result: AsyncResult<T, E> | BetterResult<T, E>,
    expectedError?: E,
  ) {
    const isOk = await result.isOk();
    const isErr = await result.isErr();

    expect(isOk).toBe(false);
    expect(isErr).toBe(true);

    if (expectedError !== undefined) {
      const error = await result.unwrapErr();
      expect(error).toEqual(expectedError);
    }
  },

  /**
   * Asserts Result type preservation through transformations
   */
  toPreserveType: <T, E, U>(
    original: SyncResult<T, E>,
    transformed: SyncResult<U, E>,
  ) => {
    // If original was Ok, transformed should be Ok
    if (original.isOk()) {
      expect(transformed.isOk()).toBe(true);
    } else {
      expect(transformed.isErr()).toBe(true);
      expect(transformed.unwrapErr()).toEqual(original.unwrapErr());
    }
  },

  /**
   * Asserts async type preservation
   */
  toPreserveAsyncType: async <T, E, U>(
    original: AsyncResult<T, E>,
    transformed: AsyncResult<U, E>,
  ) => {
    const originalIsOk = await original.isOk();
    const transformedIsOk = await transformed.isOk();

    expect(originalIsOk).toBe(transformedIsOk);

    if (!originalIsOk) {
      const originalError = await original.unwrapErr();
      const transformedError = await transformed.unwrapErr();
      expect(transformedError).toEqual(originalError);
    }
  },

  /**
   * Asserts BetterResult hybrid behavior
   */
  toBeHybrid: <T, E>(result: BetterResult<T, E>) => {
    // Should have both sync and async capabilities
    expect(typeof result.isOk).toBe("function");
    expect(typeof result.isAsync).toBe("function");
    expect(typeof result.toPromise).toBe("function");
  },

  /**
   * Asserts BetterResult state detection
   */
  toHaveAsyncState: <T, E>(result: BetterResult<T, E>, isAsync: boolean) => {
    expect(result.isAsync()).toBe(isAsync);
  },

  /**
   * Asserts conditional return types for BetterResult
   */
  toHaveConditionalReturns: <T, E>(result: BetterResult<T, E>) => {
    const isOkResult = result.isOk();
    const isAsyncResult = result.isAsync();

    if (isAsyncResult) {
      expect(isOkResult).toBeInstanceOf(Promise);
    } else {
      expect(typeof isOkResult).toBe("boolean");
    }
  },
};

/**
 * Assertion helpers for complex scenarios
 */
export const ComplexAssertions = {
  /**
   * Asserts that a chain of operations preserves state correctly
   */
  assertChainState: <T, E>(
    results: Array<SyncResult<any, E>>,
    shouldBeOk: boolean,
  ) => {
    results.forEach((result, index) => {
      if (shouldBeOk) {
        ResultMatchers.toBeOk(result);
      } else {
        ResultMatchers.toBeErr(result);
      }
    });
  },

  /**
   * Asserts that all Results in an array have the same state
   */
  assertUniformState: <T, E>(
    results: Array<SyncResult<T, E>>,
    expectedOk: boolean,
  ) => {
    const allOk = results.every((r) => r.isOk());
    const allErr = results.every((r) => r.isErr());

    expect(allOk || allErr).toBe(true);
    expect(allOk).toBe(expectedOk);
  },

  /**
   * Asserts error propagation through transformations
   */
  assertErrorPropagation: <T, E>(
    original: SyncResult<T, E>,
    transformed: SyncResult<any, E>,
  ) => {
    if (original.isErr()) {
      expect(transformed.isErr()).toBe(true);
      expect(transformed.unwrapErr()).toEqual(original.unwrapErr());
    }
  },

  /**
   * Asserts tuple structure for zip operations
   */
  assertZipStructure: <T, U, E>(
    result: SyncResult<[T, U], E>,
    expectedFirst?: T,
    expectedSecond?: U,
  ) => {
    ResultMatchers.toBeOk(result);
    const value = result.unwrap();
    expect(Array.isArray(value)).toBe(true);
    expect(value).toHaveLength(2);

    if (expectedFirst !== undefined) {
      expect(value[0]).toEqual(expectedFirst);
    }
    if (expectedSecond !== undefined) {
      expect(value[1]).toEqual(expectedSecond);
    }
  },

  /**
   * Asserts async execution order
   */
  assertExecutionOrder: (actualOrder: string[], expectedOrder: string[]) => {
    expect(actualOrder).toEqual(expectedOrder);
  },

  /**
   * Asserts timing constraints for async operations
   */
  assertTimingConstraints: (
    actualDuration: number,
    minExpected: number,
    maxExpected?: number,
  ) => {
    expect(actualDuration).toBeGreaterThanOrEqual(minExpected);
    if (maxExpected !== undefined) {
      expect(actualDuration).toBeLessThanOrEqual(maxExpected);
    }
  },
};

/**
 * Utility functions for test assertions
 */
export const AssertionUtils = {
  /**
   * Creates a safe wrapper that captures thrown errors
   */
  safeUnwrap: <T>(result: { unwrap(): T }): T | Error => {
    try {
      return result.unwrap();
    } catch (error) {
      return error as Error;
    }
  },

  /**
   * Creates a safe async unwrap wrapper
   */
  safeAsyncUnwrap: async <T>(result: {
    unwrap(): Promise<T>;
  }): Promise<T | Error> => {
    try {
      return await result.unwrap();
    } catch (error) {
      return error as Error;
    }
  },

  /**
   * Checks if a value is a Result instance
   */
  isResult: (value: any): value is SyncResult<any, any> => {
    return (
      value &&
      typeof value.isOk === "function" &&
      typeof value.isErr === "function"
    );
  },

  /**
   * Checks if a value is an AsyncResult instance
   */
  isAsyncResult: (value: any): value is AsyncResult<any, any> => {
    return (
      value && typeof value.inner === "object" && value.inner instanceof Promise
    );
  },

  /**
   * Checks if a value is a BetterResult instance
   */
  isBetterResult: (value: any): value is BetterResult<any, any> => {
    return (
      value &&
      typeof result.isAsync === "function" &&
      typeof result.toPromise === "function"
    );
  },

  /**
   * Extracts value or error safely from any Result type
   */
  extractResult: <T, E>(
    result: SyncResult<T, E> | AsyncResult<T, E> | BetterResult<T, E>,
  ) => {
    if (AssertionUtils.isAsyncResult(result)) {
      return { type: "async", result };
    } else if (AssertionUtils.isBetterResult(result)) {
      return { type: "better", result };
    } else {
      return { type: "sync", result };
    }
  },
};

// Extend Bun's expect with custom matchers
expect.extend({
  toBeOk(received, expectedValue) {
    try {
      ResultMatchers.toBeOk(received, expectedValue);
      return {
        message: () => `expected ${received} not to be Ok`,
        pass: true,
      };
    } catch (error) {
      return {
        message: () => `${error}`,
        pass: false,
      };
    }
  },

  toBeErr(received, expectedError) {
    try {
      ResultMatchers.toBeErr(received, expectedError);
      return {
        message: () => `expected ${received} not to be Err`,
        pass: true,
      };
    } catch (error) {
      return {
        message: () => `${error}`,
        pass: false,
      };
    }
  },
});
