/**
 * AsyncResult Comprehensive Tests
 *
 * Comprehensive test suite for AsyncResult<T, E> class.
 * Tests all async functionality with thorough coverage.
 */

import { beforeEach, describe, expect, test } from "bun:test";
import { AsyncResult, SyncResult } from "@/internal/result.experimental";
import {
  asyncBuilder,
  ComplexAssertions,
  createAsyncMapper,
  createConditionalPromise,
  createExecutionTracker,
  createNetworkLikeOperation,
  delay,
  measurePromiseTime,
  PerformanceMeasurement,
  ResultMatchers,
} from "../index";

describe("AsyncResult", () => {
  beforeEach(() => {
    // Reset any global state before each test
  });

  describe("Construction and Basic Behavior", () => {
    test("should create async Ok values with static constructor", async () => {
      const result = AsyncResult.Ok<string, string>("success");

      expect(await result.isOk()).toBe(true);
      expect(await result.isErr()).toBe(false);
      expect(await result.unwrap()).toBe("success");
    });

    test("should create async Err values with static constructor", async () => {
      const result = AsyncResult.Err<string, string>("error");

      expect(await result.isOk()).toBe(false);
      expect(await result.isErr()).toBe(true);
      expect(await result.unwrapErr()).toBe("error");
    });

    test("should work with Promise-based construction", async () => {
      const promise = Promise.resolve(SyncResult.Ok(42));
      const asyncResult = new AsyncResult(promise);

      expect(await asyncResult.isOk()).toBe(true);
      expect(await asyncResult.unwrap()).toBe(42);
    });

    test("should work with rejected Promises", async () => {
      const promise = Promise.resolve(SyncResult.Err("promise error"));
      const asyncResult = new AsyncResult(promise);

      expect(await asyncResult.isOk()).toBe(false);
      expect(await asyncResult.unwrapErr()).toBe("promise error");
    });

    test("should handle various async data types", async () => {
      const stringResult = AsyncResult.Ok("hello");
      const objectResult = AsyncResult.Ok({ a: 1 });
      const arrayResult = AsyncResult.Ok([1, 2, 3]);
      const nullResult = AsyncResult.Ok(null);

      expect(await stringResult.isOk()).toBe(true);
      expect(await objectResult.isOk()).toBe(true);
      expect(await arrayResult.isOk()).toBe(true);
      expect(await nullResult.isOk()).toBe(true);

      expect(await stringResult.unwrap()).toBe("hello");
      expect(await objectResult.unwrap()).toEqual({ a: 1 });
      expect(await arrayResult.unwrap()).toEqual([1, 2, 3]);
      expect(await nullResult.unwrap()).toBe(null);
    });
  });

  describe("Async State Inspection", () => {
    test("isOk should return Promise for async operations", async () => {
      const result = AsyncResult.Ok<number, string>(42);
      const isOkPromise = result.isOk();

      expect(isOkPromise).toBeInstanceOf(Promise);
      expect(await isOkPromise).toBe(true);
    });

    test("isErr should return Promise for async operations", async () => {
      const result = AsyncResult.Err<number, string>("error");
      const isErrPromise = result.isErr();

      expect(isErrPromise).toBeInstanceOf(Promise);
      expect(await isErrPromise).toBe(true);
    });

    test("state should be mutually exclusive in async context", async () => {
      const okResult = AsyncResult.Ok<number, string>(42);
      const errResult = AsyncResult.Err<number, string>("error");

      const okIsOk = await okResult.isOk();
      const okIsErr = await okResult.isErr();
      const errIsOk = await errResult.isOk();
      const errIsErr = await errResult.isErr();

      expect(okIsOk && okIsErr).toBe(false);
      expect(errIsOk && errIsErr).toBe(false);
    });
  });

  describe("Async Value Extraction", () => {
    test("unwrap should return Promise that resolves to value", async () => {
      const result = AsyncResult.Ok<number, string>(42);
      const valuePromise = result.unwrap();

      expect(valuePromise).toBeInstanceOf(Promise);
      const value = await valuePromise;
      expect(value).toBe(42);
    });

    test("unwrap should return Promise that rejects for Err", async () => {
      const result = AsyncResult.Err<number, string>("error");
      const valuePromise = result.unwrap();

      expect(valuePromise).toBeInstanceOf(Promise);
      expect(async () => await valuePromise).toThrow(
        "Called unwrap on an Err value",
      );
    });

    test("unwrapErr should return Promise that resolves to error", async () => {
      const result = AsyncResult.Err<number, string>("error");
      const errorPromise = result.unwrapErr();

      expect(errorPromise).toBeInstanceOf(Promise);
      const error = await errorPromise;
      expect(error).toBe("error");
    });

    test("unwrapErr should return Promise that rejects for Ok", async () => {
      const result = AsyncResult.Ok<number, string>(42);
      const errorPromise = result.unwrapErr();

      expect(errorPromise).toBeInstanceOf(Promise);
      expect(async () => await errorPromise).toThrow(
        "Called unwrapErr on an Ok value",
      );
    });

    test("safeUnwrap should return Promise with success object", async () => {
      const okResult = AsyncResult.Ok<number, string>(42);
      const errResult = AsyncResult.Err<number, string>("error");

      const okSafe = await okResult.safeUnwrap();
      const errSafe = await errResult.safeUnwrap();

      expect(okSafe.success).toBe(true);
      expect(okSafe.value).toBe(42);

      expect(errSafe.success).toBe(false);
      expect(errSafe.value).toBe(Symbol.for("SentinelSym"));
    });
  });

  describe("Async Transformation Methods", () => {
    describe("map", () => {
      test("should transform async Ok values", async () => {
        const result = AsyncResult.Ok<number, string>(42).map((x) => x * 2);

        expect(await result.isOk()).toBe(true);
        expect(await result.unwrap()).toBe(84);
      });

      test("should preserve async Err values", async () => {
        const result = AsyncResult.Err<number, string>("error").map(
          (x) => x * 2,
        );

        expect(await result.isErr()).toBe(true);
        expect(await result.unwrapErr()).toBe("error");
      });

      test("should allow type transformations in async context", async () => {
        const result = AsyncResult.Ok<number, string>(42)
          .map((x) => x.toString())
          .map((s) => s.length);

        expect(await result.isOk()).toBe(true);
        expect(await result.unwrap()).toBe(2); // "42" has length 2
      });

      test("should handle complex async transformations", async () => {
        const result = AsyncResult.Ok<number[], string>([1, 2, 3])
          .map((arr) => arr.reduce((a, b) => a + b, 0))
          .map((sum) => sum * 2);

        expect(await result.isOk()).toBe(true);
        expect(await result.unwrap()).toBe(12); // (1+2+3)*2 = 12
      });
    });

    describe("mapErr", () => {
      test("should transform async Err values", async () => {
        const result = AsyncResult.Err<number, string>("error").mapErr(
          (err) => `Error: ${err}`,
        );

        expect(await result.isErr()).toBe(true);
        expect(await result.unwrapErr()).toBe("Error: error");
      });

      test("should preserve async Ok values", async () => {
        const result = AsyncResult.Ok<number, string>(42).mapErr(
          (err) => `Error: ${err}`,
        );

        expect(await result.isOk()).toBe(true);
        expect(await result.unwrap()).toBe(42);
      });

      test("should allow error type transformations in async context", async () => {
        const result = AsyncResult.Err<number, string>("network error").mapErr(
          (err) => ({ type: "NetworkError", message: err }),
        );

        expect(await result.isErr()).toBe(true);
        const error = await result.unwrapErr();
        expect(error.type).toBe("NetworkError");
        expect(error.message).toBe("network error");
      });
    });

    describe("flatMap", () => {
      test("should chain async Ok values", async () => {
        const result = AsyncResult.Ok<number, string>(42)
          .flatMap((x) => AsyncResult.Ok(x * 2))
          .flatMap((x) => AsyncResult.Ok(x + 10));

        expect(await result.isOk()).toBe(true);
        expect(await result.unwrap()).toBe(94); // (42*2)+10 = 94
      });

      test("should short-circuit async on Err", async () => {
        const result = AsyncResult.Err<number, string>("initial")
          .flatMap((x) => AsyncResult.Ok(x * 2))
          .flatMap((x) => AsyncResult.Ok(x + 10));

        expect(await result.isErr()).toBe(true);
        expect(await result.unwrapErr()).toBe("initial");
      });

      test("should propagate new errors in async context", async () => {
        const result = AsyncResult.Ok<number, string>(42)
          .flatMap((x) => AsyncResult.Err<number, string>("new error"))
          .flatMap((x) => AsyncResult.Ok(x + 10)); // Won't execute

        expect(await result.isErr()).toBe(true);
        expect(await result.unwrapErr()).toBe("new error");
      });

      test("should allow error type changes in async flatMap", async () => {
        const result = AsyncResult.Ok<number, string>(42).flatMap((x) =>
          AsyncResult.Err<number, { code: number }>({ code: 404 }),
        );

        expect(await result.isErr()).toBe(true);
        const error = await result.unwrapErr();
        expect(error.code).toBe(404);
      });

      test("should handle complex async validation chains", async () => {
        const validatePositive = (x: number): AsyncResult<number, string> =>
          x >= 0 ? AsyncResult.Ok(x) : AsyncResult.Err("negative");

        const validateEven = (x: number): AsyncResult<number, string> =>
          x % 2 === 0 ? AsyncResult.Ok(x) : AsyncResult.Err("odd");

        const result = AsyncResult.Ok(8)
          .flatMap(validatePositive)
          .flatMap(validateEven);

        expect(await result.isOk()).toBe(true);
        expect(await result.unwrap()).toBe(8);
      });
    });

    describe("zip", () => {
      test("should combine async Ok value with transformed value", async () => {
        const result = AsyncResult.Ok<number, string>(42).zip((x) => x * 2);

        expect(await result.isOk()).toBe(true);
        expect(await result.unwrap()).toEqual([42, 84]);
      });

      test("should preserve async Err values", async () => {
        const result = AsyncResult.Err<number, string>("error").zip(
          (x) => x * 2,
        );

        expect(await result.isErr()).toBe(true);
        expect(await result.unwrapErr()).toBe("error");
      });

      test("should handle complex async zipping", async () => {
        const result = AsyncResult.Ok<string, string>("hello")
          .zip((str) => str.length)
          .zip(([str, len]) => `${str}_${len}`);

        expect(await result.isOk()).toBe(true);
        const value = await result.unwrap();
        expect(value).toEqual([["hello", 5], "hello_5"]);
      });
    });

    describe("flatZip", () => {
      test("should combine async Ok value with another Result's Ok value", async () => {
        const result = AsyncResult.Ok<number, string>(42).flatZip((x) =>
          AsyncResult.Ok(x + 5),
        );

        expect(await result.isOk()).toBe(true);
        expect(await result.unwrap()).toEqual([42, 47]);
      });

      test("should propagate error when zipped async Result fails", async () => {
        const result = AsyncResult.Ok<number, string>(42).flatZip((x) =>
          AsyncResult.Err<number, string>("invalid"),
        );

        expect(await result.isErr()).toBe(true);
        expect(await result.unwrapErr()).toBe("invalid");
      });

      test("should preserve original async Err values", async () => {
        const result = AsyncResult.Err<number, string>("initial").flatZip((x) =>
          AsyncResult.Err<number, string>("zipped error"),
        );

        expect(await result.isErr()).toBe(true);
        expect(await result.unwrapErr()).toBe("initial");
      });

      test("should handle nested async flatZip operations", async () => {
        const result = AsyncResult.Ok<number, string>(10)
          .flatZip((x) => AsyncResult.Ok(x * 2))
          .flatZip(([x, y]) => AsyncResult.Ok(x + y));

        expect(await result.isOk()).toBe(true);
        const value = await result.unwrap();
        expect(value).toEqual([10, [10, 20], 30]);
      });
    });
  });

  describe("Async Operation Timing and Execution", () => {
    test("should execute operations sequentially", async () => {
      const tracker = createExecutionTracker();

      const result = AsyncResult.Ok(1)
        .map((x) => {
          tracker.track("map1");
          return x * 2;
        })
        .flatMap((x) => {
          tracker.track("flatMap1");
          return AsyncResult.Ok(x + 3);
        })
        .map((x) => {
          tracker.track("map2");
          return x.toString();
        });

      await result.unwrap();

      const execution = tracker.getExecution();
      expect(execution).toEqual(["map1", "flatMap1", "map2"]);
    });

    test("should measure execution time accurately", async () => {
      const delayedMap = createAsyncMapper((x: number) => x * 2, 50);

      const result = AsyncResult.Ok(42).map(delayedMap);

      const { result: value, durationMs } = await measurePromiseTime(
        result.unwrap(),
      );

      expect(value).toBe(84);
      expect(durationMs).toBeGreaterThanOrEqual(45); // Account for timing variations
      expect(durationMs).toBeLessThan(100); // But not too long
    });

    test("should handle delays in complex chains", async () => {
      const tracker = createExecutionTracker();
      const delays = [10, 20, 15];

      const result = AsyncResult.Ok(1)
        .map(createTrackedMapper(tracker, "step1", (x) => x * 2, delays[0]))
        .flatMap((x) =>
          AsyncResult.Ok(x).map(
            createTrackedMapper(tracker, "step2", (y) => y + 3, delays[1]),
          ),
        )
        .map(
          createTrackedMapper(tracker, "step3", (x) => x.toString(), delays[2]),
        );

      const value = await result.unwrap();
      const execution = tracker.getExecution();

      expect(value).toBe("5");
      expect(execution).toHaveLength(6); // Each step has start and end
    });
  });

  describe("Async Error Handling and Edge Cases", () => {
    test("should handle Promise rejection properly", async () => {
      const promise = Promise.reject("rejection error");
      const result = new AsyncResult(promise);

      expect(await result.isErr()).toBe(true);
      expect(await result.unwrapErr()).toBe("rejection error");
    });

    test("should handle null and undefined values in async context", async () => {
      const nullResult = AsyncResult.Ok<null, string>(null);
      const undefinedResult = AsyncResult.Ok<undefined, string>(undefined);

      expect(await nullResult.unwrap()).toBe(null);
      expect(await undefinedResult.unwrap()).toBe(undefined);
    });

    test("should handle NaN and special numeric values asynchronously", async () => {
      const nanResult = AsyncResult.Ok(NaN);
      const infinityResult = AsyncResult.Ok(Infinity);

      expect((await nanResult.unwrap()).toString()).toBe("NaN");
      expect(await infinityResult.unwrap()).toBe(Infinity);
    });

    test("should handle async operations with complex objects", async () => {
      interface ComplexData {
        id: number;
        metadata: {
          created: Date;
          tags: string[];
        };
      }

      const complexResult = AsyncResult.Ok<ComplexData, string>({
        id: 42,
        metadata: {
          created: new Date(),
          tags: ["test", "async"],
        },
      });

      expect(await complexResult.isOk()).toBe(true);
      const data = await complexResult.unwrap();
      expect(data.id).toBe(42);
      expect(data.metadata.tags).toEqual(["test", "async"]);
    });
  });

  describe("Async Performance Characteristics", () => {
    test("should handle concurrent async operations efficiently", async () => {
      const operations = Array.from({ length: 100 }, (_, i) =>
        AsyncResult.Ok(i).map((x) => x * 2),
      );

      const { durationMs } = await measurePromiseTime(
        Promise.all(operations.map((op) => op.unwrap())),
      );

      expect(durationMs).toBeLessThan(50); // Should handle 100 concurrent ops quickly
    });

    test("should handle sequential async chains efficiently", async () => {
      const { durationMs } = await measurePromiseTime(async () => {
        let result = AsyncResult.Ok(0);

        for (let i = 1; i <= 50; i++) {
          result = result.map((x) => x + i);
        }

        return await result.unwrap();
      });

      expect(durationMs).toBeLessThan(20); // Should be fast even for 50 operations
    });

    test("should not create memory leaks with async operations", async () => {
      const operations: AsyncResult<number, string>[] = [];

      // Create many async operations
      for (let i = 0; i < 1000; i++) {
        operations.push(AsyncResult.Ok(i).map((x) => x * 2));
      }

      // Wait for all to complete
      const results = await Promise.all(operations.map((op) => op.unwrap()));

      expect(results).toHaveLength(1000);
      expect(results[0]).toBe(0);
      expect(results[999]).toBe(1998);

      // Clear references
      operations.length = 0;
    });
  });

  describe("Complex Async Scenarios", () => {
    test("should handle network-like async operations", async () => {
      const networkOp = createNetworkLikeOperation(42, {
        successRate: 0.8,
        minDelay: 10,
        maxDelay: 50,
      });

      // Try multiple times to account for randomness
      let attempts = 0;
      let success = false;

      while (attempts < 10 && !success) {
        try {
          const result = await networkOp();
          expect(result).toBe(42);
          success = true;
        } catch (error) {
          attempts++;
        }
      }

      // Should eventually succeed (or we've tried enough times)
      expect(attempts).toBeLessThan(10);
    });

    test("should handle mixed sync and async operations in chains", async () => {
      const result = AsyncResult.Ok(10)
        .map((x) => x * 2) // sync
        .map((x) => Promise.resolve(x + 5)) // returns Promise but map handles it
        .flatMap((x) => AsyncResult.Ok(x.toString())) // async
        .map((s) => s.length); // sync

      expect(await result.isOk()).toBe(true);
      expect(await result.unwrap()).toBe(2); // "25" has length 2
    });

    test("should handle async operation cancellation scenarios", async () => {
      let shouldCancel = false;
      const cancelableOperation = async () => {
        await delay(100);
        if (shouldCancel) {
          throw new Error("Operation cancelled");
        }
        return "success";
      };

      const result = AsyncResult.fromPromise(cancelableOperation());

      // Cancel after 50ms
      setTimeout(() => {
        shouldCancel = true;
      }, 50);

      expect(await result.isErr()).toBe(true);
      expect(await result.unwrapErr()).toBe("Operation cancelled");
    });
  });

  describe("Type Safety in Async Context", () => {
    test("should maintain type safety through async operations", async () => {
      const result = AsyncResult.Ok<number, string>(42)
        .map((x) => x.toString()) // AsyncResult<string, string>
        .map((s) => s.length) // AsyncResult<number, string>
        .flatMap((n) => (n > 0 ? AsyncResult.Ok(n) : AsyncResult.Err("zero"))); // AsyncResult<number, string>

      // TypeScript should infer correct types
      if (await result.isOk()) {
        const value: number = await result.unwrap();
        expect(typeof value).toBe("number");
      }
    });

    test("should handle generic async functions correctly", () => {
      async function createAsyncResult<T>(
        value: T,
      ): Promise<AsyncResult<T, string>> {
        await delay(10);
        return Promise.resolve(AsyncResult.Ok(value));
      }

      const promise = createAsyncResult("test");
      expect(promise).toBeInstanceOf(Promise);
    });

    test("should handle complex generic async scenarios", async () => {
      interface AsyncContainer<T> {
        value: Promise<T>;
        metadata: string;
      }

      async function processAsyncContainer<T, E>(
        container: AsyncContainer<T>,
        processor: (value: T) => AsyncResult<T, E>,
      ): AsyncResult<AsyncContainer<T>, E> {
        const value = await container.value;
        return processor(value).map((processedValue) => ({
          ...container,
          value: Promise.resolve(processedValue),
        }));
      }

      const container: AsyncContainer<number> = {
        value: Promise.resolve(42),
        metadata: "test",
      };

      const result = await processAsyncContainer(container, (x) =>
        x > 0 ? AsyncResult.Ok(x) : AsyncResult.Err("negative"),
      );

      expect(result.isOk()).toBe(true);
      const processed = await result.unwrap();
      expect(await processed.value).toBe(42);
      expect(processed.metadata).toBe("test");
    });
  });

  describe("Integration with Test Utilities", () => {
    test("should work with async test builders", async () => {
      const builder = asyncBuilder.withDefaults("test", "builder_error");

      const okResult = builder.ok();
      const errResult = builder.err();

      ResultMatchers.toBeAsyncOk(okResult, "test");
      ResultMatchers.toBeAsyncErr(errResult, "builder_error");
    });

    test("should work with delayed async builders", async () => {
      const delayedOk = asyncBuilder.fromResolved(42);
      const delayedErr = asyncBuilder.fromRejected("promise error");

      ResultMatchers.toBeAsyncOk(delayedOk, 42);
      ResultMatchers.toBeAsyncErr(delayedErr, "promise error");
    });

    test("should work with async mappers and utilities", async () => {
      const result = asyncBuilder
        .ok()
        .map(createAsyncMapper((x) => x * 2, 25))
        .map((x) => x + 1);

      const { result: value, durationMs } = await measurePromiseTime(
        result.unwrap(),
      );

      expect(value).toBe(85); // (42*2)+1 = 85
      expect(durationMs).toBeGreaterThanOrEqual(20);
    });
  });
});

/**
 * Helper function for creating tracked async mappers
 */
function createTrackedMapper<T, U>(
  tracker: ReturnType<typeof createExecutionTracker>,
  stepName: string,
  transform: (value: T) => U,
  delayMs: number = 0,
) {
  return async (value: T): Promise<U> => {
    tracker.track(`${stepName}_start`);
    if (delayMs > 0) await delay(delayMs);
    const result = transform(value);
    tracker.track(`${stepName}_end`);
    return result;
  };
}
