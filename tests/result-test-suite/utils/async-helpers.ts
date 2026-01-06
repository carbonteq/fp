/**
 * Async Testing Utilities
 *
 * Provides utilities for testing asynchronous Result operations
 * with controlled timing and behavior patterns.
 */

/**
 * Creates a delayed promise for testing async timing
 */
export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Creates a controlled async mapper for testing
 */
export const createAsyncMapper = <T, U>(
  transform: (value: T) => U,
  delayMs: number = 10,
) => {
  return async (value: T): Promise<U> => {
    await delay(delayMs);
    return transform(value);
  };
};

/**
 * Creates a controlled async flat mapper that returns Results
 */
export const createAsyncFlatMapper = <T, U, E>(
  transform: (value: T) => U,
  shouldError: boolean = false,
  errorValue: E = "async error" as E,
  delayMs: number = 10,
) => {
  return async (value: T): Promise<U> => {
    await delay(delayMs);
    if (shouldError) {
      throw errorValue;
    }
    return transform(value);
  };
};

/**
 * Creates a sequence of operations that execute in order
 * for testing execution order and timing
 */
export const createExecutionTracker = () => {
  const executionOrder: string[] = [];

  return {
    track: (stepName: string) => {
      executionOrder.push(stepName);
      return executionOrder.length - 1; // Return index
    },
    getExecution: () => [...executionOrder],
    getIndices: (...stepNames: string[]) =>
      stepNames.map((name) => executionOrder.indexOf(name)),
    reset: () => {
      executionOrder.length = 0;
    },
    length: () => executionOrder.length,
  };
};

/**
 * Creates async mappers with execution tracking
 */
export const createTrackedAsyncMapper = <T, U>(
  tracker: ReturnType<typeof createExecutionTracker>,
  stepName: string,
  transform: (value: T) => U,
  delayMs: number = 10,
) => {
  return async (value: T): Promise<U> => {
    tracker.track(`${stepName}_start`);
    await delay(delayMs);
    const result = transform(value);
    tracker.track(`${stepName}_end`);
    return result;
  };
};

/**
 * Creates a sequence of async operations with controlled delays
 * for testing complex async chains
 */
export const createAsyncChain = <T>(
  operations: Array<{
    name: string;
    transform: (value: T) => T;
    delayMs?: number;
    shouldError?: boolean;
    errorValue?: any;
  }>,
) => {
  return async (initialValue: T): Promise<T> => {
    let currentValue = initialValue;

    for (const op of operations) {
      if (op.delayMs) {
        await delay(op.delayMs);
      }

      if (op.shouldError) {
        throw op.errorValue || new Error(`${op.name} failed`);
      }

      currentValue = op.transform(currentValue);
    }

    return currentValue;
  };
};

/**
 * Creates a promise that resolves or rejects based on condition
 */
export const createConditionalPromise = <T>(
  value: T,
  shouldResolve: boolean = true,
  delayMs: number = 10,
): Promise<T> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (shouldResolve) {
        resolve(value);
      } else {
        reject(value);
      }
    }, delayMs);
  });
};

/**
 * Utility to measure promise resolution time
 */
export const measurePromiseTime = async <T>(
  promise: Promise<T>,
): Promise<{ result: T; durationMs: number }> => {
  const startTime = performance.now();
  const result = await promise;
  const endTime = performance.now();

  return {
    result,
    durationMs: Math.round(endTime - startTime),
  };
};

/**
 * Creates a batch of promises that resolve in different orders
 * for testing race conditions and ordering
 */
export const createAsyncBatch = <T>(
  values: T[],
  delayPattern: number[] = [],
): Promise<T>[] => {
  return values.map((value, index) => {
    const delayMs = delayPattern[index] || (index + 1) * 10;
    return createConditionalPromise(value, true, delayMs);
  });
};

/**
 * Async operation that simulates network-like behavior
 * with potential timeouts and errors
 */
export const createNetworkLikeOperation = <T>(
  value: T,
  options: {
    successRate?: number; // 0-1
    minDelay?: number;
    maxDelay?: number;
    timeoutMs?: number;
  } = {},
) => {
  const {
    successRate = 0.9,
    minDelay = 50,
    maxDelay = 200,
    timeoutMs = 1000,
  } = options;

  return async (): Promise<T> => {
    const delay = Math.random() * (maxDelay - minDelay) + minDelay;
    const shouldSucceed = Math.random() < successRate;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Operation timeout"));
      }, timeoutMs);

      setTimeout(() => {
        clearTimeout(timeout);
        if (shouldSucceed) {
          resolve(value);
        } else {
          reject(new Error("Network operation failed"));
        }
      }, delay);
    });
  };
};
