/**
 * Test Data Builders
 *
 * Provides builders for creating test data and Result instances
 * with consistent patterns for the test suite.
 */

import {
  AsyncResult,
  BetterResult,
  SyncResult,
} from "@/internal/result.experimental";

/**
 * Standard test scenarios for Result operations
 */
export const TestData = {
  /** Numeric values for testing */
  numbers: {
    positive: [1, 42, 100, 999],
    negative: [-1, -42, -100, -999],
    zero: 0,
    large: Number.MAX_SAFE_INTEGER,
    small: Number.MIN_SAFE_INTEGER,
  },

  /** String values for testing */
  strings: {
    simple: ["hello", "world", "test", "data"],
    complex: ["hello world!", "123", "special@#$%"],
    empty: "",
    whitespace: ["  ", "\t", "\n"],
  },

  /** Error values for testing */
  errors: {
    simple: ["error", "failure", "invalid"],
    complex: ["Network timeout occurred", "Validation failed: field required"],
    objects: [new Error("test error"), { code: 500, message: "server error" }],
  },
} as const;

/**
 * Builder for creating SyncResult instances with test data
 */
export class SyncResultBuilder<T = number, E = string> {
  constructor(
    private defaultValue: T = 42 as T,
    private defaultError: E = "error" as E,
  ) {}

  /** Create an Ok result with default value */
  ok(): SyncResult<T, E> {
    return SyncResult.Ok(this.defaultValue);
  }

  /** Create an Ok result with custom value */
  okWith<U>(value: U): SyncResult<U, E> {
    return SyncResult.Ok<U, E>(value);
  }

  /** Create an Err result with default error */
  err(): SyncResult<T, E> {
    return SyncResult.Err(this.defaultError);
  }

  /** Create an Err result with custom error */
  errWith<F>(error: F): SyncResult<T, F> {
    return SyncResult.Err<T, F>(error);
  }

  /** Create with custom default values */
  withDefaults<U, F>(
    defaultValue: U,
    defaultError: F,
  ): SyncResultBuilder<U, F> {
    return new SyncResultBuilder<U, F>(defaultValue, defaultError);
  }
}

/**
 * Builder for creating AsyncResult instances with test data
 */
export class AsyncResultBuilder<T = number, E = string> {
  constructor(
    private defaultValue: T = 42 as T,
    private defaultError: E = "error" as E,
  ) {}

  /** Create an Ok result with default value */
  ok(): AsyncResult<T, E> {
    return AsyncResult.Ok(this.defaultValue);
  }

  /** Create an Ok result with custom value */
  okWith<U>(value: U): AsyncResult<U, E> {
    return AsyncResult.Ok<U, E>(value);
  }

  /** Create an Err result with default error */
  err(): AsyncResult<T, E> {
    return AsyncResult.Err(this.defaultError);
  }

  /** Create an Err result with custom error */
  errWith<F>(error: F): AsyncResult<T, F> {
    return AsyncResult.Err<T, F>(error);
  }

  /** Create from resolved promise */
  fromResolved<U>(value: U): AsyncResult<U, E> {
    return new AsyncResult<U, E>(Promise.resolve(SyncResult.Ok<U, E>(value)));
  }

  /** Create from rejected promise */
  fromRejected<F>(error: F): AsyncResult<T, F> {
    return new AsyncResult<T, F>(Promise.resolve(SyncResult.Err<T, F>(error)));
  }

  /** Create with custom default values */
  withDefaults<U, F>(
    defaultValue: U,
    defaultError: F,
  ): AsyncResultBuilder<U, F> {
    return new AsyncResultBuilder<U, F>(defaultValue, defaultError);
  }
}

/**
 * Builder for creating BetterResult instances with test data
 */
export class BetterResultBuilder<T = number, E = string> {
  constructor(
    private defaultValue: T = 42 as T,
    private defaultError: E = "error" as E,
  ) {}

  /** Create a sync Ok result with default value */
  ok(): BetterResult<T, E> {
    return BetterResult.Ok(this.defaultValue);
  }

  /** Create a sync Ok result with custom value */
  okWith<U>(value: U): BetterResult<U, E> {
    return BetterResult.Ok<U, E>(value);
  }

  /** Create a sync Err result with default error */
  err(): BetterResult<T, E> {
    return BetterResult.Err(this.defaultError);
  }

  /** Create a sync Err result with custom error */
  errWith<F>(error: F): BetterResult<T, F> {
    return BetterResult.Err<T, F>(error);
  }

  /** Create from resolved promise (async) */
  fromResolved<U>(value: U): BetterResult<U, E> {
    return BetterResult.fromPromise(Promise.resolve(value));
  }

  /** Create from rejected promise (async) */
  fromRejected<F>(error: F): BetterResult<T, F> {
    return BetterResult.fromPromise(Promise.reject(error));
  }

  /** Create with custom default values */
  withDefaults<U, F>(
    defaultValue: U,
    defaultError: F,
  ): BetterResultBuilder<U, F> {
    return new BetterResultBuilder<U, F>(defaultValue, defaultError);
  }
}

/**
 * Default builder instances for common use cases
 */
export const syncBuilder = new SyncResultBuilder();
export const asyncBuilder = new AsyncResultBuilder();
export const betterBuilder = new BetterResultBuilder();

/**
 * Pre-built test result sets
 */
export const TestResults = {
  sync: {
    okNumbers: TestData.numbers.positive.map((n) => syncBuilder.okWith(n)),
    okStrings: TestData.strings.simple.map((s) => syncBuilder.okWith(s)),
    errors: TestData.errors.simple.map((e) => syncBuilder.errWith(e)),
  },

  async: {
    okNumbers: TestData.numbers.positive.map((n) => asyncBuilder.okWith(n)),
    okStrings: TestData.strings.simple.map((s) => asyncBuilder.okWith(s)),
    errors: TestData.errors.simple.map((e) => asyncBuilder.errWith(e)),
  },

  better: {
    okSync: TestData.numbers.positive.map((n) => betterBuilder.okWith(n)),
    okAsync: TestData.numbers.positive.map((n) =>
      betterBuilder.fromResolved(n),
    ),
    errSync: TestData.errors.simple.map((e) => betterBuilder.errWith(e)),
    errAsync: TestData.errors.simple.map((e) => betterBuilder.fromRejected(e)),
  },
} as const;
