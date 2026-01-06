/**
 * Hybrid Operations Integration Tests
 *
 * Tests complex interactions between SyncResult, AsyncResult, and BetterResult
 * with focus on hybrid sync/async behavior and state transitions.
 */

import { beforeEach, describe, expect, test } from "bun:test";
import {
  AsyncResult,
  BetterResult,
  SyncResult,
} from "@/internal/result.experimental";
import {
  asyncBuilder,
  betterBuilder,
  ComplexAssertions,
  createAsyncMapper,
  createExecutionTracker,
  delay,
  PerformanceMeasurement,
  ResultMatchers,
  syncBuilder,
} from "../index";

describe("Hybrid Operations Integration", () => {
  beforeEach(() => {
    // Reset any global state before each test
  });

  describe("Cross-Class Conversions", () => {
    test("should convert SyncResult to BetterResult", () => {
      const syncResult = SyncResult.Ok<number, string>(42);
      const betterResult = betterBuilder.okWith(syncResult.unwrap());

      expect(syncResult.isOk()).toBe(betterResult.isOk());
      expect(syncResult.unwrap()).toBe(betterResult.unwrap());
    });

    test("should convert AsyncResult to BetterResult", async () => {
      const asyncResult = AsyncResult.Ok<number, string>(42);
      const betterResult = betterBuilder.fromResolved(
        await asyncResult.unwrap(),
      );

      expect(await asyncResult.isOk()).toBe(await betterResult.isOk());
      expect(await asyncResult.unwrap()).toBe(await betterResult.unwrap());
    });

    test("should convert BetterResult to AsyncResult", async () => {
      const betterResult = BetterResult.Ok<number, string>(42);
      const asyncBetterResult = BetterResult.fromPromise(Promise.resolve(42));

      expect(await betterResult.isOk()).toBe(await asyncBetterResult.isOk());
      expect(await betterResult.unwrap()).toBe(
        await asyncBetterResult.unwrap(),
      );
    });

    test("should handle error conversions across classes", async () => {
      const errorValue = "conversion error";

      const syncErr = SyncResult.Err<number, string>(errorValue);
      const asyncErr = AsyncResult.Err<number, string>(errorValue);
      const betterErr = BetterResult.Err<number, string>(errorValue);

      expect(syncErr.unwrapErr()).toBe(errorValue);
      expect(await asyncErr.unwrapErr()).toBe(errorValue);
      expect(betterErr.unwrapErr()).toBe(errorValue);
    });
  });

  describe("Mixed Sync/Async Operation Chains", () => {
    test("should handle sync→async transitions via BetterResult", async () => {
      const tracker = createExecutionTracker();

      const result = BetterResult.Ok<number, string>(10)
        .map((x) => {
          tracker.track("sync_map1");
          return x * 2;
        })
        .flatMap((x) => {
          tracker.track("async_flatMap_start");
          return BetterResult.fromPromise(Promise.resolve(x + 5));
        })
        .map((x) => {
          tracker.track("async_map2");
          return x.toString();
        });

      expect(result.isAsync()).toBe(true);

      const value = await result.unwrap();
      expect(value).toBe("25");

      const execution = tracker.getExecution();
      expect(execution).toContain("sync_map1");
      expect(execution).toContain("async_flatMap_start");
      expect(execution).toContain("async_map2");
    });

    test("should handle async→sync transitions in mixed chains", async () => {
      const result = BetterResult.fromPromise(Promise.resolve(42))
        .map((x) => x.toString()) // Stays async
        .flatMap((s) => BetterResult.Ok(s.length)); // Remains async

      expect(result.isAsync()).toBe(true);
      const value = await result.unwrap();
      expect(value).toBe(2); // "42" has length 2
    });

    test("should handle complex multi-class operation chains", async () => {
      const syncStart = SyncResult.Ok(5);
      const asyncMiddle = AsyncResult.Ok(10);
      const betterEnd = BetterResult.Ok(15);

      // Chain: Sync → Async → Better
      const step1 = syncStart.map((x) => x * 2);
      const step2 = asyncMiddle.map((x) => x + 5);
      const step3 = betterEnd.map((x) => x * 3);

      const [result1, result2, result3] = await Promise.all([
        Promise.resolve(step1.unwrap()),
        step2.unwrap(),
        step3.unwrap(),
      ]);

      expect(result1).toBe(10); // 5*2
      expect(result2).toBe(15); // 10+5
      expect(result3).toBe(45); // 15*3
    });

    test("should preserve error state through mixed transitions", async () => {
      const result = BetterResult.Err<number, string>("initial")
        .map((x) => x * 2) // Won't execute
        .flatMap((x) => BetterResult.fromPromise(Promise.resolve(x + 5))) // Won't execute
        .mapErr((err) => `Processed: ${err}`); // Will execute

      expect(result.isAsync()).toBe(false);
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe("Processed: initial");
    });
  });

  describe("State Transition Patterns", () => {
    test("should detect state changes correctly", async () => {
      const syncResult = BetterResult.Ok<number, string>(42);
      const asyncResult = BetterResult.fromPromise(Promise.resolve(42));

      expect(syncResult.isAsync()).toBe(false);
      expect(asyncResult.isAsync()).toBe(true);

      // Convert sync to async
      const convertedAsync = await syncResult.toPromise();
      expect(convertedAsync.isAsync()).toBe(true);

      // Async remains async after conversion
      const remainAsync = await asyncResult.toPromise();
      expect(remainAsync.isAsync()).toBe(true);
    });

    test("should handle conditional async operations", async () => {
      const shouldUseAsync = false;
      const result = shouldUseAsync
        ? BetterResult.fromPromise(Promise.resolve(42))
        : BetterResult.Ok<number, string>(42);

      // Result should behave correctly regardless of how it was created
      if (result.isAsync()) {
        expect(await result.isOk()).toBe(true);
        expect(await result.unwrap()).toBe(42);
      } else {
        expect(result.isOk()).toBe(true);
        expect(result.unwrap()).toBe(42);
      }
    });

    test("should handle dynamic state transitions based on conditions", async () => {
      function createConditionalResult(
        value: number,
      ): BetterResult<number, string> {
        return value > 100
          ? BetterResult.fromPromise(Promise.resolve(value))
          : BetterResult.Ok(value);
      }

      const syncValue = 50;
      const asyncValue = 150;

      const syncResult = createConditionalResult(syncValue);
      const asyncResult = createConditionalResult(asyncValue);

      expect(syncResult.isAsync()).toBe(false);
      expect(asyncResult.isAsync()).toBe(true);

      expect(syncResult.unwrap()).toBe(50);
      expect(await asyncResult.unwrap()).toBe(150);
    });
  });

  describe("Error Propagation Across Classes", () => {
    test("should propagate errors consistently across all Result types", async () => {
      const errorValue = "cross-class error";

      const syncErr = SyncResult.Err<number, string>(errorValue);
      const asyncErr = AsyncResult.Err<number, string>(errorValue);
      const betterErr = BetterResult.Err<number, string>(errorValue);

      // All should preserve the error through transformations
      const syncMapped = syncErr.map((x) => x * 2);
      const asyncMapped = asyncErr.map((x) => x * 2);
      const betterMapped = betterErr.map((x) => x * 2);

      expect(syncMapped.isErr()).toBe(true);
      expect(await asyncMapped.isErr()).toBe(true);
      expect(betterMapped.isErr()).toBe(true);

      expect(syncMapped.unwrapErr()).toBe(errorValue);
      expect(await asyncMapped.unwrapErr()).toBe(errorValue);
      expect(betterMapped.unwrapErr()).toBe(errorValue);
    });

    test("should transform errors consistently across classes", async () => {
      const initialError = "initial error";
      const transformedError = "Transformed: initial error";

      const syncResult = SyncResult.Err<number, string>(initialError).mapErr(
        (err) => `Transformed: ${err}`,
      );

      const asyncResult = AsyncResult.Err<number, string>(initialError).mapErr(
        (err) => `Transformed: ${err}`,
      );

      const betterResult = BetterResult.Err<number, string>(
        initialError,
      ).mapErr((err) => `Transformed: ${err}`);

      expect(syncResult.unwrapErr()).toBe(transformedError);
      expect(await asyncResult.unwrapErr()).toBe(transformedError);
      expect(betterResult.unwrapErr()).toBe(transformedError);
    });

    test("should handle error type changes consistently", async () => {
      interface ComplexError {
        code: number;
        message: string;
      }

      const transformError = (err: string): ComplexError => ({
        code: 500,
        message: `Error: ${err}`,
      });

      const syncResult = SyncResult.Err<string, string>("sync error").mapErr(
        transformError,
      );

      const asyncResult = AsyncResult.Err<string, string>("async error").mapErr(
        transformError,
      );

      const betterResult = BetterResult.Err<string, string>(
        "better error",
      ).mapErr(transformError);

      const syncErr = syncResult.unwrapErr();
      const asyncErr = await asyncResult.unwrapErr();
      const betterErr = betterResult.unwrapErr();

      expect(syncErr.code).toBe(500);
      expect(asyncErr.code).toBe(500);
      expect(betterErr.code).toBe(500);

      expect(syncErr.message).toBe("Error: sync error");
      expect(asyncErr.message).toBe("Error: async error");
      expect(betterErr.message).toBe("Error: better error");
    });
  });

  describe("Performance of Hybrid Operations", () => {
    test("should handle hybrid operations efficiently", async () => {
      const iterations = 1000;

      const { duration } = await PerformanceMeasurement.measureTime(
        "hybrid_operations",
        async () => {
          const operations = [];

          for (let i = 0; i < iterations; i++) {
            if (i % 2 === 0) {
              // Sync path
              operations.push(
                BetterResult.Ok(i)
                  .map((x) => x * 2)
                  .unwrap(),
              );
            } else {
              // Async path
              operations.push(
                BetterResult.fromPromise(Promise.resolve(i))
                  .map((x) => x * 2)
                  .unwrap(),
              );
            }
          }

          return Promise.all(operations);
        },
      );

      expect(duration).toBeLessThan(100); // Should handle 1000 mixed operations efficiently
    });

    test("should minimize async overhead when possible", async () => {
      const syncChain = BetterResult.Ok(1)
        .map((x) => x * 2)
        .map((x) => x + 1)
        .map((x) => x.toString());

      const asyncChain = BetterResult.fromPromise(Promise.resolve(1))
        .map((x) => x * 2)
        .map((x) => x + 1)
        .map((x) => x.toString());

      const syncTime = await PerformanceMeasurement.measureTime(
        "sync_chain",
        () => syncChain.unwrap(),
      );

      const asyncTime = await PerformanceMeasurement.measureTime(
        "async_chain",
        () => asyncChain.unwrap(),
      );

      // Sync should be significantly faster
      expect(syncTime.duration).toBeLessThan(asyncTime.duration);
      // But async should still be reasonable
      expect(asyncTime.duration).toBeLessThan(50);
    });
  });

  describe("Complex Real-World Scenarios", () => {
    test("should handle API call simulation with fallback", async () => {
      function simulateApiCall(
        success: boolean,
        delayMs: number = 50,
      ): BetterResult<string, string> {
        return success
          ? BetterResult.fromPromise(
              Promise.resolve().then(() => {
                // Simulate network delay
                return new Promise<string>((resolve) =>
                  setTimeout(() => resolve("API Data"), delayMs),
                );
              }),
            )
          : BetterResult.Err("Network Error");
      }

      // Successful API call
      const successResult = simulateApiCall(true, 20);
      expect(successResult.isAsync()).toBe(true);
      expect(await successResult.isOk()).toBe(true);
      expect(await successResult.unwrap()).toBe("API Data");

      // Failed API call with fallback
      const failureResult = simulateApiCall(false)
        .mapErr((err) => `Fallback: ${err}`)
        .map((x) => x || "Default Data");

      expect(failureResult.isAsync()).toBe(false);
      expect(failureResult.isErr()).toBe(true);
      expect(failureResult.unwrapErr()).toBe("Fallback: Network Error");
    });

    test("should handle database query simulation", async () => {
      interface User {
        id: number;
        name: string;
        active: boolean;
      }

      function simulateDbQuery(userId: number): BetterResult<User, string> {
        // Simulate async database query
        return BetterResult.fromPromise(
          Promise.resolve().then(async () => {
            await delay(30);
            if (userId <= 0) {
              throw new Error("Invalid user ID");
            }
            return { id: userId, name: `User ${userId}`, active: true };
          }),
        );
      }

      function validateUser(user: User): BetterResult<User, string> {
        return user.active
          ? BetterResult.Ok(user)
          : BetterResult.Err("User inactive");
      }

      // Successful query and validation
      const result1 = await simulateDbQuery(42).flatMap((user) =>
        validateUser(user),
      );

      expect(result1.isOk()).toBe(true);
      const user = result1.unwrap();
      expect(user.id).toBe(42);
      expect(user.name).toBe("User 42");

      // Failed query
      const result2 = await simulateDbQuery(-1);
      expect(result2.isErr()).toBe(true);
      expect(result2.unwrapErr().message).toBe("Invalid user ID");
    });

    test("should handle file processing pipeline", async () => {
      function readFile(path: string): BetterResult<string, string> {
        // Simulate async file read
        if (!path.endsWith(".txt")) {
          return BetterResult.Err("Invalid file format");
        }
        return BetterResult.fromPromise(Promise.resolve(`Content of ${path}`));
      }

      function processFile(
        content: string,
      ): BetterResult<{ lines: number; words: number }, string> {
        const lines = content.split("\n").length;
        const words = content.split(/\s+/).length;
        return BetterResult.Ok({ lines, words });
      }

      // Successful processing
      const result1 = await readFile("data.txt").flatMap((content) =>
        processFile(content),
      );

      expect(result1.isOk()).toBe(true);
      const stats = result1.unwrap();
      expect(stats.lines).toBe(1);
      expect(stats.words).toBe(3);

      // Failed validation
      const result2 = readFile("data.json").flatMap((content) =>
        processFile(content),
      );

      expect(result2.isErr()).toBe(true);
      expect(result2.unwrapErr()).toBe("Invalid file format");
    });
  });

  describe("Concurrent Hybrid Operations", () => {
    test("should handle concurrent mixed operations", async () => {
      const operations = [
        BetterResult.Ok(1),
        BetterResult.fromPromise(Promise.resolve(2)),
        BetterResult.Ok(3),
        BetterResult.fromPromise(Promise.resolve(4)),
      ];

      // Process all operations concurrently
      const results = await Promise.all(
        operations.map((op) =>
          op.isAsync() ? op.unwrap() : Promise.resolve(op.unwrap()),
        ),
      );

      expect(results).toEqual([1, 2, 3, 4]);
    });

    test("should handle concurrent operations with mixed success/failure", async () => {
      const operations = [
        BetterResult.Ok(1),
        BetterResult.Err(2, "error2"),
        BetterResult.fromPromise(Promise.resolve(3)),
        BetterResult.fromPromise(Promise.reject("error4")),
      ];

      const results = await Promise.allSettled(
        operations.map(async (op) => {
          if (op.isAsync()) {
            try {
              return { success: true, value: await op.unwrap() };
            } catch (error) {
              return { success: false, error };
            }
          } else {
            try {
              return { success: true, value: op.unwrap() };
            } catch (error) {
              return { success: false, error };
            }
          }
        }),
      );

      expect(results[0].status).toBe("fulfilled");
      expect(results[1].status).toBe("fulfilled");
      expect(results[2].status).toBe("fulfilled");
      expect(results[3].status).toBe("fulfilled");

      // @ts-expect-error
      expect(results[0].value.success).toBe(true);
      // @ts-expect-error
      expect(results[1].value.success).toBe(false);
      // @ts-expect-error
      expect(results[2].value.success).toBe(true);
      // @ts-expect-error
      expect(results[3].value.success).toBe(false);
    });
  });
});
