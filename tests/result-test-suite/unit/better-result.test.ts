/**
 * BetterResult Comprehensive Tests
 *
 * Comprehensive test suite for BetterResult<T, E> class.
 * This is the most complex class with hybrid sync/async behavior.
 */

import { beforeEach, describe, expect, test } from "bun:test";
import { BetterResult } from "@/internal/result.experimental";
import {
  betterBuilder,
  ComplexAssertions,
  createAsyncMapper,
  createConditionalPromise,
  createExecutionTracker,
  delay,
  PerformanceMeasurement,
  ResultMatchers,
} from "../index";

describe("BetterResult", () => {
  beforeEach(() => {
    // Reset any global state before each test
  });

  describe("Construction and State Detection", () => {
    test("should create sync Ok values using static Ok constructor", () => {
      const result = BetterResult.Ok<number, string>(42);

      expect(result.isAsync()).toBe(false);
      ResultMatchers.toBeOk(result, 42);
      ResultMatchers.toHaveConditionalReturns(result);
    });

    test("should create sync Err values using static Err constructor", () => {
      const result = BetterResult.Err<number, string>("error");

      expect(result.isAsync()).toBe(false);
      ResultMatchers.toBeErr(result, "error");
      ResultMatchers.toHaveConditionalReturns(result);
    });

    test("should create async BetterResult from resolved promise using fromPromise", async () => {
      const promise = Promise.resolve(100);
      const result = BetterResult.fromPromise<number, string>(promise);

      expect(result.isAsync()).toBe(true);
      ResultMatchers.toHaveAsyncState(result, true);
      ResultMatchers.toHaveConditionalReturns(result);

      const isOk = await result.isOk();
      expect(isOk).toBe(true);

      const value = await result.unwrap();
      expect(value).toBe(100);
    });

    test("should create async BetterResult from rejected promise using fromPromise", async () => {
      const promise = Promise.reject("promise error");
      const result = BetterResult.fromPromise<number, string>(promise);

      expect(result.isAsync()).toBe(true);
      ResultMatchers.toHaveAsyncState(result, true);

      const isOk = await result.isOk();
      expect(isOk).toBe(false);

      const error = await result.unwrapErr();
      expect(error).toBe("promise error");
    });

    test("should correctly identify sync vs async state", () => {
      const syncResult = BetterResult.Ok<number, string>(42);
      const asyncResult = BetterResult.fromPromise(Promise.resolve(42));

      expect(syncResult.isAsync()).toBe(false);
      expect(asyncResult.isAsync()).toBe(true);
    });
  });

  describe("Hybrid State Inspection", () => {
    test("sync isOk should return boolean immediately", () => {
      const result = BetterResult.Ok<number, string>(42);
      const isOk = result.isOk();

      expect(typeof isOk).toBe("boolean");
      expect(isOk).toBe(true);
    });

    test("sync isErr should return boolean immediately", () => {
      const result = BetterResult.Err<number, string>("error");
      const isErr = result.isErr();

      expect(typeof isErr).toBe("boolean");
      expect(isErr).toBe(true);
    });

    test("async isOk should return Promise for async BetterResult", async () => {
      const result = BetterResult.fromPromise(Promise.resolve(42));
      const isOk = result.isOk();

      expect(isOk).toBeInstanceOf(Promise);

      const resolvedIsOk = await isOk;
      expect(resolvedIsOk).toBe(true);
    });

    test("async isErr should return Promise for async BetterResult", async () => {
      const result = BetterResult.fromPromise(Promise.reject("error"));
      const isErr = result.isErr();

      expect(isErr).toBeInstanceOf(Promise);

      const resolvedIsErr = await isErr;
      expect(resolvedIsErr).toBe(true);
    });
  });

  describe("Hybrid Value Extraction", () => {
    describe("Sync BetterResult", () => {
      test("sync unwrap should return value immediately", () => {
        const result = BetterResult.Ok<number, string>(42);
        const value = result.unwrap();

        expect(value).toBe(42);
        expect(typeof value).toBe("number");
      });

      test("sync unwrap should throw for Err values", () => {
        const result = BetterResult.Err<number, string>("error");
        expect(() => result.unwrap()).toThrow("Called unwrap on an Err value");
      });

      test("sync unwrapErr should return error immediately", () => {
        const result = BetterResult.Err<number, string>("error");
        const error = result.unwrapErr();

        expect(error).toBe("error");
        expect(typeof error).toBe("string");
      });

      test("sync unwrapErr should throw for Ok values", () => {
        const result = BetterResult.Ok<number, string>(42);
        expect(() => result.unwrapErr()).toThrow(
          "Called unwrapErr on an Ok value",
        );
      });

      test("async safeUnwrap should return Promise even for sync BetterResult", async () => {
        const result = BetterResult.Ok<number, string>(42);
        const safeResult = await result.safeUnwrap();

        expect(safeResult.success).toBe(true);
        expect(safeResult.value).toBe(42);
      });
    });

    describe("Async BetterResult", () => {
      test("async unwrap should return Promise", async () => {
        const result = BetterResult.fromPromise(Promise.resolve(42));
        const valuePromise = result.unwrap();

        expect(valuePromise).toBeInstanceOf(Promise);
        const value = await valuePromise;
        expect(value).toBe(42);
      });

      test("async unwrap should throw for Err values", async () => {
        const result = BetterResult.fromPromise(Promise.reject("error"));
        expect(async () => await result.unwrap()).toThrow(
          "Called unwrap on an Err value",
        );
      });

      test("async unwrapErr should return Promise", async () => {
        const result = BetterResult.fromPromise(Promise.reject("error"));
        const errorPromise = result.unwrapErr();

        expect(errorPromise).toBeInstanceOf(Promise);
        const error = await errorPromise;
        expect(error).toBe("error");
      });

      test("async safeUnwrap should work correctly", async () => {
        const result = BetterResult.fromPromise(Promise.resolve(42));
        const safeResult = await result.safeUnwrap();

        expect(safeResult.success).toBe(true);
        expect(safeResult.value).toBe(42);
      });
    });
  });

  describe("State Conversion Operations", () => {
    test("toPromise should convert sync BetterResult to async", async () => {
      const syncResult = BetterResult.Ok<number, string>(42);
      const asyncResult = await syncResult.toPromise();

      expect(asyncResult.isAsync()).toBe(true);
      const isOk = await asyncResult.isOk();
      expect(isOk).toBe(true);
      const value = await asyncResult.unwrap();
      expect(value).toBe(42);
    });

    test("toPromise should preserve async state for async BetterResult", async () => {
      const originalAsyncResult = BetterResult.fromPromise(Promise.resolve(42));
      const convertedAsyncResult = await originalAsyncResult.toPromise();

      expect(convertedAsyncResult.isAsync()).toBe(true);
      const isOk = await convertedAsyncResult.isOk();
      expect(isOk).toBe(true);
      const value = await convertedAsyncResult.unwrap();
      expect(value).toBe(42);
    });

    test("clone should preserve sync/async nature", () => {
      const syncResult = BetterResult.Ok<number, string>(42);
      const asyncResult = BetterResult.fromPromise(Promise.resolve(42));

      const syncClone = syncResult.clone();
      const asyncClone = asyncResult.clone();

      expect(syncClone.isAsync()).toBe(false);
      expect(asyncClone.isAsync()).toBe(true);
    });
  });

  describe("Hybrid Transformations", () => {
    describe("map operations", () => {
      test("sync map should work with sync BetterResult", () => {
        const result = BetterResult.Ok<number, string>(42).map((x) => x * 2);

        expect(result.isAsync()).toBe(false);
        ResultMatchers.toBeOk(result, 84);
      });

      test("sync map should preserve error state", () => {
        const result = BetterResult.Err<number, string>("error").map(
          (x) => x * 2,
        );

        expect(result.isAsync()).toBe(false);
        ResultMatchers.toBeErr(result, "error");
      });

      test("sync map should transform types", () => {
        const result = BetterResult.Ok<number, string>(42).map((x) =>
          x.toString(),
        );

        expect(result.isAsync()).toBe(false);
        ResultMatchers.toBeOk(result, "42");
      });

      test("async map should work with async BetterResult", async () => {
        const result = BetterResult.fromPromise(Promise.resolve(42)).map(
          (x) => x * 2,
        );

        expect(result.isAsync()).toBe(true);
        const value = await result.unwrap();
        expect(value).toBe(84);
      });

      test("async map should preserve error state", async () => {
        const result = BetterResult.fromPromise(Promise.reject("error")).map(
          (x) => x * 2,
        );

        expect(result.isAsync()).toBe(true);
        const error = await result.unwrapErr();
        expect(error).toBe("error");
      });
    });

    describe("mapErr operations", () => {
      test("sync mapErr should transform errors in sync BetterResult", () => {
        const result = BetterResult.Err<number, string>("error").mapErr(
          (err) => `Error: ${err}`,
        );

        expect(result.isAsync()).toBe(false);
        ResultMatchers.toBeErr(result, "Error: error");
      });

      test("sync mapErr should preserve Ok state", () => {
        const result = BetterResult.Ok<number, string>(42).mapErr(
          (err) => `Error: ${err}`,
        );

        expect(result.isAsync()).toBe(false);
        ResultMatchers.toBeOk(result, 42);
      });

      test("async mapErr should work with async BetterResult", async () => {
        const result = BetterResult.fromPromise(Promise.reject("error")).mapErr(
          (err) => `Error: ${err}`,
        );

        expect(result.isAsync()).toBe(true);
        const error = await result.unwrapErr();
        expect(error).toBe("Error: error");
      });
    });

    describe("flatMap operations", () => {
      test("sync → sync flatMap should maintain sync state", () => {
        const result = BetterResult.Ok<number, string>(42).flatMap((x) =>
          BetterResult.Ok(x * 2),
        );

        expect(result.isAsync()).toBe(false);
        ResultMatchers.toBeOk(result, 84);
      });

      test("sync → async flatMap should convert to async state", () => {
        const result = BetterResult.Ok<number, string>(42).flatMap((x) =>
          BetterResult.fromPromise(Promise.resolve(x * 2)),
        );

        expect(result.isAsync()).toBe(true);
      });

      test("async → sync flatMap should maintain async state", async () => {
        const result = BetterResult.fromPromise(Promise.resolve(42)).flatMap(
          (x) => BetterResult.Ok(x * 2),
        );

        expect(result.isAsync()).toBe(true);
        const value = await result.unwrap();
        expect(value).toBe(84);
      });

      test("async → async flatMap should maintain async state", async () => {
        const result = BetterResult.fromPromise(Promise.resolve(42)).flatMap(
          (x) => BetterResult.fromPromise(Promise.resolve(x * 2)),
        );

        expect(result.isAsync()).toBe(true);
        const value = await result.unwrap();
        expect(value).toBe(84);
      });

      test("flatMap should short-circuit on Err values", () => {
        const result = BetterResult.Err<number, string>("initial").flatMap(
          (x) => BetterResult.Ok(x * 2),
        );

        expect(result.isAsync()).toBe(false);
        ResultMatchers.toBeErr(result, "initial");
      });
    });

    describe("zip operations", () => {
      test("sync zip should work with sync BetterResult", () => {
        const result = BetterResult.Ok<number, string>(42).zip((x) => x * 2);

        expect(result.isAsync()).toBe(false);
        const value = result.unwrap();
        expect(value).toEqual([42, 84]);
      });

      test("sync zip should preserve Err state", () => {
        const result = BetterResult.Err<number, string>("error").zip(
          (x) => x * 2,
        );

        expect(result.isAsync()).toBe(false);
        ResultMatchers.toBeErr(result, "error");
      });

      test("async zip should work with async BetterResult", async () => {
        const result = BetterResult.fromPromise(Promise.resolve(42)).zip(
          (x) => x * 2,
        );

        expect(result.isAsync()).toBe(true);
        const value = await result.unwrap();
        expect(value).toEqual([42, 84]);
      });
    });

    describe("flatZip operations", () => {
      test("sync → sync flatZip should work correctly", () => {
        const result = BetterResult.Ok<number, string>(42).flatZip((x) =>
          BetterResult.Ok(x + 5),
        );

        expect(result.isAsync()).toBe(false);
        const value = result.unwrap();
        expect(value).toEqual([42, 47]);
      });

      test("sync → async flatZip should convert to async", () => {
        const result = BetterResult.Ok<number, string>(42).flatZip((x) =>
          BetterResult.fromPromise(Promise.resolve(x + 5)),
        );

        expect(result.isAsync()).toBe(true);
      });

      test("flatZip should propagate errors correctly", () => {
        const result = BetterResult.Ok<number, string>(42).flatZip((x) =>
          BetterResult.Err<number, string>("zip error"),
        );

        expect(result.isAsync()).toBe(false);
        ResultMatchers.toBeErr(result, "zip error");
      });
    });
  });

  describe("Complex State Transitions", () => {
    test("should handle complex mixed sync/async chains", async () => {
      const tracker = createExecutionTracker();

      const result = BetterResult.Ok<number, string>(10)
        .map((x) => {
          tracker.track("map1");
          return x * 2;
        })
        .flatMap((x) => {
          tracker.track("flatMap1");
          return BetterResult.fromPromise(Promise.resolve(x + 5));
        })
        .map((x) => {
          tracker.track("map2");
          return x.toString();
        })
        .flatMap((x) => {
          tracker.track("flatMap2");
          return BetterResult.Ok(x.length);
        });

      expect(result.isAsync()).toBe(true);
      const value = await result.unwrap();
      expect(value).toBe(2); // "25" has length 2

      const execution = tracker.getExecution();
      expect(execution).toContain("map1");
      expect(execution).toContain("flatMap1");
      expect(execution).toContain("map2");
      expect(execution).toContain("flatMap2");
    });

    test("should preserve error state through complex transitions", async () => {
      const result = BetterResult.Err<number, string>("initial")
        .map((x) => x * 2) // Won't execute
        .flatMap((x) => BetterResult.fromPromise(Promise.resolve(x + 5))) // Won't execute
        .mapErr((err) => `Error: ${err}`); // Will execute

      expect(result.isAsync()).toBe(false);
      ResultMatchers.toBeErr(result, "Error: initial");
    });

    test("should handle sync → async → sync transitions correctly", async () => {
      const result = BetterResult.Ok<number, string>(10)
        .map((x) => x * 2) // sync
        .flatMap((x) => BetterResult.fromPromise(Promise.resolve(x + 5))) // converts to async
        .map((x) => x.toString()); // stays async

      expect(result.isAsync()).toBe(true);
      const value = await result.unwrap();
      expect(value).toBe("25");
    });
  });

  describe("Performance and Timing", () => {
    test("sync operations should be fast", async () => {
      const { duration } = await PerformanceMeasurement.measureTime(
        "sync_operations",
        () => {
          const result = BetterResult.Ok<number, string>(42)
            .map((x) => x * 2)
            .zip((y) => y + 10)
            .flatMap(([x, y]) => BetterResult.Ok(x + y));

          return result.unwrap();
        },
      );

      expect(duration).toBeLessThan(1); // Should complete in < 1ms
    });

    test("async operations should have reasonable overhead", async () => {
      const { duration } = await PerformanceMeasurement.measureTime(
        "async_operations",
        async () => {
          const result = BetterResult.fromPromise(Promise.resolve(42))
            .map((x) => x * 2)
            .zip((y) => y + 10);

          return await result.unwrap();
        },
      );

      expect(duration).toBeLessThan(50); // Should complete in < 50ms (including promise overhead)
    });
  });

  describe("Error Handling Edge Cases", () => {
    test("should handle null and undefined values", () => {
      const nullResult = BetterResult.Ok<null, string>(null);
      const undefinedResult = BetterResult.Ok<undefined, string>(undefined);

      expect(nullResult.unwrap()).toBe(null);
      expect(undefinedResult.unwrap()).toBe(undefined);
    });

    test("should handle complex error objects", async () => {
      const complexError = {
        code: 500,
        message: "Server Error",
        timestamp: Date.now(),
      };
      const result = BetterResult.Err<string, typeof complexError>(
        complexError,
      );

      const error = result.unwrapErr();
      expect(error).toEqual(complexError);
      expect(error.code).toBe(500);
      expect(error.message).toBe("Server Error");
    });

    test("should handle Promise rejection with non-error values", async () => {
      const result = BetterResult.fromPromise<string, number>(
        Promise.reject(404),
      );

      expect(result.isAsync()).toBe(true);
      const error = await result.unwrapErr();
      expect(error).toBe(404);
    });
  });

  describe("Type Safety and Inference", () => {
    test("should maintain type safety through transformations", () => {
      const result = BetterResult.Ok<number, string>(42)
        .map((x) => x * 2) // Type: BetterResult<number, string>
        .map((x) => x.toString()) // Type: BetterResult<string, string>
        .map((s) => s.length); // Type: BetterResult<number, string>

      // TypeScript should infer the correct types
      if (result.isOk()) {
        const value: number = result.unwrap();
        expect(typeof value).toBe("number");
      }
    });

    test("should handle complex type transformations", () => {
      interface User {
        id: number;
        name: string;
      }

      const result = BetterResult.Ok<number, string>(42)
        .map((id) => ({ id, name: `User ${id}` }) as User)
        .map((user) => user.name);

      if (result.isOk()) {
        const name: string = result.unwrap();
        expect(typeof name).toBe("string");
      }
    });
  });

  describe("Memory Management", () => {
    test("should not create memory leaks with async operations", async () => {
      const operations = [];

      // Create many async operations
      for (let i = 0; i < 1000; i++) {
        const result = BetterResult.fromPromise(Promise.resolve(i)).map(
          (x) => x * 2,
        );
        operations.push(result);
      }

      // Wait for all to complete
      const results = await Promise.all(operations.map((r) => r.unwrap()));

      expect(results).toHaveLength(1000);
      expect(results[0]).toBe(0);
      expect(results[999]).toBe(1998);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    });
  });
});
